import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Geometry, Position, RouteProvider, TrackingData, TravelMode, TripStatus } from "../../shared/types";
import { routeLength } from "../../shared/geo";
import { database } from "./firestore";
import { HttpError } from "./errors";
import { validPoint, validateGeometry } from "./validation";
import { scheduleTripUpdate } from "./notifications";
import { driveStopAlertState, recordDriveStopLocation } from "./driveStopMonitor";

type TripRow = {
  id: string; share_code: string; token_hash: string; route: string;
  status: TripStatus; started_at: number; ended_at: number | null; eta_at: number;
  expires_at: number; last_location: string | null; last_update_at: number | null; demo: number; travel_mode: TravelMode; route_provider: RouteProvider | null;
  stop_started_at: number | null; stop_anchor_lat: number | null; stop_anchor_lng: number | null;
  stop_place_checked_at: number | null; stop_has_mapped_place: number | null;
  remote_stop_alert_due_at: number | null; remote_stop_alert_at: number | null;
  remote_stop_alert_cleared_at: number | null;
};
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export async function createTrip(body: { routeGeometry?: Geometry; etaSeconds?: number; demo?: boolean; travelMode?: TravelMode; routeProvider?: RouteProvider }) {
  const routeGeometry = body.routeGeometry;
  validateGeometry(routeGeometry);
  if (!Number.isFinite(body.etaSeconds) || body.etaSeconds! < 1 || body.etaSeconds! > 21600) throw new HttpError(400, "Provide a valid ETA between 1 second and 6 hours.");
  if (body.demo !== undefined && typeof body.demo !== "boolean") throw new HttpError(400, "Invalid demo setting.");
  const travelMode = body.travelMode ?? "walking";
  if (travelMode !== "walking" && travelMode !== "driving") throw new HttpError(400, "Choose walking or driving routes.");
  if (body.routeProvider !== undefined && body.routeProvider !== "OpenRouteService" && body.routeProvider !== "GraphHopper") {
    throw new HttpError(400, "Invalid route provider.");
  }
  const routeProvider = body.demo ? null : body.routeProvider ?? "OpenRouteService";
  const maxRouteDistance = travelMode === "driving" ? 300_000 : 25_000;
  if (routeLength(routeGeometry) > maxRouteDistance) {
    throw new HttpError(400, travelMode === "driving" ? "Driving trips are limited to 300 km." : "Walking trips are limited to 25 km.");
  }
  if (travelMode === "driving" && body.etaSeconds! > 5 * 60 * 60) throw new HttpError(400, "Driving ETAs must be five hours or less so tracking remains available through the trip.");
  const tripId = randomUUID(), shareCode = randomBytes(24).toString("base64url"), writeToken = randomBytes(32).toString("base64url");
  const now = Date.now(), expiresAt = now + 21600000, etaAt = now + Math.round(body.etaSeconds! * 1000);
  await database.collection("trips").doc(tripId).create({
    id: tripId, share_code: shareCode, token_hash: digest(writeToken),
    route: JSON.stringify(routeGeometry), travel_mode: travelMode, route_provider: routeProvider,
    status: "active", started_at: now, ended_at: null, eta_at: etaAt, expires_at: expiresAt,
    last_location: null, last_update_at: null, demo: body.demo ? 1 : 0,
    stop_started_at: null, stop_anchor_lat: null, stop_anchor_lng: null,
    stop_place_checked_at: null, stop_has_mapped_place: null, remote_stop_alert_due_at: null,
    remote_stop_alert_at: null, remote_stop_alert_cleared_at: null,
  });
  return { tripId, shareCode, writeToken, etaAt, expiresAt, travelMode, ...(routeProvider ? { routeProvider } : {}) };
}
export async function writable(id: string, token: string | undefined): Promise<TripRow> {
  if (!token || token.length > 200) throw new HttpError(401, "A private write token is required.");
  const snapshot = await database.collection("trips").doc(id).get();
  const row = snapshot.exists ? snapshot.data() as TripRow : undefined;
  // Avoid revealing whether an ID exists to unauthorized requests.
  if (!row || !timingSafeEqual(Buffer.from(row.token_hash, "hex"), Buffer.from(digest(token), "hex"))) throw new HttpError(404, "Trip not found or expired.");
  if (row.expires_at <= Date.now()) throw new HttpError(404, "Trip not found or expired.");
  return row;
}
export async function updateLocation(id: string, token: string | undefined, body: Position) {
  const row = await writable(id, token);
  if (row.status !== "active") throw new HttpError(409, "This trip has ended. Location sharing is off.");
  if (!validPoint(body) || (body.accuracy !== null && (!Number.isFinite(body.accuracy) || body.accuracy < 0 || body.accuracy > 100000)) ||
    !Number.isFinite(body.timestamp) || body.timestamp > Date.now() + 30000 || body.timestamp < Date.now() - 120000) {
    throw new HttpError(400, "Provide a valid, recent location and accuracy.");
  }
  const previous = row.last_location ? JSON.parse(row.last_location) as Position : null;
  if (previous && body.timestamp < previous.timestamp) throw new HttpError(409, "An older location update was ignored.");
  const location: Position = { lat: body.lat, lng: body.lng, accuracy: body.accuracy, timestamp: body.timestamp };
  const now = Date.now();
  const reference = database.collection("trips").doc(id);
  await database.runTransaction(async transaction => {
    const current = await transaction.get(reference);
    const data = current.data() as TripRow | undefined;
    if (!data || data.expires_at <= now) throw new HttpError(404, "Trip not found or expired.");
    if (data.status !== "active") throw new HttpError(409, "This trip has ended. Location sharing is off.");
    const oldLocation = data.last_location ? JSON.parse(data.last_location) as Position : null;
    if (oldLocation && body.timestamp < oldLocation.timestamp) throw new HttpError(409, "An older location update was ignored.");
    transaction.update(reference, { last_location: JSON.stringify(location), last_update_at: now });
  });
  if (row.travel_mode === "driving" && !row.demo) await recordDriveStopLocation(id, previous, location, now);
  await scheduleTripUpdate(id, "refresh");
  return { ok: true, ...await driveStopAlertState(id) };
}
export async function endTrip(id: string, token: string | undefined, status: TripStatus) {
  const row = await writable(id, token);
  if (status !== "arrived" && status !== "help") throw new HttpError(400, "End status must be arrived or help.");
  if (row.status !== "active") {
    if (row.status === status) return { ok: true };
    throw new HttpError(409, "This trip has already ended.");
  }
  const now = Date.now();
  const reference = database.collection("trips").doc(id);
  await database.runTransaction(async transaction => {
    const current = await transaction.get(reference);
    const data = current.data() as TripRow | undefined;
    if (!data || data.expires_at <= now) throw new HttpError(404, "Trip not found or expired.");
    if (data.status !== "active") {
      if (data.status === status) return;
      throw new HttpError(409, "This trip has already ended.");
    }
    transaction.update(reference, {
      status, ended_at: now, expires_at: now + 14400000,
      stop_started_at: null, stop_anchor_lat: null, stop_anchor_lng: null,
      stop_place_checked_at: null, stop_has_mapped_place: null, remote_stop_alert_due_at: null,
    });
  });
  await scheduleTripUpdate(id, status);
  return { ok: true };
}
export async function cancelDriveStopAlert(id: string, token: string | undefined) {
  const row = await writable(id, token);
  if (row.status !== "active" || row.travel_mode !== "driving" || row.demo) {
    throw new HttpError(409, "There is no cancellable drive warning.");
  }
  let cancelled = false;
  await database.runTransaction(async transaction => {
    const reference = database.collection("trips").doc(id);
    const current = await transaction.get(reference);
    const data = current.data() as TripRow | undefined;
    if (data?.status === "active" && data.travel_mode === "driving" && data.remote_stop_alert_due_at !== null) {
      transaction.update(reference, { remote_stop_alert_due_at: null });
      cancelled = true;
    }
  });
  if (!cancelled) throw new HttpError(409, "The drive warning is no longer waiting to be sent.");
  return { ok: true };
}
export async function trackTrip(code: string): Promise<TrackingData> {
  if (!/^[a-zA-Z0-9_-]{22,64}$/.test(code)) throw new HttpError(404, "This trip link is invalid or has expired.");
  const snapshot = await database.collection("trips").where("share_code", "==", code).limit(1).get();
  const row = snapshot.empty ? undefined : snapshot.docs[0].data() as TripRow;
  if (!row || row.expires_at <= Date.now()) throw new HttpError(404, "This trip link is invalid or has expired.");
  return {
    status: row.status, lastLocation: row.last_location ? JSON.parse(row.last_location) : null,
    lastUpdateAt: row.last_update_at, route: JSON.parse(row.route),
    etaAt: row.eta_at, startedAt: row.started_at, expiresAt: row.expires_at, demo: !!row.demo, travelMode: row.travel_mode,
    ...(row.route_provider ? { routeProvider: row.route_provider } : {}),
    ...await driveStopAlertState(row.id),
  };
}
