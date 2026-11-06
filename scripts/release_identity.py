"""Resolve a release identity; development is for local builds only."""
import os
import re


def release_sha(environment=None):
    environment = os.environ if environment is None else environment
    value = environment.get('RELEASE_SHA', '').strip() or 'development'
    if not re.fullmatch(r'(?:[0-9a-f]{40}|development)', value):
        raise ValueError('RELEASE_SHA must be an exact Git SHA or development')
    in_ci = any(environment.get(key, '').lower() in {'true', '1'} for key in ('CI', 'GITHUB_ACTIONS'))
    if value == 'development' and in_ci:
        raise ValueError('CI requires an explicit exact RELEASE_SHA; development is local-only')
    return value
