#!/usr/bin/env python3
"""Temporary PR-only inspection of already-published #102/#103 LHCI artifacts.

Reads each run's `lighthouse-results` files after `gh run download` on a GitHub
runner. Never starts a browser, requests production, or alters the website.
Removed from the PR after SHA-verified annotations are inspected.
"""
import base64
import gzip
import hashlib
import json
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit

RUNS = {
    "102": ("39875645018", "49983047ffea631ad391e72a19cf9b73c3a427f9"),
    "103": ("39945169569", "f325e00de47be2e6723f1c9e8e492b59d1a14843"),
}


def metric(lhr, key):
    value = lhr.get("audits", {}).get(key, {}).get("numericValue")
    return round(value, 3) if isinstance(value, (int, float)) else None


def node_snippet(lhr):
    audit = lhr.get("audits", {}).get("largest-contentful-paint-element", {})
    for item in audit.get("details", {}).get("items", []):
        node = item.get("node", {})
        if node.get("snippet"):
            return node["snippet"][:330]
    return None


def lhr_from_json(path):
    if path.stat().st_size > 30_000_000:
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeError, ValueError):
        return None
    return data if isinstance(data, dict) and "audits" in data and "lighthouseVersion" in data else None


def lhr_from_html(path):
    # Fallback only if action uploaded HTML but not Lighthouse JSON.
    text = path.read_text(encoding="utf-8", errors="replace")
    found = re.search(r"(?:window\.)?__LIGHTHOUSE_JSON__\s*=\s*", text)
    if not found:
        return None
    try:
        data, _ = json.JSONDecoder().raw_decode(text[found.end():])
    except ValueError:
        return None
    return data if isinstance(data, dict) and "audits" in data else None


def extract(path, lhr):
    url = lhr.get("finalUrl") or lhr.get("requestedUrl") or ""
    parsed = urlsplit(url)
    pathname = parsed.path or "/"
    if not pathname.endswith("/") and "." not in pathname.rsplit("/", 1)[-1]:
        pathname += "/"
    record = {
        "file": str(path), "url": url, "path": pathname,
        "fetchTime": lhr.get("fetchTime"), "lighthouseVersion": lhr.get("lighthouseVersion"),
        "browser": lhr.get("environment", {}).get("hostUserAgent"),
        "settings": {
            k: lhr.get("configSettings", {}).get(k)
            for k in ("throttlingMethod", "formFactor", "screenEmulation", "throttling")
        },
        "lcp": metric(lhr, "largest-contentful-paint"),
        "fcp": metric(lhr, "first-contentful-paint"),
        "tbt": metric(lhr, "total-blocking-time"),
        "cls": metric(lhr, "cumulative-layout-shift"),
        "ttfb": metric(lhr, "server-response-time"),
        "score": lhr.get("categories", {}).get("performance", {}).get("score"),
        "node": node_snippet(lhr),
        "warnings": lhr.get("runWarnings", []),
    }
    if pathname not in ("/", "/bento-torty/"):
        return record
    m = lhr.get("audits", {}).get("metrics", {}).get("details", {}).get("items", [])
    if m:
        record["observedLcp"] = m[0].get("observedLargestContentfulPaint")
    requests = lhr.get("audits", {}).get("network-requests", {}).get("details", {}).get("items", [])
    picked = []
    media = []
    for req in requests:
        address = req.get("url", "")
        resource = req.get("resourceType")
        if resource == "Media" or "/videos/" in address:
            media.append(address.split("?")[0])
        if ("/css/" in address or "/img/bento_1-mobile-640" in address or
                "/img/head_mobile-640" in address or "fonts.googleapis.com" in address or
                "fonts.gstatic.com" in address or "/videos/" in address):
            picked.append({
                k: req.get(k) for k in
                ("url", "resourceType", "networkEndTime", "networkRequestTime", "statusCode",
                 "protocol", "transferSize", "fromServiceWorker", "finished")
            })
    record["media"] = media
    record["networkRequestCount"] = len(requests)
    record["selectedRequests"] = picked[:32]
    return record


def main():
    base = Path(sys.argv[1])
    all_records = {}
    inventory = {}
    for label, (run, sha) in RUNS.items():
        folder = base / f"run-{run}"
        files = sorted(f for f in folder.rglob("*") if f.is_file())
        inventory[label] = {
            "run": run, "sha": sha, "fileCount": len(files),
            "firstFiles": [[str(f.relative_to(folder)), f.stat().st_size] for f in files[:48]],
        }
        collected = []
        for path in files:
            if path.suffix.lower() != ".json":
                continue
            lhr = lhr_from_json(path)
            if lhr:
                collected.append(extract(path.relative_to(folder), lhr))
        if not collected:
            for path in files:
                if path.suffix.lower() == ".html" and path.stat().st_size < 30_000_000:
                    lhr = lhr_from_html(path)
                    if lhr:
                        collected.append(extract(path.relative_to(folder), lhr))
        # De-duplicate by URL + fetchTime, never by rounded LCP (legitimate ties).
        unique = {}
        for record in collected:
            key = (record["url"], record["fetchTime"])
            unique.setdefault(key, record)
        all_records[label] = sorted(unique.values(), key=lambda r: (r["path"], str(r["fetchTime"])))
        inventory[label]["lhrCount"] = len(all_records[label])
    grouped = {}
    for label, records in all_records.items():
        urls = defaultdict(list)
        for record in records:
            urls[record["path"]].append(record)
        grouped[label] = {
            path: {
                "count": len(items),
                "lcp": [row["lcp"] for row in items],
                "medianLcp": (round(statistics.median(row["lcp"] for row in items), 3)
                              if all(row["lcp"] is not None for row in items) else None),
                "medianFcp": (round(statistics.median(row["fcp"] for row in items), 3)
                              if all(row["fcp"] is not None for row in items) else None),
            }
            for path, items in sorted(urls.items())
        }
    important = [r for records in all_records.values() for r in records
                 if r["path"] in ("/", "/bento-torty/")]
    payload = {
        "provenance": "Pre-existing GH Actions Lighthouse artifacts; no rerun/deploy/pairing",
        "inventory": inventory, "groups": grouped, "homeBentoReports": important,
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    compressed = gzip.compress(raw, mtime=0)
    encoded = base64.b64encode(compressed).decode("ascii")
    parts = [encoded[i:i + 3100] for i in range(0, len(encoded), 3100)]
    if len(parts) > 18:
        raise SystemExit(f"Review exceeds annotation budget: {len(parts)} chunks")
    digest = hashlib.sha256(compressed).hexdigest()
    for index, chunk in enumerate(parts, start=1):
        print("::notice file=.github/workflows/cake-sanity.yml,line=1,"
              f"title=HistoricLhci-{digest[:20]}-{index:02d}-of-{len(parts):02d}::{chunk}", flush=True)
    print(f"Historic LHCI review: {inventory['102']['lhrCount']} + "
          f"{inventory['103']['lhrCount']} reports, {len(parts)} annotations, "
          f"compressed SHA-256 {digest}")
    for label in RUNS:
        for path in ("/", "/bento-torty/"):
            print(f"Run #{label} {path}: {grouped[label].get(path, 'no reports found')}")


if __name__ == "__main__":
    main()
