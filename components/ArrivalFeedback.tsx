import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../lib/api";
import type { ArrivalFeedbackReport } from "../shared/types";
import { palette } from "../constants/theme";
import { ActionButton, Eyebrow, Notice } from "./WalkUI";

type ReportDraft = {
  streetOrBlock: string;
  lightingRating: number | null;
  notes: string;
};

function RatingChoices({ value, onChange, label }: {
  value: number | null;
  onChange: (rating: number) => void;
  label: string;
}) {
  return <View style={s.ratingRow}>
    {[1, 2, 3, 4, 5].map(rating => <Pressable
      key={rating}
      accessibilityRole="radio"
      accessibilityLabel={`${label}, ${rating} out of 5`}
      accessibilityState={{ checked: value === rating }}
      onPress={() => onChange(rating)}
      style={[s.ratingChoice, value === rating && s.ratingChoiceSelected]}
    >
      <Text style={[s.ratingNumber, value === rating && s.ratingNumberSelected]}>{rating}</Text>
    </Pressable>)}
  </View>;
}

export default function ArrivalFeedback() {
  const [routeRating, setRouteRating] = useState<number | null>(null);
  const [reports, setReports] = useState<ReportDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const hasDetails = (report: ReportDraft) =>
    !!report.streetOrBlock.trim() || report.lightingRating !== null || !!report.notes.trim();
  const incompleteReport = reports.some(report =>
    hasDetails(report) && (!report.streetOrBlock.trim() || report.lightingRating === null),
  );

  function updateReport(index: number, update: Partial<ReportDraft>) {
    setReports(current => current.map((report, i) => i === index ? { ...report, ...update } : report));
  }

  async function sendFeedback() {
    if (routeRating === null || submitting || submitted) return;
    if (incompleteReport) {
      setError("For each lighting note, enter a street or block and choose a rating.");
      return;
    }
    const completedReports: ArrivalFeedbackReport[] = reports
      .filter(hasDetails)
      .map(report => ({
        streetOrBlock: report.streetOrBlock.trim(),
        lightingRating: report.lightingRating as number,
        ...(report.notes.trim() ? { notes: report.notes.trim() } : {}),
      }));
    setSubmitting(true);
    setError("");
    try {
      await api.feedback({ routeRating, reports: completedReports });
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Feedback could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <View style={s.card}>
    <Eyebrow>OPTIONAL ARRIVAL FEEDBACK</Eyebrow>
    <Text style={s.title}>How did the route feel?</Text>
    <Text style={s.body}>Rate the route overall: 1 is not comfortable, 5 is very comfortable.</Text>
    <RatingChoices value={routeRating} onChange={setRouteRating} label="Route comfort rating" />

    {routeRating !== null && !submitted ? <>
      <View style={s.optionalSection}>
        <Text style={s.sectionTitle}>Lighting notes <Text style={s.optionalLabel}>· OPTIONAL</Text></Text>
        <Text style={s.body}>Add up to three streets or blocks if you’d like to report lighting conditions.</Text>
        <View style={s.privacyNote}>
          <Text style={s.privacyText}>Feedback isn’t linked to your trip, an account, or GPS coordinates, and is deleted after 90 days. Street or block names can reveal where you walked; don’t include your name or exact address.</Text>
        </View>

        {reports.map((report, index) => <View key={index} style={s.reportCard}>
          <View style={s.reportHeading}>
            <Text style={s.reportTitle}>Street or block {index + 1}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove street or block report ${index + 1}`}
              onPress={() => setReports(current => current.filter((_, i) => i !== index))}
              style={s.removeButton}
            >
              <Text style={s.removeText}>Remove</Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel={`Street or block ${index + 1}`}
            value={report.streetOrBlock}
            onChangeText={streetOrBlock => updateReport(index, { streetOrBlock })}
            placeholder="Street name or block"
            placeholderTextColor={palette.muted}
            maxLength={120}
            style={s.input}
          />
          <Text style={s.reportLabel}>Lighting: 1 is very poor, 5 is well lit</Text>
          <RatingChoices
            value={report.lightingRating}
            onChange={lightingRating => updateReport(index, { lightingRating })}
            label={`Lighting on street or block ${index + 1}`}
          />
          <TextInput
            accessibilityLabel={`Optional note for street or block ${index + 1}`}
            value={report.notes}
            onChangeText={notes => updateReport(index, { notes })}
            placeholder="Optional note"
            placeholderTextColor={palette.muted}
            maxLength={280}
            multiline
            textAlignVertical="top"
            style={[s.input, s.notesInput]}
          />
        </View>)}

        {reports.length < 3 ? <Pressable
          accessibilityRole="button"
          onPress={() => setReports(current => [...current, { streetOrBlock: "", lightingRating: null, notes: "" }])}
          style={s.addReport}
        >
          <Text style={s.addReportText}>+ Add a street or block</Text>
        </Pressable> : null}
      </View>
      {error ? <View style={s.error}><Notice tone="danger">{error}</Notice></View> : null}
      <ActionButton
        title={submitting ? "Sending feedback…" : "Send anonymous feedback"}
        onPress={() => { void sendFeedback(); }}
        loading={submitting}
        disabled={routeRating === null || submitted}
        style={{ marginTop: 13 }}
      />
    </> : null}

    {routeRating === null ? <Text style={s.hint}>Your feedback is optional. You can plan another walk without sending it.</Text> : null}
    {submitted ? <View style={s.thanks}><Notice>Thank you. Your anonymous feedback will be deleted after 90 days.</Notice></View> : null}
    {error && (routeRating === null || submitted) ? <View style={s.error}><Notice tone="danger">{error}</Notice></View> : null}
  </View>;
}

const s = StyleSheet.create({
  card: { marginTop: 18, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: palette.line, backgroundColor: "#F7F7F0" },
  title: { color: palette.evergreen, fontSize: 20, lineHeight: 25, fontWeight: "900", letterSpacing: -0.35 },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  ratingRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  ratingChoice: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper },
  ratingChoiceSelected: { borderColor: palette.evergreen, backgroundColor: palette.evergreen },
  ratingNumber: { color: palette.evergreen, fontSize: 15, fontWeight: "900" },
  ratingNumberSelected: { color: palette.paper },
  optionalSection: { marginTop: 18 },
  sectionTitle: { color: palette.evergreen, fontSize: 15, fontWeight: "900" },
  optionalLabel: { color: palette.citronDark, fontSize: 10, letterSpacing: 0.6 },
  privacyNote: { marginTop: 11, padding: 11, borderRadius: 11, backgroundColor: palette.paleGreen },
  privacyText: { color: palette.evergreen, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  reportCard: { marginTop: 11, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper },
  reportHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  reportTitle: { color: palette.evergreen, fontSize: 13, fontWeight: "900" },
  removeButton: { minHeight: 32, justifyContent: "center", paddingHorizontal: 8 },
  removeText: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  input: { minHeight: 45, borderRadius: 10, borderWidth: 1, borderColor: "#AEB8A7", backgroundColor: palette.paper, paddingHorizontal: 11, color: palette.ink, fontSize: 14 },
  reportLabel: { color: palette.evergreen, fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 10 },
  notesInput: { minHeight: 72, paddingTop: 10, marginTop: 10 },
  addReport: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 9, borderRadius: 11, borderWidth: 1, borderStyle: "dashed", borderColor: palette.citronDark },
  addReportText: { color: palette.evergreen, fontSize: 13, fontWeight: "800" },
  hint: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 10 },
  error: { marginTop: 11 },
  thanks: { marginTop: 13 },
});
