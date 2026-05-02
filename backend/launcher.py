from __future__ import annotations

import os
import sys
import threading
from pathlib import Path

import uvicorn

from config import DEFAULT_BACKEND_HOST, DEFAULT_BACKEND_PORT
from main import app

PARENT_PID_ENV = "CLOUD_CONSOLE_PARENT_PID"
PARENT_POLL_INTERVAL_SECONDS = 1.0


def read_parent_pid() -> int:
    raw_value = str(os.environ.get(PARENT_PID_ENV) or "").strip()
    if not raw_value:
        return 0

    try:
        parent_pid = int(raw_value)
    except ValueError:
        return 0

    return parent_pid if parent_pid > 0 else 0


def is_process_alive(pid: int) -> bool:
    if pid <= 0:
        return False

    if sys.platform.startswith("win"):
        import ctypes
        from ctypes import wintypes

        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        SYNCHRONIZE = 0x00100000
        WAIT_TIMEOUT = 0x00000102

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        kernel32.WaitForSingleObject.restype = wintypes.DWORD
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel32.CloseHandle.restype = wintypes.BOOL

        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, False, pid)
        if not handle:
            return False

        try:
            return kernel32.WaitForSingleObject(handle, 0) == WAIT_TIMEOUT
        finally:
            kernel32.CloseHandle(handle)

    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    else:
        return True


def start_parent_watchdog(server: uvicorn.Server) -> tuple[threading.Event, threading.Thread] | None:
    parent_pid = read_parent_pid()
    if parent_pid <= 0:
        return None

    stop_event = threading.Event()

    def watch_parent() -> None:
        while not stop_event.wait(PARENT_POLL_INTERVAL_SECONDS):
            if is_process_alive(parent_pid):
                continue

            server.should_exit = True
            for _ in range(5):
                if stop_event.wait(0.2):
                    return
            os._exit(0)

    thread = threading.Thread(
        target=watch_parent,
        name="cloud-console-parent-watchdog",
        daemon=True,
    )
    thread.start()
    return stop_event, thread


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    os.chdir(base_dir)
    config = uvicorn.Config(
        app,
        host=os.environ.get("CLOUD_CONSOLE_BACKEND_HOST", DEFAULT_BACKEND_HOST),
        port=int(os.environ.get("CLOUD_CONSOLE_BACKEND_PORT", DEFAULT_BACKEND_PORT)),
        reload=False,
    )
    server = uvicorn.Server(config)
    watchdog = start_parent_watchdog(server)
    try:
        server.run()
    finally:
        if watchdog is not None:
            stop_event, _ = watchdog
            stop_event.set()


if __name__ == "__main__":
    main()
