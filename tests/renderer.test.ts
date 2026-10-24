import { describe, expect, it } from "vitest";
import { attachDerived } from "../src/domain/derived.ts";
import {
  RENDERER_VERSION,
  SCHEMA_VERSION,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  type CanonicalTradingSignal
} from "../src/domain/types.ts";
import { renderCardHtml, toPresentation } from "../src/rendering/index.ts";

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

describe("HTML renderer", () => {
  it("renders expected facts into the immutable template", () => {
    const html = renderCardHtml(toPresentation(doc));
    expect(html).toContain("XAUUSD");
    expect(html).toContain("SHORT");
    expect(html).toContain("30 MINUTES");
    expect(html).toContain("4,135");
    expect(html).toContain("ENTRY ZONE");
    expect(html).toContain("TAKE PROFIT");
    expect(html).toContain("<svg");
    expect(html).toContain("1920px");
    expect(html).toContain("1080px");
    expect(html).toContain("#39FF14");
    expect(html).toContain("#DC143C");
    expect(html).toContain("#0B0E14");
    expect(html).toContain("#05070A");
    expect(html).toContain("#0F141D");
    expect(html).toContain("#9AA0A6");
  });

  it("locks X and TikTok canvas sizes", () => {
    const model = toPresentation(doc);
    const x = renderCardHtml(model, "x");
    const tiktok = renderCardHtml(model, "tiktok");
    expect(x).toContain("1200px");
    expect(x).toContain("1600px");
    expect(tiktok).toContain("1080px");
    expect(tiktok).toContain("1920px");
    expect(x).toContain("#39FF14");
    expect(tiktok).toContain("#39FF14");
  });
});
