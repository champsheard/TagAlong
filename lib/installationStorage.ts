import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import type { InstallationSession } from "../shared/contacts";

const key = "safe-walk-installation";
let creating: Promise<InstallationSession> | undefined;
export async function readInstallation(): Promise<InstallationSession | null> {
  const value = Platform.OS === "web" ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (!value) return null;
  try {
    const s = JSON.parse(value);
    return typeof s.installationId === "string" && typeof s.authToken === "string" ? s : null;
  } catch { return null; }
}
export async function saveInstallation(s: InstallationSession | null) {
  if (Platform.OS === "web") { s ? localStorage.setItem(key, JSON.stringify(s)) : localStorage.removeItem(key); }
  else if (s) await SecureStore.setItemAsync(key, JSON.stringify(s));
  else await SecureStore.deleteItemAsync(key);
}
export async function ensureInstallation() {
  const existing = await readInstallation();
  if (existing) return existing;
  if (creating) return creating;
  creating = (async () => {
    const session = await api.enroll(Platform.OS);
    try { await saveInstallation(session); }
    catch { await api.forget(session); throw new Error("Device storage is unavailable. Enable secure storage before syncing contacts."); }
    return session;
  })();
  try { return await creating; } finally { creating = undefined; }
}
