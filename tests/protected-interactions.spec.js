const { test, expect } = require('@playwright/test');

test.describe('protected homepage interactions', () => {
  test('hero messenger ring hover animation stays intact on desktop', async ({ page }, testInfo) => {
    if ((testInfo.project.name || '').includes('mobile')) test.skip(true, 'hover animation is desktop-only');

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const buttons = [
      { selector: '.btn-hero-wa', href: /wa\.me\/79119038886/, label: 'WhatsApp' },
      { selector: '.btn-hero-tg', href: /t\.me\//, label: 'Telegram' },
      { selector: '.btn-hero-max', href: /max\.ru\//, label: 'MAX' },
    ];

    for (const item of buttons) {
      const btn = page.locator(item.selector).first();
      await expect(btn, `${item.label} button visible`).toBeVisible();
      await expect(btn).toHaveAttribute('href', item.href);

      const flat = btn.locator('.hero-flat-text').first();
      const ring = btn.locator('.hero-ring-text').first();
      await expect(flat).toHaveCount(1);
      await expect(ring).toHaveCount(1);

      const before = await flat.evaluate((el) => ({ opacity: Number(el.getAttribute('opacity') || '0'), y: Number(el.getAttribute('y') || '0') }));
      expect(before.opacity).toBeLessThan(0.2);

      await btn.hover();
      await page.waitForTimeout(520);

      const hover = await flat.evaluate((el) => ({ opacity: Number(el.getAttribute('opacity') || '0'), y: Number(el.getAttribute('y') || '0'), size: Number(el.getAttribute('font-size') || '0') }));
      const ringHover = await ring.evaluate((el) => ({ opacity: Number(el.getAttribute('opacity') || '0'), transform: el.getAttribute('transform') || '' }));
      expect(hover.opacity, `${item.label} flat label opacity`).toBeGreaterThan(0.75);
      expect(hover.y, `${item.label} flat label flies upward`).toBeLessThan(0);
      expect(hover.size, `${item.label} flat label grows`).toBeGreaterThan(8);
      expect(ringHover.opacity, `${item.label} ring fades`).toBeLessThan(0.25);
      expect(ringHover.transform, `${item.label} ring moves`).toContain('translate');

      await page.mouse.move(20, 20);
      await page.waitForTimeout(520);
      const after = await flat.evaluate((el) => ({ opacity: Number(el.getAttribute('opacity') || '0'), y: Number(el.getAttribute('y') || '0') }));
      expect(after.opacity, `${item.label} flat label returns`).toBeLessThan(0.25);
      expect(after.y, `${item.label} y returns`).toBeGreaterThan(4);
    }
  });

  test('premium review carousel arrows, typewriter area and review modal work', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#reviews').scrollIntoViewIfNeeded();

    await expect.poll(async () => page.locator('#track .review-slide').count()).toBeGreaterThan(1);
    const activeIndex = async () => page.locator('#track .review-slide').evaluateAll((slides) => slides.findIndex((s) => s.classList.contains('active')));

    const first = await activeIndex();
    await page.locator('#btnNext').click();
    await page.waitForTimeout(750);
    const second = await activeIndex();
    expect(second).not.toBe(first);

    await page.locator('#btnPrev').click();
    await page.waitForTimeout(750);
    const third = await activeIndex();
    expect(third).toBe(first);

    await page.locator('.map-badge-yandex').click();
    const modal = page.locator('#reviewsModal');
    await expect(modal).toHaveClass(/open/);
    await expect(page.locator('#reviewsYandex')).toBeVisible();
    await page.locator('#tabGoogle').click();
    await expect(page.locator('#reviewsGoogle')).toBeVisible();
    await page.locator('.reviews-modal-close').click();
    await expect(modal).not.toHaveClass(/open/);
  });
});

test.describe('premium baseline consolidation contracts', () => {
  test('privacy defaults locally to denied without an automatic popup and remains user-configurable', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('milovi_analytics_consent_v1'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect.poll(async () => page.evaluate(() => window.MiloviConsent && window.MiloviConsent.getChoice())).toBe('denied');
    const overlay = page.locator('.mc-consent-overlay');
    await expect(overlay).toHaveAttribute('hidden', '');
    await expect(overlay).not.toHaveClass(/is-open/);

    await page.evaluate(() => window.MiloviConsent.open());
    await expect(overlay).toHaveClass(/is-open/);
    await expect(page.locator('#mc-consent-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/is-open/);
  });

  test('review and calculator controls keep explicit accessible names', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#tabYandex')).toHaveAttribute('aria-label', 'Отзывы на Яндекс Картах');
    await expect(page.locator('#tabGoogle')).toHaveAttribute('aria-label', 'Отзывы на Google Картах');
    await expect(page.locator('#calcWeight')).toHaveAttribute('aria-label', 'Вес торта в килограммах');
  });

  test('back-to-top keeps script-owned smooth scrolling and footer collision state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const backToTop = page.locator('#backToTop, .back-to-top').first();
    await expect(backToTop).toHaveCount(1);
    await expect(backToTop).not.toHaveAttribute('onclick', /.+/);

    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await expect.poll(async () => backToTop.evaluate((el) => el.classList.contains('footer-clearance'))).toBeTruthy();
  });

  test('mobile app bar and sheet preserve closed/open visibility contract', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const nav = page.locator('#mcNav');
    const sheet = page.locator('#mcSheet');
    const more = page.locator('#mcMoreBtn');
    await expect(nav).toBeVisible();
    await expect(sheet).toHaveCount(1);

    const closed = await sheet.evaluate((el) => {
      const css = getComputedStyle(el);
      return { visibility: css.visibility, opacity: css.opacity, pointerEvents: css.pointerEvents };
    });
    expect(closed.visibility).toBe('hidden');
    expect(Number(closed.opacity)).toBe(0);
    expect(closed.pointerEvents).toBe('none');

    await more.click();
    await expect(sheet).toHaveClass(/mc-open/);
    const opened = await sheet.evaluate((el) => {
      const css = getComputedStyle(el);
      return { visibility: css.visibility, opacity: css.opacity, pointerEvents: css.pointerEvents };
    });
    expect(opened.visibility).toBe('visible');
    expect(Number(opened.opacity)).toBeGreaterThan(0.9);
    expect(opened.pointerEvents).toBe('auto');

    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveClass(/mc-open/);
  });
});

test.describe('landing page interactive basics', () => {
  test('FAQ details and media controls are interactive on wedding page', async ({ page }) => {
    await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });

    const firstFaq = page.locator('.lp-faq-item').first();
    await expect(firstFaq).not.toHaveAttribute('open', '');
    await firstFaq.locator('summary').click();
    await expect(firstFaq).toHaveAttribute('open', '');

    const video = page.locator('.lp-media-showcase video').first();
    await expect(video).toBeVisible();
    await video.evaluate((el) => el.play().catch(() => {}));
    await expect.poll(async () => video.evaluate((el) => el.paused)).toBeFalsy();
    await video.evaluate((el) => el.pause());
  });
});
