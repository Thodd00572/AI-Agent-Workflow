import { renderSetupChart } from "./chart.ts";
import type { PresentationModel } from "./presentation.ts";
import { CARD_FORMATS, COLOR, directionAccent } from "./tokens.ts";

export function renderCardSvg(model: PresentationModel): string {
  const spec = CARD_FORMATS.telegram;
  const accent = directionAccent(model.direction);
  const chart = renderSetupChart(model.chart, spec.width - 120, 620);
  const arrow = model.direction === "LONG" ? "▲" : "▼";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}">
  <rect width="${spec.width}" height="${spec.height}" fill="${COLOR.bgOuter}"/>
  <rect x="22" y="22" width="${spec.width - 44}" height="${spec.height - 44}" rx="18" fill="${COLOR.bgOuter}" stroke="${COLOR.neon}" stroke-width="${spec.stroke}"/>
  <text x="60" y="78" fill="${accent}" font-size="32" font-family="Arial, Helvetica, sans-serif" font-weight="800">${arrow} ${escapeXml(model.direction)}</text>
  <text x="${spec.width / 2}" y="78" text-anchor="middle" fill="${COLOR.white}" font-size="44" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(model.symbol)}</text>
  <text x="${spec.width - 60}" y="78" text-anchor="end" fill="${COLOR.white}" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(model.timeframe)}</text>
  <g transform="translate(50, 100)">${chart}</g>
  <text x="60" y="${spec.height - 48}" fill="${COLOR.label}" font-size="18" font-family="Arial, Helvetica, sans-serif">${escapeXml(model.signal_id)}</text>
  <text x="${spec.width - 60}" y="${spec.height - 48}" text-anchor="end" fill="${COLOR.white}" font-size="18" font-family="Arial, Helvetica, sans-serif">${escapeXml(model.entry)} · SL ${escapeXml(model.stop_loss)}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
