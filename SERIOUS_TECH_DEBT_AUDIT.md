# Milovi Cake — Serious Technical Debt Audit

**Дата:** 2026-05-17  
**База проверки:** `main` после r21 cleanup + hotfix 404  
**Текущая версия после стабилизации:** `20260517r23` / `milovi-cake-v2026.05.17-r23`

Этот файл — не список косметики. Здесь только то, что реально может повлиять на кэш, стабильность деплоя, скорость, поддержку темы и будущие правки.

---

## 1. Исправлено сейчас: `js/gallery/data.js` был без cache-bust

### Что было

`gallery/index.html` подключал:

```html
<script type="module" src="/js/gallery/main.js?v=20260517r21"></script>
```

но внутри `js/gallery/main.js` было:

```js
import { GALLERY_ITEMS } from './data.js';
```

То есть `main.js` обновлялся через `?v=...`, а `data.js` — нет. При Service Worker + браузерном HTTP cache это могло дать ситуацию: логика галереи свежая, а список работ/постеров/видео — старый.

### Что сделано

```js
import { GALLERY_ITEMS } from './data.js?v=20260517r23';
```

И в `sw.js` добавлено:

```js
'/js/gallery/data.js?v=20260517r23',
```

Также подняты все версии HTML/SW до `20260517r23` и `CACHE_NAME` до `milovi-cake-v2026.05.17-r23`.

### Почему это важно

`gallery/data.js` — источник правды для 46 работ галереи. Его размер небольшой, но данные меняются чаще визуальной логики. Без query-version это был реальный риск «на GitHub новое, на сайте старое» именно для галереи.

---

## 2. Исправлено сейчас: корневой `audit.py` был ловушкой

### Что было

В репо есть два файла:

- `scripts/audit.py` — канонический аудит, используется `npm run audit`
- `audit.py` в корне — был полной копией `scripts/audit.py`

Внутри аудита:

```py
ROOT = Path(__file__).resolve().parents[1]
```

Для `scripts/audit.py` это правильно: `ROOT = repo`.  
Для корневого `audit.py` это неправильно: `ROOT = parent_of_repo`.

Итог: если агент запускал `python3 audit.py` из корня репо, он получал ложные десятки ошибок: «CSS forbidden», «sw.js not found», «robots.txt not found», broken links и т.п.

### Что сделано

Корневой `audit.py` заменён на wrapper, который безопасно запускает `scripts/audit.py`.

Теперь оба варианта корректны:

```bash
python3 audit.py
python3 scripts/audit.py
npm run audit
```

---

## 2.1. Исправлено сейчас: `audit:prigorody` больше не падает на валидных uncommitted patches

### Что было

Скрипт `npm run audit:prigorody` делал:

```bash
python3 prigorody/build.py && git diff --exit-code prigorody/*/index.html
```

Это хорошо ловит забытый `build.py`, но ломается при нормальном рабочем процессе: если патч уже содержит легитимные изменения сгенерированных пригородов (например глобальный `?v=` bump), `git diff --exit-code` падает даже когда страницы полностью синхронизированы с `_template.html`.

### Что сделано

Добавлен `scripts/check_prigorody_idempotent.py`. Теперь проверка сравнивает generated pages **до и после** запуска `build.py` и падает только если `build.py` реально изменил текущие файлы.

`package.json` обновлён:

```json
"audit:prigorody": "python3 scripts/check_prigorody_idempotent.py"
```

Также `audit:js` теперь проверяет `js/gallery/data.js`, потому что это ESM-модуль с `export`, а не просто текстовый data-файл.

---

## 3. JS budget: проблема не в `gallery/data.js`, а в монолитности `main.js`

### Фактические размеры JS

| Файл | Raw | Gzip | Комментарий |
|---|---:|---:|---|
| `js/main.js` | 146,174 B | 37,648 B | главный вес, 58.7% raw JS |
| `js/nav.js` | 35,831 B | 9,326 B | мобильная навигация |
| `js/gallery/main.js` | 26,169 B | ~8.5 KB | только галерея |
| `js/mc-2026.js` | 15,070 B | 4,212 B | UX/CWV |
| `js/gallery/data.js` | 14,154 B | 2,785 B | данные 46 работ, не главный виновник |
| `js/v20-faq-fix.js` | 11,749 B | 3,306 B | точечная логика FAQ |
| **Итого** | **249,147 B** | **63,236 B** | warning аудита |

### Вывод

`gallery/data.js` добавляет всего **2.8 KB gzip** и грузится только на `/gallery/` через ESM. Это не то место, где надо начинать оптимизацию.

Главное место риска — `js/main.js`:

- 146 KB raw / 37.6 KB gzip;
- грузится на главной и на 14 страницах пригородов;
- содержит каталог, корзину, калькулятор, отзывы, тему, lightbox, wave text, формы, приватность и вспомогательные UX-блоки.

### Серьёзная будущая задача

Не «минифицировать ради цифры», а провести **feature-map** `main.js`:

1. Пометить блоки по страницам: главная / пригороды / общие / только каталог / только калькулятор / только reviews.
2. Внутри текущего файла добавить строгие DOM-gates, чтобы тяжёлые блоки не инициализировались на страницах, где нет нужных DOM-узлов.
3. Если владелец разрешит нарушение текущего запрета на новые JS-файлы — вынести крупные независимые подсистемы в отдельные page-specific файлы. Без разрешения новые JS не создавать.

### Самые крупные блоки `js/main.js` по строкам

| Блок | Строки | Размер блока |
|---|---:|---:|
| `toggleCart` | 722–832 | 111 строк |
| `switchReviewsTab` | 1705–1792 | 88 строк |
| `addCalcToCart` | 2081–2163 | 83 строки |
| `renderCatalog` | 156–224 | 69 строк |
| `initApp` | 1011–1073 | 63 строки |
| `updateCartUI` | 454–512 | 59 строк |
| `updateCalc` | 1291–1342 | 52 строки |

Эти блоки — первые кандидаты на карту зависимостей, но не на механическое переписывание.

---

## 4. `!important`: это не одна проблема, а симптом каскадной войны

### Фактические счётчики

| CSS-файл | `!important` |
|---|---:|
| `css/premium-overrides.css` | 658 |
| `css/v20-dark-and-fixes.css` | 600 |
| `css/style.css` | 133 |
| `css/mc-2026.css` | 107 |
| `css/final-fixes.css` | 82 |
| `css/gallery/gallery-2026.css` | 24 |
| `css/v20-fixes.css` | 10 |
| **Итого** | **1614** |

### Где реальный риск

Не само число, а концентрация:

- `premium-overrides.css` + `v20-dark-and-fixes.css` = **1258 important** из 1614;
- топ-свойства: `background`, `color`, `border-color`, `box-shadow`, `padding`, `transform`;
- это означает, что тема и премиум-оверрайды часто не управляются токенами, а перебивают друг друга силой.

### Почему нельзя «просто удалить important»

В проекте есть защищённые блоки hero/messenger/lightbox/footer/theme. Массовое удаление `!important` почти наверняка даст регресс визуала и мобильной навигации. Нужна не чистка счётчика, а нормализация каскада.

### Серьёзная будущая задача

1. Начать не с удаления, а с карты слоёв:
   - base: `style.css`
   - UX: `mc-2026.css`
   - protected/final overrides: `premium-overrides.css`
   - dark theme: `v20-dark-and-fixes.css`
   - hotfixes: `v20-fixes.css`, `final-fixes.css`
2. Для тёмной темы отдельно вынести повторяющиеся `background/color/border-color/box-shadow` в токены `[data-theme="dark"]`.
3. Работать по одному компоненту за раз: nav, cards, FAQ, cart, reviews, hero CTA. Не трогать всё сразу.
4. После каждого компонента проверять desktop/mobile + dark/light + protected hero messenger hover.

### Порог, к которому реально стремиться

Не «0 important». Реалистичная цель первого этапа:

- `premium-overrides.css`: 658 → ~350;
- `v20-dark-and-fixes.css`: 600 → ~250;
- оставить `important` только на protected/edge cases с комментарием причины.

---

## 5. Hardcoded colors: риск для тёмной темы выше, чем кажется

### Фактические данные

| Файл | Hex occurrences | Unique hex | RGB/RGBA occurrences |
|---|---:|---:|---:|
| `css/style.css` | 360 | 142 | 681 |
| `css/premium-overrides.css` | 202 | 56 | 427 |
| `css/v20-dark-and-fixes.css` | 233 | 51 | 256 |

### Почему это серьёзно

AGENTS §4.3 требует цвета через токены. Сейчас в трёх ключевых CSS-файлах много прямых цветов. Это увеличивает риск:

- светлая тема поправлена, тёмная ломается;
- один gold/brown оттенок меняется в одном месте, но остаётся старым в другом;
- приходится добавлять ещё `!important`, потому что токенов не хватает.

### Будущая задача

Сначала инвентаризировать и сгруппировать не все цвета, а только функциональные группы:

- brand gold / gold hover / gold muted;
- card background / elevated background;
- text primary / muted / inverse;
- border soft / border accent;
- shadow warm / shadow dark.

После этого переносить в `:root` и `[data-theme="dark"]`. Без такой карты простая замена hex → var может сломать контраст.

---

## 6. Gallery media: не JS-budget, но весовая зона риска

В репо есть 16 `.webm` видео галереи. Самые крупные:

- `video-01-knigi.webm` — ~2.5 MB;
- `video-14-blue-balloons.webm` — ~2.3 MB;
- несколько видео 1.6–1.8 MB.

Сейчас галерея использует `IntersectionObserver`, lazy/metadata и не грузится на главной. Это хорошо.

Серьёзная будущая задача — не переписывать JS, а проверить фактический waterfall на `/gallery/`:

- сколько видео стартует при первом экране;
- не делает ли autoplay лишнюю сетевую нагрузку на мобильных;
- нужны ли более лёгкие poster/preview или короткие preview-версии для первых 8 карточек.

Это важнее, чем экономить 14 KB raw в `gallery/data.js`.

---

## 7. Что НЕ стоит делать

- Не начинать с массового удаления `!important`.
- Не дробить CSS/JS без согласования, потому что AGENTS запрещает новые CSS/JS-файлы.
- Не трогать protected hero messenger, R10/R15, buildCartKey/parseCartKey и lightbox пригородов.
- Не считать `gallery/data.js` главным виновником JS budget — это ложный фокус.

---

## 8. Текущий статус после стабилизации

Проверено:

```bash
npm run audit:all
python3 audit.py
python3 scripts/audit.py
node --check js/main.js js/nav.js js/mc-2026.js js/v20-faq-fix.js js/gallery/main.js js/gallery/data.js sw.js
python3 scripts/check_prigorody_idempotent.py
```

Результат:

- official audit: **33 passed / 10 warnings / 0 errors**;
- root audit wrapper: работает;
- JS syntax: все файлы валидны;
- пригороды: 14 страниц генерируются без diff;
- версии: **213 вхождения `?v=20260517r23`**, все синхронны;
- Service Worker: `CACHE_NAME = milovi-cake-v2026.05.17-r23`, PRECACHE = 21 URL + video/range bypass.

---

## 9. r23 — первый реальный шаг по performance/stability без ломки архитектуры

Сделано после этого аудита:

1. **SW video/range bypass** — Service Worker больше не runtime-cache-ит `.webm/mp4/mov/m4v` и Range-запросы. Это снижает риск раздувания Cache Storage из-за галереи и сохраняет нативное поведение потокового видео.
2. **Gallery video lazy network** — первые видео-карточки больше не получают `src` сразу. Видео остаются с poster и начинают грузиться через существующий `IntersectionObserver`, когда попадают близко к viewport.
3. **Audit guardrails** — `scripts/audit.py` теперь проверяет:
   - ESM relative imports должны иметь `?v=`;
   - SW должен иметь video/range bypass.

Это специально выбранный первый шаг: он не трогает защищённые visual-блоки, не дробит JS/CSS и не переписывает галерею, но убирает реальный источник нестабильности кэша и лишней сетевой нагрузки.
