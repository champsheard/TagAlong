import cors from "cors";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { database } from "./db.js";
import { geocode } from "./geocode";
import { demoRoutes, walkingRoutes } from "./routes";
import { createTrip, endTrip, trackTrip, updateLocation } from "./trips";
import { HttpError } from "./errors";
import { rateLimit } from "./rateLimit";
import { contactsConfig, contactsRouter } from "./contactsRouter";
import { submitArrivalFeedback } from "./feedback";

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
app.use("/api", rateLimit(300, 60000), (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store"); next();
});

app.get("/api/health", (_request, response) => {
  database.prepare("SELECT 1").get();
  response.json({
    status: "ok",
    service: "safe-walk-api",
    database: "connected",
  });
});

app.get("/api/config", async (_request, response) => response.json({ routingAvailable: !!process.env.ORS_API_KEY, demoAvailable: true, locationIntervalSeconds: 5, ...await contactsConfig() }));
app.post("/api/feedback", rateLimit(10, 3600000), (request, response) => {
  response.status(201).json(submitArrivalFeedback(request.body));
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
app.post("/api/routes", rateLimit(30, 3600000), async (request, response) => {
  response.json(await walkingRoutes(request.body?.from, request.body?.to));
});
app.post("/api/trips", rateLimit(20, 3600000), (request, response) => {
  response.status(201).json(createTrip(request.body ?? {}));
});
const token = (request: express.Request) => request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : undefined;
app.post("/api/trips/:id/location", (request, response) => {
  response.json(updateLocation(request.params.id as string, token(request), request.body ?? {}));
});
app.post("/api/trips/:id/end", (request, response) => {
  response.json(endTrip(request.params.id as string, token(request), request.body?.status));
});
app.get("/api/track/:code", (request, response) => {
  response.json(trackTrip(request.params.code as string));
});
app.use("/api", (_request, response) => response.status(404).json({ error: "API endpoint not found." }));

// Expo's single-page web export also handles /track/<code> in any phone browser.
const webBuild = path.resolve(process.cwd(), "dist");
app.use(express.static(webBuild, { index: false, dotfiles: "deny" }));
app.get(/.*/, (_request, response) => {
  const index = path.join(webBuild, "index.html");
  if (existsSync(index)) response.sendFile(index);
  else response.status(404).json({ error: "Web build not found. Run npm run export:web; use the Expo web workflow in development." });
});
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) { response.status(error.status).json({ error: error.message, code: error.code }); return; }
  if (error instanceof SyntaxError) { response.status(400).json({ error: "Invalid JSON request." }); return; }
  // Never log request bodies, query strings, tokens, or precise coordinates.
  response.status(500).json({ error: "Safe Walk couldn't complete this request. Please retry." });
});
