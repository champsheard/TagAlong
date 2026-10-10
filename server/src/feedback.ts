import { randomUUID } from "node:crypto";
import type { ArrivalFeedbackPayload, ArrivalFeedbackReport } from "../../shared/types";
import { database } from "./db.js";
import { HttpError } from "./errors.js";

const retentionMs = 90 * 24 * 60 * 60 * 1000;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const onlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every(key => allowed.includes(key));
const validRating = (value: unknown): value is number =>
  Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 5;

function parseReport(value: unknown): ArrivalFeedbackReport {
  if (!isRecord(value) || !onlyKeys(value, ["streetOrBlock", "lightingRating", "notes"])) {
    throw new HttpError(400, "Each lighting report needs a street or block and a rating.");
  }
  const streetOrBlock = typeof value.streetOrBlock === "string" ? value.streetOrBlock.trim() : "";
  const notes = value.notes === undefined ? "" : typeof value.notes === "string" ? value.notes.trim() : null;
  if (!streetOrBlock || streetOrBlock.length > 120 || !validRating(value.lightingRating) ||
      notes === null || notes.length > 280) {
    throw new HttpError(400, "Check the street or block, lighting rating, and note lengths.");
  }
  return {
    streetOrBlock,
    lightingRating: value.lightingRating,
    ...(notes ? { notes } : {}),
  };
}

export function submitArrivalFeedback(body: unknown): { ok: true } {
  if (!isRecord(body) || !onlyKeys(body, ["routeRating", "reports"]) || !validRating(body.routeRating)) {
    throw new HttpError(400, "Choose a route rating from 1 to 5.");
  }
  const rawReports = body.reports === undefined ? [] : body.reports;
  if (!Array.isArray(rawReports) || rawReports.length > 3) {
    throw new HttpError(400, "Add no more than three lighting reports.");
  }
  const payload: ArrivalFeedbackPayload = {
    routeRating: body.routeRating,
    reports: rawReports.map(parseReport),
  };
  const now = Date.now();
  database.prepare(
    "INSERT INTO arrival_feedback(id,route_rating,reports,created_at,expires_at) VALUES(?,?,?,?,?)",
  ).run(randomUUID(), payload.routeRating, JSON.stringify(payload.reports), now, now + retentionMs);
  return { ok: true };
}
