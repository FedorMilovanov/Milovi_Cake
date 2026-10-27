// TEMPORARY PR-only anonymous browser trace experiment; remove after review.
// One exact published SHA, real CDN + Google Fonts, no changes to visitor site.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');

const RELEASE = 'e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const LH = '/tmp/milovi-lighthouse/node_modules/lighthouse/cli/index.js';
const OUT = '/tmp/milovi-frame-traces';
const URLS = { gatchina: 'https://milovicake.ru/prigorody/gatchina/',
  privacy: 'https://milovicake.ru/privacy/' };
const ORDER = [['gatchina', 'privacy'], ['privacy', 'gatchina'],
  ['gatchina', 'privacy'], ['privacy', 'gatchina']];
const round = n => Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
const median = a => { const s = [...a].sort((x, y) => x - y);
  return (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2; };
const notice = (title, obj) => console.log(`::notice title=${title}::${JSON.stringify(obj)}`);

function cpu() {
  try {
    return Object.fromEntries(fs.readFileSync('/sys/fs/cgroup/cpu.stat', 'utf8')
      .split('\n').filter(Boolean).map(line => line.split(/\s+/)).map(([k, v]) => [k, Number(v)]));
  } catch { return {}; }
}
function cpuDelta(before, after) {
  return { throttledCount: (after.nr_throttled ?? 0) - (before.nr_throttled ?? 0),
    throttledMs: round(((after.throttled_usec ?? 0) - (before.throttled_usec ?? 0)) / 1000) };
}
function lighthouse(url, output) {
  const args = [LH, url, '--output=json', '--output-path=' + output, '--save-assets',
    '--quiet', '--only-categories=performance,accessibility,best-practices,seo',
    '--form-factor=mobile', '--throttling-method=simulate', '--screenEmulation.mobile=true',
    '--screenEmulation.width=412', '--screenEmulation.height=915',
    '--screenEmulation.deviceScaleFactor=1.75', '--throttling.rttMs=150',
    '--throttling.throughputKbps=1638.4', '--throttling.cpuSlowdownMultiplier=4',
    '--max-wait-for-load=45000',
    '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage'];
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', data => { err = (err + data).slice(-4000); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(Error(`Lighthouse ${code}: ${err}`)));
  });
}
function unionBusy(events, lo, hi) {
  const spans = events.filter(e => e.name === 'RunTask' && e.dur > 0 && e.ts < hi &&
    e.ts + e.dur > lo).map(e => [Math.max(e.ts, lo), Math.min(e.ts + e.dur, hi)])
    .sort((a, b) => a[0] - b[0]);
  let end = lo, busy = 0;
  for (const [start, stop] of spans) { busy += Math.max(0, stop - Math.max(start, end));
    end = Math.max(end, stop); }
  return round(busy / 1000);
}
function traceSummary(trace, report, readyMs) {
  const ev = trace.traceEvents;
  const nav = ev.find(e => e.name === 'navigationStart' &&
    e.args?.data?.isOutermostMainFrame && e.args.data.documentLoaderURL === report.finalUrl);
  if (!nav) throw Error('Missing exact URL navigationStart in browser trace');
  const zero = nav.ts, id = nav.args.data.navigationId;
  const fcpEvents = ev.filter(e => e.name === 'firstContentfulPaint' && e.ts >= zero &&
    (!e.args?.data?.navigationId || e.args.data.navigationId === id));
  if (!fcpEvents.length) throw Error('No matching firstContentfulPaint in trace');
  const paintTs = fcpEvents[0].ts, traceFcp = round((paintTs - zero) / 1000);
  const observed = report.audits.metrics.details.items[0].observedFirstContentfulPaint;
  if (Math.abs(traceFcp - observed) > 150)
    throw Error(`LHR raw FCP ${observed} does not match trace ${traceFcp}`);
  const start = zero + Math.max(0, readyMs) * 1000;
  const threads = new Map(ev.filter(e => e.name === 'thread_name')
    .map(e => [`${e.pid}/${e.tid}`, e.args?.name]));
  const main = ev.filter(e => e.pid === nav.pid && e.tid === nav.tid);
  const work = main.filter(e => e.name === 'RunTask' && e.dur > 0 &&
    e.ts < paintTs && e.ts + e.dur > start);
  const stages = ['DrawFrame', 'BeginFrame', 'BeginMainThreadFrame',
    'SubmitCompositorFrameToPresentationCompositorFrame', 'Screenshot',
    'Paint', 'Layout', 'UpdateLayoutTree', 'PrePaint', 'RasterTask'];
  const counts = Object.fromEntries(stages.map(name => [name, ev.filter(e =>
    e.name === name && start <= e.ts && e.ts < paintTs).length]));
  const frameNames = /visibility|occlud|background|freeze|resume/i;
  const visibility = ev.filter(e => start <= e.ts && e.ts < paintTs &&
    frameNames.test(e.name)).slice(0, 8).map(e =>
    [e.name, round((e.ts - zero) / 1000)]);
  const noDraw = [start, ...ev.filter(e => e.name === 'DrawFrame' &&
    start <= e.ts && e.ts < paintTs).map(e => e.ts).sort((a, b) => a - b), paintTs];
  const longestNoDraw = noDraw.slice(1).reduce((best, ts, i) =>
    ts - noDraw[i] > best ? ts - noDraw[i] : best, 0);
  return { traceFcp, readyMs: round(readyMs), gapAfterLastResourceMs: round(observed - readyMs),
    mainThread: threads.get(`${nav.pid}/${nav.tid}`) || null,
    mainBusyMs: unionBusy(work, start, paintTs), mainTasks: work.length,
    mainMaxTaskMs: round(Math.max(0, ...work.map(e => e.dur)) / 1000),
    longestNoDrawMs: round(longestNoDraw / 1000), frameEvents: counts, visibility };
}
function summarize(lhr, trace, page, block, run, cpuStats) {
  const url = URLS[page], a = lhr.audits || {}, cfg = lhr.configSettings || {};
  const m = a.metrics?.details?.items?.[0] || {};
  const items = a['network-requests']?.details?.items || [];
  const matched = needle => items.filter(x => x.url.includes(needle) && x.statusCode === 200);
  const ends = needle => matched(needle).map(x => round(x.networkEndTime));
  const last = needle => Math.max(0, ...ends(needle));
  const css = last('/css/style.css'), avif = last('/img/head_mobile.avif');
  const webp = last('/img/head_mobile.webp');
  const font = last('fonts.gstatic.com');
  const markup = items.filter(x => x.url === url && x.statusCode === 200);
  const element = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]
    ?.node?.selector || null;
  const phases = Object.fromEntries((a['largest-contentful-paint-element']?.details?.items?.[1]
    ?.items || []).map(x => [x.phase, round(x.timing)]));
  const browser = lhr.userAgent?.match(/HeadlessChrome\/([\d.]+)/)?.[1];
  if (lhr.finalUrl !== url || lhr.lighthouseVersion !== '12.6.1' ||
      cfg.throttlingMethod !== 'simulate' || cfg.throttling?.rttMs !== 150 ||
      cfg.throttling?.throughputKbps !== 1638.4 || cfg.throttling?.cpuSlowdownMultiplier !== 4 ||
      cfg.screenEmulation?.width !== 412 || cfg.screenEmulation?.height !== 915 ||
      !browser?.startsWith('155.') || !markup.length || !css || !element ||
      (page === 'gatchina' && (!avif || !webp || !matched('fonts.gstatic.com').length)) ||
      !Number.isFinite(m.observedFirstContentfulPaint) ||
      !Number.isFinite(m.observedLargestContentfulPaint))
    throw Error('Invalid Lighthouse release/browser/resources: ' + JSON.stringify({
      url: lhr.finalUrl, browser, css, avif, webp, element, fonts: ends('fonts.gstatic.com') }));
  const readyMs = Math.max(css, avif, font);
  const frame = traceSummary(trace, lhr, readyMs);
  return { block, run, page, simLcp: round(a['largest-contentful-paint']?.numericValue),
    rawFcp: round(m.observedFirstContentfulPaint), rawLcp: round(m.observedLargestContentfulPaint),
    simFcp: round(a['first-contentful-paint']?.numericValue),
    tbt: round(a['total-blocking-time']?.numericValue), element, phases,
    responseEndMs: { html: round(markup[0].networkEndTime), css, avif, webp, font },
    fontResponses: ends('fonts.gstatic.com').length, browser, cpu: cpuStats,
    consoleErrors: a['errors-in-console']?.details?.items?.length || 0,
    warnings: lhr.runWarnings || [], frame };
}
async function main() {
  if (!fs.existsSync(LH) || !process.env.CHROME_PATH) throw Error('Pinned browser/CLI missing');
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [], files = [];
  for (let block = 1; block <= ORDER.length; block++) {
    for (let i = 0; i < 2; i++) {
      const page = ORDER[block - 1][i], run = `${block}-${i+1}-${page}`;
      const file = path.join(OUT, run + '.json');
      const before = cpu();
      await lighthouse(URLS[page], file);
      const after = cpu();
      const report = JSON.parse(fs.readFileSync(file, 'utf8'));
      const traceFile = path.join(OUT, run + '-0.trace.json');
      const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
      const row = summarize(report, trace, page, block, run, cpuDelta(before, after));
      rows.push(row); files.push({ run, traceFile });
      notice('paint-trace-' + run, row);
      fs.rmSync(path.join(OUT, run + '-0.devtoolslog.json'), { force: true });
    }
  }
  if (rows.length !== 8 || rows.some(x => x.browser !== rows[0].browser))
    throw Error('Incomplete or mismatched-browser same-run controls');
  const perPage = Object.fromEntries(Object.keys(URLS).map(page => {
    const subset = rows.filter(r => r.page === page);
    return [page, { rawFcpMedian: round(median(subset.map(r => r.rawFcp))),
      simulatedLcpMedian: round(median(subset.map(r => r.simLcp))),
      slowRawFcp: subset.filter(r => r.rawFcp >= 750).length,
      over2500Sim: subset.filter(r => r.simLcp > 2500).length }];
  }));
  const summary = { release: RELEASE, browser: rows[0].browser, lighthouse: '12.6.1',
    mode: 'read-only paired-page trace (NOT variant A/B or visitor field data)',
    perPage, rows };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  notice('paint-trace-summary', { release: RELEASE, perPage });
  // Retain only representative anonymized Chrome traces (fastest/slowest on each URL).
  const selected = new Set(Object.keys(URLS).flatMap(page => {
    const subset = rows.filter(r => r.page === page).sort((a, b) => a.rawFcp - b.rawFcp);
    return [subset[0].run, subset[subset.length - 1].run];
  }));
  for (const { run, traceFile } of files) {
    if (selected.has(run)) fs.writeFileSync(traceFile + '.gz',
      zlib.gzipSync(fs.readFileSync(traceFile), { level: 6 }));
    fs.rmSync(traceFile);
  }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { traceSummary };
