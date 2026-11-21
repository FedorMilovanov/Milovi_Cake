# Meringue roll desktop/mobile and suburb audit — 2026-11-16

## Scope and method

Reviewed `/meringue-roll/`, its responsive desktop/mobile rendering, URL city targeting, order/contact entry points, SEO metadata/structured-data contracts, and all 14 generated `prigorody/<slug>/` pages that mention or link to the roll. Used a local Chromium browser (1440px desktop and 390px mobile emulation), direct HTTP/page checks against the local static site, the targeted Playwright regression, and repository audit/build scripts. This is not a real-device, cross-browser, or live-production crawl.

## Confirmed defects found and fixed

1. A phone icon was malformed because `&nbsp;` (decoded by HTML to a non-breaking space) had been copied into SVG `viewBox` and `path d` attributes. Chromium logged SVG parse errors, so the phone glyphs were not reliably rendered. The issue affected the main landing page, `/call/`, the meringue-roll order CTA, and the shared suburb header/contact markup (therefore all 14 generated suburb pages). Replaced the entities with ordinary SVG whitespace in source markup and regenerated all suburb pages. A Playwright regression now visits the main page, call page, roll page, and all 14 suburb routes and checks for SVG parsing errors.
2. The roll’s photo tiles were clickable `<div>` elements with no keyboard access; keyboard users could not open the product gallery. Replaced them with native buttons, added a visible focus indicator and accessible names, and made the lightbox announce as a modal dialog, move focus on open, contain Tab navigation, return focus on close, and update the photo’s alt text while navigating. Added Enter/Space, arrow, Escape, and focus regression coverage.

## Browser and city-page results

- At 1440px and 390px, the roll landing rendered without horizontal overflow. Mobile selected the mobile hero asset; the city grid fits its 390px viewport.
- The landing has 15 delivery tags: Санкт-Петербург plus 14 suburbs. All 14 displayed starting prices match `prigorody/_cities.csv`.
- `?city=pushkin` highlights the Pushkin tag and keeps the canonical URL on `/meringue-roll/`. It does **not** rewrite the page copy, price, or delivery terms; the query parameter is a scroll/highlight affordance, not personalization.
- Browser-loaded all 14 suburb routes: each returned HTTP 200, had a page title and canonical, and exposed a visible/textual meringue-roll link. The suburb promotion and local copy are present, including on Peterhof and Pushkin; the earlier exact-capitalization search was a false alarm (the phrase occurs in lowercase).
- Static SEO/repository checks confirm roll title/description/canonical, social metadata, Product/Breadcrumb JSON-LD and FAQ parity. They do not prove indexing, rich-result eligibility, or current live-production behavior.
- The initial analytics-consent dialog is present on a fresh browser profile. It can be dismissed by declining analytics; it is expected privacy behavior, not a blocking defect.

## Verification

The focused desktop/mobile Chromium matrix passed **39 browser tests** (one expected desktop-only skip):

- 20 landing/functionality checks across desktop and mobile: city and suburb roll links, all FAQ answers, storage/schema consistency, browser-storage failure resilience, header geometry at 320–1440px, text/navigation contrast in both themes, keyboard-operable gallery/lightbox with focus management, and no SVG parse errors on the main/call/roll pages plus all 14 suburbs.
- 8 image-budget checks: responsive hero fetched once, image-byte budgets, decorative-image budget, and `<picture>` srcset/sizes contracts.
- 4 image-geometry checks: no layout dependence on inaccurate dimensions and no stretched roll imagery at desktop/mobile widths.
- 7 mobile-shell checks: navigation bar position, viewport bounds, and computed safe-area/layout tokens on the roll page and neighboring pages.

Also passed `npm run build:pages`, `npm run audit:pages`, and `npm run audit:all`. Overall static audit: 45 passed, 0 errors, 12 warnings; `npm audit` reports 0 vulnerabilities. The **full repository-wide Playwright suite** was not run; this focused matrix covers the roll flow and related city entry points.

Updated sitemap hash/lastmod state for the landing, home, and regenerated suburb pages to **2026-11-16**; lastmod and suburb-sitemap checks pass.

## Remaining warnings / limits

The repository audit still reports the existing 12 warnings: CSS/JS gzip payload budgets (three warnings) and nine unreferenced media files, including legacy meringue-roll image variants. These were not deleted or treated as live-page failures. No real iOS/Android device, Firefox/WebKit run, Google Search Console/index status, or live-production SEO/render crawl was available in this audit.
