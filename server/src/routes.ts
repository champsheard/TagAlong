import { randomUUID } from "node:crypto";
import { distance, routeLength } from "../../shared/geo";
import type { Geometry, Point, RouteOption, RouteResult } from "../../shared/types";
import { HttpError } from "./errors";
import { loadLightingArea, scoreLighting, unavailableLighting, type LightingArea } from "./lighting";
import { validPoint, validateGeometry } from "./validation";

export async function walkingRoutes(from: Point, to: Point): Promise<RouteResult> {
  if (!validPoint(from) || !validPoint(to)) throw new HttpError(400, "Choose valid starting and destination locations.");
  const separation = distance(from, to);
  if (separation < 20) throw new HttpError(400, "Choose a destination at least 20 metres from your start.");
  if (separation > 15000) throw new HttpError(400, "Choose a walking destination within 15 km.");
  const key = process.env.ORS_API_KEY;
  if (!key) throw new HttpError(503, "Live routing needs the server's OpenRouteService key. Try Demo walk while setup is completed.", "ROUTING_NOT_CONFIGURED");
  let raw: { features?: { geometry: Geometry; properties: { summary: { distance: number; duration: number } } }[] };
  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]], alternative_routes: { target_count: 3, weight_factor: 1.6, share_factor: 0.6 } }),
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 401 || response.status === 403) throw new HttpError(503, "The routing service rejected its server key. Please update the OpenRouteService key.");
    if (response.status === 429) throw new HttpError(503, "The routing provider is busy. Please wait and retry.");
    if (!response.ok) throw new HttpError(422, "No walking routes found. Try a nearby street or a different destination.");
    raw = await response.json();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, "The routing service couldn't be reached. Please retry.");
  }
  const features = raw.features?.slice(0, 3) ?? [];
  if (!features.length) throw new HttpError(422, "No walking routes found. Try another destination.");
  for (const f of features) {
    validateGeometry(f.geometry);
    if (!Number.isFinite(f.properties?.summary?.duration) || !Number.isFinite(f.properties?.summary?.distance) ||
      f.properties.summary.distance > 25000) throw new HttpError(422, "This route is too long or unavailable. Try a closer destination.");
  }
  const notices: string[] = [];
  let area: LightingArea | undefined;
  try { area = await loadLightingArea(features.map(f => f.geometry)); }
  catch { notices.push("Lighting data is temporarily unavailable. Route options are real, but no lighting estimate can be given."); }
  const scored = features.map(f => ({
    id: randomUUID(), geometry: f.geometry,
    distanceMeters: f.properties.summary.distance, durationSeconds: f.properties.summary.duration,
    ...(area ? scoreLighting(f.geometry, area) : unavailableLighting()),
  }));
  const fastest = scored.reduce((a, b) => a.durationSeconds <= b.durationSeconds ? a : b);
  const hasLighting = scored.some(r => r.lightScore !== null);
  const best = hasLighting ? scored.reduce((a, b) => (a.lightScore ?? -1) >= (b.lightScore ?? -1) ? a : b) : fastest;
  if (best.id === fastest.id) notices.push(hasLighting
    ? "The fastest route also has the highest available lighting estimate; both choices use the same path."
    : "Without lighting data, both choices show the fastest path. No best-lit claim can be made.");
  if (scored.some(r => r.lightBreakdown.limitedData) && area) notices.push("Limited lighting data for this area. Scores use available lit-street and activity proxies and are estimates, not safety guarantees.");
  return { routes: [{ ...fastest, label: "Fastest" }, { ...best, id: `${best.id}-lit`, label: "Best lit" }] as RouteOption[], notices, demo: false };
}

export function demoRoutes() {
  const fast: Geometry = { type: "LineString", coordinates: [
    [-73.9973, 40.7308], [-73.9960, 40.7316], [-73.9948, 40.7341],
    [-73.9929, 40.7370], [-73.9905, 40.7401], [-73.9900, 40.7359],
  ] };
  const lit: Geometry = { type: "LineString", coordinates: [
    [-73.9973, 40.7308], [-73.9957, 40.7303], [-73.9937, 40.7302],
    [-73.9914, 40.7325], [-73.9892, 40.7353], [-73.9900, 40.7359],
  ] };
  const make = (geometry: Geometry, label: RouteOption["label"], score: number, duration: number): RouteOption => ({
    id: label === "Fastest" ? "demo-fastest" : "demo-best-lit", geometry,
    distanceMeters: Math.round(routeLength(geometry)), durationSeconds: duration, label, lightScore: score,
    lightBreakdown: { lampsPer100m: score / 60, activityCount: 8, litShare: score / 100, limitedData: false, unavailable: false, simulated: true, reason: "Simulated lighting data — not a real-world estimate" },
  });
  return {
    routes: [make(fast, "Fastest", 62, 900), make(lit, "Best lit", 88, 1020)],
    notices: ["Demo routes, scores, and movement are simulated. This demonstrates real private trip sharing, not navigation or actual street lighting."],
    demo: true,
    from: { lat: 40.7308, lng: -73.9973, label: "Washington Square Park · Demo start" },
    to: { lat: 40.7359, lng: -73.9900, label: "Union Square · Demo destination" },
  };
}
