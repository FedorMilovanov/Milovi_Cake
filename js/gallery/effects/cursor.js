/* ===========================================================================
 * Magnetic Spotlight Cursor
 * – Кастомный курсор с пружинной интерполяцией
 * – Магнитится к центру наведённой карточки .gx-cell
 * – Расширяется + показывает подпись «СМОТРЕТЬ»
 * – mix-blend-mode: difference для премиум-инверсии
 * - Disabled on touch / reduced motion (вызов уже отгорожен в main.js)
 * --------------------------------------------------------------------------- */

export function initMagneticCursor() {
  const dot = document.createElement('div');
  dot.className = 'gx-cursor';
  dot.innerHTML = '<span class="gx-cursor-label">Смотреть</span>';
  document.body.appendChild(dot);

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let cx = mx, cy = my;
  let magnetTarget = null;
  let raf = 0;

  const SPRING = 0.18;
  const MAGNET_PULL = 0.45;

  function tick() {
    let tx = mx, ty = my;
    if (magnetTarget) {
      const r = magnetTarget.getBoundingClientRect();
      const cxT = r.left + r.width / 2;
      const cyT = r.top  + r.height / 2;
      tx = mx + (cxT - mx) * MAGNET_PULL;
      ty = my + (cyT - my) * MAGNET_PULL;
    }
    cx += (tx - cx) * SPRING;
    cy += (ty - cy) * SPRING;
    dot.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    raf = requestAnimationFrame(tick);
  }

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(tick);
    dot.classList.add('visible');
  }, { passive: true });

  document.addEventListener('mouseleave', () => dot.classList.remove('visible'));

  document.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.gx-cell');
    if (cell) {
      magnetTarget = cell;
      dot.classList.add('hover');
    }
    if (e.target.closest('a, button, input, [role="button"]') && !cell) {
      dot.classList.add('hover-mini');
    }
  });
  document.addEventListener('mouseout', (e) => {
    const cell = e.target.closest('.gx-cell');
    if (cell && !e.relatedTarget?.closest?.('.gx-cell')) {
      magnetTarget = null;
      dot.classList.remove('hover');
    }
    if (e.target.closest('a, button, input, [role="button"]') &&
        !e.relatedTarget?.closest?.('a, button, input, [role="button"]')) {
      dot.classList.remove('hover-mini');
    }
  });

  document.documentElement.classList.add('gx-has-cursor');
}
