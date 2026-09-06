#!/usr/bin/env python3
"""Fail-closed static accessibility/conformance guards promoted from forensic findings."""
from __future__ import annotations

import html.parser
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', 'node_modules', '_site', 'playwright-report', 'test-results', 'audit'}


class GuardParser(html.parser.HTMLParser):
    def __init__(self, rel: str) -> None:
        super().__init__(convert_charrefs=True)
        self.rel = rel
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        data = dict(attrs)
        line = self.getpos()[0]
        if tag == 'input' and data.get('type', '').lower() == 'hidden':
            aria = sorted(name for name, _value in attrs if name and name.lower().startswith('aria-'))
            if aria:
                self.errors.append(f'{self.rel}:{line}: hidden input must not carry ARIA attributes: {aria}')

        classes = set((data.get('class') or '').split())
        if 'calc-result-collapsed-arrow' in classes and 'aria-label' in data:
            self.errors.append(f'{self.rel}:{line}: decorative calculator arrow must not use aria-label')
        if 'calc-approx-badge' in classes and 'aria-label' in data:
            self.errors.append(f'{self.rel}:{line}: decorative approximation badge must not use aria-label')

        # Lighthouse label-content-name-mismatch regression: the accessible name
        # must contain the same visible provider/rating text rendered by the badge.
        if 'map-badge-yandex' in classes and data.get('aria-label') != 'Яндекс Карты ★ 4.8':
            self.errors.append(f'{self.rel}:{line}: Yandex map badge accessible name must match visible text')
        if 'map-badge-google' in classes and data.get('aria-label') != 'Google Maps ★ 4.7':
            self.errors.append(f'{self.rel}:{line}: Google map badge accessible name must match visible text')


def require_text(path: str, needles: tuple[str, ...]) -> list[str]:
    text = (ROOT / path).read_text('utf-8', errors='replace')
    return [f'{path}: missing permanent accessibility contract {needle!r}' for needle in needles if needle not in text]


def main() -> int:
    errors: list[str] = []
    pages: list[Path] = []
    for path in ROOT.rglob('*.html'):
        rel_parts = path.relative_to(ROOT).parts
        if any(part in EXCLUDED for part in rel_parts):
            continue
        pages.append(path)
        parser = GuardParser(path.relative_to(ROOT).as_posix())
        try:
            parser.feed(path.read_text('utf-8', errors='replace'))
        except Exception as exc:
            errors.append(f'{path.relative_to(ROOT)}: parser failure: {exc}')
        errors.extend(parser.errors)

    # Keep confirmed contrast fixes local instead of weakening global brand tokens.
    errors.extend(require_text('privacy/index.html', (
        '.privacy-page a{color:#8a5723}',
        '.privacy-page__lead{font-size:20px;max-width:760px;color:#725f50}',
        'html[data-theme="dark"] .privacy-page a{color:#e8b87a}',
    )))
    errors.extend(require_text('prigorody/_template.html', (
        ':root:not([data-theme="dark"]) .prigorody-page .calc-opt.selected{color:#2c1a10}',
        ':root:not([data-theme="dark"]) .prigorody-page .calc-stepper-val{color:#8a5723}',
        ':root:not([data-theme="dark"]) .prigorody-page .nearby-city-card__info{color:#725f50}',
    )))

    if errors:
        print('Static accessibility/conformance guard FAILED:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1
    print(f'Static accessibility/conformance guard OK: {len(pages)} HTML documents')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
