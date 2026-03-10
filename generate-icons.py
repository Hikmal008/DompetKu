#!/usr/bin/env python3
"""
DompetKu - Icon Generator
Generates all required PWA icon sizes from SVG
Run: python3 generate-icons.py
Requires: pip install cairosvg pillow
"""

import os

# Create icons directory
os.makedirs('icons', exist_ok=True)

# SVG template for the icon
SVG_ICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Background -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1c2128"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f5c842"/>
      <stop offset="100%" style="stop-color:#c9a227"/>
    </linearGradient>
  </defs>

  <!-- Background rect -->
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>

  <!-- Wallet icon -->
  <rect x="80" y="176" width="352" height="240" rx="24" fill="none" stroke="url(#gold)" stroke-width="20"/>
  <path d="M80 240 L432 240" stroke="url(#gold)" stroke-width="20"/>
  <path d="M80 200 L80 176 Q80 152 104 152 L376 152 Q400 152 400 176 L400 200" fill="none" stroke="url(#gold)" stroke-width="16"/>

  <!-- Coin circle -->
  <circle cx="360" cy="300" r="40" fill="url(#gold)" opacity="0.9"/>
  <text x="360" y="310" text-anchor="middle" font-size="36" font-weight="bold" fill="#0d1117" font-family="serif">$</text>
</svg>'''

# Write SVG
with open('icons/icon.svg', 'w') as f:
    f.write(SVG_ICON)

print("SVG icon created at icons/icon.svg")

# Try to generate PNG icons if cairosvg is available
try:
    import cairosvg
    from PIL import Image
    import io

    sizes = [72, 96, 128, 144, 152, 192, 384, 512]

    for size in sizes:
        png_data = cairosvg.svg2png(bytestring=SVG_ICON.encode(), output_width=size, output_height=size)
        img = Image.open(io.BytesIO(png_data))
        img.save(f'icons/icon-{size}.png')
        print(f"  ✅ Generated icon-{size}.png")

    print(f"\n✨ All {len(sizes)} icon sizes generated!")

except ImportError:
    print("\n⚠️  cairosvg/Pillow not installed.")
    print("   To generate PNG icons, run:")
    print("   pip install cairosvg pillow")
    print("\n   Alternatively, use an online SVG-to-PNG converter")
    print("   and resize to: 72, 96, 128, 144, 152, 192, 384, 512 px")
    print("   Save them as icon-{size}.png in the /icons folder")
    print("\n   Or use: https://realfavicongenerator.net/")
    print("   Upload icons/icon.svg and download all sizes")
