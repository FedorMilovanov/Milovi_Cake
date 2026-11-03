# Project ownership and attribution

**Business and project owner:** **Viktoria Milovanova** (see [AGENTS.md](AGENTS.md) and the public [About the confectioner](o-konditere/) page).  
**Site engineering and technical maintenance:** **Fedor Milovanov**, with human-directed AI-assisted engineering and quality-assurance workflows.  
**Public site:** [milovicake.ru](https://milovicake.ru).

## Separate responsibilities

- **Confectionery business and products:** Viktoria Milovanova — cakes, desserts, customer orders and the real confectionery activity described on the public website.
- **Technical site:** Fedor Milovanov — implementation, editorial/SEO technology, static HTML/CSS/JS, performance, testing, release controls and GitHub maintenance. Repository commits and AI-assisted code generation do not prove that every line was typed or authored independently by one person.
- **Customers, photographs and reviews:** third-party or client-provided materials retain their actual provenance and rights. A public testimonial, photograph, certificate or price must reflect the current site's verified commercial claims; repository ownership does not assign copyright to all such material.
- **Educational project:** [Patisserie Russe / Milovi School](https://french.milovicake.ru) is associated with the Milovi Cake project, **but its historical French pastry recipes do not constitute the commercial menu or a claim that the bakery makes every recipe**.

This document explains attribution; it **does not add a license** for website code, media, customer content or third-party works.

## Where to verify things

| Concern | Primary source |
|---|---|
| Protected engineering, business facts, design decisions | [AGENTS.md](AGENTS.md) |
| Technical overview and release/QA process | [README.md](README.md) |
| Current public commercial facts | [index.html](index.html), [o-konditere/index.html](o-konditere/index.html) and the relevant live product page |
| Suburb generation and controlled data | [prigorody/_template.html](prigorody/_template.html), [prigorody/_cities.csv](prigorody/_cities.csv), [prigorody/build.py](prigorody/build.py) |
| Static site/SEO/business-fact verification | [scripts/audit.py](scripts/audit.py) |
| Release identity and live post-deploy proof | [scripts/production_release_smoke.py](scripts/production_release_smoke.py) |
| Security reporting | [SECURITY.md](SECURITY.md) |
| Externally readable engineering case | [CASE_STUDY.md](CASE_STUDY.md) |

**No blank contact addresses or commercial outcome figures are supplied.** Keep dates, prices, client claims, business hours and delivery promises synchronized with the site's established source and release checks. Do not infer revenue, conversion or order volume from CI runs or code size.
