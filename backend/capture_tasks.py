from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import zipfile
from pathlib import Path
from typing import Any

from capture_store import CaptureFileStore, _iso_now


REQUIRED_KINDS = ("operator-video", "operator-input", "edge-state")
ACTIVE = {"queued", "running"}
RECOVERY_EXTENSIONS = {
    "operator-video": (".webm",),
    "operator-input": (".json",),
    "edge-state": (".zip",),
}


def _record_time(record: dict[str, Any], authoritative_key: str, legacy_key: str) -> float | None:
    for key in (authoritative_key, legacy_key):
        value = record.get(key)
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if number == number:
            return number
    return None


def task_id_for(record: dict[str, Any]) -> str:
    identity = [record.get("room_id") or "", record.get("session_id") or record["id"]]
    return "ct_" + hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:32]


def write_json(path: Path, data: dict[str, Any]) -> None:
    temporary = path.with_suffix(".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def validate_recovery_filename(kind: str, filename: str) -> None:
    extensions = RECOVERY_EXTENSIONS.get(kind)
    if not extensions:
        raise ValueError("不支持这种采集素材类型。")
    suffix = Path(str(filename or "")).suffix.lower()
    if suffix not in extensions:
        expected = "、".join(extensions)
        raise ValueError(f"{kind} 必须选择 {expected} 文件。")


def validate_recovery_artifact(path: Path, kind: str, session_id: str, room_id: str) -> None:
    if not path.is_file() or path.stat().st_size <= 0:
        raise ValueError("补传文件为空。")
    if kind == "operator-video":
        with path.open("rb") as handle:
            if handle.read(4) != b"\x1a\x45\xdf\xa3":
                raise ValueError("画面文件不是有效的 WebM 文件。")
        return
    if kind == "operator-input":
        with path.open("rb") as handle:
            prefix = handle.read(1024 * 1024).decode("utf-8-sig", errors="replace")
        if "telebot.operator-capture/v2" not in prefix:
            raise ValueError("操作指令文件缺少 telebot.operator-capture/v2 标识。")
        expected_session = json.dumps(session_id, ensure_ascii=False)
        if not re.search(r'"session_id"\s*:\s*' + re.escape(expected_session), prefix):
            raise ValueError("操作指令文件的 session_id 与采集任务不一致。")
        if room_id:
            expected_room = json.dumps(room_id, ensure_ascii=False)
            if not re.search(r'"room_id"\s*:\s*' + re.escape(expected_room), prefix):
                raise ValueError("操作指令文件的 room_id 与采集任务不一致。")
        return
    if kind == "edge-state":
        try:
            with zipfile.ZipFile(path) as archive:
                names = set(archive.namelist())
                if "manifest.json" not in names or not any(
                    name.startswith("state-") and name.endswith(".jsonl") for name in names
                ):
                    raise ValueError("机械臂状态压缩包缺少 manifest.json 或状态分块。")
                info = archive.getinfo("manifest.json")
                if info.file_size > 1024 * 1024:
                    raise ValueError("机械臂状态 manifest.json 过大。")
                manifest = json.loads(archive.read(info).decode("utf-8"))
        except (zipfile.BadZipFile, KeyError, UnicodeDecodeError, json.JSONDecodeError, OSError, RuntimeError) as exc:
            raise ValueError("机械臂状态文件不是有效的采集 ZIP。") from exc
        if not isinstance(manifest, dict):
            raise ValueError("机械臂状态 manifest.json 必须是 JSON 对象。")
        if manifest.get("schema") != "telebot.edge-state-capture/v1":
            raise ValueError("机械臂状态文件的 schema 不正确。")
        manifest_session = manifest.get("session") if isinstance(manifest.get("session"), dict) else {}
        if str(manifest_session.get("session_id") or "") != session_id:
            raise ValueError("机械臂状态文件的 session_id 与采集任务不一致。")
        return
    raise ValueError("不支持这种采集素材类型。")


class TaskConflict(ValueError):
    pass


class CaptureTaskStore:
    """Single-worker, disk-backed jobs. Raw uploads keep their existing layout."""

    def __init__(self, files: CaptureFileStore, renderer_dist: Path) -> None:
        self.files = files
        self.root = files.root / "tasks"
        self.root.mkdir(exist_ok=True)
        self.deleted = self.root / ".deleted"
        self.deleted.mkdir(exist_ok=True)
        self.renderer_dist = renderer_dist.resolve()
        self._lock = files._lock
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._process: subprocess.Popen | None = None
        # A killed worker must not leave a task permanently marked as running.
        for path in self.root.glob("ct_*/task.json"):
            job = self._read(path)
            if job.get("status") in ACTIVE:
                job.update(status="failed", error="服务重启中断了合成，请重试。")
                write_json(path, job)
        files.commit_guard = self._check_upload

    @staticmethod
    def _read(path: Path) -> dict[str, Any]:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, ValueError):
            return {}

    def _path(self, task_id: str) -> Path:
        import re
        if not re.fullmatch(r"ct_[a-f0-9]{32}", task_id):
            raise KeyError(task_id)
        path = (self.root / task_id).resolve()
        if path.parent != self.root.resolve():
            raise KeyError(task_id)
        return path

    def _check_upload(self, record: dict[str, Any]) -> None:
        task_id = task_id_for(record)
        if (self.deleted / f"{task_id}.json").exists():
            raise TaskConflict("该采集任务已删除，拒绝迟到的上传。")
        if record.get("source") == "console-recovery-upload":
            existing = [
                item for item in self.files.list_files()
                if task_id_for(item) == task_id and item.get("kind") == record.get("kind")
            ]
            if existing:
                raise TaskConflict("该类素材已经存在，只允许补传缺失文件。")
        job = self._read(self._path(task_id) / "task.json")
        if job.get("status") in ACTIVE | {"completed"}:
            known = {(r["kind"], r["sha256"]) for r in job.get("sources", [])}
            if (record["kind"], record["sha256"]) not in known:
                raise TaskConflict("该采集任务已开始合成，不能覆盖其原始素材。")

    def list_tasks(self) -> list[dict[str, Any]]:
        with self._lock:
            groups: dict[str, list[dict[str, Any]]] = {}
            for record in self.files.list_files():
                groups.setdefault(task_id_for(record), []).append(record)
            tasks = [self._describe(task_id, records) for task_id, records in groups.items()]
        return sorted(tasks, key=lambda t: t["uploaded_at"], reverse=True)

    def _describe(self, task_id: str, records: list[dict[str, Any]]) -> dict[str, Any]:
        job = self._read(self._path(task_id) / "task.json")
        missing = [kind for kind in REQUIRED_KINDS if not any(r["kind"] == kind for r in records)]
        ambiguous = [
            kind for kind in REQUIRED_KINDS
            if len({r["sha256"] for r in records if r["kind"] == kind}) > 1
        ]
        status = job.get("status") or ("incomplete" if missing else "ready")
        output = self._path(task_id) / "replay.mp4"
        if status == "completed" and not output.is_file():
            status = "failed"
            job["error"] = "合成结果文件缺失，请检查云端存储。"
        progress = self._read(self._path(task_id) / "progress.json") if status == "running" else {}
        first = records[0]
        authoritative_starts = [
            value for value in (
                _record_time(r, "authoritative_started_at_server_ms", "")
                for r in records
            )
            if value is not None
        ]
        authoritative_stops = [
            value for value in (
                _record_time(r, "authoritative_stopped_at_server_ms", "")
                for r in records
            )
            if value is not None
        ]
        starts = authoritative_starts or [
            value for value in (
                _record_time(r, "", "started_at_server_ms")
                for r in records
            )
            if value is not None
        ]
        stops = authoritative_stops or [
            value for value in (
                _record_time(r, "", "stopped_at_server_ms")
                for r in records
            )
            if value is not None
        ]
        authoritative_start = min(starts) if starts else None
        authoritative_stop = min(stops) if stops else None
        return {
            "id": task_id, "room_id": first["room_id"], "session_id": first["session_id"],
            "uploaded_at": first["uploaded_at"],
            "started_at_server_ms": authoritative_start,
            "stopped_at_server_ms": authoritative_stop,
            "authoritative_started_at_server_ms": authoritative_start,
            "authoritative_stopped_at_server_ms": authoritative_stop,
            "effective_duration_ms": (
                max(0.0, authoritative_stop - authoritative_start)
                if authoritative_start is not None and authoritative_stop is not None
                else None
            ),
            "stop_authority": next(
                (
                    str(r.get("stop_authority") or "")
                    for r in records
                    if str(r.get("stop_authority") or "").strip()
                ),
                "",
            ),
            "files": records, "missing_kinds": missing, "ambiguous_kinds": ambiguous,
            "size_bytes": sum(r["size_bytes"] for r in records),
            "status": status, "progress": progress.get("percent", 100 if status == "completed" else 0),
            "phase": progress.get("phase", ""), "error": job.get("error", ""),
            "can_synthesize": bool(
                first["session_id"] and not missing and not ambiguous
                and status not in ACTIVE | {"completed", "deleting"}
                and job.get("status") != "completed"
                and not (self.deleted / f"{task_id}.json").exists()
            ),
            "can_repair": bool(
                first["session_id"] and missing
                and status not in ACTIVE | {"completed", "deleting"}
                and not (self.deleted / f"{task_id}.json").exists()
            ),
            "output_bytes": output.stat().st_size if status == "completed" else 0,
            "completed_at": job.get("completed_at"),
            "report": job.get("report"),
        }

    def get_task(self, task_id: str) -> dict[str, Any]:
        self._path(task_id)
        with self._lock:
            records = [r for r in self.files.list_files() if task_id_for(r) == task_id]
            if not records:
                raise KeyError(task_id)
            return self._describe(task_id, records)

    def prepare_recovery_upload(self, task_id: str, kind: str) -> dict[str, Any]:
        with self._lock:
            if kind not in REQUIRED_KINDS:
                raise TaskConflict("不支持这种采集素材类型。")
            task = self.get_task(task_id)
            if not task.get("can_repair"):
                raise TaskConflict("该任务当前不能补传素材。")
            if kind not in task["missing_kinds"]:
                raise TaskConflict("该类素材已经存在，只允许补传缺失文件。")
            return task

    def start(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            if self._stop.is_set():
                raise TaskConflict("服务正在关闭，请稍后重试。")
            task = self.get_task(task_id)
            if not task["can_synthesize"]:
                raise TaskConflict("素材未齐、存在不同版本，或任务已在合成 / 已完成。")
            if sum(t["status"] in ACTIVE for t in self.list_tasks()) >= 12:
                raise TaskConflict("合成队列已满，请等待当前任务完成。")
            if not (self.renderer_dist / "capture-renderer.html").is_file():
                raise TaskConflict("云端渲染器尚未部署。")
            sources = []
            for kind in REQUIRED_KINDS:
                record = next(r for r in task["files"] if r["kind"] == kind)
                result = self.files.get_file(record["id"])
                if result is None:
                    raise TaskConflict("素材已经被删除。")
                sources.append({**record, "path": str(result[1])})
            directory = self._path(task_id)
            directory.mkdir(exist_ok=True)
            write_json(directory / "task.json", {
                "id": task_id, "status": "queued", "sources": sources,
                "session_id": task["session_id"], "room_id": task["room_id"],
                "authoritative_started_at_server_ms": task.get("authoritative_started_at_server_ms"),
                "authoritative_stopped_at_server_ms": task.get("authoritative_stopped_at_server_ms"),
                "effective_duration_ms": task.get("effective_duration_ms"),
                "stop_authority": task.get("stop_authority") or "",
                "renderer_dist": str(self.renderer_dist), "requested_at": _iso_now(),
            })
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(target=self._work, daemon=True, name="capture-composer")
                self._thread.start()
            self._wake.set()
            return self.get_task(task_id)

    def _work(self) -> None:
        while not self._stop.is_set():
            with self._lock:
                pending = [
                    (path, self._read(path)) for path in self.root.glob("ct_*/task.json")
                    if self._read(path).get("status") == "queued"
                ]
                pending.sort(key=lambda pair: pair[1].get("requested_at", ""))
                if pending:
                    path, job = pending[0]
                    job.update(status="running", error="")
                    write_json(path, job)
            if not pending:
                self._wake.wait(1)
                self._wake.clear()
                continue
            try:
                with (path.parent / "render.log").open("wb") as log:
                    options: dict[str, Any] = {}
                    if os.name == "nt":
                        options["creationflags"] = subprocess.CREATE_NO_WINDOW
                    else:
                        options["start_new_session"] = True
                    self._process = subprocess.Popen(
                        [sys.executable, str(Path(__file__).with_name("capture_render.py")), str(path)],
                        stdout=log, stderr=subprocess.STDOUT, **options,
                    )
                    deadline = time.monotonic() + 24 * 3600
                    while self._process.poll() is None:
                        if self._stop.wait(0.5) or time.monotonic() > deadline:
                            self._terminate()
                            raise RuntimeError("合成中断或超过 24 小时时限，可以重试。")
                    if self._process.returncode:
                        failure = self._read(path.parent / "failure.json")
                        raise RuntimeError(failure.get("error") or "合成失败，请检查渲染日志。")
                report = self._read(path.parent / "report.json")
                if not (path.parent / "replay.mp4").is_file() or not report:
                    raise RuntimeError("合成未产生完整的 MP4。")
                with self._lock:
                    job.update(status="completed", completed_at=_iso_now(), report=report, error="")
                    write_json(path, job)
            except Exception as exc:
                with self._lock:
                    job.update(status="failed", error=str(exc)[:1000])
                    write_json(path, job)
            finally:
                self._process = None
                (path.parent / "replay.partial.mp4").unlink(missing_ok=True)
                (path.parent / "states.sqlite").unlink(missing_ok=True)

    def _terminate(self) -> None:
        process = self._process
        if process is None or process.poll() is not None:
            return
        if os.name != "nt":
            import signal
            os.killpg(process.pid, signal.SIGTERM)
        else:
            process.terminate()
        try:
            process.wait(5)
        except subprocess.TimeoutExpired:
            if os.name != "nt":
                os.killpg(process.pid, signal.SIGKILL)
            else:
                process.kill()
            process.wait()

    def close(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread:
            self._thread.join(10)

    def download(self, task_id: str) -> Path:
        with self._lock:
            if self.get_task(task_id)["status"] != "completed":
                raise TaskConflict("MP4 尚未合成完成。")
            return self._path(task_id) / "replay.mp4"

    def delete(self, task_id: str) -> None:
        with self._lock:
            task = self.get_task(task_id)
            if task["status"] in ACTIVE:
                raise TaskConflict("合成中的任务暂不能删除，请等待完成。")
            directory = self._path(task_id)
            # Keep a tiny tombstone so delayed machine retries cannot resurrect a task.
            write_json(self.deleted / f"{task_id}.json", {"deleted_at": _iso_now()})
            for record in task["files"]:
                result = self.files.get_file(record["id"])
                if result:
                    _, file_path = result
                    file_path.unlink(missing_ok=True)
                    file_path.with_name(f"{record['id']}.meta.json").unlink(missing_ok=True)
            if directory.exists():
                shutil.rmtree(directory)
