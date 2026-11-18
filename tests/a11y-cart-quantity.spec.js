const { test, expect } = require('@playwright/test');

for (const width of [390, 1440]) {
  test(`cart quantity retains keyboard focus after render and at max at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { addToCart(2); openCart(); });

    const row = page.locator('#cartDrawer .cart-item').first();
    const plus = row.locator('.qty-btn:last-child');
    await expect(plus).toBeVisible();
    await plus.focus();
    await page.keyboard.press('Space');
    await expect(row.locator('.qty-val')).toHaveText('2 шт.');
    await expect(plus).toBeFocused();

    // These are real keyboard activations, not element.click() injections.
    await page.keyboard.press('Space');
    await expect(row.locator('.qty-val')).toHaveText('3 шт.');
    await expect(plus).toBeFocused();

    // Reach the cart's actual 20-unit limit, retaining a stable action target.
    for (let qty = 4; qty <= 20; qty++) {
      await page.keyboard.press('Space');
      await expect(row.locator('.qty-val')).toHaveText(qty + ' шт.');
      await expect(plus).toBeFocused();
    }
    await expect(plus).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Space');
    await expect(row.locator('.qty-val')).toHaveText('20 шт.');
    await expect(page.locator('#toast')).toContainText('Максимум для этой позиции: 20 шт');
    await expect(plus).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(row.locator('.qty-btn:first-child')).toBeFocused();
  });

  test(`cart removes minimum row and focuses its recovery CTA at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { addToCart(2); openCart(); });
    const minus = page.locator('#cartDrawer .cart-item .qty-btn:first-child').first();
    await minus.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#cartDrawer .cart-empty')).toBeVisible();
    await expect(page.locator('#cartDrawer .cart-empty-cta')).toBeFocused();
  });
}
