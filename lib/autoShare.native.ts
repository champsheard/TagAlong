import * as Contacts from "expo-contacts/legacy";
import { api, ApiError } from "./api";
import { readContactCountry, readInstallation } from "./installationStorage";
import { readDeviceContacts } from "./deviceContacts";
import type { AutoShareResult, ContactMatch } from "../shared/contacts";
import type { TripCredentials } from "../shared/types";

const batchSize = 250;

export async function autoShareTrip(trip: TripCredentials, shouldContinue: () => boolean = () => true): Promise<AutoShareResult> {
  if (!shouldContinue()) return { status: "cancelled" };
  if (trip.demo) return { status: "demo" };
  const session = await readInstallation();
  if (!shouldContinue()) return { status: "cancelled" };
  if (!session) return { status: "not-enrolled" };

  const profile = await api.profile(session);
  if (!shouldContinue()) return { status: "cancelled" };
  if (!profile.autoShare) return { status: "off" };
  if (!profile.verifiedKinds.length) return { status: "unverified" };
  if ((await Contacts.getPermissionsAsync()).status !== "granted") return { status: "no-permission" };

  if (!shouldContinue()) return { status: "cancelled" };
  const local = await readDeviceContacts(await readContactCountry());
  if (!shouldContinue()) return { status: "cancelled" };
  const hashes = [...new Set(local.flatMap(contact => contact.hashes))];
  if (!hashes.length) return { status: "no-matches" };

  const matches: ContactMatch[] = [];
  for (let i = 0; i < hashes.length; i += batchSize) {
    if (!shouldContinue()) return { status: "cancelled" };
    matches.push(...(await api.discover(session, hashes.slice(i, i + batchSize))).matches);
  }
  if (!shouldContinue()) return { status: "cancelled" };
  const installationIds = [...new Set(matches.map(match => match.installationId))];
  if (!installationIds.length) return { status: "no-matches" };

  let sharedCount = 0, notificationsQueued = 0, failure = "";
  for (let i = 0; i < installationIds.length; i += batchSize) {
    if (!shouldContinue()) return { status: "cancelled" };
    try {
      const result = await api.shareToContact(session, trip, installationIds.slice(i, i + batchSize));
      sharedCount += result.sharedCount;
      notificationsQueued += result.notificationsQueued;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) continue;
      failure = error instanceof Error ? error.message : "Could not share with every matched device.";
      break;
    }
  }

  if (failure) return {
    status: sharedCount ? "partial" : "failed",
    matchedCount: installationIds.length,
    sharedCount,
    notificationsQueued,
    error: failure,
  };
  if (!sharedCount) return { status: "no-current-recipients" };
  return { status: "shared", matchedCount: installationIds.length, sharedCount, notificationsQueued };
}
