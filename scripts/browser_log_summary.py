#!/usr/bin/env python3
"""Surface bounded Playwright browser stderr/exit evidence in CI annotations."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ANSI = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')
EXIT = re.compile(r'<process did exit: exitCode=([^,>]+), signal=([^>]+)>')
CRASH = re.compile(r'crash|segmentation|sig(?:abrt|segv|ill)|fatal|assertion', re.I)
# This WebKit automation warning appears even in successful runs; it must not
# crowd actual signals out of GitHub's bounded annotation text.
AUTOMATION_NOISE = re.compile(r'WebKitWebView is-controlled-by-automation set but automation is not allowed', re.I)


def escape_annotation(message: str) -> str:
    return message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')


def summarize_browser_log(log: str, limit: int = 10) -> str:
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
            critical = (abnormal_exit or CRASH.search(line)
                        or ('critical' in line.lower() and not AUTOMATION_NOISE.search(line)))
            events.append((line[:240], bool(critical)))

    header = ('Raw browser stderr and abnormal process exits; a signal after a '
              'timeout may be cleanup and does not establish the cause.')
    if not events:
        return header + '\nNo browser stderr or abnormal exit was captured.'

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

    def render() -> str:
        lines = [events[i][0] for i in sorted(selected)]
        if len(selected) < len(events):
            lines.append(f'... {len(events) - len(selected)} matching events omitted ...')
        return header + '\n' + '\n'.join(lines)

    # GitHub truncates long annotations. Account for UTF-8 and escaped control
    # characters, discarding routine messages before crash-like evidence.
    while len(escape_annotation(render()).encode('utf-8')) > 3500 and len(selected) > 1:
        routine = sorted(i for i in selected if not events[i][1])
        selected.remove(routine[-1] if routine else max(selected))
    return render()


def github_notice(message: str) -> str:
    return f'::notice title=WebKit process diagnostics::{escape_annotation(message)}'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log', type=Path)
    args = parser.parse_args()
    print(github_notice(summarize_browser_log(args.log.read_text(encoding='utf-8', errors='replace'))))


if __name__ == '__main__':
    main()
