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
`);

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
}
