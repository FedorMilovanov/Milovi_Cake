// [r38] Диагностическая матрица Service Worker × Storage для WebKit.
//
// Это НЕ гейт: файл целиком пропускается, если не выставлен PW_DIAGNOSTICS=1,
// поэтому обычные прогоны (`npm run qa`, compatibility-лейн) его не запускают.
// Задача — получить на настоящем WebKit управляемые наблюдения вместо догадок:
//
//   SW allow/block × storage normal/QuotaExceededError/SecurityError
//   + восемь последовательных reload подряд,
//
// и записать: pageerror (тип, сообщение, время), requestfailed (URL, причина),
// console-ошибки, состояние registration/controller, длительность кликов по
// корзине. Никаких «зелёных» выводов из этого прогона не делается: первичный
// контракт остаётся в browser-compatibility.yml.
const { test, expect } = require('@playwright/test');

const ENABLED = process.env.PW_DIAGNOSTICS === '1';
const STORAGE_MODES = [['normal', null], ['quota', 'QuotaExceededError'], ['security', 'SecurityError']];
const SW_MODES = [['allow', 'allow'], ['block', 'block']];
const RELOADS = Number(process.env.PW_DIAGNOSTIC_RELOADS || 8);

function collect(page) {
  const events = [];
  const stamp = () => Math.round(performance.now ? 0 : 0);
  const push = (type, data) => events.push({ type, at: Date.now(), ...data });
  page.on('pageerror', (error) => push('pageerror', {
    message: String(error && error.message || error),
    name: String(error && error.name || ''),
    stack: String(error && error.stack || '').split('\n').slice(0, 4).join(' | '),
  }));
  page.on('requestfailed', (request) => push('requestfailed', {
    url: request.url(),
    resourceType: request.resourceType(),
    failure: request.failure() ? request.failure().errorText : '',
  }));
  page.on('console', (message) => {
    if (message.type() === 'error') push('console-error', { text: message.text().slice(0, 300) });
  });
  page.on('crash', () => push('crash', { page: 'crashed' }));
  page.on('close', () => push('page-close', {}));
  return { events, push, stamp };
}

async function swState(page) {
  return page.evaluate(async () => {
    const out = { supported: 'serviceWorker' in navigator, controller: false, registration: 'none', scope: '' };
    if (!out.supported) return out;
    out.controller = !!navigator.serviceWorker.controller;
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.getRegistration(),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (reg) {
        out.registration = reg.active ? 'active' : (reg.installing ? 'installing' : (reg.waiting ? 'waiting' : 'registered'));
        out.scope = reg.scope;
      }
    } catch (error) {
      out.registrationError = String(error && error.message || error);
    }
    return out;
  });
}

/* [r38] Перед кликом снимаем то, что делает элемент «не стабильным»:
   прямоугольник кнопки на десяти подряд идущих кадрах, доставку rAF,
   видимость/фокус документа, pointer-events и активные анимации. */
async function sampleStability(page, selector) {
  return page.evaluate(async (target) => {
    const element = document.querySelector(target);
    if (!element) return { found: false };
    const rects = [];
    let frames = 0;
    const start = Date.now();
    await new Promise((resolve) => {
      const tick = () => {
        const box = element.getBoundingClientRect();
        rects.push({ x: +box.x.toFixed(2), y: +box.y.toFixed(2), w: +box.width.toFixed(2), h: +box.height.toFixed(2) });
        frames += 1;
        if (frames >= 10) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const elapsed = Date.now() - start;
    const drift = (key) => Math.max(...rects.map((rect) => rect[key])) - Math.min(...rects.map((rect) => rect[key]));
    const style = getComputedStyle(element);
    return {
      found: true,
      frames,
      elapsed,
      fps: +(frames / Math.max(elapsed, 1) * 1000).toFixed(1),
      driftX: +drift('x').toFixed(2),
      driftY: +drift('y').toFixed(2),
      driftW: +drift('w').toFixed(2),
      driftH: +drift('h').toFixed(2),
      pointerEvents: style.pointerEvents,
      visibility: style.visibility,
      transforms: {
        self: style.transform,
        item: element.closest('.cart-item') ? getComputedStyle(element.closest('.cart-item')).transform : '',
        drawer: element.closest('#cartDrawer') ? getComputedStyle(element.closest('#cartDrawer')).transform : '',
      },
      animations: element.getAnimations ? element.getAnimations({ subtree: false }).length : null,
      documentHidden: document.visibilityState,
      hasFocus: document.hasFocus(),
      scrollY: Math.round(window.scrollY),
    };
  }, selector);
}

async function timedClick(page, selector, timeout = 20000) {
  const started = Date.now();
  try {
    await page.locator(selector).click({ timeout });
    return { selector, ok: true, ms: Date.now() - started };
  } catch (error) {
    return { selector, ok: false, ms: Date.now() - started, error: String(error && error.message || error).split('\n')[0] };
  }
}

for (const [swMode, serviceWorkers] of SW_MODES) {
  test.describe(`service worker ${swMode} × storage fault matrix`, () => {
    test.skip(!ENABLED, 'diagnostic only: set PW_DIAGNOSTICS=1 to run');
    test.describe.configure({ mode: 'serial' });
    test.use({ serviceWorkers });

    for (const [storageName, storageFailure] of STORAGE_MODES) {
      test(`sw-${swMode} storage-${storageName}: cart add, quantity change, ${RELOADS} reloads`, async ({ page }, testInfo) => {
        test.setTimeout(120000);
        const { events, push } = collect(page);
        if (storageFailure) {
          await page.addInitScript((name) => {
            const write = Storage.prototype.setItem;
            window.__diagFaultAttempts = 0;
            Storage.prototype.setItem = function (key, value) {
              if (key === 'milovicake_cart') {
                window.__diagFaultAttempts += 1;
                throw new DOMException('Storage unavailable', name);
              }
              return write.call(this, key, value);
            };
          }, storageFailure);
        }
        await page.setViewportSize({ width: 320, height: 800 });

        const navigations = [];
        const firstStart = Date.now();
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        navigations.push({ kind: 'first', ms: Date.now() - firstStart, sw: await swState(page) });

        const addClick = await timedClick(page, '#card-2 .btn-add');
        const badgeAfterAdd = await page.locator('#cartBadge').textContent().catch(() => null);
        const drawerOpened = await page.evaluate(() => {
          try { openCart(); return true; } catch (error) { return String(error.message); }
        }).catch((error) => String(error.message));
        const qtyStability = await sampleStability(page, '#cartDrawer .qty-btn:last-child').catch((error) => ({ error: String(error.message) }));
        const qtyClick = await timedClick(page, '#cartDrawer .qty-btn:last-child');
        const qtyValue = await page.locator('#cartDrawer .qty-val').first().textContent().catch(() => null);

        for (let i = 1; i <= RELOADS; i++) {
          const started = Date.now();
          const before = events.length;
          await page.goto('/', { waitUntil: 'domcontentloaded' }).catch((error) => push('navigation-error', { reload: i, message: String(error.message) }));
          const sw = await swState(page);
          navigations.push({ kind: `reload-${i}`, ms: Date.now() - started, sw, eventsDuring: events.slice(before) });
        }

        const summary = {
          storage: storageName,
          serviceWorkers,
          viewport: '320x800',
          addClick,
          badgeAfterAdd,
          drawerOpened,
          qtyStability,
          qtyClick,
          qtyValue,
          faultAttempts: await page.evaluate(() => window.__diagFaultAttempts ?? null).catch(() => null),
          navigations: navigations.map((entry) => ({
            kind: entry.kind,
            ms: entry.ms,
            controller: entry.sw.controller,
            registration: entry.sw.registration,
            events: entry.eventsDuring ? entry.eventsDuring.length : 0,
          })),
          counts: events.reduce((acc, event) => ({ ...acc, [event.type]: (acc[event.type] || 0) + 1 }), {}),
          events,
        };
        await testInfo.attach(`diagnostics-${swMode}-${storageName}.json`, {
          body: JSON.stringify(summary, null, 2),
          contentType: 'application/json',
        });
        console.log(`[diag] sw=${swMode} storage=${storageName} add=${addClick.ok}/${addClick.ms}ms qty=${qtyClick.ok}/${qtyClick.ms}ms events=${JSON.stringify(summary.counts)}`);
        console.log(`[diag]   qty stability: ${JSON.stringify(qtyStability)}`);
        for (const event of events.filter((entry) => entry.type === 'pageerror' || entry.type === 'requestfailed')) {
          console.log(`[diag]   ${event.type}: ${event.message || (event.url + ' ' + event.failure)}`);
        }

        expect(navigations).toHaveLength(RELOADS + 1);
      });
    }
  });
}
