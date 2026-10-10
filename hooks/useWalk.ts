import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { autoShareTrip } from "../lib/autoShare";
import { api, ApiError, shareTripLink, tripLink } from "../lib/api";
import {
  requestBackgroundLocationPermission, startBackgroundLocationUpdates, stopBackgroundLocationUpdates,
  type BackgroundPermissionState,
} from "../lib/backgroundLocation";
import { readTrip, saveTrip } from "../lib/tripStorage";
import { asPoint, pointAlong } from "../shared/geo";
import type { Place, Position, RouteOption, RouteResult, TripCredentials } from "../shared/types";

type Phase = "plan" | "routes" | "consent" | "walking" | "finished";
type ActiveTrip = TripCredentials & { route: RouteOption };
const message = (e: unknown) => e instanceof Error ? e.message : "Please try again.";
const credentials = ({ route, ...trip }: ActiveTrip): TripCredentials => trip;
async function currentPosition(): Promise<Position> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Location permission was denied. Allow location in your browser or phone settings, choose a start address, or try Demo walk.");
  const location = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Location took too long. Move near a window or try again.")), 15000)),
  ]);
  return { lat: location.coords.latitude, lng: location.coords.longitude, accuracy: location.coords.accuracy, timestamp: location.timestamp };
}
async function mapPosition(): Promise<Position | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") return null;
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 20000, requiredAccuracy: 150 });
  const location = recent ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: location.coords.latitude, lng: location.coords.longitude, accuracy: location.coords.accuracy, timestamp: location.timestamp };
}
export function useWalk() {
  const [phase, setPhase] = useState<Phase>("plan");
  const [from, setFrom] = useState<Place | null>(null), [to, setTo] = useState<Place | null>(null);
  const [demo, setDemo] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null), [selectedId, setSelectedId] = useState("");
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [mapLocation, setMapLocation] = useState<Position | null>(null);
  const [busy, setBusy] = useState(false), [restoring, setRestoring] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [sendError, setSendError] = useState("");
  const [routingAvailable, setRoutingAvailable] = useState<boolean | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finishedStatus, setFinishedStatus] = useState<"arrived" | "help" | "expired">("arrived");
  const [foreground, setForeground] = useState(true);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [backgroundNotice, setBackgroundNotice] = useState("");
  const previousForeground = useRef(true);
  const latest = useRef<Position | null>(null);
  const stopping = useRef(false);
  const autoShareAttempt = useRef(0);
  const selectedRoute = result?.routes.find(r => r.id === selectedId) ?? result?.routes[0] ?? null;
  useEffect(() => {
    const update = () => setForeground(Platform.OS === "web" ? !document.hidden : AppState.currentState !== "background" && AppState.currentState !== "inactive");
    const subscription = AppState.addEventListener("change", update);
    if (Platform.OS === "web") document.addEventListener("visibilitychange", update);
    update();
    return () => { subscription.remove(); if (Platform.OS === "web") document.removeEventListener("visibilitychange", update); };
  }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    let mounted = true;
    api.config().then(c => mounted && setRoutingAvailable(c.routingAvailable)).catch(e => mounted && setError(message(e)));
    (async () => {
      try {
        const saved = await readTrip();
        if (!saved || saved.expiresAt <= Date.now()) {
          await saveTrip(null);
          await stopBackgroundLocationUpdates();
          return;
        }
        const data = await api.track(saved.shareCode);
        if (!mounted) return;
        if (data.status !== "active") {
          await saveTrip(null);
          await stopBackgroundLocationUpdates();
          setFinishedStatus(data.status); setPhase("finished"); return;
        }
        const route: RouteOption = { id: "restored", geometry: data.route, distanceMeters: 0, durationSeconds: Math.max(1, (data.etaAt - data.startedAt) / 1000), label: saved.routeLabel ?? "Fastest", lightScore: null, lightBreakdown: { lampsPer100m: 0, activityCount: 0, litShare: 0, limitedData: true, unavailable: true, reason: "Resumed trip" } };
        setTrip({ ...saved, route }); setDemo(saved.demo);
        if (saved.pendingEnd) {
          stopping.current = true;
          await stopBackgroundLocationUpdates();
          setBackgroundEnabled(false);
          setFinishedStatus(saved.pendingEnd); setPhase("finished");
        } else {
          setPosition(data.lastLocation); latest.current = data.lastLocation; setPhase("walking");
          if (!saved.demo && Platform.OS !== "web") {
            let enabled = false;
            try {
              enabled = await startBackgroundLocationUpdates();
              if (enabled) await saveTrip(saved, true);
            } catch {}
            if (mounted) {
              setBackgroundEnabled(enabled);
              setBackgroundNotice(enabled ? "" : "Background location isn't active. This walk updates only while Safe Walk is open.");
            }
          }
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          await saveTrip(null);
          await stopBackgroundLocationUpdates();
        }
        else if (mounted) setError(`Couldn't resume your trip: ${message(e)} Reload when connected; sharing is paused.`);
      } finally { if (mounted) setRestoring(false); }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const resumed = foreground && !previousForeground.current;
    previousForeground.current = foreground;
    if (!resumed || !trip || phase !== "walking" || trip.pendingEnd || trip.demo || Platform.OS === "web") return;
    let alive = true;
    (async () => {
      try {
        const enabled = await startBackgroundLocationUpdates();
        if (!alive) return;
        if (enabled) {
          try { await saveTrip(credentials(trip), true); }
          catch {
            await stopBackgroundLocationUpdates();
            if (alive) {
              setBackgroundEnabled(false);
              setBackgroundNotice("Background location couldn't securely resume. This walk updates only while Safe Walk is open.");
            }
            return;
          }
        }
        setBackgroundEnabled(enabled);
        setBackgroundNotice(enabled ? "" : "Background location isn't active. This walk updates only while Safe Walk is open.");
      } catch {
        if (alive) {
          setBackgroundEnabled(false);
          setBackgroundNotice("Background location couldn't resume. This walk updates only while Safe Walk is open.");
        }
      }
    })();
    return () => { alive = false; };
  }, [foreground, trip, phase]);
  useEffect(() => {
    let mounted = true;
    mapPosition().then(p => { if (mounted && p) setMapLocation(p); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!trip || phase !== "walking" || trip.pendingEnd || !foreground) return;
    let alive = true, inFlight = false, subscription: Location.LocationSubscription | undefined;
    const awakeTag = `safe-walk-${Math.random().toString(36).slice(2)}`;
    let wakeActive = false;
    const releaseWake = () => {
      if (!wakeActive) return;
      wakeActive = false;
      try { Promise.resolve(deactivateKeepAwake(awakeTag)).catch(() => {}); } catch {}
    };
    activateKeepAwakeAsync(awakeTag).then(() => { wakeActive = true; if (!alive) releaseWake(); }).catch(() => {});
    const begin = Date.now(), initialFraction = trip.demo ? Math.min(1, Math.max(0, (begin - (trip.etaAt - 90000)) / 90000)) : 0;
    if (!trip.demo) {
      (async () => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") throw new Error("Location permission is off. Sharing cannot update. Enable it or end this trip.");
        const watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 }, l => {
          const p = { lat: l.coords.latitude, lng: l.coords.longitude, accuracy: l.coords.accuracy, timestamp: l.timestamp };
          if (alive && !stopping.current) { latest.current = p; setPosition(p); }
        });
        if (alive) subscription = watcher; else watcher.remove();
      })().catch(e => alive && setSendError(message(e)));
    }
    const tick = async () => {
      if (!alive || stopping.current || inFlight) return;
      if (trip.expiresAt <= Date.now()) {
        stopping.current = true; setFinishedStatus("expired"); setPhase("finished");
        await stopBackgroundLocationUpdates(); setBackgroundEnabled(false); await saveTrip(null); return;
      }
      if (trip.demo) {
        const p = { ...pointAlong(trip.route.geometry, initialFraction + (Date.now() - begin) / 90000), accuracy: 5, timestamp: Date.now() };
        latest.current = p; setPosition(p);
      }
      inFlight = true;
      try {
        if (!trip.demo) {
          // Ask for a fresh fix, including while stationary. Never relabel an old
          // GPS coordinate with a new timestamp and make it appear live.
          const fix = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("A fresh location is unavailable. Keep Safe Walk open and check location permissions.")), 15000)),
          ]);
          if (!alive || stopping.current) return;
          const p = { lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy, timestamp: fix.timestamp };
          latest.current = p; setPosition(p);
        }
        const p = latest.current;
        if (!p || !alive || stopping.current) return;
        await api.location(trip, p);
        if (alive) setSendError("");
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
          stopping.current = true; setPhase("finished"); setFinishedStatus("expired");
          await stopBackgroundLocationUpdates(); setBackgroundEnabled(false); await saveTrip(null);
        } else if (alive) setSendError(message(e));
      } finally { inFlight = false; }
    };
    tick();
    const timer = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(timer); subscription?.remove(); releaseWake(); };
  }, [trip, phase, foreground]);
  // If ending failed offline, sharing stays stopped and only the end command retries.
  useEffect(() => {
    if (!trip?.pendingEnd) return;
    let alive = true, busy = false;
    const sendEnd = async () => {
      if (busy) return; busy = true;
      try {
        await api.end(trip, trip.pendingEnd!); await saveTrip(null);
        if (alive) { setTrip(null); setSendError(""); }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          await saveTrip(null); await stopBackgroundLocationUpdates();
          if (alive) { setTrip(null); setBackgroundEnabled(false); }
        }
        else if (alive) setSendError(`Location sharing has stopped on this device. Your contact's status update is waiting for a connection. ${message(e)}`);
      } finally { busy = false; }
    };
    sendEnd(); const timer = setInterval(sendEnd, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [trip]);
  async function locateStart() {
    setBusy(true); setError("");
    try { const p = await currentPosition(); setMapLocation(p); setFrom({ ...p, label: "Current location" }); setPosition(p); latest.current = p; }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function loadDemo() {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api.demo();
      setFrom(data.from); setTo(data.to); setDemo(true); setResult(data);
      setSelectedId(data.routes.find(r => r.label === "Best lit")?.id ?? data.routes[0].id); setPhase("routes");
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function planRoutes() {
    if (!to) { setError("Choose a destination from the address search results first."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      let start = from;
      if (!start) { const p = await currentPosition(); setMapLocation(p); latest.current = p; setPosition(p); start = { ...p, label: "Current location" }; setFrom(start); }
      const data = await api.routes(start, to);
      if (!data.routes.length) throw new Error("No walking routes found. Try a nearby destination.");
      setResult(data); setSelectedId(data.routes.find(r => r.label === "Best lit")?.id ?? data.routes[0].id); setPhase("routes");
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function startTrip() {
    if (!selectedRoute || busy) return;
    const shareAttempt = ++autoShareAttempt.current;
    setBusy(true); setError(""); setSendError(""); stopping.current = false;
    setBackgroundEnabled(false); setBackgroundNotice("");
    try {
      const p = demo ? { ...asPoint(selectedRoute.geometry.coordinates[0]), accuracy: 5, timestamp: Date.now() } : await currentPosition();
      let backgroundPermission: BackgroundPermissionState = "unavailable";
      if (!demo && Platform.OS !== "web") {
        backgroundPermission = await requestBackgroundLocationPermission();
      }
      if (!demo) setMapLocation(p);
      latest.current = p; setPosition(p);
      const created = await api.createTrip(selectedRoute.geometry, demo ? 90 : selectedRoute.durationSeconds, demo);
      const next: ActiveTrip = { ...created, demo, routeLabel: selectedRoute.label, route: selectedRoute };
      try { await saveTrip(credentials(next), backgroundPermission === "granted"); }
      catch {
        // Never leave an unmanageable active trip if credential storage fails.
        await api.end(next, "arrived");
        throw new Error("Your device couldn't securely save this trip. Enable storage and try again.");
      }
      setTrip(next); setPhase("walking"); setBusy(false);
      if (!demo && Platform.OS !== "web") {
        let enabled = false;
        if (backgroundPermission === "granted") {
          try { enabled = await startBackgroundLocationUpdates(); } catch {}
        }
        setBackgroundEnabled(enabled);
        setBackgroundNotice(enabled ? "" : backgroundPermission === "denied"
          ? "Background location wasn't allowed. This walk updates only while Safe Walk is open; allow Always or Allow all the time in Settings to resume background updates."
          : backgroundPermission === "unavailable"
            ? "Background location isn't available in this app build. This walk updates only while Safe Walk is open."
            : "Background location couldn't start. This walk updates only while Safe Walk is open.");
      }
      try { await api.location(next, p); } catch (e) { setSendError(message(e)); }
      // Contact matching can take several requests; it must not block ending the walk.
      const showAutoShareNotice = (text: string) => {
        if (autoShareAttempt.current === shareAttempt && !stopping.current) setNotice(text);
      };
      try {
        const result = await autoShareTrip(credentials(next), () => autoShareAttempt.current === shareAttempt && !stopping.current);
        if (result.status === "cancelled") return;
        if (result.status === "shared") {
          showAutoShareNotice(`Walk started. Automatically shared with ${result.sharedCount} matched Safe Walk device${result.sharedCount === 1 ? "" : "s"}.${result.notificationsQueued
            ? ` ${result.notificationsQueued} push notification${result.notificationsQueued === 1 ? " was" : "s were"} queued; delivery isn't guaranteed.`
            : " The inboxes were updated, but no push notification was queued."}`);
        } else if (result.status === "partial") {
          showAutoShareNotice(`Walk started. Automatically shared with ${result.sharedCount} device${result.sharedCount === 1 ? "" : "s"}, but some matches could not be reached. ${result.error ?? ""}`);
        } else if (result.status === "failed") {
          showAutoShareNotice(`Walk started, but automatic sharing failed. Your walk may not appear in matched contacts' inboxes. ${result.error ?? ""}`);
        } else if (result.status === "off") {
          showAutoShareNotice("Walk started. Automatic sharing is off; share manually with a trusted person if needed.");
        } else if (result.status === "no-permission") {
          showAutoShareNotice("Walk started. Contacts access is off, so this walk was not automatically shared.");
        } else if (result.status === "unverified") {
          showAutoShareNotice("Walk started. Verify your device in Contacts before using automatic app sharing.");
        } else if (result.status === "not-enrolled") {
          showAutoShareNotice("Walk started. App contact matching isn't enabled on this device, so no automatic share was sent.");
        } else if (result.status === "no-current-recipients") {
          showAutoShareNotice("Walk started. No current matched app devices could receive the share.");
        } else if (result.status === "no-matches") {
          showAutoShareNotice("Walk started. No matched Safe Walk contacts were found; no automatic share was sent.");
        } else if (result.status === "demo") {
          showAutoShareNotice("Demo walk started. Simulated walks aren't automatically shared.");
        } else if (result.status === "unsupported") {
          showAutoShareNotice("Walk started. Automatic app matching is available in the iOS and Android app; share the private link here.");
        } else {
          showAutoShareNotice("Walk started. Use Contacts to share with app contacts or send the private link.");
        }
      } catch (e) {
        showAutoShareNotice(`Walk started, but automatic sharing couldn't complete. Your walk is still active. ${message(e)}`);
      }
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function endTrip(status: "arrived" | "help") {
    if (!trip) return;
    autoShareAttempt.current += 1;
    stopping.current = true;
    setFinishedStatus(status); setPhase("finished");
    const next = { ...trip, pendingEnd: status };
    try { await saveTrip(credentials(next)); } catch { setSendError("Device storage is unavailable. Keep this screen open until the status update is sent."); }
    await stopBackgroundLocationUpdates();
    setBackgroundEnabled(false);
    setTrip(next);
  }
  async function shareTrip() {
    if (!trip) return;
    try { setNotice(await shareTripLink(trip.shareCode)); } catch (e) { setError(message(e)); }
  }
  function reset() {
    if (trip?.pendingEnd) return;
    autoShareAttempt.current += 1;
    void stopBackgroundLocationUpdates();
    setBackgroundEnabled(false); setBackgroundNotice("");
    stopping.current = false; setTrip(null); setResult(null); setPhase("plan"); setError(""); setNotice(""); setSendError(""); setDemo(false);
  }
  return {
    phase, from, to, setFrom, setTo, demo, setDemo, result, selectedRoute, foreground, backgroundEnabled, backgroundNotice,
    mapLocation,
    selectRoute: setSelectedId, trip, position, busy, restoring, error, notice, sendError, now, routingAvailable, finishedStatus,
    locateStart, loadDemo, planRoutes, startTrip, endTrip, shareTrip, reset,
    reviewConsent: () => setPhase("consent"), backToRoutes: () => setPhase("routes"),
    editPlan: () => { setPhase("plan"); setResult(null); setError(""); },
    clearError: () => setError(""),
    shareUrl: trip ? tripLink(trip.shareCode) : "",
  };
}
