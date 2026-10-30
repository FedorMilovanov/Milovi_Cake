"""Контракт покрытия самохостинговых шрифтов.

Смысл: `fonts/*.woff2` — субсеты, а не полные файлы. Если на странице
появится символ, которого в субсете нет, текст молча отрисуется
системным фолбэком и «поедет» по метрикам. Тест ловит именно это.

Проверка без внешних зависимостей: CI не устанавливает fontTools.
Поэтому рядом с файлами лежит `fonts/subset-manifest.json` — что именно
покрыто и какие байты лежат (sha256). Тест сверяет символы страниц с
манифестом и проверяет, что файлы не подменены мимо рецепта.

Пересборка субсетов: `python3 scripts/subset_fonts.py` (нужен fonttools).
"""

import hashlib
import html
import json
import re
import unicodedata
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "fonts"
MANIFEST = FONTS / "subset-manifest.json"
SKIP_DIRS = ("_site", "node_modules", "tests", "audit", ".git")

# Символы, которые появляются из JS или в служебных подписях и не лежат
# в статическом HTML, но должны рисоваться фирменным шрифтом.
JS_ONLY = "₽€№—–−«»„“”…·×÷°≈→←✓✕"


def page_characters() -> set[str]:
    chars: set[str] = set()
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(SKIP_DIRS):
            continue
        text = path.read_text("utf-8", errors="replace")
        text = re.sub(r"(?is)<(script|style|svg)[^>]*>.*?</\1>", " ", text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        chars |= set(html.unescape(text))
    chars |= set(JS_ONLY)
    return {c for c in chars if ord(c) >= 0x20}


def is_pictograph(char: str) -> bool:
    """Эмодзи и служебные символы их сборки: их рисует системный шрифт."""
    code = ord(char)
    if code in (0x200D, 0xFE0F, 0xFE0E):      # ZWJ и variation selectors
        return True
    if code >= 0x1F000:
        return True
    name = unicodedata.name(char, "")
    return any(word in name for word in ("EMOJI", "SYMBOL", "DINGBAT"))


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text("utf-8"))


class FontCoverageTest(unittest.TestCase):
    def test_manifest_matches_shipped_files(self):
        # Файл, пересобранный вручную мимо скрипта, разошёлся бы с
        # манифестом — и покрытие ниже перестало бы что-либо гарантировать.
        manifest = load_manifest()
        shipped = {p.name for p in FONTS.glob("*.woff2")}
        self.assertEqual(shipped, set(manifest), "набор файлов разошёлся с манифестом")
        for name, info in manifest.items():
            actual = hashlib.sha256((FONTS / name).read_bytes()).hexdigest()
            self.assertEqual(actual, info["sha256"],
                             f"{name}: файл изменён мимо scripts/subset_fonts.py")

    def test_site_characters_are_covered(self):
        shallow: set[int] = set()      # что лежит в субсетах
        source: set[int] = set()       # что было в полных файлах
        for info in load_manifest().values():
            shallow |= set(info["codepoints"])
            source |= set(info["source_codepoints"])
        lost, fallback = set(), set()
        for char in page_characters():
            code = ord(char)
            if code in shallow or is_pictograph(char):
                continue
            # Символа не было и в полном шрифте (₽, стрелки, ★) — его всегда
            # рисовал системный фолбэк, это не наша потеря. Если же он был и
            # пропал — значит субсет вырезали слишком узко.
            (lost if code in source else fallback).add(char)
        self.assertEqual(
            sorted(lost, key=ord), [],
            "символы были в полном шрифте, но пропали из субсета — расширьте "
            "набор в scripts/subset_fonts.py и пересоберите:\n  "
            + "  ".join(f"{c!r} U+{ord(c):04X}" for c in sorted(lost, key=ord)[:20]),
        )
        # Не падаем, но фиксируем: эти символы рисует фолбэк, как и до
        # самохостинга (Google-запрос их тоже не запрашивал).
        if fallback:
            print(f"\nфолбэк системным шрифтом ({len(fallback)}): "
                  + " ".join(sorted(fallback, key=ord)))

    def test_no_google_fonts_references_in_pages(self):
        # Самохостинг вводился именно чтобы убрать сторонний origin:
        # его возврат — регресс приватности и снова нестабильный вес.
        offenders = []
        for path in ROOT.rglob("*.html"):
            rel = path.relative_to(ROOT).as_posix()
            if rel.startswith(SKIP_DIRS):
                continue
            text = path.read_text("utf-8", errors="replace")
            if "fonts.googleapis.com" in text or "fonts.gstatic.com" in text:
                offenders.append(rel)
        self.assertEqual(offenders, [], "страницы снова ссылаются на Google Fonts")


if __name__ == "__main__":
    unittest.main()
