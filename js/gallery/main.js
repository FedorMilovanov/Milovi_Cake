/* ===========================================================================
 * Milovi Cake — Gallery 2026 Edition
 * Architecture by Apple-style sr. engineer, 30y experience
 *
 * Layered architecture:
 *   1. Data layer  → ./data.js          (single source of truth)
 *   2. Build layer → renderGrid()       (pure CSS Grid, no Muuri)
 *   3. Layout      → CSS grid-auto-flow:dense + intrinsic aspect
 *   4. UX modules:
 *        a. View Transitions API (seamless morph open/close)
 *        b. WebGL liquid shader hover (./effects/liquid.js)
 *        c. Magnetic spotlight cursor  (./effects/cursor.js)
 *        d. Scroll-velocity skew      (./effects/scrollSkew.js)
 *        e. Ambient backdrop blur      (handled in lightbox here)
 *
 * Progressive enhancement:
 *   – Works without JS (raw <figure> markup is rendered SSR-friendly)
 *   – View Transitions degrade to elegant fade in unsupported browsers
 *   – WebGL shader degrades to CSS scale on devices without WebGL2
 *   – Magnetic cursor disabled on touch / coarse pointer
 *   – Scroll-skew respects prefers-reduced-motion
 * --------------------------------------------------------------------------- */

import { GALLERY_ITEMS } from './data.js';
import { editorialShuffle } from './shuffle.js';
import { initLiquidHover } from './effects/liquid.js';
import { initMagneticCursor } from './effects/cursor.js';
import { initScrollSkew } from './effects/scrollSkew.js';
import { extractAmbient } from './effects/ambient.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const PREFERS_REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_TOUCH        = matchMedia('(hover: none), (pointer: coarse)').matches;
const SUPPORTS_VT     = typeof document.startViewTransition === 'function';

/* =====================================================================
 * 1) RENDER GRID
 * ===================================================================== */
function renderGrid(items) {
  const grid = $('#gxGrid');
  grid.innerHTML = '';

  const frag = document.createDocumentFragment();
  items.forEach((item, idx) => {
    const fig = document.createElement('figure');
    fig.className = `gx-cell${item.size ? ' s-' + item.size : ''}`;
    fig.dataset.id   = item.id;
    fig.dataset.type = item.type;
    fig.dataset.tags = ['all', item.type, ...item.tags].join(' ');
    fig.dataset.title = item.title;
    fig.dataset.desc  = item.desc;
    if (item.full)   fig.dataset.full   = item.full;
    if (item.poster) fig.dataset.poster = item.poster;
    if (item.type === 'video') fig.dataset.src = item.src;

    if (SUPPORTS_VT) fig.style.viewTransitionName = `vt-${item.id}`;

    fig.setAttribute('role', 'button');
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('aria-label', `${item.title}. Открыть ${item.type === 'video' ? 'видео' : 'фото'}`);

    const inner = document.createElement('div');
    inner.className = 'gx-cell-content';

    if (item.type === 'photo') {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.title;
      img.loading = idx < 6 ? 'eager' : 'lazy';
      img.decoding = 'async';
      if (idx < 3) img.fetchPriority = 'high';
      inner.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = item.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.poster = item.poster || '';
      inner.appendChild(video);

      const badge = document.createElement('div');
      badge.className = 'gx-vid-badge';
      badge.innerHTML = '<svg viewBox="0 0 10 12"><path d="M0 0l10 6-10 6z"/></svg>';
      inner.appendChild(badge);
    }

    const cap = document.createElement('figcaption');
    cap.className = 'gx-caption';
    cap.textContent = item.title;
    inner.appendChild(cap);

    fig.appendChild(inner);
    fig.style.setProperty('--rd', `${Math.min(idx * 28, 900)}ms`);
    frag.appendChild(fig);
  });

  grid.appendChild(frag);
}

/* =====================================================================
 * 2) FILTERS — animated via View Transitions
 * ===================================================================== */
function initFilters() {
  const buttons = $$('.gx-filter button');
  const apply = (filter) => {
    $$('.gx-cell').forEach((cell) => {
      const tags = (cell.dataset.tags || '').split(/\s+/);
      const match = filter === 'all' || tags.includes(filter);
      cell.toggleAttribute('hidden', !match);
    });
  };

  const run = (btn) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
    const filter = btn.dataset.f;
    if (SUPPORTS_VT && !PREFERS_REDUCED) {
      document.startViewTransition(() => apply(filter));
    } else {
      apply(filter);
    }
  };

  buttons.forEach((btn) => btn.addEventListener('click', () => run(btn)));
}

/* =====================================================================
 * 3) VIDEO autoplay only when in viewport (battery & perf)
 * ===================================================================== */
function initVideoAutoplay() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) v.play?.().catch(() => {});
      else v.pause?.();
    });
  }, { rootMargin: '120px', threshold: 0.15 });
  $$('.gx-cell video').forEach((v) => io.observe(v));
}

/* =====================================================================
 * 4) LIGHTBOX with View Transitions, Ambient backdrop, keyboard, swipe
 * ===================================================================== */
const Lightbox = (() => {
  let items = [];
  let index = 0;
  let touchStartX = 0;

  const root      = $('#gxLight');
  const stage     = $('#gxStage');
  const backdrop  = $('#gxBackdrop');
  const titleEl   = $('#gxTitleV2');
  const descEl    = $('#gxDescV2');
  const counterC  = $('#gxCurrent');
  const counterT  = $('#gxTotal');
  const thumbsEl  = $('#gxThumbs');

  const visibleItems = () => $$('.gx-cell:not([hidden])');

  function buildThumbs() {
    thumbsEl.innerHTML = '';
    items.forEach((el, i) => {
      const t = document.createElement('button');
      t.className = 'gx-thumb';
      t.type = 'button';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = el.querySelector('img')?.src || el.dataset.poster || '';
      img.alt = '';
      t.appendChild(img);
      t.addEventListener('click', () => goTo(i));
      thumbsEl.appendChild(t);
    });
  }

  function renderStage() {
    const el = items[index];
    if (!el) return;
    const isVideo = el.dataset.type === 'video';

    items.forEach((c) => (c.style.viewTransitionName = ''));
    el.style.viewTransitionName = `vt-${el.dataset.id}`;

    stage.innerHTML = '';
    const frame = document.createElement('div');
    frame.className = 'gx-slide-frame';
    frame.style.viewTransitionName = `vt-${el.dataset.id}`;

    if (isVideo) {
      const v = document.createElement('video');
      v.src = el.dataset.src;
      v.controls = true;
      v.autoplay = true;
      v.loop = true;
      v.muted = false;
      v.playsInline = true;
      v.poster = el.dataset.poster || '';
      frame.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = el.dataset.full || el.querySelector('img')?.src;
      img.alt = el.dataset.title || '';
      img.decoding = 'async';
      frame.appendChild(img);
    }
    stage.appendChild(frame);

    titleEl.textContent = el.dataset.title || '';
    descEl.textContent  = el.dataset.desc  || '';
    counterC.textContent = String(index + 1);
    counterT.textContent = String(items.length);

    $$('.gx-thumb', thumbsEl).forEach((t, i) => t.classList.toggle('active', i === index));
    const active = thumbsEl.children[index];
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    const sampleSrc = el.dataset.poster || el.querySelector('img')?.src || el.dataset.full;
    extractAmbient(sampleSrc).then(({ r, g, b }) => {
      backdrop.style.setProperty('--ambient', `rgb(${r}, ${g}, ${b})`);
      backdrop.style.backgroundImage = `url("${sampleSrc}")`;
    });

    history.replaceState(null, '', `#${el.dataset.id}`);
  }

  function open(originEl) {
    items = visibleItems();
    if (!items.length) return;
    index = items.indexOf(originEl);
    if (index < 0) index = 0;

    const doOpen = () => {
      buildThumbs();
      renderStage();
      root.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.body.classList.add('gx-lightbox-open');
    };

    if (SUPPORTS_VT && !PREFERS_REDUCED) {
      document.startViewTransition(doOpen);
    } else {
      doOpen();
    }
  }

  function close() {
    const el = items[index];
    if (el && SUPPORTS_VT) {
      $$('#gxStage .gx-slide-frame').forEach((f) => (f.style.viewTransitionName = ''));
      el.style.viewTransitionName = `vt-${el.dataset.id}`;
    }

    const doClose = () => {
      root.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      document.body.classList.remove('gx-lightbox-open');
      stage.innerHTML = '';
      history.replaceState(null, '', location.pathname);
    };

    if (SUPPORTS_VT && !PREFERS_REDUCED) {
      document.startViewTransition(doClose);
    } else {
      doClose();
    }
  }

  function goTo(i) {
    if (i < 0) i = items.length - 1;
    if (i >= items.length) i = 0;
    index = i;
    if (SUPPORTS_VT && !PREFERS_REDUCED) {
      document.startViewTransition(renderStage);
    } else {
      renderStage();
    }
  }

  function bind() {
    $('#gxClose').addEventListener('click', close);
    $('#gxPrev').addEventListener('click', () => goTo(index - 1));
    $('#gxNext').addEventListener('click', () => goTo(index + 1));

    backdrop.addEventListener('click', close);

    $('#gxShare').addEventListener('click', async () => {
      const el = items[index];
      const url = location.origin + location.pathname + '#' + el.dataset.id;
      try {
        if (navigator.share) await navigator.share({ title: el.dataset.title, url });
        else {
          await navigator.clipboard.writeText(url);
          flashShare('Ссылка скопирована');
        }
      } catch (_) { /* user dismissed */ }
    });

    $('#gxFS').addEventListener('click', () => {
      if (!document.fullscreenElement) root.requestFullscreen?.();
      else document.exitFullscreen?.();
    });

    document.addEventListener('keydown', (e) => {
      if (root.getAttribute('aria-hidden') === 'true') return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') goTo(index - 1);
      if (e.key === 'ArrowRight') goTo(index + 1);
    });

    stage.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 60) goTo(index + (dx < 0 ? 1 : -1));
    });
  }

  function flashShare(text) {
    const t = document.createElement('div');
    t.className = 'gx-toast';
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 1800);
  }

  return { open, close, bind };
})();

/* =====================================================================
 * 5) CLICK / KEYBOARD on cells → open Lightbox
 * ===================================================================== */
function bindCellClicks() {
  $('#gxGrid').addEventListener('click', (e) => {
    const cell = e.target.closest('.gx-cell');
    if (!cell) return;
    Lightbox.open(cell);
  });
  $('#gxGrid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const cell = e.target.closest('.gx-cell');
    if (!cell) return;
    e.preventDefault();
    Lightbox.open(cell);
  });
}

/* =====================================================================
 * 6) DEEP LINKING (#workId)
 * ===================================================================== */
function handleHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const cell = $(`.gx-cell[data-id="${hash}"]`);
  if (cell) requestAnimationFrame(() => Lightbox.open(cell));
}

/* =====================================================================
 * BOOT
 * ===================================================================== */
function boot() {
  const ordered = editorialShuffle(GALLERY_ITEMS, 7);
  renderGrid(ordered);

  initFilters();
  bindCellClicks();
  Lightbox.bind();
  initVideoAutoplay();

  if (!PREFERS_REDUCED && !IS_TOUCH) {
    initMagneticCursor();
    initLiquidHover('.gx-cell');
  }
  if (!PREFERS_REDUCED) initScrollSkew('.gx-cell');

  handleHash();
  window.addEventListener('hashchange', handleHash);

  document.documentElement.classList.toggle('vt-supported', SUPPORTS_VT);
  document.documentElement.classList.toggle('is-touch', IS_TOUCH);

  // eslint-disable-next-line no-console
  console.log('%c[Milovi Cake] Gallery 2026 — booted', 'color:#b8823a;font-weight:600',
    { items: ordered.length, vt: SUPPORTS_VT, touch: IS_TOUCH, reducedMotion: PREFERS_REDUCED });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
