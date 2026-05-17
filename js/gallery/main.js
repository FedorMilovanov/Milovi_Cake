import { GALLERY_ITEMS } from './data.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const SIZE_MAP = { tall: '1x2', wide: '2x1', big: '2x2', m: '1x1' };

const filterButtons = [
  { id: 'all', label: 'Все' }, { id: 'photo', label: 'Фото' }, { id: 'video', label: 'Видео' },
  { id: 'wedding', label: 'Свадебные' }, { id: 'bento', label: 'Бенто' }, { id: '3d', label: '3D' },
  { id: 'meringue', label: 'Рулеты' }, { id: 'pavlova', label: 'Павлова' }, { id: 'bday', label: 'День рождения' },
];

let state = {
  filter: 'all',
  items: [],
  visible: [],
  swiper: null,
  lbIndex: 0,
  observer: null,
  isOpen: false,
  currentItem: null
};

// VK имеет приоритет как основной канал (по запросу пользователя)
const PRIMARY_SOCIAL = 'https://vk.com/the_lord_god_is_my_strength';
const TG_PERSONAL = '+79119038886';
const TG_CHANNEL = 'MiloviCake';

function esc(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function normalizeItem(item) {
  const isVideo = item.type === 'video';
  const poster = isVideo ? (item.poster || item.full || item.src) : item.src;
  return {
    id: item.id,
    type: item.type,
    size: SIZE_MAP[item.size] || item.size || '1x1',
    tags: item.tags || [],
    title: item.title || 'Работа Milovi Cake',
    desc: item.desc || '',
    src: poster,
    fullSrc: item.full || poster,
    videoSrc: isVideo ? item.src : null
  };
}

function buildInterleavedItems() {
  const all = GALLERY_ITEMS.map(normalizeItem);
  const photos = all.filter(i => i.type === 'photo');
  const videos = all.filter(i => i.type === 'video');
  const out = [];
  let pi = 0, vi = 0;
  while (pi < photos.length || vi < videos.length) {
    if (pi < photos.length) out.push(photos[pi++]);
    if (vi < videos.length) out.push(videos[vi++]);
    if (pi < photos.length) out.push(photos[pi++]);
  }
  return out;
}

function filteredItems() {
  if (state.filter === 'all') return state.items;
  return state.items.filter(item =>
    state.filter === 'photo' ? item.type === 'photo' :
    state.filter === 'video' ? item.type === 'video' :
    item.tags.includes(state.filter)
  );
}

function categoryGlyph(id) {
  const a = 'viewBox="0 0 24 24" class="gx-chip-glyph" aria-hidden="true"';
  if (id === 'photo') return `<svg ${a}><rect x="4" y="7" width="16" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12.5" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.5 7l1-1.8h5l1 1.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (id === 'video') return `<svg ${a}><rect x="4" y="7" width="12" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M16.5 10.2L20 8.5v7.5l-3.5-1.7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="10" cy="12.5" r="0.8" fill="currentColor"/></svg>`;
  // ... (остальные глифы оставляем как были)
  return `<svg ${a}><path d="M12 3.5 14.8 9.2 20.5 12l-5.7 2.8L12 20.5l-2.8-5.7L3.5 12l5.7-2.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}

function luxeSeal() {
  const idSuffix = Math.random().toString(36).substr(2, 5);
  return `<svg viewBox="0 0 100 100" aria-hidden="true" class="gx-seal-svg"><defs><linearGradient id="sealGold_${idSuffix}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5e6c0"/><stop offset="50%" stop-color="#d4a85c"/><stop offset="100%" stop-color="#8e5e20"/></linearGradient><radialGradient id="sealGlow_${idSuffix}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(212,168,92,0.45)"/><stop offset="100%" stop-color="rgba(212,168,92,0)"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#sealGlow_${idSuffix})"/><circle cx="50" cy="50" r="38" fill="none" stroke="url(#sealGold_${idSuffix})" stroke-width="1" opacity="0.7"/><circle cx="50" cy="50" r="32" fill="none" stroke="url(#sealGold_${idSuffix})" stroke-width="0.8" opacity="0.5"/><path d="M50 18 L54 30 L66 32 L57 40 L59 52 L50 47 L41 52 L43 40 L34 32 L46 30 Z" fill="url(#sealGold_${idSuffix})" fill-opacity="0.85"/><circle cx="50" cy="50" r="3.5" fill="url(#sealGold_${idSuffix})"/></svg>`;
}

function renderFilters() {
  const wrap = $('#gxFilters');
  const activeId = state.filter;
  wrap.innerHTML = filterButtons.map(b => `
    <button type="button" class="gx-chip${b.id === activeId ? ' gx-chip-active' : ''}" 
            data-filter="${b.id}" aria-pressed="${b.id === activeId}">
      <span class="gx-chip-icon">${categoryGlyph(b.id)}</span>${esc(b.label)}
    </button>
  `).join('');

  $$('.gx-chip', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      renderFilters();
      renderGrid();
      $('#galleryGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function sizeClasses(size) {
  if (size === '2x2') return 'col-span-2 row-span-2';
  if (size === '2x1') return 'col-span-2';
  if (size === '1x2') return 'row-span-2';
  return '';
}

function playIcon() {
  return '<svg class="play-badge" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
}

function renderGrid() {
  state.visible = filteredItems();
  $('#photoCount').textContent = `${state.visible.filter(i => i.type === 'photo').length} фото`;
  $('#videoCount').textContent = `${state.visible.filter(i => i.type === 'video').length} видео`;
  $('#gxTotalCount').textContent = state.visible.length;

  const grid = $('#galleryGrid');
  const empty = $('#gxEmpty');
  if (empty) empty.style.display = state.visible.length > 0 ? 'none' : 'flex';

  grid.innerHTML = '';
  if (!state.visible.length) return;

  const frag = document.createDocumentFragment();
  state.visible.forEach((item, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `card ${sizeClasses(item.size)}`.trim();
    card.style.animationDelay = `${Math.min(index * 0.035, 0.8)}s`;
    card.dataset.index = index;
    card.dataset.id = item.id;
    card.setAttribute('aria-label', `${item.title}. Открыть`);

    if (item.type === 'video') {
      const v = document.createElement('video');
      v.className = 'card-media';
      v.poster = item.src;
      v.muted = true;
      v.playsInline = true;
      v.preload = index < 6 ? 'auto' : 'metadata';
      if (index < 6) v.src = item.videoSrc;
      else v.dataset.src = item.videoSrc;
      card.appendChild(v);
      card.insertAdjacentHTML('beforeend', playIcon());
    } else {
      const img = document.createElement('img');
      img.className = 'card-media';
      img.src = item.src;
      img.alt = item.title;
      img.loading = index < 8 ? 'eager' : 'lazy';
      img.decoding = 'async';
      card.appendChild(img);
    }

    card.insertAdjacentHTML('beforeend', `<div class="card-overlay"><span class="card-title">${esc(item.title)}</span></div>`);
    card.addEventListener('click', () => openLightbox(index));
    attachOptimizedTilt(card);
    frag.appendChild(card);
  });

  grid.appendChild(frag);
  setupVideoObserver();
}

function attachOptimizedTilt(card) {
  if (matchMedia('(hover: none), (pointer: coarse)').matches) return;

  let raf = 0;
  let isActive = false;

  const onEnter = () => {
    isActive = true;
    card.style.zIndex = '10';
    card.style.willChange = 'transform';
  };

  const onMove = (e) => {
    if (!isActive || raf) return;
    raf = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 25;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * -25;
      
      card.style.transform = `perspective(1200px) rotateX(${y}deg) rotateY(${x}deg) scale(1.04)`;
      raf = 0;
    });
  };

  const onLeave = () => {
    isActive = false;
    cancelAnimationFrame(raf);
    card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)';
    setTimeout(() => {
      if (!isActive) {
        card.style.willChange = '';
        card.style.zIndex = '';
      }
    }, 650);
  };

  card.addEventListener('mouseenter', onEnter, { passive: true });
  card.addEventListener('mousemove', onMove, { passive: true });
  card.addEventListener('mouseleave', onLeave, { passive: true });
}

function setupVideoObserver() {
  if (state.observer) state.observer.disconnect();
  if (!('IntersectionObserver' in window)) return;

  state.observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        if (video.dataset.src && !video.src) video.src = video.dataset.src;
        video.play().catch(() => {});
      } else if (video.src) {
        video.pause();
      }
    });
  }, { threshold: 0.35, rootMargin: '180px 0px' });

  $$('#galleryGrid video').forEach(v => state.observer.observe(v));
}

// === УЛУЧШЕННЫЙ ЛАЙТБОКС (решение основного бага) ===
let lightboxInstance = null;

function createLightboxTemplate() {
  if (lightboxInstance) return lightboxInstance;

  const template = document.createElement('div');
  template.id = 'lbRoot';
  template.className = 'lb-root';
  template.setAttribute('role', 'dialog');
  template.setAttribute('aria-modal', 'true');
  template.innerHTML = `
    <div class="lb-backdrop">
      <div class="lb-backdrop-bg" id="lbBackdropBg"></div>
      <div class="lb-backdrop-overlay"></div>
    </div>
    <div class="lb-header">
      <div class="lb-brand">Milovi Cake</div>
      <div class="lb-counter" id="lbCounter">01 / 01</div>
      <button class="lb-close" id="lbClose" aria-label="Закрыть">✕</button>
    </div>
    <button class="lb-nav lb-nav-prev" id="lbPrev" aria-label="Предыдущая">‹</button>
    <button class="lb-nav lb-nav-next" id="lbNext" aria-label="Следующая">›</button>
    
    <div class="lb-swiper-wrap" id="lbMediaContainer">
      <!-- Медиа будет вставляться динамически для максимальной скорости -->
    </div>

    <div class="lb-info">
      <div class="lb-info-inner">
        <h2 class="lb-title" id="lbTitle"></h2>
        <p class="lb-desc" id="lbDesc"></p>
        <div class="lb-actions">
          <button class="lb-action" id="lbShare">Поделиться</button>
          <div class="lb-order-choice">
            <span class="lb-order-label">Хочу такой</span>
            <a href="#" class="lb-order-icon lb-order-wa" id="lbWantWa" target="_blank"></a>
            <a href="#" class="lb-order-icon lb-order-tg" id="lbWantTg" target="_blank"></a>
            <a href="#" class="lb-order-icon lb-order-max" id="lbWantMax" target="_blank"></a>
          </div>
        </div>
      </div>
    </div>
    <div class="lb-thumbs" id="lbThumbs"></div>
  `;

  lightboxInstance = template;
  return template;
}

function openLightbox(startIndex) {
  if (state.isOpen) return;
  state.isOpen = true;

  // Останавливаем видео в сетке
  if (state.observer) state.observer.disconnect();
  $$('#galleryGrid video').forEach(v => { v.pause(); v.currentTime = 0; });

  state.lbIndex = Math.max(0, Math.min(startIndex || 0, state.visible.length - 1));
  const root = createLightboxTemplate();
  
  if (!$('#lbRoot')) {
    document.body.appendChild(root);
  }

  document.body.style.overflow = 'hidden';
  root.style.display = 'flex';

  renderLightboxContent(state.lbIndex);
  setupLightboxListeners(root);

  // Немедленный preload центрального элемента
  preloadCurrentMedia(state.lbIndex);
  
  // Focus management
  setTimeout(() => $('#lbClose')?.focus(), 80);
  
  window.addEventListener('keydown', handleLightboxKey);
  window.addEventListener('popstate', handlePopState);
  
  history.pushState({lightbox: true}, '', `#${state.visible[state.lbIndex].id}`);
}

function preloadCurrentMedia(index) {
  const item = state.visible[index];
  if (!item) return;
  
  if (item.type === 'video' && item.videoSrc) {
    const v = new Image(); // preload poster first
    v.src = item.src;
  } else if (item.fullSrc) {
    const img = new Image();
    img.src = item.fullSrc;
  }
}

function renderLightboxContent(index) {
  const item = state.visible[index];
  if (!item) return;

  state.currentItem = item;
  state.lbIndex = index;

  $('#lbTitle').textContent = item.title;
  $('#lbDesc').textContent = item.desc || 'Авторская работа Milovi Cake, Санкт-Петербург';
  $('#lbCounter').textContent = `${String(index + 1).padStart(2, '0')} / ${String(state.visible.length).padStart(2, '0')}`;

  const container = $('#lbMediaContainer');
  container.innerHTML = '';

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'lb-media-wrap active';

  if (item.type === 'video') {
    const video = document.createElement('video');
    video.className = 'lb-media';
    video.src = item.videoSrc;
    video.poster = item.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = true;
    video.preload = 'auto';
    mediaWrap.appendChild(video);
    video.play().catch(() => {});
  } else {
    const img = document.createElement('img');
    img.className = 'lb-media';
    img.src = item.fullSrc || item.src;
    img.alt = item.title;
    img.loading = 'eager';
    img.decoding = 'sync';
    mediaWrap.appendChild(img);
  }

  container.appendChild(mediaWrap);

  // Обновляем кнопки мессенджеров (VK приоритет)
  const wishText = `Хочу торт как на фото: ${item.title}. ${location.origin}/gallery/#${item.id}`;
  
  $('#lbWantWa').href = `https://wa.me/${TG_PERSONAL}?text=${encodeURIComponent(wishText)}`;
  $('#lbWantTg').href = `https://t.me/${TG_PERSONAL}?text=${encodeURIComponent(wishText)}`;
  $('#lbWantMax').href = `https://max.ru/${TG_PERSONAL}`;

  // Thumbs
  renderThumbs(index);
}

function renderThumbs(activeIndex) {
  const thumbsContainer = $('#lbThumbs');
  thumbsContainer.innerHTML = '';
  
  state.visible.forEach((item, i) => {
    const thumb = document.createElement('button');
    thumb.className = `lb-thumb ${i === activeIndex ? 'active' : ''}`;
    thumb.innerHTML = `<img src="${item.src}" alt="${item.title}">`;
    thumb.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      renderLightboxContent(i);
    });
    thumbsContainer.appendChild(thumb);
  });
}

function setupLightboxListeners(root) {
  const closeBtn = $('#lbClose');
  const prevBtn = $('#lbPrev');
  const nextBtn = $('#lbNext');

  const close = () => closeLightbox();

  closeBtn.onclick = close;
  prevBtn.onclick = () => {
    let newIdx = state.lbIndex - 1;
    if (newIdx < 0) newIdx = state.visible.length - 1;
    renderLightboxContent(newIdx);
  };
  nextBtn.onclick = () => {
    let newIdx = state.lbIndex + 1;
    if (newIdx >= state.visible.length) newIdx = 0;
    renderLightboxContent(newIdx);
  };

  // Click on backdrop
  root.addEventListener('click', e => {
    if (e.target.id === 'lbRoot' || e.target.classList.contains('lb-backdrop')) close();
  });

  // Keyboard already handled globally
}

function handleLightboxKey(e) {
  if (!$('#lbRoot')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') $('#lbPrev')?.click();
  if (e.key === 'ArrowRight') $('#lbNext')?.click();
}

function handlePopState() {
  if ($('#lbRoot')) closeLightbox(false);
}

function closeLightbox(updateHistory = true) {
  const root = $('#lbRoot');
  if (!root) return;

  state.isOpen = false;
  
  // Stop all media
  $$('video.lb-media').forEach(v => {
    v.pause();
    v.src = '';
    v.load();
  });

  window.removeEventListener('keydown', handleLightboxKey);
  window.removeEventListener('popstate', handlePopState);

  root.style.opacity = '0';
  setTimeout(() => {
    if (root.parentNode) root.parentNode.removeChild(root);
    lightboxInstance = null; // allow recreation with fresh state
    document.body.style.overflow = '';
    
    if (updateHistory) {
      history.replaceState(null, '', location.pathname);
    }
    
    // Restart grid videos
    setTimeout(setupVideoObserver, 300);
  }, 450);
}

// Public API
function boot() {
  const seal = $('#gxSeal');
  if (seal) seal.innerHTML = luxeSeal();

  state.items = buildInterleavedItems();
  renderFilters();
  renderGrid();

  $('#resetFilter')?.addEventListener('click', () => {
    state.filter = 'all';
    renderFilters();
    renderGrid();
  });

  // Hash deep linking
  const hash = decodeURIComponent(location.hash.replace('#', ''));
  if (hash) {
    const idx = state.visible.findIndex(item => item.id === hash);
    if (idx !== -1) {
      setTimeout(() => openLightbox(idx), 420);
    }
  }

  console.log('%c✓ Gallery v2.1 (optimized lightbox) initialized successfully', 'color:#b8823a; font-size:10px');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Expose for inline onclicks if needed
window.openLightboxFromGallery = openLightbox;
window.closeGalleryLightbox = closeLightbox;