# AI DO NOT TOUCH — Milovi Cake R10 Guardrails

Дата: 2026-05-16
Статус: обязательные правила для любых будущих ИИ/разработчиков.

## 1. Главная — WhatsApp / Telegram / MAX

ЭТО НЕ ТРОГАТЬ без прямого письменного указания владельца.

На главной странице hero-мессенджеры должны оставаться именно такими:

- круглые inline-SVG иконки;
- внутри SVG есть кольцевое название вокруг иконки;
- при наведении плоское название подлетает вверх;
- кольцевой текст мягко уходит/приглушается;
- цвета строго брендовые:
  - WhatsApp — зелёный `#25D366`;
  - Telegram — голубой `#229ED9`;
  - MAX — фиолетовый `#7B5EE8` / `#8e74ee`.

Запрещено:

- перекрашивать эти иконки в белый;
- заменять их на обычные pill-кнопки с текстом;
- удалять SVG `textPath` / кольцевой текст;
- удалять hover-анимацию «название вверх»;
- удалять классы `messenger-group--ring`, `btn-hero-ring`, `.hero-ring-text`, `.hero-flat-text`;
- переписывать R9/R10 protected CSS-блок в `css/premium-overrides.css`.

## 2. Где защищённый код

- `index.html` — hero-блок главной, группа `.messenger-group--ring`.
- `prigorody/_template.html` — эталон для пригородов и обязательный lightbox.
- `css/premium-overrides.css` — блок `AI DO NOT TOUCH — R10 PROTECTED BLOCK` и `PATCH R9/R10`.
- `llms.txt` — продублированные правила для будущих AI-агентов.

## 3. Пригороды — фото тортов

НЕ удалять catalog lightbox из `prigorody/_template.html`:

```html
<div class="lightbox" id="lightbox">
```

Без него на страницах пригородов не открываются фото тортов из каталога.

## 4. Пригороды — как редактировать

Сгенерированные страницы:

```text
prigorody/<city>/index.html
```

руками не править. Правки делать только в:

```text
prigorody/_template.html
prigorody/_cities.csv
```

затем запускать:

```bash
python3 prigorody/build.py
```

## 5. Перед деплоем

Обязательно проверить:

```bash
node --check js/main.js
node --check js/nav.js
node --check js/mc-2026.js
python3 prigorody/build.py
```

И поднять cache-bust версию `?v=` + `CACHE_NAME` в `sw.js`.

R16 использует версию:

```text
20260516r16
milovi-cake-v2026.05.16-r16
```

## 6. R15 — защищённые визуальные решения контактов и типографики

- В блоке `#contacts` SVG-трубка телефона должна быть чисто чёрной с мягкой светлой/gold подсветкой. Запрещено возвращать белую трубку или случайную заливку.
- В футере ссылки телефона / WhatsApp / Telegram должны быть нейтральными premium chips. Запрещено делать их яркими, случайно окрашенными или визуально похожими на баг.
- Анимация hero-мессенджеров должна поддерживать оба варианта SVG-разметки: class-based главной (`.hero-ring-text`, `.hero-flat-text`) и id-based пригородов (`ring-text-*`, `flat-text-*`). Не удалять R15 fallback в `js/main.js`.
- Описательные subtitle-тексты должны оставаться мягкими, менее квадратными: `Cormorant Garamond`, `font-style: normal`, без курсива. Не возвращать грубую квадратную sans-подачу без согласования.

