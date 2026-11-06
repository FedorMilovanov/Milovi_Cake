import copy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from release_identity import release_sha
from run_contract_tests import run_suite
from runner_lhr_extract import extract, extract_dir


def report():
    # Effective metadata shape from an actual Lighthouse 12.6.1 report.
    return {
        'lighthouseVersion': '12.6.1',
        'fetchTime': '2026-11-05T18:48:18.173Z',
        'requestedUrl': 'https://milovicake.ru/',
        'finalDisplayedUrl': 'https://milovicake.ru/',
        'configSettings': {
            'formFactor': 'mobile', 'throttlingMethod': 'simulate',
            'throttling': {'rttMs': 150, 'throughputKbps': 1638.4, 'cpuSlowdownMultiplier': 4},
        },
        'audits': {'largest-contentful-paint': {'numericValue': 2254.08}},
    }


class MeasurementContractTest(unittest.TestCase):
    def test_effective_lighthouse_settings_take_precedence(self):
        lhr = report()
        lhr['settings'] = {'throttlingMethod': 'devtools', 'throttling': {'cpuSlowdownMultiplier': 1}}
        data = extract(lhr)
        self.assertEqual(data['throttling_method'], 'simulate')
        self.assertEqual(data['cpu_slowdown'], 4)
        self.assertEqual(data['metrics']['lcp'], 2254.1)

    def test_alias_files_are_one_run_but_new_fetch_times_are_independent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lhr = report()
            (root / 'original.json').write_text(json.dumps(lhr), encoding='utf-8')
            (root / 'upload-copy.json').write_text(json.dumps(lhr, indent=2), encoding='utf-8')
            second = copy.deepcopy(lhr)
            second['fetchTime'] = '2026-11-05T18:48:34.208Z'
            (root / 'second-run.json').write_text(json.dumps(second), encoding='utf-8')
            data = extract_dir(root)
            self.assertEqual(len(data['reports']), 2)
            self.assertEqual(len(data['duplicates']), 1)
            self.assertEqual(data['failures'], [])

    def test_cls_keeps_precision_below_the_budget(self):
        lhr = report()
        lhr['audits']['cumulative-layout-shift'] = {'numericValue': 0.06881791354761611}
        self.assertEqual(extract(lhr)['metrics']['cls'], 0.068818)

    def test_conflicting_copies_fail_instead_of_biasing_the_median(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lhr = report()
            (root / 'original.json').write_text(json.dumps(lhr), encoding='utf-8')
            lhr['audits']['largest-contentful-paint']['numericValue'] = 100
            (root / 'conflict.json').write_text(json.dumps(lhr), encoding='utf-8')
            data = extract_dir(root)
            self.assertTrue(any('conflicting LHR' in f['error'] for f in data['failures']))

    def test_missing_identity_or_settings_cannot_be_counted(self):
        for field in ('fetchTime', 'configSettings'):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as tmp:
                lhr = report()
                del lhr[field]
                (Path(tmp) / 'broken.json').write_text(json.dumps(lhr), encoding='utf-8')
                data = extract_dir(Path(tmp))
                self.assertEqual(data['reports'], [])
                self.assertTrue(data['failures'])

    def test_empty_discovery_is_a_failure(self):
        self.assertEqual(run_suite(unittest.TestSuite(), io.StringIO()), 1)

    def test_contract_failure_is_propagated(self):
        suite = unittest.TestSuite([unittest.FunctionTestCase(lambda: self.fail('sentinel'))])
        self.assertEqual(run_suite(suite, io.StringIO()), 1)

    def test_ci_rejects_unbound_releases_and_local_development_still_works(self):
        self.assertEqual(release_sha({}), 'development')
        sha = '22ac79c9e638917be03826c85eb3282f3cf4f49b'
        self.assertEqual(release_sha({'CI': 'true', 'RELEASE_SHA': sha}), sha)
        for env in ({'CI': 'true'}, {'GITHUB_ACTIONS': 'true'}, {'CI': '1', 'RELEASE_SHA': 'development'}):
            with self.subTest(env=env), self.assertRaises(ValueError):
                release_sha(env)

    def test_post_deploy_audit_downloads_payload_and_never_swallows_extraction_failure(self):
        workflow = (ROOT / '.github/workflows/lighthouse-artifact.yml').read_text('utf-8')
        self.assertIn('RELEASE_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}', workflow)
        self.assertIn('--name github-pages', workflow)
        self.assertIn("if: github.event_name != 'workflow_run'", workflow)
        self.assertIn("if body != Path('_site/index.html').read_bytes()", workflow)
        self.assertNotIn('artifact-runs.json || true', workflow)


if __name__ == '__main__':
    unittest.main()
