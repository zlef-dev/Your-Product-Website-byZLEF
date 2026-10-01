import { expect, test as base, type Page } from '@playwright/test';

/**
 * WebKit (Playwright's Windows build) doesn't reuse a font preload that carries
 * `crossorigin`, which Chromium and Firefox require for fonts, so it re-fetches the font
 * and warns. The only message ignored anywhere, and only in WebKit (see QA.md).
 */
const WEBKIT_FONT_PRELOAD =
  /archivo-latin-wdth-normal-[\w-]+\.woff2 was preloaded using link preload but not used/;

/** Fails the test on any console error or warning, or uncaught page error. */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page, browserName }, use) => {
      const problems: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() !== 'error' && msg.type() !== 'warning') return;
        if (browserName === 'webkit' && WEBKIT_FONT_PRELOAD.test(msg.text())) return;
        problems.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
      await use(problems);
      expect(problems, 'console errors or warnings').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Scrolls a scene into view (works with or without pins and smooth scrolling). */
export async function scrollToScene(page: Page, id: string, fraction = 0): Promise<void> {
  await page.evaluate(
    ([id, fraction]) => {
      const el = document.getElementById(id as string);
      if (!el) return;
      const spacer = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : null;
      const top = (spacer ?? el).getBoundingClientRect().top + scrollY;
      const range = spacer ? spacer.offsetHeight - innerHeight : 0;
      window.scrollTo(0, Math.round(top + range * (fraction as number)));
    },
    [id, fraction],
  );
  await page.waitForTimeout(300);
}

/** Replaces WebGL with nothing, the way a browser without it behaves. */
export async function disableWebGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

/** Types a brand into the try-it panel and prints it. */
export async function printBrand(page: Page, name: string, colour = 'Lagoon'): Promise<void> {
  await scrollToScene(page, 'try', 0.3);
  await page.getByLabel('Brand name', { exact: true }).fill(name);
  await page.locator('.swatch', { hasText: colour }).click();
  await page.getByLabel('Brand name', { exact: true }).press('Enter');
  await expect(page.locator('[data-print-status]')).toHaveText(`Printed: ${name}`, { timeout: 30_000 });
}

export const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

declare global {
  interface Window {
    __stageFrames?: () => number;
    __stageEnvironment?: () => boolean;
    __stageTarget?: () => { wash: number; rise: number; lineup: number };
    __timelineCheck?: () => { time: number; proxy: number; briefMode: boolean; diffs: string[] };
  }
}
