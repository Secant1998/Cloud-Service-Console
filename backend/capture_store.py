from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterable, BinaryIO, Mapping


_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def _safe_name(value: object, fallback: str = "capture.bin") -> str:
    text = _SAFE_NAME_RE.sub("-", str(value or "").strip()).strip("-.")
    return (text[:160] or fallback)


def _safe_id(value: object) -> str:
    text = str(value or "").strip()
    if not text or not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", text):
        return ""
    return text


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CaptureFileStore:
    """Persistent cloud-side storage for finalized capture files.

    Files are written to a temporary sibling first, hashed while streaming, and
    only exposed in the index after the final file and metadata sidecar have
    both been committed.
    """

    def __init__(self, root: str | Path, *, max_bytes: int | None = None) -> None:
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        configured_max = max_bytes
        if configured_max is None:
            raw_limit = str(os.environ.get("CLOUD_CONSOLE_CAPTURE_MAX_BYTES") or "").strip()
            try:
                configured_max = int(raw_limit) if raw_limit else 2 * 1024 * 1024 * 1024
            except ValueError:
                configured_max = 2 * 1024 * 1024 * 1024
        self.max_bytes = max(1, int(configured_max))
        self._lock = threading.RLock()
        self.commit_guard = None

    def store_upload(
        self,
        file_obj: BinaryIO,
        *,
        filename: str,
        content_type: str = "application/octet-stream",
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        capture_id = uuid.uuid4().hex
        source_name = _safe_name(filename, "capture.bin")
        day_dir = self.root / datetime.now(timezone.utc).strftime("%Y-%m-%d")
        day_dir.mkdir(parents=True, exist_ok=True)
        final_path = day_dir / f"{capture_id}-{source_name}"
        temp_path = day_dir / f".{capture_id}.uploading"
        meta_path = final_path.with_name(f"{capture_id}.meta.json")
        temp_meta_path = meta_path.with_name(f".{capture_id}.meta.json.tmp")

        digest = hashlib.sha256()
        size_bytes = 0
        try:
            with temp_path.open("wb") as handle:
                while True:
                    block = file_obj.read(1024 * 1024)
                    if not block:
                        break
                    size_bytes += len(block)
                    if size_bytes > self.max_bytes:
                        raise ValueError(
                            f"capture file exceeds the cloud limit of {self.max_bytes} bytes"
                        )
                    digest.update(block)
                    handle.write(block)
                handle.flush()
                os.fsync(handle.fileno())

            metadata_input = dict(metadata or {})
            record = {
                "id": capture_id,
                "filename": str(filename or source_name),
                "stored_filename": final_path.name,
                "kind": str(metadata_input.pop("kind", "capture") or "capture"),
                "source": str(metadata_input.pop("source", "unknown") or "unknown"),
                "session_id": str(metadata_input.pop("session_id", "") or ""),
                "room_id": str(metadata_input.pop("room_id", "") or ""),
                "node_id": str(metadata_input.pop("node_id", "") or ""),
                "content_type": str(content_type or "application/octet-stream"),
                "size_bytes": size_bytes,
                "sha256": digest.hexdigest(),
                "uploaded_at": _iso_now(),
                "started_at_server_ms": metadata_input.pop("started_at_server_ms", None),
                "stopped_at_server_ms": metadata_input.pop("stopped_at_server_ms", None),
                "authoritative_started_at_server_ms": metadata_input.pop(
                    "authoritative_started_at_server_ms",
                    None,
                ),
                "authoritative_stopped_at_server_ms": metadata_input.pop(
                    "authoritative_stopped_at_server_ms",
                    None,
                ),
                "stop_requested_at_server_ms": metadata_input.pop(
                    "stop_requested_at_server_ms",
                    None,
                ),
                "stop_received_at_server_ms": metadata_input.pop(
                    "stop_received_at_server_ms",
                    None,
                ),
                "stop_authority": metadata_input.pop("stop_authority", None),
                "sample_count": metadata_input.pop("sample_count", None),
                "sample_hz": metadata_input.pop("sample_hz", None),
                "metadata": metadata_input,
            }
            with self._lock:
                if self.commit_guard is not None:
                    self.commit_guard(record)
                temp_path.replace(final_path)
                temp_meta_path.write_text(
                    json.dumps(record, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                temp_meta_path.replace(meta_path)
            return record
        except Exception:
            temp_path.unlink(missing_ok=True)
            temp_meta_path.unlink(missing_ok=True)
            raise

    async def store_async_upload(
        self,
        chunks: AsyncIterable[bytes],
        *,
        filename: str,
        content_type: str = "application/octet-stream",
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Persist an incoming HTTP request body without buffering it in RAM."""
        capture_id = uuid.uuid4().hex
        source_name = _safe_name(filename, "capture.bin")
        day_dir = self.root / datetime.now(timezone.utc).strftime("%Y-%m-%d")
        day_dir.mkdir(parents=True, exist_ok=True)
        final_path = day_dir / f"{capture_id}-{source_name}"
        temp_path = day_dir / f".{capture_id}.uploading"
        meta_path = final_path.with_name(f"{capture_id}.meta.json")
        temp_meta_path = meta_path.with_name(f".{capture_id}.meta.json.tmp")

        digest = hashlib.sha256()
        size_bytes = 0
        try:
            with temp_path.open("wb") as handle:
                async for block in chunks:
                    if not block:
                        continue
                    size_bytes += len(block)
                    if size_bytes > self.max_bytes:
                        raise ValueError(
                            f"capture file exceeds the cloud limit of {self.max_bytes} bytes"
                        )
                    digest.update(block)
                    handle.write(block)
                handle.flush()
                os.fsync(handle.fileno())

            record = self._build_record(
                capture_id,
                source_name,
                filename,
                content_type,
                size_bytes,
                digest.hexdigest(),
                metadata,
                final_path,
            )
            with self._lock:
                if self.commit_guard is not None:
                    self.commit_guard(record)
                temp_path.replace(final_path)
                temp_meta_path.write_text(
                    json.dumps(record, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                temp_meta_path.replace(meta_path)
            return record
        except Exception:
            temp_path.unlink(missing_ok=True)
            temp_meta_path.unlink(missing_ok=True)
            raise

    def _build_record(
        self,
        capture_id: str,
        source_name: str,
        filename: str,
        content_type: str,
        size_bytes: int,
        sha256: str,
        metadata: Mapping[str, Any] | None,
        final_path: Path,
    ) -> dict[str, Any]:
        metadata_input = dict(metadata or {})
        return {
            "id": capture_id,
            "filename": str(filename or source_name),
            "stored_filename": final_path.name,
            "kind": str(metadata_input.pop("kind", "capture") or "capture"),
            "source": str(metadata_input.pop("source", "unknown") or "unknown"),
            "session_id": str(metadata_input.pop("session_id", "") or ""),
            "room_id": str(metadata_input.pop("room_id", "") or ""),
            "node_id": str(metadata_input.pop("node_id", "") or ""),
            "content_type": str(content_type or "application/octet-stream"),
            "size_bytes": size_bytes,
            "sha256": sha256,
            "uploaded_at": _iso_now(),
            "started_at_server_ms": metadata_input.pop("started_at_server_ms", None),
            "stopped_at_server_ms": metadata_input.pop("stopped_at_server_ms", None),
            "authoritative_started_at_server_ms": metadata_input.pop(
                "authoritative_started_at_server_ms",
                None,
            ),
            "authoritative_stopped_at_server_ms": metadata_input.pop(
                "authoritative_stopped_at_server_ms",
                None,
            ),
            "stop_requested_at_server_ms": metadata_input.pop(
                "stop_requested_at_server_ms",
                None,
            ),
            "stop_received_at_server_ms": metadata_input.pop(
                "stop_received_at_server_ms",
                None,
            ),
            "stop_authority": metadata_input.pop("stop_authority", None),
            "sample_count": metadata_input.pop("sample_count", None),
            "sample_hz": metadata_input.pop("sample_hz", None),
            "metadata": metadata_input,
        }

    def list_files(self, *, limit: int = 0) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        with self._lock:
            metadata_paths = list(self.root.rglob("*.meta.json"))
        for metadata_path in metadata_paths:
            try:
                record = json.loads(metadata_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if not isinstance(record, dict):
                continue
            capture_id = _safe_id(record.get("id"))
            stored_name = _safe_name(record.get("stored_filename"), "")
            if not capture_id or not stored_name:
                continue
            file_path = metadata_path.with_name(stored_name)
            if not file_path.is_file():
                continue
            records.append(record)
        records.sort(key=lambda item: str(item.get("uploaded_at") or ""), reverse=True)
        normalized_limit = int(limit)
        if normalized_limit <= 0:
            return records
        return records[: min(normalized_limit, 10_000)]

    def get_file(self, capture_id: str) -> tuple[dict[str, Any], Path] | None:
        safe_capture_id = _safe_id(capture_id)
        if not safe_capture_id:
            return None
        with self._lock:
            metadata_paths = list(self.root.rglob(f"{safe_capture_id}.meta.json"))
        for metadata_path in metadata_paths:
            try:
                record = json.loads(metadata_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if not isinstance(record, dict) or record.get("id") != safe_capture_id:
                continue
            stored_name = _safe_name(record.get("stored_filename"), "")
            file_path = metadata_path.with_name(stored_name)
            try:
                file_path.resolve().relative_to(self.root)
            except ValueError:
                return None
            if not file_path.is_file():
                return None
            return record, file_path
        return None

    def delete_file(self, capture_id: str) -> bool:
        """Remove one stored artifact and its metadata sidecar."""
        safe_capture_id = _safe_id(capture_id)
        if not safe_capture_id:
            return False
        with self._lock:
            result = self.get_file(safe_capture_id)
            if result is None:
                return False
            _, file_path = result
            file_path.unlink(missing_ok=True)
            file_path.with_name(f"{safe_capture_id}.meta.json").unlink(missing_ok=True)
            return True

    def snapshot(self) -> dict[str, Any]:
        records = self.list_files(limit=0)
        return {
            "root": str(self.root),
            "count": len(records),
            "total_bytes": sum(int(item.get("size_bytes") or 0) for item in records),
            "latest": records[0] if records else None,
        }
