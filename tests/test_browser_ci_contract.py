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


if __name__ == '__main__':
    unittest.main()
