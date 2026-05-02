from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def validate_version(value: str) -> str:
    if not re.fullmatch(r"\d+\.\d+\.\d+", value):
        raise SystemExit(f"Unsupported version format: {value!r}")
    return value


def update_json(path: Path, version: str, key_chain: tuple[str, ...]) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    target = payload
    for key in key_chain[:-1]:
        target = target[key]
    target[key_chain[-1]] = version
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_cargo_toml(path: Path, version: str) -> None:
    content = path.read_text(encoding="utf-8")
    updated, count = re.subn(r'(?m)^version = "[^"]+"$', f'version = "{version}"', content, count=1)
    if count != 1:
        raise SystemExit(f"Unable to update version in {path}")
    path.write_text(updated, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/update_versions.py <semver>")

    version = validate_version(sys.argv[1].strip())

    update_json(ROOT / "package.json", version, ("version",))
    update_json(ROOT / "frontend" / "package.json", version, ("version",))
    update_json(ROOT / "frontend" / "package-lock.json", version, ("version",))
    update_json(ROOT / "frontend" / "package-lock.json", version, ("packages", "", "version"))
    update_json(ROOT / "src-tauri" / "tauri.conf.json", version, ("package", "version"))
    update_cargo_toml(ROOT / "src-tauri" / "Cargo.toml", version)

    print(version)


if __name__ == "__main__":
    main()
