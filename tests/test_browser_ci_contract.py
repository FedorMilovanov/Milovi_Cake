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

    def test_motion_ordering_is_independent_and_uses_exact_source(self):
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')
        motion = workflow.split('  motion-ordering:', 1)[1].split('  webkit-native-investigation:', 1)[0]
        version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['devDependencies']['playwright']
        self.assertIn(f'image: mcr.microsoft.com/playwright:v{version}-noble', motion)
        self.assertIn('options: --shm-size=1g', motion)
        self.assertIn('engine: [firefox, webkit]', motion)
        self.assertIn('ref: ${{ github.event.pull_request.head.sha }}', motion)
        self.assertIn('--project=${{ matrix.engine }}-desktop --project=${{ matrix.engine }}-mobile', motion)
        self.assertIn('queued grid observer callbacks respect a newly reduced-motion preference', motion)
        self.assertIn('--repeat-each=3 --workers=1 --retries=0 --reporter=list,github', motion)
        self.assertNotIn('needs: compatibility', motion)
        self.assertNotIn('continue-on-error', motion)

    def test_firefox_empty_filter_diagnostics_preserve_the_assertion(self):
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')
        section = workflow.split('- name: Repeat Firefox empty-filter input', 1)[1].split('\n      - name:', 1)[0]
        source = (ROOT / 'tests/video-posters.spec.js').read_text(encoding='utf-8')
        test = source.split("test('gallery empty state can be reset", 1)[1].split("test('gallery video warmup", 1)[0]
        self.assertIn("steps.primary_contracts.outcome != 'skipped'", section)
        self.assertIn('--project=firefox-mobile', section)
        self.assertIn('--repeat-each=12 --workers=1 --retries=0', section)
        self.assertIn("toBeVisible()", test)
        self.assertIn("toHaveCount(0)", test)
        self.assertIn('Empty-filter input diagnostics:', test)
        self.assertIn("event.isTrusted", test)
        self.assertNotIn('continue-on-error', section)

    def test_native_debugging_is_an_isolated_failure_only_investigation(self):
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')
        native = workflow.split('  webkit-native-investigation:', 1)[1]
        self.assertIn("needs.compatibility.result == 'failure'", native)
        self.assertIn('ref: ${{ github.event.pull_request.head.sha }}', native)
        self.assertIn('--cap-add=SYS_PTRACE', native)
        self.assertIn("MILOVI_NATIVE_DIAGNOSTICS: '1'", native)
        self.assertIn('Verify debugger on a controlled native signal', native)
        self.assertIn('python3 scripts/webkit_native_probe.py', native)
        self.assertNotIn('gcc', native)
        self.assertIn('received signal SIGABRT', native)
        self.assertIn('Debugger attachment changes timing', native)
        self.assertIn('--repeat-each=4 --workers=1 --retries=0', native)
        self.assertIn('scripts/webkit_native_monitor.py summary', native)
        tests_step = native.split('- name: Compare unchanged gallery under native debugger', 1)[1].split('\n      - name:', 1)[0]
        self.assertIn('set +e', tests_step)
        self.assertIn('statuses=("${PIPESTATUS[@]}")', tests_step)
        self.assertIn('exit "$result"', tests_step)
        self.assertLess(tests_step.index('scripts/webkit_native_monitor.py summary'), tests_step.index('exit "$result"'))
        self.assertNotIn('continue-on-error', native)

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
        baseline = step('Diagnose WebKit active-video baseline')
        baseline_log = step('Summarize WebKit baseline process events')
        firefox = step('Diagnose Firefox failures on exact source')
        firefox_photo = step('Diagnose Firefox photo-filter input')
        firefox_caption = step('Repeat Firefox gallery focus visibility')
        no_capture = step('Compare WebKit without screencast capture')
        capture_artifacts = step('Upload WebKit capture diagnostic artifacts')
        experiment = step('Compare without the additional video load call')
        restore = step('Restore exact source after WebKit comparison')
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
        self.assertIn("steps.primary_contracts.outcome == 'failure'", firefox_photo)
        self.assertIn('--project=firefox-mobile', firefox_photo)
        self.assertIn('--repeat-each=20', firefox_photo)
        self.assertIn('--retries=0', firefox_photo)
        self.assertNotIn('continue-on-error', firefox_photo)
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
        comparison = workflow.split('  webkit-llvmpipe-comparison:', 1)[1].split('  motion-ordering:', 1)[0]
        self.assertIn("needs.compatibility.result == 'failure'", comparison)
        self.assertIn('mode: [default, no-workers]', comparison)
        self.assertIn('ref: ${{ github.event.pull_request.head.sha }}', comparison)
        self.assertIn('unset LP_NUM_THREADS', comparison)
        self.assertIn('export LP_NUM_THREADS=0', comparison)
        self.assertIn('active renderer not independently verified', comparison)
        self.assertIn('--project=webkit-desktop --project=webkit-mobile', comparison)
        self.assertIn('--repeat-each=12 --workers=1 --retries=0', comparison)
        self.assertNotIn('continue-on-error', comparison)

    def test_browser_container_pipelines_explicitly_use_bash(self):
        workflow = (ROOT / '.github/workflows/browser-compatibility.yml').read_text(encoding='utf-8')
        # A GitHub Actions container defaults to sh, where `set -o pipefail`
        # may exit before the browser starts. Each piped step must opt into bash.
        for name in (
            'Exercise desktop and narrow-screen fault contracts',
            'Diagnose WebKit active-video baseline',
        ):
            with self.subTest(name=name):
                section = workflow.split(f'- name: {name}', 1)[1].split('\n      - name:', 1)[0]
                self.assertIn('\n        shell: bash\n', section)
                self.assertIn('set -o pipefail', section)


if __name__ == '__main__':
    unittest.main()
