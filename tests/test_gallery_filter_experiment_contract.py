import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from gallery_filter_experiment import remove_backdrop_blur, remove_explicit_filter_transitions


class GalleryFilterExperimentContractTest(unittest.TestCase):
    def test_only_interpolation_is_removed_not_filter_effects(self):
        source = (ROOT / 'css/gallery/gallery-2026.css').read_text(encoding='utf-8')
        result = remove_explicit_filter_transitions(source)
        declarations = r'(?<![\w-])filter\s*:[^;{}]*'
        self.assertEqual(re.findall(declarations, source), re.findall(declarations, result))
        self.assertEqual(source.count('!important'), result.count('!important'))
        self.assertIn('transition:opacity .45s ease;', result)
        self.assertIn('opacity .85s cubic-bezier(.22,1,.36,1);', result)
        self.assertNotIn('filter 1.1s ease', result)
        self.assertNotIn('filter .45s ease', result)
        self.assertIn('filter: blur(8px) brightness(0.7)', result)
        self.assertIn('filter:saturate(1.05) brightness(1.02) contrast(1.02)', result)

    def test_backdrop_ablation_changes_only_two_radius_values(self):
        source = (ROOT / 'css/gallery/gallery-2026.css').read_text(encoding='utf-8')
        result = remove_backdrop_blur(source)
        self.assertEqual(result, source.replace('filter:blur(76px) brightness(.15) saturate(1.5);',
                                                'filter:blur(0px) brightness(.15) saturate(1.5);')
                                 .replace('filter:blur(56px) brightness(.13) saturate(1.35);',
                                          'filter:blur(0px) brightness(.13) saturate(1.35);'))
        for marker in ('filter:blur(76px) brightness(.15) saturate(1.5);',
                       'filter:blur(56px) brightness(.13) saturate(1.35);'):
            with self.assertRaises(ValueError):
                remove_backdrop_blur(source.replace(marker, ''))
            with self.assertRaises(ValueError):
                remove_backdrop_blur(source + marker)

    def test_missing_or_duplicate_marker_rejects_the_experiment(self):
        source = (ROOT / 'css/gallery/gallery-2026.css').read_text(encoding='utf-8')
        marker = 'transition: filter 0.6s ease;'
        self.assertEqual(source.count(marker), 1)
        with self.assertRaises(ValueError):
            remove_explicit_filter_transitions(source.replace(marker, 'transition: opacity 0.6s ease;'))
        with self.assertRaises(ValueError):
            remove_explicit_filter_transitions(source + '\n  ' + marker + '\n')


if __name__ == '__main__':
    unittest.main()
