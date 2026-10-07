import { cached, cacheValue } from "./db";
import { HttpError } from "./errors";
import type { Place } from "../../shared/types";
import { validPoint } from "./validation";

let queue: Promise<unknown> = Promise.resolve();
let nextRequestAt = 0, pending = 0;
const active = new Map<string, Promise<Place[]>>();
export function geocode(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3 || q.length > 160) throw new HttpError(400, "Search for an address using 3–160 characters.");
  const key = `geocode:${q.toLowerCase()}`;
  const hit = cached<Place[]>(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = active.get(key);
  if (inFlight) return inFlight;
  if (pending >= 25) throw new HttpError(429, "Address search is busy. Please try again shortly.");
  pending++;
  const job = queue.then(async () => {
    // Nominatim's one-request-per-second policy is global, not per client.
    await new Promise(resolve => setTimeout(resolve, Math.max(0, nextRequestAt - Date.now())));
    nextRequestAt = Date.now() + 1000;
    try {
      const endpoint = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`, {
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
  return job;
}
