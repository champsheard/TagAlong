import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionButton, BrandHeader, Eyebrow, Notice, SectionTitle } from "../components/WalkUI";
import { common, palette } from "../constants/theme";
import { useContacts } from "../hooks/useContacts";
import { readTrip } from "../lib/tripStorage";
import { shareTripLink } from "../lib/api";
import type { TripCredentials } from "../shared/types";
import type { IdentifierKind } from "../shared/contacts";

export default function Contacts() {
  const c = useContacts(), router = useRouter(), insets = useSafeAreaInsets();
  const [kind, setKind] = useState<IdentifierKind>("email"), [identifier, setIdentifier] = useState(""), [code, setCode] = useState("");
  const [country, setCountry] = useState("US"), [search, setSearch] = useState(""), [trip, setTrip] = useState<TripCredentials | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false), [linkNotice, setLinkNotice] = useState("");
  useEffect(() => { readTrip().then(t => { if (t && !t.pendingEnd && t.expiresAt > Date.now()) setTrip(t); }).catch(() => setLinkNotice("Your trip credentials couldn't be loaded. Return to the map to retry.")); }, []);
  const verified = !!c.profile?.verifiedKinds.length;
  const contacts = c.contacts.filter(contact => contact.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const sendLink = async () => {
    if (!trip) return;
    try { setLinkNotice(await shareTripLink(trip.shareCode)); } catch (e) { setLinkNotice(e instanceof Error ? e.message : "Couldn't share the link."); }
  };
  return <View style={[common.page, { paddingTop: insets.top }]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[common.content, { gap: 16, paddingBottom: insets.bottom + 40 }]}>
      <View style={s.header}><BrandHeader /><Pressable accessibilityRole="button" accessibilityLabel="Back to map" onPress={() => router.canGoBack() ? router.back() : router.replace("/")}><Text style={s.back}>Back to map</Text></Pressable></View>
      <SectionTitle eyebrow="Optional contact sync" title="A trusted person, one tap away." subtitle="Find enrolled app contacts first. A private trip link still works for anyone, without an account." />
      {c.loading ? <ActivityIndicator color={palette.evergreen} /> : null}
      {c.error ? <Notice tone="warning">{c.error}</Notice> : null}{c.notice ? <Notice>{c.notice}</Notice> : null}
      {c.refreshError ? <Notice tone="warning">Shared trips couldn't refresh. {c.refreshError}</Notice> : null}
      {linkNotice ? <Notice>{linkNotice}</Notice> : null}
      {c.profile ? <View style={common.card}>
        <Eyebrow>Shared trips</Eyebrow>
        <Text style={s.body}>New app shares appear here automatically. Open one to see its live tracking view.</Text>
        {c.inbox.length ? c.inbox.map(t => <Pressable key={t.shareCode} accessibilityRole="button" onPress={() => router.push(`/track/${t.shareCode}`)} style={s.contact}>
          <View><Text style={s.name}>{t.demo ? t.travelMode === "driving" ? "Demo drive" : "Demo walk" : t.travelMode === "driving" ? "Shared drive" : "Shared walk"} · {t.status === "help" ? "Help requested" : t.status === "arrived" ? "Arrived" : "Active"}</Text><Text style={s.small}>ETA {new Date(t.etaAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Open tracking map</Text></View>
        </Pressable>) : <Text style={s.small}>No unexpired trips have been shared with this device.</Text>}
      </View> : null}
      {trip ? <View style={common.card}><Eyebrow>{`Your active ${trip.travelMode === "driving" ? "drive" : "walk"}`}</Eyebrow><Text style={s.body}>Choose an app contact below, or send the private link through your usual messaging app.</Text><ActionButton title="Share a link with anyone" secondary onPress={sendLink} style={{ marginTop: 12 }} /></View> : null}
      <View style={common.card}>
        <Eyebrow>Privacy and choice</Eyebrow>
        <Text style={s.body}>Contact names stay on your phone. Phone numbers and emails are normalized and hashed on-device for matching. Tagalong stores keyed matching hashes, not your address book.</Text>
        <Text style={s.body}>To prove ownership, your own phone number or email is sent temporarily to the server and its verification provider. Other verified app users who have that identifier can discover your enrolled device.</Text>
        <Text style={s.body}>Contact sync is opt-in. You can hide or remove enrollment below. Trip planning and link tracking stay account-free.</Text>
        {!c.profile && !c.loading ? <ActionButton title="Enable optional app contacts" onPress={c.enroll} loading={c.busy} style={{ marginTop: 12 }} /> : null}
      </View>
      {c.profile ? <View style={common.card}>
        <Eyebrow>{verified ? `Verified ${c.profile.verifiedKinds.join(" and ")}` : "Verify your identifier"}</Eyebrow>
        <Text style={s.body}>{verified ? "You can verify a second identifier so contacts can find you by either phone or email." : "Verify a phone number or email before finding app contacts. No password or public profile is created."}</Text>
        <View style={s.row}>{(["email", "phone"] as const).map(value => <Pressable key={value} accessibilityRole="button" disabled={!!c.challenge || c.busy} accessibilityState={{ selected: kind === value, disabled: !!c.challenge || c.busy }} onPress={() => { setKind(value); setIdentifier(""); }} style={[s.tab, kind === value && s.selected]}><Text style={[s.tabText, kind === value && { color: palette.paper }]}>{value === "phone" ? "Phone" : "Email"}</Text></Pressable>)}</View>
        {!c.challenge ? <>
          <TextInput accessibilityLabel={kind === "phone" ? "Your phone number" : "Your email address"} autoCapitalize="none" autoCorrect={false} keyboardType={kind === "phone" ? "phone-pad" : "email-address"} value={identifier} onChangeText={setIdentifier} placeholder={kind === "phone" ? "+1 415 555 0123" : "you@example.com"} placeholderTextColor={palette.muted} style={s.input} />
          <ActionButton title="Send verification code" onPress={() => c.begin(kind, identifier, country)} loading={c.busy} disabled={!identifier.trim() || (kind === "phone" ? !c.config?.smsVerificationAvailable : !c.config?.emailVerificationAvailable)} />
          {(kind === "phone" ? !c.config?.smsVerificationAvailable : !c.config?.emailVerificationAvailable) ? <Text style={s.small}>{kind === "phone" ? "Phone verification isn't configured yet. The app needs a connected Twilio SMS sender." : "Email verification isn't configured yet. The app needs Resend and a verified sender address."} You can still share a link.</Text> : null}
        </> : <>
          <TextInput accessibilityLabel="Six-digit verification code" keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} value={code} onChangeText={setCode} placeholder="Six-digit code" placeholderTextColor={palette.muted} style={s.input} />
          <ActionButton title="Verify code" onPress={() => c.confirm(code)} loading={c.busy} disabled={!/^\d{6}$/.test(code)} />
          <ActionButton title="Request a new code" secondary onPress={() => c.begin(kind, identifier, country)} disabled={c.busy} style={{ marginTop: 8 }} />
          <ActionButton title="Use a different phone or email" secondary onPress={() => { c.cancelVerification(); setCode(""); }} disabled={c.busy} style={{ marginTop: 8 }} />
        </>}
      </View> : null}
      {verified ? <>
        <View style={common.card}>
          <Eyebrow>Find your app contacts</Eyebrow>
          <Text style={s.body}>Choose Sync contacts to grant phone access. Only accessible contacts are read; app users appear first. Non-app contacts use the regular share link.</Text>
          <Text style={s.small}>Country for phone numbers without a + prefix (two-letter code):</Text>
          <TextInput accessibilityLabel="Contact phone-number country code" maxLength={2} autoCapitalize="characters" value={country} onChangeText={v => setCountry(v.toUpperCase())} style={[s.input, { width: 90 }]} />
          <ActionButton title={c.contacts.length ? "Sync contacts again" : "Sync my phone contacts"} onPress={() => c.sync(country)} loading={c.busy} disabled={Platform.OS === "web"} />
          {Platform.OS === "web" ? <Text style={s.small}>Sync is available in the iOS and Android app, not this browser.</Text> : null}
        </View>
        <View style={common.card}>
          <Eyebrow>{`Contacts · ${c.contacts.length}`}</Eyebrow>
          {c.contacts.length ? <TextInput accessibilityLabel="Search synced contact names" value={search} onChangeText={setSearch} placeholder="Search your contacts" placeholderTextColor={palette.muted} style={s.input} /> : <Text style={s.body}>Sync your phone's accessible contacts to see matches here.</Text>}
          {contacts.map(contact => <View key={contact.id} style={s.contact}>
            <View style={{ flex: 1 }}><Text style={s.name}>{contact.name}</Text><Text style={s.small}>{contact.installationIds.length ? `On Tagalong · ${contact.notificationsEnabled ? "notifications enabled" : "inbox only"}` : "Share a link · no enrolled mobile match"}</Text></View>
            {trip ? <ActionButton title={contact.installationIds.length ? "Share in app" : "Share link"} secondary disabled={c.busy} onPress={() => contact.installationIds.length ? c.share(trip, contact) : sendLink()} /> : null}
          </View>)}
        </View>
      </> : null}
      {c.profile ? <>
        <View style={common.card}>
          <Eyebrow>Device settings</Eyebrow>
          {verified ? <View style={s.setting}><View style={{ flex: 1 }}><Text style={s.name}>Discoverable to app contacts</Text><Text style={s.small}>Hide from new matches without affecting existing links.</Text></View><Switch accessibilityLabel="Discoverable to app contacts" value={c.profile.discoverable} disabled={c.busy} onValueChange={c.discoverable} /></View> : null}
          <Text style={s.body}>Notifications: {c.profile.notificationsEnabled ? "registered on this device" : "not enabled"}</Text>
          <ActionButton title={c.profile.notificationsEnabled ? "Refresh notification registration" : "Enable app notifications"} secondary disabled={Platform.OS === "web"} loading={c.busy} onPress={c.notifications} />
          <Text style={s.small}>Push and live widgets require a native build. iOS Live Activities need server APNs configuration for background updates. Android widgets rely on device notification delivery.</Text>
          <ActionButton title="Remove contact enrollment" danger secondary onPress={() => setConfirmDelete(true)} disabled={c.busy} style={{ marginTop: 15 }} />
        </View>
      </> : null}
    </ScrollView>
    <Modal transparent visible={confirmDelete} animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
      <View style={s.overlay}><View style={[common.card, { width: "100%", maxWidth: 460 }]}><SectionTitle eyebrow="Please confirm" title="Remove this device?" subtitle="Deletes matching identifiers, app inbox associations and notification tokens from the server. Your phone's contacts are not deleted. Existing private trip links still work." />
        <ActionButton title="Remove enrollment" danger onPress={() => { setConfirmDelete(false); c.forget(); }} style={{ marginTop: 18 }} />
        <ActionButton title="Keep enrollment" secondary onPress={() => setConfirmDelete(false)} style={{ marginTop: 9 }} />
      </View></View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, back: { color: palette.evergreen, fontWeight: "800", padding: 10 },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21, marginVertical: 7 }, small: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  row: { flexDirection: "row", gap: 8, marginVertical: 12 }, tab: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 18, backgroundColor: palette.paleGreen }, selected: { backgroundColor: palette.evergreen }, tabText: { color: palette.evergreen, fontWeight: "700" },
  input: { backgroundColor: palette.paper, color: palette.evergreen, borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 14, fontSize: 16, marginVertical: 12 },
  contact: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.line },
  name: { color: palette.evergreen, fontWeight: "800", fontSize: 15 }, setting: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 15 },
  overlay: { flex: 1, padding: 24, backgroundColor: "rgba(15,35,24,0.45)", justifyContent: "center", alignItems: "center" },
});
