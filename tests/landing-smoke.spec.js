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
      await expect(page.locator('.landing-footer')).toContainText('Пн–Сб, 10:00–21:00');
      await expect(page.locator('body')).not.toContainText('Пн–Вс');

      // The page may contain a deliberately hidden popup-block recovery link.
      const wa = page.locator('a[href*="wa.me"]:visible').first();
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


  test('wedding contacts use two intentional three-channel panels with branded labels', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    for (const place of ['hero', 'final']) {
      const group = page.locator('.wed-messenger-contact--' + place);
      await expect(group).toHaveCount(1);
      await expect(group.locator('a')).toHaveCount(3);
      const links = group.locator('a');
      await expect(links.nth(0)).toHaveAttribute('href', /^https:\/\/wa\.me\/79119038886\?text=/);
      await expect(links.nth(1)).toHaveAttribute('href', 'https://t.me/+79119038886');
      await expect(links.nth(2)).toHaveAttribute('href', 'https://max.ru/u/f9LHodD0cOIzRY9VJX8MoyR41H64ULjndbose2aPPrzXJDLW8QEiyKTpqxs');
      for (const [i, label] of ['Написать в WhatsApp','Написать в Telegram','Написать в MAX'].entries()) {
        await expect(links.nth(i)).toHaveAttribute('aria-label', label);
        await expect(links.nth(i)).toHaveAttribute('rel', /noopener/);
        await expect(links.nth(i).locator('.wed-contact-brand-name')).toBeVisible();
      }
      const ids = await group.locator('path[id]').evaluateAll(nodes => nodes.map(node => node.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
    await expect(page.locator('.lp-final .wed-contact-links')).toHaveCount(0);
    await expect(page.locator('#wedBrief .wed-brief-contact')).toHaveCount(1);
    const desktop = page.locator('.wed-messenger-contact--hero a').first();
    await desktop.focus();
    await expect(desktop).toBeFocused();
    expect(await desktop.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  });

  test('wedding brand glyphs are authentic and cards use a restrained premium treatment', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    for (const area of ['hero', 'final']) {
      const group = page.locator('.wed-messenger-contact--' + area);
      await expect(group.locator('a')).toHaveCount(3);
      await expect(group.locator('svg text.hero-flat-text')).toHaveCount(3);
      await expect(group.locator('svg textPath, svg .hero-ring-text, svg circle')).toHaveCount(0);
      for (const link of await group.locator('a').all()) {
        const base = await link.evaluate(el => {
          const style=getComputedStyle(el);
          return {background:style.backgroundColor,border:parseFloat(style.borderTopWidth),
            radius:parseFloat(style.borderTopLeftRadius),w:el.getBoundingClientRect().width};
        });
        expect(base.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(base.border).toBeGreaterThan(0);
        expect(base.radius).toBeGreaterThanOrEqual(12);
        expect(base.radius).toBeLessThanOrEqual(16);
        expect(base.w).toBeGreaterThanOrEqual(44);
      }
    }
    const whatsapp=page.locator('.wed-messenger-contact--hero a').first();
    await whatsapp.focus();
    await expect(whatsapp.locator('.wed-contact-brand-name')).toBeVisible();
    await expect(whatsapp).toBeFocused();
  });

  test('wedding three-channel cards use consistent and spacious geometry without duplicate CTA strips', async ({page}) => {
    await page.setViewportSize({width:1440,height:900});
    await page.goto('/svadebnye-torty/', {waitUntil:'domcontentloaded'});
    for(const area of ['hero','final']){
      const group=page.locator('.wed-messenger-contact--'+area+' .wed-contact-links');
      await expect(group.locator('a')).toHaveCount(3);
      const rects=await group.locator('a').evaluateAll(links=>links.map(a=>{
        const r=a.getBoundingClientRect(),g=a.querySelector('svg').getBoundingClientRect();
        return {left:r.left,right:r.right,hit:Math.min(r.width,r.height),glyph:Math.max(g.width,g.height)};
      }));
      expect(rects.every(r=>r.hit>=44&&r.glyph>=38)).toBe(true);
      expect(Math.abs((rects[1].left-rects[0].right)-(rects[2].left-rects[1].right))).toBeLessThanOrEqual(2);
      expect(rects[1].left-rects[0].right).toBeGreaterThanOrEqual(5);
    }
    await expect(page.locator('.wed-messenger-contact')).toHaveCount(2);
    const mobilePage=page;
    await mobilePage.setViewportSize({width:390,height:844});
    const groups=mobilePage.locator('.wed-messenger-contact');
    await expect(groups).toHaveCount(2);
    for(const group of await groups.all()){
      const positions=await group.locator('a').evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
      expect(positions.every(p=>p.width>=44&&p.height>=44)).toBe(true);
    }
  });

  test('wedding messenger links fit mobile widths and reduced-motion remains static', async ({ page }) => {
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      for (const place of ['hero', 'final']) {
        const group = page.locator('.wed-messenger-contact--' + place);
        await group.scrollIntoViewIfNeeded();
        const dimensions = await group.evaluate(el => ({
          viewport: innerWidth, right: el.getBoundingClientRect().right,
          left: el.getBoundingClientRect().left,
          minSize: Math.min(...Array.from(el.querySelectorAll('a')).map(a => Math.min(a.getBoundingClientRect().width, a.getBoundingClientRect().height)))
        }));
        expect(dimensions.left).toBeGreaterThanOrEqual(-1);
        expect(dimensions.right).toBeLessThanOrEqual(width+1);
        expect(dimensions.minSize).toBeGreaterThanOrEqual(44);
      }
      // Responsive content may settle across frames after a viewport change; fail if overflow persists.
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        { timeout: 2500, intervals: [50, 100, 200] }).toBeLessThanOrEqual(1);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    const link = page.locator('.wed-messenger-contact--hero a').first();
    await link.hover();
    expect(await link.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  });

  test('wedding superhero cake is a distinct card with honest provenance and responsive assets', async ({ page, request }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const card = page.locator('#wedStyles .lp-card').nth(1);
    await expect(card).toContainText('Многоярусный торт с характером');
    await expect(card).toContainText('свадебный фон на фото — художественная визуализация');
    await expect(card.locator('img')).toHaveAttribute('src', '/img/wedding-superhero-couple.webp');
    await expect(card.locator('img')).toHaveAttribute('alt', /свадебном фоне/);
    await expect(card.locator('img')).toHaveAttribute('loading', 'lazy');
    const responsiveSources = await card.locator('source[type="image/avif"]').getAttribute('srcset');
    expect(responsiveSources).toContain('/img/wedding-superhero-couple-sm.avif 480w');
    await expect(page.locator('.wed-collection-card')).toHaveCount(4);
    await expect(page.locator('img[src*="wedding-style-golden-atelier.webp"]')).toHaveCount(1);
    for (const file of ['/img/wedding-superhero-couple-sm.avif', '/img/wedding-superhero-couple.avif', '/img/wedding-superhero-couple.webp']) {
      const response = await request.get(file);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type'].startsWith('image/')).toBe(true);
    }
    const schemaProduct = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
      const list = data['@graph'].find(item => item['@type'] === 'ItemList');
      return list.itemListElement.find(item => item.item.name === 'Многоярусный торт с характером')?.item;
    });
    expect(schemaProduct.image).toBe('https://milovicake.ru/img/wedding-superhero-couple.webp');
    expect(schemaProduct.description).toContain('художественная визуализация');
  });


  test('wedding dessert card honestly labels styled cupcakes and serves responsive assets', async ({ page, request }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const card = page.locator('#wedStyles .lp-card').nth(2);
    await expect(card).toContainText('Визуализация оформления');
    await expect(card).toContainText('меренговые рулеты');
    await expect(card).toContainText('Павлова');
    await expect(card).toContainText('художественный вариант свадебной подачи');
    await expect(card.locator('img')).toHaveAttribute('src', '/img/wedding-cupcakes-styled.webp');
    await expect(card.locator('img')).toHaveAttribute('alt', /Художественная свадебная визуализация/);
    const responsive = await card.locator('source[type="image/avif"]').getAttribute('srcset');
    expect(responsive).toContain('wedding-cupcakes-styled-sm.avif 480w');
    expect(responsive).toContain('wedding-cupcakes-styled.avif 720w');
    await expect(page.locator('#wedStyles img[src*="wedding-table"]')).toHaveCount(0);
    const detail = page.locator('.wed-collection-detail');
    await expect(detail.locator('img')).toHaveAttribute('src', '/img/wedding-roulade-detail.webp');
    await expect(detail.locator('.wed-collection-kicker')).toHaveText('Визуализация');
    await expect(detail.locator('img')).toHaveAttribute('alt', /Художественная визуализация/);
    await expect(detail.locator('source')).toHaveAttribute('srcset', /wedding-roulade-detail-sm\.avif 800w/);
    await expect(detail.locator('a')).toHaveAttribute('href', '#wedStyles');
    await expect(page.locator('img[src*="wedding-style-pure-ivory.webp"]')).toHaveCount(1);
    for (const file of [
      '/img/wedding-cupcakes-styled-sm.avif',
      '/img/wedding-cupcakes-styled.avif',
      '/img/wedding-cupcakes-styled.webp',
      '/img/cupcakes.webp',
      '/img/meringue_roll_6.webp',
      '/img/pavlova.webp',
      '/img/wedding-roulade-detail-sm.avif',
      '/img/wedding-roulade-detail.avif',
      '/img/wedding-roulade-detail.webp',
    ]) {
      const response = await request.get(file);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type'].startsWith('image/')).toBe(true);
    }
    const schema = await page.evaluate(() => {
      const graph = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
      return graph.find(item => item['@type'] === 'ItemList').itemListElement.find(item => item.item.name === 'Десерты к свадьбе').item;
    });
    expect(schema.image).toBe('https://milovicake.ru/img/wedding-cupcakes-styled.webp');
    expect(schema.description).toContain('Художественная визуализация');
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

  test('wedding direct date links keep the form label below the desktop and mobile header', async ({ page }) => {
    for (const width of [320, 390, 900, 901, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/svadebnye-torty/#wedDateForm', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });
      await expect.poll(() => page.evaluate(() => {
        const label = document.querySelector('#wedDateForm label').getBoundingClientRect();
        const header = document.querySelector('.lp-header').getBoundingClientRect();
        return label.top - header.bottom;
      }), { timeout: 4000 }).toBeGreaterThanOrEqual(12);
      const result = await page.evaluate(() => ({
        date: document.querySelector('#wedDate').getBoundingClientRect().top,
        headerBottom: document.querySelector('.lp-header').getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      expect(result.date).toBeGreaterThan(result.headerBottom);
      expect(result.overflow).toBeLessThanOrEqual(1);
    }
  });

  test('wedding portfolio link lands below the fixed header at every layout breakpoint', async ({ page }) => {
    for (const width of [320, 390, 861, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      // The first-paint content-visibility placeholder is not the final gallery layout.
      await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });
      const portfolioLink = page.locator('.wed-collection-note a');
      await portfolioLink.scrollIntoViewIfNeeded();
      await portfolioLink.click();
      await expect(page).toHaveURL(/#mediaShowcaseTitle$/);
      await page.waitForFunction(() => Math.abs(document.querySelector('#mediaShowcaseTitle').getBoundingClientRect().top - 88) < 2);
      const offset = await page.evaluate(() => ({
        heading: document.querySelector('#mediaShowcaseTitle').getBoundingClientRect().top,
        header: document.querySelector('.lp-header').getBoundingClientRect().bottom,
      }));
      expect(offset.heading).toBeGreaterThanOrEqual(offset.header + 12);
    }
  });

  test('wedding video poster matches portfolio, gallery and metadata without native playback chrome', async ({page,request}) => {
    const poster='/img/gallery/video-12-wedding-heart-poster.webp';
    const description='Кондитер оформляет белый торт свежей малиной';
    const videoRequests=[];
    page.on('request',req=>{
      if(/\/video-12-wedding-heart\.(webm|mp4)(?:\?|$)/.test(req.url()))videoRequests.push(req.url());
    });
    await page.goto('/svadebnye-torty/',{waitUntil:'domcontentloaded'});
    const schemas=await page.locator('script[type="application/ld+json"]').allTextContents();
    const reel=schemas.map(JSON.parse).flatMap(schema=>schema['@graph']||[schema])
      .find(item=>item['@type']==='VideoObject' && item.contentUrl?.includes('video-12-wedding-heart.webm'));
    expect(reel.thumbnailUrl).toBe('https://milovicake.ru'+poster);
    expect(reel.name).toContain('малиной');
    expect(reel.description).toBe(description);
    const clip=page.locator('.wed-proof-video-frame');
    const video=clip.locator('video');
    await expect(video).toHaveAttribute('poster',poster);
    await expect(video).toHaveAttribute('preload','none');
    await expect(video).toHaveAttribute('loading','lazy');
    await expect(clip.locator('.wed-clip-controls button')).toHaveCount(2);
    expect(videoRequests).toHaveLength(0);
    await video.scrollIntoViewIfNeeded();
    await expect.poll(()=>videoRequests.length,{timeout:15000}).toBeGreaterThan(0);
    await expect.poll(()=>video.evaluate(el=>!el.paused),{timeout:15000}).toBe(true);
    await expect(video).not.toHaveAttribute('controls','');
    const response=await request.get(poster);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeLessThan(22_000);
    const dims=await page.evaluate(src=>new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve([image.naturalWidth,image.naturalHeight]);
      image.onerror=reject;image.src=src;
    }),poster);
    expect(dims).toEqual([720,1282]);
    const videoFit=await video.evaluate(el=>getComputedStyle(el).objectFit);
    expect(videoFit).toBe('cover');
    const sitemap=await(await request.get('/sitemap-videos.xml')).text();
    expect(sitemap).toContain('<video:thumbnail_loc>https://milovicake.ru'+poster+'</video:thumbnail_loc>');
    expect(sitemap).toContain('<video:description>'+description+'</video:description>');
    const home=await(await request.get('/')).text();
    const embeddedVideos = home.match(/data-videos='([\s\S]*?)'/);
    expect(embeddedVideos).not.toBeNull();
    const manifestVideos = JSON.parse(embeddedVideos[1]);
    const source = manifestVideos.find(item => item.v === '/img/gallery/videos/video-12-wedding-heart.webm');
    expect(source).toBeDefined();
    expect(source.p).toBe(poster);
    expect(source.t).toBe('Торт с малиной');
    // Desktop MP4 companion is optional on the standalone wedding PR;
    // if present, validate the exact playback path and downloadable media.
    if (Object.prototype.hasOwnProperty.call(source, 'm')) {
      expect(source.m).toBe('/img/gallery/videos/video-12-wedding-heart.mp4');
      const companion = await request.head(source.m);
      expect(companion.ok()).toBe(true);
      expect(companion.headers()['content-type']).toContain('video/mp4');
    }
    await page.goto('/gallery/',{waitUntil:'domcontentloaded'});
    await page.locator('.gx-chip[data-filter="wedding"]').click();
    await expect(page.locator('[data-id="v12"] video')).toHaveAttribute('poster',poster);
    const galleryReel=await page.evaluate(async()=>{
      const {GALLERY_ITEMS}=await import('/js/gallery/data.js?v=20261026r01');
      return GALLERY_ITEMS.find(item=>item.id==='v12');
    });
    expect(galleryReel.desc).toBe(description);
  });

  test('wedding music captions load in view without fetching video eagerly', async ({ page }) => {
    const videoRequests = [];
    page.on('request', (request) => {
      if (/video-12-wedding-heart\.(webm|mp4)(\?|$)/.test(request.url())) videoRequests.push(request.url());
    });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const video = page.locator('.wed-proof-video-frame video');
    await expect(video.locator('track[kind="captions"][srclang="ru"]'))
      .toHaveAttribute('src', '/svadebnye-torty/video-12-wedding-heart.ru.vtt');
    // Lazy video tracks can remain UNLOADED on mobile until the footage enters view.
    // Confirm the video is not fetched before that point, then test the actual cue.
    expect(videoRequests).toEqual([]);
    await video.scrollIntoViewIfNeeded();
    await video.evaluate((element) => { element.textTracks[0].mode = 'hidden'; });
    await expect.poll(() => video.evaluate((element) => element.textTracks[0].cues?.length ?? 0)).toBe(1);
    const cue = await video.evaluate((element) => {
      const { startTime, endTime, text } = element.textTracks[0].cues[0];
      return { startTime, endTime, text };
    });
    expect(cue).toEqual({ startTime: 0, endTime: 10.01, text: '[Звучит музыка]' });
  });

  test('wedding clip auto-plays muted in view, loops and has only two accessible controls', async ({ page }) => {
    await page.goto('/svadebnye-torty/', {waitUntil:'domcontentloaded'});
    const frame=page.locator('.wed-proof-video-frame');
    const video=frame.locator('video');
    const panel=frame.locator('.wed-clip-controls');
    const play=panel.locator('.wed-clip-toggle');
    const sound=panel.locator('.wed-clip-sound');
    await expect(video).toHaveAttribute('preload','none');
    await expect(video).toHaveAttribute('loop','');
    await expect(video).toHaveAttribute('muted','');
    await expect(video).toHaveAttribute('playsinline','');
    await expect(video).not.toHaveAttribute('controls','');
    await expect(panel).toBeVisible({timeout:10000});
    await expect(panel.locator('button')).toHaveCount(2);
    await panel.scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate(el => !el.paused && el.currentTime > .15), {timeout:15000}).toBe(true);
    expect(await video.evaluate(el=>el.muted)).toBe(true);
    await expect(play).toHaveAttribute('aria-label','Пауза');
    await expect(sound).toHaveAttribute('aria-label','Включить звук');
    await expect(panel.locator('.wed-clip-icon-play')).toHaveCSS('display','none');
    await expect(panel.locator('.wed-clip-icon-pause')).toHaveCSS('display','block');
    await expect(panel.locator('.wed-clip-icon-muted')).toHaveCSS('display','block');
    await expect(panel.locator('.wed-clip-icon-sound')).toHaveCSS('display','none');
    await expect(play).toHaveAttribute('aria-pressed','true');
    await expect(sound).toHaveAttribute('aria-pressed','false');
    await play.click();
    await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
    await expect(play).toHaveAttribute('aria-label','Воспроизвести');
    await play.click();
    await expect.poll(() => video.evaluate(el => !el.paused)).toBe(true);
    await sound.click();
    await expect.poll(() => video.evaluate(el => !el.muted)).toBe(true);
    await expect(sound).toHaveAttribute('aria-label','Выключить звук');
    await expect(panel.locator('.wed-clip-icon-muted')).toHaveCSS('display','none');
    await expect(panel.locator('.wed-clip-icon-sound')).toHaveCSS('display','block');
    await sound.click();
    await expect.poll(() => video.evaluate(el => el.muted)).toBe(true);
    await expect(video).not.toHaveAttribute('controls','');
    await sound.focus();
    await expect(sound).toBeFocused();
    const geometry=await frame.evaluate(el=>({
      videoFit:getComputedStyle(el.querySelector('video')).objectFit,
      overflow:document.documentElement.scrollWidth-innerWidth,
      minHit:Math.min(...[...el.querySelectorAll('.wed-clip-control')].map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height))),
    }));
    expect(geometry.videoFit).toBe('cover');
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.minHit).toBeGreaterThanOrEqual(44);
  });

  test('wedding video respects reduced motion until explicit play', async ({ page }) => {
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/svadebnye-torty/', {waitUntil:'domcontentloaded'});
    const frame=page.locator('.wed-proof-video-frame');
    await frame.scrollIntoViewIfNeeded();
    const video=frame.locator('video');
    await page.waitForTimeout(350);
    expect(await video.evaluate(el=>el.paused)).toBe(true);
    await frame.locator('.wed-clip-toggle').click();
    await expect.poll(() => video.evaluate(el=>!el.paused && el.currentTime>.1), {timeout:10000}).toBe(true);
  });

  test.describe('wedding video format fallback', () => {
    test.use({ serviceWorkers:'block' });

    test('falls back to WebM if preferred MP4 request fails, without native player chrome', async ({page}) => {
      const requests=[];
      await page.route('**/video-12-wedding-heart.mp4', route => route.abort('failed'));
      page.on('request', req => { if (/video-12-wedding-heart\.(webm|mp4)$/.test(req.url())) requests.push(new URL(req.url()).pathname); });
      await page.goto('/svadebnye-torty/', {waitUntil:'domcontentloaded'});
      const video=page.locator('.wed-proof-video-frame video');
      await expect(video.locator('source').first()).toHaveAttribute('type','video/mp4');
      await expect(video.locator('source').nth(1)).toHaveAttribute('type','video/webm');
      // This is the lazy playback contract: no asset request before the viewer reaches the section.
      expect(requests).toEqual([]);
      await video.scrollIntoViewIfNeeded();
      // Simulate a broken preferred MP4 and verify the alternative WebM is
      // genuinely decoded. Separate tests strictly cover muted autoplay
      // and Safari's MP4-first real-frame playback.
      await expect.poll(() => video.evaluate(el => el.currentSrc), {timeout:12000})
        .toContain('/video-12-wedding-heart.webm');
      await expect.poll(() => video.evaluate(el => el.readyState), {timeout:15000})
        .toBeGreaterThanOrEqual(2);
      const startTime = await video.evaluate(el => el.currentTime);
      // User gesture covers environments where autoplay is policy-blocked;
      // it does not replace the separate automatic-play contract.
      if (await video.evaluate(el => el.paused))
        await page.locator('.wed-proof-video-frame .wed-clip-toggle').click();
      await expect.poll(() => video.evaluate(el => el.currentTime), {timeout:15000})
        .toBeGreaterThan(startTime + .2);
      // Chromium may choose WebM without requesting intentionally blocked MP4.
      // Decode and playback above plus WebM network request below are the fallback contract.
      expect(requests).toContain('/img/gallery/videos/video-12-wedding-heart.webm');
      await expect(video).not.toHaveAttribute('controls','');
    });
  });

  test.describe('wedding video without JavaScript', () => {
    test.use({javaScriptEnabled:false});

    test('retains native controls as a progressive fallback', async ({page}) => {
      await page.goto('/svadebnye-torty/', {waitUntil:'domcontentloaded'});
      const video=page.locator('.wed-proof-video-frame video');
      await video.scrollIntoViewIfNeeded();
      await expect(video).toBeVisible();
      await expect(video).toHaveAttribute('controls','');
      await expect(page.locator('.wed-clip-controls')).toBeHidden();
      await expect(video.locator('source[type="video/mp4"]'))
        .toHaveAttribute('src','/img/gallery/videos/video-12-wedding-heart.mp4');
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
      await expect(card.locator('a')).toHaveAttribute('href', '#wedBrief');
      await expect(card.locator('a')).toHaveAttribute('data-wed-style', name);
      await card.locator('a').click();
      await expect(page.locator('#wedSelectedStyle')).toContainText(name);
      const wa = new URL(await page.locator('#wedBrief .btn-hero-wa').getAttribute('href'));
      expect(wa.searchParams.get('text')).toContain('Предпочтительный стиль: ' + name);
    }
  });

  test('wedding formats credit the real work and frame the multi-tier concept', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const cards = page.locator('#wedStyles .lp-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.locator('.wed-collection-kicker')).toHaveText([
      'Реальная работа', 'По фото реального торта', 'Визуализация оформления',
    ]);
    await expect(cards.nth(1).locator('source[type="image/avif"]'))
      .toHaveAttribute('srcset', /wedding-superhero-couple-sm\.avif 480w, \/img\/wedding-superhero-couple\.avif 720w/);
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
      expect(layout.columns).toBe(width <= 375 ? 1 : width <= 860 ? 2 : 4);
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
      if (credit === 'По фото реального торта') expect(product.description).toContain('художественная визуализация');
      if (credit === 'Визуализация оформления') expect(product.description).toContain('Художественная визуализация');
      // These are starting rates or require a minimum quantity, not the total
      // purchase price of a single fixed offer.
      expect(product.offers).toBeUndefined();
    }
    expect(formats[0].label).toBe('от\u00a03\u00a0000\u00a0₽/кг'); // Keep the price together with real web fonts.
    expect(formats[0].product.description).toContain('от 3 000 ₽/кг');
    expect(formats[2].label).toBe('от 350 ₽/шт.');
    expect(formats[2].product.description).toContain('Минимальный заказ: 6 капкейков одного вкуса или 2 пирожных Павлова');
    await expect(page.locator('#wedStyles .lp-card').nth(2)).toContainText('Капкейки (от 6 шт. одного вкуса)');
    await expect(page.locator('#wedStyles .lp-card').nth(2)).toContainText('пирожные «Павлова» (от 2 шт.)');
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

  test('wedding tasting is informative and shares one contact funnel with the wedding brief', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const section=page.locator('#wedTasting');
    const link=section.getByRole('link',{name:/указать дегустацию в брифе/i});
    await expect(section).toContainText(/по запросу|при обращении/i);
    await expect(section).toContainText('стоимость');
    await expect(section).toContainText('сроки');
    await expect(link).toHaveAttribute('href','#wedBrief');
    for(const theme of ['light','dark']){
      await page.locator('html').evaluate((root,value)=>root.setAttribute('data-theme',value),theme);
      for(const width of [320,360,390,414,561,600,768,900,1024,1440]){
        await page.setViewportSize({width,height:900});
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
        const box=await link.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x+box.width).toBeLessThanOrEqual(width+1);
      }
    }
    await link.click();
    await expect(page).toHaveURL(/#wedBrief$/);
    const brief=page.locator('#wedBrief');
    await expect(brief.locator('.wed-brief-contact a')).toHaveCount(3);
    await expect(brief.locator('.wed-brief-helper')).toContainText('дегустации добавлен');
    const wa=new URL(await brief.locator('.btn-hero-wa').getAttribute('href'));
    expect(wa.searchParams.get('text')).toContain('Интересует дегустационный сет начинок: да.');
    for(const term of ['Дата свадьбы:','Площадка:','Гостей:','Палитра:','Референсы:']){
      expect(wa.searchParams.get('text')).toContain(term);
    }
  });

  test('wedding final invitation shows certificates, contacts and related educational project', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.lp-final h2')).toContainText('вниманием к деталям');
    await expect(page.locator('.lp-final p')).toContainText('обучении');
    const brief = await page.locator('#wedBrief .btn-hero-wa').getAttribute('href');
    const message = new URL(brief).searchParams.get('text');
    for (const prompt of ['Дата свадьбы:', 'Площадка:', 'Гостей:', 'Палитра:', 'Референсы:']) {
      expect(message).toContain(prompt);
    }
    const final = page.locator('.lp-final .lp-btn-primary');
    await expect(final).toHaveAttribute('href', '/certificates/');
    await expect(final).toContainText('Посмотреть сертификаты');
    await expect(page.locator('.lp-final .wed-contact-links')).toHaveCount(0);
    await expect(page.locator('.lp-final')).not.toContainText('Отправить бриф');
    const school = page.locator('.wed-school-project');
    const projectLink = school.locator('.wed-school-project-link');
    await expect(school).toContainText('Наш образовательный проект');
    await expect(school).toContainText('не каталог заказов');
    await expect(projectLink).toHaveAttribute('href', 'https://french.milovicake.ru/');
    await expect(projectLink).toHaveAttribute('target', '_blank');
    await expect(projectLink).toHaveAttribute('rel', /noopener/);
    for (const width of [320, 390, 561, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });
      for (const button of [final, projectLink]) {
        const geometry = await button.evaluate((element) => {
          const { left, right, height } = element.getBoundingClientRect();
          return { left, right, height, overflow: element.scrollWidth - element.clientWidth,
            pageOverflow: document.documentElement.scrollWidth - innerWidth };
        });
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(width + 1);
        expect(geometry.height).toBeGreaterThanOrEqual(44);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
      }
    }
  });

  test('wedding detail keeps its image and readable call to action on narrow phones', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });
    for (const width of [320, 393, 440, 500, 501, 561, 1024]) {
      await page.setViewportSize({ width, height: 860 });
      // Viewport transitions can defer the offscreen detail grid's layout.
      await page.locator('.wed-collection-detail').scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        { timeout: 3000, intervals: [50, 150, 300] }).toBeLessThanOrEqual(1);
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
        expect(photo.url).toMatch(/\/img\/wedding-roulade-detail(?:-sm)?\.avif/);
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
    await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });
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
            slider: height('#wedGuests'), video: height('.wed-clip-control'),
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

  test('wedding date counts consent-mediated handoff only when WhatsApp tab opens', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.weddingAnalyticsCalls = [];
      window.weddingOpenUrls = [];
      window.MiloviConsent = { leadHandoff: (...args) => window.weddingAnalyticsCalls.push(args) };
      window.open = (url) => { window.weddingOpenUrls.push(url); return null; };
    });
    await page.locator('#wedDate').evaluate((el) => el.form.requestSubmit());
    await expect.poll(() => page.evaluate(() => window.weddingOpenUrls.length)).toBe(1);
    expect(await page.evaluate(() => window.weddingAnalyticsCalls)).toEqual([]);
    const fallback = page.locator('#wedDateFallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('href', /^https:\/\/wa\.me\/79119038886\?text=/);
    await expect(page.locator('#wedDateHint')).toContainText('заблокировал');

    await page.evaluate(() => {
      window.open = (url) => {
        window.weddingOpenUrls.push(url);
        return { opener: window };
      };
    });
    await page.locator('#wedDate').evaluate((el) => el.form.requestSubmit());
    await expect.poll(() => page.evaluate(() => window.weddingAnalyticsCalls)).toEqual([['whatsapp', 'wedding_date']]);
    expect(await page.evaluate(() => window.weddingOpenUrls.length)).toBe(2);
    await expect(fallback).toBeHidden();
    await expect(page.locator('#wedDateHint')).toContainText('Откроется WhatsApp');
  });

  test('wedding date recovers from popup API exceptions and resets fallback after editing', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.open = () => { throw new Error('popup denied by browser'); };
    });
    await page.locator('#wedDate').evaluate((el) => el.form.requestSubmit());
    const fallback = page.locator('#wedDateFallback');
    await expect(fallback).toBeVisible();
    expect(new URL(await fallback.getAttribute('href')).searchParams.get('text'))
      .toContain('дата пока не выбрана');
    const date = await page.locator('#wedDate').getAttribute('min');
    await page.locator('#wedDate').fill(date);
    await expect(fallback).toBeHidden();
    await expect(page.locator('#wedDateHint')).toContainText('Откроется WhatsApp');
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

    // Кластер направлений. С r44 те же адреса появились в мобильном меню
    // (закрытая панель идёт в DOM раньше футера), поэтому проверка делится на
    // два независимых факта:
    //   1) отданная разметка главной содержит все адреса кластера;
    //   2) в видимом блоке «Разделы сайта» эти адреса действительно доступны.
    const cluster = ['/zakazat-tort-spb/', '/tort-s-dostavkoy/', '/bento-torty/', '/detskie-torty/',
      '/svadebnye-torty/', '/o-konditere/', '/dostavka-i-oplata/', '/otzyvy/'];
    const served = await (await page.request.get('/')).text();
    for (const href of cluster) {
      expect(served, `served homepage must link ${href}`).toContain(`href="${href}"`);
    }
    // Блок «Разделы сайта» в калькуляторе — отдельный вход в тот же кластер.
    expect(await page.locator('.cb-tags a').count(), 'calculator section links').toBeGreaterThanOrEqual(9);
    // Видимые копии: футер (навигационная колонка и «Наши проекты»), плюс блок
    // ссылок над футером. Именно они, а не скрытая панель меню, дают переход.
    for (const href of cluster) {
      const visibleCopy = page.locator(
        `.footer-col a[href="${href}"]:visible, .footer-projects a[href="${href}"]:visible, .cb-tags a[href="${href}"]:visible`,
      );
      await expect(visibleCopy.first(), `visible homepage link to ${href}`).toBeVisible();
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
    await expect(page.locator('body')).toContainText('Пн–Сб, 10:00–21:00');
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
        const style = getComputedStyle(current);
        let color = parse(style.backgroundColor);
        // Градиент рисует собственную поверхность: у «золотой»/тёмной кнопки
        // background-color прозрачный, а фон задан background-image. Берём первый
        // цветовой стоп, иначе проба сравнивала текст с фоном страницы.
        if ((!color || color[3] === 0) && /gradient\(/i.test(style.backgroundImage)) {
          color = parse(style.backgroundImage);
        }
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

test.describe('suburb links and page-specific resilience', () => {
  test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

  test('a suburb Pavlova link hydrates the catalog; the roll link opens the roll', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/prigorody/pushkin/', { waitUntil: 'domcontentloaded' });
    const promo = page.locator('.meringue-promo');
    const pavlova = promo.getByRole('link', { name: 'пирожное Павлова' });
    const roll = promo.getByRole('link', { name: 'меренговый рулет' });
    await expect(pavlova).toHaveAttribute('href', '#catalog');
    await expect(roll).toHaveAttribute('href', '/meringue-roll/?city=pushkin');
    await pavlova.click();
    await expect(page).toHaveURL(/\/prigorody\/pushkin\/#catalog$/);
    const card = page.locator('#card-5');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toContainText('Павлова');
    await expect(card).toBeVisible();
    await expect.poll(() => card.locator('img').first().evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
    await roll.click();
    await expect(page).toHaveURL(/\/meringue-roll\/\?city=pushkin$/);
    await expect(page.locator('h1')).toContainText('Меренговый');
    expect(errors).toEqual([]);
  });

  for (const failure of ['session-read', 'session-quota', 'both-storages']) {
    test(`meringue page and FAQ work when ${failure} fails`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript((mode) => {
        if (mode === 'session-read' || mode === 'both-storages') {
          Object.defineProperty(window, 'sessionStorage', { configurable: true, get() {
            throw new DOMException('Storage blocked', 'SecurityError');
          }});
        } else {
          const setItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (this === window.sessionStorage) throw new DOMException('Quota exceeded', 'QuotaExceededError');
            return setItem.call(this, key, value);
          };
        }
        if (mode === 'both-storages') Object.defineProperty(window, 'localStorage', { configurable: true, get() {
          throw new DOMException('Storage blocked', 'SecurityError');
        }});
      }, failure);
      await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
      if (failure === 'both-storages') {
        await page.getByRole('button', { name: 'Без аналитики' }).click();
        await expect(page.locator('.mc-consent-overlay')).toBeHidden();
      }
      await expect(page.locator('#loader')).toBeHidden();
      const faq = page.locator('details.mr-faq-item').first();
      await faq.locator('summary').click();
      await expect(faq).toHaveAttribute('open', '');
      await expect(faq.locator('p')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('suburb header and text remain readable while actually switching themes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mc_theme', 'light'));
    await page.goto('/prigorody/', { waitUntil: 'domcontentloaded' });
    for (const theme of ['light', 'dark']) {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const header = page.locator('#siteHeader');
      expect(await header.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(41, 27, 18)');
      expect(await contrastOnBackground(page.locator('#themeToggleBtn'), '#siteHeader')).toBeGreaterThanOrEqual(3);
      expect(await contrastOnBackground(page.locator('#siteHeader .header-logo'), '#siteHeader')).toBeGreaterThanOrEqual(4.5);
      await page.locator('#hubSeoTitle').evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
      const headerBox = await header.boundingBox();
      const headingBox = await page.locator('#hubSeoTitle').boundingBox();
      expect(headingBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
      expect(await contrastOnBackground(page.locator('.hub-seo > p'), 'body')).toBeGreaterThanOrEqual(4.5);
      expect(await contrastOnBackground(page.locator('.hub-back a'), 'body')).toBeGreaterThanOrEqual(4.5);
      await page.locator('#themeToggleBtn').click();
    }
  });

  test('roll header stays legible and uncrowded at 320–1440px', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mc_theme', 'dark'));
    await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loader')).toBeHidden();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['dark', 'light']) {
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const header = page.locator('.site-hdr');
        expect(await header.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(19, 12, 7)');
        const logo = page.locator('.hdr-logo');
        const order = page.locator('.hdr-order');
        const toggle = page.locator('.lp-theme-toggle');
        // Include the button's own surface, including its real hover transition.
        await expect.poll(() => contrastOnBackground(order, '.site-hdr', '.hdr-order')).toBeGreaterThanOrEqual(4.5);
        await expect.poll(() => contrastOnBackground(toggle, '.site-hdr', '.lp-theme-toggle')).toBeGreaterThanOrEqual(3);
        const [headBox, logoBox, orderBox, toggleBox] = await Promise.all(
          [header, logo, order, toggle].map((item) => item.boundingBox())
        );
        expect(logoBox.x + logoBox.width + 4).toBeLessThanOrEqual(orderBox.x);
        expect(orderBox.x + orderBox.width).toBeLessThanOrEqual(toggleBox.x);
        expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(width);
        expect(logoBox.y + logoBox.height).toBeLessThanOrEqual(headBox.y + headBox.height);
        await toggle.click();
      }
    }
  });

  test('roll copy and navigation retain contrast in both selected themes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mc_theme', 'dark'));
    await page.goto('/meringue-roll/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loader')).toBeHidden();
    for (const theme of ['dark', 'light']) {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const [selector, background, minimum] of [
        ['.hero-desc', 'body', 4.5],
        ['.breadcrumb-current', 'body', 4.5],
        ['.sec-body', '.split-text', 4.5],
        ['.ingredient-num', '.split-text', 3],
        ['.footer-col--nav a', '.site-footer', 4.5],
      ]) {
        const item = page.locator(selector).first();
        await item.scrollIntoViewIfNeeded();
        // Wait for the site's own reveal/hover transitions rather than forcing their state.
        await expect.poll(() => item.evaluate((node) => Number(getComputedStyle(node).opacity))).toBe(1);
        await expect.poll(() => contrastOnBackground(item, background), { message: `${theme} ${selector}` }).toBeGreaterThanOrEqual(minimum);
      }
      await page.locator('.lp-theme-toggle').click();
    }
  });
});

test('wedding messenger cards have accessible keyboard focus with no redundant rings', async ({ page }) => {
  await page.goto('/svadebnye-torty/', {waitUntil:'domcontentloaded'});
  const icons=page.locator('.wed-wrap .wed-contact-links a.btn-hero-messenger');
  await expect(icons).toHaveCount(6);
  for(let i=0;i<6;i++){
    const icon=icons.nth(i);
    const normal=await icon.evaluate(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return {background:s.backgroundColor,border:parseFloat(s.borderTopWidth),
        radius:parseFloat(s.borderTopLeftRadius),width:r.width,height:r.height};
    });
    expect(normal.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(normal.border).toBeGreaterThan(0);
    expect(normal.radius).toBeGreaterThanOrEqual(12);
    expect(normal.width).toBeGreaterThanOrEqual(44);
    expect(normal.height).toBeGreaterThanOrEqual(44);
    await icon.focus();
    await expect.poll(()=>icon.evaluate(el=>el.matches(':focus-visible'))).toBe(true);
    expect(await icon.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
    await icon.evaluate(el=>el.blur());
  }
});

test('wedding navigation has a subtle gold hover line and accessible keyboard state', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('milovi_analytics_consent_v1', 'granted'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });

  const nav = page.locator('.wed-wrap .lp-nav a').first();
  await expect(nav).toBeVisible();
  const underlineOpacity = () => nav.evaluate((node) => Number(getComputedStyle(node, '::after').opacity));
  const fineHover = await page.evaluate(() => matchMedia('(hover:hover) and (pointer:fine)').matches);
  if (fineHover) {
    await nav.hover();
    await expect.poll(underlineOpacity).toBeGreaterThan(0.9);
    await page.mouse.move(0, 0);
    await expect.poll(underlineOpacity).toBeLessThan(0.1);
  }

  await page.keyboard.press('Tab');
  await nav.focus();
  await expect.poll(underlineOpacity).toBeGreaterThan(0.9);
  expect(await nav.evaluate((node) => node.matches(':focus-visible'))).toBe(true);

  const question = page.locator('.wed-wrap .lp-faq-item summary').first();
  const details = page.locator('.wed-wrap details.lp-faq-item').first();
  await question.scrollIntoViewIfNeeded();
  await question.click();
  await expect(details).toHaveAttribute('open', '');
  expect(await question.evaluate((node) => getComputedStyle(node, '::after').content)).toBe('"+"');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await nav.evaluate((node) => getComputedStyle(node, '::after').transitionDuration);
  expect(duration.split(',').every((value) => parseFloat(value) === 0)).toBe(true);
});

test('wedding mobile dock never obscures content and remains reachable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('milovi_analytics_consent_v1', 'granted'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });

  const firstAction = page.locator('.wed-mobile-first-action');
  const sticky = page.locator('.wed-mobile-sticky');
  const form = page.locator('#wedDateForm');
  await expect(firstAction).toBeVisible();
  expect((await firstAction.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect((await page.locator('.wed-header .lp-logo').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(sticky).toBeHidden();
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });

  // The optional dock shows only in genuinely free areas of a long editorial page.
  async function findSafeDock() {
    // Editorial section heights change with viewport, fonts and responsive images.
    // Discover a safe position rather than encoding one historic scroll coordinate.
    const foundAt = await page.evaluate(async () => {
      const dock = document.querySelector('.wed-mobile-sticky');
      const limit = document.documentElement.scrollHeight - innerHeight;
      for (let top = 1000; top < limit; top += 100) {
        scrollTo(0, top);
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!dock.hidden) return top;
      }
      return null;
    });
    if (foundAt === null) {
      throw new Error('Wedding enquiry dock has no unobstructed position on the mobile page');
    }
    await expect(sticky).toBeVisible();
  }

  await findSafeDock();
  const dock = await sticky.boundingBox();
  expect(dock.x).toBeGreaterThanOrEqual(0);
  expect(dock.x + dock.width).toBeLessThanOrEqual(390);
  expect(dock.y + dock.height).toBeLessThanOrEqual(844);
  expect(dock.height).toBeGreaterThanOrEqual(44);

  async function placeContentUnderDock(selector) {
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      const rect = element.getBoundingClientRect();
      window.scrollBy(0, rect.top - (innerHeight - 58));
    }, selector);
    await expect(sticky).toBeHidden();
  }
  for (const selector of [
    '.wed-clip-toggle', '.wed-collection-card a', '.lp-faq-item summary',
    '.wed-collection-head h2', '.wed-collection-head > p',
    '.wed-proof-cake-visual', '.wed-collection-detail picture',
    '#wedStyles .lp-card picture'
  ]) {
    await placeContentUnderDock(selector);
  }

  await findSafeDock();
  await sticky.click();
  await expect(form).toBeInViewport();
  await expect(sticky).toBeHidden();

  await findSafeDock();
  const menu = page.locator('.wed-mobile-menu summary');
  await menu.click();
  await expect(sticky).toBeHidden();
  await menu.click();

  await page.locator('.landing-footer').scrollIntoViewIfNeeded();
  await expect(sticky).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('wedding mobile photo and video align, branded contacts remain touch accessible', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('milovi_analytics_consent_v1', 'granted'));
  for (const width of [320, 390, 560, 700]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const geometry = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const image = rect('.wed-proof-cake-visual');
      const video = rect('.wed-proof-video-frame');
      const caption = rect('.wed-proof-cake .wed-proof-caption');
      const frame = rect('.wed-proof-process');
      const groups = [...document.querySelectorAll('.wed-messenger-contact')];
      return {
        photoWidth: image.width, videoWidth: video.width, xGap: Math.abs(image.left - video.left),
        verticalGap: frame.top - caption.bottom, scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        groups: groups.map((group) => ({
          direction: getComputedStyle(group).flexDirection,
          columns: getComputedStyle(group.querySelector('.wed-contact-links')).gridTemplateColumns.split(' ').length,
          names: [...group.querySelectorAll('.wed-contact-brand-name')].map((name) => ({
            label: name.textContent.trim(),
            visible: getComputedStyle(name).display !== 'none',
          })),
          sizes: [...group.querySelectorAll('a.btn-hero-messenger')].map((el) => el.getBoundingClientRect().height),
        })),
      };
    });
    expect(Math.abs(geometry.photoWidth - geometry.videoWidth)).toBeLessThanOrEqual(1);
    expect(geometry.xGap).toBeLessThanOrEqual(1);
    expect(geometry.verticalGap).toBeGreaterThanOrEqual(25);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.groups).toHaveLength(2);
    for (const group of geometry.groups) {
      expect(group.direction).toBe('column');
      expect(group.columns).toBe(3);
      expect(group.names).toEqual([
        { label: 'WhatsApp', visible: true },
        { label: 'Telegram', visible: true },
        { label: 'MAX', visible: true },
      ]);
      expect(group.sizes.every((height) => height >= 44)).toBe(true);
    }
  }
});

test('wedding compact phones keep gallery, calculator and enquiry usable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('milovi_analytics_consent_v1', 'granted'));
  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });

    const layout = await page.evaluate(() => {
      const card = document.querySelector('.wed-collection-card').getBoundingClientRect();
      const calc = document.querySelector('.wed-calc').getBoundingClientRect();
      const grid = document.querySelector('.wed-collection-grid');
      const dock = document.querySelector('.wed-mobile-sticky');
      const kicker = document.querySelector('.wed-proof-head .wed-collection-kicker');
      const kickerStyle = getComputedStyle(kicker);
      const gridColumns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      // Measure the dock's true width without changing its normal visibility lifecycle.
      const wasHidden = dock.hidden;
      dock.hidden = false;
      const dockRect = dock.getBoundingClientRect();
      dock.hidden = wasHidden;
      return {
        cardWidth: card.width, calcWidth: calc.width, gridColumns,
        dockWidth: dockRect.width, dockLeft: dockRect.left, dockRight: dockRect.right,
        dockHeight: dockRect.height, scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        kickerHeight: kicker.getBoundingClientRect().height,
        kickerLineHeight: parseFloat(kickerStyle.lineHeight),
        kickerOverflow: kicker.scrollWidth - kicker.clientWidth,
      };
    });

    const compact = width <= 375;
    expect(layout.gridColumns).toBe(compact ? 1 : 2);
    if (compact) {
      expect(layout.cardWidth).toBeGreaterThanOrEqual(width - 48);
      expect(layout.calcWidth).toBeGreaterThanOrEqual(width - 85);
    }
    if (width <= 370) {
      expect(layout.kickerHeight).toBeLessThanOrEqual(layout.kickerLineHeight + 2);
      expect(layout.kickerOverflow).toBeLessThanOrEqual(1);
    }
    expect(layout.dockWidth).toBeLessThanOrEqual(240);
    expect(layout.dockHeight).toBeGreaterThanOrEqual(44);
    expect(layout.dockLeft).toBeGreaterThanOrEqual(0);
    expect(layout.dockRight).toBeLessThanOrEqual(width + 1);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  }
});

test('wedding touch layout keeps navigation and gallery return action accessible through tablet breakpoints', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('milovi_analytics_consent_v1', 'granted'));
  for (const width of [320, 390, 700, 768, 860]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });

    expect(await page.locator('.wed-proof-note a').count()).toBe(0);
    const backLink = page.locator('.wed-collection-backlink');
    await expect(backLink).toHaveAttribute('href', '#mediaShowcaseTitle');
    await expect(backLink).toContainText('Смотреть реальные работы');
    const geometry = await page.evaluate(() => {
      const selectors = [
        '.wed-wrap .landing-footer nav a',
        '.wed-wrap .landing-footer address a',
        '.wed-wrap .lp-related a',
        '.wed-wrap .mc-consent-trigger',
        '.wed-wrap .wed-collection-backlink',
      ];
      return {
        links: selectors.flatMap((selector) =>
          [...document.querySelectorAll(selector)].map((el) => ({
            selector, height: el.getBoundingClientRect().height,
            right: el.getBoundingClientRect().right,
          }))),
        returnDisplay: getComputedStyle(document.querySelector('.wed-collection-backlink')).display,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry.links.length).toBeGreaterThanOrEqual(15);
    for (const link of geometry.links) {
      expect(link.height, `${width}px ${link.selector}`).toBeGreaterThanOrEqual(44);
      expect(link.right, `${width}px ${link.selector}`).toBeLessThanOrEqual(width + 1);
    }
    expect(geometry.returnDisplay).toBe('flex');
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  }
});

test('wedding collection image sizes match compact one-column and regular two-column widths', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('milovi_analytics_consent_v1', 'granted'));
  for (const width of [320, 360, 370, 371, 375, 376, 390, 560, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveClass(/mc-fast-init/, { timeout: 3500 });
    const widths = await page.locator('.wed-collection-grid picture').evaluateAll((pictures) =>
      pictures.map((picture) => {
        const image = picture.querySelector('img');
        const avif = picture.querySelector('source[type="image/avif"]');
        const cssWidth = image.getBoundingClientRect().width;
        const expected = innerWidth <= 370 ? innerWidth - 40 : innerWidth <= 375 ? innerWidth - 48 : innerWidth / 2 - 30;
        return {
          cssWidth, expected,
          imageSizes: image.getAttribute('sizes'),
          avifSizes: avif.getAttribute('sizes'),
        };
      })
    );
    expect(widths).toHaveLength(4);
    for (const image of widths) {
      expect(Math.abs(image.cssWidth - image.expected), `CSS width at ${width}px`).toBeLessThanOrEqual(1);
      expect(image.imageSizes).toContain('(max-width: 370px) calc(100vw - 40px)');
      expect(image.imageSizes).toContain('(max-width: 375px) calc(100vw - 48px)');
      expect(image.avifSizes).toBe(image.imageSizes);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test('wedding video mutes when it leaves view and never resumes sound automatically', async ({ page }) => {
  await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
  const frame = page.locator('.wed-proof-video-frame');
  const video = frame.locator('video');
  const sound = frame.locator('.wed-clip-sound');
  await frame.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((element) => !element.paused), { timeout: 15000 }).toBe(true);
  await sound.click();
  await expect.poll(() => video.evaluate((element) => !element.muted)).toBe(true);
  await page.locator('.lp-final').scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((element) => element.paused && element.muted)).toBe(true);
  await frame.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((element) => !element.paused && element.muted),
    { timeout: 15000 }).toBe(true);
  await expect(sound).toHaveAttribute('aria-label', 'Включить звук');
});

test.describe('wedding contact without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('replaces the inert date submit with a direct WhatsApp contact', async ({ page }) => {
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
      const form = page.locator('#wedDateForm');
      await expect(form.locator('.wed-date-row')).toBeHidden();
      await expect(page.locator('#wedDateHint')).toBeHidden();
      const fallback = form.locator('.wed-date-nojs-link');
      await expect(fallback).toBeVisible();
      await expect(fallback).toHaveAttribute('target', '_blank');
      await expect(fallback).toHaveAttribute('rel', /noopener/);
      const address = new URL(await fallback.getAttribute('href'));
      expect(address.origin).toBe('https://wa.me');
      expect(address.pathname).toBe('/79119038886');
      expect(address.searchParams.get('text')).toContain('Дата свадьбы: ___');
      const bounds = await fallback.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
  });
});

test('wedding first-visit privacy modal receives focus and traps keyboard within its buttons', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('milovi_analytics_consent_v1'));
  await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
  const modal = page.getByRole('dialog', { name: 'Настройки аналитики' });
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute('aria-modal', 'true');
  const close = modal.getByRole('button', { name: 'Закрыть настройки конфиденциальности' });
  await expect.poll(() => page.evaluate(() =>
    document.activeElement?.classList.contains('mc-consent-close') || false
  ), { timeout: 5000 }).toBe(true);
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.mc-consent-dialog'))).toBe(true);
  }
  await close.click();
  await expect(modal).toBeHidden({ timeout: 3000 });
});

test('wedding contacts have valid named groups and blocked popup is announced', async ({ page }) => {
  await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('group', { name: 'Связаться с Milovi Cake' })).toHaveCount(2);
  await expect(page.getByRole('navigation', { name: 'Связанные разделы' })).toHaveCount(1);
  await expect(page.locator('#wedDateHint')).toHaveAttribute('aria-live', 'polite');
  await page.evaluate(() => { window.open = () => null; });
  await page.locator('#wedDate').evaluate((input) => input.form.requestSubmit());
  await expect(page.locator('#wedDateHint')).toContainText('заблокировал');
  await expect(page.locator('#wedDateFallback')).toBeVisible();
});

test('wedding document exposes main and footer as separate accessible landmarks', async ({ page }) => {
  await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  const footer = page.locator('footer.landing-footer');
  await expect(footer).toBeVisible();
  expect(await footer.evaluate((el) => el.closest('main'))).toBeNull();
  await expect(footer.locator('.wed-school-project-link'))
    .toHaveAttribute('href', 'https://french.milovicake.ru/');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
  }
});

const localFontPages = ['/o-konditere/', '/bento-torty/', '/svadebnye-torty/',
  '/zakazat-tort-spb/', '/dostavka-i-oplata/', '/otzyvy/'];

test('local landing fonts render without third-party font requests', async ({ page }) => {
  const externalFonts = [];
  const errors = [];
  page.on('request', (request) => {
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(request.url())) externalFonts.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of localFontPages) {
    await page.goto(path, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => [...document.fonts]
      .filter((face) => face.status === 'loaded').map((face) => face.family));
    expect(loaded, `${path}: loaded font families`).toContain('Cormorant Garamond');
    expect(loaded, `${path}: loaded font families`).toContain('Jost');
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(externalFonts).toEqual([]);
  expect(errors).toEqual([]);
});

test('landing content remains usable when local fonts fail', async ({ page }) => {
  await page.route('**/fonts/*.woff2', (route) => route.abort());
  await page.goto('/o-konditere/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toBeVisible();
  const themeButton = page.locator('.lp-theme-toggle');
  await expect(themeButton).toBeVisible();
  const before = await page.locator('html').getAttribute('data-theme');
  await themeButton.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before || '');
});

test('wedding editorial header and direct-contact panel keep one balanced visual hierarchy', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('milovi_analytics_consent_v1','denied'));
  for(const width of [320,360,390,430,600,768]){
    await page.setViewportSize({width,height:850});
    await page.goto('/svadebnye-torty/',{waitUntil:'domcontentloaded'});
    const g=await page.evaluate(()=>{
      const r=s=>document.querySelector(s).getBoundingClientRect();
      const border=s=>parseFloat(getComputedStyle(document.querySelector(s)).borderTopWidth);
      const logo=r('.wed-header .lp-logo'),theme=r('.wed-header .lp-theme-toggle'),menu=r('.wed-mobile-menu summary');
      return {
        view:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
        logoRight:logo.right,themeLeft:theme.left,themeRight:theme.right,
        menuLeft:menu.left,menuRight:menu.right,
        heroLinkUnderline:parseFloat(getComputedStyle(document.querySelector('.wed-hero-details > .wed-link')).borderBottomWidth),
        metaRule:border('.wed-meta'),
        contactGroup:document.querySelectorAll('.wed-messenger-contact').length,
        footerContact:document.querySelectorAll('.lp-final .wed-contact-links').length,
      };
    });
    expect(g.overflow).toBeLessThanOrEqual(1);
    expect(g.logoRight).toBeLessThanOrEqual(g.themeLeft-5);
    expect(g.menuLeft-g.themeRight).toBeGreaterThanOrEqual(4);
    expect(g.menuLeft-g.themeRight).toBeLessThanOrEqual(16);
    expect(g.menuRight).toBeLessThanOrEqual(g.view+1);
    expect(g.heroLinkUnderline).toBe(0);
    expect(g.metaRule).toBe(0);
    expect(g.contactGroup).toBe(2);
    expect(g.footerContact).toBe(0);
  }
});

test('wedding consultation preserves selection and offers equal messenger choice without repeated buttons', async ({page}) => {
  await page.goto('/svadebnye-torty/',{waitUntil:'domcontentloaded'});
  const cards=page.locator('.wed-collection-card a');
  await expect(cards).toHaveCount(4);
  await cards.nth(2).click();
  await expect(page).toHaveURL(/#wedBrief$/);
  await expect(page.locator('#wedSelectedStyle')).toContainText('Modern Sculptural');
  const wa=new URL(await page.locator('#wedBrief .btn-hero-wa').getAttribute('href'));
  expect(wa.searchParams.get('text')).toContain('Предпочтительный стиль: Modern Sculptural.');
  await cards.nth(0).click();
  const updated=new URL(await page.locator('#wedBrief .btn-hero-wa').getAttribute('href'));
  expect(updated.searchParams.get('text')).toContain('Предпочтительный стиль: Pure Ivory.');
  expect(updated.searchParams.get('text')).not.toContain('Modern Sculptural');
  await page.locator('.wed-tasting-link').click();
  const withTasting=new URL(await page.locator('#wedBrief .btn-hero-wa').getAttribute('href'));
  expect(withTasting.searchParams.get('text')).toContain('Предпочтительный стиль: Pure Ivory.');
  expect(withTasting.searchParams.get('text')).toContain('Интересует дегустационный сет начинок: да.');
  await cards.nth(1).click();
  const changedStyle=new URL(await page.locator('#wedBrief .btn-hero-wa').getAttribute('href'));
  expect(changedStyle.searchParams.get('text')).toContain('Предпочтительный стиль: Botanical Romance.');
  expect(changedStyle.searchParams.get('text')).not.toContain('Pure Ivory');
  expect(changedStyle.searchParams.get('text').match(/Интересует дегустационный сет начинок: да\./g)).toHaveLength(1);
  await expect(page.locator('#wedBrief .wed-contact-links a')).toHaveCount(3);
  await expect(page.locator('#wedTasting .lp-btn-primary')).toHaveCount(0);
  await expect(page.locator('.lp-final .wed-contact-links')).toHaveCount(0);
});


for (const availability of ['available', 'denied']) {
  test('wedding cross-channel draft preserves style, tasting and honest copy status (' + availability + ')', async ({page}) => {
    await page.addInitScript(mode => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async text => {
          window.__weddingClipboardWrites = (window.__weddingClipboardWrites || []).concat([text]);
          if (mode === 'denied') throw new Error('NotAllowedError');
        } }
      });
    }, availability);
    await page.setViewportSize({width:320,height:850});
    await page.goto('/svadebnye-torty/', {waitUntil:'domcontentloaded'});
    await page.locator('.wed-collection-card a[data-wed-style]').nth(1).click();
    await page.locator('.wed-tasting-link').click();
    await page.locator('#wedBrief .btn-hero-tg').click();
    const panel=page.locator('#wedBriefExport');
    const field=page.locator('#wedBriefExportText');
    await expect(panel).toBeVisible();
    await expect(page.locator('#wedBriefCopy')).toBeFocused();
    await expect(page.locator('#wedBriefOpen')).toHaveAttribute('href','https://t.me/+79119038886');
    await expect(page.locator('#wedBriefOpen')).toHaveAttribute('rel',/noopener/);
    await expect(field).toHaveValue(/Botanical Romance/);
    await expect(field).toHaveValue(/дегустационный сет/);
    const message=await field.inputValue();
    const wa=new URL(await page.locator('#wedBrief .btn-hero-wa').getAttribute('href'));
    expect(wa.searchParams.get('text')).toBe(message);
    await page.locator('#wedBriefCopy').click();
    if (availability === 'available') {
      await expect(page.locator('#wedBriefCopyStatus')).toContainText('Текст скопирован');
      expect(await page.evaluate(() => window.__weddingClipboardWrites)).toEqual([message]);
    } else {
      await expect(page.locator('#wedBriefCopyStatus')).toContainText('недоступно');
      expect(await field.evaluate(el => document.activeElement === el && el.selectionStart === 0 && el.selectionEnd === el.value.length)).toBe(true);
    }
    await page.locator('#wedBrief .btn-hero-max').click();
    await expect(page.locator('#wedBriefExportTitle')).toContainText('MAX');
    await expect(page.locator('#wedBriefOpen')).toHaveAttribute('href','https://max.ru/u/f9LHodD0cOIzRY9VJX8MoyR41H64ULjndbose2aPPrzXJDLW8QEiyKTpqxs');
    await expect(field).toHaveValue(message);
    await page.locator('.wed-collection-card a[data-wed-style]').nth(0).click();
    const updated=await field.inputValue();
    expect(updated).toContain('Pure Ivory');
    expect(updated).not.toContain('Botanical Romance');
    expect((updated.match(/Интересует дегустационный сет начинок: да\./g)||[])).toHaveLength(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('wedding WebKit decodes real moving frames from MP4-first sources', async ({page,browserName}) => {
  test.skip(browserName !== 'webkit', 'Safari-specific real-decoding contract');
  await page.goto('/svadebnye-torty/', {waitUntil:'domcontentloaded'});
  const video=page.locator('.wed-proof-video-frame video');
  const sources=video.locator('source');
  await expect(sources).toHaveCount(2);
  await expect(sources.nth(0)).toHaveAttribute('type','video/mp4');
  await expect(sources.nth(0)).toHaveAttribute('src','/img/gallery/videos/video-12-wedding-heart.mp4');
  await expect(sources.nth(1)).toHaveAttribute('type','video/webm');
  await expect(video).toHaveAttribute('preload','none');
  await expect(video).toHaveAttribute('poster','/img/gallery/video-12-wedding-heart-poster.webp');
  await video.scrollIntoViewIfNeeded();
  const frame=page.locator('.wed-proof-video-frame');
  await expect(frame.locator('.wed-clip-controls')).toBeVisible();
  // Explicit play remains available when autoplay is disallowed by the host.
  if (await video.evaluate(v=>v.paused)) await frame.locator('.wed-clip-toggle').click();
  await expect.poll(()=>video.evaluate(v=>v.readyState),{timeout:16000,intervals:[250,500,1000]}).toBeGreaterThanOrEqual(2);
  await expect.poll(()=>video.evaluate(v=>v.currentSrc),{timeout:10000}).toContain('video-12-wedding-heart.mp4');
  await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:12000}).toBeGreaterThan(0.25);
  const capture=()=>video.evaluate(v=>{
    if(v.readyState < 2) return null;
    const canvas=document.createElement('canvas');
    canvas.width=40;canvas.height=72;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx) throw new Error('Canvas 2D unavailable for decoding check');
    ctx.drawImage(v,0,0,40,72);
    const pixels=ctx.getImageData(0,0,40,72).data;
    let checksum=2166136261;
    for(let i=0;i<pixels.length;i+=5)checksum=Math.imul(checksum ^ pixels[i],16777619);
    return checksum>>>0;
  });
  const first=await capture();
  expect(first).not.toBeNull();
  await expect.poll(capture,{timeout:12000,intervals:[500,750,1000]}).not.toBe(first);
});

for (const order of ['date-first', 'style-first']) {
  test('wedding unified enquiry preserves date style and tasting (' + order + ')', async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem('milovi_analytics_consent_v1','denied');
      window.open = url => {window.__datePopup = url; return {opener:null};};
    });
    await page.setViewportSize({width:390,height:850});
    await page.goto('/svadebnye-torty/',{waitUntil:'domcontentloaded'});
    const input=page.locator('#wedDate');
    const minimum=await input.getAttribute('min');
    const chosen=await page.evaluate(min=>{
      const date=new Date(min+'T12:00:00');
      date.setDate(date.getDate()+7);
      return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
    },minimum);
    const chooseStyle=async()=>{
      await page.locator('.wed-collection-card a[data-wed-style]').nth(1).click();
      await page.locator('.wed-tasting-link').click();
    };
    if (order==='date-first') {await input.fill(chosen);await chooseStyle();}
    else {await chooseStyle();await input.fill(chosen);}
    await page.locator('#wedBrief .btn-hero-tg').click();
    const draft=page.locator('#wedBriefExportText');
    await expect(draft).toBeVisible();
    const text=await draft.inputValue();
    expect(text).toContain(chosen.slice(0,4));
    expect(text).toContain('Botanical Romance');
    expect(text).toContain('дегустационный сет');
    expect(text).not.toContain('Дата свадьбы: ___');
    const wa=new URL(await page.locator('#wedBrief .btn-hero-wa').getAttribute('href'));
    expect(wa.searchParams.get('text')).toBe(text);
    await page.locator('#wedBrief .btn-hero-max').click();
    await expect(draft).toHaveValue(text);
    await expect(page.locator('#wedBriefOpen')).toHaveAttribute('href','https://max.ru/u/f9LHodD0cOIzRY9VJX8MoyR41H64ULjndbose2aPPrzXJDLW8QEiyKTpqxs');
    await input.evaluate(el=>el.form.requestSubmit());
    const popup=await page.evaluate(()=>window.__datePopup);
    expect(popup).toBeTruthy();
    const submitted=new URL(popup).searchParams.get('text');
    expect(submitted).toContain(chosen.slice(0,4));
    expect(submitted).toContain('Botanical Romance');
    expect(submitted).toContain('дегустационный сет');
    await input.fill('');
    const cleared=await draft.inputValue();
    expect(cleared).toContain('Дата свадьбы: ___');
    expect(cleared).not.toBe(text);
    expect((cleared.match(/Предпочтительный стиль: /g)||[])).toHaveLength(1);
    await expect(page.locator('#wedBriefCopyStatus')).toContainText('Заявка изменена');
    await page.locator('#wedBrief .btn-hero-tg').click();
    await expect(draft).toHaveValue(cleared);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('wedding clipboard success invalidates after change and in-flight copy cannot lie', async ({page}) => {
  await page.addInitScript(()=>{
    localStorage.setItem('milovi_analytics_consent_v1','denied');
    window.__copyWrites=[];
    window.__copyPending=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      writeText:(text)=>new Promise(resolve=>{
        window.__copyWrites.push(text);
        window.__copyPending.push(resolve);
      })
    }});
  });
  await page.goto('/svadebnye-torty/',{waitUntil:'domcontentloaded'});
  await page.locator('.wed-collection-card a[data-wed-style]').nth(1).click();
  await page.locator('#wedBrief .btn-hero-tg').click();
  const field=page.locator('#wedBriefExportText'), copy=page.locator('#wedBriefCopy');
  const original=await field.inputValue();
  await copy.click();
  await copy.click(); // a second gesture must not issue a competing write
  expect(await page.evaluate(()=>window.__copyPending.length)).toBe(1);
  await expect(page.locator('#wedBriefCopyStatus')).toContainText('Копирование ещё выполняется');
  await page.evaluate(()=>window.__copyPending.shift()());
  await expect(page.locator('#wedBriefCopyStatus')).toContainText('Текст скопирован');
  await page.locator('.wed-collection-card a[data-wed-style]').nth(0).click();
  const updated=await field.inputValue();
  expect(updated).not.toBe(original);
  await expect(page.locator('#wedBriefCopyStatus')).toContainText('Заявка изменена');
  expect(await page.evaluate(()=>window.__copyWrites.at(-1))).toBe(original);

  await copy.click();
  await page.locator('.wed-collection-card a[data-wed-style]').nth(1).click();
  await page.evaluate(()=>window.__copyPending.shift()());
  await expect(page.locator('#wedBriefCopyStatus')).toContainText('Заявка изменилась');
  await expect(page.locator('#wedBriefCopyStatus')).not.toContainText('Текст скопирован');

  const latest=await field.inputValue();
  await copy.click();
  await page.evaluate(()=>window.__copyPending.shift()());
  await expect(page.locator('#wedBriefCopyStatus')).toContainText('Текст скопирован');
  expect(await page.evaluate(()=>window.__copyWrites.at(-1))).toBe(latest);
  expect((await page.evaluate(()=>window.__copyWrites)).length).toBe(3);
});
