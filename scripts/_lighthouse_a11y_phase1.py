from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match for {old!r}, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# Lighthouse: use one explicit mobile profile; do not combine desktop preset with mobile formFactor.
replace_once(
    ".github/lighthouse-config.json",
    '        "preset": "desktop",\n',
    "",
)

# Privacy: local accessible light-theme colors; do not alter global brand tokens.
replace_once(
    "privacy/index.html",
    ".privacy-page p,.privacy-page li{font-size:17px;line-height:1.72}.privacy-page ul{padding-left:22px}.privacy-page a{color:var(--gold,#9c6427)}",
    ".privacy-page p,.privacy-page li{font-size:17px;line-height:1.72}.privacy-page ul{padding-left:22px}.privacy-page a{color:#8a5723}",
)
replace_once(
    "privacy/index.html",
    ".privacy-page__lead{font-size:20px;max-width:760px;color:var(--text-muted,#725f50)}.privacy-page__back{display:inline-flex;margin-bottom:34px;text-decoration:none}",
    ".privacy-page__lead{font-size:20px;max-width:760px;color:#725f50}.privacy-page__back{display:inline-flex;margin-bottom:34px;text-decoration:none}",
)
replace_once(
    "privacy/index.html",
    '    html[data-theme="dark"] .privacy-page{color:#f0e4d0}html[data-theme="dark"] .privacy-page__lead{color:#c8a880}\n',
    '    html[data-theme="dark"] .privacy-page{color:#f0e4d0}html[data-theme="dark"] .privacy-page__lead{color:#c8a880}html[data-theme="dark"] .privacy-page a{color:#e8b87a}\n',
)

# Canonical suburb source: accessible names must include the visible button text.
replace_once(
    "prigorody/_template.html",
    'aria-label="Отзывы на Яндекс Картах"',
    'aria-label="Яндекс Карты ★ 4.8"',
)
replace_once(
    "prigorody/_template.html",
    'aria-label="Отзывы в Google Maps"',
    'aria-label="Google Maps ★ 4.7"',
)

# Local light-theme contrast fixes for exact elements reported by Lighthouse.
marker = '  <link rel="stylesheet" href="/css/final-fixes.css?v=20260815r78" />\n'
style = '''  <link rel="stylesheet" href="/css/final-fixes.css?v=20260815r78" />
  <style id="suburb-a11y-contrast">
    :root:not([data-theme="dark"]) .prigorody-page .calc-opt.selected{color:#2c1a10}
    :root:not([data-theme="dark"]) .prigorody-page .calc-stepper-val{color:#8a5723}
    :root:not([data-theme="dark"]) .prigorody-page .nearby-city-card__info{color:#725f50}
  </style>
'''
replace_once("prigorody/_template.html", marker, style)

# Fail closed on the intended durable state.
config = Path(".github/lighthouse-config.json").read_text(encoding="utf-8")
assert '"preset": "desktop"' not in config
assert '"formFactor": "mobile"' in config
privacy = Path("privacy/index.html").read_text(encoding="utf-8")
assert "color:#8a5723" in privacy and "color:#725f50" in privacy
template = Path("prigorody/_template.html").read_text(encoding="utf-8")
for needle in (
    'aria-label="Яндекс Карты ★ 4.8"',
    'aria-label="Google Maps ★ 4.7"',
    'id="suburb-a11y-contrast"',
):
    assert needle in template

print("Lighthouse/a11y phase1 deterministic migration applied")
