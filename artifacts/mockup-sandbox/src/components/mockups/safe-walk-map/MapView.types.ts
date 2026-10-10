type Geometry = { type: "LineString"; coordinates: [number, number][] };
type Point = { lat: number; lng: number };

export interface MapViewProps {
  center: Point;
  routes?: { id: string; geometry: Geometry; color: string }[];
  markers?: (Point & { label: string })[];
  livePosition?: Point | null;
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  attributionBottom?: number;
}
