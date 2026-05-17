/* ═══════════════════════════════════════════════════════════════════════
   MILOVI CAKE — Service Worker v1.3 (V20260517-FAST)
   ═══════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'milovi-cake-v2026.05.17-r20fix';
const PRECACHE = [
  '/',
  '/css/style.css?v=20260517r20',
  '/css/mc-2026.css?v=20260517r20',
  '/css/premium-overrides.css?v=20260517r20',
  '/css/gallery/gallery-2026.css',
  '/css/final-fixes.css',
  '/js/main.js?v=20260517r20',
  '/js/gallery/main.js',
  '/js/nav.js?v=20260517r20',
  '/js/mc-2026.js?v=20260517r20',
  '/img/head_mobile.avif',
  '/img/head_desktop.avif',
  '/img/head_mobile.webp',
  '/img/head_desktop.webp',
  '/manifest.json',
  '/favicon.svg',
  '/gallery/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(PRECACHE.map((url) =>
        cache.add(url).catch(() => { console.log('SW Miss:', url); })
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/') || url.pathname.includes('/mc.yandex.ru')) return;

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
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
