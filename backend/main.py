from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import socket
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.parse import quote
from urllib.request import Request, build_opener, urlopen

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

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
from log_store import LogStore
from models import (
    ApiResponse,
    ControlMonitorConfigResponse,
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
    LogsResponse,
    NetworkEndpointStatus,
    NetworkSnapshot,
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
CONTROL_MONITOR_DEFAULT_SESSION = "robot-control"
CONTROL_MONITOR_POLL_INTERVAL_SEC = 1.0
CONTROL_MONITOR_TURN_PORT = 3478
CONTROL_MONITOR_TURN_USERNAME = "telemetry"
CONTROL_MONITOR_TURN_CREDENTIAL = "123456"
CONTROL_MONITOR_REQUEST_TIMEOUT_SECONDS = 25


class BackendState:
    def __init__(self) -> None:
        self.defaults = load_config_defaults()
        self.log_store = LogStore()
        self._session_lock = threading.Lock()
        self._network_lock = threading.Lock()
        self._local_setup_lock = threading.Lock()
        self._ingest_mode_lock = threading.Lock()
        self._tank_trouble_lock = threading.Lock()
        self._tank_trouble_setup_lock = threading.Lock()
        self.current_config = None
        self.current_client = None
        self._tank_trouble_bridge = None
        self._tank_trouble_preview_runtime = TankTroublePreviewRuntime()
        self._network_cache_host = ""
        self._network_cache_updated_at = 0.0
        self._network_cache = self.build_default_network_snapshot("")
        self.log_store.append("Backend initialized.")

    def get_saved_settings(self) -> LoginSettingsResponse:
        saved = load_login_settings(self.defaults)
        return LoginSettingsResponse(
            host=saved.host,
            username=saved.username,
            password=saved.password,
            remember_password=saved.remember_password,
            auto_login=saved.auto_login,
        )

    def save_settings(self, payload: SettingsRequest) -> LoginSettingsResponse:
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
        )

    def login(self, payload: LoginRequest) -> None:
        runtime_config = self.defaults.build_runtime_config(payload.host, payload.username, payload.password)
        remote_client = CloudRemoteClient(runtime_config)
        remote_client.probe()

        saved = save_login_settings(self.defaults, self._to_login_settings(payload))

        with self._session_lock:
            if self.current_client is not None:
                self.current_client.close()
            self.current_config = runtime_config
            self.current_client = remote_client
        with self._tank_trouble_lock:
            self._tank_trouble_bridge = None

        self.invalidate_network_cache()
        self.log_store.append(f"Connected to {runtime_config.ssh_target}:{runtime_config.ssh_port}")
        if saved.auto_login:
            self.log_store.append("Auto-login preference is enabled.")

    def logout(self) -> None:
        with self._session_lock:
            if self.current_client is not None:
                self.current_client.close()
            self.current_client = None
            self.current_config = None
        with self._tank_trouble_lock:
            self._tank_trouble_bridge = None
        self.invalidate_network_cache()
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
                    detail=meta["description"],
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

        self.log_store.append(f"Cloud setup started: {runtime_config.public_host}")
        try:
            bundle.deploy(client)
        except Exception as exc:
            self.log_store.append(f"Cloud setup failed: {exc}", level="error")
            raise

        self.log_store.append("Cloud setup completed.")
        return LocalSetupResult(ready=True, changed=True, message="环境已就绪")

    def check_local_setup(self) -> LocalSetupStatus:
        if not self._local_setup_lock.acquire(blocking=False):
            raise RuntimeError("一键配置正在进行中。")

        try:
            ready, message = self.evaluate_local_setup_ready()
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

    def _control_monitor_url(self, session_name: str, path: str, offer_id: str = "") -> str:
        config, _ = self.get_session()
        params = {"session": session_name}
        if offer_id:
            params["offer_id"] = offer_id
        return f"{config.public_base_url}/control/webrtc/{path}?{urlencode(params)}"

    @staticmethod
    def _perform_remote_json_request(
        remote_url: str,
        method: str = "GET",
        payload: dict[str, object] | None = None,
        timeout_seconds: float = CONTROL_MONITOR_REQUEST_TIMEOUT_SECONDS,
    ) -> tuple[int, bytes]:
        body = None
        headers = {
            "User-Agent": "CloudServiceConsole/0.3",
            "Cache-Control": "no-cache",
        }
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

    def poll_control_monitor_offer(self, session_name: str) -> ControlMonitorOfferResponse | None:
        remote_url = self._control_monitor_url(session_name, "robot-next-offer")
        status_code, body = self._perform_remote_json_request(remote_url)
        if status_code == 204:
            return None
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Control monitor offer response was not valid JSON.") from exc
        return ControlMonitorOfferResponse.model_validate(payload)

    def post_control_monitor_answer(
        self,
        session_name: str,
        offer_id: str,
        payload: ControlSessionDescription,
    ) -> ApiResponse:
        if not offer_id.strip():
            raise RuntimeError("offer_id is required.")

        remote_url = self._control_monitor_url(session_name, "robot-answer", offer_id=offer_id)
        self._perform_remote_json_request(
            remote_url,
            method="POST",
            payload=payload.model_dump(),
        )
        return ApiResponse(success=True, message="Control answer posted.")

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
        return TankTroubleSetupStatus(ready=ready, message="服务器已就绪" if ready else message)

    def ensure_tank_trouble_setup(self) -> TankTroubleSetupResult:
        if not self._tank_trouble_setup_lock.acquire(blocking=False):
            raise RuntimeError("Tank Trouble setup is already running.")
        try:
            config, client = self.get_session()
            bridge = self._get_tank_trouble_bridge(config)
            changed = bridge.setup_server(client)
            self.log_store.append(
                f"Tank Trouble cloud bundle checked on {config.public_host}:{TANK_GAME_SERVER_PORT}; changed={changed}."
            )
            return TankTroubleSetupResult(ready=True, changed=changed, message="服务器已同步到当前版本")
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


state = BackendState()
app = FastAPI(title="Cloud Service Console Backend", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/api/settings", response_model=LoginSettingsResponse)
def api_get_settings() -> LoginSettingsResponse:
    return state.get_saved_settings()


@app.post("/api/settings", response_model=LoginSettingsResponse)
def api_save_settings(payload: SettingsRequest) -> LoginSettingsResponse:
    return state.save_settings(payload)


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
    return state.collect_status(source="silent")


@app.post("/api/refresh", response_model=DashboardStatus)
def api_refresh() -> DashboardStatus:
    return state.collect_status(source="manual")


@app.get("/api/network-snapshot", response_model=NetworkSnapshot)
def api_network_snapshot() -> NetworkSnapshot:
    return state.get_sidebar_network_snapshot(force_refresh=False)


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
def api_control_monitor_offer(session: str = CONTROL_MONITOR_DEFAULT_SESSION):
    try:
        offer = state.poll_control_monitor_offer(session)
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
) -> ApiResponse:
    try:
        return state.post_control_monitor_answer(session, offer_id, payload)
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


@app.on_event("shutdown")
def on_shutdown() -> None:
    try:
        state.logout()
    except Exception:
        pass


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.environ.get("CLOUD_CONSOLE_BACKEND_HOST", DEFAULT_BACKEND_HOST),
        port=int(os.environ.get("CLOUD_CONSOLE_BACKEND_PORT", DEFAULT_BACKEND_PORT)),
        reload=False,
    )
