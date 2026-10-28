import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class BrowserCompatibilityContractTest(unittest.TestCase):
    def test_official_browser_image_matches_locked_playwright(self):
        package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
        lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')
        version = package['devDependencies']['playwright']
        self.assertRegex(version, r'^\d+\.\d+\.\d+$')
        self.assertEqual(package['devDependencies']['@playwright/test'], version)
        self.assertEqual(lock['packages']['node_modules/playwright']['version'], version)
        self.assertEqual(lock['packages']['node_modules/@playwright/test']['version'], version)
        self.assertIn(f'image: mcr.microsoft.com/playwright:v{version}-noble', workflow)
        self.assertIn('options: --shm-size=1g', workflow)
        self.assertIn('Record browser shared memory', workflow)
        self.assertRegex(workflow, r'--reporter=[^\n]*github')

    def test_webkit_storage_and_gallery_are_repeated_without_retries(self):
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')
        for name in (
            'Repeat WebKit storage fault interactions',
            'Repeat WebKit gallery close and delayed-load interactions',
        ):
            with self.subTest(name=name):
                section = workflow.split(f'- name: {name}', 1)[1].split('\n      - name:', 1)[0]
                self.assertIn('--repeat-each=3', section)
                self.assertIn('--retries=0', section)
        gallery = workflow.split('- name: Repeat WebKit gallery close and delayed-load interactions', 1)[1]
        self.assertIn('--project=webkit-desktop --project=webkit-mobile', gallery)

    def test_failure_diagnostics_keep_the_primary_result_and_restore_source(self):
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')

        def step(name):
            return workflow.split(f'- name: {name}', 1)[1].split('\n      - name:', 1)[0]

        primary = step('Exercise desktop and narrow-screen fault contracts')
        primary_log = step('Summarize WebKit primary process events')
        baseline = step('Diagnose WebKit 1.63 active-video baseline')
        baseline_log = step('Summarize WebKit baseline process events')
        firefox = step('Diagnose Firefox failures on exact source')
        firefox_caption = step('Repeat Firefox gallery focus visibility')
        no_capture = step('Compare WebKit without screencast capture')
        capture_artifacts = step('Upload WebKit capture diagnostic artifacts')
        experiment = step('Compare without the additional video load call')
        restore = step('Restore exact source after WebKit comparison')
        reference = workflow.split('  webkit-newer-reference:', 1)[1]
        self.assertNotIn('continue-on-error', primary)
        self.assertIn("matrix.engine == 'webkit' && 'pw:browser'", primary)
        self.assertIn('set -o pipefail', primary)
        self.assertIn('--workers=1 --retries=0', primary)
        self.assertIn('2>&1 | tee', primary)
        self.assertIn('primary-browser.log', primary)
        self.assertNotIn('|| true', primary)
        self.assertIn("steps.primary_contracts.outcome == 'failure'", primary_log)
        self.assertIn('scripts/browser_log_summary.py', primary_log)
        self.assertIn('DEBUG: pw:browser', baseline)
        self.assertIn('set -o pipefail', baseline)
        self.assertIn('baseline-browser.log', baseline)
        self.assertIn('scripts/browser_log_summary.py', baseline_log)
        self.assertIn('steps.primary_contracts.outcome == \'failure\'', firefox)
        self.assertIn('--repeat-each=3', firefox)
        self.assertIn('--retries=0', firefox)
        self.assertIn("!cancelled() && matrix.engine == 'firefox'", firefox_caption)
        self.assertIn("steps.primary_contracts.outcome != 'skipped'", firefox_caption)
        self.assertIn('--project=firefox-desktop', firefox_caption)
        self.assertIn('caption reflows and remains keyboard reachable', firefox_caption)
        self.assertIn('--repeat-each=6', firefox_caption)
        self.assertIn('--retries=0', firefox_caption)
        self.assertNotIn('continue-on-error', firefox_caption)
        self.assertIn("if: failure() && matrix.engine == 'webkit'", no_capture)
        self.assertIn("steps.webkit_baseline.outcome != 'skipped'", no_capture)
        self.assertIn("require(path.join(root, 'playwright.config.js'))", no_capture)
        # This config is generated in RUNNER_TEMP; otherwise Playwright serves
        # that directory instead of the checkout and the comparison hits 404.
        self.assertIn("webServer: { ...base.webServer, cwd: root", no_capture)
        self.assertIn("url: 'http://127.0.0.1:4173/gallery/'", no_capture)
        self.assertIn("video: 'off'", no_capture)
        self.assertIn('screenshots: false', no_capture)
        self.assertIn('--repeat-each=4', no_capture)
        self.assertIn('--retries=0', no_capture)
        self.assertIn("steps.webkit_no_capture.outcome == 'failure'", capture_artifacts)
        self.assertLess(workflow.index('Compare WebKit without screencast capture'),
                        workflow.index('Compare without the additional video load call'))
        self.assertLess(experiment.index('sha256sum js/gallery/main.js'), experiment.index('p.write_text'))
        self.assertIn('sha256sum --check', restore)
        self.assertIn('needs: compatibility', reference)
        self.assertIn("needs.compatibility.result == 'failure'", reference)
        self.assertIn('image: mcr.microsoft.com/playwright:v1.64.1-noble', reference)
        self.assertIn('@playwright/test@1.64.1 playwright@1.64.1', reference)
        self.assertIn('ref: ${{ github.event.pull_request.head.sha }}', reference)
        self.assertIn('git -c safe.directory="$GITHUB_WORKSPACE" diff --exit-code', reference)
        self.assertIn('git -c safe.directory="$GITHUB_WORKSPACE" rev-parse HEAD', reference)
        self.assertIn('test "$source_sha" = \'${{ github.event.pull_request.head.sha }}\'', reference)
        self.assertIn('set -o pipefail', reference)
        self.assertIn('scripts/browser_log_summary.py', reference)
        self.assertIn('--repeat-each=4', reference)
        self.assertIn('--retries=0', reference)
        self.assertNotIn('continue-on-error', reference)

    def test_browser_container_pipelines_explicitly_use_bash(self):
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')
        # A GitHub Actions container defaults to sh, where `set -o pipefail`
        # may exit before the browser starts. Each piped step must opt into bash.
        for name in (
            'Exercise desktop and narrow-screen fault contracts',
            'Diagnose WebKit 1.63 active-video baseline',
            'Compare active video in the official 1.64.1 image',
            'Compare real gallery interactions',
            'Measure filter-transition precondition',
        ):
            with self.subTest(name=name):
                section = workflow.split(f'- name: {name}', 1)[1].split('\n      - name:', 1)[0]
                self.assertIn('\n        shell: bash\n', section)
                self.assertIn('set -o pipefail', section)

    def test_filter_comparison_preserves_primary_and_restores_stylesheet(self):
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')
        comparison = workflow.split('  webkit-filter-reference:', 1)[1]
        self.assertIn('needs: compatibility', comparison)
        self.assertIn("needs.compatibility.result == 'failure'", comparison)
        self.assertIn('variant: [original, no-filter-interpolation]', comparison)
        package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
        version = package['devDependencies']['playwright']
        self.assertIn(f'image: mcr.microsoft.com/playwright:v{version}-noble', comparison)
        self.assertIn('scripts/gallery_filter_experiment.py', comparison)
        self.assertIn('scripts/gallery_filter_probe.cjs', comparison)
        self.assertIn('MILOVI_FILTER_SERVER_PID', comparison)
        self.assertIn('kill -0 "$server_pid"', comparison)
        self.assertIn("steps.filter_tests.outcome != 'skipped'", comparison)
        self.assertIn("steps.filter_probe.outcome == 'failure'", comparison)
        self.assertIn('webkit-filter-probe-${{ matrix.variant }}.log', comparison)
        self.assertIn('--project=webkit-desktop --project=webkit-mobile', comparison)
        self.assertIn('--repeat-each=2', comparison)
        self.assertIn('--retries=0', comparison)
        self.assertIn('if: always()', comparison)
        self.assertIn('sha256sum --check', comparison)
        self.assertIn('git -c safe.directory="$GITHUB_WORKSPACE" diff --exit-code', comparison)
        self.assertNotIn('continue-on-error', comparison)


if __name__ == '__main__':
    unittest.main()
