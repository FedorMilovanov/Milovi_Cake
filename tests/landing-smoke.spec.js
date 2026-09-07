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
  test('wedding page has editorial blocks and real portfolio media', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.bridal-editorial')).toBeVisible();
    await expect(page.locator('.bridal-route')).toBeVisible();
    await expect(page.locator('.bridal-callout')).toBeVisible();
    await expect(page.locator('.lp-media-showcase')).toBeVisible();
    await expect(page.locator('video source[src*="video-12-wedding-heart.webm"]')).toHaveCount(1);
    await expect(page.locator('img[src*="gallery-11.webp"]').first()).toBeVisible();
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

  test('Gatchina primary warning CTA remains WCAG AA', async ({ page }) => {
    await useLightTheme(page);
    await page.goto('/prigorody/gatchina/', { waitUntil: 'domcontentloaded' });
    await assertContrast(page, '.btn-primary.btn-warn');
  });
});
