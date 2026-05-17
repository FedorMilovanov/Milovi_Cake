# AI DO NOT TOUCH — Milovi Cake (R18+ Guardrails)

**Дата:** 2026-05-17
**Статус:** обязательные правила. Дополняет `AGENTS.md`.

> Если ты ИИ — **сначала прочитай `AGENTS.md`** в корне репо. Этот файл — список конкретных «не трожь» элементов.

---

## 1. Главная — WhatsApp / Telegram / MAX

ЭТО НЕ ТРОГАТЬ без прямого письменного указания владельца.

На главной странице hero-мессенджеры должны оставаться именно такими:

- круглые inline-SVG иконки
- внутри SVG есть кольцевое название вокруг иконки (`textPath`)
- при наведении плоское название подлетает вверх
- кольцевой текст мягко уходит / приглушается
- цвета строго брендовые:
  - WhatsApp — зелёный `#25D366`
  - Telegram — голубой `#229ED9`
  - MAX — фиолетовый `#7B5EE8` / `#8e74ee`

**Запрещено:**
- перекрашивать эти иконки в белый
- заменять их на обычные pill-кнопки с текстом
- удалять SVG `textPath` / кольцевой текст
- удалять hover-анимацию «название вверх»
- удалять классы `messenger-group--ring`, `btn-hero-ring`, `.hero-ring-text`, `.hero-flat-text`
- переписывать R9/R10 protected CSS-блок в `css/premium-overrides.css`

## 2. Где защищённый код

- `index.html` — hero-блок главной, группа `.messenger-group--ring`
- `prigorody/_template.html` — эталон для пригородов и обязательный lightbox
- `css/premium-overrides.css` — блок `AI DO NOT TOUCH — R10 PROTECTED BLOCK` и `PATCH R9/R10`
- `js/main.js` — `R15 fallback` рядом с обработкой messenger SVG
- `llms.txt` — продублированные правила для будущих AI-агентов

## 3. Пригороды — фото тортов

НЕ удалять catalog lightbox из `prigorody/_template.html`:

```html
<div class="lightbox" id="lightbox">
```

Без него на страницах пригородов не открываются фото тортов из каталога.

## 4. Пригороды — как редактировать

Сгенерированные страницы `prigorody/<city>/index.html` руками **не править**. Правки только в:
- `prigorody/_template.html`
- `prigorody/_cities.csv`

Затем запустить:
```bash
python3 prigorody/build.py
```

## 5. R15 — защищённые визуальные решения

- В блоке `#contacts` SVG-трубка телефона должна быть чисто чёрной с мягкой светлой/gold подсветкой. Запрещено возвращать белую трубку или случайную заливку.
- В футере ссылки телефона / WhatsApp / Telegram должны быть нейтральными premium chips. Запрещено делать их яркими, случайно окрашенными или визуально похожими на баг.
- Анимация hero-мессенджеров должна поддерживать оба варианта SVG-разметки: class-based главной (`.hero-ring-text`, `.hero-flat-text`) и id-based пригородов (`ring-text-*`, `flat-text-*`). Не удалять R15 fallback в `js/main.js`.
- Описательные subtitle-тексты должны оставаться мягкими, менее квадратными: `Cormorant Garamond`, `font-style: normal`, без курсива. Не возвращать грубую квадратную sans-подачу без согласования.

## 6. R18 — защищённая корзина (КРИТИЧНО)

В `js/main.js`:
- `buildCartKey(numId, mode, hasMaxi, fillName, decorName)` — единая точка формирования ключа корзины
- `parseCartKey(key)` — обратная совместимость
- `addToCart()` использует `buildCartKey()` для всех товаров

**Запрещено:**
- «упрощать» в формат `id` для товаров без `hasMaxi` — это сломает bento-режимы
- Менять формат ключа без обновления `parseCartKey()`
- Использовать прямую конкатенацию (`id + ':' + fill`) — только через `buildCartKey()`

## 7. R18 — Theme Toggle SVG (КРИТИЧНО)

В HTML иконки имеют классы:
- `.theme-icon--moon` — луна
- `.theme-icon--sun` — солнце

CSS управляет только `display: block/none` в зависимости от `data-theme` атрибута на `<html>`.

**Запрещено:**
- Возвращать старые классы `.sun-icon` / `.moon-icon` (они конфликтовали)
- Управлять видимостью через `position:absolute` и `opacity` (это вызывало мигание)

## 8. Перед деплоем — обязательные проверки

```bash
node --check js/main.js
node --check js/nav.js
node --check js/mc-2026.js
node --check js/v20-faq-fix.js
node --check js/gallery/main.js
node --check sw.js
python3 prigorody/build.py
```

И **поднять cache-bust версию** `?v=` синхронно в:
- `index.html`
- `gallery/index.html`
- `meringue-roll/index.html`
- `certificates/index.html`
- `call/index.html`
- `404.html`
- `prigorody/index.html`
- `prigorody/_template.html` (затем `build.py` для генерации городов)
- `sw.js` (PRECACHE + CACHE_NAME)

## 9. Cтруктура CSS/JS — фиксирована

См. `AGENTS.md` §2.

**Запрещено создавать новые CSS-файлы**. Есть ровно 7:
- `style.css`, `mc-2026.css`, `premium-overrides.css`
- `v20-dark-and-fixes.css`, `v20-fixes.css`, `final-fixes.css`
- `gallery/gallery-2026.css`

**Запрещено создавать новые JS-файлы**. Есть ровно 5:
- `main.js`, `nav.js`, `mc-2026.js`, `v20-faq-fix.js`
- `gallery/main.js`

## История

| Версия | Дата | Что |
|---|---|---|
| R10 | 2026-05-16 | Hero-мессенджеры, lightbox пригородов |
| R15 | 2026-05-16 | Иконка телефона, footer-chips, subtitle-типографика, JS fallback |
| R18 | 2026-05-16 | Корзина (`buildCartKey`), theme toggle, hero-мессенджеры финал |
| R18+ | 2026-05-17 | Зафиксирована структура CSS/JS (7+5 файлов), добавлен `AGENTS.md` |
