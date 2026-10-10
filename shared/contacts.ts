import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

export type IdentifierKind = "phone" | "email";
export type InstallationSession = { installationId: string; authToken: string };
export type InstallationProfile = {
  installationId: string; platform: "ios" | "android" | "web";
  verifiedKinds: IdentifierKind[]; discoverable: boolean; notificationsEnabled: boolean; autoShare: boolean;
};
export type AutoShareResult =
  | { status: "unsupported" | "demo" | "not-enrolled" | "off" | "unverified" | "no-permission" | "no-matches" | "no-current-recipients" }
  | { status: "cancelled" }
  | { status: "shared" | "partial" | "failed"; matchedCount: number; sharedCount: number; notificationsQueued: number; error?: string };
export type ContactMatch = { hash: string; installationId: string; notificationsEnabled: boolean };
export type DeviceContact = {
  id: string; name: string; hashes: string[]; installationIds: string[]; notificationsEnabled: boolean;
  phoneNumbers?: { number: string; label: string }[]; emails?: string[];
};
export type ContactsConfig = {
  smsVerificationAvailable: boolean; emailVerificationAvailable: boolean; remoteWidgetsAvailable: boolean;
};
export type ReceivedTrip = { shareCode: string; status: "active" | "arrived" | "help"; startedAt: number; etaAt: number; expiresAt: number; demo: boolean };
export type WidgetState = {
  shareCode: string; status: "active" | "arrived" | "help" | "expired";
  etaAt: number; lastUpdateAt: number | null; expiresAt: number; demo: boolean;
};
export function normalizeIdentifier(kind: IdentifierKind, value: string, country: string = "US") {
  if (typeof value !== "string" || value.length > 254) return null;
  if (kind === "email") {
    const email = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }
  if (typeof country !== "string" || !/^[a-z]{2}$/i.test(country)) return null;
  const phone = parsePhoneNumberFromString(value, country.toUpperCase() as CountryCode);
  return phone?.isValid() ? phone.number : null;
}
export const canonicalIdentifier = (kind: IdentifierKind, value: string) => `${kind}:${value}`;
export function rankContacts(contacts: DeviceContact[], matches: ContactMatch[]): DeviceContact[] {
  const index = new Map<string, ContactMatch[]>();
  for (const match of matches) index.set(match.hash, [...(index.get(match.hash) ?? []), match]);
  return contacts.map(c => {
    const rows = c.hashes.flatMap(hash => index.get(hash) ?? []);
    return { ...c, installationIds: [...new Set(rows.map(m => m.installationId))], notificationsEnabled: rows.some(m => m.notificationsEnabled) };
  }).sort((a, b) => Number(!!b.installationIds.length) - Number(!!a.installationIds.length) || a.name.localeCompare(b.name));
}
