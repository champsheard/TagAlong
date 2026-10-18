import { randomUUID } from "node:crypto";
import { distance, routeLength } from "../../shared/geo";
import type { Geometry, Point, RouteOption, RouteProvider, RouteResult, TravelMode } from "../../shared/types";
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
type GraphHopperPath = {
  points?: Geometry;
  distance?: number;
  time?: number;
  instructions?: { street_name?: string | null }[];
};

class ProviderRequestError extends Error {
  constructor(readonly provider: RouteProvider, readonly status?: number) {
    super(`${provider} request failed`);
  }
}

function namedStreets(feature: OrsFeature): { streetNames?: string[] } {
  const names = [...new Set((feature.properties.segments ?? [])
    .flatMap(segment => segment.steps ?? [])
    .map(step => typeof step.name === "string" ? step.name.trim() : "")
    .filter(name => name && name !== "-"))].slice(0, 40);
  return names.length ? { streetNames: names } : {};
}

function logProviderFailure(provider: RouteProvider, error: unknown) {
  console.error(`[routing] ${provider} request failed`, {
    name: error instanceof Error ? error.name : "UnknownError",
    status: error instanceof ProviderRequestError ? error.status : undefined,
  });
}

async function requestOpenRouteService(from: Point, to: Point, travelMode: TravelMode): Promise<OrsFeature[]> {
  const key = process.env.HeiGET || process.env.ORS_API_KEY;
  if (!key) throw new ProviderRequestError("OpenRouteService");
  const profile = travelMode === "driving" ? "driving-car" : "foot-walking";
  const response = await fetch(`https://api.heigit.org/openrouteservice/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]], instructions: true, alternative_routes: { target_count: 3, weight_factor: 1.6, share_factor: 0.6 } }),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new ProviderRequestError("OpenRouteService", response.status);
  return ((await response.json()) as { features?: OrsFeature[] }).features ?? [];
}

async function requestGraphHopper(from: Point, to: Point, travelMode: TravelMode): Promise<OrsFeature[]> {
  const key = process.env.GRAPHHOPPER_API_KEY;
  if (!key) throw new ProviderRequestError("GraphHopper");
  const url = new URL("https://graphhopper.com/api/1/route");
  url.searchParams.set("key", key);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: [[from.lng, from.lat], [to.lng, to.lat]],
      profile: travelMode === "driving" ? "car" : "foot",
      points_encoded: false,
      instructions: true,
      algorithm: "alternative_route",
      "alternative_route.max_paths": 2,
      "alternative_route.max_weight_factor": 1.6,
      "alternative_route.max_share_factor": 0.6,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new ProviderRequestError("GraphHopper", response.status);
  const raw = (await response.json()) as { paths?: GraphHopperPath[] };
  return (raw.paths ?? [])
    .filter(path => path.points && Number.isFinite(path.distance) && Number.isFinite(path.time))
    .map(path => ({
      geometry: path.points!,
      properties: {
        summary: { distance: path.distance!, duration: path.time! / 1000 },
        segments: [{ steps: (path.instructions ?? []).map(step => ({ name: step.street_name })) }],
      },
    }));
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
  const orsKey = process.env.HeiGET || process.env.ORS_API_KEY;
  const graphHopperKey = process.env.GRAPHHOPPER_API_KEY;
  if (!orsKey && !graphHopperKey) throw new HttpError(503, "Live routing isn't configured on this server. Try a Demo walk or configure a routing provider.", "ROUTING_NOT_CONFIGURED");
  let features: OrsFeature[] = [];
  let provider: RouteProvider | undefined;
  let fallbackReason = orsKey ? "" : "OpenRouteService isn't configured";
  if (orsKey) {
    try {
      features = await requestOpenRouteService(from, to, travelMode);
      if (features.length) provider = "OpenRouteService";
      else fallbackReason = "OpenRouteService returned no routes";
    } catch (error) {
      logProviderFailure("OpenRouteService", error);
      fallbackReason = "OpenRouteService is unavailable";
    }
  }
  if (!provider && graphHopperKey) {
    try {
      features = await requestGraphHopper(from, to, travelMode);
      if (!features.length) throw new ProviderRequestError("GraphHopper");
      provider = "GraphHopper";
    } catch (error) {
      logProviderFailure("GraphHopper", error);
      throw new HttpError(502, orsKey
        ? "Both routing providers are temporarily unavailable. Please retry."
        : "The backup routing provider is temporarily unavailable. Please retry.");
    }
  }
  if (!provider) {
    if (fallbackReason === "OpenRouteService returned no routes") throw new HttpError(422, `No ${modeName} routes found. Try another destination.`);
    throw new HttpError(502, "The routing service couldn't be reached. Please retry.");
  }
  const providerNotice = provider === "GraphHopper"
    ? `${fallbackReason}; GraphHopper supplied these backup routes.`
    : "";
  features = features.slice(0, 3);
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
      routes, travelMode, demo: false, provider,
      notices: [...(providerNotice ? [providerNotice] : []), "Driving routes provide route and ETA estimates only—not turn-by-turn navigation, live traffic rerouting, or road-closure alerts. Routes are limited to 300 km and five hours; tracking links expire after six hours."],
    };
  }
  const notices: string[] = providerNotice ? [providerNotice] : [];
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
  return { routes: [{ ...fastest, label: "Fastest" }, { ...lightingPreferred, id: `${lightingPreferred.id}-safest`, label: "Safest" }] as RouteOption[], notices, demo: false, travelMode, provider };
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
