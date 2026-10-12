import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { TripCredentials } from "../shared/types";

const key = "safe-walk-trip";
// Store only small credentials. Route geometry is recovered via the private tracking link.
export async function saveTrip(trip: TripCredentials | null, allowBackgroundRead = false) {
  if (Platform.OS === "web") {
    if (trip) localStorage.setItem(key, JSON.stringify(trip)); else localStorage.removeItem(key);
  } else if (trip) {
    // Location tasks need the write token after the first unlock when the screen is locked.
    const options = allowBackgroundRead ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
    await SecureStore.setItemAsync(key, JSON.stringify(trip), options);
  }
  else await SecureStore.deleteItemAsync(key);
}
export async function readTrip(): Promise<TripCredentials | null> {
  const raw = Platform.OS === "web" ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    const trip = JSON.parse(raw) as TripCredentials;
    if (!trip.tripId || !trip.shareCode || !trip.writeToken || !Number.isFinite(trip.expiresAt)) return null;
    return { ...trip, travelMode: trip.travelMode === "driving" ? "driving" : "walking" };
  } catch { return null; }
}
