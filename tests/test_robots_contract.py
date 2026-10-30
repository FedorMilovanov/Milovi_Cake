import re
import unittest
from pathlib import Path
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parents[1]


def read_robots():
    return (ROOT / 'robots.txt').read_text(encoding='utf-8')


def group_body(text, user_agent):
    """Возвращает строки группы User-agent: <user_agent> до следующего User-agent."""
    lines = text.splitlines()
    collected, inside = [], False
    for line in lines:
        if re.match(r'\s*User-agent:', line, re.I):
            inside = line.split(':', 1)[1].strip().lower() == user_agent.lower()
            continue
        if inside:
            collected.append(line)
    return collected


class RobotsAccessContractTest(unittest.TestCase):
    def test_public_pages_are_crawlable_and_internal_sources_are_blocked(self):
        parser = RobotFileParser()
        parser.parse((ROOT / 'robots.txt').read_text(encoding='utf-8').splitlines())
        # The configured disallows precede the broad Allow: /, which also works
        # with robotparser's first-matching-rule interpretation.
        for bot in ('Googlebot', 'bingbot', 'Yandex', 'YandexAdditional', 'OAI-SearchBot',
                    'ChatGPT-User', 'GPTBot', 'ClaudeBot', 'PerplexityBot'):
            for path in ('/', '/gallery/', '/svadebnye-torty/', '/call/'):
                with self.subTest(bot=bot, path=path):
                    self.assertTrue(parser.can_fetch(bot, path))
            for path in ('/scripts/audit.py', '/audit/report.md', '/prigorody/_template.html',
                         '/prigorody/_cities.csv', '/prigorody/build.py'):
                with self.subTest(bot=bot, path=path):
                    self.assertFalse(parser.can_fetch(bot, path))

    def test_deprecated_host_directive_is_absent(self):
        # Яндекс официально прекратил поддержку Host в марте 2018: главное
        # зеркало определяется 301-редиректом и rel=canonical. Строка ничего
        # не настраивает и создаёт ложное впечатление настроенного зеркала.
        offenders = [line.strip() for line in read_robots().splitlines()
                     if line.strip().lower().startswith('host:')]
        self.assertEqual(offenders, [], 'Host is not supported by Yandex since March 2018')

    def test_yandex_group_keeps_clean_param_and_sitemaps_stay_declared(self):
        # Убирая устаревшую строку, легко случайно задеть соседние правила
        # группы Yandex — поэтому они закреплены отдельной проверкой.
        yandex = group_body(read_robots(), 'Yandex')
        self.assertTrue(any(line.lower().startswith('clean-param:') for line in yandex),
                        'Clean-param must stay in the Yandex group')
        sitemaps = re.findall(r'^\s*Sitemap:\s*(\S+)\s*$', read_robots(), re.M)
        self.assertIn('https://milovicake.ru/sitemap.xml', sitemaps)
        self.assertIn('https://milovicake.ru/sitemap-videos.xml', sitemaps)


if __name__ == '__main__':
    unittest.main()
