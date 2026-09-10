"""Make official SomReception PNGs transparent without altering artwork.

Root cause: both approved rasters are opaque RGB with a baked-in black canvas.
This keys only achromatic near-black pixels connected to the image edge.
Navy / gold / tagline pixels are not luminance-keyed.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "frontend" / "public" / "brand"
PUBLIC = ROOT / "frontend" / "public"

NAVY = (13, 27, 75, 255)  # #0D1B4B
WHITE = (255, 255, 255, 255)
AMBER = (245, 158, 11, 255)


def is_canvas_black(r: int, g: int, b: int) -> bool:
    """True only for achromatic near-black. Navy has a high blue channel."""
    return r <= 18 and g <= 18 and b <= 22


def flood_key_black(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    bg = [[False] * w for _ in range(h)]
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if visited[y][x]:
            return
        visited[y][x] = True
        r, g, b, _a = px[x, y]
        if is_canvas_black(r, g, b):
            bg[y][x] = True
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                visited[ny][nx] = True
                r, g, b, _a = px[nx, ny]
                if is_canvas_black(r, g, b):
                    bg[ny][nx] = True
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                r, g, b, _a = px[x, y]
                px[x, y] = (r, g, b, 0)

    # Soften anti-aliased black/gray fringe next to the keyed canvas only.
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            chroma = max(r, g, b) - min(r, g, b)
            if chroma >= 22 or max(r, g, b) >= 48:
                continue
            neighbor_bg = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and bg[ny][nx]:
                    neighbor_bg = True
                    break
            if not neighbor_bg:
                continue
            lum = (r + g + b) / 3
            alpha = int(max(0, min(255, round(255 * lum / 40))))
            px[x, y] = (r, g, b, alpha)

    return rgba


def trim_transparent(im: Image.Image, pad: int) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(im.width, right + pad)
    bottom = min(im.height, bottom + pad)
    return im.crop((left, top, right, bottom))


def fit_square(src: Image.Image, size: int, bg: tuple[int, int, int, int] | None, pad: int = 0) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg if bg is not None else (0, 0, 0, 0))
    inner = size - pad * 2
    fitted = src.copy()
    fitted.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def load_font(size: int) -> ImageFont.ImageFont:
    for path in (
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_og(logo: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1200, 630), WHITE)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 1200, 8), fill=AMBER)

    lockup = logo.copy()
    lockup.thumbnail((780, 280), Image.Resampling.LANCZOS)
    x = (1200 - lockup.width) // 2
    y = 150
    canvas.paste(lockup, (x, y), lockup)

    font = load_font(28)
    tagline = "AI Receptionist for Modern Businesses"
    bbox = draw.textbbox((0, 0), tagline, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((1200 - tw) // 2, 470), tagline, font=font, fill=(13, 27, 75, 255))
    return canvas.convert("RGB")


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)

    logo_src = Image.open(BRAND / "somreception-logo.png")
    icon_src = Image.open(BRAND / "somreception-icon.png")
    print("input logo", logo_src.size, logo_src.mode)
    print("input icon", icon_src.size, icon_src.mode)

    logo = trim_transparent(flood_key_black(logo_src), pad=16)
    icon = trim_transparent(flood_key_black(icon_src), pad=12)

    logo.save(BRAND / "somreception-logo.png", "PNG", optimize=True)
    icon.save(BRAND / "somreception-icon.png", "PNG", optimize=True)
    print("output logo", logo.size, logo.mode, "bbox", logo.getbbox())
    print("output icon", icon.size, icon.mode, "bbox", icon.getbbox())

    for size, name in (
        (16, "favicon-16.png"),
        (32, "favicon-32.png"),
        (48, "favicon-48.png"),
        (64, "favicon-64.png"),
        (96, "shortcut-96.png"),
        (192, "pwa-192.png"),
        (512, "pwa-512.png"),
    ):
        out = fit_square(icon, size, bg=None, pad=max(1, size // 32))
        out.save(BRAND / name, "PNG", optimize=True)

    for size, name in (
        (152, "apple-touch-icon-152.png"),
        (167, "apple-touch-icon-167.png"),
        (180, "apple-touch-icon.png"),
    ):
        out = fit_square(icon, size, bg=NAVY, pad=size // 8)
        out.convert("RGB").save(BRAND / name, "PNG", optimize=True)

    for size, name in ((192, "pwa-maskable-192.png"), (512, "pwa-maskable-512.png")):
        out = fit_square(icon, size, bg=NAVY, pad=int(size * 0.18))
        out.convert("RGB").save(BRAND / name, "PNG", optimize=True)

    ico_16 = fit_square(icon, 16, bg=None, pad=1)
    ico_32 = fit_square(icon, 32, bg=None, pad=1)
    ico_48 = fit_square(icon, 48, bg=None, pad=1)
    ico_32.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[ico_16, ico_48],
    )
    fit_square(icon, 32, bg=None, pad=1).save(PUBLIC / "favicon.png", "PNG", optimize=True)
    fit_square(icon, 180, bg=NAVY, pad=22).convert("RGB").save(
        PUBLIC / "apple-touch-icon.png", "PNG", optimize=True
    )

    make_og(logo).save(BRAND / "og-image.png", "PNG", optimize=True)
    print("derivatives written")


if __name__ == "__main__":
    main()
