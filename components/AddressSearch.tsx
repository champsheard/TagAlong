import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../lib/api";
import type { Place, Point } from "../shared/types";
import { palette } from "../constants/theme";

export default function AddressSearch({ label, placeholder, value, onSelect, onClear, required = false, near }: {
  label: string; placeholder: string; value: Place | null; onSelect: (place: Place) => void; onClear?: () => void; required?: boolean; near?: Point | null;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const editing = useRef(false);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    if (editing.current) { editing.current = false; return; }
    requestId.current++;
    setQuery(value?.label ?? "");
    setResults([]); setLoading(false); setSearched(false);
  }, [value?.label]);
  useEffect(() => () => { requestId.current++; }, []);
  async function search() {
    const q = query.trim();
    if (q.length < 3 || q.length > 160) { setError("Enter an address using 3–160 characters."); return; }
    const id = ++requestId.current;
    setLoading(true); setError(""); setSearched(true);
    // Public Nominatim forbids autocomplete: submit only on a deliberate search.
    try { const items = await api.geocode(q, near ?? undefined); if (id === requestId.current) setResults(items); }
    catch (e) { if (id === requestId.current) { setResults([]); setError(e instanceof Error ? e.message : "Address search is unavailable."); } }
    finally { if (id === requestId.current) setLoading(false); }
  }
  function change(text: string) {
    requestId.current++; setQuery(text); setResults([]); setLoading(false); setError(""); setSearched(false);
    if (value) { editing.current = true; onClear?.(); }
  }
  return <View style={styles.wrap}>
    <Text style={styles.label}>{label}{required ? " · REQUIRED" : " · OPTIONAL"}</Text>
    <TextInput
      value={query} onChangeText={change} placeholder={placeholder} placeholderTextColor="#718076"
      style={styles.input} accessibilityLabel={label} autoCorrect={false} returnKeyType="search" onSubmitEditing={search} maxLength={160}
    />
    <Pressable accessibilityRole="button" accessibilityLabel={`Search ${label}`} onPress={search} disabled={loading || query.trim().length < 3} style={[styles.search, (loading || query.trim().length < 3) && { opacity: 0.5 }]}><Text style={styles.searchText}>Search</Text></Pressable>
    {loading ? <View style={styles.state}><ActivityIndicator color={palette.evergreen} /><Text style={styles.stateText}>Searching addresses…</Text></View> : null}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {searched && !loading && !error && !results.length && query !== value?.label ? <Text style={styles.stateText}>No matches. Try a street, place, or nearby landmark.</Text> : null}
    {results.map((place, index) => <Pressable key={`${place.lat},${place.lng},${index}`} accessibilityRole="button"
      onPress={() => { editing.current = false; onSelect(place); setQuery(place.label); setResults([]); }}
      style={({ pressed }) => [styles.result, pressed && { backgroundColor: "#E6EBDD" }]}>
      <View style={styles.pin}><Text style={styles.pinText}>{index + 1}</Text></View>
      <Text style={styles.resultText}>{place.label}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { color: palette.evergreen, fontSize: 13, fontWeight: "900", letterSpacing: 0.65, marginBottom: 8 },
  input: { minHeight: 54, borderRadius: 13, borderWidth: 1.5, borderColor: "#AEB8A7", backgroundColor: palette.paper, paddingHorizontal: 15, color: palette.ink, fontSize: 16 },
  search: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 18, marginTop: 8, backgroundColor: palette.evergreen, borderRadius: 10 },
  searchText: { color: palette.paper, fontSize: 15, fontWeight: "800" },
  state: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 12 },
  stateText: { color: palette.muted, fontSize: 14, lineHeight: 21, paddingVertical: 9 },
  error: { color: palette.red, fontSize: 14, lineHeight: 20, paddingTop: 9 },
  result: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.paper, borderBottomWidth: 1, borderColor: palette.line, paddingHorizontal: 12, paddingVertical: 13 },
  pin: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.paleGreen },
  pinText: { color: palette.evergreen, fontSize: 12, fontWeight: "900" },
  resultText: { flex: 1, color: palette.ink, fontSize: 15, lineHeight: 21, fontWeight: "600" },
});
