import json
import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://milovicake.ru'
PHOTO = re.compile(
    r"\{ id: '(p\d+)', type: 'photo', src: '/img/gallery/[^']+', "
    r"full: '(/img/gallery/[^']+-hd\.webp)', title: '([^']+)',\s*desc: '([^']+)', tags: \[([^]]*)\]"
)


class GalleryMetadataContractTest(unittest.TestCase):
    def test_photo_names_match_gallery_schema_and_image_sitemap(self):
        photos = PHOTO.findall((ROOT / 'js/gallery/data.js').read_text(encoding='utf-8'))
        self.assertEqual(len(photos), 30)
        expected = {f'{ORIGIN}{path}': title for _, path, title, _, _ in photos}
        self.assertEqual(len(expected), 30)

        html = (ROOT / 'gallery/index.html').read_text(encoding='utf-8')
        block = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        self.assertIsNotNone(block)
        graph = json.loads(block.group(1))['@graph']
        gallery_schema = next(item for item in graph if item.get('@type') == 'ImageGallery')
        image_objects = gallery_schema['image']
        self.assertEqual(len(image_objects), 30)
        self.assertEqual({item['contentUrl']: item['name'] for item in image_objects}, expected)

        namespace = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9',
                     'i': 'http://www.google.com/schemas/sitemap-image/1.1'}
        root = ET.parse(ROOT / 'sitemap.xml').getroot()
        gallery = next(entry for entry in root.findall('s:url', namespace)
                       if entry.findtext('s:loc', namespaces=namespace) == f'{ORIGIN}/gallery/')
        images = gallery.findall('i:image', namespace)
        self.assertEqual(len(images), 30)
        self.assertEqual({item.findtext('i:loc', namespaces=namespace):
                          item.findtext('i:title', namespaces=namespace) for item in images}, expected)

    def test_roll_slice_is_in_roll_filter_not_pavlova(self):
        photos = {item[0]: item for item in PHOTO.findall((ROOT / 'js/gallery/data.js').read_text(encoding='utf-8'))}
        _, _, title, description, tags = photos['p17']
        self.assertIn('меренгового рулета', title)
        self.assertIn('рулет', description.lower())
        self.assertIn("'meringue'", tags)
        self.assertNotIn("'pavlova'", tags)


if __name__ == '__main__':
    unittest.main()
