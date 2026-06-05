#!/usr/bin/env python3
"""Production smoke checks for milovicake.ru.

Zero third-party dependencies. Intended for GitHub Actions/manual verification after
GitHub Pages has published a deploy.
"""
from __future__ import annotations

import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

HOST = "https://milovicake.ru"
TIMEOUT = 20
EXPECTED_VERSION = "20260605r51"
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


def main() -> int:
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

    sitemap = bodies.get("/sitemap.xml", "")
    if sitemap:
        expected_locs = [HOST + path for path in URLS if path.endswith("/") and path != "/call/"]
        for loc in expected_locs:
            results.append(Result(f"sitemap:{loc}", loc in sitemap, 200, "present" if loc in sitemap else "missing"))
        results.append(Result("sitemap:no /call/", f"{HOST}/call/" not in sitemap, 200, "/call/ absent"))

    key_body = bodies.get(f"/{INDEXNOW_KEY}.txt", "").strip()
    results.append(Result("IndexNow key file", key_body == INDEXNOW_KEY, 200, "matches" if key_body == INDEXNOW_KEY else "mismatch"))

    failed = [r for r in results if not r.ok]
    for r in results:
        mark = "✅" if r.ok else "❌"
        print(f"{mark} {r.url} [{r.status}] {r.message}")

    if failed:
        print(f"\nProduction smoke FAILED: {len(failed)} issue(s)", file=sys.stderr)
        return 1
    print(f"\nProduction smoke PASSED: {len(results)} checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
