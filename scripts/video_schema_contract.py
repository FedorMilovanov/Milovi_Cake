#!/usr/bin/env python3
"""Fail closed on VideoObject publication provenance and Google-facing DateTime shape."""
from __future__ import annotations

from datetime import datetime
from html import unescape
import json
from pathlib import Path
import re
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "video-publication.json"
GALLERY_DATA = ROOT / "js" / "gallery" / "data.js"
LD_JSON_RE = re.compile(
    r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
GALLERY_VIDEO_RE = re.compile(r"src:\s*['\"](/img/gallery/videos/[^'\"]+\.webm)['\"]")


def fail(message: str) -> None:
    raise SystemExit(f"Video schema contract FAILED:\n- {message}")


def parse_aware_datetime(value: object, where: str) -> datetime:
    if not isinstance(value, str) or "T" not in value:
        fail(f"{where}: uploadDate must be an ISO 8601 date-time, got {value!r}")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        fail(f"{where}: invalid uploadDate {value!r}: {exc}")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        fail(f"{where}: uploadDate must include a timezone offset, got {value!r}")
    return parsed


def walk(value: object):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def is_video_object(obj: dict) -> bool:
    kind = obj.get("@type")
    if isinstance(kind, str):
        return kind == "VideoObject"
    if isinstance(kind, list):
        return "VideoObject" in kind
    return False


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    published = manifest.get("videos")
    if not isinstance(published, dict) or not published:
        fail("publication manifest has no videos mapping")

    for path, timestamp in sorted(published.items()):
        if not isinstance(path, str) or not path.startswith("/img/gallery/videos/") or not path.endswith(".webm"):
            fail(f"manifest contains invalid self-hosted video path {path!r}")
        parse_aware_datetime(timestamp, f"manifest:{path}")

    gallery_text = GALLERY_DATA.read_text(encoding="utf-8")
    gallery_videos = set(GALLERY_VIDEO_RE.findall(gallery_text))
    manifest_videos = set(published)
    if gallery_videos != manifest_videos:
        missing = sorted(gallery_videos - manifest_videos)
        stale = sorted(manifest_videos - gallery_videos)
        fail(f"gallery/publication manifest mismatch; missing={missing}, stale={stale}")

    errors: list[str] = []
    video_objects = 0
    represented: set[str] = set()

    for html_path in sorted(ROOT.rglob("*.html")):
        if any(part in {".git", "node_modules", "_site"} for part in html_path.parts):
            continue
        text = html_path.read_text(encoding="utf-8")
        # Generator templates can contain placeholder JSON-LD that is not valid JSON
        # until rendered. This contract owns only documents that actually advertise VideoObject.
        if "VideoObject" not in text:
            continue
        for block_index, raw in enumerate(LD_JSON_RE.findall(text), start=1):
            try:
                payload = json.loads(unescape(raw).strip())
            except json.JSONDecodeError as exc:
                errors.append(f"{html_path.relative_to(ROOT)} JSON-LD block {block_index}: invalid JSON ({exc})")
                continue
            for obj in walk(payload):
                if not is_video_object(obj):
                    continue
                video_objects += 1
                where = f"{html_path.relative_to(ROOT)} VideoObject#{video_objects}"
                for required in ("name", "thumbnailUrl", "contentUrl", "uploadDate"):
                    if not obj.get(required):
                        errors.append(f"{where}: missing required {required}")
                content_url = obj.get("contentUrl")
                upload_date = obj.get("uploadDate")
                try:
                    parse_aware_datetime(upload_date, where)
                except SystemExit as exc:
                    errors.append(str(exc).replace("Video schema contract FAILED:\n- ", ""))
                    continue
                if isinstance(content_url, str):
                    parsed_path = urlparse(content_url).path
                    if parsed_path.startswith("/img/gallery/videos/"):
                        represented.add(parsed_path)
                        expected = published.get(parsed_path)
                        if expected is None:
                            errors.append(f"{where}: {parsed_path} is missing from publication manifest")
                        elif upload_date != expected:
                            errors.append(
                                f"{where}: uploadDate {upload_date!r} != provenance manifest {expected!r} for {parsed_path}"
                            )

    if errors:
        raise SystemExit("Video schema contract FAILED:\n- " + "\n- ".join(errors))
    if video_objects == 0:
        fail("no VideoObject JSON-LD found")

    print(
        f"Video schema contract OK: {video_objects} VideoObject entries; "
        f"{len(represented)} represented self-hosted videos verified against "
        f"{len(manifest_videos)} provenance-backed gallery videos; timezone-aware uploadDate enforced"
    )


if __name__ == "__main__":
    main()
