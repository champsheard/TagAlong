import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWalk } from "../hooks/useWalk";
import MapView from "../components/MapView";
import AddressSearch from "../components/AddressSearch";
import { ActionButton, Eyebrow, Notice, SectionTitle } from "../components/WalkUI";
import { common, palette } from "../constants/theme";

const formatMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));
const routeColors = { fastest: "#87977F", selected: "#567236" };

export default function Index() {
  const router = useRouter();
  const walk = useWalk();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [showHelpConfirm, setShowHelpConfirm] = useState(false);
  const [searchTarget, setSearchTarget] = useState<"from" | "to">("to");
  const [focusedPlace, setFocusedPlace] = useState<{ lat: number; lng: number } | null>(null);
  const mapRoutes = useMemo(() => (walk.phase === "walking" && walk.trip ? [walk.trip.route] : walk.result?.routes ?? []).map(route => ({
    id: route.id, geometry: route.geometry, color: route.id === walk.selectedRoute?.id ? routeColors.selected : routeColors.fastest,
  })), [walk.result, walk.selectedRoute, walk.phase, walk.trip?.route]);
  const mapMarkers = useMemo(() => [
    ...(walk.from ? [{ lat: walk.from.lat, lng: walk.from.lng, label: "Start" }] : []),
    ...(walk.to ? [{ lat: walk.to.lat, lng: walk.to.lng, label: "Destination" }] : []),
  ], [walk.from, walk.to]);
  const firstCoord = (walk.selectedRoute ?? walk.trip?.route)?.geometry.coordinates[0];
  const mapCenter = useMemo(() => {
    const point = walk.phase === "walking" ? walk.position ?? walk.from : focusedPlace ?? walk.to ?? walk.from;
    const resolvedPoint = point ??
      (firstCoord ? { lat: firstCoord[1], lng: firstCoord[0] } : null);
    return resolvedPoint ? { lat: resolvedPoint.lat, lng: resolvedPoint.lng } : { lat: 37.7749, lng: -122.4194 };
  }, [walk.position?.lat, walk.position?.lng, walk.phase, walk.from?.lat, walk.from?.lng, walk.to?.lat, walk.to?.lng, focusedPlace?.lat, focusedPlace?.lng, firstCoord?.[0], firstCoord?.[1]]);
  const panelHeight = walk.phase === "walking" ? height * 0.44
    : walk.phase === "routes" || walk.phase === "consent" ? height * 0.64
      : walk.phase === "finished" ? height * 0.52 : height * 0.58;
  const route = walk.selectedRoute;

  if (walk.restoring) return <View style={[common.page, s.center]}><ActivityIndicator size="large" color={palette.evergreen} /><Text style={s.loading}>Checking for an active walk…</Text></View>;

  return <View style={s.screen}>
    <View style={StyleSheet.absoluteFill}>
      <MapView center={mapCenter} routes={mapRoutes} markers={mapMarkers} livePosition={walk.position}
        fitPadding={{ top: insets.top + 74, right: 28, bottom: panelHeight + 14, left: 28 }}
        attributionBottom={panelHeight + 7} />
    </View>

    <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
      <View style={s.brandGroup}>
        <View style={s.brandMark}><View style={s.brandRing} /><Text style={s.brandMarkText}>SW</Text></View>
        <View><Text style={s.brand}>Safe Walk</Text><Text style={s.tagline}>{walk.phase === "walking" ? "Your walk, on your terms" : "A steadier way home"}</Text></View>
      </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Contacts" onPress={() => router.push("/contacts")} style={({ pressed }) => [s.contactsButton, pressed && s.pressed]}>
          <Text style={s.contactsGlyph}>+</Text><Text style={s.contactsLabel}>Contacts</Text>
        </Pressable>
    </View>

    <View style={s.panelDock}>
      <View style={[s.panel, { height: panelHeight, paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={s.grabber} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.panelContent} showsVerticalScrollIndicator={false}>
          {walk.phase === "plan" ? <>
            <View style={s.planHeading}>
              <View style={{ flex: 1 }}><Eyebrow>PLAN A WALK</Eyebrow><Text style={s.panelTitle}>Where to tonight?</Text></View>
              <View style={s.mapKey}><View style={s.mapKeyDot} /><Text style={s.mapKeyText}>MAP</Text></View>
            </View>
            <Text style={s.panelSubtitle}>Search a place to put it on the map. We’ll compare the routes.</Text>
            {walk.routingAvailable === false ? <Notice tone="warning">Route planning is not configured on this server yet. Address search still works; try a Demo walk to explore the experience.</Notice> : null}
            <View style={s.searchTabs}>
              <Pressable accessibilityRole="button" onPress={() => setSearchTarget("from")} style={[s.searchTab, searchTarget === "from" && s.searchTabActive]}>
                <View style={[s.tabDot, s.startDot]} /><Text style={[s.searchTabText, searchTarget === "from" && s.searchTabTextActive]}>Start</Text>
                <Text numberOfLines={1} style={s.tabSelection}>{walk.from?.label ?? "Current location"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setSearchTarget("to")} style={[s.searchTab, searchTarget === "to" && s.searchTabActive]}>
                <View style={[s.tabDot, s.destinationDot]} /><Text style={[s.searchTabText, searchTarget === "to" && s.searchTabTextActive]}>Destination</Text>
                <Text numberOfLines={1} style={s.tabSelection}>{walk.to?.label ?? "Add a place"}</Text>
              </Pressable>
            </View>
            <View style={s.searchArea}>
              {searchTarget === "from"
                ? <AddressSearch label="Starting point" placeholder="Search an address or place" value={walk.from} onSelect={place => { setFocusedPlace(place); walk.setFrom(place); }} onClear={() => { setFocusedPlace(null); walk.setFrom(null); }} />
                : <AddressSearch label="Where are you going?" placeholder="Search street, place, or landmark" value={walk.to} onSelect={place => { setFocusedPlace(place); walk.setTo(place); }} onClear={() => { setFocusedPlace(null); walk.setTo(null); }} required />}
            </View>
            {searchTarget === "from" ? <Pressable accessibilityRole="button" onPress={walk.locateStart} disabled={walk.busy} style={s.locationAction}>
              <Text style={s.locationActionText}>{walk.busy ? "Finding your location…" : "Use my current location"}</Text>
            </Pressable> : null}
            {walk.error ? <Notice tone="danger">{walk.error}</Notice> : null}
            <View style={s.planActions}>
              <ActionButton title={walk.busy ? "Finding routes…" : "Compare routes"} onPress={walk.planRoutes} loading={walk.busy} disabled={!walk.to} style={{ flex: 1 }} />
              <Pressable accessibilityRole="button" onPress={walk.loadDemo} disabled={walk.busy} style={({ pressed }) => [s.demoButton, pressed && s.pressed]}>
                <Text style={s.demoButtonText}>{walk.busy ? "…" : "Demo"}</Text>
              </Pressable>
            </View>
            <Text style={s.quietNote}>You choose when to share, and when the trip ends.</Text>
          </> : null}

          {walk.phase === "routes" && walk.result ? <>
            <View style={s.phaseTop}><View style={{ flex: 1 }}><Eyebrow>ROUTE OPTIONS</Eyebrow><Text style={s.panelTitle}>Choose your way.</Text></View><Pressable onPress={() => { walk.setDemo(false); walk.editPlan(); }} style={s.smallAction}><Text style={s.smallActionText}>Edit places</Text></Pressable></View>
            <Text style={s.panelSubtitle} numberOfLines={2}>{walk.from?.label ?? "Starting point"} → {walk.to?.label ?? "Destination"}</Text>
            {walk.result.demo ? <View style={{ marginTop: 12 }}><Notice tone="warning">Demo walk · Routes, movement, and lighting scores are simulated. They do not describe real streets or real lighting.</Notice></View> : null}
            {!!walk.result.notices.length && walk.result.notices.map((notice, i) => <View key={i} style={{ marginTop: 9 }}><Notice>{notice}</Notice></View>)}
            <Text style={s.routeSectionLabel}>PICK A ROUTE</Text>
            <View style={s.routeChoices}>
              {walk.result.routes.map(option => {
                const fastest = Math.min(...walk.result!.routes.map(r => r.durationSeconds));
                const extra = Math.max(0, Math.ceil((option.durationSeconds - fastest) / 60));
                const selected = option.id === route?.id;
                const score = option.lightScore;
                return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => walk.selectRoute(option.id)}
                  style={({ pressed }) => [s.routeCard, selected && s.routeSelected, pressed && s.pressed]}>
                  <View style={s.routeTop}>
                    <View style={{ flex: 1 }}><Text style={s.routeName}>{option.label}</Text><Text style={s.routeSub}>{option.label === "Best lit" ? "Favors streets with more lighting data" : "The shortest estimated time"}</Text></View>
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
            <View style={s.disclaimer}><Text style={s.disclaimerTitle}>Lighting is an estimate</Text><Text style={s.body}>Scores reflect available lighting data—not a guarantee that a street is lit, open, or safe right now.</Text></View>
            {!walk.result.demo ? <Pressable accessibilityRole="switch" accessibilityState={{ checked: walk.demo }} onPress={() => walk.setDemo(!walk.demo)} style={s.simulationToggle}>
              <View style={{ flex: 1 }}><Text style={s.simulationTitle}>Demo walk</Text><Text style={s.simulationHint}>Simulate movement for 90 seconds along this route.</Text></View>
              <View style={[s.switchTrack, walk.demo && s.switchOn]}><View style={[s.switchThumb, walk.demo && s.thumbOn]} /></View>
            </Pressable> : null}
            {walk.demo && !walk.result.demo ? <View style={{ marginTop: 10 }}><Notice tone="warning">Simulated movement follows this route for 90 seconds. Lighting remains an estimate.</Notice></View> : null}
            {walk.error ? <View style={{ marginTop: 10 }}><Notice tone="danger">{walk.error}</Notice></View> : null}
            <View style={s.buttonRow}>
              <ActionButton title="Edit trip" onPress={() => { walk.setDemo(false); walk.editPlan(); }} secondary style={{ flex: 1 }} />
              <ActionButton title="Choose route" onPress={walk.reviewConsent} disabled={!route} style={{ flex: 1 }} />
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
            <ActionButton title={walk.busy ? "Starting your walk…" : "Start walk"} onPress={walk.startTrip} loading={walk.busy} style={{ marginTop: 18 }} />
            <Text style={s.quietNote}>You can end sharing at any time.</Text>
          </> : null}

          {walk.phase === "walking" && walk.trip ? <>
            <View style={s.phaseTop}><View style={{ flex: 1 }}><Eyebrow>YOUR WALK IS LIVE</Eyebrow><Text style={s.panelTitle}>You’re on your way.</Text></View><View style={s.livePill}><View style={s.liveDot} /><Text style={s.liveText}>{walk.sendError || !walk.foreground ? "PAUSED" : "SHARING ON"}</Text></View></View>
            <View style={s.walkStats}><View><Text style={s.statLarge}>{Math.max(0, Math.ceil((walk.trip.etaAt - walk.now) / 60000))}</Text><Text style={s.metricLabel}>MIN TO ARRIVE</Text></View><View style={s.metricDivider} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={s.statRoute}>{walk.trip.route.label}</Text><Text style={s.metricLabel}>CHOSEN ROUTE</Text></View></View>
            {walk.demo ? <View style={{ marginTop: 12 }}><Notice tone="warning">Demo walk · Location movement is simulated. Keep this screen open.</Notice></View> : null}
            {walk.error ? <View style={{ marginTop: 12 }}><Notice tone="danger">{walk.error}</Notice></View> : null}
            {!!walk.sendError ? <View style={{ marginTop: 12 }}><Notice tone="warning">Connection issue · {walk.sendError} Your contact may see an older location.</Notice></View> : null}
            <View style={s.shareCard}>
              <Eyebrow>PRIVATE TRACKING LINK</Eyebrow>
              <Text style={s.body}>Send this to one trusted contact. Anyone with the link can view your trip.</Text>
              <Text selectable style={s.url}>{walk.shareUrl}</Text>
              <ActionButton title="Share link" onPress={walk.shareTrip} style={{ marginTop: 12 }} />
              {!!walk.notice && <Text style={s.noticeText}>{walk.notice}</Text>}
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/contacts")} style={s.contactsDuringWalk}><Text style={s.contactsDuringText}>Choose an app contact</Text><Text style={s.contactsArrow}>›</Text></Pressable>
            <ActionButton title="I’ve arrived" onPress={() => walk.endTrip("arrived")} style={{ marginTop: 14 }} />
            <ActionButton title="Need help" onPress={() => setShowHelpConfirm(true)} danger secondary style={{ marginTop: 9 }} />
            <Text style={s.centerNote}>Need urgent help? Call 911. Safe Walk does not contact emergency services.</Text>
          </> : null}

          {walk.phase === "finished" ? <>
            <View style={[s.finishedMark, walk.finishedStatus === "help" && { backgroundColor: palette.redBg }]}><Text style={[s.finishedMarkText, walk.finishedStatus === "help" && { color: palette.red }]}>{walk.finishedStatus === "arrived" ? "✓" : walk.finishedStatus === "help" ? "!" : "—"}</Text></View>
            <SectionTitle eyebrow={walk.finishedStatus === "help" ? "Help status" : walk.finishedStatus === "expired" ? "Trip ended" : "Trip complete"}
              title={walk.finishedStatus === "help" ? walk.trip?.pendingEnd ? "Sending your help status…" : "Your trip is marked for help." : walk.finishedStatus === "expired" ? "This tracking link has expired." : "You made it."}
              subtitle={walk.finishedStatus === "help" ? "The tracking link shows your help status. App contacts you shared with may receive a notification; delivery is not guaranteed. No emergency call is made." : walk.finishedStatus === "expired" ? "This trip is no longer sharing a live location." : "Location sharing has stopped for this trip."} />
            {walk.finishedStatus === "help" ? <Notice tone="danger">If you are in immediate danger, call 911 now. Safe Walk cannot call for you.</Notice> : null}
            {!!walk.sendError ? <View style={{ marginTop: 13 }}><Notice tone="warning">{walk.sendError}</Notice></View> : null}
            {walk.trip?.pendingEnd ? <Text style={s.centerNote}>Your contact’s status is waiting for a connection. Keep this screen open; we’ll retry automatically. Starting another trip is unavailable until it sends.</Text> : null}
            {!walk.trip?.pendingEnd ? <ActionButton title="Plan another walk" onPress={walk.reset} style={{ marginTop: 20 }} /> : null}
          </> : null}
        </ScrollView>
      </View>
    </View>

    <Modal visible={showHelpConfirm} transparent animationType="fade" onRequestClose={() => setShowHelpConfirm(false)}>
      <View style={s.modalBackdrop}><View style={s.modalCard}>
        <Eyebrow>PLEASE CONFIRM</Eyebrow><Text style={s.modalTitle}>Mark this trip as needing help?</Text>
        <Text style={s.body}>This stops location sharing and shows a red help banner with your last location. Selected app contacts may receive a notification when connected; link-only contacts must open the link. It does not call 911.</Text>
        <ActionButton title="Yes, mark as needing help" danger onPress={() => { setShowHelpConfirm(false); walk.endTrip("help"); }} style={{ marginTop: 18 }} />
        <ActionButton title="Go back" secondary onPress={() => setShowHelpConfirm(false)} style={{ marginTop: 9 }} />
      </View></View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.oat },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  loading: { color: palette.evergreen, fontSize: 17, fontWeight: "700", marginTop: 15 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandGroup: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: palette.paper, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: palette.line, shadowColor: palette.evergreen, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  brandMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: palette.evergreen, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  brandRing: { position: "absolute", width: 24, height: 24, borderRadius: 14, borderWidth: 1.5, borderColor: palette.citron },
  brandMarkText: { color: palette.oat, fontSize: 10, fontWeight: "900" },
  brand: { color: palette.evergreen, fontSize: 16, fontWeight: "900" },
  tagline: { color: palette.muted, fontSize: 11, fontWeight: "600" },
  contactsButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.evergreen, minHeight: 44, borderRadius: 15, paddingHorizontal: 14, shadowColor: palette.evergreen, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  contactsGlyph: { color: palette.citron, fontSize: 22, lineHeight: 24, fontWeight: "600" },
  contactsLabel: { color: palette.paper, fontSize: 13, fontWeight: "800" },
  panelDock: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", zIndex: 2, pointerEvents: "box-none" },
  panel: { width: "100%", maxWidth: 600, backgroundColor: palette.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.line, shadowColor: palette.evergreen, shadowOpacity: 0.13, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 10 },
  grabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 3, backgroundColor: "#C7CEBC", marginBottom: 14 },
  panelContent: { paddingBottom: 4 },
  planHeading: { flexDirection: "row", alignItems: "center" },
  panelTitle: { color: palette.evergreen, fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7 },
  panelSubtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  mapKey: { backgroundColor: palette.paleGreen, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 },
  mapKeyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.citronDark },
  mapKeyText: { color: palette.evergreen, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  searchTabs: { flexDirection: "row", gap: 8, marginTop: 13, marginBottom: 13 },
  searchTab: { minWidth: 0, flex: 1, minHeight: 53, borderRadius: 13, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: palette.oat },
  searchTabActive: { backgroundColor: "#F3F5EA", borderColor: palette.citronDark, borderWidth: 1.5 },
  tabDot: { position: "absolute", left: 10, top: 11, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  startDot: { backgroundColor: palette.paper, borderColor: palette.evergreen },
  destinationDot: { backgroundColor: palette.citron, borderColor: palette.evergreen },
  searchTabText: { color: palette.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7, marginLeft: 15 },
  searchTabTextActive: { color: palette.evergreen },
  tabSelection: { color: palette.evergreen, fontSize: 12, fontWeight: "700", marginTop: 4 },
  searchArea: { minHeight: 115 },
  locationAction: { alignSelf: "flex-start", minHeight: 35, justifyContent: "center", paddingHorizontal: 3, marginTop: -12, marginBottom: 7 },
  locationActionText: { color: palette.evergreen, fontSize: 13, fontWeight: "800", textDecorationLine: "underline" },
  planActions: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 2 },
  demoButton: { minHeight: 54, minWidth: 70, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.paleGreen, borderWidth: 1, borderColor: "#C9D1B6" },
  demoButtonText: { color: palette.evergreen, fontSize: 14, fontWeight: "900" },
  quietNote: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 10 },
  phaseTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  smallAction: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: palette.paleGreen },
  smallActionText: { color: palette.evergreen, fontSize: 12, fontWeight: "800" },
  routeSectionLabel: { color: palette.citronDark, fontSize: 10, fontWeight: "900", letterSpacing: 1, marginTop: 17, marginBottom: 8 },
  routeChoices: { gap: 9 },
  routeCard: { backgroundColor: palette.paper, borderColor: palette.line, borderWidth: 1.5, borderRadius: 16, padding: 14 },
  routeSelected: { borderColor: palette.evergreen, backgroundColor: "#F5F6EE" },
  routeTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  routeName: { color: palette.evergreen, fontSize: 18, fontWeight: "900" },
  routeSub: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 12, borderWidth: 2, borderColor: "#91A08B", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: palette.evergreen },
  radioCore: { width: 11, height: 11, borderRadius: 7, backgroundColor: palette.evergreen },
  routeMetrics: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: palette.line },
  metricValue: { color: palette.evergreen, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  metricUnit: { fontSize: 13, fontWeight: "700" },
  metricLabel: { color: palette.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.6, marginTop: 2 },
  metricDivider: { width: 1, height: 35, backgroundColor: palette.line },
  extraPill: { marginLeft: "auto", borderRadius: 20, backgroundColor: palette.paleGreen, paddingHorizontal: 9, paddingVertical: 6 },
  extraText: { color: palette.evergreen, fontSize: 12, fontWeight: "900" },
  reason: { color: palette.ink, fontSize: 13, lineHeight: 19, marginTop: 10 },
  limited: { color: palette.amber, fontSize: 12, lineHeight: 17, marginTop: 5, fontWeight: "700" },
  disclaimer: { backgroundColor: palette.paleGreen, borderRadius: 14, padding: 13, marginTop: 12 },
  disclaimerTitle: { color: palette.evergreen, fontSize: 14, fontWeight: "900", marginBottom: 4 },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  buttonRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  textAction: { alignSelf: "center", paddingVertical: 12, paddingHorizontal: 12 },
  textActionText: { color: palette.evergreen, fontSize: 13, fontWeight: "800", textDecorationLine: "underline" },
  simulationToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, padding: 13, marginTop: 12 },
  simulationTitle: { color: palette.evergreen, fontSize: 14, fontWeight: "900" },
  simulationHint: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  switchTrack: { width: 46, height: 27, borderRadius: 20, backgroundColor: "#D5DCCB", justifyContent: "center", paddingHorizontal: 3 },
  switchOn: { backgroundColor: palette.evergreen },
  switchThumb: { width: 21, height: 21, borderRadius: 12, backgroundColor: palette.paper },
  thumbOn: { alignSelf: "flex-end", backgroundColor: palette.citron },
  backLink: { alignSelf: "flex-start", paddingVertical: 5, marginBottom: 15 },
  backLinkText: { color: palette.evergreen, fontSize: 14, fontWeight: "800" },
  chosenRoute: { borderRadius: 15, backgroundColor: palette.paleGreen, padding: 15, marginBottom: 13 },
  chosenName: { color: palette.evergreen, fontSize: 18, fontWeight: "900", marginBottom: 5 },
  consentCard: { ...common.card, padding: 17 },
  consentIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.evergreen, alignItems: "center", justifyContent: "center", marginBottom: 13 },
  consentRing: { width: 28, height: 28, borderWidth: 2, borderColor: palette.citron, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  consentCore: { width: 9, height: 9, borderRadius: 6, backgroundColor: palette.citron },
  consentHeadline: { color: palette.evergreen, fontSize: 21, lineHeight: 26, fontWeight: "900", letterSpacing: -0.4, marginBottom: 8 },
  consentExact: { color: palette.evergreen, fontSize: 16, lineHeight: 23, fontWeight: "800" },
  consentRule: { height: 1, backgroundColor: palette.line, marginVertical: 13 },
  consentLine: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  centerNote: { color: palette.muted, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 12, paddingHorizontal: 8 },
  livePill: { flexDirection: "row", gap: 7, alignItems: "center", backgroundColor: palette.paleGreen, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: "#557636" },
  liveText: { color: palette.evergreen, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  walkStats: { flexDirection: "row", alignItems: "center", backgroundColor: palette.oat, borderRadius: 14, padding: 14, marginTop: 12, borderColor: palette.line, borderWidth: 1, gap: 14 },
  statLarge: { color: palette.evergreen, fontSize: 23, fontWeight: "900" },
  statRoute: { color: palette.evergreen, fontSize: 18, fontWeight: "900" },
  shareCard: { ...common.card, marginTop: 13, padding: 15 },
  url: { color: palette.evergreen, fontSize: 14, lineHeight: 20, fontWeight: "700", marginTop: 10, padding: 11, backgroundColor: palette.oat, borderRadius: 10 },
  noticeText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  contactsDuringWalk: { minHeight: 47, marginTop: 11, borderRadius: 13, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.oat, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  contactsDuringText: { color: palette.evergreen, fontSize: 14, fontWeight: "800" },
  contactsArrow: { color: palette.citronDark, fontSize: 23, lineHeight: 25 },
  finishedMark: { width: 60, height: 60, borderRadius: 21, backgroundColor: palette.paleGreen, alignItems: "center", justifyContent: "center", marginTop: 12, marginBottom: 18 },
  finishedMarkText: { color: palette.evergreen, fontSize: 28, fontWeight: "900" },
  pressed: { opacity: 0.76 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,35,28,0.55)", justifyContent: "center", padding: 20 },
  modalCard: { alignSelf: "center", width: "100%", maxWidth: 480, backgroundColor: palette.paper, padding: 22, borderRadius: 22 },
  modalTitle: { color: palette.evergreen, fontSize: 25, lineHeight: 30, fontWeight: "900", marginBottom: 10 },
});
