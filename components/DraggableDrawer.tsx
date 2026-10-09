import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated, Keyboard, KeyboardAvoidingView, PanResponder, Platform, Pressable,
  StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions,
} from "react-native";
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
  const keyboardSavedHeight = useRef(initial);
  const keyboardOpen = useRef(false);
  const minRef = useRef(allowedMin);
  const maxRef = useRef(allowedMax);
  const reportRef = useRef(onHeightSettled);
  const [expanded, setExpanded] = useState(initial > (allowedMin + allowedMax) / 2);
  minRef.current = allowedMin;
  maxRef.current = allowedMax;
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

  useEffect(() => {
    moveTo(initialHeight);
  }, [resetKey]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, event => {
      if (!keyboardOpen.current) keyboardSavedHeight.current = heightRef.current;
      keyboardOpen.current = true;
      const keyboardLimit = Platform.OS === "ios"
        ? maxRef.current - event.endCoordinates.height
        : maxRef.current;
      moveTo(Math.min(heightRef.current, keyboardLimit), true);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      if (!keyboardOpen.current) return;
      keyboardOpen.current = false;
      moveTo(keyboardSavedHeight.current, true);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dy) > 7 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { gestureStart.current = heightRef.current; },
    onPanResponderMove: (_event, gesture) => {
      const next = clamp(gestureStart.current - gesture.dy);
      heightRef.current = next;
      heightValue.setValue(next);
    },
    onPanResponderRelease: (_event, gesture) => {
      const midpoint = (minRef.current + maxRef.current) / 2;
      const target = gesture.vy < -0.45 || gesture.dy < -52
        ? maxRef.current
        : gesture.vy > 0.45 || gesture.dy > 52
          ? minRef.current
          : heightRef.current >= midpoint ? maxRef.current : minRef.current;
      moveTo(target);
    },
    onPanResponderTerminate: () => moveTo(heightRef.current),
  }), []);

  function toggle() {
    const midpoint = (minRef.current + maxRef.current) / 2;
    moveTo(heightRef.current < midpoint ? maxRef.current : minRef.current);
  }

  return (
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, { pointerEvents: "box-none" }]}
      behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
    >
      <View style={styles.dock}>
        <Animated.View style={[styles.sheet, style, { height: heightValue, maxHeight: allowedMax }]}>
          <Pressable
            {...responder.panHandlers}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Collapse walk drawer" : "Expand walk drawer"}
            accessibilityHint="Swipe up or down, or press to change the drawer size."
            accessibilityState={{ expanded }}
            onPress={toggle}
            style={styles.handle}
          >
            <View style={styles.grabber} />
          </Pressable>
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dock: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 8, zIndex: 2, pointerEvents: "box-none" },
  sheet: { width: "100%", maxWidth: 600, overflow: "hidden" },
  handle: { width: "100%", minHeight: 36, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  grabber: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#C7CEBC" },
  content: { flex: 1, minHeight: 0 },
});
