const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const themePages = [
  '/',
  '/gallery/',
  '/zakazat-tort-spb/',
  '/svadebnye-torty/',
  '/bento-torty/',
  '/dostavka-i-oplata/',
  '/otzyvy/',
];

const proofDir = path.join(process.cwd(), 'test-results', 'ui-audit');

function proofPath(testInfo, name) {
  fs.mkdirSync(proofDir, { recursive: true });
  return path.join(proofDir, `${testInfo.project.name}-${name}.png`);
}

async function applyTheme(page, theme, consent = 'denied') {
  await page.addInitScript(({ themeValue, consentValue }) => {
    localStorage.setItem('mc_theme', themeValue);
    document.documentElement.setAttribute('data-theme', themeValue);
    if (consentValue === null) localStorage.removeItem('milovi_analytics_consent_v1');
    else localStorage.setItem('milovi_analytics_consent_v1', consentValue);
  }, { themeValue: theme, consentValue: consent });
}

function luminance(rgb) {
  const channels = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!channels) return null;
  const values = [Number(channels[1]), Number(channels[2]), Number(channels[3])].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrastRatio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) return null;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

async function effectiveBg(locator) {
  return locator.evaluate((el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  });
}

// [r29] Нижний бар — самостоятельная «пилюля» с равным воздухом по краям.
// Числа не зашиты в тест: ожидания читаются из токенов --mc-nav-side и
// --mc-nav-gap (css/style.css), то есть тест проверяет контракт геометрии,
// а не конкретную реализацию.
async function mobileAppShellMetrics(page) {
  return page.evaluate(() => {
    const nav = document.getElementById('mcNav');
    const rect = nav.getBoundingClientRect();
    const style = getComputedStyle(nav);
    const root = getComputedStyle(document.documentElement);
    const side = parseFloat(root.getPropertyValue('--mc-nav-side')) || 12;
    const gap = parseFloat(root.getPropertyValue('--mc-nav-gap')) || 8;
    return {
      left: rect.left,
      rightGap: window.innerWidth - rect.right,
      bottomGap: window.innerHeight - rect.bottom,
      width: rect.width,
      height: rect.height,
      viewport: window.innerWidth,
      side,
      gap,
      radius: parseFloat(style.borderTopLeftRadius) || 0,
      position: style.position,
      display: style.display,
      visibility: style.visibility,
      pointerEvents: style.pointerEvents,
    };
  });
}

/* [r39] Нижний бар появляется после начала прокрутки: на первом экране его
   нет (иначе он занимает низ ещё до каталога). Поэтому перед проверкой
   геометрии бара страницу надо прокрутить — как это делает живой пользователь. */
async function revealMobileAppBar(page) {
  if (await page.evaluate(() => window.innerWidth > 768)) return;
  await page.evaluate(() => window.scrollTo(0, Math.max(520, Math.round(window.innerHeight * 0.8))));
  await page.waitForFunction(() => !document.body.classList.contains('mc-nav-veiled'), null, { timeout: 15000 });
}

async function waitForMobileAppShell(page) {
  await revealMobileAppBar(page);
  await page.waitForFunction(() => {
    if (window.innerWidth > 768) return true;
    const nav = document.getElementById('mcNav');
    if (!nav) return false;
    const style = getComputedStyle(nav);
    const rect = nav.getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const side = parseFloat(root.getPropertyValue('--mc-nav-side')) || 12;
    const gap = parseFloat(root.getPropertyValue('--mc-nav-gap')) || 8;
    const rightGap = window.innerWidth - rect.right;
    const bottomGap = window.innerHeight - rect.bottom;
    return style.position === 'fixed' &&
      style.display !== 'none' &&
      style.visibility === 'visible' &&
      Math.abs(rect.left - side) <= 1 &&
      Math.abs(rightGap - side) <= 1 &&
      Math.abs(bottomGap - gap) <= 1 &&
      Math.abs(rect.width - (window.innerWidth - 2 * side)) <= 1 &&
      rect.height >= 56 &&
      parseFloat(style.borderTopLeftRadius) >= 18;
  });
}

// A system-wide dark preference is not an explicit choice of the site's theme.
// Match AGENTS.md: default light except the standalone meringue-roll page.
test.describe('first-visit default theme contract', () => {
  const routes = [
    '/', '/gallery/', '/bento-torty/', '/svadebnye-torty/',
    '/detskie-torty/', '/dostavka-i-oplata/', '/otzyvy/',
    '/o-konditere/', '/zakazat-tort-spb/', '/certificates/',
    '/call/', '/privacy/', '/prigorody/', '/prigorody/pushkin/',
    '/tort-na-den-rozhdeniya/', '/tort-s-dostavkoy/', '/404.html',
    '/meringue-roll/',
  ];
  for (const route of routes) {
    test(`${route} honors site default regardless of OS scheme`, async ({ page }) => {
      await page.addInitScript(() => localStorage.removeItem('mc_theme'));
      for (const osScheme of ['dark', 'light']) {
        await page.emulateMedia({ colorScheme: osScheme });
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        const expected = route === '/meringue-roll/' ? 'dark' : 'light';
        await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
        expect(await page.evaluate(() => localStorage.getItem('mc_theme'))).toBeNull();
      }
    });
  }
});

test.describe('light/dark UI smoke', () => {
  for (const theme of ['light', 'dark']) {
    for (const route of themePages) {
      test(`${route} ${theme} theme is readable and stable`, async ({ page }) => {
        await applyTheme(page, theme);
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        if (route === '/gallery/') await page.waitForTimeout(900);

        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('body')).not.toContainText('Пн–Вс');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(4);

        if (!['/', '/gallery/'].includes(route)) {
          const h1 = page.locator('h1').first();
          const colors = await h1.evaluate((el) => ({ color: getComputedStyle(el).color }));
          const bg = await effectiveBg(h1);
          const ratio = contrastRatio(colors.color, bg);
          if (ratio !== null) expect(ratio).toBeGreaterThan(2.6);
        }

        const brokenImages = await page.locator('img').evaluateAll((imgs) => {
          const vh = window.innerHeight;
          const isVisible = (el) => {
            for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
              const cs = getComputedStyle(node);
              if (cs.visibility === 'hidden' || cs.display === 'none') return false;
            }
            return true;
          };
          return imgs
            .filter((img) => {
              const rect = img.getBoundingClientRect();
              return img.getAttribute('src') && rect.width > 20 && rect.bottom > -50 && rect.top < vh + 250 && isVisible(img);
            })
            .filter((img) => !img.complete || img.naturalWidth < 20)
            .map((img) => img.getAttribute('src'));
        });
        expect(brokenImages).toEqual([]);
      });
    }
  }
});

test.describe('contact, privacy and mobile application contracts', () => {
  test('minimal phone icon and social divider survive light → dark → light', async ({ page }, testInfo) => {
    await applyTheme(page, 'light');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#contacts').scrollIntoViewIfNeeded();

    const readMetrics = () => page.evaluate(() => {
      const icon = document.querySelector('#contacts .card.card--dark .contact-primary-icon');
      const pathNode = icon && icon.querySelector('svg path');
      const divider = document.querySelector('#contacts .card.card--dark .social-divider');
      if (!icon || !pathNode || !divider) return null;
      const iconStyle = getComputedStyle(icon);
      const pathStyle = getComputedStyle(pathNode);
      const before = getComputedStyle(divider, '::before');
      const after = getComputedStyle(divider, '::after');
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        iconBackground: iconStyle.backgroundImage,
        iconBorderStyle: iconStyle.borderStyle,
        iconBorderWidth: parseFloat(iconStyle.borderTopWidth),
        iconBorderColor: iconStyle.borderTopColor,
        pathStroke: pathStyle.stroke,
        pathFill: pathStyle.fill,
        dividerBefore: before.backgroundImage,
        dividerAfter: after.backgroundImage,
        dividerBeforeOpacity: Number(before.opacity),
        dividerAfterOpacity: Number(after.opacity),
      };
    });

    const assertStable = (metrics) => {
      expect(metrics).not.toBeNull();
      expect(metrics.iconBackground).toBe('none');
      expect(metrics.iconBorderStyle).toBe('solid');
      expect(metrics.iconBorderWidth).toBeGreaterThanOrEqual(1);
      expect(['transparent', 'rgba(0, 0, 0, 0)']).not.toContain(metrics.iconBorderColor);
      expect(metrics.pathFill).toBe('none');
      expect(['none', 'transparent', 'rgba(0, 0, 0, 0)']).not.toContain(metrics.pathStroke);
      expect(metrics.dividerBefore).toContain('gradient');
      expect(metrics.dividerAfter).toContain('gradient');
      expect(metrics.dividerBeforeOpacity).toBeGreaterThan(0.9);
      expect(metrics.dividerAfterOpacity).toBeGreaterThan(0.9);
    };

    assertStable(await readMetrics());
    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(360);
    const dark = await readMetrics();
    expect(dark.theme).toBe('dark');
    assertStable(dark);
    await page.locator('#contacts').screenshot({ path: proofPath(testInfo, 'contacts-dark') });

    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(360);
    const lightAgain = await readMetrics();
    expect(lightAgain.theme).toBe('light');
    assertStable(lightAgain);
  });

  test('privacy stays quiet by default and opens from footer on desktop or Ещё on mobile', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.includes('mobile');
    await applyTheme(page, 'light', null);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const overlay = page.locator('.mc-consent-overlay');
    await expect.poll(async () => page.evaluate(() => window.MiloviConsent && window.MiloviConsent.getChoice())).toBe('denied');
    await expect(overlay).toBeHidden();
    await expect(overlay).not.toHaveClass(/is-open/);
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBe('denied');
    if (mobile) await waitForMobileAppShell(page);

    if (mobile) {
      await expect(page.locator('.site-footer .mc-consent-trigger')).toHaveCount(0);
      const staticPolicy = page.locator('.site-footer .footer-bottom > a[href="/privacy/"]');
      await expect(staticPolicy).toHaveCount(1);
      await expect(staticPolicy).toBeHidden();
      await page.locator('#mcMoreBtn').click();
      const privacyRow = page.locator('#mcPrivacyRow');
      await expect(privacyRow).toBeVisible();
      await expect(privacyRow.locator('.mc-row-sub')).toHaveText('Отключена');
      await page.locator('#mcSheet').screenshot({ path: proofPath(testInfo, 'mobile-more-privacy') });
      await privacyRow.click();
    } else {
      const trigger = page.locator('.site-footer .mc-consent-trigger');
      await trigger.scrollIntoViewIfNeeded();
      await expect(trigger).toBeVisible();
      const contract = await trigger.evaluate((element) => ({
        position: getComputedStyle(element).position,
        inFooter: Boolean(element.closest('.footer-bottom')),
      }));
      expect(contract.inFooter).toBe(true);
      expect(['fixed', 'sticky']).not.toContain(contract.position);
      await trigger.click();
    }

    await expect(overlay).toHaveClass(/is-open/);
    await expect(page.locator('.mc-consent-dialog')).toBeVisible();
    await expect(page.locator('.mc-consent-settings')).toHaveCount(0);
    await page.locator('.mc-consent-dialog').screenshot({ path: proofPath(testInfo, 'privacy-dialog') });
    await page.locator('[data-choice="denied"]').click();
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBe('denied');
  });

  test('mobile exposes one persistent five-action app navigation', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only contract');
    await applyTheme(page, 'dark');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    /* [r39] Контракт первого экрана: бара нет — он вне вьюпорта и не ловит Tab. */
    const nav = page.locator('#mcNav');
    await expect(page.locator('body')).toHaveClass(/mc-nav-veiled/);
    const veiled = await nav.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        offscreen: rect.top >= window.innerHeight - 1,
        inert: el.hasAttribute('inert'),
        ariaHidden: el.getAttribute('aria-hidden'),
      };
    });
    expect(veiled).toEqual({ offscreen: true, inert: true, ariaHidden: 'true' });

    /* Прокрутка — и бар встаёт на место с полной интерактивностью. */
    await waitForMobileAppShell(page);
    await expect(page.locator('body')).not.toHaveClass(/mc-nav-veiled/);
    expect(await nav.evaluate((el) => el.hasAttribute('inert') || el.hasAttribute('aria-hidden'))).toBe(false);
    await expect(nav.locator('.mc-btn-label')).toHaveText(['Каталог', 'Начинки', 'Корзина', 'Отзывы', 'Ещё']);

    const visibleNavs = await page.evaluate(() => ['mcNav', 'bottomNav', 'mrBottomNav']
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => element.id));
    expect(visibleNavs).toEqual(['mcNav']);

    const initial = await mobileAppShellMetrics(page);
    expect(initial.position).toBe('fixed');
    // [r29] Пилюля: одинаковый воздух слева и справа (--mc-nav-side), подъём
    // над краем экрана (--mc-nav-gap), ширина = вьюпорт минус два отступа и
    // скругление корпуса — геометрия сверяется с токенами, а не с магией.
    expect(Math.abs(initial.left - initial.side)).toBeLessThanOrEqual(1);
    expect(Math.abs(initial.rightGap - initial.side)).toBeLessThanOrEqual(1);
    expect(Math.abs(initial.bottomGap - initial.gap)).toBeLessThanOrEqual(1);
    expect(Math.abs(initial.width - (initial.viewport - 2 * initial.side))).toBeLessThanOrEqual(1);
    expect(initial.height).toBeGreaterThanOrEqual(56);
    expect(initial.radius).toBeGreaterThanOrEqual(18);

    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.65, behavior: 'instant' }));
    await page.waitForTimeout(250);
    await expect(nav).toBeVisible();
    const afterScroll = await mobileAppShellMetrics(page);
    expect(Math.abs(afterScroll.bottomGap - afterScroll.gap)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterScroll.left - afterScroll.side)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterScroll.rightGap - afterScroll.side)).toBeLessThanOrEqual(1);
    expect(afterScroll.display).not.toBe('none');
    expect(afterScroll.visibility).toBe('visible');
    expect(afterScroll.pointerEvents).not.toBe('none');

    const footerBottom = page.locator('.site-footer .footer-bottom');
    await footerBottom.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const overlap = await page.evaluate(() => {
      const footer = document.querySelector('.site-footer .footer-bottom').getBoundingClientRect();
      const appNav = document.getElementById('mcNav').getBoundingClientRect();
      return footer.bottom > appNav.top + 1;
    });
    expect(overlap).toBe(false);
    await page.screenshot({ path: proofPath(testInfo, 'mobile-app-footer'), fullPage: false });

    await page.locator('#mcMoreBtn').click();
    await expect(page.locator('#mcPrivacyRow')).toBeVisible();
    await expect(page.locator('.site-footer .mc-consent-trigger')).toHaveCount(0);
  });

  // [r29] Док «примерная стоимость» — не отдельная карточка над баром, а та же
  // поверхность, из-под которой он вытекает: одна полоса по ширине, один тон
  // на стыке и выбранный пункт без плиток/капсул/рамок.
  test('mobile price dock grows out of the app bar as one surface', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only contract');
    await applyTheme(page, 'dark');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForMobileAppShell(page);

    const nav = page.locator('#mcNav');
    await expect(nav.locator('.mc-btn')).toHaveCount(5);

    // До первого выбора док полностью спрятан под баром.
    await page.locator('#fillings').scrollIntoViewIfNeeded();
    await expect(page.locator('body')).toHaveClass(/mc-dock-idle/);
    const hidden = await page.evaluate(() => {
      const dock = document.getElementById('calcRightCol').getBoundingClientRect();
      const bar = document.getElementById('mcNav').getBoundingClientRect();
      return { dockTop: dock.top, navTop: bar.top };
    });
    expect(hidden.dockTop).toBeGreaterThanOrEqual(hidden.navTop - 1);

    await page.locator('#calcType .calc-type-card.selected').click();
    await expect(page.locator('body')).toHaveClass(/mc-dock-shown/);
    // Ждём завершения перехода (--mc-dock-dur = 460 мс) — без «сонных» пауз.
    await expect.poll(() => page.locator('#calcRightCol').evaluate((el) => {
      const matrix = getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/);
      return matrix ? Math.abs(Number(matrix[1].split(',')[5])) : 0;
    }), { timeout: 3000 }).toBeLessThanOrEqual(0.5);

    const metrics = await page.evaluate(() => {
      const dock = document.getElementById('calcRightCol');
      const bar = document.getElementById('mcNav');
      const dockRect = dock.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const dockStyle = getComputedStyle(dock);
      const dockBox = getComputedStyle(document.getElementById('calcResultBox'));
      const barStyle = getComputedStyle(bar);
      const root = getComputedStyle(document.documentElement);
      const matrix = dockStyle.transform.match(/matrix\(([^)]+)\)/);
      return {
        side: parseFloat(root.getPropertyValue('--mc-nav-side')) || 12,
        overlap: parseFloat(root.getPropertyValue('--mc-dock-overlap')) || 22,
        dock: { left: dockRect.left, right: dockRect.right, bottom: dockRect.bottom, top: dockRect.top },
        bar: { left: barRect.left, right: barRect.right, top: barRect.top, bottom: barRect.bottom },
        dockRadius: parseFloat(dockBox.borderTopLeftRadius) || 0,
        dockBorderBottom: dockBox.borderBottomWidth,
        dockTransition: {
          property: dockStyle.transitionProperty,
          duration: dockStyle.transitionDuration,
          timing: dockStyle.transitionTimingFunction,
        },
        scale: matrix ? [Number(matrix[1].split(',')[0]), Number(matrix[1].split(',')[3])] : null,
        barRadius: parseFloat(barStyle.borderTopLeftRadius) || 0,
        barZ: Number(barStyle.zIndex) || 0,
        dockZ: Number(dockStyle.zIndex) || 0,
      };
    });

    // Одна полоса: док стоит ровно по краям бара (те же --mc-nav-side).
    expect(Math.abs(metrics.dock.left - metrics.bar.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.dock.right - metrics.bar.right)).toBeLessThanOrEqual(1);
    // Низ дока заходит под бар на --mc-dock-overlap: стык перекрыт баром.
    expect(Math.abs((metrics.bar.top - metrics.dock.bottom) + metrics.overlap)).toBeLessThanOrEqual(1.5);
    // Док всегда под баром — иначе кайма/тень дали бы «вторую полосу».
    expect(metrics.dockZ).toBeLessThan(metrics.barZ);
    expect(metrics.dockBorderBottom).toBe('0px');
    // Стык скруглений: радиус дока = радиусу бара, поверхность продолжается.
    expect(Math.abs(metrics.dockRadius - metrics.barRadius)).toBeLessThanOrEqual(1);
    // Анимация — только transform, 460 мс, без пружины и без scale.
    expect(metrics.dockTransition.property).toBe('transform');
    expect(metrics.dockTransition.duration).toBe('0.46s');
    expect(metrics.dockTransition.timing).toBe('cubic-bezier(0.22, 0.61, 0.36, 1)');
    expect(metrics.scale).toEqual([1, 1]);

    // Выбранный пункт: только золото на SVG и подписи, без фона, рамок и каймы.
    const active = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('#mcNav .mc-btn'));
      const current = buttons.find((button) => button.classList.contains('mc-active'));
      if (!current) return null;
      const other = buttons.find((button) => !button.classList.contains('mc-active'));
      const style = getComputedStyle(current);
      const before = getComputedStyle(current, '::before');
      const svg = getComputedStyle(current.querySelector('svg'));
      return {
        background: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        decorWidth: parseFloat(before.width) || 0,
        svgFill: svg.fill,
        labelColor: getComputedStyle(current.querySelector('.mc-btn-label')).color,
        svgColor: svg.color,
        otherLabelColor: other ? getComputedStyle(other.querySelector('.mc-btn-label')).color : null,
        otherSvgColor: other ? getComputedStyle(other.querySelector('svg')).color : null,
      };
    });
    expect(active, 'one app bar item is marked as current').not.toBeNull();
    expect(active.background).toBe('rgba(0, 0, 0, 0)');
    expect(active.backgroundImage).toBe('none');
    expect(active.boxShadow).toBe('none');
    // На ::before живёт только волосяной сепаратор (1 px), никаких капсул/плиток.
    expect(active.decorWidth).toBeLessThanOrEqual(2);
    expect(active.svgFill).toBe('none');
    expect(active.labelColor).not.toBe(active.otherLabelColor);
    expect(active.svgColor).not.toBe(active.otherSvgColor);

    // Раскрытая смета растёт из-под бара, а сам бар остаётся на месте.
    const barTopBefore = await nav.evaluate((el) => el.getBoundingClientRect().top);
    await page.locator('#calcCollapsedBar').click();
    await expect(page.locator('#calcCollapsedBar')).toHaveAttribute('aria-expanded', 'true');
    // Смета раскрывается 460 мс; ждём контракт, а не «сон»: кнопка заказа
    // обязана оказаться над баром (иначе её не нажать).
    await expect.poll(() => page.evaluate(() => {
      const bar = document.getElementById('mcNav').getBoundingClientRect();
      const add = document.querySelector('.calc-add-btn')?.getBoundingClientRect();
      return add ? Math.round(bar.top - add.bottom) : -9999;
    }), { timeout: 5000 }).toBeGreaterThanOrEqual(0);
    const opened = await page.evaluate(() => {
      const bar = document.getElementById('mcNav').getBoundingClientRect();
      const dock = document.getElementById('calcRightCol').getBoundingClientRect();
      const add = document.querySelector('.calc-add-btn')?.getBoundingClientRect();
      return {
        barTop: bar.top,
        dockLeft: dock.left,
        dockRight: dock.right,
        addBottom: add ? add.bottom : null,
        viewport: window.innerHeight,
      };
    });
    expect(Math.abs(opened.barTop - barTopBefore)).toBeLessThanOrEqual(1);
    expect(Math.abs(opened.dockLeft - metrics.bar.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(opened.dockRight - metrics.bar.right)).toBeLessThanOrEqual(1);
    expect(opened.addBottom).not.toBeNull();
    // Кнопка «Добавить в корзину» полностью над баром — её нельзя спрятать под ним.
    expect(opened.addBottom).toBeLessThanOrEqual(opened.barTop - 0.5);
    await page.screenshot({ path: proofPath(testInfo, 'mobile-price-dock'), fullPage: false });
  });
});

test.describe('forensic visual regressions', () => {
  test('mobile menu messenger labels keep compact typography and fit their cards', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only regression');
    await applyTheme(page, 'light');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#burgerBtn').click();
    await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
    const metrics = await page.locator('.mm-msg').evaluateAll((items) => items.map((el) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect();
      return { fontSize: parseFloat(style.fontSize), width: box.width, textLeft: text.left, textRight: text.right, left: box.left, right: box.right };
    }));
    expect(metrics).toHaveLength(3);
    for (const item of metrics) {
      expect(item.fontSize).toBeLessThanOrEqual(16);
      expect(item.width).toBeGreaterThan(0);
      expect(item.textLeft).toBeGreaterThanOrEqual(item.left - 1);
      expect(item.textRight).toBeLessThanOrEqual(item.right + 1);
    }
  });

  test('homepage dark bento and About heading remain readable', async ({ page }) => {
    await applyTheme(page, 'dark');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const segment = page.locator('.bento-seg').first();
    const inactive = page.locator('.bento-seg-opt:not(.active)').first();
    await expect(segment).toBeVisible();
    await expect(inactive).toBeVisible();

    const bento = await page.evaluate(() => {
      const seg = document.querySelector('.bento-seg');
      const opt = document.querySelector('.bento-seg-opt:not(.active)');
      return {
        foreground: getComputedStyle(opt).color,
        background: getComputedStyle(seg).backgroundColor,
      };
    });
    expect(contrastRatio(bento.foreground, bento.background)).toBeGreaterThanOrEqual(4.5);

    const heading = page.locator('.about-compact-block h3').first();
    await expect(heading).toBeVisible();
    const headingStyle = await heading.evaluate((el) => ({
      color: getComputedStyle(el).color,
      fill: getComputedStyle(el).webkitTextFillColor,
    }));
    expect(headingStyle.fill).not.toBe('rgba(0, 0, 0, 0)');
    const background = await effectiveBg(heading);
    expect(contrastRatio(headingStyle.color, background)).toBeGreaterThanOrEqual(4.5);
  });

  test('wedding editorial uses genuinely dark surfaces in dark theme', async ({ page }) => {
    await applyTheme(page, 'dark');
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const surfaces = await page.evaluate(() => {
      const read = (selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage };
      };
      return { panel: read('.bridal-panel'), mini: read('.bridal-mini'), step: read('.bridal-step') };
    });
    const darkEnough = (rgb) => {
      const values = (rgb.match(/\d+/g) || []).slice(0, 3).map(Number);
      return values.length === 3 && Math.max(...values) < 80;
    };
    expect(darkEnough(surfaces.panel.backgroundColor)).toBe(true);
    expect(surfaces.panel.backgroundImage).not.toContain('255, 255, 255');
    expect(darkEnough(surfaces.mini.backgroundColor)).toBe(true);
    expect(darkEnough(surfaces.step.backgroundColor)).toBe(true);
  });

  test('suburb hub defaults to light and exposes a persistent theme toggle', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.removeItem('mc_theme'));
    await page.goto('/prigorody/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const toggle = page.locator('#themeToggleBtn');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('mc_theme'))).toBe('dark');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('mc_theme'))).toBe('light');
  });

  test('suburb cart close is icon-only and meets the 44px target', async ({ page }) => {
    await page.goto('/prigorody/pushkin/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cart-close span')).toHaveCount(0);
    await page.evaluate(() => window.openCart());
    await expect(page.locator('.cart-drawer')).toHaveClass(/open/);
    const close = page.locator('.cart-close');
    await expect.poll(async () => close.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
    await expect.poll(async () => close.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  });

  test('meringue map-review labels are not visually clipped', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile clipping regression');
    await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
    const links = page.locator('a.btn-ghost').filter({ hasText: /Яндекс Карты|Google Maps/ });
    await expect(links).toHaveCount(2);
    const fits = await links.evaluateAll((items) => items.map((el) => {
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const content = range.getBoundingClientRect();
      return content.left >= box.left - 1 && content.right <= box.right + 1;
    }));
    expect(fits).toEqual([true, true]);
  });

  test('privacy analytics CTA fits and opens its dialog', async ({ page }) => {
    await page.goto('/privacy/', { waitUntil: 'domcontentloaded' });
    const button = page.getByRole('button', { name: 'Открыть настройки аналитики' });
    await expect(button).toBeVisible();
    const fits = await button.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const content = range.getBoundingClientRect();
      return content.left >= box.left - 1 && content.right <= box.right + 1;
    });
    expect(fits).toBe(true);
    await button.click();
    await expect(page.locator('.mc-consent-dialog')).toBeVisible();
  });
});
