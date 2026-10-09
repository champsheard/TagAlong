import { useEffect, useMemo, useState } from "react";
import * as SMS from "expo-sms";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, FlatList, Linking, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { ActionButton, BrandHeader, Eyebrow, Notice, SectionTitle } from "../components/WalkUI";
import { common, palette } from "../constants/theme";
import { PhoneContactsPermissionError, readPhoneRecipients, type PhoneRecipient } from "../lib/phoneContacts.native";
import { ApiError, api, tripLink } from "../lib/api";
import { clearTrackingWidget } from "../lib/trackingWidget";
import { readInstallation, saveInstallation } from "../lib/installationStorage";
import { readTrip } from "../lib/tripStorage";
import type { InstallationSession } from "../shared/contacts";
import type { TripCredentials } from "../shared/types";

export default function NativeContacts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<TripCredentials | null>(null);
  const [contacts, setContacts] = useState<PhoneRecipient[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsNeeded, setSettingsNeeded] = useState(false);
  const [sharingId, setSharingId] = useState("");
  const [legacySession, setLegacySession] = useState<InstallationSession | null>(null);
  const [removingLegacy, setRemovingLegacy] = useState(false);

  useEffect(() => {
    let mounted = true;
    readTrip()
      .then(value => {
        if (mounted && value && !value.pendingEnd && value.expiresAt > Date.now()) setTrip(value);
      })
      .catch(() => { if (mounted) setError("Your active walk couldn't be loaded. Return to the map and try again."); });
    readInstallation()
      .then(value => { if (mounted) setLegacySession(value); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const visibleContacts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return contacts.filter(contact => !query ||
      contact.name.toLocaleLowerCase().includes(query) || contact.number.toLocaleLowerCase().includes(query));
  }, [contacts, search]);

  async function loadContacts() {
    if (busy) return;
    setBusy(true); setError(""); setNotice(""); setSettingsNeeded(false);
    try {
      const found = await readPhoneRecipients();
      setContacts(found);
      setNotice(found.length
        ? `${found.length} phone numbers are available on this device. Names and numbers stay on your phone.`
        : "No contacts with phone numbers were found.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read your phone contacts.");
      setSettingsNeeded(e instanceof PhoneContactsPermissionError && !e.canAskAgain);
    } finally {
      setBusy(false);
    }
  }

  async function messageLink(contact: PhoneRecipient) {
    if (!trip || sharingId) return;
    setSharingId(contact.id); setError(""); setNotice("");
    try {
      const url = tripLink(trip.shareCode);
      const message = `Follow my Safe Walk trip: ${url}`;
      if (await SMS.isAvailableAsync()) {
        const result = await SMS.sendSMSAsync([contact.number], message);
        if (result.result === "cancelled") setNotice("Message cancelled. The link wasn't sent.");
        else if (result.result === "sent") setNotice("Your Messages app reports that the message was sent. Delivery isn't guaranteed.");
        else setNotice("Your messaging app opened. Safe Walk can't confirm whether the message was sent.");
      } else {
        const result = await Share.share({ message });
        setNotice(result.action === Share.dismissedAction
          ? "Sharing cancelled. No link was sent."
          : "Choose a messaging app and recipient to share the private walk link.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the message composer.");
    } finally {
      setSharingId("");
    }
  }

  function confirmRemoveLegacyEnrollment() {
    if (!legacySession || removingLegacy) return;
    Alert.alert(
      "Remove previous app matching?",
      "This deletes this device's old matching identifiers, shared-trip inbox associations, and notification tokens. Your phone contacts and active walk link are not deleted.",
      [
        { text: "Keep it", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => { void removeLegacyEnrollment(); } },
      ],
    );
  }

  async function removeLegacyEnrollment() {
    const session = legacySession;
    if (!session || removingLegacy) return;
    setRemovingLegacy(true); setError(""); setNotice("");
    try {
      try { await api.forget(session); }
      catch (e) { if (!(e instanceof ApiError && e.status === 401)) throw e; }
      await saveInstallation(null);
      setLegacySession(null);
      let widgetClearFailed = false;
      try { await clearTrackingWidget(); }
      catch { widgetClearFailed = true; }
      setNotice(widgetClearFailed
        ? "Previous app matching and notification registration have been removed, but the old trip widget couldn't be cleared. Private links still work."
        : "Previous app matching and notification registration have been removed. Private links still work.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the previous app enrollment.");
    } finally {
      setRemovingLegacy(false);
    }
  }

  return (
    <FlatList
      style={common.page}
      contentContainerStyle={[common.content, { gap: 16, paddingTop: insets.top, paddingBottom: insets.bottom + 40 }]}
      data={visibleContacts}
      keyExtractor={contact => contact.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={{ gap: 16 }}>
        <View style={styles.header}>
          <BrandHeader />
          <Pressable accessibilityRole="button" accessibilityLabel="Back to map"
            onPress={() => router.canGoBack() ? router.back() : router.replace("/")}>
            <Text style={styles.back}>Back to map</Text>
          </Pressable>
        </View>
        <SectionTitle eyebrow="Private link sharing" title="Choose someone you trust."
          subtitle="Select a phone contact and open a message with your active walk link. You review it and decide whether to send." />
        <View style={common.card}>
          <Eyebrow>Contacts stay on your phone</Eyebrow>
          <Text style={styles.body}>Safe Walk reads names and phone numbers only after you grant access. Your address book is not uploaded, and Safe Walk does not send the message for you.</Text>
          {trip
            ? <Text style={styles.small}>Anyone with the private link can view live location and trip status until it expires. Share it only with someone you trust.</Text>
            : <Text style={styles.small}>Start a walk first to create a private link. You can load your contacts now and share the link while the walk is active.</Text>}
          <ActionButton title={busy ? "Reading phone contacts…" : contacts.length ? "Refresh phone contacts" : "Choose from phone contacts"}
            onPress={loadContacts} loading={busy} disabled={busy} style={{ marginTop: 12 }} />
        </View>
        {legacySession ? <View style={common.card}>
          <Eyebrow>Previous app matching</Eyebrow>
          <Text style={styles.body}>An older version may still have this device enrolled for app-to-app matching and notifications. New shares from this screen use private links only.</Text>
          <ActionButton title={removingLegacy ? "Removing previous enrollment…" : "Remove previous app matching"}
            danger secondary loading={removingLegacy} disabled={removingLegacy}
            onPress={confirmRemoveLegacyEnrollment} style={{ marginTop: 12 }} />
        </View> : null}
        {settingsNeeded ? <ActionButton title="Open phone settings" secondary
          onPress={() => { void Linking.openSettings().catch(() => setError("Couldn't open phone settings. Use your device Settings app to allow contacts access.")); }} /> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice>{notice}</Notice> : null}
        {contacts.length ? <>
          <View style={common.card}>
            <Eyebrow>{`Phone contacts · ${contacts.length}`}</Eyebrow>
            <TextInput accessibilityLabel="Search phone contacts" value={search} onChangeText={setSearch}
              placeholder="Search by name or phone" placeholderTextColor={palette.muted} style={styles.input} />
          </View>
          {!visibleContacts.length ? <Text style={styles.small}>No contacts match that search.</Text> : null}
        </> : null}
      </View>}
      renderItem={({ item }) => (
        <View style={[common.card, styles.contact]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.small}>{item.label} · {item.number}</Text>
          </View>
          <ActionButton title={sharingId === item.id ? "Opening…" : "Message link"}
            secondary disabled={!trip || busy || !!sharingId}
            onPress={() => messageLink(item)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { color: palette.evergreen, fontWeight: "800", padding: 10 },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21, marginVertical: 7 },
  small: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  input: { backgroundColor: palette.paper, color: palette.evergreen, borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 14, fontSize: 16, marginTop: 12 },
  contact: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  name: { color: palette.evergreen, fontWeight: "800", fontSize: 15 },
});
