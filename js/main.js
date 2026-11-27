(function () {
  'use strict';

  // IMG_BASE приходит из инлайн-скрипта страницы (`var IMG_BASE = ...` → свойство window).
  // Локальный фолбэк гарантирует, что корзина, калькулятор и лайтбокс не упадут
  // с ReferenceError, если на новой странице инлайн-строку забудут.
  var IMG_BASE = (typeof window.IMG_BASE === 'string' && window.IMG_BASE) ? window.IMG_BASE : 'img';

/* ═══════════════════════════════════════════════════════
   MILOVI CAKE r18 — Общий JavaScript
   ═══════════════════════════════════════════════════════ */

// ── THEME ENGINE ──
(function initTheme() {
  var saved       = (function(){ try { return localStorage.getItem('mc_theme'); } catch(e){ return null; } })();
  // Default light; explicit saved choice wins.
  var theme       = saved === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();

// Синхронизация всех элементов управления темой: переключатель в шапке,
// сегмент «Светлая / Тёмная» в мобильном меню, aria-состояния и meta theme-color.
function syncThemeControls() {
  var dark = document.documentElement.getAttribute('data-theme') === 'dark';
  var opts = document.querySelectorAll('[data-theme-set]');
  for (var i = 0; i < opts.length; i++) {
    var isDark = opts[i].getAttribute('data-theme-set') === 'dark';
    opts[i].setAttribute('aria-pressed', isDark === dark ? 'true' : 'false');
  }
  var headBtn = document.getElementById('themeToggleBtn');
  if (headBtn) headBtn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  var meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', dark ? '#16100a' : '#f5f0e8');
}
function setTheme(theme) {
  var next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('mc_theme', next); } catch(e){}
  syncThemeControls();
}
function toggleTheme() {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
window.toggleTheme = toggleTheme;
window.setTheme = setTheme;
window.syncThemeControls = syncThemeControls;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncThemeControls);
else syncThemeControls();

// ── FILLS DATA ──
const FILLS = {
  /* [r33] Без эмодзи: калькулятор отдаёт «Микс ягод» (текст опции), и при
     расхождении строк корзина показывала «— уточнить —» при уже выбранной
     начинке, а выбор в корзине создавал второй ключ и эмодзи в WA-сообщении. */
  biscuit: ['Микс ягод', 'Ванильная карамель с арахисом', 'Шоколадная карамель с арахисом', 'Шоколадный ореховый хруст', 'Воздушный поцелуй', 'Ванильная вишня', 'Ванильные тропики', 'Ванильные облака', 'Вишня в шоколаде', 'Шоколадный микс ягод', 'Красный бархат', 'Супер-Шоколад'],
  bento: ['Микс ягод', 'Карамель с орехами', 'Карамель с вафлями', 'Малина', 'Вишня'],
  cake3d: ['Молочная девочка', 'Медовик', 'Молочная девочка + сливочный крем'],
};

function getFillsForProduct(p) {
  return FILLS[p.fillGroup] || [];
}

// ── ЕДИНАЯ ТОЧКА ФОРМИРОВАНИЯ КЛЮЧА КОРЗИНЫ (r18, формат расширен в r35) ──
// Формат для ВСЕХ товаров: "id:mode:fill:decor[:biscuit]"
// mode = 'regular' | 'maxi'; biscuit = 'vanilla' | 'choco' — пятый сегмент
// существует ТОЛЬКО у Бенто/Макси Бенто и ТОЛЬКО когда выбор известен.
// Так старые корзины (4 сегмента) читаются как раньше, а ванильный и
// шоколадный Бенто больше не схлопываются в одну строку.
/* Экранирование разделителя. Прежняя версия делала s.replace(/:/g, '\u003A'),
   а '\u003A' — это тот же символ ':', то есть замена двоеточия двоеточием:
   название с ':' ломало разбор ключа. Кодируем '%' и ':' в %25 и %3A. */
function encodeCartPart(s) {
  return typeof s === 'string' && s ? s.replace(/%/g, '%25').replace(/:/g, '%3A') : '';
}
function decodeCartPart(s) {
  if (typeof s !== 'string' || !s) return '';
  return s.replace(/%(3A|25)/g, function (m, g) { return g === '3A' ? ':' : '%'; });
}
function buildCartKey(numId, mode, hasMaxi, fillName, decorName, biscuit) {
  const m = hasMaxi ? (mode || 'regular') : 'regular';
  const hasDecor = !!decorName;
  // Если декор есть, а начинки нет, второй сегмент всё равно нужен пустой:
  // иначе «:декор» читался как начинка и декор терялся при разборе.
  const f = (fillName || hasDecor) ? ':' + encodeCartPart(fillName || '') : '';
  const d = hasDecor ? ':' + encodeCartPart(decorName) : '';
  const b = (biscuit === 'choco' || biscuit === 'vanilla') ? ':' + biscuit : '';
  return numId + ':' + m + f + d + b;
}

// ── РАЗБОР КЛЮЧА КОРЗИНЫ ──
function parseCartKey(key) {
  const parts = String(key).split(':');
  const biscuit = (parts[4] === 'choco' || parts[4] === 'vanilla') ? parts[4] : '';
  return {
    numId: parseInt(parts[0]),
    mode: parts[1] || 'regular',
    fill: decodeCartPart(parts[2] || ''),
    decor: decodeCartPart(parts[3] || ''),
    biscuit: biscuit,
  };
}

/* [r34] Старые корзины: до r33 в FILLS лежали названия с эмодзи, и ключ
   строки содержал «Микс ягод 🍓». Чистим только ИЗВЕСТНЫЕ старые написания —
   произвольные эмодзи из пользовательского текста не вырезаем: список явный
   и пополняется вручную, если название менялось ещё когда-то. */
const LEGACY_FILL_ALIASES = { 'Микс ягод 🍓': 'Микс ягод' };
function normalizeLegacyFill(name) {
  const raw = typeof name === 'string' ? name.trim() : '';
  return LEGACY_FILL_ALIASES[raw] || raw;
}

/* Приведение ключа к текущему формату. Работает идемпотентно: повторный
   прогон на уже приведённом ключе ничего не меняет. Поля записи главнее
   ключа (в записи живёт точный выбор), но отсутствующий бисквит НЕ
   выдумываем: если его нет ни в записи, ни в ключе — сегмент не появляется. */
function normalizeCartKey(key, entry) {
  const parsed = parseCartKey(key);
  if (!parsed.numId) return key;
  const p = products.find(x => x.id === parsed.numId);
  if (!p) return key;
  const mode = (entry && entry.mode) || parsed.mode || 'regular';
  const fillRaw = (entry && typeof entry.fill === 'string') ? entry.fill : (parsed.fill || '');
  const fill = normalizeLegacyFill(fillRaw);
  const decor = (entry && typeof entry.decor === 'string') ? entry.decor : (parsed.decor || '');
  const biscuit = p.id === 2 ? ((entry && entry.biscuit) || parsed.biscuit || '') : '';
  return buildCartKey(parsed.numId, mode, !!p.hasMaxi, fill, decor, biscuit);
}

function isSafeCartQty(qty, product) {
  return Number.isSafeInteger(qty * (product.unit === 'кг' ? 2 : 1)) && Number.isSafeInteger(qty * product.priceNum);
}

function addCartQty(entry, amount, product, isAuthor = false) {
  if ((entry.dessertType === 'author') !== isAuthor) { showToast('Выберите одинаковый тип десерта'); return false; }
  const qty = entry.qty + amount;
  if (!isSafeCartQty(qty, product)) { showToast('Слишком большое количество'); return false; }
  entry.qty = qty;
  return true;
}

function setCartItemFill(oldCartKey, fill, select) {
  const entry = cart[oldCartKey];
  if (!entry) return;
  const newFill = fill || '';
  const parsed  = parseCartKey(oldCartKey);
  const p       = products.find(x => x.id === parsed.numId);
  const mode    = entry.mode || parsed.mode;
  // [r35] бисквит — часть ключа: без него смена начинки у шоколадного
  // Бенто «сливала» его с ванильным.
  const newKey  = p ? buildCartKey(parsed.numId, mode, !!p.hasMaxi, newFill, entry.decor || parsed.decor || '', entry.biscuit || parsed.biscuit || '') : oldCartKey;

  if (newKey !== oldCartKey) {
    if (cart[newKey]) {
      if (!addCartQty(cart[newKey], entry.qty, mode === 'maxi' ? p.maxiVariant : p, entry.dessertType === 'author')) {
        if (select) select.value = entry.fill || parsed.fill || '';
        return;
      }
    } else {
      cart[newKey] = { ...entry, fill: newFill };
    }
    delete cart[oldCartKey];
  } else {
    cart[oldCartKey].fill = newFill;
  }
  saveCartToStorage();
  updateCartUI();
}
window.setCartItemFill = setCartItemFill;

function setCartItemDessertType(cartKey, type) {
  if (cart[cartKey]) {
    cart[cartKey].dessertType = type;
    saveCartToStorage();
    updateCartUI();
  }
}
window.setCartItemDessertType = setCartItemDessertType;

const slideTimers = {};
const sliderCurrentIdx = {};

function startProductSlider(pid, total) {
  stopProductSlider(pid);
  if (total <= 1) return;
  slideTimers[pid] = setInterval(() => {
    if (document.hidden) return;
    const wrap = document.getElementById('slider-' + pid);
    if (wrap && (wrap.matches(':hover, :focus-within') || wrap._slidePending != null)) return;
    goSlide(pid, (sliderCurrentIdx[pid] || 0) + 1);
  }, 3000);
}

function stopProductSlider(pid) {
  if (slideTimers[pid]) { clearInterval(slideTimers[pid]); delete slideTimers[pid]; }
}

function goSlide(pid, idx) {
  const wrap = document.getElementById('slider-' + pid);
  if (!wrap) return;
  const slides = wrap.querySelectorAll('.slide-img');
  if (!slides.length) return;
  const next = (idx + slides.length) % slides.length;
  if (wrap._slidePending === next) return;

  // Skip stale loads.
  const ticket = wrap._slideTicket = (wrap._slideTicket || 0) + 1;
  wrap._slidePending = next;
  const show = () => {
    if (wrap._slideTicket !== ticket || !slides[next].isConnected) return;
    wrap._slidePending = null;
    wrap.removeAttribute('aria-busy');
    sliderCurrentIdx[pid] = next;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === next));
    wrap.querySelectorAll('.dot').forEach((dot, i) => {
      const active = i === next;
      dot.classList.toggle('active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };
  const img = slides[next].querySelector('img');
  if (!img) { show(); return; }
  // Resolve only the requested slide; preserve the visible old slide while it decodes.
  if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
  const loaded = () => img.decode ? img.decode().then(show, show) : show();
  if (img.complete && img.naturalWidth) { loaded(); return; }
  wrap.setAttribute('aria-busy', 'true');
  img.addEventListener('load', loaded, { once: true });
  img.addEventListener('error', () => requestAnimationFrame(show), { once: true });
  if (img.complete && !img.naturalWidth) requestAnimationFrame(show);
}

// ── DATA ──
const products = [
  { id: 1, name: 'Бисквитный торт', fillGroup: 'biscuit', desc: 'Воздушный торт с нежнейшим кремом и авторским декором', min: 'Заказ от 2 кг, декор рассчитывается отдельно', price: 'от 2 800 ₽/кг', priceNum: 2800, unit: 'кг', minKg: 2, emoji: '🎂', badge: 'Популярно',
    slides: [IMG_BASE + '/cake_biscuit_0.webp', IMG_BASE + '/cake_biscuit_1.webp', IMG_BASE + '/cake_biscuit_2.webp', IMG_BASE + '/cake_biscuit_3.webp', IMG_BASE + '/cake_biscuit_4.webp', IMG_BASE + '/cake_biscuit_5.webp'],
    slidePos: ['center 30%', 'center 25%', 'center 20%', 'center 30%', 'center 20%', 'center 25%'] },
  { id: 2, name: 'Бенто торт', fillGroup: 'bento', desc: 'Миниатюрный торт — идеальный подарок для особенного момента', min: '', price: '1 600 ₽', priceNum: 1600, unit: 'шт', emoji: '🍰',
    slides: [IMG_BASE + '/bento_1.webp', IMG_BASE + '/bento_2.webp', IMG_BASE + '/bento_4.webp'],
    slidePos: ['60% 50%', 'center 5%', 'center 40%'],
    slideScale: [1.4, 1, 1],
    hasMaxi: true,
    maxiVariant: {
      name: 'Макси Бенто', desc: 'Увеличенный бенто торт — больше радости, больше вкуса', price: 'от 3 000 ₽/шт', priceNum: 3000, unit: 'шт', minQty: 1,
      slides: [IMG_BASE + '/bento_maxi.webp'], slidePos: ['center 40%'], slideScale: [1]
    }
  },
  { id: 3, name: '3D Торт', fillGroup: 'cake3d', desc: 'Уникальный дизайнерский торт с объёмными элементами', min: 'Заказ от 3 кг', price: '5 000 ₽/кг', priceNum: 5000, unit: 'кг', minKg: 3, emoji: '✨',
    slides: [IMG_BASE + '/cake_3d.webp', IMG_BASE + '/cake_3d_2.webp'], slidePos: ['center 30%', 'center 10%'], slideScale: [1, 1] },
  { id: 4, name: 'Меренговый рулет', desc: 'Хрустящая меренга с нежным кремом — наш фирменный десерт', min: '', price: '2 500 ₽/шт', priceNum: 2500, unit: 'шт', emoji: '🥐',
    slides: [IMG_BASE + '/meringue_roll.webp', IMG_BASE + '/meringue_roll_2.webp', IMG_BASE + '/meringue_roll_3.webp', IMG_BASE + '/meringue_roll_4.webp', IMG_BASE + '/meringue_roll_5.webp', IMG_BASE + '/meringue_roll_6.webp'],
    slidePos: ['center 35%', 'center 40%', 'center 35%', 'center 30%', 'center 25%', 'center 30%'] },
  { id: 5, name: 'Пирожное "Павлова"', minQty: 2, desc: 'Воздушная меренга с кремом и начинкой из ягод', min: 'Заказ от 2 шт', price: '350 ₽/шт', priceNum: 350, unit: 'шт', emoji: '🍓',
    slides: [IMG_BASE + '/pavlova.webp', IMG_BASE + '/pavlova_2.webp', IMG_BASE + '/pavlova_3.webp'], slidePos: ['center 55%', 'center 45%', 'center 50%'] },
  { id: 6, name: 'Капкейки', minQty: 6, desc: 'Набор изящных капкейков с разными вкусами', min: 'Заказ от 6 шт одного вкуса', price: '350 ₽/шт', priceNum: 350, unit: 'шт', emoji: '🧁',
    slides: [IMG_BASE + '/cupcakes.webp', IMG_BASE + '/cupcakes_2.webp'], slidePos: ['center 35%', 'center 40%'] },
];

let cart = {};

// Native controls keep carousel dots operable by keyboard and screen readers.
function renderSlideDots(pid, count) {
  return Array.from({ length: count }, (_, i) => `
    <button type="button" class="dot${i === 0 ? ' active' : ''}"
      onclick="goSlide('${pid}',${i})"
      aria-label="Фото ${i + 1} из ${count}"${i === 0 ? ' aria-current="true"' : ''}></button>
  `).join('');
}

function renderCatalog() {
  products.forEach(p => stopProductSlider(p.id));

  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  grid.innerHTML = products.map(p => {
    let imgHtml;
    if (p.slides && p.slides.length) {
      imgHtml = `
        <div class="slider-wrap" id="slider-${p.id}">
          ${p.slides.map((src, i) => {
            const active = i === 0 ? ' active' : '';
            return `<div class="slide-img${active}">
              <img ${i === 0 ? `src="${src}"` : `data-src="${src}"`} alt="${p.name}" width="600" height="800" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=slide-img-fallback>${p.emoji || '🎂'}</div>'" />
            </div>`;
          }).join('')}
          ${p.slides.length > 1 ? `
            <button type="button" class="slide-btn slide-prev" onclick="sliderStep('${p.id}',-1)" aria-label="Предыдущее фото — ${p.name}">&#8249;</button>
            <button type="button" class="slide-btn slide-next" onclick="sliderStep('${p.id}',1)" aria-label="Следующее фото — ${p.name}">&#8250;</button>
            <div class="slide-dots">${renderSlideDots(p.id, p.slides.length)}</div>
          ` : ''}
        </div>`;
    } else {
      imgHtml = `<div class="product-img-ph">${p.emoji}</div>`;
    }
    const titleHtml = p.hasMaxi
      ? `<div class="bento-header-row">
           <h3 id="name-${p.id}">${p.name}</h3>
           <div class="bento-seg" id="bento-pill-${p.id}">
             <span class="bento-seg-opt active" id="tab-regular-${p.id}" onclick="switchBentoTab(${p.id}, 'regular')" data-tip="~350 гр">Стандарт</span>
             <span class="bento-seg-opt" id="tab-maxi-${p.id}" onclick="switchBentoTab(${p.id}, 'maxi')" data-tip="~1100 гр">Макси</span>
           </div>
         </div>`
      : `<h3 id="name-${p.id}">${p.name}</h3>`;

    return `
    <div class="product-card" id="card-${p.id}">
      ${imgHtml}
      <div class="product-info">
        ${titleHtml}
        <p class="desc" id="desc-${p.id}">${p.desc}</p>
        <p class="min-order${p.min ? '' : ' is-empty'}" id="min-${p.id}">${p.min || ''}</p>
        <div class="product-footer">
          <span class="price" id="price-${p.id}">${p.price}</span>
          <button type="button" class="btn-add" onclick="addToCart(${p.id}, event)">Добавить в корзину</button>
        </div>
      </div>
    </div>`;
  }).join('');

  products.forEach(p => {
    if (p.slides && p.slides.length > 1) {
      const wrap = document.getElementById('slider-' + p.id);
      if (wrap) {
        wrap.addEventListener('mouseenter', () => stopProductSlider(p.id));
        wrap.addEventListener('mouseleave', () => startProductSlider(p.id, p.slides.length));
      }
      addSliderTouch(p.id, p.slides.length);
      startProductSlider(p.id, p.slides.length);
    }
  });
  observeReveal();
  initPriceGlowObserver();
}

function sliderStep(pid, dir) {
  const wrap = document.getElementById('slider-' + pid);
  goSlide(pid, (wrap?._slidePending ?? sliderCurrentIdx[pid] ?? 0) + dir);
}

// ── CALCULATOR STATE ──
let _calcWeight = 2;
let _calcQty = 1;
let _cakeType = 'biscuit';

const CAKE_CONFIGS = {
  biscuit:   { weightMin: 2, weightMax: 10, weightStep: 0.5, hasWeight: true,  hasQty: false, pricePerKg: 2800, fixedPrice: null, fillGroup: 'calcFill' },
  bento:     { weightMin: 1, weightMax: 1,  weightStep: 1,   hasWeight: false, hasQty: true,  pricePerKg: null, fixedPrice: 1600, fillGroup: 'calcFillBento' },
  bentomaxi: { weightMin: 3, weightMax: 5,  weightStep: 0.5, hasWeight: false, hasQty: true,  pricePerKg: null, fixedPrice: 3000, fillGroup: 'calcFillBento' },
  cake3d:    { weightMin: 3, weightMax: 15, weightStep: 0.5, hasWeight: true,  hasQty: false, pricePerKg: 5000, fixedPrice: null, fillGroup: 'calcFill3d'   },
};

// ── PRODUCT SLIDER TOUCH ──
// [r25] Свайп по фото товара «тянется» за пальцем: кадр едет вместе с ним,
// у края сопротивляется, при отпускании сдвиг/флик докручивает слайд.
function addSliderTouch(pid, total) {
  const wrap = document.getElementById('slider-' + pid);
  if (!wrap) return;
  // На телефоне каталог — нативная карусель (одна карточка в кадре): свайп по
  // фото листает ТОВАРЫ, поэтому собственную смену кадров здесь не перехватываем.
  const grid = document.getElementById('catalogGrid');
  if (grid && grid.scrollWidth > grid.clientWidth + 4) return;
  if (wrap._touchAbort) wrap._touchAbort.abort();
  const _sig = (wrap._touchAbort = new AbortController()).signal;
  let startX = 0, startY = 0, dx = 0, startT = 0;
  let dragging = false, horizontal = false, activeEl = null;

  const currentIdx = () => wrap._slidePending ?? sliderCurrentIdx[pid] ?? 0;

  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
    dx = 0; dragging = true; horizontal = false;
    wrap._wasSwiped = false;
    activeEl = wrap.querySelector('.slide-img.active');
  }, { passive: true, signal: _sig });

  wrap.addEventListener('touchmove', (e) => {
    if (!dragging || e.touches.length !== 1) return;
    dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!horizontal) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.15) { dragging = false; return; } // это скролл страницы
      horizontal = true;
      wrap.classList.add('is-dragging');
    }
    if (e.cancelable) e.preventDefault();
    const cur = currentIdx();
    const atEdge = (dx < 0 && cur >= total - 1) || (dx > 0 && cur <= 0);
    const shift = dx * (atEdge ? 0.22 : 0.85);
    if (activeEl) {
      activeEl.style.transition = 'none';
      activeEl.style.transform = 'translate3d(' + shift + 'px,0,0) scale(' + (1 - Math.min(Math.abs(shift), 160) / 2400) + ')';
      activeEl.style.opacity = String(atEdge ? Math.max(0.7, 1 - Math.abs(dx) / 720) : Math.max(0.6, 1 - Math.abs(dx) / 460));
    }
  }, { passive: false, signal: _sig });

  function finishTouch() {
    const wasHorizontal = horizontal;
    const el = activeEl;
    const cur = currentIdx();
    const fastFlick = Math.abs(dx) > 26 && (Date.now() - startT) < 300;
    const shouldStep = wasHorizontal && dragging && (Math.abs(dx) > 46 || fastFlick);
    dragging = false; horizontal = false;
    wrap.classList.remove('is-dragging');
    if (el) {
      el.style.transition = 'transform .32s cubic-bezier(.2,1.2,.3,1), opacity .3s ease';
      el.style.transform = '';
      el.style.opacity = '';
    }
    if (shouldStep) {
      wrap._wasSwiped = true;
      goSlide(pid, cur + (dx < 0 ? 1 : -1));
      if (slideTimers[pid]) startProductSlider(pid, total);
      setTimeout(() => { wrap._wasSwiped = false; }, 320);
    }
    dx = 0; activeEl = null;
  }
  wrap.addEventListener('touchend', finishTouch, { passive: true, signal: _sig });
  wrap.addEventListener('touchcancel', finishTouch, { passive: true, signal: _sig });
}

// ── BENTO TAB ──
/* [r32] Единственный источник правды о доплате за декор.
   У типов с фиксированной ценой (Бенто, Макси Бенто) авторский декор в
   предварительную стоимость НЕ входит — он «рассчитывается отдельно»
   (коммерческое условие владельца, r30–r31). Раньше правило было записано
   дважды: updateCalc() исключал доплату по `fixedPrice !== null`, а
   addCalcToCart() — только для литерала 'bento'. Из-за расхождения Макси
   Бенто показывал ~3 000 ₽ в калькуляторе и 4 000 ₽ в корзине и в сообщении.
   Теперь обе точки спрашивают одну функцию. */
function calcDecorSurcharge(type, decorEl) {
  const cfg = CAKE_CONFIGS[type] || CAKE_CONFIGS.biscuit;
  if (cfg.fixedPrice !== null) return 0;
  const price = +(decorEl && decorEl.dataset ? decorEl.dataset.price : 0);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : 0;
}

const bentoModes = {};

function switchBentoTab(pid, mode) {
  const p = products.find(x => x.id === pid);
  if (!p || !p.hasMaxi) return;
  bentoModes[pid] = mode;
  const isMaxi = mode === 'maxi';
  const variant = isMaxi ? p.maxiVariant : p;
  showBentoWeightToast(isMaxi ? '~1100 гр' : '~350 гр');
  const tabReg  = document.getElementById('tab-regular-' + pid);
  const tabMaxi = document.getElementById('tab-maxi-' + pid);
  if (tabReg)  tabReg.classList.toggle('active', !isMaxi);
  if (tabMaxi) tabMaxi.classList.toggle('active', isMaxi);
  const descEl  = document.getElementById('desc-' + pid);
  const minEl   = document.getElementById('min-' + pid);
  const priceEl = document.getElementById('price-' + pid);
  if (descEl)  descEl.textContent  = variant.desc;
  if (minEl) {
    minEl.textContent = variant.min || '';
    minEl.classList.toggle('is-empty', !variant.min);
  }
  if (priceEl) priceEl.textContent = variant.price;

  const wrap = document.getElementById('slider-' + pid);
  if (wrap) {
    wrap._slideTicket = (wrap._slideTicket || 0) + 1;
    wrap._slidePending = null;
    wrap.removeAttribute('aria-busy');
    const slides = variant.slides;
    const positions = variant.slidePos || slides.map(() => 'center center');
    const scales = variant.slideScale || slides.map(() => 1);
    wrap.querySelectorAll('.slide-img').forEach(el => el.remove());
    const dotsEl = wrap.querySelector('.slide-dots');
    const variantEmoji = p.emoji || '🎂';
    let newSlidesHtml = '';
    slides.forEach((src, i) => {
      const active = i === 0 ? ' active' : '';
      newSlidesHtml += `<div class="slide-img${active}"><img ${i === 0 ? `src="${src}"` : `data-src="${src}"`} alt="${variant.name}" width="600" height="800" decoding="async" loading="lazy" onerror="this.outerHTML='<div class=slide-img-fallback>${variantEmoji}</div>'" style="object-position:${positions[i]};transform:scale(${scales[i]});transform-origin:${positions[i]};"></div>`;
    });
    if (dotsEl) {
      dotsEl.insertAdjacentHTML('beforebegin', newSlidesHtml);
      dotsEl.innerHTML = renderSlideDots(pid, slides.length);
    }
    sliderCurrentIdx[pid] = 0;
    if (slideTimers[pid]) { clearInterval(slideTimers[pid]); delete slideTimers[pid]; }
    if (slides.length > 1 && !wrap.matches(':hover')) startProductSlider(pid, slides.length);
    addSliderTouch(pid, slides.length);
  }
}

// ── LOCALSTORAGE ──
let cartStorageWarned = false;
function saveCartToStorage() {
  try {
    localStorage.setItem('milovicake_cart', JSON.stringify(cart));
    cartStorageWarned = false;
  } catch (e) {
    /* [r37] Одна реплика на серию отказов. Раньше каждый шаг корзины под
       запретом localStorage (iOS Private Mode, QuotaExceeded) заново бросал
       исключение и заново показывал тост: пользователь видел мигающую плашку
       после каждого «+/−», а страница получала лишний layout на каждый шаг.
       Признак сбрасывается, как только запись снова проходит. */
    if (!cartStorageWarned) {
      cartStorageWarned = true;
      showToast('Корзина не сохранится при обновлении');
    }
  }
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('milovicake_cart');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { saveCartToStorage(); return; }
    const originals = {};
    let preserve = false;
    Object.keys(parsed).forEach(key => {
      const entry = parsed[key];
      const parsedKey = parseCartKey(key);
      const product = products.find(p => p.id === parsedKey.numId);
      if (!product || !entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      if ((entry.fill != null && typeof entry.fill !== 'string') || (entry.decor != null && typeof entry.decor !== 'string')) return;
      const mode = entry.mode || parsedKey.mode || 'regular';
      if ((mode !== 'regular' && mode !== 'maxi') || (mode === 'maxi' && !product.hasMaxi)) return;
      const variant = mode === 'maxi' ? product.maxiVariant : product;
      const qty = entry.qty;
      const min = variant.minQty || variant.minKg || 1;
      if (typeof qty !== 'number' || qty < min || !isSafeCartQty(qty, variant)) return;
      // [r31] Новые поля строки: доплата за декор и выбранный бисквит.
      // Санитизируем, а не выбрасываем строку: старые корзины остаются живыми.
      const _decorAdd = Number(entry.decorAdd);
      entry.decorAdd = (Number.isFinite(_decorAdd) && _decorAdd > 0 && _decorAdd <= 100000) ? Math.round(_decorAdd) : 0;
      /* [r35] Бисквит теперь входит в ключ позиции. Источник истины — запись
         (entry.biscuit), иначе ключ. Для товаров без выбора бисквита поле
         не храним вовсе; отсутствующий выбор не восстанавливаем. */
      const _entryBiscuit = (entry.biscuit === 'choco' || entry.biscuit === 'vanilla') ? entry.biscuit : '';
      const _biscuit = product.id === 2 ? (_entryBiscuit || parsedKey.biscuit || '') : '';
      if (_biscuit) entry.biscuit = _biscuit; else delete entry.biscuit;
      // [r34] Старое название начинки в самой строке — к современному виду до сборки ключа.
      if (typeof entry.fill === 'string' && entry.fill) entry.fill = normalizeLegacyFill(entry.fill);
      originals[key] = { ...entry, mode };
      const normalizedKey = normalizeCartKey(key, entry);
      const existing = cart[normalizedKey];
      const combined = (existing?.qty || 0) + qty;
      if (existing && ((existing.dessertType === 'author') !== (entry.dessertType === 'author') || !isSafeCartQty(combined, variant))) { preserve = true; return; }
      if (cart[normalizedKey]) cart[normalizedKey].qty = combined;
      else cart[normalizedKey] = entry;
      if (!cart[normalizedKey].mode) cart[normalizedKey].mode = mode;
      bentoModes[parsedKey.numId] = cart[normalizedKey].mode;
    });
    if (preserve) cart = originals;
    saveCartToStorage();
  } catch(e) {}
}

// ── Confetti ──
function confettiBurst(x, y) {
  var now = Date.now();
  if (confettiBurst._last && now - confettiBurst._last < 400) return;
  confettiBurst._last = now;
  const colors = ["#c9934a", "#d4a76a", "#e8c080", "#f5e1c0", "#fff"];
  for (let i = 0; i < 14; i++) {
    const particle = document.createElement("div");
    const size = Math.random() * 6 + 4;
    particle.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random() * colors.length)]};border-radius:${Math.random() > 0.5 ? "50%" : "2px"};pointer-events:none;z-index:100000;`;
    document.body.appendChild(particle);
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 100 + 50;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 80;
    particle.animate([
      { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
      { transform: `translate(${vx}px, ${vy + 120}px) rotate(${Math.random()*720}deg) scale(0)`, opacity: 0 }
    ], { duration: 800 + Math.random() * 400, easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", }).onfinish = () => particle.remove();
  }
}

function addToCart(id, e) {
  let p = products.find(x => x.id === id);
  const mode = (p && p.hasMaxi && bentoModes[id] === 'maxi') ? 'maxi' : 'regular';
  // [r18] Всегда используем buildCartKey для единообразия
  const cartKey = buildCartKey(id, mode, !!p.hasMaxi, '', '');

  if (p && p.hasMaxi && mode === 'maxi') {
    p = { ...p, ...p.maxiVariant };
  }
  if (!cart[cartKey]) {
    const defaultQty = p.unit === 'кг' ? (p.minKg || 1) : (p.minQty || 1);
    cart[cartKey] = { qty: defaultQty, mode, dessertType: 'base' };
  } else {
    const step = p.unit === 'кг' ? 0.5 : 1;
    if (!addCartQty(cart[cartKey], step, p)) return;
  }
  updateCartUI();
  saveCartToStorage();
  if (e) confettiBurst(e.clientX, e.clientY);
}

const _removingCartIds = new Set();
function removeFromCart(id) {
  if (_removingCartIds.has(String(id))) return;
  _removingCartIds.add(String(id));
  const items = document.querySelectorAll('.cart-item');
  let targetEl = null;
  items.forEach(el => {
    if (el.dataset.cartId == id) { targetEl = el; }
    if (!targetEl && el.querySelector(`[onclick="removeFromCart(${id})"]`)) targetEl = el;
  });
  if (targetEl) {
    targetEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease, max-height 0.3s ease 0.1s, margin 0.3s ease 0.1s, padding 0.3s ease 0.1s';
    targetEl.style.opacity = '0';
    targetEl.style.transform = 'translateX(30px)';
    targetEl.style.maxHeight = targetEl.offsetHeight + 'px';
    requestAnimationFrame(() => { requestAnimationFrame(() => {
      targetEl.style.maxHeight = '0';
      targetEl.style.marginBottom = '0';
      targetEl.style.paddingTop = '0';
      targetEl.style.paddingBottom = '0';
    }); });
    setTimeout(() => { delete cart[id]; _removingCartIds.delete(String(id)); updateCartUI(); saveCartToStorage(); }, 350);
  } else {
    delete cart[id]; _removingCartIds.delete(String(id)); updateCartUI(); saveCartToStorage();
  }
}

function clearCart() {
  const body = document.getElementById('cartBody');
  if (!body) return;
  if (document.getElementById('cartClearConfirm')) return;
  const confirm = document.createElement('div');
  confirm.id = 'cartClearConfirm';
  confirm.setAttribute('role', 'alertdialog');
  confirm.setAttribute('aria-modal', 'true');
  confirm.setAttribute('aria-labelledby', 'cartClearTitle');
  confirm.style.cssText = `position:absolute;inset:0;background:var(--white);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;z-index:10;border-radius:inherit;animation:fadeInUp 0.2s ease;`;
  confirm.innerHTML = `<div style="color:var(--cart-danger);line-height:0"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></div><div id="cartClearTitle" style="font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--brown);text-align:center">Очистить корзину?</div><div style="display:flex;gap:12px"><button type="button" id="cartClearNo" style="background:none;border:1.5px solid var(--cream-dark);border-radius:50px;padding:10px 28px;font-family:'Jost',sans-serif;font-size:14px;color:var(--cart-muted);cursor:pointer;transition:border-color 0.2s,color 0.2s;">Нет</button><button type="button" id="cartClearYes" style="background:var(--brown);border:none;border-radius:50px;padding:10px 28px;font-family:'Jost',sans-serif;font-size:14px;color:var(--cream);cursor:pointer;transition:background 0.2s;">Да, очистить</button></div>`;
  const drawer = document.getElementById('cartDrawer');
  if (!drawer) return;
  drawer.appendChild(confirm);
  const cancel = document.getElementById('cartClearNo');
  const accept = document.getElementById('cartClearYes');
  if (window._trapFocus) window._cartConfirmTrapRelease = window._trapFocus(confirm);
  cancel.focus({ preventScroll: true });
  cancel.onclick = () => {
    confirm.style.animation = 'fadeOutDown 0.18s ease forwards';
    setTimeout(() => {
      _cartDismissConfirm();
      if (_cartState === 'open') document.getElementById('cartClearBtn').focus({ preventScroll: true });
    }, 180);
  };
  accept.onclick = () => {
    const cartItems = body.querySelectorAll('.cart-item');
    cartItems.forEach((el, i) => { el.style.transition = `opacity 0.2s ease ${i * 50}ms, transform 0.2s ease ${i * 50}ms`; el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; });
    setTimeout(() => {
      _cartDismissConfirm();
      cart = {};
      saveCartToStorage();
      setCartStep(1);
      const cartFooter = document.getElementById('cartFooter');
      if (cartFooter) cartFooter.style.display = 'none';
      body.style.display = '';
      updateCartUI();
      if (_cartState === 'open') document.querySelector('#cartDrawer .cart-empty-cta')?.focus({ preventScroll: true });
    }, cartItems.length * 50 + 200);
  };
}

function cartQuantityMax(product){
  // Keep current business caps, rather than inventing new ones in the UI.
  return product.unit === 'кг' ? (product.maxiVariant ? 5 : 20) : 20;
}
function changeQty(cartKey, delta) {
  const parsed = parseCartKey(cartKey);
  let p = products.find(x => x.id === parsed.numId);
  const entry = cart[cartKey];
  if (!p || !entry) return;
  if (p.hasMaxi && entry.mode === 'maxi') p = { ...p, ...p.maxiVariant };
  const step = p.unit === 'кг' ? 0.5 : 1;
  const minQty = p.minQty || (p.unit === 'кг' ? (p.minKg || 1) : 1);
  const maxQty = cartQuantityMax(p);
  const focusedControl = document.activeElement;
  const restoreQtyFocus = focusedControl?.classList?.contains('qty-btn') &&
    focusedControl.closest('.cart-item')?.dataset.cartId === cartKey;
  const nextQty = Math.round((entry.qty + delta * step) * 10) / 10;
  entry.qty = delta > 0 ? Math.min(nextQty, Math.max(maxQty, entry.qty)) : nextQty;
  if (entry.qty < minQty) delete cart[cartKey];
  updateCartUI();
  saveCartToStorage();
  if (restoreQtyFocus) {
    const item = Array.from(document.querySelectorAll('#cartBody .cart-item'))
      .find(el => el.dataset.cartId === cartKey);
    const controls = item?.querySelectorAll('.qty-ctrl .qty-btn');
    const target = (controls && controls[delta > 0 ? 1 : 0]) ||
      document.querySelector('#cartBody .qty-btn, #cartBody .cart-empty-cta');
    if (target) target.focus({ preventScroll: true });
  }
}

function setCartStep(step) {
  [document.getElementById('step1'), document.getElementById('step2'), document.getElementById('step3')].forEach((s, i) => {
    if (!s) return;
    s.classList.remove('active', 'done');
    if (i + 1 < step) s.classList.add('done');
    else if (i + 1 === step) s.classList.add('active');
  });
  [document.getElementById('stepLine1'), document.getElementById('stepLine2')].forEach((l, i) => {
    if (l) l.classList.toggle('done', i + 1 < step);
  });
}

function escapeCartHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
}

function cartTotalText(total) {
  return Number.isSafeInteger(total) ? total.toLocaleString('ru') + ' ₽' : 'Цена уточняется';
}

/* [r30] Единый контракт счётчиков: «количество изделий в корзине».
   Раньше бар показывал число позиций (Object.keys(cart).length), а бейдж
   калькулятора — сумму qty, то есть килограммы (9 против 4 на скриншоте
   владельца). Теперь одно число во всех счётчиках: штучный торт считается по
   количеству штук, весовой — как одно изделие (его qty — килограммы). */
function cartItemCount() {
  let total = 0;
  Object.keys(cart).forEach(key => {
    const entry = cart[key];
    if (!entry) return;
    const parsed = parseCartKey(key);
    let p = products.find(x => x.id === parsed.numId);
    if (p && p.hasMaxi && entry.mode === 'maxi') p = p.maxiVariant;
    if (p && p.unit !== 'кг') {
      const pieces = Math.round(entry.qty);
      total += Number.isFinite(pieces) && pieces > 0 ? pieces : 1;
    } else {
      total += 1;
    }
  });
  return total;
}
window.cartItemCount = cartItemCount;

function updateCartUI() {
  const totalItems = cartItemCount();
  document.querySelectorAll('#cartBadge, [data-cart-badge]').forEach(badge => {
    badge.textContent = totalItems;
    badge.classList.toggle('visible', totalItems > 0);
  });
  const countBadge = document.getElementById('cartCountBadge');
  if (countBadge) countBadge.textContent = totalItems;
  updateCalcCartBadge();
  const clearBtn = document.getElementById('cartClearBtn');
  if (clearBtn) clearBtn.style.display = totalItems > 0 ? 'inline-flex' : 'none';

  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  if (!body) return;

  const items = Object.entries(cart);
  if (!items.length) {
    body.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M4 7h16l-1 14H5L4 7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg></div><div style="font-size:18px;color:var(--brown);font-family:'Cormorant Garamond',serif;margin-bottom:8px">Корзина пуста</div><div class="cart-empty-message" style="font-size:14px;margin-bottom:28px">Добавьте что-нибудь вкусное!</div><a class="cart-empty-cta" href="#catalog" onclick="closeCart()" style="display:inline-flex;align-items:center;gap:8px;background:var(--gold);padding:12px 24px;border-radius:50px;text-decoration:none;font-family:'Jost',sans-serif;font-size:14px;font-weight:500;box-shadow:0 6px 20px rgba(201,147,74,0.35)">Перейти в каталог →</a></div>`;
    footer.style.display = 'none';
    return;
  }

  let total = 0;
  body.innerHTML = items.map(([cartKey, entry]) => {
    const parsed = parseCartKey(cartKey);
    let p = products.find(x => x.id === parsed.numId);
    if (!p) return '';
    if (p.hasMaxi && entry.mode === 'maxi') p = { ...p, ...p.maxiVariant };
    const qty = entry.qty;
    // [r31] Калькулятор уже включал авторский декор в «Примерную стоимость»,
    // а корзина считала только базовую цену — один и тот же торт стоил по-разному.
    const decorAdd = Number.isFinite(entry.decorAdd) ? entry.decorAdd : 0;
    const lineTotal = p.priceNum * qty + decorAdd;
    total += lineTotal;
    const isKg = p.unit === 'кг';
    const qtyLabel = isKg ? `${qty} кг` : `${qty} шт.`;
    const lineTotalFmt = lineTotal.toLocaleString('ru') + ' ₽';
    const minQty = isKg ? (p.minKg || 1) : (p.minQty || 1);
    const atMin = qty <= minQty;
    const maxQty = cartQuantityMax(p);
    const atMax = qty >= maxQty;
    const limitText = 'Максимум: ' + maxQty + (isKg ? ' кг' : ' шт.');
    const limitHint = atMax ? '<div class="cart-qty-limit" role="status">' + limitText + '</div>' : '';
    const dessertType = entry.dessertType || 'base';
    const isBase = dessertType !== 'author';
    const keyAttr = escapeCartHtml(cartKey);
    const keyArg = escapeCartHtml(JSON.stringify(cartKey));

    const dessertToggle = `<div style="margin-top:8px;"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;"><span style="font-size:11px;color:var(--cart-muted);letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;">Тип:</span><button type="button" onclick="setCartItemDessertType(${keyArg},'base')" style="font-size:12px;font-family:'Jost',sans-serif;padding:3px 10px;border-radius:20px;border:1px solid ${isBase ? 'var(--gold)' : 'var(--cream-dark)'};background:${isBase ? 'var(--gold)' : 'transparent'};color:${isBase ? 'var(--cart-cta-ink)' : 'var(--cart-muted)'};cursor:pointer;transition:all .2s;">Базовый</button><button type="button" onclick="setCartItemDessertType(${keyArg},'author')" style="font-size:12px;font-family:'Jost',sans-serif;padding:3px 10px;border-radius:20px;border:1px solid ${!isBase ? 'var(--gold)' : 'var(--cream-dark)'};background:${!isBase ? 'var(--gold)' : 'transparent'};color:${!isBase ? 'var(--cart-cta-ink)' : 'var(--cart-muted)'};cursor:pointer;transition:all .2s;">Авторский</button></div>${(() => {
      const fills = getFillsForProduct(p);
      if (!fills.length) return '';
      const currentFill = entry.fill || parsed.fill || '';
      const opts = fills.map(f => `<option value="${f}" ${currentFill === f ? 'selected' : ''}>${f}</option>`).join('');
      return `<label style="display:flex;align-items:center;gap:6px;margin-top:6px;min-width:0;"><span style="font-size:11px;color:var(--cart-muted);letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;">Начинка:</span><select onchange="setCartItemFill(${keyArg}, this.value, this)" style="font-size:12px;font-family:'Jost',sans-serif;padding:3px 8px;border-radius:12px;border:1px solid var(--cream-dark);background:transparent;color:var(--text);cursor:pointer;flex:1;max-width:180px;"><option value="">— уточнить —</option>${opts}</select></label>`;
    })()}</div>`;

    return `<div class="cart-item" data-cart-id="${keyAttr}"><div class="cart-item-info"><h4>${p.name}</h4><div class="item-price">${p.price}</div>${p.min && !entry.fill ? `<div class="item-min">${p.min}</div>` : ''}${entry.decor ? `<div class="item-min" style="opacity:0.7">🎨 ${escapeCartHtml(entry.decor)}${decorAdd > 0 ? ` · +${decorAdd.toLocaleString('ru')} ₽` : ''}</div>` : ''}${entry.biscuit ? `<div class="item-min" style="opacity:0.7">🧁 бисквит: ${entry.biscuit === 'choco' ? 'шоколадный' : 'ванильный'}</div>` : ''}${dessertToggle}${limitHint}</div><div class="qty-ctrl"><button type="button" class="qty-btn" onclick="changeQty(${keyArg}, -1)" ${atMin ? 'title="Минимальный заказ"' : ''}>−</button><span class="qty-val">${qtyLabel}</span><button type="button" class="qty-btn" onclick="changeQty(${keyArg}, 1)" aria-disabled="${atMax ? "true" : "false"}" aria-label="${atMax ? limitText : "Увеличить количество"}" title="${atMax ? limitText : "Увеличить количество"}">+</button></div><div class="cart-item-right"><div class="cart-line-total">${lineTotalFmt}</div><button type="button" class="del-btn" onclick="removeFromCart(${keyArg})" aria-label="Удалить"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button></div></div>`;
  }).join('');

  const totalFmt = cartTotalText(total);
  const cartTotalEl = document.getElementById('cartTotal');
  if (cartTotalEl) cartTotalEl.textContent = totalFmt;

  body.innerHTML += `<div id="cartStep1Footer" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--cream-dark);"><div class="cart-total-row"><span class="cart-total-label">Итого<span class="cart-total-note"> (предварительно)</span>:</span><span class="cart-inline-total">${totalFmt}</span></div><p style="font-size:11px;color:var(--cart-muted);margin-bottom:14px;line-height:1.5;">Окончательная цена согласовывается после обсуждения декора — каждый торт индивидуален.</p><button type="button" onclick="goToFormStep()" style="width:100%;background:var(--gold);color:var(--cart-cta-ink);border:none;border-radius:50px;padding:14px 24px;font-size:15px;font-family:'Jost',sans-serif;font-weight:500;cursor:pointer;box-shadow:0 6px 20px rgba(201,147,74,0.35);">Далее →</button></div>`;
  footer.style.display = 'none';
}

function goToFormStep() {
  const cartFooter = document.getElementById('cartFooter');
  const cartBody = document.getElementById('cartBody');
  if (!cartFooter || !cartBody) return;
  resetCartHandoffRecovery();
  setCartStep(2);
  cartBody.style.display = 'none';
  cartFooter.style.display = 'block';
  cartFooter.classList.remove('step-enter');
  void cartFooter.offsetWidth;
  cartFooter.classList.add('step-enter');
}

function buildMessage(compact) {
  const cnameEl    = document.getElementById('cname');
  const cphoneEl   = document.getElementById('cphone');
  const cdateEl    = document.getElementById('cdate');
  const ccommentEl = document.getElementById('ccomment');
  const name    = cnameEl?.value.trim()    || '—';
  const phone   = cphoneEl?.value.trim()   || '—';
  const date    = cdateEl?.value.trim()    || '—';
  const comment = ccommentEl?.value.trim() || '—';
  if (!Object.keys(cart).length) { showToast('Корзина пуста — добавьте товар'); return null; }
  if (!phone || phone === '—') { showToast('Пожалуйста, укажите телефон'); return null; }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 11) { showToast('Введите корректный номер телефона'); if (cphoneEl) cphoneEl.focus(); return null; }
  // [r34] Дата, выбранная до полуночи, к моменту отправки может быть уже прошедшей.
  const _minDate = refreshCartDateMin();
  if (date && date !== '—' && _minDate && date < _minDate) {
    showToast('Дата доставки уже недоступна — выберите не раньше ' + formatSpbDate(_minDate));
    if (cdateEl) cdateEl.focus();
    return null;
  }

  const lineOf = ([cartKey, entry]) => {
    const parsed = parseCartKey(cartKey);
    let p = products.find(x => x.id === parsed.numId);
    if (!p) return null;
    if (p.hasMaxi && entry.mode === 'maxi') p = { ...p, ...p.maxiVariant };
    const qty = entry.qty;
    const label = p.unit === 'кг' ? `${qty} кг` : `${qty} шт.`;
    const dessertLabel = entry.dessertType === 'author' ? 'авторский' : 'базовый';
    const decorAdd = Number.isFinite(entry.decorAdd) ? entry.decorAdd : 0;
    // [r31] Бисквит принадлежит бенто (там и находится переключатель), а не
    // бисквитному торту: раньше строке id 1 подставлялось глобальное значение,
    // которого покупатель для этого торта не выбирал.
    // [r35] Только достоверный выбор строки или ключа: подставлять текущий
    // выбор калькулятора нельзя — в старой корзине его могло не быть.
    const biscuit = (parsed.numId === 2) ? (entry.biscuit || parsed.biscuit || '') : '';
    const details = [`десерт: ${dessertLabel}`];
    if (entry.fill)  details.push(`начинка: ${entry.fill}`);
    if (biscuit) details.push(`бисквит: ${biscuit === 'choco' ? 'шоколадный' : 'ванильный'}`);
    if (entry.decor) details.push(`декор: ${entry.decor}${decorAdd > 0 ? ` (+${decorAdd.toLocaleString('ru')} ₽)` : ''}`);
    const head = `• ${p.name} — ${label} (${p.price})`;
    return compact ? head : `${head}\n  ${details.join(' · ')}`;
  };
  const items = Object.entries(cart).map(lineOf).filter(Boolean).join('\n');

  const total = Object.entries(cart).reduce((s, [cartKey, entry]) => {
    const parsed = parseCartKey(cartKey);
    let p = products.find(x => x.id === parsed.numId);
    if (!p) return s;
    if (p.hasMaxi && entry.mode === 'maxi') p = { ...p, ...p.maxiVariant };
    const decorAdd = Number.isFinite(entry.decorAdd) ? entry.decorAdd : 0;
    return s + (p.priceNum || 0) * (entry.qty || 1) + decorAdd;
  }, 0);

  return `Привет! Хочу сделать заказ 🎂\n\n${items}\n\nИтого (предварительно): ${cartTotalText(total)}\n⚠️ Цена предварительная — окончательная стоимость согласовывается после обсуждения декора и нюансов.\n\nИмя: ${name}\nТелефон: ${phone}\nДата: ${date}\nКомментарий: ${comment}`;
}

let cartHandoffAttempt = 0;

function resetCartHandoffRecovery() {
  cartHandoffAttempt++;
  document.getElementById('cartHandoffRecovery')?.remove();
  return cartHandoffAttempt;
}

// Keep the full order available when a browser cannot complete the handoff.
// The text exists only in the open cart; edits/back/close remove it.
function showCartHandoffRecovery(text, url, channel, notice) {
  const footer = document.getElementById('cartFooter');
  if (!footer) return;
  document.getElementById('cartHandoffRecovery')?.remove();
  const panel = document.createElement('div');
  panel.id = 'cartHandoffRecovery';
  panel.className = 'cart-form ym-hide-content';
  const status = document.createElement('p');
  status.className = 'note';
  status.setAttribute('role', 'status');
  status.textContent = notice;
  const group = document.createElement('div');
  group.className = 'form-group';
  const label = document.createElement('label');
  label.htmlFor = 'cartHandoffText';
  label.textContent = 'Полный текст заказа';
  const area = document.createElement('textarea');
  area.id = 'cartHandoffText';
  area.className = 'ym-disable-keys';
  area.rows = 5;
  area.readOnly = true;
  area.value = text;
  area.style.minHeight = '96px';
  group.append(label, area);
  const link = document.createElement('a');
  link.className = 'btn-tg ' + (channel === 'whatsapp' ? 'wa' : 'tg');
  // The actual order stays in a closure, never in the clickable DOM URL:
  // enhanced link analytics may collect href even outside our own handlers.
  const destination = new URL(url);
  const retryWithText = channel === 'whatsapp' && destination.searchParams.has('text');
  destination.search = '';
  destination.hash = '';
  link.href = destination.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Открыть ' + (channel === 'whatsapp' ? 'WhatsApp' : 'Telegram');
  if (retryWithText) {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (openCartMessenger(url, channel)) event.preventDefault();
      else status.textContent = 'Не удалось открыть заполненный заказ. Скопируйте полный текст и вставьте его в чат WhatsApp.';
      // If the scripted popup is still blocked, native navigation opens
      // the bare chat. The full readonly text remains available.
    });
  }
  panel.append(status, group, link);
  footer.insertBefore(panel, footer.querySelector('.cart-actions'));
  return status;
}

function revealCartHandoffRecovery() {
  const panel = document.getElementById('cartHandoffRecovery');
  if (panel) panel.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
}

function copyCartText(text, attempt) {
  const fallback = () => {
    if (attempt !== cartHandoffAttempt) return false;
    let area;
    const previous = document.activeElement;
    let copied = false;
    try {
      area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(area);
      area.select();
      copied = document.execCommand('copy') === true;
    } catch (err) {
      // The visible recovery field remains available for manual copying.
    } finally {
      if (area) area.remove();
      previous?.focus?.({ preventScroll: true });
    }
    return copied;
  };
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return Promise.resolve(navigator.clipboard.writeText(text)).then(() => true, fallback);
    }
  } catch (err) {}
  return Promise.resolve(fallback());
}

function openCartMessenger(url, channel) {
  let handoff = null;
  try { handoff = window.open(url, '_blank'); } catch (err) {}
  setCartStep(handoff ? 3 : 2);
  if (handoff && window.MiloviConsent) window.MiloviConsent.leadHandoff(channel, 'cart');
  return !!handoff;
}

function fitCartWhatsAppUrl(chat, full) {
  const link = text => chat + '?text=' + encodeURIComponent(text);
  const direct = link(full);
  if (direct.length <= 4096) return { url: direct, compact: false };
  const compact = buildMessage(true);
  if (!compact) return null;
  const compactUrl = link(compact);
  if (compactUrl.length <= 4096) return { url: compactUrl, compact: true };
  const lines = compact.split('\n');
  const tailStart = lines.findIndex(line => line.startsWith('Итого (предварительно)'));
  if (tailStart < 0) return null;
  const items = lines.slice(2, tailStart).filter(line => line.startsWith('•'));
  for (let count = items.length - 1; count >= 1; count--) {
    const candidate = lines.slice(0, 2).concat(items.slice(0, count),
      '  …и ещё ' + (items.length - count) + ' поз.', lines.slice(tailStart)).join('\n');
    const url = link(candidate);
    if (url.length <= 4096) return { url, compact: true };
  }
  return null;
}

function buildWA(e) {
  e.preventDefault();
  const msg = buildMessage();
  if (!msg) return;
  const attempt = resetCartHandoffRecovery();
  const chat = 'https://wa.me/79119038886';
  const fit = fitCartWhatsAppUrl(chat, msg);
  if (fit && !fit.compact) {
    if (!openCartMessenger(fit.url, 'whatsapp')) {
      const notice = 'Не удалось открыть WhatsApp. Откройте чат по ссылке ниже.';
      showCartHandoffRecovery(msg, fit.url, 'whatsapp', notice);
      revealCartHandoffRecovery();
      showToast('Не удалось открыть WhatsApp');
    }
    return;
  }
  // Keep the prior compact handoff when it fits, but never lose the original.
  // If even one line plus contact/comment exceeds the budget, do not open it.
  const reason = fit
    ? 'Заказ очень длинный — состав сокращён, контакты и итог сохранены. '
    : 'Заказ не помещается в ссылку. ';
  const status = showCartHandoffRecovery(msg, chat, 'whatsapp',
    reason + 'Полный текст доступен ниже.');
  const copying = copyCartText(msg, attempt);
  const opened = fit ? openCartMessenger(fit.url, 'whatsapp') : false;
  if (!fit) setCartStep(2);
  if (!opened) revealCartHandoffRecovery();
  copying.then(copied => {
    if (attempt !== cartHandoffAttempt) return;
    const notice = reason + (copied
      ? 'Полный текст заказа скопирован. Вставьте его в чат WhatsApp.'
      : 'Не удалось скопировать автоматически. Скопируйте полный текст вручную.')
      + (!opened ? ' Откройте WhatsApp по ссылке ниже.' : '');
    if (status) status.textContent = notice;
    if (!opened || !copied) revealCartHandoffRecovery();
    showToast(fit ? 'Состав сокращён. Полный текст заказа доступен ниже.'
      : 'Полный текст заказа доступен ниже.');
  });
}

function buildTG(e) {
  e.preventDefault();
  const msg = buildMessage();
  if (!msg) return;
  const attempt = resetCartHandoffRecovery();
  const url = 'https://t.me/milovi_cake';
  const copying = copyCartText(msg, attempt);
  const opened = openCartMessenger(url, 'telegram');
  if (!opened) showCartHandoffRecovery(msg, url, 'telegram',
    'Не удалось открыть Telegram. Откройте чат по ссылке ниже.');
  copying.then(copied => {
    if (attempt !== cartHandoffAttempt) return;
    const notice = copied
      ? 'Скопировано! Вставьте полный текст заказа в чат Telegram.'
      : 'Не удалось скопировать автоматически. Скопируйте полный текст заказа вручную.';
    const fullNotice = opened ? notice : notice + ' Откройте Telegram по ссылке ниже.';
    if (!copied || !opened) {
      showCartHandoffRecovery(msg, url, 'telegram', fullNotice);
      revealCartHandoffRecovery();
    }
    showToast(copied ? 'Скопировано! Вставьте текст заказа в Telegram.'
      : 'Не удалось скопировать. Полный текст заказа ниже.');
  });
}

document.getElementById('cartFooter')?.addEventListener('input', resetCartHandoffRecovery);

function sendFormWA() {
  const name = document.getElementById('fname').value.trim() || '—';
  const phone = document.getElementById('fphone').value.trim();
  const comment = document.getElementById('fcomment').value.trim() || '—';
  if (!phone) { showToast('Пожалуйста, укажите телефон'); document.getElementById('fphone').focus(); return; }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 11) { showToast('Введите корректный номер телефона'); document.getElementById('fphone').focus(); return; }
  const handoff = window.open(`https://wa.me/79119038886?text=${encodeURIComponent(`Привет! 👋\nИмя: ${name}\nТелефон: ${phone}\nКомментарий: ${comment}`)}`, '_blank');
  if (handoff && window.MiloviConsent) window.MiloviConsent.leadHandoff('whatsapp', 'contact_form');
}

function navigateToStep(step) {
  const hasItems = Object.keys(cart).length > 0;
  if (!hasItems) return;
  if (step === 1) goBackToCart();
  else if (step === 2) goToFormStep();
}

function goBackToCart() {
  const cartFooter = document.getElementById('cartFooter');
  const cartBody = document.getElementById('cartBody');
  if (!cartFooter || !cartBody) return;
  resetCartHandoffRecovery();
  setCartStep(1);
  cartFooter.style.display = 'none';
  cartBody.style.display = '';
  cartBody.classList.remove('step-enter');
  void cartBody.offsetWidth;
  cartBody.classList.add('step-enter');
  updateCartUI();
}

// ── iOS-safe scroll lock (r29: bug #21 — position:fixed trick for iOS Safari) ──
var _lockScrollY = 0;
function lockBody() {
  var count = parseInt(document.body.dataset.lockCount || '0');
  if (count === 0) {
    _lockScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = (-_lockScrollY) + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  document.body.dataset.lockCount = count + 1;
}
function unlockBody() {
  var count = parseInt(document.body.dataset.lockCount || '0');
  if (count <= 0) { document.body.style.position = ''; document.body.style.top = ''; document.body.style.left = ''; document.body.style.right = ''; document.body.style.overflow = ''; document.documentElement.style.overflow = ''; return; }
  var newCount = count - 1;
  document.body.dataset.lockCount = newCount;
  if (newCount === 0) {
    document.body.style.position = ''; document.body.style.top = ''; document.body.style.left = ''; document.body.style.right = '';
    document.body.style.overflow = ''; document.documentElement.style.overflow = '';
    window.scrollTo(0, _lockScrollY);
  }
}
window.lockBody = lockBody;
window.unlockBody = unlockBody;

// ═══════════════════════════════════════════════════════════════
// CART — State machine
// ═══════════════════════════════════════════════════════════════
var _cartState = 'closed';
var _cartTimer = null;
var _cartBodyLocked = false;

function _cartClearTimer() { if (_cartTimer) { clearTimeout(_cartTimer); _cartTimer = null; } }

function _cartSyncBodyLock() {
  var shouldLock = _cartState === 'open' && window.innerWidth <= 900;
  if (shouldLock === _cartBodyLocked) return;
  _cartBodyLocked = shouldLock;
  if (shouldLock) lockBody(); else unlockBody();
}

function _cartDismissConfirm() {
  document.getElementById('cartClearConfirm')?.remove();
  if (window._cartConfirmTrapRelease) {
    window._cartConfirmTrapRelease();
    window._cartConfirmTrapRelease = null;
  }
}

function _cartReturnFocus(drawer) {
  var previous = openCart._lastFocused;
  openCart._lastFocused = null;
  if (!drawer.contains(document.activeElement)) return;
  var trigger = previous && previous.isConnected && typeof previous.focus === 'function'
    ? previous : document.querySelector('#cartBtn, .cart-btn, .header-cart-btn');
  if (!trigger) {
    // A programmatic open may have no focusable trigger; never hide focused content.
    if (drawer.contains(document.activeElement)) document.activeElement.blur();
    return;
  }
  /* [r40] Бар мог быть скрыт под корзиной и в этот момент быть inert.
     Просим его пересчитать состояние синхронно (js/nav.js выставляет
     window._mcNavSync), иначе focus() по inert-кнопке молча игнорируется. */
  if (typeof window._mcNavSync === 'function') window._mcNavSync();
  trigger.focus({ preventScroll: true });
  if (drawer.contains(document.activeElement)) document.activeElement.blur();
}

function _cartForceClose() {
  _cartClearTimer();
  var drawer = document.getElementById('cartDrawer');
  var overlay = document.getElementById('cartOverlay');
  if (drawer) { drawer.classList.remove('open', 'closing'); drawer.style.cssText = ''; }
  if (overlay) { overlay.classList.remove('open'); }
  document.body.classList.remove('cart-open');
  _cartState = 'closed';
  _cartSyncBodyLock();
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.remove('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }
  if (drawer) {
    _cartReturnFocus(drawer);
    _cartDismissConfirm();
    drawer.inert = true;
    drawer.setAttribute('aria-hidden', 'true');
  }
}

// [r25] Пока дата не выбрана — подсказываем формат; после выбора убираем.
document.addEventListener('change', function (e) {
  var el = e.target;
  if (!el || el.id !== 'cdate') return;
  el.setAttribute('data-filled', el.value ? '1' : '0');
});
document.addEventListener('input', function (e) {
  var el = e.target;
  if (!el || el.id !== 'cdate') return;
  el.setAttribute('data-filled', el.value ? '1' : '0');
});

function openCart() {
  var drawer  = document.getElementById('cartDrawer');
  var overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay) return;
  closeCalcPanel();
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  if (_cartState === 'closing') _cartForceClose();
  if (_cartState === 'open' || _cartState === 'opening') return;
  openCart._lastFocused = document.activeElement;
  _cartClearTimer();
  _cartState = 'opening';
  drawer.inert = false;
  drawer.setAttribute('aria-hidden', 'false');
  drawer.style.willChange = 'transform';
  drawer.classList.remove('closing');
  drawer.style.cssText = '';
  void drawer.offsetWidth;
  drawer.classList.add('open');
  overlay.classList.add('open');
  document.body.classList.add('cart-open');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-labelledby', 'cartDrawerTitle');
  _cartState = 'open';
  _cartSyncBodyLock();
  setCartStep(1);
  updateCartUI();
  setTimeout(function() {
    if (_cartState !== 'open' || drawer.inert || drawer.contains(document.activeElement)) return;
    drawer.querySelector('.cart-close, [aria-label="Закрыть"], [onclick="closeCart()"]')?.focus({ preventScroll: true });
  }, 100);
  /* r32: bug #38 — focus trap for cart */
  if (window._trapFocus) { window._cartTrapRelease = window._trapFocus(drawer); }
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.add('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.add('mc-nav--hidden'); document.body.classList.add('mc-nav-hidden'); }
}

function closeCart() {
  var drawer  = document.getElementById('cartDrawer');
  var overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay) return;
  if (_cartState === 'closed' || _cartState === 'closing') return;
  resetCartHandoffRecovery();
  /* r32: bug #38 — release cart focus trap */
  if (window._cartTrapRelease) { window._cartTrapRelease(); window._cartTrapRelease = null; }
  if (drawer._scrollClose) { window.removeEventListener('scroll', drawer._scrollClose); drawer._scrollClose = null; }
  _cartClearTimer();
  _cartState = 'closing';
  drawer.classList.remove('open');
  drawer.classList.add('closing');
  overlay.classList.remove('open');
  document.body.classList.remove('cart-open');
  _cartSyncBodyLock();
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.remove('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }
  _cartReturnFocus(drawer);
  _cartDismissConfirm();
  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  var delay = window.innerWidth > 900 ? 220 : 350;
  _cartTimer = setTimeout(function() {
    _cartTimer = null;
    drawer.classList.remove('closing');
    drawer.style.cssText = '';
    drawer.style.willChange = 'auto';
    _cartState = 'closed';
  }, delay);
}

/* r34: bug #33 — sync cart scroll lock on resize (desktop↔mobile) */
window.addEventListener('resize', (function() {
  var timer;
  return function() {
    if (window.innerWidth > 560) closeCalcPanel();
    clearTimeout(timer);
    timer = setTimeout(_cartSyncBodyLock, 200);
  };
})());

// ── Swipe-right-to-close for cart ──
(function() {
  var _swipeSX = 0, _swipeSY = 0, _swipeDragging = false, _swipeLocked = false;
  var _swipeThreshold = 80;
  var _drawer = document.getElementById('cartDrawer');
  if (!_drawer) return;
  _drawer.addEventListener('touchstart', function(e) {
    if (window.innerWidth > 900) return;
    if (_cartState !== 'open') return;
    _swipeSX = e.touches[0].clientX; _swipeSY = e.touches[0].clientY; _swipeDragging = true; _swipeLocked = false;
  }, { passive: true });
  _drawer.addEventListener('touchmove', function(e) {
    if (!_swipeDragging) return;
    var dx = e.touches[0].clientX - _swipeSX;
    var dy = e.touches[0].clientY - _swipeSY;
    if (!_swipeLocked) {
      if (Math.abs(dy) > Math.abs(dx)) { _swipeDragging = false; return; }
      if (Math.abs(dx) < 8) return;
      _swipeLocked = true; _drawer.style.transition = 'none';
    }
    if (dx <= 0) return;
    _drawer.style.transform = 'translateX(' + dx + 'px)';
    var overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.style.opacity = Math.max(0, 1 - dx / (_swipeThreshold * 2));
  }, { passive: true });
  _drawer.addEventListener('touchend', function(e) {
    if (!_swipeDragging) return;
    _swipeDragging = false;
    var dx = e.changedTouches[0].clientX - _swipeSX;
    var willClose = _swipeLocked && dx >= _swipeThreshold;
    _drawer.style.transition = ''; _drawer.style.transform = '';
    var overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.style.opacity = '';
    if (willClose) requestAnimationFrame(function() { closeCart(); });
  }, { passive: true });
})();

// ── Orientation change ──
window.addEventListener('orientationchange', function() {
  var heroEl = document.querySelector('.hero');
  if (heroEl) { heroEl.classList.add('hero--orient-change'); setTimeout(function() { heroEl.classList.remove('hero--orient-change'); }, 350); }
  setTimeout(_cartSyncBodyLock, 300);
});

window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    closeCalcPanel();
    _cartForceClose();
    document.body.dataset.lockCount = '0';
    document.body.style.overflow = ''; document.documentElement.style.overflow = '';
    if (document.body.classList.contains('fill-open-ios')) { document.body.classList.remove('fill-open-ios'); document.body.style.top = ''; document.body.style.position = ''; }
    document.body.classList.remove('fill-open');
    var fillPopup = document.getElementById('fillPopup'), fillOverlay = document.getElementById('fillOverlay');
    if (fillPopup) fillPopup.classList.remove('open');
    if (fillOverlay) fillOverlay.classList.remove('open');
  }
});

// ── Hero visibility + Parallax orbs ──
(function() {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  window._heroVisible = false;
  var obs = new IntersectionObserver(function(entries) { var vis = entries[0].isIntersecting; hero.classList.toggle('hero--visible', vis); window._heroVisible = vis; }, { threshold: 0.05 });
  obs.observe(hero);
  if (window.innerWidth < 769) return;
  var orbs = document.querySelectorAll('.hero-orb-1, .hero-orb-2, .hero-orb-3');
  if (!orbs.length) return;
  var baseY = [0, 0, 0], ticking = false;
  (function applyInitialOrbs() {
    var y = window.scrollY;
    if (orbs[0]) orbs[0].style.transform = 'translateY(' + (baseY[0] + y * 0.15) + 'px)';
    if (orbs[1]) orbs[1].style.transform = 'translateY(' + (baseY[1] + y * -0.10) + 'px)';
    if (orbs[2]) orbs[2].style.transform = 'translateY(' + (baseY[2] + y * 0.08) + 'px)';
  })();
  window.addEventListener('scroll', function() {
    if (ticking || !window._heroVisible) return; ticking = true;
    requestAnimationFrame(function() {
      var y = window.scrollY;
      if (orbs[0]) orbs[0].style.transform = 'translateY(' + (baseY[0] + y * 0.15) + 'px)';
      if (orbs[1]) orbs[1].style.transform = 'translateY(' + (baseY[1] + y * -0.10) + 'px)';
      if (orbs[2]) orbs[2].style.transform = 'translateY(' + (baseY[2] + y * 0.08) + 'px)';
      ticking = false;
    });
  }, { passive: true });
})();

// ── DEFER DECORATIVE HOMEPAGE HERO MOTION OUT OF INITIAL LCP WINDOW ──
(function initDeferredHeroMotion() {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var path = window.location.pathname.replace(/\/+$/, '') || '/';
  var isHomepage = path === '/' || path === '/index.html';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;
  if (!isHomepage) { hero.classList.add('hero--motion-ready'); return; }

  var enabled = false;
  var fallbackTimer = null;
  function enableHeroMotion() {
    if (enabled) return;
    enabled = true;
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    hero.classList.add('hero--motion-ready');
  }
  function enableAfterIntent() { setTimeout(enableHeroMotion, 0); }
  function armFallback() {
    if (enabled || fallbackTimer) return;
    fallbackTimer = setTimeout(enableHeroMotion, 8000);
  }

  document.addEventListener('pointerdown', enableAfterIntent, { once: true, passive: true });
  document.addEventListener('keydown', enableAfterIntent, { once: true });
  if (document.readyState === 'complete') armFallback();
  else window.addEventListener('load', armFallback, { once: true });
})();

// ── SMOOTH IMAGE FADE ──
document.querySelectorAll('img:not(.hero-img):not([class*="head"])').forEach(function(img) {
  if (img.complete || img.naturalWidth > 0) return;
  img.style.opacity = '0'; img.style.transition = 'opacity 0.5s ease';
  img.addEventListener('load', function() { img.style.opacity = '1'; });
  img.addEventListener('error', function() { img.style.opacity = '1'; });
  setTimeout(function() { if (img.style.opacity === '0') img.style.opacity = '1'; }, 2000 /* r29: bug #14 — reduced from 5s */);
});

// ── CART OVERLAY CLICK-OUTSIDE ──
(function() {
  const overlay = document.getElementById('cartOverlay');
  if (!overlay) return;
  overlay.addEventListener('click', function(e) {
    const drawer = document.getElementById('cartDrawer');
    if (!drawer || drawer.contains(e.target)) return;
    if (drawer.classList.contains('open')) closeCart();
  });
})();

// ── observeReveal ──
const _revealObserved = new WeakSet();
function observeReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible), .reveal-photo:not(.visible)');
  const threshold = window.innerWidth <= 768 ? 0.02 : 0.05;
  const io = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } }); }, { threshold, rootMargin: '0px 0px 60px 0px' });
  els.forEach(el => { if (!_revealObserved.has(el)) { _revealObserved.add(el); io.observe(el); } });
  setTimeout(function() { document.querySelectorAll('.reveal:not(.visible), .reveal-photo:not(.visible)').forEach(function(el) { el.classList.add('visible'); }); }, 2500);
}

let _priceGlowIO = null;
function initPriceGlowObserver() {
  const cards = document.querySelectorAll('.product-card');
  if (!cards.length) return;
  if (_priceGlowIO) { _priceGlowIO.disconnect(); _priceGlowIO = null; }
  _priceGlowIO = new IntersectionObserver(entries => { entries.forEach(e => { e.target.classList.toggle('in-view', e.isIntersecting); }); }, { threshold: 0.1 });
  cards.forEach(c => _priceGlowIO.observe(c));
}

(function initSeparatorObserver() {
  const seps = document.querySelectorAll('.section-separator');
  if (!seps.length || typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver(entries => { entries.forEach(e => e.target.classList.toggle('in-view', e.isIntersecting)); }, { threshold: 0 });
  seps.forEach(s => io.observe(s));
})();

// ── CATALOG NAV ──
function renderCatalogNav() {
  const nav = document.getElementById('catalogNav');
  if (!nav) return;
  const shortNames = {
    'Бисквитный торт': 'Бисквит', 'Бенто торт': 'Бенто', '3D Торт': '3D Торт',
    'Меренговый рулет': 'Рулет', 'Пирожное "Павлова"': 'Павлова', 'Пирожное «Павлова»': 'Павлова', 'Капкейки': 'Капкейки',
  };
  nav.innerHTML = products.map(p => {
    // [UI-2026-11-16] Owner: no thumbnail tiles — slim text pills only.
    const shortName = shortNames[p.name] || p.name;
    const shortPrice = p.price.replace('от ', '').replace(' ₽/шт', ' ₽').replace(/\s+/g, ' ').replace(' /', ' ');
    return `<button class="catalog-nav-item" data-target="card-${p.id}" onclick="scrollToProduct(${p.id})" type="button"><span class="catalog-nav-label">${shortName}</span><span class="catalog-nav-price">${shortPrice}</span></button>`;
  }).join('');
}

function scrollToProduct(id) {
  const card = document.getElementById('card-' + id);
  if (!card) return;
  const grid = document.getElementById('catalogGrid');
  // [2026-11-16r16] Владелец: на телефоне панель товаров листается на месте —
  // чип ведёт карусель, а не прокручивает страницу вниз.
  if (grid && window.innerWidth <= 768) {
    const gridBox = grid.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const padLeft = parseFloat(getComputedStyle(grid).paddingLeft) || 0;
    const target = grid.scrollLeft + (cardBox.left - gridBox.left) - padLeft;
    grid.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    document.querySelectorAll('.catalog-nav-item').forEach(el => { el.classList.toggle('active', el.dataset.target === 'card-' + id); });
    return;
  }
  const hdr = document.getElementById('siteHeader');
  const headerHeight = hdr ? hdr.offsetHeight : 72;
  const nav = document.getElementById('catalogNav');
  const navHeight = (nav && window.innerWidth <= 768) ? nav.offsetHeight + 16 : 0;
  const breadcrumb = document.querySelector('.breadcrumb-nav');
  const breadcrumbHeight = (breadcrumb && window.innerWidth <= 768) ? breadcrumb.offsetHeight : 0;
  const offset = headerHeight + navHeight + breadcrumbHeight + 16;
  const top = card.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
  document.querySelectorAll('.catalog-nav-item').forEach(el => { el.classList.toggle('active', el.dataset.target === 'card-' + id); });
  // Active state is observer-owned.
}

// [2026-11-16r16] Свайп панели синхронизирует активный чип сверху.
function initCatalogSwipeSync() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  let raf = null;
  const sync = () => {
    if (window.innerWidth > 768) return;
    const left = grid.scrollLeft;
    const center = left + grid.clientWidth / 2;
    let best = null;
    let bestDist = Infinity;
    Array.prototype.forEach.call(grid.children, card => {
      if (!card.id) return;
      const box = card.getBoundingClientRect();
      const gridBox = grid.getBoundingClientRect();
      const cardCenter = left + (box.left - gridBox.left) + box.width / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < bestDist) { bestDist = dist; best = card; }
    });
    if (!best) return;
    document.querySelectorAll('.catalog-nav-item').forEach(el => { el.classList.toggle('active', el.dataset.target === best.id); });
  };
  grid.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; sync(); });
  }, { passive: true });
  window.addEventListener('resize', sync);
  sync();
}

function initCatalogNavScroll() {
  if (window.innerWidth > 768) return;
  const nav = document.getElementById('catalogNav');
  if (!nav) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { const id = entry.target.id; document.querySelectorAll('.catalog-nav-item').forEach(el => { el.classList.toggle('active', el.dataset.target === id); }); }
    });
  }, { threshold: 0.5, rootMargin: '-30% 0px -30% 0px' });
  products.forEach(p => { const card = document.getElementById('card-' + p.id); if (card) observer.observe(card); });
}

// ── Wave text ──
function initWaveText() {
  document.querySelectorAll('.wave-text').forEach(function(el) {
    if (el.querySelector('.w')) return;
    const frag = document.createDocumentFragment();
    Array.from(el.childNodes).forEach(function(node) {
      if (node.nodeType !== Node.TEXT_NODE) { frag.appendChild(node.cloneNode(true)); return; }
      const parts = (node.textContent || '').split(/(\s+)/);
      parts.forEach(function(part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); }
        else { const span = document.createElement('span'); span.className = 'w'; span.textContent = part; frag.appendChild(span); }
      });
    });
    el.innerHTML = '';
    el.appendChild(frag);
    const words = el.querySelectorAll('.w');
    // v20: hero-title-seo hover handled by CSS only (no 'near' class to avoid jump)
    if (!el.classList.contains('hero-title-seo')) {
      words.forEach(function(word, i) {
        word.addEventListener('mouseenter', function() { if (words[i - 1]) words[i - 1].classList.add('near'); if (words[i + 1]) words[i + 1].classList.add('near'); });
        word.addEventListener('mouseleave', function() { if (words[i - 1]) words[i - 1].classList.remove('near'); if (words[i + 1]) words[i + 1].classList.remove('near'); });
      });
    }
  });
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) return;
  document.querySelectorAll('.wave-text').forEach(function(el) {
    if (el._autoWaveBound) return;
    el._autoWaveBound = true;
    if (el.classList.contains('hero-title-seo')) return;
    var spans = el.querySelectorAll('.w');
    if (spans.length < 2) return;
    function runAutoWave() { var i = 0, total = spans.length; function step() { spans.forEach(function(s) { s.classList.remove('w-auto', 'w-auto-near'); }); if (i >= total) return; spans[i].classList.add('w-auto'); if (i > 0) spans[i - 1].classList.add('w-auto-near'); if (i < total - 1) spans[i + 1].classList.add('w-auto-near'); i++; setTimeout(step, 480); } step(); }
    setTimeout(function loop() { if (!document.hidden) runAutoWave(); setTimeout(loop, 12000); }, 4000 + Math.random() * 3000);
  });
}

function initSectionTitleWords() {
  document.querySelectorAll('.section-title .ht-word, .section-title .ht-em').forEach(function(el) {
    if (el.dataset.splitInit === '1') return;
    const txt = (el.textContent || '').trim();
    if (!txt) return;
    const inheritStyle = el.getAttribute('style') || '';
    el.innerHTML = txt.split(/(\s+)/).map(function(p) { if (/^\s+$/.test(p)) return p; return '<span class="ht-w"' + (inheritStyle ? ' style="' + inheritStyle + '"' : '') + '>' + p + '</span>'; }).join('');
    el.dataset.splitInit = '1';
  });
}

/* MILOVI CAKE | desktop hero messenger motion, r25 candidate.
 * Home desktop only. Mobile UI and suburban pages remain untouched.
 * One timeline per icon: interruptible, focus-aware, BFCache-idempotent.
 */
(() => {
  'use strict';
  window.__mcHeroMotionEnabled=true;
  const media = matchMedia('(min-width:769px) and (hover:hover) and (pointer:fine)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const NS='http://www.w3.org/2000/svg';
  const XT='http://www.w3.org/1999/xlink';
  const items=[['wa','WhatsApp'],['tg','Telegram'],['max','MAX']];
  const config={enter:370,leave:560,particles:10};
  let installed=false;
  const active=new Map();
  const svgEl=(tag, attrs={})=>{
    const e=document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));
    return e;
  };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // One easing curve: no compounded ease that finishes movement before text appears.
  const easeFlow=t=>t*t*(3-2*t);
  const lerp=(a,b,t)=>a+(b-a)*t;
  const round=v=>Number(v.toFixed(3));
  function partsIn(b){
    return b.querySelectorAll('.mc-hover-grain');
  }
  function clean(b) {
    partsIn(b).forEach(p=>{try{p.getAnimations().forEach(a=>a.cancel())}catch(_e){} p.remove()});
  }
  function spray(state) {
    if(reduced.matches || !state.flat || !state.link.isConnected) return;
    const link=state.link, label=state.flat;
    const br=link.getBoundingClientRect(), tr=label.getBoundingClientRect();
    if(!tr.width || !tr.height) return;
    clean(link);
    for(let i=0;i<config.particles;i++){
      const el=document.createElement('i');
      el.className='mc-hover-grain';
      el.setAttribute('aria-hidden','true');
      // Start at distinct points on the actual label, not at fixed CSS offsets.
      const u=(i+.35+(i%3)*.09)/config.particles;
      const left=tr.left-br.left+tr.width*u;
      const top=tr.top-br.top+tr.height*(.30+(i%4)*.13);
      const size=.8+(i%4)*.25;
      el.style.left=round(left)+'px';
      el.style.top=round(top)+'px';
      el.style.width=size+'px'; el.style.height=size+'px';
      link.appendChild(el);
      const side=((i*17)%19)-9, fall=10+((i*13)%15);
      const duration=280+(i%4)*22;
      const anim=el.animate([
        {opacity:.42,transform:'translate3d(0,0,0) scale(.65)',filter:'blur(0px)'},
        {opacity:.37,transform:'translate3d('+round(side*.42)+'px,'+round(fall*.48)+'px,0) scale(.85)',offset:.47},
        {opacity:0,transform:'translate3d('+side+'px,'+fall+'px,0) scale(.17)',filter:'blur(.9px)'}
      ],{delay:20+(i%4)*12,duration,easing:'cubic-bezier(.19,.47,.3,1)',fill:'forwards'});
      anim.onfinish=()=>el.remove();
      anim.oncancel=()=>el.remove();
    }
  }
  function draw(s) {
    const ring=s.ring,flat=s.flat;
    const p=clamp(s.value,0,1);
    // Keep attr values compatible with protected SVG contract tests.
    const ringOpacity=lerp(.52,.045,p);
    const flatOpacity=clamp((p-.04)/.86,0,1);
    const y=lerp(8,-1.1,p);
    const ringLift=lerp(0,-2.4,p);
    const fontSize=lerp(6.5,10.4,p);
    ring.setAttribute('opacity',round(ringOpacity));
    ring.setAttribute('transform','translate(0,'+round(ringLift)+')');
    ring.style.setProperty('opacity',String(round(ringOpacity)),'important');
    ring.style.setProperty('transform','translate(0,'+round(ringLift)+'px)','important');
    flat.setAttribute('y',round(y));
    flat.setAttribute('opacity',round(flatOpacity));
    flat.setAttribute('font-size',round(fontSize));
    flat.style.setProperty('opacity',String(round(flatOpacity)),'important');
    flat.style.setProperty('font-size',round(fontSize)+'px','important');
    flat.style.setProperty('transform','none','important');
    s.link.style.setProperty('--mc-hover-progress',String(round(p)));
  }
  function seek(s,target) {
    target=target?1:0;
    if(s.raf) {cancelAnimationFrame(s.raf);s.raf=0;}
    if(target===1) {s.leaving=false;s.sprayed=false;clean(s.link);}
    const from=s.value;
    if(Math.abs(from-target)<.001) {s.value=target;draw(s);return;}
    if(reduced.matches) {s.value=target;draw(s);return;}
    const duration=(target?config.enter:config.leave)*Math.max(.4,Math.abs(from-target));
    const start=performance.now();
    const easing=easeFlow;
    function step(now){
      const t=clamp((now-start)/duration,0,1);
      s.value=lerp(from,target,easing(t));
      draw(s);
      // Release a few grains from the LIVE text bounds during descent.
      if(!target && s.leaving && !s.sprayed && s.value<=.65 && from>.55) {
        s.sprayed=true;
        spray(s);
      }
      if(t<1){s.raf=requestAnimationFrame(step)}
      else{s.raf=0;s.value=target;draw(s)}
    }
    s.raf=requestAnimationFrame(step);
  }
  function destroy() {
    for(const state of active.values()){
      if(state.raf) cancelAnimationFrame(state.raf);
      state.events.abort();
      clean(state.link);
      state.ring.remove();
      state.flat.remove();
      state.defs.remove();
      const glyph=state.link.querySelector('.mc-brand-glyph');
      if(glyph && glyph.firstElementChild) glyph.replaceWith(glyph.firstElementChild);
      state.link.removeAttribute('data-mc-motion-init');
      state.link.removeAttribute('data-mc-arc-center-delta');
      state.link.style.removeProperty('--mc-hover-progress');
       for(const [prop,[value,priority]] of state.baseStyles){
         if(value)state.link.style.setProperty(prop,value,priority);
         else state.link.style.removeProperty(prop);
       }
       const group=state.link.closest('.messenger-group--ring');
       if(group && group.dataset.mcDesktopGapSaved){
         if(group.dataset.mcPriorGap)group.style.setProperty('gap',group.dataset.mcPriorGap,group.dataset.mcPriorGapPriority||'');
         else group.style.removeProperty('gap');
         delete group.dataset.mcDesktopGapSaved;
         delete group.dataset.mcPriorGap;
         delete group.dataset.mcPriorGapPriority;
       }
    }
    active.clear();
    installed=false;
  }
  function init() {
    if(!media.matches || installed || !document.body.classList.contains('mc-home')) return;
    installed=true;
    for(const [key,label] of items){
      const link=document.querySelector('.hero .btn-hero-'+key+'.btn-hero-ring');
      const svg=link?.querySelector('svg');
      if(!svg || link.dataset.mcMotionInit==='1') continue;
      const originalMark=[...svg.children].find(e=>['g','path'].includes(e.tagName.toLowerCase()));
      if(!originalMark)continue;
      link.dataset.mcMotionInit='1';
       const baseStyles=new Map();
       // Inline priority defeats the historic protected circular CSS only on desktop.
       // It is restored exactly when leaving the desktop breakpoint.
       for(const prop of ['background','border','box-shadow','border-radius','transform']){
         baseStyles.set(prop,[link.style.getPropertyValue(prop),link.style.getPropertyPriority(prop)]);
       }
       for(const prop of ['background','border','box-shadow','border-radius','transform']){
         link.style.setProperty(prop,({
           background:'transparent', border:'0', 'box-shadow':'none',
           'border-radius':'0',transform:'none'
         })[prop],'important');
       }
       const group=link.closest('.messenger-group--ring');
       if(group && !group.dataset.mcDesktopGapSaved){
         group.dataset.mcDesktopGapSaved='1';
         group.dataset.mcPriorGap=group.style.getPropertyValue('gap');
         group.dataset.mcPriorGapPriority=group.style.getPropertyPriority('gap');
         group.style.setProperty('gap','18px','important');
       }
      const glyph=svgEl('g',{class:'mc-brand-glyph mc-brand-glyph--'+key});
      originalMark.before(glyph);glyph.appendChild(originalMark);
      const id='mc-ring-path-'+key;
      const defs=svgEl('defs');
      // Non-rendered path: there is no visible circular frame.
      defs.appendChild(svgEl('path',{id,d:'M7,24 a17,17 0 1,1 0,0.01'}));
      svg.insertBefore(defs,svg.firstChild);
      const ring=svgEl('text',{class:'hero-ring-text','font-family':'Jost,sans-serif',fill:'currentColor'});
      const path=svgEl('textPath',{href:'#'+id,startOffset:'25%','text-anchor':'middle','letter-spacing':'1.65'});
      path.setAttributeNS(XT,'href','#'+id);
      path.textContent=label;ring.appendChild(path);
      const flat=svgEl('text',{class:'hero-flat-text',
        'font-family':'Jost,sans-serif',fill:'currentColor','text-anchor':'middle',x:'24',
        y:'8','font-size':'6.5','font-weight':'500','letter-spacing':'.34'});
      flat.textContent=label;
      svg.append(ring,flat);
      // Protected CSS has its own opacity transitions: those lagged JS positioning.
      // Only the new home-page text layers opt out; suburbs keep their legacy CSS.
      for(const textLayer of [ring,flat]) textLayer.style.setProperty('transition','none','important');
      // A stable tiny SVG glow avoids an abrupt filter repaint at 68% progress.
      flat.style.setProperty('filter','drop-shadow(0 0 .6px currentColor)','important');
      const state={link,ring,flat,defs,baseStyles,events:new AbortController(),raf:0,value:0,pointer:false,focus:false,leaving:false,sprayed:false};
      active.set(key,state);
      draw(state);
      function update(){seek(state,state.pointer||state.focus)}
      link.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;state.pointer=true;update()},{passive:true,signal:state.events.signal});
      link.addEventListener('pointerleave',e=>{
        if(e.pointerType==='touch')return;
        state.pointer=false;
        state.leaving=!state.focus && state.value>.55;
        state.sprayed=false;
        update();
      },{passive:true,signal:state.events.signal});
      link.addEventListener('focusin',()=>{state.focus=true;update()},{signal:state.events.signal});
      link.addEventListener('focusout',()=>{state.focus=false;update()},{signal:state.events.signal});
      link.addEventListener('pointercancel',()=>{state.pointer=false;update()},{signal:state.events.signal});
      link.addEventListener('blur',()=>{if(!state.pointer){state.focus=false;update()}},{signal:state.events.signal});
      reduced.addEventListener('change',()=>{if(reduced.matches){clean(link);seek(state,state.pointer||state.focus)}},{signal:state.events.signal});
    }
    // Font loading can change textPath metrics; defer measurements until ready.
    document.fonts.ready.then(()=>{
      for(const [key] of items){
        const link=document.querySelector('.hero .btn-hero-'+key+'.btn-hero-ring');
        if(!link?.dataset.mcMotionInit) continue;
        const arc=link?.querySelector('.hero-ring-text');
        const glyph=link?.querySelector('.mc-brand-glyph');
        if(!arc || !glyph)continue;
        const a=arc.getBoundingClientRect(),g=glyph.getBoundingClientRect();
        const offset=(a.left+a.width/2)-(g.left+g.width/2);
        link.dataset.mcArcCenterDelta=offset.toFixed(3);
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  media.addEventListener('change',()=>{if(media.matches)init();else destroy()});
  addEventListener('pageshow',e=>{if(e.persisted){if(media.matches)init();else destroy()}});
})();

// [r18] Messenger ring-to-flat animation — единый для всех страниц
(function() {
  var items = [
    { btnClass: 'btn-hero-wa',  ringId: 'ring-text-wa',  flatId: 'flat-text-wa'  },
    { btnClass: 'btn-hero-tg',  ringId: 'ring-text-tg',  flatId: 'flat-text-tg'  },
    { btnClass: 'btn-hero-max', ringId: 'ring-text-max', flatId: 'flat-text-max' }
  ];

  function easeOut(t)   { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

  function runAnim(state, toHover, dur) {
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
    var from = { ringOp: state.ringOp, ringY: state.ringY, flatOp: state.flatOp, flatY: state.flatY, flatSize: state.flatSize, flatGlow: state.flatGlow };
    var to = toHover ? { ringOp: 0, ringY: -12, flatOp: 1, flatY: -13, flatSize: 12, flatGlow: 0.55 } : { ringOp: 1, ringY: 0, flatOp: 0, flatY: 8, flatSize: 6.5, flatGlow: 0 };
    var startTs = null;
    function step(ts) {
      if (!startTs) startTs = ts;
      var p = Math.min((ts - startTs) / dur, 1);
      var e = toHover ? easeOut(p) : easeInOut(p);
      state.ringOp = from.ringOp + (to.ringOp - from.ringOp) * e;
      state.ringY = from.ringY + (to.ringY - from.ringY) * e;
      state.flatOp = from.flatOp + (to.flatOp - from.flatOp) * e;
      state.flatY = from.flatY + (to.flatY - from.flatY) * e;
      state.flatSize = from.flatSize + (to.flatSize - from.flatSize) * e;
      state.flatGlow = from.flatGlow + (to.flatGlow - from.flatGlow) * e;
      state.ringEl.setAttribute('opacity', state.ringOp);
      state.ringEl.setAttribute('transform', 'translate(0,' + state.ringY + ')');
      state.flatEl.setAttribute('opacity', state.flatOp);
      state.flatEl.setAttribute('y', state.flatY);
      state.flatEl.setAttribute('font-size', state.flatSize);
      var glow = state.flatGlow * 4;
      state.flatEl.setAttribute('filter', glow > 0.3 ? 'drop-shadow(0 0 ' + glow.toFixed(1) + 'px currentColor)' : '');
      if (p < 1) { state.raf = requestAnimationFrame(step); }
      else { Object.assign(state, to); state.raf = null; }
    }
    state.raf = requestAnimationFrame(step);
  }

  function initMessengerRings() {
    if (window.__mcHeroMotionEnabled && document.body.classList.contains('mc-home')) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    items.forEach(function(item) {
      var btn = document.querySelector('.' + item.btnClass);
      if (!btn) return;
      var ringEl = btn.querySelector('.hero-ring-text, [id^="ring-text-"]') || document.getElementById(item.ringId);
      var flatEl = btn.querySelector('.hero-flat-text, [id^="flat-text-"]') || document.getElementById(item.flatId);
      if (!ringEl || !flatEl) return;
      var state = { ringEl, flatEl, ringOp: 0.5, ringY: 0, flatOp: 0, flatY: 8, flatSize: 6.5, flatGlow: 0, raf: null };
      ringEl.setAttribute('opacity', 0.5); ringEl.setAttribute('transform', 'translate(0,0)');
      flatEl.setAttribute('opacity', 0); flatEl.setAttribute('y', 8); flatEl.setAttribute('font-size', 6.5);
      btn.addEventListener('mouseenter', function() { runAnim(state, true, 380); });
      btn.addEventListener('mouseleave', function() { runAnim(state, false, 420); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMessengerRings);
  else initMessengerRings();
  window.addEventListener('pageshow', function(e) { if (e.persisted) initMessengerRings(); });
})();

let _catalogHydrated = false;
let _catalogHydrationTimer = null;
let _catalogHydrationIO = null;

function initCatalogSliderVisibility() {
  if (typeof IntersectionObserver === 'undefined') return;
  const sliderIO = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const match = entry.target.id && entry.target.id.match(/^slider-(\d+)$/);
      if (!match) return;
      const pid = parseInt(match[1]);
      if (!entry.isIntersecting) {
        if (slideTimers[pid]) { clearInterval(slideTimers[pid]); delete slideTimers[pid]; }
      } else if (!slideTimers[pid]) {
        const p = products.find(x => x.id === pid);
        if (p && p.slides && p.slides.length > 1) {
          let cur = sliderCurrentIdx[pid] || 0;
          slideTimers[pid] = setInterval(() => {
            if (document.hidden) return;
            cur = (cur + 1) % p.slides.length;
            sliderCurrentIdx[pid] = cur;
            goSlide(pid, cur);
          }, 3000);
        }
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('[id^="slider-"]').forEach(el => sliderIO.observe(el));
}

function hydrateCatalog() {
  if (_catalogHydrated) return;
  _catalogHydrated = true;
  if (_catalogHydrationTimer) {
    clearTimeout(_catalogHydrationTimer);
    _catalogHydrationTimer = null;
  }
  if (_catalogHydrationIO) {
    _catalogHydrationIO.disconnect();
    _catalogHydrationIO = null;
  }

  renderCatalogNav();
  renderCatalog();
  if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(wireProductLightbox, { timeout: 500 });
  else requestAnimationFrame(() => requestAnimationFrame(wireProductLightbox));
  setTimeout(() => { initCatalogNavScroll(); initCatalogSwipeSync(); }, 500);
  initCatalogSliderVisibility();
}

function scheduleCatalogHydration() {
  const path = location.pathname || '/';
  const isHomepage = path === '/' || path === '/index.html';
  if (!isHomepage) {
    hydrateCatalog();
    return;
  }

  const catalog = document.getElementById('catalog');
  if (!catalog) return;
  const release = () => hydrateCatalog();

  if (location.hash) {
    release();
    return;
  }

  document.addEventListener('click', release, { once: true });
  document.addEventListener('keydown', () => setTimeout(release, 0), { once: true });
  window.addEventListener('scroll', release, { once: true, passive: true });

  if (typeof IntersectionObserver !== 'undefined') {
    _catalogHydrationIO = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) release();
    }, { threshold: 0, rootMargin: '200px 0px' });
    _catalogHydrationIO.observe(catalog);
  }

  // Keep the heavy catalog DOM outside the measured LCP window even without intent/scroll.
  _catalogHydrationTimer = setTimeout(release, 8000);
}

function initApp() {
  /* r29: bug #5 — restore biscuit from localStorage */
  if (typeof window._calcBiscuit === "undefined") { try { window._calcBiscuit = localStorage.getItem("milovicake_biscuit") || "vanilla"; } catch(e) { window._calcBiscuit = "vanilla"; } }
  scheduleCatalogHydration();
  loadCartFromStorage();
  updateCartUI();
  observeReveal();
  initWaveText();
  initSectionTitleWords();
  enforceSingleSelected('calcType');
  enforceSingleSelected('calcFill');
  enforceSingleSelected('calcDecor');
  (function initCalcRows() {
    document.querySelectorAll('.calc-row').forEach(r => r.style.transition = 'none');
    const activeTypeCard = document.querySelector('#calcType .calc-opt.selected');
    if (activeTypeCard) selectCakeType(activeTypeCard, activeTypeCard.dataset.type || 'biscuit');
    requestAnimationFrame(() => requestAnimationFrame(() => { document.querySelectorAll('.calc-row').forEach(r => r.style.transition = ''); }));
  })();
  updateCalc();
  (function initFillDescPanel() {
    const panel = document.getElementById('fillDescPanel'), text = document.getElementById('fillDescText');
    if (!panel || !text) return;
    const selected = document.querySelector('#calcFill .calc-opt.selected');
    if (!selected) return;
    const desc = fillDescOf(selected);
    if (desc) { text.textContent = desc; panel.style.display = ''; panel.style.opacity = '1'; }
  })();
  (function initHeroOrbWillChange() {
    const hero = document.querySelector('.hero');
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => { entries.forEach(e => e.target.classList.toggle('hero--visible', e.isIntersecting)); }, { threshold: 0 });
    io.observe(hero);
  })();
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }

// ── SCROLL HANDLER ──
const _scrollEl = document.getElementById('scroll-progress');
const backToTopEl = document.getElementById('backToTop');
// [r30] Прогресс прокрутки — один замкнутый контур по периметру кнопки.
// Было два <circle> с rotate(-90deg) на SVG: кольцо читалось второй рамкой,
// а поворот давал лишний композитный слой. Теперь один path по контуру
// скруглённого квадрата: старт в верхней центральной точке, обход по часовой,
// pathLength=100 — прогресс это dasharray/dashoffset, без пересчёта длины.
// [r31→r32] Геометрия контура (актуальные числа, не история): SVG 46×46 по
// кнопке, вписанный квадрат 41×41 с отступом 2.5 px от кромки, радиус пути
// 10.5 = 13 (border-radius кнопки) − 2.5, толщина 1.6. При stroke 1.6 линия
// занимает 1.7…3.3 px от кромки, то есть целиком лежит внутри вьюпорта SVG
// и концентрична скруглению; hitbox кнопки остаётся 46 px.
const _bttRingPath = 'M23 2.5H33A10.5 10.5 0 0 1 43.5 13V33A10.5 10.5 0 0 1 33 43.5H13A10.5 10.5 0 0 1 2.5 33V13A10.5 10.5 0 0 1 13 2.5H23Z';
let _bttFill = null;
if (backToTopEl && !backToTopEl.querySelector('.btt-ring')) {
  backToTopEl.insertAdjacentHTML('afterbegin',
    '<svg class="btt-ring" viewBox="0 0 46 46" aria-hidden="true" focusable="false">' +
    '<path class="btt-ring-track" d="' + _bttRingPath + '" pathLength="100"/>' +
    '<path class="btt-ring-fill" d="' + _bttRingPath + '" pathLength="100"/></svg>');
  _bttFill = backToTopEl.querySelector('.btt-ring-fill');
  _bttFill.style.strokeDasharray = '100';
  _bttFill.style.strokeDashoffset = '100';
}
let _scrollTicking = false;
// [r31] Один rAF-конвейер без пересчёта layout: высоту документа кэшируем
// и обновляем только при реальном изменении размера (RO ниже), а dashoffset
// пишем лишь когда значение изменилось — иначе каждый кадр инвалидировал стиль.
let _scrollTotalCache = 0;
let _bttLastOffset = null;

/* [r32] «Наверх» уступает интерактиву страницы.
   На узких экранах кнопка (справа снизу) встаёт ровно на «+» вопроса FAQ:
   замер до правки — 16 из 25 положений скролла перекрывали плюс, худший зазор
   −57 px при требовании ≥ 12. Правило геометрическое и без скролл-хаков:
   считаем зазор между рамкой кнопки и кликабельными строками FAQ; меньше
   12 px — кнопка гаснет (класс btt-obstructed, pointer-events:none), и
   возвращается только когда зазор снова больше 24 px. Разные пороги на вход
   и выход дают гистерезис, поэтому на границе нет мерцания. */
const BTT_AVOID_SELECTOR = '.cb-faq-item, .faq-item';
const BTT_MIN_GAP = 12;        // минимальная безопасная дистанция, px
const BTT_RESUME_GAP = 24;     // порог возврата (гистерезис), px
let _bttObstructed = false;

/* Строки FAQ кэшируем в координатах документа. Пересчёт — только когда
   реально меняется раскладка (resize, смена высоты документа, раскрытие
   аккордеона), а не каждый кадр скролла: rect-чтения в кадре заставляют
   браузер синхронно пересобирать layout прямо посреди анимации. */
let _bttAvoidRows = null;
let _bttAvoidDocH = -1;
function _bttRowsInvalidate() { _bttAvoidRows = null; }
function _bttRowsCached() {
  /* [r34] Кэш живёт до изменения высоты документа: лента и FAQ догружаются
     картинками уже после load, и координаты молча уезжали на десятки пикселей.
     Одно чтение scrollHeight за кадр дешевле, чем пересборка всех квадратов,
     и не инвалидирует layout, пока страница не менялась. */
  const docH = document.documentElement.scrollHeight;
  if (_bttAvoidRows && _bttAvoidDocH === docH) return _bttAvoidRows;
  const rows = [];
  const nodes = document.querySelectorAll(BTT_AVOID_SELECTOR);
  const sy = window.scrollY;
  for (let i = 0; i < nodes.length; i++) {
    const r = nodes[i].getBoundingClientRect();
    if (!r.width || !r.height) continue;
    rows.push({ top: r.top + sy, bottom: r.bottom + sy, left: r.left, right: r.right });
  }
  /* [r34] Лента «Наши работы · в движении» — плитки ссылок под кнопкой.
     Контейнер статичен: движется только .vstrip-track внутри, поэтому берём
     одну рамку контейнера в координатах документа и не трогаем плитки в кадре. */
  const strip = document.getElementById('mcVideoStrip');
  if (strip) {
    const rs = strip.getBoundingClientRect();
    if (rs.width && rs.height) rows.push({ top: rs.top + sy, bottom: rs.bottom + sy, left: rs.left, right: rs.right });
  }
  _bttAvoidRows = rows;
  _bttAvoidDocH = docH;
  return rows;
}

/* Минимальный зазор от рамки кнопки до кликабельной строки FAQ.
   Прямоугольники не пересекаются, если разведены хотя бы по одной оси. */
function _bttGapToRows(rect) {
  const rows = _bttRowsCached();
  const sy = window.scrollY;
  let worst = Infinity;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const gap = Math.max(
      r.left - rect.right,
      rect.left - r.right,
      (r.top - sy) - rect.bottom,
      rect.top - (r.bottom - sy)
    );
    if (gap < worst) worst = gap;
  }
  return worst;
}

function _syncBttAvoidance() {
  if (!backToTopEl) return;
  if (!backToTopEl.classList.contains('visible') || backToTopEl.classList.contains('footer-clearance')) {
    if (_bttObstructed) { _bttObstructed = false; backToTopEl.classList.remove('btt-obstructed'); }
    return;
  }
  const gap = _bttGapToRows(backToTopEl.getBoundingClientRect());
  const limit = _bttObstructed ? BTT_RESUME_GAP : BTT_MIN_GAP;
  const obstructed = gap < limit;
  if (obstructed !== _bttObstructed) {
    _bttObstructed = obstructed;
    backToTopEl.classList.toggle('btt-obstructed', obstructed);
  }
}

function _syncScrollUi() {
  /* Порядок важен: сначала все замеры (рамка кнопки), потом записи стилей —
     иначе каждая запись инвалидирует layout и следующий замер тянет за собой
     синхронную пересборку. */
  if (backToTopEl) backToTopEl.classList.toggle('visible', window.scrollY > 600);
  _syncBttAvoidance();
  const y = window.scrollY;
  const total = _scrollTotalCache;
  const p = total > 0 ? Math.min(1, Math.max(0, y / total)) : 0;
  if (_scrollEl) _scrollEl.style.width = (p * 100) + '%';
  if (_bttFill) {
    const off = ((1 - p) * 100).toFixed(2);
    if (off !== _bttLastOffset) { _bttFill.style.strokeDashoffset = off; _bttLastOffset = off; }
  }
}

function _syncScrollTotal() { _scrollTotalCache = Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }

/* Единственный вход: либо пересчитать высоту документа, либо нет.
   Первая загрузка, pageshow/bfcache, поворот экрана и смена высоты документа
   прогоняют полную синхронизацию (позиция, видимость, прогресс, уход от FAQ)
   сразу — раньше до первого ручного скролла кольцо показывало старое значение. */
function _syncScrollState(refreshTotal) {
  if (refreshTotal) { _syncScrollTotal(); _bttRowsInvalidate(); }
  if (_scrollTicking) return;
  _scrollTicking = true;
  requestAnimationFrame(() => { _syncScrollUi(); _scrollTicking = false; });
}

/* Раскрытие аккордеона меняет высоту строки — кэш сбрасываем сразу и ещё раз
   после анимации, иначе кнопка «увидит» старую геометрию вопроса. */
document.addEventListener('click', function (e) {
  if (e.target && e.target.closest && e.target.closest(BTT_AVOID_SELECTOR)) {
    _bttRowsInvalidate();
    setTimeout(function () { _bttRowsInvalidate(); _syncScrollState(false); }, 450);
  }
}, { passive: true, capture: true });

window.addEventListener('scroll', function () { _syncScrollState(false); }, { passive: true });
window.addEventListener('resize', function () { _syncScrollState(true); }, { passive: true });
window.addEventListener('orientationchange', function () { setTimeout(function () { _syncScrollState(true); }, 220); }, { passive: true });
window.addEventListener('load', function () { _syncScrollState(true); });
window.addEventListener('pageshow', function () { _syncScrollState(true); });
document.addEventListener('visibilitychange', function () { if (!document.hidden) _syncScrollState(true); });
if (typeof ResizeObserver === 'function') { try { new ResizeObserver(function () { _syncScrollState(true); }).observe(document.documentElement); } catch (err) {} }
_syncScrollState(true);

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.setAttribute('role', 'status');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── ANIMATED COUNTERS ──
function animateCounter(el) {
  const target = +el.dataset.target, suffix = el.dataset.suffix || '', duration = 1800, start = performance.now();
  function step(now) { const progress = Math.min((now - start) / duration, 1); el.textContent = Math.floor((1 - Math.pow(1 - progress, 3)) * target) + suffix; if (progress < 1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
const counterObserver = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); counterObserver.unobserve(e.target); } }); }, { threshold: 0.1, rootMargin: '0px 0px 40px 0px' });
document.querySelectorAll('.stat-num').forEach(el => counterObserver.observe(el));

// ── BURGER MENU ──
// Единый контроллер мобильного меню: одна разметка (index.html и
// prigorody/_template.html), один набор классов. Focus-trap, Esc и возврат
// фокуса живут в js/mc-2026.js (там же MutationObserver на .mobile-menu.open),
// поэтому здесь только состояние, блокировка прокрутки и закрытие на ресайзе.
const burgerBtn = document.getElementById('burgerBtn'), mobileMenu = document.getElementById('mobileMenu');
function _menuIsOpen() { return !!(mobileMenu && mobileMenu.classList.contains('open')); }
function openMobileMenu() {
  if (!burgerBtn || !mobileMenu || _menuIsOpen()) return;
  burgerBtn.classList.add('open');
  mobileMenu.classList.add('open');
  burgerBtn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
  if (typeof window.syncThemeControls === 'function') window.syncThemeControls();
}
function closeMobileMenu() {
  if (!burgerBtn || !mobileMenu) return;
  burgerBtn.classList.remove('open'); mobileMenu.classList.remove('open');
  burgerBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}
if (burgerBtn && mobileMenu) {
  burgerBtn.addEventListener('click', () => { _menuIsOpen() ? closeMobileMenu() : openMobileMenu(); });
  // Меню живёт только до 768px: при переходе на десктоп оно не должно
  // оставлять body.menu-open (иначе страница теряла прокрутку).
  const _menuMq = window.matchMedia('(min-width: 769px)');
  const _closeOnDesktop = (e) => { if (e.matches) closeMobileMenu(); };
  if (_menuMq.addEventListener) _menuMq.addEventListener('change', _closeOnDesktop);
  else if (_menuMq.addListener) _menuMq.addListener(_closeOnDesktop);
  window.openMobileMenu = openMobileMenu;
}

// ── LIGHTBOX ──
let _lbSrcs = [], _lbIdx = 0;
function _lbAltFromSrc(src) { const file = (src || '').split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '); return file ? 'Фото торта Milovi Cake — ' + file : 'Фото торта Milovi Cake'; }

function openLightbox(src, srcs) {
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const lb = document.getElementById('lightbox'), lbImg = document.getElementById('lightboxImg');
  if (!lb || !lbImg) return;
  _lbSrcs = srcs || [src];
  _lbIdx = _lbSrcs.findIndex(s => src.endsWith(s) || s.endsWith(src) || src === s);
  if (_lbIdx < 0) _lbIdx = 0;
  lbImg.src = _lbSrcs[_lbIdx]; lbImg.alt = _lbAltFromSrc(_lbSrcs[_lbIdx]);
  lb.classList.add('open'); lockBody();
  _lbUpdateArrows();
  /* r32: bug #38 — focus trap for lightbox */
  if (window._trapFocus) { window._lbTrapRelease = window._trapFocus(lb); }
  setTimeout(function(){ var c = lb.querySelector('.lightbox-close'); if (c) c.focus(); }, 100);
}

function lbNavigate(dir) {
  if (_lbSrcs.length < 2) return;
  _lbIdx = (_lbIdx + dir + _lbSrcs.length) % _lbSrcs.length;
  const img = document.getElementById('lightboxImg');
  if (!img) return;
  img.style.opacity = '0'; img.style.transition = 'opacity 0.15s';
  setTimeout(() => { img.src = _lbSrcs[_lbIdx]; img.alt = _lbAltFromSrc(_lbSrcs[_lbIdx]); img.style.opacity = '1'; }, 150);
  _lbUpdateArrows();
}
function _lbUpdateArrows() {
  const lbNav = document.getElementById('lbNav');
  if (!lbNav) return;
  const show = _lbSrcs.length > 1;
  lbNav.classList.toggle('hidden', !show);
  const counter = document.getElementById('lbCounter');
  if (counter) counter.textContent = (_lbIdx + 1) + ' / ' + _lbSrcs.length;
}
function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  /* [r31] Глобальный Escape звал closeLightbox() всегда, и та снимала
     блокировку прокрутки у ЧУЖОГО открытого окна (корзина/шторка начинок):
     страница разблокировалась под модалкой. Закрываем только открытый. */
  if (!lb.classList.contains('open')) return;
  /* r32: bug #38 — release focus trap */
  if (window._lbTrapRelease) { window._lbTrapRelease(); window._lbTrapRelease = null; }
  lb.classList.remove('open'); unlockBody();
  _lbSrcs = []; _lbIdx = 0;
}

(function() { const _lbEl = document.getElementById('lightbox'); if (_lbEl) _lbEl.addEventListener('click', function(e) { if (e.target === this) closeLightbox(); }); })();

(function() { const lb = document.getElementById('lightbox'); if (!lb) return; let sx = 0; lb.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true }); lb.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) lbNavigate(dx < 0 ? 1 : -1); }, { passive: true }); })();

setTimeout(() => {
  const reviewImgs = Array.from(document.querySelectorAll('.review-img-wrap img'));
  const reviewSrcs = reviewImgs.map(img => img.src);
  reviewImgs.forEach(img => { img.style.cursor = 'zoom-in'; img.addEventListener('click', () => openLightbox(img.src, reviewSrcs)); });
}, 100);

function wireProductLightbox() {
  products.forEach(p => {
    if (!p.slides || p.slides.length === 0) return;
    const wrap = document.getElementById('slider-' + p.id);
    if (!wrap || wrap._lbBound) return;
    wrap._lbBound = true;
    wrap.addEventListener('click', (e) => {
      if (wrap._wasSwiped) return;
      const img = e.target.closest('.slide-img');
      if (!img || img.classList.contains('slide-video')) return;
      const activeIdx = (typeof sliderCurrentIdx !== 'undefined' && sliderCurrentIdx[p.id]) ? sliderCurrentIdx[p.id] : 0;
      const mode = typeof bentoModes !== 'undefined' && bentoModes[p.id];
      const currentSlides = (mode === 'maxi' && p.maxiVariant) ? p.maxiVariant.slides : p.slides;
      openLightbox(currentSlides[activeIdx], currentSlides);
    });
  });
}

// ══════════════════════════════════════════
// CALCULATOR
// ══════════════════════════════════════════

function selectCakeType(el, type) {
  // Keep tooltips in the DOM.
  document.querySelectorAll('#calcType .calc-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _cakeType = type;
  const cfg = CAKE_CONFIGS[type];
  function setRowVisible(el, visible) { if (!el) return; el.classList.toggle('calc-row--hidden', !visible); }
  const weightRow = document.getElementById('calcWeightRow'), qtyRow = document.getElementById('calcQtyRow');
  setRowVisible(weightRow, cfg.hasWeight); setRowVisible(qtyRow, cfg.hasQty);
  const minus = document.getElementById('calcWeightMinus'), plus = document.getElementById('calcWeightPlus');
  if (type === 'bento' || type === 'bentomaxi') { setRowVisible(weightRow, false); }
  else {
    setRowVisible(weightRow, true);
    if (minus) minus.style.display = ''; if (plus) plus.style.display = '';
    const noteWrap = document.getElementById('calcFixedWeightNote')?.parentElement;
    if (noteWrap) noteWrap.classList.remove('visible');
    const valEl = document.getElementById('calcWeightVal');
    if (valEl) valEl.style.display = '';
    const lbl = document.getElementById('calcWeightLabel');
    if (lbl) lbl.textContent = 'Вес торта';
  }
  if (cfg.hasWeight && type !== 'bento' && type !== 'bentomaxi') {
    // [r31] Раньше вес подтягивался только к минимуму: после 3D-торта 15 кг
    // бисквитный торт оставался 15-килограммовым при максимуме 10 кг и уходил
    // в корзину таким же. Теперь ограничение двустороннее.
    if (_calcWeight < cfg.weightMin || _calcWeight > cfg.weightMax) {
      _calcWeight = Math.min(cfg.weightMax, Math.max(cfg.weightMin, _calcWeight));
      const v = document.getElementById('calcWeightVal'); if (v) v.textContent = _calcWeight % 1 === 0 ? _calcWeight + ' кг' : _calcWeight.toFixed(1) + ' кг';
      const i = document.getElementById('calcWeight'); if (i) i.value = _calcWeight;
    }
    if (minus) minus.disabled = _calcWeight <= cfg.weightMin;
    if (plus) plus.disabled = _calcWeight >= cfg.weightMax;
  }
  ['calcFillRow','calcFillBentoRow','calcFill3dRow'].forEach(id => { const row = document.getElementById(id); if (!row) return; setRowVisible(row, (row.dataset.for || '').includes(type)); });
  const activeGroup = document.getElementById(cfg.fillGroup);
  if (activeGroup) {
    activeGroup.querySelectorAll('.calc-opt').forEach((o, i) => { o.classList.toggle('selected', i === 0); });
    _syncFillDescPanel(activeGroup.querySelector('.calc-opt'));
  }
  const decorRow = document.getElementById('calcDecor')?.closest('.calc-row');
  setRowVisible(decorRow, true);
  updateCalc();
}

function stepQty(dir) {
  const newVal = _calcQty + dir;
  if (newVal < 1 || newVal > 20) return;
  _calcQty = newVal;
  const valEl = document.getElementById('calcQtyVal');
  if (valEl) valEl.textContent = _calcQty + ' шт';
  const minus = document.getElementById('calcQtyMinus'), plus = document.getElementById('calcQtyPlus');
  if (minus) minus.disabled = _calcQty <= 1;
  if (plus) plus.disabled = _calcQty >= 20;
  updateCalc();
}

function stepWeight(dir) {
  const cfg = CAKE_CONFIGS[_cakeType] || CAKE_CONFIGS.biscuit;
  const step = cfg.weightStep || 0.5;
  const newVal = Math.round((_calcWeight + dir * step) * 10) / 10;
  if (newVal < cfg.weightMin || newVal > cfg.weightMax) return;
  _calcWeight = newVal;
  const _cwEl = document.getElementById('calcWeight');
  if (_cwEl) _cwEl.value = _calcWeight;
  const minus = document.getElementById('calcWeightMinus'), plus = document.getElementById('calcWeightPlus');
  if (minus) minus.disabled = _calcWeight <= cfg.weightMin;
  if (plus) plus.disabled = _calcWeight >= cfg.weightMax;
  updateCalc();
}

function enforceSingleSelected(groupId) {
  const items = Array.from(document.querySelectorAll(`#${groupId} .calc-opt`));
  if (!items.length) return;
  const selected = items.filter(x => x.classList.contains('selected'));
  if (selected.length <= 1) { if (selected.length === 0) items[0].classList.add('selected'); return; }
  selected.forEach((x, i) => i > 0 && x.classList.remove('selected'));
}

/* [r33] Описание состава живёт в .fill-tooltip, но initFillTooltips уносит
   подсказки в <body> — иначе их режет overflow калькулятора. После переноса
   opt.querySelector('.fill-tooltip') всегда null, поэтому «Состав начинки»,
   мобильный поповер и live-region показывали текст первой начинки или ничего.
   Читаем описание один раз (пока подсказка ещё внутри опции) и кэшируем. */
function fillDescOf(opt) {
  if (!opt) return '';
  if (typeof opt._fillDesc === 'string') return opt._fillDesc;
  const tip = opt.querySelector ? opt.querySelector('.fill-tooltip') : null;
  let desc = '';
  if (tip) {
    const strong = tip.querySelector('strong');
    desc = tip.textContent.replace(strong ? strong.textContent : '', '').replace(/\s+/g, ' ').trim();
  } else if (opt.dataset && opt.dataset.desc) {
    desc = String(opt.dataset.desc).trim();
  }
  opt._fillDesc = desc;
  return desc;
}

/* [r33] Панель «Состав начинки» — единственное место, где состав произносится
   словами. У бенто и 3D описаний нет вовсе (в опциях только .opt-label), и
   панель продолжала показывать состав бисквитной начинки при выбранном
   «Медовике». Пустой состав → панель убираем целиком: пустая рамка читается
   как незаполненный блок. */
function _syncFillDescPanel(opt) {
  const panel = document.getElementById('fillDescPanel'), text = document.getElementById('fillDescText');
  if (!panel || !text) return;
  const desc = fillDescOf(opt);
  if (desc) {
    text.textContent = desc;
    panel.style.display = '';
    requestAnimationFrame(() => { panel.style.opacity = '1'; });
  } else {
    panel.style.opacity = '0';
    panel.style.display = 'none';
    /* [r34] Чужой текст не оставляем даже в скрытом узле: если состав вернётся
       (панель покажут снова), он не должен воскреснуть с чужой начинкой. */
    text.textContent = '';
  }
}

function selectOpt(el, groupId) {
  const opt = el && el.closest ? el.closest('.calc-opt') : el;
  if (!opt) return;
  const _fillGroups = ['calcFill', 'calcFillBento', 'calcFill3d', 'calcDecor'];
  const _isFillPick = _fillGroups.indexOf(groupId) !== -1;
  const _isMobileSheet = _isFillPick && window.innerWidth < 768;

  /* [r34] Общая часть выбора — одна на мобильный и десктопный путь.
     Раньше мобильная ветка уходила в return до синхронизации панели, и на
     телефоне «Состав начинки» показывал первую начинку при выбранной третьей,
     хотя live-region был верный. */
  document.querySelectorAll(`#${groupId} .calc-opt.selected`).forEach(x => x.classList.remove('selected'));
  opt.classList.add('selected');
  if (groupId === 'calcDecor') { const hint = document.getElementById('calcDecorHint'); if (hint) { const price = parseInt(opt.dataset.price || 0); hint.classList.toggle('visible', price > 0); } }
  if (groupId === 'calcFill' || groupId === 'calcFillBento' || groupId === 'calcFill3d') {
    _syncFillDescPanel(opt);
  }
  const inner = opt.querySelector('.opt-inner');
  if (inner) { inner.classList.remove('rubber-click'); void inner.offsetWidth; inner.classList.add('rubber-click'); inner.addEventListener('animationend', () => inner.classList.remove('rubber-click'), { once: true }); }

  if (_isMobileSheet) {
    updateCalc && updateCalc();
    showFillToast(opt, groupId);
    return;
  }

  const label = opt.querySelector('.opt-label');
  if (label) { label.classList.remove('opt-label-shake'); void label.offsetWidth; label.classList.add('opt-label-shake'); label.addEventListener('animationend', () => label.classList.remove('opt-label-shake'), { once: true }); }
  if (groupId === 'calcType') { const _w = document.getElementById('calcWeightRow'); const _f = document.getElementById('calcFillRow'); if (_w) _w.style.display = 'block'; if (_f) _f.style.display = 'block'; }
  updateCalc();
}

function updateCalc() {
  const cfg = CAKE_CONFIGS[_cakeType] || CAKE_CONFIGS.biscuit;
  const fillEl = document.querySelector('#' + cfg.fillGroup + ' .selected');
  const decorEl = document.querySelector('#calcDecor .selected');
  const fillPrice  = +(fillEl?.dataset.price  || 0);
  const decorPrice = calcDecorSurcharge(_cakeType, decorEl);
  let total, noteText = 'Точная цена согласовывается при заказе';
  if (cfg.fixedPrice !== null) { total = cfg.fixedPrice * _calcQty + fillPrice; noteText = 'Декор рассчитывается отдельно'; }
  else {
    const weight = _calcWeight;
    total = cfg.pricePerKg * weight + fillPrice + decorPrice;
    const valEl = document.getElementById('calcWeightVal');
    if (valEl) valEl.textContent = weight % 1 === 0 ? weight + ' кг' : weight.toFixed(1) + ' кг';
    const guestsPopupEl = document.getElementById('guestsPopup');
    if (guestsPopupEl) { const n = Math.round(weight / 0.2); guestsPopupEl.textContent = '≈ ' + n + ' чел.'; }
    if (decorPrice > 0) noteText = '* Стоимость авторского декора рассчитывается индивидуально';
  }
  if (_cakeType === 'cake3d') noteText = 'Сложный декор рассчитывается отдельно';
  else if (_cakeType === 'bento' || _cakeType === 'bentomaxi') noteText = 'Декор рассчитывается отдельно';
  else noteText = (noteText === 'Точная цена согласовывается при заказе' ? 'Дополнительный декор рассчитывается отдельно' : noteText + '. Дополнительный декор рассчитывается отдельно');
  const isApprox = decorPrice > 0 || _cakeType === 'cake3d' || _cakeType === 'bento' || _cakeType === 'bentomaxi';
  const prefix = isApprox ? '~ ' : '';
  const calcResultEl = document.getElementById('calcResult');
  if (calcResultEl) calcResultEl.textContent = prefix + total.toLocaleString('ru') + ' ₽';
  const collapsedPrice = document.getElementById('calcResultCollapsed');
  if (collapsedPrice) collapsedPrice.textContent = prefix + total.toLocaleString('ru') + ' ₽';
  const calcNoteEl = document.getElementById('calcNote');
  if (calcNoteEl) calcNoteEl.textContent = noteText;
  const summaryEl = document.getElementById('calcSummary');
  if (summaryEl) {
    const chipSvg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    const typeNames = { biscuit: 'Бисквитный', bento: 'Бенто', bentomaxi: 'Макси Бенто', cake3d: '3D Торт' };
    const typeIcons = {
      biscuit: chipSvg('<path d="M12 2.8V6"/><path d="M5.5 21h13v-6.5a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4z"/>'),
      bento: chipSvg('<rect x="4" y="9" width="16" height="11" rx="2.2"/><path d="M4 13h16"/>'),
      bentomaxi: chipSvg('<rect x="5.5" y="13" width="13" height="7" rx="1.8"/><rect x="7.5" y="6" width="9" height="7" rx="1.8"/>'),
      cake3d: chipSvg('<path d="M11 4l1.7 4.8L17.5 10.5l-4.8 1.7L11 17l-1.7-4.8L4.5 10.5l4.8-1.7z"/>')
    };
    const weightIcon = chipSvg('<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M9 8a3 3 0 0 1 6 0"/>');
    const qtyIcon = chipSvg('<path d="M12 5v14"/><path d="M5 12h14"/>');
    const fillIcon = chipSvg('<circle cx="11" cy="15" r="5.5"/><path d="M11 9.5c0-2 1.2-3.2 3.2-3.7"/>');
    const decorIcon = chipSvg('<path d="M12 4l1.7 4.8L18.5 10.5l-4.8 1.7L12 17l-1.7-4.8L5.5 10.5l4.8-1.7z"/>');
    const fillName = fillEl?.querySelector('.opt-label')?.textContent?.trim() || '';
    const decorName = decorEl?.querySelector('.opt-label')?.textContent?.trim() || '';
    let chips = [];
    chips.push({ icon: typeIcons[_cakeType], label: 'Тип', val: typeNames[_cakeType] });
    if (cfg.hasQty && _cakeType === 'bento') { chips.push({ icon: weightIcon, label: 'Вес', val: '~350 гр / шт' }); chips.push({ icon: qtyIcon, label: 'Количество', val: _calcQty + ' шт' }); }
    else if (cfg.hasQty && _cakeType === 'bentomaxi') { chips.push({ icon: weightIcon, label: 'Вес', val: '~1100 гр / шт' }); chips.push({ icon: qtyIcon, label: 'Количество', val: _calcQty + ' шт' }); }
    else { const w = _calcWeight; const wStr = w % 1 === 0 ? w + ' кг' : w.toFixed(1) + ' кг'; const guests = Math.round(w / 0.2); chips.push({ icon: weightIcon, label: 'Вес', val: wStr + ' · ~' + guests + ' чел' }); }
    if (fillName) chips.push({ icon: fillIcon, label: 'Начинка', val: fillName });
    if (_cakeType !== 'bento' && decorName) chips.push({ icon: decorIcon, label: 'Декор', val: decorName });
    summaryEl.innerHTML = chips.map(c => `<span class="calc-summary-chip"><span class="chip-icon">${c.icon}</span><span class="chip-label">${c.label}: </span><span class="chip-val">${c.val}</span></span>`).join('');
  }
}

let bentoToastTimer = null;
function showBentoWeightToast(text) {
  if (window.matchMedia('(hover: hover)').matches) return;
  const toast = document.getElementById('bentoWeightToast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(bentoToastTimer);
  bentoToastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Яндекс.Метрика ──

// ── Cookie banner ──
// ── Privacy modal ──
// ══════════════════════════════════════════
// FILL BOTTOM SHEET
// ══════════════════════════════════════════

let _fillSheetPendingEl = null, _fillSheetPendingGroupId = null;

function _fillPopupRender(optEl) {
  if (!optEl) return;
  const title = optEl.querySelector('.opt-label')?.textContent?.trim() || '';
  const desc = fillDescOf(optEl) || (optEl.dataset.desc || '');
  const tagEls = optEl.querySelectorAll('.fill-tag');
  const tagsHTML = Array.from(tagEls).map(t => { const cls = t.classList.contains('hit') ? 'tag-hit' : t.classList.contains('nuts') ? 'tag-nuts' : ''; return `<span class="fill-sheet-tag ${cls}">${t.textContent.trim()}</span>`; }).join('');
  const _fillSheetTagsEl = document.getElementById('fillSheetTags'), _fillPopupTitleEl = document.getElementById('fillPopupTitle'), _fillPopupTextEl = document.getElementById('fillPopupText');
  if (_fillSheetTagsEl) _fillSheetTagsEl.innerHTML = tagsHTML;
  if (_fillPopupTitleEl) _fillPopupTitleEl.textContent = title;
  if (_fillPopupTextEl) _fillPopupTextEl.textContent = desc;
  const groupId = _fillSheetPendingGroupId || 'calcFill';
  const allOpts = Array.from(document.querySelectorAll(`#${groupId} .calc-opt`));
  const idx = allOpts.indexOf(optEl), total = allOpts.length;
  const counterEl = document.getElementById('fillNavCounter'), prevBtn = document.getElementById('fillNavPrev'), nextBtn = document.getElementById('fillNavNext');
  if (counterEl) counterEl.textContent = total > 1 ? `${idx + 1} / ${total}` : '';
  if (prevBtn) prevBtn.disabled = (idx <= 0);
  if (nextBtn) nextBtn.disabled = (idx >= total - 1);
  const selectBtn = document.getElementById('fillSheetSelect');
  if (selectBtn) selectBtn.textContent = (groupId === 'calcDecor') ? 'Выбрать оформление' : 'Выбрать начинку';
}

// ── Раскрывающаяся панель стоимости ──
function toggleCalcPanel() {
  if (window.innerWidth > 560) return;
  const col = document.getElementById('calcRightCol');
  if (!col) return;
  const isOpen = col.classList.toggle('calc-result-open');
  col._scrollY = window.scrollY;
  _setCalcBackdrop(isOpen);
}
function closeCalcPanel() {
  const col = document.getElementById('calcRightCol');
  if (col?.classList.contains('calc-result-open') && document.getElementById('calcExpandable')?.contains(document.activeElement)) {
    document.getElementById('calcCollapsedBar')?.focus({ preventScroll: true });
  }
  if (col) col.classList.remove('calc-result-open');
  _setCalcBackdrop(false);
}
function _setCalcBackdrop(show) {
  if (window.innerWidth > 560 && show) return;
  document.getElementById('calcCollapsedBar')?.setAttribute('aria-expanded', String(!!show));
  let bd = document.getElementById('calcPanelBackdrop');
  if (!bd && !show) return;
  if (!bd) { bd = document.createElement('div'); bd.id = 'calcPanelBackdrop'; bd.setAttribute('aria-hidden', 'true'); bd.addEventListener('click', closeCalcPanel); document.body.appendChild(bd); }
  bd.classList.toggle('visible', !!show);
  document.body.classList.toggle('calc-panel-open', !!show);
}

document.addEventListener('click', function(e) { if (window.innerWidth > 560) return; const col = document.getElementById('calcRightCol'); if (!col || !col.classList.contains('calc-result-open')) return; if (!col.contains(e.target)) closeCalcPanel(); }, { passive: true });

window.addEventListener('scroll', function() {
  if (window.innerWidth > 560) return;
  const col = document.getElementById('calcRightCol');
  if (!col || !col.classList.contains('calc-result-open')) return;
  // [r30] Если фокус внутри сметы, прокрутку мог вызвать сам браузер
  // (Tab к кнопке «Добавить в корзину»). Раньше это молча закрывало панель —
  // клавиатурой было не добраться до действий. Держим панель, но запоминаем
  // позицию, чтобы следующий настоящий скролл её всё равно закрыл.
  const expandable = document.getElementById('calcExpandable');
  if (expandable && expandable.contains(document.activeElement)) { col._scrollY = window.scrollY; return; }
  if (col._scrollY !== window.scrollY) closeCalcPanel();
}, { passive: true });

// [r31] Владелец: плавающая плашка дублировала уже выбранный вариант и
// закрывала «Примерную стоимость». Визуальный toast удалён — выбор читается
// по золотой подсветке и составу в разделе; #fillToast теперь невидимый
// live-region, чтобы скринридер подтвердил выбор так же, как раньше.
function showFillToast(optEl, groupId) {
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const title = optEl.querySelector('.opt-label')?.textContent?.trim() || '';
  const desc = fillDescOf(optEl);
  const live = document.getElementById('fillToast');
  if (!live) return;
  live.textContent = title ? ('Выбрано: ' + title + (desc ? '. ' + desc : '')) : '';
}

function closeFillPopup() {
  const popup = document.getElementById('fillPopup'), overlay = document.getElementById('fillOverlay');
  // [r31] Та же причина, что у closeLightbox: не открытую шторку не закрываем,
  // иначе Escape снимает чужой lock и тело разблокируется под корзиной.
  if (!popup || !popup.classList.contains('open')) return;
  if (popup) popup.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('fill-open');
  unlockBody();
  var _mcNavFill = document.getElementById('mcNav');
  if (_mcNavFill) { _mcNavFill.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }
  _fillSheetPendingEl = null; _fillSheetPendingGroupId = null;
  if (popup) { popup.style.transform = ''; popup.style.willChange = 'auto'; }
}

function confirmFillSelection() {
  if (_fillSheetPendingEl) {
    const groupId = _fillSheetPendingGroupId || 'calcFill';
    document.querySelectorAll(`#${groupId} .calc-opt`).forEach(o => o.classList.remove('selected'));
    _fillSheetPendingEl.classList.add('selected');
    const inner = _fillSheetPendingEl.querySelector('.opt-inner');
    if (inner) { inner.classList.remove('rubber-click'); void inner.offsetWidth; inner.classList.add('rubber-click'); inner.addEventListener('animationend', () => inner.classList.remove('rubber-click'), { once: true }); }
    updateCalc();
  }
  closeFillPopup();
  setTimeout(() => { const result = document.getElementById('calcResult'); if (result) result.closest('.calc-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
}

function navigateFill(dir) {
  if (!_fillSheetPendingEl || !_fillSheetPendingGroupId) return;
  const allOpts = Array.from(document.querySelectorAll(`#${_fillSheetPendingGroupId} .calc-opt`));
  const idx = allOpts.indexOf(_fillSheetPendingEl), next = allOpts[idx + dir];
  if (!next) return;
  _fillSheetPendingEl = next;
  _fillPopupRender(next);
}

(function initSheetSwipe() {
  const popup = document.getElementById('fillPopup'), handle = document.getElementById('fillSheetHandle');
  if (!popup || !handle) return;
  let startY = 0, currentY = 0, dragging = false;
  function onStart(e) { startY = e.touches ? e.touches[0].clientY : e.clientY; currentY = 0; dragging = true; popup.classList.add('dragging'); }
  function onMove(e) { if (!dragging) return; const y = e.touches ? e.touches[0].clientY : e.clientY; currentY = Math.max(0, y - startY); popup.style.transform = `translateY(${currentY}px)`; const overlay = document.getElementById('fillOverlay'); if (overlay) overlay.style.opacity = Math.max(0, 1 - currentY / 220); }
  function onEnd() { if (!dragging) return; dragging = false; popup.classList.remove('dragging'); popup.style.transform = ''; const overlay = document.getElementById('fillOverlay'); if (overlay) overlay.style.opacity = ''; if (currentY > 100) closeFillPopup(); currentY = 0; }
  handle.addEventListener('touchstart', onStart, { passive: true }); handle.addEventListener('touchmove', onMove, { passive: true }); handle.addEventListener('touchend', onEnd, { passive: true });
  const overlayEl = document.getElementById('fillOverlay');
  if (overlayEl) { overlayEl.addEventListener('click', closeFillPopup); overlayEl.addEventListener('touchend', () => { closeFillPopup(); }, { passive: true }); }
})();

// [r18] Unified keydown — всё в одном обработчике
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') lbNavigate(1);
  if (e.key === 'ArrowLeft')  lbNavigate(-1);
  if (e.key === 'Escape') {
    if (typeof closeLightbox === 'function') closeLightbox();
    if (typeof lbIsOpen !== 'undefined' && lbIsOpen && typeof closeLB === 'function') closeLB();
    closeFillPopup(); closeCalcPanel();
    const _cartDr = document.getElementById('cartDrawer');
    if (_cartDr && _cartDr.classList.contains('open')) closeCart();
  }
});

// ── Динамический минимум даты ──
/* [r32] Минимум даты доставки — по петербургскому календарю.
   Раньше: `new Date(); setDate(+2); toISOString()` — между 00:00 и 03:00 МСК
   UTC ещё показывает вчерашний день, и минимум уезжал на сутки назад
   (замер: 21.12 00:30 МСК → min 22.12 вместо 23.12). Считаем календарную
   дату в Europe/Moscow и уже от неё отсчитываем два дня. */
function spbDatePlusDays(days) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date()).split('-').map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)).toISOString().slice(0, 10);
    }
  } catch (e) { /* старые движки без Intl-таймзон — уходим в локальный фолбэк */ }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + days);
  return fallback.toISOString().slice(0, 10);
}
/* [r34] Минимум пересчитывается и после загрузки: страница может висеть в
   фоне через полночь по Москве, и вчерашнее «+2 дня» становится разрешением
   на прошедшую дату. Считаем заново при возврате в вкладку, при фокусе на поле
   и на самой отправке; старую выбранную дату не стираем — её отклонит проверка. */
function refreshCartDateMin() {
  const el = document.getElementById('cdate');
  if (!el) return '';
  const min = spbDatePlusDays(2);
  el.min = min;
  return min;
}
function formatSpbDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
(function() {
  const dateInput = document.getElementById('cdate');
  if (dateInput) {
    dateInput.min = spbDatePlusDays(2);
    dateInput.addEventListener('focus', refreshCartDateMin);
    dateInput.addEventListener('pointerdown', refreshCartDateMin);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshCartDateMin(); });
})();

// ── Mouse-tracking glow ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.product-card').forEach(card => {
    if (card._glowBound) return;
    card._glowBound = true;
    card.addEventListener('mousemove', (e) => { const r = card.getBoundingClientRect(); card.style.setProperty('--mouse-x', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); card.style.setProperty('--mouse-y', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); });
  });
});

// ── LIGHTBOX SWIPE DOWN ──
(function() { const lbWrap = document.getElementById('lightboxWrap'); if (!lbWrap) return; let startY = 0; lbWrap.addEventListener('touchstart', e => { startY = e.changedTouches[0].clientY; }, { passive: true }); lbWrap.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - startY > 90) closeLightbox(); }, { passive: true }); })();

// ── Hero parallax ──
const heroBg = document.querySelector('.hero-photo-bg img');
if (heroBg) {
  let _rafPending = false, _parallaxBound = false;
  function _parallaxHandler() {
    if (_rafPending) return; _rafPending = true;
    requestAnimationFrame(() => { const y = window.scrollY; if (y < window.innerHeight) heroBg.style.transform = `translateY(${y * 0.15}px) scale(1.05)`; _rafPending = false; });
  }
  function _bindParallax(mq) { if (mq.matches && !_parallaxBound) { window.addEventListener('scroll', _parallaxHandler, { passive: true }); _parallaxBound = true; } else if (!mq.matches && _parallaxBound) { window.removeEventListener('scroll', _parallaxHandler); heroBg.style.transform = ''; _parallaxBound = false; } }
  const _mq = window.matchMedia('(min-width: 769px)');
  _bindParallax(_mq);
  if (_mq.addEventListener) _mq.addEventListener('change', _bindParallax); else _mq.addListener(_bindParallax);
  document.addEventListener('visibilitychange', function() { if (document.hidden && _parallaxBound) { window.removeEventListener('scroll', _parallaxHandler); _parallaxBound = false; } else if (!document.hidden) _bindParallax(_mq); });
}

// ── Ripple effect ──
document.querySelectorAll('.btn-primary, .btn-wa, .calc-order-btn, .btn-add, .header-order').forEach(btn => {
  if (btn._rippleBound) return; btn._rippleBound = true; btn.classList.add('ripple-wrap');
  btn.addEventListener('click', function(e) {
    const prev = this.querySelector('.ripple-circle'); if (prev) prev.remove();
    const circle = document.createElement('span'); circle.classList.add('ripple-circle');
    const rect = this.getBoundingClientRect(); const size = Math.max(rect.width, rect.height);
    circle.style.width = circle.style.height = size + 'px';
    circle.style.left = e.clientX - rect.left - size/2 + 'px';
    circle.style.top = e.clientY - rect.top - size/2 + 'px';
    this.appendChild(circle); setTimeout(() => circle.remove(), 600);
  });
});

// ── Gold ripple ──
(function() {
  function bindCardRipple(card) {
    if (card._goldRippleBound) return; card._goldRippleBound = true;
    card.addEventListener('touchstart', function(e) {
      const prev = this.querySelector('.gold-ripple-circle'); if (prev) prev.remove();
      const touch = e.touches[0]; const rect = this.getBoundingClientRect(); const size = Math.max(rect.width, rect.height) * 1.4;
      const circle = document.createElement('span'); circle.className = 'gold-ripple-circle';
      circle.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;z-index:10;width:${size}px;height:${size}px;left:${touch.clientX - rect.left - size/2}px;top:${touch.clientY - rect.top - size/2}px;background:radial-gradient(circle,rgba(201,147,74,0.22) 0%,rgba(201,147,74,0) 70%);transform:scale(0);animation:goldRippleAnim 0.7s ease-out forwards`;
      this.appendChild(circle); setTimeout(function() { if (circle.parentNode) circle.remove(); }, 750);
    }, { passive: true });
  }
  document.querySelectorAll('.product-card').forEach(bindCardRipple);
  var observer = new MutationObserver(function(mutations) { mutations.forEach(function(m) { m.addedNodes.forEach(function(node) { if (!node.querySelectorAll) return; node.querySelectorAll('.product-card').forEach(bindCardRipple); if (node.classList && node.classList.contains('product-card')) bindCardRipple(node); }); }); });
  var grid = document.getElementById('catalogGrid'); if (grid) observer.observe(grid, { childList: true, subtree: true });
})();

// ── CHAT GALLERY LIGHTBOX ──
let _lbReviewIdx = 0;
const CHAT_SRCS = [IMG_BASE + '/review_1.webp', IMG_BASE + '/review_2.webp', IMG_BASE + '/review_3.webp', IMG_BASE + '/review_4.webp', IMG_BASE + '/review_5.webp', IMG_BASE + '/review_6.webp', IMG_BASE + '/review_7.webp', IMG_BASE + '/review_8.webp'];

function openChatLightbox(idx) {
  if (typeof lbBusy !== 'undefined' && lbBusy) { if (typeof lbBusy !== 'undefined') { window.lbBusy = false; window.lbIsOpen = false; } }
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const overlay = document.getElementById('lbOverlay'), img = document.getElementById('lbImg');
  if (!overlay || !img) return;
  const safeIdx = ((idx % CHAT_SRCS.length) + CHAT_SRCS.length) % CHAT_SRCS.length;
  _lbReviewIdx = safeIdx;
  img.src = CHAT_SRCS[safeIdx];
  img.style.opacity = '1'; img.style.transform = 'scale(1)'; img.style.transition = 'opacity 0.2s, transform 0.2s';
  const counter = document.getElementById('lbArrCounter');
  if (counter) counter.textContent = (safeIdx + 1) + ' / ' + CHAT_SRCS.length;
  lockBody();
  overlay.classList.add('active');
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.add('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.add('mc-nav--hidden'); document.body.classList.add('mc-nav-hidden'); }
  const lbXBtn = document.getElementById('lbX');
  if (lbXBtn) { lbXBtn.style.opacity = '0'; lbXBtn.style.transform = 'scale(0.5)'; lbXBtn.style.pointerEvents = 'none'; setTimeout(() => { lbXBtn.style.opacity = '1'; lbXBtn.style.transform = 'scale(1)'; lbXBtn.style.pointerEvents = ''; }, 500); }
  /* r15: a11y — focus trap + ESC-to-close for the review lightbox */
  if (window._trapFocus) { if (window._chatLbTrapRelease) window._chatLbTrapRelease(); window._chatLbTrapRelease = window._trapFocus(overlay); }
  setTimeout(function(){ if (lbXBtn) try { lbXBtn.focus(); } catch(e){} }, 120);
  if (!window._chatLbEscBound) {
    window._chatLbEscBound = function(e){
      var ov = document.getElementById('lbOverlay');
      if (e.key === 'Escape' && ov && ov.classList.contains('active')) {
        var x = document.getElementById('lbX'); if (x) x.click();
        if (window._chatLbTrapRelease) { window._chatLbTrapRelease(); window._chatLbTrapRelease = null; }
      }
    };
    document.addEventListener('keydown', window._chatLbEscBound);
  }
}

// ══════════════════════════════════════════
// REVIEWS MODAL
// ══════════════════════════════════════════
function openReviewsModal(tab) {
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const modal = document.getElementById('reviewsModal');
  if (!modal) return;
  if (modal.classList.contains('open')) return;
  lockBody();
  requestAnimationFrame(() => { modal.classList.add('open'); });
  switchReviewsTab(tab || 'yandex');
  document.addEventListener('keydown', handleReviewsEscape);
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.add('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.add('mc-nav--hidden'); document.body.classList.add('mc-nav-hidden'); }
}

function closeReviewsModal() {
  const modal = document.getElementById('reviewsModal');
  if (!modal) return;
  if (!modal.classList.contains('open')) return;
  modal.classList.remove('open');
  document.removeEventListener('keydown', handleReviewsEscape);
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.remove('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }
  var _unlocked = false;
  var _unlockFallback = setTimeout(function() { if (!_unlocked) { _unlocked = true; unlockBody(); } }, 500);
  modal.addEventListener('transitionend', function handler() { modal.removeEventListener('transitionend', handler); if (!_unlocked) { _unlocked = true; clearTimeout(_unlockFallback); unlockBody(); } });
}

function handleReviewsEscape(e) { if (e.key === 'Escape') closeReviewsModal(); }

function switchReviewsTab(tab) {
  const yList = document.getElementById('reviewsYandex'), gList = document.getElementById('reviewsGoogle');
  const tY = document.getElementById('tabYandex'), tG = document.getElementById('tabGoogle'), link = document.getElementById('reviewsExternalLink');
  if (!yList || !gList) return;
  const isYandex = tab === 'yandex';
  yList.style.display = isYandex ? 'block' : 'none'; gList.style.display = isYandex ? 'none' : 'block';
  if (tY) tY.classList.toggle('active', isYandex); if (tG) tG.classList.toggle('active', !isYandex);
  if (link) { link.href = isYandex ? 'https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/reviews/' : 'https://maps.app.goo.gl/R3mdjxpnebUYMQES6'; link.childNodes[link.childNodes.length - 1].textContent = isYandex ? ' Все отзывы на Яндекс Картах →' : ' Все отзывы в Google Maps →'; }
  (isYandex ? yList : gList).scrollTop = 0;
}

(function() { let _sy = 0; const rm = document.querySelector('.reviews-modal'); if (!rm) return; rm.addEventListener('touchstart', e => { _sy = e.touches[0].clientY; }, { passive: true }); rm.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - _sy > 90) closeReviewsModal(); }, { passive: true }); })();

// ═══════════════════════════════════════════════════════════════════
// NEW REVIEWS SECTION — Floating thumbs + typewriter + dissolve
// ═══════════════════════════════════════════════════════════════════
const REVIEWS = [
  { text:"Все гости в восторге! Мы тоже 👍 Попросили ваш контакт 😊",                                             src: IMG_BASE + '/review_1.webp' },
  { text:"Огромное Вам благодарность за самый вкуснейший торт!!! Именинница в восторге и от вида и от вкуса!!!",  src: IMG_BASE + '/review_2.webp' },
  { text:"Вы мастер своего дела ✨ Правда очень классный торт. Настроение сразу радостное глядя на него ❤️",       src: IMG_BASE + '/review_3.webp' },
  { text:"Очень очень вкусный, понравился. Ещё будем заказывать 🙏",                                              src: IMG_BASE + '/review_4.webp' },
  { text:"Всем очень понравился торт, именинница очень довольна. Видно, что душу вложили — мы это очень ценим!",  src: IMG_BASE + '/review_5.webp' },
  { text:"Спасибо большое за чудесный тортик! Все в восторге! Очень вкусно 😍",                                    src: IMG_BASE + '/review_6.webp' },
  { text:"Вика, насколько красиво — насколько и вкусно 😋 Клиентов стало больше у Вас ❤️",                        src: IMG_BASE + '/review_7.webp' },
  { text:"Торт изумителен 🤩 Вкусно. Профессионально. Стильно. Спасибо! ❤️",                                      src: IMG_BASE + '/review_8.webp' },
];

const LAYOUTS = [
  { side:'left',  tp: 30, rot: -14 },  { side:'right', tp: 47, rot:  18 },
  { side:'left',  tp: 47, rot: -18 },  { side:'right', tp: 30, rot:  14 },
  { side:'left',  tp: 63, rot:   8 },  { side:'right', tp: 63, rot:  -8 },
  { side:'left',  tp: 82, rot: -11 },  { side:'right', tp: 82, rot:  11 },
];
const FLOATS = [
  { ax:3.5, ay:5.5, fx:.00072, fy:.00105, rA:1.8, rf:.00061, ph: 0.00 },
  { ax:4.2, ay:3.8, fx:.00091, fy:.00083, rA:2.2, rf:.00079, ph: 0.83 },
  { ax:2.8, ay:6.2, fx:.00063, fy:.00118, rA:1.5, rf:.00054, ph: 1.57 },
  { ax:5.0, ay:4.0, fx:.00108, fy:.00072, rA:2.6, rf:.00091, ph: 2.40 },
  { ax:3.2, ay:5.0, fx:.00079, fy:.00097, rA:1.9, rf:.00068, ph: 3.14 },
  { ax:4.6, ay:3.2, fx:.00097, fy:.00088, rA:2.3, rf:.00074, ph: 3.97 },
  { ax:3.0, ay:6.0, fx:.00068, fy:.00112, rA:1.6, rf:.00058, ph: 4.71 },
  { ax:4.8, ay:4.4, fx:.00085, fy:.00076, rA:2.0, rf:.00083, ph: 5.54 },
];

let cur = 0;
let STATE = 'typing';
let typeGen = 0, dissolveGen = 0, dissolved = false, zoomP = 0;
let ZOOM_IN_SPD_CUR = 0.006;
const ZOOM_IN_SPD = 0.006, ZOOM_OUT_SPD = 0.07, ZOOM_DIST = 75, WAIT_DURATION = 4000;
let waitTimer = null, typeTimer = null;
const scField = document.getElementById('scField'), trackEl = document.getElementById('track'), dotsEl = document.getElementById('dots'), stageEl = document.getElementById('stage');
const thumbs = [], arrows = [];
let reviewsGoTo = null;

if (scField && trackEl && dotsEl && stageEl) {
  trackEl.innerHTML = "";
  REVIEWS.forEach((rv, i) => {
    const lay = LAYOUTS[i];
    const th = document.createElement('div'); th.className = 'sc-thumb';
    th.style.left = '0'; th.style.top = '0'; th.style.willChange = 'transform';
    th.style.transform = `translate(${lay.side==='left' ? 5 : 75}%, ${lay.tp}%)`; th.dataset.i = i;
    const im = document.createElement('img'); im.src = rv.src; im.alt = `Отзыв ${i+1}`; im.loading='lazy';
    th.appendChild(im);
    const hint = document.createElement('div'); hint.className = 'thumb-hint';
    hint.innerHTML = `<span class="hint-text">кликни на меня</span><span class="hint-emoji">👆</span><span class="hint-text">чтобы увеличить</span>`;
    th.appendChild(hint);
    th.addEventListener('click', ()=>{ if(i !== cur) { if (!_goToBusy) goTo(i); return; } if(STATE==='waiting'||STATE==='zoom_in'||STATE==='typing') openLB(th, rv.src, i); });
    scField.appendChild(th); thumbs.push(th);
    const ar = document.createElement('div'); ar.className = 'sc-arrows';
    ar.style.left = '0'; ar.style.top = '0'; ar.style.willChange = 'transform';
    ar.innerHTML = `<div class="sc-arr sc-arr-top"></div><div class="sc-arr sc-arr-bottom"></div><div class="sc-arr sc-arr-left"></div><div class="sc-arr sc-arr-right"></div>`;
    scField.appendChild(ar); arrows.push(ar);
    const slide = document.createElement('div'); slide.className = 'review-slide' + (i===0?' active':'');
    const card = document.createElement('div'); card.className = 'review-card';
    const q = document.createElement('div'); q.className='review-q'; q.textContent='❝';
    const txt = document.createElement('p'); txt.className='review-text'; txt.dataset.full=rv.text; txt.textContent='';
    card.append(q, txt); slide.appendChild(card); trackEl.appendChild(slide);
    const dot = document.createElement('button'); dot.type = 'button'; dot.className='rev-dot'+(i===0?' on':'');
    dot.setAttribute('aria-label',`Отзыв ${i+1}`); dot.addEventListener('click',()=> { if (!_goToBusy) goTo(i); });
    dotsEl.appendChild(dot);
  });
  if (thumbs.length) thumbs[0].classList.add('is-active');
  const firstFilmItem = document.querySelector('.review-filmstrip-item');
  if (firstFilmItem) firstFilmItem.classList.add('active');
  const _cachedSlides = trackEl ? Array.from(trackEl.querySelectorAll('.review-slide')) : [];
  const _cachedDots = dotsEl ? Array.from(dotsEl.querySelectorAll('.rev-dot')) : [];
  const _cachedFilmItems = Array.from(document.querySelectorAll('.review-filmstrip-item'));

  function hideArrows(){ arrows.forEach(a => a.classList.remove('show')); thumbs.forEach(t => t.classList.remove('hint-show')); }
  function showArrows(){ arrows[cur].classList.add('show'); }
  function positionArrows(){}

  function startTypewriter(){
    if (!trackEl) return;
    const slides = trackEl.querySelectorAll('.review-slide');
    const txtEl = slides[cur].querySelector('.review-text');
    const full = txtEl.dataset.full;
    if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 768px)').matches) {
      txtEl.textContent = full;
      startWaiting();
      return;
    }
    const myGen = typeGen;
    if(typeTimer){ clearTimeout(typeTimer); typeTimer=null; }
    const CHAR_DELAY = 28, ASSEMBLE_DUR = 600;
    const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
    const segmenter = hasSegmenter ? new Intl.Segmenter('ru', { granularity: 'grapheme' }) : null;
    function segmentText(str) { if (segmenter) return [...segmenter.segment(str)].map(s => s.segment); return [...str]; }
    function escHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    const wordGroups = full.split(/( +)/);
    let html = '', letterIdx = 0;
    wordGroups.forEach(group => {
      if(!group) return;
      if(/^ +$/.test(group)){ html += group; return; }
      let wordHtml = '';
      const clusters = segmentText(group);
      clusters.forEach(ch => {
        if(/^\p{Emoji}/u.test(ch)){ wordHtml += `<span class="pl-emoji">${escHtml(ch)}</span>`; }
        else { wordHtml += `<span class="pl" data-i="${letterIdx}">${escHtml(ch)}</span>`; letterIdx++; }
      });
      html += `<span style="display:inline-block;white-space:nowrap">${wordHtml}</span>`;
    });
    txtEl.innerHTML = html;
    const totalLetters = letterIdx, totalDur = (totalLetters - 1) * CHAR_DELAY + ASSEMBLE_DUR + 100;
    const letterEls = txtEl.querySelectorAll('.pl');
    const letterData = [];
    letterEls.forEach((el, i) => {
      // Keep the review card visually anchored while its copy appears. The
      // former 60–180px random scatter made the first slide look displaced
      // when a visitor landed on #reviews during the typewriter animation.
      const fromX = 0, fromY = 6, fromR = 0, fromS = 0.985;
      const startAt = i * CHAR_DELAY;
      el.style.opacity = '0'; el.style.transform = `translate(${fromX}px, ${fromY}px) rotate(${fromR}deg) scale(${fromS})`;
      el.style.filter = `blur(${2 + Math.random()*3}px)`;
      letterData.push({ el, fromX, fromY, fromR, fromS, startAt });
    });
    const EMOJI_START_AFTER = (totalLetters - 1) * CHAR_DELAY + ASSEMBLE_DUR * 0.6, EMOJI_GAP = 180;
    const emojiEls = Array.from(txtEl.querySelectorAll('.pl-emoji'));
    const animStart = performance.now();
    function animTick(now){
      if(typeGen !== myGen) return;
      const elapsed = now - animStart;
      letterData.forEach(({ el, fromX, fromY, fromR, fromS, startAt }) => {
        const t = elapsed - startAt;
        if(t < 0) return;
        const raw = Math.min(t / ASSEMBLE_DUR, 1), ease = raw < 1 ? 1 - Math.pow(1 - raw, 3) : 1;
        el.style.opacity = String(Math.min(raw * 3, 1).toFixed(3));
        el.style.filter = `blur(${((1-raw)*3).toFixed(2)}px)`;
        el.style.transform = raw >= 1 ? 'none' : `translate(${(fromX*(1-ease)).toFixed(2)}px, ${(fromY*(1-ease)).toFixed(2)}px) rotate(${(fromR*(1-ease)).toFixed(2)}deg) scale(${(fromS+(1-fromS)*ease).toFixed(3)})`;
        if(raw >= 1){ el.style.filter='none'; el.style.opacity='1'; }
      });
      emojiEls.forEach((em, ei) => {
        const t = elapsed - (EMOJI_START_AFTER + ei * EMOJI_GAP);
        if(t < 0) return;
        const DUR = 500, p = Math.min(t / DUR, 1), scale = p < 0.6 ? (p/0.6)*1.35 : 1.35-(p-0.6)/0.4*0.35, rot = Math.sin(p * Math.PI) * 18 * (1 - p);
        em.style.opacity = String(Math.min(p * 5, 1).toFixed(3));
        em.style.transform = p >= 1 ? 'scale(1) rotate(0deg)' : `scale(${scale.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`;
      });
      const lastEmojiEnd = EMOJI_START_AFTER + (emojiEls.length - 1) * EMOJI_GAP + 500;
      const allDone = elapsed >= Math.max(totalDur, lastEmojiEnd || 0);
      if(!allDone) requestAnimationFrame(animTick);
    }
    requestAnimationFrame(animTick);
    STATE = 'zoom_in';
    const frames = totalDur / 16;
    ZOOM_IN_SPD_CUR = 1 - Math.pow(0.04, 1 / frames);
    const capturedTypeGen = typeGen;
    typeTimer = setTimeout(()=>{ if(typeGen !== capturedTypeGen) { typeTimer = null; return; } typeTimer = null; zoomP = 1; startWaiting(); }, totalDur);
  }

  function startWaiting(){
    STATE = 'waiting'; showArrows(); thumbs[cur].classList.add('hint-show');
    if(waitTimer) clearTimeout(waitTimer);
    const capturedWaitGen = typeGen;
    waitTimer = setTimeout(()=>{ if(typeGen !== capturedWaitGen) { waitTimer = null; return; } waitTimer = null; hideArrows(); STATE = 'zoom_out'; }, WAIT_DURATION);
  }

  function dissolveText(){
    const slides = trackEl.querySelectorAll('.review-slide');
    const txtEl = slides[cur]?.querySelector('.review-text');
    if(!txtEl) return;
    const spans = Array.from(txtEl.querySelectorAll('.pl, .pl-emoji'));
    if(!spans.length) return;
    const SHATTER_DUR = 480, myGen = ++dissolveGen;
    const data = spans.map((el, i) => { const a = Math.random()*Math.PI*2, d = 40+Math.random()*100; return { el, delay: i*8, tx: Math.cos(a)*d, ty: Math.sin(a)*d-20, rot: (Math.random()-0.5)*90 }; });
    const start = performance.now();
    function tick(now){ if(dissolveGen !== myGen) return; const t = now - start; let done = true; for(const d of data){ const local = t - d.delay; if(local < 0){ done = false; continue; } const raw = Math.min(local/SHATTER_DUR, 1); if(raw < 1) done = false; const p = raw*raw; d.el.style.opacity = String(Math.max(0,1-raw*2)); d.el.style.filter = `blur(${(raw*4).toFixed(2)}px)`; d.el.style.transform = `translate(${(d.tx*p).toFixed(2)}px, ${(d.ty*p).toFixed(2)}px) rotate(${(d.rot*p).toFixed(2)}deg) scale(${(1-raw*0.5).toFixed(3)})`; } if(!done) requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  }

  let _goToBusy = false;
  function goTo(n, skipTypewriter){
    _goToBusy = true;
    setTimeout(() => { _goToBusy = false; }, 600);
    if (!scField || !trackEl || !dotsEl || !stageEl) return;
    const slides = _cachedSlides, dts = _cachedDots, filmItems = _cachedFilmItems;
    if(typeTimer){ clearTimeout(typeTimer); typeTimer=null; }
    if(waitTimer){ clearTimeout(waitTimer); waitTimer=null; }
    hideArrows(); typeGen++;
    const prevTxt = slides[cur]?.querySelector('.review-text');
    if (prevTxt) prevTxt.innerHTML = '';
    dissolveGen++;
    thumbs[cur].classList.remove('is-active'); slides[cur].classList.remove('active'); dts[cur].classList.remove('on');
    if (filmItems[cur]) filmItems[cur].classList.remove('active');
    cur = (n + REVIEWS.length) % REVIEWS.length; zoomP = 0; STATE = 'typing';
    ZOOM_IN_SPD_CUR = ZOOM_IN_SPD; dissolved = false;
    thumbs[cur].classList.add('is-active'); slides[cur].classList.add('active'); dts[cur].classList.add('on');
    if (filmItems[cur]) {
      filmItems[cur].classList.add('active');
      var strip = filmItems[cur].closest('.review-filmstrip') || filmItems[cur].parentElement;
      if (strip) {
        var itemRect = filmItems[cur].getBoundingClientRect(), stripRect = strip.getBoundingClientRect();
        var itemLeft = itemRect.left - stripRect.left + strip.scrollLeft, itemW = filmItems[cur].offsetWidth, stripW = strip.offsetWidth;
        var targetLeft = itemLeft - (stripW - itemW) / 2;
        if ('scrollBehavior' in document.documentElement.style) { strip.scrollTo({ left: targetLeft, behavior: 'smooth' }); }
        else { var start = strip.scrollLeft, dist = targetLeft - start, dur = 300, startT = 0; (function _filmScroll(ts) { if (!startT) startT = ts; var prog = Math.min((ts-startT)/dur, 1); strip.scrollLeft = start + dist * prog; if(prog < 1) requestAnimationFrame(_filmScroll); })(); }
      }
    }
    if(!skipTypewriter) startTypewriter(); else startWaiting();
  }

  reviewsGoTo = goTo;

  const _btnPrev = document.getElementById('btnPrev'), _btnNext = document.getElementById('btnNext');
  if (_btnPrev) _btnPrev.addEventListener('click', ()=> { if (!_goToBusy) goTo(cur-1); });
  if (_btnNext) _btnNext.addEventListener('click', ()=> { if (!_goToBusy) goTo(cur+1); });

  let tsX=0, tsY=0;
  if (trackEl) { trackEl.addEventListener('touchstart', e=>{ tsX=e.touches[0].clientX; tsY=e.touches[0].clientY; },{passive:true}); trackEl.addEventListener('touchend', e=>{ const dx=e.changedTouches[0].clientX-tsX, dy=e.changedTouches[0].clientY-tsY; if(Math.abs(dx)>Math.abs(dy)*1.4 && Math.abs(dx)>40){ if (!_goToBusy) goTo(dx<0 ? cur+1 : cur-1); } }); }

  let sectionSnapH = 0;
  function snapSectionHeight(){ const el = document.getElementById('reviews'); sectionSnapH = el ? el.offsetHeight : 0; }
  let _snapResizeTimer = null;
  window.addEventListener('resize', function() { clearTimeout(_snapResizeTimer); _snapResizeTimer = setTimeout(snapSectionHeight, 150); });
  // Ранний setTimeout(snapSectionHeight, 100) удалён: forced Layout в грязном
  // дереве давал до 390 мс после FCP (#100). Замер теперь ленивый — при первом
  // подходе к секции (loop стартует только у её IntersectionObserver).

  let cachedTrackEl = null, cachedSectionWidth = 0, cachedSectionHeight = 0, _cachedSecEl = null;
  const _sectionResizeObs = new ResizeObserver(entries => { const rect = entries[0].contentRect; cachedSectionWidth = rect.width; cachedSectionHeight = rect.height; _cachedSecEl = null; if (sectionSnapH) snapSectionHeight(); });
  let loopActive = false, loopRunning = false;

  const _revObserver = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) { loopActive = true; if (!loopRunning) loopRunning = true; requestAnimationFrame(function(t) { lastT = t; requestAnimationFrame(loop); }); }
    else { loopRunning = false; loopActive = false; }
  }, { rootMargin: '300px 0px 300px 0px', threshold: 0 });

  const _revTypeObserver = new IntersectionObserver(function(entries) { if (entries[0].isIntersecting && STATE === 'typing' && !typeTimer) { setTimeout(function() { startTypewriter(); }, 100); } }, { rootMargin: '-20% 0px -20% 0px', threshold: 0 });

  setTimeout(() => { const secEl = document.getElementById('reviews'); if (secEl) { _sectionResizeObs.observe(secEl); _revObserver.observe(secEl); _revTypeObserver.observe(secEl); } }, 100);

  let lastT=0;
  function loop(ts){
    if (!loopRunning || !loopActive) return;
    if (!sectionSnapH) snapSectionHeight();
    if (!_cachedSecEl) _cachedSecEl = document.getElementById('reviews');
    const secEl = _cachedSecEl;
    if (!secEl) { if (loopActive) requestAnimationFrame(loop); return; }
    const dt = Math.min(ts-lastT, 40); lastT = ts;
    if(STATE === 'idle'){ requestAnimationFrame(loop); return; }
    if(STATE === 'zoom_in' && (typeof lbIsOpen === 'undefined' || !lbIsOpen)){ zoomP += (1 - zoomP) * ZOOM_IN_SPD_CUR; }
    else if(STATE === 'zoom_out'){
      zoomP += (0 - zoomP) * ZOOM_OUT_SPD;
      if (!dissolved && zoomP < 0.72) { dissolved = true; dissolveText(); }
      if(zoomP < 0.02){ zoomP=0; STATE='idle'; goTo(cur+1); }
    }
    const THUMB_W = 80, THUMB_H = 108, MARGIN = 12;
    const stgOffLeft = stageEl.offsetLeft, stgOffRight = stageEl.offsetLeft + stageEl.offsetWidth;
    const secW = cachedSectionWidth || secEl.offsetWidth;
    const leftGapCenter = stgOffLeft / 2, rightGapCenter = stgOffRight + (secW - stgOffRight) / 2;
    const minL = MARGIN, maxL = (cachedSectionWidth || secEl.offsetWidth) - THUMB_W - MARGIN;
    function offsetRelTo(el, ancestor) { let top = 0, left = 0, cur = el; while (cur && cur !== ancestor) { top += cur.offsetTop; left += cur.offsetLeft; cur = cur.offsetParent; } return { top, left }; }
    const stageOff = offsetRelTo(stageEl, secEl);
    const secRect = secEl.getBoundingClientRect(), stageRect = stageEl.getBoundingClientRect();
    const cardL = stageRect.left - secRect.left, cardW = stageEl.offsetWidth;
    if (!cachedTrackEl) cachedTrackEl = stageEl.querySelector('.reviews-track') || trackEl;
    const trackEl2 = cachedTrackEl, trackRect = trackEl2.getBoundingClientRect();
    const cardCenterY = trackRect.top - secRect.top + trackRect.height / 2;
    thumbs.forEach((th, i)=>{
      const fl = FLOATS[i], lay = LAYOUTS[i], t = ts / 1000;
      const fx = Math.sin(t * fl.fx * 1000 + fl.ph) * fl.ax, fy = Math.cos(t * fl.fy * 1000 + fl.ph) * fl.ay, fr = Math.sin(t * fl.rf * 1000 + fl.ph) * fl.rA;
      const rawL = lay.side==='left' ? leftGapCenter - THUMB_W/2 : rightGapCenter - THUMB_W/2;
      const baseL = Math.max(minL, Math.min(maxL, rawL));
      const baseT = (lay.tp/100) * (sectionSnapH||secEl.offsetHeight) - THUMB_H/2;
      let px=0, py=0, pr=0;
      const isActive = (i === cur);
      const floatScale = isActive ? Math.max(0, 1 - zoomP * 2.5) : 1;
      th.style.zIndex = isActive ? '50' : '1'; arrows[i].style.zIndex = isActive ? '51' : '2';
      const ffx = fx * floatScale, ffy = fy * floatScale, ffr = fr * floatScale;
      if(isActive && zoomP > 0.001 && (STATE==='zoom_in'||STATE==='waiting'||STATE==='zoom_out')){
        const OVERLAP = 45, parkX = lay.side === 'left' ? cardL - THUMB_W + OVERLAP : cardL + cardW - OVERLAP;
        const parkY = cardCenterY - THUMB_H / 2 + 20;
        const eased = 1 - Math.pow(1 - Math.min(zoomP, 1), 3);
        px = (parkX - baseL) * eased; py = (parkY - baseT) * eased; pr = (lay.side==='left' ? 6 : -6) * eased;
      }
      let tx=0, ty=0, tr=0;
      if(isActive && STATE==='waiting'){ const vt = ts * 0.001; tx = Math.sin(vt * 23.7) * 2.2 * (0.5+0.5*Math.sin(vt*1.3)); ty = Math.cos(vt * 17.1) * 1.6 * (0.5+0.5*Math.cos(vt*0.9)); tr = Math.sin(vt * 28.3) * 1.4; }
      const finalL = baseL + ffx + px + tx, finalT = baseT + ffy + py + ty;
      th.style.transform = `translate(${finalL}px, ${finalT}px) rotate(${lay.rot + ffr + pr + tr}deg)`;
      const ar = arrows[i]; ar.style.transform = `translate(${finalL}px, ${finalT}px)`; ar.style.width = THUMB_W + 'px'; ar.style.height = THUMB_H + 'px';
    });
    if(STATE==='waiting' || (STATE==='zoom_in' && zoomP > 0.5)) positionArrows();
    if (loopActive && loopRunning) requestAnimationFrame(loop);
  }

  const lbOverlay = document.getElementById('lbOverlay'), lbBg = document.getElementById('lbBg'), lbBox = document.getElementById('lbBox');
  const lbImg = document.getElementById('lbImg'), lbX = document.getElementById('lbX'), lbArrows = document.getElementById('lbArrows');
  const lbPrevBtn = document.getElementById('lbPrev'), lbNextBtn = document.getElementById('lbNext'), lbArrCounter = document.getElementById('lbArrCounter');
  let lbIsOpen = false, lbBusy = false, fromRect = null;

  function _lbReviewNav(dir) {
    _lbReviewIdx = (_lbReviewIdx + dir + REVIEWS.length) % REVIEWS.length;
    if (!lbImg) return;
    lbImg.style.opacity = '0'; lbImg.style.transform = 'scale(0.95)';
    setTimeout(() => { const rev = REVIEWS[_lbReviewIdx]; lbImg.src = rev.src; lbImg.alt = 'Отзыв ' + (_lbReviewIdx + 1) + ': ' + rev.text; lbImg.onload = () => { lbImg.style.opacity = '1'; lbImg.style.transform = 'scale(1)'; }; }, 150);
    if (lbArrCounter) lbArrCounter.textContent = (_lbReviewIdx + 1) + ' / ' + REVIEWS.length;
  }
  if (lbPrevBtn) lbPrevBtn.addEventListener('click', () => _lbReviewNav(-1));
  if (lbNextBtn) lbNextBtn.addEventListener('click', () => _lbReviewNav(1));
  if (lbOverlay) { (function(){ let _sx = 0; lbOverlay.addEventListener('touchstart', e => { _sx = e.touches[0].clientX; }, { passive: true }); lbOverlay.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - _sx; if (Math.abs(dx) > 50) _lbReviewNav(dx < 0 ? 1 : -1); }, { passive: true }); })(); }

  function lerp(a,b,t){ return a+(b-a)*t; }

  function openLB(triggerEl, src, idx){
    if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
    closeCalcPanel();
    if(lbBusy){ lbBusy=false; lbIsOpen=false; lbOverlay.classList.remove('active'); }
    if(waitTimer){ clearTimeout(waitTimer); waitTimer=null; }
    hideArrows(); lbBusy=true; lbIsOpen=true;
    lbImg.src = src; _lbReviewIdx = typeof idx === 'number' ? idx : 0;
    lbImg.alt = 'Отзыв ' + (_lbReviewIdx + 1) + ': ' + REVIEWS[_lbReviewIdx].text;
    lbImg.style.opacity = '1'; lbImg.style.transform = 'scale(1)'; lbImg.style.transition = 'opacity 0.2s, transform 0.2s';
    if (lbArrCounter) lbArrCounter.textContent = (_lbReviewIdx + 1) + ' / ' + REVIEWS.length;
    lockBody(); lbOverlay.classList.add('active');
    if (lbX) lbX.style.pointerEvents = 'none';
    setTimeout(()=>{ if (lbX) { lbX.style.opacity = '1'; lbX.style.transform = 'scale(1)'; lbX.style.pointerEvents = ''; } }, 600);
    setTimeout(()=>{ if (lbBox) lbBox.classList.add('clickable'); lbBusy = false; }, 950);
  }

  function closeLB(){
    const overlay = document.getElementById('lbOverlay');
    if(lbBusy) return;
    if(!lbIsOpen && !(overlay && overlay.classList.contains('active'))) return;
    lbBusy=true; lbIsOpen=false;
    if (lbBox) lbBox.classList.remove('clickable');
    if (lbX) { lbX.style.opacity = '0'; lbX.style.transform = 'scale(0.5)'; lbX.style.pointerEvents = 'none'; }
    if (lbOverlay) lbOverlay.classList.remove('active');
    /* r15: release the review-lightbox focus trap on close */
    if (window._chatLbTrapRelease) { window._chatLbTrapRelease(); window._chatLbTrapRelease = null; }
    unlockBody();
    var bn = document.getElementById('bottomNav');
    if (bn) bn.classList.remove('hidden');
    var mcn = document.getElementById('mcNav');
    if (mcn) { mcn.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }
    setTimeout(()=>{ if (lbImg) lbImg.src = ''; lbBusy = false; hideArrows(); STATE = 'zoom_out'; }, 600);
  }

  if (lbBg) lbBg.addEventListener('click', closeLB);
  if (lbBox) lbBox.addEventListener('click', closeLB);
  if (lbX) lbX.addEventListener('click', closeLB);

  document.addEventListener('visibilitychange', () => { if (document.hidden && lbBusy) lbBusy = false; });
}

// ── Calculator cart helpers ──
function updateCalcCartBadge() {
  const badge = document.getElementById('calcCartBadge');
  if (!badge) return;
  /* [r30] То же число, что в баре и шапке: количество изделий, не сумма веса. */
  const total = cartItemCount();
  badge.textContent = total;
  badge.classList.toggle('visible', total > 0);
}

function addCalcToCartOnly(btn) {
  if (addCalcToCart() === false) return;
  const badge = document.getElementById('calcCartBadge');
  if (badge) { badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); }
  const icon = btn && btn.querySelector('.calc-add-cart-icon');
  if (icon) { icon.style.transform = 'scale(0.8) rotate(-12deg)'; setTimeout(() => { icon.style.transform = ''; }, 300); }
  const cartBtn = document.getElementById('calcOpenCartBtn');
  if (cartBtn) { cartBtn.style.transform = 'translateY(-3px) scale(1.15)'; setTimeout(() => { cartBtn.style.transform = ''; }, 350); }
}

function addCalcToCart() {
  const cfg = CAKE_CONFIGS[_cakeType] || CAKE_CONFIGS.biscuit;
  const typeToProduct = { biscuit: { id: 1, mode: 'regular' }, bento: { id: 2, mode: 'regular' }, bentomaxi: { id: 2, mode: 'maxi' }, cake3d: { id: 3, mode: 'regular' } };
  const mapping = typeToProduct[_cakeType];
  if (!mapping) return;
  const { id, mode } = mapping;
  const p = products.find(x => x.id === id);
  const fillEl = document.querySelector('#' + cfg.fillGroup + ' .selected .opt-label');
  const decorEl = document.querySelector('#calcDecor .selected .opt-label');
  const fillName = fillEl ? fillEl.textContent.trim() : '';
  const decorName = decorEl ? decorEl.textContent.trim() : '';
  // [r35] Бенто/Макси Бенто: бисквит покупатель выбирает прямо здесь, поэтому
  // он входит в ключ позиции (иначе два разных торта становились одной строкой).
  const biscuit = (id === 2) ? (window._calcBiscuit === 'choco' ? 'choco' : 'vanilla') : '';
  // [r18] buildCartKey — единый формат для всех
  const cartKey = buildCartKey(id, mode, !!(p && p.hasMaxi), fillName, decorName, biscuit);
  const qty = cfg.fixedPrice !== null ? _calcQty : _calcWeight;
  if (cart[cartKey] && cart[cartKey].mode === mode) {
    if (!addCartQty(cart[cartKey], qty, mode === 'maxi' ? p.maxiVariant : p)) return false;
  } else { cart[cartKey] = { qty, mode }; }
  cart[cartKey].fill = fillName; cart[cartKey].decor = decorName;
  // [r31] Доплата за декор и выбранный бисквит живут в строке корзины:
  // иначе корзина и сообщение считают одну базовую цену, а калькулятор
  // показывает другую (см. updateCartUI/buildMessage).
  const decorPriceEl = document.querySelector('#calcDecor .selected');
  const decorAdd = calcDecorSurcharge(_cakeType, decorPriceEl);
  cart[cartKey].decorAdd = Number.isFinite(decorAdd) && decorAdd > 0 ? decorAdd : 0;
  if (biscuit) cart[cartKey].biscuit = biscuit;
  updateCartUI();
  saveCartToStorage();
}

// ── Public API — all functions on window for HTML onclick ──
window.addToCart = addToCart;
window.buildTG = buildTG;
window.buildWA = buildWA;
window.changeQty = changeQty;
window.clearCart = clearCart;
window.closeCart = closeCart;
window.closeFillPopup = closeFillPopup;
window.closeLightbox = closeLightbox;
window.closeMobileMenu = closeMobileMenu;
window.closeReviewsModal = closeReviewsModal;
window.confirmFillSelection = confirmFillSelection;
window.goBackToCart = goBackToCart;
window.goToFormStep = goToFormStep;
window.enforceSingleSelected = enforceSingleSelected;
window.selectCakeType = selectCakeType;
window.addCalcToCart = addCalcToCart;
window.addCalcToCartAnimated = addCalcToCartOnly;
window.addCalcToCartOnly = addCalcToCartOnly;
window.updateCalcCartBadge = updateCalcCartBadge;
window.stepQty = stepQty;
window.goSlide = goSlide;
window.goTo = function(n, skipTypewriter) { if (typeof reviewsGoTo === 'function') return reviewsGoTo(n, skipTypewriter); };
window.scrollToProduct = scrollToProduct;
window.lbNavigate = lbNavigate;
window.navigateToStep = navigateToStep;
window.navigateFill = navigateFill;
window.openCart = openCart;
window.openChatLightbox = openChatLightbox;
window.openLightbox = openLightbox;
window.openReviewsModal = openReviewsModal;
window.removeFromCart = removeFromCart;
window.selectOpt = selectOpt;
window.sendFormWA = sendFormWA;
window.showBentoWeightToast = showBentoWeightToast;
window.sliderStep = sliderStep;
window.stepWeight = stepWeight;
window.switchBentoTab = switchBentoTab;
window.switchReviewsTab = switchReviewsTab;
window.closeCalcPanel = closeCalcPanel;
window.toggleCalcPanel = toggleCalcPanel;

// Инициализируем бейдж
if (typeof updateCalcCartBadge === 'function') {
  if (document.readyState !== 'loading') updateCalcCartBadge();
  else document.addEventListener('DOMContentLoaded', updateCalcCartBadge);
}

})();

// ══════════════════════════════════════════════════════════════
// Calc result magnetic parallax — REMOVED 2026-11-16 (owner: the
// magnetic cursor-follow is distracting and costs jank; premium
// hover glints stay CSS-only).
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// [UI-2026-11-16] Mobile price dock — idle until relevant (owner:
// it must not sit on the first screen with an unasked price; it
// appears once the calculator area comes into play). Pure class
// toggle: `body.mc-dock-idle` hides the fixed strip until reveal.
// ══════════════════════════════════════════════════════════════
(function initMobileCalcDock() {
  var col = document.getElementById('calcRightCol');
  if (!col) return;
  var mq = window.matchMedia ? window.matchMedia('(max-width: 560px)') : null;
  // [r27] Высота дока меняется от контента и ширины экрана. Пишем её в
  // --mc-dock-h, чтобы кнопка «наверх» вставала ровно над панелью.
  function syncDockHeight() {
    var h = Math.round(col.getBoundingClientRect().height);
    if (h > 0 && String(h) !== col._mcDockH) {
      col._mcDockH = String(h);
      document.body.style.setProperty('--mc-dock-h', h + 'px');
    }
  }
  function reveal() {
    if (!document.body.classList.contains('mc-dock-idle')) return;
    document.body.classList.remove('mc-dock-idle');
    document.body.classList.add('mc-dock-shown');
    syncDockHeight();
  }
  function sync() {
    if (!mq) return;
    if (mq.matches && !document.body.classList.contains('mc-dock-shown')) {
      document.body.classList.add('mc-dock-idle');
    } else if (!mq.matches) {
      document.body.classList.remove('mc-dock-idle');
    }
  }
  sync();
  syncDockHeight();
  window.addEventListener('resize', syncDockHeight, { passive: true });
  window.addEventListener('orientationchange', function () { setTimeout(syncDockHeight, 250); }, { passive: true });
  // [r29] Высота дока меняется не только от ширины экрана: раскрытие сметы,
  // подгрузка шрифта и смена текста цены тоже её двигают. Слушаем сам элемент
  // (один наблюдатель, без scroll-обработчиков и замеров на каждом кадре).
  if (typeof ResizeObserver === 'function') {
    try { new ResizeObserver(syncDockHeight).observe(col); } catch (err) {}
  }
  // Возврат из bfcache: классы и высота могли устареть.
  window.addEventListener('pageshow', function (e) {
    if (e && e.persisted) { sync(); syncDockHeight(); }
  });
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
  }
  // Reveal only when it is meaningful (owner: "5 600 before we chose
  // anything is noise"): the first real interaction with the calculator,
  // anything added to the cart, or keyboard focus reaching the dock.
  // [r29] Ревеал — только осмысленное действие: выбор типа/веса/начинки/декора,
  // степпер, добавление в корзину, клавиатура. Случайный клик по пустому месту
  // калькулятора цену больше не показывает.
  var HOT = '.calc-opt, .calc-type-card, .calc-biscuit-opt, .calc-stepper-btn, .calc-add-btn, .btn-add, #calcOpenCartBtn, #calcCollapsedBar';
  function engaged(e) {
    return e.target && e.target.closest && e.target.closest(HOT);
  }
  document.addEventListener('click', function (e) { if (engaged(e)) reveal(); }, { passive: true, capture: true });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.closest && (e.target.closest(HOT) || e.target.closest('.calc-wrap'))) reveal();
  }, { passive: true, capture: true });
  // …keyboard focus reaching the dock (a11y: never trap focus in limbo)…
  document.addEventListener('focusin', function (e) {
    if (e.target && e.target.closest && e.target.closest('#calcRightCol')) reveal();
  }, true);
  // [2026-11-16r17] Владелец: док висел поверх отзывов и перекрывал тексты.
  // Теперь он живёт только пока калькулятор на экране.
  var host = col.closest('section') || col.closest('.fillings') || col.parentElement;
  if (host && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        document.body.classList.toggle('mc-dock-out', !entry.isIntersecting);
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
    io.observe(host);
  }
})();

// ══════════════════════════════════════════════════════════════
// [UI-2026-11-16] Hero messengers on phones: plain large brand
// glyphs, no ring circles (owner). Desktop ring/flat design and
// hover motion stay untouched — this only paints inline overrides
// when the phone breakpoint matches. Inline !important is required
// to beat the protected R9/R10 stylesheet flags.
// ══════════════════════════════════════════════════════════════
(function bareMobileMessengers() {
  if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return;
  function paint() {
    document.querySelectorAll('.hero-actions .btn-hero-messenger').forEach(function (b) {
      b.style.setProperty('border', 'none', 'important');
      b.style.setProperty('background', 'transparent', 'important');
      b.style.setProperty('box-shadow', 'none', 'important');
    });
    document.querySelectorAll('.hero-actions .btn-hero-messenger svg').forEach(function (s) {
      // [r22] Исходные брендовые SVG (48-unit viewBox, без колец). Все три
      // глифа уже приведены к одному размеру в разметке, поэтому масштаб общий.
      s.style.setProperty('transform', 'scale(1.7)', 'important');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();
})();

// ══════════════════════════════════════════════════════════════
// MOBILE ENHANCEMENTS
// ══════════════════════════════════════════════════════════════
(function() {
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) return;

  function vibe(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }

  document.addEventListener('touchstart', function(e) {
    var t = e.target;
    if (t.closest('.btn-primary, .btn-primary--hero')) { vibe([8, 30, 10]); return; }
    if (t.closest('.btn-hero-messenger')) { vibe(7); return; }
    if (t.closest('.bottom-nav-item--order')) { vibe([8, 25, 8]); return; }
    if (t.closest('.bottom-nav-item')) { vibe(5); return; }
    if (t.closest('.btn-add, .cart-add-btn, .cart-confirm-btn, [onclick*="addToCart"], [onclick*="openCart"]')) { vibe([8, 40, 8]); return; }
    if (t.closest('.product-card, .catalog-nav-item')) { vibe(6); return; }
    if (t.closest('.calc-opt')) { vibe(5); return; }
    if (t.closest('.review-card, .map-review-item')) { vibe(4); return; }
    if (t.closest('.faq-question, .about-compact summary, details summary')) { vibe(6); return; }
    if (t.closest('.slide-img img, .gallery-img, .photo-thumb')) { vibe([5, 20, 5]); return; }
    if (t.closest('[onclick*="buildWA"], [onclick*="buildTG"], .btn-wa, .send-order')) { vibe([8, 30, 10, 30, 15]); return; }
  }, { passive: true });

  // ── Filmstrip scroll discoverability ──
  (function() {
    if (window.innerWidth > 600) return;
    var filmstrip = document.querySelector('.review-filmstrip'), filmwrap = document.querySelector('.review-filmstrip-wrap');
    if (!filmstrip || !filmwrap) return;
    filmstrip.addEventListener('scroll', function() { filmwrap.classList.toggle('at-end', filmstrip.scrollLeft + filmstrip.clientWidth >= filmstrip.scrollWidth - 8); }, { passive: true });
    var nudgeDone = false;
    var io = new IntersectionObserver(function(entries) { if (nudgeDone) return; if (!entries[0].isIntersecting) return; nudgeDone = true; io.disconnect(); setTimeout(function() { if (filmstrip.scrollLeft > 0) return; filmstrip.scrollTo({ left: 56, behavior: 'smooth' }); setTimeout(function() { filmstrip.scrollTo({ left: 0, behavior: 'smooth' }); }, 540); }, 700); }, { threshold: 0.5 });
    io.observe(filmstrip);
  })();

  // ── Gyroscope parallax ──
  var heroBg = document.getElementById('heroPhotoBg');
  if (heroBg && window.DeviceOrientationEvent) {
    var baseGamma = null, baseBeta = null, curX = 0, curY = 0, targetX = 0, targetY = 0, rafId = null, MAX_SHIFT = 14;
    var gyroActive = false, heroInView = false;
    var lastAnimTs = 0;
    var needsGyroPermission = typeof window.DeviceOrientationEvent.requestPermission === 'function';
    var gyroPermissionGranted = !needsGyroPermission;
    function lerp(a,b,t){ return a+(b-a)*t; }
    function stopParallax(resetTransform) {
      lastAnimTs = 0;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (resetTransform) {
        baseGamma = null; baseBeta = null;
        curX = 0; curY = 0; targetX = 0; targetY = 0;
        heroBg.style.transform = '';
      }
    }
    function animateParallax(ts) {
      rafId = null;
      if (!heroInView || document.hidden) { lastAnimTs = 0; return; }
      if (!ts) ts = performance.now();
      var dt = lastAnimTs ? Math.min(64, ts - lastAnimTs) : 16.67;
      lastAnimTs = ts;
      /* Frame-rate-independent damping: 0.06 per 60fps frame, so settle time is wall-clock stable. */
      var k = 1 - Math.pow(0.94, dt / 16.67);
      curX = lerp(curX, targetX, k);
      curY = lerp(curY, targetY, k);
      if (Math.abs(targetX-curX) < 0.05) curX = targetX;
      if (Math.abs(targetY-curY) < 0.05) curY = targetY;
      heroBg.style.transform = 'translate('+curX.toFixed(2)+'px,'+curY.toFixed(2)+'px) scale(1.06)';
      if (Math.abs(targetX-curX) >= 0.05 || Math.abs(targetY-curY) >= 0.05) rafId = requestAnimationFrame(animateParallax);
    }
    function scheduleParallax() {
      if (!heroInView || document.hidden || rafId) return;
      if (Math.abs(targetX-curX) < 0.05 && Math.abs(targetY-curY) < 0.05) return;
      lastAnimTs = 0;
      rafId = requestAnimationFrame(animateParallax);
    }
    function onOrientation(e) {
      if (baseGamma === null) { baseGamma = e.gamma || 0; baseBeta = e.beta || 0; }
      var dg = Math.max(-25, Math.min(25, (e.gamma||0)-baseGamma));
      var db = Math.max(-20, Math.min(20, (e.beta||0)-baseBeta));
      targetX = -(dg/25)*MAX_SHIFT;
      targetY = -(db/20)*(MAX_SHIFT*0.6);
      scheduleParallax();
    }
    function syncGyroListener() {
      var shouldListen = heroInView && !document.hidden && gyroPermissionGranted;
      if (shouldListen && !gyroActive) {
        window.addEventListener('deviceorientation', onOrientation, { passive: true });
        gyroActive = true;
      } else if (!shouldListen && gyroActive) {
        window.removeEventListener('deviceorientation', onOrientation);
        gyroActive = false;
      }
    }
    if (needsGyroPermission) {
      var heroSection = document.getElementById('home');
      if (heroSection) {
        heroSection.addEventListener('touchstart', function startGyro() {
          window.DeviceOrientationEvent.requestPermission().then(function(state) {
            gyroPermissionGranted = state === 'granted';
            syncGyroListener();
          }).catch(function() { gyroPermissionGranted = false; syncGyroListener(); });
        }, { once: true, passive: true });
      }
    }
    var observedHero = document.getElementById('home');
    if (observedHero) {
      var heroObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          heroInView = entry.isIntersecting;
          if (!heroInView) stopParallax(true);
          syncGyroListener();
        });
      }, { threshold: 0.1 });
      heroObserver.observe(observedHero);
    }
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) stopParallax(true);
      syncGyroListener();
    });
  }
  // ── Pull-to-refresh ──
  var PTR_THRESHOLD = 65, PTR_MAX = 80, ptrActive = false, ptrStartY = 0, ptrCurrent = 0, ptrBusy = false;
  var ptrIndicator = null, ptrSpinner = null, ptrLabel = null;
  function _ensurePtrIndicator() {
    if (ptrIndicator) return;
    ptrIndicator = document.createElement('div'); ptrIndicator.id = 'ptrIndicator';
    ptrIndicator.style.cssText = 'position:fixed;top:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:center;gap:8px;transform:translateY(-56px);transition:none;z-index:460;pointer-events:none;will-change:transform';
    ptrIndicator.innerHTML = '<div id="ptrSpinner" style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(201,147,74,0.25);border-top-color:#c9934a;flex-shrink:0"></div><span id="ptrLabel" style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.06em;font-family:Jost,sans-serif;text-transform:uppercase">Потяни ещё</span>';
    document.body.appendChild(ptrIndicator); ptrSpinner = document.getElementById('ptrSpinner'); ptrLabel = document.getElementById('ptrLabel');
    var spinStyle = document.createElement('style'); spinStyle.textContent = '@keyframes ptrSpin{to{transform:rotate(360deg)}} .ptr-spinning{animation:ptrSpin 0.65s linear infinite!important}'; document.head.appendChild(spinStyle);
  }
  function setPtrPos(dy) { var d = Math.min(dy, PTR_MAX); var progress = d / PTR_THRESHOLD; ptrIndicator.style.transform = 'translateY('+(d-56)+'px)'; ptrIndicator.style.background = 'rgba(28,20,16,'+Math.min(progress*0.85,0.85)+')'; ptrLabel.textContent = d >= PTR_THRESHOLD ? 'Отпусти' : 'Потяни ещё'; ptrSpinner.style.opacity = Math.min(progress,1); if (d >= PTR_THRESHOLD) ptrSpinner.classList.add('ptr-spinning'); else ptrSpinner.classList.remove('ptr-spinning'); }
  function ptrRelease(dy) { ptrActive = false; document.body.style.overscrollBehaviorY = ''; if (dy >= PTR_THRESHOLD && !ptrBusy) { ptrBusy = true; setPtrPos(PTR_MAX); ptrSpinner.classList.add('ptr-spinning'); ptrLabel.textContent = 'Обновляем...'; vibe([8,40,8]); /* [r34] «Обновлено» показываем только если кто-то реально взял обновление на себя (ptr:refresh с preventDefault). Иначе — честный перезапуск страницы: раньше плашка успевала соврать «✓ Обновлено» за 1.5 с до reload. */ setTimeout(function() { var ev = new CustomEvent('ptr:refresh', { bubbles: true, cancelable: true }); if (document.dispatchEvent(ev)) { ptrSpinner.classList.remove('ptr-spinning'); ptrLabel.textContent = '✓ Обновлено'; ptrIndicator.style.transition = 'transform 0.4s ease, background 0.4s ease'; ptrIndicator.style.transform = 'translateY(-56px)'; ptrIndicator.style.background = 'transparent'; setTimeout(function() { ptrIndicator.style.transition = 'none'; ptrBusy = false; }, 500); return; } window.location.reload(); }, 600); } else { ptrIndicator.style.transition = 'transform 0.3s ease, background 0.3s ease'; ptrIndicator.style.transform = 'translateY(-56px)'; ptrIndicator.style.background = 'transparent'; setTimeout(function() { ptrIndicator.style.transition = 'none'; }, 350); } }
  document.addEventListener('touchstart', function(e) { if (ptrBusy) return; var sy = window.scrollY; if (sy > 16 || sy < 0) return; _ensurePtrIndicator(); if (document.body.classList.contains('cart-open')||document.body.classList.contains('fill-open')||document.body.classList.contains('menu-open')) return; var _lb = document.getElementById('lightbox'); if (_lb && _lb.classList.contains('open')) return; var _rm = document.getElementById('reviewsModal'); if (_rm && _rm.classList.contains('open')) return; ptrStartY = e.touches[0].clientY; ptrCurrent = 0; ptrActive = true; document.body.style.overscrollBehaviorY = 'none'; }, { passive: true });
  document.addEventListener('touchmove', function(e) { if (!ptrActive) return; var dy = e.touches[0].clientY - ptrStartY; if (dy < 0) { ptrActive = false; document.body.style.overscrollBehaviorY = ''; return; } ptrCurrent = dy; setPtrPos(dy * 0.55); }, { passive: true });
  document.addEventListener('touchend', function() { if (!ptrActive) return; ptrRelease(ptrCurrent * 0.55); }, { passive: true });
})();

// ── Fill tooltips ──
(function initFillTooltips() {
  const ARROW_SVG = '<svg class="fill-tooltip-arrow" width="18" height="10" viewBox="0 0 18 10" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 18,0 9,10" fill="#3d2b1f"/></svg>';
  let hideTimer = null, activeTip = null;
  /* [r32] Подсказка начинки/декора — только информация: `pointer-events:none`.
     Пока JS ставил `all`, панель 220px перехватывала клики по соседней опции
     (замер: клик по «Авторский декор» попадал в подсказку «Базовый»). */
  function showTip(tip, opt) { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } if (activeTip && activeTip !== tip) { activeTip.style.opacity = '0'; activeTip.style.pointerEvents = 'none'; } activeTip = tip; const r = opt.getBoundingClientRect(); let left = r.left + r.width/2 - 110; let top = r.top - 14; left = Math.max(8, Math.min(left, window.innerWidth - 228)); tip.style.left = left+'px'; tip.style.top = top+'px'; tip.style.transform = 'translateY(-100%) translateY(-4px)'; tip.style.opacity = '1'; tip.style.pointerEvents = 'none'; }
  function hideTip(tip, delay) { hideTimer = setTimeout(() => { tip.style.opacity = '0'; tip.style.pointerEvents = 'none'; if (activeTip === tip) activeTip = null; hideTimer = null; }, delay || 120); }
  function bindTooltips() { document.querySelectorAll('.calc-opt').forEach(opt => { if (opt._tooltipBound) return; opt._tooltipBound = true; const tip = opt.querySelector('.fill-tooltip'); if (!tip) return; /* [r34] Кэш описания — до любого переноса/удаления: .fill-tooltip уезжает в body (иначе его режет overflow), а у бенто и 3D вообще удаляется. Без кэша opt.querySelector('.fill-tooltip') уже null и состав теряется. */ var _tipStrong = tip.querySelector('strong'); opt._fillDesc = tip.textContent.replace(_tipStrong ? _tipStrong.textContent : '', '').replace(/\s+/g, ' ').trim(); if (opt.closest('#calcFillBento, #calcFill3d')) { tip.remove(); return; } if (!tip.querySelector('.fill-tooltip-arrow')) { tip.insertAdjacentHTML('beforeend', ARROW_SVG); } document.body.appendChild(tip); tip.style.opacity = '0'; tip.style.pointerEvents = 'none'; opt.addEventListener('mouseenter', () => showTip(tip, opt)); opt.addEventListener('mousemove', () => showTip(tip, opt)); opt.addEventListener('mouseleave', () => hideTip(tip, 120)); tip.addEventListener('mouseenter', () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } }); tip.addEventListener('mouseleave', () => hideTip(tip, 80)); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindTooltips); else bindTooltips();
})();

// ── Content block helpers ──
function selectBiscuit(el, type) { document.querySelectorAll('#calcBiscuitSeg .calc-biscuit-opt').forEach(o => o.classList.remove('active')); el.classList.add('active'); window._calcBiscuit = type; try { localStorage.setItem("milovicake_biscuit", type); } catch(e){} /* r29: bug #5 */ }
window.selectBiscuit = selectBiscuit;

function cbFlavor(id, btn) { document.querySelectorAll('.cb-fp').forEach(p => p.classList.remove('cb-on')); document.querySelectorAll('.cb-ftab').forEach(t => t.classList.remove('cb-on')); const el = document.getElementById('cb-'+id); if (el) el.classList.add('cb-on'); if (btn) btn.classList.add('cb-on'); }
function cbFaq(item) { const isOpen = item.classList.contains('cb-open'); document.querySelectorAll('.cb-faq-item.cb-open').forEach(i => i.classList.remove('cb-open')); if (!isOpen) item.classList.add('cb-open'); }
window.cbFlavor = cbFlavor; window.cbFaq = cbFaq;

// ── Gold stars burst ──
(function() {
  'use strict';
  var CHARS = ['★','✦','✧','⋆','·','✶'];
  var COLORS = ['rgba(245,219,160,1)','rgba(201,147,74,1)','rgba(255,235,185,1)','rgba(212,167,106,1)','rgba(255,245,210,0.9)'];
  var style = document.createElement('style');
  style.textContent = '@keyframes goldStarFly{0%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1;}60%{opacity:0.8;}100%{transform:translate(var(--sx),var(--sy)) scale(0) rotate(var(--sr));opacity:0;}}.gold-star{position:fixed;pointer-events:none;z-index:99998;font-style:normal;line-height:1;animation:goldStarFly var(--sd) cubic-bezier(.25,.46,.45,.94) forwards;will-change:transform,opacity;}';
  document.head.appendChild(style);
  function burst(cx, cy) { /* [r34] prefers-reduced-motion: декоративный залп отключаем целиком, кнопка остаётся рабочей. */ try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {} var count = 18; for (var i = 0; i < count; i++) { (function(i) { var delay = Math.random() * 80; setTimeout(function() { var el = document.createElement('span'); el.className = 'gold-star'; var angle = (i/count)*360+(Math.random()-0.5)*28; var rad = angle*Math.PI/180; var dist = 38+Math.random()*40; var sx = Math.cos(rad)*dist; var sy = Math.sin(rad)*dist-(Math.random()*18+8); var size = 10+Math.random()*8; var dur = (0.75+Math.random()*0.45)+'s'; var rot = (Math.random()-0.5)*200+'deg'; var color = COLORS[Math.floor(Math.random()*COLORS.length)]; var char = CHARS[Math.floor(Math.random()*CHARS.length)]; el.style.cssText = 'left:'+(cx-size/2)+'px;top:'+(cy-size/2)+'px;font-size:'+size+'px;color:'+color+';--sx:'+sx+'px;--sy:'+sy+'px;--sd:'+dur+';--sr:'+rot+';'; el.textContent = char; document.body.appendChild(el); var ms = parseFloat(dur)*1000+100; setTimeout(function() { if(el.parentNode) el.remove(); }, ms); }, delay); })(i); } }
  function bindStars(el) { if (el._goldStarBound) return; el._goldStarBound = true; var _lastTouch = 0; el.addEventListener('touchstart', function(e) { _lastTouch = Date.now(); var t = e.touches[0]; burst(t.clientX, t.clientY); }, { passive: true }); /* [r34] После тапа браузер всё равно шлёт click — без окна тишины звёзды вспыхивали дважды (36 частиц вместо 18). */ el.addEventListener('click', function(e) { if (!e.isTrusted) return; if (Date.now() - _lastTouch < 600) return; burst(e.clientX, e.clientY); }); }
  function init() { var mcOrder = document.querySelector('.mc-btn--order'); if (mcOrder) bindStars(mcOrder); var bnOrder = document.querySelector('.bottom-nav-item--order'); if (bnOrder) bindStars(bnOrder); var heroBtn = document.querySelector('.btn-primary--hero'); if (heroBtn) bindStars(heroBtn); var calcBtn = document.querySelector('.calc-add-btn'); if (calcBtn) bindStars(calcBtn); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  (function waitForMcOrder() { var attempts = 0; function check() { var mcOrder = document.querySelector('.mc-btn--order'); if (mcOrder && !mcOrder._goldStarBound) { bindStars(mcOrder); return; } if (++attempts < 20) setTimeout(check, 500); } setTimeout(check, 1000); })();
})();

// ══════════════════════════════════════════════════════════════
// PATCH R11 — a11y hardening
// ══════════════════════════════════════════════════════════════
(function r11InteractiveA11y(){
  'use strict';
  var SELECTOR = ['.calc-opt','.calc-biscuit-opt','.calc-result-collapsed','.cb-faq-item','.faq-item','.cart-step','.dot','[onclick]:not(a):not(button):not(input):not(textarea):not(select):not(.cart-overlay):not([id$="Overlay"]):not([class*="overlay"])'].join(',');
  function labelFor(el) { if (!el) return 'Интерактивный элемент'; if (el.getAttribute('aria-label')) return el.getAttribute('aria-label'); var text = (el.textContent||'').replace(/\s+/g,' ').trim(); if (text) return text.slice(0,120); if (el.classList && el.classList.contains('dot')) return 'Перейти к слайду'; return 'Интерактивный элемент'; }
  function enhance(root) { root = root || document; if (!root.querySelectorAll) return; root.querySelectorAll(SELECTOR).forEach(function(el) { if (el.matches('a,button,input,textarea,select')) return; if (!el.hasAttribute('role')) el.setAttribute('role','button'); if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0'); if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label',labelFor(el)); if (el.classList && (el.classList.contains('calc-opt')||el.classList.contains('calc-biscuit-opt')||el.classList.contains('cart-step'))) el.setAttribute('aria-pressed',el.classList.contains('selected')||el.classList.contains('active')?'true':'false'); }); }
  function syncPressed(el) { if (!el||!el.classList) return; var group = null; if (el.classList.contains('calc-opt')||el.classList.contains('calc-biscuit-opt')) group = el.parentElement; if (el.classList.contains('cart-step')) group = el.parentElement; var nodes = group ? group.querySelectorAll('[role="button"]') : [el]; Array.prototype.forEach.call(nodes,function(n){ if (n.classList&&(n.classList.contains('calc-opt')||n.classList.contains('calc-biscuit-opt')||n.classList.contains('cart-step'))) n.setAttribute('aria-pressed',n.classList.contains('selected')||n.classList.contains('active')?'true':'false'); }); }
  function init() { enhance(document); document.addEventListener('keydown',function(e){ var el = e.target&&e.target.closest?e.target.closest(SELECTOR):null; if(!el||el.matches('a,button,input,textarea,select')) return; /* [r31] У .calc-opt и .calc-type-card есть свой inline onkeydown — синтетический click отсюда выполнял выбор ДВАЖДЫ (двойной updateCalc и двойное открытие шторки). */ if(el.hasAttribute('onkeydown')) return; if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.click(); setTimeout(function(){syncPressed(el);},0); } }); document.addEventListener('click',function(e){ var el = e.target&&e.target.closest?e.target.closest(SELECTOR):null; if(el) setTimeout(function(){syncPressed(el);},0); },true); if('MutationObserver' in window){ var mo = new MutationObserver(function(muts){ muts.forEach(function(m){ m.addedNodes&&Array.prototype.forEach.call(m.addedNodes,function(node){ if(node.nodeType===1){ if(node.matches&&node.matches(SELECTOR)) enhance({querySelectorAll:function(){return[node];}}); enhance(node); } }); }); }); mo.observe(document.documentElement,{childList:true,subtree:true}); } }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
