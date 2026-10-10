import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { ApiError, api } from "./api";
import { readTrip } from "./tripStorage";
import type { Position } from "../shared/types";

const taskName = "safe-walk-background-location";

TaskManager.defineTask(taskName, async ({ data, error }) => {
  if (error) return;
  const updates = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const location = updates?.[updates.length - 1];
  if (!location || AppState.currentState === "active") return;

  try {
    const trip = await readTrip();
    if (!trip || trip.demo || trip.pendingEnd || trip.expiresAt <= Date.now()) {
      await stopBackgroundLocationUpdates();
      return;
    }

    const position: Position = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    };
    await api.location(trip, position);
  } catch (cause) {
    if (cause instanceof ApiError && (cause.status === 404 || cause.status === 409)) {
      await stopBackgroundLocationUpdates();
    }
  }
});

export async function requestBackgroundLocationPermission(): Promise<"granted" | "denied" | "unavailable"> {
  try {
    if (!await Location.isBackgroundLocationAvailableAsync()) return "unavailable";
    let permission = await Location.getBackgroundPermissionsAsync();
    if (permission.status !== "granted") {
      if (!permission.canAskAgain) return "denied";
      permission = await Location.requestBackgroundPermissionsAsync();
    }
    return permission.status === "granted" ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

export async function startBackgroundLocationUpdates(): Promise<boolean> {
  if (!await Location.isBackgroundLocationAvailableAsync()) return false;
  const permission = await Location.getBackgroundPermissionsAsync();
  if (permission.status !== "granted") return false;
  if (await Location.hasStartedLocationUpdatesAsync(taskName)) return true;

  await Location.startLocationUpdatesAsync(taskName, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 5,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    ...(Platform.OS === "android" ? {
      foregroundService: {
        notificationTitle: "Safe Walk is sharing your walk",
        notificationBody: "Location updates are active until you end this walk.",
        killServiceOnDestroy: true,
      },
    } : {}),
  });
  return true;
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(taskName)) {
      await Location.stopLocationUpdatesAsync(taskName);
    }
  } catch {
    // A task may already have stopped while the app was being closed or restored.
  }
}
