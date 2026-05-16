# Milovi Cake — R16 Final Apple/Google QA Report

Дата: 2026-05-16  
Статус: финальная всесторонняя перепроверка после R15 перед сдачей директору.

---

## Что сделано в R16

R16 — это финальный контрольный релиз без визуальной реформы после R15:

- перепроверены HTML / CSS / JS / sitemap / robots / docs;
- проверены protected-решения R15;
- обновлён cache-bust до R16;
- обновлён `FINAL_DIRECTOR_HANDOFF_CHECKLIST.md` до R16;
- перепроверены `AI_DO_NOT_TOUCH_GUARDRAILS.md` и `llms.txt`;
- пересобраны все страницы пригородов.

---

## Cache-bust / Service Worker

Версия поднята до R16:

```js
const CACHE_NAME = 'milovi-cake-v2026.05.16-r16';
```

Все CSS/JS/favicon ссылки обновлены:

```text
?v=20260516r16
```

Старые cache-версии `r8-r15` вне исторических audit-файлов: **0**.

---

## Protected UI — проверено

### Главная: WhatsApp / Telegram / MAX

Проверено наличие защищённых элементов в `index.html`:

- `messenger-group--ring` — OK;
- `btn-hero-ring` — OK;
- `.hero-ring-text` — OK;
- `.hero-flat-text` — OK;
- `ring-path-wa-main` — OK;
- `ring-path-tg-main` — OK;
- `ring-path-max-main` — OK.

Проверено наличие R15 JS fallback в `js/main.js`:

```js
btn.querySelector('.hero-ring-text, [id^="ring-text-"]')
btn.querySelector('.hero-flat-text, [id^="flat-text-"]')
```

### Контакты

Проверено наличие R15 CSS-фиксов:

- чёрная SVG-трубка в `#contacts .contact-primary-icon svg` — OK;
- footer neutral premium chips — OK;
- hero messenger high-lift CSS — OK;
- softer subtitle typography — OK.

---

## Документы

Проверены и/или обновлены:

- `AI_DO_NOT_TOUCH_GUARDRAILS.md` — содержит protected UI rules + R15 visual decisions.
- `llms.txt` — содержит правила для будущих AI-агентов.
- `FINAL_DIRECTOR_HANDOFF_CHECKLIST.md` — обновлён до R16.
- `Milovi_Cake_r15_AUDIT.md` — исторический отчёт R15.
- `Milovi_Cake_r16_FINAL_QA.md` — текущий финальный отчёт.

---

## Проверка indexability / sitemap / robots

Проверено:

- indexable HTML-страницы присутствуют в `sitemap.xml`;
- `noindex` страницы не обязаны быть в sitemap;
- `call/index.html` имеет `noindex, nofollow` и намеренно не включается в sitemap;
- `404.html` имеет `noindex`;
- `robots.txt` содержит ссылку на sitemap;
- `sitemap.xml` и `sitemap-videos.xml` корректно парсятся XML-парсером;
- все sitemap targets / images / videos существуют в репозитории.

Результат: indexability issues — **0**.

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

## Итоговый автоматический аудит R16

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

## Таблица проверок R16

| Проверка | Результат |
|---|---:|
| HTML-файлов проверено | 24 |
| JS-файлов проверено | 11 |
| CSS-файлов проверено | 4 |
| HTML parse errors через lxml | 0 |
| `<button>` без `type` в HTML | 0 |
| `<button>` без `type` в JS template strings | 0 |
| `<a target="_blank">` без `noopener` | 0 |
| `<img>` без `alt` | 0 |
| `<img>` без `width/height` | 0 |
| Duplicate ID | 0 |
| Положительный `tabindex` в исходном HTML | 0 |
| JSON-LD в финальных HTML | OK |
| Локальные asset-ссылки в финальных HTML | OK |
| Inline handler missing functions | 0 |
| CSS brace balance | OK |
| `node --check js/main.js` | OK |
| `node --check js/nav.js` | OK |
| `node --check js/mc-2026.js` | OK |
| `python3 prigorody/build.py` | OK |
| `sitemap.xml` parse | OK |
| `sitemap-videos.xml` parse | OK |
| Sitemap local targets exist | OK |
| Indexability issues | 0 |
| Protected hero messenger markup | OK |
| R15 contacts/typography fixes present | OK |
| Старые cache версии `r8-r15` вне исторических audit-файлов | 0 |

---

## Команды финальной проверки

```bash
python3 prigorody/build.py
node --check js/main.js
node --check js/nav.js
node --check js/mc-2026.js
python3 /tmp/r10_audit2.py
```

Дополнительно запускались проверки:

```bash
# old cache version references
# protected hero markup presence
# R15 contacts CSS presence
# HTML parse via lxml
# sitemap/indexability audit
# CSS brace balance
# inline handler resolution
```

---

## R16 вывод

R16 готов к передаче директору:

- protected UI сохранён;
- R15 визуальные правки контактов/hero/типографики сохранены;
- документация дополнена;
- sitemap/indexability проверены;
- cache-bust поднят до R16;
- все автопроверки зелёные;
- архив можно отдавать на деплой.
