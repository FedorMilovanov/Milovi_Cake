// Нижний бар (.mc-nav) собирает js/nav.js, а геометрию ему задают
// css/v20-fixes.css и css/final-fixes.css — через токены --mc-nav-*.
// Единственное объявление этих токенов живёт в :root файла css/style.css.
// Если страница подключает nav.js, но не style.css, адресация в !important-
// объявлениях остаётся без фолбэка: неразрешённый var() делает объявление
// недействительным при вычислении значения, свойство получает unset (auto) —
// и бар теряет привязку к нижней кромке экрана, а шторка «Ещё» — свой якорь.
// Ровно это случилось с /meringue-roll/ (единственная такая страница в сайте).
// Гард держит договор: токены объявлены, бар реально прижат к низу.
const { test, expect } = require('@playwright/test');

const SHELL_PAGES = ['/', '/meringue-roll/', '/prigorody/gatchina/'];
const SHELL_TOKENS = [
  '--mc-safe-b',
  '--mc-nav-side',
  '--mc-nav-gap',
  '--mc-nav-h',
  '--mc-nav-total',
];

for (const path of SHELL_PAGES) {
  test(`@mobile-shell ${path}: нижний бар прижат к экрану и считает от токенов`, async ({ page }, testInfo) => {
    const mobile = !testInfo.project.name.endsWith('desktop');
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mcNav', { state: 'attached' });

    const missingTokens = await page.evaluate((tokens) => {
      const computed = getComputedStyle(document.documentElement);
      return tokens.filter((token) => !computed.getPropertyValue(token).trim());
    }, SHELL_TOKENS);
    expect(missingTokens, `${path}: не объявлены токены нижнего бара`).toEqual([]);

    const nav = page.locator('#mcNav');
    if (!mobile) {
      await expect(nav, `${path}: на десктопе бар не показывается`).toBeHidden();
      return;
    }

    const box = await nav.boundingBox();
    expect(box, `${path}: бар не отрисован`).not.toBeNull();
    const viewport = page.viewportSize();

    // Прижат к низу: зазор --mc-nav-gap (8px) плюс safe-area. Допуск — на
    // субпиксельную вёрстку и скроллбар, но не на «уехал в конец документа».
    const gapToBottom = viewport.height - (box.y + box.height);
    expect(gapToBottom, `${path}: бар не прижат к низу экрана`).toBeLessThanOrEqual(24);
    expect(gapToBottom, `${path}: бар не должен висеть над низом`).toBeGreaterThanOrEqual(0);

    // Высота тела бара — --mc-nav-h (60px); на телефоне с home-indicator
    // к ней добавляется safe-area, поэтому проверяем нижнюю границу.
    expect(box.height, `${path}: бар ниже штатной высоты`).toBeGreaterThanOrEqual(48);
    expect(box.x, `${path}: бар вылезает за левый край`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${path}: бар вылезает за правый край`)
      .toBeLessThanOrEqual(viewport.width + 1);
  });
}
