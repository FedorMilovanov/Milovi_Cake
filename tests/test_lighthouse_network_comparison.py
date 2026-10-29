import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lighthouse_network_comparison import PAGES, comparison, worst_reports


def report(page, total, requests):
    return {'lighthouseVersion': '12', 'finalDisplayedUrl': 'http://127.0.0.1:4300' + page,
            'audits': {'total-byte-weight': {'numericValue': total},
                       'network-requests': {'details': {'items': requests}}}}


class LighthouseNetworkComparisonTest(unittest.TestCase):
    def test_worst_individual_run_and_resource_delta(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'base').mkdir()
            (root / 'candidate').mkdir()
            for i, page in enumerate(PAGES):
                base = report(page, 100, [{'url': 'https://fonts.example/font.woff2?secret=old', 'transferSize': 20}])
                good = report(page, 90, [])
                bad = report(page, 150, [{'url': 'https://fonts.example/font.woff2?secret=new', 'transferSize': 70},
                                         {'url': 'http://127.0.0.1:4300/new.js', 'transferSize': 10}])
                (root / 'base' / f'{i}.json').write_text(json.dumps(base))
                (root / 'candidate' / f'{i}-good.json').write_text(json.dumps(good))
                (root / 'candidate' / f'{i}-bad.json').write_text(json.dumps(bad))
            (root / 'base' / 'invalid.json').write_text('{')
            lines = comparison(worst_reports(root / 'base'), worst_reports(root / 'candidate'))
            self.assertEqual(len(lines), 3)
            self.assertIn('100 -> 150', lines[0])
            self.assertIn('fonts.example/font.woff2 20 -> 70 (+50)', lines[0])
            self.assertIn('127.0.0.1/new.js 0 -> 10 (+10)', lines[0])
            self.assertNotIn('secret', lines[0])

    def test_missing_or_unrelated_report_fails_instead_of_fabricating_evidence(self):
        with self.assertRaisesRegex(ValueError, 'Missing comparable'):
            comparison({}, {})
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'report.json'
            payload = report(PAGES[0], 100, [])
            payload['finalDisplayedUrl'] = 'https://milovicake.ru' + PAGES[0]
            p.write_text(json.dumps(payload))
            self.assertEqual(worst_reports(Path(tmp)), {})


if __name__ == '__main__':
    unittest.main()
