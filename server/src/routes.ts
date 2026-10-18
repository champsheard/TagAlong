import { randomUUID } from "node:crypto";
import { distance, routeLength } from "../../shared/geo";
import type { Geometry, Point, RouteOption, RouteResult, TravelMode } from "../../shared/types";
import { HttpError } from "./errors";
import { loadLightingArea, scoreLighting, unavailableLighting, type LightingArea } from "./lighting";
import { validPoint, validateGeometry } from "./validation";

const MAX_WALKING_START_DISTANCE = 15_000;
const MAX_WALKING_ROUTE_DISTANCE = 25_000;
const MAX_DRIVING_DISTANCE = 300_000;
const MAX_DRIVING_ETA = 5 * 60 * 60;

type OrsFeature = {
  geometry: Geometry;
  properties: {
    summary: { distance: number; duration: number };
    segments?: { steps?: { name?: string | null }[] }[];
  };
};

function namedStreets(feature: OrsFeature): { streetNames?: string[] } {
  const names = [...new Set((feature.properties.segments ?? [])
    .flatMap(segment => segment.steps ?? [])
    .map(step => typeof step.name === "string" ? step.name.trim() : "")
    .filter(name => name && name !== "-"))].slice(0, 40);
  return names.length ? { streetNames: names } : {};
}

export async function planRoutes(from: Point, to: Point, travelMode: TravelMode = "walking"): Promise<RouteResult> {
  if (!validPoint(from) || !validPoint(to)) throw new HttpError(400, "Choose valid starting and destination locations.");
  if (travelMode !== "walking" && travelMode !== "driving") throw new HttpError(400, "Choose walking or driving routes.");
  const separation = distance(from, to);
  if (separation < 20) throw new HttpError(400, "Choose a destination at least 20 metres from your start.");
  const maximumDistance = travelMode === "driving" ? MAX_DRIVING_DISTANCE : MAX_WALKING_START_DISTANCE;
  const maximumRouteDistance = travelMode === "driving" ? MAX_DRIVING_DISTANCE : MAX_WALKING_ROUTE_DISTANCE;
  const modeName = travelMode === "driving" ? "driving" : "walking";
  if (separation > maximumDistance) {
    throw new HttpError(400, travelMode === "driving" ? "Choose a driving destination within 300 km." : "Choose a walking destination within 15 km.");
  }
  const key = process.env.ORS_API_KEY;
  if (!key) throw new HttpError(503, "Live routing needs the server's OpenRouteService key. Try the walking demo while setup is completed.", "ROUTING_NOT_CONFIGURED");
  let raw: { features?: OrsFeature[] };
  let providerStatus: number | undefined;
  try {
    const profile = travelMode === "driving" ? "driving-car" : "foot-walking";
    const response = await fetch(`https://api.heigit.org/openrouteservice/v2/directions/${profile}/geojson`, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]], instructions: true, alternative_routes: { target_count: 3, weight_factor: 1.6, share_factor: 0.6 } }),
      signal: AbortSignal.timeout(20000),
    });
    providerStatus = response.status;
    if (response.status === 401 || response.status === 403) throw new HttpError(503, "The routing service rejected its server key. Please update the OpenRouteService key.");
    if (response.status === 429) throw new HttpError(503, "The routing provider is busy. Please wait and retry.");
    if (!response.ok) {
      console.error("[routing] OpenRouteService rejected directions request", { status: response.status, profile });
      throw new HttpError(422, `No ${modeName} routes found. Try another destination.`);
    }
    raw = await response.json();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const error = e instanceof Error ? e as Error & { code?: unknown; cause?: unknown } : null;
    const cause = error?.cause && typeof error.cause === "object"
      ? error.cause as { name?: unknown; code?: unknown }
      : null;
    console.error("[routing] OpenRouteService request failed", {
      name: error?.name ?? "UnknownError",
      code: typeof error?.code === "string" ? error.code : undefined,
      causeName: typeof cause?.name === "string" ? cause.name : undefined,
      causeCode: typeof cause?.code === "string" ? cause.code : undefined,
      providerStatus,
    });
    throw new HttpError(502, "The routing service couldn't be reached. Please retry.");
  }
  const features = (raw.features ?? []).slice(0, 3);
  const usable = [];
  for (const f of features) {
    const summary = f.properties?.summary;
    if (!Number.isFinite(summary?.duration) || !Number.isFinite(summary?.distance)) continue;
    try { validateGeometry(f.geometry); }
    catch { throw new HttpError(502, "The routing provider returned an invalid route. Please retry."); }
    if (summary!.distance > maximumRouteDistance ||
      routeLength(f.geometry) > maximumRouteDistance ||
      summary!.duration > (travelMode === "driving" ? MAX_DRIVING_ETA : 6 * 60 * 60)) continue;
    usable.push(f);
  }
  if (!usable.length) {
    throw new HttpError(422, travelMode === "driving"
      ? "No driving route within 300 km and five hours was found. Try a closer destination."
      : "No walking route within 25 km was found. Try a closer destination.");
  }
  if (travelMode === "driving") {
    const fastestFirst = usable
      .map(f => ({
        id: randomUUID(), geometry: f.geometry, distanceMeters: f.properties.summary.distance,
        durationSeconds: f.properties.summary.duration, ...namedStreets(f), ...unavailableLighting(),
      }))
      .sort((a, b) => a.durationSeconds - b.durationSeconds);
    const unique = fastestFirst.filter((route, index) => !fastestFirst.slice(0, index).some(previous =>
      JSON.stringify(previous.geometry.coordinates) === JSON.stringify(route.geometry.coordinates)));
    const routes = unique.slice(0, 2).map((route, index) => ({ ...route, label: index === 0 ? "Fastest" : "Alternative" } as RouteOption));
    return {
      routes, travelMode, demo: false,
      notices: ["Driving routes provide route and ETA estimates only—not turn-by-turn navigation, live traffic rerouting, or road-closure alerts. Routes are limited to 300 km and five hours; tracking links expire after six hours."],
    };
  }
  const notices: string[] = [];
  let area: LightingArea | undefined;
  try { area = await loadLightingArea(usable.map(f => f.geometry)); }
  catch { notices.push("Lighting data is temporarily unavailable. Route options are real, but no lighting estimate can be given."); }
  const scored = usable.map(f => ({
    id: randomUUID(), geometry: f.geometry,
    distanceMeters: f.properties.summary.distance, durationSeconds: f.properties.summary.duration,
    ...namedStreets(f), ...(area ? scoreLighting(f.geometry, area) : unavailableLighting()),
  }));
  const fastest = scored.reduce((a, b) => a.durationSeconds <= b.durationSeconds ? a : b);
  const hasLighting = scored.some(r => r.lightScore !== null);
  const lightingPreferred = hasLighting ? scored.reduce((a, b) => (a.lightScore ?? -1) >= (b.lightScore ?? -1) ? a : b) : fastest;
  if (lightingPreferred.id === fastest.id) notices.push(hasLighting
    ? "The fastest route also has the highest available lighting estimate; both choices use the same path."
    : "Without lighting data, both choices use the fastest path; the Safest option has no lighting estimate.");
  if (scored.some(r => r.lightBreakdown.limitedData) && area) notices.push("Limited lighting data for this area. Scores use available lit-street and activity proxies and are estimates, not safety guarantees.");
  return { routes: [{ ...fastest, label: "Fastest" }, { ...lightingPreferred, id: `${lightingPreferred.id}-safest`, label: "Safest" }] as RouteOption[], notices, demo: false, travelMode };
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
    id: label === "Fastest" ? "demo-fastest" : "demo-safest", geometry,
    distanceMeters: Math.round(routeLength(geometry)), durationSeconds: duration, label, lightScore: score,
    lightBreakdown: { lampsPer100m: score / 60, activityCount: 8, litShare: score / 100, limitedData: false, unavailable: false, simulated: true, reason: "Simulated lighting data — not a real-world estimate" },
  });
  return {
    routes: [make(fast, "Fastest", 62, 900), make(lit, "Safest", 88, 1020)],
    notices: ["Demo routes, scores, and movement are simulated. This demonstrates real private trip sharing, not navigation or actual street lighting."],
    demo: true, travelMode: "walking" as const,
    from: { lat: 40.7308, lng: -73.9973, label: "Washington Square Park · Demo start" },
    to: { lat: 40.7359, lng: -73.9900, label: "Union Square · Demo destination" },
  };
}
