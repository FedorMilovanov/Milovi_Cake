#!/usr/bin/env python3
"""Round 10: hide back-to-top at the footer instead of moving it over preceding content."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXES = ROOT / "css" / "v20-fixes.css"
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"round10 source mismatch: {label}")


fixes = FIXES.read_text(encoding="utf-8")
old_arrow = r'''@media (max-width: 768px) {
  .back-to-top.footer-clearance {
    bottom: calc(188px + env(safe-area-inset-bottom, 0px)) !important;
  }
}'''
new_arrow = r'''@media (max-width: 768px) {
  /* At the final footer there is no collision-free floating position. Hide the
     redundant shortcut there and restore it automatically when scrolling up. */
  .back-to-top.footer-clearance {
    opacity: 0 !important;
    pointer-events: none !important;
    transform: translateY(10px) scale(.90) !important;
  }
}'''
fixes = replace_exact(fixes, old_arrow, new_arrow, "footer arrow behavior")

old_contrast = r'''.site-footer .footer-bottom {
  color: rgba(235, 215, 187, .66) !important;
}'''
new_contrast = r'''.site-footer .footer-bottom {
  color: rgba(241, 222, 194, .80) !important;
}'''
fixes = replace_exact(fixes, old_contrast, new_contrast, "footer base contrast")
fixes = fixes.replace(
    "color: rgba(239, 220, 191, .70) !important;",
    "color: rgba(243, 224, 196, .82) !important;",
)
FIXES.write_text(fixes, encoding="utf-8")

forensic = FORENSIC.read_text(encoding="utf-8")
old_geometry = r'''          return {
            nav: nav.toJSON(),
            top: top.toJSON(),
            footer: footer.toJSON(),
            siteFooter: siteFooter.getBoundingClientRect().toJSON(),'''
new_geometry = r'''          const topStyle = getComputedStyle(topEl);
          return {
            nav: nav.toJSON(),
            top: top.toJSON(),
            topOpacity: Number(topStyle.opacity),
            topPointerEvents: topStyle.pointerEvents,
            topClasses: topEl.className,
            footer: footer.toJSON(),
            siteFooter: siteFooter.getBoundingClientRect().toJSON(),'''
forensic = replace_exact(forensic, old_geometry, new_geometry, "footer control evidence")

old_overlap = r'''        const arrowFooterOverlap = !(
          geometry.top.right <= geometry.footer.left ||
          geometry.top.left >= geometry.footer.right ||
          geometry.top.bottom <= geometry.footer.top ||
          geometry.top.top >= geometry.footer.bottom
        );
        if (arrowFooterOverlap) throw new Error(`Back-to-top пересекает footer capsule: ${JSON.stringify(geometry)}`);'''
new_overlap = r'''        const arrowFooterOverlap = !(
          geometry.top.right <= geometry.footer.left ||
          geometry.top.left >= geometry.footer.right ||
          geometry.top.bottom <= geometry.footer.top ||
          geometry.top.top >= geometry.footer.bottom
        );
        const arrowInteractive = geometry.topOpacity > .05 && geometry.topPointerEvents !== 'none';
        if (arrowFooterOverlap && arrowInteractive) throw new Error(`Back-to-top пересекает footer capsule: ${JSON.stringify(geometry)}`);
        if (!String(geometry.topClasses).includes('footer-clearance')) throw new Error(`Footer clearance state не включился: ${JSON.stringify(geometry)}`);
        if (geometry.topOpacity > .05 || geometry.topPointerEvents !== 'none') throw new Error(`Стрелка не скрылась у footer: ${JSON.stringify(geometry)}`);'''
forensic = replace_exact(forensic, old_overlap, new_overlap, "hidden arrow assertion")
FORENSIC.write_text(forensic, encoding="utf-8")

print("Applied forensic INDEX round 10")
