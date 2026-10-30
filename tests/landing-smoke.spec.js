const { test, expect } = require('@playwright/test');

async function contrastOnBackground(locator, backgroundSelector, overlaySelector = null) {
  return locator.evaluate((element, selectors) => {
    const channels = (color) => {
      const values = color.match(/[\d.]+/g).map(Number);
      return [values[0], values[1], values[2], values.length > 3 ? values[3] : 1];
    };
    const blend = (front, back, opacity = 1) => {
      const alpha = front[3] * opacity;
      return front.slice(0, 3).map((value, index) => value * alpha + back[index] * (1 - alpha)).concat(1);
    };
    const luminance = (color) => color.slice(0, 3).map((value) => {
      value /= 255;
      return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const background = element.closest(selectors.background);
    if (!background) throw new Error(`Missing background ancestor ${selectors.background}`);
    let back = channels(getComputedStyle(background).backgroundColor);
    if (selectors.overlay) back = blend(channels(getComputedStyle(element.closest(selectors.overlay)).backgroundColor), back);
    const style = getComputedStyle(element);
    const foreground = blend(channels(style.color), back, Number(style.opacity));
    const a = luminance(foreground);
    const b = luminance(back);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, { background: backgroundSelector, overlay: overlaySelector });
}

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

test.describe('commercial landing videos', () => {
  const landings = [
    { path: '/zakazat-tort-spb/', videos: 1 },
    { path: '/tort-s-dostavkoy/', videos: 1 },
    { path: '/tort-na-den-rozhdeniya/', videos: 2 },
    { path: '/bento-torty/', videos: 2 },
    { path: '/detskie-torty/', videos: 2 },
  ];

  for (const landing of landings) {
    test(`${landing.path} defers video until an accessible play action`, async ({ page }) => {
      const requests = [];
      page.on('request', (req) => {
        if (req.url().includes('/img/gallery/videos/')) requests.push(new URL(req.url()).pathname);
      });
      await page.goto(landing.path, { waitUntil: 'domcontentloaded' });
      const videos = page.locator('.lp-media-showcase video');
      const buttons = page.locator('.lp-media-showcase button.lp-media-play');
      await expect(videos).toHaveCount(landing.videos);
      await expect(buttons).toHaveCount(landing.videos);
      await videos.last().scrollIntoViewIfNeeded();
      await expect(buttons.first()).toBeVisible();
      await page.waitForTimeout(350);
      expect(requests).toEqual([]);
      for (let i = 0; i < landing.videos; i += 1) {
        await expect(videos.nth(i)).toHaveAttribute('preload', 'none');
        await expect(videos.nth(i)).toHaveAttribute('loading', 'lazy');
        await expect(buttons.nth(i)).toHaveAttribute('aria-label', /^Смотреть видео: /);
      }
      const button = buttons.first();
      await button.focus();
      await expect(button).toBeFocused();
      expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      await page.keyboard.press('Enter');
      await expect.poll(() => requests.length).toBeGreaterThan(0);
      const firstVideo = videos.first();
      const source = await firstVideo.locator('source').getAttribute('src');
      expect(requests.every((path) => path === source)).toBe(true);
      await expect(firstVideo).toHaveAttribute('controls', '');
      await expect(firstVideo).toBeFocused();
      await expect(button).toBeHidden();
      if (landing.videos > 1) await expect(videos.nth(1)).not.toHaveAttribute('controls', '');
    });
  }

  test('clicking the video poster still starts playback', async ({ page }) => {
    await page.goto('/zakazat-tort-spb/', { waitUntil: 'domcontentloaded' });
    const video = page.locator('.lp-media-showcase video');
    await video.click({ position: { x: 25, y: 25 } });
    await expect(video).toHaveAttribute('controls', '');
    await expect(video).toBeFocused();
    await expect(page.locator('.lp-media-showcase button.lp-media-play')).toBeHidden();
  });

  test('without JavaScript the poster retains native media controls', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      for (const landing of landings) {
        await page.goto(landing.path, { waitUntil: 'domcontentloaded' });
        const videos = page.locator('.lp-media-showcase video');
        const buttons = page.locator('.lp-media-showcase button.lp-media-play');
        await expect(videos).toHaveCount(landing.videos);
        for (let i = 0; i < landing.videos; i += 1) {
          await expect(videos.nth(i)).toHaveAttribute('controls', '');
          await expect(buttons.nth(i)).toBeHidden();
        }
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('premium media blocks', () => {
  test('gallery labels and image sitemap describe the photographed work', async ({ page, request }) => {
    await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
    await page.locator('.gx-chip[data-filter="bento"]').click();
    const portrait = page.locator('[data-id="p08"]');
    await expect(portrait).toContainText('Торт с портретом и надписью');
    if (await page.evaluate(() => matchMedia('(hover: none)').matches)) {
      // A tap can leave :hover stuck on the card under the filter; peers must remain sharp.
      await expect.poll(() => portrait.evaluate(card => getComputedStyle(card).filter)).not.toContain('blur(');
      await expect.poll(() => page.locator('[data-id="p12"]').evaluate(card => getComputedStyle(card).filter)).not.toContain('blur(');
    }
    // Desktop hover retains its original rule; the source contract checks its
    // fine-pointer media gate without racing the filter's smooth scrolling.
    await page.locator('.gx-chip[data-filter="meringue"]').click();
    await expect(page.locator('[data-id="p17"]')).toContainText('Срез меренгового рулета');
    await page.locator('.gx-chip[data-filter="pavlova"]').click();
    await expect(page.locator('[data-id="p17"]')).toHaveCount(0);

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<image:title>Светлый свадебный торт</image:title>');
    expect(sitemap).toContain('<image:title>Золотой торт с фактурным декором</image:title>');
    expect(sitemap).not.toContain('Свадебный торт с живыми цветами, СПб');
  });

  test('wedding page has the concept collection and real portfolio media', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.wed-collection')).toBeVisible();
    await expect(page.locator('.wed-collection-card')).toHaveCount(4);
    await expect(page.locator('.wed-collection-note')).toContainText('не фотографии выполненных заказов');
    await expect(page.locator('.bridal-route')).toBeVisible();
    await expect(page.locator('.bridal-callout')).toBeVisible();
    const realMedia = page.locator('.lp-media-showcase');
    await expect(realMedia).toBeVisible();
    await expect(realMedia.locator('img, video')).toHaveCount(2);
    await expect(realMedia).toContainText('разные торты');
    await expect(realMedia.locator('img[src*="wedding-blush"], img[src*="wedding-table"]')).toHaveCount(0);
    const gallery = await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)
      ['@graph'].find((item) => item['@type'] === 'ImageGallery'));
    expect(gallery.image.map((item) => new URL(item.contentUrl).pathname)).toEqual(['/img/gallery/gallery-11.webp']);
    await expect(page.locator('.wed-hero + .wed-proof')).toHaveCount(1);
    await expect(page.locator('video source[src*="video-12-wedding-heart.webm"]')).toHaveCount(1);
    await expect(realMedia.locator('source[type="video/mp4"]')).toHaveAttribute('src', '/img/gallery/videos/video-12-wedding-heart.mp4');
    await expect(realMedia.locator('video')).toHaveAttribute('poster', '/img/gallery/video-12-wedding-heart-poster.webp');
    await expect(page.locator('img[src*="gallery-11.webp"]').first()).toBeVisible();
  });

  test('real wedding photo uses a compact mobile source and the process clip stays portrait', async ({ page }) => {
    for (const width of [320, 390, 412]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      const photo = page.locator('.wed-proof-cake-visual img');
      await photo.scrollIntoViewIfNeeded();
      await expect.poll(() => photo.evaluate((img) => img.currentSrc)).toContain('/img/gallery/gallery-11-mobile.avif');
      const layout = await page.evaluate(() => {
        const video = document.querySelector('.wed-proof-video-frame video');
        const rect = video.getBoundingClientRect();
        return { ratio: rect.height / rect.width, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      expect(layout.ratio).toBeGreaterThan(1.7);
      expect(layout.overflow).toBeLessThanOrEqual(1);
    }
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
    // Chromium may negotiate either real source; the lazy-load contract applies to both.
    page.on('request', (req) => {
      if (/\/video-12-wedding-heart\.(webm|mp4)(?:\?|$)/.test(req.url())) videoRequests.push(req.url());
    });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    const reel = schemas.map(JSON.parse).flatMap((schema) => schema['@graph'] || [schema])
      .find((item) => item['@type'] === 'VideoObject' && item.contentUrl?.includes('video-12-wedding-heart.webm'));
    expect(reel.thumbnailUrl).toBe(`https://milovicake.ru${poster}`);
    expect(reel.name).toContain('малиной');
    expect(reel.description).toBe(description);
    await expect(page.locator('.lp-media-showcase video')).toHaveAttribute('preload', 'none');
    await expect(page.locator('.lp-media-showcase video')).toHaveAttribute('loading', 'lazy');
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
    expect((await response.body()).length).toBeLessThan(22_000);
    const frame = await page.evaluate((src) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
      image.onerror = reject;
      image.src = src;
    }), poster);
    expect(frame).toEqual([720, 1282]);
    const videoFit = await page.locator('.wed-proof-video-frame video').evaluate((el) => getComputedStyle(el).objectFit);
    expect(videoFit).toBe('contain');
    const sitemap = await (await request.get('/sitemap-videos.xml')).text();
    expect(sitemap).toContain(`<video:thumbnail_loc>https://milovicake.ru${poster}</video:thumbnail_loc>`);
    expect(sitemap).toContain(`<video:description>${description}</video:description>`);
    const home = await (await request.get('/')).text();
    expect(home).toContain(`{"v":"/img/gallery/videos/video-12-wedding-heart.webm","p":"${poster}","t":"Торт с малиной"}`);
    await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
    await page.locator('.gx-chip[data-filter="wedding"]').click();
    await expect(page.locator('[data-id="v12"] video')).toHaveAttribute('poster', poster);
    const galleryReel = await page.evaluate(async () => {
      const { GALLERY_ITEMS } = await import('/js/gallery/data.js?v=20261026r01');
      return GALLERY_ITEMS.find((item) => item.id === 'v12');
    });
    expect(galleryReel.desc).toBe(description);
  });

  test('wedding music caption loads without requesting the video', async ({ page }) => {
    const videoRequests = [];
    page.on('request', (request) => {
      if (/video-12-wedding-heart\.(webm|mp4)(\?|$)/.test(request.url())) videoRequests.push(request.url());
    });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const video = page.locator('.wed-proof-video-frame video');
    await expect(video.locator('track[kind="captions"][srclang="ru"]'))
      .toHaveAttribute('src', '/svadebnye-torty/video-12-wedding-heart.ru.vtt');
    await video.evaluate((element) => { element.textTracks[0].mode = 'hidden'; });
    await expect.poll(() => video.evaluate((element) => element.textTracks[0].cues?.length ?? 0)).toBe(1);
    const cue = await video.evaluate((element) => {
      const { startTime, endTime, text } = element.textTracks[0].cues[0];
      return { startTime, endTime, text };
    });
    expect(cue).toEqual({ startTime: 0, endTime: 10.01, text: '[Звучит музыка]' });
    expect(videoRequests).toEqual([]);
  });

  test.describe('wedding video format fallback', () => {
    test.use({ serviceWorkers: 'block' });

    test('plays MP4 after WebM fails or is skipped, and fetches neither before the click', async ({ page }) => {
      const requests = [];
      await page.route('**/video-12-wedding-heart.webm', (route) => route.abort('failed'));
      page.on('request', (request) => {
        if (/video-12-wedding-heart\.(webm|mp4)$/.test(request.url())) requests.push(new URL(request.url()).pathname);
      });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      const button = page.locator('.wed-proof-video-play');
      await button.scrollIntoViewIfNeeded();
      expect(requests).toEqual([]);
      await button.click();
      const video = page.locator('.wed-proof-video-frame video');
      await expect.poll(() => video.evaluate((el) =>
        el.currentSrc.endsWith('.mp4') && el.readyState >= 2 && el.currentTime > 0.2 && !el.paused
      ), { timeout: 15_000 }).toBe(true);
      // Some Chromium runners skip unsupported WebM without fetching it. If
      // fetched, the route aborts it; in either case real MP4 must play.
      expect(requests).toContain('/img/gallery/videos/video-12-wedding-heart.mp4');
      await expect(video).toHaveAttribute('controls', '');
    });
  });

  test.describe('wedding video without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('keeps native controls and hides the script-only play button', async ({ page }) => {
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      const video = page.locator('.wed-proof-video-frame video');
      await video.scrollIntoViewIfNeeded();
      await expect(video).toBeVisible();
      await expect(video).toHaveAttribute('controls', '');
      await expect(page.locator('.wed-proof-video-play')).toBeHidden();
      await expect(video.locator('source[type="video/mp4"]'))
        .toHaveAttribute('src', '/img/gallery/videos/video-12-wedding-heart.mp4');
    });
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

  test('wedding formats credit the real work and frame the multi-tier concept', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const cards = page.locator('#wedStyles .lp-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.locator('.wed-collection-kicker')).toHaveText([
      'Реальная работа', 'Визуализация стиля', 'Визуализация стиля',
    ]);
    await expect(cards.nth(1).locator('source[type="image/avif"]'))
      .toHaveAttribute('srcset', '/img/wedding-style-golden-atelier.avif');
    await expect(cards.nth(1).locator('img')).toHaveAttribute('loading', 'lazy');
    await cards.nth(1).locator('img').scrollIntoViewIfNeeded();
    await expect.poll(() => cards.nth(1).locator('img').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    const portrait = await cards.nth(1).locator('img').evaluate((img) => img.naturalHeight > img.naturalWidth);
    expect(portrait).toBe(true);
    for (const width of [320, 390, 561, 768, 900, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await page.evaluate(() => ({
        photos: [...document.querySelectorAll('#wedStyles .lp-card img')]
          .map((img) => img.getBoundingClientRect().height),
        labelSize: parseFloat(getComputedStyle(document.querySelector('.wed-collection-index')).fontSize),
        columns: getComputedStyle(document.querySelector('.wed-collection-grid')).gridTemplateColumns.split(' ').length,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      expect(layout.photos.every((height) => height <= 480 && Math.abs(height - layout.photos[0]) < 1)).toBe(true);
      expect(layout.labelSize).toBeGreaterThanOrEqual(10);
      expect(layout.columns).toBe(width <= 860 ? 2 : 4);
      expect(layout.overflow).toBeLessThanOrEqual(1);
    }
    await cards.nth(1).hover();
    await expect(cards.nth(1)).toHaveCSS('transform', 'none');
  });

  test('wedding format schema uses the shown imagery and does not invent a custom price', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const formats = await page.evaluate(() => {
      const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
      const list = schema['@graph'].find((item) => item['@type'] === 'ItemList');
      return list.itemListElement.map(({ item }, index) => {
        const card = document.querySelectorAll('#wedStyles .lp-card')[index];
        return {
          product: item,
          image: new URL(card.querySelector('img').getAttribute('src'), 'https://milovicake.ru').href,
          credit: card.querySelector('.wed-collection-kicker').textContent.trim(),
          label: card.querySelector('strong').textContent.trim(),
        };
      });
    });
    expect(formats).toHaveLength(3);
    for (const { product, image, credit, label } of formats) {
      expect(product.image).toBe(image);
      if (credit === 'Визуализация стиля') expect(product.description).toContain('Визуализация стиля');
      // These are starting rates or require a minimum quantity, not the total
      // purchase price of a single fixed offer.
      expect(product.offers).toBeUndefined();
    }
    expect(formats[0].label).toBe('от\u00a03\u00a0000\u00a0₽/кг'); // Keep the price together with real web fonts.
    expect(formats[0].product.description).toContain('от 3 000 ₽/кг');
    expect(formats[2].label).toBe('от 350 ₽/шт.');
    expect(formats[2].product.description).toContain('минимальный заказ — 2 пирожных или 6 капкейков');
    await expect(page.locator('#wedStyles .lp-card').nth(2)).toContainText('Минимальный заказ — 2 пирожных или 6 капкейков');
    await expect(page.locator('.wed-meta')).toContainText('От 3 000 ₽/кг');
    await expect(page.locator('.bridal-panel .lp-section-head')).toContainText('от 3 000 ₽/кг');
    for (const selector of ['.wed-meta', '.bridal-panel .lp-section-head p']) {
      expect(await page.locator(selector).textContent()).toContain('3\u00a0000\u00a0₽/кг');
    }
  });

  test('wedding FAQ markup matches every visible answer', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const questions = await page.evaluate(() => {
      const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
      const faq = schema['@graph'].find((item) => item['@type'] === 'FAQPage');
      return {
        structured: faq.mainEntity.map((item) => [item.name, item.acceptedAnswer.text]),
        visible: [...document.querySelectorAll('.lp-faq-item')]
          .map((item) => [item.querySelector('summary').textContent.trim(), item.querySelector('p').textContent.trim()]),
      };
    });
    expect(questions.visible).toHaveLength(6);
    expect(questions.visible).toEqual(questions.structured);
    expect(questions.visible.some(([question]) => /дегустационный сет/i.test(question))).toBe(true);
    const last = page.locator('.lp-faq-item').last();
    await last.locator('summary').click();
    await expect(last).toHaveAttribute('open', '');
    await expect(last.locator('p')).toBeVisible();
    await page.keyboard.press('Tab');
    await last.locator('summary').focus();
    await expect(last.locator('summary')).toHaveCSS('outline-width', '2px');
    await page.locator('#wedGuests').focus();
    await expect(page.locator('#wedGuests')).toHaveCSS('outline-width', '2px');
  });

  test('wedding tasting request states individual terms and hands off to WhatsApp', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const section = page.locator('#wedTasting');
    const link = section.getByRole('link', { name: /обсудить дегустацию/i });
    await expect(section).toContainText(/по запросу/i);
    await expect(section).toContainText('стоимость, сроки и возможность изготовления');
    for (const theme of ['light', 'dark']) {
      await page.locator('html').evaluate((root, value) => root.setAttribute('data-theme', value), theme);
      for (const width of [320, 360, 390, 414, 561, 600, 768, 900, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(await link.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
    }
    await page.route('https://wa.me/**', (route) => route.abort());
    const request = page.waitForRequest((req) => req.url().startsWith('https://wa.me/79119038886?'));
    await link.click();
    const handoff = new URL((await request).url());
    expect(handoff.searchParams.get('text')).toContain('дегустационный сет начинок');
    expect(handoff.searchParams.get('text')).toContain('свадебного торта');
  });

  test('wedding final invitation keeps the brief on this journey', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.lp-final h2')).toContainText('свадебный торт');
    await expect(page.locator('.lp-final p')).toContainText('площадке');
    const brief = await page.locator('.bridal-callout a').getAttribute('href');
    const message = new URL(brief).searchParams.get('text');
    for (const prompt of ['Дата свадьбы:', 'Площадка:', 'Гостей:', 'Палитра:', 'Референсы:']) {
      expect(message).toContain(prompt);
    }
    const final = page.locator('.lp-final .lp-btn-primary');
    await expect(final).toHaveAttribute('href', brief);
    await expect(final).toContainText('Отправить бриф');
    for (const width of [320, 390, 561, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const geometry = await final.evaluate((button) => {
        const { left, right, height } = button.getBoundingClientRect();
        return { left, right, height, overflow: button.scrollWidth - button.clientWidth,
          pageOverflow: document.documentElement.scrollWidth - innerWidth };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.height).toBeGreaterThanOrEqual(44);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
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
    // Шрифты самохостинговые с 2026-10-30: отказ эмулируется блокировкой
    // собственных файлов, иначе тест «без веб-шрифтов» проверял бы ничего.
    await page.route('**/fonts/*.woff2', (route) => route.abort());
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

  test('wedding date opens a private WhatsApp tab even when the date is undecided', async ({ page }) => {
    await page.context().route('https://wa.me/**', (route) => route.fulfill({
      status: 200, contentType: 'text/html', body: '<!doctype html><title>WhatsApp handoff intercepted</title>',
    }));
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#wedDate')).toHaveAttribute('aria-describedby', 'wedDateHint');
    await expect(page.locator('#wedDateHint')).toContainText('если выберете');
    const popupPromise = page.context().waitForEvent('page');
    await page.locator('.wed-date-form .wed-btn').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    const handoff = new URL(popup.url());
    expect(handoff.origin).toBe('https://wa.me');
    expect(handoff.pathname).toBe('/79119038886');
    expect(handoff.searchParams.get('text')).toContain('дата пока не выбрана');
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    await popup.close();
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

  test('wedding date cannot be sent as yesterday after Saint Petersburg midnight', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', timezoneId: 'Pacific/Honolulu',
      storageState: 'tests/analytics-denied.storage-state.json', serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-10-17T20:59:59.000Z') });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      const date = page.locator('#wedDate');
      await expect(date).toHaveAttribute('min', '2026-10-17');
      await date.fill('2026-10-17');
      await page.evaluate(() => { window.open = (url) => { window.weddingHandoff = url; return null; }; });
      await page.clock.fastForward(2000);
      expect(await page.evaluate(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })))
        .toBe('2026-10-18');
      await page.locator('.wed-date-form .wed-btn').click();
      await expect(date).toHaveAttribute('min', '2026-10-18');
      expect(await date.evaluate((field) => field.validity.rangeUnderflow)).toBe(true);
      expect(await page.evaluate(() => window.weddingHandoff)).toBeUndefined();
      await date.fill('');
      await page.locator('.wed-date-form .wed-btn').click();
      expect(decodeURIComponent(await page.evaluate(() => window.weddingHandoff))).toContain('дата пока не выбрана');
    } finally {
      await context.close();
    }
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
    await expect(page.locator('#wedCalcPrice')).toHaveAttribute('role', 'status');
    await expect(page.locator('#wedCalcPrice')).toContainText('25 500 ₽');
    expect(await page.locator('#wedCalcPrice').textContent()).toContain('25\u00a0500\u00a0₽');
    await guests.press('Home');
    await expect(page.locator('#wedGuestsOut')).toHaveText('15');
    await expect(page.locator('#wedCalcOut')).toHaveText('≈ 2,6 кг · 1–2 яруса');
    await expect(page.locator('#wedCalcPrice')).toContainText('7 800 ₽'); // 2,6 кг × 3 000 ₽, not 2,55 кг × 3 000 ₽.
    await guests.press('ArrowRight');
    await expect(page.locator('#wedCalcOut')).toHaveText('≈ 3,4 кг · 1–2 яруса');
    await expect(page.locator('#wedCalcPrice')).toContainText('10 200 ₽');
    await guests.press('ArrowRight');
    await expect(page.locator('#wedCalcOut')).toHaveText('≈ 4,3 кг · 1–2 яруса');
    await expect(page.locator('#wedCalcPrice')).toContainText('12 900 ₽');
    await guests.press('End');
    await expect(page.locator('#wedGuestsOut')).toHaveText('150');
    await expect(page.locator('#wedCalcOut')).toHaveText('≈ 25,5 кг · 3–4 яруса');
    await expect(page.locator('#wedCalcPrice')).toContainText('76 500 ₽');
  });

  test('commercial pages include portfolio images or videos', async ({ page }) => {
    for (const pageInfo of pages.filter((p) => !['/o-konditere/', '/dostavka-i-oplata/', '/otzyvy/'].includes(p.path))) {
      await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.lp-media-showcase')).toBeVisible();
      const mediaCount = await page.locator('.lp-media-showcase img, .lp-media-showcase video').count();
      if (pageInfo.path === '/svadebnye-torty/') {
        expect(mediaCount).toBe(2); // One real cake and one separate process clip; concepts live below.
      } else {
        expect(mediaCount).toBeGreaterThanOrEqual(4);
      }

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
    // The homepage has no visible step-by-step block or breadcrumb trail.
    expect(graphTypes).not.toContain('HowTo');
    expect(graphTypes).not.toContain('BreadcrumbList');

    for (const href of ['/zakazat-tort-spb/', '/tort-s-dostavkoy/', '/bento-torty/', '/detskie-torty/', '/svadebnye-torty/', '/o-konditere/', '/dostavka-i-oplata/', '/otzyvy/']) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });
});

test.describe('revised navigation and credentials', () => {
  test('meringue storage terms remain readable and match the FAQ schema', async ({ page }) => {
    await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loader')).toBeHidden();
    const storage = page.locator('.ingredient').filter({ has: page.locator('.ingredient-name', { hasText: 'Хранение' }) });
    await expect(storage).toHaveCount(1);
    const description = storage.locator('.ingredient-desc');
    await expect(description).toHaveText('48 ч · +2…+6 °C');
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await storage.scrollIntoViewIfNeeded();
        await expect(description).toBeVisible();
        await expect.poll(() => storage.evaluate((row) => Number(getComputedStyle(row.closest('.reveal')).opacity))).toBeGreaterThan(0.99);
        const bounds = await storage.evaluate((row) => {
          const title = row.querySelector('.ingredient-name').getBoundingClientRect();
          const detail = row.querySelector('.ingredient-desc');
          const rect = detail.getBoundingClientRect();
          return { titleRight: title.right, left: rect.left, right: rect.right,
            clientWidth: detail.clientWidth, scrollWidth: detail.scrollWidth };
        });
        expect(bounds.left, `${theme} ${width}px storage text starts outside viewport`).toBeGreaterThanOrEqual(0);
        expect(bounds.right, `${theme} ${width}px storage text ends outside viewport`).toBeLessThanOrEqual(width);
        expect(bounds.titleRight, `${theme} ${width}px storage label overlaps value`).toBeLessThanOrEqual(bounds.left + 1);
        expect(bounds.scrollWidth, `${theme} ${width}px storage text is clipped`).toBeLessThanOrEqual(bounds.clientWidth + 1);
        expect(await contrastOnBackground(storage.locator('.ingredient-name'), '.split-text'), `${theme} storage label contrast`).toBeGreaterThanOrEqual(4.5);
        expect(await contrastOnBackground(description, '.split-text'), `${theme} storage value contrast`).toBeGreaterThanOrEqual(4.5);
      }
    }
    const faq = page.locator('details.mr-faq-item').filter({ hasText: 'Сколько хранится меренговый рулет?' });
    await faq.locator('summary').click();
    const answer = 'Храните рулет в холодильнике при температуре +2…+6 °C не более 48 часов с момента изготовления.';
    await expect(faq.locator('p')).toHaveText(answer);
    const schemaAnswer = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
      scripts.map((script) => JSON.parse(script.textContent)).find((schema) => schema['@type'] === 'FAQPage')
        .mainEntity.find((item) => item.name === 'Сколько хранится меренговый рулет?').acceptedAnswer.text);
    expect(schemaAnswer).toBe(answer);
  });

  test('all meringue FAQ answers open completely and have readable contrast', async ({ page }) => {
    await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loader')).toBeHidden();
    const items = page.locator('details.mr-faq-item');
    await expect(items).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) {
      const item = items.nth(index);
      const summary = item.locator('summary');
      const wrapper = item.locator('.mr-faq-answer');
      const answer = wrapper.locator('p');
      await summary.click();
      await expect(item).toHaveAttribute('open', '');
      await expect(wrapper).toHaveCSS('opacity', '1');
      await expect(answer).toBeVisible();
      await expect.poll(() => wrapper.evaluate((box) => {
        const child = box.querySelector('p').getBoundingClientRect();
        const parent = box.getBoundingClientRect();
        return parent.bottom >= child.bottom - 1;
      }), { message: `FAQ answer ${index + 1} is clipped` }).toBe(true);
      for (const theme of ['dark', 'light']) {
        await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
        expect(await contrastOnBackground(summary, '.mr-faq', '.mr-faq-item'), `${theme} FAQ question contrast`).toBeGreaterThanOrEqual(4.5);
        expect(await contrastOnBackground(answer, '.mr-faq', '.mr-faq-item'), `${theme} FAQ answer contrast`).toBeGreaterThanOrEqual(4.5);
      }
      await summary.click();
      await expect(item).not.toHaveAttribute('open', '');
    }
  });

  test('all suburb FAQ answers open completely and have readable contrast', async ({ page }) => {
    await page.goto('/prigorody/', { waitUntil: 'domcontentloaded' });
    const items = page.locator('details.hub-faq-item');
    await expect(items).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      const item = items.nth(index);
      const summary = item.locator('summary');
      const wrapper = item.locator('.hub-faq-answer');
      const answer = wrapper.locator('p');
      await summary.click();
      await expect(item).toHaveAttribute('open', '');
      await expect(wrapper).toHaveCSS('opacity', '1');
      await expect(answer).toBeVisible();
      await expect.poll(() => wrapper.evaluate((box) => {
        const child = box.querySelector('p').getBoundingClientRect();
        const parent = box.getBoundingClientRect();
        return parent.bottom >= child.bottom - 1;
      }), { message: `Suburb FAQ answer ${index + 1} is clipped` }).toBe(true);
      for (const theme of ['dark', 'light']) {
        await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
        expect(await contrastOnBackground(summary, '.hub-faq-item'), `${theme} suburb question contrast`).toBeGreaterThanOrEqual(4.5);
        expect(await contrastOnBackground(answer, '.hub-faq-item'), `${theme} suburb answer contrast`).toBeGreaterThanOrEqual(4.5);
      }
      await summary.click();
      await expect(item).not.toHaveAttribute('open', '');
    }
  });

  test('meringue storage and FAQ on both pages work without JavaScript', async ({ browser, baseURL }, testInfo) => {
    const width = testInfo.project.name.includes('mobile') ? 320 : 1440;
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#loader')).toBeHidden();
      const storage = page.locator('.ingredient').filter({ hasText: 'Хранение' });
      await storage.scrollIntoViewIfNeeded();
      await expect(storage.locator('.ingredient-desc')).toBeVisible();
      await expect(storage.locator('.ingredient-desc')).toHaveText('48 ч · +2…+6 °C');
      const faq = page.locator('details.mr-faq-item').filter({ hasText: 'Сколько хранится меренговый рулет?' });
      await faq.locator('summary').click();
      await expect(faq.locator('p')).toBeVisible();
      await expect(faq.locator('p')).toContainText('не более 48 часов с момента изготовления');
      await page.goto('/prigorody/', { waitUntil: 'domcontentloaded' });
      const suburbFaq = page.locator('details.hub-faq-item').first();
      await suburbFaq.locator('summary').click();
      await expect(suburbFaq.locator('p')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('homepage section links are readable, unique and lead to real sections', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const sectionLinks = page.locator('.cb-tags a');
    await expect(sectionLinks).toHaveCount(9);
    const destinations = await sectionLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations).toEqual(expect.arrayContaining(['/gallery/', '/prigorody/', '/meringue-roll/']));
    await expect(page.locator('.cb-tags-label')).toHaveText('Разделы сайта');
    await expect(sectionLinks.first()).toBeVisible();
  });

  test('confectioner portrait reserves its real aspect ratio', async ({ page }) => {
    await page.goto('/o-konditere/', { waitUntil: 'domcontentloaded' });
    const portrait = page.locator('.info-visual img');
    await expect(portrait).toHaveAttribute('width', '600');
    await expect(portrait).toHaveAttribute('height', '900');
    await expect(portrait).toHaveJSProperty('naturalWidth', 600);
    await expect(portrait).toHaveJSProperty('naturalHeight', 900);
  });

  test('training certificates remain visible and open in their lightbox', async ({ page }) => {
    await page.goto('/certificates/', { waitUntil: 'domcontentloaded' });
    const cards = page.locator('.cert-card');
    await expect(cards).toHaveCount(5);
    const firstImage = cards.first().locator('img');
    await expect(firstImage).toHaveAttribute('width', '1536');
    await expect(firstImage).toHaveAttribute('height', '1024');
    await expect(firstImage).toHaveJSProperty('naturalWidth', 1536);
    await cards.first().click();
    await expect(page.locator('#lbOverlay')).toHaveClass(/active/);
    await expect(page.locator('#lbCaption')).toContainText('Торт на миллион');
    await expect(page.locator('#lbImg')).toHaveAttribute('src', /cert_tort_million\.webp$/);
    await page.locator('#lbOverlay').getByRole('button', { name: 'Закрыть' }).click();
    await expect(page.locator('#lbOverlay')).not.toHaveClass(/active/);
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
    const entries = await page.evaluate((body) => {
      const doc = new DOMParser().parseFromString(body, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('Invalid sitemap XML');
      return [...doc.getElementsByTagNameNS('http://www.sitemaps.org/schemas/sitemap/0.9', 'url')]
        .map((entry) => ({
          loc: entry.getElementsByTagNameNS('*', 'loc')[0]?.textContent,
          lastmod: entry.getElementsByTagNameNS('*', 'lastmod')[0]?.textContent,
        }));
    }, xml);
    expect(entries.length).toBeGreaterThanOrEqual(pages.length);
    for (const { loc, lastmod } of entries) {
      expect(lastmod, `${loc} must have a lastmod`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const timestamp = Date.parse(`${lastmod}T00:00:00Z`);
      expect(Number.isNaN(timestamp), `${loc} has an invalid date`).toBe(false);
      expect(new Date(timestamp).toISOString().slice(0, 10), `${loc} has a non-calendar date`).toBe(lastmod);
      expect(timestamp, `${loc} has a future date`).toBeLessThanOrEqual(Date.now());
    }
  });

  test('robots allows crawlers to see /call/ noindex without putting it in the sitemap', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).not.toMatch(/^Disallow:\s*\/call\//m);
    const call = await (await request.get('/call/')).text();
    expect(call).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('https://milovicake.ru/call/');
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
