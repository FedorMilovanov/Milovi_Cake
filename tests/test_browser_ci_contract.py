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
        firefox = step('Diagnose Firefox failures on exact source')
        firefox_caption = step('Repeat Firefox gallery focus visibility')
        no_capture = step('Compare WebKit without screencast capture')
        capture_artifacts = step('Upload WebKit capture diagnostic artifacts')
        experiment = step('Compare without the additional video load call')
        restore = step('Restore exact source after WebKit comparison')
        install_newer = step('Install Playwright 1.64 for a separate diagnostic')
        newer = step('Compare WebKit 1.64 with unchanged source')
        self.assertNotIn('continue-on-error', primary)
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
        self.assertIn('steps.webkit_restore.outcome == \'success\'', install_newer)
        self.assertIn('steps.webkit_newer.outcome == \'success\'', newer)


if __name__ == '__main__':
    unittest.main()
