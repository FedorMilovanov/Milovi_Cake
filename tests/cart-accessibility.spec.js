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

test('selected calculator decor retains contrast in both themes', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: testInfo.project.name.endsWith('mobile') ? 390 : 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  for (const route of ['/', '/prigorody/pushkin/']) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate((mode) => localStorage.setItem('mc_theme', mode), theme);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      for (let index = 0; index < 2; index++) {
        const option = page.locator('#calcDecor .calc-opt').nth(index);
        if (index) {
          await option.focus();
          await page.keyboard.press('Enter');
        }
        await expect(option).toHaveClass(/selected/);
        // Measure the settled selected state, not a transient mid-transition color.
        await option.evaluate(async (el) => {
          await new Promise(requestAnimationFrame);
          await Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
        });
        // Axe leaves gradient contrast incomplete; evaluate both opaque stops.
        await expect.poll(async () => {
          const sample = await option.evaluate((el) => {
            const background = getComputedStyle(el);
            const label = getComputedStyle(el.querySelector('.opt-label'));
            return { foreground: label.webkitTextFillColor || label.color,
              image: background.backgroundImage, color: background.backgroundColor };
          });
          const colors = sample.image === 'none' ? [sample.color] : (sample.image.match(/rgba?\([^)]*\)/g) || []);
          if (!colors.length || (sample.image !== 'none' && colors.length < 2)) throw new Error('Recheck decor gradient contrast');
          return Math.min(...colors.map((background) => {
            const alpha = background.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
            if (alpha && Number(alpha[1]) < 1) throw new Error('Recheck translucent decor contrast');
            const values = [luminance(sample.foreground), luminance(background)].sort((a, b) => b - a);
            return (values[0] + 0.05) / (values[1] + 0.05);
          }));
        }, { message: `${route} ${theme} decor option ${index}` }).toBeGreaterThanOrEqual(4.5);
        if (index) {
          const hint = page.locator('#calcDecorHint');
          await expect(hint).toHaveClass(/visible/);
          await expect.poll(() => hint.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
          expect(await contrast(page, '#calcDecorHint'), `${route} ${theme} decor hint`).toBeGreaterThanOrEqual(4.5);
        }
      }
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
    const drawer = page.locator('#cartDrawer');
    const card = page.locator('#cartDrawer .cart-item');
    await expect(card).toBeVisible();
    // The drawer animates in with `transform: translateX(<viewport width>)` and stays
    // offset for ~100ms after openCart(). Two separate boundingBox() calls can then
    // straddle that transition and be reported in different coordinate spaces, which
    // looked like an overflowing control. Wait for the transform to settle and read
    // both boxes in one frame so the containment check stays atomic.
    await expect(drawer).toHaveClass(/open/);
    await drawer.evaluate((element) => new Promise((resolve, reject) => {
      let frames = 0;
      const settled = () => {
        const value = getComputedStyle(element).transform;
        if (value === 'none') return resolve(true);
        const matrix = new DOMMatrixReadOnly(value);
        if (Math.abs(matrix.m41) < 0.5 && Math.abs(matrix.m42) < 0.5) return resolve(true);
        if ((frames += 1) > 180) return reject(new Error('cart drawer never settled its transform'));
        return requestAnimationFrame(settled);
      };
      settled();
    }));
    for (const selector of ['.qty-ctrl .qty-btn:last-child', '.cart-item-right .del-btn']) {
      // Read both real elements in the same frame after the drawer settles.
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
  const pending = new Map();
  const failed = [];
  const requestLabel = (request) => {
    const url = new URL(request.url());
    return `${request.resourceType()} ${url.origin}${url.pathname}`;
  };
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => pending.set(request, requestLabel(request)));
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => {
    pending.delete(request);
    failed.push(`${requestLabel(request)}: ${request.failure()?.errorText || 'unknown'}`);
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const reloadCart = async (saved, scenario) => {
    await page.evaluate((value) => localStorage.setItem('milovicake_cart', value), saved);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
    } catch (error) {
      const diagnostic = { scenario, url: page.url(), pending: [...pending.values()].slice(0, 20), pendingCount: pending.size, failed: failed.slice(-10), errors };
      throw new Error(`${error.message}\nCart reload diagnostics: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
  };
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
  for (const [index, { saved, quantities }] of scenarios.entries()) {
    await reloadCart(saved, `scenario ${index + 1}/${scenarios.length}`);
    await page.evaluate(() => openCart());
    await expect(page.locator('#cartDrawer .qty-val')).toHaveText(quantities);
    if (!quantities.length) await expect(page.locator('#cartDrawer .cart-empty')).toBeVisible();
    await expect(page.locator('#cartDrawer')).not.toContainText(/NaN|не число/);
  }
  // A valid quantity above the stepper limit can be created by repeated adds.
  await reloadCart(JSON.stringify({ '2:regular': { qty: 21 } }), 'stepper');
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
      window.__cartFaultEvents = [];
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        document.addEventListener(type, (event) => {
          if (type === 'click' && event.target.closest('#card-2 .btn-add')) window.__cartFaultClicks++;
          const card = document.getElementById('card-2');
          const button = card?.querySelector('.btn-add');
          const measure = (element) => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          };
          const pointerBoundary = type === 'pointerdown' || type === 'pointerup';
          window.__cartFaultEvents.push({
            type, time: Math.round(performance.now()), trusted: event.isTrusted,
            target: event.target?.id || event.target?.className || event.target?.nodeName,
            card: event.target?.closest?.('.product-card')?.id || '',
            x: event.clientX, y: event.clientY, scrollY: window.scrollY,
            buttonRect: pointerBoundary ? measure(button) : null,
            cardRect: pointerBoundary ? measure(card) : null,
            cardClass: pointerBoundary ? card?.className : null,
            cardTransform: pointerBoundary && card ? getComputedStyle(card).transform : null,
            buttonTransform: pointerBoundary && button ? getComputedStyle(button).transform : null,
            fonts: pointerBoundary ? document.fonts?.status : null,
          });
          if (window.__cartFaultEvents.length > 20) window.__cartFaultEvents.shift();
        }, true);
      }
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
        events: window.__cartFaultEvents, documentHasFocus: document.hasFocus(),
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

async function openCartByUser(page, testInfo) {
  const mobile = testInfo.project.name.endsWith('-mobile');
  const trigger = page.locator(mobile ? '#mcNav .mc-btn--order' : '#cartBtn');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator('#cartDrawer')).toHaveAttribute('aria-hidden', 'false');
}

test('cart merges matching fillings without losing quantity or the checkout total', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { window.__cartHandoffs = []; window.open = (url) => { window.__cartHandoffs.push(url); return {}; }; });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#card-2 .btn-add').click();
  await openCartByUser(page, testInfo);
  await page.locator('#cartDrawer .cart-item select').selectOption({ label: 'Малина' });
  for (let i = 0; i < 19; i++) await page.locator('#cartDrawer .cart-item .qty-btn:last-child').click();
  await page.locator('#cartDrawer .cart-close').click();
  await page.locator('#card-2 .btn-add').click();
  await openCartByUser(page, testInfo);
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText(['20 шт.', '1 шт.']);
  await page.locator('#cartDrawer .cart-item').last().locator('select').selectOption({ label: 'Малина' });
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText(['21 шт.']);
  await expect(page.locator('#cartDrawer .cart-inline-total')).toContainText(/33\s?600\s*₽/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openCartByUser(page, testInfo);
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText(['21 шт.']);
  await page.locator('#cartStep1Footer button').click();
  await page.locator('#cphone').fill('+7 911 555 44 33');
  await page.locator('#btnWA').click();
  const url = await page.evaluate(() => window.__cartHandoffs[0]);
  const message = new URL(url).searchParams.get('text');
  expect(message).toContain('21 шт.');
  expect(message).toContain('начинка: Малина');
  expect(message).toMatch(/33\s?600\s*₽/);
  expect(errors).toEqual([]);
});

test('cart preserves different dessert types when fillings would collide', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#card-2 .btn-add').click();
  await openCartByUser(page, testInfo);
  await page.locator('#cartDrawer .cart-item select').selectOption({ label: 'Малина' });
  await page.locator('#cartDrawer .cart-item').getByRole('button', { name: 'Авторский' }).click();
  await page.locator('#cartDrawer .cart-close').click();
  await page.locator('#card-2 .btn-add').click();
  await openCartByUser(page, testInfo);
  const items = page.locator('#cartDrawer .cart-item');
  const select = items.last().locator('select');
  await select.focus();
  await select.selectOption({ label: 'Малина' });
  await expect(items).toHaveCount(2);
  await expect(items.locator('.qty-val')).toHaveText(['1 шт.', '1 шт.']);
  await expect(select).toHaveValue('');
  await expect(select).toBeFocused();
  await expect(page.locator('#toast')).toContainText('одинаковый тип десерта');
  await expect(page.locator('#toast')).toHaveAttribute('role', 'status');
  await items.last().getByRole('button', { name: 'Авторский' }).click();
  await items.last().locator('select').selectOption({ label: 'Малина' });
  await expect(items.locator('.qty-val')).toHaveText(['2 шт.']);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart')));
  expect(Object.values(stored)[0]).toMatchObject({ qty: 2, dessertType: 'author', fill: 'Малина' });
  expect(errors).toEqual([]);
});

test('cart keeps repeated calculator additions instead of silently truncating them', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if (testInfo.project.name.endsWith('-mobile')) {
    await page.locator('#fillings').scrollIntoViewIfNeeded();
    // Wait for the lazy catalog to settle before tapping the fixed price panel.
    await expect(page.locator('#card-2 .btn-add')).toBeAttached();
    await page.locator('#fillings').scrollIntoViewIfNeeded();
    await page.locator('#calcCollapsedBar').click();
    await expect(page.locator('#calcCollapsedBar')).toHaveAttribute('aria-expanded', 'true');
  }
  for (let i = 0; i < 6; i++) await page.locator('.calc-add-btn').click();
  await page.locator('#calcOpenCartBtn').click();
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText(['12 кг']);
  await expect(page.locator('#cartDrawer .cart-inline-total')).toContainText(/33\s?600\s*₽/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openCartByUser(page, testInfo);
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText(['12 кг']);
  expect(errors).toEqual([]);
});

test('cart restores legacy conflicts without merging types or dropping valid quantities', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const restore = async (entries) => {
    await page.evaluate((value) => localStorage.setItem('milovicake_cart', JSON.stringify(value)), entries);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCartByUser(page, testInfo);
  };

  await restore({
    '2': { qty: 1, fill: 'Малина', dessertType: 'author' },
    '2:regular:Малина': { qty: 1, fill: 'Малина', dessertType: 'base' },
  });
  let items = page.locator('#cartDrawer .cart-item');
  await expect(items).toHaveCount(2);
  await expect(items.locator('.qty-val')).toHaveText(['1 шт.', '1 шт.']);
  await expect(items.first().locator('select')).toHaveValue('Малина');
  await items.first().locator('select').selectOption({ label: 'Малина' });
  await expect(page.locator('#toast')).toContainText('Выберите одинаковый тип');
  await expect(items.first().locator('select')).toHaveValue('Малина');
  await items.first().locator('select').selectOption({ label: 'Вишня' });
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart')));
  expect(stored['2:regular:Вишня']).toMatchObject({ qty: 1, dessertType: 'author', fill: 'Вишня' });
  expect(stored['2:regular:Малина']).toMatchObject({ qty: 1, dessertType: 'base', fill: 'Малина' });

  const max = Math.floor(Number.MAX_SAFE_INTEGER / 1600);
  await restore({ '2': { qty: max }, '2:regular': { qty: 1 } });
  items = page.locator('#cartDrawer .cart-item');
  await expect(items).toHaveCount(2);
  await expect(page.locator('.cart-inline-total')).toHaveText('Цена уточняется');
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart')));
  expect(Object.values(stored).map(({ qty }) => qty)).toEqual([max, 1]);

  await restore({
    '2': { qty: 1, dessertType: 'author' },
    '2:regular': { qty: 2, dessertType: 'author' },
    '2:regular:': { qty: 3, dessertType: 'base' },
  });
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText(['1 шт.', '2 шт.', '3 шт.']);

  await restore({
    '2': { qty: 1, mode: 'maxi', fill: 'Малина', decor: 'Бант', dessertType: 'author' },
    '2:maxi:Малина:Бант': { qty: 1, mode: 'maxi', fill: 'Малина', decor: 'Бант', dessertType: 'base' },
  });
  items = page.locator('#cartDrawer .cart-item');
  await expect(items).toHaveCount(2);
  await items.first().locator('select').selectOption({ label: 'Вишня' });
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart')));
  expect(stored['2:maxi:Вишня:Бант']).toMatchObject({ qty: 1, mode: 'maxi', decor: 'Бант', dessertType: 'author' });
  expect(stored['2:maxi:Малина:Бант']).toMatchObject({ qty: 1, mode: 'maxi', decor: 'Бант', dessertType: 'base' });

  await restore({ '2': { qty: 1, dessertType: {} }, '2:regular': { qty: 2 } });
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText(['3 шт.']);
  await expect(page.locator('#cartDrawer .cart-item').getByRole('button', { name: 'Базовый' }))
    .toHaveAttribute('style', /background:var\(--gold\)/);
});

test('cart keeps the total honest when several safe item prices overflow the precise range', async ({ page }, testInfo) => {
  const entries = {
    '5:regular': { qty: 25734855007186, fill: '' },
    '2:regular': { qty: 5629499531146, fill: '' },
    '4:regular': { qty: 3602879694788, fill: '' },
    '1:regular': { qty: 3216856871802, fill: '' },
    '2:maxi': { qty: 3002399744588, fill: '' },
    '3:regular': { qty: 1801439840973, fill: '' },
  };
  await page.addInitScript((saved) => localStorage.setItem('milovicake_cart', JSON.stringify(saved)), entries);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openCartByUser(page, testInfo);
  await expect(page.locator('.cart-item')).toHaveCount(6);
  await expect(page.locator('.cart-inline-total')).toHaveText('Цена уточняется');
  await page.locator('#cartStep1Footer button').click();
  await page.locator('#cphone').fill('+7 911 555 44 33');
  await page.evaluate(() => {
    window.__totalHandoff = '';
    window.open = (url) => { window.__totalHandoff = url; return {}; };
  });
  await page.locator('#btnWA').click();
  const handoff = await page.evaluate(() => window.__totalHandoff);
  expect(new URL(handoff).searchParams.get('text')).toContain('Итого (предварительно): Цена уточняется');
});

test('cart rejects a quantity merge that would overflow safe prices without losing either entry', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const max = Math.floor(Number.MAX_SAFE_INTEGER / 1600);
  await page.evaluate((qty) => localStorage.setItem('milovicake_cart', JSON.stringify({
    '2:regular:Малина': { qty, fill: 'Малина', mode: 'regular', dessertType: 'base' },
    '2:regular': { qty: 1, mode: 'regular', dessertType: 'base' },
  })), max);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openCartByUser(page, testInfo);
  const items = page.locator('#cartDrawer .cart-item');
  const select = items.last().locator('select');
  await select.selectOption({ label: 'Малина' });
  await expect(items).toHaveCount(2);
  await expect(select).toHaveValue('');
  await expect(page.locator('#toast')).toContainText('Слишком большое количество');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart')));
  expect(Object.values(stored).map((entry) => entry.qty)).toEqual([max, 1]);

  await page.evaluate((qty) => localStorage.setItem('milovicake_cart', JSON.stringify({ '2:regular': { qty, mode: 'regular' } })), max);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#card-2 .btn-add').click();
  await expect(page.locator('#toast')).toContainText('Слишком большое количество');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart'))['2:regular'].qty)).toBe(max);

  const cakeMax = Math.floor(Number.MAX_SAFE_INTEGER / 2800);
  const cakeKey = '1:regular:Микс ягод:Базовый декор';
  await page.evaluate(({ qty, key }) => localStorage.setItem('milovicake_cart', JSON.stringify({
    [key]: { qty, fill: 'Микс ягод', decor: 'Базовый декор', mode: 'regular' },
  })), { qty: cakeMax, key: cakeKey });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#card-2 .btn-add').waitFor({ state: 'visible' });
  await page.locator('#fillings').scrollIntoViewIfNeeded();
  if (testInfo.project.name.includes('mobile')) await page.locator('#calcCollapsedBar').click();
  await page.locator('.calc-add-btn').click();
  await expect(page.locator('#toast')).toContainText('Слишком большое количество');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem('milovicake_cart'))[key].qty, cakeKey)).toBe(cakeMax);
});

async function traceCalculatorEvents(page) {
  await page.addInitScript(() => {
    window.__calcTrace = [];
    const record = (event) => {
      const target = event.target;
      window.__calcTrace.push({
        type: event.type, key: event.key || '', time: Math.round(performance.now()),
        target: target?.id || (typeof target?.className === 'string' ? target.className : target?.nodeName) || '',
        related: event.relatedTarget?.id || (typeof event.relatedTarget?.className === 'string' ? event.relatedTarget.className : event.relatedTarget?.nodeName) || '',
        active: document.activeElement?.id || (typeof document.activeElement?.className === 'string' ? document.activeElement.className : document.activeElement?.nodeName) || '',
        expanded: document.querySelector('#calcCollapsedBar')?.getAttribute('aria-expanded'),
        scrollY: window.scrollY,
      });
      if (window.__calcTrace.length > 80) window.__calcTrace.shift();
    };
    for (const type of ['focusin', 'focusout', 'keydown', 'click']) document.addEventListener(type, record, true);
    window.addEventListener('scroll', record, { passive: true });
  });
}

async function calculatorDiagnostics(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('#calcCollapsedBar');
    const panel = document.querySelector('#calcRightCol');
    const region = document.querySelector('#calcExpandable');
    const active = document.activeElement;
    const style = region && getComputedStyle(region);
    return {
      active: active?.id || active?.className || active?.nodeName, documentHasFocus: document.hasFocus(),
      expanded: bar?.getAttribute('aria-expanded'), panel: panel?.className,
      barDisplay: bar && getComputedStyle(bar).display,
      region: region && { tabIndex: region.tabIndex, display: style.display, visibility: style.visibility,
        overflowY: style.overflowY, clientHeight: region.clientHeight, scrollHeight: region.scrollHeight },
      scrollY: window.scrollY,
      trace: window.__calcTrace?.filter((event) => event.type !== 'scroll').slice(-12),
      recentScroll: window.__calcTrace?.filter((event) => event.type === 'scroll').slice(-3),
    };
  });
}

async function expectCalculatorFocus(page, locator, investigateTabOrder = false) {
  try { await expect(locator).toBeFocused(); }
  catch (error) {
    const before = await calculatorDiagnostics(page);
    const subsequentTabs = [];
    if (investigateTabOrder) {
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab');
        subsequentTabs.push(await page.evaluate(() => ({
          active: document.activeElement?.id || document.activeElement?.className || document.activeElement?.nodeName,
          expanded: document.querySelector('#calcCollapsedBar')?.getAttribute('aria-expanded'),
          scrollY: window.scrollY,
        })));
      }
    }
    throw new Error(`${error.message}\nCalculator focus diagnostics: ${JSON.stringify({ subsequentTabs, before })}`, { cause: error });
  }
}

test('mobile calculator panel stays reachable and restores keyboard focus', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await traceCalculatorEvents(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of ['/', '/prigorody/pushkin/']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    // A real navigation click releases the deferred catalog before scrolling.
    await page.locator('#mcNav [data-section="catalog"]').click();
    await expect(page.locator('#card-2 .btn-add')).toBeVisible();
    await page.locator('#fillings').scrollIntoViewIfNeeded();
    const bar = page.locator('#calcCollapsedBar');
    const region = page.locator('#calcExpandable');
    const add = page.locator('.calc-add-btn');
    await expect(region).toHaveAttribute('role', 'region');
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
    await expect(add).toBeHidden();
    const closed = await page.evaluate(() => ({
      panel: document.getElementById('calcRightCol').getBoundingClientRect().bottom,
      nav: document.getElementById('mcNav').getBoundingClientRect().top,
    }));
    expect(closed.panel, `${route} closed panel and navigation`).toBeLessThanOrEqual(closed.nav + 1);
    await bar.focus();
    await page.keyboard.press('Enter');
    try { await expect(bar).toHaveAttribute('aria-expanded', 'true'); }
    catch (error) {
      throw new Error(`${error.message}\nCalculator open diagnostics: ${JSON.stringify(await calculatorDiagnostics(page))}`, { cause: error });
    }
    await expect(add).toBeVisible();
    await expect(region).toHaveAccessibleName('Итог расчёта торта');
    await page.keyboard.press('Tab');
    await expectCalculatorFocus(page, region, true);
    expect(await region.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Tab');
    await expectCalculatorFocus(page, add, true);
    await page.keyboard.press('Escape');
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
    await expectCalculatorFocus(page, bar);
    await expect(add).toBeHidden();
    await bar.click();
    await add.click();
    await page.locator('#calcOpenCartBtn').click();
    await expect(page.locator('#cartDrawer .cart-item')).toHaveCount(1);
    await page.locator('#cartDrawer .cart-close').click();
  }
  expect(errors).toEqual([]);
});

test('mobile calculator fast Tab keeps actions available with reduced motion', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of ['/', '/prigorody/pushkin/']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.locator('#mcNav [data-section="catalog"]').click();
    await expect(page.locator('#card-2 .btn-add')).toBeVisible();
    await page.locator('#fillings').scrollIntoViewIfNeeded();
    const bar = page.locator('#calcCollapsedBar');
    await bar.focus();
    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('aria-expanded', 'true');
    // Do not wait for the button to become visible before tabbing to it.
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => document.activeElement.id);
    await page.keyboard.press('Tab');
    const second = await page.evaluate(() => document.activeElement.className);
    expect({ first, second }, route).toEqual({ first: 'calcExpandable', second: 'calc-add-btn' });
    await expect(page.locator('.calc-add-btn')).toBeVisible();
    await expect(bar).toHaveAttribute('aria-expanded', 'true');
  }
});

test('wider calculator result keeps its labelled keyboard focus visible', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [561, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/prigorody/pushkin/']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const region = page.locator('#calcExpandable');
      await expect(region).toHaveCSS('display', 'flex');
      await expect(region).toHaveAccessibleName('Итог расчёта торта');
      await page.locator('#calcDecor .calc-opt').last().focus();
      await page.keyboard.press('Tab');
      await expectCalculatorFocus(page, region, true);
      expect(await region.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      expect((await region.boundingBox()).height).toBeGreaterThan(0);
      await page.keyboard.press('Tab');
      await expectCalculatorFocus(page, page.locator('.calc-add-btn'), true);
      if (width <= 768) {
        // Native focus scrolling must leave the button above the fixed app bar.
        await expect.poll(() => page.evaluate(() =>
          document.querySelector('#mcNav').getBoundingClientRect().top -
          document.querySelector('.calc-add-btn').getBoundingClientRect().bottom),
        { message: `${route} ${width}px focused add button vs. navigation` }).toBeGreaterThanOrEqual(0);
      }
      await page.keyboard.press('Tab');
      await expectCalculatorFocus(page, page.locator('#calcOpenCartBtn'), true);
    }
  }
});

test('mobile calculator ignores a stale scroll event but closes on a real scroll', async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#mcNav [data-section="catalog"]').click();
  await page.locator('#fillings').scrollIntoViewIfNeeded();
  const bar = page.locator('#calcCollapsedBar');
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  const before = await page.evaluate(() => window.scrollY);
  // Model a previously queued scroll event without changing the page position.
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  if (browserName === 'webkit' && testInfo.project.name.endsWith('-mobile')) {
    await page.evaluate(() => window.scrollBy(0, 500));
  } else {
    await page.mouse.move(20, 200);
    await page.mouse.wheel(0, 500);
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
});

test('light calculator summary colors contrast with their desktop panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('mc_theme', 'light'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const samples = await page.evaluate(() => {
    const panel = document.querySelector('#calcResultBox');
    const panelStyle = getComputedStyle(panel);
    if (panelStyle.backgroundImage !== 'none') throw new Error('Recheck summary contrast for the new background');
    const parse = (value) => {
      const parts = value.match(/[\d.]+/g).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] === undefined ? 1 : parts[3]];
    };
    const blend = (front, back) => front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3]));
    const base = parse(panelStyle.backgroundColor);
    if (base[3] !== 1) throw new Error('Recheck summary contrast for a translucent background');
    return ['.calc-result-price', '.calc-summary-chip .chip-val', '.calc-result-label', '#calcNote'].map((selector) => {
      const element = panel.querySelector(selector);
      const chip = element.closest('.calc-summary-chip');
      const background = chip ? blend(parse(getComputedStyle(chip).backgroundColor), base) : base.slice(0, 3);
      const foreground = blend(parse(getComputedStyle(element).color), background);
      return { selector, foreground: `rgb(${foreground.map(Math.round).join(', ')})`, background: `rgb(${background.map(Math.round).join(', ')})` };
    });
  });
  for (const sample of samples) {
    const values = [luminance(sample.foreground), luminance(sample.background)].sort((a, b) => b - a);
    const ratio = (values[0] + 0.05) / (values[1] + 0.05);
    expect(ratio, sample.selector).toBeGreaterThanOrEqual(4.5);
  }
});

test('mobile calculator clears the navigation above a safe-area inset', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium-mobile', 'Chromium safe-area emulation');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 44, bottom: 34, left: 0, right: 0 } });
  try {
    for (const route of ['/', '/prigorody/pushkin/']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('#mcNav [data-section="catalog"]').click();
      await expect(page.locator('#card-2 .btn-add')).toBeVisible();
      await page.locator('#fillings').scrollIntoViewIfNeeded();
      const closed = await page.evaluate(() => ({
        panel: document.querySelector('#calcRightCol').getBoundingClientRect().bottom,
        nav: document.querySelector('#mcNav').getBoundingClientRect().top,
      }));
      expect(closed.panel, route).toBeLessThanOrEqual(closed.nav);
      await page.locator('#calcCollapsedBar').click();
      await page.locator('.calc-add-btn').click();
      await expect.poll(() => page.locator('#mcNav').evaluate((nav) => nav.getBoundingClientRect().top)).toBeGreaterThanOrEqual(844);
      const button = await page.locator('.calc-add-btn').boundingBox();
      expect(button.y + button.height, route).toBeLessThanOrEqual(844 - 34);
    }
  } finally {
    await cdp.detach();
  }
});

test('cart refuses incompatible catalog and calculator additions without changing author items', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const cardAdd = page.locator('#card-2 .btn-add');
  await cardAdd.click();
  await openCartByUser(page, testInfo);
  await page.locator('#cartDrawer .cart-item').getByRole('button', { name: 'Авторский' }).click();
  await page.locator('#cartDrawer .cart-close').click();
  await cardAdd.click();
  await expect(page.locator('#toast')).toContainText('одинаковый тип десерта');
  await openCartByUser(page, testInfo);
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText('1 шт.');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart')));
  expect(Object.values(saved)[0]).toMatchObject({ qty: 1, dessertType: 'author' });
  await page.locator('#cartDrawer .del-btn').click();
  await expect(page.locator('#cartDrawer .cart-item')).toHaveCount(0);
  await page.locator('#cartDrawer .cart-close').click();

  await page.locator('#fillings').scrollIntoViewIfNeeded();
  if (testInfo.project.name.endsWith('-mobile')) await page.locator('#calcCollapsedBar').click();
  await page.locator('.calc-add-btn').click();
  await page.locator('#calcOpenCartBtn').click();
  await page.locator('#cartDrawer .cart-item').getByRole('button', { name: 'Авторский' }).click();
  await page.locator('#cartDrawer .cart-close').click();
  if (testInfo.project.name.endsWith('-mobile')) await page.locator('#calcCollapsedBar').click();
  await page.locator('.calc-add-btn').click();
  await expect(page.locator('#toast')).toContainText('одинаковый тип десерта');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart')));
  expect(Object.values(saved)[0]).toMatchObject({ qty: 2, dessertType: 'author' });
  expect(errors).toEqual([]);
});

test('mobile calculator after fast scroll keeps its panel open when catalog hydrates', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Playwright cannot issue mouse.wheel in a mobile WebKit context. The native
  // scrolling API still emits the browser's real scroll event; it does not
  // manipulate the catalog or the panel under test.
  if (testInfo.project.name === 'webkit-mobile') await page.evaluate(() => window.scrollBy(0, 4500));
  else await page.mouse.wheel(0, 4500);
  // A real scroll must release the lazy catalog even when it skips the section.
  await expect(page.locator('#card-2 .btn-add')).toBeAttached();
  await page.locator('#fillings').scrollIntoViewIfNeeded();
  await page.locator('#calcCollapsedBar').click();
  await expect(page.locator('#calcCollapsedBar')).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(500);
  await expect(page.locator('#calcCollapsedBar')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.calc-add-btn').click();
  await page.locator('#calcOpenCartBtn').click();
  await expect(page.locator('#cartDrawer .qty-val')).toHaveText('2 кг');
});

test('mobile calculator resize clears its backdrop before desktop and on return', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await traceCalculatorEvents(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of ['/', '/prigorody/pushkin/']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.locator('#mcNav [data-section="catalog"]').click();
    await expect(page.locator('#card-2 .btn-add')).toBeVisible();
    await page.locator('#fillings').scrollIntoViewIfNeeded();
    await page.locator('#calcCollapsedBar').click();
    await expect(page.locator('#calcCollapsedBar')).toHaveAttribute('aria-expanded', 'true');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('#calcCollapsedBar')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#calcPanelBackdrop')).not.toHaveClass(/\bvisible\b/);
    await page.locator('#cartBtn').click();
    await expect(page.locator('#cartDrawer')).toHaveAttribute('aria-hidden', 'false');
    await page.locator('#cartDrawer .cart-close').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#calcPanelBackdrop')).toBeHidden();
    await page.locator('#fillings').scrollIntoViewIfNeeded();
    await page.locator('#calcCollapsedBar').click();
    await page.locator('.calc-add-btn').click();
    try { await page.locator('#calcOpenCartBtn').click({ timeout: 10_000 }); }
    catch (error) {
      throw new Error(`${error.message}\nCalculator resize diagnostics: ${JSON.stringify(await calculatorDiagnostics(page))}`, { cause: error });
    }
    await expect(page.locator('#cartDrawer .cart-item')).toHaveCount(1);
    await page.locator('#cartDrawer .cart-close').click();
  }
  expect(errors).toEqual([]);
});
