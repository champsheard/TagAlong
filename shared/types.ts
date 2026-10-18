export type Point = { lat: number; lng: number };
export type TravelMode = "walking" | "driving";
export type RouteProvider = "OpenRouteService" | "GraphHopper";
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
  label: "Fastest" | "Safest" | "Alternative";
  streetNames?: string[];
};
export type RouteResult = { routes: RouteOption[]; notices: string[]; demo: boolean; travelMode: TravelMode; provider?: RouteProvider };
export type Position = Point & { accuracy: number | null; timestamp: number };
export type TripStatus = "active" | "arrived" | "help";
export type TrackingData = {
  status: TripStatus; lastLocation: Position | null; lastUpdateAt: number | null;
  route: Geometry; etaAt: number; startedAt: number; expiresAt: number; demo: boolean; travelMode: TravelMode;
  routeProvider?: RouteProvider;
  remoteStopAlertDueAt?: number | null;
  remoteStopAlertAt?: number | null;
  remoteStopAlertClearedAt?: number | null;
};
export type TripCredentials = {
  tripId: string; shareCode: string; writeToken: string;
  etaAt: number; expiresAt: number; demo: boolean; travelMode: TravelMode; pendingEnd?: "arrived" | "help";
  routeProvider?: RouteProvider;
  routeLabel?: RouteOption["label"];
};
export type ArrivalFeedbackReport = {
  streetOrBlock: string;
  lightingRating: number;
  notes?: string;
};
export type ArrivalFeedbackPayload = {
  routeRating: number;
  reports: ArrivalFeedbackReport[];
};
