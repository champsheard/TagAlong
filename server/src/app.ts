import cors from "cors";
import express from "express";
import { database } from "./db.js";

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  database.prepare("SELECT 1").get();
  response.json({
    status: "ok",
    service: "safe-walk-api",
    database: "connected",
  });
});
