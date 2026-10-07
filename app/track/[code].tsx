import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import MapView from "../../components/MapView";
import { BrandHeader, Eyebrow, Notice, SectionTitle } from "../../components/WalkUI";
import { common, palette } from "../../constants/theme";
import { useTracking } from "../../hooks/useTracking";

const minutes = (at: number, now: number) => Math.max(0, Math.ceil((at - now) / 60000));
const elapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
};

export default function TrackTrip() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code ?? "";
  const tracking = useTracking(code);
  const data = tracking.data;
  const first = data?.route.coordinates[0];
  const center = useMemo(() => data?.lastLocation
    ? { lat: data.lastLocation.lat, lng: data.lastLocation.lng }
    : first ? { lat: first[1], lng: first[0] } : { lat: 37.7749, lng: -122.4194 },
  [data?.lastLocation?.lat, data?.lastLocation?.lng, first?.[0], first?.[1]]);
  const mapRoutes = useMemo(() => data ? [{ id: "trip-route", geometry: data.route, color: data.status === "help" ? palette.red : "#567236" }] : [], [data?.route, data?.status]);
  const mapMarkers = useMemo(() => data?.lastLocation
    ? [{ lat: data.lastLocation.lat, lng: data.lastLocation.lng, label: "Last location" }] : [],
  [data?.lastLocation?.lat, data?.lastLocation?.lng]);

  if (!code) return <View style={common.page}><ScrollView contentContainerStyle={common.content}><BrandHeader /><Notice tone="warning">This tracking link is incomplete. Ask your contact to send you the full link.</Notice></ScrollView></View>;

  if (tracking.expired) return <View style={common.page}><ScrollView contentContainerStyle={common.content}>
    <BrandHeader />
    <View style={s.expiredMark}><Text style={s.expiredMarkText}>—</Text></View>
    <SectionTitle eyebrow="Private trip link" title="This link is no longer active." subtitle="The trip may have ended, or this private link may be invalid. Ask the person walking to share a current link." />
    <View style={s.privacy}><Text style={s.privacyTitle}>Your privacy matters</Text><Text style={s.copy}>Safe Walk only shows a live trip while sharing is active. There is no account or sign-in for a contact to use this page.</Text></View>
  </ScrollView></View>;

  if (!data && tracking.loading) return <View style={[common.page, s.center]}><View style={s.skeleton}><View style={s.skeletonLine} /><View style={[s.skeletonLine, { width: "60%" }]} /><View style={s.skeletonMap} /></View><Text style={s.loading}>Opening the private trip link…</Text></View>;
  if (!data) return <View style={common.page}><ScrollView contentContainerStyle={common.content}><BrandHeader />
    <SectionTitle eyebrow="Private trip link" title="We can’t reach this trip yet." subtitle="Check your connection. This page will keep trying to refresh automatically." />
    {tracking.error ? <Notice tone="warning">{tracking.error}</Notice> : null}
    <View style={{ marginTop: 15 }}><Notice>Location appears only while the person walking has sharing active and Safe Walk open in the foreground.</Notice></View>
  </ScrollView></View>;

  const waitingTooLong = data.status === "active" && tracking.now - (data.lastUpdateAt ?? data.startedAt) >= 120000;
  const statusTitle = data.status === "help" ? "Your contact needs help." : data.status === "arrived" ? "Your contact has arrived." : "Your contact is on the way.";
  return <ScrollView style={common.page} contentContainerStyle={common.content}>
    <BrandHeader label="Safe Walk · Trip update" />
    {data.demo ? <View style={s.demoBanner}><Text style={s.demoText}>DEMO WALK · Location movement is simulated, not a real walker.</Text></View> : null}
    {data.status === "help" ? <Notice tone="danger">Your contact flagged that they need help. This page does not call emergency services. If you believe someone is in immediate danger, contact 911.</Notice> :
      data.status === "arrived" ? <Notice>The trip has ended. Live location sharing is stopped.</Notice> :
        waitingTooLong ? <Notice tone="warning">No location update for {elapsed(tracking.now - (data.lastUpdateAt ?? data.startedAt))}. This may be an older location; try contacting your walker directly.</Notice> :
          !data.lastLocation ? <Notice>Waiting for the first location update. Keep this page open; it refreshes automatically.</Notice> :
            <Notice>Trip active · location updates while Safe Walk is open in the foreground.</Notice>}
    {tracking.error && data.status === "active" ? <View style={{ marginTop: 11 }}><Notice tone="warning">Couldn’t refresh just now. Showing the last location received. {tracking.error}</Notice></View> : null}
    <View style={s.titleBlock}><Eyebrow>LIVE TRIP STATUS</Eyebrow><Text style={s.title}>{statusTitle}</Text>
      {data.status === "active" ? <Text style={s.subtitle}>Estimated arrival in about {minutes(data.etaAt, tracking.now)} minutes.</Text> :
        data.status === "arrived" ? <Text style={s.subtitle}>Sharing stopped when the trip ended.</Text> :
          <Text style={s.subtitle}>Please contact your walker directly if you can.</Text>}
    </View>
    <View style={s.mapFrame}>
      <MapView center={center} routes={mapRoutes} markers={mapMarkers} livePosition={data.lastLocation} />
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
    <View style={s.infoCard}>
      <Text style={s.infoTitle}>A note for trusted contacts</Text>
      <Text style={s.copy}>Location updates only while Safe Walk is open in the foreground. A missing or older update does not tell you why. Safe Walk is not a safety guarantee.</Text>
      {data.status === "help" ? <Text style={[s.copy, { color: palette.red, fontWeight: "800", marginTop: 9 }]}>Safe Walk does not call 911. Call emergency services yourself if needed.</Text> : null}
    </View>
    <Text style={s.footer}>This private link can be viewed by anyone who has it.</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loading: { color: palette.evergreen, fontSize: 16, fontWeight: "800", marginTop: 20 },
  skeleton: { width: "100%", maxWidth: 580, padding: 18, borderRadius: 20, backgroundColor: palette.paper },
  skeletonLine: { width: "78%", height: 19, borderRadius: 8, backgroundColor: "#E2E6DA", marginBottom: 12 },
  skeletonMap: { height: 230, borderRadius: 16, backgroundColor: "#E2E6DA", marginTop: 12 },
  expiredMark: { width: 62, height: 62, borderRadius: 22, backgroundColor: palette.amberBg, alignItems: "center", justifyContent: "center", marginTop: 34, marginBottom: 20 },
  expiredMarkText: { color: palette.amber, fontSize: 30, fontWeight: "900" },
  privacy: { ...common.card, marginTop: 20 },
  privacyTitle: { color: palette.evergreen, fontSize: 17, fontWeight: "900", marginBottom: 6 },
  copy: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  demoBanner: { backgroundColor: palette.amberBg, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  demoText: { color: palette.amber, fontSize: 11, lineHeight: 16, fontWeight: "900", letterSpacing: 0.65 },
  titleBlock: { marginTop: 22, marginBottom: 14 },
  title: { color: palette.evergreen, fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: palette.muted, fontSize: 16, lineHeight: 23, marginTop: 6 },
  mapFrame: { height: 320, overflow: "hidden", borderRadius: 20, backgroundColor: "#DFE5D6" },
  mapCaption: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  updateCard: { flexDirection: "row", alignItems: "center", backgroundColor: palette.paper, borderRadius: 16, borderWidth: 1, borderColor: palette.line, padding: 15, marginTop: 16, gap: 12 },
  statusDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#628348" },
  helpDot: { backgroundColor: palette.red },
  arrivedDot: { backgroundColor: palette.citronDark },
  staleDot: { backgroundColor: "#B27718" },
  updateCopy: { flex: 1 },
  updateTitle: { color: palette.evergreen, fontSize: 15, fontWeight: "900" },
  updateText: { color: palette.muted, fontSize: 14, marginTop: 3 },
  accuracy: { color: palette.muted, fontSize: 12, marginTop: 4 },
  refresh: { color: palette.citronDark, fontSize: 9, lineHeight: 13, fontWeight: "900", textAlign: "right", letterSpacing: 0.7 },
  infoCard: { backgroundColor: palette.paleGreen, borderRadius: 16, padding: 16, marginTop: 16 },
  infoTitle: { color: palette.evergreen, fontSize: 16, fontWeight: "900", marginBottom: 6 },
  footer: { color: palette.muted, textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 18 },
});
