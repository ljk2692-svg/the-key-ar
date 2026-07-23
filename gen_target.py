from PIL import Image, ImageDraw, ImageFont

W, H = 1240, 1754  # A4-ish portrait at 150dpi
img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)

# Background grid / asymmetric panels
for i in range(0, W, 40):
    color = (235, 238, 242) if (i // 40) % 2 == 0 else (245, 247, 250)
    d.rectangle([i, 0, min(i + 39, W), H], fill=color)

# Strong border
margin = 50
d.rectangle([margin, margin, W-margin, H-margin], outline='black', width=10)

# Left top asymmetric emblem
for offset in range(0, 180, 20):
    d.line((110, 120+offset, 450, 200+offset), fill='black', width=6)
    d.line((130, 180+offset, 370, 90+offset), fill=(120, 120, 120), width=3)

# Right top concentric pattern
cx, cy = 930, 260
for r in [180, 140, 100, 60, 22]:
    d.ellipse((cx-r, cy-r, cx+r, cy+r), outline='black', width=7)
for a in range(0, 360, 30):
    import math
    x2 = cx + int(math.cos(math.radians(a)) * 180)
    y2 = cy + int(math.sin(math.radians(a)) * 180)
    d.line((cx, cy, x2, y2), fill=(60, 60, 60), width=3)

# Mid left polygons
poly1 = [(120, 620), (280, 500), (410, 640), (315, 820), (135, 780)]
d.polygon(poly1, outline='black', fill=(240, 240, 240))
poly2 = [(460, 590), (560, 520), (660, 560), (640, 700), (500, 760), (420, 680)]
d.polygon(poly2, outline='black', fill=(205, 205, 205))

# Mid right diagonal bars
for i in range(6):
    x = 770 + i*55
    d.polygon([(x, 520), (x+45, 520), (x+5, 770), (x-40, 770)], fill='black' if i % 2 == 0 else (180, 180, 180))

# Lower maze-like blocks
blocks = [
    (100, 990, 240, 1110), (250, 930, 420, 1030), (260, 1060, 470, 1185),
    (500, 960, 610, 1220), (650, 900, 830, 1010), (700, 1050, 940, 1190),
    (980, 940, 1110, 1160)
]
for idx, b in enumerate(blocks):
    fill = (25, 25, 25) if idx % 2 == 0 else (230, 230, 230)
    d.rectangle(b, fill=fill, outline='black', width=5)

# Connection lines and circles
points = [(180, 1350), (380, 1280), (560, 1370), (760, 1260), (980, 1390)]
for i in range(len(points)-1):
    d.line(points[i] + points[i+1], fill='black', width=8)
for x, y in points:
    d.ellipse((x-28, y-28, x+28, y+28), outline='black', width=8, fill='white')
    d.ellipse((x-8, y-8, x+8, y+8), fill='black')

# Dense symbol row
symbols = ['△', '◎', '≠', '◇', '※', '⟂', '✶', '⌘']
try:
    font_big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 78)
    font_mid = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 42)
    font_title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 60)
    font_num = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 118)
except:
    font_big = font_mid = font_title = font_num = None

x = 120
for i, s in enumerate(symbols):
    d.text((x, 1500 + (i % 2) * 8), s, fill='black', font=font_big)
    x += 125

# Bottom technical text bands
for y in [1605, 1655]:
    d.rectangle((90, y, 1150, y+30), outline='black', width=2)
    for x in range(105, 1140, 28):
        d.line((x, y, x+14, y+30), fill=(100, 100, 100), width=1)

# ID elements with asymmetry and numeric noise
texts = [
    ('KEY-AR TEST TARGET', 110, 60, font_title),
    ('SECURE VISUAL MARKER / ASYMMETRIC / HIGH FEATURE DENSITY', 115, 144, font_mid),
    ('ZONE A-17', 910, 1480, font_mid),
    ('742', 905, 1585, font_num),
    ('L9-3 / R2-8 / X5', 120, 1578, font_mid),
]
for t, x, y, f in texts:
    d.text((x, y), t, fill='black', font=f)

# Tiny corner fiducial-like accents (not QR)
corner_shapes = [
    (85, 85), (W-185, 85), (85, H-185), (W-185, H-185)
]
for x, y in corner_shapes:
    d.rectangle((x, y, x+70, y+70), outline='black', width=6)
    d.line((x, y+35, x+70, y+35), fill='black', width=4)
    d.line((x+35, y, x+35, y+70), fill='black', width=4)

img.save('/home/user/the-key-spike0/target-test.png', quality=95)
print('/home/user/the-key-spike0/target-test.png')
