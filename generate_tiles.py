"""
Generate all tile icon assets for Microsoft Store AppX submission.

Run this on Windows BEFORE `yarn build:msix`:
    cd E:\question
    python generate_tiles.py

This generates 48 icon files in build/appx/ including:
- 10 base sizes for all tile contexts
- 30 HiDPI scale variants (100%, 125%, 150%, 200%, 400%)
- 8 unplated variants (for taskbar/search/Alt+Tab contexts without background)
"""
from PIL import Image
import os

src = Image.open('frontend/public/icon-512x512.png').convert('RGBA')
os.makedirs('build/appx', exist_ok=True)

# Base + all sizes
for name, size in [
    ('StoreLogo.png', (50, 50)),
    ('Square44x44Logo.png', (44, 44)),
    ('Square71x71Logo.png', (71, 71)),
    ('Square89x89Logo.png', (89, 89)),
    ('Square107x107Logo.png', (107, 107)),
    ('Square142x142Logo.png', (142, 142)),
    ('Square150x150Logo.png', (150, 150)),
    ('Square284x284Logo.png', (284, 284)),
    ('Square310x310Logo.png', (310, 310)),
    ('Wide310x150Logo.png', (310, 150)),
]:
    src.resize(size, Image.LANCZOS).save(f'build/appx/{name}')

# HiDPI scale variants
scales = [100, 125, 150, 200, 400]
for base, (w, h) in [
    ('StoreLogo', (50, 50)),
    ('Square44x44Logo', (44, 44)),
    ('Square71x71Logo', (71, 71)),
    ('Square150x150Logo', (150, 150)),
    ('Square310x310Logo', (310, 310)),
    ('Wide310x150Logo', (310, 150)),
]:
    for s in scales:
        sw, sh = int(w * s / 100), int(h * s / 100)
        src.resize((sw, sh), Image.LANCZOS).save(f'build/appx/{base}.scale-{s}.png')

# Unplated variants (used when no background color, e.g. taskbar, search, Alt+Tab)
for name, size in [
    ('Square44x44Logo.targetsize-16_altform-unplated.png', (16, 16)),
    ('Square44x44Logo.targetsize-24_altform-unplated.png', (24, 24)),
    ('Square44x44Logo.targetsize-32_altform-unplated.png', (32, 32)),
    ('Square44x44Logo.targetsize-48_altform-unplated.png', (48, 48)),
    ('Square44x44Logo.targetsize-256_altform-unplated.png', (256, 256)),
    ('Square150x150Logo.targetsize-150_altform-unplated.png', (150, 150)),
    ('Wide310x150Logo.targetsize-310x150_altform-unplated.png', (310, 150)),
    ('Square310x310Logo.targetsize-310_altform-unplated.png', (310, 310)),
]:
    src.resize(size, Image.LANCZOS).save(f'build/appx/{name}')

print(f'✅ Generated {len(os.listdir("build/appx"))} tile icon files in build/appx/')
