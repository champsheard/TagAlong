import { randomUUID } from "node:crypto";
import { database, documentId } from "./firestore";
import { HttpError } from "./errors";
import { installationProfile, type Installation } from "./identities";
import { writable } from "./trips";
import { pushLiveActivity, remoteWidgetsAvailable } from "./apns";
import type { WidgetState } from "../../shared/contacts";

type NotificationRow = {
  id: string; trip_id: string; installation_id: string; event: string; attempts: number;
  push_token: string | null; push_start_token: string | null; platform: string;
  state: string; next_attempt_at: number; locked_until?: number | null;
};
type TripSnapshot = WidgetState;
async function snapshot(tripId: string): Promise<TripSnapshot | null> {
  const trip = await database.collection("trips").doc(tripId).get();
  const t = trip.data() as { id: string; share_code: string; status: WidgetState["status"]; eta_at: number; last_update_at: number | null; expires_at: number; demo: number; travel_mode: WidgetState["travelMode"] } | undefined;
  return t ? { shareCode: t.share_code, status: t.expires_at <= Date.now() ? "expired" : t.status, etaAt: t.eta_at, lastUpdateAt: t.last_update_at, expiresAt: t.expires_at, demo: !!t.demo, travelMode: t.travel_mode } : null;
}
async function enqueue(tripId: string, installationId: string, event: string) {
  const id = randomUUID(), now = Date.now();
  await database.collection("notification_outbox").doc(id).create({
    id, trip_id: tripId, installation_id: installationId, event,
    state: "pending", attempts: 0, next_attempt_at: now, created_at: now,
  });
}
export async function shareToInstallations(tripId: string, writeToken: string | undefined, sender: Installation, ids: unknown) {
  const trip = await writable(tripId, writeToken);
  if (trip.status !== "active") throw new HttpError(409, "Share an active trip. This trip has ended.");
  if (!(await installationProfile(sender)).verifiedKinds.length) throw new HttpError(403, "Verify your phone or email before sharing to app contacts.");
  if (!Array.isArray(ids) || !ids.length || ids.length > 250 || ids.some(id => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))) throw new HttpError(400, "Choose up to 250 app devices.");
  let sharedCount = 0, notificationsQueued = 0;
  const recipients = [...new Set(ids)] as string[];
  for (const id of recipients) {
    const receiverSnapshot = await database.collection("installations").doc(id).get();
    const receiver = receiverSnapshot.data() as Installation | undefined;
    if (!receiver || receiver.id === sender.id) continue;
    const identifiers = await database.collection("contact_identifiers").where("installation_id", "==", id).limit(1).get();
    if (!receiver.discoverable || !["ios", "android"].includes(receiver.platform) ||
        receiver.seen_at <= Date.now() - 30 * 86400000 || identifiers.empty) continue;
    const recipientRef = database.collection("trip_recipients").doc(documentId(tripId, id));
    const oldSnapshot = await recipientRef.get();
    const old = oldSnapshot.data() as { created_at: number } | undefined;
    if (old && Date.now() - old.created_at < 60000) { sharedCount++; continue; }
    await recipientRef.set({ trip_id: tripId, installation_id: id, sender_id: sender.id, created_at: Date.now() });
    sharedCount++;
    if (receiver.push_token) { await enqueue(tripId, id, "shared"); notificationsQueued++; }
    if (receiver.push_start_token && remoteWidgetsAvailable()) await enqueue(tripId, id, "live-start");
  }
  if (!sharedCount) throw new HttpError(404, "This contact is no longer enrolled. Share the private link instead.");
  return { sharedCount, notificationsQueued };
}
export async function receivedTrips(installation: Installation) {
  const rows = await database.collection("trip_recipients").where("installation_id", "==", installation.id)
    .get();
  const sortedRows = rows.docs.sort((a, b) => Number(b.data().created_at) - Number(a.data().created_at)).slice(0, 30);
  const trips = await Promise.all(sortedRows.map(async row => {
    const trip = await database.collection("trips").doc(row.data().trip_id).get();
    const value = trip.data();
    if (!value || value.expires_at <= Date.now()) return null;
    return { shareCode: value.share_code, status: value.status, startedAt: value.started_at, etaAt: value.eta_at,
      expiresAt: value.expires_at, demo: !!value.demo, travelMode: value.travel_mode };
  }));
  return trips.filter(Boolean);
}
export async function subscribeWidget(installation: Installation, code: string, body: { activityId?: string; pushToken?: string }) {
  if (!/^[a-zA-Z0-9_-]{22,64}$/.test(code)) throw new HttpError(404, "Invalid tracking link.");
  const tripSnapshot = await database.collection("trips").where("share_code", "==", code).limit(1).get();
  const trip = tripSnapshot.empty ? undefined : tripSnapshot.docs[0].data() as { id: string; expires_at: number };
  if (!trip || trip.expires_at <= Date.now()) throw new HttpError(404, "This trip expired.");
  if (typeof body.activityId !== "string" || body.activityId.length > 150 || !body.activityId.length ||
    typeof body.pushToken !== "string" || !/^[a-f0-9]{32,512}$/i.test(body.pushToken)) throw new HttpError(400, "Invalid Live Activity subscription.");
  await database.collection("widget_subscriptions").doc(documentId(trip.id, installation.id, body.activityId))
    .set({ trip_id: trip.id, installation_id: installation.id, activity_id: body.activityId, push_token: body.pushToken, last_sent_at: 0 });
  return { ok: true, remoteUpdatesAvailable: remoteWidgetsAvailable() };
}
export async function removeWidgetSubscription(installationId: string, activityId: unknown) {
  if (typeof activityId !== "string" || activityId.length > 150) throw new HttpError(400, "Invalid activity identifier.");
  const rows = await database.collection("widget_subscriptions").where("installation_id", "==", installationId)
    .get();
  const batch = database.batch();
  for (const row of rows.docs) if (row.data().activity_id === activityId) batch.delete(row.ref);
  if (!rows.empty) await batch.commit();
}
export async function scheduleTripUpdate(tripId: string, event: "refresh" | "arrived" | "help" | "remote-stop") {
  const recipientRows = await database.collection("trip_recipients").where("trip_id", "==", tripId).get();
  const recipients = await Promise.all(recipientRows.docs.map(async row => {
    const installationId = row.data().installation_id as string;
    const installation = await database.collection("installations").doc(installationId).get();
    return installation.data() as { id: string; platform: string; push_token: string | null } | undefined;
  }));
  for (const r of recipients) {
    if (!r || !r.push_token || (event === "refresh" && r.platform !== "android")) continue;
    if (event === "refresh") {
      const recent = await database.collection("notification_outbox").where("trip_id", "==", tripId).get();
      if (recent.docs.some(row => row.data().installation_id === r.id && row.data().event === "refresh" &&
          row.data().created_at > Date.now() - 60000)) continue;
    }
    await enqueue(tripId, r.id, event);
  }
  if (event !== "refresh") {
    const widgets = await database.collection("widget_subscriptions").where("trip_id", "==", tripId).get();
    const batch = database.batch();
    for (const widget of widgets.docs) batch.update(widget.ref, { last_sent_at: 0 });
    if (!widgets.empty) await batch.commit();
  }
}
export const notificationTransport = {
  async expo(token: string, state: WidgetState, event: string) {
    const visible = event !== "refresh";
    const title = event === "remote-stop" ? "Tagalong: remote stop warning"
      : state.status === "help" ? "Tagalong: help requested"
        : state.status === "arrived" ? "Tagalong: contact arrived" : "A contact shared a Tagalong trip";
    const body = event === "remote-stop"
      ? "Your contact's drive appears stopped in a remote area. Please check in with them."
      : state.status === "help"
      ? "Open the app to see the last shared location. Contact them directly."
      : state.status === "arrived"
        ? "Your contact confirmed they’ve arrived. Location sharing has stopped."
        : "Tap to open the live tracking map.";
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify({ to: token, data: { kind: "safe-walk-trip", ...state },
        ...(visible ? { title, body, sound: "default", channelId: "walks", priority: "high" } : { priority: "high", _contentAvailable: true }) }),
    });
    if (!response.ok) throw new Error("Notification service unavailable");
    const result = await response.json() as { data?: { status: string; details?: { error?: string } } };
    if (result.data?.status !== "ok") {
      if (result.data?.details?.error === "DeviceNotRegistered") {
        const matches = await database.collection("installations").where("push_token", "==", token).get();
        const batch = database.batch();
        for (const match of matches.docs) batch.update(match.ref, { push_token: null });
        if (!matches.empty) await batch.commit();
        return false;
      }
      throw new Error("Notification was not accepted");
    }
    return true; // Accepted by Expo, not proof that the person saw the notification.
  },
};
let processing = false;
async function claimNotification(reference: FirebaseFirestore.DocumentReference, now: number) {
  return database.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    const job = snapshot.data() as NotificationRow | undefined;
    if (!job) return undefined;
    const eligible = (job.state === "pending" && Number(job.next_attempt_at) <= now) ||
      (job.state === "processing" && Number(job.locked_until ?? 0) <= now);
    if (!eligible) return undefined;
    transaction.update(reference, { state: "processing", locked_until: now + 45000 });
    return job;
  });
}

export async function processNotifications(maxJobs = 20, maxWidgets = 30) {
  if (processing) return;
  processing = true;
  try {
    const [pendingJobs, processingJobs] = await Promise.all([
      database.collection("notification_outbox").where("state", "==", "pending").limit(maxJobs * 4).get(),
      database.collection("notification_outbox").where("state", "==", "processing").limit(maxJobs * 4).get(),
    ]);
    const now = Date.now();
    const dueJobs = [
      ...pendingJobs.docs.filter(doc => Number(doc.data().next_attempt_at) <= now),
      ...processingJobs.docs.filter(doc => Number(doc.data().locked_until ?? 0) <= now),
    ].slice(0, maxJobs);
    const jobs = await Promise.all(dueJobs.map(async doc => {
      const job = await claimNotification(doc.ref, Date.now());
      if (!job) return undefined;
      const installation = await database.collection("installations").doc(job.installation_id).get();
      return { ...job, ref: doc.ref, ...(installation.data() as { push_token: string | null; push_start_token: string | null; platform: string } | undefined) };
    }));
    for (const job of jobs.filter((value): value is NonNullable<typeof value> => !!value)) {
      if (!job.push_token && !job.push_start_token) { await job.ref.update({ state: "unavailable", locked_until: null }); continue; }
      const state = await snapshot(job.trip_id);
      if (!state || state.status === "expired") { await job.ref.update({ state: "unavailable", locked_until: null }); continue; }
      try {
        const accepted = job.event === "live-start"
          ? !!job.push_start_token && await pushLiveActivity(job.push_start_token, "start", state)
          : !!job.push_token && await notificationTransport.expo(job.push_token, state, job.event);
        await job.ref.update({ state: accepted ? "accepted" : "unavailable", locked_until: null });
      } catch {
        await job.ref.update({
          attempts: (job.attempts ?? 0) + 1,
          state: (job.attempts ?? 0) >= 4 ? "failed" : "pending",
          locked_until: null,
          next_attempt_at: Date.now() + Math.min(60000, 5000 * 2 ** (job.attempts ?? 0)),
        });
      }
    }
    if (remoteWidgetsAvailable()) {
      const activitiesSnapshot = await database.collection("widget_subscriptions").where("last_sent_at", "<", Date.now() - 60000).limit(maxWidgets).get();
      const activities = activitiesSnapshot.docs.map(doc => ({ ...doc.data(), ref: doc.ref })) as
        ({ trip_id: string; installation_id: string; activity_id: string; push_token: string; ref: FirebaseFirestore.DocumentReference }[]);
      for (const activity of activities) {
        const state = await snapshot(activity.trip_id);
        if (!state) continue;
        try {
          await pushLiveActivity(activity.push_token, state.status === "active" ? "update" : "end", state);
          if (state.status !== "active") await activity.ref.delete();
          else await activity.ref.update({ last_sent_at: Date.now() });
        } catch { await activity.ref.update({ last_sent_at: Date.now() }); }
      }
    }
  } finally { processing = false; }
}
export function startNotificationWorker() {
  const timer = setInterval(() => { processNotifications().catch(() => {}); }, 5000);
  timer.unref(); return timer;
}
