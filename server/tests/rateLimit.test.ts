import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";

process.env.FIRESTORE_COLLECTION_PREFIX = `test_rate_limit_${process.pid}_`;
process.env.SESSION_SECRET = "test-only-rate-limit-secret";

let server: Server;
let origin: string;
let db: typeof import("../src/firestore");
let listening: Promise<void>;
before(async () => {
  const [{ rateLimit }, firestore] = await Promise.all([
    import("../src/rateLimit"),
    import("../src/firestore"),
  ]);
  db = firestore;
  const app = express();
  app.get("/limited", rateLimit(1, 60000, "concurrent-test"), (_request, response) => {
    response.json({ ok: true });
  });
  listening = new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", () => {
      origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
  await listening;
});

after(async () => {
  if (!server || !db) return;
  await listening;
  await new Promise<void>(resolve => server.close(() => resolve()));
  await db.clearPrefixedCollections();
});

test("rate limiting is shared across concurrent serverless-style requests", async () => {
  await listening;
  const results = await Promise.all([
    fetch(`${origin}/limited`),
    fetch(`${origin}/limited`),
  ]);
  assert.deepEqual(results.map(response => response.status).sort(), [200, 429]);
  assert.ok(results.some(response => response.headers.get("retry-after")));
  const rows = await db.database.collection("rate_limits").get();
  assert.equal(rows.size, 1);
  assert.equal(rows.docs[0].data().count, 1);
  assert.ok(!rows.docs[0].id.includes("127.0.0.1"));
});
