#!/usr/bin/env python3
"""Достать из артефакта Lighthouse CI те числа, которые видит раннер.

Зачем это существует
---------------------
Песочница, в которой идёт расследование, не открывает прод и не скачивает
артефакты GitHub Actions: `api.github.com` отвечает, а блоб-хост, куда
`gh run download` редиректит, обрывается на TLS (`SSL_ERROR_SYSCALL`).
Раннер Actions может и то, и другое. Поэтому разбор чисел раннера делается
там же (`.github/workflows/runner-lhr.yml`), а результат коммитится в ветку:
ветка — единственный канал, который виден с обеих сторон.

Скрипт читает каталог с LHR (так их раскладывает lighthouse-ci-action),
достаёт метрики, состояние машины, разбивку main-thread и длинные задачи,
и пересчитывает TBT тем же правилом, что Lighthouse, — чтобы числа можно
было проверить, а не принять на веру.

Usage:
    python3 scripts/runner_lhr_extract.py <dir-with-lhr> --out <file.json>
    python3 scripts/runner_lhr_extract.py --self-test
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Порог, с которого задача считается длинной (как в Lighthouse).
LONG_TASK_MS = 50.0


def tbt_from_long_tasks(tasks: list[dict], window_start: float | None,
                        window_end: float | None) -> float:
    """TBT по правилу TBTUtils.calculateTbtImpactForEvent.

    Задача обрезается до окна [симулированный FCP, симулированный TTI],
    из обрезанной длины вычитается 50 мс; всё, что вне окна, не считается.
    """
    if window_start is None or window_end is None:
        return 0.0
    total = 0.0
    for task in tasks:
        # В LHR поле называется startTime; компактный вид ниже — start.
        start = float(task.get("startTime", task.get("start")) or 0.0)
        duration = float(task.get("duration") or 0.0)
        if duration < LONG_TASK_MS:
            continue
        begin = max(start, window_start)
        end = min(start + duration, window_end)
        total += max(0.0, max(0.0, end - begin) - LONG_TASK_MS)
    return round(total, 1)


def numeric(lhr: dict, audit_id: str) -> float | None:
    audit = (lhr.get("audits") or {}).get(audit_id) or {}
    value = audit.get("numericValue")
    return round(float(value), 1) if isinstance(value, (int, float)) else None


def audit_items(lhr: dict, audit_id: str) -> list[dict]:
    audit = (lhr.get("audits") or {}).get(audit_id) or {}
    details = audit.get("details") or {}
    items = details.get("items")
    return items if isinstance(items, list) else []


def lcp_element(lhr: dict) -> dict:
    """Что именно стало LCP-элементом и из чего сложилась его задержка."""
    items = audit_items(lhr, "largest-contentful-paint-element")
    node = ''
    for item in items:
        for sub in item.get("items") or []:
            candidate = (sub.get("node") or {}).get("snippet")
            if candidate:
                node = candidate
                break
        if node:
            break
    phases = {}
    for item in items:
        for sub in item.get("items") or []:
            if isinstance(sub.get("phase"), str):
                phases[sub["phase"]] = round(float(sub.get("timing") or 0.0), 1)
    return {"snippet": node, "phases": phases}


def main_thread(lhr: dict) -> dict:
    """Куда ушёл главный поток: суммы по группам и итог."""
    groups: dict[str, float] = {}
    total = 0.0
    for item in audit_items(lhr, "mainthread-work-breakdown"):
        group = str(item.get("groupLabel") or item.get("group") or "other")
        value = float(item.get("duration") or 0.0)
        groups[group] = round(groups.get(group, 0.0) + value, 1)
        total += value
    return {"total_ms": round(total, 1), "by_group_ms": groups}


def observed_metrics(lhr: dict) -> dict:
    """Наблюдённые значения из trace — до всякой симуляции.

    В LHR они лежат не отдельными аудитами, а внутри audits.metrics,
    поэтому их нельзя читать через numeric(): numericValue там — это уже
    симулированное значение, и подмена одного другим искажает вывод.
    """
    items = audit_items(lhr, "metrics")
    if not items:
        return {}
    row = items[0]
    mapping = {
        "fcp": "observedFirstContentfulPaint",
        "lcp": "observedLargestContentfulPaint",
        "tbt": "observedTotalBlockingTime",
        "load": "observedLoad",
        "dom_content_loaded": "observedDomContentLoaded",
        "si": "observedSpeedIndex",
        "first_paint": "observedFirstPaint",
        "first_meaningful_paint": "observedFirstMeaningfulPaint",
    }
    result = {}
    for key, field in mapping.items():
        value = row.get(field)
        result[key] = round(float(value), 1) if isinstance(value, (int, float)) else None
    return result


def savings(lhr: dict, audit_id: str, key: str = "wastedMs") -> dict:
    """Сколько аудит обещает сэкономить — с числом затронутых ресурсов."""
    audit = (lhr.get("audits") or {}).get(audit_id) or {}
    items = audit_items(lhr, audit_id)
    total = 0.0
    for item in items:
        value = item.get(key)
        if isinstance(value, (int, float)):
            total += float(value)
    details = audit.get("details") or {}
    extra = details.get("overallSavingsMs", details.get("overallSavingsBytes"))
    return {
        "items": len(items),
        "sum": round(total, 1),
        "overall": round(float(extra), 1) if isinstance(extra, (int, float)) else None,
    }


def extract(lhr: dict) -> dict:
    tasks = [
        {
            "start": round(float(item.get("startTime") or 0.0), 1),
            "duration": round(float(item.get("duration") or 0.0), 1),
            "url": (item.get("url") or "")[:120],
        }
        for item in audit_items(lhr, "long-tasks")
    ]
    tasks.sort(key=lambda item: item["duration"], reverse=True)

    sim_fcp = numeric(lhr, "first-contentful-paint")
    sim_tti = numeric(lhr, "interactive")
    reported_tbt = numeric(lhr, "total-blocking-time")

    environment = lhr.get("environment") or {}
    settings = lhr.get("settings") or {}

    return {
        "url": lhr.get("finalDisplayedUrl") or lhr.get("finalUrl") or lhr.get("requestedUrl"),
        "fetch_time": lhr.get("fetchTime"),
        "lighthouse_version": lhr.get("lighthouseVersion"),
        "chrome": environment.get("hostUserAgent"),
        "benchmark_index": environment.get("benchmarkIndex"),
        "cpu_slowdown": (settings.get("throttling") or {}).get("cpuSlowdownMultiplier"),
        "throttling_method": settings.get("throttlingMethod"),
        "run_warnings": lhr.get("runWarnings") or [],
        "metrics": {
            "fcp": sim_fcp,
            "lcp": numeric(lhr, "largest-contentful-paint"),
            "tbt": reported_tbt,
            "tti": sim_tti,
            "si": numeric(lhr, "speed-index"),
            "cls": numeric(lhr, "cumulative-layout-shift"),
            "max_potential_fid": numeric(lhr, "max-potential-fid"),
        },
        "observed": observed_metrics(lhr),
        "tbt_window": {
            "start": sim_fcp,
            "end": sim_tti,
            "recomputed": tbt_from_long_tasks(tasks, sim_fcp, sim_tti),
            "reported": reported_tbt,
        },
        "long_tasks": tasks[:12],
        "main_thread": main_thread(lhr),
        "lcp_element": lcp_element(lhr),
        "bytes": {
            "total": numeric(lhr, "total-byte-weight"),
            "requests": len(audit_items(lhr, "network-requests")),
        },
        "blocking": {
            "render_blocking": savings(lhr, "render-blocking-resources", "wastedMs"),
            "unused_css": savings(lhr, "unused-css-rules", "wastedBytes"),
            "bootup_js_ms": numeric(lhr, "bootup-time"),
            "non_composited_animations": len(audit_items(lhr, "non-composited-animations")),
            "dom_elements": (audit_items(lhr, "dom-size") or [{}])[0].get("value")
            if audit_items(lhr, "dom-size") else None,
        },
    }


def is_lhr(payload: object) -> bool:
    return isinstance(payload, dict) and "audits" in payload and "lighthouseVersion" in payload


def extract_dir(root: Path) -> dict:
    reports, failures = [], []
    for path in sorted(root.rglob("*.json")):
        try:
            payload = json.loads(path.read_text("utf-8"))
        except (OSError, ValueError) as exc:
            failures.append({"file": str(path), "error": str(exc)})
            continue
        if not is_lhr(payload):
            continue
        try:
            reports.append(extract(payload))
        except (KeyError, TypeError, ValueError) as exc:
            failures.append({"file": str(path), "error": f"{type(exc).__name__}: {exc}"})
    return {"reports": reports, "failures": failures}


def self_test() -> int:
    """Оба красных рана 306ec5b должны пересчитаться в те же миллисекунды."""
    svadebnye = {
        "audits": {
            "first-contentful-paint": {"numericValue": 1114.0},
            "interactive": {"numericValue": 2004.0},
            "total-blocking-time": {"numericValue": 690.0},
            "long-tasks": {"details": {"items": [
                {"startTime": 1622.0, "duration": 403.0},
                {"startTime": 1208.0, "duration": 215.0},
                {"startTime": 1423.0, "duration": 199.0},
                {"startTime": 1021.0, "duration": 187.0},
                {"startTime": 909.0, "duration": 112.0},
                {"startTime": 816.0, "duration": 72.0},
            ]}},
        },
    }
    bento = {
        "audits": {
            "first-contentful-paint": {"numericValue": 1114.0},
            "interactive": {"numericValue": 2143.0},
            "total-blocking-time": {"numericValue": 730.0},
            "long-tasks": {"details": {"items": [
                {"startTime": 1774.0, "duration": 382.0},
                {"startTime": 1485.0, "duration": 289.0},
                {"startTime": 1350.0, "duration": 135.0},
                {"startTime": 1221.0, "duration": 129.0},
                {"startTime": 865.0, "duration": 311.0},
            ]}},
        },
    }

    failures = 0
    for name, lhr, expected, tolerance in (
        ("svadebnye", svadebnye, 690.0, 0.0),
        ("bento", bento, 730.0, 5.0),
    ):
        result = extract(lhr)
        got = result["tbt_window"]["recomputed"]
        delta = abs(got - expected)
        status = "ok" if delta <= tolerance else "FAIL"
        if status == "FAIL":
            failures += 1
        print(f"  {name:10s} recomputed {got:6.1f} | reported {expected:6.1f} | "
              f"delta {delta:4.1f} | {status}")

    print("self-test PASS" if not failures else "self-test FAIL")
    return 1 if failures else 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", help="каталог с LHR из lighthouse-results")
    parser.add_argument("--out", help="куда записать компактный JSON")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()
    if not args.source:
        parser.error("нужен каталог с LHR или --self-test")

    root = Path(args.source)
    if not root.is_dir():
        print(f"нет каталога: {root}", file=sys.stderr)
        return 2

    payload = extract_dir(root)
    payload["source_dir"] = str(root)
    text = json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True)

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + "\n", "utf-8")
        print(f"written {out} ({len(payload['reports'])} отчётов, "
              f"{len(payload['failures'])} ошибок разбора)")
    else:
        print(text)

    return 1 if payload["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
