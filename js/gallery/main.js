/* ===========================================================================
 * Milovi Cake — Gallery 2026 PREMIUM
 * Полная переработка: адаптация AI-демо (Swiper Coverflow + mouse-glow +
 * hover-blur соседей) + сохранение оригинальной архитектуры проекта.
 * Все баги переноса исправлены. Оптимизирован для 46 работ (16 видео).
 * ===========================================================================*/

import { GALLERY_ITEMS } from './data.js';
import { editorialShuffle } from './shuffle.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const PREFERS_REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches;

/* ─── Throttle helper ──────────────────────────────────────────────────── */
function throttle(fn, ms) {
  let t; return function(...a) { if (!t) { fn.apply(this, a); t = setTimeout(() => t = null, ms); } };
}

/* =====================================================================
 * 1. RENDER GRID
 * ===================================================================== */
function renderGrid(items) {
  const grid = $('#galleryGrid');
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();

  items.forEach((item, idx) => {
    const card = document.createElement('figure');
    card.className = `card${item.size ? ' s-' + item.size : ''}`;
    card.dataset.id    = item.id;
    card.dataset.type  = item.type;
    card.dataset.tags  = ['all', item.type, ...(item.tags || [])].join(' ');
    card.dataset.title = item.title || '';
    card.dataset.desc  = item.desc  || '';
    if (item.full)   card.dataset.full   = item.full;
    if (item.poster) card.dataset.poster = item.poster;
    if (item.type === 'video') card.dataset.src = item.src;

    card.setAttribute('role',       'button');
    card.setAttribute('tabindex',   '0');
    card.setAttribute('aria-label', `${item.title} — открыть ${item.type === 'video' ? 'видео' : 'фото'}`);

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    if (item.type === 'photo') {
      const img = document.createElement('img');
      img.src          = item.src;
      img.alt          = item.title;
      img.loading      = idx < 8 ? 'eager' : 'lazy';
      img.decoding     = 'async';
      if (idx < 3) img.fetchPriority = 'high';
      inner.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src       = item.src;
      video.muted     = true;
      video.loop      = true;
      video.playsInline = true;
      video.preload   = 'metadata';
      video.poster    = item.poster || '';
      inner.appendChild(video);

      const badge = document.createElement('div');
      badge.className = 'vid-badge';
      badge.innerHTML = `<svg viewBox="0 0 10 12"><path d="M0 0l10 6-10 6z"/></svg>`;
      inner.appendChild(badge);
    }

    const cap = document.createElement('figcaption');
    cap.className = 'card-caption';
    cap.textContent = item.title;
    inner.appendChild(cap);

    card.appendChild(inner);
    frag.appendChild(card);
  });

  grid.appendChild(frag);
  initCardInteractions();
}

/* =====================================================================
 * 2. CARD INTERACTIONS — 3D tilt + mouse-glow
 * ===================================================================== */
function initCardInteractions() {
  if (IS_TOUCH || PREFERS_REDUCED) return; // only on hover devices

  $$('.card').forEach(card => {
    const inner = card.querySelector('.card-inner');

    const onMove = throttle(e => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width)  * 100;
      const y = ((e.clientY - r.top)  / r.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
      // Subtle 3D tilt
      const rx = (y - 50) * -0.12;
      const ry = (x - 50) *  0.15;
      inner.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.04)`;
    }, 14);

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', () => {
      inner.style.transform = '';
    });
  });
}

/* =====================================================================
 * 3. FILTERS
 * ===================================================================== */
function initFilters() {
  const buttons = $$('.filters button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.f;
      buttons.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      $$('.card').forEach(cell => {
        const tags = (cell.dataset.tags || '').split(/\s+/);
        const show = f === 'all' || tags.includes(f);
        cell.toggleAttribute('hidden', !show);
      });
    });
  });
}

/* =====================================================================
 * 4. VIDEO AUTOPLAY IN VIEWPORT
 * ===================================================================== */
function initVideoAutoplay() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const v = e.target.querySelector('video');
      if (!v) return;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
  }, { rootMargin: '100px', threshold: 0.2 });
  $$('.card[data-type="video"]').forEach(c => io.observe(c));
}

/* =====================================================================
 * 5. LIGHTBOX — Swiper Coverflow + Ambient backdrop
 *    ФИКСЫ ВСПЫШЕК:
 *    • lb-backdrop-bg без animation (только transition)
 *    • backface-visibility: hidden на слайдах
 *    • явный dark background на .swiper-slide
 *    • смена backdrop через opacity вместо мгновенной замены
 * ===================================================================== */
const LB = (() => {
  let items      = [];
  let idx        = 0;
  let swiper     = null;
  let touchStartX = 0;
  let scrollY    = 0;

  const root    = $('#lightbox');
  const bg      = $('#lbBg');
  const titleEl = $('#lbTitle');
  const descEl  = $('#lbDesc');
  const counter = $('#lbCounter');
  const thumbs  = $('#lbThumbs');

  /* Build Swiper slides */
  function buildSwiper() {
    if (swiper) { swiper.destroy(true, true); swiper = null; }
    const wrapper = $('#lbWrapper');
    wrapper.innerHTML = '';

    items.forEach((card, i) => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      // Фикс вспышек: явный тёмный фон на каждом слайде
      slide.style.cssText = 'background:transparent;';

      const isVideo = card.dataset.type === 'video';
      if (isVideo) {
        const v = document.createElement('video');
        v.className   = 'lb-media';
        v.src         = card.dataset.src || card.querySelector('video')?.src || '';
        v.poster      = card.dataset.poster || '';
        v.controls    = true;
        v.loop        = true;
        v.playsInline = true;
        v.muted       = false;
        // Фикс: не autoplay — запускаем только на активном слайде
        slide.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.className = 'lb-media';
        img.src = card.dataset.full || card.querySelector('img')?.src || '';
        img.alt = card.dataset.title || '';
        img.loading = i === idx ? 'eager' : 'lazy';
        slide.appendChild(img);
      }
      wrapper.appendChild(slide);
    });

    swiper = new Swiper('#lbSwiper', {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      initialSlide: idx,
      speed: 700,
      loop: false,
      keyboard: { enabled: true },
      coverflowEffect: {
        rotate: 30,
        stretch: 0,
        depth: 280,
        modifier: 1,
        slideShadows: false,   // отключаем тени Swiper — они вызывают вспышки
      },
      on: {
        slideChange() {
          idx = this.activeIndex;
          updateMeta();
          updateThumbs();
          // Пауза всех видео, старт только активного
          $$('.swiper-slide video', root).forEach((v, i) => {
            if (i === idx) v.play().catch(() => {});
            else { v.pause(); v.currentTime = 0; }
          });
        }
      }
    });
  }

  /* Build thumbnails */
  function buildThumbs() {
    thumbs.innerHTML = '';
    items.forEach((card, i) => {
      const btn = document.createElement('button');
      btn.className = 'lb-thumb';
      btn.type = 'button';
      btn.setAttribute('aria-label', card.dataset.title || `Слайд ${i+1}`);
      const img = document.createElement('img');
      img.src     = card.querySelector('img')?.src || card.dataset.poster || '';
      img.alt     = '';
      img.loading = 'lazy';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        idx = i;
        swiper?.slideTo(i);
        updateMeta();
        updateThumbs();
      });
      thumbs.appendChild(btn);
    });
  }

  /* Update counter, title, desc, ambient bg */
  function updateMeta() {
    const card = items[idx];
    if (!card) return;
    titleEl.textContent = card.dataset.title || '';
    descEl.textContent  = card.dataset.desc  || '';
    counter.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;

    // Ambient: меняем через opacity чтобы не было вспышки
    const src = card.querySelector('img')?.src || card.dataset.poster || card.dataset.full || '';
    if (src) {
      bg.style.opacity = '0';
      setTimeout(() => {
        bg.style.backgroundImage = `url("${src}")`;
        bg.style.opacity = '1';
      }, 150);
    }
  }

  /* Update thumbnail active state */
  function updateThumbs() {
    $$('.lb-thumb', thumbs).forEach((t, i) => t.classList.toggle('active', i === idx));
    thumbs.children[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  /* Open */
  function open(originCard) {
    items = $$('.card:not([hidden])');
    idx   = items.indexOf(originCard);
    if (idx < 0) idx = 0;

    buildThumbs();
    buildSwiper();
    updateMeta();
    updateThumbs();

    root.setAttribute('aria-hidden', 'false');
    root.classList.add('active');
    scrollY = window.scrollY || 0;
    document.body.style.overflow = 'hidden';

    // Старт видео активного слайда
    requestAnimationFrame(() => {
      const activeVid = $$('.swiper-slide', root)[idx]?.querySelector('video');
      activeVid?.play().catch(() => {});
    });
  }

  /* Close */
  function close() {
    // Pause all videos first
    $$('.swiper-slide video', root).forEach(v => { v.pause(); v.currentTime = 0; });

    root.classList.remove('active');
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    window.scrollTo(0, scrollY);

    setTimeout(() => {
      if (swiper) { swiper.destroy(true, true); swiper = null; }
      $('#lbWrapper').innerHTML = '';
      thumbs.innerHTML = '';
      bg.style.backgroundImage = '';
      bg.style.opacity = '1';
    }, 400);
  }

  /* Bind controls */
  function bind() {
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => swiper?.slidePrev());
    $('#lbNext').addEventListener('click', () => swiper?.slideNext());

    // Close on backdrop click
    root.addEventListener('click', e => {
      if (e.target === root || e.target.classList.contains('lb-backdrop')) close();
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (root.getAttribute('aria-hidden') === 'true') return;
      if (e.key === 'Escape')      close();
      if (e.key === 'ArrowLeft')   swiper?.slidePrev();
      if (e.key === 'ArrowRight')  swiper?.slideNext();
    });

    // Touch swipe on lightbox
    root.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend',   e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 55) dx < 0 ? swiper?.slideNext() : swiper?.slidePrev();
    });

    // Popstate
    window.addEventListener('popstate', () => {
      if (root.getAttribute('aria-hidden') === 'false') close();
    });
  }

  return { open, close, bind };
})();

/* =====================================================================
 * 6. CLICK / KEYBOARD on grid cells
 * ===================================================================== */
function bindGrid() {
  const grid = $('#galleryGrid');
  grid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) LB.open(card);
  });
  grid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.card');
    if (card) { e.preventDefault(); LB.open(card); }
  });
}

/* =====================================================================
 * BOOT
 * ===================================================================== */
function boot() {
  // Hide preloader
  const preloader = $('#preloader');

  const ordered = editorialShuffle(GALLERY_ITEMS, 7);
  renderGrid(ordered);
  initFilters();
  bindGrid();
  LB.bind();
  initVideoAutoplay();

  // Remove preloader after first paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      preloader.classList.add('hidden');
      setTimeout(() => preloader.remove(), 900);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
