'use strict';

// Deterministic release artifact minification. Never change source JavaScript.
// Version the five classic script URLs and SW precache by their actual content.
// --verify recomputes and audits the existing artifact without writing files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {minify} = require('terser');

const root = path.resolve(__dirname, '..');
const artifact = path.join(root, '_site');
const names = Object.freeze([
  'main.js', 'nav.js', 'mc-2026.js', 'v20-faq-fix.js', 'consent-analytics.js',
]);
const nameSet = new Set(names);
const cssNames = Object.freeze([
  'style.css', 'fonts.css', 'fonts-italic.css', 'mc-2026.css',
  'premium-overrides.css', 'v20-dark-and-fixes.css',
  'v20-fixes.css', 'final-fixes.css', 'gallery/gallery-2026.css',
]);
const cssNameSet = new Set(cssNames);
const verify = process.argv.slice(2).includes('--verify');
if (process.argv.slice(2).some(arg => arg !== '--verify')) {
  throw new Error('Usage: node scripts/minify_pages_js.cjs [--verify]');
}
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function ensure(condition, message) {
  if (!condition) throw new Error('Pages JS build contract: ' + message);
}
function allHtml(dir) {
  const result = [];
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...allHtml(p));
    else if (item.isFile() && item.name.endsWith('.html')) result.push(p);
  }
  return result.sort();
}
function parseCandidateName(url) {
  const pathname = url.split('?')[0].split('#')[0];
  const match = pathname.match(/(?:^|\/)js\/([^/]+\.js)$/);
  return match && nameSet.has(match[1]) ? match[1] : null;
}
function addContentVersion(url, shortHash, key = 'jsh') {
  const u = url.split('#');
  ensure(u.length <= 2, 'unexpected fragment ' + url);
  const hash = u.length === 2 ? '#' + u[1] : '';
  const parts = u[0].split('?');
  ensure(parts.length <= 2, 'unexpected query string ' + url);
  const query = new URLSearchParams(parts[1] || '');
  ensure(!query.has(key), 'already contains artifact hash '+key+': ' + url);
  query.set(key, shortHash);
  return parts[0] + '?' + query.toString() + hash;
}
function matchVersions(url, expectedHash, key = 'jsh') {
  const q = url.split('?');
  if (q.length !== 2) return false;
  const params = new URLSearchParams(q[1]);
  return params.getAll(key).length === 1 && params.get(key) === expectedHash;
}
function updateHtml(html, digests) {
  let count = 0;
  const output = html.replace(/(<script\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (original, prefix, quote, src) => {
      const name = parseCandidateName(src);
      if (!name) return original;
      count += 1;
      return prefix + quote + addContentVersion(src, digests[name]) + quote;
    });
  return {output, count};
}
function auditHtml(html, digests, page) {
  let count = 0;
  html.replace(/<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1/gi, (_, q, src) => {
    const name = parseCandidateName(src);
    if (name) {
      count++;
      ensure(matchVersions(src, digests[name]), page + ' incorrect JS hash for ' + name);
    }
    return _;
  });
  return count;
}
function parseCssCandidateName(url) {
  const pathname = url.split('?')[0].split('#')[0];
  const match = pathname.match(/(?:^|\/)css\/([^?#]+\.css)$/i);
  return match && cssNameSet.has(match[1]) ? match[1] : null;
}
function updateCssHtml(html, digests) {
  let count = 0;
  const output = html.replace(/(<link\b[^>]*\bhref\s*=\s*)(["'])([^"']+)\2/gi,
    (original, prefix, quote, href) => {
      const name = parseCssCandidateName(href);
      if (!name) return original;
      count++;
      return prefix + quote + addContentVersion(href, digests[name], 'csh') + quote;
    });
  return {output, count};
}
function auditCssHtml(html, digests, page) {
  let count = 0;
  html.replace(/<link\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1/gi,
    (original, quote, href) => {
      const name = parseCssCandidateName(href);
      if (name) {
        count++;
        ensure(matchVersions(href, digests[name], 'csh'),
          page + ' incorrect CSS hash for ' + name);
      }
      return original;
    });
  return count;
}
function cssLinkSequence(html) {
  return [...html.matchAll(/<link\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1/gi)]
    .map(match => parseCssCandidateName(match[2])).filter(Boolean);
}
function classicScriptSequence(html) {
  const sequence = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1/gi)) {
    const name = parseCandidateName(match[2]);
    if (name) sequence.push(name);
  }
  return sequence;
}
function transformSw(text, digests, aggregateHash, cssDigests, cssAggregateHash) {
  const occurrences = {};
  for (const name of names) occurrences[name] = 0;
  let output = text.replace(/(["'])(\/js\/([^"'/?]+\.js)\?[^"']+)\1/g,
    (original, quote, url, filename) => {
      if (!nameSet.has(filename)) return original;
      occurrences[filename]++;
      return quote + addContentVersion(url, digests[filename]) + quote;
    });
  for (const name of names) {
    ensure(occurrences[name] === 1, 'SW precache must list exactly one ' + name);
  }
  const cssOccurrences = {};
  for (const name of cssNames) cssOccurrences[name] = 0;
  output = output.replace(/(["'])(\/css\/([^"'?]+\.css)\?[^"']+)\1/g,
    (original, quote, url, filename) => {
      if (!cssNameSet.has(filename)) return original;
      cssOccurrences[filename]++;
      return quote + addContentVersion(url, cssDigests[filename], 'csh') + quote;
    });
  for (const name of cssNames) {
    ensure(cssOccurrences[name] === 1,
      'SW precache must list exactly one CSS file ' + name);
  }
  const cacheRegex = /(const CACHE_NAME\s*=\s*)(["'])([^"']+)\2/;
  const match = output.match(cacheRegex);
  ensure(match && match[3] && !match[3].includes('-jsh'),
    'SW cache version has unexpected syntax');
  const cacheName = match[3] + '-jsh' + aggregateHash + '-csh' + cssAggregateHash;
  const final = output.replace(cacheRegex,
    (_, prefix, quote) => prefix + quote + cacheName + quote);
  ensure(final.includes(cacheName), 'SW cache name missing');
  return {final, cacheName};
}
function auditSw(sw, digests, cssDigests, cacheName) {
  const match = sw.match(/const CACHE_NAME\s*=\s*(["'])([^"']+)\1/);
  ensure(match && match[2] === cacheName, 'SW cache namespace mismatch');
  for (const name of names) {
    const re = new RegExp('/js/' + name.replaceAll('.', '\\.') + '\\?[^\\x27"\\s]+', 'g');
    const urls = sw.match(re) || [];
    ensure(urls.length === 1 && matchVersions(urls[0], digests[name]),
      'SW stale/missing JS precache version for ' + name);
  }
  for (const name of cssNames) {
    const re = new RegExp('/css/' + name.replaceAll('.', '\\.') + '\\?[^\\x27"\\s]+', 'g');
    const urls = sw.match(re) || [];
    ensure(urls.length === 1 && matchVersions(urls[0], cssDigests[name], 'csh'),
      'SW stale/missing CSS precache version for ' + name);
  }
}
(async function main() {
  ensure(fs.existsSync(path.join(artifact, 'index.html')), '_site absent');
  const digests = {};
  const output = {};
  for (const name of names) {
    const sourcePath = path.join(root, 'js', name);
    const targetPath = path.join(artifact, 'js', name);
    ensure(fs.existsSync(sourcePath) && fs.existsSync(targetPath), 'missing ' + name);
    const code = fs.readFileSync(sourcePath, 'utf8');
    const result = await minify({[name]:code}, {
      ecma:2020, module:false, toplevel:false,
      compress:{defaults:true,passes:1},
      mangle:{toplevel:false,keep_fnames:true,keep_classnames:true},
      keep_fnames:true,keep_classnames:true,
      format:{comments:/^!/},
    });
    ensure(result.code && result.code.length > 100, 'invalid minifier output for '+name);
    const bytes = Buffer.from(result.code + '\n', 'utf8');
    const digest = sha256(bytes).slice(0, 12);
    digests[name] = digest;
    output[name] = bytes;
    if (verify) ensure(fs.readFileSync(targetPath).equals(bytes), 'byte mismatch for '+name);
    else fs.writeFileSync(targetPath, bytes);
  }
  const aggregateHash = sha256(Buffer.from(names.map(name => name + ':' + digests[name]).join('\n'))).slice(0, 12);
  // Bind deployed CSS revisions to source bytes, not a manually maintained date.
  const cssDigests = {};
  for (const name of cssNames) {
    const sourcePath = path.join(root, 'css', name);
    const targetPath = path.join(artifact, 'css', name);
    ensure(fs.existsSync(sourcePath) && fs.existsSync(targetPath),
      'missing CSS source or artifact ' + name);
    const bytes = fs.readFileSync(sourcePath);
    ensure(fs.readFileSync(targetPath).equals(bytes),
      'CSS artifact bytes differ from source ' + name);
    cssDigests[name] = sha256(bytes).slice(0, 12);
  }
  const cssAggregateHash = sha256(Buffer.from(cssNames.map(name =>
    name + ':' + cssDigests[name]).join('\n'))).slice(0, 12);
  const swPath = path.join(artifact, 'sw.js');
  const sourceSw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const {final:expectedSw,cacheName} = transformSw(sourceSw, digests, aggregateHash, cssDigests, cssAggregateHash);
  if (verify) ensure(fs.readFileSync(swPath, 'utf8') === expectedSw, 'SW artifact bytes differ');
  else fs.writeFileSync(swPath, expectedSw, 'utf8');
  auditSw(fs.readFileSync(swPath, 'utf8'), digests, cssDigests, cacheName);

  let pages = 0, references = 0, cssReferences = 0;
  for (const f of allHtml(artifact)) {
    const current = fs.readFileSync(f, 'utf8');
    if (!verify) {
      const jsResult = updateHtml(current, digests);
      const cssResult = updateCssHtml(jsResult.output, cssDigests);
      if (jsResult.count || cssResult.count) fs.writeFileSync(f, cssResult.output, 'utf8');
    }
    const content = fs.readFileSync(f, 'utf8');
    const relative = path.relative(artifact, f);
    const count = auditHtml(content, digests, relative);
    const cssCount = auditCssHtml(content, cssDigests, relative);
    const sourcePage = path.join(root, relative);
    ensure(fs.existsSync(sourcePage), relative + ' has no matching source');
    ensure(JSON.stringify(cssLinkSequence(content)) ===
      JSON.stringify(cssLinkSequence(fs.readFileSync(sourcePage, 'utf8'))),
      relative + ' CSS link list differs from source');
    ensure(JSON.stringify(classicScriptSequence(content)) ===
      JSON.stringify(classicScriptSequence(fs.readFileSync(sourcePage, 'utf8'))),
      relative + ' classic script tag list differs from source');
    pages++;
    references += count;
    cssReferences += cssCount;
  }
  ensure(references >= 5, 'no HTML script URL updates found');
  ensure(cssReferences >= cssNames.length, 'no HTML CSS URL updates found');
  console.log('Pages JS artifact ' + (verify ? 'VERIFY OK' : 'BUILD OK') +
    ': '+ names.length +' JS files; '+references+' HTML refs; '+pages+
    ' HTML pages; '+cssReferences+' CSS refs; SW cache '+cacheName+
    '; sha256-12 JS '+JSON.stringify(digests)+
    '; CSS '+JSON.stringify(cssDigests));
})().catch(error => {console.error(error.stack || String(error));process.exitCode = 1});
