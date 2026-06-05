const { test, expect } = require('@playwright/test');

test.describe('Mobile layout overlap smoke tests', () => {
  test.use({ viewport: { width: 390, height: 800 } }); // Force mobile size

  test('catalog cards do not have price and button overlapping on mobile', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Give the product cards time to render if they are populated dynamically
    await page.waitForSelector('.product-card');

    const cards = page.locator('.product-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      if (await card.isVisible()) {
        const price = card.locator('.price');
        const btn = card.locator('.btn-add');

        if (await price.isVisible() && await btn.isVisible()) {
          const priceBox = await price.boundingBox();
          const btnBox = await btn.boundingBox();

          expect(priceBox).not.toBeNull();
          expect(btnBox).not.toBeNull();

          // Under our vertical stack layout on mobile, the button is positioned strictly below the price.
          // This assertion guarantees that they do not overlap vertically or horizontally.
          expect(btnBox.y).toBeGreaterThanOrEqual(priceBox.y + priceBox.height - 2);
        }
      }
    }
  });
});
