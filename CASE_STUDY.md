# Case study: an auditable static site for an independent confectionery business

## Business problem

[Milovi Cake](https://milovicake.ru) needs a fast, readable and reliable website for real confectionery products, customer trust information and local discovery around Saint Petersburg. The site must accurately preserve pricing, service conditions, photography, privacy choices and customer-contact workflows. SEO and attractive visuals are useful only if the underlying commercial facts stay consistent.

## Implementation that can be inspected

| Problem | Implemented mechanism | Evidence |
|---|---|---|
| Fast static delivery | Vanilla HTML/CSS/JS with no **runtime** npm framework; static hosting and a PWA Service Worker | [README.md](README.md), [sw.js](sw.js), [manifest.json](manifest.json) |
| Local landing pages | 14 suburb pages generated from shared template/data; avoid manual drift and require idempotent output | [prigorody/_template.html](prigorody/_template.html), [prigorody/_cities.csv](prigorody/_cities.csv), [scripts/check_prigorody_idempotent.py](scripts/check_prigorody_idempotent.py) |
| Client trust and real offer | Dedicated product, gallery, delivery, reviews and confectioner pages; pricing and structured-data requirements monitored for consistency | [o-konditere/index.html](o-konditere/index.html), [dostavka-i-oplata/index.html](dostavka-i-oplata/index.html), [scripts/audit.py](scripts/audit.py) |
| Privacy and accessibility | Opt-in analytics, static conformance checks and desktop/mobile Playwright protection of interactive UI | [js/consent-analytics.js](js/consent-analytics.js), [scripts/a11y_static.py](scripts/a11y_static.py), [tests/](tests/) |
| Safe deployments | Exact release SHA in generated `release.json`, per-asset cache revisions and deployed postcondition smoke | [scripts/release_contract.py](scripts/release_contract.py), [scripts/production_release_smoke.py](scripts/production_release_smoke.py) |

The site's business/design constraints and exact pricing facts live in [AGENTS.md](AGENTS.md); this page intentionally does **not** duplicate amounts, opening hours or addresses that can change.

## Verification procedure

The repository declares `npm run qa` as the comprehensive local QA entry point. The existing pipeline includes syntax, source/site audits, dependency security, privacy checks, Playwright responsive interaction tests and release-identity consistency.

```sh
npm ci
npx playwright install chromium
npm run qa
```

Some live post-deploy checks require actual public network access and a deployed exact SHA. **A green source test alone does not establish that production displays the same commit**, nor that a marketing campaign generated orders. Browser or production claims must be supported by their own dated evidence.

## What is and is not demonstrated

**Supported by repository implementation:** reusable suburb generation, public pages, privacy/SEO/a11y/Playwright contracts and traceable release verification.

**Not independently established by these repository facts:** actual order volume, sales revenue, conversion uplift, search ranking, user satisfaction or any claim that every depicted/generated image is a photo of a sold cake.

This business belongs to **Viktoria Milovanova**; the technical site is maintained by **Fedor Milovanov**. The related [Patisserie Russe](https://french.milovicake.ru) library is educational and **does not assert that Milovi Cake uses its historical French recipes in commercial production**. See [OWNER.md](OWNER.md) for the role and attribution boundary.
