// TEMPORARY PR-only Lighthouse control; delete after recording results.
// Three variants of ONE head preload on the exact deployed SHA, served from a local
// HTTPS/h2 fixture. No production change, visitor data, or threshold adjustment.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http2 = require('node:http2');
const zlib = require('node:zlib');
const { spawn, execFileSync } = require('node:child_process');

const EXPECTED = 'e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const ROOT = path.resolve(process.env.LCP_FIXTURE_ROOT || '/tmp/milovi-lh-fixture');
const LH = process.env.LCP_LIGHTHOUSE_CLI || '/tmp/milovi-lighthouse/node_modules/lighthouse/cli/index.js';
const OUT = process.env.LCP_OUTPUT || '/tmp/milovi-lh-gatchina-pairs';
const PILOT = process.env.LCP_LOCAL_PILOT === '1';
const N = PILOT ? 2 : 8;
const PAGE = '/prigorody/gatchina/';
const WRONG = '<link rel="preload" as="image" href="../../img/head_mobile.webp" media="(max-width:768px)" fetchpriority="high" />';
const RIGHT = '<link rel="preload" as="image" type="image/avif" href="../../img/head_mobile.avif" media="(max-width:768px)" fetchpriority="high" />';
const markup = fs.readFileSync(path.join(ROOT, PAGE, 'index.html'), 'utf8');
if (markup.split(WRONG).length !== 2 || markup.includes(RIGHT) || !fs.existsSync(LH))
  throw Error('Expected exact published HTML and an installed Lighthouse CLI');
const variants = { published: markup, none: markup.replace(WRONG, ''),
  matched: markup.replace(WRONG, RIGHT) };
const permutations = [
  ['published', 'none', 'matched'], ['none', 'matched', 'published'],
  ['matched', 'published', 'none'], ['none', 'published', 'matched'],
  ['matched', 'none', 'published'], ['published', 'matched', 'none'],
];
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.webm': 'video/webm', '.mp4': 'video/mp4' };
const round = v => typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
const median = arr => { const a = [...arr].sort((x, y) => x - y);
  return (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2; };
const notice = (name, payload) => console.log(`::notice title=${name}::${JSON.stringify(payload)}`);

function startServer(certDir, active) {
  const server = http2.createSecureServer({ key: fs.readFileSync(path.join(certDir, 'key')),
    cert: fs.readFileSync(path.join(certDir, 'cert')), allowHTTP1: false });
  const sessions = new Set();
  server.on('session', s => { sessions.add(s); s.on('close', () => sessions.delete(s)); });
  server.on('stream', (stream, headers) => {
    const url = new URL(headers[':path'], 'https://localhost');
    let data, type;
    if (url.pathname === PAGE) {
      data = Buffer.from(variants[active.arm]); type = mime['.html'];
    } else {
      const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        stream.respond({ ':status': 404 }); stream.end(); return;
      }
      data = fs.readFileSync(file); type = mime[path.extname(file)] || 'application/octet-stream';
    }
    const reply = { ':status': 200, 'content-type': type,
      'cache-control': url.pathname === PAGE ? 'no-store' : 'public, max-age=600' };
    if (/gzip/.test(headers['accept-encoding'] || '') && /(?:^text\/|javascript|json)/.test(type)) {
      data = zlib.gzipSync(data); reply['content-encoding'] = 'gzip';
    }
    reply['content-length'] = data.length;
    stream.respond(reply); stream.end(data);
  });
  return { server, sessions };
}

function cli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', chunk => { err = (err + chunk).slice(-6000); });
    proc.on('error', reject);
    proc.on('close', code => code === 0 ? resolve() : reject(Error(`Lighthouse exit ${code}: ${err}`)));
  });
}

function summarizeReport(lhr, arm, block, url) {
  const a = lhr.audits || {};
  const metrics = a.metrics?.details?.items?.[0] || {};
  const lcp = a['largest-contentful-paint-element']?.details?.items || [];
  const phases = Object.fromEntries((lcp[1]?.items || []).map(x => [x.phase, round(x.timing)]));
  const items = a['network-requests']?.details?.items || [];
  const image = file => items.filter(x => x.url.includes('/img/' + file));
  const old = image('head_mobile.webp');
  const selected = image('head_mobile.avif');
  const css = items.filter(x => x.url.includes('/css/style.css'));
  const fontsCSS = items.filter(x => x.url.includes('fonts.googleapis.com') && x.statusCode === 200);
  const fontsFile = items.filter(x => x.url.includes('fonts.gstatic.com') && x.statusCode === 200);
  const chrome = lhr.userAgent?.match(/HeadlessChrome\/([\d.]+)/)?.[1];
  const cfg = lhr.configSettings || {};
  const row = { block, arm, simLcp: round(a['largest-contentful-paint']?.numericValue),
    rawLcp: round(metrics.observedLargestContentfulPaint),
    simFcp: round(a['first-contentful-paint']?.numericValue),
    rawFcp: round(metrics.observedFirstContentfulPaint), tbt: round(a['total-blocking-time']?.numericValue),
    cls: round(a['cumulative-layout-shift']?.numericValue), phases,
    element: lcp[0]?.items?.[0]?.node?.selector || null,
    wrong: old.map(x => ({ end: round(x.networkEndTime), bytes: x.transferSize, status: x.statusCode })),
    avif: selected.map(x => ({ end: round(x.networkEndTime), bytes: x.transferSize, status: x.statusCode })),
    cssEnd: round(css[0]?.networkEndTime), fontCss: fontsCSS.length, fontFile: fontsFile.length,
    browser: chrome, lighthouse: lhr.lighthouseVersion, finalUrl: lhr.finalUrl,
    warnings: lhr.runWarnings || [], consoleErrors: a['errors-in-console']?.details?.items?.length || 0 };
  row.candidate = row.element?.includes('hero-photo-bg > picture > img') ? 'hero' :
    row.element?.includes('mc-consent-dialog') ? 'consent' : 'other';
  if (lhr.finalUrl !== url || lhr.lighthouseVersion !== '12.6.1' ||
      cfg.throttlingMethod !== 'simulate' || cfg.throttling?.rttMs !== 150 ||
      cfg.throttling?.throughputKbps !== 1638.4 || cfg.throttling?.cpuSlowdownMultiplier !== 4 ||
      cfg.screenEmulation?.width !== 412 || cfg.screenEmulation?.height !== 915 ||
      !row.simLcp || !row.rawLcp || !row.browser || !row.element ||
      old.length !== (arm === 'published' ? 1 : 0) || selected.length !== 1 ||
      [...old, ...selected, ...css].some(x => x.statusCode !== 200) || !css.length ||
      (!PILOT && (!fontsCSS.length || !fontsFile.length)))
    throw Error('Invalid trial ' + JSON.stringify(row));
  return row;
}

function aggregate(rows) {
  const grouped = Object.fromEntries(Object.keys(variants).map(arm => {
    const group = rows.filter(r => r.arm === arm);
    const phases = Object.fromEntries(['TTFB', 'Load Delay', 'Load Time', 'Render Delay']
      .map(key => [key, round(median(group.map(r => r.phases[key]).filter(Number.isFinite)))]));
    const candidates = Object.fromEntries([...new Set(group.map(r => r.candidate))]
      .map(key => [key, group.filter(r => r.candidate === key).length]));
    return [arm, { sim: round(median(group.map(r => r.simLcp))),
      raw: round(median(group.map(r => r.rawLcp))),
      phases, candidates, fontRuns: group.filter(r => r.fontCss && r.fontFile).length,
      excessWebpRuns: group.filter(r => r.wrong.length).length,
      clsMax: Math.max(...group.map(r => r.cls || 0)) }];
  }));
  const comparisons = {};
  for (const [name, a, b] of [['removeWebp', 'published', 'none'],
    ['addCorrectPreload', 'none', 'matched'], ['combined', 'published', 'matched']]) {
    const pairs = Array.from({ length: N }, (_, i) => {
      const left = rows.find(x => x.block === i + 1 && x.arm === a);
      const right = rows.find(x => x.block === i + 1 && x.arm === b);
      return { block: i + 1, from: left.candidate, to: right.candidate,
        comparable: left.element === right.element, sim: round(right.simLcp - left.simLcp),
        raw: round(right.rawLcp - left.rawLcp) };
    });
    const summarize = subset => ({ n: subset.length,
      medianSimDelta: round(median(subset.map(x => x.sim))),
      faster: subset.filter(x => x.sim < 0).length,
      slower: subset.filter(x => x.sim > 0).length,
      simDeltas: subset.map(x => x.sim), rawDeltas: subset.map(x => x.raw) });
    comparisons[name] = { all: summarize(pairs),
      sameElement: summarize(pairs.filter(x => x.comparable)),
      hero: summarize(pairs.filter(x => x.comparable && x.from === 'hero')),
      consent: summarize(pairs.filter(x => x.comparable && x.from === 'consent')),
      candidates: pairs.map(x => `${x.from}>${x.to}`) };
  }
  return { grouped, comparisons };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'milovi-lh-cert-'));
  execFileSync('openssl', ['req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', path.join(dir, 'key'), '-out', path.join(dir, 'cert')],
  { stdio: 'ignore' });
  const active = { arm: 'published' };
  const { server, sessions } = startServer(dir, active);
  const rows = [];
  try {
    await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
    const target = `https://127.0.0.1:${server.address().port}${PAGE}`;
    async function runLighthouse(url, output) {
      const args = [LH, url, '--output=json', '--output-path=' + output, '--quiet',
        '--only-categories=performance,accessibility,best-practices,seo',
        '--form-factor=mobile', '--throttling-method=simulate',
        '--screenEmulation.mobile=true', '--screenEmulation.width=412',
        '--screenEmulation.height=915', '--screenEmulation.deviceScaleFactor=1.75',
        '--throttling.rttMs=150', '--throttling.throughputKbps=1638.4',
        '--throttling.cpuSlowdownMultiplier=4', '--max-wait-for-load=45000',
        '--chrome-flags=--headless=new --no-sandbox --ignore-certificate-errors --disable-dev-shm-usage',
        ...(PILOT ? ['--blocked-url-patterns=*fonts.googleapis.com*',
          '--blocked-url-patterns=*fonts.gstatic.com*'] : [])];
      await cli(args);
      return JSON.parse(fs.readFileSync(output, 'utf8'));
    }
    // One unmodified CDN reference checks whether the fixture selects the same
    // LCP element on this browser; it is NOT paired with the fixture timings.
    let live = null;
    if (!PILOT) {
      const liveUrl = 'https://milovicake.ru' + PAGE;
      live = summarizeReport(await runLighthouse(liveUrl, path.join(OUT, 'live-reference.json')),
        'published', 0, liveUrl);
      notice('Gatchina-simulated-live-candidate', { sim: live.simLcp, raw: live.rawLcp,
        candidate: live.candidate, element: live.element, browser: live.browser,
        fonts: live.fontFile, wrong: live.wrong.length, avif: live.avif.length });
    }
    for (let block = 1; block <= N; block++) {
      const order = permutations[(block - 1) % permutations.length];
      for (const arm of order) {
        active.arm = arm;
        const output = path.join(OUT, `${String(block).padStart(2, '0')}-${arm}.json`);
        const row = summarizeReport(await runLighthouse(target, output), arm, block, target);
        rows.push(row);
        console.log('valid trial', block, arm, 'sim', row.simLcp, 'raw', row.rawLcp,
          'candidate', row.candidate, 'resources', row.wrong.length,
          row.avif.length, 'fonts', row.fontFile);
      }
    }
    if (rows.length !== 3 * N || new Set(rows.map(r => r.browser)).size !== 1 ||
        (live && live.browser !== rows[0].browser))
      throw Error('Invalid trial count or browser version varied: ' + rows.length);
    const result = { expectedRelease: EXPECTED, fixture: 'git archive exact published tree',
      pilot: PILOT, chromium: rows[0].browser, lighthouse: rows[0].lighthouse,
      n: N, htmlBytes: Object.fromEntries(Object.entries(variants)
        .map(([key, value]) => [key, [Buffer.byteLength(value), zlib.gzipSync(value).length]])),
      live, rows, ...aggregate(rows) };
    fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
    notice('Gatchina-simulated-validation', { release: EXPECTED, browser: result.chromium,
      lighthouse: result.lighthouse, trials: rows.length, pilot: PILOT,
      htmlBytes: result.htmlBytes, fontRuns: rows.filter(r => r.fontCss && r.fontFile).length,
      wrongOriginal: rows.filter(r => r.arm === 'published' && r.wrong.length).length,
      wrongOther: rows.filter(r => r.arm !== 'published' && r.wrong.length).length });
    notice('Gatchina-simulated-medians', result.grouped);
    for (const [name, comparison] of Object.entries(result.comparisons))
      notice('Gatchina-simulated-' + name, comparison);
    for (let block = 1; block <= N; block++)
      notice('Gatchina-simulated-block-' + block, rows.filter(r => r.block === block)
        .map(r => [r.arm, r.candidate, r.simLcp, r.rawLcp,
          r.phases['Load Delay'], r.phases['Load Time'], r.phases['Render Delay']]));
  } finally {
    for (const s of sessions) s.destroy();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
