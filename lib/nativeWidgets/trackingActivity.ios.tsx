import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";
import { api } from "../api";
import { ensureInstallation, readInstallation } from "../installationStorage";
import { readWidgetState, saveWidgetState } from "../widgetStorage.native";
import type { WidgetState } from "../../shared/contacts";

function TrackingActivity(props: WidgetState, environment: LiveActivityEnvironment) {
  "widget";
  const old = environment.isStale || !props.lastUpdateAt || Date.now() - props.lastUpdateAt > 120000;
  const status = props.expiresAt <= Date.now() ? "Expired" : props.status === "help" ? "Help requested" : props.status === "arrived" ? "Arrived" : old ? "Older location" : props.travelMode === "driving" ? "Driving" : "Walking";
  const color = props.status === "help" ? "#9E3835" : "#244335";
  const eta = new Date(props.etaAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    banner: <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 16 })]}>
      <HStack spacing={12}><Text modifiers={[font({ size: 15, weight: "bold" }), foregroundStyle(color)]}>Tagalong{props.demo ? " · DEMO" : ""}</Text><Text>{status}</Text></HStack>
      <Text modifiers={[font({ size: 19, weight: "semibold" })]}>{props.status === "active" ? `ETA ${eta}` : status}</Text>
      <Text modifiers={[font({ size: 12 })]}>{props.status === "help" ? "Contact your person. No emergency call was made." : old ? "Open the map to check the last shared location." : "Tap to open the tracking map."}</Text>
    </VStack>,
    compactLeading: <Text>T</Text>, compactTrailing: <Text>{props.status === "help" ? "!" : props.status === "arrived" ? "✓" : old ? "—" : eta}</Text>,
    minimal: <Text>{props.status === "help" ? "!" : "T"}</Text>,
    expandedCenter: <VStack><Text>{status}</Text><Text>{props.status === "active" ? `ETA ${eta}` : "Location sharing stopped"}</Text></VStack>,
  };
}
const activity = createLiveActivity<WidgetState>("SafeWalkTracking", TrackingActivity);
let tokenListener: { remove(): void } | undefined;
async function registerToken(state: WidgetState, instance: ReturnType<typeof activity.start>) {
  const session = await readInstallation(); if (!session) return;
  const token = await instance.getPushToken();
  if (token) await api.widget(session, state.shareCode, instance.getId(), token);
  tokenListener?.remove();
  tokenListener = instance.addPushTokenListener(event => {
    api.widget(session, state.shareCode, event.activityId, event.pushToken).catch(() => {});
  });
}
export async function startTrackingWidget(state: WidgetState) {
  await ensureInstallation();
  const old = await readWidgetState();
  const existing = activity.getInstances().find(a => a.getId() === old?.activityId);
  if (existing) { await existing.end("immediate"); const s = await readInstallation(); if (s && old) await api.removeWidget(s, old.shareCode, existing.getId()); }
  const instance = activity.start(state, `safewalk://track/${state.shareCode}`, new Date(Math.min(state.expiresAt, Date.now() + 120000)));
  await saveWidgetState({ ...state, activityId: instance.getId() });
  await registerToken(state, instance);
  const config = await api.config();
  return config.remoteWidgetsAvailable ? "Live Activity added. Background updates depend on Apple delivery and the person's connection."
    : "Live Activity added. Server push updates aren't configured yet; it updates while this tracking screen is open and becomes stale in the background.";
}
export async function updateTrackingWidget(state: WidgetState) {
  const saved = await readWidgetState(); if (!saved || saved.shareCode !== state.shareCode) return;
  const instance = activity.getInstances().find(a => a.getId() === saved.activityId);
  if (!instance) { await saveWidgetState(null); return; }
  if (state.status === "active" && state.expiresAt > Date.now()) {
    await instance.update(state, new Date(Math.min(state.expiresAt, Date.now() + 120000)));
    await saveWidgetState({ ...state, activityId: instance.getId() });
  } else {
    await instance.end("default", state); await saveWidgetState(null); tokenListener?.remove();
    const session = await readInstallation(); if (session) await api.removeWidget(session, state.shareCode, instance.getId());
  }
}
export async function clearTrackingWidget() {
  tokenListener?.remove();
  for (const instance of activity.getInstances()) await instance.end("immediate");
  await saveWidgetState(null);
}
export function startPushActivityListener() {
  (async () => {
    const saved = await readWidgetState(); if (!saved) return;
    const instance = activity.getInstances().find(a => a.getId() === saved.activityId);
    if (instance) await registerToken(saved, instance);
  })().catch(() => {});
}
