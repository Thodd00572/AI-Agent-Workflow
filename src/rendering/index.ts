import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";
import type { CanonicalTradingSignal } from "../domain/types.ts";
import { toPresentation } from "./presentation.ts";
import { renderCardHtml } from "./template.ts";
import { renderCardSvg } from "./svg.ts";
import { renderSetupChart } from "./chart.ts";
import { CARD_FORMATS, type CardFormat } from "./tokens.ts";
import { fetchMarketCandles } from "../marketdata/index.ts";

export interface RenderResult {
  html: string;
  svg: string;
  pngPath: string;
  sha256: string;
  width: number;
  height: number;
}

export async function renderSignalPng(
  doc: CanonicalTradingSignal,
  storageDir: string
): Promise<RenderResult> {
  const market = await fetchMarketCandles(doc.signal.symbol, doc.signal.timeframe).catch(() => undefined);
  const model = toPresentation(doc, market);
  const width = doc.render.width;
  const height = doc.render.height;
  const html = renderCardHtml(model, formatFromSize(width, height));
  const svg = renderCardSvg(model);
  mkdirSync(storageDir, { recursive: true });
  const outPath = join(storageDir, `${doc.signal.id}.png`);
  writeFileSync(join(storageDir, `${doc.signal.id}.html`), html);
  writeFileSync(join(storageDir, `${doc.signal.id}.svg`), svg);

  let buf: Buffer;
  try {
    buf = await screenshotWithPlaywright(html, width, height);
  } catch {
    buf = encodeSolidPng(width, height, [11, 13, 18]);
  }
  writeFileSync(outPath, buf);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  return { html, svg, pngPath: outPath, sha256, width, height };
}

async function screenshotWithPlaywright(html: string, width: number, height: number): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1
    });
    await page.setContent(html, { waitUntil: "load" });
    const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}

function encodeSolidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 3;
      raw[i] = rgb[0];
      raw[i + 1] = rgb[1];
      raw[i + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const chunks = [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ];
  return Buffer.concat(chunks);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, body, crcBuf]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return c ^ 0xffffffff;
}

export { toPresentation, renderCardHtml, renderCardSvg, renderSetupChart };

function formatFromSize(width: number, height: number): CardFormat {
  if (width === CARD_FORMATS.x.width && height === CARD_FORMATS.x.height) return "x";
  if (width === CARD_FORMATS.tiktok.width && height === CARD_FORMATS.tiktok.height) return "tiktok";
  return "telegram";
}
