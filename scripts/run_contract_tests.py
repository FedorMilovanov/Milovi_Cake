#!/usr/bin/env python3
"""Run the repository contracts without shell globbing or empty-suite success."""
from pathlib import Path
import sys
import unittest


def run_suite(suite, stream=None):
    count = suite.countTestCases()
    if not count:
        print('Contract discovery failed: zero tests', file=stream or sys.stderr)
        return 1
    result = unittest.TextTestRunner(stream=stream, verbosity=1).run(suite)
    return 0 if result.wasSuccessful() else 1


def main():
    root = Path(__file__).resolve().parents[1]
    # Running a script sets sys.path[0] to scripts/, not the checkout root.
    # Existing contracts import scripts.* and must resolve this repository.
    sys.path.insert(0, str(root))
    suite = unittest.defaultTestLoader.discover(str(root / 'tests'), pattern='test_*contract.py')
    return run_suite(suite)


if __name__ == '__main__':
    raise SystemExit(main())
