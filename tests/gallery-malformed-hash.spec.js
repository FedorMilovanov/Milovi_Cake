const { test, expect } = require('@playwright/test');

for (const fragment of ['#%', '#%E0%A4%A', '#%ZZ']) {
  test(`malformed gallery deep-link ${fragment} never breaks initialization`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/gallery/' + fragment, { waitUntil: 'domcontentloaded' });
    const cards = page.locator('#galleryGrid .card');
    await expect(cards.first()).toBeVisible();
    await cards.first().click();
    await expect(page.locator('#lbRoot')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lbRoot')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('valid gallery deep-link still opens the requested item', async ({ page }) => {
  await page.goto('/gallery/#p01', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lbRoot')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#lbRoot')).toHaveCount(0);
});
