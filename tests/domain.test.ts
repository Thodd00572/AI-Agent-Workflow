import { describe, expect, it } from "vitest";
import { computeDerived } from "../src/domain/derived.ts";
import { canTransition, transition } from "../src/domain/state-machine.ts";
import { validateTradingSignal } from "../src/domain/validation.ts";
import type { TradingSignalCore } from "../src/domain/types.ts";

const validShort: TradingSignalCore = {
  id: "SIG-20260902-0001",
  symbol: "XAUUSD",
  direction: "SHORT",
  timeframe: { value: 30, unit: "MINUTES" },
  entry_zone: { low: 4116, high: 4129 },
  stop_loss: { price: 4135 },
  take_profit_zones: [
    { id: "TP1", low: 4092, high: 4104 },
    { id: "TP2", low: 4016, high: 4020 }
  ]
};

describe("validation", () => {
  it("accepts a valid SHORT", () => {
    expect(validateTradingSignal(validShort).ok).toBe(true);
  });

  it("rejects SHORT with SL below entry and does not correct it", () => {
    const result = validateTradingSignal({ ...validShort, stop_loss: { price: 4100 } });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "DIRECTIONAL_SL")).toBe(true);
  });

  it("rejects missing TP", () => {
    const result = validateTradingSignal({ ...validShort, take_profit_zones: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects reversed entry range via schema", () => {
    const result = validateTradingSignal({
      ...validShort,
      entry_zone: { low: 4129, high: 4116 }
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid TP ordering", () => {
    const result = validateTradingSignal({
      ...validShort,
      take_profit_zones: [
        { id: "TP1", low: 4016, high: 4020 },
        { id: "TP2", low: 4092, high: 4104 }
      ]
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "TP_ORDER")).toBe(true);
  });
});

describe("derived calculations", () => {
  it("computes midpoint, risk, and R multiples in application code", () => {
    const d = computeDerived(validShort);
    expect(d.entry_midpoint).toBe(4122.5);
    expect(d.risk_distance).toBe(12.5);
    expect(d.risk_rewards[0]).toBeGreaterThan(0);
  });
});

describe("state machine", () => {
  it("allows confirm from approval and forbids publish from idle", () => {
    expect(canTransition("AWAITING_APPROVAL", "PUBLISHING")).toBe(true);
    expect(() => transition("IDLE", "PUBLISHED")).toThrow();
  });
});
