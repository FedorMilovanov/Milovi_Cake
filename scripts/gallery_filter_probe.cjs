// Measure real filter-transition events without changing page state or styles.
// This is an optional CI diagnostic, not a replacement for the primary tests.
const { chromium, webkit } = require('playwright');
const http = require('node:http');

const engine = process.env.MILOVI_FILTER_ENGINE || 'webkit';
const variant = process.env.MILOVI_FILTER_VARIANT || 'original';
const origin = process.env.MILOVI_FILTER_ORIGIN || 'http://127.0.0.1:4173';
const annotationValue = (value) => String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = await new Promise((resolve) => {
      const request = http.get(`${origin}/gallery/`, (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      });
      request.on('error', () => resolve(false));
      request.setTimeout(500, () => request.destroy());
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Gallery server did not become ready with HTTP 200');
}

(async () => {
  if (!['chromium', 'webkit'].includes(engine)) throw new Error(`Unknown engine: ${engine}`);
  if (!['original', 'no-filter-interpolation'].includes(variant)) throw new Error(`Unknown variant: ${variant}`);
  await waitForServer();
  if (process.env.MILOVI_FILTER_SERVER_PID) {
    // A port collision must not silently turn a comparison into a probe of an
    // unrelated server. The workflow starts this process for this exact site.
    process.kill(Number(process.env.MILOVI_FILTER_SERVER_PID), 0);
  }
  const browser = await { chromium, webkit }[engine].launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('milovi_analytics_consent_v1', 'denied');
      window.__galleryFilterEvents = [];
      document.addEventListener('transitionrun', (event) => {
        if (event.propertyName === 'filter' && event.target.closest('#galleryGrid, #lbRoot')) {
          window.__galleryFilterEvents.push({ target: String(event.target.className), time: performance.now() });
        }
      }, true);
    });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    const response = await page.goto(`${origin}/gallery/`, { waitUntil: 'load' });
    if (!response || response.status() !== 200) throw new Error('Gallery HTTP response was not 200');
    const card = page.locator('#galleryGrid [data-id="p01"]');
    await card.hover();
    await page.waitForTimeout(1400); // Observe the real hover transition through its natural duration.
    const hover = await page.evaluate(() => ({
      supportsHover: matchMedia('(hover: hover) and (pointer: fine)').matches,
      eventCount: window.__galleryFilterEvents.length,
      peerFilter: getComputedStyle(document.querySelector('#galleryGrid [data-id="v01"]')).filter,
      peerTransitions: getComputedStyle(document.querySelector('#galleryGrid [data-id="v01"]')).transitionProperty,
    }));
    await card.click();
    await page.locator('#lbNext').click();
    await page.waitForTimeout(1400);
    const lightbox = await page.evaluate(() => ({
      eventCount: window.__galleryFilterEvents.length,
      mediaFilter: getComputedStyle(document.querySelector('#lbWrapper .swiper-slide-active .lb-media')).filter,
      mediaTransitions: getComputedStyle(document.querySelector('#lbWrapper .swiper-slide-active .lb-media')).transitionProperty,
      counter: document.querySelector('#lbCounter').textContent,
    }));
    const evidence = { engine, variant, hover, lightbox, errors };
    console.log(`::notice title=Gallery filter precondition::${annotationValue(JSON.stringify(evidence))}`);
    if (!hover.supportsHover || !hover.peerFilter.includes('blur(')) throw new Error('Real hover effect was not observed');
    if (lightbox.counter !== '02 / 46' || errors.length) throw new Error('Gallery interaction or page errors invalidated the probe');
    if (variant === 'original' && lightbox.eventCount === 0) throw new Error('No filter transition observed in the original variant');
    if (variant === 'no-filter-interpolation' && lightbox.eventCount !== 0) throw new Error('The experimental variant still emitted filter transitions');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`::error title=Gallery filter probe::${annotationValue(error.stack || error.message)}`);
  process.exitCode = 1;
});
