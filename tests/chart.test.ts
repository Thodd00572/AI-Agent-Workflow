import { describe, expect, it } from "vitest";
import { niceBounds, renderSetupChart } from "../src/rendering/chart.ts";

describe("setup chart", () => {
  it("places SL, entry, and TP labels from the signal figures", () => {
    const svg = renderSetupChart({
      direction: "SHORT",
      stop: 4135,
      entryLow: 4116,
      entryHigh: 4129,
      takeProfits: [
        { id: "TP1", low: 4092, high: 4104 },
        { id: "TP2", low: 4016, high: 4020 }
      ]
    });
    expect(svg).toContain("ENTRY ZONE");
    expect(svg).toContain("TAKE PROFIT ZONE 1");
    expect(svg).toContain("SL");
    expect(svg).toContain("4,135");
  });

  it("plots supplied live candles on an FX-sized axis", () => {
    const svg = renderSetupChart({
      direction: "LONG",
      stop: 1.15,
      entryLow: 1.16,
      entryHigh: 1.162,
      takeProfits: [{ id: "TP1", low: 1.17, high: 1.172 }],
      candles: [
        { open: 1.1601, high: 1.161, low: 1.159, close: 1.1608, time: Date.UTC(2026, 8, 8, 10) },
        { open: 1.1608, high: 1.162, low: 1.1605, close: 1.1615, time: Date.UTC(2026, 8, 8, 10, 30) }
      ]
    });
    expect(svg).toContain("1.16");
    expect(svg).not.toContain("10.00");
    expect(svg.match(/<rect /g)?.length).toBeGreaterThan(3);
  });
});

describe("price scale", () => {
  it("keeps FX-sized prices on a tight axis", () => {
    const bounds = niceBounds(1.15, 1.172);
    expect(bounds.hi - bounds.lo).toBeLessThan(0.1);
  });
});
