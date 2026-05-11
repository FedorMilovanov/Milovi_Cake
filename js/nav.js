/**
 * Milovi Cake — Smart Mobile Navigation
 * Универсальный модуль для всех страниц
 * Определяет текущую страницу и показывает нужные пункты меню
 */
(function() {
  'use strict';

  // ── Определить текущую страницу ──
  var path = window.location.pathname;
  var PAGE = 'main';
  if (path.indexOf('/meringue-roll') !== -1) PAGE = 'meringue';
  else if (path.indexOf('/prigorody/') !== -1 && path.split('/').filter(Boolean).length > 1) PAGE = 'prigorod';
  else if (path.indexOf('/prigorody') !== -1) PAGE = 'prigorody-list';

  // ── Данные навигации ──
  var NAV = {
    // Глобальные переходы между страницами
    global: [
      {
        id: 'to-main',
        label: 'Главная',
        sublabel: 'Торты на заказ',
        href: '/',
        icon: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        pages: ['meringue', 'prigorod', 'prigorody-list'],
      },
      {
        id: 'to-meringue',
        label: 'Меренговый рулет',
        sublabel: '2 500 ₽ · 1 100 г',
        href: '/meringue-roll/',
        icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12h8M12 8v8"/>',
        pages: ['main', 'prigorod', 'prigorody-list'],
      },
      {
        id: 'to-prigorody',
        label: 'Доставка в пригороды',
        sublabel: 'Пушкин, Петергоф, Гатчина…',
        href: '/prigorody/',
        icon: '<circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.25 8 13 8 13s8-7.75 8-13a8 8 0 00-8-8z"/>',
        pages: ['main', 'meringue'],
      },
    ],

    // Якоря внутри страниц
    anchors: {
      main: [
        { label: 'Каталог', href: '#catalog', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', section: 'catalog' },
        { label: 'Начинки', href: '#fillings', icon: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>', section: 'fillings' },
        { label: 'Отзывы', href: '#reviews', icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>', section: 'reviews' },
        { label: 'Контакты', href: '#contacts', icon: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.07 2.18 2 2 0 012.03 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>', section: 'contacts' },
      ],
      meringue: [
        { label: 'Состав', href: '#composition', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
        { label: 'Фото', href: '#gallery', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
        { label: 'Отзывы', href: '#reviews', icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>' },
        { label: 'Заказать', href: '#order', icon: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.07 2.18 2 2 0 012.03 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>' },
      ],
      prigorod: [
        { label: 'Каталог', href: '#catalog', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', section: 'catalog' },
        { label: 'Начинки', href: '#fillings', icon: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>', section: 'fillings' },
        { label: 'Отзывы', href: '#reviews', icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>', section: 'reviews' },
        { label: 'Контакты', href: '#contacts', icon: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.07 2.18 2 2 0 012.03 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>', section: 'contacts' },
      ],
      'prigorody-list': [
        { label: 'Наверх', href: '#home', icon: '<polyline points="18 15 12 9 6 15"/>' },
      ],
    },
  };

  // ── SVG хелпер ──
  function icon(paths, size) {
    size = size || 22;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }

  // ── Создать панель навигации ──
  function buildNav() {
    // [N-2 FIXED] Guard against duplicate nav on HMR / repeated calls
    if (document.getElementById('mcNav')) {
      document.getElementById('mcNav').remove();
      var oldBackdrop = document.getElementById('mcBackdrop');
      if (oldBackdrop) oldBackdrop.remove();
      var oldSheet = document.getElementById('mcSheet');
      if (oldSheet) oldSheet.remove();
    }

    // Удаляем старый bottom-nav если есть
    var old = document.getElementById('bottomNav');
        if (old) old.style.display = 'none';
        var old2 = document.getElementById('mrBottomNav');
        if (old2) old2.style.display = 'none';

    // CSS
    var style = document.createElement('style');
    style.textContent = [
      /* ── Основной nav-bar ── */
      '.mc-nav{',
        'display:none;',
      '}',
      '@media(max-width:768px){',
        '.mc-nav{',
          'display:flex;',
          'position:fixed;bottom:0;left:0;right:0;',
          'z-index:105;',
          'height:calc(60px + env(safe-area-inset-bottom));',
          'padding-bottom:env(safe-area-inset-bottom);',
          'background:rgba(253,251,247,0.99);',
          'border-top:1px solid rgba(201,147,74,0.13);',
          'box-shadow:0 -2px 20px rgba(61,43,31,0.07);',
          'align-items:stretch;',
          'transition:transform 0.28s cubic-bezier(.4,0,.2,1);',
        '}',
        '.mc-nav.mc-nav--hidden{transform:translateY(100%);}',

        /* Кнопки в баре */
        '.mc-btn{',
          'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;',
          'gap:3px;padding:6px 4px 4px;',
          'background:none;border:none;cursor:pointer;',
          'color:rgba(154,122,98,0.65);',
          'font-size:9.5px;font-weight:500;letter-spacing:0.03em;',
          'font-family:Jost,sans-serif;',
          'text-decoration:none;',
          '-webkit-tap-highlight-color:transparent;',
          'touch-action:manipulation;',
          'transition:color 0.15s,transform 0.12s;',
          'position:relative;',
          'min-height:60px;',
        '}',
        '.mc-btn:active{transform:scale(0.9);}',
        '.mc-btn.mc-active{color:var(--gold,#c9934a);}',
        '.mc-btn.mc-active::before{',
          'content:"";position:absolute;top:0;left:50%;',
          'transform:translateX(-50%);',
          'width:28px;height:2.5px;',
          'background:var(--gold,#c9934a);',
          'border-radius:0 0 3px 3px;',
        '}',
        '.mc-btn svg{transition:color 0.15s;}',
        '.mc-btn.mc-active svg{color:var(--gold,#c9934a);}',
        '.mc-btn-label{font-size:9.5px;line-height:1;white-space:nowrap;}',

        /* Центральная кнопка заказать */
        '.mc-btn--order{color:var(--gold,#c9934a);}',
        '.mc-btn--order .mc-btn-circle{',
          'width:46px;height:46px;',
          'background:linear-gradient(135deg,#c9934a,#d4a76a);',
          'border-radius:50%;',
          'display:flex;align-items:center;justify-content:center;',
          'box-shadow:0 4px 14px rgba(201,147,74,0.4);',
          'margin-top:-12px;margin-bottom:2px;',
          'transition:transform 0.12s,box-shadow 0.12s;',
        '}',
        '.mc-btn--order:active .mc-btn-circle{transform:scale(0.88);box-shadow:0 2px 8px rgba(201,147,74,0.3);}',
        '.mc-btn--order svg{color:#fff;width:21px;height:21px;}',
        '.mc-btn--order::before{display:none!important;}',

        /* Разделитель */
        '.mc-sep{width:1px;background:rgba(201,147,74,0.1);margin:14px 0;flex-shrink:0;}',

        /* ── SLIDE-UP ПАНЕЛЬ ── */
        '.mc-sheet-backdrop{',
          'position:fixed;inset:0;z-index:295;', /* [N-3 FIXED] Was 290 = same as --z-overlay; raised to 295 so overlay-level elements don't bleed through */
          'background:rgba(44,26,16,0);',
          'transition:background 0.3s ease;',
          '-webkit-tap-highlight-color:transparent;',
          'pointer-events:none;',
        '}',
        '.mc-sheet-backdrop.mc-open{',
          'pointer-events:auto;',
          'background:rgba(44,26,16,0.45);',
        '}',
        '.mc-sheet{',
          'position:fixed;',
          'bottom:calc(60px + env(safe-area-inset-bottom));',
          'left:0;right:0;z-index:300;',
          'background:#fdfbf7;',
          'border-radius:20px 20px 0 0;',
          'border-top:1px solid rgba(201,147,74,0.15);',
          'border-left:1px solid rgba(201,147,74,0.08);',
          'border-right:1px solid rgba(201,147,74,0.08);',
          'box-shadow:0 -8px 40px rgba(61,43,31,0.14);',
          'transform:translateY(100%);',
          'transition:transform 0.38s cubic-bezier(0.32,0.72,0,1);',
          'will-change:transform;',
          'overflow:hidden;',
        '}',
        '.mc-sheet.mc-open{transform:translateY(0);}',

        /* Ручка */
        '.mc-sheet-handle{',
          'width:36px;height:4px;',
          'background:rgba(201,147,74,0.2);',
          'border-radius:2px;',
          'margin:12px auto 0;',
        '}',

        /* Заголовок панели */
        '.mc-sheet-head{',
          'display:flex;align-items:center;justify-content:space-between;',
          'padding:12px 20px 10px;',
        '}',
        '.mc-sheet-title{',
          'font-size:11px;letter-spacing:0.14em;',
          'text-transform:uppercase;color:rgba(154,122,98,0.6);',
          'font-family:Jost,sans-serif;font-weight:500;',
        '}',
        '.mc-sheet-close{',
          'width:28px;height:28px;',
          'border-radius:50%;border:none;',
          'background:rgba(201,147,74,0.08);',
          'color:rgba(154,122,98,0.7);',
          'display:flex;align-items:center;justify-content:center;',
          'cursor:pointer;',
          '-webkit-tap-highlight-color:transparent;',
          'font-size:16px;line-height:1;',
        '}',

        /* Секция в панели */
        '.mc-section{padding:0 12px 12px;}',
        '.mc-section-label{',
          'font-size:9px;letter-spacing:0.18em;text-transform:uppercase;',
          'color:rgba(154,122,98,0.4);',
          'font-family:Jost,sans-serif;',
          'padding:0 8px;margin-bottom:4px;',
        '}',

        /* Строка-ссылка в панели */
        '.mc-row{',
          'display:flex;align-items:center;gap:14px;',
          'padding:13px 16px;',
          'border-radius:14px;',
          'text-decoration:none;',
          'color:var(--text,#2c1a10);',
          'font-family:Jost,sans-serif;',
          '-webkit-tap-highlight-color:transparent;',
          'transition:background 0.15s;',
          'cursor:pointer;',
          'background:none;border:none;width:100%;text-align:left;',
        '}',
        '.mc-row:active{background:rgba(201,147,74,0.08);}',
        '.mc-row-icon{',
          'width:38px;height:38px;border-radius:11px;',
          'background:rgba(201,147,74,0.09);',
          'display:flex;align-items:center;justify-content:center;',
          'flex-shrink:0;',
          'color:rgba(201,147,74,0.7);',
        '}',
        '.mc-row-icon svg{width:18px;height:18px;}',
        '.mc-row-text{flex:1;min-width:0;}',
        '.mc-row-name{',
          'font-size:14px;font-weight:500;',
          'color:#2c1a10;',
          'line-height:1.2;',
        '}',
        '.mc-row-sub{',
          'font-size:11px;color:rgba(154,122,98,0.7);',
          'margin-top:1px;',
        '}',
        '.mc-row-arrow{',
          'color:rgba(201,147,74,0.35);',
          'flex-shrink:0;',
        '}',
        /* Активная строка (текущая страница) */
        '.mc-row--current .mc-row-icon{background:rgba(201,147,74,0.15);color:var(--gold,#c9934a);}',
        '.mc-row--current .mc-row-name{color:var(--gold,#c9934a);}',
        '.mc-row--current .mc-row-arrow{opacity:0;}',

        /* Divider внутри панели */
        '.mc-sheet-divider{height:1px;background:rgba(201,147,74,0.08);margin:4px 16px;}',

        /* Нижняя безопасная зона панели */
        '.mc-sheet-safe{height:env(safe-area-inset-bottom,0px);}',
      '}', /* end @media */
    ].join('');
    document.head.appendChild(style);

    // ── Определить пункты нижнего бара ──
    var anchors = NAV.anchors[PAGE] || [];
    // Показываем макс 3 якоря + кнопку "Ещё" (или "Заказать" как центральную)
    var barItems = anchors.slice(0, 3);

    // ── Построить nav bar ──
    var nav = document.createElement('nav');
    nav.id = 'mcNav';
    nav.className = 'mc-nav';
    nav.setAttribute('aria-label', 'Навигация');

    // Пункты якорей
    barItems.forEach(function(item) {
      var el;
      el = document.createElement('a');
      el.href = item.href;
      el.className = 'mc-btn' + (item.section === 'home' ? ' mc-active' : '');
      el.setAttribute('data-section', item.section || '');
      el.setAttribute('aria-label', item.label);
      el.innerHTML = icon(item.icon) + '<span class="mc-btn-label">' + item.label + '</span>';
      el.addEventListener('click', function(e) {
        if (item.href.startsWith('#')) {
          e.preventDefault();
          var target = document.querySelector(item.href);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
      });
      nav.appendChild(el);
    });

    // Разделитель перед центральной кнопкой
    if (barItems.length > 0) {
      nav.appendChild(Object.assign(document.createElement('div'), { className: 'mc-sep' }));
    }

    // Центральная кнопка — заказать (WA) или открыть корзину
    var orderBtn = document.createElement('button');
    orderBtn.className = 'mc-btn mc-btn--order';
    orderBtn.setAttribute('aria-label', 'Заказать');
    orderBtn.innerHTML = '<div class="mc-btn-circle">' +
      icon('<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>', 22) +
      '</div><span class="mc-btn-label">Заказать</span>';
    if (typeof openCart === 'function') {
      orderBtn.addEventListener('click', function() {
        // [N-1 FIXED] If the sheet is open when user taps "Заказать", calling openCart()
        // immediately creates two simultaneous overlays + double lockBody() → scroll freeze.
        // Close sheet first, then open cart after animation completes.
        if (isOpen) {
          closeSheet();
          setTimeout(function() { openCart(); }, 320);
        } else {
          openCart();
        }
      });
    } else {
      orderBtn.addEventListener('click', function() {
        window.location.href = 'https://wa.me/79119038886?text=Здравствуйте! Хочу сделать заказ';
      });
    }
    nav.appendChild(orderBtn);

    nav.appendChild(Object.assign(document.createElement('div'), { className: 'mc-sep' }));

    // Кнопка "Ещё" — открывает панель
    var moreBtn = document.createElement('button');
    moreBtn.className = 'mc-btn';
    moreBtn.id = 'mcMoreBtn';
    moreBtn.setAttribute('aria-label', 'Ещё');
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.innerHTML = icon('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>') +
      '<span class="mc-btn-label">Ещё</span>';
    nav.appendChild(moreBtn);

    document.body.appendChild(nav);
    // FIX: ensure body has bottom padding for mc-nav (fallback for CSS :has() rule)
    if (!document.body.style.paddingBottom) {
      document.body.style.paddingBottom = 'calc(60px + env(safe-area-inset-bottom, 0px))';
    }

    // ── Построить slide-up панель ──
    var backdrop = document.createElement('div');
    backdrop.className = 'mc-sheet-backdrop';
    backdrop.id = 'mcBackdrop';
    document.body.appendChild(backdrop);

    var sheet = document.createElement('div');
    sheet.className = 'mc-sheet';
    sheet.id = 'mcSheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Навигация');

    // Содержимое панели
    var globalLinks = NAV.global.filter(function(g) {
      return g.pages.indexOf(PAGE) !== -1;
    });

    var html = '<div class="mc-sheet-handle"></div>';
    html += '<div class="mc-sheet-head">';
    html += '<span class="mc-sheet-title">Навигация</span>';
    html += '<button class="mc-sheet-close" id="mcSheetClose" aria-label="Закрыть">✕</button>';
    html += '</div>';

    // Секция "Страницы"
    if (globalLinks.length > 0) {
      html += '<div class="mc-section">';
      html += '<div class="mc-section-label">Перейти</div>';
      globalLinks.forEach(function(g) {
        html += '<a href="' + g.href + '" class="mc-row">';
        html += '<span class="mc-row-icon">' + icon(g.icon, 18) + '</span>';
        html += '<span class="mc-row-text">';
        html += '<span class="mc-row-name">' + g.label + '</span>';
        html += '<span class="mc-row-sub">' + g.sublabel + '</span>';
        html += '</span>';
        html += '<span class="mc-row-arrow">' + icon('<path d="M9 18l6-6-6-6"/>', 16) + '</span>';
        html += '</a>';
      });
      html += '</div>';
    }

    // Секция "На этой странице" (дополнительные якоря)
    var extraAnchors = anchors.slice(3);
    if (extraAnchors.length > 0 || anchors.length > 0) {
      if (globalLinks.length > 0) html += '<div class="mc-sheet-divider"></div>';
      html += '<div class="mc-section">';
      html += '<div class="mc-section-label">На этой странице</div>';
      (extraAnchors.length > 0 ? extraAnchors : anchors).forEach(function(a) {
        html += '<a href="' + a.href + '" class="mc-row mc-row-anchor">';
        html += '<span class="mc-row-icon">' + icon(a.icon, 18) + '</span>';
        html += '<span class="mc-row-text"><span class="mc-row-name">' + a.label + '</span></span>';
        html += '<span class="mc-row-arrow">' + icon('<path d="M9 18l6-6-6-6"/>', 16) + '</span>';
        html += '</a>';
      });
      html += '</div>';
    }

    html += '<div class="mc-sheet-safe"></div>';
    sheet.innerHTML = html;
    document.body.appendChild(sheet);

    // ── Логика открытия/закрытия панели ──
    var isOpen = false;

    function openSheet() {
      // Не открываем если другие оверлеи активны
      var body = document.body;
      if (body.classList.contains('cart-open') ||
          body.classList.contains('fill-open') ||
          body.classList.contains('menu-open')) return;
      isOpen = true;
      sheet.classList.add('mc-open');
      backdrop.classList.add('mc-open');
      moreBtn.setAttribute('aria-expanded', 'true');
      moreBtn.classList.add('mc-active');
      // iOS-safe: только overflow:hidden, БЕЗ position:fixed (не смещаем контент)
      if (typeof window.lockBody === 'function') {
            window.lockBody();
        } else {
            body.style.overflow = 'hidden';
        }
      body.dataset.mcSheetOpen = '1';
    }

    function closeSheet() {
      // Idempotent: always remove visual state even if called redundantly
      isOpen = false;
      sheet.classList.remove('mc-open');
      backdrop.classList.remove('mc-open');
      moreBtn.setAttribute('aria-expanded', 'false');
      moreBtn.classList.remove('mc-active');
      // Восстановить скролл — только если шит владел локом
      if (document.body.dataset.mcSheetOpen) {
            if (typeof window.unlockBody === 'function') {
                window.unlockBody();
            } else {
                document.body.style.overflow = '';
            }
            delete document.body.dataset.mcSheetOpen;
        }
        setTimeout(function() { sheet.style.willChange = 'auto'; }, 400);
    }

    moreBtn.addEventListener('click', function() {
      if (isOpen) closeSheet(); else openSheet();
    });
    backdrop.addEventListener('click', closeSheet);
    document.getElementById('mcSheetClose').addEventListener('click', closeSheet);

    // Expose closeSheet globally so other overlays (cart, fill-toast, etc.) can close it
    window.closeMcSheet = closeSheet;

    // Закрыть при клике на якорь внутри панели
    sheet.querySelectorAll('.mc-row-anchor').forEach(function(el) {
      el.addEventListener('click', function(e) {
        var href = el.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          closeSheet();
          setTimeout(function() {
            var target = document.querySelector(href);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
          }, 320);
        } else {
          closeSheet();
        }
      });
    });

    // Закрыть по Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) closeSheet();
    });

    // Swipe вниз для закрытия
    var startY = 0, startScroll = 0;
    sheet.addEventListener('touchstart', function(e) {
      startY = e.touches[0].clientY;
      startScroll = sheet.scrollTop || 0;
    }, { passive: true });
    sheet.addEventListener('touchmove', function(e) {
      var dy = e.touches[0].clientY - startY;
      if (dy > 60 && startScroll <= 0) closeSheet();
    }, { passive: true });

    // ── Активная секция (scroll spy для якорей) ──
    if (PAGE === 'main' || PAGE === 'prigorod') {
      var sections = [];
      nav.querySelectorAll('.mc-btn[data-section]').forEach(function(btn) {
        var sec = document.getElementById(btn.dataset.section);
        if (sec) sections.push({ el: sec, btn: btn });
      });

      if (sections.length > 0) {
        var io = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            var match = sections.find(function(s) { return s.el === entry.target; });
            if (match && entry.isIntersecting) {
              nav.querySelectorAll('.mc-btn').forEach(function(b) { b.classList.remove('mc-active'); });
              match.btn.classList.add('mc-active');
            }
          });
        }, { threshold: 0.35 });
        sections.forEach(function(s) { io.observe(s.el); });
      }
    }

    // ── Скрывать nav при скролле вниз ──
    var lastScrollY = window.scrollY;
    var ticking = false;
    window.addEventListener('scroll', function() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function() {
        var y = window.scrollY;
        if (y > lastScrollY + 10 && y > 120 && !isOpen) {
          nav.classList.add('mc-nav--hidden');
          document.body.classList.add('mc-nav-hidden');
        } else if (y < lastScrollY - 5) {
          nav.classList.remove('mc-nav--hidden');
          document.body.classList.remove('mc-nav-hidden');
        }
        lastScrollY = y;
        ticking = false;
      });
    }, { passive: true });

    // ── CSS для mc-sheet-open (только overflow, без position:fixed) ──
    var lockStyle = document.createElement('style');
    lockStyle.textContent = '.mc-sheet-open{} /* reserved */';
    document.head.appendChild(lockStyle);
  }

  // ── Запуск ──
  if (window.innerWidth <= 768) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildNav);
    } else {
      buildNav();
    }
  }

  // Реагировать на смену ориентации
  var mq = window.matchMedia('(max-width: 768px)');
  function onMQ(e) {
    if (e.matches && !document.getElementById('mcNav')) buildNav();
  }
  if (mq.addEventListener) mq.addEventListener('change', onMQ);
  else mq.addListener(onMQ);

  // Закрывать sheet если открылась корзина/меню
  var mo = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        var b = document.body;
        if (b.classList.contains('cart-open') || b.classList.contains('menu-open')) {
          var s = document.getElementById('mcSheet');
          var bd = document.getElementById('mcBackdrop');
          var mb = document.getElementById('mcMoreBtn');
                if (s && s.classList.contains('mc-open')) {
                    s.classList.remove('mc-open');
                    if (bd) bd.classList.remove('mc-open');
                    if (mb) { mb.setAttribute('aria-expanded','false'); mb.classList.remove('mc-active'); }
                    if (b.dataset.mcSheetOpen) {
                        if (typeof window.unlockBody === 'function') window.unlockBody();
                        else b.style.overflow = '';
                        delete b.dataset.mcSheetOpen;
                    }
                }
        }
      }
    });
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // ── Emergency cleanup: сброс если body застрял ──
  function emergencyReset() {
    if (document.body.dataset.mcSheetOpen) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      delete document.body.dataset.mcSheetOpen;
    }
    // Убрать position:fixed если вдруг застрял (fill-open-ios bug)
    if (document.body.style.position === 'fixed') {
      document.body.style.position = '';
      document.body.style.top = '';
    }
    // FIX: reset html+body overflow and lockCount on any stuck state
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.dataset.lockCount = '0';
    // FIX: clean fill-open-ios state on bfcache restore
    if (document.body.classList.contains('fill-open-ios')) {
      document.body.classList.remove('fill-open-ios');
      document.body.style.top = '';
      document.body.style.position = '';
    }
    var s = document.getElementById('mcSheet');
    var b = document.getElementById('mcBackdrop');
    if (s) s.classList.remove('mc-open');
    if (b) b.classList.remove('mc-open');
    var mb = document.getElementById('mcMoreBtn');
    if (mb) { mb.setAttribute('aria-expanded','false'); mb.classList.remove('mc-active'); }
    // FIX: make sure mc-nav is visible after reset
    var nav = document.getElementById('mcNav');
    if (nav) nav.classList.remove('mc-nav--hidden');
    document.body.classList.remove('mc-nav-hidden');
  }
  // bfcache — когда пользователь вернулся кнопкой "назад"
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) emergencyReset();
  });
  // visibilitychange — приложение вернулось из фона
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && document.body.style.position === 'fixed') emergencyReset();
  });

})();
