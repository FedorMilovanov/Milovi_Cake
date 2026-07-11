const { test, expect } = require('@playwright/test');

const themePages = [
  '/',
  '/gallery/',
  '/zakazat-tort-spb/',
  '/svadebnye-torty/',
  '/bento-torty/',
  '/dostavka-i-oplata/',
  '/otzyvy/',
];

async function applyTheme(page, theme) {
  await page.addInitScript((value) => {
    localStorage.setItem('mc_theme', value);
    document.documentElement.setAttribute('data-theme', value);
  }, theme);
}

function luminance(rgb) {
  const channels = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!channels) return null;
  const values = [Number(channels[1]), Number(channels[2]), Number(channels[3])].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrastRatio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) return null;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

async function effectiveBg(locator) {
  return locator.evaluate((el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  });
}

test.describe('light/dark UI smoke', () => {
  for (const theme of ['light', 'dark']) {
    for (const path of themePages) {
      test(`${path} ${theme} theme is readable and stable`, async ({ page }) => {
        await applyTheme(page, theme);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        // Gallery populates and lazy-loads a dense grid after module boot; give visible images time to settle.
        if (path === '/gallery/') await page.waitForTimeout(900);

        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('body')).not.toContainText('Пн–Вс');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(4);

        // Main/gallery have intentional image-overlaid hero/editorial treatments; do not confuse
        // design overlays with contrast bugs. For landing/trust pages, guard basic h1 readability.
        if (!['/', '/gallery/'].includes(path)) {
          const h1 = page.locator('h1').first();
          const colors = await h1.evaluate((el) => ({ color: getComputedStyle(el).color }));
          const bg = await effectiveBg(h1);
          const ratio = contrastRatio(colors.color, bg);
          if (ratio !== null) expect(ratio).toBeGreaterThan(2.6);
        }

        // Check only images that are actually in/near the current viewport. Offscreen lazy images
        // are valid and should not be classified as UI bugs. Genuinely hidden images (e.g. the
        // placeholder <img> inside a closed lightbox overlay, which is visibility:hidden when idle)
        // are not user-visible and must not be flagged as broken.
        const brokenImages = await page.locator('img').evaluateAll((imgs) => {
          const vh = window.innerHeight;
          const isVisible = (el) => {
            for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
              const cs = getComputedStyle(node);
              if (cs.visibility === 'hidden' || cs.display === 'none') return false;
            }
            return true;
          };
          return imgs
            .filter((img) => {
              const rect = img.getBoundingClientRect();
              return img.getAttribute('src') && rect.width > 20 && rect.bottom > -50 && rect.top < vh + 250 && isVisible(img);
            })
            .filter((img) => !img.complete || img.naturalWidth < 20)
            .map((img) => img.getAttribute('src'));
        });
        expect(brokenImages).toEqual([]);
      });
    }
  }
});
