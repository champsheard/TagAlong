import { app } from "./app.js";
import { purgeExpired } from "./db.js";
import { startNotificationWorker } from "./notifications";

const port = Number(process.env.PORT ?? 5000);
purgeExpired();
const purgeTimer = setInterval(() => purgeExpired(), 3600000);
purgeTimer.unref();
startNotificationWorker();

app.listen(port, "0.0.0.0", () => {
  console.log(`Safe Walk API listening on 0.0.0.0:${port}`);
});
