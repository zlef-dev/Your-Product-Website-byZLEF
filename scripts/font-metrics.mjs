/**
 * node scripts/font-metrics.mjs
 * Measures Archivo Variable against its local fallbacks in the built site and prints the
 * size-adjust and ascent/descent overrides for src/styles/fonts.css, so the swap from
 * fallback to Archivo moves as little as possible.
 */
import { chromium } from '@playwright/test';
import { startPreview } from './lib/server.mjs';

const { url, close } = await startPreview({ port: 4196 });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${url}/`);
await page.evaluate(() => document.fonts.ready);

const result = await page.evaluate(async () => {
  const sample =
    'Let’s build your brand’s website. I design and build websites for brands: cinematic, fast and made to sell.';
  const ctx = document.createElement('canvas').getContext('2d');
  const measure = (font) => {
    ctx.font = font;
    const m = ctx.measureText(sample);
    return { width: m.width, ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent };
  };
  await document.fonts.load('400 100px "Archivo Variable"');
  await document.fonts.load('880 expanded 100px "Archivo Variable"');
  const body = measure('400 100px "Archivo Variable"');
  const arial = measure('400 100px Arial');
  // The display face runs at wdth 112–118; "expanded" (125) and "semi-expanded" (112.5)
  // bracket it, so average the two.
  const wide = measure('880 semi-expanded 100px "Archivo Variable"');
  const wider = measure('880 expanded 100px "Archivo Variable"');
  const black = measure('900 100px "Arial Black"');
  const round = (n) => Math.round(n * 10) / 10;
  const display = (wide.width + wider.width) / 2;
  const bodyAdjust = body.width / arial.width;
  const displayAdjust = display / black.width;
  return {
    'Archivo Fallback': {
      sizeAdjust: `${round(bodyAdjust * 100)}%`,
      ascentOverride: `${round(body.ascent / bodyAdjust)}%`,
      descentOverride: `${round(body.descent / bodyAdjust)}%`,
    },
    'Archivo Display Fallback': {
      sizeAdjust: `${round(displayAdjust * 100)}%`,
      ascentOverride: `${round(wide.ascent / displayAdjust)}%`,
      descentOverride: `${round(wide.descent / displayAdjust)}%`,
    },
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
await close();
