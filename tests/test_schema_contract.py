import csv
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = re.compile(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.I | re.S)


def nodes(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from nodes(child)


def page_nodes(relative):
    html = (ROOT / relative).read_text(encoding='utf-8')
    return [node for block in SCRIPT.findall(html) for node in nodes(json.loads(block))]


def product(relative, name):
    matches = [node for node in page_nodes(relative) if node.get('@type') == 'Product' and node.get('name') == name]
    if len(matches) != 1:
        raise AssertionError(f'{relative}: expected one product {name!r}, got {len(matches)}')
    return matches[0]


class SchemaContentContractTest(unittest.TestCase):
    def test_variable_and_minimum_quantity_products_have_no_fixed_total_offer(self):
        # Per-kilogram rates and per-piece rates with minimum quantities are not
        # the total purchase price of a single fixed offer.
        variable = {
            'index.html': ['Бисквитный торт на заказ', '3D Торт', 'Пирожное Павлова', 'Капкейки на заказ'],
            'detskie-torty/index.html': ['Детский бисквитный торт', 'Детский 3D-торт'],
            'tort-na-den-rozhdeniya/index.html': ['Торт на день рождения', 'Детский 3D-торт'],
            'tort-s-dostavkoy/index.html': ['Бисквитный торт с доставкой'],
            'zakazat-tort-spb/index.html': ['Бисквитный торт', '3D-торт'],
            'svadebnye-torty/index.html': ['Камерный свадебный торт', 'Многоярусный торт', 'Десерты к свадьбе'],
        }
        for relative, names in variable.items():
            for name in names:
                with self.subTest(page=relative, product=name):
                    self.assertNotIn('offers', product(relative, name))

    def test_supported_single_item_prices_remain_without_stock_claim(self):
        for relative, name, price in [
            ('index.html', 'Бенто-торт', '1600'),
            ('index.html', 'Меренговый рулет', '2500'),
            ('meringue-roll/index.html', 'Меренговый рулет', '2500'),
        ]:
            with self.subTest(page=relative, product=name):
                offer = product(relative, name)['offers']
                self.assertEqual(str(offer['price']), price)
                self.assertEqual(offer['priceCurrency'], 'RUB')
                self.assertNotIn('availability', offer)

    def test_no_in_stock_or_unconfirmed_price_expiry_in_product_offers(self):
        for relative in (
            'index.html', 'bento-torty/index.html', 'detskie-torty/index.html',
            'meringue-roll/index.html', 'svadebnye-torty/index.html',
            'tort-na-den-rozhdeniya/index.html', 'tort-s-dostavkoy/index.html',
            'zakazat-tort-spb/index.html',
        ):
            for node in page_nodes(relative):
                if node.get('@type') == 'Product':
                    offer = node.get('offers') or {}
                    with self.subTest(page=relative, product=node.get('name')):
                        self.assertNotEqual(offer.get('availability'), 'https://schema.org/InStock')
                        self.assertNotIn('priceValidUntil', offer)

    def test_unverified_google_review_dates_are_not_fabricated_or_left_relative(self):
        with (ROOT / 'prigorody/_cities.csv').open(encoding='utf-8', newline='') as source:
            slugs = [row['slug'] for row in csv.DictReader(source)]
        for relative in ['index.html', 'prigorody/_template.html',
                         *(f'prigorody/{slug}/index.html' for slug in slugs)]:
            html = (ROOT / relative).read_text(encoding='utf-8')
            google = html.split('id="reviewsGoogle"', 1)[1].split('class="reviews-modal-footer"', 1)[0]
            with self.subTest(page=relative):
                self.assertEqual(google.count('class="modal-review"'), 4)
                self.assertNotIn('modal-review-date', google)
                self.assertNotIn('<time', google)
                self.assertNotRegex(google, r'\b(?:год|года|лет|месяц(?:а|ев)?|дн(?:я|ей))\s+назад\b')
        generator = (ROOT / 'prigorody/build.py').read_text(encoding='utf-8')
        google_cards = generator.split('GOOGLE_REVIEWS = {', 1)[1].split('REVIEW_SETS = {', 1)[0]
        self.assertNotIn('map-reviewer-date', google_cards)
        self.assertNotIn('<time', google_cards)
        self.assertNotIn('назад', google_cards)

    def test_business_does_not_aggregate_external_or_nonvisible_reviews(self):
        for relative in ('index.html', 'otzyvy/index.html'):
            businesses = [node for node in page_nodes(relative)
                          if node.get('@id') == 'https://milovicake.ru/#business' and len(node) > 1]
            self.assertEqual(len(businesses), 1)
            self.assertNotIn('aggregateRating', businesses[0])
            self.assertNotIn('review', businesses[0])
            self.assertIn('отзыв', (ROOT / relative).read_text(encoding='utf-8').lower())

    def test_home_does_not_publish_invisible_howto_or_fake_search_and_breadcrumbs(self):
        all_nodes = page_nodes('index.html')
        for forbidden in ('HowTo', 'SearchAction', 'BreadcrumbList'):
            with self.subTest(node_type=forbidden):
                self.assertFalse(any(node.get('@type') == forbidden for node in all_nodes))

    def test_home_uses_one_business_identity_without_an_invented_parent(self):
        all_nodes = page_nodes('index.html')
        business_id = 'https://milovicake.ru/#business'
        business = [node for node in all_nodes if node.get('@id') == business_id and len(node) > 1]
        self.assertEqual(len(business), 1)
        self.assertNotIn('parentOrganization', business[0])
        self.assertNotIn('foundingDate', business[0])
        self.assertFalse(any(node.get('@id') == 'https://milovicake.ru/#organization'
                             for node in all_nodes))
        owner = next(node for node in all_nodes
                     if node.get('@id') == 'https://milovicake.ru/#viktoria' and len(node) > 1)
        website = next(node for node in all_nodes if node.get('@type') == 'WebSite')
        self.assertEqual(owner['worksFor']['@id'], business_id)
        self.assertEqual(website['publisher']['@id'], business_id)
        # The business address is public; do not infer the owner's home address.
        self.assertNotIn('streetAddress', owner.get('address', {}))
        self.assertNotIn('postalCode', owner.get('address', {}))
        privacy = page_nodes('privacy/index.html')
        privacy_page = next(node for node in privacy if node.get('@type') == 'WebPage')
        self.assertEqual(privacy_page['about']['@id'], business_id)

    def test_training_certificates_are_not_claimed_as_formal_accreditation(self):
        relative = 'certificates/index.html'
        text = (ROOT / relative).read_text(encoding='utf-8')
        credentials = [node for node in page_nodes(relative)
                       if node.get('@type') == 'EducationalOccupationalCredential']
        self.assertEqual(len(credentials), 5)
        for credential in credentials:
            self.assertEqual(credential['credentialCategory'], 'Certificate')
            self.assertNotIn('recognizedBy', credential)
        self.assertIn('Сертификаты о прохождении курсов', text)
        for claim in ('Подтверждённая квалификация', 'диплом кондитера',
                      'собственная исследовательская работа'):
            with self.subTest(claim=claim):
                self.assertNotIn(claim, text)
        self.assertIn('её материалы не являются меню кондитерской на заказ', text)

    def test_brand_or_school_pages_are_not_treated_as_owner_identity(self):
        for relative in ('o-konditere/index.html', 'certificates/index.html'):
            people = [node for node in page_nodes(relative)
                      if node.get('@id') == 'https://milovicake.ru/#viktoria' and len(node) > 1]
            self.assertEqual(len(people), 1)
            same_as = people[0].get('sameAs', [])
            self.assertFalse(any('french.milovicake.ru' in value or '/milovi_cake' in value
                                 or '/MiloviCake' in value for value in same_as))

    def test_fourteen_suburbs_have_distinct_dessert_links_and_consistent_business_identity(self):
        with (ROOT / 'prigorody/_cities.csv').open(encoding='utf-8', newline='') as source:
            rows = list(csv.DictReader(source))
        self.assertEqual(len(rows), 14)
        for row in rows:
            slug = row['slug']
            relative = f'prigorody/{slug}/index.html'
            html = (ROOT / relative).read_text(encoding='utf-8')
            with self.subTest(city=slug):
                promo = re.search(r'<section class="meringue-promo".*?</section>', html, re.S).group()
                self.assertIn(f'href="/meringue-roll/?city={slug}" class="meringue-promo__link">меренговый рулет</a>', promo)
                self.assertIn('href="#catalog" class="meringue-promo__link">пирожное Павлова</a>', promo)
                self.assertIn('<section id="catalog"', html)
                for tail in ('цена, состав, доставка по Санкт-Петербургу',
                             'частный кондитер Milovi Cake в Санкт-Петербурге</span>',
                             'заказать торт в Санкт-Петербурге, доставка по СПб</span>'):
                    self.assertNotIn(tail, html)
                all_nodes = page_nodes(relative)
                business = next(node for node in all_nodes if node.get('@type') == 'LocalBusiness')
                self.assertEqual(business['@id'], 'https://milovicake.ru/#business')
                self.assertEqual(business['url'], 'https://milovicake.ru/')
                self.assertEqual(business['areaServed'], {
                    '@type': 'Place' if slug == 'shushary' else 'City', 'name': row['ld_area']})
                for kind in ('WebPage', 'ItemList'):
                    page = next(node for node in all_nodes if node.get('@type') == kind)
                    self.assertEqual(page['url'], f'https://milovicake.ru/prigorody/{slug}/')

    def test_suburb_hub_covers_fourteen_directions_without_geography_or_faq_drift(self):
        relative = 'prigorody/index.html'
        html = (ROOT / relative).read_text(encoding='utf-8')
        self.assertNotIn('14 городов Ленинградской области', html)
        self.assertIn('14 направлениям Санкт-Петербурга и Ленинградской области', html)
        answers = [node['acceptedAnswer']['text'] for node in page_nodes(relative)
                   if node.get('name') == 'В какие пригороды Санкт-Петербурга вы доставляете торты?']
        self.assertEqual(len(answers), 1)
        for city in ('Пушкин', 'Петергоф', 'Гатчину', 'Всеволожск', 'Мурино', 'Кудрово',
                     'Колпино', 'Красное Село', 'Сестрорецк', 'Ломоносов', 'Кронштадт',
                     'Павловск', 'Тосно', 'Шушары'):
            self.assertIn(city, answers[0])
        self.assertIn('Другие адреса в Санкт-Петербурге и Ленинградской области согласуем', answers[0])
        self.assertIn(answers[0], html)
        self.assertNotIn('свадебные многоярусные торты', (ROOT / 'gallery/index.html').read_text(encoding='utf-8'))

    def test_suburb_copy_and_image_sitemap_do_not_assert_unverified_gluten_status(self):
        with (ROOT / 'prigorody/_cities.csv').open(encoding='utf-8', newline='') as source:
            rows = list(csv.DictReader(source))
        self.assertEqual(len(rows), 14)
        for row in rows:
            with self.subTest(city=row['slug']):
                self.assertNotIn('безглютен', row['seo_p3'].lower())
                self.assertNotIn('без готовых смесей', row['seo_p1'].lower())
        self.assertNotIn('безглютен', (ROOT / 'sitemap.xml').read_text(encoding='utf-8').lower())

    def test_meringue_delivery_faq_does_not_promise_everywhere_in_the_region(self):
        relative = 'meringue-roll/index.html'
        html = (ROOT / relative).read_text(encoding='utf-8')
        questions = [node for node in page_nodes(relative)
                     if node.get('@type') == 'Question'
                     and node.get('name') == 'Как заказать меренговый рулет с доставкой по СПб?']
        self.assertEqual(len(questions), 1)
        answer = questions[0]['acceptedAnswer']['text']
        self.assertIn('возможность доставки по Санкт-Петербургу и пригородам согласуем при заказе', answer)
        self.assertIn('Стоимость зависит от адреса.', answer)
        for unsupported in ('по всему Санкт-Петербургу и Ленинградской области', 'в любую точку', 'весь город'):
            self.assertNotIn(unsupported, html)
        self.assertIn('по согласованию', html)
        self.assertIn('aria-label="Меренговый рулет с доставкой в Гатчину"', html)
        self.assertIn('aria-label="Меренговый рулет с доставкой во Всеволожск"', html)

    def test_meringue_storage_terms_are_consistent_and_order_timing_is_not_promised(self):
        relative = 'meringue-roll/index.html'
        html = (ROOT / relative).read_text(encoding='utf-8')
        questions = [node for node in page_nodes(relative)
                     if node.get('@type') == 'Question'
                     and node.get('name') == 'Сколько хранится меренговый рулет?']
        self.assertEqual(len(questions), 1)
        answer = ('Храните рулет в холодильнике при температуре +2…+6 °C не более 48 часов '
                  'с момента изготовления.')
        self.assertEqual(questions[0]['acceptedAnswer']['text'], answer)
        self.assertIn(f'<p>{answer}</p>', html)
        self.assertIn('48 ч · +2…+6 °C', html)
        facts = (ROOT / 'llms.txt').read_text(encoding='utf-8')
        self.assertIn('при +2…+6 °C не более 48 часов с момента изготовления', facts)
        for unconfirmed in ('1–2 дня', 'Готовим в день доставки'):
            with self.subTest(claim=unconfirmed):
                self.assertNotIn(unconfirmed, html)

    def test_lomonosov_delivery_is_qualified_in_source_and_generated_faq(self):
        for relative in ('prigorody/_cities.csv', 'prigorody/lomonosov/index.html'):
            with self.subTest(path=relative):
                text = (ROOT / relative).read_text(encoding='utf-8')
                self.assertIn('Возможность и стоимость доставки уточним по адресу.', text)
                self.assertNotIn('доставляем в весь город', text)

    def test_delivery_claims_do_not_invent_city_rate_photos_or_packaging(self):
        for relative in ('dostavka-i-oplata/index.html', 'tort-s-dostavkoy/index.html'):
            html = (ROOT / relative).read_text(encoding='utf-8')
            for unsupported in ('от 500 ₽', '5–7 минут', 'пришлём фото готового торта перед отправкой',
                                'контролем температуры', 'жёсткой усиленной подложке'):
                with self.subTest(page=relative, claim=unsupported):
                    self.assertNotIn(unsupported, html)
            self.assertIn('стоимость', html.lower())
        delivery = (ROOT / 'tort-s-dostavkoy/index.html').read_text(encoding='utf-8')
        self.assertIn('Упаковку подбираем к формату десерта.', delivery)
        self.assertIn('возможность доставки', delivery.lower())
        birthday = (ROOT / 'tort-na-den-rozhdeniya/index.html').read_text(encoding='utf-8')
        self.assertNotIn('со свечкой и ложечкой', birthday)

    def test_suburb_hub_qualifies_urgent_timing_and_packaging(self):
        html = (ROOT / 'prigorody/index.html').read_text(encoding='utf-8')
        self.assertNotIn('Принимаем заказы за 1–2 дня', html)
        self.assertNotIn('Каждый десерт упакован в фирменную коробку', html)
        self.assertIn('Срок изготовления и возможность срочного заказа уточняйте при обращении.', html)
        self.assertIn('Упаковку и возможность доставки согласуем при заказе.', html)

    def test_bento_weight_copy_matches_catalog_approximation(self):
        for relative in ('zakazat-tort-spb/index.html', 'bento-torty/index.html',
                         'o-konditere/index.html', 'dostavka-i-oplata/index.html',
                         'tort-na-den-rozhdeniya/index.html'):
            with self.subTest(page=relative):
                text = (ROOT / relative).read_text(encoding='utf-8')
                self.assertNotIn('~400 г', text)
                self.assertNotIn('~1 кг', text)
        catalog = (ROOT / 'js/main.js').read_text(encoding='utf-8')
        self.assertIn('data-tip="~350 гр"', catalog)
        self.assertIn('data-tip="~1100 гр"', catalog)


if __name__ == '__main__':
    unittest.main()
