#!/usr/bin/env python3
"""Milovi Cake analytics source contract.

The contract owns the one-loader privacy boundary. `--rebuild-from-main` is a
one-shot recovery mode: it restores every legacy HTML/JS source from the exact
`origin/main` baseline and reapplies the migration, preventing a partial or
over-broad regex edit from becoming the new source of truth.
"""
from __future__ import annotations

import argparse
import re
import subprocess
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
        if any(marker in low for marker in (
            'function acceptcookie',
            'function declinecookie',
            'function loadmetrika',
        )):
            return ''
        return block

    return pattern.sub(repl, text)


def remove_yandex_noscript(text: str) -> str:
    # Never cross another </noscript>: font fallbacks and unrelated no-JS content
    # must survive even when a later Yandex pixel exists on the same page.
    pattern = re.compile(
        r'<noscript\b[^>]*>(?:(?!</noscript>)[\s\S])*?'
        r'mc\.yandex\.ru/watch/'
        r'(?:(?!</noscript>)[\s\S])*?</noscript>',
        re.I,
    )
    return pattern.sub('', text)


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
    text = remove_yandex_noscript(text)
    text = re.sub(r'<!--[^>]*(?:Google Analytics|Яндекс\.Метрика|Yandex Metrika)[^>]*-->', '', text, flags=re.I)
    text = re.sub(
        r'\s*<!--\s*COOKIE BANNER\s*-->\s*<div\s+id=["\']cookieBanner["\']>[\s\S]*?</div>\s*',
        '\n', text, flags=re.I,
    )
    if path.name == '404.html':
        text = re.sub(r'\s*<link\s+rel=["\']canonical["\'][^>]*>\s*', '\n', text, flags=re.I)
        text = re.sub(r'\s*<meta\s+property=["\']og:url["\'][^>]*>\s*', '\n', text, flags=re.I)
    text = re.sub(
        r'\s*<script\s+defer\s+src=["\']/js/consent-analytics\.js(?:\?[^"\']*)?["\']\s*></script>\s*',
        '\n', text, flags=re.I,
    )
    if '</body>' not in text.lower():
        raise RuntimeError(f'{path.relative_to(ROOT)} has no </body>')
    text = re.sub(r'</body>', f'  {LOADER_TAG}\n</body>', text, count=1, flags=re.I)
    return re.sub(r'[ \t]+$', '', text, flags=re.M)


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


def register_runtime_in_audit(text: str) -> str:
    marker = '    "js/consent-analytics.js",\n'
    if marker in text:
        return text
    anchor = '    "js/mc-2026.js",\n'
    if anchor not in text:
        raise RuntimeError('scripts/audit.py ALLOWED_JS anchor not found')
    return text.replace(anchor, anchor + marker, 1)


def collect_html() -> list[Path]:
    return sorted(
        p for p in ROOT.rglob('*.html')
        if not is_excluded(p) and not is_verification_html(p)
    )


def write_if_changed(path: Path, updated: str) -> int:
    original = path.read_text('utf-8') if path.exists() else None
    if updated == original:
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(updated, 'utf-8')
    return 1


def git_output(*args: str) -> str:
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True)


def main_paths() -> list[str]:
    return [line for line in git_output('ls-tree', '-r', '--name-only', 'origin/main').splitlines() if line]


def main_text(relative: str) -> str:
    return git_output('show', f'origin/main:{relative}')


def rebuild_from_main() -> int:
    subprocess.run(['git', 'fetch', '--no-tags', 'origin', 'main'], cwd=ROOT, check=True)
    changed = 0
    paths = main_paths()

    for relative in paths:
        path = ROOT / relative
        if not relative.endswith('.html') or is_excluded(path) or is_verification_html(path):
            continue
        changed += write_if_changed(path, migrate_html(path, main_text(relative)))

    # The new policy page is not present on main; normalize it from its branch source.
    privacy = ROOT / 'privacy' / 'index.html'
    changed += write_if_changed(privacy, migrate_html(privacy, privacy.read_text('utf-8')))

    for relative in paths:
        if not relative.startswith('js/') or not relative.endswith('.js'):
            continue
        path = ROOT / relative
        changed += write_if_changed(path, migrate_js(path, main_text(relative)))

    sitemap = ROOT / 'sitemap.xml'
    changed += write_if_changed(sitemap, ensure_sitemap(main_text('sitemap.xml')))

    audit = ROOT / 'scripts' / 'audit.py'
    changed += write_if_changed(audit, register_runtime_in_audit(main_text('scripts/audit.py')))

    diagnostic = ROOT / 'MIGRATION_DIAGNOSTIC.txt'
    if diagnostic.exists():
        diagnostic.unlink()
        changed += 1

    print(f'clean-main analytics rebuild changed {changed} files')
    return changed


def apply_fixes() -> int:
    changed = 0
    for path in collect_html():
        changed += write_if_changed(path, migrate_html(path, path.read_text('utf-8')))
    for path in sorted((ROOT / 'js').rglob('*.js')):
        changed += write_if_changed(path, migrate_js(path, path.read_text('utf-8')))

    sitemap = ROOT / 'sitemap.xml'
    changed += write_if_changed(sitemap, ensure_sitemap(sitemap.read_text('utf-8')))

    audit = ROOT / 'scripts' / 'audit.py'
    changed += write_if_changed(audit, register_runtime_in_audit(audit.read_text('utf-8')))

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
    for required in (
        'milovi_analytics_consent_v1',
        'googletagmanager.com/gtag/js',
        'mc.yandex.ru/metrika/tag.js',
        'window.MiloviConsent',
    ):
        if required not in loader:
            errors.append(f'consent loader missing contract marker: {required}')

    audit = (ROOT / 'scripts' / 'audit.py').read_text('utf-8')
    if '"js/consent-analytics.js"' not in audit:
        errors.append('scripts/audit.py does not register consent-analytics.js')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--fix', action='store_true')
    group.add_argument('--fix-only', action='store_true')
    group.add_argument('--rebuild-from-main', action='store_true')
    args = parser.parse_args()

    if args.rebuild_from_main:
        rebuild_from_main()
    elif args.fix or args.fix_only:
        apply_fixes()

    if args.fix_only:
        return 0

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
