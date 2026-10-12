import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const databasePath =
  process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "data/safe-walk.sqlite");

mkdirSync(path.dirname(databasePath), { recursive: true });

export const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");

database.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    share_code TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    route TEXT NOT NULL,
    travel_mode TEXT NOT NULL DEFAULT 'walking' CHECK (travel_mode IN ('walking','driving')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','arrived','help')),
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    eta_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_location TEXT,
    last_update_at INTEGER,
    demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS trips_expiry ON trips(expires_at);
  CREATE TABLE IF NOT EXISTS installations (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('ios','android','web')),
    discoverable INTEGER NOT NULL DEFAULT 0, push_token TEXT, push_start_token TEXT,
    auto_share INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, seen_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS contact_identifiers (
    installation_id TEXT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
    identifier_hash TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('phone','email')),
    PRIMARY KEY(installation_id,identifier_hash)
  );
  CREATE INDEX IF NOT EXISTS contact_lookup ON contact_identifiers(identifier_hash);
  CREATE TABLE IF NOT EXISTS verification_challenges (
    id TEXT PRIMARY KEY, installation_id TEXT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
    identifier_hash TEXT NOT NULL, kind TEXT NOT NULL, code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trip_recipients (
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    installation_id TEXT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
    sender_id TEXT REFERENCES installations(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(trip_id,installation_id)
  );
  CREATE TABLE IF NOT EXISTS widget_subscriptions (
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    installation_id TEXT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL, push_token TEXT NOT NULL,
    last_sent_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(installation_id,activity_id)
  );
  CREATE TABLE IF NOT EXISTS notification_outbox (
    id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    installation_id TEXT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
    event TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS notification_pending ON notification_outbox(state,next_attempt_at);
  CREATE TABLE IF NOT EXISTS arrival_feedback (
    id TEXT PRIMARY KEY,
    route_rating INTEGER NOT NULL CHECK(route_rating BETWEEN 1 AND 5),
    reports TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS arrival_feedback_expiry ON arrival_feedback(expires_at);
`);

const installationColumns = database.pragma("table_info(installations)") as { name: string }[];
if (!installationColumns.some(column => column.name === "auto_share")) {
  database.exec("ALTER TABLE installations ADD COLUMN auto_share INTEGER NOT NULL DEFAULT 1");
}
export function migrateTripTravelMode(db: Database.Database) {
  const tripColumns = db.pragma("table_info(trips)") as { name: string }[];
  if (!tripColumns.some(column => column.name === "travel_mode")) {
    db.exec("ALTER TABLE trips ADD COLUMN travel_mode TEXT NOT NULL DEFAULT 'walking' CHECK (travel_mode IN ('walking','driving'))");
  }
}
migrateTripTravelMode(database);

export function cached<T>(key: string): T | null {
  const row = database.prepare("SELECT value FROM cache WHERE key = ? AND expires_at > ?")
    .get(key, Date.now()) as { value: string } | undefined;
  return row ? JSON.parse(row.value) as T : null;
}
export function cacheValue(key: string, value: unknown, ttlMs: number) {
  database.prepare("INSERT OR REPLACE INTO cache(key,value,expires_at) VALUES(?,?,?)")
    .run(key, JSON.stringify(value), Date.now() + ttlMs);
}
export function purgeExpired(now = Date.now()) {
  database.prepare("DELETE FROM trips WHERE expires_at <= ?").run(now);
  database.prepare("DELETE FROM cache WHERE expires_at <= ?").run(now);
  database.prepare("DELETE FROM verification_challenges WHERE expires_at <= ?").run(now);
  database.prepare("DELETE FROM installations WHERE seen_at < ?").run(now - 90 * 86400000);
  database.prepare("DELETE FROM notification_outbox WHERE created_at < ?").run(now - 86400000);
  database.prepare("DELETE FROM arrival_feedback WHERE expires_at <= ?").run(now);
}
