// Diagnostic only: compare the homepage with its below-hero sections inert.
// No HTML/CSS/JS served by production is modified. Requires Playwright Chromium.
// Run: node scripts/diagnostics/home_dom_lcp.cjs [pairs=8] [full,hero,comment]
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http2 = require('node:http2');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, '_review_screens');
const pairs = Number(process.argv[2] || 8);
const variants = (process.argv[3] || 'full,hero,comment').split(',');
if (!Number.isInteger(pairs) || pairs < 1 || pairs > 20) throw Error('Expected 1–20 pairs');
if (!variants.includes('full') || variants.length < 2 ||
    variants.some(v => !['full', 'hero', 'comment', 'contain'].includes(v))) {
  throw Error('Expected full and at least one of hero, comment, contain');
}
const original = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// Do not run site JS: this experiment isolates HTML parsing and styling, NOT a deployable change.
const inert = original.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, tag =>
  /type=["']application\/ld\+json["']/i.test(tag) ? tag : '');
const hero = inert.indexOf('<section class="hero" id="home">');
const end = inert.indexOf('</section>', hero) + '</section>'.length;
const mainClose = inert.indexOf('</main>', end);
if (hero < 0 || end < hero || mainClose < end) throw Error('Hero boundary changed');
const prefix = inert.slice(0, end);
const tail = inert.slice(mainClose); // Retain the footer and bottom navigation in all arms.
const belowHero = inert.slice(end, mainClose);
const html = {
  full: inert,
  contain: inert,
  hero: prefix + '\n' + tail,
  // Keep almost the same HTML transfer bytes, without creating below-fold DOM nodes.
  comment: prefix + '<!--' + belowHero.replace(/--/g, '- -') + '-->' + tail,
};
const mime = { '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };
const median = values => {
  const v = [...values].sort((a, b) => a - b);
  return (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2;
};
const round = x => Math.round(x * 10) / 10;

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const tlsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-h2-dom-'));
  const key = path.join(tlsDir, 'key.pem');
  const cert = path.join(tlsDir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  const sessions = new Set();
  const server = http2.createSecureServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert),
    allowHTTP1: false });
  server.on('session', session => {
    sessions.add(session);
    session.on('close', () => sessions.delete(session));
  });
  server.on('stream', (stream, headers) => {
    const url = new URL(headers[':path'], 'https://localhost');
    let body;
    let contentType = 'text/html; charset=utf-8';
    if (url.pathname === '/') {
      body = Buffer.from(html[url.searchParams.get('variant')] || html.full);
    } else {
      // The diagnostic server never reads outside the checkout or serves ignored artifacts.
      const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      const publicAsset = /^\/(?:css|img)\//.test(url.pathname) ||
        ['/favicon.svg', '/manifest.json'].includes(url.pathname);
      if (!publicAsset || !filename.startsWith(root + path.sep) ||
          !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        stream.respond({ ':status': 404 }); stream.end(); return;
      }
      body = fs.readFileSync(filename);
      if (filename === path.join(root, 'css/final-fixes.css') &&
          /[?&]variant=contain(?:&|$)/.test(headers.referer || '')) {
        // Probe layout/style isolation without removing content from DOM/search/a11y.
        body = Buffer.concat([body, Buffer.from('\n#main-content > section:not(.hero) { contain: layout style; }\n')]);
      }
      contentType = mime[path.extname(filename)] || 'application/octet-stream';
      if (/^(text\/|application\/(javascript|json))/.test(contentType)) contentType += '; charset=utf-8';
    }
    const response = { ':status': 200, 'content-type': contentType, 'cache-control': 'no-store' };
    if (/\bgzip\b/.test(headers['accept-encoding'] || '') &&
        /^(text\/|application\/(javascript|json))/.test(contentType)) {
      body = zlib.gzipSync(body);
      response['content-encoding'] = 'gzip';
    }
    response['content-length'] = body.length;
    stream.respond(response);
    stream.end(body);
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
    const address = `https://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    for (const variant of variants) console.log(
      `${variant} HTML bytes ${Buffer.byteLength(html[variant])}; gzip ${zlib.gzipSync(html[variant]).length}`);
    const rows = [];
    for (const rate of [1, 4]) {
      for (let pair = 0; pair < pairs; pair++) {
        for (const variant of [...variants.slice(pair % variants.length),
          ...variants.slice(0, pair % variants.length)]) {
          const context = await browser.newContext({ viewport: { width: 390, height: 844 },
            isMobile: true, deviceScaleFactor: 2, colorScheme: 'light',
            reducedMotion: 'reduce', ignoreHTTPSErrors: true, serviceWorkers: 'block' });
          // The sandbox cannot access Google Fonts; same empty CSS in both arms.
          await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route =>
            route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
          await context.addInitScript(() => {
            window.__lcp = [];
            window.__cls = 0;
            new PerformanceObserver(list => {
              for (const entry of list.getEntries()) window.__lcp.push({
                startTime: entry.startTime, size: entry.size,
                url: entry.url, id: entry.element?.id || entry.element?.className || '' });
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            new PerformanceObserver(list => {
              for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
            }).observe({ type: 'layout-shift', buffered: true });
          });
          const page = await context.newPage();
          const errors = [];
          const protocols = new Set();
          page.on('pageerror', error => errors.push(error.message));
          page.on('requestfailed', request => {
            if (request.url().startsWith(address)) errors.push(`${request.url()}: ${request.failure()?.errorText}`);
          });
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
          await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100,
            downloadThroughput: 1_600 * 1024 / 8, uploadThroughput: 750 * 1024 / 8,
            connectionType: 'cellular4g' });
          await cdp.send('Emulation.setCPUThrottlingRate', { rate });
          await cdp.send('Performance.enable');
          cdp.on('Network.responseReceived', event => {
            if (event.response.url.startsWith(address)) protocols.add(event.response.protocol);
          });
          const response = await page.goto(`${address}/?variant=${variant}`, {
            waitUntil: 'load', timeout: 30000 });
          await page.waitForTimeout(850);
          const data = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            return { fcp: performance.getEntriesByType('paint')
              .find(p => p.name === 'first-contentful-paint')?.startTime || 0,
              lcp: window.__lcp.at(-1) || null, cls: window.__cls,
              responseEnd: nav.responseEnd, encodedBodySize: nav.encodedBodySize,
              domContentLoaded: nav.domContentLoadedEventEnd,
              cssEnd: Math.max(...resources.filter(r => r.name.includes('/css/')).map(r => r.responseEnd)),
              nodes: document.getElementsByTagName('*').length,
              heroWidth: document.querySelector('.hero-img')?.naturalWidth,
              fontStatus: document.fonts.status,
              belowContain: document.querySelector('#about') ?
                getComputedStyle(document.querySelector('#about')).contain : null,
              cssLoaded: [...document.querySelectorAll('link[rel="stylesheet"]')]
                .every(link => Boolean(link.sheet)) };
          });
          const metrics = (await cdp.send('Performance.getMetrics')).metrics;
          const metric = name => round(metrics.find(m => m.name === name)?.value * 1000 || 0);
          if (pair === 0 && rate === 4) await page.screenshot({
            path: path.join(output, `dom-${variant}-mobile.png`) });
          const row = { pair, rate, variant, fcp: round(data.fcp),
            lcp: round(data.lcp?.startTime || 0), element: data.lcp?.id,
            cls: data.cls, cssEnd: round(data.cssEnd), responseEnd: round(data.responseEnd),
            encodedBodySize: data.encodedBodySize,
            domContentLoaded: round(data.domContentLoaded), nodes: data.nodes,
            layoutMs: metric('LayoutDuration'), recalcMs: metric('RecalcStyleDuration'),
            taskMs: metric('TaskDuration'), heroWidth: data.heroWidth,
            fontStatus: data.fontStatus, belowContain: data.belowContain,
            cssLoaded: data.cssLoaded,
            protocols: [...protocols].sort(), errors, status: response.status() };
          console.log(JSON.stringify(row));
          rows.push(row);
          await context.close();
          if (row.status !== 200 || row.heroWidth < 640 || !row.cssLoaded ||
              !row.fcp || !row.lcp || errors.length || !protocols.has('h2') ||
              (variant === 'contain' && row.belowContain !== 'layout style')) {
            throw Error('Invalid diagnostic load: ' + JSON.stringify(row));
          }
        }
      }
    }
    for (const rate of [1, 4]) {
      const group = rows.filter(r => r.rate === rate);
      const full = group.filter(r => r.variant === 'full');
      for (const variant of variants.filter(v => v !== 'full')) {
        const selected = group.filter(r => r.variant === variant);
        for (const field of ['fcp', 'lcp', 'cssEnd', 'responseEnd', 'domContentLoaded',
          'layoutMs', 'recalcMs']) {
          const differences = full.map(f => selected.find(h => h.pair === f.pair)[field] - f[field]);
          console.log(`cpu=${rate} ${variant} ${field}: full ${median(full.map(r => r[field]))}; ` +
            `${variant} ${median(selected.map(r => r[field]))}; paired delta ${median(differences)}; ` +
            `signs -/+: ${differences.filter(x => x < 0).length}/${differences.filter(x => x > 0).length}`);
        }
      }
    }
    fs.writeFileSync(path.join(output, `home_dom_lcp_${variants.join('_')}.json`),
      JSON.stringify(rows, null, 2) + '\n');
  } finally {
    if (browser) await browser.close();
    for (const session of sessions) session.destroy();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tlsDir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
