const { test, expect } = require('@playwright/test');

/* r35: на 769–1149 px шапка не помещалась в строку: «Заказать», переключатель
   темы и корзина уезжали за правый край (недоступны), а логотип сжимался в
   четыре строки. Проверяем, что все элементы шапки внутри вьюпорта и работают. */

const WIDTHS = [769, 800, 900, 1024, 1149];

for (const width of WIDTHS) {
  test(`tablet header ${width}px keeps every control inside the viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      try { localStorage.setItem('milovicake_cart', JSON.stringify({
        '1:regular:Микс ягод:Базовый декор': { qty: 2, mode: 'regular', fill: 'Микс ягод', decor: 'Базовый декор', decorAdd: 0 },
      })); } catch (e) {}
    });
    await page.goto('/', { waitUntil: 'load' });

    const boxes = await page.evaluate(() => {
      const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; };
      return {
        vw: window.innerWidth,
        header: box('.site-header'),
        logo: box('.header-logo'),
        nav: box('.header-nav'),
        order: box('.header-nav a.header-order'),
        theme: box('#themeToggleBtn'),
        cart: box('#cartBtn'),
        links: [...document.querySelectorAll('.header-nav > a')].map((a) => { const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), left: r.left, right: r.right }; }),
        docW: document.documentElement.scrollWidth,
      };
    });

    expect(boxes.nav, 'меню существует на планшетной ширине').not.toBeNull();
    for (const [name, b] of Object.entries({ order: boxes.order, theme: boxes.theme, cart: boxes.cart })) {
      expect(b, name + ' присутствует').not.toBeNull();
      expect(b.right, name + ' не выходит за правый край').toBeLessThanOrEqual(boxes.vw + 0.5);
      expect(b.left, name + ' не уходит за левый край').toBeGreaterThanOrEqual(-0.5);
    }
    for (const link of boxes.links) {
      expect(link.right, `${link.text} внутри вьюпорта`).toBeLessThanOrEqual(boxes.vw + 0.5);
      expect(link.left, `${link.text} не перекрыт`).toBeGreaterThanOrEqual(-0.5);
    }
    // Логотип не должен переноситься: две строки (название + подпись) — максимум.
    expect(boxes.logo.h, 'логотип не сжат в несколько строк').toBeLessThanOrEqual(56);
    expect(boxes.docW, 'страница не прокручивается по горизонтали').toBeLessThanOrEqual(boxes.vw);

    // И корзина действительно открывается этой кнопкой.
    await page.locator('#cartBtn').click();
    await expect(page.locator('#cartDrawer .cart-item').first()).toBeVisible();
  });
}

test('desktop 1440 keeps the approved header intact', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'load' });
  const box = await page.evaluate(() => {
    const b = (sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) }; };
    return { vw: innerWidth, cart: b('#cartBtn'), theme: b('#themeToggleBtn'), trust: b('.header-trust'), navGap: getComputedStyle(document.querySelector('.header-nav')).gap, linkFs: getComputedStyle(document.querySelector('.header-nav a')).fontSize };
  });
  expect(box.cart.right).toBeLessThanOrEqual(box.vw);
  expect(box.theme.right).toBeLessThanOrEqual(box.vw);
  expect(box.trust.w, 'медальон сертификатов на десктопе виден').toBeGreaterThan(100);
  expect(box.navGap, 'десктопный шаг меню не сжат').toBe('32px');
  expect(box.linkFs).toBe('14px');
});

test('mobile 390 keeps the burger instead of the desktop menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('#burgerBtn')).toBeVisible();
  await expect(page.locator('.header-nav')).toBeHidden();
});
