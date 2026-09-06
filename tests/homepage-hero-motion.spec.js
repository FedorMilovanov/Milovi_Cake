const { test, expect } = require('@playwright/test');

test.describe('homepage hero motion release contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test('keeps decorative hero motion out of initial homepage render until real intent', async ({ page }) => {
    await page.goto('/');

    const hero = page.locator('section.hero#home');
    const heroImage = page.locator('.hero-photo-bg img.hero-img');
    await expect(hero).toBeVisible();

    const initiallyReady = await hero.evaluate((element) => element.classList.contains('hero--motion-ready'));
    expect(initiallyReady).toBe(false);

    const initialAnimation = await heroImage.evaluate((element) => getComputedStyle(element).animationName);
    expect(initialAnimation).toBe('none');

    await page.locator('body').dispatchEvent('pointerdown', { pointerType: 'mouse', button: 0, isPrimary: true });
    await expect(hero).toHaveClass(/\bhero--motion-ready\b/);
    await expect.poll(
      () => heroImage.evaluate((element) => getComputedStyle(element).animationName),
    ).toBe('heroKenBurns');
  });

  test('preserves immediate decorative hero motion on non-home shared-runtime pages', async ({ page }) => {
    await page.goto('/prigorody/gatchina/');

    const hero = page.locator('section.hero#home');
    const heroImage = page.locator('.hero-photo-bg img').first();
    await expect(hero).toBeVisible();
    await expect(hero).toHaveClass(/\bhero--motion-ready\b/);
    await expect.poll(
      () => heroImage.evaluate((element) => getComputedStyle(element).animationName),
    ).toBe('heroKenBurns');
  });
});
