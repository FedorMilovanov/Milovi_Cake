import unittest

from scripts.faq_contract import compare_faq


def faq(question='Можно ли обсудить сет?', answer='Да, состав и стоимость согласуем.'):
    return {'@type': 'FAQPage', 'mainEntity': [{
        '@type': 'Question', 'name': question,
        'acceptedAnswer': {'@type': 'Answer', 'text': answer},
    }]}


class FAQContractTest(unittest.TestCase):
    def test_matching_details_normalizes_spaces_entities_and_inline_tags(self):
        html = '''<details class="lp-faq-item"><summary>Можно ли обсудить сет?</summary>
        <p>Да, состав &nbsp;и <strong>стоимость</strong> согласуем.</p></details>'''
        self.assertEqual(compare_faq(html, [faq()]), [])

    def test_nested_details_answer_remains_part_of_faq_contract(self):
        html = '''<details class="mr-faq-item"><summary>Можно ли обсудить сет?</summary>
        <div class="mr-faq-answer"><p>Да, состав и стоимость согласуем.</p></div></details>'''
        self.assertEqual(compare_faq(html, [faq()]), [])

    def test_mismatched_answer_fails_even_when_question_matches(self):
        html = '<details class="lp-faq-item"><summary>Можно ли обсудить сет?</summary><p>Бесплатно.</p></details>'
        self.assertTrue(any('answer differs' in issue for issue in compare_faq(html, [faq()])))

    def test_question_in_unrelated_text_does_not_count(self):
        html = '<p>Можно ли обсудить сет? Да, состав и стоимость согласуем.</p>'
        self.assertTrue(any('missing from HTML FAQ' in issue for issue in compare_faq(html, [faq()])))

    def test_accordion_icon_is_not_in_question(self):
        html = '''<div class="faq-item"><button class="cb-faq-q"><span>Можно ли обсудить сет?</span>
        <span aria-hidden="true">+</span></button><div class="cb-faq-a-inner">Да, состав и стоимость согласуем.</div></div>'''
        self.assertEqual(compare_faq(html, [faq()]), [])

    def test_duplicate_question_fails(self):
        item = '<details class="lp-faq-item"><summary>Можно ли обсудить сет?</summary><p>Да, состав и стоимость согласуем.</p></details>'
        self.assertTrue(any('duplicate question' in issue for issue in compare_faq(item + item, [faq()])))

    def test_unmarked_faq_item_fails(self):
        html = '''<details class="lp-faq-item"><summary>Можно ли обсудить сет?</summary><p>Да, состав и стоимость согласуем.</p></details>
        <details class="lp-faq-item"><summary>Другой вопрос?</summary><p>Другой ответ.</p></details>'''
        self.assertTrue(any('missing from FAQPage' in issue for issue in compare_faq(html, [faq()])))

    def test_visible_faq_without_any_schema_is_reported(self):
        html = '<details class="lp-faq-item"><summary>Вопрос?</summary><p>Ответ.</p></details>'
        self.assertTrue(any('missing from FAQPage' in issue for issue in compare_faq(html, [])))

    def test_page_without_faq_or_schema_is_valid(self):
        self.assertEqual(compare_faq('<main><h1>Страница без FAQ</h1></main>', []), [])


if __name__ == '__main__':
    unittest.main()
