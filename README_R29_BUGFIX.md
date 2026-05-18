# Milovi Cake — r29 Critical Bugfix Pack

**Дата:** 2026-05-19
**Версия:** `20260519r29` / `milovi-cake-v2026.05.19-r29`

---

## Исправлено 8 багов

### КРИТИЧНЫЕ
1. **Баг #15**: selectCakeType уничтожал все тултипы начинок при смене типа торта (десктоп)
2. **Баг #2**: SW install глотал ошибки precache и активировался с пустым кэшем

### СЕРЬЁЗНЫЕ
3. **Баг #16**: changeQty(+) без верхнего лимита — пользователь мог выставить 999 кг
4. **Баг #17**: Telegram clipboard fallback — пустой catch, буфер не копировался на iOS
5. **Баг #5**: Тип бисквита сбрасывался после перезагрузки (не сохранялся в localStorage)
6. **Баг #21**: iOS Safari scroll-through — фон прокручивался под модальными окнами
7. **Баг #14**: Hero-изображения были opacity:0 на 5 секунд при медленном интернете
8. **Баг #35**: scrollToProduct сносил active-индикацию через 2с таймаут

### ДОКУМЕНТАЦИЯ
- **БАГИ МИЛОВИ и АУДИТ.md** — полностью переписан: статус всех 41 багов, план этапов, список мусора для удаления

---

## Что НЕ тронуто

- CSS-файлы не менялись (ни один из 7)
- Hero-мессенджеры, lightbox, buildCartKey, R10/R15 protected
- Никаких новых CSS/JS файлов
- Порядок загрузки CSS не изменён

---

## Файлы для УДАЛЕНИЯ из репо (мусор)

```
README_R22_STABILIZATION.md
README_R23_STABILIZATION.md
README_v21_CLEANUP.md
README_R28_SYNC.md
BADGES_README_SNIPPET.md
INSTALL_CAKE_BADGES.md
AUDIT_README.md
SERIOUS_TECH_DEBT_AUDIT.md
FILES_INCLUDED.txt
```

---

## Как применить

1. Распакуй ZIP в корень репо, подтверди перезапись
2. Удали мусорные файлы (см. выше)
3. ```bash
   git rm README_R22_STABILIZATION.md README_R23_STABILIZATION.md README_v21_CLEANUP.md README_R28_SYNC.md BADGES_README_SNIPPET.md INSTALL_CAKE_BADGES.md AUDIT_README.md SERIOUS_TECH_DEBT_AUDIT.md FILES_INCLUDED.txt
   git add .
   git commit -m "fix(r29): 8 critical JS bugs, iOS scroll-lock, SW hardening, cleanup docs"
   git push origin main
   ```

## После деплоя
F12 → Application → Service Workers → Unregister → Clear site data → Ctrl+F5
