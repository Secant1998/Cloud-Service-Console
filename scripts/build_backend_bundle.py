from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"
WEB_CONSOLE_BUNDLE_DIR = BACKEND_DIR / "web_console_bundle"
BUNDLE_DIR = ROOT / "src-tauri" / "binaries"
RELEASE_DIR = ROOT / "src-tauri" / "target" / "release"
DIST_DIR = BACKEND_DIR / "dist"
BUILD_DIR = BACKEND_DIR / "build"
SPEC_FILE = BACKEND_DIR / "cloud-console-backend.spec"
BASE_NAME = "cloud-console-backend"
TARGET_TRIPLE = "x86_64-pc-windows-msvc"
OUTPUT_NAME = f"{BASE_NAME}-{TARGET_TRIPLE}"


def main() -> None:
    BUNDLE_DIR.mkdir(parents=True, exist_ok=True)
    if not (FRONTEND_DIST_DIR / "index.html").is_file():
        raise RuntimeError(f"Frontend dist is missing. Run npm build first: {FRONTEND_DIST_DIR}")

    for path in [
        DIST_DIR,
        BUILD_DIR,
        SPEC_FILE,
        WEB_CONSOLE_BUNDLE_DIR,
        BUNDLE_DIR / "config",
        BUNDLE_DIR / "data",
        RELEASE_DIR / "config",
        RELEASE_DIR / "data",
    ]:
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()

    shutil.copytree(
        BACKEND_DIR,
        WEB_CONSOLE_BUNDLE_DIR / "backend",
        ignore=shutil.ignore_patterns(
            "__pycache__",
            "*.pyc",
            "build",
            "dist",
            "*.spec",
            "web_console_bundle",
        ),
    )
    shutil.copytree(FRONTEND_DIST_DIR, WEB_CONSOLE_BUNDLE_DIR / "frontend" / "dist")

    pyinstaller_cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        OUTPUT_NAME,
        "--distpath",
        str(DIST_DIR),
        "--workpath",
        str(BUILD_DIR),
        "--specpath",
        str(BACKEND_DIR),
        "--add-data",
        f"{BACKEND_DIR / 'requirements.txt'};.",
        "--add-data",
        f"{BACKEND_DIR / 'cloud_setup_bundle'};cloud_setup_bundle",
        "--add-data",
        f"{WEB_CONSOLE_BUNDLE_DIR};web_console_bundle",
        str(BACKEND_DIR / "launcher.py"),
    ]
    subprocess.run(pyinstaller_cmd, check=True, cwd=str(BACKEND_DIR))

    built_exe = DIST_DIR / f"{OUTPUT_NAME}.exe"
    if not built_exe.exists():
        raise RuntimeError(f"PyInstaller output not found: {built_exe}")

    target_exe = BUNDLE_DIR / built_exe.name
    shutil.copy2(built_exe, target_exe)

    if WEB_CONSOLE_BUNDLE_DIR.exists():
        shutil.rmtree(WEB_CONSOLE_BUNDLE_DIR)

    print(target_exe)


if __name__ == "__main__":
    main()
