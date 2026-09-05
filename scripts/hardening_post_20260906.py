#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'scripts' / 'audit.py'

text = AUDIT.read_text('utf-8')

layout_entry = '    "tests/layout-matrix.spec.js",\n'
if layout_entry not in text:
    anchor = '    "tests/overlap-smoke.spec.js",\n'
    if anchor not in text:
        raise SystemExit('DEV_TOOLING_JS overlap anchor not found')
    text = text.replace(anchor, anchor + layout_entry, 1)

css_paths = [
    'css/premium-overrides.css',
    'css/v20-dark-and-fixes.css',
    'css/mc-2026.css',
    'css/style.css',
    'css/final-fixes.css',
    'css/gallery/gallery-2026.css',
    'css/v20-fixes.css',
]
counts = {path: (ROOT / path).read_text('utf-8').count('!important') for path in css_paths}

budget_match = re.search(r'IMPORTANT_BUDGET = \{\n(.*?)\n\}', text, re.S)
if not budget_match:
    raise SystemExit('IMPORTANT_BUDGET block not found')
lines = ['IMPORTANT_BUDGET = {']
for path in css_paths:
    suffix = ''
    if path == 'css/gallery/gallery-2026.css':
        suffix = '  # dark-theme active-chip override baseline'
    lines.append(f'    "{path}": {counts[path]},{suffix}')
lines.append('}')
text = text[:budget_match.start()] + '\n'.join(lines) + text[budget_match.end():]

warning = '            R.warn(f"!important budget exceeded: {item}")'
error = '            R.err(f"!important budget exceeded: {item}")'
if warning in text:
    text = text.replace(warning, error, 1)
elif error not in text:
    raise SystemExit('!important enforcement line not found')

AUDIT.write_text(text, 'utf-8')
print('Audit hardening applied: layout matrix allowlisted; !important baseline exact and fail-closed')
print('!important baseline:', counts)
