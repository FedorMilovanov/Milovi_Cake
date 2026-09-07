const { test, expect } = require('@playwright/test');

function contrastRatio(fg, bg) {
  const luminance = ([r, g, b]) => {
    const linear = [r, g, b].map((value) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function assertContrast(page, selector, minimum = 4.5) {
  const samples = await page.locator(selector).evaluateAll((elements) => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/i);
      if (!match) return [0, 0, 0, 0];
      const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
      return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    };

    const composite = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (alpha === 0) return [255, 255, 255, 0];
      return [
        (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
        (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
        (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
        alpha,
      ];
    };

    const backgroundFor = (element) => {
      const layers = [];
      let node = element;
      while (node) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) layers.push(color);
        if (color[3] >= 0.999) break;
        node = node.parentElement;
      }
      let result = [255, 255, 255, 1];
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        result = composite(layers[index], result);
      }
      return result;
    };

    return elements.map((element) => {
      const style = getComputedStyle(element);
      const foreground = parse(style.color);
      const background = backgroundFor(element);
      return {
        text: (element.textContent || '').trim().slice(0, 80),
        foreground: foreground.slice(0, 3),
        background: background.slice(0, 3),
        opacity: Number.parseFloat(style.opacity || '1'),
      };
    });
  });

  expect(samples.length, `Expected ${selector} to resolve at least one element`).toBeGreaterThan(0);
  for (const sample of samples) {
    expect(sample.opacity, `${selector} (${sample.text}) must not dilute contrast with opacity`).toBe(1);
    const ratio = contrastRatio(sample.foreground, sample.background);
    expect(
      ratio,
      `${selector} (${sample.text}) contrast ${ratio.toFixed(2)}:1, foreground ${sample.foreground.join(',')}, background ${sample.background.join(',')}`,
    ).toBeGreaterThanOrEqual(minimum);
  }
}

async function useLightTheme(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('mc_theme', 'light'); } catch (_) {}
  });
}

test.describe('production-measured contrast regressions', () => {
  test.beforeEach(async ({ page }) => {
    await useLightTheme(page);
  });

  test('homepage measured contrast debt stays WCAG AA', async ({ page }) => {
    await page.goto('/');
    const selectors = [
      '.hero .btn-primary.btn-primary--hero',
      '.about-compact-block p',
      '.vstrip-label span',
      '.calc-opt.selected .opt-label',
      '#calcWeightVal',
      '#fillDescText',
      '.geo-section > .container > p',
      '.cb-section-label span',
      '.cb-ftab:not(.cb-on)',
      '.cb-fl-name',
      '.cb-gluten-badge',
      '.cb-occ-name',
      '.site-footer .footer-brand p.wave-text .w',
      '.site-footer .footer-col h4',
      '.site-footer .footer-address',
      '#fillSheetSelect',
    ];
    for (const selector of selectors) await assertContrast(page, selector);
  });

  test('about-page primary CTAs stay WCAG AA', async ({ page }) => {
    await page.goto('/o-konditere/');
    await assertContrast(page, '.info-btn-primary');
  });

  test('Gatchina warning CTAs stay WCAG AA', async ({ page }) => {
    await page.goto('/prigorody/gatchina/');
    await assertContrast(page, '.btn-primary.btn-warn');
  });
});
