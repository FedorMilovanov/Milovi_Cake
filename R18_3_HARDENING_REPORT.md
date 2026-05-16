# Milovi Cake r18.3 — тщательная перепроверка и усиление текущей версии

Дата: 2026-05-16

## База проверки

Проверял свежий GitHub main после новой загрузки:

- Коммит: `78a082c Add files via upload`
- `js/main.js`: 2260 строк в исходной загруженной версии
- `js/nav.js`: 796 строк
- `css/premium-overrides.css`: 2664 строки

## Найденные критические проблемы

### 1. `js/main.js` не проходил синтаксическую проверку

Было:

```js
... +';--sr:'+rot;';
```

Это ломало весь основной JS.

Исправлено:

```js
... +';--sr:'+rot+';'
```

### 2. `window.goTo = goTo` падал на страницах без review-stage

`goTo()` был объявлен внутри блока:

```js
if (scField && trackEl && dotsEl && stageEl) {
  function goTo(...) { ... }
}
```

А экспорт был снаружи:

```js
window.goTo = goTo;
```

В strict mode это `ReferenceError`, особенно на страницах пригородов/других страницах без полного блока отзывов.

Исправлено:

- добавлен безопасный внешний `reviewsGoTo`
- `window.goTo` стал безопасной обёрткой
- если секции отзывов нет, JS не падает

### 3. `navigateFill()` был в HTML, но не был экспортирован в `window`

В HTML есть:

```html
onclick="navigateFill(-1)"
```

Но `window.navigateFill` не назначался.

Исправлено:

```js
window.navigateFill = navigateFill;
```

### 4. `_lbReviewIdx` использовался вне своей области видимости

`openChatLightbox()` использовал `_lbReviewIdx`, но переменная была объявлена ниже внутри блока отзывов. На страницах/сценариях без блока это могло давать падение.

Исправлено:

- `_lbReviewIdx` вынесен на верхний уровень рядом с `CHAT_SRCS`
- внутреннее повторное объявление удалено

### 5. Миграция старых ключей корзины

Добавлен `normalizeCartKey()`. Теперь старые ключи из localStorage нормализуются в единый формат корзины при загрузке.

## CSS-усиление

В конец `css/premium-overrides.css` добавлен финальный блок r18.3:

- фиксирует `theme-toggle` под реальные HTML-классы `theme-icon--moon/sun`
- фиксирует WA/TG/MAX hero-кнопки как ring-кнопки
- убирает риск, что старые `.sun-icon/.moon-icon` или pill-стили перетрут итог

## Проверки после исправлений

```txt
node --check js/main.js       OK
node --check js/nav.js        OK
node --check js/mc-2026.js    OK
node --check js/gallery/main.js OK
node --check js/gallery/data.js OK
```

Дополнительно прогонял `js/main.js` в VM с заглушками DOM:

- top-level при `document.readyState = loading` — OK
- top-level при `document.readyState = complete`, но без DOM-элементов — OK

Это важно для пригородов и страниц, где не все секции главной страницы присутствуют.

## Архив

Финальный архив:

```txt
Milovi_Cake_r18_3_hardened_flat_code.zip
```

Архив плоский: внутри сразу `index.html`, `js/`, `css/`, `prigorody/`, без вложенных `r18_milovi/r18_build`.
