#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from aiohttp import WSMsgType, web


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class StreamState:
    subscribers: set[web.WebSocketResponse] = field(default_factory=set)
    published_messages: int = 0
    delivered_messages: int = 0
    last_published_at: str | None = None
    last_message_type: str | None = None
    last_sequence: int | None = None
    last_peer_id: str | None = None


class TelemetryRelay:
    def __init__(self) -> None:
        self.streams: dict[str, StreamState] = defaultdict(StreamState)

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


def create_app() -> web.Application:
    app = web.Application()
    app["relay"] = TelemetryRelay()
    app.router.add_get("/telemetry/health", api_health)
    app.router.add_get("/telemetry/status", api_status)
    app.router.add_post("/telemetry/publish", api_publish)
    app.router.add_get("/telemetry/subscribe", ws_subscribe)
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
