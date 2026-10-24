import { cached } from "./cache.ts";
import { resolveCandleRequest } from "./symbols.ts";
import { fetchTwelveSeries } from "./twelvedata.ts";
import type { MarketDataOptions, MarketSeries } from "./types.ts";
import { fetchYahooSeries } from "./yahoo.ts";
import type { Timeframe } from "../domain/types.ts";

export function marketDataOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): MarketDataOptions {
  const provider = env.MARKET_DATA_PROVIDER;
  return {
    provider: provider === "yahoo" || provider === "twelvedata" ? provider : "auto",
    twelveDataApiKey: env.TWELVEDATA_API_KEY || undefined,
    timeoutMs: Number(env.MARKET_DATA_TIMEOUT_MS ?? 8000)
  };
}

export async function fetchMarketCandles(
  symbol: string,
  timeframe: string | Timeframe,
  options: MarketDataOptions = marketDataOptionsFromEnv()
): Promise<MarketSeries> {
  const req = resolveCandleRequest(symbol, timeframe);
  const timeoutMs = options.timeoutMs ?? 8000;
  const key = `${options.provider}:${req.symbol}:${req.yahooInterval}:${req.count}`;
  return cached(key, 60_000, async () => {
    const errors: string[] = [];
    const tryTwelve = options.provider !== "yahoo" && Boolean(options.twelveDataApiKey);
    const tryYahoo = options.provider !== "twelvedata";
    if (tryTwelve) {
      try {
        return await fetchTwelveSeries(req, options.twelveDataApiKey as string, timeoutMs);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        if (options.provider === "twelvedata") throw err;
      }
    }
    if (tryYahoo) {
      try {
        return await fetchYahooSeries(req, timeoutMs);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    throw new Error(errors.join(" · ") || "No market data provider configured");
  });
}

export { resolveCandleRequest, parseTimeframe, normalizeSymbol } from "./symbols.ts";
export type { MarketCandle, MarketSeries } from "./types.ts";
