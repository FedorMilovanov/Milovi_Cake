"""Контракт доставки шрифтов: что блокирует первую отрисовку, а что нет.

Зачем отдельный тест. Этот файл появился после конкретной ошибки: в
`css/fonts.css` комментарий утверждал, что в силе `font-display: optional`, а
все восемь правил под ним говорили `swap`. Я поверил комментарию, не проверив
правила, и построил на этом ложном ограничении целый вывод. Проверка ниже
делает невозможным повторение: она читает ФАКТИЧЕСКИЕ правила, а не прозу.

Второе, что здесь закреплено — форма доставки курсива Cormorant. Эти два файла
(52 860 Б) обслуживают только курсивные слова в заголовках секций и в отзывах,
то есть текст ниже первого экрана. Пока они лежали в блокирующем `fonts.css`,
браузер тянул их одновременно с hero-картинкой; измерено 2026-11-02 на профиле
из `.github/lighthouse-config.json`: FCP 2104 -> 1812 мс, LCP 3030 -> 2874 мс
(медианы по 6 прогонов вперемешку с контролем). Возврат этих блоков в
блокирующий файл — регресс, и тест его не пропустит.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOCKING = ROOT / 'css' / 'fonts.css'
DEFERRED = ROOT / 'css' / 'fonts-italic.css'
HTML_EXCLUDED = {'node_modules', '.git', 'test-results', 'playwright-report', '_site', 'audit'}

# Страница считается использующей курсив Cormorant, если в ней есть эти селекторы.
ITALIC_MARKERS = ('class="ht-em', 'review-text', 'meringue-promo__city')


def face_blocks(css: str) -> list[str]:
    return re.findall(r'@font-face\s*\{[^}]*\}', css)


def pages() -> list[Path]:
    result = []
    for path in ROOT.rglob('*.html'):
        if any(part in HTML_EXCLUDED for part in path.relative_to(ROOT).parts):
            continue
        result.append(path)
    return sorted(result)


class FontDeliveryContract(unittest.TestCase):
    def test_every_face_shares_one_font_display_value_and_it_is_swap(self) -> None:
        # Значение закреплено осознанно. swap показывает фирменный шрифт всем;
        # optional спрятал бы его от любого, у кого канал медленнее ~100 мс.
        # Отказ от optional безопасен по CLS: на текущей вёрстке сдвиг
        # 0.0000-0.0001, худший прогон 0.022 при бюджете 0.1.
        css = BLOCKING.read_text('utf-8')
        blocks = face_blocks(css)
        self.assertEqual(len(blocks), 6, 'ожидалось 6 блокирующих @font-face (без курсива Cormorant)')
        values = set()
        for block in blocks:
            found = re.search(r'font-display\s*:\s*([a-z]+)\s*;', block)
            self.assertIsNotNone(found, f'@font-face без font-display: {block[:80]}')
            values.add(found.group(1))
        self.assertEqual(
            values, {'swap'},
            'font-display в блокирующем файле разошёлся или изменился без замера: '
            f'{sorted(values)}. Если меняете — измерьте CLS на /bento-torty/ и '
            '/svadebnye-torty/ и обновите этот тест вместе с комментарием.',
        )

    def test_cormorant_italic_is_not_in_the_blocking_sheet(self) -> None:
        css = BLOCKING.read_text('utf-8')
        for name in ('cormorant-garamond-cyrillic-wght-italic', 'cormorant-garamond-latin-wght-italic'):
            self.assertNotIn(
                name, css,
                f'{name} вернулся в блокирующий css/fonts.css: он нужен только ниже '
                'первого экрана и снова будет конкурировать с hero-картинкой',
            )

    def test_deferred_sheet_declares_both_cormorant_italic_faces(self) -> None:
        self.assertTrue(DEFERRED.is_file(), 'css/fonts-italic.css отсутствует')
        css = DEFERRED.read_text('utf-8')
        blocks = face_blocks(css)
        self.assertEqual(len(blocks), 2, 'в отложенном файле должно быть ровно два начертания')
        for block in blocks:
            self.assertIn('Cormorant Garamond', block)
            self.assertRegex(block, r'font-style\s*:\s*italic')
            self.assertRegex(block, r'font-display\s*:\s*swap')

    def test_pages_with_italic_text_load_the_sheet_asynchronously(self) -> None:
        # Синхронная ссылка на fonts-italic.css вернула бы блокировку через
        # чёрный ход: файл снова попал бы в критическую цепочку.
        checked = 0
        for page in pages():
            html = page.read_text('utf-8', errors='replace')
            if not any(marker in html for marker in ITALIC_MARKERS):
                continue
            checked += 1
            refs = re.findall(r'<link[^>]*fonts-italic\.css[^>]*>', html)
            self.assertTrue(refs, f'{page.relative_to(ROOT)}: курсивный текст без подключения курсива')
            # Ссылка внутри <noscript> срабатывает только при выключенном JS —
            # это законный фолбэк, а не синхронная загрузка. Убираем такие блоки
            # и проверяем только те ссылки, которые браузер увидит сразу.
            without_noscript = re.sub(r'(?is)<noscript>.*?</noscript>', '', html)
            eager = re.findall(r'<link[^>]*fonts-italic\.css[^>]*>', without_noscript)
            for ref in eager:
                self.assertIn(
                    'media="print"', ref,
                    f'{page.relative_to(ROOT)}: синхронная ссылка на fonts-italic.css '
                    'вернёт курсив в критическую цепочку',
                )
                self.assertIn(
                    'onload', ref,
                    f'{page.relative_to(ROOT)}: media="print" без onload — курсив никогда не применится',
                )
        self.assertGreaterEqual(checked, 17, 'страницы с курсивом не найдены — проверка ничего не проверила')

    def test_deferred_sheet_is_precached_with_the_same_revision(self) -> None:
        sw = (ROOT / 'sw.js').read_text('utf-8')
        precache = re.search(r'const\s+PRECACHE\s*=\s*\[([^\]]+)\]', sw, re.S)
        self.assertIsNotNone(precache, 'PRECACHE не найден в sw.js')
        pairs = dict(re.findall(r"'(/css/fonts[^']*?)\?v=([0-9a-z]+)'", precache.group(1)))
        self.assertIn('/css/fonts-italic.css', pairs, 'отложенный файл не прекешируется — офлайн его не будет')
        self.assertEqual(
            pairs['/css/fonts-italic.css'], pairs['/css/fonts.css'],
            'ревизии css/fonts.css и css/fonts-italic.css разошлись',
        )
        # Ссылки в страницах обязаны совпадать с прекешем, иначе после
        # обновления сервис-воркер отдаст старый файл под новым именем.
        for page in pages():
            html = page.read_text('utf-8', errors='replace')
            for version in re.findall(r'fonts-italic\.css\?v=([0-9a-z]+)', html):
                self.assertEqual(
                    version, pairs['/css/fonts-italic.css'],
                    f'{page.relative_to(ROOT)}: ревизия fonts-italic.css разошлась с sw.js',
                )


if __name__ == '__main__':
    unittest.main()
