import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  children: ReactNode;
  style: StyleProp<ViewStyle>;
  initialHeight: number;
  minHeight: number;
  maxHeight: number;
  resetKey: string;
  onHeightSettled?: (height: number) => void;
};

export default function DraggableDrawer({ children, style, initialHeight, minHeight, maxHeight, resetKey, onHeightSettled }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const allowedMax = Math.max(180, Math.min(maxHeight, windowHeight - insets.top - 12));
  const allowedMin = Math.min(minHeight, allowedMax);
  const initial = Math.max(allowedMin, Math.min(initialHeight, allowedMax));
  const heightValue = useRef(new Animated.Value(initial)).current;
  const heightRef = useRef(initial);
  const gestureStart = useRef(initial);
  const dragged = useRef(false);
  const minRef = useRef(allowedMin);
  const maxRef = useRef(allowedMax);
  const initialRef = useRef(initial);
  const reportRef = useRef(onHeightSettled);
  const moveToRef = useRef<(height: number, animated?: boolean) => void>(() => {});
  const [expanded, setExpanded] = useState(initial > (allowedMin + allowedMax) / 2);
  minRef.current = allowedMin;
  maxRef.current = allowedMax;
  initialRef.current = initial;
  reportRef.current = onHeightSettled;

  const clamp = (height: number) => Math.max(minRef.current, Math.min(height, maxRef.current));
  const moveTo = (height: number, animated = true) => {
    const next = clamp(height);
    heightRef.current = next;
    if (animated) {
      Animated.spring(heightValue, { toValue: next, useNativeDriver: false, damping: 28, stiffness: 240 }).start();
    } else {
      heightValue.setValue(next);
    }
    const nextExpanded = next > (minRef.current + maxRef.current) / 2;
    setExpanded(nextExpanded);
    reportRef.current?.(next);
  };
  moveToRef.current = moveTo;

  useEffect(() => {
    moveTo(initialHeight);
  }, [resetKey]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const show = Keyboard.addListener(showEvent, () => {
      requestAnimationFrame(() => moveToRef.current(maxRef.current));
    });
    return () => show.remove();
  }, []);

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-28, 28])
    .runOnJS(true)
    .onBegin(() => {
      gestureStart.current = heightRef.current;
      dragged.current = false;
    })
    .onUpdate(event => {
      if (Math.abs(event.translationY) > 6) dragged.current = true;
      const next = clamp(gestureStart.current - event.translationY);
      heightRef.current = next;
      heightValue.setValue(next);
    })
    .onEnd(event => {
      if (!dragged.current) return;
      const stops = [...new Set([minRef.current, clamp(initialRef.current), maxRef.current])].sort((a, b) => a - b);
      const projected = clamp(heightRef.current - event.velocityY * 0.16);
      const target = stops.reduce((closest, stop) =>
        Math.abs(stop - projected) < Math.abs(closest - projected) ? stop : closest, stops[0]);
      moveToRef.current(target);
    }), []);

  function toggle() {
    const midpoint = (minRef.current + maxRef.current) / 2;
    moveTo(heightRef.current < midpoint ? maxRef.current : minRef.current);
  }

  return (
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, { pointerEvents: "box-none" }]}
      behavior={Platform.OS === "android" ? "height" : undefined}
    >
      <View style={styles.dock}>
        <Animated.View style={[styles.sheet, style, { height: heightValue, maxHeight: allowedMax }]}>
          <GestureDetector gesture={panGesture} touchAction="none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Collapse walk drawer" : "Expand walk drawer"}
              accessibilityHint="Drag the handle up or down, or press to change the drawer size."
              accessibilityState={{ expanded }}
              onPress={() => {
                if (dragged.current) { dragged.current = false; return; }
                toggle();
              }}
              style={styles.handle}
            >
              <View style={styles.grabber} />
            </Pressable>
          </GestureDetector>
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dock: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 8, zIndex: 2, pointerEvents: "box-none" },
  sheet: { width: "100%", maxWidth: 600, overflow: "hidden" },
  handle: { width: "100%", minHeight: 48, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  grabber: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#C7CEBC" },
  content: { flex: 1, minHeight: 0 },
});
