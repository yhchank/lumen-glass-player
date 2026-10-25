from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
ASSETS = ROOT / "electron" / "assets" / "thumbar"
BUILD.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

SIZE = 1024
MARGIN = 44
RADIUS = 226


def linear_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    y = np.linspace(0.0, 1.0, size, dtype=np.float32)[:, None, None]
    top_arr = np.array(top, dtype=np.float32).reshape(1, 1, 3)
    bottom_arr = np.array(bottom, dtype=np.float32).reshape(1, 1, 3)
    arr = top_arr * (1.0 - y) + bottom_arr * y
    arr = np.repeat(arr, size, axis=1).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def radial_glow(
    canvas: Image.Image,
    center: tuple[int, int],
    radius: int,
    color: tuple[int, int, int],
    alpha: int,
) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    steps = 22
    for step in range(steps, 0, -1):
        ratio = step / steps
        r = int(radius * ratio)
        a = int(alpha * (1.0 - ratio) ** 1.9)
        if a <= 0:
            continue
        draw.ellipse(
            (center[0] - r, center[1] - r, center[0] + r, center[1] + r),
            fill=(*color, a),
        )
    layer = layer.filter(ImageFilter.GaussianBlur(36))
    canvas.alpha_composite(layer)


def rounded_mask(size: int, margin: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (margin, margin, size - margin, size - margin), radius=radius, fill=255
    )
    return mask


def build_icon() -> Image.Image:
    base = linear_gradient(SIZE, (8, 27, 31), (20, 16, 42))
    base = base.convert("RGBA")
    radial_glow(base, (300, 250), 520, (62, 228, 206), 150)
    radial_glow(base, (750, 790), 470, (144, 118, 255), 130)
    radial_glow(base, (830, 170), 260, (255, 184, 120), 55)

    draw = ImageDraw.Draw(base, "RGBA")
    # Faint inner rings give the tile a glassy depth.
    for index, inset in enumerate((86, 128, 172)):
        draw.ellipse(
            (SIZE / 2 - 360 + inset, SIZE / 2 - 360 + inset, SIZE / 2 + 360 - inset, SIZE / 2 + 360 - inset),
            outline=(255, 255, 255, 16 - index * 4),
            width=2,
        )

    # Central lens.
    lens = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    lens_draw = ImageDraw.Draw(lens, "RGBA")
    lens_box = (234, 234, 790, 790)
    lens_draw.ellipse(lens_box, fill=(255, 255, 255, 22))
    lens_draw.ellipse(lens_box, outline=(255, 255, 255, 120), width=4)
    lens_draw.ellipse((260, 260, 764, 764), outline=(255, 255, 255, 30), width=2)
    # Specular sweep across the top-left of the lens.
    lens_draw.arc((250, 250, 774, 774), start=190, end=292, fill=(255, 255, 255, 190), width=9)
    lens_draw.arc((278, 278, 746, 746), start=290, end=330, fill=(255, 255, 255, 70), width=4)
    base.alpha_composite(lens.filter(ImageFilter.GaussianBlur(0.4)))

    # Soft shadow under the play glyph.
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow, "RGBA")
    triangle = [(436, 394), (436, 630), (666, 512)]
    sd.polygon([(x + 4, y + 14) for x, y in triangle], fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    base.alpha_composite(shadow)

    # Play glyph with a subtle vertical pearl gradient.
    glyph_mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(glyph_mask).polygon(triangle, fill=255)
    glyph_grad = linear_gradient(SIZE, (255, 255, 255), (206, 255, 247))
    glyph = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glyph.paste(glyph_grad, (0, 0), glyph_mask)
    base.alpha_composite(glyph)

    # Outer rim light.
    draw.rounded_rectangle(
        (MARGIN, MARGIN, SIZE - MARGIN, SIZE - MARGIN),
        radius=RADIUS,
        outline=(255, 255, 255, 78),
        width=3,
    )
    draw.rounded_rectangle(
        (MARGIN + 5, MARGIN + 5, SIZE - MARGIN - 5, SIZE - MARGIN - 5),
        radius=RADIUS - 5,
        outline=(255, 255, 255, 24),
        width=2,
    )

    mask = rounded_mask(SIZE, MARGIN, RADIUS)
    result = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    result.paste(base, (0, 0), mask)
    return result


def make_thumbar_glyph(kind: str) -> None:
    size = 64
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    white = (255, 255, 255, 255)
    if kind == "play":
        draw.polygon([(20, 12), (20, 52), (52, 32)], fill=white)
    elif kind == "pause":
        draw.rounded_rectangle((17, 12, 27, 52), radius=3, fill=white)
        draw.rounded_rectangle((37, 12, 47, 52), radius=3, fill=white)
    elif kind == "previous":
        draw.rounded_rectangle((14, 12, 20, 52), radius=2, fill=white)
        draw.polygon([(52, 12), (52, 52), (24, 32)], fill=white)
    elif kind == "next":
        draw.rounded_rectangle((44, 12, 50, 52), radius=2, fill=white)
        draw.polygon([(12, 12), (12, 52), (40, 32)], fill=white)
    canvas.save(ASSETS / f"{kind}.png")


icon = build_icon()
icon.save(BUILD / "icon.png")
icon.resize((512, 512), Image.LANCZOS).save(BUILD / "icon-512.png")
icon.save(
    BUILD / "icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

for kind in ("play", "pause", "previous", "next"):
    make_thumbar_glyph(kind)

print("wrote", BUILD / "icon.png", BUILD / "icon.ico")
