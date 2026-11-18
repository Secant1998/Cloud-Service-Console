from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import math
import os
import base64
import secrets
import shlex
import socket
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.parse import quote
from urllib.request import Request, build_opener, urlopen

import uvicorn
from fastapi import FastAPI, HTTPException, Request as FastAPIRequest, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from auth_store import AccountStore, AgentSettingsStore
from capture_store import CaptureFileStore
from model_library import ModelLibrary, create_model_router
from capture_tasks import (
    CaptureTaskStore,
    TaskConflict,
    validate_recovery_artifact,
    validate_recovery_filename,
)
from cloud_client import CloudRemoteClient
from cloud_setup import CloudSetupBundle
from config import (
    DEFAULT_BACKEND_HOST,
    DEFAULT_BACKEND_PORT,
    HEALTH_CHECK_META,
    HEALTH_CHECK_ORDER,
    REMOTE_PORT_META,
    REMOTE_SERVICE_META,
    REMOTE_SERVICE_ORDER,
    TANK_GAME_SERVER_PORT,
    load_config_defaults,
    normalize_host,
)
from health_checker import HealthChecker
from local_stream import LocalStreamManager
from p2p_local_pusher import P2PLocalPusherManager
from log_store import LogStore
from models import (
    AccountAvatarRequest,
    AccountAvatarResponse,
    AccountDeviceLoginRequest,
    AccountLoginRequest,
    AccountRegisterRequest,
    AccountSessionResponse,
    AdminUserListResponse,
    AgentConnectionTestResponse,
    AgentSettingsRequest,
    AgentSettingsResponse,
    ApiResponse,
    CaptureFileListResponse,
    CaptureUploadResponse,
    ControlMonitorConfigResponse,
    ControlMonitorKeyStateResponse,
    ControlMonitorOfferResponse,
    ControlSessionDescription,
    DashboardStatus,
    HealthCheckStatus,
    IngestModeResult,
    IngestModeSwitchRequest,
    LoginRequest,
    LoginSettingsResponse,
    LocalSetupResult,
    LocalSetupRunRequest,
    LocalSetupStatus,
    LocalStreamConfig,
    LocalStreamStatus,
    LogsResponse,
    NetworkEndpointStatus,
    NetworkSnapshot,
    P2PLocalPusherStatus,
    PortChecksResponse,
    PortStatus,
    ServiceStatus,
    SettingsRequest,
    TankTroubleMatchRequest,
    TankTroubleMatchState,
    TankTroubleLatencyRequest,
    TankTroubleLatencyState,
    TankTroublePreviewClearRequest,
    TankTroublePreviewPushRequest,
    TankTroublePageUrlResponse,
    TankTroubleRoomRequest,
    TankTroubleRoomStatusRequest,
    TankTroubleRoomState,
    TankTroubleSetupResult,
    TankTroubleSetupStatus,
    TrafficInterfaceStatus,
    TrafficMonitorSnapshot,
    TrafficServiceStatus,
)
from service_manager import ServiceManager
from settings_store import load_login_settings, save_login_settings
from tank_trouble_cloud import TankTroubleCloudBridge
from tank_trouble_preview_page import build_tank_trouble_preview_html as render_tank_trouble_preview_html
from tank_trouble_preview_runtime import TankTroublePreviewRuntime

IPAPI_BASE_URL = "http://ip-api.com/json"
IPWHOIS_BASE_URL = "https://ipwho.is"
NETWORK_SNAPSHOT_TTL_SECONDS = 20
NETWORK_LOOKUP_TIMEOUT_SECONDS = 1.5
VIDEO_PREVIEW_STREAM_NAME = "main-camera"
VIDEO_PREVIEW_TIMEOUT_SECONDS = 15
VIDEO_STATUS_TIMEOUT_SECONDS = 4
CONTROL_MONITOR_DEFAULT_SESSION = "robot-control"
CONTROL_MONITOR_COMMAND_SESSION = "robot-command"
CONTROL_MONITOR_POLL_INTERVAL_SEC = 0.05
CONTROL_MONITOR_TURN_PORT = 3478
CONTROL_MONITOR_TURN_USERNAME = "telemetry"
CONTROL_MONITOR_TURN_CREDENTIAL = "123456"
CONTROL_MONITOR_REQUEST_TIMEOUT_SECONDS = 25
CONTROL_MONITOR_KEY_STATE_TIMEOUT_SECONDS = 2
CONTROL_MONITOR_STATUS_FALLBACK_TIMEOUT_SECONDS = 2
CONTROL_MONITOR_CLIENT_STALE_GRACE_MS = 300
CONTROL_MONITOR_ROBOT_POLL_FRESH_MS = 5000
CONTROL_MONITOR_SIGNAL_PAIR_FRESH_MS = 15000
CONTROL_SIGNAL_BASE_URL_ENV = "TELEBOT_CONTROL_SIGNAL_BASE_URL"
CONTROL_SIGNAL_ADMIN_TOKEN_ENV = "TELEBOT_SIGNAL_ADMIN_TOKEN"
CONTROL_SIGNAL_COMPUTE_TOKEN_ENV = "TELEBOT_COMPUTE_SIGNAL_TOKEN"
CONTROL_SIGNAL_FRONTEND_TOKEN_ENV = "TELEBOT_FRONTEND_SIGNAL_TOKEN"
CAPTURE_UPLOAD_TOKEN_ENV = "TELEBOT_CAPTURE_UPLOAD_TOKEN"
P2P_V2_FRONTEND_TOKEN_SHA256_ENV = "P2P_V2_FRONTEND_TOKEN_SHA256"
P2P_V2_COMPUTE_TOKEN_SHA256_ENV = "P2P_V2_COMPUTE_TOKEN_SHA256"
CAPTURE_UPLOAD_PATH = "/api/captures/upload"
STATUS_LIVE_CACHE_TTL_SECONDS = 1.5
TRAFFIC_MONITOR_CACHE_TTL_SECONDS = 1.0
CONTROL_MONITOR_KEY_STATE_CACHE_TTL_SECONDS = 0.1
ONLINE_CLIENT_TTL_SECONDS = 45.0
WEB_MODE = os.environ.get("CLOUD_CONSOLE_WEB_MODE", "").strip().lower() in {"1", "true", "yes", "on"}
WEB_FRONTEND_DIST = Path(os.environ.get("CLOUD_CONSOLE_FRONTEND_DIST") or "").expanduser()
WEB_PUBLIC_PATHS = (
    "/api/health",
    "/api/access",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/device-login",
    "/api/auth/logout",
)
WEB_SAFE_PATH_PREFIXES = (
    "/api/account/",
    "/api/access",
    "/api/health",
    "/api/settings",
    "/api/login",
    "/api/logout",
    "/api/status",
    "/api/status/live",
    "/api/refresh",
    "/api/traffic-monitor",
    "/api/network-snapshot",
    "/api/video/status",
    "/api/video/tencent/",
    "/api/video-preview.mp4",
    "/api/local-stream/",
    "/api/control-monitor/",
    "/api/games/tank-trouble/room/status",
    "/api/games/tank-trouble/spectator/page-url",
    "/api/games/tank-trouble/room/sync",
    "/api/games/tank-trouble/room/vote-toggle",
    "/api/games/tank-trouble/room/leave",
    "/api/games/tank-trouble/match/",
    "/api/games/tank-trouble/latency/",
    "/api/games/tank-trouble/preview/",
    "/tank-trouble/preview",
    "/api/ports/check-all",
    "/api/ports/",
    "/api/logs",
    "/api/local-setup/check",
    "/api/online/",
    "/api/agent/settings",
    "/api/captures/",
    "/api/model-library",
)
WEB_ADMIN_ONLY_PATH_PREFIXES = (
    "/api/admin/",
    "/api/local-setup/run",
    "/api/services/",
    "/api/ingest-mode/switch",
    "/api/games/tank-trouble/setup/run",
)
CONTROL_MONITOR_CONNECTED_CALL_STATES = {
    "connected",
    "open",
    "live",
    "ready",
    "datachannel-open",
    "datachannel_open",
    "channel-open",
    "channel_open",
}
CONTROL_MONITOR_DIALING_CALL_STATES = {
    "dialing",
    "calling",
    "connecting",
    "offering",
    "waiting",
    "waiting-answer",
    "waiting_answer",
    "have-local-offer",
    "have_local_offer",
}
ONLINE_CLIENTS_LOCK = threading.Lock()
ONLINE_CLIENTS: dict[str, dict[str, object]] = {}
CONTROL_MONITOR_USER_SESSION_PREFIXES = ("robot-control",)
CONTROL_MONITOR_INTERNAL_CLIENT_IDS = {"compute", "arm-edge"}
CONTROL_MONITOR_INTERNAL_CLIENT_ID_PREFIXES = ("compute-", "arm-edge-", "edge-", "robot-")
CONTROL_MONITOR_INTERNAL_CLIENT_ROLES = {
    "compute_command_sender",
    "arm_edge_command_receiver",
    "arm_edge",
    "compute",
    "robot",
    "robot_receiver",
}


def normalize_control_monitor_token(value: object) -> str:
    return str(value or "").strip().lower()


def is_control_monitor_user_session(session_name: str) -> bool:
    normalized = normalize_control_monitor_token(session_name)
    return any(normalized == prefix or normalized.startswith(f"{prefix}-") for prefix in CONTROL_MONITOR_USER_SESSION_PREFIXES)


def is_control_monitor_internal_client_id(client_id: object) -> bool:
    normalized = normalize_control_monitor_token(client_id)
    return normalized in CONTROL_MONITOR_INTERNAL_CLIENT_IDS or normalized.startswith(CONTROL_MONITOR_INTERNAL_CLIENT_ID_PREFIXES)


def is_control_monitor_internal_role(role: object) -> bool:
    return normalize_control_monitor_token(role) in CONTROL_MONITOR_INTERNAL_CLIENT_ROLES


def read_control_monitor_pending_user_offers(session_name: str, session_state: dict[str, object]) -> int:
    if not is_control_monitor_user_session(session_name):
        return 0

    user_pending = session_state.get("userPendingOffers")
    if user_pending is not None:
        try:
            return max(0, int(user_pending))
        except (TypeError, ValueError):
            return 0

    pending_clients = session_state.get("pendingOfferClients")
    if isinstance(pending_clients, list):
        count = 0
        for item in pending_clients:
            if not isinstance(item, dict):
                continue
            if item.get("isUserFrontend") is False:
                continue
            if is_control_monitor_internal_role(item.get("clientRole")):
                continue
            if is_control_monitor_internal_client_id(item.get("clientId")):
                continue
            count += 1
        return count

    try:
        return max(0, int(session_state.get("pendingOffers") or 0))
    except (TypeError, ValueError):
        return 0


def normalize_control_monitor_latency_ms(value: object) -> int | None:
    if value in (None, ""):
        return None
    try:
        latency_ms = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(latency_ms) or latency_ms < 0:
        return None
    return min(600000, round(latency_ms))


def parse_control_monitor_epoch_ms(value: object) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, str) and any(separator in value for separator in ("T", "-", ":")):
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            parsed = None
        if parsed is not None:
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return round(parsed.astimezone(timezone.utc).timestamp() * 1000)
    try:
        epoch_ms = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(epoch_ms) or epoch_ms <= 0:
        return None
    if epoch_ms < 10000000000:
        epoch_ms *= 1000
    return round(epoch_ms)


class BackendState:
    def __init__(self) -> None:
        self.defaults = load_config_defaults()
        self.log_store = LogStore()
        self._session_lock = threading.Lock()
        self._network_lock = threading.Lock()
        self._traffic_lock = threading.Lock()
        self._local_setup_lock = threading.Lock()
        self._ingest_mode_lock = threading.Lock()
        self._tank_trouble_lock = threading.Lock()
        self._tank_trouble_setup_lock = threading.Lock()
        self._short_cache_lock = threading.Lock()
        self._short_cache_refresh_locks: dict[str, threading.Lock] = {}
        self._short_cache: dict[str, tuple[float, object]] = {}
        self.current_config = None
        self.current_client = None
        self.local_stream_manager = LocalStreamManager(self.log_store)
        self.p2p_local_pusher_manager = P2PLocalPusherManager(self.log_store)
        self._tank_trouble_bridge = None
        self._tank_trouble_preview_runtime = TankTroublePreviewRuntime()
        self._network_cache_host = ""
        self._network_cache_updated_at = 0.0
        self._network_cache = self.build_default_network_snapshot("")
        self._traffic_last_sample: tuple[int, int, int] | None = None
        self._traffic_last_cpu_sample: tuple[float, float] | None = None
        self.log_store.append("Backend initialized.")
        if WEB_MODE:
            self.bootstrap_web_session()

    def _clear_short_cache(self) -> None:
        with self._short_cache_lock:
            self._short_cache.clear()

    def _get_short_cached(self, cache_key: str, ttl_seconds: float, builder):
        now = time.monotonic()
        with self._short_cache_lock:
            cached = self._short_cache.get(cache_key)
            if cached is not None and now - cached[0] <= ttl_seconds:
                return cached[1]
            refresh_lock = self._short_cache_refresh_locks.get(cache_key)
            if refresh_lock is None:
                refresh_lock = threading.Lock()
                self._short_cache_refresh_locks[cache_key] = refresh_lock

        with refresh_lock:
            now = time.monotonic()
            with self._short_cache_lock:
                cached = self._short_cache.get(cache_key)
                if cached is not None and now - cached[0] <= ttl_seconds:
                    return cached[1]

            value = builder()
            with self._short_cache_lock:
                self._short_cache[cache_key] = (time.monotonic(), value)
            return value

    def bootstrap_web_session(self) -> None:
        saved = load_login_settings(self.defaults)
        if not saved.host or not saved.username or not saved.password:
            self.log_store.append("Web mode has no saved cloud session; login is required.", level="warn")
            return

        runtime_config = self.defaults.build_runtime_config(saved.host, saved.username, saved.password)
        remote_client = CloudRemoteClient(runtime_config)
        with self._session_lock:
            if self.current_client is not None:
                self.current_client.close()
            self.current_config = runtime_config
            self.current_client = remote_client
        self.invalidate_network_cache()
        self.log_store.append(f"Web mode bound to {runtime_config.ssh_target}:{runtime_config.ssh_port}")

    def get_saved_settings(self) -> LoginSettingsResponse:
        saved = load_login_settings(self.defaults)
        if WEB_MODE:
            return LoginSettingsResponse(
                host=saved.host,
                username=saved.username,
                password="",
                remember_password=False,
                auto_login=False,
                saved_accounts=[],
            )
        return LoginSettingsResponse(
            host=saved.host,
            username=saved.username,
            password=saved.password,
            remember_password=saved.remember_password,
            auto_login=saved.auto_login,
            saved_accounts=self._build_saved_login_accounts_response(),
        )

    def save_settings(self, payload: SettingsRequest) -> LoginSettingsResponse:
        if WEB_MODE:
            self.log_store.append("Web mode ignored a browser-side settings save request.")
            return self.get_saved_settings()

        saved = save_login_settings(
            self.defaults,
            settings=self._to_login_settings(payload),
        )
        self.log_store.append("Login settings updated.")
        return LoginSettingsResponse(
            host=saved.host,
            username=saved.username,
            password=saved.password,
            remember_password=saved.remember_password,
            auto_login=saved.auto_login,
            saved_accounts=self._build_saved_login_accounts_response(),
        )

    def login(self, payload: LoginRequest) -> None:
        runtime_config = self.defaults.build_runtime_config(payload.host, payload.username, payload.password)
        remote_client = CloudRemoteClient(runtime_config)
        remote_client.probe()

        saved = None if WEB_MODE else save_login_settings(self.defaults, self._to_login_settings(payload))

        with self._session_lock:
            if self.current_client is not None:
                self.current_client.close()
            self.current_config = runtime_config
            self.current_client = remote_client
        with self._tank_trouble_lock:
            self._tank_trouble_bridge = None

        self.invalidate_network_cache()
        self._clear_short_cache()
        self.log_store.append(f"Connected to {runtime_config.ssh_target}:{runtime_config.ssh_port}")
        if saved is not None and saved.auto_login:
            self.log_store.append("Auto-login preference is enabled.")

    def logout(self) -> None:
        if WEB_MODE:
            self.log_store.append("Web mode logout requested; keeping the server-side cloud session alive.")
            return

        with self._session_lock:
            if self.current_client is not None:
                self.current_client.close()
            self.current_client = None
            self.current_config = None
        with self._tank_trouble_lock:
            self._tank_trouble_bridge = None
        self.invalidate_network_cache()
        self._clear_short_cache()
        self.log_store.append("Disconnected from cloud server.")

    def get_session(self) -> tuple:
        with self._session_lock:
            config = self.current_config
            client = self.current_client
        if config is None or client is None:
            raise RuntimeError("Cloud session is not connected.")
        return config, client

    def resolve_network_host(self) -> str:
        with self._session_lock:
            current_host = normalize_host(self.current_config.public_host) if self.current_config else ""
        if current_host:
            return current_host

        try:
            saved = load_login_settings(self.defaults)
            saved_host = normalize_host(saved.host)
            if saved_host:
                return saved_host
        except Exception:
            pass

        return normalize_host(self.defaults.default_host)

    def build_disconnected_status(self, source: str = "status") -> DashboardStatus:
        display_host = self.resolve_network_host() or "-"
        default_port = 443 if self.defaults.public_scheme == "https" else 80
        if self.defaults.api_port == default_port:
            public_base_url = f"{self.defaults.public_scheme}://{display_host}"
        else:
            public_base_url = f"{self.defaults.public_scheme}://{display_host}:{self.defaults.api_port}"

        services = []
        for service_name in REMOTE_SERVICE_ORDER:
            meta = REMOTE_SERVICE_META[service_name]
            services.append(
                ServiceStatus(
                    name=service_name,
                    title=meta["title"],
                    description=meta["description"],
                    running=False,
                    pid="-",
                    status="unknown",
                    active_state="unknown",
                    sub_state="unknown",
                    unit_state="unknown",
                    detail=meta.get("detail") or meta["description"],
                )
            )

        health_checks = []
        for key in HEALTH_CHECK_ORDER:
            meta = HEALTH_CHECK_META[key]
            health_checks.append(
                HealthCheckStatus(
                    key=key,
                    title=meta["title"],
                    description=meta["description"],
                    ok=False,
                    note=meta["description"],
                    status="unknown",
                )
            )

        port_checks = self.build_default_port_statuses()
        network_snapshot = self.get_network_snapshot(
            display_host,
            force_refresh=source == "manual",
        )

        return DashboardStatus(
            connected=False,
            ssh_target=f"{self.defaults.default_ssh_user}@{display_host}",
            public_base_url=public_base_url,
            ingest_mode="unknown",
            pending_offers="-",
            service_running_count=f"0 / {len(REMOTE_SERVICE_ORDER)}",
            health_ok_count=f"0 / {len(HEALTH_CHECK_ORDER)}",
            last_refresh="never",
            summary_status="Not connected",
            config_path=str(self.defaults.config_path),
            services=services,
            health_checks=health_checks,
            port_checks=port_checks,
            network_snapshot=network_snapshot,
            broker_status=None,
        )

    def get_sidebar_network_snapshot(self, force_refresh: bool = False) -> NetworkSnapshot:
        return self.get_network_snapshot(
            self.resolve_network_host(),
            force_refresh=force_refresh,
        )

    @staticmethod
    def build_default_port_statuses() -> list[PortStatus]:
        return [
            PortStatus(
                key=str(item["key"]),
                title=str(item["title"]),
                port=int(item["port"]),
                protocol="/".join(str(value).upper() for value in item["protocols"]),
                listening=False,
                checked=False,
            )
            for item in REMOTE_PORT_META
        ]

    @staticmethod
    def build_default_network_snapshot(server_host: str) -> NetworkSnapshot:
        server_ip = normalize_host(server_host) or "-"
        return NetworkSnapshot(
            local=NetworkEndpointStatus(),
            server=NetworkEndpointStatus(ip=server_ip, location="-", country_code=""),
            last_checked="never",
        )

    def invalidate_network_cache(self) -> None:
        with self._network_lock:
            self._network_cache_host = ""
            self._network_cache_updated_at = 0.0
            self._network_cache = self.build_default_network_snapshot("")

    def get_network_snapshot(self, server_host: str, force_refresh: bool = False) -> NetworkSnapshot:
        normalized_host = normalize_host(server_host)
        now = time.monotonic()

        with self._network_lock:
            if (
                not force_refresh
                and
                self._network_cache_host == normalized_host
                and now - self._network_cache_updated_at < NETWORK_SNAPSHOT_TTL_SECONDS
            ):
                return self._network_cache.model_copy(deep=True)

            previous_snapshot = self._network_cache.model_copy(deep=True)
            previous_host = self._network_cache_host

        next_snapshot = self.refresh_network_snapshot(
            server_host=normalized_host,
            previous_snapshot=previous_snapshot,
            keep_previous_server=previous_host == normalized_host,
        )

        with self._network_lock:
            self._network_cache_host = normalized_host
            self._network_cache_updated_at = now
            self._network_cache = next_snapshot
            return self._network_cache.model_copy(deep=True)

    def refresh_network_snapshot(
        self,
        server_host: str,
        previous_snapshot: NetworkSnapshot,
        keep_previous_server: bool,
    ) -> NetworkSnapshot:
        local_status = previous_snapshot.local.model_copy(deep=True)
        if keep_previous_server:
            server_status = previous_snapshot.server.model_copy(deep=True)
        else:
            server_status = NetworkEndpointStatus(
                ip=normalize_host(server_host) or "-",
                location="-",
                country_code="",
            )

        refreshed = False
        executor = ThreadPoolExecutor(max_workers=2)
        try:
            futures = {
                "local": executor.submit(self.lookup_current_network_endpoint),
                "server": executor.submit(self.lookup_server_network_endpoint, server_host),
            }
            for key, future in futures.items():
                try:
                    endpoint_status = future.result(timeout=NETWORK_LOOKUP_TIMEOUT_SECONDS + 0.3)
                except Exception:
                    continue

                if key == "local":
                    local_status = endpoint_status
                else:
                    server_status = endpoint_status
                refreshed = True
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        return NetworkSnapshot(
            local=local_status,
            server=server_status,
            last_checked=datetime.now().strftime("%Y-%m-%d %H:%M:%S") if refreshed else previous_snapshot.last_checked,
        )

    def lookup_current_network_endpoint(self) -> NetworkEndpointStatus:
        return self.lookup_network_endpoint("")

    def lookup_server_network_endpoint(self, server_host: str) -> NetworkEndpointStatus:
        normalized_host = normalize_host(server_host)
        if not normalized_host:
            return NetworkEndpointStatus(ip="-", location="-")
        return self.lookup_network_endpoint(normalized_host)

    def lookup_network_endpoint(
        self,
        target_host: str,
    ) -> NetworkEndpointStatus:
        normalized_host = normalize_host(target_host)
        lookup_value = normalized_host

        if normalized_host and not self.is_ip_address(normalized_host):
            lookup_value = socket.gethostbyname(normalized_host)

        payload = self.fetch_location_payload(lookup_value)
        country_code = str(payload.get("country_code") or "").strip().upper()
        resolved_ip = str(payload.get("ip") or lookup_value or normalized_host or "-")

        return NetworkEndpointStatus(
            ip=resolved_ip,
            location=self.format_ip_location(payload),
            country_code=country_code,
        )

    def fetch_location_payload(self, lookup_value: str) -> dict:
        errors: list[str] = []

        for fetcher in (self.fetch_ipapi_payload, self.fetch_ipwhois_payload):
            try:
                payload = fetcher(lookup_value)
            except Exception as exc:
                errors.append(str(exc))
                continue

            if isinstance(payload, dict):
                return payload

        raise RuntimeError(errors[-1] if errors else "IP location lookup failed.")

    @staticmethod
    def fetch_json(url: str) -> dict:
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "Cloud Service Console/0.3",
            },
        )
        # Build a fresh opener each time so proxy changes (for example Clash on/off)
        # are observed immediately instead of being retained by urllib's global opener.
        opener = build_opener()
        with opener.open(request, timeout=NETWORK_LOOKUP_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8", errors="ignore"))

    def fetch_ipwhois_payload(self, lookup_value: str) -> dict:
        url = IPWHOIS_BASE_URL if not lookup_value else f"{IPWHOIS_BASE_URL}/{quote(lookup_value, safe=':.')}"
        payload = self.fetch_json(url)
        if not isinstance(payload, dict) or payload.get("success") is False:
            raise RuntimeError(str(payload.get("message") or "IP location lookup failed."))
        return payload

    @staticmethod
    def fetch_ipapi_payload(lookup_value: str) -> dict:
        url = IPAPI_BASE_URL if not lookup_value else f"{IPAPI_BASE_URL}/{quote(lookup_value, safe=':.')}"
        payload = BackendState.fetch_json(url)
        if not isinstance(payload, dict) or payload.get("status") != "success":
            raise RuntimeError(str(payload.get("message") or "IP location lookup failed."))

        return {
            "ip": payload.get("query") or lookup_value or "-",
            "country": payload.get("country") or "",
            "country_code": payload.get("countryCode") or "",
            "region": payload.get("city") or payload.get("regionName") or payload.get("region") or "",
            "city": payload.get("city") or "",
        }

    @staticmethod
    def is_ip_address(value: str) -> bool:
        try:
            ipaddress.ip_address(value)
            return True
        except ValueError:
            return False

    @staticmethod
    def format_ip_location(payload: dict) -> str:
        country = str(payload.get("country") or "").strip()
        region = str(payload.get("region") or "").strip()
        country_code = str(payload.get("country_code") or "").strip().upper()
        city = str(payload.get("city") or "").strip()

        if country_code == "HK":
            return "China / Hong Kong"
        if country_code == "MO":
            return "China / Macao"
        if country_code == "TW":
            city_name = city or region or "Taipei"
            return f"China / {city_name}"
        if country_code == "CN":
            city_name = city or region
            return f"China / {city_name}" if city_name else "China"

        return country or region or "-"

    def evaluate_local_setup_ready(self) -> tuple[bool, str]:
        runtime_config, client = self.get_session()
        bundle = CloudSetupBundle(runtime_config)
        return bundle.check_ready(client)

    def run_local_setup_script(self) -> LocalSetupResult:
        runtime_config, client = self.get_session()
        bundle = CloudSetupBundle(runtime_config)

        self.log_store.append(
            f"Cloud setup target: {runtime_config.ssh_target}; public entry: {runtime_config.public_base_url}"
        )
        if bundle.ignored_target_template_fields:
            ignored_fields = ", ".join(bundle.ignored_target_template_fields)
            self.log_store.append(
                f"Ignoring bundled fixed-server fields ({ignored_fields}); using the current logged-in server."
        )
        self.log_store.append(f"Cloud setup started: {runtime_config.public_host}")
        try:
            result = bundle.deploy(client)
        except Exception as exc:
            self.log_store.append(f"Cloud setup failed: {exc}", level="error")
            raise

        summary = ", ".join(result.summary[:6])
        self.log_store.append(f"Cloud setup completed: {summary}", level="success")
        return LocalSetupResult(ready=True, changed=result.changed, message="环境已就绪")

    def check_local_setup(self) -> LocalSetupStatus:
        if not self._local_setup_lock.acquire(blocking=False):
            raise RuntimeError("一键配置正在进行中。")

        try:
            self.log_store.append("Cloud setup check started.")
            ready, message = self.evaluate_local_setup_ready()
            if ready:
                self.log_store.append(f"Cloud setup check OK: {message}", level="success")
            else:
                self.log_store.append(f"Cloud setup check complete: {message}", level="success")
            return LocalSetupStatus(ready=ready, message=message)
        finally:
            self._local_setup_lock.release()

    def ensure_local_setup(self, password: str) -> LocalSetupResult:
        if not self._local_setup_lock.acquire(blocking=False):
            raise RuntimeError("一键配置正在进行中。")

        try:
            runtime_config, _ = self.get_session()
            if str(password or "") != runtime_config.ssh_password:
                raise RuntimeError("密码验证失败，未执行一键配置。")
            ready, _ = self.evaluate_local_setup_ready()
            if ready:
                return LocalSetupResult(ready=True, changed=False, message="环境已就绪")
            return self.run_local_setup_script()
        finally:
            self._local_setup_lock.release()

    def get_local_stream_status(self) -> LocalStreamStatus:
        config, _ = self.get_session()
        return self.local_stream_manager.status(config)

    def save_local_stream_config(self, payload: LocalStreamConfig) -> LocalStreamStatus:
        config, _ = self.get_session()
        saved = self.local_stream_manager.save_config(payload, config)
        return self.local_stream_manager.status(config, message=f"Local stream draft saved for {saved.cloud_public_host}.")

    def setup_local_stream(self) -> LocalStreamStatus:
        config, _ = self.get_session()
        return self.local_stream_manager.ensure_local_tools(config)

    def start_local_stream(self, payload: LocalStreamConfig) -> LocalStreamStatus:
        config, _ = self.get_session()
        return self.local_stream_manager.start(payload, config)

    def stop_local_stream(self) -> LocalStreamStatus:
        config, _ = self.get_session()
        return self.local_stream_manager.stop(config)

    def get_p2p_local_pusher_status(self) -> P2PLocalPusherStatus:
        return self.p2p_local_pusher_manager.status()

    def start_p2p_local_pusher(self, payload: LocalStreamConfig, room_id: str, watch_url: str = "") -> P2PLocalPusherStatus:
        return self.p2p_local_pusher_manager.start(payload, room_id, watch_url)

    def stop_p2p_local_pusher(self) -> P2PLocalPusherStatus:
        return self.p2p_local_pusher_manager.stop()

    def get_video_push_status(self) -> dict[str, object]:
        config, _ = self.get_session()
        remote_url = f"{config.public_base_url}/api/video/status"
        _, body = self._perform_remote_json_request(remote_url, timeout_seconds=VIDEO_STATUS_TIMEOUT_SECONDS)
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Video status response was not valid JSON.") from exc
        if not isinstance(payload, dict):
            raise RuntimeError("Video status response was not an object.")
        return payload

    def post_tencent_video_status(self, action: str, payload: dict[str, object]) -> dict[str, object]:
        normalized_action = str(action or "").strip().lower()
        if normalized_action not in {"start", "heartbeat", "stop"}:
            raise RuntimeError("Unsupported Tencent video status action.")
        config, _ = self.get_session()
        remote_url = f"{config.public_base_url}/api/video/tencent/{normalized_action}"
        _, body = self._perform_remote_json_request(
            remote_url,
            method="POST",
            payload=payload,
            timeout_seconds=VIDEO_STATUS_TIMEOUT_SECONDS,
        )
        try:
            response_payload = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Tencent video status response was not valid JSON.") from exc
        if not isinstance(response_payload, dict):
            raise RuntimeError("Tencent video status response was not an object.")
        return response_payload

    @staticmethod
    def _empty_traffic_monitor_snapshot(message: str, connected: bool = False) -> TrafficMonitorSnapshot:
        now = datetime.now()
        return TrafficMonitorSnapshot(
            connected=connected,
            timestamp=now.strftime("%Y-%m-%d %H:%M:%S"),
            timestamp_ms=round(time.time() * 1000),
            congestion_level="unknown",
            congestion_note=message,
            error="" if connected else message,
        )

    @staticmethod
    def _traffic_monitor_service_names() -> list[str]:
        preferred_names = [
            "nginx",
            "coturn",
            "go2rtc-cloud",
            "go2rtc-srt-bridge",
            "go2rtc-control-signaling",
            "go2rtc-telemetry-relay",
        ]
        return [name for name in preferred_names if name in REMOTE_SERVICE_META]

    @staticmethod
    def _calculate_congestion_level(
        total_bps: float,
        capacity_bps: float | None,
        active_services: int,
        monitored_services: int,
    ) -> tuple[str, str]:
        if capacity_bps and capacity_bps > 0:
            utilization = max(0.0, min(999.0, total_bps / capacity_bps * 100))
            if utilization >= 85:
                return "danger", f"网卡实时占用约 {utilization:.0f}%，可能已经接近拥塞"
            if utilization >= 65:
                return "warning", f"网卡实时占用约 {utilization:.0f}%，建议观察推流峰值"
            if utilization >= 35:
                return "good", f"网卡实时占用约 {utilization:.0f}%，当前仍有余量"
            return "idle", f"网卡实时占用约 {utilization:.0f}%，带宽余量充足"

        if total_bps <= 0:
            return "idle", "当前没有明显视频或控制信号流量"
        if active_services >= monitored_services and monitored_services > 0:
            return "good", "相关服务均已运行，正在观察实时流量"
        return "unknown", "未读取到网卡速率上限，只展示实时流量"

    def get_traffic_monitor_snapshot(self) -> TrafficMonitorSnapshot:
        return self._get_short_cached(
            "traffic-monitor",
            TRAFFIC_MONITOR_CACHE_TTL_SECONDS,
            self._get_traffic_monitor_snapshot_uncached,
        )

    def _get_traffic_monitor_snapshot_uncached(self) -> TrafficMonitorSnapshot:
        try:
            _, client = self.get_session()
        except Exception:
            with self._traffic_lock:
                self._traffic_last_sample = None
                self._traffic_last_cpu_sample = None
            return self._empty_traffic_monitor_snapshot("连接服务器后显示流量监控")

        service_names = self._traffic_monitor_service_names()
        service_list = " ".join(shlex.quote(name) for name in service_names)
        script = f"""
set +e
timestamp_ms="$(date +%s%3N 2>/dev/null || python3 - <<'PY'
import time
print(round(time.time() * 1000))
PY
)"
printf '__TIME__:%s\\n' "$timestamp_ms"
awk '/^cpu / {{
  idle=$5+$6
  total=0
  for (i=2; i<=NF; i++) total+=$i
  printf "__CPU__:%s:%s\\n", total, idle
}}' /proc/stat 2>/dev/null
cpu_cores="$(nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo 2>/dev/null || true)"
case "$cpu_cores" in
  ''|*[!0-9]*|0) ;;
  *) printf "__CPU_CORES__:%s\\n" "$cpu_cores" ;;
esac
awk '/^MemTotal:/ {{total=$2}} /^MemAvailable:/ {{available=$2}} END {{
  if (total > 0) printf "__MEM__:%s:%s\\n", total, available
}}' /proc/meminfo 2>/dev/null
awk '{{printf "__LOAD__:%s:%s:%s\\n", $1, $2, $3}}' /proc/loadavg 2>/dev/null
df -Pk / 2>/dev/null | awk 'NR==2 {{
  pct=$5
  gsub(/%/, "", pct)
  printf "__DISK__:%s:%s:%s\\n", $3, $2, pct
}}'
awk '{{printf "__UPTIME__:%s\\n", $1}}' /proc/uptime 2>/dev/null
awk -F'[: ]+' 'NR>2 {{
  iface=$2
  rx=$3
  tx=$11
  if (iface != "lo" && rx ~ /^[0-9]+$/ && tx ~ /^[0-9]+$/) {{
    printf "__IFACE__:%s:%s:%s\\n", iface, rx, tx
  }}
}}' /proc/net/dev 2>/dev/null
for iface_path in /sys/class/net/*; do
  [ -d "$iface_path" ] || continue
  iface="${{iface_path##*/}}"
  [ "$iface" = "lo" ] && continue
  [ -r "$iface_path/speed" ] || continue
  speed="$(cat "$iface_path/speed" 2>/dev/null)"
  case "$speed" in
    ''|*[!0-9]*|0|4294967295) ;;
    *) printf "__SPEED__:%s:%s\\n" "$iface" "$speed" ;;
  esac
done
for svc in {service_list}; do
  state="$(systemctl is-active "$svc" 2>/dev/null || true)"
  [ -n "$state" ] || state="unknown"
  printf "__SERVICE__:%s:%s\\n" "$svc" "$state"
done
"""
        output = client.run(f"bash -lc {shlex.quote(script)}", timeout=8)
        now = datetime.now()
        timestamp_ms = round(time.time() * 1000)
        interface_map: dict[str, TrafficInterfaceStatus] = {}
        speed_map: dict[str, float] = {}
        service_states: dict[str, str] = {}
        cpu_total: float | None = None
        cpu_idle: float | None = None
        cpu_core_count: int | None = None
        memory_percent: float | None = None
        memory_used_mb: float | None = None
        memory_total_mb: float | None = None
        load_1m: float | None = None
        load_5m: float | None = None
        load_15m: float | None = None
        disk_percent: float | None = None
        disk_used_gb: float | None = None
        disk_total_gb: float | None = None
        uptime_seconds: float | None = None

        for line in output.splitlines():
            stripped = line.strip()
            if stripped.startswith("__TIME__:"):
                try:
                    timestamp_ms = int(stripped.split(":", 1)[1])
                except ValueError:
                    timestamp_ms = round(time.time() * 1000)
                continue
            if stripped.startswith("__CPU__:"):
                parts = stripped.split(":")
                if len(parts) >= 3:
                    try:
                        cpu_total = float(parts[1])
                        cpu_idle = float(parts[2])
                    except ValueError:
                        cpu_total = None
                        cpu_idle = None
                continue
            if stripped.startswith("__CPU_CORES__:"):
                try:
                    parsed_core_count = int(stripped.split(":", 1)[1])
                except ValueError:
                    parsed_core_count = 0
                cpu_core_count = parsed_core_count if parsed_core_count > 0 else None
                continue
            if stripped.startswith("__MEM__:"):
                parts = stripped.split(":")
                if len(parts) >= 3:
                    try:
                        memory_total_kb = max(0.0, float(parts[1]))
                        memory_available_kb = max(0.0, float(parts[2]))
                    except ValueError:
                        continue
                    if memory_total_kb > 0:
                        memory_used_kb = max(0.0, memory_total_kb - memory_available_kb)
                        memory_percent = max(0.0, min(100.0, memory_used_kb / memory_total_kb * 100))
                        memory_used_mb = memory_used_kb / 1024
                        memory_total_mb = memory_total_kb / 1024
                continue
            if stripped.startswith("__LOAD__:"):
                parts = stripped.split(":")
                if len(parts) >= 4:
                    try:
                        load_1m = float(parts[1])
                        load_5m = float(parts[2])
                        load_15m = float(parts[3])
                    except ValueError:
                        load_1m = load_5m = load_15m = None
                continue
            if stripped.startswith("__DISK__:"):
                parts = stripped.split(":")
                if len(parts) >= 4:
                    try:
                        disk_used_kb = max(0.0, float(parts[1]))
                        disk_total_kb = max(0.0, float(parts[2]))
                        disk_percent = max(0.0, min(100.0, float(parts[3])))
                    except ValueError:
                        continue
                    disk_used_gb = disk_used_kb / 1024 / 1024
                    disk_total_gb = disk_total_kb / 1024 / 1024
                continue
            if stripped.startswith("__UPTIME__:"):
                try:
                    uptime_seconds = max(0.0, float(stripped.split(":", 1)[1]))
                except ValueError:
                    uptime_seconds = None
                continue
            if stripped.startswith("__IFACE__:"):
                parts = stripped.split(":")
                if len(parts) >= 4:
                    name = parts[1]
                    try:
                        rx_bytes = int(parts[2])
                        tx_bytes = int(parts[3])
                    except ValueError:
                        continue
                    interface_map[name] = TrafficInterfaceStatus(name=name, rx_bytes=rx_bytes, tx_bytes=tx_bytes)
                continue
            if stripped.startswith("__SPEED__:"):
                parts = stripped.split(":")
                if len(parts) >= 3:
                    try:
                        speed_map[parts[1]] = float(parts[2])
                    except ValueError:
                        pass
                continue
            if stripped.startswith("__SERVICE__:"):
                _, service_name, active_state = stripped.split(":", 2)
                service_states[service_name] = active_state.strip().lower() or "unknown"

        for name, speed_mbps in speed_map.items():
            if name in interface_map:
                interface_map[name].speed_mbps = speed_mbps

        interfaces = list(interface_map.values())
        rx_bytes = sum(item.rx_bytes for item in interfaces)
        tx_bytes = sum(item.tx_bytes for item in interfaces)
        rx_bps = 0.0
        tx_bps = 0.0
        cpu_percent: float | None = None
        with self._traffic_lock:
            if self._traffic_last_sample is not None:
                previous_timestamp_ms, previous_rx_bytes, previous_tx_bytes = self._traffic_last_sample
                elapsed_seconds = max(0.001, (timestamp_ms - previous_timestamp_ms) / 1000)
                if elapsed_seconds <= 30 and rx_bytes >= previous_rx_bytes and tx_bytes >= previous_tx_bytes:
                    rx_bps = (rx_bytes - previous_rx_bytes) * 8 / elapsed_seconds
                    tx_bps = (tx_bytes - previous_tx_bytes) * 8 / elapsed_seconds
            self._traffic_last_sample = (timestamp_ms, rx_bytes, tx_bytes)
            if cpu_total is not None and cpu_idle is not None:
                if self._traffic_last_cpu_sample is not None:
                    previous_cpu_total, previous_cpu_idle = self._traffic_last_cpu_sample
                    total_delta = cpu_total - previous_cpu_total
                    idle_delta = cpu_idle - previous_cpu_idle
                    if total_delta > 0 and idle_delta >= 0:
                        cpu_percent = max(0.0, min(100.0, (1 - idle_delta / total_delta) * 100))
                self._traffic_last_cpu_sample = (cpu_total, cpu_idle)
        total_bps = rx_bps + tx_bps
        capacity_speeds = [
            float(item.speed_mbps)
            for item in interfaces
            if item.speed_mbps is not None and item.speed_mbps > 0
        ]
        capacity_bps = min(capacity_speeds) * 1_000_000 if capacity_speeds else None
        services = [
            TrafficServiceStatus(
                name=name,
                title=str(REMOTE_SERVICE_META[name]["title"]),
                running=service_states.get(name) == "active",
            )
            for name in service_names
        ]
        active_services = sum(1 for service in services if service.running)
        utilization_percent = max(0.0, min(999.0, total_bps / capacity_bps * 100)) if capacity_bps else None
        level, note = self._calculate_congestion_level(total_bps, capacity_bps, active_services, len(services))

        return TrafficMonitorSnapshot(
            connected=True,
            timestamp=now.strftime("%Y-%m-%d %H:%M:%S"),
            timestamp_ms=timestamp_ms,
            rx_bytes=rx_bytes,
            tx_bytes=tx_bytes,
            rx_bps=rx_bps,
            tx_bps=tx_bps,
            total_bps=total_bps,
            capacity_bps=capacity_bps,
            capacity_source="网卡速率" if capacity_bps else "",
            utilization_percent=utilization_percent,
            congestion_level=level,
            congestion_note=note,
            active_services=active_services,
            monitored_services=len(services),
            cpu_percent=cpu_percent,
            cpu_core_count=cpu_core_count,
            memory_percent=memory_percent,
            memory_used_mb=memory_used_mb,
            memory_total_mb=memory_total_mb,
            load_1m=load_1m,
            load_5m=load_5m,
            load_15m=load_15m,
            disk_percent=disk_percent,
            disk_used_gb=disk_used_gb,
            disk_total_gb=disk_total_gb,
            uptime_seconds=uptime_seconds,
            interfaces=interfaces,
            services=services,
        )

    def switch_ingest_mode(self, target_mode: str) -> IngestModeResult:
        normalized_mode = str(target_mode or "").strip().lower()
        if normalized_mode not in {"http", "srt"}:
            raise RuntimeError("target_mode must be either 'http' or 'srt'.")

        if not self._ingest_mode_lock.acquire(blocking=False):
            raise RuntimeError("接收模式切换正在进行中。")

        try:
            config, client = self.get_session()
            service_manager = ServiceManager(client, self.log_store, config)
            current_mode = service_manager.detect_ingest_mode()
            target_label = normalized_mode.upper()

            if current_mode == normalized_mode:
                return IngestModeResult(
                    ingest_mode=normalized_mode,
                    changed=False,
                    message=f"当前模式为{target_label}",
                )

            self.log_store.append(f"Switching ingest mode to {target_label}.")
            bundle = CloudSetupBundle(config)
            bundle.switch_ingest_mode(client, normalized_mode)
            self.log_store.append(f"Ingest mode switched to {target_label}.")
            return IngestModeResult(
                ingest_mode=normalized_mode,
                changed=True,
                message=f"当前模式为{target_label}",
            )
        except Exception as exc:
            self.log_store.append(f"Ingest mode switch failed: {exc}", level="error")
            raise
        finally:
            self._ingest_mode_lock.release()

    def collect_status(self, source: str = "manual") -> DashboardStatus:
        try:
            config, client = self.get_session()
        except RuntimeError:
            return self.build_disconnected_status(source)

        service_manager = ServiceManager(client, self.log_store, config)
        services, running_count, service_parts = service_manager.build_service_statuses()
        ingest_mode = service_manager.detect_ingest_mode()
        port_checks = self.build_default_port_statuses()
        network_snapshot = self.get_network_snapshot(
            config.public_host,
            force_refresh=source == "manual",
        )

        health_checker = HealthChecker(config)
        health_checks, health_errors, broker_status, pending_offers, ok_count, health_parts = health_checker.run_checks()

        summary = f"{', '.join(service_parts)} | {', '.join(health_parts)} | pending={pending_offers}"
        summary_status = "Auto synchronized" if source == "auto" else "Synchronized"

        if source != "silent":
            self.log_store.append(f"Status refresh complete: {summary}")
            for key in HEALTH_CHECK_ORDER:
                if key in health_errors:
                    self.log_store.append(f"{HEALTH_CHECK_META[key]['title']} error: {health_errors[key]}", level="warn")

        return DashboardStatus(
            connected=True,
            ssh_target=config.ssh_target,
            public_base_url=config.public_base_url,
            ingest_mode=ingest_mode,
            pending_offers=pending_offers,
            service_running_count=f"{running_count} / {len(REMOTE_SERVICE_ORDER)}",
            health_ok_count=f"{ok_count} / {len(HEALTH_CHECK_ORDER)}",
            last_refresh=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            summary_status=summary_status,
            config_path=str(config.config_path),
            services=services,
            health_checks=health_checks,
            port_checks=port_checks,
            network_snapshot=network_snapshot,
            broker_status=broker_status,
        )

    def check_all_ports(self) -> PortChecksResponse:
        config, client = self.get_session()
        service_manager = ServiceManager(client, self.log_store, config)
        return PortChecksResponse(port_checks=service_manager.build_port_statuses())

    def check_port(self, port_key: str) -> PortStatus:
        config, client = self.get_session()
        service_manager = ServiceManager(client, self.log_store, config)
        return service_manager.build_port_status(port_key)

    def start_all(self) -> None:
        config, client = self.get_session()
        _ = config
        ServiceManager(client, self.log_store, config).start_all()

    def stop_all(self) -> None:
        config, client = self.get_session()
        _ = config
        ServiceManager(client, self.log_store, config).stop_all()

    def start_service(self, service_name: str) -> None:
        config, client = self.get_session()
        _ = config
        ServiceManager(client, self.log_store, config).start_service(service_name)

    def stop_service(self, service_name: str) -> None:
        config, client = self.get_session()
        _ = config
        ServiceManager(client, self.log_store, config).stop_service(service_name)

    def logs(self) -> LogsResponse:
        return LogsResponse(logs=self.log_store.get_logs())

    def build_control_monitor_config(self) -> ControlMonitorConfigResponse:
        config, _ = self.get_session()
        turn_host = normalize_host(config.public_host)
        return ControlMonitorConfigResponse(
            session=CONTROL_MONITOR_DEFAULT_SESSION,
            poll_interval_sec=CONTROL_MONITOR_POLL_INTERVAL_SEC,
            turn_urls=[
                f"turn:{turn_host}:{CONTROL_MONITOR_TURN_PORT}?transport=udp",
                f"turn:{turn_host}:{CONTROL_MONITOR_TURN_PORT}?transport=tcp",
            ],
            turn_username=CONTROL_MONITOR_TURN_USERNAME,
            turn_credential=CONTROL_MONITOR_TURN_CREDENTIAL,
        )

    def _control_monitor_url(
        self,
        session_name: str,
        path: str,
        offer_id: str = "",
        compute_client_id: str = "",
    ) -> str:
        params = {"session": session_name}
        if offer_id:
            params["offer_id"] = offer_id
        if compute_client_id:
            params["compute_client_id"] = compute_client_id
        return f"{self._control_signal_base_url()}/control/webrtc/{path}?{urlencode(params)}"

    def _control_signal_base_url(self) -> str:
        configured = os.getenv(CONTROL_SIGNAL_BASE_URL_ENV, "").strip().rstrip("/")
        if configured:
            return configured
        config, _ = self.get_session()
        return config.public_base_url

    def _control_monitor_key_state_url(self, session_name: str) -> str:
        return f"{self._control_signal_base_url()}/control/monitor/key-state?{urlencode({'session': session_name})}"

    def _control_monitor_status_url(self) -> str:
        return f"{self._control_signal_base_url()}/control/webrtc/status"

    @staticmethod
    def _perform_remote_json_request(
        remote_url: str,
        method: str = "GET",
        payload: dict[str, object] | None = None,
        timeout_seconds: float = CONTROL_MONITOR_REQUEST_TIMEOUT_SECONDS,
        auth_token_env: str = "",
    ) -> tuple[int, bytes]:
        body = None
        headers = {
            "User-Agent": "CloudServiceConsole/0.3",
            "Cache-Control": "no-cache",
        }
        signaling_token = os.getenv(auth_token_env, "").strip() if auth_token_env else ""
        if signaling_token:
            headers["Authorization"] = f"Bearer {signaling_token}"
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = Request(remote_url, data=body, headers=headers, method=method.upper())
        context = ssl._create_unverified_context() if remote_url.lower().startswith("https://") else None

        try:
            with urlopen(request, timeout=timeout_seconds, context=context) as response:
                return getattr(response, "status", 200), response.read()
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace").strip()
            message = f"HTTP {exc.code}"
            if detail:
                message = f"{message}: {detail}"
            raise RuntimeError(message) from exc
        except Exception as exc:
            raise RuntimeError(str(exc)) from exc

    def poll_control_monitor_offer(
        self,
        session_name: str,
        compute_client_id: str,
    ) -> ControlMonitorOfferResponse | None:
        if not compute_client_id.strip():
            raise RuntimeError("compute_client_id is required.")

        remote_url = self._control_monitor_url(
            session_name,
            "compute-next-offer",
            compute_client_id=compute_client_id,
        )
        status_code, body = self._perform_remote_json_request(
            remote_url,
            auth_token_env=CONTROL_SIGNAL_COMPUTE_TOKEN_ENV,
        )
        if status_code == 204:
            return None
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Control monitor offer response was not valid JSON.") from exc
        return ControlMonitorOfferResponse.model_validate(payload)

    def _normalize_control_monitor_payload_latency(self, payload: dict[str, object]) -> None:
        clients = payload.get("clients")
        normalized_clients: list[dict[str, object]] = []
        if isinstance(clients, list):
            for client in clients:
                if not isinstance(client, dict):
                    continue
                client["latencyMs"] = None
                client["latencySource"] = ""
                normalized_clients.append(client)

        link_status = payload.get("linkStatus")
        if isinstance(link_status, dict):
            link_status["frontendLatencyMs"] = None
            link_status["frontendLatencySource"] = ""
            link_status["backendLatencyMs"] = None
            link_status["backendLatencySource"] = ""
            link_status["directLatencyMs"] = None
            link_status["directLatencySource"] = ""

    def post_control_monitor_answer(
        self,
        session_name: str,
        offer_id: str,
        compute_client_id: str,
        payload: ControlSessionDescription,
    ) -> ApiResponse:
        if not offer_id.strip():
            raise RuntimeError("offer_id is required.")
        if not compute_client_id.strip():
            raise RuntimeError("compute_client_id is required.")

        remote_url = self._control_monitor_url(
            session_name,
            "compute-answer",
            offer_id=offer_id,
            compute_client_id=compute_client_id,
        )
        self._perform_remote_json_request(
            remote_url,
            method="POST",
            payload={**payload.model_dump(), "role": "compute_control_receiver"},
            auth_token_env=CONTROL_SIGNAL_COMPUTE_TOKEN_ENV,
        )
        return ApiResponse(success=True, message="Control answer posted.")

    def get_control_monitor_key_state(self, session_name: str) -> ControlMonitorKeyStateResponse:
        cache_key = f"control-monitor-key-state:{session_name}"
        return self._get_short_cached(
            cache_key,
            CONTROL_MONITOR_KEY_STATE_CACHE_TTL_SECONDS,
            lambda: self._get_control_monitor_key_state_uncached(session_name),
        )

    def _get_control_monitor_key_state_uncached(self, session_name: str) -> ControlMonitorKeyStateResponse:
        remote_url = self._control_monitor_key_state_url(session_name)
        status_code, body = self._perform_remote_json_request(
            remote_url,
            timeout_seconds=CONTROL_MONITOR_KEY_STATE_TIMEOUT_SECONDS,
            auth_token_env=CONTROL_SIGNAL_ADMIN_TOKEN_ENV,
        )
        if status_code == 204:
            payload = {"session": session_name}
            self._augment_control_monitor_link_status(session_name, payload)
            self._normalize_control_monitor_payload_latency(payload)
            return ControlMonitorKeyStateResponse.model_validate(payload)
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Control monitor key-state response was not valid JSON.") from exc
        self._prune_control_monitor_payload_clients(payload)
        self._augment_control_monitor_link_status(session_name, payload)
        self._normalize_control_monitor_payload_latency(payload)
        return ControlMonitorKeyStateResponse.model_validate(payload)

    @staticmethod
    def _prune_control_monitor_payload_clients(payload: dict[str, object]) -> None:
        clients = payload.get("clients")
        if not isinstance(clients, list):
            payload["clients"] = []
            payload["clientCount"] = 0
            return

        try:
            ttl_ms = max(500, round(float(payload.get("ttlSec") or 1.2) * 1000))
        except (TypeError, ValueError):
            ttl_ms = 1200
        ttl_ms += CONTROL_MONITOR_CLIENT_STALE_GRACE_MS

        live_clients = []
        for client in clients:
            if not isinstance(client, dict):
                continue
            try:
                age_ms = int(float(client.get("ageMs") or 0))
            except (TypeError, ValueError):
                age_ms = 0
            if age_ms <= ttl_ms:
                live_clients.append(client)

        payload["clients"] = live_clients
        payload["clientCount"] = len(live_clients)

    @staticmethod
    def _parse_control_monitor_iso_age_ms(value: object) -> int | None:
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return max(0, round((datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds() * 1000))

    @staticmethod
    def _parse_control_monitor_iso_epoch_ms(value: object) -> int | None:
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return round(parsed.astimezone(timezone.utc).timestamp() * 1000)

    @staticmethod
    def _read_control_monitor_call_state(client: object) -> str:
        if not isinstance(client, dict):
            return ""
        return str(client.get("callState") or client.get("call_state") or "").strip().lower()

    def _build_control_monitor_link_status_from_payload(
        self,
        session_name: str,
        payload: dict[str, object],
        broker_status: dict[str, object] | None,
    ) -> dict[str, object]:
        clients = payload.get("clients")
        if not isinstance(clients, list):
            clients = []

        call_states = [self._read_control_monitor_call_state(client) for client in clients]
        connected_client_count = sum(1 for item in call_states if item in CONTROL_MONITOR_CONNECTED_CALL_STATES)
        dialing_client_count = sum(1 for item in call_states if item in CONTROL_MONITOR_DIALING_CALL_STATES)
        session_state: dict[str, object] = {}
        if isinstance(broker_status, dict):
            sessions = broker_status.get("sessions")
            if isinstance(sessions, dict) and isinstance(sessions.get(session_name), dict):
                session_state = sessions[session_name]

        pending_offers = read_control_monitor_pending_user_offers(session_name, session_state)
        raw_pending_offers = int(session_state.get("pendingOffers") or 0)
        browser_posts = int(session_state.get("frontendPosts") or session_state.get("browserPosts") or 0)
        answers_posted = int(session_state.get("answersPosted") or 0)
        last_compute_poll_at = session_state.get("lastComputePollAt") or session_state.get("lastRobotPollAt")
        last_frontend_offer_at = session_state.get("lastFrontendOfferAt") or session_state.get("lastBrowserOfferAt")
        robot_poll_age_ms = self._parse_control_monitor_iso_age_ms(last_compute_poll_at)
        robot_listener_age_ms = session_state.get("robotListenerAgeMs")
        if robot_listener_age_ms is None:
            robot_listener_age_ms = robot_poll_age_ms
        robot_listener_fresh_ms = (
            int(float(broker_status.get("robotListenerTtlSec") or 10.0) * 1000)
            if isinstance(broker_status, dict)
            else CONTROL_MONITOR_ROBOT_POLL_FRESH_MS
        )
        robot_listener_fresh = (
            robot_listener_age_ms is not None
            and int(robot_listener_age_ms) <= robot_listener_fresh_ms
        )
        last_answer_at = session_state.get("lastAnswerAt")
        signal_pair_age_ms = self._parse_control_monitor_iso_age_ms(last_answer_at)
        last_answer_epoch_ms = self._parse_control_monitor_iso_epoch_ms(last_answer_at)
        last_robot_poll_epoch_ms = self._parse_control_monitor_iso_epoch_ms(last_compute_poll_at)
        last_monitor_update_epoch_ms = self._parse_control_monitor_iso_epoch_ms(payload.get("lastUpdateAt"))
        monitor_observed_after_pair = (
            last_answer_epoch_ms is not None
            and last_monitor_update_epoch_ms is not None
            and last_monitor_update_epoch_ms >= last_answer_epoch_ms
        )
        signal_paired = False
        robot_polled_after_answer = (
            last_robot_poll_epoch_ms is not None
            and last_answer_epoch_ms is not None
            and last_robot_poll_epoch_ms > last_answer_epoch_ms
        )
        inferred_direct_connected = False
        direct_connected = connected_client_count > 0
        backend_listening = robot_listener_fresh or direct_connected
        effective_active_client_count = len(clients)
        return {
            "frontendDialing": bool(
                pending_offers > 0
                or dialing_client_count > 0
                or direct_connected
            ),
            "backendListening": backend_listening,
            "directConnected": direct_connected,
            "frontendLatencyMs": None,
            "frontendLatencySource": "",
            "backendLatencyMs": None,
            "backendLatencySource": "",
            "directLatencyMs": None,
            "directLatencySource": "",
            "pendingOffers": pending_offers,
            "userPendingOffers": pending_offers,
            "internalPendingOffers": max(0, raw_pending_offers - pending_offers),
            "browserPosts": browser_posts,
            "robotPolls": int(session_state.get("computePolls") or session_state.get("robotPolls") or 0),
            "frontendPosts": browser_posts,
            "computePolls": int(session_state.get("computePolls") or session_state.get("robotPolls") or 0),
            "answersPosted": answers_posted,
            "activeClientCount": effective_active_client_count,
            "dialingClientCount": dialing_client_count,
            "connectedClientCount": connected_client_count,
            "robotPollFreshMs": CONTROL_MONITOR_ROBOT_POLL_FRESH_MS,
            "robotPollAgeMs": robot_poll_age_ms,
            "signalPairFreshMs": CONTROL_MONITOR_SIGNAL_PAIR_FRESH_MS,
            "signalPairAgeMs": signal_pair_age_ms,
            "signalPaired": signal_paired,
            "inferredDirectConnected": inferred_direct_connected,
            "robotListenerClientId": session_state.get("computeListenerClientId") or session_state.get("robotListenerClientId") or "",
            "computeListenerClientId": session_state.get("computeListenerClientId") or session_state.get("robotListenerClientId") or "",
            "robotListenerFreshMs": robot_listener_fresh_ms,
            "robotListenerAgeMs": robot_listener_age_ms,
            "robotListenerLatencyMs": None,
            "robotListenerLatencySource": "",
            "robotListenerLatencyUpdatedAt": None,
            "robotListenerConflictCount": int(session_state.get("robotListenerConflictCount") or 0),
            "lastRobotListenerAt": session_state.get("robotListenerLastSeenAt"),
            "lastBrowserOfferAt": last_frontend_offer_at,
            "lastRobotPollAt": last_compute_poll_at,
            "lastFrontendOfferAt": last_frontend_offer_at,
            "lastComputePollAt": last_compute_poll_at,
            "lastAnswerAt": session_state.get("lastAnswerAt"),
            "source": "desktop-backend",
        }

    def _build_control_monitor_broker_link_status(
        self,
        session_name: str,
        broker_status: dict[str, object] | None,
    ) -> dict[str, object]:
        if not isinstance(broker_status, dict):
            return self._build_control_monitor_link_status_from_payload(session_name, {"clients": []}, None)

        link_statuses = broker_status.get("linkStatuses")
        fallback_status = self._build_control_monitor_link_status_from_payload(session_name, {"clients": []}, broker_status)
        if isinstance(link_statuses, dict) and isinstance(link_statuses.get(session_name), dict):
            merged_status = {
                **fallback_status,
                **link_statuses[session_name],
                "activeClientCount": 0,
                "dialingClientCount": 0,
                "connectedClientCount": 0,
            }
        else:
            merged_status = fallback_status

        if session_name == CONTROL_MONITOR_COMMAND_SESSION:
            try:
                pending_offers = int(merged_status.get("pendingOffers") or 0)
            except (TypeError, ValueError):
                pending_offers = 0
            last_offer_epoch_ms = self._parse_control_monitor_iso_epoch_ms(
                merged_status.get("lastFrontendOfferAt") or merged_status.get("lastBrowserOfferAt")
            )
            last_answer_epoch_ms = self._parse_control_monitor_iso_epoch_ms(merged_status.get("lastAnswerAt"))
            last_robot_poll_epoch_ms = self._parse_control_monitor_iso_epoch_ms(
                merged_status.get("lastComputePollAt") or merged_status.get("lastRobotPollAt")
            )

            # For compute -> arm-edge the cloud broker only sees signaling.
            # If arm-edge polls again after the last answer, the previous
            # DataChannel is no longer a reliable live connection.
            robot_polled_after_answer = (
                last_robot_poll_epoch_ms is not None
                and last_answer_epoch_ms is not None
                and last_robot_poll_epoch_ms > last_answer_epoch_ms
            )
            connected_by_signal_hold = (
                last_offer_epoch_ms is not None
                and last_answer_epoch_ms is not None
                and last_answer_epoch_ms >= last_offer_epoch_ms
                and not robot_polled_after_answer
            )
            active_unanswered_offer = (
                pending_offers > 0
                or (
                    last_offer_epoch_ms is not None
                    and (last_answer_epoch_ms is None or last_offer_epoch_ms > last_answer_epoch_ms)
                )
            )

            merged_status["frontendDialing"] = bool(active_unanswered_offer or connected_by_signal_hold)
            merged_status["backendListening"] = bool(merged_status.get("backendListening") or connected_by_signal_hold)
            merged_status["directConnected"] = bool(connected_by_signal_hold)

        return merged_status

    def _augment_control_monitor_link_status(self, session_name: str, payload: dict[str, object]) -> None:
        broker_status: dict[str, object] | None = None
        try:
            _, status_body = self._perform_remote_json_request(
                self._control_monitor_status_url(),
                timeout_seconds=CONTROL_MONITOR_STATUS_FALLBACK_TIMEOUT_SECONDS,
                auth_token_env=CONTROL_SIGNAL_ADMIN_TOKEN_ENV,
            )
            decoded_status = json.loads(status_body.decode("utf-8") or "{}")
            if isinstance(decoded_status, dict):
                broker_status = decoded_status
        except Exception:
            broker_status = None

        fallback_status = self._build_control_monitor_link_status_from_payload(session_name, payload, broker_status)
        payload["commandLinkStatus"] = self._build_control_monitor_broker_link_status(
            CONTROL_MONITOR_COMMAND_SESSION,
            broker_status,
        )
        existing_status = payload.get("linkStatus")
        if isinstance(existing_status, dict):
            merged_status = {
                **fallback_status,
                **{key: value for key, value in existing_status.items() if value is not None},
            }
            for key in ("frontendDialing", "backendListening", "directConnected"):
                merged_status[key] = bool(fallback_status.get(key))
            for key in (
                "activeClientCount",
                "dialingClientCount",
                "connectedClientCount",
            ):
                merged_status[key] = int(fallback_status.get(key) or 0)
            for key in (
                "frontendLatencyMs",
                "frontendLatencySource",
                "backendLatencyMs",
                "backendLatencySource",
                "directLatencyMs",
                "directLatencySource",
            ):
                merged_status[key] = fallback_status.get(key)
            for key in ("lastRobotPollAt", "lastComputePollAt", "lastRobotListenerAt"):
                merged_status[key] = fallback_status.get(key) or existing_status.get(key)
            payload["linkStatus"] = merged_status
        else:
            payload["linkStatus"] = fallback_status

    def _get_tank_trouble_bridge(self, config) -> TankTroubleCloudBridge:
        with self._tank_trouble_lock:
            if self._tank_trouble_bridge is None:
                self._tank_trouble_bridge = TankTroubleCloudBridge(config)
            return self._tank_trouble_bridge

    def get_tank_trouble_room_status(self, payload: TankTroubleRoomStatusRequest) -> TankTroubleRoomState:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        result = bridge.room_status(
            client,
            room=payload.room,
        )
        return TankTroubleRoomState.model_validate(result)

    def get_tank_trouble_spectator_page_url(self, room: str = "main") -> TankTroublePageUrlResponse:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        bridge.ensure_server(client)
        return TankTroublePageUrlResponse(room=room, url=bridge.spectator_page_url(room))

    def check_tank_trouble_setup(self) -> TankTroubleSetupStatus:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        ready, message = bridge.check_setup_ready(client)
        return TankTroubleSetupStatus(ready=ready, message=f"服务器已就绪（{bridge.local_runtime_summary()}）" if ready else message)

    def ensure_tank_trouble_setup(self) -> TankTroubleSetupResult:
        if not self._tank_trouble_setup_lock.acquire(blocking=False):
            raise RuntimeError("Tank Trouble setup is already running.")
        try:
            config, client = self.get_session()
            bridge = self._get_tank_trouble_bridge(config)
            changed = bridge.setup_server(client, force=True)
            self.log_store.append(
                f"Tank Trouble cloud bundle checked on {config.public_host}:{TANK_GAME_SERVER_PORT}; changed={changed}."
            )
            return TankTroubleSetupResult(
                ready=True,
                changed=changed,
                message=f"服务器已清理并同步到当前版本（{bridge.local_runtime_summary()}）",
            )
        except Exception as exc:
            self.log_store.append(f"Tank Trouble setup failed: {exc}", level="error")
            raise
        finally:
            self._tank_trouble_setup_lock.release()

    def sync_tank_trouble_room(self, payload: TankTroubleRoomRequest) -> TankTroubleRoomState:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        result = bridge.sync_room(
            client,
            room=payload.room,
            player_id=payload.player_id,
            country_code=payload.country_code,
            preferred_color=payload.preferred_color,
        )
        validated = TankTroubleRoomState.model_validate(result)
        self._tank_trouble_preview_runtime.cache_room_state(payload, validated)
        return validated

    def toggle_tank_trouble_vote(self, payload: TankTroubleRoomRequest) -> TankTroubleRoomState:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        result = bridge.toggle_vote(
            client,
            room=payload.room,
            player_id=payload.player_id,
            country_code=payload.country_code,
        )
        validated = TankTroubleRoomState.model_validate(result)
        self._tank_trouble_preview_runtime.cache_room_state(payload, validated)
        return validated

    def leave_tank_trouble_room(self, payload: TankTroubleRoomRequest) -> TankTroubleRoomState:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        result = bridge.leave_room(
            client,
            room=payload.room,
            player_id=payload.player_id,
            country_code=payload.country_code,
        )
        validated = TankTroubleRoomState.model_validate(result)
        self._tank_trouble_preview_runtime.clear_room_state(payload)
        return validated

    def sync_tank_trouble_match(self, payload: TankTroubleMatchRequest) -> TankTroubleMatchState:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        result = bridge.sync_match(client, payload.model_dump())
        return TankTroubleMatchState.model_validate(result)

    def leave_tank_trouble_match(self, payload: TankTroubleRoomRequest) -> ApiResponse:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        bridge.leave_match(
            client,
            room=payload.room,
            player_id=payload.player_id,
            country_code=payload.country_code,
        )
        return ApiResponse(success=True, message="Online match state cleared.")

    def sync_tank_trouble_latency(self, payload: TankTroubleLatencyRequest) -> TankTroubleLatencyState:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        result = bridge.sync_latency(client, payload.model_dump())
        return TankTroubleLatencyState.model_validate(result)

    def leave_tank_trouble_latency(self, payload: TankTroubleRoomRequest) -> ApiResponse:
        config, client = self.get_session()
        bridge = self._get_tank_trouble_bridge(config)
        bridge.leave_latency(
            client,
            room=payload.room,
            player_id=payload.player_id,
            country_code=payload.country_code,
        )
        return ApiResponse(success=True, message="Latency test state cleared.")

    def push_tank_trouble_preview(self, payload: TankTroublePreviewPushRequest) -> ApiResponse:
        return self._tank_trouble_preview_runtime.push_snapshot(payload)

    def clear_tank_trouble_preview(self, payload: TankTroublePreviewClearRequest) -> ApiResponse:
        return self._tank_trouble_preview_runtime.clear_preview(payload)

    def get_tank_trouble_preview_state(self):
        return self._tank_trouble_preview_runtime.get_state()

    @staticmethod
    def _to_login_settings(payload: SettingsRequest | LoginRequest):
        from config import LoginSettings

        return LoginSettings(
            host=payload.host,
            username=payload.username,
            password=str(payload.password or ""),
            remember_password=bool(payload.remember_password),
            auto_login=bool(payload.auto_login),
        )

    def _build_saved_login_accounts_response(self):
        from models import SavedLoginAccountResponse
        from settings_store import load_saved_login_accounts

        return [
            SavedLoginAccountResponse(
                host=account.host,
                username=account.username,
                password=account.password,
                remember_password=account.remember_password,
                auto_login=account.auto_login,
            )
            for account in load_saved_login_accounts(self.defaults)
        ]


state = BackendState()
account_store = AccountStore(state.defaults.app_dir)
agent_settings_store = AgentSettingsStore(state.defaults.app_dir)
capture_storage_root = Path(
    os.environ.get("CLOUD_CONSOLE_CAPTURE_STORAGE_DIR")
    or (state.defaults.app_dir / "captures")
).expanduser()
capture_store = CaptureFileStore(capture_storage_root)
capture_tasks = CaptureTaskStore(
    capture_store,
    Path(os.environ.get("CLOUD_CONSOLE_FRONTEND_DIST") or Path(__file__).resolve().parents[1] / "frontend" / "dist"),
)
app = FastAPI(title="Cloud Service Console Backend", version="0.3.0")
model_library = ModelLibrary(Path(os.environ.get("CLOUD_CONSOLE_MODEL_LIBRARY_DIR")
    or ("/opt/telebot-model-library" if WEB_MODE else state.defaults.app_dir / "model-library")),
    Path(os.environ["CLOUD_CONSOLE_MODEL_CATALOG_DIR"]) if os.environ.get("CLOUD_CONSOLE_MODEL_CATALOG_DIR") else None)
app.include_router(create_model_router(model_library))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_web_token(request: FastAPIRequest) -> str:
    query_token = str(request.query_params.get("access_token") or "").strip()
    if query_token:
        return query_token
    authorization = str(request.headers.get("authorization") or "").strip()
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    header_token = str(request.headers.get("x-cloud-console-token") or "").strip()
    if header_token:
        return header_token
    return ""


def _account_for_web_token(token: str) -> dict[str, str] | None:
    return account_store.resolve_session(token)


def _capture_upload_tokens() -> tuple[str, ...]:
    # A dedicated capture token is preferred for new deployments. Signal
    # tokens remain accepted so existing Frontend and Compute installations
    # can upload without copying another secret to every machine at once.
    values = (
        os.environ.get(CAPTURE_UPLOAD_TOKEN_ENV),
        os.environ.get(CONTROL_SIGNAL_FRONTEND_TOKEN_ENV),
        os.environ.get(CONTROL_SIGNAL_COMPUTE_TOKEN_ENV),
        os.environ.get(CONTROL_SIGNAL_ADMIN_TOKEN_ENV),
    )
    return tuple(dict.fromkeys(str(value or "").strip() for value in values if str(value or "").strip()))


def _capture_machine_authorized(request: FastAPIRequest) -> bool:
    expected_tokens = _capture_upload_tokens()
    expected_hashes = tuple(
        dict.fromkeys(
            str(os.environ.get(name) or "").strip().lower()
            for name in (
                P2P_V2_FRONTEND_TOKEN_SHA256_ENV,
                P2P_V2_COMPUTE_TOKEN_SHA256_ENV,
            )
            if str(os.environ.get(name) or "").strip()
        )
    )
    if not expected_tokens and not expected_hashes:
        return False
    supplied = str(request.headers.get("x-telebot-capture-token") or "").strip()
    if not supplied:
        authorization = str(request.headers.get("authorization") or "").strip()
        if authorization.lower().startswith("bearer "):
            supplied = authorization[7:].strip()
    if not supplied:
        return False
    if any(secrets.compare_digest(supplied, expected) for expected in expected_tokens):
        return True
    supplied_hash = hashlib.sha256(supplied.encode("utf-8")).hexdigest()
    return any(secrets.compare_digest(supplied_hash, expected) for expected in expected_hashes)


def _online_updated_at(now: float) -> str:
    return datetime.fromtimestamp(now, timezone.utc).isoformat()


def _sanitize_online_client_id(value: object) -> str:
    client_id = str(value or "").strip()
    if not client_id:
        return ""
    safe_chars = []
    for char in client_id[:96]:
        if char.isalnum() or char in {"-", "_", ".", ":"}:
            safe_chars.append(char)
    return "".join(safe_chars)


def _online_snapshot(now: float | None = None) -> dict[str, object]:
    current_time = time.time() if now is None else now
    cutoff = current_time - ONLINE_CLIENT_TTL_SECONDS
    with ONLINE_CLIENTS_LOCK:
        stale_ids = [
            client_id
            for client_id, client in ONLINE_CLIENTS.items()
            if float(client.get("last_seen") or 0.0) < cutoff
        ]
        for client_id in stale_ids:
            ONLINE_CLIENTS.pop(client_id, None)
        return {
            "onlineCount": len(ONLINE_CLIENTS),
            "updatedAt": _online_updated_at(current_time),
        }


def _record_online_client(request: FastAPIRequest, payload: dict[str, object]) -> dict[str, object]:
    now = time.time()
    account = getattr(request.state, "account", None) if WEB_MODE else None
    role = str(account.get("role") or "user") if isinstance(account, dict) else "desktop"
    client_id = _sanitize_online_client_id(payload.get("clientId"))
    if not client_id:
        host = request.client.host if request.client else "local"
        client_id = f"{role or 'user'}:{host}"

    with ONLINE_CLIENTS_LOCK:
        ONLINE_CLIENTS[client_id] = {
            "role": role or "user",
            "last_seen": now,
        }
    snapshot = _online_snapshot(now)
    snapshot["role"] = role or "user"
    return snapshot


def _remove_online_client(payload: dict[str, object]) -> dict[str, object]:
    client_id = _sanitize_online_client_id(payload.get("clientId"))
    if client_id:
        with ONLINE_CLIENTS_LOCK:
            ONLINE_CLIENTS.pop(client_id, None)
    return _online_snapshot()


def _path_matches(path: str, prefixes: tuple[str, ...]) -> bool:
    return any(path == prefix.rstrip("/") or path.startswith(prefix) for prefix in prefixes)


def _is_static_web_path(path: str) -> bool:
    return (
        path == "/"
        or path == "/tencent-cloud-player.html"
        or path.startswith("/assets/")
        or path.startswith("/flags/")
        or (path.startswith("/tank-trouble/") and path != "/tank-trouble/preview")
        or path in {"/favicon.ico", "/robots.txt", "/manifest.webmanifest"}
    )


@app.middleware("http")
async def web_access_guard(request: FastAPIRequest, call_next):
    if not WEB_MODE:
        return await call_next(request)

    path = request.url.path
    if request.method == "OPTIONS" or _is_static_web_path(path):
        return await call_next(request)

    if request.method == "GET" and path.startswith("/api/captures/downloads/"):
        return await call_next(request)

    if request.method == "POST" and path == CAPTURE_UPLOAD_PATH and _capture_machine_authorized(request):
        request.state.capture_machine = True
        request.state.account = None
        return await call_next(request)

    if request.method == "GET" and (path == "/api/model-library" or path.startswith("/api/model-library/")):
        expected = os.environ.get("CLOUD_CONSOLE_MODEL_TOKEN_SHA256", "").strip()
        supplied = request.headers.get("x-model-library-token", "")
        if expected and supplied and secrets.compare_digest(hashlib.sha256(supplied.encode()).hexdigest(), expected):
            return await call_next(request)

    token = _read_web_token(request)
    account = _account_for_web_token(token)
    request.state.account = account
    if _path_matches(path, WEB_PUBLIC_PATHS):
        return await call_next(request)
    if not account:
        return JSONResponse({"detail": "请先登录个人账号。"}, status_code=401)

    role = account["role"]

    if path == "/api/model-library" or path.startswith("/api/model-library/"):
        allowed = {name.strip().lower() for name in os.getenv("CLOUD_CONSOLE_MODEL_READERS", "").split(",") if name.strip()}
        if role != "admin" and account.get("username", "").lower() not in allowed:
            return JSONResponse({"detail": "模型仓库仅限管理员和已授权的研究账号访问。"}, status_code=403)

    if role != "admin" and _path_matches(path, WEB_ADMIN_ONLY_PATH_PREFIXES):
        return JSONResponse({"detail": "管理员链接才允许执行此操作。"}, status_code=403)

    if role != "admin" and not _path_matches(path, WEB_SAFE_PATH_PREFIXES):
        return JSONResponse({"detail": "普通用户链接没有此操作权限。"}, status_code=403)

    response = await call_next(request)
    response.headers["X-Cloud-Console-Role"] = role
    response.headers["X-Cloud-Console-User"] = account["username"]
    return response


def _legacy_unused_build_tank_trouble_preview_html() -> str:
    return """<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tank Trouble Preview</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #06101d;
        --panel: rgba(9, 23, 39, 0.9);
        --panel-border: rgba(103, 232, 249, 0.16);
        --text: #e5f3ff;
        --muted: #8fb4d9;
        --accent: #67e8f9;
        --accent-soft: rgba(103, 232, 249, 0.18);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(14, 165, 233, 0.14), transparent 28%),
          radial-gradient(circle at right center, rgba(34, 211, 238, 0.12), transparent 24%),
          linear-gradient(180deg, #04101d 0%, #061523 52%, #071826 100%);
        color: var(--text);
        font: 500 14px/1.5 "Segoe UI", "Microsoft YaHei UI", sans-serif;
      }
      .shell {
        width: min(1440px, calc(100vw - 24px));
        margin: 12px auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 280px;
        gap: 14px;
      }
      .stage-card, .score-card {
        border-radius: 24px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        box-shadow: 0 24px 60px rgba(2, 6, 23, 0.32);
        overflow: hidden;
        backdrop-filter: blur(12px);
      }
      .stage-wrap {
        aspect-ratio: 1280 / 800;
        background: rgba(4, 12, 23, 0.92);
      }
      .stage-wrap img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .stage-empty {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: var(--muted);
        letter-spacing: 0.04em;
      }
      .score-card {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .score-head, .score-foot {
        padding: 18px 18px 14px;
      }
      .score-title {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }
      .score-subtitle {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
      }
      .score-list {
        padding: 0 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1 1 auto;
      }
      .score-row {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(7, 17, 29, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.12);
      }
      .score-row.active {
        background: linear-gradient(135deg, rgba(8, 145, 178, 0.28), rgba(14, 116, 144, 0.18));
        border-color: rgba(103, 232, 249, 0.28);
        box-shadow: inset 0 0 0 1px rgba(103, 232, 249, 0.12);
      }
      .score-rank {
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }
      .score-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .score-value {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .score-foot {
        border-top: 1px solid rgba(148, 163, 184, 0.12);
        display: grid;
        gap: 10px;
      }
      .score-meta {
        color: var(--text);
      }
      .score-note {
        color: var(--muted);
        font-size: 12px;
      }
      @media (max-width: 980px) {
        .shell {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="stage-card">
        <div class="stage-wrap">
          <img id="preview-frame" alt="Tank preview" hidden />
          <div id="preview-empty" class="stage-empty">Waiting for preview session...</div>
        </div>
      </section>
      <aside class="score-card">
        <div class="score-head">
          <div class="score-title">Scoreboard</div>
          <div id="score-subtitle" class="score-subtitle">No active preview</div>
        </div>
        <div id="score-list" class="score-list"></div>
        <div class="score-foot">
          <div id="score-runtime" class="score-meta">Waiting for runtime data...</div>
          <div id="score-map" class="score-note"></div>
        </div>
      </aside>
    </main>
    <script>
      const frame = document.getElementById("preview-frame");
      const empty = document.getElementById("preview-empty");
      const scoreSubtitle = document.getElementById("score-subtitle");
      const scoreList = document.getElementById("score-list");
      const scoreRuntime = document.getElementById("score-runtime");
      const scoreMap = document.getElementById("score-map");
      let lastFrameSeq = -1;

      function renderRows(rows) {
        const nextRows = Array.isArray(rows) ? rows : [];
        scoreList.innerHTML = "";
        for (const row of nextRows) {
          const item = document.createElement("div");
          item.className = "score-row" + (row && row.active ? " active" : "");

          const rank = document.createElement("div");
          rank.className = "score-rank";
          rank.textContent = String(row && row.rank ? row.rank : "--").padStart(2, "0");

          const name = document.createElement("div");
          name.className = "score-name";
          name.textContent = row && row.player_id ? row.player_id : "--";

          const value = document.createElement("div");
          value.className = "score-value";
          value.textContent = row ? String(row.score ?? "-") : "-";

          item.append(rank, name, value);
          scoreList.appendChild(item);
        }
      }

      async function refresh() {
        try {
          const response = await fetch("/api/games/tank-trouble/preview/state?ts=" + Date.now(), {
            cache: "no-store",
          });
          const data = await response.json();
          const isActive = Boolean(data && data.active);
          const isFresh = isActive && Date.now() - Number(data.updated_at_ms || 0) < 4000;

          if (!isFresh) {
            frame.hidden = true;
            empty.hidden = false;
            scoreSubtitle.textContent = "No active preview";
            scoreRuntime.textContent = "Waiting for runtime data...";
            scoreMap.textContent = "";
            renderRows([]);
            return;
          }

          empty.hidden = true;
          frame.hidden = false;
          if (Number(data.frame_seq || 0) !== lastFrameSeq && data.frame_data_url) {
            lastFrameSeq = Number(data.frame_seq || 0);
            frame.src = String(data.frame_data_url);
          }

          scoreSubtitle.textContent = [data.player_id || "Pilot", data.map_id || "MAP"].join(" · ");
          scoreRuntime.textContent = data.runtime_summary || "";
          scoreMap.textContent = data.map_label || "";
          renderRows(data.rows);
        } catch (error) {
          empty.hidden = false;
          frame.hidden = true;
          scoreSubtitle.textContent = "Preview fetch failed";
          scoreRuntime.textContent = error instanceof Error ? error.message : "Unknown error";
        }
      }

      refresh();
      window.setInterval(refresh, 120);
    </script>
  </body>
</html>
"""


@app.get("/api/health", response_model=ApiResponse)
def api_health() -> ApiResponse:
    return ApiResponse(success=True, message="backend-ready")


def _build_account_session_response(account: dict[str, str], remember_device: bool) -> AccountSessionResponse:
    return AccountSessionResponse(
        session_token=account_store.create_session(account),
        device_token=account_store.create_device_credential(account) if remember_device else "",
        username=account["username"],
        role=account["role"],
        admin=account["role"] == "admin",
        avatar_data_url=account.get("avatar_data_url", ""),
    )


@app.post("/api/auth/register", response_model=AccountSessionResponse)
def api_account_register(payload: AccountRegisterRequest) -> AccountSessionResponse:
    try:
        account = account_store.register(payload.username, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _build_account_session_response(account, payload.remember_device)


@app.post("/api/auth/login", response_model=AccountSessionResponse)
def api_account_login(payload: AccountLoginRequest) -> AccountSessionResponse:
    account = account_store.authenticate_password(payload.username, payload.password)
    if not account:
        raise HTTPException(status_code=401, detail="用户名或密码错误。")
    return _build_account_session_response(account, payload.remember_device)


@app.post("/api/auth/device-login", response_model=AccountSessionResponse)
def api_account_device_login(payload: AccountDeviceLoginRequest) -> AccountSessionResponse:
    account = account_store.authenticate_device(payload.device_token)
    if not account:
        raise HTTPException(status_code=401, detail="此设备保存的登录凭据已失效，请重新输入密码。")
    return _build_account_session_response(account, remember_device=False)


@app.post("/api/auth/logout", response_model=ApiResponse)
def api_account_logout(request: FastAPIRequest) -> ApiResponse:
    account_store.revoke_session(_read_web_token(request))
    return ApiResponse(success=True, message="Account session cleared.")


@app.put("/api/account/avatar", response_model=AccountAvatarResponse)
def api_account_avatar(payload: AccountAvatarRequest, request: FastAPIRequest) -> AccountAvatarResponse:
    account = getattr(request.state, "account", None)
    if not isinstance(account, dict) or not account.get("username"):
        raise HTTPException(status_code=401, detail="请先登录个人账号。")
    try:
        avatar_data_url = account_store.update_avatar(account["username"], payload.data_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AccountAvatarResponse(avatar_data_url=avatar_data_url)


@app.get("/api/access")
def api_access(request: FastAPIRequest) -> JSONResponse:
    token = _read_web_token(request)
    account = _account_for_web_token(token) if WEB_MODE else None
    role = account["role"] if account else ("user" if WEB_MODE else "desktop")
    saved_settings = state.get_saved_settings()
    return JSONResponse(
        {
            "webMode": WEB_MODE,
            "authenticated": bool(account) or not WEB_MODE,
            "username": account["username"] if account else "",
            "role": role,
            "admin": role == "admin" or not WEB_MODE,
            "avatarDataUrl": account.get("avatar_data_url", "") if account else "",
            "defaultHost": saved_settings.host,
            "defaultSshUsername": saved_settings.username or state.defaults.default_ssh_user,
        }
    )


@app.get("/api/online")
def api_online_status() -> JSONResponse:
    return JSONResponse(_online_snapshot())


@app.post("/api/online/heartbeat")
def api_online_heartbeat(payload: dict[str, object], request: FastAPIRequest) -> JSONResponse:
    return JSONResponse(_record_online_client(request, payload))


@app.post("/api/online/leave")
def api_online_leave(payload: dict[str, object]) -> JSONResponse:
    return JSONResponse(_remove_online_client(payload))


@app.get("/api/settings", response_model=LoginSettingsResponse)
def api_get_settings() -> LoginSettingsResponse:
    return state.get_saved_settings()


@app.post("/api/settings", response_model=LoginSettingsResponse)
def api_save_settings(payload: SettingsRequest) -> LoginSettingsResponse:
    return state.save_settings(payload)


@app.get("/api/captures/files", response_model=CaptureFileListResponse)
def api_capture_files(limit: int = 0) -> CaptureFileListResponse:
    files = capture_store.list_files(limit=limit)
    return CaptureFileListResponse(
        files=files,
        total=len(files),
        total_bytes=sum(int(item.get("size_bytes") or 0) for item in files),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/api/captures/upload", response_model=CaptureUploadResponse)
async def api_capture_upload(
    request: FastAPIRequest,
) -> CaptureUploadResponse:
    account = getattr(request.state, "account", None)
    machine_upload = bool(getattr(request.state, "capture_machine", False))
    if WEB_MODE and not machine_upload and not isinstance(account, dict):
        raise HTTPException(status_code=401, detail="请先登录个人账号，或提供采集上传 token。")
    recovery_task_id = str(request.headers.get("x-telebot-capture-recovery-task") or "").strip()
    recovery_kind = str(request.headers.get("x-telebot-capture-recovery-kind") or "").strip()
    encoded_filename = str(request.headers.get("x-telebot-capture-filename-b64") or "").strip()
    if encoded_filename:
        try:
            filename = base64.b64decode(encoded_filename, validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise HTTPException(status_code=400, detail="补传文件名编码无效。") from exc
    else:
        filename = str(request.headers.get("x-telebot-capture-filename") or "capture.bin")
    encoded_metadata = str(request.headers.get("x-telebot-capture-metadata-b64") or "").strip()
    if encoded_metadata:
        try:
            metadata_json = base64.b64decode(encoded_metadata, validate=True).decode("utf-8")
            parsed_metadata = json.loads(metadata_json or "{}")
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=400, detail="采集文件元数据不是有效 JSON。") from exc
    else:
        parsed_metadata = {}
    if not isinstance(parsed_metadata, dict):
        raise HTTPException(status_code=400, detail="metadata_json 必须是 JSON 对象。")
    recovery_task = None
    if recovery_task_id or recovery_kind:
        _require_admin_account(request)
        if not recovery_task_id or not recovery_kind:
            raise HTTPException(status_code=400, detail="补传请求缺少任务 ID 或素材类型。")
        try:
            recovery_task = capture_tasks.prepare_recovery_upload(recovery_task_id, recovery_kind)
            validate_recovery_filename(recovery_kind, filename)
        except (KeyError, TaskConflict) as exc:
            raise _capture_task_error(exc) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        parsed_metadata = {
            "kind": recovery_kind,
            "source": "console-recovery-upload",
            "session_id": recovery_task["session_id"],
            "room_id": recovery_task["room_id"],
            "started_at_server_ms": recovery_task.get("started_at_server_ms"),
            "stopped_at_server_ms": recovery_task.get("stopped_at_server_ms"),
            "authoritative_started_at_server_ms": recovery_task.get(
                "authoritative_started_at_server_ms",
                recovery_task.get("started_at_server_ms"),
            ),
            "authoritative_stopped_at_server_ms": recovery_task.get(
                "authoritative_stopped_at_server_ms",
                recovery_task.get("stopped_at_server_ms"),
            ),
            "stop_authority": recovery_task.get("stop_authority") or "",
            "recovery_task_id": recovery_task_id,
        }
    if isinstance(account, dict) and account.get("username"):
        parsed_metadata.setdefault("uploaded_by", account["username"])
    try:
        record = await capture_store.store_async_upload(
            request.stream(),
            filename=filename,
            content_type=str(request.headers.get("content-type") or "application/octet-stream"),
            metadata=parsed_metadata,
        )
    except TaskConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"采集文件保存失败：{exc}") from exc
    if recovery_task is not None:
        stored = capture_store.get_file(record["id"])
        try:
            if stored is None:
                raise ValueError("补传文件保存后无法读取。")
            validate_recovery_artifact(
                stored[1],
                recovery_kind,
                recovery_task["session_id"],
                recovery_task["room_id"],
            )
        except (ValueError, OSError) as exc:
            capture_store.delete_file(record["id"])
            detail = str(exc) if isinstance(exc, ValueError) else "补传文件保存后无法读取。"
            raise HTTPException(status_code=400, detail=detail) from exc
        except Exception:
            capture_store.delete_file(record["id"])
            raise
    return CaptureUploadResponse(file=record)


@app.get("/api/captures/files/{capture_id}/download")
def api_capture_download(capture_id: str) -> FileResponse:
    result = capture_store.get_file(capture_id)
    if result is None:
        raise HTTPException(status_code=404, detail="采集文件不存在或已被移除。")
    record, path = result
    return FileResponse(
        path,
        media_type=str(record.get("content_type") or "application/octet-stream"),
        filename=str(record.get("filename") or path.name),
        headers={"X-Capture-SHA256": str(record.get("sha256") or "")},
    )


def _require_admin_account(request: FastAPIRequest) -> dict[str, str]:
    if not WEB_MODE:
        return {"username": "desktop", "role": "admin"}
    account = getattr(request.state, "account", None)
    if not isinstance(account, dict) or account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="只有管理员可以执行此操作。")
    return account


@app.get("/api/captures/tasks")
def api_capture_tasks() -> dict:
    tasks = capture_tasks.list_tasks()
    return {
        "tasks": tasks, "total": len(tasks),
        "total_bytes": sum(t["size_bytes"] + t["output_bytes"] for t in tasks),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _capture_task_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=404 if isinstance(exc, KeyError) else 409,
        detail="采集任务不存在。" if isinstance(exc, KeyError) else str(exc),
    )


@app.post("/api/captures/tasks/{task_id}/synthesize")
def api_capture_synthesize(task_id: str, request: FastAPIRequest) -> dict:
    _require_admin_account(request)
    try:
        return capture_tasks.start(task_id)
    except (KeyError, TaskConflict) as exc:
        raise _capture_task_error(exc) from exc


@app.get("/api/captures/tasks/{task_id}/download")
def api_capture_task_download(task_id: str) -> FileResponse:
    try:
        path = capture_tasks.download(task_id)
    except (KeyError, TaskConflict) as exc:
        raise _capture_task_error(exc) from exc
    return FileResponse(path, media_type="video/mp4", filename=f"{task_id}-piper-replay.mp4")


@app.delete("/api/captures/tasks/{task_id}")
def api_capture_task_delete(task_id: str, request: FastAPIRequest) -> dict:
    _require_admin_account(request)
    try:
        capture_tasks.delete(task_id)
    except (KeyError, TaskConflict) as exc:
        raise _capture_task_error(exc) from exc
    return {"success": True}


_capture_download_tickets: dict[str, dict] = {}
_capture_download_lock = threading.Lock()


@app.post("/api/captures/downloads")
def api_capture_download_ticket(payload: dict[str, str]) -> dict:
    try:
        if payload.get("task_id"):
            capture_tasks.download(payload["task_id"])
            target = {"task_id": payload["task_id"]}
        elif payload.get("file_id") and capture_store.get_file(payload["file_id"]):
            target = {"file_id": payload["file_id"]}
        else:
            raise KeyError("file")
    except (KeyError, TaskConflict) as exc:
        raise _capture_task_error(exc) from exc
    ticket = secrets.token_urlsafe(32)
    with _capture_download_lock:
        now = time.monotonic()
        for key in list(_capture_download_tickets):
            if _capture_download_tickets[key]["expires"] < now:
                del _capture_download_tickets[key]
        if len(_capture_download_tickets) >= 256:
            raise HTTPException(429, "下载请求过多，请稍后重试。")
        _capture_download_tickets[ticket] = {**target, "expires": now + 15 * 60}
    return {"path": f"/api/captures/downloads/{ticket}"}


@app.get("/api/captures/downloads/{ticket}")
def api_capture_ticket_download(ticket: str) -> FileResponse:
    with _capture_download_lock:
        target = _capture_download_tickets.get(ticket)
        if not target or target["expires"] < time.monotonic():
            raise HTTPException(404, "下载凭据已失效，请重新点击下载。")
    response = (
        api_capture_task_download(target["task_id"]) if target.get("task_id")
        else api_capture_download(target["file_id"])
    )
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/api/admin/users", response_model=AdminUserListResponse)
def api_admin_users(request: FastAPIRequest) -> AdminUserListResponse:
    _require_admin_account(request)
    users = account_store.list_users()
    return AdminUserListResponse(
        users=users,
        total=len(users),
        online=sum(1 for user in users if user["online"]),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/api/agent/settings", response_model=AgentSettingsResponse)
def api_get_agent_settings() -> AgentSettingsResponse:
    return AgentSettingsResponse(**agent_settings_store.public_view())


@app.put("/api/agent/settings", response_model=AgentSettingsResponse)
def api_save_agent_settings(payload: AgentSettingsRequest, request: FastAPIRequest) -> AgentSettingsResponse:
    account = _require_admin_account(request)
    try:
        settings = agent_settings_store.save(payload.model_dump(), account["username"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AgentSettingsResponse(**settings)


@app.post("/api/agent/settings/test", response_model=AgentConnectionTestResponse)
def api_test_agent_settings(request: FastAPIRequest) -> AgentConnectionTestResponse:
    _require_admin_account(request)
    settings = agent_settings_store.load_private()
    api_key = str(settings.get("apiKey") or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="请先保存 DeepSeek API Key。")
    base_url = str(settings.get("baseUrl") or "https://api.deepseek.com").rstrip("/")
    models_url = f"{base_url}/models"
    api_request = Request(
        models_url,
        headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urlopen(api_request, timeout=10) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"HTTP {response.status}")
    except HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"DeepSeek API 验证失败：HTTP {exc.code}") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"DeepSeek API 验证失败：{exc}") from exc
    return AgentConnectionTestResponse(success=True, message="DeepSeek API 连接正常。")


@app.post("/api/login", response_model=ApiResponse)
def api_login(payload: LoginRequest) -> ApiResponse:
    try:
        state.login(payload)
    except Exception as exc:
        state.log_store.append(f"Login failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))
    return ApiResponse(success=True, message="Login successful.")


@app.post("/api/logout", response_model=ApiResponse)
def api_logout() -> ApiResponse:
    state.logout()
    return ApiResponse(success=True, message="Logged out.")


@app.get("/api/status", response_model=DashboardStatus)
def api_status() -> DashboardStatus:
    return state.collect_status(source="status")


@app.get("/api/status/live", response_model=DashboardStatus)
def api_status_live() -> DashboardStatus:
    return state._get_short_cached(
        "status-live",
        STATUS_LIVE_CACHE_TTL_SECONDS,
        lambda: state.collect_status(source="silent"),
    )


@app.post("/api/refresh", response_model=DashboardStatus)
def api_refresh() -> DashboardStatus:
    return state.collect_status(source="manual")


@app.get("/api/network-snapshot", response_model=NetworkSnapshot)
def api_network_snapshot() -> NetworkSnapshot:
    return state.get_sidebar_network_snapshot(force_refresh=False)


@app.get("/api/video/status")
def api_video_push_status() -> JSONResponse:
    try:
        return JSONResponse(state.get_video_push_status())
    except Exception as exc:
        state.log_store.append(f"Video push status proxy failed: {exc}", level="warn")
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/traffic-monitor", response_model=TrafficMonitorSnapshot)
def api_traffic_monitor() -> TrafficMonitorSnapshot:
    try:
        return state.get_traffic_monitor_snapshot()
    except Exception as exc:
        state.log_store.append(f"Traffic monitor failed: {exc}", level="warn")
        snapshot = state._empty_traffic_monitor_snapshot("流量监控读取失败", connected=True)
        snapshot.error = str(exc)
        snapshot.congestion_note = str(exc)
        return snapshot


@app.post("/api/video/tencent/{action}")
def api_tencent_video_status(action: str, payload: dict[str, object]) -> JSONResponse:
    try:
        return JSONResponse(state.post_tencent_video_status(action, payload))
    except Exception as exc:
        state.log_store.append(f"Tencent video status proxy failed: {exc}", level="warn")
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/video-preview.mp4")
def api_video_preview() -> StreamingResponse:
    try:
        config, _ = state.get_session()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    remote_url = f"{config.public_base_url}/api/stream.mp4?src={quote(VIDEO_PREVIEW_STREAM_NAME)}"
    request = Request(
        remote_url,
        headers={
            "User-Agent": "CloudServiceConsole/0.3",
            "Cache-Control": "no-cache",
        },
    )
    context = ssl._create_unverified_context() if remote_url.lower().startswith("https://") else None

    try:
        response = urlopen(request, timeout=VIDEO_PREVIEW_TIMEOUT_SECONDS, context=context)
    except Exception as exc:
        state.log_store.append(f"Video preview proxy failed: {exc}", level="error")
        raise HTTPException(status_code=502, detail=f"Video preview proxy failed: {exc}")

    media_type = response.headers.get("Content-Type") or "video/mp4"

    def iterator():
        try:
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            response.close()

    return StreamingResponse(
        iterator(),
        media_type=media_type,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@app.get("/api/control-monitor/config", response_model=ControlMonitorConfigResponse)
def api_control_monitor_config() -> ControlMonitorConfigResponse:
    return state.build_control_monitor_config()


@app.get("/api/control-monitor/offer", response_model=ControlMonitorOfferResponse)
def api_control_monitor_offer(
    session: str = CONTROL_MONITOR_DEFAULT_SESSION,
    compute_client_id: str = "",
):
    try:
        offer = state.poll_control_monitor_offer(session, compute_client_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if offer is None:
        return Response(status_code=204)
    return JSONResponse(content=offer.model_dump())


@app.post("/api/control-monitor/answer", response_model=ApiResponse)
def api_control_monitor_answer(
    payload: ControlSessionDescription,
    session: str = CONTROL_MONITOR_DEFAULT_SESSION,
    offer_id: str = "",
    compute_client_id: str = "",
) -> ApiResponse:
    try:
        return state.post_control_monitor_answer(session, offer_id, compute_client_id, payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/control-monitor/key-state", response_model=ControlMonitorKeyStateResponse)
def api_control_monitor_key_state(session: str = CONTROL_MONITOR_DEFAULT_SESSION) -> ControlMonitorKeyStateResponse:
    try:
        return state.get_control_monitor_key_state(session)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/room/status", response_model=TankTroubleRoomState)
def api_tank_trouble_room_status(payload: TankTroubleRoomStatusRequest) -> TankTroubleRoomState:
    try:
        return state.get_tank_trouble_room_status(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/games/tank-trouble/spectator/page-url", response_model=TankTroublePageUrlResponse)
def api_tank_trouble_spectator_page_url(room: str = "main") -> TankTroublePageUrlResponse:
    try:
        return state.get_tank_trouble_spectator_page_url(room)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/games/tank-trouble/setup/check", response_model=TankTroubleSetupStatus)
def api_tank_trouble_setup_check() -> TankTroubleSetupStatus:
    try:
        return state.check_tank_trouble_setup()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/setup/run", response_model=TankTroubleSetupResult)
def api_tank_trouble_setup_run() -> TankTroubleSetupResult:
    try:
        return state.ensure_tank_trouble_setup()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/room/sync", response_model=TankTroubleRoomState)
def api_tank_trouble_room_sync(payload: TankTroubleRoomRequest) -> TankTroubleRoomState:
    try:
        return state.sync_tank_trouble_room(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/room/vote-toggle", response_model=TankTroubleRoomState)
def api_tank_trouble_room_vote_toggle(payload: TankTroubleRoomRequest) -> TankTroubleRoomState:
    try:
        return state.toggle_tank_trouble_vote(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/room/leave", response_model=TankTroubleRoomState)
def api_tank_trouble_room_leave(payload: TankTroubleRoomRequest) -> TankTroubleRoomState:
    try:
        return state.leave_tank_trouble_room(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/match/sync", response_model=TankTroubleMatchState)
def api_tank_trouble_match_sync(payload: TankTroubleMatchRequest) -> TankTroubleMatchState:
    try:
        return state.sync_tank_trouble_match(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/match/leave", response_model=ApiResponse)
def api_tank_trouble_match_leave(payload: TankTroubleRoomRequest) -> ApiResponse:
    try:
        return state.leave_tank_trouble_match(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.websocket("/api/games/tank-trouble/match/ws")
async def websocket_tank_trouble_match_sync(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            message = await websocket.receive_json()
            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "message": "message must be an object"})
                continue

            message_type = str(message.get("type") or "sync").strip().lower()
            payload = message.get("payload")

            if message_type == "leave":
                try:
                    leave_payload = TankTroubleRoomRequest.model_validate(payload or {})
                    await asyncio.to_thread(state.leave_tank_trouble_match, leave_payload)
                    await websocket.send_json({"type": "left", "ok": True})
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                continue

            try:
                loop = asyncio.get_running_loop()
                drain_deadline = loop.time() + 0.006
                while True:
                    timeout = min(0.0015, max(0.0, drain_deadline - loop.time()))
                    if timeout <= 0:
                        break
                    try:
                        next_message = await asyncio.wait_for(websocket.receive_json(), timeout=timeout)
                    except asyncio.TimeoutError:
                        break
                    if not isinstance(next_message, dict):
                        continue
                    next_message_type = str(next_message.get("type") or "sync").strip().lower()
                    next_payload = next_message.get("payload")
                    if next_message_type == "leave":
                        leave_payload = TankTroubleRoomRequest.model_validate(next_payload or {})
                        await asyncio.to_thread(state.leave_tank_trouble_match, leave_payload)
                        await websocket.send_json({"type": "left", "ok": True})
                        return
                    payload = next_payload
                sync_payload = TankTroubleMatchRequest.model_validate(payload or {})
                next_state = await asyncio.to_thread(state.sync_tank_trouble_match, sync_payload)
                await websocket.send_json({"type": "state", "state": next_state.model_dump()})
            except Exception as exc:
                await websocket.send_json({"type": "error", "message": str(exc)})
    except WebSocketDisconnect:
        return


@app.post("/api/games/tank-trouble/latency/sync", response_model=TankTroubleLatencyState)
def api_tank_trouble_latency_sync(payload: TankTroubleLatencyRequest) -> TankTroubleLatencyState:
    try:
        return state.sync_tank_trouble_latency(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/latency/leave", response_model=ApiResponse)
def api_tank_trouble_latency_leave(payload: TankTroubleRoomRequest) -> ApiResponse:
    try:
        return state.leave_tank_trouble_latency(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.websocket("/api/games/tank-trouble/latency/ws")
async def websocket_tank_trouble_latency_sync(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            message = await websocket.receive_json()
            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "message": "message must be an object"})
                continue

            message_type = str(message.get("type") or "sync").strip().lower()
            payload = message.get("payload")

            if message_type == "leave":
                try:
                    leave_payload = TankTroubleRoomRequest.model_validate(payload or {})
                    await asyncio.to_thread(state.leave_tank_trouble_latency, leave_payload)
                    await websocket.send_json({"type": "left", "ok": True})
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                continue

            try:
                sync_payload = TankTroubleLatencyRequest.model_validate(payload or {})
                next_state = await asyncio.to_thread(state.sync_tank_trouble_latency, sync_payload)
                await websocket.send_json({"type": "state", "state": next_state.model_dump()})
            except Exception as exc:
                await websocket.send_json({"type": "error", "message": str(exc)})
    except WebSocketDisconnect:
        return


@app.post("/api/games/tank-trouble/preview/push", response_model=ApiResponse)
def api_tank_trouble_preview_push(payload: TankTroublePreviewPushRequest) -> ApiResponse:
    try:
        return state.push_tank_trouble_preview(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/games/tank-trouble/preview/clear", response_model=ApiResponse)
def api_tank_trouble_preview_clear(payload: TankTroublePreviewClearRequest) -> ApiResponse:
    try:
        return state.clear_tank_trouble_preview(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/games/tank-trouble/preview/state")
def api_tank_trouble_preview_state() -> JSONResponse:
    response = JSONResponse(state.get_tank_trouble_preview_state().model_dump())
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.get("/tank-trouble/preview")
def api_tank_trouble_preview_page() -> Response:
    response = Response(content=render_tank_trouble_preview_html(), media_type="text/html; charset=utf-8")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.post("/api/network-snapshot/refresh", response_model=NetworkSnapshot)
def api_network_snapshot_refresh() -> NetworkSnapshot:
    return state.get_sidebar_network_snapshot(force_refresh=True)


@app.post("/api/services/start-all", response_model=ApiResponse)
def api_start_all() -> ApiResponse:
    try:
        state.start_all()
    except Exception as exc:
        state.log_store.append(f"Start-all failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))
    return ApiResponse(success=True, message="All services started.")


@app.post("/api/services/stop-all", response_model=ApiResponse)
def api_stop_all() -> ApiResponse:
    try:
        state.stop_all()
    except Exception as exc:
        state.log_store.append(f"Stop-all failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))
    return ApiResponse(success=True, message="All services stopped.")


@app.post("/api/services/{service_name}/start", response_model=ApiResponse)
def api_start_service(service_name: str) -> ApiResponse:
    try:
        state.start_service(service_name)
    except Exception as exc:
        state.log_store.append(f"Start {service_name} failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))
    return ApiResponse(success=True, message=f"{service_name} started.")


@app.post("/api/services/{service_name}/stop", response_model=ApiResponse)
def api_stop_service(service_name: str) -> ApiResponse:
    try:
        state.stop_service(service_name)
    except Exception as exc:
        state.log_store.append(f"Stop {service_name} failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))
    return ApiResponse(success=True, message=f"{service_name} stopped.")


@app.post("/api/ingest-mode/switch", response_model=IngestModeResult)
def api_switch_ingest_mode(payload: IngestModeSwitchRequest) -> IngestModeResult:
    try:
        return state.switch_ingest_mode(payload.target_mode)
    except Exception as exc:
        state.log_store.append(f"Ingest mode API failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/ports/check-all", response_model=PortChecksResponse)
def api_check_all_ports() -> PortChecksResponse:
    try:
        return state.check_all_ports()
    except Exception as exc:
        state.log_store.append(f"Port check-all failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/ports/{port_key}/check", response_model=PortStatus)
def api_check_port(port_key: str) -> PortStatus:
    try:
        return state.check_port(port_key)
    except Exception as exc:
        state.log_store.append(f"Port check {port_key} failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/logs", response_model=LogsResponse)
def api_logs() -> LogsResponse:
    return state.logs()


@app.get("/api/local-setup/check", response_model=LocalSetupStatus)
def api_check_local_setup() -> LocalSetupStatus:
    try:
        return state.check_local_setup()
    except Exception as exc:
        state.log_store.append(f"Cloud setup check failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/local-setup/run", response_model=LocalSetupResult)
def api_run_local_setup(payload: LocalSetupRunRequest) -> LocalSetupResult:
    try:
        return state.ensure_local_setup(payload.password)
    except Exception as exc:
        state.log_store.append(f"Cloud setup run failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/local-stream/status", response_model=LocalStreamStatus)
def api_local_stream_status() -> LocalStreamStatus:
    try:
        return state.get_local_stream_status()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/local-stream/config", response_model=LocalStreamStatus)
def api_local_stream_config(payload: LocalStreamConfig) -> LocalStreamStatus:
    try:
        return state.save_local_stream_config(payload)
    except Exception as exc:
        state.log_store.append(f"Local stream config save failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/local-stream/setup", response_model=LocalStreamStatus)
def api_local_stream_setup() -> LocalStreamStatus:
    try:
        return state.setup_local_stream()
    except Exception as exc:
        state.log_store.append(f"Local stream setup failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/local-stream/start", response_model=LocalStreamStatus)
def api_local_stream_start(payload: LocalStreamConfig) -> LocalStreamStatus:
    try:
        return state.start_local_stream(payload)
    except Exception as exc:
        state.log_store.append(f"Local stream start failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/local-stream/stop", response_model=LocalStreamStatus)
def api_local_stream_stop() -> LocalStreamStatus:
    try:
        return state.stop_local_stream()
    except Exception as exc:
        state.log_store.append(f"Local stream stop failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/p2p-local-pusher/status", response_model=P2PLocalPusherStatus)
def api_p2p_local_pusher_status() -> P2PLocalPusherStatus:
    if WEB_MODE:
        return P2PLocalPusherStatus(
            available=False,
            running=False,
            message="P2P local pusher is available only in the desktop app.",
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
    try:
        return state.get_p2p_local_pusher_status()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/p2p-local-pusher/start", response_model=P2PLocalPusherStatus)
def api_p2p_local_pusher_start(payload: LocalStreamConfig, room_id: str = "robot", watch_url: str = "") -> P2PLocalPusherStatus:
    if WEB_MODE:
        raise HTTPException(status_code=400, detail="P2P local pusher is available only in the desktop app.")
    try:
        return state.start_p2p_local_pusher(payload, room_id, watch_url)
    except Exception as exc:
        state.log_store.append(f"P2P local pusher start failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/p2p-local-pusher/stop", response_model=P2PLocalPusherStatus)
def api_p2p_local_pusher_stop() -> P2PLocalPusherStatus:
    if WEB_MODE:
        raise HTTPException(status_code=400, detail="P2P local pusher is available only in the desktop app.")
    try:
        return state.stop_p2p_local_pusher()
    except Exception as exc:
        state.log_store.append(f"P2P local pusher stop failed: {exc}", level="error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.on_event("shutdown")
def on_shutdown() -> None:
    capture_tasks.close()
    try:
        if state.current_config is not None:
            state.local_stream_manager.stop(state.current_config, quiet=True)
        state.local_stream_manager.clear_logs()
    except Exception:
        pass
    try:
        state.p2p_local_pusher_manager.stop(quiet=True)
    except Exception:
        pass
    try:
        state.logout()
    except Exception:
        pass


if WEB_MODE and WEB_FRONTEND_DIST.exists():
    assets_dir = WEB_FRONTEND_DIST / "assets"
    flags_dir = WEB_FRONTEND_DIST / "flags"
    tank_trouble_dir = WEB_FRONTEND_DIST / "tank-trouble"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="web-assets")
    if flags_dir.exists():
        app.mount("/flags", StaticFiles(directory=str(flags_dir)), name="web-flags")
    if tank_trouble_dir.exists():
        app.mount("/tank-trouble", StaticFiles(directory=str(tank_trouble_dir)), name="web-tank-trouble-assets")

    @app.get("/{full_path:path}")
    def web_spa_fallback(full_path: str) -> FileResponse:
        requested = (WEB_FRONTEND_DIST / full_path).resolve()
        dist_root = WEB_FRONTEND_DIST.resolve()
        if requested.is_file() and dist_root in requested.parents:
            return FileResponse(str(requested))
        return FileResponse(str(WEB_FRONTEND_DIST / "index.html"))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.environ.get("CLOUD_CONSOLE_BACKEND_HOST", DEFAULT_BACKEND_HOST),
        port=int(os.environ.get("CLOUD_CONSOLE_BACKEND_PORT", DEFAULT_BACKEND_PORT)),
        reload=False,
    )
