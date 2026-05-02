from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    size = 512
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((24, 24, size - 24, size - 24), radius=110, fill=(20, 35, 86, 255))
    draw.rounded_rectangle((64, 64, size - 64, size - 64), radius=96, fill=(37, 99, 235, 255))
    draw.ellipse((114, 108, 398, 392), fill=(255, 255, 255, 38))
    draw.rounded_rectangle((132, 152, 380, 360), radius=64, outline=(255, 255, 255, 200), width=18)
    draw.line((170, 210, 342, 210), fill=(255, 255, 255, 225), width=18)
    draw.line((170, 256, 300, 256), fill=(191, 219, 254, 255), width=18)
    draw.line((170, 302, 260, 302), fill=(191, 219, 254, 255), width=18)
    draw.ellipse((320, 286, 362, 328), fill=(52, 211, 153, 255))

    image.save(ICON_DIR / "app-icon.png")
    image.save(ICON_DIR / "icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])


if __name__ == "__main__":
    main()
