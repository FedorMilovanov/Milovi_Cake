# Milovi Cake — R11 Full QA / Patch Report

Дата: 2026-05-16  
Статус: R11 после продолженной полной проверки репозитория.

---

## Главное: protected UI сохранён

Проверено: защищённый стиль hero-мессенджеров на главной НЕ сломан.

- WhatsApp / Telegram / MAX остаются круглыми inline-SVG иконками.
- Кольцевое название сохранено.
- Hover-анимация «название подлетает вверх» сохранена.
- Цвета брендовые:
  - WhatsApp — `#25D366`;
  - Telegram — `#229ED9`;
  - MAX — `#7B5EE8` / `#8e74ee`.

Правила «НЕ ТРОГАТЬ» остаются в:

- `AI_DO_NOT_TOUCH_GUARDRAILS.md`
- `llms.txt`
- `index.html`
- `prigorody/_template.html`
- `css/premium-overrides.css`

---

## Что дополнительно найдено после R10

### A1. CLS-риск: placeholder lightbox images без width/height

После углублённой проверки найдено, что не все динамические lightbox-картинки имели размеры.

Исправлено:

- `certificates/index.html`
  - `#lbImg` получил `width`, `height`, `aspect-ratio`, `decoding` и осмысленный `alt`.
- `meringue-roll/index.html`
  - `#lbImg` получил `width`, `height`, `aspect-ratio`, `decoding` и осмысленный `alt`.
- `prigorody/_template.html`
  - review lightbox `#lbImg` получил `width="800" height="1000"`, `aspect-ratio:4/5`, `decoding="async"`, `loading="lazy"`.
- все 14 пригородов пересобраны через `python3 prigorody/build.py`.

Результат: финальная проверка `img` без `width/height` — **0**.

### A2. Noscript Yandex tracking pixel без размеров

В `prigorody/_template.html` и `prigorody/index.html` tracking pixel получил:

```html
width="1" height="1"
```

После пересборки — применено ко всем 14 страницам пригородов.

### A3. A11y: legacy visual controls на `div/span` с `onclick`

Найдены элементы, которые визуально являются кнопками, но технически были `div/span` с `onclick`:

- `.calc-opt`
- `.calc-biscuit-opt`
- `.calc-result-collapsed`
- `.faq-item`
- `.cb-faq-item`
- `.cart-step`
- `.dot`
- прочие non-native `[onclick]` элементы

Добавлен R11-патч в `js/main.js`:

- автоматически добавляет `role="button"`;
- автоматически добавляет `tabindex="0"`;
- добавляет `aria-label`, если его нет;
- поддерживает клавиатуру: `Enter` / `Space` вызывают `.click()`;
- синхронизирует `aria-pressed` для selected/active контролов;
- использует `MutationObserver`, чтобы работать и с динамически созданными элементами каталога.

Добавлен R11 CSS-патч в `css/premium-overrides.css`:

- видимый premium focus-ring для `[role="button"]`;
- отдельный focus для `.dot`;
- dark-mode focus glow;
- forced-colors mode для Windows High Contrast.

### A4. Cache-bust / Service Worker

Версия поднята до R11:

```js
const CACHE_NAME = 'milovi-cake-v2026.05.16-r11';
```

Все ссылки CSS/JS/favicon обновлены на:

```text
?v=20260516r11
```

---

## Повторная генерация пригородов

Команда:

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

## Итоговый автоматический аудит R11

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

## Таблица проверок R11

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
| Положительный `tabindex` | 0 |
| JSON-LD в финальных HTML | OK |
| Локальные asset-ссылки в финальных HTML | OK |
| Sitemap XML parse | OK |
| Sitemap local targets/images/videos exist | OK |
| CSS braces | OK |
| `node --check js/main.js` | OK |
| `node --check js/nav.js` | OK |
| `node --check js/mc-2026.js` | OK |
| `python3 prigorody/build.py` | OK |
| `id="lightbox"` во всех пригородах | OK |
| Старые cache версии `r8/r9/r10` вне старых audit-файлов | 0 |

---

## Команды проверки

```bash
python3 prigorody/build.py
node --check js/main.js
node --check js/nav.js
node --check js/mc-2026.js
python3 /tmp/r10_audit2.py
```

Дополнительно проверялись:

```bash
# img без размеров
# sitemap.xml + sitemap-videos.xml parse + existence check
# старые cache-bust версии
# CSV-загрязнение HTML-разметкой
```

---

## R11 вывод

R11 — чистый патч поверх R10:

- protected hero-мессенджеры сохранены;
- фото в пригородах сохраняют lightbox;
- CLS-риски на динамических lightbox images закрыты;
- keyboard accessibility для legacy `div/span onclick` усилена;
- Service Worker и cache-bust подняты до R11;
- полный статический аудит — 0 issues.
