#!/usr/bin/env python3
"""Generates the PWA icons in public/icons/ (run once; the PNGs are committed).

A gold ring with three ascending bars on a navy square. Drawn at 4x and
downsampled for smooth edges. Requires Pillow (pip install pillow).

  icon-192.png, icon-512.png     "any" purpose, full-bleed square
  maskable-512.png               "maskable" purpose: artwork kept inside the
                                 central 80% safe zone so Android can crop it
  apple-touch-icon.png (180px)   iOS home screen icon: full-bleed, no alpha
                                 (iOS applies its own corner mask)
"""
from pathlib import Path

from PIL import Image, ImageDraw

NAVY = (29, 58, 95, 255)
GOLD = (242, 178, 51, 255)
WHITE = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
SS = 4  # supersampling factor


def draw(size: int, scale: float = 1.0) -> Image.Image:
    """Return a size x size RGBA icon. scale < 1 shrinks the artwork (maskable)."""
    px = size * SS
    img = Image.new("RGBA", (px, px), NAVY)
    d = ImageDraw.Draw(img)
    c = px / 2
    r_out = px * 0.30 * scale
    stroke = px * 0.085 * scale
    # Gold ring
    d.ellipse([c - r_out, c - r_out, c + r_out, c + r_out], outline=GOLD, width=round(stroke))
    # Three ascending bars inside the ring
    bar_w = px * 0.07 * scale
    gap = px * 0.045 * scale
    base = c + px * 0.13 * scale
    heights = [0.10, 0.18, 0.27]
    total_w = bar_w * 3 + gap * 2
    x = c - total_w / 2
    for h in heights:
        top = base - px * h * scale
        d.rounded_rectangle([x, top, x + bar_w, base], radius=bar_w * 0.25, fill=WHITE)
        x += bar_w + gap
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw(192).convert("RGB").save(OUT / "icon-192.png", optimize=True)
    draw(512).convert("RGB").save(OUT / "icon-512.png", optimize=True)
    draw(512, scale=0.8).convert("RGB").save(OUT / "maskable-512.png", optimize=True)
    draw(180).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()
