import { distance } from "../../shared/geo";
import type { Point } from "../../shared/types";
import { cached, cacheValue, database } from "./db.js";
import { scheduleTripUpdate } from "./notifications.js";

const STOP_RADIUS_METERS = 35;
const BUILDING_RADIUS_METERS = 250;
const STOP_DURATION_MS = 60_000;
const CANCEL_WINDOW_MS = 15_000;
const BUILDING_CACHE_MS = 6 * 60 * 60 * 1000;

type PositionLike = Point & { accuracy: number | null };
type OsmPlace = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
type OsmPlaces = { elements: OsmPlace[] };
type StopCandidate = {
  id: string;
  stop_started_at: number;
  stop_anchor_lat: number;
  stop_anchor_lng: number;
};

const pendingPlaces = new Map<string, Promise<OsmPlaces | null>>();
const failedPlaces = new Map<string, number>();
let processing = false;
let worker: ReturnType<typeof setInterval> | undefined;

function accurate(position: PositionLike) {
  return position.accuracy !== null && Number.isFinite(position.accuracy) && position.accuracy <= 60;
}

function resetCandidate(id: string, now: number) {
  database.prepare(`UPDATE trips SET
    stop_started_at = NULL, stop_anchor_lat = NULL, stop_anchor_lng = NULL,
    stop_place_checked_at = NULL, stop_has_mapped_place = NULL, remote_stop_alert_due_at = NULL,
    remote_stop_alert_cleared_at = CASE
      WHEN remote_stop_alert_at IS NOT NULL AND remote_stop_alert_cleared_at IS NULL THEN ?
      ELSE remote_stop_alert_cleared_at END
    WHERE id = ?`).run(now, id);
}

export function recordDriveStopLocation(id: string, previous: PositionLike | null, current: PositionLike, now = Date.now()) {
  if (!accurate(current)) return;
  const row = database.prepare(`SELECT stop_started_at,stop_anchor_lat,stop_anchor_lng
    FROM trips WHERE id = ? AND status = 'active' AND travel_mode = 'driving' AND demo = 0`)
    .get(id) as { stop_started_at: number | null; stop_anchor_lat: number | null; stop_anchor_lng: number | null } | undefined;
  if (!row) return;

  if (row.stop_started_at === null || row.stop_anchor_lat === null || row.stop_anchor_lng === null) {
    if (!previous || !accurate(previous) || distance(previous, current) > STOP_RADIUS_METERS) return;
    database.prepare(`UPDATE trips SET stop_started_at = ?, stop_anchor_lat = ?, stop_anchor_lng = ?,
      stop_place_checked_at = NULL, stop_has_mapped_place = NULL, remote_stop_alert_due_at = NULL
      WHERE id = ? AND status = 'active' AND stop_started_at IS NULL`)
      .run(now, current.lat, current.lng, id);
    return;
  }

  if (distance({ lat: row.stop_anchor_lat, lng: row.stop_anchor_lng }, current) > STOP_RADIUS_METERS) {
    resetCandidate(id, now);
  }
}

function cellFor(point: Point) {
  const step = 0.005;
  const lat = Math.round(point.lat / step) * step;
  const lng = Math.round(point.lng / step) * step;
  return { lat, lng, key: `drive-stop-places:${lat.toFixed(3)}:${lng.toFixed(3)}` };
}

async function loadMappedPlaces(point: Point): Promise<OsmPlaces | null> {
  const cell = cellFor(point);
  const hit = cached<OsmPlaces>(cell.key);
  if (hit) return hit;
  if ((failedPlaces.get(cell.key) ?? 0) > Date.now()) return null;
  const inFlight = pendingPlaces.get(cell.key);
  if (inFlight) return inFlight;

  const job = (async () => {
    const query = `[out:json][timeout:10];(
      nwr(around:650,${cell.lat},${cell.lng})["building"];
      nwr(around:650,${cell.lat},${cell.lng})["amenity"];
      nwr(around:650,${cell.lat},${cell.lng})["shop"];
      nwr(around:650,${cell.lat},${cell.lng})["office"];
      nwr(around:650,${cell.lat},${cell.lng})["tourism"];
      nwr(around:650,${cell.lat},${cell.lng})["public_transport"];
      nwr(around:650,${cell.lat},${cell.lng})["highway"="bus_stop"];
    );out center;`;
    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(12_000),
        headers: { "User-Agent": "SafeWalk/1.0 (remote stop check)" },
      });
      if (!response.ok) throw new Error("Map data unavailable");
      const data = await response.json() as OsmPlaces & { remark?: string };
      if (!Array.isArray(data.elements) || data.remark) throw new Error("Incomplete map data");
      cacheValue(cell.key, data, BUILDING_CACHE_MS);
      failedPlaces.delete(cell.key);
      return data;
    } catch {
      failedPlaces.set(cell.key, Date.now() + 60_000);
      return null;
    } finally {
      pendingPlaces.delete(cell.key);
    }
  })();
  pendingPlaces.set(cell.key, job);
  return job;
}

async function hasNearbyMappedPlace(point: Point): Promise<boolean | null> {
  const data = await loadMappedPlaces(point);
  if (!data) return null;
  return data.elements.some(element => {
    const tags = element.tags ?? {};
    const isBuildingOrPlace =
      (!!tags.building && tags.building !== "no") || !!tags.amenity || !!tags.shop ||
      !!tags.office || !!tags.tourism || !!tags.public_transport || tags.highway === "bus_stop";
    if (!isBuildingOrPlace) return false;
    const center = element.center ?? (element.lat !== undefined && element.lon !== undefined
      ? { lat: element.lat, lon: element.lon }
      : null);
    return !!center && distance(point, { lat: center.lat, lng: center.lon }) <= BUILDING_RADIUS_METERS;
  });
}

export function driveStopAlertState(id: string) {
  const row = database.prepare(`SELECT remote_stop_alert_due_at,remote_stop_alert_at,remote_stop_alert_cleared_at
    FROM trips WHERE id = ?`).get(id) as {
    remote_stop_alert_due_at: number | null;
    remote_stop_alert_at: number | null;
    remote_stop_alert_cleared_at: number | null;
  } | undefined;
  return {
    remoteStopAlertDueAt: row?.remote_stop_alert_due_at ?? null,
    remoteStopAlertAt: row?.remote_stop_alert_at ?? null,
    remoteStopAlertClearedAt: row?.remote_stop_alert_cleared_at ?? null,
  };
}

export async function processDriveStopAlerts(now = Date.now()) {
  if (processing) return;
  processing = true;
  try {
    const candidates = database.prepare(`SELECT id,stop_started_at,stop_anchor_lat,stop_anchor_lng
      FROM trips WHERE status = 'active' AND expires_at > ? AND travel_mode = 'driving' AND demo = 0
        AND stop_started_at <= ? AND stop_place_checked_at IS NULL AND remote_stop_alert_due_at IS NULL
      ORDER BY stop_started_at LIMIT 3`).all(now, now - STOP_DURATION_MS) as StopCandidate[];

    for (const candidate of candidates) {
      const remote = await hasNearbyMappedPlace({ lat: candidate.stop_anchor_lat, lng: candidate.stop_anchor_lng });
      const checkedAt = Date.now();
      const hasPlace = remote === null ? -1 : remote ? 1 : 0;
      const dueAt = remote === false ? checkedAt + CANCEL_WINDOW_MS : null;
      database.prepare(`UPDATE trips SET stop_place_checked_at = ?, stop_has_mapped_place = ?,
        remote_stop_alert_due_at = ?
        WHERE id = ? AND status = 'active' AND expires_at > ? AND stop_started_at = ? AND stop_place_checked_at IS NULL`)
        .run(checkedAt, hasPlace, dueAt, candidate.id, checkedAt, candidate.stop_started_at);
    }

    const dueCheckAt = Date.now();
    const due = database.prepare(`SELECT id FROM trips
      WHERE status = 'active' AND expires_at > ? AND travel_mode = 'driving' AND demo = 0
        AND remote_stop_alert_due_at IS NOT NULL AND remote_stop_alert_due_at <= ?
      ORDER BY remote_stop_alert_due_at LIMIT 20`).all(dueCheckAt, dueCheckAt) as { id: string }[];
    for (const row of due) {
      const sentAt = Date.now();
      const result = database.prepare(`UPDATE trips SET remote_stop_alert_due_at = NULL,
        remote_stop_alert_at = ?, remote_stop_alert_cleared_at = NULL
        WHERE id = ? AND status = 'active' AND expires_at > ? AND remote_stop_alert_due_at <= ?`).run(sentAt, row.id, sentAt, sentAt);
      if (result.changes) scheduleTripUpdate(row.id, "remote-stop");
    }
  } finally {
    processing = false;
  }
}

export function startDriveStopMonitor() {
  if (worker) return;
  worker = setInterval(() => { processDriveStopAlerts().catch(() => {}); }, 5000);
  worker.unref();
}
