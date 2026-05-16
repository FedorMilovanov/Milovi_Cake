import { GALLERY_ITEMS } from './data.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const SIZE_MAP = { tall: '1x2', wide: '2x1', big: '2x2', m: '1x1' };
const filterButtons = [
  { id: 'all', label: 'Все' },
  { id: 'photo', label: 'Фото' },
  { id: 'video', label: 'Видео' },
  { id: 'wedding', label: 'Свадебные' },
  { id: 'bento', label: 'Бенто' },
  { id: '3d', label: '3D' },
  { id: 'meringue', label: 'Рулеты' },
  { id: 'pavlova', label: 'Павлова' },
];

const state = {
  filter: 'all',
  items: [],
  visible: [],
  swiper: null,
  activeIndex: 0,
  videoObserver: null,
  swiperReady: false,
};

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
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
    videoSrc: isVideo ? item.src : null,
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

function categoryGlyph(id) {
  const attrs = 'viewBox="0 0 24 24" class="gx-chip-glyph" aria-hidden="true"';
  switch (id) {
    case 'photo': return `<svg ${attrs}><rect x="4" y="7" width="16" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12.5" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.5 7l1-1.8h5l1 1.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'video': return `<svg ${attrs}><rect x="4" y="7" width="12" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M16.5 10.2L20 8.5v7.5l-3.5-1.7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="10" cy="12.5" r="0.8" fill="currentColor"/></svg>`;
    case 'wedding': return `<svg ${attrs}><path d="M12 4c2-2.5 5.8-1.5 6.2 2 .3 2.5-1.8 4.5-6.2 8.5-4.4-4-6.5-6-6.2-8.5C6.2 2.5 10 1.5 12 4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 18.5h12M8 16h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    case 'bento': return `<svg ${attrs}><rect x="5" y="7.5" width="14" height="9.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9.5 11.5c1-.8 2-1 3-1s2 .2 3 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    case '3d': return `<svg ${attrs}><path d="M12 3.5L19 7v10l-7 3.5L5 17V7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 3.5v17M5 7l7 3.5L19 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    case 'meringue': return `<svg ${attrs}><path d="M6.5 14c1.8-4 4.5-6.2 8-6.2 2.4 0 4.2.9 5 2.5.9 1.8.5 3.8-1 5.5-1.6 1.8-3.8 2.7-6.3 2.7-2.6 0-4.7-.8-5.7-2.3-.6-.8-.6-1.6 0-2.2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.5 16c1.2.6 2.5.9 3.8.8 2.3 0 4.2-.6 5.6-2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    case 'pavlova': return `<svg ${attrs}><path d="M7 14c0-3.5 2.2-6 5-6s5 2.5 5 6c0 2-1.8 3.5-5 3.5S7 16 7 14z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 7.5c.4-1.4 1-2 1.8-2s1.4.6 1.8 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="11.5" r="1" fill="currentColor"/></svg>`;
    default: return `<svg ${attrs}><path d="M12 3.5 14.8 9.2 20.5 12l-5.7 2.8L12 20.5l-2.8-5.7L3.5 12l5.7-2.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  }
}

function luxeSeal() {
  return `<svg viewBox="0 0 100 100" aria-hidden="true" class="gx-seal-svg"><defs><linearGradient id="sealGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5e6c0"/><stop offset="50%" stop-color="#d4a85c"/><stop offset="100%" stop-color="#8e5e20"/></linearGradient><radialGradient id="sealGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(212,168,92,0.45)"/><stop offset="100%" stop-color="rgba(212,168,92,0)"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#sealGlow)"/><circle cx="50" cy="50" r="38" fill="none" stroke="url(#sealGold)" stroke-width="1" opacity="0.7"/><circle cx="50" cy="50" r="32" fill="none" stroke="url(#sealGold)" stroke-width="0.8" opacity="0.5"/><path d="M50 18 L54 30 L66 32 L57 40 L59 52 L50 47 L41 52 L43 40 L34 32 L46 30 Z" fill="url(#sealGold)" fill-opacity="0.85"/><circle cx="50" cy="50" r="3.5" fill="url(#sealGold)"/><circle cx="50" cy="12" r="1.8" fill="url(#sealGold)" opacity="0.6"/><circle cx="50" cy="88" r="1.8" fill="url(#sealGold)" opacity="0.6"/><circle cx="12" cy="50" r="1.8" fill="url(#sealGold)" opacity="0.6"/><circle cx="88" cy="50" r="1.8" fill="url(#sealGold)" opacity="0.6"/></svg>`;
}

function tinyPlayIcon() {
  return `<svg viewBox="0 0 18 18" aria-hidden="true" class="gx-mini-play"><defs><linearGradient id="miniPlayGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff7df"/><stop offset="55%" stop-color="#d4a85c"/><stop offset="100%" stop-color="#9a6726"/></linearGradient></defs><path d="M6.2 4.4v9.2l7.2-4.6-7.2-4.6z" fill="url(#miniPlayGold)"/><path d="M6.2 4.4v9.2l7.2-4.6-7.2-4.6z" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.45" stroke-linejoin="round"/></svg>`;
}

function filteredItems() {
  if (state.filter === 'all') return state.items;
  return state.items.filter(item => {
    if (state.filter === 'photo') return item.type === 'photo';
    if (state.filter === 'video') return item.type === 'video';
    return item.tags.includes(state.filter);
  });
}

function renderFilters() {
  const wrap = $('#gxFilters');
  wrap.innerHTML = filterButtons.map(btn => `
    <button type="button" class="gx-chip${btn.id === state.filter ? ' gx-chip-active' : ''}" data-filter="${btn.id}" aria-pressed="${btn.id === state.filter}">
      <span class="gx-chip-icon" aria-hidden="true">${categoryGlyph(btn.id)}</span>${escapeHtml(btn.label)}
    </button>`).join('');
  $$('.gx-chip', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      renderFilters();
      renderGrid();
      $('.gallery-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function cardStyle(size) {
  const s = [];
  if (size === '2x1' || size === '2x2') s.push('grid-column: span 2');
  if (size === '1x2' || size === '2x2') s.push('grid-row: span 2');
  return s.join(';');
}

function renderGrid() {
  state.visible = filteredItems();
  $('#photoCount').innerHTML = `${state.visible.filter(i => i.type === 'photo').length} фото`;
  $('#videoCount').innerHTML = `${state.visible.filter(i => i.type === 'video').length} видео`;
  $('#gxTotalCount').textContent = String(state.items.length);

  const grid = $('#galleryGrid');
  const empty = $('#gxEmpty');
  grid.innerHTML = '';
  empty.hidden = state.visible.length > 0;
  if (!state.visible.length) return;

  const frag = document.createDocumentFragment();
  state.visible.forEach((item, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gx-card animate-reveal';
    card.style.cssText = `${cardStyle(item.size)}; animation-delay:${Math.min(index * 0.04, 1.2)}s`;
    card.dataset.index = String(index);
    card.dataset.id = item.id;
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${item.title}. Открыть в 3D-галерее`);

    const shimmer = document.createElement('div');
    shimmer.className = 'shimmer';
    shimmer.style.cssText = 'position:absolute;inset:0;z-index:0';
    card.appendChild(shimmer);

    if (item.type === 'video') {
      const v = document.createElement('video');
      v.className = 'gx-media';
      v.poster = item.src;
      v.muted = true; v.autoplay = true; v.loop = true; v.playsInline = true;
      v.preload = index < 8 ? 'metadata' : 'none';
      v.dataset.src = item.videoSrc;
      if (index < 8) v.src = item.videoSrc;
      v.addEventListener('loadeddata', () => shimmer.remove(), { once: true });
      v.addEventListener('error', () => shimmer.remove(), { once: true });
      card.appendChild(v);
      const play = document.createElement('div'); play.className = 'gx-play-wrap'; play.innerHTML = tinyPlayIcon(); card.appendChild(play);
    } else {
      const img = document.createElement('img');
      img.className = 'gx-media';
      img.src = item.src; img.alt = item.title;
      img.loading = index < 8 ? 'eager' : 'lazy'; img.decoding = 'async';
      img.addEventListener('load', () => shimmer.remove(), { once: true });
      img.addEventListener('error', () => shimmer.remove(), { once: true });
      card.appendChild(img);
    }
    card.insertAdjacentHTML('beforeend', `<div class="gx-glow"></div><div class="gx-gradient"></div><div class="gx-caption-wrap"><p class="gx-caption-title">${escapeHtml(item.title)}</p></div>`);
    card.addEventListener('click', () => openLightbox(index));
    attachCardTilt(card);
    frag.appendChild(card);
  });
  grid.appendChild(frag);
  setupVideoObserver();
}

function attachCardTilt(card) {
  if (matchMedia('(hover: none), (pointer: coarse)').matches) return;
  let raf = 0;
  card.addEventListener('mousemove', e => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.transform = `perspective(1000px) rotateX(${(y - 0.5) * -7}deg) rotateY(${(x - 0.5) * 7}deg) scale(1.015)`;
    });
  });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
}

function setupVideoObserver() {
  if (state.videoObserver) state.videoObserver.disconnect();
  if (!('IntersectionObserver' in window)) return;
  state.videoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const v = entry.target;
      if (entry.isIntersecting) {
        if (!v.src && v.dataset.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else v.pause();
    });
  }, { threshold: 0.1, rootMargin: '200px 0px 200px 0px' });
  $$('#galleryGrid video').forEach(v => state.videoObserver.observe(v));
}

function mediaMarkup(item, i, active) {
  const near = Math.abs(i - active) <= 1;
  if (item.type === 'video') {
    return `<video src="${item.videoSrc}" poster="${item.src}" muted ${i === active ? 'autoplay' : ''} loop playsinline preload="${near ? 'metadata' : 'none'}" class="gx-lb-media video-media"></video>`;
  }
  return `<img src="${near ? (item.fullSrc || item.src) : item.src}" alt="${escapeHtml(item.title)}" loading="${near ? 'eager' : 'lazy'}" class="gx-lb-media" onerror="if(this.src!=='${item.src}')this.src='${item.src}'">`;
}

function openLightbox(index) {
  state.activeIndex = index;
  state.swiperReady = false;
  const root = document.createElement('div');
  root.className = 'gx-lightbox-root';
  root.id = 'gxLightbox';
  root.innerHTML = `
    <div class="gx-lb-bg"><div class="gx-lb-bg-img" id="gxLbBg"></div></div>
    <button class="gx-lb-close" id="gxLbClose" type="button" aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    <button class="gx-cover-arrow gx-cover-prev" id="gxPrev" type="button" aria-label="Предыдущая работа"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
    <button class="gx-cover-arrow gx-cover-next" id="gxNext" type="button" aria-label="Следующая работа"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    <div class="swiper gx-coverflow-shell" id="gxSwiper"><div class="swiper-wrapper" id="gxWrapper"></div></div>
    <div class="gx-lb-counter-wrap"><div class="gx-lb-count-pill" id="gxLbCounter"></div><h2 class="gx-lb-title-lite gx-lb-meta-fade" id="gxLbTitle"></h2></div>
    <div class="gx-lb-thumbs" id="gxThumbs"></div>`;
  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';

  root.addEventListener('click', e => { if (e.target === root) closeLightbox(); });
  $('.gx-lb-bg', root)?.addEventListener('click', e => { e.stopPropagation(); closeLightbox(); });
  $('#gxLbClose').addEventListener('click', e => { e.stopPropagation(); closeLightbox(); });
  $('#gxPrev').addEventListener('click', e => { e.stopPropagation(); state.swiper?.slidePrev(); });
  $('#gxNext').addEventListener('click', e => { e.stopPropagation(); state.swiper?.slideNext(); });
  $('#gxSwiper').addEventListener('click', e => e.stopPropagation());
  $('#gxThumbs').addEventListener('click', e => e.stopPropagation());
  window.addEventListener('keydown', onLightboxKey);

  renderLightboxSlides(index);
  initSwiperWhenReady(index);
  updateLightbox(index, true);
}

function renderLightboxSlides(active) {
  $('#gxWrapper').innerHTML = state.visible.map((item, i) => `<div class="swiper-slide"><div class="relative">${mediaMarkup(item, i, active)}</div></div>`).join('');
  $('#gxThumbs').innerHTML = state.visible.map((item, i) => `<button class="gx-thumb" type="button" data-i="${i}" aria-label="${escapeHtml(item.title)}"><img src="${item.src}" alt="">${item.type === 'video' ? '<span class="gx-thumb-play"><svg viewBox="0 0 12 12"><path d="M3.5 2v8l6.5-4z" fill="white" fill-opacity="0.85"/></svg></span>' : ''}</button>`).join('');
  $$('#gxThumbs .gx-thumb').forEach(btn => btn.addEventListener('click', () => state.swiper?.slideTo(Number(btn.dataset.i))));
}

function initSwiperWhenReady(index) {
  const init = () => {
    if (!window.Swiper) { setTimeout(init, 80); return; }
    const compact = window.innerWidth < 700;
    state.swiper = new Swiper('#gxSwiper', {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      initialSlide: index,
      speed: 500,
      keyboard: { enabled: true },
      coverflowEffect: {
        rotate: compact ? 14 : 25,
        stretch: 0,
        depth: compact ? 120 : 280,
        modifier: compact ? 0.72 : 1,
        slideShadows: false,
      },
      on: {
        slideChange() { updateLightbox(this.activeIndex); },
        init() { state.swiperReady = true; updateLightbox(this.activeIndex, true); },
      },
    });
  };
  init();
}

function updateLightbox(index, immediate = false) {
  state.activeIndex = index;
  const item = state.visible[index];
  if (!item) return;
  $('#gxLbBg').style.backgroundImage = `url("${item.src}")`;
  $('#gxLbCounter').textContent = `${index + 1} / ${state.visible.length}`;
  $('#gxLbTitle').textContent = item.title;
  $('#gxPrev').style.display = index > 0 ? 'flex' : 'none';
  $('#gxNext').style.display = index < state.visible.length - 1 ? 'flex' : 'none';
  $$('#gxThumbs .gx-thumb').forEach((t, i) => t.classList.toggle('gx-thumb-active', i === index));
  $('#gxThumbs').children[index]?.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  $$('#gxWrapper video').forEach((v, i) => { if (i === index) v.play().catch(() => {}); else v.pause(); });
  history.replaceState(null, '', `#${item.id}`);
}

function onLightboxKey(e) {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') state.swiper?.slidePrev();
  if (e.key === 'ArrowRight') state.swiper?.slideNext();
}

function closeLightbox() {
  window.removeEventListener('keydown', onLightboxKey);
  $$('#gxWrapper video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
  if (state.swiper) { state.swiper.destroy(true, true); state.swiper = null; }
  $('#gxLightbox')?.remove();
  document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname + location.search);
}

function hidePreloader(delay = 650) {
  setTimeout(() => $('#preloader')?.classList.add('hidden'), delay);
  setTimeout(() => $('#preloader')?.remove(), delay + 800);
}

function boot() {
  $('#gxSeal').innerHTML = luxeSeal();
  state.items = buildInterleavedItems();
  renderFilters();
  renderGrid();
  $('#resetFilter')?.addEventListener('click', () => { state.filter = 'all'; renderFilters(); renderGrid(); });
  hidePreloader();
  setTimeout(() => hidePreloader(0), 5000);

  const hash = decodeURIComponent(location.hash.replace('#', ''));
  if (hash) {
    const idx = state.visible.findIndex(item => item.id === hash);
    if (idx >= 0) setTimeout(() => openLightbox(idx), 350);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
