const { test, expect } = require('@playwright/test');

const pages = [
  { path: '/zakazat-tort-spb/', h1: /Заказать торт в СПб/i },
  { path: '/tort-s-dostavkoy/', h1: /Торт с доставкой/i },
  { path: '/tort-na-den-rozhdeniya/', h1: /Торт на день рождения/i },
  { path: '/bento-torty/', h1: /Бенто-торты/i },
  { path: '/detskie-torty/', h1: /Детские торты/i },
  { path: '/svadebnye-torty/', h1: /Свадебные торты/i },
  { path: '/o-konditere/', h1: /О кондитере/i },
  { path: '/dostavka-i-oplata/', h1: /Доставка и оплата/i },
  { path: '/otzyvy/', h1: /Отзывы клиентов/i },
];

test.describe('new SEO landing pages', () => {
  for (const pageInfo of pages) {
    test(`${pageInfo.path} renders cleanly`, async ({ page }) => {
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));

      await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1')).toContainText(pageInfo.h1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${pageInfo.path.replace(/\//g, '\\/')}$`));
      await expect(page.locator('.landing-footer')).toBeVisible();
      await expect(page.locator('.landing-footer')).toContainText('Пн–Сб, 10:00–20:00');
      await expect(page.locator('body')).not.toContainText('Пн–Вс');

      const wa = page.locator('a[href*="wa.me"]').first();
      await expect(wa).toBeVisible();
      await expect(wa).toHaveAttribute('href', /wa\.me\/79119038886/);

      const jsonLdCount = await page.locator('script[type="application/ld+json"]').count();
      expect(jsonLdCount).toBeGreaterThanOrEqual(1);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(4);

      const seriousConsoleErrors = consoleErrors.filter((text) =>
        !/favicon|Failed to load resource|net::ERR|mc\.yandex|googletagmanager|googleapis|gstatic/i.test(text)
      );
      expect(seriousConsoleErrors).toEqual([]);
    });
  }
});

test.describe('premium media blocks', () => {
  test('wedding page has the concept collection and real portfolio media', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.wed-collection')).toBeVisible();
    await expect(page.locator('.wed-collection-card')).toHaveCount(4);
    await expect(page.locator('.wed-collection-note')).toContainText('не фотографии выполненных заказов');
    await expect(page.locator('.bridal-route')).toBeVisible();
    await expect(page.locator('.bridal-callout')).toBeVisible();
    await expect(page.locator('.lp-media-showcase')).toBeVisible();
    await expect(page.locator('video source[src*="video-12-wedding-heart.webm"]')).toHaveCount(1);
    await expect(page.locator('.lp-media-showcase video')).toHaveAttribute('poster', '/img/gallery/video-12-wedding-heart-poster.webp');
    await expect(page.locator('img[src*="gallery-11.webp"]').first()).toBeVisible();
  });

  test('wedding portfolio link lands below the fixed header at every layout breakpoint', async ({ page }) => {
    for (const width of [320, 390, 861, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      await page.locator('.wed-collection-note a').click();
      await expect(page).toHaveURL(/#mediaShowcaseTitle$/);
      await page.waitForFunction(() => Math.abs(document.querySelector('#mediaShowcaseTitle').getBoundingClientRect().top - 88) < 2);
      const offset = await page.evaluate(() => ({
        heading: document.querySelector('#mediaShowcaseTitle').getBoundingClientRect().top,
        header: document.querySelector('.lp-header').getBoundingClientRect().bottom,
      }));
      expect(offset.heading).toBeGreaterThanOrEqual(offset.header + 12);
    }
  });

  test('wedding video poster matches the footage in portfolio, gallery and video metadata', async ({ page, request }) => {
    const poster = '/img/gallery/video-12-wedding-heart-poster.webp';
    const description = 'Кондитер оформляет белый торт свежей малиной';
    const videoRequests = [];
    page.on('request', (req) => { if (req.url().includes('/video-12-wedding-heart.webm')) videoRequests.push(req.url()); });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    const reel = schemas.map(JSON.parse).flatMap((schema) => schema['@graph'] || [schema])
      .find((item) => item['@type'] === 'VideoObject' && item.contentUrl?.includes('video-12-wedding-heart.webm'));
    expect(reel.thumbnailUrl).toBe(`https://milovicake.ru${poster}`);
    expect(reel.name).toContain('малиной');
    expect(reel.description).toBe(description);
    await expect(page.locator('.lp-media-showcase video')).toHaveAttribute('preload', 'none');
    const playButton = page.locator('.lp-media-showcase button.lp-media-play');
    await playButton.focus();
    await expect(playButton).toBeFocused();
    expect(videoRequests).toHaveLength(0);
    await page.keyboard.press('Enter');
    await expect.poll(() => videoRequests.length).toBeGreaterThan(0);
    await expect(page.locator('.lp-media-showcase video')).toHaveAttribute('controls', '');
    await expect(page.locator('.lp-media-showcase video')).toBeFocused();
    await expect(playButton).toBeHidden();
    const response = await request.get(poster);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeLessThan(20_000);
    const sitemap = await (await request.get('/sitemap-videos.xml')).text();
    expect(sitemap).toContain(`<video:thumbnail_loc>https://milovicake.ru${poster}</video:thumbnail_loc>`);
    expect(sitemap).toContain(`<video:description>${description}</video:description>`);
    const home = await (await request.get('/')).text();
    expect(home).toContain(`{"v":"/img/gallery/videos/video-12-wedding-heart.webm","p":"${poster}","t":"Торт с малиной"}`);
    await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
    await page.locator('.gx-chip[data-filter="wedding"]').click();
    await expect(page.locator('[data-id="v12"] video')).toHaveAttribute('poster', poster);
    const galleryReel = await page.evaluate(async () => {
      const { GALLERY_ITEMS } = await import('/js/gallery/data.js?v=20261017r01');
      return GALLERY_ITEMS.find((item) => item.id === 'v12');
    });
    expect(galleryReel.desc).toBe(description);
  });

  test('wedding style cards load small images lazily and open a named WhatsApp brief', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const cards = page.locator('.wed-collection-card');
    for (const [index, name] of ['Pure Ivory', 'Botanical Romance', 'Modern Sculptural', 'Golden Atelier'].entries()) {
      const card = cards.nth(index);
      await expect(card.locator('h3')).toContainText(name);
      const image = card.locator('img');
      await expect(image).toHaveAttribute('loading', 'lazy');
      await expect(image).toHaveAttribute('decoding', 'async');
      const candidates = (srcset) => srcset.split(',').map((candidate) => candidate.trim().split(' ')[0]);
      const avif = candidates(await card.locator('source[type="image/avif"]').getAttribute('srcset'));
      const webp = candidates(await image.getAttribute('srcset'));
      expect(avif).toHaveLength(2);
      expect(webp).toHaveLength(2);
      expect(await image.getAttribute('sizes')).toContain('50vw');
      for (const [asset, limit] of [[avif[0], 18_000], [avif[1], 45_000], [webp[0], 22_000], [webp[1], 65_000]]) {
        const response = await request.get(asset);
        expect(response.ok()).toBe(true);
        expect((await response.body()).length).toBeLessThan(limit);
      }
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      await expect.poll(() => image.evaluate((img) => img.currentSrc)).toContain(`wedding-style-${['pure-ivory', 'botanical-romance', 'modern-sculptural', 'golden-atelier'][index]}-sm.avif`);
      const handoff = new URL(await card.locator('a').getAttribute('href'));
      expect(handoff.host).toBe('wa.me');
      expect(handoff.searchParams.get('text')).toContain(name);
    }
  });

  test('wedding detail keeps its image and readable call to action on narrow phones', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    for (const width of [320, 393, 440, 500, 501, 561, 1024]) {
      await page.setViewportSize({ width, height: 860 });
      const layout = await page.locator('.wed-collection-detail').evaluate((section) => {
        const box = (selector) => {
          const { left, right, top, bottom, width } = section.querySelector(selector).getBoundingClientRect();
          return { left, right, top, bottom, width };
        };
        const link = section.querySelector('a');
        return { photo: box('picture'), copy: box('.wed-collection-detail-copy'), title: box('h3'),
          linkFont: parseFloat(getComputedStyle(link).fontSize), linkFits: link.scrollWidth <= link.clientWidth + 1,
          overflow: document.documentElement.scrollWidth - innerWidth };
      });
      expect(layout.overflow).toBeLessThanOrEqual(1);
      expect(layout.linkFits).toBe(true);
      if (width <= 500) {
        expect(layout.photo.bottom).toBeLessThanOrEqual(layout.copy.top + 1);
        expect(layout.title.width).toBeGreaterThan(190);
        expect(layout.linkFont).toBeGreaterThanOrEqual(11);
      } else {
        expect(layout.photo.right).toBeLessThanOrEqual(layout.copy.left + 1);
      }
    }
  });

  test('wedding detail serves the full-width photo sharply on high-density phones', async ({ browser }) => {
    for (const [width, dpr, margin] of [[320, 2, 40], [412, 2.625, 48]]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true,
        storageState: 'tests/analytics-denied.storage-state.json', serviceWorkers: 'block',
      });
      try {
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:4173/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
        const photo = await page.locator('.wed-collection-detail img').evaluate(async (image) => {
          image.loading = 'eager';
          await image.decode();
          return { width: image.getBoundingClientRect().width, loaded: image.naturalWidth > 0,
            url: image.currentSrc };
        });
        expect(photo.width).toBeCloseTo(width - margin, 0);
        expect(photo.loaded).toBe(true);
        expect(photo.url).toContain('/img/wedding-style-pure-ivory.avif');
      } finally {
        await context.close();
      }
    }
  });

  test('wedding header and anchors respect a simulated notched-phone safe area', async ({ page }) => {
    // Chromium's iPhone preset does not expose Safari's nonzero env() insets.
    await page.setViewportSize({ width: 393, height: 659 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await page.locator('.wed-wrap').evaluate((wrap) => {
      wrap.style.setProperty('--wed-safe-top', '59px');
      wrap.style.setProperty('--wed-safe-left', '20px');
      wrap.style.setProperty('--wed-safe-right', '20px');
    });
    await page.waitForFunction(() => Math.round(document.querySelector('.lp-header').getBoundingClientRect().height) === 131);
    const bounds = await page.evaluate(() => {
      const box = (selector) => {
        const { left, right, top, bottom } = document.querySelector(selector).getBoundingClientRect();
        return { left, right, top, bottom };
      };
      return { header: box('.lp-header'), logo: box('.lp-logo'), menu: box('.wed-mobile-menu summary'),
        heading: box('#wedHeroTitle'), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(bounds.logo.top).toBeGreaterThanOrEqual(59);
    expect(bounds.logo.left).toBeGreaterThanOrEqual(20);
    expect(bounds.menu.top).toBeGreaterThanOrEqual(59);
    expect(bounds.menu.right).toBeLessThanOrEqual(393 - 20);
    expect(bounds.heading.top).toBeGreaterThan(bounds.header.bottom);
    expect(bounds.overflow).toBeLessThanOrEqual(1);
    await page.locator('.wed-link').click();
    await page.waitForFunction(() => Math.abs(document.querySelector('#wedCollection').getBoundingClientRect().top - 131) < 2);
    await page.locator('.wed-collection-note a').click();
    await page.waitForFunction(() => Math.abs(document.querySelector('#mediaShowcaseTitle').getBoundingClientRect().top - 147) < 2);
    const gap = await page.evaluate(() => document.querySelector('#mediaShowcaseTitle').getBoundingClientRect().top - document.querySelector('.lp-header').getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(12);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('.wed-wrap').evaluate((wrap) => {
      wrap.style.setProperty('--wed-safe-top', '0px');
      wrap.style.setProperty('--wed-safe-left', '59px');
      wrap.style.setProperty('--wed-safe-right', '59px');
    });
    await page.waitForFunction(() => document.querySelector('.lp-logo').getBoundingClientRect().left >= 59);
    const sides = await page.evaluate(() => ({
      logoLeft: document.querySelector('.lp-logo').getBoundingClientRect().left,
      menuRight: document.querySelector('.wed-mobile-menu summary').getBoundingClientRect().right,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(sides.logoLeft).toBeGreaterThanOrEqual(59);
    expect(sides.menuRight).toBeLessThanOrEqual(844 - 59);
    expect(sides.overflow).toBeLessThanOrEqual(1);
  });

  test('wedding menu stays in the viewport at 320px when web fonts fail', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => { await document.fonts.ready; });
    const bounds = await page.evaluate(() => {
      const rect = (selector) => {
        const { left, right } = document.querySelector(selector).getBoundingClientRect();
        return { left, right };
      };
      return { logo: rect('.lp-logo'), toggle: rect('.lp-theme-toggle'), menu: rect('.wed-mobile-menu summary'),
        rightEdge: innerWidth - parseFloat(getComputedStyle(document.querySelector('.wed-header')).paddingRight) };
    });
    expect(bounds.logo.right).toBeLessThanOrEqual(bounds.toggle.left - 4);
    expect(bounds.toggle.right).toBeLessThanOrEqual(bounds.menu.left - 4);
    expect(bounds.menu.right).toBeLessThanOrEqual(bounds.rightEdge + 1);
    await page.locator('.wed-mobile-menu summary').click();
    await expect(page.locator('.wed-mobile-menu')).toHaveAttribute('open', '');
    await expect(page.locator('.wed-mobile-menu nav a').first()).toBeVisible();
  });

  test('wedding mobile menu exposes navigation and follows the theme', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('mc_theme', 'light'));
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const menu = page.locator('.wed-mobile-menu');
    await expect(menu.locator('summary')).toBeVisible();
    await menu.locator('summary').click();
    await expect(menu).toHaveAttribute('open', '');
    await expect(menu.locator('nav a')).toHaveCount(4);
    await expect(menu.locator('nav a').first()).toBeVisible();
    await page.locator('.lp-theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(menu.locator('nav')).toHaveCSS('background-color', 'rgb(26, 17, 8)');
    await menu.locator('summary').click();
    await expect(menu).not.toHaveAttribute('open', '');
  });

  test('wedding scroll header stays opaque and controls retain touch areas', async ({ page }) => {
    for (const width of [320, 390, 501, 561, 600, 768, 900]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      for (const theme of ['light', 'dark']) {
        const result = await page.evaluate((chosenTheme) => {
          document.documentElement.dataset.theme = chosenTheme;
          const calculator = document.querySelector('.wed-calc');
          scrollTo({ top: calculator.getBoundingClientRect().top + scrollY });
          const header = getComputedStyle(document.querySelector('.wed-header'));
          const height = (selector) => document.querySelector(selector).getBoundingClientRect().height;
          return {
            background: header.backgroundColor, blur: header.backdropFilter,
            slider: height('#wedGuests'), video: height('.lp-media-play'),
            detail: height('.wed-collection-detail a'), faq: height('.lp-faq-item summary'),
            detailFont: parseFloat(getComputedStyle(document.querySelector('.wed-collection-detail a')).fontSize),
            detailKicker: height('.wed-collection-detail .wed-collection-kicker'),
            faqDisplay: getComputedStyle(document.querySelector('.lp-faq-item summary')).display,
            toggle: height('.lp-theme-toggle'), menu: height('.wed-mobile-menu summary'),
          };
        }, theme);
        expect(result.background).toBe(theme === 'dark' ? 'rgb(26, 17, 8)' : 'rgb(245, 240, 232)');
        expect(result.blur).toBe('none');
        expect(result.faqDisplay).toBe('list-item');
        for (const target of ['slider', 'video', 'detail', 'faq']) expect(result[target]).toBeGreaterThanOrEqual(44);
        if (width > 500 && width <= 860) {
          expect(result.detailFont).toBeGreaterThanOrEqual(11);
          expect(result.detailKicker).toBeLessThanOrEqual(20);
        }
        if (width <= 860) {
          expect(result.toggle).toBeGreaterThanOrEqual(44);
          expect(result.menu).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  test('wedding date form still opens a prefilled WhatsApp brief after the mobile layout change', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.open = (url) => { window.weddingHandoff = url; return null; };
    });
    const chosen = await page.locator('#wedDate').evaluate((input) => {
      const date = new Date(`${input.min}T12:00:00`);
      date.setDate(date.getDate() + 45);
      const iso = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      return { iso, label: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) };
    });
    await page.locator('#wedDate').fill(chosen.iso);
    await page.locator('.wed-date-form .wed-btn').click();
    const handoff = await page.evaluate(() => window.weddingHandoff);
    expect(handoff).toMatch(/^https:\/\/wa\.me\/79119038886\?text=/);
    expect(decodeURIComponent(handoff)).toContain(chosen.label);
  });

  test('wedding date rejects past dates but keeps an undated enquiry possible', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const input = page.locator('#wedDate');
    const dates = await input.evaluate(() => {
      const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', numberingSystem: 'latn',
        year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
      const today = `${date.year}-${date.month}-${date.day}`;
      const yesterday = new Date(`${today}T12:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      return { today, past: [yesterday.getFullYear(), String(yesterday.getMonth() + 1).padStart(2, '0'), String(yesterday.getDate()).padStart(2, '0')].join('-') };
    });
    await expect(input).toHaveAttribute('min', dates.today);
    await page.evaluate(() => { window.open = (url) => { window.weddingHandoff = url; return null; }; });
    await input.fill(dates.past);
    await page.locator('.wed-date-form .wed-btn').click();
    expect(await input.evaluate((field) => field.validity.rangeUnderflow)).toBe(true);
    expect(await page.evaluate(() => window.weddingHandoff)).toBeUndefined();
    await input.fill('');
    await page.locator('.wed-date-form .wed-btn').click();
    expect(decodeURIComponent(await page.evaluate(() => window.weddingHandoff))).toContain('дата пока не выбрана');
  });

  test('wedding date follows Saint Petersburg time for visitors abroad', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', timezoneId: 'Pacific/Honolulu',
      storageState: 'tests/analytics-denied.storage-state.json', serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-10-17T22:30:00.000Z') });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      expect(await page.evaluate(() => new Date().toLocaleDateString('sv-SE'))).toBe('2026-10-17');
      await expect(page.locator('#wedDate')).toHaveAttribute('min', '2026-10-18');
    } finally {
      await context.close();
    }
  });

  test('wedding guest calculator updates weight, tiers and budget on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const guests = page.locator('#wedGuests');
    await guests.scrollIntoViewIfNeeded();
    await guests.focus();
    const valueStyle = await page.locator('#wedGuestsOut').evaluate((number) => {
      const value = getComputedStyle(number);
      const heading = getComputedStyle(number.parentElement);
      return { valueSize: parseFloat(value.fontSize), headingSize: parseFloat(heading.fontSize),
        valueColor: value.color, headingColor: heading.color, display: value.display };
    });
    expect(valueStyle.valueSize).toBeGreaterThanOrEqual(26);
    expect(valueStyle.valueSize).toBe(valueStyle.headingSize);
    expect(valueStyle.valueColor).toBe(valueStyle.headingColor);
    expect(valueStyle.display).toBe('inline');
    await expect(page.locator('#wedCalcPrice')).toContainText('23 800 ₽');
    await guests.press('Home');
    await expect(page.locator('#wedGuestsOut')).toHaveText('15');
    await expect(page.locator('#wedCalcOut')).toHaveText('≈ 2,6 кг · 1–2 яруса');
    await expect(page.locator('#wedCalcPrice')).toContainText('7 100 ₽');
    await guests.press('End');
    await expect(page.locator('#wedGuestsOut')).toHaveText('150');
    await expect(page.locator('#wedCalcOut')).toHaveText('≈ 25,5 кг · 3–4 яруса');
    await expect(page.locator('#wedCalcPrice')).toContainText('71 400 ₽');
  });

  test('commercial pages include portfolio images or videos', async ({ page }) => {
    for (const pageInfo of pages.filter((p) => !['/o-konditere/', '/dostavka-i-oplata/', '/otzyvy/'].includes(p.path))) {
      await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.lp-media-showcase')).toBeVisible();
      const mediaCount = await page.locator('.lp-media-showcase img, .lp-media-showcase video').count();
      expect(mediaCount).toBeGreaterThanOrEqual(4);

      const images = page.locator('.lp-media-showcase img, .lp-card img');
      const imageCount = await images.count();
      for (let i = 0; i < imageCount; i += 1) {
        const image = images.nth(i);
        const src = await image.getAttribute('src');
        await image.scrollIntoViewIfNeeded();
        await expect.poll(
          () => image.evaluate((img) => (img.complete ? img.naturalWidth : 0)),
          { message: `Image ${src} should load after entering the viewport`, timeout: 10000 }
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

test.describe('homepage structured data and links', () => {
  test('homepage has one consolidated JSON-LD graph and links to landing cluster', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const jsonLd = page.locator('head script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(1);
    const graphTypes = await jsonLd.evaluate((node) => JSON.parse(node.textContent)['@graph'].map((item) => item['@type']));
    expect(graphTypes.flat()).toContain('LocalBusiness');
    expect(graphTypes.flat()).toContain('Bakery');
    expect(graphTypes).toContain('FAQPage');
    expect(graphTypes).toContain('HowTo');

    for (const href of ['/zakazat-tort-spb/', '/tort-s-dostavkoy/', '/bento-torty/', '/detskie-torty/', '/svadebnye-torty/', '/o-konditere/', '/dostavka-i-oplata/', '/otzyvy/']) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });
});

test.describe('SEO infrastructure', () => {
  test('sitemap contains public landing pages and excludes /call/', async ({ page, request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBeTruthy();
    const xml = await response.text();
    for (const href of [
      '/zakazat-tort-spb/',
      '/tort-s-dostavkoy/',
      '/tort-na-den-rozhdeniya/',
      '/bento-torty/',
      '/detskie-torty/',
      '/svadebnye-torty/',
      '/o-konditere/',
      '/dostavka-i-oplata/',
      '/otzyvy/',
    ]) {
      expect(xml).toContain(`https://milovicake.ru${href}`);
    }
    expect(xml).not.toContain('https://milovicake.ru/call/');
    expect(xml).toContain('<lastmod>2026-06-05</lastmod>');
  });

  test('homepage business hours are Monday-Saturday in visible text and schema', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText('Пн–Сб, 10:00–20:00');
    await expect(page.locator('body')).not.toContainText('Пн–Вс');
    const graph = await page.locator('head script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent)['@graph']);
    const business = graph.find((item) => Array.isArray(item['@type']) && item['@type'].includes('LocalBusiness'));
    expect(JSON.stringify(business)).toContain('Saturday');
    expect(JSON.stringify(business)).not.toContain('Sunday');
  });
});

function contrastRatio(foreground, background) {
  const linearize = (value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]) => (0.2126 * linearize(r)) + (0.7152 * linearize(g)) + (0.0722 * linearize(b));
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

async function assertContrast(page, selector, minimum = 4.5) {
  const samples = await page.locator(selector).evaluateAll((nodes) => {
    const parse = (value) => {
      const match = String(value).match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
      if (!match) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
    };
    const composite = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [
        (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
        (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
        (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
        alpha,
      ];
    };
    const backgroundFor = (node) => {
      let current = node;
      let background = [255, 255, 255, 1];
      const layers = [];
      while (current) {
        const color = parse(getComputedStyle(current).backgroundColor);
        if (color && color[3] > 0) layers.push(color);
        current = current.parentElement;
      }
      for (let i = layers.length - 1; i >= 0; i -= 1) background = composite(layers[i], background);
      return background;
    };
    return nodes
      .filter((node) => {
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((node) => ({
        text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
        color: parse(getComputedStyle(node).color),
        background: backgroundFor(node),
        opacity: Number(getComputedStyle(node).opacity || '1'),
      }));
  });

  expect(samples.length, `${selector} should resolve to at least one visible node`).toBeGreaterThan(0);
  for (const sample of samples) {
    expect(sample.color, `${selector} should expose an RGB text color`).not.toBeNull();
    expect(sample.opacity, `${selector} should not lower text opacity (${sample.text})`).toBe(1);
    const ratio = contrastRatio(sample.color, sample.background);
    expect(ratio, `${selector} contrast ${ratio.toFixed(2)}:1 for “${sample.text}”`).toBeGreaterThanOrEqual(minimum);
  }
}

async function useLightTheme(page) {
  await page.addInitScript(() => localStorage.setItem('mc_theme', 'light'));
}

test.describe('production-measured contrast regressions', () => {
  test('homepage measured text pairs remain WCAG AA', async ({ page }) => {
    await useLightTheme(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const selector of [
      '.hero .btn-primary.btn-primary--hero',
      '.about-compact-block p',
      '.vstrip-label span',
      '.calc-opt.selected .opt-label',
      '#calcWeightVal',
      '#fillDescText',
      '.geo-section > .container > p',
      '.cb-section-label span',
      '.cb-ftab:not(.cb-on)',
      '.cb-fl-name',
      '.cb-gluten-badge',
      '.cb-occ-name',
      '.site-footer .footer-col--brand p',
      '.site-footer .footer-col h4',
      '.site-footer .footer-address',
      '#fillSheetSelect',
    ]) {
      await assertContrast(page, selector);
    }
  });

  test('About-page primary CTA remains WCAG AA', async ({ page }) => {
    await useLightTheme(page);
    await page.goto('/o-konditere/', { waitUntil: 'domcontentloaded' });
    await assertContrast(page, '.info-btn-primary');
  });

  test('Gatchina measured contrast pairs remain WCAG AA', async ({ page }) => {
    await useLightTheme(page);
    await page.goto('/prigorody/gatchina/', { waitUntil: 'domcontentloaded' });
    await assertContrast(page, '.hero .btn-primary.btn-primary--hero');
    await assertContrast(page, '.prigorody-page .calc-options:not(#calcDecor) .calc-opt.selected .opt-label');
  });
});
