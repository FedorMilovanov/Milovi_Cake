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
        icon: '<path d="M4 10.6 12 4l8 6.6v9.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19.8z"/><path d="M9.6 21.4v-5.8h4.8v5.8"/>',
        pages: ['meringue', 'prigorod', 'prigorody-list'],
      },
      {
        id: 'to-meringue',
        label: 'Меренговый рулет',
        sublabel: '2 500 ₽ · 1 100 г',
        href: '/meringue-roll/',
        // [2026-11-16r17] Владелец: спираль читалась как леденец. Теперь это
        // рулет — срез с завитком внутри, читается даже в 21 px (r20).
        icon: '<circle cx="12" cy="12" r="7.4"/><path d="M12 4.6a7.4 7.4 0 1 0 7.4 7.4"/><path d="M15.6 12a3.6 3.6 0 1 0-3.6 3.6 2 2 0 1 0-2-2"/>',
        pages: ['main', 'prigorod', 'prigorody-list'],
      },
      {
        id: 'to-prigorody',
        label: 'Доставка в пригороды',
        sublabel: 'Пушкин, Петергоф, Гатчина…',
        href: '/prigorody/',
        icon: '<path d="M12 21.4s7-6.4 7-11.4a7 7 0 1 0-14 0c0 5 7 11.4 7 11.4z"/><circle cx="12" cy="10" r="2.7"/>',
        pages: ['main', 'meringue'],
      },
    ],

    // Якоря внутри страниц
    anchors: {
      main: [
        { label: 'Каталог', href: '#catalog', icon: '<rect x="3.6" y="3.6" width="7.2" height="7.2" rx="2.2"/><rect x="13.2" y="3.6" width="7.2" height="7.2" rx="2.2"/><rect x="3.6" y="13.2" width="7.2" height="7.2" rx="2.2"/><rect x="13.2" y="13.2" width="7.2" height="7.2" rx="2.2"/>', section: 'catalog' },
        { label: 'Начинки', href: '#fillings', icon: '<path d="M12 20.8c-.3 0-.6-.1-.8-.3C6.4 16.7 3 13.6 3 9.9 3 7 5.1 4.8 7.9 4.8c1.5 0 2.9.7 4.1 2 1.2-1.3 2.6-2 4.1-2 2.8 0 4.9 2.2 4.9 5.1 0 3.7-3.4 6.8-8.2 10.6-.2.2-.5.3-.8.3z"/>', section: 'fillings' },
        { label: 'Отзывы', href: '#reviews', icon: '<path d="M12 4.4c4.6 0 8.4 3.1 8.4 7s-3.8 7-8.4 7c-1 0-1.9-.1-2.8-.4l-4.5 1.4 1.3-3.7c-1.2-1.1-2-2.6-2-4.3 0-3.9 3.8-7 8-7z"/>', section: 'reviews' },
        { label: 'Контакты', href: '#contacts', icon: '<path d="M8.4 3.6H5.6A2 2 0 0 0 3.6 5.8c.2 6.8 5.9 12.5 12.7 12.7a2 2 0 0 0 2.1-2v-2.7a2 2 0 0 0-1.6-2l-2-.3a2 2 0 0 0-1.8.8l-.8 1a12.4 12.4 0 0 1-5.1-5.1l1-.8a2 2 0 0 0 .8-1.8l-.3-2a2 2 0 0 0-2-1.6z"/>', section: 'contacts' },
      ],
      meringue: [
        { label: 'Состав', href: '#composition', icon: '<path d="M13.8 2.6H6.8a2 2 0 0 0-2 2v14.8a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2V7.6z"/><path d="M13.8 2.6v5h5"/><path d="M15.6 13.2H8.4M15.6 17H8.4"/>' },
        { label: 'Фото', href: '#gallery', icon: '<rect x="3.4" y="4.6" width="17.2" height="15" rx="2.6"/><circle cx="9" cy="10" r="1.6"/><path d="m20.6 16.4-4.4-4.2-8.8 8"/>' },
        { label: 'Отзывы', href: '#reviews', icon: '<path d="M12 4.4c4.6 0 8.4 3.1 8.4 7s-3.8 7-8.4 7c-1 0-1.9-.1-2.8-.4l-4.5 1.4 1.3-3.7c-1.2-1.1-2-2.6-2-4.3 0-3.9 3.8-7 8-7z"/>' },
        { label: 'Заказать', href: '#order', icon: '<path d="M8.4 3.6H5.6A2 2 0 0 0 3.6 5.8c.2 6.8 5.9 12.5 12.7 12.7a2 2 0 0 0 2.1-2v-2.7a2 2 0 0 0-1.6-2l-2-.3a2 2 0 0 0-1.8.8l-.8 1a12.4 12.4 0 0 1-5.1-5.1l1-.8a2 2 0 0 0 .8-1.8l-.3-2a2 2 0 0 0-2-1.6z"/>' },
      ],
      prigorod: [
        { label: 'Каталог', href: '#catalog', icon: '<rect x="3.6" y="3.6" width="7.2" height="7.2" rx="2.2"/><rect x="13.2" y="3.6" width="7.2" height="7.2" rx="2.2"/><rect x="3.6" y="13.2" width="7.2" height="7.2" rx="2.2"/><rect x="13.2" y="13.2" width="7.2" height="7.2" rx="2.2"/>', section: 'catalog' },
        { label: 'Начинки', href: '#fillings', icon: '<path d="M12 20.8c-.3 0-.6-.1-.8-.3C6.4 16.7 3 13.6 3 9.9 3 7 5.1 4.8 7.9 4.8c1.5 0 2.9.7 4.1 2 1.2-1.3 2.6-2 4.1-2 2.8 0 4.9 2.2 4.9 5.1 0 3.7-3.4 6.8-8.2 10.6-.2.2-.5.3-.8.3z"/>', section: 'fillings' },
        { label: 'Отзывы', href: '#reviews', icon: '<path d="M12 4.4c4.6 0 8.4 3.1 8.4 7s-3.8 7-8.4 7c-1 0-1.9-.1-2.8-.4l-4.5 1.4 1.3-3.7c-1.2-1.1-2-2.6-2-4.3 0-3.9 3.8-7 8-7z"/>', section: 'reviews' },
        { label: 'Контакты', href: '#contacts', icon: '<path d="M8.4 3.6H5.6A2 2 0 0 0 3.6 5.8c.2 6.8 5.9 12.5 12.7 12.7a2 2 0 0 0 2.1-2v-2.7a2 2 0 0 0-1.6-2l-2-.3a2 2 0 0 0-1.8.8l-.8 1a12.4 12.4 0 0 1-5.1-5.1l1-.8a2 2 0 0 0 .8-1.8l-.3-2a2 2 0 0 0-2-1.6z"/>', section: 'contacts' },
      ],
      'prigorody-list': [
        { label: 'Наверх', href: '#home', icon: '<path d="m6.2 14.6 5.8-5.8 5.8 5.8"/>' },
      ],
    },
  };

  // ── SVG хелпер ──
  function icon(paths, size) {
    size = size || 22;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths + '</svg>';
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
      /* ── Основной nav-bar — премиальный минимализм (2026-11-16) ── */
      '.mc-nav{',
        'display:none;',
      '}',
      '@media(max-width:768px){',
        /* [r29] Геометрия и вид бара — из CSS (токены --mc-nav-* в style.css),
           здесь только структура: иначе инлайновый слой перебивал темовую
           палитру и бар «мигал» кремовым в тёмной теме. */
        '.mc-nav{',
          'display:flex;',
          'position:fixed;',
          'left:var(--mc-nav-side, 12px);right:var(--mc-nav-side, 12px);',
          'bottom:var(--mc-nav-gap, 8px);',
          'z-index:105;',
          'align-items:stretch;',
          'transition:transform 0.28s cubic-bezier(.4,0,.2,1);',
        '}',
        '.mc-nav.mc-nav--hidden{transform:translateY(100%);}',

        /* Кнопки в баре */
        '.mc-btn{',
          'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;',
          'gap:4px;padding:4px 4px 3px;',
          'background:none;border:none;cursor:pointer;',
          'color:inherit;',
          'font-size:9.5px;font-weight:500;letter-spacing:0.05em;',
          'font-family:Jost,sans-serif;',
          'text-decoration:none;',
          '-webkit-tap-highlight-color:transparent;',
          'touch-action:manipulation;',
          'transition:color 0.22s,transform 0.16s cubic-bezier(.34,1.56,.64,1);',
          'position:relative;',
          'min-height:60px;',
        '}',
        '.mc-btn:active{transform:scale(0.92);}',
        /* Дуотон: активная иконка мягко заливается золотом изнутри */
        '.mc-btn svg{',
          'width:23px;height:23px;',
          'fill:rgba(0,0,0,0);fill-opacity:0;',
          'transition:fill .3s ease,fill-opacity .3s ease,color .22s ease,transform .3s cubic-bezier(.34,1.56,.64,1);',
        '}',
        /* [r29] Активный пункт — только цвет SVG и подписи (см. final-fixes.css):
           заливка контурных иконок и сдвиг на 1 px убраны. */
        '.mc-btn-label{font-size:9.5px;line-height:1;white-space:nowrap;}',

        /* Центральная кнопка «Заказать» — золотая рамка-контур (owner mockup) */
        '.mc-btn--order{color:#a06a28;gap:2px;}',
        '.mc-btn--order .mc-btn-circle{',
          'width:44px;height:44px;border-radius:16px;',
          'position:relative;',
          'background:',
            'linear-gradient(160deg, rgba(255,248,232,0.20), rgba(201,147,74,0.06));',
          'border:1.5px solid rgba(181,133,60,0.8);',
          'display:flex;align-items:center;justify-content:center;',
          'box-shadow:',
            '0 6px 16px rgba(120,78,30,0.16),',
            '0 0 0 1px rgba(255,252,244,0.18) inset;',
          'margin-top:0;margin-bottom:0;',
          'transition:transform 0.18s cubic-bezier(.34,1.56,.64,1),box-shadow 0.18s ease,filter 0.18s ease;',
        '}',
        /* Двойная рамка: тонкое концентрическое кольцо внутри */
        '.mc-btn--order .mc-btn-circle::before{',
          'content:"";position:absolute;inset:3px;',
          'border-radius:11px;',
          'border:1px solid rgba(181,133,60,0.28);',
          'pointer-events:none;',
        '}',
        'html[data-theme="dark"] .mc-btn--order .mc-btn-circle{',
          'background:linear-gradient(160deg, rgba(255,244,214,0.10), rgba(212,167,106,0.04));',
          'border-color:rgba(232,190,120,0.55);',
          'box-shadow:',
            '0 8px 18px rgba(0,0,0,0.35),',
            '0 0 0 1px rgba(255,244,218,0.10) inset;',
        '}',
        'html[data-theme="dark"] .mc-btn--order .mc-btn-circle::before{',
          'border-color:rgba(232,190,120,0.22);',
        '}',
        '.mc-btn--order:active .mc-btn-circle{transform:scale(0.94);filter:brightness(0.97);}',

        /* Разделитель */
        '.mc-sep{width:1px;background:rgba(201,147,74,0.1);margin:14px 0;flex-shrink:0;}',

        /* ── SLIDE-UP ПАНЕЛЬ ── */
        '.mc-sheet-backdrop{',
          'position:fixed;inset:0;z-index:295;',
          'background:rgba(28,16,8,0);',
          'transition:background 0.3s ease;',
          '-webkit-tap-highlight-color:transparent;',
          'pointer-events:none;',
        '}',
        '.mc-sheet-backdrop.mc-open{',
          'pointer-events:auto;',
          'background:rgba(24,13,6,0.42);',
        '}',
        '.mc-sheet{',
          'position:fixed;',
          'bottom:var(--mc-nav-total);',
          'left:0;right:0;z-index:300;',
          'background:#fdfbf7;',
          'border-radius:24px 24px 0 0;',
          'border-top:1px solid rgba(201,147,74,0.22);',
          'box-shadow:0 -14px 44px rgba(45,28,17,0.18), 0 -1px 0 rgba(255,252,246,0.5) inset;',
          'transform:translateY(100%);',
          'transition:transform 0.38s cubic-bezier(0.32,0.72,0,1);',
          'will-change:transform;',
          'overflow:hidden;',
          'pointer-events:none;',
        '}',
        '.mc-sheet.mc-open{transform:translateY(0);pointer-events:auto;}',

        /* Ручка */
        '.mc-sheet-handle{',
          'width:34px;height:4px;',
          'background:linear-gradient(90deg, rgba(201,147,74,0.10), rgba(201,147,74,0.30), rgba(201,147,74,0.10));',
          'border-radius:99px;',
          'margin:12px auto 0;',
        '}',

        /* Заголовок панели */
        '.mc-sheet-head{',
          'display:flex;align-items:center;justify-content:space-between;',
          'padding:15px 22px 6px;',
        '}',
        '.mc-sheet-title{',
          'font-size:10.5px;letter-spacing:0.22em;',
          'text-transform:uppercase;color:rgba(154,122,98,0.75);',
          'font-family:Jost,sans-serif;font-weight:500;',
        '}',
        '.mc-sheet-close{',
          'width:32px;height:32px;',
          'border-radius:50%;',
          'border:1px solid rgba(201,147,74,0.22);',
          'background:rgba(201,147,74,0.06);',
          'color:rgba(138,113,90,0.85);',
          'display:flex;align-items:center;justify-content:center;',
          'cursor:pointer;',
          '-webkit-tap-highlight-color:transparent;',
          'transition:transform 0.25s cubic-bezier(.34,1.56,.64,1),background 0.25s ease,color 0.25s ease;',
        '}',
        '.mc-sheet-close:active{transform:scale(0.92);}',

        /* Секция в панели */
        '.mc-section{padding:0 14px 12px;}',
        '.mc-section-label{',
          'font-size:9px;letter-spacing:0.22em;text-transform:uppercase;',
          'color:rgba(154,122,98,0.5);',
          'font-family:Jost,sans-serif;',
          'padding:0 8px;margin:12px 0 7px;',
        '}',

        /* Строка-ссылка в панели */
        '.mc-row{',
          'display:flex;align-items:center;gap:13px;',
          'padding:10px 13px;',
          'border-radius:16px;',
          'text-decoration:none;',
          'color:var(--text,#2c1a10);',
          'font-family:Jost,sans-serif;',
          '-webkit-tap-highlight-color:transparent;',
          'transition:background 0.18s,transform 0.18s cubic-bezier(.34,1.56,.64,1);',
          'cursor:pointer;',
          'background:none;border:1px solid transparent;width:100%;text-align:left;',
        '}',
        '.mc-row:active{transform:scale(0.985);background:rgba(201,147,74,0.07);}',
        '@media(hover:hover){.mc-row:hover{background:rgba(201,147,74,0.05);}}',
        '.mc-row-icon{',
          'width:42px;height:42px;border-radius:13px;',
          'background:linear-gradient(150deg, rgba(201,147,74,0.12), rgba(201,147,74,0.05));',
          'display:flex;align-items:center;justify-content:center;',
          'flex-shrink:0;',
          'color:#b07a3a;',
          'box-shadow:0 0 0 1px rgba(201,147,74,0.12) inset;',
        '}',
        '.mc-row-icon svg{width:20px;height:20px;}',
        '.mc-row-text{flex:1;min-width:0;}',
        '.mc-row-name{',
          'font-size:14px;font-weight:500;letter-spacing:0.01em;',
          'color:#2c1a10;',
          'line-height:1.25;',
        '}',
        '.mc-row-sub{',
          'font-size:11px;color:rgba(154,122,98,0.78);letter-spacing:0.02em;',
          'margin-top:2px;',
        '}',
        '.mc-row-arrow{',
          'color:rgba(201,147,74,0.34);',
          'flex-shrink:0;',
        '}',
        /* Текущая строка: инвертированная золотая медальон-иконка (день и ночь) */
        '.mc-row--current .mc-row-icon,.mc-row--active .mc-row-icon{',
          'background:linear-gradient(155deg, #d9ad72 0%, #bf8c42 100%);',
          'color:#fffaf0;',
          'box-shadow:0 6px 16px rgba(176,122,58,0.32);',
        '}',
        '.mc-row--current .mc-row-name,.mc-row--active .mc-row-name{color:#a06a28;}',
        '.mc-row--current .mc-row-arrow,.mc-row--active .mc-row-arrow{opacity:0.25;}',

        /* Divider внутри панели */
        '.mc-sheet-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(201,147,74,0.14),transparent);margin:6px 18px;}',

        /* Нижняя безопасная зона панели */
        '.mc-sheet-safe{height:env(safe-area-inset-bottom,0px);}',
      '}', /* end @media */
  
  /* has-mc-nav: CSS class approach for body bottom-padding (no inline style) */
  '.has-mc-nav{padding-bottom:calc(60px + env(safe-area-inset-bottom,0px)) !important;}',
  '@media(min-width:769px){.has-mc-nav{padding-bottom:0 !important;}}',
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

    // [2026-11-16f] Owner mockup: золотая медаль «Заказать» — центр бара,
    // поэтому половина якорей идёт до неё, половина — после.
    var barSplit = Math.ceil(barItems.length / 2);
    var leadingItems = barItems.slice(0, barSplit);
    var trailingItems = barItems.slice(barSplit);

    // Пункты якорей
    function appendAnchorButton(item) {
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
          // [r26] Мгновенный отклик: выбранный пункт подсвечивается сразу,
          // не дожидаясь, пока scroll spy догонит плавный скролл.
          nav.querySelectorAll('.mc-btn').forEach(function(b) { b.classList.remove('mc-active'); });
          el.classList.add('mc-active');
          var target = document.querySelector(item.href);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
      });
      nav.appendChild(el);
    }

    leadingItems.forEach(appendAnchorButton);

    // Центральная кнопка — заказать (WA) или открыть корзину
    var orderBtn = document.createElement('button'); orderBtn.type = 'button';
    orderBtn.className = 'mc-btn mc-btn--order';
    orderBtn.setAttribute('aria-label', 'Корзина');
    // [2026-11-16r14] Макет владельца (image-3): корзина — обычный пункт бара,
    // без золотой медали; блик и подсветку рисует CSS (final-fixes.css).
    orderBtn.innerHTML = icon('<path d="M3 4.2h2.1l2.3 9.8a1.9 1.9 0 0 0 1.85 1.45h7.9a1.9 1.9 0 0 0 1.85-1.45L21 7.1H6.2"/><circle cx="10" cy="19.3" r="1.45"/><circle cx="17.4" cy="19.3" r="1.45"/>', 22) +
      '<span class="mc-btn-badge" data-cart-badge aria-hidden="true">0</span>' +
      '<span class="mc-btn-label">Корзина</span>';
    // [r26] Счётчик в баре: updateCartUI() обновляет его через [data-cart-badge];
    // здесь — только первичное состояние, если корзина уже была непустой.
    (function () {
      var badge = orderBtn.querySelector('[data-cart-badge]');
      var count = 0;
      // [r30] Первичное состояние — по общему контракту main.js (cartItemCount):
      // количество изделий, а не число позиций.
      try {
        count = (typeof window.cartItemCount === 'function') ? window.cartItemCount()
          : ((typeof cart !== 'undefined' && cart) ? Object.keys(cart).length : 0);
      } catch (e) { count = 0; }
      if (!badge) return;
      badge.textContent = count;
      badge.classList.toggle('visible', count > 0);
    })();
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

    trailingItems.forEach(appendAnchorButton);

    // Кнопка "Ещё" — открывает панель
    var moreBtn = document.createElement('button'); moreBtn.type = 'button';
    moreBtn.className = 'mc-btn';
    moreBtn.id = 'mcMoreBtn';
    moreBtn.setAttribute('aria-label', 'Ещё');
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.innerHTML = icon('<circle cx="12" cy="5.6" r="1.15"/><circle cx="12" cy="12" r="1.15"/><circle cx="12" cy="18.4" r="1.15"/>') +
      '<span class="mc-btn-label">Ещё</span>';
    nav.appendChild(moreBtn);

    document.body.appendChild(nav);
    // FIX: use CSS class instead of inline style — inline style blocks CSS overrides
    document.body.classList.add('has-mc-nav');

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
    html += '<button type="button" class="mc-sheet-close" id="mcSheetClose" aria-label="Закрыть"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6"/></svg></button>';
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
        html += '<span class="mc-row-arrow">' + icon('<path d="m9.6 5.8 6.2 6.2-6.2 6.2"/>', 16) + '</span>';
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
        html += '<span class="mc-row-arrow">' + icon('<path d="m9.6 5.8 6.2 6.2-6.2 6.2"/>', 16) + '</span>';
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
        // [r26] Раньше активным становился раздел, занявший 35% экрана — на
        // длинных секциях подсветка почти никогда не появлялась. Теперь —
        // секция, проходящая через центр экрана (полоса в 10% высоты).
        var io = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            var match = sections.find(function(s) { return s.el === entry.target; });
            if (match && entry.isIntersecting) {
              nav.querySelectorAll('.mc-btn').forEach(function(b) { b.classList.remove('mc-active'); });
              match.btn.classList.add('mc-active');
            }
          });
        }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
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

/* ══════════════════════════════════════════════════════════════
   PATCH R13 — premium tactile feedback for mobile TOC
   Без изменения структуры: только мягкий press-state и aria-current.
   ══════════════════════════════════════════════════════════════ */
(function r13MobileTocPolish(){
  'use strict';
  function ready(fn){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function(){
    var pressSelector = '#mcNav .mc-btn, #mcSheet .mc-row, #mcSheet .mc-sheet-close, .mobile-menu-nav a, .mobile-menu-close, .mm-msg';

    document.addEventListener('pointerdown', function(e){
      var el = e.target && e.target.closest ? e.target.closest(pressSelector) : null;
      if (!el) return;
      el.classList.add('mc-press');
    }, { passive: true });

    ['pointerup','pointercancel','pointerleave','blur'].forEach(function(type){
      document.addEventListener(type, function(e){
        var el = e.target && e.target.closest ? e.target.closest(pressSelector) : null;
        if (el) el.classList.remove('mc-press');
      }, true);
    });

    function syncAriaCurrent(){
      var nav = document.getElementById('mcNav');
      if (!nav) return;
      nav.querySelectorAll('.mc-btn').forEach(function(btn){
        if (btn.classList.contains('mc-active')) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      });
    }

    var mo = new MutationObserver(syncAriaCurrent);
    function attach(){
      var nav = document.getElementById('mcNav');
      if (!nav) return false;
      mo.observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
      syncAriaCurrent();
      return true;
    }
    if (!attach()) {
      var tries = 0;
      var timer = setInterval(function(){
        tries += 1;
        if (attach() || tries > 20) clearInterval(timer);
      }, 250);
    }
  });
})();

/* ══════════════════════════════════════════════════════════════
   PATCH R14 — mobile TOC semantics + active row refinement
   Тонкий слой: aria-hidden, focus return, active rows in sheet.
   Структуру и существующую логику не меняем.
   ══════════════════════════════════════════════════════════════ */
(function r14MobileTocSemantics(){
  'use strict';
  function ready(fn){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  ready(function(){
    var lastTrigger = null;
    var closeFocusTimer = null;

    function q(id){ return document.getElementById(id); }
    function sheetOpen(){ var s = q('mcSheet'); return !!(s && s.classList.contains('mc-open')); }

    function setInitialA11y(){
      var sheet = q('mcSheet');
      var backdrop = q('mcBackdrop');
      if (sheet && !sheet.classList.contains('mc-open')) sheet.setAttribute('aria-hidden', 'true');
      if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('pointerdown', function(e){
      var trigger = e.target && e.target.closest ? e.target.closest('#mcMoreBtn') : null;
      if (trigger) lastTrigger = trigger;
    }, { passive: true });

    function syncSheetState(){
      var sheet = q('mcSheet');
      var backdrop = q('mcBackdrop');
      var open = sheetOpen();
      if (sheet) sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
      // При открытии листа строки-ссылки должны сразу показать текущую секцию.
      if (open) syncActiveRows();

      clearTimeout(closeFocusTimer);
      if (open) {
        closeFocusTimer = setTimeout(function(){
          var close = q('mcSheetClose');
          if (close && document.activeElement !== close) close.focus({ preventScroll: true });
        }, 80);
      } else if (lastTrigger && document.contains(lastTrigger)) {
        closeFocusTimer = setTimeout(function(){
          try { lastTrigger.focus({ preventScroll: true }); } catch(e) { lastTrigger.focus(); }
        }, 120);
      }
    }

    function currentSectionId(){
      var candidates = Array.prototype.slice.call(document.querySelectorAll('section[id], main [id]'))
        .filter(function(el){
          var id = el.id || '';
          return ['home','catalog','fillings','reviews','contacts','delivery','composition','gallery','order','why'].indexOf(id) !== -1;
        });
      if (!candidates.length) return (location.hash || '').replace('#','');
      var best = null, bestScore = -Infinity;
      var vh = window.innerHeight || 1;
      candidates.forEach(function(el){
        var r = el.getBoundingClientRect();
        var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        var centerBias = -Math.abs((r.top + r.bottom) / 2 - vh * 0.42) / vh;
        var score = (visible > 0 ? visible / Math.max(1, r.height) : -1) + centerBias;
        if (score > bestScore) { bestScore = score; best = el; }
      });
      return best ? best.id : (location.hash || '').replace('#','');
    }

    var activeRaf = 0;
    function syncActiveRows(){
      if (activeRaf) return;
      // Строки-ссылки живут только внутри мобильного листа: когда он закрыт,
      // подсветка не видна, а расчёт секций гоняет getBoundingClientRect на
      // каждом scroll-кадре (длинная задача 177–215 мс после FCP, см. #100).
      if (!sheetOpen()) return;
      activeRaf = requestAnimationFrame(function(){
        activeRaf = 0;
        var sheet = q('mcSheet');
        if (!sheet || !sheetOpen()) return;
        var id = currentSectionId();
        if (!id) return;
        sheet.querySelectorAll('.mc-row-anchor').forEach(function(row){
          var href = row.getAttribute('href') || '';
          var on = href === '#' + id;
          row.classList.toggle('mc-row--active', on);
          if (on) row.setAttribute('aria-current', 'location');
          else row.removeAttribute('aria-current');
        });
      });
    }

    function attach(){
      var sheet = q('mcSheet');
      if (!sheet) return false;
      setInitialA11y();
      var mo = new MutationObserver(syncSheetState);
      mo.observe(sheet, { attributes: true, attributeFilter: ['class'] });
      syncSheetState();
      syncActiveRows();
      return true;
    }

    if (!attach()) {
      var tries = 0;
      var t = setInterval(function(){
        tries += 1;
        if (attach() || tries > 24) clearInterval(t);
      }, 250);
    }

    window.addEventListener('scroll', syncActiveRows, { passive: true });
    window.addEventListener('hashchange', syncActiveRows, { passive: true });
    window.addEventListener('resize', syncActiveRows, { passive: true });
  });
})();
