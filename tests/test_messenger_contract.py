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

# Адреса, которые открывает JS. Ограничиваем поиск телом соответствующего
# обработчика, чтобы сторонняя ссылка на тот же мессенджер не скрыла ошибку.
def script_targets(main_js: str | None = None) -> dict[str, str]:
    if main_js is None:
        main_js = (ROOT / "js" / "main.js").read_text(encoding="utf-8")

    def handler(name: str) -> str:
        match = re.search(rf"^function {name}\(e\) \{{\n(.*?)^\}}", main_js, re.M | re.S)
        if not match:
            raise AssertionError(f"js/main.js: отсутствует {name}")
        return match.group(1)

    wa_body, tg_body = handler("buildWA"), handler("buildTG")
    wa = re.search(r"const chat\s*=\s*'(https://wa\.me/\d+)';", wa_body)
    tg = re.search(r"const url\s*=\s*'(https://t\.me/[A-Za-z0-9_]+)';", tg_body)
    if not wa or not tg:
        raise AssertionError("js/main.js: не найдены адреса WhatsApp/Telegram для buildWA/buildTG")
    if "fitCartWhatsAppUrl(chat, msg)" not in wa_body or "openCartMessenger(fit.url, 'whatsapp')" not in wa_body:
        raise AssertionError("buildWA не передаёт адрес в фактический обработчик открытия")
    if "openCartMessenger(url, 'telegram')" not in tg_body:
        raise AssertionError("buildTG не передаёт адрес в фактический обработчик открытия")
    return {"btnWA": wa.group(1), "btnTG": tg.group(1)}

def html_pages() -> list[Path]:
    return sorted(p for p in ROOT.rglob("*.html") if "node_modules" not in p.parts)


def anchors(page: Path) -> list[str]:
    return re.findall(r"<a\b[^>]*>", page.read_text(encoding="utf-8"))


def attr(tag: str, name: str) -> str | None:
    match = re.search(rf'\s{name}="([^"]*)"', tag)
    return match.group(1) if match else None


class MessengerCtaContractTest(unittest.TestCase):
    def test_script_target_parser_rejects_unrelated_or_disconnected_addresses(self):
        main_js = (ROOT / "js" / "main.js").read_text(encoding="utf-8")
        targets = script_targets(main_js)
        self.assertEqual(targets["btnTG"], "https://t.me/milovi_cake")
        with self.assertRaises(AssertionError):
            script_targets(main_js.replace("openCartMessenger(url, 'telegram')",
                                           "openCartMessenger(other, 'telegram')"))
        with self.assertRaises(AssertionError):
            script_targets(main_js.replace("fitCartWhatsAppUrl(chat, msg)",
                                           "fitCartWhatsAppUrl(other, msg)"))

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

    def test_telegram_uses_channel_for_presence_and_chat_for_contact(self):
        """У Telegram на сайте две роли, и они не должны меняться местами.

        * **Написать** (кнопки «Отправить в Telegram», hero, бар заказа, меню,
          контакты в подвале, CTA) — личный аккаунт `t.me/milovi_cake`: только
          туда можно вставить скопированный текст заказа. До r47 кнопка заказа
          вела в канал, где писать некуда — заказ терялся.
        * **Присутствие** (блок «Мы в соцсетях», иконки соцсетей в подвале,
          `sameAs` в JSON-LD) — канал `t.me/MiloviCake`, он для подписки.

        Третьих адресов (`t.me/+79119038886` и подобных) быть не должно.
        """
        direct = "https://t.me/milovi_cake"
        channel = "https://t.me/MiloviCake"
        presence_classes = ("social-link", "footer-social")
        problems: list[str] = []
        seen: dict[str, int] = {direct: 0, channel: 0}

        for page in html_pages():
            text = page.read_text(encoding="utf-8")
            rel = page.relative_to(ROOT)

            for found in re.findall(r"https://t\.me/[^\"'<>\s)]+", text):
                if found not in (direct, channel):
                    problems.append(f"{rel}: посторонний адрес Telegram → {found}")

            for tag, inner in re.findall(r"(<a\b[^>]*>)(.*?)</a>", text, re.S):
                href = re.search(r'href="(https://t\.me/[^"]+)"', tag)
                if not href:
                    continue
                href = href.group(1)
                seen[href] = seen.get(href, 0) + 1
                classes = re.search(r'class="([^"]*)"', tag)
                classes = classes.group(1).split() if classes else []
                is_cta = any(cls.startswith("btn") or cls.startswith("mm-msg")
                             or cls.startswith("messenger-bar") for cls in classes)
                is_presence = any(cls in presence_classes for cls in classes)
                visible_text = re.sub(r"<[^>]+>", "", inner).strip()
                # иконка соцсети без подписи (aria-label + нет текста) = присутствие
                if not is_cta and not visible_text and 'aria-label="Telegram"' in tag:
                    is_presence = True
                expected = channel if is_presence else direct
                if href != expected:
                    problems.append(
                        f"{rel}: {'соцссылка' if is_presence else 'кнопка связи'} "
                        f"ведёт на {href}, ожидается {expected}")

            for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
                if "sameAs" not in block:
                    continue
                if direct in block:
                    problems.append(f"{rel}: личный чат в sameAs — там должен быть канал")
                if channel in block:
                    seen[channel] = seen.get(channel, 0) + block.count(channel)

        self.assertEqual(problems, [], "\n".join(problems))
        self.assertGreater(seen.get(channel, 0), 0, "канал пропал из соцблоков/sameAs")
        self.assertGreater(seen.get(direct, 0), 0, "прямой чат пропал из кнопок связи")
        main_js = (ROOT / "js" / "main.js").read_text(encoding="utf-8")
        self.assertIn(f"'{direct}'", main_js, "buildTG должен открывать личный чат")
        self.assertNotIn(f"'{channel}'", main_js, "buildTG не должен открывать канал")


if __name__ == "__main__":
    unittest.main()
