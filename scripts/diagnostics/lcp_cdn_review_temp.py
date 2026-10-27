#!/usr/bin/env python3
"""Temporary read-only summary of verified live CDN lab traces; remove after review."""
import gzip
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(sys.argv[1])
EXPECTED = 'e4cc47a5478a2cd1cc29096f51e310633919f3e2'


def notice(title, data):
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    print(f'::notice title={title}::{text.replace("%", "%25")}', flush=True)


def med(items):
    return round(statistics.median(items), 1)


def one(row):
    t = row['trace']
    net = row['network']
    fonts = [v['end'] for v in net if 'fonts.gstatic.com' in v['url'] and v['end'] is not None]
    phases = row['sw']
    return {
        'LCP': t['rawLcpMs'], 'FCP': next((e['at'] for e in row['observed']['probe']['paint']
                                            if e['name'] == 'first-contentful-paint'), None),
        'heroEnd': t['heroResponseEndMs'], 'cssEnd': t['cssResponseEndMs'],
        'fontsEnd': round(max(fonts), 1) if fonts else None,
        'gap': t['maxNoDrawWindow'], 'swNew': phases[0]['at'] if phases else None,
        'swInstall': next((p['at'] for p in phases if p['status'] == 'installing'), None),
        'swActivated': next((p['at'] for p in phases if p['status'] == 'activated'), None),
        'throttleMs': row['cpuThrottle']['ms'],
    }


def main():
    data = json.loads((ROOT / 'summary.json').read_text())
    rows = data['rows']
    if data['expected'] != EXPECTED or data['errors'] or len(rows) != 24:
        raise SystemExit(f'Invalid release/rows/errors: {data["expected"]}, {len(rows)}, {data["errors"]}')
    labels = [r['label'] for r in rows]
    if len(labels) != len(set(labels)):
        raise SystemExit('Duplicate trial label')
    archives = sorted((ROOT / 'traces').glob('*.json.gz'))
    if len(archives) != len(rows):
        raise SystemExit(f'Traces missing: {len(archives)} instead of {len(rows)}')
    for r in rows:
        archive = ROOT / 'traces' / (r['label'] + '.json.gz')
        if archive.stat().st_size != r['bytesGz']:
            raise SystemExit(f'Gzip size mismatch: {archive}')
        with gzip.open(archive, 'rb') as f:
            head = f.read(100)
            if b'traceEvents' not in head:
                raise SystemExit(f'Not a trace: {archive}')
        if r['trace'].get('error') or r['release'] != EXPECTED:
            raise SystemExit(f'Bad trace/release: {r["label"]}')
    counts = {'bento': 8, 'home': 4}
    for name, n in counts.items():
        all_pairs = []
        for pair in range(1, n + 1):
            a, b = (next(r for r in rows if r['page'] == name and r['pair'] == pair and r['mode'] == mode)
                    for mode in ('allow', 'block'))
            av, bv = one(a), one(b)
            all_pairs.append({'pair': pair, 'allow': av, 'block': bv,
                              'deltaNoSW': round(bv['LCP'] - av['LCP'], 1)})
        notice(f'{name}:paired-raw-LCP-ms', [[p['pair'], p['allow']['LCP'], p['block']['LCP'], p['deltaNoSW']]
                                               for p in all_pairs])
        notice(f'{name}:conditions', {
            'allowMedian': med(p['allow']['LCP'] for p in all_pairs),
            'blockMedian': med(p['block']['LCP'] for p in all_pairs),
            'pairedMedianDeltaBlockMinusAllow': med(p['deltaNoSW'] for p in all_pairs),
            'deltaSigns': {'blockFaster': sum(p['deltaNoSW'] < 0 for p in all_pairs),
                           'blockSlower': sum(p['deltaNoSW'] > 0 for p in all_pairs)},
            'maxLcp': max(max(p['allow']['LCP'], p['block']['LCP']) for p in all_pairs),
            'maxNoDrawMs': max(max(p['allow']['gap']['ms'], p['block']['gap']['ms']) for p in all_pairs),
            'allFontsReal': all(r['fontCssCount'] >= 1 and r['fontFileCount'] >= 1
                                for r in rows if r['page'] == name),
        })
    notice('environment-and-validity', {
        'dateUTC': data['dateUTC'], 'release': EXPECTED, 'browserVersions': sorted(set(r['browser'] for r in rows)),
        'attempts': len(rows), 'heroAndFonts': sum(bool(r['observed']['probe']['lcp'][-1]['url'].endswith(
            'bento_1-mobile-640.avif' if r['page'] == 'bento' else 'head_mobile-640.avif'))
            and r['fontCssCount'] >= 1 and r['fontFileCount'] >= 1 for r in rows),
        'visibleAndFocused': sum(r['observed']['finalVisibility']['state'] == 'visible'
            and r['observed']['finalVisibility']['focus'] and len(r['observed']['probe']['visibility']) == 1
            for r in rows),
        'swAllowRegistered': sum(bool(r['sw']) for r in rows if r['mode'] == 'allow'),
        'swBlocked': sum(not r['sw'] and not r['observed']['sw']['controller']
            for r in rows if r['mode'] == 'block'),
        'throttledRuns': sum(r['cpuThrottle']['count'] > 0 for r in rows),
        'traceGzipBytes': sum(r['bytesGz'] for r in rows),
    })
    outliers = [(r['label'], one(r)) for r in rows
                if r['trace']['rawLcpMs'] >= 750 or r['trace']['maxNoDrawWindow']['ms'] >= 750]
    notice('outliers-raw-or-frame-over-750ms', outliers)
    for name in counts:
        group = [one(r) for r in rows if r['page'] == name]
        notice(f'{name}:waterfall-ranges-ms', {
            key: [min(v[key] for v in group), med(v[key] for v in group), max(v[key] for v in group)]
            for key in ('heroEnd', 'cssEnd', 'fontsEnd', 'swInstall')
            if all(v[key] is not None for v in group)
        })


if __name__ == '__main__':
    main()
