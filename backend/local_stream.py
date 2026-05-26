from __future__ import annotations

import atexit
import json
import os
import posixpath
import re
import shutil
import shlex
import socket
import subprocess
import sys
import threading
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from cloud_client import CloudRemoteClient
from config import CloudRuntimeConfig, get_user_data_dir
from log_store import LogStore
from models import LocalStreamCamera, LocalStreamConfig, LocalStreamStatus


CAMERA_DETECT_TTL_SECONDS = 5.0
CLOUD_PROBE_TTL_SECONDS = 5.0
PULL_PROBE_TTL_SECONDS = 10.0
VIDEO_ENDPOINTS_PROBE_TTL_SECONDS = 5.0
PROBE_TIMEOUT_SECONDS = 2.0
PULL_PROBE_TIMEOUT_SECONDS = 2.5
LOCAL_STREAM_CONFIG_FILENAME = "local-stream-config.json"
LOCAL_STREAM_DRAFT_CONFIG_FILENAME = "local-stream-ui-draft.json"
LOCAL_STREAM_LOG_DIRNAME = "local-stream"
LOCAL_STREAM_TOOLS_DIRNAME = "local-stream-tools"
LOCAL_STREAM_OUT_LOG = "camera-push.out.log"
LOCAL_STREAM_ERR_LOG = "camera-push.err.log"
LOCAL_STREAM_PID_FILE = "camera-push.pid"
LOCAL_STREAM_COMMAND_FILE = "camera-push-command.json"
LOCAL_STREAM_HEARTBEAT_INTERVAL_SECONDS = 5
LOCAL_STREAM_HEARTBEAT_UPLOAD_TIMEOUT_SECONDS = 20
DEFAULT_CLOUD_REMOTE_BASE = "/opt/go2rtc-cloud"
FFMPEG_RELEASE_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"


class LocalStreamManager:
    def __init__(self, log_store: LogStore) -> None:
        self.log_store = log_store
        self.config_path = get_user_data_dir() / LOCAL_STREAM_CONFIG_FILENAME
        self.draft_config_path = get_user_data_dir() / LOCAL_STREAM_DRAFT_CONFIG_FILENAME
        self.log_dir = get_user_data_dir() / LOCAL_STREAM_LOG_DIRNAME
        self.tools_dir = get_user_data_dir() / LOCAL_STREAM_TOOLS_DIRNAME
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.out_log_path = self.log_dir / LOCAL_STREAM_OUT_LOG
        self.err_log_path = self.log_dir / LOCAL_STREAM_ERR_LOG
        self.pid_path = self.log_dir / LOCAL_STREAM_PID_FILE
        self.command_path = self.log_dir / LOCAL_STREAM_COMMAND_FILE
        self._process: subprocess.Popen | None = None
        self._heartbeat_thread: threading.Thread | None = None
        self._heartbeat_stop_event = threading.Event()
        self._heartbeat_lock = threading.Lock()
        self._camera_cache: tuple[float, list[LocalStreamCamera], bool] | None = None
        self._cloud_probe_cache: tuple[float, str, dict[str, Any]] | None = None
        self._pull_probe_cache: tuple[float, str, dict[str, Any]] | None = None
        self._video_endpoints_cache: tuple[float, str, dict[str, Any]] | None = None
        atexit.register(self._cleanup_process_handle)

    def _cleanup_process_handle(self) -> None:
        if self._process is None:
            return
        if self._process.poll() is None:
            return
        self._process = None

    def _default_config(self, runtime_config: CloudRuntimeConfig) -> LocalStreamConfig:
        return LocalStreamConfig(
            cloud_public_scheme=runtime_config.public_scheme,
            cloud_public_host=runtime_config.public_host,
            cloud_api_port=runtime_config.api_port,
            ingest_mode="srt",
        )

    def _load_config_file(
        self,
        path: Path,
        base_config: LocalStreamConfig,
        runtime_config: CloudRuntimeConfig,
        label: str,
    ) -> LocalStreamConfig:
        config = base_config
        if path.exists():
            try:
                payload = json.loads(path.read_text(encoding="utf-8-sig"))
                if isinstance(payload, dict):
                    config = LocalStreamConfig.model_validate({**config.model_dump(), **payload})
            except Exception as exc:
                self.log_store.append(f"Local stream {label} config load failed: {exc}", level="warn")
        return self._resolve_current_server_config(config, runtime_config)

    def load_config(self, runtime_config: CloudRuntimeConfig, *, prefer_draft: bool = True) -> LocalStreamConfig:
        config = self._default_config(runtime_config)
        config = self._load_config_file(self.config_path, config, runtime_config, "default")
        if prefer_draft:
            config = self._load_config_file(self.draft_config_path, config, runtime_config, "draft")
        return self._apply_current_server_video_defaults(self._resolve_current_server_config(config, runtime_config))

    def save_config(self, payload: LocalStreamConfig, runtime_config: CloudRuntimeConfig) -> LocalStreamConfig:
        config = self._apply_current_server_video_defaults(self._resolve_current_server_config(payload, runtime_config))
        self.draft_config_path.parent.mkdir(parents=True, exist_ok=True)
        self.draft_config_path.write_text(
            json.dumps(config.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self.log_store.append("Local stream UI draft config saved.")
        return config

    def save_default_config(self, payload: LocalStreamConfig, runtime_config: CloudRuntimeConfig) -> LocalStreamConfig:
        config = self._apply_current_server_video_defaults(self._resolve_current_server_config(payload, runtime_config))
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        serialized = json.dumps(config.model_dump(), ensure_ascii=False, indent=2)
        self.config_path.write_text(serialized, encoding="utf-8")
        self.draft_config_path.write_text(serialized, encoding="utf-8")
        self.log_store.append("Local stream default config committed.")
        return config

    def ensure_local_tools(self, runtime_config: CloudRuntimeConfig) -> LocalStreamStatus:
        config = self.load_config(runtime_config)
        ffmpeg_path = self._find_existing_ffmpeg(config.ffmpeg_path)
        changed = False

        if not ffmpeg_path:
            ffmpeg_path = self._install_ffmpeg_to_user_tools()
            changed = True

        updated_config = config.model_copy(update={"ffmpeg_path": ffmpeg_path})
        if updated_config.ffmpeg_path != config.ffmpeg_path:
            self.save_config(updated_config, runtime_config)
            changed = True

        self._camera_cache = None
        message = "本地配置已就绪" if not changed else "本地配置已完成，FFmpeg 已可用"
        return self.status(runtime_config, message=message)

    @staticmethod
    def _resolve_current_server_config(config: LocalStreamConfig, runtime_config: CloudRuntimeConfig) -> LocalStreamConfig:
        update = {}
        if config.use_current_server:
            update = {
                "cloud_public_scheme": runtime_config.public_scheme,
                "cloud_public_host": runtime_config.public_host,
                "cloud_api_port": runtime_config.api_port,
            }
        normalized_input_format = str(config.input_format or "").strip().lower()
        if normalized_input_format not in {"", "mjpeg"}:
            normalized_input_format = ""
        update["input_format"] = normalized_input_format
        return config.model_copy(update=update)

    def _read_video_endpoints(self, config: LocalStreamConfig) -> dict[str, Any]:
        public_base_url = self._public_base_url(config)
        now = time.monotonic()
        if self._video_endpoints_cache is not None:
            cached_at, cached_key, cached_payload = self._video_endpoints_cache
            if cached_key == public_base_url and now - cached_at <= VIDEO_ENDPOINTS_PROBE_TTL_SECONDS:
                return dict(cached_payload)

        payload: dict[str, Any] = {}
        try:
            raw_payload = self._read_probe_url(
                f"{public_base_url}/video-endpoints.json",
                timeout=PROBE_TIMEOUT_SECONDS,
                max_bytes=262144,
            )
            parsed = json.loads(raw_payload.decode("utf-8", errors="ignore") or "{}")
            if isinstance(parsed, dict):
                payload = parsed
        except Exception:
            payload = {}

        self._video_endpoints_cache = now, public_base_url, dict(payload)
        return payload

    @staticmethod
    def _detect_ingest_mode_from_video_endpoints(payload: dict[str, Any]) -> str:
        explicit_mode = str(payload.get("ingestMode") or "").strip().lower()
        if explicit_mode in {"http", "srt"}:
            return explicit_mode

        upload_protocol = str(payload.get("uploadProtocol") or "").strip().lower()
        if upload_protocol.startswith("http"):
            return "http"
        if upload_protocol.startswith("srt"):
            return "srt"

        ingest_url = str(payload.get("ingestUrl") or "").strip().lower()
        if ingest_url.startswith("http://") or ingest_url.startswith("https://"):
            return "http"
        if ingest_url.startswith("srt://"):
            return "srt"
        return ""

    @staticmethod
    def _optional_int_from_payload(payload: dict[str, Any], key: str) -> int | None:
        value = payload.get(key)
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if 0 < parsed <= 65535 else None

    def _apply_current_server_video_defaults(self, config: LocalStreamConfig) -> LocalStreamConfig:
        if not config.use_current_server:
            return config

        payload = self._read_video_endpoints(config)
        if not payload:
            return config

        update: dict[str, Any] = {}
        ingest_mode = self._detect_ingest_mode_from_video_endpoints(payload)
        if ingest_mode:
            update["ingest_mode"] = ingest_mode

        stream_name = str(payload.get("streamName") or "").strip()
        if stream_name:
            update["stream_name"] = stream_name

        for payload_key, config_key in [
            ("apiPort", "cloud_api_port"),
            ("ingestPort", "cloud_ingest_port"),
            ("srtIngestPort", "cloud_srt_ingest_port"),
            ("webrtcPort", "cloud_webrtc_port"),
        ]:
            port_value = self._optional_int_from_payload(payload, payload_key)
            if port_value is not None:
                update[config_key] = port_value

        return config.model_copy(update=update) if update else config

    @staticmethod
    def _resolve_ffmpeg_path(ffmpeg_path: str) -> str:
        raw_path = str(ffmpeg_path or "").strip() or "ffmpeg"
        candidate = Path(raw_path)
        if candidate.is_file():
            return str(candidate.resolve())
        resolved = shutil.which(raw_path)
        return resolved or ""

    def _standard_ffmpeg_candidates(self) -> list[Path]:
        candidates: list[Path] = [
            self.tools_dir / "ffmpeg" / "bin" / "ffmpeg.exe",
            Path.home() / "bin" / "ffmpeg.exe",
            Path("C:/ffmpeg/bin/ffmpeg.exe"),
        ]
        for env_name, relative_path in [
            ("LOCALAPPDATA", ("Microsoft", "WinGet", "Links", "ffmpeg.exe")),
            ("ProgramFiles", ("ffmpeg", "bin", "ffmpeg.exe")),
            ("ProgramFiles(x86)", ("ffmpeg", "bin", "ffmpeg.exe")),
        ]:
            env_value = os.environ.get(env_name)
            if env_value:
                candidates.append(Path(env_value).joinpath(*relative_path))
        return [candidate for candidate in candidates if str(candidate) and candidate.is_file()]

    def _find_existing_ffmpeg(self, preferred_path: str = "") -> str:
        resolved = self._resolve_ffmpeg_path(preferred_path)
        if resolved:
            return resolved
        resolved = self._resolve_ffmpeg_path("ffmpeg")
        if resolved:
            return resolved
        for candidate in self._standard_ffmpeg_candidates():
            return str(candidate.resolve())
        return ""

    def _safe_child_path(self, path: Path) -> Path:
        root = self.tools_dir.resolve()
        resolved = path.resolve()
        if resolved != root and root not in resolved.parents:
            raise RuntimeError(f"Refusing to modify path outside local stream tools: {resolved}")
        return resolved

    def _install_ffmpeg_to_user_tools(self) -> str:
        if not sys.platform.startswith("win"):
            raise RuntimeError("自动本地配置当前只支持 Windows。请先安装 ffmpeg 并确保命令可用。")

        self.tools_dir.mkdir(parents=True, exist_ok=True)
        archive_path = self.tools_dir / "ffmpeg-release-essentials.zip"
        staging_dir = self.tools_dir / "ffmpeg-staging"
        install_dir = self.tools_dir / "ffmpeg"

        self.log_store.append("Local stream setup downloading ffmpeg runtime.")
        with urlopen(FFMPEG_RELEASE_URL, timeout=90) as response:
            with archive_path.open("wb") as handle:
                shutil.copyfileobj(response, handle)

        staging_resolved = self._safe_child_path(staging_dir)
        install_resolved = self._safe_child_path(install_dir)
        if staging_resolved.exists():
            shutil.rmtree(staging_resolved)
        staging_resolved.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(archive_path) as archive:
            for member in archive.infolist():
                self._safe_child_path(staging_resolved / member.filename)
                archive.extract(member, staging_resolved)

        ffmpeg_candidates = list(staging_resolved.rglob("ffmpeg.exe"))
        if not ffmpeg_candidates:
            raise RuntimeError("下载的 ffmpeg 压缩包里没有找到 ffmpeg.exe。")

        source_root = ffmpeg_candidates[0].parent.parent
        if install_resolved.exists():
            shutil.rmtree(install_resolved)
        shutil.move(str(source_root), str(install_resolved))

        ffmpeg_path = install_resolved / "bin" / "ffmpeg.exe"
        if not ffmpeg_path.is_file():
            raise RuntimeError("ffmpeg 安装完成但可执行文件不可用。")

        shutil.rmtree(staging_resolved, ignore_errors=True)
        self.log_store.append(f"Local stream setup installed ffmpeg: {ffmpeg_path}")
        return str(ffmpeg_path.resolve())

    @staticmethod
    def _creation_flags() -> int:
        if not sys.platform.startswith("win"):
            return 0
        return subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW

    def _detect_cameras_with_ffmpeg(self, ffmpeg_path: str) -> tuple[list[LocalStreamCamera], bool]:
        resolved_ffmpeg = self._find_existing_ffmpeg(ffmpeg_path)
        if not resolved_ffmpeg:
            return [], False

        try:
            completed = subprocess.run(
                [resolved_ffmpeg, "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=8,
                creationflags=self._creation_flags(),
            )
        except Exception:
            return [], True

        text = "\n".join(part for part in [completed.stdout, completed.stderr] if part)
        cameras: list[LocalStreamCamera] = []
        seen: set[str] = set()
        for match in re.finditer(r'^\[dshow @ .*?\] "(.+?)" \(video\)\s*$', text, flags=re.MULTILINE):
            name = match.group(1).strip()
            if name and name not in seen:
                seen.add(name)
                cameras.append(LocalStreamCamera(id=name, name=name, source="ffmpeg", status="available"))
        return cameras, True

    def _detect_cameras_with_pnp(self) -> list[LocalStreamCamera]:
        if not sys.platform.startswith("win"):
            return []

        command = (
            "$items = Get-CimInstance Win32_PnPEntity | "
            "Where-Object { $_.PNPClass -in @('Camera','Image') -or $_.Name -match '(?i)camera|webcam|video' } | "
            "Select-Object Name,PNPClass,Status,DeviceID; "
            "$items | ConvertTo-Json -Compress"
        )
        try:
            completed = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=8,
                creationflags=self._creation_flags(),
            )
        except Exception:
            return []

        raw = completed.stdout.strip()
        if not raw:
            return []
        try:
            payload: Any = json.loads(raw)
        except json.JSONDecodeError:
            return []
        rows = payload if isinstance(payload, list) else [payload]
        cameras: list[LocalStreamCamera] = []
        seen: set[str] = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            name = str(row.get("Name") or "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            cameras.append(
                LocalStreamCamera(
                    id=str(row.get("DeviceID") or name),
                    name=name,
                    source="windows-pnp",
                    status=str(row.get("Status") or "unknown"),
                )
            )
        return cameras

    def detect_cameras(self, config: LocalStreamConfig, *, force: bool = False) -> tuple[list[LocalStreamCamera], bool]:
        now = time.monotonic()
        if not force and self._camera_cache is not None:
            cached_at, cameras, ffmpeg_available = self._camera_cache
            if now - cached_at <= CAMERA_DETECT_TTL_SECONDS:
                return cameras, ffmpeg_available

        cameras, ffmpeg_available = self._detect_cameras_with_ffmpeg(config.ffmpeg_path)
        if not cameras:
            cameras = self._detect_cameras_with_pnp()

        self._camera_cache = now, cameras, ffmpeg_available
        return cameras, ffmpeg_available

    @staticmethod
    def _parse_video_size(value: str, fallback: tuple[int, int] = (1920, 1080)) -> tuple[int, int]:
        match = re.search(r"(\d{2,5})x(\d{2,5})", str(value or ""))
        if not match:
            return fallback
        return max(1, int(match.group(1))), max(1, int(match.group(2)))

    def _list_camera_options(self, ffmpeg_path: str, camera_name: str) -> list[dict[str, Any]]:
        try:
            completed = subprocess.run(
                [ffmpeg_path, "-hide_banner", "-list_options", "true", "-f", "dshow", "-i", f"video={camera_name}"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=8,
                creationflags=self._creation_flags(),
            )
        except Exception as exc:
            self.log_store.append(f"Local stream camera option probe failed: {exc}", level="warn")
            return []

        text = "\n".join(part for part in [completed.stdout, completed.stderr] if part)
        options: list[dict[str, Any]] = []
        seen: set[tuple[str, str, int, int, int]] = set()
        pattern = re.compile(
            r"(?P<kind>vcodec|pixel_format)=(?P<format>\S+)\s+"
            r"min s=(?P<width>\d+)x(?P<height>\d+)\s+fps=(?P<min_fps>[\d.]+)\s+"
            r"max s=(?P<max_width>\d+)x(?P<max_height>\d+)\s+fps=(?P<max_fps>[\d.]+)"
        )
        for match in pattern.finditer(text):
            width = int(match.group("width"))
            height = int(match.group("height"))
            max_width = int(match.group("max_width"))
            max_height = int(match.group("max_height"))
            if width != max_width or height != max_height:
                continue
            min_fps = float(match.group("min_fps"))
            max_fps = float(match.group("max_fps"))
            rounded_max_fps = max(1, int(round(max_fps)))
            key = (match.group("kind"), match.group("format"), width, height, rounded_max_fps)
            if key in seen:
                continue
            seen.add(key)
            options.append(
                {
                    "kind": match.group("kind"),
                    "format": match.group("format").lower(),
                    "width": width,
                    "height": height,
                    "min_fps": min_fps,
                    "max_fps": max_fps,
                }
            )
        return options

    def _choose_supported_capture_config(
        self,
        config: LocalStreamConfig,
        options: list[dict[str, Any]],
    ) -> LocalStreamConfig | None:
        if not options:
            return None

        requested_width, requested_height = self._parse_video_size(config.video_size)
        requested_fps = max(1, int(config.input_framerate or 30))
        requested_pixels = max(1, requested_width * requested_height)
        requested_aspect = requested_width / max(1, requested_height)

        best: tuple[float, LocalStreamConfig, str] | None = None
        for option in options:
            width = int(option["width"])
            height = int(option["height"])
            min_fps = float(option["min_fps"])
            max_fps = float(option["max_fps"])
            if requested_fps < min_fps:
                chosen_fps = max(1, int(round(min_fps)))
            elif requested_fps > max_fps:
                chosen_fps = max(1, int(max_fps))
            else:
                chosen_fps = requested_fps

            exact_size_penalty = 0 if width == requested_width and height == requested_height else 1
            pixel_penalty = abs((width * height) - requested_pixels) / requested_pixels
            aspect_penalty = abs((width / max(1, height)) - requested_aspect)
            fps_penalty = abs(requested_fps - chosen_fps) / max(1, requested_fps)
            format_penalty = 0.0
            if option["kind"] == "vcodec" and option["format"] == "mjpeg":
                format_penalty = 0.0 if config.input_format in {"", "mjpeg"} else 0.2
            elif config.input_format:
                format_penalty = 0.5
            else:
                format_penalty = 0.1

            score = exact_size_penalty * 100.0 + pixel_penalty * 8.0 + aspect_penalty * 6.0 + fps_penalty + format_penalty
            input_format = "mjpeg" if option["kind"] == "vcodec" and option["format"] == "mjpeg" else ""
            selected_size = f"{width}x{height}"
            selected_config = config.model_copy(
                update={
                    "input_format": input_format,
                    "video_size": selected_size,
                    "output_video_size": selected_size,
                    "input_framerate": chosen_fps,
                    "target_framerate": chosen_fps,
                }
            )
            label = f"{selected_size}@{chosen_fps}fps"
            if best is None or score < best[0]:
                best = score, selected_config, label

        if best is None:
            return None
        self.log_store.append(f"Local stream selected supported camera mode: {best[2]}")
        return best[1]

    def _ranked_capture_configs(
        self,
        config: LocalStreamConfig,
        options: list[dict[str, Any]],
    ) -> list[tuple[str, LocalStreamConfig]]:
        if not options:
            return []

        requested_width, requested_height = self._parse_video_size(config.video_size)
        requested_fps = max(1, int(config.input_framerate or 30))
        requested_pixels = max(1, requested_width * requested_height)
        requested_aspect = requested_width / max(1, requested_height)
        candidates: list[tuple[float, str, LocalStreamConfig]] = []
        seen: set[tuple[str, str, int, int, int, int, str]] = set()

        for option in options:
            width = int(option["width"])
            height = int(option["height"])
            min_fps = float(option["min_fps"])
            max_fps = float(option["max_fps"])
            max_int_fps = max(1, int(max_fps))
            fps_values = [requested_fps, min(30, max_int_fps), min(24, max_int_fps), min(15, max_int_fps), max_int_fps]

            for fps_value in fps_values:
                if fps_value < min_fps:
                    chosen_fps = max(1, int(round(min_fps)))
                elif fps_value > max_fps:
                    chosen_fps = max_int_fps
                else:
                    chosen_fps = max(1, int(round(fps_value)))

                input_format = "mjpeg" if option["kind"] == "vcodec" and option["format"] == "mjpeg" else ""
                selected_size = f"{width}x{height}"
                selected_config = config.model_copy(
                    update={
                        "input_format": input_format,
                        "video_size": selected_size,
                        "output_video_size": selected_size,
                        "input_framerate": chosen_fps,
                        "target_framerate": min(max(1, int(config.target_framerate or chosen_fps)), chosen_fps),
                    }
                )
                key = (
                    input_format,
                    selected_size,
                    selected_config.output_video_size,
                    selected_config.input_framerate,
                    selected_config.target_framerate,
                    int(option["width"]) * int(option["height"]),
                    str(selected_config.video_encoder or ""),
                )
                if key in seen:
                    continue
                seen.add(key)

                exact_size_penalty = 0 if width == requested_width and height == requested_height else 1
                pixel_penalty = abs((width * height) - requested_pixels) / requested_pixels
                aspect_penalty = abs((width / max(1, height)) - requested_aspect)
                fps_penalty = abs(requested_fps - chosen_fps) / max(1, requested_fps)
                over_requested_penalty = 0 if width * height <= requested_pixels else 4.0
                format_penalty = 0.0 if not input_format else 0.25
                if config.input_format == "mjpeg" and input_format == "mjpeg":
                    format_penalty = 0.0
                elif config.input_format == "" and input_format == "":
                    format_penalty = 0.0

                score = (
                    exact_size_penalty * 100.0
                    + pixel_penalty * 8.0
                    + aspect_penalty * 6.0
                    + fps_penalty * 2.0
                    + over_requested_penalty
                    + format_penalty
                )
                label = f"{selected_size}@{chosen_fps}fps"
                if input_format:
                    label = f"{input_format} {label}"
                else:
                    label = f"default {label}"
                candidates.append((score, label, selected_config))

        candidates.sort(key=lambda item: item[0])
        ranked: list[tuple[str, LocalStreamConfig]] = []
        for _, label, candidate in candidates:
            if len(ranked) >= 8:
                break
            ranked.append((label, candidate))
        return ranked

    @staticmethod
    def _fallback_capture_configs(config: LocalStreamConfig) -> list[tuple[str, LocalStreamConfig]]:
        fallback_specs = [
            ("default 1280x720@30fps", "", "1280x720", 30),
            ("default 1280x720@24fps", "", "1280x720", 24),
            ("default 960x540@30fps", "", "960x540", 30),
            ("default 960x540@24fps", "", "960x540", 24),
            ("default 640x480@30fps", "", "640x480", 30),
            ("default 640x480@15fps", "", "640x480", 15),
            ("MJPEG 1280x720@30fps", "mjpeg", "1280x720", 30),
            ("MJPEG 640x480@30fps", "mjpeg", "640x480", 30),
        ]
        fallbacks: list[tuple[str, LocalStreamConfig]] = []
        seen: set[tuple[str, str, int]] = set()
        for label, input_format, size, fps in fallback_specs:
            key = (input_format, size, fps)
            if key in seen:
                continue
            seen.add(key)
            fallbacks.append(
                (
                    label,
                    config.model_copy(
                        update={
                            "input_format": input_format,
                            "video_size": size,
                            "output_video_size": size,
                            "input_framerate": fps,
                            "target_framerate": min(max(1, int(config.target_framerate or fps)), fps),
                        }
                    ),
                )
            )
        return fallbacks

    def _read_pid(self) -> int | None:
        if self._process is not None and self._process.poll() is None:
            return int(self._process.pid)
        if not self.pid_path.exists():
            return None
        try:
            pid = int(self.pid_path.read_text(encoding="ascii").strip())
        except Exception:
            return None
        return pid if pid > 0 else None

    @staticmethod
    def _is_pid_running(pid: int | None) -> bool:
        if not pid:
            return False
        if sys.platform.startswith("win"):
            completed = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            return str(pid) in completed.stdout
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False

    def _stop_matching_ffmpeg_processes(self, config: LocalStreamConfig) -> list[int]:
        if not sys.platform.startswith("win"):
            return []

        host = str(config.cloud_public_host or "").strip()
        stream_name = str(config.stream_name or "main-camera").strip() or "main-camera"
        srt_port = str(config.cloud_srt_ingest_port)
        http_port = str(config.cloud_ingest_port)
        command = r"""
$hostValue = $env:LOCAL_STREAM_HOST
$streamName = $env:LOCAL_STREAM_NAME
$srtNeedle = ('srt://{0}:{1}' -f $hostValue, $env:LOCAL_STREAM_SRT_PORT)
$httpNeedle = ('api/stream.ts?dst={0}' -f $streamName)
$httpPortNeedle = (':{0}/api/stream.ts' -f $env:LOCAL_STREAM_HTTP_PORT)
$stopped = @()
Get-CimInstance Win32_Process -Filter "Name = 'ffmpeg.exe'" |
  Where-Object {
    $cmd = [string]$_.CommandLine
    ($cmd -like "*$srtNeedle*") -or
    (($cmd -like "*$httpNeedle*") -and ($cmd -like "*$hostValue*") -and ($cmd -like "*$httpPortNeedle*"))
  } |
  ForEach-Object {
    $stopped += [int]$_.ProcessId
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
$stopped -join ','
"""
        env = os.environ.copy()
        env.update(
            {
                "LOCAL_STREAM_HOST": host,
                "LOCAL_STREAM_NAME": stream_name,
                "LOCAL_STREAM_SRT_PORT": srt_port,
                "LOCAL_STREAM_HTTP_PORT": http_port,
            }
        )
        try:
            completed = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=5,
                env=env,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except Exception:
            return []
        stopped: list[int] = []
        for part in (completed.stdout or "").strip().split(","):
            try:
                pid = int(part.strip())
            except ValueError:
                continue
            if pid > 0:
                stopped.append(pid)
        return stopped

    def _tail_logs(self, max_lines: int = 80) -> str:
        lines: list[str] = []
        for path in [self.err_log_path, self.out_log_path]:
            if not path.exists():
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            selected = text.splitlines()[-max_lines:]
            if selected:
                lines.append(f"--- {path.name} ---")
                lines.extend(selected)
        return "\n".join(lines[-max_lines:])

    def _capture_log_positions(self) -> dict[Path, int]:
        positions: dict[Path, int] = {}
        for path in [self.err_log_path, self.out_log_path]:
            try:
                positions[path] = path.stat().st_size if path.exists() else 0
            except Exception:
                positions[path] = 0
        return positions

    @staticmethod
    def _read_log_since(path: Path, offset: int) -> str:
        if not path.exists():
            return ""
        try:
            with path.open("rb") as handle:
                handle.seek(max(0, offset))
                return handle.read().decode("utf-8", errors="ignore")
        except Exception:
            return ""

    def _read_logs_since(self, positions: dict[Path, int]) -> str:
        parts: list[str] = []
        for path in [self.err_log_path, self.out_log_path]:
            text = self._read_log_since(path, positions.get(path, 0))
            if text:
                parts.append(text)
        return "\n".join(parts)

    @staticmethod
    def _ffmpeg_log_indicates_capture_failure(log_text: str) -> bool:
        lowered = log_text.lower()
        capture_failure_markers = [
            "no jpeg data found in image",
            "error submitting packet to decoder",
            "invalid data found when processing input",
            "error while decoding stream",
            "could not find codec parameters",
            "video device did not accept",
            "could not open video device",
            "can't open video device",
            "i/o error",
        ]
        return any(marker in lowered for marker in capture_failure_markers)

    @staticmethod
    def _ffmpeg_log_has_frame_progress(log_text: str) -> bool:
        return re.search(r"\bframe=\s*[1-9]\d*", log_text) is not None

    def clear_logs(self) -> None:
        self.log_dir.mkdir(parents=True, exist_ok=True)
        for path in [self.out_log_path, self.err_log_path]:
            try:
                path.write_text("", encoding="utf-8")
            except Exception:
                continue

    @staticmethod
    def _summarize_ffmpeg_startup_failure(log_text: str) -> str:
        fallback = "FFmpeg exited during startup. See the local stream log for details."
        if not log_text:
            return fallback

        error_lines = []
        for raw_line in log_text.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("--- "):
                continue
            lowered = line.lower()
            if "error" in lowered or "invalid" in lowered or "unable" in lowered or "failed" in lowered:
                error_lines.append(line)

        message = error_lines[-1] if error_lines else log_text.splitlines()[-1].strip()
        if "error opening output file" in message.lower():
            message = "FFmpeg could not open the cloud ingest output. See the local stream log for details."
        elif "error setting option" in message.lower() or "error applying encoder options" in message.lower():
            message = "FFmpeg rejected the selected encoder options. Try another encoder or check the local stream log."
        elif "unable to parse" in message.lower():
            message = "FFmpeg could not parse one of the selected stream options. See the local stream log for details."

        if len(message) > 180:
            message = f"{message[:177]}..."
        return message or fallback

    @staticmethod
    def _public_base_url(config: LocalStreamConfig) -> str:
        default_port = 443 if config.cloud_public_scheme == "https" else 80
        authority = config.cloud_public_host
        if config.cloud_api_port != default_port:
            authority = f"{authority}:{config.cloud_api_port}"
        return f"{config.cloud_public_scheme}://{authority}"

    def _target_url(self, config: LocalStreamConfig) -> str:
        host = str(config.cloud_public_host or "").strip()
        if config.ingest_mode == "http":
            return f"{config.cloud_public_scheme}://{host}:{config.cloud_ingest_port}/api/stream.ts?dst={config.stream_name}"
        return (
            f"srt://{host}:{config.cloud_srt_ingest_port}"
            f"?mode=caller&transtype=live&latency={config.srt_latency_ms}"
            f"&peerlatency={config.srt_latency_ms}&rcvlatency={config.srt_latency_ms}"
            f"&tlpktdrop={1 if config.drop_late_packets else 0}"
            f"&pkt_size={config.srt_packet_size}&connect_timeout={config.connect_timeout_ms}"
        )

    @staticmethod
    def _runtime_status_file_name(config: LocalStreamConfig) -> str:
        stream_name = str(config.stream_name or "main-camera").strip() or "main-camera"
        return f"{quote(stream_name, safe='')}-runtime.json"

    def _runtime_status_url(self, config: LocalStreamConfig) -> str:
        endpoints_payload = self._read_video_endpoints(config)
        runtime_status_url = str(endpoints_payload.get("runtimeStatusUrl") or "").strip()
        if runtime_status_url:
            return runtime_status_url
        return f"{self._public_base_url(config)}/{self._runtime_status_file_name(config)}"

    @staticmethod
    def _runtime_status_remote_path(config: LocalStreamConfig) -> str:
        return posixpath.join(DEFAULT_CLOUD_REMOTE_BASE, "www", LocalStreamManager._runtime_status_file_name(config))

    @staticmethod
    def _utc_now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _encoder_mode(encoder_name: str) -> str:
        normalized = str(encoder_name or "").strip().lower()
        if normalized in {"h264_nvenc", "h264_qsv", "h264_amf"}:
            return "hardware"
        if normalized:
            return "software"
        return "unknown"

    def _build_runtime_status_payload(
        self,
        config: LocalStreamConfig,
        *,
        state: str,
        process_id: int | None,
        status_reason: str,
    ) -> dict[str, Any]:
        generated_at = self._utc_now_iso()
        encoder_name = str(config.video_encoder or "").strip() or None
        encoder_mode = self._encoder_mode(encoder_name or "")
        if encoder_mode == "hardware":
            encoder_display = f"Hardware ({encoder_name})" if encoder_name else "Hardware"
        elif encoder_mode == "software":
            encoder_display = f"Software ({encoder_name})" if encoder_name else "Software"
        else:
            encoder_display = encoder_name or "Unknown"
        upload_protocol = "srt" if config.ingest_mode == "srt" else "http-mpegts"

        return {
            "generatedAt": generated_at,
            "videoMode": "legacy",
            "streamName": str(config.stream_name or "main-camera").strip() or "main-camera",
            "state": state,
            "lastHeartbeatAt": generated_at,
            "heartbeatIntervalSec": LOCAL_STREAM_HEARTBEAT_INTERVAL_SECONDS if state == "active" else None,
            "statusReason": status_reason,
            "encoderName": encoder_name,
            "encoderMode": encoder_mode,
            "encoderDisplay": encoder_display,
            "isHardwareEncoder": encoder_mode == "hardware",
            "processId": process_id if process_id and process_id > 0 else None,
            "ingestMode": str(config.ingest_mode or ""),
            "uploadProtocol": upload_protocol,
            "webrtcPublishMode": "",
            "delayMeasurementMode": "end-to-end" if config.hidden_delay_marker_enabled else "receiver-only",
            "hiddenDelayMarkerEnabled": bool(config.hidden_delay_marker_enabled),
            "sourcePlatform": sys.platform,
            "sourceHost": socket.gethostname(),
            "runtimeStatusUrl": self._runtime_status_url(config),
        }

    def _publish_runtime_status(
        self,
        runtime_config: CloudRuntimeConfig,
        config: LocalStreamConfig,
        payload: dict[str, Any],
    ) -> None:
        remote_path = self._runtime_status_remote_path(config)
        remote_dir = posixpath.dirname(remote_path)
        remote_temp = f"{remote_path}.tmp.{os.getpid()}.{int(time.time())}"
        content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        client = CloudRemoteClient(runtime_config)
        try:
            client.run(f"mkdir -p {shlex.quote(remote_dir)}", timeout=LOCAL_STREAM_HEARTBEAT_UPLOAD_TIMEOUT_SECONDS)
            client.put_text(remote_temp, content, encoding="utf-8")
            install_command = (
                f"install -m 0644 {shlex.quote(remote_temp)} {shlex.quote(remote_path)} && "
                f"rm -f {shlex.quote(remote_temp)}"
            )
            client.run(install_command, timeout=LOCAL_STREAM_HEARTBEAT_UPLOAD_TIMEOUT_SECONDS)
        finally:
            client.close()

    def _publish_runtime_status_safely(
        self,
        runtime_config: CloudRuntimeConfig,
        config: LocalStreamConfig,
        *,
        state: str,
        process_id: int | None,
        status_reason: str,
        log_failure: bool,
    ) -> None:
        try:
            self._publish_runtime_status(
                runtime_config,
                config,
                self._build_runtime_status_payload(
                    config,
                    state=state,
                    process_id=process_id,
                    status_reason=status_reason,
                ),
            )
        except Exception as exc:
            if log_failure:
                self.log_store.append(f"Local stream legacy heartbeat publish failed: {exc}", level="warn")

    def _stop_runtime_heartbeat_thread(self) -> None:
        with self._heartbeat_lock:
            thread = self._heartbeat_thread
            self._heartbeat_stop_event.set()
        if thread is not None and thread.is_alive():
            thread.join(timeout=2.0)
        with self._heartbeat_lock:
            if self._heartbeat_thread is thread:
                self._heartbeat_thread = None
            self._heartbeat_stop_event.clear()

    def _start_runtime_heartbeat_thread(
        self,
        runtime_config: CloudRuntimeConfig,
        config: LocalStreamConfig,
        process_id: int,
    ) -> None:
        self._stop_runtime_heartbeat_thread()
        stop_event = threading.Event()

        def run() -> None:
            failures = 0
            while not stop_event.is_set():
                process_alive = self._is_pid_running(process_id)
                state = "active" if process_alive else "stale"
                reason = "heartbeat" if process_alive else "sender_process_exited"
                self._publish_runtime_status_safely(
                    runtime_config,
                    config,
                    state=state,
                    process_id=process_id,
                    status_reason=reason,
                    log_failure=failures == 0 or failures % 12 == 0,
                )
                if not process_alive:
                    return
                failures += 1
                stop_event.wait(LOCAL_STREAM_HEARTBEAT_INTERVAL_SECONDS)

        with self._heartbeat_lock:
            self._heartbeat_stop_event = stop_event
            self._heartbeat_thread = threading.Thread(
                target=run,
                name="LocalStreamLegacyHeartbeat",
                daemon=True,
            )
            self._heartbeat_thread.start()

    def _check_cloud_reachable(self, config: LocalStreamConfig) -> None:
        public_base_url = self._public_base_url(config)
        last_error: Exception | None = None
        for path in ["/api/streams", "/clock"]:
            try:
                with urlopen(f"{public_base_url}{path}", timeout=5) as response:
                    response.read(256)
                return
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"Cloud server is not reachable: {last_error}")

    @staticmethod
    def _short_error(exc: Exception) -> str:
        message = str(exc).strip()
        if len(message) > 120:
            message = f"{message[:117]}..."
        return f"{exc.__class__.__name__}: {message}" if message else exc.__class__.__name__

    @staticmethod
    def _read_probe_url(url: str, *, timeout: float, max_bytes: int = 65536) -> bytes:
        request = Request(url, headers={"User-Agent": "Cloud-Service-Console/LocalStreamProbe"})
        with urlopen(request, timeout=timeout) as response:
            return response.read(max_bytes)

    @staticmethod
    def _stream_has_producer(payload: Any, stream_name: str) -> bool:
        stream_payload: Any = None
        if isinstance(payload, dict):
            stream_payload = payload.get(stream_name)
            streams = payload.get("streams")
            if stream_payload is None and isinstance(streams, dict):
                stream_payload = streams.get(stream_name)
        elif isinstance(payload, list):
            for row in payload:
                if isinstance(row, dict) and row.get("name") == stream_name:
                    stream_payload = row
                    break

        if isinstance(stream_payload, dict):
            producers = stream_payload.get("producers")
            if isinstance(producers, list):
                return len(producers) > 0
            return bool(producers)
        if isinstance(stream_payload, list):
            return len(stream_payload) > 0
        return False

    def _probe_pull_frame(self, config: LocalStreamConfig, public_base_url: str) -> dict[str, Any]:
        stream_name = str(config.stream_name or "main-camera").strip() or "main-camera"
        cache_key = f"{public_base_url}|{stream_name}"
        now = time.monotonic()
        if self._pull_probe_cache is not None:
            cached_at, cached_key, cached_result = self._pull_probe_cache
            if cached_key == cache_key and now - cached_at <= PULL_PROBE_TTL_SECONDS:
                return dict(cached_result)

        result: dict[str, Any] = {
            "pull_reachable": False,
            "pull_note": "pull probe failed",
        }
        try:
            frame_url = f"{public_base_url}/api/frame.jpeg?src={quote(stream_name)}"
            sample = self._read_probe_url(frame_url, timeout=PULL_PROBE_TIMEOUT_SECONDS, max_bytes=1024)
            result = {
                "pull_reachable": bool(sample),
                "pull_note": "single-frame pull OK" if sample else "single-frame pull returned no data",
            }
        except Exception as exc:
            result = {
                "pull_reachable": False,
                "pull_note": self._short_error(exc),
            }

        self._pull_probe_cache = now, cache_key, dict(result)
        return result

    def _probe_cloud_status(self, config: LocalStreamConfig, *, running: bool = False) -> dict[str, Any]:
        public_base_url = self._public_base_url(config)
        stream_name = str(config.stream_name or "main-camera").strip() or "main-camera"
        cache_key = f"{public_base_url}|{stream_name}"
        now = time.monotonic()
        if self._cloud_probe_cache is not None:
            cached_at, cached_key, cached_result = self._cloud_probe_cache
            if cached_key == cache_key and now - cached_at <= CLOUD_PROBE_TTL_SECONDS:
                return dict(cached_result)

        result: dict[str, Any] = {
            "server_reachable": False,
            "server_note": "server API not checked",
            "push_visible": False,
            "push_note": "producer not visible",
            "pull_reachable": False,
            "pull_note": "waiting for cloud producer",
        }

        host = str(config.cloud_public_host or "").strip()
        if not host:
            result["server_note"] = "server host is empty"
            self._cloud_probe_cache = now, cache_key, dict(result)
            return result

        try:
            raw_payload = self._read_probe_url(
                f"{public_base_url}/api/streams",
                timeout=PROBE_TIMEOUT_SECONDS,
                max_bytes=262144,
            )
            result["server_reachable"] = True
            result["server_note"] = "go2rtc API OK"
            try:
                streams_payload = json.loads(raw_payload.decode("utf-8", errors="ignore") or "{}")
                result["push_visible"] = self._stream_has_producer(streams_payload, stream_name)
                result["push_note"] = "cloud producer visible" if result["push_visible"] else "producer not visible"
            except json.JSONDecodeError as exc:
                result["push_note"] = self._short_error(exc)
        except Exception as exc:
            result["server_note"] = self._short_error(exc)
            try:
                self._read_probe_url(f"{public_base_url}/clock", timeout=PROBE_TIMEOUT_SECONDS, max_bytes=256)
                result["server_reachable"] = True
                result["server_note"] = "server HTTP OK"
            except Exception:
                pass

        if result["push_visible"]:
            result.update(self._probe_pull_frame(config, public_base_url))

        self._cloud_probe_cache = now, cache_key, dict(result)
        return result

    @staticmethod
    def _codec_args(config: LocalStreamConfig) -> list[str]:
        encoder = str(config.video_encoder or "libx264").strip()
        if encoder == "auto":
            encoder = "libx264"
        gop = str(max(10, int(config.target_framerate / 2)))
        bitrate = config.video_bitrate or "1800k"
        if encoder == "h264_nvenc":
            return [
                "-c:v",
                "h264_nvenc",
                "-preset",
                "p1",
                "-tune",
                "ull",
                "-rc",
                "cbr_ld_hq",
                "-zerolatency",
                "1",
                "-profile:v",
                "baseline",
                "-b:v",
                bitrate,
                "-maxrate",
                bitrate,
                "-bufsize",
                bitrate,
                "-g",
                gop,
                "-forced-idr",
                "1",
                "-bf",
                "0",
                "-pix_fmt",
                "yuv420p",
            ]
        if encoder == "h264_qsv":
            return [
                "-pix_fmt",
                "nv12",
                "-c:v",
                "h264_qsv",
                "-preset",
                "veryfast",
                "-profile:v",
                "baseline",
                "-b:v",
                bitrate,
                "-maxrate",
                bitrate,
                "-bufsize",
                bitrate,
                "-g",
                gop,
                "-bf",
                "0",
            ]
        if encoder == "h264_amf":
            return [
                "-c:v",
                "h264_amf",
                "-usage",
                "webcam",
                "-quality",
                "speed",
                "-profile:v",
                "constrained_baseline",
                "-rc",
                "cbr",
                "-b:v",
                bitrate,
                "-maxrate",
                bitrate,
                "-bufsize",
                bitrate,
                "-g",
                gop,
                "-bf",
                "0",
                "-pix_fmt",
                "nv12",
            ]
        return [
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-tune",
            "zerolatency",
            "-profile:v",
            "baseline",
            "-sc_threshold",
            "0",
            "-b:v",
            bitrate,
            "-maxrate",
            bitrate,
            "-bufsize",
            bitrate,
            "-g",
            gop,
            "-keyint_min",
            gop,
            "-bf",
            "0",
            "-pix_fmt",
            "yuv420p",
        ]

    def _build_ffmpeg_args(
        self,
        ffmpeg_path: str,
        config: LocalStreamConfig,
        camera_name: str,
        *,
        use_capture_options: bool = True,
    ) -> list[str]:
        args = [
            ffmpeg_path,
            "-hide_banner",
            "-fflags",
            "nobuffer",
            "-flags",
            "low_delay",
            "-thread_queue_size",
            "512",
        ]
        if config.ingest_mode == "srt":
            args.append("-re")
        args.extend(["-f", "dshow", "-use_video_device_timestamps", "false", "-rtbufsize", "256M"])
        if config.input_format:
            args.extend(["-vcodec", config.input_format])
        if use_capture_options:
            args.extend(
                [
                    "-video_size",
                    config.video_size,
                    "-framerate",
                    str(config.input_framerate),
                ]
            )
        args.extend(
            [
                "-i",
                f"video={camera_name}",
                "-an",
                "-vf",
                f"scale={config.output_video_size}:flags=fast_bilinear,fps={config.target_framerate},format=yuv420p",
            ]
        )
        args.extend(self._codec_args(config))
        args.extend(
            [
                "-bsf:v",
                "dump_extra=freq=keyframe",
                "-flush_packets",
                "1",
                "-muxdelay",
                "0",
                "-muxpreload",
                "0",
                "-mpegts_flags",
                "resend_headers",
                "-f",
                "mpegts",
            ]
        )
        if config.ingest_mode == "http":
            args.extend(["-chunked_post", "0", "-method", "POST"])
        args.append(self._target_url(config))
        return args

    def _start_ffmpeg_process(
        self,
        args: list[str],
        config: LocalStreamConfig,
        *,
        startup_grace_seconds: float,
        attempt_note: str,
    ) -> subprocess.Popen | None:
        self.command_path.write_text(json.dumps(args, ensure_ascii=False, indent=2), encoding="utf-8")
        self.log_store.append(f"Local stream starting ffmpeg: {attempt_note}")
        out_handle = self.out_log_path.open("ab")
        err_handle = self.err_log_path.open("ab")
        try:
            process = subprocess.Popen(
                args,
                stdout=out_handle,
                stderr=err_handle,
                cwd=str(self.log_dir),
                creationflags=self._creation_flags(),
            )
        finally:
            out_handle.close()
            err_handle.close()

        self.pid_path.write_text(str(process.pid), encoding="ascii")
        deadline = time.monotonic() + startup_grace_seconds
        while time.monotonic() < deadline:
            if process.poll() is not None:
                self.pid_path.unlink(missing_ok=True)
                self._stop_matching_ffmpeg_processes(config)
                self.log_store.append(f"Local stream ffmpeg startup failed: {attempt_note}", level="warn")
                return None
            time.sleep(0.2)
        return process

    def _stop_started_process(self, process: subprocess.Popen, config: LocalStreamConfig) -> None:
        try:
            if process.poll() is None:
                if sys.platform.startswith("win"):
                    subprocess.run(
                        ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                        capture_output=True,
                        text=True,
                        creationflags=subprocess.CREATE_NO_WINDOW,
                    )
                else:
                    process.terminate()
        except Exception:
            pass
        self._stop_matching_ffmpeg_processes(config)
        self.pid_path.unlink(missing_ok=True)

    def _wait_for_startup_confirmation(
        self,
        process: subprocess.Popen,
        config: LocalStreamConfig,
        log_positions: dict[Path, int],
        *,
        timeout_seconds: float,
    ) -> tuple[bool, str]:
        deadline = time.monotonic() + timeout_seconds
        last_log_text = ""
        while time.monotonic() < deadline:
            if process.poll() is not None:
                return False, "ffmpeg process exited during startup"

            log_text = self._read_logs_since(log_positions)
            if log_text:
                last_log_text = log_text
            if self._ffmpeg_log_indicates_capture_failure(log_text):
                return False, "camera capture produced invalid frames"

            self._cloud_probe_cache = None
            cloud_probe = self._probe_cloud_status(config, running=True)
            if bool(cloud_probe.get("push_visible")):
                return True, "cloud producer visible"

            if self._ffmpeg_log_has_frame_progress(log_text) and time.monotonic() + 0.5 >= deadline:
                return False, "ffmpeg produced frames but cloud producer did not appear"

            time.sleep(0.5)

        if self._ffmpeg_log_indicates_capture_failure(last_log_text):
            return False, "camera capture produced invalid frames"
        return False, "cloud producer did not appear"

    def start(self, config: LocalStreamConfig, runtime_config: CloudRuntimeConfig) -> LocalStreamStatus:
        config = self._apply_current_server_video_defaults(self._resolve_current_server_config(config, runtime_config))
        pid = self._read_pid()
        if self._is_pid_running(pid):
            return self.status(runtime_config, message="Local stream is already running.")

        cameras, ffmpeg_available = self.detect_cameras(config, force=True)
        if not cameras:
            raise RuntimeError("No local camera was detected.")

        ffmpeg_path = self._find_existing_ffmpeg(config.ffmpeg_path)
        if not ffmpeg_path or not ffmpeg_available:
            raise RuntimeError(f"ffmpeg not found: {config.ffmpeg_path}")

        camera_name = config.camera_name.strip() if config.camera_name.strip() else cameras[0].name
        if config.ingest_mode not in {"srt", "http"}:
            raise RuntimeError("Local stream supports SRT and HTTP ingest modes.")

        self._check_cloud_reachable(config)
        self.stop(runtime_config, quiet=True)

        for path in [self.out_log_path, self.err_log_path]:
            path.write_text("", encoding="utf-8")

        self._cloud_probe_cache = None
        self._pull_probe_cache = None
        startup_grace_seconds = min(5.0, max(1.2, (config.connect_timeout_ms / 1000.0) + 0.5))
        camera_options = self._list_camera_options(ffmpeg_path, camera_name)
        base_attempts: list[tuple[str, LocalStreamConfig, bool]] = [
            ("requested camera capture options", config, True),
        ]
        for label, ranked_config in self._ranked_capture_configs(config, camera_options):
            base_attempts.append((f"supported camera mode {label}", ranked_config, True))
        base_attempts.append(("camera default capture options, app output scaling", config, False))
        fallback_capture_configs = self._fallback_capture_configs(config)
        for label, fallback_capture_config in fallback_capture_configs:
            if fallback_capture_config.input_format == "":
                base_attempts.append((f"safe default capture with {label}", fallback_capture_config, False))
        for label, fallback_capture_config in fallback_capture_configs:
            base_attempts.append((f"safe fallback camera mode {label}", fallback_capture_config, True))

        attempts: list[tuple[str, LocalStreamConfig, list[str]]] = []
        seen_attempts: set[tuple[str, str, str, int, int, str, bool]] = set()

        def add_attempt(note: str, attempt_config: LocalStreamConfig, use_capture_options: bool) -> None:
            key = (
                str(attempt_config.input_format or ""),
                str(attempt_config.video_size or ""),
                str(attempt_config.output_video_size or ""),
                int(attempt_config.input_framerate or 0),
                int(attempt_config.target_framerate or 0),
                str(attempt_config.video_encoder or ""),
                use_capture_options,
            )
            if key in seen_attempts:
                return
            seen_attempts.add(key)
            attempts.append(
                (
                    note,
                    attempt_config,
                    self._build_ffmpeg_args(ffmpeg_path, attempt_config, camera_name, use_capture_options=use_capture_options),
                )
            )

        for attempt_note, attempt_config, use_capture_options in base_attempts:
            add_attempt(attempt_note, attempt_config, use_capture_options)

        if str(config.video_encoder or "").strip() == "h264_amf":
            for attempt_note, attempt_config, use_capture_options in base_attempts:
                add_attempt(
                    f"AMF fallback to libx264 with {attempt_note}",
                    attempt_config.model_copy(update={"video_encoder": "libx264"}),
                    use_capture_options,
                )

        confirmation_timeout_seconds = max(12.0, min(30.0, (config.connect_timeout_ms / 1000.0) + 12.0))
        last_failure_reason = ""

        for attempt_note, attempt_config, args in attempts:
            log_positions = self._capture_log_positions()
            process = self._start_ffmpeg_process(
                args,
                attempt_config,
                startup_grace_seconds=startup_grace_seconds,
                attempt_note=attempt_note,
            )
            if process is None:
                continue
            confirmed, failure_reason = self._wait_for_startup_confirmation(
                process,
                attempt_config,
                log_positions,
                timeout_seconds=confirmation_timeout_seconds,
            )
            if not confirmed:
                last_failure_reason = failure_reason
                self.log_store.append(
                    f"Local stream attempt rejected: {attempt_note} ({failure_reason}); trying a lower/supported mode.",
                    level="warn",
                )
                self._stop_started_process(process, attempt_config)
                continue

            self._process = process
            committed_config = self.save_default_config(attempt_config, runtime_config)
            self.log_store.append(f"Local stream started: pid={process.pid}, target={self._target_url(committed_config)}")
            self._publish_runtime_status_safely(
                runtime_config,
                committed_config,
                state="active",
                process_id=process.pid,
                status_reason="startup_confirmed",
                log_failure=True,
            )
            self._start_runtime_heartbeat_thread(runtime_config, committed_config, process.pid)
            message = "Local stream started."
            if config.video_encoder == "h264_amf" and committed_config.video_encoder == "libx264":
                message = "AMD hardware encoding failed; local stream started with libx264 software encoding."
            elif attempt_config.model_dump() != config.model_dump():
                message = (
                    "Local stream started with supported camera mode "
                    f"{committed_config.video_size} @ {committed_config.input_framerate}fps."
                )
            elif attempt_note != attempts[0][0]:
                message = "Local stream started with camera default capture options."
            return self.status(runtime_config, message=message)

        self._process = None
        detail = self._summarize_ffmpeg_startup_failure(self._tail_logs(40))
        if last_failure_reason:
            detail = f"{last_failure_reason}. {detail}"
        raise RuntimeError(f"Local stream startup failed. {detail}")

    def stop(self, runtime_config: CloudRuntimeConfig, *, quiet: bool = False) -> LocalStreamStatus:
        pid = self._read_pid()
        config = self.load_config(runtime_config, prefer_draft=False)
        self._stop_runtime_heartbeat_thread()
        if pid and self._is_pid_running(pid):
            if sys.platform.startswith("win"):
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/T", "/F"],
                    capture_output=True,
                    text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                )
            else:
                try:
                    os.kill(pid, 15)
                except OSError:
                    pass
            if not quiet:
                self.log_store.append(f"Local stream stopped: pid={pid}")

        stopped_pids = self._stop_matching_ffmpeg_processes(config)
        if stopped_pids and not quiet:
            self.log_store.append(f"Local stream orphan processes stopped: {', '.join(str(pid) for pid in stopped_pids)}")

        self._publish_runtime_status_safely(
            runtime_config,
            config,
            state="stopped",
            process_id=None,
            status_reason="manual_stop",
            log_failure=not quiet,
        )
        self._process = None
        self.pid_path.unlink(missing_ok=True)
        self._cloud_probe_cache = None
        self._pull_probe_cache = None
        return self.status(runtime_config, message="Local stream stopped." if not quiet else "")

    def status(self, runtime_config: CloudRuntimeConfig, message: str = "") -> LocalStreamStatus:
        pid = self._read_pid()
        running = self._is_pid_running(pid)
        if not running:
            self.pid_path.unlink(missing_ok=True)
            pid = None
        config = self.load_config(runtime_config, prefer_draft=not running)
        cameras, ffmpeg_available = self.detect_cameras(config)
        if not message:
            if running:
                message = "Local stream is running."
            elif cameras:
                message = "Camera detected. Local stream is ready."
            else:
                message = "No local camera detected."
        cloud_probe = self._probe_cloud_status(config, running=running)
        local_stream_ready = bool(cameras) and ffmpeg_available and bool(cloud_probe.get("server_reachable"))
        if running:
            local_stream_note = f"running PID {pid}"
        elif local_stream_ready:
            local_stream_note = "ready to push"
        elif not cameras:
            local_stream_note = "camera unavailable"
        elif not ffmpeg_available:
            local_stream_note = "ffmpeg unavailable"
        else:
            local_stream_note = str(cloud_probe.get("server_note") or "server unavailable")

        return LocalStreamStatus(
            camera_connected=bool(cameras),
            cameras=cameras,
            running=running,
            pid=pid,
            config=config,
            target_url=self._target_url(config),
            ffmpeg_available=ffmpeg_available,
            server_reachable=bool(cloud_probe.get("server_reachable")),
            server_note=str(cloud_probe.get("server_note") or ""),
            local_stream_ready=local_stream_ready,
            local_stream_note=local_stream_note,
            push_visible=bool(cloud_probe.get("push_visible")),
            push_note=str(cloud_probe.get("push_note") or ""),
            pull_reachable=bool(cloud_probe.get("pull_reachable")),
            pull_note=str(cloud_probe.get("pull_note") or ""),
            log_tail=self._tail_logs(),
            message=message,
            updated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        )
