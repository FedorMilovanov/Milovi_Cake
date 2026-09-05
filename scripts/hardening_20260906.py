#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text('utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, 'utf-8')


def replace_required(text: str, old: str, new: str, *, label: str, count: int | None = None) -> str:
    actual = text.count(old)
    if actual == 0:
        raise SystemExit(f'{label}: required source fragment not found')
    if count is not None and actual != count:
        raise SystemExit(f'{label}: expected {count} occurrence(s), found {actual}')
    return text.replace(old, new)


def fix_aria() -> None:
    for path in ('index.html', 'prigorody/_template.html'):
        text = read(path)
        text = replace_required(
            text,
            '<input type="hidden" id="calcWeight" value="2" aria-label="Вес торта в килограммах" />',
            '<input type="hidden" id="calcWeight" value="2" />',
            label=f'{path}: hidden input ARIA',
            count=1,
        )
        text = replace_required(
            text,
            '<div class="calc-result-collapsed-arrow" aria-label="Подробнее">',
            '<div class="calc-result-collapsed-arrow" aria-hidden="true">',
            label=f'{path}: decorative collapse arrow',
            count=1,
        )
        text = replace_required(
            text,
            '<span class="calc-approx-badge" id="calcApproxBadge" aria-label="Приблизительная цена">~</span>',
            '<span class="calc-approx-badge" id="calcApproxBadge" aria-hidden="true">~</span>',
            label=f'{path}: decorative approximation badge',
            count=1,
        )
        write(path, text)


def narrow_ip_copy() -> None:
    text = read('index.html')
    text = replace_required(
        text,
        'детские с персонажами',
        'детские с индивидуальным тематическим декором',
        label='index commercial character wording',
        count=1,
    )
    text = replace_required(
        text,
        'с натуральными ингредиентами, безопасным составом и любимыми персонажами',
        'с натуральными ингредиентами, безопасным составом и индивидуальным тематическим декором',
        label='index FAQ character wording',
        count=1,
    )
    write('index.html', text)

    text = read('prigorody/_template.html')
    for old, new, label in (
        (
            'Делаем яркие детские торты с любимыми персонажами и тематическим декором.',
            'Делаем яркие детские торты с индивидуальным тематическим декором.',
            'suburb FAQ character wording',
        ),
        (
            'детский торт на заказ — яркий, безопасный, с персонажами или тематическим декором.',
            'детский торт на заказ — яркий, безопасный, с индивидуальным тематическим декором.',
            'suburb commercial character wording',
        ),
    ):
        text = replace_required(text, old, new, label=label)
    write('prigorody/_template.html', text)

    path = 'scripts/analytics_contract.py'
    text = read(path)
    stale_copy_fix = """    text = text.replace(\n        'с безопасным составом и любимыми персонажами, с безопасным составом и любимыми персонажами',\n        'с безопасным составом и любимыми персонажами',\n    )\n"""
    text = replace_required(text, stale_copy_fix, '', label='privacy/marketing separation', count=1)
    write(path, text)


def add_a11y_contract() -> None:
    write(
        'scripts/a11y_static.py',
        '''#!/usr/bin/env python3
"""Fail-closed static accessibility/conformance guards promoted from forensic findings."""
from __future__ import annotations

import html.parser
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', 'node_modules', '_site', 'playwright-report', 'test-results', 'audit'}


class GuardParser(html.parser.HTMLParser):
    def __init__(self, rel: str) -> None:
        super().__init__(convert_charrefs=True)
        self.rel = rel
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        data = dict(attrs)
        line = self.getpos()[0]
        if tag == 'input' and data.get('type', '').lower() == 'hidden':
            aria = sorted(name for name, _value in attrs if name and name.lower().startswith('aria-'))
            if aria:
                self.errors.append(f'{self.rel}:{line}: hidden input must not carry ARIA attributes: {aria}')

        classes = set((data.get('class') or '').split())
        if 'calc-result-collapsed-arrow' in classes and 'aria-label' in data:
            self.errors.append(f'{self.rel}:{line}: decorative calculator arrow must not use aria-label')
        if 'calc-approx-badge' in classes and 'aria-label' in data:
            self.errors.append(f'{self.rel}:{line}: decorative approximation badge must not use aria-label')


def main() -> int:
    errors: list[str] = []
    pages: list[Path] = []
    for path in ROOT.rglob('*.html'):
        rel_parts = path.relative_to(ROOT).parts
        if any(part in EXCLUDED for part in rel_parts):
            continue
        pages.append(path)
        parser = GuardParser(path.relative_to(ROOT).as_posix())
        try:
            parser.feed(path.read_text('utf-8', errors='replace'))
        except Exception as exc:
            errors.append(f'{path.relative_to(ROOT)}: parser failure: {exc}')
        errors.extend(parser.errors)

    if errors:
        print('Static accessibility/conformance guard FAILED:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1
    print(f'Static accessibility/conformance guard OK: {len(pages)} HTML documents')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
''',
    )


def add_release_contract() -> None:
    write(
        'scripts/release_contract.py',
        '''#!/usr/bin/env python3
"""Validate exact HTML/ESM asset revision pairs against the Service Worker precache."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', 'node_modules', '_site', 'playwright-report', 'test-results', 'audit', '_mockups', '_review_screens'}


def parse_precache() -> dict[str, str]:
    sw = (ROOT / 'sw.js').read_text('utf-8', errors='replace')
    match = re.search(r'const\\s+PRECACHE\\s*=\\s*\\[([^\\]]+)\\]', sw, re.S)
    if not match:
        raise RuntimeError('sw.js PRECACHE not found')
    result: dict[str, str] = {}
    for raw in re.findall(r"'([^']+)'", match.group(1)):
        parsed = urlparse(raw)
        version = ''
        for part in parsed.query.split('&'):
            if part.startswith('v='):
                version = part[2:]
                break
        if not version:
            continue
        path = parsed.path.lstrip('/')
        if path in result and result[path] != version:
            raise RuntimeError(f'duplicate conflicting SW revision for {path}: {result[path]} vs {version}')
        result[path] = version
    if not result:
        raise RuntimeError('no versioned assets found in sw.js PRECACHE')
    return result


def iter_html():
    for path in ROOT.rglob('*.html'):
        parts = path.relative_to(ROOT).parts
        if any(part in EXCLUDED for part in parts):
            continue
        yield path


def main() -> int:
    errors: list[str] = []
    try:
        sw_versions = parse_precache()
    except Exception as exc:
        print(f'Release contract FAILED: {exc}', file=sys.stderr)
        return 1

    attr_re = re.compile(r'(?:href|src)=["\\']([^"\\']+)["\\']', re.I)
    for page in iter_html():
        rel = page.relative_to(ROOT).as_posix()
        for raw in attr_re.findall(page.read_text('utf-8', errors='replace')):
            parsed = urlparse(raw)
            if parsed.scheme or parsed.netloc:
                continue
            clean = parsed.path
            if clean.startswith('/'):
                asset = clean.lstrip('/')
            else:
                resolved = (page.parent / clean).resolve()
                try:
                    asset = resolved.relative_to(ROOT).as_posix()
                except ValueError:
                    continue
            if asset not in sw_versions:
                continue
            actual = ''
            for part in parsed.query.split('&'):
                if part.startswith('v='):
                    actual = part[2:]
                    break
            expected = sw_versions[asset]
            if actual != expected:
                errors.append(f'{rel}: {asset} revision {actual or "<missing>"} != sw.js {expected}')

    import_re = re.compile(r'\\bimport\\s+(?:[^;\\'\\"]*?\\s+from\\s+)?[\\'\\"]([^\\'\\"]+\\.js(?:\\?[^\\'\\"]*)?)[\\'\\"]')
    for js in ROOT.rglob('*.js'):
        parts = js.relative_to(ROOT).parts
        if any(part in EXCLUDED for part in parts) or js.name == 'sw.js':
            continue
        text = js.read_text('utf-8', errors='replace')
        for raw in import_re.findall(text):
            parsed = urlparse(raw)
            if not parsed.path.startswith('.'):
                continue
            target = (js.parent / parsed.path).resolve()
            try:
                asset = target.relative_to(ROOT).as_posix()
            except ValueError:
                continue
            if asset not in sw_versions:
                continue
            actual = ''
            for part in parsed.query.split('&'):
                if part.startswith('v='):
                    actual = part[2:]
                    break
            expected = sw_versions[asset]
            if actual != expected:
                errors.append(f'{js.relative_to(ROOT)}: import {asset} revision {actual or "<missing>"} != sw.js {expected}')

    if errors:
        print('Release asset contract FAILED:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1
    unique = len(set(sw_versions.values()))
    print(f'Release asset contract OK: {len(sw_versions)} exact asset revisions across {unique} revision label(s)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
''',
    )


def add_production_release_smoke() -> None:
    write(
        'scripts/production_release_smoke.py',
        '''#!/usr/bin/env python3
"""Verify exact deployed SHA plus permanent privacy and 404 contracts."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

HOST = 'https://milovicake.ru'
TIMEOUT = 20


def expected_sha() -> str:
    value = os.environ.get('EXPECTED_RELEASE_SHA', '').strip() or os.environ.get('GITHUB_SHA', '').strip()
    if value:
        return value
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    except Exception as exc:
        raise RuntimeError(f'cannot resolve expected release SHA: {exc}')


def request(path: str) -> tuple[int, str]:
    req = urllib.request.Request(HOST + path, headers={'User-Agent': 'MiloviCakeReleaseSmoke/1.0', 'Cache-Control': 'no-cache'})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            body = response.read(600_000).decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
            return response.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read(600_000).decode(exc.headers.get_content_charset() or 'utf-8', errors='replace')
        return exc.code, body


def run_once(expected: str) -> list[str]:
    errors: list[str] = []
    status, body = request('/release.json')
    if status != 200:
        errors.append(f'/release.json returned {status}')
    else:
        try:
            payload = json.loads(body)
        except Exception as exc:
            errors.append(f'/release.json invalid JSON: {exc}')
        else:
            if payload.get('repository') != 'FedorMilovanov/Milovi_Cake':
                errors.append(f'/release.json repository mismatch: {payload!r}')
            if payload.get('sha') != expected:
                errors.append(f'/release.json sha {payload.get("sha")} != expected {expected}')

    status, _body = request('/privacy/')
    if status != 200:
        errors.append(f'/privacy/ returned {status}')

    status, missing = request('/__milovi_release_smoke_missing__/')
    if status != 404:
        errors.append(f'unknown route must return 404, got {status}')
    low = missing.lower()
    if '<link rel="canonical"' in low or "<link rel='canonical'" in low:
        errors.append('404 response must not emit canonical')
    if 'noindex' not in low:
        errors.append('404 response must contain noindex')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--retries', type=int, default=1)
    parser.add_argument('--delay', type=int, default=30)
    args = parser.parse_args()
    expected = expected_sha()
    errors: list[str] = []
    for attempt in range(1, max(1, args.retries) + 1):
        try:
            errors = run_once(expected)
        except Exception as exc:
            errors = [repr(exc)]
        if not errors:
            print(f'Production release smoke OK: exact live SHA {expected}, privacy 200, true 404')
            return 0
        print(f'Production release smoke attempt {attempt} failed:', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        if attempt < max(1, args.retries):
            time.sleep(args.delay)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
''',
    )


def add_layout_matrix() -> None:
    write(
        'tests/layout-matrix.spec.js',
        '''const { test, expect } = require('@playwright/test');

const WIDTHS = [360, 390, 414, 561, 600, 768, 900, 1024];
const THEMES = ['light', 'dark'];

function overlaps(a, b, tolerance = 2) {
  return !(
    a.x + a.width <= b.x + tolerance ||
    b.x + b.width <= a.x + tolerance ||
    a.y + a.height <= b.y + tolerance ||
    b.y + b.height <= a.y + tolerance
  );
}

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test(`@layout-matrix home ${width}px ${theme}: no camel-rule regressions`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('mc_theme', selectedTheme);
      }, theme);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-card');

      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      const cards = page.locator('.product-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        if (!(await card.isVisible())) continue;
        const button = card.locator('.btn-add');
        const price = card.locator('.price');
        if (await button.isVisible()) {
          const fit = await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
          expect(fit).toBeTruthy();
        }
        if (await button.isVisible() && await price.isVisible()) {
          const buttonBox = await button.boundingBox();
          const priceBox = await price.boundingBox();
          expect(buttonBox).not.toBeNull();
          expect(priceBox).not.toBeNull();
          expect(overlaps(buttonBox, priceBox)).toBeFalsy();
        }
      }

      const visibleLegacyNavs = await page.locator('#bottomNav:visible, #mrBottomNav:visible, .mobile-sticky-order:visible').count();
      if (width <= 768) {
        expect(visibleLegacyNavs).toBe(0);
        const mcNav = page.locator('#mcNav');
        await expect(mcNav).toBeVisible();
        const alpha = await mcNav.evaluate((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          const match = bg.match(/rgba?\\(([^)]+)\\)/i);
          if (!match) return 1;
          const parts = match[1].split(',').map((part) => part.trim());
          return parts.length < 4 ? 1 : Number(parts[3]);
        });
        expect(alpha).toBeGreaterThanOrEqual(0.95);
      }
    });
  }
}
''',
    )

    write(
        'playwright.config.js',
        '''// Playwright smoke/visual QA for Milovi Cake static site.
// Dev-only tooling: no runtime dependency is added to the website.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 20_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      grepInvert: /@layout-matrix/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: 'chromium-mobile',
      grepInvert: /@layout-matrix/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'layout-matrix',
      grep: /@layout-matrix/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
  ],
});
''',
    )


def update_package() -> None:
    package_path = ROOT / 'package.json'
    package = json.loads(package_path.read_text('utf-8'))
    scripts = package['scripts']
    scripts['audit:a11y'] = 'python3 scripts/a11y_static.py'
    scripts['audit:release'] = 'python3 scripts/release_contract.py'
    scripts['audit:all'] = 'npm run audit:js && npm run audit:analytics && npm run audit:a11y && npm run audit:release && npm run audit:prigorody && npm run audit:security && npm run audit'
    scripts['qa'] = 'npm run audit:js && npm run audit:analytics && npm run audit:a11y && npm run audit:release && python3 scripts/check_prigorody_idempotent.py && npm run audit:security && npm run audit && npm run test:playwright'
    scripts['smoke:prod:release'] = 'python3 scripts/production_release_smoke.py'
    dev = dict(package.get('devDependencies', {}))
    dev['@playwright/test'] = '1.63.0'
    dev['playwright'] = '1.63.0'
    package['devDependencies'] = dict(sorted(dev.items()))
    package.pop('dependencies', None)
    package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', 'utf-8')


def update_production_workflow() -> None:
    path = '.github/workflows/production-smoke.yml'
    text = read(path)
    old = "      - name: Run production smoke checks with deploy retry window\n        run: python3 scripts/production_smoke.py --retries 6 --delay 30\n"
    new = """      - name: Run transport/content production smoke with deploy retry window
        run: python3 scripts/production_smoke.py --retries 6 --delay 30

      - name: Verify exact deployed release, privacy and 404 semantics
        env:
          EXPECTED_RELEASE_SHA: ${{ github.sha }}
        run: python3 scripts/production_release_smoke.py --retries 6 --delay 30
"""
    text = replace_required(text, old, new, label='production smoke workflow', count=1)
    write(path, text)


def update_docs() -> None:
    path = 'AGENTS.md'
    text = read(path)
    text = text.replace('**Дата документа:** 2026-05-17 | **Версия:** AGENTS-r2', '**Дата документа:** 2026-09-06 | **Версия:** AGENTS-r3')
    text = text.replace(
        '5. После любой правки CSS/JS — **обновить версию** `?v=...` синхронно во всех HTML и в `sw.js`.',
        '5. После правки CSS/JS — обновить revision только изменённых runtime assets и синхронизировать exact asset→revision с `sw.js`.',
    )
    text, count = re.subn(
        r'## 0\.1 Текущее состояние r51 — обязательный контекст\n\n.*?\n---\n',
        '''## 0.1 Текущие инварианты — обязательный контекст

- Production identity определяется **exact Git SHA** в сгенерированном `/release.json`; номер `rXX` не является источником истины релиза.
- Asset cache-bust — **per-asset revision**: разные CSS/JS могут иметь разные `?v=...`, но каждая ссылка обязана точно совпадать с записью того же asset в `sw.js`.
- Режим работы по всему проекту: `Пн–Сб, 10:00–20:00` / JSON-LD `Mo-Sa`.
- Основная проверка перед merge: `npm run qa`.
- Live-проверка: transport/content smoke + exact-SHA release smoke.
- `scripts/a11y_static.py` хранит permanent guards для подтверждённых conformance-регрессий.
- `scripts/release_contract.py` проверяет exact asset→revision, не глобальный набор версий.
- Playwright имеет обычные desktop/mobile проекты и отдельную responsive matrix `360/390/414/561/600/768/900/1024` × light/dark для camel-rule дефектов.
- CSS/JS budget считается по gzip transfer size; historical `!important` debt не должен расти.
- **Тема по умолчанию (КРИТИЧНО):** весь сайт — СВЕТЛАЯ тема по умолчанию, КРОМЕ `meringue-roll/`, где дефолт ТЁМНЫЙ; явный выбор пользователя всегда приоритетен.

---
''',
        text,
        flags=re.S,
        count=1,
    )
    if count != 1:
        raise SystemExit(f'AGENTS current-state block replacement count={count}')
    text = text.replace('├── js/                        ← РОВНО 4 ФАЙЛА В КОРНЕ js/', '├── js/                        ← runtime allowlist контролирует scripts/audit.py')
    text = text.replace(
        '│   ├── v20-faq-fix.js         ← фикс FAQ для пригородов/контактов\n│   └── gallery/',
        '│   ├── v20-faq-fix.js         ← фикс FAQ для пригородов/контактов\n│   ├── consent-analytics.js    ← единственный privacy-first analytics loader\n│   └── gallery/',
    )
    text = text.replace(
        'Изоляция логики — в IIFE внутри одного из 4 существующих файлов.',
        'Новые runtime JS-файлы не создавать без явного изменения allowlist/архитектуры; используйте существующие модули.',
    )
    text, count = re.subn(
        r'## 6\. ВЕРСИОНИРОВАНИЕ — синхронно или никак\n\n.*?\n---\n\n## 7\.',
        '''## 6. RELEASE IDENTITY И ASSET REVISION

### 6.1 Источник истины релиза

Production release идентифицируется exact Git SHA в `/release.json`, который генерируется `scripts/build_pages_artifact.py`. Не копируйте «текущий rXX» в документацию и не используйте первый найденный `?v=` как release identity.

### 6.2 Asset cache-bust

`?v=` — revision **конкретного файла**, а не глобальная версия сайта. После изменения CSS/JS:

1. поднимите revision этого asset во всех HTML/ESM местах, где он подключён;
2. обновите **тот же asset** в `sw.js` PRECACHE;
3. для изменения Service Worker semantics обновите `CACHE_NAME`;
4. выполните `npm run audit:release`.

Разные неизменённые assets могут сохранять разные исторические revisions. Запрещён только mismatch пары `asset → revision`.

### 6.3 Проверка

```bash
npm run audit:release
grep -E "CACHE_NAME|\\?v=" sw.js
```

---

## 7.''',
        text,
        flags=re.S,
        count=1,
    )
    if count != 1:
        raise SystemExit(f'AGENTS release block replacement count={count}')
    old_checks = '1. `npm run audit:js` — синтаксис всех runtime JS + `sw.js`.\n2. `python3 scripts/check_prigorody_idempotent.py` — генератор пригородов без дрейфа.\n3. `npm run audit` — zero-dependency аудит структуры, SEO, JSON-LD, sitemap, business hours, protected UI contracts, budgets.\n4. `npm run test:playwright` — desktop/mobile smoke, light/dark UI, hero messenger hover, reviews, landing media.'
    new_checks = '1. `npm run audit:js` — синтаксис runtime JS + `sw.js`.\n2. `npm run audit:analytics` — privacy/analytics contract.\n3. `npm run audit:a11y` — permanent conformance guards.\n4. `npm run audit:release` — exact asset→revision contract.\n5. `python3 scripts/check_prigorody_idempotent.py` — генератор пригородов без дрейфа.\n6. `npm run audit:security` + `npm run audit` — dependency/security и zero-dependency site audit.\n7. `npm run test:playwright` — protected interactions + responsive layout matrix.'
    text = replace_required(text, old_checks, new_checks, label='AGENTS mandatory QA list', count=1)
    write(path, text)

    path = 'README.md'
    text = read(path)
    replacements = (
        ('- Cache-bust / SW: **`20260606r01` / `milovi-cake-v2026.06.06-r01`**.', '- Release identity: **exact Git SHA** из live `/release.json`; cache revisions проверяются per-asset через `npm run audit:release`.'),
        ('- `npm run qa` — полный локальный QA: JS, пригороды, Python-аудит, Playwright desktop/mobile.', '- `npm run qa` — JS/privacy/a11y/release/security/site audit + idempotency пригородов + Playwright desktop/mobile/responsive matrix.'),
        ('- `npm run smoke:prod` — smoke live-сайта `milovicake.ru`.', '- `npm run smoke:prod` — transport/content smoke; `npm run smoke:prod:release` — exact SHA + privacy + true 404 contract.'),
        ('├── sitemap-videos.xml            # Видео-карта (шаблон, не заявлен в robots до реальных embed)', '├── sitemap-videos.xml            # Активная video sitemap для проверенных self-hosted gallery videos'),
        ('├── js/                           # РОВНО 6 runtime JS-файлов', '├── js/                           # Runtime JS allowlist (без npm/runtime dependencies)'),
        ('│   ├── v20-faq-fix.js            # Фикс FAQ для пригородов/контактов\n│   └── gallery/', '│   ├── v20-faq-fix.js            # Фикс FAQ для пригородов/контактов\n│   ├── consent-analytics.js       # Privacy-first analytics loader\n│   └── gallery/'),
        ('│   ├── audit.py                  # Главный zero-dependency аудит\n│   ├── check_prigorody_idempotent.py\n│   ├── production_smoke.py       # Live smoke milovicake.ru\n│   └── submit_indexnow.py        # IndexNow submit/dry-run', '│   ├── audit.py                  # Главный zero-dependency аудит\n│   ├── a11y_static.py            # Permanent conformance guards\n│   ├── release_contract.py       # Exact asset→revision contract\n│   ├── check_prigorody_idempotent.py\n│   ├── production_smoke.py       # Transport/content live smoke\n│   ├── production_release_smoke.py # Exact SHA/privacy/404 live smoke\n│   └── submit_indexnow.py        # IndexNow submit/dry-run'),
        ('│   ├── protected-interactions.spec.js\n│\n└── .github/workflows/', '│   ├── protected-interactions.spec.js\n│   ├── overlap-smoke.spec.js\n│   └── layout-matrix.spec.js\n│\n└── .github/workflows/'),
        ('    ├── cake-sanity.yml           # npm run qa on push/PR/manual\n    ├── production-smoke.yml      # live smoke with retry window\n    └── indexnow.yml              # IndexNow submit after relevant push', '    ├── cake-sanity.yml           # npm run qa on push/PR/manual\n    ├── deploy.yml                # sanitized Pages artifact → deploy → exact-SHA witness → IndexNow\n    ├── production-smoke.yml      # scheduled live smoke + exact release semantics\n    └── lighthouse.yml            # post-deploy performance/accessibility telemetry'),
    )
    for old, new in replacements:
        text = replace_required(text, old, new, label=f'README replacement: {old[:35]}')
    write(path, text)

    path = 'llms.txt'
    text = read(path)
    text = replace_required(
        text,
        '- After any CSS/JS change, update `?v=` in HTML and `CACHE_NAME`/`PRECACHE` in `sw.js`.',
        '- After a CSS/JS change, update only that asset revision everywhere it is referenced and the exact same asset entry in `sw.js`; production release identity is the exact Git SHA in `/release.json`.',
        label='llms release rule',
        count=1,
    )
    write(path, text)


def main() -> int:
    fix_aria()
    narrow_ip_copy()
    add_a11y_contract()
    add_release_contract()
    add_production_release_smoke()
    add_layout_matrix()
    update_package()
    update_production_workflow()
    update_docs()
    print('Hardening source migration applied')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
