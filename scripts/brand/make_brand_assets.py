"""Builds the Gymido brand assets from the canvas "G" tile (UX spec, 26 Oct 2026).

Everything derives from the G tile: solid #FFC21A, the "G" in Geist Bold #0A0B0F at
0.5 x the size, the glyph centred on its own bounding box. The glyph is converted to
outlines from the bundled assets/fonts/Geist-Bold.ttf, so the SVG sources hold no
<text> and the PNGs match the app's font exactly.

Dev-time only (not an app dependency). Needs fonttools and ImageMagick:
    python3 -m venv /tmp/venv && /tmp/venv/bin/pip install fonttools==4.60.1
    /tmp/venv/bin/python scripts/brand/make_brand_assets.py
Writes assets/brand/*.svg (sources) and the PNGs app.config.js uses.
"""

import subprocess
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
BRAND = ASSETS / "brand"
GOLD = "#FFC21A"
INK = "#0A0B0F"
WHITE = "#FFFFFF"

font = TTFont(ROOT / "assets" / "fonts" / "Geist-Bold.ttf")
glyphs = font.getGlyphSet()
glyph = glyphs[font.getBestCmap()[ord("G")]]
UPM = font["head"].unitsPerEm

bounds = BoundsPen(glyphs)
glyph.draw(bounds)
X_MIN, Y_MIN, X_MAX, Y_MAX = bounds.bounds


def glyph_path(center_x, center_y, scale):
    """The G as SVG path data, its bounding box centred on (center_x, center_y)."""
    pen = SVGPathPen(glyphs)
    mid_x = (X_MIN + X_MAX) / 2
    mid_y = (Y_MIN + Y_MAX) / 2
    # Font units are y-up; SVG is y-down.
    transform = (scale, 0, 0, -scale, center_x - mid_x * scale, center_y + mid_y * scale)
    glyph.draw(TransformPen(pen, transform))
    return pen.getCommands()


def font_size_scale(font_size):
    return font_size / UPM


def svg(size, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 {size} {size}">{body}</svg>\n'
    )


def write(name, size, body, png, opaque=False):
    BRAND.mkdir(exist_ok=True)
    source = BRAND / f"{name}.svg"
    source.write_text(svg(size, body))
    # Render at 4x, then downsample: smoother edges than the renderer's own AA.
    # The iOS icon must have no alpha channel (App Store rule).
    alpha = ["-alpha", "remove", "-alpha", "off"] if opaque else []
    subprocess.run(
        ["magick", "-background", "none", "-density", str(72 * 4), str(source),
         "-resize", f"{size}x{size}", *alpha, "-strip",
         f"PNG24:{png}" if opaque else f"PNG32:{png}"],
        check=True,
    )


def glyph_by_height(center, height):
    """Scale so the glyph's bbox is `height` tall (notification icon rule)."""
    return glyph_path(center, center, height / (Y_MAX - Y_MIN))


# (1) iOS app icon: 1024 opaque, full-bleed gold, the G at font-size 512.
write("app-icon", 1024,
      f'<rect width="1024" height="1024" fill="{GOLD}"/>'
      f'<path d="{glyph_path(512, 512, font_size_scale(512))}" fill="{INK}"/>',
      ASSETS / "icon.png", opaque=True)

# (2) Android adaptive foreground: transparent 108dp (432 px), G at 36dp = 144 px.
#     The background is the solid colour #FFC21A in app.config.js.
write("android-icon-foreground", 432,
      f'<path d="{glyph_path(216, 216, font_size_scale(144))}" fill="{INK}"/>',
      ASSETS / "android-icon-foreground.png")

# Android 13 themed icon: the same G as the foreground, as a white silhouette.
write("android-icon-monochrome", 432,
      f'<path d="{glyph_path(216, 216, font_size_scale(144))}" fill="{WHITE}"/>',
      ASSETS / "android-icon-monochrome.png")

# (3) Notification icon: white G on transparent, 24dp box, glyph 18dp tall
#     (96 px at xxxhdpi, glyph 72 px). Tinted gold at runtime.
write("notification-icon", 96,
      f'<path d="{glyph_by_height(48, 72)}" fill="{WHITE}"/>',
      ASSETS / "notification-icon.png")

# (4) Splash: the G tile, 52pt at 3x = 156 px, radius 16pt = 48 px, G 26pt = 78 px.
write("splash-tile", 156,
      f'<rect width="156" height="156" rx="48" ry="48" fill="{GOLD}"/>'
      f'<path d="{glyph_path(78, 78, font_size_scale(78))}" fill="{INK}"/>',
      ASSETS / "splash-icon.png")

print("glyph bbox (font units):", X_MIN, Y_MIN, X_MAX, Y_MAX, "upm", UPM)
