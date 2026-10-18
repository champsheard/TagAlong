import { app } from "./app.js";
import { purgeExpired } from "./db.js";
import { startNotificationWorker } from "./notifications";
import { startDriveStopMonitor } from "./driveStopMonitor.js";

const port = Number(process.env.PORT ?? 5000);
purgeExpired();
const purgeTimer = setInterval(() => purgeExpired(), 3600000);
purgeTimer.unref();
startNotificationWorker();
startDriveStopMonitor();

app.listen(port, "0.0.0.0", () => {
  console.log(`Tagalong API listening on 0.0.0.0:${port}`);
});
