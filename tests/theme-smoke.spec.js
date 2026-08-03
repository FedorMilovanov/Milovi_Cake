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
    return style.position === 'fixed' &&
      style.display !== 'none' &&
      style.visibility === 'visible' &&
      rect.width >= window.innerWidth - 4 &&
      Math.abs(window.innerHeight - rect.bottom) <= 2;
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
  test('phone icon and social divider survive light → dark → light', async ({ page }, testInfo) => {
    await applyTheme(page, 'light');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#contacts').scrollIntoViewIfNeeded();

    const readMetrics = () => page.evaluate(() => {
      const icon = document.querySelector('#contacts .card.card--dark .contact-primary-icon');
      const pathNode = icon && icon.querySelector('svg path');
      const divider = document.querySelector('#contacts .card.card--dark .social-divider');
      if (!icon || !pathNode || !divider) return null;
      const pathStyle = getComputedStyle(pathNode);
      const before = getComputedStyle(divider, '::before');
      const after = getComputedStyle(divider, '::after');
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        iconBackground: getComputedStyle(icon).backgroundImage,
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
      expect(metrics.iconBackground).toContain('gradient');
      expect(metrics.pathFill).toBe('none');
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

  test('privacy reopens from footer on desktop and from Ещё on mobile', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.includes('mobile');
    await applyTheme(page, 'light', null);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const overlay = page.locator('.mc-consent-overlay');
    await expect(overlay).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('.mc-consent-dialog')).toBeVisible();
    await expect(page.locator('.mc-consent-settings')).toHaveCount(0);
    await page.locator('.mc-consent-dialog').screenshot({ path: proofPath(testInfo, 'privacy-dialog') });

    await page.locator('.mc-consent-close').click();
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBeNull();
    if (mobile) await waitForMobileAppShell(page);

    if (mobile) {
      await expect(page.locator('.site-footer .mc-consent-trigger')).toHaveCount(0);
      await page.locator('#mcMoreBtn').click();
      const privacyRow = page.locator('#mcPrivacyRow');
      await expect(privacyRow).toBeVisible();
      await expect(privacyRow.locator('.mc-row-sub')).toHaveText('Выбор не сделан');
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
    expect(initial.left).toBeLessThanOrEqual(2);
    expect(initial.rightGap).toBeLessThanOrEqual(2);
    expect(initial.bottomGap).toBeLessThanOrEqual(2);
    expect(initial.width).toBeGreaterThanOrEqual(initial.viewport - 4);

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
    expect(afterScroll.bottomGap).toBeLessThanOrEqual(2);
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
