from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NSIS_DIR = ROOT / "src-tauri" / "target" / "release" / "nsis" / "x64"
INSTALLER_NSI = NSIS_DIR / "installer.nsi"
NSIS_OUTPUT = NSIS_DIR / "nsis-output.exe"
DIST_DIR = ROOT / "src-tauri" / "target" / "release" / "bundle" / "nsis"
RELEASE_DIR = ROOT / "src-tauri" / "target" / "release"
APP_EXE = RELEASE_DIR / "Cloud Service Console.exe"
SIDECAR_EXE = RELEASE_DIR / "cloud-console-backend.exe"
DEST_DIR = Path(r"E:\Cloud-Service-Console")
AUTO_UNINSTALL_MARKER = "; Cloud Service Console auto-uninstall previous install"


def run(command: list[str], cwd: Path = ROOT) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def load_version() -> str:
    with (ROOT / "package.json").open("r", encoding="utf-8") as fp:
        return str(json.load(fp)["version"])


def find_makensis() -> Path:
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "tauri" / "NSIS" / "makensis.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "tauri" / "NSIS" / "Bin" / "makensis.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    resolved = shutil.which("makensis.exe")
    if resolved:
        return Path(resolved)
    raise RuntimeError("makensis.exe was not found. Run a normal Tauri NSIS build once so Tauri installs NSIS.")


def read_text_with_encoding(path: Path) -> tuple[str, str]:
    data = path.read_bytes()
    if data.startswith(b"\xff\xfe"):
        return data.decode("utf-16"), "utf-16"
    if data.startswith(b"\xfe\xff"):
        return data.decode("utf-16"), "utf-16"
    if data.startswith(b"\xef\xbb\xbf"):
        return data.decode("utf-8-sig"), "utf-8-sig"
    return data.decode("utf-8"), "utf-8"


def inject_auto_uninstall(nsi_path: Path) -> bool:
    text, encoding = read_text_with_encoding(nsi_path)
    if AUTO_UNINSTALL_MARKER in text:
        return False

    page_line = "Page custom PageReinstall PageLeaveReinstall"
    if page_line in text:
        text = text.replace(page_line, f"; {page_line} ; replaced by automatic uninstall", 1)

    function_block = f"""{AUTO_UNINSTALL_MARKER}
Function AutoUninstallPreviousInstall
  ClearErrors
  ReadRegStr $4 SHCTX "${{MANUPRODUCTKEY}}" ""
  ReadRegStr $R1 SHCTX "${{UNINSTKEY}}" "UninstallString"
  ${{If}} "$R1" == ""
    Return
  ${{EndIf}}

  DetailPrint "Uninstalling previous ${{PRODUCTNAME}} before installing..."
  ExecWait '$R1 /S /P _?=$4' $0
  ${{IfThen}} ${{Errors}} ${{|}} StrCpy $0 2 ${{|}}

  ${{If}} $0 <> 0
  ${{OrIf}} ${{FileExists}} "$INSTDIR\\${{MAINBINARYNAME}}.exe"
    MessageBox MB_ICONEXCLAMATION "Unable to uninstall the previous ${{PRODUCTNAME}}. Please close the app and run this installer again."
    Abort
  ${{EndIf}}

  StrCpy $0 $R1 1
  ${{IfThen}} $0 == '"' ${{|}} StrCpy $R1 $R1 -1 1 ${{|}}
  Delete $R1
  RMDir $INSTDIR
FunctionEnd

"""
    section_start = "Section EarlyChecks\r\n"
    section_start_lf = "Section EarlyChecks\n"
    if section_start in text:
        text = text.replace(section_start, f"{section_start}  Call AutoUninstallPreviousInstall\r\n", 1)
    elif section_start_lf in text:
        text = text.replace(section_start_lf, f"{section_start_lf}  Call AutoUninstallPreviousInstall\n", 1)
    else:
        raise RuntimeError("Could not find Section EarlyChecks in installer.nsi")

    insert_before = "Section EarlyChecks"
    text = text.replace(insert_before, f"{function_block}{insert_before}", 1)
    nsi_path.write_text(text, encoding=encoding, newline="")
    return True


def main() -> int:
    version = load_version()
    setup_name = f"Cloud Service Console_{version}_x64-setup.exe"
    setup_path = DIST_DIR / setup_name

    run(["cmd", "/c", "frontend\\node_modules\\.bin\\tauri.cmd", "build", "--config", "src-tauri/tauri.conf.json"])

    if not INSTALLER_NSI.is_file():
        raise RuntimeError(f"Generated NSIS script not found: {INSTALLER_NSI}")
    inject_auto_uninstall(INSTALLER_NSI)

    makensis = find_makensis()
    if NSIS_OUTPUT.exists():
        NSIS_OUTPUT.unlink()
    run([str(makensis), str(INSTALLER_NSI)], cwd=NSIS_DIR)
    if not NSIS_OUTPUT.is_file():
        raise RuntimeError(f"NSIS output not found: {NSIS_OUTPUT}")

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(NSIS_OUTPUT, setup_path)
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    if not APP_EXE.is_file():
        raise RuntimeError(f"App executable not found: {APP_EXE}")
    if not SIDECAR_EXE.is_file():
        raise RuntimeError(f"Backend sidecar not found: {SIDECAR_EXE}")
    shutil.copy2(APP_EXE, DEST_DIR / "Cloud Service Console.exe")
    shutil.copy2(SIDECAR_EXE, DEST_DIR / "cloud-console-backend.exe")
    shutil.copy2(setup_path, DEST_DIR / "Cloud Service Console Setup.exe")
    print(f"Installer ready: {setup_path}")
    print(f"Copied to: {DEST_DIR / 'Cloud Service Console.exe'}")
    print(f"Copied to: {DEST_DIR / 'cloud-console-backend.exe'}")
    print(f"Copied to: {DEST_DIR / 'Cloud Service Console Setup.exe'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
