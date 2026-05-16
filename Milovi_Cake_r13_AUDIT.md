# Milovi Cake — R13 Mobile TOC Premium Polish / QA Report

Дата: 2026-05-16  
Статус: R13 после дополнительной UX-полировки мобильного TOC без реформы структуры.

---

## Главный принцип R13

Без реформаций и перелопачивания DOM. Только точечная премиальная прорисовка:

- мягкий glass-minimal стиль;
- более аккуратная глубина и тени;
- tactile feedback на нажатия;
- плавность открытия/закрытия;
- минималистичная эстетика;
- сохранение текущей логики навигации.

Protected hero-мессенджеры WhatsApp / Telegram / MAX не трогались и сохранены.

---

## Что улучшено в мобильном TOC

### 1. Smart bottom TOC `#mcNav`

В `css/premium-overrides.css` добавлен блок:

```css
PATCH R13 — Premium mobile TOC micro-polish
```

Улучшения:

- нижняя навигация получила более дорогой glass-слой;
- аккуратный blur + saturation;
- мягкая верхняя линия и внутренний свет;
- более премиальный active-state;
- активный пункт получил тонкий gold-indicator;
- иконки стали чуть живее через micro-transform и drop-shadow;
- центральная кнопка «Заказать» получила более глубокий gold-gradient;
- разделители стали мягкими vertical fades;
- сохранены safe-area inset для iPhone.

### 2. Slide-up TOC sheet `#mcSheet`

Улучшения:

- панель стала premium-card с округлением 26px;
- добавлен glass blur;
- добавлен лёгкий radial-gold highlight сверху;
- max-height ограничен через `70dvh`, чтобы панель не съедала весь экран;
- включён `overflow-y:auto` + `-webkit-overflow-scrolling:touch`;
- анимация открытия стала глубже: `translate + scale + opacity`;
- ручка стала крупнее и визуально качественнее;
- строки получили больше воздуха;
- иконки строк стали аккуратными gold tiles;
- hover/active эффекты стали мягкими и премиальными;
- dark theme получила отдельную чёрную glass-отрисовку.

### 3. Burger mobile menu / full-screen TOC

Улучшения:

- добавлены мягкие radial gold highlights;
- шапка меню получила тонкий glass-переход;
- close-кнопка стала визуально дороже;
- пункты меню получили минималистичные rounded hover areas;
- добавлена вертикальная gold-полоска при hover/active;
- messenger-кнопки получили более аккуратную глубину и tactile feedback;
- dark theme сохранена и улучшена.

### 4. Tactile feedback в `js/nav.js`

Добавлен блок:

```js
PATCH R13 — premium tactile feedback for mobile TOC
```

Что делает:

- добавляет временный `.mc-press` на pointerdown;
- убирает `.mc-press` на pointerup / cancel / leave / blur;
- работает для:
  - `#mcNav .mc-btn`;
  - `#mcSheet .mc-row`;
  - `#mcSheet .mc-sheet-close`;
  - `.mobile-menu-nav a`;
  - `.mobile-menu-close`;
  - `.mm-msg`.
- синхронизирует `aria-current="page"` для активной кнопки нижней навигации.

---

## Cache-bust / Service Worker

Версия поднята до R13:

```js
const CACHE_NAME = 'milovi-cake-v2026.05.16-r13';
```

Все CSS/JS/favicon ссылки обновлены:

```text
?v=20260516r13
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

## Итоговый аудит R13

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

## Таблица проверок R13

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
| CSS braces | OK |
| `node --check js/main.js` | OK |
| `node --check js/nav.js` | OK |
| `node --check js/mc-2026.js` | OK |
| `python3 prigorody/build.py` | OK |
| R13 CSS TOC polish block present | OK |
| R13 JS tactile feedback block present | OK |
| Старые cache версии `r8/r9/r10/r11/r12` вне старых audit-файлов | 0 |

---

## R13 вывод

R13 — визуально-тактильная премиализация мобильного TOC:

- без изменения структуры сайта;
- без слома логики;
- без изменения protected hero-мессенджеров;
- с улучшенной плавностью, стеклянностью, gold-depth, отзывчивостью на нажатия и аккуратным minimal premium style.
