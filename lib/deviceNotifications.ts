export const nativeBuild = false;
export async function enableDeviceNotifications(): Promise<never> {
  throw new Error("App notifications are available in a native iOS or Android build. Link sharing works in this browser.");
}
export function installNotificationListeners(_openTrip: (code: string) => void) { return () => {}; }
