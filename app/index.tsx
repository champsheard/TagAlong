import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useWalk } from "../hooks/useWalk";
import MapView from "../components/MapView";
import AddressSearch from "../components/AddressSearch";
import { ActionButton, BrandHeader, Eyebrow, Notice, SectionTitle } from "../components/WalkUI";
import { common, palette } from "../constants/theme";

const formatMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));
const centerAt = (point?: { lat: number; lng: number } | null) => point ? { lat: point.lat, lng: point.lng } : { lat: 37.7749, lng: -122.4194 };
const routeColors = { fastest: "#87977F", selected: "#567236" };

export default function Index() {
  const walk = useWalk();
  const [showHelpConfirm, setShowHelpConfirm] = useState(false);
  const mapRoutes = useMemo(() => (walk.phase === "walking" && walk.trip ? [walk.trip.route] : walk.result?.routes ?? []).map(route => ({
    id: route.id, geometry: route.geometry, color: route.id === walk.selectedRoute?.id ? routeColors.selected : routeColors.fastest,
  })), [walk.result, walk.selectedRoute, walk.phase, walk.trip?.route]);
  const mapMarkers = useMemo(() => [
    ...(walk.from ? [{ lat: walk.from.lat, lng: walk.from.lng, label: "Start" }] : []),
    ...(walk.to ? [{ lat: walk.to.lat, lng: walk.to.lng, label: "Destination" }] : []),
  ], [walk.from, walk.to]);
  const firstCoord = (walk.selectedRoute ?? walk.trip?.route)?.geometry.coordinates[0];
  const mapCenter = useMemo(() => centerAt(
    walk.position ?? walk.from ?? (firstCoord ? { lat: firstCoord[1], lng: firstCoord[0] } : null),
  ), [walk.position?.lat, walk.position?.lng, walk.from?.lat, walk.from?.lng, firstCoord?.[0], firstCoord?.[1]]);
  const route = walk.selectedRoute;

  if (walk.restoring) return <View style={[common.page, s.center]}><ActivityIndicator size="large" color={palette.evergreen} /><Text style={s.loading}>Checking for an active walk…</Text></View>;

  return <ScrollView style={common.page} contentContainerStyle={common.content} keyboardShouldPersistTaps="handled">
    <BrandHeader />
    {walk.phase === "plan" ? <>
      <SectionTitle eyebrow="Plan a walk" title="A steadier way home." subtitle="Choose a destination. We’ll compare walking routes and the lighting information available." />
      {walk.routingAvailable === false ? <Notice tone="warning">Route planning is not configured on this server yet. Address search still works; try a Demo walk to explore the experience.</Notice> : null}
      <View style={[common.card, { marginTop: 18 }]}>
        <View style={s.stepLine}><View style={s.stepDot} /><Text style={s.stepCopy}>START</Text><View style={s.stepRule} /><Text style={s.stepOptional}>CURRENT LOCATION BY DEFAULT</Text></View>
        <Text style={s.fieldHint}>Use your current location, or choose a starting address.</Text>
        <ActionButton title={walk.busy ? "Finding your location…" : walk.from ? `Using ${walk.from.label}` : "Use my current location"} loading={walk.busy} onPress={walk.locateStart} secondary />
        <View style={s.orRow}><View style={s.hairline} /><Text style={s.orText}>OR SEARCH</Text><View style={s.hairline} /></View>
        <AddressSearch label="Starting point" placeholder="Search an address or place" value={walk.from} onSelect={walk.setFrom} onClear={() => walk.setFrom(null)} />
        <View style={s.destinationMark}><View style={s.destinationDot} /><Text style={s.stepCopy}>DESTINATION</Text><Text style={s.required}>REQUIRED</Text></View>
        <AddressSearch label="Where are you going?" placeholder="Search street, place, or landmark" value={walk.to} onSelect={walk.setTo} onClear={() => walk.setTo(null)} required />
        {walk.error ? <Notice tone="danger">{walk.error}</Notice> : null}
        <ActionButton title="Compare walking routes" onPress={walk.planRoutes} loading={walk.busy} disabled={!walk.to} style={{ marginTop: 14 }} />
        <Pressable accessibilityRole="button" onPress={walk.loadDemo} disabled={walk.busy} style={({ pressed }) => [s.demoLink, pressed && { opacity: 0.65 }]}>
          <Text style={s.demoLinkText}>{walk.busy ? "Loading demo…" : "Take a Demo walk instead"}</Text>
        </Pressable>
      </View>
      <Text style={s.reassurance}>You choose when to share, and when the trip ends.</Text>
    </> : null}

    {walk.phase === "routes" && walk.result ? <>
      <SectionTitle eyebrow="Your route choices" title="Two ways to get there." subtitle={`${walk.from?.label ?? "Starting point"} → ${walk.to?.label ?? "Destination"}`} />
      {walk.result.demo ? <Notice tone="warning">Demo walk · Routes, movement, and lighting scores are simulated. They do not describe real streets or real lighting.</Notice> : null}
      {!!walk.result.notices.length && walk.result.notices.map((notice, i) => <View key={i} style={{ marginTop: 10 }}><Notice>{notice}</Notice></View>)}
      <View style={s.mapFrame}><MapView center={mapCenter} routes={mapRoutes} markers={mapMarkers} livePosition={walk.position} /></View>
      <Text style={s.mapCaption}>Route lines are estimates. Lighting information may be limited.</Text>
      <View style={{ gap: 12, marginTop: 18 }}>
        {walk.result.routes.map(option => {
          const fastest = Math.min(...walk.result!.routes.map(r => r.durationSeconds));
          const extra = Math.max(0, Math.ceil((option.durationSeconds - fastest) / 60));
          const selected = option.id === route?.id;
          const score = option.lightScore;
          return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => walk.selectRoute(option.id)}
            style={({ pressed }) => [s.routeCard, selected && s.routeSelected, pressed && { opacity: 0.85 }]}>
            <View style={s.routeTop}>
              <View><Text style={s.routeName}>{option.label}</Text><Text style={s.routeSub}>{option.label === "Best lit" ? "Favors streets with more lighting data" : "The shortest estimated time"}</Text></View>
              <View style={[s.radio, selected && s.radioSelected]}>{selected ? <View style={s.radioCore} /> : null}</View>
            </View>
            <View style={s.routeMetrics}>
              <View><Text style={s.metricValue}>{formatMinutes(option.durationSeconds)}<Text style={s.metricUnit}> min</Text></Text><Text style={s.metricLabel}>ESTIMATED WALK</Text></View>
              <View style={s.metricDivider} />
              <View><Text style={s.metricValue}>{score == null ? "N/A" : `${Math.round(score)}/100`}</Text><Text style={s.metricLabel}>{score == null ? "UNAVAILABLE" : "LIGHTING ESTIMATE"}</Text></View>
              <View style={s.extraPill}><Text style={s.extraText}>+{extra} min</Text></View>
            </View>
            <Text style={s.reason}>{option.lightBreakdown.reason}</Text>
            {option.lightBreakdown.limitedData || option.lightBreakdown.unavailable ? <Text style={s.limited}>Lighting information is limited for part of this route.</Text> : null}
          </Pressable>;
        })}
      </View>
      <View style={s.disclaimer}><Text style={s.disclaimerTitle}>A note about lighting</Text><Text style={s.body}>Scores reflect available lighting data—not a guarantee that a street is lit, open, or safe right now.</Text></View>
      {!walk.result.demo ? <Pressable accessibilityRole="switch" accessibilityState={{ checked: walk.demo }} onPress={() => walk.setDemo(!walk.demo)} style={({ pressed }) => [s.simulationToggle, pressed && { opacity: 0.8 }]}>
        <View style={s.simulationCopy}><Text style={s.simulationTitle}>Demo walk</Text><Text style={s.simulationHint}>Simulate movement for 90 seconds along this route.</Text></View>
        <View style={[s.switchTrack, walk.demo && s.switchOn]}><View style={[s.switchThumb, walk.demo && s.thumbOn]} /></View>
      </Pressable> : null}
      {walk.demo && !walk.result.demo ? <View style={{ marginTop: 10 }}><Notice tone="warning">Simulated movement follows this route for 90 seconds. Route lighting data is still an estimate and not a guarantee.</Notice></View> : null}
      {walk.error ? <View style={{ marginTop: 12 }}><Notice tone="danger">{walk.error}</Notice></View> : null}
      <View style={s.buttonRow}>
        <ActionButton title="Edit trip" onPress={() => { walk.setDemo(false); walk.editPlan(); }} secondary style={{ flex: 1 }} />
        <ActionButton title="Choose this route" onPress={walk.reviewConsent} disabled={!route} style={{ flex: 1 }} />
      </View>
      <Pressable accessibilityRole="button" onPress={walk.loadDemo} style={s.textAction}><Text style={s.textActionText}>Try a simulated Demo walk</Text></Pressable>
    </> : null}

    {walk.phase === "consent" && route ? <>
      <Pressable accessibilityRole="button" onPress={walk.backToRoutes} style={s.backLink}><Text style={s.backLinkText}>‹  Back to route choices</Text></Pressable>
      <SectionTitle eyebrow="Before you set off" title="Share on your terms." subtitle="Take a moment to see exactly what happens when you start." />
      <View style={s.chosenRoute}><Eyebrow>YOUR CHOSEN ROUTE</Eyebrow><Text style={s.chosenName}>{route.label} · {formatMinutes(route.durationSeconds)} min</Text><Text style={s.body}>{walk.from?.label} → {walk.to?.label}</Text></View>
      <View style={s.consentCard}>
        <View style={s.consentIcon}><View style={s.consentRing}><View style={s.consentCore} /></View></View>
        <Text style={s.consentHeadline}>One trusted person, along for the walk.</Text>
        <Text style={s.consentExact}>Your trusted contact can see your live location until you end the trip.</Text>
        <View style={s.consentRule} />
        <Text style={s.consentLine}>Anyone holding the private link can view it. Share it only with someone you trust.</Text>
        <Text style={s.consentLine}>Sharing is active only while your trip is active. Location updates while Safe Walk is open in the foreground.</Text>
        <Text style={s.consentLine}>Safe Walk is not a safety guarantee and does not replace calling 911 in an emergency.</Text>
      </View>
      {walk.demo ? <View style={{ marginTop: 14 }}><Notice tone="warning">{walk.result?.demo ? "This is a simulated trip. The moving location and lighting scores are not real." : "Demo walk simulates your location along the chosen route. Lighting remains an estimate."}</Notice></View> : null}
      {walk.error ? <View style={{ marginTop: 14 }}><Notice tone="danger">{walk.error}</Notice></View> : null}
      <ActionButton title={walk.busy ? "Starting your walk…" : "Start walk and share link"} onPress={walk.startTrip} loading={walk.busy} style={{ marginTop: 18 }} />
      <Text style={s.centerNote}>You can end sharing at any time.</Text>
    </> : null}

    {walk.phase === "walking" && walk.trip ? <>
      <View style={s.walkHeader}><View style={{ flex: 1 }}><Eyebrow>YOUR WALK IS LIVE</Eyebrow><Text style={s.walkTitle}>You’re on your way.</Text></View><View style={s.livePill}><View style={s.liveDot} /><Text style={s.liveText}>{walk.sendError || !walk.foreground ? "PAUSED" : "SHARING ON"}</Text></View></View>
      <View style={s.mapFrameLarge}><MapView center={mapCenter} routes={mapRoutes} markers={mapMarkers} livePosition={walk.position} /></View>
      <View style={s.walkStats}><View><Text style={s.statLarge}>{Math.max(0, Math.ceil((walk.trip.etaAt - walk.now) / 60000))}</Text><Text style={s.metricLabel}>MINUTES TO ARRIVE</Text></View><View style={s.metricDivider} /><View><Text style={s.statLarge}>{walk.trip.route.label}</Text><Text style={s.metricLabel}>CHOSEN ROUTE</Text></View></View>
      {walk.demo ? <View style={{ marginTop: 14 }}><Notice tone="warning">Demo walk · Location movement is simulated. Keep this screen open.</Notice></View> : null}
      {walk.error ? <View style={{ marginTop: 14 }}><Notice tone="danger">{walk.error}</Notice></View> : null}
      {!!walk.sendError ? <View style={{ marginTop: 14 }}><Notice tone="warning">Connection issue · {walk.sendError} Your contact may see an older location.</Notice></View> : null}
      <View style={s.shareCard}>
        <Eyebrow>PRIVATE TRACKING LINK</Eyebrow>
        <Text style={s.body}>Send this to one trusted contact. Anyone with the link can view your trip.</Text>
        <Text selectable style={s.url}>{walk.shareUrl}</Text>
        <ActionButton title="Share again" onPress={walk.shareTrip} style={{ marginTop: 12 }} />
        {!!walk.notice && <Text style={s.noticeText}>{walk.notice}</Text>}
      </View>
      <ActionButton title="I’ve arrived" onPress={() => walk.endTrip("arrived")} style={{ marginTop: 18 }} />
      <ActionButton title="Need help" onPress={() => setShowHelpConfirm(true)} danger secondary style={{ marginTop: 10 }} />
      <Text style={s.centerNote}>Need urgent help? Call 911. Safe Walk does not contact emergency services.</Text>
    </> : null}

    {walk.phase === "finished" ? <>
      <View style={[s.finishedMark, walk.finishedStatus === "help" && { backgroundColor: palette.redBg }]}><Text style={[s.finishedMarkText, walk.finishedStatus === "help" && { color: palette.red }]}>{walk.finishedStatus === "arrived" ? "✓" : walk.finishedStatus === "help" ? "!" : "—"}</Text></View>
      <SectionTitle eyebrow={walk.finishedStatus === "help" ? "Help status" : walk.finishedStatus === "expired" ? "Trip ended" : "Trip complete"}
        title={walk.finishedStatus === "help" ? walk.trip?.pendingEnd ? "Sending your help status…" : "Your trip is marked for help." : walk.finishedStatus === "expired" ? "This tracking link has expired." : "You made it."}
        subtitle={walk.finishedStatus === "help" ? "Your contact sees a red help banner when viewing the link. There is no automatic message or emergency call." : walk.finishedStatus === "expired" ? "This trip is no longer sharing a live location." : "Location sharing has stopped for this trip."} />
      {walk.finishedStatus === "help" ? <Notice tone="danger">If you are in immediate danger, call 911 now. Safe Walk cannot call for you.</Notice> : null}
      {!!walk.sendError ? <View style={{ marginTop: 13 }}><Notice tone="warning">{walk.sendError}</Notice></View> : null}
      {walk.trip?.pendingEnd ? <Text style={s.centerNote}>Your contact’s status is waiting for a connection. Keep this screen open; we’ll retry automatically. Starting another trip is unavailable until it sends.</Text> : null}
      {!walk.trip?.pendingEnd ? <ActionButton title="Plan another walk" onPress={walk.reset} style={{ marginTop: 20 }} /> : null}
    </> : null}
    <Modal visible={showHelpConfirm} transparent animationType="fade" onRequestClose={() => setShowHelpConfirm(false)}>
      <View style={s.modalBackdrop}><View style={s.modalCard}>
        <Eyebrow>PLEASE CONFIRM</Eyebrow><Text style={s.modalTitle}>Mark this trip as needing help?</Text>
        <Text style={s.body}>This stops sharing and shows a red help banner with your last location on your contact’s tracking page. It does not send a message or call 911.</Text>
        <ActionButton title="Yes, mark as needing help" danger onPress={() => { setShowHelpConfirm(false); walk.endTrip("help"); }} style={{ marginTop: 18 }} />
        <ActionButton title="Go back" secondary onPress={() => setShowHelpConfirm(false)} style={{ marginTop: 9 }} />
      </View></View>
    </Modal>
  </ScrollView>;
}

const s = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  loading: { color: palette.evergreen, fontSize: 17, fontWeight: "700", marginTop: 15 },
  stepLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  stepDot: { width: 10, height: 10, borderRadius: 6, backgroundColor: palette.citronDark },
  stepCopy: { color: palette.evergreen, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  stepRule: { height: 1, backgroundColor: palette.line, flex: 1 },
  stepOptional: { color: palette.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  fieldHint: { color: palette.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
  hairline: { flex: 1, height: 1, backgroundColor: palette.line },
  orText: { color: palette.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  destinationMark: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 2, marginBottom: 10 },
  destinationDot: { width: 10, height: 10, backgroundColor: palette.citron, borderWidth: 2, borderColor: palette.evergreen, borderRadius: 6 },
  required: { marginLeft: "auto", color: palette.citronDark, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  demoLink: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 5 },
  demoLinkText: { color: palette.evergreen, fontSize: 15, fontWeight: "800", textDecorationLine: "underline" },
  reassurance: { color: palette.muted, textAlign: "center", fontSize: 14, marginTop: 20, fontWeight: "600" },
  mapFrame: { height: 260, overflow: "hidden", borderRadius: 18, backgroundColor: "#DFE5D6", marginTop: 18 },
  mapFrameLarge: { height: 300, overflow: "hidden", borderRadius: 20, backgroundColor: "#DFE5D6", marginTop: 8 },
  mapCaption: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  routeCard: { backgroundColor: palette.paper, borderColor: palette.line, borderWidth: 1.5, borderRadius: 18, padding: 16 },
  routeSelected: { borderColor: palette.evergreen, backgroundColor: "#F5F6EE" },
  routeTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  routeName: { color: palette.evergreen, fontSize: 20, fontWeight: "900" },
  routeSub: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  radio: { width: 24, height: 24, borderRadius: 13, borderWidth: 2, borderColor: "#91A08B", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: palette.evergreen },
  radioCore: { width: 12, height: 12, borderRadius: 7, backgroundColor: palette.evergreen },
  routeMetrics: { flexDirection: "row", alignItems: "center", gap: 15, marginTop: 17, paddingTop: 13, borderTopWidth: 1, borderColor: palette.line },
  metricValue: { color: palette.evergreen, fontSize: 25, fontWeight: "900", letterSpacing: -0.6 },
  metricUnit: { fontSize: 15, fontWeight: "700" },
  metricLabel: { color: palette.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7, marginTop: 2 },
  metricDivider: { width: 1, height: 39, backgroundColor: palette.line },
  extraPill: { marginLeft: "auto", borderRadius: 20, backgroundColor: palette.paleGreen, paddingHorizontal: 10, paddingVertical: 7 },
  extraText: { color: palette.evergreen, fontSize: 13, fontWeight: "900" },
  reason: { color: palette.ink, fontSize: 14, lineHeight: 21, marginTop: 13 },
  limited: { color: palette.amber, fontSize: 13, lineHeight: 19, marginTop: 6, fontWeight: "700" },
  disclaimer: { backgroundColor: palette.paleGreen, borderRadius: 15, padding: 15, marginTop: 16 },
  disclaimerTitle: { color: palette.evergreen, fontSize: 15, fontWeight: "900", marginBottom: 4 },
  body: { color: palette.muted, fontSize: 15, lineHeight: 22 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  textAction: { alignSelf: "center", paddingVertical: 14, paddingHorizontal: 12 },
  textActionText: { color: palette.evergreen, fontSize: 14, fontWeight: "800", textDecorationLine: "underline" },
  simulationToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderRadius: 15, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, padding: 14, marginTop: 14 },
  simulationCopy: { flex: 1 },
  simulationTitle: { color: palette.evergreen, fontSize: 15, fontWeight: "900" },
  simulationHint: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  switchTrack: { width: 48, height: 28, borderRadius: 20, backgroundColor: "#D5DCCB", justifyContent: "center", paddingHorizontal: 3 },
  switchOn: { backgroundColor: palette.evergreen },
  switchThumb: { width: 22, height: 22, borderRadius: 12, backgroundColor: palette.paper },
  thumbOn: { alignSelf: "flex-end", backgroundColor: palette.citron },
  backLink: { alignSelf: "flex-start", paddingVertical: 5, marginBottom: 18 },
  backLinkText: { color: palette.evergreen, fontSize: 15, fontWeight: "800" },
  chosenRoute: { borderRadius: 16, backgroundColor: palette.paleGreen, padding: 16, marginBottom: 14 },
  chosenName: { color: palette.evergreen, fontSize: 19, fontWeight: "900", marginBottom: 5 },
  consentCard: { ...common.card, padding: 19 },
  consentIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: palette.evergreen, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  consentRing: { width: 30, height: 30, borderWidth: 2, borderColor: palette.citron, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  consentCore: { width: 10, height: 10, borderRadius: 6, backgroundColor: palette.citron },
  consentHeadline: { color: palette.evergreen, fontSize: 23, lineHeight: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 10 },
  consentExact: { color: palette.evergreen, fontSize: 17, lineHeight: 25, fontWeight: "800" },
  consentRule: { height: 1, backgroundColor: palette.line, marginVertical: 15 },
  consentLine: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 9 },
  centerNote: { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 13, paddingHorizontal: 8 },
  walkHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 13 },
  walkTitle: { color: palette.evergreen, fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: -0.8 },
  livePill: { flexDirection: "row", gap: 7, alignItems: "center", backgroundColor: palette.paleGreen, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 9 },
  liveDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: "#557636" },
  liveText: { color: palette.evergreen, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  walkStats: { flexDirection: "row", alignItems: "center", backgroundColor: palette.paper, borderRadius: 16, padding: 17, marginTop: 13, borderColor: palette.line, borderWidth: 1 },
  statLarge: { color: palette.evergreen, fontSize: 24, fontWeight: "900" },
  shareCard: { ...common.card, marginTop: 16 },
  url: { color: palette.evergreen, fontSize: 15, lineHeight: 21, fontWeight: "700", marginTop: 12, padding: 12, backgroundColor: palette.oat, borderRadius: 10 },
  noticeText: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  finishedMark: { width: 66, height: 66, borderRadius: 23, backgroundColor: palette.paleGreen, alignItems: "center", justifyContent: "center", marginTop: 32, marginBottom: 22 },
  finishedMarkText: { color: palette.evergreen, fontSize: 30, fontWeight: "900" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,35,28,0.55)", justifyContent: "center", padding: 20 },
  modalCard: { alignSelf: "center", width: "100%", maxWidth: 480, backgroundColor: palette.paper, padding: 22, borderRadius: 22 },
  modalTitle: { color: palette.evergreen, fontSize: 27, lineHeight: 32, fontWeight: "900", marginBottom: 10 },
});
