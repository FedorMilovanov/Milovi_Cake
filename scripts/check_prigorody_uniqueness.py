#!/usr/bin/env python3
"""Проверяет, что городские страницы не являются почти-копиями друг друга.

Зачем: 14 страниц пригородов собираются из одного шаблона, и любая правка
шаблона легко возвращает «дорвейную» ситуацию, когда текст страниц совпадает
на 70%. Скрипт фиксирует метрики и падает, если они деградируют.

Метрики (по видимому тексту сгенерированных страниц):
  * Jaccard по 5-граммам слов — средняя и максимальная по всем парам;
  * доля 5-грамм, которые встречаются ещё хотя бы на одной странице (справочно);
  * объём уникального городского блока (story_p1..p3) в prigorody/_cities.csv.

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
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CITIES_CSV = ROOT / "prigorody" / "_cities.csv"
SHINGLE = 5

# Калибровка: сейчас средняя 0.58 / максимальная 0.60 / городской текст 141–172 слова.
# Порог оставляет запас на легитимные правки шаблона, но ловит возврат копипасты.
MAX_AVG_JACCARD = 0.62
MAX_PAIR_JACCARD = 0.68
MIN_STORY_WORDS = 120


def visible_text(path: Path) -> str:
    raw = path.read_text(encoding="utf-8")
    raw = re.sub(r"<!--.*?-->", " ", raw, flags=re.S)
    raw = re.sub(r"<(script|style|noscript)\b.*?</\1>", " ", raw, flags=re.S)
    text = html_lib.unescape(re.sub(r"<[^>]+>", " ", raw))
    return re.sub(r"\s+", " ", text).strip()


def tokens(text: str) -> list[str]:
    return re.findall(r"[а-яёa-z0-9]+", text.lower())


def shingles(text: str) -> set[tuple[str, ...]]:
    words = tokens(text)
    return {tuple(words[i : i + SHINGLE]) for i in range(len(words) - SHINGLE + 1)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="печатать таблицу по городам")
    args = parser.parse_args()

    pages = sorted(p for p in (ROOT / "prigorody").glob("*/index.html"))
    if len(pages) < 2:
        raise SystemExit("не найдено сгенерированных городских страниц")

    texts = {p.parent.name: visible_text(p) for p in pages}
    word_sets = {slug: set(tokens(text)) for slug, text in texts.items()}
    shingle_sets = {slug: shingles(text) for slug, text in texts.items()}

    problems: list[str] = []

    # 1. Jaccard по 5-граммам — основная метрика дублирования
    pairs: list[tuple[float, str, str]] = []
    for a, b in itertools.combinations(sorted(shingle_sets), 2):
        inter = len(shingle_sets[a] & shingle_sets[b])
        union = len(shingle_sets[a] | shingle_sets[b])
        pairs.append((inter / union if union else 0.0, a, b))
    avg = sum(p[0] for p in pairs) / len(pairs)
    overlap_share = {}
    for slug, own in shingle_sets.items():
        others: set[tuple[str, ...]] = set()
        for other, theirs in shingle_sets.items():
            if other != slug:
                others |= theirs
        overlap_share[slug] = len(own & others) / max(len(own), 1)
    worst = max(pairs)
    if avg > MAX_AVG_JACCARD:
        problems.append(f"средний Jaccard {avg:.3f} > {MAX_AVG_JACCARD}")
    if worst[0] > MAX_PAIR_JACCARD:
        problems.append(
            f"самая похожая пара {worst[1]} ↔ {worst[2]} = {worst[0]:.3f} > {MAX_PAIR_JACCARD}"
        )

    # 2. Объём уникального городского блока в CSV — то, чего не хватало в аудите
    with CITIES_CSV.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    story_words: dict[str, int] = {}
    for row in rows:
        count = sum(len(tokens(row.get(col, ""))) for col in ("story_p1", "story_p2", "story_p3"))
        story_words[row["slug"]] = count
        if count < MIN_STORY_WORDS:
            problems.append(f"{row['slug']}: городской текст {count} слов < {MIN_STORY_WORDS}")

    if args.report:
        print(f"{'город':<14}{'слов':>7}{'story':>7}{'общих 5-грамм':>15}")
        for slug in sorted(texts):
            print(
                f"{slug:<14}{len(tokens(texts[slug])):>7}"
                f"{story_words.get(slug, 0):>7}{overlap_share[slug]:>14.0%}"
            )
        print(f"\nПар: {len(pairs)} | средний Jaccard {avg:.3f} | максимум "
              f"{worst[0]:.3f} ({worst[1]} ↔ {worst[2]})")

    if problems:
        print("Городские страницы слишком похожи:")
        for item in problems:
            print(f"  - {item}")
        return 1
    print(
        f"Уникальность пригородов OK: {len(pages)} страниц, "
        f"средний Jaccard {avg:.3f} (лимит {MAX_AVG_JACCARD}), "
        f"максимум {worst[0]:.3f} (лимит {MAX_PAIR_JACCARD}), "
        f"мин. объём городского текста {min(story_words.values())} слов "
        f"(лимит {MIN_STORY_WORDS})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
