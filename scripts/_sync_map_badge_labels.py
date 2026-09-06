from pathlib import Path

p = Path('index.html')
text = p.read_text(encoding='utf-8')
replacements = {
    'aria-label="Отзывы на Яндекс Картах"': 'aria-label="Яндекс Карты ★ 4.8"',
    'aria-label="Отзывы в Google Maps"': 'aria-label="Google Maps ★ 4.7"',
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'index.html: expected one {old!r}, found {count}')
    text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')
print('Homepage map badge accessible names synchronized')
