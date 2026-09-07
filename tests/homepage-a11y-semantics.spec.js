const { test, expect } = require('@playwright/test');

test('homepage component semantics match their visible controls', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const videoStrip = page.locator('#mcVideoStrip');
  await expect(videoStrip).toHaveCount(1);
  await expect(videoStrip).not.toHaveAttribute('role', 'list');

  const videoTiles = page.locator('#mcVideoTrack a.vtile');
  await expect(videoTiles).toHaveCount(32);
  await expect(page.locator('#mcVideoTrack a.vtile[role="listitem"]')).toHaveCount(0);
  expect(await videoTiles.locator('img').evaluateAll((images) => images.map((img) => img.getAttribute('alt'))))
    .toEqual(Array(32).fill(''));

  const catalogItems = page.locator('.catalog-nav-item');
  await expect(catalogItems).toHaveCount(6);
  expect(await catalogItems.evaluateAll((items) => items.map((item) => ({
    ariaLabel: item.getAttribute('aria-label'),
    text: (item.textContent || '').replace(/\s+/g, ' ').trim(),
  })))).toEqual(expect.arrayContaining([
    expect.objectContaining({ ariaLabel: null }),
  ]));
  expect(await catalogItems.evaluateAll((items) => items.every((item) =>
    !item.hasAttribute('aria-label') && (item.textContent || '').trim().length > 0
  ))).toBe(true);

  const faqItems = page.locator('.cb-faq-item');
  await expect(faqItems).toHaveCount(9);
  const faqSemantics = await faqItems.evaluateAll((items) => items.map((item) => ({
    role: item.getAttribute('role'),
    expanded: item.getAttribute('aria-expanded'),
    label: item.getAttribute('aria-label'),
    question: ((item.querySelector('.cb-faq-q span') || item.querySelector('.cb-faq-q'))?.textContent || '')
      .replace(/\s+/g, ' ').trim(),
  })));
  for (const item of faqSemantics) {
    expect(item.role).toBe('button');
    expect(item.expanded).toBe('false');
    expect(item.label).toBe(item.question);
    expect(item.label.length).toBeGreaterThan(0);
  }

  await faqItems.nth(0).click();
  await expect(faqItems.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await faqItems.nth(1).click();
  await expect(faqItems.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(faqItems.nth(1)).toHaveAttribute('aria-expanded', 'true');
});
