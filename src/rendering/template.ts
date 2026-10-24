import { renderSetupChart } from "./chart.ts";
import type { PresentationModel } from "./presentation.ts";
import { CARD_FORMATS, COLOR, directionAccent, type CardFormat } from "./tokens.ts";

export function renderCardHtml(model: PresentationModel, format: CardFormat = "telegram"): string {
  const spec = CARD_FORMATS[format];
  const accent = directionAccent(model.direction);
  const inset = spec.pad * 2 + spec.stroke * 2;
  const neonInnerW = spec.width - inset;
  const neonInnerH = spec.height - inset;
  const side = 18;
  const panelBottom = 12;
  const chartW = neonInnerW - side * 2;
  const chartH = neonInnerH - spec.headerH - spec.gap - spec.summaryH - panelBottom;
  const chart = renderSetupChart(model.chart, Math.max(chartW, 240), Math.max(chartH, 240));
  const tp1 = model.take_profits[0];
  const tp2 = model.take_profits[1];
  const arrow = model.direction === "LONG" ? "▲" : "▼";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${spec.width}px; height: ${spec.height}px; background: ${COLOR.bgOuter}; }
    body { font-family: Arial, Helvetica, sans-serif; color: ${COLOR.white}; overflow: hidden; }
    .outer {
      width: ${spec.width}px;
      height: ${spec.height}px;
      padding: ${spec.pad}px;
      background: ${COLOR.bgOuter};
    }
    .glow {
      height: 100%;
      border-radius: 22px;
      box-shadow: 0 0 24px 4px ${COLOR.neon};
    }
    .neon {
      height: 100%;
      border: ${spec.stroke}px solid ${COLOR.neon};
      border-radius: 18px;
      box-shadow: 0 0 8px ${COLOR.neon} inset;
      background: ${COLOR.bgOuter};
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .head {
      height: ${spec.headerH}px;
      display: grid;
      grid-template-columns: 1fr 1.3fr 1fr;
      align-items: center;
      padding: 0 22px;
      background: ${COLOR.bgCard};
      box-shadow: inset 0 1px 0 ${COLOR.label};
    }
    .dir {
      display: flex; align-items: center; gap: 10px;
      color: ${accent}; font-weight: 800; font-size: ${spec.dir}px; letter-spacing: 0.08em;
    }
    .sym { text-align: center; font-size: ${spec.sym}px; font-weight: 800; color: ${COLOR.white}; letter-spacing: 0.04em; }
    .tf { text-align: right; font-size: ${spec.tf}px; font-weight: 700; color: ${COLOR.white}; }
    .chart {
      margin: 0 ${side}px;
      height: ${chartH}px;
      background: ${COLOR.chartBg};
      overflow: hidden;
    }
    .chart svg { display: block; width: 100%; height: 100%; }
    .gap { height: ${spec.gap}px; background: ${COLOR.bgOuter}; flex: 0 0 ${spec.gap}px; }
    .panel {
      height: ${spec.summaryH}px;
      margin: 0 ${side}px ${panelBottom}px;
      background: ${COLOR.bgPanel};
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px;
    }
    .row { display: grid; grid-template-columns: 1fr 1fr 1fr; flex: 1; gap: 6px; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; flex: 1.15; gap: 6px; }
    .cell {
      display: flex; align-items: center; gap: 14px;
      padding: 10px 18px;
      background: ${COLOR.bgCard};
      border: 1px solid ${COLOR.bgOuter};
      border-radius: 8px;
    }
    .lab { font-size: ${spec.lab}px; letter-spacing: 0.14em; color: ${COLOR.label}; }
    .val { font-size: ${spec.val}px; font-weight: 800; color: ${COLOR.white}; margin-top: 4px; }
    .val.accent { color: ${accent}; }
    .ico { width: ${spec.ico}px; height: ${spec.ico}px; flex: 0 0 ${spec.ico}px; }
  </style>
</head>
<body>
  <div class="outer">
    <div class="glow">
      <div class="neon">
        <div class="head">
          <div class="dir">${arrow} ${esc(model.direction)}</div>
          <div class="sym">${esc(model.symbol)}</div>
          <div class="tf">${esc(model.timeframe)}</div>
        </div>
        <div class="chart">${chart}</div>
        <div class="gap"></div>
        <div class="panel">
          <div class="row">
            <div class="cell">${iconCrosshair(accent)}<div><div class="lab">DIRECTION</div><div class="val accent">${esc(model.direction)}</div></div></div>
            <div class="cell">${iconClock()}<div><div class="lab">TIMEFRAME</div><div class="val">${esc(model.timeframe)}</div></div></div>
            <div class="cell">${iconTag()}<div><div class="lab">TICKER SYMBOL</div><div class="val">${esc(model.symbol)}</div></div></div>
          </div>
          <div class="row2">
            <div class="cell">${iconEntry(accent)}<div><div class="lab">ENTRY ZONE</div><div class="val">${esc(model.entry)}</div></div></div>
            <div class="cell">${iconShield()}<div><div class="lab">STOP LOSS</div><div class="val">${esc(model.stop_loss)}</div></div></div>
          </div>
          <div class="row2">
            <div class="cell">${iconTarget()}<div><div class="lab">TAKE PROFIT ZONE 1</div><div class="val">${esc(tp1?.range ?? "—")}</div></div></div>
            <div class="cell">${iconTarget()}<div><div class="lab">TAKE PROFIT ZONE 2</div><div class="val">${esc(tp2?.range ?? "—")}</div></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function iconCrosshair(color: string): string {
  return `<svg class="ico" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15" fill="none" stroke="${color}" stroke-width="3"/><circle cx="21" cy="21" r="6" fill="none" stroke="${color}" stroke-width="3"/><path d="M21 4v8M21 30v8M4 21h8M30 21h8" stroke="${color}" stroke-width="3"/></svg>`;
}
function iconClock(): string {
  return `<svg class="ico" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15" fill="none" stroke="${COLOR.label}" stroke-width="3"/><path d="M21 12v10l7 4" fill="none" stroke="${COLOR.white}" stroke-width="3"/></svg>`;
}
function iconTag(): string {
  return `<svg class="ico" viewBox="0 0 42 42"><path d="M8 22 22 8h12v12L20 34z" fill="none" stroke="${COLOR.label}" stroke-width="3"/><circle cx="29" cy="15" r="2.4" fill="${COLOR.white}"/></svg>`;
}
function iconEntry(color: string): string {
  return `<svg class="ico" viewBox="0 0 42 42"><rect x="6" y="6" width="30" height="30" fill="${color}"/><path d="M13 16h16v6M21 16v16" stroke="${COLOR.white}" stroke-width="3" fill="none"/></svg>`;
}
function iconShield(): string {
  return `<svg class="ico" viewBox="0 0 42 42"><path d="M21 6 34 12v10c0 8-6 14-13 16-7-2-13-8-13-16V12z" fill="${COLOR.crimson}"/><path d="M21 14l3 6h6l-5 4 2 6-6-4-6 4 2-6-5-4h6z" fill="${COLOR.white}"/></svg>`;
}
function iconTarget(): string {
  return `<svg class="ico" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15" fill="none" stroke="${COLOR.neon}" stroke-width="3"/><circle cx="21" cy="21" r="6" fill="none" stroke="${COLOR.neon}" stroke-width="3"/><path d="M21 8v26M8 21h26" stroke="${COLOR.neon}" stroke-width="3"/></svg>`;
}
