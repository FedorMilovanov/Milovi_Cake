# Milovi Cake — r28 Version Sync + Cleanup

**Дата:** 2026-05-19
**Версия:** `20260519r28` / `milovi-cake-v2026.05.19-r28`

---

## Что было сломано (найдено при аудите)

### 1. КРИТИЧНО: Рассинхронизация версий `?v=`

**Было:**
- `sw.js` CACHE_NAME = `milovi-cake-v2026.05.18-r27`
- PRECACHE в sw.js — микс `r24` и `r27` (10 ресурсов на `r24`, 3 на `r27`)
- Все основные HTML-страницы — `?v=20260518r24`
- gallery/index.html — `?v=20260518r27` (для gallery-специфичных файлов)
- js/gallery/main.js import — `?v=20260518r27`

Это прямое нарушение **§6 AGENTS.md**: «Все три места: HTML-страницы, sw.js PRECACHE, sw.js CACHE_NAME — должны быть синхронны».

**Последствия:**
- Service Worker мог не находить ресурсы в кэше (версия в HTML ≠ версия в PRECACHE)
- Пользователи могли видеть устаревшие стили/скрипты
- При обновлении SW старые кэши удалялись, но новые ресурсы не всегда precache-ились корректно

**Стало:** ВСЕ 212 вхождений → единая `?v=20260519r28`. CACHE_NAME → `milovi-cake-v2026.05.19-r28`.

### 2. console.log в продакшене (mc-2026.js)

**Было:** 3 вызова `console.log` для debug CWV (LCP, CLS, INP)

**Стало:** Заменены на `/* debug removed r28 */`. Структура кода сохранена, PerformanceObserver продолжает работать, просто не логирует в консоль.

---

## Что сделано

1. **Синхронизация `?v=`** — все HTML (23 страницы), sw.js, gallery ESM import → `20260519r28`
2. **CACHE_NAME** обновлён до `milovi-cake-v2026.05.19-r28`
3. **Удалены console.log** из `js/mc-2026.js` (3 шт)
4. **Перегенерированы все 14 пригородов** через `python3 prigorody/build.py`

---

## Что НЕ тронуто (по AGENTS §3 PROTECTED FILES)

- Hero-мессенджеры WhatsApp/Telegram/MAX
- `R10 PROTECTED BLOCK` в `premium-overrides.css`
- `R15 fallback` в `js/main.js`
- `buildCartKey` / `parseCartKey`
- Theme toggle SVG, lightbox пригородов
- Footer-контакты, иконка телефона, subtitle-типографика
- Никаких новых CSS/JS файлов не создано
- Порядок загрузки CSS не изменён
- Содержимое CSS-файлов не менялось
- `js/main.js`, `js/nav.js`, `js/v20-faq-fix.js`, `js/gallery/data.js` — не менялись

---

## Проверки (все пройдены)

```
✅ Единая версия ?v=20260519r28 (212 вхождений)
✅ CACHE_NAME = milovi-cake-v2026.05.19-r28
✅ SW PRECACHE: 13 ресурсов + / + /gallery/ + manifest + favicon + images
✅ console.log: 0 (было 3)
✅ CSS: 7 файлов (без изменений)
✅ JS: 6 файлов
✅ Пригороды: 14 городов перегенерированы
✅ SW video/range bypass: на месте
✅ SW skipWaiting + clients.claim: на месте
✅ Нет старых версий r24/r27 ни в одном файле
```

---

## Состав пакета (31 файл)

```
README_R28_SYNC.md          ← этот файл
sw.js                       ← CACHE_NAME + PRECACHE обновлены
index.html                  ← ?v= обновлён
404.html                    ← ?v= обновлён
gallery/index.html          ← ?v= обновлён
call/index.html             ← ?v= обновлён
certificates/index.html     ← ?v= обновлён
meringue-roll/index.html    ← ?v= обновлён
prigorody/index.html        ← ?v= обновлён
prigorody/_template.html    ← ?v= обновлён
prigorody/<14 городов>/index.html  ← перегенерированы
js/mc-2026.js               ← console.log удалены
js/gallery/main.js          ← ESM import ?v= обновлён
```

CSS и остальные JS файлы **не менялись** (версии обновляются только в HTML-ссылках и sw.js).

---

## Файлы для удаления

Удалять ничего не нужно. Все файлы — замены существующих.

---

## Как применить

1. Распакуй ZIP в **корень** репо, подтверди перезапись
2. ```bash
   git add .
   git commit -m "fix(r28): sync all ?v= versions, remove console.log from mc-2026.js"
   git push origin main
   ```

## После деплоя

1. F12 → **Application** → **Service Workers** → **Unregister**
2. **Storage** → **Clear site data**
3. Закрой вкладку, открой снова, **Ctrl + F5**

Для остальных пользователей новый SW установится автоматически (skipWaiting + clients.claim).
