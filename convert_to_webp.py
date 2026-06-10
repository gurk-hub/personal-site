"""One-off: convert referenced project images to WebP.
Originals are kept (moved to assets/_originals) so nothing is lost.
"""
import os
import shutil
from PIL import Image

ASSETS = os.path.join(os.path.dirname(__file__), "assets")
BACKUP = os.path.join(ASSETS, "_originals")
MAX_WIDTH = 1280
QUALITY = 82

# Only the images actually referenced as project/gallery art.
# Skipped on purpose: logo.jpg (favicon), social icons, gurkstamp_nobg.png
# (all tiny), and gurkispvp.jpg (orphan, not referenced anywhere).
FILES = [
    "Battle43Pacific.jpg", "b43s1.jpg", "b43s2.jpg", "b43s3.jpg",
    "justdrive.jpg", "burningrubber.jpg", "jdbrs1.jpg", "jdbrs2.jpg", "jdbrs3.jpg",
    "charity.jpg", "constsurv.jpg", "cache.png", "otherprojects.jpg",
    "datapacks.jpg",
    "op1.jpg", "op2.jpg", "op3.jpg", "op4.jpg", "op5.jpg", "op6.png",
    "op7.jpg", "op8.jpg", "op9.jpg", "op10.jpg", "op11.png", "op12.png",
]

os.makedirs(BACKUP, exist_ok=True)
before_total = after_total = 0

for name in FILES:
    src = os.path.join(ASSETS, name)
    if not os.path.exists(src):
        print(f"  ! missing, skipped: {name}")
        continue
    stem, _ = os.path.splitext(name)
    dst = os.path.join(ASSETS, stem + ".webp")

    im = Image.open(src)
    # Flatten transparency onto white for non-alpha-needed art; keep RGBA otherwise.
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
    else:
        im = im.convert("RGB")

    if im.width > MAX_WIDTH:
        h = round(im.height * MAX_WIDTH / im.width)
        im = im.resize((MAX_WIDTH, h), Image.LANCZOS)

    im.save(dst, "WEBP", quality=QUALITY, method=6)

    b = os.path.getsize(src)
    a = os.path.getsize(dst)
    before_total += b
    after_total += a
    print(f"  {name:24s} {b//1024:5d}KB -> {a//1024:4d}KB  ({stem}.webp)")

    shutil.move(src, os.path.join(BACKUP, name))

print(f"\nTotal: {before_total//1024}KB -> {after_total//1024}KB "
      f"({100*(before_total-after_total)//max(before_total,1)}% smaller)")
print(f"Originals backed up in: {BACKUP}")
