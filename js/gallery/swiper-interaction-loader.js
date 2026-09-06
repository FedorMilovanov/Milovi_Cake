(function () {
  'use strict';

  const SWIPER_SRC = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
  let loading = false;

  function detach() {
    document.removeEventListener('pointerdown', maybeLoad, true);
    document.removeEventListener('focusin', maybeLoad, true);
    document.removeEventListener('click', maybeLoad, true);
  }

  function loadSwiper() {
    if (window.Swiper) {
      detach();
      return;
    }
    if (loading) return;

    loading = true;
    const script = document.createElement('script');
    script.src = SWIPER_SRC;
    script.async = true;
    script.dataset.gallerySwiper = 'interaction';
    script.addEventListener('load', detach, { once: true });
    script.addEventListener('error', function () {
      loading = false;
      script.remove();
    }, { once: true });
    document.head.appendChild(script);
  }

  function maybeLoad(event) {
    const target = event.target;
    if (target instanceof Element && target.closest('#galleryGrid .card')) loadSwiper();
  }

  document.addEventListener('pointerdown', maybeLoad, true);
  document.addEventListener('focusin', maybeLoad, true);
  document.addEventListener('click', maybeLoad, true);
})();
