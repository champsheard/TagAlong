import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { database, documentId } from "../server/src/firestore";

type Row = Record<string, unknown> & { id?: string; expires_at?: number; seen_at?: number; created_at?: number };
type ImportDocument = { collection: string; id: string; data: Row };

const sourcePath = path.resolve(process.env.DATABASE_PATH ?? "data/safe-walk.sqlite");
const apply = process.argv.includes("--apply");
const now = Date.now();

function rows(db: Database.Database, table: string): Row[] {
  return db.prepare(`SELECT * FROM "${table}"`).all() as Row[];
}

async function main() {
  if (!fs.existsSync(sourcePath)) throw new Error("SQLite source database was not found.");
  const sqlite = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    const validInstallations = rows(sqlite, "installations").filter(row => Number(row.seen_at) > now - 90 * 86400000);
    const installationIds = new Set(validInstallations.map(row => String(row.id)));
    const validTrips = rows(sqlite, "trips").filter(row => Number(row.expires_at) > now);
    const tripIds = new Set(validTrips.map(row => String(row.id)));

    const documents: ImportDocument[] = [
      ...rows(sqlite, "cache").filter(row => Number(row.expires_at) > now)
        .map(data => ({ collection: "cache", id: documentId(String(data.key)), data })),
      ...validTrips.map(data => ({ collection: "trips", id: String(data.id), data })),
      ...validInstallations.map(data => ({ collection: "installations", id: String(data.id), data })),
      ...rows(sqlite, "contact_identifiers").filter(row => installationIds.has(String(row.installation_id)))
        .map(data => ({ collection: "contact_identifiers", id: documentId(String(data.installation_id), String(data.identifier_hash)), data })),
      ...rows(sqlite, "verification_challenges").filter(row =>
        Number(row.expires_at) > now && installationIds.has(String(row.installation_id)))
        .map(data => ({ collection: "verification_challenges", id: String(data.id), data })),
      ...rows(sqlite, "trip_recipients").filter(row =>
        tripIds.has(String(row.trip_id)) && installationIds.has(String(row.installation_id)))
        .map(data => ({ collection: "trip_recipients", id: documentId(String(data.trip_id), String(data.installation_id)), data })),
      ...rows(sqlite, "widget_subscriptions").filter(row =>
        tripIds.has(String(row.trip_id)) && installationIds.has(String(row.installation_id)))
        .map(data => ({ collection: "widget_subscriptions", id: documentId(String(data.trip_id), String(data.installation_id), String(data.activity_id)), data })),
      ...rows(sqlite, "notification_outbox").filter(row =>
        Number(row.created_at) > now - 86400000 && tripIds.has(String(row.trip_id)) &&
        installationIds.has(String(row.installation_id)))
        .map(data => ({ collection: "notification_outbox", id: String(data.id), data })),
      ...rows(sqlite, "arrival_feedback").filter(row => Number(row.expires_at) > now)
        .map(data => ({ collection: "arrival_feedback", id: String(data.id), data })),
    ];

    const counts = documents.reduce<Record<string, number>>((result, item) => {
      result[item.collection] = (result[item.collection] ?? 0) + 1;
      return result;
    }, {});
    if (!apply) {
      console.log(JSON.stringify({ mode: "dry-run", candidateDocumentCounts: counts, total: documents.length }));
      return;
    }

    let imported = 0, alreadyPresent = 0;
    for (let offset = 0; offset < documents.length; offset += 400) {
      const chunk = documents.slice(offset, offset + 400);
      const refs = chunk.map(item => database.collection(item.collection).doc(item.id));
      const existing = await Promise.all(refs.map(reference => reference.get()));
      const batch = database.batch();
      let writes = 0;
      for (let index = 0; index < chunk.length; index++) {
        if (existing[index].exists) { alreadyPresent++; continue; }
        batch.create(refs[index], chunk[index].data);
        writes++;
      }
      if (writes) {
        await batch.commit();
        imported += writes;
      }
    }
    console.log(JSON.stringify({ mode: "applied", imported, alreadyPresent, sourceUnchanged: true }));
  } finally {
    sqlite.close();
  }
}

void main().catch(error => {
  console.error(JSON.stringify({ migrationFailed: true, errorCode: error?.code ?? error?.name ?? "unknown" }));
  process.exitCode = 1;
});
