#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import hmac
import json
import math
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from aiohttp import web


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_now_epoch_ms() -> int:
    return round(datetime.now(timezone.utc).timestamp() * 1000)


def normalize_latency_ms(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        latency_ms = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(latency_ms) or latency_ms < 0:
        return None
    return min(600000, round(latency_ms))


@dataclass
class PendingOffer:
    offer_id: str
    session: str
    frontend_client_id: str
    created_at: str
    client_role: str
    is_user_frontend: bool
    payload: dict[str, Any]
    answer_future: asyncio.Future[dict[str, Any]]


@dataclass
class SessionState:
    browser_waiters: list[PendingOffer] = field(default_factory=list)
    browser_posts: int = 0
    robot_polls: int = 0
    answers_posted: int = 0
    robot_listener_conflicts: int = 0
    last_browser_offer_at: str | None = None
    last_robot_poll_at: str | None = None
    last_answer_at: str | None = None
    robot_listener_client_id: str | None = None
    robot_listener_instance_id: str | None = None
    robot_listener_first_seen_at: str | None = None
    robot_listener_last_seen_at: str | None = None
    robot_listener_last_seen_monotonic: float | None = None
    robot_listener_latency_ms: int | None = None
    robot_listener_latency_source: str = ""
    robot_listener_latency_updated_at: str | None = None
    last_answer_monotonic: float | None = None


@dataclass
class MonitorClientState:
    client_id: str
    session: str
    first_seen_at: str
    first_seen_order: int
    updated_at: str
    updated_monotonic: float
    latency_ms: int | None
    latency_source: str
    payload: dict[str, Any]
    update_count: int = 0


@dataclass
class MonitorSessionState:
    clients: dict[str, MonitorClientState] = field(default_factory=dict)
    updates_posted: int = 0
    next_client_order: int = 1
    last_update_at: str | None = None
    last_update_monotonic: float | None = None


class ControlSignalingBroker:
    ROBOT_POLL_FRESH_SEC = 5.0
    SIGNAL_PAIR_FRESH_SEC = 15.0
    USER_CONTROL_SESSION_PREFIXES = ("robot-control",)
    INTERNAL_CLIENT_IDS = {"compute", "arm-edge"}
    INTERNAL_CLIENT_ID_PREFIXES = ("compute-", "arm-edge-", "edge-", "robot-")
    INTERNAL_CLIENT_ROLES = {
        "compute_command_sender",
        "arm_edge_command_receiver",
        "arm_edge",
        "compute",
        "robot",
        "robot_receiver",
    }
    OUTPUT_LATENCY_TYPES = {
        "keyboard_sample",
        "vr_sample",
        "text_instruction",
        "processed_input_sample",
    }
    CONNECTED_CALL_STATES = {
        "connected",
        "open",
        "live",
        "ready",
        "datachannel-open",
        "datachannel_open",
        "channel-open",
        "channel_open",
    }
    DIALING_CALL_STATES = {
        "dialing",
        "calling",
        "connecting",
        "offering",
        "waiting",
        "waiting-answer",
        "waiting_answer",
        "have-local-offer",
        "have_local_offer",
    }

    def __init__(
        self,
        offer_timeout_sec: float | None = None,
        monitor_ttl_sec: float = 1.2,
        robot_listener_ttl_sec: float = 10.0,
    ) -> None:
        self.offer_timeout_sec = offer_timeout_sec
        self.monitor_ttl_sec = monitor_ttl_sec
        self.robot_listener_ttl_sec = robot_listener_ttl_sec
        self.sessions: dict[str, SessionState] = {}
        self.monitor_sessions: dict[str, MonitorSessionState] = {}

    def get_session(self, session_id: str) -> SessionState:
        state = self.sessions.get(session_id)
        if state is None:
            state = SessionState()
            self.sessions[session_id] = state
        return state

    def get_monitor_session(self, session_id: str) -> MonitorSessionState:
        state = self.monitor_sessions.get(session_id)
        if state is None:
            state = MonitorSessionState()
            self.monitor_sessions[session_id] = state
        return state

    @staticmethod
    def _normalize_token(value: Any) -> str:
        return str(value or "").strip().lower()

    @classmethod
    def _read_client_role(cls, payload: dict[str, Any]) -> str:
        client = payload.get("client")
        if isinstance(client, dict):
            role = cls._normalize_token(client.get("role"))
            if role:
                return role
        return cls._normalize_token(payload.get("role") or payload.get("clientRole") or payload.get("client_role"))

    @classmethod
    def _is_internal_client_id(cls, client_id: str) -> bool:
        normalized = cls._normalize_token(client_id)
        return normalized in cls.INTERNAL_CLIENT_IDS or normalized.startswith(cls.INTERNAL_CLIENT_ID_PREFIXES)

    @classmethod
    def _is_user_control_session(cls, session_id: str) -> bool:
        normalized = cls._normalize_token(session_id)
        return any(normalized == prefix or normalized.startswith(f"{prefix}-") for prefix in cls.USER_CONTROL_SESSION_PREFIXES)

    @classmethod
    def _is_user_frontend_offer(cls, session_id: str, client_id: str, payload: dict[str, Any]) -> bool:
        role = cls._read_client_role(payload)
        if role in cls.INTERNAL_CLIENT_ROLES:
            return False
        if cls._is_internal_client_id(client_id):
            return False
        return cls._is_user_control_session(session_id)

    async def post_browser_offer(self, session_id: str, frontend_client_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        state = self.get_session(session_id)
        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        client_role = self._read_client_role(payload)
        pending = PendingOffer(
            offer_id=str(uuid.uuid4()),
            session=session_id,
            frontend_client_id=frontend_client_id,
            created_at=utc_now_iso(),
            client_role=client_role,
            is_user_frontend=self._is_user_frontend_offer(session_id, frontend_client_id, payload),
            payload=payload,
            answer_future=future,
        )
        state.browser_waiters.append(pending)
        state.browser_posts += 1
        state.last_browser_offer_at = pending.created_at

        try:
            if self.offer_timeout_sec is None:
                return await future
            return await asyncio.wait_for(future, timeout=self.offer_timeout_sec)
        except asyncio.TimeoutError as exc:
            if pending in state.browser_waiters:
                state.browser_waiters.remove(pending)
            raise web.HTTPGatewayTimeout(text="Timed out waiting for receiver answer") from exc
        except asyncio.CancelledError:
            if pending in state.browser_waiters:
                state.browser_waiters.remove(pending)
            raise
        finally:
            if pending in state.browser_waiters and future.done():
                state.browser_waiters.remove(pending)

    def _robot_listener_age_ms(self, state: SessionState) -> int | None:
        if state.robot_listener_last_seen_monotonic is None:
            return None
        now_monotonic = asyncio.get_running_loop().time()
        return max(0, round((now_monotonic - state.robot_listener_last_seen_monotonic) * 1000))

    def _is_robot_listener_fresh(self, state: SessionState) -> bool:
        age_ms = self._robot_listener_age_ms(state)
        return age_ms is not None and age_ms <= round(self.robot_listener_ttl_sec * 1000)

    def claim_robot_listener(
        self,
        session_id: str,
        robot_client_id: str,
        listener_id: str | None = None,
        latency_ms: int | None = None,
    ) -> SessionState:
        state = self.get_session(session_id)
        now_iso = utc_now_iso()
        now_monotonic = asyncio.get_running_loop().time()
        active_client_id = state.robot_listener_client_id
        active_listener_id = state.robot_listener_instance_id
        active_is_fresh = self._is_robot_listener_fresh(state)

        listener_conflict = False
        if active_client_id and active_is_fresh:
            if active_client_id != robot_client_id:
                listener_conflict = True
            elif active_listener_id and active_listener_id != listener_id:
                listener_conflict = True

        if listener_conflict:
            age_ms = self._robot_listener_age_ms(state)
            remaining_ms = max(0, round((self.robot_listener_ttl_sec * 1000) - (age_ms or 0)))
            state.robot_listener_conflicts += 1
            raise web.HTTPConflict(
                text=json.dumps(
                    {
                        "ok": False,
                        "error": "robot_listener_conflict",
                        "message": "This robotId already has an active robot listener.",
                        "session": session_id,
                        "activeRobotClientId": active_client_id,
                        "activeRobotListenerId": active_listener_id or "",
                        "activeAgeMs": age_ms,
                        "retryAfterSec": math.ceil(remaining_ms / 1000),
                    }
                ),
                content_type="application/json",
            )

        if (
            not active_client_id
            or not active_is_fresh
            or active_client_id != robot_client_id
            or active_listener_id != listener_id
        ):
            state.robot_listener_client_id = robot_client_id
            state.robot_listener_instance_id = listener_id
            state.robot_listener_first_seen_at = now_iso
            state.robot_listener_latency_ms = None
            state.robot_listener_latency_source = ""
            state.robot_listener_latency_updated_at = None

        state.robot_listener_last_seen_at = now_iso
        state.robot_listener_last_seen_monotonic = now_monotonic
        state.robot_listener_latency_ms = None
        state.robot_listener_latency_source = ""
        state.robot_listener_latency_updated_at = None
        return state

    def pop_next_offer(
        self,
        session_id: str,
        robot_client_id: str,
        listener_id: str | None = None,
        latency_ms: int | None = None,
    ) -> dict[str, Any] | None:
        state = self.claim_robot_listener(session_id, robot_client_id, listener_id, latency_ms)
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
                "clientId": pending.frontend_client_id,
                "frontendClientId": pending.frontend_client_id,
                "robotClientId": robot_client_id,
                "robotListenerId": listener_id or "",
                "offer": pending.payload,
            }
        return None

    def heartbeat_robot_listener(
        self,
        session_id: str,
        robot_client_id: str,
        listener_id: str | None = None,
        latency_ms: int | None = None,
    ) -> dict[str, Any]:
        state = self.claim_robot_listener(session_id, robot_client_id, listener_id, latency_ms)
        return {
            "ok": True,
            "session": session_id,
            "robotClientId": robot_client_id,
            "robotListenerId": listener_id or "",
            "robotListenerClientId": state.robot_listener_client_id or "",
            "robotListenerInstanceId": state.robot_listener_instance_id or "",
            "robotListenerLastSeenAt": state.robot_listener_last_seen_at,
            "robotListenerFreshMs": round(self.robot_listener_ttl_sec * 1000),
            "serverTime": utc_now_iso(),
        }

    def post_robot_answer(
        self,
        session_id: str,
        robot_client_id: str,
        offer_id: str,
        payload: dict[str, Any],
        listener_id: str | None = None,
        latency_ms: int | None = None,
    ) -> dict[str, Any]:
        state = self.claim_robot_listener(session_id, robot_client_id, listener_id, latency_ms)
        for index, pending in enumerate(state.browser_waiters):
            if pending.offer_id != offer_id:
                continue
            if not pending.answer_future.done():
                pending.answer_future.set_result(payload)
            state.browser_waiters.pop(index)
            state.answers_posted += 1
            state.last_answer_at = utc_now_iso()
            state.last_answer_monotonic = asyncio.get_running_loop().time()
            return {
                "ok": True,
                "session": session_id,
                "offerId": offer_id,
                "robotClientId": robot_client_id,
                "robotListenerId": listener_id or "",
            }
        raise web.HTTPNotFound(text="Matching offer_id not found or already answered")

    def post_monitor_key_state(self, session_id: str, client_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        state = self.get_monitor_session(session_id)
        now_iso = utc_now_iso()
        now_monotonic = asyncio.get_running_loop().time()
        current = state.clients.get(client_id)
        latency_ms = None
        latency_source = ""
        update_count = 1 if current is None else current.update_count + 1
        first_seen_at = now_iso if current is None else current.first_seen_at
        if current is None:
            first_seen_order = state.next_client_order
            state.next_client_order += 1
        else:
            first_seen_order = current.first_seen_order
        state.clients[client_id] = MonitorClientState(
            client_id=client_id,
            session=session_id,
            first_seen_at=first_seen_at,
            first_seen_order=first_seen_order,
            updated_at=now_iso,
            updated_monotonic=now_monotonic,
            latency_ms=latency_ms,
            latency_source=latency_source,
            payload=payload,
            update_count=update_count,
        )
        state.updates_posted += 1
        state.last_update_at = now_iso
        state.last_update_monotonic = now_monotonic
        self.prune_monitor_session(session_id)
        return {"ok": True, "session": session_id, "clientId": client_id, "updatedAt": now_iso}

    def prune_monitor_session(self, session_id: str) -> None:
        state = self.monitor_sessions.get(session_id)
        if state is None:
            return
        now_monotonic = asyncio.get_running_loop().time()
        stale_client_ids = [
            client_id
            for client_id, client in state.clients.items()
            if now_monotonic - client.updated_monotonic > self.monitor_ttl_sec
        ]
        for client_id in stale_client_ids:
            state.clients.pop(client_id, None)

    @staticmethod
    def _extract_pressed_keys(payload: dict[str, Any]) -> list[str]:
        raw_keys = payload.get("pressedKeys")
        if raw_keys is None:
            raw_keys = payload.get("pressed_keys")
        if raw_keys is None:
            raw_keys = payload.get("keys")
        if not isinstance(raw_keys, list):
            return []
        return [str(item).strip() for item in raw_keys if str(item).strip()]

    @staticmethod
    def _read_input_mode(payload: dict[str, Any]) -> str:
        for key in ("inputMode", "input_mode", "mode"):
            raw_mode = str(payload.get(key) or "").strip().lower()
            if raw_mode:
                if raw_mode in {"keyboard", "kb"}:
                    return "keyboard"
                if raw_mode in {"vr", "xr"}:
                    return "vr"
                if raw_mode in {"text", "text_instruction"}:
                    return "text"
                return raw_mode

        payload_type = str(payload.get("type") or "").strip().lower()
        if payload_type == "keyboard_sample":
            return "keyboard"
        if payload_type == "vr_sample":
            return "vr"
        if payload_type == "text_instruction":
            return "text"
        return ""

    @staticmethod
    def _read_nested_dict(payload: dict[str, Any], key: str) -> dict[str, Any]:
        value = payload.get(key)
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _read_float(value: Any) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return 0.0
        if not math.isfinite(number):
            return 0.0
        return number

    def _read_vector_active(self, value: Any) -> bool:
        if not isinstance(value, dict):
            return False
        return any(abs(self._read_float(value.get(axis))) > 1e-9 for axis in ("x", "y", "z"))

    def _is_keyboard_latency_sample(
        self,
        payload: dict[str, Any],
        previous_payload: dict[str, Any] | None,
    ) -> bool:
        pressed_keys = self._extract_pressed_keys(payload)
        previous_pressed_keys = self._extract_pressed_keys(previous_payload or {})
        if pressed_keys or previous_pressed_keys:
            return True

        for hand in ("leftArm", "rightArm"):
            arm = self._read_nested_dict(payload, hand)
            previous_arm = self._read_nested_dict(previous_payload or {}, hand)
            if self._read_vector_active(arm.get("deltaPos")):
                return True
            for key in ("deltaWristRollDeg", "deltaWristFlexDeg"):
                if abs(self._read_float(arm.get(key))) > 1e-9:
                    return True
            for key in ("positionControlActive", "gripperClosed"):
                if key in arm and arm.get(key) != previous_arm.get(key):
                    return True
        return False

    def _is_vr_latency_sample(
        self,
        payload: dict[str, Any],
        previous_payload: dict[str, Any] | None,
    ) -> bool:
        for hand in ("leftController", "rightController"):
            controller = self._read_nested_dict(payload, hand)
            previous_controller = self._read_nested_dict(previous_payload or {}, hand)
            if bool(controller.get("gripActive")) or bool(controller.get("triggerActive")):
                return True
            if bool(previous_controller.get("gripActive")) or bool(previous_controller.get("triggerActive")):
                return True
            if self._read_vector_active(controller.get("relativePosition")):
                return True
            for key in ("relativeRollDeg", "relativePitchDeg"):
                if abs(self._read_float(controller.get(key))) > 1e-9:
                    return True
        return False

    def _is_latency_sample(self, payload: dict[str, Any], previous_payload: dict[str, Any] | None = None) -> bool:
        payload_type = self._read_optional_string(payload, "type").strip().lower()
        if payload_type not in self.OUTPUT_LATENCY_TYPES:
            return False
        if payload_type == "text_instruction":
            return bool(str(payload.get("text") or "").strip())
        if payload_type == "keyboard_sample":
            return self._is_keyboard_latency_sample(payload, previous_payload)
        if payload_type == "vr_sample":
            return self._is_vr_latency_sample(payload, previous_payload)
        return True

    @staticmethod
    def _read_optional_string(payload: dict[str, Any], *keys: str) -> str:
        for key in keys:
            value = payload.get(key)
            if value is not None:
                return str(value)
        return ""

    @staticmethod
    def _read_optional_latency_ms(payload: dict[str, Any], *keys: str) -> int | None:
        for key in keys:
            latency_ms = normalize_latency_ms(payload.get(key))
            if latency_ms is not None:
                return latency_ms
        return None

    @staticmethod
    def _read_optional_epoch_ms(payload: dict[str, Any], *keys: str) -> int | None:
        for key in keys:
            value = payload.get(key)
            if value in (None, ""):
                continue
            if isinstance(value, str) and any(separator in value for separator in ("T", "-", ":")):
                try:
                    parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
                except ValueError:
                    parsed = None
                if parsed is not None:
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=timezone.utc)
                    return round(parsed.astimezone(timezone.utc).timestamp() * 1000)
            try:
                epoch_ms = float(value)
            except (TypeError, ValueError):
                continue
            if not math.isfinite(epoch_ms) or epoch_ms <= 0:
                continue
            if epoch_ms < 10000000000:
                epoch_ms *= 1000
            return round(epoch_ms)
        return None

    def _read_monitor_payload_latency_ms(
        self,
        payload: dict[str, Any],
        received_epoch_ms: int,
        previous_payload: dict[str, Any] | None = None,
    ) -> tuple[int | None, str]:
        if not self._is_latency_sample(payload, previous_payload):
            return None, ""

        reported_latency_ms = self._read_optional_latency_ms(
            payload,
            "latencyMs",
            "latency_ms",
            "rttMs",
            "rtt_ms",
            "serverLatencyMs",
            "server_latency_ms",
        )
        if reported_latency_ms is not None:
            return reported_latency_ms, "reported"

        sent_epoch_ms = self._read_optional_epoch_ms(
            payload,
            "sentAtMs",
            "sent_at_ms",
            "clientSentAtMs",
            "client_sent_at_ms",
            "timestamp",
            "sampledAt",
            "sampled_at",
            "ts",
        )
        if sent_epoch_ms is not None:
            measured_latency_ms = received_epoch_ms - sent_epoch_ms
            if 0 <= measured_latency_ms <= 600000:
                return round(measured_latency_ms), "timestamp"

        return None, ""

    def monitor_snapshot(self, session_id: str) -> dict[str, Any]:
        self.prune_monitor_session(session_id)
        state = self.get_monitor_session(session_id)
        now_monotonic = asyncio.get_running_loop().time()
        clients = []
        for client in sorted(state.clients.values(), key=lambda item: item.first_seen_order):
            payload = client.payload
            age_ms = max(0, round((now_monotonic - client.updated_monotonic) * 1000))
            clients.append(
                {
                    "clientId": client.client_id,
                    "firstSeenAt": client.first_seen_at,
                    "firstSeenOrder": client.first_seen_order,
                    "updatedAt": client.updated_at,
                    "ageMs": age_ms,
                    "latencyMs": client.latency_ms,
                    "latencySource": client.latency_source,
                    "updateCount": client.update_count,
                    "seq": payload.get("seq"),
                    "sequence": payload.get("sequence"),
                    "ts": payload.get("ts") or payload.get("timestamp") or payload.get("sampledAt"),
                    "timestamp": payload.get("timestamp"),
                    "sampledAt": payload.get("sampledAt"),
                    "type": self._read_optional_string(payload, "type"),
                    "inputMode": self._read_input_mode(payload),
                    "callState": self._read_optional_string(payload, "callState", "call_state"),
                    "pressedKeys": self._extract_pressed_keys(payload),
                }
            )
        link_status = self.build_link_status(session_id, clients)
        return {
            "ok": True,
            "session": session_id,
            "ttlSec": self.monitor_ttl_sec,
            "clientCount": len(clients),
            "totalUpdates": state.updates_posted,
            "lastUpdateAt": state.last_update_at,
            "serverTime": utc_now_iso(),
            "clients": clients,
            "linkStatus": link_status,
        }

    def build_link_status(self, session_id: str, clients: list[dict[str, Any]]) -> dict[str, Any]:
        session_state = self.sessions.get(session_id) or SessionState()
        now = datetime.now(timezone.utc)
        last_robot_poll_at = session_state.last_robot_poll_at
        last_answer_at = session_state.last_answer_at
        robot_poll_age_ms = None
        robot_listener_age_ms = self._robot_listener_age_ms(session_state)
        last_robot_poll_dt = None
        last_answer_dt = None
        if last_robot_poll_at:
            try:
                last_robot_poll_dt = datetime.fromisoformat(last_robot_poll_at)
                robot_poll_age_ms = max(0, round((now - last_robot_poll_dt).total_seconds() * 1000))
            except ValueError:
                robot_poll_age_ms = None
        if last_answer_at:
            try:
                last_answer_dt = datetime.fromisoformat(last_answer_at)
            except ValueError:
                last_answer_dt = None

        normalized_call_states = [str(client.get("callState") or "").strip().lower() for client in clients]
        connected_client_count = sum(1 for item in normalized_call_states if item in self.CONNECTED_CALL_STATES)
        dialing_client_count = sum(1 for item in normalized_call_states if item in self.DIALING_CALL_STATES)
        robot_listener_fresh = (
            robot_listener_age_ms is not None
            and robot_listener_age_ms <= round(self.robot_listener_ttl_sec * 1000)
        )
        signal_pair_age_ms = None
        if session_state.last_answer_monotonic is not None:
            signal_pair_age_ms = max(
                0,
                round((asyncio.get_running_loop().time() - session_state.last_answer_monotonic) * 1000),
            )
        monitor_state = self.monitor_sessions.get(session_id)
        monitor_observed_after_pair = (
            monitor_state is not None
            and monitor_state.last_update_monotonic is not None
            and session_state.last_answer_monotonic is not None
            and monitor_state.last_update_monotonic >= session_state.last_answer_monotonic
        )
        signal_paired = False
        robot_polled_after_answer = (
            last_robot_poll_dt is not None
            and last_answer_dt is not None
            and last_robot_poll_dt > last_answer_dt
        )
        inferred_active_pair = False
        direct_connected = connected_client_count > 0
        backend_listening = robot_listener_fresh or direct_connected
        effective_active_client_count = len(clients)
        pending_offers = len(session_state.browser_waiters)
        user_pending_offers = sum(1 for offer in session_state.browser_waiters if offer.is_user_frontend)
        return {
            "frontendDialing": bool(
                user_pending_offers > 0
                or dialing_client_count > 0
                or direct_connected
            ),
            "backendListening": backend_listening,
            "directConnected": direct_connected,
            "frontendLatencyMs": None,
            "frontendLatencySource": "",
            "backendLatencyMs": None,
            "backendLatencySource": "",
            "directLatencyMs": None,
            "directLatencySource": "",
            "pendingOffers": pending_offers,
            "userPendingOffers": user_pending_offers,
            "internalPendingOffers": max(0, pending_offers - user_pending_offers),
            "browserPosts": session_state.browser_posts,
            "robotPolls": session_state.robot_polls,
            "frontendPosts": session_state.browser_posts,
            "computePolls": session_state.robot_polls,
            "answersPosted": session_state.answers_posted,
            "activeClientCount": effective_active_client_count,
            "dialingClientCount": dialing_client_count,
            "connectedClientCount": connected_client_count,
            "robotPollFreshMs": round(self.ROBOT_POLL_FRESH_SEC * 1000),
            "robotPollAgeMs": robot_poll_age_ms,
            "signalPairFreshMs": round(self.SIGNAL_PAIR_FRESH_SEC * 1000),
            "signalPairAgeMs": signal_pair_age_ms,
            "signalPaired": signal_paired,
            "inferredDirectConnected": inferred_active_pair,
            "robotListenerClientId": session_state.robot_listener_client_id or "",
            "computeListenerClientId": session_state.robot_listener_client_id or "",
            "robotListenerInstanceId": session_state.robot_listener_instance_id or "",
            "robotListenerFreshMs": round(self.robot_listener_ttl_sec * 1000),
            "robotListenerAgeMs": robot_listener_age_ms,
            "robotListenerLatencyMs": None,
            "robotListenerLatencySource": "",
            "robotListenerLatencyUpdatedAt": None,
            "robotListenerConflictCount": session_state.robot_listener_conflicts,
            "lastRobotListenerAt": session_state.robot_listener_last_seen_at,
            "lastBrowserOfferAt": session_state.last_browser_offer_at,
            "lastRobotPollAt": last_robot_poll_at,
            "lastFrontendOfferAt": session_state.last_browser_offer_at,
            "lastComputePollAt": last_robot_poll_at,
            "lastAnswerAt": last_answer_at,
            "source": "control-signaling",
        }

    def snapshot(self) -> dict[str, Any]:
        for session_id in list(self.monitor_sessions):
            self.prune_monitor_session(session_id)
        session_names = sorted(set(self.sessions) | set(self.monitor_sessions))
        return {
            "sessionCount": len(self.sessions),
            "offerTimeoutSec": self.offer_timeout_sec,
            "robotListenerTtlSec": self.robot_listener_ttl_sec,
            "sessions": {
                name: {
                    "pendingOffers": len(state.browser_waiters),
                    "userPendingOffers": sum(1 for offer in state.browser_waiters if offer.is_user_frontend),
                    "internalPendingOffers": sum(1 for offer in state.browser_waiters if not offer.is_user_frontend),
                    "pendingOfferClients": [
                        {
                            "offerId": offer.offer_id,
                            "clientId": offer.frontend_client_id,
                            "clientRole": offer.client_role,
                            "isUserFrontend": offer.is_user_frontend,
                            "createdAt": offer.created_at,
                        }
                        for offer in state.browser_waiters
                    ],
                    "browserPosts": state.browser_posts,
                    "robotPolls": state.robot_polls,
                    "frontendPosts": state.browser_posts,
                    "computePolls": state.robot_polls,
                    "answersPosted": state.answers_posted,
                    "robotListenerClientId": state.robot_listener_client_id,
                    "computeListenerClientId": state.robot_listener_client_id,
                    "robotListenerInstanceId": state.robot_listener_instance_id,
                    "robotListenerFirstSeenAt": state.robot_listener_first_seen_at,
                    "robotListenerLastSeenAt": state.robot_listener_last_seen_at,
                    "robotListenerAgeMs": self._robot_listener_age_ms(state),
                    "robotListenerLatencyMs": None,
                    "robotListenerLatencySource": "",
                    "robotListenerLatencyUpdatedAt": None,
                    "robotListenerConflictCount": state.robot_listener_conflicts,
                    "lastBrowserOfferAt": state.last_browser_offer_at,
                    "lastRobotPollAt": state.last_robot_poll_at,
                    "lastFrontendOfferAt": state.last_browser_offer_at,
                    "lastComputePollAt": state.last_robot_poll_at,
                    "lastAnswerAt": state.last_answer_at,
                }
                for name, state in self.sessions.items()
            },
            "linkStatuses": {
                name: self.build_link_status(
                    name,
                    self.monitor_snapshot(name).get("clients") if name in self.monitor_sessions else [],
                )
                for name in session_names
            },
            "monitorSessionCount": len(self.monitor_sessions),
            "monitorTtlSec": self.monitor_ttl_sec,
            "monitorSessions": {
                name: {
                    "activeClients": len(state.clients),
                    "updatesPosted": state.updates_posted,
                    "lastUpdateAt": state.last_update_at,
                }
                for name, state in self.monitor_sessions.items()
            },
            "serverTime": utc_now_iso(),
        }


def read_session(request: web.Request) -> str:
    session_id = (request.query.get("session") or "").strip()
    if not session_id:
        raise web.HTTPBadRequest(text="Missing query parameter: session")
    return session_id


def read_client_id(request: web.Request) -> str:
    client_id = (request.query.get("client_id") or request.query.get("clientId") or "").strip()
    if not client_id:
        raise web.HTTPBadRequest(text="Missing query parameter: client_id")
    return client_id


def read_robot_client_id(request: web.Request) -> str:
    robot_client_id = (
        request.query.get("robot_client_id")
        or request.query.get("robotClientId")
        or request.query.get("receiver_id")
        or request.query.get("receiverId")
        or ""
    ).strip()
    if not robot_client_id:
        raise web.HTTPBadRequest(text="Missing query parameter: robot_client_id")
    return robot_client_id


def read_edge_client_id(request: web.Request) -> str:
    edge_client_id = (
        request.query.get("edge_client_id")
        or request.query.get("edgeClientId")
        or ""
    ).strip()
    if not edge_client_id:
        raise web.HTTPBadRequest(text="Missing query parameter: edge_client_id")
    return edge_client_id


def read_compute_client_id(request: web.Request) -> str:
    compute_client_id = (
        request.query.get("compute_client_id")
        or request.query.get("computeClientId")
        or ""
    ).strip()
    if not compute_client_id:
        raise web.HTTPBadRequest(text="Missing query parameter: compute_client_id")
    return compute_client_id


def read_robot_listener_id(request: web.Request) -> str | None:
    listener_id = (
        request.query.get("listener_id")
        or request.query.get("listenerId")
        or request.query.get("robot_listener_id")
        or request.query.get("robotListenerId")
        or request.query.get("receiver_instance_id")
        or request.query.get("receiverInstanceId")
        or request.query.get("instance_id")
        or request.query.get("instanceId")
        or ""
    ).strip()
    if listener_id:
        return listener_id
    forwarded_for = str(request.headers.get("X-Forwarded-For") or "").split(",", 1)[0].strip()
    remote_ip = (
        str(request.headers.get("X-Real-IP") or "").strip()
        or forwarded_for
        or str(request.remote or "").strip()
        or "unknown"
    )
    user_agent = str(request.headers.get("User-Agent") or "unknown").strip()[:120]
    return f"legacy:{remote_ip}:{user_agent}"


def read_optional_request_latency_ms(request: web.Request) -> int | None:
    for key in ("latency_ms", "latencyMs", "rtt_ms", "rttMs"):
        latency_ms = normalize_latency_ms(request.query.get(key))
        if latency_ms is not None:
            return latency_ms
    return None


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
    return web.json_response(
        {
            "ok": True,
            "protocolVersion": "telebot-control-v2",
            "authRequired": bool(request.app["auth_token"]),
            "serverTime": utc_now_iso(),
        }
    )


async def api_status(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    payload = broker.snapshot()
    payload["authRequired"] = bool(request.app["auth_token"])
    payload["protocolVersion"] = "telebot-control-v2"
    return web.json_response(payload)


async def api_frontend_offer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    client_id = read_client_id(request)
    payload = await read_json_body(request)
    validate_offer_answer_payload(payload)
    if broker._read_client_role(payload) != "frontend_control_uplink":
        raise web.HTTPBadRequest(text="Field 'role' must be 'frontend_control_uplink'")
    answer = await broker.post_browser_offer(session_id, client_id, payload)
    return web.json_response(answer)


async def api_compute_next_offer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    compute_client_id = read_compute_client_id(request)
    listener_id = read_robot_listener_id(request)
    next_offer = broker.pop_next_offer(
        session_id,
        compute_client_id,
        listener_id,
        read_optional_request_latency_ms(request),
    )
    if next_offer is None:
        return web.Response(status=204)
    next_offer["computeClientId"] = compute_client_id
    return web.json_response(next_offer)


async def api_compute_answer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    compute_client_id = read_compute_client_id(request)
    listener_id = read_robot_listener_id(request)
    offer_id = (request.query.get("offer_id") or "").strip()
    if not offer_id:
        raise web.HTTPBadRequest(text="Missing query parameter: offer_id")
    payload = await read_json_body(request)
    validate_offer_answer_payload(payload)
    if broker._read_client_role(payload) != "compute_control_receiver":
        raise web.HTTPBadRequest(text="Field 'role' must be 'compute_control_receiver'")
    payload.setdefault("computeClientId", compute_client_id)
    result = broker.post_robot_answer(
        session_id,
        compute_client_id,
        offer_id,
        payload,
        listener_id,
        read_optional_request_latency_ms(request),
    )
    result["computeClientId"] = compute_client_id
    return web.json_response(result)


async def api_browser_offer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    client_id = read_client_id(request)
    payload = await read_json_body(request)
    validate_offer_answer_payload(payload)
    answer = await broker.post_browser_offer(session_id, client_id, payload)
    return web.json_response(answer)


async def api_robot_next_offer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    robot_client_id = read_robot_client_id(request)
    listener_id = read_robot_listener_id(request)
    next_offer = broker.pop_next_offer(
        session_id,
        robot_client_id,
        listener_id,
        read_optional_request_latency_ms(request),
    )
    if next_offer is None:
        return web.Response(status=204)
    return web.json_response(next_offer)


async def api_robot_listener_heartbeat(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    robot_client_id = read_robot_client_id(request)
    listener_id = read_robot_listener_id(request)
    return web.json_response(
        broker.heartbeat_robot_listener(
            session_id,
            robot_client_id,
            listener_id,
            read_optional_request_latency_ms(request),
        )
    )


async def api_robot_answer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    robot_client_id = read_robot_client_id(request)
    listener_id = read_robot_listener_id(request)
    offer_id = (request.query.get("offer_id") or "").strip()
    if not offer_id:
        raise web.HTTPBadRequest(text="Missing query parameter: offer_id")
    payload = await read_json_body(request)
    validate_offer_answer_payload(payload)
    latency_ms = read_optional_request_latency_ms(request)
    if latency_ms is None:
        latency_ms = ControlSignalingBroker._read_optional_latency_ms(
            payload,
            "latencyMs",
            "latency_ms",
            "rttMs",
            "rtt_ms",
            "serverLatencyMs",
            "server_latency_ms",
        )
    result = broker.post_robot_answer(session_id, robot_client_id, offer_id, payload, listener_id, latency_ms)
    return web.json_response(result)


async def api_compute_command_offer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    client_id = read_client_id(request)
    payload = await read_json_body(request)
    validate_offer_answer_payload(payload)
    if broker._read_client_role(payload) != "compute_command_sender":
        raise web.HTTPBadRequest(text="Field 'role' must be 'compute_command_sender'")
    answer = await broker.post_browser_offer(session_id, client_id, payload)
    return web.json_response(answer)


async def api_edge_next_command_offer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    edge_client_id = read_edge_client_id(request)
    listener_id = read_robot_listener_id(request)
    next_offer = broker.pop_next_offer(
        session_id,
        edge_client_id,
        listener_id,
        read_optional_request_latency_ms(request),
    )
    if next_offer is None:
        return web.Response(status=204)
    next_offer["edgeClientId"] = edge_client_id
    return web.json_response(next_offer)


async def api_edge_command_answer(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    edge_client_id = read_edge_client_id(request)
    listener_id = read_robot_listener_id(request)
    offer_id = (request.query.get("offer_id") or "").strip()
    if not offer_id:
        raise web.HTTPBadRequest(text="Missing query parameter: offer_id")
    payload = await read_json_body(request)
    validate_offer_answer_payload(payload)
    if broker._read_client_role(payload) != "edge_command_receiver":
        raise web.HTTPBadRequest(text="Field 'role' must be 'edge_command_receiver'")
    payload.setdefault("edgeClientId", edge_client_id)
    result = broker.post_robot_answer(
        session_id,
        edge_client_id,
        offer_id,
        payload,
        listener_id,
        read_optional_request_latency_ms(request),
    )
    result["edgeClientId"] = edge_client_id
    return web.json_response(result)


async def api_monitor_key_state_post(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    client_id = read_client_id(request)
    payload = await read_json_body(request)
    result = broker.post_monitor_key_state(session_id, client_id, payload)
    return web.json_response(result)


async def api_monitor_key_state_get(request: web.Request) -> web.Response:
    broker: ControlSignalingBroker = request.app["broker"]
    session_id = read_session(request)
    return web.json_response(broker.monitor_snapshot(session_id))


@web.middleware
async def cors_middleware(request: web.Request, handler) -> web.StreamResponse:
    if request.method.upper() == "OPTIONS":
        response: web.StreamResponse = web.Response(status=204)
    else:
        try:
            expected_token = str(request.app["auth_token"] or "")
            if expected_token and request.path != "/control/webrtc/health":
                supplied = request.headers.get("Authorization", "")
                if not supplied.startswith("Bearer ") or not hmac.compare_digest(supplied[7:], expected_token):
                    raise web.HTTPUnauthorized(text="Valid signaling bearer token required")
            response = await handler(request)
        except web.HTTPException as exc:
            response = exc

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Cache-Control"
    response.headers["Cache-Control"] = "no-store"
    return response


def create_app(
    offer_timeout_sec: float | None,
    monitor_ttl_sec: float,
    robot_listener_ttl_sec: float,
    auth_token: str = "",
) -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app["auth_token"] = auth_token.strip()
    app["broker"] = ControlSignalingBroker(
        offer_timeout_sec=offer_timeout_sec,
        monitor_ttl_sec=monitor_ttl_sec,
        robot_listener_ttl_sec=robot_listener_ttl_sec,
    )
    app.router.add_get("/control/webrtc/health", api_health)
    app.router.add_get("/control/webrtc/status", api_status)
    app.router.add_post("/control/webrtc/frontend-offer", api_frontend_offer)
    app.router.add_get("/control/webrtc/compute-next-offer", api_compute_next_offer)
    app.router.add_post("/control/webrtc/compute-answer", api_compute_answer)
    # Temporary aliases for devices that have not migrated to the v2 names yet.
    app.router.add_post("/control/webrtc/browser-offer", api_browser_offer)
    app.router.add_get("/control/webrtc/robot-next-offer", api_robot_next_offer)
    app.router.add_get("/control/webrtc/robot-listener-heartbeat", api_robot_listener_heartbeat)
    app.router.add_post("/control/webrtc/robot-listener-heartbeat", api_robot_listener_heartbeat)
    app.router.add_post("/control/webrtc/robot-answer", api_robot_answer)
    app.router.add_post("/command/webrtc/compute-offer", api_compute_command_offer)
    app.router.add_get("/command/webrtc/edge-next-offer", api_edge_next_command_offer)
    app.router.add_post("/command/webrtc/edge-answer", api_edge_command_answer)
    app.router.add_post("/control/monitor/key-state", api_monitor_key_state_post)
    app.router.add_get("/control/monitor/key-state", api_monitor_key_state_get)
    app.router.add_route("OPTIONS", "/{tail:.*}", lambda request: web.Response(status=204))
    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="HTTP signaling broker for frontend<->compute and compute<->edge WebRTC pairing.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", default=18085, type=int, help="Port to bind")
    parser.add_argument(
        "--offer-timeout-sec",
        default=0.0,
        type=float,
        help="Browser offer wait timeout in seconds; 0 disables the app-level timeout",
    )
    parser.add_argument("--monitor-ttl-sec", default=1.2, type=float, help="Monitor client state TTL")
    parser.add_argument(
        "--robot-listener-ttl-sec",
        default=10.0,
        type=float,
        help="How long a robot_client_id keeps the exclusive listener slot after its latest poll",
    )
    parser.add_argument("--auth-token-env", default="TELEBOT_CONTROL_SIGNAL_TOKEN")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    offer_timeout_sec = None if float(args.offer_timeout_sec) <= 0 else max(1.0, float(args.offer_timeout_sec))
    auth_token = os.getenv(str(args.auth_token_env), "").strip()
    web.run_app(
        create_app(
            offer_timeout_sec=offer_timeout_sec,
            monitor_ttl_sec=max(0.5, float(args.monitor_ttl_sec)),
            robot_listener_ttl_sec=max(1.0, float(args.robot_listener_ttl_sec)),
            auth_token=auth_token,
        ),
        host=args.host,
        port=args.port,
        handle_signals=True,
    )


if __name__ == "__main__":
    main()
