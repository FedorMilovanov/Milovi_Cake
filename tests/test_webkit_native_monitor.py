import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from webkit_native_monitor import candidates, debugger_command, summary


class WebKitNativeMonitorTest(unittest.TestCase):
    def test_finds_only_wpe_web_processes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, comm in [('100', 'WPEWebProcess'), ('101', 'MiniBrowser'), ('102', 'WPEWebProcess')]:
                (root / name).mkdir()
                (root / name / 'comm').write_text(comm)
            (root / 'not-a-pid').mkdir()
            (root / '103').mkdir()  # A process can disappear while scanning /proc.
            self.assertEqual(candidates(root), [100, 102])

    def test_debugger_captures_stops_without_declaring_the_cause(self):
        command = debugger_command(12)
        self.assertEqual(command[-2:], ['-p', '12'])
        self.assertEqual(command.count('thread apply all bt 12'), 4)
        self.assertEqual(command.count('continue'), 5)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'wpe-12.log').write_text('attach\nThread 1 received signal SIGSEGV, Segmentation fault.\n#0 frame\n' + 'x' * 5000)
            text = summary(root)
            self.assertIn('may be recoverable', text)
            self.assertIn('SIGSEGV', text)
            self.assertIn('#0 frame', text)
            self.assertLess(len(text), 2700)

    def test_reports_missing_process_and_ptrace_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertIn('No WPE process', summary(root))
            (root / 'wpe-13.log').write_text('ptrace: Operation not permitted.\n')
            self.assertIn('ptrace: Operation not permitted', summary(root))
            self.assertIn('no matching signal stop', summary(root))


if __name__ == '__main__':
    unittest.main()
