#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import json
import os
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

from aiohttp import WSMsgType, web

DEFAULT_STREAM_NAME = "main-camera"
DEFAULT_REMOTE_BASE = "/opt/go2rtc-cloud"
LEGACY_HEARTBEAT_STALE_AFTER_SEC = 60
LEGACY_MEDIA_STALE_AFTER_SEC = 60
TENCENT_HEARTBEAT_STALE_AFTER_SEC = 60
TENCENT_HEARTBEAT_INTERVAL_SEC = 5


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@web.middleware
async def cors_middleware(request: web.Request, handler: Any) -> web.StreamResponse:
    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Cache-Control"] = "no-store"
    return response


def utc_now_epoch_sec() -> float:
    return datetime.now(timezone.utc).timestamp()


def parse_iso_epoch_sec(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).timestamp()


def runtime_status_path(stream_name: str, remote_base: str) -> str:
    return os.path.join(remote_base, "www", f"{quote(stream_name, safe='')}-runtime.json")


@dataclass
class StreamState:
    subscribers: set[web.WebSocketResponse] = field(default_factory=set)
    published_messages: int = 0
    delivered_messages: int = 0
    last_published_at: str | None = None
    last_message_type: str | None = None
    last_sequence: int | None = None
    last_peer_id: str | None = None


@dataclass
class TencentVideoState:
    live: bool = False
    stream_name: str = DEFAULT_STREAM_NAME
    play_url: str = ""
    push_url_host: str = ""
    source: str = ""
    client_id: str = ""
    started_at: str | None = None
    last_heartbeat_at: str | None = None
    stopped_at: str | None = None
    status_reason: str = "not_started"
    heartbeat_interval_sec: int = TENCENT_HEARTBEAT_INTERVAL_SEC


@dataclass
class LegacyMediaState:
    last_seen_at: str | None = None
    last_activity_at: str | None = None
    last_bytes: int | None = None
    last_packets: int | None = None


class TelemetryRelay:
    def __init__(self) -> None:
        self.streams: dict[str, StreamState] = defaultdict(StreamState)
        self.tencent_video = TencentVideoState()
        self.legacy_media: dict[str, LegacyMediaState] = defaultdict(LegacyMediaState)

    def get_stream(self, src: str) -> StreamState:
        return self.streams[src]

    async def publish(self, src: str, payload: dict[str, Any]) -> int:
        state = self.get_stream(src)
        state.published_messages += 1
        state.last_published_at = utc_now_iso()
        state.last_peer_id = str(payload.get("peer_id") or "") or None

        inner_payload = payload.get("payload")
        if isinstance(inner_payload, dict):
            message_type = inner_payload.get("type")
            sequence = inner_payload.get("sequence")
            state.last_message_type = str(message_type) if message_type is not None else None
            state.last_sequence = sequence if isinstance(sequence, int) else None

        stale: list[web.WebSocketResponse] = []
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        for subscriber in list(state.subscribers):
            try:
                await subscriber.send_str(encoded)
                state.delivered_messages += 1
            except Exception:
                stale.append(subscriber)

        for subscriber in stale:
            state.subscribers.discard(subscriber)
            await subscriber.close()

        return len(state.subscribers)

    def snapshot(self, src: str | None = None) -> dict[str, Any]:
        if src:
            state = self.streams.get(src)
            return {
                "src": src,
                "exists": state is not None,
                "stream": self._stream_snapshot(src, state) if state is not None else None,
                "serverTime": utc_now_iso(),
            }

        return {
            "streamCount": len(self.streams),
            "streams": {name: self._stream_snapshot(name, state) for name, state in self.streams.items()},
            "serverTime": utc_now_iso(),
        }

    def update_tencent_video(self, payload: dict[str, Any], *, state: str) -> dict[str, Any]:
        now_iso = utc_now_iso()
        stream_name = str(payload.get("streamName") or self.tencent_video.stream_name or DEFAULT_STREAM_NAME).strip()
        if not stream_name:
            stream_name = DEFAULT_STREAM_NAME
        if state in {"active", "heartbeat"}:
            if not self.tencent_video.live or state == "active":
                self.tencent_video.started_at = now_iso
            self.tencent_video.live = True
            self.tencent_video.stream_name = stream_name
            self.tencent_video.last_heartbeat_at = now_iso
            self.tencent_video.stopped_at = None
            self.tencent_video.status_reason = "heartbeat" if state == "heartbeat" else "start_confirmed"
            self.tencent_video.play_url = str(payload.get("playUrl") or self.tencent_video.play_url or "").strip()
            self.tencent_video.push_url_host = str(payload.get("pushUrlHost") or self.tencent_video.push_url_host or "").strip()
            self.tencent_video.source = str(payload.get("source") or self.tencent_video.source or "").strip()
            self.tencent_video.client_id = str(payload.get("clientId") or self.tencent_video.client_id or "").strip()
        else:
            self.tencent_video.live = False
            self.tencent_video.stream_name = stream_name
            self.tencent_video.last_heartbeat_at = now_iso
            self.tencent_video.stopped_at = now_iso
            self.tencent_video.status_reason = str(payload.get("statusReason") or "manual_stop").strip() or "manual_stop"
        return self.tencent_video_snapshot()

    def tencent_video_snapshot(self) -> dict[str, Any]:
        now_sec = utc_now_epoch_sec()
        heartbeat_sec = parse_iso_epoch_sec(self.tencent_video.last_heartbeat_at)
        heartbeat_age_sec = None if heartbeat_sec is None else max(0, round(now_sec - heartbeat_sec, 3))
        heartbeat_expired = (
            heartbeat_age_sec is not None
            and heartbeat_age_sec > TENCENT_HEARTBEAT_STALE_AFTER_SEC
        )
        fresh = (
            self.tencent_video.live
            and heartbeat_age_sec is not None
            and heartbeat_age_sec <= TENCENT_HEARTBEAT_STALE_AFTER_SEC
        )
        return {
            "live": bool(fresh),
            "state": "active" if fresh else ("stopped" if heartbeat_expired or not self.tencent_video.live else "stale"),
            "streamName": self.tencent_video.stream_name,
            "startedAt": self.tencent_video.started_at,
            "lastHeartbeatAt": self.tencent_video.last_heartbeat_at,
            "heartbeatAgeSec": heartbeat_age_sec,
            "heartbeatIntervalSec": self.tencent_video.heartbeat_interval_sec,
            "staleAfterSec": TENCENT_HEARTBEAT_STALE_AFTER_SEC,
            "statusReason": self.tencent_video.status_reason,
            "playUrl": self.tencent_video.play_url,
            "pushUrlHost": self.tencent_video.push_url_host,
            "source": self.tencent_video.source,
            "clientId": self.tencent_video.client_id,
            "stoppedAt": self.tencent_video.stopped_at,
        }

    def update_legacy_media(
        self,
        stream_name: str,
        *,
        producer_visible: bool,
        producer_bytes: int | None,
        producer_packets: int | None,
    ) -> dict[str, Any]:
        now_iso = utc_now_iso()
        now_sec = utc_now_epoch_sec()
        state = self.legacy_media[stream_name]
        if producer_visible:
            state.last_seen_at = now_iso
            has_counter = producer_bytes is not None or producer_packets is not None
            counter_changed = (
                producer_bytes is not None
                and (state.last_bytes is None or producer_bytes != state.last_bytes)
            ) or (
                producer_packets is not None
                and (state.last_packets is None or producer_packets != state.last_packets)
            )
            if counter_changed or not has_counter:
                state.last_activity_at = now_iso
            if producer_bytes is not None:
                state.last_bytes = producer_bytes
            if producer_packets is not None:
                state.last_packets = producer_packets

        seen_sec = parse_iso_epoch_sec(state.last_seen_at)
        activity_sec = parse_iso_epoch_sec(state.last_activity_at)
        seen_age_sec = None if seen_sec is None else max(0, round(now_sec - seen_sec, 3))
        activity_age_sec = None if activity_sec is None else max(0, round(now_sec - activity_sec, 3))
        media_active = (
            activity_age_sec is not None
            and activity_age_sec <= LEGACY_MEDIA_STALE_AFTER_SEC
        )
        return {
            "producerVisible": producer_visible,
            "producerLastSeenAt": state.last_seen_at,
            "producerAgeSec": seen_age_sec,
            "producerBytes": producer_bytes,
            "producerPackets": producer_packets,
            "mediaActive": media_active,
            "mediaLastActivityAt": state.last_activity_at,
            "mediaActivityAgeSec": activity_age_sec,
            "mediaStaleAfterSec": LEGACY_MEDIA_STALE_AFTER_SEC,
        }

    @staticmethod
    def _stream_snapshot(src: str, state: StreamState) -> dict[str, Any]:
        return {
            "src": src,
            "subscribers": len(state.subscribers),
            "publishedMessages": state.published_messages,
            "deliveredMessages": state.delivered_messages,
            "lastPublishedAt": state.last_published_at,
            "lastMessageType": state.last_message_type,
            "lastSequence": state.last_sequence,
            "lastPeerId": state.last_peer_id,
        }


def read_src(request: web.Request) -> str:
    src = (request.query.get("src") or "").strip()
    if not src:
        raise web.HTTPBadRequest(text="Missing query parameter: src")
    return src


async def api_publish(request: web.Request) -> web.Response:
    src = read_src(request)
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise web.HTTPBadRequest(text="Invalid JSON body") from exc

    if not isinstance(payload, dict):
        raise web.HTTPBadRequest(text="JSON body must be an object")
    if not isinstance(payload.get("payload"), dict):
        raise web.HTTPBadRequest(text="JSON body must include object field 'payload'")

    relay: TelemetryRelay = request.app["relay"]
    subscribers = await relay.publish(src, payload)
    return web.json_response({"ok": True, "src": src, "subscribers": subscribers})


async def ws_subscribe(request: web.Request) -> web.StreamResponse:
    src = read_src(request)
    relay: TelemetryRelay = request.app["relay"]
    state = relay.get_stream(src)

    ws = web.WebSocketResponse(heartbeat=20.0, autoping=True)
    await ws.prepare(request)
    state.subscribers.add(ws)

    try:
        async for message in ws:
            if message.type == WSMsgType.ERROR:
                break
            if message.type == WSMsgType.TEXT and message.data == "ping":
                await ws.send_str("pong")
    finally:
        state.subscribers.discard(ws)

    return ws


async def api_status(request: web.Request) -> web.Response:
    relay: TelemetryRelay = request.app["relay"]
    src = (request.query.get("src") or "").strip() or None
    return web.json_response(relay.snapshot(src))


async def api_health(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "serverTime": utc_now_iso()})


async def api_options(request: web.Request) -> web.Response:
    return web.Response(status=204)


async def read_json_file(path: str) -> dict[str, Any]:
    def load() -> dict[str, Any]:
        try:
            with open(path, "r", encoding="utf-8-sig") as handle:
                payload = json.load(handle)
        except Exception:
            return {}
        return payload if isinstance(payload, dict) else {}

    return await asyncio.to_thread(load)


async def fetch_go2rtc_streams(request: web.Request) -> dict[str, Any]:
    import aiohttp

    url = str(request.app["go2rtc_streams_url"])
    try:
        timeout = aiohttp.ClientTimeout(total=2.0)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as response:
                if response.status >= 400:
                    return {}
                payload = await response.json(content_type=None)
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def read_optional_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def stream_producer_metrics(payload: Any, stream_name: str) -> dict[str, Any]:
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

    producers: list[Any] = []
    if isinstance(stream_payload, dict):
        raw_producers = stream_payload.get("producers")
        if isinstance(raw_producers, list):
            producers = raw_producers
        elif raw_producers:
            producers = [raw_producers]
    elif isinstance(stream_payload, list):
        producers = stream_payload

    producer_visible = len(producers) > 0
    producer_bytes = 0
    producer_packets = 0
    has_bytes = False
    has_packets = False
    for producer in producers:
        if not isinstance(producer, dict):
            continue
        for key in ("bytes_recv", "bytes"):
            value = read_optional_int(producer.get(key))
            if value is not None:
                producer_bytes += value
                has_bytes = True
        for key in ("packets_recv", "packets"):
            value = read_optional_int(producer.get(key))
            if value is not None:
                producer_packets += value
                has_packets = True
        receivers = producer.get("receivers")
        if isinstance(receivers, list):
            for receiver in receivers:
                if not isinstance(receiver, dict):
                    continue
                for key in ("bytes_recv", "bytes"):
                    value = read_optional_int(receiver.get(key))
                    if value is not None:
                        producer_bytes += value
                        has_bytes = True
                for key in ("packets_recv", "packets"):
                    value = read_optional_int(receiver.get(key))
                    if value is not None:
                        producer_packets += value
                        has_packets = True

    return {
        "producerVisible": producer_visible,
        "producerBytes": producer_bytes if has_bytes else None,
        "producerPackets": producer_packets if has_packets else None,
    }


def legacy_video_snapshot(runtime_payload: dict[str, Any], media_snapshot: dict[str, Any], stream_name: str) -> dict[str, Any]:
    now_sec = utc_now_epoch_sec()
    last_heartbeat_at = runtime_payload.get("lastHeartbeatAt") or runtime_payload.get("generatedAt")
    heartbeat_sec = parse_iso_epoch_sec(last_heartbeat_at)
    heartbeat_age_sec = None if heartbeat_sec is None else max(0, round(now_sec - heartbeat_sec, 3))
    state = str(runtime_payload.get("state") or "unknown").strip().lower()
    heartbeat_expired = (
        heartbeat_age_sec is not None
        and heartbeat_age_sec > LEGACY_HEARTBEAT_STALE_AFTER_SEC
    )
    fresh_heartbeat = (
        state == "active"
        and heartbeat_age_sec is not None
        and heartbeat_age_sec <= LEGACY_HEARTBEAT_STALE_AFTER_SEC
    )
    media_active = bool(media_snapshot.get("mediaActive"))
    live = bool(fresh_heartbeat or media_active)
    if live:
        effective_state = "active"
    elif heartbeat_expired:
        effective_state = "stopped"
    elif state == "active" and heartbeat_age_sec is not None:
        effective_state = "stale"
    else:
        effective_state = state or "unknown"
    return {
        "live": live,
        "state": effective_state,
        "streamName": str(runtime_payload.get("streamName") or stream_name),
        "lastHeartbeatAt": last_heartbeat_at,
        "heartbeatAgeSec": heartbeat_age_sec,
        "heartbeatIntervalSec": runtime_payload.get("heartbeatIntervalSec"),
        "staleAfterSec": LEGACY_HEARTBEAT_STALE_AFTER_SEC,
        "statusReason": runtime_payload.get("statusReason"),
        "liveReason": "heartbeat" if fresh_heartbeat else ("media" if media_active else None),
        "producerVisible": bool(media_snapshot.get("producerVisible")),
        "producerLastSeenAt": media_snapshot.get("producerLastSeenAt"),
        "producerAgeSec": media_snapshot.get("producerAgeSec"),
        "producerBytes": media_snapshot.get("producerBytes"),
        "producerPackets": media_snapshot.get("producerPackets"),
        "mediaActive": media_active,
        "mediaLastActivityAt": media_snapshot.get("mediaLastActivityAt"),
        "mediaActivityAgeSec": media_snapshot.get("mediaActivityAgeSec"),
        "mediaStaleAfterSec": media_snapshot.get("mediaStaleAfterSec"),
        "encoderName": runtime_payload.get("encoderName"),
        "encoderMode": runtime_payload.get("encoderMode"),
        "encoderDisplay": runtime_payload.get("encoderDisplay"),
        "ingestMode": runtime_payload.get("ingestMode"),
        "uploadProtocol": runtime_payload.get("uploadProtocol"),
        "sourcePlatform": runtime_payload.get("sourcePlatform"),
        "sourceHost": runtime_payload.get("sourceHost"),
    }


async def api_video_status(request: web.Request) -> web.Response:
    stream_name = (request.query.get("stream") or request.app["stream_name"]).strip() or DEFAULT_STREAM_NAME
    runtime_payload, streams_payload = await asyncio.gather(
        read_json_file(runtime_status_path(stream_name, request.app["remote_base"])),
        fetch_go2rtc_streams(request),
    )
    relay: TelemetryRelay = request.app["relay"]
    producer_metrics = stream_producer_metrics(streams_payload, stream_name)
    media_snapshot = relay.update_legacy_media(
        stream_name,
        producer_visible=bool(producer_metrics.get("producerVisible")),
        producer_bytes=producer_metrics.get("producerBytes"),
        producer_packets=producer_metrics.get("producerPackets"),
    )
    legacy = legacy_video_snapshot(runtime_payload, media_snapshot, stream_name)
    tencent = relay.tencent_video_snapshot()
    available_modes: list[str] = []
    if legacy["live"]:
        available_modes.append("legacy")
    if tencent["live"]:
        available_modes.append("tencent")
    conflict = len(available_modes) > 1
    if tencent["live"]:
        active_mode = "tencent"
    elif legacy["live"]:
        active_mode = "legacy"
    else:
        active_mode = "offline"
    return web.json_response(
        {
            "ok": True,
            "activeMode": active_mode,
            "conflict": conflict,
            "availableModes": available_modes,
            "legacy": legacy,
            "tencent": tencent,
            "serverTime": utc_now_iso(),
        }
    )


async def api_tencent_start(request: web.Request) -> web.Response:
    relay: TelemetryRelay = request.app["relay"]
    payload = await read_optional_json_object(request)
    return web.json_response({"ok": True, "tencent": relay.update_tencent_video(payload, state="active")})


async def api_tencent_heartbeat(request: web.Request) -> web.Response:
    relay: TelemetryRelay = request.app["relay"]
    payload = await read_optional_json_object(request)
    return web.json_response({"ok": True, "tencent": relay.update_tencent_video(payload, state="heartbeat")})


async def api_tencent_stop(request: web.Request) -> web.Response:
    relay: TelemetryRelay = request.app["relay"]
    payload = await read_optional_json_object(request)
    return web.json_response({"ok": True, "tencent": relay.update_tencent_video(payload, state="stopped")})


async def read_optional_json_object(request: web.Request) -> dict[str, Any]:
    if not request.can_read_body:
        return {}
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        payload = {}
    return payload if isinstance(payload, dict) else {}


def create_app() -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app["relay"] = TelemetryRelay()
    app["stream_name"] = os.environ.get("VIDEO_STREAM_NAME", DEFAULT_STREAM_NAME)
    app["remote_base"] = os.environ.get("GO2RTC_REMOTE_BASE", DEFAULT_REMOTE_BASE)
    app["go2rtc_streams_url"] = os.environ.get("GO2RTC_STREAMS_URL", "http://127.0.0.1:18082/api/streams")
    app.router.add_get("/telemetry/health", api_health)
    app.router.add_get("/telemetry/status", api_status)
    app.router.add_post("/telemetry/publish", api_publish)
    app.router.add_get("/telemetry/subscribe", ws_subscribe)
    app.router.add_get("/api/video/status", api_video_status)
    app.router.add_post("/api/video/tencent/start", api_tencent_start)
    app.router.add_post("/api/video/tencent/heartbeat", api_tencent_heartbeat)
    app.router.add_post("/api/video/tencent/stop", api_tencent_stop)
    app.router.add_route("OPTIONS", "/api/video/{tail:.*}", api_options)
    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Lightweight telemetry relay for go2rtc control data.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", default=18083, type=int, help="Port to bind")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    web.run_app(create_app(), host=args.host, port=args.port, handle_signals=True)


if __name__ == "__main__":
    main()
