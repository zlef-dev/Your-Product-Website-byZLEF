/**
 * npm run perf
 * Frame times while scrolling the whole page with wheel input (so Lenis and every pinned
 * scene run), measured with requestAnimationFrame in the page. Runs unthrottled and under
 * 4× CPU throttling (Chrome DevTools Protocol) at 1440×900, and saves qa/perf.json.
 * Target: p95 under 33 ms with 4× throttling.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { launchOptions } from './lib/browser.mjs';
import { startPreview } from './lib/server.mjs';

const { url, close } = await startPreview({ port: 4195 });
const browser = await chromium.launch(launchOptions());
const results = {};

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

for (const throttle of [1, 4]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  // Let the stage boot and the line-up load before measuring.
  await page.waitForTimeout(6000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(() => {
    const w = window;
    w.__frames = [];
    w.__hitches = [];
    let last = performance.now();
    const tick = (now) => {
      w.__frames.push(now - last);
      if (now - last > 50) w.__hitches.push({ scrollY: Math.round(scrollY), ms: Math.round(now - last) });
      last = now;
      w.__raf = requestAnimationFrame(tick);
    };
    w.__raf = requestAnimationFrame(tick);
  });
  await page.mouse.move(700, 450);
  const height = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  // Scroll top to bottom in wheel steps, like a visitor reading at a steady pace.
  const steps = Math.ceil(height / 120);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1500);
  const { frames, hitches } = await page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    return { frames: window.__frames.slice(1), hitches: window.__hitches };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const key = `${throttle}x`;
  results[key] = {
    frames: frames.length,
    p50: +pct(frames, 50).toFixed(1),
    p95: +pct(frames, 95).toFixed(1),
    p99: +pct(frames, 99).toFixed(1),
    worst: +Math.max(...frames).toFixed(1),
    over33ms: frames.filter((f) => f > 33).length,
    over50ms: frames.filter((f) => f > 50).length,
    hitches,
  };
  console.log(`${key} CPU:`, results[key]);
  await page.close();
}

await mkdir('qa', { recursive: true });
await writeFile(
  'qa/perf.json',
  JSON.stringify(
    { date: new Date().toISOString(), viewport: '1440x900', gpu: launchOptions().args, results },
    null,
    2,
  ),
);
await browser.close();
await close();
