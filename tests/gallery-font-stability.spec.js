const { test, expect } = require('@playwright/test');

test('gallery typography cannot trigger a late Google Fonts layout swap', async ({ page }) => {
  const remoteFontRequests = [];
  page.on('request', (request) => {
    if (/fonts\.(?:googleapis|gstatic)\.com/i.test(request.url())) {
      remoteFontRequests.push(request.url());
    }
  });

  await page.goto('/gallery/', { waitUntil: 'networkidle' });

  await expect(page.locator('#gallery-stable-fonts')).toHaveCount(1);
  expect(remoteFontRequests).toEqual([]);

  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector('.gx-heading')).fontFamily,
    seoHeading: getComputedStyle(document.querySelector('.gx-seo-panel h2')).fontFamily,
  }));

  expect(fonts.body).not.toMatch(/Jost/i);
  expect(fonts.heading).not.toMatch(/Cormorant Garamond/i);
  expect(fonts.seoHeading).not.toMatch(/Cormorant Garamond/i);
});
