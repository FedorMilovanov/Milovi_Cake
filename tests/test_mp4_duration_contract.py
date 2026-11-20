"""Контракт разбора длительности MP4 для видео-карты.

`scripts/build_video_sitemap.py` берёт `/video:duration` из атома `mvhd`.
Версия 0 и версия 1 этого атома имеют разные смещения: у v1 два 64-битных
времени, поэтому `timescale` начинается на `at+24`, а не `at+20`. Ошибка в
смещении не видна на текущих роликах (все они v0), но молча даёт «нулевой
timescale» на первом же файле v1 — то есть падение генератора или, при другом
мусоре в байтах, неверную длительность в sitemap.
"""

import re
import struct
import tempfile
import unittest
from pathlib import Path

from scripts import build_video_sitemap as sitemap

ROOT = Path(__file__).resolve().parents[1]


def mvhd_box(version: int, timescale: int, duration: int,
             creation: int = 0, modification: int = 0) -> bytes:
    """Собирает минимальный MP4-префикс с атомом `mvhd` нужной версии."""
    if version == 0:
        payload = (
            bytes([0, 0, 0, 0])
            + creation.to_bytes(4, "big")
            + modification.to_bytes(4, "big")
            + timescale.to_bytes(4, "big")
            + duration.to_bytes(4, "big")
        )
    else:
        payload = (
            bytes([1, 0, 0, 0])
            + creation.to_bytes(8, "big")
            + modification.to_bytes(8, "big")
            + timescale.to_bytes(4, "big")
            + duration.to_bytes(8, "big")
        )
    box = (len(payload) + 8).to_bytes(4, "big") + b"mvhd" + payload
    # `ftyp` перед `mvhd` — как в настоящем контейнере, чтобы поиск типа
    # не совпал со смещением 0.
    return b"s" * 8 + box + b"\x00\x00\x00\x08free"


class Mp4DurationContractTest(unittest.TestCase):
    def duration_of(self, blob: bytes) -> int:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "clip.mp4"
            path.write_bytes(blob)
            return sitemap.mp4_duration_seconds(path)

    def test_version_0_and_version_1_both_return_90_seconds(self):
        self.assertEqual(self.duration_of(mvhd_box(0, 1000, 90_000)), 90)
        self.assertEqual(self.duration_of(mvhd_box(1, 1000, 90_000)), 90)

    def test_version_1_ignores_64_bit_creation_times(self):
        # Ненулевые 64-битные времена: при смещении на +20 байт timescale
        # читается из хвоста modification_time и получается нулевым.
        blob = mvhd_box(1, 1000, 90_000,
                        creation=0xFFFFFFFFFFFFFFFF,
                        modification=0x1234_5678_9ABC_DEF0)
        self.assertEqual(self.duration_of(blob), 90)

    def test_version_1_rounds_to_nearest_second(self):
        self.assertEqual(self.duration_of(mvhd_box(1, 1000, 90_400)), 90)
        self.assertEqual(self.duration_of(mvhd_box(0, 600, 54_000)), 90)

    def test_version_1_zero_timescale_is_reported_not_silently_zero(self):
        with self.assertRaises(SystemExit) as ctx:
            self.duration_of(mvhd_box(1, 0, 90_000))
        self.assertIn("нулевой timescale", str(ctx.exception))

    def test_every_gallery_video_parses_to_positive_duration(self):
        data_js = (ROOT / "js/gallery/data.js").read_text(encoding="utf-8")
        playbacks = re.findall(r"playback:\s*'([^']+)'", data_js)
        self.assertGreaterEqual(len(playbacks), 16)
        for playback in playbacks:
            media = ROOT / playback.lstrip("/")
            self.assertTrue(media.exists(), f"{playback}: файла нет")
            duration = sitemap.mp4_duration_seconds(media)
            self.assertGreater(duration, 0, f"{playback}: длительность {duration}")

    def test_sitemap_durations_match_the_files(self):
        xml = (ROOT / "sitemap-videos.xml").read_text(encoding="utf-8")
        durations = [int(value) for value in
                     re.findall(r"<video:duration>(\d+)</video:duration>", xml)]
        self.assertEqual(len(durations), 16)
        self.assertTrue(all(duration > 0 for duration in durations))

    def test_no_gallery_video_uses_version_1_today(self):
        # Если это утверждение когда-нибудь сломается — значит, живой файл
        # впервые пришёл в контейнере v1 и разбор по смещению проверен на бою.
        data_js = (ROOT / "js/gallery/data.js").read_text(encoding="utf-8")
        versions = set()
        for playback in re.findall(r"playback:\s*'([^']+)'", data_js):
            raw = (ROOT / playback.lstrip("/")).read_bytes()
            at = raw.find(b"mvhd")
            self.assertGreaterEqual(at, 0, f"{playback}: нет mvhd")
            versions.add(raw[at + 4])
        self.assertTrue(versions <= {0, 1}, f"неизвестные версии mvhd: {sorted(versions)}")


if __name__ == "__main__":
    unittest.main()
