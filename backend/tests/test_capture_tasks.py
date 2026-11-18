import asyncio
import io
import json
import sys
import threading
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from capture_store import CaptureFileStore
from capture_tasks import CaptureTaskStore, TaskConflict, REQUIRED_KINDS, task_id_for, write_json
from capture_replay import StateTimeline, read_input_header
from capture_render import overlay_layout, renderer_server, overlay_filter, encoder_failure


@pytest.fixture
def stores(tmp_path):
    files = CaptureFileStore(tmp_path / "captures")
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "capture-renderer.html").write_text("test")
    tasks = CaptureTaskStore(files, dist)
    yield files, tasks
    tasks.close()


def upload(files, kind, session="session-a", room="room-a", data=b"data", **extra):
    return files.store_upload(io.BytesIO(data), filename=kind, metadata={
        "kind": kind, "session_id": session, "room_id": room, **extra,
    })


def complete_sources(files):
    for kind in REQUIRED_KINDS:
        upload(files, kind)


def test_grouping_and_incomplete(stores):
    files, tasks = stores
    a = upload(files, REQUIRED_KINDS[0])
    assert len(tasks.list_tasks()) == 1
    assert tasks.get_task(task_id_for(a))["status"] == "incomplete"
    complete_sources(files)
    assert len(tasks.list_tasks()) == 1
    assert tasks.list_tasks()[0]["can_synthesize"]
    upload(files, REQUIRED_KINDS[0], room="room-b")
    upload(files, REQUIRED_KINDS[0], session="session-b")
    assert len(tasks.list_tasks()) == 3


def test_missing_session_stays_unmerged(stores):
    files, tasks = stores
    for kind in REQUIRED_KINDS:
        upload(files, kind, session="")
    assert len(tasks.list_tasks()) == 3
    assert not any(t["can_synthesize"] for t in tasks.list_tasks())


def test_conflicting_sources_block(stores):
    files, tasks = stores
    complete_sources(files)
    upload(files, REQUIRED_KINDS[0], data=b"different")
    assert not tasks.list_tasks()[0]["can_synthesize"]


def test_task_uses_first_authoritative_stop(stores):
    files, tasks = stores
    for kind in REQUIRED_KINDS:
        upload(
            files,
            kind,
            authoritative_started_at_server_ms=1000,
            authoritative_stopped_at_server_ms=2500 if kind != "edge-state" else 2400,
            stop_authority="compute-server-first-stop",
        )
    task = tasks.list_tasks()[0]
    assert task["authoritative_started_at_server_ms"] == 1000
    assert task["authoritative_stopped_at_server_ms"] == 2400
    assert task["effective_duration_ms"] == 1400
    assert task["stopped_at_server_ms"] == 2400


def test_concurrent_queue_once(stores, monkeypatch):
    files, tasks = stores
    complete_sources(files)
    monkeypatch.setattr(tasks, "_work", lambda: tasks._stop.wait())
    task_id = tasks.list_tasks()[0]["id"]
    results = []
    def start():
        try:
            tasks.start(task_id)
            results.append("ok")
        except TaskConflict:
            results.append("conflict")
    threads = [threading.Thread(target=start) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert results.count("ok") == 1
    with pytest.raises(TaskConflict):
        tasks.delete(task_id)
    with pytest.raises(TaskConflict):
        upload(files, REQUIRED_KINDS[0], data=b"late-different")
    upload(files, REQUIRED_KINDS[0])


def test_completed_cannot_repeat_even_missing_output(stores):
    files, tasks = stores
    complete_sources(files)
    task = tasks.list_tasks()[0]
    path = tasks._path(task["id"])
    path.mkdir()
    write_json(path / "task.json", {"status": "completed"})
    with pytest.raises(TaskConflict):
        tasks.start(task["id"])


def test_delete_only_task_and_late_upload(stores):
    files, tasks = stores
    complete_sources(files)
    other = upload(files, "operator-video", session="other")
    task_id = next(t["id"] for t in tasks.list_tasks() if t["session_id"] == "session-a")
    tasks.delete(task_id)
    assert files.get_file(other["id"])
    assert len(files.list_files()) == 1
    with pytest.raises(TaskConflict):
        upload(files, "edge-state")
    async def chunks():
        yield b"retry"
    with pytest.raises(TaskConflict):
        asyncio.run(files.store_async_upload(chunks(), filename="retry", metadata={
            "room_id": "room-a", "session_id": "session-a", "kind": "edge-state",
        }))
    assert not list(files.root.rglob("*.uploading"))
    with pytest.raises(KeyError):
        tasks.delete("../captures")


def test_restart_marks_interrupted_job(stores):
    files, tasks = stores
    complete_sources(files)
    task_id = tasks.list_tasks()[0]["id"]
    path = tasks._path(task_id)
    path.mkdir()
    write_json(path / "task.json", {"status": "running"})
    restarted = CaptureTaskStore(files, tasks.renderer_dist)
    assert restarted.get_task(task_id)["status"] == "failed"
    restarted.close()


def make_zip(path, items, session="s"):
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("manifest.json", json.dumps({
            "schema": "telebot.edge-state-capture/v1", "session": {"session_id": session},
        }))
        archive.writestr("state-000001.jsonl", "\n".join(json.dumps(item) for item in items))
        archive.writestr("../escape", "not extracted")


def sample(stamp, angle, connected=True):
    return {"session_id": "s", "sampled_at_server_ms": stamp, "state": {"arms": {"left": {
        "connected": connected, "joint_deg": [angle] * 6, "gripper": {"opening_m": 0.02},
    }}}}


def test_interpolation_disconnect_and_dropout(tmp_path):
    archive = tmp_path / "a.zip"
    make_zip(archive, [sample(1000, 0), sample(1050, 50), sample(1100, 60, False), sample(1800, 80)])
    timeline = StateTimeline(tmp_path / "states.db")
    timeline.ingest(archive, "s")
    assert timeline.sample(1025)["arms"]["left"]["joints"][0] == 25
    assert timeline.sample(1025)["arms"]["left"]["gripper"] == .01
    assert timeline.sample(1075)["arms"]["left"]["joints"][0] == 50
    assert timeline.sample(1100)["arms"]["left"] is None
    assert timeline.sample(950)["missing"]
    assert timeline.sample(1700)["missing"]
    assert not (tmp_path / "escape").exists()
    timeline.close()


def test_state_rejects_other_session(tmp_path):
    archive = tmp_path / "a.zip"
    make_zip(archive, [sample(1000, 0)], session="other")
    timeline = StateTimeline(tmp_path / "states.db")
    with pytest.raises(ValueError):
        timeline.ingest(archive, "s")
    timeline.close()


def test_cloud_anchor_not_source_media_clock(tmp_path):
    source = tmp_path / "input.json"
    source.write_text(json.dumps({
        "schema": "telebot.operator-capture/v2", "session": {
            "session_id": "s", "room_id": "r", "started_at_server_ms": 1000,
        }, "clock": {"sync_status": "good"}, "video": {},
        "frame_markers": [{"frame_server_ts_ms": 1078, "media_time": 66240}],
    }))
    header = read_input_header(source, "s", "r")
    assert header["origin_ms"] == 1078
    assert header["warnings"]


def test_layout_does_not_cover_keyboard():
    layout = overlay_layout(1980, 1200)
    assert layout["x"] >= 1280 and layout["y"] >= 480
    assert layout["y"] + layout["height"] < 900
    assert layout["x"] + layout["width"] <= 1980
    assert overlay_layout(1920, 1080)["y"] >= 1080


def test_renderer_server_does_not_serve_capture_files(tmp_path):
    from urllib.error import HTTPError
    from urllib.request import urlopen
    (tmp_path / "secret.json").write_text("secret")
    (tmp_path / "capture-renderer.html").write_text("renderer")
    with renderer_server(tmp_path) as url:
        assert urlopen(url + "/capture-renderer.html").read() == b"renderer"
        with pytest.raises(HTTPError):
            urlopen(url + "/secret.json")


def test_encoder_waits_for_overlay_tail(tmp_path):
    import shutil
    import subprocess
    from PIL import Image
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg required")
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), "green").save(buffer, format="PNG")
    output = tmp_path / "tail.mp4"
    graph = overlay_filter(240, {"x": 0, "y": 0}, 30)
    # Deliberately make the overlay last longer than the camera source.
    process = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
        "color=black:size=320x240:rate=10:duration=0.8",
        "-f", "image2pipe", "-framerate", "30", "-vcodec", "png", "-i", "pipe:0",
        "-filter_complex", graph, "-map", "[out]", "-c:v", "libx264", "-threads", "1",
        "-t", "1.2", str(output),
    ], stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    _, error = process.communicate(buffer.getvalue() * 36, timeout=30)
    assert process.returncode == 0, error
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(output)
    ], capture_output=True, check=True)
    assert abs(float(json.loads(result.stdout)["format"]["duration"]) - 1.2) < .04


def test_encoder_error_includes_diagnostic(tmp_path):
    (tmp_path / "ffmpeg.log").write_text("No space left on device")
    assert "No space left" in encoder_failure(tmp_path, 1)
