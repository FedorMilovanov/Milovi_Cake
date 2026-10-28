import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from gallery_media_experiment import REPLACEMENTS, release_offscreen_grid_media


class GalleryMediaExperimentContractTest(unittest.TestCase):
    def test_temporary_variant_only_releases_grid_media(self):
        source = (ROOT / 'js/gallery/main.js').read_text(encoding='utf-8')
        result = release_offscreen_grid_media(source)
        self.assertEqual(source.count('function releaseGridVideo('), 0)
        self.assertEqual(result.count('function releaseGridVideo('), 1)
        self.assertIn("v.removeAttribute('src');\n    v.load();", result)
        self.assertIn("$$('#galleryGrid video').forEach(releaseGridVideo);", result)
        self.assertIn('if (old && old !== v) { try { old.pause(); } catch(e){} }', result)
        self.assertIn('if(!v.src&&v.dataset.src)v.src=v.dataset.src;', result)
        self.assertIn('if($(\'#lbRoot\')) return;', result)
        # Undo the exact edits and prove every unrelated byte was preserved.
        restored = result
        for old, new in reversed(REPLACEMENTS):
            self.assertEqual(restored.count(new), 1)
            restored = restored.replace(new, old, 1)
        self.assertEqual(restored, source)

    def test_missing_or_duplicate_marker_fails_closed(self):
        source = (ROOT / 'js/gallery/main.js').read_text(encoding='utf-8')
        marker = REPLACEMENTS[0][0]
        with self.assertRaises(ValueError):
            release_offscreen_grid_media(source.replace(marker, 'function renamedObserver(){'))
        with self.assertRaises(ValueError):
            release_offscreen_grid_media(source + '\n' + marker)
        with self.assertRaises(ValueError):
            release_offscreen_grid_media(source + '\nfunction releaseGridVideo(v) {}')

    def test_cli_refuses_to_overwrite_its_input(self):
        source = (ROOT / 'js/gallery/main.js').read_text(encoding='utf-8')
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'gallery.js'
            file.write_text(source, encoding='utf-8')
            result = subprocess.run(
                [sys.executable, str(ROOT / 'scripts/gallery_media_experiment.py'), str(file), str(file)],
                capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('source and output must be different files', result.stderr)
            self.assertEqual(file.read_text(encoding='utf-8'), source)


if __name__ == '__main__':
    unittest.main()
