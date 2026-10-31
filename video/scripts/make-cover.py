from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "frontend" / "public" / "demo" / "vaultline-preview-poster.png"
TARGET = ROOT.parent / "frontend" / "public" / "demo" / "vaultline-preview-cover.png"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default(size=size)


image = Image.open(SOURCE).convert("RGBA")
overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

button_x, button_y, button_size = 252, 430, 116
draw.rectangle(
    (button_x, button_y, button_x + button_size, button_y + button_size),
    fill=(5, 10, 18, 150),
    outline=(230, 238, 250, 145),
    width=1,
)
draw.polygon(
    [
        (button_x + 45, button_y + 34),
        (button_x + 45, button_y + 82),
        (button_x + 84, button_y + 58),
    ],
    fill=(93, 124, 255, 255),
)

label_font = font("/System/Library/Fonts/SFNSMono.ttf", 15)
caption_font = font("/System/Library/Fonts/SFNSMono.ttf", 12)
draw.text(
    (button_x - 32, button_y + 146),
    "PLAY PRODUCT PREVIEW",
    fill=(232, 239, 248, 235),
    font=label_font,
)
draw.text(
    (button_x - 32, button_y + 174),
    "00:22  ·  REAL UI  ·  SYNTHETIC DATA",
    fill=(117, 135, 160, 230),
    font=caption_font,
)

Image.alpha_composite(image, overlay).convert("RGB").save(TARGET, optimize=True)
print(f"wrote {TARGET}")
