import { StyleSheet, Text, View } from "react-native";
import { palette } from "../constants/theme";

interface MapContextPillProps {
  label: string;
  top: number;
  tone?: "default" | "demo" | "warning";
}

export default function MapContextPill({ label, top, tone = "default" }: MapContextPillProps) {
  return <View
    accessible
    accessibilityRole="text"
    accessibilityLabel={label}
    pointerEvents="none"
    style={[s.pill, { top }, tone === "demo" ? s.demo : tone === "warning" ? s.warning : null]}
  >
    <View style={[s.dot, tone === "demo" ? s.demoDot : tone === "warning" ? s.warningDot : null]} />
    <Text numberOfLines={1} style={[s.label, tone === "demo" ? s.demoLabel : tone === "warning" ? s.warningLabel : null]}>{label}</Text>
  </View>;
}

const s = StyleSheet.create({
  pill: {
    position: "absolute",
    zIndex: 2,
    left: 18,
    maxWidth: "80%",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(35,75,61,0.13)",
    backgroundColor: "rgba(251,250,244,0.97)",
    shadowColor: palette.evergreen,
    shadowOpacity: 0.16,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  demo: { backgroundColor: palette.amberBg, borderColor: "#F1D6A5" },
  warning: { backgroundColor: palette.amberBg, borderColor: "#F1D6A5" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.citronDark },
  demoDot: { backgroundColor: palette.amber },
  warningDot: { backgroundColor: palette.amber },
  label: { flexShrink: 1, color: "#234b3d", fontSize: 10, fontWeight: "800", letterSpacing: 0.55 },
  demoLabel: { color: palette.amber },
  warningLabel: { color: palette.amber },
});
