const { test, expect } = require('@playwright/test');

test('wedding messenger hit targets stay invisible at rest and round on keyboard focus', async ({ page }) => {
  await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });

  const icons = page.locator('.wed-wrap .wed-contact-links a.btn-hero-messenger');
  await expect(icons).toHaveCount(6);

  for (let i = 0; i < 6; i++) {
    const icon = icons.nth(i);
    const normal = await icon.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        shadow: s.boxShadow,
        radius: s.borderRadius,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      };
    });
    expect(normal.background).toBe('rgba(0, 0, 0, 0)');
    expect(normal.shadow).toBe('none');
    expect(normal.radius).toBe('50%');
    expect(normal.width).toBeGreaterThanOrEqual(44);
    expect(normal.height).toBeGreaterThanOrEqual(44);

    await page.keyboard.press('Tab');
    await icon.focus();
    await expect.poll(() => icon.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    const focused = await icon.evaluate((el) => ({
      radius: getComputedStyle(el).borderRadius,
      outline: getComputedStyle(el).outlineStyle,
    }));
    expect(focused.radius).toBe('50%');
    expect(focused.outline).not.toBe('none');
    await icon.evaluate((el) => el.blur());
  }
});
