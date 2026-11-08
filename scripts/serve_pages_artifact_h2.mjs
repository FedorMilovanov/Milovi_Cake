#!/usr/bin/env node
/**
 * Dev-only static Pages artifact server over HTTP/2, matching the live ALPN
 * transport used by milovicake.ru. This file is NOT deployed to production.
 *
 * node scripts/serve_pages_artifact_h2.mjs --root _site --port 4300 \
 *   --cert /tmp/localhost.crt --key /tmp/localhost.key
 *
 * No external npm dependencies. Node 22+.
 */
import fs from 'node:fs';
import path from 'node:path';
import http2 from 'node:http2';
import zlib from 'node:zlib';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!key?.startsWith('--') || !process.argv[i + 1] || args.has(key)) {
    throw new Error('Invalid server arguments at ' + key);
  }
  args.set(key, process.argv[i + 1]);
}
const root = fs.realpathSync(path.resolve(args.get('--root') || '_site'));
const host = args.get('--host') || '127.0.0.1';
const port = Number(args.get('--port') || '4300');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
if (!fs.statSync(path.join(root, 'index.html')).isFile()) throw new Error('Pages artifact missing index.html');
if (!args.has('--cert') || !args.has('--key')) throw new Error('Both --cert and --key are required');

const tls = {
  cert: fs.readFileSync(args.get('--cert')),
  key: fs.readFileSync(args.get('--key')),
  allowHTTP1: false,
};
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const compressible = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.xml', '.txt']);

const server = http2.createSecureServer(tls, (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'https://localhost').pathname);
    const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const candidate = path.resolve(root, '.' + relative);
    if (!candidate.startsWith(root + path.sep)) throw new Error('Forbidden path');
    const file = fs.realpathSync(candidate);
    if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) throw new Error('Forbidden file');

    const ext = path.extname(file).toLowerCase();
    let body = fs.readFileSync(file);
    const headers = {
      'content-type': types[ext] || 'application/octet-stream',
      'cache-control': 'no-cache',
    };
    if (compressible.has(ext) && body.length > 512 && /\bgzip\b/i.test(request.headers['accept-encoding'] || '')) {
      body = zlib.gzipSync(body, { level: 6 });
      headers['content-encoding'] = 'gzip';
      headers.vary = 'Accept-Encoding';
    }
    headers['content-length'] = String(body.length);
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : 'not found');
  }
});
server.on('error', (error) => {
  console.error('Pages HTTP/2 fixture failed:', error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log('Pages artifact HTTP/2 at https://' + host + ':' + port + '/ root=' + root);
});
