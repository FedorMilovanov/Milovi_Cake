const { test, expect } = require('@playwright/test');

async function denyAnalytics(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('milovi_analytics_consent_v1', 'denied'); } catch (_) {}
  });
}

test('calculator summary and add-to-cart keep a usable desktop width', async ({ page }) => {
  await denyAnalytics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#calcType .calc-type-card.selected').click();

  const layout = await page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { x: rect.x, right: rect.right, width: rect.width, height: rect.height };
    };
    const summary = box('#calcSummary');
    const row = box('.calc-add-row');
    const button = box('.calc-add-btn');
    const values = [...document.querySelectorAll('#calcSummary .calc-summary-chip')].map((chip) => {
      const chipBox = chip.getBoundingClientRect();
      const labelBox = chip.querySelector('.chip-label').getBoundingClientRect();
      const valueBox = chip.querySelector('.chip-val').getBoundingClientRect();
      return {
        width: chipBox.width,
        labelRight: labelBox.right,
        valueLeft: valueBox.left,
        valueRight: valueBox.right,
        text: chip.textContent.trim(),
      };
    });
    return { summary, row, button, label: box('.calc-add-btn-label'), values };
  });

  expect(layout.summary.width).toBeGreaterThan(200);
  expect(layout.row.width).toBeGreaterThan(200);
  expect(layout.button.width).toBeGreaterThan(150);
  expect(layout.label.width).toBeGreaterThan(120);
  expect(layout.values.length).toBeGreaterThan(2);
  for (const chip of layout.values) {
    expect(chip.valueLeft).toBeGreaterThanOrEqual(chip.labelRight - 1);
    expect(chip.valueRight).toBeLessThanOrEqual(chip.width + layout.summary.x + 2);
    expect(chip.text).not.toMatch(/:\s*$/);
  }
});

test('mobile app bar and calculator dock keep the shared safe, non-clipping geometry', async ({ page }) => {
  await denyAnalytics(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#mcNav').waitFor({ state: 'attached' });
  await page.locator('#calcType .calc-type-card.selected').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#calcType .calc-type-card.selected').click();
  await expect(page.locator('body')).toHaveClass(/mc-dock-shown/);
  await page.waitForTimeout(550);

  const closed = await page.evaluate(() => {
    const nav = document.querySelector('#mcNav').getBoundingClientRect();
    const panel = document.querySelector('#calcRightCol').getBoundingClientRect();
    const strip = document.querySelector('#calcCollapsedBar').getBoundingClientRect();
    const text = document.querySelector('.calc-result-collapsed-main').getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    return {
      nav: { x: nav.x, y: nav.y, right: nav.right, bottom: nav.bottom },
      panel: { x: panel.x, y: panel.y, right: panel.right, bottom: panel.bottom, height: panel.height },
      strip: { y: strip.y, bottom: strip.bottom }, textBottom: text.bottom,
      side: parseFloat(root.getPropertyValue('--mc-nav-side')),
      gap: parseFloat(root.getPropertyValue('--mc-nav-gap')),
      overlap: parseFloat(root.getPropertyValue('--mc-dock-overlap')),
    };
  });
  expect(Math.abs(closed.nav.x - closed.side)).toBeLessThanOrEqual(1);
  expect(Math.abs(390 - closed.nav.right - closed.side)).toBeLessThanOrEqual(1);
  expect(Math.abs(844 - closed.nav.bottom - closed.gap)).toBeLessThanOrEqual(1);
  expect(Math.abs(closed.panel.x - closed.nav.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(closed.panel.right - closed.nav.right)).toBeLessThanOrEqual(1);
  expect(closed.panel.height).toBeLessThanOrEqual(120);
  expect(Math.abs(closed.nav.y - closed.panel.bottom + closed.overlap)).toBeLessThanOrEqual(1.5);
  expect(closed.textBottom).toBeLessThanOrEqual(closed.nav.y + 1);

  await page.locator('#calcCollapsedBar').click();
  await expect(page.locator('body')).toHaveClass(/calc-panel-open/);
  await expect(page.locator('.calc-add-btn')).toBeVisible();
  await page.waitForTimeout(550);
  const open = await page.evaluate(() => {
    const nav = document.querySelector('#mcNav').getBoundingClientRect();
    const add = document.querySelector('.calc-add-row').getBoundingClientRect();
    const label = document.querySelector('.calc-add-btn-label').getBoundingClientRect();
    const backTop = document.querySelector('.back-to-top');
    return {
      navY: nav.y, addBottom: add.bottom, labelWidth: label.width, labelRight: label.right,
      backTopOpacity: getComputedStyle(backTop).opacity,
      backTopPointerEvents: getComputedStyle(backTop).pointerEvents,
    };
  });
  expect(open.addBottom).toBeLessThanOrEqual(open.navY + 1);
  expect(open.labelWidth).toBeGreaterThan(120);
  expect(open.labelRight).toBeLessThanOrEqual(390);
  expect(open.backTopOpacity).toBe('0');
  expect(open.backTopPointerEvents).toBe('none');
});

test('decor choices stay centered at phone and tablet widths', async ({ page }) => {
  await denyAnalytics(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  for (const width of [375, 390, 530, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.locator('#calcDecor').evaluate((row) => {
      const rowBox = row.getBoundingClientRect();
      const options = [...row.querySelectorAll('.calc-opt')].map((option) => option.getBoundingClientRect());
      const first = options[0];
      const last = options[options.length - 1];
      return {
        rowCenter: (rowBox.left + rowBox.right) / 2,
        choicesCenter: (first.left + last.right) / 2,
        choices: options.map((box) => ({ left: box.left, right: box.right })),
      };
    });
    expect(geometry.choices).toHaveLength(2);
    expect(Math.abs(geometry.choicesCenter - geometry.rowCenter), `decor centering at ${width}px`).toBeLessThanOrEqual(2);
  }
});

test('mobile review card remains centered and inside its frame when entering reviews', async ({ page }) => {
  await denyAnalytics(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#reviews').scrollIntoViewIfNeeded();
  const card = page.locator('.review-slide.active .review-card');
  await expect(card).toBeVisible();
  await page.waitForTimeout(1200);

  for (const width of [390, 530, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(150);
    const stable = await page.evaluate(() => ({
      fieldDisplay: getComputedStyle(document.querySelector('#reviews .sc-field')).display,
      filmstripDisplay: getComputedStyle(document.querySelector('.review-filmstrip')).display,
      liveLetterNodes: document.querySelectorAll('.review-slide.active .pl').length,
      card: document.querySelector('.review-slide.active .review-card').getBoundingClientRect(),
      stage: document.querySelector('#stage').getBoundingClientRect(),
    }));
    expect(stable.fieldDisplay, `decorative screenshot cloud at ${width}px`).toBe('none');
    expect(stable.filmstripDisplay, `review filmstrip at ${width}px`).not.toBe('none');
    expect(stable.liveLetterNodes, `review text should not scatter at ${width}px`).toBe(0);
    expect(Math.abs((stable.card.left + stable.card.right) / 2 - (stable.stage.left + stable.stage.right) / 2), `card centering at ${width}px`).toBeLessThanOrEqual(2);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => {
    const card = document.querySelector('.review-slide.active .review-card').getBoundingClientRect();
    const stage = document.querySelector('#stage').getBoundingClientRect();
    const text = document.querySelector('.review-slide.active .review-text').getBoundingClientRect();
    return {
      cardLeft: card.left,
      cardRight: card.right,
      stageCenter: (stage.left + stage.right) / 2,
      cardCenter: (card.left + card.right) / 2,
      textLeft: text.left,
      textRight: text.right,
      cardWidth: card.width,
    };
  });
  expect(Math.abs(geometry.cardCenter - geometry.stageCenter)).toBeLessThanOrEqual(2);
  expect(geometry.cardLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.cardRight).toBeLessThanOrEqual(390);
  expect(geometry.textLeft).toBeGreaterThanOrEqual(geometry.cardLeft);
  expect(geometry.textRight).toBeLessThanOrEqual(geometry.cardRight);
  expect(geometry.cardWidth).toBeGreaterThan(280);

  await page.locator('#btnNext').click();
  await page.waitForTimeout(450);
  const nextSlide = await page.evaluate(() => {
    const card = document.querySelector('.review-slide.active .review-card').getBoundingClientRect();
    const stage = document.querySelector('#stage').getBoundingClientRect();
    const text = document.querySelector('.review-slide.active .review-text').getBoundingClientRect();
    return {
      cardCenter: (card.left + card.right) / 2,
      stageCenter: (stage.left + stage.right) / 2,
      cardRight: card.right,
      textRight: text.right,
      cardWidth: card.width,
      reviewText: document.querySelector('.review-slide.active .review-text').textContent.trim(),
    };
  });
  expect(nextSlide.reviewText.length).toBeGreaterThan(10);
  expect(Math.abs(nextSlide.cardCenter - nextSlide.stageCenter)).toBeLessThanOrEqual(2);
  expect(nextSlide.textRight).toBeLessThanOrEqual(nextSlide.cardRight);
  expect(nextSlide.cardRight).toBeLessThanOrEqual(390);
});
