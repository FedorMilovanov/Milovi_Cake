/* ══════════════════════════════════════════════
   Milovi Cake — Service Worker
   Стратегия: Cache-First для статики, Network-First для страниц
   ══════════════════════════════════════════════ */

const CACHE_NAME = 'milovi-v1';
const STATIC_CACHE = 'milovi-static-v1';
const IMAGE_CACHE  = 'milovi-images-v1';

/* Ресурсы, кешируемые при установке */
const PRECACHE_URLS = [
  '/',
  '/css/style.css',
  '/js/main.js',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  /* Страницы пригородов */
  '/prigorody/murino/',
  '/prigorody/kudrovo/',
  '/prigorody/kolpino/',
  '/prigorody/gatchina/',
  '/prigorody/pushkin/',
  '/prigorody/peterhof/',
  '/prigorody/krasnoe-selo/',
  '/prigorody/kronshtadt/',
  '/prigorody/vsevolozhsk/',
  '/prigorody/pavlovsk/',
  '/prigorody/sestroretsk/',
  '/prigorody/shushary/',
  '/prigorody/tosno/',
  '/prigorody/lomonosov/',
];

/* Изображения кешируются по запросу (Cache-First) */
const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.svg', '.gif'];

/* ── Install: предзагрузка ── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(() => {
      /* Если часть URL недоступна — не блокируем установку */
    })
  );
});

/* ── Activate: удаляем старые кеши ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== IMAGE_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Только GET, только наш домен + CDN шрифтов */
  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) return;

  /* Изображения: Cache-First */
  if (IMAGE_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  /* CSS / JS / Шрифты: Cache-First */
  if (url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js')  ||
      url.hostname.includes('fonts')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  /* HTML-страницы: Network-First с фоллбэком на кеш */
  if (request.headers.get('accept')?.includes('text/html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* Всё остальное: Stale-While-Revalidate */
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
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Нет соединения', { status: 503 });
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
    /* Офлайн-фоллбэк */
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
  return cached || await fetchPromise || new Response('', { status: 503 });
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
    body {
      font-family: 'Jost', -apple-system, sans-serif;
      background: #faf6f0;
      color: #2e1a0e;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; text-align: center;
    }
    .wrap { max-width: 380px; }
    .icon { font-size: 72px; margin-bottom: 24px; }
    h1 { font-family: Georgia, serif; font-size: 28px; font-weight: 400;
         color: #c9934a; margin-bottom: 12px; }
    p { font-size: 15px; line-height: 1.6; color: #7a5c3a; margin-bottom: 28px; }
    a { display: inline-block; padding: 14px 32px;
        background: #c9934a; color: #fff; border-radius: 50px;
        text-decoration: none; font-size: 14px; font-weight: 500; }
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
