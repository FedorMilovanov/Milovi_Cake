#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║  MILOVI CAKE — Professional Audit System v1.0 (May 2026)              ║
║                                                                        ║
║  Zero-dependency Python 3.9+ audit for vanilla HTML/CSS/JS sites.     ║
║  Runs 19 checks covering SEO, PWA, structure, versions, a11y, etc.   ║
║                                                                        ║
║  Usage:  python3 scripts/audit.py                                      ║
║  CI:     Exit code 1 if any ERROR found, 0 otherwise                  ║
╚══════════════════════════════════════════════════════════════════════════╝
"""
from __future__ import annotations

import csv
import gzip
import json
import os
import re
import sys
import html.parser
import time
from pathlib import Path
from urllib.parse import urlparse, unquote
from datetime import datetime, timezone
from collections import Counter

# ─── Configuration ────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://milovicake.ru"
REPORT_DIR = ROOT / "audit"

# Allowed CSS files (AGENTS.md §2 + AI_DO_NOT_TOUCH §9)
ALLOWED_CSS = {
    "css/style.css",
    "css/mc-2026.css",
    "css/premium-overrides.css",
    "css/v20-dark-and-fixes.css",
    "css/v20-fixes.css",
    "css/final-fixes.css",
    "css/gallery/gallery-2026.css",
}

# Allowed JS files (AI_DO_NOT_TOUCH §9: 6 files)
ALLOWED_JS = {
    "js/main.js",
    "js/nav.js",
    "js/mc-2026.js",
    "js/v20-faq-fix.js",
    "js/gallery/main.js",
    "js/gallery/data.js",
}

# Size budgets (bytes)
# Raw CSS/JS in this project intentionally includes readable fallback/override layers.
# For a GitHub Pages static site, the deploy-relevant budget is compressed transfer size.
MAX_CSS_TOTAL = 300_000          # legacy raw reference, reported as info only
MAX_JS_TOTAL = 200_000           # legacy raw reference, reported as info only
MAX_SINGLE_CSS = 120_000         # legacy raw reference, reported as info only
MAX_SINGLE_JS = 200_000          # legacy raw reference, reported as info only
MAX_CSS_GZIP = 100_000
MAX_JS_GZIP = 80_000
MAX_TOTAL_GZIP = 180_000
MAX_HTML = 200_000

# SEO limits
MIN_DESC_LEN = 50
MAX_DESC_LEN = 160

# Dev/tooling directories are not part of the deployed GitHub Pages site.
# Keep runtime structure strict while allowing local Playwright/node tooling.
EXCLUDED_AUDIT_DIRS = {
    "node_modules",
    ".git",
    ".cache",
    ".pytest_cache",
    "playwright-report",
    "test-results",
}
DEV_TOOLING_JS = {
    "playwright.config.js",
    "tests/landing-smoke.spec.js",
    "tests/theme-smoke.spec.js",
    "tests/protected-interactions.spec.js",
}

# Current !important debt is intentionally budgeted instead of blindly removed:
# many declarations protect fragile premium UI states. The audit fails only if
# future changes increase the baseline without an explicit budget update.
IMPORTANT_BUDGET = {
    "css/premium-overrides.css": 656,
    "css/v20-dark-and-fixes.css": 600,
    "css/mc-2026.css": 199,
    "css/style.css": 124,
    "css/final-fixes.css": 129,
    "css/gallery/gallery-2026.css": 24,
    "css/v20-fixes.css": 10,
}

LEAN_LANDING_PAGES = {
    "zakazat-tort-spb/index.html",
    "tort-s-dostavkoy/index.html",
    "tort-na-den-rozhdeniya/index.html",
    "bento-torty/index.html",
    "detskie-torty/index.html",
    "svadebnye-torty/index.html",
    "o-konditere/index.html",
    "dostavka-i-oplata/index.html",
    "otzyvy/index.html",
}


def relpath(p: Path) -> str:
    return str(p.relative_to(ROOT)).replace(os.sep, "/")


def is_excluded_path(p: Path) -> bool:
    try:
        rel_parts = p.relative_to(ROOT).parts
    except ValueError:
        rel_parts = p.parts
    return any(part in EXCLUDED_AUDIT_DIRS for part in rel_parts)


# ─── Minimal HTML Parser ──────────────────────────────────────────────────

class TagCollector(html.parser.HTMLParser):
    """Extracts structured data from HTML — zero external deps."""
    def __init__(self):
        super().__init__()
        self.tags = []
        self.ids = []
        self.links = []
        self.stylesheets = []
        self.scripts = []
        self.images = []
        self.h1s = []
        self.metas = {}
        self.og_tags = {}
        self._in_json_ld = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        self.tags.append((tag, a, line))

        if tag == "link":
            rel_val = a.get("rel", "")
            if rel_val == "stylesheet" or (isinstance(rel_val, str) and "stylesheet" in rel_val):
                self.stylesheets.append(a.get("href", ""))
            if rel_val == "canonical" or (isinstance(rel_val, str) and "canonical" in rel_val):
                self.links.append(("canonical", a.get("href", "")))
        elif tag == "a":
            self.links.append(("a", a.get("href", "")))
        elif tag == "script":
            src = a.get("src", "")
            if src:
                self.scripts.append(src)
            t = a.get("type", "")
            if t == "application/ld+json":
                self._in_json_ld = True
        elif tag == "img":
            self.images.append({
                "src": a.get("src", ""),
                "alt": a.get("alt"),
                "line": line,
            })
        elif tag == "h1":
            self.h1s.append({"line": line})
        elif tag == "meta":
            name = a.get("name", "").lower()
            prop = a.get("property", "").lower()
            content = a.get("content", "")
            charset = a.get("charset", "").lower()
            if charset:
                self.metas["charset"] = charset
            http_equiv = a.get("http-equiv", "").lower()
            if http_equiv == "content-type":
                self.metas["content-type"] = content
            if name:
                self.metas[name] = content
            if prop.startswith("og:"):
                self.og_tags[prop] = content

        if "id" in a:
            self.ids.append((a["id"], line))

    def handle_data(self, data):
        pass

    def handle_comment(self, data):
        pass

    def error(self, message):
        pass


def parse_html(path: Path) -> TagCollector:
    text = path.read_text(encoding="utf-8", errors="replace")
    p = TagCollector()
    try:
        p.feed(text)
    except Exception:
        pass
    return p


def extract_json_ld(text: str) -> list[str]:
    """Return raw JSON-LD script payloads from an HTML document."""
    return re.findall(
        r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>\s*(.*?)\s*</script>",
        text,
        flags=re.I | re.S,
    )


def iter_schema_nodes(data):
    """Yield top-level schema nodes, expanding @graph and JSON arrays."""
    if isinstance(data, dict):
        yield data
        graph = data.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                if isinstance(item, dict):
                    yield item
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                yield item


# ─── Reporting ────────────────────────────────────────────────────────────

class AuditReport:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed: list[str] = []
        self.info: list[str] = []
        self.section_times: dict[str, float] = {}

    def err(self, msg: str):
        self.errors.append(msg)

    def warn(self, msg: str):
        self.warnings.append(msg)

    def ok(self, msg: str):
        self.passed.append(msg)

    def note(self, msg: str):
        self.info.append(msg)

    def section(self, name: str):
        class _Ctx:
            def __init__(self, report, n):
                self.report = report
                self.name = n
                self.t = 0.0
            def __enter__(self):
                self.t = time.monotonic()
                return self.report
            def __exit__(self, *a):
                self.report.section_times[self.name] = time.monotonic() - self.t
        return _Ctx(self, name)


R = AuditReport()

# ─── HTML Pages Discovery ────────────────────────────────────────────────

html_pages = []
for p in ROOT.rglob("*.html"):
    if is_excluded_path(p):
        continue
    rel = relpath(p)
    if rel == "prigorody/_template.html":
        continue
    html_pages.append((rel, p))

R.note(f"Discovered {len(html_pages)} HTML pages to audit")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 1: File Structure Guard
# ═══════════════════════════════════════════════════════════════════════════

with R.section("1. File Structure Guard"):
    # CSS files
    actual_css = set()
    for p in ROOT.rglob("*.css"):
        if is_excluded_path(p):
            continue
        rel = relpath(p)
        actual_css.add(rel)

    forbidden_css = actual_css - ALLOWED_CSS
    missing_css = ALLOWED_CSS - actual_css

    if forbidden_css:
        R.err(f"Forbidden CSS files ({len(forbidden_css)}): {sorted(forbidden_css)}")
    if missing_css:
        R.err(f"Missing required CSS files ({len(missing_css)}): {sorted(missing_css)}")
    if not forbidden_css and not missing_css:
        R.ok(f"CSS structure: exactly {len(ALLOWED_CSS)} files as specified in AGENTS.md")

    # JS files
    actual_js = set()
    for p in ROOT.rglob("*.js"):
        if is_excluded_path(p):
            continue
        if p.name == "sw.js":
            continue
        rel = relpath(p)
        actual_js.add(rel)

    forbidden_js = actual_js - ALLOWED_JS - DEV_TOOLING_JS
    missing_js = ALLOWED_JS - actual_js

    if forbidden_js:
        R.err(f"Forbidden JS files ({len(forbidden_js)}): {sorted(forbidden_js)}")
    if missing_js:
        R.err(f"Missing required JS files ({len(missing_js)}): {sorted(missing_js)}")
    if not forbidden_js and not missing_js:
        R.ok(f"JS structure: exactly {len(ALLOWED_JS)} files as specified in AGENTS.md")

    # Lean landing pages intentionally load only shared style.css for performance.
    # This protects the CSS payload trim from accidental regression.
    landing_css_issues = []
    for rel in sorted(LEAN_LANDING_PAGES):
        path = ROOT / rel
        if not path.exists():
            landing_css_issues.append(f"{rel}: missing page")
            continue
        parsed = parse_html(path)
        local_styles = sorted(
            href.split("?")[0]
            for href in parsed.stylesheets
            if href.startswith("/css/") or href.startswith("css/") or href.startswith("../css/")
        )
        if local_styles != ["/css/style.css"]:
            landing_css_issues.append(f"{rel}: expected only /css/style.css, got {local_styles}")
    if landing_css_issues:
        for issue in landing_css_issues:
            R.err(f"Lean landing CSS: {issue}")
    else:
        R.ok(f"Lean landing CSS payload: {len(LEAN_LANDING_PAGES)} pages use only style.css")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 2: File Size Budget
# ═══════════════════════════════════════════════════════════════════════════

with R.section("2. File Size Budget"):
    css_total = 0
    js_total = 0

    large_raw_css = []
    large_raw_js = []

    for rel in sorted(ALLOWED_CSS):
        p = ROOT / rel
        if p.exists():
            sz = p.stat().st_size
            css_total += sz
            if sz > MAX_SINGLE_CSS:
                large_raw_css.append((rel, sz))

    for rel in sorted(ALLOWED_JS):
        p = ROOT / rel
        if p.exists():
            sz = p.stat().st_size
            js_total += sz
            if sz > MAX_SINGLE_JS:
                large_raw_js.append((rel, sz))

    # Gzip sizes (what actually ships over the wire)
    css_bytes = b"".join(
        (ROOT / rel).read_bytes() for rel in sorted(ALLOWED_CSS) if (ROOT / rel).exists()
    )
    js_bytes = b"".join(
        (ROOT / rel).read_bytes() for rel in sorted(ALLOWED_JS) if (ROOT / rel).exists()
    )
    gz_css = len(gzip.compress(css_bytes)) if css_bytes else 0
    gz_js = len(gzip.compress(js_bytes)) if js_bytes else 0
    gz_total = gz_css + gz_js

    if gz_css > MAX_CSS_GZIP:
        R.warn(f"Gzip CSS exceeds budget: {gz_css:,} bytes (budget {MAX_CSS_GZIP:,})")
    else:
        R.ok(f"Gzip CSS size: {gz_css:,} bytes (within {MAX_CSS_GZIP:,} budget)")

    if gz_js > MAX_JS_GZIP:
        R.warn(f"Gzip JS exceeds budget: {gz_js:,} bytes (budget {MAX_JS_GZIP:,})")
    else:
        R.ok(f"Gzip JS size: {gz_js:,} bytes (within {MAX_JS_GZIP:,} budget)")

    if gz_total > MAX_TOTAL_GZIP:
        R.warn(f"Total gzip CSS+JS exceeds budget: {gz_total:,} bytes (budget {MAX_TOTAL_GZIP:,})")
    else:
        R.ok(f"Total gzip CSS+JS: {gz_total:,} bytes (within {MAX_TOTAL_GZIP:,} budget)")

    if large_raw_css:
        R.note("Raw CSS reference: " + ", ".join(f"{rel} {sz:,} bytes" for rel, sz in large_raw_css))
    if large_raw_js:
        R.note("Raw JS reference: " + ", ".join(f"{rel} {sz:,} bytes" for rel, sz in large_raw_js))
    R.note(f"Raw CSS/JS totals: CSS {css_total:,} bytes | JS {js_total:,} bytes")
    R.note(f"Wire size (gzip): CSS {gz_css:,} bytes | JS {gz_js:,} bytes | Total {gz_total:,} bytes")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 3: Version Sync (sw.js ↔ HTML ?v= cache-bust)
# ═══════════════════════════════════════════════════════════════════════════

with R.section("3. Version Sync (sw.js ↔ HTML)"):
    sw_path = ROOT / "sw.js"
    if sw_path.exists():
        sw_text = sw_path.read_text(encoding="utf-8", errors="replace")

        # Extract CACHE_NAME
        cache_match = re.search(r"const\s+CACHE_NAME\s*=\s*'([^']+)'", sw_text)
        if cache_match:
            cache_name = cache_match.group(1)
            R.ok(f"SW CACHE_NAME: {cache_name}")
            date_match = re.search(r"(\d{4}\.\d{2}\.\d{2})", cache_name)
            if date_match:
                R.note(f"SW version date: {date_match.group(1)}")
        else:
            R.err("Cannot find CACHE_NAME in sw.js")
            cache_name = ""

        # Extract PRECACHE URLs
        precache_match = re.search(r"const\s+PRECACHE\s*=\s*\[([^\]]+)\]", sw_text, re.DOTALL)
        precache_urls = []
        if precache_match:
            for m in re.finditer(r"'([^']+)'", precache_match.group(1)):
                precache_urls.append(m.group(1))
            R.ok(f"PWA precache: {len(precache_urls)} URLs")
        else:
            R.err("Cannot find PRECACHE array in sw.js")

        # Check precache URLs exist on disk
        for url in precache_urls:
            clean = unquote(url.split("?")[0].split("#")[0]).lstrip("/")
            if not clean or clean == "/":
                continue
            target = ROOT / clean
            if not target.exists() and not (target / "index.html").exists():
                R.err(f"PWA precache missing file: {url} → {clean}")

        # Collect ?v= versions from sw.js
        sw_versions = set()
        for url in precache_urls:
            v_match = re.search(r"\?v=([^'\"&]+)", url)
            if v_match:
                sw_versions.add(v_match.group(1))

        # Cross-check HTML files
        version_mismatches = []
        for rel, path in html_pages:
            html_text = path.read_text(encoding="utf-8", errors="replace")
            for asset_rel in list(ALLOWED_CSS) + list(ALLOWED_JS):
                pattern = re.escape(asset_rel) + r"\?v=([^'\"&\s]+)"
                for m in re.finditer(pattern, html_text):
                    html_ver = m.group(1)
                    if html_ver not in sw_versions:
                        version_mismatches.append(
                            f"{rel}: {asset_rel}?v={html_ver} NOT in sw.js"
                        )

        if version_mismatches:
            for mm in version_mismatches[:25]:
                R.err(f"Version mismatch: {mm}")
            if len(version_mismatches) > 25:
                R.err(f"... and {len(version_mismatches) - 25} more")
        else:
            R.ok("?v= cache-bust synchronized across all HTML ↔ sw.js")

        # ESM relative imports are a separate browser cache path: an HTML script
        # may be versioned while its imported module is not. This previously hit
        # js/gallery/data.js, so make it a permanent guardrail.
        esm_import_issues = []
        expected_versions = set(sw_versions)
        import_re = re.compile(
            r"\bimport\s+(?:[^;'\"]*?\s+from\s+)?['\"]([^'\"]+\.js(?:\?v=([^'\"]+))?)['\"]"
        )
        for asset_rel in sorted(ALLOWED_JS):
            js_path = ROOT / asset_rel
            if not js_path.exists():
                continue
            js_text = js_path.read_text(encoding="utf-8", errors="replace")
            for m in import_re.finditer(js_text):
                spec = m.group(1)
                import_ver = m.group(2)
                if not spec.startswith("."):
                    continue
                target_rel = spec.split("?", 1)[0]
                target_path = (js_path.parent / target_rel).resolve()
                try:
                    target_path.relative_to(ROOT)
                except ValueError:
                    continue
                if not target_path.exists():
                    continue
                if not import_ver:
                    esm_import_issues.append(f"{asset_rel}: relative import lacks ?v=: {spec}")
                elif expected_versions and import_ver not in expected_versions:
                    esm_import_issues.append(
                        f"{asset_rel}: import version {import_ver} not in sw.js: {spec}"
                    )

        if esm_import_issues:
            for issue in esm_import_issues[:25]:
                R.err(f"ESM cache-bust: {issue}")
            if len(esm_import_issues) > 25:
                R.err(f"... and {len(esm_import_issues) - 25} more ESM import issues")
        else:
            R.ok("ESM relative imports are cache-busted")
    else:
        R.err("sw.js not found in project root")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 4: SEO Validation
# ═══════════════════════════════════════════════════════════════════════════

with R.section("4. SEO Validation"):
    seo_issues = []

    # Skip technical files: 404, search-engine verification files
    SEO_SKIP_PREFIXES = ("404.html", "google", "yandex")
    for rel, path in html_pages:
        if any(rel.startswith(p) for p in SEO_SKIP_PREFIXES):
            continue

        parsed = parse_html(path)

        # Meta description
        desc = parsed.metas.get("description", "")
        if not desc:
            seo_issues.append(f"{rel}: missing <meta name='description'>")
        elif len(desc) < MIN_DESC_LEN:
            seo_issues.append(f"{rel}: description too short ({len(desc)} chars, min {MIN_DESC_LEN})")
        elif len(desc) > MAX_DESC_LEN:
            seo_issues.append(f"{rel}: description too long ({len(desc)} chars, max {MAX_DESC_LEN})")

        # Canonical
        canonicals = [h for k, h in parsed.links if k == "canonical"]
        if not canonicals and rel != "prigorody/index.html":
            seo_issues.append(f"{rel}: missing <link rel='canonical'>")

        # Open Graph
        if not parsed.og_tags:
            if rel not in ("index.html",):
                seo_issues.append(f"{rel}: no Open Graph tags")

        # H1
        if not parsed.h1s:
            if "prigorody/" not in rel:
                seo_issues.append(f"{rel}: missing <h1>")
        elif len(parsed.h1s) > 1:
            seo_issues.append(f"{rel}: multiple <h1> tags ({len(parsed.h1s)})")

        # lang attribute
        has_lang = any(t == "html" and "lang" in a for t, a, _ in parsed.tags)
        if not has_lang:
            seo_issues.append(f"{rel}: missing lang on <html>")

        # Viewport
        if "viewport" not in parsed.metas:
            seo_issues.append(f"{rel}: missing viewport meta")

    for issue in seo_issues:
        R.err(f"SEO: {issue}")

    if not seo_issues:
        R.ok(f"SEO validation passed for {len(html_pages)} pages")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 4b: Structured Data JSON-LD Integrity
# ═══════════════════════════════════════════════════════════════════════════

with R.section("4b. Structured Data JSON-LD Integrity"):
    schema_issues = []
    schema_pages = 0

    for rel, path in html_pages:
        if any(rel.startswith(p) for p in ("404.html", "google", "yandex")):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        parsed = parse_html(path)
        robots_meta = parsed.metas.get("robots", "").lower()
        if "noindex" in robots_meta:
            continue

        blocks = extract_json_ld(text)
        if not blocks:
            schema_issues.append(f"{rel}: missing JSON-LD on indexable page")
            continue

        schema_pages += 1
        page_ids = []
        page_types = []
        for idx, block in enumerate(blocks, start=1):
            try:
                data = json.loads(block)
            except json.JSONDecodeError as exc:
                schema_issues.append(f"{rel}: invalid JSON-LD block {idx}: {exc.msg}")
                continue
            for node in iter_schema_nodes(data):
                node_type = node.get("@type")
                if node_type:
                    if isinstance(node_type, list):
                        page_types.extend(str(t) for t in node_type)
                    else:
                        page_types.append(str(node_type))
                node_id = node.get("@id")
                if node_id:
                    page_ids.append(str(node_id))

        duplicate_ids = sorted({sid for sid in page_ids if page_ids.count(sid) > 1})
        if duplicate_ids:
            schema_issues.append(f"{rel}: duplicate JSON-LD @id within page: {duplicate_ids[:5]}")

        if rel == "index.html":
            required = {"Organization", "Person", "LocalBusiness", "Bakery", "WebSite", "WebPage", "ItemList", "FAQPage", "HowTo", "BreadcrumbList"}
            missing = sorted(required - set(page_types))
            if missing:
                schema_issues.append(f"index.html: homepage schema missing required types: {missing}")
            if len(blocks) != 1:
                schema_issues.append(f"index.html: homepage should use one consolidated JSON-LD @graph, found {len(blocks)} blocks")

    if schema_issues:
        for issue in schema_issues:
            R.err(f"Schema: {issue}")
    else:
        R.ok(f"JSON-LD validation passed for {schema_pages} indexable pages")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 5: Accessibility (a11y) Basics
# ═══════════════════════════════════════════════════════════════════════════

with R.section("5. Accessibility (a11y)"):
    a11y_issues = []

    for rel, path in html_pages:
        parsed = parse_html(path)

        # Images without alt attribute
        for img in parsed.images:
            if img["alt"] is None:
                src = img["src"][:60]
                a11y_issues.append(f"{rel}:{img['line']} <img> missing alt (src={src})")

        # Buttons without accessible text
        html_text = path.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"<button([^>]*)>(.*?)</button>", html_text, re.DOTALL | re.IGNORECASE):
            attrs_str = m.group(1)
            content = m.group(2).strip()
            has_aria = "aria-label" in attrs_str.lower()
            has_title = "title=" in attrs_str.lower()
            has_img_alt = bool(re.search(r"<img[^>]+alt=['\"][^'\"]+['\"]", content, re.IGNORECASE))
            has_svg_title = bool(re.search(r"<title>", content, re.IGNORECASE))
            text_only = re.sub(r"<[^>]+>", "", content).strip()

            if not any([text_only, has_aria, has_title, has_img_alt, has_svg_title]):
                snippet = m.group(0)[:80]
                a11y_issues.append(f"{rel}: button without text: {snippet}...")

    for issue in a11y_issues[:30]:
        R.warn(f"a11y: {issue}")
    if len(a11y_issues) > 30:
        R.warn(f"a11y: ... and {len(a11y_issues) - 30} more")

    if not a11y_issues:
        R.ok(f"a11y checks passed for {len(html_pages)} pages")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 6: Duplicate IDs per Page
# ═══════════════════════════════════════════════════════════════════════════

with R.section("6. Duplicate IDs"):
    dup_count = 0
    for rel, path in html_pages:
        parsed = parse_html(path)
        id_counts = Counter(id_val for id_val, _ in parsed.ids)
        for id_val, count in id_counts.items():
            if count > 1:
                R.err(f"Duplicate ID: #{id_val} ×{count} in {rel}")
                dup_count += 1
    if dup_count == 0:
        R.ok("No duplicate IDs across all pages")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 7: Internal Link Integrity
# ═══════════════════════════════════════════════════════════════════════════

with R.section("7. Internal Link Integrity"):
    broken_links = []
    checked_hrefs = set()

    for rel, path in html_pages:
        parsed = parse_html(path)
        for kind, href in parsed.links:
            if kind == "canonical" or not href:
                continue
            if href.startswith(("http://", "https://", "mailto:", "tel:", "javascript:", "#", "data:")):
                continue

            clean = unquote(href.split("#")[0].split("?")[0]).lstrip("/")
            if not clean:
                continue

            key = (rel, clean)
            if key in checked_hrefs:
                continue
            checked_hrefs.add(key)

            target = ROOT / clean
            if target.exists():
                continue
            if (target / "index.html").exists():
                continue
            if target.suffix == "" and (ROOT / (clean + ".html")).exists():
                continue

            broken_links.append(f"{rel} → /{clean}")

    for bl in broken_links[:50]:
        R.warn(f"Broken link: {bl}")
    if len(broken_links) > 50:
        R.warn(f"... and {len(broken_links) - 50} more broken links")

    if not broken_links:
        R.ok(f"All internal links valid ({len(checked_hrefs)} checked)")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 8: PWA / Manifest Validation
# ═══════════════════════════════════════════════════════════════════════════

with R.section("8. PWA / Manifest"):
    manifest_path = ROOT / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            R.ok("manifest.json is valid JSON")

            required_fields = ["name", "short_name", "start_url", "display", "icons"]
            for field in required_fields:
                if field not in manifest:
                    R.err(f"manifest.json missing: {field}")

            if "icons" in manifest:
                for icon in manifest["icons"]:
                    src = icon.get("src", "").lstrip("/")
                    if src and not (ROOT / src).exists():
                        R.err(f"Manifest icon missing on disk: {src}")

            if "screenshots" in manifest:
                for sc in manifest["screenshots"]:
                    src = sc.get("src", "").lstrip("/")
                    if src and not (ROOT / src).exists():
                        R.warn(f"Manifest screenshot missing: {src}")

            R.note(f"PWA theme: {manifest.get('theme_color', 'N/A')} | bg: {manifest.get('background_color', 'N/A')}")

        except json.JSONDecodeError as e:
            R.err(f"manifest.json invalid JSON: {e}")
    else:
        R.err("manifest.json not found")

    # SW registration
    sw_reg_found = False
    for rel, path in html_pages[:5]:
        text = path.read_text(encoding="utf-8", errors="replace")
        if "serviceWorker" in text or "navigator.serviceWorker" in text:
            R.ok(f"SW registration in: {rel}")
            sw_reg_found = True
            break

    if not sw_reg_found:
        R.note("SW registration might be in main.js (check manually)")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 9: Prigorody Build Integrity
# ═══════════════════════════════════════════════════════════════════════════

with R.section("9. Prigorody Build Integrity"):
    csv_path = ROOT / "prigorody" / "_cities.csv"
    template_path = ROOT / "prigorody" / "_template.html"

    if csv_path.exists() and template_path.exists():
        city_slugs = []
        try:
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    slug = row.get("slug", "").strip()
                    if slug:
                        city_slugs.append(slug)
            R.ok(f"CSV defines {len(city_slugs)} cities")
        except Exception as e:
            R.err(f"Cannot parse _cities.csv: {e}")

        # All cities have generated pages?
        missing_cities = []
        for slug in city_slugs:
            city_dir = ROOT / "prigorody" / slug
            if not city_dir.exists() or not (city_dir / "index.html").exists():
                missing_cities.append(slug)

        if missing_cities:
            R.err(f"Missing city pages ({len(missing_cities)}): {missing_cities}")
        else:
            R.ok(f"All {len(city_slugs)} cities have generated pages")

        # No stale template variables
        template_text = template_path.read_text(encoding="utf-8", errors="replace")
        all_vars = set(re.findall(r"\{\{(\w+)\}\}", template_text))

        stale_vars = []
        for slug in city_slugs[:3]:
            city_html = ROOT / "prigorody" / slug / "index.html"
            if city_html.exists():
                text = city_html.read_text(encoding="utf-8", errors="replace")
                for var in all_vars:
                    if "{{" + var + "}}" in text:
                        stale_vars.append(f"{slug}: {{{{{var}}}}}")

        if stale_vars:
            for sv in stale_vars:
                R.err(f"Stale template variable in generated page: {sv}")
        else:
            R.ok(f"No stale template vars in generated pages (checked {min(3, len(city_slugs))} cities)")

    else:
        if not csv_path.exists():
            R.err("prigorody/_cities.csv not found")
        if not template_path.exists():
            R.err("prigorody/_template.html not found")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 10: Forbidden Patterns
# ═══════════════════════════════════════════════════════════════════════════

with R.section("10. Forbidden Patterns"):
    # !important budget guard. Existing debt is tracked as a baseline because
    # many declarations protect fragile premium UI states. New increases warn.
    important_counts = {}
    important_over_budget = []
    for rel in ALLOWED_CSS:
        p = ROOT / rel
        if p.exists():
            text = p.read_text(encoding="utf-8", errors="replace")
            count = text.count("!important")
            if count > 0:
                important_counts[rel] = count
            budget = IMPORTANT_BUDGET.get(rel, 0)
            if count > budget:
                important_over_budget.append(f"{rel}: {count} (budget {budget})")

    if important_over_budget:
        for item in important_over_budget:
            R.warn(f"!important budget exceeded: {item}")
    else:
        R.ok("!important counts within protected baseline budget")

    if important_counts:
        R.note(f"!important counts: {dict(sorted(important_counts.items(), key=lambda x: -x[1]))}")
    else:
        R.ok("No !important in CSS")

    # console.log in production JS
    for rel in ALLOWED_JS:
        p = ROOT / rel
        if p.exists():
            text = p.read_text(encoding="utf-8", errors="replace")
            count = len(re.findall(r'console\.log\s*\(', text))
            if count > 0:
                R.warn(f"console.log in {rel}: {count} occurrences")

    # Protected UI contracts: static guard for elements that are historically fragile.
    protected_issues = []
    protected_files = {
        "index.html": (ROOT / "index.html").read_text(encoding="utf-8", errors="replace"),
        "prigorody/_template.html": (ROOT / "prigorody" / "_template.html").read_text(encoding="utf-8", errors="replace"),
        "css/premium-overrides.css": (ROOT / "css" / "premium-overrides.css").read_text(encoding="utf-8", errors="replace"),
        "css/final-fixes.css": (ROOT / "css" / "final-fixes.css").read_text(encoding="utf-8", errors="replace"),
        "js/main.js": (ROOT / "js" / "main.js").read_text(encoding="utf-8", errors="replace"),
    }

    def require_contains(rel, needle, label=None):
        if needle not in protected_files.get(rel, ""):
            protected_issues.append(f"{rel}: missing {label or needle}")

    def require_count(rel, needle, min_count, label=None):
        count = protected_files.get(rel, "").count(needle)
        if count < min_count:
            protected_issues.append(f"{rel}: {label or needle} count {count}, expected ≥ {min_count}")

    # Hero messengers: round SVG ring icons with flat label hover must remain intact.
    for needle in ("messenger-group--ring", "btn-hero-ring", "btn-hero-wa", "btn-hero-tg", "btn-hero-max"):
        require_contains("index.html", needle)
    require_count("index.html", "hero-ring-text", 3, "hero ring text SVG labels")
    require_count("index.html", "hero-flat-text", 3, "hero flat text SVG labels")
    require_contains("css/premium-overrides.css", "AI DO NOT TOUCH — R10 PROTECTED BLOCK", "R10 protected CSS marker")
    require_contains("css/premium-overrides.css", "PATCH R9", "R9/R10 protected CSS marker")
    require_contains("css/final-fixes.css", ".hero-actions .btn-hero-messenger:hover .hero-flat-text", "final hero messenger hover override")
    require_contains("css/final-fixes.css", ".hero-actions .btn-hero-messenger:hover .hero-ring-text", "final hero ring hover override")
    require_contains("js/main.js", ".hero-ring-text, [id^=\"ring-text-\"]", "class/id hero ring fallback")
    require_contains("js/main.js", ".hero-flat-text, [id^=\"flat-text-\"]", "class/id hero flat fallback")
    require_contains("js/main.js", "function initMessengerRings", "messenger ring JS initializer")

    # Premium reviews carousel and modals.
    for needle in ("id=\"reviews\"", "id=\"stage\"", "id=\"track\"", "id=\"btnPrev\"", "id=\"btnNext\"", "id=\"reviewsModal\""):
        require_contains("index.html", needle)
    for needle in ("function openReviewsModal", "window.openReviewsModal = openReviewsModal", "reviewsGoTo = goTo", "function startTypewriter"):
        require_contains("js/main.js", needle)

    # Prigorody lightbox and cart/theme protected contracts.
    require_contains("prigorody/_template.html", "class=\"lightbox\" id=\"lightbox\"", "prigorody catalog lightbox")
    for needle in ("function buildCartKey", "function parseCartKey"):
        require_contains("js/main.js", needle)
    for needle in ("theme-icon--moon", "theme-icon--sun"):
        require_contains("index.html", needle)

    if protected_issues:
        for issue in protected_issues:
            R.err(f"Protected UI contract: {issue}")
    else:
        R.ok("Protected UI contracts intact (hero messengers, reviews, cart, theme, prigorody lightbox)")

    # TODO / FIXME / HACK
    for rel in list(ALLOWED_CSS) + list(ALLOWED_JS):
        p = ROOT / rel
        if p.exists():
            text = p.read_text(encoding="utf-8", errors="replace")
            for m in re.finditer(r'(TODO|FIXME|HACK|XXX)\b', text, re.IGNORECASE):
                line = text[:m.start()].count("\n") + 1
                R.warn(f"{rel}:{line} {m.group(1)} found")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 11: Encoding (UTF-8)
# ═══════════════════════════════════════════════════════════════════════════

with R.section("11. Encoding (UTF-8)"):
    encoding_issues = []
    text_extensions = {".html", ".css", ".js", ".json", ".svg", ".txt", ".xml", ".webmanifest", ".md"}

    for p in ROOT.rglob("*"):
        if is_excluded_path(p):
            continue
        if p.is_file() and p.suffix.lower() in text_extensions:
            try:
                content = p.read_text(encoding="utf-8")
                if "\ufffd" in content:
                    encoding_issues.append(relpath(p))
            except UnicodeDecodeError:
                encoding_issues.append(relpath(p))

    if encoding_issues:
        for ei in encoding_issues[:20]:
            R.err(f"Broken UTF-8: {ei}")
    else:
        R.ok("All text files valid UTF-8")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 12: robots.txt & Sitemap
# ═══════════════════════════════════════════════════════════════════════════

with R.section("12. robots.txt & Sitemap"):
    robots_path = ROOT / "robots.txt"
    if robots_path.exists():
        R.ok("robots.txt found")
        robots_text = robots_path.read_text(encoding="utf-8", errors="replace")
        if "Sitemap:" in robots_text:
            sitemap_urls = re.findall(r"Sitemap:\s*(\S+)", robots_text)
            R.ok(f"Sitemaps: {sitemap_urls}")
        else:
            R.warn("robots.txt missing Sitemap reference")

        if "Host:" in robots_text:
            host_match = re.search(r"Host:\s*(\S+)", robots_text)
            if host_match:
                R.note(f"Host: {host_match.group(1)}")
    else:
        R.warn("robots.txt not found")

    sitemap_path = ROOT / "sitemap.xml"
    if sitemap_path.exists():
        R.ok("sitemap.xml found")
        sitemap_text = sitemap_path.read_text(encoding="utf-8", errors="replace")
        sitemap_locs = set(re.findall(r"<loc>(https://milovicake\.ru/[^<]*)</loc>", sitemap_text))

        def html_to_url(rel: str, path: Path):
            # Technical pages intentionally stay out of the public sitemap.
            if rel == "404.html" or rel.startswith(("google", "yandex")):
                return None
            parsed = parse_html(path)
            robots_meta = parsed.metas.get("robots", "").lower()
            if "noindex" in robots_meta:
                return None
            if rel == "index.html":
                return f"{SITE_URL}/"
            if rel.endswith("/index.html"):
                return f"{SITE_URL}/{rel[:-len('/index.html')]}/"
            return None

        expected_locs = {url for rel, path in html_pages for url in [html_to_url(rel, path)] if url}
        missing = sorted(expected_locs - sitemap_locs)
        extra = sorted(sitemap_locs - expected_locs)
        if missing:
            for url in missing[:20]:
                R.err(f"Sitemap missing indexable URL: {url}")
        if extra:
            for url in extra[:20]:
                R.warn(f"Sitemap has non-indexable/unknown URL: {url}")
        if not missing:
            R.ok(f"sitemap.xml covers all indexable pages ({len(expected_locs)} URLs)")
    else:
        R.warn("sitemap.xml not found")

    # Business hours must be consistent across visible text and JSON-LD.
    hours_files = [ROOT / "index.html", ROOT / "llms.txt", ROOT / "prigorody" / "_template.html", ROOT / "prigorody" / "_cities.csv"]
    hours_files += [path for _, path in html_pages]
    forbidden_hours = ("Пн–Вс", "Пн-Вс", "Ежедневно", "ежедневно", "Sunday", "Mo-Su")
    hours_issues = []
    for hp in dict.fromkeys(hours_files):
        if not hp.exists() or is_excluded_path(hp):
            continue
        text = hp.read_text(encoding="utf-8", errors="replace")
        rel = relpath(hp)
        for bad in forbidden_hours:
            if bad in text:
                hours_issues.append(f"{rel}: forbidden hours marker '{bad}'")
                break
    if hours_issues:
        for issue in hours_issues[:20]:
            R.err(f"Business hours: {issue}")
    else:
        R.ok("Business hours consistent: Пн–Сб / Mo-Sa")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 13: HTML Size Check
# ═══════════════════════════════════════════════════════════════════════════

with R.section("13. HTML Size"):
    oversized = []
    for rel, path in html_pages:
        sz = path.stat().st_size
        if sz > MAX_HTML:
            oversized.append((rel, sz))

    if oversized:
        for rel, sz in oversized:
            R.warn(f"Large HTML: {rel} ({sz:,} bytes, budget {MAX_HTML:,})")
    else:
        max_sz = max((path.stat().st_size for _, path in html_pages), default=0)
        R.ok(f"All HTML within budget (max: {max_sz:,} bytes)")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 14: Resource Reference Integrity
# ═══════════════════════════════════════════════════════════════════════════

with R.section("14. Resource Integrity"):
    missing_resources = []
    checked_resources = set()

    def _resolve_url(url, page_rel):
        """Resolve URL against page location. Absolute (/foo) → ROOT/foo;
        Relative (../foo, ./foo, foo) → ROOT/<page_dir>/foo (normalized)."""
        clean = unquote(url.split("?")[0].split("#")[0])
        if not clean:
            return None
        if clean.startswith("/"):
            target = ROOT / clean.lstrip("/")
        else:
            page_dir = (ROOT / page_rel).parent
            target = (page_dir / clean).resolve()
        # Normalize to detect duplicates
        try:
            key = str(target.relative_to(ROOT))
        except ValueError:
            key = str(target)
        return target, key

    for rel, path in html_pages[:10]:
        parsed = parse_html(path)

        for href in parsed.stylesheets:
            if href.startswith(("http://", "https://", "data:")):
                continue
            resolved = _resolve_url(href, rel)
            if not resolved:
                continue
            target, key = resolved
            if key in checked_resources:
                continue
            checked_resources.add(key)
            if not target.exists():
                missing_resources.append(f"{rel} → {href} (CSS)")

        for src in parsed.scripts:
            if src.startswith(("http://", "https://", "data:")):
                continue
            resolved = _resolve_url(src, rel)
            if not resolved:
                continue
            target, key = resolved
            if key in checked_resources:
                continue
            checked_resources.add(key)
            if not target.exists():
                missing_resources.append(f"{rel} → {src} (JS)")

        for img in parsed.images[:20]:
            src = img["src"]
            if src.startswith(("http://", "https://", "data:")):
                continue
            resolved = _resolve_url(src, rel)
            if not resolved:
                continue
            target, key = resolved
            if key in checked_resources:
                continue
            checked_resources.add(key)
            if not target.exists():
                missing_resources.append(f"{rel}:{img['line']} → {src} (img)")

    for mr in missing_resources[:30]:
        R.err(f"Missing resource: {mr}")

    if not missing_resources:
        R.ok(f"All resources found ({len(checked_resources)} checked)")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 15: Service Worker Strategy
# ═══════════════════════════════════════════════════════════════════════════

with R.section("15. SW Strategy"):
    sw_path = ROOT / "sw.js"
    if sw_path.exists():
        sw_text = sw_path.read_text(encoding="utf-8", errors="replace")

        checks = {
            "install handler": "addEventListener('install'" in sw_text,
            "activate handler": "addEventListener('activate'" in sw_text,
            "old cache cleanup": "caches.delete" in sw_text,
            "fetch handler": "addEventListener('fetch'" in sw_text,
            "skipWaiting": "skipWaiting" in sw_text,
            "clients.claim": "clients.claim" in sw_text,
            "network-first pattern": ("cache.match" in sw_text or "caches.match" in sw_text) and "fetch(" in sw_text,
            "video/range bypass": "headers.has('range')" in sw_text and "destination === 'video'" in sw_text,
        }

        for name, passed in checks.items():
            if passed:
                R.ok(f"SW {name}: ✓")
            else:
                R.warn(f"SW missing: {name}")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 16: HTML Validation Basics
# ═══════════════════════════════════════════════════════════════════════════

with R.section("16. HTML Validation"):
    html_issues = []
    for rel, path in html_pages[:15]:
        # Skip search-engine verification files
        if rel.startswith(("google", "yandex")):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")

        if not text.strip().lower().startswith("<!doctype"):
            html_issues.append(f"{rel}: missing <!DOCTYPE>")

        parsed = parse_html(path)

        html_tags = [(t, a) for t, a, _ in parsed.tags if t == "html"]
        if not html_tags:
            html_issues.append(f"{rel}: missing <html> tag")
        elif "lang" not in html_tags[0][1]:
            html_issues.append(f"{rel}: <html> missing lang")

        has_charset = (
            "charset" in parsed.metas
            or 'charset="utf-8"' in text.lower()
            or "charset='utf-8'" in text.lower()
            or 'charset=utf-8' in text.lower()
        )
        if not has_charset:
            html_issues.append(f"{rel}: missing charset meta")

    for hi in html_issues:
        R.warn(f"HTML: {hi}")

    if not html_issues:
        R.ok(f"HTML validation passed for {min(15, len(html_pages))} pages")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 17: CNAME
# ═══════════════════════════════════════════════════════════════════════════

with R.section("17. CNAME"):
    cname_path = ROOT / "CNAME"
    if cname_path.exists():
        cname = cname_path.read_text(encoding="utf-8").strip()
        R.ok(f"CNAME: {cname}")
        if cname != "milovicake.ru":
            R.warn(f"CNAME is '{cname}', expected 'milovicake.ru'")
    else:
        R.note("No CNAME file (needed for GitHub Pages custom domain)")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 18: Repo Hygiene
# ═══════════════════════════════════════════════════════════════════════════

with R.section("18. Repo Hygiene"):
    gitignore = ROOT / ".gitignore"
    if gitignore.exists():
        R.ok(".gitignore found")
    else:
        R.warn(".gitignore not found")

    # Large files
    large_files = []
    for p in ROOT.rglob("*"):
        if is_excluded_path(p):
            continue
        if p.is_file():
            try:
                sz = p.stat().st_size
                if sz > 5_000_000:
                    large_files.append((relpath(p), sz))
            except OSError:
                pass

    if large_files:
        for lf, sz in sorted(large_files, key=lambda x: -x[1])[:10]:
            R.warn(f"Large file: {lf} ({sz / 1_000_000:.1f} MB)")
    else:
        R.ok("No files > 5 MB in repo")

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 18b: File Hygiene Guards
#   - unreferenced media (img/* not mentioned anywhere)
#   - duplicate file content by SHA1 (with documented whitelist)
#   - stale patch/zip/bak artefacts in repo
#   - .gitignore drift: tracked files that match ignore rules
# ═══════════════════════════════════════════════════════════════════════════

with R.section("18b. File Hygiene Guards"):
    import hashlib
    import subprocess

    # ── Build a single haystack of all textual referenceable content ─────
    referenceable_exts = {
        ".html", ".css", ".js", ".cjs", ".mjs", ".json",
        ".xml", ".txt", ".md", ".py", ".svg", ".yml", ".yaml",
    }
    haystack_parts = []
    # Каталог audit/ может содержать наши же auto-generated отчёты,
    # которые цитируют имена файлов. Это даёт false-positive «файл
    # упоминается». Исключаем его явно.
    audit_dir = (ROOT / "audit").resolve()
    for p in ROOT.rglob("*"):
        if is_excluded_path(p) or not p.is_file():
            continue
        try:
            if audit_dir in p.resolve().parents:
                continue
        except OSError:
            pass
        if p.suffix.lower() in referenceable_exts:
            try:
                haystack_parts.append(p.read_text(encoding="utf-8", errors="ignore"))
            except OSError:
                pass
    haystack = "\n".join(haystack_parts)

    # ── 1. Unreferenced media in img/ ─────────────────────────────────────
    # Documented exceptions (whitelist) — empty for now.
    unref_whitelist: set[str] = set()
    img_root = ROOT / "img"
    unreferenced = []
    if img_root.exists():
        media_exts = {".webp", ".png", ".jpg", ".jpeg", ".svg",
                      ".avif", ".gif", ".webm", ".mp4", ".mov"}
        for p in img_root.rglob("*"):
            if not p.is_file() or p.suffix.lower() not in media_exts:
                continue
            rel = relpath(p)
            if rel in unref_whitelist:
                continue
            name = p.name
            if name not in haystack:
                unreferenced.append((rel, p.stat().st_size))

    if unreferenced:
        for rel, sz in sorted(unreferenced, key=lambda x: -x[1])[:10]:
            R.warn(f"Unreferenced media: {rel} ({sz:,} bytes)")
    else:
        R.ok("All img/ media files are referenced from runtime code")

    # ── 2. Duplicate file content by SHA1 inside img/ ─────────────────────
    # Documented exception: head.webp and head_desktop.webp are
    # intentionally kept as twins.
    #   - head.webp is referenced from indexed JSON-LD (schema.org image)
    #     and PWA manifest. Renaming would break already-indexed Google
    #     and Yandex image URLs and registered PWA installs.
    #   - head_desktop.webp is the <picture> source for the hero on the
    #     home page and is in the SW precache.
    # Cost of the duplicate: ~104 KB on disk, zero runtime impact
    # (each is fetched at most once and cached separately). Acceptable.
    dup_whitelist = frozenset({
        frozenset({"img/head.webp", "img/head_desktop.webp"}),
    })
    hashes: dict[str, list[str]] = {}
    if img_root.exists():
        for p in img_root.rglob("*"):
            if not p.is_file():
                continue
            try:
                h = hashlib.sha1(p.read_bytes()).hexdigest()
                hashes.setdefault(h, []).append(relpath(p))
            except OSError:
                pass
    unexpected_dups = []
    for h, files in hashes.items():
        if len(files) < 2:
            continue
        pair = frozenset(files)
        if pair not in dup_whitelist:
            unexpected_dups.append(tuple(sorted(files)))
    if unexpected_dups:
        for pair in unexpected_dups[:10]:
            R.warn(f"Duplicate file content: {' == '.join(pair)}")
    else:
        R.ok("No unexpected duplicate media (whitelist applied)")

    # ── 3. Stale patch / archive / backup artefacts ──────────────────────
    stale_patterns = (
        "*.patch", "*.diff", "*.zip", "*.tar", "*.tar.gz", "*.tgz",
        "*.bak", "*.orig", "*.old", "*~",
    )
    stale_found = []
    for pat in stale_patterns:
        for p in ROOT.rglob(pat):
            if is_excluded_path(p) or not p.is_file():
                continue
            stale_found.append(relpath(p))
    # uploads/ directory itself must not exist (it was used for one-off
    # patch dumps and reappeared once already — see commit 6adac35).
    uploads_dir = ROOT / "uploads"
    if uploads_dir.exists() and uploads_dir.is_dir():
        stale_found.append("uploads/ (entire directory)")
    if stale_found:
        for f in sorted(set(stale_found))[:10]:
            R.err(f"Stale artefact in repo: {f}")
    else:
        R.ok("No stale patch/archive/backup files in repo")

    # ── 4. .gitignore drift: tracked files that match an ignore rule ─────
    try:
        proc = subprocess.run(
            ["git", "ls-files", "--error-unmatch", "-i", "-c",
             "--exclude-standard"],
            cwd=str(ROOT), capture_output=True, text=True, timeout=10,
        )
        drift = [ln for ln in proc.stdout.splitlines() if ln.strip()]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        drift = []
    if drift:
        for f in drift[:10]:
            R.warn(f".gitignore drift (tracked but ignored): {f}")
    else:
        R.ok("No .gitignore drift (no tracked-but-ignored files)")


# ═══════════════════════════════════════════════════════════════════════════
# CHECK 19: Mixed Content & Security Patterns
# ═══════════════════════════════════════════════════════════════════════════

with R.section("19. Security Patterns"):
    for rel, path in html_pages[:10]:
        text = path.read_text(encoding="utf-8", errors="replace")
        # Mixed content: http:// links (not localhost)
        for m in re.finditer(r'(?:href|src)=["\']http://(?!localhost|127\.0\.0\.1)([^"\']+)["\']', text):
            R.warn(f"Mixed content in {rel}: http://{m.group(1)[:50]}")

    R.ok("Security pattern scan complete")


# ═══════════════════════════════════════════════════════════════════════════
# TERMINAL OUTPUT
# ═══════════════════════════════════════════════════════════════════════════

now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
sep = "═" * 72

print()
print(f"\033[1;36m{sep}")
print(f"  MILOVI CAKE — AUDIT REPORT")
print(f"  {now}")
print(f"{sep}\033[0m")
print()

# Section timings
total_time = sum(R.section_times.values())
print("\033[2m  Section timings:\033[0m")
for name, elapsed in R.section_times.items():
    pct = (elapsed / total_time * 100) if total_time else 0
    bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
    print(f"\033[2m    {name:<28} {elapsed:>5.2f}s  {bar} {pct:>5.1f}%\033[0m")
print(f"\033[2m    {'TOTAL':<28} {total_time:>5.2f}s\033[0m")
print()

# Summary
print(f"\033[1m  Summary:\033[0m")
print(f"    ✅ Passed:   \033[32m{len(R.passed)}\033[0m")
print(f"    ⚠️  Warnings: \033[33m{len(R.warnings)}\033[0m")
print(f"    ❌ Errors:   \033[31m{len(R.errors)}\033[0m")
print(f"    ℹ️  Info:     {len(R.info)}")
print()

if R.passed:
    print(f"\033[32m  ── PASSED ──\033[0m")
    for msg in R.passed:
        print(f"\033[32m    ✅ {msg}\033[0m")
    print()

if R.warnings:
    print(f"\033[33m  ── WARNINGS ({len(R.warnings)}) ──\033[0m")
    for msg in R.warnings:
        print(f"\033[33m    ⚠️  {msg}\033[0m")
    print()

if R.errors:
    print(f"\033[31m  ── ERRORS ({len(R.errors)}) ──\033[0m")
    for msg in R.errors:
        print(f"\033[31m    ❌ {msg}\033[0m")
    print()

if R.info:
    print(f"\033[2m  ── INFO ──\033[0m")
    for msg in R.info:
        print(f"\033[2m    ℹ️  {msg}\033[0m")
    print()

# Verdict
if R.errors:
    print(f"\033[31m\033[1m  ❌ AUDIT FAILED — {len(R.errors)} error(s) must fix before deploy\033[0m")
else:
    print(f"\033[32m\033[1m  ✅ AUDIT PASSED — site ready for deploy\033[0m")

if R.warnings:
    print(f"\033[33m  ⚠️  {len(R.warnings)} warning(s) to review\033[0m")

print(f"\033[1;36m{sep}\033[0m")
print()

# ═══════════════════════════════════════════════════════════════════════════
# MARKDOWN REPORT
# ═══════════════════════════════════════════════════════════════════════════

REPORT_DIR.mkdir(exist_ok=True)
report_date = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
report_path = REPORT_DIR / f"audit-{report_date}.md"

lines = [
    f"# Milovi Cake — Audit Report",
    f"",
    f"**Date:** {now}  ",
    f"**Result:** {'❌ FAILED' if R.errors else '✅ PASSED'} ({len(R.errors)} errors, {len(R.warnings)} warnings)  ",
    f"**Duration:** {total_time:.2f}s  ",
    f"",
    f"---",
    f"",
]

if R.passed:
    lines += [f"## ✅ Passed ({len(R.passed)})", ""]
    lines += [f"- {msg}" for msg in R.passed]
    lines.append("")

if R.warnings:
    lines += [f"## ⚠️ Warnings ({len(R.warnings)})", ""]
    lines += [f"- {msg}" for msg in R.warnings]
    lines.append("")

if R.errors:
    lines += [f"## ❌ Errors ({len(R.errors)})", ""]
    lines += [f"- {msg}" for msg in R.errors]
    lines.append("")

if R.info:
    lines += [f"## ℹ️ Info", ""]
    lines += [f"- {msg}" for msg in R.info]
    lines.append("")

lines += ["---", "", "**Section timings:**"]
for name, elapsed in R.section_times.items():
    lines.append(f"- {name}: {elapsed:.2f}s")
lines.append("")

report_path.write_text("\n".join(lines), encoding="utf-8")
print(f"  📄 Report saved: {report_path.relative_to(ROOT)}")
print()

# ─── Exit Code for CI ────────────────────────────────────────────────────

sys.exit(1 if R.errors else 0)
