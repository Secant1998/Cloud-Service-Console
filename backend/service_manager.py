from __future__ import annotations

import errno
import socket
from typing import Dict, List, Tuple

from cloud_client import CloudRemoteClient
from config import CloudRuntimeConfig
from config import (
    REMOTE_PORT_META,
    REMOTE_SERVICE_META,
    REMOTE_SERVICE_ORDER,
    REMOTE_SERVICE_STOP_ORDER,
)
from log_store import LogStore
from models import PortStatus, ServiceStatus


class ServiceManager:
    def __init__(
        self,
        remote_client: CloudRemoteClient,
        log_store: LogStore,
        runtime_config: CloudRuntimeConfig | None = None,
    ) -> None:
        self.remote_client = remote_client
        self.log_store = log_store
        self.runtime_config = runtime_config
        self._ingest_mode: str | None = None

    def ensure_known_port(self, port_key: str) -> None:
        if not any(str(item["key"]) == port_key for item in REMOTE_PORT_META):
            raise RuntimeError(f"Unknown port: {port_key}")

    def ensure_known_service(self, service_name: str) -> None:
        if service_name not in REMOTE_SERVICE_META:
            raise RuntimeError(f"Unknown service: {service_name}")

    def start_service(self, service_name: str) -> None:
        self.ensure_known_service(service_name)
        title = REMOTE_SERVICE_META[service_name]["title"]
        self.log_store.append(f"Requesting start: {title}")
        self.remote_client.run(
            f"sudo test -f /etc/systemd/system/{service_name}.service >/dev/null 2>&1 || true; "
            f"sudo systemctl start {service_name}"
        )
        self.log_store.append(f"{title} started.")

    def stop_service(self, service_name: str) -> None:
        self.ensure_known_service(service_name)
        title = REMOTE_SERVICE_META[service_name]["title"]
        self.log_store.append(f"Requesting stop: {title}")
        self.remote_client.run(
            f"sudo systemctl stop {service_name} || true; "
            f"sudo systemctl reset-failed {service_name} >/dev/null 2>&1 || true"
        )
        self.log_store.append(f"{title} stopped.")

    def start_all(self) -> None:
        for service_name in REMOTE_SERVICE_ORDER:
            self.log_store.append(f"Requesting start: {REMOTE_SERVICE_META[service_name]['title']}")
        service_list = " ".join(REMOTE_SERVICE_ORDER)
        self.remote_client.run(
            f"systemctl cat {service_list} >/dev/null 2>&1 || exit 14; sudo systemctl start {service_list}",
            timeout=90,
        )
        self.log_store.append("All cloud services started.")

    def stop_all(self) -> None:
        for service_name in REMOTE_SERVICE_STOP_ORDER:
            self.log_store.append(f"Requesting stop: {REMOTE_SERVICE_META[service_name]['title']}")
        service_list = " ".join(REMOTE_SERVICE_STOP_ORDER)
        self.remote_client.run(
            f"sudo systemctl stop {service_list} || true; "
            f"sudo systemctl reset-failed {service_list} >/dev/null 2>&1 || true",
            timeout=90,
        )
        self.log_store.append("All cloud services stopped.")

    def query_remote_services_state(self) -> Dict[str, Dict[str, str]]:
        service_list = " ".join(REMOTE_SERVICE_ORDER)
        command = (
            f"for svc in {service_list}; do "
            "echo __SERVICE__:$svc; "
            'systemctl show "$svc" --property=ActiveState,SubState,UnitFileState,MainPID --no-page; '
            "done"
        )
        output = self.remote_client.run(command, timeout=45)

        status_map = {}
        current_service = None
        for line in output.splitlines():
            stripped = line.strip()
            if stripped.startswith("__SERVICE__:"):
                current_service = stripped.split(":", 1)[1]
                status_map[current_service] = {
                    "ActiveState": "unknown",
                    "SubState": "unknown",
                    "UnitFileState": "unknown",
                    "MainPID": "-",
                }
                continue
            if current_service is None or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            status_map[current_service][key] = value.strip() or "-"

        for service_name in REMOTE_SERVICE_ORDER:
            status_map.setdefault(
                service_name,
                {
                    "ActiveState": "unknown",
                    "SubState": "unknown",
                    "UnitFileState": "unknown",
                    "MainPID": "-",
                },
            )

        return status_map

    def query_remote_listeners(self) -> set[tuple[str, int]]:
        output = self.remote_client.run(
            "sh -lc 'command -v ss >/dev/null 2>&1 && ss -ltnuH || netstat -lntu'",
            timeout=30,
        )

        listeners: set[tuple[str, int]] = set()
        for line in output.splitlines():
            parsed = self._parse_listener_line(line)
            if parsed is not None:
                listeners.add(parsed)
        return listeners

    @staticmethod
    def _parse_listener_line(line: str) -> tuple[str, int] | None:
        stripped = str(line or "").strip()
        if not stripped:
            return None

        tokens = stripped.split()
        if not tokens:
            return None

        proto_token = tokens[0].lower()
        if proto_token.startswith("tcp"):
            protocol = "tcp"
        elif proto_token.startswith("udp"):
            protocol = "udp"
        else:
            return None

        if len(tokens) >= 5 and not tokens[1].isdigit():
            local_address = tokens[4]
        elif len(tokens) >= 4:
            local_address = tokens[3]
        else:
            return None

        port = ServiceManager._extract_port(local_address)
        if port is None:
            return None
        return protocol, port

    def detect_ingest_mode(self) -> str:
        if self._ingest_mode is not None:
            return self._ingest_mode

        try:
            output = self.remote_client.run("systemctl cat go2rtc-srt-bridge --no-pager 2>/dev/null || true", timeout=20)
        except Exception:
            self._ingest_mode = "unknown"
            return self._ingest_mode

        lowered = output.lower()
        if '-listen 1 -method post' in lowered or 'http://0.0.0.0:' in lowered:
            self._ingest_mode = "http"
        elif 'srt://0.0.0.0:' in lowered:
            self._ingest_mode = "srt"
        else:
            self._ingest_mode = "unknown"
        return self._ingest_mode

    def probe_public_tcp_port(self, port: int, timeout_seconds: float = 1.5) -> bool:
        host = (self.runtime_config.public_host if self.runtime_config is not None else "").strip()
        if not host:
            return False

        try:
            with socket.create_connection((host, int(port)), timeout=timeout_seconds):
                return True
        except ConnectionRefusedError:
            return True
        except socket.timeout:
            return False
        except OSError as exc:
            if exc.errno in {
                errno.ETIMEDOUT,
                errno.EHOSTUNREACH,
                errno.ENETUNREACH,
                10060,
                10065,
                10051,
            }:
                return False
            if exc.errno in {errno.ECONNREFUSED, 10061}:
                return True
            return False

    @staticmethod
    def _port_title_for_mode(port_key: str, title: str, ingest_mode: str) -> str:
        if port_key == "ingest-http" and ingest_mode == "srt":
            return f"{title} (inactive)"
        if port_key == "srt" and ingest_mode == "http":
            return f"{title} (inactive)"
        return title

    def _build_port_status(self, item: dict, listeners: set[tuple[str, int]], ingest_mode: str) -> PortStatus:
        port_key = str(item["key"])
        title = self._port_title_for_mode(port_key, str(item["title"]), ingest_mode)
        port = int(item["port"])
        protocols = [str(value).lower() for value in item["protocols"]]

        checked = True
        ok = False

        if port_key in {"ssh", "public-http", "webrtc"}:
            ok = self.probe_public_tcp_port(port)
        elif port_key == "ingest-http":
            if ingest_mode == "srt":
                checked = False
            else:
                ok = self.probe_public_tcp_port(port)
        elif port_key == "srt":
            if ingest_mode == "http":
                checked = False
            else:
                ok = any((protocol, port) in listeners for protocol in protocols)
        else:
            ok = any((protocol, port) in listeners for protocol in protocols)

        return PortStatus(
            key=port_key,
            title=title,
            port=port,
            protocol="/".join(protocol.upper() for protocol in protocols),
            listening=ok,
            checked=checked,
        )

    @staticmethod
    def _service_meta_for_mode(service_name: str, ingest_mode: str) -> tuple[str, str]:
        meta = REMOTE_SERVICE_META[service_name]
        title = str(meta["title"])
        description = str(meta["description"])

        if service_name == "go2rtc-srt-bridge":
            return "Ingest Bridge", "Video ingest listener and RTSP republisher"

        return title, description

    @staticmethod
    def _extract_port(address_token: str) -> int | None:
        token = str(address_token or "").strip()
        if not token:
            return None

        if token.startswith("[") and "]:" in token:
            port_text = token.rsplit("]:", 1)[1]
        elif ":" in token:
            port_text = token.rsplit(":", 1)[1]
        else:
            return None

        return int(port_text) if port_text.isdigit() else None

    def build_port_statuses(self) -> List[PortStatus]:
        listeners = self.query_remote_listeners()
        ingest_mode = self.detect_ingest_mode()
        statuses: List[PortStatus] = []

        for item in REMOTE_PORT_META:
            statuses.append(self._build_port_status(item, listeners, ingest_mode))

        return statuses

    def build_port_status(self, port_key: str) -> PortStatus:
        self.ensure_known_port(port_key)
        for status in self.build_port_statuses():
            if status.key == port_key:
                return status
        raise RuntimeError(f"Unknown port: {port_key}")

    def build_service_statuses(self) -> Tuple[List[ServiceStatus], int, List[str]]:
        raw_status = self.query_remote_services_state()
        ingest_mode = self.detect_ingest_mode()
        services = []
        running_count = 0
        summary_parts = []

        for service_name in REMOTE_SERVICE_ORDER:
            item = raw_status.get(service_name, {})
            active = str(item.get("ActiveState") or "unknown")
            sub_state = str(item.get("SubState") or "unknown")
            pid = str(item.get("MainPID") or "-")
            unit_state = str(item.get("UnitFileState") or "unknown")
            running = active.lower() == "active" and sub_state.lower() == "running"
            if running:
                running_count += 1

            title, description = self._service_meta_for_mode(service_name, ingest_mode)
            detail_parts = [description]
            if service_name == "go2rtc-srt-bridge":
                mode_label = ingest_mode.upper() if ingest_mode in {"http", "srt"} else "UNKNOWN"
                detail_parts.insert(0, f"mode: {mode_label}")
            detail_parts.append(f"autostart: {unit_state}")
            services.append(
                ServiceStatus(
                    name=service_name,
                    title=title,
                    description=description,
                    running=running,
                    pid=pid,
                    status=f"{active} ({sub_state})",
                    active_state=active,
                    sub_state=sub_state,
                    unit_state=unit_state,
                    detail=" | ".join(detail_parts),
                )
            )
            summary_parts.append(f"{service_name}={active}/{sub_state}")

        return services, running_count, summary_parts
