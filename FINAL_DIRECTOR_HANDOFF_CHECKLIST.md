# Milovi Cake — Final Director Handoff Checklist

Дата: 2026-05-16  
Версия сдачи: R16 / `20260516r16` / `milovi-cake-v2026.05.16-r16`

---

## 1. Protected UI — не менять

### Главная: WhatsApp / Telegram / MAX

- Круглые inline-SVG иконки.
- Кольцевое название внутри SVG.
- Hover: плоское название заметно подлетает вверх.
- Цвета брендовые:
  - WhatsApp — `#25D366`;
  - Telegram — `#229ED9`;
  - MAX — `#7B5EE8` / `#8e74ee`.
- Не заменять на белые кнопки / pill-кнопки / текстовые ссылки.
- Не удалять fallback в `js/main.js` для `.hero-ring-text` / `.hero-flat-text`.

### Контакты

- SVG-трубка в `#contacts .contact-primary-icon` — чисто чёрная с мягкой подсветкой.
- Не возвращать белую трубку.
- Footer-контакты — нейтральные premium chips, без случайных ярких цветов WhatsApp/Telegram.

### Типографика

- `.hero-subtitle`, `.section-sub` и родственные описательные тексты — мягкий `Cormorant Garamond`, `font-style: normal`.
- Курсив не использовать.
- Не возвращать «квадратный» грубый sans для этих текстов без согласования.

---

## 2. Обязательные команды перед деплоем

```bash
python3 prigorody/build.py
node --check js/main.js
node --check js/nav.js
node --check js/mc-2026.js
```

---

## 3. Обязательные ручные проверки в браузере

### Desktop

- Главная: hover WhatsApp / Telegram / MAX — название подлетает высоко.
- Главная: цвета мессенджеров брендовые, не белые.
- Контакты: телефонная трубка чёрная, без белого бага.
- Footer: телефон / WhatsApp / Telegram выглядят спокойно, как premium chips.
- Lightbox каталога открывает фото тортов.
- Корзина открывается/закрывается.
- Форма заказа открывает WhatsApp-сообщение.

### Mobile

- Нижний TOC `#mcNav` не перекрывает калькулятор.
- TOC sheet `#mcSheet` плавно открывается, фокус и Escape работают.
- Burger/fullscreen menu выглядит premium и не ломает скролл.
- Калькулятор: bottom-sheet цены раскрывается удобно, CTA доступен.
- Фото тортов в пригородах открываются в lightbox.
- Тёмная тема: карточки не яркие, текст читаемый.

---

## 4. Service Worker после деплоя

После выкладки R16 рекомендуется:

DevTools → Application → Service Workers → Unregister / Update

Проверить, что активна версия:

```text
milovi-cake-v2026.05.16-r16
```

---

## 5. Статус автоматической проверки R16

Финальный аудит:

```json
{
  "html_files": 24,
  "js_files": 11,
  "css_files": 4,
  "issues_total": 0,
  "issues_by_type": {}
}
```

Проверки:

- HTML parse errors: 0
- Duplicate ID: 0
- `<button>` без `type`: 0
- `target="_blank"` без `noopener`: 0
- `<img>` без `alt`: 0
- `<img>` без `width/height`: 0
- JS syntax: OK
- CSS braces: OK
- Sitemap targets: OK
- Product images exist: OK
- Old cache versions outside old audit files: 0
