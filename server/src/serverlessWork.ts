import { waitUntil } from "@vercel/functions";
import { database, purgeExpired } from "./firestore.js";
import { processDriveStopAlerts } from "./driveStopMonitor.js";
import { processNotifications } from "./notifications.js";

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
let workInFlight: Promise<void> | undefined;

async function opportunisticCleanup() {
  const now = Date.now();
  const reference = database.collection("meta").doc("serverless-cleanup");
  const claimed = await database.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (Number(snapshot.data()?.next_run_at ?? 0) > now || Number(snapshot.data()?.locked_until ?? 0) > now) return false;
    transaction.set(reference, { next_run_at: now + CLEANUP_INTERVAL_MS, locked_until: now + 5 * 60 * 1000 });
    return true;
  });
  if (!claimed) return;
  try {
    await purgeExpired(now, { maxDocumentsPerCollection: 100, maxTrips: 5, maxInstallations: 5 });
    await reference.update({ next_run_at: Date.now() + CLEANUP_INTERVAL_MS, locked_until: 0 });
  } catch {
    await reference.update({ next_run_at: Date.now() + 5 * 60 * 1000, locked_until: 0 }).catch(() => {});
  }
}

async function runBestEffortWork() {
  const tasks = await Promise.allSettled([
    processNotifications(4, 2),
    processDriveStopAlerts(Date.now(), 1, 8),
    opportunisticCleanup(),
  ]);
  void tasks;
}

export function scheduleServerlessWork() {
  if (process.env.VERCEL !== "1" || workInFlight) return;
  workInFlight = runBestEffortWork().finally(() => { workInFlight = undefined; });
  try {
    waitUntil(workInFlight);
  } catch {
    void workInFlight.catch(() => {});
  }
}
