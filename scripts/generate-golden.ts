import { mkdirSync, writeFileSync } from "node:fs";
import { attachDerived } from "../src/domain/derived.ts";
import {
  RENDERER_VERSION,
  SCHEMA_VERSION,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  type CanonicalTradingSignal
} from "../src/domain/types.ts";
import { renderSignalPng } from "../src/rendering/index.ts";

const doc: CanonicalTradingSignal = attachDerived({
  schema_version: SCHEMA_VERSION,
  signal: {
    id: "SIG-GOLDEN-0001",
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
  source: { channel: "operator_web", raw_prompt: "golden" },
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

mkdirSync("tests/golden", { recursive: true });
const result = await renderSignalPng(doc, "tests/golden");
writeFileSync("tests/golden/card.html", result.html);
console.log("wrote", result.pngPath, result.sha256);
