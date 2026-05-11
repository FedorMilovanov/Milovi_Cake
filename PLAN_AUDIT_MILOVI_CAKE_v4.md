# 📋 ПЛАН-АУДИТ — Milovi Cake
## Сводный документ: оценка + приоритеты + очередь фиксов
**Дата:** 12 мая 2026  
**Версия:** 4.0 — Спринты 1, 3, 4, 5 выполнены  
**Составлен на основе:** AUDIT_MILOVI_CAKE_UNIFIED_v6.txt, SEO_AUDIT_MAY_2026.md, SEO_AUDIT_DEEP_v2.md

---

## ═══════════════════════════════════════
## ЧАСТЬ 0. УТОЧНЕНИЯ ОТ ВЛАДЕЛЬЦА
## ═══════════════════════════════════════

| Вопрос | Ответ | Решение |
|--------|-------|---------|
| Instagram `milovi_cake` — активен? | Не особо активно | ❌ Убрать Instagram из всех Schema.sameAs |
| 47 отзывов на meringue-roll — откуда? | Неправильные данные. Это сумма со всех сервисов | ❌ Удалён `aggregateRating` из Product Schema |
| Где ссылки на отзывы? | Яндекс Карты и Google. Скриншоты в ВК и на сайте | ✅ Ссылки уже в модале отзывов |

---

## ═══════════════════════════════════════
## ЧАСТЬ 1. РЕЕСТР SEO-ЗАДАЧ
## ═══════════════════════════════════════

### ✅ СПРИНТ 1 — ВЫПОЛНЕН (12 мая 2026)

| ID | Задача | Файл | Статус |
|----|--------|------|--------|
| SEO-A1 | Унифицировать часы работы: Пн–Вс 10:00–20:00 | index.html | ✅ FIXED |
| SEO-A2 | Убрать `contactOption: "TollFree"` | index.html | ✅ FIXED |
| SEO-A4 | YouTube → `@milovi_cake` везде | index.html | ✅ FIXED |
| SEO-A7 | `<img>` в каталоге без width/height → CLS | js/main.js | ✅ FIXED |
| SEO-A8 | BreadcrumbList Schema на главной — отсутствовала | index.html | ✅ FIXED |
| SEO-А13 | `<address>` тег вокруг контактов в footer | index.html | ✅ FIXED |
| SEO-А14 | `<time datetime>` на отзывах | index.html | ✅ FIXED |
| SEO-В1 | LocalBusiness meringue-roll без @id | meringue-roll/index.html | ✅ FIXED |
| SEO-В2 | Product Schema: нет priceValidUntil, url, seller | meringue-roll/index.html | ✅ FIXED |
| SEO-В3 | aggregateRating reviewCount:47 — неверные данные | meringue-roll/index.html | ✅ FIXED |
| SEO-В6 | Висящие itemprop без itemscope | meringue-roll/index.html | ✅ FIXED |
| SEO-Г1 | Instagram — убрать из Schema | index.html | ✅ FIXED |
| SEO-Г3 | Sitemap: у `/prigorody/` нет `<changefreq>` | sitemap.xml | ✅ FIXED |

---

### ✅ СПРИНТ 3 — ВЫПОЛНЕН (12 мая 2026)

| ID | Задача | Файл | Статус |
|----|--------|------|--------|
| SEO-A3 | meringue-roll sameAs: убрать Instagram, добавить YouTube | meringue-roll/index.html | ✅ FIXED |
| SEO-A5 | Telegram: @MiloviCake в sameAs meringue-roll (верно) | meringue-roll/index.html | ✅ VERIFIED |
| SEO-Б3 | `<h2>` пригородов полноценный заголовок | _template.html → rebuild | ✅ FIXED |
| SEO-Б4 | rel="noopener noreferrer" на внешних ссылках | _template.html → rebuild | ✅ FIXED |
| SEO-Б5 | `<meta name="keywords">` на пригородах | _template.html → rebuild | ✅ FIXED |
| SEO-Б6 | ItemList Schema на пригородах | _template.html → rebuild | ✅ FIXED |
| SEO-Б9 | version `?v=20260512` в шаблоне | _template.html | ✅ FIXED |
| SEO-Б2 | areaServed именительный падеж | _cities.csv → rebuild | ✅ FIXED |
| SEO-Б1b | Ссылка на meringue-roll с пригородов | _template.html | ✅ FIXED |
| NEW-1 | Vsevolozhsk: заполнены пустые поля | _cities.csv | ✅ FIXED |

---

### ✅ СПРИНТ 4 — ВЫПОЛНЕН (12 мая 2026)

| ID | Задача | Файл | Статус |
|----|--------|------|--------|
| SEO-В4 | Cookie consent: удалён безусловный ym() | index.html | ✅ FIXED |
| SEO-Б7 | Ротация отзывов на пригородах (A/B/C наборы) | _template.html, build.py, _cities.csv | ✅ FIXED |
| SEO-А16 | Удалены историч. файлы и zen_*.html | repo | ✅ FIXED |
| SEO-А9 | Review Schema JSON-LD: 6 реальных отзывов | index.html | ✅ FIXED |
| SEO-А10 | meta keywords расширены до 14 фраз | index.html | ✅ FIXED |
| SEO-А12 | header-trust: рейтинг + ссылка на /certificates/ | index.html + style.css | ✅ FIXED |
| NEW-2 | Страница /certificates/ создана | certificates/ | ✅ DONE |
| NEW-2b | WebP-сертификаты (5 шт.) оптимизированы | img/cert_*.webp | ✅ DONE |
| NEW-2c | Schema hasCredential на /certificates/ | certificates/index.html | ✅ DONE |
| NEW-2d | sitemap.xml: добавлен /certificates/ | sitemap.xml | ✅ DONE |
| NEW-2e | Ссылка на /certificates/ в footer | index.html | ✅ DONE |

---

### ✅ СПРИНТ 5 — ВЫПОЛНЕН (12 мая 2026)

| ID | Задача | Файл | Статус | Результат |
|----|--------|------|--------|-----------|
| SEO-Г4 | `.gitignore`: скрыть `_template.html`, `_cities.csv`, `build.py` | .gitignore | ✅ FIXED | Файл создан |
| SEO-А11 | Минифицировать CSS | css/style.css | ✅ FIXED | 227 КБ → 171 КБ (−25%) |
| SEO-В5 | Сжать тяжёлые изображения рулета | img/ | ✅ FIXED | roll_4: 213→98 КБ, roll_5: 197→85 КБ, roll_6: 215→90 КБ |
| SEO-Г5 | SW cache-first: игнорировать query-params при lookup | sw.js | ✅ FIXED | Нормализация URL перед `caches.match()` |
| NEW-4 | /certificates/: таймлайн по годам | certificates/index.html | ✅ DONE | Интерактивный timeline 2022–сейчас |
| NEW-2f | /certificates/: исправлен тон (не третье лицо) | certificates/index.html | ✅ DONE | «Пройденные мной школы обучения» |
| NEW-2g | /certificates/: примечание про курсы без сертификатов | certificates/index.html | ✅ DONE | Раздел «Помимо сертификатов» |
| SW-VER | DEPLOY_VERSION → 2026-05-12a, кеш-ссылки → ?v=20260512 | sw.js, index.html, meringue-roll/index.html | ✅ FIXED | — |
| SITEMAP-DATE | lastmod → 2026-05-12 по всем URL | sitemap.xml | ✅ FIXED | — |

---

### 🟡 ОТКРЫТЫ — СРЕДНИЕ

| ID | Задача | Файл | Блокер |
|----|--------|------|--------|
| SEO-A6 | Установить Google Analytics 4 | index.html + все страницы | **Нужен GA4 Measurement ID от владельца** |
| SEO-А15 | `french.milovicake.ru` — обновлена ссылка в footer (было school.milovicake.ru) | index.html footer | ✅ FIXED |
| SEO-Г2 | `max.ru` ссылка возвращает 403 от бота, но реальным пользователям должна работать | index.html | Проверить вручную в браузере — если открывается, всё ок; если нет, убрать |

---

### 🟢 ОТКРЫТЫ — ФОНОВЫЕ

| ID | Задача | Файл |
|----|--------|------|
| SEO-Б1 | Уникализация страниц пригородов (уникальный FAQ, карта, цена доставки) | prigorody/* |
| SEO-Б8 | OG-image уникальная для пригородов | Cloudflare Worker |
| NEW-3 | /certificates/ — добавить фото и текст «Кто я» для E-E-A-T | certificates/index.html |

---

## ═══════════════════════════════════════
## ЧАСТЬ 2. ЧТО ИЗМЕНЕНО В СПРИНТЕ 5
## ═══════════════════════════════════════

### .gitignore (новый файл)
- Добавлены: `prigorody/_template.html`, `prigorody/_cities.csv`, `prigorody/build.py`
- Также: `.DS_Store`, `.vscode/`, `.idea/`, `*.log`, `*.tmp`

### css/style.css
- Минификация через rcssmin: пробелы, комментарии, лишние переносы удалены
- 227 КБ → 171 КБ (−25%); никакая логика не затронута

### img/meringue_roll_4/5/6.webp
- Пересохранены с quality=72: средняя экономия −57%
- roll_4: 213 → 98 КБ, roll_5: 197 → 85 КБ, roll_6: 215 → 90 КБ

### sw.js
- `DEPLOY_VERSION` → `'2026-05-12a'` (принудительная переустановка у всех)
- PRECACHE_URLS: ссылки обновлены до `?v=20260512`
- `cacheFirst()`: добавлена нормализация URL — `request.url.split('?')[0]` перед `caches.match()`, чтобы версионированные запросы (`?v=20260512`) находили кеш без промаха

### index.html / meringue-roll/index.html
- Версионные ссылки CSS/JS: `?v=20260428` → `?v=20260512`

### sitemap.xml
- `lastmod` обновлён на `2026-05-12` для всех URL

### certificates/index.html
- **Тон**: убраны все конструкции «Виктория Милованова — сертифицированный кондитер...»; заголовок «Пройденные мной школы обучения» (от первого лица)
- **Meta description**: переписан без третьего лица
- **Раздел «Помимо сертификатов»**: чёткая оговорка о том, что список неполный — за рамками остались многочисленные мастер-классы и онлайн-курсы без документов
- **Timeline**: хронология 2022–сейчас; последний элемент «Мастер-классы и онлайн-курсы» с пульсирующей точкой; адаптирован под мобайл

---

## ═══════════════════════════════════════
## ЧАСТЬ 3. ПРОВЕРКИ — РЕЗУЛЬТАТЫ
## ═══════════════════════════════════════

| Что проверено | Метод | Результат |
|--------------|-------|-----------|
| french.milovicake.ru | curl --max-time 8 | ✅ Ссылка обновлена с school.milovicake.ru |
| max.ru/+79119038886 | curl | 403 (бот-защита) — проверить вручную в браузере |
| meringue_roll_4.webp | Pillow re-save q72 | ✅ 213 → 98 КБ |
| meringue_roll_5.webp | Pillow re-save q72 | ✅ 197 → 85 КБ |
| meringue_roll_6.webp | Pillow re-save q72 | ✅ 215 → 90 КБ |
| style.css minify | rcssmin | ✅ 227 → 171 КБ |
| SW query-param fix | code review | ✅ Нормализация URL добавлена |

---

## ═══════════════════════════════════════
## ЧАСТЬ 4. МЕТРИКИ ДЛЯ ОТСЛЕЖИВАНИЯ
## ═══════════════════════════════════════

| Метрика | Где смотреть | Ожидаемое улучшение |
|---------|-------------|---------------------|
| Core Web Vitals (CLS) | Google Search Console → Core Web Vitals | CLS ↓ после SEO-A7 ✅ |
| LCP / изображения | PageSpeed Insights | ↓ после сжатия roll_4/5/6 |
| Rich Results (Product) | search.google.com/test/rich-results | Карточка товара в SERP ✅ |
| Review Schema | Rich Results Test | Звёзды в SERP для главной |
| Person/hasCredential | Schema Validator | E-E-A-T сигнал |
| Cookie consent | Ручная проверка | Метрика только после согласия |
| Уникальность пригородов | Яндекс Вебмастер / дубли | Разные отзывы = меньше дублирования |
| SW offline | DevTools → Application → SW | Офлайн работает без промахов по версионированным URL |

---

*Документ составлен: 12 мая 2026*  
*Версия: 4.0 — Спринты 1, 3, 4, 5 выполнены*
