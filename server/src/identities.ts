import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { database, documentId } from "./firestore";
import { HttpError } from "./errors";
import { canonicalIdentifier, normalizeIdentifier, type IdentifierKind, type InstallationProfile } from "../../shared/contacts";
import { verificationGateway } from "./verificationGateway";

export type Installation = { id: string; platform: "ios" | "android" | "web"; discoverable: number; auto_share: number; push_token: string | null; push_start_token: string | null; token_hash: string; seen_at: number };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function keyed(value: string) {
  if (!process.env.SESSION_SECRET) throw new HttpError(503, "Contact matching needs the server's SESSION_SECRET.");
  return createHmac("sha256", process.env.SESSION_SECRET).update(`safe-walk-contact-v1:${value}`).digest("hex");
}
export const lookupDigest = (hash: string) => keyed(hash);
export async function authenticateInstallation(token?: string): Promise<Installation> {
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) throw new HttpError(401, "Verify your device again to use app contacts.");
  const matches = await database.collection("installations").where("token_hash", "==", digest(token)).limit(1).get();
  const installation = matches.empty ? undefined : matches.docs[0].data() as Installation;
  if (!installation) throw new HttpError(401, "This device enrollment has expired. Remove it and verify again.");
  if (installation.seen_at <= Date.now() - 90 * 86400000) throw new HttpError(401, "This device enrollment has expired. Remove it and verify again.");
  await database.collection("installations").doc(installation.id).update({ seen_at: Date.now() });
  return installation;
}
export async function installationProfile(installation: Installation): Promise<InstallationProfile> {
  const rows = await database.collection("contact_identifiers").where("installation_id", "==", installation.id).get();
  return { installationId: installation.id, platform: installation.platform,
    verifiedKinds: [...new Set(rows.docs.map(row => row.data().kind as IdentifierKind))], discoverable: !!installation.discoverable,
    notificationsEnabled: !!installation.push_token, autoShare: !!installation.auto_share };
}
export async function createInstallation(platform: unknown) {
  if (platform !== "ios" && platform !== "android" && platform !== "web") throw new HttpError(400, "Invalid mobile platform.");
  const installationId = randomUUID(), authToken = randomBytes(32).toString("base64url"), now = Date.now();
  await database.collection("installations").doc(installationId).create({
    id: installationId, token_hash: digest(authToken), platform, discoverable: 0, push_token: null,
    push_start_token: null, auto_share: 1, created_at: now, seen_at: now,
  });
  return { installationId, authToken };
}
export async function beginVerification(installation: Installation, body: { kind?: IdentifierKind; identifier?: string; country?: string }) {
  if (body.kind !== "phone" && body.kind !== "email") throw new HttpError(400, "Choose phone or email verification.");
  const normalized = normalizeIdentifier(body.kind, body.identifier ?? "", body.country);
  if (!normalized) throw new HttpError(400, body.kind === "phone" ? "Enter a valid phone number with its country code." : "Enter a valid email address.");
  const recentSnapshot = await database.collection("verification_challenges").where("installation_id", "==", installation.id).get();
  const recent = recentSnapshot.docs.map(row => row.data() as { created_at: number })
    .sort((a, b) => b.created_at - a.created_at)[0];
  if (recent && Date.now() - recent.created_at < 60000) throw new HttpError(429, "Wait one minute before requesting another code.");
  const challengeId = randomUUID(), code = String(randomInt(100000, 1000000));
  const identifierHash = lookupDigest(digest(canonicalIdentifier(body.kind, normalized)));
  const now = Date.now(), expiresAt = now + 600000;
  await database.collection("verification_challenges").doc(challengeId).create({
    id: challengeId, installation_id: installation.id, identifier_hash: identifierHash, kind: body.kind,
    code_hash: keyed(`${challengeId}:${code}`), attempts: 0, created_at: now, expires_at: expiresAt,
  });
  try { await verificationGateway.send(body.kind, normalized, code); }
  catch (e) {
    await database.collection("verification_challenges").doc(challengeId).delete();
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, "The verification service is unavailable. Please try again later.");
  }
  // Neither the destination nor the code is persisted or returned.
  return { challengeId, expiresAt };
}
export async function confirmVerification(installation: Installation, body: { challengeId?: string; code?: string }) {
  if (typeof body.challengeId !== "string" || !/^\d{6}$/.test(body.code ?? "")) throw new HttpError(400, "Enter the six-digit code.");
  const reference = database.collection("verification_challenges").doc(body.challengeId);
  const row = await database.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    const value = snapshot.data() as { id: string; installation_id: string; identifier_hash: string; kind: IdentifierKind; code_hash: string; attempts: number; expires_at: number } | undefined;
    if (!value || value.installation_id !== installation.id || value.expires_at <= Date.now() || value.attempts >= 5) return undefined;
    transaction.update(reference, { attempts: value.attempts + 1 });
    return value;
  });
  if (!row || row.attempts >= 5) throw new HttpError(400, "This code expired or has too many attempts. Request a new one.");
  if (!timingSafeEqual(Buffer.from(row.code_hash, "hex"), Buffer.from(keyed(`${row.id}:${body.code}`), "hex"))) throw new HttpError(400, "Incorrect verification code.");
  await database.runTransaction(async transaction => {
    const contactId = documentId(installation.id, row.identifier_hash);
    transaction.set(database.collection("contact_identifiers").doc(contactId), {
      installation_id: installation.id, identifier_hash: row.identifier_hash, kind: row.kind,
    }, { merge: true });
    transaction.update(database.collection("installations").doc(installation.id), { discoverable: 1 });
    transaction.delete(reference);
  });
  const profile = await database.collection("verification_challenges").where("installation_id", "==", installation.id).get();
  const batch = database.batch();
  for (const challenge of profile.docs) if (challenge.data().kind === row.kind) batch.delete(challenge.ref);
  if (!profile.empty) await batch.commit();
  return installationProfile({ ...installation, discoverable: 1 });
}
export async function discoverContacts(installation: Installation, body: { hashes?: string[] }) {
  if (!(await installationProfile(installation)).verifiedKinds.length) throw new HttpError(403, "Verify your own phone or email before finding app contacts.");
  if (!Array.isArray(body.hashes) || body.hashes.length > 250 || body.hashes.some(h => typeof h !== "string" || !/^[a-f0-9]{64}$/.test(h))) {
    throw new HttpError(400, "Send at most 250 hashed contact identifiers, not contact names or raw addresses.");
  }
  const matches: { hash: string; installationId: string; notificationsEnabled: boolean }[] = [];
  for (const hash of [...new Set(body.hashes)]) {
    const rows = await database.collection("contact_identifiers").where("identifier_hash", "==", lookupDigest(hash)).limit(50).get();
    for (const row of rows.docs) {
      const candidateId = row.data().installation_id as string;
      if (candidateId === installation.id) continue;
      const candidate = await database.collection("installations").doc(candidateId).get();
      const value = candidate.data() as Installation | undefined;
      if (!value || !value.discoverable || !["ios", "android"].includes(value.platform) ||
          value.seen_at <= Date.now() - 30 * 86400000) continue;
      matches.push({ hash, installationId: value.id, notificationsEnabled: !!value.push_token });
    }
  }
  return { matches };
}
export async function updateInstallation(installation: Installation, body: { pushToken?: string | null; discoverable?: boolean; pushStartToken?: string | null; autoShare?: boolean }) {
  if (body.pushToken !== undefined && body.pushToken !== null && !/^(ExponentPushToken|ExpoPushToken)\[[\w-]{10,200}\]$/.test(body.pushToken)) throw new HttpError(400, "Invalid notification token.");
  if (body.pushStartToken !== undefined && body.pushStartToken !== null && !/^[a-f0-9]{32,512}$/i.test(body.pushStartToken)) throw new HttpError(400, "Invalid Live Activity token.");
  if (body.discoverable !== undefined && typeof body.discoverable !== "boolean") throw new HttpError(400, "Invalid contact discovery setting.");
  if (body.autoShare !== undefined && typeof body.autoShare !== "boolean") throw new HttpError(400, "Invalid automatic sharing setting.");
  const next = { ...installation,
    push_token: body.pushToken === undefined ? installation.push_token : body.pushToken,
    push_start_token: body.pushStartToken === undefined ? installation.push_start_token : body.pushStartToken,
    discoverable: body.discoverable === undefined ? installation.discoverable : Number(body.discoverable),
    auto_share: body.autoShare === undefined ? installation.auto_share : Number(body.autoShare) };
  await database.collection("installations").doc(installation.id).update({
    push_token: next.push_token, push_start_token: next.push_start_token,
    discoverable: next.discoverable, auto_share: next.auto_share,
  });
  return installationProfile(next);
}
export async function removeInstallation(installation: Installation) {
  const relatedCollections = ["contact_identifiers", "trip_recipients", "widget_subscriptions", "notification_outbox"];
  for (const name of relatedCollections) {
    const rows = await database.collection(name).where("installation_id", "==", installation.id).get();
    for (let i = 0; i < rows.docs.length; i += 400) {
      const batch = database.batch();
      for (const row of rows.docs.slice(i, i + 400)) batch.delete(row.ref);
      await batch.commit();
    }
  }
  const sentShares = await database.collection("trip_recipients").where("sender_id", "==", installation.id).get();
  for (let i = 0; i < sentShares.docs.length; i += 400) {
    const batch = database.batch();
    for (const row of sentShares.docs.slice(i, i + 400)) batch.update(row.ref, { sender_id: null });
    await batch.commit();
  }
  await database.collection("installations").doc(installation.id).delete();
  return { ok: true };
}
