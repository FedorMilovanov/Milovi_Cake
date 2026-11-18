const { test, expect } = require('@playwright/test');

/* [r39] Нижний бар появляется после начала прокрутки: на первом экране его нет,
   поэтому перед кликом по нему страницу надо прокрутить — как живой пользователь. */
async function revealMobileAppBar(page) {
  if (await page.evaluate(() => window.innerWidth > 768)) return;
  if (!(await page.evaluate(() => document.body.classList.contains('mc-nav-veiled')))) return;
  await page.evaluate(() => window.scrollTo(0, Math.max(520, Math.round(window.innerHeight * 0.8))));
  await page.waitForFunction(() => !document.body.classList.contains('mc-nav-veiled'), null, { timeout: 15000 });
}


/* r32: сквозная проверка заказа — предварительная стоимость, корзина,
   сохранённые данные и сообщение мессенджера должны говорить одно и то же.
   Раньше правило «декор у фиксированных типов считается отдельно» было
   записано дважды и расходилось: калькулятор показывал Макси Бенто ~3 000 ₽,
   а корзина и сообщение — 4 000 ₽ (доплата 1 000 ₽ начислялась только в корзине). */

const TYPES = [
  { key: 'biscuit', name: 'Бисквитный', fixed: false },
  { key: 'bento', name: 'Бенто', fixed: true },
  { key: 'bentomaxi', name: 'Макси Бенто', fixed: true },
  { key: 'cake3d', name: '3D', fixed: false },
];
const DECORS = [
  { label: 'Базовый', add: 0 },
  { label: 'Авторский', add: 1000 },
];

const money = (text) => {
  const digits = String(text || '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : NaN;
};

async function resetCart(page) {
  await page.evaluate(() => localStorage.removeItem('milovicake_cart'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.getElementById('fillings')?.scrollIntoView({ block: 'center' }));
  await expect(page.locator('#calcType .calc-type-card').first()).toBeAttached();
}

/* На телефоне снизу висит док цены и бар: элемент, подведённый Playwright'ом
   к краю экрана, оказывается под ними, и клик перехватывается. Ставим цель
   в центр вьюпорта — так же, как это делает живой пользователь. */
async function tapCenter(page, locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(150);
  await locator.click();
}

/* На телефоне панель расчёта свёрнута в полосу: пока её не раскрыть, карточки
   типов и кнопка «Добавить в корзину» существуют в DOM, но не видны. */
async function closeCalcOverlay(page, testInfo) {
  if (!testInfo.project.name.endsWith('-mobile')) return;
  const backdrop = page.locator('#calcPanelBackdrop.visible');
  if (!(await backdrop.count())) return;
  // на телефоне раскрытая панель расчёта — модальная поверхность с подложкой:
  // Escape закрывает её так же, как для живого пользователя
  await page.keyboard.press('Escape');
  await expect(backdrop).toHaveCount(0, { timeout: 5_000 });
}

async function ensureCalcPanelOpen(page, testInfo) {
  if (!testInfo.project.name.endsWith('-mobile')) return;
  const bar = page.locator('#calcCollapsedBar');
  if (!(await bar.count())) return;
  if ((await bar.getAttribute('aria-expanded')) === 'true') return;
  const selected = page.locator('#calcType .calc-type-card.selected');
  if (await selected.count()) await tapCenter(page, selected); // первое действие раскрывает док
  await bar.click({ timeout: 5_000 }).catch(async () => { await bar.evaluate((el) => el.click()); });
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
}

async function selectType(page, key, testInfo) {
  const card = page.locator(`#calcType .calc-type-card[data-type="${key}"]`);
  await closeCalcOverlay(page, testInfo);
  await ensureCalcPanelOpen(page, testInfo);
  await tapCenter(page, card);
  await expect(card).toHaveClass(/selected/);
}

async function selectDecor(page, label) {
  const option = page.locator('#calcDecor .calc-opt').filter({ hasText: label }).first();
  await tapCenter(page, option);
  await expect(option).toHaveClass(/selected/);
}

async function calcPreview(page) {
  return money(await page.locator('#calcResult').textContent());
}

async function addFromCalculator(page, testInfo) {
  // прокрутка к начинке/декору на телефоне закрывает панель — раскрываем снова
  await ensureCalcPanelOpen(page, testInfo);
  const button = page.locator('.calc-add-btn');
  await expect(button).toBeVisible();
  await tapCenter(page, button);
}

async function cartSnapshot(page) {
  return page.evaluate(() => ({
    total: (document.getElementById('cartTotal')?.textContent || '').trim(),
    lines: [...document.querySelectorAll('#cartDrawer .cart-item')],
    lineTexts: [...document.querySelectorAll('#cartDrawer .cart-item')].map((item) => item.textContent.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim()),
    lineTotals: [...document.querySelectorAll('#cartDrawer .cart-line-total')].map((node) => node.textContent.trim()),
    stored: JSON.parse(localStorage.getItem('milovicake_cart') || '{}'),
  }));
}

async function openCart(page, testInfo) {
  const drawer = page.locator('#cartDrawer');
  // добавление из калькулятора уже раскрывает корзину — повторный клик по бару
  // перехватил бы оверлей
  if (await drawer.getAttribute('aria-hidden') === 'false') return;
  const mobile = testInfo.project.name.endsWith('-mobile');
  if (mobile) await revealMobileAppBar(page); // [r39] бар появляется после прокрутки
  const trigger = page.locator(mobile ? '#mcNav .mc-btn--order' : '#cartBtn');
  await trigger.click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
}

async function orderMessage(page, testInfo) {
  await openCart(page, testInfo);
  // шаг 1 → шаг 2 (контакты), затем отправка в WhatsApp
  const phone = page.locator('#cphone');
  if (!(await phone.isVisible())) await page.locator('#cartStep1Footer button').first().click();
  await page.locator('#cphone').fill('+7 911 555 44 33');
  await page.locator('#cname').fill('Виктория');
  await page.locator('#btnWA').click();
  return page.evaluate(() => {
    const url = (window.__cartHandoffs || []).slice(-1)[0];
    // в сообщении неразрывные пробелы («1 000 ₽») — сравниваем обычными
    return url ? new URL(url).searchParams.get('text').replace(/\u00a0/g, ' ') : null;
  });
}

async function prepare(page, testInfo) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.__cartHandoffs = [];
    window.open = (url) => { window.__cartHandoffs.push(url); return {}; };
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('milovicake_cart'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#calcType .calc-type-card').first()).toBeAttached();
}

async function matrixFor(page, testInfo, types, errors) {
  for (const type of types) {
    for (const decor of DECORS) {
      await resetCart(page);
      await selectType(page, type.key, testInfo);
      await selectDecor(page, decor.label);
      const preview = await calcPreview(page);
      await addFromCalculator(page, testInfo);
      await expect(page.locator('#cartDrawer')).toHaveAttribute('aria-hidden', 'false', { timeout: 5_000 }).catch(() => {});
      await expect(page.locator('#cartDrawer .cart-item').first()).toBeAttached();
      const cart = await cartSnapshot(page);

      const expectedAdd = type.fixed ? 0 : decor.add;
      const key = Object.keys(cart.stored)[0];
      expect(key, `${type.key}/${decor.label}: позиция не попала в корзину`).toBeTruthy();
      const entry = cart.stored[key];
      expect(entry.decorAdd, `${type.key}/${decor.label}: доплата за декор в сохранённой корзине`).toBe(expectedAdd);

      const productTotal = Number(entry.qty) * (type.key === 'biscuit' ? 2800 : type.key === 'cake3d' ? 5000 : type.key === 'bento' ? 1600 : 3000);
      const expected = productTotal + expectedAdd;
      expect(preview, `${type.key}/${decor.label}: предварительная стоимость`).toBe(expected);
      expect(money(cart.total), `${type.key}/${decor.label}: итог корзины`).toBe(expected);
      expect(money(cart.lineTotals[0]), `${type.key}/${decor.label}: сумма строки корзины`).toBe(expected);
    }
  }
}

/* Матрица разделена на два теста: в одном прогоне восемь комбинаций с
   перезагрузками упирались в 60-секундный лимит теста. */
test('fixed-price types keep the preview, cart and line totals in agreement', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await prepare(page, testInfo);
  await matrixFor(page, testInfo, TYPES.filter((type) => type.fixed), errors);
  expect(errors).toEqual([]);
});

test('weight-based types keep the preview, cart and line totals in agreement', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await prepare(page, testInfo);
  await matrixFor(page, testInfo, TYPES.filter((type) => !type.fixed), errors);
  expect(errors).toEqual([]);
});

test('maxi bento quotes author decor separately in the preview, cart and message', async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await resetCart(page);
  await selectType(page, 'bentomaxi', testInfo);
  await selectDecor(page, 'Авторский');
  expect(await calcPreview(page)).toBe(3000);
  await addFromCalculator(page, testInfo);

  const cart = await cartSnapshot(page);
  expect(money(cart.total)).toBe(3000);
  expect(money(cart.lineTotals[0])).toBe(3000);
  const entry = Object.values(cart.stored)[0];
  expect(entry).toMatchObject({ mode: 'maxi', decor: 'Авторский декор', decorAdd: 0 });

  const message = await orderMessage(page, testInfo);
  expect(message).toContain('Макси Бенто');
  expect(message).toContain('Авторский декор');
  expect(message).not.toContain('Авторский декор (+1 000 ₽)');
  expect(message).toMatch(/Итого \(предварительно\):\s*3\s?000\s*₽/);
});

test('cart line keeps type, filling, decor, biscuit and quantity of every position', async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await resetCart(page);
  await selectType(page, 'biscuit', testInfo);
  await selectDecor(page, 'Авторский');
  await addFromCalculator(page, testInfo);
  await selectType(page, 'bentomaxi', testInfo);
  await selectDecor(page, 'Базовый');
  const biscuit = page.locator('#calcBiscuitSeg .calc-biscuit-opt').filter({ hasText: 'Шоколадный' });
  if (await biscuit.count()) await biscuit.first().click();
  await addFromCalculator(page, testInfo);

  const cart = await cartSnapshot(page);
  expect(cart.lineTexts).toHaveLength(2);
  expect(cart.lineTexts[0]).toContain('Бисквитный торт');
  expect(cart.lineTexts[0]).toContain('Авторский декор');
  expect(cart.lineTexts[0]).toContain('+1 000 ₽');
  expect(cart.lineTexts[1]).toContain('Макси Бенто');
  expect(cart.lineTexts[1]).toContain('Базовый декор');
  expect(cart.lineTexts[1]).toContain('бисквит: шоколадный');

  const message = await orderMessage(page, testInfo);
  expect(message).toContain('Бисквитный торт');
  expect(message).toContain('Макси Бенто');
  expect(message).toContain('декор: Авторский декор (+1 000 ₽)');
  expect(message).toContain('бисквит: шоколадный');
  expect(message).toContain('Телефон');
  expect(message).toContain('+7 911 555 44 33');
  expect(message).toContain('Виктория');
});

test('author decor surcharge is charged once and survives quantity changes and reload', async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await resetCart(page);
  await selectType(page, 'biscuit', testInfo);
  await selectDecor(page, 'Авторский');
  expect(await calcPreview(page)).toBe(6600); // 2 кг × 2 800 + 1 000
  await addFromCalculator(page, testInfo);
  await openCart(page, testInfo);
  const item = page.locator('#cartDrawer .cart-item');
  await expect(item.locator('.qty-val')).toHaveText('2 кг');
  expect(money(await item.locator('.cart-line-total').textContent())).toBe(6600);

  await item.locator('.qty-btn').last().click();
  await expect(item.locator('.qty-val')).not.toHaveText('2 кг');
  const qtyLabel = (await item.locator('.qty-val').textContent()).trim();
  const qty = Number.parseFloat(qtyLabel);
  expect(Number.isFinite(qty)).toBe(true);
  // вес шагается по 0,5 кг: доплата за декор остаётся однократной
  const expected = qty * 2800 + 1000;
  expect(money(await item.locator('.cart-line-total').textContent())).toBe(expected);
  expect(money(await page.locator('#cartTotal').textContent())).toBe(expected);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart')));
  expect(Object.values(stored)[0]).toMatchObject({ qty, decorAdd: 1000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await openCart(page, testInfo);
  await expect(page.locator('#cartDrawer .cart-item .qty-val')).toHaveText(qtyLabel);
  expect(money(await page.locator('#cartTotal').textContent())).toBe(expected);
});

test('long order keeps every position and the contacts in the WhatsApp message', async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await page.evaluate(() => {
    const entries = {
      '1:regular:Микс ягод:Авторский декор': { qty: 3, mode: 'regular', fill: 'Микс ягод', decor: 'Авторский декор', decorAdd: 1000 },
      '1:regular:Малина:Базовый декор': { qty: 2, mode: 'regular', fill: 'Малина', decor: 'Базовый декор', decorAdd: 0 },
      '2:regular:Карамель с орехами:Авторский декор': { qty: 4, mode: 'regular', fill: 'Карамель с орехами', decor: 'Авторский декор', decorAdd: 0, biscuit: 'choco' },
      '2:maxi:Вишня:Базовый декор': { qty: 2, mode: 'maxi', fill: 'Вишня', decor: 'Базовый декор', decorAdd: 0, biscuit: 'vanilla' },
      '3:regular:Молочная девочка:Авторский декор': { qty: 5, mode: 'regular', fill: 'Молочная девочка', decor: 'Авторский декор', decorAdd: 1000 },
    };
    localStorage.setItem('milovicake_cart', JSON.stringify(entries));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openCart(page, testInfo);
  const lines = page.locator('#cartDrawer .cart-item');
  await expect(lines).toHaveCount(5);
  const total = money(await page.locator('#cartTotal').textContent());
  // 3×2800+1000 + 2×2800 + 4×1600 + 2×3000 + 5×5000+1000
  expect(total).toBe(8400 + 1000 + 5600 + 6400 + 6000 + 25000 + 1000);

  const message = await orderMessage(page, testInfo);
  expect(message).toBeTruthy();
  for (const fragment of ['Бисквитный торт', 'Бенто торт', 'Макси Бенто', '3D', 'Авторский декор', 'Базовый декор', 'бисквит: шоколадный']) {
    expect(message, `в сообщении потерян фрагмент «${fragment}»`).toContain(fragment);
  }
  expect(message).toContain('Виктория');
  expect(message).toContain('+7 911 555 44 33');
  expect(message).toMatch(/Итого \(предварительно\):\s*53\s?400\s*₽/);
});

test('delivery date minimum follows Saint Petersburg time, not UTC', async ({ page }) => {
  /* Ставим часы на 00:30 по Петербургу (21:30 UTC предыдущего дня) — именно в
     этом окне `new Date().toISOString()` отдаёт вчерашнюю дату, и минимум
     съезжал на день раньше: клиент мог выбрать доставку «завтра», хотя
     производство обещает от двух дней. */
  await page.clock.setFixedTime(new Date('2026-12-20T21:30:00Z')); // 21 декабря, 00:30 МСК
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const min = await page.locator('#cdate').getAttribute('min');
  expect(min).toBe('2026-12-23'); // 21 декабря + 2 дня по петербургскому календарю
});

test('delivery date minimum stays correct in the evening (UTC date equals SPb date)', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-21T09:00:00Z')); // 21 декабря, 12:00 МСК
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cdate')).toHaveAttribute('min', '2026-12-23');
});

test('a different biscuit is a different position (protected cart key)', async ({ page }, testInfo) => {
  await prepare(page, testInfo);
  await resetCart(page);
  await selectType(page, 'bento', testInfo);
  const vanilla = page.locator('#calcBiscuitSeg .calc-biscuit-opt').filter({ hasText: 'Ванильный' });
  await ensureCalcPanelOpen(page, testInfo);
  await expect(vanilla.first()).toHaveCount(1);
  await tapCenter(page, vanilla.first());
  await addFromCalculator(page, testInfo);
  const choco = page.locator('#calcBiscuitSeg .calc-biscuit-opt').filter({ hasText: 'Шоколадный' });
  // После добавления на телефоне панель остаётся раскрытой с подложкой —
  // закрываем её так же, как живой пользователь, и раскрываем заново.
  await closeCalcOverlay(page, testInfo);
  await ensureCalcPanelOpen(page, testInfo);
  await tapCenter(page, choco.first());
  await addFromCalculator(page, testInfo);
  const cart = await cartSnapshot(page);
  expect(cart.lineTexts).toHaveLength(2);
  expect(cart.lineTexts[0]).toContain('бисквит: ванильный');
  expect(cart.lineTexts[1]).toContain('бисквит: шоколадный');
});
