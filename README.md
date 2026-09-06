# Milovi Cake — сайт кондитера

[![Cake Sanity](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/cake-sanity.yml/badge.svg)](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/cake-sanity.yml)
[![Production Smoke](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/production-smoke.yml/badge.svg)](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/production-smoke.yml)
[![Lighthouse](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/lighthouse.yml/badge.svg)](https://github.com/FedorMilovanov/Milovi_Cake/actions/workflows/lighthouse.yml)
[![Domain](https://img.shields.io/badge/domain-milovicake.ru-c9934a)](https://milovicake.ru/)
[![Stack](https://img.shields.io/badge/stack-vanilla_HTML%2FCSS%2FJS-8a5a2b)](#)

Премиальный статический сайт авторских тортов и десертов ручной работы — [milovicake.ru](https://milovicake.ru).

Без сборщика и без runtime-зависимостей: чистый HTML / CSS / JS + Python-скрипт генерации страниц пригородов. Хостинг — GitHub Pages.

## Текущий production-статус

- Режим работы: **Пн–Сб, 10:00–20:00**.
- Release identity: **exact Git SHA** из live `/release.json`; cache revisions проверяются per-asset через `npm run audit:release`.
- `npm run qa` — JS/privacy/a11y/release/security/site audit + idempotency пригородов + Playwright desktop/mobile/responsive matrix.
- `npm run smoke:prod` — transport/content smoke; `npm run smoke:prod:release` — exact SHA + privacy + true 404 contract.
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
├── sitemap-videos.xml            # Активная video sitemap для проверенных self-hosted gallery videos
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
├── js/                           # Runtime JS allowlist (без npm/runtime dependencies)
│   ├── main.js                   # Каталог, корзина, калькулятор, отзывы, темы
│   ├── nav.js                    # Мобильная навигация
│   ├── mc-2026.js                # Дополнительные UX-улучшения
│   ├── v20-faq-fix.js            # Фикс FAQ для пригородов/контактов
│   ├── consent-analytics.js       # Privacy-first analytics loader
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
│   ├── a11y_static.py            # Permanent conformance guards
│   ├── release_contract.py       # Exact asset→revision contract
│   ├── check_prigorody_idempotent.py
│   ├── production_smoke.py       # Transport/content live smoke
│   ├── production_release_smoke.py # Exact SHA/privacy/404 live smoke
│   └── submit_indexnow.py        # IndexNow submit/dry-run
│
├── tests/                        # Playwright QA
│   ├── landing-smoke.spec.js
│   ├── theme-smoke.spec.js
│   ├── protected-interactions.spec.js
│   ├── overlap-smoke.spec.js
│   └── layout-matrix.spec.js
│
└── .github/workflows/
    ├── cake-sanity.yml           # npm run qa on PR/manual
    ├── deep-polish-audit.yml      # PR-only deep source/browser/Pages contract
    ├── repository-hygiene.yml    # PR + main supply-chain/repository guard
    ├── branch-cleanup.yml         # cleanup temporary/merged PR branches
    ├── deploy.yml                 # main → QA → sanitized Pages → exact-SHA witness/smoke → IndexNow
    ├── production-smoke.yml      # scheduled live smoke + exact release semantics
    └── lighthouse.yml            # post-deploy performance/accessibility telemetry
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

1. Runtime JS + Service Worker syntax check.
2. Privacy/analytics contract.
3. Static a11y/conformance guards.
4. Exact asset→revision release contract.
5. IP/customer-copy contract.
6. Video structured-data provenance/timezone contract.
7. Prigorody idempotency.
8. `npm audit --audit-level=high` + `scripts/audit.py`.
9. Playwright desktop/mobile + responsive matrix.

### Быстрые проверки

```bash
npm run audit:js
npm run audit
npm run test:playwright
```

### Visual regression (для рискованных правок CSS/HTML)

```bash
# 1) до правки
python3 -m http.server 8765 &
npm run visual:snapshot -- /tmp/snap-before http://localhost:8765

# 2) делаешь правку

# 3) после
npm run visual:snapshot -- /tmp/snap-after  http://localhost:8765
npm run visual:diff     -- /tmp/snap-before /tmp/snap-after
```

Снимает 14 ключевых состояний: главная light/dark/mobile, hero WA/TG/MAX hover («подлётная надпись»), галерея, lightbox, коммерческие лендинги, prigorody, отзывы. Порог: > 0.1 % значимых пикселей = FAIL.

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

IndexNow встроен в `.github/workflows/deploy.yml`: URL отправляются **только после** успешного deploy, exact-SHA live witness и production smoke. Отдельного `indexnow.yml` в текущей архитектуре нет.

## CSS / JS budget

Аудит использует production-метрику gzip transfer size:

- CSS gzip budget: 100 KB.
- JS gzip budget: 80 KB.
- Total CSS+JS gzip budget: 180 KB.

Raw CSS/JS totals выводятся как INFO, не как deploy-blocker. `!important` debt зафиксирован per-file baseline-бюджетом в `scripts/audit.py`: исторический protected debt допускается, но любое превышение baseline является **ошибкой/FAIL**, а не warning.

## Деплой

GitHub Pages: push в `main` запускает публикацию.

При изменении runtime CSS/JS обновляется revision **только изменённого asset**:

- все HTML/ESM ссылки именно на этот asset;
- exact entry этого же asset в `sw.js` `PRECACHE`;
- `prigorody/_template.html` + `python3 prigorody/build.py`, если asset подключён на generated suburb pages;
- `CACHE_NAME` менять только при осознанном изменении Service Worker cache namespace/semantics, а не автоматически для каждого asset bump;
- затем обязательно `npm run audit:release`.

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
