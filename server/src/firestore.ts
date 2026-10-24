import { createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentData, type Firestore, type Query } from "firebase-admin/firestore";

const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!credentialJson) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required to use Firestore.");
}

let credential: Record<string, unknown>;
try {
  credential = JSON.parse(credentialJson) as Record<string, unknown>;
} catch {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.");
}
if (typeof credential.project_id !== "string" || typeof credential.private_key !== "string" || typeof credential.client_email !== "string") {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields.");
}

const app = getApps().find(existing => existing.name === "tagalong") ??
  initializeApp({ credential: cert(credential as Parameters<typeof cert>[0]), projectId: credential.project_id }, "tagalong");

const rawDatabase = getFirestore(app);
const collectionPrefix = process.env.FIRESTORE_COLLECTION_PREFIX ?? "";
export const database = new Proxy(rawDatabase as Firestore, {
  get(target, property) {
    if (property === "collection") {
      return (name: string) => target.collection(`${collectionPrefix}${name}`);
    }
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
database.settings({ ignoreUndefinedProperties: true });
export { FieldValue };

export async function clearPrefixedCollections() {
  if (!collectionPrefix) return;
  const collections = await rawDatabase.listCollections();
  for (const collection of collections.filter(item => item.id.startsWith(collectionPrefix))) {
    while (true) {
      const snapshot = await collection.limit(400).get();
      if (snapshot.empty) break;
      const batch = rawDatabase.batch();
      for (const document of snapshot.docs) batch.delete(document.ref);
      await batch.commit();
    }
  }
}

export function documentId(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

export async function cached<T>(key: string): Promise<T | null> {
  const snapshot = await database.collection("cache").doc(documentId(key)).get();
  if (!snapshot.exists) return null;
  const row = snapshot.data()!;
  if (typeof row.expires_at !== "number" || row.expires_at <= Date.now()) {
    await snapshot.ref.delete();
    return null;
  }
  return row.value as T;
}

export async function cacheValue(key: string, value: unknown, ttlMs: number) {
  await database.collection("cache").doc(documentId(key)).set({
    key,
    value,
    expires_at: Date.now() + ttlMs,
  });
}

async function deleteExpired(query: Query<DocumentData>, maxDocuments = Number.POSITIVE_INFINITY) {
  let deleted = 0;
  while (deleted < maxDocuments) {
    const limit = Math.min(400, maxDocuments - deleted);
    const snapshot = await query.limit(limit).get();
    if (snapshot.empty) return deleted;
    const batch = database.batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < limit) return deleted;
  }
  return deleted;
}

async function deleteExpiredTrips(now: number, maxTrips = Number.POSITIVE_INFINITY) {
  let deleted = 0;
  while (deleted < maxTrips) {
    const limit = Math.min(100, maxTrips - deleted);
    const expired = await database.collection("trips").where("expires_at", "<=", now).limit(limit).get();
    if (expired.empty) return deleted;
    for (const trip of expired.docs) {
      for (const collectionName of ["trip_recipients", "widget_subscriptions", "notification_outbox"]) {
        const children = await database.collection(collectionName).where("trip_id", "==", trip.id).get();
        for (let i = 0; i < children.docs.length; i += 400) {
          const batch = database.batch();
          for (const child of children.docs.slice(i, i + 400)) batch.delete(child.ref);
          await batch.commit();
        }
      }
    }
    const batch = database.batch();
    for (const trip of expired.docs) batch.delete(trip.ref);
    await batch.commit();
    deleted += expired.size;
    if (expired.size < limit) return deleted;
  }
  return deleted;
}

async function deleteExpiredInstallations(now: number, maxInstallations = Number.POSITIVE_INFINITY) {
  let deleted = 0;
  while (deleted < maxInstallations) {
    const limit = Math.min(100, maxInstallations - deleted);
    const expired = await database.collection("installations").where("seen_at", "<", now - 90 * 86400000).limit(limit).get();
    if (expired.empty) return deleted;
    for (const installation of expired.docs) {
      for (const collectionName of ["contact_identifiers", "trip_recipients", "widget_subscriptions", "notification_outbox"]) {
        const children = await database.collection(collectionName).where("installation_id", "==", installation.id).get();
        for (let i = 0; i < children.docs.length; i += 400) {
          const batch = database.batch();
          for (const child of children.docs.slice(i, i + 400)) batch.delete(child.ref);
          await batch.commit();
        }
      }
      const shares = await database.collection("trip_recipients").where("sender_id", "==", installation.id).get();
      for (let i = 0; i < shares.docs.length; i += 400) {
        const batch = database.batch();
        for (const share of shares.docs.slice(i, i + 400)) batch.update(share.ref, { sender_id: null });
        await batch.commit();
      }
    }
    const batch = database.batch();
    for (const installation of expired.docs) batch.delete(installation.ref);
    await batch.commit();
    deleted += expired.size;
    if (expired.size < limit) return deleted;
  }
  return deleted;
}

export type PurgeLimits = {
  maxDocumentsPerCollection?: number;
  maxTrips?: number;
  maxInstallations?: number;
};

export async function purgeExpired(now = Date.now(), limits: PurgeLimits = {}) {
  const maxDocuments = limits.maxDocumentsPerCollection ?? Number.POSITIVE_INFINITY;
  const tasks = [
    deleteExpiredTrips(now, limits.maxTrips),
    deleteExpired(database.collection("cache").where("expires_at", "<=", now), maxDocuments),
    deleteExpired(database.collection("verification_challenges").where("expires_at", "<=", now), maxDocuments),
    deleteExpiredInstallations(now, limits.maxInstallations),
    deleteExpired(database.collection("notification_outbox").where("created_at", "<", now - 86400000), maxDocuments),
    deleteExpired(database.collection("arrival_feedback").where("expires_at", "<=", now), maxDocuments),
    deleteExpired(database.collection("rate_limits").where("expires_at", "<=", now), maxDocuments),
  ];
  const counts = await Promise.all(tasks);
  return counts.reduce((sum, count) => sum + count, 0);
}
