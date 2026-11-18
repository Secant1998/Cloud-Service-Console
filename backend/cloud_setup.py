from __future__ import annotations

import json
import io
import os
import posixpath
import shlex
import hashlib
import tarfile
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from cloud_client import CloudRemoteClient
from config import CloudRuntimeConfig, LOGIN_SETTINGS_FILENAME, TANK_GAME_SERVER_PORT


BUNDLE_DIR_NAME = "cloud_setup_bundle"
WEB_CONSOLE_BUNDLE_DIR_NAME = "web_console_bundle"
DEFAULT_REMOTE_BASE = "/opt/go2rtc-cloud"
DEFAULT_WEB_CONSOLE_REMOTE_BASE = "/opt/cloud-service-console-web"
DEFAULT_WEB_CONSOLE_PORT = 18080
DEFAULT_WEB_CONSOLE_SERVICE = "cloud-service-console-web"
DEFAULT_WEB_CONSOLE_ADMIN_TOKEN = "change-me-admin-token"
DEFAULT_WEB_CONSOLE_USER_TOKEN = "change-me-user-token"
TANK_TROUBLE_PUBLIC_PATH_PREFIX = "/tank-trouble"


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


SERVER_TARGET_TEMPLATE_FIELDS = (
    ("cloud", "publicHost"),
    ("cloud", "sshHost"),
    ("cloud", "sshPort"),
    ("cloud", "sshUser"),
    ("cloud", "sshPassword"),
    ("cloud", "sshKeyPath"),
)


def _present_config_paths(payload: dict[str, Any], paths: tuple[tuple[str, ...], ...]) -> list[str]:
    present: list[str] = []
    for path in paths:
        current: Any = payload
        found = True
        for key in path:
            if not isinstance(current, dict) or key not in current:
                found = False
                break
            current = current[key]
        if found:
            present.append(".".join(path))
    return present


def _default_port_for_scheme(scheme: str) -> int:
    return 443 if scheme in {"https", "wss"} else 80


def _authority(host: str, port: int, scheme: str) -> str:
    if port == _default_port_for_scheme(scheme):
        return host
    return f"{host}:{port}"


def _normalize_ingest_mode(value: str, default: str = "srt") -> str:
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
    turn_user: str
    turn_credential: str
    turn_relay_min_port: int
    turn_relay_max_port: int
    turn_relay_ip: str = ""
    web_console_remote_base: str = DEFAULT_WEB_CONSOLE_REMOTE_BASE
    web_console_port: int = DEFAULT_WEB_CONSOLE_PORT
    web_console_service: str = DEFAULT_WEB_CONSOLE_SERVICE
    web_console_admin_token: str = DEFAULT_WEB_CONSOLE_ADMIN_TOKEN
    web_console_user_token: str = DEFAULT_WEB_CONSOLE_USER_TOKEN

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
    def public_srt_ingest_url(self) -> str:
        tlpktdrop = 1 if self.drop_late_packets else 0
        return (
            f"srt://{self.public_host}:{self.srt_ingest_port}"
            f"?mode=caller&transtype=live&latency={self.srt_latency_ms}"
            f"&peerlatency={self.srt_latency_ms}&rcvlatency={self.srt_latency_ms}"
            f"&tlpktdrop={tlpktdrop}&pkt_size={self.srt_packet_size}"
            f"&connect_timeout={self.connect_timeout_ms}"
        )

    @property
    def selected_ingest_url(self) -> str:
        if self.requires_srt_bridge:
            return self.public_srt_ingest_url
        return self.public_ts_ingest_url

    @property
    def upload_protocol(self) -> str:
        return "srt" if self.requires_srt_bridge else "http-mpegts"

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
    def video_status_url(self) -> str:
        return f"{self.public_base_url}/api/video/status"

    @property
    def control_signaling_base_url(self) -> str:
        return f"{self.public_base_url}/control/webrtc"

    @property
    def control_health_url(self) -> str:
        return f"{self.control_signaling_base_url}/health"

    @property
    def control_frontend_offer_url(self) -> str:
        return f"{self.control_signaling_base_url}/frontend-offer?session=robot-control&client_id=frontend-a"

    @property
    def control_compute_next_offer_url(self) -> str:
        return f"{self.control_signaling_base_url}/compute-next-offer?session=robot-control&compute_client_id=compute-a"

    @property
    def command_signaling_base_url(self) -> str:
        return f"{self.public_base_url}/command/webrtc"

    @property
    def command_compute_offer_url(self) -> str:
        return f"{self.command_signaling_base_url}/compute-offer?session=robot-command&client_id=compute-a"

    @property
    def command_edge_next_offer_url(self) -> str:
        return f"{self.command_signaling_base_url}/edge-next-offer?session=robot-command&edge_client_id=arm-edge-a"

    @property
    def remote_www(self) -> str:
        return posixpath.join(self.remote_base, "www")

    @property
    def runtime_status_file_name(self) -> str:
        return f"{quote(self.stream_name, safe='')}-runtime.json"

    @property
    def runtime_status_url(self) -> str:
        return f"{self.public_base_url}/{self.runtime_status_file_name}"

    @property
    def remote_runtime_status_path(self) -> str:
        return posixpath.join(self.remote_www, self.runtime_status_file_name)

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

    @property
    def remote_www_manifest(self) -> str:
        return posixpath.join(self.remote_base, ".www-manifest.txt")

    @property
    def remote_go2rtc_tag_file(self) -> str:
        return posixpath.join(self.remote_base, ".go2rtc-release-tag")

    @property
    def web_console_backend_dir(self) -> str:
        return posixpath.join(self.web_console_remote_base, "backend")

    @property
    def web_console_frontend_dist_dir(self) -> str:
        return posixpath.join(self.web_console_remote_base, "frontend", "dist")

    @property
    def web_console_storage_dir(self) -> str:
        return posixpath.join(self.web_console_remote_base, "storage")

    @property
    def web_console_env_path(self) -> str:
        return posixpath.join(self.web_console_remote_base, "cloud-console-web.env")

    @property
    def web_console_manifest_path(self) -> str:
        return posixpath.join(self.web_console_remote_base, ".bundle-manifest.json")

    @property
    def web_console_login_settings_path(self) -> str:
        return posixpath.join(self.web_console_storage_dir, LOGIN_SETTINGS_FILENAME)


@dataclass
class CloudDeployResult:
    changed: bool
    summary: list[str]


class CloudSetupBundle:
    def __init__(self, session_config: CloudRuntimeConfig) -> None:
        self.session_config = session_config
        module_dir = Path(__file__).resolve().parent
        self.root = module_dir / BUNDLE_DIR_NAME
        packaged_web_console_root = module_dir / WEB_CONSOLE_BUNDLE_DIR_NAME
        if (packaged_web_console_root / "backend" / "launcher.py").is_file():
            self.web_console_bundle_root = packaged_web_console_root
            self.web_console_backend_dir = packaged_web_console_root / "backend"
            self.web_console_frontend_dist = packaged_web_console_root / "frontend" / "dist"
        else:
            self.web_console_bundle_root = module_dir.parent
            self.web_console_backend_dir = module_dir
            self.web_console_frontend_dist = module_dir.parent / "frontend" / "dist"
        self.config_path = self.root / "config" / "sender-cloud.config.json"
        self.www_dir = self.root / "www"
        self.telemetry_script_path = self.root / "telemetry_relay.py"
        self.control_script_path = self.root / "control_signaling.py"
        self.ignored_target_template_fields: list[str] = []
        self.bundle_config = self._load_bundle_config()

    def _load_bundle_config(self) -> CloudBundleConfig:
        self.ensure_bundle_files()
        payload = json.loads(self.config_path.read_text(encoding="utf-8-sig"))
        if not isinstance(payload, dict):
            raise RuntimeError("内置云端配置模板无效。")

        self.ignored_target_template_fields = _present_config_paths(payload, SERVER_TARGET_TEMPLATE_FIELDS)
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
            ingest_mode=_normalize_ingest_mode(_optional_string(payload, ("transport", "ingestMode"), "srt")),
            srt_latency_ms=_optional_int(payload, ("transport", "srtLatencyMs"), 120),
            srt_packet_size=_optional_int(payload, ("transport", "srtPacketSize"), 1316),
            connect_timeout_ms=_optional_int(payload, ("transport", "connectTimeoutMs"), 3000),
            drop_late_packets=_optional_bool(payload, ("transport", "dropLatePackets"), True),
            turn_user=_optional_string(payload, ("cloud", "turnUser"), "telemetry"),
            turn_credential=_optional_string(payload, ("cloud", "turnCredential"), "123456"),
            turn_relay_min_port=_optional_int(payload, ("cloud", "turnRelayMinPort"), 20000),
            turn_relay_max_port=_optional_int(payload, ("cloud", "turnRelayMaxPort"), 20199),
            turn_relay_ip=_optional_string(payload, ("cloud", "turnRelayIp"), ""),
            web_console_remote_base=_optional_string(
                payload,
                ("webConsole", "remoteBase"),
                DEFAULT_WEB_CONSOLE_REMOTE_BASE,
            ),
            web_console_port=_optional_int(payload, ("webConsole", "port"), DEFAULT_WEB_CONSOLE_PORT),
            web_console_service=_optional_string(
                payload,
                ("webConsole", "serviceName"),
                DEFAULT_WEB_CONSOLE_SERVICE,
            ),
            web_console_admin_token=_optional_string(
                payload,
                ("webConsole", "adminToken"),
                os.environ.get("CLOUD_CONSOLE_ADMIN_TOKEN") or DEFAULT_WEB_CONSOLE_ADMIN_TOKEN,
            ),
            web_console_user_token=_optional_string(
                payload,
                ("webConsole", "userToken"),
                os.environ.get("CLOUD_CONSOLE_USER_TOKEN") or DEFAULT_WEB_CONSOLE_USER_TOKEN,
            ),
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

    def _web_console_available(self) -> bool:
        return (
            self.web_console_backend_dir.is_dir()
            and self.web_console_frontend_dist.is_dir()
            and (self.web_console_backend_dir / "launcher.py").is_file()
            and (self.web_console_backend_dir / "requirements.txt").is_file()
            and (self.web_console_frontend_dist / "index.html").is_file()
        )

    def _ensure_web_console_bundle(self) -> None:
        if not self._web_console_available():
            raise RuntimeError(
                "Web console deployment bundle is missing. Build the frontend and backend bundle before running one-click setup."
            )

    def _run_bash(self, client: CloudRemoteClient, script: str, timeout: int = 120) -> str:
        return client.run(f"bash -lc {shlex.quote(script)}", timeout=timeout)

    @staticmethod
    def _sha256_bytes(payload: bytes) -> str:
        return hashlib.sha256(payload).hexdigest()

    @staticmethod
    def _hash_directory(directory: Path) -> str:
        hasher = hashlib.sha256()
        if not directory.exists():
            return ""
        for path in sorted(item for item in directory.rglob("*") if item.is_file()):
            relative_path = path.relative_to(directory).as_posix()
            relative_parts = set(path.relative_to(directory).parts)
            if relative_parts.intersection({"__pycache__", "build", "dist", "web_console_bundle"}):
                continue
            if path.suffix in {".pyc", ".pyo", ".spec"}:
                continue
            data = path.read_bytes()
            hasher.update(relative_path.encode("utf-8"))
            hasher.update(b"\0")
            hasher.update(str(len(data)).encode("ascii"))
            hasher.update(b"\0")
            hasher.update(data)
        return hasher.hexdigest()

    @staticmethod
    def _safe_token_env_value(value: str) -> str:
        return str(value or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", "").replace("\r", "")

    def _remote_file_sha256(self, client: CloudRemoteClient, remote_path: str, *, use_sudo: bool = False) -> str | None:
        quoted_path = shlex.quote(remote_path)
        if use_sudo:
            script = f"if sudo test -f {quoted_path}; then sudo sha256sum {quoted_path} | awk '{{print $1}}'; fi"
        else:
            script = f"if test -f {quoted_path}; then sha256sum {quoted_path} | awk '{{print $1}}'; fi"
        try:
            output = self._run_bash(client, script, timeout=30).strip().lower()
        except Exception:
            return None
        return output or None

    def _sync_remote_bytes(
        self,
        client: CloudRemoteClient,
        *,
        remote_path: str,
        payload: bytes,
        label: str,
        use_sudo: bool = False,
        mode: str = "0644",
    ) -> bool:
        local_hash = self._sha256_bytes(payload)
        remote_hash = self._remote_file_sha256(client, remote_path, use_sudo=use_sudo)
        if remote_hash == local_hash:
            return False

        safe_label = "".join(ch if ch.isalnum() or ch in {"-", "_", "."} else "_" for ch in label)
        temp_path = f"/tmp/cloud-console-{safe_label}-{local_hash[:12]}.tmp"
        remote_dir = posixpath.dirname(remote_path) or "."
        client.put_bytes(temp_path, payload)
        quoted_temp = shlex.quote(temp_path)
        quoted_path = shlex.quote(remote_path)
        quoted_dir = shlex.quote(remote_dir)
        if use_sudo:
            script = (
                f"sudo mkdir -p {quoted_dir} && "
                f"sudo install -m {shlex.quote(mode)} {quoted_temp} {quoted_path} && "
                f"rm -f {quoted_temp}"
            )
        else:
            script = (
                f"mkdir -p {quoted_dir} && "
                f"install -m {shlex.quote(mode)} {quoted_temp} {quoted_path} && "
                f"rm -f {quoted_temp}"
            )
        self._run_bash(client, script, timeout=60)
        return True

    def _sync_remote_text(
        self,
        client: CloudRemoteClient,
        *,
        remote_path: str,
        text: str,
        label: str,
        encoding: str = "utf-8",
        use_sudo: bool = False,
        mode: str = "0644",
    ) -> bool:
        return self._sync_remote_bytes(
            client,
            remote_path=remote_path,
            payload=str(text).encode(encoding),
            label=label,
            use_sudo=use_sudo,
            mode=mode,
        )

    def _sync_remote_file(
        self,
        client: CloudRemoteClient,
        *,
        local_path: Path,
        remote_path: str,
        label: str,
        use_sudo: bool = False,
        mode: str = "0644",
    ) -> bool:
        return self._sync_remote_bytes(
            client,
            remote_path=remote_path,
            payload=local_path.read_bytes(),
            label=label,
            use_sudo=use_sudo,
            mode=mode,
        )

    def _remote_service_states(self, client: CloudRemoteClient, services: list[str]) -> dict[str, dict[str, str]]:
        if not services:
            return {}
        service_list = " ".join(shlex.quote(service) for service in services)
        script = f"""
for svc in {service_list}; do
  printf '__SERVICE__:%s\\n' "$svc"
  systemctl show "$svc" --property=ActiveState,UnitFileState --no-page 2>/dev/null || true
done
"""
        output = self._run_bash(client, script, timeout=45)
        states: dict[str, dict[str, str]] = {}
        current = ""
        for line in output.splitlines():
            stripped = line.strip()
            if stripped.startswith("__SERVICE__:"):
                current = stripped.split(":", 1)[1]
                states[current] = {"ActiveState": "unknown", "UnitFileState": "unknown"}
            elif current and "=" in stripped:
                key, value = stripped.split("=", 1)
                states[current][key] = value.strip() or "unknown"
        return states

    @staticmethod
    def _detect_ingest_mode_from_text(output: str) -> str:
        lowered = str(output or "").lower()
        if "srt://0.0.0.0:" in lowered:
            return "srt"
        if "-listen 1 -method post" in lowered or 'http://0.0.0.0:' in lowered:
            return "http"
        return ""

    def _detect_remote_ingest_mode(self, client: CloudRemoteClient) -> str:
        try:
            output = client.run("systemctl cat go2rtc-srt-bridge --no-pager 2>/dev/null || true", timeout=20)
        except Exception:
            return ""
        return self._detect_ingest_mode_from_text(output)

    def _detect_remote_private_ip(self, client: CloudRemoteClient) -> str:
        try:
            output = self._run_bash(
                client,
                "ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i==\"src\") {print $(i+1); exit}}'",
                timeout=20,
            )
        except Exception:
            return ""
        candidate = str(output or "").strip().splitlines()[0].strip() if output else ""
        if candidate and candidate != self.bundle_config.public_host:
            return candidate
        return ""

    def _resolve_bundle_config(self, client: CloudRemoteClient, ingest_mode: str | None = None) -> CloudBundleConfig:
        turn_relay_ip = self.bundle_config.turn_relay_ip or self._detect_remote_private_ip(client)
        base_config = replace(self.bundle_config, turn_relay_ip=turn_relay_ip)
        if ingest_mode is not None:
            return replace(base_config, ingest_mode=_normalize_ingest_mode(ingest_mode))

        detected_mode = self._detect_remote_ingest_mode(client)
        if detected_mode:
            return replace(base_config, ingest_mode=detected_mode)

        return base_config

    def _generated_at_iso(self) -> str:
        candidates = [self.config_path, self.telemetry_script_path, self.control_script_path]
        candidates.extend(path for path in self.www_dir.rglob("*") if path.is_file())
        timestamps = [path.stat().st_mtime for path in candidates if path.exists()]
        timestamp = max(timestamps) if timestamps else datetime.now(timezone.utc).timestamp()
        return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()

    def _www_payloads(self, cfg: CloudBundleConfig, *, include_runtime_status: bool = True) -> dict[str, bytes]:
        payloads: dict[str, bytes] = {}
        for local_file in sorted(self.www_dir.rglob("*")):
            if not local_file.is_file():
                continue
            relative_path = local_file.relative_to(self.www_dir).as_posix()
            if relative_path == "video-endpoints.json":
                continue
            remote_path = posixpath.join(cfg.remote_www, relative_path)
            payloads[remote_path] = local_file.read_bytes()
        payloads[posixpath.join(cfg.remote_www, "video-endpoints.json")] = json.dumps(
            self._video_endpoints_manifest(cfg),
            ensure_ascii=False,
            indent=4,
        ).encode("utf-8")
        if include_runtime_status:
            payloads[cfg.remote_runtime_status_path] = json.dumps(
                self._runtime_status_payload(cfg, state="stopped", status_reason="deploy_initialized"),
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8") + b"\n"
        return payloads

    def _www_manifest_text(self, cfg: CloudBundleConfig) -> str:
        entries = []
        for remote_path, payload in sorted(self._www_payloads(cfg, include_runtime_status=False).items()):
            relative_path = remote_path.removeprefix(cfg.remote_www).lstrip("/")
            entries.append(f"{self._sha256_bytes(payload)}  {relative_path}")
        return "\n".join(entries) + "\n"

    def _web_console_login_payload(self, cfg: CloudBundleConfig) -> dict[str, Any]:
        account = {
            "host": cfg.ssh_host,
            "username": cfg.ssh_user,
            "password": self.session_config.ssh_password,
            "remember_password": True,
            "auto_login": True,
        }
        return {
            **account,
            "saved_accounts": [account],
        }

    def _web_console_env_text(self, cfg: CloudBundleConfig) -> str:
        return "\n".join(
            [
                "CLOUD_CONSOLE_WEB_MODE=1",
                "CLOUD_CONSOLE_BACKEND_HOST=0.0.0.0",
                f"CLOUD_CONSOLE_BACKEND_PORT={cfg.web_console_port}",
                f"CLOUD_CONSOLE_STORAGE_DIR={cfg.web_console_storage_dir}",
                f"CLOUD_CONSOLE_FRONTEND_DIST={cfg.web_console_frontend_dist_dir}",
                f"CLOUD_CONSOLE_DEFAULT_HOST={cfg.ssh_host}",
                f"CLOUD_CONSOLE_DEFAULT_SSH_USER={cfg.ssh_user}",
                f'CLOUD_CONSOLE_ADMIN_TOKEN="{self._safe_token_env_value(cfg.web_console_admin_token)}"',
                f'CLOUD_CONSOLE_USER_TOKEN="{self._safe_token_env_value(cfg.web_console_user_token)}"',
                "# Machine capture upload credentials are preserved across redeployments.",
                "TELEBOT_CAPTURE_UPLOAD_TOKEN=",
                "TELEBOT_FRONTEND_SIGNAL_TOKEN=",
                "TELEBOT_COMPUTE_SIGNAL_TOKEN=",
                "TELEBOT_SIGNAL_ADMIN_TOKEN=",
                "",
            ]
        )

    def _web_console_service(self, cfg: CloudBundleConfig) -> str:
        return f"""[Unit]
Description=Cloud Service Console Web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={cfg.ssh_user}
WorkingDirectory={cfg.web_console_backend_dir}
EnvironmentFile={cfg.web_console_env_path}
EnvironmentFile=-{cfg.remote_base}/control-signaling.env
EnvironmentFile=-/opt/webrtc-p2p-video/p2p-v2-auth.env
ExecStart={cfg.web_console_remote_base}/.venv/bin/python launcher.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
"""

    def _web_console_manifest_payload(self, cfg: CloudBundleConfig) -> dict[str, Any]:
        self._ensure_web_console_bundle()
        backend_hash = self._hash_directory(self.web_console_backend_dir)
        frontend_hash = self._hash_directory(self.web_console_frontend_dist)
        env_hash = self._sha256_bytes(self._web_console_env_text(cfg).encode("utf-8"))
        login_hash = self._sha256_bytes(
            json.dumps(
                self._web_console_login_payload(cfg),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        )
        service_hash = self._sha256_bytes(self._web_console_service(cfg).encode("utf-8"))
        combined = hashlib.sha256()
        for value in (backend_hash, frontend_hash, env_hash, login_hash, service_hash):
            combined.update(value.encode("ascii"))
            combined.update(b"\0")
        return {
            "format": 1,
            "service": cfg.web_console_service,
            "port": cfg.web_console_port,
            "remoteBase": cfg.web_console_remote_base,
            "backendHash": backend_hash,
            "frontendHash": frontend_hash,
            "envHash": env_hash,
            "loginHash": login_hash,
            "serviceHash": service_hash,
            "bundleHash": combined.hexdigest(),
        }

    def _desired_system_files(self, cfg: CloudBundleConfig) -> list[dict[str, Any]]:
        return [
            {
                "label": "go2rtc.yaml",
                "remote_path": cfg.remote_go2rtc_yaml,
                "payload": self._go2rtc_yaml(cfg).encode("ascii"),
                "group": "video",
                "use_sudo": False,
            },
            {
                "label": "telemetry_relay.py",
                "remote_path": cfg.remote_telemetry_script,
                "payload": self.telemetry_script_path.read_bytes(),
                "group": "telemetry",
                "use_sudo": False,
            },
            {
                "label": "control_signaling.py",
                "remote_path": cfg.remote_control_script,
                "payload": self.control_script_path.read_bytes(),
                "group": "control",
                "use_sudo": False,
            },
            {
                "label": "go2rtc-cloud.service",
                "remote_path": "/etc/systemd/system/go2rtc-cloud.service",
                "payload": self._go2rtc_service(cfg).encode("ascii"),
                "group": "video",
                "use_sudo": True,
            },
            {
                "label": "go2rtc-srt-bridge.service",
                "remote_path": "/etc/systemd/system/go2rtc-srt-bridge.service",
                "payload": self._ingest_bridge_service(cfg).encode("ascii"),
                "group": "video",
                "use_sudo": True,
            },
            {
                "label": "go2rtc-telemetry-relay.service",
                "remote_path": "/etc/systemd/system/go2rtc-telemetry-relay.service",
                "payload": self._telemetry_service(cfg).encode("ascii"),
                "group": "telemetry",
                "use_sudo": True,
            },
            {
                "label": "go2rtc-control-signaling.service",
                "remote_path": "/etc/systemd/system/go2rtc-control-signaling.service",
                "payload": self._control_signaling_service(cfg).encode("ascii"),
                "group": "control",
                "use_sudo": True,
            },
            {
                "label": "turnserver.conf",
                "remote_path": "/etc/turnserver.conf",
                "payload": self._turnserver_config(cfg).encode("ascii"),
                "group": "turn",
                "use_sudo": True,
            },
            {
                "label": "go2rtc-cloud.conf",
                "remote_path": "/etc/nginx/conf.d/go2rtc-cloud.conf",
                "payload": self._nginx_config(cfg).encode("ascii"),
                "group": "nginx",
                "use_sudo": True,
            },
        ]

    def _required_services(self, cfg: CloudBundleConfig) -> list[str]:
        services = ["nginx", "coturn", "go2rtc-cloud", "go2rtc-control-signaling", "go2rtc-telemetry-relay"]
        if cfg.requires_srt_bridge:
            services.insert(3, "go2rtc-srt-bridge")
        return services

    def _content_drift(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> list[str]:
        drift: list[str] = []
        tag_script = (
            f"if test -x {shlex.quote(cfg.remote_go2rtc_bin)} && test -f {shlex.quote(cfg.remote_go2rtc_tag_file)}; "
            f"then cat {shlex.quote(cfg.remote_go2rtc_tag_file)}; fi"
        )
        try:
            remote_tag = self._run_bash(client, tag_script, timeout=30).strip()
        except Exception:
            remote_tag = ""
        if remote_tag != cfg.go2rtc_release_tag:
            drift.append("go2rtc binary")

        for item in self._desired_system_files(cfg):
            expected_hash = self._sha256_bytes(item["payload"])
            remote_hash = self._remote_file_sha256(client, item["remote_path"], use_sudo=bool(item["use_sudo"]))
            if remote_hash != expected_hash:
                drift.append(str(item["label"]))

        expected_www_hash = self._sha256_bytes(self._www_manifest_text(cfg).encode("ascii"))
        remote_www_hash = self._remote_file_sha256(client, cfg.remote_www_manifest)
        if remote_www_hash != expected_www_hash:
            drift.append("www")

        states = self._remote_service_states(client, self._required_services(cfg))
        for service in self._required_services(cfg):
            state = states.get(service, {})
            active = str(state.get("ActiveState") or "unknown")
            unit = str(state.get("UnitFileState") or "unknown")
            if active != "active" or unit not in {"enabled", "enabled-runtime", "static"}:
                drift.append(f"{service} state")
        drift.extend(self._tank_trouble_drift(client, cfg))
        drift.extend(self._web_console_drift(client, cfg))
        return drift

    def _tank_trouble_drift(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> list[str]:
        drift: list[str] = []
        expected_hash = self._tank_trouble_bundle_hash()
        remote_manifest = f"/home/{cfg.ssh_user}/.cloud-service-console/tank-trouble/bundle-manifest.json"
        script = f"""
if test -f {shlex.quote(remote_manifest)}; then
  python3 - {shlex.quote(remote_manifest)} <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8") or "{{}}")
print(payload.get("bundle_hash", ""))
PY
fi
"""
        try:
            remote_hash = self._run_bash(client, script, timeout=30).strip()
        except Exception:
            remote_hash = ""
        if remote_hash != expected_hash:
            drift.append("Tank Trouble cloud service")
        states = self._remote_service_states(client, ["cloud-service-console-tank-trouble"])
        state = states.get("cloud-service-console-tank-trouble", {})
        active = str(state.get("ActiveState") or "unknown")
        unit = str(state.get("UnitFileState") or "unknown")
        if active != "active" or unit not in {"enabled", "enabled-runtime", "static"}:
            drift.append("cloud-service-console-tank-trouble state")
        try:
            self._run_bash(client, f"curl -fsS --max-time 3 http://127.0.0.1:{TANK_GAME_SERVER_PORT}/health >/dev/null", timeout=10)
        except Exception:
            drift.append("Tank Trouble health")
        return drift

    def _web_console_drift(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> list[str]:
        drift: list[str] = []
        if not self._web_console_available():
            drift.append("web console bundle")
            return drift

        expected_manifest = self._web_console_manifest_payload(cfg)
        expected_bundle_hash = str(expected_manifest.get("bundleHash") or "")
        script = f"""
set -euo pipefail
MANIFEST={shlex.quote(cfg.web_console_manifest_path)}
if test -f "$MANIFEST"; then
  python3 - "$MANIFEST" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8") or "{{}}")
print(payload.get("bundleHash", ""))
PY
fi
"""
        try:
            remote_hash = self._run_bash(client, script, timeout=30).strip()
        except Exception:
            remote_hash = ""
        if remote_hash != expected_bundle_hash:
            drift.append("web console bundle")

        states = self._remote_service_states(client, [cfg.web_console_service])
        state = states.get(cfg.web_console_service, {})
        active = str(state.get("ActiveState") or "unknown")
        unit = str(state.get("UnitFileState") or "unknown")
        if active != "active" or unit not in {"enabled", "enabled-runtime", "static"}:
            drift.append(f"{cfg.web_console_service} state")
        return drift

    @staticmethod
    def _drift_label_text(label: str) -> str:
        label_map = {
            "www": "云端网页资源",
            "go2rtc binary": "go2rtc 二进制",
            "service startup state": "服务启动状态",
        }
        if label == "web console bundle":
            return "网页控制台"
        if label == "Tank Trouble cloud service":
            return "Tank Trouble cloud service"
        if label == "Tank Trouble health":
            return "Tank Trouble health"
        if label.endswith(".service"):
            return label
        if label.endswith(" state"):
            return label
        return label_map.get(label, label)

    def check_ready(self, client: CloudRemoteClient) -> tuple[bool, str]:
        self.ensure_bundle_files()
        try:
            cfg = self._resolve_bundle_config(client)
            drift = self._content_drift(client, cfg)
        except Exception:
            return False, "云端尚未完成配置"
        if drift:
            readable_drift = [self._drift_label_text(item) for item in drift]
            if len(readable_drift) == 1 and readable_drift[0] == "云端网页资源":
                return False, "云端网页资源需要同步"
            sample = ", ".join(readable_drift[:4])
            suffix = "" if len(readable_drift) <= 4 else f" 等 {len(readable_drift)} 项"
            return False, f"云端配置需要更新：{sample}{suffix}"
        return True, "环境已就绪"

    def _sync_www(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> bool:
        manifest_text = self._www_manifest_text(cfg)
        manifest_hash = self._sha256_bytes(manifest_text.encode("ascii"))
        remote_hash = self._remote_file_sha256(client, cfg.remote_www_manifest)
        if remote_hash == manifest_hash:
            return False

        self._run_bash(
            client,
            f"rm -rf {shlex.quote(cfg.remote_www)} && mkdir -p {shlex.quote(cfg.remote_www)}",
            timeout=60,
        )
        for remote_path, payload in sorted(self._www_payloads(cfg).items()):
            remote_dir = posixpath.dirname(remote_path)
            self._run_bash(client, f"mkdir -p {shlex.quote(remote_dir)}", timeout=30)
            client.put_bytes(remote_path, payload)
        client.put_text(cfg.remote_www_manifest, manifest_text, encoding="ascii")
        return True

    def _services_need_startup(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> bool:
        states = self._remote_service_states(client, self._required_services(cfg))
        for service in self._required_services(cfg):
            state = states.get(service, {})
            active = str(state.get("ActiveState") or "unknown")
            unit = str(state.get("UnitFileState") or "unknown")
            if active != "active" or unit in {"disabled", "masked", "bad", "not-found", "unknown"}:
                return True
        return False

    def _apply_changed_services(
        self,
        client: CloudRemoteClient,
        cfg: CloudBundleConfig,
        *,
        systemd_changed: bool,
        video_changed: bool,
        telemetry_changed: bool,
        control_changed: bool,
        turn_changed: bool,
        nginx_changed: bool,
        startup_changed: bool,
    ) -> None:
        if systemd_changed:
            self._run_bash(client, "sudo systemctl daemon-reload", timeout=60)

        if startup_changed:
            service_list = " ".join(shlex.quote(service) for service in self._required_services(cfg))
            self._run_bash(client, f"sudo systemctl enable --now {service_list} >/dev/null", timeout=90)
            if not cfg.requires_srt_bridge:
                self._run_bash(client, "sudo systemctl disable go2rtc-srt-bridge >/dev/null 2>&1 || true", timeout=30)

        if nginx_changed:
            self._run_bash(
                client,
                "sudo nginx -t >/dev/null && (sudo systemctl reload nginx || sudo systemctl restart nginx)",
                timeout=90,
            )

        if turn_changed:
            self._run_bash(client, "sudo systemctl restart coturn", timeout=60)

        if control_changed:
            self._run_bash(client, "sudo systemctl restart go2rtc-control-signaling", timeout=60)

        if video_changed:
            self._run_bash(client, "sudo systemctl restart go2rtc-cloud", timeout=60)
            if cfg.requires_srt_bridge:
                self._run_bash(client, "sudo systemctl restart go2rtc-srt-bridge", timeout=60)
            else:
                self._run_bash(client, "sudo systemctl stop go2rtc-srt-bridge >/dev/null 2>&1 || true", timeout=30)

        if telemetry_changed:
            self._run_bash(client, "sudo systemctl restart go2rtc-telemetry-relay", timeout=60)

    def _make_web_console_archive(self, cfg: CloudBundleConfig) -> tuple[bytes, dict[str, Any]]:
        self._ensure_web_console_bundle()
        manifest = self._web_console_manifest_payload(cfg)
        login_payload = self._web_console_login_payload(cfg)
        env_text = self._web_console_env_text(cfg)
        service_text = self._web_console_service(cfg)

        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
            for root, prefix in [
                (self.web_console_backend_dir, "backend"),
                (self.web_console_frontend_dist, "frontend/dist"),
            ]:
                for local_file in sorted(path for path in root.rglob("*") if path.is_file()):
                    relative_path = local_file.relative_to(root).as_posix()
                    relative_parts = set(local_file.relative_to(root).parts)
                    if relative_parts.intersection({"__pycache__", "build", "dist", "web_console_bundle"}):
                        continue
                    if local_file.suffix in {".pyc", ".pyo", ".spec"}:
                        continue
                    archive.add(local_file, arcname=posixpath.join("cloud-service-console-web", prefix, relative_path))

            generated_files = {
                "storage/cloud-console-login.json": json.dumps(
                    login_payload,
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                "cloud-console-web.env": env_text,
                "cloud-service-console-web.service": service_text,
                ".bundle-manifest.json": json.dumps(
                    manifest,
                    ensure_ascii=False,
                    sort_keys=True,
                    indent=2,
                )
                + "\n",
                "README.web-deploy.txt": (
                    "Cloud Service Console web deployment package generated by one-click setup.\n"
                    "This service is isolated from the go2rtc/control/Tank Trouble service controls.\n"
                ),
            }
            for relative_path, text in generated_files.items():
                data = text.encode("utf-8")
                info = tarfile.TarInfo(posixpath.join("cloud-service-console-web", relative_path))
                info.size = len(data)
                info.mtime = int(datetime.now(timezone.utc).timestamp())
                info.mode = 0o644
                archive.addfile(info, io.BytesIO(data))

        return buffer.getvalue(), manifest

    def _deploy_web_console(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> bool:
        archive_bytes, manifest = self._make_web_console_archive(cfg)
        expected_hash = str(manifest.get("bundleHash") or "")
        archive_hash = self._sha256_bytes(archive_bytes)
        remote_archive = f"/tmp/cloud-service-console-web-{archive_hash[:12]}.tar.gz"
        client.put_bytes(remote_archive, archive_bytes)

        script = f"""
set -euo pipefail
BASE={shlex.quote(cfg.web_console_remote_base)}
SERVICE={shlex.quote(cfg.web_console_service)}
PORT={shlex.quote(str(cfg.web_console_port))}
USER_NAME={shlex.quote(cfg.ssh_user)}
ARCHIVE={shlex.quote(remote_archive)}
EXPECTED_HASH={shlex.quote(expected_hash)}

install_packages() {{
  [ "$#" -gt 0 ] || return 0
  if command -v apt-get >/dev/null 2>&1; then
    sudo env DEBIAN_FRONTEND=noninteractive apt-get update
    sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y "$@"
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y "$@"
    return
  fi
  if command -v zypper >/dev/null 2>&1; then
    sudo zypper --non-interactive install "$@"
    return
  fi
  if command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache "$@"
    return
  fi
  echo "No supported Linux package manager found on the cloud host." >&2
  exit 1
}}

ensure_command() {{
  local command_name="$1"
  shift
  if command -v "$command_name" >/dev/null 2>&1; then
    return
  fi
  install_packages "$@"
  command -v "$command_name" >/dev/null 2>&1 || {{
    echo "Required command still missing after install: $command_name" >&2
    exit 1
  }}
}}

ensure_command python3 python3
ensure_command curl curl
ensure_command tar tar
ensure_command ss iproute2
PYTHON_MINOR="$(python3 - <<'PY'
import sys
print(f"python{{sys.version_info.major}}.{{sys.version_info.minor}}-venv")
PY
)"
ensure_venv() {{
  local probe_dir
  probe_dir="$(mktemp -d)"
  if python3 -m venv "$probe_dir/venv" >/dev/null 2>&1; then
    rm -rf "$probe_dir"
    return 0
  fi
  rm -rf "$probe_dir"
  install_packages "$PYTHON_MINOR" python3-venv python3-pip python3-setuptools || install_packages "$PYTHON_MINOR" python3-venv python3-pip
  probe_dir="$(mktemp -d)"
  python3 -m venv "$probe_dir/venv" >/dev/null 2>&1
  rm -rf "$probe_dir"
}}
ensure_venv

if ss -ltn | awk '{{print $4}}' | grep -Eq '(^|:)'"$PORT"'$'; then
  if ! systemctl is-active --quiet "$SERVICE"; then
    echo "Port $PORT is already in use by another service." >&2
    exit 7
  fi
fi

current_hash=""
if test -f "$BASE/.bundle-manifest.json"; then
  current_hash="$(python3 - "$BASE/.bundle-manifest.json" <<'PY' || true
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8") or "{{}}")
print(payload.get("bundleHash", ""))
PY
)"
fi
service_state="$(systemctl is-active "$SERVICE" 2>/dev/null || true)"
unit_state="$(systemctl is-enabled "$SERVICE" 2>/dev/null || true)"

changed=0
if [ "$current_hash" != "$EXPECTED_HASH" ]; then
  TMP_DIR="$(mktemp -d)"
  PRESERVED_RUNTIME_ENV="$(mktemp)"
  tar -xzf "$ARCHIVE" -C "$TMP_DIR"
  sudo mkdir -p "$BASE" "$BASE/storage"
  if [ -f "$BASE/cloud-console-web.env" ]; then
    grep -E '^(TELEBOT_CONTROL_SIGNAL_BASE_URL|TELEBOT_SIGNAL_ADMIN_TOKEN|TELEBOT_FRONTEND_SIGNAL_TOKEN|TELEBOT_COMPUTE_SIGNAL_TOKEN|TELEBOT_CAPTURE_UPLOAD_TOKEN)=' \
      "$BASE/cloud-console-web.env" > "$PRESERVED_RUNTIME_ENV" || true
  fi
  sudo rm -rf "$BASE/backend" "$BASE/frontend" "$BASE/cloud-console-web.env" "$BASE/cloud-service-console-web.service" "$BASE/README.web-deploy.txt" "$BASE/.bundle-manifest.json"
  sudo cp -a "$TMP_DIR/cloud-service-console-web/backend" "$BASE/backend"
  sudo cp -a "$TMP_DIR/cloud-service-console-web/frontend" "$BASE/frontend"
  sudo cp -a "$TMP_DIR/cloud-service-console-web/cloud-console-web.env" "$BASE/cloud-console-web.env"
  sudo cp -a "$TMP_DIR/cloud-service-console-web/cloud-service-console-web.service" "$BASE/cloud-service-console-web.service"
  sudo cp -a "$TMP_DIR/cloud-service-console-web/README.web-deploy.txt" "$BASE/README.web-deploy.txt"
  sudo cp -a "$TMP_DIR/cloud-service-console-web/.bundle-manifest.json" "$BASE/.bundle-manifest.json"
  if [ ! -f "$BASE/storage/cloud-console-login.json" ]; then
    sudo cp -a "$TMP_DIR/cloud-service-console-web/storage/cloud-console-login.json" "$BASE/storage/cloud-console-login.json"
  fi
  if [ -s "$PRESERVED_RUNTIME_ENV" ]; then
    sudo tee -a "$BASE/cloud-console-web.env" < "$PRESERVED_RUNTIME_ENV" >/dev/null
  fi
  sudo chmod 0600 "$BASE/cloud-console-web.env"
  rm -rf "$TMP_DIR" "$PRESERVED_RUNTIME_ENV"
  changed=1
fi

sudo chown -R "$USER_NAME":"$USER_NAME" "$BASE"
if [ "$changed" -eq 1 ] || [ ! -x "$BASE/.venv/bin/python" ]; then
  rm -rf "$BASE/.venv"
  python3 -m venv "$BASE/.venv"
  "$BASE/.venv/bin/python" -m pip install --upgrade pip >/dev/null
  "$BASE/.venv/bin/python" -m pip install -r "$BASE/backend/requirements.txt" >/dev/null
  changed=1
fi

sudo install -m 0644 "$BASE/cloud-service-console-web.service" "/etc/systemd/system/$SERVICE.service"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE" >/dev/null
if [ "$changed" -eq 1 ] || [ "$service_state" != "active" ] || [ "$unit_state" != "enabled" ]; then
  sudo systemctl restart "$SERVICE"
  changed=1
fi

rm -f "$ARCHIVE"
sleep 2
systemctl is-active --quiet "$SERVICE"
set -a
. "$BASE/cloud-console-web.env"
set +a
curl -fsS -H "Authorization: Bearer $CLOUD_CONSOLE_ADMIN_TOKEN" "http://127.0.0.1:$PORT/api/health" >/dev/null
printf 'WEB_CONSOLE_CHANGED=%s\\n' "$changed"
"""
        output = self._run_bash(client, script, timeout=600)
        return "WEB_CONSOLE_CHANGED=1" in output

    def deploy(self, client: CloudRemoteClient, ingest_mode: str | None = None) -> CloudDeployResult:
        self.ensure_bundle_files()
        cfg = self._resolve_bundle_config(client, ingest_mode)

        self._prepare_remote_base(client, cfg)
        go2rtc_binary_changed = self._install_remote_packages(client, cfg)

        changed_groups = {
            "video": bool(go2rtc_binary_changed),
            "telemetry": False,
            "control": False,
            "turn": False,
            "nginx": False,
            "www": False,
            "systemd": False,
        }
        changed_labels: list[str] = []

        if go2rtc_binary_changed:
            changed_labels.append("go2rtc binary")

        for item in self._desired_system_files(cfg):
            changed = self._sync_remote_bytes(
                client,
                remote_path=item["remote_path"],
                payload=item["payload"],
                label=str(item["label"]),
                use_sudo=bool(item["use_sudo"]),
            )
            if not changed:
                continue
            label = str(item["label"])
            group = str(item["group"])
            changed_labels.append(label)
            changed_groups[group] = True
            if label.endswith(".service"):
                changed_groups["systemd"] = True

        if self._sync_www(client, cfg):
            changed_groups["www"] = True
            changed_labels.append("www")

        startup_changed = self._services_need_startup(client, cfg)
        if startup_changed:
            changed_labels.append("service startup state")

        self._apply_changed_services(
            client,
            cfg,
            systemd_changed=changed_groups["systemd"],
            video_changed=changed_groups["video"],
            telemetry_changed=changed_groups["telemetry"],
            control_changed=changed_groups["control"],
            turn_changed=changed_groups["turn"],
            nginx_changed=changed_groups["nginx"],
            startup_changed=startup_changed,
        )

        if self._deploy_web_console(client, cfg):
            changed_labels.append("web console bundle")

        if self._ensure_tank_trouble_service(client, cfg):
            changed_labels.append("Tank Trouble cloud service")

        self._verify_remote_health(client, cfg, full_environment=True)
        changed = bool(changed_labels)
        summary = changed_labels if changed_labels else ["all cloud files are already current; no services were touched"]
        return CloudDeployResult(changed=changed, summary=summary)

    def switch_ingest_mode(self, client: CloudRemoteClient, ingest_mode: str) -> CloudBundleConfig:
        self.ensure_bundle_files()
        cfg = self._resolve_bundle_config(client, ingest_mode)
        bridge_changed = self._sync_remote_text(
            client,
            remote_path="/etc/systemd/system/go2rtc-srt-bridge.service",
            text=self._ingest_bridge_service(cfg),
            label="go2rtc-srt-bridge.service",
            encoding="ascii",
            use_sudo=True,
        )
        nginx_changed = self._sync_remote_text(
            client,
            remote_path="/etc/nginx/conf.d/go2rtc-cloud.conf",
            text=self._nginx_config(cfg),
            label="go2rtc-cloud.conf",
            encoding="ascii",
            use_sudo=True,
        )
        self._apply_changed_services(
            client,
            cfg,
            systemd_changed=bridge_changed,
            video_changed=bridge_changed,
            telemetry_changed=False,
            control_changed=False,
            turn_changed=False,
            nginx_changed=nginx_changed,
            startup_changed=True,
        )
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
        client.put_text(
            cfg.remote_runtime_status_path,
            json.dumps(
                self._runtime_status_payload(cfg, state="stopped", status_reason="deploy_initialized"),
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    def _install_remote_packages(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> bool:
        script = f"""
set -euo pipefail
REMOTE_BASE={shlex.quote(cfg.remote_base)}
BIN_PATH="$REMOTE_BASE/go2rtc"
TAG={shlex.quote(cfg.go2rtc_release_tag)}
TAG_FILE="$REMOTE_BASE/.go2rtc-release-tag"
TMP_BIN="/tmp/go2rtc_linux_amd64"

install_packages() {{
  [ "$#" -gt 0 ] || return 0
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y "$@"
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y "$@"
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y "$@"
    return
  fi
  if command -v zypper >/dev/null 2>&1; then
    sudo zypper --non-interactive install "$@"
    return
  fi
  if command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache "$@"
    return
  fi
  echo "No supported Linux package manager found on the cloud host." >&2
  exit 1
}}

ensure_command() {{
  local command_name="$1"
  shift
  if command -v "$command_name" >/dev/null 2>&1; then
    return
  fi
  install_packages "$@"
  command -v "$command_name" >/dev/null 2>&1 || {{
    echo "Required command still missing after install: $command_name" >&2
    exit 1
  }}
}}

ensure_command curl curl
ensure_command nginx nginx
ensure_command turnserver coturn
ensure_command python3 python3
ensure_command ffmpeg ffmpeg
ensure_command ss iproute2

go2rtc_binary_updated=0
current_tag=""
if [ -f "$TAG_FILE" ]; then
  current_tag="$(cat "$TAG_FILE" 2>/dev/null || true)"
fi

if [ ! -x "$BIN_PATH" ] || [ "$current_tag" != "$TAG" ]; then
  URL="https://github.com/AlexxIT/go2rtc/releases/download/$TAG/go2rtc_linux_amd64"
  curl -fsSL "$URL" -o "$TMP_BIN"
  sudo mv "$TMP_BIN" "$BIN_PATH"
  sudo chmod 755 "$BIN_PATH"
  printf '%s\\n' "$TAG" > "$TAG_FILE"
  go2rtc_binary_updated=1
fi

if ! python3 -c "import aiohttp" >/dev/null 2>&1; then
  if ! install_packages python3-aiohttp; then
    python3 -m pip install --user --disable-pip-version-check aiohttp >/dev/null 2>&1 || \
      python3 -m pip install --user --disable-pip-version-check --break-system-packages aiohttp >/dev/null 2>&1
  fi
fi
python3 -c "import aiohttp" >/dev/null 2>&1
printf 'GO2RTC_BINARY_UPDATED=%s\\n' "$go2rtc_binary_updated"
"""
        output = self._run_bash(client, script, timeout=300)
        return "GO2RTC_BINARY_UPDATED=1" in output

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
sudo systemctl enable --now go2rtc-control-signaling
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

    def _verify_remote_health(
        self,
        client: CloudRemoteClient,
        cfg: CloudBundleConfig,
        *,
        full_environment: bool = False,
    ) -> None:
        health_urls = [
            f"http://127.0.0.1:{cfg.api_port}/clock",
            f"http://127.0.0.1:{cfg.api_port}/api/streams",
            f"http://127.0.0.1:{cfg.api_port}/telemetry/status",
            f"http://127.0.0.1:{cfg.api_port}/api/video/status",
            f"http://127.0.0.1:{cfg.control_signaling_internal_port}/control/webrtc/health",
            f"http://127.0.0.1:{cfg.api_port}/control/webrtc/health",
            f"http://127.0.0.1:{cfg.api_port}/control/webrtc/status",
            f"http://127.0.0.1:{cfg.api_port}/control/monitor/key-state?session=robot-control",
        ]
        port_parts = [
            str(cfg.api_port),
            str(cfg.ingest_port),
            str(cfg.internal_api_port),
            str(cfg.telemetry_internal_port),
            str(cfg.control_signaling_internal_port),
            str(cfg.webrtc_port),
            str(cfg.srt_ingest_port),
            str(cfg.rtsp_port),
            "3478",
        ]
        web_console_check = ""
        if full_environment:
            health_urls.append(f"http://127.0.0.1:{TANK_GAME_SERVER_PORT}/health")
            port_parts.extend([str(TANK_GAME_SERVER_PORT), str(cfg.web_console_port)])
            web_console_check = f"""
set -a
. {shlex.quote(cfg.web_console_env_path)}
set +a
curl -fsS -H "Authorization: Bearer $CLOUD_CONSOLE_ADMIN_TOKEN" "http://127.0.0.1:{cfg.web_console_port}/api/health" >/dev/null
"""
        port_list = "|".join(dict.fromkeys(port_parts))
        script = f"""
set -euo pipefail
python3 - <<'PY'
import json
import urllib.request
for url in {json.dumps(health_urls)}:
    with urllib.request.urlopen(url, timeout=5) as response:
        response.read()
PY
{web_console_check}
ss -ltnup | grep -E ':({port_list}) ' || true
"""
        self._run_bash(client, script, timeout=90)

    def _ensure_tank_trouble_service(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> bool:
        script_path = self.root / "tank_trouble_room.py"
        if not script_path.is_file():
            raise RuntimeError(f"Tank Trouble cloud script not found: {script_path}")

        remote_base = f"/home/{cfg.ssh_user}/.cloud-service-console/tank-trouble"
        remote_script = posixpath.join(remote_base, "tank_trouble_room.py")
        service_name = "cloud-service-console-tank-trouble"
        bundle_hash = self._tank_trouble_bundle_hash()
        remote_manifest = posixpath.join(remote_base, "bundle-manifest.json")

        changed = False
        manifest_script = f"""
if test -f {shlex.quote(remote_manifest)}; then
  python3 - {shlex.quote(remote_manifest)} <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8") or "{{}}")
print(payload.get("bundle_hash", ""))
PY
fi
"""
        try:
            remote_hash = self._run_bash(client, manifest_script, timeout=30).strip()
        except Exception:
            remote_hash = ""

        if remote_hash != bundle_hash or changed:
            self._sync_tank_trouble_bundle(client, cfg, remote_base, remote_script, remote_manifest, bundle_hash)
            changed = True

        service_text = self._tank_trouble_service(cfg, remote_base, remote_script)
        if self._sync_remote_text(
            client,
            remote_path=f"/etc/systemd/system/{service_name}.service",
            text=service_text,
            label=f"{service_name}.service",
            use_sudo=True,
        ):
            changed = True
            self._run_bash(client, "sudo systemctl daemon-reload", timeout=60)

        startup_script = f"""
set -euo pipefail
changed=0
state="$(systemctl is-active {shlex.quote(service_name)} 2>/dev/null || true)"
enabled="$(systemctl is-enabled {shlex.quote(service_name)} 2>/dev/null || true)"
sudo systemctl enable --now {shlex.quote(service_name)} >/dev/null
if [ "$state" != "active" ] || [ "$enabled" != "enabled" ]; then
  changed=1
fi
if [ {1 if changed else 0} -eq 1 ]; then
  sudo systemctl restart {shlex.quote(service_name)}
  changed=1
fi
sleep 1
curl -fsS --max-time 5 http://127.0.0.1:{TANK_GAME_SERVER_PORT}/health >/dev/null
printf 'TANK_TROUBLE_CHANGED=%s\\n' "$changed"
"""
        output = self._run_bash(client, startup_script, timeout=90)
        return changed or "TANK_TROUBLE_CHANGED=1" in output

    def _tank_trouble_bundle_hash(self) -> str:
        script_path = self.root / "tank_trouble_room.py"
        hasher = hashlib.sha256()
        files: list[Path] = [script_path]
        assets_root = self.www_dir / "tank-trouble"
        if assets_root.exists():
            files.extend(sorted(path for path in assets_root.rglob("*") if path.is_file()))
        for path in files:
            relative_path = path.relative_to(self.root).as_posix()
            data = path.read_bytes()
            hasher.update(relative_path.encode("utf-8"))
            hasher.update(b"\0")
            hasher.update(str(len(data)).encode("ascii"))
            hasher.update(b"\0")
            hasher.update(data)
        return hasher.hexdigest()

    def _sync_tank_trouble_bundle(
        self,
        client: CloudRemoteClient,
        cfg: CloudBundleConfig,
        remote_base: str,
        remote_script: str,
        remote_manifest: str,
        bundle_hash: str,
    ) -> None:
        self._run_bash(
            client,
            f"mkdir -p {shlex.quote(remote_base)} {shlex.quote(posixpath.join(remote_base, 'www', 'tank-trouble'))} && chmod 700 {shlex.quote(remote_base)}",
            timeout=30,
        )
        client.put_file(self.root / "tank_trouble_room.py", remote_script)
        assets_root = self.www_dir / "tank-trouble"
        asset_count = 0
        if assets_root.exists():
            for local_path in sorted(path for path in assets_root.rglob("*") if path.is_file()):
                relative_path = local_path.relative_to(assets_root).as_posix()
                remote_path = posixpath.join(remote_base, "www", "tank-trouble", relative_path)
                self._run_bash(client, f"mkdir -p {shlex.quote(posixpath.dirname(remote_path))}", timeout=20)
                client.put_file(local_path, remote_path)
                asset_count += 1
        manifest = {
            "format": 1,
            "bundle_hash": bundle_hash,
            "script": "tank_trouble_room.py",
            "asset_count": asset_count,
        }
        client.put_text(
            remote_manifest,
            json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
            encoding="utf-8",
        )
        self._run_bash(client, f"chmod 755 {shlex.quote(remote_script)}", timeout=20)

    @staticmethod
    def _tank_trouble_service(cfg: CloudBundleConfig, remote_base: str, remote_script: str) -> str:
        return f"""[Unit]
Description=Cloud Service Console Tank Trouble room server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={cfg.ssh_user}
WorkingDirectory={remote_base}
ExecStart=/usr/bin/python3 {remote_script} --serve --port {TANK_GAME_SERVER_PORT} --idle-timeout 0
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
"""

    def _ensure_tank_trouble_proxy(self, client: CloudRemoteClient, cfg: CloudBundleConfig) -> None:
        block = self._tank_trouble_proxy_block()
        block_b64 = self._b64_text(block)
        script = f"""
set -euo pipefail
MAIN_CONF=/etc/nginx/conf.d/go2rtc-cloud.conf
export BLOCK_B64={shlex.quote(block_b64)}
export PREFIX={shlex.quote(TANK_TROUBLE_PUBLIC_PATH_PREFIX)}
tmp_conf="$(mktemp)"
sudo cp "$MAIN_CONF" "$tmp_conf"
python3 - "$tmp_conf" <<'PY'
import base64
import os
import sys
from pathlib import Path

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
sudo nginx -t >/dev/null
sudo systemctl reload nginx || sudo systemctl restart nginx
"""
        self._run_bash(client, script, timeout=60)

    @staticmethod
    def _b64_text(text: str) -> str:
        import base64

        return base64.b64encode(text.encode("utf-8")).decode("ascii")

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
Environment=VIDEO_STREAM_NAME={cfg.stream_name}
Environment=GO2RTC_REMOTE_BASE={cfg.remote_base}
Environment=GO2RTC_STREAMS_URL=http://127.0.0.1:{cfg.internal_api_port}/api/streams
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
EnvironmentFile=-{cfg.remote_base}/control-signaling.env
ExecStart=/usr/bin/python3 {cfg.remote_control_script} --host 127.0.0.1 --port {cfg.control_signaling_internal_port}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
"""

    @staticmethod
    def _turnserver_config(cfg: CloudBundleConfig) -> str:
        relay_ip = str(cfg.turn_relay_ip or "").strip()
        relay_lines = ""
        external_ip = cfg.public_host
        if relay_ip:
            relay_lines = f"relay-ip={relay_ip}\n"
            external_ip = f"{cfg.public_host}/{relay_ip}"
        return f"""listening-port=3478
fingerprint
lt-cred-mech
realm=go2rtc-telemetry
user={cfg.turn_user}:{cfg.turn_credential}
listening-ip=0.0.0.0
{relay_lines}external-ip={external_ip}
min-port={cfg.turn_relay_min_port}
max-port={cfg.turn_relay_max_port}
allowed-peer-ip={cfg.public_host}
allow-loopback-peers
no-tls
no-dtls
no-cli
stale-nonce
no-multicast-peers
"""

    @staticmethod
    def _tank_trouble_proxy_block() -> str:
        return f"""
    # BEGIN Cloud Service Console Tank Trouble
    location = {TANK_TROUBLE_PUBLIC_PATH_PREFIX} {{
        return 301 {TANK_TROUBLE_PUBLIC_PATH_PREFIX}/;
    }}

    location {TANK_TROUBLE_PUBLIC_PATH_PREFIX}/ {{
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
        tank_trouble_proxy_block = CloudSetupBundle._tank_trouble_proxy_block().rstrip()

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

    location /api/video/ {{
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:{cfg.telemetry_internal_port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }}

    location /command/webrtc/ {{
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:{cfg.control_signaling_internal_port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }}

    location /control/monitor/ {{
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

{tank_trouble_proxy_block}

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

    def _video_endpoints_manifest(self, cfg: CloudBundleConfig) -> dict[str, Any]:
        return {
            "generatedAt": self._generated_at_iso(),
            "streamName": cfg.stream_name,
            "viewerUrl": cfg.viewer_url,
            "stableViewerUrl": f"{cfg.public_base_url}/{cfg.stream_name}.html",
            "cleanViewerUrl": f"{cfg.viewer_url}&clean=1",
            "stableCleanViewerUrl": f"{cfg.public_base_url}/{cfg.stream_name}-video.html",
            "runtimeStatusUrl": cfg.runtime_status_url,
            "videoStatusUrl": cfg.video_status_url,
            "signalUrl": cfg.signal_url,
            "viewerPage": cfg.viewer_url,
            "signalPath": f"/api/ws?src={cfg.stream_name}",
            "publicScheme": cfg.public_scheme,
            "publicHost": cfg.public_host,
            "apiPort": cfg.api_port,
            "ingestPort": cfg.ingest_port,
            "srtIngestPort": cfg.srt_ingest_port,
            "ingestMode": cfg.normalized_ingest_mode,
            "uploadProtocol": cfg.upload_protocol,
            "webrtcPort": cfg.webrtc_port,
            "ingestUrl": cfg.selected_ingest_url,
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

    def _runtime_status_payload(self, cfg: CloudBundleConfig, *, state: str, status_reason: str) -> dict[str, Any]:
        generated_at = datetime.now(timezone.utc).isoformat()
        return {
            "generatedAt": generated_at,
            "videoMode": "legacy",
            "streamName": cfg.stream_name,
            "state": state,
            "lastHeartbeatAt": generated_at,
            "heartbeatIntervalSec": None,
            "statusReason": status_reason,
            "encoderName": None,
            "encoderMode": "unknown",
            "encoderDisplay": "Unknown",
            "isHardwareEncoder": False,
            "processId": None,
            "ingestMode": cfg.normalized_ingest_mode,
            "uploadProtocol": cfg.upload_protocol,
            "webrtcPublishMode": "",
            "delayMeasurementMode": "receiver-only",
            "hiddenDelayMarkerEnabled": False,
            "sourcePlatform": None,
            "sourceHost": None,
            "runtimeStatusUrl": cfg.runtime_status_url,
        }
