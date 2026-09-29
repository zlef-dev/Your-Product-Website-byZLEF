/**
 * npm run og
 * Screenshots the hero of the built site at 1200×630 into public/og.png (then rebuild so
 * dist/ picks it up). Waits for the 3D can to be on screen.
 */
import { chromium } from '@playwright/test';
import { launchOptions } from './lib/browser.mjs';
import { startPreview } from './lib/server.mjs';

const { url, close } = await startPreview({ port: 4197 });
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`${url}/`, { waitUntil: 'networkidle' });
await page
  .locator('canvas.stage-canvas.is-ready, .fallback-can')
  .first()
  .waitFor({ timeout: 15_000 })
  .catch(() => undefined);
// Let the can fade up and the idle turn settle near its front.
await page.waitForTimeout(2500);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
await close();
console.log('Wrote public/og.png (1200×630)');
