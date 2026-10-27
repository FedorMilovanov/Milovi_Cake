// TEMPORARY read-only paired lab control. Remove after the evidence is recorded.
// Rewrites one preload only in a browser's response, never on the public server.
'use strict';
const { chromium, request } = require('playwright');

const ORIGIN = 'https://milovicake.ru';
const PAGE = '/prigorody/gatchina/';
const EXPECTED = 'e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const OLD = '<link rel="preload" as="image" href="../../img/head_mobile.webp" media="(max-width:768px)" fetchpriority="high" />';
const NEW = '<link rel="preload" as="image" type="image/avif" href="../../img/head_mobile.avif" media="(max-width:768px)" fetchpriority="high" />';
const round = n => n == null ? null : Math.round(n * 10) / 10;
const median = list => { const a = [...list].sort((x, y) => x - y); return (a[(a.length - 1) >> 1] + a[a.length >> 1]) / 2; };
const notice = (title, data) => console.log(`::notice title=${title}::${JSON.stringify(data)}`);

async function prove(api) {
  const r = await api.get(ORIGIN + '/release.json', {
    headers: { 'cache-control': 'no-cache' }, timeout: 20000 });
  if (!r.ok()) throw Error('Release proof HTTP ' + r.status());
  const release = await r.json();
  if (release.repository !== 'FedorMilovanov/Milovi_Cake' || release.sha !== EXPECTED)
    throw Error('Published release changed; abort before the next pair: ' + JSON.stringify(release));
}

async function trial(browser, profile, pair, mode) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 },
    deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, colorScheme: 'light',
    reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    let rewrite = 0;
    // Both arms use the identical intercepted response path; only one preload differs.
    await context.route(ORIGIN + PAGE, async route => {
      const r = await route.fetch({ headers: { ...route.request().headers(), 'cache-control': 'no-cache' } });
      if (r.status() !== 200) throw Error('HTML response ' + r.status());
      const body = await r.text();
      if (body.split(OLD).length !== 2 || body.includes(NEW)) throw Error('Unexpected published HTML');
      rewrite++;
      const headers = Object.fromEntries(Object.entries(r.headers())
        .filter(([key]) => !['content-length', 'content-encoding', 'transfer-encoding'].includes(key.toLowerCase())));
      await route.fulfill({ status: r.status(), headers, body: mode === 'fixed' ? body.replace(OLD, NEW) : body });
    });
    const tab = await context.newPage();
    const cdp = await context.newCDPSession(tab);
    const requests = [];
    cdp.on('Network.responseReceived', e => {
      if (/fonts\.(?:googleapis|gstatic)\.com/.test(e.response.url))
        requests.push({ url: e.response.url, status: e.response.status });
    });
    const errors = [];
    tab.on('pageerror', e => errors.push(e.message));
    tab.on('requestfailed', r => {
      if (r.url().startsWith(ORIGIN)) errors.push(r.url() + ': ' + r.failure()?.errorText);
    });
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (profile === 'slow') {
      // Actual browser throttling, NOT Lighthouse Lantern simulation.
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
        downloadThroughput: 1638.4 * 1024 / 8, uploadThroughput: 675 * 1024 / 8,
        connectionType: 'cellular4g' });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await tab.addInitScript(() => {
      window.__gatchinaLcp = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__gatchinaLcp.push({
          at: entry.startTime, url: entry.url, tag: entry.element?.tagName });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const response = await tab.goto(ORIGIN + PAGE, { waitUntil: 'load', timeout: 45000 });
    await tab.waitForTimeout(650);
    const data = await tab.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const match = filename => resources.filter(x => x.name.endsWith('/img/' + filename))
        .map(x => ({ start: x.startTime, end: x.responseEnd, size: x.transferSize, initiator: x.initiatorType }));
      const hero = document.querySelector('.hero-photo-bg img');
      return { lcp: window.__gatchinaLcp.at(-1), fcp: performance.getEntriesByType('paint')
        .find(x => x.name === 'first-contentful-paint')?.startTime,
        avif: match('head_mobile.avif'), webp: match('head_mobile.webp'),
        heroSrc: hero?.currentSrc, width: hero?.naturalWidth, visible: document.visibilityState,
        focused: document.hasFocus(), fontStatus: document.fonts.status };
    });
    const fontCss = requests.filter(x => x.url.includes('fonts.googleapis.com') && x.status === 200).length;
    const fontFile = requests.filter(x => x.url.includes('fonts.gstatic.com') && x.status === 200).length;
    const row = { profile, pair, mode, chrome: browser.version(), code: EXPECTED,
      rawLcp: round(data.lcp?.at), rawFcp: round(data.fcp), lcpUrl: data.lcp?.url,
      heroSrc: data.heroSrc,
      avif: data.avif.map(x => ({ ...x, start: round(x.start), end: round(x.end) })),
      webp: data.webp.map(x => ({ ...x, start: round(x.start), end: round(x.end) })),
      width: data.width, visible: data.visible, focused: data.focused, fontCss, fontFile,
      fontStatus: data.fontStatus, rewrite, status: response?.status(), errors };
    // Hosted Chrome can update from 155 to 156; only compare arms within one run.
    if (!/^15[56]\./.test(row.chrome) || row.rewrite !== 1 || row.status !== 200 ||
        !row.lcpUrl?.endsWith('/img/head_mobile.avif') ||
        !row.heroSrc?.endsWith('/img/head_mobile.avif') || !row.width ||
        row.visible !== 'visible' || !row.focused || !fontCss || !fontFile ||
        row.avif.length !== 1 || row.webp.length !== (mode === 'published' ? 1 : 0) || errors.length)
      throw Error('Invalid paired control: ' + JSON.stringify(row));
    return row;
  } finally { await context.close(); }
}

async function main() {
  const api = await request.newContext();
  try {
    await prove(api);
    for (const [profile, count] of [['slow', 8], ['fast', 4]]) {
      const rows = [];
      for (let pair = 1; pair <= count; pair++) {
        await prove(api);
        const browser = await chromium.launch({ headless: true, channel: 'chrome' });
        try {
          for (const mode of pair % 2 ? ['published', 'fixed'] : ['fixed', 'published'])
            rows.push(await trial(browser, profile, pair, mode));
        } finally { await browser.close(); }
        console.log('valid pair', profile, pair, rows.filter(x => x.pair === pair)
          .map(x => [x.mode, x.rawLcp, x.avif[0].end, x.webp[0]?.end]));
      }
      if (rows.some(x => x.chrome !== rows[0].chrome)) throw Error('Browser version changed within control');
      const a = rows.filter(x => x.mode === 'published');
      const b = rows.filter(x => x.mode === 'fixed');
      const deltas = a.map(x => round(b.find(y => y.pair === x.pair).rawLcp - x.rawLcp));
      notice(`${profile}-paired-timing`, a.map(x => {
        const y = b.find(r => r.pair === x.pair);
        return { pair: x.pair, publishedLcp: x.rawLcp, correctedLcp: y.rawLcp,
          delta: round(y.rawLcp - x.rawLcp), avifEndOriginal: x.avif[0].end,
          avifEndCorrected: y.avif[0].end, webpEndOriginal: x.webp[0]?.end };
      }));
      notice(`${profile}-summary`, { release: EXPECTED, runs: rows.length, browser: rows[0].chrome,
        rawPublished: round(median(a.map(x => x.rawLcp))), rawCorrected: round(median(b.map(x => x.rawLcp))),
        pairedDelta: round(median(deltas)), correctedFaster: deltas.filter(x => x < 0).length,
        correctedSlower: deltas.filter(x => x > 0).length, deltas,
        webpFetchedOriginal: a.filter(x => x.webp.length === 1).length,
        webpFetchedCorrected: b.filter(x => x.webp.length === 1).length });
      await prove(api);
    }
  } finally { await api.dispose(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
