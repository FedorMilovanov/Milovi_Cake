/* ═══════════════════════════════════════════════════════════════════════
   MILOVI CAKE — Service Worker v1.7 (V20260803-R71)
   Strategy:
     - HTML (navigate): network-first, fallback to cache, fallback to "/"
     - Static (CSS/JS/img): stale-while-revalidate; video/range: browser-native
     - skipWaiting + clients.claim → обновления подхватываются мгновенно
   ═══════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'milovi-cake-v2026.08.03-r71';

const PRECACHE = [
  '/',
  '/css/style.css?v=20260728r27',
  '/css/mc-2026.css?v=20260728r27',
  '/css/premium-overrides.css?v=20260728r27',
  '/css/v20-dark-and-fixes.css?v=20260728r27',
  '/css/v20-fixes.css?v=20260803r70',
  '/css/final-fixes.css?v=20260728r27',
  '/css/gallery/gallery-2026.css?v=20260728r27',
  '/js/main.js?v=20260728r27',
  '/js/nav.js?v=20260728r27',
  '/js/mc-2026.js?v=20260728r27',
  '/js/v20-faq-fix.js?v=20260728r27',
  '/js/gallery/main.js?v=20260728r27',
  '/js/gallery/data.js?v=20260728r27',
  '/js/consent-analytics.js',
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
      var misses = 0;
      return Promise.all(PRECACHE.map((url) =>
        cache.add(url).catch(() => { misses++; console.warn('SW precache miss:', url); })
      )).then(() => {
        if (misses > 3) { console.error('SW: too many precache misses (' + misses + '), not activating'); throw new Error('precache-failed'); }
      });
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

  if (
    req.headers.has('range') ||
    req.destination === 'video' ||
    /\.(?:webm|mp4|mov|m4v)$/i.test(url.pathname)
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
    caches.match(req, { ignoreSearch: true }).then((cached) => {
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
