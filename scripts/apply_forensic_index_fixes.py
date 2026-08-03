#!/usr/bin/env python3
"""Apply the exact INDEX fixes proven by the forensic audit.

Temporary audit-branch helper. It is intentionally strict and idempotent: every
production replacement must match the audited source exactly, otherwise the run
fails instead of guessing.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
FIXES = ROOT / "css" / "v20-fixes.css"
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"
CSS_FILES = (
    ROOT / "css" / "style.css",
    ROOT / "css" / "mc-2026.css",
    ROOT / "css" / "premium-overrides.css",
    ROOT / "css" / "v20-dark-and-fixes.css",
    ROOT / "css" / "v20-fixes.css",
    ROOT / "css" / "final-fixes.css",
    ROOT / "css" / "gallery" / "gallery-2026.css",
)


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"forensic fix source mismatch: {label}")


index = INDEX.read_text(encoding="utf-8")
for image in ("bento_maxi.webp", "cake_3d.webp", "cake_3d_2.webp"):
    index = replace_exact(
        index,
        f'<link rel="prefetch" href="img/{image}" as="image" />',
        f'<link rel="prefetch" href="img/{image}" />',
        f"valid prefetch {image}",
    )

index = replace_exact(
    index,
    '<div class="calc-result-collapsed-arrow" aria-label="Подробнее">',
    '<div class="calc-result-collapsed-arrow" aria-hidden="true">',
    "decorative calculator arrow",
)
index = replace_exact(
    index,
    '<span class="calc-approx-badge" id="calcApproxBadge" aria-label="Приблизительная цена">~</span>',
    '<span class="calc-approx-badge" id="calcApproxBadge" role="img" aria-label="Приблизительная цена">~</span>',
    "approximate-price semantics",
)
index = replace_exact(
    index,
    '<input type="date" id="cdate" placeholder=" " autocomplete="off" /><label for="cdate">Дата</label>',
    '<input type="date" id="cdate" class="cart-date-input" autocomplete="off" /><label for="cdate">Дата</label>',
    "valid date field",
)
for title in ("Ручная Работа", "Натуральные Ингредиенты", "Свежесть под заказ", "Доставка по СПб"):
    index = replace_exact(index, f"<h4>{title}</h4>", f"<h3>{title}</h3>", f"heading {title}")
INDEX.write_text(index, encoding="utf-8")

# Preserve the exact visual styling after correcting the heading level. The
# selector may live in any approved stylesheet, so migrate every occurrence
# rather than assuming a particular cascade layer.
heading_selectors_found = 0
for css_path in CSS_FILES:
    css = css_path.read_text(encoding="utf-8")
    migrated, count = re.subn(r"(\.feature\s+)h4\b", r"\1h3", css)
    heading_selectors_found += count
    css_path.write_text(migrated, encoding="utf-8")
if heading_selectors_found == 0:
    # Some builds style the card through `.feature` only. That is valid as long
    # as no stale h4-specific selector remains anywhere in the approved CSS.
    stale = [str(path.relative_to(ROOT)) for path in CSS_FILES if re.search(r"\.feature\s+h4\b", path.read_text(encoding="utf-8"))]
    if stale:
        raise SystemExit(f"forensic fix source mismatch: stale feature h4 selectors in {stale}")

fixes = FIXES.read_text(encoding="utf-8")
date_css = r'''

/* Cart date uses the native date picker, which does not support placeholder.
   Keep its label permanently docked to the field contour. */
.cart-form .form-group.float-label .cart-date-input + label {
  top: 0 !important;
  transform: translateY(-50%) scale(.88) !important;
  transform-origin: left center !important;
  padding: 0 7px !important;
  font-size: 12px !important;
  letter-spacing: .025em !important;
}
'''
if "Cart date uses the native date picker" not in fixes:
    fixes = fixes.rstrip() + date_css
FIXES.write_text(fixes, encoding="utf-8")

forensic = FORENSIC.read_text(encoding="utf-8")
old_motion = r'''  await page.addStyleTag({ content: `
    html { scroll-behavior: auto !important; }
    *, *::before, *::after {
      animation-delay: 0s !important;
      animation-duration: 0s !important;
      transition-delay: 0s !important;
      transition-duration: 0s !important;
      caret-color: transparent !important;
    }
  ` });'''
new_motion = r'''  await page.addStyleTag({ content: `
    html { scroll-behavior: auto !important; }
    body *, body *::before, body *::after { caret-color: transparent !important; }
    /* Chromium may omit offscreen content-visibility:auto sections from a fullPage capture.
       This affects audit evidence only; it does not alter production CSS. */
    @media (max-width: 768px) {
      main section, main .content-block, footer.site-footer {
        content-visibility: visible !important;
        contain: none !important;
      }
    }
  ` });'''
forensic = replace_exact(forensic, old_motion, new_motion, "honest screenshot motion/content visibility")
forensic = replace_exact(
    forensic,
    "    test.setTimeout(180000);\n    const mobile = testInfo.project.name.includes('mobile');",
    "    test.setTimeout(240000);\n    page.setDefaultTimeout(7000);\n    page.setDefaultNavigationTimeout(12000);\n    const mobile = testInfo.project.name.includes('mobile');",
    "bounded interaction timeouts",
)
old_reviews = r'''    await attempt('Reviews carousel next/prev', async () => {
      await page.locator('#reviews').scrollIntoViewIfNeeded();
      const current = async () => page.locator('#track .review-slide').evaluateAll((slides) => slides.findIndex((slide) => slide.classList.contains('active')));
      const before = await current();
      await page.locator('#btnNext').click();
      await page.waitForTimeout(650);
      const next = await current();
      if (next === before) throw new Error(`Индекс не изменился: ${before}`);
      await page.locator('#btnPrev').click();
      await page.waitForTimeout(650);
    });'''
new_reviews = r'''    await attempt('Reviews: active card has readable content', async () => {
      await page.locator('#reviews').scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      const state = await page.locator('#track').evaluate((track) => {
        const active = track.querySelector('.review-slide.active') || track.querySelector('.review-slide');
        if (!active) return null;
        const style = getComputedStyle(active);
        const text = (active.innerText || '').trim();
        return { text, opacity: Number(style.opacity), visibility: style.visibility, display: style.display };
      });
      await page.screenshot({ path: filePath('reviews-live-viewport'), animations: 'allow' });
      if (!state || state.text.length < 20 || state.opacity < .5 || state.visibility === 'hidden' || state.display === 'none') {
        throw new Error(`Review state: ${JSON.stringify(state)}`);
      }
      return state;
    });
    await attempt('Reviews carousel next/prev', async () => {
      const current = async () => page.locator('#track .review-slide').evaluateAll((slides) => slides.findIndex((slide) => slide.classList.contains('active')));
      const before = await current();
      await page.locator('#btnNext').click();
      await page.waitForTimeout(650);
      const next = await current();
      if (next === before) throw new Error(`Индекс не изменился: ${before}`);
      await page.locator('#btnPrev').click();
      await page.waitForTimeout(650);
    });'''
forensic = replace_exact(forensic, old_reviews, new_reviews, "live review readability")
old_full = "      await attempt(`${theme}: полный скриншот`, async () => page.screenshot({ path: filePath(`${theme}-index-full`), fullPage: true, animations: 'disabled' }));"
new_full = "      await attempt(`${theme}: полный скриншот`, async () => page.screenshot({ path: filePath(`${theme}-index-full`), fullPage: true, animations: 'allow' }));"
forensic = replace_exact(forensic, old_full, new_full, "full page screenshot")
FORENSIC.write_text(forensic, encoding="utf-8")

print("Applied deterministic forensic INDEX fixes")
