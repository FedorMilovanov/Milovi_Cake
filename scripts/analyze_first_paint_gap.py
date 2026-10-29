#!/usr/bin/env python3
"""Разложить по полочкам разрыв «последний байт → первый кадр» из трассы Chrome.

Зачем это существует
--------------------
В §29.7 остался единственный открытый вопрос: на раннере между получением
всех байтов (~1580 мс) и первым кадром (2447 мс) проходит 867 мс, которых
локально нет (~200 мс). LHR на этот вопрос не отвечает: в нём есть только
итоговые метрики. Ответ есть в трассе, а трассу нужно снимать на раннере.

Скрипт берёт трейс Chrome (тот, что Lighthouse пишет при --save-assets),
выбирает главный поток рендерера и считает self-time: время, которое поток
действительно провёл в каждом виде работы, без учёта вложенных событий.
Итог — список «кто съел окно» с миллисекундами.

Usage:
    python3 scripts/analyze_first_paint_gap.py <trace.json|каталог> [--out f.json]
    python3 scripts/analyze_first_paint_gap.py --self-test
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Категории работы: имя события трассы → понятная группа.
WORK_GROUPS = {
    'UpdateLayoutTree': 'пересчёт стилей',
    'RecalculateStyles': 'пересчёт стилей',
    'Layout': 'вёрстка (layout)',
    'UpdateLayerTree': 'дерево слоёв',
    'PrePaint': 'подготовка к отрисовке',
    'Paint': 'растеризация',
    'PaintImage': 'растеризация',
    'RasterTask': 'растеризация',
    'ParseHTML': 'парсинг HTML',
    'ParseAuthorStyleSheet': 'парсинг CSS',
    'ParseCSS': 'парсинг CSS',
    'EvaluateScript': 'выполнение скриптов',
    'v8.compile': 'компиляция JS',
    'v8.run': 'выполнение скриптов',
    'FunctionCall': 'выполнение скриптов',
    'TimerFire': 'таймеры',
    'FireAnimationFrame': 'кадры анимации',
    'FireIdleCallback': 'idle-callback',
    'Decode Image': 'декодирование картинок',
    'ImageDecodeTask': 'декодирование картинок',
    'ResourceFetcher::RequestResource': 'сеть',
    'ThreadState::run': 'цикл потока',
    'CommitLoad': 'навигация',
}

# Шум: служебные обёртки, которые дублируют время детей.
WRAPPER_EVENTS = {
    'RunTask', 'ThreadControllerImpl::RunTask', 'ThreadControllerImpl::DoWork',
    'LocalFrameView::RunPostLifecycleTasks', 'LocalFrameView::RunLifecycleUpdate',
    'LocalFrameView::RunPaintLifecyclePhase', 'Document::updateStyle',
    'Document::updateStyleAndLayoutTree', 'Document::updateLayout',
    'UpdateLifecyclePhases', 'UpdateLifecycle',
}

PAINT_MARKERS = ('firstContentfulPaint', 'firstPaint')
RESOURCE_FINISH = ('ResourceFinish', 'ResourceReceiveResponse')


def load_events(path: Path) -> list[dict]:
    """Прочитать трассу: поддерживается и голый traceEvents, и контейнер."""
    payload = json.loads(path.read_text('utf-8'))
    if isinstance(payload, dict) and 'traceEvents' in payload:
        return payload['traceEvents']
    if isinstance(payload, list):
        return payload
    raise ValueError(f'не похоже на трассу Chrome: {path}')


def find_trace_file(target: Path) -> Path:
    """Трасса лежит либо прямо в файле, либо рядом с отчётом."""
    if target.is_file():
        return target
    candidates = sorted(target.rglob('*.trace.json'))
    if not candidates:
        candidates = sorted(target.rglob('*trace*'))
    if not candidates:
        raise FileNotFoundError(f'в {target} нет файла трассы')
    return candidates[0]


def main_thread(events: list[dict]) -> tuple[int, int] | None:
    """Поток рендерера, который делает больше всего задач.

    Трасса содержит десятки потоков; брать первый попавшийся нельзя —
    можно попасть в compositor или в воркер и получить пустую картину.
    """
    names: dict[tuple[int, int], str] = {}
    for event in events:
        if event.get('ph') == 'M' and event.get('name') == 'thread_name':
            key = (event.get('pid'), event.get('tid'))
            names[key] = (event.get('args') or {}).get('name') or ''

    counts: dict[tuple[int, int], int] = {}
    for event in events:
        if event.get('name') in ('RunTask', 'ThreadControllerImpl::RunTask'):
            key = (event.get('pid'), event.get('tid'))
            counts[key] = counts.get(key, 0) + 1
    if not counts:
        return None

    def score(key: tuple[int, int]) -> tuple[int, int]:
        is_renderer_main = names.get(key) == 'CrRendererMain'
        return (1 if is_renderer_main else 0, counts[key])

    return max(counts, key=score)


def find_marker(events: list[dict], names: tuple[str, ...],
                thread: tuple[int, int] | None = None) -> float | None:
    """Время маркера в микросекундах (FCP ложится в трассу как метка)."""
    found = []
    for event in events:
        if event.get('name') not in names:
            continue
        timestamp = event.get('ts')
        if not isinstance(timestamp, (int, float)):
            continue
        found.append(float(timestamp))
    if not found:
        return None
    return min(found)


def request_urls(events: list[dict]) -> dict[str, str]:
    """Карта requestId → URL.

    В `ResourceFinish` URL нет — только requestId, поэтому имя последнего
    ресурса восстанавливается из `ResourceSendRequest`.
    """
    mapping: dict[str, str] = {}
    for event in events:
        if event.get('name') != 'ResourceSendRequest':
            continue
        data = (event.get('args') or {}).get('data') or {}
        request_id = data.get('requestId')
        url = data.get('url')
        if isinstance(request_id, str) and isinstance(url, str):
            mapping[request_id] = url[:120]
    return mapping


def navigation_start(events: list[dict]) -> float:
    """Начало навигации — точка отсчёта для всех времён.

    Берётся самый ранний navigationStart: у Lighthouse в трассе бывает
    несколько навигаций (второй проход), и поздняя сдвинула бы всю картину.
    """
    stamps = [float(event['ts']) for event in events
              if event.get('name') == 'navigationStart'
              and isinstance(event.get('ts'), (int, float))]
    return min(stamps) if stamps else 0.0


def last_resource_finish(events: list[dict], limit: float,
                         urls: dict[str, str] | None = None) -> tuple[float, str]:
    """Последний завершившийся сетевой ресурс до указанного момента."""
    urls = urls or {}
    best_ts, best_url = 0.0, ''
    for event in events:
        if event.get('name') not in RESOURCE_FINISH:
            continue
        timestamp = event.get('ts')
        if not isinstance(timestamp, (int, float)) or timestamp > limit:
            continue
        if timestamp > best_ts:
            best_ts = float(timestamp)
            data = (event.get('args') or {}).get('data') or {}
            best_url = urls.get(str(data.get('requestId') or ''), '')
    return best_ts, best_url


def thread_events(events: list[dict], thread: tuple[int, int]) -> list[dict]:
    """Полные события выбранного потока, только с длительностью."""
    picked = []
    for event in events:
        if (event.get('pid'), event.get('tid')) != thread:
            continue
        if event.get('ph') != 'X':
            continue
        duration = event.get('dur')
        timestamp = event.get('ts')
        if not isinstance(duration, (int, float)) or not isinstance(timestamp, (int, float)):
            continue
        if duration <= 0:
            continue
        picked.append({'name': str(event.get('name') or '?'),
                       'ts': float(timestamp), 'dur': float(duration)})
    picked.sort(key=lambda item: (item['ts'], -item['dur']))
    return picked


def self_times(items: list[dict], start: float, end: float) -> list[tuple[str, float]]:
    """Self-time по именам событий внутри окна, в миллисекундах.

    Считается как длительность минус сумма вложенных: иначе обёртки
    (RunTask, жизненный цикл документа) целиком поглотят картину.
    """
    clipped = []
    for item in items:
        left = max(item['ts'], start)
        right = min(item['ts'] + item['dur'], end)
        if right - left <= 0:
            continue
        clipped.append({'name': item['name'], 'ts': left, 'end': right})

    clipped.sort(key=lambda item: (item['ts'], -(item['end'] - item['ts'])))
    totals: dict[str, float] = {}
    stack: list[dict] = []

    def close(finished: dict) -> None:
        """Записать self-time закрытого события — и вложенные тоже.

        Своё время учитывается у каждого события, а не только у корневого:
        иначе UpdateLayoutTree внутри RunTask исчез бы из отчёта.
        """
        own = (finished['end'] - finished['ts']) - finished['children']
        if own > 0:
            totals[finished['name']] = totals.get(finished['name'], 0.0) + own
        if stack:
            stack[-1]['children'] += finished['end'] - finished['ts']

    for item in clipped:
        while stack and item['ts'] >= stack[-1]['end']:
            close(stack.pop())
        stack.append({'name': item['name'], 'ts': item['ts'],
                      'end': item['end'], 'children': 0.0})

    while stack:
        close(stack.pop())

    return sorted(totals.items(), key=lambda pair: pair[1], reverse=True)


def group(name: str) -> str:
    if name in WORK_GROUPS:
        return WORK_GROUPS[name]
    lowered = name.lower()
    if 'style' in lowered and 'sheet' not in lowered:
        return 'пересчёт стилей'
    if 'layout' in lowered:
        return 'вёрстка (layout)'
    if 'paint' in lowered or 'raster' in lowered:
        return 'подготовка к отрисовке'
    if 'script' in lowered or lowered.startswith('v8'):
        return 'выполнение скриптов'
    if 'parse' in lowered:
        return 'парсинг'
    if 'gc' in lowered or 'heap' in lowered:
        return 'сборка мусора'
    if 'resource' in lowered or 'fetch' in lowered:
        return 'сеть'
    if name in WRAPPER_EVENTS:
        return 'служебное'
    return name


def resource_timeline(events: list[dict], nav_us: float,
                      fcp_us: float) -> dict:
    """Что происходило с сетью в окне и что ещё не доехало к кадру.

    Если главный поток простаивает, а кадр не наступает, ответ почти всегда
    здесь: браузер ждёт ресурс, который запрошен до кадра, а закончился после.
    """
    sends: dict[str, tuple[float, str]] = {}
    finishes: dict[str, float] = {}
    for event in events:
        data = (event.get('args') or {}).get('data') or {}
        request_id = data.get('requestId')
        timestamp = event.get('ts')
        if not isinstance(request_id, str) or not isinstance(timestamp, (int, float)):
            continue
        if event.get('name') == 'ResourceSendRequest':
            sends[request_id] = (float(timestamp), str(data.get('url') or '')[:110])
        elif event.get('name') == 'ResourceFinish':
            finishes[request_id] = float(timestamp)

    in_flight = []
    for request_id, (start, url) in sends.items():
        end = finishes.get(request_id)
        if start >= fcp_us:
            continue
        if end is not None and end <= fcp_us:
            continue
        in_flight.append({
            'url': url,
            'start_ms': round((start - nav_us) / 1000.0, 1),
            'end_ms': round((end - nav_us) / 1000.0, 1) if end else None,
            'still_pending': end is None,
        })
    in_flight.sort(key=lambda row: row['start_ms'])

    return {
        'in_flight_at_paint': in_flight,
        'requests_total': len(sends),
        'finished_before_paint': len(finishes),
    }


def thread_busy(events: list[dict], window: tuple[float, float]) -> list[dict]:
    """Сколько каждый поток реально работал внутри окна.

    Нужно, чтобы отделить «поток занят работой» от «поток ждёт»: если сумма
    по всем потокам меньше окна, остаток — ожидание, а не вычисления.
    """
    names: dict[tuple[int, int], str] = {}
    tasks: dict[tuple[int, int], list[dict]] = {}
    for event in events:
        key = (event.get('pid'), event.get('tid'))
        if event.get('ph') == 'M' and event.get('name') == 'thread_name':
            names[key] = str((event.get('args') or {}).get('name') or '?')
            continue
        if event.get('name') not in ('RunTask', 'ThreadControllerImpl::RunTask'):
            continue
        timestamp = event.get('ts')
        duration = event.get('dur')
        if not isinstance(timestamp, (int, float)) or not isinstance(duration, (int, float)):
            continue
        left = max(float(timestamp), window[0])
        right = min(float(timestamp) + float(duration), window[1])
        if right - left <= 0:
            continue
        tasks.setdefault(key, []).append({'ts': left, 'end': right})

    rows = []
    for key, spans in tasks.items():
        # Объединение интервалов: задачи не должны считаться дважды.
        spans.sort(key=lambda span: span['ts'])
        busy = 0.0
        cursor = spans[0]['ts']
        for span in spans:
            if span['ts'] > cursor:
                busy += span['end'] - span['ts']
                cursor = span['end']
            elif span['end'] > cursor:
                busy += span['end'] - cursor
                cursor = span['end']
        rows.append({'thread': names.get(key, f'{key[0]}:{key[1]}'),
                     'busy_ms': round(busy / 1000.0, 1)})
    rows.sort(key=lambda row: row['busy_ms'], reverse=True)
    return rows[:6]


def thread_names(events: list[dict]) -> dict[tuple[int, int], str]:
    names: dict[tuple[int, int], str] = {}
    for event in events:
        if event.get('ph') == 'M' and event.get('name') == 'thread_name':
            key = (event.get('pid'), event.get('tid'))
            names[key] = str((event.get('args') or {}).get('name') or '?')
    return names


def window_timeline(events: list[dict], window: tuple[float, float],
                    names: dict[tuple[int, int], str] | None = None,
                    min_us: float = 1000.0, limit: int = 60) -> list[dict]:
    """Хронометраж окна по ВСЕМ потокам.

    Если главный поток простаивает, а кадр не наступает, нужно видеть, что
    вообще происходило: события других потоков объясняют ожидание.
    """
    names = names or thread_names(events)
    rows = []
    for event in events:
        if event.get('ph') != 'X':
            continue
        timestamp = event.get('ts')
        duration = event.get('dur')
        if not isinstance(timestamp, (int, float)) or not isinstance(duration, (int, float)):
            continue
        if duration < min_us:
            continue
        left = float(timestamp)
        right = left + float(duration)
        if right < window[0] or left > window[1]:
            continue
        key = (event.get('pid'), event.get('tid'))
        rows.append({
            'at_ms': round((left - window[0]) / 1000.0, 1),
            'thread': names.get(key, f'{key[0]}:{key[1]}'),
            'event': str(event.get('name') or '?')[:60],
            'ms': round((min(right, window[1]) - max(left, window[0])) / 1000.0, 1),
        })
    rows.sort(key=lambda row: (row['at_ms'], -row['ms']))
    return rows[:limit]


def analyze(trace_events: list[dict], fcp_ms: float | None = None,
            expected_last_ms: float | None = None) -> dict:
    """Полный разбор: окно, длинные задачи, self-time по категориям.

    Все времена в результате — относительно начала навигации, чтобы их
    можно было сравнивать с observed-метриками из LHR.
    """
    thread = main_thread(trace_events)
    if thread is None:
        raise ValueError('в трассе нет ни одной задачи главного потока')

    nav_us = navigation_start(trace_events)
    urls = request_urls(trace_events)

    fcp_us = find_marker(trace_events, PAINT_MARKERS)
    if fcp_us is None:
        if fcp_ms is None:
            raise ValueError('в трассе нет метки первого кадра и не задан --fcp-ms')
        fcp_us = nav_us + fcp_ms * 1000.0

    finish_us, finish_url = last_resource_finish(trace_events, fcp_us, urls)
    if expected_last_ms is not None:
        finish_us = nav_us + expected_last_ms * 1000.0

    items = thread_events(trace_events, thread)
    window = (finish_us, fcp_us) if finish_us else (nav_us, fcp_us)

    per_event = self_times(items, *window)
    by_group: dict[str, float] = {}
    for name, value in per_event:
        key = group(name)
        by_group[key] = by_group.get(key, 0.0) + value

    long_tasks = []
    for item in items:
        if item['name'] not in ('RunTask', 'ThreadControllerImpl::RunTask'):
            continue
        if item['dur'] < 50_000:
            continue
        left = max(item['ts'], window[0])
        right = min(item['ts'] + item['dur'], window[1])
        if right - left <= 0:
            continue
        inside = self_times(items, left, right)
        long_tasks.append({
            'start_ms': round((left - nav_us) / 1000.0, 1),
            'duration_ms': round((right - left) / 1000.0, 1),
            'top': [{'event': name, 'ms': round(value / 1000.0, 1)}
                    for name, value in inside[:5]],
        })
    long_tasks.sort(key=lambda task: task['duration_ms'], reverse=True)

    return {
        'window': {
            'start_ms': round((window[0] - nav_us) / 1000.0, 1),
            'end_ms': round((window[1] - nav_us) / 1000.0, 1),
            'gap_ms': round((window[1] - window[0]) / 1000.0, 1),
            'first_paint_ms': round((fcp_us - nav_us) / 1000.0, 1),
            'last_resource': finish_url,
        },
        'main_thread_work_ms': round(sum(value for _, value in per_event) / 1000.0, 1),
        'by_group_ms': {key: round(value / 1000.0, 1)
                        for key, value in sorted(by_group.items(),
                                                 key=lambda pair: pair[1], reverse=True)},
        'by_event_ms': [{'event': name, 'ms': round(value / 1000.0, 1)}
                        for name, value in per_event[:15]],
        'long_tasks': long_tasks[:8],
        'threads': thread_busy(trace_events, window),
        'network': resource_timeline(trace_events, nav_us, fcp_us),
        # Только при заметном окне: для 10-мс разрыва простыня не нужна.
        'timeline': (window_timeline(trace_events, window)
                     if (fcp_us - window[0]) > 50_000 else []),
    }


def self_test() -> int:
    """Синтетическая трасса: окно 1000→1500 мс, из них 200 мс пересчёта стилей."""
    def ev(name, ts, dur, ph='X', tid=1, pid=1):
        return {'name': name, 'ts': ts, 'dur': dur, 'ph': ph, 'tid': tid, 'pid': pid}

    trace = [
        {'name': 'thread_name', 'ph': 'M', 'pid': 1, 'tid': 1,
         'args': {'name': 'CrRendererMain'}},
        {'name': 'thread_name', 'ph': 'M', 'pid': 1, 'tid': 2,
         'args': {'name': 'Compositor'}},
        ev('ResourceFinish', 1_000_000, 0),
        ev('RunTask', 1_000_000, 500_000),
        ev('UpdateLayoutTree', 1_010_000, 200_000),
        ev('Layout', 1_250_000, 50_000),
        {'name': 'firstContentfulPaint', 'ts': 1_500_000, 'ph': 'R', 'tid': 1, 'pid': 1},
    ]
    result = analyze(trace)
    checks = [
        ('окно 500 мс', result['window']['gap_ms'] == 500.0),
        ('стили первыми', result['by_group_ms'].get('пересчёт стилей') == 200.0),
        ('вёрстка учтена', result['by_group_ms'].get('вёрстка (layout)') == 50.0),
        ('обёртка не съела время', result['by_group_ms'].get('служебное', 0) <= 250.0),
        ('есть длинная задача', len(result['long_tasks']) == 1),
    ]
    failed = 0
    for label, ok in checks:
        print(f"  {'ok  ' if ok else 'FAIL'} {label}")
        if not ok:
            failed += 1
    print('self-test PASS' if not failed else 'self-test FAIL')
    return 1 if failed else 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', nargs='?', help='трасса или каталог с ней')
    parser.add_argument('--fcp-ms', type=float, help='FCP из LHR, если метки нет в трассе')
    parser.add_argument('--last-resource-ms', type=float,
                        help='момент последнего байта, если в трассе его не найти')
    parser.add_argument('--out', help='куда записать разбор')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()
    if not args.target:
        parser.error('нужна трасса или --self-test')

    trace_file = find_trace_file(Path(args.target))
    events = load_events(trace_file)
    print(f'трасса: {trace_file} ({len(events)} событий)', file=sys.stderr)

    result = analyze(events, fcp_ms=args.fcp_ms, expected_last_ms=args.last_resource_ms)
    result['trace_file'] = str(trace_file)
    # ensure_ascii: в артефакт не должен попадать литеральный U+FFFD,
    # его запрещает scripts/audit.py (см. §29 ошибку с обрезанным snippet).
    text = json.dumps(result, ensure_ascii=True, indent=1)

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + '\n', 'utf-8')
        print(text)
    else:
        print(text)
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
