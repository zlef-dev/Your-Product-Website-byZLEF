import { spawnSync } from 'node:child_process';
import { defineConfig, devices, firefox } from '@playwright/test';

/**
 * Two production builds are served:
 *   :4174  built with a test Web3Forms key (the API itself is always mocked)
 *   :4175  built without a key, for the mailto fallback
 */
/** Chromium renders WebGL on the GPU (ANGLE) unless SOFTWARE_GL=1; see scripts/lib/browser.mjs. */
const angle = process.platform === 'win32' ? 'd3d11' : process.platform === 'darwin' ? 'metal' : 'gl';
const gpuArgs = process.env.SOFTWARE_GL === '1' ? [] : ['--enable-gpu', '--ignore-gpu-blocklist', `--use-angle=${angle}`];

/**
 * Some Windows machines can't start Playwright's Firefox build ("side-by-side configuration
 * is incorrect"). Rather than fail every Firefox test there, check once and say so.
 */
function firefoxRuns(): boolean {
  try {
    const r = spawnSync(firefox.executablePath(), ['--version'], { timeout: 20_000, encoding: 'utf8' });
    return r.status === 0 && /firefox/i.test(r.stdout ?? '');
  } catch {
    return false;
  }
}
// Checked once in the main process; test workers inherit the answer through the environment.
if (process.env.PW_FIREFOX_OK === undefined) {
  process.env.PW_FIREFOX_OK = process.env.PW_SKIP_FIREFOX !== '1' && firefoxRuns() ? '1' : '0';
  if (process.env.PW_FIREFOX_OK === '0') {
    console.warn('[e2e] Firefox cannot start on this machine; running Chromium and WebKit only.');
  }
}
const withFirefox = process.env.PW_FIREFOX_OK === '1';

export const KEY_URL = 'http://localhost:4174';
export const NOKEY_URL = 'http://localhost:4175';

export default defineConfig({
  testDir: 'tests/e2e',
  // WebGL in software (WebKit, CI without a GPU) is slow; generous waits keep runs stable.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: KEY_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: gpuArgs } } },
    ...(withFirefox ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
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
