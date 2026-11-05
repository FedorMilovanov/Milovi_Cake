// Геометрия картинок: два дефекта, найденные в браузере, и страж на каждый.
//
// 1. Атрибуты width/height у <img> в CSS-контексте (height:auto) задают высоту
//    сами. Если атрибуты не описывают кадр честно, коробка врёт, и любая
//    правка «по атрибутам» ломает раскладку. Проверка: если соотношение из
//    атрибутов не совпадает с фактическим, коробка обязана не зависеть от них.
// 2. object-fit:fill на картинке с другим соотношением = растянутое фото.
//    На /meringue-roll/ декор был растянут на 20.8% (desktop) и до 65% на
//    мобиле — это видно глазом, но не ловилось ни одним тестом.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const PAGES = [
  '/',
  '/bento-torty/',
  '/detskie-torty/',
  '/svadebnye-torty/',
  '/tort-na-den-rozhdeniya/',
  '/tort-s-dostavkoy/',
  '/zakazat-tort-spb/',
  '/meringue-roll/',
  '/certificates/',
  '/prigorody/gatchina/',
];

// Ленивые картинки должны быть в документе, иначе замер попадает на плейсхолдер.
async function warmImages(page) {
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager';
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

test.describe('image geometry contracts', () => {
  for (const route of PAGES) {
    test(`${route} — картинка не зависит от неверных width/height`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await warmImages(page);

      const violations = await page.evaluate(() => {
        const bad = [];
        for (const img of document.images) {
          const w = img.getAttribute('width');
          const h = img.getAttribute('height');
          if (!img.complete || !img.naturalWidth || !w || !h) continue;
          const box = img.getBoundingClientRect();
          if (!box.width || !box.height) continue;

          const attrRatio = Number(w) / Number(h);
          const boxRatio = box.width / box.height;
          const attrRatioInverted = Number(h) / Number(w);
          const honest = Math.abs(attrRatio - boxRatio) <= 0.02 * boxRatio
            || Math.abs(attrRatioInverted - boxRatio) <= 0.02 * boxRatio;
          if (honest) continue;

          // Атрибуты врут. Коробка имеет право меняться только вместе с ними.
          img.setAttribute('width', '997');
          img.setAttribute('height', '331');
          const moved = img.getBoundingClientRect();
          img.setAttribute('width', w);
          img.setAttribute('height', h);

          if (Math.abs(moved.width - box.width) > 1 || Math.abs(moved.height - box.height) > 1) {
            bad.push({
              src: (img.currentSrc || img.src).split('/').pop(),
              attr: `${w}x${h}`,
              box: `${Math.round(box.width)}x${Math.round(box.height)}`,
              natural: `${img.naturalWidth}x${img.naturalHeight}`,
            });
          }
        }
        return bad;
      });

      expect(violations, `Коробка картинки управляется атрибутами, которые не описывают кадр: ${JSON.stringify(violations)}`).toEqual([]);
    });

    test(`${route} — фото не растянуто`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await warmImages(page);

      const stretched = await page.evaluate(() => {
        const bad = [];
        for (const img of document.images) {
          if (!img.complete || !img.naturalWidth) continue;
          const style = getComputedStyle(img);
          // Растяжение возможно только при fill. cover/contain сохраняют пропорции.
          if (style.objectFit !== 'fill') continue;
          const box = img.getBoundingClientRect();
          if (!box.width || !box.height) continue;
          const distortion = Math.abs((box.width / box.height) / (img.naturalWidth / img.naturalHeight) - 1) * 100;
          if (distortion > 2) {
            bad.push({
              src: (img.currentSrc || img.src).split('/').pop(),
              box: `${Math.round(box.width)}x${Math.round(box.height)}`,
              natural: `${img.naturalWidth}x${img.naturalHeight}`,
              distortion: `${distortion.toFixed(1)}%`,
            });
          }
        }
        return bad;
      });

      expect(stretched, `Растянутые картинки: ${JSON.stringify(stretched)}`).toEqual([]);
    });
  }

  // Рамка лайтбокса раньше была фиксированной (1200x800 из атрибутов), поэтому
  // вертикальное фото занимало лишь 42% площади — широкие пустые поля внутри
  // рамки. Проверяем, что фото заполняет рамку и в портретной, и в альбомной
  // ориентации.
  test('лайтбокс обнимает фото в обеих ориентациях', async ({ page }) => {
    for (const src of ['/img/bento_4.avif', '/img/cert_akvarel.webp']) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const fill = await page.evaluate(async (source) => {
        const probe = new Image();
        probe.src = source;
        await new Promise((resolve) => { probe.onload = resolve; probe.onerror = resolve; });

        const img = document.getElementById('lightboxImg');
        img.src = source;
        await new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 1) resolve();
          else img.onload = resolve;
        });
        document.getElementById('lightbox').classList.add('open');
        await new Promise((resolve) => setTimeout(resolve, 600));

        const box = img.getBoundingClientRect();
        const natural = img.naturalWidth / img.naturalHeight;
        const frame = box.width / box.height;
        const drawn = natural > frame
          ? { w: box.width, h: box.width / natural }
          : { w: box.height * natural, h: box.height };
        return (100 * drawn.w * drawn.h) / (box.width * box.height);
      }, src);

      expect(fill, `${src}: фото занимает ${fill.toFixed(1)}% рамки`).toBeGreaterThan(95);
    }
  });
});

// Review filmstrip: suburb miniatures must not download full-size image payloads.
test('all suburb review filmstrips use thumbnails without degrading the lightbox', () => {
  const root = path.resolve(__dirname, '..');
  const suburbs = path.join(root, 'prigorody');
  const pages = fs.readdirSync(suburbs, { withFileTypes: true })
    .filter(entry => entry.isDirectory()
      && fs.existsSync(path.join(suburbs, entry.name, 'index.html')))
    .map(entry => path.join(suburbs, entry.name, 'index.html'))
    .sort();

  expect(pages).toHaveLength(14);
  for (const file of [path.join(suburbs, '_template.html'), ...pages]) {
    const html = fs.readFileSync(file, 'utf8');
    for (let i = 1; i <= 8; i++) {
      expect(html, file).toContain('src="../../img/review_' + i + '-thumb.webp"');
      expect(html, file).not.toContain('src="../../img/review_' + i + '.webp"');
      expect(fs.existsSync(path.join(root, 'img', 'review_' + i + '-thumb.webp'))).toBe(true);
      expect(fs.existsSync(path.join(root, 'img', 'review_' + i + '.webp'))).toBe(true);
    }
  }
  const js = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
  expect(js).toContain('const CHAT_SRCS = ');
  for (let i = 1; i <= 8; i++) {
    expect(js).toContain("IMG_BASE + '/review_" + i + ".webp'");
  }
});
