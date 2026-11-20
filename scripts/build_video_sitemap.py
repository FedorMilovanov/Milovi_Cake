#!/usr/bin/env python3
"""Собирает sitemap-videos.xml из js/gallery/data.js, медиафайлов и манифеста публикаций.

Зачем генератор, а не ручной XML
--------------------------------
`/video:duration` и `/video:publication_date` — рекомендованные поля Google,
без них видео хуже попадают в видео-результаты. Ручной XML расходится с
фактическими файлами при первой же замене ролика, поэтому длительность и дата
публикации берутся из первоисточников:

* длительность — из MP4-контейнера (`mvhd`), того же ролика, что лежит в галерее;
* дата публикации — из `data/video-publication.json` (там же, где её берёт
  VideoObject-разметка страниц).

Run: python3 scripts/build_video_sitemap.py [--check]
"""

from __future__ import annotations

import argparse
import json
import re
import struct
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
GALLERY_DATA = ROOT / "js" / "gallery" / "data.js"
PUBLICATION = ROOT / "data" / "video-publication.json"
OUTPUT = ROOT / "sitemap-videos.xml"
SITE = "https://milovicake.ru"
GALLERY_URL = f"{SITE}/gallery/"

ENTRY_RE = re.compile(
    r"\{\s*id:\s*'(?P<id>v\d+)',\s*type:\s*'video',\s*src:\s*'(?P<src>[^']+)',"
    r"\s*poster:\s*'(?P<poster>[^']+)',\s*title:\s*'(?P<title>[^']+)',"
    r"\s*desc:\s*'(?P<desc>[^']+)'"
    r",\s*playback:\s*'(?P<playback>[^']+)'"
)


def mp4_duration_seconds(path: Path) -> int:
    """Длительность из атома `mvhd` (v0/v1) — без внешних зависимостей."""
    data = path.read_bytes()
    at = data.find(b"mvhd")
    if at < 0:
        raise SystemExit(f"{path}: не найден атом mvhd")
    version = data[at + 4]
    # `at` — первый байт типа «mvhd». Дальше: version(1) + flags(3), затем
    # creation/modification по 4 (v0) или по 8 (v1) байт, и только потом
    # timescale(4) и duration(4 у v0 / 8 у v1). Для v1 timescale начинается
    # на at+24, а не на at+20: сдвиг на 4 байта давал «нулевой timescale».
    if version == 0:
        timescale, duration = struct.unpack(">II", data[at + 16 : at + 24])
    elif version == 1:
        timescale, duration = struct.unpack(">IQ", data[at + 24 : at + 36])
    else:
        raise SystemExit(f"{path}: неизвестная версия mvhd {version}")
    if not timescale:
        raise SystemExit(f"{path}: нулевой timescale")
    seconds = round(duration / timescale)
    if seconds <= 0:
        raise SystemExit(f"{path}: нулевая длительность")
    return seconds


def gallery_videos() -> list[dict[str, str]]:
    entries = [m.groupdict() for m in ENTRY_RE.finditer(GALLERY_DATA.read_text(encoding="utf-8"))]
    if len(entries) < 16:
        raise SystemExit(f"js/gallery/data.js: найдено {len(entries)} видео, ожидалось 16")
    return entries


def build_xml() -> str:
    published = json.loads(PUBLICATION.read_text(encoding="utf-8"))["videos"]
    rows: list[str] = []
    for entry in gallery_videos():
        webm = entry["src"]
        playback = entry["playback"]
        if webm not in published:
            raise SystemExit(f"{webm}: нет даты публикации в data/video-publication.json")
        media = ROOT / playback.lstrip("/")
        if not media.exists():
            raise SystemExit(f"{playback}: файл не найден")
        poster = ROOT / entry["poster"].lstrip("/")
        if not poster.exists():
            raise SystemExit(f"{entry['poster']}: постер не найден")
        rows.append(
            "    <video:video>\n"
            f"      <video:thumbnail_loc>{SITE}{escape(entry['poster'])}</video:thumbnail_loc>\n"
            f"      <video:title>{escape(entry['title'])}</video:title>\n"
            f"      <video:description>{escape(entry['desc'])}</video:description>\n"
            f"      <video:content_loc>{SITE}{escape(webm)}</video:content_loc>\n"
            f"      <video:duration>{mp4_duration_seconds(media)}</video:duration>\n"
            f"      <video:publication_date>{escape(published[webm])}</video:publication_date>\n"
            f"      <video:family_friendly>yes</video:family_friendly>\n"
            "    </video:video>"
        )
    body = "\n".join(rows)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<!-- Сгенерировано scripts/build_video_sitemap.py из js/gallery/data.js,\n"
        "     длительностей MP4-файлов и data/video-publication.json. Не редактировать вручную. -->\n"
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n'
        "  <url>\n"
        f"    <loc>{GALLERY_URL}</loc>\n"
        f"{body}\n"
        "  </url>\n"
        "</urlset>\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="не писать файл, упасть при расхождении")
    args = parser.parse_args()
    xml = build_xml()
    current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
    if args.check:
        if current != xml:
            raise SystemExit(
                "sitemap-videos.xml устарел: запустите `python3 scripts/build_video_sitemap.py`"
            )
        print(f"Video sitemap OK: {xml.count('<video:video>')} роликов, duration и publication_date на месте")
        return 0
    OUTPUT.write_text(xml, encoding="utf-8")
    print(f"Записан {OUTPUT.relative_to(ROOT)}: {xml.count('<video:video>')} роликов")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
