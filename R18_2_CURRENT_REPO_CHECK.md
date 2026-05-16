# Milovi Cake r18.2 — проверка текущей загруженной версии

Дата: 2026-05-16

## Текущий GitHub main после новой загрузки

- Коммит: `78a082c Add files via upload`
- `js/main.js`: 2260 строк
- `js/nav.js`: 796 строк
- `css/premium-overrides.css`: 2664 строки
- Это уже другая версия, не та, где `main.js` был 4663 строки.

## Критическая находка

В загруженном `js/main.js` был синтаксический слом:

```js
... +';--sr:'+rot;';
```

Из-за этого:

```txt
node --check js/main.js — FAIL
```

То есть сайт с таким `main.js` может не запустить основной JavaScript вообще.

## Hotfix r18.2

Исправлено:

1. Синтаксическая ошибка gold-star burst:

```js
+';--sr:'+rot+';'
```

2. Добавлен `normalizeCartKey()` и миграция старых ключей корзины при загрузке localStorage.
3. Исправлен scope `_lbReviewIdx`, который использовался в `openChatLightbox()` вне области видимости.
4. Добавлен финальный CSS override для `theme-toggle`.
5. Добавлен финальный CSS override для hero WA/TG/MAX ring-кнопок.

## Проверка после hotfix

```txt
node --check js/main.js — OK
node --check js/nav.js — OK
```

## Архив

Собран плоский архив без фото/видео:

```txt
Milovi_Cake_r18_2_hotfix_flat_code.zip
```

Внутри сразу корень проекта: `index.html`, `js/`, `css/`, `prigorody/`, без вложенных `r18_milovi/r18_build`.
