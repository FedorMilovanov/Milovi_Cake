"""Один и тот же «лёгкий» набор CSS в аудите и в продовом smoke.

Зачем отдельный тест: 2026-10-30 самохостинг шрифтов добавил `/css/fonts.css`
на все страницы. `audit.py` обновили, `production_smoke.py` — забыли, и
деплой на main упал уже ПОСЛЕ публикации: сборка и выкладка прошли, а
пост-деплойный гейт `Prove live release` — нет. Локально это ловилось
только сборкой + прогоном продового smoke, которого в `npm run qa` нет.

Тест дешёвый и без сети: сверяет литералы в двух скриптах.
"""

import ast
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

# Контракт: лёгкая страница не тянет ничего, кроме базовых стилей и
# шрифтов. Любое расширение — осознанное решение, а не побочный эффект.
EXPECTED = ["/css/fonts.css", "/css/style.css"]


def declared_allowlist(script: str) -> list[str]:
    text = (SCRIPTS / script).read_text("utf-8")
    match = re.search(r"^\s*LEAN_ALLOWED_CSS\s*=\s*(\[[^\]]*\])\s*$", text, re.MULTILINE)
    if not match:
        raise AssertionError(f"{script}: не объявлен LEAN_ALLOWED_CSS")
    return ast.literal_eval(match.group(1))


class LeanCssContractTest(unittest.TestCase):
    def test_audit_and_production_smoke_agree(self):
        audit = declared_allowlist("audit.py")
        smoke = declared_allowlist("production_smoke.py")
        self.assertEqual(
            audit, smoke,
            "audit.py и production_smoke.py разошлись по LEAN_ALLOWED_CSS — "
            "деплой упадёт уже после публикации, когда откатывать дорого",
        )

    def test_allowlist_is_still_lean(self):
        self.assertEqual(declared_allowlist("audit.py"), EXPECTED)
        self.assertEqual(declared_allowlist("production_smoke.py"), EXPECTED)


if __name__ == "__main__":
    unittest.main()
