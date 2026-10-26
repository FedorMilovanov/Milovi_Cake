#!/usr/bin/env python3
"""Temporary PR-only Lighthouse trace summary. Never imported by production."""
import base64
import hashlib
import json
import math
import statistics
import sys
from pathlib import Path


def finite(value):
    return round(value, 2) if isinstance(value, (int, float)) and math.isfinite(value) else None


def audit_value(lhr, name):
    return finite((lhr.get('audits', {}).get(name) or {}).get('numericValue'))


def phases(lhr):
    phase_names = {'TTFB': 'ttfb', 'Load Delay': 'loadDelay',
                   'Load Time': 'loadTime', 'Render Delay': 'renderDelay'}
    result = {v: None for v in phase_names.values()}
    details = (lhr.get('audits', {}).get('largest-contentful-paint-element') or {}).get('details') or {}
    for table in details.get('items', []):
        for row in table.get('items', []):
            if row.get('phase') in phase_names:
                result[phase_names[row['phase']]] = finite(row.get('timing'))
    return result


def trace_data(trace, url):
    events = trace.get('traceEvents', [])
    navs = [e for e in events if e.get('name') == 'navigationStart'
            and e.get('args', {}).get('data', {}).get('documentLoaderURL') == url]
    if not navs:
        return {'traceError': 'no navigationStart for finalUrl', 'traceEvents': len(events)}, None, None, None
    nav = min(navs, key=lambda e: e['ts'])
    t0 = nav['ts']
    nav_id = nav.get('args', {}).get('data', {}).get('navigationId')
    candidates = [e for e in events if e.get('name') == 'largestContentfulPaint::Candidate'
                  and e.get('args', {}).get('data', {}).get('navigationId') == nav_id]
    last = max(candidates, key=lambda e: e['ts']) if candidates else None
    lcp_ts = last['ts'] if last else None
    data = last.get('args', {}).get('data', {}) if last else {}
    threads = {(e['pid'], e['tid']) for e in events if e.get('name') == 'thread_name'
               and 'RendererMain' in e.get('args', {}).get('name', '')}
    tasks = [e for e in events if e.get('name') == 'RunTask'
             and (e.get('pid'), e.get('tid')) in threads
             and t0 <= e.get('ts', 0) <= (lcp_ts or t0)]
    tasks.sort(key=lambda e: e.get('dur', 0), reverse=True)
    detail_names = {'EvaluateScript', 'FunctionCall', 'Layout', 'UpdateLayoutTree',
                    'Paint', 'ParseHTML', 'TimerFire', 'FireAnimationFrame', 'EventDispatch'}
    longest = []
    for task in tasks[:5]:
        children = [e for e in events if (e.get('pid'), e.get('tid')) == (task['pid'], task['tid'])
                    and e.get('name') in detail_names and task['ts'] <= e.get('ts', 0) <= task['ts'] + task.get('dur', 0)
                    and e.get('dur', 0) >= 5_000]
        children.sort(key=lambda e: e.get('dur', 0), reverse=True)
        longest.append({'at': finite((task['ts'] - t0) / 1000), 'ms': finite(task.get('dur', 0) / 1000),
                        'children': [{'name': e['name'], 'ms': finite(e['dur'] / 1000),
                                      'url': (e.get('args', {}).get('data', {}).get('url') or '')[-110:]}
                                     for e in children[:3]]})
    reqs = {}
    for e in events:
        if e.get('name') not in ('ResourceSendRequest', 'ResourceReceiveResponse', 'ResourceFinish'):
            continue
        d = e.get('args', {}).get('data', {})
        rid = d.get('requestId')
        if rid is None:
            continue
        rec = reqs.setdefault(rid, {})
        if e['name'] == 'ResourceSendRequest':
            rec.update(url=d.get('url', ''), start=finite((e['ts'] - t0) / 1000),
                       priority=d.get('priority'), blocking=d.get('renderBlocking'))
        elif e['name'] == 'ResourceReceiveResponse':
            rec.update(response=finite((e['ts'] - t0) / 1000), status=d.get('statusCode'),
                       protocol=d.get('protocol'), fromCache=d.get('fromCache'),
                       fromSW=d.get('fromServiceWorker'))
        else:
            rec.update(end=finite((e['ts'] - t0) / 1000), failed=d.get('didFail'))
    keys = ('url', 'start', 'response', 'end', 'status', 'protocol', 'priority', 'blocking', 'fromCache', 'fromSW', 'failed')
    resources = [{k: r.get(k) for k in keys} for r in reqs.values()
                 if any(s in r.get('url', '') for s in ('/css/style.css', '/img/bento_1-mobile-640.avif',
                                                     '/img/head_mobile-640.avif', 'fonts.googleapis.com', 'fonts.gstatic.com'))]
    overlay_paints = [e for e in events if e.get('name') == 'Paint'
                      and 'mc-consent-overlay is-open' in str(e.get('args', {}).get('data', {}).get('nodeName', ''))
                      and (lcp_ts is None or e.get('ts', 0) <= lcp_ts)]
    screenshots = [e for e in events if e.get('name') == 'Screenshot'
                   and e.get('args', {}).get('snapshot') and e.get('ts', 0) >= t0]
    first = min(screenshots, key=lambda e: abs(e['ts'] - t0 - 1_000_000)) if screenshots else None
    at_lcp = min(screenshots, key=lambda e: abs(e['ts'] - lcp_ts)) if screenshots and lcp_ts else None
    final = max(screenshots, key=lambda e: e['ts']) if screenshots else None
    return ({'traceEvents': len(events), 'rawLcp': finite((lcp_ts - t0) / 1000) if lcp_ts else None,
             'lcpNode': data.get('nodeName'), 'lcpImageEnd': finite(data.get('imageLoadEnd')),
             'overlayPaintBeforeLcp': bool(overlay_paints), 'longestTasks': longest,
             'resources': resources, 'screenshotCount': len(screenshots)}, first, at_lcp, final)


def summary_of(path, expected_sha):
    lhr = json.loads(path.read_text())
    trace_path = path.with_name(path.name.replace('.report.json', '.report-0.trace.json'))
    trace_bytes = trace_path.read_bytes()
    details, early, at_lcp, final = trace_data(json.loads(trace_bytes), lhr.get('finalUrl'))
    name = path.name.removesuffix('.report.json')
    for suffix, event in [('early', early), ('at-lcp', at_lcp), ('final', final)]:
        if event is not None:
            (path.parent / f'{name}.{suffix}.jpg').write_bytes(base64.b64decode(event['args']['snapshot']))
    item = {'name': name, 'sha': expected_sha, 'url': lhr.get('finalUrl'),
            'lighthouse': lhr.get('lighthouseVersion'), 'userAgent': lhr.get('userAgent'),
            'lcp': audit_value(lhr, 'largest-contentful-paint'),
            'fcp': audit_value(lhr, 'first-contentful-paint'),
            'tbt': audit_value(lhr, 'total-blocking-time'),
            'cls': audit_value(lhr, 'cumulative-layout-shift'),
            'phases': phases(lhr), 'traceSha256': hashlib.sha256(trace_bytes).hexdigest(),
            'runtimeError': lhr.get('runtimeError'), 'warnings': lhr.get('runWarnings'),
            'consoleErrors': len(((lhr.get('audits', {}).get('errors-in-console') or {}).get('details') or {}).get('items', [])),
            'trace': details}
    return item


def annotation(title, data):
    message = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    message = message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print(f'::notice file=.github/workflows/cake-sanity.yml,line=1,title={title}::{message}', flush=True)


def main(directory, expected_sha):
    root = Path(directory)
    records = []
    for path in sorted(root.glob('*.report.json')):
        try:
            item = summary_of(path, expected_sha)
            records.append(item)
            # One short annotation per run survives even when GitHub's artifact CDN is unreachable.
            annotation('LCP-' + item['name'], {k: item[k] for k in ('name', 'lcp', 'fcp', 'cls', 'phases', 'consoleErrors', 'runtimeError')}
                       | {'rawLcp': item['trace'].get('rawLcp'),
                          'overlayPaintBeforeLcp': item['trace'].get('overlayPaintBeforeLcp'),
                          'resources': item['trace'].get('resources'),
                          'longestTasks': item['trace'].get('longestTasks')})
        except Exception as exc:
            annotation('LCP-error', {'file': path.name, 'error': str(exc)})
    (root / 'summary.json').write_text(json.dumps(records, ensure_ascii=False, indent=2))
    for page in ('bento', 'home'):
        group = [r for r in records if r['name'].startswith(page) and r['lcp'] is not None]
        if group:
            fast, slow = min(group, key=lambda r: r['lcp']), max(group, key=lambda r: r['lcp'])
            annotation('LCP-' + page + '-comparison', {'count': len(group), 'medianLcp': finite(statistics.median(r['lcp'] for r in group)),
                       'fast': fast['name'], 'fastLcp': fast['lcp'], 'fastPhases': fast['phases'],
                       'slow': slow['name'], 'slowLcp': slow['lcp'], 'slowPhases': slow['phases']})
    if not records:
        print('No completed Lighthouse JSON with matching trace was analyzed.', file=sys.stderr)
        return 1
    print(f'Analyzed {len(records)} raw traces; summary: {root / "summary.json"}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1], sys.argv[2]))
