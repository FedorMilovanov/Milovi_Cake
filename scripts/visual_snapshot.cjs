#!/usr/bin/env node
/* Визуальный snapshot для regression-проверки UI.
   Снимает скриншоты ключевых страниц и интерактивных состояний.
   Сохраняет в указанной директории. Используется парами before/after
   с pixel-diff между ними.

   Запуск:
     node scripts/visual_snapshot.cjs /tmp/snap-before [base-url]
     node scripts/visual_snapshot.cjs /tmp/snap-after  http://localhost:8765
*/

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || '/tmp/snap';
const BASE = process.argv[3] || 'http://localhost:8765';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE  = { width: 412,  height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  // Маленькая пауза для стабильности перед каждым скриншотом
  await page.waitForTimeout(opts.wait ?? 300);
  await page.screenshot({
    path: file,
    fullPage: opts.full ?? false,
    clip: opts.clip,
    animations: 'disabled',
  });
  console.log('  saved', name + '.png');
}

async function withPage(browser, viewport, name, fn, opts = {}) {
  const ctx = await browser.newContext({
    viewport,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    deviceScaleFactor: viewport.deviceScaleFactor,
    colorScheme: opts.scheme || 'light',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await fn(page);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();

  // --- 1. Главная: desktop light idle ---
  await withPage(browser, DESKTOP, 'home-desktop-light', async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, 'home-desktop-light-top');
    // прокрутим к hero messenger area
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'home-desktop-light-hero', { clip: { x: 0, y: 0, width: 1440, height: 900 } });
  });

  // --- 2. Главная: desktop dark ---
  await withPage(browser, DESKTOP, 'home-desktop-dark', async (page) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('mc_theme', 'dark'); } catch(e) {}
    });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, 'home-desktop-dark-top');
  }, { scheme: 'dark' });

  // --- 3. Главная: mobile ---
  await withPage(browser, MOBILE, 'home-mobile', async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, 'home-mobile-top');
  });

  // --- 4. Hero messenger hover (WA/TG/MAX по очереди) ---
  await withPage(browser, DESKTOP, 'hero-messenger-hover', async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    // Найдём первый btn-hero-wa
    for (const cls of ['btn-hero-wa', 'btn-hero-tg', 'btn-hero-max']) {
      const sel = `.${cls}.btn-hero-ring`;
      const el = await page.$(sel);
      if (el) {
        const box = await el.boundingBox();
        if (box) {
          // снимем зону вокруг этой кнопки
          await el.hover();
          await page.waitForTimeout(600); // ждём анимацию
          const expand = 80;
          const clip = {
            x: Math.max(0, box.x - expand),
            y: Math.max(0, box.y - expand),
            width: Math.min(1440 - Math.max(0, box.x - expand), box.width + expand * 2),
            height: Math.min(900 - Math.max(0, box.y - expand), box.height + expand * 2),
          };
          await shot(page, `hero-${cls}-hover`, { clip });
          // отведём мышь
          await page.mouse.move(0, 0);
          await page.waitForTimeout(300);
        }
      }
    }
  });

  // --- 5. Galery: desktop ---
  await withPage(browser, DESKTOP, 'gallery-desktop', async (page) => {
    await page.goto(`${BASE}/gallery/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, 'gallery-desktop-top');
  });

  // --- 6. Lightbox open ---
  await withPage(browser, DESKTOP, 'lightbox', async (page) => {
    await page.goto(`${BASE}/gallery/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const card = await page.$('.card');
    if (card) {
      await card.click();
      await page.waitForTimeout(2500);
      await shot(page, 'gallery-lightbox-open');
    }
  });

  // --- 7. Свадебный лендинг ---
  await withPage(browser, DESKTOP, 'svadebnye', async (page) => {
    await page.goto(`${BASE}/svadebnye-torty/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, 'svadebnye-desktop-top');
  });

  // --- 8. Bento лендинг ---
  await withPage(browser, DESKTOP, 'bento', async (page) => {
    await page.goto(`${BASE}/bento-torty/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, 'bento-desktop-top');
  });

  // --- 9. Пригороды Гатчина ---
  await withPage(browser, DESKTOP, 'prigorody', async (page) => {
    await page.goto(`${BASE}/prigorody/gatchina/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, 'prigorody-gatchina-top');
  });

  // --- 10. Reviews carousel/modal на главной ---
  await withPage(browser, DESKTOP, 'reviews', async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    // прокрутим к секции отзывов
    const reviews = await page.$('.reviews, #reviews, [class*="review"]');
    if (reviews) {
      await reviews.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await shot(page, 'reviews-area');
    }
  });

  // --- 11. Otzyvy trust-страница ---
  await withPage(browser, DESKTOP, 'otzyvy', async (page) => {
    await page.goto(`${BASE}/otzyvy/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, 'otzyvy-desktop-top');
  });

  await browser.close();
  console.log(`Done. ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
