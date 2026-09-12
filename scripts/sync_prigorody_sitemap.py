#!/usr/bin/env python3
"""Synchronize suburb sitemap freshness from prigorody/_cities.csv."""

from __future__ import annotations

import argparse
import csv
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "prigorody" / "_cities.csv"
SITEMAP_PATH = ROOT / "sitemap.xml"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def load_rows() -> list[dict[str, str]]:
    with CSV_PATH.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise SystemExit("No suburb rows found")
    return rows

def validate_lastmod(slug: str, value: str) -> str:
    if not DATE_RE.fullmatch(value):
        raise SystemExit(f"{slug}: invalid lastmod {value!r}")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise SystemExit(f"{slug}: invalid lastmod {value!r}") from exc
    if parsed > date.today():
        raise SystemExit(f"{slug}: lastmod {value} is in the future")
    return value


def pattern_for(slug: str) -> re.Pattern[str]:
    url = re.escape(f"https://milovicake.ru/prigorody/{slug}/")
    return re.compile(
        rf"(<url><loc>{url}</loc><changefreq>monthly</changefreq><lastmod>)"
        rf"(\d{{4}}-\d{{2}}-\d{{2}})"
        rf"(</lastmod><priority>0\.7</priority></url>)"
    )

def synchronize(check_only: bool) -> int:
    sitemap = SITEMAP_PATH.read_text(encoding="utf-8")
    updated = sitemap
    mismatches: list[str] = []

    for row in load_rows():
        slug = (row.get("slug") or "").strip()
        expected = validate_lastmod(slug, (row.get("lastmod") or "").strip())
        pattern = pattern_for(slug)
        match = pattern.search(updated)
        if not match:
            raise SystemExit(f"{slug}: sitemap entry not found")
        actual = match.group(2)
        if actual == expected:
            continue
        mismatches.append(f"{slug}: sitemap={actual} source={expected}")
        updated = pattern.sub(
            lambda m: f"{m.group(1)}{expected}{m.group(3)}",
            updated,
            count=1,
        )

    if check_only:
        if mismatches:
            print("Suburb sitemap freshness drift:")
            for item in mismatches:
                print(f"  - {item}")
            return 1
        print("Suburb sitemap freshness is synchronized")
        return 0

    if updated != sitemap:
        SITEMAP_PATH.write_text(updated, encoding="utf-8")
        for item in mismatches:
            print(f"Updated {item}")
    else:
        print("Suburb sitemap freshness already synchronized")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    return synchronize(args.check)


if __name__ == "__main__":
    raise SystemExit(main())
