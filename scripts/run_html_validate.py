#!/usr/bin/env python3
"""Запускает html-validate по HTML проекта (без node_modules).

Правила и исключения стилевых проверок — в `.htmlvalidate.json`. Список файлов
собирается здесь, потому что html-validate v11 не умеет исключать каталоги
через конфиг: при запуске с каталогом он заходит в node_modules.

Run:
    python3 scripts/run_html_validate.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIN = ROOT / "node_modules" / ".bin" / "html-validate"


def main() -> int:
    if not BIN.exists():
        print("html-validate не установлен: выполните npm ci", file=sys.stderr)
        return 1
    files = sorted(
        str(path.relative_to(ROOT))
        for path in ROOT.rglob("*.html")
        if "node_modules" not in path.parts and ".git" not in path.parts
    )
    if not files:
        print("HTML-файлы не найдены", file=sys.stderr)
        return 1
    result = subprocess.run([str(BIN), "--config", ".htmlvalidate.json", *files], cwd=ROOT)
    if result.returncode == 0:
        print(f"html-validate OK: {len(files)} документов без нарушений")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
