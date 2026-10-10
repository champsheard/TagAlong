import type { AutoShareResult } from "../shared/contacts";
import type { TripCredentials } from "../shared/types";

export async function autoShareTrip(_trip: TripCredentials, _shouldContinue: () => boolean = () => true): Promise<AutoShareResult> {
  if (_trip.demo) return { status: "demo" };
  return { status: "unsupported" };
}
