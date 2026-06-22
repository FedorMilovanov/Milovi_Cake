// Playwright smoke/visual QA for Milovi Cake static site.
// Dev-only tooling: no runtime dependency is added to the website.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
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
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
});
