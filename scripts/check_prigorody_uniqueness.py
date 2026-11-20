#!/usr/bin/env python3
"""Проверяет, что городские страницы не являются почти-копиями друг друга
и что генератор действительно их выпустил.

Зачем: 14 страниц пригородов собираются из одного шаблона, и любая правка
шаблона легко возвращает «дорвейную» ситуацию, когда текст страниц совпадает
на 70%. Скрипт фиксирует метрики и падает, если они деградируют.

Что проверяется
---------------
1. Состав серии: набор `slug` из `prigorody/_cities.csv` обязан совпадать с
   набором каталогов `prigorody/<slug>/`. Пропавшая страница — ошибка, а не
   «улучшение метрики» (пустое объединение 5-грамм раньше давало 0.000).
2. Каждая страница непустая (HTML существует и содержит осмысленный объём
   текста), а секция `#story` присутствует и не пуста.
3. Текст `#story` в собранном HTML совпадает с абзацами `story_p1..p3` из CSV
   (после нормализации пробелов/сущностей, как подпоследовательность слов).
4. Метрики дублирования: Jaccard по 5-граммам — средняя и максимальная по
   всем парам; объём уникального городского блока в CSV.

Пороговые значения откалиброваны по текущему состоянию (см. --report):
остаточное совпадение — это интерфейс (калькулятор, корзина, начинки,
контакты, навигация по городам), а не контент.

Run:
    python3 scripts/check_prigorody_uniqueness.py
    python3 scripts/check_prigorody_uniqueness.py --report
"""

from __future__ import annotations

import argparse
import csv
import html as html_lib
import itertools
import re
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHINGLE = 5

# Калибровка: сейчас средняя 0.58 / максимальная 0.60 / городской текст 141–172 слова.
# Порог оставляет запас на легитимные правки шаблона, но ловит возврат копипасты.
MAX_AVG_JACCARD = 0.62
MAX_PAIR_JACCARD = 0.68
MIN_STORY_WORDS = 120
# Целая городская страница — это тысячи слов. Порог ловит пустой или обрезанный
# файл, который иначе выглядел бы идеально «уникальным».
MIN_PAGE_WORDS = 300

STORY_COLUMNS = ("story_p1", "story_p2", "story_p3")
STORY_SECTION_RE = re.compile(r'<section\b[^>]*\bid="story"[^>]*>(?P<body>.*?)</section>', re.S)


def visible_text(raw: str) -> str:
    raw = re.sub(r"<!--.*?-->", " ", raw, flags=re.S)
    raw = re.sub(r"<(script|style|noscript)\b.*?</\1>", " ", raw, flags=re.S)
    text = html_lib.unescape(re.sub(r"<[^>]+>", " ", raw))
    return re.sub(r"\s+", " ", text).strip()


def tokens(text: str) -> list[str]:
    return re.findall(r"[а-яёa-z0-9]+", text.lower())


def shingles(text: str) -> set[tuple[str, ...]]:
    words = tokens(text)
    return {tuple(words[i : i + SHINGLE]) for i in range(len(words) - SHINGLE + 1)}


def story_paragraphs(raw: str) -> list[str] | None:
    """Абзацы секции #story или None, если самой секции нет.

    Заголовок секции в сравнение не входит: пустая секция — это секция без
    текста в абзацах, даже если в ней остался `<h2>`.
    """
    match = STORY_SECTION_RE.search(raw)
    if not match:
        return None
    body = re.sub(r"<!--.*?-->", " ", match.group("body"), flags=re.S)
    body = re.sub(r"<(script|style)\b.*?</\1>", " ", body, flags=re.S)
    paragraphs = []
    for chunk in re.findall(r"<p\b[^>]*>(?P<text>.*?)</p>", body, re.S):
        text = re.sub(r"\s+", " ", html_lib.unescape(re.sub(r"<[^>]+>", " ", chunk))).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def is_subsequence(needle: list[str], haystack: list[str]) -> bool:
    """Все слова needle встречаются в haystack в том же порядке."""
    if not needle:
        return False
    remaining = iter(haystack)
    return all(word in remaining for word in needle)


@dataclass
class CityMetrics:
    slug: str
    page_words: int
    story_words: int
    share_with_others: float


@dataclass
class Report:
    ok: bool
    problems: list[str] = field(default_factory=list)
    cities: list[CityMetrics] = field(default_factory=list)
    pairs: list[tuple[float, str, str]] = field(default_factory=list)
    avg_jaccard: float = 0.0
    worst_jaccard: float = 0.0
    worst_pair: tuple[str, str] = ("", "")

    @property
    def summary(self) -> str:
        return (
            f"Уникальность пригородов OK: {len(self.cities)} страниц, "
            f"средний Jaccard {self.avg_jaccard:.3f} (лимит {MAX_AVG_JACCARD}), "
            f"максимум {self.worst_jaccard:.3f} (лимит {MAX_PAIR_JACCARD}), "
            f"мин. объём городского текста "
            f"{min((c.story_words for c in self.cities), default=0)} слов "
            f"(лимит {MIN_STORY_WORDS})"
        )


def read_cities(root: Path) -> list[dict[str, str]]:
    with (root / "prigorody" / "_cities.csv").open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def city_directories(root: Path) -> dict[str, Path]:
    base = root / "prigorody"
    directories: dict[str, Path] = {}
    for path in sorted(base.iterdir()):
        if not path.is_dir() or path.name.startswith(("_", ".")) or path.name == "__pycache__":
            continue
        directories[path.name] = path
    return directories


def analyze(root: Path = ROOT) -> Report:
    """Считает метрики и проверки серии; сам ничего не печатает и не падает."""
    report = Report(ok=False)
    problems = report.problems

    rows = read_cities(root)
    csv_slugs: list[str] = []
    for row in rows:
        slug = (row.get("slug") or "").strip()
        if not slug:
            problems.append("в _cities.csv есть строка без slug")
            continue
        if slug in csv_slugs:
            problems.append(f"{slug}: slug повторяется в _cities.csv")
        csv_slugs.append(slug)
    if not csv_slugs:
        problems.append("в _cities.csv нет ни одного города")

    directories = city_directories(root)
    missing_pages = [slug for slug in csv_slugs if slug not in directories]
    orphan_pages = sorted(set(directories) - set(csv_slugs))
    if missing_pages:
        problems.append(
            f"нет каталогов для городов из CSV: {', '.join(missing_pages)} "
            f"(генератор не выпустил {len(missing_pages)} из {len(csv_slugs)})"
        )
    if orphan_pages:
        problems.append(
            f"каталоги без строки в _cities.csv: {', '.join(orphan_pages)}"
        )

    texts: dict[str, str] = {}
    story_words: dict[str, int] = {}

    for row in rows:
        slug = (row.get("slug") or "").strip()
        if not slug:
            continue
        expected_story = tokens(" ".join(row.get(column, "") for column in STORY_COLUMNS))
        story_words[slug] = len(expected_story)
        if len(expected_story) < MIN_STORY_WORDS:
            problems.append(
                f"{slug}: городской текст {len(expected_story)} слов < {MIN_STORY_WORDS}"
            )
        if not expected_story:
            problems.append(f"{slug}: в _cities.csv пустой городской текст")

        page = directories.get(slug)
        if page is None:
            continue
        index = page / "index.html"
        if not index.exists():
            problems.append(f"{slug}: нет index.html в каталоге страницы")
            continue
        raw = index.read_text(encoding="utf-8")
        if not raw.strip():
            problems.append(f"{slug}: index.html пустой")
            continue

        text = visible_text(raw)
        texts[slug] = text
        page_tokens = tokens(text)
        if len(page_tokens) < MIN_PAGE_WORDS:
            problems.append(
                f"{slug}: страница почти пустая — {len(page_tokens)} слов < {MIN_PAGE_WORDS}"
            )

        paragraphs = story_paragraphs(raw)
        if paragraphs is None:
            problems.append(f"{slug}: нет секции #story в собранном HTML")
        elif not tokens(" ".join(paragraphs)):
            problems.append(f"{slug}: секция #story пустая")
        elif expected_story and not is_subsequence(expected_story, tokens(" ".join(paragraphs))):
            problems.append(
                f"{slug}: текст #story в HTML не совпадает с story_p1..p3 из _cities.csv"
            )

    if len(texts) < 2:
        problems.append(
            f"страниц с текстом для сравнения: {len(texts)} — метрику дублирования считать нельзя"
        )
        return report

    shingle_sets = {slug: shingles(text) for slug, text in texts.items()}
    for slug, own in shingle_sets.items():
        if not own:
            problems.append(f"{slug}: слишком мало текста для 5-грамм")

    pairs: list[tuple[float, str, str]] = []
    for a, b in itertools.combinations(sorted(shingle_sets), 2):
        inter = len(shingle_sets[a] & shingle_sets[b])
        union = len(shingle_sets[a] | shingle_sets[b])
        pairs.append((inter / union if union else 0.0, a, b))
    if not pairs:
        problems.append("не из чего считать Jaccard: меньше двух страниц")
        return report

    avg = sum(pair[0] for pair in pairs) / len(pairs)
    worst = max(pairs)
    if avg > MAX_AVG_JACCARD:
        problems.append(f"средний Jaccard {avg:.3f} > {MAX_AVG_JACCARD}")
    if worst[0] > MAX_PAIR_JACCARD:
        problems.append(
            f"самая похожая пара {worst[1]} ↔ {worst[2]} = {worst[0]:.3f} > {MAX_PAIR_JACCARD}"
        )

    overlap_share: dict[str, float] = {}
    for slug, own in shingle_sets.items():
        others: set[tuple[str, ...]] = set()
        for other, theirs in shingle_sets.items():
            if other != slug:
                others |= theirs
        overlap_share[slug] = len(own & others) / max(len(own), 1)

    report.cities = [
        CityMetrics(
            slug=slug,
            page_words=len(tokens(text)),
            story_words=story_words.get(slug, 0),
            share_with_others=overlap_share.get(slug, 0.0),
        )
        for slug, text in sorted(texts.items())
    ]
    report.pairs = pairs
    report.avg_jaccard = avg
    report.worst_jaccard = worst[0]
    report.worst_pair = (worst[1], worst[2])
    report.ok = not problems
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="печатать таблицу по городам")
    args = parser.parse_args(argv)

    report = analyze(ROOT)

    if args.report:
        print(f"{'город':<14}{'слов':>7}{'story':>7}{'общих 5-грамм':>15}")
        for city in report.cities:
            print(
                f"{city.slug:<14}{city.page_words:>7}"
                f"{city.story_words:>7}{city.share_with_others:>14.0%}"
            )
        print(
            f"\nПар: {len(report.pairs)} | средний Jaccard {report.avg_jaccard:.3f} | максимум "
            f"{report.worst_jaccard:.3f} ({report.worst_pair[0]} ↔ {report.worst_pair[1]})"
        )

    if report.problems:
        print("Городские страницы не прошли проверку серии:")
        for item in report.problems:
            print(f"  - {item}")
        return 1
    print(report.summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
