"""Кнопки мессенджеров должны вести в мессенджер, а не в саму страницу.

Зачем отдельный контракт
------------------------
В `prigorody/_template.html` кнопки калькулятора «Отправить в WhatsApp /
Telegram» годами жили с `href="#"`: работа строилась на `onclick`, а сам
адрес был заглушкой. На главной в тот же момент стояли настоящие адреса.
Пока JS включён и не падает, разница не видна. Как только `buildWA` не
отработал (ошибка скрипта, отключённый JS, блокировщик), клик открывал в
новой вкладке пустую копию страницы — заказ терялся без единой ошибки в
консоли. Ctrl/средний клик давал то же самое, а краулеры и превью ссылок
не видели адреса мессенджера вовсе.

Тест дешёвый и без сети: читает разметку и сверяет её с адресами, которые
открывает `js/main.js`. Так `href`-фолбэк не сможет снова разойтись с
фактическим поведением.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Адреса, которые открывает JS. Это источник истины для href-фолбэка.
def script_targets() -> dict[str, str]:
    main_js = (ROOT / "js" / "main.js").read_text(encoding="utf-8")
    wa = re.search(r"waUrl\s*=\s*'(https://wa\.me/[^'?]+)", main_js)
    tg = re.search(r"window\.open\('(https://t\.me/[^']+)'", main_js)
    if not wa or not tg:
        raise AssertionError("js/main.js: не найдены адреса WhatsApp/Telegram для buildWA/buildTG")
    return {"btnWA": wa.group(1), "btnTG": tg.group(1)}


def html_pages() -> list[Path]:
    return sorted(p for p in ROOT.rglob("*.html") if "node_modules" not in p.parts)


def anchors(page: Path) -> list[str]:
    return re.findall(r"<a\b[^>]*>", page.read_text(encoding="utf-8"))


def attr(tag: str, name: str) -> str | None:
    match = re.search(rf'\s{name}="([^"]*)"', tag)
    return match.group(1) if match else None


class MessengerCtaContractTest(unittest.TestCase):
    def test_no_page_uses_hash_placeholder_links(self):
        offenders = [str(p.relative_to(ROOT)) for p in html_pages() if 'href="#"' in p.read_text(encoding="utf-8")]
        self.assertEqual(offenders, [], f"href=\"#\" снова появился в: {offenders}")

    def test_cart_ctas_have_real_hrefs_matching_js(self):
        targets = script_targets()
        for page in html_pages():
            for tag in anchors(page):
                anchor_id = attr(tag, "id")
                if anchor_id not in targets:
                    continue
                href = attr(tag, "href") or ""
                with self.subTest(page=str(page.relative_to(ROOT)), anchor=anchor_id):
                    self.assertEqual(href, targets[anchor_id],
                                     f"{page.relative_to(ROOT)}: {anchor_id} ведёт в {href!r}, "
                                     f"а JS открывает {targets[anchor_id]!r}")
                    self.assertEqual(attr(tag, "target"), "_blank")
                    self.assertIn("noopener", (attr(tag, "rel") or ""),
                                  f"{page.relative_to(ROOT)}: {anchor_id} без rel=noopener")

    def test_homepage_and_suburbs_send_the_same_order(self):
        targets = script_targets()
        home = {attr(t, "id"): attr(t, "href") for t in anchors(ROOT / "index.html")
                if attr(t, "id") in targets}
        self.assertEqual(home, targets, "главная: href кнопок заказа разошёлся с js/main.js")
        suburbs = sorted((ROOT / "prigorody").glob("*/index.html"))
        self.assertGreaterEqual(len(suburbs), 14, "пригороды не собраны: ожидалось 14 страниц")
        for page in suburbs:
            found = {attr(t, "id"): attr(t, "href") for t in anchors(page) if attr(t, "id") in targets}
            with self.subTest(page=str(page.relative_to(ROOT))):
                self.assertEqual(found, home,
                                 f"{page.relative_to(ROOT)}: кнопки заказа расходятся с главной")


if __name__ == "__main__":
    unittest.main()
