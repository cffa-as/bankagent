from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT.parent
POSTER = PROJECT / "frontend" / "public" / "demo" / "vaultline-launch-poster.png"
COVER = PROJECT / "frontend" / "public" / "demo" / "vaultline-launch-cover.png"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default(size=size)


image = Image.open(POSTER).convert("RGBA")
overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

cx, cy, radius = 960, 792, 58
draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(7, 17, 31, 232), outline=(246, 248, 252, 210), width=2)
draw.polygon(
    [(cx - 13, cy - 24), (cx - 13, cy + 24), (cx + 24, cy)],
    fill=(246, 248, 252, 255),
)

label = font("/System/Library/Fonts/SFNS.ttf", 22)
mono = font("/System/Library/Fonts/SFNSMono.ttf", 14)
draw.rounded_rectangle(
    (782, 872, 1138, 946),
    radius=8,
    fill=(7, 17, 31, 218),
    outline=(84, 108, 143, 180),
    width=1,
)
draw.text((960, 896), "PLAY 30s PRODUCT FILM", font=label, fill=(246, 248, 252, 255), anchor="mm")
draw.text((960, 926), "VAULTLINE / SERVER-GOVERNED", font=mono, fill=(145, 164, 190, 255), anchor="mm")

Image.alpha_composite(image, overlay).convert("RGB").save(COVER, optimize=True)
print(f"wrote {COVER}")
