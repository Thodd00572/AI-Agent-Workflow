import type { CanonicalTradingSignal, DerivedMetrics, Direction, TradingSignalCore } from "./types.ts";

export function computeDerived(signal: TradingSignalCore): DerivedMetrics {
  const entryMid = (signal.entry_zone.low + signal.entry_zone.high) / 2;
  const riskDistance = Math.abs(signal.stop_loss.price - entryMid);
  const riskDistancePct = entryMid === 0 ? 0 : (riskDistance / entryMid) * 100;
  const takeProfitMidpoints = signal.take_profit_zones.map((z) => (z.low + z.high) / 2);
  const takeProfitDistances = takeProfitMidpoints.map((mid) => Math.abs(mid - entryMid));
  const riskRewards = takeProfitDistances.map((d) => (riskDistance === 0 ? 0 : d / riskDistance));
  return {
    entry_midpoint: round4(entryMid),
    risk_distance: round4(riskDistance),
    risk_distance_pct: round4(riskDistancePct),
    take_profit_midpoints: takeProfitMidpoints.map(round4),
    take_profit_distances: takeProfitDistances.map(round4),
    risk_rewards: riskRewards.map(round4)
  };
}

export function attachDerived(doc: CanonicalTradingSignal): CanonicalTradingSignal {
  return { ...doc, derived: computeDerived(doc.signal) };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function riskAnchor(direction: Direction, entryLow: number, entryHigh: number): number {
  return direction === "SHORT" ? entryHigh : entryLow;
}
