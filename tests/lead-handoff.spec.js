const { test, expect } = require('@playwright/test');

// The animated CTA moves under the pointer after validation; test the real
// keyboard/click handoff with the user's reduced-motion preference enabled.
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

async function watchHandoffs(page, consent = 'granted') {
  await page.addInitScript((choice) => {
    localStorage.setItem('milovi_analytics_consent_v1', choice);
    window.__goals = [];
    window.__opened = [];
    window.__allowPopup = true;
    window.gtag = (...args) => window.__goals.push(args);
    window.ym = () => {};
    window.open = (url) => {
      window.__opened.push(url);
      return window.__allowPopup ? {} : null;
    };
  }, consent);
  // Only the first-party event contract is under test, not third-party availability.
  await page.route(/(googletagmanager\.com|mc\.yandex\.ru)/, (route) => route.abort());
}

async function leads(page) {
  return page.evaluate(() => window.__goals
    .filter(([type, name]) => type === 'event' && name === 'generate_lead')
    .map(([, , params]) => params));
}

test('a contact click is not a lead; only validated, opened homepage/suburb forms count', async ({ page }) => {
  await watchHandoffs(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const link = document.querySelector('.site-footer a[href="https://wa.me/79119038886"]');
    link.addEventListener('click', (event) => event.preventDefault(), { once: true });
    link.click();
  });
  expect(await leads(page)).toEqual([]);
  expect(await page.evaluate(() => window.__goals.some(([type, name]) => type === 'event' && name === 'lp_wa_click'))).toBe(true);

  for (const route of ['/', '/prigorody/pushkin/']) {
    if (route !== '/') await page.goto(route, { waitUntil: 'domcontentloaded' });
    const form = page.locator('form:has(#fphone)');
    await form.locator('button[type="submit"]').click();
    await form.locator('#fphone').fill('123');
    await form.locator('button[type="submit"]').click();
    expect(await leads(page)).toEqual([]);
    expect(await page.evaluate(() => window.__opened)).toEqual([]);

    await form.locator('#fname').fill('Алиса');
    await form.locator('#fphone').fill('+7 911 555 44 33');
    await page.evaluate(() => { window.__allowPopup = false; });
    await form.locator('button[type="submit"]').click();
    expect(await leads(page)).toEqual([]);
    await page.evaluate(() => { window.__allowPopup = true; });
    await form.locator('button[type="submit"]').click();
    const observed = await leads(page);
    expect(observed).toEqual([{ path: route, lead_channel: 'whatsapp', lead_source: 'contact_form' }]);
    expect(JSON.stringify(observed)).not.toContain('Алиса');
    expect(JSON.stringify(observed)).not.toContain('555');
  }
});

test('wedding date form counts a lead only for a valid WhatsApp handoff', async ({ page }) => {
  await watchHandoffs(page);
  await page.goto('/svadebnye-torty/', { waitUntil: 'domcontentloaded' });
  const form = page.locator('.wed-date-form');
  await form.locator('#wedDate').fill('2020-01-01');
  await form.locator('button').click();
  expect(await leads(page)).toEqual([]);
  expect(await page.evaluate(() => window.__opened)).toEqual([]);

  await form.locator('#wedDate').fill('2030-06-18');
  await page.evaluate(() => { window.__allowPopup = false; });
  await form.locator('button').click();
  expect(await leads(page)).toEqual([]);
  await page.evaluate(() => { window.__allowPopup = true; });
  await form.locator('button').click();
  expect(await leads(page)).toEqual([{
    path: '/svadebnye-torty/', lead_channel: 'whatsapp', lead_source: 'wedding_date',
  }]);
  expect(await page.evaluate(() => window.__opened.at(-1))).toContain('wa.me/');
});

test('cart records each validated WhatsApp/Telegram handoff only when the tab opens', async ({ page }, testInfo) => {
  await watchHandoffs(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => addToCart(2));
  const trigger = page.locator(testInfo.project.name === 'chromium-mobile'
    ? '#mcNav .mc-btn--order' : '#cartBtn');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.locator('#cartStep1Footer button').click();
  await page.locator('#btnWA').click();
  expect(await leads(page)).toEqual([]);
  expect(await page.evaluate(() => window.__opened)).toEqual([]);

  await page.locator('#cphone').fill('+7 911 555 44 33');
  await page.evaluate(() => { window.__allowPopup = false; });
  await page.locator('#btnWA').click();
  expect(await leads(page)).toEqual([]);
  await page.evaluate(() => { window.__allowPopup = true; });
  await page.locator('#btnWA').click();
  expect(await leads(page)).toEqual([{ path: '/', lead_channel: 'whatsapp', lead_source: 'cart' }]);
  await page.locator('#btnTG').click();
  expect(await leads(page)).toEqual([
    { path: '/', lead_channel: 'whatsapp', lead_source: 'cart' },
    { path: '/', lead_channel: 'telegram', lead_source: 'cart' },
  ]);
});

test('denied consent suppresses lead events even for a real validated handoff', async ({ page }) => {
  await watchHandoffs(page, 'denied');
  await page.goto('/prigorody/pushkin/', { waitUntil: 'domcontentloaded' });
  const form = page.locator('form:has(#fphone)');
  await form.locator('#fphone').fill('+7 911 555 44 33');
  await form.locator('button[type="submit"]').click();
  expect(await page.evaluate(() => window.__opened)).toHaveLength(1);
  expect(await leads(page)).toEqual([]);
  expect(await page.locator('script[data-milovi-ga], script[data-milovi-ym]').count()).toBe(0);
});
