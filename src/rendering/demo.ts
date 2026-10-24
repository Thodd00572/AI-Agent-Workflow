import { attachDerived } from "../domain/derived.ts";
import {
  RENDERER_VERSION,
  SCHEMA_VERSION,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  type CanonicalTradingSignal
} from "../domain/types.ts";
import { CARD_FORMATS, type CardFormat } from "./tokens.ts";

export function demoSignal(input: {
  direction?: string;
  symbol?: string;
  timeframe?: string;
  entryLow?: number;
  entryHigh?: number;
  stop?: number;
  tp1Low?: number;
  tp1High?: number;
  tp2Low?: number;
  tp2High?: number;
  format?: CardFormat;
}): CanonicalTradingSignal {
  const format = input.format && input.format in CARD_FORMATS ? input.format : "telegram";
  const size = CARD_FORMATS[format];
  const tf = parseTimeframe(input.timeframe ?? "30 MINUTES");
  return attachDerived({
    schema_version: SCHEMA_VERSION,
    signal: {
      id: "PREVIEW",
      symbol: (input.symbol ?? "XAUUSD").toUpperCase(),
      direction: input.direction === "LONG" ? "LONG" : "SHORT",
      timeframe: tf,
      entry_zone: { low: input.entryLow ?? 4116, high: input.entryHigh ?? 4129 },
      stop_loss: { price: input.stop ?? 4135 },
      take_profit_zones: [
        { id: "TP1", low: input.tp1Low ?? 4092, high: input.tp1High ?? 4104 },
        { id: "TP2", low: input.tp2Low ?? 4016, high: input.tp2High ?? 4020 }
      ]
    },
    source: { channel: "operator_web", raw_prompt: "preview" },
    render: {
      template_id: TEMPLATE_ID,
      template_version: TEMPLATE_VERSION,
      renderer_version: RENDERER_VERSION,
      output_format: "png",
      width: size.width,
      height: size.height
    },
    workflow: {
      status: "AWAITING_APPROVAL",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    extraction: { method: "deterministic", parser_version: "preview" }
  });
}

function parseTimeframe(raw: string): { value: number; unit: "MINUTES" | "HOURS" | "DAYS" } {
  const m = raw.trim().toUpperCase().match(/(\d+)\s*(MINUTE|MINUTES|HOUR|HOURS|DAY|DAYS|M|H|D)/);
  if (!m) return { value: 30, unit: "MINUTES" };
  const value = Number(m[1]);
  const u = m[2];
  if (u.startsWith("H")) return { value, unit: "HOURS" };
  if (u.startsWith("D") && u !== "M") return { value, unit: "DAYS" };
  return { value, unit: "MINUTES" };
}

