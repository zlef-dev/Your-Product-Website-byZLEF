import { readFile } from 'node:fs/promises';
import { expect, PNG_MAGIC, printBrand, scrollToScene, test } from './helpers';

test.describe('home page', () => {
  test('renders the hero with no console errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let’s build your brand’s website.');
    await expect(page.getByRole('link', { name: 'Try your brand on the can' })).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    // Give the stage time to boot so any late warning is caught.
    await page.waitForTimeout(2500);
  });

  test('typing a brand prints it and takes over the page', async ({ page }) => {
    await page.goto('/');
    await printBrand(page, 'Kopi Kalye', 'Lagoon');
    await expect(page).toHaveTitle(/^Kopi Kalye × /);
    await expect(page.locator('[data-footer-headline]')).toHaveText('Kopi Kalye. Launching soon.');
    await expect(page.locator('#f-brand')).toHaveValue('Kopi Kalye');
    await expect(page.locator('[data-brief-title]')).toHaveText('Let’s build Kopi Kalye’s website.');
  });

  test('choosing a colour updates --brand and --brand-ink', async ({ page }) => {
    await page.goto('/');
    await scrollToScene(page, 'try', 0.3);
    await page.locator('.swatch', { hasText: 'Citrus' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()),
      )
      .toBe('#F9A620');
    // Citrus is light, so the ink on it is process black.
    const ink = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--brand-ink').trim(),
    );
    expect(ink.toUpperCase()).toBe('#231F20');
  });

  test('"Download your can" produces a PNG', async ({ page }) => {
    await page.goto('/');
    await printBrand(page, 'Acme Tonic', 'Grape');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      page.locator('#try-form [data-download]').click(),
    ]);
    expect(download.suggestedFilename()).toBe('acme-tonic-can.png');
    const path = await download.path();
    const bytes = await readFile(path);
    expect([...bytes.subarray(0, 8)]).toEqual(PNG_MAGIC);
    expect(bytes.length).toBeGreaterThan(10_000);
  });

  test('the can turns with the keyboard and the Turn buttons', async ({ page }) => {
    await page.goto('/');
    await scrollToScene(page, 'try', 0.3);
    const spin = page.getByRole('slider', { name: /Your can/ });
    await page.waitForTimeout(1500);
    await spin.focus();
    await page.keyboard.press('ArrowRight');
    await expect(spin).toHaveAttribute('aria-valuenow', '15');
    await page.getByRole('button', { name: 'Turn left' }).click();
    await expect(spin).toHaveAttribute('aria-valuenow', '345');
  });

  test('"Start a brief" scrolls to the brief and moves focus to its heading', async ({ page }) => {
    await page.goto('/');
    await page.locator('.site-header').getByRole('link', { name: 'Start a brief' }).click();
    await expect(page.locator('[data-brief-title]')).toBeFocused({ timeout: 5000 });
  });

  test('the progress strip opens a scene index', async ({ page }) => {
    await page.goto('/');
    await page.locator('.progress__toggle').click();
    const nav = page.getByRole('navigation', { name: 'Scenes' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link')).toHaveCount(7);
    await nav.getByRole('link', { name: /What I build/ }).click();
    await expect(page.locator('#build-title')).toBeFocused({ timeout: 5000 });
  });

  test('the skip link is the first focusable element', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit only tabs to links with the macOS keyboard setting on');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to the brief' })).toBeFocused();
  });

  test('no network requests leave the site before a brief is sent', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname !== 'localhost' && u.protocol !== 'data:' && u.protocol !== 'blob:')
        external.push(r.url());
    });
    await page.goto('/');
    await printBrand(page, 'Offline Co');
    await scrollToScene(page, 'contact');
    await page.waitForTimeout(1000);
    expect(external).toEqual([]);
  });

  test('a link straight to #brief lands on the brief and says so', async ({ page }) => {
    await page.goto('/#brief');
    await expect(page.locator('[data-progress-label]')).toHaveText('Scene 6 of 7: The brief', {
      timeout: 15_000,
    });
    const top = await page.evaluate(() =>
      Math.round(document.getElementById('brief')!.getBoundingClientRect().top),
    );
    // WebKit re-applies its native anchor scroll after ours, honouring scroll-padding (88 px).
    expect(Math.abs(top)).toBeLessThan(100);
  });

  test('Tab reaches the footer through the pinned scenes with no trap, and focus stays on screen', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'WebKit only tabs to links with the macOS keyboard setting on');
    await page.goto('/');
    await page.waitForTimeout(2500);
    const offscreen: string[] = [];
    let reached = false;
    for (let i = 0; i < 70 && !reached; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect();
        return {
          label: (e.getAttribute('aria-label') || e.textContent || e.id || e.tagName).trim().slice(0, 30),
          visible: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
        };
      });
      if (!info) continue;
      if (!info.visible) offscreen.push(info.label);
      reached = info.label === 'Privacy';
    }
    expect(reached).toBe(true);
    expect(offscreen).toEqual([]);
  });

  test('the stage recovers from a lost WebGL context', async ({ page }) => {
    await page.goto('/?debug');
    await page.waitForTimeout(3000);
    const before = await page.evaluate(() => window.__stageFrames?.() ?? -1);
    expect(before).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => {
      const gl = (document.querySelector('canvas.stage-canvas') as HTMLCanvasElement).getContext('webgl2')!;
      const ext = gl.getExtension('WEBGL_lose_context')!;
      (window as unknown as { __lose: WEBGL_lose_context }).__lose = ext;
      ext.loseContext();
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext());
    await page.waitForTimeout(2500);
    // Nudge a redraw and confirm frames render again with a reflection environment in place.
    await page.evaluate(() => window.scrollBy(0, 40));
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => window.__stageFrames?.() ?? -1);
    expect(after).toBeGreaterThan(before);
    expect(await page.evaluate(() => !!window.__stageEnvironment?.())).toBe(true);
  });
});
