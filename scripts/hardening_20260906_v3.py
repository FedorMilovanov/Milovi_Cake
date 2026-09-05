#!/usr/bin/env python3
from __future__ import annotations

import hardening_20260906 as h


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
    replacements = (
        ('детские с персонажами', 'детские с индивидуальным тематическим декором'),
        ('с натуральными ингредиентами, безопасным составом и любимыми персонажами', 'с натуральными ингредиентами, безопасным составом и индивидуальным тематическим декором'),
    )
    for old, new in replacements:
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
            text = text.replace(old, new)
            h.write(path, text)

    path = 'scripts/analytics_contract.py'
    text = h.read(path)
    stale_copy_fix = """    text = text.replace(\n        'с безопасным составом и любимыми персонажами, с безопасным составом и любимыми персонажами',\n        'с безопасным составом и любимыми персонажами',\n    )\n"""
    if stale_copy_fix not in text:
        raise SystemExit('privacy/marketing separation block not found')
    h.write(path, text.replace(stale_copy_fix, '', 1))


h.fix_aria = fix_aria_source_aware
h.narrow_ip_copy = narrow_ip_copy_source_aware
raise SystemExit(h.main())
