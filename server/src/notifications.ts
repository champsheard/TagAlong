import { randomUUID } from "node:crypto";
import { database } from "./db";
import { HttpError } from "./errors";
import { installationProfile, type Installation } from "./identities";
import { writable } from "./trips";
import { pushLiveActivity, remoteWidgetsAvailable } from "./apns";
import type { WidgetState } from "../../shared/contacts";

type NotificationRow = { id: string; trip_id: string; installation_id: string; event: string; attempts: number; push_token: string | null; push_start_token: string | null; platform: string };
type TripSnapshot = WidgetState;
function snapshot(tripId: string): TripSnapshot | null {
  const t = database.prepare("SELECT id,share_code,status,eta_at,last_update_at,expires_at,demo,travel_mode FROM trips WHERE id = ?")
    .get(tripId) as { id: string; share_code: string; status: WidgetState["status"]; eta_at: number; last_update_at: number | null; expires_at: number; demo: number; travel_mode: WidgetState["travelMode"] } | undefined;
  return t ? { shareCode: t.share_code, status: t.expires_at <= Date.now() ? "expired" : t.status, etaAt: t.eta_at, lastUpdateAt: t.last_update_at, expiresAt: t.expires_at, demo: !!t.demo, travelMode: t.travel_mode } : null;
}
function enqueue(tripId: string, installationId: string, event: string) {
  database.prepare("INSERT INTO notification_outbox(id,trip_id,installation_id,event,next_attempt_at,created_at) VALUES(?,?,?,?,?,?)")
    .run(randomUUID(), tripId, installationId, event, Date.now(), Date.now());
}
export function shareToInstallations(tripId: string, writeToken: string | undefined, sender: Installation, ids: unknown) {
  const trip = writable(tripId, writeToken);
  if (trip.status !== "active") throw new HttpError(409, "Share an active trip. This trip has ended.");
  if (!installationProfile(sender).verifiedKinds.length) throw new HttpError(403, "Verify your phone or email before sharing to app contacts.");
  if (!Array.isArray(ids) || !ids.length || ids.length > 250 || ids.some(id => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))) throw new HttpError(400, "Choose up to 250 app devices.");
  let sharedCount = 0, notificationsQueued = 0;
  const recipients = [...new Set(ids)] as string[];
  for (const id of recipients) {
    const receiver = database.prepare(`SELECT * FROM installations WHERE id = ? AND discoverable = 1 AND platform IN ('ios','android')
      AND seen_at > ? AND EXISTS (SELECT 1 FROM contact_identifiers WHERE installation_id = ?)`)
      .get(id, Date.now() - 30 * 86400000, id) as Installation | undefined;
    if (!receiver || receiver.id === sender.id) continue;
    const old = database.prepare("SELECT created_at FROM trip_recipients WHERE trip_id = ? AND installation_id = ?").get(tripId, id) as { created_at: number } | undefined;
    if (old && Date.now() - old.created_at < 60000) { sharedCount++; continue; }
    database.prepare("INSERT OR REPLACE INTO trip_recipients(trip_id,installation_id,sender_id,created_at) VALUES(?,?,?,?)")
      .run(tripId, id, sender.id, Date.now());
    sharedCount++;
    if (receiver.push_token) { enqueue(tripId, id, "shared"); notificationsQueued++; }
    if (receiver.push_start_token && remoteWidgetsAvailable()) enqueue(tripId, id, "live-start");
  }
  if (!sharedCount) throw new HttpError(404, "This contact is no longer enrolled. Share the private link instead.");
  return { sharedCount, notificationsQueued };
}
export function receivedTrips(installation: Installation) {
  return database.prepare(`SELECT t.share_code AS shareCode,t.status,t.started_at AS startedAt,t.eta_at AS etaAt,t.expires_at AS expiresAt,t.demo,t.travel_mode AS travelMode
    FROM trips t JOIN trip_recipients r ON r.trip_id = t.id WHERE r.installation_id = ? AND t.expires_at > ? ORDER BY r.created_at DESC LIMIT 30`)
    .all(installation.id, Date.now()).map((row: any) => ({ ...row, demo: !!row.demo }));
}
export function subscribeWidget(installation: Installation, code: string, body: { activityId?: string; pushToken?: string }) {
  if (!/^[a-zA-Z0-9_-]{22,64}$/.test(code)) throw new HttpError(404, "Invalid tracking link.");
  const trip = database.prepare("SELECT id FROM trips WHERE share_code = ? AND expires_at > ?").get(code, Date.now()) as { id: string } | undefined;
  if (!trip) throw new HttpError(404, "This trip expired.");
  if (typeof body.activityId !== "string" || body.activityId.length > 150 || !body.activityId.length ||
    typeof body.pushToken !== "string" || !/^[a-f0-9]{32,512}$/i.test(body.pushToken)) throw new HttpError(400, "Invalid Live Activity subscription.");
  database.prepare("INSERT OR REPLACE INTO widget_subscriptions(trip_id,installation_id,activity_id,push_token,last_sent_at) VALUES(?,?,?,?,0)")
    .run(trip.id, installation.id, body.activityId, body.pushToken);
  return { ok: true, remoteUpdatesAvailable: remoteWidgetsAvailable() };
}
export function removeWidgetSubscription(installationId: string, activityId: unknown) {
  if (typeof activityId !== "string" || activityId.length > 150) throw new HttpError(400, "Invalid activity identifier.");
  database.prepare("DELETE FROM widget_subscriptions WHERE installation_id = ? AND activity_id = ?").run(installationId, activityId);
}
export function scheduleTripUpdate(tripId: string, event: "refresh" | "arrived" | "help" | "remote-stop") {
  const recipients = database.prepare(`SELECT i.id,i.platform,i.push_token FROM trip_recipients r JOIN installations i ON i.id = r.installation_id WHERE r.trip_id = ?`)
    .all(tripId) as { id: string; platform: string; push_token: string | null }[];
  for (const r of recipients) {
    if (!r.push_token || (event === "refresh" && r.platform !== "android")) continue;
    if (event === "refresh") {
      const recent = database.prepare("SELECT 1 FROM notification_outbox WHERE trip_id = ? AND installation_id = ? AND event = 'refresh' AND created_at > ?")
        .get(tripId, r.id, Date.now() - 60000);
      if (recent) continue;
    }
    enqueue(tripId, r.id, event);
  }
  if (event !== "refresh") database.prepare("UPDATE widget_subscriptions SET last_sent_at = 0 WHERE trip_id = ?").run(tripId);
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
        database.prepare("UPDATE installations SET push_token = NULL WHERE push_token = ?").run(token);
        return false;
      }
      throw new Error("Notification was not accepted");
    }
    return true; // Accepted by Expo, not proof that the person saw the notification.
  },
};
let processing = false;
export async function processNotifications() {
  if (processing) return;
  processing = true;
  try {
    const jobs = database.prepare(`SELECT o.*,i.push_token,i.push_start_token,i.platform FROM notification_outbox o
      JOIN installations i ON i.id = o.installation_id WHERE o.state = 'pending' AND o.next_attempt_at <= ? LIMIT 20`)
      .all(Date.now()) as NotificationRow[];
    for (const job of jobs) {
      const state = snapshot(job.trip_id);
      if (!state || state.status === "expired") { database.prepare("UPDATE notification_outbox SET state = 'unavailable' WHERE id = ?").run(job.id); continue; }
      try {
        const accepted = job.event === "live-start"
          ? !!job.push_start_token && await pushLiveActivity(job.push_start_token, "start", state)
          : !!job.push_token && await notificationTransport.expo(job.push_token, state, job.event);
        database.prepare("UPDATE notification_outbox SET state = ? WHERE id = ?").run(accepted ? "accepted" : "unavailable", job.id);
      } catch {
        database.prepare("UPDATE notification_outbox SET attempts = attempts + 1,state = ?,next_attempt_at = ? WHERE id = ?")
          .run(job.attempts >= 4 ? "failed" : "pending", Date.now() + Math.min(60000, 5000 * 2 ** job.attempts), job.id);
      }
    }
    if (remoteWidgetsAvailable()) {
      const activities = database.prepare("SELECT * FROM widget_subscriptions WHERE last_sent_at < ? LIMIT 30").all(Date.now() - 60000) as
        { trip_id: string; installation_id: string; activity_id: string; push_token: string }[];
      for (const activity of activities) {
        const state = snapshot(activity.trip_id);
        if (!state) continue;
        try {
          await pushLiveActivity(activity.push_token, state.status === "active" ? "update" : "end", state);
          if (state.status !== "active") database.prepare("DELETE FROM widget_subscriptions WHERE installation_id = ? AND activity_id = ?").run(activity.installation_id, activity.activity_id);
          else database.prepare("UPDATE widget_subscriptions SET last_sent_at = ? WHERE installation_id = ? AND activity_id = ?").run(Date.now(), activity.installation_id, activity.activity_id);
        } catch { database.prepare("UPDATE widget_subscriptions SET last_sent_at = ? WHERE installation_id = ? AND activity_id = ?").run(Date.now(), activity.installation_id, activity.activity_id); }
      }
    }
  } finally { processing = false; }
}
export function startNotificationWorker() {
  const timer = setInterval(() => { processNotifications().catch(() => {}); }, 5000);
  timer.unref(); return timer;
}
