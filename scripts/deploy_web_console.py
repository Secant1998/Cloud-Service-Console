from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
import tarfile
from pathlib import Path

import paramiko


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
PACKAGE_DIR = ROOT / "build" / "cloud-service-console-web"
ARCHIVE_PATH = ROOT / "build" / "cloud-service-console-web.tar.gz"
LOGIN_SETTINGS_PATH = Path(os.environ.get("LOCALAPPDATA", "")) / "CloudServiceConsole" / "cloud-console-login.json"

REMOTE_HOST = os.environ.get("CLOUD_CONSOLE_DEPLOY_HOST", "43.154.250.82")
REMOTE_USER = os.environ.get("CLOUD_CONSOLE_DEPLOY_USER", "ubuntu")
REMOTE_BASE = os.environ.get("CLOUD_CONSOLE_WEB_REMOTE_BASE", "/opt/cloud-service-console-web")
REMOTE_PORT = int(os.environ.get("CLOUD_CONSOLE_WEB_PORT", "18080"))
SERVICE_NAME = os.environ.get("CLOUD_CONSOLE_WEB_SERVICE", "cloud-service-console-web")
CONTROL_SIGNAL_ENV = os.environ.get(
    "CLOUD_CONSOLE_CONTROL_SIGNAL_ENV",
    "/opt/go2rtc-cloud/control-signaling.env",
)


def run(command: list[str], cwd: Path | None = None) -> None:
    print("+", " ".join(command))
    subprocess.run(command, cwd=str(cwd or ROOT), check=True)


def read_saved_login() -> dict[str, str]:
    if not LOGIN_SETTINGS_PATH.exists():
        raise RuntimeError(f"Saved login settings not found: {LOGIN_SETTINGS_PATH}")
    payload = json.loads(LOGIN_SETTINGS_PATH.read_text(encoding="utf-8"))
    host = str(payload.get("host") or "").strip()
    username = str(payload.get("username") or REMOTE_USER).strip() or REMOTE_USER
    password = str(payload.get("password") or "")
    if not host or not password:
        raise RuntimeError("Saved login settings must include host and remembered password.")
    return {"host": host, "username": username, "password": password}


def copy_tree(source: Path, destination: Path, ignore: set[str] | None = None) -> None:
    ignore = ignore or set()
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(
        source,
        destination,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", *ignore),
    )


def build_package(saved: dict[str, str]) -> None:
    run(["cmd", "/c", "npm.cmd", "run", "build"], cwd=FRONTEND_DIR)

    if PACKAGE_DIR.exists():
        shutil.rmtree(PACKAGE_DIR)
    PACKAGE_DIR.mkdir(parents=True)
    copy_tree(BACKEND_DIR, PACKAGE_DIR / "backend", ignore={"build", "dist", "*.spec"})
    copy_tree(DIST_DIR, PACKAGE_DIR / "frontend" / "dist")

    storage_dir = PACKAGE_DIR / "bootstrap-storage"
    storage_dir.mkdir(parents=True)
    login_payload = {
        "host": saved["host"],
        "username": saved["username"],
        "password": saved["password"],
        "remember_password": True,
        "auto_login": True,
        "saved_accounts": [
            {
                "host": saved["host"],
                "username": saved["username"],
                "password": saved["password"],
                "remember_password": True,
                "auto_login": True,
            }
        ],
    }
    (storage_dir / "cloud-console-login.json").write_text(json.dumps(login_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    env_text = "\n".join(
        [
            "CLOUD_CONSOLE_WEB_MODE=1",
            "CLOUD_CONSOLE_BACKEND_HOST=0.0.0.0",
            f"CLOUD_CONSOLE_BACKEND_PORT={REMOTE_PORT}",
            f"CLOUD_CONSOLE_STORAGE_DIR={REMOTE_BASE}/storage",
            f"CLOUD_CONSOLE_FRONTEND_DIST={REMOTE_BASE}/frontend/dist",
            f"CLOUD_CONSOLE_DEFAULT_HOST={saved['host']}",
            f"CLOUD_CONSOLE_DEFAULT_SSH_USER={saved['username']}",
            "# Optional dedicated machine-to-cloud capture token. Existing Frontend/Compute signal tokens are also accepted.",
            "TELEBOT_CAPTURE_UPLOAD_TOKEN=",
            "TELEBOT_FRONTEND_SIGNAL_TOKEN=",
            "",
        ]
    )
    (PACKAGE_DIR / "cloud-console-web.env").write_text(env_text, encoding="utf-8", newline="\n")
    (PACKAGE_DIR / "README.web-deploy.txt").write_text(
        "Cloud Service Console web deployment package. Runs on an isolated port and service name.\n",
        encoding="utf-8",
    )

    ARCHIVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ARCHIVE_PATH.exists():
        ARCHIVE_PATH.unlink()
    with tarfile.open(ARCHIVE_PATH, "w:gz") as archive:
        archive.add(PACKAGE_DIR, arcname="cloud-service-console-web")


def connect(saved: dict[str, str]) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=REMOTE_HOST,
        username=saved["username"],
        password=saved["password"],
        look_for_keys=False,
        allow_agent=False,
        timeout=12,
        banner_timeout=12,
        auth_timeout=12,
    )
    return client


def remote_run(client: paramiko.SSHClient, command: str, timeout: int = 120) -> str:
    print("$", command)
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="ignore").strip()
    err = stderr.read().decode("utf-8", errors="ignore").strip()
    code = stdout.channel.recv_exit_status()
    if code:
        raise RuntimeError("\n".join(part for part in [out, err] if part) or f"Remote command failed: {code}")
    if out:
        print(out)
    if err:
        print(err)
    return "\n".join(part for part in [out, err] if part)


def upload_archive(client: paramiko.SSHClient) -> str:
    remote_archive = f"/tmp/{ARCHIVE_PATH.name}"
    print("upload", ARCHIVE_PATH, "->", remote_archive)
    with client.open_sftp() as sftp:
        sftp.put(str(ARCHIVE_PATH), remote_archive)
    return remote_archive


def deploy_remote(client: paramiko.SSHClient, remote_archive: str) -> None:
    quoted_base = shlex.quote(REMOTE_BASE)
    quoted_service = shlex.quote(SERVICE_NAME)
    quoted_archive = shlex.quote(remote_archive)
    quoted_port = shlex.quote(str(REMOTE_PORT))
    script = f"""
set -euo pipefail
BASE={quoted_base}
SERVICE={quoted_service}
PORT={quoted_port}
if ss -ltn | awk '{{print $4}}' | grep -Eq '(^|:)'"$PORT"'$'; then
  current_unit="$(systemctl list-units --type=service --all --no-legend 2>/dev/null | awk '/{SERVICE_NAME}/ {{print $1; exit}}' || true)"
  if [ "$current_unit" != "{SERVICE_NAME}.service" ]; then
    echo "Port $PORT is already in use by another service." >&2
    exit 7
  fi
fi
sudo mkdir -p "$BASE"
TMP_DIR="$(mktemp -d)"
PRESERVED_SIGNAL_ENV="$(mktemp)"
tar -xzf {quoted_archive} -C "$TMP_DIR"
sudo mkdir -p "$BASE/storage"
if [ -d "$BASE/backend" ] && [ -d "$BASE/frontend" ]; then
  sudo mkdir -p "$BASE/backups"
  sudo tar -czf "$BASE/backups/console-before-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" -C "$BASE" backend frontend cloud-console-web.env
  sudo chmod 0600 "$BASE"/backups/*.tar.gz
fi
if [ -f "$BASE/cloud-console-web.env" ]; then
  grep -E '^(TELEBOT_CONTROL_SIGNAL_BASE_URL|TELEBOT_SIGNAL_ADMIN_TOKEN|TELEBOT_FRONTEND_SIGNAL_TOKEN|TELEBOT_COMPUTE_SIGNAL_TOKEN|TELEBOT_CAPTURE_UPLOAD_TOKEN)=' \
    "$BASE/cloud-console-web.env" > "$PRESERVED_SIGNAL_ENV" || true
fi
sudo rm -rf "$BASE/backend" "$BASE/frontend" "$BASE/bootstrap-storage" "$BASE/cloud-console-web.env" "$BASE/README.web-deploy.txt"
sudo cp -a "$TMP_DIR/cloud-service-console-web/backend" "$BASE/backend"
sudo cp -a "$TMP_DIR/cloud-service-console-web/frontend" "$BASE/frontend"
sudo cp -a "$TMP_DIR/cloud-service-console-web/cloud-console-web.env" "$BASE/cloud-console-web.env"
if [ -s "$PRESERVED_SIGNAL_ENV" ]; then
  sudo tee -a "$BASE/cloud-console-web.env" < "$PRESERVED_SIGNAL_ENV" >/dev/null
fi
sudo chmod 0600 "$BASE/cloud-console-web.env"
sudo cp -a "$TMP_DIR/cloud-service-console-web/README.web-deploy.txt" "$BASE/README.web-deploy.txt"
if [ ! -f "$BASE/storage/cloud-console-login.json" ]; then
  sudo cp -a "$TMP_DIR/cloud-service-console-web/bootstrap-storage/cloud-console-login.json" "$BASE/storage/cloud-console-login.json"
fi
rm -rf "$TMP_DIR" "$PRESERVED_SIGNAL_ENV"
sudo chown -R {shlex.quote(REMOTE_USER)}:{shlex.quote(REMOTE_USER)} "$BASE"
python3 -m venv "$BASE/.venv"
"$BASE/.venv/bin/python" -m pip install --upgrade pip >/dev/null
"$BASE/.venv/bin/python" -m pip install -r "$BASE/backend/requirements.txt" >/dev/null
sudo "$BASE/.venv/bin/python" -m playwright install-deps chromium >/dev/null
"$BASE/.venv/bin/python" -m playwright install chromium >/dev/null
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
sudo tee /etc/systemd/system/{SERVICE_NAME}.service >/dev/null <<UNIT
[Unit]
Description=Cloud Service Console Web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={REMOTE_USER}
WorkingDirectory=$BASE/backend
EnvironmentFile=$BASE/cloud-console-web.env
EnvironmentFile=-{CONTROL_SIGNAL_ENV}
EnvironmentFile=-/opt/webrtc-p2p-video/p2p-v2-auth.env
ExecStart=$BASE/.venv/bin/python launcher.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now {SERVICE_NAME}.service >/dev/null
sudo systemctl restart {SERVICE_NAME}.service
sleep 2
systemctl is-active {SERVICE_NAME}.service
set -a
. "$BASE/cloud-console-web.env"
set +a
curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null
"""
    remote_run(client, script, timeout=420)


def main() -> None:
    saved = read_saved_login()
    if saved["host"] != REMOTE_HOST:
        raise RuntimeError(f"Saved host {saved['host']} does not match deploy host {REMOTE_HOST}.")
    build_package(saved)
    client = connect(saved)
    try:
        before = remote_run(
            client,
            "systemctl is-active go2rtc-cloud go2rtc-control-signaling go2rtc-telemetry-relay go2rtc-srt-bridge nginx coturn 2>/dev/null || true",
            timeout=30,
        )
        remote_archive = upload_archive(client)
        deploy_remote(client, remote_archive)
        after = remote_run(
            client,
            "systemctl is-active go2rtc-cloud go2rtc-control-signaling go2rtc-telemetry-relay go2rtc-srt-bridge nginx coturn 2>/dev/null || true",
            timeout=30,
        )
    finally:
        client.close()

    print("\nExisting chain services before:")
    print(before)
    print("\nExisting chain services after:")
    print(after)
    print("\nWeb console URL:")
    print("https://console.cityulive.com/")


if __name__ == "__main__":
    main()
