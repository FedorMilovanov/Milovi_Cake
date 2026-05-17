#!/usr/bin/env python3
"""Check that prigorody generated pages are idempotent.

Why this exists:
  The previous npm script used `git diff --exit-code prigorody/*/index.html`
  after running build.py. That fails during legitimate uncommitted patches
  (for example a global ?v= version bump) even when the generated pages are
  perfectly in sync with _template.html.

This check compares generated files before vs after build.py. It fails only if
build.py changes the current working tree, i.e. when generated pages were stale
before the check.
"""
from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIGORODY = ROOT / "prigorody"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def generated_pages() -> list[Path]:
    return sorted(
        p for p in PRIGORODY.glob("*/index.html")
        if p.parent.name not in {"__pycache__"}
    )


def snapshot() -> dict[Path, str]:
    return {p: digest(p) for p in generated_pages()}


def main() -> int:
    before = snapshot()
    subprocess.run([sys.executable, str(PRIGORODY / "build.py")], cwd=str(ROOT), check=True)
    after = snapshot()

    changed = [p for p in sorted(set(before) | set(after)) if before.get(p) != after.get(p)]
    if changed:
        print("❌ Prigorody generated pages were stale before build.py:", file=sys.stderr)
        for p in changed:
            print(f"  - {p.relative_to(ROOT)}", file=sys.stderr)
        print("Run: python3 prigorody/build.py, review generated pages, then commit them.", file=sys.stderr)
        return 1

    print(f"✅ Prigorody build is idempotent ({len(after)} generated pages checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
