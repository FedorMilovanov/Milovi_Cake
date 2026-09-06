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
