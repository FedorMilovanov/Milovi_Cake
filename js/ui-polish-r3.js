/* Milovi Cake — focused interaction fixes. */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  ready(function () {
    /* Privacy-safe default: no analytics and no automatic blocking dialog.
       Visitors can change the choice later from the footer or mobile “Ещё”. */
    if (window.MiloviConsent && window.MiloviConsent.getChoice() === null) {
      window.MiloviConsent.deny();
    }
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var overlay = document.querySelector('.mc-consent-overlay.is-open:not([hidden])');
      if (!overlay || !window.MiloviConsent) return;
      event.preventDefault();
      event.stopPropagation();
      window.MiloviConsent.close();
    }, true);

    var topButton = document.getElementById('backToTop');
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
        function frame(now) {
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

    var yandexTab = document.getElementById('tabYandex');
    var googleTab = document.getElementById('tabGoogle');
    if (yandexTab && !yandexTab.getAttribute('aria-label')) yandexTab.setAttribute('aria-label', 'Отзывы на Яндекс Картах');
    if (googleTab && !googleTab.getAttribute('aria-label')) googleTab.setAttribute('aria-label', 'Отзывы на Google Картах');

    var weight = document.getElementById('calcWeight');
    if (weight && !weight.getAttribute('aria-label')) weight.setAttribute('aria-label', 'Вес торта в килограммах');
  });
})();
