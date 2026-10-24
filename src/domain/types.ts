export const SCHEMA_VERSION = "1.0";
export const PARSER_VERSION = "shorthand-grammar-v1";
export const TEMPLATE_ID = "trading-signal";
export const TEMPLATE_VERSION = "1.2";
export const RENDERER_VERSION = "1.3";
export const PROMPT_VERSION = "signal-extractor-v1";
export const GUIDELINE_VERSION = "trading-guideline-v1";

export type Direction = "LONG" | "SHORT";
export type TimeframeUnit = "MINUTES" | "HOURS" | "DAYS";
export type ExtractionMethod = "deterministic" | "ai";
export type WorkflowStatus =
  | "IDLE"
  | "RECEIVING_SIGNAL"
  | "PARSING"
  | "VALIDATING"
  | "RENDERING"
  | "AWAITING_APPROVAL"
  | "EDITING"
  | "PUBLISHING"
  | "PUBLISHED"
  | "CANCELLED"
  | "FAILED"
  | "NEEDS_CLARIFICATION";

export interface Timeframe {
  value: number;
  unit: TimeframeUnit;
}

export interface PriceZone {
  low: number;
  high: number;
}

export interface TakeProfitZone {
  id: string;
  low: number;
  high: number;
}

export interface TradingSignalCore {
  id: string;
  symbol: string;
  direction: Direction;
  timeframe: Timeframe;
  entry_zone: PriceZone;
  stop_loss: { price: number };
  take_profit_zones: TakeProfitZone[];
}

export interface ExtractionMeta {
  method: ExtractionMethod;
  parser_version?: string;
  provider?: string;
  model?: string;
  prompt_version?: string;
  guideline_version?: string;
}

export interface SourceMeta {
  channel: "telegram" | "operator_web";
  chat_id?: string;
  message_id?: string;
  raw_prompt: string;
  source_image_asset_id?: string;
}

export interface RenderMeta {
  template_id: string;
  template_version: string;
  renderer_version: string;
  output_format: "png";
  width: number;
  height: number;
}

export interface WorkflowMeta {
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface DerivedMetrics {
  entry_midpoint: number;
  risk_distance: number;
  risk_distance_pct: number;
  take_profit_midpoints: number[];
  take_profit_distances: number[];
  risk_rewards: number[];
}

export interface CanonicalTradingSignal {
  schema_version: string;
  signal: TradingSignalCore;
  source: SourceMeta;
  render: RenderMeta;
  workflow: WorkflowMeta;
  extraction: ExtractionMeta;
  derived?: DerivedMetrics;
}

export interface ExtractionInput {
  text: string;
  hasImage: boolean;
  imageBase64?: string;
  imageMimeType?: string;
}

export type ExtractionOutcome =
  | { ok: true; method: ExtractionMethod; core: Omit<TradingSignalCore, "id">; parser_version?: string; ai?: Omit<ExtractionMeta, "method"> }
  | { ok: false; code: "NEEDS_CLARIFICATION"; method: ExtractionMethod; message: string; missing: string[] }
  | { ok: false; code: "EXTRACTOR_UNAVAILABLE"; method: ExtractionMethod; message: string };

export interface Extractor {
  extract(input: ExtractionInput): Promise<ExtractionOutcome>;
}

export interface PublishRequest {
  signalId: string;
  revision: number;
  platform: string;
  targetId: string;
  assetPath: string;
  caption: string;
  headerText?: string;
  idempotencyKey: string;
}

export interface PublishResult {
  status: "succeeded" | "failed" | "skipped";
  externalPostId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface Publisher {
  platform: string;
  publish(input: PublishRequest): Promise<PublishResult>;
  validateConfiguration(): Promise<{ ok: boolean; message: string }>;
}
