from __future__ import annotations

import json
import posixpath
import shlex
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cloud_client import CloudRemoteClient
from config import CloudRuntimeConfig


BUNDLE_DIR_NAME = "cloud_setup_bundle"
DEFAULT_REMOTE_BASE = "/opt/go2rtc-cloud"


def _require_string(payload: dict[str, Any], *keys: str) -> str:
    current: Any = payload
    key_path: list[str] = []
    for key in keys:
        key_path.append(key)
        if not isinstance(current, dict) or key not in current:
            raise RuntimeError(f"缺少配置项: {'.'.join(key_path)}")
        current = current[key]

    value = str(current or "").strip()
    if not value:
        raise RuntimeError(f"缺少配置项: {'.'.join(keys)}")
    return value


def _optional_string(payload: dict[str, Any], keys: tuple[str, ...], default: str) -> str:
    current: Any = payload
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]
    value = str(current or "").strip()
    return value or default


def _optional_int(payload: dict[str, Any], keys: tuple[str, ...], default: int) -> int:
    current: Any = payload
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]

    if current in (None, ""):
        return default
    try:
        return int(current)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"配置项无效: {'.'.join(keys)}") from exc


def _optional_bool(payload: dict[str, Any], keys: tuple[str, ...], default: bool) -> bool:
    current: Any = payload
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]

    if isinstance(current, bool):
        return current
    if current in (None, ""):
        return default

    text = str(current).strip().lower()
    if text in {"true", "1", "yes", "on"}:
        return True
    if text in {"false", "0", "no", "off"}:
        return False
    raise RuntimeError(f"配置项无效: {'.'.join(keys)}")


def _default_port_for_scheme(scheme: str) -> int:
    return 443 if scheme in {"https", "wss"} else 80


def _authority(host: str, port: int, scheme: str) -> str:
    if port == _default_port_for_scheme(scheme):
        return host
    return f"{host}:{port}"


def _normalize_ingest_mode(value: str, default: str = "http") -> str:
    mode = str(value or "").strip().lower()
    if not mode:
        mode = default
    if mode not in {"http", "srt"}:
        raise RuntimeError(f"Invalid ingest mode: {value}")
    return mode


@dataclass
class CloudBundleConfig:
    stream_name: str
    public_scheme: str
    public_host: str
    ssh_host: str
    ssh_port: int
    ssh_user: str
    remote_base: str
    api_port: int
    ingest_port: int
    internal_api_port: int
    telemetry_internal_port: int
    control_signaling_internal_port: int
    webrtc_port: int
    srt_ingest_port: int
    rtsp_port: int
    go2rtc_release_tag: str
    ingest_mode: str
    srt_latency_ms: int
    srt_packet_size: int
    connect_timeout_ms: int
    drop_late_packets: bool

    @property
    def signal_scheme(self) -> str:
        return "wss" if self.public_scheme == "https" else "ws"

    @property
    def public_base_url(self) -> str:
        return f"{self.public_scheme}://{_authority(self.public_host, self.api_port, self.public_scheme)}"

    @property
    def public_signal_base_url(self) -> str:
        return f"{self.signal_scheme}://{_authority(self.public_host, self.api_port, self.signal_scheme)}"

    @property
    def public_ingest_base_url(self) -> str:
        return f"{self.public_scheme}://{_authority(self.public_host, self.ingest_port, self.public_scheme)}"

    @property
    def normalized_ingest_mode(self) -> str:
        return _normalize_ingest_mode(self.ingest_mode)

    @property
    def requires_srt_bridge(self) -> bool:
        return self.normalized_ingest_mode == "srt"

    @property
    def clock_url(self) -> str:
        return f"{self.public_base_url}/clock"

    @property
    def signal_url(self) -> str:
        return f"{self.public_signal_base_url}/api/ws?src={self.stream_name}"

    @property
    def viewer_url(self) -> str:
        return f"{self.public_base_url}/webrtc.html?src={self.stream_name}"

    @property
    def streams_api_url(self) -> str:
        return f"{self.public_base_url}/api/streams"

    @property
    def public_ts_ingest_url(self) -> str:
        return f"{self.public_ingest_base_url}/api/stream.ts?dst={self.stream_name}"

    @property
    def remote_rtsp_url(self) -> str:
        return f"rtsp://127.0.0.1:{self.rtsp_port}/{self.stream_name}"

    @property
    def telemetry_base_url(self) -> str:
        return f"{self.public_base_url}/telemetry"

    @property
    def telemetry_status_url(self) -> str:
        return f"{self.telemetry_base_url}/status"

    @property
    def control_signaling_base_url(self) -> str:
        return f"{self.public_base_url}/control/webrtc"

    @property
    def control_health_url(self) -> str:
        return f"{self.control_signaling_base_url}/health"

    @property
    def control_browser_offer_url(self) -> str:
        return f"{self.control_signaling_base_url}/browser-offer?session=robot-control"

    @property
    def control_robot_next_offer_url(self) -> str:
        return f"{self.control_signaling_base_url}/robot-next-offer?session=robot-control"

    @property
    def remote_www(self) -> str:
        return posixpath.join(self.remote_base, "www")

    @property
    def remote_go2rtc_yaml(self) -> str:
        return posixpath.join(self.remote_base, "go2rtc.yaml")

    @property
    def remote_go2rtc_bin(self) -> str:
        return posixpath.join(self.remote_base, "go2rtc")

    @property
    def remote_telemetry_script(self) -> str:
        return posixpath.join(self.remote_base, "telemetry_relay.py")

    @property
    def remote_control_script(self) -> str:
        return posixpath.join(self.remote_base, "control_signaling.py")


class CloudSetupBundle:
    def __init__(self, session_config: CloudRuntimeConfig) -> None:
        self.session_config = session_config
        self.root = Path(__file__).resolve().parent / BUNDLE_DIR_NAME
        self.config_path = self.root / "config" / "sender-cloud.config.json"
        self.www_dir = self.root / "www"
        self.telemetry_script_path = self.root / "telemetry_relay.py"
        self.control_script_path = self.root / "control_signaling.py"
        self.bundle_config = self._load_bundle_config()

    def _load_bundle_config(self) -> CloudBundleConfig:
        self.ensure_bundle_files()
        payload = json.loads(self.config_path.read_text(encoding="utf-8-sig"))
        if not isinstance(payload, dict):
            raise RuntimeError("内置云端配置模板无效。")

        stream_name = _require_string(payload, "streamName")
        public_scheme = _optional_string(payload, ("cloud", "publicScheme"), self.session_config.public_scheme).lower()
        if public_scheme not in {"http", "https"}:
            raise RuntimeError("内置云端配置模板中的 publicScheme 无效。")

        return CloudBundleConfig(
            stream_name=stream_name,
            public_scheme=public_scheme,
            public_host=self.session_config.public_host,
            ssh_host=self.session_config.ssh_host,
            ssh_port=self.session_config.ssh_port,
            ssh_user=self.session_config.ssh_user,
            remote_base=_optional_string(payload, ("cloud", "remoteBase"), DEFAULT_REMOTE_BASE),
            api_port=_optional_int(payload, ("cloud", "apiPort"), self.session_config.api_port),
            ingest_port=_optional_int(payload, ("cloud", "ingestPort"), 18084),
            internal_api_port=_optional_int(payload, ("cloud", "internalApiPort"), 18082),
            telemetry_internal_port=_optional_int(payload, ("cloud", "telemetryInternalPort"), 18083),
            control_signaling_internal_port=_optional_int(payload, ("cloud", "controlSignalingInternalPort"), 18085),
            webrtc_port=_optional_int(payload, ("cloud", "webrtcPort"), 19090),
            srt_ingest_port=_optional_int(payload, ("cloud", "srtIngestPort"), 19091),
            rtsp_port=_optional_int(payload, ("cloud", "rtspPort"), 8554),
            go2rtc_release_tag=_optional_string(payload, ("cloud", "go2rtcReleaseTag"), "v1.9.14"),
            ingest_mode=_normalize_ingest_mode(_optional_string(payload, ("transport", "ingestMode"), "http")),
            srt_latency_ms=_optional_int(payload, ("transport", "srtLatencyMs"), 120),
            srt_packet_size=_optional_int(payload, ("transport", "srtPacketSize"), 1316),
            connect_timeout_ms=_optional_int(payload, ("transport", "connectTimeoutMs"), 3000),
            drop_late_packets=_optional_bool(payload, ("transport", "dropLatePackets"), True),
        )

    def ensure_bundle_files(self) -> None:
        required_paths = [
            self.config_path,
            self.www_dir,
            self.telemetry_script_path,
            self.control_script_path,
            self.www_dir / "index.html",
            self.www_dir / "main-camera.html",
            self.www_dir / "main-camera-video.html",
            self.www_dir / "snapshot.html",
            self.www_dir / "webrtc.html",
        ]
        for path in required_paths:
            if not path.exists():
                raise RuntimeError(f"未找到内置云端资源: {path}")

    def _run_bash(self, client: CloudRemoteClient, script: str, timeout: int = 120) -> str:
        return client.run(f"bash -lc {shlex.quote(script)}", timeout=timeout)

    @staticmethod
    def _detect_ingest_mode_from_text(output: str) -> str:
        lowered = str(output or "").lower()
        if "-listen 1 -method post" in lowered or 'http://0.0.0.0:' in lowered:
            return "http"
        if "srt://0.0.0.0:" in lowered:
            return "srt"
        return ""

    def _detect_remote_ingest_mode(self, client: CloudRemoteClient) -> str:
        try:
            output = client.run("systemctl cat go2rtc-srt-bridge --no-pager 2>/dev/null || true", timeout=20)
        except Exception:
            return ""
        return self._detect_ingest_mode_from_text(output)

    def _resolve_bundle_config(self, client: CloudRemoteClient, ingest_mode: str | None = None) -> CloudBundleConfig:
        if ingest_mode is not None:
            return replace(self.bundle_config, ingest_mode=_normalize_ingest_mode(ingest_mode))

        detected_mode = self._detect_remote_ingest_mode(client)
        if detected_mode:
            return replace(self.bundle_config, ingest_mode=detected_mode)

        return self.bundle_config

    def check_ready(self, client: CloudRemoteClient) -> tuple[bool, str]:
        self.ensure_bundle_files()
        cfg = self.bundle_config
        go2rtc_bin = shlex.quote(cfg.remote_go2rtc_bin)
        go2rtc_yaml = shlex.quote(cfg.remote_go2rtc_yaml)
        telemetry_script = shlex.quote(cfg.remote_telemetry_script)
        control_script = shlex.quote(cfg.remote_control_script)
        command = (
            "set -e;"
            f" test -x {go2rtc_bin};"
            f" test -f {go2rtc_yaml};"
            f" test -f {telemetry_script};"
            f" test -f {control_script};"
            " sudo test -f /etc/systemd/system/go2rtc-cloud.service;"
            " sudo test -f /etc/systemd/system/go2rtc-srt-bridge.service;"
            " sudo test -f /etc/systemd/system/go2rtc-control-signaling.service;"
            " sudo test -f /etc/systemd/system/go2rtc-telemetry-relay.service;"
            " sudo test -f /etc/nginx/conf.d/go2rtc-cloud.conf"
        )
        try:
            self._run_bash(client, command, timeout=45)
        except Exception:
            return False, "云端尚未完成配置"
        return True, "环境已就绪"

    def deploy(self, client: CloudRemoteClient, ingest_mode: str | None = None) -> None:
        self.ensure_bundle_files()
        cfg = self._resolve_bundle_config(client, ingest_mode)

        self._prepare_remote_base(client, cfg)
        self._upload_runtime_files(client, cfg)
        self._install_remote_packages(client, cfg)
        self._install_services(client, cfg)
        self._install_nginx_config(client, cfg)
        self._verify_remote_health(client, cfg)

    def switch_ingest_mode(self, client: CloudRemoteClient, ingest_mode: str) -> CloudBundleConfig:
        self.ensure_bundle_files()
        cfg = self._resolve_bundle_config(client, ingest_mode)
        self._install_ingest_bridge_service(client, cfg)
        self._install_nginx_config(client, cfg)
        self._verify_remote_health(client, cfg)
        return cfg

    def _prepare_remote_base(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> None:
        script = (
            f"sudo mkdir -p {shlex.quote(cfg.remote_base)} {shlex.quote(cfg.remote_www)};"
            f" sudo chown -R {shlex.quote(cfg.ssh_user)}:{shlex.quote(cfg.ssh_user)} {shlex.quote(cfg.remote_base)}"
        )
        self._run_bash(client, script, timeout=45)

    def _upload_runtime_files(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> None:
        client.put_text(cfg.remote_go2rtc_yaml, self._go2rtc_yaml(cfg), encoding="ascii")
        client.put_file(self.telemetry_script_path, cfg.remote_telemetry_script)
        client.put_file(self.control_script_path, cfg.remote_control_script)

        # Re-create the remote web root explicitly so no old assets are retained.
        self._run_bash(client, f"rm -rf {shlex.quote(cfg.remote_www)}/*", timeout=45)
        for local_file in sorted(self.www_dir.iterdir()):
            if not local_file.is_file():
                continue
            remote_file = posixpath.join(cfg.remote_www, local_file.name)
            if local_file.name == "video-endpoints.json":
                continue
            client.put_file(local_file, remote_file)
        client.put_text(
            posixpath.join(cfg.remote_www, "video-endpoints.json"),
            json.dumps(self._video_endpoints_manifest(cfg), ensure_ascii=False, indent=4),
            encoding="utf-8",
        )

    def _install_remote_packages(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> None:
        script = f"""
set -euo pipefail
REMOTE_BASE={shlex.quote(cfg.remote_base)}
BIN_PATH="$REMOTE_BASE/go2rtc"
TAG={shlex.quote(cfg.go2rtc_release_tag)}
TMP_BIN="/tmp/go2rtc_linux_amd64"

if [ ! -x "$BIN_PATH" ]; then
  if ! command -v curl >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y curl
  fi
  URL="https://github.com/AlexxIT/go2rtc/releases/download/$TAG/go2rtc_linux_amd64"
  curl -fsSL "$URL" -o "$TMP_BIN"
  sudo mv "$TMP_BIN" "$BIN_PATH"
  sudo chmod 755 "$BIN_PATH"
fi

if ! command -v nginx >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y nginx
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y ffmpeg
fi

if ! python3 -c "import aiohttp" >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y python3-aiohttp
fi
"""
        self._run_bash(client, script, timeout=300)

    def _install_services(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> None:
        client.put_text("/tmp/go2rtc-cloud.service", self._go2rtc_service(cfg), encoding="ascii")
        client.put_text("/tmp/go2rtc-srt-bridge.service", self._ingest_bridge_service(cfg), encoding="ascii")
        client.put_text("/tmp/go2rtc-telemetry-relay.service", self._telemetry_service(cfg), encoding="ascii")
        client.put_text("/tmp/go2rtc-control-signaling.service", self._control_signaling_service(cfg), encoding="ascii")

        script = """
set -e
sudo mv /tmp/go2rtc-cloud.service /etc/systemd/system/go2rtc-cloud.service
sudo mv /tmp/go2rtc-srt-bridge.service /etc/systemd/system/go2rtc-srt-bridge.service
sudo mv /tmp/go2rtc-telemetry-relay.service /etc/systemd/system/go2rtc-telemetry-relay.service
sudo mv /tmp/go2rtc-control-signaling.service /etc/systemd/system/go2rtc-control-signaling.service
sudo systemctl daemon-reload
sudo systemctl enable --now go2rtc-cloud
sudo systemctl enable --now go2rtc-srt-bridge
sudo systemctl enable --now go2rtc-telemetry-relay
sudo systemctl disable go2rtc-control-signaling >/dev/null 2>&1 || true
sudo systemctl stop go2rtc-control-signaling >/dev/null 2>&1 || true
"""
        self._run_bash(client, script, timeout=120)

    def _install_ingest_bridge_service(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> None:
        client.put_text("/tmp/go2rtc-srt-bridge.service", self._ingest_bridge_service(cfg), encoding="ascii")
        script = """
set -e
sudo mv /tmp/go2rtc-srt-bridge.service /etc/systemd/system/go2rtc-srt-bridge.service
sudo systemctl daemon-reload
sudo systemctl enable --now go2rtc-cloud
sudo systemctl enable --now go2rtc-srt-bridge
sudo systemctl restart go2rtc-srt-bridge
"""
        self._run_bash(client, script, timeout=120)

    def _install_nginx_config(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> None:
        client.put_text("/tmp/go2rtc-cloud.conf", self._nginx_config(cfg), encoding="ascii")
        script = """
set -e
sudo mv /tmp/go2rtc-cloud.conf /etc/nginx/conf.d/go2rtc-cloud.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl restart nginx
"""
        self._run_bash(client, script, timeout=120)

    def _verify_remote_health(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> None:
        port_list = (
            f"{cfg.api_port}|{cfg.ingest_port}|{cfg.internal_api_port}|"
            f"{cfg.telemetry_internal_port}|{cfg.webrtc_port}|{cfg.srt_ingest_port}|{cfg.rtsp_port}"
        )
        script = f"""
set -euo pipefail
python3 - <<'PY'
import json
import urllib.request
for url in {json.dumps([
    f"http://127.0.0.1:{cfg.api_port}/clock",
    f"http://127.0.0.1:{cfg.api_port}/api/streams",
    f"http://127.0.0.1:{cfg.api_port}/telemetry/status",
])}:
    with urllib.request.urlopen(url, timeout=5) as response:
        response.read()
PY
ss -ltnup | grep -E ':({port_list}) ' || true
"""
        self._run_bash(client, script, timeout=90)

    @staticmethod
    def _go2rtc_yaml(cfg: CloudBundleConfig) -> str:
        return (
            f"streams:\n"
            f"  {cfg.stream_name}:\n\n"
            "api:\n"
            f'  listen: "127.0.0.1:{cfg.internal_api_port}"\n'
            '  static_dir: "www"\n\n'
            "rtsp:\n"
            f'  listen: "127.0.0.1:{cfg.rtsp_port}"\n\n'
            "webrtc:\n"
            f'  listen: ":{cfg.webrtc_port}"\n'
            "  candidates:\n"
            f"    - {cfg.public_host}:{cfg.webrtc_port}\n"
            "  ice_servers: []\n"
        )

    @staticmethod
    def _go2rtc_service(cfg: CloudBundleConfig) -> str:
        return f"""[Unit]
Description=go2rtc cloud relay
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={cfg.ssh_user}
WorkingDirectory={cfg.remote_base}
ExecStart={cfg.remote_go2rtc_bin} -config {cfg.remote_go2rtc_yaml}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
"""

    @staticmethod
    def _ingest_bridge_service(cfg: CloudBundleConfig) -> str:
        if cfg.requires_srt_bridge:
            tlpktdrop = 1 if cfg.drop_late_packets else 0
            description = "go2rtc SRT ingest bridge"
            exec_start = (
                "/usr/bin/bash -lc 'exec /usr/bin/ffmpeg -hide_banner -nostdin -loglevel warning "
                "-fflags nobuffer -flags low_delay -analyzeduration 1000000 -probesize 1048576 "
                f"-i \"srt://0.0.0.0:{cfg.srt_ingest_port}?mode=listener&transtype=live&latency={cfg.srt_latency_ms}"
                f"&peerlatency={cfg.srt_latency_ms}&rcvlatency={cfg.srt_latency_ms}&tlpktdrop={tlpktdrop}"
                f"&pkt_size={cfg.srt_packet_size}\" -map 0:v:0 -c:v copy -an -rtsp_transport tcp -f rtsp "
                f"\"{cfg.remote_rtsp_url}\"'"
            )
        else:
            if cfg.ingest_port == cfg.api_port:
                raise RuntimeError("HTTP ingest bridge requires cloud.ingestPort to differ from cloud.apiPort.")
            description = "go2rtc HTTP ingest bridge"
            exec_start = (
                "/usr/bin/bash -lc 'exec /usr/bin/ffmpeg -hide_banner -nostdin -loglevel warning "
                "-fflags nobuffer -flags low_delay -analyzeduration 1000000 -probesize 1048576 "
                f"-listen 1 -method POST -f mpegts -i \"http://0.0.0.0:{cfg.ingest_port}/api/stream.ts?dst={cfg.stream_name}\" "
                f"-map 0:v:0 -c:v copy -an -rtsp_transport tcp -f rtsp \"{cfg.remote_rtsp_url}\"'"
            )

        return f"""[Unit]
Description={description}
After=network-online.target go2rtc-cloud.service
Wants=network-online.target go2rtc-cloud.service

[Service]
Type=simple
User={cfg.ssh_user}
WorkingDirectory={cfg.remote_base}
ExecStart={exec_start}
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
"""

    @staticmethod
    def _telemetry_service(cfg: CloudBundleConfig) -> str:
        return f"""[Unit]
Description=go2rtc telemetry relay
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={cfg.ssh_user}
WorkingDirectory={cfg.remote_base}
ExecStart=/usr/bin/python3 {cfg.remote_telemetry_script} --host 127.0.0.1 --port {cfg.telemetry_internal_port}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
"""

    @staticmethod
    def _control_signaling_service(cfg: CloudBundleConfig) -> str:
        return f"""[Unit]
Description=go2rtc control signaling broker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={cfg.ssh_user}
WorkingDirectory={cfg.remote_base}
ExecStart=/usr/bin/python3 {cfg.remote_control_script} --host 127.0.0.1 --port {cfg.control_signaling_internal_port}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
"""

    @staticmethod
    def _nginx_config(cfg: CloudBundleConfig) -> str:
        http_ingest_moved_location = f"""    location = /api/stream.ts {{
        default_type text/plain;
        add_header Cache-Control "no-store" always;
        return 404 "video ingest moved to tcp/{cfg.ingest_port}\\n";
    }}
"""
        srt_ingest_moved_location = f"""    location = /api/stream.ts {{
        default_type text/plain;
        add_header Cache-Control "no-store" always;
        return 404 "video ingest moved to srt/udp/{cfg.srt_ingest_port}\\n";
    }}
"""

        api_ingest_location = srt_ingest_moved_location if cfg.requires_srt_bridge else http_ingest_moved_location

        return f"""map $http_upgrade $connection_upgrade {{
    default upgrade;
    ''      close;
}}

server {{
    listen {cfg.api_port};
    server_name _;
    client_max_body_size 32m;

    location = /clock {{
        default_type application/json;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Access-Control-Allow-Origin "*" always;
        return 200 '{{"server_ms":$msec}}';
    }}

{api_ingest_location}

    location /telemetry/ {{
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:{cfg.telemetry_internal_port};
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

    location /control/webrtc/ {{
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:{cfg.control_signaling_internal_port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }}

    location / {{
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:{cfg.internal_api_port};
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
}}
"""

    @staticmethod
    def _video_endpoints_manifest(cfg: CloudBundleConfig) -> dict[str, Any]:
        return {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "streamName": cfg.stream_name,
            "viewerUrl": cfg.viewer_url,
            "stableViewerUrl": f"{cfg.public_base_url}/{cfg.stream_name}.html",
            "cleanViewerUrl": f"{cfg.viewer_url}&clean=1",
            "stableCleanViewerUrl": f"{cfg.public_base_url}/{cfg.stream_name}-video.html",
            "signalUrl": cfg.signal_url,
            "viewerPage": cfg.viewer_url,
            "signalPath": f"/api/ws?src={cfg.stream_name}",
            "publicScheme": cfg.public_scheme,
            "publicHost": cfg.public_host,
            "apiPort": cfg.api_port,
            "ingestPort": cfg.ingest_port,
            "webrtcPort": cfg.webrtc_port,
            "ingestUrl": cfg.public_ts_ingest_url,
            "webrtcCandidates": [f"{cfg.public_host}:{cfg.webrtc_port}"],
            "requiresIceServers": False,
            "iceServers": [],
            "requiresAuth": False,
            "auth": "none",
            "notes": [
                "This project currently exposes direct WebRTC video only.",
                "Current ingest and viewer URLs are generated from the bundled cloud setup template.",
            ],
        }
