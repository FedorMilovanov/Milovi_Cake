# 📋 ПЛАН-АУДИТ — Milovi Cake
## Сводный документ: оценка + приоритеты + очередь фиксов
**Дата:** 12 мая 2026  
**Версия:** 3.0 — Спринты 1, 3, 4 выполнены  
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
| SEO-В4 | Cookie consent: удалён безусловный ym() из index.html; теперь только через main.js после согласия | index.html | ✅ FIXED |
| SEO-Б7 | Ротация отзывов на пригородах: 3 набора (A/B/C), каждый из 2 Яндекс + 2 Google; column `review_set` в CSV | _template.html, build.py, _cities.csv → rebuild | ✅ FIXED |
| SEO-А16 | Удалены: HISTORICAL_FINDINGS.md ×3, HISTORICAL_VERIFICATION.md, zen_*.html | repo | ✅ FIXED |
| SEO-А9 | Review Schema JSON-LD добавлена в index.html (6 реальных отзывов с авторами и датами) | index.html | ✅ FIXED |
| SEO-А10 | meta keywords расширены до 14 ключевых фраз | index.html | ✅ FIXED |
| SEO-А12 | header-trust div заполнен: рейтинг + ссылка на /certificates/ | index.html + style.css | ✅ FIXED |
| NEW-2 | Страница сертификатов /certificates/index.html создана | certificates/ | ✅ DONE |
| NEW-2b | WebP-изображения сертификатов (5 шт.) обрезаны и оптимизированы | img/cert_*.webp | ✅ DONE |
| NEW-2c | Schema hasCredential для кондитера добавлена на /certificates/ | certificates/index.html | ✅ DONE |
| NEW-2d | sitemap.xml обновлён: добавлен /certificates/ | sitemap.xml | ✅ DONE |
| NEW-2e | Ссылка на /certificates/ добавлена в footer главной | index.html | ✅ DONE |

---

### 🔴 ОТКРЫТЫ — КРИТИЧЕСКИЕ

Все критические задачи закрыты ✅

---

### 🟡 ОТКРЫТЫ — СРЕДНИЕ

| ID | Задача | Файл | Блокер |
|----|--------|------|--------|
| SEO-A6 | Установить Google Analytics 4 | index.html + все страницы | **Нужен GA4 Measurement ID от владельца** |
| SEO-А15 | `french.milovicake.ru` в footer — обновлена ссылка (было school.milovicake.ru) | index.html | ✅ FIXED в спринте 5 |
| SEO-Г4 | `_template.html`, `_cities.csv`, `build.py` публично доступны | GitHub / robots | robots.txt уже блокирует; также скрыть через .gitignore |

---

### 🟢 ОТКРЫТЫ — ФОНОВЫЕ

| ID | Задача | Файл |
|----|--------|------|
| SEO-А11 | Минифицировать CSS (238 КБ → ~140 КБ) | css/style.css |
| SEO-Б1 | Уникализация страниц пригородов (уникальный FAQ, карта, цена доставки) | prigorody/* |
| SEO-Б8 | OG-image уникальная для пригородов | Cloudflare Worker |
| SEO-В5 | Тяжёлые изображения рулета (до 215 КБ) — сжать | img/ |
| SEO-Г2 | max.ru ссылка — проверить работоспособность | — |
| SEO-Г5 | SW + cache-first — проверить query-params | sw.js |
| NEW-3 | /certificates/ — добавить фото Виктории и текст «Кто я» для E-E-A-T | certificates/index.html |
| NEW-4 | /certificates/ — добавить прокрутку по годам (timeline) | certificates/index.html |

---

## ═══════════════════════════════════════
## ЧАСТЬ 2. ЧТО ИЗМЕНЕНО В СПРИНТЕ 4
## ═══════════════════════════════════════

### index.html
- Удалён inline `<script>` с безусловным `ym()` init — теперь Яндекс.Метрика загружается только после согласия с cookie через `loadMetrika()` в main.js
- Review Schema JSON-LD: 6 реальных отзывов с `datePublished`, `reviewRating`, `author`, `publisher`
- meta keywords: расширен с 8 до 14 фраз (добавлены: авторский торт СПб, торт с доставкой СПб, 3D торт, торт на день рождения, Павлова десерт, кондитер Милованова Виктория)
- `header-trust` div: добавлены рейтинг ★★★★★ 4.8 и ссылка на /certificates/
- Ссылка на /certificates/ в footer

### prigorody/ (rebuild.py)
- Ротация отзывов: `review_set` колонка в _cities.csv (A/B/C)
- Набор A (5 городов): Евгения Монтихо + Евгения Е. / Татьяна + Ирина
- Набор B (5 городов): Екатерина + Жанель / Liras + Елена
- Набор C (4 города): Евгения Монтихо + Жанель / Liras + Ирина
- Все 14 страниц пересобраны с уникальным набором отзывов

### Репозиторий (чистка)
- Удалены: HISTORICAL_FINDINGS.md, HISTORICAL_FINDINGS_2.md, HISTORICAL_FINDINGS_3.md, HISTORICAL_VERIFICATION.md
- Удалён: zen_3mkO...html (Яндекс.Дзен верификация)
- Сохранены: google7e02f9855e02b89a.html и yandex_9bde19424208d6ce.html (нужны для верификации)

### certificates/ (новая страница)
- **URL:** https://milovicake.ru/certificates/
- Премиум-дизайн в стиле сайта (Cormorant Garamond + Jost, gold/cream palette)
- 5 сертификатов: Торт на миллион 3.0 (featured), Торт от А до Я, Барельеф/акварель, Детские торты, Шоколадная флористика
- Лайтбокс для просмотра сертификатов в полном размере
- Schema.org hasCredential JSON-LD
- BreadcrumbList Schema
- Полная SEO-разметка (meta description, keywords, OG)
- Анимации появления карточек (IntersectionObserver)
- sitemap.xml обновлён

---

## ═══════════════════════════════════════
## ЧАСТЬ 3. МЕТРИКИ ДЛЯ ОТСЛЕЖИВАНИЯ
## ═══════════════════════════════════════

| Метрика | Где смотреть | Ожидаемое улучшение |
|---------|-------------|---------------------|
| Core Web Vitals (CLS) | Google Search Console → Core Web Vitals | CLS ↓ после SEO-A7 ✅ |
| Rich Results (Product) | search.google.com/test/rich-results | Карточка товара в SERP ✅ |
| Review Schema | Rich Results Test | Звёзды в SERP для главной |
| Person/hasCredential | Schema Validator | E-E-A-T сигнал |
| Cookie consent соответствие | Ручная проверка | Метрика только после согласия |
| Уникальность пригородов | Яндекс Вебмастер / дубли | Разные отзывы = меньше дублирования |

---

*Документ составлен: 12 мая 2026*  
*Версия: 3.0 — Спринты 1, 3, 4 выполнены*
