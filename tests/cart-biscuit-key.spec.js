const { test, expect } = require('@playwright/test');

/* r35: бисквит — часть личности позиции корзины.
   До этого ключ был "id:mode:fill:decor", поэтому Бенто с ванильным и шоколадным
   бисквитом сливались в одну строку (qty=2). Владелец дал ограниченное разрешение
   на расширение §3.7 AGENTS.md: пятый сегмент biscuit + идемпотентная миграция.

   Здесь проверяется то, чего не видно в обычном сценарии: старые четырёхсегментные
   корзины, повторная миграция, смена начинки и количества, экранирование разделителя
   и отсутствие выдуманного бисквита. */

const WA_HOOK = () => {
  window.__waHref = null;
  window.open = (url) => { window.__waHref = url; return { focus() {} }; };
};

async function seedAndOpen(page, storage) {
  await page.addInitScript((data) => {
    try {
      if (sessionStorage.getItem('__r35_seeded')) return;
      localStorage.setItem('milovicake_cart', JSON.stringify(data));
      sessionStorage.setItem('__r35_seeded', '1');
    } catch (e) {}
  }, storage);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  await page.evaluate(() => { if (typeof openCart === 'function') openCart(); });
  await expect(page.locator('.cart-item').first()).toBeVisible();
}

const storedCart = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('milovicake_cart') || '{}'));
const lineTexts = (page) => page.evaluate(() => [...document.querySelectorAll('.cart-item')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()));

test('a legacy bento line with a known biscuit keeps it in the key after migration', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedAndOpen(page, {
    '2:regular:Микс ягод:Базовый декор': {
      qty: 2, mode: 'regular', fill: 'Микс ягод', decor: 'Базовый декор', decorAdd: 0, biscuit: 'choco',
    },
  });

  const cart = await storedCart(page);
  expect(Object.keys(cart), 'один ключ, бисквит переехал в него').toEqual(['2:regular:Микс ягод:Базовый декор:choco']);
  expect(cart['2:regular:Микс ягод:Базовый декор:choco'].qty, 'количество не потеряно').toBe(2);
  expect(cart['2:regular:Микс ягод:Базовый декор:choco'].decor).toBe('Базовый декор');
  expect(cart['2:regular:Микс ягод:Базовый декор:choco'].biscuit).toBe('choco');

  const texts = await lineTexts(page);
  expect(texts).toHaveLength(1);
  expect(texts[0]).toContain('бисквит: шоколадный');
  expect(texts[0]).toContain('3 200 ₽'); // 2 × 1 600 ₽

  // Повторная миграция не должна ничего менять и не должна плодить строки.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  const again = await storedCart(page);
  expect(Object.keys(again)).toEqual(['2:regular:Микс ягод:Базовый декор:choco']);
  expect(again['2:regular:Микс ягод:Базовый декор:choco'].qty).toBe(2);
});

test('a legacy bento line without a biscuit never gets one invented', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    try { localStorage.setItem('milovicake_biscuit', 'choco'); } catch (e) {}
  });
  await seedAndOpen(page, {
    '2:regular:Микс ягод:Базовый декор': { qty: 2, mode: 'regular', fill: 'Микс ягод', decor: 'Базовый декор', decorAdd: 0 },
  });

  const cart = await storedCart(page);
  expect(Object.keys(cart), 'ключ остался четырёхсегментным').toEqual(['2:regular:Микс ягод:Базовый декор']);
  expect(cart['2:regular:Микс ягод:Базовый декор'].biscuit).toBeUndefined();

  const texts = await lineTexts(page);
  expect(texts[0]).not.toContain('бисквит:');

  // Даже если в калькуляторе выбран шоколадный бисквит, в сообщении его быть не должно.
  await page.evaluate(WA_HOOK);
  await page.evaluate(() => window.navigateToStep(2));
  await page.locator('#cphone').fill('+7 999 123-45-67');
  await page.locator('#btnWA').click();
  await expect.poll(async () => page.evaluate(() => window.__waHref)).not.toBeNull();
  const href = await page.evaluate(() => window.__waHref);
  const flat = decodeURIComponent(String(href).split('text=')[1] || '').replace(/[\u00a0\u202f]/g, ' ');
  expect(flat).toContain('начинка: Микс ягод');
  expect(flat, 'бисквит не выдуман из текущего выбора калькулятора').not.toContain('бисквит:');
});

test('vanilla and choco bentos stay two positions through quantity and filling edits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedAndOpen(page, {
    '2:regular:Микс ягод:Базовый декор:vanilla': { qty: 2, mode: 'regular', fill: 'Микс ягод', decor: 'Базовый декор', decorAdd: 0, biscuit: 'vanilla' },
    '2:regular:Микс ягод:Базовый декор:choco': { qty: 2, mode: 'regular', fill: 'Микс ягод', decor: 'Базовый декор', decorAdd: 0, biscuit: 'choco' },
  });

  await expect(page.locator('.cart-item')).toHaveCount(2);
  const before = await storedCart(page);
  expect(Object.keys(before).sort()).toEqual([
    '2:regular:Микс ягод:Базовый декор:choco',
    '2:regular:Микс ягод:Базовый декор:vanilla',
  ]);

  // Меняем начинку у шоколадной строки: она не должна слиться с ванильной.
  const chocoItem = page.locator('.cart-item').filter({ hasText: 'бисквит: шоколадный' });
  await expect(chocoItem).toHaveCount(1);
  await chocoItem.locator('select').selectOption('Малина');
  await page.waitForTimeout(300);

  const afterFill = await storedCart(page);
  expect(Object.keys(afterFill).sort(), 'бисквит пережил смену начинки').toEqual([
    '2:regular:Малина:Базовый декор:choco',
    '2:regular:Микс ягод:Базовый декор:vanilla',
  ]);
  await expect(page.locator('.cart-item')).toHaveCount(2);

  // Количество меняется только у шоколадной строки.
  await chocoItem.locator('.qty-btn', { hasText: '+' }).first().click();
  await page.waitForTimeout(300);
  const afterQty = await storedCart(page);
  expect(afterQty['2:regular:Малина:Базовый декор:choco'].qty).toBe(3);
  expect(afterQty['2:regular:Микс ягод:Базовый декор:vanilla'].qty).toBe(2);

  // И сообщение WhatsApp перечисляет оба бисквита разными строками.
  await page.evaluate(WA_HOOK);
  await page.evaluate(() => window.navigateToStep(2));
  await page.locator('#cphone').fill('+7 999 123-45-67');
  await page.locator('#btnWA').click();
  await expect.poll(async () => page.evaluate(() => window.__waHref)).not.toBeNull();
  const flat = decodeURIComponent(String((await page.evaluate(() => window.__waHref)).split('text=')[1] || '')).replace(/[\u00a0\u202f]/g, ' ');
  expect(flat).toContain('бисквит: шоколадный');
  expect(flat).toContain('бисквит: ванильный');
});

test('a colon inside a name survives the round trip through the cart', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Ключ в новом формате: '%3A' — экранированное двоеточие в начинке и декоре.
  await seedAndOpen(page, {
    '1:regular:Микс%3Aягод:Базовый%3Aдекор': { qty: 2, mode: 'regular', fill: 'Микс:ягод', decor: 'Базовый:декор', decorAdd: 0 },
  });

  const texts = await lineTexts(page);
  expect(texts).toHaveLength(1);
  expect(texts[0], 'декор читается целиком, а не обрезан по двоеточию').toContain('Базовый:декор');

  const cart = await storedCart(page);
  expect(Object.keys(cart), 'ключ идемпотентен и сохраняет экранирование').toEqual(['1:regular:Микс%3Aягод:Базовый%3Aдекор']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof openCart === 'function') openCart(); });
  await expect(page.locator('.cart-item')).toHaveCount(1);
  expect((await lineTexts(page))[0]).toContain('Базовый:декор');
});

test('decor without a filling no longer leaks into the filling slot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedAndOpen(page, {
    // Старый ключ: декор без начинки писался так, и при разборе попадал в начинку.
    '1:regular:Базовый декор': { qty: 2, mode: 'regular', fill: '', decor: 'Базовый декор', decorAdd: 0 },
  });

  const cart = await storedCart(page);
  expect(Object.keys(cart), 'появился пустой сегмент начинки').toEqual(['1:regular::Базовый декор']);
  expect(cart['1:regular::Базовый декор'].fill).toBe('');
  expect(cart['1:regular::Базовый декор'].decor).toBe('Базовый декор');

  const texts = await lineTexts(page);
  expect(texts[0]).toContain('Базовый декор');
  const select = page.locator('.cart-item select').first();
  if (await select.count()) await expect(select).toHaveValue('');
});
