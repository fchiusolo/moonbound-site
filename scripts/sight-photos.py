"""Copies the free sights' close-ups from a LunAR checkout, resized for the web.

Usage, from the repo root:  python3 scripts/sight-photos.py ../LunAR
"""
import json
import sys
from pathlib import Path

from PIL import Image

lunar = Path(sys.argv[1])
catalog = json.loads((lunar / "ios/Moonbound/Catalog/en.lproj/FeatureCatalog.json").read_text())
out = Path("assets/sights")
out.mkdir(parents=True, exist_ok=True)
for feature in catalog:
    if feature["difficulty"] != "binoculars" or feature["isLimbFeature"]:
        continue
    folder = lunar / "ios/Moonbound/Images.xcassets/Features" / f"{feature['slug']}.imageset"
    source = next(p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    image = Image.open(source).convert("L").resize((400, 400), Image.LANCZOS)
    image.save(out / f"{feature['slug']}.jpg", quality=82, optimize=True, progressive=True)
