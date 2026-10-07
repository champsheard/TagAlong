import { FlexWidget, TextWidget, registerWidgetTaskHandler, requestWidgetUpdate } from "react-native-android-widget";
import type { WidgetState } from "../../shared/contacts";
import { readWidgetState, saveWidgetState } from "../widgetStorage.native";
function TrackingWidget({ state }: { state: WidgetState | null }) {
  const expired = !!state && state.expiresAt <= Date.now();
  const stale = !state?.lastUpdateAt || Date.now() - state.lastUpdateAt > 120000;
  const status = !state ? "No walk selected" : expired ? "Tracking expired" : state.status === "help" ? "Help requested" : state.status === "arrived" ? "Arrived" : stale ? "Older location — open map" : "Active trip · snapshot";
  return <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: "#F6F3EA", borderRadius: 20, padding: 16, flexGap: 8 }}
    clickAction={state && !expired ? "OPEN_URI" : "OPEN_APP"} clickActionData={state && !expired ? { uri: `safewalk://track/${state.shareCode}` } : undefined}>
    <TextWidget text={`Safe Walk${state?.demo ? " · DEMO" : ""}`} style={{ fontSize: 14, color: "#244335", fontWeight: "bold" }} />
    <TextWidget text={status} style={{ fontSize: 20, color: state?.status === "help" ? "#9E3835" : "#244335", fontWeight: "bold" }} />
    <TextWidget text={state && !expired ? state.status === "active" ? `ETA ${new Date(state.etaAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Last fix ${state.lastUpdateAt ? new Date(state.lastUpdateAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "not received"}. Tap for latest.`
      : state.status === "help" ? "Contact your walker. No emergency call was made." : "Location sharing stopped" : "Open a tracking link to select a walk."} style={{ fontSize: 12, color: "#617066" }} />
  </FlexWidget>;
}
registerWidgetTaskHandler(async ({ renderWidget }) => { renderWidget(<TrackingWidget state={await readWidgetState()} />); });
export async function startTrackingWidget(state: WidgetState) {
  await saveWidgetState(state);
  let found = true;
  await requestWidgetUpdate({ widgetName: "SafeWalkTrackingWidget", renderWidget: () => <TrackingWidget state={state} />, widgetNotFound: () => { found = false; } });
  return found ? "Tracking widget updated. Background refresh depends on notification delivery; tap it to check the map."
    : "Walk selected. Add the Safe Walk widget using your Android home screen's Widgets menu.";
}
export async function updateTrackingWidget(state: WidgetState) {
  const saved = await readWidgetState();
  if (!saved || saved.shareCode !== state.shareCode) return;
  await saveWidgetState(state);
  await requestWidgetUpdate({ widgetName: "SafeWalkTrackingWidget", renderWidget: () => <TrackingWidget state={state} /> });
}
export async function clearTrackingWidget() {
  await saveWidgetState(null);
  await requestWidgetUpdate({ widgetName: "SafeWalkTrackingWidget", renderWidget: () => <TrackingWidget state={null} /> });
}
export function startPushActivityListener() {}
