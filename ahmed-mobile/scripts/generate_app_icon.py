from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)

DARK = (30, 16, 78, 255)
BLUE = (37, 99, 235, 255)
GREEN = (52, 211, 153, 255)
GOLD = (245, 158, 11, 255)
WHITE = (255, 255, 255, 255)
SOFT = (218, 230, 255, 255)


def font(size, bold=True):
    paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ]
    for path in paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_icon(size):
    img = Image.new('RGBA', (size, size), DARK)
    draw = ImageDraw.Draw(img)

    for y in range(size):
        t = y / max(1, size - 1)
        r = int(22 * (1 - t) + 13 * t)
        g = int(12 * (1 - t) + 47 * t)
        b = int(67 * (1 - t) + 95 * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    for cx, cy, rad, col in [
        (int(size * 0.18), int(size * 0.18), int(size * 0.33), (62, 211, 255, 35)),
        (int(size * 0.82), int(size * 0.75), int(size * 0.36), (245, 158, 11, 28)),
        (int(size * 0.50), int(size * 0.55), int(size * 0.50), (124, 58, 237, 32)),
    ]:
        layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        layer_draw = ImageDraw.Draw(layer)
        layer_draw.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=col)
        img = Image.alpha_composite(img, layer)
        draw = ImageDraw.Draw(img)

    pad = int(size * 0.12)
    card = (pad, int(size * 0.18), size - pad, int(size * 0.78))
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (card[0] + int(size * 0.018), card[1] + int(size * 0.025), card[2] + int(size * 0.018), card[3] + int(size * 0.025)),
        radius=int(size * 0.09),
        fill=(0, 0, 0, 90),
    )
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    rounded(draw, card, int(size * 0.09), fill=(255, 255, 255, 232), outline=(255, 255, 255, 120), width=max(1, int(size * 0.006)))
    inner = (card[0] + int(size * 0.06), card[1] + int(size * 0.08), card[2] - int(size * 0.06), card[3] - int(size * 0.08))
    rounded(draw, inner, int(size * 0.065), fill=DARK)

    a_font = font(int(size * 0.38), True)
    a_box = draw.textbbox((0, 0), 'A', font=a_font)
    draw.text((size // 2 - (a_box[2] - a_box[0]) // 2, int(size * 0.25) - a_box[1]), 'A', font=a_font, fill=WHITE)

    label_font = font(int(size * 0.075), True)
    label = 'AHMED'
    label_box = draw.textbbox((0, 0), label, font=label_font)
    draw.text((size // 2 - (label_box[2] - label_box[0]) // 2, int(size * 0.67)), label, font=label_font, fill=SOFT)

    base = int(size * 0.60)
    start = int(size * 0.29)
    bar_w = int(size * 0.055)
    for i, (height, color) in enumerate([(int(size * 0.12), BLUE), (int(size * 0.19), GREEN), (int(size * 0.27), GOLD)]):
        x = start + i * int(size * 0.10)
        rounded(draw, (x, base - height, x + bar_w, base), int(size * 0.02), fill=color)

    draw.line([(int(size * 0.56), int(size * 0.57)), (int(size * 0.76), int(size * 0.49))], fill=GREEN, width=int(size * 0.025))
    draw.ellipse((int(size * 0.73), int(size * 0.46), int(size * 0.79), int(size * 0.52)), fill=GREEN)
    return img


icon = make_icon(1024)
splash = make_icon(512)

icon.save(ASSETS / 'icon.png')
icon.save(ASSETS / 'adaptive-icon.png')
splash.save(ASSETS / 'splash-icon.png')

# Verify that all generated PNG files are readable before Expo prebuild.
for name in ['icon.png', 'adaptive-icon.png', 'splash-icon.png']:
    path = ASSETS / name
    with Image.open(path) as image:
        image.verify()
    print(f'Generated valid PNG: {path}')
