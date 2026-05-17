# Установка Cake badges

Вариант 1 — заменить README целиком и добавить workflows:

```bash
unzip Milovi_Cake_Badges_v1.0.zip -d Milovi_Cake/ --strip-components=1
cd Milovi_Cake
git add README.md .github/workflows/cake-sanity.yml .github/workflows/production-smoke.yml BADGES_README_SNIPPET.md INSTALL_CAKE_BADGES.md
git commit -m "ci: add status badges and production smoke check"
git push
```

Вариант 2 — если не хочешь заменять README:

1. Скопируй только `.github/workflows/cake-sanity.yml` и `.github/workflows/production-smoke.yml`.
2. Открой `BADGES_README_SNIPPET.md` и вставь блок бейджей вручную под заголовок README.

Важно: бейджи станут зелёными/красными только после первого запуска workflow в GitHub Actions.
