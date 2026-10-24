import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { loadConfig } from "../src/config.ts";
import { openAndReady } from "../src/database/bootstrap.ts";
import { findPublication, getRevisionNumber, saveStatus } from "../src/database/repo.ts";
import { signals } from "../src/database/schema.ts";
import { approveAndPublish, ingestAndProcess } from "../src/pipeline/engine.ts";
import { createLogger } from "../src/logging/logger.ts";
import { idempotencyKey, type Publisher } from "../src/publishers/index.ts";
import { ExtractionRouter } from "../src/extraction/router.ts";
import { DeterministicParser } from "../src/extraction/parsing/deterministic-parser.ts";
import { AIExtractor } from "../src/extraction/ai/ai-extractor.ts";

vi.mock("../src/rendering/index.ts", () => ({
  renderSignalPng: async (
    doc: { signal: { id: string }; render: { width: number; height: number } },
    storageDir: string
  ) => {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    mkdirSync(storageDir, { recursive: true });
    const pngPath = join(storageDir, `${doc.signal.id}.png`);
    writeFileSync(pngPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return { html: "<html></html>", pngPath, sha256: "abc", width: doc.render.width, height: doc.render.height };
  }
}));

const SAMPLE = `SHORT XAUUSD 30m
Entry: 4116-4129
SL: 4135
TP1: 4092-4104
TP2: 4016-4020`;

describe("router fallback", () => {
  it("falls back to AI when known grammar is still ambiguous", async () => {
    const ai = new AIExtractor(null, "gpt-5.6");
    const router = new ExtractionRouter(new DeterministicParser(), ai);
    const text = "SHORT XAUUSD 30m Entry 4116-4129 SL banana TP1 4092-4104";
    const result = await router.extract({ text, hasImage: false });
    expect(result.fallbackFromDeterministic).toBe(true);
    expect(result.routedTo).toBe("ai");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("EXTRACTOR_UNAVAILABLE");
  });
});

describe("pipeline", () => {
  it("completes deterministic ingest and does not duplicate a successful publish", async () => {
    const dir = mkdtempSync(join(tmpdir(), "signal-"));
    mkdirSync(join(dir, "storage"), { recursive: true });
    const { db } = openAndReady(`file:${join(dir, "t.sqlite")}`);
    const config = loadConfig({
      DATABASE_URL: `file:${join(dir, "t.sqlite")}`,
      STORAGE_DIR: join(dir, "storage")
    });
    const calls: string[] = [];
    const telegram: Publisher = {
      platform: "telegram",
      async publish(input) {
        calls.push(input.idempotencyKey);
        return { status: "succeeded", externalPostId: "1" };
      },
      async validateConfiguration() {
        return { ok: true, message: "ok" };
      }
    };
    const deps = { db, config, logger: createLogger(), publishers: { telegram } };

    const created = await ingestAndProcess(deps, {
      text: SAMPLE,
      editor: "test",
      source: { channel: "operator_web", raw_prompt: SAMPLE }
    });
    expect(created.ok).toBe(true);
    expect(created.signal?.extraction.method).toBe("deterministic");
    expect(created.signal?.workflow.status).toBe("AWAITING_APPROVAL");
    const id = created.signal!.signal.id;

    const first = await approveAndPublish(deps, id, "admin");
    expect(first.ok).toBe(true);

    const row = db.select().from(signals).where(eq(signals.id, id)).get();
    const snap = JSON.parse(row!.canonicalJson);
    snap.workflow.status = "AWAITING_APPROVAL";
    saveStatus(deps.db, snap);

    const second = await approveAndPublish(deps, id, "admin");
    expect(second.ok).toBe(true);
    const revision = getRevisionNumber(db, id);
    const key = idempotencyKey(id, "telegram", "telegram-default", revision);
    const pub = findPublication(db, key);
    expect(pub?.status).toBe("succeeded");
    expect(calls.filter((k) => k === key)).toHaveLength(1);
  });
});
