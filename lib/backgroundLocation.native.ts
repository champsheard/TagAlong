import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { ApiError, api } from "./api";
import { readTrip } from "./tripStorage";
import type { Position } from "../shared/types";

const taskName = "safe-walk-background-location";
const stopAlertCategory = "safe-walk-remote-stop";
type RemoteStopNotificationState = { dueAt?: number; notificationId?: string };

async function syncRemoteStopNotification(trip: Awaited<ReturnType<typeof readTrip>>, dueAt: number | null) {
  if (!trip || trip.travelMode !== "driving") return;
  const key = `remote-stop-notification:${trip.tripId}`;
  let previous: RemoteStopNotificationState | null = null;
  try {
    const saved = await SecureStore.getItemAsync(key);
    if (saved) previous = JSON.parse(saved) as RemoteStopNotificationState;
  } catch {}

  if (dueAt === null) {
    if (previous?.notificationId) {
      try { await Notifications.dismissNotificationAsync(previous.notificationId); } catch {}
    }
    try { await SecureStore.deleteItemAsync(key); } catch {}
    return;
  }
  if (previous?.dueAt === dueAt) return;
  if (previous?.notificationId) {
    try { await Notifications.dismissNotificationAsync(previous.notificationId); } catch {}
  }
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Tagalong remote-stop warning",
        body: "If app contacts are receiving this drive, they’ll be warned soon. Tap “Cancel warning” if this stop is expected.",
        categoryIdentifier: stopAlertCategory,
        sound: "default",
        data: { kind: "safe-walk-remote-stop-cancel", tripId: trip.tripId },
      },
      trigger: null,
    });
    await SecureStore.setItemAsync(key, JSON.stringify({ dueAt, notificationId }));
  } catch {
    // A local notification failure must not interrupt background location updates.
  }
}

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
    const response = await api.location(trip, position);
    await syncRemoteStopNotification(trip, response.remoteStopAlertDueAt);
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
        notificationTitle: "Tagalong is sharing your trip",
        notificationBody: "Location updates are active until you end this trip.",
        killServiceOnDestroy: true,
      },
    } : {}),
  });
  return true;
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  try {
    const trip = await readTrip();
    if (trip) await syncRemoteStopNotification(trip, null);
  } catch {}
  try {
    if (await Location.hasStartedLocationUpdatesAsync(taskName)) {
      await Location.stopLocationUpdatesAsync(taskName);
    }
  } catch {
    // A task may already have stopped while the app was being closed or restored.
  }
}
