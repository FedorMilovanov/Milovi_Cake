(function () {
  'use strict';

/* ═══════════════════════════════════════════════════════
   MILOVI CAKE — Общий JavaScript
   
   В HTML страниц перед подключением этого файла объявите:
   
   Главная:    <script>var IMG_BASE = 'img';</script>
   Пригороды:  <script>var IMG_BASE = '../../img';</script>
═══════════════════════════════════════════════════════ */

// ── DATA ──
const products = [
  { id: 1, name: 'Бисквитный торт', desc: 'Воздушный торт с нежнейшим кремом и авторским декором', min: 'Заказ от 2 кг, декор рассчитывается отдельно', price: 'от 2 800 ₽/кг', priceNum: 2800, unit: 'кг', minKg: 2, emoji: '🎂',
    slides: [IMG_BASE + '/cake_biscuit_0.webp', IMG_BASE + '/cake_biscuit_1.webp', IMG_BASE + '/cake_biscuit_2.webp', IMG_BASE + '/cake_biscuit_3.webp', IMG_BASE + '/cake_biscuit_4.webp', IMG_BASE + '/cake_biscuit_5.webp'],
    slidePos: ['center 30%', 'center 25%', 'center 20%', 'center 30%', 'center 20%'] },
  { id: 2, name: 'Бенто торт', desc: 'Миниатюрный торт — идеальный подарок для особенного момента', min: '', price: '1 600 ₽', priceNum: 1600, unit: 'шт', emoji: '🍰',
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
  { id: 3, name: '3D Торт', desc: 'Уникальный дизайнерский торт с объёмными элементами', min: 'Заказ от 3 кг', price: '4 000 ₽/кг', priceNum: 4000, unit: 'кг', minKg: 3, emoji: '✨',
    slides: [IMG_BASE + '/cake_3d.webp', IMG_BASE + '/cake_3d_2.webp'],
    slidePos: ['center 30%', 'center 10%'],
    slideScale: [1, 1] },
  { id: 4, name: 'Меренговый рулет', desc: 'Хрустящая меренга с нежным кремом — наш фирменный десерт', min: '', price: '2 500 ₽/шт', priceNum: 2500, unit: 'шт', emoji: '🥐',
    slides: [IMG_BASE + '/meringue_roll.webp', IMG_BASE + '/meringue_roll_2.webp', IMG_BASE + '/meringue_roll_3.webp'],
    slidePos: ['center 35%', 'center 40%', 'center 35%'] },
  { id: 5, name: 'Пирожное "Павлова"', minQty: 2, desc: 'Воздушная меренга с кремом и начинкой из ягод', min: 'Заказ от 2 шт', price: '350 ₽/шт', priceNum: 350, unit: 'шт', emoji: '🍓',
    slides: [IMG_BASE + '/pavlova.webp', IMG_BASE + '/pavlova_2.webp', IMG_BASE + '/pavlova_3.webp'],
    slidePos: ['center 55%', 'center 45%', 'center 50%'] },
  { id: 6, name: 'Капкейки', minQty: 6, desc: 'Набор изящных капкейков с разными вкусами', min: 'Заказ от 6 шт одного вкуса', price: '350 ₽/шт', priceNum: 350, unit: 'шт', emoji: '🧁',
    slides: [IMG_BASE + '/cupcakes.webp', IMG_BASE + '/cupcakes_2.webp'],
    slidePos: ['center 35%', 'center 40%', 'center 35%'] },
];

// cart: { [id]: { qty: number } }  — for kg-products qty is in kg (step 0.5)
let cart = {};

const slideTimers = {};

function renderCatalog() {
  Object.values(slideTimers).forEach(id => clearInterval(id));
  Object.keys(slideTimers).forEach(k => delete slideTimers[k]);

  const grid = document.getElementById('catalogGrid');
  grid.innerHTML = products.map(p => {
    let imgHtml;
    if (p.slides && p.slides.length) {
      const totalSlides = p.slides.length;
      imgHtml = `
        <div class="slider-wrap" id="slider-${p.id}">
          ${p.slides.map((src, i) => {
            const active = i === 0 ? ' active' : '';
            return `<div class="slide-img${active}">
              <img src="${src}" alt="${p.name}" loading="${i === 0 ? 'eager' : 'lazy'}" onerror="this.style.display='none'" />
            </div>`;
          }).join('')}
          ${totalSlides > 1 ? `
            <button class="slide-btn slide-prev" onclick="sliderStep('${p.id}',-1,${totalSlides})" aria-label="Назад">&#8249;</button>
            <button class="slide-btn slide-next" onclick="sliderStep('${p.id}',1,${totalSlides})" aria-label="Вперёд">&#8250;</button>
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
          <button class="btn-add" onclick="addToCart(${p.id}, event)">Добавить в корзину</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Auto-slide (store IDs to allow cleanup)
  products.forEach(p => {
    if (p.slides && p.slides.length > 1) {
      let cur = 0;
      slideTimers[p.id] = setInterval(() => {
        if (document.hidden) return; // не крутим когда вкладка неактивна
        cur = (cur + 1) % p.slides.length;
        goSlide(p.id, cur);
      }, 3000);
      // Add touch swipe after DOM renders
      setTimeout(() => addSliderTouch(p.id, p.slides.length), 100);
    }
  });

  observeReveal();
}

function goSlide(pid, idx) {
  const wrap = document.getElementById('slider-' + pid);
  if (!wrap) return;
  const slides = wrap.querySelectorAll('.slide-img');
  slides.forEach((el, i) => {
    const wasActive = el.classList.contains('active');
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
  // Reset auto-slide timer
  if (slideTimers[pid]) { clearInterval(slideTimers[pid]); delete slideTimers[pid]; }
  if (total > 1) {
    slideTimers[pid] = setInterval(() => {
      if (document.hidden) return;
      sliderCurrentIdx[pid] = ((sliderCurrentIdx[pid] || 0) + 1) % total;
      goSlide(pid, sliderCurrentIdx[pid]);
    }, 3000);
  }
}

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
    const dotsEl = wrap.querySelector('.slider-dots');

    // Build new slides
    let newSlidesHtml = '';
    slides.forEach((src, i) => {
      const active = i === 0 ? ' active' : '';
      newSlidesHtml += `<img src="${src}" alt="${variant.name}" class="slide-img${active}"
        onerror="this.style.cssText='display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;font-size:60px;background:linear-gradient(135deg,#e8d8c4,#d4b896);'; this.src=''; this.alt='🎂'"
        style="object-position:${positions[i]};transform:scale(${scales[i]});transform-origin:${positions[i]};">`;
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

    // Restart auto-slide timer
    if (slideTimers[pid]) { clearInterval(slideTimers[pid]); delete slideTimers[pid]; }
    if (slides.length > 1) {
      slideTimers[pid] = setInterval(() => {
        sliderCurrentIdx[pid] = ((sliderCurrentIdx[pid] || 0) + 1) % slides.length;
        goSlide(pid, sliderCurrentIdx[pid]);
      }, 3000);
    }
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
      // Validate: keep only items that exist in products
      Object.keys(parsed).forEach(id => {
        if (products.find(p => p.id === +id)) {
          cart[id] = parsed[id];
          // ✅ Баг 1: восстановить bento mode чтобы UI таб подсвечивался правильно
          if (parsed[id].mode) {
            bentoModes[+id] = parsed[id].mode;
          }
        }
      });
    }
  } catch(e) {}
}

// ── Confetti burst ──
function confettiBurst(x, y) {
  const colors = ["#c9934a", "#d4a76a", "#e8c080", "#f5e1c0", "#fff"];
  for (let i = 0; i < 20; i++) {
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
  // If bento and in maxi mode, use maxi variant data
  if (p && p.hasMaxi && mode === 'maxi') {
    p = { ...p, ...p.maxiVariant };
  }
  if (!cart[id]) {
    // Default: 1 шт or minimum kg
    const defaultQty = p.unit === 'кг' ? (p.minKg || 1) : 1;
    cart[id] = { qty: defaultQty, mode };
  } else {
    // If mode changed, reset qty for new mode
    if (cart[id].mode !== mode) {
      const defaultQty = p.unit === 'кг' ? (p.minKg || 1) : 1;
      cart[id] = { qty: defaultQty, mode };
    } else {
      const step = p.unit === 'кг' ? 0.5 : 1;
      cart[id].qty = Math.round((cart[id].qty + step) * 10) / 10;
    }
  }
  updateCartUI();
  saveCartToStorage();
  if (e) confettiBurst(e.clientX, e.clientY);
}

function removeFromCart(id) {
  // Анимируем удаление одного элемента
  const items = document.querySelectorAll('.cart-item');
  // Находим нужный по data или порядку — ищем по onclick
  let targetEl = null;
  items.forEach(el => {
    if (el.querySelector(`[onclick="removeFromCart(${id})"]`)) targetEl = el;
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
      updateCartUI();
      saveCartToStorage();
    }, 350);
  } else {
    delete cart[id];
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
      <button id="cartClearNo" style="
        background: none; border: 1.5px solid var(--cream-dark);
        border-radius: 50px; padding: 10px 28px;
        font-family: 'Jost',sans-serif; font-size: 14px;
        color: var(--text-muted); cursor: pointer;
        transition: border-color 0.2s, color 0.2s;
      ">Нет</button>
      <button id="cartClearYes" style="
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
      document.getElementById('cartFooter').style.display = 'none';
      document.getElementById('cartBody').style.display = '';
      updateCartUI();
    }, cartItems.length * 50 + 200);
  };
}

function changeQty(id, delta) {
  let p = products.find(x => x.id === id);
  if (p && p.hasMaxi && cart[id] && cart[id].mode === 'maxi') {
    p = { ...p, ...p.maxiVariant };
  }
  const step = p.unit === 'кг' ? 0.5 : 1;
  // ✅ Баг 3: используем minQty из продукта (Павлова=2, Капкейки=6)
  const minQty = p.minQty || (p.unit === 'кг' ? (p.minKg || 1) : 1);
  cart[id].qty = Math.round((cart[id].qty + delta * step) * 10) / 10;
  if (cart[id].qty < minQty) {
    delete cart[id];
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
    s.classList.remove('active', 'done');
    if (i + 1 < step) s.classList.add('done');
    else if (i + 1 === step) s.classList.add('active');
  });
  lines.forEach((l, i) => {
    l.classList.toggle('done', i + 1 < step);
  });
}

function updateCartUI() {
  const totalItems = Object.keys(cart).length;
  const badge = document.getElementById('cartBadge');
  badge.textContent = totalItems;
  badge.classList.toggle('visible', totalItems > 0);
  document.getElementById('cartCountBadge').textContent = totalItems;

  // Показываем кнопку очистки только когда есть товары и мы на шаге 1
  const clearBtn = document.getElementById('cartClearBtn');
  if (clearBtn) clearBtn.style.display = totalItems > 0 ? 'inline-flex' : 'none';

  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');

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
  body.innerHTML = items.map(([id, entry]) => {
    let p = products.find(x => x.id === +id);
    // Use maxi variant if saved in cart
    if (p && p.hasMaxi && entry.mode === 'maxi') {
      p = { ...p, ...p.maxiVariant };
    }
    const qty = entry.qty;
    const lineTotal = p.priceNum * qty;
    total += lineTotal;

    const isKg = p.unit === 'кг';
    const qtyLabel = isKg ? `${qty} кг` : `${qty} шт.`;
    const lineTotalFmt = lineTotal.toLocaleString('ru') + ' ₽';
    const minQty = isKg ? (p.minKg || 1) : 1;
    const atMin = qty <= minQty;

    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${p.name}</h4>
          <div class="item-price">${p.price}</div>
          ${p.min ? `<div class="item-min">${p.min}</div>` : ''}
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty(${id}, -1)" ${atMin ? 'title="Минимальный заказ"' : ''}>−</button>
          <span class="qty-val">${qtyLabel}</span>
          <button class="qty-btn" onclick="changeQty(${id}, 1)">+</button>
        </div>
        <div class="cart-item-right">
          <div class="cart-line-total">${lineTotalFmt}</div>
          <button class="del-btn" onclick="removeFromCart(${id})" aria-label="Удалить">🗑</button>
        </div>
      </div>`;
  }).join('');

  const totalFmt = total.toLocaleString('ru') + ' ₽';
  document.getElementById('cartTotal').textContent = totalFmt;

  // Step 1: add summary + next button at bottom of cart-body
  body.innerHTML += `
    <div id="cartStep1Footer" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--cream-dark);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:15px;color:var(--brown);">Итого:</span>
        <span class="cart-inline-total">${totalFmt}</span>
      </div>
      <button onclick="goToFormStep()" style="width:100%;background:var(--gold);color:#fff;border:none;border-radius:50px;padding:14px 24px;font-size:15px;font-family:'Jost',sans-serif;font-weight:500;cursor:pointer;box-shadow:0 6px 20px rgba(201,147,74,0.35);">
        Далее →
      </button>
    </div>`;

  footer.style.display = 'none';
}

function goToFormStep() {
  setCartStep(2);
  document.getElementById('cartFooter').style.display = 'block';
  document.getElementById('cartBody').style.display = 'none';
}

function buildMessage() {
  const name = document.getElementById('cname').value.trim() || '—';
  const phone = document.getElementById('cphone').value.trim() || '—';
  const date = document.getElementById('cdate').value.trim() || '—';
  const comment = document.getElementById('ccomment').value.trim() || '—';

  if (!Object.keys(cart).length) { showToast('Корзина пуста — добавьте товар'); return null; }
  if (!phone || phone === '—') { showToast('Пожалуйста, укажите телефон'); return null; }
  // Validate phone digits
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    showToast('Введите корректный номер телефона');
    document.getElementById('cphone').focus();
    return null;
  }

  // ✅ Баг 4: валидация даты — нельзя выбрать прошедшую дату
  if (date !== '—') {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      showToast('Выберите дату не раньше сегодняшнего дня');
      document.getElementById('cdate').focus();
      return null;
    }
  }

  const items = Object.entries(cart).map(([id, entry]) => {
    // ✅ Баг 2: учитываем maxi вариант для правильного названия и цены
    let p = products.find(x => x.id === +id);
    if (p && p.hasMaxi && entry.mode === 'maxi') {
      p = { ...p, ...p.maxiVariant };
    }
    const qty = entry.qty;
    const label = p.unit === 'кг' ? `${qty} кг` : `${qty} шт.`;
    return `• ${p.name} — ${label} (${p.price})`;
  }).join('\n');

  const total = Object.entries(cart).reduce((s, [id, entry]) => {
    // ✅ Баг 2: учитываем maxi цену (3000 вместо 1600)
    let p = products.find(x => x.id === +id);
    if (p && p.hasMaxi && entry.mode === 'maxi') {
      p = { ...p, ...p.maxiVariant };
    }
    return s + p.priceNum * entry.qty;
  }, 0);

    const fillEl = document.querySelector('#calcFill .selected');
  const fillLine = fillEl ? '\nНачинка: ' + fillEl.textContent.trim() : '';

  return `Привет! Хочу сделать заказ 🎂\n\n${items}${fillLine}\n\nИтого (ориентировочно): ${total.toLocaleString('ru')} ₽\n\nИмя: ${name}\nТелефон: ${phone}\nДата готовности: ${date}\nКомментарий: ${comment}`;
}

function buildWA(e) {
  setCartStep(3);
  e.preventDefault();
  const msg = buildMessage();
  if (!msg) return;
  window.open(`https://wa.me/79119038886?text=${encodeURIComponent(msg)}`, '_blank');
}

function buildTG(e) {
  e.preventDefault();
  const msg = buildMessage();
  if (!msg) return;
  navigator.clipboard.writeText(msg).then(() => {
    showToast('Скопировано! Вставьте в чат Telegram (Ctrl+V)');
  }).catch(() => {});
  window.open('https://t.me/MiloviCake', '_blank');
}

function sendFormWA() {
  const name = document.getElementById('fname').value.trim() || '—';
  const phone = document.getElementById('fphone').value.trim();
  const comment = document.getElementById('fcomment').value.trim() || '—';
  if (!phone) { showToast('Пожалуйста, укажите телефон'); document.getElementById('fphone').focus(); return; }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) { showToast('Введите корректный номер телефона'); document.getElementById('fphone').focus(); return; }
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
  setCartStep(1);
  document.getElementById('cartFooter').style.display = 'none';
  document.getElementById('cartBody').style.display = '';
  updateCartUI();
}

// ── iOS-safe scroll lock ──
// body.style.overflow = 'hidden' alone doesn't prevent scroll on iOS Safari.
// position:fixed trick preserves scroll position and truly blocks scrolling.
function lockBody() {
  const count = parseInt(document.body.dataset.lockCount || '0');
  if (count === 0) {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.dataset.scrollY = scrollY;
  }
  document.body.dataset.lockCount = count + 1;
}
function unlockBody() {
  const count = parseInt(document.body.dataset.lockCount || '0');
  if (count <= 0) return;
  const newCount = count - 1;
  document.body.dataset.lockCount = newCount;
  if (newCount === 0) {
    const scrollY = parseInt(document.body.dataset.scrollY || '0');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    delete document.body.dataset.scrollY;
    window.scrollTo(0, scrollY);
  }
}

// ── DESKTOP: позиционировать окно корзины рядом с кнопкой ──
function positionCartWindowNearButton() {
  if (window.innerWidth < 901) return;

  const btn = document.getElementById('cartBtn');
  const drawer = document.getElementById('cartDrawer');
  if (!btn || !drawer) return;

  const MARGIN = 12;
  const GAP = 12;
  const HEADER_HEIGHT = 80; // хедер 72px + небольшой зазор
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const dW = 440;
  // Ограничиваем высоту так, чтобы окно влезло между хедером и низом экрана
  const maxH = vh - HEADER_HEIGHT - MARGIN * 2;
  const dH = Math.min(vh * 0.78, 720, maxH);

  const b = btn.getBoundingClientRect();
  const btnCenterX = b.left + b.width / 2;

  // Горизонтально: открываем внутрь экрана
  let left = (btnCenterX < vw / 2)
    ? b.left
    : (b.right - dW);

  // Вертикально: предпочтительно ниже кнопки
  let top = b.bottom + GAP;
  // Если не влезает снизу — прижимаем к низу экрана (не выше хедера)
  if (top + dH > vh - MARGIN) {
    top = vh - dH - MARGIN;
  }

  // Clamp — минимум HEADER_HEIGHT, чтобы не залезть под хедер
  left = Math.max(MARGIN, Math.min(left, vw - dW - MARGIN));
  top  = Math.max(HEADER_HEIGHT, Math.min(top, vh - dH - MARGIN));

  drawer.style.left   = left + 'px';
  drawer.style.top    = top + 'px';
  drawer.style.right  = 'auto';
  drawer.style.bottom = 'auto';
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.classList.add('cart-open');

  // lockBody только на мобиле — на десктопе страница скроллится под окном
  if (window.innerWidth <= 900) {
    lockBody();
  } else {
    // На десктопе скроллим наверх чтобы корзина была видна
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setCartStep(1);

  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.add('hidden');
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.classList.remove('cart-open');

  if (window.innerWidth <= 900) unlockBody();

  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.remove('hidden');
}

// ── PARALLAX ON HERO ORBS (только десктоп) ──
(function() {
  if (window.innerWidth < 769) return; // на мобиле не нужно — экономим батарею
  const orbs = document.querySelectorAll('.hero-orb-1, .hero-orb-2, .hero-orb-3');
  if (!orbs.length) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (orbs[0]) orbs[0].style.transform = `translateY(${y * 0.15}px)`;
      if (orbs[1]) orbs[1].style.transform = `translateY(${y * -0.10}px)`;
      if (orbs[2]) orbs[2].style.transform = `translateY(${y * 0.08}px)`;
      ticking = false;
    });
  }, { passive: true });
})();

// ── SMOOTH IMAGE FADE-IN ON LOAD ──
document.querySelectorAll('img').forEach(img => {
  if (img.complete) return;
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.5s ease';
  img.addEventListener('load', () => { img.style.opacity = '1'; });
});

// ── CART SWIPE-RIGHT TO CLOSE ──
(function() {
  const drawer = document.getElementById('cartDrawer');
  let startX = 0, startY = 0, dragging = false;
  drawer.addEventListener('touchstart', e => {
    // ✅ Баг 6: не начинать drag если пользователь в поле ввода
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      dragging = false;
      return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
    drawer.style.transition = 'none';
  }, { passive: true });
  drawer.addEventListener('touchmove', e => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > 30 && Math.abs(dx) < dy) { dragging = false; drawer.style.transition = ''; return; }
    if (dx > 0) drawer.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  drawer.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    drawer.style.transition = '';
    const dx = e.changedTouches[0].clientX - startX;
    if (dx > 100) {
      drawer.style.transform = '';
      closeCart();
    } else {
      drawer.style.transform = '';
    }
  }, { passive: true });
})();
function observeReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible)');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  els.forEach(el => io.observe(el));
}

// ══════════════════════════════════════════════
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
      ? `<div class="catalog-nav-thumb"><img src="${thumbSrc}" alt="" loading="lazy"></div>`
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

  const headerHeight = 72;
  const nav = document.getElementById('catalogNav');
  const navHeight = (nav && window.innerWidth <= 768) ? nav.offsetHeight + 16 : 0;
  const offset = headerHeight + navHeight + 16;

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

function initApp() {
  renderCatalogNav();
  renderCatalog(); // calls observeReveal() internally for catalog cards
  setTimeout(wireProductLightbox, 200);
  loadCartFromStorage();
  updateCartUI();
  observeReveal(); // picks up static .reveal elements (hero, sections, etc.)
  setTimeout(initCatalogNavScroll, 500);

  // Fix 3: устанавливаем min для даты динамически (не хардкодим в HTML)
  const dateInput = document.getElementById('cdate');
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }
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
const header = document.getElementById('siteHeader');
const floatingCta = document.getElementById('floatingCta');
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

    // Header scrolled state
    if (header) header.classList.toggle('scrolled', y > 60);

    // Floating CTA (десктоп)
    if (floatingCta) {
      const nearBottom = contactsSection && y + window.innerHeight > contactsSection.offsetTop - 100;
      floatingCta.classList.toggle('visible', y > 300 && !nearBottom);
    }

    // Back to top
    if (backToTopEl) backToTopEl.classList.toggle('visible', y > 600);

    _scrollTicking = false;
  });
}

window.addEventListener('scroll', _onScroll, { passive: true });


// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// Patch addToCart to show toast
const _origAdd = addToCart;

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
}, { threshold: 0.4 });
document.querySelectorAll('.stat-num').forEach(el => counterObserver.observe(el));

// ── BURGER MENU ──
const burgerBtn = document.getElementById('burgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
function closeMobileMenu() {
  burgerBtn.classList.remove('open');
  mobileMenu.classList.remove('open');
  burgerBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}
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

// ── LIGHTBOX ──
// ── LIGHTBOX with gallery + swipe ──
let _lbSrcs = [], _lbIdx = 0;

function openLightbox(src, srcs) {
  _lbSrcs = srcs || [src];
  // Normalize: find index by matching end of path
  _lbIdx = _lbSrcs.findIndex(s => src.endsWith(s) || s.endsWith(src) || src === s);
  if (_lbIdx < 0) _lbIdx = 0;
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = _lbSrcs[_lbIdx];
  lb.classList.add('open');
  lockBody();
  _lbUpdateArrows();
}
function lbNavigate(dir) {
  if (_lbSrcs.length < 2) return;
  _lbIdx = (_lbIdx + dir + _lbSrcs.length) % _lbSrcs.length;
  const img = document.getElementById('lightboxImg');
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.15s';
  setTimeout(() => {
    img.src = _lbSrcs[_lbIdx];
    img.style.opacity = '1';
  }, 150);
  _lbUpdateArrows();
}
function _lbUpdateArrows() {
  const show = _lbSrcs.length > 1;
  document.getElementById('lbNav').classList.toggle('hidden', !show);
  const counter = document.getElementById('lbCounter');
  if (counter) counter.textContent = (_lbIdx + 1) + ' / ' + _lbSrcs.length;
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  unlockBody();
  _lbSrcs = []; _lbIdx = 0;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') lbNavigate(1);
  if (e.key === 'ArrowLeft') lbNavigate(-1);
});

// Click on backdrop closes lightbox
document.getElementById('lightbox').addEventListener('click', function(e) {
  if (e.target === this) closeLightbox();
});

// Swipe on lightbox
(function() {
  const lb = document.getElementById('lightbox');
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

      // Find which slide is currently active by dot index
      const dots = wrap.querySelectorAll('.dot');
      let activeIdx = 0;
      dots.forEach((d, i) => { if (d.classList.contains('active')) activeIdx = i; });

      // Get current slides list (bento may have switched to maxi)
      const mode = typeof bentoModes !== 'undefined' && bentoModes[p.id];
      const currentSlides = (mode === 'maxi' && p.maxiVariant) ? p.maxiVariant.slides : p.slides;

      openLightbox(currentSlides[activeIdx], currentSlides);
    });
  });
}

// ── CALCULATOR ──
let _calcWeight = 2;
const WEIGHT_MIN = 2, WEIGHT_MAX = 10, WEIGHT_STEP = 0.5;

let _guestsTimer = null;
function stepWeight(dir) {
  const newVal = Math.round((_calcWeight + dir * WEIGHT_STEP) * 10) / 10;
  if (newVal < WEIGHT_MIN || newVal > WEIGHT_MAX) return;
  _calcWeight = newVal;
  document.getElementById('calcWeight').value = _calcWeight;
  updateCalc();
  const popup = document.getElementById('guestsPopup');
  if (popup) popup.style.opacity = '1';
}

function selectOpt(el, groupId) {
  // On mobile, filling taps open a bottom sheet instead of directly selecting
  if (groupId === 'calcFill' && window.innerWidth < 768) {
    openFillPopup(el);
    return;
  }

  document.querySelectorAll(`#${groupId} .calc-opt`).forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');

  // Rubber click effect on inner wrapper only (tooltip excluded)
  const inner = el.querySelector('.opt-inner');
  if (inner) {
    inner.classList.remove('rubber-click');
    void inner.offsetWidth;
    inner.classList.add('rubber-click');
    inner.addEventListener('animationend', () => inner.classList.remove('rubber-click'), { once: true });
  }

  // Shake only the text label, not tooltip/tag
  const label = el.querySelector('.opt-label');
  if (label) {
    label.classList.remove('opt-label-shake');
    void label.offsetWidth;
    label.classList.add('opt-label-shake');
    label.addEventListener('animationend', () => label.classList.remove('opt-label-shake'), { once: true });
  }
  if (groupId === 'calcType') {
    document.getElementById('calcWeightRow').style.display = 'block';
    document.getElementById('calcFillRow').style.display = 'block';
  }
  updateCalc();
}

function updateCalc() {
  const typeEl = document.querySelector('#calcType .selected');
  const fillEl = document.querySelector('#calcFill .selected');
  const decorEl = document.querySelector('#calcDecor .selected');

  const basePrice = +(typeEl?.dataset.price || 2800);
  const fillPrice = +(fillEl?.dataset.price || 0);
  const decorPrice = +(decorEl?.dataset.price || 0);
  const weight = _calcWeight;

  // Update stepper display
  const valEl = document.getElementById('calcWeightVal');
  if (valEl) {
    valEl.textContent = weight % 1 === 0 ? weight + ' кг' : weight.toFixed(1) + ' кг';
  }
  const guestsEl = document.getElementById('guestsCount');
  if (guestsEl) {
    const n = Math.round(weight / 0.2);
    const mod10 = n % 10;
    const mod100 = n % 100;
    let form;
    if (mod100 >= 11 && mod100 <= 19) {
      form = 'человек';
    } else if (mod10 === 1) {
      form = 'человека';
    } else if (mod10 >= 2 && mod10 <= 4) {
      form = 'человека';
    } else {
      form = 'человек';
    }
    guestsEl.textContent = n + ' ' + form;
  }

  // Update stepper button states
  const minusBtn = document.getElementById('calcWeightMinus');
  const plusBtn = document.getElementById('calcWeightPlus');
  if (minusBtn) minusBtn.disabled = weight <= WEIGHT_MIN;
  if (plusBtn) plusBtn.disabled = weight >= WEIGHT_MAX;

  let total = basePrice * weight + decorPrice;

  const decorIsNonStandard = decorPrice > 0;
  const isApprox = decorIsNonStandard;
  const prefix = isApprox ? '~ ' : '';
  document.getElementById('calcResult').textContent = prefix + total.toLocaleString('ru') + ' ₽';

  const badge = document.getElementById('calcApproxBadge');
  badge.classList.toggle('visible', isApprox);

  let noteText = 'Точная цена согласовывается при заказе';
  const notes = [];
  if (decorIsNonStandard) notes.push('декор рассчитывается отдельно');
  if (notes.length) noteText = '* ' + notes.map(n => n[0].toUpperCase() + n.slice(1)).join(', ');
  document.getElementById('calcNote').textContent = noteText;
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

  startReviewAutoplay();

  const reviewsCarousel = document.querySelector('.reviews-carousel');
  if (reviewsCarousel) {
    reviewsCarousel.addEventListener('mouseenter', () => { reviewPaused = true; });
    reviewsCarousel.addEventListener('mouseleave', () => { reviewPaused = false; });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startReviewAutoplay();
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


// ── Cookie banner ──
function acceptCookie() {
  localStorage.setItem('cookieAccepted', Date.now() + 365 * 24 * 60 * 60 * 1000);
  // Support both main (classList) and city (style.transform) implementations
  const banner = document.getElementById('cookieBanner');
  if (banner) {
    if (banner.classList.contains('visible') !== undefined && banner.style.transform !== undefined) {
      banner.classList.remove('visible');
      banner.style.transform = 'translateY(100%)';
    }
    banner.classList.remove('visible');
    banner.style.transform = 'translateY(100%)';
  }
}
function initCookieBanner() {
  const stored = localStorage.getItem('cookieAccepted');
  if (stored && Date.now() < parseInt(stored)) return;
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  setTimeout(() => {
    // Main uses classList, city uses style.transform
    if (banner.getAttribute('style') && banner.getAttribute('style').includes('transform')) {
      banner.style.transform = 'translateY(0)';
    } else {
      banner.classList.add('visible');
    }
  }, 800);
}
initCookieBanner();

// ── Privacy modal ──
function openPrivacy() {
  const el = document.getElementById('privacyOverlay');
  if (!el) return;
  // Support both CSS-class (main) and inline style (city)
  if (getComputedStyle(el).display === 'none' || el.style.display === 'none') {
    el.style.display = 'flex';
  }
  el.classList.add('open');
  lockBody();
}
function closePrivacy() {
  const el = document.getElementById('privacyOverlay');
  if (!el) return;
  el.classList.remove('open');
  el.style.display = '';
  unlockBody();
}

// ══════════════════════════════════════════
// ── BOTTOM SHEET: Fill info ──
// ══════════════════════════════════════════

let _fillSheetPendingEl = null; // calc-opt element waiting to be confirmed

function openFillPopup(optEl) {
  const title = optEl.querySelector('.opt-label')?.textContent?.trim() || '';
  const desc  = optEl.dataset.desc || '';

  // Read tags from the opt element
  const tagEls = optEl.querySelectorAll('.fill-tag');
  const tagsHTML = Array.from(tagEls).map(t => {
    const cls = t.classList.contains('hit')  ? 'tag-hit'  :
                t.classList.contains('nuts') ? 'tag-nuts' : '';
    return `<span class="fill-sheet-tag ${cls}">${t.textContent.trim()}</span>`;
  }).join('');

  document.getElementById('fillSheetTags').innerHTML = tagsHTML;
  document.getElementById('fillPopupTitle').textContent = title;
  document.getElementById('fillPopupText').textContent  = desc;

  _fillSheetPendingEl = optEl;

  const popup   = document.getElementById('fillPopup');
  const overlay = document.getElementById('fillOverlay');

  popup.classList.add('open');
  overlay.classList.add('open');
  document.body.classList.add('fill-open');
  // Не используем lockBody() — он сохраняет scrollY и при unlockBody()
  // прыгает страница наверх. Фон блокируется через CSS body.fill-open

  // Focus the select button for a11y
  setTimeout(() => document.getElementById('fillSheetSelect')?.focus(), 80);
}

function closeFillPopup() {
  const popup   = document.getElementById('fillPopup');
  const overlay = document.getElementById('fillOverlay');
  if (popup)   popup.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('fill-open');
  // Не вызываем unlockBody() — lockBody() не вызывался
  _fillSheetPendingEl = null;
  if (popup) popup.style.transform = '';
}

function confirmFillSelection() {
  if (_fillSheetPendingEl) {
    // Actually select this option
    const groupId = 'calcFill';
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

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (typeof closeLightbox === 'function') closeLightbox();
    closePrivacy();
    closeFillPopup();
  }
});


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
  // Skip parallax on mobile for perf — motion not visible anyway
  if (window.matchMedia('(min-width: 769px)').matches) {
    let _rafPending = false;
    window.addEventListener('scroll', () => {
      if (_rafPending) return;
      _rafPending = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < window.innerHeight) {
          heroBg.style.transform = `translateY(${y * 0.15}px) scale(1.05)`;
        }
        _rafPending = false;
      });
    }, { passive: true });
  }
}


// ── Ripple effect ──
document.querySelectorAll('.btn-primary, .btn-wa, .calc-order-btn, .btn-add, .header-order').forEach(btn => {
  btn.classList.add('ripple-wrap');
  btn.addEventListener('click', function(e) {
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

// ── MAP REVIEWS ACCORDION ──
function toggleMapReviews(platform) {
  const panelId  = platform === 'yandex' ? 'panelYandex' : 'panelGoogle';
  const btnId    = platform === 'yandex' ? 'btnYandex'   : 'btnGoogle';
  const otherPanelId = platform === 'yandex' ? 'panelGoogle' : 'panelYandex';
  const otherBtnId   = platform === 'yandex' ? 'btnGoogle'   : 'btnYandex';

  const panel      = document.getElementById(panelId);
  const btn        = document.getElementById(btnId);
  const otherPanel = document.getElementById(otherPanelId);
  const otherBtn   = document.getElementById(otherBtnId);

  const isOpen = panel.classList.contains('is-open');

  // Close the other panel
  otherPanel.classList.remove('is-open');
  otherPanel.addEventListener('transitionend', () => { otherPanel.hidden = !otherPanel.classList.contains('is-open'); }, { once: true });
  if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');

  if (isOpen) {
    // Close this one
    panel.classList.remove('is-open');
    panel.addEventListener('transitionend', () => { panel.hidden = true; }, { once: true });
    btn.setAttribute('aria-expanded', 'false');
  } else {
    // Open this one
    panel.hidden = false;
    // Allow display change to take effect before animating
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.classList.add('is-open');
      });
    });
    btn.setAttribute('aria-expanded', 'true');

    // Scroll into view on mobile
    if (window.innerWidth < 768) {
      setTimeout(() => {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }
}

// ── MAP REVIEWS: раскрытие длинных текстов ──
(function initMapTextExpand() {
  // Запускаем после рендера
  function wire() {
    document.querySelectorAll('.map-text-clamp').forEach(el => {
      if (el._expandWired) return;
      el._expandWired = true;

      // Проверяем, обрезан ли текст
      const isClamped = () => el.scrollHeight > el.clientHeight + 2;

      if (!isClamped()) return;

      const btn = document.createElement('button');
      btn.className = 'map-expand-btn';
      btn.textContent = 'Читать полностью';
      btn.addEventListener('click', () => {
        const expanded = el.classList.toggle('expanded');
        btn.textContent = expanded ? 'Свернуть' : 'Читать полностью';
      });
      el.after(btn);
    });
  }

  // Запускаем при открытии панели
  const origToggle = window.toggleMapReviews;
  window.toggleMapReviews = function(platform) {
    origToggle(platform);
    setTimeout(wire, 460); // после анимации раскрытия
  };
})();

// ── CHAT GALLERY LIGHTBOX ──
const CHAT_SRCS = [
  'img/review_1.webp',
  'img/review_2.webp',
  'img/review_3.webp',
  'img/review_4.webp',
  'img/review_5.webp',
  'img/review_6.webp',
  'img/review_7.webp',
  'img/review_8.webp',
];

// Переиспользуем существующий лайтбокс (#lightbox, #lightboxImg, #lbNav)
function openChatLightbox(idx) {
  _lbSrcs = CHAT_SRCS;
  _lbIdx = idx;
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = CHAT_SRCS[idx];
  lb.classList.add('open');
  lockBody();
  _lbUpdateArrows();
}

/* ══════════════════════════════════════════
   REVIEWS MODAL
══════════════════════════════════════════ */
function openReviewsModal(tab) {
  const modal = document.getElementById('reviewsModal');
  if (!modal) return;
  lockBody();
  // visibility:hidden→visible через CSS transition, display не трогаем
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });
  switchReviewsTab(tab || 'yandex');
  document.addEventListener('keydown', handleReviewsEscape);
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.add('hidden');
}

function closeReviewsModal() {
  const modal = document.getElementById('reviewsModal');
  if (!modal) return;
  modal.classList.remove('open');
  unlockBody();
  document.removeEventListener('keydown', handleReviewsEscape);
  var bn = document.getElementById('bottomNav');
  if (bn) bn.classList.remove('hidden');
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
  tY.classList.toggle('active', isYandex);
  tG.classList.toggle('active', !isYandex);
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
  'img/review_1.webp',
  'img/review_2.webp',
  'img/review_3.webp',
  'img/review_4.webp',
  'img/review_5.webp',
  'img/review_6.webp',
  'img/review_7.webp',
  'img/review_8.webp',
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
  { side:'left',  tp:  8, rot: -14 },  // 0 top-left
  { side:'right', tp: 27, rot:  18 },  // 1 right-high
  { side:'left',  tp: 27, rot: -18 },  // 2 left-high
  { side:'right', tp:  8, rot:  14 },  // 3 top-right
  { side:'left',  tp: 50, rot:   8 },  // 4 left-mid
  { side:'right', tp: 50, rot:  -8 },  // 5 right-mid
  { side:'left',  tp: 71, rot: -11 },  // 6 left-low
  { side:'right', tp: 71, rot:  11 },  // 7 right-low
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

REVIEWS.forEach((rv, i) => {
  const lay = LAYOUTS[i];

  const th = document.createElement('div');
  th.className = 'sc-thumb';
  th.style.left = lay.lp + '%';
  th.style.top  = lay.tp + '%';
  th.dataset.i  = i;

  const im = document.createElement('img');
  im.src = rv.src; im.alt = `Отзыв ${i+1}`; im.loading='lazy';
  th.appendChild(im);

  const hint = document.createElement('div');
  hint.className = 'thumb-hint';
  hint.innerHTML = `<span class="hint-text">кликни на меня</span><span class="hint-emoji">👆</span><span class="hint-text">чтобы увеличить</span>`;
  th.appendChild(hint);

  th.addEventListener('click', ()=>{
    if(i !== cur) { goTo(i); return; }
    if(STATE==='waiting'||STATE==='zoom_in') openLB(th, rv.src, i);
  });
  scField.appendChild(th);
  thumbs.push(th);

  // 4-arrow group: positioned in loop around the thumb, no rotation
  const ar = document.createElement('div');
  ar.className = 'sc-arrows';
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

  const dot = document.createElement('button');
  dot.className='rev-dot'+(i===0?' on':'');
  dot.setAttribute('aria-label',`Отзыв ${i+1}`);
  dot.addEventListener('click',()=> goTo(i));
  dotsEl.appendChild(dot);
});

thumbs[0].classList.add('is-active');
// Подсветить первый элемент filmstrip
const firstFilmItem = document.querySelector('.review-filmstrip-item');
if (firstFilmItem) firstFilmItem.classList.add('active');
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

function goTo(n, skipTypewriter){
  const slides = trackEl.querySelectorAll('.review-slide');
  const dts    = dotsEl.querySelectorAll('.rev-dot');
  const filmItems = document.querySelectorAll('.review-filmstrip-item');

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
    filmItems[cur].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  if(!skipTypewriter) startTypewriter();
  else startWaiting();
}

document.getElementById('btnPrev').addEventListener('click', ()=> goTo(cur-1));
document.getElementById('btnNext').addEventListener('click', ()=> goTo(cur+1));

let tsX=0, tsY=0;
trackEl.addEventListener('touchstart', e=>{ tsX=e.touches[0].clientX; tsY=e.touches[0].clientY; },{passive:true});
trackEl.addEventListener('touchend', e=>{
  const dx=e.changedTouches[0].clientX-tsX;
  const dy=e.changedTouches[0].clientY-tsY;
  if(Math.abs(dx)>Math.abs(dy)*1.4 && Math.abs(dx)>40){ goTo(dx<0 ? cur+1 : cur-1); }
});

function getStageCenter(){
  const r=stageEl.getBoundingClientRect();
  return { x: r.left+r.width/2, y: r.top+r.height/2 };
}
let sectionSnapH = 0;
function snapSectionHeight(){ sectionSnapH = document.getElementById('reviews').offsetHeight; }
window.addEventListener('resize', snapSectionHeight);
setTimeout(snapSectionHeight, 100);

// ── CACHE для loop() — избегаем DOM-запросы каждый кадр ──
let cachedTrackEl = null;
let cachedSectionWidth = 0;
let cachedSectionHeight = 0;

// ResizeObserver кэширует размер секции — избегаем forced reflow в loop
const _sectionResizeObs = new ResizeObserver(entries => {
  const rect = entries[0].contentRect;
  cachedSectionWidth = rect.width;
  cachedSectionHeight = rect.height;
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
      if (STATE === 'typing' && !typeTimer) {
        setTimeout(function() { startTypewriter(); }, 400);
      }
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

setTimeout(() => {
  const secEl = document.getElementById('reviews');
  if (secEl) {
    _sectionResizeObs.observe(secEl);
    _revObserver.observe(secEl);
    cachedSectionWidth = secEl.offsetWidth;
    cachedSectionHeight = secEl.offsetHeight;
  }
}, 100);

let lastT=0;
function loop(ts){
  if (!loopRunning || !loopActive) return; // пауза когда секция вне зоны видимости

  const secEl = document.getElementById('reviews');
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
  const cardL       = stageOff.left;
  const cardW       = stageEl.offsetWidth;
  // Центр блока .reviews-track относительно секции — прямой расчёт
  // Lazy init кэш элемента — не делаем querySelector каждый кадр
  if (!cachedTrackEl) cachedTrackEl = stageEl.querySelector('.reviews-track') || trackEl;
  const trackEl2   = cachedTrackEl;
  const trackOff2  = offsetRelTo(trackEl2, secEl);
  const cardCenterY = trackOff2.top + trackEl2.offsetHeight / 2;

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
      // Park target: left/right edge of card, vertically centered (the "circles" position)
      const OVERLAP = 45; // thumb overlaps card edge
      const parkX = lay.side === 'left'
        ? cardL - THUMB_W + OVERLAP   // left side: thumb hangs off left edge
        : cardL + cardW - OVERLAP;    // right side: thumb hangs off right edge
      const parkY = cardCenterY - THUMB_H / 2 - 80; // vertically centered on track


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
    th.style.left      = finalL + 'px';
    th.style.top       = finalT + 'px';
    th.style.transform = `rotate(${lay.rot + ffr + pr + tr}deg)`;

    // Position arrow group centered on thumb (no rotation)
    const ar = arrows[i];
    ar.style.left   = finalL + 'px';
    ar.style.top    = finalT + 'px';
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
  lbImg.style.opacity = '0';
  lbImg.style.transform = 'scale(0.95)';
  setTimeout(() => {
    lbImg.src = REVIEWS[_lbReviewIdx].src;
    lbImg.onload = () => {
      lbImg.style.opacity = '1';
      lbImg.style.transform = 'scale(1)';
    };
  }, 150);
  lbArrCounter.textContent = (_lbReviewIdx + 1) + ' / ' + REVIEWS.length;
}

if (lbPrevBtn) lbPrevBtn.addEventListener('click', () => _lbReviewNav(-1));
if (lbNextBtn) lbNextBtn.addEventListener('click', () => _lbReviewNav(1));

// iOS Safari: свайп по overlay для навигации (дополнительно к стрелкам)
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

function lerp(a,b,t){ return a+(b-a)*t; }



function openLB(triggerEl, src, idx){
  // Force-reset if stuck
  if(lbBusy){ lbBusy=false; lbIsOpen=false; lbOverlay.classList.remove('active'); }
  if(waitTimer){ clearTimeout(waitTimer); waitTimer=null; }
  hideArrows();
  lbBusy=true; lbIsOpen=true;
  lbImg.src = src;
  // Инициализируем счётчик стрелок
  _lbReviewIdx = typeof idx === 'number' ? idx : 0;
  lbImg.style.opacity = '1';
  lbImg.style.transform = 'scale(1)';
  lbImg.style.transition = 'opacity 0.2s, transform 0.2s';
  if (lbArrCounter) lbArrCounter.textContent = (_lbReviewIdx + 1) + ' / ' + REVIEWS.length;

  lockBody();
  lbOverlay.classList.add('active');
  lbX.style.pointerEvents = 'none';

  setTimeout(()=>{
    lbX.style.opacity = '1';
    lbX.style.transform = 'scale(1)';
    lbX.style.pointerEvents = '';
  }, 600);

  setTimeout(()=>{
    lbBox.classList.add('clickable');
    lbBusy = false;
  }, 950);
}

function closeLB(){
  if(!lbIsOpen || lbBusy) return;
  lbBusy=true; lbIsOpen=false;
  lbBox.classList.remove('clickable');
  lbX.style.opacity = '0';
  lbX.style.transform = 'scale(0.5)';
  lbX.style.pointerEvents = 'none';

  // Убираем класс active — CSS transition анимирует обратно
  lbOverlay.classList.remove('active');
  unlockBody();

  setTimeout(()=>{
    lbImg.src = '';
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

lbBg.addEventListener('click', closeLB);
lbBox.addEventListener('click', closeLB);
lbX.addEventListener('click',  closeLB);
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && lbIsOpen) closeLB(); });

// Сброс lbBusy если пользователь переключил вкладку во время анимации
document.addEventListener('visibilitychange', () => {
  if (document.hidden && lbBusy) {
    lbBusy = false;
  }
});


  // ── Public API — functions called from HTML via onclick ──
  window.acceptCookie = typeof acceptCookie !== "undefined" ? acceptCookie : undefined;
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
  window.goReview = typeof goReview !== "undefined" ? goReview : undefined;
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
  window.shiftReview = typeof shiftReview !== "undefined" ? shiftReview : undefined;
  window.showBentoWeightToast = typeof showBentoWeightToast !== "undefined" ? showBentoWeightToast : undefined;
  window.sliderStep = typeof sliderStep !== "undefined" ? sliderStep : undefined;
  window.stepWeight = typeof stepWeight !== "undefined" ? stepWeight : undefined;
  window.switchBentoTab = typeof switchBentoTab !== "undefined" ? switchBentoTab : undefined;
  window.switchReviewsTab = typeof switchReviewsTab !== "undefined" ? switchReviewsTab : undefined;

})();
