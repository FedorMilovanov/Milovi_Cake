#!/usr/bin/env python3
"""Держит `<lastmod>` в sitemap.xml честным: дата меняется только при изменении контента.

Как это работает
----------------
Для каждой страницы из sitemap.xml считается sha256 её HTML с нормализацией
ревизий ассетов (`?v=...` выбрасывается, чтобы поднятие версии CSS не выглядело
как правка текста). Хэш и дата последнего изменения хранятся в
`data/sitemap-lastmod.json` — это единственный источник даты:

* хэш изменился или страница новая → дата = сегодня, состояние перезаписано;
* хэш совпал → дата остаётся прежней.

Для городских страниц дата дополнительно проставляется в
`prigorody/_cities.csv` (колонка `lastmod`), потому что этот файл — источник
истины для `scripts/sync_prigorody_sitemap.py --check`.

Run:
    python3 scripts/sync_sitemap_lastmod.py           # обновить sitemap и состояние
    python3 scripts/sync_sitemap_lastmod.py --check   # только проверить (CI)
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITEMAP = ROOT / "sitemap.xml"
STATE = ROOT / "data" / "sitemap-lastmod.json"
CITIES = ROOT / "prigorody" / "_cities.csv"
REVISION_SUFFIX = re.compile(r"\?v=[0-9A-Za-z.\-]+")
URL_RE = re.compile(r"<url>(.*?)</url>", re.S)
LOC_RE = re.compile(r"<loc>https://milovicake\.ru([^<]*)</loc>")
LASTMOD_RE = re.compile(r"<lastmod>\d{4}-\d{2}-\d{2}</lastmod>")


def page_path(url_path: str) -> Path:
    relative = url_path.strip("/")
    return ROOT / relative / "index.html" if relative else ROOT / "index.html"


def content_hash(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    text = REVISION_SUFFIX.sub("", text)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_state() -> dict[str, dict[str, str]]:
    if not STATE.exists():
        return {}
    data = json.loads(STATE.read_text(encoding="utf-8"))
    pages = data.get("pages")
    if not isinstance(pages, dict):
        raise SystemExit(f"{STATE}: ожидался объект pages")
    return pages


def sitemap_rows() -> list[tuple[str, str, re.Match[str]]]:
    """(url_path, lastmod, match_объекта_блока <url>)."""
    text = SITEMAP.read_text(encoding="utf-8")
    rows: list[tuple[str, str, re.Match[str]]] = []
    for block in URL_RE.finditer(text):
        body = block.group(1)
        loc = LOC_RE.search(body)
        lastmod = re.search(r"<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>", body)
        if not loc or not lastmod:
            raise SystemExit(f"sitemap.xml: в блоке без loc/lastmod: {body[:80]!r}")
        rows.append((loc.group(1), lastmod.group(1), block))
    return rows


def update_cities_csv(dates: dict[str, str]) -> bool:
    with CITIES.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
        fieldnames = list(rows[0].keys())
    changed = False
    for row in rows:
        new_date = dates.get(f"/prigorody/{row['slug']}/")
        if new_date and row.get("lastmod") != new_date:
            row["lastmod"] = new_date
            changed = True
    if changed:
        with CITIES.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="только проверка, без записи")
    parser.add_argument("--today", help="дата для новых изменений (по умолчанию сегодня)")
    args = parser.parse_args()
    today = args.today or date.today().isoformat()

    state = load_state()
    rows = sitemap_rows()
    problems: list[str] = []
    new_state: dict[str, dict[str, str]] = {}
    dates: dict[str, str] = {}

    for url_path, lastmod, _ in rows:
        path = page_path(url_path)
        if not path.exists():
            problems.append(f"{url_path}: файл не найден ({path.relative_to(ROOT)})")
            continue
        digest = content_hash(path)
        previous = state.get(url_path) or {}
        if previous.get("hash") == digest:
            changed_on = previous.get("date", lastmod)
        else:
            changed_on = today
        if changed_on != lastmod:
            problems.append(f"{url_path}: в sitemap {lastmod}, по контенту {changed_on}")
        new_state[url_path] = {"hash": digest, "date": changed_on}
        dates[url_path] = changed_on

    stale_state = sorted(set(state) - set(new_state))
    for gone in stale_state:
        problems.append(f"{gone}: запись есть в состоянии, но URL больше нет в sitemap")

    if args.check:
        if problems:
            raise SystemExit(
                "sitemap lastmod расходится с контентом:\n- "
                + "\n- ".join(problems)
                + "\nЗапустите: python3 scripts/sync_sitemap_lastmod.py"
            )
        print(f"Sitemap lastmod OK: {len(rows)} URL совпадают с хэшами контента")
        return 0

    text = SITEMAP.read_text(encoding="utf-8")
    for url_path, _, block in rows:
        body = block.group(1)
        replacement = LASTMOD_RE.sub(
            f"<lastmod>{dates[url_path]}</lastmod>", body, count=1
        )
        text = text.replace(body, replacement, 1)
    SITEMAP.write_text(text, encoding="utf-8")
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(
        json.dumps({"schema_version": 1, "pages": new_state}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    csv_changed = update_cities_csv(dates)
    bumped = sum(1 for p in problems if "по контенту" in p)
    print(
        f"sitemap.xml: обновлено {len(rows)} URL, изменений {bumped}, "
        f"CSV городов {'обновлён' if csv_changed else 'без изменений'}, "
        f"удалено записей состояния: {len(stale_state)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
