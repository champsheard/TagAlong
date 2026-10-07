import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { palette } from "../constants/theme";

export function BrandHeader({ label = "Safe Walk" }: { label?: string }) {
  return <View style={s.header}>
    <View style={s.mark}><View style={s.markRing} /><Text style={s.markText}>SW</Text></View>
    <View style={s.headerCopy}><Text style={s.brand}>{label}</Text><Text style={s.tagline}>A steadier way home</Text></View>
  </View>;
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={s.eyebrow}>{children.toUpperCase()}</Text>;
}

export function ActionButton({ title, onPress, secondary = false, danger = false, disabled = false, loading = false, style }: {
  title: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; loading?: boolean; style?: ViewStyle;
}) {
  const bg = danger ? palette.red : secondary ? palette.paleGreen : palette.evergreen;
  const fg = secondary ? palette.evergreen : palette.paper;
  return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [s.button, { backgroundColor: bg }, secondary && s.secondaryButton, danger && s.dangerButton, disabled && s.disabled, pressed && !disabled && s.pressed, style]}>
    {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, { color: fg }]}>{title}</Text>}
  </Pressable>;
}

export function Notice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "danger" }) {
  return <View accessibilityRole="alert" style={[s.notice, tone === "warning" && s.warning, tone === "danger" && s.dangerNotice]}>
    <Text style={[s.noticeText, tone === "warning" && { color: palette.amber }, tone === "danger" && { color: palette.red }]}>{children}</Text>
  </View>;
}

export function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return <View style={s.section}>
    <Eyebrow>{eyebrow}</Eyebrow>
    <Text style={s.title}>{title}</Text>
    {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 27 },
  mark: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.evergreen, overflow: "hidden" },
  markRing: { position: "absolute", width: 29, height: 29, borderWidth: 1.5, borderColor: palette.citron, borderRadius: 20 },
  markText: { color: palette.oat, fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  headerCopy: { gap: 2 },
  brand: { color: palette.evergreen, fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  tagline: { color: palette.muted, fontSize: 12, fontWeight: "600" },
  eyebrow: { color: palette.citronDark, fontSize: 12, lineHeight: 17, fontWeight: "900", letterSpacing: 1.25, marginBottom: 7 },
  section: { marginBottom: 20 },
  title: { color: palette.evergreen, fontSize: 32, lineHeight: 37, letterSpacing: -1.15, fontWeight: "800" },
  subtitle: { color: palette.muted, fontSize: 16, lineHeight: 23, marginTop: 8 },
  button: { minHeight: 54, borderRadius: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  secondaryButton: { borderWidth: 1, borderColor: "#C9D1B6" },
  dangerButton: { borderWidth: 1, borderColor: palette.red },
  buttonText: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  notice: { borderRadius: 13, backgroundColor: palette.paleGreen, padding: 14, borderWidth: 1, borderColor: palette.line },
  warning: { backgroundColor: palette.amberBg, borderColor: "#E6D19C" },
  dangerNotice: { backgroundColor: palette.redBg, borderColor: "#E8C5BB" },
  noticeText: { color: palette.evergreen, fontSize: 14, lineHeight: 21, fontWeight: "600" },
});
