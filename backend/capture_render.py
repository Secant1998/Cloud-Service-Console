"""Isolated, low-priority Three.js + FFmpeg capture composition worker."""
from __future__ import annotations

import base64
import functools
import hashlib
import json
import math
import os
import random
import shutil
import subprocess
import sys
import threading
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from capture_replay import StateTimeline, read_input_header
from capture_tasks import write_json


@contextmanager
def renderer_server(directory: Path):
    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_GET(self):
            path = urlparse(self.path).path
            if not (path == "/capture-renderer.html" or path.startswith(("/assets/", "/piper/"))):
                self.send_error(404)
                return
            candidate = Path(self.translate_path(self.path)).resolve()
            if not candidate.is_relative_to(directory.resolve()) or not candidate.is_file():
                self.send_error(404)
                return
            super().do_GET()

    for _ in range(100):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", random.randrange(20000, 45000)), functools.partial(Handler, directory=str(directory)))
            break
        except OSError:
            continue
    else:
        raise RuntimeError("No local port available for capture rendering")
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def run_json(arguments: list[str]) -> dict:
    result = subprocess.run(arguments, capture_output=True, timeout=180, check=True)
    return json.loads(result.stdout)


def probe_video(path: Path, *, max_height: int = 2160) -> dict:
    data = run_json([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,width,height,avg_frame_rate,duration:format=duration", "-of", "json", str(path),
    ])
    video = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    if video is None:
        raise ValueError("视频素材不包含视频轨道。")
    width, height = int(video["width"]), int(video["height"])
    if not (320 <= width <= 4096 and 240 <= height <= max_height):
        raise ValueError("目前支持 320x240 到 4096x2160 的采集视频。")
    duration = float((data.get("format") or {}).get("duration") or video.get("duration") or 0)
    if not duration:
        # Browser WebM is commonly unseekable and has no container duration.
        with subprocess.Popen([
            "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_packets",
            "-show_entries", "packet=pts_time,duration_time", "-of", "csv=p=0", str(path),
        ], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True) as process:
            first, last, interval = None, 0.0, 1 / 30
            for line in process.stdout:
                try:
                    values = line.strip().split(",")
                    stamp = float(values[0])
                    step = float(values[1]) if len(values) > 1 and values[1] != "N/A" else interval
                except ValueError:
                    continue
                if first is None:
                    first = stamp
                if stamp > last:
                    interval = min(1, stamp - last)
                last = stamp
                duration = stamp - first + max(step, interval)
                if duration > 6 * 3600:
                    process.kill()
                    raise ValueError("单次合成暂限 6 小时。")
            if process.wait() or first is None:
                raise ValueError("视频帧无法读取。")
    if not math.isfinite(duration) or not (0 < duration <= 6 * 3600):
        raise ValueError("视频时长无效或超过 6 小时。")
    return {"width": width, "height": height, "duration": duration}


def overlay_layout(width: int, height: int) -> dict:
    if abs(width / height - 1980 / 1200) < 0.02:
        # The Telebot mosaic has cameras above / left and keyboard below this slot.
        x = math.ceil(width * 1290 / 1980 / 2) * 2
        y = round(height * 495 / 1200 / 2) * 2
        w = (width - x - 14) // 2 * 2
        h = round(height * 384 / 1200 / 2) * 2
        return {"x": x, "y": y, "width": w, "height": h, "mode": "mosaic-right"}
    # Unknown mosaics must not have a camera silently obscured.
    h = max(240, height // 3 // 2 * 2)
    w = min(width // 2 * 2, round(h * 1.72 / 2) * 2)
    return {"x": (width - w) // 2 // 2 * 2, "y": height + height % 2,
            "width": w, "height": h, "mode": "appended-strip"}


def overlay_filter(output_height: int, layout: dict, fps: int) -> str:
    # WebM often lacks a final packet duration. Keep the final camera frame
    # available until the renderer closes its pipe; -t bounds the output.
    return (
        f"[0:v]setpts=PTS-STARTPTS,fps={fps},tpad=stop_mode=clone:stop=-1,"
        f"pad=ceil(iw/2)*2:{output_height}:0:0:color=0x101012[base];"
        f"[base][1:v]overlay={layout['x']}:{layout['y']}:shortest=1,format=yuv420p[out]"
    )


def encoder_failure(directory: Path, code: int) -> str:
    path = directory / "ffmpeg.log"
    with path.open("rb") as handle:
        handle.seek(0, 2)
        handle.seek(max(0, handle.tell() - 2000))
        detail = handle.read().decode("utf-8", errors="replace").strip()
    return f"FFmpeg exited with code {code}: {detail or 'no diagnostic output'}"


def compose(task_path: Path) -> None:
    from playwright.sync_api import sync_playwright

    if hasattr(os, "nice"):
        os.nice(10)
    directory = task_path.parent
    task = json.loads(task_path.read_text(encoding="utf-8"))
    sources = {record["kind"]: record for record in task["sources"]}
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise ValueError("云端未安装 FFmpeg / ffprobe。")
    write_json(directory / "progress.json", {"percent": 1, "phase": "校验素材"})
    (directory / "failure.json").unlink(missing_ok=True)
    for source in sources.values():
        digest = hashlib.sha256()
        with Path(source["path"]).open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != source["sha256"]:
            raise ValueError("原始文件校验失败，拒绝使用已损坏的素材。")
    header = read_input_header(Path(sources["operator-input"]["path"]), task["session_id"], task["room_id"])
    if not (header["video"] or {}).get("timestamp_overlay", {}).get("burned_into_video"):
        raise ValueError("此视频没有云端时间水印，暂不支持旧版无水印素材的合成。")
    video_path = Path(sources["operator-video"]["path"])
    info = probe_video(video_path)
    layout = overlay_layout(info["width"], info["height"])
    authority_start = task.get(
        "authoritative_started_at_server_ms",
        header.get("authoritative_started_at_server_ms"),
    )
    authority_stop = task.get(
        "authoritative_stopped_at_server_ms",
        header.get("authoritative_stopped_at_server_ms"),
    )
    try:
        authority_start = float(authority_start)
        authority_stop = float(authority_stop)
        if not math.isfinite(authority_start) or not math.isfinite(authority_stop):
            raise ValueError
    except (TypeError, ValueError):
        authority_start = None
        authority_stop = None

    origin = header["origin_ms"]
    render_duration = info["duration"]
    if authority_start is not None and authority_stop is not None:
        if authority_stop <= authority_start:
            raise ValueError("采集任务的服务器结束时间不晚于开始时间。")
        authority_duration = max(0.0, (authority_stop - origin) / 1000.0)
        if authority_duration <= 0.0:
            raise ValueError("权威结束时间早于视频首帧时间，无法合成。")
        # WebM can be shorter than the authoritative interval when a browser
        # disappears during stop. Never synthesize frames beyond the media that
        # actually arrived, but always trim away a late local tail.
        render_duration = min(info["duration"], authority_duration)
    if shutil.disk_usage(directory).free < 512 * 1024**2 + render_duration * 1_000_000:
        raise ValueError("磁盘剩余空间不足，需预留至少 512 MB 加约 1 MB/秒视频时长。")
    timeline = StateTimeline(directory / "states.sqlite")
    encoder = None
    try:
        timeline.ingest(Path(sources["edge-state"]["path"]), task["session_id"])
        if timeline.first_ms > origin + render_duration * 1000 or timeline.last_ms < origin:
            raise ValueError("机械臂状态与视频的云时间段没有重叠。")
        write_json(directory / "progress.json", {"percent": 4, "phase": "加载 Piper 模型"})
        fps = 30
        count = math.ceil(render_duration * fps)
        output_height = info["height"] + info["height"] % 2
        if layout["mode"] == "appended-strip":
            output_height += layout["height"]
            header["warnings"].append("此分辨率不属于已知拼接布局，机械臂回放放在底部扩展区，避免遮挡原视频。")
        filter_graph = overlay_filter(output_height, layout, fps)
        partial = directory / "replay.partial.mp4"
        with renderer_server(Path(task["renderer_dist"])) as address, sync_playwright() as playwright:
            browser_options = {
                "headless": True,
                "args": [
                    "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage",
                    "--renderer-process-limit=1", "--num-raster-threads=1",
                ],
            }
            executable = os.environ.get("CLOUD_CONSOLE_CHROMIUM_PATH")
            if executable:
                browser_options["executable_path"] = executable
            browser = playwright.chromium.launch(**browser_options)
            try:
                page = browser.new_page(viewport={"width": layout["width"], "height": layout["height"]})
                page.route("**/*", lambda route: route.continue_() if route.request.url.startswith(address + "/") else route.abort())
                page.goto(address + "/capture-renderer.html", wait_until="networkidle", timeout=90_000)
                page.wait_for_function(
                    "window.captureRenderer?.ready || window.captureRenderer?.error", timeout=90_000,
                )
                error = page.evaluate("window.captureRenderer.error")
                if error:
                    raise ValueError(error)
                page.evaluate("options => window.captureRenderer.setup(options)", {
                    "width": layout["width"], "height": layout["height"], "sides": sorted(timeline.sides),
                })
                framing = [timeline.sample(origin + i / 300 * render_duration * 1000) for i in range(301)]
                page.evaluate("frames => window.captureRenderer.fit(frames)", framing)
                with (directory / "ffmpeg.log").open("wb") as log:
                    encoder = subprocess.Popen([
                        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-threads", "1",
                        "-i", str(video_path), "-threads", "1", "-thread_queue_size", "4",
                        "-f", "image2pipe", "-framerate", str(fps), "-vcodec", "png", "-i", "pipe:0",
                        "-filter_complex_threads", "1", "-filter_complex", filter_graph,
                        "-map", "[out]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast",
                        "-crf", "20", "-threads", "1", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-movflags", "+faststart", "-t", str(render_duration), str(partial),
                    ], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log)
                    missing_frames = 0
                    for index in range(count):
                        state = timeline.sample(origin + index / fps * 1000)
                        if not any(state["arms"].values()):
                            missing_frames += 1
                        image = page.evaluate("frame => window.captureRenderer.frame(frame)", state)
                        try:
                            encoder.stdin.write(base64.b64decode(image))
                        except BrokenPipeError:
                            code = encoder.wait(timeout=30)
                            if code:
                                raise ValueError(encoder_failure(directory, code)) from None
                            # A clean encoder exit may race the final pipe write.
                            # The decoded result and duration are still checked below.
                            break
                        if index % 15 == 0:
                            write_json(directory / "progress.json", {
                                "percent": round(5 + 90 * index / count, 1),
                                "phase": f"回放合成 {index + 1} / {count} 帧",
                            })
                        if index % 300 == 0 and shutil.disk_usage(directory).free < 256 * 1024**2:
                            raise ValueError("磁盘空间低于 256 MB，已停止合成以保护服务。")
                    try:
                        encoder.stdin.close()
                    except BrokenPipeError:
                        pass
                    code = encoder.wait(timeout=180)
                    if code:
                        raise ValueError(encoder_failure(directory, code))
            finally:
                browser.close()
        write_json(directory / "progress.json", {"percent": 97, "phase": "校验 MP4"})
        result = probe_video(partial, max_height=4096)
        if abs(result["duration"] - render_duration) > 0.25:
            raise ValueError("输出 MP4 时长校验失败。")
        report = {
            "schema": "telebot.capture-replay/v1", "session_id": task["session_id"],
            "model": "agilex.piper/URDF", "fps": fps, "duration_seconds": result["duration"],
            "alignment": header["alignment"], "video_origin_server_ms": origin,
            "authoritative_started_at_server_ms": authority_start,
            "authoritative_stopped_at_server_ms": authority_stop,
            "effective_duration_ms": (
                max(0.0, authority_stop - authority_start)
                if authority_start is not None and authority_stop is not None
                else None
            ),
            "rendered_duration_seconds": render_duration,
            "state_sample_count": timeline.count, "sides": sorted(timeline.sides),
            "state_first_server_ms": timeline.first_ms, "state_last_server_ms": timeline.last_ms,
            "frames_without_state": missing_frames, "warnings": header["warnings"], "overlay": layout,
            "sources": [{"id": r["id"], "kind": r["kind"], "sha256": r["sha256"]} for r in sources.values()],
            "interpolation": "linear joints over <=100 ms; missing after 250 ms; no extrapolation",
            "keyboard": "original burned-in keyboard from input events; not reconstructed or invented",
        }
        partial.replace(directory / "replay.mp4")
        write_json(directory / "report.json", report)
    finally:
        if encoder and encoder.poll() is None:
            encoder.kill()
            encoder.wait()
        timeline.close()
        (directory / "states.sqlite").unlink(missing_ok=True)


if __name__ == "__main__":
    import signal
    def interrupted(_signum, _frame):
        raise InterruptedError("Capture rendering interrupted")
    signal.signal(signal.SIGTERM, interrupted)
    task_path = Path(sys.argv[1]).resolve()
    try:
        compose(task_path)
    except Exception as exc:
        write_json(task_path.parent / "failure.json", {"error": str(exc)[:1000]})
        import traceback
        traceback.print_exc()
        sys.exit(1)
