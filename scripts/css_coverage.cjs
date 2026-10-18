#!/usr/bin/env node
/*
 * Milovi Cake runtime CSS coverage probe.
 *
 * This is intentionally a dev-only tool (.cjs, not a runtime JS file).
 * It compares Chrome DevTools Protocol's observed matching rules with a CSSOM
 * rule count across real pages and protected interactions, then writes
 * audit/css-coverage-latest.md/json. Unobserved rules are NOT proven unused.
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

async function countStyleRules(page, fileTotals) {
  // CSS.stopRuleUsageTracking does not enumerate unmatched rules. Count the full
  // stylesheet separately so an all-matched CDP response cannot look like 0 unused.
  const counts = await page.evaluate(() => {
    const result = [];
    for (const sheet of document.styleSheets) {
      if (!sheet.href) continue;
      let count = 0;
      try {
        function walk(rules) {
          for (const rule of rules) {
            if (rule.type === CSSRule.STYLE_RULE) count++;
            if (rule.cssRules) walk(rule.cssRules);
          }
        }
        walk(sheet.cssRules);
        result.push({ href: sheet.href, count });
      } catch (_) { /* A cross-origin sheet cannot be inspected via CSSOM. */ }
    }
    return result;
  });
  for (const { href, count } of counts) {
    const cssPath = cssPathFromUrl(href);
    if (RUNTIME_CSS.has(cssPath)) fileTotals.set(cssPath, Math.max(fileTotals.get(cssPath) || 0, count));
  }
}

async function collectFor(route, theme, viewport, globalRules, fileTotals) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, colorScheme: theme, serviceWorkers: 'block' });
  await context.addInitScript(({ theme }) => {
    try {
      localStorage.setItem('mc_theme', theme);
      localStorage.setItem('milovi_analytics_consent_v1', 'denied');
    } catch (_) {}
  }, { theme });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const styleSheets = new Map();
  client.on('CSS.styleSheetAdded', ev => {
    const h = ev.header;
    const cssPath = cssPathFromUrl(h.sourceURL || '');
    if (RUNTIME_CSS.has(cssPath)) styleSheets.set(h.styleSheetId, { header: h, cssPath });
  });
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  await client.send('CSS.startRuleUsageTracking');

  let error = null;
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await countStyleRules(page, fileTotals);
    await exercisePage(page, route);
  } catch (e) {
    error = String(e.message || e).slice(0, 500);
  }

  const usage = await client.send('CSS.stopRuleUsageTracking');
  for (const u of usage.ruleUsage || []) {
    const meta = styleSheets.get(u.styleSheetId);
    if (!meta || !u.used) continue;
    if (!meta.text) {
      try { meta.text = (await client.send('CSS.getStyleSheetText', { styleSheetId: u.styleSheetId })).text; }
      catch (_) { meta.text = ''; }
    }
    const raw = meta.text.slice(u.startOffset, u.endOffset);
    const normalized = normalizeRuleText(raw);
    if (!normalized || !normalized.includes('{')) continue;
    // Stable source offsets preserve two identical rules at different locations.
    const key = `${meta.cssPath}::${u.startOffset}:${u.endOffset}`;
    if (!globalRules.has(key)) {
      globalRules.set(key, { cssPath: meta.cssPath, bytes: Buffer.byteLength(raw, 'utf8') });
    }
  }
  let actualTheme = null;
  try { actualTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme')); }
  catch (_) { /* A scenario may have navigated away or closed the page. */ }
  await browser.close();
  return { route, theme, actualTheme, viewport, error };
}

function summarize(globalRules, scenarioResults, fileTotals) {
  const byFile = new Map([...fileTotals].map(([cssPath, totalStyleRules]) => [
    cssPath, { cssPath, totalStyleRules, observedMatchingRules: 0, observedBytes: 0 },
  ]));
  for (const rec of globalRules.values()) {
    const file = byFile.get(rec.cssPath);
    if (!file) continue;
    file.observedMatchingRules++;
    file.observedBytes += rec.bytes;
  }
  return {
    generatedAt: new Date().toISOString(),
    methodology: 'CSSOM counts all style rules; DevTools lists only rules observed matching in these scenarios. Unobserved does not imply unused.',
    scenarios: scenarioResults,
    files: [...byFile.values()].sort((a, b) => a.cssPath.localeCompare(b.cssPath)),
  };
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
    lines.push(`- ${s.route} | ${s.theme} | ${s.viewport.width}x${s.viewport.height}${s.actualTheme !== s.theme ? ` | DOM theme: ${s.actualTheme || 'not set'}` : ''}${s.error ? ` | ERROR: ${s.error}` : ''}`);
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push(summary.methodology);
  lines.push('CSSOM includes rules for other pages, viewports and interactions. DevTools does not list every unmatched rule; these counts are not a purge list or a percentage of dead CSS.');
  lines.push('');
  lines.push('## File summary');
  lines.push('| CSS file | CSSOM style rules | Observed matching rules | Observed source bytes |');
  lines.push('|---|---:|---:|---:|');
  for (const f of summary.files) lines.push(`| ${f.cssPath} | ${f.totalStyleRules} | ${f.observedMatchingRules} | ${f.observedBytes} |`);
  lines.push('');
  fs.writeFileSync(mdPath, lines.join('\n'));
  return { jsonPath, mdPath };
}

(async () => {
  const server = await startServer();
  const globalRules = new Map();
  const fileTotals = new Map();
  const scenarioResults = [];
  const routeFilter = process.env.CSS_COVERAGE_ROUTE;
  try {
    if (routeFilter && !SCENARIOS.includes(routeFilter)) throw new Error(`Unknown CSS_COVERAGE_ROUTE: ${routeFilter}`);
    for (const route of routeFilter ? [routeFilter] : SCENARIOS) {
      for (const theme of ['light', 'dark']) {
        scenarioResults.push(await collectFor(route, theme, { width: 1440, height: 1100 }, globalRules, fileTotals));
      }
    }
    // Mobile coverage on the most fragile surfaces (or a selected route).
    for (const route of routeFilter ? [routeFilter] : ['/', '/gallery/', '/zakazat-tort-spb/', '/svadebnye-torty/', '/bento-torty/', '/otzyvy/', '/prigorody/pushkin/']) {
      for (const theme of ['light', 'dark']) {
        scenarioResults.push(await collectFor(route, theme, { width: 412, height: 915 }, globalRules, fileTotals));
      }
    }
    const summary = summarize(globalRules, scenarioResults, fileTotals);
    const out = writeReport(summary);
    console.log(`CSS coverage written:\n- ${path.relative(ROOT, out.mdPath)}\n- ${path.relative(ROOT, out.jsonPath)}`);
    for (const f of summary.files) {
      console.log(`${f.cssPath}: ${f.observedMatchingRules} matching positions observed; ${f.totalStyleRules} CSSOM style rules (not an unused count)`);
    }
  } finally {
    server.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
