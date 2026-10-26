const { test, expect } = require('@playwright/test');

async function prepare(page, consent) {
  await page.addInitScript((choice) => {
    if (!sessionStorage.getItem('milovi-test-consent-seeded')) {
      if (choice === null) localStorage.removeItem('milovi_analytics_consent_v1');
      else localStorage.setItem('milovi_analytics_consent_v1', choice);
      sessionStorage.setItem('milovi-test-consent-seeded', '1');
    }
    window.__vitalEvents = [];
    window.gtag = (...args) => window.__vitalEvents.push(args);
    window.ym = () => {};
  }, consent);
  const vendors = [];
  await page.route(/(googletagmanager\.com|mc\.yandex\.ru)/, (route) => {
    vendors.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  return vendors;
}

const vitalEvents = (page) => page.evaluate(() => window.__vitalEvents.filter(
  ([command, name]) => command === 'event' && name === 'web_vital_lcp'));

test('first-visit bento LCP is buffered but sent exactly once only after opt-in', async ({ page }) => {
  const vendors = await prepare(page, null);
  await page.goto('/bento-torty/', { waitUntil: 'load' });
  await expect(page.locator('.mc-consent-overlay')).toHaveClass(/is-open/);
  expect(vendors).toEqual([]);
  expect(await vitalEvents(page)).toEqual([]);

  await page.locator('.mc-consent-button--allow').click();
  await expect.poll(async () => (await vitalEvents(page)).length).toBe(1);
  const [[, , metric]] = await vitalEvents(page);
  expect(metric).toMatchObject({
    lcp_page: 'bento', lcp_consent: 'granted_on_visit', lcp_release: 'unverified',
  });
  expect(metric.lcp_ms).toBeGreaterThan(0);
  expect(metric.lcp_ms).toBeLessThan(30_000);
  expect(metric.lcp_ttfb_ms).toBeGreaterThanOrEqual(0);
  expect(metric.lcp_navigation).toBe('navigate');
  expect(metric.lcp_element).toMatch(/^(hero|other)$/);
  expect(Object.keys(metric).every((key) => /^lcp_/.test(key))).toBe(true);
  expect(JSON.stringify(metric)).not.toContain('bento_1-mobile');
  expect(JSON.stringify(metric)).not.toContain('http:');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await vitalEvents(page)).toHaveLength(1);
  expect(vendors.some((url) => url.includes('googletagmanager.com'))).toBe(true);
});

test('denied homepage never starts analytics or sends a performance event', async ({ page }) => {
  const vendors = await prepare(page, 'denied');
  await page.goto('/', { waitUntil: 'load' });
  await page.evaluate(() => {
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(vendors).toEqual([]);
  expect(await vitalEvents(page)).toEqual([]);
  await expect(page.locator('script[data-milovi-ga]')).toHaveCount(0);
});

test('grant on an unrelated page does not create an LCP event', async ({ page }) => {
  await prepare(page, 'granted');
  await page.goto('/privacy/', { waitUntil: 'load' });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await vitalEvents(page)).toEqual([]);
});

test('revoking consent before LCP finalization never sends an event', async ({ page }) => {
  await prepare(page, 'granted');
  await page.goto('/', { waitUntil: 'load' });
  const reloaded = page.waitForEvent('load');
  await page.evaluate(() => setTimeout(() => window.MiloviConsent.deny(), 0));
  await reloaded;
  expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBe('denied');
  expect(await vitalEvents(page)).toEqual([]);
});

test('an entry after an earlier hidden state is not a visible-load LCP', async ({ page }) => {
  // Simulate a foreground return after an earlier hidden paint: consent may be
  // granted after that transition, so a new observer alone cannot see it.
  await page.addInitScript(() => {
    const entries = performance.getEntriesByType.bind(performance);
    performance.getEntriesByType = (type) => type === 'visibility-state' ?
      [{ name: 'hidden', startTime: 0 }] : entries(type);
    window.__rawLcp = [];
    new PerformanceObserver((list) => {
      window.__rawLcp.push(...list.getEntries().map((entry) => entry.startTime));
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await prepare(page, 'granted');
  await page.goto('/bento-torty/', { waitUntil: 'load' });
  await expect.poll(() => page.evaluate(() => window.__rawLcp.length)).toBeGreaterThan(0);
  await page.locator('.lp-visual img').click({ force: true });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await vitalEvents(page)).toEqual([]);
});

test('prerendered pages do not misreport pre-activation time as visible LCP', async ({ page }) => {
  // Headless CI does not reliably prerender tabs; simulate Navigation Timing
  // activation while retaining a real browser LCP candidate.
  await page.addInitScript(() => {
    const entries = performance.getEntriesByType.bind(performance);
    performance.getEntriesByType = (type) => type === 'navigation' ?
      entries(type).map((entry) => ({ activationStart: 100 })) : entries(type);
    window.__rawLcp = [];
    new PerformanceObserver((list) => {
      window.__rawLcp.push(...list.getEntries().map((entry) => entry.startTime));
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await prepare(page, 'granted');
  await page.goto('/', { waitUntil: 'load' });
  await expect.poll(() => page.evaluate(() => window.__rawLcp.length)).toBeGreaterThan(0);
  await page.locator('.hero-img').click({ force: true });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await vitalEvents(page)).toEqual([]);
});

test('returning opt-in homepage sends a single LCP when interaction ends it', async ({ page }) => {
  await prepare(page, 'granted');
  await page.goto('/', { waitUntil: 'load' });
  await page.evaluate(() => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
  });
  await page.waitForTimeout(100); // The former pointerdown reporter finalized on a 0-ms timer.
  expect(await vitalEvents(page)).toEqual([]);
  await page.locator('.hero-img').click({ force: true });
  await expect.poll(async () => (await vitalEvents(page)).length).toBe(1);
  const [[, , metric]] = await vitalEvents(page);
  expect(metric.lcp_page).toBe('home');
  expect(metric.lcp_consent).toBe('previously_granted');
  expect(metric.lcp_ms).toBeGreaterThan(0);
  if (metric.lcp_resource_end_ms !== undefined) {
    expect(metric.lcp_resource_end_ms).toBeGreaterThanOrEqual(0);
    expect(metric.lcp_resource_end_ms).toBeLessThanOrEqual(metric.lcp_ms + 1);
  }
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await vitalEvents(page)).toHaveLength(1);
});
