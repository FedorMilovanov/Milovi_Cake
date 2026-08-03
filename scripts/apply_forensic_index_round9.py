#!/usr/bin/env python3
"""Round 9: make review content readable throughout the decorative assembly animation."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "js" / "main.js"

text = MAIN.read_text(encoding="utf-8")

replacements = [
    (
        """      el.style.opacity = '0'; el.style.transform = `translate(${fromX}px, ${fromY}px) rotate(${fromR}deg) scale(${fromS})`;""",
        """      /* Forensic R82: the decorative assembly must never make review copy
         unreadable. Motion and blur remain; opacity no longer drops to zero. */
      el.style.opacity = '1'; el.style.transform = `translate(${fromX}px, ${fromY}px) rotate(${fromR}deg) scale(${fromS})`;""",
        "review initial opacity",
    ),
    (
        """        el.style.opacity = String(Math.min(raw * 3, 1).toFixed(3));""",
        """        el.style.opacity = '1';""",
        "review animated opacity",
    ),
    (
        """    const emojiEls = Array.from(txtEl.querySelectorAll('.pl-emoji'));
    const animStart = performance.now();""",
        """    const emojiEls = Array.from(txtEl.querySelectorAll('.pl-emoji'));
    emojiEls.forEach((el) => { el.style.opacity = '1'; });
    const animStart = performance.now();""",
        "emoji readable start",
    ),
    (
        """        em.style.opacity = String(Math.min(p * 5, 1).toFixed(3));""",
        """        em.style.opacity = '1';""",
        "emoji animated opacity",
    ),
]

for old, new, label in replacements:
    if old in text:
        text = text.replace(old, new)
    elif new not in text:
        raise SystemExit(f"round9 source mismatch: {label}")

MAIN.write_text(text, encoding="utf-8")
print("Applied forensic INDEX round 9")
