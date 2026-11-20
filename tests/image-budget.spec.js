// Бюджеты веса картинок на /meringue-roll/ + контракт адаптивных изображений.
//
// История: страница возила портретные оригиналы 1024×1536 (59–103 КБ каждый) в рамки,
// где object-fit: cover срезал две трети кадра; hero-AVIF весил 117 660 Б при
// fetchpriority=high; декоративная иконка 30×30 была файлом на 61 514 Б.
// После переезда на srcset/sizes с испечёнными кадрами (AVIF, уникальные файлы):
//   · телефон (Pixel 7, 412 CSS, DPR 2.625): hero 50 852 Б вместо 117 660 Б;
//   · телефон с DPR 1 (390 CSS): hero 34 692 Б вместо 117 660 Б;
//   · десктоп (1440 CSS, DPR1): hero 58 919 Б вместо 117 660 Б;
//   · иконка карточки «Ручная работа»: 1 654 Б вместо 61 514 Б;
//   · все отрисованные файлы страницы: 318 755 Б на телефоне и 234 259 Б на
//     десктопе вместо 576 365 Б на любом вьюпорте.
//
// Почему бюджет считается по currentSrc, а не по всем сетевым запросам:
// Chromium с isMobile-эмуляцией стартует с layout-вьюпорта 980 px и до применения
// <meta viewport> успевает выбрать кандидата по sizes=100vw — в сети оказываются
// два файла на слот, хотя отрисован один. Это артефакт эмуляции, а не реальная
// стоимость страницы, поэтому весовой контракт держится на том, что реально
// нарисовано, а «двойное скачивание» проверяется там, где оно настоящее —
// на hero (preload + <picture> должны совпадать ровно).
const { test, expect } = require('@playwright/test');

const PAGE = '/meringue-roll/';
const HERO_FILE_BUDGET = 60 * 1024;           // факт: 34 692 Б (DPR1) … 50 852 Б (Pixel 7)
const MOBILE_DRAWN_BUDGET = 340 * 1024;       // факт 318 755 Б (было 576 365 Б)
const DESKTOP_DRAWN_BUDGET = 260 * 1024;      // факт 234 259 Б (было 576 365 Б)
const DECOR_ICON_BUDGET = 20 * 1024;          // <img>, нарисованный ≤64 px

function isDesktop(testInfo) {
  return testInfo.project.name.endsWith('desktop');
}

async function collectImageBytes(page) {
  const bytes = new Map();
  const requests = [];
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'image') return;
    const url = response.url();
    requests.push(url);
    if (bytes.has(url)) return;
    try {
      bytes.set(url, (await response.body()).length);
    } catch {
      /* редирект или отменённый запрос — не считаем */
    }
  });
  return { bytes, requests };
}

async function sizeOf(page, bytes, url) {
  if (bytes.has(url)) return bytes.get(url);
  const response = await page.request.get(url);
  return (await response.body()).length;
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

test('@image-budget meringue: hero скачан один раз и укладывается в бюджет', async ({ page }) => {
  const { bytes, requests } = await collectImageBytes(page);
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const heroFiles = requests.filter((url) => url.includes('/img/meringue_roll-hero-'));
  // Preload (imagesrcset/imagesizes) обязан совпадать с <picture> байт-в-байт:
  // расхождение даёт два скачивания одной и той же картинки.
  expect(heroFiles, `hero скачан ${heroFiles.length} раз(а): ${heroFiles.join(', ')}`).toHaveLength(1);
  const heroBytes = await sizeOf(page, bytes, heroFiles[0]);
  expect(heroBytes, `hero: ${Math.round(heroBytes / 1024)} КБ (было 117 660 Б портретного кадра)`)
    .toBeLessThanOrEqual(HERO_FILE_BUDGET);
});

test('@image-budget meringue: суммарный вес отрисованных картинок в бюджете', async ({ page }, testInfo) => {
  const { bytes } = await collectImageBytes(page);
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await scrollThrough(page);
  await page.waitForTimeout(600);

  const drawn = await page.evaluate(() => [...document.images]
    .filter((img) => img.currentSrc && img.currentSrc.startsWith(location.origin))
    .map((img) => img.currentSrc));
  const unique = [...new Set(drawn)];

  let total = 0;
  const heavy = [];
  for (const url of unique) {
    const size = await sizeOf(page, bytes, url);
    total += size;
    heavy.push([url.split('/').pop(), size]);
  }
  heavy.sort((a, b) => b[1] - a[1]);

  const budget = isDesktop(testInfo) ? DESKTOP_DRAWN_BUDGET : MOBILE_DRAWN_BUDGET;
  const top = heavy.slice(0, 6).map(([name, size]) => `${name} ${Math.round(size / 1024)} КБ`).join(', ');
  expect(total, `нарисовано ${unique.length} файлов, ${Math.round(total / 1024)} КБ (было 576 365 Б). `
    + `Крупнейшие: ${top}`).toBeLessThanOrEqual(budget);
});

test('@image-budget meringue: декоративные картинки не тяжелее бюджета', async ({ page }) => {
  const { bytes } = await collectImageBytes(page);
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await scrollThrough(page);
  await page.waitForTimeout(600);

  // Картинки, нарисованные мелко (≤64 CSS px), не имеют права весить как фото.
  const tiny = await page.evaluate(() => [...document.images]
    .filter((img) => {
      const box = img.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && Math.max(box.width, box.height) <= 64;
    })
    .map((img) => img.currentSrc || img.src)
    .filter((url) => url.startsWith('http')));

  const oversized = [];
  for (const url of tiny) {
    const size = await sizeOf(page, bytes, url);
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
