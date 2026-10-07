import type { RequestHandler } from "express";
export function rateLimit(max: number, windowMs: number): RequestHandler {
  const counts = new Map<string, { total: number; until: number }>();
  const clean = setInterval(() => {
    for (const [key, value] of counts) if (value.until <= Date.now()) counts.delete(key);
  }, 60000);
  clean.unref();
  return (request, response, next) => {
    if (request.method === "OPTIONS") return next();
    const key = request.ip ?? request.socket.remoteAddress ?? "unknown";
    let value = counts.get(key);
    if (!value || value.until <= Date.now()) { value = { total: 0, until: Date.now() + windowMs }; counts.set(key, value); }
    value.total++;
    if (value.total > max) {
      response.setHeader("Retry-After", String(Math.ceil((value.until - Date.now()) / 1000)));
      response.status(429).json({ error: "Too many requests. Please wait a moment and try again." }); return;
    }
    next();
  };
}
