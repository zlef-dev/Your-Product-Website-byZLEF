import { readFile } from 'node:fs/promises';
import { disableWebGL, expect, PNG_MAGIC, printBrand, scrollToScene, test } from './helpers';

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows static scenes in normal flow and prints instantly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/is-reduced/);
    await page.waitForTimeout(1000);
    // No pinning, no smooth scrolling.
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/is-motion/);
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
    // Every process step is on the page at once, as a list.
    await scrollToScene(page, 'process');
    for (const title of ['Brief', 'Direction', 'Design', 'Build', 'Launch']) {
      await expect(page.locator('.step-card__title', { hasText: title })).toBeVisible();
    }
    // All four line-up captions show together.
    await scrollToScene(page, 'lineup');
    await expect(page.locator('.lineup__caption')).toHaveCount(4);
    for (const c of await page.locator('.lineup__caption').all()) await expect(c).toBeVisible();
    // The print run is instant.
    await scrollToScene(page, 'try');
    await page.locator('#brand-name').fill('Still Life');
    const t0 = Date.now();
    await page.locator('#brand-name').press('Enter');
    await expect(page.locator('[data-print-status]')).toHaveText('Printed: Still Life', { timeout: 5000 });
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  test('skips the press-check intro', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-press-check]')).toHaveClass(/is-skipped/);
  });
});

test.describe('without WebGL', () => {
  test('shows the SVG can, still prints and still downloads', async ({ page }) => {
    await disableWebGL(page);
    await page.goto('/');
    await expect(page.locator('canvas.stage-canvas')).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(/no-webgl/, { timeout: 10_000 });
    await expect(page.locator('[data-slot="top"] .fallback-can')).toBeVisible();
    await printBrand(page, 'Flat Pack', 'Mint');
    await expect(page.locator('[data-slot="try"] .fallback-can')).toBeVisible();
    await expect(page).toHaveTitle(/^Flat Pack × /);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      page.locator('#try-form [data-download]').click(),
    ]);
    expect(download.suggestedFilename()).toBe('flat-pack-can.png');
    const bytes = await readFile(await download.path());
    expect([...bytes.subarray(0, 8)]).toEqual(PNG_MAGIC);
  });
});
