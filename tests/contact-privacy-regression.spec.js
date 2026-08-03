const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const proofDir = path.join(process.cwd(), 'test-results', 'ui-audit');

function proofPath(testInfo, name) {
  fs.mkdirSync(proofDir, { recursive: true });
  return path.join(proofDir, `${testInfo.project.name}-${name}.png`);
}

async function prepare(page, { theme = 'light', consent = 'denied' } = {}) {
  await page.addInitScript(({ themeValue, consentValue }) => {
    localStorage.setItem('mc_theme', themeValue);
    document.documentElement.setAttribute('data-theme', themeValue);
    if (consentValue === null) localStorage.removeItem('milovi_analytics_consent_v1');
    else localStorage.setItem('milovi_analytics_consent_v1', consentValue);
  }, { themeValue: theme, consentValue: consent });
}

async function waitForContactPolish(page) {
  await page.waitForFunction(() => {
    const link = document.getElementById('milovi-contact-polish');
    if (!link) return false;
    return Array.from(document.styleSheets).some((sheet) => sheet.href && sheet.href.includes('contact-polish.css'));
  });
}

async function waitForMobileShell(page) {
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

async function contactMetrics(page) {
  return page.evaluate(() => {
    const icon = document.querySelector('#contacts .card.card--dark .contact-primary-icon');
    const svg = icon && icon.querySelector('svg');
    const path = svg && svg.querySelector('path');
    const divider = document.querySelector('#contacts .card.card--dark .social-divider');
    if (!icon || !svg || !path || !divider) return null;
    const iconStyle = getComputedStyle(icon);
    const svgStyle = getComputedStyle(svg);
    const pathStyle = getComputedStyle(path);
    const before = getComputedStyle(divider, '::before');
    const after = getComputedStyle(divider, '::after');
    const rect = divider.getBoundingClientRect();
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      iconBackground: iconStyle.backgroundImage,
      iconBorder: iconStyle.borderColor,
      iconColor: iconStyle.color,
      svgStroke: svgStyle.stroke,
      pathStroke: pathStyle.stroke,
      pathFill: pathStyle.fill,
      dividerBefore: before.backgroundImage,
      dividerAfter: after.backgroundImage,
      dividerBeforeOpacity: Number(before.opacity),
      dividerAfterOpacity: Number(after.opacity),
      dividerWidth: rect.width,
      legacyFixedPrivacy: Boolean(document.querySelector('.mc-consent-settings'))
    };
  });
}

function rgbBrightness(value) {
  const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return 0;
  return (Number(match[1]) + Number(match[2]) + Number(match[3])) / 3;
}

function expectContactStable(metrics) {
  expect(metrics).not.toBeNull();
  expect(metrics.iconBackground).toContain('gradient');
  expect(metrics.pathFill).toBe('none');
  expect(rgbBrightness(metrics.pathStroke)).toBeGreaterThan(155);
  expect(metrics.dividerBefore).toContain('gradient');
  expect(metrics.dividerAfter).toContain('gradient');
  expect(metrics.dividerBeforeOpacity).toBeGreaterThan(0.9);
  expect(metrics.dividerAfterOpacity).toBeGreaterThan(0.9);
  expect(metrics.dividerWidth).toBeGreaterThan(220);
  expect(metrics.legacyFixedPrivacy).toBe(false);
}

test.describe('contact theme and privacy regressions', () => {
  test('phone icon and social divider survive light → dark → light', async ({ page }, testInfo) => {
    await prepare(page, { theme: 'light', consent: 'denied' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForContactPolish(page);
    await page.locator('#contacts').scrollIntoViewIfNeeded();

    const lightFirst = await contactMetrics(page);
    expectContactStable(lightFirst);
    await page.locator('#contacts').screenshot({ path: proofPath(testInfo, 'contacts-light') });

    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(380);
    const dark = await contactMetrics(page);
    expect(dark.theme).toBe('dark');
    expectContactStable(dark);
    await page.locator('#contacts').screenshot({ path: proofPath(testInfo, 'contacts-dark') });

    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(380);
    const lightAgain = await contactMetrics(page);
    expect(lightAgain.theme).toBe('light');
    expectContactStable(lightAgain);
  });

  test('privacy dialog closes and reopens from the correct responsive control', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.includes('mobile');
    await prepare(page, { theme: 'light', consent: null });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForContactPolish(page);
    await waitForMobileShell(page);

    const overlay = page.locator('.mc-consent-overlay');
    await expect(overlay).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('.mc-consent-dialog')).toBeVisible();
    await expect(page.locator('.mc-consent-settings')).toHaveCount(0);
    await page.locator('.mc-consent-dialog').screenshot({ path: proofPath(testInfo, 'privacy-dialog') });

    await page.locator('.mc-consent-close').click();
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBeNull();

    let reopen;
    if (mobile) {
      await expect(page.locator('.site-footer .mc-consent-trigger')).toHaveCount(0);
      await page.locator('#mcMoreBtn').click();
      const privacyRow = page.locator('#mcPrivacyRow');
      await expect(privacyRow).toBeVisible();
      await expect(privacyRow.locator('.mc-row-sub')).toHaveText('Выбор не сделан');
      await page.locator('#mcSheet').screenshot({ path: proofPath(testInfo, 'mobile-more-privacy') });
      reopen = async () => {
        if (!(await privacyRow.isVisible())) await page.locator('#mcMoreBtn').click();
        await privacyRow.click();
      };
    } else {
      const trigger = page.locator('.mc-consent-trigger');
      await trigger.scrollIntoViewIfNeeded();
      await expect(trigger).toBeVisible();
      const triggerContract = await trigger.evaluate((element) => ({
        position: getComputedStyle(element).position,
        inFooterBottom: Boolean(element.closest('.footer-bottom')),
        overlapTopButton: (() => {
          const top = document.querySelector('.back-to-top');
          if (!top) return false;
          const a = element.getBoundingClientRect();
          const b = top.getBoundingClientRect();
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        })()
      }));
      expect(triggerContract.inFooterBottom).toBe(true);
      expect(['fixed', 'sticky']).not.toContain(triggerContract.position);
      expect(triggerContract.overlapTopButton).toBe(false);
      await page.locator('.site-footer .footer-bottom').screenshot({ path: proofPath(testInfo, 'footer-capsule') });
      reopen = async () => trigger.click();
    }

    await reopen();
    await expect(overlay).toHaveClass(/is-open/);
    await page.locator('[data-choice="denied"]').click();
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBe('denied');

    await reopen();
    await expect(page.locator('.mc-consent-status-value')).toHaveText('Аналитика отключена');
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('mobile has one persistent app navigation and a clean footer boundary', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only contract');
    await prepare(page, { theme: 'dark', consent: 'denied' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForContactPolish(page);
    await waitForMobileShell(page);

    const nav = page.locator('#mcNav');
    await expect(nav).toBeVisible();
    await expect(nav.locator('.mc-btn-label')).toHaveText(['Каталог', 'Начинки', 'Отзывы', 'Заказать', 'Ещё']);

    const initial = await page.evaluate(() => {
      const nav = document.getElementById('mcNav');
      const orderCircle = nav.querySelector('.mc-btn--order .mc-btn-circle');
      const rect = nav.getBoundingClientRect();
      const circle = orderCircle.getBoundingClientRect();
      const candidates = ['mcNav', 'bottomNav', 'mrBottomNav']
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .filter((element) => {
          const style = getComputedStyle(element);
          const r = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        })
        .map((element) => element.id);
      return {
        viewport: window.innerWidth,
        left: rect.left,
        rightGap: window.innerWidth - rect.right,
        bottomGap: window.innerHeight - rect.bottom,
        width: rect.width,
        orderCircleWidth: circle.width,
        orderCircleHeight: circle.height,
        visibleNavs: candidates
      };
    });

    expect(initial.visibleNavs).toEqual(['mcNav']);
    expect(initial.left).toBeLessThanOrEqual(2);
    expect(initial.rightGap).toBeLessThanOrEqual(2);
    expect(initial.bottomGap).toBeLessThanOrEqual(2);
    expect(initial.width).toBeGreaterThanOrEqual(initial.viewport - 4);
    expect(initial.orderCircleWidth).toBeGreaterThanOrEqual(44);
    expect(initial.orderCircleHeight).toBeGreaterThanOrEqual(44);

    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.55, behavior: 'instant' }));
    await page.waitForTimeout(250);
    await expect(nav).toBeVisible();
    const afterScroll = await nav.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        bottom: window.innerHeight - rect.bottom,
        width: rect.width,
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents
      };
    });
    expect(afterScroll.bottom).toBeLessThanOrEqual(2);
    expect(afterScroll.width).toBeGreaterThanOrEqual(initial.viewport - 4);
    expect(afterScroll.display).not.toBe('none');
    expect(afterScroll.visibility).toBe('visible');
    expect(afterScroll.pointerEvents).not.toBe('none');

    const footerBottom = page.locator('.site-footer .footer-bottom');
    await footerBottom.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const boundary = await page.evaluate(() => {
      const footer = document.querySelector('.site-footer .footer-bottom');
      const nav = document.getElementById('mcNav');
      const a = footer.getBoundingClientRect();
      const b = nav.getBoundingClientRect();
      return { footerBottom: a.bottom, navTop: b.top, overlap: a.bottom > b.top + 1 };
    });
    expect(boundary.overlap).toBe(false);
    await page.screenshot({ path: proofPath(testInfo, 'mobile-app-footer'), fullPage: false });

    await page.locator('#mcMoreBtn').click();
    await expect(page.locator('#mcPrivacyRow')).toBeVisible();
    await expect(page.locator('.site-footer .mc-consent-trigger')).toHaveCount(0);
  });
});
