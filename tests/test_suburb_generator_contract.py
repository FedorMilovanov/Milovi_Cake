"""Контракт генератора пригородов: серия должна реально существовать.

`check_prigorody_uniqueness.py` считает схожесть по 5-граммам, но раньше
проверял только `_cities.csv` и найденные файлы. Из-за этого пропавшая или
пустая страница выглядела улучшением метрики: пустое пересечение давало
Jaccard 0.000, а объём городского текста брался из CSV, а не из HTML.

Эти тесты фиксируют две вещи:
  * на живом репозитории серия полная и `#story` совпадает с CSV;
  * на синтетических наборах проверка обязана падать, если страницы нет,
    файл пустой, секция пустая или её текст разошёлся с CSV.
"""

import csv
import tempfile
import unittest
from pathlib import Path

from scripts import check_prigorody_uniqueness as uniqueness

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ("slug", "story_h2", "story_p1", "story_p2", "story_p3")


def story_tokens(city: int, count: int = 130) -> list[str]:
    """Городской текст нужного объёма: слова уникальны для каждого города."""
    return [f"с{city}и{index}" for index in range(count)]


def filler_tokens(city: int, count: int = 400) -> list[str]:
    return [f"ф{city}н{index}" for index in range(count)]


def page_html(city: int, story: list[str] | None = None, with_section: bool = True) -> str:
    filler = " ".join(filler_tokens(city))
    if not with_section:
        return f"<html><body><main><p>{filler}</p></main></body></html>"
    words = story if story is not None else story_tokens(city)
    third = max(1, len(words) // 3)
    paragraphs = "".join(
        f"<p>{' '.join(words[start:start + third])}</p>"
        for start in range(0, len(words), third)
    )
    return (
        "<html><body><main>"
        f"<p>{filler}</p>"
        '<section class="city-story" id="story">'
        "<h2>История города</h2>"
        f"{paragraphs}"
        "</section></main></body></html>"
    )


class SuburbGeneratorContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / "prigorody").mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write_csv(self, slugs: list[str]) -> None:
        with (self.root / "prigorody" / "_cities.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=COLUMNS)
            writer.writeheader()
            for index, slug in enumerate(slugs):
                words = story_tokens(index)
                third = len(words) // 3
                writer.writerow({
                    "slug": slug,
                    "story_h2": f"История {slug}",
                    "story_p1": " ".join(words[:third]),
                    "story_p2": " ".join(words[third:2 * third]),
                    "story_p3": " ".join(words[2 * third:]),
                })

    def write_page(self, slug: str, html: str) -> None:
        directory = self.root / "prigorody" / slug
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "index.html").write_text(html, encoding="utf-8")

    def healthy_series(self, slugs: list[str]) -> None:
        self.write_csv(slugs)
        for index, slug in enumerate(slugs):
            self.write_page(slug, page_html(index))

    # ── живой репозиторий ────────────────────────────────────────────────
    def test_real_series_passes_and_matches_csv(self):
        report = uniqueness.analyze(ROOT)
        self.assertTrue(report.ok, report.problems)
        self.assertEqual(len(report.cities), 14)
        self.assertGreaterEqual(
            min(city.page_words for city in report.cities), uniqueness.MIN_PAGE_WORDS
        )

    # ── контрольные наборы ───────────────────────────────────────────────
    def test_healthy_fixture_passes(self):
        self.healthy_series(["alpha", "beta", "gamma"])
        report = uniqueness.analyze(self.root)
        self.assertTrue(report.ok, report.problems)
        self.assertEqual(len(report.cities), 3)

    def test_missing_generated_page_fails(self):
        # CSV на три города, на диске два файла: раньше это давало «OK: 2 страниц».
        self.write_csv(["alpha", "beta", "gamma"])
        self.write_page("alpha", page_html(0))
        self.write_page("beta", page_html(1))
        report = uniqueness.analyze(self.root)
        self.assertFalse(report.ok)
        self.assertTrue(
            any("нет каталогов для городов из CSV" in problem for problem in report.problems),
            report.problems,
        )
        self.assertTrue(
            any("gamma" in problem for problem in report.problems), report.problems
        )

    def test_orphan_directory_fails(self):
        self.write_csv(["alpha", "beta"])
        self.write_page("alpha", page_html(0))
        self.write_page("beta", page_html(1))
        self.write_page("delta", page_html(2))
        report = uniqueness.analyze(self.root)
        self.assertFalse(report.ok)
        self.assertTrue(
            any("каталоги без строки в _cities.csv" in problem for problem in report.problems),
            report.problems,
        )

    def test_empty_index_html_fails(self):
        self.write_csv(["alpha", "beta"])
        self.write_page("alpha", "")
        self.write_page("beta", page_html(1))
        report = uniqueness.analyze(self.root)
        self.assertFalse(report.ok)
        self.assertTrue(
            any("index.html пустой" in problem for problem in report.problems), report.problems
        )

    def test_missing_story_section_fails(self):
        self.write_csv(["alpha", "beta"])
        self.write_page("alpha", page_html(0, with_section=False))
        self.write_page("beta", page_html(1))
        report = uniqueness.analyze(self.root)
        self.assertFalse(report.ok)
        self.assertTrue(
            any("нет секции #story" in problem for problem in report.problems), report.problems
        )

    def test_empty_story_section_fails(self):
        self.write_csv(["alpha", "beta"])
        # Секция без текста в абзацах: заголовок остался, абзацы пустые.
        self.write_page(
            "alpha",
            "<html><body><main><p>"
            + " ".join(filler_tokens(0))
            + '</p><section class="city-story" id="story"><h2>История</h2><p></p><p> </p></section>'
            "</main></body></html>",
        )
        self.write_page("beta", page_html(1))
        report = uniqueness.analyze(self.root)
        self.assertFalse(report.ok)
        self.assertTrue(
            any("секция #story пустая" in problem for problem in report.problems), report.problems
        )

    def test_story_text_mismatch_fails(self):
        self.write_csv(["alpha", "beta"])
        self.write_page("alpha", page_html(0, story=[f"чужой{index}" for index in range(130)]))
        self.write_page("beta", page_html(1))
        report = uniqueness.analyze(self.root)
        self.assertFalse(report.ok)
        self.assertTrue(
            any("не совпадает с story_p1..p3" in problem for problem in report.problems),
            report.problems,
        )

    def test_truncated_page_fails(self):
        self.write_csv(["alpha", "beta"])
        self.write_page("alpha", page_html(0).replace(" ".join(filler_tokens(0)), "короткий текст"))
        self.write_page("beta", page_html(1))
        report = uniqueness.analyze(self.root)
        self.assertFalse(report.ok)
        self.assertTrue(
            any("страница почти пустая" in problem for problem in report.problems), report.problems
        )


if __name__ == "__main__":
    unittest.main()
