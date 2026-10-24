import cors from "cors";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { database } from "./firestore.js";
import { geocode } from "./geocode";
import { demoRoutes, planRoutes } from "./routes";
import { cancelDriveStopAlert, createTrip, endTrip, trackTrip, updateLocation } from "./trips";
import { HttpError } from "./errors";
import { rateLimit } from "./rateLimit";
import { contactsConfig, contactsRouter } from "./contactsRouter";
import { submitArrivalFeedback } from "./feedback";
import { timingSafeEqual } from "node:crypto";
import { purgeExpired } from "./firestore.js";
import { scheduleServerlessWork } from "./serverlessWork.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use((_request, response, next) => {
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.use("/api", rateLimit(300, 60000, "api-global"), (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store"); next();
});
app.use("/api", (request, _response, next) => {
  if (request.path !== "/maintenance/daily") scheduleServerlessWork();
  next();
});

app.get("/api/health", async (_request, response) => {
  await database.collection("meta").doc("health").get();
  response.json({
    status: "ok",
    service: "safe-walk-api",
    database: "connected",
  });
});

app.get("/api/config", async (_request, response) => response.json({ routingAvailable: !!(process.env.HeiGET || process.env.ORS_API_KEY || process.env.GRAPHHOPPER_API_KEY), demoAvailable: true, locationIntervalSeconds: 5, ...await contactsConfig() }));
app.post("/api/feedback", rateLimit(10, 3600000, "feedback"), async (request, response) => {
  response.status(201).json(await submitArrivalFeedback(request.body));
});
app.use("/api", contactsRouter);
app.get("/api/geocode", async (request, response) => {
  response.json(await geocode(typeof request.query.q === "string" ? request.query.q : ""));
});
app.post("/api/geocode", async (request, response) => {
  response.json(await geocode(
    typeof request.body?.q === "string" ? request.body.q : "",
    request.body?.near,
  ));
});
app.get("/api/demo", (_request, response) => response.json(demoRoutes()));
app.post("/api/routes", rateLimit(30, 3600000, "route-planning"), async (request, response) => {
  response.json(await planRoutes(request.body?.from, request.body?.to, request.body?.travelMode));
});
app.post("/api/trips", rateLimit(20, 3600000, "trip-creation"), async (request, response) => {
  response.status(201).json(await createTrip(request.body ?? {}));
});
const token = (request: express.Request) => request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : undefined;
app.post("/api/trips/:id/location", async (request, response) => {
  response.json(await updateLocation(request.params.id as string, token(request), request.body ?? {}));
});
app.post("/api/trips/:id/remote-stop/cancel", async (request, response) => {
  response.json(await cancelDriveStopAlert(request.params.id as string, token(request)));
});
app.post("/api/trips/:id/end", async (request, response) => {
  response.json(await endTrip(request.params.id as string, token(request), request.body?.status));
});
app.get("/api/track/:code", async (request, response) => {
  response.json(await trackTrip(request.params.code as string));
});
app.get("/api/maintenance/daily", async (request, response) => {
  const secret = process.env.CRON_SECRET;
  const authorization = request.get("authorization") ?? "";
  const expected = secret ? Buffer.from(`Bearer ${secret}`) : Buffer.alloc(0);
  const actual = Buffer.from(authorization);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    response.status(secret ? 401 : 503).json({ error: "Daily cleanup is not authorized." });
    return;
  }
  const deleted = await purgeExpired(Date.now(), { maxDocumentsPerCollection: 1000, maxTrips: 20, maxInstallations: 20 });
  response.json({ ok: true, deleted });
});
app.use("/api", (_request, response) => response.status(404).json({ error: "API endpoint not found." }));

if (process.env.VERCEL !== "1") {
  // Replit serves Expo's single-page export directly; Vercel serves public/** via its CDN.
  const webBuild = path.resolve(process.cwd(), "dist");
  app.use(express.static(webBuild, { index: false, dotfiles: "deny" }));
  app.get(/.*/, (_request, response) => {
    const index = path.join(webBuild, "index.html");
    if (existsSync(index)) response.sendFile(index);
    else response.status(404).json({ error: "Web build not found. Run npm run export:web; use the Expo web workflow in development." });
  });
}
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) { response.status(error.status).json({ error: error.message, code: error.code }); return; }
  if (error instanceof SyntaxError) { response.status(400).json({ error: "Invalid JSON request." }); return; }
  // Never log request bodies, query strings, tokens, or precise coordinates.
  response.status(500).json({ error: "Tagalong couldn't complete this request. Please retry." });
});
