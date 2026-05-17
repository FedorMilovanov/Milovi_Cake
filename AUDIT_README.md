# 🛡️ Milovi Cake — Professional Audit System

**Версия:** 1.0 | **Дата:** 2026-05-17

Система автоматических проверок для Milovi Cake. Ноль runtime-зависимостей, только Python stdlib.

---

## Быстрый старт

```bash
# Полный аудит (локально)
python3 scripts/audit.py

# Только JS синтаксис
npm run audit:js

# Проверить что prigorody актуальны
npm run audit:prigorody

# Всё сразу
npm run audit:all
```

## Что проверяется (19 тестов)

| # | Проверка | Что делает |
|---|----------|-----------|
| 1 | **File Structure Guard** | Ровно 7 CSS и 5 JS файлов. Никаких лишних |
| 2 | **File Size Budget** | CSS/JS не превышают бюджет, показ gzip-размеров |
| 3 | **Version Sync** | `?v=` в HTML совпадает с PRECACHE в sw.js |
| 4 | **SEO Validation** | meta description, canonical, OG, h1, lang, viewport |
| 5 | **Accessibility (a11y)** | img alt, button text |
| 6 | **Duplicate IDs** | Нет повторяющихся id на одной странице |
| 7 | **Internal Links** | Все внутренние ссылки ведут на существующие файлы |
| 8 | **PWA / Manifest** | manifest.json валидный, иконки существуют |
| 9 | **Prigorody Integrity** | Все города из CSV сгенерированы, нет `{{var}}` |
| 10 | **Forbidden Patterns** | !important abuse, console.log, TODO/FIXME |
| 11 | **Encoding** | Все файлы в UTF-8 без replacement characters |
| 12 | **robots.txt & Sitemap** | Sitemap и Host указаны корректно |
| 13 | **HTML Size** | HTML файлы не превышают бюджет |
| 14 | **Resource Integrity** | CSS/JS/img ссылки указывают на реальные файлы |
| 15 | **SW Strategy** | install/activate/fetch/skipWaiting/claim на месте |
| 16 | **HTML Validation** | DOCTYPE, charset, lang |
| 17 | **CNAME** | Домен настроен для GitHub Pages |
| 18 | **Repo Hygiene** | .gitignore, нет огромных файлов |
| 19 | **Security Patterns** | Нет mixed content (http://) |

## CI (GitHub Actions)

При каждом пуше в `main` или PR автоматически запускается:

1. **Full Site Audit** — Python-скрипт, все 19 проверок
2. **JS Syntax Check** — `node --check` для всех JS файлов
3. **Prigorody Build Check** — пересобирает и проверяет, что нет изменений

Если есть **errors** — CI падает, деплой блокируется.
Если есть **warnings** — CI проходит, но предупреждения видны в логе.

## Структура файлов

```
scripts/
  audit.py              ← Единый скрипт аудита (Python stdlib)
.github/
  workflows/
    audit.yml           ← CI pipeline (3 job'а)
package.json            ← npm-обёртка для запуска проверок
```

## Отчёты

При каждом запуске в папку `audit/` сохраняется Markdown-отчёт:
```
audit/audit-2026-05-17_14-30.md
```

CI также загружает отчёт как artifact (хранится 30 дней).

## Коды выхода

- `0` — аудит прошёл (нет errors)
- `1` — есть errors, нужно исправить перед деплоем

## Расширение

Добавить новую проверку — просто добавь ещё один блок:

```python
with R.section("N. New Check Name"):
    # ... ваш код ...
    R.ok("Check passed")
    # или
    R.err("Something is wrong")
    R.warn("Something is suboptimal")
```
