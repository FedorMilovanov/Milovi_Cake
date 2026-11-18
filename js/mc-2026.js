/* Milovi Cake shared UX layer. Loaded after main.js and nav.js with defer.
   Cart/calculator behavior stays in main.js; this file progressively enhances it. */

(function(){
  'use strict';

  /* ───────── 0. Утилиты ───────── */
  var ric = window.requestIdleCallback ||
            function(cb){ return setTimeout(function(){
              cb({ timeRemaining: function(){ return 50; } });
            }, 1); };
  var raf = window.requestAnimationFrame || function(cb){ return setTimeout(cb, 16); };
  var isMobile = function(){ return window.innerWidth <= 768; };

  /* ═══════════════════════════════════════════════════════════════════
     1. CLS-fix: добавляем width/height и lazy/decoding к динамическим
        <img>, которые main.js создаёт в карусели каталога.
     Используем MutationObserver — ловит вставку без правки main.js.
     ═══════════════════════════════════════════════════════════════════ */
  function patchDynamicImages(root){
    if (!root || !root.querySelectorAll) return;
    var imgs = root.querySelectorAll('.slide-img > img:not([data-mc-fixed])');
    for (var i = 0; i < imgs.length; i++){
      var img = imgs[i];
      if (!img.hasAttribute('width'))  img.setAttribute('width',  '600');
      if (!img.hasAttribute('height')) img.setAttribute('height', '800');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.hasAttribute('loading'))  img.setAttribute('loading',  'lazy');
      img.setAttribute('data-mc-fixed', '1');
    }
  }
  // Прогон при старте
  patchDynamicImages(document);
  // Наблюдаем только за catalogGrid — не за всем body (performance fix)
  try {
    var mo = new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++){
        var m = muts[i];
        for (var j = 0; j < m.addedNodes.length; j++){
          var n = m.addedNodes[j];
          if (n.nodeType === 1) patchDynamicImages(n);
        }
      }
    });
    var _targetGrid = document.getElementById('catalogGrid');
    if (_targetGrid) {
      // Каталог уже в DOM — наблюдаем только за ним
      mo.observe(_targetGrid, { childList: true, subtree: true });
    } else {
      // Каталог ещё не создан — ждём его появления в body (без subtree)
      var _gridWatcher = new MutationObserver(function(){
        var g = document.getElementById('catalogGrid');
        if (g) {
          _gridWatcher.disconnect();
          mo.observe(g, { childList: true, subtree: true });
        }
      });
      _gridWatcher.observe(document.body, { childList: true });
    }
  } catch(e){ /* ignore */ }


  /* ═══════════════════════════════════════════════════════════════════
     2. Bottom-nav skeleton: убираем после готовности mcNav (anti-CLS)
     ═══════════════════════════════════════════════════════════════════ */
  function checkMcNavReady(){
    if (document.getElementById('mcNav')){
      document.body.classList.add('mc-nav-ready');
      return true;
    }
    return false;
  }
  if (!checkMcNavReady()){
    var navObserver = new MutationObserver(function(){
      if (checkMcNavReady()){ navObserver.disconnect(); }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
    // Резерв: через 4 секунды снимаем класс в любом случае
    setTimeout(function(){
      document.body.classList.add('mc-nav-ready');
      try { navObserver.disconnect(); } catch(e){}
    }, 4000);
  }


  /* [CLEANED] syncStickyWaVisibility removed — mobileStickyWa element no longer exists in DOM */
  /* ═══════════════════════════════════════════════════════════════════
     4. Декоративные SVG / orbs — aria-hidden для screen readers
     ═══════════════════════════════════════════════════════════════════ */
  ric(function(){
    var deco = document.querySelectorAll(
      '.hero-orb, .section-fade-divider, .section-separator, .floating-cta-bg'
    );
    for (var i = 0; i < deco.length; i++){
      if (!deco[i].hasAttribute('aria-hidden')) {
        deco[i].setAttribute('aria-hidden', 'true');
      }
    }
    // SVG inside button/a без явного aria-label → role-less, prendre aria-hidden
    var svgs = document.querySelectorAll('button svg, a svg');
    for (var k = 0; k < svgs.length; k++){
      if (!svgs[k].hasAttribute('aria-hidden') && !svgs[k].hasAttribute('aria-label')){
        svgs[k].setAttribute('aria-hidden', 'true');
        svgs[k].setAttribute('focusable', 'false');
      }
    }
  });


  /* ═══════════════════════════════════════════════════════════════════
     5. Focus-trap для mobile-menu (WCAG 2.4.3 / 2.1.2)
        ESC-handler уже есть в main.js (строка ~2602), не дублируем.
     ═══════════════════════════════════════════════════════════════════ */
  function trapFocus(container){
    if (!container) return null;
    function getFocusable(){
      return Array.prototype.filter.call(
        container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        function(el){ var r = el.getBoundingClientRect(); var cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; }
      );
    }
    /* r15: robust trap — listen on document so focus can't leak behind the
       open modal, and re-query focusables each Tab (cart content changes). */
    function handler(e){
      if (e.key !== 'Tab') return;
      var f = getFocusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      var active = document.activeElement;
      var inside = container.contains(active);
      if (!inside){
        // focus escaped behind the modal — pull it back in
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first){ last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && active === last){ first.focus(); e.preventDefault(); }
    }
    document.addEventListener('keydown', handler, true);
    return function release(){ document.removeEventListener('keydown', handler, true); };
  }

  window._trapFocus = trapFocus; /* r32: export for focus-trap in main.js (bug #38) */
  var menuTrapRelease = null;
  var menuReturnFocus = null;
  function syncMobileMenuTrap(){
    var menu = document.getElementById('mobileMenu');
    if (!menu) return;
    var open = menu.classList.contains('open');
    if (open && !menuTrapRelease){
      menuReturnFocus = document.activeElement;
      menuTrapRelease = trapFocus(menu);
      var closeBtn = menu.querySelector('.mobile-menu-close');
      if (closeBtn) raf(function(){ try { closeBtn.focus(); } catch(e){} });
    } else if (!open && menuTrapRelease){
      menuTrapRelease();
      menuTrapRelease = null;
      if (menuReturnFocus && menuReturnFocus.focus){
        try { menuReturnFocus.focus(); } catch(e){}
      }
      menuReturnFocus = null;
    }
  }

  var menuEl = document.getElementById('mobileMenu');
  if (menuEl){
    var menuMo = new MutationObserver(syncMobileMenuTrap);
    menuMo.observe(menuEl, { attributes: true, attributeFilter: ['class'] });
  }
  // Дополнительный ESC для mobile-menu (main.js его не закрывает)
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    var m = document.getElementById('mobileMenu');
    if (m && m.classList.contains('open') && typeof window.closeMobileMenu === 'function'){
      window.closeMobileMenu();
    }
  });


  /* ═══════════════════════════════════════════════════════════════════
     6. Reviews-карусель: добавляем тач-свайп без переписывания JS
     ═══════════════════════════════════════════════════════════════════ */
  ric(function(){
    var track = document.querySelector('.reviews-track');
    if (!track || !isMobile()) return;
    var startX = 0, startY = 0, dx = 0, dy = 0, swiping = false;
    track.addEventListener('touchstart', function(e){
      if (!e.touches || !e.touches[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; dy = 0; swiping = true;
    }, { passive: true });
    track.addEventListener('touchmove', function(e){
      if (!swiping || !e.touches || !e.touches[0]) return;
      dx = e.touches[0].clientX - startX;
      dy = e.touches[0].clientY - startY;
    }, { passive: true });
    track.addEventListener('touchend', function(){
      if (!swiping) return;
      swiping = false;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){
        if (dx < 0 && typeof window.nextReview === 'function') window.nextReview();
        else if (dx > 0 && typeof window.prevReview === 'function') window.prevReview();
      }
    }, { passive: true });
  });


})();

/* ═══════════════════════════════════════════════════════════════════
   PREMIUM 2026 JS OPTIMIZATIONS
   ═══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';
  
  // LAZY LOAD images with IntersectionObserver
  if ('IntersectionObserver' in window) {
    var lazyImages = [].slice.call(document.querySelectorAll('img[loading="lazy"]'));
    var lazyObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          lazyObserver.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
    
    lazyImages.forEach(function(img) {
      lazyObserver.observe(img);
    });
  }
  
  // 8. VIEW TRANSITIONS API removed — breaks analytics and Safari
  
  // 9. NETWORK INFORMATION API removed — conflicts with prefers-reduced-motion
  
  // 10. Font loading stays declarative in <head>. Do not force document.fonts.load()
  // or append late preconnects here: display=optional and the static connection hints
  // own initial font network policy without duplicate VeryHigh work.
  
})();


/* ═══════════════════════════════════════════════════════════════════════
   RUNNING VIDEO STRIP — «Наши работы в движении» (r07)
   Builds tiles from #mcVideoStrip[data-videos]. Posters by default;
   real <video> lazy-loads & plays only on the hovered/tapped tile.
   ES5, no deps, isolated IIFE. Reads data from inline JSON (mirrors gallery/data.js).
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var strip = document.getElementById('mcVideoStrip');
  var track = document.getElementById('mcVideoTrack');
  if (!strip || !track) return;
  // Native anchors are not valid ARIA listitems. The strip is a visual marquee,
  // not a semantic list; keep its links native and let each caption name the link.
  strip.removeAttribute('role');

  var items;
  try { items = JSON.parse(strip.getAttribute('data-videos') || '[]'); }
  catch (e) { items = []; }
  if (!Array.isArray(items)) return;
  items = items.filter(function(it) { return it && typeof it.t === 'string' && typeof it.p === 'string' && typeof it.v === 'string'; });
  if (!items.length) return;

  var PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var activeTile = null;

  function clearMagnet(tile){
    if (!tile) return;
    tile.classList.remove('is-magnet', 'is-playing');
    var v = tile.querySelector('video');
    if (v) { try { v.pause(); } catch (e) {} }
    if (!track.querySelector('.is-magnet')) track.classList.remove('has-magnet');
  }

  function setMagnet(tile, it){
    if (activeTile && activeTile !== tile) clearMagnet(activeTile);
    activeTile = tile;
    track.classList.add('has-magnet');
    tile.classList.add('is-magnet');
    var v = tile.querySelector('video');
    if (!v) {
      v = document.createElement('video');
      v.src = it.v;
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted',''); v.setAttribute('playsinline','');
      v.preload = 'auto'; v.tabIndex = -1; v.setAttribute('aria-hidden','true');
      tile.appendChild(v);
    }
    var p = v.play();
    if (p && p.then) p.then(function(){ tile.classList.add('is-playing'); }).catch(function(){});
    else tile.classList.add('is-playing');
  }

  /* [UI-2026-11-16 r25] Безрамочный «резиновый» просмотр работы.
     Тап по плитке → видео упруго раскрывается из её прямоугольника на весь
     экран (без рамки, скруглений и подписей-панелей). Второй тап по кадру —
     переход в галерею. Свайп ←/→ — соседняя работа, свайп ↓ или Esc — закрыть. */
  var CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>';
  var ARROW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12.2l-4.6-4.6L14 6l7 6-7 6-1.4-1.4 4.6-4.6H5z"/></svg>';
  var MUTE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.6h3.2L12 5.6v12.8L7.2 14.4H4z"/><path d="M16.4 8.6a4.6 4.6 0 0 1 0 6.8"/></svg>';
  var SOUND_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.6h3.2L12 5.6v12.8L7.2 14.4H4z"/><path d="M16.4 8.6a4.6 4.6 0 0 1 0 6.8"/><path d="M19 6.2a8 8 0 0 1 0 11.6"/></svg>';

  var viewEl = null, viewOpener = null, viewVideo = null, viewCap = null, viewIndex = 0;
  var viewBusy = false, viewSoundBtn = null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function galleryHref(){ return '/gallery/'; }

  function currentItem(){ return items[viewIndex % items.length]; }

  function playCurrent(){
    if (!viewVideo) return;
    var it = currentItem();
    viewVideo.poster = it.p || '';
    viewVideo.src = it.v;
    if (viewCap) viewCap.textContent = it.t;
    var pr = viewVideo.play();
    if (pr && pr.catch) pr.catch(function(){});
    if (viewEl) viewEl.setAttribute('aria-label', it.t);
  }

  function setViewTransform(from){
    if (!viewVideo) return;
    if (!from) { viewVideo.style.transform = 'none'; viewVideo.style.opacity = '1'; return; }
    var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    var sx = Math.max(from.width / vw, 0.02), sy = Math.max(from.height / vh, 0.02);
    viewVideo.style.transform = 'translate(' + from.left + 'px,' + from.top + 'px) scale(' + sx + ',' + sy + ')';
    viewVideo.style.opacity = '0.55';
  }

  function openView(it, opener){
    closeView(true);
    viewIndex = Math.max(0, items.indexOf(it));
    viewOpener = opener || null;

    var ov = document.createElement('div');
    ov.className = 'vview';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', it.t);
    ov.innerHTML =
      '<video class="vview-video" muted loop playsinline preload="auto" aria-hidden="true"></video>' +
      '<div class="vview-top">' +
        '<div class="vview-cap"></div>' +
        '<div class="vview-actions">' +
          '<button class="vview-btn vview-sound" type="button" aria-label="Включить звук" aria-pressed="false">' + SOUND_SVG + '</button>' +
          '<button class="vview-btn vview-close" type="button" aria-label="Закрыть видео">' + CLOSE_SVG + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="vview-hint"><span>Нажмите кадр — вся галерея</span>' + ARROW_SVG + '</div>';

    document.body.appendChild(ov);
    document.body.classList.add('vview-open');
    viewEl = ov;
    viewVideo = ov.querySelector('.vview-video');
    viewCap = ov.querySelector('.vview-cap');
    viewSoundBtn = ov.querySelector('.vview-sound');

    // FLIP: стартуем ровно с прямоугольника плитки и упруго раскрываемся.
    var from = opener && opener.getBoundingClientRect ? opener.getBoundingClientRect() : null;
    if (from && !reduceMotion) {
      setViewTransform(from);
      playCurrent();
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          if (!viewVideo) return;
          viewVideo.style.transition = 'transform .66s cubic-bezier(.2,1.28,.3,1), opacity .34s ease';
          setViewTransform(null);
        });
      });
      setTimeout(function(){ if (viewEl) viewEl.classList.add('is-ready'); }, 220);
    } else {
      playCurrent();
      viewEl.classList.add('is-ready');
    }

    ov.querySelector('.vview-close').addEventListener('click', function(e){ e.stopPropagation(); closeView(); });

    if (viewSoundBtn) {
      viewSoundBtn.addEventListener('click', function(e){
        e.stopPropagation();
        viewVideo.muted = !viewVideo.muted;
        viewSoundBtn.innerHTML = viewVideo.muted ? SOUND_SVG : MUTE_SVG;
        viewSoundBtn.setAttribute('aria-pressed', viewVideo.muted ? 'false' : 'true');
        viewSoundBtn.setAttribute('aria-label', viewVideo.muted ? 'Включить звук' : 'Выключить звук');
        if (!viewVideo.muted) { var pr = viewVideo.play(); if (pr && pr.catch) pr.catch(function(){}); }
      });
    }

    // Второй тап по кадру — галерея. Перетаскивание мышью/пальцем клик не
    // засчитывает: сравниваем точку нажатия и отпускания.
    var downX = 0, downY = 0;
    ov.addEventListener('pointerdown', function(e){ downX = e.clientX; downY = e.clientY; }, { passive: true });
    ov.addEventListener('click', function(e){
      if (viewBusy) return;
      if (e.target && e.target.closest && e.target.closest('.vview-btn')) return;
      if (Math.abs(e.clientX - downX) > 14 || Math.abs(e.clientY - downY) > 14) return;
      window.location.href = galleryHref();
    });

    bindViewGestures(ov);

    var closeBtn = ov.querySelector('.vview-close');
    if (closeBtn && closeBtn.focus) { try { closeBtn.focus({ preventScroll: true }); } catch (err) {} }
  }

  function bindViewGestures(ov){
    var sx = 0, sy = 0, dx = 0, dy = 0, active = false, horizontal = false;

    ov.addEventListener('touchstart', function(e){
      if (e.touches.length !== 1) return;
      active = true; horizontal = false;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; dy = 0;
    }, { passive: true });

    ov.addEventListener('touchmove', function(e){
      if (!active || e.touches.length !== 1) return;
      dx = e.touches[0].clientX - sx;
      dy = e.touches[0].clientY - sy;
      if (!horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) horizontal = true;
      if (horizontal && viewVideo) {
        if (e.cancelable) e.preventDefault();
        viewVideo.style.transition = 'none';
        viewVideo.style.transform = 'translateX(' + (dx * 0.42) + 'px)';
      } else if (!horizontal && dy > 0 && dy > 12 && viewVideo) {
        if (e.cancelable) e.preventDefault();
        viewVideo.style.transition = 'none';
        viewVideo.style.transform = 'translateY(' + (dy * 0.5) + 'px) scale(' + (1 - Math.min(dy, 260) / 1600) + ')';
        viewVideo.style.opacity = String(Math.max(0.35, 1 - dy / 520));
        if (viewEl) viewEl.style.background = 'rgba(11,7,3,' + Math.max(0.1, 1 - dy / 420) + ')';
      }
    }, { passive: false });

    function endGesture(){
      if (!active) return;
      active = false;
      if (horizontal) {
        horizontal = false;
        var dir = dx < 0 ? 1 : -1;   // фиксируем направление до сброса dx
        if (Math.abs(dx) > 48 && !viewBusy) {
          if (viewVideo) { viewVideo.style.transition = 'transform .22s ease, opacity .22s ease'; viewVideo.style.transform = 'translateX(' + (dir > 0 ? -1 : 1) * window.innerWidth * 0.55 + 'px)'; viewVideo.style.opacity = '0'; }
          viewBusy = true;
          setTimeout(function(){
            viewIndex = (viewIndex + dir + items.length) % items.length;
            if (viewVideo) { viewVideo.style.transition = 'none'; viewVideo.style.transform = 'translateX(' + (dir > 0 ? 34 : -34) + 'px)'; viewVideo.style.opacity = '0'; }
            playCurrent();
            requestAnimationFrame(function(){
              requestAnimationFrame(function(){
                if (!viewVideo) { viewBusy = false; return; }
                viewVideo.style.transition = 'transform .34s cubic-bezier(.2,1.1,.3,1), opacity .3s ease';
                viewVideo.style.transform = 'none'; viewVideo.style.opacity = '1';
                viewBusy = false;
              });
            });
          }, 200);
        } else if (viewVideo) {
          viewVideo.style.transition = 'transform .32s cubic-bezier(.2,1.3,.3,1)';
          viewVideo.style.transform = 'none';
        }
      } else if (dy > 90) {
        closeView();
      } else if (viewVideo) {
        viewVideo.style.transition = 'transform .32s cubic-bezier(.2,1.3,.3,1), opacity .3s ease';
        viewVideo.style.transform = 'none';
        viewVideo.style.opacity = '1';
        if (viewEl) viewEl.style.background = '';
      }
      dx = 0; dy = 0;
    }
    ov.addEventListener('touchend', endGesture, { passive: true });
    ov.addEventListener('touchcancel', endGesture, { passive: true });
  }

  function closeView(instant){
    if (!viewEl) return;
    var ov = viewEl;
    var v = ov.querySelector('video');
    if (v) { try { v.pause(); } catch (e) {} }
    document.body.classList.remove('vview-open');
    viewEl = null; viewVideo = null; viewCap = null; viewSoundBtn = null;
    var done = function(){
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (viewOpener && viewOpener.focus) { try { viewOpener.focus({ preventScroll: true }); } catch (e) {} }
      viewOpener = null;
    };
    var from = viewOpener && viewOpener.getBoundingClientRect ? viewOpener.getBoundingClientRect() : null;
    if (instant || reduceMotion || !v || !from || !from.width) { done(); return; }
    v.style.transition = 'transform .42s cubic-bezier(.4,0,.7,.2), opacity .3s ease';
    v.style.transformOrigin = 'top left';
    var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    v.style.transform = 'translate(' + from.left + 'px,' + from.top + 'px) scale(' + (from.width / vw) + ',' + (from.height / vh) + ')';
    v.style.opacity = '0.4';
    if (ov.classList) ov.classList.remove('is-ready');
    setTimeout(done, 380);
  }

  document.addEventListener('keydown', function(e){
    if (!viewEl) return;
    if (e.key === 'Escape' || e.keyCode === 27) { closeView(); }
    else if (e.key === 'ArrowRight') { viewIndex = (viewIndex + 1) % items.length; playCurrent(); }
    else if (e.key === 'ArrowLeft') { viewIndex = (viewIndex - 1 + items.length) % items.length; playCurrent(); }
  });

  function makeTile(it){
    var d = document.createElement('a');
    d.className = 'vtile';
    d.href = it.v;
    d.setAttribute('aria-label', it.t + ' — смотреть видео');

    var img = document.createElement('img');
    /* [r38] Постер не запрашивается, пока лента далеко от вьюпорта.
       Нативный `loading="lazy"` в Chrome тянет картинку за ~1250 px до экрана,
       и здесь это давало 90+ KB на первом экране главной (полоса начинается на
       2246–3185 px). Атрибут остаётся для браузеров без IntersectionObserver,
       а адрес переезжает в data-poster и подставляется наблюдателем. */
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    if ('IntersectionObserver' in window) img.setAttribute('data-poster', it.p);
    else img.src = it.p;
    d.appendChild(img);

    var play = document.createElement('span');
    play.className = 'vtile-play'; play.innerHTML = PLAY_SVG;
    d.appendChild(play);

    var cap = document.createElement('div');
    cap.className = 'vtile-cap'; cap.textContent = it.t;
    d.appendChild(cap);

    if (canHover) {
      d.addEventListener('mouseenter', function(){ setMagnet(d, it); });
      d.addEventListener('mouseleave', function(){ clearMagnet(d); activeTile = null; });
    }
    // [UI-2026-11-16 #6] Click/tap plays the full video inline (no navigation).
    // Modified clicks (ctrl/cmd/shift/middle) keep native behaviour.
    d.addEventListener('click', function(e){
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (typeof e.button === 'number' && e.button > 0)) return;
      e.preventDefault();
      clearMagnet(d);
      openView(it, d);
    });
    return d;
  }

  // ×2 for seamless marquee
  var frag = document.createDocumentFragment();
  var i;
  for (i = 0; i < items.length; i++) frag.appendChild(makeTile(items[i]));
  for (i = 0; i < items.length; i++) frag.appendChild(makeTile(items[i]));
  track.appendChild(frag);

  /* [r38] Постеры подгружаются, когда плитка подходит к экрану (запас 300 px,
     чтобы к моменту показа картинка уже была). Разметка плиток от этого не
     меняется: <img> в каждой плитке на месте с самого начала. */
  if ('IntersectionObserver' in window) {
    var posterObserver = new IntersectionObserver(function(entries){
      for (var n = 0; n < entries.length; n++) {
        var entry = entries[n];
        if (!entry.isIntersecting) continue;
        var poster = entry.target.getAttribute('data-poster');
        if (poster) entry.target.setAttribute('src', poster);
        entry.target.removeAttribute('data-poster');
        posterObserver.unobserve(entry.target);
      }
    }, { rootMargin: '300px 0px' });
    var deferred = track.querySelectorAll('img[data-poster]');
    for (i = 0; i < deferred.length; i++) posterObserver.observe(deferred[i]);
  }

  // [UI-2026-11-16 #6] Side slide-in chip — the stylish way to the gallery.
  // Lives on the section (outside the strip mask); slides in from the right
  // on hover/focus, always visible for touch pointers.
  if (strip.parentNode) {
    var galChip = document.createElement('a');
    galChip.className = 'vstrip-galchip';
    galChip.href = '/gallery/';
    galChip.innerHTML = '<span>Вся галерея</span>' + ARROW_SVG;
    galChip.setAttribute('aria-label', 'Открыть галерею работ');
    strip.parentNode.appendChild(galChip);
  }

  // Pause the marquee animation when the strip is off-screen (battery/perf)
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        track.style.animationPlayState = en.isIntersecting ? '' : 'paused';
        if (!en.isIntersecting && activeTile) { clearMagnet(activeTile); activeTile = null; }
      });
    }, { threshold: 0 });
    io.observe(strip);
  }
})();

/* ═══════════════════════════════════════════════════════════════════════
   CONSOLIDATED UI POLISH — migrated from retired ui-polish-r3.js.
   Privacy default ownership now lives in consent-analytics.js; this block
   retains only UX/accessibility behavior that belongs in the premium layer.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  ready(function () {
    var topButton = document.getElementById('backToTop');
    var runId = 0;
    if (topButton) {
      topButton.removeAttribute('onclick');
      topButton.addEventListener('click', function (event) {
        event.preventDefault();
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
          window.scrollTo(0, 0);
          return;
        }
        var start = window.scrollY || document.documentElement.scrollTop || 0;
        var started = performance.now();
        var duration = Math.min(720, Math.max(360, start * 0.09));
        // [r30] Один прогон за раз: повторный клик или ручная прокрутка
        // отменяют предыдущий кадр-цикл, иначе два requestAnimationFrame
        // борются за scrollY и картинка дёргается.
        runId += 1;
        var myRun = runId;
        function stopRun() { runId += 1; }
        window.addEventListener('wheel', stopRun, { passive: true, once: true });
        window.addEventListener('touchstart', stopRun, { passive: true, once: true });
        function frame(now) {
          if (myRun !== runId) return;
          var progress = Math.min((now - started) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 4);
          window.scrollTo(0, Math.round(start * (1 - eased)));
          if (progress < 1) requestAnimationFrame(frame);
          else window.scrollTo(0, 0);
        }
        requestAnimationFrame(frame);
      });

      var footer = document.querySelector('.site-footer');
      if (footer && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          topButton.classList.toggle('footer-clearance', entries[0].isIntersecting);
        }, { threshold: 0.03 }).observe(footer);
      }
    }

    // The catalog buttons already expose their visible short name + price.
    // A prefixed aria-label made the accessible name disagree with visible text.
    var catalogNavItems = document.querySelectorAll('.catalog-nav-item[aria-label]');
    for (var c = 0; c < catalogNavItems.length; c++) {
      catalogNavItems[c].removeAttribute('aria-label');
    }

    var yandexTab = document.getElementById('tabYandex');
    var googleTab = document.getElementById('tabGoogle');
    if (yandexTab && !yandexTab.getAttribute('aria-label')) yandexTab.setAttribute('aria-label', 'Отзывы на Яндекс Картах');
    if (googleTab && !googleTab.getAttribute('aria-label')) googleTab.setAttribute('aria-label', 'Отзывы на Google Картах');

    var weight = document.getElementById('calcWeight');
    if (weight && !weight.getAttribute('aria-label')) weight.setAttribute('aria-label', 'Вес торта в килограммах');
  });
})();
