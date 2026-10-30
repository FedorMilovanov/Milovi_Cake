#!/usr/bin/env python3
"""Generate a controlled SIGABRT for the isolated WebKit debugger preflight."""
import ctypes
import os
import signal
import sys
import time


def main() -> None:
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(15, b'WPEWebProcess', 0, 0, 0) != 0:  # PR_SET_NAME, Linux only
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    time.sleep(float(sys.argv[1]) if len(sys.argv) > 1 else 5)
    os.kill(os.getpid(), signal.SIGABRT)


if __name__ == '__main__':
    main()
