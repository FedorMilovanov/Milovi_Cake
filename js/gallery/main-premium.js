/* ===========================================================================
 * Milovi Cake Gallery 2026 PREMIUM — Final Port
 * Full merge of your original architecture + AI Demo effects
 * 3D Tilt + Mouse Glow + Swiper 3D Coverflow + Performance fixes
 * Optimized for 46 items (many videos)
 * =========================================================================== */

import { GALLERY_ITEMS } from './data.js';
import { editorialShuffle } from './shuffle.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

let swiperInstance = null;
let currentFilter = 'all';
let currentItems = [];

// Throttle for mousemove
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

function renderGrid(items) {
  const grid = $('#gxGrid');
  grid.innerHTML = '';

  const frag = document.createDocumentFragment();
  items.forEach((item, idx) => {
    const fig = document.createElement('figure');
    fig.className = `gx-cell ${item.size ? 's-' + item.size : ''}`;
    fig.dataset.id = item.id;
    fig.dataset.type = item.type;
    fig.dataset.tags = ['all', item.type, ...(item.tags || [])].join(' ');
    fig.dataset.title = item.title || '';
    fig.dataset.desc = item.desc || '';
    if (item.full) fig.dataset.full = item.full;
    if (item.poster) fig.dataset.poster = item.poster;
    if (item.type === 'video' && item.src) fig.dataset.src = item.src;

    fig.setAttribute('role', 'button');
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('aria-label', `${item.title}. Открыть ${item.type}`);

    const inner = document.createElement('div');
    inner.className = 'gx-cell-content';

    if (item.type === 'photo' || !item.src.includes('.webm')) {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.title;
      img.loading = idx < 8 ? 'eager' : 'lazy';
      inner.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = item.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      if (item.poster) video.poster = item.poster;
      inner.appendChild(video);

      const badge = document.createElement('div');
      badge.className = 'gx-vid-badge';
      badge.innerHTML = `<svg viewBox="0 0 10 12"><path d="M0 0l10 6-10 6z"/></svg>`;
      inner.appendChild(badge);
    }

    const cap = document.createElement('figcaption');
    cap.className = 'gx-caption';
    cap.textContent = item.title;
    inner.appendChild(cap);

    fig.appendChild(inner);
    fig.style.setProperty('--rd', `${Math.min(idx * 22, 650)}ms`);
    frag.appendChild(fig);
  });

  grid.appendChild(frag);
  initCardInteractions();
}

function initCardInteractions() {
  const cards = $$('.gx-cell');
  
  cards.forEach(card => {
    const content = card.querySelector('.gx-cell-content');
    
    const moveHandler = throttle((e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
      
      // Light 3D tilt
      const rotX = (y - 50) * -0.18;
      const rotY = (x - 50) * 0.22;
      content.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.04)`;
    }, 16);

    card.addEventListener('mousemove', moveHandler);
    card.addEventListener('mouseleave', () => {
      content.style.transform = `perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)`;
    });

    card.addEventListener('click', () => openLightbox(card));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(card);
      }
    });
  });
}

function initFilters() {
  const buttons = $$('.gx-filter button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.f;
      buttons.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      
      const filtered = currentFilter === 'all' 
        ? GALLERY_ITEMS 
        : GALLERY_ITEMS.filter(item => item.tags && item.tags.includes(currentFilter) || item.type === currentFilter);
      
      currentItems = editorialShuffle(filtered, 6);
      renderGrid(currentItems);
    });
  });
}

function initVideoAutoplay() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target.querySelector('video');
      if (!video) return;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { rootMargin: '80px', threshold: 0.25 });

  $$('.gx-cell').forEach(cell => {
    if (cell.dataset.type === 'video') observer.observe(cell);
  });
}

let lightboxItems = [];
let currentIndex = 0;

function openLightbox(originCard) {
  const gridCells = $$('.gx-cell:not([hidden])');
  lightboxItems = gridCells;
  currentIndex = lightboxItems.indexOf(originCard);
  if (currentIndex === -1) currentIndex = 0;

  const light = $('#gxLight');
  light.classList.add('active');
  document.body.style.overflow = 'hidden';

  initSwiperLightbox();
  updateLightboxContent();
}

function closeLightbox() {
  const light = $('#gxLight');
  light.classList.remove('active');
  document.body.style.overflow = '';
  if (swiperInstance) {
    swiperInstance.destroy(true, true);
    swiperInstance = null;
  }
}

function updateLightboxContent() {
  const item = lightboxItems[currentIndex];
  if (!item) return;

  $('#lbTitle').textContent = item.dataset.title || 'Работа Milovi Cake';
  $('#lbDesc').textContent = item.dataset.desc || '';
  $('#lbCounter').textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(lightboxItems.length).padStart(2, '0')}`;

  // Update ambient background
  const bg = $('#lbBg') || $('.lb-backdrop-bg');
  const imgSrc = item.querySelector('img')?.src || item.dataset.poster || item.dataset.full;
  if (bg && imgSrc) bg.style.backgroundImage = `url('${imgSrc}')`;
}

function initSwiperLightbox() {
  if (swiperInstance) swiperInstance.destroy(true, true);

  const wrapper = $('#swiperWrapper');
  wrapper.innerHTML = '';

  lightboxItems.forEach((cell, i) => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    
    const isVideo = cell.dataset.type === 'video';
    const mediaSrc = isVideo ? (cell.dataset.src || cell.querySelector('video')?.src) : (cell.dataset.full || cell.querySelector('img')?.src);
    const poster = cell.dataset.poster || cell.querySelector('img')?.src;

    if (isVideo) {
      slide.innerHTML = `
        <video class="lb-media" src="${mediaSrc}" poster="${poster}" controls loop muted playsinline></video>
      `;
    } else {
      slide.innerHTML = `<img class="lb-media" src="${mediaSrc}" alt="${cell.dataset.title}">`;
    }
    wrapper.appendChild(slide);
  });

  swiperInstance = new Swiper('#lbSwiper', {
    effect: 'coverflow',
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 'auto',
    initialSlide: currentIndex,
    speed: 800,
    loop: false,
    keyboard: { enabled: true },
    coverflowEffect: {
      rotate: 22,
      stretch: 0,
      depth: 320,
      modifier: 1.4,
      slideShadows: false,
    },
    on: {
      slideChange: function () {
        currentIndex = this.activeIndex;
        updateLightboxContent();
        
        // Play/pause videos
        $$('.swiper-slide video').forEach((v, idx) => {
          if (idx === currentIndex) v.play().catch(()=>{});
          else v.pause();
        });
      }
    }
  });
}

// Bind controls
function bindLightboxControls() {
  $('#gxClose').addEventListener('click', closeLightbox);
  $('#gxPrev').addEventListener('click', () => { if (swiperInstance) swiperInstance.slidePrev(); });
  $('#gxNext').addEventListener('click', () => { if (swiperInstance) swiperInstance.slideNext(); });

  $('#gxLight').addEventListener('click', (e) => {
    if (e.target.id === 'gxLight' || e.target.classList.contains('lb-backdrop')) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!$('#gxLight').classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
  });
}

function boot() {
  currentItems = editorialShuffle(GALLERY_ITEMS, 8);
  renderGrid(currentItems);
  initFilters();
  bindLightboxControls();
  initVideoAutoplay();

  // Keyboard accessibility for grid
  $('#gxGrid').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#gxLight').classList.contains('active')) closeLightbox();
  });

  console.log('%cMilovi Cake Gallery 2026 PREMIUM initialized successfully', 'color:#b8823a; font-family:monospace');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
