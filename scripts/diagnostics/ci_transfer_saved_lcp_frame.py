#!/usr/bin/env python3
"""PR-only: transfer ONE already-saved CI filmstrip JPEG via bounded notices."""
import base64
import hashlib
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
name = sys.argv[2]
assert re.fullmatch(r'(bento|home)-(old|newer)', name)
image = root / f'visual-{name}-final.jpg'
data = image.read_bytes()
assert data[:2] == b'\xff\xd8' and data[-2:] == b'\xff\xd9', 'Invalid JPEG'
assert 2_000 < len(data) < 100_000, 'Unexpected filmstrip size'
encoded = base64.b64encode(data).decode('ascii')
parts = [encoded[i:i + 3100] for i in range(0, len(encoded), 3100)]
assert 1 <= len(parts) <= 9, 'Per-step annotation budget'
digest = hashlib.sha256(data).hexdigest()[:18]
for n, part in enumerate(parts, 1):
    print('::notice file=.github/workflows/cake-sanity.yml,line=1,'
          f'title=SavedFrame-{name}-{digest}-{n:02d}-of-{len(parts):02d}::{part}', flush=True)
print(f'Existing visual {name}: {len(data)} bytes, SHA-256 {digest}, {len(parts)} notices')
