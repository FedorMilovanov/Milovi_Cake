# Milovi Cake — r22 Stabilization Pack

Дата: 2026-05-17
Версия: `20260517r22`

## Что исправлено

1. `js/gallery/data.js` получил cache-bust через ESM import:
   - было: `import { GALLERY_ITEMS } from './data.js';`
   - стало: `import { GALLERY_ITEMS } from './data.js?v=20260517r22';`

2. `sw.js`:
   - `CACHE_NAME` поднят до `milovi-cake-v2026.05.17-r22`;
   - в PRECACHE добавлен `/js/gallery/data.js?v=20260517r22`;
   - PRECACHE теперь 21 URL.

3. Все HTML/SW/галерейный import синхронно подняты на `?v=20260517r22`.

4. Корневой `audit.py` заменён на безопасный wrapper. Теперь `python3 audit.py` и `python3 scripts/audit.py` оба проверяют именно репо, а не родительскую папку.

5. `package.json`:
   - `audit:js` теперь проверяет `js/gallery/data.js`;
   - `audit:prigorody` теперь использует idempotent-check и не падает на валидных uncommitted patches.

6. Добавлен `scripts/check_prigorody_idempotent.py`.

7. Добавлен `SERIOUS_TECH_DEBT_AUDIT.md` — серьёзные заметки на будущее про JS budget, `!important`, токены цветов и gallery media.

## Проверки

Прогнано:

```bash
npm run audit:all
python3 audit.py
python3 scripts/audit.py
python3 -m py_compile audit.py scripts/audit.py scripts/check_prigorody_idempotent.py
node --check js/main.js js/nav.js js/mc-2026.js js/v20-faq-fix.js js/gallery/main.js js/gallery/data.js sw.js
```

Результат:

- ✅ audit: 31 passed / 10 warnings / 0 errors
- ✅ все JS/Python валидны
- ✅ версии: 213 вхождений `?v=20260517r22`
- ✅ Service Worker: `milovi-cake-v2026.05.17-r22`
- ✅ gallery data module cache-bust + precache

## Как применить

Распаковать ZIP в корень репо, затем:

```bash
git add .
git commit -m "fix(r22): cache-bust gallery data and harden audit tooling"
git push origin main
```

После деплоя у себя один раз сбросить SW/кэш или открыть в инкогнито.
