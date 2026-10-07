import { Platform, Share } from "react-native";
import type { Geometry, Place, Point, Position, RouteResult, TrackingData, TripCredentials } from "../shared/types";
import type { ContactMatch, ContactsConfig, IdentifierKind, InstallationProfile, InstallationSession, ReceivedTrip } from "../shared/contacts";

const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
// Web is served with /api on the same origin, including the development proxy.
const base = Platform.OS === "web" ? "" : configured;
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
async function request<T>(path: string, method = "GET", body?: unknown, token?: string, extraHeaders?: Record<string, string>): Promise<T> {
  if (Platform.OS !== "web" && !base) throw new ApiError("Set EXPO_PUBLIC_API_URL to your API's HTTPS origin to use the native app.", 0);
  let response: Response;
  try {
    response = await fetch(`${base ?? ""}/api${path}`, {
      method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(50000),
    });
  } catch {
    throw new ApiError("Couldn't reach Safe Walk. Check your connection and try again.", 0);
  }
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.error ?? "Something went wrong. Please try again.", response.status, result.code);
  return result as T;
}
export const api = {
  config: () => request<ContactsConfig & { routingAvailable: boolean }>("/config"),
  geocode: (query: string) => request<Place[]>(`/geocode?q=${encodeURIComponent(query)}`),
  routes: (from: Point, to: Point) => request<RouteResult>("/routes", "POST", { from, to }),
  demo: () => request<RouteResult & { from: Place; to: Place }>("/demo"),
  createTrip: (routeGeometry: Geometry, etaSeconds: number, demo: boolean) =>
    request<Omit<TripCredentials, "demo">>("/trips", "POST", { routeGeometry, etaSeconds, demo }),
  location: (trip: TripCredentials, position: Position) =>
    request<{ ok: boolean }>(`/trips/${trip.tripId}/location`, "POST", position, trip.writeToken),
  end: (trip: TripCredentials, status: "arrived" | "help") =>
    request<{ ok: boolean }>(`/trips/${trip.tripId}/end`, "POST", { status }, trip.writeToken),
  track: (code: string) => request<TrackingData>(`/track/${encodeURIComponent(code)}`),
  enroll: (platform: string) => request<InstallationSession>("/installations", "POST", { platform }),
  profile: (s: InstallationSession) => request<InstallationProfile>("/installations/me", "GET", undefined, s.authToken),
  verify: (s: InstallationSession, kind: IdentifierKind, identifier: string, country: string) =>
    request<{ challengeId: string; expiresAt: number }>("/installations/verify", "POST", { kind, identifier, country }, s.authToken),
  confirm: (s: InstallationSession, challengeId: string, code: string) =>
    request<InstallationProfile>("/installations/confirm", "POST", { challengeId, code }, s.authToken),
  discover: (s: InstallationSession, hashes: string[]) => request<{ matches: ContactMatch[] }>("/contacts/discover", "POST", { hashes }, s.authToken),
  updateProfile: (s: InstallationSession, body: { pushToken?: string | null; pushStartToken?: string | null; discoverable?: boolean }) =>
    request<InstallationProfile>("/installations/me", "PATCH", body, s.authToken),
  forget: (s: InstallationSession) => request<{ ok: boolean }>("/installations/me", "DELETE", undefined, s.authToken),
  inbox: (s: InstallationSession) => request<{ trips: ReceivedTrip[] }>("/inbox", "GET", undefined, s.authToken),
  shareToContact: (s: InstallationSession, trip: TripCredentials, installationIds: string[]) =>
    request<{ sharedCount: number; notificationsQueued: number }>(`/trips/${trip.tripId}/share`, "POST", { installationIds }, s.authToken, { "X-Trip-Token": trip.writeToken }),
  widget: (s: InstallationSession, code: string, activityId: string, pushToken: string) =>
    request<{ ok: boolean; remoteUpdatesAvailable: boolean }>(`/track/${encodeURIComponent(code)}/widget`, "POST", { activityId, pushToken }, s.authToken),
  removeWidget: (s: InstallationSession, code: string, activityId: string) =>
    request<{ ok: boolean }>(`/track/${encodeURIComponent(code)}/widget`, "DELETE", { activityId }, s.authToken),
};
export function tripLink(code: string) {
  const origin = Platform.OS === "web" ? window.location.origin : configured;
  if (!origin) throw new Error("The API origin is not configured.");
  return `${origin.replace(/\/$/, "")}/track/${code}`;
}
export async function shareTripLink(code: string): Promise<string> {
  const url = tripLink(code);
  if (Platform.OS !== "web") {
    await Share.share({ message: `Follow my Safe Walk trip: ${url}`, url });
    return "Share the private link with one trusted contact.";
  }
  if (navigator.share) {
    try { await navigator.share({ title: "Follow my Safe Walk", text: "Follow my walking trip live.", url }); return "Share the private link with one trusted contact."; }
    catch (error) { if ((error as Error).name === "AbortError") return "Sharing cancelled. You can share the link again."; }
  }
  try { await navigator.clipboard.writeText(url); return "Private tracking link copied. Send it to one trusted contact."; }
  catch { return "Copy the private tracking link shown below and send it to one trusted contact."; }
}
