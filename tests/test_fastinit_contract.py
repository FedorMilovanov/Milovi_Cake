#!/usr/bin/env python3
"""Contract tests for the [P100] deterministic first-paint layout skip.

The mechanism is an inline <style>+<script> pair in <head> of every source page
with a <main> element. These contracts guard:

* presence and uniqueness of the marker block on every eligible page;
* syntactic validity of the injected script (node --check);
* the deterministic-removal safeguards (FCP observer, load fallback, hard
  timer, interaction bail-outs);
* fail-safe CSS: the skip only applies while the mc-fast-init class is set;
* the suburb template stays authoritative (generated pages carry the block).
"""
from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = '[P100] Детерминированный пропуск'

SNIPPET_RE = re.compile(
    r'<style id="mc-fast-init-css">.*?</style>\s*<script>.*?</script>',
    re.S,
)


def source_pages() -> list[Path]:
    pages = [ROOT / 'index.html']
    pages += sorted(p for p in ROOT.glob('*/index.html') if p.parent.name != 'prigorody')
    pages += [ROOT / 'prigorody' / 'index.html', ROOT / 'prigorody' / '_template.html']
    pages += sorted((ROOT / 'prigorody').glob('*/index.html'))
    return [p for p in pages if p.is_file()]


def snippet_of(text: str) -> str | None:
    m = SNIPPET_RE.search(text)
    return m.group(0) if m else None


class FastInitContract(unittest.TestCase):
    def test_pages_with_main_carry_exactly_one_snippet(self):
        missing, duplicated = [], []
        for page in source_pages():
            text = page.read_text(encoding='utf-8')
            if '<main' not in text:
                continue
            count = text.count(MARKER)
            if count == 0:
                missing.append(str(page.relative_to(ROOT)))
            elif count != 1:
                duplicated.append(f'{page.relative_to(ROOT)}:{count}')
        self.assertEqual([], missing, 'pages with <main> must include the [P100] block')
        self.assertEqual([], duplicated, 'the [P100] block must be unique per page')

    def test_snippet_only_appears_on_pages_with_main(self):
        stray = []
        for page in source_pages():
            text = page.read_text(encoding='utf-8')
            if '<main' not in text and MARKER in text:
                stray.append(str(page.relative_to(ROOT)))
        self.assertEqual([], stray)

    def test_snippet_script_is_valid_javascript(self):
        text = (ROOT / 'index.html').read_text(encoding='utf-8')
        snippet = snippet_of(text)
        self.assertIsNotNone(snippet, 'index.html must contain the style+script block')
        js = re.search(r'<script>(.*?)</script>', snippet, re.S).group(1)
        check = subprocess.run(
            ['node', '--check', '--input-type=commonjs', '-'],
            input=js, capture_output=True, text=True,
        )
        self.assertEqual(0, check.returncode, f'inline script must parse: {check.stderr}')

    def test_removal_safeguards_present(self):
        js = re.search(
            r'<script>(.*?)</script>', snippet_of((ROOT / 'index.html').read_text(encoding='utf-8')), re.S
        ).group(1)
        for needle, why in [
            ('first-contentful-paint', 'removal is scheduled two frames after FCP'),
            ('requestAnimationFrame', 'double-rAF removal path'),
            ("'load'", 'load-event fallback path'),
            ('setTimeout(rm,1500)', 'hard timer so the class can never stick'),
            ('pageshow', 'bfcache restore fallback'),
            ('pointerdown', 'interaction bail-out'),
            ('touchstart', 'touch bail-out'),
        ]:
            self.assertIn(needle, js, f'missing safeguard: {why}')

    def test_css_scope_is_class_gated_and_excludes_hero(self):
        snippet = snippet_of((ROOT / 'index.html').read_text(encoding='utf-8'))
        style = re.search(r'<style id="mc-fast-init-css">(.*?)</style>', snippet, re.S).group(1)
        self.assertIn('html.mc-fast-init', style, 'rules must only apply while the class is set')
        self.assertIn('content-visibility:auto', style)
        self.assertIn('contain-intrinsic-size', style, 'placeholder size is required for CV:auto')
        self.assertIn(':not(#home)', style, 'the protected hero must never be scoped')
        self.assertIn(':not(.section-fade-divider)', style)

    def test_generated_suburb_pages_carry_the_block(self):
        template = (ROOT / 'prigorody' / '_template.html').read_text(encoding='utf-8')
        self.assertIn(MARKER, template)
        stale = [
            str(p.relative_to(ROOT))
            for p in (ROOT / 'prigorody').glob('*/index.html')
            if MARKER not in p.read_text(encoding='utf-8')
        ]
        self.assertEqual([], stale, 'run `npm run build:prigorody` after template edits')


if __name__ == '__main__':
    unittest.main()
