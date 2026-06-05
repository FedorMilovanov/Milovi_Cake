const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, 'tests', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  // Light — catalog section
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
  await page.waitForTimeout(800);
  const catalog = await page.$('#catalog');
  if (catalog) await catalog.screenshot({ path: path.join(outDir, 'mobile-catalog-light.png') });

  // Dark — catalog section
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  await page.waitForTimeout(600);
  const catalogDark = await page.$('#catalog');
  if (catalogDark) await catalogDark.screenshot({ path: path.join(outDir, 'mobile-catalog-dark.png') });

  // Light — hero close-up
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'mobile-hero-light.png'), clip: { x: 0, y: 0, width: 390, height: 500 } });

  // Dark — hero close-up
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'mobile-hero-dark.png'), clip: { x: 0, y: 0, width: 390, height: 500 } });

  await browser.close();
  console.log('✅ Detail screenshots captured');
})();
