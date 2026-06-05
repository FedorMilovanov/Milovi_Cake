#!/usr/bin/env node
/*
 * Milovi Cake runtime CSS coverage probe.
 *
 * This is intentionally a dev-only tool (.cjs, not a runtime JS file).
 * It uses Chrome DevTools Protocol CSS.startRuleUsageTracking across real pages
 * and protected interactions, then writes audit/css-coverage-latest.md/json.
 */
const { chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.CSS_COVERAGE_PORT || 4186);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(ROOT, 'audit');
const RUNTIME_CSS = new Set([
  '/css/style.css',
  '/css/mc-2026.css',
  '/css/premium-overrides.css',
  '/css/v20-dark-and-fixes.css',
  '/css/v20-fixes.css',
  '/css/final-fixes.css',
  '/css/gallery/gallery-2026.css',
]);

const SCENARIOS = [
  '/',
  '/gallery/',
  '/zakazat-tort-spb/',
  '/tort-s-dostavkoy/',
  '/tort-na-den-rozhdeniya/',
  '/bento-torty/',
  '/detskie-torty/',
  '/svadebnye-torty/',
  '/o-konditere/',
  '/dostavka-i-oplata/',
  '/otzyvy/',
  '/meringue-roll/',
  '/certificates/',
  '/prigorody/pushkin/',
  '/prigorody/murino/',
];

const PROTECTED_HINTS = [
  'hero', 'messenger', 'ring', 'btn-hero', 'wa', 'tg', 'max',
  'review', 'reviews', 'modal', 'stage', 'track', 'map-badge',
  'gallery', 'lightbox', 'lb-', 'gx-', 'swiper', 'sc-',
  'cart', 'theme', 'dark', 'burger', 'menu', 'nav',
  'faq', 'video', 'bento', 'calc', 'order', 'prigorod', 'city',
  'cookie', 'toast', 'reveal', 'bottom-nav'
];

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
  })[ext] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url || '/');
    let pathname = decodeURIComponent(parsed.pathname || '/');
    if (pathname.endsWith('/')) pathname += 'index.html';
    let file = path.normalize(path.join(ROOT, pathname));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!fs.existsSync(file)) {
      const fallback = path.join(ROOT, pathname, 'index.html');
      if (fs.existsSync(fallback)) file = fallback;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

function cssPathFromUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.pathname;
  } catch (_) {
    return rawUrl.split('?')[0];
  }
}

function normalizeRuleText(s) {
  return s.replace(/\/\*[^]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

function selectorOfRule(ruleText) {
  const i = ruleText.indexOf('{');
  if (i < 0) return ruleText.slice(0, 180).trim();
  return ruleText.slice(0, i).replace(/\s+/g, ' ').trim();
}

function isProtectedSelector(selector) {
  const s = selector.toLowerCase();
  return PROTECTED_HINTS.some(h => s.includes(h));
}

async function safe(locator, action, timeout = 1200) {
  try {
    const count = await locator.count();
    if (!count) return false;
    await action(locator.first(), timeout);
    return true;
  } catch (_) {
    return false;
  }
}

async function clickIfVisible(page, selector, wait = 250) {
  return safe(page.locator(selector), async l => {
    await l.scrollIntoViewIfNeeded({ timeout: 1200 }).catch(() => {});
    await l.click({ timeout: 1500, force: false });
    await page.waitForTimeout(wait);
  });
}

async function hoverIfVisible(page, selector, wait = 220) {
  return safe(page.locator(selector), async l => {
    await l.scrollIntoViewIfNeeded({ timeout: 1200 }).catch(() => {});
    await l.hover({ timeout: 1500 });
    await page.waitForTimeout(wait);
  });
}

async function exerciseCommonChrome(page) {
  // Header, theme, mobile menu, and CTA/navigation states appear on many pages.
  await clickIfVisible(page, '.theme-toggle', 220);
  await clickIfVisible(page, '.theme-toggle', 120);
  await clickIfVisible(page, '#burgerBtn', 260);
  await clickIfVisible(page, '#burgerBtn', 160);
  await hoverIfVisible(page, '.header-order, .mc-btn--order, .btn-primary--hero', 180);
  await hoverIfVisible(page, '.bottom-nav-item--order', 180);
}

async function exerciseCatalogAndCart(page) {
  // Calculator states: selected options, collapsed/expanded result, add-to-cart, cart steps.
  await clickIfVisible(page, '.catalog-nav-item', 220);
  await clickIfVisible(page, '.calc-opt:not(.selected)', 250);
  await hoverIfVisible(page, '.calc-opt[data-price], .bento-seg-opt', 220);
  await clickIfVisible(page, '#calcCollapsedBar', 250);
  await clickIfVisible(page, '.calc-add-btn', 450);
  await clickIfVisible(page, '#calcOpenCartBtn, .bottom-nav-item--order', 450);
  await clickIfVisible(page, '#step2, .cart-next-btn, [onclick="navigateToStep(2)"]', 250);
  await safe(page.locator('#cname'), async l => { await l.fill('QA Coverage'); await page.waitForTimeout(90); });
  await safe(page.locator('#cphone'), async l => { await l.fill('+79990000000'); await page.waitForTimeout(90); });
  await safe(page.locator('#ccomment'), async l => { await l.fill('coverage state'); await page.waitForTimeout(90); });
  await hoverIfVisible(page, '#btnWA, #btnTG, .cart-clear-btn, .cart-close', 180);
  await clickIfVisible(page, '.cart-close', 220);
}

async function exerciseLegacyLightbox(page) {
  // Homepage/suburb catalog lightbox. Prefer actual product/card images; close afterward.
  const opened = await clickIfVisible(page, '.product-card img, .product-card .slider-wrap, .cake-card img, [onclick^="openLightbox"]', 450);
  if (opened) {
    await hoverIfVisible(page, '.lightbox-arrow', 160);
    await clickIfVisible(page, '.lightbox-arrow', 200);
    await clickIfVisible(page, '.lightbox-close', 220);
  }
}

async function exerciseGallery(page) {
  // Filters, card hover, lightbox controls/share/order actions.
  await clickIfVisible(page, '.gx-chip:not(.gx-chip-active)', 500);
  await clickIfVisible(page, '.gx-chip:not(.gx-chip-active)', 500);
  await hoverIfVisible(page, '.gx-card, .gx-cell, .gallery-card', 250);
  const opened = await clickIfVisible(page, '.gx-card, .gx-cell, .gallery-card, .gallery-item, [data-gallery-index]', 800);
  if (opened) {
    await hoverIfVisible(page, '.lb-nav-next, .lb-action, .lb-order-icon, .lb-thumb', 180);
    await clickIfVisible(page, '#lbNext, .lb-nav-next', 250);
    await clickIfVisible(page, '#lbPrev, .lb-nav-prev', 250);
    await clickIfVisible(page, '#lbShare, #lbCopy, .lb-action', 250);
    await clickIfVisible(page, '.lb-thumb:not(.active), .lb-thumbs button', 250);
    await clickIfVisible(page, '.lb-close, .lightbox-close, .gallery-modal-close, [aria-label="Закрыть"]', 300);
  }
}

async function exerciseReviews(page) {
  await clickIfVisible(page, '#btnNext', 250);
  await clickIfVisible(page, '#btnPrev', 250);
  await hoverIfVisible(page, '.review-slide, .review-card, .map-badge', 220);
  await clickIfVisible(page, '.map-badge-yandex', 450);
  await clickIfVisible(page, '#tabGoogle', 250);
  await clickIfVisible(page, '#tabYandex', 250);
  await clickIfVisible(page, '.reviews-modal-close', 220);
}

async function exerciseFaqAndMedia(page) {
  await clickIfVisible(page, 'details summary, .faq-q, .cb-faq-q, .faq-item summary', 250);
  await hoverIfVisible(page, '.cb-fl, .cb-occ, .cb-gluten-card, .lp-card, .feature', 180);
  await safe(page.locator('video'), async l => {
    await l.evaluate(v => { try { v.muted = true; v.play(); } catch (_) {} });
    await page.waitForTimeout(350);
  });
}

async function exercisePage(page, route) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(route === '/gallery/' ? 1500 : 750);

  await exerciseCommonChrome(page);

  // Scroll through the page so lazy/reveal/section styles become real runtime usage.
  await page.evaluate(async () => {
    const steps = 9;
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    for (let i = 0; i <= steps; i++) {
      scrollTo(0, Math.round(max * i / steps));
      await new Promise(r => setTimeout(r, 110));
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(250);

  if (route === '/' || route.startsWith('/prigorody/')) {
    // Protected hero messenger hover flight and homepage/suburb catalog states.
    for (const sel of ['.btn-hero-wa', '.btn-hero-tg', '.btn-hero-max']) {
      await hoverIfVisible(page, sel, 350);
    }
    await exerciseReviews(page);
    await exerciseCatalogAndCart(page);
    await exerciseLegacyLightbox(page);
  }

  if (route === '/gallery/') {
    await exerciseGallery(page);
  }

  if (route === '/svadebnye-torty/' || route.includes('tort') || route === '/bento-torty/' || route === '/detskie-torty/') {
    await exerciseFaqAndMedia(page);
  }

  if (route === '/otzyvy/') {
    await hoverIfVisible(page, '.review-card, .lp-card, .trust-card', 220);
  }
}

async function collectFor(route, theme, viewport, globalRules) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ theme }) => {
    try { localStorage.setItem('theme', theme); } catch (_) {}
    document.documentElement.setAttribute('data-theme', theme);
  }, { theme });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const styleSheets = new Map();
  client.on('CSS.styleSheetAdded', ev => {
    const h = ev.header;
    const cssPath = cssPathFromUrl(h.sourceURL || h.sourceURL || '');
    if (RUNTIME_CSS.has(cssPath)) styleSheets.set(h.styleSheetId, { header: h, cssPath });
  });
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  await client.send('CSS.startRuleUsageTracking');

  let error = null;
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await exercisePage(page, route);
  } catch (e) {
    error = String(e.message || e).slice(0, 500);
  }

  const usage = await client.send('CSS.stopRuleUsageTracking');
  for (const u of usage.ruleUsage || []) {
    const meta = styleSheets.get(u.styleSheetId);
    if (!meta) continue;
    if (!meta.text) {
      try { meta.text = (await client.send('CSS.getStyleSheetText', { styleSheetId: u.styleSheetId })).text; }
      catch (_) { meta.text = ''; }
    }
    const raw = meta.text.slice(u.startOffset, u.endOffset);
    const normalized = normalizeRuleText(raw);
    if (!normalized || !normalized.includes('{')) continue;
    const key = `${meta.cssPath}::${normalized}`;
    const rec = globalRules.get(key) || {
      cssPath: meta.cssPath,
      selector: selectorOfRule(normalized),
      ruleText: normalized,
      bytes: Buffer.byteLength(raw, 'utf8'),
      used: false,
      usedIn: [],
      seenIn: [],
    };
    rec.used = rec.used || !!u.used;
    const label = `${route} ${theme} ${viewport.width}x${viewport.height}`;
    rec.seenIn.push(label);
    if (u.used) rec.usedIn.push(label);
    globalRules.set(key, rec);
  }
  await browser.close();
  return { route, theme, viewport, error };
}

function summarize(globalRules, scenarioResults) {
  const byFile = new Map();
  for (const rec of globalRules.values()) {
    const file = byFile.get(rec.cssPath) || { cssPath: rec.cssPath, rules: 0, used: 0, unused: 0, bytes: 0, unusedBytes: 0, candidates: [] };
    file.rules += 1;
    file.bytes += rec.bytes;
    if (rec.used) file.used += 1;
    else {
      file.unused += 1;
      file.unusedBytes += rec.bytes;
      if (!isProtectedSelector(rec.selector)) file.candidates.push(rec);
    }
    byFile.set(rec.cssPath, file);
  }
  for (const file of byFile.values()) {
    file.candidates.sort((a, b) => b.bytes - a.bytes);
  }
  return { generatedAt: new Date().toISOString(), scenarios: scenarioResults, files: [...byFile.values()].sort((a, b) => a.cssPath.localeCompare(b.cssPath)) };
}

function writeReport(summary) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'css-coverage-latest.json');
  const mdPath = path.join(OUT_DIR, 'css-coverage-latest.md');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const lines = [];
  lines.push('# Milovi Cake runtime CSS coverage');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push('');
  lines.push('## Scenarios');
  for (const s of summary.scenarios) {
    lines.push(`- ${s.route} | ${s.theme} | ${s.viewport.width}x${s.viewport.height}${s.error ? ` | ERROR: ${s.error}` : ''}`);
  }
  lines.push('');
  lines.push('## File summary');
  lines.push('| CSS file | Rules seen | Used | Unused | Unused bytes seen |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const f of summary.files) lines.push(`| ${f.cssPath} | ${f.rules} | ${f.used} | ${f.unused} | ${f.unusedBytes} |`);
  lines.push('');
  lines.push('## Non-protected unused candidates (evidence only; do not delete without review)');
  for (const f of summary.files) {
    const top = f.candidates.slice(0, 25);
    if (!top.length) continue;
    lines.push(`\n### ${f.cssPath}`);
    for (const r of top) {
      lines.push(`- ${r.bytes} bytes — \`${r.selector.slice(0, 220).replace(/`/g, '\\`')}\``);
    }
  }
  lines.push('');
  fs.writeFileSync(mdPath, lines.join('\n'));
  return { jsonPath, mdPath };
}

(async () => {
  const server = await startServer();
  const globalRules = new Map();
  const scenarioResults = [];
  try {
    for (const route of SCENARIOS) {
      for (const theme of ['light', 'dark']) {
        scenarioResults.push(await collectFor(route, theme, { width: 1440, height: 1100 }, globalRules));
      }
    }
    // Mobile coverage on the most fragile surfaces.
    for (const route of ['/', '/gallery/', '/zakazat-tort-spb/', '/svadebnye-torty/', '/bento-torty/', '/otzyvy/', '/prigorody/pushkin/']) {
      for (const theme of ['light', 'dark']) {
        scenarioResults.push(await collectFor(route, theme, { width: 412, height: 915 }, globalRules));
      }
    }
    const summary = summarize(globalRules, scenarioResults);
    const out = writeReport(summary);
    console.log(`CSS coverage written:\n- ${path.relative(ROOT, out.mdPath)}\n- ${path.relative(ROOT, out.jsonPath)}`);
    for (const f of summary.files) {
      console.log(`${f.cssPath}: used ${f.used}/${f.rules}, unused ${f.unused}, non-protected candidates ${f.candidates.length}`);
    }
  } finally {
    server.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
