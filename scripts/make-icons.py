#!/usr/bin/env python3
"""Generates the app icons in public/icons/ (run once; the PNGs are committed).

Design: a navy gradient square with a fine gold frame and a gold classic office
building (pediment with an "O" monogram, four columns, stepped base). Drawn at
4x and downsampled for smooth edges. Requires Pillow (pip install pillow).

  icon-192.png, icon-512.png     "any" purpose, full-bleed square
  maskable-512.png               "maskable": artwork kept inside the central
                                 80% safe zone so Android can crop it
  apple-touch-icon.png (180px)   iOS home screen icon: full-bleed, no alpha
                                 (iOS applies its own corner mask)
"""
from pathlib import Path

from PIL import Image, ImageDraw

TOP = (34, 66, 106)      # navy, top of gradient
BOTTOM = (12, 27, 47)    # deep navy, bottom
GOLD = (233, 189, 96)
GOLD_DEEP = (196, 146, 58)
OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
SS = 4  # supersampling factor


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw(size: int, scale: float = 1.0) -> Image.Image:
    """Return a size x size RGB icon. scale < 1 shrinks the artwork (maskable)."""
    px = size * SS
    img = Image.new("RGB", (px, px), TOP)
    d = ImageDraw.Draw(img)
    # Vertical gradient background
    for y in range(px):
        d.line([(0, y), (px, y)], fill=lerp(TOP, BOTTOM, y / (px - 1)))

    c = px / 2

    def P(x, y):
        """Map artwork coordinates (0..1, centred on 0.5) to pixels."""
        return (c + (x - 0.5) * px * scale, c + (y - 0.5) * px * scale)

    def R(x0, y0, x1, y1):
        (a, b), (e, f) = P(x0, y0), P(x1, y1)
        return [a, b, e, f]

    # Fine gold frame
    inset = 0.085
    frame_w = max(2, round(px * 0.010 * scale))
    d.rounded_rectangle(
        R(inset, inset, 1 - inset, 1 - inset),
        radius=px * 0.16 * scale,
        outline=GOLD_DEEP,
        width=frame_w,
    )

    # Pediment (triangle roof)
    d.polygon([P(0.5, 0.265), P(0.225, 0.405), P(0.775, 0.405)], fill=GOLD)
    # Entablature band under the roof
    d.rectangle(R(0.20, 0.405, 0.80, 0.445), fill=GOLD)
    # "O" monogram inside the pediment (ring cut out with the background colour)
    ring_c = P(0.5, 0.345)
    r_out = px * 0.042 * scale
    r_in = px * 0.026 * scale
    d.ellipse([ring_c[0] - r_out, ring_c[1] - r_out, ring_c[0] + r_out, ring_c[1] + r_out], fill=GOLD_DEEP)
    bg = lerp(TOP, BOTTOM, 0.345)
    d.ellipse([ring_c[0] - r_in, ring_c[1] - r_in, ring_c[0] + r_in, ring_c[1] + r_in], fill=bg)

    # Four columns
    col_w = 0.058
    for x in (0.275, 0.405, 0.535, 0.665):
        d.rectangle(R(x - col_w / 2, 0.465, x + col_w / 2, 0.655), fill=GOLD)
    # Stylobate and stepped base
    d.rectangle(R(0.235, 0.665, 0.765, 0.695), fill=GOLD)
    d.rectangle(R(0.20, 0.695, 0.80, 0.725), fill=GOLD_DEEP)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw(192).save(OUT / "icon-192.png", optimize=True)
    draw(512).save(OUT / "icon-512.png", optimize=True)
    draw(512, scale=0.8).save(OUT / "maskable-512.png", optimize=True)
    draw(180).save(OUT / "apple-touch-icon.png", optimize=True)
    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()
