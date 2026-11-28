// [r38] Отдельный интеграционный контракт Service Worker.
//
// Зачем: корзина и другие сценарии отказа исторически проверялись вместе с
// живой регистрацией SW. В тестовом окружении WebKit (HTTP на 127.0.0.1,
// многократные reload подряд) прерванная на навигации загрузка /sw.js иногда
// всплывает как pageerror «… due to access control checks» и роняет чужие
// контракты. Поэтому доставка SW проверяется здесь отдельно и по существу:
// заголовки, регистрация, precache и офлайн-навигация.
//
// Chromium-only по построению: compat-лейн запускает фиксированный набор
// grep-паттернов и эти тесты в него не попадают; в Chromium все проверки
// выполняются на реальном SW, без заглушек.
const { test, expect } = require('@playwright/test');

const CACHE_PATTERN = /const CACHE_NAME = '([^']+)'/;

test('service worker script is served correctly and registers on the release origin', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.request.get('/sw.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('javascript');
  expect(await response.text()).toContain("const CACHE_NAME = 'milovi-cake-");

  await page.goto('/', { waitUntil: 'load' });
  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: !!reg.active, scriptURL: reg.active ? reg.active.scriptURL : '' };
  });
  expect(registration.active).toBe(true);
  expect(registration.scope).toBe('http://127.0.0.1:4173/');
  expect(registration.scriptURL).toBe('http://127.0.0.1:4173/sw.js');

  // A controlled navigation proves the worker really owns the page.
  await page.reload({ waitUntil: 'load' });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(errors).toEqual([]);
});

test('service worker precaches the current release assets and serves offline navigation', async ({ page, context }) => {
  const sw = await (await page.request.get('/sw.js')).text();
  const cacheName = sw.match(CACHE_PATTERN)[1];

  await page.goto('/', { waitUntil: 'load' });
  const cached = await page.evaluate(async (name) => {
    await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    if (!keys.includes(name)) return { keys, entries: [] };
    const cache = await caches.open(name);
    const requests = await cache.keys();
    return { keys, entries: requests.map((request) => new URL(request.url).pathname) };
  }, cacheName);

  expect(cached.keys).toContain(cacheName);
  // The shell, the shared CSS/JS and the hero images are part of the precache list.
  for (const path of ['/', '/css/style.css', '/js/main.js', '/manifest.json']) {
    expect(cached.entries).toContain(path);
  }
  expect(cached.entries.length).toBeGreaterThanOrEqual(20);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#heroTitleBrand')).toHaveText('Milovi Cake');
    await expect(page.locator('.header-logo')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }

  // Back online the page keeps working and the worker stays in control.
  await page.reload({ waitUntil: 'load' });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});

// A dedicated same-origin fixture drives real CacheStorage and the browser's
// install/activate lifecycle. No production network, historical checkout, or
// mocked ServiceWorker API is needed.
for (const missing of ['/js/main.js', '/css/v20-fixes.css', '/', '/img/head_mobile.avif']) {
  test('service worker atomic update with one missing ' + missing, async ({page,context}) => {
    const http = require('node:http');
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
    const cacheName = source.match(CACHE_PATTERN)[1];
    const previous = cacheName + '-previous-qa';
    const mainPath = source.match(/'([^']*\/js\/main\.js\?v=[^']+)'/)[1];
    const cssPath = source.match(/'([^']*\/css\/v20-fixes\.css\?v=[^']+)'/)[1];
    const critical = missing !== '/img/head_mobile.avif';
    let phase = 'old', fail = false, faultHits = 0;
    const server = http.createServer((req,res) => {
      const url = new URL(req.url,'http://127.0.0.1');
      if (fail && url.pathname === missing) {
        faultHits++; res.writeHead(503); res.end('injected unavailable'); return;
      }
      const isWorker = url.pathname === '/sw.js';
      const isShell = url.pathname === '/' || url.pathname === '/fixture' || url.pathname === '/gallery/';
      const body = isWorker ? (phase === 'old' ? source.replace(CACHE_PATTERN, "const CACHE_NAME = '"+previous+"'") : source)
        : isShell ? '<!doctype html><meta charset=utf-8><p id="phase">'+phase+'</p>'
        : phase + ':' + url.pathname + url.search;
      res.writeHead(200,{'Content-Type':isWorker?'application/javascript':isShell?'text/html':'text/plain','Cache-Control':'no-store'});
      res.end(body);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const keys=()=>page.evaluate(()=>caches.keys());
    const body=url=>page.evaluate(async url=>{const r=await fetch(url);return r.text();},url);
    try {
      await page.goto(origin+'/fixture');
      await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
      await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
      await expect.poll(keys).toEqual([previous]);
      phase='new';fail=true;
      const update=()=>page.evaluate(async()=>{
        const reg=await navigator.serviceWorker.getRegistration();
        const completed=new Promise(resolve=>{
          reg.addEventListener('updatefound',()=>{
            const worker=reg.installing;
            const onState=()=>{if(['activated','redundant'].includes(worker.state))resolve(worker.state);};
            worker.addEventListener('statechange',onState);onState();
          },{once:true});
        });
        await reg.update();
        return Promise.race([completed,new Promise(resolve=>setTimeout(()=>resolve('timeout'),15000))]);
      });
      const outcome=await update();
      expect(faultHits).toBeGreaterThan(0);
      if(critical){
        expect(outcome).toBe('redundant');
        await expect.poll(keys).toEqual([previous]);
        await context.setOffline(true);
        expect(await body(mainPath)).toBe('old:'+mainPath);
        await context.setOffline(false);
        fail=false;
        expect(await update()).toBe('activated');
      }else expect(outcome).toBe('activated');
      await expect.poll(keys).toEqual([cacheName]);
      await context.setOffline(true);
      expect(await body(mainPath)).toBe('new:'+mainPath);
      expect(await body(cssPath)).toBe('new:'+cssPath);
      await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
      await expect(page.locator('#phase')).toHaveText('new');
    } finally {
      await context.setOffline(false);
      await page.close();
      server.closeAllConnections();
      await new Promise(resolve=>server.close(resolve));
    }
  });
}
