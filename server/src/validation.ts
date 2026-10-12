import type { Geometry, Point } from "../../shared/types";
import { HttpError } from "./errors";
export function validPoint(value: unknown): value is Point {
  const p = value as Point | undefined;
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
}
export function validateGeometry(value: unknown): asserts value is Geometry {
  const geometry = value as Geometry;
  if (!geometry || geometry.type !== "LineString" || !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2 || geometry.coordinates.length > 12000 ||
    !geometry.coordinates.every(p => Array.isArray(p) && p.length === 2 && validPoint({ lng: p[0], lat: p[1] }))) {
     throw new HttpError(400, "A valid route geometry is required.");
  }
}
