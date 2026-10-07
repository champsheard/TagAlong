import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { installNotificationListeners } from "../lib/deviceNotifications";

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => installNotificationListeners(code => router.push(`/track/${code}`)), [router]);
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
