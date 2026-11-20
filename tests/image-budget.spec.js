// Бюджеты веса картинок на /meringue-roll/ + контракт адаптивных изображений.
//
// История: страница годами возила портретные оригиналы 1024×1536 (59–103 КБ каждый)
// в рамки, где object-fit: cover срезал две трети кадра; hero-AVIF весил 117 660 Б
// при fetchpriority=high; декоративная иконка 30×30 была файлом на 61 514 Б.
// После переезда на srcset/sizes с испечёнными кадрами:
//   · телефон (390 CSS, DPR≈2.6): hero 50 852 Б вместо 117 660 Б;
//   · десктоп (1440 CSS, DPR1): hero 58 919 Б вместо 117 660 Б;
//   · иконка карточки «Ручная работа»: 1 654 Б вместо 61 514 Б.
// Тест держит и вес, и сам контракт (srcset/sizes у каждого <picture>), иначе
// следующая правка молча вернёт портреты в плитки.
const { test, expect } = require('@playwright/test');

const PAGE = '/meringue-roll/';
const HERO_FILE_BUDGET = 60 * 1024;           // факт: 34 692 Б (DPR1) … 50 852 Б (Pixel 7)
const MOBILE_FIRST_VIEW_BUDGET = 180 * 1024;  // hero + плитки, попавшие в запас lazy-загрузки
const MOBILE_FULL_BUDGET = 380 * 1024;        // факт ≈ 317 КБ (было ≈ 663 КБ)
const DECOR_ICON_BUDGET = 20 * 1024;          // <img>, нарисованный ≤64 px

async function collectImageBytes(page) {
  const bytes = new Map();
  const requests = [];
  page.on('response', async (response) => {
    const request = response.request();
    if (request.resourceType() !== 'image') return;
    const url = response.url();
    requests.push(url);
    if (bytes.has(url)) return;
    try {
      const body = await response.body();
      bytes.set(url, body.length);
    } catch {
      /* редирект или отменённый запрос — не считаем */
    }
  });
  return { bytes, requests };
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager';
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
}

test('@image-budget meringue: первый экран телефона не толще бюджета, hero скачан один раз', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('desktop'), 'бюджет снят с мобильного профиля (Pixel 7)');
  const { bytes, requests } = await collectImageBytes(page);

  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const firstView = [...bytes.values()].reduce((sum, n) => sum + n, 0);
  const heroFiles = requests.filter((url) => url.includes('/img/meringue_roll-hero-'));

  // Preload (imagesrcset/imagesizes) обязан совпадать с <picture> байт-в-байт:
  // расхождение даёт два скачивания одной и той же картинки.
  expect(heroFiles, `hero скачан ${heroFiles.length} раз(а): ${heroFiles.join(', ')}`).toHaveLength(1);
  const heroBytes = bytes.get(heroFiles[0]);
  expect(heroBytes, 'вес hero не измерен').toBeDefined();
  expect(heroBytes, `hero: ${Math.round(heroBytes / 1024)} КБ (было 117 660 Б портретного кадра)`)
    .toBeLessThanOrEqual(HERO_FILE_BUDGET);
  expect(firstView, `первый экран: ${Math.round(firstView / 1024)} КБ картинок`)
    .toBeLessThanOrEqual(MOBILE_FIRST_VIEW_BUDGET);

  await scrollThrough(page);
  await page.waitForTimeout(600);
  const total = [...bytes.values()].reduce((sum, n) => sum + n, 0);
  expect(total, `вся страница: ${Math.round(total / 1024)} КБ картинок`)
    .toBeLessThanOrEqual(MOBILE_FULL_BUDGET);
});

test('@image-budget meringue: декоративные картинки не тяжелее бюджета', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  const { bytes } = await collectImageBytes(page);
  await scrollThrough(page);
  await page.waitForTimeout(600);

  // Находим картинки, которые нарисованы мелко (≤64 CSS px), и сверяем их вес.
  const tiny = await page.evaluate(() => document.images
    .filter((img) => {
      const box = img.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && Math.max(box.width, box.height) <= 64;
    })
    .map((img) => img.currentSrc || img.src)
    .filter((url) => url.startsWith('http')));  // data:-заглушка лайтбокса не файл

  const oversized = [];
  for (const url of tiny) {
    let size = bytes.get(url);
    if (size === undefined) {
      // Картинка могла быть забрана из кеша до старта наблюдателя — проверим запросом.
      const response = await page.request.get(url);
      size = (await response.body()).length;
    }
    if (size > DECOR_ICON_BUDGET) oversized.push(`${url.split('/').pop()}: ${Math.round(size / 1024)} КБ`);
  }
  expect(oversized, `мелкие картинки тяжелее ${DECOR_ICON_BUDGET / 1024} КБ`).toEqual([]);
});

test('@image-budget meringue: у каждого <picture> есть srcset и sizes', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  const violations = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('picture').forEach((picture, index) => {
      const sources = [...picture.querySelectorAll('source')];
      const img = picture.querySelector('img');
      const mediaSource = sources.some((source) => source.hasAttribute('media'));
      if (!img) bad.push(`#${index}: нет <img>`);
      if (!sources.length) bad.push(`#${index}: нет <source type="image/avif">`);
      sources.forEach((source, sourceIndex) => {
        if (!source.getAttribute('srcset')) bad.push(`#${index} source#${sourceIndex}: нет srcset`);
        if (!source.getAttribute('sizes')) bad.push(`#${index} source#${sourceIndex}: нет sizes`);
        if (source.getAttribute('type') !== 'image/avif') {
          bad.push(`#${index} source#${sourceIndex}: тип ${source.getAttribute('type')}`);
        }
      });
      // Арт-дирекшн (разные кадры под брейкпоинты) живёт в <source media>,
      // поэтому <img> без srcset допустим только в этом случае.
      if (img && !mediaSource) {
        if (!img.getAttribute('srcset')) bad.push(`#${index} img: нет srcset`);
        if (!img.getAttribute('sizes')) bad.push(`#${index} img: нет sizes`);
      }
    });
    return bad;
  });
  expect(violations).toEqual([]);
});
