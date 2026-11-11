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
function addContentVersion(url, shortHash) {
  const u = url.split('#');
  ensure(u.length <= 2, 'unexpected fragment ' + url);
  const hash = u.length === 2 ? '#' + u[1] : '';
  const parts = u[0].split('?');
  ensure(parts.length <= 2, 'unexpected query string ' + url);
  const query = new URLSearchParams(parts[1] || '');
  ensure(!query.has('jsh'), 'already contains JS artifact hash: ' + url);
  query.set('jsh', shortHash);
  return parts[0] + '?' + query.toString() + hash;
}
function matchVersions(url, expectedHash) {
  const q = url.split('?');
  if (q.length !== 2) return false;
  const params = new URLSearchParams(q[1]);
  return params.getAll('jsh').length === 1 && params.get('jsh') === expectedHash;
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
function classicScriptSequence(html) {
  const sequence = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1/gi)) {
    const name = parseCandidateName(match[2]);
    if (name) sequence.push(name);
  }
  return sequence;
}
function transformSw(text, digests, aggregateHash) {
  const occurrences = {};
  for (const name of names) occurrences[name] = 0;
  const output = text.replace(/(["'])(\/js\/([^"'/?]+\.js)\?[^"']+)\1/g,
    (original, quote, url, filename) => {
      if (!nameSet.has(filename)) return original;
      occurrences[filename]++;
      return quote + addContentVersion(url, digests[filename]) + quote;
    });
  for (const name of names) {
    ensure(occurrences[name] === 1, 'SW precache must list exactly one ' + name);
  }
  const cacheRegex = /(const CACHE_NAME\s*=\s*)(["'])([^"']+)\2/;
  const match = output.match(cacheRegex);
  ensure(match && match[3] && !match[3].includes('-jsh'), 'SW cache version has unexpected syntax');
  const cacheName = match[3] + '-jsh' + aggregateHash;
  const final = output.replace(cacheRegex, (_, prefix, quote) => prefix + quote + cacheName + quote);
  ensure(final.includes(cacheName), 'SW cache name missing');
  return {final, cacheName};
}
function auditSw(sw, digests, cacheName) {
  const match = sw.match(/const CACHE_NAME\s*=\s*(["'])([^"']+)\1/);
  ensure(match && match[2] === cacheName, 'SW cache namespace mismatch');
  for (const name of names) {
    const re = new RegExp('/js/' + name.replaceAll('.', '\\.') + '\\?[^\\x27"\\s]+', 'g');
    const urls = sw.match(re) || [];
    ensure(urls.length === 1 && matchVersions(urls[0], digests[name]),
      'SW stale/missing JS precache version for ' + name);
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
  const swPath = path.join(artifact, 'sw.js');
  const sourceSw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const {final:expectedSw,cacheName} = transformSw(sourceSw, digests, aggregateHash);
  if (verify) ensure(fs.readFileSync(swPath, 'utf8') === expectedSw, 'SW artifact bytes differ');
  else fs.writeFileSync(swPath, expectedSw, 'utf8');
  auditSw(fs.readFileSync(swPath, 'utf8'), digests, cacheName);

  let pages = 0, references = 0;
  for (const f of allHtml(artifact)) {
    const current = fs.readFileSync(f, 'utf8');
    if (!verify) {
      const {output:revised, count} = updateHtml(current, digests);
      if (count) fs.writeFileSync(f, revised, 'utf8');
    }
    const content = fs.readFileSync(f, 'utf8');
    const relative = path.relative(artifact, f);
    const count = auditHtml(content, digests, relative);
    const sourcePage = path.join(root, relative);
    ensure(fs.existsSync(sourcePage), relative + ' has no matching source');
    ensure(JSON.stringify(classicScriptSequence(content)) ===
      JSON.stringify(classicScriptSequence(fs.readFileSync(sourcePage, 'utf8'))),
      relative + ' classic script tag list differs from source');
    pages++;
    references += count;
  }
  ensure(references >= 5, 'no HTML script URL updates found');
  console.log('Pages JS artifact ' + (verify ? 'VERIFY OK' : 'BUILD OK') +
    ': '+ names.length +' JS files; '+references+' HTML refs; '+pages+
    ' HTML pages; SW cache '+cacheName+'; sha256-12 '+JSON.stringify(digests));
})().catch(error => {console.error(error.stack || String(error));process.exitCode = 1});
