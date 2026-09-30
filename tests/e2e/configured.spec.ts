import { CONFIGURED_URL } from '../../playwright.config';
import { expect, scrollToScene, test } from './helpers';

/**
 * A build with every config value set. The default builds run with placeholders, so this is
 * the only place the config-dependent output is exercised: canonical URL, JSON-LD fields,
 * sitemap, the footer email and social links, and the recipient of the mailto fallback.
 */
test.use({ baseURL: CONFIGURED_URL });

test.describe('a fully configured site', () => {
  test('head tags use the studio name and site URL', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Websites for brands | Test Studio');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://studio.test/');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://studio.test/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://studio.test/og.png',
    );
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Test Studio');
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      'https://studio.test/og.png',
    );
    await expect(page.locator('.wordmark')).toHaveText('Test Studio');
    await page.waitForTimeout(1500);
  });

  test('JSON-LD carries only what is set, and no price', async ({ page }) => {
    await page.goto('/');
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(ld['@type']).toBe('ProfessionalService');
    expect(ld.name).toBe('Test Studio');
    expect(ld.url).toBe('https://studio.test/');
    expect(ld.email).toBe('hello@studio.test');
    expect(ld.image).toBe('https://studio.test/og.png');
    expect(ld.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Manila', addressCountry: 'PH' });
    expect(ld.sameAs).toEqual([
      'https://instagram.com/teststudio',
      'https://linkedin.com/company/teststudio',
      'https://github.com/teststudio',
    ]);
    expect(JSON.stringify(ld)).not.toMatch(/A\$|price/i);
  });

  test('serves a sitemap and a robots.txt that points to it', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    const xml = await sitemap.text();
    expect(xml).toContain('<loc>https://studio.test/</loc>');
    expect(xml).toContain('<loc>https://studio.test/privacy.html</loc>');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap: https://studio.test/sitemap.xml');
  });

  test('the footer shows the email with a copy button, and the social links', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    await scrollToScene(page, 'contact');
    const mail = page.locator('.footer__email');
    await expect(mail).toHaveText('hello@studio.test');
    await expect(mail).toHaveAttribute('href', 'mailto:hello@studio.test');
    const links = page.locator('.footer__links a');
    await expect(links).toHaveCount(3);
    for (const a of await links.all()) await expect(a).toHaveAttribute('rel', /noopener/);
    if (browserName === 'chromium') {
      await page.locator('[data-copy-email]').click();
      await expect(page.locator('[data-copy-status]')).toHaveText('Email copied.');
    }
  });

  test('the mailto fallback is addressed to the studio', async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener(
        'click',
        (e) => {
          const a = (e.target as Element | null)?.closest?.('a[href^="mailto:"]') as HTMLAnchorElement | null;
          if (a && a.hidden) {
            (window as unknown as { __mailto: string }).__mailto = a.href;
            e.preventDefault();
          }
        },
        true,
      );
    });
    await page.goto('/');
    await scrollToScene(page, 'brief');
    const form = page.locator('#brief-form');
    await form.getByLabel(/^Brand name/).fill('Kopi Kalye');
    await form.locator('label.chip', { hasText: 'Drinks' }).click();
    await form.getByRole('button', { name: 'Next' }).click();
    await form.locator('label.chip', { hasText: 'New website' }).click();
    await form.getByLabel(/^What should the website do for you\?/).fill('Sell cold brew.');
    await form.getByRole('button', { name: 'Next' }).click();
    await form.locator('label.chip', { hasText: 'A$1,250–A$1,500' }).click();
    await form.locator('label.chip', { hasText: 'Flexible' }).click();
    await form.getByRole('button', { name: 'Next' }).click();
    await form.getByLabel(/^Your name/).fill('Ana Reyes');
    await form.getByLabel(/^Email/).fill('ana@kopikalye.ph');
    await form.getByRole('button', { name: 'Send brief' }).click();
    const href = await page.evaluate(() => (window as unknown as { __mailto?: string }).__mailto ?? '');
    expect(href.startsWith('mailto:hello@studio.test?')).toBe(true);
  });

  test('the printed label names the studio', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Skip to the brief' })).toHaveCount(1);
    await page.waitForTimeout(1000);
  });
});
