import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { ApiError, api } from "./api";
import { ensureInstallation, readInstallation } from "./installationStorage";
import { readTrip } from "./tripStorage";
import { startPushActivityListener } from "./trackingWidget";

export const nativeBuild = Constants.executionEnvironment !== "storeClient";
export async function enableDeviceNotifications() {
  if (!nativeBuild) throw new Error("App notifications need a native development or store build, not Expo Go.");
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("The native build needs its EAS project ID before push notifications can be enabled.");
  if (Device.osName === "Android") await Notifications.setNotificationChannelAsync("walks", { name: "Safe Walk trips", importance: Notifications.AndroidImportance.HIGH });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) throw new Error("Notifications are off. Enable them in phone settings, or share a link instead.");
  const session = await ensureInstallation();
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const profile = await api.updateProfile(session, { pushToken: token.data });
  await Notifications.registerTaskAsync("safe-walk-widget-updates");
  startPushActivityListener();
  return profile;
}
export function installNotificationListeners(openTrip: (code: string) => void) {
  if (!nativeBuild) return () => {};
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  void Notifications.setNotificationCategoryAsync("safe-walk-remote-stop", [{
    identifier: "cancel-remote-stop",
    buttonTitle: "Cancel warning",
    options: { opensAppToForeground: true },
  }]).catch(() => {});
  const navigate = (response: Notifications.NotificationResponse | null) => {
    const code = response?.notification.request.content.data?.shareCode;
    if (typeof code === "string" && /^[a-zA-Z0-9_-]{22,64}$/.test(code)) openTrip(code);
  };
  const respond = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    if (response?.actionIdentifier === "cancel-remote-stop" && data?.kind === "safe-walk-remote-stop-cancel" && typeof data.tripId === "string") {
      void (async () => {
        const trip = await readTrip();
        if (!trip || trip.tripId !== data.tripId) return;
        try {
          await api.cancelDriveStopAlert(trip);
          await Notifications.dismissNotificationAsync(response.notification.request.identifier);
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
          }
        }
      })().catch(() => {});
      return;
    }
    navigate(response);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(respond);
  Notifications.getLastNotificationResponseAsync().then(respond).catch(() => {});
  const tokens = Notifications.addPushTokenListener(async () => {
    const session = await readInstallation();
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.easConfig?.projectId;
    if (session && projectId) {
      try { const token = await Notifications.getExpoPushTokenAsync({ projectId }); await api.updateProfile(session, { pushToken: token.data }); } catch {}
    }
  });
  startPushActivityListener();
  return () => { subscription.remove(); tokens.remove(); };
}
