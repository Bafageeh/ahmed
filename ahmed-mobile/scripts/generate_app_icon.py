from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)

SIZE = 1024
BG1 = (30, 16, 78)
BG2 = (92, 45, 162)
GOLD = (246, 210, 118)
GOLD_DARK = (179, 128, 45)
WHITE_GOLD = (255, 244, 188)

img = Image.new('RGBA', (SIZE, SIZE), BG1 + (255,))
p = img.load()
for y in range(SIZE):
    for x in range(SIZE):
        dx = (x - SIZE * 0.78) / SIZE
        dy = (y - SIZE * 0.18) / SIZE
        t = max(0, min(1, 1 - math.sqrt(dx * dx + dy * dy) * 1.55))
        r = int(BG1[0] * (1 - t) + BG2[0] * t)
        g = int(BG1[1] * (1 - t) + BG2[1] * t)
        b = int(BG1[2] * (1 - t) + BG2[2] * t)
        p[x, y] = (r, g, b, 255)

# soft inner glow
layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
d.ellipse((120, 115, 970, 960), outline=(255, 255, 255, 30), width=8)
img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(3)))

def draw_gold_line(draw, points, width=48):
    shadow = [(x + 12, y + 14) for x, y in points]
    draw.line(shadow, fill=(0, 0, 0, 70), width=width, joint='curve')
    draw.line(points, fill=GOLD_DARK + (255,), width=width + 10, joint='curve')
    draw.line(points, fill=GOLD + (255,), width=width, joint='curve')
    draw.line([(x - 3, y - 4) for x, y in points], fill=WHITE_GOLD + (190,), width=max(8, width // 5), joint='curve')

# gold crescent / protective curve
arc = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
ad = ImageDraw.Draw(arc)
ad.arc((110, 135, 900, 900), start=135, end=332, fill=GOLD_DARK + (255,), width=35)
ad.arc((115, 130, 900, 895), start=135, end=332, fill=GOLD + (255,), width=25)
ad.arc((135, 142, 890, 870), start=140, end=325, fill=WHITE_GOLD + (120,), width=7)
img = Image.alpha_composite(img, arc)

d = ImageDraw.Draw(img)

# growth bars
bar_w = 88
bars = [265, 365, 470]
heights = [170, 255, 350]
for x, h in zip(bars, heights):
    y0 = 650 - h
    d.rounded_rectangle((x + 10, y0 + 12, x + bar_w + 10, 665 + 12), radius=14, fill=(0, 0, 0, 70))
    d.rounded_rectangle((x, y0, x + bar_w, 665), radius=14, fill=GOLD_DARK + (255,))
    d.rounded_rectangle((x + 7, y0 + 7, x + bar_w - 7, 658), radius=11, fill=GOLD + (255,))
    d.rectangle((x + 12, y0 + 12, x + bar_w - 22, y0 + 58), fill=WHITE_GOLD + (150,))

# Arabic-style Alef mark
# main vertical
x = 590
d.rounded_rectangle((x + 10, 230 + 13, x + 96 + 10, 675 + 13), radius=38, fill=(0, 0, 0, 65))
d.rounded_rectangle((x, 230, x + 96, 675), radius=38, fill=GOLD_DARK + (255,))
d.rounded_rectangle((x + 8, 238, x + 88, 665), radius=32, fill=GOLD + (255,))
d.rectangle((x + 16, 250, x + 44, 520), fill=WHITE_GOLD + (120,))
# hamza hint
d.arc((600, 120, 735, 235), start=35, end=310, fill=WHITE_GOLD + (255,), width=35)
d.line((665, 190, 715, 205), fill=WHITE_GOLD + (255,), width=24)

# rising arrow
arrow_points = [(210, 705), (345, 635), (480, 585), (610, 525), (755, 365)]
draw_gold_line(d, arrow_points, 42)
d.polygon([(750, 315), (842, 445), (690, 435)], fill=GOLD + (255,))
d.polygon([(752, 319), (835, 438), (758, 412)], fill=WHITE_GOLD + (110,))

# palm / base curve
base = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
bd = ImageDraw.Draw(base)
bd.pieslice((135, 600, 685, 915), start=195, end=350, fill=GOLD + (255,))
bd.pieslice((190, 600, 710, 830), start=190, end=350, fill=BG1 + (255,))
bd.pieslice((390, 565, 830, 875), start=20, end=170, fill=GOLD + (255,))
bd.pieslice((440, 605, 760, 790), start=20, end=170, fill=BG1 + (255,))
img = Image.alpha_composite(img, base)

# slight vignette
v = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
vd = ImageDraw.Draw(v)
vd.rounded_rectangle((0, 0, SIZE, SIZE), radius=220, outline=(0, 0, 0, 95), width=28)
img = Image.alpha_composite(img, v.filter(ImageFilter.GaussianBlur(8)))

# Save app icons
icon_path = ASSETS / 'icon.png'
adaptive_path = ASSETS / 'adaptive-icon.png'
splash_path = ASSETS / 'splash-icon.png'
img.save(icon_path)
img.save(adaptive_path)
img.resize((512, 512), Image.LANCZOS).save(splash_path)

print(f'Generated {icon_path}')
print(f'Generated {adaptive_path}')
print(f'Generated {splash_path}')
