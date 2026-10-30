"""The six migrated landings must ship complete, licensed local font subsets."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = ('o-konditere', 'bento-torty', 'svadebnye-torty', 'zakazat-tort-spb',
         'dostavka-i-oplata', 'otzyvy')


class LocalFontContract(unittest.TestCase):
    def test_local_faces_are_shared_complete_and_versioned(self):
        definitions = []
        for page in PAGES:
            html = (ROOT / page / 'index.html').read_text(encoding='utf-8')
            self.assertNotIn('fonts.googleapis.com', html, page)
            self.assertNotIn('fonts.gstatic.com', html, page)
            css = html.split('<style id="local-fonts">', 1)[1].split('</style>', 1)[0]
            definitions.append(css)
            urls = re.findall(r'url\((/fonts/fontsource-5\.3\.0/[^)]+\.woff2)\)', css)
            self.assertEqual(len(urls), 13, page)
            self.assertEqual(css.count('font-display:swap'), 13, page)
            for url in urls:
                self.assertEqual((ROOT / url.lstrip('/')).read_bytes()[:4], b'wOF2', url)
            self.assertEqual(html.count('as="font" type="font/woff2" crossorigin'), 4, page)
        self.assertEqual(len(set(definitions)), 1)

    def test_lighthouse_covers_font_files_and_nested_html(self):
        workflow = (ROOT / '.github/workflows/lighthouse-artifact.yml').read_text(encoding='utf-8')
        self.assertIn("- 'fonts/**'", workflow)
        self.assertIn("- '**/*.html'", workflow)

    def test_licenses_are_preserved(self):
        for family in ('jost', 'cormorant-garamond'):
            text = (ROOT / 'fonts' / f'LICENSE-{family}.txt').read_text(encoding='utf-8')
            self.assertIn('SIL OPEN FONT LICENSE', text.upper())


if __name__ == '__main__':
    unittest.main()
