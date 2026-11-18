"""Run a local fixture through the real compositor; never alters cloud storage."""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from capture_store import CaptureFileStore
from capture_tasks import CaptureTaskStore
from capture_render import renderer_server


def main():
    from PIL import Image, ImageChops
    from playwright.sync_api import sync_playwright
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", default=str(ROOT / "build" / "capture-fixture"))
    parser.add_argument("--output", default=str(ROOT / "build" / "capture-qa"))
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    dist = ROOT / "frontend" / "dist"
    executable = os.environ.get("CLOUD_CONSOLE_CHROMIUM_PATH")
    with renderer_server(dist) as address, sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=executable,
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 660, "height": 384})
        page.goto(address + "/capture-renderer.html")
        page.wait_for_function("window.captureRenderer?.ready || window.captureRenderer?.error", timeout=60000)
        assert not page.evaluate("window.captureRenderer.error")
        samples = []
        for viewport in [{"width": 660, "height": 384}, {"width": 390, "height": 260}]:
            page.set_viewport_size(viewport)
            page.evaluate("v => window.captureRenderer.setup({...v, sides:['left']})", viewport)
            page.evaluate("frames => window.captureRenderer.fit(frames)", [
                {"arms": {"left": {"joints": joints, "gripper": .02, "enabled": True, "fault": False}}}
                for joints in [[0, 0, 0, 0, 0, 0], [40, 60, -60, 30, 10, 20]]
            ])
            for i, joints in enumerate([[0, 0, 0, 0, 0, 0], [40, 60, -60, 30, 10, 20]]):
                image = page.evaluate("f => window.captureRenderer.frame(f)", {
                    "arms": {"left": {"joints": joints, "gripper": i * .02, "enabled": True, "fault": False}},
                    "cloud_ms": 1000 + i * 1000, "clock_status": "good", "missing": False,
                })
                png = base64.b64decode(image)
                (output / f"piper-{viewport['width']}-{i}.png").write_bytes(png)
                samples.append(Image.open(io.BytesIO(png)).convert("RGB"))
            diff = ImageChops.difference(samples[-1], samples[-2])
            assert diff.getbbox(), "arm replay did not move"
            assert sum(1 for pixel in samples[-1].getdata() if min(pixel) > 90) > 100, "model is blank"
            page.screenshot(path=str(output / f"renderer-{viewport['width']}.png"))
        browser.close()
    files = CaptureFileStore(Path(args.fixture))
    tasks = CaptureTaskStore(files, dist)
    try:
        task = tasks.list_tasks()[0]
        if task["can_synthesize"]:
            tasks.start(task["id"])
        deadline = time.monotonic() + 300
        while time.monotonic() < deadline:
            task = tasks.get_task(task["id"])
            if task["status"] in {"completed", "failed"}:
                break
            time.sleep(1)
        print(json.dumps({k: task[k] for k in ("id", "status", "error", "report")}, ensure_ascii=True, indent=2))
        assert task["status"] == "completed"
        print(tasks.download(task["id"]))
    finally:
        tasks.close()


if __name__ == "__main__":
    main()
