/**
 * node scripts/icons.mjs
 * Renders public/favicon.svg to the 180 px public/apple-touch-icon.png.
 */
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile('public/favicon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
await page.setContent(
  `<body style="margin:0;background:#F1F2EE"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="180" height="180"></body>`,
);
await page.waitForTimeout(200);
await page.screenshot({ path: 'public/apple-touch-icon.png', omitBackground: false });
await browser.close();
console.log('Wrote public/apple-touch-icon.png');
