// PR-only evidence: cold #102/#103 source pairs on ONE Linux runner, real fonts.
// Serves exact committed sources over local HTTPS/h2; never deploys or edits site.
// Usage: node scripts/diagnostics/ci_paired_oldnew_lighthouse.cjs [pairs=8] [bento,home]
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http2 = require('node:http2');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync, spawnSync, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const runFile = promisify(execFile);
const sha = {
  old: '49983047ffea631ad391e72a19cf9b73c3a427f9',
  newer: 'f325e00de47be2e6723f1c9e8e492b59d1a14843',
};
const pairs = Number(process.argv[2] || 8);
const pages = (process.argv[3] || 'bento,home').split(',');
if (!Number.isInteger(pairs) || pairs < 1 || pairs > 12 ||
    pages.length < 1 || pages.some(page => !['bento', 'home'].includes(page)) ||
    new Set(pages).size !== pages.length) throw Error('Invalid pages or pair count');
const requireFonts = process.env.REQUIRE_FONTS === '1';
const output = process.env.OUTPUT_DIR || path.join(os.tmpdir(), 'milovi-lhci-realfonts');
const chrome = process.env.CHROME_PATH;
const lighthouse = process.env.LIGHTHOUSE_BIN || path.resolve('node_modules/.bin/lighthouse');
if (!chrome || !fs.existsSync(chrome) || !fs.existsSync(lighthouse)) {
  throw Error('Set CHROME_PATH and install lighthouse@12.6.1 before running');
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webm': 'video/webm', '.mp4': 'video/mp4', '.json': 'application/json',
  '.vtt': 'text/vtt', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const median = values => {
  const v = [...values].sort((a, b) => a - b);
  return (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2;
};
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const finite = value => typeof value === 'number' && Number.isFinite(value) ?
  Math.round(value * 100) / 100 : null;

function snapshot(label, base) {
  const folder = path.join(base, label);
  fs.mkdirSync(folder, { recursive: true });
  const archive = execFileSync('git', ['archive', sha[label]], {
    maxBuffer: 80 * 1024 * 1024,
  });
  const tar = spawnSync('tar', ['-xf', '-', '-C', folder], {
    input: archive, maxBuffer: 2 * 1024 * 1024,
  });
  if (tar.status !== 0) throw Error(`git archive ${label}: ${tar.stderr}`);
  if (!fs.existsSync(path.join(folder, 'bento-torty/index.html')) ||
      !fs.existsSync(path.join(folder, 'css/style.css'))) throw Error('Source incomplete');
  return folder;
}

async function serve(folder, key, cert) {
  const sessions = new Set();
  const server = http2.createSecureServer({ key, cert, allowHTTP1: false });
  server.on('session', session => {
    sessions.add(session);
    session.on('close', () => sessions.delete(session));
  });
  server.on('stream', (stream, headers) => {
    try {
      const pathname = new URL(headers[':path'], 'https://localhost').pathname;
      const filename = path.resolve(folder, '.' + decodeURIComponent(pathname),
        pathname.endsWith('/') ? 'index.html' : '');
      if (!filename.startsWith(folder + path.sep) ||
          !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        stream.respond({ ':status': 404 }); stream.end(); return;
      }
      const type = mime[path.extname(filename)] || 'application/octet-stream';
      const asset = !pathname.endsWith('/') && pathname !== '/index.html';
      const common = { 'content-type': type, 'cache-control': asset ?
        'public, max-age=600' : 'no-store' };
      const size = fs.statSync(filename).size;
      if (type.startsWith('video/') && headers.range) {
        const range = /^bytes=(\d+)-(\d*)$/.exec(headers.range);
        if (!range) { stream.respond({ ':status': 416 }); stream.end(); return; }
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start >= size || end < start) {
          stream.respond({ ':status': 416, 'content-range': `bytes */${size}` });
          stream.end(); return;
        }
        stream.respond({ ':status': 206, ...common, 'accept-ranges': 'bytes',
          'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
        const reader = fs.createReadStream(filename, { start, end, highWaterMark: 4096 });
        reader.on('error', () => { try { stream.close(); } catch (_) {} });
        stream.on('close', () => reader.destroy());
        reader.pipe(stream); return;
      }
      let body = fs.readFileSync(filename);
      const content = /^(text\/|application\/(javascript|json))/.test(type);
      const response = { ':status': 200, ...common,
        ...(type.startsWith('video/') ? { 'accept-ranges': 'bytes' } : {}) };
      if (content && /\bgzip\b/.test(headers['accept-encoding'] || '')) {
        body = zlib.gzipSync(body);
        response['content-encoding'] = 'gzip';
      }
      response['content-length'] = body.length;
      stream.respond(response); stream.end(body);
    } catch (error) {
      console.error('Local h2 fixture error:', error.message);
      try { stream.close(); } catch (_) {}
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, sessions, origin: `https://127.0.0.1:${server.address().port}` };
}

function traceProof(filename, page, arm, firstPair) {
  const trace = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const navs = trace.traceEvents.filter(e => e.name === 'navigationStart');
  const candidates = trace.traceEvents.filter(e => e.name === 'largestContentfulPaint::Candidate');
  const pairs = navs.map(nav => ({ nav, lcp: candidates.filter(e =>
    e.args?.data?.navigationId === nav.args?.data?.navigationId) })).filter(x => x.lcp.length);
  if (pairs.length !== 1) throw Error(`Ambiguous raw LCP navs (${pairs.length}): ${page}/${arm}`);
  const match = pairs[0];
  const lcp = Math.max(...match.lcp.map(e => e.ts));
  const screens = trace.traceEvents.filter(e => e.name === 'Screenshot' &&
    e.args?.snapshot && e.ts >= match.nav.ts);
  if (firstPair && screens.length) {
    const final = screens.at(-1);
    fs.writeFileSync(path.join(output, `visual-${page}-${arm}-final.jpg`),
      Buffer.from(final.args.snapshot, 'base64'));
  }
  return { rawLcp: finite((lcp - match.nav.ts) / 1000), frames: screens.length,
    nodeName: match.lcp.at(-1)?.args?.data?.nodeName || null };
}

function inspect(filepath, page, arm, origin, firstPair) {
  const r = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const expectedUrl = origin + (page === 'home' ? '/' : '/bento-torty/');
  if (r.lighthouseVersion !== '12.6.1' || r.finalUrl !== expectedUrl ||
      r.runtimeError || r.runWarnings?.length) throw Error('Invalid Lighthouse result: ' + filepath);
  if (requireFonts && !/HeadlessChrome\/155\./.test(r.userAgent)) {
    throw Error('Expected exact CI Chrome 155');
  }
  const requests = r.audits['network-requests'].details.items;
  const fonts = requests.filter(x => /fonts\.(googleapis|gstatic)\.com\//.test(x.url));
  const media = requests.filter(x => /\/img\/gallery\/videos\/.*\.webm/.test(x.url));
  const heroName = page === 'home' ? 'head_mobile-640.avif' : 'bento_1-mobile-640.avif';
  const hero = requests.find(x => x.url.includes(heroName));
  const css = requests.find(x => x.url.includes('/css/style.css'));
  const locals = requests.filter(x => x.url.startsWith(origin));
  if (!hero || !css || hero.statusCode !== 200 || css.statusCode !== 200 ||
      hero.protocol !== 'h2' || css.protocol !== 'h2' ||
      locals.some(x => x.fromServiceWorker)) throw Error('Bad hero/CSS/SW fixture');
  if (page === 'bento' && ((arm === 'old' && (media.length !== 2 ||
      media.some(x => x.statusCode !== 206 || x.mimeType !== 'video/webm' || !x.finished))) ||
      (arm === 'newer' && media.length !== 0))) {
    throw Error('Incorrect media fallback/Range fixture: ' + JSON.stringify(media.map(x =>
      ({ url: x.url, status: x.statusCode, mime: x.mimeType, finished: x.finished }))));
  }
  const fontOk = fonts.length >= 4 && fonts.every(x => x.statusCode === 200);
  if (requireFonts && !fontOk) throw Error('Real Google Fonts did not load: ' + JSON.stringify(fonts.map(x =>
    ({ url: x.url, status: x.statusCode }))));
  const metric = name => finite(r.audits[name]?.numericValue);
  const name = path.basename(filepath, '.report.json');
  const trace = traceProof(path.join(output, `${name}.report-0.trace.json`),
    page, arm, firstPair);
  return { name, page, arm, lcp: metric('largest-contentful-paint'),
    fcp: metric('first-contentful-paint'), cls: metric('cumulative-layout-shift'),
    tbt: metric('total-blocking-time'), observedLcp:
      r.audits.metrics?.details?.items?.[0]?.observedLargestContentfulPaint ?? null,
    trace, heroEnd: finite(hero.networkEndTime), cssEnd: finite(css.networkEndTime),
    media: media.map(x => ({ status: x.statusCode, mime: x.mimeType,
      bytes: x.transferSize, finished: x.finished })),
    fontOk, fontCount: fonts.length, fontStatuses: fonts.map(x => x.statusCode),
    localRequests: locals.length, lighthouse: r.lighthouseVersion, browser: r.userAgent,
    consoleErrors: r.audits['errors-in-console']?.details?.items?.length || 0 };
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'milovi-h2-lh-'));
  const roots = { old: snapshot('old', temporary), newer: snapshot('newer', temporary) };
  const key = path.join(temporary, 'key.pem');
  const cert = path.join(temporary, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  const servers = {};
  try {
    for (const arm of ['old', 'newer']) servers[arm] = await serve(roots[arm],
      fs.readFileSync(key), fs.readFileSync(cert));
    const chromeVersion = execFileSync(chrome, ['--version']).toString().trim();
    const lhVersion = execFileSync(lighthouse, ['--version']).toString().trim();
    console.log('Exact source SHA', sha, 'Chrome', chromeVersion,
      'Lighthouse', lhVersion, 'paired cold runs', pairs, pages, 'realFonts', requireFonts);
    if (lhVersion !== '12.6.1') throw Error('Lighthouse version not 12.6.1');
    if (requireFonts && !/155\./.test(chromeVersion)) throw Error('Chrome is not 155');
    const rows = [];
    for (const page of pages) {
      for (let i = 0; i < pairs; i++) {
        for (const arm of i % 2 ? ['newer', 'old'] : ['old', 'newer']) {
          const target = page === 'home' ? '/' : '/bento-torty/';
          const url = servers[arm].origin + target;
          const name = `${page}-${String(i + 1).padStart(2, '0')}-${arm}`;
          const args = [url, '--output=json',
            `--output-path=${path.join(output, `${name}.report.json`)}`, '--save-assets',
            '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage --ignore-certificate-errors',
            '--form-factor=mobile', '--screenEmulation.mobile=true',
            '--screenEmulation.width=412', '--screenEmulation.height=915',
            '--screenEmulation.deviceScaleFactor=1.75', '--screenEmulation.disabled=false',
            '--throttling-method=simulate', '--throttling.rttMs=150',
            '--throttling.throughputKbps=1638.4', '--throttling.cpuSlowdownMultiplier=4',
            '--quiet'];
          try {
            await runFile(lighthouse, args, { env: { ...process.env, CHROME_PATH: chrome },
              timeout: 160000, maxBuffer: 3 * 1024 * 1024 });
            const row = inspect(path.join(output, `${name}.report.json`), page, arm,
              servers[arm].origin, i === 0);
            rows.push(row);
            console.log(JSON.stringify({ pair: i + 1, ...row }));
          } catch (error) {
            throw Error(`${name}: ${error.message}; ${(error.stderr || '').slice(-750)}`);
          }
        }
      }
    }
    const summary = { sourceSha: sha, chromeVersion, lighthouse: lhVersion,
      realFontsRequired: requireFonts, pairs, pages, rows, statistics: {} };
    for (const page of pages) {
      const old = rows.filter(x => x.page === page && x.arm === 'old');
      const newer = rows.filter(x => x.page === page && x.arm === 'newer');
      const deltas = newer.map((row, i) => finite(row.lcp - old[i].lcp));
      const raw = newer.map((row, i) => finite(row.trace.rawLcp - old[i].trace.rawLcp));
      summary.statistics[page] = { oldMedian: finite(median(old.map(x => x.lcp))),
        newMedian: finite(median(newer.map(x => x.lcp))),
        pairDeltaMedian: finite(median(deltas)), pairDeltas: deltas,
        rawPairDeltaMedian: finite(median(raw)), rawPairDeltas: raw,
        faster: deltas.filter(x => x < 0).length, slower: deltas.filter(x => x > 0).length };
    }
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    const blob = zlib.gzipSync(JSON.stringify(summary), { mtime: 0 });
    const encoded = blob.toString('base64');
    const chunks = encoded.match(/.{1,3100}/g) || [];
    if (chunks.length > 14) throw Error(`Summary exceeds annotation budget: ${chunks.length}`);
    const digest = hash(blob).slice(0, 18);
    chunks.forEach((value, i) => console.log(`::notice file=.github/workflows/cake-sanity.yml,` +
      `line=1,title=PairRealFonts-${digest}-${String(i + 1).padStart(2, '0')}-of-${String(chunks.length).padStart(2, '0')}::${value}`));
    // The runner can reach real fonts; transfer four original filmstrip frames
    // for visual review even where the Actions artifact CDN is blocked.
    let imageParts = 0;
    for (const page of pages) for (const arm of ['old', 'newer']) {
      const filename = path.join(output, `visual-${page}-${arm}-final.jpg`);
      if (!fs.existsSync(filename)) continue;
      const image = fs.readFileSync(filename);
      const parts = image.toString('base64').match(/.{1,3100}/g) || [];
      if (parts.length > 9 || imageParts + parts.length + chunks.length > 46) {
        console.log(`::warning::Visual ${page}/${arm} exceeds bounded annotation budget`);
        continue;
      }
      imageParts += parts.length;
      const proof = hash(image).slice(0, 18);
      parts.forEach((value, index) => console.log(`::notice file=.github/workflows/cake-sanity.yml,` +
        `line=1,title=PairImage-${page}-${arm}-${proof}-${String(index + 1).padStart(2, '0')}-of-${String(parts.length).padStart(2, '0')}::${value}`));
    }
    console.log('Historical source paired summary:', JSON.stringify(summary.statistics),
      'visual annotation parts:', imageParts);
  } finally {
    for (const value of Object.values(servers)) {
      for (const session of value.sessions) session.close();
      value.server.close();
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error('::error file=.github/workflows/cake-sanity.yml,line=1::' +
    error.message.replaceAll('\n', ' ').replaceAll('%', '%25').slice(0, 2000));
  process.exitCode = 1;
});
