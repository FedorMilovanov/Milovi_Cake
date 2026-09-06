from pathlib import Path
import json


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
    'total-blocking-time': {
        'level': 'error',
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

print('Lighthouse aggregation contract OK')
