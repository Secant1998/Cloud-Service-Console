#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import fcntl
import json
import math
import os
import random
import re
import time
from pathlib import Path


ACTIVE_TTL_SECONDS = 8.0
COUNTDOWN_SECONDS = 3.0
DEFAULT_ROOM = "main"

ARENA_X = 92.0
ARENA_Y = 72.0
ARENA_WIDTH = 1096.0
ARENA_HEIGHT = 656.0
WALL_THICKNESS = 18.0
PLAYER_RADIUS = 20.0
TARGET_RADIUS = 18.0
BULLET_RADIUS = 5.0
PLAYER_TURN_SPEED = 2.15
LOGICAL_GRID_COLS = 9
LOGICAL_GRID_ROWS = 6
LOGICAL_GRID_SIZE = min(ARENA_WIDTH / LOGICAL_GRID_COLS, ARENA_HEIGHT / LOGICAL_GRID_ROWS)
PLAYER_SPEED = LOGICAL_GRID_SIZE * 1.6
BULLET_SPEED = LOGICAL_GRID_SIZE * 1.85
BULLET_LIFE = 10.0
BULLET_BOUNCES = 7
SHOOT_COOLDOWN = 0.24
MAX_BULLETS = 5
SELF_HIT_ARM_DELAY = 0.16

LATENCY_CLONE_NAME = "RelayBot"
LATENCY_CLONE_COUNTRY = "US"


def now_ms() -> int:
    return int(time.time() * 1000)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def distance(a_x: float, a_y: float, b_x: float, b_y: float) -> float:
    return math.hypot(a_x - b_x, a_y - b_y)


def normalize_player_id(raw_value: object) -> str:
    text = str(raw_value or "").strip()
    if not text:
        raise RuntimeError("player_id is required.")
    return text[:32]


def normalize_country_code(raw_value: object) -> str:
    text = str(raw_value or "").strip().upper()
    return re.sub(r"[^A-Z-]", "", text)[:12]


def normalize_room_name(raw_value: object) -> str:
    text = str(raw_value or "").strip().lower()
    text = re.sub(r"[^a-z0-9._-]", "-", text).strip("-")
    return text or DEFAULT_ROOM


def normalize_color(raw_value: object) -> str:
    value = str(raw_value or "").strip().lower()
    if value in {"red", "blue", "yellow"}:
        return value
    return "green"


def pick_clone_color(local_color: str) -> str:
    for color in ("red", "blue", "yellow", "green"):
        if color != local_color:
            return color
    return "red"


def create_seeded_random(seed: int):
    state = seed & 0xFFFFFFFF

    def rng() -> float:
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 0x100000000

    return rng


def generate_map_seed() -> int:
    return random.SystemRandom().getrandbits(32) or 1


def map_id_from_seed(seed: int) -> str:
    return f"MAP-{seed & 0xFFFF:04X}"


def rects_intersect(a: dict[str, float], b: dict[str, float], padding: float = 0.0) -> bool:
    return (
        a["x"] < b["x"] + b["w"] + padding
        and a["x"] + a["w"] > b["x"] - padding
        and a["y"] < b["y"] + b["h"] + padding
        and a["y"] + a["h"] > b["y"] - padding
    )


def circle_intersects_rect(circle: dict[str, float], rect: dict[str, float]) -> bool:
    closest_x = clamp(circle["x"], rect["x"], rect["x"] + rect["w"])
    closest_y = clamp(circle["y"], rect["y"], rect["y"] + rect["h"])
    return distance(circle["x"], circle["y"], closest_x, closest_y) < circle["radius"]


def create_outer_walls() -> list[dict[str, float]]:
    return [
        {
            "x": ARENA_X - WALL_THICKNESS,
            "y": ARENA_Y - WALL_THICKNESS,
            "w": ARENA_WIDTH + WALL_THICKNESS * 2,
            "h": WALL_THICKNESS,
        },
        {
            "x": ARENA_X - WALL_THICKNESS,
            "y": ARENA_Y + ARENA_HEIGHT,
            "w": ARENA_WIDTH + WALL_THICKNESS * 2,
            "h": WALL_THICKNESS,
        },
        {
            "x": ARENA_X - WALL_THICKNESS,
            "y": ARENA_Y,
            "w": WALL_THICKNESS,
            "h": ARENA_HEIGHT,
        },
        {
            "x": ARENA_X + ARENA_WIDTH,
            "y": ARENA_Y,
            "w": WALL_THICKNESS,
            "h": ARENA_HEIGHT,
        },
    ]


def build_training_walls(seed: int) -> list[dict[str, float]]:
    rng = create_seeded_random(seed)
    walls = create_outer_walls()
    safe_zones = [
        {"x": ARENA_X + 24, "y": ARENA_Y + 24, "w": 180, "h": 140},
        {"x": ARENA_X + ARENA_WIDTH - 204, "y": ARENA_Y + ARENA_HEIGHT - 164, "w": 180, "h": 140},
    ]
    grid_cols = 9
    grid_rows = 6
    cell_width = ARENA_WIDTH / grid_cols
    cell_height = ARENA_HEIGHT / grid_rows

    def try_add_wall(wall: dict[str, float]) -> None:
        if any(rects_intersect(wall, zone, 28) for zone in safe_zones):
            return
        if any(rects_intersect(wall, existing, 6) for existing in walls):
            return
        walls.append(wall)

    for row in range(grid_rows):
        for col in range(grid_cols):
            center_x = ARENA_X + cell_width * (col + 0.5)
            center_y = ARENA_Y + cell_height * (row + 0.5)
            horizontal_length = cell_width * (1.24 if rng() > 0.56 else 0.84)
            vertical_length = cell_height * (1.2 if rng() > 0.58 else 0.82)

            if rng() < 0.19:
                try_add_wall(
                    {
                        "x": center_x - horizontal_length / 2,
                        "y": center_y - WALL_THICKNESS / 2,
                        "w": horizontal_length,
                        "h": WALL_THICKNESS,
                    }
                )

            if rng() < 0.17:
                try_add_wall(
                    {
                        "x": center_x - WALL_THICKNESS / 2,
                        "y": center_y - vertical_length / 2,
                        "w": WALL_THICKNESS,
                        "h": vertical_length,
                    }
                )

            if rng() < 0.065:
                try_add_wall({"x": center_x - 22, "y": center_y - 22, "w": 44, "h": 44})

    try_add_wall(
        {
            "x": ARENA_X + ARENA_WIDTH * 0.46,
            "y": ARENA_Y + ARENA_HEIGHT * 0.18,
            "w": 24,
            "h": ARENA_HEIGHT * 0.26,
        }
    )
    try_add_wall(
        {
            "x": ARENA_X + ARENA_WIDTH * 0.32,
            "y": ARENA_Y + ARENA_HEIGHT * 0.56,
            "w": ARENA_WIDTH * 0.18,
            "h": 20,
        }
    )
    try_add_wall(
        {
            "x": ARENA_X + ARENA_WIDTH * 0.62,
            "y": ARENA_Y + ARENA_HEIGHT * 0.54,
            "w": ARENA_WIDTH * 0.18,
            "h": 20,
        }
    )
    return walls


def pick_spawn_point(
    rng,
    walls: list[dict[str, float]],
    occupied: list[dict[str, float]],
    radius: float,
    preferred_band: dict[str, float] | None = None,
) -> dict[str, float]:
    for _ in range(360):
        min_x = preferred_band.get("minX", ARENA_X + 34) if preferred_band else ARENA_X + 34
        max_x = preferred_band.get("maxX", ARENA_X + ARENA_WIDTH - 34) if preferred_band else ARENA_X + ARENA_WIDTH - 34
        min_y = preferred_band.get("minY", ARENA_Y + 34) if preferred_band else ARENA_Y + 34
        max_y = preferred_band.get("maxY", ARENA_Y + ARENA_HEIGHT - 34) if preferred_band else ARENA_Y + ARENA_HEIGHT - 34
        x = min_x + rng() * max(1.0, max_x - min_x)
        y = min_y + rng() * max(1.0, max_y - min_y)
        candidate = {"x": x, "y": y, "radius": radius}
        if any(circle_intersects_rect(candidate, wall) for wall in walls):
            continue
        blocked = False
        for circle in occupied:
            if distance(circle["x"], circle["y"], x, y) < circle["radius"] + radius + 30:
                blocked = True
                break
        if blocked:
            continue
        return candidate
    return {"x": ARENA_X + 100, "y": ARENA_Y + 100, "radius": radius}


def build_default_state(room: str) -> dict[str, object]:
    seed = generate_map_seed()
    return {
        "room": room,
        "map_seed": seed,
        "map_id": map_id_from_seed(seed),
        "votes": {},
        "players": {},
        "latency_tests": {},
        "countdown_deadline_ms": 0,
        "updated_at_ms": now_ms(),
    }


def load_state(state_path: Path, room: str) -> dict[str, object]:
    if not state_path.exists():
        return build_default_state(room)

    try:
        payload = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        return build_default_state(room)

    if not isinstance(payload, dict):
        return build_default_state(room)

    payload["room"] = room
    payload.setdefault("votes", {})
    payload.setdefault("players", {})
    payload.setdefault("latency_tests", {})
    payload.setdefault("countdown_deadline_ms", 0)
    payload.setdefault("updated_at_ms", now_ms())
    if not payload.get("map_seed"):
        payload["map_seed"] = generate_map_seed()
    if not payload.get("map_id"):
        payload["map_id"] = map_id_from_seed(int(payload["map_seed"]))
    return payload


def prune_players(state: dict[str, object], current_ms: int) -> None:
    players = state.get("players")
    if not isinstance(players, dict):
        players = {}
        state["players"] = players

    cutoff_ms = current_ms - int(ACTIVE_TTL_SECONDS * 1000)
    stale_player_ids: list[str] = []
    for player_id, player_meta in list(players.items()):
        if not isinstance(player_meta, dict):
            stale_player_ids.append(str(player_id))
            continue
        if int(player_meta.get("last_seen_ms") or 0) < cutoff_ms:
            stale_player_ids.append(str(player_id))

    for player_id in stale_player_ids:
        players.pop(player_id, None)

    votes = state.get("votes")
    if not isinstance(votes, dict):
        votes = {}
        state["votes"] = votes
    for player_id in list(votes.keys()):
        if player_id not in players:
            votes.pop(player_id, None)

    latency_tests = state.get("latency_tests")
    if not isinstance(latency_tests, dict):
        latency_tests = {}
        state["latency_tests"] = latency_tests
    for player_id in list(latency_tests.keys()):
        if player_id not in players:
            latency_tests.pop(player_id, None)


def update_player(state: dict[str, object], player_id: str, country_code: str, current_ms: int) -> None:
    players = state.setdefault("players", {})
    if not isinstance(players, dict):
        players = {}
        state["players"] = players

    current = players.get(player_id)
    joined_at_ms = current.get("joined_at_ms") if isinstance(current, dict) else current_ms
    players[player_id] = {
        "player_id": player_id,
        "country_code": country_code,
        "joined_at_ms": int(joined_at_ms or current_ms),
        "last_seen_ms": current_ms,
    }


def refresh_vote_state(state: dict[str, object], current_ms: int) -> None:
    prune_players(state, current_ms)

    players = state.get("players")
    votes = state.get("votes")
    if not isinstance(players, dict):
        players = {}
    if not isinstance(votes, dict):
        votes = {}
        state["votes"] = votes

    active_player_ids = sorted(players.keys())
    all_voted = bool(active_player_ids) and all(player_id in votes for player_id in active_player_ids)

    if not all_voted:
        if state.get("countdown_deadline_ms"):
            state["countdown_deadline_ms"] = 0
            state["updated_at_ms"] = current_ms
        return

    countdown_deadline_ms = int(state.get("countdown_deadline_ms") or 0)
    if countdown_deadline_ms <= 0:
        state["countdown_deadline_ms"] = current_ms + int(COUNTDOWN_SECONDS * 1000)
        state["updated_at_ms"] = current_ms
        return

    if current_ms < countdown_deadline_ms:
        return

    next_seed = generate_map_seed()
    state["map_seed"] = next_seed
    state["map_id"] = map_id_from_seed(next_seed)
    state["votes"] = {}
    state["countdown_deadline_ms"] = 0
    state["latency_tests"] = {}
    state["updated_at_ms"] = current_ms


def build_response(state: dict[str, object], room: str, player_id: str, current_ms: int) -> dict[str, object]:
    players = state.get("players")
    votes = state.get("votes")
    if not isinstance(players, dict):
        players = {}
    if not isinstance(votes, dict):
        votes = {}

    active_player_ids = sorted(players.keys())
    voted_player_ids = [entry for entry in active_player_ids if entry in votes]
    countdown_deadline_ms = int(state.get("countdown_deadline_ms") or 0)
    countdown_active = countdown_deadline_ms > current_ms
    countdown_seconds = max(0, int(math.ceil((countdown_deadline_ms - current_ms) / 1000))) if countdown_active else 0

    return {
        "ok": True,
        "room": room,
        "map_seed": int(state.get("map_seed") or 1),
        "map_id": str(state.get("map_id") or map_id_from_seed(int(state.get("map_seed") or 1))),
        "active_player_ids": active_player_ids,
        "active_player_count": len(active_player_ids),
        "voted_player_ids": voted_player_ids,
        "vote_count": len(voted_player_ids),
        "vote_required": len(active_player_ids),
        "countdown_seconds": countdown_seconds,
        "countdown_active": countdown_active,
        "countdown_deadline_ms": countdown_deadline_ms if countdown_active else 0,
        "local_player_voted": player_id in votes,
        "local_player_color": "green",
        "updated_at_ms": int(state.get("updated_at_ms") or current_ms),
    }


def normalize_latency_input(raw_value: object) -> dict[str, object]:
    payload = raw_value if isinstance(raw_value, dict) else {}
    return {
        "forward": bool(payload.get("forward")),
        "backward": bool(payload.get("backward")),
        "left": bool(payload.get("left")),
        "right": bool(payload.get("right")),
        "fire_seq": int(payload.get("fire_seq") or 0),
        "clone_hit_seq": int(payload.get("clone_hit_seq") or 0),
    }


def normalize_latency_player(raw_value: object) -> dict[str, float]:
    if not isinstance(raw_value, dict):
        raise RuntimeError("local_player is required.")
    return {
        "x": float(raw_value.get("x") or 0.0),
        "y": float(raw_value.get("y") or 0.0),
        "angle": float(raw_value.get("angle") or 0.0),
        "radius": float(raw_value.get("radius") or PLAYER_RADIUS),
    }


def normalize_latency_targets(raw_value: object) -> list[dict[str, float]]:
    if not isinstance(raw_value, list):
        return []
    targets: list[dict[str, float]] = []
    for entry in raw_value:
        if not isinstance(entry, dict):
            continue
        targets.append(
            {
                "id": int(entry.get("id") or 0),
                "x": float(entry.get("x") or 0.0),
                "y": float(entry.get("y") or 0.0),
                "radius": float(entry.get("radius") or TARGET_RADIUS),
                "phase": float(entry.get("phase") or 0.0),
            }
        )
    return targets


def create_latency_clone_state(map_seed: int, local_color: str, current_ms: int) -> dict[str, object]:
    walls = build_training_walls(map_seed)
    rng = create_seeded_random((map_seed ^ 0x6F3A2C91) & 0xFFFFFFFF)
    spawn = pick_spawn_point(
        rng,
        walls,
        [],
        PLAYER_RADIUS,
        {
            "minX": ARENA_X + ARENA_WIDTH * 0.58,
            "maxX": ARENA_X + ARENA_WIDTH - 44,
            "minY": ARENA_Y + 44,
            "maxY": ARENA_Y + ARENA_HEIGHT * 0.48,
        },
    )
    return {
        "player_id": LATENCY_CLONE_NAME,
        "country_code": LATENCY_CLONE_COUNTRY,
        "local_color": local_color,
        "color": pick_clone_color(local_color),
        "map_seed": map_seed,
        "x": float(spawn["x"]),
        "y": float(spawn["y"]),
        "angle": math.pi,
        "radius": PLAYER_RADIUS,
        "cooldown": SHOOT_COOLDOWN * 0.9,
        "flash": 0.0,
        "bullets": [],
        "next_bullet_id": 1,
        "last_fire_seq": 0,
        "last_ack_input_seq": 0,
        "last_clone_hit_seq": 0,
        "local_player_hit_seq": 0,
        "clone_reset_seq": 0,
        "snapshot_seq": 0,
        "last_tick_ms": current_ms,
        "updated_at_ms": current_ms,
    }


def ensure_latency_tests(state: dict[str, object]) -> dict[str, object]:
    latency_tests = state.setdefault("latency_tests", {})
    if not isinstance(latency_tests, dict):
        latency_tests = {}
        state["latency_tests"] = latency_tests
    return latency_tests


def try_move_entity(entity: dict[str, object], next_x: float, next_y: float, walls: list[dict[str, float]]) -> bool:
    radius = float(entity.get("radius") or PLAYER_RADIUS)
    min_x = ARENA_X + radius
    max_x = ARENA_X + ARENA_WIDTH - radius
    min_y = ARENA_Y + radius
    max_y = ARENA_Y + ARENA_HEIGHT - radius
    candidate_x = clamp(next_x, min_x, max_x)
    candidate_y = clamp(next_y, min_y, max_y)
    circle = {"x": candidate_x, "y": candidate_y, "radius": radius + 0.75}
    if any(circle_intersects_rect(circle, wall) for wall in walls):
        return False
    entity["x"] = candidate_x
    entity["y"] = candidate_y
    return True


def resolve_entity_position(entity: dict[str, object], delta_x: float, delta_y: float, walls: list[dict[str, float]]) -> None:
    travel = math.hypot(delta_x, delta_y)
    steps = max(1, int(math.ceil(travel / 3.0)))
    step_x = delta_x / steps
    step_y = delta_y / steps
    for _ in range(steps):
        current_x = float(entity.get("x") or 0.0)
        current_y = float(entity.get("y") or 0.0)
        if try_move_entity(entity, current_x + step_x, current_y + step_y, walls):
            continue
        moved_x = step_x != 0 and try_move_entity(entity, current_x + step_x, current_y, walls)
        moved_y = step_y != 0 and try_move_entity(entity, current_x, current_y + step_y, walls)
        if moved_x or moved_y:
            continue


def respawn_latency_clone(
    test_state: dict[str, object],
    map_seed: int,
    current_ms: int,
    *,
    increment_reset_seq: bool = True,
) -> None:
    previous_last_fire_seq = int(test_state.get("last_fire_seq") or 0)
    previous_last_ack_input_seq = int(test_state.get("last_ack_input_seq") or 0)
    previous_last_clone_hit_seq = int(test_state.get("last_clone_hit_seq") or 0)
    previous_local_player_hit_seq = int(test_state.get("local_player_hit_seq") or 0)
    previous_next_bullet_id = int(test_state.get("next_bullet_id") or 1)
    previous_clone_reset_seq = int(test_state.get("clone_reset_seq") or 0)
    previous_snapshot_seq = int(test_state.get("snapshot_seq") or 0)
    replacement = create_latency_clone_state(map_seed, normalize_color(test_state.get("local_color")), current_ms)
    replacement["last_fire_seq"] = previous_last_fire_seq
    replacement["last_ack_input_seq"] = previous_last_ack_input_seq
    replacement["last_clone_hit_seq"] = previous_last_clone_hit_seq
    replacement["local_player_hit_seq"] = previous_local_player_hit_seq
    replacement["next_bullet_id"] = max(int(replacement.get("next_bullet_id") or 1), previous_next_bullet_id)
    replacement["clone_reset_seq"] = previous_clone_reset_seq + (1 if increment_reset_seq else 0)
    replacement["snapshot_seq"] = previous_snapshot_seq
    test_state.update(replacement)
    test_state["color"] = replacement["color"]
    test_state["updated_at_ms"] = current_ms


def respawn_latency_target(
    target_id: int,
    targets: list[dict[str, float]],
    local_player: dict[str, float],
    clone_state: dict[str, object],
    walls: list[dict[str, float]],
    map_seed: int,
    current_ms: int,
) -> dict[str, float]:
    occupied: list[dict[str, float]] = [
        {"x": local_player["x"], "y": local_player["y"], "radius": local_player["radius"] + 32},
        {"x": float(clone_state.get("x") or 0.0), "y": float(clone_state.get("y") or 0.0), "radius": PLAYER_RADIUS + 26},
    ]
    for target in targets:
        if int(target["id"]) == target_id:
            continue
        occupied.append({"x": target["x"], "y": target["y"], "radius": target["radius"] + 18})

    rng = create_seeded_random((map_seed ^ target_id ^ (current_ms & 0xFFFFFFFF) ^ 0x5E3F9AB1) & 0xFFFFFFFF)
    spawn = pick_spawn_point(
        rng,
        walls,
        occupied,
        TARGET_RADIUS,
        {
            "minX": ARENA_X + 80,
            "maxX": ARENA_X + ARENA_WIDTH - 80,
            "minY": ARENA_Y + 70,
            "maxY": ARENA_Y + ARENA_HEIGHT - 70,
        },
    )
    return {
        "id": target_id,
        "x": float(spawn["x"]),
        "y": float(spawn["y"]),
        "radius": TARGET_RADIUS,
        "phase": rng() * math.pi * 2.0,
    }


def simulate_latency_test(
    room_state: dict[str, object],
    payload: dict[str, object],
    current_ms: int,
) -> dict[str, object]:
    room = normalize_room_name(payload.get("room"))
    player_id = normalize_player_id(payload.get("player_id"))
    country_code = normalize_country_code(payload.get("country_code"))
    local_color = normalize_color(payload.get("local_color"))
    input_seq = max(0, int(payload.get("input_seq") or 0))
    local_player = normalize_latency_player(payload.get("local_player"))
    targets = normalize_latency_targets(payload.get("targets"))
    input_state = normalize_latency_input(payload.get("input"))
    map_seed = int(room_state.get("map_seed") or payload.get("map_seed") or 1)

    update_player(room_state, player_id, country_code, current_ms)
    refresh_vote_state(room_state, current_ms)

    latency_tests = ensure_latency_tests(room_state)
    existing = latency_tests.get(player_id)
    if not isinstance(existing, dict) or int(existing.get("map_seed") or 0) != map_seed:
        existing = create_latency_clone_state(map_seed, local_color, current_ms)
        latency_tests[player_id] = existing

    test_state = existing
    test_state["last_ack_input_seq"] = max(int(test_state.get("last_ack_input_seq") or 0), input_seq)
    if input_state["clone_hit_seq"] > int(test_state.get("last_clone_hit_seq") or 0):
        test_state["last_clone_hit_seq"] = int(input_state["clone_hit_seq"])
        respawn_latency_clone(test_state, map_seed, current_ms)

    walls = build_training_walls(map_seed)
    last_tick_ms = int(test_state.get("last_tick_ms") or current_ms)
    elapsed_sec = max(0.0, min(0.32, (current_ms - last_tick_ms) / 1000.0))
    remaining = elapsed_sec
    target_respawns: list[dict[str, float]] = []
    fire_events: list[dict[str, float | int]] = []

    while remaining > 0:
        step = min(0.016, remaining)
        remaining -= step

        test_state["cooldown"] = max(0.0, float(test_state.get("cooldown") or 0.0) - step)
        test_state["flash"] = max(0.0, float(test_state.get("flash") or 0.0) - step)

        turn_intent = (1 if input_state["right"] else 0) - (1 if input_state["left"] else 0)
        move_intent = (1 if input_state["forward"] else 0) - (1 if input_state["backward"] else 0)
        test_state["angle"] = float(test_state.get("angle") or 0.0) + turn_intent * PLAYER_TURN_SPEED * step

        delta_x = math.cos(float(test_state["angle"])) * move_intent * PLAYER_SPEED * step
        delta_y = math.sin(float(test_state["angle"])) * move_intent * PLAYER_SPEED * step
        resolve_entity_position(test_state, delta_x, delta_y, walls)

        raw_bullets = test_state.get("bullets")
        active_bullets = raw_bullets if isinstance(raw_bullets, list) else []
        if (
            input_state["fire_seq"] > int(test_state.get("last_fire_seq") or 0)
            and float(test_state.get("cooldown") or 0.0) <= 0
            and len(active_bullets) < MAX_BULLETS
        ):
            bullet_id = int(test_state.get("next_bullet_id") or 1)
            clone_angle = float(test_state["angle"])
            spawn_x = float(test_state["x"]) + math.cos(float(test_state["angle"])) * (PLAYER_RADIUS + 12)
            spawn_y = float(test_state["y"]) + math.sin(float(test_state["angle"])) * (PLAYER_RADIUS + 12)
            bullets = test_state.setdefault("bullets", [])
            if isinstance(bullets, list):
                bullets.append(
                    {
                        "id": bullet_id,
                        "x": spawn_x,
                        "y": spawn_y,
                        "radius": BULLET_RADIUS,
                        "vx": math.cos(clone_angle) * BULLET_SPEED,
                        "vy": math.sin(clone_angle) * BULLET_SPEED,
                        "life": BULLET_LIFE,
                        "bouncesLeft": BULLET_BOUNCES,
                        "age": 0.0,
                    }
                )
                fire_events.append(
                    {
                        "id": bullet_id,
                        "x": spawn_x,
                        "y": spawn_y,
                        "angle": clone_angle,
                        "speed": BULLET_SPEED,
                        "radius": BULLET_RADIUS,
                    }
                )
                test_state["next_bullet_id"] = bullet_id + 1
            test_state["cooldown"] = SHOOT_COOLDOWN
            test_state["flash"] = 0.13
            test_state["last_fire_seq"] = int(input_state["fire_seq"])

        next_bullets: list[dict[str, float | int]] = []
        raw_bullets = test_state.get("bullets")
        bullets_iterable = raw_bullets if isinstance(raw_bullets, list) else []
        for bullet in bullets_iterable:
            if not isinstance(bullet, dict):
                continue
            previous_x = float(bullet.get("x") or 0.0)
            previous_y = float(bullet.get("y") or 0.0)
            next_bullet = {
                "id": int(bullet.get("id") or 0),
                "x": previous_x + float(bullet.get("vx") or 0.0) * step,
                "y": previous_y + float(bullet.get("vy") or 0.0) * step,
                "radius": float(bullet.get("radius") or BULLET_RADIUS),
                "vx": float(bullet.get("vx") or 0.0),
                "vy": float(bullet.get("vy") or 0.0),
                "life": float(bullet.get("life") or 0.0) - step,
                "bouncesLeft": int(bullet.get("bouncesLeft") or 0),
                "age": float(bullet.get("age") or 0.0) + step,
            }

            for wall in walls:
                expanded = {
                    "x": wall["x"] - next_bullet["radius"],
                    "y": wall["y"] - next_bullet["radius"],
                    "w": wall["w"] + next_bullet["radius"] * 2,
                    "h": wall["h"] + next_bullet["radius"] * 2,
                }
                inside_expanded = (
                    next_bullet["x"] > expanded["x"]
                    and next_bullet["x"] < expanded["x"] + expanded["w"]
                    and next_bullet["y"] > expanded["y"]
                    and next_bullet["y"] < expanded["y"] + expanded["h"]
                )
                if not inside_expanded:
                    continue

                flip_x = previous_x <= expanded["x"] or previous_x >= expanded["x"] + expanded["w"]
                flip_y = previous_y <= expanded["y"] or previous_y >= expanded["y"] + expanded["h"]
                if not flip_x and not flip_y:
                    distance_left = abs(next_bullet["x"] - expanded["x"])
                    distance_right = abs(expanded["x"] + expanded["w"] - next_bullet["x"])
                    distance_top = abs(next_bullet["y"] - expanded["y"])
                    distance_bottom = abs(expanded["y"] + expanded["h"] - next_bullet["y"])
                    if min(distance_left, distance_right) <= min(distance_top, distance_bottom):
                        flip_x = True
                    else:
                        flip_y = True

                if flip_x:
                    next_bullet["vx"] *= -1
                if flip_y:
                    next_bullet["vy"] *= -1
                next_bullet["bouncesLeft"] -= 1
                next_bullet["x"] = previous_x + next_bullet["vx"] * step * 0.4
                next_bullet["y"] = previous_y + next_bullet["vy"] * step * 0.4
                break

            if (
                next_bullet["life"] <= 0
                or next_bullet["bouncesLeft"] < 0
                or next_bullet["x"] < ARENA_X - 64
                or next_bullet["x"] > ARENA_X + ARENA_WIDTH + 64
                or next_bullet["y"] < ARENA_Y - 64
                or next_bullet["y"] > ARENA_Y + ARENA_HEIGHT + 64
            ):
                continue

            hit_target_index = -1
            for index, target in enumerate(targets):
                if distance(target["x"], target["y"], float(next_bullet["x"]), float(next_bullet["y"])) < target["radius"] + float(next_bullet["radius"]):
                    hit_target_index = index
                    break
            if hit_target_index >= 0:
                target_id = int(targets[hit_target_index]["id"])
                respawned = respawn_latency_target(target_id, targets, local_player, test_state, walls, map_seed, current_ms)
                targets[hit_target_index] = respawned
                target_respawns.append(
                    {
                        "id": target_id,
                        "x": respawned["x"],
                        "y": respawned["y"],
                        "phase": respawned["phase"],
                    }
                )
                continue

            if (
                next_bullet["age"] >= SELF_HIT_ARM_DELAY
                and distance(local_player["x"], local_player["y"], float(next_bullet["x"]), float(next_bullet["y"]))
                < local_player["radius"] + float(next_bullet["radius"])
            ):
                test_state["local_player_hit_seq"] = int(test_state.get("local_player_hit_seq") or 0) + 1
                continue

            if (
                next_bullet["age"] >= SELF_HIT_ARM_DELAY
                and distance(float(test_state["x"]), float(test_state["y"]), float(next_bullet["x"]), float(next_bullet["y"]))
                < PLAYER_RADIUS + float(next_bullet["radius"])
            ):
                respawn_latency_clone(test_state, map_seed, current_ms)
                continue

            next_bullets.append(next_bullet)

        test_state["bullets"] = next_bullets

    test_state["last_tick_ms"] = current_ms
    test_state["updated_at_ms"] = current_ms
    test_state["snapshot_seq"] = int(test_state.get("snapshot_seq") or 0) + 1
    room_state["updated_at_ms"] = current_ms

    return {
        "ok": True,
        "room": room,
        "ack_input_seq": int(test_state.get("last_ack_input_seq") or 0),
        "snapshot_seq": int(test_state.get("snapshot_seq") or 0),
        "clone": {
            "player_id": str(test_state.get("player_id") or LATENCY_CLONE_NAME),
            "country_code": str(test_state.get("country_code") or LATENCY_CLONE_COUNTRY),
            "color": str(test_state.get("color") or "red"),
            "x": float(test_state.get("x") or 0.0),
            "y": float(test_state.get("y") or 0.0),
            "angle": float(test_state.get("angle") or 0.0),
            "radius": float(test_state.get("radius") or PLAYER_RADIUS),
            "flash": float(test_state.get("flash") or 0.0),
        },
        "clone_input": input_state,
        "fire_events": fire_events,
        "clone_reset_seq": int(test_state.get("clone_reset_seq") or 0),
        "bullets": [
            {
                "id": int(bullet.get("id") or 0),
                "x": float(bullet.get("x") or 0.0),
                "y": float(bullet.get("y") or 0.0),
                "radius": float(bullet.get("radius") or BULLET_RADIUS),
            }
            for bullet in test_state.get("bullets", [])
            if isinstance(bullet, dict)
        ],
        "target_respawns": target_respawns,
        "local_player_hit_seq": int(test_state.get("local_player_hit_seq") or 0),
        "clone_hit_ack_seq": int(test_state.get("last_clone_hit_seq") or 0),
        "updated_at_ms": current_ms,
    }


def apply_action(state: dict[str, object], payload: dict[str, object], current_ms: int) -> tuple[str, str]:
    room = normalize_room_name(payload.get("room"))
    action = str(payload.get("action") or "sync").strip().lower()
    player_id = normalize_player_id(payload.get("player_id"))
    country_code = normalize_country_code(payload.get("country_code"))

    update_player(state, player_id, country_code, current_ms)

    votes = state.setdefault("votes", {})
    if not isinstance(votes, dict):
        votes = {}
        state["votes"] = votes

    if action == "leave":
        players = state.get("players")
        if isinstance(players, dict):
            players.pop(player_id, None)
        votes.pop(player_id, None)
        latency_tests = ensure_latency_tests(state)
        latency_tests.pop(player_id, None)
        state["countdown_deadline_ms"] = 0
        state["updated_at_ms"] = current_ms
    elif action == "toggle_vote":
        if player_id in votes:
            votes.pop(player_id, None)
        else:
            votes[player_id] = current_ms
        state["updated_at_ms"] = current_ms
    elif action == "latency_leave":
        players = state.get("players")
        if isinstance(players, dict):
            players.pop(player_id, None)
        votes.pop(player_id, None)
        latency_tests = ensure_latency_tests(state)
        latency_tests.pop(player_id, None)
        state["countdown_deadline_ms"] = 0
        state["updated_at_ms"] = current_ms
    elif action == "latency_sync":
        state["updated_at_ms"] = current_ms
    elif action != "sync":
        raise RuntimeError(f"Unsupported action: {action}")

    refresh_vote_state(state, current_ms)
    return room, player_id


def parse_payload() -> dict[str, object]:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload-b64", required=True)
    args = parser.parse_args()

    try:
        raw_payload = base64.urlsafe_b64decode(args.payload_b64.encode("ascii"))
        payload = json.loads(raw_payload.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("payload-b64 could not be decoded.") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("Payload must be a JSON object.")
    return payload


def handle_request_payload(payload: dict[str, object], base_dir: Path) -> dict[str, object]:
    room = normalize_room_name(payload.get("room"))
    action = str(payload.get("action") or "sync").strip().lower()
    state_path = base_dir / f"room-state-{room}.json"
    state_path.parent.mkdir(parents=True, exist_ok=True)

    with state_path.open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            handle.seek(0)
            state = load_state(state_path, room)
            current_ms = now_ms()
            room, player_id = apply_action(state, payload, current_ms)

            if action == "latency_sync":
                response = simulate_latency_test(state, payload, current_ms)
            elif action == "latency_leave":
                response = {"ok": True, "message": "latency test removed"}
            else:
                response = build_response(state, room, player_id, current_ms)

            handle.seek(0)
            handle.truncate()
            handle.write(json.dumps(state, ensure_ascii=False, separators=(",", ":")))
            handle.flush()
            os.fsync(handle.fileno())
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    return response


def main() -> None:
    payload = parse_payload()
    base_dir = Path(__file__).resolve().parent
    response = handle_request_payload(payload, base_dir)
    print(json.dumps(response, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Persistent HTTP server mode (--serve)
# ---------------------------------------------------------------------------

SERVER_IDLE_TIMEOUT = 30
_server_last_activity: float = 0.0
_server_shutdown_flag = False


def _touch_activity() -> None:
    global _server_last_activity
    _server_last_activity = time.time()


def _check_has_active_players(base_dir: Path) -> bool:
    for state_file in base_dir.glob("room-state-*.json"):
        try:
            data = json.loads(state_file.read_text(encoding="utf-8"))
        except Exception:
            continue
        players = data.get("players")
        if isinstance(players, dict) and players:
            return True
        latency_tests = data.get("latency_tests")
        if isinstance(latency_tests, dict) and latency_tests:
            return True
    return False


def _make_handler(base_dir: Path, idle_timeout: int):
    from http.server import BaseHTTPRequestHandler

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass

        def _send_json(self, status: int, body: dict) -> None:
            payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _read_body(self) -> bytes:
            length = int(self.headers.get("Content-Length") or 0)
            return self.rfile.read(length) if length > 0 else b""

        def do_GET(self) -> None:
            _touch_activity()
            if self.path == "/health":
                self._send_json(200, {"ok": True, "idle_timeout": idle_timeout})
            else:
                self._send_json(404, {"ok": False, "message": "not found"})

        def do_POST(self) -> None:
            global _server_shutdown_flag
            _touch_activity()

            raw = self._read_body()
            try:
                payload = json.loads(raw) if raw else {}
            except Exception:
                self._send_json(400, {"ok": False, "message": "invalid JSON"})
                return

            if not isinstance(payload, dict):
                self._send_json(400, {"ok": False, "message": "payload must be object"})
                return

            path = self.path.rstrip("/")

            if path == "/latency/sync":
                payload["action"] = "latency_sync"
            elif path == "/latency/leave":
                payload["action"] = "latency_leave"
            elif path == "/room/sync":
                payload.setdefault("action", "sync")
            elif path == "/room/vote-toggle":
                payload["action"] = "toggle_vote"
            elif path == "/room/leave":
                payload["action"] = "leave"
            else:
                self._send_json(404, {"ok": False, "message": "not found"})
                return

            try:
                response = handle_request_payload(payload, base_dir)
                self._send_json(200, response)
            except Exception as exc:
                self._send_json(500, {"ok": False, "message": str(exc)})

            if payload["action"] in ("latency_leave", "leave"):
                if not _check_has_active_players(base_dir):
                    _server_shutdown_flag = True

    return Handler


def serve_main(port: int, idle_timeout: int) -> None:
    from http.server import ThreadingHTTPServer
    import threading

    global _server_shutdown_flag
    _server_shutdown_flag = False

    base_dir = Path(__file__).resolve().parent
    _touch_activity()

    handler_class = _make_handler(base_dir, idle_timeout)
    server = ThreadingHTTPServer(("0.0.0.0", port), handler_class)
    server.daemon_threads = True

    def watchdog() -> None:
        global _server_shutdown_flag
        while not _server_shutdown_flag:
            time.sleep(2)
            elapsed = time.time() - _server_last_activity
            if elapsed >= idle_timeout:
                _server_shutdown_flag = True
                break
        server.shutdown()

    watcher = threading.Thread(target=watchdog, daemon=True)
    watcher.start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    import sys
    if "--serve" in sys.argv:
        _port = 18086
        _idle = SERVER_IDLE_TIMEOUT
        for i, arg in enumerate(sys.argv):
            if arg == "--port" and i + 1 < len(sys.argv):
                _port = int(sys.argv[i + 1])
            if arg == "--idle-timeout" and i + 1 < len(sys.argv):
                _idle = int(sys.argv[i + 1])
        serve_main(_port, _idle)
    else:
        main()
