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

    if errors:
        print('Static accessibility/conformance guard FAILED:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1
    print(f'Static accessibility/conformance guard OK: {len(pages)} HTML documents')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
