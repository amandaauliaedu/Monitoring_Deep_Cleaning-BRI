import express from "express";
import compression from "compression";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { fetchPhoto } from "./sources.js";
import { buildWorkbook, buildUnitListWorkbook } from "./export.js";
import {
  getModel, buildOverview, buildResponses, buildResponseDetail,
  buildDashboard, buildUnitWeek, buildAnalytics, buildUnitList
} from "./views.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(compression());

  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error("[API]", err.message);
      res.status(err.status || 500).json({ error: err.message || "Terjadi kesalahan server." });
    }
  };

  app.get("/api/health", (req, res) => res.json({ ok: true, mode: config.mode }));

  app.get("/api/overview", wrap(async (req, res) => {
    res.json({ mode: config.mode, ...buildOverview(await getModel(), req.query.period) });
  }));

  app.get("/api/responses", wrap(async (req, res) => {
    res.json(buildResponses(await getModel(req.query.force === "1"), req.query));
  }));

  app.get("/api/responses/:id", wrap(async (req, res) => {
    const detail = buildResponseDetail(await getModel(), req.params.id);
    if (!detail) return res.status(404).json({ error: "Response tidak ditemukan." });
    res.json(detail);
  }));

  app.get("/api/export.xlsx", wrap(async (req, res) => {
    const buffer = await buildWorkbook(await getModel(), req.query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="deep-cleaning-ro12-${stamp}.xlsx"`
    });
    res.send(Buffer.from(buffer));
  }));

  app.get("/api/export-units.xlsx", wrap(async (req, res) => {
    const mode = req.query.mode === "sudah" ? "sudah" : "belum";
    const scope = ["1", "2", "3", "4"].includes(String(req.query.scope)) ? String(req.query.scope) : "all";
    const { period, rows } = buildUnitList(await getModel(), req.query.period, mode, scope);
    const buffer = await buildUnitListWorkbook(rows, { mode, scope, period });
    const name = `deep-cleaning-${mode}-mengisi-${scope === "all" ? "semua" : `week-${scope}`}-${period}.xlsx`;
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`
    });
    res.send(Buffer.from(buffer));
  }));

  app.get("/api/dashboard", wrap(async (req, res) => {
    res.json(buildDashboard(await getModel(), req.query.period));
  }));

  app.get("/api/dashboard/unit/:kodeUker/week/:week", wrap(async (req, res) => {
    const data = buildUnitWeek(await getModel(), req.params.kodeUker, Number(req.params.week), req.query.period);
    if (!data) return res.status(404).json({ error: "Unit kerja atau week tidak ditemukan." });
    res.json(data);
  }));

  app.get("/api/analytics", wrap(async (req, res) => {
    res.json(buildAnalytics(await getModel(), req.query.period));
  }));

  app.get("/api/photo/:id", wrap(async (req, res) => {
    if (!/^[\w-]{8,100}$/.test(req.params.id)) return res.status(400).json({ error: "ID foto tidak valid." });
    const { buffer, contentType } = await fetchPhoto(req.params.id);
    res.set({ "Content-Type": contentType, "Cache-Control": "private, max-age=86400" });
    res.send(buffer);
  }));

  app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan." }));

  const dist = path.resolve(__dirname, "../client/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: "1h" }));
    app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  return app;
}
