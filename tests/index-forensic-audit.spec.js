const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PROOF_DIR = path.join(process.cwd(), 'test-results', 'ui-audit', 'index-forensic');
const MAJOR_SECTIONS = [
  ['home', '#home'],
  ['about', '#about'],
  ['catalog', '#catalog'],
  ['fillings', '#fillings'],
  ['calculator', '#calculator'],
  ['reviews', '#reviews'],
  ['why', '#why'],
  ['delivery', '#delivery'],
  ['content', '.content-block'],
  ['contacts', '#contacts'],
  ['footer', '.site-footer'],
];

function ensureProofDir() {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9а-яё_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function proofPath(testInfo, name, ext = 'png') {
  ensureProofDir();
  return path.join(PROOF_DIR, `${safeName(testInfo.project.name)}-${safeName(name)}.${ext}`);
}

function writeJson(testInfo, name, payload) {
  fs.writeFileSync(proofPath(testInfo, name, 'json'), JSON.stringify(payload, null, 2), 'utf8');
}

function writeText(testInfo, name, payload) {
  fs.writeFileSync(proofPath(testInfo, name, 'md'), payload, 'utf8');
}

async function applyThemeAndConsent(page, theme, consent = 'denied') {
  await page.addInitScript(({ themeValue, consentValue }) => {
    try {
      localStorage.setItem('mc_theme', themeValue);
      if (consentValue === null) localStorage.removeItem('milovi_analytics_consent_v1');
      else localStorage.setItem('milovi_analytics_consent_v1', consentValue);
    } catch (_) {}
    document.documentElement.setAttribute('data-theme', themeValue);
  }, { themeValue: theme, consentValue: consent });
}

async function settlePage(page, { freezeMotion = false } = {}) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.body && document.body.classList.contains('ready'), null, { timeout: 8000 });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    document.querySelectorAll('video').forEach((video) => {
      try {
        video.pause();
        if (Number.isFinite(video.duration) && video.duration > 0.15) video.currentTime = 0.1;
      } catch (_) {}
    });
  });
  if (freezeMotion) {
    await page.addStyleTag({ content: `
      html { scroll-behavior: auto !important; }
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    ` });
  }
  await page.waitForTimeout(180);
}

async function openHome(page, theme = 'light', consent = 'denied', options = {}) {
  await applyThemeAndConsent(page, theme, consent);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settlePage(page, options);
}

async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const step = Math.max(420, Math.floor(window.innerHeight * 0.72));
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await sleep(55);
    }
    window.scrollTo(0, max);
    await sleep(140);
    window.scrollTo(0, 0);
    await sleep(100);
  });
}

async function screenshotLocator(locator, filePath) {
  if (await locator.count() === 0) return false;
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().screenshot({ path: filePath, animations: 'disabled' });
  return true;
}

async function fullVisualScan(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    const selector = (el) => {
      if (el.id) return `#${el.id}`;
      const classes = Array.from(el.classList || []).slice(0, 3).join('.');
      return `${el.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
    };
    const duplicateIds = Object.entries(Array.from(document.querySelectorAll('[id]')).reduce((acc, el) => {
      acc[el.id] = (acc[el.id] || 0) + 1;
      return acc;
    }, {})).filter(([, count]) => count > 1);

    const unlabeledControls = Array.from(document.querySelectorAll('input, textarea, select')).filter((el) => {
      if (!visible(el) || el.type === 'hidden') return false;
      const explicit = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      return !explicit && !el.closest('label') && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby');
    }).map(selector);

    const unnamedButtons = Array.from(document.querySelectorAll('button, [role="button"]')).filter((el) => {
      if (!visible(el)) return false;
      const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
      return !name;
    }).map(selector);

    const missingAlt = Array.from(document.images).filter((img) => visible(img) && !img.hasAttribute('alt')).map(selector);
    const brokenImages = Array.from(document.images).filter((img) => {
      if (!visible(img)) return false;
      const rect = img.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > innerHeight + 500) return false;
      return !img.complete || img.naturalWidth < 2;
    }).map((img) => img.currentSrc || img.src || selector(img));

    const viewportOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const offscreen = Array.from(document.querySelectorAll('main *, footer *')).filter((el) => {
      if (!visible(el)) return false;
      const cs = getComputedStyle(el);
      if (['fixed', 'absolute'].includes(cs.position)) return false;
      if (el.closest('.review-track, .reviews-track, .carousel, .slider, .lightbox, .lb-overlay, .cart-drawer, .mobile-menu, .mc-sheet')) return false;
      const r = el.getBoundingClientRect();
      return r.left < -6 || r.right > innerWidth + 6;
    }).slice(0, 30).map((el) => ({ selector: selector(el), rect: el.getBoundingClientRect().toJSON() }));

    const clippedText = Array.from(document.querySelectorAll('main p, main span, main a, main button, main h1, main h2, main h3, footer span, footer a')).filter((el) => {
      if (!visible(el) || !(el.textContent || '').trim()) return false;
      const cs = getComputedStyle(el);
      if (!['hidden', 'clip'].includes(cs.overflow) && !['hidden', 'clip'].includes(cs.overflowX) && !['hidden', 'clip'].includes(cs.overflowY)) return false;
      return el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3;
    }).slice(0, 40).map((el) => ({ selector: selector(el), text: (el.textContent || '').trim().slice(0, 100) }));

    const tinyText = Array.from(document.querySelectorAll('main *, footer *')).filter((el) => {
      if (!visible(el) || !(el.textContent || '').trim() || el.children.length) return false;
      return parseFloat(getComputedStyle(el).fontSize) < 10;
    }).slice(0, 40).map((el) => ({ selector: selector(el), size: getComputedStyle(el).fontSize, text: el.textContent.trim().slice(0, 80) }));

    const headingLevels = Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')).filter(visible).map((el) => Number(el.tagName.slice(1)));
    const headingJumps = [];
    for (let i = 1; i < headingLevels.length; i += 1) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) headingJumps.push([headingLevels[i - 1], headingLevels[i], i]);
    }

    const visibleFixed = Array.from(document.querySelectorAll('body *')).filter((el) => {
      if (!visible(el)) return false;
      const pos = getComputedStyle(el).position;
      return pos === 'fixed' || pos === 'sticky';
    }).map((el) => ({ selector: selector(el), position: getComputedStyle(el).position, rect: el.getBoundingClientRect().toJSON(), zIndex: getComputedStyle(el).zIndex }));

    return {
      url: location.href,
      theme: document.documentElement.getAttribute('data-theme'),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportOverflow },
      duplicateIds,
      unlabeledControls,
      unnamedButtons,
      missingAlt,
      brokenImages,
      offscreen,
      clippedText,
      tinyText,
      headingLevels,
      headingJumps,
      visibleFixed,
    };
  });
}

async function assertNoVisibleLegacyPrivacy(page) {
  const visibleLegacy = await page.locator('#cookieBanner, .cookie-banner, .cookie-consent, #privacyModal, .privacy-modal, .cookie-modal').evaluateAll((els) => els.filter((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01 && r.width > 0 && r.height > 0;
  }).map((el) => el.id || el.className || el.tagName));
  expect(visibleLegacy, 'legacy cookie/privacy UI must not be visible').toEqual([]);
}

function numericPrice(text) {
  return Number(String(text || '').replace(/[^0-9]/g, ''));
}

function attachRuntimeCollectors(page) {
  const result = { consoleErrors: [], pageErrors: [], requestFailures: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') result.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => result.pageErrors.push(String(error && error.stack || error)));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (/google-analytics|googletagmanager|mc\.yandex\.ru|metrika/.test(url)) return;
    result.requestFailures.push({ url, error: request.failure() && request.failure().errorText });
  });
  return result;
}

async function sectionRects(page) {
  return page.evaluate((selectors) => Object.fromEntries(selectors.map(([name, sel]) => {
    const el = document.querySelector(sel);
    if (!el) return [name, null];
    const r = el.getBoundingClientRect();
    return [name, { x: Math.round(r.x), width: Math.round(r.width), height: Math.round(r.height) }];
  })), MAJOR_SECTIONS);
}

async function themeMetrics(page) {
  return page.evaluate(() => {
    const metric = (selector, pseudo = null) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const cs = getComputedStyle(el, pseudo);
      const r = el.getBoundingClientRect();
      return {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        borderColor: cs.borderColor,
        opacity: Number(cs.opacity),
        display: cs.display,
        visibility: cs.visibility,
        width: r.width,
        height: r.height,
        top: r.top,
        left: r.left,
      };
    };
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      body: metric('body'),
      header: metric('#siteHeader'),
      contacts: metric('#contacts'),
      contactDarkCard: metric('#contacts .card.card--dark'),
      formCard: metric('#contacts .card:not(.card--dark)'),
      phoneIcon: metric('#contacts .contact-primary-icon'),
      phonePath: metric('#contacts .contact-primary-icon svg path'),
      dividerBefore: metric('#contacts .social-divider', '::before'),
      dividerAfter: metric('#contacts .social-divider', '::after'),
      footerBottom: metric('.site-footer .footer-bottom'),
    };
  });
}

test.describe('INDEX forensic visual and interaction audit', () => {
  test('01 — complete light/dark visual atlas and macro/micro DOM scan', async ({ page }, testInfo) => {
    const runtime = attachRuntimeCollectors(page);
    const report = { project: testInfo.project.name, checks: 0, themes: {}, runtime };

    for (const theme of ['light', 'dark']) {
      await openHome(page, theme, 'denied', { freezeMotion: true });
      await scrollThroughPage(page);
      report.checks += 1;
      await expect(page.locator('body')).toHaveClass(/ready/);
      report.checks += 1;
      await expect(page.locator('h1')).toHaveCount(1);
      report.checks += 1;
      await expect(page.locator('main#main-content')).toBeVisible();
      report.checks += 1;
      await expect(page.locator('body')).not.toContainText('Пн–Вс');
      await assertNoVisibleLegacyPrivacy(page);
      report.checks += 1;

      for (const [name, selector] of MAJOR_SECTIONS) {
        const section = page.locator(selector).first();
        report.checks += 1;
        await expect(section, `${name} section exists`).toHaveCount(1);
        await screenshotLocator(section, proofPath(testInfo, `${theme}-${name}`));
      }

      await page.screenshot({ path: proofPath(testInfo, `${theme}-index-full`), fullPage: true, animations: 'disabled' });
      const scan = await fullVisualScan(page);
      report.themes[theme] = scan;
      report.checks += 6;
      expect(scan.theme).toBe(theme);
      expect(scan.document.viewportOverflow).toBeLessThanOrEqual(4);
      expect(scan.duplicateIds).toEqual([]);
      expect(scan.unlabeledControls).toEqual([]);
      expect(scan.unnamedButtons).toEqual([]);
      expect(scan.missingAlt).toEqual([]);
    }

    report.checks += 3;
    expect(runtime.pageErrors).toEqual([]);
    expect(runtime.consoleErrors.filter((text) => !/favicon|ResizeObserver loop/i.test(text))).toEqual([]);
    expect(runtime.requestFailures.filter((item) => !/fonts\.(googleapis|gstatic)\.com/.test(item.url))).toEqual([]);
    writeJson(testInfo, '01-visual-scan', report);
    writeText(testInfo, '01-visual-summary', `# INDEX forensic visual atlas\n\nProject: **${testInfo.project.name}**\n\nAutomated checks executed: **${report.checks}**\n\nFull-page and section screenshots were captured for light and dark themes.\n`);
  });

  test('02 — theme round-trip preserves geometry, premium phone icon and floating-label contour', async ({ page }, testInfo) => {
    await openHome(page, 'light', 'denied');
    await page.locator('#contacts').scrollIntoViewIfNeeded();
    const beforeRects = await sectionRects(page);
    const light = await themeMetrics(page);

    await page.locator('#themeToggleBtn').click();
    await page.waitForTimeout(420);
    const dark = await themeMetrics(page);
    const darkRects = await sectionRects(page);
    await screenshotLocator(page.locator('#contacts'), proofPath(testInfo, '02-contacts-dark-live'));
    await screenshotLocator(page.locator('.site-footer .footer-bottom'), proofPath(testInfo, '02-footer-dark-live'));

    expect(dark.theme).toBe('dark');
    expect(dark.body.backgroundColor).not.toBe(light.body.backgroundColor);
    expect(dark.contacts.backgroundColor + dark.contacts.backgroundImage).not.toBe(light.contacts.backgroundColor + light.contacts.backgroundImage);
    expect(dark.formCard.backgroundColor + dark.formCard.backgroundImage).not.toBe(light.formCard.backgroundColor + light.formCard.backgroundImage);
    expect(dark.footerBottom.backgroundColor + dark.footerBottom.backgroundImage).not.toBe(light.footerBottom.backgroundColor + light.footerBottom.backgroundImage);

    for (const name of Object.keys(beforeRects)) {
      if (!beforeRects[name] || !darkRects[name]) continue;
      expect(Math.abs(beforeRects[name].x - darkRects[name].x), `${name} x shift`).toBeLessThanOrEqual(2);
      expect(Math.abs(beforeRects[name].width - darkRects[name].width), `${name} width shift`).toBeLessThanOrEqual(2);
    }

    expect(dark.phoneIcon.backgroundImage).toContain('gradient');
    expect(dark.phonePath.backgroundImage).not.toContain('linear-gradient');
    const phoneSvg = page.locator('#contacts .contact-primary-icon svg').first();
    await expect(phoneSvg).toBeVisible();
    const phonePathStyle = await page.locator('#contacts .contact-primary-icon svg path').first().evaluate((el) => ({
      fill: getComputedStyle(el).fill,
      stroke: getComputedStyle(el).stroke,
      strokeWidth: getComputedStyle(el).strokeWidth,
    }));
    expect(phonePathStyle.fill).toBe('none');
    expect(phonePathStyle.stroke).not.toBe('none');
    expect(parseFloat(phonePathStyle.strokeWidth)).toBeGreaterThanOrEqual(1.4);
    expect(dark.dividerBefore.opacity).toBeGreaterThan(0.9);
    expect(dark.dividerAfter.opacity).toBeGreaterThan(0.9);
    expect(dark.dividerBefore.width).toBeGreaterThan(30);
    expect(dark.dividerAfter.width).toBeGreaterThan(30);

    const nameInput = page.locator('#fname');
    const group = nameInput.locator('..');
    const label = page.locator('label[for="fname"]');
    await nameInput.focus();
    await page.waitForTimeout(360);
    const focusedGeometry = await page.evaluate(() => {
      const g = document.querySelector('#fname').parentElement.getBoundingClientRect();
      const l = document.querySelector('label[for="fname"]').getBoundingClientRect();
      const after = getComputedStyle(document.querySelector('#fname').parentElement, '::after');
      return {
        groupTop: g.top,
        labelCenter: l.top + l.height / 2,
        labelTop: l.top,
        afterDisplay: after.display,
        afterContent: after.content,
      };
    });
    expect(Math.abs(focusedGeometry.labelCenter - focusedGeometry.groupTop), 'focused label must sit on the top contour').toBeLessThanOrEqual(4);
    expect(focusedGeometry.afterDisplay === 'none' || focusedGeometry.afterContent === 'none' || focusedGeometry.afterContent === 'normal').toBeTruthy();
    await page.screenshot({ path: proofPath(testInfo, '02-floating-label-focus'), clip: await group.boundingBox(), animations: 'disabled' });

    await nameInput.fill('Виктория');
    await page.locator('#fphone').focus();
    await page.waitForTimeout(280);
    const filledGeometry = await page.evaluate(() => {
      const g = document.querySelector('#fname').parentElement.getBoundingClientRect();
      const l = document.querySelector('label[for="fname"]').getBoundingClientRect();
      return Math.abs((l.top + l.height / 2) - g.top);
    });
    expect(filledGeometry).toBeLessThanOrEqual(4);

    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(420);
    const lightAgain = await themeMetrics(page);
    expect(lightAgain.theme).toBe('light');
    expect(lightAgain.body.backgroundColor).toBe(light.body.backgroundColor);
    await screenshotLocator(page.locator('#contacts'), proofPath(testInfo, '02-contacts-light-again'));

    writeJson(testInfo, '02-theme-metrics', { light, dark, lightAgain, beforeRects, darkRects, focusedGeometry, filledGeometry });
  });

  test('03 — every internal anchor, desktop/mobile navigation and fixed layer behaves geometrically', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.includes('mobile');
    await openHome(page, 'light', 'denied');

    const anchorAudit = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="#"]')).map((a) => {
      const href = a.getAttribute('href');
      return { href, text: (a.textContent || '').trim().slice(0, 80), exists: href === '#' || Boolean(document.querySelector(href)) };
    }));
    expect(anchorAudit.filter((item) => !item.exists)).toEqual([]);

    await page.locator('.skip-link').focus();
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);

    if (mobile) {
      await expect(page.locator('#mcNav')).toBeVisible();
      await expect(page.locator('#mcNav .mc-btn-label')).toHaveText(['Каталог', 'Начинки', 'Отзывы', 'Заказать', 'Ещё']);
      for (const label of ['Каталог', 'Начинки', 'Отзывы']) {
        await page.locator('#mcNav .mc-btn', { hasText: label }).click();
        await page.waitForTimeout(180);
        const expected = label === 'Каталог' ? '#catalog' : label === 'Начинки' ? '#fillings' : '#reviews';
        const geometry = await page.locator(expected).evaluate((el) => el.getBoundingClientRect().top);
        expect(geometry, `${label} target reaches viewport`).toBeLessThan(innerHeight * 0.45);
      }

      await page.locator('#burgerBtn').click();
      await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
      await screenshotLocator(page.locator('#mobileMenu'), proofPath(testInfo, '03-mobile-menu'));
      await page.locator('.mobile-menu-close').click();
      await expect(page.locator('#mobileMenu')).not.toHaveClass(/open/);

      await page.locator('#mcMoreBtn').click();
      await expect(page.locator('#mcSheet')).toHaveClass(/mc-open/);
      await screenshotLocator(page.locator('#mcSheet'), proofPath(testInfo, '03-mobile-more-sheet'));
      await expect(page.locator('#mcPrivacyRow')).toBeVisible();
      await page.evaluate(() => window.closeMcSheet && window.closeMcSheet());
    } else {
      for (const [text, target] of [['О нас', '#about'], ['Каталог', '#catalog'], ['Начинки', '#fillings'], ['Отзывы', '#reviews'], ['Контакты', '#contacts']]) {
        await page.locator('.header-nav a', { hasText: text }).first().click();
        await page.waitForTimeout(180);
        const top = await page.locator(target).evaluate((el) => el.getBoundingClientRect().top);
        expect(top, `${text} target reaches viewport`).toBeLessThan(150);
      }
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(260);
    await expect(page.locator('#backToTop')).toBeVisible();
    const layers = await page.evaluate(() => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { display: cs.display, visibility: cs.visibility, position: cs.position, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return { backToTop: rect('#backToTop'), nav: rect('#mcNav'), footer: rect('.site-footer .footer-bottom') };
    });
    if (mobile) {
      expect(layers.nav.position).toBe('fixed');
      expect(Math.abs(innerWidth - layers.nav.right)).toBeLessThanOrEqual(2);
      expect(layers.nav.left).toBeLessThanOrEqual(2);
      expect(Math.abs(innerHeight - layers.nav.bottom)).toBeLessThanOrEqual(2);
      expect(layers.backToTop.bottom).toBeLessThanOrEqual(layers.nav.top - 4);
      expect(layers.footer.bottom).toBeLessThanOrEqual(layers.nav.top + 1);
    }
    await page.locator('#backToTop').click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 }).toBeLessThan(20);
    writeJson(testInfo, '03-navigation-geometry', { mobile, anchorAudit, layers });
  });

  test('04 — calculator permutations, steppers, selections and cart flow', async ({ page }, testInfo) => {
    await openHome(page, 'light', 'denied');
    await page.locator('#calculator').scrollIntoViewIfNeeded();
    const variants = [
      { type: 'biscuit', label: 'Бисквитный' },
      { type: 'bento', label: 'Бенто' },
      { type: 'bentomaxi', label: 'Макси Бенто' },
      { type: 'cake3d', label: '3D Торт' },
    ];
    const results = [];

    for (const variant of variants) {
      const card = page.locator(`#calcType .calc-type-card[data-type="${variant.type}"]`);
      await card.click();
      await page.waitForTimeout(220);
      await expect(card).toHaveClass(/selected/);
      const priceText = await page.locator('#calcResult').textContent();
      const price = numericPrice(priceText);
      expect(price, `${variant.label} price`).toBeGreaterThan(0);
      results.push({ ...variant, price, priceText });
      await screenshotLocator(page.locator('.calc-wrap'), proofPath(testInfo, `04-calc-${variant.type}`));

      if (variant.type === 'biscuit' || variant.type === 'cake3d') {
        const before = await page.locator('#calcWeightVal').textContent();
        await page.locator('#calcWeightPlus').click();
        const after = await page.locator('#calcWeightVal').textContent();
        expect(after).not.toBe(before);
        await page.locator('#calcWeightMinus').click();
      } else {
        await expect(page.locator('#calcQtyRow')).toBeVisible();
        const before = await page.locator('#calcQtyVal').textContent();
        await page.locator('#calcQtyPlus').click();
        const after = await page.locator('#calcQtyVal').textContent();
        expect(after).not.toBe(before);
        await page.locator('#calcQtyMinus').click();
      }
    }

    await page.locator('#calcType .calc-type-card[data-type="biscuit"]').click();
    const fill = page.locator('#calcFill .calc-opt').first();
    if (await fill.count()) {
      await fill.click();
      if (await page.locator('#fillPopup').isVisible().catch(() => false)) {
        await expect(page.locator('#fillPopupTitle')).not.toHaveText('');
        await page.locator('#fillSheetSelect').click();
      }
      await expect(fill).toHaveClass(/selected/);
    }
    const decor = page.locator('#calcDecor .calc-opt').last();
    if (await decor.count()) {
      await decor.click();
      await expect(decor).toHaveClass(/selected/);
    }

    const badgeBefore = numericPrice(await page.locator('#cartBadge').textContent());
    await page.locator('.calc-add-btn').click();
    await page.waitForTimeout(250);
    const badgeAfter = numericPrice(await page.locator('#cartBadge').textContent());
    expect(badgeAfter).toBeGreaterThan(badgeBefore);
    await page.locator('#cartBtn').click();
    await expect(page.locator('#cartDrawer')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#cartDrawer')).toBeVisible();
    await screenshotLocator(page.locator('#cartDrawer'), proofPath(testInfo, '04-cart-selection'));

    await page.locator('#step2').click();
    await expect(page.locator('#cartFooter')).toBeVisible();
    await page.locator('#cname').fill('Тест UI');
    await page.locator('#cphone').fill('+7 900 000 00 00');
    await page.locator('#ccomment').fill('Проверка интерфейса без отправки');
    await screenshotLocator(page.locator('#cartDrawer'), proofPath(testInfo, '04-cart-data'));
    await page.locator('.cart-close').click();
    await expect(page.locator('#cartDrawer')).toHaveAttribute('aria-hidden', 'true');
    writeJson(testInfo, '04-calculator-results', { variants: results, badgeBefore, badgeAfter });
  });

  test('05 — content tabs, FAQs, review carousel, modal and lightboxes are all clickable', async ({ page }, testInfo) => {
    await openHome(page, 'dark', 'denied');
    await page.locator('.content-block').scrollIntoViewIfNeeded();

    const tabIds = ['vanilla', 'choco', 'classic'];
    for (const id of tabIds) {
      const tab = page.locator(`.cb-ftab[onclick*="${id}"]`);
      await tab.click();
      await expect(tab).toHaveClass(/cb-on/);
      await expect(page.locator(`#cb-${id}`)).toHaveClass(/cb-on/);
    }
    await screenshotLocator(page.locator('.cb-flavor-wrap'), proofPath(testInfo, '05-flavor-tabs'));

    const faqs = page.locator('.cb-faq-item');
    expect(await faqs.count()).toBeGreaterThanOrEqual(4);
    for (let index = 0; index < Math.min(4, await faqs.count()); index += 1) {
      const item = faqs.nth(index);
      await item.click();
      await page.waitForTimeout(110);
      const state = await item.evaluate((el) => ({
        openClass: el.classList.contains('cb-open') || el.classList.contains('open'),
        answerHeight: el.querySelector('.cb-faq-a').getBoundingClientRect().height,
      }));
      expect(state.openClass || state.answerHeight > 10).toBeTruthy();
    }
    await screenshotLocator(page.locator('.cb-faq'), proofPath(testInfo, '05-faq-open'));

    await page.locator('#reviews').scrollIntoViewIfNeeded();
    await expect.poll(async () => page.locator('#track .review-slide').count()).toBeGreaterThan(1);
    const activeIndex = () => page.locator('#track .review-slide').evaluateAll((slides) => slides.findIndex((slide) => slide.classList.contains('active')));
    const first = await activeIndex();
    await page.locator('#btnNext').click();
    await page.waitForTimeout(700);
    expect(await activeIndex()).not.toBe(first);
    await page.locator('#btnPrev').click();
    await page.waitForTimeout(700);
    expect(await activeIndex()).toBe(first);

    await page.locator('.map-badge-yandex').click();
    await expect(page.locator('#reviewsModal')).toHaveClass(/open/);
    await screenshotLocator(page.locator('#reviewsModal'), proofPath(testInfo, '05-reviews-modal-yandex'));
    await page.locator('#tabGoogle').click();
    await expect(page.locator('#reviewsGoogle')).toBeVisible();
    await screenshotLocator(page.locator('#reviewsModal'), proofPath(testInfo, '05-reviews-modal-google'));
    await page.locator('.reviews-modal-close').click();
    await expect(page.locator('#reviewsModal')).not.toHaveClass(/open/);

    const filmstrip = page.locator('.review-filmstrip-item').first();
    if (await filmstrip.count()) {
      await filmstrip.click();
      const overlay = page.locator('#lbOverlay');
      if (await overlay.isVisible().catch(() => false)) {
        await screenshotLocator(overlay, proofPath(testInfo, '05-review-lightbox'));
        await page.locator('#lbNext').click();
        await expect(page.locator('#lbArrCounter')).not.toHaveText('1 / 8');
        await page.locator('#lbX').click();
      }
    }
  });

  test('06 — contacts, social identities, privacy choices and correct responsive placement', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.includes('mobile');
    await openHome(page, 'light', null);
    const overlay = page.locator('.mc-consent-overlay');
    await expect(overlay).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('.mc-consent-dialog')).toBeVisible();
    await screenshotLocator(page.locator('.mc-consent-dialog'), proofPath(testInfo, '06-consent-first-visit'));
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBeNull();

    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBeNull();

    if (mobile) {
      await page.locator('#mcMoreBtn').click();
      await expect(page.locator('#mcPrivacyRow')).toBeVisible();
      await page.locator('#mcPrivacyRow').click();
    } else {
      const trigger = page.locator('.site-footer .mc-consent-trigger');
      await trigger.scrollIntoViewIfNeeded();
      await expect(trigger).toBeVisible();
      const placement = await trigger.evaluate((el) => ({
        inFooter: Boolean(el.closest('.footer-bottom')),
        position: getComputedStyle(el).position,
      }));
      expect(placement.inFooter).toBeTruthy();
      expect(['fixed', 'sticky']).not.toContain(placement.position);
      await trigger.click();
    }
    await expect(overlay).toHaveClass(/is-open/);
    await page.locator('[data-choice="denied"]').click();
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'))).toBe('denied');

    await page.locator('#contacts').scrollIntoViewIfNeeded();
    const messengerExpectations = [
      ['.messenger-bar-wa', /wa\.me\/79119038886/],
      ['.messenger-bar-tg', /t\.me\//],
      ['.messenger-bar-max', /max\.ru\/MiloviCake/],
      ['.social-link.vk', /vk\.com\/milovi_cake/],
      ['.social-link.tg', /t\.me\/MiloviCake/],
      ['.social-link.max', /max\.ru\/MiloviCake/],
      ['.social-link.yt', /youtube\.com\/@milovi_cake/],
      ['.social-link.ya', /yandex\.ru\/maps/],
      ['.social-link.google', /maps\.app\.goo\.gl/],
    ];
    for (const [selector, href] of messengerExpectations) {
      await expect(page.locator(`#contacts ${selector}`).first()).toHaveAttribute('href', href);
    }

    const socialStyles = await page.locator('#contacts .social-link').evaluateAll((links) => links.map((el) => ({
      classes: el.className,
      color: getComputedStyle(el).color,
      borderColor: getComputedStyle(el).borderColor,
      background: getComputedStyle(el).backgroundColor,
    })));
    expect(new Set(socialStyles.map((item) => item.color)).size).toBeGreaterThanOrEqual(4);
    await screenshotLocator(page.locator('#contacts .card.card--dark'), proofPath(testInfo, '06-contact-socials'));
    await screenshotLocator(page.locator('.site-footer'), proofPath(testInfo, '06-footer-placement'));
    await assertNoVisibleLegacyPrivacy(page);
    writeJson(testInfo, '06-contact-social-styles', { mobile, socialStyles });
  });

  test('07 — semantic, link, image, analytics and responsive forensic contracts', async ({ page, request }, testInfo) => {
    const runtime = attachRuntimeCollectors(page);
    const analyticsRequests = [];
    page.on('request', (req) => {
      if (/googletagmanager|google-analytics|mc\.yandex\.ru|metrika/.test(req.url())) analyticsRequests.push(req.url());
    });
    await openHome(page, 'light', null);
    await page.waitForTimeout(450);
    expect(analyticsRequests).toEqual([]);
    await page.keyboard.press('Escape');
    await scrollThroughPage(page);

    const semantic = await page.evaluate(() => {
      const visible = (el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const blankWithoutNoopener = Array.from(document.querySelectorAll('a[target="_blank"]')).filter((a) => !/\bnoopener\b/.test(a.getAttribute('rel') || '')).map((a) => a.href);
      const interactiveNested = Array.from(document.querySelectorAll('a button, button a, a input, button input')).filter(visible).map((el) => el.outerHTML.slice(0, 180));
      const buttonsWithoutNames = Array.from(document.querySelectorAll('button')).filter((button) => visible(button) && !(button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '').trim()).map((button) => button.outerHTML.slice(0, 160));
      const inputsWithoutAutocomplete = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea')).filter((el) => visible(el) && !el.getAttribute('autocomplete') && el.tagName !== 'TEXTAREA').map((el) => el.id || el.name || el.type);
      const internalPaths = Array.from(new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')).filter((href) => href && href.startsWith('/') && !href.startsWith('//')).map((href) => href.split('#')[0]).filter(Boolean)));
      const tapTargets = Array.from(document.querySelectorAll('a, button, input, textarea')).filter(visible).map((el) => {
        const r = el.getBoundingClientRect();
        return { selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${Array.from(el.classList).slice(0,2).join('.')}`, width: r.width, height: r.height, text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 60) };
      }).filter((item) => item.width < 24 || item.height < 24);
      return {
        lang: document.documentElement.lang,
        title: document.title,
        h1: document.querySelectorAll('h1').length,
        main: document.querySelectorAll('main').length,
        header: document.querySelectorAll('header').length,
        footer: document.querySelectorAll('footer').length,
        nav: document.querySelectorAll('nav').length,
        blankWithoutNoopener,
        interactiveNested,
        buttonsWithoutNames,
        inputsWithoutAutocomplete,
        internalPaths,
        tapTargets: tapTargets.slice(0, 40),
      };
    });

    expect(semantic.lang).toBe('ru');
    expect(semantic.title.length).toBeGreaterThan(20);
    expect(semantic.h1).toBe(1);
    expect(semantic.main).toBe(1);
    expect(semantic.header).toBeGreaterThanOrEqual(1);
    expect(semantic.footer).toBe(1);
    expect(semantic.nav).toBeGreaterThanOrEqual(1);
    expect(semantic.blankWithoutNoopener).toEqual([]);
    expect(semantic.interactiveNested).toEqual([]);
    expect(semantic.buttonsWithoutNames).toEqual([]);

    const pathResults = [];
    for (const internalPath of semantic.internalPaths.slice(0, 45)) {
      const response = await request.get(`http://127.0.0.1:4173${internalPath}`, { failOnStatusCode: false });
      pathResults.push({ path: internalPath, status: response.status() });
    }
    expect(pathResults.filter((item) => item.status >= 400)).toEqual([]);

    const imageAudit = await page.locator('img').evaluateAll((images) => images.filter((img) => {
      const cs = getComputedStyle(img);
      const r = img.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 20 && r.height > 20;
    }).map((img) => ({ src: img.currentSrc || img.src, complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })).filter((img) => !img.complete || img.naturalWidth < 2));
    expect(imageAudit).toEqual([]);
    expect(runtime.pageErrors).toEqual([]);
    expect(runtime.consoleErrors.filter((text) => !/ResizeObserver loop/i.test(text))).toEqual([]);
    writeJson(testInfo, '07-semantic-links-images', { semantic, pathResults, imageAudit, analyticsRequests, runtime });
  });

  test('08 — external live checks: release witness, W3C, PageSpeed and MDN Observatory', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'external services run once');
    ensureProofDir();
    const report = { checkedAt: new Date().toISOString(), target: 'https://milovicake.ru/', services: {} };

    const home = await request.get('https://milovicake.ru/', { failOnStatusCode: false, timeout: 30000 });
    report.services.home = {
      status: home.status(),
      headers: home.headers(),
      bytes: (await home.body()).length,
    };
    expect(home.status()).toBe(200);
    expect(home.headers()['content-type'] || '').toContain('text/html');

    const release = await request.get(`https://milovicake.ru/release.json?forensic=${Date.now()}`, { failOnStatusCode: false, timeout: 30000 });
    report.services.release = { status: release.status(), body: null };
    if (release.ok()) {
      report.services.release.body = await release.json().catch(async () => ({ raw: (await release.text()).slice(0, 500) }));
      expect(report.services.release.body.repository).toBe('FedorMilovanov/Milovi_Cake');
    }

    const w3cUrl = 'https://validator.w3.org/nu/?doc=https%3A%2F%2Fmilovicake.ru%2F&out=json';
    const w3c = await request.get(w3cUrl, { failOnStatusCode: false, timeout: 90000, headers: { 'User-Agent': 'MiloviCakeForensicAudit/1.0' } });
    report.services.w3c = { status: w3c.status(), errors: null, warnings: null, messages: [] };
    if (w3c.ok()) {
      const data = await w3c.json();
      report.services.w3c.messages = (data.messages || []).slice(0, 100);
      report.services.w3c.errors = (data.messages || []).filter((item) => item.type === 'error').length;
      report.services.w3c.warnings = (data.messages || []).filter((item) => item.type !== 'error').length;
    }

    for (const strategy of ['mobile', 'desktop']) {
      const query = new URLSearchParams({
        url: 'https://milovicake.ru/',
        strategy,
        category: 'performance',
        locale: 'ru',
      });
      const psiUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${query.toString()}&category=accessibility&category=best-practices&category=seo`;
      const psi = await request.get(psiUrl, { failOnStatusCode: false, timeout: 180000 });
      report.services[`pagespeed_${strategy}`] = { status: psi.status(), scores: null, metrics: null, error: null };
      if (psi.ok()) {
        const data = await psi.json();
        const categories = data.lighthouseResult && data.lighthouseResult.categories || {};
        const audits = data.lighthouseResult && data.lighthouseResult.audits || {};
        report.services[`pagespeed_${strategy}`].scores = Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, Math.round((value.score || 0) * 100)]));
        report.services[`pagespeed_${strategy}`].metrics = {
          fcp: audits['first-contentful-paint'] && audits['first-contentful-paint'].displayValue,
          lcp: audits['largest-contentful-paint'] && audits['largest-contentful-paint'].displayValue,
          cls: audits['cumulative-layout-shift'] && audits['cumulative-layout-shift'].displayValue,
          tbt: audits['total-blocking-time'] && audits['total-blocking-time'].displayValue,
          speedIndex: audits['speed-index'] && audits['speed-index'].displayValue,
        };
      } else {
        report.services[`pagespeed_${strategy}`].error = (await psi.text()).slice(0, 1000);
      }
    }

    const observatory = await request.post('https://observatory-api.mdn.mozilla.net/api/v2/scan?host=milovicake.ru', { failOnStatusCode: false, timeout: 120000 });
    report.services.mdn_observatory = { status: observatory.status(), result: null };
    if (observatory.ok()) report.services.mdn_observatory.result = await observatory.json().catch(async () => ({ raw: (await observatory.text()).slice(0, 1000) }));
    else report.services.mdn_observatory.result = { error: (await observatory.text()).slice(0, 1000) };

    writeJson(testInfo, '08-external-live-audit', report);
    const lines = [
      '# External live audit',
      '',
      `Target: ${report.target}`,
      `Checked: ${report.checkedAt}`,
      '',
      `- Homepage HTTP: ${report.services.home.status}`,
      `- Release witness HTTP: ${report.services.release.status}`,
      `- W3C HTTP: ${report.services.w3c.status}; errors: ${report.services.w3c.errors ?? 'unavailable'}; warnings: ${report.services.w3c.warnings ?? 'unavailable'}`,
      `- PageSpeed mobile: ${JSON.stringify(report.services.pagespeed_mobile.scores || { status: report.services.pagespeed_mobile.status })}`,
      `- PageSpeed desktop: ${JSON.stringify(report.services.pagespeed_desktop.scores || { status: report.services.pagespeed_desktop.status })}`,
      `- MDN Observatory HTTP: ${report.services.mdn_observatory.status}`,
      '',
      'Full raw responses are stored in the adjacent JSON report.',
    ];
    writeText(testInfo, '08-external-live-audit', lines.join('\n'));
  });
});
