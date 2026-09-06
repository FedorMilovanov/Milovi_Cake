from pathlib import Path

p = Path('index.html')
text = p.read_text(encoding='utf-8')
replacements = {
    'class="map-badge map-badge-yandex" onclick="openReviewsModal(\'yandex\')" aria-label="Отзывы на Яндекс Картах"':
        'class="map-badge map-badge-yandex" onclick="openReviewsModal(\'yandex\')" aria-label="Яндекс Карты ★ 4.8"',
    'class="map-badge map-badge-google" onclick="openReviewsModal(\'google\')" aria-label="Отзывы в Google Maps"':
        'class="map-badge map-badge-google" onclick="openReviewsModal(\'google\')" aria-label="Google Maps ★ 4.7"',
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'index.html: expected one exact map-badge match for {old!r}, found {count}')
    text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')
print('Homepage map badge accessible names synchronized')
