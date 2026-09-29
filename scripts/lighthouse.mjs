/**
 * npm run lighthouse
 * Runs Lighthouse (desktop and mobile presets) against `vite preview` of the built site
 * and saves the JSON reports to qa/. Uses Playwright's Chromium unless CHROME_PATH is set.
 *   --runs=3   median of several runs per preset (default 1)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { chromiumArgs } from './lib/browser.mjs';
import { startPreview } from './lib/server.mjs';

const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.split('=')[1] ?? 1);
const PORT = 9333;
const { url, close } = await startPreview({ port: 4190 });
await mkdir('qa', { recursive: true });

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const summary = {};

for (const preset of ['desktop', 'mobile']) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    // Playwright launches Chromium (chrome-launcher can't spawn it in some sandboxes);
    // Lighthouse drives it over the DevTools port.
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || undefined,
      args: [`--remote-debugging-port=${PORT}`, ...chromiumArgs()],
    });
    try {
      const flags = { port: PORT, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES };
      const result = await lighthouse(`${url}/`, flags, preset === 'desktop' ? desktopConfig : undefined);
      results.push(result);
    } finally {
      await browser.close();
    }
  }
  const score = (r) => r.lhr.categories.performance.score;
  results.sort((a, b) => score(a) - score(b));
  const median = results[Math.floor(results.length / 2)];
  await writeFile(`qa/lighthouse-${preset}.json`, median.report);
  const lhr = median.lhr;
  summary[preset] = {
    ...Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
    LCP: lhr.audits['largest-contentful-paint'].displayValue,
    TBT: lhr.audits['total-blocking-time'].displayValue,
    CLS: lhr.audits['cumulative-layout-shift'].displayValue,
    FCP: lhr.audits['first-contentful-paint'].displayValue,
    SI: lhr.audits['speed-index'].displayValue,
  };
  const failing = Object.values(lhr.audits)
    .filter(
      (a) =>
        a.score !== null &&
        a.score < 0.9 &&
        a.scoreDisplayMode !== 'informative' &&
        a.scoreDisplayMode !== 'manual',
    )
    .map((a) => `${a.id} (${a.score})`);
  console.log(`\n${preset}:`, summary[preset]);
  if (failing.length) console.log('  below 0.9:', failing.join(', '));
}

await writeFile('qa/lighthouse-summary.json', JSON.stringify(summary, null, 2));
await close();
