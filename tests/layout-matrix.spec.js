const { test, expect } = require('@playwright/test');

const WIDTHS = [360, 390, 414, 561, 600, 768, 900, 1024];
const THEMES = ['light', 'dark'];
// final-fixes.css intentionally uses a 94% opaque mobile app-shell surface.
// Keep the guard aligned with that design token while still rejecting transparency regressions.
const MIN_MOBILE_NAV_ALPHA = 0.94;

function overlaps(a, b, tolerance = 2) {
  return !(
    a.x + a.width <= b.x + tolerance ||
    b.x + b.width <= a.x + tolerance ||
    a.y + a.height <= b.y + tolerance ||
    b.y + b.height <= a.y + tolerance
  );
}

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test(`@layout-matrix home ${width}px ${theme}: no camel-rule regressions`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('mc_theme', selectedTheme);
      }, theme);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-card');

      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      const cards = page.locator('.product-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        if (!(await card.isVisible())) continue;
        const button = card.locator('.btn-add');
        const price = card.locator('.price');
        if (await button.isVisible()) {
          const fit = await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
          expect(fit).toBeTruthy();
        }
        if (await button.isVisible() && await price.isVisible()) {
          const buttonBox = await button.boundingBox();
          const priceBox = await price.boundingBox();
          expect(buttonBox).not.toBeNull();
          expect(priceBox).not.toBeNull();
          expect(overlaps(buttonBox, priceBox)).toBeFalsy();
        }
      }

      const visibleLegacyNavs = await page.locator('#bottomNav:visible, #mrBottomNav:visible, .mobile-sticky-order:visible').count();
      if (width <= 768) {
        expect(visibleLegacyNavs).toBe(0);
        const mcNav = page.locator('#mcNav');
        await expect(mcNav).toBeVisible();
        const alpha = await mcNav.evaluate((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          const match = bg.match(/rgba?\(([^)]+)\)/i);
          if (!match) return 1;
          const parts = match[1].split(',').map((part) => part.trim());
          return parts.length < 4 ? 1 : Number(parts[3]);
        });
        expect(alpha).toBeGreaterThanOrEqual(MIN_MOBILE_NAV_ALPHA);
      }
    });
  }
}
