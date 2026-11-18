const { test, expect } = require('@playwright/test');
// Use Playwright's native no-JavaScript fixture. Creating nested contexts under
// Firefox's existing worker can deadlock the test runner on Windows.
test.use({ javaScriptEnabled: false, serviceWorkers: 'block' });

test('catalog remains actionable with JavaScript disabled and real source prices', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
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
