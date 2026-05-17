# Milovi Cake — r23 deeper stabilization pack

**Дата:** 2026-05-17  
**Версия:** `20260517r23` / `milovi-cake-v2026.05.17-r23`

## Что добавлено поверх r22

### 1. Service Worker больше не кэширует тяжёлые видео / Range-запросы

В `sw.js` добавлен bypass:

```js
if (
  req.headers.has('range') ||
  req.destination === 'video' ||
  /\.(?:webm|mp4|mov|m4v)$/i.test(url.pathname)
) return;
```

Зачем:

- `.webm` в галерее весят до ~2.5 MB каждый;
- старый runtime-cache мог складывать видео в Cache Storage;
- это раздувает кэш сайта и может приводить к непредсказуемой eviction-политике браузера;
- Range-запросы лучше отдавать нативно браузером/сервером, без SW-обёртки.

CSS/JS/обычные изображения по-прежнему идут через stale-while-revalidate.

### 2. Галерея меньше грузит сеть на первом экране

В `js/gallery/main.js` убрано принудительное `src` для первых видео-карточек.

Было: первые видео могли начать грузиться сразу.

Стало:

```js
v.preload = 'metadata';
v.dataset.src = item.videoSrc;
```

Фактическую загрузку запускает существующий `IntersectionObserver`, когда видео рядом с viewport. Постеры остаются на месте.

### 3. Аудит теперь ловит ESM-модули без cache-bust

В `scripts/audit.py` добавлен guardrail:

```text
✅ ESM relative imports are cache-busted
```

Это защищает от повторения бага с `js/gallery/data.js`, когда HTML был versioned, а импортируемый модуль — нет.

### 4. Аудит теперь проверяет SW video/range bypass

В `scripts/audit.py` добавлен check:

```text
✅ SW video/range bypass: ✓
```

## Синхронизация версий

Все ссылки подняты с r22 на r23:

```text
?v=20260517r23
CACHE_NAME = milovi-cake-v2026.05.17-r23
```

## Проверки

Прогнано:

```bash
npm run audit:all
python3 audit.py
python3 scripts/audit.py
python3 -m py_compile audit.py scripts/audit.py scripts/check_prigorody_idempotent.py
node --check js/main.js
node --check js/nav.js
node --check js/mc-2026.js
node --check js/v20-faq-fix.js
node --check js/gallery/main.js
node --check js/gallery/data.js
node --check sw.js
```

Результат:

```text
✅ Passed: 33
⚠️ Warnings: 10
❌ Errors: 0
```

## Как применить

Распаковать ZIP в корень репо, затем:

```bash
git add .
git commit -m "fix(r23): bypass video cache in SW and guard ESM cache-bust"
git push origin main
```

После деплоя: Ctrl+F5. Если браузер всё ещё показывает старое — F12 → Application → Service Workers → Unregister → Clear site data.
