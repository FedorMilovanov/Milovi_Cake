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

test('@gallery phone card media policy: measured cards use conditional AVIF and LCP stays full-size', async ({ page }) => {
  const optimizedIds = ['p05', 'p06', 'p09', 'p12', 'p18'];
  const phoneMedia = '(max-width: 430px) and (max-resolution: 1.75dppx)';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#galleryGrid [data-id="p18"] img.card-media');
  expect(await page.evaluate((q) => matchMedia(q).matches, phoneMedia)).toBeTruthy();
  for (const id of optimizedIds) {
    const number = id.slice(1);
    const card = page.locator(`#galleryGrid [data-id="${id}"]`);
    await expect(card.locator('img.card-media')).toHaveAttribute('src', `/img/gallery/gallery-${number}.webp`);
    const sources = card.locator('source[type="image/avif"]');
    await expect(sources).toHaveCount(2);
    await expect(sources.nth(0)).toHaveAttribute('media', phoneMedia);
    await expect(sources.nth(0)).toHaveAttribute('srcset', `/img/gallery/gallery-${number}-card.avif`);
    await expect(sources.nth(1)).toHaveAttribute('srcset', `/img/gallery/gallery-${number}.avif`);
  }
  const lcpCard = page.locator('#galleryGrid [data-id="p01"]');
  await expect(lcpCard.locator('source[type="image/avif"]')).toHaveCount(1);
  await expect(lcpCard.locator('source[type="image/avif"]')).toHaveAttribute('srcset', '/img/gallery/gallery-01.avif');
  await page.setViewportSize({ width: 900, height: 900 });
  expect(await page.evaluate((q) => matchMedia(q).matches, phoneMedia)).toBeFalsy();
});
