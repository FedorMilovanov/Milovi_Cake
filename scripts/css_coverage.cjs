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
  '/prigorody/pushkin/',
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

async function exercisePage(page, route) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(route === '/gallery/' ? 1300 : 700);

  // Scroll through the page so lazy/reveal/section styles become real runtime usage.
  await page.evaluate(async () => {
    const steps = 7;
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    for (let i = 0; i <= steps; i++) {
      scrollTo(0, Math.round(max * i / steps));
      await new Promise(r => setTimeout(r, 120));
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(250);

  if (route === '/') {
    // Protected hero messenger hover flight.
    for (const sel of ['.btn-hero-wa', '.btn-hero-tg', '.btn-hero-max']) {
      await safe(page.locator(sel), async l => { await l.hover({ timeout: 1500 }); await page.waitForTimeout(350); });
    }
    // Reviews carousel + modal.
    await safe(page.locator('#btnNext'), async l => { await l.click({ timeout: 1500 }); await page.waitForTimeout(250); });
    await safe(page.locator('#btnPrev'), async l => { await l.click({ timeout: 1500 }); await page.waitForTimeout(250); });
    await safe(page.locator('.map-badge-yandex'), async l => { await l.click({ timeout: 1500 }); await page.waitForTimeout(450); });
    await safe(page.locator('#tabGoogle'), async l => { await l.click({ timeout: 1500 }); await page.waitForTimeout(250); });
    await safe(page.locator('.reviews-modal-close'), async l => { await l.click({ timeout: 1500 }); await page.waitForTimeout(200); });
  }

  if (route === '/gallery/') {
    await safe(page.locator('.gallery-card, .gx-cell, .gallery-item, [data-gallery-index]'), async l => {
      await l.click({ timeout: 1500 });
      await page.waitForTimeout(700);
    });
    await safe(page.locator('.lb-close, .lightbox-close, .gallery-modal-close, [aria-label="Закрыть"]'), async l => {
      await l.click({ timeout: 1500 });
      await page.waitForTimeout(250);
    });
  }

  if (route === '/svadebnye-torty/' || route.includes('tort') || route === '/bento-torty/') {
    await safe(page.locator('details summary, .faq-q, .cb-faq-q'), async l => {
      await l.click({ timeout: 1500 });
      await page.waitForTimeout(250);
    });
    await safe(page.locator('video'), async l => {
      await l.evaluate(v => { try { v.muted = true; v.play(); } catch (_) {} });
      await page.waitForTimeout(350);
    });
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
    for (const route of ['/', '/gallery/', '/zakazat-tort-spb/', '/svadebnye-torty/', '/bento-torty/', '/otzyvy/']) {
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
