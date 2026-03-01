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
        '{{catalog_h2}}':  f'Торты и Десерты с Доставкой в {p["catalog_h2"]}',
        '{{section_sub}}': p['section_sub'],
        '{{main_seo_h2}}': p['main_seo_h2'],
        '{{main_seo_p}}':  p['main_seo_p'],
        '{{seo_h2}}':      p['seo_h2'],
        '{{seo_p1}}':      p['seo_p1'],
        '{{seo_p2}}':      p['seo_p2'],
        '{{seo_p3}}':      p['seo_p3'],
    }
    for placeholder, value in simple.items():
        if value:
            html = html.replace(placeholder, value)

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
