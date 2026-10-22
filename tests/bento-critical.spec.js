const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

for (const theme of ['light', 'dark']) {
  test(`bento ${theme}: first screen paints before full CSS without a layout jump`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('mc_theme', value);
      window.__preloadShifts = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) window.__preloadShifts += entry.value;
        });
      }).observe({ type: 'layout-shift', buffered: true });
    }, theme);
    // Hold only the shared CSS until we have measured the actual first-screen geometry.
    let releaseCss;
    const cssGate = new Promise((resolve) => { releaseCss = resolve; });
    await page.route('**/css/style.css?v=20261023r01', async (route) => {
      await cssGate;
      await route.continue();
    });
    await page.goto('/bento-torty/', { waitUntil: 'domcontentloaded' });
    const css = page.locator('link[href="/css/style.css?v=20261023r01"]');
    await expect(css).toHaveAttribute('rel', 'preload');
    await expect(page.locator('#bento-critical')).toHaveCount(1);
    const hero = page.locator('.lp-hero');
    const heading = hero.locator('h1');
    const lead = hero.locator('.lp-lead');
    const before = await page.evaluate(() => {
      const el = document.querySelector('.lp-hero h1');
      const visual = document.querySelector('.lp-visual');
      const lead = document.querySelector('.lp-lead');
      const rect = el.getBoundingClientRect();
      return {
        h1Y: rect.y, h1Height: rect.height,
        visualY: visual.getBoundingClientRect().y,
        leadY: lead.getBoundingClientRect().y,
        fontSize: getComputedStyle(el).fontSize,
      };
    });
    await expect(heading).toBeVisible();
    await expect(lead).toBeVisible();
    await expect(hero.locator('.lp-btn-primary')).toBeVisible();
    expect(before.fontSize).toMatch(/^(40|76)px$/);
    releaseCss();
    await expect(css).toHaveAttribute('rel', 'stylesheet');
    await expect.poll(() => css.evaluate((el) => !!el.sheet)).toBe(true);
    const after = await page.evaluate(() => {
      const el = document.querySelector('.lp-hero h1');
      return {
        h1Y: el.getBoundingClientRect().y,
        h1Height: el.getBoundingClientRect().height,
        visualY: document.querySelector('.lp-visual').getBoundingClientRect().y,
        leadY: document.querySelector('.lp-lead').getBoundingClientRect().y,
        shifts: window.__preloadShifts,
      };
    });
    for (const key of ['h1Y', 'h1Height', 'visualY', 'leadY']) {
      expect(Math.abs(after[key] - before[key]), `${key} must not shift when shared CSS arrives`).toBeLessThan(2);
    }
    expect(after.shifts).toBeLessThan(0.01);
    await expect(page.locator('.lp-visual img')).toHaveJSProperty('complete', true);
  });
}
