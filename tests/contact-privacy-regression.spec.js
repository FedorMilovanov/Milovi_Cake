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

  test('privacy control is static in footer and dialog can close and reopen', async ({ page }, testInfo) => {
    await prepare(page, { theme: 'light', consent: null });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForContactPolish(page);

    const overlay = page.locator('.mc-consent-overlay');
    await expect(overlay).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('.mc-consent-dialog')).toBeVisible();
    await expect(page.locator('.mc-consent-settings')).toHaveCount(0);
    await page.locator('.mc-consent-dialog').screenshot({ path: proofPath(testInfo, 'privacy-dialog') });

    await page.locator('.mc-consent-close').click();
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBeNull();

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
    await trigger.click();
    await expect(overlay).toHaveClass(/is-open/);
    await page.locator('[data-choice="denied"]').click();
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBe('denied');

    await trigger.click();
    await expect(page.locator('.mc-consent-status-value')).toHaveText('Аналитика отключена');
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('approved mobile bottom navigation layout is restored', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only contract');
    await prepare(page, { theme: 'dark', consent: 'denied' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.locator('#mcNav');
    await expect(nav).toBeVisible();

    const geometry = await page.evaluate(() => {
      const nav = document.getElementById('mcNav');
      const orderCircle = nav && nav.querySelector('.mc-btn--order .mc-btn-circle');
      const rect = nav.getBoundingClientRect();
      const circle = orderCircle.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        left: rect.left,
        rightGap: window.innerWidth - rect.right,
        bottomGap: window.innerHeight - rect.bottom,
        width: rect.width,
        orderCircleWidth: circle.width,
        orderCircleHeight: circle.height
      };
    });

    expect(geometry.left).toBeLessThanOrEqual(2);
    expect(geometry.rightGap).toBeLessThanOrEqual(2);
    expect(geometry.bottomGap).toBeLessThanOrEqual(2);
    expect(geometry.width).toBeGreaterThanOrEqual(geometry.viewport - 4);
    expect(geometry.orderCircleWidth).toBeGreaterThanOrEqual(44);
    expect(geometry.orderCircleHeight).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: proofPath(testInfo, 'mobile-nav-restored'), fullPage: false });
  });
});
