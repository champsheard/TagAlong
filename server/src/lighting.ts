import { asPoint, distanceToRoute, distanceToSegment, pointAlong, routeLength } from "../../shared/geo";
import type { Geometry, LightBreakdown, Point } from "../../shared/types";
import { cached, cacheValue } from "./db";
import { lightingConfig as config } from "./lightingConfig";

export type OsmElement = {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
};
export type LightingArea = { elements: OsmElement[] };
const pendingAreas = new Map<string, Promise<LightingArea>>();
const failedAreas = new Map<string, number>();

export async function loadLightingArea(routes: Geometry[]): Promise<LightingArea> {
  const coordinates = routes.flatMap(r => r.coordinates);
  const lats = coordinates.map(p => p[1]), lngs = coordinates.map(p => p[0]);
  const middleLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const latBuffer = config.bufferMeters / 111195;
  const lngBuffer = latBuffer / Math.max(0.15, Math.cos(middleLat * Math.PI / 180));
  // Round OUTWARD, so all buffered routes lie in the cached area.
  const step = 0.02;
  const bbox = [
    Math.max(-90, Math.floor((Math.min(...lats) - latBuffer) / step) * step),
    Math.max(-180, Math.floor((Math.min(...lngs) - lngBuffer) / step) * step),
    Math.min(90, Math.ceil((Math.max(...lats) + latBuffer) / step) * step),
    Math.min(180, Math.ceil((Math.max(...lngs) + lngBuffer) / step) * step),
  ].map(n => n.toFixed(4)).join(",");
  const key = `lighting:${bbox}`;
  const hit = cached<LightingArea>(key);
  if (hit) return hit;
  if ((failedAreas.get(key) ?? 0) > Date.now()) throw new Error("lighting temporarily unavailable");
  const inFlight = pendingAreas.get(key);
  if (inFlight) return inFlight;
  const job = (async () => {
    // Only explicitly 24/7 shops are considered open. Amenities/transit are
    // proxies for possible activity, not a promise that people are present.
    const query = `[out:json][timeout:20];(
      node["highway"="street_lamp"](${bbox});
      way["lit"="yes"](${bbox});
      nwr["shop"]["opening_hours"="24/7"](${bbox});
      nwr["amenity"~"hospital|police|fire_station"](${bbox});
      nwr["amenity"]["opening_hours"="24/7"](${bbox});
      node["highway"="bus_stop"](${bbox});
      node["public_transport"="platform"](${bbox});
    );out body center geom;`;
    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST", body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(25000),
        headers: { "User-Agent": "Tagalong/1.0" },
      });
      if (!response.ok) throw new Error("provider unavailable");
      const data = await response.json() as LightingArea & { remark?: string };
      if (!Array.isArray(data.elements) || data.remark) throw new Error("incomplete lighting data");
      cacheValue(key, data, config.cacheMs); failedAreas.delete(key); return data;
    } catch {
      // Briefly cache outages to avoid flooding Overpass during concurrent requests.
      failedAreas.set(key, Date.now() + 60000); throw new Error("lighting temporarily unavailable");
    } finally { pendingAreas.delete(key); }
  })();
  pendingAreas.set(key, job); return job;
}

export function scoreLighting(route: Geometry, area: LightingArea): { lightScore: number; lightBreakdown: LightBreakdown } {
  const length = Math.max(1, routeLength(route));
  let lamps = 0, activity = 0;
  const litWays: Point[][] = [];
  const visited = new Set<string>();
  for (const e of area.elements) {
    const key = `${e.type}:${e.id}`;
    if (visited.has(key)) continue; visited.add(key);
    const tags = e.tags ?? {};
    if (tags.lit === "yes" && e.geometry) litWays.push(e.geometry.map(p => ({ lat: p.lat, lng: p.lon })));
    const center = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null);
    if (!center) continue;
    const radius = distanceToRoute({ lat: center.lat, lng: center.lon }, route);
    if (tags.highway === "street_lamp" && radius <= config.lampRadiusMeters) lamps++;
    const activePlace = tags.highway === "bus_stop" || tags.public_transport === "platform" ||
      (tags.shop && tags.opening_hours === "24/7") ||
      (tags.amenity && (tags.opening_hours === "24/7" || ["hospital", "police", "fire_station"].includes(tags.amenity)));
    if (activePlace && radius <= config.activityRadiusMeters) activity++;
  }
  // Equal-distance sampling approximates the fraction of route length on lit=yes
  // ways. This weights long segments correctly instead of counting OSM ways.
  const samples = Math.max(1, Math.ceil(length / config.sampleEveryMeters));
  let litSamples = 0;
  for (let i = 0; i < samples; i++) {
    const p = pointAlong(route, (i + 0.5) / samples);
    if (litWays.some(way => way.slice(1).some((b, j) =>
      distanceToSegment(p, way[j], b) <= config.litWayRadiusMeters))) litSamples++;
  }
  const lampsPer100m = lamps / length * 100;
  const L = Math.min(1, lampsPer100m / config.caps.lampsPer100m);
  const A = Math.min(1, activity / length * 100 / config.caps.activityPer100m);
  const U = litSamples / samples;
  const limitedData = lamps / length * 1000 < config.sparseLampsPerKm;
  const w = config.weights;
  // Sparse lamp coverage is NOT evidence of darkness. Fall back to available
  // activity and lit=yes proxies, renormalizing their weights to sum to one.
  const raw = limitedData
    ? (w.activity * A + w.litWays * U) / (w.activity + w.litWays)
    : w.lamps * L + w.activity * A + w.litWays * U;
  return {
    lightScore: Math.round(Math.max(0, Math.min(1, raw)) * 100),
    lightBreakdown: {
      lampsPer100m: Math.round(lampsPer100m * 10) / 10, activityCount: activity,
      litShare: Math.round(U * 100) / 100, limitedData, unavailable: false,
      reason: limitedData ? `Limited lamp data · ${Math.round(U * 100)}% tagged lit · ${activity} activity spots`
        : `${lampsPer100m.toFixed(1)} streetlights per 100 m`,
    },
  };
}
export function unavailableLighting(): { lightScore: null; lightBreakdown: LightBreakdown } {
  return { lightScore: null, lightBreakdown: { lampsPer100m: 0, activityCount: 0, litShare: 0, limitedData: true, unavailable: true, reason: "Lighting service unavailable — no estimate available" } };
}
