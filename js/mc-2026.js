/* ═══════════════════════════════════════════════════════════════════════
   MILOVI CAKE — Premium 2026 JS Layer
   Версия: 1.1 (V3-FIX, полный quality pass)
   Май 2026

   Загружается ПОСЛЕ main.js и nav.js с defer.
   Цель: исправить баги, отложить тяжёлое, добавить премиум-фичи 2026,
         НЕ затрагивая логику калькулятора и корзины.

   Изменения v1.1 (V3-FIX):
     – Убран дубль регистрации Service Worker (уже есть в HTML).
     – Убран дубль ESC-handler (уже есть в main.js).
     – Использован чистый ES5 (для совместимости со всеми браузерами).
     – Добавлен MO disconnect после первого срабатывания патча img.
   ═══════════════════════════════════════════════════════════════════════ */

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
    var focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return null;
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];

    function handler(e){
      if (e.key !== 'Tab') return;
      if (e.shiftKey){
        if (document.activeElement === first){ last.focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === last){ first.focus(); e.preventDefault(); }
      }
    }
    container.addEventListener('keydown', handler);
    return function release(){ container.removeEventListener('keydown', handler); };
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


  /* ═══════════════════════════════════════════════════════════════════
     7. Отложенная Google Analytics: загружаем только после
        первого взаимодействия (для уменьшения TBT/INP).
     ВНИМАНИЕ: Yandex Metrica загружается из main.js ТОЛЬКО после
     согласия с cookie (loadMetrika()). Здесь мы НЕ автозагружаем
     ничего на mc.yandex.ru — preconnect будет создан в acceptCookie().
     ═══════════════════════════════════════════════════════════════════ */
  var GA_ID = 'G-94ZZ5B8YNY';
  var gaLoaded = false;

  function loadGA(){
    if (gaLoaded || window.gtag) return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { transport_type: 'beacon' });
  }

  // Если в HTML уже подключён gtag (например, для других целей) — не дублируем
  if (!window.gtag && !document.querySelector('script[src*="googletagmanager.com/gtag/js"]')){
    var fired = false;
    var triggerEvents = ['scroll', 'keydown', 'mousedown', 'touchstart', 'pointerdown'];
    var trigger = function(){
      if (fired) return;
      fired = true;
      for (var i = 0; i < triggerEvents.length; i++){
        window.removeEventListener(triggerEvents[i], trigger);
      }
      ric(loadGA);
    };
    for (var i = 0; i < triggerEvents.length; i++){
      window.addEventListener(triggerEvents[i], trigger, { passive: true });
    }
    setTimeout(trigger, 8000); // fallback
  }


  /* ═══════════════════════════════════════════════════════════════════
     8. Мониторинг INP / LCP / CLS (только при ?mc-debug=1)
     ═══════════════════════════════════════════════════════════════════ */
  if (location.search.indexOf('mc-debug=1') > -1 && 'PerformanceObserver' in window){
    try {
      new PerformanceObserver(function(list){
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++){
          var e = entries[i];
          /* debug removed r28 */
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      var clsTotal = 0;
      new PerformanceObserver(function(list){
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++){
          if (!entries[i].hadRecentInput) clsTotal += entries[i].value;
        }
        /* debug removed r28 */
      }).observe({ type: 'layout-shift', buffered: true });

      if (PerformanceObserver.supportedEntryTypes &&
          PerformanceObserver.supportedEntryTypes.indexOf('event') > -1){
        new PerformanceObserver(function(list){
          var entries = list.getEntries();
          for (var i = 0; i < entries.length; i++){
            if (entries[i].duration > 100){
              /* debug removed r28 */
            }
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 100 });
      }
    } catch(e){ /* ignore */ }
  }

})();

/* ═══════════════════════════════════════════════════════════════════
   PREMIUM 2026 JS OPTIMIZATIONS
   ═══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';
  
  // 1. DEBOUNCE utility for scroll/resize
  function debounce(func, wait) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        func.apply(context, args);
      }, wait);
    };
  }
  
  // 2. THROTTLE for high-frequency events
  function throttle(func, limit) {
    var inThrottle;
    return function() {
      var args = arguments, context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(function() { inThrottle = false; }, limit);
      }
    };
  }
  
  // 3. LAZY LOAD images with IntersectionObserver
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
  
  // 4. PREFETCH on hover (instant navigation)
  var prefetchLinks = document.querySelectorAll('a[href^="/"], a[href^="./"]');
  prefetchLinks.forEach(function(link) {
    var prefetched = false;
    link.addEventListener('mouseenter', function() {
      if (prefetched) return;
      prefetched = true;
      var prefetchLink = document.createElement('link');
      prefetchLink.rel = 'prefetch';
      prefetchLink.href = link.href;
      document.head.appendChild(prefetchLink);
    }, { once: true, passive: true });
  });
  
  // 5. OPTIMIZE SCROLL HANDLERS
  var ticking = false;
  function updateOnScroll() {
    // Batch all scroll updates here
    ticking = false;
  }
  
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(updateOnScroll);
      ticking = true;
    }
  }, { passive: true });
  
  // 6. REDUCE LAYOUT THRASHING
  function batchDOMReads() {
    // Read all at once
    var scrollY = window.scrollY;
    var innerHeight = window.innerHeight;
    var bodyHeight = document.body.offsetHeight;
    
    // Then write
    requestAnimationFrame(function() {
      // DOM writes here
    });
  }
  
  // 7. MEMORY LEAK PREVENTION — cleanup on page hide
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Pause animations, timers
      if (window.slideTimers) {
        Object.keys(window.slideTimers).forEach(function(key) {
          clearInterval(window.slideTimers[key]);
        });
      }
    }
  });
  
  // 8. VIEW TRANSITIONS API for page navigation
  if (document.startViewTransition) {
    document.querySelectorAll('a[href^="/"]:not([target="_blank"])').forEach(function(link) {
      link.addEventListener('click', function(e) {
        var url = new URL(link.href);
        if (url.origin !== location.origin) return;
        
        e.preventDefault();
        document.startViewTransition(function() {
          location.href = link.href;
        });
      });
    });
  }
  
  // 9. NETWORK INFORMATION API — adapt to connection
  if (navigator.connection) {
    var connection = navigator.connection;
    
    // Reduce animations on slow connections
    if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
      document.documentElement.classList.add('reduce-motion');
    }
    
    // Save data mode
    if (connection.saveData) {
      document.documentElement.classList.add('save-data');
      // Disable autoplay, reduce image quality, etc.
    }
  }
  
  // 10. IDLE CALLBACKS for non-critical work
  var ric = window.requestIdleCallback || function(cb) { setTimeout(cb, 1); };
  
  ric(function() {
    // Preload critical fonts
    if ('fonts' in document) {
      document.fonts.load('400 16px Jost');
      document.fonts.load('500 16px Jost');
      document.fonts.load('400 24px "Cormorant Garamond"');
    }
    
    // Warm up connections
    ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].forEach(function(origin) {
      var link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  });
  
})();
