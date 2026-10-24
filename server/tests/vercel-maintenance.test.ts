import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

process.env.FIRESTORE_COLLECTION_PREFIX = `test_vercel_maintenance_${process.pid}_`;
process.env.SESSION_SECRET = "test-only-vercel-maintenance-secret";
process.env.CRON_SECRET = "test-only-cron-secret";
process.env.VERCEL = "1";

let server: Server;
let origin = "";
let database: typeof import("../src/firestore");

before(async () => {
  const [{ app }, firestore] = await Promise.all([
    import("../src/app"),
    import("../src/firestore"),
  ]);
  database = firestore;
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", () => {
      origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
});

after(async () => {
  if (!server || !database) return;
  await new Promise<void>(resolve => server.close(() => resolve()));
  await database.clearPrefixedCollections();
});

test("the daily cleanup endpoint rejects callers without the Vercel cron bearer token", async () => {
  const unauthorized = await fetch(`${origin}/api/maintenance/daily`);
  assert.equal(unauthorized.status, 401);
  const authorized = await fetch(`${origin}/api/maintenance/daily`, {
    headers: { Authorization: "Bearer test-only-cron-secret" },
  });
  assert.equal(authorized.status, 200);
  const result = await authorized.json() as { ok: boolean; deleted: number };
  assert.equal(result.ok, true);
  assert.equal(typeof result.deleted, "number");
});
