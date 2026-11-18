import html
import re
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


ROOT = Path(__file__).resolve().parents[1]


class WeddingContentContractTest(unittest.TestCase):
    def test_tasting_request_is_conditional_and_uses_shared_consultation(self):
        page = (ROOT / 'svadebnye-torty' / 'index.html').read_text(encoding='utf-8')
        tasting = re.search(r'<section(?=[^>]*\bid="wedTasting")[^>]*>(.*?)</section>', page, re.S)
        self.assertIsNotNone(tasting, 'No visible tasting section')
        section = tasting.group(1)
        self.assertIn('по запросу', section.lower())
        for term in ('состав', 'стоимость', 'сроки', 'возможность изготовления'):
            self.assertIn(term, section.lower())
        self.assertNotRegex(section, r'\d[\d\s]*₽', 'No unapproved fixed tasting price')
        link = re.search(r'<a\b[^>]*href="([^"]+)"', section)
        self.assertIsNotNone(link)
        self.assertEqual(html.unescape(link.group(1)), '#wedBrief',
                         'Tasting should enter the one shared consultation flow')
        brief = re.search(r'<section(?=[^>]*\bid="wedBrief")[^>]*>(.*?)</section>', page, re.S)
        self.assertIsNotNone(brief, 'Missing shared wedding brief')
        panel = brief.group(1)
        self.assertIn('дегустация', panel.lower())
        self.assertEqual(len(re.findall(r'class="btn-hero-messenger', panel)), 3)
        self.assertIn('https://t.me/+79119038886', panel)
        self.assertIn('https://max.ru/u/f9LHodD0cOIzRY9VJX8MoyR41H64ULjndbose2aPPrzXJDLW8QEiyKTpqxs', panel)
        wa = re.search(r'<a href="(https://wa\.me/[^"]+)"[^>]*class="btn-hero-messenger btn-hero-wa', panel)
        self.assertIsNotNone(wa)
        url = urlsplit(html.unescape(wa.group(1)))
        self.assertEqual((url.scheme, url.netloc, url.path), ('https', 'wa.me', '/79119038886'))
        message = parse_qs(url.query).get('text', [''])[0].lower()
        for term in ('дата свадьбы:', 'площадка:', 'гостей:', 'палитра:', 'референсы:'):
            self.assertIn(term, message)

    def test_approved_bow_and_lambeth_options_are_visible(self):
        for name in ('bento-torty', 'detskie-torty', 'svadebnye-torty', 'tort-na-den-rozhdeniya'):
            with self.subTest(page=name):
                page = (ROOT / name / 'index.html').read_text(encoding='utf-8')
                body = page.split('<body>', 1)[1].lower()
                self.assertIn('ламбет', body)
                self.assertRegex(body, r'бант(?:ом|ами|ики|иками|ы)')

    def test_bow_material_is_agreed_instead_of_promised(self):
        wedding = (ROOT / 'svadebnye-torty' / 'index.html').read_text(encoding='utf-8').lower()
        self.assertIn('цвет, материал и размер декора обсудим', wedding)
        for relative in ('svadebnye-torty/index.html', 'tort-na-den-rozhdeniya/index.html', 'llms.txt'):
            with self.subTest(path=relative):
                text = (ROOT / relative).read_text(encoding='utf-8').lower()
                self.assertNotRegex(text, r'бант[^<.]{0,40}вафельн|вафельн[^<.]{0,40}бант')

    def test_rutube_is_not_attached_to_runtime_pages_or_llms(self):
        self.assertNotIn('rutube.ru', (ROOT / 'llms.txt').read_text(encoding='utf-8').lower())
        excluded = {'node_modules', '_site', '.git', '_mockups', '_review_screens', 'tests', 'audit'}
        for page in ROOT.rglob('*.html'):
            relative = page.relative_to(ROOT)
            if any(part in excluded for part in relative.parts):
                continue
            with self.subTest(page=relative):
                self.assertNotIn('rutube.ru', page.read_text(encoding='utf-8').lower())


if __name__ == '__main__':
    unittest.main()
