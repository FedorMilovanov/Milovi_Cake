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
HTTP_HOST = "http://milovicake.ru"
WWW_HOST = "https://www.milovicake.ru"
TIMEOUT = 20
INDEXNOW_KEY = "f5c91a4d89e84b2ca6d4f3e7a1029b6c"

LEAN_LANDING_PATHS = [
    "/zakazat-tort-spb/",
    "/tort-s-dostavkoy/",
    "/tort-na-den-rozhdeniya/",
    "/bento-torty/",
    "/detskie-torty/",
    "/svadebnye-torty/",
    "/o-konditere/",
    "/dostavka-i-oplata/",
    "/otzyvy/",
]

URLS = [
    "/",
    *LEAN_LANDING_PATHS,
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
    required: bool = True


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Keep the first HTTP response visible instead of following redirects."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def request(
    url: str,
    *,
    follow_redirects: bool = True,
    read_limit: int = 600_000,
) -> tuple[int, str, dict[str, str], str, float]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "MiloviCakeProductionSmoke/1.1 (+https://milovicake.ru)",
            "Cache-Control": "no-cache",
        },
    )
    opener = urllib.request.build_opener() if follow_redirects else urllib.request.build_opener(NoRedirect)
    started = time.monotonic()
    try:
        with opener.open(req, timeout=TIMEOUT) as resp:
            raw = resp.read(read_limit)
            charset = resp.headers.get_content_charset() or "utf-8"
            return (
                resp.status,
                raw.decode(charset, errors="replace"),
                dict(resp.headers.items()),
                resp.geturl(),
                time.monotonic() - started,
            )
    except urllib.error.HTTPError as exc:
        # With redirects disabled urllib represents 3xx as HTTPError. Preserve
        # the response metadata so the redirect itself can be diagnosed.
        if not follow_redirects and 300 <= exc.code < 400:
            raw = exc.read(read_limit)
            charset = exc.headers.get_content_charset() or "utf-8"
            return (
                exc.code,
                raw.decode(charset, errors="replace"),
                dict(exc.headers.items()),
                exc.geturl(),
                time.monotonic() - started,
            )
        raise


def fetch(path: str) -> tuple[int, str, dict[str, str], str, float]:
    return request(HOST + path)


def run_transport_checks() -> list[Result]:
    """Check the transport paths that external uptime monitors actually hit."""
    results: list[Result] = []

    try:
        status, _body, headers, _final_url, elapsed = request(
            HTTP_HOST + "/", follow_redirects=False, read_limit=16_384
        )
        location = headers.get("Location", "")
        acceptable = status == 200 or status in {301, 302}
        redirect_ok = status == 200 or location.startswith(HOST)
        results.append(
            Result(
                "transport:http-apex",
                acceptable and redirect_ok,
                status,
                f"{elapsed:.3f}s" + (f" -> {location}" if location else " direct HTTP response"),
            )
        )
    except Exception as exc:  # noqa: BLE001 — transport diagnostics must expose any network issue.
        results.append(Result("transport:http-apex", False, None, repr(exc)))

    try:
        status, _body, _headers, final_url, elapsed = request(HOST + "/", read_limit=16_384)
        results.append(
            Result(
                "transport:https-apex",
                200 <= status < 400 and final_url.startswith(HOST),
                status,
                f"{elapsed:.3f}s -> {final_url}",
            )
        )
    except Exception as exc:  # noqa: BLE001
        results.append(Result("transport:https-apex", False, None, repr(exc)))

    # www is intentionally informational until DNS intent is confirmed in the
    # uptime incident. It must not turn production smoke red on its own.
    try:
        status, _body, _headers, final_url, elapsed = request(WWW_HOST + "/", read_limit=16_384)
        results.append(
            Result(
                "transport:www-https",
                200 <= status < 400,
                status,
                f"{elapsed:.3f}s -> {final_url}",
                required=False,
            )
        )
    except Exception as exc:  # noqa: BLE001
        results.append(Result("transport:www-https", False, None, repr(exc), required=False))

    return results


def run_checks() -> tuple[list[Result], dict[str, str]]:
    results: list[Result] = run_transport_checks()
    bodies: dict[str, str] = {}

    for path in URLS:
        try:
            status, body, _headers, final_url, elapsed = fetch(path)
            bodies[path] = body
            results.append(Result(path, 200 <= status < 400, status, f"OK {elapsed:.3f}s -> {final_url}"))
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
        results.append(
            Result(
                "/ content:no old hours",
                "Пн–Вс" not in home and "Sunday" not in home,
                200,
                "old hours absent",
            )
        )
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

    # Lean landing pages should stay lightweight on production too: only style.css from local CSS.
    for path in LEAN_LANDING_PATHS:
        body = bodies.get(path, "")
        css_hrefs = re.findall(
            r"<link[^>]+rel=[\"']stylesheet[\"'][^>]+href=[\"']([^\"']+)[\"']",
            body,
            flags=re.I,
        )
        local_css = sorted(
            href.split("?")[0]
            for href in css_hrefs
            if href.startswith("/css/") or href.startswith("css/")
        )
        ok = local_css == ["/css/style.css"]
        results.append(Result(f"{path} lean CSS", ok, 200, f"{local_css}" if not ok else "style.css only"))

    key_body = bodies.get(f"/{INDEXNOW_KEY}.txt", "").strip()
    results.append(
        Result(
            "IndexNow key file",
            key_body == INDEXNOW_KEY,
            200,
            "matches" if key_body == INDEXNOW_KEY else "mismatch",
        )
    )

    return results, bodies


def print_results(results: list[Result], attempt: int | None = None) -> None:
    if attempt is not None:
        print(f"\nProduction smoke attempt {attempt}")
    for r in results:
        if not r.required:
            mark = "ℹ️" if r.ok else "⚠️"
            requirement = "informational"
        else:
            mark = "✅" if r.ok else "❌"
            requirement = "required"
        print(f"{mark} {r.url} [{r.status}] {r.message} ({requirement})")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retries", type=int, default=1, help="Number of attempts before failing")
    parser.add_argument("--delay", type=int, default=30, help="Delay in seconds between attempts")
    parser.add_argument(
        "--quiet-passed-attempts",
        action="store_true",
        help="Only print detailed output for final attempt or failure",
    )
    args = parser.parse_args()

    attempts = max(1, args.retries)
    last_results: list[Result] = []
    for attempt in range(1, attempts + 1):
        results, _bodies = run_checks()
        last_results = results
        failed = [r for r in results if r.required and not r.ok]
        if not failed:
            if not args.quiet_passed_attempts or attempt == attempts:
                print_results(results, attempt if attempts > 1 else None)
            informational_failures = [r for r in results if not r.required and not r.ok]
            print(
                f"\nProduction smoke PASSED: {len(results) - len(informational_failures)} "
                f"required/informational checks OK; {len(informational_failures)} informational warning(s)"
            )
            return 0

        print_results(results, attempt if attempts > 1 else None)
        if attempt < attempts:
            print(f"\n{len(failed)} required issue(s); waiting {args.delay}s before retry...", file=sys.stderr)
            time.sleep(args.delay)

    failed = [r for r in last_results if r.required and not r.ok]
    print(f"\nProduction smoke FAILED: {len(failed)} required issue(s)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
