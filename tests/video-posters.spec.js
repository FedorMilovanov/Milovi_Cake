const { test, expect } = require('@playwright/test');

// A crash may be caused by the engine or its environment. Record actual
// cgroup/process evidence at the time of failure instead of assuming OOM.
function browserCrashResources() {
  const fs = require('node:fs');
  const { execFileSync } = require('node:child_process');
  const read = (path) => { try { return fs.readFileSync(path, 'utf8').trim(); } catch { return 'unavailable'; } };
  let processes;
  try { processes = execFileSync('ps', ['-eo', 'pid,rss,comm', '--sort=-rss'], { timeout: 2000, encoding: 'utf8' }).split('\n').slice(0, 16); }
  catch { processes = ['unavailable']; }
  return {
    memoryCurrent: read('/sys/fs/cgroup/memory.current'), memoryPeak: read('/sys/fs/cgroup/memory.peak'),
    memoryMax: read('/sys/fs/cgroup/memory.max'), memoryEvents: read('/sys/fs/cgroup/memory.events'),
    memoryPressure: read('/sys/fs/cgroup/memory.pressure'),
    meminfo: read('/proc/meminfo').split('\n').slice(0, 5), processes,
  };
}

test('all gallery clips show their own lightweight, decodable frame before playback', async ({ page, request }) => {
  await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
  const reels = await page.evaluate(async () => {
    const { GALLERY_ITEMS } = await import('/js/gallery/data.js?v=20261026r01');
    return GALLERY_ITEMS.filter(({ type }) => type === 'video');
  });
  expect(reels).toHaveLength(16);
  const reviewed = Object.fromEntries(reels.map((item) => [item.id, item]));
  // The real footage shows éclairs, not a meringue roll; the pink cupcakes
  // have buttercream but no visible berries. Filenames/tags are not evidence.
  expect(reviewed.v04.title.toLowerCase()).toContain('эклер');
  expect(reviewed.v04.tags).not.toContain('meringue');
  expect(reviewed.v09.title.toLowerCase()).not.toContain('ягод');
  for (const reel of reels) {
    expect(reel.poster).toBe(reel.src.replace('/videos/', '/').replace('.webm', '-poster.webp'));
    const response = await request.get(reel.poster);
    expect(response.ok(), reel.poster).toBe(true);
    const buffer = await response.body();
    expect(buffer.subarray(0, 4).toString()).toBe('RIFF');
    expect(buffer.subarray(8, 12).toString()).toBe('WEBP');
    expect(buffer.length, reel.poster).toBeLessThan(70_000);
    const dimensions = await page.evaluate((url) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
      image.onerror = reject;
      image.src = url;
    }), reel.poster);
    expect(dimensions[0], reel.poster).toBeGreaterThanOrEqual(320);
    expect(dimensions[1], reel.poster).toBeGreaterThan(dimensions[0]);
  }
  // The public card, not just metadata, must use the real video's own poster.
  const card = page.locator('#galleryGrid [data-id="v01"] video');
  await expect(card).toHaveAttribute('poster', '/img/gallery/video-01-knigi-poster.webp');
});

// This small test double verifies the loading lifecycle without depending on CDN
// availability in CI. Real Swiper is also exercised separately in browser QA.
const swiperStub = `
  window.Swiper = class {
    constructor(selector, options) {
      this.el = document.querySelector(selector);
      this.options = options;
      this.activeIndex = options.initialSlide;
      this.el.classList.add('swiper-initialized');
      this.mark();
      options.on.afterInit.call(this);
    }
    mark() { this.el.querySelectorAll('.swiper-slide').forEach((s, i) => s.classList.toggle('swiper-slide-active', i === this.activeIndex)); }
    slideTo(index) { this.activeIndex = index; this.mark(); this.options.on.slideChange.call(this); }
    update() {}
    destroy() { this.el.classList.remove('swiper-initialized'); }
  };
`;
const swiperCss = '.swiper-wrapper{display:flex;width:100%;height:100%}.swiper-slide{flex-shrink:0}';

async function enlargeCaptionText(page) {
  // Simulate 200% text-only zoom without changing layout or scroll positions.
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll('.lb-info, .lb-info *')];
    const sizes = elements.map((element) => parseFloat(getComputedStyle(element).fontSize));
    elements.forEach((element, index) => { element.style.fontSize = `${sizes[index] * 2}px`; });
  });
}

test.describe('gallery lightbox with missing or late CDN assets', () => {
  test.use({ serviceWorkers: 'block' });

  test('fallback supports buttons, thumbnails, keyboard and focus return without CDN', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
    const card = page.locator('#galleryGrid [data-id="p01"]');
    await card.focus();
    await card.press('Enter');
    await expect(page.locator('#lbCounter')).toHaveText('01 / 46');
    await expect(page.locator('#lbWrapper .swiper-slide-active')).toHaveCount(1);
    await expect(page.locator('#lbWrapper .swiper-slide').nth(0)).toBeVisible();
    await expect(page.locator('#lbWrapper .swiper-slide').nth(1)).toBeHidden();
    await page.locator('#lbNext').click();
    await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
    await expect(page.locator('#lbWrapper .swiper-slide').nth(1)).toBeVisible();
    await page.locator('#lbThumbs .lb-thumb').nth(5).click();
    await expect(page.locator('#lbCounter')).toHaveText('06 / 46');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#lbCounter')).toHaveText('05 / 46');
    await page.keyboard.press('Escape');
    await expect(page.locator('#lbRoot')).toHaveCount(0);
    await expect(card).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('late gallery load does not restart grid videos behind the open lightbox', async ({ page }) => {
    // This race is only observable when grid autoplay is permitted.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    let releaseImage;
    let blockedImages = 0;
    const imageGate = new Promise((resolve) => { releaseImage = resolve; });
    // A slow first image keeps the real load event pending without changing
    // the gallery, its observer, or any video state.
    await page.route(/\/img\/gallery\/gallery-01\.(avif|webp)$/, async (route) => {
      blockedImages++;
      await imageGate;
      await route.continue().catch(() => {});
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      const response = await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
      expect(response.status()).toBe(200);
      await page.locator('#galleryGrid [data-id="v01"]').click();
      await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
      await expect(page.locator('#lbWrapper .swiper-slide-active video')).toBeVisible();
      await expect(page.locator('#galleryGrid')).not.toHaveAttribute('data-hydrating', 'true');
      expect(blockedImages).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.readyState)).not.toBe('complete');
      const gridVideos = page.locator('#galleryGrid video');
      expect(await gridVideos.evaluateAll((videos) => videos.filter((video) => video.hasAttribute('src')).length)).toBe(0);

      releaseImage();
      await page.waitForLoadState('load');
      // Observe the negative condition after the load and observer callbacks.
      await page.waitForTimeout(2000);
      expect(await gridVideos.evaluateAll((videos) => videos.filter((video) => video.hasAttribute('src') || !video.paused).length)).toBe(0);
      await page.locator('#lbClose').click();
      await expect(page.locator('#galleryGrid [data-id="v01"] video')).toHaveAttribute('src', /video-01-knigi\.webm/);
      expect(errors).toEqual([]);
    } catch (error) {
      // Keep the assertion and the gated image unchanged. If it fails, capture
      // whether the main thread and animation frames are still progressing.
      let snapshotTimer;
      const snapshot = await Promise.race([
        page.evaluate(async () => {
          const grid = document.querySelector('#galleryGrid');
          const active = document.querySelector('#lbWrapper .swiper-slide-active video');
          const details = {
            readyState: document.readyState, visibility: document.visibilityState,
            hydrating: grid?.getAttribute('data-hydrating'), cards: grid?.children.length,
            total: document.querySelector('#gxTotalCount')?.textContent,
            gridVideosWithSource: grid?.querySelectorAll('video[src]').length,
            activeVideoPaused: active?.paused ?? null,
          };
          let frames = 0, done = false;
          const tick = () => { frames++; if (!done) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
          await new Promise((resolve) => setTimeout(resolve, 750));
          done = true;
          return { ...details, animationFramesIn750ms: frames };
        }).catch((failure) => ({ snapshotError: String(failure) })),
        new Promise((resolve) => { snapshotTimer = setTimeout(() => resolve({ snapshotError: 'page did not respond within 2.5s' }), 2500); }),
      ]);
      clearTimeout(snapshotTimer);
      throw new Error(`${error.message}\nGallery hydration diagnostics: ${JSON.stringify({ blockedImages, snapshot, errors })}`, { cause: error });
    } finally {
      releaseImage();
    }
  });

  test('queued grid observer callbacks do not restart video after opening', async ({ page }) => {
    // This race is only observable when grid autoplay is permitted.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    // Hold real intersection entries until after the user's click, modelling
    // a callback already queued when the lightbox disconnects the observer.
    await page.addInitScript(() => {
      const NativeObserver = window.IntersectionObserver;
      const gate = window.__galleryObserverGate = { pending: [], hold: true };
      window.IntersectionObserver = class extends NativeObserver {
        constructor(callback, options) {
          super((entries, observer) => {
            if (gate.hold && entries.some((entry) => entry.isIntersecting && entry.target.closest('#galleryGrid'))) {
              gate.pending.push(() => callback(entries, observer));
            } else callback(entries, observer);
          }, options);
        }
      };
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto('/gallery/', { waitUntil: 'load' });
    expect(response.status()).toBe(200);
    const card = page.locator('#galleryGrid [data-id="v01"]');
    await card.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__galleryObserverGate.pending.length > 0);
    await card.click();
    await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
    const gridVideos = page.locator('#galleryGrid video');
    expect(await gridVideos.evaluateAll((videos) => videos.filter((video) => video.hasAttribute('src')).length)).toBe(0);
    await page.evaluate(() => {
      const gate = window.__galleryObserverGate;
      gate.hold = false;
      gate.pending.splice(0).forEach((deliver) => deliver());
    });
    expect(await gridVideos.evaluateAll((videos) => videos.filter((video) => video.hasAttribute('src') || !video.paused).length)).toBe(0);
    await page.locator('#lbClose').click();
    await expect(card.locator('video')).toHaveAttribute('src', /video-01-knigi\.webm/);
    expect(errors).toEqual([]);
  });

  for (const legacyListener of [false, true]) {
    test(`gallery grid respects changing reduced-motion preference (${legacyListener ? 'legacy' : 'modern'} listener)`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
      if (legacyListener) {
        // Safari before 14 exposes addListener, but not addEventListener, on MediaQueryList.
        await page.addInitScript(() => {
          const nativeMatchMedia = window.matchMedia.bind(window);
          window.matchMedia = (query) => {
            const list = nativeMatchMedia(query);
            if (query === '(prefers-reduced-motion: reduce)') {
              Object.defineProperty(list, 'addEventListener', { value: undefined });
            }
            return list;
          };
        });
      }
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto('/gallery/', { waitUntil: 'load' });
      expect(response.status()).toBe(200);
      await expect(page.locator('#galleryGrid')).not.toHaveAttribute('data-hydrating', 'true');
      const gridVideos = page.locator('#galleryGrid video');
      await expect(gridVideos).toHaveCount(16);
      // Observe past the initial intersection delivery, not just the HTML parse.
      await page.waitForTimeout(1000);
      expect(await gridVideos.evaluateAll((videos) => videos.filter((video) => video.hasAttribute('src') || !video.paused).length)).toBe(0);

      const card = page.locator('#galleryGrid [data-id="v01"]');
      await card.click();
      const active = page.locator('#lbWrapper .swiper-slide-active video');
      await expect(active).toBeVisible();
      await expect.poll(() => active.evaluate((video) => !video.paused && video.readyState >= 2)).toBe(true);
      // An explicit click starts the selected video, but changing the system
      // preference while the lightbox is open must not restart the grid.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForTimeout(500);
      expect(await gridVideos.evaluateAll((videos) => videos.filter((video) => video.hasAttribute('src') || !video.paused).length)).toBe(0);
      await page.locator('#lbClose').click();
      const firstVideo = card.locator('video');
      await expect(firstVideo).toHaveAttribute('src', /video-01-knigi\.webm/);
      await expect.poll(() => firstVideo.evaluate((video) => !video.paused)).toBe(true);

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect.poll(() => gridVideos.evaluateAll((videos) => videos.filter((video) => !video.paused).length)).toBe(0);
      await page.waitForTimeout(500);
      expect(await gridVideos.evaluateAll((videos) => videos.filter((video) => !video.paused).length)).toBe(0);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await expect.poll(() => firstVideo.evaluate((video) => !video.paused)).toBe(true);
      expect(errors).toEqual([]);
    });
  }

  test('queued grid observer callbacks respect a newly reduced-motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    await page.addInitScript(() => {
      const NativeObserver = window.IntersectionObserver;
      const gate = window.__motionObserverGate = { pending: [], hold: true };
      window.IntersectionObserver = class extends NativeObserver {
        constructor(callback, options) {
          super((entries, observer) => {
            if (gate.hold && entries.some((entry) => entry.isIntersecting && entry.target.closest('#galleryGrid'))) {
              gate.pending.push(() => callback(entries, observer));
            } else callback(entries, observer);
          }, options);
        }
      };
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto('/gallery/', { waitUntil: 'load' });
    expect(response.status()).toBe(200);
    await page.waitForFunction(() => window.__motionObserverGate.pending.length > 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    await page.evaluate(() => {
      const gate = window.__motionObserverGate;
      gate.hold = false;
      gate.pending.splice(0).forEach((deliver) => deliver());
    });
    const gridVideos = page.locator('#galleryGrid video');
    expect(await gridVideos.evaluateAll((videos) => videos.filter((video) => video.hasAttribute('src') || !video.paused).length)).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('#galleryGrid [data-id="v01"] video')).toHaveAttribute('src', /video-01-knigi\.webm/);
    expect(errors).toEqual([]);
  });

  test('static gallery photo recovers if AVIF fails before the module loads', async ({ page }) => {
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    let releaseModule;
    const gate = new Promise((resolve) => { releaseModule = resolve; });
    const requests = [];
    page.on('request', (request) => {
      if (/\/img\/gallery\/gallery-01\.(avif|webp)$/.test(new URL(request.url()).pathname)) {
        requests.push(new URL(request.url()).pathname);
      }
    });
    await page.route(/\/js\/gallery\/main\.js(?:\?|$)/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.route(/\/img\/gallery\/gallery-01\.avif(?:\?|$)/, (route) =>
      route.fulfill({ status: 404, body: 'Image unavailable' }));
    try {
      const response = await page.goto('/gallery/', { waitUntil: 'commit' });
      expect(response.status()).toBe(200);
      const image = page.locator('#galleryGrid [data-id="p01"] img');
      await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth === 0)).toBe(true);
      expect(requests.some((url) => url.endsWith('.avif'))).toBe(true);
      releaseModule();
      await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      await expect.poll(() => image.evaluate((img) => img.currentSrc)).toContain('/img/gallery/gallery-01.webp');
      await page.waitForTimeout(500);
      expect(requests.filter((url) => url.endsWith('.avif')).length).toBeLessThanOrEqual(2);
    } finally {
      releaseModule();
    }
  });

  test('lightbox photo uses HD WebP if HD AVIF is unavailable', async ({ page }) => {
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    let avifRequests = 0;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route(/\/img\/gallery\/gallery-01-hd\.avif(?:\?|$)/, async (route) => {
      avifRequests++;
      await route.fulfill({ status: 404, body: 'Image unavailable' });
    });
    await page.goto('/gallery/', { waitUntil: 'load' });
    await page.locator('#galleryGrid [data-id="p01"]').click();
    const image = page.locator('#lbWrapper .swiper-slide-active img');
    await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => image.evaluate((img) => img.currentSrc)).toContain('/img/gallery/gallery-01-hd.webp');
    await page.waitForTimeout(500);
    expect(avifRequests).toBeGreaterThan(0);
    expect(avifRequests).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  test('lightbox keeps the preview if the HD warmup fails', async ({ page }) => {
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    let hdRequests = 0;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route(/\/img\/gallery\/gallery-01-hd\.webp(?:\?|$)/, async (route) => {
      hdRequests++;
      await route.fulfill({ status: 404, body: 'Image unavailable' });
    });
    await page.goto('/gallery/', { waitUntil: 'load' });
    await page.locator('#galleryGrid [data-id="p01"]').click();
    const image = page.locator('#lbWrapper .swiper-slide-active img');
    await expect.poll(() => hdRequests).toBeGreaterThan(0);
    await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => image.evaluate((img) => img.currentSrc)).toMatch(/\/img\/gallery\/gallery-01\.(avif|webp)$/);
    await page.waitForTimeout(500);
    expect(hdRequests).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  for (const webpAlsoFails of [false, true]) {
    test(`gallery photo fallback stops after ${webpAlsoFails ? 'both formats fail' : 'AVIF fails'}`, async ({ page }) => {
      await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
      const requests = [];
      const errors = [];
      page.on('request', (request) => {
        if (/\/img\/gallery\/gallery-02\.(avif|webp)$/.test(new URL(request.url()).pathname)) {
          requests.push(new URL(request.url()).pathname);
        }
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route(/\/img\/gallery\/gallery-02\.(avif|webp)(?:\?|$)/, async (route) => {
        if (route.request().url().includes('.avif') || webpAlsoFails) {
          await route.fulfill({ status: 404, body: 'Image unavailable' });
        } else await route.continue();
      });
      const response = await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
      expect(response.status()).toBe(200);
      const image = page.locator('#galleryGrid [data-id="p02"] img');
      await expect.poll(() => image.evaluate((img) => ({ complete: img.complete, hasPixels: img.naturalWidth > 0 })))
        .toEqual({ complete: true, hasPixels: !webpAlsoFails });
      if (!webpAlsoFails) {
        await expect.poll(() => image.evaluate((img) => img.currentSrc)).toContain('/img/gallery/gallery-02.webp');
      }
      await expect(image.locator('..').locator('source')).toHaveCount(0);
      // Leave enough time to detect an error handler re-requesting an unavailable source.
      await page.waitForTimeout(500);
      expect(requests.filter((url) => url.endsWith('.avif')).length).toBeGreaterThan(0);
      expect(requests.filter((url) => url.endsWith('.webp')).length).toBeGreaterThan(0);
      expect(requests.length).toBeLessThanOrEqual(3);
      expect(errors).toEqual([]);
    });
  }

  test.describe('low-density phone photo fallback', () => {
    test.use({ deviceScaleFactor: 1 });

    test('a missing mobile AVIF falls back to the photo WebP', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
      let mobileRequests = 0;
      await page.route(/\/img\/gallery\/gallery-05-card\.avif(?:\?|$)/, async (route) => {
        mobileRequests++;
        await route.fulfill({ status: 404, body: 'Image unavailable' });
      });
      const response = await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
      expect(response.status()).toBe(200);
      const image = page.locator('#galleryGrid [data-id="p05"] img');
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      await expect.poll(() => image.evaluate((img) => img.currentSrc)).toContain('/img/gallery/gallery-05.webp');
      await expect(image.locator('..').locator('source')).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(mobileRequests).toBe(1);
    });
  });

  test('gallery empty state can be reset after a category has no works', async ({ page }) => {
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    await page.route(/\/js\/gallery\/data\.js(?:\?|$)/, async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const marker = "tags: ['pavlova']";
      expect(source.split(marker)).toHaveLength(3);
      await route.fulfill({ response, body: source.replaceAll(marker, 'tags: []') });
    });
    const response = await page.goto('/gallery/', { waitUntil: 'load' });
    expect(response.status()).toBe(200);
    await page.locator('#gxFilters [data-filter="pavlova"]').click();
    await expect(page.locator('#gxEmpty')).toBeVisible();
    await expect(page.locator('#galleryGrid .card')).toHaveCount(0);
    await page.locator('#resetFilter').click();
    await expect(page.locator('#gxEmpty')).toBeHidden();
    await expect(page.locator('#galleryGrid .card')).toHaveCount(46);
  });

  test('gallery video warmup uses valid preload values when switching works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/gallery/', { waitUntil: 'load' });
    await page.locator('#galleryGrid [data-id="v01"]').click();
    await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
    await page.locator('#lbThumbs .lb-thumb').nth(4).click();
    await expect(page.locator('#lbCounter')).toHaveText('05 / 46');
    const active = page.locator('#lbWrapper .swiper-slide-active video');
    await expect(active).toBeVisible();
    await expect.poll(() => active.evaluate((video) => !video.paused)).toBe(true);
    const videoStates = await page.locator('#lbWrapper video').evaluateAll((videos) => videos.map((video) => ({
      preload: video.getAttribute('preload'), paused: video.paused, active: video.closest('.swiper-slide-active') !== null,
    })));
    expect(videoStates.every((video) => ['auto', 'metadata'].includes(video.preload))).toBe(true);
    expect(videoStates.filter((video) => !video.paused).every((video) => video.active)).toBe(true);
    await page.locator('#lbThumbs .lb-thumb').nth(1).click();
    await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
    await expect.poll(() => page.locator('#lbWrapper .swiper-slide-active video').evaluate((video) => !video.paused)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('gallery can close an active video and reopen without CDN', async ({ page }) => {
    const errors = [];
    const diagnostic = { crashed: false };
    const imageRequests = new Map();
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (/^\/img\/gallery\/.*\.(avif|webp)$/.test(path)) {
        imageRequests.set(path, (imageRequests.get(path) || 0) + 1);
      }
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('crash', () => { diagnostic.crashed = true; diagnostic.resources = browserCrashResources(); });
    try {
      await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
      const response = await page.goto('/gallery/', { waitUntil: 'load' });
      expect(response.status(), 'gallery must come from the site server').toBe(200);
      const card = page.locator('#galleryGrid [data-id="p01"]');
      await expect(card).toBeVisible();
      await card.click();
      await page.locator('#lbNext').click();
      await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
      const video = page.locator('#lbWrapper .swiper-slide-active video');
      await expect(video).toBeVisible();
      await expect(video).toHaveAttribute('src', /video-01-knigi\.webm/);
      await expect.poll(() => video.evaluate((v) => v.readyState >= 2 || !!v.error)).toBe(true);
      diagnostic.beforeClose = await page.evaluate(() => {
        const describe = (v) => ({ source: v.getAttribute('src'), readyState: v.readyState,
          paused: v.paused, networkState: v.networkState, error: v.error?.code || null });
        const grid = Array.from(document.querySelectorAll('#galleryGrid video'));
        const lightbox = Array.from(document.querySelectorAll('#lbWrapper video'));
        return { active: describe(document.querySelector('#lbWrapper .swiper-slide-active video')),
          gridWithSource: grid.filter((v) => v.getAttribute('src')).map(describe),
          lightboxWithSource: lightbox.filter((v) => v.getAttribute('src')).map(describe) };
      });
      await page.locator('#lbClose').click();
      await expect(page.locator('#lbRoot')).toHaveCount(0);
      await card.click();
      await expect(page.locator('#lbCounter')).toHaveText('01 / 46');
      expect(errors).toEqual([]);
    } catch (error) {
      diagnostic.resources ||= browserCrashResources();
      diagnostic.repeatedImages = [...imageRequests.entries()].filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]).slice(0, 8);
      throw new Error(`${error.message}\nGallery video diagnostics: ${JSON.stringify({ ...diagnostic, errors })}`, { cause: error });
    }
  });

  test('gallery media, caption and controls do not overlap without CDN', async ({ page }) => {
    test.setTimeout(90_000);
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    for (const viewport of [
      { width: 320, height: 800 }, { width: 390, height: 844 },
      { width: 560, height: 844 }, { width: 1440, height: 900 },
      { width: 568, height: 320 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/gallery/', { waitUntil: 'load' });
      await page.locator('#galleryGrid [data-id="p01"]').click();
      if (viewport.height === 320) {
        await page.locator('.lb-thumb[aria-label="3D-торт с игровым тематическим декором"]').click();
      } else {
        await page.locator('#lbNext').click();
        await page.locator('#lbNext').click();
      }
      await page.locator('#lbRoot').evaluate(async (root) => {
        await Promise.all(root.getAnimations().map((animation) => animation.finished.catch(() => {})));
      });
      await expect.poll(() => page.locator('#lbWrapper .swiper-slide-active img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
      const rects = await page.evaluate(() => {
        const bounds = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
        const info = document.querySelector('.lb-info');
        return {
          media: bounds('#lbWrapper .swiper-slide-active .lb-media'), title: bounds('#lbTitle'),
          info: info.getBoundingClientRect().toJSON(), thumbs: bounds('#lbThumbs'), copy: bounds('#lbCopy'),
          infoHeight: info.clientHeight, infoScrollHeight: info.scrollHeight,
        };
      });
      if (viewport.height === 320) expect(rects.media.right, `${viewport.width} landscape media vs. info`).toBeLessThanOrEqual(rects.info.left);
      else expect(rects.media.bottom, `${viewport.width} portrait media vs. caption`).toBeLessThanOrEqual(rects.title.top);
      expect(rects.info.bottom, `${viewport.width} info vs. thumbnails`).toBeLessThanOrEqual(rects.thumbs.top);
      expect(rects.copy.bottom, `${viewport.width} copy action remains visible`).toBeLessThanOrEqual(rects.info.bottom + 1);
      expect(rects.infoScrollHeight, `${viewport.width} content fits without clipping`).toBeLessThanOrEqual(rects.infoHeight + 1);
      await page.locator('#lbClose').click();
      await expect(page.locator('#lbRoot')).toHaveCount(0);
    }
  });

  test('caption reflows and remains keyboard reachable with enlarged text', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
      await page.locator('#galleryGrid [data-id="p20"]').click();
      await expect(page.locator('#lbClose')).toBeFocused();

      await enlargeCaptionText(page);
      const info = page.locator('.lb-info');
      await expect(info).toHaveAccessibleName('Описание работы и действия');
      await expect.poll(() => info.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
      await expect.poll(() => info.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => page.locator('#lbWrapper .swiper-slide-active img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
      const boxes = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { media: rect('#lbWrapper .swiper-slide-active .lb-media'), info: rect('.lb-info'), thumbs: rect('#lbThumbs') };
      });
      expect(boxes.media.height).toBeGreaterThan(32);
      if (viewport.width < viewport.height) expect(boxes.media.bottom).toBeLessThanOrEqual(boxes.info.top);
      else expect(boxes.media.right).toBeLessThanOrEqual(boxes.info.left);
      expect(boxes.thumbs.bottom).toBeLessThanOrEqual(viewport.height);

      for (let step = 0; step < 5 && !(await info.evaluate((el) => el === document.activeElement)); step++) {
        await page.keyboard.press('Tab');
      }
      await expect(info).toBeFocused();
      expect(await info.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      await page.evaluate(() => {
        window.__galleryScrollKeys = [];
        window.__galleryFocusTrace = [];
        document.addEventListener('keydown', (event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'PageDown') return;
          const key = event.key;
          const target = event.target?.className || event.target?.nodeName;
          // Observe cancellation after every handler has had a chance to run.
          setTimeout(() => window.__galleryScrollKeys.push({ key, target, defaultPrevented: event.defaultPrevented }), 0);
        }, { capture: true });
        document.addEventListener('focusin', (event) => {
          if (!event.target.closest?.('#lbRoot')) return;
          const region = document.querySelector('.lb-info');
          window.__galleryFocusTrace.push({ target: event.target.id || event.target.className,
            scrollTop: region.scrollTop, bounds: event.target.getBoundingClientRect().toJSON() });
        }, { capture: true });
      });
      await page.keyboard.press('ArrowDown');
      try {
        await expect.poll(() => info.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      } catch (error) {
        // Keep the ArrowDown failure; probe PageDown only to diagnose it.
        let diagnostic;
        try {
          const before = await info.evaluate((el) => ({
            scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
            overflowY: getComputedStyle(el).overflowY, pointerEvents: getComputedStyle(el).pointerEvents,
            focused: el === document.activeElement,
          }));
          await page.keyboard.press('PageDown');
          try {
            await expect.poll(() => info.evaluate((el) => el.scrollTop), { timeout: 3000 }).toBeGreaterThan(before.scrollTop);
          } catch { /* retain the original ArrowDown failure */ }
          diagnostic = { before, afterPageDown: await info.evaluate((el) => el.scrollTop),
            keys: await page.evaluate(() => window.__galleryScrollKeys) };
        } catch (diagnosticError) {
          diagnostic = { error: diagnosticError.message };
        }
        throw new Error(`${error.message}\nGallery keyboard diagnostics: ${JSON.stringify(diagnostic)}`, { cause: error });
      }

      const copy = page.locator('#lbCopy');
      for (let step = 0; step < 10 && !(await copy.evaluate((el) => el === document.activeElement)); step++) {
        await page.keyboard.press('Tab');
      }
      await expect(copy).toBeFocused();
      try {
        await expect.poll(() => copy.evaluate((el) => {
          const bounds = el.getBoundingClientRect();
          const container = el.closest('.lb-info').getBoundingClientRect();
          return bounds.top >= container.top - 1 && bounds.bottom <= container.bottom + 1;
        })).toBe(true);
      } catch (error) {
        const diagnostic = await page.evaluate(() => {
          const control = document.querySelector('#lbCopy');
          const region = document.querySelector('.lb-info');
          const describe = (element) => {
            const style = getComputedStyle(element);
            return { bounds: element.getBoundingClientRect().toJSON(), scrollTop: element.scrollTop,
              scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
              overflowY: style.overflowY, transform: style.transform, fontSize: style.fontSize,
              lineHeight: style.lineHeight, visibility: style.visibility };
          };
          return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
            visual: window.visualViewport ? { width: visualViewport.width, height: visualViewport.height,
              offsetTop: visualViewport.offsetTop, scale: visualViewport.scale } : null },
          focused: document.activeElement?.id, control: describe(control), region: describe(region),
          fonts: document.fonts?.status, trace: window.__galleryFocusTrace, keys: window.__galleryScrollKeys };
        }).catch((reason) => ({ error: reason.message }));
        throw new Error(`${error.message}\nGallery focus visibility diagnostics: ${JSON.stringify(diagnostic)}`, { cause: error });
      }
      await expect.poll(() => info.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('#lbRoot')).toHaveCount(0);
    }
  });

  test('enlarged caption scrolls with the wheel over its padded edge', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-mobile'), 'A wheel is a desktop input');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
      await page.locator('#galleryGrid [data-id="p20"]').click();
      await enlargeCaptionText(page);
      const info = page.locator('.lb-info');
      await expect.poll(() => info.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
      const box = await info.boundingBox();
      for (const x of [box.x + box.width - 4, box.x + box.width / 2]) {
        const before = await info.evaluate((el) => el.scrollTop);
        await page.mouse.move(x, box.y + Math.min(30, box.height / 2));
        await page.mouse.wheel(0, 75);
        await expect.poll(() => info.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
      }
      await page.locator('#lbClose').click();
    }
  });

  test('narrow-screen arrow buttons stay clickable where enlarged caption overlaps', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
    await page.locator('#galleryGrid [data-id="p20"]').click();
    await enlargeCaptionText(page);
    const info = page.locator('.lb-info');
    await expect.poll(() => info.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
    const next = page.locator('#lbNext');
    const box = await next.boundingBox();
    const position = { x: box.width / 2, y: box.height * .85 };
    // Use an actual edge click/tap rather than invoking the handler directly.
    if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await next.tap({ position, timeout: 5000 });
    else await next.click({ position, timeout: 5000 });
    await expect(page.locator('#lbCounter')).toHaveText('31 / 46');
    await page.locator('#lbClose').click();
  });

  test('photo-only gallery can repeatedly open and close without CDN', async ({ page }) => {
    const diagnostic = { crashed: false, errors: [] };
    page.on('pageerror', (error) => diagnostic.errors.push(error.message));
    page.on('crash', () => { diagnostic.crashed = true; diagnostic.resources = browserCrashResources(); });
    try {
      await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
      await page.goto('/gallery/', { waitUntil: 'load' });
      await page.locator('.gx-chip[data-filter="photo"]').click();
      await expect(page.locator('#videoCount')).toHaveText('0 видео');
      await expect(page.locator('#galleryGrid')).not.toHaveAttribute('data-hydrating', 'true');
      const card = page.locator('#galleryGrid [data-id="p01"]');
      for (let i = 0; i < 2; i++) {
        await card.click();
        await expect(page.locator('#lbCounter')).toHaveText('01 / 30');
        await page.locator('#lbClose').click();
        await expect(page.locator('#lbRoot')).toHaveCount(0);
      }
      expect(diagnostic.errors).toEqual([]);
    } catch (error) {
      diagnostic.resources ||= browserCrashResources();
      throw new Error(`${error.message}\nPhoto-only gallery diagnostics: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
  });

  test('gallery can reopen when video requests fail without CDN', async ({ page }) => {
    const diagnostic = { crashed: false, blocked: 0, errors: [] };
    page.on('pageerror', (error) => diagnostic.errors.push(error.message));
    page.on('crash', () => { diagnostic.crashed = true; diagnostic.resources = browserCrashResources(); });
    try {
      await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
      await page.route('**/*.webm', (route) => { diagnostic.blocked++; return route.abort(); });
      await page.goto('/gallery/', { waitUntil: 'load' });
      const card = page.locator('#galleryGrid [data-id="p01"]');
      await card.click();
      await page.locator('#lbNext').click();
      const video = page.locator('#lbWrapper .swiper-slide-active video');
      await expect(video).toBeVisible();
      await expect(video).toHaveAttribute('src', /video-01-knigi\.webm/);
      await expect.poll(() => video.evaluate((v) => !!v.error)).toBe(true);
      expect(diagnostic.blocked).toBeGreaterThan(0);
      await page.locator('#lbClose').click();
      await expect(page.locator('#lbRoot')).toHaveCount(0);
      await card.click();
      await expect(page.locator('#lbCounter')).toHaveText('01 / 46');
      expect(diagnostic.errors).toEqual([]);
    } catch (error) {
      diagnostic.resources ||= browserCrashResources();
      throw new Error(`${error.message}\nUnavailable video diagnostics: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
  });

  test('late Swiper initializes at the current fallback slide even after close and reopen', async ({ page }) => {
    // A same-origin server delays the real HTTP response without leaving a
    // Playwright route handler pending while the lightbox is exercised.
    const http = require('node:http');
    const fs = require('node:fs');
    const path = require('node:path');
    const root = process.cwd();
    const html = fs.readFileSync('gallery/index.html', 'utf8');
    const src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
    expect(html.split(src)).toHaveLength(2);
    let response;
    let markRequested;
    const stats = { assets: 0, images: 0, videos: 0, missing: 0, crashed: false };
    page.on('crash', () => { stats.crashed = true; stats.resources = browserCrashResources(); });
    const requested = new Promise((resolve) => { markRequested = resolve; });
    const server = http.createServer((req, res) => {
      if (req.url === '/gallery/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html.replace(src, '/delayed-swiper.js'));
      } else if (req.url === '/delayed-swiper.js') {
        response = res;
        markRequested();
      } else {
        // Serve actual repository files directly, without an extra proxy
        // connection for every gallery image and video.
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = path.resolve(root, `.${pathname}`);
        stats.assets++;
        if (/\.(?:webp|avif|png|jpe?g)$/i.test(pathname)) stats.images++;
        if (/\.webm$/i.test(pathname)) stats.videos++;
        if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
        fs.stat(file, (error, stat) => {
          if (error || !stat.isFile()) { stats.missing++; return res.writeHead(404).end(); }
          const types = {
            '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8',
            '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.webm': 'video/webm',
            '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
          };
          let start = 0, end = stat.size - 1, status = 200;
          const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
          const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' };
          if (range) {
            start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), end) : end;
            if (start > end) return res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
            status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
          }
          headers['Content-Length'] = end - start + 1;
          headers['Accept-Ranges'] = 'bytes';
          res.writeHead(status, headers);
          if (req.method === 'HEAD' || stat.size === 0) return res.end();
          const stream = fs.createReadStream(file, { start, end });
          res.on('close', () => stream.destroy());
          stream.on('error', () => res.destroy()).pipe(res);
        });
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const release = () => {
      if (response && !response.writableEnded && !response.destroyed) {
        response.writeHead(200, { 'Content-Type': 'application/javascript' }).end(swiperStub);
      }
    };
    try {
      await page.route('**/swiper-bundle.min.css', (route) => route.fulfill({ contentType: 'text/css', body: swiperCss }));
      await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}/gallery/`, { waitUntil: 'load' });
      await page.locator('.mc-consent-button--deny').click();
      const card = page.locator('#galleryGrid [data-id="p01"]');
      await card.click();
      await requested;
      // The former implementation stopped waiting after roughly two seconds.
      await page.waitForTimeout(2200);
      await page.locator('#lbNext').click();
      await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
      try {
        await page.locator('#lbClose').click({ timeout: 10_000 });
      } catch (error) {
        const diagnostics = await Promise.race([
          page.evaluate(() => {
            const button = document.querySelector('#lbClose');
            if (!button) return { missing: true };
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return {
              rect: rect.toJSON(), display: style.display, visibility: style.visibility, transform: style.transform,
              hit: hit?.outerHTML?.slice(0, 250), active: document.activeElement?.outerHTML?.slice(0, 250),
              animations: document.querySelector('#lbRoot').getAnimations({ subtree: true }).map((a) => ({
                target: a.effect?.target?.className, state: a.playState, time: a.currentTime,
              })).slice(0, 30),
            };
          }).catch((reason) => ({ evaluateError: String(reason) })),
          new Promise((resolve) => setTimeout(() => resolve({ unresponsive: true }), 3000)),
        ]);
        throw new Error(`${error.message}\nGallery close diagnostics: ${JSON.stringify(diagnostics)}`);
      }
      await card.click();
      await page.locator('#lbNext').click();
      await page.locator('#lbNext').click();
      await expect(page.locator('#lbCounter')).toHaveText('03 / 46');
      release();
      await expect(page.locator('#lbSwiper')).toHaveClass(/swiper-initialized/);
      await expect(page.locator('#lbCounter')).toHaveText('03 / 46');
      await page.locator('#lbNext').click();
      await expect(page.locator('#lbCounter')).toHaveText('04 / 46');
    } catch (error) {
      stats.resources ||= browserCrashResources();
      throw new Error(`${error.message}\nGallery server diagnostics: ${JSON.stringify(stats)}`, { cause: error });
    } finally {
      release();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('a loaded script alone cannot replace the fallback when Swiper CSS fails', async ({ page }) => {
    await page.route('**/swiper-bundle.min.css', (route) => route.abort());
    await page.route('**/swiper-bundle.min.js', (route) => route.fulfill({ contentType: 'application/javascript', body: swiperStub }));
    await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
    await page.locator('#galleryGrid [data-id="p01"]').click();
    await page.waitForFunction(() => !!window.Swiper);
    await expect(page.locator('#lbSwiper')).not.toHaveClass(/swiper-initialized/);
    await page.locator('#lbNext').click();
    await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
  });

  test('mobile lightbox respects safe areas and touch-scrolls enlarged captions', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium-mobile', 'Chromium safe-area and touch input contract');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    const client = await page.context().newCDPSession(page);
    for (const { viewport, insets } of [
      { viewport: { width: 390, height: 844 }, insets: { top: 44, bottom: 34, left: 0, right: 0 } },
      { viewport: { width: 568, height: 320 }, insets: { top: 0, bottom: 21, left: 44, right: 44 } },
    ]) {
      await page.setViewportSize(viewport);
      await client.send('Emulation.setSafeAreaInsetsOverride', { insets });
      await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
      await page.locator('#galleryGrid [data-id="p20"]').tap();
      await expect(page.locator('#lbRoot')).toHaveCSS('transform', 'none');
      await page.locator('#lbRoot').evaluate(async (root) => {
        await Promise.all(root.getAnimations().map((animation) => animation.finished.catch(() => {})));
      });
      await expect.poll(() => page.locator('#lbWrapper .swiper-slide-active img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
      const boxes = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { close: rect('#lbClose'), prev: rect('#lbPrev'), next: rect('#lbNext'),
          media: rect('#lbWrapper .swiper-slide-active .lb-media'), thumbs: rect('#lbThumbs') };
      });
      expect(boxes.close.top).toBeGreaterThanOrEqual(insets.top);
      expect(boxes.media.top).toBeGreaterThanOrEqual(boxes.close.bottom);
      for (const box of [boxes.close, boxes.prev, boxes.next, boxes.thumbs]) {
        expect(box.left).toBeGreaterThanOrEqual(insets.left);
        expect(box.right).toBeLessThanOrEqual(viewport.width - insets.right);
      }
      expect(boxes.thumbs.bottom).toBeLessThanOrEqual(viewport.height - insets.bottom);

      await enlargeCaptionText(page);
      const info = page.locator('.lb-info');
      await expect.poll(() => info.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
      const box = await info.boundingBox();
      const y = Math.round(box.y + box.height * .8);
      // Both the padded edge and the content must allow a real touch swipe.
      for (const x of [Math.round(box.x + box.width - 4), Math.round(box.x + box.width / 2)]) {
        const before = await info.evaluate((el) => el.scrollTop);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 50 }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(() => info.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
      }
      await page.locator('#lbClose').tap();
    }
    await client.detach();
  });

  test('mobile fallback accepts a real browser touch swipe', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium-mobile', 'Chromium touch input contract');
    await page.route('**/swiper-bundle.min.{js,css}', (route) => route.abort());
    await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
    await page.locator('#galleryGrid [data-id="p01"]').tap();
    const box = await page.locator('#lbSwiper').boundingBox();
    const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + 65, y }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 65, y }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#lbCounter')).toHaveText('02 / 46');
    await client.detach();
  });
});

test.describe('video strip fault handling', () => {
  test.use({ serviceWorkers: 'block' });
  test('video strip ignores non-array JSON and malformed entries without breaking the page', async ({ page }) => {
    const fs = require('node:fs');
    const original = fs.readFileSync('index.html', 'utf8');
    expect(original.match(/data-videos='[\s\S]*?'/g)).toHaveLength(1);
    let data = 'null';
    await page.route((url) => url.origin === 'http://127.0.0.1:4173' && url.pathname === '/', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: original.replace(/data-videos='[\s\S]*?'/, `data-videos='${data}'`) }));
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const cases = [
      ['null', 0], ['{broken', 0], ['{}', 0], ['[]', 0],
      ['[null,{},"bad",{"v":"/img/gallery/videos/video-01-knigi.webm","p":"/img/gallery/video-01-knigi-poster.webp","t":"Торт"}]', 2],
    ];
    for (const [payload, count] of cases) {
      data = payload;
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#mcVideoTrack .vtile')).toHaveCount(count);
      await page.evaluate(() => addToCart(2));
      await expect(page.locator('#cartBadge')).toHaveText('1');
      await page.evaluate(() => localStorage.removeItem('milovicake_cart'));
    }
    expect(errors).toEqual([]);
  });
});
