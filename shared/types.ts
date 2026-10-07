export type Point = { lat: number; lng: number };
export type Geometry = { type: "LineString"; coordinates: [number, number][] };
export type Place = Point & { label: string };
export type LightBreakdown = {
  lampsPer100m: number; activityCount: number; litShare: number;
  limitedData: boolean; unavailable: boolean; simulated?: boolean;
  reason: string;
};
export type RouteOption = {
  id: string; geometry: Geometry; distanceMeters: number; durationSeconds: number;
  lightScore: number | null; lightBreakdown: LightBreakdown;
  label: "Fastest" | "Best lit";
};
export type RouteResult = { routes: RouteOption[]; notices: string[]; demo: boolean };
export type Position = Point & { accuracy: number | null; timestamp: number };
export type TripStatus = "active" | "arrived" | "help";
export type TrackingData = {
  status: TripStatus; lastLocation: Position | null; lastUpdateAt: number | null;
  route: Geometry; etaAt: number; startedAt: number; expiresAt: number; demo: boolean;
};
export type TripCredentials = {
  tripId: string; shareCode: string; writeToken: string;
  etaAt: number; expiresAt: number; demo: boolean; pendingEnd?: "arrived" | "help";
  routeLabel?: RouteOption["label"];
};
