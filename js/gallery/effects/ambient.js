/* ===========================================================================
 * Ambient Color Extractor
 * Считает средний цвет изображения на маленьком offscreen canvas (16×16).
 * Используется для подсветки фона лайтбокса — эффект Apple TV «ambient halo».
 * --------------------------------------------------------------------------- */

const cache = new Map();

export function extractAmbient(src) {
  if (!src) return Promise.resolve({ r: 28, g: 20, b: 16 });
  if (cache.has(src)) return Promise.resolve(cache.get(src));

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const aa = data[i + 3];
          if (aa < 32) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (n === 0) n = 1;
        const out = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
        cache.set(src, out);
        resolve(out);
      } catch {
        const fallback = { r: 28, g: 20, b: 16 };
        cache.set(src, fallback);
        resolve(fallback);
      }
    };
    img.onerror = () => resolve({ r: 28, g: 20, b: 16 });
    img.src = src;
  });
}
