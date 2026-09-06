from pathlib import Path
import json
import re


def read(path):
    return Path(path).read_text('utf-8')


def write(path, text):
    Path(path).write_text(text, 'utf-8')


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


# Homepage: theme is already applied synchronously to <html>; do not hide the whole body.
path = 'index.html'
s = read(path)
pattern = re.compile(
    r'\n  <!-- ANTI-FOUC v1: body opacity reveal \(theme handled above\) -->\n'
    r'  <style id="anti-fouc-body">.*?</script>\n',
    re.S,
)
s, count = pattern.subn('\n', s, count=1)
if count != 1:
    raise SystemExit(f'anti-FOUC: expected 1 block, got {count}')
write(path, s)

# No late metric-changing webfont swap on the audited performance URLs.
font_paths = [
    'index.html',
    'gallery/index.html',
    'svadebnye-torty/index.html',
    'bento-torty/index.html',
    'zakazat-tort-spb/index.html',
    'prigorody/_template.html',
]
for path in font_paths:
    s = read(path)
    count = s.count('display=swap')
    if count < 1:
        raise SystemExit(f'{path}: expected Google Fonts display=swap')
    write(path, s.replace('display=swap', 'display=optional'))

# Below-fold media must not compete with hero LCP on the three slow audited landing pages.
for path in [
    'svadebnye-torty/index.html',
    'bento-torty/index.html',
    'zakazat-tort-spb/index.html',
]:
    s = read(path)
    count = s.count('loading="eager"')
    if count < 1:
        raise SystemExit(f'{path}: expected below-fold eager images')
    write(path, s.replace('loading="eager"', 'loading="lazy"'))

# Order page: use the existing mobile hero asset for narrow viewports.
path = 'zakazat-tort-spb/index.html'
s = read(path)
s = once(
    s,
    '<link rel="preload" as="image" type="image/avif" href="/img/head_desktop.avif" fetchpriority="high" />',
    '<link rel="preload" as="image" type="image/avif" href="/img/head_mobile.avif" media="(max-width: 768px)" fetchpriority="high" />\n  <link rel="preload" as="image" type="image/avif" href="/img/head_desktop.avif" media="(min-width: 769px)" fetchpriority="high" />',
    'order responsive preload',
)
s = once(
    s,
    '<picture><source type="image/avif" srcset="/img/head_desktop.avif"><img src="/img/head_desktop.webp" alt="Заказать торт в СПб — Milovi Cake" width="900" height="1200" fetchpriority="high" decoding="async"/></picture>',
    '<picture><source type="image/avif" media="(max-width: 768px)" srcset="/img/head_mobile.avif"><source type="image/avif" media="(min-width: 769px)" srcset="/img/head_desktop.avif"><source type="image/webp" media="(max-width: 768px)" srcset="/img/head_mobile.webp"><img src="/img/head_desktop.webp" alt="Заказать торт в СПб — Milovi Cake" width="900" height="1200" fetchpriority="high" decoding="async"/></picture>',
    'order responsive picture',
)
write(path, s)

# Gallery: initial LCP image discoverable in HTML; remove the blocking preloader.
path = 'gallery/index.html'
s = read(path)
anchor = '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
s = once(
    s,
    anchor,
    anchor + '  <link rel="preload" as="image" type="image/avif" href="/img/gallery/gallery-01.avif" fetchpriority="high" />\n',
    'gallery LCP preload',
)
s, count = re.subn(r'\n  <div id="preloader">.*?\n  </div>\n', '\n', s, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'gallery preloader: expected 1 block, got {count}')
s = once(s, '/js/gallery/main.js?v=20260906r01', '/js/gallery/main.js?v=20260906r02', 'gallery JS revision')
write(path, s)

# Gallery runtime: prioritize only above-fold image work and defer grid video network work.
path = 'js/gallery/main.js'
s = read(path)
s = once(
    s,
    "    card.style.animationDelay=`${Math.min(index*0.04, 1.2)}s`; ",
    "    if(index<4) card.style.animation='none';\n    else card.style.animationDelay=`${Math.min(index*0.04, 1.2)}s`; ",
    'gallery above-fold animation',
)
s = once(s, "      v.autoplay=true; \n", '', 'gallery autoplay attribute')
s = once(s, "      v.preload='metadata'; ", "      v.preload='none'; ", 'gallery video preload')
s = once(
    s,
    "      img.loading=index<8?'eager':'lazy'; \n      img.decoding='async'; ",
    "      img.loading=index<4?'eager':'lazy'; \n      img.decoding='async'; \n      if(index===0) img.fetchPriority='high'; ",
    'gallery image priority',
)
s = once(
    s,
    '  grid.appendChild(frag); \n  setupVideoObserver();\n}',
    "  grid.appendChild(frag); \n  if(document.readyState==='complete') setupVideoObserver();\n  else if(!state.videoObserverPending){\n    state.videoObserverPending=true;\n    window.addEventListener('load',()=>{state.videoObserverPending=false;setupVideoObserver();},{once:true});\n  }\n}",
    'gallery observer scheduling',
)
s, count = re.subn(
    r'\nfunction hidePreloader\(delay=650\)\{.*?\n\}\n',
    '\n',
    s,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'hidePreloader function: expected 1, got {count}')
s = re.sub(r'^\s*hidePreloader\([^\n]*\);\s*$', '', s, flags=re.M)
s = re.sub(r'^\s*setTimeout\(\(\)=>hidePreloader\(0\),5000\);\s*$', '', s, flags=re.M)
if 'hidePreloader' in s:
    raise SystemExit('hidePreloader reference remains')
write(path, s)

path = 'sw.js'
s = read(path)
s = once(
    s,
    "'/js/gallery/main.js?v=20260906r01'",
    "'/js/gallery/main.js?v=20260906r02'",
    'SW gallery JS revision',
)
write(path, s)

# Canonical suburb source: native FAQ controls, sequential headings and remaining proven contrast.
path = 'prigorody/_template.html'
s = read(path)
old_style = '''  <style id="suburb-a11y-contrast">
    :root:not([data-theme="dark"]) .prigorody-page .calc-opt.selected{color:#2c1a10}
    :root:not([data-theme="dark"]) .prigorody-page .calc-stepper-val{color:#8a5723}
    :root:not([data-theme="dark"]) .prigorody-page .nearby-city-card__info{color:#725f50}
  </style>'''
new_style = '''  <style id="suburb-a11y-contrast">
    :root:not([data-theme="dark"]) .prigorody-page .calc-opt.selected{color:#2c1a10}
    :root:not([data-theme="dark"]) .prigorody-page .calc-stepper-val{color:#8a5723}
    :root:not([data-theme="dark"]) .prigorody-page .nearby-city-card__info{color:#725f50}
    :root:not([data-theme="dark"]) .prigorody-page .hero .btn-primary--hero{background:#8f5f25}
    :root:not([data-theme="dark"]) .prigorody-page .geo-section p,
    :root:not([data-theme="dark"]) .prigorody-page .seo-section p{color:#725f50}
    .prigorody-page .delivery-faq .cb-faq-q{width:100%;min-height:48px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
    .prigorody-page .site-footer .wave-text .w,
    .prigorody-page .site-footer .footer-col>h3{color:#9a8a6d}
    .prigorody-page .site-footer .footer-col>h3{font-family:'Jost',sans-serif;font-size:11px;font-weight:400;letter-spacing:.12em;text-transform:uppercase;margin:0 0 14px}
  </style>'''
s = once(s, old_style, new_style, 'extend suburb a11y contract')
for title in ['Ручная Работа', 'Натуральные Ингредиенты', 'Свежесть под заказ', 'Доставка по СПб']:
    s = once(s, f'<h4>{title}</h4>', f'<h3>{title}</h3>', f'feature heading {title}')
s = once(s, '<h4>Навигация</h4>', '<h3>Навигация</h3>', 'footer heading nav')
s = once(s, '<h4>Контакты</h4>', '<h3>Контакты</h3>', 'footer heading contacts')
for i in (1, 2, 3):
    old = f'''      <div class="faq-item" onclick="cbFaq(this)">
        <div class="cb-faq-q"><span>{{{{faq_q{i}}}}}</span><div class="cb-faq-ico">+</div></div>'''
    new = f'''      <div class="faq-item">
        <button type="button" class="cb-faq-q" onclick="cbFaq(this.parentElement)" aria-expanded="false"><span>{{{{faq_q{i}}}}}</span><span class="cb-faq-ico" aria-hidden="true">+</span></button>'''
    s = once(s, old, new, f'FAQ {i} native button')
old_cb = "function cbFaq(el){\n  var isOpen = el.classList.contains('open');\n  document.querySelectorAll('.faq-item.open').forEach(function(i){ i.classList.remove('open'); });\n  if(!isOpen) el.classList.add('open');\n}"
new_cb = "function cbFaq(el){\n  var isOpen = el.classList.contains('open');\n  document.querySelectorAll('.faq-item.open').forEach(function(i){ i.classList.remove('open'); var b=i.querySelector('.cb-faq-q'); if(b)b.setAttribute('aria-expanded','false'); });\n  var button=el.querySelector('.cb-faq-q');\n  if(!isOpen){ el.classList.add('open'); if(button)button.setAttribute('aria-expanded','true'); }\n  else if(button)button.setAttribute('aria-expanded','false');\n}"
s = once(s, old_cb, new_cb, 'FAQ state semantics')
write(path, s)

# Use three runs so post-deploy metrics are not a one-sample signal.
path = '.github/lighthouse-config.json'
cfg = json.loads(read(path))
if cfg['ci']['collect'].get('numberOfRuns') != 1:
    raise SystemExit('unexpected Lighthouse run count')
cfg['ci']['collect']['numberOfRuns'] = 3
write(path, json.dumps(cfg, ensure_ascii=False, indent=2) + '\n')

# Persistent source-level regression contract for the exact root causes fixed above.
regression = r'''from pathlib import Path
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

print('Lighthouse root-cause regression contract OK')
'''
write('scripts/lighthouse_regressions.py', regression)

# Wire the regression contract into the repository's normal audit surfaces.
path = 'package.json'
pkg = json.loads(read(path))
scripts = pkg['scripts']
scripts['audit:lighthouse-regressions'] = 'python3 scripts/lighthouse_regressions.py'
for key in ('audit:all', 'qa'):
    current = scripts[key]
    anchor = 'npm run audit:release'
    if anchor not in current:
        raise SystemExit(f'package {key}: audit:release anchor missing')
    scripts[key] = current.replace(anchor, anchor + ' && npm run audit:lighthouse-regressions', 1)
write(path, json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')
