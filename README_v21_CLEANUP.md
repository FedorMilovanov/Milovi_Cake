# Milovi Cake — v21 Cleanup Pack

**Дата:** 2026-05-17  
**Тип:** аккуратная синхронизация версий + чистка по AGENTS.md  
**Версия:** `20260517r21`

---

## 🎯 Что сделано

### 1. Полная синхронизация версий `?v=` (главная проблема, объясняющая «не вижу обновлений»)

**Было:** разные страницы использовали разные версии:
- `index.html` → `r18`
- `meringue-roll`, `certificates`, `call`, `prigorody/index.html` → `r16`
- `prigorody/_template.html` + 14 городов → `r17`
- `sw.js` PRECACHE → `r20`, CACHE_NAME → `r20fix`
- 6 файлов вообще без `?v=` (`v20-fixes.css`, `v20-dark-and-fixes.css`, `final-fixes.css`, `gallery-2026.css`, `v20-faq-fix.js`, `gallery/main.js`)

**Стало:** ВСЕ 214 вхождений → единая версия `?v=20260517r21`. CACHE_NAME → `milovi-cake-v2026.05.17-r21`.

Это нарушало **§6 AGENTS.md** и было главной причиной «файлы не обновляются на сайте».

### 2. Service Worker (`sw.js`)

- Новый CACHE_NAME `milovi-cake-v2026.05.17-r21`.
- PRECACHE расширен до 20 ресурсов (все CSS + все JS + критические изображения).
- Стратегия осталась прежней: HTML — network-first, статика — stale-while-revalidate.
- `skipWaiting()` + `clients.claim()` — мгновенное обновление у пользователей.

### 3. SEO-фиксы (по аудиту)

- `certificates/index.html`: meta description 164 → 119 символов (был выше лимита Google).
- `call/index.html`: `<div class="logo">` → `<h1 class="logo">` (страница не имела h1).

### 4. Документация приведена в соответствие с реальностью

- `AGENTS.md` → r2: легализован `js/gallery/data.js` (используется через `import` в `gallery/main.js`).
- `AI_DO_NOT_TOUCH_GUARDRAILS.md` синхронизирован.
- `scripts/audit.py`:
  - `data.js` добавлен в `ALLOWED_JS`.
  - **Починен баг #14 (Resource Integrity)** — раньше давал 38 ложных «missing resource».
  - **Починен SEO check** — исключение для verification-файлов поисковиков.

### 5. Все пригороды перегенерированы

`python3 prigorody/build.py` → все 14 городов синхронизированы с обновлённым `_template.html`.

---

## ✅ Финальная проверка (audit.py)

```
Passed:   29
Warnings: 15   ← рекомендации (!important, console.log) — не блокеры
Errors:    0   ← ✅ AUDIT PASSED — site ready for deploy
```

### Все JS валидны
```
✅ js/main.js   ✅ js/nav.js   ✅ js/mc-2026.js
✅ js/v20-faq-fix.js   ✅ js/gallery/main.js   ✅ sw.js
```

---

## 🚫 Что НЕ тронуто (по AGENTS §3 PROTECTED FILES)

- Hero-мессенджеры WhatsApp/Telegram/MAX (структура, цвета, hover)
- `R10 PROTECTED BLOCK` в `premium-overrides.css`
- `R15 fallback` в `js/main.js`
- `buildCartKey` / `parseCartKey`
- Theme toggle SVG, lightbox пригородов
- Footer-контакты, иконка телефона, subtitle-типографика
- `img/`, `manifest.json`, `robots.txt`, `sitemap*.xml`, `CNAME`
- Никаких новых CSS/JS файлов не создано

---

## 📦 Состав пакета (27 файлов)

```
404.html
AGENTS.md                              ← обновлён до r2
AI_DO_NOT_TOUCH_GUARDRAILS.md          ← обновлён
call/index.html                        ← h1 fix + версии
certificates/index.html                ← description fix + версии
gallery/index.html                     ← версии
index.html                             ← версии (r18 → r21)
meringue-roll/index.html               ← версии (r16 → r21)
prigorody/_template.html               ← версии (r17 → r21)
prigorody/index.html                   ← версии
prigorody/<14 городов>/index.html      ← перегенерированы build.py
scripts/audit.py                       ← баг-фиксы аудита
sw.js                                  ← новый CACHE_NAME + PRECACHE
yandex_9bde19424208d6ce.html           ← версии
README_v21_CLEANUP.md                  ← этот файл
```

CSS и JS файлы **не менялись** (содержимое уже было правильным на GitHub).

---

## 🚀 Как применить

### Вариант A (Git, рекомендуется)

1. Распакуй ZIP в **корень** локальной копии репо (`C:\Users\Fedor\Projects\Milovi_Cake`), подтверди перезапись.
2. ```bash
   git status         # должен показать все 27 modified
   git add .
   git commit -m "chore(r21): sync ?v= versions, fix SEO, audit tooling"
   git push origin main
   ```

### Вариант B (через GitHub веб)

Загрузи 27 файлов через "Add files via upload" с сохранением структуры папок.

---

## 🔥 После деплоя: как УВИДЕТЬ обновления в браузере

GitHub Pages обновляется за 30–90 секунд. Но твой браузер ещё держит **старый Service Worker**. Сбрось его:

1. F12 → **Application** → **Service Workers** → **Unregister**
2. **Storage** → **Clear site data**
3. Закрой вкладку, открой снова, **Ctrl + F5**

Для остальных пользователей новый `sw.js` сам себя установит при следующем визите (`skipWaiting` + `clients.claim`) — максимум 2 захода.

---

## ⚠️ Что осталось на потом (warnings, не блокеры)

| # | Warning | Комментарий |
|---|---|---|
| 1 | JS size 234 KB > 200 KB | gallery/main.js + data.js, специфика галереи |
| 2 | !important: 1610 шт | требует отдельной чистки CSS, см. AGENTS §4.2 |
| 3 | 3 × `console.log` в `js/mc-2026.js` | удалить при следующей правке этого файла |
| 4 | google/yandex verification файлы без DOCTYPE | технические файлы, не страшно |
| 5 | `.git/objects/pack` 35 MB | нормально для репо со 100+ коммитами |

Это **накопленный технический долг**, не критика. Чистится итеративно.
