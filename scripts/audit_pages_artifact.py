#!/usr/bin/env python3
"""Fail-closed audit for the sanitized `_site/` Pages payload."""
from __future__ import annotations

import json
import os
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / '_site'
ORIGIN = 'https://milovicake.ru'
FORBIDDEN_PUBLIC_PATHS = {
    '.github', 'node_modules', 'scripts', 'tests', 'audit', '_mockups',
    '_review_screens', 'playwright-report', 'test-results', 'package.json',
    'package-lock.json', 'playwright.config.js', 'prigorody/_template.html',
    'prigorody/_cities.csv', 'prigorody/build.py',
}
NON_RUNTIME_SOURCE_PARTS = {
    '_site', 'node_modules', 'audit', '_mockups', '_review_screens',
    'playwright-report', 'test-results',
}
FORBIDDEN_ANALYTICS = (
    'googletagmanager.com/gtag/js',
    'mc.yandex.ru/metrika/tag.js',
    'mc.yandex.ru/watch/',
    'G-94ZZ5B8YNY',
    '106945185',
)


class RefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str]] = []
        self.canonical = False

    def handle_starttag(self, tag: str, attrs) -> None:
        data = dict(attrs)
        if tag == 'link' and 'canonical' in str(data.get('rel', '')).lower():
            self.canonical = True
        for attr in ('href', 'src', 'poster', 'action'):
            value = data.get(attr)
            if value:
                self.refs.append((attr, value))
        srcset = data.get('srcset')
        if srcset:
            for item in srcset.split(','):
                url = item.strip().split(' ', 1)[0]
                if url:
                    self.refs.append(('srcset', url))


def is_verification_html(path: Path) -> bool:
    name = path.name.lower()
    return name.startswith('yandex_') or name.startswith('google') or 'verification' in name


def local_target_exists(page: Path, raw: str) -> bool:
    if raw.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'data:', 'blob:')):
        return True
    parsed = urlparse(raw)
    if parsed.scheme and parsed.netloc and parsed.netloc != 'milovicake.ru':
        return True
    if parsed.netloc == 'milovicake.ru':
        candidate_path = parsed.path
    else:
        page_url = ORIGIN + '/' + page.relative_to(SITE).as_posix()
        if page.name == 'index.html':
            page_url = ORIGIN + '/' + page.parent.relative_to(SITE).as_posix().strip('/') + '/'
        candidate_path = urlparse(urljoin(page_url, raw)).path
    candidate_path = unquote(candidate_path)
    candidate = SITE / candidate_path.lstrip('/')
    if candidate_path.endswith('/'):
        return (candidate / 'index.html').is_file()
    if candidate.is_file():
        return True
    return (candidate / 'index.html').is_file()


def main() -> int:
    errors: list[str] = []
    if not SITE.is_dir():
        print('_site is missing; run npm run build:pages', file=sys.stderr)
        return 1

    for forbidden in FORBIDDEN_PUBLIC_PATHS:
        if (SITE / forbidden).exists():
            errors.append(f'development source leaked into Pages artifact: {forbidden}')

    for required in (
        'index.html', '404.html', 'privacy/index.html', 'robots.txt',
        'sitemap.xml', 'CNAME', 'js/consent-analytics.js', 'release.json', '.nojekyll',
    ):
        if not (SITE / required).exists():
            errors.append(f'missing required Pages file: {required}')

    expected_sha = os.environ.get('RELEASE_SHA', '').strip() or 'development'
    try:
        release = json.loads((SITE / 'release.json').read_text('utf-8'))
        if release != {
            'repository': 'FedorMilovanov/Milovi_Cake',
            'sha': expected_sha,
        }:
            errors.append(f'release.json drift: {release!r}')
    except Exception as error:
        errors.append(f'invalid release.json: {error}')

    html_files = sorted(SITE.rglob('*.html'))
    for page in html_files:
        text = page.read_text('utf-8', errors='replace')
        relative = page.relative_to(SITE)
        parser = RefParser()
        try:
            parser.feed(text)
        except Exception as error:
            errors.append(f'{relative}: HTML parser failure: {error}')
            continue

        if not is_verification_html(page):
            loader_count = text.count('/js/consent-analytics.js')
            if loader_count != 1:
                errors.append(f'{relative}: expected one consent loader, found {loader_count}')
            for token in FORBIDDEN_ANALYTICS:
                if token in text:
                    errors.append(f'{relative}: direct analytics token leaked: {token}')

        if relative.as_posix() == '404.html' and parser.canonical:
            errors.append('404.html must not emit canonical')

        for attr, ref in parser.refs:
            if not local_target_exists(page, ref):
                errors.append(f'{relative}: broken local {attr}={ref!r}')

    try:
        root = ET.fromstring((SITE / 'sitemap.xml').read_text('utf-8'))
        namespace = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        for loc in root.findall('.//sm:loc', namespace):
            if not loc.text:
                errors.append('sitemap URL without text')
                continue
            parsed = urlparse(loc.text.strip())
            if parsed.netloc != 'milovicake.ru':
                errors.append(f'sitemap contains foreign domain: {loc.text}')
                continue
            target = SITE / parsed.path.lstrip('/')
            if parsed.path.endswith('/'):
                target = target / 'index.html'
            if not target.exists():
                errors.append(f'sitemap route missing from artifact: {loc.text}')
    except Exception as error:
        errors.append(f'invalid sitemap.xml: {error}')

    source_runtime_html = sorted(
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob('*.html')
        if not any(part in NON_RUNTIME_SOURCE_PARTS for part in path.parts)
        and path.name != '_template.html'
        and not is_verification_html(path)
    )
    artifact_runtime_html = sorted(
        path.relative_to(SITE).as_posix()
        for path in html_files
        if not is_verification_html(path)
    )
    missing_pages = sorted(set(source_runtime_html) - set(artifact_runtime_html))
    if missing_pages:
        errors.append(f'runtime HTML omitted from artifact: {missing_pages}')

    if errors:
        print('Pages artifact audit FAILED:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1

    print(f'Pages artifact audit OK: {len(html_files)} HTML documents, exact release {expected_sha}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
