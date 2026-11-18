"""Explicit post-deploy checks; delete only the uniquely named QA upload."""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main():
    from auth_store import ADMIN_USERNAME, ADMIN_PASSWORD
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--synthesize-session")
    args = parser.parse_args()
    token = ""
    def request(path, method="GET", payload=None, headers=None, raw=None):
        all_headers = {"Content-Type": "application/json"}
        if token:
            all_headers["Authorization"] = "Bearer " + token
        all_headers.update(headers or {})
        data = json.dumps(payload).encode() if payload is not None else raw
        with urlopen(Request(args.base + path, data=data, method=method, headers=all_headers), timeout=30) as response:
            return json.load(response)
    login = request("/api/auth/login", "POST", {
        "username": os.environ.get("CAPTURE_QA_USERNAME", ADMIN_USERNAME),
        "password": os.environ.get("CAPTURE_QA_PASSWORD", ADMIN_PASSWORD),
    })
    token = login["session_token"]
    try:
        before = request("/api/captures/tasks")
        before_hashes = {f["id"]: f["sha256"] for t in before["tasks"] for f in t["files"]}
        print("Tasks before:", [(t["session_id"], t["status"]) for t in before["tasks"]])
        if args.synthesize_session:
            task = next(t for t in before["tasks"] if t["session_id"] == args.synthesize_session)
            path = "/api/captures/tasks/" + task["id"]
            if task["can_synthesize"]:
                request(path + "/synthesize", "POST")
            start = time.monotonic()
            last = None
            while time.monotonic() - start < 600:
                task = next(t for t in request("/api/captures/tasks")["tasks"] if t["id"] == task["id"])
                value = (task["status"], task["progress"])
                if value != last:
                    print("Render:", value, flush=True)
                    last = value
                if task["status"] in {"completed", "failed"}:
                    break
                time.sleep(2)
            assert task["status"] == "completed", task.get("error")
            print("Render seconds:", round(time.monotonic() - start, 1))
            try:
                request(path + "/synthesize", "POST")
                raise AssertionError("Completed task was requeued")
            except HTTPError as error:
                assert error.code == 409
            ticket = request("/api/captures/downloads", "POST", {"task_id": task["id"]})
            destination = ROOT / "build" / "capture-qa" / "cloud-piper-replay.mp4"
            with urlopen(args.base + ticket["path"], timeout=60) as response, destination.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            assert destination.stat().st_size == task["output_bytes"]
            print("MP4 downloaded:", destination, destination.stat().st_size)
            print("Report:", json.dumps(task["report"], ensure_ascii=True))
        qa_session = "console-delete-qa-" + uuid.uuid4().hex
        meta = {"room_id": "console-qa", "session_id": qa_session, "kind": "operator-input"}
        request("/api/captures/upload", "POST", raw=b"{}", headers={
            "X-Telebot-Capture-Filename": "console-qa.json",
            "X-Telebot-Capture-Metadata-B64": base64.b64encode(json.dumps(meta).encode()).decode(),
        })
        qa = next(t for t in request("/api/captures/tasks")["tasks"] if t["session_id"] == qa_session)
        assert qa["status"] == "incomplete"
        request("/api/captures/tasks/" + qa["id"], "DELETE")
        after = request("/api/captures/tasks")
        assert not any(t["session_id"] == qa_session for t in after["tasks"])
        after_hashes = {f["id"]: f["sha256"] for t in after["tasks"] for f in t["files"]}
        assert all(after_hashes.get(key) == value for key, value in before_hashes.items())
        print("Disposable task deletion passed; all existing raw source hashes unchanged.")
    finally:
        request("/api/auth/logout", "POST")


if __name__ == "__main__":
    main()
