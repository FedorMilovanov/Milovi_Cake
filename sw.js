/* ══════════════════════════════════════════════
   Milovi Cake — Service Worker
   Стратегия: Cache-First для статики, Network-First для страниц
   ══════════════════════════════════════════════ */

// Version is updated on each deploy — change this date to bust caches
const DEPLOY_VERSION = '2026-03-19a';
const STATIC_CACHE = `milovi-static-v1-${DEPLOY_VERSION}`;
const IMAGE_CACHE  = `milovi-images-v2`;

/* Только критичные ресурсы — пригороды кешируются по запросу */
const PRECACHE_URLS = [
  '/',
  '/css/style.css',
  '/js/main.js',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/icon-apple.png',
  '/img/icon-loading.webp',
  '/img/head_desktop.webp',
  '/img/head_mobile.webp',
];

const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.svg', '.gif'];

/* ── Install: каждый URL кешируется независимо ── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
            .catch(err => console.warn('SW precache fail:', url, err))
        )
      )
    )
  );
});

/* ── Activate: удаляем старые кеши ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== IMAGE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) return;

  if (IMAGE_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js')  ||
      url.hostname.includes('fonts')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.headers.get('accept')?.includes('text/html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

/* ── Стратегии ── */

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      if (cacheName === IMAGE_CACHE) trimCache(cacheName, 80);
    }
    return response;
  } catch {
    return new Response('Нет соединения', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(offlineHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await fetchPromise || new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

/* ── Лимит кеша изображений (максимум 80) ── */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    trimCache(cacheName, maxItems);
  }
}

/* ── Офлайн-страница ── */
function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Milovi Cake — нет соединения</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Jost', -apple-system, sans-serif; background: #faf6f0;
      color: #2e1a0e; display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; text-align: center; }
    .wrap { max-width: 380px; }
    .icon { font-size: 72px; margin-bottom: 24px; }
    h1 { font-family: Georgia, serif; font-size: 28px; font-weight: 400;
         color: #c9934a; margin-bottom: 12px; }
    p { font-size: 15px; line-height: 1.6; color: #7a5c3a; margin-bottom: 28px; }
    a { display: inline-block; padding: 14px 32px; background: #c9934a; color: #fff;
        border-radius: 50px; text-decoration: none; font-size: 14px; font-weight: 500; }
    a:hover { background: #b8823c; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon">🎂</div>
    <h1>Нет соединения</h1>
    <p>Похоже, вы сейчас офлайн. Проверьте интернет-соединение — и мы покажем все наши торты!</p>
    <a href="/" onclick="location.reload()">Попробовать снова</a>
  </div>
</body>
</html>`;
}
