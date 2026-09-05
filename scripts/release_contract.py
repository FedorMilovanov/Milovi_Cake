#!/usr/bin/env python3
"""Validate exact HTML/ESM asset revision pairs against the Service Worker precache."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', 'node_modules', '_site', 'playwright-report', 'test-results', 'audit', '_mockups', '_review_screens'}


def parse_precache() -> dict[str, str]:
    sw = (ROOT / 'sw.js').read_text('utf-8', errors='replace')
    match = re.search(r'const\s+PRECACHE\s*=\s*\[([^\]]+)\]', sw, re.S)
    if not match:
        raise RuntimeError('sw.js PRECACHE not found')
    result: dict[str, str] = {}
    for raw in re.findall(r"'([^']+)'", match.group(1)):
        parsed = urlparse(raw)
        version = ''
        for part in parsed.query.split('&'):
            if part.startswith('v='):
                version = part[2:]
                break
        if not version:
            continue
        path = parsed.path.lstrip('/')
        if path in result and result[path] != version:
            raise RuntimeError(f'duplicate conflicting SW revision for {path}: {result[path]} vs {version}')
        result[path] = version
    if not result:
        raise RuntimeError('no versioned assets found in sw.js PRECACHE')
    return result


def iter_html():
    for path in ROOT.rglob('*.html'):
        parts = path.relative_to(ROOT).parts
        if any(part in EXCLUDED for part in parts):
            continue
        yield path


def main() -> int:
    errors: list[str] = []
    try:
        sw_versions = parse_precache()
    except Exception as exc:
        print(f'Release contract FAILED: {exc}', file=sys.stderr)
        return 1

    attr_re = re.compile(r'(?:href|src)=["\']([^"\']+)["\']', re.I)
    for page in iter_html():
        rel = page.relative_to(ROOT).as_posix()
        for raw in attr_re.findall(page.read_text('utf-8', errors='replace')):
            parsed = urlparse(raw)
            if parsed.scheme or parsed.netloc:
                continue
            clean = parsed.path
            if clean.startswith('/'):
                asset = clean.lstrip('/')
            else:
                resolved = (page.parent / clean).resolve()
                try:
                    asset = resolved.relative_to(ROOT).as_posix()
                except ValueError:
                    continue
            if asset not in sw_versions:
                continue
            actual = ''
            for part in parsed.query.split('&'):
                if part.startswith('v='):
                    actual = part[2:]
                    break
            expected = sw_versions[asset]
            # consent-analytics.js is intentionally versionless in HTML and is forced
            # through cache:reload by sw.js; its cache policy is not query-revision based.
            if asset == 'js/consent-analytics.js' and not actual:
                continue
            if actual != expected:
                errors.append(f'{rel}: {asset} revision {actual or "<missing>"} != sw.js {expected}')

    import_re = re.compile(r'\bimport\s+(?:[^;\'\"]*?\s+from\s+)?[\'\"]([^\'\"]+\.js(?:\?[^\'\"]*)?)[\'\"]')
    for js in ROOT.rglob('*.js'):
        parts = js.relative_to(ROOT).parts
        if any(part in EXCLUDED for part in parts) or js.name == 'sw.js':
            continue
        text = js.read_text('utf-8', errors='replace')
        for raw in import_re.findall(text):
            parsed = urlparse(raw)
            if not parsed.path.startswith('.'):
                continue
            target = (js.parent / parsed.path).resolve()
            try:
                asset = target.relative_to(ROOT).as_posix()
            except ValueError:
                continue
            if asset not in sw_versions:
                continue
            actual = ''
            for part in parsed.query.split('&'):
                if part.startswith('v='):
                    actual = part[2:]
                    break
            expected = sw_versions[asset]
            if actual != expected:
                errors.append(f'{js.relative_to(ROOT)}: import {asset} revision {actual or "<missing>"} != sw.js {expected}')

    if errors:
        print('Release asset contract FAILED:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1
    unique = len(set(sw_versions.values()))
    print(f'Release asset contract OK: {len(sw_versions)} exact asset revisions across {unique} revision label(s)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
