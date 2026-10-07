import Constants from "expo-constants";
import { Platform } from "react-native";
import type { WidgetState } from "../shared/contacts";
export const widgetsSupported = Constants.executionEnvironment !== "storeClient";
let adapter: typeof import("./nativeWidgets/trackingActivity") | undefined;
function nativeAdapter() {
  if (!widgetsSupported) throw new Error(`Widgets need a native ${Platform.OS} build, not Expo Go.`);
  return adapter ??= require("./nativeWidgets/trackingActivity") as typeof import("./nativeWidgets/trackingActivity");
}
// Headless Android widget events load the entry point without mounting a screen.
if (widgetsSupported && Platform.OS === "android") nativeAdapter();
export async function startTrackingWidget(state: WidgetState) { return nativeAdapter().startTrackingWidget(state); }
export async function updateTrackingWidget(state: WidgetState) { if (widgetsSupported) await nativeAdapter().updateTrackingWidget(state); }
export async function clearTrackingWidget() { if (widgetsSupported) await nativeAdapter().clearTrackingWidget(); }
export function startPushActivityListener() { if (widgetsSupported) nativeAdapter().startPushActivityListener(); }
