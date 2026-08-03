#!/usr/bin/env python3
"""Round 11: deduplicate the footer test and verify arrow restoration before clicking."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"
text = FORENSIC.read_text(encoding="utf-8")

shot = "        await page.screenshot({ path: filePath('mobile-footer-clean-viewport'), animations: 'disabled' });\n"
while text.count(shot) > 1:
    text = text.replace(shot + shot, shot)

block = """        const arrowFooterOverlap = !(
          geometry.top.right <= geometry.footer.left ||
          geometry.top.left >= geometry.footer.right ||
          geometry.top.bottom <= geometry.footer.top ||
          geometry.top.top >= geometry.footer.bottom
        );
        const arrowInteractive = geometry.topOpacity > .05 && geometry.topPointerEvents !== 'none';
        if (arrowFooterOverlap && arrowInteractive) throw new Error(`Back-to-top пересекает footer capsule: ${JSON.stringify(geometry)}`);
        if (!String(geometry.topClasses).includes('footer-clearance')) throw new Error(`Footer clearance state не включился: ${JSON.stringify(geometry)}`);
        if (geometry.topOpacity > .05 || geometry.topPointerEvents !== 'none') throw new Error(`Стрелка не скрылась у footer: ${JSON.stringify(geometry)}`);
"""
while text.count(block) > 1:
    text = text.replace(block + block, block)
if text.count(block) != 1:
    raise SystemExit(f"round11 source mismatch: footer block count={text.count(block)}")

old_click = """      }
      await page.locator('#backToTop').click();
      const deadline = Date.now() + 4500;"""
new_click = """      }
      if (mobile) {
        await page.evaluate(() => scrollBy(0, -Math.max(innerHeight * .85, 520)));
        await page.waitForTimeout(360);
        const restored = await page.locator('#backToTop').evaluate((el) => ({
          opacity: Number(getComputedStyle(el).opacity),
          pointerEvents: getComputedStyle(el).pointerEvents,
          classes: el.className,
        }));
        if (restored.opacity < .8 || restored.pointerEvents === 'none' || String(restored.classes).includes('footer-clearance')) {
          throw new Error(`Back-to-top не восстановился после ухода от footer: ${JSON.stringify(restored)}`);
        }
      }
      await page.locator('#backToTop').click();
      const deadline = Date.now() + 4500;"""
if old_click in text:
    text = text.replace(old_click, new_click)
elif new_click not in text:
    raise SystemExit("round11 source mismatch: restored arrow click")

FORENSIC.write_text(text, encoding="utf-8")
print("Applied forensic INDEX round 11")
