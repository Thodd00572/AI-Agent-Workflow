import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type { CanonicalTradingSignal } from "../domain/types.ts";
import {
  auditEvents,
  publicationJobs,
  publicationTargets,
  renderedAssets,
  signalRevisions,
  signals,
  sourceAssets,
  takeProfitZones,
  templates,
  templateVersions,
  type AppDb
} from "./schema.ts";
// AppDb is the drizzle client used by repositories.
import { TEMPLATE_ID, TEMPLATE_VERSION } from "../domain/types.ts";

export function nowIso(): string {
  return new Date().toISOString();
}

export async function nextSignalId(db: AppDb): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `SIG-${day}-`;
  const rows = db.select().from(signals).all();
  const sameDay = rows.filter((r) => r.id.startsWith(prefix));
  const seq = String(sameDay.length + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

export function seedDefaults(db: AppDb) {
  const existing = db.select().from(templates).all();
  if (existing.length === 0) {
    db.insert(templates).values({ id: TEMPLATE_ID, name: "Trading Signal Card" }).run();
    db.insert(templateVersions)
      .values({ id: `${TEMPLATE_ID}-${TEMPLATE_VERSION}`, templateId: TEMPLATE_ID, version: TEMPLATE_VERSION, immutable: 1 })
      .run();
  }
  const targets = db.select().from(publicationTargets).all();
  if (targets.length === 0) {
    db.insert(publicationTargets)
      .values({
        id: "telegram-default",
        platform: "telegram",
        name: "Telegram channel",
        enabled: 1,
        configJson: "{}"
      })
      .run();
  }
}

export function insertSignal(db: AppDb, doc: CanonicalTradingSignal, editor: string) {
  const s = doc.signal;
  db.insert(signals)
    .values({
      id: s.id,
      schemaVersion: doc.schema_version,
      symbol: s.symbol,
      direction: s.direction,
      timeframeValue: s.timeframe.value,
      timeframeUnit: s.timeframe.unit,
      entryLow: String(s.entry_zone.low),
      entryHigh: String(s.entry_zone.high),
      stopLoss: String(s.stop_loss.price),
      status: doc.workflow.status,
      extractionMethod: doc.extraction.method,
      parserVersion: doc.extraction.parser_version ?? null,
      currentRevision: 1,
      canonicalJson: JSON.stringify(doc),
      createdAt: doc.workflow.created_at,
      updatedAt: doc.workflow.updated_at,
      approvedAt: doc.workflow.approved_at ?? null,
      approvedBy: doc.workflow.approved_by ?? null
    })
    .run();

  replaceTakeProfits(db, s.id, s.take_profit_zones);

  db.insert(signalRevisions)
    .values({
      id: createId(),
      signalId: s.id,
      revision: 1,
      snapshotJson: JSON.stringify(doc),
      editor,
      changeInfo: "created",
      createdAt: nowIso()
    })
    .run();
}

export function replaceTakeProfits(
  db: AppDb,
  signalId: string,
  zones: { id: string; low: number; high: number }[]
) {
  db.delete(takeProfitZones).where(eq(takeProfitZones.signalId, signalId)).run();
  zones.forEach((z, i) => {
    db.insert(takeProfitZones)
      .values({
        id: createId(),
        signalId,
        sequence: i + 1,
        zoneKey: z.id,
        low: String(z.low),
        high: String(z.high)
      })
      .run();
  });
}

export function updateSignalDoc(db: AppDb, doc: CanonicalTradingSignal, editor: string, changeInfo: string) {
  const current = db.select().from(signals).where(eq(signals.id, doc.signal.id)).get();
  if (!current) throw new Error("Signal not found");
  const nextRev = current.currentRevision + 1;
  const s = doc.signal;
  db.update(signals)
    .set({
      symbol: s.symbol,
      direction: s.direction,
      timeframeValue: s.timeframe.value,
      timeframeUnit: s.timeframe.unit,
      entryLow: String(s.entry_zone.low),
      entryHigh: String(s.entry_zone.high),
      stopLoss: String(s.stop_loss.price),
      status: doc.workflow.status,
      canonicalJson: JSON.stringify(doc),
      currentRevision: nextRev,
      updatedAt: doc.workflow.updated_at,
      approvedAt: doc.workflow.approved_at ?? null,
      approvedBy: doc.workflow.approved_by ?? null
    })
    .where(eq(signals.id, s.id))
    .run();
  replaceTakeProfits(db, s.id, s.take_profit_zones);
  db.insert(signalRevisions)
    .values({
      id: createId(),
      signalId: s.id,
      revision: nextRev,
      snapshotJson: JSON.stringify(doc),
      editor,
      changeInfo,
      createdAt: nowIso()
    })
    .run();
}

export function saveStatus(db: AppDb, doc: CanonicalTradingSignal) {
  db.update(signals)
    .set({
      status: doc.workflow.status,
      canonicalJson: JSON.stringify(doc),
      updatedAt: doc.workflow.updated_at,
      approvedAt: doc.workflow.approved_at ?? null,
      approvedBy: doc.workflow.approved_by ?? null
    })
    .where(eq(signals.id, doc.signal.id))
    .run();
}

export function getRevisionNumber(db: AppDb, id: string): number {
  const row = db.select().from(signals).where(eq(signals.id, id)).get();
  return row?.currentRevision ?? 1;
}

export function getSignal(db: AppDb, id: string): CanonicalTradingSignal | undefined {
  const row = db.select().from(signals).where(eq(signals.id, id)).get();
  if (!row) return undefined;
  return JSON.parse(row.canonicalJson) as CanonicalTradingSignal;
}

export function listSignals(db: AppDb) {
  return db.select().from(signals).all().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function audit(db: AppDb, type: string, signalId: string | null, payload: unknown) {
  db.insert(auditEvents)
    .values({
      id: createId(),
      signalId,
      type,
      payloadJson: JSON.stringify(payload),
      createdAt: nowIso()
    })
    .run();
}

export function recordRendered(
  db: AppDb,
  input: {
    signalId: string;
    storageKey: string;
    sha256: string;
    width: number;
    height: number;
  }
) {
  db.insert(renderedAssets)
    .values({
      id: createId(),
      signalId: input.signalId,
      templateId: TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
      storageKey: input.storageKey,
      mimeType: "image/png",
      width: input.width,
      height: input.height,
      sha256: input.sha256
    })
    .run();
}

export function recordSourceAsset(
  db: AppDb,
  input: {
    signalId: string;
    storageKey: string;
    mimeType: string;
    filename: string;
    sha256: string;
    sizeBytes: number;
  }
) {
  const id = createId();
  db.insert(sourceAssets)
    .values({
      id,
      signalId: input.signalId,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      filename: input.filename,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes
    })
    .run();
  return id;
}

export function findPublication(db: AppDb, idempotencyKey: string) {
  return db.select().from(publicationJobs).where(eq(publicationJobs.idempotencyKey, idempotencyKey)).get();
}

export function insertPublication(
  db: AppDb,
  row: typeof publicationJobs.$inferInsert
) {
  db.insert(publicationJobs).values(row).run();
}

export function updatePublication(
  db: AppDb,
  id: string,
  patch: Partial<typeof publicationJobs.$inferInsert>
) {
  db.update(publicationJobs).set(patch).where(eq(publicationJobs.id, id)).run();
}

export function listPublications(db: AppDb, signalId: string) {
  return db.select().from(publicationJobs).where(eq(publicationJobs.signalId, signalId)).all();
}

export function listTargets(db: AppDb) {
  return db.select().from(publicationTargets).all();
}

export function listAudit(db: AppDb, signalId: string) {
  return db.select().from(auditEvents).where(eq(auditEvents.signalId, signalId)).all();
}

export function listRevisions(db: AppDb, signalId: string) {
  return db.select().from(signalRevisions).where(eq(signalRevisions.signalId, signalId)).all();
}

export function latestRendered(db: AppDb, signalId: string) {
  const rows = db.select().from(renderedAssets).where(eq(renderedAssets.signalId, signalId)).all();
  return rows.at(-1);
}

export function stats(db: AppDb) {
  const all = db.select().from(signals).all();
  const deterministic = all.filter((s) => s.extractionMethod === "deterministic").length;
  const ai = all.filter((s) => s.extractionMethod === "ai").length;
  const pubs = db.select().from(publicationJobs).all();
  return {
    signals: all.length,
    deterministic,
    ai,
    deterministicPct: all.length ? Math.round((deterministic / all.length) * 1000) / 10 : 0,
    publications: pubs.length,
    publicationSucceeded: pubs.filter((p) => p.status === "succeeded").length
  };
}
