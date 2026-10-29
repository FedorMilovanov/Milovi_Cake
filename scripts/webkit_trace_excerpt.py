#!/usr/bin/env python3
"""Summarize signal threads from an existing native investigation artifact.

Signals can be recoverable and debugger attachment changes timing. A trace is
not proof of a page crash unless its PID and timing are correlated separately.
"""
import re
import sys
from pathlib import Path

SIGNAL = re.compile(r'^(?:Thread (\d+).*|Program) received signal (SIG\w+).*$', re.M)


def excerpt(path: Path) -> str:
    text = path.read_text(encoding='utf-8', errors='replace')
    matches = list(SIGNAL.finditer(text))
    output = [path.name, 'Signals may be recoverable; correlate PID and time with a real page crash.']
    if not matches:
        output.append('No matching debugger signal. ' + ' | '.join(text.splitlines()[-3:]))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end():end]
        number = match.group(1) or '1'
        thread = re.search(r'^Thread ' + re.escape(number) + r' \(.*?(?=\n\n|\Z)', block, re.M | re.S)
        output.append(match.group(0))
        output.append(thread.group(0) if thread else 'Selected thread stack not found in captured output.')
        termination = re.findall(r'^Program (?:terminated|exited).*$', block, re.M)
        output.extend(termination)
    return '\n'.join(output)


def main(directory: str) -> None:
    files = sorted(Path(directory).rglob('wpe-*.log'))
    if not files:
        raise SystemExit('No native debugger logs in artifact')
    for path in files:
        message = excerpt(path)[:12000].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print(f'::notice title=Native trace {path.name}::{message}')


if __name__ == '__main__':
    main(sys.argv[1])
