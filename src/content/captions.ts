import type { CanonicalTradingSignal } from "../domain/types.ts";

export interface PlatformCopy {
  text: string;
  header?: string;
}

export function buildCaptions(doc: CanonicalTradingSignal): Record<string, PlatformCopy> {
  const telegram = buildTelegramCopy(doc);
  const compact = compactFacts(doc);
  return {
    telegram,
    x: { text: compact },
    facebook: { text: compact },
    instagram: { text: compact },
    tiktok: { text: compact }
  };
}

export function buildTelegramCopy(doc: CanonicalTradingSignal): PlatformCopy {
  const s = doc.signal;
  const dirEmoji = s.direction === "SHORT" ? "📉" : "📈";
  const rr = doc.derived?.risk_rewards[0];
  const rrLine = rr !== undefined ? `1 : ${trimNum(rr)}` : "—";
  const tpLines = s.take_profit_zones
    .map((z, i) => `• Take Profit ${i + 1}: ${formatRange(z.low, z.high)}`)
    .join("\n");

  const header = [
    "🔥 TRIGGER TRADES 🔥",
    "🚨 TRADING ALERT 🚨",
    "",
    `➡ Ticker Symbol: ${s.symbol}`,
    `➡ Timeframe: ${formatTimeframe(s.timeframe.value, s.timeframe.unit)}`,
    `➡ Direction: ${s.direction} ${dirEmoji}`,
    "",
    "🎯 Setup Details:",
    `• Entry Zone: ${formatRange(s.entry_zone.low, s.entry_zone.high)}`,
    `• Stop Loss: ${formatStop(s.stop_loss.price)}`,
    tpLines,
    `• Risk / Reward: ${rrLine}`
  ].join("\n");

  const footer = [
    "✅ Execution Note: Risk managed at 1%. Wait for lower time frame confirmation if entering.",
    "",
    "🔒 Want full real-time entries, join VIP & Unlock All Signals 👇",
    process.env.TELEGRAM_VIP_URL?.trim() || "https://triggertrades.com"
  ].join("\n");

  return { header, text: footer };
}

function compactFacts(doc: CanonicalTradingSignal): string {
  const s = doc.signal;
  const tps = s.take_profit_zones.map((z) => `${z.id} ${z.low}–${z.high}`).join(" | ");
  return `${s.direction} ${s.symbol} ${s.timeframe.value}${unitShort(s.timeframe.unit)}
Entry ${s.entry_zone.low}–${s.entry_zone.high}
SL ${s.stop_loss.price}
${tps}`;
}

function formatTimeframe(value: number, unit: string): string {
  const labels: Record<string, [string, string]> = {
    MINUTES: ["Minute", "Minutes"],
    HOURS: ["Hour", "Hours"],
    DAYS: ["Day", "Days"]
  };
  const [one, many] = labels[unit] ?? [unit, unit];
  return `${value} ${value === 1 ? one : many}`;
}

function formatRange(low: number, high: number): string {
  return `${formatGrouped(low)} – ${formatGrouped(high)}`;
}

function formatStop(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatGrouped(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function unitShort(unit: string): string {
  if (unit === "MINUTES") return "m";
  if (unit === "HOURS") return "h";
  return "d";
}
