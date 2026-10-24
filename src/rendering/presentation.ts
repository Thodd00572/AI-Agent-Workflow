import type { CanonicalTradingSignal, DerivedMetrics } from "../domain/types.ts";
import type { MarketSeries } from "../marketdata/types.ts";

export interface PresentationModel {
  template_id: string;
  template_version: string;
  signal_id: string;
  symbol: string;
  direction: string;
  direction_label: string;
  timeframe: string;
  entry: string;
  stop_loss: string;
  take_profits: { id: string; range: string; rr: string }[];
  chart: {
    direction: "LONG" | "SHORT";
    stop: number;
    entryLow: number;
    entryHigh: number;
    takeProfits: { id: string; low: number; high: number }[];
    candles?: { open: number; high: number; low: number; close: number; time?: number }[];
  };
  derived: {
    entry_mid: string;
    risk: string;
    risk_pct: string;
  };
  extraction: string;
  theme: "short" | "long";
}

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function formatRange(low: number, high: number): string {
  return `${formatPrice(low)} – ${formatPrice(high)}`;
}

export function formatTimeframe(value: number, unit: string): string {
  const label = unit === "MINUTES" ? (value === 1 ? "MINUTE" : "MINUTES") : unit;
  return `${value} ${label}`;
}

export function toPresentation(doc: CanonicalTradingSignal, market?: MarketSeries): PresentationModel {
  const d: DerivedMetrics | undefined = doc.derived;
  return {
    template_id: doc.render.template_id,
    template_version: doc.render.template_version,
    signal_id: doc.signal.id,
    symbol: doc.signal.symbol,
    direction: doc.signal.direction,
    direction_label: doc.signal.direction === "SHORT" ? "SHORT SETUP" : "LONG SETUP",
    timeframe: formatTimeframe(doc.signal.timeframe.value, doc.signal.timeframe.unit),
    entry: formatRange(doc.signal.entry_zone.low, doc.signal.entry_zone.high),
    stop_loss: formatPrice(doc.signal.stop_loss.price),
    take_profits: doc.signal.take_profit_zones.map((z, i) => ({
      id: z.id,
      range: formatRange(z.low, z.high),
      rr: d?.risk_rewards[i] !== undefined ? `${d.risk_rewards[i].toFixed(2)}R` : ""
    })),
    chart: {
      direction: doc.signal.direction,
      stop: doc.signal.stop_loss.price,
      entryLow: doc.signal.entry_zone.low,
      entryHigh: doc.signal.entry_zone.high,
      takeProfits: doc.signal.take_profit_zones.map((z) => ({ id: z.id, low: z.low, high: z.high })),
      candles: market?.candles
    },
    derived: {
      entry_mid: d ? formatPrice(d.entry_midpoint) : "",
      risk: d ? formatPrice(d.risk_distance) : "",
      risk_pct: d ? `${d.risk_distance_pct.toFixed(2)}%` : ""
    },
    extraction: doc.extraction.method === "deterministic" ? `parser ${doc.extraction.parser_version}` : `ai ${doc.extraction.model}`,
    theme: doc.signal.direction === "SHORT" ? "short" : "long"
  };
}
