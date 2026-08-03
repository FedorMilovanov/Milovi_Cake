#!/usr/bin/env python3
"""Deduplicate the final footer assertion introduced by repeated audit application."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"

text = FORENSIC.read_text(encoding="utf-8")
line_pair = """        const footerVisible = geometry.footer.bottom > 0 && geometry.footer.top < geometry.viewport.height;
        if (!footerVisible) throw new Error(`Footer не доведён в viewport: ${JSON.stringify(geometry)}`);
"""
duplicate = line_pair + line_pair
if duplicate in text:
    text = text.replace(duplicate, line_pair)
elif text.count(line_pair) != 1:
    raise SystemExit(f"round6 source mismatch: footer assertion count={text.count(line_pair)}")
FORENSIC.write_text(text, encoding="utf-8")
print("Applied forensic INDEX round 6")
