import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  telegramUserId: text("telegram_user_id"),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull()
});

export const signals = sqliteTable("signals", {
  id: text("id").primaryKey(),
  schemaVersion: text("schema_version").notNull(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(),
  timeframeValue: integer("timeframe_value").notNull(),
  timeframeUnit: text("timeframe_unit").notNull(),
  entryLow: text("entry_low").notNull(),
  entryHigh: text("entry_high").notNull(),
  stopLoss: text("stop_loss").notNull(),
  status: text("status").notNull(),
  extractionMethod: text("extraction_method").notNull(),
  parserVersion: text("parser_version"),
  currentRevision: integer("current_revision").notNull(),
  canonicalJson: text("canonical_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by")
});

export const signalRevisions = sqliteTable("signal_revisions", {
  id: text("id").primaryKey(),
  signalId: text("signal_id").notNull(),
  revision: integer("revision").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  editor: text("editor").notNull(),
  changeInfo: text("change_info"),
  createdAt: text("created_at").notNull()
});

export const takeProfitZones = sqliteTable("take_profit_zones", {
  id: text("id").primaryKey(),
  signalId: text("signal_id").notNull(),
  sequence: integer("sequence").notNull(),
  zoneKey: text("zone_key").notNull(),
  low: text("low").notNull(),
  high: text("high").notNull()
});

export const sourceAssets = sqliteTable("source_assets", {
  id: text("id").primaryKey(),
  signalId: text("signal_id").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  filename: text("filename").notNull(),
  sha256: text("sha256").notNull(),
  sizeBytes: integer("size_bytes").notNull()
});

export const renderedAssets = sqliteTable("rendered_assets", {
  id: text("id").primaryKey(),
  signalId: text("signal_id").notNull(),
  templateId: text("template_id").notNull(),
  templateVersion: text("template_version").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sha256: text("sha256").notNull()
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull()
});

export const templateVersions = sqliteTable("template_versions", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  version: text("version").notNull(),
  immutable: integer("immutable").notNull()
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  signalId: text("signal_id"),
  status: text("status").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const jobAttempts = sqliteTable("job_attempts", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: text("created_at").notNull()
});

export const publicationTargets = sqliteTable("publication_targets", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  enabled: integer("enabled").notNull(),
  configJson: text("config_json").notNull()
});

export const publicationJobs = sqliteTable(
  "publication_jobs",
  {
    id: text("id").primaryKey(),
    signalId: text("signal_id").notNull(),
    assetId: text("asset_id"),
    platform: text("platform").notNull(),
    targetId: text("target_id").notNull(),
    status: text("status").notNull(),
    scheduledAt: text("scheduled_at"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    externalPostId: text("external_post_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    revision: integer("revision").notNull()
  },
  (t) => [uniqueIndex("pub_idempotency").on(t.idempotencyKey)]
);

export const aiRequests = sqliteTable("ai_requests", {
  id: text("id").primaryKey(),
  signalId: text("signal_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: text("created_at").notNull()
});

export const aiResponses = sqliteTable("ai_responses", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  bodyJson: text("body_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  signalId: text("signal_id"),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const oauthConnections = sqliteTable("oauth_connections", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  accountId: text("account_id").notNull(),
  accountName: text("account_name").notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  expiresAt: text("expires_at"),
  scopes: text("scopes"),
  status: text("status").notNull()
});

export const schema = {
  adminUsers,
  signals,
  signalRevisions,
  takeProfitZones,
  sourceAssets,
  renderedAssets,
  templates,
  templateVersions,
  jobs,
  jobAttempts,
  publicationTargets,
  publicationJobs,
  aiRequests,
  aiResponses,
  auditEvents,
  oauthConnections
};

export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

export function openDb(url: string): { sqlite: Database.Database; db: AppDb } {
  const file = url.startsWith("file:") ? url.slice(5) : url;
  const abs = resolve(file);
  mkdirSync(dirname(abs), { recursive: true });
  const sqlite = new Database(abs);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(sqlite);
  return { sqlite, db };
}

function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      telegram_user_id TEXT,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      schema_version TEXT NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      timeframe_value INTEGER NOT NULL,
      timeframe_unit TEXT NOT NULL,
      entry_low TEXT NOT NULL,
      entry_high TEXT NOT NULL,
      stop_loss TEXT NOT NULL,
      status TEXT NOT NULL,
      extraction_method TEXT NOT NULL,
      parser_version TEXT,
      current_revision INTEGER NOT NULL,
      canonical_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approved_at TEXT,
      approved_by TEXT
    );
    CREATE TABLE IF NOT EXISTS signal_revisions (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      editor TEXT NOT NULL,
      change_info TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS take_profit_zones (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      zone_key TEXT NOT NULL,
      low TEXT NOT NULL,
      high TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS source_assets (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rendered_assets (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_version TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS template_versions (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      version TEXT NOT NULL,
      immutable INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      signal_id TEXT,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_attempts (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS publication_targets (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      config_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS publication_jobs (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      asset_id TEXT,
      platform TEXT NOT NULL,
      target_id TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      external_post_id TEXT,
      error_code TEXT,
      error_message TEXT,
      attempt_count INTEGER NOT NULL,
      idempotency_key TEXT NOT NULL,
      revision INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pub_idempotency ON publication_jobs(idempotency_key);
    CREATE TABLE IF NOT EXISTS ai_requests (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_responses (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      body_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      signal_id TEXT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_connections (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      encrypted_access_token TEXT NOT NULL,
      encrypted_refresh_token TEXT,
      expires_at TEXT,
      scopes TEXT,
      status TEXT NOT NULL
    );
  `);
}
