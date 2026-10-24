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
  assert.equal(service.functions, undefined);
  const api = config.services.api;
  assert.equal(api.framework, "express");
  assert.equal(api.entrypoint, "server.ts");
  assert.equal(api.functions["server.ts"].maxDuration, 60);
  for (const pathname of ["/", "/contacts", "/track/:code"]) {
    assert.ok(service.rewrites.some((rule: { source: string; destination: string }) =>
      rule.source === pathname && rule.destination === "/index.html"));
  }
  assert.ok(!service.rewrites.some((rule: { source: string }) => rule.source.startsWith("/api")));
  const publicService = (pathname: string) => config.rewrites.find(
    (rule: { source: string }) => new RegExp(`^${rule.source}$`).test(pathname),
  )?.destination.service;
  for (const pathname of ["/api", "/api/config", "/api/routes", "/api/health", "/api/maintenance/daily"]) {
    assert.equal(publicService(pathname), "api", `${pathname} must reach the API service`);
  }
  for (const pathname of ["/", "/contacts", "/track/example", "/apiary", "/_expo/static/js/web/index.js"]) {
    assert.equal(publicService(pathname), "app", `${pathname} must reach the static app`);
  }
  assert.ok(!config.rewrites.some(
    (rule: { destination: { service: string } }) => rule.destination.service === "mockup-sandbox",
  ));
});

test("the deployed API function exports Express and preserves the /api request path", async () => {
  process.env.VERCEL = "1";
  process.env.CRON_SECRET = "test-only-vercel-routing-secret";
  const { default: handler } = await import("../../server.js");
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
