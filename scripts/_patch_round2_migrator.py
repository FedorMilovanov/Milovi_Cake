#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).with_name('analytics_contract.py')
source = path.read_text('utf-8')
start_marker = 'def remove_privacy_modal(text: str) -> str:\n'
end_marker = '\ndef migrate_html(path: Path, text: str) -> str:\n'
start = source.index(start_marker)
end = source.index(end_marker, start)
replacement = r'''def remove_privacy_modal(text: str) -> str:
    opening = re.compile(r'<div\b[^>]*\bid=["\']privacyOverlay["\'][^>]*>', re.I)
    token = re.compile(r'<div\b[^>]*>|</div\s*>', re.I)
    while True:
        match = opening.search(text)
        if not match:
            return text
        depth = 0
        block_end = None
        for div in token.finditer(text, match.start()):
            if div.group(0).lower().startswith('<div'):
                depth += 1
            else:
                depth -= 1
                if depth == 0:
                    block_end = div.end()
                    break
        if block_end is None:
            raise RuntimeError('unbalanced legacy privacyOverlay div')
        block_start = match.start()
        comment = re.search(r'<!--[^>]*PRIVACY MODAL[^>]*-->\s*$', text[:match.start()], re.I)
        if comment:
            block_start = comment.start()
        text = text[:block_start] + '\n' + text[block_end:]
'''
path.write_text(source[:start] + replacement + source[end:], 'utf-8')
print('analytics_contract.py now removes privacyOverlay by balanced div boundaries')
