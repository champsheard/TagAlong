import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Geometry, Position, RouteProvider, TrackingData, TravelMode, TripStatus } from "../../shared/types";
import { routeLength } from "../../shared/geo";
import { database } from "./db";
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
export function createTrip(body: { routeGeometry?: Geometry; etaSeconds?: number; demo?: boolean; travelMode?: TravelMode; routeProvider?: RouteProvider }) {
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
  database.prepare("INSERT INTO trips(id,share_code,token_hash,route,travel_mode,route_provider,started_at,eta_at,expires_at,demo) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(tripId, shareCode, digest(writeToken), JSON.stringify(routeGeometry), travelMode, routeProvider, now, etaAt, expiresAt, body.demo ? 1 : 0);
  return { tripId, shareCode, writeToken, etaAt, expiresAt, travelMode, ...(routeProvider ? { routeProvider } : {}) };
}
export function writable(id: string, token: string | undefined): TripRow {
  if (!token || token.length > 200) throw new HttpError(401, "A private write token is required.");
  const row = database.prepare("SELECT * FROM trips WHERE id = ? AND expires_at > ?").get(id, Date.now()) as TripRow | undefined;
  // Avoid revealing whether an ID exists to unauthorized requests.
  if (!row || !timingSafeEqual(Buffer.from(row.token_hash, "hex"), Buffer.from(digest(token), "hex"))) throw new HttpError(404, "Trip not found or expired.");
  return row;
}
export function updateLocation(id: string, token: string | undefined, body: Position) {
  const row = writable(id, token);
  if (row.status !== "active") throw new HttpError(409, "This trip has ended. Location sharing is off.");
  if (!validPoint(body) || (body.accuracy !== null && (!Number.isFinite(body.accuracy) || body.accuracy < 0 || body.accuracy > 100000)) ||
    !Number.isFinite(body.timestamp) || body.timestamp > Date.now() + 30000 || body.timestamp < Date.now() - 120000) {
    throw new HttpError(400, "Provide a valid, recent location and accuracy.");
  }
  const previous = row.last_location ? JSON.parse(row.last_location) as Position : null;
  if (previous && body.timestamp < previous.timestamp) throw new HttpError(409, "An older location update was ignored.");
  const location: Position = { lat: body.lat, lng: body.lng, accuracy: body.accuracy, timestamp: body.timestamp };
  const now = Date.now();
  database.prepare("UPDATE trips SET last_location = ?, last_update_at = ? WHERE id = ? AND status = 'active'")
    .run(JSON.stringify(location), now, id);
  if (row.travel_mode === "driving" && !row.demo) recordDriveStopLocation(id, previous, location, now);
  scheduleTripUpdate(id, "refresh");
  return { ok: true, ...driveStopAlertState(id) };
}
export function endTrip(id: string, token: string | undefined, status: TripStatus) {
  const row = writable(id, token);
  if (status !== "arrived" && status !== "help") throw new HttpError(400, "End status must be arrived or help.");
  if (row.status !== "active") {
    if (row.status === status) return { ok: true };
    throw new HttpError(409, "This trip has already ended.");
  }
  const now = Date.now();
  database.prepare(`UPDATE trips SET status = ?, ended_at = ?, expires_at = ?,
    stop_started_at = NULL, stop_anchor_lat = NULL, stop_anchor_lng = NULL,
    stop_place_checked_at = NULL, stop_has_mapped_place = NULL,
    remote_stop_alert_due_at = NULL WHERE id = ?`)
    .run(status, now, now + 14400000, id);
  scheduleTripUpdate(id, status);
  return { ok: true };
}
export function cancelDriveStopAlert(id: string, token: string | undefined) {
  const row = writable(id, token);
  if (row.status !== "active" || row.travel_mode !== "driving" || row.demo) {
    throw new HttpError(409, "There is no cancellable drive warning.");
  }
  const result = database.prepare(`UPDATE trips SET remote_stop_alert_due_at = NULL
    WHERE id = ? AND status = 'active' AND travel_mode = 'driving' AND remote_stop_alert_due_at IS NOT NULL`)
    .run(id);
  if (!result.changes) throw new HttpError(409, "The drive warning is no longer waiting to be sent.");
  return { ok: true };
}
export function trackTrip(code: string): TrackingData {
  if (!/^[a-zA-Z0-9_-]{22,64}$/.test(code)) throw new HttpError(404, "This trip link is invalid or has expired.");
  const row = database.prepare("SELECT * FROM trips WHERE share_code = ? AND expires_at > ?").get(code, Date.now()) as TripRow | undefined;
  if (!row) throw new HttpError(404, "This trip link is invalid or has expired.");
  return {
    status: row.status, lastLocation: row.last_location ? JSON.parse(row.last_location) : null,
    lastUpdateAt: row.last_update_at, route: JSON.parse(row.route),
    etaAt: row.eta_at, startedAt: row.started_at, expiresAt: row.expires_at, demo: !!row.demo, travelMode: row.travel_mode,
    ...(row.route_provider ? { routeProvider: row.route_provider } : {}),
    ...driveStopAlertState(row.id),
  };
}
