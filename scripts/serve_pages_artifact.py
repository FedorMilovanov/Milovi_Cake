#!/usr/bin/env python3
"""Отдать собранный Pages-артефакт так же, как его отдаёт GitHub Pages.

Зачем это нужно
---------------
Lighthouse с `throttlingMethod: simulate` моделирует сеть по **наблюдённым**
таймингам: реальные RTT и TLS до CDN попадают в модель, а потом усиливаются
до 4G+4xCPU. Поэтому аудит живого URL измеряет не только страницу, но и путь
от раннера до края CDN: те же байты локально дают LCP около 2,4 с, а через
прод — около 4,3 с (см. docs/TBT_VERDICT_2026-10-28.md §29.4).

Аудит артефакта убирает эту переменную: байты те же, сети до CDN нет.
Отсюда два разных вопроса и два разных инструмента:
  * «стала ли страница хуже» — артефакт, этот сервер;
  * «что видит пользователь через CDN» — живой URL, отдельный информационный прогон.

gzip обязателен: GitHub Pages сжимает текстовые ресурсы, и без него те же
байты дают FCP 3923 против 1826 (проверено в §29).

Usage:
    npm run build:pages
    python3 scripts/serve_pages_artifact.py --port 4300 --root _site
"""

from __future__ import annotations

import argparse
import functools
import gzip
import http.server
import pathlib
import socketserver
import sys
import urllib.parse

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".xml": "application/xml",
    ".txt": "text/plain; charset=utf-8",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".woff2": "font/woff2",
    ".mp4": "video/mp4",
}

# Сжимаем только текст: gzip на avif/webp/woff2 только тратит время.
COMPRESSIBLE = {".html", ".css", ".js", ".mjs", ".json", ".webmanifest",
                ".svg", ".xml", ".txt"}


class ArtifactHandler(http.server.BaseHTTPRequestHandler):
    """Статика из артефакта с gzip и без кэша (каждый прогон — холодный)."""

    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, root: pathlib.Path, **kwargs):
        self.root = root
        super().__init__(*args, **kwargs)

    def _send(self, body: bytes, content_type: str, status: int = 200,
              compress: bool = True) -> None:
        accepts_gzip = 'gzip' in (self.headers.get('Accept-Encoding') or '')
        if compress and accepts_gzip and len(body) > 512:
            body = gzip.compress(body, 6)
            self.send_response(status)
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Vary', 'Accept-Encoding')
        else:
            self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _resolve(self) -> pathlib.Path | None:
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        target = (self.root / path.lstrip('/')).resolve()
        if not str(target).startswith(str(self.root)):
            return None  # попытка выйти за пределы артефакта
        if target.is_dir():
            target = target / 'index.html'
        if target.is_file():
            return target
        # GitHub Pages отдаёт 404.html; для аудита достаточно честного 404.
        return None

    def do_GET(self) -> None:  # noqa: N802 — имя задано базовым классом
        target = self._resolve()
        if target is None:
            return self._send(b'not found', 'text/plain; charset=utf-8',
                              404, compress=False)
        suffix = target.suffix.lower()
        content_type = CONTENT_TYPES.get(suffix)
        if content_type:
            return self._send(target.read_bytes(), content_type,
                              compress=suffix in COMPRESSIBLE)
        data = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def log_message(self, *args) -> None:
        pass  # лог не нужен и мешает выводу CI


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='_site', help='каталог артефакта')
    parser.add_argument('--port', type=int, default=4300)
    parser.add_argument('--host', default='127.0.0.1')
    args = parser.parse_args(argv)

    root = pathlib.Path(args.root).resolve()
    if not (root / 'index.html').is_file():
        print(f'нет index.html в {root} — сначала npm run build:pages',
              file=sys.stderr)
        return 2

    handler = functools.partial(ArtifactHandler, root=root)
    with ReusableServer((args.host, args.port), handler) as httpd:
        print(f'artifact served: http://{args.host}:{args.port}/ root={root}',
              flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
