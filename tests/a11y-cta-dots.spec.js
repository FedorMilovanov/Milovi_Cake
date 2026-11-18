const { test, expect } = require('@playwright/test');

// Regression: light-theme CTA lost its keyboard ring to an !important cascade
// rule; mouse hover and high contrast must not hide keyboard modality.
for (const width of [390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`hero CTA exposes a visible keyboard ring at ${width}px in ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((requestedTheme) => {
        try { localStorage.setItem('mc_theme', requestedTheme); } catch (_) {}
        document.documentElement.setAttribute('data-theme', requestedTheme);
      }, theme);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const cta = page.locator('.hero .btn-primary.btn-primary--hero').first();
      await expect(cta).toBeVisible();
      await cta.focus();
      // Re-enter the CTA via keyboard, not just a JS-applied :focus class.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(cta).toBeFocused();
      await expect.poll(() => cta.evaluate((el) => {
        const style = getComputedStyle(el);
        return el.matches(':focus-visible') && style.outlineStyle !== 'none'
          && parseFloat(style.outlineWidth) >= 2 && parseFloat(style.outlineOffset) >= 5;
      })).toBe(true);
      await cta.hover();
      await expect(cta).toBeFocused();
      await expect.poll(() => cta.evaluate((el) => {
        const s = getComputedStyle(el);
        return el.matches(':focus-visible') && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
      })).toBe(true);
    });
  }
}

for (const width of [390, 1440]) {
  test(`high-contrast hero focus ring stays visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ contrast: 'more' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const cta = page.locator('.hero .btn-primary.btn-primary--hero').first();
    await cta.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(cta).toBeFocused();
    const computed = await cta.evaluate(el => ({
      focusVisible: el.matches(':focus-visible'),
      width: parseFloat(getComputedStyle(el).outlineWidth),
      style: getComputedStyle(el).outlineStyle,
    }));
    expect(computed.focusVisible).toBe(true);
    expect(computed.width).toBeGreaterThanOrEqual(2);
    expect(computed.style).not.toBe('none');
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`catalog photo dots have 24px hit targets and remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const dots = page.locator('#slider-1 .slide-dots button.dot');
    await expect(dots).toHaveCount(6);
    await dots.first().scrollIntoViewIfNeeded();
    const bounds = await dots.evaluateAll((elements) => elements.map((button) => {
      const b = button.getBoundingClientRect();
      const center = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return {
        width: b.width, height: b.height, left: b.left, right: b.right,
        actualHit: center === button || button.contains(center),
      };
    }));
    for (const box of bounds) {
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.actualHit).toBe(true);
    }
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i - 1].right).toBeLessThanOrEqual(bounds[i].left + 0.5);
    }
    await dots.nth(1).click();
    await expect(dots.nth(1)).toHaveClass(/active/);
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
    await dots.nth(2).focus();
    await page.keyboard.press('Enter');
    await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
  });
}
