#!/usr/bin/env python3
"""Attach GDB to diagnostic WPE processes and surface bounded signal evidence.

Only used in the isolated failure-only CI job. Debugging changes process timing;
its output is evidence, never a substitute for the unchanged primary result.
"""
from __future__ import annotations

import argparse
import re
import signal
import subprocess
import time
from pathlib import Path

PROC = Path('/proc')
SIGNAL = re.compile(r'^(?:Program|Thread .*) received signal SIG(?:SEGV|ABRT|BUS|ILL)\b', re.M)


def debugger_command(pid: int) -> list[str]:
    command = ['gdb', '--quiet', '--nx', '--batch',
               '-ex', 'set pagination off', '-ex', 'set debuginfod enabled off',
               '-ex', 'handle SIGPIPE nostop noprint pass']
    # WebKit/JSC can use recoverable signals: record the first few stops and
    # let the process continue. A signal alone is not proof of a crash.
    for _ in range(4):
        command += ['-ex', 'continue', '-ex', 'thread apply all bt 12']
    return command + ['-ex', 'continue', '-p', str(pid)]


def candidates(proc: Path = PROC) -> list[int]:
    found = []
    for entry in proc.iterdir():
        if not entry.name.isdecimal():
            continue
        try:
            if (entry / 'comm').read_text().strip() == 'WPEWebProcess':
                found.append(int(entry.name))
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass
    return sorted(found)


def monitor(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    children: dict[int, subprocess.Popen] = {}
    seen: set[int] = set()
    stopping = False

    def stop(_signum, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        while not stopping:
            for pid in candidates():
                if pid in seen:
                    continue
                seen.add(pid)
                with (directory / f'wpe-{pid}.log').open('w') as output:
                    output.write(f'Attaching debugger to WPEWebProcess pid={pid}\n')
                    output.flush()
                    children[pid] = subprocess.Popen(debugger_command(pid), stdout=output, stderr=subprocess.STDOUT)
            for pid, process in list(children.items()):
                if process.poll() is not None:
                    children.pop(pid)
            time.sleep(.1)
    finally:
        for process in children.values():
            process.terminate()
        for process in children.values():
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def summary(directory: Path) -> str:
    files = sorted(directory.glob('wpe-*.log'))
    header = ('Diagnostic debugger changes timing. A captured signal may be recoverable; '
              'correlate with the test crash before inferring cause.')
    if not files:
        return header + '\nNo WPE process was observed.'
    for path in files:
        text = path.read_text(encoding='utf-8', errors='replace')
        match = SIGNAL.search(text)
        if match:
            return header + '\n' + path.name + '\n' + text[match.start():match.start() + 2400]
    errors = [line for path in files for line in path.read_text(encoding='utf-8', errors='replace').splitlines()
              if re.search(r'ptrace|not permitted|no such process|not found', line, re.I)]
    return header + f'\nObserved {len(files)} WPE process(es), no matching signal stop.\n' + '\n'.join(errors[:4])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['monitor', 'summary'])
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    if args.mode == 'monitor':
        monitor(args.directory)
    else:
        message = summary(args.directory).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print(f'::notice title=WebKit native debugger::{message}')


if __name__ == '__main__':
    main()
