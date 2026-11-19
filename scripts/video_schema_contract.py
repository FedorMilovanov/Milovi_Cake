#!/usr/bin/env python3
"""Fail closed on VideoObject publication provenance and Google-facing DateTime shape."""
from __future__ import annotations

from datetime import datetime
from html import unescape
import json
from pathlib import Path
import re
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "video-publication.json"
GALLERY_DATA = ROOT / "js" / "gallery" / "data.js"
LD_JSON_RE = re.compile(
    r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
GALLERY_VIDEO_RE = re.compile(r"src:\s*['\"](/img/gallery/videos/[^'\"]+\.webm)['\"]")
GALLERY_ENTRY_RE = re.compile(
    r"\{\s*id:\s*'v\d+',\s*type:\s*'video',\s*src:\s*'(?P<src>[^']+)',"
    r"\s*poster:\s*'(?P<poster>[^']+)',\s*title:\s*'(?P<title>[^']+)',"
    r"\s*desc:\s*'(?P<desc>[^']+)'"
    r",\s*playback:\s*'(?P<playback>[^']+)'"
)


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


def check_video_posters(gallery_text: str, published: dict[str, str]) -> dict[str, str]:
    """Guard the reviewed video frame across gallery, homepage, sitemap and schema."""
    entries = {match['src']: match.groupdict() for match in GALLERY_ENTRY_RE.finditer(gallery_text)}
    if set(entries) != set(published):
        fail(f"video poster entries mismatch publication manifest: {sorted(set(published) ^ set(entries))}")
    if len(list(GALLERY_ENTRY_RE.finditer(gallery_text))) != len(entries):
        fail("duplicate gallery video entries")

    posters: dict[str, str] = {}
    for src, item in entries.items():
        if item['playback'] != src[:-5] + '.mp4':
            fail(f"{src}: gallery MP4 playback mapping differs from published WebM source")
        expected = f"/img/gallery/{Path(src).stem}-poster.webp"
        poster = item['poster']
        if poster != expected:
            fail(f"{src}: poster must be its own video frame ({expected}), not {poster}")
        media = ROOT / poster.lstrip('/')
        if not media.is_file():
            fail(f"{src}: poster is missing: {poster}")
        content = media.read_bytes()
        if not (content[:4] == b'RIFF' and content[8:12] == b'WEBP'):
            fail(f"{src}: poster is not a WebP image: {poster}")
        if len(content) > 70_000:
            fail(f"{src}: poster exceeds 70 KB: {len(content)} bytes")
        posters[src] = poster

    home = (ROOT / 'index.html').read_text(encoding='utf-8')
    match = re.search(r"data-videos='([^']+)'", home, re.DOTALL)
    if not match:
        fail('homepage video-strip JSON not found')
    strip = json.loads(unescape(match[1]))
    if {video.get('v'): video.get('p') for video in strip} != posters or len(strip) != len(posters):
        fail('homepage video strip must use the matching 16 frame posters')
    for video in strip:
        expected = video['v'][:-5] + '.mp4'
        if video.get('m') != expected:
            fail(f"{video['v']}: homepage MP4 playback URL must match published WebM")


    xml = ET.fromstring((ROOT / 'sitemap-videos.xml').read_text(encoding='utf-8'))
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9',
          'v': 'http://www.google.com/schemas/sitemap-video/1.1'}
    urls = xml.findall('s:url', ns)
    if len(urls) != 1 or urls[0].findtext('s:loc', namespaces=ns) != 'https://milovicake.ru/gallery/':
        fail('video sitemap must have a single gallery URL (not artificial watch pages)')
    reels = urls[0].findall('v:video', ns)
    if len(reels) != len(posters):
        fail(f'video sitemap must list exactly {len(posters)} reels, got {len(reels)}')
    seen: set[str] = set()
    for reel in reels:
        src = urlparse(reel.findtext('v:content_loc', default='', namespaces=ns)).path
        if src in seen or src not in entries:
            fail(f'video sitemap has an unknown or repeated content URL: {src}')
        seen.add(src)
        item = entries[src]
        for field, expected in (
            ('thumbnail_loc', 'https://milovicake.ru' + posters[src]),
            ('title', item['title']), ('description', item['desc']),
        ):
            actual = reel.findtext('v:' + field, namespaces=ns)
            if actual != expected:
                fail(f'video sitemap {src} {field}: {actual!r} != {expected!r}')
    return posters



def assert_h264_aac_samples(companion: Path, canonical: str) -> None:
    """Verify actual MP4 sample-description codec IDs, without ffprobe or downloads."""
    data = companion.read_bytes()

    def boxes(start: int, end: int):
        position = start
        while position + 8 <= end:
            size = int.from_bytes(data[position:position+4], 'big')
            kind = data[position+4:position+8]
            header = 8
            if size == 1:
                if position + 16 > end:
                    fail(f"{canonical}: truncated MP4 extended-size box")
                size = int.from_bytes(data[position+8:position+16], 'big')
                header = 16
            elif size == 0:
                size = end - position
            if size < header or position + size > end:
                fail(f"{canonical}: invalid MP4 {kind!r} box bounds")
            yield kind, position + header, position + size
            position += size

    def child(parent_start: int, parent_end: int, kind: bytes):
        return next(((a,b) for t,a,b in boxes(parent_start,parent_end) if t==kind),None)

    samples = {}
    for kind, moov_start, moov_end in boxes(0,len(data)):
        if kind != b'moov':
            continue
        for typ, trak_start, trak_end in boxes(moov_start,moov_end):
            if typ != b'trak':
                continue
            mdia=child(trak_start,trak_end,b'mdia')
            if not mdia:
                continue
            handler=child(*mdia,b'hdlr')
            minf=child(*mdia,b'minf')
            if not handler or not minf or handler[0]+12>handler[1]:
                continue
            handler_type=data[handler[0]+8:handler[0]+12]
            stbl=child(*minf,b'stbl')
            stsd=child(*stbl,b'stsd') if stbl else None
            if not stsd or stsd[0]+8>stsd[1]:
                continue
            count=int.from_bytes(data[stsd[0]+4:stsd[0]+8],'big')
            pos=stsd[0]+8
            codecs=[]
            for _ in range(min(count,16)):
                if pos+8>stsd[1]:
                    fail(f"{canonical}: truncated stsd sample entry")
                size=int.from_bytes(data[pos:pos+4],'big')
                if size < 8 or pos+size>stsd[1]:
                    fail(f"{canonical}: malformed stsd sample entry")
                codecs.append(data[pos+4:pos+8])
                pos+=size
            samples.setdefault(handler_type,set()).update(codecs)

    if b'avc1' not in samples.get(b'vide',set()) or b'mp4a' not in samples.get(b'soun',set()):
        fail(f"{canonical}: expected declared H.264/avc1 video and AAC/mp4a audio sample descriptions, got {samples}")

def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    published = manifest.get("videos")
    if not isinstance(published, dict) or not published:
        fail("publication manifest has no videos mapping")

    for path, timestamp in sorted(published.items()):
        if not isinstance(path, str) or not path.startswith("/img/gallery/videos/") or not path.endswith(".webm"):
            fail(f"manifest contains invalid self-hosted video path {path!r}")
        parse_aware_datetime(timestamp, f"manifest:{path}")
        # Every published VP9/Opus source must also ship the matching Safari-
        # compatible H.264/AAC MP4. The canonical WebM provenance, uploadDate,
        # frame-poster identity and VideoObject URL remain unchanged.
        companion = (ROOT / path.lstrip('/')).with_suffix('.mp4')
        if not companion.is_file():
            fail(f"{path}: required MP4 playback companion is missing: {companion.name}")
        if not (4096 <= companion.stat().st_size <= 12_000_000):
            fail(f"{path}: required MP4 has unexpected size: {companion.stat().st_size}")
        with companion.open('rb') as stream:
            header = stream.read(12)
        if header[4:8] != b'ftyp':
            fail(f"{path}: required MP4 companion has invalid ISO BMFF header")
        assert_h264_aac_samples(companion, path)


    gallery_text = GALLERY_DATA.read_text(encoding="utf-8")
    gallery_videos = set(GALLERY_VIDEO_RE.findall(gallery_text))
    manifest_videos = set(published)
    if gallery_videos != manifest_videos:
        missing = sorted(gallery_videos - manifest_videos)
        stale = sorted(manifest_videos - gallery_videos)
        fail(f"gallery/publication manifest mismatch; missing={missing}, stale={stale}")
    posters = check_video_posters(gallery_text, published)

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
                        if parsed_path in posters and obj.get('thumbnailUrl') != 'https://milovicake.ru' + posters[parsed_path]:
                            errors.append(f"{where}: thumbnailUrl does not match the reviewed video frame for {parsed_path}")

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
