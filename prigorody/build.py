#!/usr/bin/env python3
"""
Milovi Cake — Генератор страниц пригородов
==========================================
Запуск:  python3 prigorody/build.py
Результат: пересобирает все index.html в папках пригородов
           из шаблона _template.html и данных _cities.csv

Как добавить новый пригород:
  1. Добавь строку в _cities.csv с нужными данными
  2. Запусти скрипт — папка и файл создадутся автоматически
"""

import os
import csv
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(BASE_DIR, '_template.html')
CSV_PATH = os.path.join(BASE_DIR, '_cities.csv')


# ── Review rotation sets ──
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


def render_city(template: str, p: dict) -> str:
    html = template

    # Geo-tags blocks
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

    # Canonical URL
    slug = p['slug']
    html = html.replace('{{canonical_url}}', f'https://milovicake.ru/prigorody/{slug}/')

    # LD+JSON structured fields
    html = html.replace('{{ld_breadcrumb_name}}', f'"name": "Торты в {p["breadcrumb_name"]}"')
    html = html.replace(
        '{{ld_description}}',
        f'"description": "Авторские торты, меренговые рулеты и десерты на заказ '
        f'с доставкой в {p["ld_city"]} от частного кондитера."'
    )
    html = html.replace('{{ld_area_name}}', f'"name": "{p["ld_area"]}"')

    # Simple text replacements
    simple = {
        '{{title}}':       p['title'],
        '{{meta_desc}}':   p['meta_desc'],
        '{{og_title}}':    p['og_title'],
        '{{og_desc}}':     p['og_desc'],
        '{{nav_span_text}}': f'Торты в {p["nav_span"]}',
        '{{nav_span}}':    f'<span>Торты в {p["nav_span"]}</span>',
        '{{geo_label}}':   p['geo_label'],
        '{{h1}}':          f'Торты на заказ в {p["h1_city"]}',
        '{{hero_p}}':      p['hero_p'],
        '{{hero_span}}':   p['hero_span'],
        '{{catalog_h2}}':  'Торты и Десерты с Доставкой ' + 
                           ('во ' if p['catalog_h2'].startswith('В') else 'в ') +
                           p['catalog_h2'],
        '{{section_sub}}': p['section_sub'],
        '{{main_seo_h2}}': p['main_seo_h2'],
        '{{main_seo_p}}':  p['main_seo_p'],
        '{{seo_h2}}':      p['seo_h2'],
        '{{seo_p1}}':      p['seo_p1'],
        '{{seo_p2}}':      p['seo_p2'],
        '{{seo_p3}}':      p['seo_p3'],
        '{{meta_keywords}}': ', '.join(t for t in p['seo_geo_tags'].split('|') if t),
        '{{meta_keywords}}': ', '.join(t for t in p['seo_geo_tags'].split('|') if t),
    }
    for placeholder, value in simple.items():
        if value:
            html = html.replace(placeholder, value)


    # Review rotation (SEO-Б7)
    review_set = p.get('review_set', 'A')
    rs = REVIEW_SETS.get(review_set, REVIEW_SETS['A'])
    yandex_html = '\n'.join(YANDEX_REVIEWS[k] for k in rs['y'])
    google_html = '\n'.join(GOOGLE_REVIEWS[k] for k in rs['g'])
    html = html.replace('{{yandex_reviews}}', yandex_html)
    html = html.replace('{{google_reviews}}', google_html)
    return html


def main():
    with open(TEMPLATE_PATH, encoding='utf-8') as f:
        template = f.read()

    with open(CSV_PATH, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    ok = 0
    errors = 0
    for p in rows:
        slug = p['slug']
        html = render_city(template, p)

        # Check for leftover placeholders
        leftovers = [line.strip() for line in html.split('\n') if '{{' in line]
        if leftovers:
            print(f'✗ {slug}: незаполненные плейсхолдеры:')
            for l in leftovers:
                print(f'    {l[:100]}')
            errors += 1
            continue

        out_dir = os.path.join(BASE_DIR, slug)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, 'index.html')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)

        print(f'✓ {slug}')
        ok += 1

    print(f'\nГотово: {ok} файлов сгенерировано, {errors} ошибок.')


if __name__ == '__main__':
    main()
