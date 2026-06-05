#!/usr/bin/env python3
"""Production smoke checks for milovicake.ru.

Zero third-party dependencies. Intended for GitHub Actions/manual verification after
GitHub Pages has published a deploy.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

HOST = "https://milovicake.ru"
TIMEOUT = 20
INDEXNOW_KEY = "f5c91a4d89e84b2ca6d4f3e7a1029b6c"

URLS = [
    "/",
    "/zakazat-tort-spb/",
    "/tort-s-dostavkoy/",
    "/tort-na-den-rozhdeniya/",
    "/bento-torty/",
    "/detskie-torty/",
    "/svadebnye-torty/",
    "/o-konditere/",
    "/dostavka-i-oplata/",
    "/otzyvy/",
    "/gallery/",
    "/meringue-roll/",
    "/prigorody/pushkin/",
    "/sitemap.xml",
    "/robots.txt",
    f"/{INDEXNOW_KEY}.txt",
]


def expected_version() -> str:
    sw = (Path(__file__).resolve().parents[1] / "sw.js").read_text(encoding="utf-8", errors="replace")
    match = re.search(r"\?v=(\d{8}r\d+)", sw)
    if not match:
        raise RuntimeError("Could not detect cache-bust version from sw.js")
    return match.group(1)


EXPECTED_VERSION = expected_version()


@dataclass
class Result:
    url: str
    ok: bool
    status: int | None = None
    message: str = ""


def fetch(path: str) -> tuple[int, str, dict[str, str]]:
    req = urllib.request.Request(
        HOST + path,
        headers={
            "User-Agent": "MiloviCakeProductionSmoke/1.0 (+https://milovicake.ru)",
            "Cache-Control": "no-cache",
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read(600_000)
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.status, raw.decode(charset, errors="replace"), dict(resp.headers.items())


def run_checks() -> tuple[list[Result], dict[str, str]]:
    results: list[Result] = []
    bodies: dict[str, str] = {}

    for path in URLS:
        try:
            status, body, _headers = fetch(path)
            bodies[path] = body
            results.append(Result(path, 200 <= status < 400, status, "OK"))
        except urllib.error.HTTPError as exc:
            results.append(Result(path, False, exc.code, str(exc)))
        except Exception as exc:  # noqa: BLE001 — smoke must report any network issue.
            results.append(Result(path, False, None, repr(exc)))
        time.sleep(0.1)

    # Content-level checks.
    home = bodies.get("/", "")
    if home:
        for needle in [EXPECTED_VERSION, "Пн–Сб, 10:00–20:00", "https://milovicake.ru/#business"]:
            results.append(Result(f"/ content:{needle}", needle in home, 200, "found" if needle in home else "missing"))
        results.append(Result("/ content:no old hours", "Пн–Вс" not in home and "Sunday" not in home, 200, "old hours absent"))
    else:
        results.append(Result("/ content", False, None, "homepage body unavailable"))

    sitemap = bodies.get("/sitemap.xml", "")
    if sitemap:
        expected_locs = [HOST + path for path in URLS if path.endswith("/") and path != "/call/"]
        for loc in expected_locs:
            results.append(Result(f"sitemap:{loc}", loc in sitemap, 200, "present" if loc in sitemap else "missing"))
        results.append(Result("sitemap:no /call/", f"{HOST}/call/" not in sitemap, 200, "/call/ absent"))
    else:
        results.append(Result("sitemap content", False, None, "sitemap body unavailable"))

    key_body = bodies.get(f"/{INDEXNOW_KEY}.txt", "").strip()
    results.append(Result("IndexNow key file", key_body == INDEXNOW_KEY, 200, "matches" if key_body == INDEXNOW_KEY else "mismatch"))

    return results, bodies


def print_results(results: list[Result], attempt: int | None = None) -> None:
    if attempt is not None:
        print(f"\nProduction smoke attempt {attempt}")
    for r in results:
        mark = "✅" if r.ok else "❌"
        print(f"{mark} {r.url} [{r.status}] {r.message}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retries", type=int, default=1, help="Number of attempts before failing")
    parser.add_argument("--delay", type=int, default=30, help="Delay in seconds between attempts")
    parser.add_argument("--quiet-passed-attempts", action="store_true", help="Only print detailed output for final attempt or failure")
    args = parser.parse_args()

    attempts = max(1, args.retries)
    last_results: list[Result] = []
    for attempt in range(1, attempts + 1):
        results, _bodies = run_checks()
        last_results = results
        failed = [r for r in results if not r.ok]
        if not failed:
            if not args.quiet_passed_attempts or attempt == attempts:
                print_results(results, attempt if attempts > 1 else None)
            print(f"\nProduction smoke PASSED: {len(results)} checks")
            return 0

        print_results(results, attempt if attempts > 1 else None)
        if attempt < attempts:
            print(f"\n{len(failed)} issue(s); waiting {args.delay}s before retry...", file=sys.stderr)
            time.sleep(args.delay)

    failed = [r for r in last_results if not r.ok]
    print(f"\nProduction smoke FAILED: {len(failed)} issue(s)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
