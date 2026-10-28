// Failure-only browser comparison: observe real scroll, lightbox and reloads.
// This does not alter media, observers, or measured state in the page.
const { chromium, devices, webkit } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');

const engine = process.env.MILOVI_MEDIA_ENGINE || 'webkit';
const variant = process.env.MILOVI_MEDIA_VARIANT || 'original';
const origin = process.env.MILOVI_MEDIA_ORIGIN || 'http://127.0.0.1:4173';
const escapeAnnotation = (value) => String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

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

async function snapshot(page) {
  return page.evaluate(() => {
    const videos = [...document.querySelectorAll('#galleryGrid video')];
    const state = (video) => ({
      id: video.closest('[data-id]')?.dataset.id,
      src: video.hasAttribute('src'),
      paused: video.paused,
      readyState: video.readyState,
      buffered: video.buffered.length,
      currentTime: Math.round(video.currentTime * 100) / 100,
      error: video.error?.code || null,
    });
    const rows = videos.map(state);
    const active = document.querySelector('#lbWrapper .swiper-slide-active video');
    return {
      scrollY: Math.round(scrollY),
      sources: rows.filter((video) => video.src).length,
      playing: rows.filter((video) => !video.paused).length,
      buffered: rows.filter((video) => video.buffered > 0).length,
      first: rows.find((video) => video.id === 'v01'),
      later: rows.find((video) => video.id === 'v08'),
      lightboxVideo: active ? state(active) : null,
      mediaErrors: window.__galleryMediaErrors,
    };
  });
}

async function waitUntilPlaying(page, id) {
  await page.waitForFunction((cardId) => {
    const videos = [...document.querySelectorAll('#galleryGrid [data-id] video')];
    return videos.some((video) => (!cardId || video.closest('[data-id]').dataset.id === cardId) &&
      video.hasAttribute('src') && !video.paused && video.readyState >= 2 && video.buffered.length > 0);
  }, id, { timeout: 15000 });
}

async function measure(browser, kind) {
  const device = kind === 'desktop'
    ? { ...devices[engine === 'webkit' ? 'Desktop Safari' : 'Desktop Chrome'], viewport: { width: 1440, height: 1100 } }
    : { ...devices[engine === 'webkit' ? 'iPhone 13' : 'Pixel 7'], viewport: { width: 390, height: 844 } };
  const storageState = JSON.parse(fs.readFileSync('tests/analytics-denied.storage-state.json', 'utf8'));
  storageState.origins[0].origin = new URL(origin).origin;
  const context = await browser.newContext({ ...device, storageState, serviceWorkers: 'block' });
  const evidence = { engine, variant, kind, phases: {}, requests: 0, requestFailures: [], pageErrors: [] };
  const imageRequests = new Map();
  let page;
  try {
    page = await context.newPage();
    page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
    page.on('request', (request) => {
      if (request.url().includes('/img/gallery/videos/')) evidence.requests++;
      const path = new URL(request.url()).pathname;
      if (/^\/img\/gallery\/.*\.(avif|webp)$/.test(path)) {
        imageRequests.set(path, (imageRequests.get(path) || 0) + 1);
      }
    });
    page.on('requestfailed', (request) => {
      if (request.url().includes('/img/gallery/videos/')) evidence.requestFailures.push(request.failure()?.errorText || 'unknown');
    });
    await page.addInitScript(() => {
      window.__galleryMediaErrors = [];
      document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('#galleryGrid [data-id]')) {
          window.__galleryClickScroll = scrollY;
        }
      }, true);
      document.addEventListener('error', (event) => {
        if (event.target instanceof HTMLMediaElement) {
          window.__galleryMediaErrors.push({
            id: event.target.closest('[data-id]')?.dataset.id || 'lightbox',
            code: event.target.error?.code || null,
          });
        }
      }, true);
    });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    const response = await page.goto(`${origin}/gallery/`, { waitUntil: 'load' });
    if (!response || response.status() !== 200) throw new Error('Gallery HTTP response was not 200');
    await waitUntilPlaying(page, 'v01');
    evidence.phases.initial = await snapshot(page);

    await page.locator('#galleryGrid [data-id="v08"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const first = document.querySelector('#galleryGrid [data-id="v01"] video');
      return first && first.getBoundingClientRect().bottom < -200 && first.paused;
    }, null, { timeout: 15000 });
    await waitUntilPlaying(page, null);
    if (variant === 'release-grid-media') {
      await page.waitForFunction(() => {
        const first = document.querySelector('#galleryGrid [data-id="v01"] video');
        return first && !first.hasAttribute('src') && first.readyState === 0 && first.buffered.length === 0;
      }, null, { timeout: 15000 });
    }
    evidence.phases.scrolled = await snapshot(page);
    if (variant === 'original' && !evidence.phases.scrolled.first.src) {
      throw new Error('The original source was already released; comparison precondition is absent');
    }

    await page.locator('#galleryGrid [data-id="v08"]').click();
    const scrollBeforeOpen = await page.evaluate(() => window.__galleryClickScroll);
    if (!Number.isFinite(scrollBeforeOpen)) throw new Error('Could not observe scroll position at the gallery click');
    await page.locator('#lbRoot').waitFor({ state: 'visible' });
    await page.waitForFunction((release) => {
      const videos = [...document.querySelectorAll('#galleryGrid video')];
      return videos.length > 0 && videos.every((video) => video.paused &&
        (!release || (!video.hasAttribute('src') && video.readyState === 0 && video.buffered.length === 0)));
    }, variant === 'release-grid-media', { timeout: 15000 });
    await page.waitForFunction(() => {
      const video = document.querySelector('#lbWrapper .swiper-slide-active video');
      return video && !video.paused && video.readyState >= 2 && video.buffered.length > 0;
    }, null, { timeout: 15000 });
    evidence.phases.lightbox = await snapshot(page);
    if (variant === 'original' && evidence.phases.lightbox.sources === 0) {
      throw new Error('The original lightbox retained no grid sources; comparison precondition is absent');
    }
    await page.locator('#lbClose').click();
    await page.locator('#lbRoot').waitFor({ state: 'hidden' });
    // Unlocking can scroll smoothly; wait for the real restoration before
    // sending another user scroll rather than interrupting that transition.
    await page.waitForFunction((y) => Math.abs(scrollY - y) < 5, scrollBeforeOpen, { timeout: 15000 });
    await waitUntilPlaying(page, null);
    evidence.phases.closed = await snapshot(page);

    await page.locator('.gx-back-link').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => scrollY < 200, null, { timeout: 15000 });
    await waitUntilPlaying(page, 'v01');
    evidence.phases.returned = await snapshot(page);
    const unexpectedRequests = evidence.requestFailures.filter((failure) => !/abort|cancel|interrupt/i.test(failure));
    if (evidence.pageErrors.length || evidence.phases.returned.mediaErrors.length || unexpectedRequests.length) {
      throw new Error('Unexpected page, media, or video-request errors');
    }
    console.log(`::notice title=Gallery media lifecycle::${escapeAnnotation(JSON.stringify(evidence))}`);
  } catch (error) {
    evidence.repeatedImages = [...imageRequests.entries()].filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (page && !page.isClosed()) {
      try { evidence.last = await snapshot(page); } catch (snapshotError) { evidence.snapshotError = snapshotError.message; }
    }
    console.error(`::error title=Gallery media lifecycle evidence::${escapeAnnotation(JSON.stringify(evidence))}`);
    throw error;
  } finally {
    await context.close();
  }
}

(async () => {
  if (!['chromium', 'webkit'].includes(engine)) throw new Error(`Unknown engine: ${engine}`);
  if (!['original', 'release-grid-media'].includes(variant)) throw new Error(`Unknown variant: ${variant}`);
  await waitForServer();
  if (process.env.MILOVI_MEDIA_SERVER_PID) process.kill(Number(process.env.MILOVI_MEDIA_SERVER_PID), 0);
  const browser = await { chromium, webkit }[engine].launch();
  try {
    await measure(browser, 'desktop');
    await measure(browser, 'mobile');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`::error title=Gallery media probe::${escapeAnnotation(error.stack || error.message)}`);
  process.exitCode = 1;
});
