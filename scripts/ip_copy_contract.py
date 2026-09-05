#!/usr/bin/env python3
"""Fail closed on known third-party commercial naming in public site source.

This is intentionally narrow: it guards only phrases already reviewed in issue #19.
Generic animals, themes and user-authored review text are not classified by this check.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {".git", "node_modules", "_site", "playwright-report", "test-results"}
PUBLIC_SUFFIXES = {".html", ".js", ".csv"}

FORBIDDEN = {
    "Snickers naming": re.compile(r"\bсникерс\b", re.IGNORECASE),
    "Ferrero naming": re.compile(r"\bферреро\b", re.IGNORECASE),
    "Minecraft naming": re.compile(r"\bminecraft\b", re.IGNORECASE),
    "character-sales phrase": re.compile(
        r"(?:детские\s+с\s+персонажами|любимыми\s+персонажами|торт\s+с\s+персонажами)",
        re.IGNORECASE,
    ),
}


def is_public_source(path: Path) -> bool:
    if path.suffix.lower() not in PUBLIC_SUFFIXES:
        return False
    rel = path.relative_to(ROOT)
    if any(part in SKIP_PARTS for part in rel.parts):
        return False
    # Tooling/tests may mention the forbidden literals as guard data or fixtures.
    if rel.parts and rel.parts[0] in {"scripts", "tests"}:
        return False
    return True


def main() -> int:
    findings: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or not is_public_source(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = path.relative_to(ROOT)
        for label, pattern in FORBIDDEN.items():
            for match in pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                findings.append(f"{rel}:{line}: {label}: {match.group(0)!r}")

    if findings:
        print("IP copy contract: FAIL")
        for finding in findings:
            print(f"  - {finding}")
        return 1

    print("IP copy contract: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
