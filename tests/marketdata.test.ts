import { describe, expect, it } from "vitest";
import { fetchMarketCandles } from "../src/marketdata/index.ts";
import { resolveCandleRequest } from "../src/marketdata/symbols.ts";

describe("market symbol map", () => {
  it("maps Strike tickers onto Yahoo and Twelve Data symbols", () => {
    const gold = resolveCandleRequest("XAUUSD", "30 MINUTES");
    expect(gold.yahooSymbols).toContain("GC=F");
    expect(gold.twelveSymbol).toBe("XAU/USD");
    expect(gold.yahooInterval).toBe("30m");
    const yen = resolveCandleRequest("USDJPY", { value: 1, unit: "HOURS" });
    expect(yen.yahooSymbols[0]).toBe("USDJPY=X");
    expect(yen.twelveSymbol).toBe("USD/JPY");
  });
});

describe("live market candles", () => {
  it("loads Yahoo gold 30m bars for XAUUSD", async () => {
    const series = await fetchMarketCandles("XAUUSD", "30 MINUTES", { provider: "yahoo", timeoutMs: 15000 });
    expect(series.provider).toBe("yahoo");
    expect(series.mappedSymbol).toBe("GC=F");
    expect(series.candles.length).toBeGreaterThan(20);
    expect(series.last).toBeGreaterThan(1000);
    const last = series.candles.at(-1);
    expect(last?.close).toBeGreaterThan(0);
    expect(last?.high).toBeGreaterThanOrEqual(last?.low ?? 0);
  }, 20000);
});

describe("live market candles", () => {
  it("loads Yahoo gold 30m bars for XAUUSD", async () => {
    const series = await fetchMarketCandles("XAUUSD", "30 MINUTES", { provider: "yahoo", timeoutMs: 15000 });
    expect(series.provider).toBe("yahoo");
    expect(series.mappedSymbol).toBe("GC=F");
    expect(series.candles.length).toBeGreaterThan(20);
    expect(series.last).toBeGreaterThan(1000);
    const last = series.candles.at(-1);
    expect(last?.close).toBeGreaterThan(0);
    expect(last?.high).toBeGreaterThanOrEqual(last?.low ?? 0);
  }, 20000);
});
