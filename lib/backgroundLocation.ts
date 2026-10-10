export type BackgroundPermissionState = "granted" | "denied" | "unavailable";

// Background location is only available in the native iOS and Android apps.
export async function requestBackgroundLocationPermission(): Promise<BackgroundPermissionState> {
  return "unavailable";
}

export async function startBackgroundLocationUpdates(): Promise<boolean> {
  return false;
}

export async function stopBackgroundLocationUpdates(): Promise<void> {}
