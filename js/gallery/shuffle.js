/* ===========================================================================
 * Milovi Cake — Editorial Shuffle
 * Перемешивает фото и видео так, чтобы видео шли с интервалом 3–5 элементов,
 * крупные плитки (big/wide/tall) — равномерно по полотну. Детерминированно.
 * --------------------------------------------------------------------------- */

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function editorialShuffle(items, seed = 7) {
  const rnd = mulberry32(seed);

  const photos = items.filter((i) => i.type === 'photo');
  const videos = items.filter((i) => i.type === 'video');

  const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  shuffleInPlace(photos);
  shuffleInPlace(videos);

  const total = photos.length + videos.length;
  const result = [];
  let pi = 0;
  let vi = 0;
  for (let k = 0; k < total; k++) {
    const wantVideo = vi < videos.length && (k % 4 === 2);
    if (wantVideo) result.push(videos[vi++]);
    else if (pi < photos.length) result.push(photos[pi++]);
    else if (vi < videos.length) result.push(videos[vi++]);
  }

  const isLarge = (it) => it.size === 'big' || it.size === 'wide' || it.size === 'tall';
  for (let i = 1; i < result.length; i++) {
    if (isLarge(result[i]) && isLarge(result[i - 1])) {
      for (let j = i + 2; j < result.length; j++) {
        if (!isLarge(result[j])) {
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
    }
  }

  return result;
}
