import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SMS from "expo-sms";
import { ActionButton, BrandHeader, Eyebrow, Notice, SectionTitle } from "../components/WalkUI";
import { common, palette } from "../constants/theme";
import { useContacts } from "../hooks/useContacts";
import { tripLink } from "../lib/api";
import { readTrip } from "../lib/tripStorage";
import type { DeviceContact, ReceivedTrip } from "../shared/contacts";
import type { TripCredentials } from "../shared/types";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";

export default function NativeContacts() {
  const c = useContacts();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [country, setCountry] = useState("US");
  const [search, setSearch] = useState("");
  const [trip, setTrip] = useState<TripCredentials | null>(null);
  const [linkNotice, setLinkNotice] = useState("");
  const [sharingId, setSharingId] = useState("");
  const verified = !!c.profile?.verifiedKinds.length;

  useEffect(() => {
    readTrip()
      .then(value => { if (value && !value.pendingEnd && value.expiresAt > Date.now()) setTrip(value); })
      .catch(() => setLinkNotice("Your active trip couldn't be loaded. Return to the map and try again."));
  }, []);

  const contacts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return c.contacts.filter(contact => {
      if (!query) return true;
      const searchable = [
        contact.name,
        ...(contact.phoneNumbers ?? []).map(phone => phone.number),
        ...(contact.emails ?? []),
      ].join(" ").toLocaleLowerCase();
      return searchable.includes(query);
    });
  }, [c.contacts, search]);

  async function shareLink(phone?: string, key = "anyone") {
    if (!trip || sharingId) return;
    setSharingId(key); setLinkNotice("");
    try {
      const url = tripLink(trip.shareCode);
      const message = `Follow my Safe Walk trip: ${url}`;
      if (phone && await SMS.isAvailableAsync()) {
        const result = await SMS.sendSMSAsync([phone], message);
        if (result.result === "cancelled") setLinkNotice("Message cancelled. The link wasn't sent.");
        else if (result.result === "sent") setLinkNotice("Your messaging app reports that the message was sent. Delivery isn't guaranteed.");
        else setLinkNotice("Your messaging app opened. Safe Walk can't confirm whether the message was sent.");
      } else {
        const result = await Share.share({ message });
        setLinkNotice(result.action === Share.dismissedAction
          ? "Sharing cancelled. No link was sent."
          : "Choose a messaging app and recipient to share the private trip link.");
      }
    } catch (e) {
      setLinkNotice(e instanceof Error ? e.message : "Couldn't open the message composer.");
    } finally {
      setSharingId("");
    }
  }

  function removeEnrollment() {
    Alert.alert(
      "Remove this device?",
      "This deletes matching identifiers, app inbox associations, and notification tokens from Safe Walk. Your phone's contacts are not deleted. Existing private trip links still work.",
      [
        { text: "Keep enrollment", style: "cancel" },
        { text: "Remove enrollment", style: "destructive", onPress: () => { void c.forget(); } },
      ],
    );
  }

  function openTrip(item: ReceivedTrip) {
    router.push(`/track/${item.shareCode}`);
  }

  return (
    <View style={[common.page, { paddingTop: insets.top }]}>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={[common.content, { gap: 16, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <BrandHeader />
          <Pressable accessibilityRole="button" accessibilityLabel="Back to map"
            onPress={() => router.canGoBack() ? router.back() : router.replace("/")}>
            <Text style={styles.back}>Back to map</Text>
          </Pressable>
        </View>
        <SectionTitle eyebrow="Optional app contacts" title="Share with a trusted person."
          subtitle="Safe Walk is account-free. Matched, opted-in contacts can receive an in-app trip and live preview. Auto-share is on by default for enrolled devices; change it in Device settings." />
        {c.loading ? <Text style={styles.small}>Loading Safe Walk contacts…</Text> : null}
        {c.error ? <Notice tone="warning">{c.error}</Notice> : null}
        {c.notice ? <Notice>{c.notice}</Notice> : null}
        {c.refreshError ? <Notice tone="warning">Shared trips couldn't refresh. {c.refreshError}</Notice> : null}
        {linkNotice ? <Notice>{linkNotice}</Notice> : null}

        {c.profile ? <View style={common.card}>
          <Eyebrow>Shared trips</Eyebrow>
          <Text style={styles.body}>New app shares appear here automatically. Tap one to open its live tracking preview. The inbox refreshes while this screen is open.</Text>
          {c.inbox.length ? c.inbox.map(item => <InboxRow key={item.shareCode} item={item} onPress={() => openTrip(item)} />)
            : <Text style={styles.small}>No unexpired trips have been shared with this device.</Text>}
        </View> : null}

        {trip ? <View style={common.card}>
          <Eyebrow>{`Your active ${trip.travelMode === "driving" ? "drive" : "walk"}`}</Eyebrow>
          <Text style={styles.body}>Matched contacts receive an in-app share automatically when auto-share is on. Contacts without a match are not messaged; send the private link only to someone you choose.</Text>
          <ActionButton title="Share link another way" secondary disabled={!!sharingId}
            onPress={() => shareLink()} style={{ marginTop: 10 }} />
        </View> : null}

        {!c.profile && !c.loading ? <View style={common.card}>
          <Eyebrow>Optional app matching</Eyebrow>
          <Text style={styles.body}>To search for enrolled Safe Walk users, verify your own email once. This sends a code to you only; it does not email your contacts. Trip planning and private-link sharing stay account-free.</Text>
          <ActionButton title="Enable app contact matching" onPress={c.enroll} loading={c.busy} style={{ marginTop: 10 }} />
        </View> : null}

        {c.profile && !verified ? <View style={common.card}>
          <Eyebrow>Verify your email</Eyebrow>
          <Text style={styles.body}>This verifies your device for private contact matching. The verification code goes to your email; no code is sent to the contacts you select.</Text>
          {!c.challenge ? <>
            <TextInput accessibilityLabel="Your email address" autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" value={identifier} onChangeText={setIdentifier}
              placeholder="you@example.com" placeholderTextColor={palette.muted} style={styles.input} />
            <ActionButton title="Send verification code" onPress={() => c.begin("email", identifier, country)}
              loading={c.busy} disabled={!identifier.trim() || !c.config?.emailVerificationAvailable} />
            {!c.config?.emailVerificationAvailable
              ? <Text style={styles.small}>Email verification isn't configured. You can still share a private link.</Text>
              : null}
          </> : <>
            <TextInput accessibilityLabel="Six-digit verification code" keyboardType="number-pad"
              autoComplete="one-time-code" maxLength={6} value={code} onChangeText={setCode}
              placeholder="Six-digit code" placeholderTextColor={palette.muted} style={styles.input} />
            <ActionButton title="Verify code" onPress={() => c.confirm(code)} loading={c.busy}
              disabled={!/^\d{6}$/.test(code)} />
            <ActionButton title="Request a new code" secondary onPress={() => c.begin("email", identifier, country)}
              disabled={c.busy} style={{ marginTop: 8 }} />
            <ActionButton title="Use a different email" secondary
              onPress={() => { c.cancelVerification(); setCode(""); }} disabled={c.busy} style={{ marginTop: 8 }} />
          </>}
        </View> : null}

        {verified ? <>
          <View style={common.card}>
            <Eyebrow>Find opted-in Safe Walk users</Eyebrow>
            <Text style={styles.body}>Names and raw contact details stay on this phone. Phone and email identifiers are normalized and hashed locally; only the hashes are sent to find verified, discoverable Safe Walk devices. When auto-share is on, this check runs again when each real trip starts.</Text>
            <Text style={styles.small}>Country for phone numbers without a + prefix:</Text>
            <TextInput accessibilityLabel="Contact phone-number country code" maxLength={2}
              autoCapitalize="characters" value={country} onChangeText={value => setCountry(value.toUpperCase())}
              style={[styles.input, { width: 90 }]} />
            <ActionButton title={c.busy ? "Syncing contacts…" : c.contacts.length ? "Sync contacts again" : "Sync my phone contacts"}
              onPress={() => c.sync(country)} loading={c.busy} disabled={c.busy} />
          </View>
          {c.contacts.length ? <View style={common.card}>
            <Eyebrow>{`Phone contacts · ${c.contacts.length}`}</Eyebrow>
            <TextInput accessibilityLabel="Search synced contacts" value={search} onChangeText={setSearch}
              placeholder="Search by name, phone, or email" placeholderTextColor={palette.muted} style={styles.input} />
            {contacts.map(contact => <ContactRow key={contact.id} contact={contact} trip={trip}
              busy={c.busy || !!sharingId} sharingId={sharingId} onShareInApp={() => trip && c.share(trip, contact)}
              onShareLink={phone => shareLink(phone, `${contact.id}:${phone ?? "share"}`)} />)}
            {!contacts.length ? <Text style={styles.small}>No contacts match that search.</Text> : null}
          </View> : <View style={common.card}>
            <Eyebrow>Phone contacts</Eyebrow>
            <Text style={styles.body}>Sync your phone's accessible contacts to find opted-in app users. Contacts without a match can still receive a private link.</Text>
          </View>}
        </> : null}

        {c.profile ? <>
          <View style={common.card}>
            <Eyebrow>Device settings</Eyebrow>
            <View style={styles.setting}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Automatically share new trips</Text>
                <Text style={styles.small}>{c.profile.autoShare
                  ? "On by default and currently on. If this device is verified and Contacts access is already granted, each real trip is added to every matched, opted-in contact's inbox. Turning this off affects future trips, not shares in progress."
                  : "Currently off. New trips are not automatically shared; turning it on applies to future trips only and does not change a share already in progress."}</Text>
              </View>
              <Switch accessibilityLabel="Automatically share new trips with matched Safe Walk contacts"
                value={c.profile.autoShare} disabled={c.busy} onValueChange={c.autoShare} />
            </View>
            <Text style={styles.small}>Safe Walk checks locally hashed phone/email identifiers only when Contacts access is already granted; it will not ask for access at walk start. Names and raw contact details stay on this phone. Push notifications are best-effort. Contacts without an app match are not messaged automatically.</Text>
            {verified ? <View style={styles.setting}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Discoverable to app contacts</Text>
                <Text style={styles.small}>Turn this off to stop appearing in new contact searches.</Text>
              </View>
              <Switch accessibilityLabel="Discoverable to app contacts" value={c.profile.discoverable}
                disabled={c.busy} onValueChange={c.discoverable} />
            </View> : null}
            <Text style={styles.body}>Push notifications: {c.profile.notificationsEnabled ? "enabled on this device" : "not enabled"}. Inbox shares still work without push.</Text>
            <ActionButton title={c.profile.notificationsEnabled ? "Refresh notification registration" : "Enable app notifications"}
              secondary loading={c.busy} disabled={c.busy} onPress={c.notifications} />
            <Text style={styles.small}>Push delivery is best-effort and requires a native build and notification permission. Expo Go does not support remote push notifications.</Text>
            <ActionButton title="Remove app contact enrollment" danger secondary onPress={removeEnrollment}
              disabled={c.busy} style={{ marginTop: 15 }} />
          </View>
        </> : null}
      </ScrollView>
    </View>
  );
}

function ContactRow({ contact, trip, busy, sharingId, onShareInApp, onShareLink }: {
  contact: DeviceContact; trip: TripCredentials | null; busy: boolean; sharingId: string;
  onShareInApp: () => void; onShareLink: (phone?: string) => void;
}) {
  const matched = contact.installationIds.length > 0;
  return <View style={styles.contact}>
    <View style={{ flex: 1, marginBottom: 6 }}>
      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.small}>{matched
        ? `On Safe Walk · ${contact.notificationsEnabled ? "notifications enabled" : "inbox only"}`
        : contact.phoneNumbers?.length ? "No opted-in Safe Walk match · share a link" : "No match · share through another app"}</Text>
      {contact.phoneNumbers?.map((phone, index) => <Text key={`${phone.number}-${index}`} style={styles.small}>
        {phone.label} · {phone.number}
      </Text>)}
      {!contact.phoneNumbers?.length && contact.emails?.length ? <Text style={styles.small}>Email-only contact</Text> : null}
    </View>
    {trip ? matched
      ? <View style={styles.actions}>
        <ActionButton title="Share in Safe Walk" secondary disabled={busy} onPress={onShareInApp} />
        <ActionButton title="Use a private link instead" secondary disabled={busy} onPress={() => onShareLink()} style={{ marginTop: 8 }} />
      </View>
      : contact.phoneNumbers?.length
        ? <View style={styles.actions}>{contact.phoneNumbers.map((phone, index) => {
          const key = `${contact.id}:${phone.number}`;
          return <ActionButton key={key} title={sharingId === key ? "Opening…" : `Text link · ${phone.label}`}
            secondary disabled={busy} onPress={() => onShareLink(phone.number)} style={index ? { marginTop: 8 } : undefined} />;
        })}</View>
        : <ActionButton title="Share private link" secondary disabled={busy}
          onPress={() => onShareLink()} />
      : null}
  </View>;
}

function InboxRow({ item, onPress }: { item: ReceivedTrip; onPress: () => void }) {
  const status = item.status === "help" ? "Help requested" : item.status === "arrived" ? "Arrived" : "Active";
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${status.toLowerCase()} shared trip`}
    onPress={onPress} style={styles.inboxRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.name}>{item.demo ? item.travelMode === "driving" ? "Demo drive" : "Demo walk" : item.travelMode === "driving" ? "Shared drive" : "Shared walk"} · {status}</Text>
      <Text style={styles.small}>ETA {new Date(item.etaAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Tap to open live preview</Text>
    </View>
    <Text style={styles.back}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { color: palette.evergreen, fontWeight: "800", padding: 10 },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21, marginVertical: 7 },
  small: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  input: { backgroundColor: palette.paper, color: palette.evergreen, borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 14, fontSize: 16, marginVertical: 12 },
  contact: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: palette.line },
  name: { color: palette.evergreen, fontWeight: "800", fontSize: 15 },
  setting: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 15 },
  actions: { alignSelf: "stretch" },
  inboxRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: palette.line },
});
