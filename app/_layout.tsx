import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { installNotificationListeners } from "../lib/deviceNotifications";

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => installNotificationListeners(code => router.push(`/track/${code}`)), [router]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
