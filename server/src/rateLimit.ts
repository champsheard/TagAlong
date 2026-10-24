import type { RequestHandler } from "express";
import { createHmac } from "node:crypto";
import { database } from "./firestore";

export function rateLimit(max: number, windowMs: number, scope: string): RequestHandler {
  return (request, response, next) => {
    if (request.method === "OPTIONS") return next();
    const secret = process.env.SESSION_SECRET;
    if (!secret) return response.status(503).json({ error: "Rate limiting is not configured." });
    const client = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const id = createHmac("sha256", secret).update(`rate-limit-v1:${scope}:${client}`).digest("hex");
    const reference = database.collection("rate_limits").doc(id);
    void database.runTransaction(async transaction => {
      const now = Date.now();
      const snapshot = await transaction.get(reference);
      const row = snapshot.data() as { count: number; expires_at: number } | undefined;
      if (!row || row.expires_at <= now) {
        transaction.set(reference, { count: 1, expires_at: now + windowMs });
        return { allowed: true, retryAt: now + windowMs };
      }
      if (row.count >= max) return { allowed: false, retryAt: row.expires_at };
      transaction.update(reference, { count: row.count + 1 });
      return { allowed: true, retryAt: row.expires_at };
    }).then(result => {
      if (response.headersSent) return;
      if (!result.allowed) {
        response.setHeader("Retry-After", String(Math.max(1, Math.ceil((result.retryAt - Date.now()) / 1000))));
        response.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
        return;
      }
      next();
    }).catch(() => {
      if (!response.headersSent) response.status(503).json({ error: "Request protection is temporarily unavailable. Please retry." });
    });
  };
}
