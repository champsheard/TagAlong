import { cached, cacheValue } from "./db";
import { HttpError } from "./errors";
import type { Place } from "../../shared/types";
import { validPoint } from "./validation";
import { distance } from "../../shared/geo";

let queue: Promise<unknown> = Promise.resolve();
let nextRequestAt = 0, pending = 0;
const active = new Map<string, Promise<Place[]>>();
function nearestFirst(places: Place[], near?: { lat: number; lng: number }) {
  return near
    ? [...places].sort((a, b) => distance(near, a) - distance(near, b) || a.label.localeCompare(b.label))
    : places;
}
export function geocode(query: string, near?: unknown): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3 || q.length > 160) throw new HttpError(400, "Search for an address using 3–160 characters.");
  if (near !== undefined && !validPoint(near)) throw new HttpError(400, "Choose a valid location to search nearby.");
  const searchNear = near as { lat: number; lng: number } | undefined;
  // Cache and provider requests use a coarse neighborhood center; exact device
  // coordinates stay in the request body and only sort this response in memory.
  const cell = searchNear ? { lat: Math.round(searchNear.lat * 10) / 10, lng: Math.round(searchNear.lng * 10) / 10 } : undefined;
  const key = `geocode:${q.toLowerCase()}:${cell ? `${cell.lat},${cell.lng}` : "global"}`;
  const hit = cached<Place[]>(key);
  if (hit) return Promise.resolve(nearestFirst(hit, searchNear));
  const inFlight = active.get(key);
  if (inFlight) return inFlight.then(places => nearestFirst(places, searchNear));
  if (pending >= 25) throw new HttpError(429, "Address search is busy. Please try again shortly.");
  pending++;
  const job = queue.then(async () => {
    // Nominatim's one-request-per-second policy is global, not per client.
    await new Promise(resolve => setTimeout(resolve, Math.max(0, nextRequestAt - Date.now())));
    nextRequestAt = Date.now() + 1000;
    try {
      const endpoint = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
      const url = new URL(`${endpoint.replace(/\/$/, "")}/search`);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", cell ? "15" : "5");
      url.searchParams.set("addressdetails", "0");
      url.searchParams.set("q", q);
      if (cell) {
        const longitudeRadius = 0.15 / Math.max(0.25, Math.cos(cell.lat * Math.PI / 180));
        const west = Math.max(-180, cell.lng - longitudeRadius);
        const east = Math.min(180, cell.lng + longitudeRadius);
        const north = Math.min(90, cell.lat + 0.15);
        const south = Math.max(-90, cell.lat - 0.15);
        url.searchParams.set("viewbox", `${west},${north},${east},${south}`);
        url.searchParams.set("bounded", "0");
      }
      const response = await fetch(url, {
        headers: { "User-Agent": process.env.APP_USER_AGENT ?? "SafeWalk/1.0 (privacy-focused walking route planner)", "Accept-Language": "en" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("provider unavailable");
      const raw = await response.json() as { lat: string; lon: string; display_name: string }[];
      const places = raw.map(p => ({ lat: Number(p.lat), lng: Number(p.lon), label: p.display_name })).filter(validPoint);
      cacheValue(key, places, 86400000); return places;
    } catch { throw new HttpError(502, "Address search is temporarily unavailable. Please retry or use Demo walk."); }
    finally { pending--; active.delete(key); }
  });
  queue = job.catch(() => {});
  active.set(key, job);
  return job.then(places => nearestFirst(places, searchNear));
}
