#!/usr/bin/env python3
"""Submit sitemap URLs to IndexNow endpoints.

Usage:
  python3 scripts/submit_indexnow.py --dry-run
  python3 scripts/submit_indexnow.py --wait 45

This script intentionally has zero third-party dependencies so it can run in
GitHub Actions and from a fresh local checkout.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = "milovicake.ru"
KEY = "f5c91a4d89e84b2ca6d4f3e7a1029b6c"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
ENDPOINTS = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
]


def load_urls() -> list[str]:
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8", errors="replace")
    urls = re.findall(r"<loc>(https://milovicake\.ru/[^<]*)</loc>", sitemap)
    # Technical/noindex pages must never be pushed.
    urls = [u for u in dict.fromkeys(urls) if "/call/" not in u]
    if not urls:
        raise SystemExit("No URLs found in sitemap.xml")
    return urls


def submit(endpoint: str, payload: bytes) -> tuple[bool, str]:
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            body = resp.read(300).decode("utf-8", "replace")
            ok = 200 <= resp.status < 300
            return ok, f"{resp.status} {body}".strip()
    except urllib.error.HTTPError as exc:
        body = exc.read(300).decode("utf-8", "replace") if exc.fp else ""
        return False, f"HTTP {exc.code} {body}".strip()
    except Exception as exc:  # noqa: BLE001 — CLI should report any endpoint/network issue.
        return False, repr(exc)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print payload summary without submitting")
    parser.add_argument("--wait", type=int, default=0, help="Wait N seconds before submitting (useful after GitHub Pages deploy)")
    args = parser.parse_args()

    urls = load_urls()
    payload_dict = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }
    payload = json.dumps(payload_dict, ensure_ascii=False).encode("utf-8")

    print(f"IndexNow payload: {len(urls)} URL(s), keyLocation={KEY_LOCATION}")
    for url in urls[:10]:
        print(f"  - {url}")
    if len(urls) > 10:
        print(f"  ... {len(urls) - 10} more")

    if args.dry_run:
        return 0
    if args.wait > 0:
        print(f"Waiting {args.wait}s before submission...")
        time.sleep(args.wait)

    failures = 0
    for endpoint in ENDPOINTS:
        ok, message = submit(endpoint, payload)
        mark = "✅" if ok else "❌"
        print(f"{mark} {endpoint}: {message}")
        if not ok:
            failures += 1

    # Some engines may occasionally rate-limit; fail only if all endpoints failed.
    if failures == len(ENDPOINTS):
        print("All IndexNow endpoints failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
