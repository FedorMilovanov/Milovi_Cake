# Milovi Cake — R12 Full QA / Patch Report

Дата: 2026-05-16  
Статус: R12 после продолженной проверки функций, картинок, мобильного калькулятора и UX.

---

## Protected UI сохранён

Проверено повторно: hero-мессенджеры на главной НЕ сломаны.

- WhatsApp / Telegram / MAX — круглые inline-SVG иконки.
- Кольцевое название сохранено.
- Hover-анимация «название подлетает вверх» сохранена.
- Цвета брендовые:
  - WhatsApp — `#25D366`;
  - Telegram — `#229ED9`;
  - MAX — `#7B5EE8` / `#8e74ee`.

---

## Что дополнительно найдено после R11

### A1. R11 a11y-патч мог цеплять overlay-слои

В R11 keyboard-a11y патч целенаправленно улучшал legacy `div/span onclick`, но generic-селектор `[onclick]` мог технически зацепить overlay-слои:

- `#privacyOverlay`
- `#cookiePrivacyOverlay`
- `.cart-overlay`
- другие элементы с `id$="Overlay"` / классом `overlay`

Это не критичный crash, но UX/a11y-неидеально: overlay не должен становиться tab-кнопкой.

Исправлено в R12:

```js
'[onclick]:not(a):not(button):not(input):not(textarea):not(select):not(.cart-overlay):not([id$="Overlay"]):not([class*="overlay"])'
```

Теперь overlay-слои не попадают в автоматическое `role="button"` / `tabindex="0"`.

### A2. Мобильный калькулятор: возможный конфликт с bottom nav

Проверен CSS мобильного калькулятора. Найден потенциальный UX-конфликт:

- `.calc-right-col` на мобильном был близко к z-index `mc-nav`;
- раскрытая панель цены могла конкурировать с нижней навигацией;
- bottom-sheet можно сделать удобнее по высоте и touch-эргономике.

Добавлен R12 CSS-патч в `css/premium-overrides.css`:

- `.calc-right-col` поднят до `z-index:160`;
- учтены `safe-area-inset-left/right/top/bottom`;
- раскрытая панель ограничена через `100dvh`, чтобы не занимала весь экран;
- внутри раскрытия включён `overflow-y:auto` и `-webkit-overflow-scrolling: touch`;
- CTA внутри раскрытой панели сделан sticky снизу;
- ручка bottom-sheet стала крупнее и заметнее;
- цена стала адаптивной через `clamp()`;
- backdrop получил blur и корректный z-index;
- при открытом калькуляторе `#mcNav` уезжает вниз через `:has()`;
- добавлен fallback через `body.calc-panel-open`.

### A3. JS-синхронизация состояния калькулятора

В `_setCalcBackdrop(show)` добавлено:

```js
 document.body.classList.toggle('calc-panel-open', !!show);
```

Это нужно для fallback-браузеров без `:has()`: нижняя навигация скрывается, пока раскрыт калькулятор.

### A4. Картинки каталога / lightbox

Проверено:

- все product slide images из `js/main.js` существуют в `img/`;
- `openLightbox()` имеет DOM-элемент `#lightbox` на главной и во всех пригородах;
- review lightbox images имеют `width/height`;
- placeholder images с пустым `src` имеют размеры;
- финальный счётчик `<img>` без размеров: 0.

---

## Cache-bust / Service Worker

Версия поднята до R12:

```js
const CACHE_NAME = 'milovi-cake-v2026.05.16-r12';
```

Все CSS/JS/favicon ссылки обновлены:

```text
?v=20260516r12
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

## Итоговый автоматический аудит R12

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

## Таблица проверок R12

| Проверка | Результат |
|---|---:|
| HTML-файлов проверено | 24 |
| JS-файлов проверено | 11 |
| CSS-файлов проверено | 4 |
| JS-функций найдено статически | 194 |
| Inline handler missing functions | 0 |
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
| Product images from JS exist | 31 / 31 |
| CSS braces | OK |
| `node --check js/main.js` | OK |
| `node --check js/nav.js` | OK |
| `node --check js/mc-2026.js` | OK |
| `python3 prigorody/build.py` | OK |
| `id="lightbox"` во всех пригородах | OK |
| Старые cache версии `r8/r9/r10/r11` вне старых audit-файлов | 0 |

---

## Команды проверки

```bash
python3 prigorody/build.py
node --check js/main.js
node --check js/nav.js
node --check js/mc-2026.js
python3 /tmp/r10_audit2.py
```

Дополнительно запускались проверки:

```bash
# product images from js/main.js exist
# inline onclick/onchange handlers resolve to existing functions
# img width/height completeness
# lxml HTML parse
# sitemap.xml + sitemap-videos.xml parse + local target existence
# old cache-bust versions absent
```

---

## R12 вывод

R12 — UX/a11y/mobile-polish патч поверх R11:

- overlay-слои больше не превращаются в tab-кнопки;
- мобильный калькулятор удобнее и безопаснее относительно нижней навигации;
- состояние раскрытого калькулятора синхронизируется через `body.calc-panel-open`;
- все картинки для каталога/lightbox проверены;
- полный статический аудит — 0 issues.
