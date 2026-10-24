import type { Timeframe } from "../domain/types.ts";
import type { CandleRequest } from "./types.ts";

const ALIASES: Record<string, { yahoo: string[]; twelve: string }> = {
  XAUUSD: { yahoo: ["GC=F"], twelve: "XAU/USD" },
  GOLD: { yahoo: ["GC=F"], twelve: "XAU/USD" },
  XAU: { yahoo: ["GC=F"], twelve: "XAU/USD" },
  USDJPY: { yahoo: ["USDJPY=X"], twelve: "USD/JPY" },
  EURUSD: { yahoo: ["EURUSD=X"], twelve: "EUR/USD" },
  GBPUSD: { yahoo: ["GBPUSD=X"], twelve: "GBP/USD" },
  USOIL: { yahoo: ["CL=F"], twelve: "WTI/USD" },
  WTI: { yahoo: ["CL=F"], twelve: "WTI/USD" },
  CL: { yahoo: ["CL=F"], twelve: "WTI/USD" },
  BTCUSD: { yahoo: ["BTC-USD"], twelve: "BTC/USD" },
  BTCUSDT: { yahoo: ["BTC-USD"], twelve: "BTC/USD" },
  ETHUSD: { yahoo: ["ETH-USD"], twelve: "ETH/USD" }
};

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseTimeframe(raw: string | Timeframe): Timeframe {
  if (typeof raw !== "string") return raw;
  const m = raw.trim().toUpperCase().match(/(\d+)\s*(MINUTE|MINUTES|HOUR|HOURS|DAY|DAYS|M|H|D)/);
  if (!m) return { value: 30, unit: "MINUTES" };
  const value = Number(m[1]);
  const u = m[2];
  if (u.startsWith("H")) return { value, unit: "HOURS" };
  if (u.startsWith("D") && u !== "M") return { value, unit: "DAYS" };
  return { value, unit: "MINUTES" };
}

export function resolveCandleRequest(symbol: string, timeframe: string | Timeframe, count = 88): CandleRequest {
  const tf = parseTimeframe(timeframe);
  const key = normalizeSymbol(symbol);
  const mapped = ALIASES[key];
  const intervals = mapInterval(tf);
  const yahooFallback = key.endsWith("USD") && key.length === 6 ? [`${key.slice(0, 3)}${key.slice(3)}=X`] : [];
  return {
    symbol: key,
    interval: intervals.label,
    count,
    yahooInterval: intervals.yahoo,
    yahooRange: intervals.range,
    twelveInterval: intervals.twelve,
    yahooSymbols: mapped?.yahoo ?? (yahooFallback.length ? yahooFallback : [`${key}=X`, key]),
    twelveSymbol: mapped?.twelve ?? `${key.slice(0, 3)}/${key.slice(3)}`
  };
}

function mapInterval(tf: Timeframe): { label: string; yahoo: string; twelve: string; range: string } {
  if (tf.unit === "DAYS") {
    return { label: `${tf.value} DAY`, yahoo: "1d", twelve: "1day", range: "6mo" };
  }
  if (tf.unit === "HOURS") {
    if (tf.value >= 4) return { label: `${tf.value} HOURS`, yahoo: "1h", twelve: "4h", range: "1mo" };
    return { label: `${tf.value} HOUR`, yahoo: "60m", twelve: "1h", range: "1mo" };
  }
  if (tf.value <= 1) return { label: "1 MINUTE", yahoo: "1m", twelve: "1min", range: "1d" };
  if (tf.value <= 5) return { label: "5 MINUTES", yahoo: "5m", twelve: "5min", range: "5d" };
  if (tf.value <= 15) return { label: "15 MINUTES", yahoo: "15m", twelve: "15min", range: "5d" };
  if (tf.value <= 30) return { label: "30 MINUTES", yahoo: "30m", twelve: "30min", range: "1mo" };
  return { label: `${tf.value} MINUTES`, yahoo: "60m", twelve: "1h", range: "1mo" };
}
