import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { api, ApiError } from "../lib/api";
import { clearContactCountry, ensureInstallation, readInstallation, saveContactCountry, saveInstallation } from "../lib/installationStorage";
import { readDeviceContacts } from "../lib/deviceContacts";
import { enableDeviceNotifications } from "../lib/deviceNotifications";
import { rankContacts, type ContactMatch, type ContactsConfig, type DeviceContact, type IdentifierKind, type InstallationProfile, type ReceivedTrip } from "../shared/contacts";
import { clearTrackingWidget } from "../lib/trackingWidget";
import type { TripCredentials } from "../shared/types";

export function useContacts() {
  const [profile, setProfile] = useState<InstallationProfile | null>(null);
  const [config, setConfig] = useState<ContactsConfig | null>(null);
  const [contacts, setContacts] = useState<DeviceContact[]>([]), [inbox, setInbox] = useState<ReceivedTrip[]>([]);
  const [challenge, setChallenge] = useState<{ challengeId: string; expiresAt: number } | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [refreshError, setRefreshError] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [configuration, session] = await Promise.all([api.config(), readInstallation()]);
        if (!alive) return; setConfig(configuration);
        if (session) {
          const [p, box] = await Promise.all([api.profile(session), api.inbox(session)]);
          if (alive) { setProfile(p); setInbox(box.trips); }
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await saveInstallation(null);
        else if (alive) setError(e instanceof Error ? e.message : "Could not load app contacts.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!profile) return;
    let alive = true, polling = false;
    const timer = setInterval(async () => {
      if (polling) return; polling = true;
      try {
        const session = await readInstallation(); if (!session) return;
        const box = await api.inbox(session); if (alive) { setInbox(box.trips); setRefreshError(""); }
      } catch (e) { if (alive) setRefreshError(e instanceof Error ? e.message : "Could not refresh shared trips."); }
      finally { polling = false; }
    }, 10000);
    return () => { alive = false; clearInterval(timer); };
  }, [profile?.installationId]);
  async function perform(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  const enroll = () => perform(async () => { const s = await ensureInstallation(); setProfile(await api.profile(s)); });
  const begin = (kind: IdentifierKind, identifier: string, country: string) => perform(async () => {
    const s = await ensureInstallation(); setProfile(await api.profile(s));
    setChallenge(await api.verify(s, kind, identifier, country)); setNotice("Code sent. It expires in ten minutes. Don't share it with anyone.");
  });
  const confirm = (code: string) => perform(async () => {
    if (!challenge || challenge.expiresAt <= Date.now()) throw new Error("This code expired. Request a new one.");
    setProfile(await api.confirm(await ensureInstallation(), challenge.challengeId, code));
    setChallenge(null); setNotice("Verified. Other enrolled mobile users can now find you through this identifier.");
  });
  const cancelVerification = () => { setChallenge(null); setError(""); setNotice(""); };
  const sync = (country: string) => perform(async () => {
    if (Platform.OS === "web") throw new Error("Sync contacts in the iOS or Android app. Link sharing still works here.");
    const session = await ensureInstallation();
    const local = await readDeviceContacts(country);
    await saveContactCountry(country).catch(() => {});
    const hashes = [...new Set(local.flatMap(c => c.hashes))];
    const matches: ContactMatch[] = [];
    for (let i = 0; i < hashes.length; i += 250) matches.push(...(await api.discover(session, hashes.slice(i, i + 250))).matches);
    const matched = rankContacts(local, matches);
    setContacts(matched); setNotice(`Synced ${local.length} accessible contacts. ${matched.filter(c => c.installationIds.length).length} have an enrolled mobile app. Names stay on this phone.`);
  });
  const autoShare = (enabled: boolean) => perform(async () => {
    setProfile(await api.updateProfile(await ensureInstallation(), { autoShare: enabled }));
    setNotice(enabled
      ? "Automatic sharing is on. New real trips will be added to all matched, opted-in Tagalong inboxes."
      : "Automatic sharing is off. New trips won't be sent to app contacts unless you share them manually.");
  });
  const notifications = () => perform(async () => { setProfile(await enableDeviceNotifications()); setNotice("App notifications enabled on this device."); });
  const discoverable = (enabled: boolean) => perform(async () => {
    setProfile(await api.updateProfile(await ensureInstallation(), { discoverable: enabled }));
    if (!enabled) setContacts([]);
    setNotice(enabled ? "Other verified app users can find you again." : "You're hidden from new contact searches. Existing trip links still work.");
  });
  const forget = () => perform(async () => {
    const s = await readInstallation();
    if (s) { try { await api.forget(s); } catch (e) { if (!(e instanceof ApiError && e.status === 401)) throw e; } }
    await saveInstallation(null); await clearContactCountry().catch(() => {});
    setProfile(null); setContacts([]); setInbox([]); setChallenge(null); setRefreshError("");
    await clearTrackingWidget();
    setNotice("Device enrollment, matching identifiers, and notification tokens removed from Tagalong.");
  });
  const share = (trip: TripCredentials, contact: DeviceContact) => perform(async () => {
    const result = await api.shareToContact(await ensureInstallation(), trip, contact.installationIds);
    setNotice(result.notificationsQueued ? `Shared with ${contact.name}'s app. A notification is queued; delivery depends on their device and connection.`
      : `Shared with ${contact.name}'s app inbox. No push notification was queued for this share; push may be disabled or a recent notification may have been suppressed.`);
  });
  return { profile, config, contacts, inbox, challenge, busy, loading, error, refreshError, notice, enroll, begin, confirm, cancelVerification, sync, autoShare, notifications, discoverable, forget, share };
}
