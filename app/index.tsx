import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function BrandMark() {
  return (
    <View style={styles.brandMark} accessibilityLabel="Safe Walk">
      <View style={styles.brandMarkDot} />
      <Text style={styles.brandMarkText}>SW</Text>
    </View>
  );
}

function FeatureRow({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureNumber}>{number}</Text>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
      <View style={styles.featureStatus}>
        <Text style={styles.featureStatusText}>IN PROGRESS</Text>
      </View>
    </View>
  );
}

export default function Index() {
  const [showPreviewDetails, setShowPreviewDetails] = useState(false);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <BrandMark />
            <Text style={styles.brandName}>Safe Walk</Text>
          </View>
          <View style={styles.previewPill}>
            <View style={styles.previewDot} />
            <Text style={styles.previewLabel}>EARLY PREVIEW</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.eyebrowWrap}>
            <View style={styles.eyebrowRule} />
            <Text style={styles.eyebrow}>A LITTLE MORE PEACE OF MIND</Text>
          </View>
          <Text style={styles.headline}>
            A steadier{"\n"}way <Text style={styles.headlineAccent}>home.</Text>
          </Text>
          <Text style={styles.intro}>
            A walking companion built around better-lit routes and one trusted
            person, right there with you.
          </Text>
        </View>

        <View style={styles.promiseCard}>
          <View style={styles.promiseTop}>
            <Text style={styles.cardKicker}>THE IDEA</Text>
            <Text style={styles.cardIndex}>01 / 02</Text>
          </View>
          <View style={styles.orbitArt} accessibilityElementsHidden>
            <View style={styles.orbitOuter}>
              <View style={styles.orbitInner}>
                <View style={styles.orbitCore} />
              </View>
              <View style={styles.orbitMarker} />
            </View>
            <View style={styles.artLine} />
            <View style={styles.artDot} />
          </View>
          <Text style={styles.promiseTitle}>Feel more sure of the way.</Text>
          <Text style={styles.promiseDescription}>
            Safe Walk is being designed to help you choose a brighter way and
            keep someone you trust in the loop.
          </Text>
          <View style={styles.promiseFoot}>
            <Text style={styles.promiseFootText}>BUILT FOR THE WALK HOME</Text>
            <View style={styles.footArrow}>
              <Text style={styles.footArrowText}>↗</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>ON THE WAY</Text>
            <Text style={styles.sectionTitle}>What we’re working toward</Text>
          </View>
          <View style={styles.sectionMarker}>
            <Text style={styles.sectionMarkerText}>02</Text>
          </View>
        </View>

        <View style={styles.features}>
          <FeatureRow
            number="01"
            title="Brighter by design"
            description="Routes that favor well-lit streets."
          />
          <View style={styles.featureDivider} />
          <FeatureRow
            number="02"
            title="A familiar presence"
            description="One trusted person who can follow along."
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showPreviewDetails }}
          onPress={() => setShowPreviewDetails((visible) => !visible)}
          style={({ pressed }) => [
            styles.disclosure,
            pressed && styles.disclosurePressed,
          ]}
        >
          <View style={styles.disclosureTextWrap}>
            <Text style={styles.disclosureTitle}>
              {showPreviewDetails ? "About this preview" : "What’s in this preview?"}
            </Text>
            <Text style={styles.disclosureHint}>
              {showPreviewDetails ? "A clear note on what’s not connected yet." : "See what’s ready today."}
            </Text>
          </View>
          <View style={styles.disclosureIcon}>
            <Text style={styles.disclosureIconText}>
              {showPreviewDetails ? "−" : "+"}
            </Text>
          </View>
        </Pressable>

        {showPreviewDetails ? (
          <View style={styles.previewDetails}>
            <Text style={styles.detailsLabel}>JUST THE FIRST STEP</Text>
            <Text style={styles.detailsText}>
              This preview is a starting point. Maps, location, route planning,
              and sharing are not available here yet.
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <Text style={styles.footerText}>TAKE THE LONG WAY, IF IT FEELS RIGHT.</Text>
          <Text style={styles.footerSubtext}>Safe Walk · A companion in progress</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2f0e8",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 34,
  },
  page: {
    width: "100%",
    maxWidth: 520,
  },
  topBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#193c32",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandMarkDot: {
    position: "absolute",
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#b8ce73",
    top: 6,
    left: 6,
  },
  brandMarkText: {
    color: "#f2f0e8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  brandName: {
    color: "#193c32",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  previewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#e5e8d7",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#6c8044",
  },
  previewLabel: {
    color: "#374a31",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  hero: {
    paddingTop: 49,
    paddingBottom: 27,
  },
  eyebrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
  },
  eyebrowRule: {
    width: 22,
    height: 2,
    backgroundColor: "#a0b853",
  },
  eyebrow: {
    color: "#536447",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  headline: {
    color: "#193c32",
    fontSize: 53,
    lineHeight: 55,
    fontWeight: "800",
    letterSpacing: -2.9,
  },
  headlineAccent: {
    color: "#839849",
  },
  intro: {
    maxWidth: 410,
    color: "#455b4e",
    fontSize: 17,
    lineHeight: 26,
    marginTop: 18,
    letterSpacing: -0.2,
  },
  promiseCard: {
    minHeight: 260,
    borderRadius: 25,
    backgroundColor: "#193c32",
    paddingHorizontal: 23,
    paddingTop: 20,
    paddingBottom: 19,
    overflow: "hidden",
  },
  promiseTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  cardKicker: {
    color: "#d2dfa5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  cardIndex: {
    color: "#afc19b",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  orbitArt: {
    position: "absolute",
    right: 10,
    top: 7,
    width: 150,
    height: 142,
    opacity: 0.8,
  },
  orbitOuter: {
    position: "absolute",
    width: 109,
    height: 109,
    right: 4,
    top: 0,
    borderWidth: 1,
    borderColor: "#71875e",
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitInner: {
    width: 75,
    height: 75,
    borderWidth: 1,
    borderColor: "#9aac72",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitCore: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: "#bbce78",
  },
  orbitMarker: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 6,
    right: 12,
    top: 19,
    backgroundColor: "#f2f0e8",
    borderWidth: 2,
    borderColor: "#193c32",
  },
  artLine: {
    position: "absolute",
    width: 45,
    height: 1,
    right: 91,
    top: 116,
    backgroundColor: "#a9bb7c",
    transform: [{ rotate: "-34deg" }],
  },
  artDot: {
    position: "absolute",
    width: 5,
    height: 5,
    right: 132,
    top: 129,
    borderRadius: 3,
    backgroundColor: "#d2dfa5",
  },
  promiseTitle: {
    maxWidth: 290,
    color: "#f4f1e7",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.8,
    marginTop: 75,
  },
  promiseDescription: {
    maxWidth: 390,
    color: "#d3ddc8",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  promiseFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 19,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#466154",
  },
  promiseFootText: {
    color: "#c0d091",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  footArrow: {
    width: 25,
    height: 25,
    borderRadius: 14,
    backgroundColor: "#2e5143",
    alignItems: "center",
    justifyContent: "center",
  },
  footArrowText: {
    color: "#e0e7c4",
    fontSize: 15,
    lineHeight: 18,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 34,
    marginBottom: 16,
  },
  sectionEyebrow: {
    color: "#6d7d4a",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 7,
  },
  sectionTitle: {
    color: "#193c32",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  sectionMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e1e5d4",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionMarkerText: {
    color: "#526342",
    fontSize: 10,
    fontWeight: "800",
  },
  features: {
    borderTopWidth: 1,
    borderTopColor: "#d5d6c8",
  },
  featureRow: {
    minHeight: 83,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  featureNumber: {
    color: "#7d8c58",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    alignSelf: "flex-start",
    marginTop: 23,
  },
  featureCopy: {
    flex: 1,
    paddingVertical: 15,
  },
  featureTitle: {
    color: "#244438",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  featureDescription: {
    color: "#617064",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  featureStatus: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: "#e7e8dc",
  },
  featureStatusText: {
    color: "#68734f",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  featureDivider: {
    height: 1,
    backgroundColor: "#d5d6c8",
  },
  disclosure: {
    minHeight: 67,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#e5e8dc",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  disclosurePressed: {
    opacity: 0.78,
  },
  disclosureTextWrap: {
    flex: 1,
    paddingVertical: 12,
  },
  disclosureTitle: {
    color: "#244438",
    fontSize: 14,
    fontWeight: "700",
  },
  disclosureHint: {
    color: "#677363",
    fontSize: 11,
    marginTop: 3,
  },
  disclosureIcon: {
    width: 29,
    height: 29,
    marginLeft: 12,
    borderRadius: 15,
    backgroundColor: "#d2dbc1",
    alignItems: "center",
    justifyContent: "center",
  },
  disclosureIconText: {
    color: "#34513b",
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "400",
  },
  previewDetails: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 17,
    marginTop: 7,
    borderRadius: 12,
    backgroundColor: "#e9eade",
  },
  detailsLabel: {
    color: "#74804e",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  detailsText: {
    color: "#42584a",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  footer: {
    paddingTop: 27,
    paddingBottom: 6,
    alignItems: "center",
  },
  footerRule: {
    width: 30,
    height: 2,
    backgroundColor: "#a6b668",
    marginBottom: 12,
  },
  footerText: {
    color: "#526447",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    textAlign: "center",
  },
  footerSubtext: {
    color: "#7a8376",
    fontSize: 10,
    marginTop: 6,
  },
});
