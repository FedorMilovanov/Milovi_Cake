import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from webkit_trace_excerpt import excerpt


class WebKitTraceExcerptTest(unittest.TestCase):
    def test_selects_faulting_thread_not_first_thread(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'wpe-10.log'
            path.write_text('Thread 11 "compositor" received signal SIGSEGV, Segmentation fault.\n'
                            '[Switching to Thread]\n\nThread 99 (worker):\n#0 wrong\n\n'
                            'Thread 11 (compositor):\n#0 relevant\n#1 frame\n\n'
                            'Program terminated with signal SIGSEGV, Segmentation fault.\n')
            result = excerpt(path)
            self.assertIn('#0 relevant', result)
            self.assertNotIn('#0 wrong', result)
            self.assertIn('Program terminated', result)
            self.assertIn('may be recoverable', result)

    def test_handles_multiple_signals_and_missing_stacks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'wpe-20.log'
            path.write_text('Program received signal SIGABRT, Aborted.\n\n'
                            'Thread 1 (main):\n#0 first\n\n'
                            'Thread 4 "worker" received signal SIGSEGV, Segmentation fault.\n')
            result = excerpt(path)
            self.assertIn('#0 first', result)
            self.assertIn('SIGSEGV', result)
            self.assertIn('stack not found', result)


if __name__ == '__main__':
    unittest.main()
