# Milovi Cake — R10 Audit / Patch Report

Дата: 2026-05-16  
Режим проверки: «Google + Apple senior-level QA» для статического сайта без сборщика.

---

## Главный protected-фокус R10

Зафиксирован и защищён дизайн hero-мессенджеров на главной:

- WhatsApp / Telegram / MAX — круглые inline-SVG иконки.
- Название мессенджера идёт по кольцу внутри SVG.
- При hover плоское название подлетает вверх.
- Кольцевой текст мягко приглушается.
- Цвета строго брендовые:
  - WhatsApp: `#25D366`;
  - Telegram: `#229ED9`;
  - MAX: `#7B5EE8` / `#8e74ee`.

Это дополнительно прописано в:

- `AI_DO_NOT_TOUCH_GUARDRAILS.md`
- `llms.txt`
- комментариях в `index.html`
- комментариях в `prigorody/_template.html`
- protected-комментарии в `css/premium-overrides.css`

---

## Что исправлено в R10

### 1. Критичный баг в `prigorody/_cities.csv`

Найден скрытый источник дублей на страницах пригородов: поле `section_sub` в CSV было загрязнено HTML-разметкой старых секций:

- второй `catalogGrid`;
- второй `section id="why"`;
- второй `section id="reviews"`.

Из-за этого после генерации в `prigorody/<city>/index.html` появлялись duplicate ID:

- `catalogGrid`
- `why`
- `reviews`

Исправлено:

- `prigorody/_cities.csv` очищен;
- все 14 страниц пригородов пересобраны через `python3 prigorody/build.py`;
- duplicate ID устранены.

### 2. Пригороды — открытие фото тортов

В `prigorody/_template.html` добавлен обязательный catalog lightbox:

```html
<div class="lightbox" id="lightbox">
```

После пересборки он есть на всех 14 страницах пригородов.  
Это нужно для работы `openLightbox()` из `js/main.js`.

### 3. Главная — hero-мессенджеры

В `index.html` hero-мессенджеры приведены к эталонному ring-SVG стилю:

- `messenger-group--ring`
- `btn-hero-ring`
- `.hero-ring-text`
- `.hero-flat-text`
- уникальные path-id: `ring-path-wa-main`, `ring-path-tg-main`, `ring-path-max-main`

### 4. CSS protected layer

В `css/premium-overrides.css` добавлен protected-блок R9/R10:

- восстанавливает кольцевые hero-мессенджеры;
- фиксирует брендовые цвета;
- фиксирует hover-анимацию с подлётом названия;
- делает delivery-блок в пригородах отдельными 3D-квадратами;
- улучшает тёмную тему: премиальные чёрные карточки, мягкое gold-glow, читаемый текст.

### 5. Service Worker / cache bust

Версия поднята до R10:

```js
const CACHE_NAME = 'milovi-cake-v2026.05.16-r10';
```

Все CSS/JS/Favicon версии обновлены на:

```text
?v=20260516r10
```

---

## Проверенные файлы

Проверены:

- HTML: 24 файла;
- JS: 11 файлов;
- CSS: 4 файла;
- CSV-генератор пригородов;
- Service Worker;
- шаблон пригородов;
- все 14 сгенерированных страниц пригородов.

---

## Sanity-check R10

Итог автоматического аудита:

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

| Проверка | Результат |
|---|---:|
| `<button>` без `type` в HTML | 0 |
| `<button>` без `type` в JS template strings | 0 |
| `<a target="_blank">` без `noopener` | 0 |
| `<img>` без `alt` | 0 |
| Duplicate ID в HTML | 0 |
| Положительный `tabindex` | 0 |
| JSON-LD валидность в финальных HTML | OK |
| Локальные asset-ссылки в финальных HTML | OK |
| CSS brace balance | OK |
| `node --check js/main.js` | OK |
| `node --check js/nav.js` | OK |
| `node --check js/mc-2026.js` | OK |
| `python3 prigorody/build.py` | 14 файлов, 0 ошибок |
| `id="lightbox"` во всех пригородах | OK |
| Старые версии `20260516r8/r9` вне аудита | 0 |
| CSV-загрязнение HTML-разметкой | 0 |

---

## Команды проверки

```bash
python3 prigorody/build.py
node --check js/main.js
node --check js/nav.js
node --check js/mc-2026.js
grep -R "20260516r8\|20260516r9\|v2026\.05\.16-r8\|v2026\.05\.16-r9" -n --exclude=Milovi_Cake_r8_AUDIT.md .
```

Дополнительно запускался кастомный статический аудит по HTML/CSS/JS/локальным ссылкам.

---

## Важное предупреждение будущим ИИ

НЕ ТРОГАТЬ hero-мессенджеры главной без прямого указания владельца.  
Это защищённый UI-паттерн R10: круглые SVG, кольцевое название, hover-подлёт, брендовые цвета.

НЕ править `prigorody/<city>/index.html` вручную.  
Править только `_template.html` / `_cities.csv`, затем пересобирать.
