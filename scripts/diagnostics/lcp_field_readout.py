#!/usr/bin/env python3
"""Aggregate a PII-free GA4 BigQuery event export; never print individual events."""
from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from datetime import date
import json
from pathlib import Path
import re

COLUMNS = (
    "event_date", "lcp_ms", "lcp_page", "lcp_viewport", "lcp_consent",
    "lcp_element", "lcp_release",
)
VALUES = {
    "lcp_page": {"home", "bento"},
    "lcp_viewport": {"narrow", "wide"},
    "lcp_consent": {"granted_on_visit", "previously_granted"},
    "lcp_element": {"hero", "other"},
}


def percentile_cont(values: list[int], fraction: float = 0.75) -> float:
    """Linear-interpolated p75 (the PERCENTILE_CONT / inclusive convention)."""
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    return ordered[lower] + (ordered[min(lower + 1, len(ordered) - 1)] - ordered[lower]) * (position - lower)


def summarize(rows: list[dict], keys: tuple[str, ...], min_samples: int) -> list[dict]:
    groups = defaultdict(list)
    for row in rows:
        groups[tuple(row[key] for key in keys)].append(row)
    result = []
    for group, samples in sorted(groups.items()):
        count = len(samples)
        lcp = [row["lcp_ms"] for row in samples]
        enough = count >= min_samples
        result.append({
            **dict(zip(keys, group)),
            "samples": count,
            "p75_ms": round(percentile_cont(lcp), 2) if enough else None,
            "over_2500_pct": round(100 * sum(ms > 2500 for ms in lcp) / count, 1) if enough else None,
            "hero_pct": round(100 * sum(row["lcp_element"] == "hero" for row in samples) / count, 1) if enough else None,
            "status": "descriptive_only" if enough else "too_few_events",
        })
    return result


def build_report(csv_path: Path, release: str, min_samples: int = 100) -> dict:
    if not re.fullmatch(r"[a-f0-9]{40}", release):
        raise ValueError("--release must be the exact 40-character lowercase Git SHA")
    if min_samples < 2:
        raise ValueError("--min-samples must be at least 2")
    rows = []
    other_release = 0
    with csv_path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        # Refuse accidental exports of page URLs, user IDs, cookies, etc.
        if reader.fieldnames is None or set(reader.fieldnames) != set(COLUMNS) or len(reader.fieldnames) != len(COLUMNS):
            raise ValueError("CSV must contain exactly: " + ", ".join(COLUMNS))
        for number, raw in enumerate(reader, start=2):
            if None in raw:
                raise ValueError(f"unexpected extra CSV value in row {number}")
            if raw["lcp_release"] != release:
                other_release += 1
                continue
            day = raw["event_date"]
            try:
                if not re.fullmatch(r"\d{8}", day):
                    raise ValueError("invalid date")
                date.fromisoformat(f"{day[:4]}-{day[4:6]}-{day[6:]}")
                if not re.fullmatch(r"[0-9]+", raw["lcp_ms"]):
                    raise ValueError("invalid millisecond value")
                ms = int(raw["lcp_ms"])
                if ms <= 0:
                    raise ValueError("zero millisecond value")
                for field, allowed in VALUES.items():
                    if raw[field] not in allowed:
                        raise ValueError("unexpected cohort value")
            except (TypeError, ValueError) as exc:
                raise ValueError(f"invalid event in CSV row {number}: {exc}") from None
            rows.append({**raw, "lcp_ms": ms})
    if not rows:
        raise ValueError("no valid events for the requested release; field p75 is unknown")
    return {
        "release": release,
        "first_event_date": min(row["event_date"] for row in rows),
        "last_event_date": max(row["event_date"] for row in rows),
        "valid_events": len(rows),
        "excluded_other_release": other_release,
        "min_samples_for_estimate": min_samples,
        "method": "linear-interpolated event p75; consent-only, not CrUX",
        "by_page": summarize(rows, ("lcp_page",), min_samples),
        "by_page_viewport_consent": summarize(
            rows, ("lcp_page", "lcp_viewport", "lcp_consent"), min_samples
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="local, event-level, exact-column CSV from lcp_field_export.sql")
    parser.add_argument("--release", required=True, help="exact production /release.json SHA")
    parser.add_argument("--min-samples", type=int, default=100, help="report p75 only at or above this count (default 100)")
    args = parser.parse_args()
    try:
        report = build_report(args.csv, args.release, args.min_samples)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
