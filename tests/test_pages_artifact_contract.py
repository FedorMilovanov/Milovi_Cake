import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PagesArtifactCliContractTest(unittest.TestCase):
    def test_scripts_reject_ignored_positional_output_paths(self):
        # Both scripts intentionally use the fixed repository _site directory.
        # Reject unexpected paths instead of silently auditing a different location.
        for script in ('build_pages_artifact.py', 'audit_pages_artifact.py'):
            with self.subTest(script=script):
                result = subprocess.run(
                    [sys.executable, str(ROOT / 'scripts' / script), 'unexpected-output-path'],
                    cwd=ROOT, text=True, capture_output=True, check=False,
                )
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn('unrecognized arguments', result.stderr)


if __name__ == '__main__':
    unittest.main()
