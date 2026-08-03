#!/usr/bin/env python3
"""Round 12: keep outgoing reviews readable and tolerate incidental mobile scroll on panel open."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "js" / "main.js"
text = MAIN.read_text(encoding="utf-8")


def replace_exact(old: str, new: str, label: str) -> None:
    global text
    if old in text:
        text = text.replace(old, new)
    elif new not in text:
        raise SystemExit(f"round12 source mismatch: {label}")


replace_exact(
    """const raw = Math.min(local/SHATTER_DUR, 1); if(raw < 1) done = false; const p = raw*raw; d.el.style.opacity = String(Math.max(0,1-raw*2)); d.el.style.filter = `blur(${(raw*4).toFixed(2)}px)`;""",
    """const raw = Math.min(local/SHATTER_DUR, 1); if(raw < 1) done = false; const p = raw*raw; d.el.style.opacity = '1'; d.el.style.filter = `blur(${(raw*4).toFixed(2)}px)`;""",
    "readable outgoing review",
)

replace_exact(
    """  const isOpen = col.classList.toggle('calc-result-open');
  _setCalcBackdrop(isOpen);""",
    """  const isOpen = col.classList.toggle('calc-result-open');
  if (isOpen) col.dataset.openScrollY = String(window.scrollY);
  else delete col.dataset.openScrollY;
  _setCalcBackdrop(isOpen);""",
    "calculator open scroll anchor",
)

replace_exact(
    """  if (col) col.classList.remove('calc-result-open');
  _setCalcBackdrop(false);""",
    """  if (col) {
    col.classList.remove('calc-result-open');
    delete col.dataset.openScrollY;
  }
  _setCalcBackdrop(false);""",
    "calculator close scroll anchor",
)

replace_exact(
    """window.addEventListener('scroll', function() { if (window.innerWidth > 560) return; const col = document.getElementById('calcRightCol'); if (col && col.classList.contains('calc-result-open')) closeCalcPanel(); }, { passive: true });""",
    """window.addEventListener('scroll', function() {
  if (window.innerWidth > 560) return;
  const col = document.getElementById('calcRightCol');
  if (!col || !col.classList.contains('calc-result-open')) return;
  const openedAt = Number(col.dataset.openScrollY || window.scrollY);
  /* A tap can trigger a tiny browser alignment scroll. Close only after a
     deliberate page movement, not on the incidental scroll caused by opening. */
  if (Math.abs(window.scrollY - openedAt) > 72) closeCalcPanel();
}, { passive: true });""",
    "calculator deliberate scroll close",
)

MAIN.write_text(text, encoding="utf-8")
print("Applied forensic INDEX round 12")
