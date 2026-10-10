import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView from "../../components/MapView";
import MapContextPill from "../../components/MapContextPill";
import { BrandHeader, Eyebrow, Notice, SectionTitle } from "../../components/WalkUI";
import { common, palette } from "../../constants/theme";
import { useTracking } from "../../hooks/useTracking";
import TrackingWidgetAction from "../../components/TrackingWidgetAction";
import { updateTrackingWidget } from "../../lib/trackingWidget";

const minutes = (at: number, now: number) => Math.max(0, Math.ceil((at - now) / 60000));
const elapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
};

export default function TrackTrip() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code ?? "";
  const router = useRouter();
  const leaveLiveView = () => router.canGoBack() ? router.back() : router.replace("/");
  const tracking = useTracking(code);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const data = tracking.data;
  useEffect(() => {
    if (tracking.expired) updateTrackingWidget({ shareCode: code, status: "expired", etaAt: data?.etaAt ?? Date.now(), lastUpdateAt: data?.lastUpdateAt ?? null, expiresAt: Date.now(), demo: !!data?.demo }).catch(() => {});
  }, [code, tracking.expired]);
  const first = data?.route.coordinates[0];
  const center = useMemo(() => data?.lastLocation
    ? { lat: data.lastLocation.lat, lng: data.lastLocation.lng }
    : first ? { lat: first[1], lng: first[0] } : { lat: 37.7749, lng: -122.4194 },
  [data?.lastLocation?.lat, data?.lastLocation?.lng, first?.[0], first?.[1]]);
  const mapRoutes = useMemo(() => data ? [{ id: "trip-route", geometry: data.route, color: data.status === "help" ? palette.red : "#567236" }] : [], [data?.route, data?.status]);
  const mapMarkers = useMemo(() => {
    const coordinates = data?.route.coordinates;
    if (!coordinates?.length) return [];
    const [startLng, startLat] = coordinates[0];
    const [destinationLng, destinationLat] = coordinates[coordinates.length - 1];
    return [
      { lat: startLat, lng: startLng, label: "Start" },
      { lat: destinationLat, lng: destinationLng, label: "Destination" },
    ];
  }, [data?.route]);
  const panelHeight = height * 0.49;

  if (!code) return <View style={common.page}><ScrollView contentContainerStyle={common.content}><BackToSafeWalk onPress={leaveLiveView} /><BrandHeader /><Notice tone="warning">This tracking link is incomplete. Ask your contact to send you the full link.</Notice></ScrollView></View>;

  if (tracking.expired) return <View style={common.page}><ScrollView contentContainerStyle={common.content}>
    <BackToSafeWalk onPress={leaveLiveView} />
    <BrandHeader />
    <View style={s.expiredMark}><Text style={s.expiredMarkText}>—</Text></View>
    <SectionTitle eyebrow="Private trip link" title="This link is no longer active." subtitle="The trip may have ended, or this private link may be invalid. Ask the person walking to share a current link." />
    <View style={s.privacy}><Text style={s.privacyTitle}>Your privacy matters</Text><Text style={s.copy}>Safe Walk only shows a live trip while sharing is active. There is no account or sign-in for a contact to use this page.</Text></View>
  </ScrollView></View>;

  if (!data && tracking.loading) return <View style={[common.page, s.center]}>
    <View style={{ width: "100%", maxWidth: 580 }}>
      <BackToSafeWalk onPress={leaveLiveView} />
      <View style={s.skeleton}><View style={s.skeletonLine} /><View style={[s.skeletonLine, { width: "60%" }]} /><View style={s.skeletonMap} /></View>
      <Text style={s.loading}>Opening the private trip link…</Text>
    </View>
  </View>;
  if (!data) return <View style={common.page}><ScrollView contentContainerStyle={common.content}><BackToSafeWalk onPress={leaveLiveView} /><BrandHeader />
    <SectionTitle eyebrow="Private trip link" title="We can’t reach this trip yet." subtitle="Check your connection. This page will keep trying to refresh automatically." />
    {tracking.error ? <Notice tone="warning">{tracking.error}</Notice> : null}
    <View style={{ marginTop: 15 }}><Notice>Location appears only while the person walking has sharing active and Safe Walk open in the foreground.</Notice></View>
  </ScrollView></View>;

  const waitingTooLong = data.status === "active" && tracking.now - (data.lastUpdateAt ?? data.startedAt) >= 120000;
  const mapContextLabel = data.demo
    ? "DEMO WALK · SIMULATED LOCATION"
    : data.lastLocation
      ? waitingTooLong ? "LAST LOCATION · MAY BE OLD" : "LAST SHARED LOCATION"
      : "ROUTE ONLY · WAITING FOR LOCATION";
  const statusTitle = data.status === "help" ? "Your contact needs help." : data.status === "arrived" ? "Your contact has arrived." : "Your contact is on the way.";
  return <View style={s.screen}>
    <View style={StyleSheet.absoluteFill}>
      <MapView center={center} routes={mapRoutes} markers={mapMarkers} livePosition={data.lastLocation} livePositionLabel="Walker's most recently shared location"
        fitPadding={{ top: insets.top + 86, right: 30, bottom: panelHeight + 12, left: 30 }}
        attributionBottom={panelHeight + 7} />
    </View>
    <View style={[s.topBar, { paddingTop: insets.top + 9 }]}>
      <View style={s.brandPill}><View style={s.brandDot} /><Text style={s.brandName}>SAFE WALK</Text><Text style={s.topDivider}>/</Text><Text style={s.topLabel}>PRIVATE TRIP</Text></View>
      <View style={[s.liveBadge, data.status === "help" && s.helpBadge, data.status === "arrived" && s.arrivedBadge]}>
        <View style={[s.statusDot, data.status === "help" ? s.helpDot : data.status === "arrived" ? s.arrivedDot : waitingTooLong ? s.staleDot : null]} />
        <Text style={s.liveBadgeText}>{data.status === "active" ? waitingTooLong ? "OLDER UPDATE" : "LIVE" : data.status === "help" ? "HELP" : "ENDED"}</Text>
      </View>
    </View>
    <MapContextPill label={mapContextLabel} top={insets.top + 64} tone={data.demo ? "demo" : waitingTooLong ? "warning" : "default"} />
    <View style={s.panelDock}>
      <View style={[s.panel, { height: panelHeight, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.panelContent}>
          <BackToSafeWalk onPress={leaveLiveView} />
          {data.status === "help" ? <Notice tone="danger">Your contact flagged that they need help. This page does not call emergency services. If you believe someone is in immediate danger, contact 911.</Notice> :
            data.status === "arrived" ? <Notice>The trip has ended. Live location sharing is stopped.</Notice> :
              waitingTooLong ? <Notice tone="warning">No location update for {elapsed(tracking.now - (data.lastUpdateAt ?? data.startedAt))}. This may be an older location; try contacting your walker directly.</Notice> :
                !data.lastLocation ? <Notice>Waiting for the first location update. Keep this page open; it refreshes automatically.</Notice> :
                  <Notice>Trip active · location updates while Safe Walk is open in the foreground.</Notice>}
          {tracking.error && data.status === "active" ? <View style={{ marginTop: 10 }}><Notice tone="warning">Couldn’t refresh just now. Showing the last location received. {tracking.error}</Notice></View> : null}
          <View style={s.titleBlock}><Eyebrow>LIVE TRIP STATUS</Eyebrow><Text style={s.title}>{statusTitle}</Text>
            {data.status === "active" ? <Text style={s.subtitle}>Estimated arrival in about {minutes(data.etaAt, tracking.now)} minutes.</Text> :
              data.status === "arrived" ? <Text style={s.subtitle}>Sharing stopped when the trip ended.</Text> :
                <Text style={s.subtitle}>Please contact your walker directly if you can.</Text>}
          </View>
          <Text style={s.mapCaption}>{data.lastLocation ? "Showing the most recently shared location." : "The route is shown while waiting for the first location."}</Text>
          <View style={s.updateCard}>
            <View style={[s.statusDot, data.status === "help" ? s.helpDot : data.status === "arrived" ? s.arrivedDot : waitingTooLong ? s.staleDot : null]} />
            <View style={s.updateCopy}>
              <Text style={s.updateTitle}>{data.lastUpdateAt ? "Last location update" : "Location update"}</Text>
              <Text style={s.updateText}>{data.lastUpdateAt ? `${elapsed(tracking.now - data.lastUpdateAt)} ago` : "Waiting for the first location"}</Text>
              {data.lastLocation?.accuracy != null ? <Text style={s.accuracy}>Approx. accuracy ±{Math.round(data.lastLocation.accuracy)} m</Text> : null}
            </View>
            <Text style={s.refresh}>AUTO{"\n"}REFRESH</Text>
          </View>
          <TrackingWidgetAction code={code} data={data} />
          <View style={s.infoCard}>
            <Text style={s.infoTitle}>A note for trusted contacts</Text>
            <Text style={s.copy}>Location updates only while Safe Walk is open in the foreground. A missing or older update does not tell you why. Safe Walk is not a safety guarantee.</Text>
            {data.status === "help" ? <Text style={[s.copy, { color: palette.red, fontWeight: "800", marginTop: 9 }]}>Safe Walk does not call 911. Call emergency services yourself if needed.</Text> : null}
          </View>
          <Text style={s.footer}>This private link can be viewed by anyone who has it.</Text>
        </ScrollView>
      </View>
    </View>
  </View>;
}

function BackToSafeWalk({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Back to Safe Walk"
    onPress={onPress} style={s.exitButton}>
    <Text style={s.exitText}>‹  Back to Safe Walk</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.oat },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loading: { color: palette.evergreen, fontSize: 16, fontWeight: "800", marginTop: 20 },
  skeleton: { width: "100%", maxWidth: 580, padding: 18, borderRadius: 20, backgroundColor: palette.paper },
  skeletonLine: { width: "78%", height: 19, borderRadius: 8, backgroundColor: "#E2E6DA", marginBottom: 12 },
  skeletonMap: { height: 230, borderRadius: 16, backgroundColor: "#E2E6DA", marginTop: 12 },
  expiredMark: { width: 62, height: 62, borderRadius: 22, backgroundColor: palette.amberBg, alignItems: "center", justifyContent: "center", marginTop: 34, marginBottom: 20 },
  expiredMarkText: { color: palette.amber, fontSize: 30, fontWeight: "900" },
  privacy: { ...common.card, marginTop: 20 },
  copy: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  privacyTitle: { color: palette.evergreen, fontSize: 17, fontWeight: "900", marginBottom: 6 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingHorizontal: 15, paddingBottom: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandPill: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: palette.paper, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderColor: palette.line },
  brandDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: palette.citronDark },
  brandName: { color: palette.evergreen, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  topDivider: { color: palette.line, fontSize: 14 },
  topLabel: { color: palette.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  liveBadge: { backgroundColor: palette.paleGreen, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  helpBadge: { backgroundColor: palette.redBg },
  arrivedBadge: { backgroundColor: palette.amberBg },
  liveBadgeText: { color: palette.evergreen, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  demoBanner: { position: "absolute", zIndex: 2, alignSelf: "center", maxWidth: 440, backgroundColor: palette.amberBg, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  demoText: { color: palette.amber, fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 0.45 },
  panelDock: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", zIndex: 2 },
  panel: { width: "100%", maxWidth: 600, backgroundColor: palette.paper, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 17, paddingTop: 10, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.line, shadowColor: palette.evergreen, shadowOpacity: 0.13, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 9 },
  grabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 3, backgroundColor: "#C7CEBC", marginBottom: 13 },
  panelContent: { paddingBottom: 4 },
  exitButton: { alignSelf: "flex-start", backgroundColor: palette.oat, borderColor: palette.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 8 },
  exitText: { color: palette.evergreen, fontSize: 13, fontWeight: "800" },
  titleBlock: { marginTop: 17, marginBottom: 5 },
  title: { color: palette.evergreen, fontSize: 27, lineHeight: 33, fontWeight: "900", letterSpacing: -0.7 },
  subtitle: { color: palette.muted, fontSize: 15, lineHeight: 22, marginTop: 5 },
  mapCaption: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  updateCard: { flexDirection: "row", alignItems: "center", backgroundColor: palette.oat, borderRadius: 14, borderWidth: 1, borderColor: palette.line, padding: 13, marginTop: 12, gap: 11 },
  statusDot: { width: 12, height: 12, borderRadius: 7, backgroundColor: "#628348" },
  helpDot: { backgroundColor: palette.red },
  arrivedDot: { backgroundColor: palette.citronDark },
  staleDot: { backgroundColor: "#B27718" },
  updateCopy: { flex: 1 },
  updateTitle: { color: palette.evergreen, fontSize: 14, fontWeight: "900" },
  updateText: { color: palette.muted, fontSize: 13, marginTop: 3 },
  accuracy: { color: palette.muted, fontSize: 11, marginTop: 4 },
  refresh: { color: palette.citronDark, fontSize: 8, lineHeight: 12, fontWeight: "900", textAlign: "right", letterSpacing: 0.6 },
  infoCard: { backgroundColor: palette.paleGreen, borderRadius: 15, padding: 14, marginTop: 12 },
  infoTitle: { color: palette.evergreen, fontSize: 15, fontWeight: "900", marginBottom: 5 },
  footer: { color: palette.muted, textAlign: "center", fontSize: 11, lineHeight: 17, marginTop: 13 },
});
