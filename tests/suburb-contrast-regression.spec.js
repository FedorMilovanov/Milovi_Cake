const { test, expect } = require('@playwright/test');

function linearize(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return (0.2126 * linearize(r)) + (0.7152 * linearize(g)) + (0.0722 * linearize(b));
}

function contrastRatio(foreground, background) {
  const front = luminance(foreground);
  const back = luminance(background);
  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

function parseRgb(value) {
  const match = String(value).match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

test('Gatchina selected calculator labels stay WCAG AA in light theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mc_theme', 'light'));
  await page.goto('/prigorody/gatchina/', { waitUntil: 'domcontentloaded' });

  const labels = page.locator('.prigorody-page .calc-options:not(#calcDecor) .calc-opt.selected .opt-label');
  await expect(labels).toHaveCount(2);

  const samples = await labels.evaluateAll((nodes) => nodes.map((node) => {
    const foreground = getComputedStyle(node).color;
    let current = node;
    let background = 'rgba(0, 0, 0, 0)';
    while (current) {
      const candidate = getComputedStyle(current).backgroundColor;
      if (candidate && !/rgba?\(\s*0[, ]+\s*0[, ]+\s*0(?:\s*[,/]\s*0(?:\.0+)?)?\s*\)/i.test(candidate)) {
        background = candidate;
        break;
      }
      current = current.parentElement;
    }
    return { text: (node.textContent || '').trim(), foreground, background };
  }));

  for (const sample of samples) {
    const foreground = parseRgb(sample.foreground);
    const background = parseRgb(sample.background);
    expect(foreground, `foreground for ${sample.text}`).not.toBeNull();
    expect(background, `background for ${sample.text}`).not.toBeNull();
    const ratio = contrastRatio(foreground, background);
    expect(ratio, `${sample.text}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
});
