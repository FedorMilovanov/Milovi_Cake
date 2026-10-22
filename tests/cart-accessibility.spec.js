const { test, expect } = require('@playwright/test');

function luminance(rgb) {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(`Cannot measure color: ${rgb}`);
  const [r, g, b] = match.slice(1, 4).map((value) => {
    const n = Number(value) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function contrast(page, selector) {
  const { foreground, background } = await page.locator(selector).first().evaluate((element) => {
    const foreground = getComputedStyle(element).color;
    for (let node = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
        return { foreground, background: color };
      }
    }
    throw new Error('No opaque background found');
  });
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('home calculator hints retain AA contrast in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((mode) => { localStorage.setItem('mc_theme', mode); }, theme);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const selector of ['.calc-type-card.selected .calc-type-hint',
      '.calc-type-card:not(.selected) .calc-type-hint', '#guestsPopup',
      '.hero .btn-primary--hero', '#fillSheetSelect']) {
      expect(await contrast(page, selector), `${theme} ${selector}`).toBeGreaterThanOrEqual(4.5);
    }
    await page.locator('.hero .btn-primary--hero').hover();
    await page.waitForTimeout(360); // contrast after its background transition
    expect(await contrast(page, '.hero .btn-primary--hero'), `${theme} CTA hover`).toBeGreaterThanOrEqual(4.5);
  }
});

test('suburb calculator and contact labels retain AA contrast', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((mode) => { localStorage.setItem('mc_theme', mode); }, theme);
    await page.goto('/prigorody/pushkin/', { waitUntil: 'domcontentloaded' });
    for (const selector of ['.calc-type-card.selected .calc-type-hint',
      '.contact-primary-label']) {
      expect(await contrast(page, selector), `${theme} ${selector}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('clear-cart confirmation is themed, labelled and keyboard-contained', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((mode) => { localStorage.setItem('mc_theme', mode); }, theme);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => addToCart(2));
    const trigger = page.locator(testInfo.project.name === 'chromium-mobile'
      ? '#mcNav .mc-btn--order' : '#cartBtn');
    await trigger.click();
    await page.locator('#cartClearBtn').click();
    const confirm = page.locator('#cartClearConfirm');
    await expect(confirm).toHaveAttribute('role', 'alertdialog');
    await expect(confirm).toHaveAccessibleName('Очистить корзину?');
    await expect(confirm.locator('svg')).toHaveCount(1);
    await expect(confirm.locator('#cartClearNo')).toBeFocused();
    for (const selector of ['#cartClearNo', '#cartClearYes']) {
      expect(await contrast(page, selector), `${theme} ${selector}`).toBeGreaterThanOrEqual(4.5);
    }
    await page.keyboard.press('Shift+Tab');
    await expect(confirm.locator('#cartClearYes')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(confirm.locator('#cartClearNo')).toBeFocused();
    await confirm.locator('#cartClearNo').click();
    await expect(confirm).toHaveCount(0);
    await expect(page.locator('#cartClearBtn')).toBeFocused();
    await page.locator('#cartClearBtn').click();
    await confirm.locator('#cartClearYes').click();
    await expect(page.locator('#cartDrawer .cart-empty-cta')).toBeFocused();
    await expect(page.locator('#cartClearBtn')).toBeHidden();
    await page.locator('#cartDrawer .cart-close').click();
  }
});

test('cart quantity and remove controls fit at narrow and desktop widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { addToCart(2); openCart(); });
    const card = page.locator('#cartDrawer .cart-item');
    await expect(card).toBeVisible();
    for (const selector of ['.qty-ctrl .qty-btn:last-child', '.cart-item-right .del-btn']) {
      const control = await card.locator(selector).boundingBox();
      const bounds = await card.boundingBox();
      expect(control.x, `${width}px ${selector} left`).toBeGreaterThanOrEqual(bounds.x - 1);
      expect(control.x + control.width, `${width}px ${selector} right`).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    }
    await card.locator('.qty-ctrl .qty-btn:last-child').click();
    await expect(card.locator('.qty-val')).toHaveText('2 шт.');
    await card.locator('.del-btn').click();
    await expect(page.locator('#cartDrawer .cart-empty')).toBeVisible();
  }
});

for (const theme of ['light', 'dark']) {
  for (const route of ['/', '/prigorody/pushkin/']) {
    test(`${route} ${theme}: cart keeps focus outside when closed and AA copy when open`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((mode) => { localStorage.setItem('mc_theme', mode); }, theme);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const drawer = page.locator('#cartDrawer');
      const mobile = testInfo.project.name === 'chromium-mobile';
      const trigger = page.locator(mobile ? '#mcNav .mc-btn--order' : '#cartBtn');
      if (route !== '/') await expect(page.locator('.cart-btn')).toHaveCount(0);
      let scrollBefore = 0;
      if (mobile) {
        await page.locator('#catalog').scrollIntoViewIfNeeded();
        scrollBefore = await page.evaluate(() => window.scrollY);
        expect(scrollBefore).toBeGreaterThan(0);
      }
      await expect(trigger).toBeVisible();
      await expect(drawer).toHaveAttribute('inert', '');
      await expect(drawer).toHaveAttribute('aria-hidden', 'true');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(drawer).toHaveAttribute('aria-hidden', 'false');
      await expect(drawer).not.toHaveAttribute('inert', '');
      await expect(drawer).toHaveAttribute('aria-labelledby', 'cartDrawerTitle');
      await expect(drawer.locator('.cart-close')).toBeFocused();
      const visibleBox = await drawer.boundingBox();
      expect(visibleBox.y, `${route} drawer must stay on screen after scroll`).toBeGreaterThanOrEqual(-1);
      expect(visibleBox.y).toBeLessThan(mobile ? 20 : 200);
      if (mobile) {
        expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
        expect(await page.evaluate(() => document.body.dataset.lockCount)).toBe('1');
      }

      for (const selector of ['#step1 span', '#step2 span', '#step3 span', '.cart-empty-message', '.cart-empty-cta']) {
        expect(await contrast(page, selector), `${route} ${theme} ${selector}`).toBeGreaterThanOrEqual(4.5);
      }

      await page.evaluate(() => addToCart(2));
      await expect(drawer.locator('select')).toHaveAccessibleName('Начинка:');
      for (const selector of [
        '.cart-item-info button', '.cart-item-info .item-price',
        '#cartStep1Footer button', '#cartStep1Footer p',
      ]) {
        expect(await contrast(page, selector), `${route} ${theme} ${selector}`).toBeGreaterThanOrEqual(4.5);
      }

      await drawer.locator('.cart-close').click();
      await expect(drawer).toHaveAttribute('aria-hidden', 'true');
      await expect(drawer).toHaveAttribute('inert', '');
      await expect(trigger).toBeFocused();
      expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(false);
      await page.keyboard.press('Enter'); // reopen before the closing animation timer fires
      await expect(drawer).toHaveAttribute('aria-hidden', 'false');
      await expect(drawer).not.toHaveAttribute('inert', '');
      await expect(drawer.locator('.cart-close')).toBeFocused();
      await drawer.locator('.cart-close').click();
      await expect(trigger).toBeFocused();
      await expect(drawer).toHaveAttribute('inert', '');
      if (mobile) {
        expect(await page.evaluate(() => document.body.dataset.lockCount)).toBe('0');
        expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scrollBefore, 0);
      }
    });
  }
}
