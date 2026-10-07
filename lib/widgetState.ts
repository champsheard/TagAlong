import type { WidgetState } from "../shared/contacts";
export function parseWidgetState(value: unknown): WidgetState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.kind !== undefined && v.kind !== "safe-walk-trip") return null;
  if (typeof v.shareCode !== "string" || !/^[a-zA-Z0-9_-]{22,64}$/.test(v.shareCode) ||
    !["active", "arrived", "help", "expired"].includes(v.status as string) ||
    typeof v.etaAt !== "number" || !Number.isFinite(v.etaAt) ||
    typeof v.expiresAt !== "number" || !Number.isFinite(v.expiresAt) ||
    (v.lastUpdateAt !== null && (typeof v.lastUpdateAt !== "number" || !Number.isFinite(v.lastUpdateAt)))) return null;
  return { shareCode: v.shareCode, status: v.status as WidgetState["status"], etaAt: v.etaAt,
    expiresAt: v.expiresAt, lastUpdateAt: v.lastUpdateAt as number | null, demo: v.demo === true };
}
