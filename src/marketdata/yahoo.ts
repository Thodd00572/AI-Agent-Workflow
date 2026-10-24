import type { CandleRequest, MarketCandle, MarketSeries } from "./types.ts";
import { lastN } from "./cache.ts";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string; regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> };
    }>;
    error?: { description?: string };
  };
}

export async function fetchYahooSeries(req: CandleRequest, timeoutMs: number): Promise<MarketSeries> {
  let lastError = "Yahoo chart lookup failed";
  for (const symbol of req.yahooSymbols) {
    try {
      const series = await fetchYahooSymbol(symbol, req, timeoutMs);
      if (series.candles.length >= 8) return series;
      lastError = `${symbol} returned too few bars`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}

async function fetchYahooSymbol(symbol: string, req: CandleRequest, timeoutMs: number): Promise<MarketSeries> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(req.yahooInterval)}&range=${encodeURIComponent(req.yahooRange)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; StrikeSignals/1.0)"
    }
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
  const body = (await res.json()) as YahooChartResponse;
  const row = body.chart?.result?.[0];
  const quote = row?.indicators?.quote?.[0];
  const stamps = row?.timestamp ?? [];
  if (!row || !quote || stamps.length === 0) {
    throw new Error(body.chart?.error?.description ?? `Yahoo ${symbol} returned no bars`);
  }
  const candles: MarketCandle[] = [];
  for (let i = 0; i < stamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (![open, high, low, close].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    candles.push({ time: stamps[i] * 1000, open: open as number, high: high as number, low: low as number, close: close as number });
  }
  const trimmed = lastN(candles, req.count);
  const last = trimmed.at(-1)?.close ?? row.meta?.regularMarketPrice;
  if (!last || trimmed.length === 0) throw new Error(`Yahoo ${symbol} produced no usable candles`);
  return {
    symbol: req.symbol,
    mappedSymbol: row.meta?.symbol ?? symbol,
    provider: "yahoo",
    interval: req.interval,
    last,
    candles: trimmed
  };
}
