import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Geometry, Position, TrackingData, TripStatus } from "../../shared/types";
import { database } from "./db";
import { HttpError } from "./errors";
import { validPoint, validateGeometry } from "./validation";

type TripRow = {
  id: string; share_code: string; token_hash: string; route: string;
  status: TripStatus; started_at: number; ended_at: number | null; eta_at: number;
  expires_at: number; last_location: string | null; last_update_at: number | null; demo: number;
};
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export function createTrip(body: { routeGeometry?: Geometry; etaSeconds?: number; demo?: boolean }) {
  validateGeometry(body.routeGeometry);
  if (!Number.isFinite(body.etaSeconds) || body.etaSeconds! < 1 || body.etaSeconds! > 21600) throw new HttpError(400, "Provide a valid ETA between 1 second and 6 hours.");
  if (body.demo !== undefined && typeof body.demo !== "boolean") throw new HttpError(400, "Invalid demo setting.");
  const tripId = randomUUID(), shareCode = randomBytes(24).toString("base64url"), writeToken = randomBytes(32).toString("base64url");
  const now = Date.now(), expiresAt = now + 21600000, etaAt = now + Math.round(body.etaSeconds! * 1000);
  database.prepare("INSERT INTO trips(id,share_code,token_hash,route,started_at,eta_at,expires_at,demo) VALUES(?,?,?,?,?,?,?,?)")
    .run(tripId, shareCode, digest(writeToken), JSON.stringify(body.routeGeometry), now, etaAt, expiresAt, body.demo ? 1 : 0);
  return { tripId, shareCode, writeToken, etaAt, expiresAt };
}
function writable(id: string, token: string | undefined): TripRow {
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
  database.prepare("UPDATE trips SET last_location = ?, last_update_at = ? WHERE id = ? AND status = 'active'")
    .run(JSON.stringify(location), Date.now(), id);
  return { ok: true };
}
export function endTrip(id: string, token: string | undefined, status: TripStatus) {
  const row = writable(id, token);
  if (status !== "arrived" && status !== "help") throw new HttpError(400, "End status must be arrived or help.");
  if (row.status !== "active") {
    if (row.status === status) return { ok: true };
    throw new HttpError(409, "This trip has already ended.");
  }
  const now = Date.now();
  database.prepare("UPDATE trips SET status = ?, ended_at = ?, expires_at = ? WHERE id = ?")
    .run(status, now, now + 14400000, id);
  return { ok: true };
}
export function trackTrip(code: string): TrackingData {
  if (!/^[a-zA-Z0-9_-]{22,64}$/.test(code)) throw new HttpError(404, "This trip link is invalid or has expired.");
  const row = database.prepare("SELECT * FROM trips WHERE share_code = ? AND expires_at > ?").get(code, Date.now()) as TripRow | undefined;
  if (!row) throw new HttpError(404, "This trip link is invalid or has expired.");
  return {
    status: row.status, lastLocation: row.last_location ? JSON.parse(row.last_location) : null,
    lastUpdateAt: row.last_update_at, route: JSON.parse(row.route),
    etaAt: row.eta_at, startedAt: row.started_at, expiresAt: row.expires_at, demo: !!row.demo,
  };
}
