// Playwright smoke/visual QA for Milovi Cake static site.
// Dev-only tooling: no runtime dependency is added to the website.
const { defineConfig, devices } = require('@playwright/test');

const compatibility = process.env.MILOVI_BROWSER_COMPAT === '1';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    storageState: 'tests/analytics-denied.storage-state.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 20_000,
  },
  // The ordinary full QA remains Chromium-only. CI opts into a separate
  // cross-engine lane for the user-facing failure and accessibility contracts.
  grep: compatibility
    ? /cart restoration rejects|cart restores unusual|cart restores legacy conflicts|cart stays usable|cart merges matching|cart preserves different|cart refuses incompatible|cart keeps repeated|cart keeps the total honest|cart rejects a quantity|mobile calculator panel stays reachable|mobile calculator ignores a stale scroll|mobile calculator after fast scroll|mobile calculator resize clears|gallery lightbox with missing or late CDN assets|video strip fault handling|suburb links and page-specific resilience/
    : undefined,
  projects: compatibility ? [
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1100 } } },
    // Firefox cannot use Playwright's isMobile flag; test the narrow viewport instead.
    { name: 'firefox-mobile', use: { ...devices['Desktop Firefox'], viewport: { width: 390, height: 844 } } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1100 } } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ] : [
    {
      name: 'chromium-desktop',
      grepInvert: /@layout-matrix/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: 'chromium-mobile',
      grepInvert: /@layout-matrix/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'layout-matrix',
      grep: /@layout-matrix/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
  ],
});
