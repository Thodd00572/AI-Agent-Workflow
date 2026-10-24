import type { CandleRequest, MarketCandle, MarketSeries } from "./types.ts";
import { lastN } from "./cache.ts";

interface TwelveResponse {
  status?: string;
  message?: string;
  meta?: { symbol?: string };
  values?: Array<{ datetime?: string; open?: string; high?: string; low?: string; close?: string }>;
}

export async function fetchTwelveSeries(req: CandleRequest, apiKey: string, timeoutMs: number): Promise<MarketSeries> {
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", req.twelveSymbol);
  url.searchParams.set("interval", req.twelveInterval);
  url.searchParams.set("outputsize", String(req.count));
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("timezone", "UTC");
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  const body = (await res.json()) as TwelveResponse;
  if (body.status === "error" || !body.values?.length) {
    throw new Error(body.message ?? `Twelve Data returned no bars for ${req.twelveSymbol}`);
  }
  const candles: MarketCandle[] = body.values
    .map((row) => {
      const open = Number(row.open);
      const high = Number(row.high);
      const low = Number(row.low);
      const close = Number(row.close);
      const time = parseTwelveTime(row.datetime);
      if (![open, high, low, close, time].every(Number.isFinite)) return undefined;
      return { time, open, high, low, close };
    })
    .filter((row): row is MarketCandle => Boolean(row))
    .sort((a, b) => a.time - b.time);
  const trimmed = lastN(candles, req.count);
  const last = trimmed.at(-1)?.close;
  if (!last) throw new Error(`Twelve Data produced no usable candles for ${req.twelveSymbol}`);
  return {
    symbol: req.symbol,
    mappedSymbol: body.meta?.symbol ?? req.twelveSymbol,
    provider: "twelvedata",
    interval: req.interval,
    last,
    candles: trimmed
  };
}

function parseTwelveTime(raw?: string): number {
  if (!raw) return NaN;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) return Date.parse(raw);
  return Date.parse(raw.replace(" ", "T") + "Z");
}
