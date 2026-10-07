import type { WidgetState } from "../shared/contacts";
export const widgetsSupported = false;
export async function startTrackingWidget(_state: WidgetState): Promise<string> { throw new Error("Live widgets are available in native iOS and Android builds, not this browser."); }
export async function updateTrackingWidget(_state: WidgetState) {}
export async function clearTrackingWidget() {}
export function startPushActivityListener() {}
