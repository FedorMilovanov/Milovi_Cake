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

    const viewport = page.viewportSize();
    const gapToBottom = async () => {
      const rect = await nav.boundingBox();
      return rect ? viewport.height - (rect.y + rect.height) : null;
    };
    // После снятия «вуали» бар доезжает вниз за 0.28 s: измеряем установившееся
    // положение, иначе ловим середину анимации (проверено — так и падало).
    await expect.poll(
      async () => {
        const gap = await gapToBottom();
        return gap !== null && gap >= 0 && gap <= 24;
      },
      { timeout: 8000, message: `${path}: бар не встал у нижней кромки экрана` },
    ).toBe(true);

    const box = await nav.boundingBox();
    expect(box, `${path}: у бара нет бокса`).not.toBeNull();
    expect(viewport.height - (box.y + box.height), `${path}: бар не прижат к низу`)
      .toBeLessThanOrEqual(24);

    // Высота тела бара — --mc-nav-h (60px); на телефоне с home-indicator
    // к ней добавляется safe-area, поэтому проверяем нижнюю границу.
    expect(box.height, `${path}: бар ниже штатной высоты`).toBeGreaterThanOrEqual(48);
    expect(box.x, `${path}: бар вылезает за левый край`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${path}: бар вылезает за правый край`)
      .toBeLessThanOrEqual(viewport.width + 1);
  });
}

// Негативный контроль механизма (а не страницы): доказываем, что дефект
// «страница без токенов» реально уносит бар за экран, а не просто
// «выглядит подозрительно». Токены гасим на живой странице так же, как их
// нет на странице без style.css: значение — гарантированно недействительное,
// поэтому var() без фолбэка в !important-правиле (v20-fixes.css:570-572)
// вырождается в unset (auto), и бар встаёт по статической позиции в конце
// документа. Фолбэк из nav.js (не !important) при этом проигрывает каскад.
test('@mobile-shell механизм: без токенов бар уезжает за экран', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('desktop'), 'nav.js строит бар только на телефоне');
  await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
  await page.locator('#mcNav').waitFor({ state: 'attached' });

  // С токенами bottom — конкретное число (--mc-nav-gap = 8px): бар прижат
  // к нижней кромке на эту величину.
  const withTokens = await page.locator('#mcNav')
    .evaluate((el) => parseFloat(getComputedStyle(el).bottom));
  expect(Number.isFinite(withTokens), 'бар обязан считать bottom от токенов страницы').toBe(true);
  expect(Math.abs(withTokens)).toBeLessThanOrEqual(24);

  await page.addStyleTag({
    content: ':root{--mc-safe-b:initial;--mc-nav-side:initial;--mc-nav-gap:initial;'
      + '--mc-nav-h:initial;--mc-nav-total:initial;}',
  });

  // Chromium отдаёт для position:fixed не слово auto, а вычисленное
  // (used) значение: бар уезжает по статической позиции — в конец документа,
  // на тысячи пикселей ниже экрана. Именно это и было на /meringue-roll/
  // до правки: страница не объявляла токены, а v20-fixes.css читает их
  // без фолбэка в !important-правиле.
  const withoutTokens = await page.locator('#mcNav')
    .evaluate((el) => parseFloat(getComputedStyle(el).bottom));
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(withoutTokens, 'бар обязан уехать за пределы экрана без токенов')
    .toBeLessThan(-viewportHeight);
});
