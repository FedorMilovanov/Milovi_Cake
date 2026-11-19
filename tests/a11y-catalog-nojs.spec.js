const { test, expect } = require('@playwright/test');
// Put the no-JS contract first in each engine's suite so its browser context
// is created before media-heavy/cart stress tests. This keeps Firefox's real
// disabled-JavaScript test, with no skips or weakened assertions.
// Use native Playwright context fixtures, not nested browser.newContext().
// A real no-JavaScript session has no analytics storage to restore. Firefox
// can deadlock the context or fail teardown if Playwright restores inherited
// localStorage while recording a video from this static no-JS session.
// Keep screenshot/trace diagnostics and all actual content/layout assertions.
test.use({ javaScriptEnabled: false, serviceWorkers: 'block', video: 'off', storageState: { cookies: [], origins: [] } });

test('catalog remains actionable with JavaScript disabled and real source prices', async ({ page }) => {
  // The no-JS fallback is visible from HTML before stylesheets finish loading.
  // DOMContentLoaded alone can see the intrinsic 1440px hero-image width on
  // slower Linux WebKit runners. Assess final, fully-styled responsive layout.
  await page.goto('/', { waitUntil: 'load' });
  await expect.poll(() => page.evaluate(() =>
    !!document.querySelector('link[href*="css/final-fixes.css"]')?.sheet &&
    !!document.querySelector('link[href*="css/style.css"]')?.sheet
  ), { timeout: 10000 }).toBe(true);
  const fallback = page.locator('.catalog-nojs');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(fallback).toBeVisible();
    await expect(fallback.locator('li')).toHaveCount(6);
    await expect(fallback).toContainText('2 800 ₽/кг');
    await expect(fallback).toContainText('1 600 ₽/шт.');
    await expect(fallback.locator('a')).toHaveAttribute('href','/zakazat-tort-spb/');
    await expect(page.locator('#catalogGrid .skeleton-card').first()).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});
