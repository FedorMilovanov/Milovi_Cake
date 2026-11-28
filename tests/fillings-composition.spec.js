// r34: состав начинки — один источник правды для панели, шторки и live-region.
// Раньше панель держала описание первой начинки (подсказки уезжают в <body>),
// а на телефоне мобильная ветка выбора вообще не синхронизировала панель.
const { test, expect } = require('@playwright/test');

const BISCUIT_COUNT = 12;

/* Живой путь до WhatsApp: шаг «Данные» → телефон → перехват window.open.
   Внутренние функции main.js живут в IIFE, поэтому проверяем то, что реально
   уходит пользователю, а не приватную функцию. */
async function captureWhatsApp(page) {
  await page.evaluate(() => {
    window.__waHref = null;
    window.open = (url) => { window.__waHref = url; return { focus() {} }; };
    // шаг «Данные»: там появляются поля и кнопка WhatsApp
    if (typeof window.navigateToStep === 'function') window.navigateToStep(2);
  });
  await expect(page.locator('#cphone')).toBeVisible();
  await page.locator('#cphone').fill('+7 999 123-45-67');
  await page.locator('#btnWA').click();
  await expect.poll(async () => page.evaluate(() => window.__waHref)).not.toBeNull();
  const href = await page.evaluate(() => window.__waHref);
  return decodeURIComponent(String(href).split('text=')[1] || '');
}

async function openCalc(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.getElementById('fillings')?.scrollIntoView({ block: 'center' }));
  await expect(page.locator('#calcFill .calc-opt').first()).toBeAttached();
  await page.waitForTimeout(300);
}

/* На телефоне элемент, подведённый к краю экрана, оказывается под доком цены:
   ставим цель в центр вьюпорта — так же, как это делает живой пользователь. */
async function pickFill(page, index, group = 'calcFill') {
  const opt = page.locator(`#${group} .calc-opt`).nth(index);
  await opt.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(150);
  await opt.click();
  await page.waitForTimeout(220);
}

async function readPanel(page) {
  return page.evaluate(() => {
    const panel = document.getElementById('fillDescPanel');
    const text = document.getElementById('fillDescText');
    if (!panel || !text) return null;
    const css = getComputedStyle(panel);
    return {
      text: text.textContent.trim(),
      display: css.display,
      opacity: css.opacity,
      visible: css.display !== 'none' && Number(css.opacity) > 0.5,
    };
  });
}

async function selectedLabel(page, group = 'calcFill') {
  return (await page.locator(`#${group} .calc-opt.selected .opt-label`).first().textContent()).trim();
}

test('every biscuit filling shows its own composition in the panel', async ({ page }) => {
  await openCalc(page, 1440, 1000);

  const seen = [];
  for (let i = 0; i < BISCUIT_COUNT; i += 1) {
    await pickFill(page, i);
    const label = await selectedLabel(page);
    const panel = await readPanel(page);
    expect(panel, 'панель состава должна существовать на главной').not.toBeNull();
    expect(panel.visible, `панель видна для «${label}»`).toBe(true);
    expect(panel.text.length, `состав «${label}» не пустой`).toBeGreaterThan(15);
    seen.push({ label, text: panel.text });
  }

  // 12 разных начинок — 12 разных составов, и текст первой не «прилипает».
  const unique = new Set(seen.map((s) => s.text));
  expect(unique.size).toBe(BISCUIT_COUNT);
  expect(seen.slice(1).every((s) => s.text !== seen[0].text)).toBe(true);

  // Точечная сверка с реальной копией сайта (не с внутренним кэшем).
  expect(seen[0].text).toContain('Бисквит ваниль + микс малины');
  expect(seen[4].text).toContain('клубничное конфи');
  expect(seen[10].text).toContain('Бисквит красный бархат');
});

test('mobile panel and live region agree with the chosen filling', async ({ page }) => {
  await openCalc(page, 390, 844);

  for (const index of [0, 4, 9, 11]) {
    await pickFill(page, index);
    const label = await selectedLabel(page);
    const panel = await readPanel(page);
    const state = await page.evaluate(() => ({
      panel: (document.getElementById('fillDescText') || {}).textContent?.trim() || '',
      live: (document.getElementById('fillToast') || {}).textContent?.trim() || '',
    }));
    expect(panel.visible, `панель видна для «${label}»`).toBe(true);
    expect(state.live, 'live-region объявляет выбранную начинку').toContain(label);
    expect(state.live, 'live-region объявляет тот же состав, что и панель').toContain(state.panel);
    expect(state.panel.length).toBeGreaterThan(15);
  }
});

test('bento and 3D never show another filling composition', async ({ page }) => {
  await openCalc(page, 1440, 1000);
  const biscuitText = (await readPanel(page)).text;

  await page.locator('.calc-type-card[data-type="bento"]').click();
  await page.waitForTimeout(350);
  await pickFill(page, 2, 'calcFillBento');
  let panel = await readPanel(page);
  expect(panel.display).toBe('none');
  expect(panel.text, 'скрытая панель не хранит состав другой начинки').toBe('');

  await page.locator('.calc-type-card[data-type="cake3d"]').click();
  await page.waitForTimeout(350);
  await pickFill(page, 1, 'calcFill3d');
  panel = await readPanel(page);
  expect(panel.display).toBe('none');
  expect(panel.text).toBe('');

  // Возврат на бисквит — панель снова живая и с текстом первой начинки.
  await page.locator('.calc-type-card[data-type="biscuit"]').click();
  await page.waitForTimeout(350);
  panel = await readPanel(page);
  expect(panel.visible).toBe(true);
  expect(panel.text).toBe(biscuitText);
});

test('suburb pages show the same composition panel as the home page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/prigorody/pushkin/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.getElementById('fillings')?.scrollIntoView({ block: 'center' }));
  await expect(page.locator('#calcFill .calc-opt').first()).toBeAttached();
  await page.waitForTimeout(300);

  const initial = await readPanel(page);
  expect(initial, 'на странице пригорода тоже есть панель состава').not.toBeNull();
  expect(initial.visible).toBe(true);
  expect(initial.text.length).toBeGreaterThan(15);

  await pickFill(page, 6);
  const after = await readPanel(page);
  expect(after.visible).toBe(true);
  expect(after.text).not.toBe(initial.text);
  expect(after.text).toContain('манго');
});

test('cart and whatsapp reuse the exact calculator filling', async ({ page }) => {
  await openCalc(page, 1440, 1000);
  await page.evaluate(() => localStorage.removeItem('milovicake_cart'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.getElementById('fillings')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);

  await pickFill(page, 0);
  const label = await selectedLabel(page);
  await page.locator('.calc-add-btn').click();
  await page.waitForTimeout(350);
  await page.evaluate(() => { if (typeof openCart === 'function') openCart(); });
  await expect(page.locator('.cart-item')).toHaveCount(1);

  const cartFill = await page.locator('.cart-item select').first().inputValue();
  expect(cartFill, 'корзина узнаёт начинку, выбранную в калькуляторе').toBe(label);

  // Сообщение собираем живой кнопкой WhatsApp и перехватом window.open.
  const message = await captureWhatsApp(page);
  expect(message).toContain(`начинка: ${label}`);
  const fillLine = message.split('\n').find((line) => line.includes('начинка:')) || '';
  expect(fillLine, 'в строке начинки нет эмодзи из старых названий').not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
});

test('a legacy cart with an emoji filling is migrated without losing the order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('milovicake_cart', JSON.stringify({
        '1:regular:Микс ягод 🍓:Базовый декор': { qty: 2, mode: 'regular', fill: 'Микс ягод 🍓', decor: 'Базовый декор', decorAdd: 0 },
      }));
    } catch (e) {}
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart') || '{}'));
  const keys = Object.keys(stored);
  expect(keys, 'старая строка не размножилась').toHaveLength(1);
  expect(keys[0], 'ключ приведён к современному написанию').toBe('1:regular:Микс ягод:Базовый декор');
  expect(stored[keys[0]].qty, 'количество сохранено').toBe(2);
  expect(stored[keys[0]].fill).toBe('Микс ягод');
  expect(stored[keys[0]].decor).toBe('Базовый декор');

  await page.evaluate(() => { if (typeof openCart === 'function') openCart(); });
  await expect(page.locator('.cart-item')).toHaveCount(1);
  expect(await page.locator('.cart-item select').first().inputValue()).toBe('Микс ягод');
  await expect(page.locator('.cart-inline-total')).toContainText('5 600');

  // Количество меняется поверх мигрированной строки (шаг «Выбор»).
  await page.locator('.cart-item .qty-btn').filter({ hasText: '+' }).first().click();
  await page.waitForTimeout(350);
  const afterQty = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart') || '{}'));
  const afterKeys = Object.keys(afterQty);
  expect(afterKeys, 'после изменения количества строка осталась одна').toHaveLength(1);
  expect(afterQty[afterKeys[0]].qty).toBe(2.5);
  expect(afterQty[afterKeys[0]].decor).toBe('Базовый декор');

  // И только потом — сообщение WhatsApp по живой кнопке.
  const message = await captureWhatsApp(page);
  const flat = message.replace(/[\u00a0\u202f]/g, ' ');
  expect(flat).toContain('начинка: Микс ягод');
  expect(flat).not.toContain('🍓');
  expect(flat).toContain('7 000');
});

test('catalog CTA row keeps one baseline on wide screens', async ({ page }) => {
  for (const width of [1440, 820]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const grid = document.querySelector('.catalog-grid');
      if (grid) grid.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const rows = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.catalog-grid .product-card')];
      const groups = new Map();
      cards.forEach((card) => {
        const footer = card.querySelector('.product-footer');
        if (!footer) return;
        const top = Math.round(footer.getBoundingClientRect().top);
        const key = Math.round(card.getBoundingClientRect().top / 1000);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(top);
      });
      return [...groups.values()];
    });

    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((tops) => {
      if (tops.length < 2) return;
      expect(Math.max(...tops) - Math.min(...tops), `кнопки в ряду на ${width}px стоят на одной линии`).toBeLessThanOrEqual(1);
    });
  }
});

test('a very long order keeps contacts and total inside the WhatsApp link', async ({ page }, testInfo) => {
  if (!testInfo.project.name.endsWith('-mobile')) await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('milovi_analytics_consent_v1', 'denied');
      const fills = ['Микс ягод', 'Воздушный поцелуй', 'Красный бархат', 'Ванильная вишня', 'Супер-Шоколад'];
      const bentoFills = ['Микс ягод', 'Карамель с орехами', 'Карамель с вафлями', 'Малина', 'Вишня'];
      const decors = ['Базовый декор', 'Авторский декор'];
      const lines = {};
      fills.forEach((fill, index) => decors.forEach((decor) => {
        lines[`1:regular:${fill}:${decor}`] = { qty: 2, mode: 'regular', fill, decor, decorAdd: decor === 'Авторский декор' ? 1000 : 0 };
        lines[`2:regular:${bentoFills[index]}:${decor}:choco`] = { qty: 1, mode: 'regular', fill: bentoFills[index], decor, decorAdd: 0, biscuit: 'choco' };
        lines[`2:maxi:${bentoFills[index]}:${decor}:vanilla`] = { qty: 1, mode: 'maxi', fill: bentoFills[index], decor, decorAdd: 0, biscuit: 'vanilla' };
      }));
      localStorage.setItem('milovicake_cart', JSON.stringify(lines));
    } catch (e) {}
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (typeof openCart === 'function') openCart(); });
  await expect(page.locator('.cart-item')).toHaveCount(30);
  await expect(page.locator('.cart-item').first()).toBeVisible();

  await page.evaluate(() => {
    window.__waHref = null;
    window.open = (url) => { window.__waHref = url; return { focus() {} }; };
    if (typeof window.navigateToStep === 'function') window.navigateToStep(2);
  });
  await expect(page.locator('#cphone')).toBeVisible();
  await page.locator('#cphone').fill('+7 999 123-45-67');
  await page.locator('#btnWA').click();
  await expect.poll(async () => page.evaluate(() => window.__waHref)).not.toBeNull();

  const href = await page.evaluate(() => window.__waHref);
  const flat = decodeURIComponent(String(href).split('text=')[1] || '').replace(/[\u00a0\u202f]/g, ' ');
  expect(href.length, 'ссылка не раздувается за пределы лимита WhatsApp').toBeLessThanOrEqual(4096);
  expect(flat, 'телефон покупателя остаётся в сообщении').toContain('+7 999 123-45-67');
  expect(flat, 'итог остаётся в сообщении').toContain('Итого (предварительно)');
  expect(flat, 'хотя бы одна позиция остаётся в сообщении').toContain('• ');
  // Пользователь предупреждён, что состав сокращён.
  await expect(page.locator('#toast, .toast').first()).toContainText(/сокращён/i);
  const recovery = page.locator('#cartHandoffRecovery');
  await expect(recovery).toBeVisible();
  const full = await recovery.locator('#cartHandoffText').inputValue();
  expect(full).toContain('+7 999 123-45-67');
  expect(full).toContain('Итого (предварительно)');
  expect(full.split('\n').filter(line => line.startsWith('•')).length).toBe(30);
  expect(full).toContain('бисквит: шоколадный');
  await expect(recovery.locator('#cartHandoffText')).toHaveAttribute('readonly', '');

});

test('the migrated cart survives a reload without duplicating lines', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('__r34_seeded')) {
        localStorage.setItem('milovicake_cart', JSON.stringify({
          '1:regular:Микс ягод 🍓:Базовый декор': { qty: 2, mode: 'regular', fill: 'Микс ягод 🍓', decor: 'Базовый декор', decorAdd: 0 },
        }));
        localStorage.setItem('__r34_seeded', '1');
      }
    } catch (e) {}
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart') || '{}'));
  expect(Object.keys(stored)).toEqual(['1:regular:Микс ягод:Базовый декор']);
  expect(stored['1:regular:Микс ягод:Базовый декор'].qty).toBe(2);
  expect(stored['1:regular:Микс ягод:Базовый декор'].fill).toBe('Микс ягод');
});
