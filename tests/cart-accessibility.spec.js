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

test('cart opening does not steal focus from a quick interaction', async ({ page }) => {
  for (const route of ['/', '/prigorody/pushkin/']) {
    for (const confirm of [false, true]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const focus = await page.evaluate(async (showConfirm) => {
        addToCart(2);
        openCart();
        const clear = document.getElementById('cartClearBtn');
        clear.focus({ preventScroll: true });
        if (showConfirm) clear.click();
        const before = document.activeElement.id;
        // The drawer's initial focus task is scheduled for 100 ms; let it run.
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { before, after: document.activeElement.id };
      }, confirm);
      const expected = confirm ? 'cartClearNo' : 'cartClearBtn';
      expect(focus, `${route}, confirmation=${confirm}`).toEqual({ before: expected, after: expected });
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
      // Measure both real elements in one frame: the drawer may still be transitioning.
      const { control, bounds } = await card.evaluate((element, target) => {
        const rect = (node) => { const { x, width } = node.getBoundingClientRect(); return { x, width }; };
        return { control: rect(element.querySelector(target)), bounds: rect(element) };
      }, selector);
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

test('cart restoration rejects corrupt entries and preserves valid quantities', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const scenarios = [
    { saved: '{broken', quantities: [] },
    { saved: 'null', quantities: [] },
    { saved: '[]', quantities: [] },
    { saved: JSON.stringify({ '2': null, '4': { qty: 'oops' } }), quantities: [] },
    { saved: JSON.stringify({ '2': { qty: -3 }, '4': { qty: 0 }, '5': { qty: 2.5 }, '3': { qty: 3.25 }, '6': { qty: {} } }), quantities: [] },
    { saved: JSON.stringify({ '2': { qty: 1, fill: {} }, '4': { qty: 1e100 } }), quantities: [] },
    { saved: JSON.stringify({ '2:regular': { qty: 21 }, '1:regular': { qty: 2.5 }, '4': { qty: -1 } }), quantities: ['21 шт.', '2.5 кг'] },
    { saved: JSON.stringify({ '2:maxi': { qty: 3 } }), quantities: ['3 шт.'] },
  ];
  for (const { saved, quantities } of scenarios) {
    await page.evaluate((value) => localStorage.setItem('milovicake_cart', value), saved);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => openCart());
    await expect(page.locator('#cartDrawer .qty-val')).toHaveText(quantities);
    if (!quantities.length) await expect(page.locator('#cartDrawer .cart-empty')).toBeVisible();
    await expect(page.locator('#cartDrawer')).not.toContainText(/NaN|не число/);
  }
  // A valid quantity above the stepper limit can be created by repeated adds.
  await page.evaluate(() => localStorage.setItem('milovicake_cart', JSON.stringify({ '2:regular': { qty: 21 } })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => openCart());
  const item = page.locator('#cartDrawer .cart-item');
  await item.locator('.qty-btn:last-child').click();
  await expect(item.locator('.qty-val')).toHaveText('21 шт.');
  await item.locator('.qty-btn:first-child').click();
  await expect(item.locator('.qty-val')).toHaveText('20 шт.');
  expect(errors).toEqual([]);
});

test('cart restores unusual labels as text and keeps their controls functional', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const entry = { qty: 1, fill: `Начинка'\");window.__cartXss=1;//`, decor: '<img src=x onerror="window.__cartXss=2">' };
  await page.evaluate((value) => localStorage.setItem('milovicake_cart', JSON.stringify({ '2:regular': value })), entry);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => openCart());
  const item = page.locator('#cartDrawer .cart-item');
  await expect(item).toContainText(entry.decor);
  await expect(item.locator('.cart-item-info img')).toHaveCount(0);
  await item.locator('.qty-btn:last-child').click();
  await expect(item.locator('.qty-val')).toHaveText('2 шт.');
  expect(await page.evaluate(() => window.__cartXss)).toBeUndefined();
  expect(errors).toEqual([]);
});

for (const failure of ['QuotaExceededError', 'SecurityError']) {
  test(`cart stays usable and warns when storage throws ${failure}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((name) => {
      const write = Storage.prototype.setItem;
      window.__cartFaultAttempts = 0;
      window.__cartFaultClicks = 0;
      document.addEventListener('click', (event) => {
        if (event.target.closest('#card-2 .btn-add')) window.__cartFaultClicks++;
      }, true);
      Storage.prototype.setItem = function(key, value) {
        if (key === 'milovicake_cart') {
          window.__cartFaultAttempts++;
          throw new DOMException('Storage unavailable', name);
        }
        return write.call(this, key, value);
      };
    }, failure);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#card-2 .btn-add').click();
    try {
      await expect(page.locator('#cartBadge')).toHaveText('1');
      await expect(page.locator('#toast')).toBeVisible();
      await expect(page.locator('#toast')).toHaveAttribute('role', 'status');
      await expect(page.locator('#toast')).toContainText('Корзина не сохранится при обновлении');
    } catch (error) {
      const state = await page.evaluate(() => ({
        clicks: window.__cartFaultClicks, writes: window.__cartFaultAttempts,
        badge: document.querySelector('#cartBadge')?.textContent,
        toast: document.querySelector('#toast')?.outerHTML,
      }));
      throw new Error(`${error.message}\nStorage fault diagnostics: ${JSON.stringify({ ...state, errors })}`);
    }
    const bounds = await page.locator('#toast').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await page.evaluate(() => openCart());
    await expect(page.locator('#cartDrawer .qty-val')).toHaveText('1 шт.');
    await page.locator('#cartDrawer .qty-btn:last-child').click();
    await expect(page.locator('#cartDrawer .qty-val')).toHaveText('2 шт.');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => openCart());
    await expect(page.locator('#cartDrawer .cart-empty')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
