export const COLOR = {
  neon: "#39FF14",
  crimson: "#DC143C",
  bgOuter: "#0B0E14",
  bgPanel: "#05070A",
  bgCard: "#0F141D",
  tpFill: "#E6F4EA",
  entryFillShort: "#FCE8E6",
  entryFillLong: "#E6F4EA",
  white: "#FFFFFF",
  label: "#9AA0A6",
  chartBg: "#FFFFFF",
  bearishCandle: "#0B0E14"
} as const;

export type CardFormat = "telegram" | "x" | "tiktok";

export interface CardFormatSpec {
  width: number;
  height: number;
  summaryH: number;
  headerH: number;
  gap: number;
  pad: number;
  stroke: number;
  dir: number;
  sym: number;
  tf: number;
  lab: number;
  val: number;
  ico: number;
}

export const CARD_FORMATS: Record<CardFormat, CardFormatSpec> = {
  telegram: { width: 1920, height: 1080, summaryH: 300, headerH: 78, gap: 20, pad: 22, stroke: 10, dir: 32, sym: 44, tf: 26, lab: 13, val: 26, ico: 38 },
  x: { width: 1200, height: 1600, summaryH: 440, headerH: 86, gap: 22, pad: 22, stroke: 10, dir: 28, sym: 40, tf: 22, lab: 12, val: 24, ico: 36 },
  tiktok: { width: 1080, height: 1920, summaryH: 520, headerH: 90, gap: 24, pad: 22, stroke: 10, dir: 28, sym: 42, tf: 22, lab: 13, val: 26, ico: 38 }
};

export function directionAccent(direction: "LONG" | "SHORT" | string): string {
  return direction === "LONG" ? COLOR.neon : COLOR.crimson;
}

export function parseCardFormat(raw?: string): CardFormat {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "x" || v === "twitter" || v === "twitter/x") return "x";
  if (v === "tiktok") return "tiktok";
  return "telegram";
}
