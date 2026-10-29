#!/usr/bin/env python3
"""Compare worst-run Lighthouse network requests from two saved artifact sets.

A diagnostic only: it does not modify assertions, thresholds, or page assets.
Reports use Lighthouse's total-byte-weight to select each page's worst run;
request transfer sizes are separately reported as clues, not an exact proof
of the audit's accounting. Query strings are omitted from printed URLs.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from urllib.parse import urlsplit

PAGES = ('/o-konditere/', '/bento-torty/', '/svadebnye-torty/')


def worst_reports(root: Path) -> dict:
    worst = {}
    for path in sorted(root.rglob('*.json')):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if not isinstance(report, dict) or 'lighthouseVersion' not in report:
            continue
        url = report.get('finalDisplayedUrl') or report.get('finalUrl') or report.get('requestedUrl') or ''
        parsed = urlsplit(url)
        if parsed.hostname not in ('127.0.0.1', 'localhost') or parsed.path not in PAGES:
            continue
        audits = report.get('audits') or {}
        total = (audits.get('total-byte-weight') or {}).get('numericValue')
        requests = (audits.get('network-requests') or {}).get('details', {}).get('items')
        if not isinstance(total, (float, int)) or not math.isfinite(total) or not isinstance(requests, list):
            continue
        page = parsed.path
        if page not in worst or total > worst[page]['total']:
            resources = {}
            for item in requests:
                if not isinstance(item, dict):
                    continue
                parsed_resource = urlsplit(str(item.get('url') or ''))
                if parsed_resource.scheme not in ('http', 'https') or not parsed_resource.hostname:
                    continue
                # Ignore query/cache revisions while preserving host and path.
                key = parsed_resource.hostname + parsed_resource.path
                size = item.get('transferSize')
                if isinstance(size, (float, int)) and math.isfinite(size) and size >= 0:
                    resources[key] = resources.get(key, 0) + size
            worst[page] = {'total': total, 'resources': resources}
    return worst


def comparison(base: dict, candidate: dict) -> list[str]:
    missing = [page for page in PAGES if page not in base or page not in candidate]
    if missing:
        raise ValueError('Missing comparable Lighthouse reports: ' + ', '.join(missing))
    messages = []
    for page in PAGES:
        before, after = base[page], candidate[page]
        keys = before['resources'].keys() | after['resources'].keys()
        changes = []
        for key in keys:
            left, right = before['resources'].get(key, 0), after['resources'].get(key, 0)
            if right != left:
                changes.append((abs(right - left), key, left, right))
        changes.sort(key=lambda row: (-row[0], row[1]))
        lines = [f"{page}: total-byte-weight {before['total']:.0f} -> {after['total']:.0f}; largest request transfer differences (bytes):"]
        lines.extend(f'{key[:140]} {left:.0f} -> {right:.0f} ({right-left:+.0f})'
                     for _, key, left, right in changes[:12])
        messages.append('\n'.join(lines))
    return messages


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit('Usage: lighthouse_network_comparison.py BASE_DIR CANDIDATE_DIR')
    for message in comparison(worst_reports(Path(sys.argv[1])), worst_reports(Path(sys.argv[2]))):
        escaped = message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print(f'::notice title=Lighthouse transfer comparison::{escaped}')


if __name__ == '__main__':
    main()
