# Milovi Cake — сайт кондитера

[![Cake Sanity](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/cake-sanity.yml/badge.svg)](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/cake-sanity.yml)
[![Production Smoke](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/production-smoke.yml/badge.svg)](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/production-smoke.yml)
[![Domain](https://img.shields.io/badge/domain-milovicake.ru-c9934a)](https://milovicake.ru/)
[![Stack](https://img.shields.io/badge/stack-vanilla_HTML%2FCSS%2FJS-8a5a2b)](#)

Премиальный статический сайт авторских тортов и десертов ручной работы — [milovicake.ru](https://milovicake.ru).

Без сборщика и без runtime-зависимостей: чистый HTML / CSS / JS + Python-скрипт генерации страниц пригородов. Хостинг — GitHub Pages.

## Текущий production-статус

- Режим работы: **Пн–Сб, 10:00–20:00**.
- Cache-bust / SW: **`20260605r58` / `milovi-cake-v2026.06.05-r58`**.
- `npm run qa` — полный локальный QA: JS, пригороды, Python-аудит, Playwright desktop/mobile.
- `npm run smoke:prod` — smoke live-сайта `milovicake.ru`.
- `scripts/audit.py` проверяет SEO, JSON-LD, sitemap coverage, business hours, protected UI contracts, gzip budgets, ссылки, a11y basics, PWA/SW.
- Playwright защищает hero WhatsApp/Telegram/MAX hover, отзывы, модалки, лендинги, light/dark UI, landing media.

## Структура проекта

```
/
├── index.html                    # Главная страница
├── 404.html                      # Страница ошибки
├── manifest.json                 # PWA-манифест
├── sw.js                         # Service Worker (network-first HTML + stale-while-revalidate static)
├── robots.txt, sitemap.xml       # SEO / индексация
├── sitemap-videos.xml            # Видео-карта (шаблон, не заявлен в robots до реальных embed)
├── llms.txt                      # Публичный AI fact sheet + guardrails
├── f5c91a4d89e84b2ca6d4f3e7a1029b6c.txt # IndexNow key-file
├── favicon.svg, icon-*.png       # Иконки PWA и Apple Touch
│
├── css/                          # РОВНО 7 CSS-файлов
│   ├── style.css                 # Базовый визуальный слой + shared landing styles
│   ├── mc-2026.css               # Премиум-слой 2026: UX, доступность, CWV
│   ├── premium-overrides.css     # Финальные safe overrides + protected hero messenger blocks
│   ├── v20-dark-and-fixes.css    # Тёмная тема и фиксы
│   ├── v20-fixes.css             # Точечные хотфиксы
│   ├── final-fixes.css           # Финальные hero/CTA правки
│   └── gallery/gallery-2026.css  # Стили галереи
│
├── js/                           # РОВНО 6 runtime JS-файлов
│   ├── main.js                   # Каталог, корзина, калькулятор, отзывы, темы
│   ├── nav.js                    # Мобильная навигация
│   ├── mc-2026.js                # Дополнительные UX-улучшения
│   ├── v20-faq-fix.js            # Фикс FAQ для пригородов/контактов
│   └── gallery/                  # data.js + main.js галереи
│
├── img/                          # Оптимизированные изображения и видео галереи
│
├── gallery/                      # Галерея работ
├── meringue-roll/                # Меренговый рулет
├── certificates/                 # Сертификаты
├── call/                         # Техническая страница звонка (noindex, вне sitemap)
│
├── zakazat-tort-spb/             # Коммерческий лендинг: заказать торт СПб
├── tort-s-dostavkoy/             # Коммерческий лендинг: торт с доставкой
├── tort-na-den-rozhdeniya/       # Коммерческий лендинг: день рождения
├── bento-torty/                  # Коммерческий лендинг: бенто
├── detskie-torty/                # Коммерческий лендинг: детские торты
├── svadebnye-torty/              # Коммерческий лендинг: свадебные торты
├── o-konditere/                  # Trust/E-E-A-T: Виктория Милованова
├── dostavka-i-oplata/            # Коммерческие факторы: доставка/оплата
├── otzyvy/                       # Trust: отзывы клиентов
│
├── prigorody/                    # 14 гео-лендингов + хаб
│   ├── _template.html            # Единый шаблон с {{плейсхолдерами}}
│   ├── _cities.csv               # Данные всех городов
│   ├── build.py                  # Генератор страниц
│   └── <city>/index.html         # Автогенерация, руками не править
│
├── scripts/
│   ├── audit.py                  # Главный zero-dependency аудит
│   ├── check_prigorody_idempotent.py
│   ├── production_smoke.py       # Live smoke milovicake.ru
│   └── submit_indexnow.py        # IndexNow submit/dry-run
│
├── tests/                        # Playwright QA
│   ├── landing-smoke.spec.js
│   ├── theme-smoke.spec.js
│   └── protected-interactions.spec.js
│
└── .github/workflows/
    ├── cake-sanity.yml           # npm run qa on push/PR/manual
    ├── production-smoke.yml      # live smoke with retry window
    └── indexnow.yml              # IndexNow submit after relevant push
```

## SEO / AI / GEO архитектура

### Коммерческий кластер

- `/zakazat-tort-spb/` — общий коммерческий запрос «заказать торт СПб».
- `/tort-s-dostavkoy/` — доставка / «торт на дом».
- `/tort-na-den-rozhdeniya/` — день рождения / торт сестре / торт ребёнку.
- `/bento-torty/` — бенто / мини-торты / подарочные торты.
- `/detskie-torty/` — детские и 3D-торты.
- `/svadebnye-torty/` — свадебные торты, честная editorial-подача с реальным свадебным тортом и близкими по эстетике работами.
- `/meringue-roll/` — отдельный продуктовый лендинг.
- `/prigorody/<city>/` — локальные гео-лендинги.

### Trust / коммерческие факторы

- `/o-konditere/` — кто делает торты, опыт, подход.
- `/dostavka-i-oplata/` — доставка, самовывоз, ориентиры цен, подтверждение заказа.
- `/otzyvy/` — отзывы клиентов, Яндекс/Google trust.
- `/certificates/` — сертификаты и обучение.

### Structured data

- Главная использует один consolidated JSON-LD `@graph`.
- Индексируемые страницы имеют валидный JSON-LD.
- Аудит проверяет наличие JSON-LD, валидность JSON, дубли `@id`, обязательные типы главной.
- Лендинги используют WebPage / BreadcrumbList / LocalBusiness / Product / ItemList / FAQPage / ImageGallery / VideoObject / HowTo там, где уместно.

### `llms.txt`

`llms.txt` — публичный AI fact sheet: бренд, адрес, телефон, цены «от», страницы, география, правила точности для AI. Google не требует `llms.txt`, но файл полезен как структурированный факт-лист для AI-агентов и будущих ассистентов.

## Темы и визуальная система

- **Светлая тема:** кремовые поверхности (`#f5f0e8` / `#ede5d5`), глубокое золото (`#c9934a`) для интерактива, высокий контраст текста.
- **Тёмная тема:** off-black поверхности (`#1a1108` / `#1e1308`), мягкое золото (`#d4a76a`), без случайных светлых утечек в карточках и формах.
- **Иконки UI:** inline SVG; emoji допустимы только в текстах отзывов и сообщениях мессенджеров.
- **Анимации:** функциональные, с `prefers-reduced-motion`.
- **Touch target:** не ниже 44 px на мобильных.
- **FOUC protection:** тема применяется inline-скриптом до рендера.

## Защищённые UI-контракты

Не менять без явного согласования:

- Hero-мессенджеры главной: круглые inline-SVG WhatsApp / Telegram / MAX, ring text + flat text hover.
- Hover-анимация: flat label подлетает вверх, ring text мягко уходит.
- Цвета: WhatsApp `#25D366`, Telegram `#229ED9`, MAX `#7B5EE8` / `#8e74ee`.
- Классы: `messenger-group--ring`, `btn-hero-ring`, `.hero-ring-text`, `.hero-flat-text`.
- `js/main.js`: class/id fallback для messenger SVG.
- Premium reviews carousel, стрелки, modal Яндекс/Google.
- `buildCartKey` / `parseCartKey`.
- Theme icons: `.theme-icon--moon`, `.theme-icon--sun`.
- `prigorody/_template.html`: `<div class="lightbox" id="lightbox">`.

Эти контракты проверяются статически в `scripts/audit.py` и динамически в Playwright.

## Пригороды — генератор страниц

Все 14 страниц пригородов собираются из одного шаблона. Сгенерированные `prigorody/<city>/index.html` руками не редактировать.

**Изменить общий блок на всех страницах:**

```bash
python3 prigorody/build.py
```

**Проверить idempotency:**

```bash
python3 scripts/check_prigorody_idempotent.py
```

Если меняли `_cities.csv` или `_template.html`, затем обновить `sitemap.xml`, если добавлены/удалены URL.

## Локальный запуск

```bash
python3 -m http.server 8080
# открыть http://localhost:8080
```

Альтернатива:

```bash
npx serve .
```

## QA / проверки

### Полный локальный QA

```bash
npm install
npx playwright install chromium
npx playwright install-deps chromium
npm run qa
```

`npm run qa` запускает:

1. JS syntax check.
2. Prigorody idempotency.
3. `scripts/audit.py`.
4. Playwright desktop/mobile.

### Быстрые проверки

```bash
npm run audit:js
npm run audit
npm run test:playwright
```

### Production smoke

```bash
npm run smoke:prod
npm run smoke:prod:retry
```

Проверяет live `https://milovicake.ru`: 200 по ключевым URL, актуальную версию, часы, sitemap coverage, отсутствие `/call/` в sitemap, IndexNow key-file.

### IndexNow

```bash
npm run indexnow:dry-run
npm run indexnow:submit
```

Workflow `.github/workflows/indexnow.yml` автоматически отправляет URL из sitemap после релевантных push.

## CSS / JS budget

Аудит использует production-метрику gzip transfer size:

- CSS gzip budget: 100 KB.
- JS gzip budget: 80 KB.
- Total CSS+JS gzip budget: 180 KB.

Raw CSS/JS totals выводятся как INFO, не как deploy-blocker. Текущий `!important` debt зафиксирован baseline-бюджетом: аудит не шумит на исторический protected debt, но предупредит, если будущая правка увеличит количество `!important` сверх baseline.

## Деплой

GitHub Pages: push в `main` запускает публикацию.

При изменении CSS/JS обязательно поднять `?v=` синхронно:

- все HTML;
- `js/gallery/main.js` ESM import `data.js`;
- `sw.js` `CACHE_NAME` и `PRECACHE`;
- `prigorody/_template.html`, затем `python3 prigorody/build.py`.

После deploy:

```bash
npm run smoke:prod:retry
npm run indexnow:submit
```

## Изображения и видео

- Основные форматы: WebP / AVIF.
- PNG — только для PWA/icon assets.
- Видео галереи `.webm` не кэшируются Service Worker как static blobs; range/video requests bypass.
- Для патч-архива без медиа исключать `img/`, видео, `.git`, `node_modules`, Playwright artifacts.

## Контакт

Виктория Милованова — [milovicake.ru](https://milovicake.ru)
