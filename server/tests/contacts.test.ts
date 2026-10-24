import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import { canonicalIdentifier, normalizeIdentifier, rankContacts } from "../../shared/contacts";
import { parseWidgetState } from "../../lib/widgetState";

process.env.FIRESTORE_COLLECTION_PREFIX = `test_contacts_${process.pid}_`;
process.env.SESSION_SECRET = "test-only-not-a-production-secret";
let server: Server, origin: string;
let db: typeof import("../src/firestore");
let identities: typeof import("../src/identities");
let notifications: typeof import("../src/notifications");
let gateway: typeof import("../src/verificationGateway");
let sentCode = "", sends = 0, queuedPushes = 0;
const pushDeliveries: { event: string; status: string }[] = [];
const geometry = { type: "LineString", coordinates: [[0, 0], [0.001, 0]] };
before(async () => {
  const { app } = await import("../src/app");
  db = await import("../src/firestore"); identities = await import("../src/identities");
  notifications = await import("../src/notifications"); gateway = await import("../src/verificationGateway");
  gateway.verificationGateway.capabilities = async () => ({ at: Date.now(), sms: true, email: true });
  gateway.verificationGateway.send = async (_kind, _destination, code) => { sentCode = code; sends++; };
  notifications.notificationTransport.expo = async (_token, state, event) => {
    queuedPushes++; pushDeliveries.push({ event, status: state.status }); return true;
  };
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => { server.close(); await db.clearPrefixedCollections(); });
async function call(path: string, method = "GET", body?: unknown, token?: string, extra: Record<string, string> = {}) {
  const response = await fetch(origin + "/api" + path, { method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
async function enroll(platform = "ios") {
  const r = await call("/installations", "POST", { platform }); assert.equal(r.status, 201); return r.data;
}
async function verify(s: { authToken: string }, email: string) {
  const begin = await identities.beginVerification(await identities.authenticateInstallation(s.authToken), { kind: "email", identifier: email });
  return call("/installations/confirm", "POST", { challengeId: begin.challengeId, code: sentCode }, s.authToken);
}
const hash = (kind: "email" | "phone", value: string) => createHash("sha256").update(canonicalIdentifier(kind, value)).digest("hex");
test("normalization, country handling, and installed-first contact ordering", () => {
  assert.equal(normalizeIdentifier("email", " PERSON@Example.COM "), "person@example.com");
  assert.equal(normalizeIdentifier("phone", "(415) 555-0123", "US"), "+14155550123");
  assert.equal(normalizeIdentifier("phone", "020 7946 0018", "GB"), "+442079460018");
  assert.equal(normalizeIdentifier("phone", "not a number"), null);
  assert.equal(normalizeIdentifier("phone", "+14155550123", {} as string), null);
  const contact = (name: string, hashes: string[]) => ({ id: name, name, hashes, installationIds: [], notificationsEnabled: false });
  const ranked = rankContacts([contact("Aaron", ["a"]), contact("Zoe", ["z"]), contact("Bea", ["b"])],
    [{ hash: "z", installationId: "device", notificationsEnabled: true }, { hash: "z", installationId: "device", notificationsEnabled: false }]);
  assert.deepEqual(ranked.map(c => c.name), ["Zoe", "Aaron", "Bea"]);
  assert.deepEqual(ranked[0].installationIds, ["device"]);
});
test("device credentials are hashed and unauthenticated matching is forbidden", async () => {
  const s = await enroll();
  const row = (await db.database.collection("installations").doc(s.installationId).get()).data() as { token_hash: string };
  assert.notEqual(row.token_hash, s.authToken);
  const profile = await call("/installations/me", "GET", undefined, s.authToken);
  assert.equal(profile.data.autoShare, true);
  const optedOut = await call("/installations/me", "PATCH", { autoShare: false }, s.authToken);
  assert.equal(optedOut.data.autoShare, false);
  assert.equal((await call("/installations/me", "GET", undefined, s.authToken)).data.autoShare, false);
  assert.equal((await call("/installations/me", "PATCH", { autoShare: "false" }, s.authToken)).status, 400);
  assert.equal((await call("/installations/me")).status, 401);
  assert.equal((await call("/contacts/discover", "POST", { hashes: [] }, s.authToken)).status, 403);
  assert.equal((await call("/installations/me", "PATCH", { pushToken: "not-an-expo-token" }, s.authToken)).status, 400);
});
test("verification requires ownership, limits attempts, and never stores raw identifiers or codes", async () => {
  const s = await enroll();
  const challenge = await call("/installations/verify", "POST", { kind: "email", identifier: "owner@example.test" }, s.authToken);
  assert.equal(challenge.status, 200); assert.match(sentCode, /^\d{6}$/);
  assert.equal(challenge.data.code, undefined);
  const row = (await db.database.collection("verification_challenges").doc(challenge.data.challengeId).get()).data();
  assert.ok(!JSON.stringify(row).includes("owner@example.test"));
  assert.ok(!JSON.stringify(row).includes(`"${sentCode}"`));
  assert.equal((await call("/installations/confirm", "POST", { challengeId: challenge.data.challengeId, code: "000000" }, s.authToken)).status, 400);
  assert.equal((await call("/installations/confirm", "POST", { challengeId: challenge.data.challengeId, code: sentCode }, s.authToken)).status, 200);
  assert.equal((await call("/installations/confirm", "POST", { challengeId: challenge.data.challengeId, code: sentCode }, s.authToken)).status, 400);
  const other = await enroll();
  const locked = await identities.beginVerification(await identities.authenticateInstallation(other.authToken), { kind: "email", identifier: "attempts@example.test" });
  for (let i = 0; i < 5; i++) assert.equal((await call("/installations/confirm", "POST", { challengeId: locked.challengeId, code: "000000" }, other.authToken)).status, 400);
  assert.equal((await call("/installations/confirm", "POST", { challengeId: locked.challengeId, code: sentCode }, other.authToken)).status, 400);
});
test("matching finds verified mobile devices only, and respects discovery opt-out and deletion", async () => {
  const seeker = await enroll(), phone = await enroll("android"), web = await enroll("web");
  await verify(seeker, "seeker@example.test"); await verify(phone, "matched@example.test"); await verify(web, "matched@example.test");
  const digest = hash("email", "matched@example.test");
  const matches = await call("/contacts/discover", "POST", { hashes: [digest] }, seeker.authToken);
  assert.equal(matches.status, 200); assert.equal(matches.data.matches.length, 1);
  assert.equal(matches.data.matches[0].installationId, phone.installationId);
  assert.equal((await call("/contacts/discover", "POST", { hashes: ["matched@example.test"] }, seeker.authToken)).status, 400);
  await call("/installations/me", "PATCH", { discoverable: false }, phone.authToken);
  assert.equal((await call("/contacts/discover", "POST", { hashes: [digest] }, seeker.authToken)).data.matches.length, 0);
  await call("/installations/me", "PATCH", { discoverable: true }, phone.authToken);
  await call("/installations/me", "DELETE", undefined, phone.authToken);
  assert.equal((await call("/contacts/discover", "POST", { hashes: [digest] }, seeker.authToken)).data.matches.length, 0);
  assert.equal((await call("/installations/me", "GET", undefined, phone.authToken)).status, 401);
  assert.equal((await db.database.collection("contact_identifiers").where("installation_id", "==", phone.installationId).get()).size, 0);
});
test("app sharing needs both sender auth and trip write auth; pushes, inbox, and help status stay connected", async () => {
  const sender = await enroll(), receiver = await enroll("android");
  await verify(sender, "walker@example.test"); await verify(receiver, "recipient@example.test");
  await call("/installations/me", "PATCH", { pushToken: "ExpoPushToken[synthetic-not-a-real-token]" }, receiver.authToken);
  const t = (await call("/trips", "POST", { routeGeometry: geometry, etaSeconds: 90, demo: true })).data;
  const sharePath = `/trips/${t.tripId}/share`, body = { installationIds: [receiver.installationId] };
  assert.equal((await call(sharePath, "POST", body, sender.authToken)).status, 401);
  assert.equal((await call(sharePath, "POST", body, sender.authToken, { "X-Trip-Token": "wrong" })).status, 404);
  assert.equal((await call(sharePath, "POST", { installationIds: Array(251).fill(receiver.installationId) },
    sender.authToken, { "X-Trip-Token": t.writeToken })).status, 400);
  const result = await call(sharePath, "POST", body, sender.authToken, { "X-Trip-Token": t.writeToken });
  assert.equal(result.status, 200); assert.equal(result.data.notificationsQueued, 1);
  const maxBatch = await call(sharePath, "POST", { installationIds: Array(250).fill(receiver.installationId) },
    sender.authToken, { "X-Trip-Token": t.writeToken });
  assert.equal(maxBatch.status, 200); assert.equal(maxBatch.data.sharedCount, 1);
  assert.equal((await call(sharePath, "POST", body, sender.authToken, { "X-Trip-Token": t.writeToken })).data.notificationsQueued, 0);
  assert.equal((await call("/inbox", "GET", undefined, receiver.authToken)).data.trips[0].shareCode, t.shareCode);
  await notifications.processNotifications(); assert.ok(queuedPushes > 0);
  assert.equal((await call(`/trips/${t.tripId}/end`, "POST", { status: "help" }, t.writeToken)).status, 200);
  assert.equal((await call("/inbox", "GET", undefined, receiver.authToken)).data.trips[0].status, "help");
  assert.equal((await call(`/track/${t.shareCode}`)).data.status, "help");
  assert.equal((await call(sharePath, "POST", body, sender.authToken, { "X-Trip-Token": t.writeToken })).status, 409);
  const jobs = await db.database.collection("notification_outbox").where("trip_id", "==", t.tripId).get();
  assert.ok(jobs.docs.some(row => row.data().event === "help"));
  await notifications.processNotifications();
  assert.ok(pushDeliveries.some(delivery => delivery.event === "help" && delivery.status === "help"));

  const arrivalTrip = (await call("/trips", "POST", { routeGeometry: geometry, etaSeconds: 90, demo: false, travelMode: "driving" })).data;
  assert.equal((await call(`/trips/${arrivalTrip.tripId}/share`, "POST", body, sender.authToken,
    { "X-Trip-Token": arrivalTrip.writeToken })).status, 200);
  assert.equal((await call(`/track/${arrivalTrip.shareCode}`)).data.travelMode, "driving");
  const inboxTrips = (await call("/inbox", "GET", undefined, receiver.authToken)).data.trips;
  assert.equal(inboxTrips.find((trip: { shareCode: string }) => trip.shareCode === arrivalTrip.shareCode)?.travelMode, "driving");
  await notifications.processNotifications();
  const beforeArrival = pushDeliveries.length;
  assert.equal((await call(`/trips/${arrivalTrip.tripId}/end`, "POST", { status: "arrived" }, arrivalTrip.writeToken)).status, 200);
  const arrivalJobs = await db.database.collection("notification_outbox").where("trip_id", "==", arrivalTrip.tripId).get();
  assert.ok(arrivalJobs.docs.some(row => row.data().event === "arrived"));
  await notifications.processNotifications();
  assert.deepEqual(pushDeliveries.slice(beforeArrival), [{ event: "arrived", status: "arrived" }]);
  const acceptedJobs = await db.database.collection("notification_outbox").where("trip_id", "==", arrivalTrip.tripId).get();
  assert.equal(acceptedJobs.docs.find(row => row.data().event === "arrived")?.data().state, "accepted");
  assert.equal((await call(`/trips/${arrivalTrip.tripId}/end`, "POST", { status: "arrived" }, arrivalTrip.writeToken)).status, 200);
  assert.equal(acceptedJobs.docs.filter(row => row.data().event === "arrived").length, 1);

  await call("/installations/me", "DELETE", undefined, receiver.authToken);
  assert.equal((await db.database.collection("trip_recipients").where("installation_id", "==", receiver.installationId).get()).size, 0);
});
test("delivery outages retry without claiming delivery, while link sharing still works", async () => {
  const sender = await enroll(), receiver = await enroll();
  await verify(sender, "offline-walker@example.test"); await verify(receiver, "offline-recipient@example.test");
  await call("/installations/me", "PATCH", { pushToken: "ExpoPushToken[synthetic-offline-token]" }, receiver.authToken);
  const t = (await call("/trips", "POST", { routeGeometry: geometry, etaSeconds: 90, demo: true })).data;
  await call(`/trips/${t.tripId}/share`, "POST", { installationIds: [receiver.installationId] }, sender.authToken, { "X-Trip-Token": t.writeToken });
  const transport = notifications.notificationTransport.expo;
  notifications.notificationTransport.expo = async () => { throw new Error("Simulated outage"); };
  await notifications.processNotifications(); notifications.notificationTransport.expo = transport;
  const row = (await db.database.collection("notification_outbox").where("trip_id", "==", t.tripId).limit(1).get()).docs[0].data() as { state: string; attempts: number };
  assert.equal(row.state, "pending"); assert.equal(row.attempts, 1);
  assert.equal((await call(`/track/${t.shareCode}`)).status, 200);
});
test("widget registration is private and expires with its trip; payload validation rejects invalid data", async () => {
  const s = await enroll();
  const t = (await call("/trips", "POST", { routeGeometry: geometry, etaSeconds: 90, demo: true })).data;
  const body = { activityId: "synthetic-activity", pushToken: "a".repeat(64) };
  assert.equal((await call(`/track/${t.shareCode}/widget`, "POST", body)).status, 401);
  assert.equal((await call(`/track/${t.shareCode}/widget`, "POST", body, s.authToken)).status, 200);
  assert.equal((await call(`/track/${t.shareCode}/widget`, "POST", { ...body, pushToken: "bad" }, s.authToken)).status, 400);
  const state = { shareCode: t.shareCode, status: "active", etaAt: t.etaAt, lastUpdateAt: null, expiresAt: t.expiresAt, demo: true };
  assert.equal(parseWidgetState(state)?.demo, true); assert.equal(parseWidgetState({ ...state, shareCode: "guess" }), null);
  await db.database.collection("trips").doc(t.tripId).update({ expires_at: Date.now() - 1 }); await db.purgeExpired();
  assert.equal((await db.database.collection("widget_subscriptions").where("activity_id", "==", body.activityId).get()).size, 0);
  assert.ok(sends > 0);
});
