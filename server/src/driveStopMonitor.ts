import { distance } from "../../shared/geo";
import type { Point } from "../../shared/types";
import { cached, cacheValue, database } from "./firestore.js";
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

async function resetCandidate(id: string, now: number) {
  const reference = database.collection("trips").doc(id);
  await database.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    const row = snapshot.data();
    if (!row) return;
    transaction.update(reference, {
      stop_started_at: null, stop_anchor_lat: null, stop_anchor_lng: null,
      stop_place_checked_at: null, stop_has_mapped_place: null, remote_stop_alert_due_at: null,
      remote_stop_alert_cleared_at: row.remote_stop_alert_at != null && row.remote_stop_alert_cleared_at == null
        ? now : row.remote_stop_alert_cleared_at,
    });
  });
}

export async function recordDriveStopLocation(id: string, previous: PositionLike | null, current: PositionLike, now = Date.now()) {
  if (!accurate(current)) return;
  const reference = database.collection("trips").doc(id);
  const snapshot = await reference.get();
  const row = snapshot.data() as { status: string; travel_mode: string; demo: number; stop_started_at: number | null; stop_anchor_lat: number | null; stop_anchor_lng: number | null } | undefined;
  if (!row || row.status !== "active" || row.travel_mode !== "driving" || row.demo) return;

  if (row.stop_started_at === null || row.stop_anchor_lat === null || row.stop_anchor_lng === null) {
    if (!previous || !accurate(previous) || distance(previous, current) > STOP_RADIUS_METERS) return;
    await database.runTransaction(async transaction => {
      const latest = await transaction.get(reference);
      const currentRow = latest.data();
      if (currentRow?.status === "active" && currentRow.travel_mode === "driving" && !currentRow.demo &&
          currentRow.stop_started_at == null) {
        transaction.update(reference, {
          stop_started_at: now, stop_anchor_lat: current.lat, stop_anchor_lng: current.lng,
          stop_place_checked_at: null, stop_has_mapped_place: null, remote_stop_alert_due_at: null,
        });
      }
    });
    return;
  }

  if (distance({ lat: row.stop_anchor_lat, lng: row.stop_anchor_lng }, current) > STOP_RADIUS_METERS) {
    await resetCandidate(id, now);
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
  const hit = await cached<OsmPlaces>(cell.key);
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
        headers: { "User-Agent": "Tagalong/1.0 (remote stop check)" },
      });
      if (!response.ok) throw new Error("Map data unavailable");
      const data = await response.json() as OsmPlaces & { remark?: string };
      if (!Array.isArray(data.elements) || data.remark) throw new Error("Incomplete map data");
      await cacheValue(cell.key, data, BUILDING_CACHE_MS);
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

export async function driveStopAlertState(id: string) {
  const snapshot = await database.collection("trips").doc(id).get();
  const row = snapshot.data() as {
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
    const activeTrips = await database.collection("trips").where("status", "==", "active").get();
    const candidates = activeTrips.docs.map(document => document.data() as StopCandidate & {
      status: string; expires_at: number; travel_mode: string; demo: number;
      stop_place_checked_at: number | null; remote_stop_alert_due_at: number | null;
    }).filter(row => row.expires_at > now && row.travel_mode === "driving" && !row.demo &&
      row.stop_started_at <= now - STOP_DURATION_MS && row.stop_place_checked_at === null && row.remote_stop_alert_due_at === null)
      .sort((a, b) => a.stop_started_at - b.stop_started_at).slice(0, 3);

    for (const candidate of candidates) {
      const remote = await hasNearbyMappedPlace({ lat: candidate.stop_anchor_lat, lng: candidate.stop_anchor_lng });
      const checkedAt = Date.now();
      const hasPlace = remote === null ? -1 : remote ? 1 : 0;
      const dueAt = remote === false ? checkedAt + CANCEL_WINDOW_MS : null;
      const reference = database.collection("trips").doc(candidate.id);
      await database.runTransaction(async transaction => {
        const current = await transaction.get(reference);
        const row = current.data();
        if (row?.status === "active" && row.expires_at > checkedAt && row.stop_started_at === candidate.stop_started_at &&
            row.stop_place_checked_at === null) {
          transaction.update(reference, { stop_place_checked_at: checkedAt, stop_has_mapped_place: hasPlace, remote_stop_alert_due_at: dueAt });
        }
      });
    }

    const dueCheckAt = Date.now();
    const due = activeTrips.docs.map(document => ({ id: document.id, ...document.data() } as {
      id: string; expires_at: number; travel_mode: string; demo: number; remote_stop_alert_due_at: number | null;
    }))
      .filter(row => row.expires_at > dueCheckAt && row.travel_mode === "driving" && !row.demo &&
        row.remote_stop_alert_due_at != null && row.remote_stop_alert_due_at <= dueCheckAt)
      .sort((a, b) => Number(a.remote_stop_alert_due_at) - Number(b.remote_stop_alert_due_at)).slice(0, 20);
    for (const row of due) {
      const sentAt = Date.now();
      const reference = database.collection("trips").doc(row.id);
      const claimed = await database.runTransaction(async transaction => {
        const current = await transaction.get(reference);
        const latest = current.data();
        if (!latest || latest.status !== "active" || latest.expires_at <= sentAt ||
            latest.remote_stop_alert_due_at == null || latest.remote_stop_alert_due_at > sentAt) return false;
        transaction.update(reference, {
          remote_stop_alert_due_at: null, remote_stop_alert_at: sentAt, remote_stop_alert_cleared_at: null,
        });
        return true;
      });
      if (claimed) await scheduleTripUpdate(row.id, "remote-stop");
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
