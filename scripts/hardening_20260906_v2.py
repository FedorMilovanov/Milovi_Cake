#!/usr/bin/env python3
from __future__ import annotations

import hardening_20260906 as h


def fix_aria_source_aware() -> None:
    for path in ('index.html', 'prigorody/_template.html'):
        text = h.read(path)

        hidden_bad = '<input type="hidden" id="calcWeight" value="2" aria-label="Вес торта в килограммах" />'
        hidden_good = '<input type="hidden" id="calcWeight" value="2" />'
        if hidden_bad in text:
            text = text.replace(hidden_bad, hidden_good, 1)
        elif hidden_good not in text:
            raise SystemExit(f'{path}: calcWeight hidden input contract not found')

        arrow_bad = '<div class="calc-result-collapsed-arrow" aria-label="Подробнее">'
        arrow_good = '<div class="calc-result-collapsed-arrow" aria-hidden="true">'
        if arrow_bad in text:
            text = text.replace(arrow_bad, arrow_good, 1)
        elif arrow_good not in text:
            raise SystemExit(f'{path}: collapsed arrow contract not found')

        badge_bad = '<span class="calc-approx-badge" id="calcApproxBadge" aria-label="Приблизительная цена">~</span>'
        badge_good = '<span class="calc-approx-badge" id="calcApproxBadge" aria-hidden="true">~</span>'
        if badge_bad in text:
            text = text.replace(badge_bad, badge_good, 1)
        elif badge_good not in text:
            raise SystemExit(f'{path}: approximation badge contract not found')

        h.write(path, text)


h.fix_aria = fix_aria_source_aware
raise SystemExit(h.main())
