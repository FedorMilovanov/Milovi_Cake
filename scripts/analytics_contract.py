#!/usr/bin/env python3
"""Milovi Cake privacy/analytics source contract.

The contract owns the single privacy-first analytics loader and the removal of
all superseded cookie/privacy UI.  ``--rebuild-from-main`` restores legacy
sources from the exact main baseline and reapplies only bounded migrations, so
an over-broad edit can never silently become the source of truth.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOADER_TAG = '<script defer src="/js/consent-analytics.js"></script>'
FORBIDDEN_ANALYTICS = (
    'googletagmanager.com/gtag/js',
    'mc.yandex.ru/metrika/tag.js',
    'mc.yandex.ru/watch/',
    'G-94ZZ5B8YNY',
    '106945185',
)
LEGACY_HTML_MARKERS = (
    'id="privacyOverlay"', "id='privacyOverlay'",
    'id="privacyModal"', "id='privacyModal'",
    'id="cookieBanner"', "id='cookieBanner'",
    'openPrivacy()', 'closePrivacy()',
)
LEGACY_JS_SYMBOLS = (
    'loadMetrika', 'acceptCookie', 'declineCookie',
    'initCookieBanner', 'openPrivacy', 'closePrivacy',
)
LEGACY_CSS_SELECTORS = ('#cookieBanner', '#privacyOverlay', '#privacyModal', '#privacyClose')
EXCLUDED_PARTS = {
    '.git', 'node_modules', 'playwright-report', 'test-results', '_mockups',
    '_review_screens', 'audit', '.cache', '_site',
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
        if any(token.lower() in low for token in FORBIDDEN_ANALYTICS):
            return ''
        if any(marker in low for marker in (
            'function acceptcookie',
            'function declinecookie',
            'function loadmetrika',
            'function initcookiebanner',
            'function openprivacy',
            'function closeprivacy',
        )):
            return ''
        return block

    return pattern.sub(repl, text)


def remove_yandex_noscript(text: str) -> str:
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
    quote: str | None = None
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
                    while end < len(source) and source[end] in '\r\n':
                        end += 1
                    return source[:match.start()] + source[end:]
        i += 1
    raise RuntimeError(f'unbalanced function {name}')


def rewrite_privacy_links(text: str) -> str:
    opening_tag = re.compile(r'<a\b[^>]*\bonclick=["\']openPrivacy\(\);\s*return false;?["\'][^>]*>', re.I)

    def repl(match: re.Match[str]) -> str:
        tag = match.group(0)
        if re.search(r'\bhref=["\'][^"\']*["\']', tag, re.I):
            tag = re.sub(r'\bhref=["\'][^"\']*["\']', 'href="/privacy/"', tag, count=1, flags=re.I)
        else:
            tag = tag[:-1] + ' href="/privacy/">'
        tag = re.sub(r'\s+onclick=["\']openPrivacy\(\);\s*return false;?["\']', '', tag, flags=re.I)
        tag = re.sub(r'\s+role=["\']button["\']', '', tag, flags=re.I)
        tag = re.sub(r'\s+tabindex=["\']0["\']', '', tag, flags=re.I)
        return re.sub(r'\s+>', '>', tag)

    return opening_tag.sub(repl, text)


def remove_privacy_modal(text: str) -> str:
    opening = re.compile(r'<div\b[^>]*\bid=["\']privacyOverlay["\'][^>]*>', re.I)
    token = re.compile(r'<div\b[^>]*>|</div\s*>', re.I)
    while True:
        match = opening.search(text)
        if not match:
            return text
        depth = 0
        block_end = None
        for div in token.finditer(text, match.start()):
            if div.group(0).lower().startswith('<div'):
                depth += 1
            else:
                depth -= 1
                if depth == 0:
                    block_end = div.end()
                    break
        if block_end is None:
            raise RuntimeError('unbalanced legacy privacyOverlay div')
        block_start = match.start()
        comment = re.search(r'<!--[^>]*PRIVACY MODAL[^>]*-->\s*$', text[:match.start()], re.I)
        if comment:
            block_start = comment.start()
        text = text[:block_start] + '\n' + text[block_end:]

def migrate_html(path: Path, text: str) -> str:
    text = remove_script_blocks(text)
    text = remove_yandex_noscript(text)
    text = rewrite_privacy_links(text)
    text = remove_privacy_modal(text)
    text = re.sub(r'<!--[^>]*(?:Google Analytics|Яндекс\.Метрика|Yandex Metrika)[^>]*-->', '', text, flags=re.I)
    text = re.sub(
        r'\s*<!--\s*COOKIE BANNER\s*-->\s*<div\s+id=["\']cookieBanner["\']>[\s\S]*?</div>\s*',
        '\n', text, flags=re.I,
    )
    text = text.replace(
        'с безопасным составом и любимыми персонажами, с безопасным составом и любимыми персонажами',
        'с безопасным составом и любимыми персонажами',
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


def migrate_js(path: Path, text: str) -> str:
    if path.name == 'consent-analytics.js':
        return text
    for name in LEGACY_JS_SYMBOLS:
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

    text = re.sub(r'^.*\bwindow\.(?:acceptCookie|declineCookie|openPrivacy|closePrivacy)\s*=.*$\n?', '', text, flags=re.M)
    text = re.sub(r'^\s*(?:loadMetrika|initCookieBanner)\s*\([^;]*;\s*$\n?', '', text, flags=re.M)
    text = text.replace('closePrivacy(); closeFillPopup(); closeCalcPanel();', 'closeFillPopup(); closeCalcPanel();')
    text = re.sub(
        r'\s*var _pr = document\.getElementById\(["\']privacyOverlay["\']\);\s*if \(_pr && _pr\.classList\.contains\(["\']open["\']\)\) return;',
        '', text,
    )
    text = text.replace(
        "if(STATE === 'zoom_in' && typeof lbIsOpen === 'undefined' || !lbIsOpen)",
        "if(STATE === 'zoom_in' && (typeof lbIsOpen === 'undefined' || !lbIsOpen))",
    )

    # Remove the localStorage wrappers only when the deleted banner was their sole caller.
    for helper in ('_lsGet', '_lsSet'):
        if len(re.findall(rf'\b{re.escape(helper)}\s*\(', text)) == 1:
            text = remove_function(text, helper)
    return text


def migrate_css(text: str) -> str:
    simple_rule = re.compile(r'(?P<selectors>[^{}]+)\{(?P<body>[^{}]*)\}')

    def repl(match: re.Match[str]) -> str:
        selectors = match.group('selectors')
        if not any(marker in selectors for marker in LEGACY_CSS_SELECTORS):
            return match.group(0)
        kept = [selector.strip() for selector in selectors.split(',') if not any(marker in selector for marker in LEGACY_CSS_SELECTORS)]
        if not kept:
            return ''
        return ','.join(kept) + '{' + match.group('body') + '}'

    previous = None
    while previous != text:
        previous = text
        text = simple_rule.sub(repl, text)
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


def register_runtime_in_audit(text: str) -> str:
    marker = '    "js/consent-analytics.js",\n'
    if marker in text:
        return text
    anchor = '    "js/mc-2026.js",\n'
    if anchor not in text:
        raise RuntimeError('scripts/audit.py ALLOWED_JS anchor not found')
    return text.replace(anchor, anchor + marker, 1)


def collect_html() -> list[Path]:
    return sorted(p for p in ROOT.rglob('*.html') if not is_excluded(p) and not is_verification_html(p))


def collect_css() -> list[Path]:
    return sorted(p for p in (ROOT / 'css').rglob('*.css') if not is_excluded(p))


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
        if relative.endswith('.html') and not is_excluded(path) and not is_verification_html(path):
            changed += write_if_changed(path, migrate_html(path, main_text(relative)))
        elif relative.startswith('js/') and relative.endswith('.js'):
            changed += write_if_changed(path, migrate_js(path, main_text(relative)))
        elif relative.startswith('css/') and relative.endswith('.css'):
            changed += write_if_changed(path, migrate_css(main_text(relative)))

    privacy = ROOT / 'privacy' / 'index.html'
    changed += write_if_changed(privacy, migrate_html(privacy, privacy.read_text('utf-8')))

    sitemap = ROOT / 'sitemap.xml'
    changed += write_if_changed(sitemap, ensure_sitemap(main_text('sitemap.xml')))
    audit = ROOT / 'scripts' / 'audit.py'
    changed += write_if_changed(audit, register_runtime_in_audit(main_text('scripts/audit.py')))

    for diagnostic in (ROOT / 'MIGRATION_DIAGNOSTIC.txt', ROOT / 'ROUND2_FINDINGS.txt'):
        if diagnostic.exists():
            diagnostic.unlink()
            changed += 1

    print(f'clean-main privacy rebuild changed {changed} files')
    return changed


def apply_fixes() -> int:
    changed = 0
    for path in collect_html():
        changed += write_if_changed(path, migrate_html(path, path.read_text('utf-8')))
    for path in sorted((ROOT / 'js').rglob('*.js')):
        changed += write_if_changed(path, migrate_js(path, path.read_text('utf-8')))
    for path in collect_css():
        changed += write_if_changed(path, migrate_css(path.read_text('utf-8')))

    sitemap = ROOT / 'sitemap.xml'
    changed += write_if_changed(sitemap, ensure_sitemap(sitemap.read_text('utf-8')))
    audit = ROOT / 'scripts' / 'audit.py'
    changed += write_if_changed(audit, register_runtime_in_audit(audit.read_text('utf-8')))
    print(f'privacy migration changed {changed} files')
    return changed


def check_workflow_pins(errors: list[str]) -> None:
    exact_sha = re.compile(r'^[0-9a-f]{40}$', re.I)
    for workflow in sorted((ROOT / '.github' / 'workflows').glob('*.yml')):
        for number, line in enumerate(workflow.read_text('utf-8').splitlines(), 1):
            stripped = line.strip()
            if not stripped.startswith('uses:'):
                continue
            target = stripped.split('uses:', 1)[1].strip().split()[0]
            if target.startswith('./'):
                continue
            ref = target.rsplit('@', 1)[-1] if '@' in target else ''
            if not exact_sha.fullmatch(ref):
                errors.append(f'{workflow.relative_to(ROOT)}:{number}: action is not pinned to an exact SHA: {target}')


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
        for token in FORBIDDEN_ANALYTICS:
            if token in text:
                errors.append(f'{rel}: legacy analytics token remains: {token}')
        count = len(re.findall(r'/js/consent-analytics\.js', text, flags=re.I))
        if count != 1:
            errors.append(f'{rel}: expected one consent loader, found {count}')
        for marker in LEGACY_HTML_MARKERS:
            if marker in text:
                errors.append(f'{rel}: legacy privacy/cookie surface remains: {marker}')
        if 'Мы используем файлы cookie' in text:
            errors.append(f'{rel}: legacy cookie copy remains')
        if path.name == '404.html' and re.search(r'<link\s+rel=["\']canonical["\']', text, flags=re.I):
            errors.append('404.html must not emit canonical')

    for path in sorted((ROOT / 'js').rglob('*.js')):
        if path.name == 'consent-analytics.js':
            continue
        text = path.read_text('utf-8')
        rel = path.relative_to(ROOT)
        for token in FORBIDDEN_ANALYTICS:
            if token in text:
                errors.append(f'{rel}: analytics must live only in consent-analytics.js ({token})')
        for symbol in LEGACY_JS_SYMBOLS:
            if re.search(rf'\b{re.escape(symbol)}\b', text):
                errors.append(f'{rel}: legacy consent symbol remains: {symbol}')
        for marker in ('cookieBanner', 'privacyOverlay', 'privacyModal'):
            if marker in text:
                errors.append(f'{rel}: stale legacy DOM reference remains: {marker}')
        if "if(STATE === 'zoom_in' && typeof lbIsOpen === 'undefined' || !lbIsOpen)" in text:
            errors.append(f'{rel}: review animation condition has an operator-precedence bug')

    for path in collect_css():
        text = path.read_text('utf-8')
        for selector in LEGACY_CSS_SELECTORS:
            if selector in text:
                errors.append(f'{path.relative_to(ROOT)}: dead legacy selector remains: {selector}')

    loader = (ROOT / 'js' / 'consent-analytics.js').read_text('utf-8')
    for required in (
        'milovi_analytics_consent_v1',
        'googletagmanager.com/gtag/js',
        'mc.yandex.ru/metrika/tag.js',
        'window.MiloviConsent',
    ):
        if required not in loader:
            errors.append(f'consent loader missing contract marker: {required}')

    package = json.loads((ROOT / 'package.json').read_text('utf-8'))
    scripts = package.get('scripts', {})
    if scripts.get('audit:security') != 'npm audit --audit-level=high':
        errors.append('package.json must define audit:security at high severity')
    if 'npm run audit:security' not in scripts.get('qa', ''):
        errors.append('package.json qa must enforce audit:security')

    audit = (ROOT / 'scripts' / 'audit.py').read_text('utf-8')
    if '"js/consent-analytics.js"' not in audit:
        errors.append('scripts/audit.py does not register consent-analytics.js')

    check_workflow_pins(errors)
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
        print('Privacy/analytics contract FAILED:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1
    print('Privacy/analytics contract OK: one loader, no legacy UI, exact workflow pins')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
