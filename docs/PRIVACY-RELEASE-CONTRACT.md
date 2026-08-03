# Milovi Cake — privacy and release contract

## Privacy boundary

`js/consent-analytics.js` is the only file allowed to contain the Google Analytics and Яндекс.Метрика runtime identifiers or third-party loader URLs.

Every normal HTML document loads only the local script:

```html
<script defer src="/js/consent-analytics.js"></script>
```

Before an explicit visitor choice:

- no Google Analytics script is requested;
- no Яндекс.Метрика script or tracking pixel is requested;
- Webvisor is not initialized;
- conversion goals are not sent;
- catalog, cart, gallery and ordering links remain fully functional.

The choice is stored as `milovi_analytics_consent_v1`. On a first visit, the decision dialog opens once and may be closed without granting analytics; in that case analytics remains disabled.

The persistent settings entry is responsive:

- on desktop it is a static “Настройки конфиденциальности” control inside the footer utility capsule;
- on mobile it is the “Конфиденциальность” row inside the single app navigation sheet opened by “Ещё”;
- mobile must never render a separate privacy row below the footer or a second bottom navigation;
- the mobile decision UI opens as a bottom sheet above the page and temporarily moves the app navigation out of the interaction layer.

No privacy control may be fixed over page content or overlap navigation and scroll-to-top controls. Revoking already active analytics reloads the document so the next page lifecycle starts without third-party analytics.

## Mobile app-shell boundary

At viewport widths up to 768 px, `#mcNav` is the only visible application navigation. Its five primary actions are “Каталог”, “Начинки”, “Отзывы”, “Заказать” and “Ещё”. Legacy `#bottomNav`, `#mrBottomNav` and mobile sticky order controls must remain hidden and non-interactive. The app bar stays available while scrolling, respects the safe area and must not cover the footer utility block.

## Source guard

Run:

```bash
npm run audit:analytics
```

The contract fails if a legacy inline tag, old cookie handler, duplicate loader, false 404 canonical or missing privacy route returns.

Generated suburb pages inherit the same boundary from `prigorody/_template.html`; generated files and the template are both audited. A template change is accepted only together with regenerated city pages and a green idempotency check.

## Pages artifact

The repository root is not the deployment artifact. Production is built into `_site/`:

```bash
RELEASE_SHA=<exact-commit> npm run build:pages
RELEASE_SHA=<exact-commit> npm run audit:pages
```

The artifact is allowlisted and excludes tests, scripts, templates, reports, package files and repository control data. It contains `release.json`, binding the public site to the exact source commit.

## Release order

The only accepted automatic release order is:

```text
source QA + Playwright
→ sanitized `_site/`
→ artifact audit
→ GitHub Pages deploy
→ live `release.json` proof
→ production smoke
→ IndexNow submission
→ Lighthouse observation
```

IndexNow must never run from a raw push before a successful live smoke.

## Rollback

A rollback must deploy a known exact commit through the same workflow. Do not copy the repository root to Pages, restore inline analytics, or bypass the privacy/artifact contracts to make a workflow green.
