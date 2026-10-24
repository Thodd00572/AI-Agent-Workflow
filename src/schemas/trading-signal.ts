import { z } from "zod";

export const directionSchema = z.enum(["LONG", "SHORT"]);
export const timeframeUnitSchema = z.enum(["MINUTES", "HOURS", "DAYS"]);

export const timeframeSchema = z.object({
  value: z.number().int().positive(),
  unit: timeframeUnitSchema
});

export const zoneSchema = z
  .object({
    low: z.number().positive(),
    high: z.number().positive()
  })
  .refine((z0) => z0.low <= z0.high, { message: "low must be <= high" });

export const takeProfitZoneSchema = z.object({
  id: z.string().min(1),
  low: z.number().positive(),
  high: z.number().positive()
}).refine((z0) => z0.low <= z0.high, { message: "TP low must be <= high" });

export const tradingSignalCoreSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1).max(32),
  direction: directionSchema,
  timeframe: timeframeSchema,
  entry_zone: zoneSchema,
  stop_loss: z.object({ price: z.number().positive() }),
  take_profit_zones: z.array(takeProfitZoneSchema).min(1)
});

export const extractionMetaSchema = z.object({
  method: z.enum(["deterministic", "ai"]),
  parser_version: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  prompt_version: z.string().optional(),
  guideline_version: z.string().optional()
});

export const canonicalTradingSignalSchema = z.object({
  schema_version: z.string(),
  signal: tradingSignalCoreSchema,
  source: z.object({
    channel: z.enum(["telegram", "operator_web"]),
    chat_id: z.string().optional(),
    message_id: z.string().optional(),
    raw_prompt: z.string(),
    source_image_asset_id: z.string().optional()
  }),
  render: z.object({
    template_id: z.string(),
    template_version: z.string(),
    renderer_version: z.string(),
    output_format: z.literal("png"),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  workflow: z.object({
    status: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    approved_at: z.string().optional(),
    approved_by: z.string().optional()
  }),
  extraction: extractionMetaSchema,
  derived: z
    .object({
      entry_midpoint: z.number(),
      risk_distance: z.number(),
      risk_distance_pct: z.number(),
      take_profit_midpoints: z.array(z.number()),
      take_profit_distances: z.array(z.number()),
      risk_rewards: z.array(z.number())
    })
    .optional()
});

export const aiExtractedCoreSchema = z.object({
  status: z.enum(["ok", "NEEDS_CLARIFICATION"]),
  missing: z.array(z.string()).nullish(),
  message: z.string().nullish(),
  symbol: z.string().nullish(),
  direction: directionSchema.nullish(),
  timeframe: timeframeSchema.nullish(),
  entry_zone: zoneSchema.nullish(),
  stop_loss: z.object({ price: z.number().positive() }).nullish(),
  take_profit_zones: z.array(takeProfitZoneSchema).nullish()
});

export type AiExtractedCore = z.infer<typeof aiExtractedCoreSchema>;
