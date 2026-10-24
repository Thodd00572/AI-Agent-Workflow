export interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketSeries {
  symbol: string;
  mappedSymbol: string;
  provider: "yahoo" | "twelvedata";
  interval: string;
  last: number;
  candles: MarketCandle[];
}

export interface MarketDataOptions {
  provider: "auto" | "yahoo" | "twelvedata";
  twelveDataApiKey?: string;
  timeoutMs?: number;
}

export interface CandleRequest {
  symbol: string;
  interval: string;
  count: number;
  yahooInterval: string;
  yahooRange: string;
  twelveInterval: string;
  yahooSymbols: string[];
  twelveSymbol: string;
}
