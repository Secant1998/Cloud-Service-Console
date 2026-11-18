from __future__ import annotations

import json
import math
import re
import sqlite3
import zipfile
from pathlib import Path
from typing import Any

import ijson


def finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def read_input_header(path: Path, session_id: str, room_id: str) -> dict[str, Any]:
    header = {}
    for key in ("schema", "session", "video", "clock"):
        with path.open("rb") as source:
            header[key] = next(ijson.items(source, key, use_float=True), None)
    if header["schema"] not in ("telebot.operator-capture/v1", "telebot.operator-capture/v2"):
        raise ValueError("不支持此操作指令文件的格式。")
    session = header["session"] or {}
    if session.get("session_id") != session_id or session.get("room_id", "") != room_id:
        raise ValueError("视频指令文件的房间或会话 ID 与采集任务不匹配。")
    first, last, count = None, None, 0
    with path.open("rb") as source:
        for marker in ijson.items(source, "frame_markers.item", use_float=True):
            stamp = marker.get("frame_server_ts_ms")
            if finite(stamp):
                first = stamp if first is None else first
                last = stamp
                count += 1
    start = session.get("started_at_server_ms")
    if not finite(start):
        raise ValueError("采集缺少有效的云端开始时间。")
    authoritative_start = session.get("authoritative_started_at_server_ms")
    authoritative_stop = session.get("authoritative_stopped_at_server_ms")
    header["authoritative_started_at_server_ms"] = (
        authoritative_start if finite(authoritative_start) else start
    )
    header["authoritative_stopped_at_server_ms"] = (
        authoritative_stop if finite(authoritative_stop) else None
    )
    # Legacy capture has no recorder-start timestamp. A presentation callback
    # is the best available anchor, not the source stream's unrelated mediaTime.
    video = header["video"] or {}
    exact = video.get("recording_started_at_server_ms")
    header["origin_ms"] = exact if finite(exact) else (first if first is not None else start)
    header["alignment"] = (
        "recording-start" if finite(exact) else
        "first-presentation-marker (estimated)" if first is not None else
        "session-start (estimated)"
    )
    header["frame_marker_count"] = count
    header["last_marker_ms"] = last
    header["warnings"] = []
    if not finite(exact):
        header["warnings"].append("旧素材没有录制首帧的精确云时间，对齐采用首个上屏帧标记；存在帧级误差。")
    if (header["clock"] or {}).get("sync_status") != "good":
        header["warnings"].append("前端时钟同步质量不是 good，绝对时间精度可能降低。")
    if not finite(authoritative_stop):
        header["warnings"].append("素材没有权威服务器结束时间，合成将使用视频文件自身时长。")
    return header


def compact_arm(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict) or raw.get("connected") is not True:
        return None
    joints = raw.get("joint_deg")
    if not isinstance(joints, list) or len(joints) < 6 or not all(finite(v) for v in joints[:6]):
        return None
    gripper = raw.get("gripper") or {}
    travel = gripper.get("single_finger_travel_m")
    if not finite(travel) and finite(gripper.get("opening_m")):
        travel = gripper["opening_m"] / 2
    return {
        "joints": joints[:6], "gripper": max(0, min(0.035, travel)) if finite(travel) else 0,
        "fault": bool(raw.get("any_fault")), "enabled": bool(raw.get("all_enabled")),
    }


class StateTimeline:
    """Disk index keeps hour-long 60 Hz captures out of the worker's heap."""

    def __init__(self, database: Path) -> None:
        self.db = sqlite3.connect(database)
        self.db.execute("PRAGMA cache_size=-4096")
        self.db.execute("CREATE TABLE IF NOT EXISTS samples (ts REAL PRIMARY KEY, arms TEXT, clock TEXT)")
        self.count = 0
        self.sides: set[str] = set()
        self.first_ms = 0.0
        self.last_ms = 0.0

    def close(self) -> None:
        self.db.close()

    def ingest(self, archive_path: Path, session_id: str) -> dict[str, Any]:
        self.db.execute("DELETE FROM samples")
        with zipfile.ZipFile(archive_path) as archive:
            entries = archive.infolist()
            if len(entries) > 10_000 or sum(e.file_size for e in entries) > 4 * 1024**3:
                raise ValueError("状态包解压规模超过限制。")
            if len({entry.filename for entry in entries}) != len(entries):
                raise ValueError("状态包包含重名文件。")
            manifest_info = archive.getinfo("manifest.json")
            if manifest_info.file_size > 1024**2:
                raise ValueError("状态包 manifest 过大。")
            manifest = json.loads(archive.read(manifest_info))
            if manifest.get("schema") != "telebot.edge-state-capture/v1":
                raise ValueError("不支持此机械臂状态包格式。")
            manifest_session = manifest.get("session_id") or (manifest.get("session") or {}).get("session_id")
            if manifest_session != session_id:
                raise ValueError("机械臂状态包属于另一次采集。")
            state_files = sorted(
                e.filename for e in entries if re.fullmatch(r"state-\d+\.jsonl", e.filename)
            )
            previous = -math.inf
            with self.db:
                for name in state_files:
                    with archive.open(name) as stream:
                        while True:
                            line = stream.readline(2 * 1024**2 + 1)
                            if not line:
                                break
                            if len(line) > 2 * 1024**2:
                                raise ValueError("单条机械臂状态过大。")
                            if not line.strip():
                                continue
                            item = json.loads(line)
                            stamp = item.get("sampled_at_server_ms")
                            if item.get("session_id") != session_id or not finite(stamp):
                                raise ValueError("机械臂状态的会话或云端时间无效。")
                            if stamp <= previous:
                                raise ValueError("机械臂状态的云端时间没有严格递增。")
                            previous = stamp
                            arms = (item.get("state") or {}).get("arms") or {}
                            compact = {side: compact_arm(arms.get(side)) for side in ("left", "right")}
                            self.sides.update(side for side, arm in compact.items() if arm is not None)
                            self.db.execute("INSERT INTO samples VALUES (?, ?, ?)", (
                                stamp, json.dumps(compact), str((item.get("clock") or {}).get("status", "unknown")),
                            ))
                            self.count += 1
                            if self.count == 1:
                                self.first_ms = stamp
                            self.last_ms = stamp
                            if self.count > 5_000_000:
                                raise ValueError("机械臂状态样本数超过限制。")
        if not self.count or not self.sides:
            raise ValueError("状态包里没有可回放的 Piper 关节数据。")
        return manifest

    def sample(self, stamp: float) -> dict[str, Any]:
        left = self.db.execute(
            "SELECT ts,arms,clock FROM samples WHERE ts<=? ORDER BY ts DESC LIMIT 1", (stamp,)
        ).fetchone()
        right = self.db.execute(
            "SELECT ts,arms,clock FROM samples WHERE ts>? ORDER BY ts LIMIT 1", (stamp,)
        ).fetchone()
        if left is None or stamp - left[0] > 250:
            return {"arms": {}, "cloud_ms": stamp, "missing": True}
        arms = json.loads(left[1])
        # Interpolate measured joints only across short, continuous intervals.
        # Never bridge a disconnect or a telemetry dropout.
        if right and right[0] - left[0] <= 100:
            weight = (stamp - left[0]) / (right[0] - left[0])
            next_arms = json.loads(right[1])
            for side, arm in arms.items():
                other = next_arms.get(side)
                if arm and other:
                    arm["joints"] = [a + (b - a) * weight for a, b in zip(arm["joints"], other["joints"])]
                    arm["gripper"] += (other["gripper"] - arm["gripper"]) * weight
        return {"arms": arms, "cloud_ms": stamp, "clock_status": left[2], "missing": False}
