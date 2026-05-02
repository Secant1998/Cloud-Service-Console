from __future__ import annotations

import threading
from pathlib import Path

import paramiko

from config import CloudRuntimeConfig


class CloudRemoteClient:
    def __init__(self, config: CloudRuntimeConfig) -> None:
        self.config = config
        self._client = None
        self._lock = threading.Lock()

    def close(self) -> None:
        with self._lock:
            self._close_locked()

    def _close_locked(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            finally:
                self._client = None

    def _connect_locked(self) -> None:
        transport = self._client.get_transport() if self._client is not None else None
        if transport is not None and transport.is_active():
            return

        self._close_locked()
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=self.config.ssh_host,
            port=self.config.ssh_port,
            username=self.config.ssh_user,
            password=self.config.ssh_password,
            look_for_keys=False,
            allow_agent=False,
            timeout=12,
            banner_timeout=12,
            auth_timeout=12,
        )
        active_transport = client.get_transport()
        if active_transport is not None:
            active_transport.set_keepalive(30)
        self._client = client

    def probe(self) -> None:
        self.run("printf connected", timeout=10)

    def run(self, remote_command: str, timeout: int = 60) -> str:
        last_error = None
        for _ in range(2):
            with self._lock:
                try:
                    self._connect_locked()
                    assert self._client is not None
                    _, stdout, stderr = self._client.exec_command(remote_command, timeout=timeout)
                    stdout_text = stdout.read().decode("utf-8", errors="ignore").strip()
                    stderr_text = stderr.read().decode("utf-8", errors="ignore").strip()
                    exit_status = stdout.channel.recv_exit_status()
                except Exception as exc:
                    last_error = exc
                    self._close_locked()
                    continue

                if exit_status != 0:
                    output = "\n".join(part for part in [stdout_text, stderr_text] if part).strip()
                    raise RuntimeError(output or f"Remote command failed with code {exit_status}")

                return "\n".join(part for part in [stdout_text, stderr_text] if part).strip()

        raise RuntimeError(f"SSH connection failed: {last_error}") from last_error

    def put_bytes(self, remote_path: str, payload: bytes) -> None:
        last_error = None
        for _ in range(2):
            with self._lock:
                sftp = None
                try:
                    self._connect_locked()
                    assert self._client is not None
                    sftp = self._client.open_sftp()
                    with sftp.file(str(remote_path), "wb") as handle:
                        handle.write(payload)
                    return
                except Exception as exc:
                    last_error = exc
                    self._close_locked()
                finally:
                    if sftp is not None:
                        try:
                            sftp.close()
                        except Exception:
                            pass

        raise RuntimeError(f"SSH upload failed: {last_error}") from last_error

    def put_text(self, remote_path: str, text: str, encoding: str = "utf-8") -> None:
        self.put_bytes(remote_path, str(text).encode(encoding))

    def put_file(self, local_path: str | Path, remote_path: str) -> None:
        source_path = Path(local_path).resolve()
        last_error = None
        for _ in range(2):
            with self._lock:
                sftp = None
                try:
                    self._connect_locked()
                    assert self._client is not None
                    sftp = self._client.open_sftp()
                    sftp.put(str(source_path), str(remote_path))
                    return
                except Exception as exc:
                    last_error = exc
                    self._close_locked()
                finally:
                    if sftp is not None:
                        try:
                            sftp.close()
                        except Exception:
                            pass

        raise RuntimeError(f"SSH upload failed: {last_error}") from last_error
