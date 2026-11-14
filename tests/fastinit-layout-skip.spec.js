// [P100] Deterministic first-paint layout skip — behavioural contracts.
// The inline head snippet adds `mc-fast-init` (content-visibility:auto for
// below-fold sections) and removes it two frames after first-contentful-paint
// with hard fallbacks. These tests pin the engagement, the deterministic
// removal, the exact final geometry and the mobile-sheet section highlight.
const { test, expect } = require('@playwright/test');

test.describe('[P100] first-paint layout skip', () => {
  test('skips below-fold layout at first paint, then restores exact geometry', async ({ page }) => {
    await page.addInitScript(() => {
      window.__mcFastInitSeen = false;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__mcFastInitSeen = document.documentElement.classList.contains('mc-fast-init');
      }));
    });
    await page.goto('/', { waitUntil: 'load' });

    expect(await page.evaluate(() => window.__mcFastInitSeen)).toBe(true);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('mc-fast-init')), {
        timeout: 4000,
      })
      .toBe(false);

    // Geometry must be identical once restored: two late samples, no drift.
    const first = await page.evaluate(() => ({
      h: Math.round(document.querySelector('#reviews').getBoundingClientRect().height),
      s: document.documentElement.scrollHeight,
    }));
    await page.waitForTimeout(600);
    const second = await page.evaluate(() => ({
      h: Math.round(document.querySelector('#reviews').getBoundingClientRect().height),
      s: document.documentElement.scrollHeight,
    }));
    expect(second).toEqual(first);
    expect(first.h).toBeGreaterThan(100); // restored real layout, not an empty shell
  });

  test('suburb page restores geometry too', async ({ page }) => {
    await page.goto('/prigorody/gatchina/', { waitUntil: 'load' });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('mc-fast-init')), {
        timeout: 4000,
      })
      .toBe(false);
    const heights = await page.evaluate(() => {
      const samples = [];
      const take = () => samples.push(document.documentElement.scrollHeight);
      take();
      return new Promise((resolve) => {
        setTimeout(() => { take(); resolve(samples); }, 600);
      });
    });
    expect(heights[1]).toBe(heights[0]);
    expect(heights[0]).toBeGreaterThan(5000);
  });

  test('more-sheet marks the current section row when opened', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('mc-fast-init')))
      .toBe(false);

    // Move the viewport so #contacts is the most visible section (the sheet
    // lists tail anchors: #contacts is rendered as a row on the homepage).
    await page.evaluate(() => {
      const el = document.querySelector('#contacts');
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
    });
    await page.waitForTimeout(300);

    const sheet = page.locator('#mcSheet');
    if (await sheet.count() === 0) test.skip(true, 'sheet UI is not part of this layout');
    await page.locator('#mcMoreBtn').click({ force: true });
    await expect(sheet).toHaveClass(/mc-open/);
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const row = document.querySelector('#mcSheet .mc-row-anchor[href="#contacts"]');
          return row ? row.getAttribute('aria-current') : 'missing';
        });
      })
      .toBe('location');
    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveClass(/mc-open/);
  });

  test('anchor jump during the skip window lands at the same offset as after load', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const a = document.querySelector('a[href="#catalog"]');
      if (a) a.click();
    });
    await page.waitForTimeout(1200);
    const early = await page.evaluate(() => Math.round(document.querySelector('#catalog').getBoundingClientRect().top));

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const a = document.querySelector('a[href="#catalog"]');
      if (a) a.click();
    });
    await page.waitForTimeout(1200);
    const late = await page.evaluate(() => Math.round(document.querySelector('#catalog').getBoundingClientRect().top));

    expect(Math.abs(late - early)).toBeLessThanOrEqual(2);
  });
});
