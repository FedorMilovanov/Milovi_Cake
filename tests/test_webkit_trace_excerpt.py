import contextlib
import io
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from webkit_trace_excerpt import excerpt, first_main_thread, main


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

    def test_groups_all_traces_to_fit_github_notice_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for number in range(16):
                (root / f'wpe-{number:02d}.log').write_text('No signal')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                main(directory)
            self.assertEqual(output.getvalue().count('::notice title='), 1)
            for number in range(16):
                self.assertIn(f'wpe-{number:02d}.log', output.getvalue())

    def test_signal_records_prioritize_termination_and_fit_annotation_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for number in range(12):
                suffix = 'Program terminated with signal SIGSEGV.\n' if number == 11 else ''
                (root / f'wpe-{number:02d}.log').write_text(
                    'Thread 11 "compositor" received signal SIGSEGV.\n\n'
                    'Thread 11 (compositor):\n#0 ' + 'x' * 5000 + '\n\n' + suffix)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                main(directory)
            text = output.getvalue()
            self.assertIn('wpe-11.log', text.splitlines()[0])
            self.assertIn('Program terminated', text.splitlines()[0])
            self.assertIn('excerpts omitted', text)
            for line in text.splitlines():
                self.assertLess(len(line.encode()), 4096)

    def test_extracts_main_thread_at_first_stop(self):
        text = ('Thread 11 "compositor" received signal SIGSEGV.\n\n'
                'Thread 11 (compositor):\n#0 fault\n\n'
                'Thread 1 (main):\n#0 event_loop\n#1 frame\n\n'
                'Thread 11 "compositor" received signal SIGSEGV.\n\n'
                'Thread 1 (main):\n#0 later\n')
        self.assertIn('#0 event_loop', first_main_thread(text))
        self.assertNotIn('#0 later', first_main_thread(text))
        self.assertIn('not found', first_main_thread('no thread'))

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
