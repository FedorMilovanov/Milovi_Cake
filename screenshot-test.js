const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, 'tests', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const configs = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
];

const themes = ['light', 'dark'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const theme of themes) {
    for (const cfg of configs) {
      await page.setViewportSize({ width: cfg.width, height: cfg.height });
      await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        try { localStorage.setItem('mc_theme', t); } catch(e){}
      }, theme);
      await page.waitForTimeout(600); // let transitions settle
      const screenshotPath = path.join(outDir, `index-${cfg.name}-${theme}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('✅', screenshotPath);
    }
  }

  await browser.close();
  console.log('\n🎉 All screenshots captured');
})();
