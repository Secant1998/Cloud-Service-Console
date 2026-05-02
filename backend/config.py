from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_BACKEND_HOST = "127.0.0.1"
DEFAULT_BACKEND_PORT = 8765
APP_STORAGE_DIRNAME = "CloudServiceConsole"
LOGIN_SETTINGS_FILENAME = "cloud-console-login.json"
BUILTIN_CONFIG_PATH = Path("built-in-defaults")
BUILTIN_PUBLIC_SCHEME = "http"
BUILTIN_API_PORT = 18081
BUILTIN_SSH_PORT = 22
BUILTIN_SSH_USER = "ubuntu"
BUILTIN_DEFAULT_HOST = "150.109.100.30"
TANK_GAME_SERVER_PORT = 18086
TANK_GAME_SERVER_IDLE_TIMEOUT = 30

REMOTE_SERVICE_ORDER = [
    "nginx",
    "go2rtc-cloud",
    "go2rtc-srt-bridge",
    "go2rtc-control-signaling",
]

REMOTE_SERVICE_STOP_ORDER = [
    "go2rtc-srt-bridge",
    "go2rtc-control-signaling",
    "go2rtc-cloud",
    "nginx",
]

REMOTE_SERVICE_META = {
    "nginx": {
        "title": "Nginx Gateway",
        "description": "Port 18081 public HTTP entry",
    },
    "go2rtc-cloud": {
        "title": "go2rtc Cloud",
        "description": "Video pages and WebRTC signaling",
    },
    "go2rtc-srt-bridge": {
        "title": "Ingest Bridge",
        "description": "Video ingest listener and RTSP republisher",
    },
    "go2rtc-control-signaling": {
        "title": "Control Signaling",
        "description": "Browser and robot WebRTC broker",
    },
}

REMOTE_PORT_META = [
    {"key": "ssh", "title": "SSH", "port": BUILTIN_SSH_PORT, "protocols": ["tcp"]},
    {"key": "public-http", "title": "Public HTTP", "port": BUILTIN_API_PORT, "protocols": ["tcp"]},
    {"key": "internal-api", "title": "Internal API", "port": 18082, "protocols": ["tcp"]},
    {"key": "ingest-http", "title": "Ingest HTTP", "port": 18084, "protocols": ["tcp"]},
    {"key": "webrtc", "title": "WebRTC", "port": 19090, "protocols": ["udp", "tcp"]},
    {"key": "srt", "title": "SRT", "port": 19091, "protocols": ["udp"]},
    {"key": "rtsp", "title": "RTSP", "port": 8554, "protocols": ["tcp"]},
    {"key": "tank-game", "title": "Tank Game", "port": TANK_GAME_SERVER_PORT, "protocols": ["tcp"]},
]

HEALTH_CHECK_ORDER = ["clock", "streams", "control"]

HEALTH_CHECK_META = {
    "clock": {"title": "Clock", "description": "/clock"},
    "streams": {"title": "Streams API", "description": "/api/streams"},
    "control": {"title": "Control Health", "description": "/control/webrtc/health"},
}


@dataclass
class AppDefaults:
    config_path: Path
    project_dir: Path
    app_dir: Path
    public_scheme: str
    api_port: int
    ssh_port: int
    default_host: str
    default_ssh_user: str

    def build_runtime_config(self, host: str, username: str, password: str) -> "CloudRuntimeConfig":
        clean_host = normalize_host(host)
        clean_user = str(username or "").strip() or self.default_ssh_user
        clean_password = str(password or "")

        if not clean_host:
            raise RuntimeError("Cloud server IP is required.")
        if not clean_user:
            raise RuntimeError("SSH username is required.")
        if not clean_password:
            raise RuntimeError("SSH password is required.")

        return CloudRuntimeConfig(
            config_path=self.config_path,
            project_dir=self.project_dir,
            app_dir=self.app_dir,
            public_scheme=self.public_scheme,
            public_host=clean_host,
            api_port=self.api_port,
            ssh_host=clean_host,
            ssh_port=self.ssh_port,
            ssh_user=clean_user,
            ssh_password=clean_password,
        )


@dataclass
class CloudRuntimeConfig:
    config_path: Path
    project_dir: Path
    app_dir: Path
    public_scheme: str
    public_host: str
    api_port: int
    ssh_host: str
    ssh_port: int
    ssh_user: str
    ssh_password: str

    @property
    def public_base_url(self) -> str:
        default_port = 443 if self.public_scheme == "https" else 80
        if self.api_port == default_port:
            return f"{self.public_scheme}://{self.public_host}"
        return f"{self.public_scheme}://{self.public_host}:{self.api_port}"

    @property
    def ssh_target(self) -> str:
        return f"{self.ssh_user}@{self.ssh_host}"

    @property
    def clock_url(self) -> str:
        return f"{self.public_base_url}/clock"

    @property
    def streams_url(self) -> str:
        return f"{self.public_base_url}/api/streams"

    @property
    def control_health_url(self) -> str:
        return f"{self.public_base_url}/control/webrtc/health"

    @property
    def control_status_url(self) -> str:
        return f"{self.public_base_url}/control/webrtc/status"


@dataclass
class LoginSettings:
    host: str
    username: str
    password: str
    remember_password: bool
    auto_login: bool


def normalize_host(raw_value: str) -> str:
    text = str(raw_value or "").strip()
    if not text:
        return ""

    if "://" in text:
        parsed = urlparse(text)
        text = parsed.hostname or parsed.netloc or parsed.path or text

    text = text.split("/", 1)[0].strip()
    if text.count(":") == 1:
        host_part, port_part = text.rsplit(":", 1)
        if port_part.isdigit():
            text = host_part

    return text.strip().strip("[]")


def get_project_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def get_runtime_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.argv[0]).resolve().parent
    return get_project_dir()


def get_user_data_dir() -> Path:
    if sys.platform.startswith("win"):
        base_dir = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base_dir = Path.home() / "Library" / "Application Support"
    else:
        base_dir = Path(os.environ.get("XDG_DATA_HOME") or (Path.home() / ".local" / "share"))

    app_dir = base_dir / APP_STORAGE_DIRNAME
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir


def get_legacy_data_dir() -> Path:
    return get_runtime_dir() / "data"


def get_login_settings_path(app_dir: Path) -> Path:
    return app_dir / LOGIN_SETTINGS_FILENAME


def load_config_defaults(config_path: Path | None = None, project_dir: Path | None = None) -> AppDefaults:
    resolved_project_dir = (project_dir or get_project_dir()).resolve()
    app_dir = get_user_data_dir()

    return AppDefaults(
        config_path=config_path or BUILTIN_CONFIG_PATH,
        project_dir=resolved_project_dir,
        app_dir=app_dir,
        public_scheme=BUILTIN_PUBLIC_SCHEME,
        api_port=BUILTIN_API_PORT,
        ssh_port=BUILTIN_SSH_PORT,
        default_host=BUILTIN_DEFAULT_HOST,
        default_ssh_user=BUILTIN_SSH_USER,
    )
