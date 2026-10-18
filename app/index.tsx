import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWalk } from "../hooks/useWalk";
import MapView from "../components/MapView";
import MapContextPill from "../components/MapContextPill";
import AddressSearch from "../components/AddressSearch";
import DraggableDrawer from "../components/DraggableDrawer";
import { ActionButton, Eyebrow, Notice, SectionTitle } from "../components/WalkUI";
import ArrivalFeedback from "../components/ArrivalFeedback";
import { common, palette } from "../constants/theme";
import { useContacts } from "../hooks/useContacts";
import { isShowcaseDemo } from "../lib/presentationDemo";

const formatMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));
const formatDistance = (meters: number) => {
  const region = Intl.NumberFormat().resolvedOptions().locale.split("-")[1]?.toUpperCase();
  return ["US", "LR", "MM"].includes(region ?? "")
    ? `${Math.round(meters / 1609.344)} mi`
    : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
};
const routeColors = { fastest: "#87977F", selected: "#426b49" };

export default function Index() {
  const router = useRouter();
  const walk = useWalk();
  const showcaseDemo = isShowcaseDemo();
  const contacts = useContacts(!showcaseDemo);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showArrivalConfirm, setShowArrivalConfirm] = useState(false);
  const [showHelpConfirm, setShowHelpConfirm] = useState(false);
  const [showStartSearch, setShowStartSearch] = useState(false);
  const [focusedPlace, setFocusedPlace] = useState<{ lat: number; lng: number } | null>(null);
  const [actualPanelHeight, setActualPanelHeight] = useState(height * 0.58);
  const startAfterConfirmDismiss = useRef(false);
  const startTripTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRoutes = useMemo(() => (walk.phase === "walking" && walk.trip ? [walk.trip.route] : walk.result?.routes ?? []).map(route => ({
    id: route.id, geometry: route.geometry, color: route.id === walk.selectedRoute?.id ? routeColors.selected : routeColors.fastest,
  })), [walk.result, walk.selectedRoute, walk.phase, walk.trip?.route]);
  const mapMarkers = useMemo(() => [
    ...(walk.from ? [{ lat: walk.from.lat, lng: walk.from.lng, label: "Start" }] : []),
    ...(walk.to ? [{ lat: walk.to.lat, lng: walk.to.lng, label: "Destination" }] : []),
  ], [walk.from, walk.to]);
  const activeSharedTrips = useMemo(
    () => contacts.inbox.filter(trip => trip.status === "active" && trip.expiresAt > walk.now),
    [contacts.inbox, walk.now],
  );
  const visibleSharedTrips = activeSharedTrips.slice(0, 2);
  const firstCoord = (walk.selectedRoute ?? walk.trip?.route)?.geometry.coordinates[0];
  const mapCenter = useMemo(() => {
    const point = walk.phase === "walking"
      ? walk.position ?? walk.mapLocation ?? walk.from
      : focusedPlace ?? walk.to ?? walk.from ?? walk.mapLocation ?? walk.position;
    const resolvedPoint = point ??
      (firstCoord ? { lat: firstCoord[1], lng: firstCoord[0] } : null);
    return resolvedPoint ? { lat: resolvedPoint.lat, lng: resolvedPoint.lng } : { lat: 37.7749, lng: -122.4194 };
  }, [walk.position?.lat, walk.position?.lng, walk.mapLocation?.lat, walk.mapLocation?.lng, walk.phase, walk.from?.lat, walk.from?.lng, walk.to?.lat, walk.to?.lng, focusedPlace?.lat, focusedPlace?.lng, firstCoord?.[0], firstCoord?.[1]]);
  const panelHeight = walk.phase === "walking" ? height * 0.44
    : walk.phase === "routes" ? height * 0.64
      : walk.phase === "finished" ? height * (walk.finishedStatus === "arrived" && !walk.demo && !walk.trip?.pendingEnd ? 0.68 : 0.52) : height * 0.58;
  const route = walk.selectedRoute;
  const mapIsDemo = walk.phase === "walking"
    ? walk.demo || !!walk.trip?.demo
    : walk.phase === "finished"
      ? walk.demo || !!walk.trip?.demo
      : walk.phase === "routes" && !!walk.result?.demo;
  const mapContextLabel = walk.phase === "walking"
    ? mapIsDemo ? `SIMULATED ${walk.travelMode === "driving" ? "DRIVE" : "WALK"}` : `LIVE ${walk.travelMode === "driving" ? "DRIVE" : "WALK"}`
    : walk.phase === "routes"
      ? mapIsDemo ? "DEMO ROUTE · SAMPLE" : "ROUTE PREVIEW"
      : walk.phase === "finished"
        ? mapIsDemo ? "DEMO TRIP ENDED" : "TRIP ENDED"
        : "MAP PREVIEW";
  useEffect(() => { setActualPanelHeight(panelHeight); }, [panelHeight]);
  useEffect(() => () => {
    if (startTripTimer.current) clearTimeout(startTripTimer.current);
  }, []);

  function confirmStartTrip() {
    if (Platform.OS === "ios") {
      startAfterConfirmDismiss.current = true;
      setShowStartConfirm(false);
      return;
    }
    setShowStartConfirm(false);
    startTripTimer.current = setTimeout(() => {
      startTripTimer.current = null;
      void walk.startTrip();
    }, 250);
  }

  function onStartConfirmDismiss() {
    if (!startAfterConfirmDismiss.current) return;
    startAfterConfirmDismiss.current = false;
    void walk.startTrip();
  }

  if (walk.restoring) return <View style={[common.page, s.center]}><ActivityIndicator size="large" color={palette.evergreen} /><Text style={s.loading}>Checking for an active trip…</Text></View>;

  return <View style={s.screen}>
    <View style={StyleSheet.absoluteFill}>
      <MapView center={mapCenter} routes={mapRoutes} markers={mapMarkers}
        livePosition={walk.phase === "walking" ? walk.position : walk.mapLocation}
        livePositionLabel="Your current location"
        fitPadding={{ top: insets.top + 74, right: 28, bottom: actualPanelHeight + 14, left: 28 }}
        attributionBottom={actualPanelHeight + 7} />
    </View>

    <MapContextPill label={mapContextLabel} top={insets.top + 76} tone={mapIsDemo ? "demo" : "default"} />
    <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
      <View style={s.brandGroup}>
        <View style={s.brandMark}><View style={s.brandRing} /><Text style={s.brandMarkText}>T</Text></View>
        <View><Text style={s.brand}>Tagalong</Text><Text style={s.tagline}>{walk.phase === "walking" ? walk.travelMode === "driving" ? "Your drive, on your terms" : "Your walk, on your terms" : "A steadier way home"}</Text></View>
      </View>
        {!showcaseDemo ? <Pressable accessibilityRole="button" accessibilityLabel="Contacts" onPress={() => router.push("/contacts")} style={({ pressed }) => [s.contactsButton, pressed && s.pressed]}>
          <Text style={s.contactsGlyph}>+</Text><Text style={s.contactsLabel}>Contacts</Text>
        </Pressable> : null}
    </View>

    <DraggableDrawer
      style={[s.panel, { paddingBottom: Math.max(insets.bottom, 14) }]}
      initialHeight={panelHeight}
      minHeight={Math.min(230, height * 0.32)}
      maxHeight={Math.max(180, height - insets.top - 12)}
      resetKey={walk.phase}
      onHeightSettled={setActualPanelHeight}
    >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentContainerStyle={s.panelContent}
          showsVerticalScrollIndicator={false}
        >
          {walk.phase === "plan" ? <>
            <View style={s.planHeading}>
              <View style={{ flex: 1 }}><Eyebrow>{`PLAN A ${walk.travelMode === "driving" ? "DRIVE" : "WALK"}`}</Eyebrow><Text style={s.panelTitle}>Where are you headed?</Text></View>
              <View style={s.mapKey}><View style={s.mapKeyDot} /><Text style={s.mapKeyText}>MAP</Text></View>
            </View>
            <Text style={s.panelSubtitle}>{walk.travelMode === "driving"
              ? "Compare driving routes up to 300 km (186 mi) and five hours. This is tracking, not navigation."
              : "Choose a destination and compare walking routes within 15 km."}</Text>
            <View style={s.modeSwitch}>
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: walk.travelMode === "walking" }}
                onPress={() => walk.setTravelMode("walking")} style={[s.modeOption, walk.travelMode === "walking" && s.modeSelected]}>
                <Text style={[s.modeOptionText, walk.travelMode === "walking" && s.modeSelectedText]}>Walk</Text>
              </Pressable>
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: walk.travelMode === "driving" }}
                onPress={() => walk.setTravelMode("driving")} style={[s.modeOption, walk.travelMode === "driving" && s.modeSelected]}>
                <Text style={[s.modeOptionText, walk.travelMode === "driving" && s.modeSelectedText]}>Drive</Text>
              </Pressable>
            </View>
            {walk.routingAvailable === false ? <Notice tone="warning">Route planning is not configured on this server yet. Address search still works; try a Demo walk to explore the experience.</Notice> : null}
            {!showcaseDemo && !contacts.loading && <View style={s.sharedPreview}>
              <View style={s.sharedPreviewTop}>
                <Eyebrow>SHARED TRIPS</Eyebrow>
                <Text style={s.sharedCount}>{contacts.error ? "Unavailable" : activeSharedTrips.length ? `${activeSharedTrips.length} active` : "No active trips"}</Text>
              </View>
              {contacts.error ? <Text style={s.sharedEmpty}>Shared trips couldn’t be loaded. Check your connection.</Text> : null}
              {visibleSharedTrips.length
                ? visibleSharedTrips.map((trip, index) => {
                  const minutes = Math.max(0, Math.ceil((trip.etaAt - walk.now) / 60000));
                  return <View key={trip.shareCode} style={s.sharedRow}>
                    <View style={s.sharedDot} />
                    <View style={s.sharedCopy}>
                      <Text style={s.sharedTitle}>{trip.demo ? trip.travelMode === "driving" ? "Shared demo drive" : "Shared demo walk" : trip.travelMode === "driving" ? "A shared drive is active" : "A shared walk is active"}</Text>
                      <Text style={s.sharedSubtitle}>Estimated arrival in {minutes} min</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View shared trip ${index + 1}`}
                      onPress={() => router.push({ pathname: "/track/[code]", params: { code: trip.shareCode } })}
                      style={s.sharedViewButton}
                    >
                      <Text style={s.sharedViewText}>View</Text>
                    </Pressable>
                  </View>;
                })
                : null}
              {contacts.refreshError ? <Text style={s.sharedEmpty}>Couldn’t refresh; showing the latest shared-walk status.</Text> : null}
            </View>}
            <View style={s.fromRow}>
              <View style={s.fromCopy}>
                <Text style={s.fromLabel}>STARTING POINT</Text>
                <Text numberOfLines={1} style={s.fromValue}>{walk.from?.label ?? "Your current location"}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setShowStartSearch(value => !value)} style={s.changeStart}>
                <Text style={s.changeStartText}>{showStartSearch ? "Done" : "Change"}</Text>
              </Pressable>
            </View>
            {showStartSearch ? <>
              <AddressSearch label="Starting point" placeholder="Search an address or place" value={walk.from} near={walk.mapLocation ?? walk.from} onSelect={place => {
                setFocusedPlace(place); walk.setFrom(place); setShowStartSearch(false);
              }} onClear={() => { setFocusedPlace(null); walk.setFrom(null); }} />
              <Pressable accessibilityRole="button" onPress={() => { setShowStartSearch(false); walk.locateStart(); }} disabled={walk.busy} style={s.locationAction}>
                <Text style={s.locationActionText}>{walk.busy ? "Finding your location…" : "Use current location instead"}</Text>
              </Pressable>
            </> : null}
            <AddressSearch label="DESTINATION" placeholder="Search a street, place, or landmark" value={walk.to} near={walk.mapLocation ?? walk.from} onSelect={place => {
              setFocusedPlace(place); walk.setTo(place);
            }} onClear={() => { setFocusedPlace(null); walk.setTo(null); }} required />
            {walk.error ? <Notice tone="danger">{walk.error}</Notice> : null}
            <View style={s.planActions}>
              <ActionButton title={walk.busy ? "Finding routes…" : "Compare routes"} onPress={walk.planRoutes} loading={walk.busy} disabled={!walk.to} style={{ flex: 1 }} />
              <Pressable accessibilityRole="button" onPress={walk.loadDemo} disabled={walk.busy} style={({ pressed }) => [s.demoButton, pressed && s.pressed]}>
                <Text style={s.demoButtonText}>{walk.busy ? "…" : walk.travelMode === "driving" ? "Demo walk" : "Demo"}</Text>
              </Pressable>
            </View>
            <Text style={s.quietNote}>You decide when to start and when sharing ends.</Text>
          </> : null}

          {walk.phase === "routes" && walk.result ? <>
            <View style={s.phaseTop}><View style={{ flex: 1 }}><Eyebrow>ROUTE OPTIONS</Eyebrow><Text style={s.panelTitle}>Choose your route.</Text></View><Pressable onPress={() => { walk.setDemo(false); setShowStartSearch(false); walk.editPlan(); }} style={s.smallAction}><Text style={s.smallActionText}>Edit places</Text></Pressable></View>
            <View accessible accessibilityLabel={`From ${walk.from?.label ?? "Starting point"} to ${walk.to?.label ?? "Destination"}`} style={s.routeEndpoints}>
              <View style={s.routeEndpoint}>
                <View style={s.routeEndpointDot} />
                <View style={s.routeEndpointCopy}><Text style={s.routeEndpointLabel}>FROM</Text><Text numberOfLines={1} style={s.routeEndpointName}>{walk.from?.label ?? "Starting point"}</Text></View>
              </View>
              <View style={s.routeEndpoint}>
                <View style={[s.routeEndpointDot, s.destinationEndpointDot]} />
                <View style={s.routeEndpointCopy}><Text style={s.routeEndpointLabel}>TO</Text><Text numberOfLines={1} style={s.routeEndpointName}>{walk.to?.label ?? "Destination"}</Text></View>
              </View>
            </View>
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
                   <View style={{ flex: 1 }}><Text style={s.routeName}>{option.label}</Text><Text style={s.routeSub}>{walk.travelMode === "driving"
                     ? option.label === "Alternative" ? "An alternate driving route" : "The fastest estimated drive"
                     : option.label === "Best lit" ? "Favors streets with more lighting data" : "The shortest estimated time"}</Text></View>
                    <View style={[s.radio, selected && s.radioSelected]}>{selected ? <View style={s.radioCore} /> : null}</View>
                  </View>
                  <View style={s.routeMetrics}>
                     <View><Text style={s.metricValue}>{formatMinutes(option.durationSeconds)}<Text style={s.metricUnit}> min</Text></Text><Text style={s.metricLabel}>{walk.travelMode === "driving" ? "ESTIMATED DRIVE" : "ESTIMATED WALK"}</Text></View>
                    <View style={s.metricDivider} />
                     <View><Text style={s.metricValue}>{walk.travelMode === "driving" ? formatDistance(option.distanceMeters) : score == null ? "N/A" : `${Math.round(score)}/100`}</Text><Text style={s.metricLabel}>{walk.travelMode === "driving" ? "ROUTE DISTANCE" : score == null ? "UNAVAILABLE" : "LIGHTING ESTIMATE"}</Text></View>
                     {(walk.result?.routes.length ?? 0) > 1 ? <View style={s.extraPill}><Text style={s.extraText}>+{extra} min</Text></View> : null}
                  </View>
                   {walk.travelMode === "walking" ? <>
                     <Text style={s.reason}>{option.lightBreakdown.reason}</Text>
                     {option.lightBreakdown.limitedData || option.lightBreakdown.unavailable ? <Text style={s.limited}>Lighting information is limited for part of this route.</Text> : null}
                   </> : null}
                </Pressable>;
              })}
            </View>
             {walk.travelMode === "walking" ? <View style={s.disclaimer}><Text style={s.disclaimerTitle}>Lighting is an estimate</Text><Text style={s.body}>Scores reflect available lighting data—not a guarantee that a street is lit, open, or safe right now.</Text></View> : null}
            {!walk.result.demo ? <Pressable accessibilityRole="switch" accessibilityState={{ checked: walk.demo }} onPress={() => walk.setDemo(!walk.demo)} style={s.simulationToggle}>
               <View style={{ flex: 1 }}><Text style={s.simulationTitle}>Simulate movement</Text><Text style={s.simulationHint}>Move along this route for 90 seconds to preview tracking.</Text></View>
              <View style={[s.switchTrack, walk.demo && s.switchOn]}><View style={[s.switchThumb, walk.demo && s.thumbOn]} /></View>
            </Pressable> : null}
             {walk.demo && !walk.result.demo ? <View style={{ marginTop: 10 }}><Notice tone="warning">Simulated movement follows this route for 90 seconds. It does not share a real location.</Notice></View> : null}
             {walk.travelMode === "driving" && !walk.demo ? <View style={{ marginTop: 10 }}><Notice tone="warning">Remote-stop check: if live location stays within 35 m for 60 seconds and no mapped building or place is within 250 m, you’ll have 15 seconds to cancel before Tagalong warns app contacts receiving this drive. Map data, GPS, and connection can limit detection. It does not contact emergency services.</Notice></View> : null}
            {walk.error ? <View style={{ marginTop: 10 }}><Notice tone="danger">{walk.error}</Notice></View> : null}
            <View style={s.buttonRow}>
               <ActionButton title={walk.travelMode === "driving" ? "Start drive" : "Start walk"} onPress={() => setShowStartConfirm(true)} disabled={!route} style={{ flex: 1 }} />
            </View>
            <Pressable accessibilityRole="button" onPress={walk.loadDemo} style={s.textAction}><Text style={s.textActionText}>Try a simulated Demo walk</Text></Pressable>
          </> : null}

          {walk.phase === "walking" && walk.trip ? <>
            <View style={s.phaseTop}><View style={{ flex: 1 }}><Eyebrow>{`YOUR ${walk.travelMode === "driving" ? "DRIVE" : "WALK"} IS LIVE`}</Eyebrow><Text style={s.panelTitle}>You’re on your way.</Text></View><View style={s.livePill}><View style={s.liveDot} /><Text style={s.liveText}>{walk.sendError || (!walk.foreground && !walk.backgroundEnabled) ? "PAUSED" : "SHARING ON"}</Text></View></View>
            <View style={s.walkStats}><View><Text style={s.statLarge}>{Math.max(0, Math.ceil((walk.trip.etaAt - walk.now) / 60000))}</Text><Text style={s.metricLabel}>MIN TO ARRIVE</Text></View><View style={s.metricDivider} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={s.statRoute}>{walk.trip.route.label}</Text><Text style={s.metricLabel}>CHOSEN ROUTE</Text></View></View>
            {walk.demo ? <View style={{ marginTop: 12 }}><Notice tone="warning">Demo {walk.travelMode === "driving" ? "drive" : "walk"} · Location movement is simulated. Keep this screen open.</Notice></View> : null}
             {walk.travelMode === "driving" && walk.remoteStopAlertDueAt !== null ? <View style={{ marginTop: 12 }}>
               <Notice tone="warning">No mapped buildings or places were found nearby after this stop. Tagalong will warn app contacts receiving this drive in {Math.max(0, Math.ceil((walk.remoteStopAlertDueAt - walk.now) / 1000))} seconds.</Notice>
               <ActionButton title="Cancel remote-stop warning" secondary onPress={() => { void walk.cancelRemoteStopAlert(); }} style={{ marginTop: 8 }} />
             </View> : null}
             {walk.travelMode === "driving" && walk.remoteStopAlertAt !== null ? <View style={{ marginTop: 12 }}>
               <Notice tone="warning">{walk.remoteStopAlertClearedAt
                 ? `A remote-stop warning was triggered at ${new Date(walk.remoteStopAlertAt).toLocaleTimeString()}; movement resumed at ${new Date(walk.remoteStopAlertClearedAt).toLocaleTimeString()}.`
                 : `A remote-stop warning was triggered at ${new Date(walk.remoteStopAlertAt).toLocaleTimeString()}. Push delivery is not guaranteed.`}</Notice>
             </View> : null}
            {walk.error ? <View style={{ marginTop: 12 }}><Notice tone="danger">{walk.error}</Notice></View> : null}
            {!!walk.sendError ? <View style={{ marginTop: 12 }}><Notice tone="warning">Connection issue · {walk.sendError} Your contact may see an older location.</Notice></View> : null}
            {!!walk.backgroundNotice ? <View style={{ marginTop: 12 }}><Notice tone="warning">{walk.backgroundNotice}</Notice></View> : null}
            {!!walk.notice ? <View style={{ marginTop: 12 }}><Notice>{walk.notice}</Notice></View> : null}
            <ActionButton title="I’ve arrived" onPress={() => setShowArrivalConfirm(true)} style={{ marginTop: 14 }} />
            <ActionButton title="Need help" onPress={() => setShowHelpConfirm(true)} danger secondary style={{ marginTop: 9 }} />
            <Text style={s.centerNote}>Need urgent help? Call 911. Tagalong does not contact emergency services.</Text>
            <View style={s.shareCard}>
              <Eyebrow>OTHER WAYS TO SHARE</Eyebrow>
              <ActionButton title="Share link" onPress={walk.shareTrip} style={{ marginTop: 8 }} />
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/contacts")} style={s.contactsDuringWalk}><Text style={s.contactsDuringText}>{Platform.OS === "web" ? "Choose an app contact" : "Choose a phone contact"}</Text><Text style={s.contactsArrow}>›</Text></Pressable>
          </> : null}

          {walk.phase === "finished" ? <>
            <View style={[s.finishedMark, walk.finishedStatus === "help" && { backgroundColor: palette.redBg }]}><Text style={[s.finishedMarkText, walk.finishedStatus === "help" && { color: palette.red }]}>{walk.finishedStatus === "arrived" ? "✓" : walk.finishedStatus === "help" ? "!" : "—"}</Text></View>
            <SectionTitle eyebrow={walk.finishedStatus === "help" ? "Help status" : walk.finishedStatus === "expired" ? "Trip ended" : "Trip complete"}
              title={walk.finishedStatus === "help" ? walk.trip?.pendingEnd ? "Sending your help status…" : "Your trip is marked for help." : walk.finishedStatus === "expired" ? "This tracking link has expired." : "You made it."}
              subtitle={walk.finishedStatus === "help" ? "Anyone with the private trip link can view the help status. No emergency call is made." : walk.finishedStatus === "expired" ? "This trip is no longer sharing a live location." : "Location sharing has stopped for this trip."} />
            {walk.finishedStatus === "help" ? <Notice tone="danger">If you are in immediate danger, call 911 now. Tagalong cannot call for you.</Notice> : null}
            {!!walk.sendError ? <View style={{ marginTop: 13 }}><Notice tone="warning">{walk.sendError}</Notice></View> : null}
            {walk.trip?.pendingEnd ? <Text style={s.centerNote}>Your contact’s status is waiting for a connection. Keep this screen open; we’ll retry automatically. Starting another trip is unavailable until it sends.</Text> : null}
            {walk.finishedStatus === "arrived" && !walk.demo && walk.travelMode === "walking" && !walk.trip?.pendingEnd ? <ArrivalFeedback streetNames={walk.selectedRoute?.streetNames ?? walk.trip?.route.streetNames ?? []} /> : null}
            {!walk.trip?.pendingEnd ? <ActionButton title="Plan another walk" onPress={walk.reset} style={{ marginTop: 20 }} /> : null}
          </> : null}
        </ScrollView>
    </DraggableDrawer>

    <Modal visible={showStartConfirm && walk.phase === "routes" && !!route} transparent animationType="fade" onRequestClose={() => setShowStartConfirm(false)} onDismiss={onStartConfirmDismiss}>
      <View style={s.modalBackdrop}><View style={[s.modalCard, s.startModalCard]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.startModalContent}>
          <Eyebrow>{walk.travelMode === "driving" ? "BEFORE YOU DRIVE" : "BEFORE YOU START"}</Eyebrow>
          <Text style={s.modalTitle}>Share on your terms.</Text>
          {route ? <View style={s.startSummary}>
            <Text style={s.startSummaryTitle}>{route.label} · {formatMinutes(route.durationSeconds)} min{walk.travelMode === "driving" ? ` · ${formatDistance(route.distanceMeters)}` : ""}</Text>
            <Text style={s.body}>{walk.from?.label ?? "Current location"} → {walk.to?.label ?? "Destination"}</Text>
          </View> : null}
          <View style={s.startDisclosure}>
            <Text style={s.consentHeadline}>Your trip only shares when you start it.</Text>
            <Text style={s.consentLine}>{Platform.OS === "web"
              ? "If you choose to share the private trip link, anyone holding it can see your live location until sharing ends. On the web, updates work only while this page stays open."
              : "On enrolled devices, Auto-share is on by default. If it is enabled, this device is verified, and Contacts access was already granted, this real trip is added to every matched app contact’s inbox at start. You can turn Auto-share off in Contacts before starting."}</Text>
            {Platform.OS !== "web" ? <Text style={s.consentLine}>Tagalong will not ask for Contacts access when a trip starts. If access is off, there is no automatic share. Contacts without an app match are not messaged. Push is best-effort; turning Auto-share off affects future trips only.</Text> : null}
            {Platform.OS !== "web" ? <Text style={s.consentLine}>Anyone holding the private trip link can view it. Share it only with someone you trust.</Text> : null}
            {Platform.OS !== "web" ? <Text style={s.consentLine}>Sharing is active only while a real trip is active. After you allow background location once, real trips continue updating while the app is in the background. If permission is declined or unavailable, updates run only while the app is open. Android shows an ongoing location notification. Background location needs a development build; Expo Go does not support it on Android and supports it only in the iOS simulator.</Text> : null}
            {walk.travelMode === "driving" ? <Text style={s.consentLine}>Driving routes and arrival times are estimates only. Tagalong is not turn-by-turn navigation and does not monitor traffic or road closures.</Text> : null}
            <Text style={s.consentLine}>Tagalong is not a safety guarantee and does not replace calling 911 in an emergency.</Text>
          </View>
          {walk.demo ? <View style={{ marginTop: 12 }}><Notice tone="warning">{walk.result?.demo ? "This is a simulated trip. The moving location and lighting scores are not real." : `Demo ${walk.travelMode === "driving" ? "drive" : "walk"} simulates your location along the chosen route. It does not share a real location.`}</Notice></View> : null}
          {walk.error ? <View style={{ marginTop: 12 }}><Notice tone="danger">{walk.error}</Notice></View> : null}
        </ScrollView>
        <ActionButton title={walk.busy ? `Starting your ${walk.travelMode === "driving" ? "drive" : "walk"}…` : walk.travelMode === "driving" ? "Start drive" : "Start walk"} onPress={confirmStartTrip} loading={walk.busy} disabled={!route} style={{ marginTop: 10 }} />
        <ActionButton title="Not yet" secondary onPress={() => setShowStartConfirm(false)} style={{ marginTop: 9 }} />
      </View></View>
    </Modal>

    <Modal visible={showArrivalConfirm} transparent animationType="fade" onRequestClose={() => setShowArrivalConfirm(false)}>
      <View style={s.modalBackdrop}><View style={s.modalCard}>
        <Eyebrow>PLEASE CONFIRM</Eyebrow><Text style={s.modalTitle}>Have you arrived?</Text>
        <Text style={s.body}>This ends location sharing. App contacts who received this trip may get a notification; link recipients can see your arrival status when they open the link.</Text>
        <ActionButton title="Yes, I’ve arrived" onPress={() => { setShowArrivalConfirm(false); walk.endTrip("arrived"); }} style={{ marginTop: 18 }} />
        <ActionButton title={`Continue ${walk.travelMode === "driving" ? "driving" : "walking"}`} secondary onPress={() => setShowArrivalConfirm(false)} style={{ marginTop: 9 }} />
      </View></View>
    </Modal>

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
  screen: { flex: 1, backgroundColor: "#e6e8dc" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  loading: { color: palette.evergreen, fontSize: 17, fontWeight: "700", marginTop: 15 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandGroup: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(251,250,244,0.97)", paddingHorizontal: 11, paddingVertical: 8, borderRadius: 17, borderWidth: 1, borderColor: "#d7d9cb", shadowColor: palette.evergreen, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  brandMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: palette.evergreen, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  brandRing: { position: "absolute", width: 24, height: 24, borderRadius: 14, borderWidth: 1.5, borderColor: palette.citron },
  brandMarkText: { color: palette.oat, fontSize: 10, fontWeight: "900" },
  brand: { color: palette.evergreen, fontSize: 16, fontWeight: "900" },
  tagline: { color: palette.muted, fontSize: 11, fontWeight: "600" },
  contactsButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.evergreen, minHeight: 46, borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: "#426353", shadowColor: palette.evergreen, shadowOpacity: 0.2, shadowRadius: 13, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  contactsGlyph: { color: palette.citron, fontSize: 22, lineHeight: 24, fontWeight: "600" },
  contactsLabel: { color: palette.paper, fontSize: 13, fontWeight: "800" },
  panel: { width: "100%", maxWidth: 600, backgroundColor: "#fbfaf4", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 19, paddingTop: 10, borderWidth: 1, borderBottomWidth: 0, borderColor: "#d9dccf", shadowColor: "#193c32", shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -7 }, elevation: 11 },
  panelContent: { paddingBottom: 4 },
  planHeading: { flexDirection: "row", alignItems: "center" },
  panelTitle: { color: palette.evergreen, fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7 },
  panelSubtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  modeSwitch: { flexDirection: "row", gap: 6, padding: 4, marginTop: 11, backgroundColor: palette.paleGreen, borderRadius: 14 },
  modeOption: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  modeSelected: { backgroundColor: palette.evergreen },
  modeOptionText: { color: palette.muted, fontSize: 13, fontWeight: "800" },
  modeSelectedText: { color: palette.paper },
  sharedPreview: { borderRadius: 15, backgroundColor: palette.paleGreen, padding: 12, marginTop: 14, borderWidth: 1, borderColor: palette.line },
  sharedPreviewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sharedCount: { color: palette.muted, fontSize: 11, fontWeight: "800" },
  sharedRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderColor: "#D1D9C5" },
  sharedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.citronDark },
  sharedCopy: { flex: 1, minWidth: 0 },
  sharedTitle: { color: palette.evergreen, fontSize: 13, fontWeight: "800" },
  sharedSubtitle: { color: palette.muted, fontSize: 11, marginTop: 2 },
  sharedViewButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 11, borderRadius: 10, backgroundColor: palette.paper },
  sharedViewText: { color: palette.evergreen, fontSize: 12, fontWeight: "800" },
  sharedEmpty: { color: palette.muted, fontSize: 12, marginTop: 5 },
  fromRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 54, marginTop: 14, marginBottom: 13, borderRadius: 13, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 13, backgroundColor: palette.oat },
  fromCopy: { flex: 1, minWidth: 0 },
  fromLabel: { color: palette.citronDark, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  fromValue: { color: palette.evergreen, fontSize: 13, fontWeight: "700", marginTop: 3 },
  changeStart: { minHeight: 36, justifyContent: "center", paddingHorizontal: 10, borderRadius: 10, backgroundColor: palette.paper },
  changeStartText: { color: palette.evergreen, fontSize: 12, fontWeight: "800" },
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
  routeEndpoints: { flexDirection: "row", gap: 14, marginTop: 12, marginBottom: 2, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line },
  routeEndpoint: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  routeEndpointCopy: { flex: 1, minWidth: 0 },
  routeEndpointDot: { width: 18, height: 18, borderRadius: 10, borderWidth: 2, borderColor: palette.evergreen, backgroundColor: palette.paper, alignItems: "center", justifyContent: "center" },
  destinationEndpointDot: { backgroundColor: "#426b49", borderColor: "#426b49" },
  routeEndpointLabel: { color: palette.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  routeEndpointName: { color: palette.evergreen, fontSize: 12, fontWeight: "800", marginTop: 3 },
  routeChoices: { gap: 9 },
  routeCard: { backgroundColor: "#fffefa", borderColor: "#d7d9cb", borderWidth: 1.5, borderRadius: 18, padding: 15 },
  routeSelected: { borderColor: palette.evergreen, backgroundColor: "#f0f3e7", shadowColor: "#294d3c", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
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
  disclaimer: { backgroundColor: "#edf0e4", borderRadius: 15, padding: 14, marginTop: 12, borderWidth: 1, borderColor: "#dce1d0" },
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
  noticeText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  contactsDuringWalk: { minHeight: 47, marginTop: 11, borderRadius: 13, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.oat, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  contactsDuringText: { color: palette.evergreen, fontSize: 14, fontWeight: "800" },
  contactsArrow: { color: palette.citronDark, fontSize: 23, lineHeight: 25 },
  finishedMark: { width: 60, height: 60, borderRadius: 21, backgroundColor: palette.paleGreen, alignItems: "center", justifyContent: "center", marginTop: 12, marginBottom: 18 },
  finishedMarkText: { color: palette.evergreen, fontSize: 28, fontWeight: "900" },
  pressed: { opacity: 0.76 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,35,28,0.55)", justifyContent: "center", padding: 20 },
  modalCard: { alignSelf: "center", width: "100%", maxWidth: 480, backgroundColor: "#fbfaf4", padding: 22, borderRadius: 24, borderWidth: 1, borderColor: "#e2e2d8" },
  startModalCard: { maxHeight: "88%" },
  startModalContent: { paddingBottom: 4 },
  startSummary: { borderRadius: 13, padding: 12, backgroundColor: palette.paleGreen, marginBottom: 12 },
  startSummaryTitle: { color: palette.evergreen, fontSize: 15, fontWeight: "900", marginBottom: 4 },
  startDisclosure: { borderRadius: 14, padding: 14, backgroundColor: palette.oat },
  modalTitle: { color: palette.evergreen, fontSize: 25, lineHeight: 30, fontWeight: "900", marginBottom: 10 },
});
