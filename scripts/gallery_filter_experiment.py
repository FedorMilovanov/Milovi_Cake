#!/usr/bin/env python3
"""Create a temporary gallery CSS variant for a controlled WebKit comparison.

The original source is never modified by this script. Filter effects, other
transitions, tests, and browser configuration remain in place; only the six
explicit filter transition entries are removed in the output file.
"""
from __future__ import annotations

import argparse
from pathlib import Path

REPLACEMENTS = (
    ('  transition: filter 0.6s ease;\n', ''),
    ('    box-shadow 0.6s cubic-bezier(0.23, 1, 0.32, 1),\n    filter 0.6s ease;',
     '    box-shadow 0.6s cubic-bezier(0.23, 1, 0.32, 1);'),
    ('transition:opacity .45s ease, filter .6s ease;', 'transition:opacity .45s ease;'),
    ('transition:opacity .45s ease, filter .45s ease;', 'transition:opacity .45s ease;'),
    ('transition:transform .45s cubic-bezier(.16,1,.3,1), filter .45s ease, opacity .35s ease;',
     'transition:transform .45s cubic-bezier(.16,1,.3,1), opacity .35s ease;'),
    ('transition:transform 1.1s cubic-bezier(.22,1,.36,1), opacity .85s cubic-bezier(.22,1,.36,1), filter 1.1s ease;',
     'transition:transform 1.1s cubic-bezier(.22,1,.36,1), opacity .85s cubic-bezier(.22,1,.36,1);'),
)


def remove_explicit_filter_transitions(source: str) -> str:
    result = source
    for old, new in REPLACEMENTS:
        if result.count(old) != 1:
            raise ValueError(f'Expected one occurrence of CSS marker: {old!r}')
        result = result.replace(old, new, 1)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('source and output must be different files')
    args.output.write_text(remove_explicit_filter_transitions(args.source.read_text(encoding='utf-8')), encoding='utf-8')


if __name__ == '__main__':
    main()
