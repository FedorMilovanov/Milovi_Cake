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
old_stack_css = r'''

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
stack_css = r'''

/* Forensic R79: the mobile calculator result is intentionally a fixed panel.
   The real calculator section is #fillings; it must own a stacking context above
   later page sections so contact fields cannot cover or intercept its controls. */
@media (max-width: 560px) {
  #fillings {
    position: relative;
    z-index: 103;
  }
  #fillings .calc-right-col {
    z-index: 104 !important; /* important: matches the established mobile layer contract */
    isolation: isolate;
  }
}
'''
if old_stack_css in fixes:
    fixes = fixes.replace(old_stack_css, stack_css)
elif "The real calculator section is #fillings" not in fixes:
    fixes = fixes.rstrip() + stack_css
FIXES.write_text(fixes, encoding="utf-8")

forensic = FORENSIC.read_text(encoding="utf-8")n
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
            const section = document.getElementById('fillings');
            const panelElement = el.closest('.calc-right-col');
            return {
              bar: rect.toJSON(),
              topElement: top ? (top.id ? `#${top.id}` : `${top.tagName.toLowerCase()}.${Array.from(top.classList).slice(0,3).join('.')}`) : null,
              calculatorZ: section ? getComputedStyle(section).zIndex : null,
              panelZ: panelElement ? getComputedStyle(panelElement).zIndex : null,
            };
          });
          evidence.mobileCalculatorHitTest = hit;
          await bar.click();
          await page.waitForTimeout(480);
        }'''
if old_calc_open in forensic:
    forensic = forensic.replace(old_calc_open, new_calc_open)
else:
    forensic = replace_exact(
        forensic,
        "              calculatorZ: getComputedStyle(document.getElementById('calculator')).zIndex,\n              panelZ: getComputedStyle(el.closest('.calc-right-col')).zIndex,",
        "              calculatorZ: document.getElementById('fillings') ? getComputedStyle(document.getElementById('fillings')).zIndex : null,\n              panelZ: el.closest('.calc-right-col') ? getComputedStyle(el.closest('.calc-right-col')).zIndex : null,",
        "calculator hit-test real section",
    )
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
if old_back_start in forensic:
    forensic = forensic.replace(old_back_start, new_back_start)
old_footer_assert = r'''        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error(`Footer пересекает nav: ${JSON.stringify(geometry)}`);'''
new_footer_assert = r'''        const footerVisible = geometry.footer.bottom > 0 && geometry.footer.top < geometry.viewport.height;
        if (!footerVisible) throw new Error(`Footer не доведён в viewport: ${JSON.stringify(geometry)}`);
        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error(`Footer пересекает nav: ${JSON.stringify(geometry)}`);'''
if old_footer_assert in forensic:
    forensic = forensic.replace(old_footer_assert, new_footer_assert)
FORENSIC.write_text(forensic, encoding="utf-8")

print("Applied forensic INDEX round 4")
