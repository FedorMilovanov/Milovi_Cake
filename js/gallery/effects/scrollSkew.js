/* ===========================================================================
 * Scroll-Velocity Distortion
 * – Карточки галереи слегка скашиваются (skewY) и масштабируются по
 *   вертикальной перспективе пропорционально скорости скролла.
 * – Возврат — пружинный, через requestAnimationFrame.
 * – Capped, чтобы не вызывать укачивания.
 * --------------------------------------------------------------------------- */

export function initScrollSkew(_selector) {
  let lastY = window.scrollY;
  let velocity = 0;
  let smoothed = 0;
  let ticking = false;
  const MAX_SKEW = 6;
  const MAX_SCALE = 0.025;
  const VELOCITY_DIVISOR = 90;

  function onScroll() {
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    velocity = Math.max(-MAX_SKEW * VELOCITY_DIVISOR,
                Math.min( MAX_SKEW * VELOCITY_DIVISOR, dy));
    if (!ticking) { ticking = true; requestAnimationFrame(loop); }
  }

  function loop() {
    smoothed += (velocity - smoothed) * 0.18;
    velocity *= 0.82;

    const skew  = Math.max(-MAX_SKEW,  Math.min(MAX_SKEW,  smoothed / VELOCITY_DIVISOR));
    const scale = 1 - Math.min(MAX_SCALE, Math.abs(smoothed) / (VELOCITY_DIVISOR * 220));

    document.documentElement.style.setProperty('--gx-skew', `${skew.toFixed(2)}deg`);
    document.documentElement.style.setProperty('--gx-scale', scale.toFixed(4));

    if (Math.abs(smoothed) > 0.5 || Math.abs(velocity) > 0.5) {
      requestAnimationFrame(loop);
    } else {
      ticking = false;
      document.documentElement.style.setProperty('--gx-skew', '0deg');
      document.documentElement.style.setProperty('--gx-scale', '1');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
}
