import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Vercel serves the web export statically and reserves Express for API paths", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const service = config.services.app;
  assert.equal(service.framework, "vite");
  assert.equal(service.entrypoint, undefined);
  assert.equal(service.outputDirectory, "public");
  assert.equal(service.functions["api/[...path].ts"].maxDuration, 60);
  for (const pathname of ["/", "/contacts", "/track/:code"]) {
    assert.ok(service.rewrites.some((rule: { source: string; destination: string }) =>
      rule.source === pathname && rule.destination === "/index.html"));
  }
  assert.ok(!service.rewrites.some((rule: { source: string }) => rule.source.startsWith("/api")));
});

test("the deployed API function exports Express and preserves the /api request path", async () => {
  process.env.VERCEL = "1";
  process.env.CRON_SECRET = "test-only-vercel-routing-secret";
  const { default: handler } = await import("../../api/[...path].js");
  assert.equal(typeof handler, "function");
  const server = handler.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/maintenance/daily`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Daily cleanup is not authorized." });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
