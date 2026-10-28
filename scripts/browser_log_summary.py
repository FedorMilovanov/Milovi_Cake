#!/usr/bin/env python3
"""Surface bounded Playwright browser stderr/exit evidence in CI annotations."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ANSI = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')
EXIT = re.compile(r'<process did exit: exitCode=([^,>]+), signal=([^>]+)>')
CRASH = re.compile(r'crash|segmentation|sig(?:abrt|segv|ill)|fatal|critical', re.I)


def summarize_browser_log(log: str, limit: int = 40) -> str:
    if limit < 2:
        raise ValueError('limit must be at least 2')
    events = []
    for raw in log.splitlines():
        line = ANSI.sub('', raw).strip()
        if 'pw:browser' not in line:
            continue
        exit_match = EXIT.search(line)
        abnormal_exit = exit_match and exit_match.groups() != ('0', 'null')
        if '[err]' in line or abnormal_exit:
            events.append((line[:400], bool(abnormal_exit or CRASH.search(line))))

    header = ('Raw browser stderr and abnormal process exits; a signal after a '
              'timeout may be cleanup and does not establish the cause.')
    if not events:
        return header + '\nNo browser stderr or abnormal exit was captured.'
    if len(events) <= limit:
        return header + '\n' + '\n'.join(line for line, _ in events)

    # Keep crash-like evidence even when routine browser warnings are noisy.
    priority = [i for i, (_, critical) in enumerate(events) if critical]
    if len(priority) > limit:
        first = limit // 2
        selected = set(priority[:first] + priority[-(limit - first):])
    else:
        selected = set(priority)
        for i in range(len(events)):
            for candidate in (i, len(events) - 1 - i):
                if len(selected) < limit:
                    selected.add(candidate)
            if len(selected) == limit:
                break
    lines = [events[i][0] for i in sorted(selected)]
    lines.append(f'... {len(events) - len(selected)} matching events omitted ...')
    return header + '\n' + '\n'.join(lines)


def github_notice(message: str) -> str:
    escaped = message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    return f'::notice title=WebKit process diagnostics::{escaped}'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log', type=Path)
    args = parser.parse_args()
    print(github_notice(summarize_browser_log(args.log.read_text(encoding='utf-8', errors='replace'))))


if __name__ == '__main__':
    main()
