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

async function waitForMobileAppShell(page) {
  await page.waitForFunction(() => {
    if (window.innerWidth > 768) return true;
    const nav = document.getElementById('mcNav');
    if (!nav) return false;
    const style = getComputedStyle(nav);
    const rect = nav.getBoundingClientRect();
    const rightGap = window.innerWidth - rect.right;
    const bottomGap = window.innerHeight - rect.bottom;
    return style.position === 'fixed' &&
      style.display !== 'none' &&
      style.visibility === 'visible' &&
      rect.left >= 8 && rect.left <= 16 &&
      rightGap >= 8 && rightGap <= 16 &&
      bottomGap >= 8 && bottomGap <= 16 &&
      rect.width >= window.innerWidth - 32 &&
      rect.width <= window.innerWidth - 16;
  });
}

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
    await waitForMobileAppShell(page);

    const nav = page.locator('#mcNav');
    await expect(nav.locator('.mc-btn-label')).toHaveText(['Каталог', 'Начинки', 'Отзывы', 'Заказать', 'Ещё']);

    const initial = await page.evaluate(() => {
      const visibleNavs = ['mcNav', 'bottomNav', 'mrBottomNav']
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        })
        .map((element) => element.id);
      const rect = document.getElementById('mcNav').getBoundingClientRect();
      return {
        visibleNavs,
        left: rect.left,
        rightGap: window.innerWidth - rect.right,
        bottomGap: window.innerHeight - rect.bottom,
        width: rect.width,
        viewport: window.innerWidth,
      };
    });
    expect(initial.visibleNavs).toEqual(['mcNav']);
    expect(initial.left).toBeGreaterThanOrEqual(8);
    expect(initial.left).toBeLessThanOrEqual(16);
    expect(initial.rightGap).toBeGreaterThanOrEqual(8);
    expect(initial.rightGap).toBeLessThanOrEqual(16);
    expect(initial.bottomGap).toBeGreaterThanOrEqual(8);
    expect(initial.bottomGap).toBeLessThanOrEqual(16);
    expect(initial.width).toBeGreaterThanOrEqual(initial.viewport - 32);
    expect(initial.width).toBeLessThanOrEqual(initial.viewport - 16);

    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.65, behavior: 'instant' }));
    await page.waitForTimeout(250);
    await expect(nav).toBeVisible();
    const afterScroll = await nav.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        bottomGap: window.innerHeight - rect.bottom,
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
      };
    });
    expect(afterScroll.bottomGap).toBeGreaterThanOrEqual(8);
    expect(afterScroll.bottomGap).toBeLessThanOrEqual(16);
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

  test('About page keeps hero geometry stable when privacy scroll-lock engages', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'desktop scrollbar-gutter regression');
    await applyTheme(page, 'light', 'denied');
    await page.goto('/o-konditere/', { waitUntil: 'domcontentloaded' });
    const visual = page.locator('.info-visual');
    await expect(visual).toBeVisible();

    const before = await visual.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        gutter: getComputedStyle(document.documentElement).scrollbarGutter,
      };
    });
    expect(before.gutter).toContain('stable');

    await page.evaluate(() => document.body.classList.add('mc-consent-open'));
    await page.waitForTimeout(80);
    const after = await visual.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    });
    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(0.5);
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
