from __future__ import annotations

import base64
import hashlib
import http.client
import json
import os
import posixpath
import shlex
import threading
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

from cloud_client import CloudRemoteClient
from config import CloudRuntimeConfig, TANK_GAME_SERVER_PORT, TANK_GAME_SERVER_IDLE_TIMEOUT


BUNDLE_DIR_NAME = "cloud_setup_bundle"
REMOTE_BASE_DIRNAME = ".cloud-service-console"
REMOTE_ROOM_DIRNAME = "tank-trouble"
REMOTE_SCRIPT_NAME = "tank_trouble_room.py"
REMOTE_BUNDLE_MANIFEST_NAME = "bundle-manifest.json"
REMOTE_SERVICE_NAME = "cloud-service-console-tank-trouble"
PUBLIC_PATH_PREFIX = "/tank-trouble"
GAME_ASSET_DIR = "tank-trouble"
NGINX_PROXY_CONF_PATH = "/etc/nginx/conf.d/go2rtc-cloud.conf"
NGINX_FALLBACK_CONF_PATH = "/etc/nginx/conf.d/cloud-service-console-tank-trouble.conf"

_SERVER_STARTUP_WAIT = 3.0
_SERVER_STARTUP_POLL = 0.3
_SERVER_RETRY_COOLDOWN = 60.0
_SERVER_HEALTH_CACHE_SECONDS = 8.0
RUNTIME_RULESET_FEATURE = "custom_mode_rules_v30"
CLEAN_DEPLOY_FEATURE = "clean_deploy"
REQUIRED_RUNTIME_FEATURES = ("land_mine", "custom_mode", "tank_health", "heal_powerup", "guided_missile", "tow_missile", RUNTIME_RULESET_FEATURE)


class TankTroubleCloudBridge:
    def __init__(self, config: CloudRuntimeConfig) -> None:
        self.config = config
        self.bundle_root = Path(__file__).resolve().parent / BUNDLE_DIR_NAME
        self.local_script_path = self.bundle_root / REMOTE_SCRIPT_NAME
        self.remote_base = f"/home/{config.ssh_user}/{REMOTE_BASE_DIRNAME}/{REMOTE_ROOM_DIRNAME}"
        self.remote_script_path = posixpath.join(self.remote_base, REMOTE_SCRIPT_NAME)
        self.remote_manifest_path = posixpath.join(self.remote_base, REMOTE_BUNDLE_MANIFEST_NAME)
        self._server_base_url: str | None = None
        self._server_confirmed_reachable = False
        self._server_health_checked_at = 0.0
        self._server_last_fail_time: float = 0.0
        self._script_uploaded = False
        self._latency_http_local = threading.local()
        self._latency_http_generation = 0
        self._latency_http_generation_lock = threading.Lock()

    def sync_room(
        self,
        client: CloudRemoteClient,
        *,
        room: str,
        player_id: str,
        country_code: str,
        preferred_color: str = "",
    ) -> dict[str, object]:
        return self._run_action(
            client,
            action="sync",
            room=room,
            player_id=player_id,
            country_code=country_code,
            preferred_color=preferred_color,
        )

    def room_status(
        self,
        client: CloudRemoteClient,
        *,
        room: str,
    ) -> dict[str, object]:
        return self._run_payload(
            client,
            {
                "action": "status",
                "room": room,
            },
        )

    def spectator_page_url(self, room: str) -> str:
        quoted_room = urllib.parse.quote(room or "main", safe="")
        return f"{self._latency_server_base_url()}/spectator.html?room={quoted_room}"

    def ensure_server(self, client: CloudRemoteClient) -> None:
        self._ensure_latency_server(client)

    def check_setup_ready(self, client: CloudRemoteClient) -> tuple[bool, str]:
        expected_hash = str(self._local_bundle_manifest()["bundle_hash"])
        script = f"""
set -e
test -f {shlex.quote(self.remote_script_path)}
test -d {shlex.quote(posixpath.join(self.remote_base, "www", GAME_ASSET_DIR))}
test -f {shlex.quote(self.remote_manifest_path)}
systemctl is-active --quiet {shlex.quote(REMOTE_SERVICE_NAME)}
test -f {shlex.quote(NGINX_PROXY_CONF_PATH)} || test -f {shlex.quote(NGINX_FALLBACK_CONF_PATH)}
export TANK_BUNDLE_MANIFEST={shlex.quote(self.remote_manifest_path)}
export TANK_BUNDLE_HASH={shlex.quote(expected_hash)}
python3 - <<'PY'
import json
import os
from pathlib import Path

path = Path(os.environ["TANK_BUNDLE_MANIFEST"])
payload = json.loads(path.read_text(encoding="utf-8") or "{{}}")
if payload.get("bundle_hash") != os.environ["TANK_BUNDLE_HASH"]:
    raise SystemExit("Tank Trouble cloud bundle is not the current desktop version.")
PY
python3 - <<'PY'
import json
import urllib.request
url = "http://127.0.0.1:{TANK_GAME_SERVER_PORT}/health"
with urllib.request.urlopen(url, timeout=2) as response:
    payload = json.loads(response.read().decode("utf-8") or "{{}}")
if not payload.get("ok"):
    raise SystemExit("Tank Trouble health check failed")
PY
curl -fsS --max-time 3 http://127.0.0.1:{self.config.api_port}{PUBLIC_PATH_PREFIX}/health >/dev/null
"""
        try:
            client.run(f"bash -lc {shlex.quote(script)}", timeout=12)
            self._get_latency_server_health(timeout=1.5)
            return True, "服务器已就绪"
        except Exception as exc:
            return False, str(exc) or "Tank Trouble server is not ready."

    def setup_server(self, client: CloudRemoteClient, *, force: bool = False) -> bool:
        if not force:
            ready, _ = self.check_setup_ready(client)
            if ready:
                return False

        self._script_uploaded = False
        if force:
            self._clean_remote_game_bundle(client)
        self.ensure_remote_script(client, force=True)
        self._ensure_nginx_installed(client)
        self._install_public_proxy(client)
        service_body = self._systemd_service()
        client.put_text(f"/tmp/{REMOTE_SERVICE_NAME}.service", service_body, encoding="ascii")
        script = f"""
set -e
sudo mv /tmp/{REMOTE_SERVICE_NAME}.service /etc/systemd/system/{REMOTE_SERVICE_NAME}.service
sudo systemctl daemon-reload
sudo systemctl enable --now {REMOTE_SERVICE_NAME}
{self._stop_orphan_listener_script()}
sudo systemctl restart {REMOTE_SERVICE_NAME}
"""
        client.run(f"bash -lc {shlex.quote(script)}", timeout=60)
        self._server_confirmed_reachable = False
        self._server_base_url = None
        self._close_latency_http_connection()
        self._wait_for_latency_server()
        return True

    def local_runtime_summary(self) -> str:
        bundle_hash = str(self._local_bundle_manifest()["bundle_hash"])
        return f"{RUNTIME_RULESET_FEATURE}, {CLEAN_DEPLOY_FEATURE}, bundle {bundle_hash[:12]}"

    def toggle_vote(
        self,
        client: CloudRemoteClient,
        *,
        room: str,
        player_id: str,
        country_code: str,
    ) -> dict[str, object]:
        return self._run_action(
            client,
            action="toggle_vote",
            room=room,
            player_id=player_id,
            country_code=country_code,
        )

    def leave_room(
        self,
        client: CloudRemoteClient,
        *,
        room: str,
        player_id: str,
        country_code: str,
    ) -> dict[str, object]:
        return self._run_action(
            client,
            action="leave",
            room=room,
            player_id=player_id,
            country_code=country_code,
        )

    def sync_latency(
        self,
        client: CloudRemoteClient,
        payload: dict[str, object],
    ) -> dict[str, object]:
        next_payload = {
            **payload,
            "action": "latency_sync",
        }
        return self._run_latency_server_payload(client, "/latency/sync", next_payload)

    def leave_latency(
        self,
        client: CloudRemoteClient,
        *,
        room: str,
        player_id: str,
        country_code: str,
    ) -> dict[str, object]:
        return self._run_latency_server_payload(
            client,
            "/latency/leave",
            {
                "action": "latency_leave",
                "room": room,
                "player_id": player_id,
                "country_code": country_code,
            },
        )

    def sync_match(
        self,
        client: CloudRemoteClient,
        payload: dict[str, object],
    ) -> dict[str, object]:
        next_payload = {
            **payload,
            "action": "match_sync",
        }
        return self._run_latency_server_payload(client, "/match/sync", next_payload)

    def leave_match(
        self,
        client: CloudRemoteClient,
        *,
        room: str,
        player_id: str,
        country_code: str,
    ) -> dict[str, object]:
        return self._run_latency_server_payload(
            client,
            "/match/leave",
            {
                "action": "match_leave",
                "room": room,
                "player_id": player_id,
                "country_code": country_code,
            },
        )

    def ensure_remote_script(self, client: CloudRemoteClient, *, force: bool = False) -> None:
        if self._script_uploaded and not force:
            return

        if not self.local_script_path.exists():
            raise RuntimeError(f"Tank Trouble cloud script not found: {self.local_script_path}")

        prepare_command = (
            f"mkdir -p {shlex.quote(self.remote_base)} && "
            f"chmod 700 {shlex.quote(self.remote_base)}"
        )
        client.run(f"bash -lc {shlex.quote(prepare_command)}", timeout=20)
        client.put_file(self.local_script_path, self.remote_script_path)
        self._upload_static_assets(client)
        client.put_text(
            self.remote_manifest_path,
            json.dumps(self._local_bundle_manifest(), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
            encoding="utf-8",
        )
        chmod_command = f"chmod 755 {shlex.quote(self.remote_script_path)}"
        client.run(f"bash -lc {shlex.quote(chmod_command)}", timeout=20)
        self._script_uploaded = True

    def _clean_remote_game_bundle(self, client: CloudRemoteClient) -> None:
        script = f"""
set -e
REMOTE_BASE={shlex.quote(self.remote_base)}
case "$REMOTE_BASE" in
  /home/*/{REMOTE_BASE_DIRNAME}/{REMOTE_ROOM_DIRNAME}) ;;
  *) echo "Refusing to clean unexpected Tank Trouble path: $REMOTE_BASE" >&2; exit 1 ;;
esac
sudo systemctl stop {shlex.quote(REMOTE_SERVICE_NAME)} 2>/dev/null || true
{self._stop_orphan_listener_script()}
rm -rf "$REMOTE_BASE"
mkdir -p "$REMOTE_BASE"
chmod 700 "$REMOTE_BASE"
"""
        client.run(f"bash -lc {shlex.quote(script)}", timeout=30)
        self._script_uploaded = False

    def _local_bundle_manifest(self) -> dict[str, object]:
        if not self.local_script_path.exists():
            raise RuntimeError(f"Tank Trouble cloud script not found: {self.local_script_path}")

        hasher = hashlib.sha256()
        files: list[Path] = [self.local_script_path]
        assets_root = self.bundle_root / "www" / GAME_ASSET_DIR
        if assets_root.exists():
            files.extend(sorted(path for path in assets_root.rglob("*") if path.is_file()))

        asset_count = 0
        for path in files:
            relative_path = path.relative_to(self.bundle_root).as_posix()
            data = path.read_bytes()
            hasher.update(relative_path.encode("utf-8"))
            hasher.update(b"\0")
            hasher.update(str(len(data)).encode("ascii"))
            hasher.update(b"\0")
            hasher.update(data)
            if relative_path.startswith(f"www/{GAME_ASSET_DIR}/"):
                asset_count += 1

        return {
            "format": 1,
            "bundle_hash": hasher.hexdigest(),
            "script": REMOTE_SCRIPT_NAME,
            "asset_count": asset_count,
        }

    def _upload_static_assets(self, client: CloudRemoteClient) -> None:
        assets_root = self.bundle_root / "www" / GAME_ASSET_DIR
        if not assets_root.exists():
            return

        for local_path in assets_root.rglob("*"):
            if not local_path.is_file():
                continue
            relative_path = local_path.relative_to(assets_root).as_posix()
            remote_path = posixpath.join(self.remote_base, "www", GAME_ASSET_DIR, relative_path)
            remote_dir = posixpath.dirname(remote_path)
            client.run(f"bash -lc {shlex.quote(f'mkdir -p {shlex.quote(remote_dir)}')}", timeout=20)
            client.put_file(local_path, remote_path)

    def _run_action(
        self,
        client: CloudRemoteClient,
        *,
        action: str,
        room: str,
        player_id: str,
        country_code: str,
        preferred_color: str = "",
    ) -> dict[str, object]:
        return self._run_payload(
            client,
            {
                "action": action,
                "room": room,
                "player_id": player_id,
                "country_code": country_code,
                "preferred_color": preferred_color,
            },
        )

    def _run_payload(
        self,
        client: CloudRemoteClient,
        payload: dict[str, object],
    ) -> dict[str, object]:
        self.ensure_remote_script(client)

        payload_b64 = base64.urlsafe_b64encode(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        ).decode("ascii")

        remote_command = (
            f"python3 {shlex.quote(self.remote_script_path)} "
            f"--payload-b64 {shlex.quote(payload_b64)}"
        )
        output = client.run(f"bash -lc {shlex.quote(remote_command)}", timeout=25)

        try:
            response = json.loads(output or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Tank Trouble cloud state returned invalid JSON.") from exc

        if not isinstance(response, dict):
            raise RuntimeError("Tank Trouble cloud state returned an unexpected payload.")

        if response.get("ok") is False:
            raise RuntimeError(str(response.get("message") or "Tank Trouble cloud request failed."))

        return response

    def _run_latency_server_payload(
        self,
        client: CloudRemoteClient,
        path: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        if self._server_confirmed_reachable:
            try:
                if time.time() - self._server_health_checked_at > _SERVER_HEALTH_CACHE_SECONDS:
                    self._get_latency_server_health(timeout=0.8)
                return self._post_latency_server(path, payload)
            except Exception as exc:
                self._server_confirmed_reachable = False
                self._server_health_checked_at = 0.0
                self._server_base_url = None
                self._close_latency_http_connection()
                if "older game runtime" in str(exc):
                    self._sync_current_bundle_and_restart(client)
                    result = self._post_latency_server(path, payload)
                    self._server_confirmed_reachable = True
                    self._server_health_checked_at = time.time()
                    return result

        if time.time() - self._server_last_fail_time < _SERVER_RETRY_COOLDOWN:
            return self._run_payload(client, payload)

        try:
            self._ensure_latency_server(client)
            result = self._post_latency_server(path, payload)
            self._server_confirmed_reachable = True
            self._server_health_checked_at = time.time()
            return result
        except Exception:
            self._server_base_url = None
            self._server_health_checked_at = 0.0
            self._server_last_fail_time = time.time()
            return self._run_payload(client, payload)

    def _latency_server_base_url(self) -> str:
        if self._server_base_url is None:
            self._server_base_url = f"{self.config.public_base_url}{PUBLIC_PATH_PREFIX}"
        return self._server_base_url

    def _ensure_latency_server(self, client: CloudRemoteClient) -> None:
        try:
            self._get_latency_server_health(timeout=0.8)
            return
        except Exception as exc:
            if "older game runtime" in str(exc):
                self._sync_current_bundle_and_restart(client)
                return

        self._start_latency_server(client)
        self._wait_for_latency_server()

    def _start_latency_server(self, client: CloudRemoteClient) -> None:
        self.ensure_remote_script(client)
        if self._start_systemd_service_if_present(client):
            return
        log_path = posixpath.join(self.remote_base, "tank-trouble-server.log")
        command = (
            f"cd {shlex.quote(self.remote_base)} && "
            f"{self._stop_orphan_listener_script()} && "
            f"nohup python3 {shlex.quote(self.remote_script_path)} "
            f"--serve --port {TANK_GAME_SERVER_PORT} "
            f"--idle-timeout {TANK_GAME_SERVER_IDLE_TIMEOUT} "
            f"> {shlex.quote(log_path)} 2>&1 < /dev/null &"
        )
        client.run(f"bash -lc {shlex.quote(command)}", timeout=10)
        self._server_confirmed_reachable = False
        self._server_base_url = None
        self._close_latency_http_connection()

    def _start_systemd_service_if_present(self, client: CloudRemoteClient) -> bool:
        command = (
            f"systemctl list-unit-files {shlex.quote(REMOTE_SERVICE_NAME)}.service --no-legend 2>/dev/null "
            f"| grep -q '^{shlex.quote(REMOTE_SERVICE_NAME)}\\.service' && "
            f"{self._stop_orphan_listener_script()} && "
            f"sudo systemctl restart {shlex.quote(REMOTE_SERVICE_NAME)}"
        )
        try:
            client.run(f"bash -lc {shlex.quote(command)}", timeout=20)
            self._server_confirmed_reachable = False
            self._server_base_url = None
            self._close_latency_http_connection()
            return True
        except Exception:
            return False

    def _systemd_service(self) -> str:
        return f"""[Unit]
Description=Cloud Service Console Tank Trouble room server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={self.config.ssh_user}
WorkingDirectory={self.remote_base}
ExecStart=/usr/bin/python3 {self.remote_script_path} --serve --port {TANK_GAME_SERVER_PORT} --idle-timeout {TANK_GAME_SERVER_IDLE_TIMEOUT}
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
"""

    def _ensure_nginx_installed(self, client: CloudRemoteClient) -> None:
        script = """
set -e
if ! command -v nginx >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    sudo env DEBIAN_FRONTEND=noninteractive apt-get update
    sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y nginx
  else
    echo "nginx is not installed and no supported package manager was found." >&2
    exit 1
  fi
fi
sudo mkdir -p /etc/nginx/conf.d
sudo systemctl enable --now nginx
"""
        client.run(f"bash -lc {shlex.quote(script)}", timeout=180)

    def _install_public_proxy(self, client: CloudRemoteClient) -> None:
        block = f"""
    # BEGIN Cloud Service Console Tank Trouble
    location = {PUBLIC_PATH_PREFIX} {{
        return 301 {PUBLIC_PATH_PREFIX}/;
    }}

    location {PUBLIC_PATH_PREFIX}/ {{
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:{TANK_GAME_SERVER_PORT}/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }}
    # END Cloud Service Console Tank Trouble
"""
        fallback = f"""
server {{
    listen {self.config.api_port};
    server_name _;
{block}
}}
"""
        block_b64 = base64.b64encode(block.encode("utf-8")).decode("ascii")
        fallback_b64 = base64.b64encode(fallback.encode("utf-8")).decode("ascii")
        script = f"""
set -e
MAIN_CONF={shlex.quote(NGINX_PROXY_CONF_PATH)}
FALLBACK_CONF={shlex.quote(NGINX_FALLBACK_CONF_PATH)}
export PREFIX={shlex.quote(PUBLIC_PATH_PREFIX)}
export BLOCK_B64={shlex.quote(block_b64)}
export FALLBACK_B64={shlex.quote(fallback_b64)}
if [ -f "$MAIN_CONF" ]; then
  if ! grep -q "location $PREFIX/" "$MAIN_CONF"; then
    sudo cp "$MAIN_CONF" "$MAIN_CONF.bak-tank-trouble-$(date +%Y%m%d%H%M%S)"
    tmp_conf=$(mktemp)
    sudo cp "$MAIN_CONF" "$tmp_conf"
    python3 - "$tmp_conf" <<'PY'
import base64
from pathlib import Path
import os
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
block = base64.b64decode(os.environ["BLOCK_B64"]).decode("utf-8")
prefix = os.environ["PREFIX"]
start_marker = "    # BEGIN Cloud Service Console Tank Trouble"
end_marker = "    # END Cloud Service Console Tank Trouble"

def remove_marked_block(payload):
    start = payload.find(start_marker)
    if start < 0:
        return payload
    end = payload.find(end_marker, start)
    if end < 0:
        return payload
    line_end = payload.find("\\n", end)
    if line_end < 0:
        line_end = len(payload)
    else:
        line_end += 1
    return payload[:start].rstrip() + "\\n" + payload[line_end:].lstrip("\\n")

def remove_nginx_block(payload, start):
    brace = payload.find("{{", start)
    if brace < 0:
        return payload
    depth = 0
    end = brace
    while end < len(payload):
        char = payload[end]
        if char == "{{":
            depth += 1
        elif char == "}}":
            depth -= 1
            if depth == 0:
                end += 1
                break
        end += 1
    line_start = payload.rfind("\\n", 0, start) + 1
    line_end = payload.find("\\n", end)
    if line_end < 0:
        line_end = len(payload)
    else:
        line_end += 1
    return payload[:line_start].rstrip() + "\\n" + payload[line_end:].lstrip("\\n")

text = remove_marked_block(text)
for needle in (f"location = {{prefix}}", f"location {{prefix}}/"):
    while True:
        index = text.find(needle)
        if index < 0:
            break
        text = remove_nginx_block(text, index)

needle = "    location / {{"
if needle in text:
    text = text.replace(needle, block.rstrip() + "\\n\\n" + needle, 1)
else:
    insert_at = text.rfind("\\n}}")
    if insert_at < 0:
        raise SystemExit("could not find nginx server block end")
    text = text[:insert_at].rstrip() + "\\n" + block.rstrip() + text[insert_at:]
path.write_text(text, encoding="utf-8")
PY
    sudo cp "$tmp_conf" "$MAIN_CONF"
    rm -f "$tmp_conf"
  fi
else
  python3 - <<'PY' | sudo tee "$FALLBACK_CONF" >/dev/null
import base64
import os

print(base64.b64decode(os.environ["FALLBACK_B64"]).decode("utf-8"))
PY
fi
sudo nginx -t
sudo systemctl reload nginx
"""
        client.run(f"bash -lc {shlex.quote(script)}", timeout=30)

    @staticmethod
    def _stop_orphan_listener_script() -> str:
        return f"""pids=$(lsof -tiTCP:{TANK_GAME_SERVER_PORT} -sTCP:LISTEN 2>/dev/null || true); if [ -n "$pids" ]; then for pid in $pids; do cmd=$(ps -p "$pid" -o args= || true); case "$cmd" in *{REMOTE_SCRIPT_NAME}*) kill "$pid" || true ;; esac; done; sleep 1; fi"""

    def _wait_for_latency_server(self) -> None:
        deadline = time.time() + _SERVER_STARTUP_WAIT
        last_error: Exception | None = None
        while time.time() < deadline:
            try:
                self._get_latency_server_health(timeout=0.8)
                return
            except Exception as exc:
                last_error = exc
                time.sleep(_SERVER_STARTUP_POLL)
        raise RuntimeError(f"Tank Trouble latency server did not become ready: {last_error}")

    def _expected_bundle_hash(self) -> str:
        return str(self._local_bundle_manifest()["bundle_hash"])

    def _sync_current_bundle_and_restart(self, client: CloudRemoteClient) -> None:
        self.ensure_remote_script(client, force=True)
        if self._start_systemd_service_if_present(client):
            self._wait_for_latency_server()
            return
        self._start_latency_server(client)
        self._wait_for_latency_server()

    def _get_latency_server_health(self, *, timeout: float) -> dict[str, object]:
        payload = self._request_latency_server("GET", "/health", None, timeout=timeout)
        features = payload.get("features")
        feature_set = {str(feature) for feature in features} if isinstance(features, list) else set()
        missing_features = [feature for feature in REQUIRED_RUNTIME_FEATURES if feature not in feature_set]
        if missing_features:
            raise RuntimeError(
                "Tank Trouble server is running an older game runtime; missing features: "
                + ", ".join(missing_features)
            )
        server_bundle_hash = str(payload.get("bundle_hash") or "")
        expected_bundle_hash = self._expected_bundle_hash()
        if not server_bundle_hash or server_bundle_hash != expected_bundle_hash:
            raise RuntimeError("Tank Trouble server is running an older game runtime bundle.")
        self._server_confirmed_reachable = True
        self._server_health_checked_at = time.time()
        return payload

    def _post_latency_server(
        self,
        path: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        return self._request_latency_server("POST", path, payload, timeout=1.8)

    def _request_latency_server(
        self,
        method: str,
        path: str,
        payload: dict[str, object] | None,
        *,
        timeout: float,
    ) -> dict[str, object]:
        data = None
        headers = {
            "Accept": "application/json",
            "Connection": "keep-alive",
        }
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json; charset=utf-8"

        response_body = self._perform_latency_http_request(method, path, data, headers, timeout=timeout)

        try:
            parsed = json.loads(response_body or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Tank Trouble latency server returned invalid JSON.") from exc

        if not isinstance(parsed, dict):
            raise RuntimeError("Tank Trouble latency server returned an unexpected payload.")

        if parsed.get("ok") is False:
            raise RuntimeError(str(parsed.get("message") or "Tank Trouble latency server request failed."))

        return parsed

    def _perform_latency_http_request(
        self,
        method: str,
        path: str,
        body: bytes | None,
        headers: dict[str, str],
        *,
        timeout: float,
    ) -> str:
        last_error: Exception | None = None
        for attempt in range(2):
            connection = self._get_latency_http_connection(timeout=timeout, reset=attempt > 0)
            try:
                connection.request(method, self._public_request_path(path), body=body, headers=headers)
                response = connection.getresponse()
                response_body = response.read().decode("utf-8")
                if response.status >= 400:
                    raise RuntimeError(response_body or f"Tank Trouble latency server returned {response.status}")
                return response_body
            except Exception as exc:
                last_error = exc
                self._close_latency_http_connection(reset_all=False)
        raise RuntimeError(str(last_error or "Tank Trouble latency server request failed."))

    def _public_request_path(self, path: str) -> str:
        clean_path = "/" + str(path or "").lstrip("/")
        prefix = "" if self._use_local_tank_server() else PUBLIC_PATH_PREFIX
        return f"{prefix}{clean_path}"

    def _get_latency_http_connection(self, *, timeout: float, reset: bool = False) -> http.client.HTTPConnection:
        if reset:
            self._close_latency_http_connection(reset_all=False)
        target = self._latency_http_target()
        generation = self._latency_http_generation
        connection = getattr(self._latency_http_local, "connection", None)
        connection_target = getattr(self._latency_http_local, "target", None)
        connection_generation = getattr(self._latency_http_local, "generation", -1)
        if connection is None or connection_target != target or connection_generation != generation:
            self._close_latency_http_connection(reset_all=False)
            scheme, host, port = target
            connection_cls = http.client.HTTPSConnection if scheme == "https" else http.client.HTTPConnection
            connection = connection_cls(host, port, timeout=timeout)
            self._latency_http_local.connection = connection
            self._latency_http_local.target = target
            self._latency_http_local.generation = generation
        else:
            connection.timeout = timeout
        return connection

    def _close_latency_http_connection(self, *, reset_all: bool = True) -> None:
        if reset_all:
            with self._latency_http_generation_lock:
                self._latency_http_generation += 1
        connection = getattr(self._latency_http_local, "connection", None)
        if connection is None:
            return
        try:
            connection.close()
        finally:
            self._latency_http_local.connection = None
            self._latency_http_local.target = None
            self._latency_http_local.generation = -1

    def _latency_http_target(self) -> tuple[str, str, int]:
        if self._use_local_tank_server():
            return ("http", "127.0.0.1", TANK_GAME_SERVER_PORT)
        return (self.config.public_scheme, self.config.public_host, self.config.api_port)

    def _use_local_tank_server(self) -> bool:
        if str(os.environ.get("CLOUD_CONSOLE_TANK_LOCAL_DIRECT") or "").strip().lower() in {"0", "false", "no", "off"}:
            return False
        if str(os.environ.get("CLOUD_CONSOLE_WEB_MODE") or "").strip().lower() not in {"1", "true", "yes", "on"}:
            return False
        target_host = str(self.config.ssh_host or self.config.public_host or "").strip().lower()
        default_host = str(os.environ.get("CLOUD_CONSOLE_DEFAULT_HOST") or "").strip().lower()
        return target_host in {"127.0.0.1", "localhost"} or bool(default_host and target_host == default_host)
