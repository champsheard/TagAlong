import { Linking, StyleSheet, Text } from "react-native";
import type { RouteProvider } from "../shared/types";
import { palette } from "../constants/theme";

export default function RouteProviderAttribution({ provider }: { provider?: RouteProvider | null }) {
  if (provider !== "GraphHopper") return null;
  const open = (url: string) => { void Linking.openURL(url).catch(() => {}); };
  return <Text style={s.attribution}>
    Backup route by{" "}
    <Text accessibilityRole="link" onPress={() => open("https://www.graphhopper.com/")} style={s.link}>GraphHopper API</Text>
    {" · "}
    <Text accessibilityRole="link" onPress={() => open("https://www.openstreetmap.org/copyright")} style={s.link}>OpenStreetMap contributors</Text>
  </Text>;
}

const s = StyleSheet.create({
  attribution: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  link: { color: palette.evergreen, fontWeight: "700", textDecorationLine: "underline" },
});
