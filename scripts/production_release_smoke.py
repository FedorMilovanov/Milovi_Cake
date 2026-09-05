#!/usr/bin/env python3
"""Verify exact deployed SHA plus permanent privacy and 404 contracts."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

HOST = 'https://milovicake.ru'
TIMEOUT = 20


def expected_sha() -> str:
    value = os.environ.get('EXPECTED_RELEASE_SHA', '').strip() or os.environ.get('GITHUB_SHA', '').strip()
    if value:
        return value
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    except Exception as exc:
        raise RuntimeError(f'cannot resolve expected release SHA: {exc}')


def request(path: str) -> tuple[int, str]:
    req = urllib.request.Request(HOST + path, headers={'User-Agent': 'MiloviCakeReleaseSmoke/1.0', 'Cache-Control': 'no-cache'})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            body = response.read(600_000).decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
            return response.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read(600_000).decode(exc.headers.get_content_charset() or 'utf-8', errors='replace')
        return exc.code, body


def run_once(expected: str) -> list[str]:
    errors: list[str] = []
    status, body = request('/release.json')
    if status != 200:
        errors.append(f'/release.json returned {status}')
    else:
        try:
            payload = json.loads(body)
        except Exception as exc:
            errors.append(f'/release.json invalid JSON: {exc}')
        else:
            if payload.get('repository') != 'FedorMilovanov/Milovi_Cake':
                errors.append(f'/release.json repository mismatch: {payload!r}')
            if payload.get('sha') != expected:
                errors.append(f'/release.json sha {payload.get("sha")} != expected {expected}')

    status, _body = request('/privacy/')
    if status != 200:
        errors.append(f'/privacy/ returned {status}')

    status, missing = request('/__milovi_release_smoke_missing__/')
    if status != 404:
        errors.append(f'unknown route must return 404, got {status}')
    low = missing.lower()
    if '<link rel="canonical"' in low or "<link rel='canonical'" in low:
        errors.append('404 response must not emit canonical')
    if 'noindex' not in low:
        errors.append('404 response must contain noindex')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--retries', type=int, default=1)
    parser.add_argument('--delay', type=int, default=30)
    args = parser.parse_args()
    expected = expected_sha()
    errors: list[str] = []
    for attempt in range(1, max(1, args.retries) + 1):
        try:
            errors = run_once(expected)
        except Exception as exc:
            errors = [repr(exc)]
        if not errors:
            print(f'Production release smoke OK: exact live SHA {expected}, privacy 200, true 404')
            return 0
        print(f'Production release smoke attempt {attempt} failed:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        if attempt < max(1, args.retries):
            time.sleep(args.delay)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
