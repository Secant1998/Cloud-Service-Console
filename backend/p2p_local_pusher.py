from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlparse

from log_store import LogStore
from models import LocalStreamConfig, P2PLocalPusherStatus


DEFAULT_P2P_SIGNAL_BASE_URL = "https://p2p.cityulive.com"
DEFAULT_P2P_ROOM_ID = "robot"
P2P_PROJECT_ENV = "P2P_LOCAL_PUSHER_DIR"
P2P_PROJECT_NAME = "p2p-local-pusher"


class P2PLocalPusherManager:
    def __init__(self, log_store: LogStore) -> None:
        self.log_store = log_store

    def _candidate_roots(self) -> list[Path]:
        candidates: list[Path] = []
        env_root = os.environ.get(P2P_PROJECT_ENV)
        if env_root:
            candidates.append(Path(env_root).expanduser())
        candidates.extend(
            [
                Path(r"E:\Desktop\123") / P2P_PROJECT_NAME,
                Path.home() / "Desktop" / "123" / P2P_PROJECT_NAME,
                Path.cwd().parent / P2P_PROJECT_NAME,
                Path.cwd() / P2P_PROJECT_NAME,
            ]
        )
        result: list[Path] = []
        seen: set[str] = set()
        for candidate in candidates:
            try:
                resolved = candidate.resolve()
            except OSError:
                resolved = candidate
            key = str(resolved).lower()
            if key not in seen:
                seen.add(key)
                result.append(resolved)
        return result

    def project_root(self) -> Path | None:
        for root in self._candidate_roots():
            if (root / "config" / "pusher.config.json").exists() or (root / "setup_local.cmd").exists() or (root / "setup_local.sh").exists():
                return root
        return None

    @staticmethod
    def _creation_flags() -> int:
        if not sys.platform.startswith("win"):
            return 0
        return subprocess.CREATE_NO_WINDOW

    @staticmethod
    def _script(root: Path, name: str) -> Path:
        suffix = ".cmd" if sys.platform.startswith("win") else ".sh"
        return root / f"{name}{suffix}"

    def _run_script(self, root: Path, name: str, timeout: int) -> str:
        script = self._script(root, name)
        if not script.exists():
            raise RuntimeError(f"P2P local pusher script not found: {script}")
        if sys.platform.startswith("win"):
            args = ["cmd", "/c", str(script)]
        else:
            args = ["bash", str(script)]
        completed = subprocess.run(
            args,
            cwd=str(root),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=self._creation_flags(),
        )
        output = "\n".join(part for part in (completed.stdout, completed.stderr) if part).strip()
        if completed.returncode != 0:
            raise RuntimeError(output or f"{name} failed with exit code {completed.returncode}")
        return output

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        try:
            payload = json.loads(path.read_text(encoding="utf-8-sig"))
        except Exception:
            return {}
        return payload if isinstance(payload, dict) else {}

    @staticmethod
    def _write_json(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    @staticmethod
    def _parse_size(value: str, fallback: tuple[int, int] = (1280, 720)) -> tuple[int, int]:
        match = re.search(r"(\d{2,5})x(\d{2,5})", str(value or ""))
        if not match:
            return fallback
        return max(1, int(match.group(1))), max(1, int(match.group(2)))

    @staticmethod
    def _parse_bitrate_kbps(value: str, fallback: int = 2500) -> int:
        text = str(value or "").strip().lower()
        match = re.search(r"(\d+(?:\.\d+)?)", text)
        if not match:
            return fallback
        number = float(match.group(1))
        if text.endswith("m"):
            number *= 1000
        return max(100, min(50000, round(number)))

    @staticmethod
    def _normalize_room(room_id: str) -> str:
        normalized = re.sub(r"[^a-zA-Z0-9_.-]", "-", str(room_id or DEFAULT_P2P_ROOM_ID).strip())[:64]
        return normalized or DEFAULT_P2P_ROOM_ID

    @classmethod
    def _parse_watch_url(cls, value: str = "", fallback_room_id: str = DEFAULT_P2P_ROOM_ID) -> tuple[str, str]:
        text = str(value or "").strip()
        if not text:
            return DEFAULT_P2P_SIGNAL_BASE_URL, cls._normalize_room(fallback_room_id)
        if "://" not in text and "." in text:
            text = f"https://{text}"
        if "://" not in text:
            return DEFAULT_P2P_SIGNAL_BASE_URL, cls._normalize_room(text or fallback_room_id)
        parsed = urlparse(text)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return DEFAULT_P2P_SIGNAL_BASE_URL, cls._normalize_room(fallback_room_id)
        room_values = parse_qs(parsed.query).get("room") or []
        room = room_values[0] if room_values else fallback_room_id
        base = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        return base, cls._normalize_room(room)

    @staticmethod
    def _watch_url(signal_base_url: str, room_id: str) -> str:
        base = (signal_base_url or DEFAULT_P2P_SIGNAL_BASE_URL).rstrip("/")
        return f"{base}/watch.html?room={quote(room_id or DEFAULT_P2P_ROOM_ID)}"

    @staticmethod
    def _user_config(config: dict[str, Any]) -> dict[str, Any]:
        user = config.get("user")
        return user if isinstance(user, dict) else {}

    @classmethod
    def _config_signal_base_url(cls, config: dict[str, Any]) -> str:
        user = cls._user_config(config)
        return str(user.get("signalBaseUrl") or config.get("signalBaseUrl") or DEFAULT_P2P_SIGNAL_BASE_URL).rstrip("/")

    @classmethod
    def _config_room_id(cls, config: dict[str, Any]) -> str:
        user = cls._user_config(config)
        return str(user.get("roomId") or config.get("roomId") or DEFAULT_P2P_ROOM_ID)

    @staticmethod
    def _encoder_id(value: str) -> str:
        normalized = str(value or "").strip()
        if normalized in {"", "auto", "libx264"}:
            return "h264"
        if normalized in {"h264", "h264_nvenc", "h264_amf", "hevc_nvenc", "h264_videotoolbox"}:
            return normalized
        return "h264"

    @staticmethod
    def _fallback_chain(preferred: str) -> list[str]:
        base = ["h264_nvenc", "h264_amf", "h264", "hevc_nvenc"]
        if sys.platform.startswith("linux"):
            base = ["h264_nvenc", "h264", "hevc_nvenc"]
        elif sys.platform == "darwin":
            base = ["h264_videotoolbox", "h264"]
        result: list[str] = []
        if preferred != "auto":
            mapped = P2PLocalPusherManager._encoder_id(preferred)
            result.append(mapped)
        for item in base:
            if item not in result:
                result.append(item)
        return result

    @staticmethod
    def _is_pid_running(pid: int | None) -> bool:
        if not pid:
            return False
        if sys.platform.startswith("win"):
            completed = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            text = f"{completed.stdout}\n{completed.stderr}"
            return completed.returncode == 0 and str(pid) in text and "No tasks" not in text
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False

    @staticmethod
    def _read_pid(path: Path) -> int | None:
        try:
            return int(path.read_text(encoding="utf-8").strip())
        except Exception:
            return None

    @staticmethod
    def _tail(path: Path, lines: int = 80) -> str:
        if not path.exists():
            return ""
        try:
            return "\n".join(path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:])
        except Exception:
            return ""

    def _log_tail(self, root: Path) -> str:
        out_tail = self._tail(root / "logs" / "pusher.out.log", 60)
        err_tail = self._tail(root / "logs" / "pusher.err.log", 40)
        if out_tail and err_tail:
            return f"{out_tail}\n{err_tail}"
        return out_tail or err_tail

    def _sync_config(self, root: Path, local_config: LocalStreamConfig, room_id: str, signal_base_url: str = DEFAULT_P2P_SIGNAL_BASE_URL) -> dict[str, Any]:
        config_path = root / "config" / "pusher.config.json"
        config = self._read_json(config_path)
        if not config:
            config = {
                "user": {},
                "schemaVersion": 1,
                "signalBaseUrl": DEFAULT_P2P_SIGNAL_BASE_URL,
                "roomId": DEFAULT_P2P_ROOM_ID,
                "camera": {},
                "video": {},
                "runtime": {},
            }

        output_width, output_height = self._parse_size(local_config.output_video_size or local_config.video_size)
        capture_width, capture_height = self._parse_size(local_config.video_size, (output_width, output_height))
        width, height = output_width or capture_width, output_height or capture_height
        fps = max(1, min(120, int(local_config.target_framerate or local_config.input_framerate or 30)))
        preferred_encoder = self._encoder_id(local_config.video_encoder)
        camera_name = str(local_config.camera_name or "").strip()
        camera_device = str(local_config.camera_device or "").strip()

        camera = config.get("camera") if isinstance(config.get("camera"), dict) else {}
        if sys.platform.startswith("win"):
            selected_name = camera_name or str(camera.get("selectedName") or "")
            selected_input = f"video={selected_name}" if selected_name else str(camera.get("selectedInput") or "")
            camera_format = "dshow"
        elif sys.platform == "darwin":
            selected_name = camera_name or camera_device or str(camera.get("selectedName") or "default")
            selected_input = camera_device or str(camera.get("selectedInput") or "default:none")
            camera_format = "avfoundation"
        else:
            selected_name = camera_name or camera_device or str(camera.get("selectedName") or "/dev/video0")
            selected_input = camera_device or str(camera.get("selectedInput") or "/dev/video0")
            camera_format = "v4l2"

        user = config.get("user") if isinstance(config.get("user"), dict) else {}
        signal_base_url = str(signal_base_url or user.get("signalBaseUrl") or config.get("signalBaseUrl") or DEFAULT_P2P_SIGNAL_BASE_URL).rstrip("/")
        normalized_room = self._normalize_room(room_id)
        input_format = str(local_config.input_format or user.get("cameraInputFormat") or camera.get("inputFormat") or "").strip()
        fallback_profiles = [
            {"width": width, "height": height, "fps": fps},
            {"width": capture_width, "height": capture_height, "fps": max(1, min(120, int(local_config.input_framerate or fps)))},
            {"width": 1280, "height": 720, "fps": min(30, fps)},
            {"width": 960, "height": 540, "fps": min(30, fps)},
            {"width": 640, "height": 480, "fps": min(30, fps)},
        ]
        config["user"] = {
            **user,
            "signalBaseUrl": signal_base_url,
            "roomId": normalized_room,
            "cameraName": selected_name,
            "cameraInput": selected_input,
            "cameraInputFormat": input_format,
            "width": width,
            "height": height,
            "fps": fps,
            "bitrateKbps": self._parse_bitrate_kbps(local_config.video_bitrate),
            "preferredEncoder": preferred_encoder,
        }
        config["roomId"] = normalized_room
        config["signalBaseUrl"] = signal_base_url
        config["camera"] = {
            **camera,
            "selectedName": selected_name,
            "selectedInput": selected_input,
            "format": camera_format,
            "inputFormat": input_format,
        }
        video = config.get("video") if isinstance(config.get("video"), dict) else {}
        config["video"] = {
            **video,
            "width": width,
            "height": height,
            "fps": fps,
            "bitrateKbps": self._parse_bitrate_kbps(local_config.video_bitrate),
            "preferredEncoder": preferred_encoder,
            "encoderFallbacks": self._fallback_chain(preferred_encoder),
            "fallbackProfiles": fallback_profiles,
            "allowExperimentalHevc": preferred_encoder == "hevc_nvenc",
        }
        runtime = config.get("runtime") if isinstance(config.get("runtime"), dict) else {}
        config["runtime"] = {
            **runtime,
            "peerIdPrefix": str(runtime.get("peerIdPrefix") or "console-local-push"),
        }
        self._write_json(config_path, config)
        return config

    def _ensure_setup(self, root: Path) -> None:
        venv_python = root / "runtime" / ".venv" / ("Scripts/python.exe" if sys.platform.startswith("win") else "bin/python")
        config_path = root / "config" / "pusher.config.json"
        if venv_python.exists() and config_path.exists():
            return
        self.log_store.append("P2P local pusher setup started.")
        output = self._run_script(root, "setup_local", timeout=300)
        self.log_store.append(f"P2P local pusher setup completed. {output[-800:]}")

    def status(self, message: str = "") -> P2PLocalPusherStatus:
        root = self.project_root()
        if root is None:
            searched = ", ".join(str(item) for item in self._candidate_roots())
            return P2PLocalPusherStatus(
                available=False,
                running=False,
                message=f"P2P local pusher project not found. Searched: {searched}",
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            )
        config = self._read_json(root / "config" / "pusher.config.json")
        state = self._read_json(root / "runtime" / "pusher.state.json")
        pid = self._read_pid(root / "runtime" / "pusher.pid")
        running = self._is_pid_running(pid)
        room_id = str(state.get("roomId") or self._config_room_id(config))
        signal_base_url = str(state.get("signalBaseUrl") or self._config_signal_base_url(config))
        active_profile = state.get("profile") if isinstance(state.get("profile"), dict) else {}
        return P2PLocalPusherStatus(
            available=True,
            running=running,
            pid=pid if running else None,
            project_path=str(root),
            config_path=str(root / "config" / "pusher.config.json"),
            room_id=room_id,
            watch_url=self._watch_url(signal_base_url, room_id),
            active_profile=active_profile,
            log_tail=self._log_tail(root),
            message=message or ("P2P local pusher is running." if running else "P2P local pusher is stopped."),
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )

    def start(self, local_config: LocalStreamConfig, room_id: str, watch_url: str = "") -> P2PLocalPusherStatus:
        root = self.project_root()
        if root is None:
            searched = ", ".join(str(item) for item in self._candidate_roots())
            raise RuntimeError(f"P2P local pusher project not found. Searched: {searched}")
        signal_base_url, room = self._parse_watch_url(watch_url, room_id)
        self._ensure_setup(root)
        synced = self._sync_config(root, local_config, room, signal_base_url)
        self.log_store.append(
            "P2P local pusher config synced: "
            f"watch={self._watch_url(signal_base_url, room)}, camera={synced.get('user', {}).get('cameraName')}, "
            f"video={synced.get('user', {}).get('width')}x{synced.get('user', {}).get('height')}@{synced.get('user', {}).get('fps')}, "
            f"encoder={synced.get('user', {}).get('preferredEncoder')}"
        )
        output = self._run_script(root, "start_local", timeout=90)
        self.log_store.append(f"P2P local pusher start completed. {output[-1000:]}")
        status = self.status(message=output.splitlines()[-1] if output else "P2P local pusher started.")
        if not status.running:
            raise RuntimeError(status.log_tail or status.message or "P2P local pusher did not reach running state.")
        return status

    def stop(self, quiet: bool = False) -> P2PLocalPusherStatus:
        root = self.project_root()
        if root is None:
            return self.status(message="P2P local pusher project not found.")
        try:
            output = self._run_script(root, "stop_local", timeout=30)
            if not quiet:
                self.log_store.append(f"P2P local pusher stopped. {output[-800:]}")
            return self.status(message=output or "P2P local pusher stopped.")
        except Exception as exc:
            if not quiet:
                self.log_store.append(f"P2P local pusher stop failed: {exc}", level="warn")
            return self.status(message=f"P2P local pusher stop failed: {exc}")
