import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { parseWidgetState } from "./widgetState";
import { updateTrackingWidget } from "./trackingWidget";
TaskManager.defineTask("safe-walk-widget-updates", async ({ data, error }) => {
  if (error) return;
  const payload = data as any;
  let raw = payload?.notification?.request?.content?.data ?? payload?.notification?.data ?? payload?.data ?? payload;
  if (typeof raw?.body === "string") { try { raw = JSON.parse(raw.body); } catch { return; } }
  const state = parseWidgetState(raw);
  if (state) await updateTrackingWidget(state);
});
if (Constants.executionEnvironment !== "storeClient") {
  Notifications.addNotificationReceivedListener(notification => {
    const state = parseWidgetState(notification.request.content.data);
    if (state) updateTrackingWidget(state).catch(() => {});
  });
}
