import * as SecureStore from "expo-secure-store";
import type { WidgetState } from "../shared/contacts";
import { parseWidgetState } from "./widgetState";
export type SavedWidget = WidgetState & { activityId?: string };
const key = "safe-walk-tracking-widget";
export async function readWidgetState(): Promise<SavedWidget | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try { const value = JSON.parse(raw); const state = parseWidgetState(value); return state ? { ...state, activityId: value.activityId } : null; } catch { return null; }
}
export async function saveWidgetState(state: SavedWidget | null) {
  if (state) await SecureStore.setItemAsync(key, JSON.stringify(state));
  else await SecureStore.deleteItemAsync(key);
}
