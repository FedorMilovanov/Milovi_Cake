const { test, expect } = require('@playwright/test');

test('all gallery clips show their own lightweight, decodable frame before playback', async ({ page, request }) => {
  await page.goto('/gallery/', { waitUntil: 'domcontentloaded' });
  const reels = await page.evaluate(async () => {
    const { GALLERY_ITEMS } = await import('/js/gallery/data.js?v=20261023r01');
    return GALLERY_ITEMS.filter(({ type }) => type === 'video');
  });
  expect(reels).toHaveLength(16);
  const reviewed = Object.fromEntries(reels.map((item) => [item.id, item]));
  // The real footage shows éclairs, not a meringue roll; the pink cupcakes
  // have buttercream but no visible berries. Filenames/tags are not evidence.
  expect(reviewed.v04.title.toLowerCase()).toContain('эклер');
  expect(reviewed.v04.tags).not.toContain('meringue');
  expect(reviewed.v09.title.toLowerCase()).not.toContain('ягод');
  for (const reel of reels) {
    expect(reel.poster).toBe(reel.src.replace('/videos/', '/').replace('.webm', '-poster.webp'));
    const response = await request.get(reel.poster);
    expect(response.ok(), reel.poster).toBe(true);
    const buffer = await response.body();
    expect(buffer.subarray(0, 4).toString()).toBe('RIFF');
    expect(buffer.subarray(8, 12).toString()).toBe('WEBP');
    expect(buffer.length, reel.poster).toBeLessThan(70_000);
    const dimensions = await page.evaluate((url) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
      image.onerror = reject;
      image.src = url;
    }), reel.poster);
    expect(dimensions[0], reel.poster).toBeGreaterThanOrEqual(320);
    expect(dimensions[1], reel.poster).toBeGreaterThan(dimensions[0]);
  }
  // The public card, not just metadata, must use the real video's own poster.
  const card = page.locator('#galleryGrid [data-id="v01"] video');
  await expect(card).toHaveAttribute('poster', '/img/gallery/video-01-knigi-poster.webp');
});
