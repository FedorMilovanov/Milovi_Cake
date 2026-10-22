const { test, expect } = require('@playwright/test');

const WIDTHS = [360, 390, 414, 561, 600, 768, 900, 1024];
const THEMES = ['light', 'dark'];
// final-fixes.css intentionally uses a 94% opaque mobile app-shell surface.
// Keep the guard aligned with that design token while still rejecting transparency regressions.
const MIN_MOBILE_NAV_ALPHA = 0.94;

function overlaps(a, b, tolerance = 2) {
  return !(
    a.x + a.width <= b.x + tolerance ||
    b.x + b.width <= a.x + tolerance ||
    a.y + a.height <= b.y + tolerance ||
    b.y + b.height <= a.y + tolerance
  );
}

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test(`@layout-matrix home ${width}px ${theme}: no camel-rule regressions`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('mc_theme', selectedTheme);
      }, theme);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.locator('body').dispatchEvent('click');
    await page.waitForSelector('.product-card');

      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      const cards = page.locator('.product-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        if (!(await card.isVisible())) continue;
        const button = card.locator('.btn-add');
        const price = card.locator('.price');
        if (await button.isVisible()) {
          const fit = await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
          expect(fit).toBeTruthy();
        }
        if (await button.isVisible() && await price.isVisible()) {
          const buttonBox = await button.boundingBox();
          const priceBox = await price.boundingBox();
          expect(buttonBox).not.toBeNull();
          expect(priceBox).not.toBeNull();
          expect(overlaps(buttonBox, priceBox)).toBeFalsy();
        }
      }

      const visibleLegacyNavs = await page.locator('#bottomNav:visible, #mrBottomNav:visible, .mobile-sticky-order:visible').count();
      if (width <= 768) {
        expect(visibleLegacyNavs).toBe(0);
        const mcNav = page.locator('#mcNav');
        await expect(mcNav).toBeVisible();
        const alpha = await mcNav.evaluate((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          const match = bg.match(/rgba?\(([^)]+)\)/i);
          if (!match) return 1;
          const parts = match[1].split(',').map((part) => part.trim());
          return parts.length < 4 ? 1 : Number(parts[3]);
        });
        expect(alpha).toBeGreaterThanOrEqual(MIN_MOBILE_NAV_ALPHA);
      }
    });
  }
}

// Prove the catalog CTA still fits if a visitor cannot reach Google Fonts.
for (const theme of THEMES) {
  test(`@layout-matrix home 561px ${theme}: buttons fit without web fonts`, async ({ page }) => {
    await page.setViewportSize({ width: 561, height: 900 });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort('blockedbyclient'));
    await page.addInitScript((selectedTheme) => localStorage.setItem('mc_theme', selectedTheme), theme);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('body').dispatchEvent('click');
    await page.waitForSelector('.product-card');
    await page.evaluate(() => document.fonts.ready);

    const buttons = await page.locator('.product-card .btn-add').evaluateAll((elements) => elements
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => ({ label: element.textContent.trim(), excess: element.scrollWidth - element.clientWidth })));
    expect(buttons.length).toBeGreaterThan(0);
    for (const { label, excess } of buttons) expect(excess, label).toBeLessThanOrEqual(1);
    const bentoBounds = await page.locator('#card-2').evaluate((card) => ({
      cardRight: card.getBoundingClientRect().right,
      maxiRight: card.querySelector('.bento-seg-opt:last-child').getBoundingClientRect().right,
    }));
    expect(bentoBounds.maxiRight).toBeLessThanOrEqual(bentoBounds.cardRight - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

// Price and button must not squeeze each other on narrow desktop cards.
for (const width of [900, 1024, 1280, 1440]) {
  for (const theme of THEMES) {
    test(`@layout-matrix home ${width}px ${theme}: narrow desktop prices stay on one line`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort('blockedbyclient'));
      await page.addInitScript((selectedTheme) => localStorage.setItem('mc_theme', selectedTheme), theme);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-card');
      await page.evaluate(() => document.fonts.ready);

      const footers = await page.locator('.product-card').evaluateAll((cards) => cards
        .filter((card) => card.getBoundingClientRect().width > 0)
        .map((card) => {
          const footer = card.querySelector('.product-footer');
          const price = footer.querySelector('.price');
          const button = footer.querySelector('.btn-add');
          const priceBox = price.getBoundingClientRect();
          const buttonBox = button.getBoundingClientRect();
          const footerBox = footer.getBoundingClientRect();
          return {
            label: price.textContent.trim(),
            direction: getComputedStyle(footer).flexDirection,
            priceHeight: priceBox.height,
            priceRight: priceBox.right,
            priceBottom: priceBox.bottom,
            buttonTop: buttonBox.top,
            buttonLeft: buttonBox.left,
            buttonExcess: button.scrollWidth - button.clientWidth,
            footerRight: footerBox.right,
          };
        }));
      expect(footers.length).toBeGreaterThan(0);
      for (const footer of footers) {
        expect(footer.direction, footer.label).toBe(width <= 1280 ? 'column' : 'row');
        expect(footer.priceHeight, footer.label).toBeLessThanOrEqual(30);
        expect(footer.priceRight, footer.label).toBeLessThanOrEqual(footer.footerRight + 1);
        if (footer.direction === 'column') {
          expect(footer.priceBottom + 4, footer.label).toBeLessThanOrEqual(footer.buttonTop);
        } else {
          expect(footer.priceRight + 4, footer.label).toBeLessThanOrEqual(footer.buttonLeft);
        }
        expect(footer.buttonExcess, footer.label).toBeLessThanOrEqual(1);
      }
    });
  }
}

test('@layout-matrix @gallery phone card media policy: measured cards use conditional AVIF and LCP stays full-size', async ({ page }) => {
  const optimizedIds = ['p05', 'p06', 'p09', 'p12', 'p18'];
  const phoneMedia = '(max-width: 430px) and (max-resolution: 1.75dppx)';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#galleryGrid [data-id="p18"] img.card-media');
  expect(await page.evaluate((q) => matchMedia(q).matches, phoneMedia)).toBeTruthy();
  for (const id of optimizedIds) {
    const number = id.slice(1);
    const card = page.locator(`#galleryGrid [data-id="${id}"]`);
    await expect(card.locator('img.card-media')).toHaveAttribute('src', `/img/gallery/gallery-${number}.webp`);
    const sources = card.locator('source[type="image/avif"]');
    await expect(sources).toHaveCount(2);
    await expect(sources.nth(0)).toHaveAttribute('media', phoneMedia);
    await expect(sources.nth(0)).toHaveAttribute('srcset', `/img/gallery/gallery-${number}-card.avif`);
    await expect(sources.nth(1)).toHaveAttribute('srcset', `/img/gallery/gallery-${number}.avif`);
  }
  const lcpCard = page.locator('#galleryGrid [data-id="p01"]');
  await expect(lcpCard.locator('source[type="image/avif"]')).toHaveCount(1);
  await expect(lcpCard.locator('source[type="image/avif"]')).toHaveAttribute('srcset', '/img/gallery/gallery-01.avif');
  await page.setViewportSize({ width: 900, height: 900 });
  expect(await page.evaluate((q) => matchMedia(q).matches, phoneMedia)).toBeFalsy();
});

test('@layout-matrix @gallery progressive grid hydration cancels stale filter batches', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });

  const grid = page.locator('#galleryGrid');
  const cards = grid.locator('.card');
  await expect(cards).toHaveCount(46);
  await expect(grid).not.toHaveAttribute('data-hydrating', 'true');

  await page.locator('[data-filter="video"]').click();
  await page.locator('[data-filter="all"]').click();
  await expect(cards).toHaveCount(46);
  await expect(grid).not.toHaveAttribute('data-hydrating', 'true');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const ids = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')));
  expect(ids).toHaveLength(46);
  expect(new Set(ids).size).toBe(46);
  expect(ids[0]).toBe('p01');
});

test('@layout-matrix @gallery typography cannot trigger a late Google Fonts layout swap', async ({ page }) => {
  const remoteFontFiles = [];
  page.on('request', (request) => {
    if (/fonts\.gstatic\.com/i.test(request.url())) remoteFontFiles.push(request.url());
  });

  await page.goto('/gallery/', { waitUntil: 'networkidle' });
  await expect(page.locator('#gallery-stable-fonts')).toHaveCount(1);
  await expect(page.locator('.mc-consent-trigger')).toBeVisible();

  const initialFonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector('.gx-heading')).fontFamily,
    seoHeading: getComputedStyle(document.querySelector('.gx-seo-panel h2')).fontFamily,
    consentTrigger: getComputedStyle(document.querySelector('.mc-consent-trigger')).fontFamily,
  }));

  expect(initialFonts.body).not.toMatch(/Jost/i);
  expect(initialFonts.heading).not.toMatch(/Cormorant Garamond/i);
  expect(initialFonts.seoHeading).not.toMatch(/Cormorant Garamond/i);
  expect(initialFonts.consentTrigger).not.toMatch(/Jost/i);
  expect(remoteFontFiles).toEqual([]);

  await page.locator('.mc-consent-trigger').click();
  await expect(page.locator('.mc-consent-overlay')).toHaveClass(/is-open/);
  await expect(page.locator('.mc-consent-title')).toBeVisible();
  const consentTitleFont = await page.locator('.mc-consent-title').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(consentTitleFont).not.toMatch(/Cormorant Garamond/i);
  await page.waitForTimeout(250);
  expect(remoteFontFiles).toEqual([]);
});

// The wedding image is an editorial photo, not a background for mobile copy.
// The crop guard covers the cake's approximate x=880–1230 region in wedding-hero.avif.
for (const width of [360, 390, 414, 561, 600, 768, 900, 1024, 1536]) {
  for (const theme of THEMES) {
    test(`@layout-matrix @wedding-hero ${width}px ${theme}: cake, contrast and spacing`, async ({ browser }) => {
      const height = width === 360 ? 800 : width === 390 ? 844 : width === 414 ? 896 : 900;
      const context = await browser.newContext({
        baseURL: 'http://127.0.0.1:4173',
        storageState: 'tests/analytics-denied.storage-state.json',
        viewport: { width, height },
        isMobile: width <= 768,
        hasTouch: width <= 768,
        colorScheme: theme,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      try {
        await context.addInitScript((selectedTheme) => localStorage.setItem('mc_theme', selectedTheme), theme);
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
        await page.locator('.wed-hero-media img').evaluate((image) => image.decode());

        const view = await page.evaluate(() => {
          const element = (selector) => document.querySelector(selector);
          const rect = (selector) => element(selector).getBoundingClientRect().toJSON();
          const image = element('.wed-hero-media img');
          const media = rect('.wed-hero-visual');
          const scale = Math.max(media.width / image.naturalWidth, media.height / image.naturalHeight);
          const sourceLeft = image.naturalWidth - media.width / scale + (image.naturalWidth === 900 ? 476 : 0); // compare the original artwork coordinates
          return {
            theme: document.documentElement.dataset.theme,
            overflow: document.documentElement.scrollWidth - innerWidth,
            imageWidth: image.naturalWidth,
            imagePosition: getComputedStyle(image).objectPosition,
            visualPosition: getComputedStyle(element('.wed-hero-visual')).position,
            scrollHint: getComputedStyle(element('.wed-scroll')).display,
            scrim: getComputedStyle(element('.wed-hero'), '::before').backgroundImage,
            background: getComputedStyle(element('.wed-hero')).backgroundColor,
            headingColor: getComputedStyle(element('.wed-hero h1')).color,
            buttonOverflow: Math.max(...[...document.querySelectorAll('.wed-btn, .lp-final .lp-btn')]
              .map((button) => button.scrollWidth - button.clientWidth)),
            crop: { left: sourceLeft, right: sourceLeft + media.width / scale },
            header: rect('.lp-header'), kicker: rect('.wed-kicker'),
            lead: rect('.wed-lead'), media, introText: rect('.wed-date-intro'),
            badge: rect('.wed-badge'), hero: rect('.wed-hero'), meta: rect('.wed-meta'),
            finalText: rect('.lp-final p'), finalActions: rect('.lp-final .lp-actions'),
            final: rect('.lp-final'), footer: rect('.landing-footer-grid'),
          };
        });
        const channels = (color) => (color.match(/\d+/g) || []).slice(0, 3).map(Number);
        expect(view.theme).toBe(theme);
        expect(view.imageWidth).toBe(width <= 500 ? 900 : 1376);
        expect(view.overflow).toBeLessThanOrEqual(1);
        expect(view.buttonOverflow).toBeLessThanOrEqual(1);
        expect(view.hero.bottom - view.meta.bottom).toBeGreaterThanOrEqual(48);
        expect(view.finalActions.top - view.finalText.bottom).toBeGreaterThanOrEqual(20);
        expect(view.final.bottom - view.finalActions.bottom).toBeGreaterThanOrEqual(60);
        expect(view.footer.top).toBeGreaterThanOrEqual(view.final.bottom - 1);
        expect(pageErrors).toEqual([]);

        if (theme === 'dark') {
          expect(Math.max(...channels(view.background))).toBeLessThan(80);
          expect(Math.min(...channels(view.headingColor))).toBeGreaterThan(180);
        } else {
          expect(Math.min(...channels(view.background))).toBeGreaterThan(180);
          expect(Math.max(...channels(view.headingColor))).toBeLessThan(90);
        }
        if (width <= 900) {
          expect(view.visualPosition).toBe('relative');
          expect(view.imagePosition).toBe('100% 50%');
          expect(view.media.width).toBeGreaterThanOrEqual(width - 1);
          expect(view.media.height).toBeGreaterThanOrEqual(350);
          expect(view.crop.left).toBeLessThanOrEqual(880);
          expect(view.crop.right).toBeGreaterThanOrEqual(1230);
          expect(view.kicker.top - view.header.bottom).toBeGreaterThanOrEqual(24);
          expect(view.media.top - view.lead.bottom).toBeGreaterThanOrEqual(24);
          expect(view.introText.top - view.media.bottom).toBeGreaterThanOrEqual(28);
          expect(view.media.top).toBeLessThan(height - 120);
          expect(view.scrollHint).toBe('none');
          expect(view.scrim).toBe('none');
        } else {
          expect(view.visualPosition).toBe('absolute');
          expect(view.scrim.includes('linear-gradient')).toBe(theme === 'dark');
        }
        expect(view.badge.left).toBeGreaterThanOrEqual(view.media.left + 12);
        expect(view.badge.right).toBeLessThanOrEqual(view.media.right - 12);
        expect(view.badge.bottom).toBeLessThanOrEqual(view.media.bottom - 12);
      } finally {
        await context.close();
      }
    });
  }
}

test('@layout-matrix @wedding-hero follows system dark mode without a saved theme', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    storageState: 'tests/analytics-denied.storage-state.json',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.wed-hero')).toHaveCSS('background-color', 'rgb(26, 17, 8)');
    await page.locator('.lp-theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.wed-hero')).toHaveCSS('background-color', 'rgb(239, 231, 218)');
  } finally {
    await context.close();
  }
});

for (const width of [360, 390, 414, 561, 600, 768, 900, 1024, 1536]) {
  for (const theme of THEMES) {
    test(`@layout-matrix @wedding-collection ${width}px ${theme}: columns, cards and detail spacing`, async ({ browser }) => {
      const context = await browser.newContext({
        baseURL: 'http://127.0.0.1:4173',
        storageState: 'tests/analytics-denied.storage-state.json',
        viewport: { width, height: width === 360 ? 800 : width === 390 ? 844 : 900 },
        isMobile: width <= 768,
        hasTouch: width <= 768,
        colorScheme: theme,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      try {
        await context.addInitScript((selectedTheme) => localStorage.setItem('mc_theme', selectedTheme), theme);
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
        await page.locator('.wed-collection-card img').evaluateAll(async (images) => {
          images.forEach((image) => { image.loading = 'eager'; });
          await Promise.all(images.map((image) => image.decode()));
        });
        const view = await page.evaluate(() => {
          const element = (selector) => document.querySelector(selector);
          const rect = (node) => {
            const box = node.getBoundingClientRect();
            return { top: box.top + scrollY, bottom: box.bottom + scrollY,
              left: box.left, right: box.right, width: box.width };
          };
          const cards = [...document.querySelectorAll('.wed-collection-card')];
          const images = cards.map((card) => card.querySelector('img'));
          const banner = element('.wed-collection-detail');
          return {
            theme: document.documentElement.dataset.theme,
            overflow: document.documentElement.scrollWidth - innerWidth,
            columns: getComputedStyle(element('.wed-collection-grid')).gridTemplateColumns.split(' ').length,
            background: getComputedStyle(element('.wed-collection')).backgroundColor,
            headingColor: getComputedStyle(element('#wedCollectionTitle')).color,
            motion: getComputedStyle(images[0]).transitionDuration,
            mobileMenu: getComputedStyle(element('.wed-mobile-menu')).display,
            hero: rect(element('.wed-hero')), section: rect(element('.wed-collection')),
            heading: rect(element('#wedCollectionTitle')),
            intro: rect(element('.wed-collection-head>p')),
            cards: cards.map(rect), photos: cards.map((card) => rect(card.querySelector('.wed-collection-photo'))),
            images: images.map((image) => ({ loaded: image.complete && image.naturalWidth > 0, src: image.currentSrc })),
            titles: cards.map((card) => card.querySelector('h3').scrollWidth - card.querySelector('h3').clientWidth),
            note: rect(element('.wed-collection-note')), banner: rect(banner),
            bannerCopy: rect(banner.querySelector('.wed-collection-detail-copy')),
            bannerAction: rect(banner.querySelector('a')),
            calculator: rect(element('.wed-collection + .lp-section')),
          };
        });
        const channels = (color) => (color.match(/\d+/g) || []).slice(0, 3).map(Number);
        expect(view.theme).toBe(theme);
        expect(view.overflow).toBeLessThanOrEqual(1);
        expect(view.columns).toBe(width <= 860 ? 2 : 4);
        expect(view.mobileMenu === 'none').toBe(width > 860);
        expect(parseFloat(view.motion)).toBeLessThanOrEqual(0.00002);
        expect(view.images.every(({ loaded, src }) => loaded && /wedding-style-.*\.avif$/.test(src))).toBe(true);
        expect(Math.max(...view.titles)).toBeLessThanOrEqual(1);
        expect(view.section.top).toBeGreaterThanOrEqual(view.hero.bottom - 1);
        expect(view.photos[0].top - view.intro.bottom).toBeGreaterThanOrEqual(20);
        expect(view.cards[0].top).toBeCloseTo(view.cards[1].top, 0);
        if (width <= 860) expect(view.cards[2].top).toBeGreaterThanOrEqual(view.cards[0].bottom + 12);
        else expect(view.cards[3].top).toBeCloseTo(view.cards[0].top, 0);
        expect(view.note.top - view.cards[3].bottom).toBeGreaterThanOrEqual(20);
        expect(view.banner.top - view.note.bottom).toBeGreaterThanOrEqual(32);
        expect(view.bannerAction.bottom).toBeLessThanOrEqual(view.banner.bottom - 14);
        expect(view.bannerCopy.left).toBeGreaterThanOrEqual(view.banner.left);
        expect(view.section.bottom - view.banner.bottom).toBeGreaterThanOrEqual(70);
        expect(view.calculator.top).toBeGreaterThanOrEqual(view.section.bottom - 1);
        for (const card of view.cards) {
          expect(card.left).toBeGreaterThanOrEqual(18);
          expect(card.right).toBeLessThanOrEqual(width - 18);
        }
        if (theme === 'dark') {
          expect(Math.max(...channels(view.background))).toBeLessThan(80);
          expect(Math.min(...channels(view.headingColor))).toBeGreaterThan(180);
        } else {
          expect(Math.min(...channels(view.background))).toBeGreaterThan(180);
          expect(Math.max(...channels(view.headingColor))).toBeLessThan(90);
        }
        expect(pageErrors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
