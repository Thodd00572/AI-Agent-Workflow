import { canonicalTradingSignalSchema, tradingSignalCoreSchema } from "../schemas/trading-signal.ts";
import type { Direction, TradingSignalCore } from "./types.ts";

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface DirectionalRules {
  requireStopBeyondEntry: boolean;
  requireTpBeyondEntry: boolean;
  requireMonotonicTps: boolean;
}

export const defaultDirectionalRules: DirectionalRules = {
  requireStopBeyondEntry: true,
  requireTpBeyondEntry: true,
  requireMonotonicTps: true
};

export function validateSchema(core: unknown): ValidationResult {
  const parsed = tradingSignalCoreSchema.safeParse(core);
  if (parsed.success) return { ok: true, issues: [] };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({
      code: "SCHEMA",
      message: i.message,
      path: i.path.join(".")
    }))
  };
}

export function validateCanonicalDocument(doc: unknown): ValidationResult {
  const parsed = canonicalTradingSignalSchema.safeParse(doc);
  if (parsed.success) return { ok: true, issues: [] };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({
      code: "SCHEMA",
      message: i.message,
      path: i.path.join(".")
    }))
  };
}

export function validateDirectional(
  signal: TradingSignalCore,
  rules: DirectionalRules = defaultDirectionalRules
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { direction, entry_zone: entry, stop_loss: sl, take_profit_zones: tps } = signal;

  if (rules.requireStopBeyondEntry) {
    if (direction === "SHORT" && !(sl.price > entry.high)) {
      issues.push({
        code: "DIRECTIONAL_SL",
        message: "SHORT requires stop loss above entry.high. Values were not auto-corrected.",
        path: "stop_loss.price"
      });
    }
    if (direction === "LONG" && !(sl.price < entry.low)) {
      issues.push({
        code: "DIRECTIONAL_SL",
        message: "LONG requires stop loss below entry.low. Values were not auto-corrected.",
        path: "stop_loss.price"
      });
    }
  }

  if (tps.length === 0) {
    issues.push({ code: "MISSING_TP", message: "At least one take-profit zone is required." });
  }

  if (rules.requireTpBeyondEntry) {
    for (const [i, tp] of tps.entries()) {
      if (direction === "SHORT" && !(tp.high < entry.low)) {
        issues.push({
          code: "DIRECTIONAL_TP",
          message: `${tp.id} high must be below entry.low for SHORT.`,
          path: `take_profit_zones.${i}`
        });
      }
      if (direction === "LONG" && !(tp.low > entry.high)) {
        issues.push({
          code: "DIRECTIONAL_TP",
          message: `${tp.id} low must be above entry.high for LONG.`,
          path: `take_profit_zones.${i}`
        });
      }
    }
  }

  if (rules.requireMonotonicTps) {
    for (let i = 1; i < tps.length; i++) {
      const prev = tps[i - 1];
      const cur = tps[i];
      if (direction === "SHORT" && !(cur.high < prev.low)) {
        issues.push({
          code: "TP_ORDER",
          message: `${cur.id} must sit fully beyond ${prev.id} for SHORT (high < previous low).`,
          path: `take_profit_zones.${i}`
        });
      }
      if (direction === "LONG" && !(cur.low > prev.high)) {
        issues.push({
          code: "TP_ORDER",
          message: `${cur.id} must sit fully beyond ${prev.id} for LONG (low > previous high).`,
          path: `take_profit_zones.${i}`
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validateTradingSignal(
  signal: TradingSignalCore,
  rules: DirectionalRules = defaultDirectionalRules
): ValidationResult {
  const schema = validateSchema(signal);
  if (!schema.ok) return schema;
  return validateDirectional(signal, rules);
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((i) => `${i.code}: ${i.message}`).join("\n");
}

export function expectedSide(direction: Direction): "bearish" | "bullish" {
  return direction === "SHORT" ? "bearish" : "bullish";
}
