/* ═══════════════════════════════════════════════════════════════════════
   MILOVI CAKE — Service Worker v1.2 (V20260517-FIX)
   ═══════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'milovi-cake-v2026.05.17';
const PRECACHE = [
  '/',
  '/css/style.css',
  '/css/mc-2026.css',
  '/css/premium-overrides.css',
  '/css/gallery/gallery-2026.css',
  '/css/final-fixes.css',
  '/js/main.js',
  '/js/gallery/main.js',
  '/js/gallery/data.js',
  '/js/nav.js',
  '/js/mc-2026.js',
  '/img/head_mobile.avif',
  '/img/head_desktop.avif',
  '/img/head_mobile.webp',
  '/img/head_desktop.webp',
  '/manifest.json',
  '/favicon.svg',
  '/gallery/'
];

// ───── INSTALL ─────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(PRECACHE.map((url) =>
        cache.add(url).catch(() => { /* tolerate misses */ })
      ));
    }).then(() => self.skipWaiting())
  );
});

// ───── ACTIVATE ─────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ───── FETCH ─────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/mc.yandex.ru') ||
    url.pathname.includes('/googletagmanager')
  ) return;

  const acceptHeader = req.headers.get('accept') || '';

  if (req.mode === 'navigate' || acceptHeader.indexOf('text/html') !== -1){
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
