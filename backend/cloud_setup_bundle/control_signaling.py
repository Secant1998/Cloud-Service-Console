#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from aiohttp import web


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class PendingOffer:
    offer_id: str
    session: str
    created_at: str
    payload: dict[str, Any]
    answer_future: asyncio.Future[dict[str, Any]]


@dataclass
class SessionState:
    browser_waiters: list[PendingOffer] = field(default_factory=list)
    browser_posts: int = 0
    robot_polls: int = 0
    answers_posted: int = 0
    last_browser_offer_at: str | None = None
    last_robot_poll_at: str | None = None
    last_answer_at: str | None = None


class ControlSignalingBroker:
    def __init__(self, offer_timeout_sec: float = 20.0) -> None:
        self.offer_timeout_sec = offer_timeout_sec
        self.sessions: dict[str, SessionState] = {}

    def get_session(self, session_id: str) -> SessionState:
        state = self.sessions.get(session_id)
        if state is None:
            state = SessionState()
            self.sessions[session_id] = state
        return state

    async def post_browser_offer(self, session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        state = self.get_session(session_id)
        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        pending = PendingOffer(
            offer_id=str(uuid.uuid4()),
            session=session_id,
            created_at=utc_now_iso(),
            payload=payload,
            answer_future=future,
        )
        state.browser_waiters.append(pending)
        state.browser_posts += 1
        state.last_browser_offer_at = pending.created_at

        try:
            return await asyncio.wait_for(future, timeout=self.offer_timeout_sec)
        except asyncio.TimeoutError as exc:
            if pending in state.browser_waiters:
                state.browser_waiters.remove(pending)
            raise web.HTTPGatewayTimeout(text="Timed out waiting for robot answer") from exc
        finally:
            if pending in state.browser_waiters and future.done():
                state.browser_waiters.remove(pending)

    def pop_next_offer(self, session_id: str) -> dict[str, Any] | None:
        state = self.get_session(session_id)
        state.robot_polls += 1
        state.last_robot_poll_at = utc_now_iso()

        while state.browser_waiters:
            pending = state.browser_waiters[0]
            if pending.answer_future.cancelled():
                state.browser_waiters.pop(0)
                continue
            return {
                "ok": True,
                "session": session_id,
                "offerId": pending.offer_id,
                "createdAt": pending.created_at,
                "offer": pending.payload,
            }
        return None

    def post_robot_answer(self, session_id: str, offer_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        state = self.get_session(session_id)
        for index, pending in enumerate(state.browser_waiters):
            if pending.offer_id != offer_id:
                continue
            if not pending.answer_future.done():
                pending.answer_future.set_result(payload)
            state.browser_waiters.pop(index)
            state.answers_posted += 1
            state.last_answer_at = utc_now_iso()
            return {"ok": True, "session": session_id, "offerId": offer_id}
        raise web.HTTPNotFound(text="Matching offer_id not found or already answered")

    def snapshot(self) -> dict[str, Any]:
        return {
            "sessionCount": len(self.sessions),
            "offerTimeoutSec": self.offer_timeout_sec,
            "sessions": {
                name: {
                    "pendingOffers": len(state.browser_waiters),
                    "browserPosts": state.browser_posts,
                    "robotPolls": state.robot_polls,
                    "answersPosted": state.answers_posted,
                    "lastBrowserOfferAt": state.last_browser_offer_at,
                    "lastRobotPollAt": state.last_robot_poll_at,
                    "lastAnswerAt": state.last_answer_at,
                }
                for name, state in self.sessions.items()
            },
            "serverTime": utc_now_iso(),
        }


def read_session(request: web.Request) -> str:
    session_id = (request.query.get("session") or "").strip()
    if not session_id:
        raise web.HTTPBadRequest(text="Missing query parameter: session")
    return session_id


async def read_json_body(request: web.Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise web.HTTPBadRequest(text="Invalid JSON body") from exc
    if not isinstance(payload, dict):
        raise web.HTTPBadRequest(text="JSON body must be an object")
    return payload


def validate_offer_answer_payload(payload: dict[str, Any]) -> None:
    if not isinstance(payload.get("sdp"), str) or not payload["sdp"].strip():
        raise web.HTTPBadRequest(text="Field 'sdp' must be a non-empty string")
    if not isinstance(payload.get("type"), str) or not payload["type"].strip():
        raise web.HTTPBadRequest(text="Field 'type' must be a non-empty string")


async def api_health(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "serverTime": utc_now_iso()})


async def api_status(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    return web.json_response(broker.snapshot())


async def api_browser_offer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    payload = await read_json_body(request)
    validate_offer_answer_payload(payload)
    answer = await broker.post_browser_offer(session_id, payload)
    return web.json_response(answer)


async def api_robot_next_offer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    next_offer = broker.pop_next_offer(session_id)
    if next_offer is None:
        return web.Response(status=204)
    return web.json_response(next_offer)


async def api_robot_answer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    offer_id = (request.query.get("offer_id") or "").strip()
    if not offer_id:
        raise web.HTTPBadRequest(text="Missing query parameter: offer_id")
    payload = await read_json_body(request)
    validate_offer_answer_payload(payload)
    result = broker.post_robot_answer(session_id, offer_id, payload)
    return web.json_response(result)


def create_app(offer_timeout_sec: float) -> web.Application:
    app = web.Application()
    app["broker"] = ControlSignalingBroker(offer_timeout_sec=offer_timeout_sec)
    app.router.add_get("/control/webrtc/health", api_health)
    app.router.add_get("/control/webrtc/status", api_status)
    app.router.add_post("/control/webrtc/browser-offer", api_browser_offer)
    app.router.add_get("/control/webrtc/robot-next-offer", api_robot_next_offer)
    app.router.add_post("/control/webrtc/robot-answer", api_robot_answer)
    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="HTTP signaling broker for browser<->robot control WebRTC pairing.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", default=18085, type=int, help="Port to bind")
    parser.add_argument("--offer-timeout-sec", default=20.0, type=float, help="Browser offer wait timeout")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    web.run_app(
        create_app(offer_timeout_sec=max(1.0, float(args.offer_timeout_sec))),
        host=args.host,
        port=args.port,
        handle_signals=True,
    )


if __name__ == "__main__":
    main()
