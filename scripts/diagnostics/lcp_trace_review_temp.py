#!/usr/bin/env python3
"""Temporary read-only reviewer for already captured Lighthouse Actions artifacts.

Produces compact GitHub check annotations: never commits or publishes raw traces.
Delete together with the temporary PR workflow after the investigation.
"""

import json
import re
import sys
from pathlib import Path


def notice(title, value):
    text = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    print(f"::notice title={title}::{text.replace('%', '%25').replace(chr(10), '%0A')}", flush=True)


def read_json(path):
    try:
        return json.loads(path.read_text('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def paths(root):
    if not root.is_dir():
        raise SystemExit(f"Missing artifact: {root}")
    files = sorted(root.rglob('*.json'))
    notice('Archive-files', [str(p.relative_to(root)) for p in files][:70])
    return files


def ms(ts, zero):
    return round((ts - zero) / 1000, 2)


def inspect_trace(path, data):
    events = data['traceEvents']
    starts = [e for e in events if e.get('name') == 'navigationStart'
              and e.get('args', {}).get('data', {}).get('isOutermostMainFrame')]
    if not starts:
        return {'path': str(path), 'error': 'no navigationStart'}
    nav = min(starts, key=lambda e: e['ts'])
    zero = nav['ts']
    url = nav.get('args', {}).get('data', {}).get('documentLoaderURL', '')
    candidates = [e for e in events if e.get('name') == 'largestContentfulPaint::Candidate'
                  and e.get('ts', 0) >= zero]
    if not candidates:
        return {'path': str(path), 'error': 'no LCP candidate', 'url': url}
    lcp = max(candidates, key=lambda e: e['ts'])
    until = lcp['ts']
    hero = 'bento_1-mobile-640.avif' if '/bento-torty/' in url else 'head_mobile-640.avif'
    paints = [e for e in events if e.get('name') == 'PaintImage' and hero in
              e.get('args', {}).get('data', {}).get('url', '') and zero <= e['ts'] <= until]
    decodes = [e for e in events if e.get('name') in ('ImageDecodeTask', 'Decode Image')
               and zero <= e.get('ts', 0) <= until]
    threads = {(e.get('pid'), e.get('tid')): e.get('args', {}).get('name')
               for e in events if e.get('name') == 'thread_name'}
    main_threads = {pid_tid for pid_tid, name in threads.items() if name == 'CrRendererMain'}
    tasks = [e for e in events if e.get('name') == 'RunTask'
             and (e.get('pid'), e.get('tid')) in main_threads
             and zero <= e.get('ts', 0) <= until]
    long_tasks = sorted((e for e in tasks if e.get('dur', 0) >= 20000),
                        key=lambda e: e.get('dur', 0), reverse=True)
    types = ('Screenshot', 'DrawFrame', 'BeginMainThreadFrame', 'Paint', 'RasterTask',
             'firstContentfulPaint', 'UpdateLayoutTree', 'Layout')
    counts = {name: sum(1 for e in events if e.get('name') == name and zero <=
                        e.get('ts', 0) <= until) for name in types}
    # Check whether a gap is CPU saturation, missing main-thread work, or frame pacing.
    interval_start = zero + 500_000
    clipped = sorted((max(e['ts'], interval_start), min(e['ts'] + e.get('dur', 0), until))
                     for e in tasks if e['ts'] < until and e['ts'] + e.get('dur', 0) > interval_start)
    cursor = interval_start
    gaps = []
    busy = 0
    for start, finish in clipped:
        if start > cursor:
            gaps.append((ms(cursor, zero), ms(start, zero)))
        if finish > cursor:
            busy += finish - max(start, cursor)
            cursor = finish
    if cursor < until:
        gaps.append((ms(cursor, zero), ms(until, zero)))
    screenshot_times = [ms(e['ts'], zero) for e in events if e.get('name') == 'Screenshot'
                        and zero <= e.get('ts', 0) <= until]
    return {
        'file': path.name, 'url': url, 'rawLcpMs': ms(until, zero),
        'lcpCandidates': [{'at': ms(e['ts'], zero), 'image': e.get('args', {}).get('data', {}).get('imageUrl')
                           or e.get('args', {}).get('data', {}).get('url', ''),
                           'imageLoadEnd': e.get('args', {}).get('data', {}).get('imageLoadEnd')}
                          for e in candidates[-8:]],
        'heroPaintAt': [ms(e['ts'], zero) for e in paints][:25],
        'decodeTasks': [[ms(e['ts'], zero), round(e.get('dur', 0) / 1000, 1)] for e in decodes][:25],
        'counts': counts, 'mainBusyAfter500Ms': round(busy / 1000, 1),
        'largestMainGapsAfter500Ms': sorted(gaps, key=lambda g: g[1] - g[0], reverse=True)[:3],
        'longestMainTasks': [[ms(e['ts'], zero), round(e['dur'] / 1000, 1)] for e in long_tasks[:5]],
        'screenshotsBeforeLcp': screenshot_times[-12:],
    }


def explain_gap(path, data):
    """Separate read-only event/CPU timeline for long first-paint gaps."""
    events = data['traceEvents']
    nav = min((e for e in events if e.get('name') == 'navigationStart'
               and e.get('args', {}).get('data', {}).get('isOutermostMainFrame')),
              key=lambda e: e['ts'])
    zero = nav['ts']
    last = max(e['ts'] for e in events if e.get('name') == 'largestContentfulPaint::Candidate'
               and e['ts'] >= zero)
    threads = {(e['pid'], e['tid']): e.get('args', {}).get('name')
               for e in events if e.get('name') == 'thread_name'}
    renderer = {t for t, name in threads.items() if name == 'CrRendererMain'}
    names = ('firstContentfulPaint', 'firstPaint', 'Screenshot', 'DrawFrame',
             'BeginMainThreadFrame', 'Paint', 'PaintImage', 'RasterTask', 'ImageDecodeTask',
             'DroppedFrame', 'ResourceSendRequest')
    timeline = {}
    for name in names:
        subset = [e for e in events if e.get('name') == name and zero <= e.get('ts', 0) <= last]
        if name in ('Paint', 'PaintImage'):
            subset = [e for e in subset if '/img/bento_1-mobile-640.avif' in
                      e.get('args', {}).get('data', {}).get('url', '')]
        if name == 'ResourceSendRequest':
            subset = [e for e in subset if '/sw.js' in str(e.get('args', {})) or
                      '/css/style.css' in str(e.get('args', {}))]
        timeline[name] = [ms(e['ts'], zero) for e in subset]
    raster = [e for e in events if e.get('name') == 'RasterTask'
              and zero <= e.get('ts', 0) <= last]
    tasks = [e for e in events if e.get('name') == 'RunTask'
             and (e.get('pid'), e.get('tid')) in renderer
             and zero <= e.get('ts', 0) <= last]
    bins = ((0, 250), (250, 500), (500, 750), (750, 1000), (1000, 1250), (1250, 1600))
    def buckets(items):
        return [{'range': f'{lo}-{hi}', 'n': sum(lo <= ms(e['ts'], zero) < hi for e in items),
                 'sumMs': round(sum(e.get('dur', 0) / 1000 for e in items
                                    if lo <= ms(e['ts'], zero) < hi), 1)} for lo, hi in bins]
    return {'file': path.name, 'rawLcp': ms(last, zero),
            'firstPaint': timeline['firstPaint'], 'firstContentfulPaint': timeline['firstContentfulPaint'],
            'heroPaintImage': timeline['PaintImage'], 'drawFrame': timeline['DrawFrame'][-25:],
            'beginMainFrame': timeline['BeginMainThreadFrame'][-15:],
            'screenshots': timeline['Screenshot'][-18:],
            'droppedFrames': timeline['DroppedFrame'][-15:],
            'resourceRequestsSWorCSS': timeline['ResourceSendRequest'][:15],
            'decode': timeline['ImageDecodeTask'][-15:],
            'rasterTask': buckets(raster), 'rasterLongest': sorted(
                [[ms(e['ts'], zero), round(e.get('dur', 0) / 1000, 1)] for e in raster],
                key=lambda x: x[1], reverse=True)[:5],
            'rendererRunTask': buckets(tasks)}


def release_row(path, lhr):
    url = lhr.get('finalUrl') or lhr.get('requestedUrl', '')
    if not any(x in url for x in ('/bento-torty/', '/svadebnye-torty/', '/prigorody/gatchina/')) and not re.search(r'milovicake\.ru/?$', url):
        return None
    audits = lhr['audits']
    observed = audits.get('metrics', {}).get('details', {}).get('items', [{}])[0]
    node = audits.get('largest-contentful-paint-element', {}).get('details', {}).get('items', [])
    image = node[0].get('items', [{}])[0].get('node', {}).get('snippet', '') if node else ''
    phases = {i['phase']: round(i['timing']) for i in node[1].get('items', [])} if len(node) > 1 else {}
    network = audits.get('network-requests', {}).get('details', {}).get('items', [])
    hero = [x for x in network if any(v in x.get('url', '') for v in
            ('/img/bento_1-mobile-640.avif', '/img/head_mobile-640.avif', '/img/wedding-hero-mobile.avif', '/img/head_mobile.avif'))]
    css = [x for x in network if '/css/style.css' in x.get('url', '')]
    return {'file': path.name, 'url': url, 'simLcpMs': round(audits['largest-contentful-paint']['numericValue']),
            'simFcpMs': round(audits['first-contentful-paint']['numericValue']),
            'rawLcpMs': round(observed.get('observedLargestContentfulPaint', 0)),
            'rawFcpMs': round(observed.get('observedFirstContentfulPaint', 0)),
            'phases': phases, 'element': image[-205:],
            'heroNetworkEndMs': round(hero[0].get('networkEndTime', 0)) if hero else None,
            'cssNetworkEndMs': round(css[0].get('networkEndTime', 0)) if css else None,
            'requests': len(network)}


def main():
    originals, released = map(Path, sys.argv[1:3])
    traces = []
    for p in paths(originals):
        if not re.search(r'(bento|home).*\d\d', p.name, re.I):
            continue
        obj = read_json(p)
        if isinstance(obj, dict) and isinstance(obj.get('traceEvents'), list):
            if p.name in ('bento-01.report-0.trace.json', 'bento-03.report-0.trace.json',
                          'home-03.report-0.trace.json'):
                notice('Gap-' + p.name[:40], explain_gap(p, obj))
            traces.append(inspect_trace(p, obj))
    if len(traces) < 12:
        notice('Trace-review-missing', {'count': len(traces), 'found': [x['file'] for x in traces]})
        raise SystemExit('Expected 12 original raw traces')
    for row in traces:
        if any(name in row['file'].lower() for name in ('bento-01', 'bento-03', 'bento-04', 'home-03', 'home-04')):
            notice('Trace-' + row['file'][:60], row)
    rows = []
    for p in paths(released):
        obj = read_json(p)
        if isinstance(obj, dict) and isinstance(obj.get('audits'), dict):
            row = release_row(p, obj)
            if row:
                rows.append(row)
    notice('Release-report-count', {'count': len(rows), 'urls': sorted({r['url'] for r in rows})})
    for url in sorted({r['url'] for r in rows}):
        selected = sorted((r for r in rows if r['url'] == url), key=lambda x: x['simLcpMs'])
        notice('Release-' + url.rstrip('/').split('/')[-1].replace('milovicake.ru', 'home'), selected)
    if len(rows) != 12:
        raise SystemExit(f'Expected 3 reports x 4 affected URLs, found {len(rows)}')


if __name__ == '__main__':
    main()
