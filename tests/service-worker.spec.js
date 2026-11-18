// [r38] Отдельный интеграционный контракт Service Worker.
//
// Зачем: корзина и другие сценарии отказа исторически проверялись вместе с
// живой регистрацией SW. В тестовом окружении WebKit (HTTP на 127.0.0.1,
// многократные reload подряд) прерванная на навигации загрузка /sw.js иногда
// всплывает как pageerror «… due to access control checks» и роняет чужие
// контракты. Поэтому доставка SW проверяется здесь отдельно и по существу:
// заголовки, регистрация, precache и офлайн-навигация.
//
// Chromium-only по построению: compat-лейн запускает фиксированный набор
// grep-паттернов и эти тесты в него не попадают; в Chromium все проверки
// выполняются на реальном SW, без заглушек.
const { test, expect } = require('@playwright/test');

const CACHE_PATTERN = /const CACHE_NAME = '([^']+)'/;

test('service worker script is served correctly and registers on the release origin', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.request.get('/sw.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('javascript');
  expect(await response.text()).toContain("const CACHE_NAME = 'milovi-cake-");

  await page.goto('/', { waitUntil: 'load' });
  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: !!reg.active, scriptURL: reg.active ? reg.active.scriptURL : '' };
  });
  expect(registration.active).toBe(true);
  expect(registration.scope).toBe('http://127.0.0.1:4173/');
  expect(registration.scriptURL).toBe('http://127.0.0.1:4173/sw.js');

  // A controlled navigation proves the worker really owns the page.
  await page.reload({ waitUntil: 'load' });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(errors).toEqual([]);
});

test('service worker precaches the current release assets and serves offline navigation', async ({ page, context }) => {
  const sw = await (await page.request.get('/sw.js')).text();
  const cacheName = sw.match(CACHE_PATTERN)[1];

  await page.goto('/', { waitUntil: 'load' });
  const cached = await page.evaluate(async (name) => {
    await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    if (!keys.includes(name)) return { keys, entries: [] };
    const cache = await caches.open(name);
    const requests = await cache.keys();
    return { keys, entries: requests.map((request) => new URL(request.url).pathname) };
  }, cacheName);

  expect(cached.keys).toContain(cacheName);
  // The shell, the shared CSS/JS and the hero images are part of the precache list.
  for (const path of ['/', '/css/style.css', '/js/main.js', '/manifest.json']) {
    expect(cached.entries).toContain(path);
  }
  expect(cached.entries.length).toBeGreaterThanOrEqual(20);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#heroTitleBrand')).toHaveText('Milovi Cake');
    await expect(page.locator('.header-logo')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }

  // Back online the page keeps working and the worker stays in control.
  await page.reload({ waitUntil: 'load' });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});
