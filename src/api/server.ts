import { createReadStream, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import Fastify from "fastify";
import { Bot, webhookCallback } from "grammy";
import { loadConfig } from "../config.ts";
import { listAudit, listPublications, listRevisions, listSignals, listTargets, openAndReady, stats } from "../database/bootstrap.ts";
import { getSignal, latestRendered } from "../database/repo.ts";
import { createLogger } from "../logging/logger.ts";
import {
  applyEdit,
  approveAndPublish,
  cancelSignal,
  ingestAndProcess,
  regenerate,
  type PipelineDeps
} from "../pipeline/engine.ts";
import { createPublishers } from "../publishers/index.ts";
import { validateTradingSignal } from "../domain/validation.ts";
import { registerTelegram } from "../telegram/bot.ts";
import { TEMPLATE_ID, TEMPLATE_VERSION } from "../domain/types.ts";
import { demoSignal } from "../rendering/demo.ts";
import { toPresentation } from "../rendering/presentation.ts";
import { renderCardHtml } from "../rendering/template.ts";
import { parseCardFormat } from "../rendering/tokens.ts";
import { fetchMarketCandles } from "../marketdata/index.ts";

const config = loadConfig();
const logger = createLogger();
const { db } = openAndReady(config.databaseUrl);

const bot = config.telegramBotToken ? new Bot(config.telegramBotToken) : undefined;
const publishers = createPublishers({
  telegramToken: config.telegramBotToken,
  telegramChatId: config.telegramPublishChatId,
  bot,
  inboxDir: join(config.storageDir, "inbox")
});

const deps: PipelineDeps = { db, config, logger, publishers };

if (bot) {
  registerTelegram(bot, deps);
}

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } });

app.get("/health", async () => ({ ok: true, service: "signal-platform" }));
app.get("/signal-card.html", async (_req, reply) => {
  const file = resolve("templates/trading-signal/v1/preview.html");
  if (!existsSync(file)) return reply.code(404).send({ ok: false });
  return reply.type("text/html").send(createReadStream(file));
});
app.get("/preview/card.html", async (req, reply) => {
  const q = (req.query ?? {}) as Record<string, string | undefined>;
  const format = parseCardFormat(q.format);
  const doc = demoSignal({
    format,
    direction: q.direction,
    symbol: q.symbol,
    timeframe: q.timeframe,
    entryLow: numQuery(q.entryLow),
    entryHigh: numQuery(q.entryHigh),
    stop: numQuery(q.stop),
    tp1Low: numQuery(q.tp1l ?? q.tp1Low),
    tp1High: numQuery(q.tp1h ?? q.tp1High),
    tp2Low: numQuery(q.tp2l ?? q.tp2Low),
    tp2High: numQuery(q.tp2h ?? q.tp2High)
  });
  const market =
    q.live === "0" ? undefined : await fetchMarketCandles(doc.signal.symbol, doc.signal.timeframe).catch(() => undefined);
  const html = renderCardHtml(toPresentation(doc, market), format);
  return reply.type("text/html").header("Cache-Control", "no-store").send(html);
});
app.get("/api/market/candles", async (req, reply) => {
  const q = (req.query ?? {}) as Record<string, string | undefined>;
  const symbol = q.symbol ?? "XAUUSD";
  const timeframe = q.timeframe ?? "30 MINUTES";
  try {
    const series = await fetchMarketCandles(symbol, timeframe);
    return {
      ok: true,
      symbol: series.symbol,
      mappedSymbol: series.mappedSymbol,
      provider: series.provider,
      interval: series.interval,
      last: series.last,
      bars: series.candles.length,
      updatedAt: series.candles.at(-1)?.time
    };
  } catch (err) {
    return reply.code(502).send({
      ok: false,
      code: "MARKET_DATA_UNAVAILABLE",
      message: err instanceof Error ? err.message : "Market data unavailable"
    });
  }
});

app.get("/api/stats", async () => stats(db));
app.get("/api/templates", async () => [
  { template_id: TEMPLATE_ID, template_version: TEMPLATE_VERSION, immutable: true }
]);
app.get("/api/distribution-profiles", async () => listTargets(db));

app.get("/api/signals", async () =>
  listSignals(db).map((row) => ({
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    status: row.status,
    extraction_method: row.extractionMethod,
    created_at: row.createdAt
  }))
);

app.get("/api/signals/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const signal = getSignal(db, id);
  if (!signal) return reply.code(404).send({ ok: false, code: "NOT_FOUND" });
  return {
    ok: true,
    signal,
    pngUrl: `/assets/${id}.png`,
    publications: listPublications(db, id),
    revisions: listRevisions(db, id),
    audit: listAudit(db, id)
  };
});

app.post("/api/signals/:id/validate", async (req, reply) => {
  const { id } = req.params as { id: string };
  const signal = getSignal(db, id);
  if (!signal) return reply.code(404).send({ ok: false, code: "NOT_FOUND" });
  return validateTradingSignal(signal.signal);
});

app.post("/api/signals/:id/render", async (req, reply) => {
  const { id } = req.params as { id: string };
  return reply.send(await regenerate(deps, id));
});

app.post("/api/signals/:id/preview", async (req, reply) => {
  const { id } = req.params as { id: string };
  const signal = getSignal(db, id);
  if (!signal) return reply.code(404).send({ ok: false, code: "NOT_FOUND" });
  return { ok: true, signal, pngUrl: `/assets/${id}.png` };
});

app.post("/api/signals", async (req, reply) => {
  const mp = req.isMultipart();
  let text = "";
  let editor = "operator";
  let image: { buffer: Buffer; mimeType: string; filename: string } | undefined;

  if (mp) {
    for await (const part of req.parts()) {
      if (part.type === "file") {
        const buf = await part.toBuffer();
        image = { buffer: buf, mimeType: part.mimetype, filename: part.filename };
      } else if (part.fieldname === "text") {
        text = String(part.value);
      } else if (part.fieldname === "editor") {
        editor = String(part.value);
      }
    }
  } else {
    const body = (req.body ?? {}) as { text?: string; editor?: string };
    text = body.text ?? "";
    editor = body.editor ?? "operator";
  }

  if (!text.trim()) {
    return reply.code(400).send({ ok: false, code: "NEEDS_CLARIFICATION", issues: "Signal text is required" });
  }

  const result = await ingestAndProcess(deps, {
    text,
    editor,
    source: { channel: "operator_web", raw_prompt: text },
    image
  });
  return reply.code(result.ok ? 200 : 422).send(result);
});

app.post("/api/signals/:id/edit", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body ?? {}) as { instruction?: string; editor?: string };
  const result = await applyEdit(deps, id, body.editor ?? "operator", body.instruction ?? "");
  return reply.code(result.ok ? 200 : 422).send(result);
});

app.post("/api/signals/:id/regenerate", async (req, reply) => {
  const { id } = req.params as { id: string };
  return reply.send(await regenerate(deps, id));
});

app.post("/api/signals/:id/cancel", async (req, reply) => {
  const { id } = req.params as { id: string };
  return reply.send(cancelSignal(deps, id));
});

app.post("/api/signals/:id/approve", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body ?? {}) as { approvedBy?: string; platforms?: string[] };
  const result = await approveAndPublish(deps, id, body.approvedBy ?? "operator", body.platforms);
  return reply.send(result);
});

app.post("/api/signals/:id/publish", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body ?? {}) as { approvedBy?: string; platforms?: string[] };
  const result = await approveAndPublish(deps, id, body.approvedBy ?? "operator", body.platforms);
  return reply.send(result);
});

app.get("/api/signals/:id/publications", async (req, reply) => {
  const { id } = req.params as { id: string };
  if (!getSignal(db, id)) return reply.code(404).send({ ok: false, code: "NOT_FOUND" });
  return listPublications(db, id);
});

app.get("/assets/:id.png", async (req, reply) => {
  const { id } = req.params as { id: string };
  const asset = latestRendered(db, id);
  const path = asset?.storageKey ?? join(config.storageDir, `${id}.png`);
  if (!existsSync(path)) return reply.code(404).send({ ok: false, code: "NOT_FOUND" });
  return reply.type("image/png").send(createReadStream(path));
});

app.get("/assets/:id.html", async (req, reply) => {
  const { id } = req.params as { id: string };
  const htmlPath = join(config.storageDir, `${id}.html`);
  if (!existsSync(htmlPath)) return reply.code(404).send({ ok: false, code: "NOT_FOUND" });
  return reply.type("text/html").send(createReadStream(htmlPath));
});

if (bot) {
  const secret = config.telegramWebhookSecret;
  app.post(`/webhooks/telegram/${secret}`, webhookCallback(bot, "fastify"));
}

const webDist = resolve("apps/web/dist");
if (existsSync(webDist)) {
  await app.register(staticFiles, {
    root: webDist,
    prefix: "/",
    wildcard: false
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.method === "GET" && !req.url.startsWith("/api") && !req.url.startsWith("/assets") && !req.url.startsWith("/webhooks")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ ok: false, code: "NOT_FOUND" });
  });
}

function numQuery(v?: string): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const port = config.port;
await app.listen({ port, host: "0.0.0.0" });
logger.info({ port }, "signal platform listening");
