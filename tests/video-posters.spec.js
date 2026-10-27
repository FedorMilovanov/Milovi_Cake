const { test, expect } = require('@playwright/test');

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
    page.on('crash', () => { stats.crashed = true; });
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
          fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
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
      throw new Error(`${error.message}\nGallery server diagnostics: ${JSON.stringify(stats)}`);
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
