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

async function deleteExpired(query: Query<DocumentData>) {
  let deleted = 0;
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return deleted;
    const batch = database.batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();
    deleted += snapshot.size;
  }
}

export async function purgeExpired(now = Date.now()) {
  const tasks = [
    deleteExpired(database.collection("trips").where("expires_at", "<=", now)),
    deleteExpired(database.collection("cache").where("expires_at", "<=", now)),
    deleteExpired(database.collection("verification_challenges").where("expires_at", "<=", now)),
    deleteExpired(database.collection("installations").where("seen_at", "<", now - 90 * 86400000)),
    deleteExpired(database.collection("notification_outbox").where("created_at", "<", now - 86400000)),
    deleteExpired(database.collection("arrival_feedback").where("expires_at", "<=", now)),
  ];
  const counts = await Promise.all(tasks);
  return counts.reduce((sum, count) => sum + count, 0);
}
