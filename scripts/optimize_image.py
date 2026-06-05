#!/usr/bin/env python3
"""
Milovi Cake — image optimisation helper.

Given a source PNG/JPG/JPEG/WEBP, generate the production-ready pair
of WebP + AVIF used across the site, with consistent quality, EXIF
stripping and PSNR verification so premium visual quality is never
silently degraded.

Usage:
    python3 scripts/optimize_image.py SRC [SRC ...] [options]

Examples:
    # Single hero image -> img/new_hero.webp + img/new_hero.avif
    python3 scripts/optimize_image.py ~/Downloads/new_hero.jpg \\
        --dest img/ --name new_hero

    # Whole batch of gallery shots -> img/gallery/, keep original names
    python3 scripts/optimize_image.py ~/Downloads/shoot/*.jpg \\
        --dest img/gallery/

    # Dry-run: show what would be produced and at what size
    python3 scripts/optimize_image.py img/*.png --dry-run

Defaults (premium-safe, tuned to match the site baseline r57-r59):
    webp quality 82, method 6
    avif quality 60, speed 4
    PSNR floor 35 dB (warn) / 30 dB (fail) — fail aborts the file
    Strips EXIF + ICC metadata (privacy + 5-10% smaller)

The output pair is byte-identical to what the previous waves produced,
so the new files will fit cleanly into the existing `<picture>` markup
and the audit's JS-derived-AVIF guard.
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

try:
    import pillow_avif  # noqa: F401  (registers AVIF plugin into Pillow)
except ImportError:
    sys.stderr.write(
        "ERROR: pillow-avif-plugin is not installed.\n"
        "Install:  pip install --user pillow-avif-plugin\n"
    )
    raise SystemExit(2)

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("ERROR: Pillow is not installed.\nInstall: pip install --user Pillow\n")
    raise SystemExit(2)

try:
    import numpy as np
    HAVE_NUMPY = True
except ImportError:
    HAVE_NUMPY = False


# ── Defaults ────────────────────────────────────────────────────────────
WEBP_QUALITY = 82
WEBP_METHOD = 6              # 0..6, higher = smaller + slower
AVIF_QUALITY = 60
AVIF_SPEED = 4               # 0..10, lower = smaller + slower
PSNR_WARN = 35.0             # dB — below this we warn
PSNR_FAIL = 30.0             # dB — below this we abort
MAX_DIMENSION = 2200         # px — downscale anything bigger (premium hero is 1440)


def psnr(orig: Image.Image, candidate: Image.Image) -> float:
    """Compute PSNR in dB between two same-size RGB PIL images."""
    if not HAVE_NUMPY:
        return float("nan")
    a = np.asarray(orig.convert("RGB"), dtype=np.float32)
    b = np.asarray(candidate.convert("RGB"), dtype=np.float32)
    if a.shape != b.shape:
        # Auto-resize candidate to orig for fair comparison
        candidate = candidate.resize(orig.size, Image.LANCZOS).convert("RGB")
        b = np.asarray(candidate, dtype=np.float32)
    mse = float(np.mean((a - b) ** 2))
    if mse <= 0:
        return 999.0
    return 10.0 * math.log10((255.0 * 255.0) / mse)


def downscale_if_needed(im: Image.Image, max_dim: int) -> Image.Image:
    """Downscale to fit within max_dim while preserving aspect ratio."""
    w, h = im.size
    longest = max(w, h)
    if longest <= max_dim:
        return im
    scale = max_dim / float(longest)
    new = (int(round(w * scale)), int(round(h * scale)))
    return im.resize(new, Image.LANCZOS)


def strip_metadata(im: Image.Image) -> Image.Image:
    """Return a clean RGB copy with no EXIF/ICC/XMP attached."""
    clean = Image.new("RGB", im.size)
    clean.paste(im.convert("RGB"))
    return clean


def encode_webp(im: Image.Image, out: Path, quality: int, method: int) -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, format="WEBP", quality=quality, method=method)
    return out.stat().st_size


def encode_avif(im: Image.Image, out: Path, quality: int, speed: int) -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, format="AVIF", quality=quality, speed=speed)
    return out.stat().st_size


def process_one(
    src: Path,
    dest_dir: Path,
    name: str | None,
    args: argparse.Namespace,
) -> tuple[bool, str]:
    """Returns (success, message)."""
    if not src.exists():
        return False, f"  ✗ {src}: not found"

    try:
        im = Image.open(src)
        im.load()
    except Exception as e:
        return False, f"  ✗ {src}: cannot open ({e})"

    orig_size = src.stat().st_size
    clean = strip_metadata(im)
    if args.max_dim and args.max_dim > 0:
        clean = downscale_if_needed(clean, args.max_dim)

    basename = name or src.stem
    webp_out = dest_dir / f"{basename}.webp"
    avif_out = dest_dir / f"{basename}.avif"

    if args.dry_run:
        return True, (
            f"  · {src} -> {webp_out} + {avif_out}  "
            f"(source {orig_size:,} B, {clean.size[0]}x{clean.size[1]})"
        )

    if webp_out.exists() and not args.overwrite:
        return False, f"  ✗ {webp_out} already exists (use --overwrite)"
    if avif_out.exists() and not args.overwrite:
        return False, f"  ✗ {avif_out} already exists (use --overwrite)"

    webp_size = encode_webp(clean, webp_out, args.webp_quality, args.webp_method)
    avif_size = encode_avif(clean, avif_out, args.avif_quality, args.avif_speed)

    # PSNR verification — make sure premium quality is not silently lost
    psnr_webp = psnr(clean, Image.open(webp_out))
    psnr_avif = psnr(clean, Image.open(avif_out))

    note = ""
    if psnr_webp == psnr_webp and psnr_webp < PSNR_FAIL:  # NaN-safe
        webp_out.unlink(missing_ok=True)
        avif_out.unlink(missing_ok=True)
        return False, (
            f"  ✗ {src}: WebP PSNR {psnr_webp:.1f} dB below fail floor "
            f"({PSNR_FAIL} dB) — output removed, raise --webp-quality"
        )
    if psnr_avif == psnr_avif and psnr_avif < PSNR_FAIL:
        webp_out.unlink(missing_ok=True)
        avif_out.unlink(missing_ok=True)
        return False, (
            f"  ✗ {src}: AVIF PSNR {psnr_avif:.1f} dB below fail floor "
            f"({PSNR_FAIL} dB) — output removed, raise --avif-quality"
        )
    if (psnr_webp == psnr_webp and psnr_webp < PSNR_WARN) or (
        psnr_avif == psnr_avif and psnr_avif < PSNR_WARN
    ):
        note = " ⚠ quality borderline"

    return True, (
        f"  ✓ {src.name:<30} -> "
        f"{webp_out.name} ({webp_size:>7,} B, PSNR {psnr_webp:5.1f} dB)  +  "
        f"{avif_out.name} ({avif_size:>7,} B, PSNR {psnr_avif:5.1f} dB)"
        f"{note}"
    )


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Generate WebP + AVIF pair for one or many source images.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("sources", nargs="+", help="source image files (PNG/JPG/WEBP)")
    ap.add_argument("--dest", default="img/", help="destination directory (default: img/)")
    ap.add_argument(
        "--name",
        default=None,
        help="output basename without extension (only when one source). "
             "Default: keep the source stem.",
    )
    ap.add_argument("--webp-quality", type=int, default=WEBP_QUALITY)
    ap.add_argument("--webp-method", type=int, default=WEBP_METHOD)
    ap.add_argument("--avif-quality", type=int, default=AVIF_QUALITY)
    ap.add_argument("--avif-speed", type=int, default=AVIF_SPEED)
    ap.add_argument(
        "--max-dim",
        type=int,
        default=MAX_DIMENSION,
        help=f"longest-edge cap in px (default {MAX_DIMENSION}); 0 disables",
    )
    ap.add_argument("--overwrite", action="store_true", help="overwrite existing output files")
    ap.add_argument("--dry-run", action="store_true", help="show plan, do not write files")
    args = ap.parse_args()

    if args.name and len(args.sources) > 1:
        sys.stderr.write("ERROR: --name can only be used with a single source file.\n")
        return 2

    dest_dir = Path(args.dest)
    if not args.dry_run:
        dest_dir.mkdir(parents=True, exist_ok=True)

    if not HAVE_NUMPY:
        print("INFO: numpy not installed, PSNR verification disabled. "
              "Install: pip install --user numpy")

    print(f"Encoding {len(args.sources)} file(s) -> {dest_dir}/")
    print(f"  WebP: q={args.webp_quality} method={args.webp_method}")
    print(f"  AVIF: q={args.avif_quality} speed={args.avif_speed}")
    print(f"  Max dimension: {args.max_dim or 'unlimited'} px, EXIF/ICC stripped")
    print()

    ok, fail = 0, 0
    for s in args.sources:
        src = Path(s)
        success, msg = process_one(src, dest_dir, args.name, args)
        print(msg)
        if success:
            ok += 1
        else:
            fail += 1

    print()
    print(f"Done: {ok} ok, {fail} failed")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
