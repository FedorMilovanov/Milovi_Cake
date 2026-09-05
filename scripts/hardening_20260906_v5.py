#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import hardening_20260906 as h

ROOT = Path(__file__).resolve().parents[1]


def fix_aria_source_aware() -> None:
    contracts = {
        'index.html': (
            ('<input type="hidden" id="calcWeight" value="2" aria-label="Вес торта в килограммах" />', '<input type="hidden" id="calcWeight" value="2" />', True),
            ('<div class="calc-result-collapsed-arrow" aria-label="Подробнее">', '<div class="calc-result-collapsed-arrow" aria-hidden="true">', True),
            ('<span class="calc-approx-badge" id="calcApproxBadge" aria-label="Приблизительная цена">~</span>', '<span class="calc-approx-badge" id="calcApproxBadge" aria-hidden="true">~</span>', True),
        ),
        'prigorody/_template.html': (
            ('<input type="hidden" id="calcWeight" value="2" aria-label="Вес торта в килограммах" />', '<input type="hidden" id="calcWeight" value="2" />', True),
            ('<div class="calc-result-collapsed-arrow" aria-label="Подробнее">', '<div class="calc-result-collapsed-arrow" aria-hidden="true">', True),
            ('<span class="calc-approx-badge" id="calcApproxBadge" aria-label="Приблизительная цена">~</span>', '<span class="calc-approx-badge" id="calcApproxBadge" aria-hidden="true">~</span>', False),
        ),
    }
    for path, items in contracts.items():
        text = h.read(path)
        for bad, good, required in items:
            if bad in text:
                text = text.replace(bad, good, 1)
            elif required and good not in text:
                raise SystemExit(f'{path}: expected accessibility contract not found: {good[:55]}')
        h.write(path, text)


def narrow_ip_copy_source_aware() -> None:
    text = h.read('index.html')
    for old, new in (
        ('детские с персонажами', 'детские с индивидуальным тематическим декором'),
        ('с натуральными ингредиентами, безопасным составом и любимыми персонажами', 'с натуральными ингредиентами, безопасным составом и индивидуальным тематическим декором'),
    ):
        if old not in text:
            raise SystemExit(f'index IP wording not found: {old}')
        text = text.replace(old, new)
    h.write('index.html', text)

    csv_path = 'prigorody/_cities.csv'
    text = h.read(csv_path)
    original = text
    text = text.replace('с любимыми персонажами и тематическим декором', 'с индивидуальным тематическим декором')
    text = text.replace('с персонажами или тематическим декором', 'с индивидуальным тематическим декором')
    if text == original:
        raise SystemExit('suburb CSV: no character-facing commercial wording found')
    h.write(csv_path, text)

    for path, old, new in (
        ('o-konditere/index.html', 'Детские 3D-торты с фигурками и персонажами.', 'Детские 3D-торты с индивидуальным тематическим декором.'),
        ('zakazat-tort-spb/index.html', 'Объёмный торт со сложным декором, фигурками, персонажами и индивидуальной тематикой.', 'Объёмный торт со сложным индивидуальным тематическим декором.'),
    ):
        text = h.read(path)
        if old in text:
            h.write(path, text.replace(old, new))

    path = 'scripts/analytics_contract.py'
    text = h.read(path)
    stale_copy_fix = """    text = text.replace(\n        'с безопасным составом и любимыми персонажами, с безопасным составом и любимыми персонажами',\n        'с безопасным составом и любимыми персонажами',\n    )\n"""
    if stale_copy_fix not in text:
        raise SystemExit('privacy/marketing separation block not found')
    h.write(path, text.replace(stale_copy_fix, '', 1))


original_replace_required = h.replace_required


def replace_required_tree_aware(text: str, old: str, new: str, *, label: str, count: int | None = None) -> str:
    if label.startswith('README replacement: │   ├── protected-interactions.spec') and old not in text:
        actual = '│   └── protected-interactions.spec.js\n│\n└── .github/workflows/'
        if actual not in text:
            raise SystemExit('README tests tree block not found')
        return text.replace(actual, new, 1)
    return original_replace_required(text, old, new, label=label, count=count)


def sync_runtime_revisions() -> None:
    replacements = {
        'final-fixes.css?v=20260728r27': 'final-fixes.css?v=20260815r78',
        'mc-2026.js?v=20260728r27': 'mc-2026.js?v=20260815r78',
    }
    changed = 0
    for path in ROOT.rglob('*.html'):
        if any(part in {'.git', 'node_modules', '_site', 'playwright-report', 'test-results'} for part in path.relative_to(ROOT).parts):
            continue
        text = path.read_text('utf-8')
        updated = text
        for old, new in replacements.items():
            updated = updated.replace(old, new)
        if updated != text:
            path.write_text(updated, 'utf-8')
            changed += 1
    if changed == 0:
        raise SystemExit('expected runtime revision drift was not found')
    print(f'Synchronized exact runtime revisions in {changed} HTML source/generated file(s)')


def document_consent_loader_exception() -> None:
    path = ROOT / 'scripts' / 'release_contract.py'
    text = path.read_text('utf-8')
    needle = "            expected = sw_versions[asset]\n            if actual != expected:\n                errors.append(f'{rel}: {asset} revision {actual or \"<missing>\"} != sw.js {expected}')\n"
    replacement = "            expected = sw_versions[asset]\n            # consent-analytics.js is intentionally versionless in HTML and is forced\n            # through cache:reload by sw.js; its cache policy is not query-revision based.\n            if asset == 'js/consent-analytics.js' and not actual:\n                continue\n            if actual != expected:\n                errors.append(f'{rel}: {asset} revision {actual or \"<missing>\"} != sw.js {expected}')\n"
    if needle not in text:
        raise SystemExit('release contract HTML comparison block not found')
    path.write_text(text.replace(needle, replacement, 1), 'utf-8')


h.fix_aria = fix_aria_source_aware
h.narrow_ip_copy = narrow_ip_copy_source_aware
h.replace_required = replace_required_tree_aware
result = h.main()
sync_runtime_revisions()
document_consent_loader_exception()
raise SystemExit(result)
