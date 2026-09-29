/**
 * npm run screenshots
 * Saves PNGs of every scene at 390×844, 768×1024 and 1440×900 to qa/screenshots/.
 * Pinned scenes are shot at several points of their scroll range.
 *   --only=390         one viewport width
 *   --filter=process   only shots whose name contains the text
 *   --reduced          emulate prefers-reduced-motion
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { launchOptions } from './lib/browser.mjs';
import { startPreview } from './lib/server.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const VIEWPORTS = [
  { w: 390, h: 844, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1440, h: 900, mobile: false },
].filter((v) => !args.get('only') || String(v.w) === String(args.get('only')));

/** [name, scene id, fraction of the scene's scroll range] */
const SHOTS = [
  ['s1-hero', 'top', 0],
  ['s2-try', 'try', 0.35],
  ['s3-lineup-a', 'lineup', 0.12],
  ['s3-lineup-b', 'lineup', 0.5],
  ['s3-lineup-c', 'lineup', 0.9],
  ['s4-01-brief', 'process', 0.1],
  ['s4-02-direction', 'process', 0.33],
  ['s4-03-design', 'process', 0.5],
  ['s4-04-build', 'process', 0.7],
  ['s4-05-launch', 'process', 0.92],
  ['s5-build', 'build', 0],
  ['s7-brief', 'brief', 0],
  ['s8-footer', 'contact', 0],
];

const reduced = !!args.get('reduced');
const filter = args.get('filter');
const outDir = `qa/screenshots${reduced ? '/reduced' : ''}`;

const { url, close } = await startPreview();
const browser = await chromium.launch(launchOptions());

async function settle(page, ms = 1400) {
  await page.waitForTimeout(ms);
}

/** Scrolls so the given fraction of a scene's range sits at the top of the viewport. */
async function scrollToScene(page, id, fraction) {
  await page.evaluate(
    ([id, fraction]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const spacer = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : null;
      const box = (spacer ?? el).getBoundingClientRect();
      const top = box.top + window.scrollY;
      const range = spacer ? spacer.offsetHeight - window.innerHeight : 0;
      const y = Math.round(top + range * fraction);
      // Lenis follows native scroll position changes, so a plain scrollTo is enough.
      window.scrollTo(0, y);
    },
    [id, fraction],
  );
}

await mkdir(outDir, { recursive: true });
const written = [];
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    isMobile: vp.mobile && vp.w < 700,
    hasTouch: vp.mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`  [console:${m.type()}] ${m.text()}`);
  });
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  await settle(page, 2500);

  for (const personalised of [false, true]) {
    if (personalised) {
      // Set a brand the way a visitor would, then re-shoot the scenes that change.
      await scrollToScene(page, 'try', 0.35);
      await settle(page, 600);
      await page.fill('#brand-name', 'Kopi Kalye');
      await page.locator('.swatch', { hasText: 'Lagoon' }).click();
      await page.press('#brand-name', 'Enter');
      await settle(page, 2200);
    }
    for (const [name, id, fraction] of SHOTS) {
      if (
        personalised &&
        !['s2-try', 's3-lineup-b', 's4-03-design', 's4-05-launch', 's7-brief', 's8-footer'].includes(name)
      )
        continue;
      const file = `${outDir}/${vp.w}x${vp.h}-${name}${personalised ? '-brand' : ''}.png`;
      if (filter && !file.includes(filter)) continue;
      await scrollToScene(page, id, fraction);
      await settle(page);
      await page.screenshot({ path: file });
      written.push(file);
    }
  }

  for (const [name, path] of [
    ['404', '/404.html'],
    ['privacy', '/privacy.html'],
  ]) {
    const file = `${outDir}/${vp.w}x${vp.h}-${name}.png`;
    if (filter && !file.includes(filter)) continue;
    await page.goto(`${url}${path}`, { waitUntil: 'networkidle' });
    await settle(page, 1800);
    await page.screenshot({ path: file });
    written.push(file);
  }
  await context.close();
}

await browser.close();
await close();
console.log(`Saved ${written.length} screenshots to ${outDir}/`);
