/* Milovi Cake — centralized privacy-first analytics loader.
 * No third-party request is made before an explicit visitor choice.
 * Desktop settings live in the footer; mobile settings live inside the app-like “Ещё” sheet.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'milovi_analytics_consent_v1';
  var GA_ID = 'G-94ZZ5B8YNY';
  var YM_ID = 106945185;
  var mobileMq = window.matchMedia('(max-width: 768px)');
  var state = readChoice();
  var overlay = null;
  var dialog = null;
  var trigger = null;
  var statusValue = null;
  var denyButton = null;
  var allowButton = null;
  var lastFocused = null;
  var closeTimer = null;
  var loaded = false;
  var goalsBound = false;
  var shellObserver = null;

  function isMobileApp() {
    return mobileMq.matches;
  }

  function readChoice() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch (_) {
      return null;
    }
  }

  function saveChoice(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
    state = value;
  }

  function ensureUiAssets() {
    if (document.getElementById('milovi-contact-polish')) return;
    var polish = document.createElement('link');
    polish.id = 'milovi-contact-polish';
    polish.rel = 'stylesheet';
    polish.href = '/css/contact-polish.css?v=20260803r7';
    document.head.appendChild(polish);
  }

  function loadGoogleAnalytics() {
    if (!GA_ID || document.querySelector('script[data-milovi-ga]')) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      transport_type: 'beacon',
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    var script = document.createElement('script');
    script.async = true;
    script.dataset.miloviGa = '1';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(script);
  }

  function loadYandexMetrika() {
    if (!YM_ID || document.querySelector('script[data-milovi-ym]')) return;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    window.ym(YM_ID, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true
    });
    var script = document.createElement('script');
    script.async = true;
    script.dataset.miloviYm = '1';
    script.src = 'https://mc.yandex.ru/metrika/tag.js';
    document.head.appendChild(script);
  }

  function loadAnalytics() {
    if (loaded || state !== 'granted') return;
    loaded = true;
    window['ga-disable-' + GA_ID] = false;
    loadGoogleAnalytics();
    loadYandexMetrika();
  }

  function sendGoal(name, params) {
    if (state !== 'granted') return;
    var payload = params || { path: location.pathname };
    if (typeof window.ym === 'function') {
      try { window.ym(YM_ID, 'reachGoal', name, payload); } catch (_) {}
    }
    if (typeof window.gtag === 'function') {
      try { window.gtag('event', name, payload); } catch (_) {}
    }
  }

  function bindConversionGoals() {
    if (goalsBound) return;
    goalsBound = true;
    document.addEventListener('click', function (event) {
      var target = event.target;
      var link = target && target.closest ? target.closest('a') : null;
      if (!link) return;
      var href = link.getAttribute('href') || '';
      var params = {
        path: location.pathname,
        href: href,
        text: (link.textContent || '').trim().slice(0, 80)
      };
      if (href.indexOf('wa.me') !== -1) sendGoal('lp_wa_click', params);
      else if (href.indexOf('t.me') !== -1) sendGoal('lp_tg_click', params);
      else if (href.indexOf('max.ru') !== -1) sendGoal('lp_max_click', params);
      else if (href.indexOf('tel:') === 0) sendGoal('lp_phone_click', params);
      if (link.classList.contains('lp-btn') || link.classList.contains('info-btn') || link.classList.contains('btn-primary')) {
        sendGoal('lp_cta_click', params);
      }
      if (href.indexOf('/gallery/') !== -1) sendGoal('lp_gallery_click', params);
    }, true);
    document.addEventListener('play', function (event) {
      if (event.target && event.target.tagName === 'VIDEO') {
        sendGoal('lp_video_play', { path: location.pathname });
      }
    }, true);
  }

  function footerHost() {
    return document.querySelector('.site-footer .footer-bottom, footer .footer-bottom') ||
      document.querySelector('.site-footer .container, footer .container') ||
      document.querySelector('.site-footer, footer');
  }

  function renderFooterTrigger() {
    if (isMobileApp()) {
      if (trigger && trigger.isConnected) trigger.remove();
      trigger = null;
      return null;
    }
    if (trigger && trigger.isConnected) return trigger;
    var host = footerHost();
    if (!host) return null;
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'mc-consent-trigger';
    trigger.textContent = 'Настройки конфиденциальности';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'mc-consent-dialog');
    trigger.addEventListener('click', function () { openDialog(false); });
    host.appendChild(trigger);
    return trigger;
  }

  function stateLabel() {
    if (state === 'granted') return 'Аналитика разрешена';
    if (state === 'denied') return 'Аналитика отключена';
    return 'Выбор ещё не сделан';
  }

  function mobileStateLabel() {
    if (state === 'granted') return 'Разрешена';
    if (state === 'denied') return 'Отключена';
    return 'Выбор не сделан';
  }

  function syncMobilePrivacyRow() {
    var sub = document.querySelector('#mcPrivacyRow .mc-row-sub');
    var next = mobileStateLabel();
    if (sub && sub.textContent !== next) sub.textContent = next;
  }

  function removeLegacyMobileShells() {
    if (!isMobileApp()) return;
    ['bottomNav', 'mrBottomNav'].forEach(function (id) {
      var old = document.getElementById(id);
      if (!old) return;
      old.hidden = true;
      old.setAttribute('aria-hidden', 'true');
      old.style.setProperty('display', 'none', 'important');
      old.style.setProperty('pointer-events', 'none', 'important');
    });
    var nav = document.getElementById('mcNav');
    if (nav) nav.classList.remove('mc-nav--hidden');
    document.body.classList.remove('mc-nav-hidden');
  }

  function removeMobilePrivacyRow() {
    var section = document.querySelector('#mcSheet .mc-section--privacy');
    if (section) section.remove();
  }

  function ensureMobilePrivacyRow() {
    if (!isMobileApp()) {
      removeMobilePrivacyRow();
      return false;
    }
    var sheet = document.getElementById('mcSheet');
    if (!sheet) return false;
    var current = document.getElementById('mcPrivacyRow');
    if (current) {
      syncMobilePrivacyRow();
      return true;
    }

    var section = document.createElement('div');
    section.className = 'mc-section mc-section--privacy';
    section.innerHTML = '' +
      '<div class="mc-section-label">Настройки</div>' +
      '<button type="button" class="mc-row mc-row-privacy" id="mcPrivacyRow" aria-haspopup="dialog" aria-controls="mc-consent-dialog">' +
        '<span class="mc-row-icon" aria-hidden="true">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
            '<path d="M9.5 12l1.7 1.7 3.6-4"/>' +
          '</svg>' +
        '</span>' +
        '<span class="mc-row-text">' +
          '<span class="mc-row-name">Конфиденциальность</span>' +
          '<span class="mc-row-sub">' + mobileStateLabel() + '</span>' +
        '</span>' +
        '<span class="mc-row-arrow" aria-hidden="true">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>' +
        '</span>' +
      '</button>';

    var safe = sheet.querySelector('.mc-sheet-safe');
    sheet.insertBefore(section, safe || null);
    section.querySelector('#mcPrivacyRow').addEventListener('click', function () {
      if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
      setTimeout(function () { openDialog(false); }, 220);
    });
    return true;
  }

  function syncResponsiveControls() {
    document.documentElement.classList.toggle('mc-mobile-app', isMobileApp());
    removeLegacyMobileShells();
    renderFooterTrigger();
    ensureMobilePrivacyRow();
  }

  function installMobileShellBridge() {
    syncResponsiveControls();
    if (shellObserver) return;
    shellObserver = new MutationObserver(function () {
      removeLegacyMobileShells();
      ensureMobilePrivacyRow();
    });
    shellObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', removeLegacyMobileShells, { passive: true });
  }

  function syncDialog() {
    if (!dialog) return;
    if (statusValue) statusValue.textContent = stateLabel();
    if (denyButton) {
      var denied = state === 'denied';
      denyButton.classList.toggle('is-selected', denied);
      denyButton.setAttribute('aria-pressed', denied ? 'true' : 'false');
    }
    if (allowButton) {
      var granted = state === 'granted';
      allowButton.classList.toggle('is-selected', granted);
      allowButton.setAttribute('aria-pressed', granted ? 'true' : 'false');
    }
    syncMobilePrivacyRow();
  }

  function focusableElements() {
    if (!dialog) return [];
    return Array.prototype.slice.call(dialog.querySelectorAll(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(function (element) {
      return element.offsetWidth > 0 || element.offsetHeight > 0;
    });
  }

  function onDialogKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    var focusable = focusableElements();
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function ensureDialog() {
    ensureUiAssets();
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'mc-consent-overlay';
    overlay.hidden = true;
    overlay.innerHTML = '' +
      '<section class="mc-consent-dialog" id="mc-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="mc-consent-title" aria-describedby="mc-consent-description">' +
        '<div class="mc-consent-handle" aria-hidden="true"></div>' +
        '<button class="mc-consent-close" type="button" aria-label="Закрыть настройки конфиденциальности">×</button>' +
        '<p class="mc-consent-eyebrow">Конфиденциальность</p>' +
        '<h2 class="mc-consent-title" id="mc-consent-title">Настройки аналитики</h2>' +
        '<p class="mc-consent-text" id="mc-consent-description">Сайт полностью работает без аналитики. Google Analytics и Яндекс.Метрика подключаются только после разрешения и помогают понять, какие разделы удобны посетителям. Подробнее — в <a href="/privacy/">политике конфиденциальности</a>.</p>' +
        '<div class="mc-consent-status" aria-live="polite">' +
          '<span class="mc-consent-status-label">Текущее состояние</span>' +
          '<strong class="mc-consent-status-value"></strong>' +
        '</div>' +
        '<div class="mc-consent-actions">' +
          '<button class="mc-consent-button mc-consent-button--deny" type="button" data-choice="denied" aria-pressed="false">Без аналитики</button>' +
          '<button class="mc-consent-button mc-consent-button--allow" type="button" data-choice="granted" aria-pressed="false">Разрешить аналитику</button>' +
        '</div>' +
      '</section>';

    dialog = overlay.querySelector('.mc-consent-dialog');
    statusValue = overlay.querySelector('.mc-consent-status-value');
    denyButton = overlay.querySelector('[data-choice="denied"]');
    allowButton = overlay.querySelector('[data-choice="granted"]');

    overlay.querySelector('.mc-consent-close').addEventListener('click', closeDialog);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeDialog();
    });
    overlay.addEventListener('click', function (event) {
      var choice = event.target.closest('[data-choice]');
      if (choice) setChoice(choice.getAttribute('data-choice'));
    });
    dialog.addEventListener('keydown', onDialogKeydown);
    document.body.appendChild(overlay);
    syncDialog();
    return overlay;
  }

  function openDialog(autoOpened) {
    if (typeof window.closeMcSheet === 'function') window.closeMcSheet();
    ensureDialog();
    renderFooterTrigger();
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    lastFocused = autoOpened ? null : document.activeElement;
    syncDialog();
    overlay.hidden = false;
    document.body.classList.add('mc-consent-open');
    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
      var focusTarget = overlay.querySelector('.mc-consent-close');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });
  }

  function closeDialog() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-open');
    document.body.classList.remove('mc-consent-open');
    closeTimer = setTimeout(function () {
      overlay.hidden = true;
      closeTimer = null;
      if (lastFocused && lastFocused.isConnected && typeof lastFocused.focus === 'function') {
        lastFocused.focus({ preventScroll: true });
      }
    }, 240);
  }

  function setChoice(value) {
    var previous = state;
    saveChoice(value);
    syncDialog();

    if (value === 'granted') {
      window['ga-disable-' + GA_ID] = false;
      loadAnalytics();
      closeDialog();
      return;
    }

    window['ga-disable-' + GA_ID] = true;
    if (loaded && previous === 'granted') {
      location.reload();
      return;
    }
    closeDialog();
  }

  function init() {
    ensureUiAssets();
    bindConversionGoals();
    installMobileShellBridge();
    ensureDialog();

    if (state === 'granted') loadAnalytics();
    else window['ga-disable-' + GA_ID] = true;

    if (!state) {
      setTimeout(function () {
        if (!state && !document.hidden) openDialog(true);
      }, 700);
    }
  }

  window.MiloviConsent = {
    open: function () { openDialog(false); },
    close: closeDialog,
    getChoice: function () { return state; },
    grant: function () { setChoice('granted'); },
    deny: function () { setChoice('denied'); },
    goal: sendGoal
  };

  document.addEventListener('milovi:open-consent', function () { openDialog(false); });
  if (mobileMq.addEventListener) mobileMq.addEventListener('change', syncResponsiveControls);
  else mobileMq.addListener(syncResponsiveControls);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
