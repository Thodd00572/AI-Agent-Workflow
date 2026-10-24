import { describe, expect, it } from "vitest";
import { DeterministicParser, looksLikeKnownGrammar, parseEditInstruction } from "../src/extraction/parsing/deterministic-parser.ts";
import { chooseExtractor } from "../src/extraction/router.ts";

const SAMPLE = `SHORT XAUUSD 30m
Entry: 4116-4129
SL: 4135
TP1: 4092-4104
TP2: 4016-4020`;

describe("deterministic parser", () => {
  const parser = new DeterministicParser();

  it("parses canonical shorthand without a network call", async () => {
    const result = await parser.extract({ text: SAMPLE, hasImage: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.method).toBe("deterministic");
    expect(result.core.symbol).toBe("XAUUSD");
    expect(result.core.direction).toBe("SHORT");
    expect(result.core.timeframe).toEqual({ value: 30, unit: "MINUTES" });
    expect(result.core.entry_zone).toEqual({ low: 4116, high: 4129 });
    expect(result.core.stop_loss.price).toBe(4135);
    expect(result.core.take_profit_zones).toHaveLength(2);
  });

  it("parses a single-line variant", async () => {
    const result = await parser.extract({
      text: "SHORT XAUUSD 30m Entry 4116-4129 SL 4135 TP1 4092-4104 TP2 4016-4020",
      hasImage: false
    });
    expect(result.ok).toBe(true);
  });

  it("maps gold alias", async () => {
    const result = await parser.extract({
      text: "short gold 30 minutes Entry 4116-4129 SL 4135 TP1 4092-4104 TP2 4016-4020",
      hasImage: false
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.core.symbol).toBe("XAUUSD");
  });

  it("returns NEEDS_CLARIFICATION instead of guessing", async () => {
    const result = await parser.extract({ text: "SHORT XAUUSD 30m", hasImage: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NEEDS_CLARIFICATION");
  });
});

describe("extraction router", () => {
  it("routes known grammar with no image to deterministic", () => {
    expect(chooseExtractor({ text: SAMPLE, hasImage: false })).toBe("deterministic");
  });

  it("routes freeform prose to AI", () => {
    expect(chooseExtractor({ text: "please short gold around the supply zone", hasImage: false })).toBe("ai");
  });

  it("routes known grammar with an image to AI", () => {
    expect(chooseExtractor({ text: SAMPLE, hasImage: true })).toBe("ai");
  });
});

describe("edit instructions", () => {
  it("parses change SL", () => {
    const parsed = parseEditInstruction("Change SL to 4137");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.patch.price).toBe(4137);
  });
});
