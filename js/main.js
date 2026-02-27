/* ═══════════════════════════════════════════════════════
   MILOVI CAKE — Общий JavaScript
   
   В HTML страниц перед подключением этого файла объявите:
   
   Главная:    <script>const IMG_BASE = '';</script>
   Пригороды:  <script>const IMG_BASE = '../..';</script>
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
  { id: 5, name: 'Пирожное "Павлова"', desc: 'Воздушная меренга с кремом и начинкой из ягод', min: 'Заказ от 2 шт', price: '350 ₽/шт', priceNum: 350, unit: 'шт', emoji: '🍓',
    slides: [IMG_BASE + '/pavlova.webp', IMG_BASE + '/pavlova_2.webp', IMG_BASE + '/pavlova_3.webp'],
    slidePos: ['center 55%', 'center 45%', 'center 50%'] },
  { id: 6, name: 'Капкейки', desc: 'Набор изящных капкейков с разными вкусами', min: 'Заказ от 6 шт одного вкуса', price: '350 ₽/шт', priceNum: 350, unit: 'шт', emoji: '🧁',
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
            if (src && typeof src === 'object' && src.type === 'vk') {
              return `<div class="slide-img slide-video${active}" data-vk-embed="${src.embed}">
                <img src="${src.thumb}" alt="Видео" class="vk-thumb" style="width:100%;height:100%;object-fit:cover;object-position:center 35%;display:block;transition:opacity 0.3s;">
                <div class="slide-video-play" onclick="activateVkSlide(this)" aria-label="Смотреть видео">
                  <div class="vk-play-btn">
                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="28" fill="rgba(0,0,0,0.52)"/><polygon points="23,18 43,28 23,38" fill="white"/></svg>
                    <span class="vk-play-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style="margin-right:5px;flex-shrink:0"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1.01-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.408 4 7.935c0-.254.102-.491.593-.491h1.744c.441 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.253-1.406 2.15-3.574 2.15-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.78 1.203 1.253.745.847 1.32 1.558 1.473 2.049.17.491-.085.745-.576.745z"/></svg>
                      Нажми для просмотра
                    </span>
                  </div>
                </div>
                <iframe class="vk-iframe" src="" frameborder="0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;display:none;"></iframe>
              </div>`;
            }
            const pos = p.slidePos ? p.slidePos[i] : 'center center';
            const scale = p.slideScale ? p.slideScale[i] : 1;
            const isFirstOfFirst = p.id === products[0].id && i === 0;
            return `<img src="${src}" alt="${p.name}" class="slide-img${active}"
              loading="${isFirstOfFirst ? 'eager' : 'lazy'}"
              decoding="${isFirstOfFirst ? 'sync' : 'async'}"
              onerror="this.style.cssText='display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;font-size:60px;background:linear-gradient(135deg,#e8d8c4,#d4b896);'; this.src=''; this.alt='${p.emoji}'"
              style="object-position:${pos};transform:scale(${scale});transform-origin:${pos};">`;
          }).join('')}

          <div class="slider-dots">
            ${p.slides.map((s, i) => {
              const isVideo = s && typeof s === 'object' && s.type === 'vk';
              return `<span class="dot${i === 0 ? ' active' : ''}${isVideo ? ' dot-video' : ''}" onclick="goSlide(${p.id},${i})"></span>`;
            }).join('')}
          </div>
        </div>`;
    } else if (p.img) {
      imgHtml = `<img src="${p.img}" alt="${p.name}" class="product-img" onerror="this.style.cssText='display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;font-size:60px;background:linear-gradient(135deg,#e8d8c4,#d4b896);'; this.src=''; this.alt=p.emoji" style="object-position:${p.imgPos || 'center center'};">`;
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
    // Stop video if navigating away
    if (wasActive && i !== idx && el.classList.contains('slide-video')) {
      const iframe = el.querySelector('.vk-iframe');
      const thumb = el.querySelector('.vk-thumb');
      const playBtn = el.querySelector('.slide-video-play');
      if (iframe) { iframe.src = ''; iframe.style.display = 'none'; }
      if (thumb) thumb.style.opacity = '1';
      if (playBtn) playBtn.style.display = 'flex';
    }
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
      sliderCurrentIdx[pid] = ((sliderCurrentIdx[pid] || 0) + 1) % total;
      goSlide(pid, sliderCurrentIdx[pid]);
    }, 3000);
  }
}

function activateVkSlide(playBtn) {
  const slide = playBtn.closest('.slide-video');
  if (!slide) return;
  const iframe = slide.querySelector('.vk-iframe');
  const thumb = slide.querySelector('.vk-thumb');
  if (iframe) {
    iframe.src = slide.dataset.vkEmbed + '&autoplay=1';
    iframe.style.display = 'block';
  }
  if (thumb) thumb.style.opacity = '0';
  playBtn.style.display = 'none';
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
      slideTimers[pid] = setInterval(() => { c = (c + 1) % total; goSlide(pid, c); }, 3000);
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
  delete cart[id];
  updateCartUI();
  saveCartToStorage();
}

function clearCart() {
  // Подтверждение — защита от случайного нажатия
  if (!confirm('Очистить корзину? Все позиции будут удалены.')) return;
  cart = {};
  updateCartUI();
  saveCartToStorage();
  // Возвращаемся на шаг 1 если были на шаге 2
  setCartStep(1);
  document.getElementById('cartFooter').style.display = 'none';
  document.getElementById('cartBody').style.display = '';
}

function changeQty(id, delta) {
  let p = products.find(x => x.id === id);
  if (p && p.hasMaxi && cart[id] && cart[id].mode === 'maxi') {
    p = { ...p, ...p.maxiVariant };
  }
  const step = p.unit === 'кг' ? 0.5 : 1;
  const minQty = p.unit === 'кг' ? (p.minKg || 1) : 1;
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
        <span style="font-family:'Cormorant Garamond',serif;font-size:24px;color:var(--gold);">${totalFmt}</span>
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

  if (!Object.keys(cart).length) { alert('Корзина пуста!'); return null; }
  if (!phone || phone === '—') { alert('Пожалуйста, укажите телефон.'); return null; }
  // Validate phone digits
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    showToast('Введите корректный номер телефона');
    document.getElementById('cphone').focus();
    return null;
  }

  const items = Object.entries(cart).map(([id, entry]) => {
    const p = products.find(x => x.id === +id);
    const qty = entry.qty;
    const label = p.unit === 'кг' ? `${qty} кг` : `${qty} шт.`;
    return `• ${p.name} — ${label} (${p.price})`;
  }).join('\n');

  const total = Object.entries(cart).reduce((s, [id, entry]) => {
    const p = products.find(x => x.id === +id);
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
    alert('Текст заказа скопирован! Вставьте его в чат Telegram (Ctrl+V / ⌘V).');
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
  if (document.body.dataset.locked) return;
  const scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  document.body.dataset.scrollY = scrollY;
  document.body.dataset.locked = '1';
}
function unlockBody() {
  if (!document.body.dataset.locked) return;
  const scrollY = parseInt(document.body.dataset.scrollY || '0');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  delete document.body.dataset.locked;
  window.scrollTo(0, scrollY);
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.classList.add('cart-open');
  lockBody();
  // Always start at step 1 (showing cart items)
  setCartStep(1);
  // Step advances only via explicit button (goToFormStep)
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.classList.remove('cart-open');
  unlockBody();
}

// ── PARALLAX ON HERO ORBS ──
(function() {
  const orbs = document.querySelectorAll('.hero-orb-1, .hero-orb-2, .hero-orb-3');
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

// ── REVEAL ON SCROLL ──
function observeReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible)');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  els.forEach(el => io.observe(el));
}

renderCatalog(); // calls observeReveal() internally for catalog cards
setTimeout(wireProductLightbox, 200);
loadCartFromStorage();
updateCartUI();
observeReveal(); // picks up static .reveal elements (hero, sections, etc.)

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

// ── PROGRESS BAR ──
window.addEventListener('scroll', () => {
  const el = document.getElementById('scroll-progress');
  const scrolled = window.scrollY;
  const total = document.body.scrollHeight - window.innerHeight;
  el.style.width = (scrolled / total * 100) + '%';
});

// ── HEADER ON SCROLL ──
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 60);
});



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
window.addToCart = function(id, e) {
  _origAdd(id, e);
  let p = products.find(x => x.id === id);
  if (p && p.hasMaxi && cart[id] && cart[id].mode === 'maxi') {
    p = { ...p, ...p.maxiVariant };
  }
  const qty = cart[id] ? cart[id].qty : '';
  const label = p.unit === 'кг' ? `${qty} кг` : '';
  showToast(`🧁 ${p.name}${label ? ' · ' + label : ''} добавлен в корзину`);
};

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
  document.body.style.overflow = '';
}
burgerBtn.addEventListener('click', () => {
  const isOpen = burgerBtn.classList.toggle('open');
  mobileMenu.classList.toggle('open', isOpen);
  burgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  isOpen ? lockBody() : unlockBody();
});

// Close menu on tap outside
document.addEventListener('click', (e) => {
  if (mobileMenu.classList.contains('open') &&
      !mobileMenu.contains(e.target) &&
      !burgerBtn.contains(e.target)) {
    closeMobileMenu();
  }
});

// ── FLOATING CTA ──
const floatingCta = document.getElementById('floatingCta');
const contactsSection = document.getElementById('contacts');
const mobileStickyWa = document.getElementById('mobileStickyWa');
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY > 300;
  const nearBottom = contactsSection && window.scrollY + window.innerHeight > contactsSection.offsetTop - 100;
  floatingCta.classList.toggle('visible', scrolled && !nearBottom);
  // Sticky mobile WA: show after 300px scroll, hide near contacts
  if (mobileStickyWa) {
    mobileStickyWa.classList.toggle('visible', scrolled);
    mobileStickyWa.classList.toggle('near-bottom', nearBottom);
  }
}, { passive: true });

// Hide sticky WA when cart or bottom-sheet opens
function _hideStickyWa() { document.body.classList.add('cart-open'); }
function _showStickyWa() { document.body.classList.remove('cart-open'); }

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
  document.body.style.overflow = 'hidden';
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
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
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





let currentReview = 0;
const totalReviews = document.querySelectorAll('.review-slide').length;

function goReview(idx) {
  const slides = document.querySelectorAll('.review-slide');
  const dots = document.querySelectorAll('.rev-dot');
  slides[currentReview].classList.remove('active');
  dots[currentReview].classList.remove('rev-dot-active');
  currentReview = (idx + totalReviews) % totalReviews;
  slides[currentReview].classList.add('active');
  dots[currentReview].classList.add('rev-dot-active');
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
document.getElementById('reviewsTrack').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
document.getElementById('reviewsTrack').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 40) shiftReview(dx < 0 ? 1 : -1);
}, { passive: true });



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
  document.body.style.overflow = 'hidden';
}
function closePrivacy() {
  const el = document.getElementById('privacyOverlay');
  if (!el) return;
  el.classList.remove('open');
  el.style.display = '';
  document.body.style.overflow = '';
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
  lockBody();

  // Focus the select button for a11y
  setTimeout(() => document.getElementById('fillSheetSelect')?.focus(), 80);
}

function closeFillPopup() {
  const popup   = document.getElementById('fillPopup');
  const overlay = document.getElementById('fillOverlay');
  if (popup)   popup.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('fill-open');
  unlockBody();
  _fillSheetPendingEl = null;
  // Reset any drag transform
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
    if (e.cancelable) e.preventDefault();
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
  handle.addEventListener('touchmove',  onMove,  { passive: false });
  handle.addEventListener('touchend',   onEnd,   { passive: true });

  // Click/tap overlay to dismiss (click для десктопа, touchend для мобильного)
  const overlayEl = document.getElementById('fillOverlay');
  if (overlayEl) {
    overlayEl.addEventListener('click', closeFillPopup);
    overlayEl.addEventListener('touchend', e => { e.preventDefault(); closeFillPopup(); }, { passive: false });
  }
})();

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (typeof closeLightbox === 'function') closeLightbox();
    closePrivacy();
    closeFillPopup();
  }
});


// ── Back to top ──
window.addEventListener('scroll', () => {
  document.getElementById('backToTop')
    .classList.toggle('visible', window.scrollY > 600);
});

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

// ── PREMIUM: Subtle hero parallax (RAF-throttled) ──
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
  document.body.style.overflow = 'hidden';
  _lbUpdateArrows();
}
