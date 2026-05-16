# Milovi Cake — R15 Contacts / Hero Messengers / Typography Polish

Дата: 2026-05-16  
Статус: R15 после точечных правок по замечаниям владельца.

---

## Что исправлено в R15

### 1. Контакты — SVG-трубка телефона

Проблема: в блоке контактов SVG-трубка телефона выглядела забагованной/белой.

Исправлено в `css/premium-overrides.css` блоком R15:

- иконка телефона принудительно стала чисто чёрной;
- добавлена аккуратная премиальная подсветка и тень;
- контейнер иконки получил мягкий cream/gold radial background;
- hover/focus делает иконку чуть глубже, без белого бага;
- dark theme тоже обработана: иконка остаётся графически чёткой в светлой капсуле.

Ключевые селекторы:

```css
#contacts .contact-primary-icon
#contacts .contact-primary-icon svg
#contacts .contact-primary-item:hover .contact-primary-icon
```

### 2. Footer contacts — телефон / WhatsApp / Telegram

Проблема: в нижнем блоке контактов телефон, WhatsApp и Telegram выглядели странно окрашенными и нестильно.

Исправлено:

- убраны случайно выглядящие цветные акценты;
- ссылки сделаны нейтральными premium chips;
- телефон чуть выделен, но без кричащего цвета;
- WhatsApp/Telegram в footer стали спокойными, едиными по стилю;
- добавлены мягкие hover/focus состояния;
- часы и адрес получили спокойный muted tone.

Ключевые селекторы:

```css
.site-footer .footer-col address
.site-footer .footer-col address a
.site-footer .footer-col address a[href^="tel"]
.site-footer .footer-col address a[href*="wa.me"]
.site-footer .footer-col address a[href*="t.me"]
```

### 3. Главная — подлёт надписей WhatsApp / Telegram / MAX

Проблема: на главной надписи WhatsApp / Telegram / MAX почти не подлетали, в отличие от пригородов.

Причина: анимационный JS искал `id="ring-text-wa"` / `id="flat-text-wa"`, а на главной R10 использует class-based protected SVG markup (`.hero-ring-text`, `.hero-flat-text`). Поэтому главная получала только слабый CSS hover.

Исправлено в `js/main.js`:

```js
var ringEl = document.getElementById(item.ringId) || btn.querySelector('.hero-ring-text, [id^="ring-text-"]');
var flatEl = document.getElementById(item.flatId) || btn.querySelector('.hero-flat-text, [id^="flat-text-"]');
```

Дополнительно усилен подъём:

```js
flatY: -16
ringY: -20
```

И добавлен CSS-патч:

```css
.hero-actions .btn-hero-messenger:hover .hero-flat-text,
.hero-actions .btn-hero-messenger:hover [id^="flat-text-"] {
  transform: translateY(-13px) !important;
}
```

Теперь главная и пригороды используют одинаково премиальный высокий подлёт.

### 4. Типографика hero/subtitle текстов

Проблема: текст вроде:

> Авторские торты ручной работы от частного кондитера в Санкт-Петербурге

выглядел квадратно и неинтересно.

Исправлено без курсива:

- для hero subtitle и ключевых subtitle-текстов применён `Cormorant Garamond`;
- font-style остаётся normal;
- увеличена мягкость через line-height, kerning, ligatures;
- меньше «квадратности», больше премиального editorial feeling;
- адаптировано под мобильный размер;
- dark theme получила отдельный цвет.

Ключевые селекторы:

```css
.hero-subtitle
.section-sub
.about-section .section-sub
#contacts .section-sub
.meringue-promo__text
.mr-cities__sub
.local-context__text
```

---

## Protected UI сохранён

Главная — WhatsApp / Telegram / MAX:

- круглые inline-SVG иконки сохранены;
- кольцевое название сохранено;
- hover-подлёт стал выше и исправлен;
- брендовые цвета сохранены:
  - WhatsApp — `#25D366`;
  - Telegram — `#229ED9`;
  - MAX — `#7B5EE8` / `#8e74ee`.

---

## Cache-bust / Service Worker

Версия поднята до R15:

```js
const CACHE_NAME = 'milovi-cake-v2026.05.16-r15';
```

Все CSS/JS/favicon ссылки обновлены:

```text
?v=20260516r15
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

## Итоговый аудит R15

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

## Таблица проверок R15

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
| R15 CSS contacts/typography block present | OK |
| R15 JS class-based hero messenger fallback present | OK |
| Старые cache версии `r8-r14` вне старых audit-файлов | 0 |

---

## R15 вывод

R15 закрывает конкретные визуальные замечания:

- телефонная SVG-трубка в контактах стала чистой чёрной с премиальной подсветкой;
- footer контакты стали спокойными и стильными, без странных цветовых пятен;
- hero-мессенджеры на главной снова подлетают высоко как в пригородах;
- subtitle/описательные заголовки стали мягче, менее квадратными, без курсива;
- полный статический аудит — 0 issues.
