#!/usr/bin/env python3
"""Prepare a temporary grid-video release variant for a browser comparison.

This diagnostic does not edit its source file. It resets offscreen grid videos
and releases grid media while the lightbox is open; playback, observers, CSS,
and the existing tests otherwise remain unchanged.
"""
from __future__ import annotations

import argparse
from pathlib import Path

REPLACEMENTS = (
    (
        'function setupVideoObserver(){',
        "function releaseGridVideo(v) {\n"
        "  v.pause();\n"
        "  if (v.hasAttribute('src')) {\n"
        "    v.removeAttribute('src');\n"
        "    v.load();\n"
        "  }\n"
        "}\n"
        'function setupVideoObserver(){',
    ),
    (
        '    try { v.pause(); } catch(e){}\n  }\n  state.observer=new IntersectionObserver',
        '    try { releaseGridVideo(v); } catch(e){}\n  }\n  state.observer=new IntersectionObserver',
    ),
    (
        "$$('#galleryGrid video').forEach(v => v.pause());",
        "$$('#galleryGrid video').forEach(releaseGridVideo);",
    ),
)


def release_offscreen_grid_media(source: str) -> str:
    if 'function releaseGridVideo(' in source:
        raise ValueError('The media-release helper already exists')
    result = source
    for old, new in REPLACEMENTS:
        if result.count(old) != 1:
            raise ValueError(f'Expected one occurrence of JS marker: {old!r}')
        result = result.replace(old, new, 1)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('source and output must be different files')
    args.output.write_text(release_offscreen_grid_media(args.source.read_text(encoding='utf-8')), encoding='utf-8')


if __name__ == '__main__':
    main()
