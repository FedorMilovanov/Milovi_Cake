from pathlib import Path
import json
import re


def require(condition, message):
    if not condition:
        raise SystemExit('Lighthouse aggregation contract: ' + message)


config = json.loads(Path('.github/lighthouse-config.json').read_text('utf-8'))
ci = config['ci']
require(ci['collect'].get('numberOfRuns') == 3, 'collection must remain three runs')

assertions = ci['assert']['assertions']
expected = {
    'categories:performance': {
        'level': 'warn',
        'threshold_key': 'minScore',
        'threshold': 0.85,
        'aggregation': 'median',
    },
    'categories:accessibility': {
        'level': 'error',
        'threshold_key': 'minScore',
        'threshold': 0.95,
        'aggregation': 'pessimistic',
    },
    'categories:best-practices': {
        'level': 'error',
        'threshold_key': 'minScore',
        'threshold': 0.95,
        'aggregation': 'pessimistic',
    },
    'categories:seo': {
        'level': 'error',
        'threshold_key': 'minScore',
        'threshold': 0.98,
        'aggregation': 'pessimistic',
    },
    'largest-contentful-paint': {
        'level': 'warn',
        'threshold_key': 'maxNumericValue',
        'threshold': 2500,
        'aggregation': 'median',
    },
    'cumulative-layout-shift': {
        'level': 'error',
        'threshold_key': 'maxNumericValue',
        'threshold': 0.1,
        'aggregation': 'pessimistic',
    },
    # Simulated TBT is a Lantern artefact, not a measurement of the page: on
    # byte-identical trees it spans 0-1076 ms depending on the session, the
    # window position and the CPU multiplier (docs/TBT_VERDICT_2026-10-28.md
    # sections 10-21). It therefore warns, but keeps its reference threshold and
    # median aggregation so the reported number stays comparable over time.
    'total-blocking-time': {
        'level': 'warn',
        'threshold_key': 'maxNumericValue',
        'threshold': 300,
        'aggregation': 'median',
    },
}

require(set(assertions) == set(expected), 'assertion set drifted')

for audit, contract in expected.items():
    level, options = assertions[audit]
    require(level == contract['level'], f'{audit} severity drifted')
    require(
        options.get(contract['threshold_key']) == contract['threshold'],
        f'{audit} threshold drifted',
    )
    require(
        options.get('aggregationMethod') == contract['aggregation'],
        f"{audit} aggregation must be {contract['aggregation']}",
    )
    require(
        options.get('aggregationMethod') != 'optimistic',
        f'{audit} must never fall back to optimistic aggregation',
    )

# --- Артефактный аудит: второй, независимый инструмент ---------------------
#
# Живой прогон (конфиг выше) меряет путь «раннер -> CDN» и потому держит LCP/TBT
# на уровне warn. Артефактный прогон (.github/lighthouse-artifact-config.json)
# меряет тот же `_site` по локальному HTTPS/h2 (как production), CDN в
# цепочке нет, поэтому числа сопоставимее при одинаковом протоколе — инструмент,
# которым можно проверять регресс LCP/TBT, но не field p75.
#
# До этой проверки его пороги не были закреплены НИЧЕМ: поднять байтовый бюджет
# или порог LCP/TBT можно было одной правкой JSON, и ни один тест бы не упал.
# Это ровно тот способ «закрыть» предупреждение, который запрещён: значение
# поднимается, причина остаётся. Поэтому бюджеты и пороги закреплены здесь,
# а состав аудита сверяется с самим воркфлоу, чтобы страницу нельзя было
# молча выкинуть из замера.
#
# Пороги НЕ меняются: это те же 2500/300/0.1, что и раньше. Проверка фиксирует
# их, а не ослабляет.
artifact_config = json.loads(Path('.github/lighthouse-artifact-config.json').read_text('utf-8'))
artifact_ci = artifact_config['ci']
require(
    '--allow-insecure-localhost' in artifact_ci['collect'].get('settings', {}).get('chromeFlags', ''),
    'HTTPS/H2 local fixture needs loopback-only cert handling in Chrome',
)
require(
    artifact_ci['collect'].get('numberOfRuns') == 3,
    'artifact collection must remain three runs',
)

# Байтовый бюджет каждой страницы. Это не «порог на всякий случай»: именно вес
# страницы определяет LCP на смоделированном канале, поэтому бюджет и LCP-порог
# держат одну и ту же причину с двух сторон.
ARTIFACT_BYTE_BUDGETS = {
    '^https://127\\.0\\.0\\.1:4300/$': 438272,
    '^https://127\\.0\\.0\\.1:4300/gallery/$': 5942272,
    '^https://127\\.0\\.0\\.1:4300/svadebnye-torty/$': 377856,
    '^https://127\\.0\\.0\\.1:4300/bento-torty/$': 537600,
    '^https://127\\.0\\.0\\.1:4300/zakazat-tort-spb/$': 516096,
    '^https://127\\.0\\.0\\.1:4300/o-konditere/$': 256000,
    '^https://127\\.0\\.0\\.1:4300/prigorody/gatchina/$': 1854464,
    '^https://127\\.0\\.0\\.1:4300/privacy/$': 58368,
}

matrix = artifact_ci['assert']['assertMatrix']
seen_patterns = {}
for entry in matrix:
    pattern = entry.get('matchingUrlPattern')
    require(pattern not in seen_patterns, f'artifact URL pattern duplicated: {pattern}')
    seen_patterns[pattern] = entry.get('assertions') or {}

require(
    set(seen_patterns) == set(ARTIFACT_BYTE_BUDGETS) | {'.*'},
    'artifact audited URL set drifted from the pinned byte budgets',
)

for pattern, budget in ARTIFACT_BYTE_BUDGETS.items():
    byte_rule = seen_patterns[pattern].get('total-byte-weight')
    require(byte_rule is not None, f'artifact byte budget missing for {pattern}')
    require(byte_rule[0] == 'error', f'artifact byte budget for {pattern} must stay fail-closed')
    require(
        byte_rule[1].get('maxNumericValue') == budget,
        f'artifact byte budget for {pattern} drifted from {budget}',
    )
    require(
        byte_rule[1].get('aggregationMethod') == 'pessimistic',
        f'artifact byte budget for {pattern} must keep pessimistic aggregation',
    )

artifact_assertions = seen_patterns['.*']
ARTIFACT_EXPECTED = {
    'categories:accessibility': ('error', 'minScore', 0.95, 'pessimistic'),
    'categories:best-practices': ('error', 'minScore', 0.95, 'pessimistic'),
    'categories:seo': ('error', 'minScore', 0.98, 'pessimistic'),
    'cumulative-layout-shift': ('error', 'maxNumericValue', 0.1, 'pessimistic'),
    # LCP и TBT остаются warn намеренно: числа этого инструмента воспроизводимы,
    # но пока выше порога (docs/LCP_TBT_LIVE_BUDGETS_2026-11-01.md). Повышение
    # severity до error — отдельное решение после того, как они станут ниже;
    # понижение порога ради зелёного здесь запрещено и проверяется ниже.
    'largest-contentful-paint': ('warn', 'maxNumericValue', 2500, 'median'),
    'total-blocking-time': ('warn', 'maxNumericValue', 300, 'median'),
}
require(
    set(artifact_assertions) == set(ARTIFACT_EXPECTED),
    'artifact assertion set drifted',
)
for audit, (level, key, threshold, aggregation) in ARTIFACT_EXPECTED.items():
    rule = artifact_assertions[audit]
    require(rule[0] == level, f'artifact {audit} severity drifted from {level}')
    require(
        rule[1].get(key) == threshold,
        f'artifact {audit} threshold drifted from {threshold}',
    )
    require(
        rule[1].get('aggregationMethod') == aggregation,
        f'artifact {audit} aggregation drifted from {aggregation}',
    )

# Состав аудита сверяется с самим воркфлоу: выкинутая из замера страница
# перестаёт давать предупреждение, но это не улучшение, а пропажа измерения.
artifact_workflow = Path('.github/workflows/lighthouse-artifact.yml').read_text('utf-8')
# Match only the eight LHCI URLs, never the curl/release healthcheck URLs.
url_list_marker = '          urls: |\n'
require(artifact_workflow.count(url_list_marker) == 1, 'expected one artifact URL list')
audit_list = artifact_workflow.split(url_list_marker, 1)[1].split('          configPath:', 1)[0]
audited_urls = re.findall(r'^\s+(https://127\.0\.0\.1:4300\S*)$', audit_list, re.M)
require(
    len(audited_urls) == len(ARTIFACT_BYTE_BUDGETS),
    f'artifact workflow audits {len(audited_urls)} URLs, budgets define {len(ARTIFACT_BYTE_BUDGETS)}',
)
for url in audited_urls:
    # Экранируем только точки: re.escape() добавил бы «\-» и не совпал бы
    # с ключами словаря, записанными как в JSON-конфиге.
    pattern = '^' + url.replace('.', '\\.') + '$'
    require(
        pattern in ARTIFACT_BYTE_BUDGETS,
        f'artifact workflow audits an unpinned URL: {url}',
    )

print('Lighthouse aggregation contract OK')
