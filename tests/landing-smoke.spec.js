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
    await expect(page.locator('img[src*="gallery-11.webp"]').first()).toBeVisible();
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

  test('wedding date form still opens a prefilled WhatsApp brief after the mobile layout change', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.open = (url) => { window.weddingHandoff = url; return null; };
    });
    await page.locator('#wedDate').fill('2026-12-12');
    await page.locator('.wed-date-form .wed-btn').click();
    const handoff = await page.evaluate(() => window.weddingHandoff);
    expect(handoff).toMatch(/^https:\/\/wa\.me\/79119038886\?text=/);
    expect(decodeURIComponent(handoff)).toContain('12 декабря 2026');
  });

  test('wedding guest calculator updates weight, tiers and budget on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    const guests = page.locator('#wedGuests');
    await guests.scrollIntoViewIfNeeded();
    await guests.focus();
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
