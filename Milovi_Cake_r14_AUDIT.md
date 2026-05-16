# Milovi Cake — R14 Mobile TOC Fine Polish / Full QA Report

Дата: 2026-05-16  
Статус: R14 после дополнительной тонкой полировки мобильного TOC и повторной полной проверки.

---

## Цель R14

Продолжить премиализацию без реформы структуры:

- не менять DOM-архитектуру;
- не трогать protected hero-мессенджеры;
- улучшить именно тонкости: фокус, активные состояния, глубину, ощущение касания, эстетику sheet/TOC;
- сохранить лёгкость и минимализм.

---

## Protected UI сохранён

Главная — WhatsApp / Telegram / MAX:

- круглые inline-SVG иконки сохранены;
- кольцевое название сохранено;
- hover-подлёт названия сохранён;
- брендовые цвета сохранены:
  - WhatsApp — `#25D366`;
  - Telegram — `#229ED9`;
  - MAX — `#7B5EE8` / `#8e74ee`.

---

## Что добавлено в R14

### 1. Semantics/focus слой для mobile TOC в `js/nav.js`

Добавлен блок:

```js
PATCH R14 — mobile TOC semantics + active row refinement
```

Что делает:

- выставляет `aria-hidden="true/false"` для `#mcSheet` по состоянию открытия;
- backdrop оставляет `aria-hidden="true"`, чтобы не попадал в смысловую навигацию;
- при открытии sheet мягко фокусирует кнопку закрытия;
- при закрытии возвращает фокус на кнопку `#mcMoreBtn`;
- синхронизирует активную строку внутри `#mcSheet` по текущей секции;
- добавляет `aria-current="location"` активной строке sheet;
- работает через `MutationObserver`, scroll/hashchange/resize;
- существующую логику открытия/закрытия не переписывает.

### 2. Active rows внутри `#mcSheet`

Добавлен визуальный стиль для:

```css
#mcSheet .mc-row--active
#mcSheet .mc-row--current
```

Улучшения:

- активная строка теперь визуально читается;
- мягкий gold-glass фон;
- gold tile иконки;
- приглушённая стрелка;
- отдельная dark-theme прорисовка.

### 3. Edge-light и scrollbar polish для sheet

В `#mcSheet` добавлено:

- тонкая верхняя edge-line через sticky pseudo-element;
- нижний fade, чтобы конец панели выглядел мягче;
- тонкий кастомный scrollbar;
- dark-theme fade.

### 4. Более элегантный focus для TOC

Для мобильных TOC-контролов добавлен отдельный premium focus:

- `#mcNav .mc-btn`
- `#mcSheet .mc-row`
- `#mcSheet .mc-sheet-close`
- `.mobile-menu-nav a`
- `.mobile-menu-close`
- `.mm-msg`

Фокус стал:

- заметным;
- аккуратным;
- не кислотным;
- с мягким gold halo;
- отдельно адаптирован под dark theme.

### 5. Tap bloom / tactile depth

Добавлен мягкий inner-bloom при `.mc-press`:

- нижняя навигация;
- строки sheet;
- ссылки fullscreen menu.

Это даёт ощущение более дорогой отзывчивости без тяжёлых анимаций.

### 6. Fullscreen burger menu: subtle entrance

Для `.mobile-menu.open .mobile-menu-nav a` добавлена лёгкая stagger-анимация входа:

- пункты меню появляются мягко;
- задержки минимальные;
- `prefers-reduced-motion` соблюдён.

---

## Cache-bust / Service Worker

Версия поднята до R14:

```js
const CACHE_NAME = 'milovi-cake-v2026.05.16-r14';
```

Все CSS/JS/favicon ссылки обновлены:

```text
?v=20260516r14
```

---

## Повторная генерация пригородов

```bash
python3 prigorody/build.py
```

Результат:

```text
✓ gatchina
✓ kolpino
✓ krasnoe-selo
✓ kronshtadt
✓ kudrovo
✓ lomonosov
✓ murino
✓ pavlovsk
✓ peterhof
✓ pushkin
✓ sestroretsk
✓ shushary
✓ tosno
✓ vsevolozhsk

Готово: 14 файлов, 0 ошибок.
```

---

## Итоговый аудит R14

```json
{
  "html_files": 24,
  "js_files": 11,
  "css_files": 4,
  "issues_total": 0,
  "issues_by_type": {}
}
```

---

## Таблица проверок R14

| Проверка | Результат |
|---|---:|
| HTML-файлов проверено | 24 |
| JS-файлов проверено | 11 |
| CSS-файлов проверено | 4 |
| `<button>` без `type` в HTML | 0 |
| `<button>` без `type` в JS template strings | 0 |
| `<a target="_blank">` без `noopener` | 0 |
| `<img>` без `alt` | 0 |
| `<img>` без `width/height` | 0 |
| Duplicate ID | 0 |
| Положительный `tabindex` в исходном HTML | 0 |
| JSON-LD в финальных HTML | OK |
| Локальные asset-ссылки в финальных HTML | OK |
| HTML parse errors через lxml | 0 |
| Sitemap XML parse | OK |
| Sitemap targets/images/videos exist | OK |
| CSS braces | OK |
| `node --check js/main.js` | OK |
| `node --check js/nav.js` | OK |
| `node --check js/mc-2026.js` | OK |
| `python3 prigorody/build.py` | OK |
| R14 CSS finishing block present | OK |
| R14 JS semantics block present | OK |
| Старые cache версии `r8/r9/r10/r11/r12/r13` вне старых audit-файлов | 0 |

---

## R14 вывод

R14 — тонкая полировка TOC после R13:

- больше семантики и корректного фокуса;
- активные строки внутри sheet;
- edge-light, fade, scrollbar polish;
- более премиальный focus-ring;
- лёгкий tap bloom;
- минимальные stagger-анимации fullscreen меню;
- вся структура сохранена, protected hero-мессенджеры не тронуты;
- полный аудит — 0 issues.
