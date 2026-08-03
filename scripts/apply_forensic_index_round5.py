#!/usr/bin/env python3
"""Correct the final calculator stacking selector and audit hit-test."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXES = ROOT / "css" / "v20-fixes.css"
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"

fixes = FIXES.read_text(encoding="utf-8")
old = """/* Forensic R79: the mobile calculator result is intentionally a fixed panel.
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
"""
new = """/* Forensic R79: the mobile calculator result is intentionally a fixed panel.
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
"""
if old in fixes:
    fixes = fixes.replace(old, new)
elif new not in fixes:
    raise SystemExit("round5 source mismatch: calculator stacking block")
FIXES.write_text(fixes, encoding="utf-8")

forensic = FORENSIC.read_text(encoding="utf-8")
old_lines = """              calculatorZ: getComputedStyle(document.getElementById('calculator')).zIndex,
              panelZ: getComputedStyle(el.closest('.calc-right-col')).zIndex,"""
new_lines = """              calculatorZ: document.getElementById('fillings') ? getComputedStyle(document.getElementById('fillings')).zIndex : null,
              panelZ: el.closest('.calc-right-col') ? getComputedStyle(el.closest('.calc-right-col')).zIndex : null,"""
if old_lines in forensic:
    forensic = forensic.replace(old_lines, new_lines)
elif new_lines not in forensic:
    raise SystemExit("round5 source mismatch: calculator hit-test")
FORENSIC.write_text(forensic, encoding="utf-8")
print("Applied forensic INDEX round 5")
