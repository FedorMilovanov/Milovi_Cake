#!/usr/bin/env python3
"""Final forensic pass: fix mobile calculator stacking and verify footer at the real page end."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXES = ROOT / "css" / "v20-fixes.css"
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"round4 source mismatch: {label}")


fixes = FIXES.read_text(encoding="utf-8")
stack_css = r'''

/* Forensic R79: the mobile calculator result is intentionally a fixed panel.
   The calculator section must own a stacking context above later page sections;
   otherwise contact fields can visually cover and intercept its controls. */
@media (max-width: 560px) {
  #calculator {
    position: relative;
    z-index: 103;
  }
  #calculator .calc-right-col {
    z-index: 104 !important; /* important: matches the established mobile layer contract */
    isolation: isolate;
  }
}
'''
if "Forensic R79: the mobile calculator result" not in fixes:
    fixes = fixes.rstrip() + stack_css
FIXES.write_text(fixes, encoding="utf-8")

forensic = FORENSIC.read_text(encoding="utf-8")
old_calc_open = r'''        if (!(await panel.evaluate((el) => el.classList.contains('calc-result-open')))) {
          await page.locator('#calcCollapsedBar').click();
          await page.waitForTimeout(480);
        }'''
new_calc_open = r'''        if (!(await panel.evaluate((el) => el.classList.contains('calc-result-open')))) {
          const bar = page.locator('#calcCollapsedBar');
          const hit = await bar.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const top = document.elementFromPoint(x, y);
            return {
              bar: rect.toJSON(),
              topElement: top ? (top.id ? `#${top.id}` : `${top.tagName.toLowerCase()}.${Array.from(top.classList).slice(0,3).join('.')}`) : null,
              calculatorZ: getComputedStyle(document.getElementById('calculator')).zIndex,
              panelZ: getComputedStyle(el.closest('.calc-right-col')).zIndex,
            };
          });
          evidence.mobileCalculatorHitTest = hit;
          await bar.click();
          await page.waitForTimeout(480);
        }'''
forensic = replace_exact(forensic, old_calc_open, new_calc_open, "calculator hit-test evidence")
old_back_start = r'''    await attempt('Back-to-top и mobile fixed geometry', async () => {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(220);
      if (!(await page.locator('#backToTop').isVisible())) throw new Error('Back-to-top не виден');
      if (mobile) {'''
new_back_start = r'''    await attempt('Back-to-top и mobile fixed geometry', async () => {
      for (let pass = 0; pass < 5; pass += 1) {
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(240);
      }
      if (!(await page.locator('#backToTop').isVisible())) throw new Error('Back-to-top не виден');
      if (mobile) {
        await page.locator('.site-footer .footer-bottom').scrollIntoViewIfNeeded();
        await page.waitForTimeout(420);'''
forensic = replace_exact(forensic, old_back_start, new_back_start, "real footer endpoint")
old_footer_assert = r'''        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error(`Footer пересекает nav: ${JSON.stringify(geometry)}`);'''
new_footer_assert = r'''        const footerVisible = geometry.footer.bottom > 0 && geometry.footer.top < geometry.viewport.height;
        if (!footerVisible) throw new Error(`Footer не доведён в viewport: ${JSON.stringify(geometry)}`);
        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error(`Footer пересекает nav: ${JSON.stringify(geometry)}`);'''
forensic = replace_exact(forensic, old_footer_assert, new_footer_assert, "footer visibility assertion")
FORENSIC.write_text(forensic, encoding="utf-8")

print("Applied forensic INDEX round 4")
