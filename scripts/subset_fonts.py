#!/usr/bin/env python3
"""Пересобрать субсеты шрифтов из полных файлов Fontsource.

Зачем это нужно
---------------
В `fonts/` лежат восемь переменных woff2 — официальные сборки Google Fonts
через Fontsource (SIL OFL 1.1). Полные файлы весят 198 708 байт; сайту нужно
19 716 из них. Скрипт вырезает алфавитный набор, а не выборку из текущих
текстов: новый русский или английский текст останется покрытым.

Что попадает в субсет
---------------------
- ASCII целиком (0x20–0x7E);
- Latin-1 Supplement целиком (0x00A0–0x00FF) — включает ±, é, â;
- кириллица: 0x0400–0x045F, 0x0490–0x0491, 0x04B0–0x04B1;
- типографика, валюты и стрелки: — – « » „ “ ” • … € ₽ № ← ↑ → ↘ − ≈
  ▶ ★ ♥ ✓ ✕ ✦.

Эмодзи намеренно не входят: этих глифов нет ни в Cormorant, ни в Jost,
их рисует системный эмодзи-шрифт — так было и до самохостинга.

Проверка после пересборки
-------------------------
`tests/test_font_coverage.py` проверяет, что каждый символ, который есть
на страницах сайта и присутствует в полном шрифте, присутствует и в
субсете. Если он падает — набор в этом файле надо расширить и пересобрать.

Usage:
    python3 scripts/subset_fonts.py            # пересобрать fonts/*.woff2
    python3 scripts/subset_fonts.py --check    # только проверить покрытие

Требуется fonttools с поддержкой brotli:  pip install fonttools brotli
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "fonts"
SOURCE = FONTS / "source"      # полные файлы Fontsource: из них собирается субсет

# Какие файлы относятся к кириллическому подмножеству (остальные — латиница).
CYRILLIC_FILES = {
    "jost-cyrillic-wght-normal.woff2",
    "jost-cyrillic-wght-italic.woff2",
    "cormorant-garamond-cyrillic-wght-normal.woff2",
    "cormorant-garamond-cyrillic-wght-italic.woff2",
}

ASCII = range(0x20, 0x7F)
LATIN1 = range(0x00A0, 0x0100)
CYRILLIC_RANGES = ((0x0400, 0x045F), (0x0490, 0x0491), (0x04B0, 0x04B1))
TYPOGRAPHY = (
    0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022,
    0x2026, 0x2039, 0x203A, 0x20AC, 0x20BD, 0x2116, 0x2122,
    0x2190, 0x2191, 0x2192, 0x2193, 0x2197, 0x2212, 0x2248,
    0x25B6, 0x2605, 0x2665, 0x2713, 0x2715, 0x2726,
)


def unicodes_for(name: str) -> list[int]:
    codes = list(ASCII) + list(LATIN1) + list(TYPOGRAPHY)
    if name in CYRILLIC_FILES:
        for start, end in CYRILLIC_RANGES:
            codes += list(range(start, end + 1))
    return sorted(set(codes))


def rebuild() -> int:
    if not FONTS.is_dir():
        print(f"нет каталога {FONTS}", file=sys.stderr)
        return 1
    if not SOURCE.is_dir():
        print(f"нет каталога {SOURCE} с полными файлами Fontsource", file=sys.stderr)
        return 1
    total_before = total_after = 0
    for src in sorted(SOURCE.glob("*.woff2")):
        path = FONTS / src.name
        before = path.stat().st_size if path.exists() else 0
        out = path.with_suffix(".subset.woff2")
        subprocess.run(
            [
                sys.executable, "-m", "fontTools.subset", str(src),
                f"--output-file={out}",
                "--unicodes=" + ",".join(f"U+{c:04X}" for c in unicodes_for(src.name)),
                "--flavor=woff2",
                "--layout-features=*",
                "--no-hinting",
                "--desubroutinize",
            ],
            check=True,
        )
        after = out.stat().st_size
        out.replace(path)
        total_before += before
        total_after += after
        print(f"{path.name:<48} {before:>7} → {after:>7}")
    print(f"\nИТОГО {total_before} → {total_after} байт")
    write_manifest()
    return 0


MANIFEST = FONTS / "subset-manifest.json"


def _codepoints(path: Path) -> list[int]:
    from fontTools.ttLib import TTFont
    return sorted(TTFont(path).getBestCmap())


def write_manifest() -> None:
    """Записать, что именно покрыто и какие байты лежат.

    Нужен, чтобы контракт покрытия работал там, где нет fontTools (CI
    ставит только stdlib): тест сверяет символы страниц с манифестом и
    заодно проверяет sha256, чтобы файлы нельзя было подменить молча.
    """
    data = {}
    for path in sorted(FONTS.glob("*.woff2")):
        source = SOURCE / path.name
        data[path.name] = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "bytes": path.stat().st_size,
            "codepoints": _codepoints(path),
            # что было в полном файле: по этой границе тест отличает нашу
            # потерю от символа, которого в шрифте никогда не было
            "source_codepoints": _codepoints(source) if source.exists() else [],
        }
    MANIFEST.write_text(json.dumps(data, indent=1, sort_keys=True) + "\n", "utf-8")
    print(f"манифест перезаписан: {MANIFEST.relative_to(ROOT)}")


def check() -> int:
    from tests.test_font_coverage import check_coverage  # noqa: WPS433 (локальный импорт)

    problems = check_coverage()
    if problems:
        for line in problems:
            print(f"НЕ ПОКРЫТО: {line}", file=sys.stderr)
        return 1
    print("Покрытие шрифтов OK: все символы сайта присутствуют в субсетах")
    return 0


if __name__ == "__main__":
    sys.exit(check() if "--check" in sys.argv else rebuild())
