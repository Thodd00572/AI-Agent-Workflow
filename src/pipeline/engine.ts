import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import OpenAI from "openai";
import { attachDerived } from "../domain/derived.ts";
import { canPublish, transition } from "../domain/state-machine.ts";
import {
  RENDERER_VERSION,
  SCHEMA_VERSION,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  type CanonicalTradingSignal,
  type ExtractionMeta,
  type SourceMeta,
  type TradingSignalCore,
  type WorkflowStatus
} from "../domain/types.ts";
import { formatIssues, validateTradingSignal } from "../domain/validation.ts";
import { DeterministicParser, parseEditInstruction } from "../extraction/parsing/deterministic-parser.ts";
import { AIExtractor } from "../extraction/ai/ai-extractor.ts";
import { ExtractionRouter } from "../extraction/router.ts";
import {
  audit,
  findPublication,
  getSignal,
  insertPublication,
  insertSignal,
  getRevisionNumber,
  latestRendered,
  listPublications,
  listTargets,
  nextSignalId,
  nowIso,
  recordRendered,
  recordSourceAsset,
  saveStatus,
  updatePublication,
  updateSignalDoc
} from "../database/repo.ts";
import type { AppDb } from "../database/schema.ts";
import { renderSignalPng } from "../rendering/index.ts";
import { buildCaptions } from "../content/captions.ts";
import { idempotencyKey, type Publisher } from "../publishers/index.ts";
import type { AppConfig } from "../config.ts";
import type { Logger } from "../logging/logger.ts";

export interface PipelineDeps {
  db: AppDb;
  config: AppConfig;
  logger: Logger;
  publishers: Record<string, Publisher>;
}

export function makeRouter(config: AppConfig): ExtractionRouter {
  const client = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;
  return new ExtractionRouter(new DeterministicParser(), new AIExtractor(client, config.openaiModel));
}

export interface IngestInput {
  text: string;
  editor: string;
  source: SourceMeta;
  image?: { buffer: Buffer; mimeType: string; filename: string };
}

export interface PipelineResult {
  ok: boolean;
  signal?: CanonicalTradingSignal;
  pngUrl?: string;
  issues?: string;
  code?: string;
}

function setStatus(doc: CanonicalTradingSignal, from: WorkflowStatus, to: WorkflowStatus): CanonicalTradingSignal {
  const status = transition(from, to);
  return {
    ...doc,
    workflow: { ...doc.workflow, status, updated_at: nowIso() }
  };
}

export async function ingestAndProcess(deps: PipelineDeps, input: IngestInput): Promise<PipelineResult> {
  const { db, config, logger } = deps;
  const router = makeRouter(config);
  const signalId = await nextSignalId(db);
  const createdAt = nowIso();
  audit(db, "SignalCreated", signalId, { editor: input.editor, text: input.text, hasImage: Boolean(input.image) });

  let source = { ...input.source };
  if (input.image) {
    mkdirSync(config.storageDir, { recursive: true });
    const sha = createHash("sha256").update(input.image.buffer).digest("hex");
    const storageKey = join(config.storageDir, `source-${signalId}`);
    writeFileSync(storageKey, input.image.buffer);
    const assetId = recordSourceAsset(db, {
      signalId,
      storageKey,
      mimeType: input.image.mimeType,
      filename: input.image.filename,
      sha256: sha,
      sizeBytes: input.image.buffer.length
    });
    source = { ...source, source_image_asset_id: assetId };
  }

  const extracted = await router.extract({
    text: input.text,
    hasImage: Boolean(input.image),
    imageBase64: input.image?.buffer.toString("base64"),
    imageMimeType: input.image?.mimeType
  });

  if (extracted.fallbackFromDeterministic) {
    audit(db, "SignalNeedsClarification", signalId, { reason: "deterministic_fallback" });
  }

  if (!extracted.ok) {
    audit(db, extracted.code === "NEEDS_CLARIFICATION" ? "SignalNeedsClarification" : "SignalValidationFailed", signalId, extracted);
    return { ok: false, code: extracted.code, issues: extracted.message };
  }

  if (extracted.method === "deterministic") {
    audit(db, "SignalParsedDeterministically", signalId, { parser_version: extracted.parser_version });
  } else {
    audit(db, "SignalParsedByAI", signalId, extracted.ai ?? {});
  }

  const core: TradingSignalCore = { id: signalId, ...extracted.core };
  const extraction: ExtractionMeta =
    extracted.method === "deterministic"
      ? { method: "deterministic", parser_version: extracted.parser_version }
      : { method: "ai", ...extracted.ai };

  let doc: CanonicalTradingSignal = attachDerived({
    schema_version: SCHEMA_VERSION,
    signal: core,
    source,
    render: {
      template_id: TEMPLATE_ID,
      template_version: TEMPLATE_VERSION,
      renderer_version: RENDERER_VERSION,
      output_format: "png",
      width: config.cardWidth,
      height: config.cardHeight
    },
    workflow: {
      status: "VALIDATING",
      created_at: createdAt,
      updated_at: nowIso()
    },
    extraction
  });

  insertSignal(db, doc, input.editor);

  const validated = validateTradingSignal(doc.signal);
  if (!validated.ok) {
    doc = { ...doc, workflow: { ...doc.workflow, status: "FAILED", updated_at: nowIso() } };
    saveStatus(db, doc);
    audit(db, "SignalValidationFailed", signalId, validated.issues);
    return { ok: false, code: "VALIDATION_FAILED", issues: formatIssues(validated.issues), signal: doc };
  }
  audit(db, "SignalValidated", signalId, { extraction: doc.extraction.method });

  try {
    doc = setStatus(doc, "VALIDATING", "RENDERING");
    saveStatus(db, doc);
    audit(db, "RenderRequested", signalId, { template: TEMPLATE_VERSION });
    const rendered = await renderSignalPng(doc, config.storageDir);
    recordRendered(db, {
      signalId,
      storageKey: rendered.pngPath,
      sha256: rendered.sha256,
      width: rendered.width,
      height: rendered.height
    });
    doc = setStatus(doc, "RENDERING", "AWAITING_APPROVAL");
    saveStatus(db, doc);
    audit(db, "RenderCompleted", signalId, { sha256: rendered.sha256 });
    logger.info({ signal_id: signalId, status: doc.workflow.status }, "signal ready for approval");
    return { ok: true, signal: doc, pngUrl: `/assets/${signalId}.png` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    doc = { ...doc, workflow: { ...doc.workflow, status: "FAILED", updated_at: nowIso() } };
    saveStatus(db, doc);
    return { ok: false, code: "RENDER_FAILED", issues: message, signal: doc };
  }
}

export async function regenerate(deps: PipelineDeps, signalId: string): Promise<PipelineResult> {
  const doc = getSignal(deps.db, signalId);
  if (!doc) return { ok: false, code: "NOT_FOUND", issues: "Signal not found" };
  if (doc.workflow.status !== "AWAITING_APPROVAL") {
    return { ok: false, code: "ILLEGAL_STATE", issues: `Cannot regenerate from ${doc.workflow.status}` };
  }
  let next = setStatus(doc, "AWAITING_APPROVAL", "RENDERING");
  saveStatus(deps.db, next);
  try {
    const rendered = await renderSignalPng(next, deps.config.storageDir);
    recordRendered(deps.db, {
      signalId,
      storageKey: rendered.pngPath,
      sha256: rendered.sha256,
      width: rendered.width,
      height: rendered.height
    });
    next = setStatus(next, "RENDERING", "AWAITING_APPROVAL");
    saveStatus(deps.db, next);
    return { ok: true, signal: next, pngUrl: `/assets/${signalId}.png` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    next = { ...next, workflow: { ...next.workflow, status: "FAILED", updated_at: nowIso() } };
    saveStatus(deps.db, next);
    return { ok: false, code: "RENDER_FAILED", issues: message, signal: next };
  }
}

export async function applyEdit(
  deps: PipelineDeps,
  signalId: string,
  editor: string,
  instruction: string
): Promise<PipelineResult> {
  const doc = getSignal(deps.db, signalId);
  if (!doc) return { ok: false, code: "NOT_FOUND", issues: "Signal not found" };
  if (doc.workflow.status !== "AWAITING_APPROVAL") {
    return { ok: false, code: "ILLEGAL_STATE", issues: `Cannot edit from ${doc.workflow.status}` };
  }

  let next = setStatus(doc, "AWAITING_APPROVAL", "EDITING");
  const parsed = parseEditInstruction(instruction);
  if (!parsed.ok) {
    next = { ...next, workflow: { ...next.workflow, status: "AWAITING_APPROVAL", updated_at: nowIso() } };
    saveStatus(deps.db, next);
    return { ok: false, code: "NEEDS_CLARIFICATION", issues: "Could not parse edit. Try: Change SL to 4137" };
  }

  const core = { ...next.signal, take_profit_zones: next.signal.take_profit_zones.map((z) => ({ ...z })) };
  const p = parsed.patch;
  if (p.field === "stop_loss" && p.price !== undefined) core.stop_loss = { price: p.price };
  if (p.field === "entry_zone" && p.low !== undefined && p.high !== undefined) core.entry_zone = { low: p.low, high: p.high };
  if (p.field === "take_profit" && p.tpId && p.low !== undefined && p.high !== undefined) {
    const idx = core.take_profit_zones.findIndex((z) => z.id === p.tpId);
    if (idx === -1) {
      return { ok: false, code: "NEEDS_CLARIFICATION", issues: `Unknown zone ${p.tpId}` };
    }
    core.take_profit_zones[idx] = { ...core.take_profit_zones[idx], low: p.low, high: p.high };
  }

  next = attachDerived({
    ...next,
    signal: core,
    workflow: { ...next.workflow, status: "VALIDATING", updated_at: nowIso() }
  });

  const validated = validateTradingSignal(next.signal);
  if (!validated.ok) {
    const reverted = {
      ...doc,
      workflow: { ...doc.workflow, status: "AWAITING_APPROVAL" as const, updated_at: nowIso() }
    };
    saveStatus(deps.db, reverted);
    audit(deps.db, "SignalValidationFailed", signalId, validated.issues);
    return { ok: false, code: "VALIDATION_FAILED", issues: formatIssues(validated.issues), signal: reverted };
  }

  try {
    next = setStatus(next, "VALIDATING", "RENDERING");
    const rendered = await renderSignalPng(next, deps.config.storageDir);
    recordRendered(deps.db, {
      signalId,
      storageKey: rendered.pngPath,
      sha256: rendered.sha256,
      width: rendered.width,
      height: rendered.height
    });
    next = setStatus(next, "RENDERING", "AWAITING_APPROVAL");
    updateSignalDoc(deps.db, next, editor, instruction);
    audit(deps.db, "SignalEdited", signalId, { instruction, editor });
    return { ok: true, signal: next, pngUrl: `/assets/${signalId}.png` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "RENDER_FAILED", issues: message };
  }
}

export function cancelSignal(deps: PipelineDeps, signalId: string): PipelineResult {
  const doc = getSignal(deps.db, signalId);
  if (!doc) return { ok: false, code: "NOT_FOUND", issues: "Signal not found" };
  if (doc.workflow.status !== "AWAITING_APPROVAL") {
    return { ok: false, code: "ILLEGAL_STATE", issues: `Cannot cancel from ${doc.workflow.status}` };
  }
  const next = setStatus(doc, "AWAITING_APPROVAL", "CANCELLED");
  saveStatus(deps.db, next);
  audit(deps.db, "SignalCancelled", signalId, {});
  return { ok: true, signal: next };
}

export async function approveAndPublish(
  deps: PipelineDeps,
  signalId: string,
  approvedBy: string,
  platforms?: string[]
): Promise<PipelineResult & { publications?: unknown[] }> {
  const doc = getSignal(deps.db, signalId);
  if (!doc) return { ok: false, code: "NOT_FOUND", issues: "Signal not found" };
  if (!canPublish(doc.workflow.status)) {
    return { ok: false, code: "QUALITY_GATE", issues: "Signal is not awaiting approval" };
  }
  const validated = validateTradingSignal(doc.signal);
  if (!validated.ok) {
    return { ok: false, code: "QUALITY_GATE", issues: formatIssues(validated.issues) };
  }
  const asset = latestRendered(deps.db, signalId);
  if (!asset) return { ok: false, code: "QUALITY_GATE", issues: "PNG asset is missing" };
  if (asset.width !== doc.render.width || asset.height !== doc.render.height) {
    return { ok: false, code: "QUALITY_GATE", issues: "PNG dimensions do not match template" };
  }

  const revision = getRevisionNumber(deps.db, signalId);

  let next: CanonicalTradingSignal = {
    ...setStatus(doc, "AWAITING_APPROVAL", "PUBLISHING"),
    workflow: {
      ...doc.workflow,
      status: "PUBLISHING",
      updated_at: nowIso(),
      approved_at: nowIso(),
      approved_by: approvedBy
    }
  };
  saveStatus(deps.db, next);
  audit(deps.db, "SignalApproved", signalId, { approvedBy });
  audit(deps.db, "PublicationRequested", signalId, { platforms });

  const captions = buildCaptions(next);
  const targets = listTargets(deps.db).filter((t) => t.enabled === 1);
  const wanted = platforms?.length ? targets.filter((t) => platforms.includes(t.platform)) : targets.filter((t) => t.platform === "telegram");

  for (const target of wanted) {
    const key = idempotencyKey(signalId, target.platform, target.id, revision);
    const existing = findPublication(deps.db, key);
    if (existing?.status === "succeeded") {
      audit(deps.db, "PublicationSucceeded", signalId, { deduped: true, platform: target.platform });
      continue;
    }
    const pubId = existing?.id ?? createId();
    if (!existing) {
      insertPublication(deps.db, {
        id: pubId,
        signalId,
        assetId: asset.id,
        platform: target.platform,
        targetId: target.id,
        status: "started",
        startedAt: nowIso(),
        attemptCount: 1,
        idempotencyKey: key,
        revision
      });
    } else {
      updatePublication(deps.db, pubId, {
        status: "started",
        startedAt: nowIso(),
        attemptCount: existing.attemptCount + 1
      });
    }
    audit(deps.db, "PublicationStarted", signalId, { platform: target.platform });
    const publisher = deps.publishers[target.platform];
    if (!publisher) {
      updatePublication(deps.db, pubId, {
        status: "failed",
        completedAt: nowIso(),
        errorCode: "NO_ADAPTER",
        errorMessage: `No publisher for ${target.platform}`
      });
      audit(deps.db, "PublicationFailed", signalId, { platform: target.platform });
      continue;
    }
    const copy = captions[target.platform] ?? captions.telegram;
    const result = await publisher.publish({
      signalId,
      revision,
      platform: target.platform,
      targetId: target.id,
      assetPath: asset.storageKey,
      headerText: copy.header,
      caption: copy.text,
      idempotencyKey: key
    });
    updatePublication(deps.db, pubId, {
      status: result.status === "succeeded" ? "succeeded" : result.status === "skipped" ? "skipped" : "failed",
      completedAt: nowIso(),
      externalPostId: result.externalPostId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage
    });
    audit(
      deps.db,
      result.status === "succeeded" ? "PublicationSucceeded" : "PublicationFailed",
      signalId,
      { platform: target.platform, result }
    );
  }

  next = {
    ...next,
    workflow: { ...next.workflow, status: "PUBLISHED", updated_at: nowIso() }
  };
  saveStatus(deps.db, next);
  return { ok: true, signal: next, pngUrl: `/assets/${signalId}.png`, publications: listPublications(deps.db, signalId) };
}
