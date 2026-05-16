import { GALLERY_ITEMS } from './data.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const SIZE_MAP = {
  tall: '1x2',
  wide: '2x1',
  big: '2x2',
  m: '1x1'
};

const state = {
  filter: 'all',
  items: [],
  visible: [],
  swiper: null,
  lbIndex: 0,
  observer: null,
  bgTimer: null
};

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
  return state.items.filter(item => {
    if (state.filter === 'photo') return item.type === 'photo';
    if (state.filter === 'video') return item.type === 'video';
    return item.tags.includes(state.filter);
  });
}

function sizeClasses(size) {
  if (size === '2x2') return 'col-span-2 row-span-2';
  if (size === '2x1') return 'col-span-2';
  if (size === '1x2') return 'row-span-2';
  return '';
}

function renderGrid() {
  const grid = $('#galleryGrid');
  const empty = $('#gxEmpty');
  state.visible = filteredItems();

  $('#photoCount').textContent = state.visible.filter(i => i.type === 'photo').length;
  $('#videoCount').textContent = state.visible.filter(i => i.type === 'video').length;

  grid.innerHTML = '';
  empty.hidden = state.visible.length !== 0;
  if (!state.visible.length) return;

  const frag = document.createDocumentFragment();
  state.visible.forEach((item, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `card ${sizeClasses(item.size)}`.trim();
    card.dataset.index = String(index);
    card.dataset.id = item.id;
    card.dataset.type = item.type;
    card.dataset.title = item.title;
    card.dataset.desc = item.desc;
    card.style.animationDelay = `${Math.min(index * 0.04, 1.2)}s`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${item.title}. Открыть в 3D-галерее`);

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.className = 'card-media';
      video.poster = item.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = index < 8 ? 'metadata' : 'none';
      video.dataset.src = item.videoSrc;
      if (index < 8) video.src = item.videoSrc;
      card.appendChild(video);
      card.insertAdjacentHTML('beforeend', '<svg class="play-badge" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>');
    } else {
      const img = document.createElement('img');
      img.className = 'card-media';
      img.src = item.src;
      img.alt = item.title;
      img.loading = index < 8 ? 'eager' : 'lazy';
      img.decoding = 'async';
      card.appendChild(img);
    }

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    overlay.innerHTML = `<span class="card-title"></span>`;
    overlay.querySelector('.card-title').textContent = item.title;
    card.appendChild(overlay);

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
  card.addEventListener('mousemove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -10;
      const rotateY = ((x - centerX) / centerX) * 10;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
      card.classList.add('is-active');
    });
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    card.classList.remove('is-active');
  });
}

function setupVideoObserver() {
  if (state.observer) state.observer.disconnect();
  if (!('IntersectionObserver' in window)) return;
  state.observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const v = entry.target;
      if (!v.src && v.dataset.src) v.src = v.dataset.src;
      if (entry.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
  }, { threshold: 0.25, rootMargin: '160px 0px' });
  $$('#galleryGrid video').forEach(v => state.observer.observe(v));
}

function bindFilters() {
  $$('.gx-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      $$('.gx-chip').forEach(b => {
        const active = b === btn;
        b.classList.toggle('gx-chip-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      renderGrid();
      $('#galleryGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  $('#resetFilter')?.addEventListener('click', () => {
    $('.gx-chip[data-filter="all"]')?.click();
  });
}

function lightboxTemplate() {
  return `
    <div class="lb-root" id="lbRoot" role="dialog" aria-modal="true" aria-label="3D-галерея Milovi Cake">
      <div class="lb-backdrop" aria-hidden="true">
        <div class="lb-backdrop-bg" id="lbBackdropBg"></div>
        <div class="lb-backdrop-overlay"></div>
      </div>
      <div class="lb-header">
        <div class="lb-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M9 22V12h6v10"/></svg>
          Milovi Cake
        </div>
        <div class="lb-counter" id="lbCounter"></div>
        <button class="lb-close" id="lbClose" type="button" aria-label="Закрыть">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <button class="lb-nav lb-nav-prev" id="lbPrev" type="button" aria-label="Предыдущая работа">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="lb-nav lb-nav-next" id="lbNext" type="button" aria-label="Следующая работа">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div class="lb-swiper-wrap">
        <div class="swiper lb-swiper" id="lbSwiper">
          <div class="swiper-wrapper" id="lbWrapper"></div>
        </div>
      </div>
      <div class="lb-info">
        <div class="lb-info-inner">
          <h2 class="lb-title" id="lbTitle"></h2>
          <p class="lb-desc" id="lbDesc"></p>
        </div>
      </div>
      <div class="lb-thumbs" id="lbThumbs"></div>
    </div>`;
}

function openLightbox(index) {
  state.lbIndex = index;
  document.body.insertAdjacentHTML('beforeend', lightboxTemplate());
  document.body.style.overflow = 'hidden';

  const wrapper = $('#lbWrapper');
  const thumbs = $('#lbThumbs');
  const frag = document.createDocumentFragment();
  const thumbFrag = document.createDocumentFragment();

  state.visible.forEach((item, i) => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    const wrap = document.createElement('div');
    wrap.className = 'lb-media-wrap';
    if (item.type === 'video') {
      const v = document.createElement('video');
      v.className = 'lb-media';
      v.src = item.videoSrc;
      v.poster = item.src;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = Math.abs(i - index) <= 1 ? 'auto' : 'metadata';
      if (i === index) v.controls = true;
      wrap.appendChild(v);
      const hint = document.createElement('div');
      hint.className = 'lb-video-hint';
      hint.textContent = 'Видео';
      wrap.appendChild(hint);
    } else {
      const img = document.createElement('img');
      img.className = 'lb-media';
      img.src = item.fullSrc || item.src;
      img.alt = item.title;
      img.loading = Math.abs(i - index) <= 1 ? 'eager' : 'lazy';
      img.onerror = () => { if (img.src !== item.src) img.src = item.src; };
      wrap.appendChild(img);
    }
    slide.appendChild(wrap);
    frag.appendChild(slide);

    const th = document.createElement('button');
    th.className = 'lb-thumb';
    th.type = 'button';
    th.setAttribute('aria-label', item.title);
    th.innerHTML = `<img src="${item.src}" alt="">${item.type === 'video' ? '<span class="thumb-play"><svg viewBox="0 0 12 12"><path d="M3.5 2v8l6.5-4z"/></svg></span>' : ''}`;
    th.addEventListener('click', (e) => { e.stopPropagation(); state.swiper?.slideTo(i); });
    thumbFrag.appendChild(th);
  });

  wrapper.appendChild(frag);
  thumbs.appendChild(thumbFrag);

  $('#lbRoot').addEventListener('click', (e) => { if (e.target.id === 'lbRoot') closeLightbox(); });
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbPrev').addEventListener('click', (e) => { e.stopPropagation(); state.swiper?.slidePrev(); });
  $('#lbNext').addEventListener('click', (e) => { e.stopPropagation(); state.swiper?.slideNext(); });

  initSwiperWhenReady(index);
  updateLightbox(index, true);
  window.addEventListener('keydown', onLightboxKey);
}

function initSwiperWhenReady(index) {
  const init = () => {
    if (!window.Swiper) { setTimeout(init, 50); return; }
    const mobile = window.innerWidth < 768;
    state.swiper = new Swiper('#lbSwiper', {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      initialSlide: index,
      speed: 600,
      keyboard: { enabled: true },
      coverflowEffect: {
        rotate: mobile ? 18 : 28,
        stretch: mobile ? -20 : 0,
        depth: mobile ? 150 : 280,
        modifier: 1.3,
        slideShadows: false
      },
      on: {
        slideChange() { updateLightbox(this.activeIndex); },
        init() { updateLightbox(this.activeIndex, true); }
      }
    });
  };
  init();
}

function updateLightbox(index, immediate = false) {
  state.lbIndex = index;
  const item = state.visible[index];
  if (!item) return;

  $('#lbTitle').textContent = item.title;
  $('#lbDesc').textContent = item.desc;
  $('#lbCounter').textContent = `${String(index + 1).padStart(2, '0')} / ${String(state.visible.length).padStart(2, '0')}`;
  $('#lbPrev').style.display = index > 0 ? 'flex' : 'none';
  $('#lbNext').style.display = index < state.visible.length - 1 ? 'flex' : 'none';

  $$('#lbThumbs .lb-thumb').forEach((t, i) => t.classList.toggle('active', i === index));
  $('#lbThumbs').children[index]?.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });

  const bg = $('#lbBackdropBg');
  const setBg = () => { bg.style.backgroundImage = `url("${item.src}")`; bg.classList.remove('is-switching'); };
  if (immediate) setBg();
  else {
    bg.classList.add('is-switching');
    clearTimeout(state.bgTimer);
    state.bgTimer = setTimeout(setBg, 90);
  }

  $$('#lbWrapper video').forEach((v, i) => {
    v.controls = i === index;
    if (i === index) v.play().catch(() => {});
    else v.pause();
  });

  history.replaceState(null, '', `#${item.id}`);
}

function onLightboxKey(e) {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') state.swiper?.slidePrev();
  if (e.key === 'ArrowRight') state.swiper?.slideNext();
}

function closeLightbox() {
  window.removeEventListener('keydown', onLightboxKey);
  $$('#lbWrapper video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
  if (state.swiper) { state.swiper.destroy(true, true); state.swiper = null; }
  $('#lbRoot')?.remove();
  document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname + location.search);
}

function boot() {
  state.items = buildInterleavedItems();
  bindFilters();
  renderGrid();

  setTimeout(() => $('#preloader')?.classList.add('hidden'), 650);
  setTimeout(() => $('#preloader')?.remove(), 1400);

  const hash = decodeURIComponent(location.hash.replace('#', ''));
  if (hash) {
    const idx = state.visible.findIndex(item => item.id === hash);
    if (idx >= 0) setTimeout(() => openLightbox(idx), 300);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
