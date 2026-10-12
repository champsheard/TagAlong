import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { Server } from "node:http";
import type { Geometry, TripCredentials } from "../../shared/types";

// A separate in-memory database: never alter the development walker's trips.
process.env.DATABASE_PATH = ":memory:";
let origin: string, server: Server;
let db: typeof import("../src/db");
let lighting: typeof import("../src/lighting");
const realFetch = globalThis.fetch;
const geometry: Geometry = { type: "LineString", coordinates: [[0, 0], [0.001, 0]] };
before(async () => {
  const { app } = await import("../src/app");
  db = await import("../src/db");
  lighting = await import("../src/lighting");
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => { globalThis.fetch = realFetch; server.close(); db.database.close(); });
async function call(path: string, body?: unknown, token?: string) {
  const response = await realFetch(origin + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function trip() {
  const r = await call("/trips", { routeGeometry: geometry, etaSeconds: 90, demo: true });
  assert.equal(r.status, 201); return r.data as TripCredentials;
}
test("health, config, and explicitly simulated demo routes", async () => {
  assert.equal((await call("/health")).data.status, "ok");
  const demo = await call("/demo");
  assert.equal(demo.data.demo, true);
  assert.deepEqual(demo.data.routes.map((r: { label: string }) => r.label), ["Fastest", "Best lit"]);
  assert.ok(demo.data.routes.every((r: { lightBreakdown: { simulated: boolean } }) => r.lightBreakdown.simulated));
});
test("private trip credentials and active location sharing", async () => {
  const t = await trip();
  assert.match(t.shareCode, /^[a-zA-Z0-9_-]{22,}$/);
  const stored = db.database.prepare("SELECT token_hash FROM trips WHERE id = ?").get(t.tripId) as { token_hash: string };
  assert.notEqual(stored.token_hash, t.writeToken);
  assert.equal((await call(`/trips/${t.tripId}/location`, { lat: 0, lng: 0, accuracy: 5, timestamp: Date.now() })).status, 401);
  assert.equal((await call(`/trips/${t.tripId}/location`, { lat: 0, lng: 0, accuracy: 5, timestamp: Date.now() }, "wrong-token")).status, 404);
  const position = { lat: 0, lng: 0.0005, accuracy: 5, timestamp: Date.now() };
  assert.equal((await call(`/trips/${t.tripId}/location`, position, t.writeToken)).status, 200);
  const read = await call(`/track/${t.shareCode}`);
  assert.equal(read.data.status, "active");
  assert.equal(read.data.lastLocation.lng, position.lng);
  assert.ok(read.data.lastUpdateAt);
  assert.equal(read.headers.get("cache-control"), "no-store");
  assert.equal("writeToken" in read.data, false);
  assert.equal("token_hash" in read.data, false);
});
test("driving trips preserve their mode and enforce route distance and ETA limits", async () => {
  const longWalkingRoute: Geometry = { type: "LineString", coordinates: [[0, 0], [0.5, 0]] };
  assert.equal((await call("/trips", { routeGeometry: longWalkingRoute, etaSeconds: 3600, travelMode: "walking" })).status, 400);
  const drive = await call("/trips", { routeGeometry: longWalkingRoute, etaSeconds: 3600, travelMode: "driving" });
  assert.equal(drive.status, 201);
  assert.equal(drive.data.travelMode, "driving");
  assert.equal((await call(`/track/${drive.data.shareCode}`)).data.travelMode, "driving");
  assert.equal((await call("/trips", { routeGeometry: { type: "LineString", coordinates: [[0, 0], [3, 0]] }, etaSeconds: 3600, travelMode: "driving" })).status, 400);
  assert.equal((await call("/trips", { routeGeometry: longWalkingRoute, etaSeconds: 5 * 3600 + 1, travelMode: "driving" })).status, 400);
});
test("legacy trip rows migrate to walking without losing existing records", () => {
  const legacy = new Database(":memory:");
  try {
    legacy.exec("CREATE TABLE trips (id TEXT PRIMARY KEY, status TEXT NOT NULL)");
    legacy.prepare("INSERT INTO trips(id,status) VALUES(?,?)").run("legacy-trip", "active");
    db.migrateTripTravelMode(legacy);
    assert.deepEqual(legacy.prepare("SELECT id,status,travel_mode FROM trips").get(), {
      id: "legacy-trip", status: "active", travel_mode: "walking",
    });
    assert.throws(() => legacy.prepare("UPDATE trips SET travel_mode = ? WHERE id = ?").run("flying", "legacy-trip"));
  } finally { legacy.close(); }
});
test("arrival stops writes, is idempotent, and retains link for four hours", async () => {
  const t = await trip();
  assert.equal((await call(`/trips/${t.tripId}/end`, { status: "arrived" }, t.writeToken)).status, 200);
  assert.equal((await call(`/trips/${t.tripId}/end`, { status: "arrived" }, t.writeToken)).status, 200);
  assert.equal((await call(`/trips/${t.tripId}/location`, { lat: 0, lng: 0, accuracy: 5, timestamp: Date.now() }, t.writeToken)).status, 409);
  const read = await call(`/track/${t.shareCode}`);
  assert.equal(read.data.status, "arrived");
  assert.ok(Math.abs(read.data.expiresAt - Date.now() - 14400000) < 2000);
});
test("arrival feedback is anonymous, validates ratings, and expires after 90 days", async () => {
  assert.equal((await call("/feedback", { routeRating: 0 })).status, 400);
  assert.equal((await call("/feedback", { routeRating: 4, shareCode: "must-not-be-accepted" })).status, 400);
  assert.equal((await call("/feedback", {
    routeRating: 4,
    reports: [{ streetOrBlock: "Oak Street", lightingRating: 5.5 }],
  })).status, 400);

  const result = await call("/feedback", {
    routeRating: 2,
    reports: [{ streetOrBlock: "Oak Street", lightingRating: 1, notes: "Several lamps were out." }],
  });
  assert.equal(result.status, 201);
  assert.deepEqual(result.data, { ok: true });
  const saved = db.database.prepare("SELECT * FROM arrival_feedback").get() as {
    id: string; route_rating: number; reports: string; created_at: number; expires_at: number;
  };
  assert.equal(saved.route_rating, 2);
  assert.deepEqual(JSON.parse(saved.reports), [
    { streetOrBlock: "Oak Street", lightingRating: 1, notes: "Several lamps were out." },
  ]);
  assert.deepEqual(Object.keys(saved).sort(), ["created_at", "expires_at", "id", "reports", "route_rating"]);
  assert.ok(Math.abs(saved.expires_at - Date.now() - 90 * 86400000) < 2000);
  db.database.prepare("UPDATE arrival_feedback SET expires_at = ? WHERE id = ?").run(Date.now() - 1, saved.id);
  db.purgeExpired();
  assert.equal(db.database.prepare("SELECT id FROM arrival_feedback WHERE id = ?").get(saved.id), undefined);
});
test("help freezes the last-known location and marks the public trip", async () => {
  const t = await trip(), position = { lat: 0, lng: 0.0003, accuracy: 7, timestamp: Date.now() };
  await call(`/trips/${t.tripId}/location`, position, t.writeToken);
  assert.equal((await call(`/trips/${t.tripId}/end`, { status: "help" }, t.writeToken)).status, 200);
  assert.equal((await call(`/trips/${t.tripId}/location`, { ...position, lng: 0.0009 }, t.writeToken)).status, 409);
  const read = await call(`/track/${t.shareCode}`);
  assert.equal(read.data.status, "help");
  assert.equal(read.data.lastLocation.lng, position.lng);
});
test("six-hour expiry, 404 links, and purge", async () => {
  const t = await trip();
  assert.ok(Math.abs(t.expiresAt - Date.now() - 21600000) < 2000);
  db.database.prepare("UPDATE trips SET expires_at = ? WHERE id = ?").run(Date.now() - 1, t.tripId);
  assert.equal((await call(`/track/${t.shareCode}`)).status, 404);
  assert.equal((await call("/track/not-a-valid-code")).status, 404);
  db.purgeExpired();
  assert.equal(db.database.prepare("SELECT id FROM trips WHERE id = ?").get(t.tripId), undefined);
});
test("invalid coordinates, geometry, ETA, stale fixes, and end status are rejected", async () => {
  assert.equal((await call("/trips", { routeGeometry: { type: "LineString", coordinates: [[0, 100], [0, 0]] }, etaSeconds: 90 })).status, 400);
  assert.equal((await call("/trips", { routeGeometry: geometry, etaSeconds: 0 })).status, 400);
  const t = await trip();
  assert.equal((await call(`/trips/${t.tripId}/location`, { lat: 999, lng: 0, accuracy: 5, timestamp: Date.now() }, t.writeToken)).status, 400);
  assert.equal((await call(`/trips/${t.tripId}/location`, { lat: 0, lng: 0, accuracy: 5, timestamp: Date.now() - 130000 }, t.writeToken)).status, 400);
  assert.equal((await call(`/trips/${t.tripId}/end`, { status: "other" }, t.writeToken)).status, 400);
});
test("lighting normalization, distance buffers, and sparse-data fallback", () => {
  const full = lighting.scoreLighting(geometry, { elements: [
    { type: "node", id: 1, lat: 0, lon: 0.0002, tags: { highway: "street_lamp" } },
    { type: "node", id: 2, lat: 0, lon: 0.0006, tags: { highway: "street_lamp" } },
    { type: "node", id: 3, lat: 0.002, lon: 0.0005, tags: { highway: "street_lamp" } },
    { type: "node", id: 4, lat: 0, lon: 0.0005, tags: { highway: "bus_stop" } },
    { type: "way", id: 5, tags: { lit: "yes" }, geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 }] },
  ] });
  assert.equal(full.lightScore, 100);
  assert.equal(full.lightBreakdown.activityCount, 1);
  assert.equal(full.lightBreakdown.lampsPer100m, 1.8);
  assert.equal(full.lightBreakdown.limitedData, false);
  const sparse = lighting.scoreLighting(geometry, { elements: [
    { type: "way", id: 5, tags: { lit: "yes" }, geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 }] },
  ] });
  assert.equal(sparse.lightBreakdown.limitedData, true);
  assert.equal(sparse.lightScore, 25);
  assert.equal(lighting.unavailableLighting().lightScore, null);
});
test("routes use real provider alternatives and do not silently fabricate without a key", async () => {
  delete process.env.ORS_API_KEY;
  assert.equal((await call("/routes", { from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 0.001 } })).status, 503);
  process.env.ORS_API_KEY = "test-fixture-not-a-real-key";
  let requestedAlternatives = false;
  globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).includes("openrouteservice")) {
      const body = JSON.parse(options!.body as string);
      requestedAlternatives = body.alternative_routes.target_count === 3;
      return Response.json({ features: [{ geometry, properties: { summary: { distance: 111, duration: 90 } } }] });
    }
    if (String(url).includes("overpass")) return Response.json({ elements: [] });
    return realFetch(url, options);
  }) as typeof fetch;
  const r = await call("/routes", { from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 0.001 } });
  assert.equal(r.status, 200); assert.equal(requestedAlternatives, true);
  assert.equal(r.data.demo, false); assert.equal(r.data.routes.length, 2);
  assert.equal(r.data.travelMode, "walking");
  assert.equal(r.data.routes[0].durationSeconds, 90);
  assert.equal(r.data.routes[1].lightBreakdown.limitedData, true);
  globalThis.fetch = realFetch; delete process.env.ORS_API_KEY;
});
test("driving route planning uses the car profile, skips lighting, and enforces 300 km and five-hour limits", async () => {
  process.env.ORS_API_KEY = "test-fixture-not-a-real-key";
  const fastGeometry: Geometry = { type: "LineString", coordinates: [[0, 0], [1, 0], [2, 0]] };
  const alternateGeometry: Geometry = { type: "LineString", coordinates: [[0, 0], [1, 0.2], [2, 0]] };
  let requestedUrl = "", overpassRequests = 0;
  let responseFeatures = [
    { geometry: fastGeometry, properties: { summary: { distance: 240_000, duration: 12_000 } } },
    { geometry: alternateGeometry, properties: { summary: { distance: 260_000, duration: 13_000 } } },
  ];
  globalThis.fetch = (async (url: string | URL | Request) => {
    requestedUrl = String(url);
    if (requestedUrl.includes("openrouteservice")) return Response.json({ features: responseFeatures });
    if (requestedUrl.includes("overpass")) overpassRequests++;
    return realFetch(url);
  }) as typeof fetch;
  try {
    const result = await call("/routes", {
      from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 2 }, travelMode: "driving",
    });
    assert.equal(result.status, 200);
    assert.match(requestedUrl, /directions\/driving-car\/geojson/);
    assert.equal(result.data.travelMode, "driving");
    assert.deepEqual(result.data.routes.map((route: { label: string }) => route.label), ["Fastest", "Alternative"]);
    assert.equal(result.data.routes[0].distanceMeters, 240_000);
    assert.equal(result.data.routes[0].lightScore, null);
    assert.equal(overpassRequests, 0);
    assert.match(result.data.notices[0], /not turn-by-turn navigation/);

    const previousRequest = requestedUrl;
    assert.equal((await call("/routes", { from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 3 }, travelMode: "driving" })).status, 400);
    assert.equal(requestedUrl, previousRequest);
    responseFeatures = [{ geometry: fastGeometry, properties: { summary: { distance: 301_000, duration: 12_000 } } }];
    assert.equal((await call("/routes", { from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 2 }, travelMode: "driving" })).status, 422);
    responseFeatures = [{ geometry: fastGeometry, properties: { summary: { distance: 240_000, duration: 18_001 } } }];
    assert.equal((await call("/routes", { from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 2 }, travelMode: "driving" })).status, 422);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.ORS_API_KEY;
  }
});
test("Nominatim requests are globally throttled and cached", async () => {
  let requests = 0;
  const starts: number[] = [];
  globalThis.fetch = (async () => {
    requests++; starts.push(Date.now());
    return Response.json([{ lat: "40.73", lon: "-73.99", display_name: "Fixture address" }]);
  }) as typeof fetch;
  const [a, b] = await Promise.all([call("/geocode?q=Fixture%20One"), call("/geocode?q=Fixture%20Two")]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.ok(starts[1] - starts[0] >= 950);
  await call("/geocode?q=Fixture%20One");
  assert.equal(requests, 2);
  globalThis.fetch = realFetch;
});
test("nearby searches bias Nominatim to the neighborhood and return the closest result first", async () => {
  let providerRequest = "";
  globalThis.fetch = (async input => {
    providerRequest = String(input);
    return Response.json([
      { lat: "40.7500", lon: "-73.9800", display_name: "Farther fixture" },
      { lat: "40.7350", lon: "-73.9820", display_name: "Nearest fixture" },
    ]);
  }) as typeof fetch;
  try {
    const result = await call("/geocode", { q: "Nearby fixture search", near: { lat: 40.7341, lng: -73.9821 } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.map((place: { label: string }) => place.label), ["Nearest fixture", "Farther fixture"]);
    const search = new URL(providerRequest).searchParams;
    assert.equal(search.get("limit"), "15");
    assert.ok(search.has("viewbox"));
    assert.ok(!providerRequest.includes("40.7341"));
    assert.ok(!providerRequest.includes("-73.9821"));
  } finally {
    globalThis.fetch = realFetch;
  }
});
