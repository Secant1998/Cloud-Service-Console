from __future__ import annotations

import base64
import http.client
import json
import posixpath
import shlex
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from cloud_client import CloudRemoteClient
from config import CloudRuntimeConfig, TANK_GAME_SERVER_PORT, TANK_GAME_SERVER_IDLE_TIMEOUT


BUNDLE_DIR_NAME = "cloud_setup_bundle"
REMOTE_BASE_DIRNAME = ".cloud-service-console"
REMOTE_ROOM_DIRNAME = "tank-trouble"
REMOTE_SCRIPT_NAME = "tank_trouble_room.py"

_SERVER_STARTUP_WAIT = 3.0
_SERVER_STARTUP_POLL = 0.3
_SERVER_RETRY_COOLDOWN = 60.0


class TankTroubleCloudBridge:
    def __init__(self, config: CloudRuntimeConfig) -> None:
        self.config = config
        self.bundle_root = Path(__file__).resolve().parent / BUNDLE_DIR_NAME
        self.local_script_path = self.bundle_root / REMOTE_SCRIPT_NAME
        self.remote_base = f"/home/{config.ssh_user}/{REMOTE_BASE_DIRNAME}/{REMOTE_ROOM_DIRNAME}"
        self.remote_script_path = posixpath.join(self.remote_base, REMOTE_SCRIPT_NAME)
        self._server_base_url: str | None = None
        self._server_confirmed_reachable = False
        self._server_last_fail_time: float = 0.0
        self._script_uploaded = False
        self._latency_http_connection: http.client.HTTPConnection | None = None
        self._latency_http_lock = threading.Lock()

    def sync_room(
        self,
        client: CloudRemoteClient,
        *,
        room: str,
        player_id: str,
        country_code: str,
    ) -> dict[str, object]:
        return self._run_action(
            client,
            action="sync",
            room=room,
            player_id=player_id,
            country_code=country_code,
        )

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

    def ensure_remote_script(self, client: CloudRemoteClient) -> None:
        if self._script_uploaded:
            return

        if not self.local_script_path.exists():
            raise RuntimeError(f"Tank Trouble cloud script not found: {self.local_script_path}")

        prepare_command = (
            f"mkdir -p {shlex.quote(self.remote_base)} && "
            f"chmod 700 {shlex.quote(self.remote_base)}"
        )
        client.run(f"bash -lc {shlex.quote(prepare_command)}", timeout=20)
        client.put_file(self.local_script_path, self.remote_script_path)
        chmod_command = f"chmod 755 {shlex.quote(self.remote_script_path)}"
        client.run(f"bash -lc {shlex.quote(chmod_command)}", timeout=20)
        self._script_uploaded = True

    def _run_action(
        self,
        client: CloudRemoteClient,
        *,
        action: str,
        room: str,
        player_id: str,
        country_code: str,
    ) -> dict[str, object]:
        return self._run_payload(
            client,
            {
                "action": action,
                "room": room,
                "player_id": player_id,
                "country_code": country_code,
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
                return self._post_latency_server(path, payload)
            except Exception:
                self._server_confirmed_reachable = False
                self._server_base_url = None

        if time.time() - self._server_last_fail_time < _SERVER_RETRY_COOLDOWN:
            return self._run_payload(client, payload)

        try:
            self._ensure_latency_server(client)
            result = self._post_latency_server(path, payload)
            self._server_confirmed_reachable = True
            return result
        except Exception:
            self._server_base_url = None
            self._server_last_fail_time = time.time()
            return self._run_payload(client, payload)

    def _latency_server_base_url(self) -> str:
        if self._server_base_url is None:
            self._server_base_url = f"http://{self.config.public_host}:{TANK_GAME_SERVER_PORT}"
        return self._server_base_url

    def _ensure_latency_server(self, client: CloudRemoteClient) -> None:
        try:
            self._get_latency_server_health(timeout=0.8)
            return
        except Exception:
            pass

        self._start_latency_server(client)
        self._wait_for_latency_server()

    def _start_latency_server(self, client: CloudRemoteClient) -> None:
        self.ensure_remote_script(client)
        log_path = posixpath.join(self.remote_base, "tank-trouble-server.log")
        command = (
            f"cd {shlex.quote(self.remote_base)} && "
            f"nohup python3 {shlex.quote(self.remote_script_path)} "
            f"--serve --port {TANK_GAME_SERVER_PORT} "
            f"--idle-timeout {TANK_GAME_SERVER_IDLE_TIMEOUT} "
            f"> {shlex.quote(log_path)} 2>&1 < /dev/null &"
        )
        client.run(f"bash -lc {shlex.quote(command)}", timeout=10)

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

    def _get_latency_server_health(self, *, timeout: float) -> dict[str, object]:
        return self._request_latency_server("GET", "/health", None, timeout=timeout)

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

        with self._latency_http_lock:
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
                connection.request(method, path, body=body, headers=headers)
                response = connection.getresponse()
                response_body = response.read().decode("utf-8")
                if response.status >= 400:
                    raise RuntimeError(response_body or f"Tank Trouble latency server returned {response.status}")
                return response_body
            except Exception as exc:
                last_error = exc
                self._close_latency_http_connection()
        raise RuntimeError(str(last_error or "Tank Trouble latency server request failed."))

    def _get_latency_http_connection(self, *, timeout: float, reset: bool = False) -> http.client.HTTPConnection:
        if reset:
            self._close_latency_http_connection()
        if self._latency_http_connection is None:
            self._latency_http_connection = http.client.HTTPConnection(
                self.config.public_host,
                TANK_GAME_SERVER_PORT,
                timeout=timeout,
            )
        else:
            self._latency_http_connection.timeout = timeout
        return self._latency_http_connection

    def _close_latency_http_connection(self) -> None:
        if self._latency_http_connection is None:
            return
        try:
            self._latency_http_connection.close()
        finally:
            self._latency_http_connection = None
