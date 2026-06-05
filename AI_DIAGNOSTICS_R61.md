# 🔍 ПОЛНАЯ ДИАГНОСТИКА: Что сломал предыдущий AI (r61)

**Дата аудита:** 2026-06-06  
**Коммиты под разбором:** `bf67000` (premium responsive mobile) + `1f5e109` (smooth silk theme) + предыдущие `08cd4f4` (Premium 2026 v4.0) + `2668646` (Advanced reveal) + `797b8d4` (Lux Upgrade v3.0)  
**Резюме:** AI действовал в стиле «люксового винтажного кондитера», а не в вашем премиум-минимализме. Вместо исправления багов он добавил 120+ `!important`, чужие цвета, тяжёлые эффекты и потенциальные регрессии.

---

## 1. «Самодеятельность» — эффекты, которых не просили

Предыдущий AI добавил массу «красивостей», которые не были в ТЗ. Вот конкретный список:

### ❌ В `css/v20-fixes.css` (коммит r61)
- **Frosted glass blur** на всё: `backdrop-filter: blur(20px) saturate(130%)` на мобильную навигацию, `blur(24px)` на выдвижные панели, `blur(10px)` на кнопку «наверх».
- **Glow и тени**: `box-shadow` с 3-4 слоями на карточки, кнопки, меню.
- **Scale-эффекты на тач**: `:active { transform: scale(0.96) }` на кнопки, карточки, пункты меню — добавляет «пружинку» там, где был тихий минимализм.
- **MC-Order-Badge**: белый кружок с золотой цифрой на нижней мобильной панели — это новый элемент, которого не было в вашем дизайне.
- **Safe-area padding**: принудительный `padding-bottom: calc(88px + env(...))` на футер, about, landing-footer — может создавать лишние пустоты на Android без notch.

### ❌ В `css/mc-2026.css` (коммиты v3.0 / v4.0)
- **Reveal-анимации с blur**: `filter: blur(12px) saturate(0.8)` + `transform: translateY(40px) scale(0.96)` при появлении карточек. Это «кинематографично», но не минималистично.
- **Scroll-driven parallax**: `@supports (animation-timeline: scroll())` — двигает фон hero при скролле. Тяжело для GPU, особенно на средних Android.
- **Magnetic hover**: `translateY(-8px) scale(1.01)` на карточки при наведении — снова не минимализм.
- **Custom scrollbar**: перекрашен скроллбар в золотой — в премиум-минимализме обычно оставляют нативный.
- **Content-visibility**: `content-visibility: auto` на секции — теоретически для performance, но на практике может ломать высоту страницы и поисковую индексацию контента.
- **Container queries**: `@container product (max-width: 320px)` — избыточная сложность для статического сайта.
- **`:has()` селекторы**: `.product-card:has(.product-badge)` — не работают в Firefox, создают непредсказуемый cascade.

### ❌ В `css/premium-overrides.css`
- **Shimmer на кнопках**: `@keyframes shimmerBtnOnce` — блик проходящий по кнопке при наведении. Это «Виктория-эффект» — выглядит как украшение торта, а не UI.
- **Glow на ценах**: `@keyframes priceGlowOnce` — `text-shadow: 0 0 22px rgba(201,147,74,0.55)`. Цена начинает светиться.
- **Shimmer на заголовках**: `@keyframes titleShimmerOnce` — тот же блик на `.section-title`.
- **3D-rotate на delivery-карточках**: `rotateX(6deg) rotateY(-5deg)` при hover на `.delivery-card__item` — выглядит как реклама iPhone 2007 года, а не кондитерский сайт.
- **Синий цвет на hover hero-заголовка** (!!!):
  ```css
  .hero-title-seo .w:hover {
    color: rgba(160, 210, 255, 0.92) !important; /* ЛЕДЯНОЙ СИНИЙ */
  }
  ```
  Это главный признак «чужого стиля». Ваш бренд — тёплое золото и коричневый, а тут вдруг ледяной голубой. Возможно, AI референсил какой-то «скандинавский минимализм» или «викторианский» (отсюда и «Виктория» в вашем восприятии).

### ❌ В `js/mc-2026.js`
- **View Transitions API**: перехватывает КАЖДЫЙ клик по внутренней ссылке и делает `document.startViewTransition(...)` — это может ломать:
  - Яндекс.Метрику (цели не фиксируются при preventDefault)
  - Якорные ссылки (`#catalog`, `#contacts`)
  - Скрипты отслеживания конверсий
  - Навигацию "Назад" в браузере (VT API имеет баги в Safari)
- **Prefetch on hover**: создаёт `<link rel="prefetch">` при наведении на каждую ссылку — на мобильном бесполезно, а на десктопе грузит лишний трафик.
- **Network Information API**: отключает анимации на `2g` — хорошая идея, но реализовано через добавление класса `reduce-motion`, который конфликтует с `prefers-reduced-motion` медиа-запросом.

---

## 2. «Виктория» и чужой дизайн — почему AI пошёл не туда

Вы правы — AI пошёл не в ваш стиль. Вот объективные доказательства:

| Ваш стиль (AGENTS.md) | Что добавил AI | Где в коде |
|---|---|---|
| Тёплое золото `#c9934a`, `#d4a76a` | **Ледяной синий** `rgba(160, 210, 255, 0.92)` | `premium-overrides.css` — `.hero-title-seo .w:hover` |
| Чёрная иконка телефона в `#contacts` | Белый badge с золотой цифрой в мобильном меню | `js/nav.js` + `v20-fixes.css` `.mc-order-badge` |
| Простые hover-эффекты | Shimmer, glow, 3D rotate, magnetic hover | `premium-overrides.css` — `shimmerBtnOnce`, `priceGlowOnce`, `titleShimmerOnce` |
| Нативный скроллбар | Кастомный золотой скроллбар | `mc-2026.css` — `::-webkit-scrollbar` |
| Тихие transitions | Spring physics, blur, scale, 0.4s silk | `mc-2026.css` + `v20-fixes.css` |
| Минимум `!important` | **+120 `!important`** только в v20-fixes.css | `git diff` показывает 120 новых `!important` |

AI видимо интерпретировал «премиум» как «больше эффектов» — shimmer, glow, frosted glass, parallax. Это стиль «Apple Store 2023» или «крипто-стартап», а не тихий кондитерский минимализм.

---

## 3. День/ночь — Silk Transition: что сломано и что работает

### Что добавил AI в `v20-fixes.css`:
```css
body, header, main, section, footer, .site-header, .product-card, ... {
  transition: 
    background 0.4s ease,
    background-color 0.4s ease,
    color 0.4s ease,
    border-color 0.4s ease,
    box-shadow 0.4s ease !important;
}
```

### Оценка:
- ✅ **Работает**: переключение темы теперь плавное (0.4s растворение), а не резкое.
- ❌ **Конфликт**: в `mc-2026.css` уже есть transitions на тех же элементах:
  ```css
  .reveal {
    transition: opacity 0.9s ..., transform 0.9s ..., filter 0.9s ...;
  }
  ```
  Когда включается dark mode, `.reveal` элементы начинают «моргать» — одновременно срабатывают silk-transition (0.4s) и reveal-transition (0.9s).
- ❌ **Performance**: `transition` на `box-shadow` и `background` одновременно для ВСЕХ элементов — это тяжело для compositor. На слабом Android может быть заметный лаг при переключении.
- ❌ **Hero-мессенджеры**: в `v20-fixes.css` есть правило `html[data-theme="dark"] .hero-content { background: transparent !important; }` — это хорошо, но AI не проверил, что при плавном transition может быть промежуточный серый/фиолетовый оттенок на полупрозрачных слоях.
- ⚠️ **Dark mode refinements**: AI добавил ещё один слой тёмной темы в `v20-fixes.css` (блок 7), дублируя `v20-dark-and-fixes.css`. Теперь тёмная тема определяется в **трёх** файлах одновременно — это мина замедленного действия.

### Рекомендация по день/ночь:
- Silk transition — идея хорошая, но реализация через `!important` на ВСЕ элементы — это грубый хак.
- Лучше: transition только на `:root` переменные (`--cream`, `--text`, `--card-bg`), а не на каждый элемент отдельно.

---

## 4. Мобильная версия — баги, конфликты, регрессии

### 🔴 Критично: Conflicting CSS
| Селектор | `v20-fixes.css` (r61) | `mc-2026.css` (v3.0) | Результат |
|---|---|---|---|
| `.product-footer` | `flex-direction: column !important` (max-width: 768px) | `display: flex !important; align-items: center !important; justify-content: space-between !important` (max-width: 768px) | **Конфликт !important** — поведение непредсказуемо, зависит от порядка загрузки |
| `.product-footer` (max-width: 360px) | — | `flex-direction: column !important` | Два разных breakpoint'а для одного и того же |
| `.btn-add` | `width: 100% !important; border-radius: 50px !important` | `background: var(--gold-acc) !important` | Кнопка стала коричневой (`#8a5e23`) и растянутой на всю ширину — не ваш золотой |
| `.price` | `color: var(--brown) !important` | `color: var(--brown) !important` | Одинаково, но в тёмной теме `v20-fixes.css` переопределяет в `var(--gold)` — непредсказуемо |

### 🔴 Критично: Цвет кнопок
В `mc-2026.css`:
```css
:root {
  --gold-acc: #8a5e23;        /* КОРИЧНЕВЫЙ, а не золотой */
  --gold-acc-hover: #6f4a18;  /* Тёмно-коричневый */
}
```
А затем:
```css
.btn-add {
  background: var(--gold-acc, #8a5e23) !important;
}
```
**Результат:** кнопки «Заказать» в мобильной версии теперь коричневые, а не золотые. Это прямое нарушение бренда.

### 🟡 Потенциальные баги:
1. **Backdrop-filter на мобильной навигации**: `blur(20px) saturate(130%)` + `blur(24px)` на панели — на iPhone 8/SE и старых Android это вызывает лаги скролла и артефакты рендеринга.
2. **Cart badge в мобильном меню**: добавлен `<span class="mc-order-badge" id="mcCartNavBadge">0</span>` — синхронизируется с `main.js` (спасибо `[data-cart-badge]`), но визуально это новый элемент, который перекрывает иконку и может съезжать на маленьких экранах (<360px).
3. **Scroll-to-top**: `.back-to-top` с `bottom: calc(82px + env(safe-area-inset-bottom))` — на iPhone с notch кнопка может уходить за пределы экрана или перекрываться нижней панелью Safari.
4. **Content-visibility**: `content-visibility: auto` на `#catalog`, `#fillings` — может ломать поиск по странице (Ctrl+F) и скринридеры, если браузер не успевает отрисовать содержимое.
5. **View Transitions API**: на мобильном Safari 16-17 VT API работает плохо, страницы могут «зависать» на полупрозрачном overlay.

### 🟢 Что работает хорошо:
- `.product-footer { flex-direction: column }` — действительно решает проблему перекрытия цены и кнопки на узких экранах.
- `.calc-options { width: 100% }` — калькулятор растянут, не сжат.
- `env(safe-area-inset-bottom)` — правильно используется для iPhone.
- Badge корзины синхронизирован с `updateCartUI`.

---

## 5. Почему багов стало больше, а не меньше

| Ожидание | Реальность |
|---|---|
| Исправить мобильную вёрстку | +290 строк CSS, +120 `!important`, 3 новых конфликта |
| Проверить день/ночь | +глобальный transition на ВСЕ элементы, дублирование тёмной темы |
| Премиум минимализм | +shimmer, +glow, +3D rotate, +parallax, +frosted glass, +синий цвет |
| Не трогать protected-зоны | Hero-title получил ледяной синий hover |
| Прогнать тесты | Playwright не запускается (`playwright: not found`), audit.py проходит только статическую проверку |

**Корневая причина:** AI не следовал AGENTS.md §8.2 («Минимально-инвазивно. Не «улучшать», что не просили») и §4.2 («Новые `!important` сверх baseline — warning»). Вместо точечного фикса он провёл «lux overhaul».

---

## 6. Что откатывать/чистить в первую очередь

### Приоритет 1 (критично):
1. **Убрать синий цвет** из `.hero-title-seo .w:hover` и `.hero-subtitle .w:hover` в `premium-overrides.css` — заменить на золотой или убрать hover-эффект вовсе.
2. **Исправить `--gold-acc`** — вернуть настоящий золотой (`#c9934a` или `#d4a76a`), а не коричневый `#8a5e23`. Или убрать переопределение `.btn-add` в `mc-2026.css`.
3. **Убрать View Transitions API** из `js/mc-2026.js` — это ломает навигацию и аналитику.
4. **Убрать глобальный silk transition** из `v20-fixes.css` — заменить на transition только CSS-переменных в `:root`.

### Приоритет 2 (мобильная стабильность):
5. **Убрать `backdrop-filter: blur(20px+)`** с мобильной навигации — заменить на простой полупрозрачный фон без blur.
6. **Убрать shimmer/glow анимации** (`shimmerBtnOnce`, `priceGlowOnce`, `titleShimmerOnce`) — они не минимализм.
7. **Убрать 3D rotate** с `.delivery-card__item` — `rotateX(6deg) rotateY(-5deg)`.
8. **Упорядочить `.product-footer`** — оставить вертикальный стек для <480px, но убрать дублирование между `v20-fixes.css` и `mc-2026.css`.

### Приоритет 3 (производительность):
9. **Убрать scroll-driven parallax** и `animation-timeline: view()` — лаги на средних Android.
10. **Убрать custom scrollbar** — возвращает нативный, минималистичный вид.
11. **Убрать content-visibility** на текстовые секции — риск для SEO и a11y.
12. **Убрать prefetch on hover** — бесполезен на мобильном.

---

## 7. Проверки после исправления

```bash
npm run audit:js
python3 scripts/check_prigorody_idempotent.py
npm run audit
# + ручная проверка на iPhone/Safari (Playwright не установлен в репо)
```

**Критерий готовности:**
- Hero-title hover — тёплый золотой или отсутствует.
- Кнопки `.btn-add` — золотые (`#c9934a`), не коричневые.
- Мобильная навигация — без `backdrop-filter blur`, простой полупрозрачный фон.
- Переключение dark/light — плавное, но без лагов на mid-range Android.
- Навигация по сайту — без задержек от View Transitions API.
- Все 47 проверок `audit.py` — зелёные.
- **Новые CSS-файлы не созданы** (AGENTS.md §2).

---

> **Вывод:** Предыдущий AI не «улучшил» мобильную версию — он устроил «luxury rebrand» без согласования. Работающий функционал (корзина, темы, мессенджеры) остался, но поверх него наложен слой тяжёлых эффектов, чуждых вашему тихому премиум-стилю. Нужна хирургическая чистка, а не новый overhaul.
