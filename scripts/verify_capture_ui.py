"""Exercise the built console with mocked APIs; never calls production."""
from __future__ import annotations

import functools
import json
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from capture_store import CaptureFileStore
from capture_tasks import CaptureTaskStore


def main():
    from playwright.sync_api import sync_playwright
    out = ROOT / "build" / "capture-qa"
    out.mkdir(exist_ok=True)
    store = CaptureTaskStore(CaptureFileStore(ROOT / "build" / "capture-fixture"), ROOT / "frontend" / "dist")
    real = store.list_tasks()[0]
    ready = {**real, "id": "ct_" + "1" * 32, "status": "ready", "can_synthesize": True,
        "output_bytes": 0, "report": None, "session_id": "ready-test"}
    pending = {**ready, "id": "ct_" + "2" * 32, "status": "incomplete", "can_synthesize": False,
        "missing_kinds": ["edge-state"], "session_id": "waiting-test"}
    task_list = [real, ready, pending]
    calls = []
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 28741), functools.partial(Quiet, directory=str(ROOT / "frontend" / "dist")))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get("CLOUD_CONSOLE_CHROMIUM_PATH"))
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.add_init_script("sessionStorage.setItem('cloud-service-console.account-session','test');")
            status = {"connected": True, "ssh_target": "ubuntu@test", "public_base_url": "http://127.0.0.1:28741",
                "ingest_mode": "p2p", "pending_offers": 0, "service_running_count": "0", "health_ok_count": "0",
                "last_refresh": "now", "summary_status": "test", "config_path": "", "services": [], "health_checks": [],
                "port_checks": [], "network_snapshot": {"local": {"ip": "-"}, "server": {"ip": "-"}}}
            def route(request):
                url = request.request.url
                if not url.startswith("http://127.0.0.1:28741/"):
                    request.abort()
                    return
                path = url.split("28741", 1)[1].split("?", 1)[0]
                if not path.startswith("/api/"):
                    request.continue_()
                    return
                body = {}
                if path == "/api/access":
                    body = {"webMode": True, "authenticated": True, "username": "test", "admin": True, "role": "admin"}
                elif path in {"/api/status", "/api/status/live"}:
                    body = status
                elif path == "/api/captures/tasks":
                    body = {"tasks": task_list, "total": len(task_list), "total_bytes": 1234567, "updated_at": "2026-09-21T12:34:56Z"}
                elif path.endswith("/synthesize"):
                    calls.append("synthesize")
                    ready.update(status="queued", can_synthesize=False)
                    body = ready
                elif request.request.method == "DELETE":
                    calls.append("delete")
                    task_list[:] = [t for t in task_list if not path.endswith(t["id"])]
                    body = {"success": True}
                elif path == "/api/admin/users":
                    body = {"users": [], "total": 0, "online": 0}
                elif path == "/api/agent/settings":
                    body = {"enabled": False, "base_url": "https://api.deepseek.com", "model": "deepseek-chat"}
                request.fulfill(status=200, content_type="application/json", body=json.dumps(body))
            page.route("**/*", route)
            page.goto("http://127.0.0.1:28741/")
            page.get_by_role("button", name="系统设置", exact=True).click()
            panel = page.locator(".capture-tasks")
            panel.wait_for()
            page.get_by_role("button", name="已合成", exact=True).wait_for()
            assert page.get_by_role("button", name="已合成", exact=True).is_disabled()
            widths = page.locator(".capture-synthesize-button").evaluate_all("els => els.map(el => el.getBoundingClientRect().width)")
            assert len(set(widths)) == 1 and widths[0] == 110, widths
            for width in [1440, 390]:
                page.set_viewport_size({"width": width, "height": 1000})
                for label in ["刷新用户列表", "刷新采集任务"]:
                    dimensions = page.get_by_role("button", name=label, exact=True).evaluate("el => { const r=el.getBoundingClientRect(); return [r.width,r.height,getComputedStyle(el).borderRadius]; }")
                    assert dimensions == [36, 36, "50%"], (label, dimensions)
            page.set_viewport_size({"width": 1440, "height": 1000})
            for theme in ["light", "dark"]:
                page.evaluate("theme => document.documentElement.dataset.theme=theme", theme)
                panel.screenshot(path=str(out / f"tasks-{theme}.png"))
            page.get_by_role("button", name="合成 MP4", exact=True).first.click()
            page.get_by_role("button", name="排队中", exact=True).wait_for()
            assert calls.count("synthesize") == 1
            page.get_by_role("button", name="删除采集 waiting-test", exact=True).click()
            assert page.get_by_role("dialog").is_visible()
            page.get_by_role("button", name="取消", exact=True).click()
            assert "delete" not in calls
            page.get_by_role("button", name="删除采集 waiting-test", exact=True).click()
            page.get_by_role("button", name="永久删除", exact=True).click()
            page.get_by_role("dialog").wait_for(state="hidden")
            assert calls.count("delete") == 1
            # Isolate the real mounted section to check its mobile constraints.
            page.set_viewport_size({"width": 390, "height": 844})
            page.evaluate("""() => {
              const panel = document.querySelector('.capture-tasks');
              document.body.appendChild(panel);
              document.getElementById('root').style.display='none';
              document.body.style.overflow='auto';
              panel.style.width='390px';
            }""")
            panel.screenshot(path=str(out / "tasks-mobile.png"))
            assert page.evaluate("document.documentElement.scrollWidth <= 390")
            task_list.clear()
            page.get_by_role("button", name="刷新采集任务", exact=True).click()
            page.get_by_text("暂无采集任务", exact=True).wait_for()
            for width in [1440, 390]:
                page.set_viewport_size({"width": width, "height": 844})
                panel.evaluate("(el, width) => el.style.width=width+'px'", width)
                offset = page.locator(".capture-files-empty").evaluate("""el => {
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    const text = range.getBoundingClientRect();
                    const box = el.getBoundingClientRect();
                    return Math.abs((text.top + text.bottom - box.top - box.bottom) / 2);
                }""")
                assert offset <= 2, offset
                panel.screenshot(path=str(out / f"tasks-empty-{width}.png"))
            assert not errors, errors
            browser.close()
        print("Capture UI: light/dark/mobile, queue, completed lock, delete confirmation passed")
    finally:
        server.shutdown()
        server.server_close()
        worker.join()
        store.close()


if __name__ == "__main__":
    main()
