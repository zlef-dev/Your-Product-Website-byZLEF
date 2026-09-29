import type { Page } from '@playwright/test';
import { NOKEY_URL } from '../../playwright.config';
import { expect, scrollToScene, test } from './helpers';

const ENDPOINT = 'https://api.web3forms.com/submit';

async function openBrief(page: Page, base = '') {
  await page.goto(`${base}/`);
  await scrollToScene(page, 'brief');
}

async function fillAllSteps(page: Page) {
  const form = page.locator('#brief-form');
  await form.getByLabel(/^Brand name/).fill('Kopi Kalye');
  await form.getByRole('radio', { name: 'Drinks' }).check({ force: true });
  await form.getByRole('button', { name: 'Next' }).click();
  await form.getByRole('checkbox', { name: 'New website' }).check({ force: true });
  await form.getByLabel(/^What should the website do for you\?/).fill('Sell cold brew subscriptions online.');
  await form.getByRole('button', { name: 'Next' }).click();
  await form.getByRole('radio', { name: 'A$1,250–A$1,500' }).check({ force: true });
  await form.getByRole('radio', { name: 'In 1–2 months' }).check({ force: true });
  await form.getByRole('button', { name: 'Next' }).click();
  await form.getByLabel(/^Your name/).fill('Ana Reyes');
  await form.getByLabel(/^Email/).fill('ana@kopikalye.ph');
}

test.describe('the brief form', () => {
  test('shows linked, summarised errors and focuses the first invalid field', async ({ page }) => {
    await openBrief(page);
    const form = page.locator('#brief-form');
    await form.getByRole('button', { name: 'Next' }).click();
    const brand = form.getByLabel(/^Brand name/);
    await expect(brand).toBeFocused();
    await expect(brand).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#f-brand-error')).toHaveText('Enter your brand name.');
    await expect(brand).toHaveAttribute('aria-describedby', /f-brand-error/);
    await expect(page.locator('[data-summary]')).toBeVisible();
    await expect(page.locator('[data-summary-title]')).toHaveText('Fix 2 things to continue:');
    await expect(page.locator('#f-does-error')).toHaveText('Choose what your brand does.');
  });

  test('validates on blur, not while typing', async ({ page }) => {
    await openBrief(page);
    const email = page.locator('#f-email');
    await expect(email).toBeHidden();
    await page.locator('#f-current').fill('not a link');
    await expect(page.locator('#f-current-error')).toBeHidden();
    await page.locator('#f-current').blur();
    await expect(page.locator('#f-current-error')).toHaveText('Enter a link like example.com or an @handle.');
  });

  test('moves between steps by keyboard, focusing and announcing each step', async ({ page }) => {
    await openBrief(page);
    const form = page.locator('#brief-form');
    await form.getByLabel(/^Brand name/).fill('Kopi Kalye');
    await form.getByRole('radio', { name: 'Drinks' }).focus();
    await page.keyboard.press('Space');
    await form.getByRole('button', { name: 'Next' }).focus();
    await page.keyboard.press('Enter');
    await expect(form.locator('[data-step="1"] > legend')).toBeFocused();
    await expect(page.locator('[data-step-status]')).toHaveText('Step 2 of 4: The website');
    await expect(page.locator('[data-stamp="0"] [data-stamp-mark]')).toBeVisible();
    await form.getByRole('button', { name: 'Back' }).focus();
    await page.keyboard.press('Enter');
    await expect(form.locator('[data-step="0"] > legend')).toBeFocused();
    await expect(page.locator('[data-step-status]')).toHaveText('Step 1 of 4: The brand');
  });

  test('shows the price only in the details step', async ({ page }) => {
    await openBrief(page);
    const note = page.locator('[data-price-note]');
    await expect(note).toHaveCount(1);
    await expect(note).toBeHidden();
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('A$1,250');
    const form = page.locator('#brief-form');
    await form.getByLabel(/^Brand name/).fill('Kopi Kalye');
    await form.getByRole('radio', { name: 'Drinks' }).check({ force: true });
    await form.getByRole('button', { name: 'Next' }).click();
    await form.getByRole('checkbox', { name: 'Landing page' }).check({ force: true });
    await form.getByLabel(/^What should the website do for you\?/).fill('Launch a product.');
    await form.getByRole('button', { name: 'Next' }).click();
    await expect(note).toBeVisible();
    await expect(note).toHaveText(/Most websites I build land between A\$1,250 and A\$1,500/);
    await expect(page.locator('main [data-price-note]')).toHaveCount(1);
  });

  test('sends the brief to Web3Forms and shows the success message', async ({ page }) => {
    let payload: Record<string, unknown> | null = null;
    await page.route(ENDPOINT, async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
    await openBrief(page);
    await fillAllSteps(page);
    await page.locator('#brief-form').getByRole('button', { name: 'Send brief' }).click();
    const result = page.locator('[data-result]');
    await expect(result).toBeVisible();
    await expect(result).toBeFocused();
    await expect(result).toContainText('Brief sent. I’ll reply within one business day');
    await expect(page.locator('[data-result-job]')).toHaveText(/Your job number is JT-\d{6}-\d{3}\./);
    expect(payload).not.toBeNull();
    const p = payload as unknown as Record<string, unknown>;
    expect(p.access_key).toBe('e2e-test-key');
    expect(p.email).toBe('ana@kopikalye.ph');
    expect(p.subject).toMatch(/^New website brief: Kopi Kalye, A\$1,250–A\$1,500 \(JT-\d{6}-\d{3}\)$/);
    expect(p.label_colour).toMatch(/^#[0-9A-F]{6}$/);
    expect(p.needs).toBe('New website');
  });

  test('keeps everything typed when sending fails, and says what to do', async ({ page }) => {
    // Web3Forms refuses a submission with success: false (a mocked HTTP error status would
    // make the browser itself log "Failed to load resource"; the network-error path is
    // covered by the sendBrief unit tests).
    await page.route(ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid access key' }),
      }),
    );
    await openBrief(page);
    await fillAllSteps(page);
    await page.locator('#brief-form').getByRole('button', { name: 'Send brief' }).click();
    const error = page.locator('[data-send-error]');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/The brief didn’t send\. Check your connection and try again/);
    await expect(page.locator('#f-email')).toHaveValue('ana@kopikalye.ph');
    await expect(page.locator('[data-result]')).toBeHidden();
  });

  test('without a key, "Send brief" opens a pre-filled email draft', async ({ page }) => {
    await page.addInitScript(() => {
      // Record the mailto: link instead of launching an email app.
      document.addEventListener(
        'click',
        (e) => {
          const a = (e.target as Element | null)?.closest?.('a[href^="mailto:"]') as HTMLAnchorElement | null;
          if (a) {
            (window as unknown as { __mailto: string }).__mailto = a.href;
            e.preventDefault();
          }
        },
        true,
      );
    });
    await openBrief(page, NOKEY_URL);
    await fillAllSteps(page);
    await expect(page.locator('[data-mailto-note]')).toHaveText(
      'Your email app will open with the brief filled in.',
    );
    await expect(page.getByRole('button', { name: 'Copy brief' })).toBeVisible();
    await page.locator('#brief-form').getByRole('button', { name: 'Send brief' }).click();
    const href = await page.evaluate(() => (window as unknown as { __mailto?: string }).__mailto ?? '');
    expect(href.startsWith('mailto:')).toBe(true);
    const url = new URL(href);
    expect(url.searchParams.get('subject')).toMatch(
      /^New website brief: Kopi Kalye, A\$1,250–A\$1,500 \(JT-/,
    );
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('Brand name: Kopi Kalye');
    expect(body).toContain('Email: ana@kopikalye.ph');
    await expect(page.locator('[data-form-status]')).toContainText('Your email app should open');
  });
});
