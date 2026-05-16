/* ═══════════════════════════════════════════════════════════════════════
   MILOVI CAKE — Service Worker v1.1 (V3-FIX)
   Стратегия: stale-while-revalidate для статики (img/css/js/font),
              network-first для HTML.
   Cache-bust через имя версии CACHE_NAME (увеличивайте при деплое CSS/JS).
   ═══════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'milovi-cake-v2026.05.16-r7';
const PRECACHE = [
  '/',
  '/css/style.css?v=20260516r7',
  '/css/mc-2026.css?v=20260516r7',
  '/css/premium-overrides.css?v=20260516r7',
  '/css/gallery/gallery-2026.css?v=20260516r7',
  '/js/main.js?v=20260516r7',
  '/js/nav.js?v=20260516r7',
  '/js/mc-2026.js?v=20260516r7',
  '/img/head_mobile.avif',
  '/img/head_desktop.avif',
  '/img/head_mobile.webp',
  '/img/head_desktop.webp',
  '/manifest.json',
  '/favicon.svg?v=20260516r7'
];

// ───── INSTALL ─────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll fail-fast → используем individual add с .catch для отказоустойчивости
      return Promise.all(PRECACHE.map((url) =>
        cache.add(url).catch(() => { /* tolerate misses (404) */ })
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

  // Не кешируем сторонние домены — пропускаем для нативного fetch
  if (url.origin !== location.origin) return;

  // Не кешируем аналитику и API
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/mc.yandex.ru') ||
    url.pathname.includes('/googletagmanager') ||
    url.pathname.includes('/gtag/')
  ) return;

  const acceptHeader = req.headers.get('accept') || '';

  // HTML — network first (всегда свежий контент)
  if (req.mode === 'navigate' || acceptHeader.indexOf('text/html') !== -1){
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match('/')))
    );
    return;
  }

  // Статика — stale-while-revalidate
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

// ───── MESSAGE (для принудительного обновления) ─────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
