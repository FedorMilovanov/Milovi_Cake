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


if __name__ == '__main__':
    unittest.main()
