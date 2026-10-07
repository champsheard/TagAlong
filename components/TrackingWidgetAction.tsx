import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { ActionButton, Notice } from "./WalkUI";
import { startTrackingWidget, updateTrackingWidget, widgetsSupported } from "../lib/trackingWidget";
import type { TrackingData } from "../shared/types";
export default function TrackingWidgetAction({ code, data }: { code: string; data: TrackingData }) {
  const [notice, setNotice] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const state = { shareCode: code, status: data.status, etaAt: data.etaAt, lastUpdateAt: data.lastUpdateAt, expiresAt: data.expiresAt, demo: data.demo };
  useEffect(() => {
    updateTrackingWidget(state).catch(e => setError(e instanceof Error ? e.message : "Widget update failed. Open the tracking map."));
  }, [code, data.status, data.etaAt, data.lastUpdateAt, data.expiresAt]);
  if (Platform.OS === "web") return null;
  return <View style={{ gap: 8, marginBottom: 12 }}>
    <ActionButton title={Platform.OS === "ios" ? "Add lock-screen Live Activity" : "Show on home-screen widget"} secondary disabled={!widgetsSupported} loading={busy}
      onPress={async () => { setBusy(true); setError(""); try { setNotice(await startTrackingWidget(state)); } catch (e) { setError(e instanceof Error ? e.message : "Could not add widget."); } finally { setBusy(false); } }} />
    {!widgetsSupported ? <Notice>Widgets need a native development or store build, not Expo Go.</Notice> : null}
    {notice ? <Notice>{notice}</Notice> : null}{error ? <Notice tone="warning">{error}</Notice> : null}
  </View>;
}
