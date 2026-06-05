#!/usr/bin/env python3
"""
Сравнивает каждую пару скриншотов в двух директориях.
Для каждого общего имени файла вычисляет:
  - MSE (mean squared error) на RGB
  - % пикселей с любым отклонением (даже 1)
  - % "значимых" пикселей с отклонением > 8 на канал

Выводит таблицу и в конце общий вердикт.
Безопасный порог для премиум UI: %significant <= 0.10 (десятая доля процента).
Любое превышение — реверт изменения.

Некоторые страницы дают естественную нестабильность (рандомный
порядок карточек галереи, автоплей карусели отзывов). Они
вынесены в UNSTABLE_WHITELIST и не учитываются в вердикте,
но diff всё равно печатается для информации.

Usage: python3 scripts/visual_diff.py BEFORE_DIR AFTER_DIR
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: pip install --user Pillow")

try:
    import numpy as np
except ImportError:
    sys.exit("numpy required: pip install --user numpy")


# Снимки, в которых рандомизация контента (порядок карточек, автоплей
# карусели) дает шум независимо от наших правок. Они выводятся, но не
# учитываются в финальном вердикте.
UNSTABLE_WHITELIST = {
    "gallery-desktop-top.png",   # buildInterleavedItems тасует фото/видео
    "reviews-area.png",          # карусель отзывов автопрокручивается
}


def diff_one(a_path: Path, b_path: Path):
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    if a.size != b.size:
        return None  # размеры разные — отдельная категория
    aa = np.asarray(a, dtype=np.int16)
    bb = np.asarray(b, dtype=np.int16)
    delta = np.abs(aa - bb)
    any_pix = int(np.sum(np.any(delta > 0, axis=2)))
    sig_pix = int(np.sum(np.any(delta > 8, axis=2)))
    pix_total = a.size[0] * a.size[1]
    mse = float(np.mean(delta.astype(np.float32) ** 2))
    return {
        "size": a.size,
        "mse": mse,
        "any_pct": 100.0 * any_pix / pix_total,
        "sig_pct": 100.0 * sig_pix / pix_total,
    }


def main():
    if len(sys.argv) != 3:
        sys.exit("Usage: visual_diff.py BEFORE_DIR AFTER_DIR")
    before = Path(sys.argv[1])
    after = Path(sys.argv[2])
    if not before.is_dir() or not after.is_dir():
        sys.exit("Both arguments must be directories")

    before_files = {p.name: p for p in before.glob("*.png")}
    after_files = {p.name: p for p in after.glob("*.png")}
    common = sorted(set(before_files) & set(after_files))
    only_before = sorted(set(before_files) - set(after_files))
    only_after = sorted(set(after_files) - set(before_files))

    print(f"Comparing {len(common)} pairs")
    if only_before:
        print(f"  ONLY in BEFORE: {only_before}")
    if only_after:
        print(f"  ONLY in AFTER:  {only_after}")
    print()
    print(f"{'NAME':<42} {'SIZE':<11} {'MSE':>8}  {'any%':>7}  {'signif%':>8}  verdict")
    print("-" * 92)

    fails = 0
    warns = 0
    SIG_FAIL = 0.10
    SIG_WARN = 0.02

    for name in common:
        d = diff_one(before_files[name], after_files[name])
        if d is None:
            print(f"{name:<42} SIZE MISMATCH")
            fails += 1
            continue
        size_str = f"{d['size'][0]}x{d['size'][1]}"
        is_unstable = name in UNSTABLE_WHITELIST
        v = "OK"
        if d["sig_pct"] > SIG_FAIL:
            if is_unstable:
                v = "↻ unstable (ignored)"
            else:
                v = "❌ FAIL"
                fails += 1
        elif d["sig_pct"] > SIG_WARN:
            if is_unstable:
                v = "↻ unstable (ignored)"
            else:
                v = "⚠ warn"
                warns += 1
        elif d["sig_pct"] == 0 and d["any_pct"] == 0:
            v = "✓ pixel-perfect"
        print(
            f"{name:<42} {size_str:<11} {d['mse']:>8.2f}  "
            f"{d['any_pct']:>6.2f}%  {d['sig_pct']:>7.3f}%  {v}"
        )

    print()
    stable_total = len([n for n in common if n not in UNSTABLE_WHITELIST])
    print(
        f"Stable pairs: {stable_total - fails - warns} OK, "
        f"{warns} warn, {fails} fail "
        f"(plus {len(common) - stable_total} unstable ignored)"
    )
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())

