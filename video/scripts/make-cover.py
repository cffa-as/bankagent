from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
SOURCE = PROJECT / "frontend" / "public" / "product" / "workspace-assistant.png"
TARGET_COVER = PROJECT / "frontend" / "public" / "demo" / "vaultline-product-cover.png"
TARGET_POSTER = PROJECT / "frontend" / "public" / "demo" / "vaultline-product-poster.png"

NAVY = "#07111F"
PANEL = "#0B182A"
WHITE = "#F6F8FC"
PLATINUM = "#DCE4EF"
STEEL = "#8594AA"
COBALT = "#315BFF"
TEAL = "#25B394"


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError:
        return ImageFont.load_default(size=size)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


canvas = Image.new("RGB", (1920, 1080), NAVY)
draw = ImageDraw.Draw(canvas)

# Quiet ledger grid; structural, not decorative.
for x in range(80, 1840, 120):
    draw.line((x, 0, x, 1080), fill="#0E1D31", width=1)
for y in range(80, 1080, 120):
    draw.line((0, y, 1920, y), fill="#0E1D31", width=1)

# Reserve mark and wordmark.
cx, cy, radius = 166, 138, 36
draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=WHITE)
draw.line([(cx - 23, cy - 26), (cx + 2, cy + 18), (cx + 27, cy - 26)], fill=NAVY, width=8, joint="curve")
draw.rectangle((cx + 17, cy + 18, cx + 25, cy + 26), fill=COBALT)

display = font("/System/Library/Fonts/Supplemental/Songti.ttc", 78, 1)
sans_bold = font("/System/Library/Fonts/SFNS.ttf", 42)
sans = font("/System/Library/Fonts/Hiragino Sans GB.ttc", 25)
small = font("/System/Library/Fonts/Hiragino Sans GB.ttc", 18)
mono = font("/System/Library/Fonts/SFNSMono.ttf", 17)

draw.text((220, 106), "VAULTLINE", font=sans_bold, fill=WHITE, anchor="lm")
draw.text((222, 151), "安全 AI 银行工作台", font=small, fill=STEEL, anchor="lm")
draw.text((1504, 106), "FULL PRODUCT FILM / 03:02", font=mono, fill=STEEL, anchor="rm")

draw.text((120, 322), "让银行业务", font=display, fill=WHITE, anchor="lt")
draw.text((120, 415), "一句话开始。", font=display, fill=WHITE, anchor="lt")
draw.text((124, 552), "理解意图，治理执行，证明结果。", font=sans, fill=PLATINUM, anchor="lt")
draw.text((124, 604), "真实前端 · 真实 Go API · 合成演示数据", font=small, fill=STEEL, anchor="lt")

draw.line((124, 684, 680, 684), fill="#263B55", width=2)
for x, color, label in (
    (124, TEAL, "只读查询"),
    (318, "#D7A04A", "确认 / MFA"),
    (538, COBALT, "业务回执"),
):
    draw.ellipse((x, 679, x + 10, 689), fill=color)
    draw.text((x + 20, 684), label, font=small, fill=PLATINUM, anchor="lm")

# Product screenshot as the primary proof surface.
screen = Image.open(SOURCE).convert("RGB")
screen_width = 980
screen_height = round(screen.height * screen_width / screen.width)
screen = screen.resize((screen_width, screen_height), Image.Resampling.LANCZOS)
screen_x, screen_y = 810, 212
frame = (screen_x - 12, screen_y - 12, screen_x + screen_width + 12, screen_y + screen_height + 12)

shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(
    (frame[0] + 14, frame[1] + 22, frame[2] + 14, frame[3] + 22),
    radius=12,
    fill=(0, 0, 0, 120),
)
canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow).convert("RGB")
draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle(frame, radius=10, fill=PANEL, outline="#2A405B", width=1)
canvas.paste(screen, (screen_x, screen_y), rounded_mask(screen.size, 5))

# The video player adds its own play control, so the poster remains artwork-only.
canvas.save(TARGET_POSTER, optimize=True)

# README cover play affordance.
button_center = (screen_x + 84, screen_y + screen_height - 76)
draw.ellipse(
    (
        button_center[0] - 30,
        button_center[1] - 30,
        button_center[0] + 30,
        button_center[1] + 30,
    ),
    fill=WHITE,
)
draw.polygon(
    [
        (button_center[0] - 7, button_center[1] - 12),
        (button_center[0] - 7, button_center[1] + 12),
        (button_center[0] + 13, button_center[1]),
    ],
    fill=COBALT,
)
draw.text(
    (screen_x + 130, screen_y + screen_height - 84),
    "播放完整演示",
    font=small,
    fill=WHITE,
    anchor="lm",
)
draw.text(
    (screen_x + 130, screen_y + screen_height - 55),
    "REAL WORKBENCH / SERVER-GOVERNED",
    font=mono,
    fill=STEEL,
    anchor="lm",
)

draw.text((1840, 1020), "VAULTLINE · UNDERSTAND / GOVERN / PROVE", font=mono, fill=STEEL, anchor="rb")
canvas.save(TARGET_COVER, optimize=True)
print(f"wrote {TARGET_POSTER}")
print(f"wrote {TARGET_COVER}")
