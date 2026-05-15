# Milovi Cake — Gallery 2026 (Pro Edition)

## Что было изменено

Полностью переработана страница `/gallery/` — переход с устаревшего стека (Muuri + Swiper) на нативные веб-стандарты 2026 года.

### Изменённые / новые файлы
```
gallery/index.html                       — переписан, тонкий semantic-HTML
css/gallery/gallery-2026.css             — новый, единственный CSS галереи
js/gallery/data.js                       — новый, источник истины (46 работ)
js/gallery/shuffle.js                    — новый, editorial shuffle
js/gallery/main.js                       — новый, оркестратор + Lightbox
js/gallery/effects/cursor.js             — новый, magnetic spotlight cursor
js/gallery/effects/scrollSkew.js         — новый, scroll-velocity distortion
js/gallery/effects/ambient.js            — новый, ambient color extractor
js/gallery/effects/liquid.js             — новый, WebGL2 liquid shader
GALLERY_2026_README.md                   — этот файл
```

Старые внешние библиотеки **больше не подгружаются** на странице галереи (Muuri, Swiper) — минус ~120 KB JS, страница работает на нативных API.

---

## Реализованные техники (5 / 5)

### 1. View Transitions API — нативный seamless морфинг
- При клике на карточку браузер делает плавный «morph» элемента в полноэкранный лайтбокс через `document.startViewTransition()`.
- Каждой ячейке присвоено уникальное `view-transition-name: vt-{id}` — браузер автоматически интерполирует position/size/border-radius между состояниями.
- При закрытии — обратный морфинг в исходную ячейку.
- Тоже работает при смене слайдов и при переключении фильтров.
- **Fallback:** в Firefox/Safari (где VT ещё нет) — мягкий fade без визуальных артефактов.

### 2. WebGL Liquid Shaders при наведении
- Свой WebGL2-движок (`effects/liquid.js`), без внешних библиотек.
- Кастомный fragment-шейдер: радиальная рябь от точки курсора + chromatic aberration + soft highlight («глянец крема»).
- Lazy-инициализация через `IntersectionObserver` — сцена создаётся только когда карточка попала во вьюпорт.
- Анимация работает только пока курсор внутри + 0.5 с на затухание (батарея, GPU).
- **Fallback:** при отсутствии WebGL2 — стандартный CSS `transform: scale(1.06)`.

### 3. Magnetic Spotlight Cursor с надписью «Смотреть»
- Полностью кастомный курсор, нативный скрыт через `cursor: none`.
- Spring-интерполяция (`SPRING = 0.18`) для плавного следования.
- При наведении на карточку — расширяется до 96 px, окрашивается в фирменное золото и показывает текст «СМОТРЕТЬ».
- На обычных интерактивных элементах (кнопки, ссылки) — расширяется до 36 px с инверсией через `mix-blend-mode: difference`.
- **Disabled на touch-устройствах** (`(hover: none), (pointer: coarse)`).

### 4. Scroll-Velocity Distortion
- Замер скорости скролла с пружинным затуханием.
- Карточки слегка скашиваются по `skewY` и масштабируются (CSS-переменные `--gx-skew`, `--gx-scale`).
- Cap на 6° / 2.5 % — без укачивания.
- При остановке скролла возвращаются в идеальное состояние с пружиной.
- **Disabled при `prefers-reduced-motion: reduce`**.

### 5. Glassmorphism + Ambient Backdrop в лайтбоксе
- Фон лайтбокса = открытая фотография, размытая нативным `backdrop-filter: blur(64px) saturate(1.25) brightness(.55)`.
- Дополнительный слой через `::after` с ещё более сильным blur + saturate — Apple Music style halo.
- Средний цвет извлекается на 16×16 offscreen canvas (`effects/ambient.js`) и подмешивается через CSS-переменную `--ambient`.
- Все controls (close/share/prev/next/thumbs) — на матовом стекле через `backdrop-filter: blur(20px)`.

---

## Layout — почему НЕ Justified Layout

Justified Layout (Flickr-style) хорошо подходит ровно одной задаче — массиву **разнокалиберных фото**.
Для смешанной галереи (фото + видео + крупные плитки) лучше **CSS Grid с `grid-auto-flow: dense`**:

| Критерий                    | Justified Layout (Flickr) | CSS Grid Dense (мы) |
|----------------------------|---------------------------|---------------------|
| Совместимость с View Transitions | ❌ ломается на ресайзе   | ✅ нативно          |
| JS-зависимость             | ❌ нужен JS               | ✅ работает без JS  |
| Видео-плитки               | ❌ режет                  | ✅ свободно         |
| Крупные акценты (`big`/`wide`/`tall`) | ❌ не поддерживает | ✅ через `grid-row/column span` |
| Адаптивность               | ⚠️ через media-queries    | ✅ через `auto-fill` + `minmax` |
| Без «дыр»                  | ✅                        | ✅ (`grid-auto-flow: dense`) |
| Производительность         | ⚠️ recalc на каждый ресайз | ✅ нативный движок |

Поэтому выбран Bento-grid с `dense`-упаковкой — современнее и работает безупречно с морфингом.

---

## Как тестировать локально

```bash
cd Milovi_Cake
python3 -m http.server 8000
# открыть http://localhost:8000/gallery/
```

Откройте в **Chrome 111+ / Edge 111+** для полной поддержки View Transitions + WebGL2.
В Firefox/Safari всё работает с graceful degradation.

---

## Прогрессивное улучшение / доступность

- ✅ Все интерактивные элементы получают `aria-label`
- ✅ `role="button"` + `tabindex="0"` на ячейках, поддержка Enter/Space
- ✅ Keyboard: `Escape`/`Arrow Left/Right` в лайтбоксе
- ✅ Touch swipe в лайтбоксе
- ✅ Deep links: `gallery/#v01` открывает конкретную работу
- ✅ Web Share API + clipboard fallback
- ✅ Native fullscreen
- ✅ Видео автоплеит только когда видно во вьюпорте (батарея)
- ✅ `prefers-reduced-motion` корректно выключает все эффекты
- ✅ JSON-LD structured data (ImageGallery)

---

## Производительность

- 0 внешних JS-библиотек на gallery-странице (–120 KB vs предыдущей версии)
- Lazy-loading изображений (eager только для первых 6, fetchpriority=high для первых 3)
- IntersectionObserver для видео и WebGL-сцен
- `will-change: transform` только на ячейках
- DPR cap = 2 для WebGL канвасов
- WebGL текстура для видео обновляется только когда playing

---

© 2026 Milovi Cake. Архитектура: layered, progressive enhancement, zero-dependency.
