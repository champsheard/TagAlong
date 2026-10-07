import type { Geometry, Point } from "./types";

export const asPoint = ([lng, lat]: number[]): Point => ({ lat, lng });
export function distance(a: Point, b: Point) {
  const radians = Math.PI / 180;
  const x = (b.lng - a.lng) * radians * Math.cos((a.lat + b.lat) / 2 * radians);
  const y = (b.lat - a.lat) * radians;
  return Math.hypot(x, y) * 6371000;
}
export function routeLength(geometry: Geometry) {
  return geometry.coordinates.slice(1).reduce((sum, p, i) =>
    sum + distance(asPoint(geometry.coordinates[i]), asPoint(p)), 0);
}
export function pointAlong(geometry: Geometry, fraction: number): Point {
  let remaining = Math.max(0, Math.min(1, fraction)) * routeLength(geometry);
  for (let i = 1; i < geometry.coordinates.length; i++) {
    const a = asPoint(geometry.coordinates[i - 1]), b = asPoint(geometry.coordinates[i]);
    const length = distance(a, b);
    if (remaining <= length) {
      const t = length ? remaining / length : 0;
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
    remaining -= length;
  }
  return asPoint(geometry.coordinates[geometry.coordinates.length - 1]);
}
export function distanceToSegment(p: Point, a: Point, b: Point) {
  const scale = Math.cos(p.lat * Math.PI / 180);
  const ax = (a.lng - p.lng) * scale, ay = a.lat - p.lat;
  const bx = (b.lng - p.lng) * scale, by = b.lat - p.lat;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx, ay + t * dy) * 111195;
}
export function distanceToRoute(p: Point, geometry: Geometry) {
  let min = Infinity;
  for (let i = 1; i < geometry.coordinates.length; i++) {
    min = Math.min(min, distanceToSegment(p, asPoint(geometry.coordinates[i - 1]), asPoint(geometry.coordinates[i])));
  }
  return min;
}
