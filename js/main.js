(function () {
  'use strict';

/* ═══════════════════════════════════════════════════════
   MILOVI CAKE — Общий JavaScript
   
   В HTML страниц перед подключением этого файла объявите:
   
   Главная:    <script>var IMG_BASE = 'img';</script>
   Пригороды:  <script>var IMG_BASE = '../../img';</script>
═══════════════════════════════════════════════════════ */

// ── THEME ENGINE — [UI-1 Dark Mode] ──
// Запускаем ДО рендера чтобы не было flash of wrong theme
(function initTheme() {
  var saved       = (function(){ try { return localStorage.getItem('mc_theme'); } catch(e){ return null; } })();
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme       = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

function toggleTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var next   = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('mc_theme', next); } catch(e){}
}
window.toggleTheme = toggleTheme;

// ── FILLS DATA (по типу позиции) ──
const FILLS = {
  biscuit: ['Микс ягод 🍓', 'Белый сникерс', 'Сникерс', 'Ферреро', 'Воздушный поцелуй', 'Ванильная вишня', 'Ванильные тропики', 'Ванильные облака', 'Вишня в шоколаде', 'Шоколадный микс ягод', 'Красный бархат', 'Супер-Шоколад'],
  bento: ['Микс ягод 🍓', 'Карамель с орехами', 'Карамель с вафлями', 'Малина', 'Вишня'],
  cake3d: ['Молочная девочка', 'Медовик', 'Молочная девочка + сливочный крем'],
};

// [JS-2 FIX] Читаем начинки через поле fillGroup в данных продукта —
// не через магические p.id. Смена порядка продуктов теперь безопасна.
function getFillsForProduct(p) {
  return FILLS[p.fillGroup] || [];
}

// ── buildCartKey: единственная точка формирования ключа корзины ──
// Используется в addCalcToCart и в setCartItemFill при смене начинки.
function buildCartKey(numId, mode, hasMaxi, fillName, decorName) {
  const fillKey  = fillName  ? `:${fillName}`  : '';
  const decorKey = decorName ? `:${decorName}` : '';
  if (hasMaxi) return `${numId}:${mode}${fillKey}${decorKey}`;
  return fillKey ? `${numId}${fillKey}${decorKey}` : String(numId);
}

function setCartItemFill(oldCartKey, fill) {
  const entry = cart[oldCartKey];
  if (!entry) return;

  const newFill = fill || '';
  const numId   = parseInt(oldCartKey);
  const p       = products.find(x => x.id === numId);

  // [CART-1 FIX] Пересчитываем ключ с новой начинкой.
  // Если ключ изменился — перемещаем запись, чтобы избежать
  // слияния с другими позициями при следующем добавлении той же начинки.
  const newKey = p
    ? buildCartKey(numId, entry.mode || 'regular', !!p.hasMaxi, newFill, entry.decor || '')
    : oldCartKey;

  if (newKey !== oldCartKey) {
    if (cart[newKey]) {
      // Уже есть позиция с этой начинкой — суммируем количество
      const maxQty = p && p.unit === 'кг' ? (p.maxiVariant ? 5 : 20) : 20;
      cart[newKey].qty = Math.min(
        Math.round((cart[newKey].qty + entry.qty) * 10) / 10,
        maxQty
      );
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

// ── DATA ──
const products = [
  { id: 1, name: 'Бисквитный торт', fillGroup: 'biscuit', desc: 'Воздушный торт с нежнейшим кремом и авторским декором', min: 'Заказ от 2 кг, декор рассчитывается отдельно', price: 'от 2 800 ₽/кг', priceNum: 2800, unit: 'кг', minKg: 2, emoji: '🎂',
    slides: [IMG_BASE + '/cake_biscuit_0.webp', IMG_BASE + '/cake_biscuit_1.webp', IMG_BASE + '/cake_biscuit_2.webp', IMG_BASE + '/cake_biscuit_3.webp', IMG_BASE + '/cake_biscuit_4.webp', IMG_BASE + '/cake_biscuit_5.webp'],
    slidePos: ['center 30%', 'center 25%', 'center 20%', 'center 30%', 'center 20%', 'center 25%'] },
  { id: 2, name: 'Бенто торт', fillGroup: 'bento', desc: 'Миниатюрный торт — идеальный подарок для особенного момента', min: '', price: '1 600 ₽', priceNum: 1600, unit: 'шт', emoji: '🍰',
    slides: [IMG_BASE + '/bento_1.webp', IMG_BASE + '/bento_2.webp', IMG_BASE + '/bento_4.webp'],
    slidePos: ['60% 50%', 'center 5%', 'center 40%'],
    slideScale: [1.4, 1, 1],
    hasMaxi: true,
    maxiVariant: {
      name: 'Макси Бенто',
      desc: 'Увеличенный бенто торт — больше радости, больше вкуса',
      price: 'от 3 000 ₽/кг',
      priceNum: 3000,
      unit: 'кг',
      minKg: 1,
      slides: [IMG_BASE + '/bento_maxi.webp'],
      slidePos: ['center 40%'],
      slideScale: [1]
    }
  },
  { id: 3, name: '3D Торт', fillGroup: 'cake3d', desc: 'Уникальный дизайнерский торт с объёмными элементами', min: 'Заказ от 3 кг', price: '5 000 ₽/кг', priceNum: 5000, unit: 'кг', minKg: 3, emoji: '✨',
    slides: [IMG_BASE + '/cake_3d.webp', IMG_BASE + '/cake_3d_2.webp'],
    slidePos: ['center 30%', 'center 10%'],
    slideScale: [1, 1] },
  { id: 4, name: 'Меренговый рулет', desc: 'Хрустящая меренга с нежным кремом — наш фирменный десерт', min: '', price: '2 500 ₽/шт', priceNum: 2500, unit: 'шт', emoji: '🥐',
    slides: [IMG_BASE + '/meringue_roll.webp', IMG_BASE + '/meringue_roll_2.webp', IMG_BASE + '/meringue_roll_3.webp', IMG_BASE + '/meringue_roll_4.webp', IMG_BASE + '/meringue_roll_5.webp', IMG_BASE + '/meringue_roll_6.webp'],
    slidePos: ['center 35%', 'center 40%', 'center 35%', 'center 30%', 'center 25%', 'center 30%'] },
  { id: 5, name: 'Пирожное "Павлова"', minQty: 2, desc: 'Воздушная меренга с кремом и начинкой из ягод', min: 'Заказ от 2 шт', price: '350 ₽/шт', priceNum: 350, unit: 'шт', emoji: '🍓',
    slides: [IMG_BASE + '/pavlova.webp', IMG_BASE + '/pavlova_2.webp', IMG_BASE + '/pavlova_3.webp'],
    slidePos: ['center 55%', 'center 45%', 'center 50%'] },
  { id: 6, name: 'Капкейки', minQty: 6, desc: 'Набор изящных капкейков с разными вкусами', min: 'Заказ от 6 шт одного вкуса', price: '350 ₽/шт', priceNum: 350, unit: 'шт', emoji: '🧁',
    slides: [IMG_BASE + '/cupcakes.webp', IMG_BASE + '/cupcakes_2.webp'],
    slidePos: ['center 35%', 'center 40%'] },
];

// cart: { [id]: { qty: number } }  — for kg-products qty is in kg (step 0.5)
let cart = {};

const slideTimers = {};

function renderCatalog() {
  Object.values(slideTimers).forEach(id => clearInterval(id));
  Object.keys(slideTimers).forEach(k => delete slideTimers[k]);

  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  grid.innerHTML = products.map(p => {
    let imgHtml;
    if (p.slides && p.slides.length) {
      const totalSlides = p.slides.length;
      imgHtml = `
        <div class="slider-wrap" id="slider-${p.id}">
          ${p.slides.map((src, i) => {
            const active = i === 0 ? ' active' : '';
            return `<div class="slide-img${active}">
              <img src="${src}" alt="${p.name}" width="600" height="800" loading="lazy" decoding="async" onerror="this.closest('.slide-img').innerHTML='<div class=\\'slide-img-fallback\\'>${p.emoji || '🎂'}</div>'" />
            </div>`;
          }).join('')}
          ${totalSlides > 1 ? `
            <button type="button" class="slide-btn slide-prev" onclick="sliderStep('${p.id}',-1,${totalSlides})" aria-label="Предыдущее фото — ${p.name}">&#8249;</button>
            <button type="button" class="slide-btn slide-next" onclick="sliderStep('${p.id}',1,${totalSlides})" aria-label="Следующее фото — ${p.name}">&#8250;</button>
            <div class="slide-dots">${p.slides.map((_,i) => `<span class="dot${i===0?' active':''}" onclick="goSlide('${p.id}',${i})"></span>`).join('')}</div>
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

    const pillHtml = '';

    return `
    <div class="product-card reveal" id="card-${p.id}">
      ${imgHtml}
      <div class="product-info">
        ${titleHtml}
        ${pillHtml}
        <p class="desc" id="desc-${p.id}">${p.desc}</p>
        <p class="min-order" id="min-${p.id}">${p.min || '\u00a0'}</p>
        <div class="product-footer">
          <span class="price" id="price-${p.id}">${p.price}</span>
          <button type="button" class="btn-add" onclick="addToCart(${p.id}, event)">Добавить в корзину</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Auto-slide — останавливается при наведении мыши
  products.forEach(p => {
    if (p.slides && p.slides.length > 1) {
      let cur = 0;

      function startTimer() {
        stopTimer();
        slideTimers[p.id] = setInterval(() => {
          if (document.hidden) return;
          cur = (cur + 1) % p.slides.length;
          goSlide(p.id, cur);
        }, 3000);
      }

      function stopTimer() {
        if (slideTimers[p.id]) {
          clearInterval(slideTimers[p.id]);
          delete slideTimers[p.id];
        }
      }

      startTimer();

      // Пауза при наведении — никаких резких переключений
      setTimeout(() => {
        const wrap = document.getElementById('slider-' + p.id);
        if (wrap) {
          wrap.addEventListener('mouseenter', () => {
            stopTimer();
            // Синхронизируем cur с реальным активным слайдом
            cur = sliderCurrentIdx[p.id] || 0;
          });
          wrap.addEventListener('mouseleave', () => {
            cur = sliderCurrentIdx[p.id] || 0;
            startTimer();
          });
        }
        addSliderTouch(p.id, p.slides.length);
      }, 100);
    }
  });

  observeReveal();
  initPriceGlowObserver();
}

function goSlide(pid, idx) {
  const wrap = document.getElementById('slider-' + pid);
  if (!wrap) return;
  sliderCurrentIdx[pid] = idx;
  const slides = wrap.querySelectorAll('.slide-img');
  slides.forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  wrap.querySelectorAll('.dot').forEach((el, i) => el.classList.toggle('active', i === idx));
}

const sliderCurrentIdx = {};

function sliderStep(pid, dir, total) {
  const current = sliderCurrentIdx[pid] || 0;
  const next = (current + dir + total) % total;
  sliderCurrentIdx[pid] = next;
  goSlide(pid, next);
  // Reset auto-slide timer — but only if mouse is not currently over the slider
  if (slideTimers[pid]) { clearInterval(slideTimers[pid]); delete slideTimers[pid]; }
  const wrap = document.getElementById('slider-' + pid);
  if (total > 1 && wrap && !wrap.matches(':hover')) {
    slideTimers[pid] = setInterval(() => {
      if (document.hidden) return;
      sliderCurrentIdx[pid] = ((sliderCurrentIdx[pid] || 0) + 1) % total;
      goSlide(pid, sliderCurrentIdx[pid]);
    }, 3000);
  }
}

// ── CALCULATOR STATE & CONFIG (must be before initApp to avoid TDZ) ──
let _calcWeight = 2;
let _calcQty = 1;
let _cakeType = 'biscuit'; // biscuit | bento | bentomaxi | cake3d

// Конфиги типов тортов
const CAKE_CONFIGS = {
  biscuit:   { weightMin: 2, weightMax: 10, weightStep: 0.5, hasWeight: true,  hasQty: false, pricePerKg: 2800, fixedPrice: null, fillGroup: 'calcFill' },
  bento:     { weightMin: 1, weightMax: 1,  weightStep: 1,   hasWeight: false, hasQty: true,  pricePerKg: null, fixedPrice: 1600, fillGroup: 'calcFillBento' },
  bentomaxi: { weightMin: 3, weightMax: 5,  weightStep: 0.5, hasWeight: false, hasQty: true,  pricePerKg: null, fixedPrice: 3000, fillGroup: 'calcFillBento' },
  cake3d:    { weightMin: 3, weightMax: 15, weightStep: 0.5, hasWeight: true,  hasQty: false, pricePerKg: 5000, fixedPrice: null, fillGroup: 'calcFill3d'   },
};

// ── PRODUCT SLIDER TOUCH SWIPE ──
function addSliderTouch(pid, total) {
  const wrap = document.getElementById('slider-' + pid);
  if (!wrap || wrap._touchBound) return;
  wrap._touchBound = true;
  let startX = 0;
  wrap.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    wrap._wasSwiped = false;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 40) return;
    wrap._wasSwiped = true;
    const dots = wrap.querySelectorAll('.dot');
    let cur = 0;
    dots.forEach((d, i) => { if (d.classList.contains('active')) cur = i; });
    const next = dx < 0 ? (cur + 1) % total : (cur - 1 + total) % total;
    goSlide(pid, next);
    if (slideTimers[pid]) {
      clearInterval(slideTimers[pid]);
      let c = next;
      slideTimers[pid] = setInterval(() => { if (document.hidden) return; c = (c + 1) % total; goSlide(pid, c); }, 3000);
    }
    // Reset swipe flag after click event fires
    setTimeout(() => { wrap._wasSwiped = false; }, 300);
  }, { passive: true });
}

// ── BENTO TAB SWITCHER ──
// Track current bento mode per product
const bentoModes = {};

function switchBentoTab(pid, mode) {
  const p = products.find(x => x.id === pid);
  if (!p || !p.hasMaxi) return;

  bentoModes[pid] = mode;
  const isMaxi = mode === 'maxi';
  const variant = isMaxi ? p.maxiVariant : p;

  // Show weight toast on mobile
  showBentoWeightToast(isMaxi ? '~1100 гр' : '~350 гр');

  // Update active title span
  const tabReg  = document.getElementById('tab-regular-' + pid);
  const tabMaxi = document.getElementById('tab-maxi-' + pid);
  if (tabReg)  tabReg.classList.toggle('active', !isMaxi);
  if (tabMaxi) tabMaxi.classList.toggle('active', isMaxi);

  // Update text fields (desc, min, price — name is handled by tabs)
  const descEl  = document.getElementById('desc-' + pid);
  const minEl   = document.getElementById('min-' + pid);
  const priceEl = document.getElementById('price-' + pid);
  if (descEl)  descEl.textContent  = variant.desc;
  if (minEl)   minEl.textContent   = variant.min || '\u00a0';
  if (priceEl) priceEl.textContent = variant.price;

  // Update images
  const wrap = document.getElementById('slider-' + pid);
  if (wrap) {
    const slides = variant.slides;
    const positions = variant.slidePos || slides.map(() => 'center center');
    const scales = variant.slideScale || slides.map(() => 1);

    // Clear current slides
    const existingSlides = wrap.querySelectorAll('.slide-img');
    existingSlides.forEach(el => el.remove());
    const dotsEl = wrap.querySelector('.slide-dots');

    // Build new slides
    let newSlidesHtml = '';
    const variantEmoji = (isMaxi ? p.emoji : p.emoji) || '🎂';
    slides.forEach((src, i) => {
      const active = i === 0 ? ' active' : '';
      newSlidesHtml += `<div class="slide-img${active}"><img src="${src}" alt="${variant.name}" width="600" height="800" decoding="async" loading="lazy" onerror="this.closest('.slide-img').innerHTML='<div class=\\'slide-img-fallback\\'>${variantEmoji}</div>'" style="object-position:${positions[i]};transform:scale(${scales[i]});transform-origin:${positions[i]};"></div>`;
    });
    if (dotsEl) {
      dotsEl.insertAdjacentHTML('beforebegin', newSlidesHtml);
      // Update dots
      dotsEl.innerHTML = slides.map((s, i) =>
        `<span class="dot${i === 0 ? ' active' : ''}" onclick="goSlide(${pid},${i})"></span>`
      ).join('');
    }

    // Reset current index
    sliderCurrentIdx[pid] = 0;

    // Restart auto-slide timer — только если мышь не над слайдером
    if (slideTimers[pid]) { clearInterval(slideTimers[pid]); delete slideTimers[pid]; }
    if (slides.length > 1 && !wrap.matches(':hover')) {
      slideTimers[pid] = setInterval(() => {
        if (document.hidden) return;
        sliderCurrentIdx[pid] = ((sliderCurrentIdx[pid] || 0) + 1) % slides.length;
        goSlide(pid, sliderCurrentIdx[pid]);
      }, 3000);
    }

    // [P-3 FIXED] addSliderTouch guards with _touchBound — old handler has stale `total`
    // from the previous variant. Reset flag so addSliderTouch rebinds with new slide count.
    wrap._touchBound = false;
    addSliderTouch(pid, slides.length);
  }
}

// ── LOCALSTORAGE CART ──
function saveCartToStorage() {
  try { localStorage.setItem('milovicake_cart', JSON.stringify(cart)); } catch(e) {}
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('milovicake_cart');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(key => {
        const numId = parseInt(key); // works for "2", "2:maxi", "2:regular"
        if (products.find(p => p.id === numId)) {
          cart[key] = parsed[key];
          if (parsed[key].mode) {
            bentoModes[numId] = parsed[key].mode;
          }
        }
      });
    }
  } catch(e) {}
}

// ── Confetti burst ──
function confettiBurst(x, y) {
  // [C-4 FIXED] Was creating exactly 1 particle — now creates 14 for a proper burst.
  var now = Date.now();
  if (confettiBurst._last && now - confettiBurst._last < 400) return;
  confettiBurst._last = now;
  const colors = ["#c9934a", "#d4a76a", "#e8c080", "#f5e1c0", "#fff"];
  for (let i = 0; i < 14; i++) {
    const particle = document.createElement("div");
    const size = Math.random() * 6 + 4;
    particle.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
      pointer-events: none;
      z-index: 100000;
    `;
    document.body.appendChild(particle);
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 100 + 50;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 80;
    particle.animate([
      { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
      { transform: `translate(${vx}px, ${vy + 120}px) rotate(${Math.random()*720}deg) scale(0)`, opacity: 0 }
    ], {
      duration: 800 + Math.random() * 400,
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    }).onfinish = () => particle.remove();
  }
}

function addToCart(id, e) {
  let p = products.find(x => x.id === id);
  const mode = (p && p.hasMaxi && bentoModes[id] === 'maxi') ? 'maxi' : 'regular';
  // Use composite key so бенто and макси бенто are separate cart items
  const cartKey = (p && p.hasMaxi) ? `${id}:${mode}` : String(id);

  if (p && p.hasMaxi && mode === 'maxi') {
    p = { ...p, ...p.maxiVariant };
  }
  if (!cart[cartKey]) {
    const defaultQty = p.unit === 'кг' ? (p.minKg || 1) : (p.minQty || 1);
    cart[cartKey] = { qty: defaultQty, mode, dessertType: 'base' };
  } else {
    const step = p.unit === 'кг' ? 0.5 : 1;
    cart[cartKey].qty = Math.round((cart[cartKey].qty + step) * 10) / 10;
  }
  updateCartUI();
  saveCartToStorage();
  if (e) confettiBurst(e.clientX, e.clientY);
}

// [P-8 FIXED] Guard against double-click: track IDs currently being removed.
const _removingCartIds = new Set();
function removeFromCart(id) {
  if (_removingCartIds.has(String(id))) return; // already in-flight
  _removingCartIds.add(String(id));
  // Анимируем удаление одного элемента
  const items = document.querySelectorAll('.cart-item');
  // Primary: find by data-cart-id attribute (fast, reliable)
  let targetEl = null;
  items.forEach(el => {
    if (el.dataset.cartId == id) { targetEl = el; return; }
    // Fallback: legacy onclick-based lookup
    if (!targetEl && el.querySelector(`[onclick="removeFromCart(${id})"]`)) targetEl = el;
  });
  if (targetEl) {
    targetEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease, max-height 0.3s ease 0.1s, margin 0.3s ease 0.1s, padding 0.3s ease 0.1s';
    targetEl.style.opacity = '0';
    targetEl.style.transform = 'translateX(30px)';
    targetEl.style.maxHeight = targetEl.offsetHeight + 'px';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        targetEl.style.maxHeight = '0';
        targetEl.style.marginBottom = '0';
        targetEl.style.paddingTop = '0';
        targetEl.style.paddingBottom = '0';
      });
    });
    setTimeout(() => {
      delete cart[id];
      _removingCartIds.delete(String(id));
      updateCartUI();
      saveCartToStorage();
    }, 350);
  } else {
    delete cart[id];
    _removingCartIds.delete(String(id));
    updateCartUI();
    saveCartToStorage();
  }
}

function clearCart() {
  // Показываем inline-подтверждение вместо системного confirm()
  const body = document.getElementById('cartBody');
  if (!body) return;

  // Если уже показан попап — не дублировать
  if (document.getElementById('cartClearConfirm')) return;

  const confirm = document.createElement('div');
  confirm.id = 'cartClearConfirm';
  confirm.style.cssText = `
    position: absolute; inset: 0;
    background: rgba(245,240,232,0.96);
    backdrop-filter: blur(4px);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 20px; z-index: 10;
    border-radius: inherit;
    animation: fadeInUp 0.2s ease;
  `;
  confirm.innerHTML = `
    <div style="font-size:36px">🗑️</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--brown);text-align:center">
      Очистить корзину?
    </div>
    <div style="display:flex;gap:12px">
      <button type="button" id="cartClearNo" style="
        background: none; border: 1.5px solid var(--cream-dark);
        border-radius: 50px; padding: 10px 28px;
        font-family: 'Jost',sans-serif; font-size: 14px;
        color: var(--text-muted); cursor: pointer;
        transition: border-color 0.2s, color 0.2s;
      ">Нет</button>
      <button type="button" id="cartClearYes" style="
        background: var(--brown); border: none;
        border-radius: 50px; padding: 10px 28px;
        font-family: 'Jost',sans-serif; font-size: 14px;
        color: #fff; cursor: pointer;
        transition: background 0.2s;
      ">Да, очистить</button>
    </div>
  `;

  // Вставляем попап прямо в cartDrawer (он уже position:fixed — absolute дети позиционируются внутри него)
  const drawer = document.getElementById('cartDrawer');
  if (!drawer) return;
  drawer.appendChild(confirm);

  document.getElementById('cartClearNo').onclick = () => {
    confirm.style.animation = 'fadeOutDown 0.18s ease forwards';
    setTimeout(() => confirm.remove(), 180);
  };

  document.getElementById('cartClearYes').onclick = () => {
    // Анимируем исчезновение всех элементов
    const cartItems = body.querySelectorAll('.cart-item');
    cartItems.forEach((el, i) => {
      el.style.transition = `opacity 0.2s ease ${i * 50}ms, transform 0.2s ease ${i * 50}ms`;
      el.style.opacity = '0';
      el.style.transform = 'translateX(30px)';
    });

    setTimeout(() => {
      confirm.remove();
      cart = {};
      saveCartToStorage();
      setCartStep(1);
      const _cFooter = document.getElementById('cartFooter');
      const _cBody = document.getElementById('cartBody');
      if (_cFooter) _cFooter.style.display = 'none';
      if (_cBody) _cBody.style.display = '';
      updateCartUI();
    }, cartItems.length * 50 + 200);
  };
}

function changeQty(cartKey, delta) {
  // cartKey may be "2:maxi", "2:regular", or plain "1" etc.
  const numId = parseInt(cartKey);
  let p = products.find(x => x.id === numId);
  const entry = cart[cartKey];
  if (!p || !entry) return;
  if (p.hasMaxi && entry.mode === 'maxi') {
    p = { ...p, ...p.maxiVariant };
  }
  const step = p.unit === 'кг' ? 0.5 : 1;
  const minQty = p.minQty || (p.unit === 'кг' ? (p.minKg || 1) : 1);
  entry.qty = Math.round((entry.qty + delta * step) * 10) / 10;
  if (entry.qty < minQty) {
    delete cart[cartKey];
  }
  updateCartUI();
  saveCartToStorage();
}

function setCartStep(step) {
  // step 1 = items added, step 2 = filling form, step 3 = sent
  const steps = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3')
  ];
  const lines = [
    document.getElementById('stepLine1'),
    document.getElementById('stepLine2')
  ];
  if (!steps[0]) return;
  steps.forEach((s, i) => {
    if (!s) return;
    s.classList.remove('active', 'done');
    if (i + 1 < step) s.classList.add('done');
    else if (i + 1 === step) s.classList.add('active');
  });
  lines.forEach((l, i) => {
    if (l) l.classList.toggle('done', i + 1 < step);
  });
}

function updateCartUI() {
  const totalItems = Object.keys(cart).length;
  // Update ALL cart badges (header, mc-nav, any future ones)
  document.querySelectorAll('#cartBadge, [data-cart-badge]').forEach(badge => {
    badge.textContent = totalItems;
    badge.classList.toggle('visible', totalItems > 0);
  });
  const countBadge = document.getElementById('cartCountBadge');
  if (countBadge) countBadge.textContent = totalItems;

  // Синхронизируем бейдж калькулятора при любом изменении корзины
  if (typeof updateCalcCartBadge === 'function') updateCalcCartBadge();

  const clearBtn = document.getElementById('cartClearBtn');
  if (clearBtn) clearBtn.style.display = totalItems > 0 ? 'inline-flex' : 'none';

  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  if (!body) return;

  const items = Object.entries(cart);
  if (!items.length) {
    body.innerHTML = `<div class="cart-empty">
      <div style="font-size:48px;margin-bottom:16px">🧁</div>
      <div style="font-size:18px;color:var(--brown);font-family:'Cormorant Garamond',serif;margin-bottom:8px">Корзина пуста</div>
      <div style="font-size:14px;color:var(--text-muted);margin-bottom:28px">Добавьте что-нибудь вкусное!</div>
      <a href="#catalog" onclick="closeCart()" style="display:inline-flex;align-items:center;gap:8px;background:var(--gold);color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-family:'Jost',sans-serif;font-size:14px;font-weight:500;box-shadow:0 6px 20px rgba(201,147,74,0.35)">
        Перейти в каталог →
      </a>
    </div>`;
    footer.style.display = 'none';
    return;
  }

  let total = 0;
  body.innerHTML = items.map(([cartKey, entry]) => {
    const numId = parseInt(cartKey);
    let p = products.find(x => x.id === numId);
    if (!p) return '';
    if (p.hasMaxi && entry.mode === 'maxi') {
      p = { ...p, ...p.maxiVariant };
    }
    const qty = entry.qty;
    const lineTotal = p.priceNum * qty;
    total += lineTotal;

    const isKg = p.unit === 'кг';
    const qtyLabel = isKg ? `${qty} кг` : `${qty} шт.`;
    const lineTotalFmt = lineTotal.toLocaleString('ru') + ' ₽';
    const minQty = isKg ? (p.minKg || 1) : (p.minQty || 1);
    const atMin = qty <= minQty;

    const dessertType = entry.dessertType || 'base';
    const isBase = dessertType === 'base';

    // Dessert type toggle — авторский/базовый
    const dessertToggle = `
      <div style="margin-top:8px;">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:11px;color:var(--text-muted);letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;">Тип:</span>
          <button type="button" onclick="setCartItemDessertType('${cartKey}','base')"
            style="font-size:12px;font-family:'Jost',sans-serif;padding:3px 10px;border-radius:20px;border:1px solid ${isBase ? 'var(--gold)' : 'var(--cream-dark)'};background:${isBase ? 'var(--gold)' : 'transparent'};color:${isBase ? '#fff' : 'var(--text-muted)'};cursor:pointer;transition:all .2s;">
            Базовый
          </button>
          <button type="button" onclick="setCartItemDessertType('${cartKey}','author')"
            style="font-size:12px;font-family:'Jost',sans-serif;padding:3px 10px;border-radius:20px;border:1px solid ${!isBase ? 'var(--gold)' : 'var(--cream-dark)'};background:${!isBase ? 'var(--gold)' : 'transparent'};color:${!isBase ? '#fff' : 'var(--text-muted)'};cursor:pointer;transition:all .2s;">
            Авторский
          </button>
        </div>
        ${(() => {
          const fills = getFillsForProduct(p);
          if (!fills.length) return '';
          const currentFill = entry.fill || '';
          const opts = fills.map(f => `<option value="${f}" ${currentFill === f ? 'selected' : ''}>${f}</option>`).join('');
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
            <span style="font-size:11px;color:var(--text-muted);letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;">Начинка:</span>
            <select onchange="setCartItemFill('${cartKey}', this.value)"
              style="font-size:12px;font-family:'Jost',sans-serif;padding:3px 8px;border-radius:12px;border:1px solid var(--cream-dark);background:transparent;color:var(--text);cursor:pointer;flex:1;max-width:180px;">
              <option value="">— уточнить —</option>
              ${opts}
            </select>
          </div>`;
        })()}
      </div>`;

    return `
      <div class="cart-item" data-cart-id="${cartKey}">
        <div class="cart-item-info">
          <h4>${p.name}</h4>
          <div class="item-price">${p.price}</div>
          ${p.min && !entry.fill ? `<div class="item-min">${p.min}</div>` : ''}
          ${entry.decor ? `<div class="item-min" style="opacity:0.7">🎨 ${entry.decor}</div>` : ''}
          ${dessertToggle}
        </div>
        <div class="qty-ctrl">
          <button type="button" class="qty-btn" onclick="changeQty('${cartKey}', -1)" ${atMin ? 'title="Минимальный заказ"' : ''}>−</button>
          <span class="qty-val">${qtyLabel}</span>
          <button type="button" class="qty-btn" onclick="changeQty('${cartKey}', 1)">+</button>
        </div>
        <div class="cart-item-right">
          <div class="cart-line-total">${lineTotalFmt}</div>
          <button type="button" class="del-btn" onclick="removeFromCart('${cartKey}')" aria-label="Удалить">🗑</button>
        </div>
      </div>`;
  }).join('');

  const totalFmt = total.toLocaleString('ru') + ' ₽';
  const cartTotalEl = document.getElementById('cartTotal');
  if (cartTotalEl) cartTotalEl.textContent = totalFmt;

  body.innerHTML += `
    <div id="cartStep1Footer" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--cream-dark);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:15px;color:var(--brown);">Итого (предварительно):</span>
        <span class="cart-inline-total">${totalFmt}</span>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:14px;line-height:1.5;">Окончательная цена согласовывается после обсуждения декора — каждый торт индивидуален.</p>
      <button type="button" onclick="goToFormStep()" style="width:100%;background:var(--gold);color:#fff;border:none;border-radius:50px;padding:14px 24px;font-size:15px;font-family:'Jost',sans-serif;font-weight:500;cursor:pointer;box-shadow:0 6px 20px rgba(201,147,74,0.35);">
        Далее →
      </button>
    </div>`;

  footer.style.display = 'none';
}

function goToFormStep() {
  const cartFooter = document.getElementById('cartFooter');
  const cartBody = document.getElementById('cartBody');
  if (!cartFooter || !cartBody) return;
  setCartStep(2);
  cartBody.style.display = 'none';
  // [P-10 FIXED v5] Fade-in animation on step switch
  cartFooter.style.display = 'block';
  cartFooter.classList.remove('step-enter');
  void cartFooter.offsetWidth; // reflow to re-trigger animation
  cartFooter.classList.add('step-enter');
}

function buildMessage() {
  const cnameEl   = document.getElementById('cname');
  const cphoneEl  = document.getElementById('cphone');
  const cdateEl   = document.getElementById('cdate');
  const ccommentEl = document.getElementById('ccomment');

  const name    = cnameEl?.value.trim()    || '—';
  const phone   = cphoneEl?.value.trim()   || '—';
  const date    = cdateEl?.value.trim()    || '—';
  const comment = ccommentEl?.value.trim() || '—';

  if (!Object.keys(cart).length) { showToast('Корзина пуста — добавьте товар'); return null; }
  if (!phone || phone === '—') { showToast('Пожалуйста, укажите телефон'); return null; }
  // Validate phone digits (минимум 11 цифр для полного российского номера)
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 11) {
    showToast('Введите корректный номер телефона');
    if (cphoneEl) cphoneEl.focus();
    return null;
  }

  // Дата — текстовое поле, валидация не нужна

  const items = Object.entries(cart).map(([cartKey, entry]) => {
    const numId = parseInt(cartKey);
    let p = products.find(x => x.id === numId);
    if (!p) return null;
    if (p.hasMaxi && entry.mode === 'maxi') {
      p = { ...p, ...p.maxiVariant };
    }
    const qty = entry.qty;
    const label = p.unit === 'кг' ? `${qty} кг` : `${qty} шт.`;
    const dessertLabel = entry.dessertType === 'author' ? 'авторский' : 'базовый';
    let details = [`десерт: ${dessertLabel}`];
    if (entry.fill)  details.push(`начинка: ${entry.fill}`);
    // Biscuit type for bento
    if ((numId === 2) && window._calcBiscuit) {
      details.push(`бисквит: ${window._calcBiscuit === 'vanilla' ? 'ванильный' : 'шоколадный'}`);
    }
    if (entry.decor) details.push(`декор: ${entry.decor}`);
    return `• ${p.name} — ${label} (${p.price})\n  ${details.join(' · ')}`;
  }).filter(Boolean).join('\n');

  const total = Object.entries(cart).reduce((s, [cartKey, entry]) => {
    const numId = parseInt(cartKey);
    let p = products.find(x => x.id === numId);
    if (!p) return s;
    if (p.hasMaxi && entry.mode === 'maxi') {
      p = { ...p, ...p.maxiVariant };
    }
    return s + (p.priceNum || 0) * (entry.qty || 1);
  }, 0);

  return `Привет! Хочу сделать заказ 🎂\n\n${items}\n\nИтого (предварительно): ${total.toLocaleString('ru')} ₽\n⚠️ Цена предварительная — окончательная стоимость согласовывается после обсуждения декора и нюансов.\n\nИмя: ${name}\nТелефон: ${phone}\nДата: ${date}\nКомментарий: ${comment}`;
}

function buildWA(e) {
  e.preventDefault();
  const msg = buildMessage();
  if (!msg) return;
  setCartStep(3);
  const btn = document.getElementById('btnWA');
  if (btn) btn.classList.add('loading');
  setTimeout(() => {
    window.open(`https://wa.me/79119038886?text=${encodeURIComponent(msg)}`, '_blank');
    if (btn) btn.classList.remove('loading');
  }, 300);
}

function buildTG(e) {
  e.preventDefault();
  const msg = buildMessage();
  if (!msg) return;
  setCartStep(3);
  const btn = document.getElementById('btnTG');
  if (btn) btn.classList.add('loading');
  navigator.clipboard.writeText(msg).then(() => {
    showToast('Скопировано! Вставьте в чат Telegram (Ctrl+V)');
  }).catch(() => {});
  setTimeout(() => {
    window.open('https://t.me/MiloviCake', '_blank');
    if (btn) btn.classList.remove('loading');
  }, 300);
}

function sendFormWA() {
  const name = document.getElementById('fname').value.trim() || '—';
  const phone = document.getElementById('fphone').value.trim();
  const comment = document.getElementById('fcomment').value.trim() || '—';
  if (!phone) { showToast('Пожалуйста, укажите телефон'); document.getElementById('fphone').focus(); return; }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 11) { showToast('Введите корректный номер телефона'); document.getElementById('fphone').focus(); return; }
  const msg = encodeURIComponent(`Привет! 👋\nИмя: ${name}\nТелефон: ${phone}\nКомментарий: ${comment}`);
  window.open(`https://wa.me/79119038886?text=${msg}`, '_blank');
}

function navigateToStep(step) {
  const hasItems = Object.keys(cart).length > 0;
  if (!hasItems) return; // can't navigate if cart is empty

  if (step === 1) {
    goBackToCart();
  } else if (step === 2) {
    // Only go to step 2 if there are items
    goToFormStep();
  }
}

function goBackToCart() {
  const cartFooter = document.getElementById('cartFooter');
  const cartBody = document.getElementById('cartBody');
  if (!cartFooter || !cartBody) return;
  setCartStep(1);
  cartFooter.style.display = 'none';
  // [P-10 FIXED v5] Fade-in animation on step switch
  cartBody.style.display = '';
  cartBody.classList.remove('step-enter');
  void cartBody.offsetWidth; // reflow to re-trigger animation
  cartBody.classList.add('step-enter');
  updateCartUI();
}

// ── iOS-safe scroll lock ──
function lockBody() {
  var count = parseInt(document.body.dataset.lockCount || '0');
  if (count === 0) {
    var scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    // Fix: also lock <html> so iOS Safari can't scroll through it
    document.documentElement.style.overflow = 'hidden';
    // НЕ ставим touchAction:none на body — это блокирует скролл внутри drawer на iOS
    if (scrollbarW > 0) document.body.style.paddingRight = scrollbarW + 'px';
  }
  document.body.dataset.lockCount = count + 1;
}
function unlockBody() {
  var count = parseInt(document.body.dataset.lockCount || '0');
  if (count <= 0) {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.paddingRight = '';
    return;
  }
  var newCount = count - 1;
  document.body.dataset.lockCount = newCount;
  if (newCount === 0) {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.paddingRight = '';
    delete document.body.dataset.scrollY;
  }
}
window.lockBody = lockBody;
window.unlockBody = unlockBody;
// Emergency cleanup: if user navigates back (bfcache), ensure body is unlocked

// ═══════════════════════════════════════════════════════════════
// CART — Production-ready state machine
// States: 'closed' | 'opening' | 'open' | 'closing'
// Desktop: CSS-only position (fixed top-right, scroll-independent)
// Mobile: full-width right drawer + lockBody
// ═══════════════════════════════════════════════════════════════
var _cartState = 'closed';
var _cartTimer = null;

function _cartClearTimer() {
  if (_cartTimer) { clearTimeout(_cartTimer); _cartTimer = null; }
}

// Emergency reset — force cart to clean closed state
function _cartForceClose() {
    _cartClearTimer();
    var drawer = document.getElementById('cartDrawer');
    var overlay = document.getElementById('cartOverlay');
    if (drawer) { drawer.classList.remove('open', 'closing'); drawer.style.cssText = ''; }
    if (overlay) { overlay.classList.remove('open'); }
    document.body.classList.remove('cart-open');
    if (_cartState === 'open' && window.innerWidth <= 900) unlockBody();
    _cartState = 'closed';
    var bn = document.getElementById('bottomNav');
    if (bn) bn.classList.remove('hidden');
    var mcn = document.getElementById('mcNav');
    if (mcn) { mcn.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }
}

function openCart() {
  var drawer  = document.getElementById('cartDrawer');
  var overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay) return;

  closeCalcPanel();
  // Close the mobile nav sheet if open
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();

  // If mid-close, snap to closed then open fresh
  if (_cartState === 'closing') _cartForceClose();

  // Already open — nothing to do
  if (_cartState === 'open' || _cartState === 'opening') return;

  // [A11Y] Запоминаем элемент, который был в фокусе до открытия корзины
  openCart._lastFocused = document.activeElement;

  _cartClearTimer();
  _cartState = 'opening';

  // will-change только перед анимацией — экономим GPU память
  drawer.style.willChange = 'transform';

  // Clear ALL inline styles — CSS handles positioning entirely
  drawer.classList.remove('closing');
  drawer.style.cssText = '';

  // Force reflow so browser registers initial transform/opacity
  // before .open class is added (required for CSS transition to fire)
  void drawer.offsetWidth;

  drawer.classList.add('open');
  overlay.classList.add('open');
  document.body.classList.add('cart-open');

  // [A11Y] Устанавливаем ARIA-атрибуты диалога
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-hidden', 'false');
  drawer.setAttribute('aria-labelledby', 'cartDrawerTitle');

  if (window.innerWidth <= 900) lockBody();

  _cartState = 'open';
  setCartStep(1);
  updateCartUI();

  // [A11Y] Переводим фокус на кнопку закрытия после открытия
  setTimeout(function() {
    var closeBtn = drawer.querySelector('.cart-close, [aria-label="Закрыть"], [onclick="closeCart()"]');
    if (closeBtn) closeBtn.focus();
  }, 100);

  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.add('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.add('mc-nav--hidden'); document.body.classList.add('mc-nav-hidden'); }
}

function closeCart() {
  var drawer  = document.getElementById('cartDrawer');
  var overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay) return;

  // Nothing to close
  if (_cartState === 'closed' || _cartState === 'closing') return;

  // Remove scroll-close listener if exists
  if (drawer._scrollClose) {
    window.removeEventListener('scroll', drawer._scrollClose);
    drawer._scrollClose = null;
  }

  _cartClearTimer();
  _cartState = 'closing';

  drawer.classList.remove('open');
  drawer.classList.add('closing');
  overlay.classList.remove('open');
  document.body.classList.remove('cart-open');

  // [A11Y] Скрываем диалог для screen readers
  drawer.setAttribute('aria-hidden', 'true');

  if (window.innerWidth <= 900) unlockBody();

  // Delay matches CSS transition durations
  var delay = window.innerWidth > 900 ? 220 : 350;
  _cartTimer = setTimeout(function() {
    _cartTimer = null;
    drawer.classList.remove('closing');
    drawer.style.cssText = '';
    drawer.style.willChange = 'auto'; // снимаем GPU-слой после анимации
    _cartState = 'closed';

    // [A11Y] Возвращаем фокус на элемент, который был активен до открытия корзины
    if (openCart._lastFocused && typeof openCart._lastFocused.focus === 'function') {
      openCart._lastFocused.focus();
      openCart._lastFocused = null;
    }
  }, delay);

  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.remove('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }
}

function toggleCart() {
  if (_cartState === 'open' || _cartState === 'opening') closeCart();
  else openCart();
}

// [MOB-3 FIXED] Swipe-right-to-close for cart drawer on mobile.
// On mobile (≤900px) the cart slides in FROM the right (translateX animation).
// The matching dismiss gesture is therefore swipe RIGHT, not swipe down.
// Tracks touch delta X; if user drags ≥80px rightward → close.
// Live feedback: translateX follows the finger so the drawer visually follows.
// Guard: only activates when cart is fully open; ignored on desktop (>900px).
// Scroll-safe: only starts tracking after ≥8px horizontal movement is confirmed
// so vertical scrolling inside the cart body is never blocked.
(function() {
  var _swipeSX = 0;
  var _swipeSY = 0;
  var _swipeDragging = false;
  var _swipeLocked  = false; // true once we confirmed horizontal intent
  var _swipeThreshold = 80; // px rightward drag to trigger close

  var _drawer = document.getElementById('cartDrawer');
  if (!_drawer) return;

  _drawer.addEventListener('touchstart', function(e) {
    if (window.innerWidth > 900) return; // desktop uses popup, no swipe
    if (_cartState !== 'open') return;
    _swipeSX = e.touches[0].clientX;
    _swipeSY = e.touches[0].clientY;
    _swipeDragging = true;
    _swipeLocked   = false;
  }, { passive: true });

  _drawer.addEventListener('touchmove', function(e) {
    if (!_swipeDragging) return;
    var dx = e.touches[0].clientX - _swipeSX;
    var dy = e.touches[0].clientY - _swipeSY;

    // Confirm horizontal intent before locking (avoids fighting vertical scroll)
    if (!_swipeLocked) {
      if (Math.abs(dy) > Math.abs(dx)) { _swipeDragging = false; return; } // vertical — ignore
      if (Math.abs(dx) < 8) return; // not enough movement yet
      _swipeLocked = true;
      _drawer.style.transition = 'none'; // freeze CSS transition during drag
    }

    if (dx <= 0) return; // ignore leftward drag (expanding into screen)
    _drawer.style.transform = 'translateX(' + dx + 'px)';
    // Fade overlay proportionally as drawer slides away
    var overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.style.opacity = Math.max(0, 1 - dx / (_swipeThreshold * 2));
  }, { passive: true });

  _drawer.addEventListener('touchend', function(e) {
    if (!_swipeDragging) return;
    _swipeDragging = false;
    var dx = e.changedTouches[0].clientX - _swipeSX;
    var willClose = _swipeLocked && dx >= _swipeThreshold;

    // Always restore transition and clear inline transform.
    // For close: we must clear inline style BEFORE closeCart() so the class-based
    // translateX(100%) animation in .closing is not blocked by inline specificity.
    // requestAnimationFrame ensures closeCart fires after the browser has applied
    // the cleared transform in one paint cycle, eliminating the visible snap-back.
    _drawer.style.transition = '';
    _drawer.style.transform  = '';
    var overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.style.opacity = '';

    if (willClose) {
      requestAnimationFrame(function() { closeCart(); });
    }
  }, { passive: true });
})();

// Orientation change — re-evaluate lock state
window.addEventListener('orientationchange', function() {
  // [W-3 FIXED v5] Suppress hero background-image recalculation flash during rotation
  var heroEl = document.querySelector('.hero');
  if (heroEl) {
    heroEl.classList.add('hero--orient-change');
    setTimeout(function() { heroEl.classList.remove('hero--orient-change'); }, 350);
  }
  setTimeout(function() {
    if (_cartState === 'open') {
      if (window.innerWidth <= 900) lockBody();
      else unlockBody();
    }
  }, 300);
});

// bfcache restore — ensure clean state
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    closeCalcPanel();
    _cartForceClose();
    document.body.dataset.lockCount = '0';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.paddingRight = '';
    // Clean up fill popup state in case it was open when user navigated away
    if (document.body.classList.contains('fill-open-ios')) {
      document.body.classList.remove('fill-open-ios');
      document.body.style.top = '';
      document.body.style.position = '';
    }
    document.body.classList.remove('fill-open');
    var fillPopup = document.getElementById('fillPopup');
    var fillOverlay = document.getElementById('fillOverlay');
    if (fillPopup) fillPopup.classList.remove('open');
    if (fillOverlay) fillOverlay.classList.remove('open');
  }
});

/* ── Hero visibility + Parallax orbs ── */
(function() {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    window._heroVisible = false;
    var obs = new IntersectionObserver(function(entries) {
        var vis = entries[0].isIntersecting;
        hero.classList.toggle('hero--visible', vis);
        window._heroVisible = vis;
    }, { threshold: 0.05 });
    obs.observe(hero);

    if (window.innerWidth < 769) return;
    var orbs = document.querySelectorAll('.hero-orb-1, .hero-orb-2, .hero-orb-3');
    if (!orbs.length) return;
    var baseY = [0, 0, 0];
    var ticking = false;
    // [P-11 FIXED v5] Apply initial transform based on current scrollY so
    // orbs don't jump from transform:none on first scroll event.
    (function applyInitialOrbs() {
      var y = window.scrollY;
      if (orbs[0]) orbs[0].style.transform = 'translateY(' + (baseY[0] + y * 0.15) + 'px)';
      if (orbs[1]) orbs[1].style.transform = 'translateY(' + (baseY[1] + y * -0.10) + 'px)';
      if (orbs[2]) orbs[2].style.transform = 'translateY(' + (baseY[2] + y * 0.08) + 'px)';
    })();
    window.addEventListener('scroll', function() {
        if (ticking || !window._heroVisible) return;
        ticking = true;
        requestAnimationFrame(function() {
            var y = window.scrollY;
            if (orbs[0]) orbs[0].style.transform = 'translateY(' + (baseY[0] + y * 0.15) + 'px)';
            if (orbs[1]) orbs[1].style.transform = 'translateY(' + (baseY[1] + y * -0.10) + 'px)';
            if (orbs[2]) orbs[2].style.transform = 'translateY(' + (baseY[2] + y * 0.08) + 'px)';
            ticking = false;
        });
    }, { passive: true });
})();

// ── SMOOTH IMAGE FADE-IN ON LOAD ──
document.querySelectorAll('img').forEach(function(img) {
    if (img.complete || img.naturalWidth > 0) return;
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.5s ease';
    img.addEventListener('load', function() { img.style.opacity = '1'; });
    img.addEventListener('error', function() { img.style.opacity = '1'; });
    setTimeout(function() { if (img.style.opacity === '0') img.style.opacity = '1'; }, 5000);
});

// [FIX] Второй swipe-to-close обработчик удалён — конфликтовал с основным (строки 1018-1077).
// Основной обработчик уже реализует: проверку _cartState === 'open', guard против input полей,
// плавный следящий translateX, fade оверлея и порог 80px.


// [P-1 FIXED] Duplicate Escape handler removed — unified handler below covers this.

// ── CART OVERLAY CLICK-OUTSIDE (desktop: transparent overlay) ──
(function() {
  const overlay = document.getElementById('cartOverlay');
  if (!overlay) return;
  overlay.addEventListener('click', function(e) {
    const drawer = document.getElementById('cartDrawer');
    if (!drawer || drawer.contains(e.target)) return;
    if (drawer.classList.contains('open')) closeCart();
  });
})();

// [P-2 FIXED] Guard against accumulating IntersectionObservers on repeated calls.
// Elements already marked .visible or already in _revealObserved are skipped.
const _revealObserved = new WeakSet();
function observeReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible), .reveal-photo:not(.visible)');
  const threshold = window.innerWidth <= 768 ? 0.02 : 0.05;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold, rootMargin: '0px 0px 60px 0px' });
  els.forEach(el => {
    if (_revealObserved.has(el)) return; // already registered — skip
    _revealObserved.add(el);
    io.observe(el);
  });
  // Fallback: принудительно показать всё через 2.5с (на случай IO-бага в Яндекс Браузере)
  setTimeout(function() {
    document.querySelectorAll('.reveal:not(.visible), .reveal-photo:not(.visible)').forEach(function(el) {
      el.classList.add('visible');
    });
  }, 2500);
}

// ── priceGlow: включаем анимацию только когда карточка в вьюпорте ──
// Это экономит CPU — не гоняем 6 text-shadow анимаций когда каталог за экраном
// [P-4 FIXED] Store IO reference so repeated calls disconnect the stale observer
// (e.g. after renderCatalog re-runs on filter change) instead of accumulating multiple IOs.
let _priceGlowIO = null;
function initPriceGlowObserver() {
  const cards = document.querySelectorAll('.product-card');
  if (!cards.length) return;
  if (_priceGlowIO) { _priceGlowIO.disconnect(); _priceGlowIO = null; }
  _priceGlowIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      e.target.classList.toggle('in-view', e.isIntersecting);
    });
  }, { threshold: 0.1 });
  cards.forEach(c => _priceGlowIO.observe(c));
}

// [P-12 FIXED v5] Section separator: play animation only when in viewport
// CSS sets animation-play-state: paused by default; .in-view switches to running.
(function initSeparatorObserver() {
  const seps = document.querySelectorAll('.section-separator');
  if (!seps.length || typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => e.target.classList.toggle('in-view', e.isIntersecting));
  }, { threshold: 0 });
  seps.forEach(s => io.observe(s));
})();


// CATALOG NAV — мобильная навигация по десертам
// ══════════════════════════════════════════════

function renderCatalogNav() {
  const nav = document.getElementById('catalogNav');
  if (!nav) return;

  // Короткие названия для компактных кнопок
  const shortNames = {
    'Бисквитный торт': 'Бисквит',
    'Бенто торт': 'Бенто',
    '3D Торт': '3D Торт',
    'Меренговый рулет': 'Рулет',
    'Пирожное "Павлова"': 'Павлова',
    'Пирожное «Павлова»': 'Павлова',
    'Капкейки': 'Капкейки',
  };

  nav.innerHTML = products.map(p => {
    const thumbSrc = (p.slides && p.slides.length) ? p.slides[0] : '';
    const thumbHtml = thumbSrc
      ? `<div class="catalog-nav-thumb"><img src="${thumbSrc}" alt="" width="48" height="48" decoding="async" loading="lazy"></div>`
      : `<div class="catalog-nav-emoji">${p.emoji}</div>`;

    const shortName = shortNames[p.name] || p.name;
    const shortPrice = p.price.replace('от ', '').replace(' ₽/кг', '₽/кг').replace(' ₽/шт', '₽');

    return `<button class="catalog-nav-item" data-target="card-${p.id}" onclick="scrollToProduct(${p.id})" type="button" aria-label="Перейти к ${p.name}">
        ${thumbHtml}
        <span class="catalog-nav-label">${shortName}</span>
        <span class="catalog-nav-price">${shortPrice}</span>
      </button>`;
  }).join('');
}

function scrollToProduct(id) {
  const card = document.getElementById('card-' + id);
  if (!card) return;

  // [NM-19 FIXED] Was hardcoded 72px — doesn't account for Dynamic Island safe-area-top.
  // Use actual measured header height so scrolled card isn't hidden behind the header.
  const hdr = document.getElementById('siteHeader');
  const headerHeight = hdr ? hdr.offsetHeight : 72;
  const nav = document.getElementById('catalogNav');
  const navHeight = (nav && window.innerWidth <= 768) ? nav.offsetHeight + 16 : 0;
  // [NM-6/NM-14 FIXED] Account for breadcrumb on prigorody pages (~44px fixed bar)
  const breadcrumb = document.querySelector('.breadcrumb-nav');
  const breadcrumbHeight = (breadcrumb && window.innerWidth <= 768) ? breadcrumb.offsetHeight : 0;
  const offset = headerHeight + navHeight + breadcrumbHeight + 16;

  const top = card.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });

  // Подсветить активный
  document.querySelectorAll('.catalog-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.target === 'card-' + id);
  });
  setTimeout(() => {
    document.querySelectorAll('.catalog-nav-item.active').forEach(el => el.classList.remove('active'));
  }, 2000);
}

function initCatalogNavScroll() {
  if (window.innerWidth > 768) return;
  const nav = document.getElementById('catalogNav');
  if (!nav) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id; // "card-1", "card-2", etc
        document.querySelectorAll('.catalog-nav-item').forEach(el => {
          el.classList.toggle('active', el.dataset.target === id);
        });
      }
    });
  }, { threshold: 0.5, rootMargin: '-30% 0px -30% 0px' });

  products.forEach(p => {
    const card = document.getElementById('card-' + p.id);
    if (card) observer.observe(card);
  });
}

function initWaveText() {
  document.querySelectorAll('.wave-text').forEach(function(el) {
    if (el.querySelector('.w')) return;

    const frag = document.createDocumentFragment();
    Array.from(el.childNodes).forEach(function(node) {
      if (node.nodeType !== Node.TEXT_NODE) {
        frag.appendChild(node.cloneNode(true));
        return;
      }
      const parts = (node.textContent || '').split(/(\s+)/);
      parts.forEach(function(part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'w';
          span.textContent = part;
          frag.appendChild(span);
        }
      });
    });
    el.innerHTML = '';
    el.appendChild(frag);

    const words = el.querySelectorAll('.w');
    words.forEach(function(word, i) {
      word.addEventListener('mouseenter', function() {
        if (words[i - 1]) words[i - 1].classList.add('near');
        if (words[i + 1]) words[i + 1].classList.add('near');
      });
      word.addEventListener('mouseleave', function() {
        if (words[i - 1]) words[i - 1].classList.remove('near');
        if (words[i + 1]) words[i + 1].classList.remove('near');
      });
    });
  });

    // Автоволна на мобиле
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    document.querySelectorAll('.wave-text').forEach(function(el) {
        if (el._autoWaveBound) return;
        el._autoWaveBound = true;
        var spans = el.querySelectorAll('.w');
        if (spans.length < 2) return;
        function runAutoWave() {
            var i = 0, total = spans.length;
            function step() {
                spans.forEach(function(s) { s.classList.remove('w-auto', 'w-auto-near'); });
                if (i >= total) return;
                spans[i].classList.add('w-auto');
                if (i > 0) spans[i - 1].classList.add('w-auto-near');
                if (i < total - 1) spans[i + 1].classList.add('w-auto-near');
                i++;
                setTimeout(step, 480);
            }
            step();
        }
        setTimeout(function loop() {
            if (!document.hidden) runAutoWave();
            setTimeout(loop, 12000);
        }, 4000 + Math.random() * 3000);
    });
}

function initSectionTitleWords() {
  document.querySelectorAll('.section-title .ht-word, .section-title .ht-em').forEach(function(el) {
    if (el.dataset.splitInit === '1') return;
    const txt = (el.textContent || '').trim();
    if (!txt) return;
    const inheritStyle = el.getAttribute('style') || '';

    const parts = txt.split(/(\s+)/);
    el.innerHTML = parts.map(function(p) {
      if (/^\s+$/.test(p)) return p;
      return '<span class="ht-w"' + (inheritStyle ? ' style="' + inheritStyle + '"' : '') + '>' + p + '</span>';
    }).join('');
    el.dataset.splitInit = '1';
  });
}

// ── Messenger button ring → flat-label animation ──
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
    var to = toHover
      ? { ringOp: 0, ringY: -12, flatOp: 1, flatY: -10, flatSize: 12, flatGlow: 0.55 }
      : { ringOp: 1, ringY: 0,   flatOp: 0, flatY: 8,   flatSize: 6.5, flatGlow: 0 };
    var startTs = null;
    function step(ts) {
      if (!startTs) startTs = ts;
      var p = Math.min((ts - startTs) / dur, 1);
      var e = toHover ? easeOut(p) : easeInOut(p);
      state.ringOp   = from.ringOp   + (to.ringOp   - from.ringOp)   * e;
      state.ringY    = from.ringY    + (to.ringY    - from.ringY)    * e;
      state.flatOp   = from.flatOp   + (to.flatOp   - from.flatOp)   * e;
      state.flatY    = from.flatY    + (to.flatY    - from.flatY)    * e;
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
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    items.forEach(function(item) {
      var btn    = document.querySelector('.' + item.btnClass);
      if (!btn) return;
      // R15: main page uses class-based SVG text; suburb pages use ids.
      // Support both without changing the protected markup.
      var ringEl = document.getElementById(item.ringId) || btn.querySelector('.hero-ring-text, [id^="ring-text-"]');
      var flatEl = document.getElementById(item.flatId) || btn.querySelector('.hero-flat-text, [id^="flat-text-"]');
      if (!ringEl || !flatEl) return;
      var state = { ringEl: ringEl, flatEl: flatEl, ringOp: 0.5, ringY: 0, flatOp: 0, flatY: 8, flatSize: 6.5, flatGlow: 0, raf: null };
      ringEl.setAttribute('opacity', 0.5);
      ringEl.setAttribute('transform', 'translate(0,0)');
      flatEl.setAttribute('opacity', 0);
      flatEl.setAttribute('y', 8);
      flatEl.setAttribute('font-size', 6.5);
      btn.addEventListener('mouseenter', function() { runAnim(state, true,  380); });
      btn.addEventListener('mouseleave', function() { runAnim(state, false, 420); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMessengerRings);
  else initMessengerRings();

  window.addEventListener('pageshow', function(e) {
    if (e.persisted) initMessengerRings();
  });
})();

function initApp() {
  // [C-8 FIXED] Default biscuit must be set before any buildMessage() call,
  // otherwise the biscuit type is omitted from the order if user never tapped the toggle.
  if (typeof window._calcBiscuit === 'undefined') window._calcBiscuit = 'vanilla';

  renderCatalogNav();
  renderCatalog(); // calls observeReveal() internally for catalog cards
  // [P-13 FIXED v5] Was: setTimeout(wireProductLightbox, 400) — noticeable delay on fast devices.
  // requestIdleCallback runs after initial paint; rAF fallback for Safari < 17.
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(wireProductLightbox, { timeout: 500 });
  } else {
    requestAnimationFrame(function() { requestAnimationFrame(wireProductLightbox); });
  }
  loadCartFromStorage();
  updateCartUI();
  observeReveal(); // picks up static .reveal elements (hero, sections, etc.)
  setTimeout(initCatalogNavScroll, 500);

  // restore missing UI interactions
  initWaveText();
  initSectionTitleWords();

  // Enforce single selection in calc groups on init
  enforceSingleSelected('calcType');
  enforceSingleSelected('calcFill');
  enforceSingleSelected('calcDecor');

  // Инициализируем видимость строк калькулятора без анимации
  (function initCalcRows() {
    // Временно отключаем transition для всех .calc-row
    document.querySelectorAll('.calc-row').forEach(r => r.style.transition = 'none');
    // Симулируем выбор текущего типа торта
    const activeTypeCard = document.querySelector('#calcType .calc-opt.selected');
    if (activeTypeCard) {
      selectCakeType(activeTypeCard, activeTypeCard.dataset.type || 'biscuit');
    }
    // Возвращаем transition после следующего frame
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('.calc-row').forEach(r => r.style.transition = '');
    }));
  })();

  updateCalc();

  // Init fill description panel with default selected filling
  (function initFillDescPanel() {
    const panel = document.getElementById('fillDescPanel');
    const text  = document.getElementById('fillDescText');
    if (!panel || !text) return;
    const selected = document.querySelector('#calcFill .calc-opt.selected');
    if (!selected) return;
    const tooltipEl = selected.querySelector('.fill-tooltip');
    const desc = tooltipEl
      ? Array.from(tooltipEl.childNodes)
          .filter(n => !(n.nodeName === 'STRONG'))
          .map(n => n.textContent)
          .join('').trim()
      : '';
    if (desc) { text.textContent = desc; panel.style.opacity = '1'; }
  })();

  // Date min is set below (today+2) in the dedicated IIFE

  // [PERF-1 FIX] hero-orb will-change активируется только когда герой в viewport
  (function initHeroOrbWillChange() {
    const hero = document.querySelector('.hero');
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('hero--visible', e.isIntersecting));
    }, { threshold: 0 });
    io.observe(hero);
  })();

  // [UI-1] CSS-only theme sync (no JS manipulation needed for SVGs anymore)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ── PAUSE SLIDERS WHEN OFF-SCREEN (saves CPU & battery) ──
setTimeout(() => {
  const sliderIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const match = entry.target.id && entry.target.id.match(/^slider-(\d+)$/);
      if (!match) return;
      const pid = parseInt(match[1]);
      if (!entry.isIntersecting) {
        if (slideTimers[pid]) { clearInterval(slideTimers[pid]); delete slideTimers[pid]; }
      } else {
        if (!slideTimers[pid]) {
          const p = products.find(x => x.id === pid);
          if (p && p.slides && p.slides.length > 1) {
            let cur = sliderCurrentIdx[pid] || 0;
            slideTimers[pid] = setInterval(() => {
              cur = (cur + 1) % p.slides.length;
              sliderCurrentIdx[pid] = cur;
              goSlide(pid, cur);
            }, 3000);
          }
        }
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('[id^="slider-"]').forEach(el => sliderIO.observe(el));
}, 300);

// ── ОБЪЕДИНЁННЫЙ SCROLL HANDLER (один rAF на все) ──
const _scrollEl = document.getElementById('scroll-progress');
const contactsSection = document.getElementById('contacts');
const backToTopEl = document.getElementById('backToTop');
let _scrollTicking = false;

function _onScroll() {
  if (_scrollTicking) return;
  _scrollTicking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const total = document.body.scrollHeight - window.innerHeight;

    // Progress bar
    if (_scrollEl) _scrollEl.style.width = (y / total * 100) + '%';

    // Header scrolled state handled by inline script (avoids double toggle)

    // Back to top
    if (backToTopEl) backToTopEl.classList.toggle('visible', y > 600);

    _scrollTicking = false;
  });
}

window.addEventListener('scroll', _onScroll, { passive: true });


// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── ANIMATED COUNTERS ──
function animateCounter(el) {
  const target = +el.dataset.target;
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter(e.target);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px 40px 0px' });
document.querySelectorAll('.stat-num').forEach(el => counterObserver.observe(el));

// ── BURGER MENU ──
const burgerBtn = document.getElementById('burgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
function closeMobileMenu() {
  if (!burgerBtn || !mobileMenu) return;
  burgerBtn.classList.remove('open');
  mobileMenu.classList.remove('open');
  burgerBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}
if (burgerBtn && mobileMenu) {
  burgerBtn.addEventListener('click', () => {
    const isOpen = burgerBtn.classList.toggle('open');
    mobileMenu.classList.toggle('open', isOpen);
    burgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.classList.toggle('menu-open', isOpen);
  });

  // Close menu on tap outside
  document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('open') &&
        !mobileMenu.contains(e.target) &&
        !burgerBtn.contains(e.target)) {
      closeMobileMenu();
    }
  });
}

// ── LIGHTBOX ──
// ── LIGHTBOX with gallery + swipe ──
let _lbSrcs = [], _lbIdx = 0;

// Генерирует alt-текст из пути к изображению для скринридеров
function _lbAltFromSrc(src) {
  const file = (src || '').split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  return file ? 'Фото торта Milovi Cake — ' + file : 'Фото торта Milovi Cake';
}

function openLightbox(src, srcs) {
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImg');
  if (!lb || !lbImg) return;
  _lbSrcs = srcs || [src];
  // Normalize: find index by matching end of path
  _lbIdx = _lbSrcs.findIndex(s => src.endsWith(s) || s.endsWith(src) || src === s);
  if (_lbIdx < 0) _lbIdx = 0;
  lbImg.src = _lbSrcs[_lbIdx];
  lbImg.alt = _lbAltFromSrc(_lbSrcs[_lbIdx]);
  lb.classList.add('open');
  lockBody(); // iOS-safe scroll lock
  _lbUpdateArrows();
}

function lbNavigate(dir) {
  if (_lbSrcs.length < 2) return;
  _lbIdx = (_lbIdx + dir + _lbSrcs.length) % _lbSrcs.length;
  const img = document.getElementById('lightboxImg');
  if (!img) return;
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.15s';
  setTimeout(() => {
    img.src = _lbSrcs[_lbIdx];
    img.alt = _lbAltFromSrc(_lbSrcs[_lbIdx]);
    img.style.opacity = '1';
  }, 150);
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
  lb.classList.remove('open');
  unlockBody();
  _lbSrcs = []; _lbIdx = 0;
}
// [P-1 cleanup v6] Arrow handlers merged into unified keydown below — removed standalone listener

// Click on backdrop closes lightbox
(function() {
  const _lbEl = document.getElementById('lightbox');
  if (_lbEl) _lbEl.addEventListener('click', function(e) {
    if (e.target === this) closeLightbox();
  });
})();

// Swipe on lightbox
(function() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  let sx = 0;
  lb.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) lbNavigate(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

// Wire up review images
setTimeout(() => {
  const reviewImgs = Array.from(document.querySelectorAll('.review-img-wrap img'));
  const reviewSrcs = reviewImgs.map(img => img.src);
  reviewImgs.forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(img.src, reviewSrcs));
  });
}, 100);

// Wire up product card images (called after renderCatalog)
function wireProductLightbox() {
  products.forEach(p => {
    if (!p.slides || p.slides.length === 0) return;
    const wrap = document.getElementById('slider-' + p.id);
    if (!wrap || wrap._lbBound) return;
    wrap._lbBound = true;

    // Use event delegation on the wrap — works even after bento tab switches new imgs in
    wrap.addEventListener('click', (e) => {
      if (wrap._wasSwiped) return;
      const img = e.target.closest('.slide-img');
      if (!img || img.classList.contains('slide-video')) return;

      // Use sliderCurrentIdx as source of truth for active slide
      const activeIdx = (typeof sliderCurrentIdx !== 'undefined' && sliderCurrentIdx[p.id]) ? sliderCurrentIdx[p.id] : 0;

      // Get current slides list (bento may have switched to maxi)
      const mode = typeof bentoModes !== 'undefined' && bentoModes[p.id];
      const currentSlides = (mode === 'maxi' && p.maxiVariant) ? p.maxiVariant.slides : p.slides;

      openLightbox(currentSlides[activeIdx], currentSlides);
    });
  });
}

// ── CALCULATOR ── (variables declared here to avoid TDZ; functions defined later)

function selectCakeType(el, type) {
  // [C-10 FIXED] Tooltips are moved to document.body by initFillTooltips.
  // When fill rows are rebuilt on type switch the original .calc-opt elements
  // leave the DOM, but their tooltips remain in body as orphan nodes.
  // Purge any tooltip not currently inside a .calc-opt before rebuilding.
  document.querySelectorAll('.fill-tooltip').forEach(function(t) {
    if (!t.closest('.calc-opt')) t.remove();
  });

  // Снимаем selected со всех карточек типа
  document.querySelectorAll('#calcType .calc-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _cakeType = type;

  const cfg = CAKE_CONFIGS[type];

  // helper: плавно показать/скрыть строку
  function setRowVisible(el, visible) {
    if (!el) return;
    el.classList.toggle('calc-row--hidden', !visible);
  }

  // Переключаем блок веса
  const weightRow = document.getElementById('calcWeightRow');
  const qtyRow    = document.getElementById('calcQtyRow');
  setRowVisible(weightRow, cfg.hasWeight);
  setRowVisible(qtyRow, cfg.hasQty);

  // Для бенто/макси бенто — скрываем кнопки и показываем фиксированный вес
  const minus = document.getElementById('calcWeightMinus');
  const plus  = document.getElementById('calcWeightPlus');
  const fixedWeightNote = document.getElementById('calcFixedWeightNote');

  // Для bento/bentomaxi — вес в data-tip на кнопке, строку веса не показываем
  if (type === 'bento' || type === 'bentomaxi') {
    setRowVisible(weightRow, false); // скрыть строку веса полностью
  } else {
    setRowVisible(weightRow, true);
    if (minus) minus.style.display = '';
    if (plus)  plus.style.display  = '';
    const noteWrap = fixedWeightNote && fixedWeightNote.parentElement;
    if (noteWrap) noteWrap.classList.remove('visible');
    const valEl = document.getElementById('calcWeightVal');
    if (valEl) valEl.style.display = '';
    const lbl = document.getElementById('calcWeightLabel');
    if (lbl) lbl.textContent = 'Вес торта';
  }

  // Обновляем мин вес и значение
  if (cfg.hasWeight && type !== 'bento' && type !== 'bentomaxi') {
    const WEIGHT_MIN_CUR = cfg.weightMin;
    if (_calcWeight < WEIGHT_MIN_CUR) {
      _calcWeight = WEIGHT_MIN_CUR;
      const valEl = document.getElementById('calcWeightVal');
      if (valEl) valEl.textContent = _calcWeight + ' кг';
      const inp = document.getElementById('calcWeight');
      if (inp) inp.value = _calcWeight;
    }
    if (minus) minus.disabled = _calcWeight <= WEIGHT_MIN_CUR;
    if (plus)  plus.disabled  = _calcWeight >= cfg.weightMax;
  }

  // Переключаем блок начинок
  ['calcFillRow','calcFillBentoRow','calcFill3dRow'].forEach(id => {
    const row = document.getElementById(id);
    if (!row) return;
    const forTypes = row.dataset.for || '';
    setRowVisible(row, forTypes.includes(type));
  });

  // Сбрасываем selected в активном блоке начинок
  const activeGroup = document.getElementById(cfg.fillGroup);
  if (activeGroup) {
    const items = activeGroup.querySelectorAll('.calc-opt');
    items.forEach((o, i) => { o.classList.toggle('selected', i === 0); });
  }

  // Скрываем декор для бенто (там всё включено), показываем для остальных
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
  const minus = document.getElementById('calcQtyMinus');
  const plus  = document.getElementById('calcQtyPlus');
  if (minus) minus.disabled = _calcQty <= 1;
  if (plus)  plus.disabled  = _calcQty >= 20;
  updateCalc();
}

let _guestsTimer = null;
function stepWeight(dir) {
  const cfg = CAKE_CONFIGS[_cakeType] || CAKE_CONFIGS.biscuit;
  const step = cfg.weightStep || 0.5;
  const newVal = Math.round((_calcWeight + dir * step) * 10) / 10;
  if (newVal < cfg.weightMin || newVal > cfg.weightMax) return;
  _calcWeight = newVal;
  const _cwEl = document.getElementById('calcWeight');
  if (_cwEl) _cwEl.value = _calcWeight;
  const minus = document.getElementById('calcWeightMinus');
  const plus  = document.getElementById('calcWeightPlus');
  if (minus) minus.disabled = _calcWeight <= cfg.weightMin;
  if (plus)  plus.disabled  = _calcWeight >= cfg.weightMax;
  updateCalc();
}

function enforceSingleSelected(groupId) {
  const items = Array.from(document.querySelectorAll(`#${groupId} .calc-opt`));
  if (!items.length) return;
  const selected = items.filter(x => x.classList.contains('selected'));
  if (selected.length <= 1) {
    if (selected.length === 0) items[0].classList.add('selected');
    return;
  }
  selected.forEach((x, i) => i > 0 && x.classList.remove('selected'));
}

function selectOpt(el, groupId) {
  // Normalize: find closest .calc-opt even if child element was clicked
  const opt = el && el.closest ? el.closest('.calc-opt') : el;
  if (!opt) return;

  // On mobile, all fill/decor taps instantly select + show a toast preview
  const _fillGroups = ['calcFill', 'calcFillBento', 'calcFill3d', 'calcDecor'];
  if (_fillGroups.indexOf(groupId) !== -1 && window.innerWidth < 768) {
    // Instantly select
    document.querySelectorAll(`#${groupId} .calc-opt.selected`).forEach(x => x.classList.remove('selected'));
    opt.classList.add('selected');
    // Update decor hint price badge (mobile)
    if (groupId === 'calcDecor') {
      const hint = document.getElementById('calcDecorHint');
      if (hint) {
        const price = parseInt(opt.dataset.price || 0);
        hint.classList.toggle('visible', price > 0);
      }
    }
    updateCalc && updateCalc();
    // Show toast with filling info
    showFillToast(opt, groupId);
    // Rubber click animation
    const _inner = opt.querySelector('.opt-inner');
    if (_inner) {
      _inner.classList.remove('rubber-click'); void _inner.offsetWidth;
      _inner.classList.add('rubber-click');
      _inner.addEventListener('animationend', () => _inner.classList.remove('rubber-click'), { once: true });
    }
    return;
  }

  // Deselect all in group, select only this one
  document.querySelectorAll(`#${groupId} .calc-opt.selected`).forEach(x => x.classList.remove('selected'));
  opt.classList.add('selected');

  // Показываем подсказку цены авторского декора
  if (groupId === 'calcDecor') {
    const hint = document.getElementById('calcDecorHint');
    if (hint) {
      const price = parseInt(opt.dataset.price || 0);
      hint.classList.toggle('visible', price > 0);
    }
  }

  // Rubber click effect on inner wrapper only (tooltip excluded)
  const inner = opt.querySelector('.opt-inner');
  if (inner) {
    inner.classList.remove('rubber-click');
    void inner.offsetWidth;
    inner.classList.add('rubber-click');
    inner.addEventListener('animationend', () => inner.classList.remove('rubber-click'), { once: true });
  }

  // Shake only the text label, not tooltip/tag
  const label = opt.querySelector('.opt-label');
  if (label) {
    label.classList.remove('opt-label-shake');
    void label.offsetWidth;
    label.classList.add('opt-label-shake');
    label.addEventListener('animationend', () => label.classList.remove('opt-label-shake'), { once: true });
  }
  if (groupId === 'calcType') {
    const _wRow = document.getElementById('calcWeightRow');
    const _fRow = document.getElementById('calcFillRow');
    if (_wRow) _wRow.style.display = 'block';
    if (_fRow) _fRow.style.display = 'block';
  }

  // Update fill description panel (desktop only, for calcFill group)
  if (groupId === 'calcFill' || groupId === 'calcFillBento' || groupId === 'calcFill3d') {
    const panel = document.getElementById('fillDescPanel');
    const text  = document.getElementById('fillDescText');
    if (panel && text) {
      const tooltipEl = opt.querySelector('.fill-tooltip');
      const desc = tooltipEl
        ? Array.from(tooltipEl.childNodes)
            .filter(n => !(n.nodeName === 'STRONG'))
            .map(n => n.textContent)
            .join('').trim()
        : '';
      if (desc) {
        text.textContent = desc;
        panel.style.opacity = '1';
      } else {
        panel.style.opacity = '0';
      }
    }
  }

  updateCalc();
}

function updateCalc() {
  const cfg = CAKE_CONFIGS[_cakeType] || CAKE_CONFIGS.biscuit;

  // Определяем активную группу начинок
  const fillEl = document.querySelector('#' + cfg.fillGroup + ' .selected');
  const decorEl = document.querySelector('#calcDecor .selected');
  const fillPrice  = +(fillEl?.dataset.price  || 0);
  const decorPrice = (_cakeType === 'bento') ? 0 : +(decorEl?.dataset.price || 0);

  // Считаем итог
  let total;
  let noteText = 'Точная цена согласовывается при заказе';

  if (cfg.fixedPrice !== null) {
    // Бенто / Макси Бенто — фиксированная цена за штуку
    total = cfg.fixedPrice * _calcQty + fillPrice;
    noteText = 'Декор рассчитывается отдельно';
  } else {
    // Весовой торт
    const weight = _calcWeight;
    total = cfg.pricePerKg * weight + fillPrice + decorPrice;

    // Обновляем отображение веса
    const valEl = document.getElementById('calcWeightVal');
    if (valEl) valEl.textContent = weight % 1 === 0 ? weight + ' кг' : weight.toFixed(1) + ' кг';

    // Гостей — всегда видно рядом со степпером
    const guestsPopupEl = document.getElementById('guestsPopup');
    if (guestsPopupEl) {
      const n = Math.round(weight / 0.2);
      guestsPopupEl.textContent = '≈ ' + n + ' чел.';
    }

    if (decorPrice > 0) noteText = '* Стоимость авторского декора рассчитывается индивидуально';
  }

  // Для весовых тортов — показываем кол-во гостей
  const guestsPopup = document.getElementById('guestsPopup');
  if (guestsPopup && _cakeType !== 'bento' && _cakeType !== 'bentomaxi') {
    // текст уже установлен выше для весовых тортов
  }

  // 3D торт — особая пометка
  if (_cakeType === 'cake3d') noteText = 'Сложный декор рассчитывается отдельно';
  else if (_cakeType === 'bento' || _cakeType === 'bentomaxi') noteText = 'Декор рассчитывается отдельно';
  else noteText = (noteText === 'Точная цена согласовывается при заказе' ? 'Дополнительный декор рассчитывается отдельно' : noteText + '. Дополнительный декор рассчитывается отдельно');

  const isApprox = decorPrice > 0 || _cakeType === 'cake3d' || _cakeType === 'bento' || _cakeType === 'bentomaxi';
  const prefix = isApprox ? '~ ' : '';
  const calcResultEl = document.getElementById('calcResult');
  if (calcResultEl) calcResultEl.textContent = prefix + total.toLocaleString('ru') + ' ₽';

  // Sync collapsed bar price (mobile)
  const collapsedPrice = document.getElementById('calcResultCollapsed');
  if (collapsedPrice) collapsedPrice.textContent = prefix + total.toLocaleString('ru') + ' ₽';

  const calcNoteEl = document.getElementById('calcNote');
  if (calcNoteEl) calcNoteEl.textContent = noteText;

  const badge = document.getElementById('calcApproxBadge');
  if (badge) badge.classList.toggle('visible', isApprox);

  // ── Сводка выбора ──
  const summaryEl = document.getElementById('calcSummary');
  if (summaryEl) {
    const typeNames = { biscuit: 'Бисквитный', bento: 'Бенто', bentomaxi: 'Макси Бенто', cake3d: '3D Торт' };
    const typeIcons = { biscuit: '🎂', bento: '🍰', bentomaxi: '🍰', cake3d: '✨' };
    const fillName  = fillEl?.querySelector('.opt-label')?.textContent?.trim() || '';
    const decorName = decorEl?.querySelector('.opt-label')?.textContent?.trim() || '';

    let chips = [];

    // Тип торта
    chips.push({ icon: typeIcons[_cakeType], label: 'Тип', val: typeNames[_cakeType] });

    // Вес или количество
    if (cfg.hasQty && _cakeType === 'bento') {
      chips.push({ icon: '⚖️', label: 'Вес', val: '~350 гр / шт' });
      chips.push({ icon: '🔢', label: 'Количество', val: _calcQty + ' шт' });
    } else if (cfg.hasQty && _cakeType === 'bentomaxi') {
      chips.push({ icon: '⚖️', label: 'Вес', val: '~1100 гр / шт' });
      chips.push({ icon: '🔢', label: 'Количество', val: _calcQty + ' шт' });
    } else {
      const w = _calcWeight;
      const wStr = w % 1 === 0 ? w + ' кг' : w.toFixed(1) + ' кг';
      const guests = Math.round(w / 0.2);
      chips.push({ icon: '⚖️', label: 'Вес', val: wStr + ' · ~' + guests + ' чел' });
    }

    // Начинка
    if (fillName) chips.push({ icon: '🍓', label: 'Начинка', val: fillName });

    // Декор (только если не бенто)
    if (_cakeType !== 'bento' && decorName) {
      chips.push({ icon: '🎨', label: 'Декор', val: decorName });
    }

    summaryEl.innerHTML = chips.map(c =>
      `<span class="calc-summary-chip"><span class="chip-icon">${c.icon}</span>${c.label}: <span class="chip-val">${c.val}</span></span>`
    ).join('');
  }
}





// ===== Legacy reviews carousel (старый) =====
// Запускается ТОЛЬКО если на странице есть старый #reviewsTrack.
// Без этой защиты старый setInterval конфликтует с новой логикой goTo/STATE/dissolveText.
(function initLegacyReviewsCarousel() {
  const legacyTrack = document.getElementById('reviewsTrack');
  if (!legacyTrack) return; // нет старого трека — ничего не запускаем

  let currentReview = 0;

  function goReview(idx) {
    const slides = legacyTrack.querySelectorAll('.review-slide');
    const dots = document.querySelectorAll('.rev-dot');
    if (!slides.length || !dots.length) return;
    if (slides[currentReview]) slides[currentReview].classList.remove('active');
    if (dots[currentReview]) dots[currentReview].classList.remove('rev-dot-active');
    currentReview = (idx + slides.length) % slides.length;
    if (slides[currentReview]) slides[currentReview].classList.add('active');
    if (dots[currentReview]) dots[currentReview].classList.add('rev-dot-active');
  }

  function shiftReview(dir) { goReview(currentReview + dir); }

  // Auto-advance reviews every 5s — пауза при ховере и неактивной вкладке
  let reviewAutoplay = null;
  let reviewPaused = false;

  function startReviewAutoplay() {
    if (reviewAutoplay) clearInterval(reviewAutoplay);
    reviewAutoplay = setInterval(() => {
      if (!reviewPaused && !document.hidden) shiftReview(1);
    }, 5000);
  }

  function stopReviewAutoplay() {
    if (reviewAutoplay) { clearInterval(reviewAutoplay); reviewAutoplay = null; }
  }

  startReviewAutoplay();

  const reviewsCarousel = document.querySelector('.reviews-carousel');
  if (reviewsCarousel) {
    reviewsCarousel.addEventListener('mouseenter', () => { reviewPaused = true; });
    reviewsCarousel.addEventListener('mouseleave', () => { reviewPaused = false; });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopReviewAutoplay && stopReviewAutoplay();
    } else {
      startReviewAutoplay();
    }
  });

  // Touch swipe support for reviews
  let touchStartX = 0;
  legacyTrack.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  legacyTrack.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) shiftReview(dx < 0 ? 1 : -1);
  }, { passive: true });
})();



// Mobile weight toast on bento switch
let bentoToastTimer = null;
function showBentoWeightToast(text) {
  if (window.matchMedia('(hover: hover)').matches) return; // desktop uses CSS tooltip
  const toast = document.getElementById('bentoWeightToast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(bentoToastTimer);
  bentoToastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}


// ── Яндекс.Метрика ──
function loadMetrika() {
  if (window._metrikaLoaded) return;
  window._metrikaLoaded = true;
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
  (window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
  ym(106945185,'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
}

// ── Cookie banner ──
// [JS-1 FIXED v6] localStorage throws SecurityError in iOS Safari private mode and
// Firefox with strict privacy settings. All reads/writes now guarded via _lsGet/_lsSet.
function _lsGet(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
function _lsSet(key, val) { try { localStorage.setItem(key, val); } catch(e) {} }

function acceptCookie() {
  _lsSet('cookieAccepted', Date.now() + 365 * 24 * 60 * 60 * 1000);
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  banner.classList.remove('visible');
  banner.style.transform = 'translateY(100%)';
  banner.addEventListener('transitionend', () => banner.remove(), { once: true });
  // [PERF-2 FIX] Preconnect к mc.yandex.ru заранее — экономит DNS+TLS handshake (~200-400ms на 4G)
  const pc = document.createElement('link');
  pc.rel = 'preconnect';
  pc.href = 'https://mc.yandex.ru';
  document.head.appendChild(pc);
  loadMetrika();
}
function declineCookie() {
  // [COOKIE FIX] Сохраняем отказ на 30 дней — баннер не будет показываться повторно
  _lsSet('cookieAccepted', 'denied:' + (Date.now() + 30 * 24 * 60 * 60 * 1000));
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  banner.classList.remove('visible');
  banner.style.transform = 'translateY(100%)';
  banner.addEventListener('transitionend', () => banner.remove(), { once: true });
}
function initCookieBanner() {
  const stored = _lsGet('cookieAccepted');
  if (stored) {
    const isDenied  = stored.startsWith('denied:');
    const expiry    = parseInt(isDenied ? stored.slice(7) : stored);
    if (Date.now() < expiry) {
      if (!isDenied) loadMetrika(); // already accepted — load analytics
      return; // denied or accepted but not expired — skip banner
    }
  }
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  setTimeout(() => {
    banner.style.transform = 'translateY(0)';
    banner.classList.add('visible');
  }, 800);
}
initCookieBanner();

// ── Privacy modal ──
function openPrivacy() {
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const el = document.getElementById('privacyOverlay');
  if (!el) return;
  el.classList.add('open');
  if (window.innerWidth <= 900) lockBody();
}
function closePrivacy() {
  const el = document.getElementById('privacyOverlay');
  if (!el) return;
  el.classList.remove('open');
  if (window.innerWidth <= 900) unlockBody();
}

// ══════════════════════════════════════════
// ── BOTTOM SHEET: Fill info ──
// ══════════════════════════════════════════

let _fillSheetPendingEl = null;      // calc-opt element waiting to be confirmed
let _fillSheetPendingGroupId = null; // group id of the pending element

function _fillPopupRender(optEl) {
  if (!optEl) return;
  const title = optEl.querySelector('.opt-label')?.textContent?.trim() || '';
  const tooltipEl = optEl.querySelector('.fill-tooltip');
  const desc = tooltipEl
    ? Array.from(tooltipEl.childNodes)
        .filter(n => !(n.nodeName === 'STRONG'))
        .map(n => n.textContent)
        .join('').trim()
    : (optEl.dataset.desc || '');

  const tagEls = optEl.querySelectorAll('.fill-tag');
  const tagsHTML = Array.from(tagEls).map(t => {
    const cls = t.classList.contains('hit')  ? 'tag-hit'  :
                t.classList.contains('nuts') ? 'tag-nuts' : '';
    return `<span class="fill-sheet-tag ${cls}">${t.textContent.trim()}</span>`;
  }).join('');

  const _fillSheetTagsEl = document.getElementById('fillSheetTags');
  const _fillPopupTitleEl = document.getElementById('fillPopupTitle');
  const _fillPopupTextEl  = document.getElementById('fillPopupText');
  if (_fillSheetTagsEl)  _fillSheetTagsEl.innerHTML   = tagsHTML;
  if (_fillPopupTitleEl) _fillPopupTitleEl.textContent = title;
  if (_fillPopupTextEl)  _fillPopupTextEl.textContent  = desc;

  // Update counter & nav arrows
  const groupId = _fillSheetPendingGroupId || 'calcFill';
  const allOpts = Array.from(document.querySelectorAll(`#${groupId} .calc-opt`));
  const idx = allOpts.indexOf(optEl);
  const total = allOpts.length;
  const counterEl = document.getElementById('fillNavCounter');
  const prevBtn   = document.getElementById('fillNavPrev');
  const nextBtn   = document.getElementById('fillNavNext');
  if (counterEl) counterEl.textContent = total > 1 ? `${idx + 1} / ${total}` : '';
  if (prevBtn)   prevBtn.disabled  = (idx <= 0);
  if (nextBtn)   nextBtn.disabled  = (idx >= total - 1);

  // Update button text for decor group
  const selectBtn = document.getElementById('fillSheetSelect');
  if (selectBtn) {
    selectBtn.textContent = (groupId === 'calcDecor') ? 'Выбрать оформление' : 'Выбрать начинку';
  }
}

// ── Fill toast: brief confirmation snackbar after tap ──
let _fillToastTimer = null;
// ── Раскрывающаяся панель стоимости (мобильная) ──
function toggleCalcPanel() {
  if (window.innerWidth > 560) return; // только мобильный
  const col = document.getElementById('calcRightCol');
  if (!col) return;
  const isOpen = col.classList.toggle('calc-result-open');
  // [P-9 FIXED v5] Show/hide backdrop
  _setCalcBackdrop(isOpen);
}

function closeCalcPanel() {
  const col = document.getElementById('calcRightCol');
  if (col) col.classList.remove('calc-result-open');
  // [P-9 FIXED v5] Hide backdrop
  _setCalcBackdrop(false);
}

// [P-9 FIXED v5] Lazy-create backdrop and manage visibility
function _setCalcBackdrop(show) {
  if (window.innerWidth > 560) return;
  let bd = document.getElementById('calcPanelBackdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'calcPanelBackdrop';
    bd.setAttribute('aria-hidden', 'true');
    bd.addEventListener('click', closeCalcPanel);
    document.body.appendChild(bd);
  }
  bd.classList.toggle('visible', !!show);
  document.body.classList.toggle('calc-panel-open', !!show);
}

// Закрыть панель при тапе вне её
document.addEventListener('click', function(e) {
  if (window.innerWidth > 560) return;
  const col = document.getElementById('calcRightCol');
  if (!col || !col.classList.contains('calc-result-open')) return;
  if (!col.contains(e.target)) closeCalcPanel();
}, { passive: true });

// [NM-11 FIXED] Panel was staying open during page scroll, covering 340px of content.
// Closing on scroll is the expected UX (same pattern as bottom sheets everywhere).
window.addEventListener('scroll', function() {
  if (window.innerWidth > 560) return;
  const col = document.getElementById('calcRightCol');
  if (col && col.classList.contains('calc-result-open')) closeCalcPanel();
}, { passive: true });

function showFillToast(optEl, groupId) {
  // Close mobile nav sheet if it's open
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const title = optEl.querySelector('.opt-label')?.textContent?.trim() || '';
  const tooltipEl = optEl.querySelector('.fill-tooltip');
  const desc = tooltipEl
    ? Array.from(tooltipEl.childNodes)
        .filter(n => n.nodeName !== 'STRONG')
        .map(n => n.textContent).join('').trim()
    : '';

  let toast = document.getElementById('fillToast');
  if (!toast) return;

  const titleEl = toast.querySelector('.fill-toast-title');
  const descEl  = toast.querySelector('.fill-toast-desc');
  if (titleEl) titleEl.textContent = title;
  if (descEl)  descEl.textContent  = desc;

  // Reset & show
  clearTimeout(_fillToastTimer);
  toast.classList.remove('fill-toast--out');
  toast.classList.add('fill-toast--in');

  _fillToastTimer = setTimeout(() => {
    toast.classList.add('fill-toast--out');
    toast.addEventListener('animationend', () => {
      toast.classList.remove('fill-toast--in', 'fill-toast--out');
    }, { once: true });
  }, 2800);
}

function openFillPopup(optEl, groupId) {
  if (!optEl) return;

  _fillSheetPendingEl = optEl;
  _fillSheetPendingGroupId = groupId || 'calcFill';
  _fillPopupRender(optEl);

  const popup   = document.getElementById('fillPopup');
  const overlay = document.getElementById('fillOverlay');
  if (!popup || !overlay) return;

  popup.classList.add('open');
  overlay.classList.add('open');
  document.body.classList.add('fill-open');
  // will-change только перед анимацией
  popup.style.willChange = 'transform';
  // FIX: use lockBody() universally instead of fragile iOS position:fixed trick
  // that left body frozen and blocked all taps after popup close
  lockBody();
  // FIX: hide mc-nav while fill popup is open (was missing, causing nav bar to
  // sit on top of the popup on mobile)
  var _mcNavFill = document.getElementById('mcNav');
  if (_mcNavFill) { _mcNavFill.classList.add('mc-nav--hidden'); document.body.classList.add('mc-nav-hidden'); }

  // Focus the select button for a11y
  setTimeout(() => document.getElementById('fillSheetSelect')?.focus({ preventScroll: true }), 80);
}

function closeFillPopup() {
  const popup   = document.getElementById('fillPopup');
  const overlay = document.getElementById('fillOverlay');
  if (popup)   popup.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('fill-open');
  // FIX: clean up old iOS position:fixed state if somehow still set (from old cached version)
  if (document.body.classList.contains('fill-open-ios')) {
    var savedY = parseInt(document.body.dataset.fillScrollY || '0', 10);
    document.body.classList.remove('fill-open-ios');
    document.body.style.top = '';
    document.body.style.position = '';
    delete document.body.dataset.fillScrollY;
    window.scrollTo(0, savedY);
  }
  // FIX: unlock body (now lockBody() is called in open)
  unlockBody();
  // FIX: restore mc-nav visibility after fill popup closes
  var _mcNavFill = document.getElementById('mcNav');
  if (_mcNavFill) { _mcNavFill.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }

  _fillSheetPendingEl = null;
  _fillSheetPendingGroupId = null;
  if (popup) { popup.style.transform = ''; popup.style.willChange = 'auto'; }
}

function confirmFillSelection() {
  if (_fillSheetPendingEl) {
    // Actually select this option — use the group that opened the sheet
    const groupId = _fillSheetPendingGroupId || 'calcFill';
    document.querySelectorAll(`#${groupId} .calc-opt`).forEach(o => o.classList.remove('selected'));
    _fillSheetPendingEl.classList.add('selected');
    // Rubber click animation
    const inner = _fillSheetPendingEl.querySelector('.opt-inner');
    if (inner) {
      inner.classList.remove('rubber-click'); void inner.offsetWidth;
      inner.classList.add('rubber-click');
      inner.addEventListener('animationend', () => inner.classList.remove('rubber-click'), { once: true });
    }
    updateCalc();
  }
  closeFillPopup();

  // Scroll smoothly to the calc result so user sees updated price
  setTimeout(() => {
    const result = document.getElementById('calcResult');
    if (result) result.closest('.calc-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

// ── Navigate between fills inside the bottom sheet ──
function navigateFill(dir) {
  if (!_fillSheetPendingEl || !_fillSheetPendingGroupId) return;
  const allOpts = Array.from(document.querySelectorAll(`#${_fillSheetPendingGroupId} .calc-opt`));
  const idx = allOpts.indexOf(_fillSheetPendingEl);
  const next = allOpts[idx + dir];
  if (!next) return;
  _fillSheetPendingEl = next;
  _fillPopupRender(next);
}

// ── Swipe-to-dismiss on bottom sheet ──
(function initSheetSwipe() {
  const popup  = document.getElementById('fillPopup');
  const handle = document.getElementById('fillSheetHandle');
  if (!popup || !handle) return;

  let startY = 0, currentY = 0, dragging = false;

  function onStart(e) {
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    currentY = 0;
    dragging = true;
    popup.classList.add('dragging');
  }
  function onMove(e) {
    if (!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    currentY = Math.max(0, y - startY); // only downward
    popup.style.transform = `translateY(${currentY}px)`;
    // Dim overlay as we drag down
    const overlay = document.getElementById('fillOverlay');
    if (overlay) overlay.style.opacity = Math.max(0, 1 - currentY / 220);
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    popup.classList.remove('dragging');
    popup.style.transform = '';
    const overlay = document.getElementById('fillOverlay');
    if (overlay) overlay.style.opacity = '';

    if (currentY > 100) {
      closeFillPopup();
    }
    currentY = 0;
  }

  handle.addEventListener('touchstart', onStart, { passive: true });
  handle.addEventListener('touchmove',  onMove,  { passive: true });
  handle.addEventListener('touchend',   onEnd,   { passive: true });

  // Click/tap overlay to dismiss
  const overlayEl = document.getElementById('fillOverlay');
  if (overlayEl) {
    overlayEl.addEventListener('click', closeFillPopup);
    overlayEl.addEventListener('touchend', () => { closeFillPopup(); }, { passive: true });
  }
})();

// [P-1 FIXED v3→v6] Unified keydown handler — was 3 separate listeners (line 1082, here, line 3554).
// ArrowLeft/Right for catalog lightbox merged here in v6 (was a separate listener above closeFillPopup).
// Reviews modal has its own dynamic listener (handleReviewsEscape) and is intentionally separate.
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') lbNavigate(1);
  if (e.key === 'ArrowLeft')  lbNavigate(-1);
  if (e.key === 'Escape') {
    if (typeof closeLightbox === 'function') closeLightbox();
    if (typeof lbIsOpen !== 'undefined' && lbIsOpen && typeof closeLB === 'function') closeLB();
    closePrivacy();
    closeFillPopup();
    closeCalcPanel();
    const _cartDr = document.getElementById('cartDrawer');
    if (_cartDr && _cartDr.classList.contains('open')) closeCart();
  }
});

// Свайп влево по корзине — закрыть
/* duplicate swipe-to-close handler removed (Bug 4 fix) */


// ── Динамический минимум даты (сегодня + 2 дня) ──
(function() {
  const dateInput = document.getElementById('cdate');
  if (dateInput) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    dateInput.min = minDate.toISOString().split('T')[0];
  }
})();

// ── PREMIUM: Mouse-tracking glow на карточках ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.product-card').forEach(card => {
    if (card._glowBound) return;
    card._glowBound = true;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
      const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
      card.style.setProperty('--mouse-x', x + '%');
      card.style.setProperty('--mouse-y', y + '%');
    });
  });
});

// ── LIGHTBOX SWIPE DOWN TO CLOSE ──
(function() {
  const lbWrap = document.getElementById('lightboxWrap');
  if (!lbWrap) return;
  let startY = 0;
  lbWrap.addEventListener('touchstart', e => {
    startY = e.changedTouches[0].clientY;
  }, { passive: true });
  lbWrap.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 90) closeLightbox();
  }, { passive: true });
})();

const heroBg = document.querySelector('.hero-photo-bg img');
if (heroBg) {
  let _rafPending = false;
  let _parallaxBound = false;

  function _parallaxHandler() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        heroBg.style.transform = `translateY(${y * 0.15}px) scale(1.05)`;
      }
      _rafPending = false;
    });
  }

  function _bindParallax(mq) {
    if (mq.matches && !_parallaxBound) {
      window.addEventListener('scroll', _parallaxHandler, { passive: true });
      _parallaxBound = true;
    } else if (!mq.matches && _parallaxBound) {
      window.removeEventListener('scroll', _parallaxHandler);
      heroBg.style.transform = '';
      _parallaxBound = false;
    }
  }

  const _mq = window.matchMedia('(min-width: 769px)');
  _bindParallax(_mq);
  // Реагируем на смену ориентации
  if (_mq.addEventListener) _mq.addEventListener('change', _bindParallax);
  else _mq.addListener(_bindParallax); // iOS < 14 fallback

  // Пауза при фоновом режиме
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && _parallaxBound) {
      window.removeEventListener('scroll', _parallaxHandler);
      _parallaxBound = false;
    } else if (!document.hidden) {
      _bindParallax(_mq);
    }
  });
}


// ── Ripple effect ──
document.querySelectorAll('.btn-primary, .btn-wa, .calc-order-btn, .btn-add, .header-order').forEach(btn => {
  if (btn._rippleBound) return;
  btn._rippleBound = true;
  btn.classList.add('ripple-wrap');
  btn.addEventListener('click', function(e) {
    // Удаляем предыдущий ripple если ещё не исчез — нет накопления DOM-узлов
    const prev = this.querySelector('.ripple-circle');
    if (prev) prev.remove();
    const circle = document.createElement('span');
    circle.classList.add('ripple-circle');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    circle.style.width = circle.style.height = size + 'px';
    circle.style.left = e.clientX - rect.left - size/2 + 'px';
    circle.style.top = e.clientY - rect.top - size/2 + 'px';
    this.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  });
});

// ── Gold ripple на карточках товаров (touch) ──
(function() {
  function bindCardRipple(card) {
    if (card._goldRippleBound) return;
    card._goldRippleBound = true;
    card.addEventListener('touchstart', function(e) {
      const prev = this.querySelector('.gold-ripple-circle');
      if (prev) prev.remove();
      const touch = e.touches[0];
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.4;
      const circle = document.createElement('span');
      circle.className = 'gold-ripple-circle';
      circle.style.cssText = [
        'position:absolute',
        'border-radius:50%',
        'pointer-events:none',
        'z-index:10',
        'width:' + size + 'px',
        'height:' + size + 'px',
        'left:' + (touch.clientX - rect.left - size/2) + 'px',
        'top:' + (touch.clientY - rect.top - size/2) + 'px',
        'background:radial-gradient(circle,rgba(201,147,74,0.22) 0%,rgba(201,147,74,0) 70%)',
        'transform:scale(0)',
        'animation:goldRippleAnim 0.7s ease-out forwards',
      ].join(';');
      this.appendChild(circle);
      setTimeout(function() { if (circle.parentNode) circle.remove(); }, 750);
    }, { passive: true });
  }

  // Вешаем на уже существующие карточки
  document.querySelectorAll('.product-card').forEach(bindCardRipple);

  // И на динамически добавляемые (каталог рендерится JS-ом)
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (!node.querySelectorAll) return;
        node.querySelectorAll('.product-card').forEach(bindCardRipple);
        if (node.classList && node.classList.contains('product-card')) bindCardRipple(node);
      });
    });
  });
  var grid = document.getElementById('catalogGrid');
  if (grid) observer.observe(grid, { childList: true, subtree: true });
})();

// (map reviews accordion removed — elements not present in HTML)

// ── CHAT GALLERY LIGHTBOX ──
const CHAT_SRCS = [
  IMG_BASE + '/review_1.webp',
  IMG_BASE + '/review_2.webp',
  IMG_BASE + '/review_3.webp',
  IMG_BASE + '/review_4.webp',
  IMG_BASE + '/review_5.webp',
  IMG_BASE + '/review_6.webp',
  IMG_BASE + '/review_7.webp',
  IMG_BASE + '/review_8.webp',
];

// Открываем скриншот отзыва через лайтбокс отзывов (#lbOverlay / #lbImg)
function openChatLightbox(idx) {
  // [NM-10 FIXED] Race condition: if closeLB() had a pending 600ms timer that
  // would clear lbImg.src, we cancel it here by resetting lbBusy/lbIsOpen.
  // Also fixes lockBody counter mismatch (double-lock → page stuck, no scroll).
  if (lbBusy) { lbBusy = false; lbIsOpen = false; }
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const overlay = document.getElementById('lbOverlay');
  const img     = document.getElementById('lbImg');
  if (!overlay || !img) return;
  const safeIdx = ((idx % CHAT_SRCS.length) + CHAT_SRCS.length) % CHAT_SRCS.length;
  _lbReviewIdx  = safeIdx;
  img.src = CHAT_SRCS[safeIdx];
  img.style.opacity   = '1';
  img.style.transform = 'scale(1)';
  img.style.transition = 'opacity 0.2s, transform 0.2s';
  const counter = document.getElementById('lbArrCounter');
  if (counter) counter.textContent = (safeIdx + 1) + ' / ' + CHAT_SRCS.length;
  lockBody();
  overlay.classList.add('active');
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.add('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.add('mc-nav--hidden'); document.body.classList.add('mc-nav-hidden'); }
  const lbXBtn = document.getElementById('lbX');
  if (lbXBtn) {
    lbXBtn.style.opacity = '0';
    lbXBtn.style.transform = 'scale(0.5)';
    lbXBtn.style.pointerEvents = 'none';
    setTimeout(() => {
      lbXBtn.style.opacity = '1';
      lbXBtn.style.transform = 'scale(1)';
      lbXBtn.style.pointerEvents = '';
    }, 500);
  }
}

/* ══════════════════════════════════════════
   REVIEWS MODAL
══════════════════════════════════════════ */
function openReviewsModal(tab) {
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  const modal = document.getElementById('reviewsModal');
  if (!modal) return;
  if (modal.classList.contains('open')) return; // idempotent
  lockBody();
  // visibility:hidden→visible через CSS transition, display не трогаем
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });
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
  if (!modal.classList.contains('open')) return; // idempotent
  modal.classList.remove('open');
  document.removeEventListener('keydown', handleReviewsEscape);
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.remove('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }
  // Fallback timeout ensures unlockBody() fires even if transitionend doesn't
  var _unlocked = false;
  var _unlockFallback = setTimeout(function() {
    if (!_unlocked) { _unlocked = true; unlockBody(); }
  }, 500);
  modal.addEventListener('transitionend', function handler() {
    modal.removeEventListener('transitionend', handler);
    if (!_unlocked) { _unlocked = true; clearTimeout(_unlockFallback); unlockBody(); }
  });
}

function handleReviewsEscape(e) {
  if (e.key === 'Escape') closeReviewsModal();
}

function switchReviewsTab(tab) {
  const yList = document.getElementById('reviewsYandex');
  const gList = document.getElementById('reviewsGoogle');
  const tY = document.getElementById('tabYandex');
  const tG = document.getElementById('tabGoogle');
  const link = document.getElementById('reviewsExternalLink');
  if (!yList || !gList) return;

  const isYandex = tab === 'yandex';
  yList.style.display = isYandex ? 'block' : 'none';
  gList.style.display = isYandex ? 'none' : 'block';
  if (tY) tY.classList.toggle('active', isYandex);
  if (tG) tG.classList.toggle('active', !isYandex);
  if (link) {
    link.href = isYandex
      ? 'https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/reviews/'
      : 'https://maps.app.goo.gl/R3mdjxpnebUYMQES6';
    link.childNodes[link.childNodes.length - 1].textContent =
      isYandex ? ' Все отзывы на Яндекс Картах →' : ' Все отзывы в Google Maps →';
  }
  (isYandex ? yList : gList).scrollTop = 0;
}

// Mobile swipe-down to close
(function() {
  let _sy = 0;
  const rm = document.querySelector('.reviews-modal');
  if (!rm) return;
  rm.addEventListener('touchstart', e => { _sy = e.touches[0].clientY; }, { passive: true });
  rm.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - _sy > 90) closeReviewsModal();
  }, { passive: true });
})();


/* ══════════════════════════════════════
   NEW REVIEWS SECTION JS
   ══════════════════════════════════════ */
/* ─── Generate fake messenger screenshot SVGs as data URIs ─── */
function makeScreenshot(opts) {
  const {
    appColor = '#25D366',
    appIcon = 'W',
    senderName = 'Анна',
    avatarColor = '#a8c5a0',
    avatarLetter = 'А',
    message = 'Спасибо!',
    time = '14:32',
    bgColor = '#ece5dd',
    bubbleColor = '#dcf8c6',
    bubbleTextColor = '#111',
    headerBg = '#075e54',
    headerText = '#fff',
    w = 240, h = 320,
    emoji = '',
    secondLine = '',
  } = opts;

  const msgLines = [message, secondLine].filter(Boolean);
  const lineHeight = 16;
  const bubbleH = msgLines.length * lineHeight + 30;

  const svgLines = msgLines.map((line, i) =>
    `<text x="14" y="${82 + i * lineHeight}" font-size="10.5" fill="${bubbleTextColor}" font-family="system-ui,sans-serif">${escSVG(line)}</text>`
  ).join('');

  function escSVG(s) {
    // strip emoji to avoid blue-square fallbacks in SVG renderers
    s = s.replace(/[🀀-🿿☀-➿⭐⭕⌚-⌛▪-⟿]/gu, '');
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- bg -->
  <rect width="${w}" height="${h}" fill="${bgColor}"/>
  <!-- subtle bg pattern dots -->
  <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="10" cy="10" r="1" fill="rgba(0,0,0,0.04)"/>
  </pattern>
  <rect width="${w}" height="${h}" fill="url(#dots)"/>

  <!-- top bar -->
  <rect width="${w}" height="46" fill="${headerBg}"/>
  <!-- back arrow SVG path -->
  <path d="M20,23 L12,23 M12,23 L16,19 M12,23 L16,27" stroke="${headerText}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <!-- avatar circle -->
  <circle cx="44" cy="23" r="14" fill="${avatarColor}"/>
  <text x="44" y="28" text-anchor="middle" font-size="13" fill="#fff" font-weight="600" font-family="Arial,sans-serif">${escSVG(avatarLetter)}</text>
  <!-- name + status -->
  <text x="64" y="20" font-size="11" font-weight="600" fill="${headerText}" font-family="Arial,sans-serif">${escSVG(senderName)}</text>
  <text x="64" y="33" font-size="9" fill="rgba(255,255,255,0.75)" font-family="Arial,sans-serif">online</text>
  <!-- 3-dot menu -->
  <circle cx="${w-24}" cy="23" r="2" fill="${headerText}" opacity="0.8"/>
  <circle cx="${w-16}" cy="23" r="2" fill="${headerText}" opacity="0.8"/>
  <circle cx="${w-8}"  cy="23" r="2" fill="${headerText}" opacity="0.8"/>

  <!-- date chip -->
  <rect x="${w/2-28}" y="54" width="56" height="16" rx="8" fill="rgba(0,0,0,0.12)"/>
  <text x="${w/2}" y="66" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.85)" font-family="system-ui">сегодня</text>

  <!-- message bubble -->
  <rect x="8" y="76" width="${w-24}" height="${bubbleH}" rx="12" fill="${bubbleColor}"
    filter="drop-shadow(0 1px 3px rgba(0,0,0,0.12))"/>
  <!-- bubble tail -->
  <path d="M8,${76+bubbleH-16} Q0,${76+bubbleH} 0,${76+bubbleH} L14,${76+bubbleH-4} Z" fill="${bubbleColor}"/>
  ${svgLines}
  ${emoji ? `<text x="${w-28}" y="${76+bubbleH-14}" font-size="14" font-family="system-ui">${escSVG(emoji)}</text>` : ''}
  <!-- time + ticks (SVG paths) -->
  <text x="${w-32}" y="${76+bubbleH-6}" text-anchor="end" font-size="8" fill="rgba(0,0,0,0.4)" font-family="Arial,sans-serif">${escSVG(time)}</text>
  <!-- double checkmark as paths -->
  <path d="M${w-28},${76+bubbleH-9} l3,3 l5,-6" stroke="#53bdeb" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M${w-24},${76+bubbleH-9} l3,3 l5,-6" stroke="#53bdeb" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* Real review screenshots from project assets */
const SCREENSHOTS = [
  IMG_BASE + '/review_1.webp',
  IMG_BASE + '/review_2.webp',
  IMG_BASE + '/review_3.webp',
  IMG_BASE + '/review_4.webp',
  IMG_BASE + '/review_5.webp',
  IMG_BASE + '/review_6.webp',
  IMG_BASE + '/review_7.webp',
  IMG_BASE + '/review_8.webp',
];

/* ─── DATA ─── */
const REVIEWS = [
  { text:"Все гости в восторге! Мы тоже 👍 Попросили ваш контакт 😊",                                             src: SCREENSHOTS[0] },
  { text:"Огромное Вам благодарность за самый вкуснейший торт!!! Именинница в восторге и от вида и от вкуса!!!",  src: SCREENSHOTS[1] },
  { text:"Вы мастер своего дела ✨ Правда очень классный торт. Настроение сразу радостное глядя на него ❤️",       src: SCREENSHOTS[2] },
  { text:"Очень очень вкусный, понравился. Ещё будем заказывать 🙏",                                              src: SCREENSHOTS[3] },
  { text:"Всем очень понравился торт, именинница очень довольна. Видно, что душу вложили — мы это очень ценим!",  src: SCREENSHOTS[4] },
  { text:"Спасибо большое за чудесный тортик! Все в восторге! Очень вкусно 😍",                                    src: SCREENSHOTS[5] },
  { text:"Вика, насколько красиво — настолько и вкусно 😋 Клиентов стало больше у Вас ❤️",                        src: SCREENSHOTS[6] },
  { text:"Торт изумителен 🤩 Вкусно. Профессионально. Стильно. Спасибо! ❤️",                                      src: SCREENSHOTS[7] },
];

// LAYOUTS: side = 'left'|'right', tp = % of section height, rot = tilt
// Horizontal positions are computed DYNAMICALLY in the loop:
// centered in the gap between the stage edges and the viewport edges.
const LAYOUTS = [
  { side:'left',  tp: 30, rot: -14 },  // 0 top-left
  { side:'right', tp: 47, rot:  18 },  // 1 right-high
  { side:'left',  tp: 47, rot: -18 },  // 2 left-high
  { side:'right', tp: 30, rot:  14 },  // 3 top-right
  { side:'left',  tp: 63, rot:   8 },  // 4 left-mid
  { side:'right', tp: 63, rot:  -8 },  // 5 right-mid
  { side:'left',  tp: 82, rot: -11 },  // 6 left-low — уровень Яндекс/Google
  { side:'right', tp: 82, rot:  11 },  // 7 right-low — уровень Яндекс/Google
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

let cur   = 0;

/* ── STATE MACHINE ──
   'typing'  → typewriter runs
   'zoom_in' → active thumb approaches stage
   'waiting' → arrows shown, user can click
   'zoom_out'→ thumb returns, then auto-advance
*/
let STATE    = 'typing';
let typeGen    = 0; // cancel stale rAF animations on slide change
let dissolveGen = 0; // cancel stale dissolve rAF animations
let dissolved = false; // ensure dissolveText fires only once per zoom_out
let zoomP    = 0;        // 0 = home, 1 = fully zoomed in
let ZOOM_IN_SPD_CUR = 0.006; // dynamic, recalculated per review
const ZOOM_IN_SPD   = 0.006;
const ZOOM_OUT_SPD  = 0.07;
const ZOOM_DIST     = 75;    // px max pull toward stage
const WAIT_DURATION = 4000;  // ms to wait before auto-advance

let waitTimer   = null;
let typeTimer   = null;

const scField     = document.getElementById('scField');
const trackEl     = document.getElementById('track');
const dotsEl      = document.getElementById('dots');
const stageEl     = document.getElementById('stage');
const thumbs = [];
const arrows = [];

// ── Guard: skip reviews DOM setup on pages without reviews section ──
if (scField && trackEl && dotsEl && stageEl) {
  trackEl.innerHTML = "";

REVIEWS.forEach((rv, i) => {
  const lay = LAYOUTS[i];

  const th = document.createElement('div');
  th.className = 'sc-thumb';
  th.style.left = '0';
  th.style.top  = '0';
  th.style.willChange = 'transform';
  th.style.transform = `translate(${lay.side==='left' ? 5 : 75}%, ${lay.tp}%)`;
  th.dataset.i  = i;

  const im = document.createElement('img');
  im.src = rv.src; im.alt = `Отзыв ${i+1}`; im.loading='lazy';
  th.appendChild(im);

  const hint = document.createElement('div');
  hint.className = 'thumb-hint';
  hint.innerHTML = `<span class="hint-text">кликни на меня</span><span class="hint-emoji">👆</span><span class="hint-text">чтобы увеличить</span>`;
  th.appendChild(hint);

  th.addEventListener('click', ()=>{
    if(i !== cur) { if (!_goToBusy) goTo(i); return; }
    // Открываем лайтбокс в любом STATE — не ждём завершения анимации
    if(STATE==='waiting'||STATE==='zoom_in'||STATE==='typing') openLB(th, rv.src, i);
  });
  scField.appendChild(th);
  thumbs.push(th);

  // 4-arrow group: positioned in loop around the thumb, no rotation
  const ar = document.createElement('div');
  ar.className = 'sc-arrows';
  ar.style.left = '0';
  ar.style.top  = '0';
  ar.style.willChange = 'transform';
  ar.innerHTML = `
    <div class="sc-arr sc-arr-top"></div>
    <div class="sc-arr sc-arr-bottom"></div>
    <div class="sc-arr sc-arr-left"></div>
    <div class="sc-arr sc-arr-right"></div>
  `;
  scField.appendChild(ar);
  arrows.push(ar);

  const slide = document.createElement('div');
  slide.className = 'review-slide' + (i===0?' active':'');
  const card = document.createElement('div');
  card.className = 'review-card';
  const q = document.createElement('div');
  q.className='review-q'; q.textContent='❝';
  const txt = document.createElement('p');
  txt.className='review-text'; txt.dataset.full=rv.text; txt.textContent='';
  card.append(q, txt);
  slide.appendChild(card);
  trackEl.appendChild(slide);
  // clicks handled by thumb, not card

  const dot = document.createElement('button'); dot.type = 'button';
  dot.className='rev-dot'+(i===0?' on':'');
  dot.setAttribute('aria-label',`Отзыв ${i+1}`);
  dot.addEventListener('click',()=> { if (!_goToBusy) goTo(i); });
  dotsEl.appendChild(dot);
});

if (thumbs.length) thumbs[0].classList.add('is-active');
// Подсветить первый элемент filmstrip
const firstFilmItem = document.querySelector('.review-filmstrip-item');
if (firstFilmItem) firstFilmItem.classList.add('active');
// [NM-16 FIXED] Cache NodeLists after DOM is built — goTo() called up to 60fps via autoplay,
// querySelectorAll('.review-slide') on every call causes unnecessary DOM traversal.
// These lists are static after init (no add/remove of slides at runtime).
const _cachedSlides    = trackEl ? Array.from(trackEl.querySelectorAll('.review-slide')) : [];
const _cachedDots      = dotsEl  ? Array.from(dotsEl.querySelectorAll('.rev-dot'))       : [];
const _cachedFilmItems = Array.from(document.querySelectorAll('.review-filmstrip-item'));
// startTypewriter() вызовется когда секция станет видна

function hideArrows(){
  arrows.forEach(a => a.classList.remove('show'));
  thumbs.forEach(t => t.classList.remove('hint-show'));
}
function showArrows(){
  arrows[cur].classList.add('show');
}
// positionArrows now handled inline in the loop — no-op here
function positionArrows(){}

function startTypewriter(){
  if (!trackEl) return; // not on reviews page
  const slides = trackEl.querySelectorAll('.review-slide');
  const txtEl  = slides[cur].querySelector('.review-text');
  const full   = txtEl.dataset.full;

  const myGen = typeGen; // stale check
  if(typeTimer){ clearTimeout(typeTimer); typeTimer=null; }

  // ── PARTICLE ASSEMBLE — letters fly in from random scatter ──
  const CHAR_DELAY = 28;   // ms between each letter start
  const ASSEMBLE_DUR = 600; // ms each letter takes to settle

  // Tokenize: emoji/special chars go plain, regular chars get animated spans
  // Wrap each word in a nowrap span so line-breaks only happen between words
  // Use Intl.Segmenter to split by grapheme clusters so multi-codepoint emoji
  // (e.g. ❤️ = U+2764 + U+FE0F) stay together as a single unit.
  const emojiGraphemeRegex = /^\p{Emoji}/u;

  function escHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Segment the full text into grapheme clusters
  // Fallback for iOS Safari < 15.4 which lacks Intl.Segmenter
  const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
  const segmenter = hasSegmenter ? new Intl.Segmenter('ru', { granularity: 'grapheme' }) : null;

  function segmentText(str) {
    if (segmenter) return [...segmenter.segment(str)].map(s => s.segment);
    // Fallback: split by surrogate pairs + variation selectors for basic emoji support
    return [...str]; // Array.from handles surrogate pairs in all modern JS engines
  }

  // Split into word-groups (split on whitespace)
  const wordGroups = full.split(/( +)/);
  let html = '';
  let letterIdx = 0;

  wordGroups.forEach(group => {
    if(!group) return;
    if(/^ +$/.test(group)){
      // spaces — plain, no span
      html += group;
      return;
    }
    // Word: wrap in inline-block nowrap span so it never breaks mid-word
    let wordHtml = '';
    // iterate over grapheme clusters (handles multi-codepoint emoji like ❤️)
    const clusters = segmentText(group);
    clusters.forEach(ch => {
      if(emojiGraphemeRegex.test(ch)){
        // emoji — hidden span, animated after text finishes
        wordHtml += `<span class="pl-emoji">${escHtml(ch)}</span>`;
      } else {
        const safe = escHtml(ch);
        wordHtml += `<span class="pl" data-i="${letterIdx}">${safe}</span>`;
        letterIdx++;
      }
    });
    html += `<span style="display:inline-block;white-space:nowrap">${wordHtml}</span>`;
  });

  txtEl.innerHTML = html;
  const totalLetters = letterIdx;

  // Total duration: last letter starts + assemble duration
  const totalDur = (totalLetters - 1) * CHAR_DELAY + ASSEMBLE_DUR + 100;

  // Build letterData array — scatter positions for single rAF loop
  const letterEls = txtEl.querySelectorAll('.pl');
  const letterData = [];
  letterEls.forEach((el, i) => {
    const angle  = Math.random() * Math.PI * 2;
    const dist   = 60 + Math.random() * 120;
    const fromX  = Math.cos(angle) * dist;
    const fromY  = Math.sin(angle) * dist;
    const fromR  = (Math.random() - 0.5) * 60;
    const fromS  = 0.3 + Math.random() * 0.4;
    const startAt = i * CHAR_DELAY;
    el.style.opacity = '0';
    el.style.transform = `translate(${fromX}px, ${fromY}px) rotate(${fromR}deg) scale(${fromS})`;
    el.style.filter = `blur(${2 + Math.random()*3}px)`;
    letterData.push({ el, fromX, fromY, fromR, fromS, startAt });
  });

  // Single rAF loop for ALL letters — no per-letter setTimeout/rAF accumulation
  const EMOJI_START_AFTER = (totalLetters - 1) * CHAR_DELAY + ASSEMBLE_DUR * 0.6;
  const EMOJI_GAP = 180;
  const emojiEls = Array.from(txtEl.querySelectorAll('.pl-emoji'));
  const animStart = performance.now();

  function animTick(now){
    if(typeGen !== myGen) return; // cancelled — stop entire animation
    const elapsed = now - animStart;

    // Animate letters
    letterData.forEach(({ el, fromX, fromY, fromR, fromS, startAt }) => {
      const t = elapsed - startAt;
      if(t < 0) return; // not started yet
      const raw = Math.min(t / ASSEMBLE_DUR, 1);
      const ease = raw < 1 ? 1 - Math.pow(1 - raw, 3) : 1;
      const bounce = raw < 0.85 ? 0 : Math.sin((raw - 0.85) / 0.15 * Math.PI) * 2.5;
      el.style.opacity   = String(Math.min(raw * 3, 1).toFixed(3));
      el.style.filter    = `blur(${((1-raw)*3).toFixed(2)}px)`;
      el.style.transform = raw >= 1
        ? 'none'
        : `translate(${(fromX*(1-ease)).toFixed(2)}px, ${(fromY*(1-ease)+bounce*(1-raw)).toFixed(2)}px) rotate(${(fromR*(1-ease)).toFixed(2)}deg) scale(${(fromS+(1-fromS)*ease).toFixed(3)})`;
      if(raw >= 1){ el.style.filter='none'; el.style.opacity='1'; }
    });

    // Animate emoji
    emojiEls.forEach((em, ei) => {
      const t = elapsed - (EMOJI_START_AFTER + ei * EMOJI_GAP);
      if(t < 0) return;
      const DUR = 500;
      const p = Math.min(t / DUR, 1);
      const scale = p < 0.6 ? (p/0.6)*1.35 : 1.35-(p-0.6)/0.4*0.35;
      const rot = Math.sin(p * Math.PI) * 18 * (1 - p);
      em.style.opacity   = String(Math.min(p * 5, 1).toFixed(3));
      em.style.transform = p >= 1 ? 'scale(1) rotate(0deg)' : `scale(${scale.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`;
    });

    // Continue until all done
    const lastEmojiEnd = EMOJI_START_AFTER + (emojiEls.length - 1) * EMOJI_GAP + 500;
    const allDone = elapsed >= Math.max(totalDur, lastEmojiEnd || 0);
    if(!allDone) requestAnimationFrame(animTick);
  }
  requestAnimationFrame(animTick);

  // START zoom_in immediately alongside typing — calibrate speed so it
  // reaches ~1 at the same time the last letter finishes animating.
  // zoomP approaches 1 exponentially: zoomP ≈ 1 - (1-spd)^frames
  // frames = totalDur / 16ms. We want (1-spd)^frames ≈ 0.04 → spd ≈ 1 - 0.04^(1/frames)
  STATE = 'zoom_in';
  const frames = totalDur / 16;
  ZOOM_IN_SPD_CUR = 1 - Math.pow(0.04, 1 / frames);

  // After last letter finishes → transition to waiting
  const capturedTypeGen = typeGen; // захватить ДО setTimeout
  typeTimer = setTimeout(()=>{
    if(typeGen !== capturedTypeGen) { typeTimer = null; return; } // stale check FIRST
    typeTimer = null;
    zoomP = 1;
    startWaiting();
  }, totalDur);
}

function startWaiting(){
  STATE = 'waiting';
  showArrows();
  thumbs[cur].classList.add('hint-show');
  if(waitTimer) clearTimeout(waitTimer);
  const capturedWaitGen = typeGen; // захватить текущее поколение
  waitTimer = setTimeout(()=>{
    if(typeGen !== capturedWaitGen) { waitTimer = null; return; } // stale check FIRST
    waitTimer = null;
    hideArrows();
    STATE = 'zoom_out';
    // dissolveText запускается из loop() когда zoomP < 0.72 — не по таймеру
  }, WAIT_DURATION);
}

function dissolveText(){
  const slides = trackEl.querySelectorAll('.review-slide');
  const txtEl  = slides[cur]?.querySelector('.review-text');
  if(!txtEl) return;

  const spans = Array.from(txtEl.querySelectorAll('.pl, .pl-emoji'));
  if(!spans.length) return;

  const SHATTER_DUR = 480;
  const myGen = ++dissolveGen;

  const data = spans.map((el, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 40 + Math.random() * 100;
    return {
      el,
      delay: i * 8,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist - 20,
      rot: (Math.random() - 0.5) * 90
    };
  });

  const start = performance.now();

  function tick(now){
    if (dissolveGen !== myGen) return;

    const t = now - start;
    let done = true;

    for (const d of data){
      const local = t - d.delay;
      if (local < 0) { done = false; continue; }

      const raw = Math.min(local / SHATTER_DUR, 1);
      if (raw < 1) done = false;

      const p = raw * raw;

      d.el.style.opacity   = String(Math.max(0, 1 - raw * 2));
      d.el.style.filter    = `blur(${(raw * 4).toFixed(2)}px)`;
      d.el.style.transform =
        `translate(${(d.tx*p).toFixed(2)}px, ${(d.ty*p).toFixed(2)}px) ` +
        `rotate(${(d.rot*p).toFixed(2)}deg) scale(${(1 - raw*0.5).toFixed(3)})`;
    }

    if (!done) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// [P-6 v2 FIXED] Guard moved to UI handlers only — autoplay must never be blocked.
// When _goToBusy=true and zoom_out reaches zoomP<0.02, STATE is set to 'idle' BEFORE
// calling goTo(). If goTo() returned early here, STATE would stay 'idle' forever → freeze.
// Fix: only UI-triggered calls (click/swipe/dot) check _goToBusy; internal autoplay skips it.
let _goToBusy = false;
function goTo(n, skipTypewriter){
  _goToBusy = true;
  setTimeout(() => { _goToBusy = false; }, 600); // unlock after transition window
  if (!scField || !trackEl || !dotsEl || !stageEl) return; // not on reviews page
  // [NM-16 FIXED] Use pre-cached arrays — no DOM traversal on every slide change
  const slides    = _cachedSlides;
  const dts       = _cachedDots;
  const filmItems = _cachedFilmItems;

  // cancel all pending timers immediately
  if(typeTimer){ clearTimeout(typeTimer); typeTimer=null; }
  if(waitTimer){ clearTimeout(waitTimer);  waitTimer=null; }
  hideArrows();

  // invalidate stale letter rAF animations
  typeGen++;

  const prevTxt = slides[cur]?.querySelector('.review-text');
  if (prevTxt) prevTxt.innerHTML = '';
  dissolveGen++;

  thumbs[cur].classList.remove('is-active');
  slides[cur].classList.remove('active');
  dts[cur].classList.remove('on');
  if (filmItems[cur]) filmItems[cur].classList.remove('active');

  cur   = (n + REVIEWS.length) % REVIEWS.length;
  zoomP = 0;
  STATE = 'typing';
  ZOOM_IN_SPD_CUR = ZOOM_IN_SPD;
  dissolved = false;

  thumbs[cur].classList.add('is-active');
  slides[cur].classList.add('active');
  dts[cur].classList.add('on');

  // Подсвечиваем и прокручиваем filmstrip к активному элементу
  if (filmItems[cur]) {
    filmItems[cur].classList.add('active');
    // [NM-15 FIXED v5] offsetLeft is relative to offsetParent (may NOT be the strip).
    // Use getBoundingClientRect diff to get position relative to the scrollable strip.
    var strip = filmItems[cur].closest('.review-filmstrip') || filmItems[cur].parentElement;
    if (strip) {
      var itemRect  = filmItems[cur].getBoundingClientRect();
      var stripRect = strip.getBoundingClientRect();
      var itemLeft  = itemRect.left - stripRect.left + strip.scrollLeft;
      var itemW     = filmItems[cur].offsetWidth;
      var stripW    = strip.offsetWidth;
      var targetLeft = itemLeft - (stripW - itemW) / 2;
      // Smooth scroll with polyfill for iOS < 15.4 (no native scrollBehavior on overflow elements)
      if ('scrollBehavior' in document.documentElement.style) {
        strip.scrollTo({ left: targetLeft, behavior: 'smooth' });
      } else {
        // Polyfill: linear interpolation over ~300ms
        var start = strip.scrollLeft, dist = targetLeft - start, dur = 300, startT = 0;
        function _filmScroll(ts) {
          if (!startT) startT = ts;
          var prog = Math.min((ts - startT) / dur, 1);
          strip.scrollLeft = start + dist * prog;
          if (prog < 1) requestAnimationFrame(_filmScroll);
        }
        requestAnimationFrame(_filmScroll);
      }
    }
  }

  if(!skipTypewriter) startTypewriter();
  else startWaiting();
}

const _btnPrev = document.getElementById('btnPrev');
const _btnNext = document.getElementById('btnNext');
// [P-6 v2] UI handlers guard — only user-initiated navigation is rate-limited
if (_btnPrev) _btnPrev.addEventListener('click', ()=> { if (!_goToBusy) goTo(cur-1); });
if (_btnNext) _btnNext.addEventListener('click', ()=> { if (!_goToBusy) goTo(cur+1); });

let tsX=0, tsY=0;
if (trackEl) {
  trackEl.addEventListener('touchstart', e=>{ tsX=e.touches[0].clientX; tsY=e.touches[0].clientY; },{passive:true});
  trackEl.addEventListener('touchend', e=>{
    const dx=e.changedTouches[0].clientX-tsX;
    const dy=e.changedTouches[0].clientY-tsY;
    if(Math.abs(dx)>Math.abs(dy)*1.4 && Math.abs(dx)>40){ if (!_goToBusy) goTo(dx<0 ? cur+1 : cur-1); }
  });
}

function getStageCenter(){
  if (!stageEl) return { x: 0, y: 0 };
  const r=stageEl.getBoundingClientRect();
  return { x: r.left+r.width/2, y: r.top+r.height/2 };
}
let sectionSnapH = 0;
function snapSectionHeight(){ sectionSnapH = document.getElementById('reviews').offsetHeight; }
// [P-5 FIXED] Debounce resize to avoid heavy recalcs on every pixel
let _snapResizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(_snapResizeTimer);
  _snapResizeTimer = setTimeout(snapSectionHeight, 150);
});
setTimeout(snapSectionHeight, 100);

// ── CACHE для loop() — избегаем DOM-запросы каждый кадр ──
let cachedTrackEl = null;
let cachedSectionWidth = 0;
let cachedSectionHeight = 0;
// [NM-21 FIXED] Cache secEl — getElementById('reviews') was called on every rAF frame
// forcing a DOM traversal at 60fps. Invalidated on resize via ResizeObserver below.
let _cachedSecEl = null;

// ResizeObserver кэширует размер секции — избегаем forced reflow в loop
const _sectionResizeObs = new ResizeObserver(entries => {
  const rect = entries[0].contentRect;
  cachedSectionWidth = rect.width;
  cachedSectionHeight = rect.height;
  _cachedSecEl = null; // invalidate so loop() re-fetches on next frame
  snapSectionHeight();
});

// loop() работает только когда секция отзывов видна — экономит CPU/battery
let loopActive = false;
let loopRunning = false;

const _revObserver = new IntersectionObserver(function(entries) {
  if (entries[0].isIntersecting) {
    loopActive = true;
    if (!loopRunning) {
      loopRunning = true;
    }
    // Всегда перезапускаем loop — он мог умереть пока секция была вне экрана
    requestAnimationFrame(function(t) { lastT = t; requestAnimationFrame(loop); });
  } else {
    loopRunning = false;
    loopActive = false;
  }
}, {
  rootMargin: '300px 0px 300px 0px',
  threshold: 0
});

// Отдельный observer для старта печати отзыва, когда секция реально по центру экрана
const _revTypeObserver = new IntersectionObserver(function(entries) {
  if (entries[0].isIntersecting) {
    if (STATE === 'typing' && !typeTimer) {
      setTimeout(function() { startTypewriter(); }, 100);
    }
  }
}, {
  rootMargin: '-20% 0px -20% 0px',
  threshold: 0
});

setTimeout(() => {
  const secEl = document.getElementById('reviews');
  if (secEl) {
    _sectionResizeObs.observe(secEl);
    _revObserver.observe(secEl);
    _revTypeObserver.observe(secEl);
    cachedSectionWidth = secEl.offsetWidth;
    cachedSectionHeight = secEl.offsetHeight;
  }
}, 100);

let lastT=0;
function loop(ts){
  if (!loopRunning || !loopActive) return; // пауза когда секция вне зоны видимости

  // [NM-21 FIXED] Use cached reference — avoid getElementById traversal at 60fps
  if (!_cachedSecEl) _cachedSecEl = document.getElementById('reviews');
  const secEl = _cachedSecEl;
  if (!secEl) { if (loopActive) requestAnimationFrame(loop); return; }

  const dt = Math.min(ts-lastT, 40);
  lastT = ts;

  // ── state machine tick ──
  if(STATE === 'idle'){ requestAnimationFrame(loop); return; } // пауза между слайдами
  if(STATE === 'zoom_in' && !lbIsOpen){
    zoomP += (1 - zoomP) * ZOOM_IN_SPD_CUR;
    // startWaiting triggered by typeTimer when text finishes
  } else if(STATE === 'zoom_out'){
    zoomP += (0 - zoomP) * ZOOM_OUT_SPD;
    // Запускаем dissolve когда thumb отъехал на ~28% — привязка к анимации, не к таймеру
    if (!dissolved && zoomP < 0.72) {
      dissolved = true;
      dissolveText();
    }
    if(zoomP < 0.02){
      zoomP=0;
      STATE = 'idle'; // prevent loop re-entry before goTo completes
      goTo(cur + 1);
    }
  }

  const THUMB_W = 80, THUMB_H = 108, MARGIN = 12;
  // Use offsetLeft (scroll-independent) for horizontal gap centers
  const stgOffLeft  = stageEl.offsetLeft;
  const stgOffRight = stageEl.offsetLeft + stageEl.offsetWidth;
  const secW        = cachedSectionWidth || secEl.offsetWidth; // используем кэш
  const leftGapCenter  = stgOffLeft / 2;
  const rightGapCenter = stgOffRight + (secW - stgOffRight) / 2;
  const minL = MARGIN;
  const maxL = (cachedSectionWidth || secEl.offsetWidth) - THUMB_W - MARGIN;
  // Park target — scroll-independent coords relative to secEl
  // Use offsetTop chain relative to secEl — scroll-independent, same coordinate system as baseT
  function offsetRelTo(el, ancestor) {
    let top = 0, left = 0, cur = el;
    while (cur && cur !== ancestor) { top += cur.offsetTop; left += cur.offsetLeft; cur = cur.offsetParent; }
    return { top, left };
  }
  const stageOff    = offsetRelTo(stageEl, secEl);
  // getBoundingClientRect для точных координат с учётом центрирования
  const secRect     = secEl.getBoundingClientRect();
  const stageRect   = stageEl.getBoundingClientRect();
  const cardL       = stageRect.left - secRect.left;
  const cardW       = stageEl.offsetWidth;
  // Центр блока с карточкой отзыва — через getBoundingClientRect
  if (!cachedTrackEl) cachedTrackEl = stageEl.querySelector('.reviews-track') || trackEl;
  const trackEl2    = cachedTrackEl;
  const trackRect   = trackEl2.getBoundingClientRect();
  const cardCenterY = trackRect.top - secRect.top + trackRect.height / 2;

  thumbs.forEach((th, i)=>{
    const fl  = FLOATS[i];
    const lay = LAYOUTS[i];
    const t   = ts / 1000;
    const fx = Math.sin(t * fl.fx * 1000 + fl.ph) * fl.ax;
    const fy = Math.cos(t * fl.fy * 1000 + fl.ph) * fl.ay;
    const fr = Math.sin(t * fl.rf * 1000 + fl.ph) * fl.rA;

    const rawL = lay.side==='left'
      ? leftGapCenter  - THUMB_W/2
      : rightGapCenter - THUMB_W/2;
    const baseL = Math.max(minL, Math.min(maxL, rawL));
    const baseT = (lay.tp/100) * (sectionSnapH||secEl.offsetHeight) - THUMB_H/2;

    let px=0, py=0, pr=0;
    // Fade float OUT as thumb approaches park (straight-line travel)
    const isActive = (i === cur);
    const floatScale = isActive ? Math.max(0, 1 - zoomP * 2.5) : 1;
    th.style.zIndex = isActive ? '50' : '1';
    arrows[i].style.zIndex = isActive ? '51' : '2';
    const ffx = fx * floatScale;
    const ffy = fy * floatScale;
    const ffr = fr * floatScale;

    if(isActive && zoomP > 0.001 && (STATE==='zoom_in'||STATE==='waiting'||STATE==='zoom_out')){
      // Park target: как в оригинале — к краям карточки
      const OVERLAP = 45;
      const parkX = lay.side === 'left'
        ? cardL - THUMB_W + OVERLAP
        : cardL + cardW - OVERLAP;
      const parkY = cardCenterY - THUMB_H / 2 + 20;


      // Smooth ease-out
      const eased = 1 - Math.pow(1 - Math.min(zoomP, 1), 3);
      px = (parkX - baseL) * eased;
      py = (parkY - baseT) * eased;
      // tilt inward toward card
      pr = (lay.side==='left' ? 6 : -6) * eased;
    }

    // tremble when parked and waiting to be opened
    let tx=0, ty=0, tr=0;
    if(isActive && STATE==='waiting'){
      const vt = ts * 0.001;
      tx = Math.sin(vt * 23.7) * 2.2 * (0.5 + 0.5*Math.sin(vt*1.3));
      ty = Math.cos(vt * 17.1) * 1.6 * (0.5 + 0.5*Math.cos(vt*0.9));
      tr = Math.sin(vt * 28.3) * 1.4;
    }

    const finalL = baseL + ffx + px + tx;
    const finalT = baseT + ffy + py + ty;
    th.style.transform = `translate(${finalL}px, ${finalT}px) rotate(${lay.rot + ffr + pr + tr}deg)`;

    // Position arrow group centered on thumb (no rotation)
    const ar = arrows[i];
    ar.style.transform = `translate(${finalL}px, ${finalT}px)`;
    ar.style.width  = THUMB_W + 'px';
    ar.style.height = THUMB_H + 'px';
  });

  // keep arrow overlay following active thumb
  if(STATE==='waiting' || (STATE==='zoom_in' && zoomP > 0.5)){
    positionArrows();
  }

  if (loopActive && loopRunning) requestAnimationFrame(loop);
}
// loop запускается через IntersectionObserver когда секция видна


const lbOverlay = document.getElementById('lbOverlay');
const lbBg  = document.getElementById('lbBg');
const lbBox = document.getElementById('lbBox');
const lbImg = document.getElementById('lbImg');
const lbX   = document.getElementById('lbX');
const lbArrows  = document.getElementById('lbArrows');
const lbPrevBtn = document.getElementById('lbPrev');
const lbNextBtn = document.getElementById('lbNext');
const lbArrCounter = document.getElementById('lbArrCounter');
let lbIsOpen= false;
let lbBusy  = false;
let fromRect= null;
let _lbReviewIdx = 0; // текущий индекс в лайтбоксе отзывов

function _lbReviewNav(dir) {
  _lbReviewIdx = (_lbReviewIdx + dir + REVIEWS.length) % REVIEWS.length;
  if (!lbImg) return;
  lbImg.style.opacity = '0';
  lbImg.style.transform = 'scale(0.95)';
  setTimeout(() => {
    const rev = REVIEWS[_lbReviewIdx];
    lbImg.src = rev.src;
    lbImg.alt = 'Отзыв ' + (_lbReviewIdx + 1) + ': ' + rev.text;
    lbImg.onload = () => {
      lbImg.style.opacity = '1';
      lbImg.style.transform = 'scale(1)';
    };
  }, 150);
  if (lbArrCounter) lbArrCounter.textContent = (_lbReviewIdx + 1) + ' / ' + REVIEWS.length;
}

if (lbPrevBtn) lbPrevBtn.addEventListener('click', () => _lbReviewNav(-1));
if (lbNextBtn) lbNextBtn.addEventListener('click', () => _lbReviewNav(1));

// iOS Safari: свайп по overlay для навигации (дополнительно к стрелкам)
if (lbOverlay) {
  (function(){
    let _sx = 0;
    lbOverlay.addEventListener('touchstart', e => {
      _sx = e.touches[0].clientX;
    }, { passive: true });
    lbOverlay.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _sx;
      if (Math.abs(dx) > 50) _lbReviewNav(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();
}

function lerp(a,b,t){ return a+(b-a)*t; }



function openLB(triggerEl, src, idx){
  if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
  closeCalcPanel();
  // Force-reset if stuck
  if(lbBusy){ lbBusy=false; lbIsOpen=false; lbOverlay.classList.remove('active'); }
  if(waitTimer){ clearTimeout(waitTimer); waitTimer=null; }
  hideArrows();
  lbBusy=true; lbIsOpen=true;
  lbImg.src = src;
  // Инициализируем счётчик стрелок
  _lbReviewIdx = typeof idx === 'number' ? idx : 0;
  lbImg.alt = 'Отзыв ' + (_lbReviewIdx + 1) + ': ' + REVIEWS[_lbReviewIdx].text;
  lbImg.style.opacity = '1';
  lbImg.style.transform = 'scale(1)';
  lbImg.style.transition = 'opacity 0.2s, transform 0.2s';
  if (lbArrCounter) lbArrCounter.textContent = (_lbReviewIdx + 1) + ' / ' + REVIEWS.length;

  // Use counting lock so it coexists safely with other scroll locks
  lockBody();
  lbOverlay.classList.add('active');
  if (lbX) lbX.style.pointerEvents = 'none';

  setTimeout(()=>{
    if (lbX) {
      lbX.style.opacity = '1';
      lbX.style.transform = 'scale(1)';
      lbX.style.pointerEvents = '';
    }
  }, 600);

  setTimeout(()=>{
    if (lbBox) lbBox.classList.add('clickable');
    lbBusy = false;
  }, 950);
}

function closeLB(){
  const overlay = document.getElementById('lbOverlay');
  // Allow closing even if lbIsOpen is false (e.g. opened via openChatLightbox)
  if(lbBusy) return;
  if(!lbIsOpen && !(overlay && overlay.classList.contains('active'))) return;
  lbBusy=true; lbIsOpen=false;
  if (lbBox) lbBox.classList.remove('clickable');
  if (lbX) {
    lbX.style.opacity = '0';
    lbX.style.transform = 'scale(0.5)';
    lbX.style.pointerEvents = 'none';
  }

  // Убираем класс active — CSS transition анимирует обратно
  if (lbOverlay) lbOverlay.classList.remove('active');
  // Pair with lockBody() called in openLB
  unlockBody();
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.remove('hidden');
  var mcn = document.getElementById('mcNav');
  if (mcn) { mcn.classList.remove('mc-nav--hidden'); document.body.classList.remove('mc-nav-hidden'); }

  setTimeout(()=>{
    if (lbImg) lbImg.src = '';
    lbBusy = false;
    hideArrows();
    STATE = 'zoom_out';
  }, 600);
}

function setBox(l,t,w,h,r,opacity){
  // Use individual style props to avoid wiping filter/transition set elsewhere
  lbBox.style.left         = l+'px';
  lbBox.style.top          = t+'px';
  lbBox.style.width        = w+'px';
  lbBox.style.height       = h+'px';
  lbBox.style.borderRadius = r+'px';
  lbBox.style.opacity      = opacity;
  lbBox.style.overflow     = 'hidden';
  lbBox.style.position     = 'fixed';
  lbBox.style.zIndex       = '9001';
}

function animBox(frames, times, done){
  const start = performance.now();
  function ease(t){
    // Smooth cubic ease-out — no overshoot, no elastic bounce
    return 1 - Math.pow(1 - Math.min(t, 1), 3);
  }
  function step(now){
    const elapsed = now - start;
    if(elapsed>=times[times.length-1]){ done(); return; }
    let seg=0;
    for(let i=1;i<times.length;i++){ if(elapsed<=times[i]){ seg=i-1; break; } }
    const segT = ease(Math.max(0,(elapsed-times[seg])/(times[seg+1]-times[seg])));
    const a = frames[seg], b = frames[seg+1];
    lbBox.style.left=''+lerp(a.left,b.left,segT).toFixed(1)+'px';
      lbBox.style.top=''+lerp(a.top,b.top,segT).toFixed(1)+'px';
      lbBox.style.width=''+lerp(a.w,b.w,segT).toFixed(1)+'px';
      lbBox.style.height=''+lerp(a.h,b.h,segT).toFixed(1)+'px';
      lbBox.style.borderRadius=''+lerp(a.r,b.r,segT).toFixed(1)+'px';
      lbBox.style.opacity=''+lerp(a.op,b.op,segT).toFixed(3);
      // do NOT touch filter here — managed separately
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

if (lbBg)  lbBg.addEventListener('click', closeLB);
if (lbBox) lbBox.addEventListener('click', closeLB);
if (lbX)   lbX.addEventListener('click',  closeLB);
// [P-1 FIXED] Escape for chat LB merged into unified keydown handler above.

// Сброс lbBusy если пользователь переключил вкладку во время анимации
document.addEventListener('visibilitychange', () => {
  if (document.hidden && lbBusy) {
    lbBusy = false;
  }
});

} // end reviews section guard


  // ── Обновить бейдж кнопки калькулятора ──
  function updateCalcCartBadge() {
    const badge = document.getElementById('calcCartBadge');
    if (!badge) return;
    // Считаем суммарное количество в корзине (все товары)
    const total = Object.values(cart).reduce((sum, entry) => sum + (entry.qty || 0), 0);
    const rounded = Math.round(total * 10) / 10;
    badge.textContent = rounded;
    if (rounded > 0) {
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  // ── Добавить в корзину из калькулятора с анимацией ──
  function addCalcToCartAnimated(btn) {
    addCalcToCartOnly(btn);
  }

  // Добавить в корзину БЕЗ открытия — только анимация иконки и бейдж
  function addCalcToCartOnly(btn) {
    addCalcToCart();
    updateCalcCartBadge();
    // Бейдж на кнопке-корзине
    const badge = document.getElementById('calcCartBadge');
    if (badge) {
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }
    // Анимация иконки внутри кнопки "Добавить"
    const icon = btn && btn.querySelector('.calc-add-cart-icon');
    if (icon) {
      icon.style.transform = 'scale(0.8) rotate(-12deg)';
      setTimeout(() => { icon.style.transform = ''; }, 300);
    }
    // Анимация иконки корзины-кнопки
    const cartBtn = document.getElementById('calcOpenCartBtn');
    if (cartBtn) {
      cartBtn.style.transform = 'translateY(-3px) scale(1.15)';
      setTimeout(() => { cartBtn.style.transform = ''; }, 350);
    }
  }

  // ── Добавить параметры калькулятора в корзину и открыть её ──
  function addCalcToCart() {
    const cfg = CAKE_CONFIGS[_cakeType] || CAKE_CONFIGS.biscuit;

    // Определяем product id и mode по типу торта
    const typeToProduct = {
      biscuit:   { id: 1, mode: 'regular' },
      bento:     { id: 2, mode: 'regular' },
      bentomaxi: { id: 2, mode: 'maxi'    },
      cake3d:    { id: 3, mode: 'regular' },
    };
    const mapping = typeToProduct[_cakeType];
    if (!mapping) return;

    const { id, mode } = mapping;
    // Составной ключ совпадает с форматом addToCart из каталога
    const p = products.find(x => x.id === id);

    // Читаем начинку заранее, чтобы включить в ключ корзины
    const fillEl  = document.querySelector('#' + cfg.fillGroup + ' .selected .opt-label');
    const decorEl = document.querySelector('#calcDecor .selected .opt-label');
    const fillName  = fillEl  ? fillEl.textContent.trim()  : '';
    const decorName = decorEl ? decorEl.textContent.trim() : '';

    // [CART-1] Ключ строится через buildCartKey — единую точку формирования.
    // Разные начинки/декоры → разные позиции корзины.
    const cartKey = buildCartKey(id, mode, !!(p && p.hasMaxi), fillName, decorName);

    // Определяем количество/вес
    let qty;
    if (cfg.fixedPrice !== null) {
      // бенто / макси бенто — количество штук
      qty = _calcQty;
    } else {
      // весовой — вес в кг
      qty = _calcWeight;
    }

    // Умное суммирование: если товар уже в корзине того же режима — суммируем
    if (cart[cartKey] && cart[cartKey].mode === mode) {
      const maxQty = cfg.fixedPrice !== null ? 20 : (cfg.weightMax || 20);
      cart[cartKey].qty = Math.min(
        Math.round((cart[cartKey].qty + qty) * 10) / 10,
        maxQty
      );
    } else {
      // Иначе — заменяем (другой режим или нет в корзине)
      cart[cartKey] = { qty, mode };
    }

    // Собираем заметку о начинке и декоре для отображения в корзине (уже прочитаны выше)
    // Сохраняем доп. параметры в запись корзины
    cart[cartKey].fill  = fillName;
    cart[cartKey].decor = decorName;

    updateCartUI();
    saveCartToStorage();

  }

  // ── Public API — functions called from HTML via onclick ──
  // [C-3 FIXED] toggleCalcPanel / closeCalcPanel called from HTML onclick —
  // must be on window, otherwise mobile taps throw "not a function".
  window.toggleCalcPanel = typeof toggleCalcPanel !== "undefined" ? toggleCalcPanel : undefined;
  window.closeCalcPanel  = typeof closeCalcPanel  !== "undefined" ? closeCalcPanel  : undefined;
  window.acceptCookie = typeof acceptCookie !== "undefined" ? acceptCookie : undefined;
  window.declineCookie = typeof declineCookie !== "undefined" ? declineCookie : undefined;
  window.addToCart = typeof addToCart !== "undefined" ? addToCart : undefined;
  window.buildTG = typeof buildTG !== "undefined" ? buildTG : undefined;
  window.buildWA = typeof buildWA !== "undefined" ? buildWA : undefined;
  window.changeQty = typeof changeQty !== "undefined" ? changeQty : undefined;
  window.clearCart = typeof clearCart !== "undefined" ? clearCart : undefined;
  window.closeCart = typeof closeCart !== "undefined" ? closeCart : undefined;
  window.closeFillPopup = typeof closeFillPopup !== "undefined" ? closeFillPopup : undefined;
  window.closeLightbox = typeof closeLightbox !== "undefined" ? closeLightbox : undefined;
  window.closeMobileMenu = typeof closeMobileMenu !== "undefined" ? closeMobileMenu : undefined;
  window.closePrivacy = typeof closePrivacy !== "undefined" ? closePrivacy : undefined;
  window.closeReviewsModal = typeof closeReviewsModal !== "undefined" ? closeReviewsModal : undefined;
  window.confirmFillSelection = typeof confirmFillSelection !== "undefined" ? confirmFillSelection : undefined;
  window.goBackToCart = typeof goBackToCart !== "undefined" ? goBackToCart : undefined;
  window.goToFormStep = typeof goToFormStep !== "undefined" ? goToFormStep : undefined;
  window.enforceSingleSelected = typeof enforceSingleSelected !== "undefined" ? enforceSingleSelected : undefined;
  window.selectCakeType = typeof selectCakeType !== "undefined" ? selectCakeType : undefined;
  window.addCalcToCart         = typeof addCalcToCart         !== "undefined" ? addCalcToCart         : undefined;
  window.addCalcToCartAnimated = typeof addCalcToCartAnimated !== "undefined" ? addCalcToCartAnimated : undefined;
  window.addCalcToCartOnly     = typeof addCalcToCartOnly     !== "undefined" ? addCalcToCartOnly     : undefined;
  window.updateCalcCartBadge   = typeof updateCalcCartBadge   !== "undefined" ? updateCalcCartBadge   : undefined;

  // Инициализируем бейдж при загрузке
  if (typeof updateCalcCartBadge === 'function') {
    document.addEventListener('DOMContentLoaded', updateCalcCartBadge);
    if (document.readyState !== 'loading') updateCalcCartBadge();
  }
  window.stepQty = typeof stepQty !== "undefined" ? stepQty : undefined;
  window.goSlide = typeof goSlide !== "undefined" ? goSlide : undefined;
  window.goTo = typeof goTo !== "undefined" ? goTo : undefined;
  window.scrollToProduct = typeof scrollToProduct !== "undefined" ? scrollToProduct : undefined;
  window.lbNavigate = typeof lbNavigate !== "undefined" ? lbNavigate : undefined;
  window.navigateToStep = typeof navigateToStep !== "undefined" ? navigateToStep : undefined;
  window.openCart = typeof openCart !== "undefined" ? openCart : undefined;
  window.openChatLightbox = typeof openChatLightbox !== "undefined" ? openChatLightbox : undefined;
  window.openLightbox = typeof openLightbox !== "undefined" ? openLightbox : undefined;
  window.openPrivacy = typeof openPrivacy !== "undefined" ? openPrivacy : undefined;
  window.openReviewsModal = typeof openReviewsModal !== "undefined" ? openReviewsModal : undefined;
  window.removeFromCart = typeof removeFromCart !== "undefined" ? removeFromCart : undefined;
  window.selectOpt = typeof selectOpt !== "undefined" ? selectOpt : undefined;
  window.sendFormWA = typeof sendFormWA !== "undefined" ? sendFormWA : undefined;
  window.showBentoWeightToast = typeof showBentoWeightToast !== "undefined" ? showBentoWeightToast : undefined;
  window.sliderStep = typeof sliderStep !== "undefined" ? sliderStep : undefined;
  window.stepWeight = typeof stepWeight !== "undefined" ? stepWeight : undefined;
  window.switchBentoTab = typeof switchBentoTab !== "undefined" ? switchBentoTab : undefined;
  window.switchReviewsTab = typeof switchReviewsTab !== "undefined" ? switchReviewsTab : undefined;

})();

/* ── Calc result: magnetic parallax ── */
(function() {
  function initCalcMagnet() {
    var block  = document.querySelector('.calc-result');
    if (!block) return;
    var label  = document.getElementById('calcLabel');
    var price  = document.getElementById('calcResult');
    var note   = document.getElementById('calcNote');
    var btn    = block.querySelector('.calc-order-btn');

    block.addEventListener('mousemove', function(e) {
      var r = block.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width  - 0.5;
      var y = (e.clientY - r.top)  / r.height - 0.5;
      if (label) label.style.transform = 'translate(' + (x*5)+'px,' + (y*3)+'px)';
      if (price) price.style.transform = 'scale(1.05) translate(' + (x*9)+'px,' + (y*6)+'px)';
      if (note)  note.style.transform  = 'translate(' + (x*4)+'px,' + (y*2)+'px)';
      if (btn)   btn.style.transform   = 'translate(' + (x*6)+'px,' + (y*4)+'px) translateY(-2px)';
    });

    block.addEventListener('mouseleave', function() {
      [label, price, note].forEach(function(el) { if (el) el.style.transform = ''; });
      if (btn) btn.style.transform = '';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCalcMagnet);
  else initCalcMagnet();
})();

// ══════════════════════════════════════════════
// MOBILE ENHANCEMENTS
// ══════════════════════════════════════════════
(function() {
  var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var isTouch  = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) return;

  // ── 1. HAPTIC FEEDBACK ──────────────────────
  // Different vibration patterns per element type
  function vibe(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  document.addEventListener('touchstart', function(e) {
    var t = e.target;

    // Primary CTA buttons — satisfying pulse
    if (t.closest('.btn-primary, .btn-primary--hero')) {
      vibe([8, 30, 10]);
      return;
    }
    // Messenger buttons — light single tap
    if (t.closest('.btn-hero-messenger')) {
      vibe(7);
      return;
    }
    // Bottom nav ORDER button — stronger pulse (checked BEFORE .bottom-nav-item
    // because it carries both classes: "bottom-nav-item bottom-nav-item--order")
    if (t.closest('.bottom-nav-item--order')) {
      vibe([8, 25, 8]);
      return;
    }
    // Bottom nav items — ultra light
    if (t.closest('.bottom-nav-item')) {
      vibe(5);
      return;
    }
    // [MOB-4 FIXED] .btn-add lives INSIDE .product-card — must be checked first.
    // Old order: .product-card matched first → vibe(6) → early return →
    // the stronger "add to cart" pattern [8,40,8] never fired.
    if (t.closest('.btn-add, .cart-add-btn, .cart-confirm-btn, [onclick*="addToCart"], [onclick*="openCart"]')) {
      vibe([8, 40, 8]);
      return;
    }
    // Product cards — gentle tap
    if (t.closest('.product-card, .catalog-nav-item')) {
      vibe(6);
      return;
    }
    // Filling / decor options — minimal
    if (t.closest('.calc-opt')) {
      vibe(5);
      return;
    }
    // Review cards
    if (t.closest('.review-card, .map-review-item')) {
      vibe(4);
      return;
    }
    // Accordion / toggle elements
    if (t.closest('.faq-question, .about-compact summary, details summary')) {
      vibe(6);
      return;
    }
    // Lightbox open
    if (t.closest('.slide-img img, .gallery-img, .photo-thumb')) {
      vibe([5, 20, 5]);
      return;
    }
    // Send order — celebratory triple pulse
    if (t.closest('[onclick*="buildWA"], [onclick*="buildTG"], .btn-wa, .send-order')) {
      vibe([8, 30, 10, 30, 15]);
      return;
    }
  }, { passive: true });


  // ── 2. FILMSTRIP SCROLL DISCOVERABILITY (MOB-6) ──────────
  // On mobile (≤600px) the review filmstrip scrolls horizontally.
  // New users have no indication that content extends past the viewport.
  // Fix: (a) one-time nudge animation when filmstrip first enters view,
  //      (b) right-edge fade gradient that disappears once scrolled to end.
  (function() {
    if (window.innerWidth > 600) return;
    var filmstrip = document.querySelector('.review-filmstrip');
    var filmwrap  = document.querySelector('.review-filmstrip-wrap');
    if (!filmstrip || !filmwrap) return;

    // (b) Hide gradient when user scrolled all the way right
    filmstrip.addEventListener('scroll', function() {
      var atEnd = filmstrip.scrollLeft + filmstrip.clientWidth >= filmstrip.scrollWidth - 8;
      filmwrap.classList.toggle('at-end', atEnd);
    }, { passive: true });

    // (a) Nudge once when filmstrip comes into view — only if never interacted.
    // We animate scrollLeft, NOT translateX on the container.
    // translateX would shift the whole block off-screen; scrollLeft is the correct
    // way to reveal hidden content inside a scroll container.
    var nudgeDone = false;
    var io = new IntersectionObserver(function(entries) {
      if (nudgeDone) return;
      if (!entries[0].isIntersecting) return;
      nudgeDone = true;
      io.disconnect();
      setTimeout(function() {
        if (filmstrip.scrollLeft > 0) return; // user already scrolled — skip
        // Peek animation: scroll right to reveal next item, then scroll back
        var peekPx = 56;
        filmstrip.scrollTo({ left: peekPx, behavior: 'smooth' });
        setTimeout(function() {
          filmstrip.scrollTo({ left: 0, behavior: 'smooth' });
        }, 540);
      }, 700);
    }, { threshold: 0.5 });
    io.observe(filmstrip);
  })();

  // ── 3. GYROSCOPE PARALLAX on hero photo ─────
  var heroBg = document.getElementById('heroPhotoBg');
  if (heroBg && window.DeviceOrientationEvent) {
    var baseGamma = null, baseBeta = null;
    var curX = 0, curY = 0;
    var targetX = 0, targetY = 0;
    var rafId = null;
    var MAX_SHIFT = 14; // px max shift

    function lerp(a, b, t) { return a + (b - a) * t; }

    function animateParallax() {
      curX = lerp(curX, targetX, 0.06);
      curY = lerp(curY, targetY, 0.06);
      heroBg.style.transform = 'translate(' + curX.toFixed(2) + 'px,' + curY.toFixed(2) + 'px) scale(1.06)';
      rafId = requestAnimationFrame(animateParallax);
    }

    function onOrientation(e) {
      // Calibrate on first reading
      if (baseGamma === null) { baseGamma = e.gamma || 0; baseBeta = e.beta || 0; }

      var dg = Math.max(-25, Math.min(25, (e.gamma  || 0) - baseGamma));
      var db = Math.max(-20, Math.min(20, (e.beta   || 0) - baseBeta));

      targetX = -(dg / 25) * MAX_SHIFT;
      targetY = -(db / 20) * (MAX_SHIFT * 0.6);
    }

    // Request permission on iOS 13+
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      var heroSection = document.getElementById('home');
      if (heroSection) {
        heroSection.addEventListener('touchstart', function startGyro() {
          DeviceOrientationEvent.requestPermission().then(function(state) {
            if (state === 'granted') {
              window.addEventListener('deviceorientation', onOrientation, { passive: true });
              animateParallax();
            }
          }).catch(function(){});
          heroSection.removeEventListener('touchstart', startGyro);
        }, { once: true, passive: true });
      }
    } else {
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
    }

    // Pause when hero is not visible — также отключаем deviceorientation
    var gyroActive = false;
    var heroObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          if (!rafId) animateParallax();
          if (!gyroActive) {
            window.addEventListener('deviceorientation', onOrientation, { passive: true });
            gyroActive = true;
          }
        } else {
          if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
          heroBg.style.transform = '';
          window.removeEventListener('deviceorientation', onOrientation);
          gyroActive = false;
        }
      });
    }, { threshold: 0.1 });
    heroObserver.observe(document.getElementById('home'));

    // Пауза при уходе в фон — экономим батарею
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        window.removeEventListener('deviceorientation', onOrientation);
        gyroActive = false;
      }
    });
  }


  // ── 4. PULL-TO-REFRESH ──────────────────────
  var PTR_THRESHOLD = 65;
  var PTR_MAX       = 80;
  var ptrActive     = false;
  var ptrStartY     = 0;
  var ptrCurrent    = 0;
  var ptrBusy       = false;

  // Create indicator element lazily on first relevant touchstart
  var ptrIndicator = null;
  var ptrSpinner   = null;
  var ptrLabel     = null;

  function _ensurePtrIndicator() {
    if (ptrIndicator) return;
    ptrIndicator = document.createElement('div');
    ptrIndicator.id = 'ptrIndicator';
    ptrIndicator.style.cssText = [
      'position:fixed',
      'top:0', 'left:0', 'right:0',
      'height:56px',
      'display:flex', 'align-items:center', 'justify-content:center', 'gap:8px',
      'transform:translateY(-56px)',
      'transition:none',
      'z-index:' + (460),
      'pointer-events:none',
      'will-change:transform'
    ].join(';');

    ptrIndicator.innerHTML = [
      '<div id="ptrSpinner" style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(201,147,74,0.25);border-top-color:#c9934a;flex-shrink:0"></div>',
      '<span id="ptrLabel" style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.06em;font-family:Jost,sans-serif;text-transform:uppercase">Потяни ещё</span>'
    ].join('');

    document.body.appendChild(ptrIndicator);

    ptrSpinner = document.getElementById('ptrSpinner');
    ptrLabel   = document.getElementById('ptrLabel');

    var spinStyle  = document.createElement('style');
    spinStyle.textContent = '@keyframes ptrSpin{to{transform:rotate(360deg)}} .ptr-spinning{animation:ptrSpin 0.65s linear infinite!important}';
    document.head.appendChild(spinStyle);
  }

  // [C-1 FIXED] Removed orphan head-append of spinStyle that was outside
  // _ensurePtrIndicator — caused ReferenceError in strict mode,
  // breaking all PTR touch handlers registration.

  function setPtrPos(dy) {
    var d = Math.min(dy, PTR_MAX);
    var progress = d / PTR_THRESHOLD;
    ptrIndicator.style.transform = 'translateY(' + (d - 56) + 'px)';
    ptrIndicator.style.background = 'rgba(28,20,16,' + Math.min(progress * 0.85, 0.85) + ')';
    ptrLabel.textContent = d >= PTR_THRESHOLD ? 'Отпусти' : 'Потяни ещё';
    ptrSpinner.style.opacity = Math.min(progress, 1);
    if (d >= PTR_THRESHOLD) ptrSpinner.classList.add('ptr-spinning');
    else ptrSpinner.classList.remove('ptr-spinning');
  }

  function ptrRelease(dy) {
    ptrActive = false;
    document.body.style.overscrollBehaviorY = '';
    if (dy >= PTR_THRESHOLD && !ptrBusy) {
      ptrBusy = true;
      setPtrPos(PTR_MAX);
      ptrSpinner.classList.add('ptr-spinning');
      ptrLabel.textContent = 'Обновляем...';
      vibe([8, 40, 8]);

      setTimeout(function() {
        ptrSpinner.classList.remove('ptr-spinning');
        ptrLabel.textContent = '✓ Обновлено';
        ptrIndicator.style.transition = 'transform 0.4s ease, background 0.4s ease';
        ptrIndicator.style.transform = 'translateY(-56px)';
        ptrIndicator.style.background = 'transparent';
        setTimeout(function() {
          ptrIndicator.style.transition = 'none';
          ptrBusy = false;
          // Кастомное событие вместо жёсткого reload — можно перехватить
          var ev = new CustomEvent('ptr:refresh', { bubbles: true, cancelable: true });
          var cancelled = !document.dispatchEvent(ev);
          if (!cancelled) window.location.reload();
        }, 500);
      }, 1000);
    } else {
      ptrIndicator.style.transition = 'transform 0.3s ease, background 0.3s ease';
      ptrIndicator.style.transform = 'translateY(-56px)';
      ptrIndicator.style.background = 'transparent';
      setTimeout(function() { ptrIndicator.style.transition = 'none'; }, 350);
    }
  }

  document.addEventListener('touchstart', function(e) {
    if (ptrBusy) return;
    // iOS rubber-band: scrollY может быть отрицательным — не запускаем PTR
    var sy = window.scrollY;
    if (sy > 16 || sy < 0) return;
    _ensurePtrIndicator();
    // Don't trigger PTR when any overlay / modal / drawer is open
    if (document.body.classList.contains('cart-open') ||
        document.body.classList.contains('fill-open') ||
        document.body.classList.contains('menu-open')) return;
    var _lbEl = document.getElementById('lightbox');
    if (_lbEl && _lbEl.classList.contains('open')) return;
    var _rmEl = document.getElementById('reviewsModal');
    if (_rmEl && _rmEl.classList.contains('open')) return;
    var _prEl = document.getElementById('privacyOverlay');
    if (_prEl && _prEl.classList.contains('open')) return;
    ptrStartY  = e.touches[0].clientY;
    ptrCurrent = 0;
    ptrActive  = true;
    document.body.style.overscrollBehaviorY = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!ptrActive) return;
    var dy = e.touches[0].clientY - ptrStartY;
    if (dy < 0) { ptrActive = false; document.body.style.overscrollBehaviorY = ''; return; }
    ptrCurrent = dy;
    setPtrPos(dy * 0.55); // resistance factor
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (!ptrActive) return;
    ptrRelease(ptrCurrent * 0.55);
  }, { passive: true });


})();


// ── Fill tooltip: position:fixed + SVG-капля Безье ──
(function initFillTooltips() {
  const ARROW_SVG = '<svg class="fill-tooltip-arrow" width="18" height="10" viewBox="0 0 18 10" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 18,0 9,10" fill="#3d2b1f"/></svg>';
  let hideTimer = null;
  let activeTip = null;

  function showTip(tip, opt) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    // Скрываем предыдущий тултип если это другой
    if (activeTip && activeTip !== tip) {
      activeTip.style.opacity = '0';
      activeTip.style.pointerEvents = 'none';
    }
    activeTip = tip;
    // position:fixed — координаты относительно вьюпорта (getBoundingClientRect)
    const r = opt.getBoundingClientRect();
    let left = r.left + r.width / 2 - 110;
    let top  = r.top - 14;
    left = Math.max(8, Math.min(left, window.innerWidth - 228));
    tip.style.left = left + 'px';
    tip.style.top  = top + 'px';
    tip.style.transform = 'translateY(-100%) translateY(-4px)';
    tip.style.opacity = '1';
    tip.style.pointerEvents = 'all';
  }

  function hideTip(tip, delay) {
    hideTimer = setTimeout(() => {
      tip.style.opacity = '0';
      tip.style.pointerEvents = 'none';
      if (activeTip === tip) activeTip = null;
      hideTimer = null;
    }, delay || 120);
  }

  function bindTooltips() {
    document.querySelectorAll('.calc-opt').forEach(opt => {
      if (opt._tooltipBound) return;
      opt._tooltipBound = true;
      const tip = opt.querySelector('.fill-tooltip');
      if (!tip) return;

      if (!tip.querySelector('.fill-tooltip-arrow')) {
        tip.insertAdjacentHTML('beforeend', ARROW_SVG);
      }

      // Переносим тултип в body чтобы transform родителей не ломал position:fixed
      document.body.appendChild(tip);

      // Начальное состояние
      tip.style.opacity = '0';
      tip.style.pointerEvents = 'none';

      opt.addEventListener('mouseenter', () => showTip(tip, opt));
      opt.addEventListener('mousemove', () => showTip(tip, opt));
      opt.addEventListener('mouseleave', () => hideTip(tip, 120));

      // Держим тултип пока мышь на нём
      tip.addEventListener('mouseenter', () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      });
      tip.addEventListener('mouseleave', () => hideTip(tip, 80));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTooltips);
  } else {
    bindTooltips();
  }
  // Single call is sufficient — _tooltipBound guard prevents double-bind
})();


// ── Content block: вкусы и FAQ ──
function selectBiscuit(el, type) {
  document.querySelectorAll('#calcBiscuitSeg .calc-biscuit-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  // Store selection for buildMessage
  window._calcBiscuit = type;
}
window.selectBiscuit = selectBiscuit;

function cbFlavor(id, btn) {
  document.querySelectorAll('.cb-fp').forEach(p => p.classList.remove('cb-on'));
  document.querySelectorAll('.cb-ftab').forEach(t => t.classList.remove('cb-on'));
  const el = document.getElementById('cb-' + id);
  if (el) el.classList.add('cb-on');
  if (btn) btn.classList.add('cb-on');
}
function cbFaq(item) {
  const isOpen = item.classList.contains('cb-open');
  document.querySelectorAll('.cb-faq-item.cb-open').forEach(i => i.classList.remove('cb-open'));
  if (!isOpen) item.classList.add('cb-open');
}
window.cbFlavor = cbFlavor;
window.cbFaq = cbFaq;


// ── Gold Stars — искры при тапе на кнопку «Заказать» ──
(function() {
  'use strict';

  var CHARS = ['★','✦','✧','⋆','·','✶'];
  var COLORS = [
    'rgba(245,219,160,1)',
    'rgba(201,147,74,1)',
    'rgba(255,235,185,1)',
    'rgba(212,167,106,1)',
    'rgba(255,245,210,0.9)',
  ];

  // CSS вставляем один раз
  var style = document.createElement('style');
  style.textContent = [
    '@keyframes goldStarFly{',
      '0%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1;}',
      '60%{opacity:0.8;}',
      '100%{transform:translate(var(--sx),var(--sy)) scale(0) rotate(var(--sr));opacity:0;}',
    '}',
    '.gold-star{',
      'position:fixed;pointer-events:none;z-index:99998;',
      'font-style:normal;line-height:1;',
      'animation:goldStarFly var(--sd) cubic-bezier(.25,.46,.45,.94) forwards;',
      'will-change:transform,opacity;',
    '}',
  ].join('');
  document.head.appendChild(style);

  function burst(cx, cy) {
    var count = 18; // было 12 — теперь 18
    for (var i = 0; i < count; i++) {
      (function(i) {
        var delay = Math.random() * 80;
        setTimeout(function() {
          var el = document.createElement('span');
          el.className = 'gold-star';

          // Угол с небольшим разбросом
          var angle = (i / count) * 360 + (Math.random() - 0.5) * 28;
          var rad   = angle * Math.PI / 180;

          // Дальность — было 28-60, теперь 38-78
          var dist  = 38 + Math.random() * 40;
          var sx    = Math.cos(rad) * dist;
          var sy    = Math.sin(rad) * dist - (Math.random() * 18 + 8);

          var size  = 10 + Math.random() * 8; // было 8-14, теперь 10-18
          var dur   = (0.75 + Math.random() * 0.45) + 's';
          var rot   = (Math.random() - 0.5) * 200 + 'deg';
          var color = COLORS[Math.floor(Math.random() * COLORS.length)];
          var char  = CHARS[Math.floor(Math.random() * CHARS.length)];

          el.style.cssText = [
            'left:' + (cx - size/2) + 'px',
            'top:' + (cy - size/2) + 'px',
            'font-size:' + size + 'px',
            'color:' + color,
            '--sx:' + sx + 'px',
            '--sy:' + sy + 'px',
            '--sd:' + dur,
            '--sr:' + rot,
          ].join(';');
          el.textContent = char;

          document.body.appendChild(el);
          var ms = parseFloat(dur) * 1000 + 100;
          setTimeout(function() { if (el.parentNode) el.remove(); }, ms);
        }, delay);
      })(i);
    }
  }

  function bindStars(el) {
    if (el._goldStarBound) return;
    el._goldStarBound = true;
    el.addEventListener('touchstart', function(e) {
      var t = e.touches[0];
      burst(t.clientX, t.clientY);
    }, { passive: true });
    // На десктопе — по клику
    el.addEventListener('click', function(e) {
      if (e.isTrusted) burst(e.clientX, e.clientY);
    });
  }

  function init() {
    // Кнопка «Заказать» в bottom-nav (наш новый mcNav)
    var mcOrder = document.querySelector('.mc-btn--order');
    if (mcOrder) bindStars(mcOrder);

    // Старая кнопка bottom-nav
    var bnOrder = document.querySelector('.bottom-nav-item--order');
    if (bnOrder) bindStars(bnOrder);

    // Hero-кнопка «Выбрать торт»
    var heroBtn = document.querySelector('.btn-primary--hero');
    if (heroBtn) bindStars(heroBtn);

    // Кнопка в калькуляторе
    var calcBtn = document.querySelector('.calc-add-btn');
    if (calcBtn) bindStars(calcBtn);
  }

  // Запуск после рендера
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // MutationObserver — подхватит mcNav который строится позже
  (function waitForMcOrder() {
        var attempts = 0;
        function check() {
            var mcOrder = document.querySelector('.mc-btn--order');
            if (mcOrder && !mcOrder._goldStarBound) { bindStars(mcOrder); return; }
            if (++attempts < 20) setTimeout(check, 500);
        }
        setTimeout(check, 1000);
    })();

})();

/* ══════════════════════════════════════════════════════════════
   PATCH R11 — accessibility hardening for div/span controls
   Makes legacy onclick-based visual controls keyboard reachable without
   rewriting the whole static HTML/catalog renderer.
   ══════════════════════════════════════════════════════════════ */
(function r11InteractiveA11y(){
  'use strict';

  var SELECTOR = [
    '.calc-opt',
    '.calc-biscuit-opt',
    '.calc-result-collapsed',
    '.cb-faq-item',
    '.faq-item',
    '.cart-step',
    '.dot',
    '[onclick]:not(a):not(button):not(input):not(textarea):not(select):not(.cart-overlay):not([id$=\"Overlay\"]):not([class*=\"overlay\"])'
  ].join(',');

  function labelFor(el) {
    if (!el) return 'Интерактивный элемент';
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 120);
    if (el.classList && el.classList.contains('dot')) return 'Перейти к слайду';
    return 'Интерактивный элемент';
  }

  function enhance(root) {
    root = root || document;
    if (!root.querySelectorAll) return;
    root.querySelectorAll(SELECTOR).forEach(function(el) {
      if (el.matches('a,button,input,textarea,select')) return;
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', labelFor(el));
      if (el.classList && (el.classList.contains('calc-opt') || el.classList.contains('calc-biscuit-opt') || el.classList.contains('cart-step'))) {
        el.setAttribute('aria-pressed', el.classList.contains('selected') || el.classList.contains('active') ? 'true' : 'false');
      }
    });
  }

  function syncPressed(el) {
    if (!el || !el.classList) return;
    var group = null;
    if (el.classList.contains('calc-opt') || el.classList.contains('calc-biscuit-opt')) group = el.parentElement;
    if (el.classList.contains('cart-step')) group = el.parentElement;
    var nodes = group ? group.querySelectorAll('[role="button"]') : [el];
    Array.prototype.forEach.call(nodes, function(n) {
      if (n.classList && (n.classList.contains('calc-opt') || n.classList.contains('calc-biscuit-opt') || n.classList.contains('cart-step'))) {
        n.setAttribute('aria-pressed', n.classList.contains('selected') || n.classList.contains('active') ? 'true' : 'false');
      }
    });
  }

  function init() {
    enhance(document);

    document.addEventListener('keydown', function(e) {
      var el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!el || el.matches('a,button,input,textarea,select')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
        setTimeout(function(){ syncPressed(el); }, 0);
      }
    });

    document.addEventListener('click', function(e) {
      var el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (el) setTimeout(function(){ syncPressed(el); }, 0);
    }, true);

    if ('MutationObserver' in window) {
      var mo = new MutationObserver(function(muts) {
        muts.forEach(function(m) {
          m.addedNodes && Array.prototype.forEach.call(m.addedNodes, function(node) {
            if (node.nodeType === 1) {
              if (node.matches && node.matches(SELECTOR)) enhance({ querySelectorAll: function(){ return [node]; } });
              enhance(node);
            }
          });
        });
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
