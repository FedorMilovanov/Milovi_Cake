#!/usr/bin/env python3
"""Round 8: footer/back-to-top clearance, footer contrast, and honest visual captures."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "js" / "main.js"
FIXES = ROOT / "css" / "v20-fixes.css"
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"round8 source mismatch: {label}")


# Product CSS: subtle footer legibility and conditional mobile arrow clearance.
fixes = FIXES.read_text(encoding="utf-8")
css_block = r'''

/* Forensic R81: footer legibility and collision-free back-to-top.
   The footer stays deliberately dark in both themes; only text contrast and
   the arrow's temporary clearance are adjusted. */
.site-footer .footer-bottom {
  color: rgba(235, 215, 187, .66) !important;
}
.site-footer .footer-bottom > span,
.site-footer .footer-bottom > div {
  color: inherit !important;
  opacity: 1 !important;
}
.site-footer .footer-bottom a {
  color: rgba(238, 218, 187, .76) !important;
  opacity: 1 !important;
}
.site-footer .footer-bottom a:hover,
.site-footer .footer-bottom a:focus-visible {
  color: rgba(255, 237, 207, .96) !important;
}
.site-footer .footer-bottom .mc-consent-trigger {
  color: rgba(226, 192, 145, .82) !important;
}
[data-theme="dark"] .site-footer .footer-bottom {
  color: rgba(239, 220, 191, .70) !important;
}
[data-theme="dark"] .site-footer .footer-bottom a {
  color: rgba(241, 220, 188, .80) !important;
}
@media (max-width: 768px) {
  .back-to-top.footer-clearance {
    bottom: calc(188px + env(safe-area-inset-bottom, 0px)) !important;
  }
}
'''
if "Forensic R81: footer legibility" not in fixes:
    fixes = fixes.rstrip() + css_block
FIXES.write_text(fixes, encoding="utf-8")

# Product JS: raise the arrow only while the footer capsule is in the viewport.
main = MAIN.read_text(encoding="utf-8")
js_block = r'''

/* Forensic R81: keep the mobile back-to-top control clear of footer content. */
(function initBackToTopFooterClearance() {
  var button = document.getElementById('backToTop');
  var footerBottom = document.querySelector('.site-footer .footer-bottom');
  if (!button || !footerBottom) return;

  function setClearance(active) {
    button.classList.toggle('footer-clearance', Boolean(active) && window.innerWidth <= 768);
  }

  if (typeof IntersectionObserver === 'function') {
    var observer = new IntersectionObserver(function(entries) {
      setClearance(entries.some(function(entry) { return entry.isIntersecting; }));
    }, { threshold: 0.01 });
    observer.observe(footerBottom);
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768) setClearance(false);
    }, { passive: true });
    return;
  }

  function fallback() {
    var rect = footerBottom.getBoundingClientRect();
    setClearance(rect.bottom > 0 && rect.top < window.innerHeight);
  }
  window.addEventListener('scroll', fallback, { passive: true });
  window.addEventListener('resize', fallback, { passive: true });
  fallback();
})();
'''
if "Forensic R81: keep the mobile back-to-top" not in main:
    main = main.rstrip() + js_block + "\n"
MAIN.write_text(main, encoding="utf-8")

# Audit harness: remove screenshot-only artifacts without altering runtime checks.
forensic = FORENSIC.read_text(encoding="utf-8")
old_style = r'''  await page.addStyleTag({ content: `
    html { scroll-behavior: auto !important; }
    body *, body *::before, body *::after { caret-color: transparent !important; }
  ` });'''
new_style = r'''  await page.addStyleTag({ content: `
    html { scroll-behavior: auto !important; }
    body *, body *::before, body *::after { caret-color: transparent !important; }
    body.forensic-locator-shot #fillPopup:not(.open),
    body.forensic-locator-shot #fillOverlay:not(.open) { display: none !important; }
    @media (max-width: 560px) {
      body.forensic-locator-shot.forensic-hide-calc-panel #calcRightCol:not(.calc-result-open),
      body.forensic-locator-shot.forensic-hide-calc-panel #calcPanelBackdrop:not(.visible) {
        visibility: hidden !important;
      }
    }
  ` });'''
forensic = replace_exact(forensic, old_style, new_style, "capture-only stylesheet")

old_shot = r'''async function shot(locator, name) {
  if (await locator.count() === 0) return false;
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().screenshot({ path: filePath(name), animations: 'disabled' });
  return true;
}'''
new_shot = r'''async function shot(locator, name) {
  if (await locator.count() === 0) return false;
  const page = locator.page();
  const preserveCalc = /calc|cart/i.test(name);
  await page.evaluate(({ hideCalc }) => {
    document.body.classList.add('forensic-locator-shot');
    document.body.classList.toggle('forensic-hide-calc-panel', hideCalc);
  }, { hideCalc: !preserveCalc });
  try {
    await locator.first().scrollIntoViewIfNeeded();
    await locator.first().screenshot({ path: filePath(name), animations: 'disabled' });
  } finally {
    await page.evaluate(() => document.body.classList.remove('forensic-locator-shot', 'forensic-hide-calc-panel'));
  }
  return true;
}'''
forensic = replace_exact(forensic, old_shot, new_shot, "honest locator screenshots")

old_overlap = r'''        if (geometry.top.bottom > geometry.nav.top - 3) throw new Error(`Back-to-top пересекает nav: ${JSON.stringify(geometry)}`);
        const footerVisible = geometry.footer.bottom > 0 && geometry.footer.top < geometry.viewport.height;
        if (!footerVisible) throw new Error(`Footer не доведён в viewport: ${JSON.stringify(geometry)}`);
        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error(`Footer пересекает nav: ${JSON.stringify(geometry)}`);'''
new_overlap = r'''        if (geometry.top.bottom > geometry.nav.top - 3) throw new Error(`Back-to-top пересекает nav: ${JSON.stringify(geometry)}`);
        const footerVisible = geometry.footer.bottom > 0 && geometry.footer.top < geometry.viewport.height;
        if (!footerVisible) throw new Error(`Footer не доведён в viewport: ${JSON.stringify(geometry)}`);
        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error(`Footer пересекает nav: ${JSON.stringify(geometry)}`);
        const arrowFooterOverlap = !(
          geometry.top.right <= geometry.footer.left ||
          geometry.top.left >= geometry.footer.right ||
          geometry.top.bottom <= geometry.footer.top ||
          geometry.top.top >= geometry.footer.bottom
        );
        if (arrowFooterOverlap) throw new Error(`Back-to-top пересекает footer capsule: ${JSON.stringify(geometry)}`);'''
forensic = replace_exact(forensic, old_overlap, new_overlap, "arrow/footer collision assertion")

# Add clean mobile viewport evidence at the exact states users inspect.
old_contact_shots = r'''    await attempt('Скрин контактов dark', async () => shot(page.locator('#contacts'), 'contact-dark-live'));
    await attempt('Скрин footer dark', async () => shot(page.locator('.site-footer .footer-bottom'), 'footer-dark-live'));'''
new_contact_shots = r'''    await attempt('Скрин контактов dark', async () => shot(page.locator('#contacts'), 'contact-dark-live'));
    await attempt('Скрин footer dark', async () => shot(page.locator('.site-footer .footer-bottom'), 'footer-dark-live'));
    if (page.viewportSize().width <= 768) {
      await attempt('Чистый mobile viewport контактов dark', async () => {
        await page.locator('#contacts').scrollIntoViewIfNeeded();
        await page.waitForTimeout(220);
        await page.screenshot({ path: filePath('contact-dark-clean-viewport'), animations: 'allow' });
      });
    }'''
forensic = replace_exact(forensic, old_contact_shots, new_contact_shots, "clean mobile contact viewport")

old_geometry_shot = r'''        evidence.mobileFixedGeometry = geometry;
        await page.screenshot({ path: filePath('mobile-footer-nav-geometry'), animations: 'allow' });'''
new_geometry_shot = r'''        evidence.mobileFixedGeometry = geometry;
        await page.screenshot({ path: filePath('mobile-footer-nav-geometry'), animations: 'allow' });
        await page.screenshot({ path: filePath('mobile-footer-clean-viewport'), animations: 'disabled' });'''
forensic = replace_exact(forensic, old_geometry_shot, new_geometry_shot, "clean mobile footer viewport")

FORENSIC.write_text(forensic, encoding="utf-8")
print("Applied forensic INDEX round 8")
