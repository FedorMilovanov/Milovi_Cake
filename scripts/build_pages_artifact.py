#!/usr/bin/env python3
"""Build the exact GitHub Pages payload into `_site/`.

The artifact is allowlisted: source, tests, templates, reports and repository
control files never become public web paths. A release witness binds the live
site to the exact Git commit promoted by Actions.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_site'

ROOT_EXACT = {
    'CNAME',
    'sw.js',
    'manifest.json',
}
ROOT_SUFFIXES = {
    '.html', '.txt', '.xml', '.svg', '.png', '.ico', '.jpg', '.jpeg',
    '.webp', '.avif', '.webmanifest',
}
RUNTIME_DIRS = {
    'css',
    'js',
    'img',
    'fonts',
    'assets',
    'gallery',
    'meringue-roll',
    'certificates',
    'call',
    'zakazat-tort-spb',
    'tort-s-dostavkoy',
    'tort-na-den-rozhdeniya',
    'bento-torty',
    'detskie-torty',
    'svadebnye-torty',
    'o-konditere',
    'dostavka-i-oplata',
    'otzyvy',
    'privacy',
    'prigorody',
}
FORBIDDEN_PARTS = {
    '.git', '.github', 'node_modules', '__pycache__', 'playwright-report',
    'test-results', '_mockups', '_review_screens', 'audit', '_site',
}
PRIGORODY_SOURCE_ONLY = {'_template.html', '_cities.csv', 'build.py'}
# Входные данные сборки, а не веб-файлы: полные шрифты для
# `scripts/subset_fonts.py` и манифест покрытия для тестов.
FONTS_SOURCE_ONLY = {'source', 'subset-manifest.json'}


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def copy_runtime_dir(name: str) -> int:
    source_root = ROOT / name
    if not source_root.exists():
        return 0
    copied = 0
    for source in sorted(source_root.rglob('*')):
        if not source.is_file():
            continue
        relative = source.relative_to(ROOT)
        if any(part in FORBIDDEN_PARTS for part in relative.parts):
            continue
        if name == 'prigorody' and source.name in PRIGORODY_SOURCE_ONLY:
            continue
        if name == 'fonts' and relative.parts[1] in FONTS_SOURCE_ONLY:
            continue
        if source.suffix in {'.py', '.pyc', '.csv', '.md'}:
            continue
        copy_file(source, OUT / relative)
        copied += 1
    return copied


def main() -> int:
    argparse.ArgumentParser(description='Build the Pages artifact into the fixed _site/ directory.').parse_args()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    copied = 0
    for source in sorted(ROOT.iterdir()):
        if not source.is_file():
            continue
        if source.name in ROOT_EXACT or source.suffix.lower() in ROOT_SUFFIXES:
            copy_file(source, OUT / source.name)
            copied += 1

    for directory in sorted(RUNTIME_DIRS):
        copied += copy_runtime_dir(directory)

    (OUT / '.nojekyll').touch()
    release_sha = os.environ.get('RELEASE_SHA', '').strip() or 'development'
    if not re.fullmatch(r'(?:[0-9a-f]{40}|development)', release_sha):
        raise ValueError('RELEASE_SHA must be an exact Git SHA or development')

    # One witness for the two opt-in LCP pages; the source of truth remains the
    # same release.json. Inject only into the sanitized payload, not source HTML.
    for route in ('index.html', 'bento-torty/index.html'):
        page = OUT / route
        html = page.read_text('utf-8')
        if html.count('</head>') != 1 or 'name="milovi-release-sha"' in html:
            raise ValueError(f'{route}: release meta injection is not unique')
        html = html.replace('</head>',
                            f'  <meta name="milovi-release-sha" content="{release_sha}">\n</head>', 1)
        page.write_text(html, encoding='utf-8')

    release = {
        'repository': 'FedorMilovanov/Milovi_Cake',
        'sha': release_sha,
    }
    (OUT / 'release.json').write_text(
        json.dumps(release, ensure_ascii=False, separators=(',', ':')) + '\n',
        encoding='utf-8',
    )

    print(f'Pages artifact built: {copied} source files + .nojekyll + release.json')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
