#!/usr/bin/env python3
"""Report an independent surfaceless Mesa EGL renderer, not WebKit's context."""
import re
import subprocess
import sys


def surfaceless_renderer(output: str) -> str | None:
    match = re.search(r'^Surfaceless platform:[ \t]*$(.*?)(?=^[^\s\n][^\n]*platform:|\Z)', output, re.M | re.S | re.I)
    if not match:
        return None
    renderer = re.search(r'^OpenGL (?:ES |core |compatibility )?profile renderer:\s*(.+)$', match.group(1), re.M | re.I)
    return renderer.group(1).strip() if renderer else None


def notice(title: str, text: str) -> None:
    escaped = text[:2000].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print(f'::notice title={title}::{escaped}')


def main(expected: str) -> None:
    try:
        result = subprocess.run(['eglinfo', '-B'], text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, timeout=30, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise SystemExit(f'EGL probe could not run: {exc}') from exc
    renderer = surfaceless_renderer(result.stdout)
    notice('EGL probe output', f'exit={result.returncode}\n{result.stdout}')
    if result.returncode < 0 or result.returncode >= 128:
        raise SystemExit(f'EGL probe terminated abnormally: {result.returncode}')
    if not renderer:
        raise SystemExit('No renderer found in surfaceless EGL output')
    if expected == 'softpipe' and 'softpipe' not in renderer.lower():
        raise SystemExit(f'Requested softpipe but independent EGL probe returned {renderer}')
    notice('Independent surfaceless EGL renderer', renderer + ' (not proof of WebKit compositor selection)')


if __name__ == '__main__':
    main(sys.argv[1])
