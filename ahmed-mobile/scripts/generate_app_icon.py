from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)

BG = (30, 16, 78)
BLUE = (37, 99, 235)
GREEN = (52, 211, 153)
GOLD = (245, 158, 11)
WHITE = (255, 255, 255)
SOFT = (218, 230, 255)


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
    # RGB only: no alpha, no palette, no interlace. This format is safe for Expo/Jimp prebuild.
    img = Image.new('RGB', (size, size), BG)
    draw = ImageDraw.Draw(img)

    for y in range(size):
        t = y / max(1, size - 1)
        r = int(28 * (1 - t) + 15 * t)
        g = int(20 * (1 - t) + 47 * t)
        b = int(86 * (1 - t) + 100 * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    pad = int(size * 0.14)
    card = (pad, int(size * 0.20), size - pad, int(size * 0.78))
    rounded(draw, card, int(size * 0.09), fill=(245, 248, 255), outline=(210, 225, 255), width=max(2, int(size * 0.007)))

    inner = (card[0] + int(size * 0.055), card[1] + int(size * 0.075), card[2] - int(size * 0.055), card[3] - int(size * 0.075))
    rounded(draw, inner, int(size * 0.06), fill=BG)

    a_font = font(int(size * 0.37), True)
    a_box = draw.textbbox((0, 0), 'A', font=a_font)
    draw.text((size // 2 - (a_box[2] - a_box[0]) // 2, int(size * 0.255) - a_box[1]), 'A', font=a_font, fill=WHITE)

    base = int(size * 0.61)
    start = int(size * 0.29)
    bar_w = int(size * 0.055)
    for i, (height, color) in enumerate([(int(size * 0.12), BLUE), (int(size * 0.19), GREEN), (int(size * 0.27), GOLD)]):
        x = start + i * int(size * 0.10)
        rounded(draw, (x, base - height, x + bar_w, base), int(size * 0.018), fill=color)

    draw.line([(int(size * 0.56), int(size * 0.57)), (int(size * 0.76), int(size * 0.49))], fill=GREEN, width=max(4, int(size * 0.025)))
    draw.ellipse((int(size * 0.73), int(size * 0.46), int(size * 0.79), int(size * 0.52)), fill=GREEN)

    label_font = font(int(size * 0.075), True)
    label = 'AHMED'
    label_box = draw.textbbox((0, 0), label, font=label_font)
    draw.text((size // 2 - (label_box[2] - label_box[0]) // 2, int(size * 0.675)), label, font=label_font, fill=SOFT)
    return img


def save_png(image, path):
    image.save(path, format='PNG', optimize=False, compress_level=1)
    with Image.open(path) as check:
        check.load()
        if check.mode != 'RGB':
            raise RuntimeError(f'{path} is not RGB, got {check.mode}')
        print(f'Generated valid RGB PNG: {path} {check.size} {check.mode}')


icon = make_icon(1024)
splash = make_icon(512)

save_png(icon, ASSETS / 'icon.png')
save_png(icon, ASSETS / 'adaptive-icon.png')
save_png(splash, ASSETS / 'splash-icon.png')
