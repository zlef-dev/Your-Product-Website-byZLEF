import { expect, test } from './helpers';

test('the 404 page renders', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page is out of stock.');
  await expect(page.getByText('The can you’re after isn’t on this shelf.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the shelf' })).toHaveAttribute('href', '/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  // The squeezed headline: the wdth axis at its narrowest.
  const stretch = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontStretch);
  expect(stretch).toBe('62%');
  await page.waitForTimeout(1500);
});

test('the privacy page renders', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy');
  await expect(page.getByText(/This site doesn’t use cookies or analytics/)).toBeVisible();
});

test('meta tags and JSON-LD carry no placeholders', async ({ page }) => {
  await page.goto('/');
  const head = await page.locator('head').innerHTML();
  expect(head).not.toMatch(/\[[^\]]*(studio|example|URL|domain)[^\]]*\]/i);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(ld['@type']).toBe('ProfessionalService');
  expect(ld.address.addressLocality).toBe('Manila');
  expect(ld.address.addressCountry).toBe('PH');
  expect(JSON.stringify(ld)).not.toMatch(/A\$|price/i);
  await expect(page).toHaveTitle('Websites for brands');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Cinematic, fast websites for brands, designed and built by an independent studio in Manila, Philippines.',
  );
});
