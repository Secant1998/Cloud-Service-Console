from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
SOURCE = ICON_DIR / "source.jpg"
WEB_ASSET_DIR = ROOT / "frontend" / "src" / "assets"
WEB_PUBLIC_DIR = ROOT / "frontend" / "public"


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    WEB_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    WEB_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as source:
        image = ImageOps.fit(ImageOps.exif_transpose(source).convert("RGBA"),
                             (512, 512), method=Image.Resampling.LANCZOS)
    image.save(ICON_DIR / "app-icon.png", optimize=True)
    image.save(ICON_DIR / "icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    image.resize((128, 128), Image.Resampling.LANCZOS).save(WEB_ASSET_DIR / "console-icon.png", optimize=True)
    image.save(WEB_PUBLIC_DIR / "favicon.ico", sizes=[(64, 64), (48, 48), (32, 32), (16, 16)])
    image.resize((180, 180), Image.Resampling.LANCZOS).save(WEB_ASSET_DIR / "apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    main()
