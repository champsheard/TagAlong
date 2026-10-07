import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { database } from "./db";
import { HttpError } from "./errors";
import { canonicalIdentifier, normalizeIdentifier, type IdentifierKind, type InstallationProfile } from "../../shared/contacts";
import { verificationGateway } from "./verificationGateway";

export type Installation = { id: string; platform: "ios" | "android" | "web"; discoverable: number; push_token: string | null; push_start_token: string | null; token_hash: string; seen_at: number };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function keyed(value: string) {
  if (!process.env.SESSION_SECRET) throw new HttpError(503, "Contact matching needs the server's SESSION_SECRET.");
  return createHmac("sha256", process.env.SESSION_SECRET).update(`safe-walk-contact-v1:${value}`).digest("hex");
}
export const lookupDigest = (hash: string) => keyed(hash);
export function authenticateInstallation(token?: string): Installation {
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) throw new HttpError(401, "Verify your device again to use app contacts.");
  const installation = database.prepare("SELECT * FROM installations WHERE token_hash = ? AND seen_at > ?")
    .get(digest(token), Date.now() - 90 * 86400000) as Installation | undefined;
  if (!installation) throw new HttpError(401, "This device enrollment has expired. Remove it and verify again.");
  database.prepare("UPDATE installations SET seen_at = ? WHERE id = ?").run(Date.now(), installation.id);
  return installation;
}
export function installationProfile(installation: Installation): InstallationProfile {
  const rows = database.prepare("SELECT DISTINCT kind FROM contact_identifiers WHERE installation_id = ?").all(installation.id) as { kind: IdentifierKind }[];
  return { installationId: installation.id, platform: installation.platform,
    verifiedKinds: rows.map(r => r.kind), discoverable: !!installation.discoverable, notificationsEnabled: !!installation.push_token };
}
export function createInstallation(platform: unknown) {
  if (platform !== "ios" && platform !== "android" && platform !== "web") throw new HttpError(400, "Invalid mobile platform.");
  const installationId = randomUUID(), authToken = randomBytes(32).toString("base64url"), now = Date.now();
  database.prepare("INSERT INTO installations(id,token_hash,platform,created_at,seen_at) VALUES(?,?,?,?,?)")
    .run(installationId, digest(authToken), platform, now, now);
  return { installationId, authToken };
}
export async function beginVerification(installation: Installation, body: { kind?: IdentifierKind; identifier?: string; country?: string }) {
  if (body.kind !== "phone" && body.kind !== "email") throw new HttpError(400, "Choose phone or email verification.");
  const normalized = normalizeIdentifier(body.kind, body.identifier ?? "", body.country);
  if (!normalized) throw new HttpError(400, body.kind === "phone" ? "Enter a valid phone number with its country code." : "Enter a valid email address.");
  const recent = database.prepare("SELECT created_at FROM verification_challenges WHERE installation_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(installation.id) as { created_at: number } | undefined;
  if (recent && Date.now() - recent.created_at < 60000) throw new HttpError(429, "Wait one minute before requesting another code.");
  const challengeId = randomUUID(), code = String(randomInt(100000, 1000000));
  const identifierHash = lookupDigest(digest(canonicalIdentifier(body.kind, normalized)));
  const now = Date.now(), expiresAt = now + 600000;
  database.prepare("INSERT INTO verification_challenges(id,installation_id,identifier_hash,kind,code_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?)")
    .run(challengeId, installation.id, identifierHash, body.kind, keyed(`${challengeId}:${code}`), now, expiresAt);
  try { await verificationGateway.send(body.kind, normalized, code); }
  catch (e) {
    database.prepare("DELETE FROM verification_challenges WHERE id = ?").run(challengeId);
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, "The verification service is unavailable. Please try again later.");
  }
  // Neither the destination nor the code is persisted or returned.
  return { challengeId, expiresAt };
}
export function confirmVerification(installation: Installation, body: { challengeId?: string; code?: string }) {
  if (typeof body.challengeId !== "string" || !/^\d{6}$/.test(body.code ?? "")) throw new HttpError(400, "Enter the six-digit code.");
  const row = database.prepare("SELECT * FROM verification_challenges WHERE id = ? AND installation_id = ? AND expires_at > ?")
    .get(body.challengeId, installation.id, Date.now()) as { id: string; identifier_hash: string; kind: IdentifierKind; code_hash: string; attempts: number } | undefined;
  if (!row || row.attempts >= 5) throw new HttpError(400, "This code expired or has too many attempts. Request a new one.");
  database.prepare("UPDATE verification_challenges SET attempts = attempts + 1 WHERE id = ?").run(row.id);
  if (!timingSafeEqual(Buffer.from(row.code_hash, "hex"), Buffer.from(keyed(`${row.id}:${body.code}`), "hex"))) throw new HttpError(400, "Incorrect verification code.");
  database.transaction(() => {
    database.prepare("INSERT OR IGNORE INTO contact_identifiers(installation_id,identifier_hash,kind) VALUES(?,?,?)")
      .run(installation.id, row.identifier_hash, row.kind);
    database.prepare("UPDATE installations SET discoverable = 1 WHERE id = ?").run(installation.id);
    database.prepare("DELETE FROM verification_challenges WHERE installation_id = ? AND kind = ?").run(installation.id, row.kind);
  })();
  return installationProfile({ ...installation, discoverable: 1 });
}
export function discoverContacts(installation: Installation, body: { hashes?: string[] }) {
  if (!installationProfile(installation).verifiedKinds.length) throw new HttpError(403, "Verify your own phone or email before finding app contacts.");
  if (!Array.isArray(body.hashes) || body.hashes.length > 250 || body.hashes.some(h => typeof h !== "string" || !/^[a-f0-9]{64}$/.test(h))) {
    throw new HttpError(400, "Send at most 250 hashed contact identifiers, not contact names or raw addresses.");
  }
  const query = database.prepare(`SELECT i.id, i.push_token FROM contact_identifiers c JOIN installations i ON i.id = c.installation_id
    WHERE c.identifier_hash = ? AND i.discoverable = 1 AND i.platform IN ('ios','android') AND i.seen_at > ? AND i.id != ?`);
  return { matches: [...new Set(body.hashes)].flatMap(hash =>
    (query.all(lookupDigest(hash), Date.now() - 30 * 86400000, installation.id) as { id: string; push_token: string | null }[])
      .map(i => ({ hash, installationId: i.id, notificationsEnabled: !!i.push_token }))) };
}
export function updateInstallation(installation: Installation, body: { pushToken?: string | null; discoverable?: boolean; pushStartToken?: string | null }) {
  if (body.pushToken !== undefined && body.pushToken !== null && !/^(ExponentPushToken|ExpoPushToken)\[[\w-]{10,200}\]$/.test(body.pushToken)) throw new HttpError(400, "Invalid notification token.");
  if (body.pushStartToken !== undefined && body.pushStartToken !== null && !/^[a-f0-9]{32,512}$/i.test(body.pushStartToken)) throw new HttpError(400, "Invalid Live Activity token.");
  if (body.discoverable !== undefined && typeof body.discoverable !== "boolean") throw new HttpError(400, "Invalid contact discovery setting.");
  const next = { ...installation,
    push_token: body.pushToken === undefined ? installation.push_token : body.pushToken,
    push_start_token: body.pushStartToken === undefined ? installation.push_start_token : body.pushStartToken,
    discoverable: body.discoverable === undefined ? installation.discoverable : Number(body.discoverable) };
  database.prepare("UPDATE installations SET push_token = ?, push_start_token = ?, discoverable = ? WHERE id = ?")
    .run(next.push_token, next.push_start_token, next.discoverable, installation.id);
  return installationProfile(next);
}
export function removeInstallation(installation: Installation) {
  database.prepare("DELETE FROM installations WHERE id = ?").run(installation.id);
  return { ok: true };
}
