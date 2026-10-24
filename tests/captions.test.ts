import { describe, expect, it } from "vitest";
import { attachDerived } from "../src/domain/derived.ts";
import { buildTelegramCopy } from "../src/content/captions.ts";
import {
  RENDERER_VERSION,
  SCHEMA_VERSION,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  type CanonicalTradingSignal
} from "../src/domain/types.ts";

const doc: CanonicalTradingSignal = attachDerived({
  schema_version: SCHEMA_VERSION,
  signal: {
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
  },
  source: { channel: "operator_web", raw_prompt: "test" },
  render: {
    template_id: TEMPLATE_ID,
    template_version: TEMPLATE_VERSION,
    renderer_version: RENDERER_VERSION,
    output_format: "png",
    width: 1920,
    height: 1080
  },
  workflow: {
    status: "AWAITING_APPROVAL",
    created_at: "2026-09-02T00:00:00.000Z",
    updated_at: "2026-09-02T00:00:00.000Z"
  },
  extraction: { method: "deterministic", parser_version: "shorthand-grammar-v1" }
});

describe("telegram copy", () => {
  it("puts setup facts above the image and CTA below", () => {
    const copy = buildTelegramCopy(doc);
    expect(copy.header).toContain("TRIGGER TRADES");
    expect(copy.header).toContain("XAUUSD");
    expect(copy.header).toContain("30 Minutes");
    expect(copy.header).toContain("SHORT");
    expect(copy.header).toContain("4,116");
    expect(copy.header).toContain("4,135.00");
    expect(copy.text).toContain("Execution Note");
    expect(copy.text).toContain("https://triggertrades.com");
  });
});
