from pathlib import Path
import json
import re


def read(path):
    return Path(path).read_text('utf-8')


def require(condition, message):
    if not condition:
        raise SystemExit('Lighthouse regression: ' + message)


def public_html_files():
    excluded = {'.git', 'node_modules', '_site', 'playwright-report', 'test-results',
                'audit', '_mockups', '_review_screens'}
    return (path for path in sorted(Path('.').rglob('*.html'))
            if not excluded.intersection(path.parts))


sw = read('sw.js')
style_match = re.search(r"'/css/style\.css\?v=([^']+)',", sw)
require(style_match is not None, 'service-worker precache lost its versioned shared CSS')
style_ref = f'/css/style.css?v={style_match.group(1)}'

home = read('index.html')
# Шрифты переехали на самохостинг 2026-10-30: третьесторонний origin из
# критического пути убран. Контракт теперь требует ровно обратного — что
# Google Fonts не вернулись ни ссылкой, ни preconnect.
require(
    'href="/css/fonts.css?v=' in home,
    'homepage lost its self-hosted font stylesheet',
)
require(
    'fonts.googleapis.com' not in home and 'fonts.gstatic.com' not in home,
    'homepage regained a third-party font origin (IP leak before consent)',
)
require('id="anti-fouc-body"' not in home, 'homepage body-level anti-FOUC gate returned')
require('body:not(.ready){opacity:0}' not in home, 'homepage can still be hidden before DOMContentLoaded')
require("classList.add('page-loaded')" not in home, 'homepage DOMContentLoaded main reveal reset returned')
# Catalog images are below the fold. Eager hints compete with the hero and blocking CSS
# on a first mobile visit; the catalog renderer loads them on scroll/intent instead.
for below_fold in ('img/bento_maxi.webp', 'img/cake_3d.webp', 'img/cake_3d_2.webp'):
    require(f'<link rel="prefetch" href="{below_fold}"' not in home,
            f'homepage prefetch competes with the critical path: {below_fold}')
# The parser-discoverable LCP hero must never participate in the generic pre-load fade.
require(
    '<img class="hero-img" src="img/head_desktop.webp"' in home,
    'homepage LCP hero is not explicitly excluded from the generic image fade',
)
main_js = read('js/main.js')
chat_sources = main_js.split('const CHAT_SRCS = [', 1)[1].split('];', 1)[0]
for number in range(1, 9):
    thumb = Path(f'img/review_{number}-thumb.webp')
    original = Path(f'img/review_{number}.webp')
    require(thumb.is_file(), f'homepage review thumbnail missing: {thumb}')
    require(thumb.stat().st_size < original.stat().st_size, f'homepage review thumbnail is not smaller: {thumb}')
    require(f'<img src="img/review_{number}-thumb.webp"' in home, f'homepage filmstrip returned to full review image {number}')
    require(f"IMG_BASE + '/review_{number}.webp'" in chat_sources, f'review lightbox lost full-resolution source {number}')
    require(f'review_{number}-thumb.webp' not in chat_sources, f'review lightbox incorrectly uses thumbnail {number}')
require(
    'img:not(.hero-img):not([class*="head"])' in main_js,
    'homepage hero exclusion disappeared from the generic image fade selector',
)
require(
    "var isHomepage = path === '/' || path === '/index.html';" in main_js,
    'homepage-specific decorative hero-motion gate missing',
)
require(
    "hero.classList.add('hero--motion-ready');" in main_js
    and "fallbackTimer = setTimeout(enableHeroMotion, 8000);" in main_js,
    'homepage decorative hero motion is no longer bounded outside the initial LCP window',
)
require(
    "document.addEventListener('pointerdown', enableAfterIntent, { once: true, passive: true });" in main_js
    and "document.addEventListener('keydown', enableAfterIntent, { once: true });" in main_js,
    'homepage hero motion lost its first-intent release path',
)
require(
    'function scheduleParallax()' in main_js
    and 'scheduleParallax();' in main_js
    and 'if (!heroInView || document.hidden || rafId) return;' in main_js
    and 'if (!rafId) animateParallax();' not in main_js,
    'homepage gyroscope parallax returned to an unconditional animation loop',
)

require(
    'function scheduleCatalogHydration()' in main_js
    and "document.addEventListener('click', release, { once: true });" in main_js
    and "document.addEventListener('keydown', () => setTimeout(release, 0), { once: true });" in main_js
    and "rootMargin: '200px 0px'" in main_js
    and '_catalogHydrationTimer = setTimeout(release, 8000);' in main_js,
    'homepage catalog hydration returned to the initial LCP window or lost an intent/viewport release path',
)
require(
    'function initCatalogSliderVisibility()' in main_js
    and 'initCatalogSliderVisibility();' in main_js,
    'deferred homepage catalog lost post-hydration slider visibility lifecycle',
)
init_app = main_js.split('function initApp() {', 1)[1].split("\n}\n\nif (document.readyState", 1)[0]
require(
    'scheduleCatalogHydration();' in init_app
    and 'renderCatalogNav();' not in init_app
    and 'renderCatalog();' not in init_app
    and 'loadCartFromStorage();' in init_app
    and 'updateCartUI();' in init_app
    and 'updateCalc();' in init_app,
    'homepage catalog work returned to synchronous initApp or immediate cart/calculator lifecycle was deferred',
)
require(
    'aria-label="Перейти к ${p.name}"' not in main_js,
    'deferred catalog renderer can recreate the old catalog accessible-name mismatch',
)

mc_js = read('js/mc-2026.js')
require(
    "document.fonts.load('" not in mc_js
    and "['https://fonts.googleapis.com', 'https://fonts.gstatic.com']" not in mc_js,
    'shared UX runtime regained forced Google Font loads or duplicate late font preconnects',
)
require(
    "strip.removeAttribute('role');" in mc_js
    and "d.setAttribute('role', 'listitem')" not in mc_js,
    'homepage video strip regained incompatible synthetic list semantics',
)
# [r38] Постер ленты подгружается отложенно: адрес живёт в data-poster, пока
# плитка далеко от экрана. Контракт по-прежнему требует, чтобы постер был
# ДЕКОРАТИВНЫМ (пустой alt) и его адрес действительно назначался кодом —
# проверяем обе половины отдельно, не привязываясь к форме одной строки.
require(
    "img.alt = '';" in mc_js
    and ("img.setAttribute('data-poster', it.p)" in mc_js or "img.src = it.p;" in mc_js),
    'homepage video-strip poster is no longer decorative inside its labelled link',
)
require(
    "catalogNavItems[c].removeAttribute('aria-label');" in mc_js,
    'homepage catalog nav regained an aria-label that disagrees with visible text',
)

faq_js = read('js/v20-faq-fix.js')
require(
    "item.removeAttribute('role');" in faq_js
    and "item.removeAttribute('tabindex');" in faq_js
    and "item.removeAttribute('aria-label');" in faq_js
    and "item.removeAttribute('aria-expanded');" in faq_js,
    'homepage content-block FAQ wrapper regained interactive semantics',
)
require(
    "control.setAttribute('role', 'button');" in faq_js
    and "control.setAttribute('tabindex', '0');" in faq_js
    and "control.removeAttribute('aria-label');" in faq_js
    and "control.setAttribute('aria-expanded', item.classList.contains('cb-open') ? 'true' : 'false');" in faq_js,
    'homepage content-block FAQ question lost control semantics or expanded-state synchronization',
)
require(
    "if (e.key !== 'Enter' && e.key !== ' ') return;" in faq_js
    and "if (typeof window.cbFaq === 'function') window.cbFaq(item);" in faq_js
    and "item.click();" not in faq_js,
    'homepage content-block FAQ keyboard activation regressed',
)

for path in [
    'index.html',
    'gallery/index.html',
    'svadebnye-torty/index.html',
    'bento-torty/index.html',
    'zakazat-tort-spb/index.html',
    'o-konditere/index.html',
    'otzyvy/index.html',
    'dostavka-i-oplata/index.html',
]:
    text = read(path)
    require('display=swap' not in text, f'{path} reintroduced display=swap')

for path in ['svadebnye-torty/index.html', 'bento-torty/index.html', 'zakazat-tort-spb/index.html']:
    require('loading="eager"' not in read(path), f'{path} reintroduced below-fold eager media')

bento = read('bento-torty/index.html')
require('<style id="bento-critical">' in bento, 'Bento first-screen geometry lost its critical CSS')
require(f'rel="preload" as="style" href="{style_ref}" onload="this.onload=null;this.rel=\'stylesheet\'"' in bento, 'Bento shared CSS blocks its first paint again')
require(f'<noscript><link rel="stylesheet" href="{style_ref}"' in bento, 'Bento no-script stylesheet fallback missing')
require('/img/bento_1-mobile-640.avif" media="(max-width: 768px)" fetchpriority="high"' in bento, 'Bento mobile LCP preload missing')
require('media="(max-width: 768px)" srcset="/img/bento_1-mobile-640.avif"' in bento, 'Bento mobile LCP source missing')
require('/img/bento_1.avif" media="(min-width: 769px)" fetchpriority="high"' in bento, 'Bento desktop LCP preload lost its media guard')
require(Path('img/bento_1-mobile-640.avif').is_file(), 'Bento 640px mobile LCP derivative missing')
require(
    Path('img/bento_1-mobile-640.avif').stat().st_size < Path('img/bento_1-mobile.avif').stat().st_size,
    'Bento 640px LCP derivative is not smaller than the previous mobile source',
)
for preview, source in [
    ('img/gallery/gallery-27-preview.avif', 'img/gallery/gallery-27.avif'),
    ('img/gallery/gallery-27-card.avif', 'img/gallery/gallery-27.avif'),
    ('img/bento_1-card.avif', 'img/bento_1.avif'),
    ('img/gallery/gallery-30-preview.avif', 'img/gallery/gallery-30.avif'),
]:
    require(Path(preview).is_file(), f'Bento preview derivative missing: {preview}')
    require(Path(preview).stat().st_size < Path(source).stat().st_size, f'Bento preview is not smaller than source: {preview}')
require('/img/gallery/gallery-27-preview.avif' in bento, 'Bento first portfolio preview returned to the full AVIF')
require('/img/gallery/gallery-30-preview.avif' in bento, 'Bento second portfolio preview returned to the full AVIF')
require('poster="/img/gallery/video-07-bento-bday-poster.webp"' in bento, 'Bento birthday clip lost its own frame')
require('poster="/img/gallery/video-06-bento-love-poster.webp"' in bento, 'Bento Love clip lost its own frame')
require('/img/bento_1-card.avif' in bento, 'Bento product card returned to the full bento source')
require('/img/gallery/gallery-27-card.avif' in bento, 'Bento birthday card returned to the full gallery source')

order = read('zakazat-tort-spb/index.html')
require('/img/head_mobile.avif" media="(max-width: 768px)" fetchpriority="high"' in order, 'order page mobile hero preload missing')
require('media="(max-width: 768px)" srcset="/img/head_mobile.avif"' in order, 'order page mobile hero source missing')

gallery = read('gallery/index.html')
require('id="preloader"' not in gallery, 'gallery blocking preloader returned')
require('/img/gallery/gallery-01.avif" fetchpriority="high"' in gallery, 'gallery LCP preload missing')
require('/js/gallery/main.js?v=20261120r05' in gallery, 'gallery runtime revision drift')
require("./data.js?v=20261120r03" in read('js/gallery/main.js'), 'gallery data import revision drift')
require('#galleryGrid[data-hydrating="true"] { min-height: 100svh; }' in gallery, 'gallery hydration reserve missing')
require('#galleryGrid[data-static-lcp-root="true"] { animation: none; }' in gallery, 'gallery grid animation gates initial LCP again')
require('data-static-lcp="p01"' in gallery, 'gallery initial LCP card is no longer parser-visible')
require('data-hydrating="true" data-static-lcp-root="true"' in gallery, 'gallery static-LCP hydration markers missing')
require('<source type="image/avif" srcset="/img/gallery/gallery-01.avif">' in gallery, 'gallery static LCP AVIF source drifted')
require('fetchpriority="high" src="/img/gallery/gallery-01.webp"' in gallery, 'gallery static LCP fallback lost high priority')
require('id="galleryGrid" role="list"' not in gallery, 'gallery grid regained synthetic list semantics')
require('role="listitem"' not in gallery, 'gallery native card button regained incompatible listitem role')
# Атрибуты могут идти в любом порядке (размеры добавились для CLS), важны
# сами три свойства: декоративный alt, eager и класс статической карточки.
require(
    re.search(r'<img class="card-media"(?=[^>]*\balt="")(?=[^>]*\bloading="eager")[^>]*>', gallery),
    'gallery static card media is no longer decorative inside its labelled button',
)
require(
    'id="gxEmpty" style="display: none;"' in gallery,
    'gallery initial-layout reserve sentinel drifted',
)
# Версия Swiper должна быть закреплена точным патчем, а не плавающим @11:
# адрес берём из самой страницы, чтобы гард ловил и возврат к плавающей версии,
# и рассинхрон между CSS и JS.
swiper_pin = re.search(
    r'https://cdn\.jsdelivr\.net/npm/swiper@(\d+\.\d+\.\d+)/swiper-bundle\.min\.js',
    gallery,
)
require(swiper_pin, 'gallery Swiper source is not pinned to an exact patch version')
swiper_css = f'https://cdn.jsdelivr.net/npm/swiper@{swiper_pin.group(1)}/swiper-bundle.min.css'
swiper_js = f'https://cdn.jsdelivr.net/npm/swiper@{swiper_pin.group(1)}/swiper-bundle.min.js'
require(
    'href="/css/fonts.css?v=' in gallery,
    'gallery lost its self-hosted font stylesheet',
)
require(
    'fonts.googleapis.com' not in gallery,
    'gallery regained a third-party font origin',
)
require(
    re.search(
        rf'href="{re.escape(swiper_css)}"(?=[^>]*\bintegrity="sha384-[^"]+")'
        rf'(?=[^>]*\bcrossorigin="anonymous")'
        rf'(?=[^>]*\bmedia="print")(?=[^>]*\bonload="this\.onload=null;this\.media=\'all\'")',
        gallery,
    ),
    'gallery Swiper CSS returned to the critical render path or lost SRI',
)
# Локальный css/fonts.css грузится обычным stylesheet: noscript-дубль больше
# не нужен, а его возврат означал бы, что кто-то снова сделал шрифты асинхронными.
require(
    'fonts.googleapis.com' not in gallery,
    'gallery font stylesheet became third-party again',
)
require(
    re.search(
        rf'<noscript><link rel="stylesheet" href="{re.escape(swiper_css)}"'
        rf'(?=[^>]*\bintegrity="sha384-[^"]+")[^>]*></noscript>',
        gallery,
    ),
    'gallery Swiper noscript fallback missing or without SRI',
)
require(f'<script src="{swiper_js}"' not in gallery, 'gallery Swiper JS returned to initial page load')
require('id="gallery-swiper-interaction-loader"' in gallery, 'gallery inline Swiper interaction loader missing')
require(swiper_js in gallery, 'gallery interaction loader lost pinned Swiper source')
require("target.closest('#galleryGrid .card')" in gallery, 'gallery Swiper loader is no longer scoped to gallery-card interaction')
for event in ['pointerdown', 'focusin', 'click']:
    require(
        f"document.addEventListener('{event}', maybeLoad, true);" in gallery,
        f'gallery Swiper loader lost {event} interaction trigger',
    )
require('script.async = true;' in gallery, 'gallery Swiper interaction load is not asynchronous')
require(
    "const SWIPER_SRI = 'sha384-" in gallery
    and 'script.integrity = SWIPER_SRI;' in gallery
    and "script.crossOrigin = 'anonymous';" in gallery,
    'gallery Swiper interaction loader lost integrity metadata',
)
require("script.addEventListener('error'" in gallery and 'loading = false;' in gallery, 'gallery Swiper loader cannot retry after CDN failure')
require('/css/gallery/gallery-2026.css?v=20261120r07" />' in gallery, 'gallery critical local CSS became deferred or changed revision')
require('/css/final-fixes.css?v=20261120r47" />' in gallery, 'gallery final critical CSS became deferred')
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
require(
    '@media (hover: hover) and (pointer: fine) {\n  .gallery-grid:has(.card:hover) .card:not(:hover) {' in gallery_css
    and 'filter: blur(8px) brightness(0.7);' in gallery_css,
    'gallery peer blur must remain desktop-hover-only, never sticky on touch',
)
require('.card-skeleton{' in gallery_css, 'gallery lazy-card skeleton contract disappeared globally')
require('.card.is-loading .card-media{ opacity:0;' in gallery_css, 'gallery lazy media no longer keeps the premium reveal contract')

gallery_js = read('js/gallery/main.js')
require("if(index===0) img.fetchPriority='high';" in gallery_js, 'gallery first image lost high fetch priority')
require("const staticCard = grid.querySelector('[data-static-lcp=\"p01\"]');" in gallery_js, 'gallery static LCP lookup missing')
require("const reuseStaticLcp = state.filter === 'all'" in gallery_js, 'gallery initial LCP is not reused during hydration')
require("staticCard.dataset.hydrated = 'true';" in gallery_js, 'gallery static LCP interaction hydration missing')
require("const GRID_RENDER_BATCH_SIZE = 24;" in gallery_js, 'gallery progressive render batch size drifted')
require("document.body.classList.contains('mc-consent-open')" in gallery_js, 'gallery video observer ignores open consent dialog')
require("const renderToken=++state.gridRenderToken;" in gallery_js, 'gallery progressive render cancellation token missing')
require("while(cursor < visibleItems.length && built < GRID_RENDER_BATCH_SIZE)" in gallery_js, 'gallery cards returned to one synchronous hydration task')
require("scheduleGridBatch(appendNextBatch);" in gallery_js, 'gallery progressive render no longer yields between batches')
require("requestAnimationFrame(() => setTimeout(callback, 0));" in gallery_js, 'gallery progressive render scheduler no longer yields a task/frame boundary')
require("grid.removeAttribute('data-hydrating');" in gallery_js, 'gallery hydration reserve is never released')
require("v.preload='none';" in gallery_js, 'gallery video preload competes with LCP')
require('v.autoplay=true' not in gallery_js, 'gallery videos autoplay during initial load')
require("if(index<4) card.style.animation='none';" in gallery_js, 'above-fold gallery cards animate into LCP')
require(
    "script?.addEventListener('load',init,options)" in gallery_js
    and "css?.addEventListener('load',init,options)" in gallery_js
    and 'const index=state.lbIndex;' in gallery_js
    and 'function showLightboxSlide(index, immediate=false)' in gallery_js
    and 'state._swiperAbort?.abort();' in gallery_js,
    'gallery lost cancellable late Swiper initialization or its offline navigation fallback',
)
require("card.setAttribute('role', 'listitem')" not in gallery_js, 'gallery dynamic native button regained incompatible listitem role')
require("img.alt='';" in gallery_js, 'gallery dynamic card media is no longer decorative inside its labelled button')
require("card.setAttribute('aria-label',`${item.title}. Открыть в 3D-галерее`);" in gallery_js, 'gallery cards lost explicit accessible names')
require(
    "const PHONE_CARD_MEDIA = '(max-width: 430px) and (max-resolution: 1.75dppx)';" in gallery_js,
    'gallery phone-card media boundary drifted',
)
require("const PHONE_CARD_IDS = new Set(['p05', 'p06', 'p09', 'p12', 'p18']);" in gallery_js, 'gallery phone-card allowlist drifted')
require(r"return item.src.replace(/\.webp(\?|$)/i, '-card.avif$1');" in gallery_js, 'gallery phone-card AVIF derivation disappeared')
require("phoneSource.media = PHONE_CARD_MEDIA;" in gallery_js, 'gallery phone AVIF source lost its media guard')
require("phoneSource.srcset = phoneAvifSrc;" in gallery_js, 'gallery phone AVIF source lost its derivative URL')
for number in [5, 6, 9, 12, 18]:
    require(Path(f'img/gallery/gallery-{number:02d}-card.avif').is_file(), f'gallery phone-card derivative missing for gallery-{number:02d}')

gatchina = read('prigorody/gatchina/index.html')
# Блок «Почему выбирают нас» дословно дублировал главную и удалён вместе с
# четырьмя h3; вместо него на странице уникальный городской текст в #story.
# Гард держит структуру заголовков: ровно один h1 в начале и живая секция #story.
for duplicated in ['Ручная Работа', 'Внимание к составу', 'Свежесть под заказ', 'Доставка по СПб']:
    require(
        f'<h3>{duplicated}</h3>' not in gatchina and f'<h4>{duplicated}</h4>' not in gatchina,
        f'Gatchina duplicated homepage block returned: {duplicated}',
    )
gatchina_levels = [int(level) for level in re.findall(r'<h([1-6])[\s>]', gatchina)]
require(
    gatchina_levels and gatchina_levels[0] == 1 and gatchina_levels.count(1) == 1,
    'Gatchina heading order drift: page must start with a single h1',
)
require('<section class="city-story" id="story">' in gatchina, 'Gatchina unique city story section disappeared')
require(gatchina.count('<button type="button" class="cb-faq-q"') == 3, 'Gatchina FAQ is not three native buttons')
require('min-height:48px' in gatchina, 'Gatchina FAQ target-size contract missing')

landing_css = read('css/style.css')
require(
    '.hero-photo-bg img{transform-origin:64% 42%}' in landing_css
    and '.hero--visible.hero--motion-ready .hero-photo-bg img{will-change:transform;animation:heroKenBurns 26s' in landing_css,
    'decorative hero motion returned to the initial LCP path',
)
require(
    '.hero-photo-bg img{will-change:transform;transform-origin:64% 42%}' not in landing_css,
    'homepage LCP image regained unconditional will-change',
)
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
    require(style_ref in read(path), f'{path} landing a11y CSS revision drifted')

# Shared CSS and its service-worker generation must move as one release unit.
for public_html in public_html_files():
    html = read(public_html)
    if 'style.css?v=' in html:
        require(style_ref.lstrip('/') in html, f'{public_html} shared style revision drifted')
        require('style.css?v=20261023r01' not in html, f'{public_html} still references stale shared style revision')

# Changed shared styles must agree between every consumer and the precache.
for asset in ('style.css', 'mc-2026.css', 'premium-overrides.css', 'v20-dark-and-fixes.css'):
    # Ревизию берём из precache: источник истины — сам service worker, а не
    # список констант в гарде. Так гард ловит именно рассинхрон потребителей
    # с precache, а не каждое плановое поднятие версии CSS.
    precache = re.search(rf"'/css/{re.escape(asset)}\?v=([0-9a-z]+)',", sw)
    require(precache, f'{asset} service-worker revision missing')
    revision = precache.group(1)
    for public_html in public_html_files():
        refs = re.findall(rf'css/{re.escape(asset)}\?v=([0-9a-z]+)', read(public_html))
        require(all(ref == revision for ref in refs), f'{public_html} {asset} revision drifted')

# Shared main.js identity must agree across every HTML consumer and the
# precache. Keep the last proven baseline as a rollback floor, not as an
# exact pin that fails every intentional coordinated asset revision.
main_match = re.search(r"'/js/main\.js\?v=(\d{8}r\d+)',", sw)
require(main_match is not None, 'service-worker precache lost its versioned shared main.js')
main_revision = main_match.group(1)
def revision_key(value):
    date, sequence = value.split('r')
    return int(date), int(sequence)

require(revision_key(main_revision) >= revision_key('20261116r41'),
        'service-worker precache still points at stale shared main.js revision')
main_consumers = 0
for public_html in public_html_files():
    html = read(public_html)
    refs = re.findall(r'js/main\.js\?v=([0-9a-z]+)', html)
    require(all(ref == main_revision for ref in refs), f'{public_html} shared main.js revision drifted')
    if refs:
        main_consumers += 1
require(main_consumers >= 15, 'shared main.js consumer coverage regressed')

cache_gen = re.search(r"const CACHE_NAME = 'milovi-cake-v2026\.11\.16-r(\d+)';", sw)
require(cache_gen, 'service-worker cache generation format drifted')
require(int(cache_gen.group(1)) >= 186, 'service-worker cache generation rolled back')
require("'/css/gallery/gallery-2026.css?v=20261120r07'," in sw, 'gallery CSS service-worker revision drifted')
require(style_ref != '/css/style.css?v=20261023r01', 'service-worker precache still points at stale shared CSS revision')
require("'/js/nav.js?v=20261116r27'," in sw, 'service-worker precache still points at stale shared nav.js revision')
require("'/js/gallery/main.js?v=20261120r05'," in sw, 'service-worker precache still points at stale gallery runtime revision')
require("'/js/gallery/data.js?v=20261120r03'," in sw, 'service-worker precache still points at stale gallery data revision')
require("'/js/consent-analytics.js?v=20261120r04'," in sw, 'service-worker precache still points at stale consent loader revision')

cfg = json.loads(read('.github/lighthouse-config.json'))
require(cfg['ci']['collect'].get('numberOfRuns') == 3, 'Lighthouse collection is not three runs')
assertions = cfg['ci']['assert']['assertions']
for audit in ['categories:accessibility', 'categories:best-practices', 'categories:seo', 'cumulative-layout-shift']:
    require(assertions[audit][0] == 'error', f'{audit} must remain fail-closed')
# Simulated TBT cannot separate a site regression from the Lantern window: on
# byte-identical trees it spans 0-1076 ms across sessions and CPU multipliers
# (docs/TBT_VERDICT_2026-10-28.md sections 10-21). It stays visible as a warning;
# the threshold and the median aggregation below are pinned so the reported number
# remains comparable and cannot be tuned away instead of fixed.
for audit in ['categories:performance', 'largest-contentful-paint', 'total-blocking-time']:
    require(assertions[audit][0] == 'warn', f'{audit} severity changed without evidence-backed closure')
require(
    assertions['total-blocking-time'][1].get('maxNumericValue') == 300,
    'total-blocking-time must keep the evidence-backed 300 ms reference threshold',
)
require(
    assertions['total-blocking-time'][1].get('aggregationMethod') == 'median',
    'total-blocking-time must keep median aggregation',
)
require(
    assertions['categories:accessibility'][1].get('minScore') == 0.95,
    'accessibility fail-closed threshold drifted from the proven 0.95 floor',
)
require(
    assertions['cumulative-layout-shift'][1].get('maxNumericValue') == 0.1,
    'CLS fail-closed threshold drifted from the proven 0.1 ceiling',
)

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

# [r38] Главная на ≤768 px показывает не .hero-photo-bg (он там display:none),
# а мобильный арт .hero-art → img/hero-poster-cake.webp. Контракт по-прежнему
# требует ровно один предзагружаемый герой-кандидат на брейкпоинт, но теперь
# сверяет его с тем, что реально рендерится: предзагрузка скрытой картинки и
# была источником лишних 18 KB и потери приоритета у настоящего LCP.
require(
    '<link rel="preload" as="image" type="image/avif" href="img/head_mobile-640.avif" media="(max-width:768px)"' not in home,
    'homepage preloads a mobile hero that CSS hides on mobile',
)
require(
    '<link rel="preload" as="image" type="image/webp" href="img/hero-poster-cake.webp' not in home,
    'homepage re-added a mobile poster preload that measurably delayed the LCP',
)
require(
    '<source type="image/webp" srcset="img/hero-poster-cake.webp' in home
    and 'width="790" height="1087" fetchpriority="high"' in home,
    'homepage mobile LCP poster lost its eager high-priority markup',
)
require(
    '<link rel="preload" as="image" type="image/webp" href="img/head_mobile.webp"' not in home,
    'homepage duplicate mobile WebP hero preload returned',
)
require(
    '<source type="image/webp" media="(max-width: 768px)" srcset="img/head_mobile.webp" />' in home,
    'homepage mobile WebP picture fallback was removed',
)

require(
    '<source type="image/avif" media="(max-width: 768px)" srcset="img/head_mobile-640.avif" />' in home,
    'homepage preferred mobile AVIF picture source missing',
)
require(Path('img/head_mobile-640.avif').is_file(), 'homepage 640px hero derivative missing')
require(
    Path('img/head_mobile-640.avif').stat().st_size < Path('img/head_mobile.avif').stat().st_size,
    'homepage 640px hero derivative is not smaller than previous mobile source',
)
require(
    '<picture><source type="image/avif" srcset="img/viktoria-480.avif"><img src="img/viktoria.webp"' in home,
    'homepage Viktoria presentation derivative missing',
)
require(Path('img/viktoria-480.avif').is_file(), 'homepage Viktoria 480px derivative missing')
require(
    Path('img/viktoria-480.avif').stat().st_size < Path('img/viktoria.avif').stat().st_size,
    'homepage Viktoria derivative is not smaller than source',
)

# Suburb pages share the homepage hero geometry (.hero-photo-bg in shared style.css),
# so they preload the same preferred AVIF candidates. Preloading WebP while the
# picture renders AVIF wastes critical-path bandwidth (measured double fetch).
suburb_template = read('prigorody/_template.html')
require(
    '<link rel="preload" as="image" type="image/avif" href="../../img/head_desktop.avif" media="(min-width:769px)" fetchpriority="high" />' in suburb_template,
    'suburb preferred desktop AVIF hero preload missing',
)
require(
    '<link rel="preload" as="image" type="image/avif" href="../../img/head_mobile-640.avif" media="(max-width:768px)" fetchpriority="high" />' in suburb_template,
    'suburb preferred mobile AVIF hero preload missing',
)
require(
    '<link rel="preload" as="image" href="../../img/head_desktop.webp"' not in suburb_template
    and '<link rel="preload" as="image" href="../../img/head_mobile.webp"' not in suburb_template,
    'suburb duplicate WebP hero preload returned',
)
require(
    '<source type="image/avif" media="(max-width: 768px)" srcset="../../img/head_mobile-640.avif" />' in suburb_template,
    'suburb preferred mobile AVIF picture source missing',
)
require(
    '<source type="image/webp" media="(max-width: 768px)" srcset="../../img/head_mobile.webp" />' in suburb_template,
    'suburb mobile WebP picture fallback was removed',
)
require(
    '<link rel="preload" as="image" type="image/avif" href="../../img/head_mobile-640.avif" media="(max-width:768px)" fetchpriority="high" />' in gatchina,
    'built suburb page lost the preferred mobile AVIF hero preload',
)

# Meringue hero: арт-дирекшн под рамку + preload, повторяющий srcset один-в-один.
# Раньше здесь стоял портретный кадр 1024×1536 (117 660 Б) на слот, который
# object-fit:cover срезал до полосы 1.82:1 — телефон возил две трети лишних
# пикселей. Теперь hero режется под рамку и грузится по srcset: 50 852 Б на
# Pixel 7 вместо 117 660 Б. Preload обязан совпадать с <picture> через
# imagesrcset/imagesizes, иначе браузер скачивает два файла.
meringue = read('meringue-roll/index.html')
require(
    '<link rel="preload" as="image" type="image/avif" media="(max-width: 1024px)"' in meringue
    and 'imagesrcset="../img/meringue_roll-hero-m.avif 820w, ../img/meringue_roll-hero-m2x.avif 1024w"'
    in meringue
    and 'imagesizes="100vw"' in meringue,
    'meringue mobile AVIF hero preload (imagesrcset/imagesizes) missing',
)
require(
    '<link rel="preload" as="image" type="image/avif" media="(min-width: 1025px)"' in meringue
    and 'imagesrcset="../img/meringue_roll-hero-d.avif 760w, ../img/meringue_roll-hero-d2x.avif 1024w"'
    in meringue
    and 'imagesizes="50vw"' in meringue,
    'meringue desktop AVIF hero preload (imagesrcset/imagesizes) missing',
)
require(
    'href="../img/meringue_roll.avif"' not in meringue,
    'meringue preload regressed to the portrait 1024×1536 original',
)
require(
    '<link rel="preload" as="image" href="../img/meringue_roll.webp"' not in meringue,
    'meringue duplicate WebP hero preload returned',
)
require(
    '<source media="(max-width: 1024px)" type="image/avif"' in meringue
    and '<source media="(min-width: 1025px)" type="image/avif"' in meringue,
    'meringue hero art direction (two media sources) drifted',
)
require(
    'srcset="../img/meringue_roll.avif"' not in meringue,
    'meringue hero shipped the portrait original again',
)
require(
    '<img src="../img/meringue_roll.webp"' in meringue
    and 'fetchpriority="high"' in meringue,
    'meringue WebP fallback or hero priority drifted',
)

# Контракт адаптивных картинок на /meringue-roll/: каждый <source> обязан нести
# и srcset, и sizes — иначе браузер берёт первый кандидат (1024w) и снова тянет
# тяжёлый кадр в маленький слот. 11 <picture> = hero + 5 галерейных + 2 сплита
# + 3 декора.
import re as _re
meringue_pictures = _re.findall(r'<picture>.*?</picture>', meringue, _re.S)
require(len(meringue_pictures) == 11, f'meringue pictures: {len(meringue_pictures)}, ожидалось 11')
for _index, _block in enumerate(meringue_pictures):
    _sources = _re.findall(r'<source[^>]*>', _block)
    require(_sources, f'meringue picture #{_index}: нет <source type="image/avif">')
    for _source in _sources:
        require('srcset=' in _source and 'sizes=' in _source,
                f'meringue picture #{_index}: <source> без srcset/sizes')
    require(_re.search(r'<img [^>]*>', _block), f'meringue picture #{_index}: нет <img>')

print('Lighthouse root-cause regression contract OK')
