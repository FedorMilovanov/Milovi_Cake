// Temporary, PR-only production CDN experiment. Remove after recording results.
// No site source is modified; each navigation has a fresh browser context.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { gzipSync } = require('node:zlib');
const { chromium, request } = require('playwright');

const ORIGIN = process.env.LCP_PROBE_ORIGIN || 'https://milovicake.ru';
const EXPECTED = process.env.EXPECTED_RELEASE_SHA || 'e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const OUT = process.env.LCP_PROBE_OUT || '/tmp/milovi-lcp-cdn-pairs';
const PAGES = [
  { name: 'bento', url: '/bento-torty/', hero: 'bento_1-mobile-640.avif', pairs: 8 },
  { name: 'home', url: '/', hero: 'head_mobile-640.avif', pairs: 4 },
];
if (process.env.CI && ORIGIN !== 'https://milovicake.ru') throw Error('CI must use unmodified production origin');
fs.mkdirSync(path.join(OUT, 'traces'), { recursive: true });
const round = n => n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10;
const delta = (n, zero) => round((n - zero) / 1000);
const notice = (name, data) => console.log(`::notice title=${name}::${JSON.stringify(data)}`);

async function verifyRelease(api) {
  if (ORIGIN !== 'https://milovicake.ru') return;
  const response = await api.get(`${ORIGIN}/release.json`, { headers: { 'Cache-Control': 'no-cache' }, timeout: 20000 });
  if (!response.ok()) throw Error(`release.json HTTP ${response.status()}`);
  const release = await response.json();
  if (release.repository !== 'FedorMilovanov/Milovi_Cake' || release.sha !== EXPECTED)
    throw Error(`production release changed: ${JSON.stringify(release)} != ${EXPECTED}`);
}

function cpuStats() {
  const text = fs.existsSync('/sys/fs/cgroup/cpu.stat') ? fs.readFileSync('/sys/fs/cgroup/cpu.stat', 'utf8') : '';
  const data = Object.fromEntries(text.trim().split('\n').map(line => line.split(' ')).filter(row => row.length === 2));
  return { throttled: Number(data.nr_throttled || 0), throttledMs: Number(data.throttled_usec || 0) / 1000 };
}

function analyzeTrace(raw, page, network) {
  const events = JSON.parse(raw.toString('utf8')).traceEvents || [];
  const nav = events.find(e => e.name === 'navigationStart' && e.args?.data?.documentLoaderURL?.includes(ORIGIN + page.url)
    && e.args.data.isOutermostMainFrame !== false);
  if (!nav) return { error: 'navigationStart not in trace', events: events.length };
  const zero = nav.ts;
  const cands = events.filter(e => e.name === 'largestContentfulPaint::Candidate' && e.ts >= zero);
  const last = cands.at(-1);
  if (!last) return { error: 'no raw LCP candidate in trace', events: events.length };
  const until = last.ts;
  const at = name => events.filter(e => e.name === name && e.ts >= zero && e.ts <= until);
  const draw = at('DrawFrame').map(e => e.ts).sort((a, b) => a - b);
  // Include the interval to the first frame and the final interval to LCP.
  const boundaries = [zero, ...draw, until];
  const gaps = boundaries.slice(1).map((t, i) => ({ from: delta(boundaries[i], zero),
    to: delta(t, zero), ms: round((t - boundaries[i]) / 1000), start: boundaries[i], end: t }));
  const gap = gaps.sort((a, b) => b.ms - a.ms)[0] || null;
  const threads = new Set(events.filter(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map(e => `${e.pid}:${e.tid}`));
  const tasks = at('RunTask').filter(e => threads.has(`${e.pid}:${e.tid}`));
  let busy = null;
  if (gap && threads.size) {
    const spans = tasks.map(e => [Math.max(e.ts, gap.start), Math.min(e.ts + (e.dur || 0), gap.end)])
      .filter(([a, b]) => a < b).sort((a, b) => a[0] - b[0]);
    let end = gap.start; let total = 0;
    for (const [a, b] of spans) { total += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
    busy = round(total / 1000);
  }
  const end = network.find(n => n.url.includes(page.hero) && n.end != null);
  const css = network.find(n => n.url.includes('/css/style.css') && n.end != null);
  const resourcesReady = Math.max(end?.end || 0, css?.end || 0);
  return {
    events: events.length, rawLcpMs: delta(until, zero),
    image: last.args?.data?.imageUrl || last.args?.data?.url || null,
    heroPaintMs: at('PaintImage').filter(e => String(e.args?.data?.url).includes(page.hero)).map(e => delta(e.ts, zero)).slice(0, 6),
    firstPaintMs: at('firstPaint').map(e => delta(e.ts, zero)).slice(0, 2),
    fcpMs: at('firstContentfulPaint').map(e => delta(e.ts, zero)).slice(0, 2),
    screenshotsMs: at('Screenshot').map(e => delta(e.ts, zero)).slice(0, 8),
    drawCount: draw.length, maxNoDrawWindow: gap ? { from: gap.from, to: gap.to, ms: gap.ms,
      postResourceMs: end && css ? round(Math.max(0, gap.to - Math.max(gap.from, resourcesReady))) : null,
      mainBusyMs: busy } : null,
    heroResponseEndMs: end?.end ?? null, cssResponseEndMs: css?.end ?? null,
    swEvents: events.filter(e => e.ts >= zero && e.ts <= until && (/ServiceWorker/i.test(e.name)
      || (e.name === 'ResourceSendRequest' && String(e.args?.data?.url).includes('/sw.js'))))
      .slice(0, 12).map(e => [e.name, delta(e.ts, zero)]),
  };
}

async function readTrace(cdp) {
  const complete = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Tracing.tracingComplete timeout')), 45000);
    cdp.once('Tracing.tracingComplete', e => { clearTimeout(timer); resolve(e.stream); });
  });
  await cdp.send('Tracing.end');
  const handle = await complete;
  if (!handle) throw Error('Tracing returned no stream');
  const chunks = [];
  for (;;) {
    const item = await cdp.send('IO.read', { handle, size: 2 ** 20 });
    chunks.push(Buffer.from(item.data, item.base64Encoded ? 'base64' : 'utf8'));
    if (item.eof) break;
  }
  await cdp.send('IO.close', { handle });
  return Buffer.concat(chunks);
}

async function collect(browser, page, pair, mode) {
  const label = `${page.name}-${String(pair + 1).padStart(2, '0')}-${mode}`;
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 1.75,
    isMobile: true, hasTouch: true, colorScheme: 'light', serviceWorkers: mode,
  });
  const tab = await context.newPage();
  const cdp = await context.newCDPSession(tab);
  const net = new Map(); const sw = [];
  let doc;
  cdp.on('Network.requestWillBeSent', e => {
    if (e.type === 'Document' && e.request.url === ORIGIN + page.url) doc = { timestamp: e.timestamp, wallTime: e.wallTime };
    net.set(e.requestId, { url: e.request.url, start: e.timestamp, type: e.type });
  });
  cdp.on('Network.responseReceived', e => {
    const n = net.get(e.requestId);
    if (n) Object.assign(n, { status: e.response.status, protocol: e.response.protocol,
      cached: e.response.fromDiskCache || e.response.fromPrefetchCache || false,
      fromSW: e.response.fromServiceWorker || false });
  });
  cdp.on('Network.loadingFinished', e => { const n = net.get(e.requestId); if (n) n.finished = e.timestamp; });
  cdp.on('Network.loadingFailed', e => { const n = net.get(e.requestId); if (n) n.failed = e.errorText; });
  cdp.on('ServiceWorker.workerVersionUpdated', e => {
    for (const v of e.versions || []) sw.push({ at: round(performance.now() - started), status: v.status,
      running: v.runningStatus, script: v.scriptURL?.split('/').at(-1) });
  });
  const startCpu = cpuStats(); const loadBefore = os.loadavg();
  let started = performance.now(); let tracing = false;
  try {
    await cdp.send('Network.enable');
    await cdp.send('ServiceWorker.enable');
    await tab.addInitScript(() => {
      const data = window.__lcpProbe = { lcp: [], paint: [], visibility: [] };
      const visible = () => data.visibility.push({ at: performance.now(), state: document.visibilityState, focus: document.hasFocus() });
      visible(); document.addEventListener('visibilitychange', visible);
      for (const type of ['largest-contentful-paint', 'paint']) {
        try { new PerformanceObserver(list => {
          for (const e of list.getEntries()) data[type === 'paint' ? 'paint' : 'lcp'].push({
            at: e.startTime, render: e.renderTime || 0, load: e.loadTime || 0,
            url: e.url || '', element: e.element?.tagName || '', size: e.size || 0, name: e.name || '',
          });
        }).observe({ type, buffered: true }); } catch (_) { /* browser capability noted by empty list */ }
      }
    });
    await cdp.send('Tracing.start', { transferMode: 'ReturnAsStream',
      categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.screenshot,blink.user_timing,loading,cc,viz' });
    tracing = true;
    started = performance.now();
    const response = await tab.goto(ORIGIN + page.url, { waitUntil: 'load', timeout: 40000 });
    if (response?.status() !== 200) throw Error(`${label} HTML HTTP ${response?.status()}`);
    await tab.waitForTimeout(3500);
    const observed = await tab.evaluate(async () => {
      const probe = window.__lcpProbe || {};
      const hero = document.querySelector('.lp-hero img, #heroPhotoBg img.hero-img');
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => null) : null;
      const res = performance.getEntriesByType('resource').filter(e => /\/img\/(?:bento_1-mobile-640|head_mobile-640)\.avif|\/css\/style\.css|fonts\.(?:googleapis|gstatic)\.com|\/sw\.js/.test(e.name));
      return {
        probe, hero: { src: hero?.currentSrc, complete: hero?.complete, width: hero?.naturalWidth },
        navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
        resources: res.map(e => ({ name: e.name, start: e.startTime, end: e.responseEnd, transferSize: e.transferSize })),
        finalVisibility: { state: document.visibilityState, focus: document.hasFocus(), prerender: document.prerendering || false },
        sw: { controller: navigator.serviceWorker?.controller?.scriptURL || null, state: registration?.active?.state || registration?.installing?.state || registration?.waiting?.state || null },
      };
    });
    const raw = await readTrace(cdp); tracing = false;
    const zipped = gzipSync(raw, { level: 4 });
    fs.writeFileSync(path.join(OUT, 'traces', label + '.json.gz'), zipped);
    const network = [...net.values()].map(n => ({
      url: n.url, type: n.type, start: doc ? round((n.start - doc.timestamp) * 1000) : null,
      end: doc && n.finished ? round((n.finished - doc.timestamp) * 1000) : null,
      status: n.status || null, protocol: n.protocol || '', cached: n.cached || false, sw: n.fromSW || false, failed: n.failed || null,
    }));
    const relevant = network.filter(n => n.url.includes(page.hero) || n.url.includes('/css/style.css') ||
      /fonts\.(googleapis|gstatic)\.com|\/sw\.js/.test(n.url));
    const stats = cpuStats();
    const row = {
      label, page: page.name, pair: pair + 1, mode, browser: browser.version(), release: EXPECTED,
      trace: analyzeTrace(raw, page, network), observed, sw,
      network: relevant, fontCssCount: network.filter(n => n.url.includes('fonts.googleapis.com') && n.status === 200).length,
      fontFileCount: network.filter(n => n.url.includes('fonts.gstatic.com') && n.status === 200).length,
      loadAvg: [loadBefore[0], os.loadavg()[0]], cpuThrottle: {
        count: stats.throttled - startCpu.throttled, ms: round(stats.throttledMs - startCpu.throttledMs),
      },
      bytesGz: zipped.length,
    };
    notice(label, { raw: row.trace.rawLcpMs, po: observed.probe.lcp?.at(-1)?.at,
      fcp: observed.probe.paint?.find(e => e.name === 'first-contentful-paint')?.at,
      hero: row.trace.heroResponseEndMs, css: row.trace.cssResponseEndMs,
      gap: row.trace.maxNoDrawWindow, frames: row.trace.drawCount,
      fonts: [row.fontCssCount, row.fontFileCount], sw: row.sw.slice(0, 8),
      state: observed.sw, visibility: observed.finalVisibility, throttle: row.cpuThrottle,
      traceError: row.trace.error || null });
    if (row.trace.error || !observed.probe.lcp?.at(-1)?.url?.includes(page.hero) ||
        observed.hero.width !== 640 || !observed.hero.src?.includes(page.hero))
      throw Error(`${label} missing expected hero/LCP/trace: ${JSON.stringify({ trace: row.trace, hero: observed.hero, lcp: observed.probe.lcp })}`);
    if (mode === 'block' && (observed.sw.state || observed.sw.controller)) throw Error(`${label} SW unexpectedly active`);
    if (ORIGIN === 'https://milovicake.ru' && (!row.fontCssCount || !row.fontFileCount))
      throw Error(`${label} Google Fonts not fetched from real origins`);
    return row;
  } finally {
    if (tracing) await cdp.send('Tracing.end').catch(() => {});
    await context.close();
  }
}

async function main() {
  const summary = { expected: EXPECTED, origin: ORIGIN, dateUTC: new Date().toISOString(),
    profile: 'cold anonymous mobile 412x915 DPR 1.75, no network/CPU throttling, 3500ms post-load observation; no mocks',
    order: 'AB/BA alternating within fresh browser per pair; independent empty context per navigation',
    rows: [], errors: [] };
  const api = await request.newContext();
  try {
    await verifyRelease(api);
    for (const page of PAGES) {
      const count = process.env.LCP_PROBE_SMALL === '1' ? 1 : page.pairs;
      for (let i = 0; i < count; i++) {
        await verifyRelease(api);
        const browser = await chromium.launch({ headless: true });
        try {
          for (const mode of i % 2 ? ['block', 'allow'] : ['allow', 'block'])
            summary.rows.push(await collect(browser, page, i, mode));
        } catch (e) { summary.errors.push(`${page.name} pair ${i + 1}: ${e.stack || e}`); throw e; }
        finally { await browser.close(); }
      }
    }
    await verifyRelease(api);
  } finally {
    await api.dispose();
    fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  }
  for (const page of PAGES) {
    const rows = summary.rows.filter(r => r.page === page.name);
    const pairs = [];
    for (let i = 0; i < (process.env.LCP_PROBE_SMALL === '1' ? 1 : page.pairs); i++) {
      const a = rows.find(r => r.pair === i + 1 && r.mode === 'allow');
      const b = rows.find(r => r.pair === i + 1 && r.mode === 'block');
      pairs.push({ pair: i + 1, allow: a.trace.rawLcpMs, block: b.trace.rawLcpMs,
        deltaNoSW: round(b.trace.rawLcpMs - a.trace.rawLcpMs) });
    }
    notice(`${page.name}-paired-raw-LCP-ms`, pairs);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
