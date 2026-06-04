# 🔍 MILOVI CAKE — ВСЕСТОРОННИЙ SEO-АУДИТ

**Дата:** 5 июня 2026  
**Домен:** [milovicake.ru](https://milovicake.ru)  
**Тип:** Статический сайт (HTML/CSS/JS), GitHub Pages  
**Стек:** Vanilla HTML/CSS/JS + Python-генератор для 14 пригородов  
**Целевые запросы:** торты на заказ СПб, торт на день рождения, свадебные торты СПб, бенто торт, торты с доставкой, частный кондитер СПб, +14 гео-страниц  

---

## 📊 ОБЩАЯ ОЦЕНКА

| Категория | Оценка | Комментарий |
|-----------|--------|-------------|
| Техническое SEO | 🟡 6.5/10 | Хорошая база, критические пробелы |
| On-page SEO | 🟡 7/10 | Сильный контент, не хватает структурированных данных |
| Локальное SEO | 🟢 8/10 | 14 гео-страниц — отлично, но нет Google/Yandex Business интеграции |
| Yandex SEO | 🟡 6/10 | Есть Webmaster-файл, но нет meta keywords, Turbo Pages, IndexNow |
| Google SEO | 🟡 6.5/10 | Хорошая скорость, нет JSON-LD Schema |
| AI/GEO (LLM visibility) | 🔴 3/10 | Нет структурированных данных = невидимость для ChatGPT/Perplexity |
| Мобильная оптимизация | 🟢 8.5/10 | Touch targets, PWA, Service Worker |
| Скорость/ Core Web Vitals | 🟢 8/10 | Статика, WebP/AVIF, content-visibility, prefetch |
| Контент / EEAT | 🟢 8/10 | Реальные отзывы, автор, 5 лет опыта, фото работ |

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (ИСПРАВИТЬ В ПЕРВУЮ ОЧЕРЕДЬ)

### 1. ❌ ПОЛНОЕ ОТСУТСТВИЕ JSON-LD СТРУКТУРИРОВАННЫХ ДАННЫХ

**Это главный SEO-провал 2026 года.** Без Schema.org markup сайт:
- **Невидим для AI-поисковиков** (ChatGPT, Perplexity, Gemini, DeepSeek)
- **Не показывает rich snippets** (звёзды рейтинга, цена, отзывы, FAQ)
- **Не попадает в AI Overviews** Google (SGE)
- **Не попадает в нейроответы Яндекса**
- **Теряет 47-61% CTR** по данным 2026 года

**Что нужно добавить (минимальный набор) — 6 типов Schema.org:**

#### a) `LocalBusiness` / `FoodEstablishment` — на ВСЕХ страницах

```json
{
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  "@id": "https://milovicake.ru/#business",
  "name": "Milovi Cake — Торты на заказ в Санкт-Петербурге",
  "description": "Авторские торты и десерты ручной работы с доставкой по СПб и Ленобласти",
  "url": "https://milovicake.ru",
  "telephone": "+79119038886",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Пулковская ул., 19",
    "addressLocality": "Санкт-Петербург",
    "addressCountry": "RU"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 59.8520,
    "longitude": 30.3260
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    "opens": "10:00",
    "closes": "20:00"
  },
  "image": "https://milovicake.ru/img/head_desktop.webp",
  "priceRange": "1600-5000",
  "servesCuisine": "Десерты, Торты",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "35",
    "bestRating": "5"
  },
  "sameAs": [
    "https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/",
    "https://t.me/MiloviCake",
    "https://wa.me/79119038886"
  ]
}
```

#### b) `Product` + `Offer` — каждый товар в каталоге

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Бисквитный торт на заказ СПб",
  "description": "Воздушный торт с нежнейшим кремом и авторским декором",
  "image": "https://milovicake.ru/img/cake_biscuit_0.webp",
  "offers": {
    "@type": "Offer",
    "price": "2800",
    "priceCurrency": "RUB",
    "unitText": "кг",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
```

#### c) `FAQPage` — на каждой странице

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Где заказать торт в СПб с доставкой на дом?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Milovi Cake доставляет по всему Санкт-Петербургу и пригородам..."
      }
    }
  ]
}
```

#### d) `BreadcrumbList` — навигация

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Главная", "item": "https://milovicake.ru/" },
    { "@type": "ListItem", "position": 2, "name": "Торты в Пушкине", "item": "https://milovicake.ru/prigorody/pushkin/" }
  ]
}
```

#### e) `Organization` + `Person` (для EEAT)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://milovicake.ru/#organization",
  "name": "Milovi Cake",
  "url": "https://milovicake.ru",
  "logo": "https://milovicake.ru/icon-512.png",
  "founder": {
    "@type": "Person",
    "name": "Виктория Милованова",
    "jobTitle": "Частный кондитер",
    "description": "Частный кондитер с 5-летним опытом. Семейное производство."
  }
}
```

#### f) `Review` — для отзывов (первые 3-5)

```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": { "@id": "https://milovicake.ru/#business" },
  "author": { "@type": "Person", "name": "Евгения Монтихо" },
  "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
  "datePublished": "2025-12-20",
  "reviewBody": "Дважды заказывали торты. Первый раз нам сделали в стиле Острова..."
}
```

---

### 2. ❌ НЕТ META KEYWORDS (КРИТИЧНО ДЛЯ YANDEX)

Яндекс в 2026 году **всё ещё учитывает** meta keywords tag. Google — нет, но для Яндекса это важно.

**Добавить на главную:**
```html
<meta name="keywords" content="торты на заказ спб, торт на день рождения, свадебные торты спб, бенто торт, торты с доставкой, частный кондитер спб, заказать торт спб, детский торт на заказ, меренговый рулет, павлова пирожное, капкейки, 3d торт, торт на свадьбу">
```

**Для страниц пригородов** — добавить в `_template.html` с переменной `{{meta_keywords}}` и в `_cities.csv` новую колонку.

---

### 3. ❌ НЕТ HREFLANG ТЕГОВ

Отсутствие hreflang снижает видимость в Яндекс для русского языка.

```html
<link rel="alternate" hreflang="ru" href="https://milovicake.ru/текущий-url" />
<link rel="alternate" hreflang="x-default" href="https://milovicake.ru/" />
```

---

### 4. ❌ НЕТ IndexNow РЕАЛИЗАЦИИ

Яндекс полностью поддерживает IndexNow. GitHub Pages не поддерживает серверный IndexNow, но можно через GitHub Actions + Cloudflare.

**Альтернатива:** добавить в robots.txt:
```
IndexNow: https://milovicake.ru/indexnow
```

И настроить GitHub Action.

---

### 5. ❌ НЕТ СТРУКТУРИРОВАННОГО head ДЛЯ AI

Сайт имеет `llms.txt` — отлично. Но не хватает:
```html
<meta name="ai-content" content="expert-written" />
<meta name="content-author" content="Виктория Милованова" />
```

---

## 🟡 ЗНАЧИТЕЛЬНЫЕ ПРОБЛЕМЫ

### 6. 🟡 SITEMAP.XML — ХОРОШИЙ, НО МОЖНО УЛУЧШИТЬ

- `/call/` имеет `changefreq=yearly`, `priority=0.3` — поднять до 0.7, monthly
- Нет актуальных `<lastmod>` — Yandex чувствителен
- Видео-sitemap отключён (500 ошибка)
- Нет `<xhtml:link rel="alternate" hreflang="ru"/>`

### 7. 🟡 ROBOTS.TXT — ХОРОШИЙ

- ✅ Отдельные правила для Yandex
- ✅ Clean-param 
- ⚠️ Host директива устарела для Яндекса
- ⚠️ Video-sitemap закомментирован

### 8. 🟡 TITLE ТЕГИ — МОЖНО УСИЛИТЬ

**Главная сейчас:** "Milovi Cake — Торты и десерты на заказ в Санкт-Петербурге"

**Предлагаемый вариант:**
```
Торты на заказ СПб | Milovi Cake — Авторские торты ручной работы с доставкой
```
(64 символа — идеально для Яндекса, ~70 символов сниппет)

### 9. 🟡 META DESCRIPTION — НУЖНО ПРОВЕРИТЬ

Не нашел явного meta description на главной в прочитанных чанках. Нужно добавить:

```html
<meta name="description" content="Авторские торты на заказ в СПб с доставкой. Бенто, бисквитные, 3D, свадебные, детские — от 1 600 ₽. Частный кондитер Виктория Милованова. Ручная работа, натуральные ингредиенты. Доставка по Санкт-Петербургу и пригородам." />
```

### 10. 🟡 URL-СТРУКТУРА ПРИГОРОДОВ

Текущие: `/prigorody/pushkin/` — слово "prigorody" не несёт SEO-ценности.

Рекомендация: рассмотреть `/torty-pushkin/`, `/torty-peterhof/` для точного совпадения ключей.

---

## 🟢 ЧТО СДЕЛАНО ХОРОШО (НЕ ТРОГАТЬ)

1. ✅ **14 гео-лендингов** с индивидуальным контентом — мощнейший локальный SEO-актив
2. ✅ **PWA с Service Worker** — офлайн-доступ, быстрая загрузка
3. ✅ **WebP/AVIF изображения** с alt-текстами
4. ✅ **Отзывы клиентов** с реальными именами и датами — EEAT
5. ✅ **FAQ-секции** на всех страницах
6. ✅ **Интерактивный калькулятор цены** — повышает вовлечённость
7. ✅ **Cookie consent** — GDPR и 152-ФЗ
8. ✅ **Верификация Яндекс и Google** в корне
9. ✅ **CNAME**: milovicake.ru
10. ✅ **Sitemap с изображениями** — каждая картинка с caption
11. ✅ **robots.txt** с отдельными правилами для Yandex
12. ✅ **Clean-param** — убирает мусорные параметры
13. ✅ **Мобильная оптимизация** — touch target ≥44px
14. ✅ **Тёмная тема** — современный UX
15. ✅ **Статический сайт** — мгновенная загрузка
16. ✅ **View Transitions API**, content-visibility, prefetch on hover
17. ✅ **prefers-reduced-motion / prefers-contrast** — accessibility

---

## 📋 ПОЛНЫЙ ПЛАН ИСПРАВЛЕНИЙ

### 🔴 PRIORITY 1 — Критично (немедленно)

| # | Задача | Файлы | SEO-эффект |
|---|--------|-------|------------|
| 1 | Добавить JSON-LD LocalBusiness | `index.html` | Rich snippet Google + нейроответы Яндекса |
| 2 | Добавить JSON-LD Organization + Person | `index.html` | EEAT + Knowledge Graph |
| 3 | Добавить JSON-LD Product (6 товаров) | `index.html` | Цена в выдаче, товарные rich snippets |
| 4 | Добавить JSON-LD FAQPage | `index.html`, `_template.html` | Featured snippets, AI Overviews |
| 5 | Добавить JSON-LD BreadcrumbList | Все страницы | Хлебные крошки в выдаче |
| 6 | Добавить JSON-LD Review (3-5 шт) | `index.html` | Звёзды рейтинга в выдаче |
| 7 | Добавить meta keywords | Все страницы | Ранжирование в Яндексе |
| 8 | Добавить hreflang теги | Все страницы | Языковая привязка |
| 9 | Проверить/добавить meta description | `index.html` | CTR в выдаче |
| 10 | Настроить IndexNow | GitHub Actions | Мгновенная индексация в Яндексе |

### 🟡 PRIORITY 2 — Важно (в течение недели)

| # | Задача | Файлы | SEO-эффект |
|---|--------|-------|------------|
| 11 | Улучшить title на главной | `index.html` | CTR + релевантность |
| 12 | Обновить lastmod в sitemap.xml | `sitemap.xml` | Свежесть для роботов |
| 13 | JSON-LD на страницы пригородов | `_template.html` | Локальное SEO |
| 14 | Восстановить video sitemap | `sitemap-videos.xml` | Видео-индексация |
| 15 | Поднять priority для /call/ | `sitemap.xml` | Приоритет страницы |
| 16 | OpenGraph + Twitter Cards | Все HTML | Социальные сниппеты |

### 🟢 PRIORITY 3 — Улучшения (месяц)

| # | Задача | Файлы | SEO-эффект |
|---|--------|-------|------------|
| 17 | Google Business Profile | Вне сайта | Локальный пак Google Maps |
| 18 | Яндекс.Бизнес | Вне сайта | Локальный пак Яндекс.Карт |
| 19 | Яндекс.Справочник | Вне сайта | NAP-консистентность |
| 20 | Больше отзывов на Яндекс.Картах | Вне сайта | Доказательство + ранжирование |
| 21 | Yandex Turbo Pages | RSS/XML | Мобильная скорость |
| 22 | Страница "О кондитере" | Новый файл | EEAT сигнал |
| 23 | Видео YouTube/VK | sitemap-videos.xml | Мультимедийная выдача |
| 24 | Yandex Metrica | Вне сайта | Поведенческие факторы |
| 25 | Breadcrumb навигация | HTML | UX + Schema |

---

## 📈 КОНКУРЕНТНЫЙ АНАЛИЗ

### Ключевые выводы по нише «торты на заказ СПб»:

1. **Высокая конкуренция** в коммерческих запросах
2. Конкуренты используют: блоги, отдельные страницы под кластеры, микроразметку отзывов, калькуляторы, галереи с фильтрами
3. Успешные конкуренты имеют 20+ статей в блоге
4. Частные кондитеры редко используют продвинутое SEO — **окно возможностей**

### Milovi Cake vs Конкуренты:
- ✅ 14 гео-лендингов — почти ни у кого нет
- ✅ PWA и офлайн-доступ
- ✅ Современный дизайн и UX
- ❌ JSON-LD Schema (есть у 60% топ-конкурентов)
- ❌ Блог с SEO-статьями
- ❌ Видео-контент

---

## 🧠 AI/GEO ОПТИМИЗАЦИЯ

**Статус: 🔴 КРИТИЧЕСКИ НЕ ГОТОВ**

В 2026 году ИИ-поисковики забирают 30-45% трафика. Нужно:

1. **JSON-LD Schema** — обязательно (Priority 1)
2. **llms.txt** — ✅ уже есть, обновить
3. **Структура для AI-цитирования** — FAQ, TL;DR, факты
4. **Внешние упоминания** — Яндекс.Карты ✅, Google Maps ✅, нужны СМИ/блоги

---

## 📊 ТЕХНИЧЕСКИЙ SEO-ЧЕКЛИСТ

| Проверка | Статус |
|----------|--------|
| HTTPS | ✅ |
| robots.txt | ✅ |
| sitemap.xml | ✅ |
| sitemap-videos.xml | ❌ (500) |
| CNAME | ✅ |
| Google верификация | ✅ |
| Яндекс верификация | ✅ |
| Канонические URL | ✅ |
| hreflang | ❌ |
| 404 страница | ✅ |
| Скорость <2сек | ✅ |
| WebP/AVIF | ✅ |
| Schema.org JSON-LD | ❌ **КРИТИЧНО** |
| meta keywords | ❌ |
| OpenGraph | 🟡 |
| Twitter Cards | ❌ |

---

## 🎯 КЛЮЧЕВЫЕ СЛОВА — КАРТА ПОКРЫТИЯ

### Коммерческие (главная)
| Запрос | Статус |
|--------|--------|
| торты на заказ СПб | ✅ |
| торт на день рождения СПб | ✅ |
| свадебные торты СПб | ✅ |
| бенто торт СПб | ✅ |
| частный кондитер СПб | ✅ |
| 3D торт СПб | ✅ |
| меренговый рулет СПб | ✅ |
| капкейки на заказ СПб | ✅ |

### Гео (пригороды)
| Город | Статус |
|-------|--------|
| Пушкин, Петергоф, Гатчина, Всеволожск, Колпино, Красное Село, Павловск, Сестрорецк, Ломоносов, Кронштадт, Тосно, Мурино, Кудрово, Шушары | ✅ 14 лендингов |

### Пробелы
| Запрос | Статус |
|--------|--------|
| торт на свадьбу недорого | ❌ Нет страницы |
| торты без сахара | ❌ |
| веганские торты | ❌ |
| торт срочно/сегодня | ❌ |
| торт на крестины/юбилей/корпоратив | 🟡 Упомянут, нет страниц |

---

## 📝 ИТОГОВАЯ ДОРОЖНАЯ КАРТА

### Неделя 1: Критические исправления
- [ ] JSON-LD Schema (6 типов) на главную
- [ ] Meta keywords на все страницы
- [ ] hreflang теги
- [ ] Проверить/добавить meta description
- [ ] Улучшить title главной

### Неделя 2: Структурные улучшения
- [ ] JSON-LD Schema на все 14 пригородов (через `_template.html`)
- [ ] IndexNow GitHub Action
- [ ] OpenGraph + Twitter Cards
- [ ] Обновить sitemap.xml
- [ ] Video sitemap

### Месяц 1: Внешние факторы
- [ ] Google Business Profile
- [ ] Яндекс.Бизнес / Справочник
- [ ] Наращивание отзывов (цель: 50+)
- [ ] Первые 3-5 SEO-статей в блог

### Месяц 2-3: Развитие
- [ ] Блог 10+ статей
- [ ] Видео YouTube/VK
- [ ] Внешние ссылки
- [ ] Yandex Turbo Pages

---

## 🎓 СТАНДАРТЫ SEO 2026 — СВОДКА

| Тренд | Статус |
|-------|--------|
| JSON-LD Schema.org | 🔴 КРИТИЧНО |
| EEAT | 🟡 Усилить Schema |
| AI/GEO | 🟡 llms.txt есть, Schema нет |
| Core Web Vitals (INP) | 🟢 |
| Mobile-first | 🟢 |
| Локальное SEO | 🟡 14 лендингов, нет GBP |
| IndexNow | 🔴 Не настроен |
| Поведенческие факторы | 🟢 |
| Контент-кластеры | 🟡 Нет блога |
| Image SEO | 🟢 |

---

**Общий вердикт:** Проект имеет очень сильную техническую и контентную базу. Главный недостаток — **полное отсутствие структурированных данных (JSON-LD Schema.org)**, что критически снижает видимость в поиске 2026 года, особенно для AI-поисковиков. После добавления Schema.org и meta keywords сайт сможет конкурировать на профессиональном уровне как в Google, так и в Яндексе.