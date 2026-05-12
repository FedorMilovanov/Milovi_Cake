#!/usr/bin/env python3
"""
Milovi Cake — Генератор страниц пригородов v2
Run: python3 prigorody/build.py
"""
import os, csv, re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(BASE_DIR, '_template.html')
CSV_PATH = os.path.join(BASE_DIR, '_cities.csv')

CITY_INFO = {
    'gatchina':    {'name':'Гатчина',      'price':'от 1 500 ₽','km':'~45 км'},
    'peterhof':    {'name':'Петергоф',     'price':'от 1 500 ₽','km':'~35 км'},
    'pushkin':     {'name':'Пушкин',       'price':'от 1 000 ₽','km':'~25 км'},
    'kolpino':     {'name':'Колпино',      'price':'от 1 000 ₽','km':'~20 км'},
    'murino':      {'name':'Мурино',       'price':'от 1 200 ₽','km':'~18 км'},
    'kudrovo':     {'name':'Кудрово',      'price':'от 900 ₽',  'km':'~15 км'},
    'vsevolozhsk': {'name':'Всеволожск',   'price':'от 1 500 ₽','km':'~25 км'},
    'shushary':    {'name':'Шушары',       'price':'от 600 ₽',  'km':'~10 км'},
    'krasnoe-selo':{'name':'Красное Село', 'price':'от 800 ₽',  'km':'~20 км'},
    'kronshtadt':  {'name':'Кронштадт',    'price':'от 1 500 ₽','km':'~55 км'},
    'lomonosov':   {'name':'Ломоносов',    'price':'от 1 500 ₽','km':'~40 км'},
    'pavlovsk':    {'name':'Павловск',     'price':'от 1 000 ₽','km':'~28 км'},
    'sestroretsk': {'name':'Сестрорецк',   'price':'от 1 500 ₽','km':'~35 км'},
    'tosno':       {'name':'Тосно',        'price':'от 1 500 ₽','km':'~45 км'},
}

NEARBY = {
    'gatchina':     ['pushkin','krasnoe-selo','pavlovsk','kolpino'],
    'peterhof':     ['lomonosov','krasnoe-selo','sestroretsk'],
    'pushkin':      ['pavlovsk','gatchina','kolpino','shushary'],
    'kolpino':      ['shushary','tosno','pushkin','murino'],
    'murino':       ['kudrovo','vsevolozhsk'],
    'kudrovo':      ['murino','vsevolozhsk','kolpino'],
    'vsevolozhsk':  ['murino','kudrovo','sestroretsk'],
    'shushary':     ['kolpino','pushkin','krasnoe-selo'],
    'krasnoe-selo': ['peterhof','gatchina','lomonosov','shushary'],
    'kronshtadt':   ['sestroretsk','lomonosov','peterhof'],
    'lomonosov':    ['peterhof','krasnoe-selo','kronshtadt'],
    'pavlovsk':     ['pushkin','gatchina','kolpino'],
    'sestroretsk':  ['kronshtadt','vsevolozhsk','peterhof'],
    'tosno':        ['kolpino','shushary','gatchina'],
}

YANDEX_REVIEWS = {
    'R1': """            <div class="map-review-item">
              <div class="map-reviewer-row">
                <div class="map-reviewer-avatar" style="background:#c0604a;">Е</div>
                <div class="map-reviewer-info">
                  <span class="map-reviewer-name">Евгения Монтихо</span>
                  <span class="map-reviewer-date"><time datetime="2025-12-20">20 декабря 2025</time></span>
                  <span class="map-reviewer-stars">★★★★★</span>
                </div>
              </div>
              <p class="map-reviewer-text map-text-clamp">Дважды заказывали торты. Первый раз сделали в стиле Острова с ярким вкусом тропических фруктов, второй в выдержанном стиле с начинкой «вишня в шоколаде». Оба торта шикарные, ваше творчество дарит эстетическое и гастрономическое удовольствие. Благодарим от всего сердца 💕🎂😍</p>
              <a href="https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/reviews/" target="_blank" rel="noopener noreferrer" class="map-review-source">Читать на Яндекс Картах →</a>
            </div>""",
    'R2': """            <div class="map-review-item">
              <div class="map-reviewer-row">
                <div class="map-reviewer-avatar" style="background:#6a7fc8;">Е</div>
                <div class="map-reviewer-info">
                  <span class="map-reviewer-name">Екатерина Гарсес Еникеева</span>
                  <span class="map-reviewer-date"><time datetime="2025-11-24">24 ноября 2025</time></span>
                  <span class="map-reviewer-stars">★★★★★</span>
                </div>
              </div>
              <p class="map-reviewer-text map-text-clamp">Являюсь постоянным клиентом Виктории. Все торты на детские дни рождения берём у неё. Ценю индивидуальный подход, всегда всё вовремя, воплощаем любые идеи — вкусно, красиво и качественно.</p>
              <a href="https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/reviews/" target="_blank" rel="noopener noreferrer" class="map-review-source">Читать на Яндекс Картах →</a>
            </div>""",
    'R3': """            <div class="map-review-item">
              <div class="map-reviewer-row">
                <div class="map-reviewer-avatar" style="background:#72b58a;">Е</div>
                <div class="map-reviewer-info">
                  <span class="map-reviewer-name">Евгения Е.</span>
                  <span class="map-reviewer-date"><time datetime="2025-11-29">29 ноября 2025</time></span>
                  <span class="map-reviewer-stars">★★★★★</span>
                </div>
              </div>
              <p class="map-reviewer-text map-text-clamp">Заказывала у Виктории тортики много раз, на праздники и просто так — всегда безумно вкусно! Оформление и дизайн отличные, любой сложности. Отзывчивый мастер, все заказы в срок 👍</p>
              <a href="https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/reviews/" target="_blank" rel="noopener noreferrer" class="map-review-source">Читать на Яндекс Картах →</a>
            </div>""",
    'R4': """            <div class="map-review-item">
              <div class="map-reviewer-row">
                <div class="map-reviewer-avatar" style="background:#d4a030;">Ж</div>
                <div class="map-reviewer-info">
                  <span class="map-reviewer-name">Жанель</span>
                  <span class="map-reviewer-date"><time datetime="2026-02-02">2 февраля 2026</time></span>
                  <span class="map-reviewer-stars">★★★★★</span>
                </div>
              </div>
              <p class="map-reviewer-text map-text-clamp">Огромное спасибо, Виктория! За оперативность, внимательный подход, рекомендации по вкусам и работу! Торт получился отличным, именинница довольна. Обязательно закажу снова!</p>
              <a href="https://yandex.ru/maps/org/milovi_cake_torty_na_zakaz/89655951103/reviews/" target="_blank" rel="noopener noreferrer" class="map-review-source">Читать на Яндекс Картах →</a>
            </div>"""
}

GOOGLE_REVIEWS = {
    'G1': """            <div class="map-review-item">
              <div class="map-reviewer-row">
                <div class="map-reviewer-avatar" style="background:#8B4513;color:#fff;">Т</div>
                <div class="map-reviewer-info">
                  <span class="map-reviewer-name">Татьяна</span>
                  <span class="map-reviewer-date"><time datetime="2024-05-01">год назад</time></span>
                  <span class="map-reviewer-stars">★★★★★</span>
                </div>
              </div>
              <p class="map-reviewer-text map-text-clamp">Изумительно! Заказала дочери — поражена! Огромное спасибо Виктории! Всё на высшем уровне: заказ, фото, доставка. Торт, упаковка, открытки — всё с душой! Буду обращаться ещё.</p>
              <a href="https://maps.app.goo.gl/R3mdjxpnebUYMQES6" target="_blank" rel="noopener noreferrer" class="map-review-source">Читать в Google Maps →</a>
            </div>""",
    'G2': """            <div class="map-review-item">
              <div class="map-reviewer-row">
                <div class="map-reviewer-avatar" style="background:#4285F4;">Л</div>
                <div class="map-reviewer-info">
                  <span class="map-reviewer-name">Liras Магазин</span>
                  <span class="map-reviewer-date"><time datetime="2023-05-01">2 года назад</time></span>
                  <span class="map-reviewer-stars">★★★★★</span>
                </div>
              </div>
              <p class="map-reviewer-text map-text-clamp">Спасибо огромное! 🤗 Все остались в восторге, было очень вкусно. Зефирное покрытие просто прекрасное, гораздо лучше мастики! 🌷</p>
              <a href="https://maps.app.goo.gl/R3mdjxpnebUYMQES6" target="_blank" rel="noopener noreferrer" class="map-review-source">Читать в Google Maps →</a>
            </div>""",
    'G3': """            <div class="map-review-item">
              <div class="map-reviewer-row">
                <div class="map-reviewer-avatar" style="background:#34A853;">И</div>
                <div class="map-reviewer-info">
                  <span class="map-reviewer-name">Ирина Силантьева</span>
                  <span class="map-reviewer-date"><time datetime="2024-05-01">год назад</time></span>
                  <span class="map-reviewer-stars">★★★★★</span>
                </div>
              </div>
              <p class="map-reviewer-text map-text-clamp">Спасибо за прекрасную работу к 40-летию свадьбы! Всё на высшем уровне — вкусовые качества, дизайн тортика, внешнее оформление коробочки. И мы, и гости были в восторге.</p>
              <a href="https://maps.app.goo.gl/R3mdjxpnebUYMQES6" target="_blank" rel="noopener noreferrer" class="map-review-source">Читать в Google Maps →</a>
            </div>""",
    'G4': """            <div class="map-review-item">
              <div class="map-reviewer-row">
                <div class="map-reviewer-avatar" style="background:#EA4335;">Е</div>
                <div class="map-reviewer-info">
                  <span class="map-reviewer-name">Елена Кузнецова</span>
                  <span class="map-reviewer-date"><time datetime="2023-05-01">2 года назад</time></span>
                  <span class="map-reviewer-stars">★★★★★</span>
                </div>
              </div>
              <p class="map-reviewer-text map-text-clamp">Спасибо за классный тортик! Всё от заказа до доставки на 5+! Как хорошо, что из другого города попались именно Вы. Красиво, вкусно 💛 Обязательно обратимся ещё!</p>
              <a href="https://maps.app.goo.gl/R3mdjxpnebUYMQES6" target="_blank" rel="noopener noreferrer" class="map-review-source">Читать в Google Maps →</a>
            </div>"""
}

REVIEW_SETS = {
    'A': {'y': ['R1', 'R3'], 'g': ['G1', 'G3']},
    'B': {'y': ['R2', 'R4'], 'g': ['G2', 'G4']},
    'C': {'y': ['R1', 'R4'], 'g': ['G2', 'G3']},
}


def build_nearby_html(slug):
    cards = []
    for nb in NEARBY.get(slug, []):
        info = CITY_INFO.get(nb, {})
        cards.append(
            f'      <a href="/prigorody/{nb}/" class="nearby-city-card">\n'
            f'        <span class="nearby-city-card__name">{info.get("name","")}</span>\n'
            f'        <span class="nearby-city-card__info">{info.get("km","")} · {info.get("price","")}</span>\n'
            f'      </a>'
        )
    return '\n'.join(cards)


def render_city(template, p):
    html = template
    slug = p['slug']

    # Geo-tags
    first_tags_html = '\n'.join(
        f'      <span class="geo-tag">{t}</span>'
        for t in p['first_geo_tags'].split('|') if t
    )
    seo_tags_html = '\n'.join(
        f'      <span class="geo-tag">{t}</span>'
        for t in p['seo_geo_tags'].split('|') if t
    )
    html = html.replace('{{first_geo_tags}}', first_tags_html)
    html = html.replace('{{seo_geo_tags}}', seo_tags_html)

    # Canonical
    html = html.replace('{{canonical_url}}', f'https://milovicake.ru/prigorody/{slug}/')

    # LD+JSON
    html = html.replace('{{ld_breadcrumb_name}}', f'"name": "Торты в {p["breadcrumb_name"]}"'  )
    html = html.replace('{{ld_description}}',
        f'"description": "Авторские торты, меренговые рулеты и десерты на заказ '
        f'с доставкой в {p["ld_city"]} от частного кондитера.",'
    )
    html = html.replace('{{ld_area_name}}', f'"name": "{p["ld_area"]}"'  )

    # Delivery note block
    note = p.get('delivery_note', '').strip()
    note_block = f'<p class="delivery-card__note">💡 {note}</p>' if note else ''
    html = html.replace('{{delivery_note_block}}', note_block)

    # Nearby cities
    html = html.replace('{{nearby_cities_html}}', build_nearby_html(slug))

    # Delivery city = accusative = ld_city
    html = html.replace('{{delivery_city}}', p['ld_city'])

    # Slug + city in accusative for meringue-promo and ?city= queries
    html = html.replace('{{slug}}', slug)
    html = html.replace('{{city_acc_label}}', p.get('ld_city', p['breadcrumb_name']))

    # Simple replacements
    simple = {
        '{{title}}':         p['title'],
        '{{meta_desc}}':     p['meta_desc'],
        '{{og_title}}':      p['og_title'],
        '{{og_desc}}':       p['og_desc'],
        '{{nav_span_text}}': f'Торты в {p["nav_span"]}',
        '{{nav_span}}':      f'<span>Торты в {p["nav_span"]}</span>',
        '{{geo_label}}':     p['geo_label'],
        '{{h1}}':            f'Торты на заказ в {p["h1_city"]}',
        '{{hero_p}}':        p['hero_p'],
        '{{hero_span}}':     p['hero_span'],
        '{{catalog_h2}}':    'Торты и Десерты с Доставкой ' +
                              ('во ' if p['catalog_h2'].startswith('В') else 'в ') +
                              p['catalog_h2'],
        '{{section_sub}}':   p['section_sub'],
        '{{main_seo_h2_full}}': ('Доставка тортов во ' if p['main_seo_h2'].startswith(('В','в','А','а')) else 'Доставка тортов в ') + p['main_seo_h2'],
        '{{main_seo_p}}':    p['main_seo_p'],
        '{{seo_h2}}':        p['seo_h2'],
        '{{seo_p1}}':        p['seo_p1'],
        '{{seo_p2}}':        p['seo_p2'],
        '{{seo_p3}}':        p['seo_p3'],
        '{{meta_keywords}}': ', '.join(t for t in p['seo_geo_tags'].split('|') if t),
        # New fields
        '{{delivery_price}}':      p.get('delivery_price', ''),
        '{{delivery_km}}':         p.get('delivery_km', ''),
        '{{delivery_time}}':       p.get('delivery_time', ''),
        '{{delivery_days}}':       p.get('delivery_days', ''),
        '{{districts}}':           p.get('districts', ''),
        '{{local_landmark}}':      p.get('local_landmark', ''),
        '{{local_flavor_text}}':   p.get('local_flavor_text', ''),
        '{{faq_q1}}':              p.get('faq_q1', ''),
        '{{faq_a1}}':              p.get('faq_a1', ''),
        '{{faq_q2}}':              p.get('faq_q2', ''),
        '{{faq_a2}}':              p.get('faq_a2', ''),
        '{{faq_q3}}':              p.get('faq_q3', ''),
        '{{faq_a3}}':              p.get('faq_a3', ''),
    }
    for ph, val in simple.items():
        if val:
            html = html.replace(ph, val)

    # Reviews rotation
    rs = REVIEW_SETS.get(p.get('review_set', 'A'), REVIEW_SETS['A'])
    html = html.replace('{{yandex_reviews}}', '\n'.join(YANDEX_REVIEWS[k] for k in rs['y']))
    html = html.replace('{{google_reviews}}', '\n'.join(GOOGLE_REVIEWS[k] for k in rs['g']))
    return html


def main():
    with open(TEMPLATE_PATH, encoding='utf-8') as f:
        template = f.read()
    with open(CSV_PATH, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    ok = errors = 0
    for p in rows:
        slug = p['slug']
        html = render_city(template, p)
        leftovers = [ln.strip() for ln in html.split('\n') if '{{'  in ln]
        if leftovers:
            print(f'✗ {slug}: незаполненные плейсхолдеры:')
            for l in leftovers[:5]:
                print(f'    {l[:120]}')
            errors += 1
            continue
        out_dir = os.path.join(BASE_DIR, slug)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'✓ {slug}')
        ok += 1

    print(f'\nГотово: {ok} файлов, {errors} ошибок.')


if __name__ == '__main__':
    main()
