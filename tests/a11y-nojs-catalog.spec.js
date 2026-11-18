const { test, expect } = require('@playwright/test');

// A script failure must not leave the premium catalog looking permanently busy.
for (const width of [390, 1440]) {
  test(`no-JavaScript catalog has real prices and accessible contact at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false, viewport: { width, height: 900 },
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
      const catalog = page.locator('#catalogGrid .catalog-nojs');
      await expect(catalog).toBeVisible();
      await expect(page.locator('#catalogGrid .skeleton-card').first()).toBeHidden();
      await expect(catalog.locator('li')).toHaveCount(8);
      for (const expected of ['2 800 ₽/кг', '1 600 ₽', '3 000 ₽', '5 000 ₽/кг', '2 500 ₽', '350 ₽/шт.']) {
        await expect(catalog).toContainText(expected);
      }
      await expect(catalog.getByRole('link', { name: /посмотреть реальные работы/i }))
        .toHaveAttribute('href', '/gallery/');
      const whatsapp = catalog.getByRole('link', { name: /WhatsApp/i });
      await expect(whatsapp).toHaveAttribute('href', 'https://wa.me/79119038886');
      await expect(whatsapp).toHaveAttribute('rel', /noopener/);
      await expect(catalog.getByRole('link', { name: /911 903-88-86/ }))
        .toHaveAttribute('href', 'tel:+79119038886');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    } finally {
      await context.close();
    }
  });
}
