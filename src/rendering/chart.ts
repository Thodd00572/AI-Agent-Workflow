import { formatPrice } from "./presentation.ts";
import { COLOR, directionAccent } from "./tokens.ts";

export interface ChartLevels {
  direction: "LONG" | "SHORT";
  stop: number;
  entryLow: number;
  entryHigh: number;
  takeProfits: { id: string; low: number; high: number }[];
  candles?: Candle[];
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time?: number;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCandles(levels: ChartLevels, count = 88): Candle[] {
  const rnd = mulberry32(Math.round(levels.stop * 100 + levels.entryLow * 10));
  const entryMid = (levels.entryLow + levels.entryHigh) / 2;
  const lastTp = levels.takeProfits.at(-1);
  const floor = lastTp ? (lastTp.low + lastTp.high) / 2 : entryMid;
  const start = levels.direction === "SHORT" ? floor + (entryMid - floor) * 0.35 : floor - (floor - entryMid) * 0.15;
  const candles: Candle[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    let target = entryMid;
    if (levels.direction === "SHORT") {
      if (t < 0.55) target = start + (levels.entryHigh - start) * (t / 0.55) * 0.85;
      else if (t < 0.82) target = levels.entryHigh - (levels.entryHigh - entryMid) * ((t - 0.55) / 0.27);
      else target = entryMid;
    } else {
      if (t < 0.55) target = start - (start - levels.entryLow) * (t / 0.55) * 0.85;
      else target = entryMid;
    }
    const noise = (rnd() - 0.5) * (levels.entryHigh - levels.entryLow) * 0.9;
    const next = price + (target - price) * 0.22 + noise;
    const open = price;
    const close = next;
    const high = Math.max(open, close) + rnd() * (levels.entryHigh - levels.entryLow) * 0.25;
    const low = Math.min(open, close) - rnd() * (levels.entryHigh - levels.entryLow) * 0.25;
    candles.push({
      open,
      high,
      low,
      close,
      time: Date.UTC(2026, 6, 20, 6) + i * 30 * 60 * 1000
    });
    price = close;
  }
  return candles;
}

export function renderSetupChart(levels: ChartLevels, width = 1008, height = 620): string {
  const padL = 18;
  const padR = 108;
  const padT = 18;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const candles = levels.candles?.length ? levels.candles : generateCandles(levels);
  const prices = [
    levels.stop,
    levels.entryLow,
    levels.entryHigh,
    ...levels.takeProfits.flatMap((z) => [z.low, z.high]),
    ...candles.flatMap((c) => [c.high, c.low])
  ];
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const { lo, hi, step } = niceBounds(minP, maxP);
  const y = (price: number) => padT + ((hi - price) / (hi - lo || 1)) * plotH;
  const x0 = padL;
  const x1 = padL + plotW;
  const ticks: number[] = [];
  for (let p = lo; p <= hi + step / 2; p += step) ticks.push(roundTo(p, step));

  const grid = ticks
    .map((p) => {
      const yy = y(p);
      return `<line x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}" stroke="${COLOR.label}" stroke-width="1" opacity="0.35"/>
        <text x="${x1 + 8}" y="${yy + 4}" fill="${COLOR.label}" font-size="13" font-family="Arial, sans-serif">${fmt(p)}</text>`;
    })
    .join("");

  const band = (low: number, high: number, fill: string, stroke: string, label: string) => {
    const top = y(high);
    const h = Math.max(y(low) - top, 8);
    const mid = top + h / 2;
    return `<rect x="${x0}" y="${top}" width="${plotW}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <text x="${(x0 + x1) / 2}" y="${mid + 5}" text-anchor="middle" fill="${COLOR.white}" font-size="16" font-weight="700" font-family="Arial, sans-serif" paint-order="stroke" stroke="#0B0E14" stroke-width="3">${escapeXml(label)}</text>`;
  };

  const cw = plotW / candles.length;
  const bodies = candles
    .map((c, i) => {
      const x = x0 + i * cw;
      const bull = c.close >= c.open;
      const color = bull ? COLOR.neon : COLOR.bearishCandle;
      const top = y(Math.max(c.open, c.close));
      const bot = y(Math.min(c.open, c.close));
      const h = Math.max(bot - top, 1.2);
      const wickTop = y(c.high);
      const wickBot = y(c.low);
      const cx = x + cw * 0.5;
      return `<line x1="${cx}" y1="${wickTop}" x2="${cx}" y2="${wickBot}" stroke="${color}" stroke-width="1.2"/>
        <rect x="${x + cw * 0.22}" y="${top}" width="${cw * 0.56}" height="${h}" fill="${color}"/>`;
    })
    .join("");

  const last = candles.length - 1;
  const xLast = x0 + last * cw + cw * 0.5;
  const entryMid = (levels.entryLow + levels.entryHigh) / 2;
  const tp1 = levels.takeProfits[0];
  const tp2 = levels.takeProfits.at(-1);
  const bounce = levels.direction === "SHORT" ? entryMid + (levels.stop - entryMid) * 0.28 : entryMid - (entryMid - levels.stop) * 0.28;
  const p1x = x0 + plotW * 0.72;
  const p2x = x0 + plotW * 0.82;
  const p3x = x0 + plotW * 0.9;
  const p4x = x1 - 8;
  const yEntry = y(entryMid);
  const yBounce = y(bounce);
  const yTp1 = tp1 ? y((tp1.low + tp1.high) / 2) : yEntry;
  const yTp2 = tp2 ? y((tp2.low + tp2.high) / 2) : yTp1;
  const path = `M ${xLast} ${y(candles[last].close)} L ${p1x} ${yEntry} L ${p2x} ${yBounce} L ${p3x} ${yTp1} L ${p4x} ${yTp2}`;

  const axisTags = [
    axisTag(x1, y(levels.stop), fmt(levels.stop), COLOR.crimson),
    ...levels.takeProfits.map((z) => axisTag(x1, y(z.high), fmt(z.high), COLOR.neon))
  ].join("");

  const times = axisTimeLabels(candles);
  const xLabels = times
    .map(({ label, index }) => {
      const x = x0 + index * cw + cw / 2;
      return `<text x="${x}" y="${height - 12}" text-anchor="middle" fill="${COLOR.label}" font-size="12" font-family="Arial, sans-serif">${escapeXml(label)}</text>`;
    })
    .join("");

  const entryFill = levels.direction === "SHORT" ? COLOR.entryFillShort : COLOR.entryFillLong;
  const entryStroke = directionAccent(levels.direction);
  const tpBands = levels.takeProfits
    .map((z, i) =>
      band(
        z.low,
        z.high,
        COLOR.tpFill,
        COLOR.neon,
        `TAKE PROFIT ZONE ${i + 1}  [${formatPrice(z.low)} – ${formatPrice(z.high)}]`
      )
    )
    .join("");

  const slY = y(levels.stop);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${COLOR.chartBg}"/>
    ${grid}
    ${tpBands}
    ${band(levels.entryLow, levels.entryHigh, entryFill, entryStroke, `ENTRY ZONE [${formatPrice(levels.entryLow)} – ${formatPrice(levels.entryHigh)}]`)}
    <line x1="${x0}" y1="${slY}" x2="${x1}" y2="${slY}" stroke="${COLOR.crimson}" stroke-width="3"/>
    <polygon points="${x0 + 14},${slY - 10} ${x0 + 26},${slY} ${x0 + 14},${slY + 10}" fill="${COLOR.crimson}"/>
    <text x="${x0 + 32}" y="${slY - 8}" fill="${COLOR.crimson}" font-size="15" font-weight="700" font-family="Arial, sans-serif">SL (Stop Loss) ${fmt(levels.stop)}</text>
    ${bodies}
    <path d="${path}" fill="none" stroke="${COLOR.crimson}" stroke-width="2.4" stroke-dasharray="7 6"/>
    <polygon points="${p4x},${yTp2} ${p4x - 10},${yTp2 - 7} ${p4x - 10},${yTp2 + 7}" fill="${COLOR.crimson}"/>
    ${axisTags}
    ${xLabels}
  </svg>`;
}

function axisTag(x: number, yy: number, text: string, bg: string): string {
  return `<rect x="${x + 4}" y="${yy - 11}" width="96" height="20" rx="2" fill="${bg}"/>
    <text x="${x + 52}" y="${yy + 4}" text-anchor="middle" fill="${COLOR.white}" font-size="12" font-family="Arial, sans-serif">${escapeXml(text)}</text>`;
}

function axisTimeLabels(candles: Candle[]): { label: string; index: number }[] {
  const n = Math.min(6, candles.length);
  if (n === 0) return [];
  const labels: { label: string; index: number }[] = [];
  for (let i = 0; i < n; i++) {
    const index = Math.round((i / (n - 1 || 1)) * (candles.length - 1));
    labels.push({ label: formatAxisTime(candles[index], i === 0), index });
  }
  return labels;
}

function formatAxisTime(candle: Candle, first: boolean): string {
  if (!candle.time) return first ? "START" : "";
  const d = new Date(candle.time);
  if (first) {
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
  }
  return d.toISOString().slice(11, 16);
}

export function niceBounds(minP: number, maxP: number): { lo: number; hi: number; step: number } {
  const span = maxP - minP || Math.abs(maxP) * 0.01 || 1;
  const pad = span * 0.04;
  const step = tickStep(span + pad * 2);
  return {
    lo: Math.floor((minP - pad) / step) * step,
    hi: Math.ceil((maxP + pad) / step) * step,
    step
  };
}

function tickStep(span: number): number {
  if (span <= 0) return 1;
  const raw = span / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function roundTo(n: number, step: number): number {
  const decimals = Math.max(0, Math.min(8, (step.toString().split(".")[1] ?? "").length));
  return Number((Math.round(n / step) * step).toFixed(decimals));
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 2 : abs >= 10 ? 3 : abs >= 1 ? 4 : 5;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function escapeXml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
