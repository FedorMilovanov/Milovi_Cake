# 🔬 MILOVI CAKE — SEO АУДИТ: УГЛУБЛЁННЫЙ УРОВЕНЬ

**Дата:** 5 июня 2026 | **Версия:** DEEP-DIVE v1.0
**Предыдущий аудит:** `Milovi_Cake_SEO_Audit_2026.md` (базовый уровень)
**Этот документ:** углублённый анализ GEO, Yandex, Schema.org, Visual Search, Voice Search, EEAT

---

## 🧠 1. GEO (GENERATIVE ENGINE OPTIMIZATION) — ПОЛНЫЙ ПЛАН

### 1.1 Почему это критично именно сейчас

В 2026 году **47-61% информационных запросов** забирают AI-поисковики без клика. Для коммерческих запросов («торты на заказ СПб», «частный кондитер СПб») AI Overviews Google и Нейро Яндекса синтезируют ответы из 3-5 источников. **Если сайта нет среди этих источников — бизнес невидим для растущей доли аудитории.**

### 1.2 Ключевые AI-платформы и их требования

| Платформа | Механизм отбора | Что нужно Milovi Cake |
|-----------|----------------|----------------------|
| ChatGPT (SearchGPT) | Bing index + E-E-A-T + structured data | Sitemap в Bing Webmaster Tools, JSON-LD Schema |
| Perplexity AI | Real-time crawl + citation structure | TL;DR блоки, FAQ schema, цитируемые факты |
| Google AI Overviews | Google index + E-E-A-T + featured snippets | FAQPage schema, позиция в топ-10, ответы |
| Google Gemini | Knowledge Graph entities + schema | Organization + Person schema, sameAs |
| Яндекс Нейро | Яндекс индекс + региональность + ИКС | Яндекс.Бизнес, региональная привязка |
| Claude | Multi-source верификация | Сбалансированный контент, ссылки на источники |

### 1.3 План действий GEO (4 шага)

**Шаг 1: Технический фундамент (Неделя 1-2)**
- Дополнить llms.txt (цены, география, продукты, контакты)
- JSON-LD Schema (6 типов) — см. раздел 2
- Sitemap в Bing Webmaster Tools (для ChatGPT/SearchGPT)
- Разрешить GPTBot, Google-Extended, PerplexityBot в robots.txt

**Шаг 2: Структура контента для AI-цитирования (Неделя 1-3)**
- TL;DR блок (40-60 слов) — прямой ответ на запрос
- FAQ в формате question-answer (H3 вопрос → P ответ)
- Структурированные факты (цена, вес, состав, срок)
- Авторство (Виктория Милованова, частный кондитер, 5 лет опыта)

**Шаг 3: Внешние сигналы для AI (Месяц 1-3)**
- Яндекс.Карты ✅, Google Maps ✅
- Регистрация: wedding.ru, gorko.ru, peterburg2.ru, food.ru
- Статьи: vc.ru, Яндекс.Дзен
- Отзывы: Irecommend, Otzovik

**Шаг 4: Мониторинг (еженедельно)**
- ChatGPT: "где заказать торт на день рождения в СПб"
- Perplexity: "лучший частный кондитер Санкт-Петербург"
- Яндекс Нейро: "торты на заказ спб отзывы"
- Цель: 30%+ citation rate через 8-10 недель

### 1.4 Princeton GEO Research — тактики с доказанным uplift

| Тактика | Uplift | Реализация для Milovi Cake |
|---------|--------|---------------------------|
| Cite Sources | +30-40% | Ссылки на Яндекс.Карты, независимые отзывы |
| Statistics Addition | +30-40% | "5 лет, 500+ тортов, 4.8★, 35+ отзывов" |
| Quotation Integration | +25-35% | Цитаты из реальных отзывов клиентов |
| Fluency Optimization | +15-20% | Естественный язык, без keyword stuffing |
| TL;DR + FAQ Schema | +410% (IDC 2026) | JSON-LD FAQPage на каждой странице |

---

## 📋 2. SCHEMA.ORG — ПОЛНАЯ ИМПЛЕМЕНТАЦИЯ (7 БЛОКОВ JSON-LD)

⚠️ Каждый блок — отдельный `<script type="application/ld+json">`. Не объединять!

### Блок 1: WebSite (главная)
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://milovicake.ru/#website",
  "url": "https://milovicake.ru",
  "name": "Milovi Cake — Торты на заказ в Санкт-Петербурге",
  "inLanguage": "ru",
  "publisher": { "@id": "https://milovicake.ru/#organization" }
}
```

### Блок 2: Organization + Person (главная)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://milovicake.ru/#organization",
  "name": "Milovi Cake",
  "url": "https://milovicake.ru",
  "logo": "https://milovicake.ru/icon-512.png",
  "foundingDate": "2021",
  "founder": {
    "@type": "Person",
    "@id": "https://milovicake.ru/#person-viktoria",
    "name": "Виктория Милованова",
    "jobTitle": "Частный кондитер",
    "image": "https://milovicake.ru/img/viktoria.webp",
    "sameAs": ["https://t.me/MiloviCake"]
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+7-911-903-88-86",
    "contactType": "customer service",
    "availableLanguage": "Russian"
  },
  "sameAs": [
    "https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/",
    "https://t.me/MiloviCake"
  ]
}
```

### Блок 3: Bakery (FoodEstablishment) — на ВСЕХ страницах
```json
{
  "@context": "https://schema.org",
  "@type": ["FoodEstablishment", "Bakery"],
  "@id": "https://milovicake.ru/#bakery",
  "name": "Milovi Cake — Торты на заказ в Санкт-Петербурге",
  "url": "https://milovicake.ru",
  "telephone": "+79119038886",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Пулковская ул., 19",
    "addressLocality": "Санкт-Петербург",
    "addressCountry": "RU"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 59.8520, "longitude": 30.3260 },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    "opens": "10:00", "closes": "20:00"
  },
  "image": "https://milovicake.ru/img/head_desktop.webp",
  "priceRange": "1600-5000",
  "servesCuisine": "Десерты, Авторские торты",
  "currenciesAccepted": "RUB",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8", "reviewCount": "35", "bestRating": "5"
  }
}
```

### Блок 4: Product × 6 (каждый товар, главная)
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Бисквитный торт на заказ СПб",
  "description": "Воздушный бисквитный торт с нежнейшим кремом и авторским декором. Минимальный заказ от 2 кг.",
  "image": ["https://milovicake.ru/img/cake_biscuit_0.webp"],
  "brand": { "@id": "https://milovicake.ru/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "2800", "priceCurrency": "RUB",
    "unitText": "кг",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
```
Аналогично: Бенто 1600₽, Макси Бенто 3000₽, 3D Торт 5000₽, Меренговый рулет 2500₽, Павлова 350₽, Капкейки 350₽.

### Блок 5: FAQPage (главная + пригороды)
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

### Блок 6: BreadcrumbList (все страницы)
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

### Блок 7: Review × 3 (главная)
```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": { "@id": "https://milovicake.ru/#bakery" },
  "author": { "@type": "Person", "name": "Евгения Монтихо" },
  "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
  "datePublished": "2025-12-20",
  "reviewBody": "Дважды заказывали торты. Оба просто шикарные..."
}
```

---

## 🔵 3. YANDEX SEO — ГЛУБОКИЙ РАЗБОР

### 3.1 Поведенческие факторы — КЛЮЧЕВОЙ ФАКТОР

Яндекс-2026 оценивает: время на сайте, глубину просмотра, CTR в выдаче, pogo-sticking, scroll depth. Сессия < 15 сек = отрицательный сигнал.

**Что хорошо:** Калькулятор удерживает, FAQ отвечают без ухода, фото высокого качества, быстрая загрузка.

**Что сделать:** Установить Яндекс.Метрику (Вебвизор), добавить карту Яндекса на сайт, улучшить перелинковку, добавить кнопку «Поделиться».

### 3.2 Meta Keywords — ЯНДЕКС ИХ УЧИТЫВАЕТ

Главная:
```html
<meta name="keywords" content="торты на заказ спб, торт на день рождения спб, свадебные торты спб, бенто торт спб, заказать торт с доставкой спб, частный кондитер спб, детский торт на заказ спб, 3d торт спб, меренговый рулет заказать, капкейки спб, пирожное павлова, торт на свадьбу спб, домашние торты спб">
```

Пригороды: добавить колонку `meta_keywords` в `_cities.csv` и плейсхолдер `{{meta_keywords}}` в `_template.html`.

### 3.3 Яндекс.Бизнес — заполнить на 90%+

Поля: название, адрес (Пулковская 19), телефон, сайт, категория «Кондитерская», часы работы, 10+ фото, услуги с ценами.

### 3.4 Коммерческие факторы Яндекса

- ✅ Телефон, адрес, цены — есть
- ❌ Реквизиты (ИП/ИНН) — добавить в футер
- ❌ Страница «Доставка и оплата» — создать
- ❌ Политика возврата — добавить

### 3.5 Yandex Turbo Pages

Генерировать RSS-фид с Turbo-версиями (до 10 элементов). Даёт +15x скорость загрузки на мобильных в Яндексе. Сложно для статического сайта, но даёт существенный буст.

### 3.6 ИКС (Индекс Качества Сайта)

Зарегистрироваться в Яндекс.Вебмастер. 14 гео-лендингов = большой плюс к ИКС.

---

## 📷 4. GOOGLE LENS / VISUAL SEARCH

Google Lens: **12+ млрд** визуальных запросов/мес (2026). Критично для кондитерской.

### 4.1 Требования к фото

| Параметр | Статус |
|----------|--------|
| ≥ 1200px ширина | 🟡 Проверить |
| WebP/AVIF | ✅ |
| Чистый фон | 🟡 Не все фото |
| 3+ ракурса | ✅ |
| Alt text 80-125 символов | ✅ |
| Product Schema | ❌ |
| EXIF (geo + copyright) | ❌ |

### 4.2 Для каждого торта нужно

1. Фото на белом фоне (крупный план)
2. Фото в разрезе (начинка)
3. Фото в контексте (на праздничном столе)
4. ImageObject Schema в Product

---

## ⚡ 5. CORE WEB VITALS

| Метрика | Good | Статус |
|---------|------|--------|
| LCP | ≤ 2.5s | 🟢 Статика, 🟡 добавить preload + fetchpriority |
| INP | ≤ 200ms | 🟢 Vanilla JS, без фреймворков |
| CLS | ≤ 0.1 | 🟡 Шрифты, img без width/height |

### Быстрые улучшения:
```html
<link rel="preload" as="image" href="/img/head_desktop.webp" fetchpriority="high" />
<link rel="preload" as="font" href="/fonts/cormorant-garamond.woff2" crossorigin />
<img src="..." width="1200" height="800" />
```

---

## 🎤 6. VOICE SEARCH (ГОЛОСОВОЙ ПОИСК)

- 30%+ всех поисков = голосовые
- 58% локальных запросов = голосовые
- Формат: «Где заказать торт на день рождения в Питере?»

**Что нужно:**
1. ✅ FAQ-секции есть
2. ❌ FAQPage Schema — добавить
3. ❌ Speakable Schema — добавить на ключевые страницы
4. 🟡 Контент в разговорном стиле

---

## 🏆 7. EEAT — ГЛУБОКИЙ АНАЛИЗ

| Pillar | Статус | Что улучшить |
|--------|--------|-------------|
| Experience | 🟡 | Кейсы, milestones, даты |
| Expertise | 🟡 | Блог, страница «Как мы работаем» |
| Authoritativeness | 🟡 | Упоминания в СМИ, ссылки с каталогов |
| Trustworthiness | 🟡 | Реквизиты ИНН/ОГРН |

---

## 📝 8. КОНТЕНТ-СТРАТЕГИЯ: 10 СТАТЕЙ ДЛЯ БЛОГА

| # | Тема | Ключевой запрос |
|---|------|----------------|
| 1 | Как выбрать торт на свадьбу | свадебный торт как выбрать |
| 2 | Бенто-торт: что это и цена в СПб | бенто торт что это |
| 3 | Тренды оформления тортов 2026 | тренды тортов 2026 |
| 4 | Сколько стоит торт на заказ в СПб | сколько стоит торт на заказ спб |
| 5 | Торты без глютена: рулет и Павлова | торты без глютена спб |
| 6 | Как рассчитать вес торта на гостей | сколько кг торт на гостей |
| 7 | Популярные начинки для тортов | начинки для торта |
| 8 | Как заказать торт с доставкой в СПб | заказать торт с доставкой спб |
| 9 | Детский торт: идеи оформления | детский торт на день рождения |
| 10 | Свадебный торт 2026: тренды | свадебный торт 2026 |

**Структура статьи:** TL;DR → H2 введение → H2+H3 разбор → таблицы → FAQ+JSON-LD → блок «Опыт Виктории» → CTA

---

## 🔗 9. ВНУТРЕННЯЯ ПЕРЕЛИНКОВКА

**Оптимальная структура:**
```
Главная → пригороды (14), блог, /o-konditere/, /dostavka/, /oplata/
Блог → товары каталога, пригороды
Пригороды → главная, соседние города, каталог
```

---

## 📊 10. ВНЕШНИЕ ССЫЛКИ — ПРИОРИТЕТЫ

| Платформа | Приоритет |
|-----------|----------|
| Яндекс.Бизнес | 🔴 Высокий |
| Google Business Profile | 🔴 Высокий |
| 2GIS, Zoon, Yell | 🟡 Средний |
| Wedding.ru, Gorko.ru | 🟡 Средний |
| Peterburg2, Afisha | 🟡 Средний |
| VC.ru, Яндекс.Дзен | 🟢 Контент |
| Irecommend, Otzovik | 🟡 Отзывы |

**NAP-консистентность:** Везде одинаково: «Milovi Cake — Торты на заказ», Пулковская 19, +79119038886.

---

## 📈 11. МЕТРИКИ УСПЕХА

| Метрика | Цель (3 мес) |
|---------|-------------|
| Органический трафик | +25% |
| Топ-10 целевых запросов | 15 запросов |
| CTR в выдаче | > 5% |
| GEO citation rate | > 30% |
| Отзывы Яндекс.Карты | 50+ |
| Отзывы Google Maps | 20+ |

---

## 🎯 12. ИТОГОВЫЙ ЧЕКЛИСТ

### Неделя 1-2: ТЕХНИЧЕСКИЙ ФУНДАМЕНТ
- [ ] 7× JSON-LD Schema блоков
- [ ] Meta keywords (главная + 14 пригородов)
- [ ] hreflang ru + x-default
- [ ] Meta description + улучшенный title
- [ ] Sitemap в Bing Webmaster Tools
- [ ] GPTBot/PerplexityBot в robots.txt

### Неделя 3-4: КОНТЕНТ И СТРУКТУРА
- [ ] TL;DR блоки на ключевые страницы
- [ ] Внутренняя перелинковка
- [ ] width/height на все img
- [ ] fetchpriority="high" + preload шрифтов
- [ ] Обновить llms.txt
- [ ] Страницы «О кондитере», «Доставка и оплата»

### Месяц 1-2: ВНЕШНИЕ ФАКТОРЫ
- [ ] Яндекс.Бизнес 100% + Google Business Profile 100%
- [ ] 2GIS, Zoon, Wedding.ru, Gorko.ru
- [ ] Первые 3 статьи в блог
- [ ] Яндекс.Метрика

### Месяц 2-3: РАЗВИТИЕ
- [ ] 10 статей в блоге
- [ ] 20+ новых отзывов на Яндекс.Картах
- [ ] Видео YouTube/VK
- [ ] 2-3 упоминания в СМИ
- [ ] Еженедельный GEO-мониторинг

---

**Этот документ дополняет `Milovi_Cake_SEO_Audit_2026.md`. Использовать оба совместно.**