import { defineConfig, devices } from '@playwright/test';

/**
 * Two production builds are served:
 *   :4174  built with a test Web3Forms key (the API itself is always mocked)
 *   :4175  built without a key, for the mailto fallback
 */
export const KEY_URL = 'http://localhost:4174';
export const NOKEY_URL = 'http://localhost:4175';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  use: {
    baseURL: KEY_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command:
        'npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4174 --strictPort',
      url: KEY_URL,
      env: { VITE_WEB3FORMS_KEY: 'e2e-test-key' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command:
        'npx vite build --outDir dist-e2e-nokey && npx vite preview --outDir dist-e2e-nokey --port 4175 --strictPort',
      url: NOKEY_URL,
      env: { VITE_WEB3FORMS_KEY: '' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
