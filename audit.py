#!/usr/bin/env python3
"""Compatibility wrapper for the canonical Milovi Cake audit.

The real audit lives in scripts/audit.py and calculates the project root as
Path(__file__).parents[1]. Keeping a full copy at repository root makes
`python3 audit.py` audit the parent directory instead of this repository.

Use this wrapper so both commands are safe:
  python3 audit.py
  python3 scripts/audit.py
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "scripts" / "audit.py"

if not SCRIPT.exists():
    sys.stderr.write(f"Audit script not found: {SCRIPT}\n")
    raise SystemExit(2)

# Preserve argv[0]-style semantics for report messages/debuggers.
sys.argv[0] = str(SCRIPT)
runpy.run_path(str(SCRIPT), run_name="__main__")
