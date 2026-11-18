import base64
import io
import json
import sys
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setenv("CLOUD_CONSOLE_STORAGE_DIR", str(tmp_path / "storage"))
    import main
    from capture_store import CaptureFileStore
    from capture_tasks import CaptureTaskStore
    files = CaptureFileStore(tmp_path / "captures")
    tasks = CaptureTaskStore(files, tmp_path / "dist")
    monkeypatch.setattr(main, "WEB_MODE", True)
    monkeypatch.setattr(main, "capture_store", files)
    monkeypatch.setattr(main, "capture_tasks", tasks)
    monkeypatch.setattr(main, "_account_for_web_token", lambda token:
        {"username": "test", "role": token} if token in {"user", "admin"} else None)
    with TestClient(main.app) as client:
        yield client, files, tasks


def test_capture_auth_and_download_ticket(api):
    client, files, tasks = api
    file = files.store_upload(io.BytesIO(b"data"), filename="test.json", metadata={
        "session_id": "test", "room_id": "r", "kind": "operator-input",
    })
    task_id = tasks.list_tasks()[0]["id"]
    assert client.get("/api/captures/tasks").status_code == 401
    assert client.post("/api/captures/downloads", json={"file_id": file["id"]}).status_code == 401
    assert client.delete(f"/api/captures/tasks/{task_id}", headers={"Authorization": "Bearer user"}).status_code == 403
    assert client.post(f"/api/captures/tasks/{task_id}/synthesize", headers={"Authorization": "Bearer user"}).status_code == 403
    assert client.post(f"/api/captures/tasks/{task_id}/synthesize", headers={"Authorization": "Bearer admin"}).status_code == 409
    ticket = client.post("/api/captures/downloads", json={"file_id": file["id"]}, headers={"Authorization": "Bearer user"})
    assert ticket.status_code == 200
    downloaded = client.get(ticket.json()["path"])
    assert downloaded.status_code == 200 and downloaded.content == b"data"
    assert client.get("/api/captures/downloads/invalid").status_code == 404
    assert client.delete(f"/api/captures/tasks/{task_id}", headers={"Authorization": "Bearer admin"}).status_code == 200
    assert client.get(ticket.json()["path"]).status_code == 404


def test_admin_can_repair_missing_capture_files(api):
    client, files, tasks = api
    session_id = "repair-session"
    files.store_upload(io.BytesIO(b"{}"), filename="operator-input.json", metadata={
        "session_id": session_id, "room_id": "repair-room", "kind": "operator-input",
    })
    task = tasks.list_tasks()[0]

    def headers(kind: str, filename: str, token: str = "admin") -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream",
            "X-Telebot-Capture-Filename-B64": base64.b64encode(filename.encode()).decode(),
            "X-Telebot-Capture-Recovery-Task": task["id"],
            "X-Telebot-Capture-Recovery-Kind": kind,
        }

    denied = client.post("/api/captures/upload", content=b"\x1a\x45\xdf\xa3video", headers=headers(
        "operator-video", "capture.webm", "user",
    ))
    assert denied.status_code == 403

    video = client.post("/api/captures/upload", content=b"\x1a\x45\xdf\xa3video", headers=headers(
        "operator-video", "capture.webm",
    ))
    assert video.status_code == 200
    assert video.json()["file"]["source"] == "console-recovery-upload"
    duplicate = client.post("/api/captures/upload", content=b"\x1a\x45\xdf\xa3again", headers=headers(
        "operator-video", "capture.webm",
    ))
    assert duplicate.status_code == 409

    invalid = client.post("/api/captures/upload", content=b"not-a-zip", headers=headers(
        "edge-state", "state.zip",
    ))
    assert invalid.status_code == 400
    assert "edge-state" in tasks.get_task(task["id"])["missing_kinds"]

    invalid_manifest = io.BytesIO()
    with zipfile.ZipFile(invalid_manifest, "w") as output:
        output.writestr("manifest.json", "[]")
        output.writestr("state-000001.jsonl", "{}\n")
    invalid = client.post("/api/captures/upload", content=invalid_manifest.getvalue(), headers=headers(
        "edge-state", "state.zip",
    ))
    assert invalid.status_code == 400
    assert "edge-state" in tasks.get_task(task["id"])["missing_kinds"]

    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as output:
        output.writestr("manifest.json", json.dumps({
            "schema": "telebot.edge-state-capture/v1",
            "session": {"session_id": session_id},
        }))
        output.writestr("state-000001.jsonl", "{}\n")
    repaired = client.post("/api/captures/upload", content=archive.getvalue(), headers=headers(
        "edge-state", "state.zip",
    ))
    assert repaired.status_code == 200
    final = tasks.get_task(task["id"])
    assert final["missing_kinds"] == []
    assert final["can_synthesize"]
