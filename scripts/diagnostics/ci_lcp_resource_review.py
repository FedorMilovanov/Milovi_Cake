#!/usr/bin/env python3
"""PR-only: inspect saved production Lighthouse assets; never runs on the site."""
import base64
import gzip
import hashlib
import json
import math
import sys
from pathlib import Path
from urllib.parse import urlsplit

EXPECTED_SHA = 'f325e00de47be2e6723f1c9e8e492b59d1a14843'


def finite(value):
    return round(value, 2) if isinstance(value, (int, float)) and math.isfinite(value) else None


def phases(report):
    names = {'TTFB': 'ttfb', 'Load Delay': 'loadDelay',
             'Load Time': 'loadTime', 'Render Delay': 'renderDelay'}
    rows = ((report['audits'].get('largest-contentful-paint-element') or {})
            .get('details') or {}).get('items', [])
    return {field: next((finite(item.get('timing')) for table in rows
                         for item in table.get('items', []) if item.get('phase') == phase), None)
            for phase, field in names.items()}


def important_requests(report):
    items = report['audits']['network-requests']['details']['items']
    result = []
    for item in items:
        url = urlsplit(item.get('url', ''))
        # Preserve every resource, including low-priority media, scripts and fonts.
        result.append({'u': url.netloc + url.path,
                       'q': url.query[:48] if url.query else '',
                       'kind': item.get('resourceType'), 'mime': item.get('mimeType'),
                       'status': item.get('statusCode'), 'proto': item.get('protocol'),
                       'priority': item.get('priority'), 'finished': item.get('finished'),
                       'preload': item.get('isLinkPreload'),
                       'bytes': item.get('transferSize'), 'size': item.get('resourceSize'),
                       'start': finite(item.get('rendererStartTime')),
                       'end': finite(item.get('networkEndTime'))})
    return result


def raw_trace(trace, url):
    events = trace['traceEvents']
    navs = [e for e in events if e.get('name') == 'navigationStart'
            and e.get('args', {}).get('data', {}).get('documentLoaderURL') == url]
    candidates = [e for e in events if e.get('name') == 'largestContentfulPaint::Candidate']
    matches = [(nav, [e for e in candidates if e.get('args', {}).get('data', {}).get('navigationId') ==
                nav['args']['data'].get('navigationId')]) for nav in navs]
    matches = [(nav, lcp) for nav, lcp in matches if lcp]
    assert len(matches) == 1, f'Expected exactly one navigation with raw LCP: {len(matches)}'
    nav, lcp = matches[0]
    start = nav['ts']
    focus = ('/css/style.css', 'bento_1-mobile-640.avif', 'head_mobile-640.avif',
             '/videos/', 'fonts.googleapis.com', 'fonts.gstatic.com')
    reqs = {}
    for event in events:
        typ = event.get('name')
        if typ not in ('ResourceSendRequest', 'ResourceReceiveResponse', 'ResourceFinish'):
            continue
        data = event.get('args', {}).get('data', {})
        rid = data.get('requestId')
        if rid is None:
            continue
        row = reqs.setdefault(str(rid), {})
        if typ == 'ResourceSendRequest':
            row.update(url=data.get('url', ''), start=finite((event['ts'] - start) / 1000),
                       priority=data.get('priority'),
                       initiator=(data.get('initiator') or {}).get('type'),
                       blocking=data.get('renderBlocking'))
        elif typ == 'ResourceReceiveResponse':
            row.update(response=finite((event['ts'] - start) / 1000),
                       status=data.get('statusCode'), protocol=data.get('protocol'),
                       fromSW=data.get('fromServiceWorker'))
        else:
            row.update(end=finite((event['ts'] - start) / 1000),
                       failed=data.get('didFail'))
    critical = [r for r in reqs.values() if any(token in r.get('url', '') for token in focus)]
    return {'lcp': finite((max(lcp, key=lambda e: e['ts'])['ts'] - start) / 1000),
            'resources': critical}


def main(root):
    checks = [line.split()[-1] for line in (root / 'release-checks.txt').read_text().splitlines()]
    assert len(checks) == 14 and set(checks) == {EXPECTED_SHA}, 'Deployed SHA check failed'
    known = json.loads((root / 'summary.json').read_text())
    expected = sorted([f'bento-{i:02d}' for i in range(1, 9)] +
                      [f'home-{i:02d}' for i in range(1, 5)])
    assert sorted(x['name'] for x in known) == expected, 'Unexpected artifact names'
    digests = {x['name']: x['traceSha256'] for x in known}
    records = []
    for name in expected:
        report = json.loads((root / f'{name}.report.json').read_text())
        trace_bytes = (root / f'{name}.report-0.trace.json').read_bytes()
        assert hashlib.sha256(trace_bytes).hexdigest() == digests[name], f'Bad trace: {name}'
        assert report['lighthouseVersion'] == '12.6.1'
        assert 'HeadlessChrome/155.' in report['userAgent'], 'Not original Chrome 155'
        url = report['finalUrl']
        assert url == ('https://milovicake.ru/bento-torty/' if name.startswith('bento')
                       else 'https://milovicake.ru/'), f'Wrong page: {name}'
        assert report.get('runtimeError') is None and not report.get('runWarnings'), name
        records.append({'name': name,
                        'lcp': finite(report['audits']['largest-contentful-paint']['numericValue']),
                        'fcp': finite(report['audits']['first-contentful-paint']['numericValue']),
                        'cls': finite(report['audits']['cumulative-layout-shift']['numericValue']),
                        'phases': phases(report),
                        'requests': important_requests(report),
                        'raw': raw_trace(json.loads(trace_bytes), url)})
    payload = gzip.compress(json.dumps(records, ensure_ascii=False, separators=(',', ':')).encode())
    text = base64.b64encode(payload).decode('ascii')
    parts = [text[i:i + 3200] for i in range(0, len(text), 3200)]
    assert 1 <= len(parts) <= 9, f'Annotation limit exceeded: {len(parts)}'
    digest = hashlib.sha256(payload).hexdigest()[:16]
    for n, part in enumerate(parts, 1):
        print('::notice file=.github/workflows/cake-sanity.yml,line=1,'
              f'title=ResourcePart-{digest}-{n:02d}-of-{len(parts):02d}::{part}', flush=True)
    print(f'Checked 14 exact release SHA observations; verified 12 saved reports + raw trace digests. '
          f'Emitted {len(parts)} resource-data annotations with digest {digest}.')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: ci_lcp_resource_review.py TRACE_DIR')
    main(Path(sys.argv[1]))
