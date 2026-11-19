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

/* [r38] Высота документа на главной растёт после первого скролла: каталог и
   соседние секции гидрируются по видимости, плюс scroll anchoring сдвигает
   позицию на ту же величину. Из-за этого замер «до/после перезагрузки» ловил
   разное состояние загрузки и сравнивал проценты от разных высот. Ждём, пока
   высота перестанет меняться, — это делает замер детерминированным, но не
   ослабляет проверку прогресса. */
async function settleLayout(page) {
  await page.evaluate(() => new Promise((resolve) => {
    let last = -1;
    let stable = 0;
    let frames = 0;
    const tick = () => {
      const height = document.documentElement.scrollHeight;
      if (height === last) stable += 1;
      else { last = height; stable = 0; }
      frames += 1;
      if (stable >= 4 || frames > 60) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
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
  await settleLayout(page);

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
  await settleLayout(page);
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

/* r34: «Наверх» уступает видеоленте «Наши работы · в движении».
   Плитки ленты — ссылки на видео с кнопкой Play; пока кнопка стоит на ленте,
   она не должна ни закрывать плитку, ни перехватывать тап. Геометрия берётся
   по статическому контейнеру #mcVideoStrip, поэтому движущийся трек на
   результат не влияет. */
async function frame(page, times = 2) {
  await page.evaluate((n) => new Promise((resolve) => {
    let i = 0;
    const step = () => (++i >= n ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  }), times);
}

/* Доводим скролл до нужного положения ленты итеративно: страница догружается
   (картинки, секции), и одиночный scrollTo промахивается на десятки пикселей. */
async function settle(page, gap) {
  for (let i = 0; i < 8; i++) {
    const delta = await page.evaluate((g) => {
      const strip = document.getElementById('mcVideoStrip').getBoundingClientRect();
      const btt = document.getElementById('backToTop').getBoundingClientRect();
      if (g === 'center') return (strip.top + strip.height / 2) - (btt.top + btt.height / 2);
      return (strip.bottom + g) - btt.top;
    }, gap);
    if (i > 0 && Math.abs(delta) < 5) break;
    await page.evaluate((d) => window.scrollTo({ top: Math.max(0, window.scrollY + d), behavior: 'instant' }), Math.round(delta));
    await frame(page, 2);
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(450); // даём переходам доиграть
}

async function tapPoint(page, x, y) {
  const touch = await page.evaluate(() => ('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('back-to-top steps aside from the video strip and lets tiles be tapped', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await openHome(page, width, 800);
    await settle(page, 'center');

    const state = await page.evaluate(() => {
      const btt = document.getElementById('backToTop');
      const strip = document.getElementById('mcVideoStrip');
      const b = btt.getBoundingClientRect();
      const s = strip.getBoundingClientRect();
      const overlap = !(b.right < s.left || b.left > s.right || b.bottom < s.top || b.top > s.bottom);
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return {
        overlap,
        obstructed: btt.classList.contains('btt-obstructed'),
        pointerEvents: getComputedStyle(btt).pointerEvents,
        hitIsBtt: !!(hit && hit.closest && hit.closest('#backToTop')),
        point: { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) },
      };
    });

    expect(state.overlap, `кнопка стоит на ленте при ${width}px`).toBe(true);
    expect(state.obstructed, `кнопка обязана уйти с ленты при ${width}px`).toBe(true);
    expect(state.pointerEvents).toBe('none');
    expect(state.hitIsBtt).toBe(false);
    await expect(page.locator('#backToTop')).toHaveCSS('opacity', '0');
  }
});

test('a tap on the video strip under the hidden back-to-top opens the video', async ({ page }) => {
  for (const width of [390, 768]) {
    await openHome(page, width, 800);
    await settle(page, 'center');

    const point = await page.evaluate(() => {
      const btt = document.getElementById('backToTop').getBoundingClientRect();
      // The BTT's center may fall in a 10px GAP between two video tiles.
      // Test a real tile pixel inside the hidden BTT bounds, not an arbitrary gap.
      for (const tile of document.querySelectorAll('#mcVideoStrip .vtile')) {
        const rect = tile.getBoundingClientRect();
        const left = Math.max(0, btt.left, rect.left);
        const right = Math.min(innerWidth, btt.right, rect.right);
        const top = Math.max(0, btt.top, rect.top);
        const bottom = Math.min(innerHeight, btt.bottom, rect.bottom);
        if (right - left < 3 || bottom - top < 3) continue;
        for (let y = Math.ceil(top + 1); y < bottom - 1; y += 4) {
          for (let x = Math.ceil(left + 1); x < right - 1; x += 4) {
            const hit = document.elementFromPoint(x, y);
            if (hit && hit.closest('.vtile') === tile) {
              return { found: true, x, y, hitIsBtt: !!hit.closest('#backToTop') };
            }
          }
        }
      }
      return { found: false };
    });
    expect(point.found, `на ${width}px не найдено пересечение скрытой кнопки и живой плитки`).toBe(true);
    expect(point.hitIsBtt).toBe(false);

    // Trusted tap on a real video-tile pixel within the hidden BTT's bounds:
    // transparent controls must never consume the video gesture.
    await tapPoint(page, point.x, point.y);
    await expect(page.locator('body')).toHaveClass(/vview-open/, { timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/vview-open/, { timeout: 5_000 });
    await expect(page.locator('#backToTop')).toHaveCSS('opacity', '0');
  }
});

test('back-to-top keeps a 12/24 px hysteresis on the video strip and never flickers', async ({ page }) => {
  await openHome(page, 390, 800);

  // 8 px от ленты — внутри зоны срабатывания (12): кнопка обязана уйти.
  await settle(page, 8);
  await expect(page.locator('#backToTop')).toHaveClass(/btt-obstructed/);
  const gapNow = await page.evaluate(() => {
    const s = document.getElementById('mcVideoStrip').getBoundingClientRect();
    const b = document.getElementById('backToTop').getBoundingClientRect();
    return Math.round(b.top - s.bottom);
  });
  expect(gapNow).toBeLessThan(12);

  // 16 px — между порогами: состояние удерживается, кнопка не возвращается.
  await settle(page, 16);
  const held = await page.evaluate(() => {
    const s = document.getElementById('mcVideoStrip').getBoundingClientRect();
    const b = document.getElementById('backToTop').getBoundingClientRect();
    return { gap: Math.round(b.top - s.bottom), obstructed: document.getElementById('backToTop').classList.contains('btt-obstructed') };
  });
  expect(held.gap).toBeGreaterThanOrEqual(12);
  expect(held.gap).toBeLessThan(24);
  expect(held.obstructed).toBe(true);

  // 30 px — за порогом возврата: кнопка появляется снова.
  await settle(page, 30);
  await expect(page.locator('#backToTop')).not.toHaveClass(/btt-obstructed/);

  // Быстрые проходы вверх/вниз через ленту: состояние каждый раз совпадает
  // с геометрией, «залипания» и мерцания нет.
  for (let i = 0; i < 3; i++) {
    await settle(page, 30);
    expect(await page.locator('#backToTop').evaluate((el) => el.classList.contains('btt-obstructed'))).toBe(false);
    await settle(page, 'center');
    expect(await page.locator('#backToTop').evaluate((el) => el.classList.contains('btt-obstructed'))).toBe(true);
  }

  // Возврат после последнего ухода с ленты.
  await settle(page, 30);
  await expect(page.locator('#backToTop')).not.toHaveClass(/btt-obstructed/);
  await expect(page.locator('#backToTop')).toHaveClass(/visible/);
  await expect(page.locator('#backToTop')).toHaveCSS('opacity', '1');
});
