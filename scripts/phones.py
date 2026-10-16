"""Puts the app screenshots into the iPhone bezel for the landing page, and prepares the press kit
files. Usage, from the repo root:  python3 scripts/phones.py <folder with the screenshots>

The bezel is 1350x2760 with its screen at (72, 69), 1206x2622.
"""
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

source = Path(sys.argv[1])
bezel = Image.open(source / "iphone-17-pro-deep-blue-bezel.png").convert("RGBA")
SCREEN = (72, 69, 1206, 2622)
RADIUS = 177

shots = {
    "today": "today.png",
    "upcoming": "upcoming.png",
    "feature": "feature-copernicus.png",
    "observe": "observe.png",
    "red-light": "red-light.png",
}

mask = Image.new("L", SCREEN[2:], 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, SCREEN[2] - 1, SCREEN[3] - 1), RADIUS, fill=255)

for name, file in shots.items():
    shot = Image.open(source / file).convert("RGB").resize(SCREEN[2:], Image.LANCZOS)
    phone = Image.new("RGBA", bezel.size, (0, 0, 0, 0))
    phone.paste(shot, SCREEN[:2], mask)
    phone.alpha_composite(bezel)
    phone.resize((700, round(700 * bezel.height / bezel.width)), Image.LANCZOS).save(
        f"assets/phones/{name}.webp", quality=86, method=6)
    # Press kit: the plain screenshot, full size, and a small preview.
    Image.open(source / file).convert("RGB").save(f"assets/press/moonbound-{name}.png", optimize=True)
    Image.open(source / file).convert("RGB").resize((280, round(280 * shot.height / shot.width)), Image.LANCZOS).save(
        f"assets/press/preview-{name}.webp", quality=84, method=6)

icon = Image.open(source / "app-icon.png").convert("RGBA")
icon.save("assets/press/moonbound-icon.png", optimize=True)
for size in (40, 80, 180, 280, 512):
    icon.resize((size, size), Image.LANCZOS).save(f"assets/img/icon-{size}.png", optimize=True)

with zipfile.ZipFile("assets/press/moonbound-press-kit.zip", "w", zipfile.ZIP_DEFLATED) as kit:
    kit.write("assets/press/moonbound-icon.png", "moonbound-icon.png")
    for name in shots:
        kit.write(f"assets/press/moonbound-{name}.png", f"screenshots/moonbound-{name}.png")
    kit.write("press/fact-sheet.txt", "fact-sheet.txt")
