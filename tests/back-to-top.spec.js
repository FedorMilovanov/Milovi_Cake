// Регрессия «наверх» (r32): уход от интерактива FAQ, одно сглаживание кольца,
// восстановление прогресса без ручного скролла, матовое наведение в тёмной теме.
const { test, expect } = require('@playwright/test');

/* Прокрутка без плавной анимации: иначе замер кольца ловит середину
   инерционного скролла и расхождение с ожидаемым прогрессом — это шум,
   а не дефект. */
async function jumpTo(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function openHome(page, width, height, theme) {
  await page.setViewportSize({ width, height });
  if (theme) {
    await page.addInitScript((t) => {
      try { localStorage.setItem('mc_theme', t); } catch (e) {}
    }, theme);
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#backToTop')).toHaveCount(1);
  await page.waitForTimeout(400);
}

test('back-to-top steps aside from FAQ rows and never takes the plus tap', async ({ page }) => {
  await openHome(page, 390, 780);

  // Совмещаем «+» второго вопроса с кнопкой — раньше рамка кнопки и знак
  // расходились на 4 px, теперь кнопка обязана уйти минимум на 12 px.
  const placed = await page.evaluate(() => {
    const btt = document.getElementById('backToTop').getBoundingClientRect();
    const icon = document.querySelectorAll('.cb-faq-ico')[1];
    const r = icon.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + (r.top - (btt.top + btt.height / 2)), behavior: 'instant' });
    return true;
  });
  expect(placed).toBe(true);
  await expect(page.locator('#backToTop')).toHaveClass(/btt-obstructed/);

  const state = await page.evaluate(() => {
    const btt = document.getElementById('backToTop');
    const css = getComputedStyle(btt);
    const icons = [...document.querySelectorAll('.cb-faq-ico')];
    const hits = icons.map((el) => {
      const r = el.getBoundingClientRect();
      if (!r.height || r.bottom < 0 || r.top > innerHeight) return 'offscreen';
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit ? (hit.closest('#backToTop') ? 'BTT' : 'FAQ') : 'none';
    });
    return { opacity: css.opacity, pointerEvents: css.pointerEvents, hits };
  });
  expect(state.opacity).toBe('0');
  expect(state.pointerEvents).toBe('none');
  expect(state.hits).not.toContain('BTT');

  // После FAQ кнопка возвращается — уход не «залипает».
  await jumpTo(page, await page.evaluate(() => window.scrollY + 1400));
  await expect(page.locator('#backToTop')).not.toHaveClass(/btt-obstructed/);
  await expect(page.locator('#backToTop')).toHaveClass(/visible/);
});

test('back-to-top restores progress and visibility without any scroll', async ({ page }) => {
  await openHome(page, 390, 780);
  await jumpTo(page, await page.evaluate(() => Math.round(document.documentElement.scrollHeight * 0.5)));
  await expect(page.locator('#backToTop')).toHaveClass(/visible/);
  await page.waitForTimeout(300);

  const read = () => page.evaluate(() => {
    const fill = document.querySelector('.btt-ring-fill');
    const total = document.documentElement.scrollHeight - window.innerHeight;
    return {
      offset: Number(fill.style.strokeDashoffset),
      expected: Number(((1 - window.scrollY / total) * 100).toFixed(2)),
      visible: document.getElementById('backToTop').classList.contains('visible'),
      bar: document.getElementById('scroll-progress').style.width,
    };
  });

  const before = await read();
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  const after = await read();

  // После перезагрузки браузер восстанавливает позицию: до первого скролла
  // кольцо и кнопка должны сразу отражать её, а не вчерашнее значение.
  expect(after.visible).toBe(true);
  expect(Math.abs(after.offset - after.expected)).toBeLessThan(0.6);
  expect(after.offset).toBeCloseTo(before.offset, 0);
  expect(after.bar).toMatch(/%$/);
});

test('back-to-top ring has a single smoothing source (no CSS catch-up)', async ({ page }) => {
  await openHome(page, 390, 780);
  await jumpTo(page, 1800);

  const ring = await page.evaluate(() => {
    const fill = document.querySelector('.btt-ring-fill');
    const css = getComputedStyle(fill);
    return { transitionProperty: css.transitionProperty, transitionDuration: css.transitionDuration };
  });
  // Сглаживание пишет rAF в main.js; CSS-transition на dashoffset давала
  // второе, запаздывающее сглаживание и кольцо отставало от страницы.
  // Длительность 0s = анимации нет («all 0s» — начальное значение, не правило).
  expect(ring.transitionProperty).not.toMatch(/stroke-dashoffset/);
  expect(ring.transitionDuration).toBe('0s');

  const immediate = await page.evaluate(async () => {
    window.scrollTo({ top: window.scrollY + 900, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const fill = document.querySelector('.btt-ring-fill');
    const total = document.documentElement.scrollHeight - window.innerHeight;
    return { offset: Number(fill.style.strokeDashoffset), expected: Number(((1 - window.scrollY / total) * 100).toFixed(2)) };
  });
  expect(Math.abs(immediate.offset - immediate.expected)).toBeLessThan(0.6);
});

test('dark theme keeps the back-to-top hover matte', async ({ page }) => {
  await openHome(page, 1440, 900, 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await jumpTo(page, 1800);
  await expect(page.locator('#backToTop')).toHaveClass(/visible/);

  const rest = await page.locator('#backToTop').evaluate((el) => {
    const css = getComputedStyle(el);
    return { background: css.backgroundColor, image: css.backgroundImage };
  });
  expect(rest.background).toBe('rgb(59, 40, 29)');
  expect(rest.image).toBe('none');

  // [r32] Золотой градиент до-r30 убран: наведение — тот же бронзовый квадрат
  // на полтона светлее, без градиента и ореола.
  const canHover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
  if (canHover) {
    await page.locator('#backToTop').hover();
    await page.waitForTimeout(350);
    const hovered = await page.locator('#backToTop').evaluate((el) => {
      const css = getComputedStyle(el);
      return { background: css.backgroundColor, image: css.backgroundImage, color: css.color };
    });
    expect(hovered.image).toBe('none');
    expect(hovered.background).toBe('rgb(71, 48, 31)');
    expect(hovered.color).toBe('rgb(247, 226, 187)');
  } else {
    /* Тач: hover-состояние не должно залипать после тапа — кнопка остаётся
       матовой и после нажатия (иначе она «загоралась» бы золотом на ночной
       странице до следующего касания). */
    const box = await page.locator('#backToTop').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
    await page.waitForTimeout(500);
    const tapped = await page.locator('#backToTop').evaluate((el) => {
      const css = getComputedStyle(el);
      return { background: css.backgroundColor, image: css.backgroundImage };
    });
    expect(tapped.image).toBe('none');
    expect(tapped.background).toBe('rgb(59, 40, 29)');
  }
});
