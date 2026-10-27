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

  test('gallery can close an active video and reopen without CDN', async ({ page }) => {
    const errors = [];
    const diagnostic = { crashed: false };
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
        document.addEventListener('keydown', (event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'PageDown') return;
          const key = event.key;
          const target = event.target?.className || event.target?.nodeName;
          // Observe cancellation after every handler has had a chance to run.
          setTimeout(() => window.__galleryScrollKeys.push({ key, target, defaultPrevented: event.defaultPrevented }), 0);
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
      await expect.poll(() => copy.evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        const container = el.closest('.lb-info').getBoundingClientRect();
        return bounds.top >= container.top - 1 && bounds.bottom <= container.bottom + 1;
      })).toBe(true);
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
