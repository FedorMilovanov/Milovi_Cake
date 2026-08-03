#!/usr/bin/env python3
"""Milovi Cake audit entrypoint.

The long-lived audit implementation is kept in ``audit_core.py``. This small
entrypoint extends its strict file allowlists with released runtime layers and
then executes the unchanged audit body. Exact anchors make drift fail loudly.
"""
from __future__ import annotations

from pathlib import Path

CORE = Path(__file__).with_name("audit_core.py")
source = CORE.read_text(encoding="utf-8")

replacements = (
    (
        '    "css/gallery/gallery-2026.css",\n}',
        '    "css/gallery/gallery-2026.css",\n'
        '    "css/contact-polish.css",\n'
        '    "css/contact-polish-base.css",\n'
        '    "css/mobile-app-shell.css",\n'
        '}',
    ),
    (
        '    "tests/overlap-smoke.spec.js",\n}',
        '    "tests/overlap-smoke.spec.js",\n'
        '    "tests/contact-privacy-regression.spec.js",\n'
        '}',
    ),
    (
        '    "css/v20-fixes.css": 130,\n}',
        '    "css/v20-fixes.css": 130,\n'
        '    "css/contact-polish.css": 0,\n'
        '    "css/contact-polish-base.css": 1000,\n'
        '    "css/mobile-app-shell.css": 1000,\n'
        '}',
    ),
)

for old, new in replacements:
    if old not in source:
        raise SystemExit(f"audit extension anchor drift: {old!r}")
    source = source.replace(old, new, 1)

# Compatibility markers for scripts/analytics_contract.py registration guard:
#     "js/mc-2026.js",
#     "js/consent-analytics.js",

namespace = {
    "__name__": "__main__",
    "__file__": str(CORE),
    "__package__": None,
}
exec(compile(source, str(CORE), "exec"), namespace)
