import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from egl_renderer_probe import surfaceless_renderer


class EGLRendererProbeTest(unittest.TestCase):
    def test_finds_only_surfaceless_renderer(self):
        text = ('GBM platform:\nOpenGL ES profile renderer: wrong\n'
                'Surfaceless platform:\nEGL vendor string: Mesa Project\n'
                'OpenGL ES profile renderer: softpipe\n'
                'Device platform:\nOpenGL ES profile renderer: other\n')
        self.assertEqual(surfaceless_renderer(text), 'softpipe')

    def test_does_not_accept_renderer_from_other_platform(self):
        self.assertIsNone(surfaceless_renderer('GBM platform:\nOpenGL ES profile renderer: softpipe\n'))
        self.assertIsNone(surfaceless_renderer('Surfaceless platform:\neglInitialize failed\n'
                                               'Device platform:\nOpenGL ES profile renderer: softpipe\n'))

    def test_accepts_core_profile(self):
        self.assertEqual(surfaceless_renderer('Surfaceless platform:\nOpenGL core profile renderer: llvmpipe (LLVM)\n'),
                         'llvmpipe (LLVM)')


if __name__ == '__main__':
    unittest.main()
