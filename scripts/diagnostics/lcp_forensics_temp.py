#!/usr/bin/env python3
"""Temporary read-only forensic analysis of already saved Lighthouse artifacts.

No new site requests, visitors, credentials, runtime modifications, or paid data.
Remove with its PR-only workflow after results are documented.
"""
import json
import math
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse


EXPECTED = {
    '103': 'f325e00de47be2e6723f1c9e8e492b59d1a14843',
    '104': 'f7c2aa08dd19568ea01776f66e5e22cd4454bf62',
    '106': 'e4cc47a5478a2cd1cc29096f51e310633919f3e2',
}
PAGES = {'/': 'home', '/bento-torty/': 'bento', '/gallery/': 'gallery',
         '/svadebnye-torty/': 'wedding', '/zakazat-tort-spb/': 'order',
         '/o-konditere/': 'about', '/prigorody/gatchina/': 'gatchina', '/privacy/': 'privacy'}
HERO = {'home': 'head_mobile-640.avif', 'bento': 'bento_1-mobile-640.avif',
        'wedding': 'wedding-hero-mobile.avif'}


def notice(title, data):
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':'), default=str)
    print(f'::notice title={title}::{text.replace("%", "%25")}', flush=True)


def ms(value):
    return round(value, 1) if isinstance(value, (int, float)) and math.isfinite(value) else None


def network_summary(audits, page):
    items = audits.get('network-requests', {}).get('details', {}).get('items', [])
    def finish(matches):
        found = [x for x in items if matches(x.get('url', ''))]
        return sorted([{'end': ms(x.get('networkEndTime')), 'start': ms(x.get('networkRequestTime')),
                        'bytes': x.get('transferSize'), 'priority': x.get('priority'),
                        'protocol': x.get('protocol'), 'status': x.get('statusCode')}
                       for x in found], key=lambda x: x['end'] or -1)
    doc = finish(lambda u: urlparse(u).path in (('/' if page == 'home' else '/' + page + '/'),)
                 and 'milovicake.ru' in u)
    hero = finish(lambda u: HERO.get(page, '\0') in u)
    css = finish(lambda u: '/css/style.css' in u)
    fonts = finish(lambda u: 'fonts.gstatic.com' in u)
    google = finish(lambda u: 'fonts.googleapis.com' in u)
    js = finish(lambda u: '/js/main.js' in u)
    return {'doc': doc[:2], 'hero': hero[:2], 'css': css[:3],
            'fonts': {'n': len(fonts), 'lastEnd': max((x['end'] or 0 for x in fonts), default=None)},
            'googleCss': google[:1], 'mainJs': js[:1], 'nRequests': len(items)}


def lcp_element(audits):
    rows = audits.get('largest-contentful-paint-element', {}).get('details', {}).get('items', [])
    node_items = rows[0].get('items', []) if rows else []
    node = node_items[0].get('node', {}) if node_items else {}
    phases = {x.get('phase'): ms(x.get('timing')) for x in rows[1].get('items', [])
              if x.get('phase')} if len(rows) > 1 else {}
    return node.get('selector', '')[:145], phases


def read_reports(root, release):
    files = sorted(root.rglob('*.report.json'))
    if len(files) < 24:
        raise RuntimeError(f'{root}: expected 24 report JSON, found {len(files)}')
    results = defaultdict(list)
    for f in files:
        report = json.loads(f.read_text('utf-8'))
        if 'audits' not in report:
            continue
        url = report.get('finalUrl') or report.get('requestedUrl') or ''
        page = PAGES.get(urlparse(url).path)
        if not page or urlparse(url).hostname != 'milovicake.ru':
            continue
        audits = report['audits']
        metrics = audits.get('metrics', {}).get('details', {}).get('items', [{}])[0]
        selector, phases = lcp_element(audits)
        net = network_summary(audits, page)
        breakdown = audits.get('mainthread-work-breakdown', {}).get('details', {}).get('items', [])
        main = {str(x.get('groupLabel') or x.get('group')): ms(x.get('duration'))
                for x in breakdown if x.get('groupLabel') or x.get('group')}
        r = {'file': f.name[-60:], 'simLcp': ms(audits['largest-contentful-paint'].get('numericValue')),
             'simFcp': ms(audits.get('first-contentful-paint', {}).get('numericValue')),
             'rawLcp': ms(metrics.get('observedLargestContentfulPaint')),
             'rawFcp': ms(metrics.get('observedFirstContentfulPaint')),
             'tbt': ms(audits.get('total-blocking-time', {}).get('numericValue')),
             'element': selector, 'phase': phases, 'net': net,
             'main': main, 'cls': ms(audits.get('cumulative-layout-shift', {}).get('numericValue'))}
        results[page].append(r)
    count = sum(len(x) for x in results.values())
    if count != 24 or any(len(results[x]) != 3 for x in PAGES.values()):
        raise RuntimeError(f'{release}: expected 8 URLs x3, got { {k:len(v) for k,v in results.items()} }')
    notice(release + '-archive', {'reports': count, 'pages': sorted(results),
        'chrome': sorted({json.loads(f.read_text('utf-8')).get('userAgent', '')[-60:]
                          for f in files[:2]}), 'files': len(files)})
    for name in PAGES.values():
        rows = sorted(results[name], key=lambda x: x['simLcp'] or 0)
        raw_values = [x['rawLcp'] for x in rows if x['rawLcp'] is not None]
        notice(release + '-' + name, {'simMedian': ms(statistics.median(x['simLcp'] for x in rows)),
            'rawMedian': ms(statistics.median(raw_values)) if raw_values else None,
            'rows': rows})


def clip_union(events, start, end):
    spans = sorted((max(start, e['ts']), min(end, e['ts'] + e.get('dur', 0))) for e in events
                   if e.get('dur', 0) > 0 and e['ts'] < end and e['ts'] + e.get('dur', 0) > start)
    cursor, busy = start, 0
    for a, b in spans:
        busy += max(0, b - max(a, cursor))
        cursor = max(cursor, b)
    return round(busy / 1000, 1)


def trace_gap(path):
    obj = json.loads(path.read_text('utf-8'))
    events = obj['traceEvents']
    navs = [e for e in events if e.get('name') == 'navigationStart'
            and e.get('args', {}).get('data', {}).get('isOutermostMainFrame')]
    if not navs:
        raise RuntimeError(f'{path}: missing main navigationStart')
    nav = min(navs, key=lambda e: e['ts'])
    zero = nav['ts']
    lcp = max(e['ts'] for e in events if e.get('name') == 'largestContentfulPaint::Candidate'
              and e.get('ts', 0) >= zero)
    def at(e): return round((e['ts'] - zero) / 1000, 1)
    draws = sorted((e for e in events if e.get('name') == 'DrawFrame' and zero <= e['ts'] <= lcp),
                   key=lambda e: e['ts'])
    bounds = [zero] + [e['ts'] for e in draws] + [lcp]
    start, stop = max(zip(bounds, bounds[1:]), key=lambda p: p[1] - p[0])
    threads = {(e.get('pid'), e.get('tid')): e.get('args', {}).get('name', '')
               for e in events if e.get('name') == 'thread_name'}
    procs = {e.get('pid'): e.get('args', {}).get('name', '')
             for e in events if e.get('name') == 'process_name'}
    grouped = defaultdict(list)
    for e in events:
        if e.get('name') == 'RunTask' and e.get('dur', 0) > 0 and e.get('ts', 0) < stop \
                and e['ts'] + e['dur'] > start:
            grouped[(e.get('pid'), e.get('tid'))].append(e)
    per_thread = sorted(({'pid': pid, 'tid': tid, 'process': procs.get(pid),
                          'thread': threads.get((pid, tid)), 'tasks': len(tasks),
                          'busyMs': clip_union(tasks, start, stop),
                          'maxTaskMs': ms(max((e.get('dur', 0) for e in tasks), default=0) / 1000)}
                         for (pid, tid), tasks in grouped.items()), key=lambda x: -x['busyMs'])
    # Work in *any* recorded thread overlapping the stalled frame interval.
    long = sorted((e for e in events if e.get('ph') == 'X' and e.get('dur', 0) >= 20000
                   and e.get('ts', 0) < stop and e.get('ts', 0) + e['dur'] > start),
                  key=lambda e: -e['dur'])[:18]
    long = [{'name': e.get('name'), 'at': at(e), 'durMs': ms(e['dur'] / 1000),
             'thread': threads.get((e.get('pid'), e.get('tid')), '')} for e in long]
    frame_terms = ('frame', 'composit', 'raster', 'gpu', 'surface', 'begin', 'draw', 'task')
    window_counts = Counter(e.get('name') for e in events if start <= e.get('ts', 0) < stop
                            and any(t in e.get('name', '').lower() for t in frame_terms))
    special = ('DrawFrame', 'BeginMainThreadFrame', 'Screenshot', 'firstContentfulPaint',
               'firstPaint', 'PaintImage', 'RasterTask', 'ResourceSendRequest', 'DroppedFrame')
    timeline = {}
    for name in special:
        sub = [e for e in events if e.get('name') == name and zero <= e.get('ts', 0) <= lcp]
        if name == 'ResourceSendRequest':
            sub = [e for e in sub if '/sw.js' in str(e.get('args', {}))
                   or '/css/style.css' in str(e.get('args', {}))]
        timeline[name] = [at(e) for e in sub][-18:]
    notice('trace-' + path.name.split('.')[0], {
        'file': path.name, 'navURL': nav.get('args', {}).get('data', {}).get('documentLoaderURL'),
        'rawLcpMs': round((lcp - zero) / 1000, 1),
        'longestNoDraw': [round((start-zero)/1000, 1), round((stop-zero)/1000, 1),
                         round((stop-start)/1000, 1)],
        'threadWorkInGap': per_thread[:16], 'longWorkInGap': long,
        'frameEventCounts': window_counts.most_common(22), 'timeline': timeline,
        'knownThreads': list(Counter(threads.values()).most_common(18))})


def main():
    mode, root = sys.argv[1], Path(sys.argv[2])
    if mode == 'release':
        release = sys.argv[3]
        assert release in EXPECTED
        read_reports(root, release)
    elif mode == 'trace':
        files = {p.name:p for p in root.rglob('*.trace.json')}
        for name in ('bento-01.report-0.trace.json', 'bento-03.report-0.trace.json',
                     'bento-04.report-0.trace.json', 'home-03.report-0.trace.json'):
            if name not in files: raise RuntimeError(f'Missing {name} in {root}')
            trace_gap(files[name])
    else:
        raise ValueError(mode)


if __name__ == '__main__':
    main()
