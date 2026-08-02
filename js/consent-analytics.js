/* Milovi Cake — centralized privacy-first analytics loader.
 * No third-party request is made before an explicit visitor choice.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'milovi_analytics_consent_v1';
  var GA_ID = 'G-94ZZ5B8YNY';
  var YM_ID = 106945185;
  var state = readChoice();
  var banner = null;
  var settingsButton = null;
  var loaded = false;
  var goalsBound = false;

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

  function addStyle() {
    if (!document.getElementById('milovi-contact-polish')) {
      var polish = document.createElement('link');
      polish.id = 'milovi-contact-polish';
      polish.rel = 'stylesheet';
      polish.href = '/css/contact-polish.css?v=20260803r1';
      document.head.appendChild(polish);
    }
    if (document.getElementById('milovi-consent-style')) return;
    var style = document.createElement('style');
    style.id = 'milovi-consent-style';
    style.textContent = [
      '.mc-consent{position:fixed;z-index:2147483000;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(760px,calc(100% - 28px));padding:20px;border:1px solid rgba(201,147,74,.45);border-radius:22px;background:rgba(24,16,10,.97);color:#f5ead9;box-shadow:0 22px 70px rgba(0,0,0,.38);font:400 15px/1.55 Jost,system-ui,sans-serif;backdrop-filter:blur(14px)}',
      '.mc-consent[hidden],.mc-consent-settings[hidden]{display:none!important}.mc-consent__title{margin:0 0 7px;font:500 22px/1.2 "Cormorant Garamond",Georgia,serif}.mc-consent__text{margin:0;color:#d8c7b2}.mc-consent a{color:#e7b875}.mc-consent__actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}',
      '.mc-consent__button{min-height:44px;padding:10px 18px;border-radius:999px;border:1px solid rgba(231,184,117,.45);font:600 14px/1 Jost,system-ui,sans-serif;cursor:pointer}.mc-consent__button--deny{background:transparent;color:#f5ead9}.mc-consent__button--allow{background:#d4a76a;color:#21150d;border-color:#d4a76a}',
      '.mc-consent-settings{position:fixed;z-index:2147482000;right:84px;bottom:max(18px,env(safe-area-inset-bottom));min-height:38px;padding:8px 13px;border-radius:999px;border:1px solid rgba(201,147,74,.45);background:rgba(24,16,10,.9);color:#f5ead9;font:500 12px/1.2 Jost,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2)}',
      '@media(max-width:768px){.mc-consent-settings{left:12px;right:auto;bottom:calc(72px + env(safe-area-inset-bottom,0px))}}',
      '@media(max-width:560px){.mc-consent{padding:17px}.mc-consent__actions{display:grid;grid-template-columns:1fr 1fr}.mc-consent__button{width:100%}}',
      '@media(prefers-reduced-motion:reduce){.mc-consent,.mc-consent-settings{scroll-behavior:auto}}'
    ].join('');
    document.head.appendChild(style);
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

  function setChoice(value) {
    saveChoice(value);
    hideBanner();
    renderSettingsButton();
    if (value === 'granted') {
      loadAnalytics();
      return;
    }
    window['ga-disable-' + GA_ID] = true;
    if (loaded) location.reload();
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
    if (settingsButton) settingsButton.hidden = false;
  }

  function showBanner() {
    addStyle();
    if (!banner) {
      banner = document.createElement('section');
      banner.className = 'mc-consent';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-modal', 'false');
      banner.setAttribute('aria-labelledby', 'mc-consent-title');
      banner.innerHTML = '' +
        '<h2 class="mc-consent__title" id="mc-consent-title">Помочь улучшать сайт?</h2>' +
        '<p class="mc-consent__text">Google Analytics и Яндекс.Метрика загружаются только после вашего согласия. Отказ не ограничивает каталог, корзину и оформление заказа. Подробнее — в <a href="/privacy/">политике конфиденциальности</a>.</p>' +
        '<div class="mc-consent__actions">' +
          '<button class="mc-consent__button mc-consent__button--deny" type="button" data-choice="denied">Без аналитики</button>' +
          '<button class="mc-consent__button mc-consent__button--allow" type="button" data-choice="granted">Разрешить</button>' +
        '</div>';
      banner.addEventListener('click', function (event) {
        var target = event.target.closest('[data-choice]');
        if (target) setChoice(target.getAttribute('data-choice'));
      });
      document.body.appendChild(banner);
    }
    if (settingsButton) settingsButton.hidden = true;
    banner.hidden = false;
    var first = banner.querySelector('[data-choice="denied"]');
    if (first) first.focus({ preventScroll: true });
  }

  function renderSettingsButton() {
    addStyle();
    if (!settingsButton) {
      settingsButton = document.createElement('button');
      settingsButton.type = 'button';
      settingsButton.className = 'mc-consent-settings';
      settingsButton.textContent = 'Конфиденциальность';
      settingsButton.setAttribute('aria-label', 'Изменить настройки аналитики');
      settingsButton.addEventListener('click', showBanner);
      document.body.appendChild(settingsButton);
    }
    settingsButton.hidden = banner ? !banner.hidden : false;
  }

  function init() {
    addStyle();
    bindConversionGoals();
    if (state === 'granted') loadAnalytics();
    if (state) renderSettingsButton();
    else showBanner();
  }

  window.MiloviConsent = {
    open: showBanner,
    getChoice: function () { return state; },
    grant: function () { setChoice('granted'); },
    deny: function () { setChoice('denied'); },
    goal: sendGoal
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
