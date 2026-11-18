// [r38] Проверка Service Worker на production-подобном HTTPS.
//
// Регистрация SW разрешена только в secure context, а тестовый сервер по
// умолчанию отдаёт HTTP на 127.0.0.1. Здесь тот же артефакт страниц поднимается
// по HTTP/2 с настоящим TLS-сертификатом (workflow генерирует self-signed),
// чтобы проверить именно тот путь, по которому SW едет в production.
//
// Запускается только когда задан SW_HTTPS_BASE, например
//   SW_HTTPS_BASE=https://127.0.0.1:4443 npx playwright test tests/diagnostics/sw-https.spec.js
const { test, expect } = require('@playwright/test');

const BASE = process.env.SW_HTTPS_BASE || '';
const enabled = Boolean(BASE);

test.describe('service worker over HTTPS', () => {
  test.skip(!enabled, 'diagnostic only: set SW_HTTPS_BASE to a TLS origin to run');

  test('sw.js is served over TLS with a JavaScript MIME type', async ({ playwright }) => {
    const request = await playwright.request.newContext({ ignoreHTTPSErrors: true });
    const response = await request.get(`${BASE}/sw.js`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
    const body = await response.text();
    expect(body).toContain("const CACHE_NAME = 'milovi-cake-");
    await request.dispose();
  });

  test('the worker registers, controls the page and precaches the release shell', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error && error.message || error)));

    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    const registration = await page.evaluate(async () => {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 20000)),
      ]);
      if (!reg) return { ready: false };
      return { ready: true, scope: reg.scope, active: reg.active ? reg.active.scriptURL : '' };
    });
    expect(registration.ready).toBe(true);
    expect(registration.scope).toBe(`${BASE}/`);

    await page.reload({ waitUntil: 'load' });
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    const cached = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const keys = await caches.keys();
      const name = keys.find((key) => key.startsWith('milovi-cake-'));
      if (!name) return { name: '', entries: [] };
      const cache = await caches.open(name);
      const requests = await cache.keys();
      return { name, entries: requests.map((request) => new URL(request.url).pathname) };
    });
    expect(cached.name).toMatch(/^milovi-cake-/);
    expect(cached.entries).toContain('/');
    expect(cached.entries.length).toBeGreaterThanOrEqual(20);

    // Offline navigation must be answered by the worker, not by the network.
    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#heroTitleBrand')).toHaveText('Milovi Cake');
    } finally {
      await context.setOffline(false);
    }

    expect(errors).toEqual([]);
    await context.close();
  });
});
