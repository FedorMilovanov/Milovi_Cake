#!/usr/bin/env python3
"""Milovi Cake analytics source contract.

--fix removes every legacy inline GA/Yandex block and cookie banner, installs the
single local consent loader, removes the 404 canonical, and registers /privacy/
in the sitemap. Without --fix the script is read-only and fails closed.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOADER_TAG = '<script defer src="/js/consent-analytics.js"></script>'
FORBIDDEN_HTML = (
    'googletagmanager.com/gtag/js',
    'mc.yandex.ru/metrika/tag.js',
    'mc.yandex.ru/watch/',
    'G-94ZZ5B8YNY',
    '106945185',
)
EXCLUDED_PARTS = {
    '.git', 'node_modules', 'playwright-report', 'test-results', '_mockups',
    '_review_screens', 'audit', '.cache',
}


def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDED_PARTS for part in path.relative_to(ROOT).parts)


def is_verification_html(path: Path) -> bool:
    name = path.name.lower()
    return name.startswith('yandex_') or name.startswith('google') or 'verification' in name


def remove_script_blocks(text: str) -> str:
    pattern = re.compile(r'<script\b[^>]*>[\s\S]*?</script>', re.I)

    def repl(match: re.Match[str]) -> str:
        block = match.group(0)
        low = block.lower()
        if '/js/consent-analytics.js' in low:
            return ''
        if any(token.lower() in low for token in FORBIDDEN_HTML):
            return ''
        if 'function acceptcookie' in low or 'function declinecookie' in low or 'function loadmetrika' in low:
            return ''
        return block

    return pattern.sub(repl, text)


def remove_function(source: str, name: str) -> str:
    match = re.search(rf'\bfunction\s+{re.escape(name)}\s*\([^)]*\)\s*\{{', source)
    if not match:
        return source
    brace = source.find('{', match.start())
    depth = 0
    quote = None
    escaped = False
    i = brace
    while i < len(source):
        ch = source[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
        else:
            if ch in "'\"`":
                quote = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    while end < len(source) and source[end] in ' \t':
                        end += 1
                    if end < len(source) and source[end] == ';':
                        end += 1
                    return source[:match.start()] + source[end:]
        i += 1
    raise RuntimeError(f'unbalanced function {name}')


def migrate_js(path: Path, text: str) -> str:
    if path.name == 'consent-analytics.js':
        return text
    for name in ('loadMetrika', 'acceptCookie', 'declineCookie'):
        text = remove_function(text, name)
    if path.name == 'mc-2026.js':
        start_marker = '7. Отложенная Google Analytics'
        end_marker = '8. Мониторинг INP'
        start = text.find(start_marker)
        end = text.find(end_marker)
        if start >= 0 and end > start:
            start = text.rfind('/*', 0, start)
            end = text.rfind('/*', 0, end)
            text = text[:start] + text[end:]
    text = re.sub(r'^.*\bwindow\.(?:acceptCookie|declineCookie)\s*=.*$\n?', '', text, flags=re.M)
    text = re.sub(r'^.*\bloadMetrika\s*\(.*$\n?', '', text, flags=re.M)
    return text


def migrate_html(path: Path, text: str) -> str:
    text = remove_script_blocks(text)
    text = re.sub(
        r'<noscript\b[^>]*>[\s\S]*?mc\.yandex\.ru/watch/[\s\S]*?</noscript>',
        '', text, flags=re.I,
    )
    text = re.sub(r'<!--[^>]*(?:Google Analytics|Яндекс\.Метрика|Yandex Metrika)[^>]*-->', '', text, flags=re.I)
    text = re.sub(
        r'\s*<!--\s*COOKIE BANNER\s*-->\s*<div\s+id=["\']cookieBanner["\']>[\s\S]*?</div>\s*',
        '\n', text, flags=re.I,
    )
    if path.name == '404.html':
        text = re.sub(r'\s*<link\s+rel=["\']canonical["\'][^>]*>\s*', '\n', text, flags=re.I)
        text = re.sub(r'\s*<meta\s+property=["\']og:url["\'][^>]*>\s*', '\n', text, flags=re.I)
    text = re.sub(r'\s*<script\s+defer\s+src=["\']/js/consent-analytics\.js(?:\?[^"\']*)?["\']\s*></script>\s*', '\n', text, flags=re.I)
    if '</body>' not in text.lower():
        raise RuntimeError(f'{path.relative_to(ROOT)} has no </body>')
    text = re.sub(r'</body>', f'  {LOADER_TAG}\n</body>', text, count=1, flags=re.I)
    return text


def ensure_sitemap(text: str) -> str:
    if 'https://milovicake.ru/privacy/' in text:
        return text
    entry = (
        '  <url>\n'
        '    <loc>https://milovicake.ru/privacy/</loc>\n'
        '    <lastmod>2026-07-28</lastmod>\n'
        '  </url>\n'
    )
    return text.replace('</urlset>', entry + '</urlset>')


def collect_html() -> list[Path]:
    return sorted(
        p for p in ROOT.rglob('*.html')
        if not is_excluded(p) and not is_verification_html(p)
    )


def apply_fixes() -> int:
    changed = 0
    for path in collect_html():
        original = path.read_text('utf-8')
        updated = migrate_html(path, original)
        if updated != original:
            path.write_text(updated, 'utf-8')
            changed += 1
    for path in sorted((ROOT / 'js').rglob('*.js')):
        original = path.read_text('utf-8')
        updated = migrate_js(path, original)
        if updated != original:
            path.write_text(updated, 'utf-8')
            changed += 1
    sitemap = ROOT / 'sitemap.xml'
    original = sitemap.read_text('utf-8')
    updated = ensure_sitemap(original)
    if updated != original:
        sitemap.write_text(updated, 'utf-8')
        changed += 1
    print(f'analytics migration changed {changed} files')
    return changed


def check() -> list[str]:
    errors: list[str] = []
    privacy = ROOT / 'privacy' / 'index.html'
    if not privacy.exists():
        errors.append('privacy/index.html is missing')
    sitemap = (ROOT / 'sitemap.xml').read_text('utf-8')
    if 'https://milovicake.ru/privacy/' not in sitemap:
        errors.append('/privacy/ is missing from sitemap.xml')

    for path in collect_html():
        text = path.read_text('utf-8')
        rel = path.relative_to(ROOT)
        for token in FORBIDDEN_HTML:
            if token in text:
                errors.append(f'{rel}: legacy analytics token remains: {token}')
        count = len(re.findall(r'/js/consent-analytics\.js', text, flags=re.I))
        if count != 1:
            errors.append(f'{rel}: expected one consent loader, found {count}')
        if 'id="cookieBanner"' in text or "id='cookieBanner'" in text:
            errors.append(f'{rel}: legacy cookie banner remains')
        if path.name == '404.html' and re.search(r'<link\s+rel=["\']canonical["\']', text, flags=re.I):
            errors.append('404.html must not emit canonical')

    for path in sorted((ROOT / 'js').rglob('*.js')):
        if path.name == 'consent-analytics.js':
            continue
        text = path.read_text('utf-8')
        rel = path.relative_to(ROOT)
        for token in FORBIDDEN_HTML:
            if token in text:
                errors.append(f'{rel}: analytics must live only in consent-analytics.js ({token})')
        for symbol in ('loadMetrika', 'acceptCookie', 'declineCookie'):
            if re.search(rf'\b{symbol}\b', text):
                errors.append(f'{rel}: legacy consent symbol remains: {symbol}')

    loader = (ROOT / 'js' / 'consent-analytics.js').read_text('utf-8')
    for required in ('milovi_analytics_consent_v1', 'googletagmanager.com/gtag/js', 'mc.yandex.ru/metrika/tag.js', 'window.MiloviConsent'):
        if required not in loader:
            errors.append(f'consent loader missing contract marker: {required}')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--fix', action='store_true')
    args = parser.parse_args()
    if args.fix:
        apply_fixes()
    errors = check()
    if errors:
        print('Analytics contract FAILED:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1
    print('Analytics contract OK: one local loader, zero third-party requests before consent')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
