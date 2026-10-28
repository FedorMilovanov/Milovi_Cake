import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from browser_log_summary import summarize_browser_log, github_notice


class BrowserLogSummaryContractTest(unittest.TestCase):
    def test_preserves_browser_stderr_and_abnormal_exits_without_claiming_cause(self):
        log = '''
  pw:browser <launched> pid=101 +3ms
  pw:browser [pid=101][err] WebContent process crashed; reloading +1s
  pw:browser [pid=101] <process did exit: exitCode=null, signal=SIGABRT> +1ms
  pw:browser [pid=102] <process did exit: exitCode=0, signal=null> +1ms
'''
        summary = summarize_browser_log(log)
        self.assertIn('WebContent process crashed; reloading', summary)
        self.assertIn('signal=SIGABRT', summary)
        self.assertNotIn('pid=102', summary)
        self.assertIn('does not establish the cause', summary)

    def test_reports_no_matching_events_and_escapes_annotations(self):
        summary = summarize_browser_log('not browser output\n')
        self.assertIn('No browser stderr or abnormal exit', summary)
        notice = github_notice('50%\nsecond\rline')
        self.assertTrue(notice.startswith('::notice title=WebKit process diagnostics::'))
        self.assertIn('50%25%0Asecond%0Dline', notice)

    def test_output_is_bounded_and_keeps_first_and_last_events(self):
        events = [f'pw:browser [pid={n}][err] event {n}' for n in range(80)]
        events[40] += ' WebContent process crashed'
        summary = summarize_browser_log('\n'.join(events), limit=4)
        self.assertIn('event 0', summary)
        self.assertIn('event 79', summary)
        self.assertIn('event 40 WebContent process crashed', summary)
        self.assertIn('76 matching events omitted', summary)


if __name__ == '__main__':
    unittest.main()
