// Нижний бар (.mc-nav) собирает js/nav.js, а геометрию ему задают
// css/v20-fixes.css и css/final-fixes.css — через токены --mc-nav-*.
// Единственное объявление этих токенов живёт в :root файла css/style.css.
// Если страница подключает nav.js, но не style.css, адресация в !important-
// объявлениях остаётся без фолбэка: неразрешённый var() делает объявление
// недействительным при вычислении значения, свойство получает unset (auto) —
// и бар теряет привязку к нижней кромке экрана, а шторка «Ещё» — свой якорь.
// Ровно это случилось с /meringue-roll/ (единственная такая страница в сайте).
// Гард держит договор: токены объявлены, у бара есть конкретный bottom,
// и он реально прижат к низу экрана.
const { test, expect } = require('@playwright/test');

const SHELL_PAGES = ['/', '/meringue-roll/', '/prigorody/gatchina/'];
const SHELL_TOKENS = [
  '--mc-safe-b',
  '--mc-nav-side',
  '--mc-nav-gap',
  '--mc-nav-h',
  '--mc-nav-total',
];

// nav.js строит бар только на телефоне (bootstrap: window.innerWidth <= 768),
// а на первом экране бар «прикрыт» классом body.mc-nav-veiled — как в
// tests/cart-accessibility.spec.js, прокручиваем страницу, как живой человек.
async function revealMobileShell(page) {
  await page.locator('#mcNav').waitFor({ state: 'attached' });
  if (await page.evaluate(() => document.body.classList.contains('mc-nav-veiled'))) {
    await page.evaluate(() => window.scrollTo(0, Math.max(520, Math.round(window.innerHeight * 0.8))));
    await page.waitForFunction(() => !document.body.classList.contains('mc-nav-veiled'), null, { timeout: 15000 });
  }
}

for (const path of SHELL_PAGES) {
  test(`@mobile-shell ${path}: нижний бар прижат к экрану и считает от токенов`, async ({ page }, testInfo) => {
    const mobile = !testInfo.project.name.endsWith('desktop');
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    // Токены нужны на любом вьюпорте: их читают и правила бара, и шторка.
    const missingTokens = await page.evaluate((tokens) => {
      const computed = getComputedStyle(document.documentElement);
      return tokens.filter((token) => !computed.getPropertyValue(token).trim());
    }, SHELL_TOKENS);
    expect(missingTokens, `${path}: не объявлены токены нижнего бара`).toEqual([]);

    if (!mobile) {
      // На десктопе nav.js бар не строит вовсе — это штатное поведение.
      expect(await page.locator('#mcNav').count(), `${path}: на десктопе бар не строится`).toBe(0);
      return;
    }

    await revealMobileShell(page);
    const nav = page.locator('#mcNav');
    await expect(nav, `${path}: бар не показан после прокрутки`).toBeVisible();

    // Прямая проверка того самого дефекта: при неразрешённых токенах
    // вычисленный bottom равен auto, и бар встаёт по статической позиции.
    const bottom = await nav.evaluate((el) => getComputedStyle(el).bottom);
    expect(bottom, `${path}: у бара не вычисляется bottom`).not.toBe('auto');
    expect(parseFloat(bottom), `${path}: bottom бара не число`).not.toBeNaN();

    const box = await nav.boundingBox();
    expect(box, `${path}: у бара нет бокса`).not.toBeNull();
    const viewport = page.viewportSize();
    const gapToBottom = viewport.height - (box.y + box.height);
    expect(gapToBottom, `${path}: бар не прижат к низу экрана`).toBeLessThanOrEqual(24);
    expect(gapToBottom, `${path}: бар висит над низом`).toBeGreaterThanOrEqual(0);

    // Высота тела бара — --mc-nav-h (60px); на телефоне с home-indicator
    // к ней добавляется safe-area, поэтому проверяем нижнюю границу.
    expect(box.height, `${path}: бар ниже штатной высоты`).toBeGreaterThanOrEqual(48);
    expect(box.x, `${path}: бар вылезает за левый край`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${path}: бар вылезает за правый край`)
      .toBeLessThanOrEqual(viewport.width + 1);
  });
}

// Негативный контроль механизма (а не страницы): доказываем, что дефект
// «страница без токенов» действительно даёт bottom:auto, а не просто
// «выглядит подозрительно». Токены гасим на живой странице так же, как их
// нет на странице без style.css: значение — гарантированно недействительное,
// поэтому var() без фолбэка в !important-правиле (v20-fixes.css:570-572)
// обязан выродиться в unset, то есть auto. Фолбэк из nav.js (не !important)
// при этом проигрывает каскад.
test('@mobile-shell механизм: без токенов bottom бара становится auto', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('desktop'), 'nav.js строит бар только на телефоне');
  await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
  await page.locator('#mcNav').waitFor({ state: 'attached' });

  const withTokens = await page.locator('#mcNav').evaluate((el) => getComputedStyle(el).bottom);
  expect(withTokens, 'бар обязан считать bottom от токенов страницы').not.toBe('auto');

  await page.addStyleTag({
    content: ':root{--mc-safe-b:initial;--mc-nav-side:initial;--mc-nav-gap:initial;'
      + '--mc-nav-h:initial;--mc-nav-total:initial;}',
  });

  const withoutTokens = await page.locator('#mcNav').evaluate((el) => getComputedStyle(el).bottom);
  expect(withoutTokens, 'неразрешённый var() в !important-правиле обязан дать auto').toBe('auto');
});
