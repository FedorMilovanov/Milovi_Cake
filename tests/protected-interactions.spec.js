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
