import unittest
from pathlib import Path
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parents[1]


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


if __name__ == '__main__':
    unittest.main()
