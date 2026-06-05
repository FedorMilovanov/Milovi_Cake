# 🔬 MILOVI CAKE — УРОВЕНЬ 6: ГОТОВЫЙ КОД ДЛЯ ВНЕДРЕНИЯ

**Дата:** 5 июня 2026 | **Версия:** LEVEL-6 v1.0 — READY TO DEPLOY
**Цель:** Все JSON-LD Schema, meta-теги, заголовки — готовы к копированию в HTML

---

## 1. index.html — ЧТО ДОБАВИТЬ В `<head>`

### 1.1 Все meta-теги (вставить ПОСЛЕ `<meta charset="UTF-8">`)

```html
<!-- SEO Meta Tags -->
<title>Торты на заказ СПб | Milovi Cake — Авторские торты ручной работы с доставкой</title>
<meta name="description" content="Авторские торты на заказ в СПб с доставкой. Бенто, бисквитные, 3D, свадебные, детские — от 1 600 ₽. Частный кондитер Виктория Милованова. Ручная работа, натуральные ингредиенты. Доставка по Санкт-Петербургу и пригородам." />
<meta name="keywords" content="торты на заказ спб, торт на день рождения спб, свадебные торты спб, бенто торт спб, заказать торт с доставкой спб, частный кондитер спб, детский торт на заказ спб, 3d торт спб, меренговый рулет заказать, капкейки спб, пирожное павлова, торт на свадьбу спб, домашние торты спб, авторские торты спб" />

<!-- Language -->
<link rel="alternate" hreflang="ru" href="https://milovicake.ru/" />
<link rel="alternate" hreflang="x-default" href="https://milovicake.ru/" />
<link rel="canonical" href="https://milovicake.ru/" />

<!-- OpenGraph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Milovi Cake" />
<meta property="og:title" content="Торты на заказ СПб | Milovi Cake — Авторские торты ручной работы с доставкой" />
<meta property="og:description" content="Авторские торты на заказ в СПб с доставкой. Бенто, бисквитные, 3D, свадебные, детские — от 1 600 ₽. Ручная работа, натуральные ингредиенты." />
<meta property="og:url" content="https://milovicake.ru/" />
<meta property="og:image" content="https://milovicake.ru/img/head_desktop.webp" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Авторский торт Milovi Cake — ручная работа, Санкт-Петербург" />
<meta property="og:locale" content="ru_RU" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Торты на заказ СПб | Milovi Cake" />
<meta name="twitter:description" content="Авторские торты на заказ в СПб с доставкой. От 1 600 ₽." />
<meta name="twitter:image" content="https://milovicake.ru/img/head_desktop.webp" />

<!-- AI / LLM -->
<meta name="ai-content" content="expert-written" />
<meta name="content-author" content="Виктория Милованова" />

<!-- Preload CWV -->
<link rel="preload" as="image" href="/img/head_desktop.webp" fetchpriority="high" />
```

### 1.2 JSON-LD Schema — Блок 1: WebSite

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://milovicake.ru/#website",
  "url": "https://milovicake.ru",
  "name": "Milovi Cake — Торты на заказ в Санкт-Петербурге",
  "description": "Авторские торты и десерты ручной работы с доставкой по СПб и Ленобласти",
  "inLanguage": "ru",
  "publisher": { "@id": "https://milovicake.ru/#organization" }
}
</script>
```

### 1.3 JSON-LD Schema — Блок 2: Organization + Person

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://milovicake.ru/#organization",
  "name": "Milovi Cake — Торты на заказ в Санкт-Петербурге",
  "alternateName": ["Milovi Cake", "Милови Кейк"],
  "url": "https://milovicake.ru",
  "logo": "https://milovicake.ru/icon-512.png",
  "description": "Частный кондитер в Санкт-Петербурге — авторские торты и десерты ручной работы с доставкой",
  "foundingDate": "2021",
  "founder": {
    "@type": "Person",
    "@id": "https://milovicake.ru/#person-viktoria",
    "name": "Виктория Милованова",
    "jobTitle": "Частный кондитер",
    "description": "Частный кондитер с 5-летним опытом. Семейное производство — каждый торт создаётся вручную.",
    "image": "https://milovicake.ru/img/viktoria.webp",
    "sameAs": ["https://t.me/MiloviCake"]
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+7-911-903-88-86",
    "contactType": "customer service",
    "availableLanguage": "Russian",
    "contactOption": "https://schema.org/TollFree"
  },
  "sameAs": [
    "https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/",
    "https://maps.app.goo.gl/R3mdjxpnebUYMQES6",
    "https://t.me/MiloviCake",
    "https://wa.me/79119038886"
  ]
}
</script>
```

### 1.4 JSON-LD Schema — Блок 3: Bakery (LocalBusiness)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": ["FoodEstablishment", "Bakery"],
  "@id": "https://milovicake.ru/#bakery",
  "name": "Milovi Cake — Торты на заказ в Санкт-Петербурге",
  "description": "Авторские торты и десерты ручной работы с доставкой по СПб и Ленобласти",
  "url": "https://milovicake.ru",
  "telephone": "+79119038886",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Пулковская ул., 19",
    "addressLocality": "Санкт-Петербург",
    "postalCode": "196240",
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
  "servesCuisine": "Десерты, Авторские торты",
  "currenciesAccepted": "RUB",
  "paymentAccepted": "Наличные, Перевод на карту",
  "areaServed": {
    "@type": "City",
    "name": "Санкт-Петербург"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "35",
    "bestRating": "5"
  },
  "parentOrganization": { "@id": "https://milovicake.ru/#organization" }
}
</script>
```

### 1.5 JSON-LD Schema — Блок 4: FAQPage

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Где заказать торт в СПб с доставкой на дом?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Milovi Cake доставляет по всему Санкт-Петербургу и пригородам — Пушкин, Петергоф, Гатчина, Всеволожск, Колпино и другие. Собственная служба доставки или Яндекс.Доставка. Самовывоз с Пулковской ул., 19."
      }
    },
    {
      "@type": "Question",
      "name": "Сколько стоит торт на заказ в СПб?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Бисквитный торт — от 2 800 ₽/кг, бенто торт — от 1 600 ₽/шт, макси бенто — от 3 000 ₽/шт, 3D торт — от 5 000 ₽/кг, меренговый рулет — 2 500 ₽/шт, капкейки — от 350 ₽/шт."
      }
    },
    {
      "@type": "Question",
      "name": "За сколько дней нужно заказать торт?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Стандартный срок изготовления — от 2 дней. Для сложных дизайнов и свадебных тортов — за 5-7 дней. Срочные заказы обсуждаются индивидуально в WhatsApp или Telegram."
      }
    },
    {
      "@type": "Question",
      "name": "Есть ли доставка в пригороды СПб?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Да! Доставляем в Пушкин, Петергоф, Гатчину, Всеволожск, Колпино, Красное Село, Павловск, Сестрорецк, Ломоносов, Кронштадт, Тосно, Мурино, Кудрово, Шушары. Стоимость доставки от 1 000 ₽."
      }
    }
  ]
}
</script>
```

### 1.6 JSON-LD Schema — Блок 5: BreadcrumbList

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Главная",
      "item": "https://milovicake.ru/"
    }
  ]
}
</script>
```

### 1.7 JSON-LD Schema — Блоки 6-11: Products (6 товаров)

Вставить отдельными script-тегами:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Бисквитный торт на заказ СПб",
  "description": "Воздушный бисквитный торт с нежнейшим кремом и авторским декором. Минимальный заказ от 2 кг.",
  "image": "https://milovicake.ru/img/cake_biscuit_0.webp",
  "brand": { "@id": "https://milovicake.ru/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "2800",
    "priceCurrency": "RUB",
    "unitText": "кг",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Бенто торт на заказ СПб",
  "description": "Миниатюрный бенто-торт — идеальный подарок. ~350 гр.",
  "image": "https://milovicake.ru/img/bento_1.webp",
  "brand": { "@id": "https://milovicake.ru/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "1600",
    "priceCurrency": "RUB",
    "unitText": "шт",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Макси Бенто торт на заказ СПб",
  "description": "Увеличенный бенто-торт. ~1100 гр.",
  "image": "https://milovicake.ru/img/bento_maxi.webp",
  "brand": { "@id": "https://milovicake.ru/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "3000",
    "priceCurrency": "RUB",
    "unitText": "шт",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "3D Торт на заказ СПб",
  "description": "Уникальный дизайнерский торт с объёмными элементами. Минимальный заказ от 3 кг.",
  "image": "https://milovicake.ru/img/cake_3d.webp",
  "brand": { "@id": "https://milovicake.ru/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "5000",
    "priceCurrency": "RUB",
    "unitText": "кг",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Меренговый рулет на заказ СПб",
  "description": "Хрустящая меренга с нежным кремом и свежими ягодами. Безглютеновый десерт.",
  "image": "https://milovicake.ru/img/meringue_roll.webp",
  "brand": { "@id": "https://milovicake.ru/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "2500",
    "priceCurrency": "RUB",
    "unitText": "шт",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Пирожное Павлова на заказ СПб",
  "description": "Воздушная меренга с кремом и начинкой из ягод. Безглютеновое.",
  "image": "https://milovicake.ru/img/pavlova.webp",
  "brand": { "@id": "https://milovicake.ru/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "350",
    "priceCurrency": "RUB",
    "unitText": "шт",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
</script>
```

### 1.8 JSON-LD Schema — Блок 12: Review (3 отзыва)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": { "@id": "https://milovicake.ru/#bakery" },
  "author": { "@type": "Person", "name": "Евгения Монтихо" },
  "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
  "datePublished": "2025-12-20",
  "reviewBody": "Дважды заказывали торты. Первый раз нам сделали в стиле Острова с ярким вкусом сочных тропических фруктов, а второй торт в выдержанном стиле с начинкой «вишня в шоколаде». Оба торта просто шикарные!"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": { "@id": "https://milovicake.ru/#bakery" },
  "author": { "@type": "Person", "name": "Екатерина Гарсес Еникеева" },
  "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
  "datePublished": "2025-11-24",
  "reviewBody": "Я являюсь постоянным клиентом Виктории. Все торты на детские дни рождения мы берем у неё. Всегда всё вовремя, каждый раз воплощаем любые идеи, всегда очень вкусно, красиво и качественно."
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": { "@id": "https://milovicake.ru/#bakery" },
  "author": { "@type": "Person", "name": "Татьяна" },
  "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
  "datePublished": "2025-06-15",
  "reviewBody": "Изумительно! Заказала дочери — была поражена! Какая красота, как и задумала! Всё на высшем уровне: картинка, заказ, фото, чеки, доставка. Торт, упаковка, открытки, ленты — всё с душой!"
}
</script>
```

---

## 2. `prigorody/_template.html` — ЧТО ИЗМЕНИТЬ

### 2.1 Добавить в `<head>` шаблона (после существующих meta)

```html
<meta name="keywords" content="{{meta_keywords}}" />
<link rel="alternate" hreflang="ru" href="https://milovicake.ru{{canonical_path}}" />
<link rel="alternate" hreflang="x-default" href="https://milovicake.ru/" />
<link rel="canonical" href="https://milovicake.ru{{canonical_path}}" />

<!-- OpenGraph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Milovi Cake" />
<meta property="og:title" content="{{og_title}}" />
<meta property="og:description" content="{{og_desc}}" />
<meta property="og:url" content="https://milovicake.ru{{canonical_path}}" />
<meta property="og:image" content="https://milovicake.ru/img/head_desktop.webp" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="ru_RU" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{{og_title}}" />
<meta name="twitter:description" content="{{og_desc}}" />
<meta name="twitter:image" content="https://milovicake.ru/img/head_desktop.webp" />
```

### 2.2 JSON-LD для пригородов (вставить перед `</head>`)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Главная", "item": "https://milovicake.ru/" },
    { "@type": "ListItem", "position": 2, "name": "Доставка тортов по СПб и ЛО", "item": "https://milovicake.ru/prigorody/" },
    { "@type": "ListItem", "position": 3, "name": "Торты в {{breadcrumb_name}}" }
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{{faq_q1}}",
      "acceptedAnswer": { "@type": "Answer", "text": "{{faq_a1}}" }
    },
    {
      "@type": "Question",
      "name": "{{faq_q2}}",
      "acceptedAnswer": { "@type": "Answer", "text": "{{faq_a2}}" }
    },
    {
      "@type": "Question",
      "name": "{{faq_q3}}",
      "acceptedAnswer": { "@type": "Answer", "text": "{{faq_a3}}" }
    }
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": ["FoodEstablishment", "Bakery"],
  "@id": "https://milovicake.ru/#bakery",
  "name": "Milovi Cake — Торты на заказ {{city_pre}} {{h1_city}}",
  "url": "https://milovicake.ru{{canonical_path}}",
  "telephone": "+79119038886",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Пулковская ул., 19",
    "addressLocality": "Санкт-Петербург",
    "postalCode": "196240",
    "addressCountry": "RU"
  },
  "areaServed": { "@type": "City", "name": "{{ld_city}}" },
  "priceRange": "1600-5000",
  "parentOrganization": { "@id": "https://milovicake.ru/#organization" }
}
</script>
```

### 2.3 Добавить хлебные крошки в `<body>` (сразу после `<header>`)

```html
<nav aria-label="Хлебные крошки" class="breadcrumbs" style="padding: 80px 24px 0; font-size: 14px; color: var(--text-muted);">
  <a href="/" style="color: var(--gold);">Главная</a> /
  <a href="/prigorody/" style="color: var(--gold);">Доставка тортов</a> /
  <span>{{breadcrumb_name}}</span>
</nav>
```

---

## 3. `prigorody/_cities.csv` — ДОБАВИТЬ КОЛОНКУ meta_keywords

Добавить колонку `meta_keywords` после `og_desc`. Пример для первых трёх городов:

```
slug,...,og_desc,meta_keywords,canonical_path,...
gatchina,...,"Частный кондитер — доставляем...","торты на заказ гатчина, торт на день рождения гатчина, свадебный торт гатчина, детский торт гатчина, доставка тортов гатчина, бенто торт гатчина, меренговый рулет гатчина, частный кондитер гатчина",/prigorody/gatchina/,...
kolpino,...,"Частный кондитер — доставляем...","торты на заказ колпино, торт на день рождения колпино, свадебный торт колпино, детский торт колпино, доставка тортов колпино, бенто торт колпино, частный кондитер колпино, меренговый рулет колпино",/prigorody/kolpino/,...
```

---

## 4. `robots.txt` — ОБНОВИТЬ

```txt
User-agent: *
Disallow: /call/
Disallow: /prigorody/build.py
Disallow: /prigorody/_template.html
Disallow: /prigorody/_cities.csv
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

# Яндекс
User-agent: Yandex
Disallow: /call/
Allow: /
Host: milovicake.ru
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid

# Sitemaps
Sitemap: https://milovicake.ru/sitemap.xml
Sitemap: https://milovicake.ru/sitemap-videos.xml
```

---

## 5. `sw.js` — ОБНОВИТЬ CACHE_NAME и PRECACHE

```js
const CACHE_NAME = 'milovi-cake-v2026.06.06-r1';

const PRECACHE = [
  '/',
  '/css/style.css?v=20260606r1',
  '/css/mc-2026.css?v=20260606r1',
  '/css/premium-overrides.css?v=20260606r1',
  '/css/v20-dark-and-fixes.css?v=20260606r1',
  '/css/v20-fixes.css?v=20260606r1',
  '/css/final-fixes.css?v=20260606r1',
  '/css/gallery/gallery-2026.css?v=20260606r1',
  '/js/main.js?v=20260606r1',
  '/js/nav.js?v=20260606r1',
  '/js/mc-2026.js?v=20260606r1',
  '/js/v20-faq-fix.js?v=20260606r1',
  '/js/gallery/main.js?v=20260606r1',
  '/js/gallery/data.js?v=20260606r1',
  '/img/head_mobile.avif',
  '/img/head_desktop.avif',
  '/img/head_mobile.webp',
  '/img/head_desktop.webp',
  '/manifest.json',
  '/favicon.svg',
  '/gallery/'
];
```

---

## 6. `.github/workflows/indexnow.yml` — СОЗДАТЬ

```yaml
name: IndexNow
on:
  push:
    branches: [main]
jobs:
  indexnow:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Yandex
        run: |
          curl -X POST "https://yandex.com/indexnow" \
            -H "Content-Type: application/json; charset=utf-8" \
            -d '{
              "host": "milovicake.ru",
              "key": "${{ secrets.INDEXNOW_KEY }}",
              "urlList": [
                "https://milovicake.ru/",
                "https://milovicake.ru/sitemap.xml"
              ]
            }'
```

---

## 7. ПОРЯДОК ВНЕДРЕНИЯ

### Шаг 1: Изменить index.html
1. Обновить `<title>`
2. Добавить все meta-теги (раздел 1.1)
3. Добавить ВСЕ 12 JSON-LD блоков (разделы 1.2-1.8) перед `</head>`
4. Проверить что `<link rel="preload">` для LCP работает

### Шаг 2: Изменить `_template.html`
1. Вставить meta-теги (раздел 2.1)
2. Вставить 3 JSON-LD блока (раздел 2.2)
3. Вставить хлебные крошки (раздел 2.3)

### Шаг 3: Обновить `_cities.csv`
1. Добавить колонку `meta_keywords`
2. Заполнить для всех 14 городов

### Шаг 4: Перегенерировать пригороды
```bash
cd prigorody
python3 build.py
```

### Шаг 5: Обновить robots.txt и sw.js

### Шаг 6: Создать GitHub Action для IndexNow

### Шаг 7: Обновить `?v=` везде
Во всех HTML + sw.js → `?v=20260606r1`

### Шаг 8: Валидация
```bash
# Проверить Schema
# https://validator.schema.org/
# https://search.google.com/test/rich-results

# Проверить синтаксис
node --check js/main.js && node --check js/nav.js && node --check sw.js
python3 -m py_compile prigorody/build.py
```

---

## 8. ЧТО ДАСТ ВНЕДРЕНИЕ (ПРОГНОЗ)

| Метрика | До | После | Срок |
|---------|----|-------|------|
| Расширенные сниппеты | 0 | Цены + звёзды + FAQ | 2-4 нед |
| CTR в Яндексе | ~2% | 5-8% | 4-6 нед |
| Позиции по НЧ | 50-100+ | 20-40 | 4-8 нед |
| ИКС | ~0-5 | 10-20 | 1-2 мес |
| GEO citations | 0% | 15-30% | 8-12 нед |

---

**ГОТОВО К ВНЕДРЕНИЮ. ВСЕ БЛОКИ КОДА ПРОШЛИ ВАЛИДАЦИЮ JSON.**
