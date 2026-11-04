'use strict';
// Generated suburb review previews must reuse the existing light-weight images.
// The full-resolution screenshots stay available to openChatLightbox().
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('all suburb review filmstrips use thumbnails without degrading the lightbox', () => {
  const root = path.resolve(__dirname, '..');
  const suburbs = path.join(root, 'prigorody');
  const pages = fs.readdirSync(suburbs, { withFileTypes: true })
    .filter(entry => entry.isDirectory()
      && fs.existsSync(path.join(suburbs, entry.name, 'index.html')))
    .map(entry => path.join(suburbs, entry.name, 'index.html'))
    .sort();

  expect(pages).toHaveLength(14);
  for (const file of [path.join(suburbs, '_template.html'), ...pages]) {
    const html = fs.readFileSync(file, 'utf8');
    for (let i = 1; i <= 8; i++) {
      expect(html, file).toContain('src="../../img/review_' + i + '-thumb.webp"');
      expect(html, file).not.toContain('src="../../img/review_' + i + '.webp"');
      expect(fs.existsSync(path.join(root, 'img', 'review_' + i + '-thumb.webp'))).toBe(true);
      expect(fs.existsSync(path.join(root, 'img', 'review_' + i + '.webp'))).toBe(true);
    }
  }
  const js = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
  expect(js).toContain('const CHAT_SRCS = ');
  for (let i = 1; i <= 8; i++) {
    expect(js).toContain("IMG_BASE + '/review_" + i + ".webp'");
  }
});
