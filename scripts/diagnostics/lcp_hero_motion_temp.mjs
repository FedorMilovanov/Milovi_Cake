// Temporary PR-only Lighthouse controls; remove after recording results.
// Exact live CDN, real Fonts, pinned Chrome. Motion mode changes only the hero
// animation; consent mode pre-records denial in the lab tab so the dialog stays
// closed. No production patch, analytics opt-in or field data.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import lighthouse from '/tmp/milovi-lighthouse/node_modules/lighthouse/core/index.js';

const require = createRequire(import.meta.url);
const chromeLauncher = require('/tmp/milovi-lighthouse/node_modules/chrome-launcher');
const puppeteer = require('/tmp/milovi-lighthouse/node_modules/puppeteer-core');
const URL = 'https://milovicake.ru/prigorody/gatchina/';
const RELEASE = 'e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const CONTROL = process.env.LCP_CONTROL === 'consent' ? 'consent' : 'motion';
const OUT = `/tmp/milovi-lh-${CONTROL}-control`;
const comparisonArm = CONTROL === 'consent' ? 'pre-denied' : 'animation-off';
const ORDERS = Array.from({length: CONTROL === 'consent' ? 8 : 4}, (_, i) =>
  i % 2 === 0 ? ['original', comparisonArm] : [comparisonArm, 'original']);
const round = n => Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
const median = values => { const s = [...values].sort((a, b) => a - b);
  return (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2; };
const notice = (title, obj) => console.log(`::notice title=${title}::${JSON.stringify(obj)}`);

function initDocument(arm) {
  // Lighthouse clears storage before navigating. A true fresh visit and a
  // returning, already-denied visit must both keep analytics disabled. Only
  // the modal auto-open differs; never grant consent or suppress the script.
  let consentAtStart = null;
  try {
    if (location.origin === 'https://milovicake.ru') {
      if (arm === 'pre-denied')
        localStorage.setItem('milovi_analytics_consent_v1', 'denied');
      consentAtStart = localStorage.getItem('milovi_analytics_consent_v1');
    }
  } catch (error) { consentAtStart = 'storage-error'; }
  function inject() {
    if (document.getElementById('__hero_motion_lab')) return;
    const root = document.head || document.documentElement;
    if (!root) return;
    const style = document.createElement('style');
    style.id = '__hero_motion_lab';
    const selector = '.hero--visible.hero--motion-ready .hero-photo-bg img';
    // Both consent arms are inert here. Motion B changes only animation.
    style.textContent = selector + '{' + (arm === 'animation-off' ?
      'animation:none !important' : '--lcp-diagnostic-inert:0') + '}';
    root.appendChild(style);
    window.__heroMotionLab = {arm, consentAtStart, insertedMs: performance.now(),
      insertionParent: root.tagName, milestones: []};
  }
  inject();
  if (!window.__heroMotionLab) {
    const observer = new MutationObserver(() => {
      inject();
      if (window.__heroMotionLab) observer.disconnect();
    });
    observer.observe(document, {childList: true, subtree: true});
  }
  const stamp = kind => {
    const img = document.querySelector('.hero-photo-bg img');
    if (!window.__heroMotionLab) return;
    const overlay = document.querySelector('.mc-consent-overlay');
    window.__heroMotionLab.milestones.push({kind, ms: Math.round(performance.now()),
      complete: img?.complete, width: img?.naturalWidth, inlineOpacity: img?.style.opacity,
      currentSrc: img?.currentSrc, animation: img && getComputedStyle(img).animationName,
      heroClass: img?.closest('.hero')?.className,
      consentOpen: overlay && !overlay.hidden,
      consentChoice: window.MiloviConsent?.getChoice(),
      fonts: document.fonts?.status, readyState: document.readyState});
  };
  document.addEventListener('DOMContentLoaded', () => stamp('domcontentloaded'), {once: true});
  window.addEventListener('load', () => stamp('load'), {once: true});
}

function frameSummary(trace, rawFcp, ready) {
  const events = trace.traceEvents || [];
  const nav = events.find(e => e.name === 'navigationStart' &&
    e.args?.data?.isOutermostMainFrame && e.args.data.documentLoaderURL === URL);
  if (!nav) throw Error('Missing exact live navigationStart');
  const fcp = events.find(e => e.name === 'firstContentfulPaint' && e.ts > nav.ts &&
    e.args?.data?.navigationId === nav.args.data.navigationId);
  if (!fcp || Math.abs((fcp.ts - nav.ts) / 1000 - rawFcp) > 150)
    throw Error('Lighthouse and trace disagree on first contentful paint');
  const start = nav.ts + ready * 1000;
  const relevant = events.filter(e => e.ts >= start && e.ts < fcp.ts);
  const count = name => relevant.filter(e => e.name === name).length;
  const frameTimes = [start, ...relevant.filter(e => e.name === 'DrawFrame')
    .map(e => e.ts).sort((a, b) => a - b), fcp.ts];
  const noDraw = Math.max(0, ...frameTimes.slice(1).map((x, i) => x - frameTimes[i]));
  const mainTasks = relevant.filter(e => e.name === 'RunTask' &&
    e.pid === nav.pid && e.tid === nav.tid);
  return {traceFcp: round((fcp.ts - nav.ts) / 1000), gapAfterResources: round(rawFcp - ready),
    raster: count('RasterTask'), draw: count('DrawFrame'), paint: count('Paint'),
    longestNoDraw: round(noDraw / 1000), mainTasks: mainTasks.length};
}

function summary(lhr, arm, block, pageData, trace) {
  const a = lhr.audits || {};
  const m = a.metrics?.details?.items?.[0] || {};
  const cfg = lhr.configSettings || {};
  const requests = a['network-requests']?.details?.items || [];
  const match = needle => requests.filter(r => r.url.includes(needle) && r.statusCode === 200);
  const finished = needle => Math.max(0, ...match(needle).map(r => r.networkEndTime || 0));
  const hero = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]
    ?.node?.selector || null;
  const phases = Object.fromEntries((a['largest-contentful-paint-element']?.details?.items?.[1]
    ?.items || []).map(x => [x.phase, round(x.timing)]));
  const browser = lhr.userAgent?.match(/HeadlessChrome\/([\d.]+)/)?.[1];
  const row = {block, arm, browser, simLcp: round(a['largest-contentful-paint']?.numericValue),
    rawFcp: round(m.observedFirstContentfulPaint),
    rawLcp: round(m.observedLargestContentfulPaint),
    cls: round(a['cumulative-layout-shift']?.numericValue),
    tbt: round(a['total-blocking-time']?.numericValue), hero, phases,
    resources: {css: round(finished('/css/style.css')), avif: round(finished('/img/head_mobile.avif')),
      webp: round(finished('/img/head_mobile.webp')), script: round(finished('/js/main.js')),
      fontCss: match('fonts.googleapis.com').length,
      fontFiles: match('fonts.gstatic.com').length,
      lastFont: round(finished('fonts.gstatic.com'))},
    traceEvents: trace.traceEvents?.length || 0,
    frame: frameSummary(trace, m.observedFirstContentfulPaint,
      Math.max(finished('/css/style.css'), finished('/img/head_mobile.avif'),
        finished('fonts.gstatic.com'))),
    page: pageData, warnings: lhr.runWarnings || []};
  if (lhr.finalUrl !== URL || lhr.lighthouseVersion !== '12.6.1' ||
      cfg.throttlingMethod !== 'simulate' || cfg.throttling?.rttMs !== 150 ||
      cfg.throttling?.throughputKbps !== 1638.4 ||
      cfg.throttling?.cpuSlowdownMultiplier !== 4 ||
      cfg.screenEmulation?.width !== 412 || cfg.screenEmulation?.height !== 915 ||
      !browser?.startsWith('155.') || !row.rawFcp || !row.rawLcp || !row.simLcp ||
      !row.resources.css || !row.resources.avif || !row.resources.webp ||
      !row.resources.script || !row.resources.fontCss || !row.resources.fontFiles ||
      !hero || row.traceEvents < 1000 || lhr.runtimeError ||
      pageData.lab?.arm !== arm || !pageData.lab?.insertedMs ||
      pageData.lab?.insertedMs > 1200 ||
      pageData.lab?.insertedMs >= row.rawFcp ||
      !pageData.lab?.milestones?.some(x => x.kind === 'domcontentloaded' &&
        x.currentSrc?.endsWith('/img/head_mobile.avif')) ||
      !pageData.lab?.milestones?.some(x => x.kind === 'load' &&
        x.currentSrc?.endsWith('/img/head_mobile.avif')) ||
      pageData.injection !== '.hero--visible.hero--motion-ready .hero-photo-bg img{' +
        (arm === 'animation-off' ? 'animation:none !important' : '--lcp-diagnostic-inert:0') + '}' ||
      pageData.animation !== (arm === 'animation-off' ? 'none' : 'heroKenBurns') ||
      (CONTROL === 'consent' && (
        pageData.lab.consentAtStart !== (arm === 'original' ? null : 'denied') ||
        pageData.consent?.choice !== 'denied' ||
        pageData.consent?.open !== (arm === 'original') ||
        pageData.consent?.analyticsLoaded || pageData.consent?.bodyOpen !==
          (arm === 'original')))) {
    throw Error('Invalid pinned live trial: ' + JSON.stringify(row));
  }
  return row;
}

async function trial(block, arm) {
  const chrome = await chromeLauncher.launch({chromeFlags: [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage'], logLevel: 'error'});
  let browser;
  try {
    browser = await puppeteer.connect({browserURL: `http://127.0.0.1:${chrome.port}`,
      defaultViewport: null});
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(initDocument, arm);
    const flags = {logLevel: 'error', onlyCategories: [
      'performance', 'accessibility', 'best-practices', 'seo'], formFactor: 'mobile',
    throttlingMethod: 'simulate', throttling: {rttMs: 150,
      throughputKbps: 1638.4, cpuSlowdownMultiplier: 4},
    screenEmulation: {mobile: true, width: 412, height: 915,
      deviceScaleFactor: 1.75, disabled: false}, maxWaitForLoad: 45000};
    const result = await lighthouse(URL, flags, undefined, page);
    if (!result?.lhr || !result.artifacts?.Trace) throw Error('Missing Lighthouse result/trace');
    // Lighthouse restores viewport emulation after gathering. Read the mobile
    // currentSrc recorded at DOMContentLoaded/load, not post-audit currentSrc.
    const data = await page.evaluate(() => {
      const img = document.querySelector('.hero-photo-bg img');
      const overlay = document.querySelector('.mc-consent-overlay');
      return {lab: window.__heroMotionLab || null,
        injection: document.getElementById('__hero_motion_lab')?.textContent,
        currentSrc: img?.currentSrc || '', animation: img && getComputedStyle(img).animationName,
        opacity: img && getComputedStyle(img).opacity, heroClass: img?.closest('.hero')?.className,
        consent: {choice: window.MiloviConsent?.getChoice(),
          open: Boolean(overlay && !overlay.hidden && overlay.classList.contains('is-open')),
          bodyOpen: document.body.classList.contains('mc-consent-open'),
          analyticsLoaded: Boolean(document.querySelector('[data-milovi-ga], [data-milovi-ym]'))}};
    });
    const row = summary(result.lhr, arm, block, data, result.artifacts.Trace);
    const prefix = path.join(OUT, `${String(block).padStart(2, '0')}-${arm}`);
    fs.writeFileSync(prefix + '.lhr.json', JSON.stringify(result.lhr));
    fs.writeFileSync(prefix + '.trace.json.gz', zlib.gzipSync(
      JSON.stringify(result.artifacts.Trace), {level: 3}));
    notice(`${CONTROL}-${block}-${arm}`, {block, arm, sim: row.simLcp,
      rawFcp: row.rawFcp, rawLcp: row.rawLcp, element: row.hero,
      resourceEnd: row.resources, animation: row.page.animation,
      consent: row.page.consent, milestones: row.page.lab.milestones,
      frame: row.frame, cls: row.cls});
    return row;
  } finally {
    await browser?.disconnect().catch(() => {});
    await chrome.kill();
  }
}

async function main() {
  if (!process.env.CHROME_PATH || !fs.existsSync(process.env.CHROME_PATH))
    throw Error('Exact pinned browser missing');
  fs.mkdirSync(OUT, {recursive: true});
  const rows = [];
  for (let block = 1; block <= ORDERS.length; block++) {
    for (const arm of ORDERS[block - 1]) rows.push(await trial(block, arm));
  }
  if (rows.length !== ORDERS.length * 2 || new Set(rows.map(r => r.browser)).size !== 1)
    throw Error('Mismatched Chrome builds or incomplete comparison');
  const deltas = ORDERS.map((_, i) => {
    const a = rows.find(r => r.block === i + 1 && r.arm === 'original');
    const b = rows.find(r => r.block === i + 1 && r.arm === comparisonArm);
    return {block: i + 1, rawFcp: round(b.rawFcp - a.rawFcp),
      rawLcp: round(b.rawLcp - a.rawLcp), simLcp: round(b.simLcp - a.simLcp),
      sameLcpElement: a.hero === b.hero};
  });
  const group = Object.fromEntries(ORDERS[0].map(arm => {
    const r = rows.filter(row => row.arm === arm);
    return [arm, {rawFcp: median(r.map(x => x.rawFcp)), rawLcp: median(r.map(x => x.rawLcp)),
      simLcp: round(median(r.map(x => x.simLcp))),
      slowRaw: r.filter(x => x.rawFcp >= 750).length,
      warning: r.filter(x => x.simLcp > 2500).length,
      heroLcp: r.filter(x => x.hero.includes('hero-photo-bg')).length}];
  }));
  const output = {release: RELEASE, browser: rows[0].browser, control: CONTROL,
    lighthouse: '12.6.1', label: 'paired lab CDP override on live CDN, NOT a deploy or field p75',
    group, deltas, rows};
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(output, null, 2));
  notice(`${CONTROL}-summary`, {release: RELEASE, browser: output.browser, group, deltas,
    medianRawFcpDelta: round(median(deltas.map(x => x.rawFcp))),
    comparisonFaster: deltas.filter(x => x.rawFcp < 0).length});
}
main().catch(err => {console.error(err); process.exitCode = 1;});
