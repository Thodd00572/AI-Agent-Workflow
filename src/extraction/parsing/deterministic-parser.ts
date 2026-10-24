import { z } from "zod";
import { PARSER_VERSION } from "../../domain/types.ts";
import type { Extractor, ExtractionInput, ExtractionOutcome, TimeframeUnit } from "../../domain/types.ts";

const SYMBOL_ALIASES: Record<string, string> = {
  GOLD: "XAUUSD",
  XAU: "XAUUSD",
  XAUUSD: "XAUUSD",
  BTC: "BTCUSD",
  BTCUSD: "BTCUSD",
  ETH: "ETHUSD",
  ETHUSD: "ETHUSD"
};

export function looksLikeKnownGrammar(text: string): boolean {
  const t = normalize(text);
  const hasDir = /^(long|short)\b/.test(t);
  const hasEntry = /\bentry\b/.test(t);
  const hasSl = /\b(sl|stop(?:\s*loss)?)\b/.test(t);
  const hasTp = /\btp\s*\d+\b/.test(t);
  return hasDir && hasEntry && hasSl && hasTp;
}

export class DeterministicParser implements Extractor {
  readonly version = PARSER_VERSION;

  async extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    return this.parse(input.text);
  }

  parse(text: string): ExtractionOutcome {
    const missing: string[] = [];
    const t = normalize(text);

    const dirMatch = t.match(/\b(long|short)\b/);
    if (!dirMatch) missing.push("direction");
    const direction = dirMatch ? (dirMatch[1].toUpperCase() as "LONG" | "SHORT") : undefined;

    const symbol = extractSymbol(t);
    if (!symbol) missing.push("symbol");

    const timeframe = extractTimeframe(t);
    if (!timeframe) missing.push("timeframe");

    const entry = extractZone(t, /\bentry(?:\s*zone)?\s*:?\s*([0-9][0-9.,\s]*)\s*[-–—to]+\s*([0-9][0-9.,]*)/i);
    if (!entry) missing.push("entry_zone");

    const sl = extractNumber(t, /\b(?:sl|stop(?:\s*loss)?)\s*:?\s*([0-9][0-9.,]*)/i);
    if (sl === undefined) missing.push("stop_loss");

    const tps = extractTakeProfits(t);
    if (tps.length === 0) missing.push("take_profit_zones");

    if (missing.length > 0 || !direction || !symbol || !timeframe || !entry || sl === undefined) {
      return {
        ok: false,
        code: "NEEDS_CLARIFICATION",
        method: "deterministic",
        message: `Deterministic parser could not resolve: ${missing.join(", ") || "unknown token"}`,
        missing
      };
    }

    return {
      ok: true,
      method: "deterministic",
      parser_version: PARSER_VERSION,
      core: {
        symbol,
        direction,
        timeframe,
        entry_zone: entry,
        stop_loss: { price: sl },
        take_profit_zones: tps
      }
    };
  }
}

function normalize(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim().toLowerCase();
}

function parseNum(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function extractSymbol(t: string): string | undefined {
  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean);
  for (const tok of tokens) {
    const upper = tok.toUpperCase();
    if (SYMBOL_ALIASES[upper]) return SYMBOL_ALIASES[upper];
    if (/^[A-Z]{3,10}$/.test(upper) && !["LONG", "SHORT", "ENTRY", "ZONE", "MINUTES", "HOURS", "DAYS", "STOP", "LOSS"].includes(upper)) {
      if (/usd$/.test(tok) || tok.length >= 6) return upper;
    }
  }
  const pair = t.match(/\b([a-z]{3,6}usd)\b/);
  if (pair) return pair[1].toUpperCase();
  return undefined;
}

function extractTimeframe(t: string): { value: number; unit: TimeframeUnit } | undefined {
  const m =
    t.match(/\b(\d+)\s*(minutes?|mins?|m)\b/) ||
    t.match(/\b(\d+)\s*(hours?|hrs?|h)\b/) ||
    t.match(/\b(\d+)\s*(days?|d)\b/);
  if (!m) return undefined;
  const value = Number(m[1]);
  const u = m[2];
  let unit: TimeframeUnit = "MINUTES";
  if (u.startsWith("h")) unit = "HOURS";
  else if (u.startsWith("d") && u !== "m") unit = "DAYS";
  if (u === "m" || u.startsWith("min")) unit = "MINUTES";
  if (u === "d" || u.startsWith("day")) unit = "DAYS";
  return { value, unit };
}

function extractZone(t: string, re: RegExp): { low: number; high: number } | undefined {
  const m = t.match(re);
  if (!m) return undefined;
  const a = parseNum(m[1]);
  const b = parseNum(m[2]);
  if (a === undefined || b === undefined) return undefined;
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

function extractNumber(t: string, re: RegExp): number | undefined {
  const m = t.match(re);
  if (!m) return undefined;
  return parseNum(m[1]);
}

function extractTakeProfits(t: string): { id: string; low: number; high: number }[] {
  const zones: { id: string; low: number; high: number }[] = [];
  const re = /\btp\s*(\d+)\s*:?\s*([0-9][0-9.,\s]*)\s*[-–—to]+\s*([0-9][0-9.,]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const a = parseNum(m[2]);
    const b = parseNum(m[3]);
    if (a === undefined || b === undefined) continue;
    zones.push({
      id: `TP${m[1]}`,
      low: Math.min(a, b),
      high: Math.max(a, b)
    });
  }
  zones.sort((x, y) => Number(x.id.slice(2)) - Number(y.id.slice(2)));
  return zones;
}

export const editInstructionSchema = z.object({
  field: z.enum(["stop_loss", "entry_zone", "symbol", "direction", "timeframe", "take_profit"]),
  tpId: z.string().optional(),
  price: z.number().optional(),
  low: z.number().optional(),
  high: z.number().optional(),
  symbol: z.string().optional(),
  direction: z.enum(["LONG", "SHORT"]).optional(),
  timeframeValue: z.number().optional(),
  timeframeUnit: z.enum(["MINUTES", "HOURS", "DAYS"]).optional()
});

export function parseEditInstruction(text: string): { ok: true; patch: z.infer<typeof editInstructionSchema> } | { ok: false } {
  const t = normalize(text);
  const sl = t.match(/(?:change\s+)?(?:sl|stop(?:\s*loss)?)\s+(?:to\s+)?([0-9][0-9.,]*)/);
  if (sl) {
    const price = parseNum(sl[1]);
    if (price !== undefined) return { ok: true, patch: { field: "stop_loss", price } };
  }
  const tp = t.match(/(?:change\s+)?tp\s*(\d+)\s+(?:to\s+)?([0-9][0-9.,]*)\s*[-–—to]+\s*([0-9][0-9.,]*)/);
  if (tp) {
    const a = parseNum(tp[2]);
    const b = parseNum(tp[3]);
    if (a !== undefined && b !== undefined) {
      return {
        ok: true,
        patch: { field: "take_profit", tpId: `TP${tp[1]}`, low: Math.min(a, b), high: Math.max(a, b) }
      };
    }
  }
  const entry = t.match(/(?:change\s+)?entry(?:\s*zone)?\s+(?:to\s+)?([0-9][0-9.,]*)\s*[-–—to]+\s*([0-9][0-9.,]*)/);
  if (entry) {
    const a = parseNum(entry[1]);
    const b = parseNum(entry[2]);
    if (a !== undefined && b !== undefined) {
      return { ok: true, patch: { field: "entry_zone", low: Math.min(a, b), high: Math.max(a, b) } };
    }
  }
  return { ok: false };
}
