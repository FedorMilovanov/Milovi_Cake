from pathlib import Path
import json


def read(path):
    return Path(path).read_text('utf-8')


def require(condition, message):
    if not condition:
        raise SystemExit('Lighthouse regression: ' + message)


home = read('index.html')
require('id="anti-fouc-body"' not in home, 'homepage body-level anti-FOUC gate returned')
require('body:not(.ready){opacity:0}' not in home, 'homepage can still be hidden before DOMContentLoaded')

for path in ['index.html', 'gallery/index.html', 'svadebnye-torty/index.html', 'bento-torty/index.html', 'zakazat-tort-spb/index.html']:
    text = read(path)
    require('display=swap' not in text, f'{path} reintroduced display=swap')

for path in ['svadebnye-torty/index.html', 'bento-torty/index.html', 'zakazat-tort-spb/index.html']:
    require('loading="eager"' not in read(path), f'{path} reintroduced below-fold eager media')

order = read('zakazat-tort-spb/index.html')
require('/img/head_mobile.avif" media="(max-width: 768px)" fetchpriority="high"' in order, 'order page mobile hero preload missing')
require('media="(max-width: 768px)" srcset="/img/head_mobile.avif"' in order, 'order page mobile hero source missing')

gallery = read('gallery/index.html')
require('id="preloader"' not in gallery, 'gallery blocking preloader returned')
require('/img/gallery/gallery-01.avif" fetchpriority="high"' in gallery, 'gallery LCP preload missing')
require('/js/gallery/main.js?v=20260906r02' in gallery, 'gallery runtime revision drift')
require(
    '#galleryGrid:empty:has(+ #gxEmpty[style*="display: none"]) { min-height: 100svh; }' in gallery,
    'gallery initial empty grid no longer reserves one viewport before hydration',
)
require(
    'id="gxEmpty" style="display: none;"' in gallery,
    'gallery initial-layout reserve sentinel drifted',
)
font_css = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=optional'
swiper_css = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css'
require(
    f'href="{font_css}" rel="stylesheet" media="print" onload="this.onload=null;this.media=\'all\'"' in gallery,
    'gallery Google Fonts CSS returned to the critical render path',
)
require(
    f'href="{swiper_css}" media="print" onload="this.onload=null;this.media=\'all\'"' in gallery,
    'gallery Swiper CSS returned to the critical render path',
)
require(
    f'<noscript><link href="{font_css}" rel="stylesheet" /></noscript>' in gallery,
    'gallery Google Fonts noscript fallback missing',
)
require(
    f'<noscript><link rel="stylesheet" href="{swiper_css}" /></noscript>' in gallery,
    'gallery Swiper noscript fallback missing',
)
require('/css/gallery/gallery-2026.css?v=20260813r01" />' in gallery, 'gallery critical local CSS became deferred')
require('/css/final-fixes.css?v=20260815r78" />' in gallery, 'gallery final critical CSS became deferred')
require('id="gallery-lcp-media-fastpath"' in gallery, 'gallery eager-media LCP fast path missing')
require(
    '#galleryGrid .card:has(img.card-media[loading="eager"]) .card-skeleton { display: none; }' in gallery,
    'gallery eager media is hidden behind the decorative skeleton again',
)
require(
    '#galleryGrid .card.is-loading:has(img.card-media[loading="eager"]) .card-media {' in gallery
    and 'opacity: 1;' in gallery
    and 'transform: scale(1);' in gallery
    and 'filter: saturate(1);' in gallery,
    'gallery eager media reveal delay returned',
)

gallery_css = read('css/gallery/gallery-2026.css')
require('.card-skeleton{' in gallery_css, 'gallery lazy-card skeleton contract disappeared globally')
require('.card.is-loading .card-media{ opacity:0;' in gallery_css, 'gallery lazy media no longer keeps the premium reveal contract')

gallery_js = read('js/gallery/main.js')
require("if(index===0) img.fetchPriority='high';" in gallery_js, 'gallery first image lost high fetch priority')
require("v.preload='none';" in gallery_js, 'gallery video preload competes with LCP')
require('v.autoplay=true' not in gallery_js, 'gallery videos autoplay during initial load')
require("if(index<4) card.style.animation='none';" in gallery_js, 'above-fold gallery cards animate into LCP')

gatchina = read('prigorody/gatchina/index.html')
for title in ['Ручная Работа', 'Натуральные Ингредиенты', 'Свежесть под заказ', 'Доставка по СПб']:
    require(f'<h3>{title}</h3>' in gatchina and f'<h4>{title}</h4>' not in gatchina, f'Gatchina heading order drift: {title}')
require(gatchina.count('<button type="button" class="cb-faq-q"') == 3, 'Gatchina FAQ is not three native buttons')
require('min-height:48px' in gatchina, 'Gatchina FAQ target-size contract missing')

landing_css = read('css/style.css')
require(
    '.lp-btn-primary{background:var(--gold);color:#2c1a10;' in landing_css,
    'commercial landing primary CTA contrast regressed',
)
require(
    'background:var(--gold);color:#2c1a10;text-decoration:none;font-size:12px' in landing_css,
    'wedding callout CTA contrast regressed',
)
require(
    '.landing-footer nav a{display:flex;align-items:center;min-height:24px;' in landing_css,
    'landing footer link target-size contract regressed',
)
for path in ['svadebnye-torty/index.html', 'bento-torty/index.html', 'zakazat-tort-spb/index.html']:
    require('/css/style.css?v=20260906r03' in read(path), f'{path} landing a11y CSS revision drifted')

# Shared CSS and its service-worker generation must move as one release unit.
for public_html in sorted(Path('.').rglob('*.html')):
    html = read(public_html)
    if 'style.css?v=' in html:
        require('style.css?v=20260906r03' in html, f'{public_html} shared style revision drifted')
        require('style.css?v=20260728r27' not in html, f'{public_html} still references stale shared style revision')

sw = read('sw.js')
require("const CACHE_NAME = 'milovi-cake-v2026.09.06-r79';" in sw, 'service-worker cache generation did not roll with shared CSS')
require("'/css/style.css?v=20260906r03'," in sw, 'service-worker precache still points at stale shared CSS revision')

cfg = json.loads(read('.github/lighthouse-config.json'))
require(cfg['ci']['collect'].get('numberOfRuns') == 3, 'Lighthouse collection is not three runs')
assertions = cfg['ci']['assert']['assertions']
for audit in ['categories:best-practices', 'categories:seo', 'total-blocking-time']:
    require(assertions[audit][0] == 'error', f'{audit} must remain fail-closed')
for audit in ['categories:performance', 'categories:accessibility', 'largest-contentful-paint', 'cumulative-layout-shift']:
    require(assertions[audit][0] == 'warn', f'{audit} severity changed before evidence-backed closure')

workflow = read('.github/workflows/lighthouse.yml')
require(
    'AUDIT_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}' in workflow,
    'Lighthouse audit SHA is not bound to the triggering deploy',
)
require('ref: ${{ env.AUDIT_SHA }}' in workflow, 'Lighthouse checkout is not pinned to the audit SHA')
require(
    workflow.count('python3 scripts/production_release_smoke.py') == 2,
    'Lighthouse must prove the same live release before and after measurement',
)
require('Prove exact live release before Lighthouse' in workflow, 'pre-audit exact release proof missing')
require('Re-prove exact live release after Lighthouse' in workflow, 'post-audit exact release proof missing')

print('Lighthouse root-cause regression contract OK')
