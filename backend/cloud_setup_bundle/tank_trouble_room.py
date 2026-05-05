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
from urllib.parse import parse_qs, urlparse


ACTIVE_TTL_SECONDS = 8.0
COUNTDOWN_SECONDS = 3.0
DEFAULT_ROOM = "main"
TARGET_COUNT = 6
PLAYER_RESPAWN_SECONDS = 1.0
PLAYER_COLORS = ("green", "red", "blue", "yellow")
POWERUP_SPAWN_INTERVAL_MS = 5000
POWERUP_RESPAWN_MS = 2000
POWERUP_LINGER_MS = 1400
DEATH_EVENT_LINGER_MS = 2400
CASH_POWERUP_SCORE = 100

WORLD_WIDTH = 1280.0
WORLD_HEIGHT = 800.0
ARENA_X = 92.0
ARENA_Y = 72.0
ARENA_WIDTH = 1096.0
ARENA_HEIGHT = 656.0
WALL_THICKNESS = 18.0
PLAYER_RADIUS = 20.0
TARGET_RADIUS = 18.0
BULLET_RADIUS = 5.0
PLAYER_TURN_SPEED = math.pi * 2.0 / 1.3
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
SHOTGUN_PELLET_COUNT = 16
SHOTGUN_CONE_RADIANS = math.pi / 6.0
SHOTGUN_MIN_SPEED = LOGICAL_GRID_SIZE * 4.0
SHOTGUN_MAX_SPEED = LOGICAL_GRID_SIZE * 4.2
SHOTGUN_PELLET_RADIUS = BULLET_RADIUS / 3.0
SHOTGUN_COOLDOWN = 1.5
SHOTGUN_AMMO = 3
SHOTGUN_BARREL_WIDTH = 18.0
SHOTGUN_PELLET_LIFE = 1.5
LASER_SPEED = LOGICAL_GRID_SIZE * 40.0
LASER_LIFE = 0.375
LASER_LENGTH = LOGICAL_GRID_SIZE * 2.0
LASER_RADIUS = 4.4
LASER_COOLDOWN = 0.18
LASER_WALL_CLEARANCE = 7.0
FIRE_SPAWN_FORWARD_OFFSET = 12.0
FIRE_SPAWN_BACKOFF_STEPS = 18
MINIGUN_SPINUP_SECONDS = 0.5
MINIGUN_GRACE_SECONDS = 1.0
MINIGUN_FIRE_RATE = 10.0
MINIGUN_AMMO = 20
MINIGUN_BULLET_SPEED = LOGICAL_GRID_SIZE * 2.2
MINIGUN_BULLET_LIFE = 3.0
MINIGUN_BULLET_RADIUS = BULLET_RADIUS / 2.0
MINIGUN_BARREL_WIDTH = 19.5
MINIGUN_BARREL_OFFSET_PATTERN = (-0.5, -0.18, 0.16, 0.48, -0.34, 0.02, 0.36, -0.46, -0.08, 0.28)
DOUBLE_BARREL_AMMO = 10
DOUBLE_BARREL_COOLDOWN = SHOOT_COOLDOWN / 2.0
DOUBLE_BARREL_BARREL_OFFSET = 7.2
SHIELD_RADIUS = PLAYER_RADIUS + 30.0
SHIELD_ACTIVE_MS = 3000
SHIELD_FLICKER_MS = 1500
SHIELD_VISIBLE_MS = SHIELD_ACTIVE_MS + SHIELD_FLICKER_MS
SHIELD_POWERUP_COLOR = "#9ca3af"

LATENCY_CLONE_NAME = "RelayBot"
LATENCY_CLONE_COUNTRY = "US"
POWERUP_KINDS = (
    {
        "kind": "cash",
        "color": "#9ca3af",
        "symbol": "$$",
        "effect": "score",
        "score_delta": CASH_POWERUP_SCORE,
    },
    {
        "kind": "shotgun",
        "color": "#9ca3af",
        "symbol": "SG",
        "effect": "shotgun",
        "score_delta": 0,
    },
    {
        "kind": "laser",
        "color": "#9ca3af",
        "symbol": "LZ",
        "effect": "laser",
        "score_delta": 0,
    },
    {
        "kind": "minigun",
        "color": "#9ca3af",
        "symbol": "MG",
        "effect": "minigun",
        "score_delta": 0,
    },
    {
        "kind": "double_barrel",
        "color": "#9ca3af",
        "symbol": "DB",
        "effect": "double_barrel",
        "score_delta": 0,
    },
    {
        "kind": "shield",
        "color": SHIELD_POWERUP_COLOR,
        "symbol": "SH",
        "effect": "shield",
        "score_delta": 0,
    },
)


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


def point_inside_wall(x: float, y: float, radius: float, walls: list[dict[str, float]]) -> bool:
    return any(circle_intersects_rect({"x": x, "y": y, "radius": radius}, wall) for wall in walls)


def push_out_of_wall(
    x: float,
    y: float,
    angle: float,
    radius: float,
    walls: list[dict[str, float]],
) -> tuple[float, float]:
    candidate_x = x
    candidate_y = y
    dx = math.cos(angle)
    dy = math.sin(angle)
    for _ in range(10):
        moved = False
        for wall in walls:
            if not circle_intersects_rect({"x": candidate_x, "y": candidate_y, "radius": radius}, wall):
                continue
            closest_x = clamp(candidate_x, wall["x"], wall["x"] + wall["w"])
            closest_y = clamp(candidate_y, wall["y"], wall["y"] + wall["h"])
            normal_x = candidate_x - closest_x
            normal_y = candidate_y - closest_y
            normal_length = math.hypot(normal_x, normal_y)
            if normal_length <= 0.0001:
                distances = (
                    (abs(candidate_x - wall["x"]), -1.0, 0.0),
                    (abs(wall["x"] + wall["w"] - candidate_x), 1.0, 0.0),
                    (abs(candidate_y - wall["y"]), 0.0, -1.0),
                    (abs(wall["y"] + wall["h"] - candidate_y), 0.0, 1.0),
                )
                _, normal_x, normal_y = min(distances, key=lambda entry: entry[0])
                normal_length = 1.0
            normal_x /= normal_length
            normal_y /= normal_length
            closest_x = clamp(candidate_x, wall["x"], wall["x"] + wall["w"])
            closest_y = clamp(candidate_y, wall["y"], wall["y"] + wall["h"])
            penetration = radius - distance(candidate_x, candidate_y, closest_x, closest_y)
            if penetration <= 0:
                continue
            candidate_x += normal_x * (penetration + 1.5)
            candidate_y += normal_y * (penetration + 1.5)
            moved = True
        if not moved:
            break
    if point_inside_wall(candidate_x, candidate_y, radius, walls):
        return x - dx * (radius + 2.0), y - dy * (radius + 2.0)
    return candidate_x, candidate_y


def safe_fire_spawn_point(
    player_meta: dict[str, object],
    angle: float,
    walls: list[dict[str, float]],
    *,
    projectile_radius: float,
    lateral_offset: float = 0.0,
) -> tuple[float, float]:
    center_x = float(player_meta.get("x") or 0.0)
    center_y = float(player_meta.get("y") or 0.0)
    player_radius = float(player_meta.get("radius") or PLAYER_RADIUS)
    dx = math.cos(angle)
    dy = math.sin(angle)
    side_x = math.cos(angle + math.pi / 2.0)
    side_y = math.sin(angle + math.pi / 2.0)
    start_forward = player_radius + FIRE_SPAWN_FORWARD_OFFSET + projectile_radius
    minimum_forward = player_radius + projectile_radius + 2.0
    step_size = max(1.0, (start_forward - minimum_forward) / FIRE_SPAWN_BACKOFF_STEPS)

    for index in range(FIRE_SPAWN_BACKOFF_STEPS + 1):
        forward = max(minimum_forward, start_forward - index * step_size)
        spawn_x = center_x + dx * forward + side_x * lateral_offset
        spawn_y = center_y + dy * forward + side_y * lateral_offset
        if not point_inside_wall(spawn_x, spawn_y, projectile_radius + 1.0, walls):
            return spawn_x, spawn_y

    return push_out_of_wall(
        center_x + dx * minimum_forward + side_x * lateral_offset,
        center_y + dy * minimum_forward + side_y * lateral_offset,
        angle,
        projectile_radius + 1.0,
        walls,
    )


def reset_player_weapon_state(player_meta: dict[str, object]) -> None:
    player_meta["weapon"] = "default"
    player_meta["shotgun_ammo"] = 0
    player_meta["minigun_ammo"] = 0
    player_meta["double_barrel_ammo"] = 0
    player_meta["minigun_spinup"] = 0.0
    player_meta["minigun_idle"] = 0.0
    player_meta["minigun_shot_accum"] = 0.0


def ray_rect_hit(
    x: float,
    y: float,
    dx: float,
    dy: float,
    rect: dict[str, float],
) -> dict[str, float] | None:
    epsilon = 0.0001
    candidates: list[dict[str, float]] = []

    if abs(dx) > epsilon:
        for edge_x, nx in ((rect["x"], -1.0), (rect["x"] + rect["w"], 1.0)):
            t = (edge_x - x) / dx
            if t <= epsilon:
                continue
            hit_y = y + dy * t
            if rect["y"] - epsilon <= hit_y <= rect["y"] + rect["h"] + epsilon:
                candidates.append({"t": t, "normal_x": nx, "normal_y": 0.0})

    if abs(dy) > epsilon:
        for edge_y, ny in ((rect["y"], -1.0), (rect["y"] + rect["h"], 1.0)):
            t = (edge_y - y) / dy
            if t <= epsilon:
                continue
            hit_x = x + dx * t
            if rect["x"] - epsilon <= hit_x <= rect["x"] + rect["w"] + epsilon:
                candidates.append({"t": t, "normal_x": 0.0, "normal_y": ny})

    if not candidates:
        return None

    nearest_t = min(candidate["t"] for candidate in candidates)
    normal_x = 0.0
    normal_y = 0.0
    for candidate in candidates:
        if abs(candidate["t"] - nearest_t) > 0.001:
            continue
        normal_x = candidate["normal_x"] or normal_x
        normal_y = candidate["normal_y"] or normal_y

    return {"t": nearest_t, "normal_x": normal_x, "normal_y": normal_y}


def ray_arena_bounds_hit(x: float, y: float, dx: float, dy: float) -> dict[str, float] | None:
    epsilon = 0.0001
    inside_arena = (
        x >= ARENA_X - epsilon
        and x <= ARENA_X + ARENA_WIDTH + epsilon
        and y >= ARENA_Y - epsilon
        and y <= ARENA_Y + ARENA_HEIGHT + epsilon
    )
    if not inside_arena:
        return None

    candidates: list[dict[str, float]] = []
    if abs(dx) > epsilon:
        for edge_x, normal_x in ((ARENA_X, 1.0), (ARENA_X + ARENA_WIDTH, -1.0)):
            t = (edge_x - x) / dx
            if t <= epsilon:
                continue
            hit_y = y + dy * t
            if ARENA_Y - epsilon <= hit_y <= ARENA_Y + ARENA_HEIGHT + epsilon:
                candidates.append({"t": t, "normal_x": normal_x, "normal_y": 0.0})

    if abs(dy) > epsilon:
        for edge_y, normal_y in ((ARENA_Y, 1.0), (ARENA_Y + ARENA_HEIGHT, -1.0)):
            t = (edge_y - y) / dy
            if t <= epsilon:
                continue
            hit_x = x + dx * t
            if ARENA_X - epsilon <= hit_x <= ARENA_X + ARENA_WIDTH + epsilon:
                candidates.append({"t": t, "normal_x": 0.0, "normal_y": normal_y})

    if not candidates:
        return None

    nearest_t = min(candidate["t"] for candidate in candidates)
    normal_x = 0.0
    normal_y = 0.0
    for candidate in candidates:
        if abs(candidate["t"] - nearest_t) > 0.001:
            continue
        normal_x = candidate["normal_x"] or normal_x
        normal_y = candidate["normal_y"] or normal_y
    return {"t": nearest_t, "normal_x": normal_x, "normal_y": normal_y}


def ray_circle_hit(
    x: float,
    y: float,
    dx: float,
    dy: float,
    circle: dict[str, float],
) -> dict[str, float] | None:
    center_x = float(circle.get("x") or 0.0)
    center_y = float(circle.get("y") or 0.0)
    radius = float(circle.get("radius") or 0.0)
    origin_x = x - center_x
    origin_y = y - center_y
    b = origin_x * dx + origin_y * dy
    c = origin_x * origin_x + origin_y * origin_y - radius * radius
    discriminant = b * b - c
    if discriminant < 0:
        return None
    sqrt_discriminant = math.sqrt(discriminant)
    candidates = [-b - sqrt_discriminant, -b + sqrt_discriminant]
    t_values = [value for value in candidates if value > 0.0001]
    if not t_values:
        return None
    t = min(t_values)
    hit_x = x + dx * t
    hit_y = y + dy * t
    normal_length = max(0.0001, distance(hit_x, hit_y, center_x, center_y))
    return {
        "t": t,
        "normal_x": (hit_x - center_x) / normal_length,
        "normal_y": (hit_y - center_y) / normal_length,
    }


def active_shields(
    players: dict[str, dict[str, object]],
    current_ms: int,
    *,
    exclude_owner_id: str = "",
    include_visual: bool = False,
) -> list[dict[str, object]]:
    shields: list[dict[str, object]] = []
    for player_id, player_meta in players.items():
        if str(player_id) == str(exclude_owner_id):
            continue
        if not bool(player_meta.get("alive", True)):
            continue
        shield_until_ms = int(player_meta.get("shield_until_ms") or 0)
        shield_visible_until_ms = int(player_meta.get("shield_visible_until_ms") or shield_until_ms)
        if (shield_until_ms if not include_visual else shield_visible_until_ms) <= current_ms:
            continue
        shields.append(
            {
                "player_id": str(player_meta.get("player_id") or player_id),
                "x": float(player_meta.get("x") or 0.0),
                "y": float(player_meta.get("y") or 0.0),
                "radius": float(player_meta.get("shield_radius") or SHIELD_RADIUS),
                "active_ms": max(0, shield_until_ms - current_ms),
                "visible_ms": max(0, shield_visible_until_ms - current_ms),
                "elapsed_ms": max(0, current_ms - int(player_meta.get("shield_started_at_ms") or current_ms)),
                "color": normalize_color(player_meta.get("color")),
            }
        )
    return shields


def build_reflected_ray_segments(
    start_x: float,
    start_y: float,
    angle: float,
    max_length: float,
    walls: list[dict[str, float]],
    max_bounces: int = 8,
    shields: list[dict[str, object]] | None = None,
) -> list[dict[str, float]]:
    segments: list[dict[str, float]] = []
    x = start_x
    y = start_y
    dx = math.cos(angle)
    dy = math.sin(angle)
    remaining = max_length

    for _ in range(max_bounces + 1):
        if remaining <= 0.5:
            break

        nearest: dict[str, float] | None = None
        nearest_kind = "wall"
        arena_hit = ray_arena_bounds_hit(x, y, dx, dy)
        if arena_hit and arena_hit["t"] <= remaining:
            nearest = arena_hit
            nearest_kind = "wall"
        for wall in walls:
            hit = ray_rect_hit(x, y, dx, dy, wall)
            if hit and hit["t"] <= remaining and (nearest is None or hit["t"] < nearest["t"]):
                nearest = hit
                nearest_kind = "wall"
        for shield in shields or []:
            shield_circle = {
                **shield,
                "radius": float(shield.get("radius") or SHIELD_RADIUS) + LASER_RADIUS,
            }
            if distance(x, y, float(shield_circle.get("x") or 0.0), float(shield_circle.get("y") or 0.0)) < float(shield_circle["radius"]) - 0.5:
                continue
            hit = ray_circle_hit(x, y, dx, dy, shield_circle)
            if hit and hit["t"] <= remaining and (nearest is None or hit["t"] < nearest["t"]):
                nearest = hit
                nearest_kind = "shield"

        if nearest is None:
            segments.append({"x1": x, "y1": y, "x2": x + dx * remaining, "y2": y + dy * remaining})
            break

        hit_x = x + dx * nearest["t"]
        hit_y = y + dy * nearest["t"]
        clearance = 0.5 if nearest_kind == "shield" else LASER_WALL_CLEARANCE
        visible_t = max(0.0, nearest["t"] - clearance)
        visible_x = x + dx * visible_t
        visible_y = y + dy * visible_t
        if distance(x, y, visible_x, visible_y) > 0.1:
            segments.append({"x1": x, "y1": y, "x2": visible_x, "y2": visible_y})
        remaining -= nearest["t"]
        if nearest_kind == "shield":
            dot = dx * float(nearest["normal_x"]) + dy * float(nearest["normal_y"])
            dx -= 2.0 * dot * float(nearest["normal_x"])
            dy -= 2.0 * dot * float(nearest["normal_y"])
        elif nearest["normal_x"]:
            dx *= -1.0
        if nearest_kind != "shield" and nearest["normal_y"]:
            dy *= -1.0
        x = hit_x + dx * clearance
        y = hit_y + dy * clearance
        remaining -= clearance

    return segments


def slice_path_segments(
    path_segments: list[dict[str, float]],
    start_distance: float,
    length: float,
) -> list[dict[str, float]]:
    total_length = sum(
        distance(
            float(segment.get("x1") or 0.0),
            float(segment.get("y1") or 0.0),
            float(segment.get("x2") or 0.0),
            float(segment.get("y2") or 0.0),
        )
        for segment in path_segments
        if isinstance(segment, dict)
    )
    if total_length <= 0.001 or length <= 0.001:
        return []

    visible: list[dict[str, float]] = []
    cursor = 0.0
    visible_length = min(length, total_length)
    safe_start_distance = clamp(start_distance, 0.0, max(0.0, total_length - visible_length))
    end_distance = safe_start_distance + visible_length

    for segment in path_segments:
        x1 = float(segment.get("x1") or 0.0)
        y1 = float(segment.get("y1") or 0.0)
        x2 = float(segment.get("x2") or 0.0)
        y2 = float(segment.get("y2") or 0.0)
        segment_length = distance(x1, y1, x2, y2)
        if segment_length <= 0.001:
            continue

        segment_start = cursor
        segment_end = cursor + segment_length
        cursor = segment_end
        if segment_end <= safe_start_distance:
            continue
        if segment_start >= end_distance:
            break

        local_start = max(safe_start_distance, segment_start) - segment_start
        local_end = min(end_distance, segment_end) - segment_start
        ratio_start = clamp(local_start / segment_length, 0.0, 1.0)
        ratio_end = clamp(local_end / segment_length, 0.0, 1.0)
        visible.append(
            {
                "x1": x1 + (x2 - x1) * ratio_start,
                "y1": y1 + (y2 - y1) * ratio_start,
                "x2": x1 + (x2 - x1) * ratio_end,
                "y2": y1 + (y2 - y1) * ratio_end,
            }
        )

    return visible


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
        "player_revisions": {},
        "latency_tests": {},
        "targets": [],
        "powerups": [],
        "powerup_effects": [],
        "next_powerup_id": 1,
        "next_powerup_effect_id": 1,
        "powerup_started_at_ms": 0,
        "next_powerup_spawn_at_ms": 0,
        "powerup_respawns": [],
        "death_events": [],
        "next_death_event_id": 1,
        "bullets": [],
        "next_bullet_id": 1,
        "snapshot_seq": 0,
        "last_tick_ms": now_ms(),
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
    payload.setdefault("player_revisions", {})
    payload.setdefault("latency_tests", {})
    payload.setdefault("targets", [])
    payload.setdefault("powerups", [])
    payload.setdefault("powerup_effects", [])
    payload.setdefault("next_powerup_id", 1)
    payload.setdefault("next_powerup_effect_id", 1)
    payload.setdefault("powerup_started_at_ms", 0)
    payload.setdefault("next_powerup_spawn_at_ms", 0)
    payload.setdefault("powerup_respawns", [])
    payload.setdefault("death_events", [])
    payload.setdefault("next_death_event_id", 1)
    payload.setdefault("bullets", [])
    payload.setdefault("next_bullet_id", 1)
    payload.setdefault("snapshot_seq", 0)
    payload.setdefault("last_tick_ms", now_ms())
    payload.setdefault("countdown_deadline_ms", 0)
    payload.setdefault("updated_at_ms", now_ms())
    if not payload.get("map_seed"):
        payload["map_seed"] = generate_map_seed()
    if not payload.get("map_id"):
        payload["map_id"] = map_id_from_seed(int(payload["map_seed"]))
    return payload


def normalize_optional_color(raw_value: object) -> str:
    value = str(raw_value or "").strip().lower()
    return value if value in PLAYER_COLORS else ""


def normalize_match_input(raw_value: object) -> dict[str, object]:
    payload = raw_value if isinstance(raw_value, dict) else {}
    return {
        "forward": bool(payload.get("forward")),
        "backward": bool(payload.get("backward")),
        "left": bool(payload.get("left")),
        "right": bool(payload.get("right")),
        "fire_seq": max(0, int(payload.get("fire_seq") or 0)),
        "fire_held": bool(payload.get("fire_held")),
    }


def reset_match_combat_state(player_meta: dict[str, object]) -> None:
    player_meta["last_fire_seq"] = 0
    player_meta["input"] = normalize_match_input({})
    player_meta["cooldown"] = 0.0
    reset_player_weapon_state(player_meta)


def normalize_match_local_player(raw_value: object) -> dict[str, float] | None:
    if not isinstance(raw_value, dict):
        return None
    return {
        "x": float(raw_value.get("x") or 0.0),
        "y": float(raw_value.get("y") or 0.0),
        "angle": float(raw_value.get("angle") or 0.0),
        "radius": float(raw_value.get("radius") or PLAYER_RADIUS),
    }


def normalize_latency_ms(raw_value: object) -> int:
    try:
        latency_ms = int(round(float(raw_value or 0)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(9999, latency_ms))


def string_seed(value: object) -> int:
    state = 2166136261
    for byte in str(value or "").encode("utf-8", errors="ignore"):
        state ^= byte
        state = (state * 16777619) & 0xFFFFFFFF
    return state or 1


def player_spawn_band(color: str) -> dict[str, float]:
    if color == "red":
        return {
            "minX": ARENA_X + ARENA_WIDTH * 0.58,
            "maxX": ARENA_X + ARENA_WIDTH - 44,
            "minY": ARENA_Y + ARENA_HEIGHT * 0.52,
            "maxY": ARENA_Y + ARENA_HEIGHT - 44,
        }
    if color == "blue":
        return {
            "minX": ARENA_X + ARENA_WIDTH * 0.58,
            "maxX": ARENA_X + ARENA_WIDTH - 44,
            "minY": ARENA_Y + 44,
            "maxY": ARENA_Y + ARENA_HEIGHT * 0.48,
        }
    if color == "yellow":
        return {
            "minX": ARENA_X + 44,
            "maxX": ARENA_X + ARENA_WIDTH * 0.42,
            "minY": ARENA_Y + ARENA_HEIGHT * 0.52,
            "maxY": ARENA_Y + ARENA_HEIGHT - 44,
        }
    return {
        "minX": ARENA_X + 44,
        "maxX": ARENA_X + ARENA_WIDTH * 0.42,
        "minY": ARENA_Y + 44,
        "maxY": ARENA_Y + ARENA_HEIGHT * 0.48,
    }


def player_spawn_angle(color: str) -> float:
    if color == "red":
        return -math.pi / 2
    if color == "blue":
        return math.pi
    if color == "yellow":
        return 0.0
    return math.pi / 2


def get_active_players(state: dict[str, object]) -> dict[str, dict[str, object]]:
    raw_players = state.get("players")
    if not isinstance(raw_players, dict):
        raw_players = {}
        state["players"] = raw_players
    players: dict[str, dict[str, object]] = {}
    for key, value in raw_players.items():
        if isinstance(value, dict):
            players[str(key)] = value
    return players


def build_player_sort_key(player_meta: dict[str, object]) -> tuple[int, int, int, str]:
    return (
        -int(player_meta.get("score") or 0),
        -int(player_meta.get("hits") or 0),
        int(player_meta.get("joined_at_ms") or 0),
        str(player_meta.get("player_id") or ""),
    )


def occupied_colors_for_state(state: dict[str, object], *, exclude_player_id: str | None = None) -> list[str]:
    colors: list[str] = []
    for player_id, player_meta in get_active_players(state).items():
        if exclude_player_id and player_id == exclude_player_id:
            continue
        color = normalize_optional_color(player_meta.get("color"))
        if color and color not in colors:
            colors.append(color)
    return colors


def available_colors_for_state(state: dict[str, object], *, exclude_player_id: str | None = None) -> list[str]:
    occupied = set(occupied_colors_for_state(state, exclude_player_id=exclude_player_id))
    return [color for color in PLAYER_COLORS if color not in occupied]


def ensure_targets_state(state: dict[str, object]) -> list[dict[str, float]]:
    raw_targets = state.get("targets")
    if isinstance(raw_targets, list) and raw_targets:
        normalized_targets: list[dict[str, float]] = []
        for target in raw_targets:
            if not isinstance(target, dict):
                continue
            normalized_targets.append(
                {
                    "id": int(target.get("id") or 0),
                    "x": float(target.get("x") or 0.0),
                    "y": float(target.get("y") or 0.0),
                    "radius": float(target.get("radius") or TARGET_RADIUS),
                    "phase": float(target.get("phase") or 0.0),
                }
            )
        if normalized_targets:
            state["targets"] = normalized_targets
            return normalized_targets

    seed = int(state.get("map_seed") or 1)
    walls = build_training_walls(seed)
    rng = create_seeded_random((seed ^ 0x5E3F9AB1) & 0xFFFFFFFF)
    occupied: list[dict[str, float]] = []
    for player_meta in get_active_players(state).values():
        if not bool(player_meta.get("alive", True)):
            continue
        occupied.append(
            {
                "x": float(player_meta.get("x") or 0.0),
                "y": float(player_meta.get("y") or 0.0),
                "radius": float(player_meta.get("radius") or PLAYER_RADIUS) + 28,
            }
        )

    targets: list[dict[str, float]] = []
    for index in range(TARGET_COUNT):
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
        targets.append(
            {
                "id": index + 1,
                "x": float(spawn["x"]),
                "y": float(spawn["y"]),
                "radius": TARGET_RADIUS,
                "phase": rng() * math.pi * 2.0,
            }
        )
        occupied.append({"x": float(spawn["x"]), "y": float(spawn["y"]), "radius": TARGET_RADIUS + 18})

    state["targets"] = targets
    return targets


def respawn_match_target(
    state: dict[str, object],
    target_id: int,
    current_ms: int,
) -> dict[str, float]:
    seed = int(state.get("map_seed") or 1)
    walls = build_training_walls(seed)
    targets = ensure_targets_state(state)
    occupied: list[dict[str, float]] = []
    for player_meta in get_active_players(state).values():
        if not bool(player_meta.get("alive", True)):
            continue
        occupied.append(
            {
                "x": float(player_meta.get("x") or 0.0),
                "y": float(player_meta.get("y") or 0.0),
                "radius": float(player_meta.get("radius") or PLAYER_RADIUS) + 30,
            }
        )
    for target in targets:
        if int(target["id"]) == target_id:
            continue
        occupied.append({"x": target["x"], "y": target["y"], "radius": target["radius"] + 18})

    rng = create_seeded_random((seed ^ target_id ^ (current_ms & 0xFFFFFFFF) ^ 0x5E3F9AB1) & 0xFFFFFFFF)
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
    replacement = {
        "id": target_id,
        "x": float(spawn["x"]),
        "y": float(spawn["y"]),
        "radius": TARGET_RADIUS,
        "phase": rng() * math.pi * 2.0,
    }
    state["targets"] = [replacement if int(target["id"]) == target_id else target for target in targets]
    return replacement


def ensure_powerups_state(state: dict[str, object]) -> list[dict[str, object]]:
    raw_powerups = state.get("powerups")
    powerups = raw_powerups if isinstance(raw_powerups, list) else []
    normalized: list[dict[str, object]] = []
    for powerup in powerups:
        if not isinstance(powerup, dict):
            continue
        normalized.append(
            {
                "id": int(powerup.get("id") or 0),
                "kind": str(powerup.get("kind") or "cash"),
                "color": str(powerup.get("color") or "#9ca3af"),
                "symbol": str(powerup.get("symbol") or "$$")[:3] or "$$",
                "effect": str(powerup.get("effect") or "score"),
                "score_delta": int(powerup.get("score_delta") or CASH_POWERUP_SCORE),
                "x": float(powerup.get("x") or 0.0),
                "y": float(powerup.get("y") or 0.0),
                "radius": float(powerup.get("radius") or TARGET_RADIUS),
                "phase": float(powerup.get("phase") or 0.0),
                "home_x": float(powerup.get("home_x") or powerup.get("x") or 0.0),
                "home_y": float(powerup.get("home_y") or powerup.get("y") or 0.0),
                "disabled": bool(powerup.get("disabled")),
                "respawn_at_ms": int(powerup.get("respawn_at_ms") or 0),
            }
        )
    state["powerups"] = normalized
    return normalized


def clear_powerup_state(state: dict[str, object]) -> None:
    state["powerups"] = []
    state["powerup_effects"] = []
    state["powerup_started_at_ms"] = 0
    state["next_powerup_spawn_at_ms"] = 0
    state["powerup_respawns"] = []


def schedule_next_powerup_spawn(state: dict[str, object], current_ms: int) -> None:
    state["next_powerup_spawn_at_ms"] = current_ms + POWERUP_SPAWN_INTERVAL_MS
    if int(state.get("powerup_started_at_ms") or 0) <= 0:
        state["powerup_started_at_ms"] = current_ms


def prune_powerup_effects(state: dict[str, object], current_ms: int) -> list[dict[str, object]]:
    raw_effects = state.get("powerup_effects")
    effects = raw_effects if isinstance(raw_effects, list) else []
    kept: list[dict[str, object]] = []
    for effect in effects:
        if not isinstance(effect, dict):
            continue
        created_at_ms = int(effect.get("created_at_ms") or 0)
        if created_at_ms and current_ms - created_at_ms > POWERUP_LINGER_MS:
            continue
        kept.append(effect)
    state["powerup_effects"] = kept
    return kept


def prune_death_events(state: dict[str, object], current_ms: int) -> list[dict[str, object]]:
    raw_events = state.get("death_events")
    events = raw_events if isinstance(raw_events, list) else []
    kept: list[dict[str, object]] = []
    for event in events:
        if not isinstance(event, dict):
            continue
        created_at_ms = int(event.get("created_at_ms") or 0)
        if created_at_ms and current_ms - created_at_ms > DEATH_EVENT_LINGER_MS:
            continue
        kept.append(event)
    state["death_events"] = kept
    return kept


def serialize_powerups(state: dict[str, object]) -> list[dict[str, object]]:
    return [
        {
            "id": int(powerup.get("id") or 0),
            "kind": str(powerup.get("kind") or "cash"),
            "color": str(powerup.get("color") or "#9ca3af"),
            "symbol": str(powerup.get("symbol") or "$$")[:3] or "$$",
            "effect": str(powerup.get("effect") or "score"),
            "score_delta": int(powerup.get("score_delta") or CASH_POWERUP_SCORE),
            "x": float(powerup.get("x") or 0.0),
            "y": float(powerup.get("y") or 0.0),
            "radius": float(powerup.get("radius") or TARGET_RADIUS),
            "phase": float(powerup.get("phase") or 0.0),
            "respawn_ms": max(0, int(powerup.get("respawn_at_ms") or 0) - now_ms()) if powerup.get("disabled") else 0,
        }
        for powerup in ensure_powerups_state(state)
        if not bool(powerup.get("disabled"))
    ]


def serialize_powerup_effects(state: dict[str, object], current_ms: int) -> list[dict[str, object]]:
    return [
        {
            "id": int(effect.get("id") or 0),
            "powerup_id": int(effect.get("powerup_id") or 0),
            "player_id": str(effect.get("player_id") or ""),
            "kind": str(effect.get("kind") or "cash"),
            "color": str(effect.get("color") or "#9ca3af"),
            "symbol": str(effect.get("symbol") or "$$")[:3] or "$$",
            "effect": str(effect.get("effect") or "score"),
            "score_delta": int(effect.get("score_delta") or CASH_POWERUP_SCORE),
            "x": float(effect.get("x") or 0.0),
            "y": float(effect.get("y") or 0.0),
            "radius": float(effect.get("radius") or TARGET_RADIUS),
            "created_at_ms": int(effect.get("created_at_ms") or current_ms),
        }
        for effect in prune_powerup_effects(state, current_ms)
    ]


def serialize_death_events(state: dict[str, object], current_ms: int) -> list[dict[str, object]]:
    return [
        {
            "id": int(event.get("id") or 0),
            "x": float(event.get("x") or 0.0),
            "y": float(event.get("y") or 0.0),
            "radius": float(event.get("radius") or PLAYER_RADIUS),
            "color": normalize_color(event.get("color")),
            "life": max(0.0, 0.78 - max(0.0, (current_ms - int(event.get("created_at_ms") or current_ms)) / 1000.0)),
            "maxLife": 0.78,
            "seed": int(event.get("seed") or 0),
            "created_at_ms": int(event.get("created_at_ms") or current_ms),
            "killer_id": str(event.get("killer_id") or ""),
            "victim_id": str(event.get("victim_id") or ""),
            "killer_color": normalize_color(event.get("killer_color")) if event.get("killer_color") else "",
            "victim_color": normalize_color(event.get("victim_color") or event.get("color")),
            "weapon": str(event.get("weapon") or "bullet"),
            "bullet_id": int(event.get("bullet_id") or 0),
            "suicide": bool(event.get("suicide", False)),
        }
        for event in prune_death_events(state, current_ms)
    ]


def spawn_powerup(
    state: dict[str, object],
    current_ms: int,
    walls: list[dict[str, float]],
    players: dict[str, dict[str, object]],
    kind_template: dict[str, object] | None = None,
) -> None:
    seed = int(state.get("map_seed") or 1)
    powerup_id = int(state.get("next_powerup_id") or 1)
    kind_key = str((kind_template or {}).get("kind") or powerup_id)
    rng = create_seeded_random(
        (seed ^ powerup_id ^ string_seed(kind_key) ^ (current_ms & 0xFFFFFFFF) ^ 0xC45A9F3D) & 0xFFFFFFFF
    )
    occupied: list[dict[str, float]] = []
    for player_meta in players.values():
        if bool(player_meta.get("alive", True)):
            occupied.append(
                {
                    "x": float(player_meta.get("x") or 0.0),
                    "y": float(player_meta.get("y") or 0.0),
                    "radius": float(player_meta.get("radius") or PLAYER_RADIUS) + 34,
                }
            )
    for powerup in ensure_powerups_state(state):
        occupied.append(
            {
                "x": float(powerup.get("x") or 0.0),
                "y": float(powerup.get("y") or 0.0),
                "radius": float(powerup.get("radius") or TARGET_RADIUS) + 24,
            }
        )

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
    powerups = ensure_powerups_state(state)
    if kind_template is None:
        powerup_kind = dict(POWERUP_KINDS[int(rng() * len(POWERUP_KINDS)) % len(POWERUP_KINDS)])
    else:
        powerup_kind = dict(kind_template)
    powerups.append(
        {
            "id": powerup_id,
            **powerup_kind,
            "x": float(spawn["x"]),
            "y": float(spawn["y"]),
            "home_x": float(spawn["x"]),
            "home_y": float(spawn["y"]),
            "radius": TARGET_RADIUS,
            "phase": rng() * math.pi * 2.0,
            "disabled": False,
            "respawn_at_ms": 0,
        }
    )
    state["next_powerup_id"] = powerup_id + 1


def ensure_test_powerup_set(
    state: dict[str, object],
    current_ms: int,
    walls: list[dict[str, float]],
    players: dict[str, dict[str, object]],
) -> None:
    powerups = ensure_powerups_state(state)
    existing_kinds = {str(powerup.get("kind") or "") for powerup in powerups}
    for template in POWERUP_KINDS:
        if str(template.get("kind") or "") not in existing_kinds:
            spawn_powerup(state, current_ms, walls, players, template)
            existing_kinds.add(str(template.get("kind") or ""))


def advance_powerups(
    state: dict[str, object],
    current_ms: int,
    walls: list[dict[str, float]],
    players: dict[str, dict[str, object]],
) -> None:
    active_players = [player for player in players.values() if isinstance(player, dict)]
    if not active_players:
        clear_powerup_state(state)
        return

    powerups = ensure_powerups_state(state)
    for powerup in powerups:
        if bool(powerup.get("disabled")) and int(powerup.get("respawn_at_ms") or 0) <= current_ms:
            powerup["disabled"] = False
            powerup["respawn_at_ms"] = 0
            powerup["x"] = float(powerup.get("home_x") or powerup.get("x") or 0.0)
            powerup["y"] = float(powerup.get("home_y") or powerup.get("y") or 0.0)
    ensure_test_powerup_set(state, current_ms, walls, players)
    state["next_powerup_spawn_at_ms"] = 0
    if int(state.get("powerup_started_at_ms") or 0) <= 0:
        state["powerup_started_at_ms"] = current_ms


def handle_powerup_pickups(
    state: dict[str, object],
    current_ms: int,
    players: dict[str, dict[str, object]],
) -> None:
    powerups = ensure_powerups_state(state)
    if not powerups:
        return

    remaining_powerups: list[dict[str, object]] = []
    effects = prune_powerup_effects(state, current_ms)
    next_effect_id = int(state.get("next_powerup_effect_id") or 1)

    for powerup in powerups:
        if bool(powerup.get("disabled")):
            remaining_powerups.append(powerup)
            continue

        picked_by: dict[str, object] | None = None
        for player_meta in players.values():
            if not bool(player_meta.get("alive", True)):
                continue
            if (
                distance(
                    float(player_meta.get("x") or 0.0),
                    float(player_meta.get("y") or 0.0),
                    float(powerup.get("x") or 0.0),
                    float(powerup.get("y") or 0.0),
                )
                < float(player_meta.get("radius") or PLAYER_RADIUS) + float(powerup.get("radius") or TARGET_RADIUS)
            ):
                picked_by = player_meta
                break

        if picked_by is None:
            remaining_powerups.append(powerup)
            continue

        powerup_effect = str(powerup.get("effect") or "score")
        score_delta = int(powerup.get("score_delta") or (CASH_POWERUP_SCORE if powerup_effect == "score" else 0))
        if powerup_effect == "score":
            picked_by["score"] = max(0, int(picked_by.get("score") or 0) + score_delta)
        elif powerup_effect == "shotgun":
            picked_by["weapon"] = "shotgun"
            picked_by["shotgun_ammo"] = SHOTGUN_AMMO
            picked_by["minigun_ammo"] = 0
            picked_by["double_barrel_ammo"] = 0
            picked_by["minigun_spinup"] = 0.0
            picked_by["minigun_idle"] = 0.0
            picked_by["minigun_shot_accum"] = 0.0
            picked_by["cooldown"] = max(float(picked_by.get("cooldown") or 0.0), 0.0)
        elif powerup_effect == "laser":
            picked_by["weapon"] = "laser"
            picked_by["shotgun_ammo"] = 0
            picked_by["minigun_ammo"] = 0
            picked_by["double_barrel_ammo"] = 0
            picked_by["minigun_spinup"] = 0.0
            picked_by["minigun_idle"] = 0.0
            picked_by["minigun_shot_accum"] = 0.0
            picked_by["cooldown"] = max(float(picked_by.get("cooldown") or 0.0), 0.0)
        elif powerup_effect == "minigun":
            picked_by["weapon"] = "minigun"
            picked_by["shotgun_ammo"] = 0
            picked_by["minigun_ammo"] = MINIGUN_AMMO
            picked_by["double_barrel_ammo"] = 0
            picked_by["minigun_spinup"] = 0.0
            picked_by["minigun_idle"] = 0.0
            picked_by["minigun_shot_accum"] = 0.0
            picked_by["cooldown"] = max(float(picked_by.get("cooldown") or 0.0), 0.0)
        elif powerup_effect == "double_barrel":
            picked_by["weapon"] = "double_barrel"
            picked_by["shotgun_ammo"] = 0
            picked_by["minigun_ammo"] = 0
            picked_by["double_barrel_ammo"] = DOUBLE_BARREL_AMMO
            picked_by["minigun_spinup"] = 0.0
            picked_by["minigun_idle"] = 0.0
            picked_by["minigun_shot_accum"] = 0.0
            picked_by["cooldown"] = max(float(picked_by.get("cooldown") or 0.0), 0.0)
        elif powerup_effect == "shield":
            picked_by["shield_started_at_ms"] = current_ms
            picked_by["shield_until_ms"] = current_ms + SHIELD_ACTIVE_MS
            picked_by["shield_visible_until_ms"] = current_ms + SHIELD_VISIBLE_MS
            picked_by["shield_radius"] = SHIELD_RADIUS

        effects.append(
            {
                "id": next_effect_id,
                "powerup_id": int(powerup.get("id") or 0),
                "player_id": str(picked_by.get("player_id") or ""),
                "kind": str(powerup.get("kind") or "cash"),
                "color": str(powerup.get("color") or "#9ca3af"),
                "symbol": str(powerup.get("symbol") or "$$")[:3] or "$$",
                "effect": powerup_effect,
                "score_delta": score_delta,
                "x": float(powerup.get("x") or 0.0),
                "y": float(powerup.get("y") or 0.0),
                "radius": float(powerup.get("radius") or TARGET_RADIUS),
                "created_at_ms": current_ms,
            }
        )
        next_effect_id += 1
        powerup["disabled"] = True
        powerup["respawn_at_ms"] = current_ms + POWERUP_RESPAWN_MS
        powerup["x"] = float(powerup.get("home_x") or powerup.get("x") or 0.0)
        powerup["y"] = float(powerup.get("home_y") or powerup.get("y") or 0.0)
        remaining_powerups.append(powerup)

    state["powerups"] = remaining_powerups
    state["powerup_effects"] = effects[-48:]
    state["next_powerup_effect_id"] = next_effect_id


def push_death_event(
    state: dict[str, object],
    victim_meta: dict[str, object],
    current_ms: int,
    *,
    killer_meta: dict[str, object] | None = None,
    weapon: str = "bullet",
    bullet_id: int = 0,
) -> None:
    death_event_id = int(state.get("next_death_event_id") or 1)
    events = prune_death_events(state, current_ms)
    victim_id = str(victim_meta.get("player_id") or "")
    killer_id = str((killer_meta or {}).get("player_id") or "")
    suicide = not killer_id or killer_id == victim_id
    victim_color = normalize_color(victim_meta.get("color"))
    killer_color = "" if suicide else normalize_color((killer_meta or {}).get("color"))
    events.append(
        {
            "id": death_event_id,
            "x": float(victim_meta.get("x") or 0.0),
            "y": float(victim_meta.get("y") or 0.0),
            "radius": float(victim_meta.get("radius") or PLAYER_RADIUS),
            "color": victim_color,
            "seed": (int(state.get("map_seed") or 1) ^ death_event_id ^ int(current_ms & 0xFFFFFFFF)) & 0xFFFFFFFF,
            "created_at_ms": current_ms,
            "killer_id": "" if suicide else killer_id,
            "victim_id": victim_id,
            "killer_color": killer_color,
            "victim_color": victim_color,
            "weapon": weapon,
            "bullet_id": int(bullet_id or 0),
            "suicide": suicide,
        }
    )
    state["death_events"] = events[-40:]
    state["next_death_event_id"] = death_event_id + 1


def ensure_player_color(
    state: dict[str, object],
    player_id: str,
    preferred_color: str = "",
) -> str:
    players = get_active_players(state)
    player_meta = players.get(player_id)
    if not isinstance(player_meta, dict):
        raise RuntimeError("Player state is missing.")

    existing_color = normalize_optional_color(player_meta.get("color"))
    occupied = set(occupied_colors_for_state(state, exclude_player_id=player_id))
    requested_color = normalize_optional_color(preferred_color)

    if existing_color and existing_color not in occupied:
        if requested_color and requested_color != existing_color:
            if requested_color in occupied:
                raise RuntimeError("Selected color is already in use.")
            player_meta["color"] = requested_color
            return requested_color
        return existing_color

    if requested_color:
        if requested_color in occupied:
            raise RuntimeError("Selected color is already in use.")
        player_meta["color"] = requested_color
        return requested_color

    for color in PLAYER_COLORS:
        if color not in occupied:
            player_meta["color"] = color
            return color

    raise RuntimeError("The room is full.")


def spawn_match_player(
    state: dict[str, object],
    player_id: str,
    current_ms: int,
    *,
    preserve_stats: bool = True,
) -> dict[str, object]:
    players = get_active_players(state)
    player_meta = players.get(player_id)
    if not isinstance(player_meta, dict):
        raise RuntimeError("Player state is missing.")

    seed = int(state.get("map_seed") or 1)
    color = ensure_player_color(state, player_id)
    walls = build_training_walls(seed)
    occupied: list[dict[str, float]] = []
    for other_id, other_meta in players.items():
        if other_id == player_id or not bool(other_meta.get("alive", True)):
            continue
        occupied.append(
            {
                "x": float(other_meta.get("x") or 0.0),
                "y": float(other_meta.get("y") or 0.0),
                "radius": float(other_meta.get("radius") or PLAYER_RADIUS) + 34,
            }
        )

    rng_seed = (seed ^ string_seed(player_id) ^ int(current_ms & 0xFFFFFFFF) ^ (len(players) * 1315423911)) & 0xFFFFFFFF
    rng = create_seeded_random(rng_seed)
    spawn = pick_spawn_point(rng, walls, occupied, PLAYER_RADIUS, player_spawn_band(color))

    if not preserve_stats:
        player_meta["score"] = 0
        player_meta["hits"] = 0
        player_meta["deaths"] = 0
        player_meta["shots"] = 0
        player_meta["last_fire_seq"] = 0
        player_meta["last_ack_input_seq"] = 0

    player_meta["map_seed"] = seed
    player_meta["x"] = float(spawn["x"])
    player_meta["y"] = float(spawn["y"])
    player_meta["angle"] = player_spawn_angle(color)
    player_meta["radius"] = PLAYER_RADIUS
    player_meta["cooldown"] = 0.0
    player_meta["flash"] = 0.18
    player_meta["alive"] = True
    player_meta["respawn_at_ms"] = 0
    player_meta["input"] = normalize_match_input(player_meta.get("input"))
    player_meta["input"]["fire_seq"] = int(player_meta.get("last_fire_seq") or 0)
    player_meta["score"] = int(player_meta.get("score") or 0)
    player_meta["hits"] = int(player_meta.get("hits") or 0)
    player_meta["deaths"] = int(player_meta.get("deaths") or 0)
    player_meta["shots"] = int(player_meta.get("shots") or 0)
    player_meta["last_fire_seq"] = int(player_meta.get("last_fire_seq") or 0)
    player_meta["last_ack_input_seq"] = int(player_meta.get("last_ack_input_seq") or 0)
    player_meta["weapon"] = str(player_meta.get("weapon") or "default")
    player_meta["shotgun_ammo"] = max(0, int(player_meta.get("shotgun_ammo") or 0))
    player_meta["minigun_ammo"] = max(0, int(player_meta.get("minigun_ammo") or 0))
    player_meta["double_barrel_ammo"] = max(0, int(player_meta.get("double_barrel_ammo") or 0))
    player_meta["minigun_spinup"] = float(player_meta.get("minigun_spinup") or 0.0)
    player_meta["minigun_idle"] = float(player_meta.get("minigun_idle") or 0.0)
    player_meta["minigun_shot_accum"] = float(player_meta.get("minigun_shot_accum") or 0.0)
    player_meta["shield_started_at_ms"] = int(player_meta.get("shield_started_at_ms") or 0)
    player_meta["shield_until_ms"] = int(player_meta.get("shield_until_ms") or 0)
    player_meta["shield_visible_until_ms"] = int(player_meta.get("shield_visible_until_ms") or 0)
    player_meta["shield_radius"] = float(player_meta.get("shield_radius") or SHIELD_RADIUS)
    return player_meta


def ensure_match_player(
    state: dict[str, object],
    player_id: str,
    current_ms: int,
    *,
    preferred_color: str = "",
) -> dict[str, object]:
    players = get_active_players(state)
    player_meta = players.get(player_id)
    if not isinstance(player_meta, dict):
        raise RuntimeError("Player state is missing.")

    ensure_player_color(state, player_id, preferred_color)
    if int(player_meta.get("map_seed") or 0) != int(state.get("map_seed") or 1) or "x" not in player_meta or "y" not in player_meta:
        return spawn_match_player(state, player_id, current_ms, preserve_stats=True)
    if not isinstance(player_meta.get("input"), dict):
        player_meta["input"] = normalize_match_input(player_meta.get("input"))
    player_meta["score"] = int(player_meta.get("score") or 0)
    player_meta["hits"] = int(player_meta.get("hits") or 0)
    player_meta["deaths"] = int(player_meta.get("deaths") or 0)
    player_meta["shots"] = int(player_meta.get("shots") or 0)
    player_meta["radius"] = float(player_meta.get("radius") or PLAYER_RADIUS)
    player_meta["flash"] = float(player_meta.get("flash") or 0.0)
    player_meta["cooldown"] = float(player_meta.get("cooldown") or 0.0)
    player_meta["last_fire_seq"] = int(player_meta.get("last_fire_seq") or 0)
    player_meta["last_ack_input_seq"] = int(player_meta.get("last_ack_input_seq") or 0)
    player_meta["alive"] = bool(player_meta.get("alive", True))
    player_meta["respawn_at_ms"] = int(player_meta.get("respawn_at_ms") or 0)
    player_meta["weapon"] = str(player_meta.get("weapon") or "default")
    player_meta["shotgun_ammo"] = max(0, int(player_meta.get("shotgun_ammo") or 0))
    player_meta["minigun_ammo"] = max(0, int(player_meta.get("minigun_ammo") or 0))
    player_meta["double_barrel_ammo"] = max(0, int(player_meta.get("double_barrel_ammo") or 0))
    player_meta["minigun_spinup"] = float(player_meta.get("minigun_spinup") or 0.0)
    player_meta["minigun_idle"] = float(player_meta.get("minigun_idle") or 0.0)
    player_meta["minigun_shot_accum"] = float(player_meta.get("minigun_shot_accum") or 0.0)
    player_meta["shield_started_at_ms"] = int(player_meta.get("shield_started_at_ms") or 0)
    player_meta["shield_until_ms"] = int(player_meta.get("shield_until_ms") or 0)
    player_meta["shield_visible_until_ms"] = int(player_meta.get("shield_visible_until_ms") or 0)
    player_meta["shield_radius"] = float(player_meta.get("shield_radius") or SHIELD_RADIUS)
    return player_meta


def build_active_player_summaries(state: dict[str, object]) -> list[dict[str, object]]:
    votes = state.get("votes")
    votes = votes if isinstance(votes, dict) else {}
    players = sorted(get_active_players(state).values(), key=build_player_sort_key)
    summaries: list[dict[str, object]] = []
    for player_meta in players:
        player_id = str(player_meta.get("player_id") or "")
        summaries.append(
            {
                "player_id": player_id,
                "country_code": str(player_meta.get("country_code") or ""),
                "color": normalize_color(player_meta.get("color")),
                "score": int(player_meta.get("score") or 0),
                "hits": int(player_meta.get("hits") or 0),
                "deaths": int(player_meta.get("deaths") or 0),
                "latency_ms": normalize_latency_ms(player_meta.get("latency_ms")),
                "connected": True,
                "voted": player_id in votes,
            }
        )
    return summaries


def build_vote_markers(state: dict[str, object]) -> list[dict[str, object]]:
    votes = state.get("votes")
    votes = votes if isinstance(votes, dict) else {}
    active_players = {str(player.get("player_id") or ""): player for player in build_active_player_summaries(state)}
    markers: list[dict[str, object]] = []
    for player_id in [summary["player_id"] for summary in build_active_player_summaries(state)]:
        player_meta = active_players.get(player_id)
        if not player_meta or player_id not in votes:
            continue
        markers.append(
            {
                "player_id": player_id,
                "country_code": str(player_meta.get("country_code") or ""),
                "color": normalize_color(player_meta.get("color")),
            }
        )
    return markers


def prune_players(state: dict[str, object], current_ms: int) -> None:
    players = state.get("players")
    if not isinstance(players, dict):
        players = {}
        state["players"] = players
    revisions = state.get("player_revisions")
    if not isinstance(revisions, dict):
        revisions = {}
        state["player_revisions"] = revisions

    cutoff_ms = current_ms - int(ACTIVE_TTL_SECONDS * 1000)
    stale_player_ids: list[str] = []
    for player_id, player_meta in list(players.items()):
        if not isinstance(player_meta, dict):
            stale_player_ids.append(str(player_id))
            continue
        if int(player_meta.get("last_seen_ms") or 0) < cutoff_ms:
            stale_player_ids.append(str(player_id))

    for player_id in stale_player_ids:
        player_meta = players.get(player_id)
        revisions[player_id] = int((player_meta or {}).get("revision") or revisions.get(player_id) or 0) + 1
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

    if not players:
        clear_powerup_state(state)


def update_player(state: dict[str, object], player_id: str, country_code: str, current_ms: int) -> None:
    players = state.setdefault("players", {})
    if not isinstance(players, dict):
        players = {}
        state["players"] = players
    revisions = state.setdefault("player_revisions", {})
    if not isinstance(revisions, dict):
        revisions = {}
        state["player_revisions"] = revisions

    current = players.get(player_id)
    joined_at_ms = current.get("joined_at_ms") if isinstance(current, dict) else current_ms
    next_value = current.copy() if isinstance(current, dict) else {}
    next_value["player_id"] = player_id
    if country_code or not next_value.get("country_code"):
        next_value["country_code"] = country_code
    next_value["joined_at_ms"] = int(joined_at_ms or current_ms)
    next_value["last_seen_ms"] = current_ms
    next_value["revision"] = int(next_value.get("revision") or revisions.get(player_id) or 0)
    next_value["latency_ms"] = normalize_latency_ms(next_value.get("latency_ms"))
    players[player_id] = next_value


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

    reset_match_world(state, current_ms)


def build_response(state: dict[str, object], room: str, player_id: str | None, current_ms: int) -> dict[str, object]:
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
    active_players = build_active_player_summaries(state)
    voters = build_vote_markers(state)
    occupied_colors = occupied_colors_for_state(state)
    available_colors = available_colors_for_state(state)
    local_player = players.get(player_id) if player_id else None

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
        "local_player_voted": bool(player_id and player_id in votes),
        "local_player_color": normalize_optional_color(local_player.get("color") if isinstance(local_player, dict) else ""),
        "local_player_present": bool(player_id and isinstance(local_player, dict)),
        "active_players": active_players,
        "voters": voters,
        "occupied_colors": occupied_colors,
        "available_colors": available_colors,
        "room_full": len(available_colors) == 0,
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


def apply_reported_match_player_state(
    player_meta: dict[str, object],
    local_player: dict[str, float] | None,
    walls: list[dict[str, float]],
) -> None:
    if local_player is None or not bool(player_meta.get("alive", True)):
        return

    radius = float(player_meta.get("radius") or PLAYER_RADIUS)
    min_x = ARENA_X + radius
    max_x = ARENA_X + ARENA_WIDTH - radius
    min_y = ARENA_Y + radius
    max_y = ARENA_Y + ARENA_HEIGHT - radius
    candidate_x = clamp(float(local_player.get("x") or 0.0), min_x, max_x)
    candidate_y = clamp(float(local_player.get("y") or 0.0), min_y, max_y)
    candidate = {"x": candidate_x, "y": candidate_y, "radius": radius + 0.75}
    if any(circle_intersects_rect(candidate, wall) for wall in walls):
        return

    player_meta["x"] = candidate_x
    player_meta["y"] = candidate_y
    player_meta["angle"] = float(local_player.get("angle") or 0.0)
    player_meta["radius"] = radius


def separate_match_players(players: dict[str, dict[str, object]], walls: list[dict[str, float]]) -> None:
    living = [player for player in players.values() if bool(player.get("alive", True))]
    for _ in range(2):
        moved_any = False
        for index, left in enumerate(living):
            for right in living[index + 1 :]:
                radius_left = float(left.get("radius") or PLAYER_RADIUS)
                radius_right = float(right.get("radius") or PLAYER_RADIUS)
                delta_x = float(left.get("x") or 0.0) - float(right.get("x") or 0.0)
                delta_y = float(left.get("y") or 0.0) - float(right.get("y") or 0.0)
                gap = math.hypot(delta_x, delta_y)
                minimum_gap = radius_left + radius_right + 0.75
                if gap >= minimum_gap or gap <= 0.001:
                    continue

                overlap = minimum_gap - gap
                normal_x = delta_x / gap
                normal_y = delta_y / gap
                move_x = normal_x * overlap * 0.5
                move_y = normal_y * overlap * 0.5

                moved_left = try_move_entity(left, float(left.get("x") or 0.0) + move_x, float(left.get("y") or 0.0) + move_y, walls)
                moved_right = try_move_entity(
                    right,
                    float(right.get("x") or 0.0) - move_x,
                    float(right.get("y") or 0.0) - move_y,
                    walls,
                )
                moved_any = moved_any or moved_left or moved_right
        if not moved_any:
            return


def spawn_match_bullet(
    room_state: dict[str, object],
    player_meta: dict[str, object],
    angle: float,
    *,
    radius: float = BULLET_RADIUS,
    speed: float = BULLET_SPEED,
    lateral_offset: float = 0.0,
    projectile_type: str = "bullet",
    life: float = BULLET_LIFE,
) -> dict[str, object]:
    bullet_id = int(room_state.get("next_bullet_id") or 1)
    color = normalize_color(player_meta.get("color"))
    walls = build_training_walls(int(room_state.get("map_seed") or 1))
    spawn_x, spawn_y = safe_fire_spawn_point(
        player_meta,
        angle,
        walls,
        projectile_radius=radius,
        lateral_offset=lateral_offset,
    )
    bullet = {
        "id": bullet_id,
        "owner_id": str(player_meta.get("player_id") or ""),
        "owner_revision": int(player_meta.get("revision") or 0),
        "color": color,
        "projectile_type": projectile_type,
        "x": spawn_x,
        "y": spawn_y,
        "radius": radius,
        "vx": math.cos(angle) * speed,
        "vy": math.sin(angle) * speed,
        "life": life,
        "bouncesLeft": BULLET_BOUNCES,
        "age": 0.0,
        "has_bounced": False,
        "owner_shield_released": False,
    }
    room_state["next_bullet_id"] = bullet_id + 1
    return bullet


def spawn_shotgun_pellets(room_state: dict[str, object], player_meta: dict[str, object], current_ms: int) -> list[dict[str, object]]:
    angle = float(player_meta.get("angle") or 0.0)
    rng = create_seeded_random(
        (
            int(room_state.get("map_seed") or 1)
            ^ int(room_state.get("next_bullet_id") or 1)
            ^ string_seed(player_meta.get("player_id"))
            ^ int(current_ms & 0xFFFFFFFF)
            ^ 0x51A7E11
        )
        & 0xFFFFFFFF
    )
    pellets: list[dict[str, object]] = []
    for _ in range(SHOTGUN_PELLET_COUNT):
        pellet_angle = angle + (rng() - 0.5) * SHOTGUN_CONE_RADIANS
        pellet_speed = SHOTGUN_MIN_SPEED + rng() * (SHOTGUN_MAX_SPEED - SHOTGUN_MIN_SPEED)
        lateral_offset = (rng() - 0.5) * SHOTGUN_BARREL_WIDTH
        pellets.append(
            spawn_match_bullet(
                room_state,
                player_meta,
                pellet_angle,
                radius=SHOTGUN_PELLET_RADIUS,
                speed=pellet_speed,
                lateral_offset=lateral_offset,
                projectile_type="shotgun",
                life=SHOTGUN_PELLET_LIFE,
            )
        )
    return pellets


def spawn_laser_bullet(room_state: dict[str, object], player_meta: dict[str, object], current_ms: int) -> dict[str, object]:
    angle = float(player_meta.get("angle") or 0.0)
    walls = build_training_walls(int(room_state.get("map_seed") or 1))
    spawn_x, spawn_y = safe_fire_spawn_point(
        player_meta,
        angle,
        walls,
        projectile_radius=LASER_RADIUS,
    )
    path_segments = build_reflected_ray_segments(
        spawn_x,
        spawn_y,
        angle,
        LASER_SPEED * LASER_LIFE + LASER_LENGTH,
        walls,
        max_bounces=12,
        shields=active_shields(
            get_active_players(room_state),
            current_ms,
            include_visual=True,
        ),
    )
    bullet = spawn_match_bullet(
        room_state,
        player_meta,
        angle,
        radius=LASER_RADIUS,
        speed=LASER_SPEED,
        projectile_type="laser",
        life=LASER_LIFE,
    )
    bullet["x"] = spawn_x
    bullet["y"] = spawn_y
    bullet["path_segments"] = path_segments
    bullet["segments"] = slice_path_segments(path_segments, 0.0, LASER_LENGTH)
    bullet["distance_travelled"] = 0.0
    return bullet


def minigun_lateral_offset(player_meta: dict[str, object]) -> float:
    ammo_before_shot = max(0, int(player_meta.get("minigun_ammo") or 0))
    shot_index = max(0, MINIGUN_AMMO - ammo_before_shot)
    pattern = MINIGUN_BARREL_OFFSET_PATTERN[shot_index % len(MINIGUN_BARREL_OFFSET_PATTERN)]
    return float(pattern * MINIGUN_BARREL_WIDTH)


def spawn_minigun_bullet(room_state: dict[str, object], player_meta: dict[str, object]) -> dict[str, object]:
    return spawn_match_bullet(
        room_state,
        player_meta,
        float(player_meta.get("angle") or 0.0),
        radius=MINIGUN_BULLET_RADIUS,
        speed=MINIGUN_BULLET_SPEED,
        lateral_offset=minigun_lateral_offset(player_meta),
        projectile_type="minigun",
        life=MINIGUN_BULLET_LIFE,
    )


def double_barrel_lateral_offset(player_meta: dict[str, object]) -> float:
    ammo_before_shot = max(0, int(player_meta.get("double_barrel_ammo") or 0))
    shot_index = max(0, DOUBLE_BARREL_AMMO - ammo_before_shot)
    return (-1.0 if shot_index % 2 == 0 else 1.0) * DOUBLE_BARREL_BARREL_OFFSET


def spawn_double_barrel_bullet(room_state: dict[str, object], player_meta: dict[str, object]) -> dict[str, object]:
    return spawn_match_bullet(
        room_state,
        player_meta,
        float(player_meta.get("angle") or 0.0),
        radius=BULLET_RADIUS,
        speed=BULLET_SPEED,
        lateral_offset=double_barrel_lateral_offset(player_meta),
        projectile_type="double_barrel",
        life=BULLET_LIFE,
    )


def serialize_bullet_segments(bullet: dict[str, object]) -> list[dict[str, float]]:
    return [
        {
            "x1": float(segment.get("x1") or 0.0),
            "y1": float(segment.get("y1") or 0.0),
            "x2": float(segment.get("x2") or 0.0),
            "y2": float(segment.get("y2") or 0.0),
        }
        for segment in bullet.get("segments", [])
        if isinstance(segment, dict)
    ]


def serialize_bullet_path_segments(bullet: dict[str, object]) -> list[dict[str, float]]:
    return [
        {
            "x1": float(segment.get("x1") or 0.0),
            "y1": float(segment.get("y1") or 0.0),
            "x2": float(segment.get("x2") or 0.0),
            "y2": float(segment.get("y2") or 0.0),
        }
        for segment in bullet.get("path_segments", [])
        if isinstance(segment, dict)
    ]


def segment_circle_hit_test(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    circle_x: float,
    circle_y: float,
    hit_radius: float,
) -> bool:
    seg_len_sq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
    if seg_len_sq <= 0.001:
        return distance(circle_x, circle_y, x1, y1) < hit_radius
    t = clamp(((circle_x - x1) * (x2 - x1) + (circle_y - y1) * (y2 - y1)) / seg_len_sq, 0.0, 1.0)
    closest_x = x1 + (x2 - x1) * t
    closest_y = y1 + (y2 - y1) * t
    return distance(circle_x, circle_y, closest_x, closest_y) < hit_radius


def segment_circle_collision(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    circle_x: float,
    circle_y: float,
    hit_radius: float,
) -> dict[str, float] | None:
    dx = x2 - x1
    dy = y2 - y1
    a = dx * dx + dy * dy
    if a <= 0.001:
        if distance(x1, y1, circle_x, circle_y) >= hit_radius:
            return None
        normal_x = x1 - circle_x
        normal_y = y1 - circle_y
        normal_length = max(0.0001, math.hypot(normal_x, normal_y))
        return {"t": 0.0, "x": x1, "y": y1, "normal_x": normal_x / normal_length, "normal_y": normal_y / normal_length}

    origin_x = x1 - circle_x
    origin_y = y1 - circle_y
    b = 2.0 * (origin_x * dx + origin_y * dy)
    c = origin_x * origin_x + origin_y * origin_y - hit_radius * hit_radius
    discriminant = b * b - 4.0 * a * c
    candidates: list[float] = []
    if discriminant >= 0:
        sqrt_discriminant = math.sqrt(discriminant)
        candidates.extend(
            value
            for value in (
                (-b - sqrt_discriminant) / (2.0 * a),
                (-b + sqrt_discriminant) / (2.0 * a),
            )
            if 0.0 <= value <= 1.0
        )
    if not candidates and c < 0:
        candidates.append(0.0)
    if not candidates:
        return None

    t = min(candidates)
    hit_x = x1 + dx * t
    hit_y = y1 + dy * t
    normal_x = hit_x - circle_x
    normal_y = hit_y - circle_y
    normal_length = math.hypot(normal_x, normal_y)
    if normal_length <= 0.0001:
        normal_x = -dx
        normal_y = -dy
        normal_length = max(0.0001, math.hypot(normal_x, normal_y))
    return {
        "t": t,
        "x": hit_x,
        "y": hit_y,
        "normal_x": normal_x / normal_length,
        "normal_y": normal_y / normal_length,
    }


def bullet_has_left_owner_shield(bullet: dict[str, object], players: dict[str, dict[str, object]]) -> bool:
    if bool(bullet.get("owner_shield_released")):
        return True
    owner_meta = players.get(str(bullet.get("owner_id") or ""))
    if not isinstance(owner_meta, dict):
        return True
    owner_shield_until_ms = max(
        int(owner_meta.get("shield_until_ms") or 0),
        int(owner_meta.get("shield_visible_until_ms") or 0),
    )
    if owner_shield_until_ms <= 0:
        return True
    owner_x = float(owner_meta.get("x") or 0.0)
    owner_y = float(owner_meta.get("y") or 0.0)
    owner_shield_radius = float(owner_meta.get("shield_radius") or SHIELD_RADIUS) + float(bullet.get("radius") or BULLET_RADIUS)
    bullet_x = float(bullet.get("x") or 0.0)
    bullet_y = float(bullet.get("y") or 0.0)
    if distance(bullet_x, bullet_y, owner_x, owner_y) > owner_shield_radius + 2.0:
        bullet["owner_shield_released"] = True
        return True
    return False


def reflect_bullet_from_shields(
    bullet: dict[str, object],
    previous_x: float,
    previous_y: float,
    players: dict[str, dict[str, object]],
    current_ms: int,
) -> bool:
    allow_owner_shield = bullet_has_left_owner_shield(bullet, players)
    for shield in active_shields(players, current_ms, include_visual=True):
        shield_owner_id = str(shield.get("player_id") or "")
        if shield_owner_id == str(bullet.get("owner_id") or "") and not allow_owner_shield:
            continue
        shield_x = float(shield.get("x") or 0.0)
        shield_y = float(shield.get("y") or 0.0)
        shield_radius = float(shield.get("radius") or SHIELD_RADIUS) + float(bullet.get("radius") or BULLET_RADIUS)
        collision = segment_circle_collision(
            previous_x,
            previous_y,
            float(bullet.get("x") or 0.0),
            float(bullet.get("y") or 0.0),
            shield_x,
            shield_y,
            shield_radius,
        )
        if collision is None:
            continue
        normal_x = float(collision["normal_x"])
        normal_y = float(collision["normal_y"])
        dot = float(bullet.get("vx") or 0.0) * normal_x + float(bullet.get("vy") or 0.0) * normal_y
        bullet["vx"] = float(bullet.get("vx") or 0.0) - 2.0 * dot * normal_x
        bullet["vy"] = float(bullet.get("vy") or 0.0) - 2.0 * dot * normal_y
        bullet["bouncesLeft"] = int(bullet.get("bouncesLeft") or 0) - 1
        bullet["has_bounced"] = True
        bullet["x"] = shield_x + normal_x * (shield_radius + 2.5)
        bullet["y"] = shield_y + normal_y * (shield_radius + 2.5)
        bullet["last_shield_hit_id"] = shield_owner_id
        bullet["shield_hit_x"] = float(collision["x"])
        bullet["shield_hit_y"] = float(collision["y"])
        bullet["owner_shield_released"] = True
        return True
    return False


def candidate_shield_blocks_bullet(
    bullet: dict[str, object],
    candidate_meta: dict[str, object],
    current_ms: int,
) -> bool:
    if int(candidate_meta.get("shield_visible_until_ms") or 0) <= current_ms:
        return False
    if str(bullet.get("last_shield_hit_id") or "") == str(candidate_meta.get("player_id") or ""):
        return True
    if str(bullet.get("owner_id") or "") == str(candidate_meta.get("player_id") or "") and not bool(bullet.get("owner_shield_released")):
        return False
    candidate_x = float(candidate_meta.get("x") or 0.0)
    candidate_y = float(candidate_meta.get("y") or 0.0)
    shield_radius = float(candidate_meta.get("shield_radius") or SHIELD_RADIUS) + float(bullet.get("radius") or BULLET_RADIUS)
    if str(bullet.get("projectile_type") or "bullet") == "laser":
        laser_segments = [
            segment
            for segment in [
                *(bullet.get("_previous_segments", []) if isinstance(bullet.get("_previous_segments"), list) else []),
                *(bullet.get("segments", []) if isinstance(bullet.get("segments"), list) else []),
            ]
            if isinstance(segment, dict)
        ]
        return any(
            segment_circle_hit_test(
                float(segment.get("x1") or 0.0),
                float(segment.get("y1") or 0.0),
                float(segment.get("x2") or 0.0),
                float(segment.get("y2") or 0.0),
                candidate_x,
                candidate_y,
                shield_radius,
            )
            for segment in laser_segments
        )

    return segment_circle_hit_test(
        float(bullet.get("_previous_x", bullet.get("x")) or 0.0),
        float(bullet.get("_previous_y", bullet.get("y")) or 0.0),
        float(bullet.get("x") or 0.0),
        float(bullet.get("y") or 0.0),
        candidate_x,
        candidate_y,
        shield_radius,
    )


def player_has_visible_shield(player_meta: dict[str, object], current_ms: int) -> bool:
    return int(player_meta.get("shield_visible_until_ms") or 0) > current_ms


def bullet_hit_test(bullet: dict[str, object], candidate_meta: dict[str, object]) -> bool:
    candidate_x = float(candidate_meta.get("x") or 0.0)
    candidate_y = float(candidate_meta.get("y") or 0.0)
    candidate_radius = float(candidate_meta.get("radius") or PLAYER_RADIUS)
    bullet_radius = float(bullet.get("radius") or BULLET_RADIUS)
    if str(bullet.get("projectile_type") or "bullet") == "laser":
        previous_segments = bullet.get("_previous_segments", [])
        current_segments = bullet.get("segments", [])
        laser_segments = [
            segment
            for segment in [
                *(previous_segments if isinstance(previous_segments, list) else []),
                *(current_segments if isinstance(current_segments, list) else []),
            ]
            if isinstance(segment, dict)
        ]
        for segment in laser_segments:
            if not isinstance(segment, dict):
                continue
            x1 = float(segment.get("x1") or 0.0)
            y1 = float(segment.get("y1") or 0.0)
            x2 = float(segment.get("x2") or 0.0)
            y2 = float(segment.get("y2") or 0.0)
            if segment_circle_hit_test(x1, y1, x2, y2, candidate_x, candidate_y, candidate_radius + bullet_radius):
                return True
        return False

    previous_x = float(bullet.get("_previous_x", bullet.get("x")) or 0.0)
    previous_y = float(bullet.get("_previous_y", bullet.get("y")) or 0.0)
    current_x = float(bullet.get("x") or 0.0)
    current_y = float(bullet.get("y") or 0.0)
    return segment_circle_hit_test(
        previous_x,
        previous_y,
        current_x,
        current_y,
        candidate_x,
        candidate_y,
        candidate_radius + bullet_radius,
    )



def reset_match_world(state: dict[str, object], current_ms: int) -> None:
    next_seed = generate_map_seed()
    state["map_seed"] = next_seed
    state["map_id"] = map_id_from_seed(next_seed)
    state["votes"] = {}
    state["countdown_deadline_ms"] = 0
    state["latency_tests"] = {}
    state["targets"] = []
    clear_powerup_state(state)
    schedule_next_powerup_spawn(state, current_ms)
    state["death_events"] = []
    state["bullets"] = []
    state["next_bullet_id"] = 1
    state["last_tick_ms"] = current_ms

    players = get_active_players(state)
    for player_id in list(players.keys()):
        players[player_id]["map_seed"] = next_seed
        spawn_match_player(state, player_id, current_ms, preserve_stats=True)
        reset_match_combat_state(players[player_id])

    state["targets"] = []
    clear_powerup_state(state)
    schedule_next_powerup_spawn(state, current_ms)
    state["death_events"] = []
    state["snapshot_seq"] = int(state.get("snapshot_seq") or 0) + 1
    state["updated_at_ms"] = current_ms


def build_match_state(
    state: dict[str, object],
    room: str,
    player_id: str,
    current_ms: int,
) -> dict[str, object]:
    room_state = build_response(state, room, player_id, current_ms)
    players = get_active_players(state)
    ordered_players = sorted(players.values(), key=build_player_sort_key)
    local_player_meta = players.get(player_id)
    room_state.update(
        {
            "snapshot_seq": int(state.get("snapshot_seq") or 0),
            "ack_input_seq": int(players.get(player_id, {}).get("last_ack_input_seq") or 0),
            "local_state": (
                {
                    "player_id": str(local_player_meta.get("player_id") or ""),
                    "country_code": str(local_player_meta.get("country_code") or ""),
                    "color": normalize_color(local_player_meta.get("color")),
                    "weapon": str(local_player_meta.get("weapon") or "default"),
                    "shotgun_ammo": max(0, int(local_player_meta.get("shotgun_ammo") or 0)),
                    "minigun_ammo": max(0, int(local_player_meta.get("minigun_ammo") or 0)),
                    "double_barrel_ammo": max(0, int(local_player_meta.get("double_barrel_ammo") or 0)),
                    "weapon_reload_ms": max(0, int(float(local_player_meta.get("cooldown") or 0.0) * 1000)),
                    "shield_active_ms": max(0, int(local_player_meta.get("shield_until_ms") or 0) - current_ms),
                    "shield_visible_ms": max(0, int(local_player_meta.get("shield_visible_until_ms") or 0) - current_ms),
                    "shield_elapsed_ms": max(0, current_ms - int(local_player_meta.get("shield_started_at_ms") or current_ms)),
                    "shield_radius": float(local_player_meta.get("shield_radius") or SHIELD_RADIUS),
                    "x": float(local_player_meta.get("x") or -9999.0),
                    "y": float(local_player_meta.get("y") or -9999.0),
                    "angle": float(local_player_meta.get("angle") or 0.0),
                    "radius": float(local_player_meta.get("radius") or PLAYER_RADIUS),
                    "flash": float(local_player_meta.get("flash") or 0.0),
                    "score": int(local_player_meta.get("score") or 0),
                    "hits": int(local_player_meta.get("hits") or 0),
                    "deaths": int(local_player_meta.get("deaths") or 0),
                    "shots": int(local_player_meta.get("shots") or 0),
                    "fire_ack_seq": int(local_player_meta.get("last_fire_seq") or 0),
                    "alive": bool(local_player_meta.get("alive", True)),
                    "respawn_in_ms": max(0, int(local_player_meta.get("respawn_at_ms") or 0) - current_ms),
                    "latency_ms": normalize_latency_ms(local_player_meta.get("latency_ms")),
                    "server_time_ms": current_ms,
                }
                if isinstance(local_player_meta, dict)
                else None
            ),
            "players": [
                {
                    "player_id": str(player_meta.get("player_id") or ""),
                    "country_code": str(player_meta.get("country_code") or ""),
                    "color": normalize_color(player_meta.get("color")),
                    "weapon": str(player_meta.get("weapon") or "default"),
                    "shotgun_ammo": max(0, int(player_meta.get("shotgun_ammo") or 0)),
                    "minigun_ammo": max(0, int(player_meta.get("minigun_ammo") or 0)),
                    "double_barrel_ammo": max(0, int(player_meta.get("double_barrel_ammo") or 0)),
                    "weapon_reload_ms": max(0, int(float(player_meta.get("cooldown") or 0.0) * 1000)),
                    "shield_active_ms": max(0, int(player_meta.get("shield_until_ms") or 0) - current_ms),
                    "shield_visible_ms": max(0, int(player_meta.get("shield_visible_until_ms") or 0) - current_ms),
                    "shield_elapsed_ms": max(0, current_ms - int(player_meta.get("shield_started_at_ms") or current_ms)),
                    "shield_radius": float(player_meta.get("shield_radius") or SHIELD_RADIUS),
                    "x": float(player_meta.get("x") or -9999.0),
                    "y": float(player_meta.get("y") or -9999.0),
                    "angle": float(player_meta.get("angle") or 0.0),
                    "radius": float(player_meta.get("radius") or PLAYER_RADIUS),
                    "flash": float(player_meta.get("flash") or 0.0),
                    "score": int(player_meta.get("score") or 0),
                    "hits": int(player_meta.get("hits") or 0),
                    "deaths": int(player_meta.get("deaths") or 0),
                    "shots": int(player_meta.get("shots") or 0),
                    "alive": bool(player_meta.get("alive", True)),
                    "respawn_in_ms": max(0, int(player_meta.get("respawn_at_ms") or 0) - current_ms),
                    "latency_ms": normalize_latency_ms(player_meta.get("latency_ms")),
                    "input": normalize_match_input(player_meta.get("input")),
                    "server_time_ms": current_ms,
                }
                for player_meta in ordered_players
                if str(player_meta.get("player_id") or "") != player_id
            ],
            "bullets": [
                {
                    "id": int(bullet.get("id") or 0),
                    "owner_id": str(bullet.get("owner_id") or ""),
                    "color": normalize_color(bullet.get("color")),
                    "projectile_type": str(bullet.get("projectile_type") or "bullet"),
                    "x": float(bullet.get("x") or 0.0),
                    "y": float(bullet.get("y") or 0.0),
                    "radius": float(bullet.get("radius") or BULLET_RADIUS),
                    "vx": float(bullet.get("vx") or 0.0),
                    "vy": float(bullet.get("vy") or 0.0),
                    "life": float(bullet.get("life") or 0.0),
                    "age": float(bullet.get("age") or 0.0),
                    "bounces_left": int(bullet.get("bouncesLeft") or 0),
                    "has_bounced": bool(bullet.get("has_bounced", False)),
                    "path_segments": serialize_bullet_path_segments(bullet),
                    "distance_travelled": float(bullet.get("distance_travelled") or 0.0),
                    "segments": serialize_bullet_segments(bullet),
                    "server_time_ms": current_ms,
                }
                for bullet in state.get("bullets", [])
                if isinstance(bullet, dict)
            ],
            "targets": [],
            "tank_explosions": serialize_death_events(state, current_ms),
            "powerups": serialize_powerups(state),
            "powerup_effects": serialize_powerup_effects(state, current_ms),
        }
    )
    return room_state


def _serialize_match_players(state: dict[str, object], current_ms: int) -> list[dict[str, object]]:
    return [
        {
            "player_id": str(player_meta.get("player_id") or ""),
            "country_code": str(player_meta.get("country_code") or ""),
            "color": normalize_color(player_meta.get("color")),
            "weapon": str(player_meta.get("weapon") or "default"),
            "shotgun_ammo": max(0, int(player_meta.get("shotgun_ammo") or 0)),
            "minigun_ammo": max(0, int(player_meta.get("minigun_ammo") or 0)),
            "double_barrel_ammo": max(0, int(player_meta.get("double_barrel_ammo") or 0)),
            "weapon_reload_ms": max(0, int(float(player_meta.get("cooldown") or 0.0) * 1000)),
            "shield_active_ms": max(0, int(player_meta.get("shield_until_ms") or 0) - current_ms),
            "shield_visible_ms": max(0, int(player_meta.get("shield_visible_until_ms") or 0) - current_ms),
            "shield_elapsed_ms": max(0, current_ms - int(player_meta.get("shield_started_at_ms") or current_ms)),
            "shield_radius": float(player_meta.get("shield_radius") or SHIELD_RADIUS),
            "x": float(player_meta.get("x") or -9999.0),
            "y": float(player_meta.get("y") or -9999.0),
            "angle": float(player_meta.get("angle") or 0.0),
            "radius": float(player_meta.get("radius") or PLAYER_RADIUS),
            "flash": float(player_meta.get("flash") or 0.0),
            "score": int(player_meta.get("score") or 0),
            "hits": int(player_meta.get("hits") or 0),
            "deaths": int(player_meta.get("deaths") or 0),
            "shots": int(player_meta.get("shots") or 0),
            "alive": bool(player_meta.get("alive", True)),
            "respawn_in_ms": max(0, int(player_meta.get("respawn_at_ms") or 0) - current_ms),
            "latency_ms": normalize_latency_ms(player_meta.get("latency_ms")),
            "input": normalize_match_input(player_meta.get("input")),
            "server_time_ms": current_ms,
        }
        for player_meta in sorted(get_active_players(state).values(), key=build_player_sort_key)
    ]


def _serialize_match_bullets(state: dict[str, object], current_ms: int) -> list[dict[str, object]]:
    raw_bullets = state.get("bullets")
    bullets = raw_bullets if isinstance(raw_bullets, list) else []
    return [
        {
            "id": int(bullet.get("id") or 0),
            "owner_id": str(bullet.get("owner_id") or ""),
            "color": normalize_color(bullet.get("color")),
            "projectile_type": str(bullet.get("projectile_type") or "bullet"),
            "x": float(bullet.get("x") or 0.0),
            "y": float(bullet.get("y") or 0.0),
            "radius": float(bullet.get("radius") or BULLET_RADIUS),
            "vx": float(bullet.get("vx") or 0.0),
            "vy": float(bullet.get("vy") or 0.0),
            "life": float(bullet.get("life") or 0.0),
            "age": float(bullet.get("age") or 0.0),
            "bounces_left": int(bullet.get("bouncesLeft") or bullet.get("bounces_left") or 0),
            "has_bounced": bool(bullet.get("has_bounced", False)),
            "owner_shield_released": bool(bullet.get("owner_shield_released", True)),
            "path_segments": serialize_bullet_path_segments(bullet),
            "distance_travelled": float(bullet.get("distance_travelled") or 0.0),
            "segments": serialize_bullet_segments(bullet),
            "server_time_ms": current_ms,
        }
        for bullet in bullets
        if isinstance(bullet, dict)
    ]


def _serialize_match_targets(state: dict[str, object]) -> list[dict[str, object]]:
    raw_targets = state.get("targets")
    targets = raw_targets if isinstance(raw_targets, list) else []
    return [
        {
            "id": int(target.get("id") or 0),
            "x": float(target.get("x") or 0.0),
            "y": float(target.get("y") or 0.0),
            "radius": float(target.get("radius") or TARGET_RADIUS),
            "phase": float(target.get("phase") or 0.0),
        }
        for target in targets
        if isinstance(target, dict)
    ]


def tick_spectator_world(state: dict[str, object], current_ms: int) -> bool:
    # During active play, match_sync is the authority. Spectator GETs stay read-only
    # so a monitor tab cannot perturb multiplayer timing.
    if get_active_players(state):
        return False

    raw_bullets = state.get("bullets")
    if not isinstance(raw_bullets, list) or not raw_bullets:
        return False

    last_tick_ms = int(state.get("last_tick_ms") or current_ms)
    elapsed_sec = max(0.0, (current_ms - last_tick_ms) / 1000.0)
    if elapsed_sec <= 0:
        return False

    # If a room has been empty for longer than the maximum bullet lifetime,
    # do not replay stale projectiles slowly when a monitor tab polls again.
    max_life = max(BULLET_LIFE, LASER_LIFE, MINIGUN_BULLET_LIFE, SHOTGUN_PELLET_LIFE)
    if elapsed_sec >= max_life + 0.5:
        state["bullets"] = []
        state["last_tick_ms"] = current_ms
        state["updated_at_ms"] = current_ms
        state["snapshot_seq"] = int(state.get("snapshot_seq") or 0) + 1
        return True

    walls = build_training_walls(int(state.get("map_seed") or 1))
    bullets = raw_bullets
    remaining = elapsed_sec
    max_steps = 720

    while remaining > 0 and max_steps > 0:
        step = min(0.016, remaining)
        remaining -= step
        max_steps -= 1
        next_bullets: list[dict[str, object]] = []

        for bullet in bullets:
            if not isinstance(bullet, dict):
                continue

            previous_x = float(bullet.get("x") or 0.0)
            previous_y = float(bullet.get("y") or 0.0)
            projectile_type = str(bullet.get("projectile_type") or "bullet")
            next_bullet = {
                "id": int(bullet.get("id") or 0),
                "owner_id": str(bullet.get("owner_id") or ""),
                "owner_revision": int(bullet.get("owner_revision") or 0),
                "color": normalize_color(bullet.get("color")),
                "projectile_type": projectile_type,
                "x": previous_x + float(bullet.get("vx") or 0.0) * step,
                "y": previous_y + float(bullet.get("vy") or 0.0) * step,
                "radius": float(bullet.get("radius") or BULLET_RADIUS),
                "vx": float(bullet.get("vx") or 0.0),
                "vy": float(bullet.get("vy") or 0.0),
                "life": float(bullet.get("life") or 0.0) - step,
                "bouncesLeft": int(bullet.get("bouncesLeft") or bullet.get("bounces_left") or 0),
                "age": float(bullet.get("age") or 0.0) + step,
                "has_bounced": bool(bullet.get("has_bounced", False)),
                "owner_shield_released": bool(bullet.get("owner_shield_released", False)),
            }
            if projectile_type == "laser":
                path_segments = [
                    segment
                    for segment in bullet.get("path_segments", [])
                    if isinstance(segment, dict)
                ]
                path_length = sum(
                    distance(
                        float(segment.get("x1") or 0.0),
                        float(segment.get("y1") or 0.0),
                        float(segment.get("x2") or 0.0),
                        float(segment.get("y2") or 0.0),
                    )
                    for segment in path_segments
                )
                max_distance_travelled = max(0.0, path_length - LASER_LENGTH)
                distance_travelled = clamp(
                    float(bullet.get("distance_travelled") or 0.0) + LASER_SPEED * step,
                    0.0,
                    max_distance_travelled,
                )
                next_bullet["path_segments"] = path_segments
                next_bullet["distance_travelled"] = distance_travelled
                next_bullet["segments"] = slice_path_segments(path_segments, distance_travelled, LASER_LENGTH)
                if next_bullet["segments"]:
                    head = next_bullet["segments"][-1]
                    next_bullet["x"] = float(head.get("x2") or next_bullet["x"])
                    next_bullet["y"] = float(head.get("y2") or next_bullet["y"])

            if projectile_type != "laser":
                reflect_bullet_from_shields(next_bullet, previous_x, previous_y, get_active_players(state), current_ms)
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
                    next_bullet["has_bounced"] = True
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
            next_bullets.append(next_bullet)

        bullets = next_bullets

    state["bullets"] = bullets
    state["last_tick_ms"] = current_ms
    state["updated_at_ms"] = current_ms
    state["snapshot_seq"] = int(state.get("snapshot_seq") or 0) + 1
    return True


def build_spectator_state(state: dict[str, object], room: str, current_ms: int) -> dict[str, object]:
    refresh_vote_state(state, current_ms)
    walls = build_training_walls(int(state.get("map_seed") or 1))
    room_state = build_response(state, room, None, current_ms)
    players = _serialize_match_players(state, current_ms)
    bullets = _serialize_match_bullets(state, current_ms)
    targets = _serialize_match_targets(state)
    death_events = serialize_death_events(state, current_ms)
    powerups = serialize_powerups(state)
    powerup_effects = serialize_powerup_effects(state, current_ms)
    room_state.update(
        {
            "spectator": True,
            "snapshot_seq": int(state.get("snapshot_seq") or 0),
            "server_time_ms": current_ms,
            "world": {
                "width": int(WORLD_WIDTH),
                "height": int(WORLD_HEIGHT),
                "arena": {
                    "x": ARENA_X,
                    "y": ARENA_Y,
                    "w": ARENA_WIDTH,
                    "h": ARENA_HEIGHT,
                },
                "walls": walls,
            },
            "players": players,
            "bullets": bullets,
            "targets": targets,
            "tank_explosions": death_events,
            "powerups": powerups,
            "powerup_effects": powerup_effects,
        }
    )
    return room_state


def load_spectator_state(base_dir: Path, room: str) -> dict[str, object]:
    state_path = base_dir / f"room-state-{room}.json"
    state_path.parent.mkdir(parents=True, exist_ok=True)
    current_ms = now_ms()

    with state_path.open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            handle.seek(0)
            state = load_state(state_path, room)
            previous_state_json = json.dumps(state, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            tick_spectator_world(state, current_ms)
            response = build_spectator_state(state, room, current_ms)
            next_state_json = json.dumps(state, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            if next_state_json != previous_state_json:
                handle.seek(0)
                handle.truncate()
                handle.write(json.dumps(state, ensure_ascii=False, separators=(",", ":")))
                handle.flush()
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    return response


def build_spectator_html() -> str:
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tank Trouble Live Monitor</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #030b14;
        --panel: rgba(7, 17, 31, 0.82);
        --panel-strong: rgba(8, 21, 37, 0.94);
        --line: rgba(103, 232, 249, 0.18);
        --text: #e7f6ff;
        --muted: #8da6c2;
        --accent: #67e8f9;
        --warn: #fbbf24;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body {
        background:
          radial-gradient(circle at 18% 12%, rgba(34, 211, 238, 0.18), transparent 28%),
          radial-gradient(circle at 88% 40%, rgba(59, 130, 246, 0.16), transparent 30%),
          linear-gradient(160deg, #020711, var(--bg) 52%, #07172a);
        color: var(--text);
        font: 500 14px/1.5 "Segoe UI", "Microsoft YaHei UI", sans-serif;
        overflow: hidden;
      }

      .shell {
        width: 100vw;
        height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 1fr) clamp(232px, 22vw, 292px);
        gap: 14px;
        padding: 14px;
      }

      .stage-card, .score-card {
        min-width: 0;
        min-height: 0;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
        backdrop-filter: blur(18px);
        overflow: hidden;
      }

      .stage-card {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
      }

      .stage-frame {
        position: relative;
        width: min(100%, calc((100vh - 52px) * 1.6));
        height: auto;
        aspect-ratio: 1280 / 800;
        flex: 0 1 auto;
        border-radius: 20px;
        overflow: hidden;
        background: #04101d;
        box-shadow:
          inset 0 0 0 1px rgba(148, 163, 184, 0.12),
          0 18px 48px rgba(0, 0, 0, 0.28);
      }

      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }

      .hud {
        position: absolute;
        left: 16px;
        top: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 11px;
        border-radius: 999px;
        background: rgba(2, 6, 23, 0.42);
        border: 1px solid rgba(103, 232, 249, 0.16);
        backdrop-filter: blur(12px);
        color: var(--muted);
        font-size: 12px;
        pointer-events: none;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 16px rgba(34, 197, 94, 0.85);
      }

      .dot.warn {
        background: var(--warn);
        box-shadow: 0 0 16px rgba(251, 191, 36, 0.85);
      }

      .empty {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        text-align: center;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(2, 6, 23, 0.05), rgba(2, 6, 23, 0.22));
      }

      .empty[hidden] { display: none; }
      .empty-card {
        max-width: 430px;
        border-radius: 22px;
        border: 1px solid rgba(103, 232, 249, 0.16);
        background: rgba(2, 6, 23, 0.46);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
        padding: 20px 24px;
        backdrop-filter: blur(14px);
      }
      .empty-title { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; }
      .empty-note { margin-top: 8px; color: var(--muted); }

      .score-card {
        display: flex;
        flex-direction: column;
        background:
          linear-gradient(180deg, rgba(14, 116, 144, 0.12), transparent 34%),
          var(--panel);
      }

      .score-head {
        padding: 18px 18px 14px;
        border-bottom: 1px solid var(--line);
      }

      .score-kicker {
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.11em;
        font-size: 11px;
        font-weight: 900;
      }

      .score-title {
        margin-top: 6px;
        font-size: 20px;
        font-weight: 850;
      }

      .score-subtitle {
        margin-top: 5px;
        color: var(--muted);
        font-size: 12px;
      }

      .score-list {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .score-empty {
        margin: auto;
        color: var(--muted);
        text-align: center;
      }

      .score-row {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.54);
        border: 1px solid rgba(148, 163, 184, 0.1);
      }

      .rank {
        min-width: 32px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--muted);
        font-size: 12px;
      }
      .rank-medal {
        width: 32px;
        height: 32px;
        display: block;
        object-fit: contain;
        filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.34));
      }
      .player { min-width: 0; display: flex; align-items: center; gap: 8px; }
      .color {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--player-color, #22c55e);
        box-shadow: 0 0 12px var(--player-color, #22c55e);
      }
      .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .country {
        padding: 2px 6px;
        border-radius: 999px;
        color: var(--accent);
        background: rgba(103, 232, 249, 0.12);
        font-size: 10px;
        font-weight: 800;
      }
      .latency {
        min-width: 42px;
        padding: 2px 6px;
        border-radius: 999px;
        text-align: center;
        color: var(--muted);
        background: rgba(148, 163, 184, 0.12);
        font-size: 10px;
        font-weight: 900;
        font-variant-numeric: tabular-nums;
      }
      .latency.good {
        color: #86efac;
        background: rgba(34, 197, 94, 0.15);
      }
      .latency.warn {
        color: #fde68a;
        background: rgba(245, 158, 11, 0.15);
      }
      .latency.bad {
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.15);
      }
      :root[data-theme="light"] .latency.good { color: #16a34a; }
      :root[data-theme="light"] .latency.warn { color: #d97706; }
      :root[data-theme="light"] .latency.bad { color: #dc2626; }
      .score { font-size: 16px; font-weight: 850; font-variant-numeric: tabular-nums; }

      .score-foot {
        padding: 14px 18px 18px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 12px;
      }

      .meta + .meta { margin-top: 6px; }

      @media (max-width: 980px) {
        body { overflow: auto; }
        .shell {
          height: auto;
          min-height: 100vh;
          grid-template-columns: 1fr;
        }
        .stage-frame { width: 100%; }
        .score-card { min-height: 260px; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="stage-card">
        <div class="stage-frame">
          <canvas id="stage" width="1280" height="800"></canvas>
          <div class="hud"><span class="dot" id="statusDot"></span><span id="statusText">Connecting</span></div>
          <div class="empty" id="empty">
            <div class="empty-card">
              <div class="empty-title">No players online</div>
              <div class="empty-note">The monitor stays hot. New players will appear here automatically.</div>
            </div>
          </div>
        </div>
      </section>
      <aside class="score-card">
        <header class="score-head">
          <div class="score-kicker">Tank Trouble</div>
          <div class="score-title">Live Monitor</div>
          <div class="score-subtitle" id="subtitle">Waiting for server state</div>
        </header>
        <div class="score-list" id="scoreList"></div>
        <footer class="score-foot">
          <div class="meta" id="mapMeta">Map -</div>
          <div class="meta" id="runtimeMeta">Snapshot -</div>
          <div class="meta" id="voteMeta">Votes -</div>
        </footer>
      </aside>
    </main>
    <script>
      const WORLD_WIDTH = 1280;
      const WORLD_HEIGHT = 800;
      const ARENA_X = 92;
      const ARENA_Y = 72;
      const ARENA_WIDTH = 1096;
      const ARENA_HEIGHT = 656;
      const LOGICAL_GRID_SIZE = Math.min(ARENA_WIDTH / 9, ARENA_HEIGHT / 6);
      const PLAYER_SPEED = LOGICAL_GRID_SIZE * 1.6;
      const PLAYER_TURN_SPEED = Math.PI * 2 / 1.3;
      const PLAYER_RADIUS = 20;
      const BULLET_RADIUS = 5;
      const BULLET_LIFE = 10;
      const BULLET_BOUNCES = 7;
      const SHOOT_COOLDOWN = 0.24;
      const BULLET_SPRITE_PIXEL_RATIO = 2;
      const BULLET_SPATIAL_CELL_SIZE = LOGICAL_GRID_SIZE * 0.85;
      const SHOTGUN_PELLET_COUNT = 16;
      const SHOTGUN_PELLET_RADIUS = BULLET_RADIUS / 3;
      const SHOTGUN_COOLDOWN = 1.5;
      const LASER_LENGTH = LOGICAL_GRID_SIZE * 2;
      const LASER_AIM_LENGTH = LOGICAL_GRID_SIZE * 7;
      const LASER_RADIUS = 4.4;
      const LASER_WALL_CLEARANCE = 7;
      const LASER_VISUAL_WAKE_LENGTH = LASER_LENGTH * 3.4;
      const LASER_VISUAL_HEAD_LENGTH = LASER_LENGTH * 0.74;
      const FIRE_SPAWN_FORWARD_OFFSET = 12;
      const FIRE_SPAWN_BACKOFF_STEPS = 18;
      const DOUBLE_BARREL_AMMO = 10;
      const DOUBLE_BARREL_COOLDOWN = SHOOT_COOLDOWN / 2;
      const DOUBLE_BARREL_RECOIL_MS = Math.round(DOUBLE_BARREL_COOLDOWN * 1000);
      const DOUBLE_BARREL_BARREL_OFFSET = 7.2;
      const SHIELD_RADIUS = PLAYER_RADIUS + 30;
      const SHIELD_FLICKER_MS = 1500;
      const POWERUP_ICON_SOURCES = {
        cash: "assets/tank-trouble/powerups/cash.png",
        shotgun: "assets/tank-trouble/powerups/shotgun.png",
        laser: "assets/tank-trouble/powerups/laser.png",
        minigun: "assets/tank-trouble/powerups/minigun.png",
        double_barrel: "assets/tank-trouble/powerups/double-barrel.png",
        shield: "assets/tank-trouble/powerups/shield.png",
      };
      const SCOREBOARD_RANK_ICON_SOURCES = {
        1: "assets/tank-trouble/scoreboard/rank-1.png",
        2: "assets/tank-trouble/scoreboard/rank-2.png",
        3: "assets/tank-trouble/scoreboard/rank-3.png",
      };
      const POLL_ACTIVE_MS = 50;
      const POLL_IDLE_MS = 300;
      const STALE_AFTER_MS = 1800;
      const INTERPOLATION_DELAY_MS = 85;
      const EXTRAPOLATION_LIMIT_MS = 90;
      const SNAPSHOT_BUFFER_LIMIT = 10;
      const SIDEBAR_MIN_INTERVAL_MS = 180;
      const params = new URLSearchParams(window.location.search);
      const room = params.get("room") || "main";
      const spectatorTheme = "dark";
      document.documentElement.dataset.theme = spectatorTheme;
      const stateUrl = `spectator/state?room=${encodeURIComponent(room)}`;

      const canvas = document.getElementById("stage");
      const ctx = canvas.getContext("2d");
      const scoreList = document.getElementById("scoreList");
      const subtitle = document.getElementById("subtitle");
      const mapMeta = document.getElementById("mapMeta");
      const runtimeMeta = document.getElementById("runtimeMeta");
      const voteMeta = document.getElementById("voteMeta");
      const statusText = document.getElementById("statusText");
      const statusDot = document.getElementById("statusDot");
      const empty = document.getElementById("empty");

      let latest = null;
      let lastOkAt = 0;
      let lastError = "";
      let polling = false;
      let destroyed = false;
      let lastFrameAt = performance.now();
      let renderTime = 0;
      let serverClockOffsetMs = 0;
      let hasServerClockOffset = false;
      let lastSidebarKey = "";
      let lastSidebarUpdateAt = 0;
      let staticSceneCanvas = null;
      let staticSceneCtx = null;
      let staticSceneKey = "";
      let staticWallIndex = null;
      let lastSyncedBulletKey = "";
      const snapshotBuffer = [];
      const renderBullets = new Map();
      const bulletFades = [];
      const bulletSmokeEffects = [];
      const wallRipples = [];
      const shellCasings = [];
      const tankExplosions = new Map();
      const powerupEffects = new Map();
      const powerupIconCache = new Map();
      const killFeedEntries = [];
      let nextRippleId = 1;
      let nextShellCasingId = 1;

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function smoothStep(value) {
        const t = clamp(value, 0, 1);
        return t * t * (3 - 2 * t);
      }

      function shotgunPumpProgress(reloadMs) {
        if (reloadMs <= 0) return 0;
        const elapsedRatio = 1 - clamp(reloadMs / (SHOTGUN_COOLDOWN * 1000), 0, 1);
        if (elapsedRatio < 0.18) return smoothStep(elapsedRatio / 0.18);
        if (elapsedRatio < 0.46) return 1 - smoothStep((elapsedRatio - 0.18) / 0.28);
        return 0;
      }

      function doubleBarrelLastShotOffset(ammoRemaining) {
        if (ammoRemaining >= DOUBLE_BARREL_AMMO) return 0;
        const lastShotIndex = Math.max(0, DOUBLE_BARREL_AMMO - Math.max(0, Math.round(ammoRemaining)) - 1);
        return (lastShotIndex % 2 === 0 ? -1 : 1) * DOUBLE_BARREL_BARREL_OFFSET;
      }

      function doubleBarrelRecoilProgress(reloadMs) {
        if (reloadMs <= 0) return 0;
        return smoothStep(clamp(reloadMs / DOUBLE_BARREL_RECOIL_MS, 0, 1));
      }

      function shouldSpawnProjectileSmoke(projectileType) {
        return String(projectileType || "bullet") !== "laser";
      }

      function lerp(from, to, t) {
        return from + (to - from) * t;
      }

      function angleLerp(from, to, t) {
        let delta = (to - from) % (Math.PI * 2);
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        return from + delta * t;
      }

      function dampFactor(rate, dt) {
        return 1 - Math.exp(-rate * dt);
      }

      function distance(aX, aY, bX, bY) {
        return Math.hypot(aX - bX, aY - bY);
      }

      function squaredDistance(aX, aY, bX, bY) {
        const dx = aX - bX;
        const dy = aY - bY;
        return dx * dx + dy * dy;
      }

      function circleIntersectsRect(circle, rect) {
        const closestX = clamp(numberValue(circle.x), numberValue(rect.x), numberValue(rect.x) + numberValue(rect.w));
        const closestY = clamp(numberValue(circle.y), numberValue(rect.y), numberValue(rect.y) + numberValue(rect.h));
        const radius = numberValue(circle.radius);
        return squaredDistance(numberValue(circle.x), numberValue(circle.y), closestX, closestY) < radius * radius;
      }

      function pointInsideWall(x, y, radius, walls) {
        return (walls || []).some((wall) => circleIntersectsRect({ x, y, radius }, wall));
      }

      function wallCellKey(col, row) {
        return `${col}:${row}`;
      }

      function buildWallSpatialIndex(walls) {
        const cells = new Map();
        for (const wall of walls || []) {
          const minCol = Math.floor((numberValue(wall.x) - ARENA_X) / BULLET_SPATIAL_CELL_SIZE);
          const maxCol = Math.floor((numberValue(wall.x) + numberValue(wall.w) - ARENA_X) / BULLET_SPATIAL_CELL_SIZE);
          const minRow = Math.floor((numberValue(wall.y) - ARENA_Y) / BULLET_SPATIAL_CELL_SIZE);
          const maxRow = Math.floor((numberValue(wall.y) + numberValue(wall.h) - ARENA_Y) / BULLET_SPATIAL_CELL_SIZE);
          for (let row = minRow; row <= maxRow; row += 1) {
            for (let col = minCol; col <= maxCol; col += 1) {
              const key = wallCellKey(col, row);
              const bucket = cells.get(key);
              if (bucket) bucket.push(wall);
              else cells.set(key, [wall]);
            }
          }
        }
        return { walls: walls || [], cells };
      }

      function queryNearbyWalls(index, x, y, radius) {
        if (!index) return [];
        const minCol = Math.floor((x - radius - ARENA_X) / BULLET_SPATIAL_CELL_SIZE);
        const maxCol = Math.floor((x + radius - ARENA_X) / BULLET_SPATIAL_CELL_SIZE);
        const minRow = Math.floor((y - radius - ARENA_Y) / BULLET_SPATIAL_CELL_SIZE);
        const maxRow = Math.floor((y + radius - ARENA_Y) / BULLET_SPATIAL_CELL_SIZE);
        const walls = [];
        const seen = new Set();
        for (let row = minRow; row <= maxRow; row += 1) {
          for (let col = minCol; col <= maxCol; col += 1) {
            const bucket = index.cells.get(wallCellKey(col, row));
            if (!bucket) continue;
            for (const wall of bucket) {
              if (!seen.has(wall)) {
                seen.add(wall);
                walls.push(wall);
              }
            }
          }
        }
        return walls.length ? walls : index.walls;
      }

      function pushOutOfWall(x, y, angle, radius, walls) {
        let candidateX = x;
        let candidateY = y;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        for (let index = 0; index < 10; index += 1) {
          let moved = false;
          for (const wall of walls || []) {
            if (!circleIntersectsRect({ x: candidateX, y: candidateY, radius }, wall)) continue;
            const wallX = numberValue(wall.x);
            const wallY = numberValue(wall.y);
            const wallW = numberValue(wall.w);
            const wallH = numberValue(wall.h);
            const closestX = clamp(candidateX, wallX, wallX + wallW);
            const closestY = clamp(candidateY, wallY, wallY + wallH);
            let normalX = candidateX - closestX;
            let normalY = candidateY - closestY;
            let normalLength = Math.hypot(normalX, normalY);
            if (normalLength <= 0.0001) {
              const distances = [
                { value: Math.abs(candidateX - wallX), normalX: -1, normalY: 0 },
                { value: Math.abs(wallX + wallW - candidateX), normalX: 1, normalY: 0 },
                { value: Math.abs(candidateY - wallY), normalX: 0, normalY: -1 },
                { value: Math.abs(wallY + wallH - candidateY), normalX: 0, normalY: 1 },
              ].sort((left, right) => left.value - right.value);
              normalX = distances[0]?.normalX ?? -dx;
              normalY = distances[0]?.normalY ?? -dy;
              normalLength = 1;
            }
            normalX /= normalLength;
            normalY /= normalLength;
            const penetration = radius - distance(candidateX, candidateY, closestX, closestY);
            if (penetration <= 0) continue;
            candidateX += normalX * (penetration + 1.5);
            candidateY += normalY * (penetration + 1.5);
            moved = true;
          }
          if (!moved) break;
        }
        if (pointInsideWall(candidateX, candidateY, radius, walls)) {
          return { x: x - dx * (radius + 2), y: y - dy * (radius + 2) };
        }
        return { x: candidateX, y: candidateY };
      }

      function safeFireSpawnPoint(player, walls, projectileRadius, lateralOffset = 0) {
        const angle = numberValue(player.angle);
        const radius = numberValue(player.radius, PLAYER_RADIUS);
        const centerX = numberValue(player.x);
        const centerY = numberValue(player.y);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const sideX = Math.cos(angle + Math.PI / 2);
        const sideY = Math.sin(angle + Math.PI / 2);
        const startForward = radius + FIRE_SPAWN_FORWARD_OFFSET + projectileRadius;
        const minimumForward = radius + projectileRadius + 2;
        const stepSize = Math.max(1, (startForward - minimumForward) / FIRE_SPAWN_BACKOFF_STEPS);
        for (let index = 0; index <= FIRE_SPAWN_BACKOFF_STEPS; index += 1) {
          const forward = Math.max(minimumForward, startForward - index * stepSize);
          const x = centerX + dx * forward + sideX * lateralOffset;
          const y = centerY + dy * forward + sideY * lateralOffset;
          if (!pointInsideWall(x, y, projectileRadius + 1, walls)) return { x, y };
        }
        return pushOutOfWall(
          centerX + dx * minimumForward + sideX * lateralOffset,
          centerY + dy * minimumForward + sideY * lateralOffset,
          angle,
          projectileRadius + 1,
          walls,
        );
      }

      function activeShieldColliders(players, excludeOwnerId = "", includeExcluded = false) {
        return (players || [])
          .filter((player) => includeExcluded || String(player.player_id || player.id || "") !== String(excludeOwnerId))
          .filter((player) => player.alive && numberValue(player.shield_visible_ms || player.shieldVisibleMs) > 0)
          .map((player) => ({
            id: String(player.player_id || player.id || ""),
            x: numberValue(player.x),
            y: numberValue(player.y),
            shieldRadius: Math.max(PLAYER_RADIUS + 10, numberValue(player.shield_radius || player.shieldRadius, SHIELD_RADIUS)),
            color: player.color || "green",
          }));
      }

      function segmentCircleCollision(x1, y1, x2, y2, centerX, centerY, radius) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const a = dx * dx + dy * dy;
        if (a <= 0.001) {
          if (distance(x1, y1, centerX, centerY) >= radius) return null;
          let normalX = x1 - centerX;
          let normalY = y1 - centerY;
          const normalLength = Math.max(0.0001, Math.hypot(normalX, normalY));
          return { t: 0, x: x1, y: y1, normalX: normalX / normalLength, normalY: normalY / normalLength };
        }
        const originX = x1 - centerX;
        const originY = y1 - centerY;
        const b = 2 * (originX * dx + originY * dy);
        const c = originX * originX + originY * originY - radius * radius;
        const discriminant = b * b - 4 * a * c;
        const candidates = [];
        if (discriminant >= 0) {
          const root = Math.sqrt(discriminant);
          for (const value of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) {
            if (value >= 0 && value <= 1) candidates.push(value);
          }
        }
        if (!candidates.length && c < 0) candidates.push(0);
        if (!candidates.length) return null;
        const t = Math.min(...candidates);
        const hitX = x1 + dx * t;
        const hitY = y1 + dy * t;
        let normalX = hitX - centerX;
        let normalY = hitY - centerY;
        let normalLength = Math.hypot(normalX, normalY);
        if (normalLength <= 0.0001) {
          normalX = -dx;
          normalY = -dy;
          normalLength = Math.max(0.0001, Math.hypot(normalX, normalY));
        }
        return { t, x: hitX, y: hitY, normalX: normalX / normalLength, normalY: normalY / normalLength };
      }

      function rayRectHit(x, y, dx, dy, rect) {
        const epsilon = 0.0001;
        const rectX = numberValue(rect.x);
        const rectY = numberValue(rect.y);
        const rectW = numberValue(rect.w);
        const rectH = numberValue(rect.h);
        const candidates = [];
        if (Math.abs(dx) > epsilon) {
          for (const [edgeX, nx] of [[rectX, -1], [rectX + rectW, 1]]) {
            const t = (edgeX - x) / dx;
            if (t <= epsilon) continue;
            const hitY = y + dy * t;
            if (hitY >= rectY - epsilon && hitY <= rectY + rectH + epsilon) {
              candidates.push({ t, normalX: nx, normalY: 0 });
            }
          }
        }
        if (Math.abs(dy) > epsilon) {
          for (const [edgeY, ny] of [[rectY, -1], [rectY + rectH, 1]]) {
            const t = (edgeY - y) / dy;
            if (t <= epsilon) continue;
            const hitX = x + dx * t;
            if (hitX >= rectX - epsilon && hitX <= rectX + rectW + epsilon) {
              candidates.push({ t, normalX: 0, normalY: ny });
            }
          }
        }
        if (!candidates.length) return null;
        const nearestT = Math.min(...candidates.map((candidate) => candidate.t));
        let normalX = 0;
        let normalY = 0;
        for (const candidate of candidates) {
          if (Math.abs(candidate.t - nearestT) > 0.001) continue;
          normalX = candidate.normalX || normalX;
          normalY = candidate.normalY || normalY;
        }
        return { t: nearestT, normalX, normalY };
      }

      function rayArenaBoundsHit(x, y, dx, dy) {
        const epsilon = 0.0001;
        const insideArena =
          x >= ARENA_X - epsilon &&
          x <= ARENA_X + ARENA_WIDTH + epsilon &&
          y >= ARENA_Y - epsilon &&
          y <= ARENA_Y + ARENA_HEIGHT + epsilon;
        if (!insideArena) return null;

        const candidates = [];
        if (Math.abs(dx) > epsilon) {
          for (const [edgeX, normalX] of [[ARENA_X, 1], [ARENA_X + ARENA_WIDTH, -1]]) {
            const t = (edgeX - x) / dx;
            if (t <= epsilon) continue;
            const hitY = y + dy * t;
            if (hitY >= ARENA_Y - epsilon && hitY <= ARENA_Y + ARENA_HEIGHT + epsilon) {
              candidates.push({ t, normalX, normalY: 0 });
            }
          }
        }
        if (Math.abs(dy) > epsilon) {
          for (const [edgeY, normalY] of [[ARENA_Y, 1], [ARENA_Y + ARENA_HEIGHT, -1]]) {
            const t = (edgeY - y) / dy;
            if (t <= epsilon) continue;
            const hitX = x + dx * t;
            if (hitX >= ARENA_X - epsilon && hitX <= ARENA_X + ARENA_WIDTH + epsilon) {
              candidates.push({ t, normalX: 0, normalY });
            }
          }
        }
        if (!candidates.length) return null;
        const nearestT = Math.min(...candidates.map((candidate) => candidate.t));
        let normalX = 0;
        let normalY = 0;
        for (const candidate of candidates) {
          if (Math.abs(candidate.t - nearestT) > 0.001) continue;
          normalX = candidate.normalX || normalX;
          normalY = candidate.normalY || normalY;
        }
        return { t: nearestT, normalX, normalY };
      }

      function rayCircleHit(x, y, dx, dy, centerX, centerY, radius) {
        const originX = x - centerX;
        const originY = y - centerY;
        const b = originX * dx + originY * dy;
        const c = originX * originX + originY * originY - radius * radius;
        const discriminant = b * b - c;
        if (discriminant < 0) return null;
        const root = Math.sqrt(discriminant);
        const hits = [-b - root, -b + root].filter((value) => value > 0.0001);
        if (!hits.length) return null;
        const t = Math.min(...hits);
        const hitX = x + dx * t;
        const hitY = y + dy * t;
        const normalLength = Math.max(0.0001, distance(hitX, hitY, centerX, centerY));
        return {
          t,
          normalX: (hitX - centerX) / normalLength,
          normalY: (hitY - centerY) / normalLength,
        };
      }

      function buildReflectedRaySegments(startX, startY, angle, maxLength, walls, maxBounces = 5, shields = []) {
        const segments = [];
        let x = startX;
        let y = startY;
        let dx = Math.cos(angle);
        let dy = Math.sin(angle);
        let remaining = maxLength;
        for (let bounce = 0; bounce <= maxBounces && remaining > 0.5; bounce += 1) {
          let nearest = null;
          const arenaHit = rayArenaBoundsHit(x, y, dx, dy);
          if (arenaHit && arenaHit.t <= remaining) nearest = { ...arenaHit, kind: "wall" };
          for (const wall of walls || []) {
            const hit = rayRectHit(x, y, dx, dy, wall);
            if (hit && hit.t <= remaining && (!nearest || hit.t < nearest.t)) nearest = { ...hit, kind: "wall" };
          }
          for (const shield of shields || []) {
            const shieldRadius = numberValue(shield.shieldRadius, SHIELD_RADIUS) + LASER_RADIUS;
            if (distance(x, y, numberValue(shield.x), numberValue(shield.y)) < shieldRadius - 0.5) continue;
            const hit = rayCircleHit(
              x,
              y,
              dx,
              dy,
              numberValue(shield.x),
              numberValue(shield.y),
              shieldRadius,
            );
            if (hit && hit.t <= remaining && (!nearest || hit.t < nearest.t)) nearest = { ...hit, kind: "shield" };
          }
          if (!nearest) {
            segments.push({ x1: x, y1: y, x2: x + dx * remaining, y2: y + dy * remaining });
            break;
          }
          const hitX = x + dx * nearest.t;
          const hitY = y + dy * nearest.t;
          const clearance = nearest.kind === "shield" ? 0.5 : LASER_WALL_CLEARANCE;
          const visibleT = Math.max(0, nearest.t - clearance);
          const visibleX = x + dx * visibleT;
          const visibleY = y + dy * visibleT;
          if (distance(x, y, visibleX, visibleY) > 0.1) {
            segments.push({ x1: x, y1: y, x2: visibleX, y2: visibleY });
          }
          remaining -= nearest.t;
          if (nearest.kind === "shield") {
            const dot = dx * nearest.normalX + dy * nearest.normalY;
            dx -= 2 * dot * nearest.normalX;
            dy -= 2 * dot * nearest.normalY;
          } else if (nearest.normalX) {
            dx *= -1;
          }
          if (nearest.kind !== "shield" && nearest.normalY) dy *= -1;
          x = hitX + dx * clearance;
          y = hitY + dy * clearance;
          remaining -= clearance;
        }
        return segments;
      }

      function buildReverseReflectedSegments(headX, headY, vx, vy, length, walls, maxBounces = 5) {
        const speed = Math.hypot(vx, vy) || 1;
        const reverseAngle = Math.atan2(-vy / speed, -vx / speed);
        return buildReflectedRaySegments(headX, headY, reverseAngle, length, walls, maxBounces)
          .map((segment) => ({ x1: segment.x2, y1: segment.y2, x2: segment.x1, y2: segment.y1 }))
          .reverse();
      }

      function normalizeSegments(segments) {
        if (!Array.isArray(segments) || !segments.length) return [];
        return segments
          .map((segment) => ({
            x1: numberValue(segment.x1),
            y1: numberValue(segment.y1),
            x2: numberValue(segment.x2),
            y2: numberValue(segment.y2),
          }))
          .filter((segment) => distance(segment.x1, segment.y1, segment.x2, segment.y2) > 0.1);
      }

      function pathSegmentsLength(segments) {
        return normalizeSegments(segments).reduce(
          (total, segment) => total + distance(segment.x1, segment.y1, segment.x2, segment.y2),
          0,
        );
      }

      function slicePathSegments(pathSegments, startDistance, length) {
        const segments = normalizeSegments(pathSegments);
        const totalLength = pathSegmentsLength(segments);
        if (totalLength <= 0.001 || length <= 0.001) return [];

        const visible = [];
        let cursor = 0;
        const visibleLength = Math.min(length, totalLength);
        const safeStartDistance = clamp(startDistance, 0, Math.max(0, totalLength - visibleLength));
        const endDistance = safeStartDistance + visibleLength;
        for (const segment of segments) {
          const segmentLength = distance(segment.x1, segment.y1, segment.x2, segment.y2);
          if (segmentLength <= 0.001) continue;
          const segmentStart = cursor;
          const segmentEnd = cursor + segmentLength;
          cursor = segmentEnd;
          if (segmentEnd <= safeStartDistance) continue;
          if (segmentStart >= endDistance) break;
          const localStart = Math.max(safeStartDistance, segmentStart) - segmentStart;
          const localEnd = Math.min(endDistance, segmentEnd) - segmentStart;
          const ratioStart = clamp(localStart / segmentLength, 0, 1);
          const ratioEnd = clamp(localEnd / segmentLength, 0, 1);
          visible.push({
            x1: segment.x1 + (segment.x2 - segment.x1) * ratioStart,
            y1: segment.y1 + (segment.y2 - segment.y1) * ratioStart,
            x2: segment.x1 + (segment.x2 - segment.x1) * ratioEnd,
            y2: segment.y1 + (segment.y2 - segment.y1) * ratioEnd,
          });
        }
        return visible;
      }

      function buildLaserVisualSegments(pathSegments, distanceTravelled, age, life) {
        const segments = normalizeSegments(pathSegments);
        const totalLength = pathSegmentsLength(segments);
        if (totalLength <= 0.001) {
          return { wakeSegments: [], headSegments: [], alpha: 0 };
        }
        const lifeProgress = clamp(numberValue(age) / 0.375, 0, 1);
        const serverProgress = clamp(numberValue(distanceTravelled) / Math.max(1, totalLength), 0, 1);
        const easedProgress = 1 - Math.pow(1 - lifeProgress, 2.15);
        const headDistance = clamp(
          Math.max(serverProgress, easedProgress) * totalLength,
          LASER_VISUAL_HEAD_LENGTH,
          totalLength,
        );
        const wakeStart = Math.max(0, headDistance - LASER_VISUAL_WAKE_LENGTH);
        const headStart = Math.max(0, headDistance - LASER_VISUAL_HEAD_LENGTH);
        const fadeByAge = 1 - smoothStep((lifeProgress - 0.72) / 0.28);
        const fadeByLife = numberValue(life) > 0 ? smoothStep(clamp(numberValue(life) / 0.16, 0, 1)) : 0;
        const alpha = clamp(Math.min(fadeByAge, fadeByLife), 0, 1);
        return {
          wakeSegments: slicePathSegments(segments, wakeStart, headDistance - wakeStart),
          headSegments: slicePathSegments(segments, headStart, headDistance - headStart),
          alpha,
        };
      }

      function normalizeLatencyMs(value) {
        const latencyMs = Number(value || 0);
        if (!Number.isFinite(latencyMs) || latencyMs <= 0) return 0;
        return Math.max(1, Math.min(9999, Math.round(latencyMs)));
      }

      function latencyClassName(value) {
        const latencyMs = normalizeLatencyMs(value);
        if (!latencyMs) return "unknown";
        if (latencyMs <= 50) return "good";
        if (latencyMs <= 150) return "warn";
        return "bad";
      }

      function formatLatencyLabel(value) {
        const latencyMs = normalizeLatencyMs(value);
        return latencyMs ? `${latencyMs}ms` : "--ms";
      }

      function numberValue(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      }

      function getPowerupPickupLabel(effect) {
        const effectName = String(effect?.effect || "score").toLowerCase();
        if (effectName === "score") return `+${Math.max(0, Math.round(numberValue(effect?.scoreDelta)))}`;
        if (effectName === "shotgun") return "SHOTGUN";
        if (effectName === "laser") return "LASER";
        if (effectName === "minigun") return "MINIGUN";
        if (effectName === "double_barrel") return "BARREL+1";
        if (effectName === "shield") return "SHIELD";
        return effectName.toUpperCase();
      }

      function itemKey(item, fields) {
        return fields.map((field) => String(item?.[field] ?? "")).join(":");
      }

      function indexBy(items, fields) {
        const index = new Map();
        for (const item of items || []) index.set(itemKey(item, fields), item);
        return index;
      }

      function hexToRgba(hex, alpha) {
        const value = String(hex || "#000000").replace("#", "").padEnd(6, "0");
        const r = Number.parseInt(value.slice(0, 2), 16) || 0;
        const g = Number.parseInt(value.slice(2, 4), 16) || 0;
        const b = Number.parseInt(value.slice(4, 6), 16) || 0;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }

      function getPlayerPalette(color, theme = spectatorTheme) {
        const key = String(color || "green").toLowerCase();
        let base = "#22c55e";
        let bright = theme === "dark" ? "#86efac" : "#16a34a";
        if (key === "red") {
          base = "#ef4444";
          bright = theme === "dark" ? "#fca5a5" : "#dc2626";
        } else if (key === "blue") {
          base = "#3b82f6";
          bright = theme === "dark" ? "#93c5fd" : "#2563eb";
        } else if (key === "yellow") {
          base = "#f59e0b";
          bright = theme === "dark" ? "#fde68a" : "#d97706";
        }
        return {
          base,
          bright,
          glow: hexToRgba(base, theme === "dark" ? 0.48 : 0.34),
          halo: hexToRgba(bright, theme === "dark" ? 0.2 : 0.14),
          flash: hexToRgba(bright, theme === "dark" ? 0.9 : 0.76),
          ripple: hexToRgba(bright, theme === "dark" ? 0.72 : 0.58),
        };
      }

      function palette(color) {
        return getPlayerPalette(color, spectatorTheme);
      }

      const bulletSpriteCache = new Map();

      function getBulletSprite(color, projectileType = "bullet", radius = BULLET_RADIUS) {
        const p = getPlayerPalette(color);
        const type = String(projectileType || "bullet");
        const innerDot = type !== "shotgun" && type !== "minigun";
        const safeRadius = Math.max(1.4, numberValue(radius, BULLET_RADIUS));
        const glowRadius = type === "shotgun" ? 7 : type === "minigun" ? 8 : 11;
        const size = Math.ceil((safeRadius + glowRadius + 3) * 2 * BULLET_SPRITE_PIXEL_RATIO);
        const key = `${spectatorTheme}:${color}:${type}:${safeRadius.toFixed(2)}:${size}`;
        const cached = bulletSpriteCache.get(key);
        if (cached) return cached;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const spriteCtx = canvas.getContext("2d");
        if (!spriteCtx) return canvas;
        const scale = BULLET_SPRITE_PIXEL_RATIO;
        const center = size / 2 / scale;
        spriteCtx.setTransform(scale, 0, 0, scale, 0, 0);
        spriteCtx.shadowColor = p.glow;
        spriteCtx.shadowBlur = glowRadius;
        spriteCtx.fillStyle = p.bright;
        spriteCtx.beginPath();
        spriteCtx.arc(center, center, safeRadius, 0, Math.PI * 2);
        spriteCtx.fill();
        if (innerDot) {
          spriteCtx.shadowBlur = 0;
          spriteCtx.beginPath();
          spriteCtx.arc(center, center, Math.max(1.2, safeRadius - 2), 0, Math.PI * 2);
          spriteCtx.fillStyle = p.base;
          spriteCtx.fill();
        }
        bulletSpriteCache.set(key, canvas);
        if (bulletSpriteCache.size > 96) {
          const firstKey = bulletSpriteCache.keys().next().value;
          if (firstKey) bulletSpriteCache.delete(firstKey);
        }
        return canvas;
      }

      function drawBulletSprite(bullet, color, alpha = 1, radiusBoost = 0) {
        const radius = Math.max(1, numberValue(bullet.radius, BULLET_RADIUS) + radiusBoost);
        const type = String(bullet.projectile_type || bullet.projectileType || "bullet");
        const sprite = getBulletSprite(color, type, radius);
        const size = sprite.width / BULLET_SPRITE_PIXEL_RATIO;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, numberValue(bullet.x) - size / 2, numberValue(bullet.y) - size / 2, size, size);
        ctx.restore();
      }

      function powerupVisualPalette() {
        const darkMode = spectatorTheme === "dark";
        return darkMode
          ? {
              glow: "#f8fafc",
              outer: "rgba(226, 232, 240, 0.22)",
              ring: "rgba(248, 250, 252, 0.76)",
              bodyTop: "#f8fafc",
              bodyMid: "#cbd5e1",
              bodyBottom: "#64748b",
              stroke: "rgba(255, 255, 255, 0.72)",
              symbol: "#fde68a",
            }
          : {
              glow: "#94a3b8",
              outer: "rgba(100, 116, 139, 0.1)",
              ring: "rgba(71, 85, 105, 0.34)",
              bodyTop: "#ffffff",
              bodyMid: "#e2e8f0",
              bodyBottom: "#94a3b8",
              stroke: "rgba(15, 23, 42, 0.14)",
              symbol: "#8a5a08",
            };
      }

      function shortPlayerName(playerId) {
        const value = String(playerId || "Player").trim() || "Player";
        return value.length > 10 ? `${value.slice(0, 7)}...` : value;
      }

      function roundedRect(context, x, y, w, h, r) {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(x + w - radius, y);
        context.quadraticCurveTo(x + w, y, x + w, y + radius);
        context.lineTo(x + w, y + h - radius);
        context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        context.lineTo(x + radius, y + h);
        context.quadraticCurveTo(x, y + h, x, y + h - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
      }

      function ensureStaticScene(state) {
        const walls = state.walls || [];
        const key = `${state.map_id || ""}|${walls.map((wall) =>
          [wall.x, wall.y, wall.w, wall.h].map((value) => Math.round(numberValue(value) * 10)).join(",")
        ).join(";")}`;
        if (staticSceneCanvas && key === staticSceneKey) return staticSceneCanvas;
        const sceneChanged = Boolean(staticSceneKey && key !== staticSceneKey);

        staticSceneCanvas = document.createElement("canvas");
        staticSceneCanvas.width = WORLD_WIDTH;
        staticSceneCanvas.height = WORLD_HEIGHT;
        staticSceneCtx = staticSceneCanvas.getContext("2d");
        staticSceneKey = key;
        staticWallIndex = buildWallSpatialIndex(walls);
        if (sceneChanged) {
          renderBullets.clear();
          bulletFades.length = 0;
          wallRipples.length = 0;
        }

        drawBackgroundTo(staticSceneCtx);
        return staticSceneCanvas;
      }

      function syncCanvasSize() {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        const width = Math.max(1, Math.round(rect.width * ratio));
        const height = Math.max(1, Math.round(rect.height * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        ctx.setTransform(width / WORLD_WIDTH, 0, 0, height / WORLD_HEIGHT, 0, 0);
      }

      function sanitizeState(raw) {
        const world = raw && typeof raw.world === "object" ? raw.world : {};
        return {
          room: String(raw?.room || room),
          map_id: String(raw?.map_id || "MAP"),
          snapshot_seq: Number(raw?.snapshot_seq || 0),
          server_time_ms: Number(raw?.server_time_ms || raw?.updated_at_ms || Date.now()),
          active_player_count: Number(raw?.active_player_count || 0),
          vote_count: Number(raw?.vote_count || 0),
          vote_required: Number(raw?.vote_required || 0),
          countdown_seconds: Number(raw?.countdown_seconds || 0),
          countdown_active: Boolean(raw?.countdown_active),
          players: Array.isArray(raw?.players) ? raw.players : [],
          bullets: Array.isArray(raw?.bullets)
            ? raw.bullets
                .filter((bullet) => numberValue(bullet?.life, BULLET_LIFE) > 0)
                .map((bullet) => ({
                  ...bullet,
                  path_segments: normalizeSegments(bullet?.path_segments),
                  segments: normalizeSegments(bullet?.segments),
                }))
            : [],
          targets: Array.isArray(raw?.targets) ? raw.targets : [],
          tank_explosions: Array.isArray(raw?.tank_explosions) ? raw.tank_explosions : [],
          powerups: Array.isArray(raw?.powerups) ? raw.powerups : [],
          powerup_effects: Array.isArray(raw?.powerup_effects) ? raw.powerup_effects : [],
          active_players: Array.isArray(raw?.active_players)
            ? raw.active_players.map((row) => ({ ...row, latency_ms: normalizeLatencyMs(row?.latency_ms) }))
            : [],
          walls: Array.isArray(world.walls) ? world.walls : [],
        };
      }

      function pushSnapshot(state) {
        const receivedAt = Date.now();
        state.received_at_ms = receivedAt;
        const offsetSample = state.server_time_ms - receivedAt;
        serverClockOffsetMs = hasServerClockOffset
          ? serverClockOffsetMs * 0.84 + offsetSample * 0.16
          : offsetSample;
        hasServerClockOffset = true;

        const previous = snapshotBuffer[snapshotBuffer.length - 1];
        if (
          previous &&
          previous.snapshot_seq === state.snapshot_seq &&
          previous.server_time_ms === state.server_time_ms
        ) {
          snapshotBuffer[snapshotBuffer.length - 1] = state;
        } else {
          snapshotBuffer.push(state);
          snapshotBuffer.sort((a, b) => a.server_time_ms - b.server_time_ms);
        }

        while (snapshotBuffer.length > SNAPSHOT_BUFFER_LIMIT) snapshotBuffer.shift();
        const cutoff = state.server_time_ms - 1600;
        while (snapshotBuffer.length > 2 && snapshotBuffer[0].server_time_ms < cutoff) {
          snapshotBuffer.shift();
        }
        latest = state;
      }

      function interpolatePlayer(previous, next, t) {
        const player = { ...next };
        if (previous && Boolean(previous.alive) === Boolean(next.alive)) {
          player.x = lerp(numberValue(previous.x), numberValue(next.x), t);
          player.y = lerp(numberValue(previous.y), numberValue(next.y), t);
          player.angle = angleLerp(numberValue(previous.angle), numberValue(next.angle), t);
          player.flash = lerp(numberValue(previous.flash), numberValue(next.flash), t);
        }
        return player;
      }

      function extrapolatePlayer(player, offsetMs) {
        if (!player || !player.alive || !player.input) return { ...player };
        const seconds = clamp(offsetMs / 1000, 0, EXTRAPOLATION_LIMIT_MS / 1000);
        const input = player.input || {};
        const turnIntent = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const moveIntent = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
        const angle = numberValue(player.angle) + turnIntent * PLAYER_TURN_SPEED * seconds;
        return {
          ...player,
          angle,
          x: numberValue(player.x) + Math.cos(angle) * moveIntent * PLAYER_SPEED * seconds,
          y: numberValue(player.y) + Math.sin(angle) * moveIntent * PLAYER_SPEED * seconds,
          flash: Math.max(0, numberValue(player.flash) - seconds),
        };
      }

      function interpolateBullet(previous, next, t) {
        const bullet = { ...next };
        if (String(next?.projectile_type || "bullet") === "laser") {
          bullet.segments = normalizeSegments(next?.segments);
          return bullet;
        }
        if (previous) {
          bullet.x = lerp(numberValue(previous.x), numberValue(next.x), t);
          bullet.y = lerp(numberValue(previous.y), numberValue(next.y), t);
          bullet.life = lerp(numberValue(previous.life), numberValue(next.life), t);
          bullet.age = lerp(numberValue(previous.age), numberValue(next.age), t);
        }
        return bullet;
      }

      function extrapolateBullet(bullet, offsetMs) {
        if (String(bullet?.projectile_type || "bullet") === "laser") {
          return {
            ...bullet,
            path_segments: normalizeSegments(bullet?.path_segments),
            segments: normalizeSegments(bullet?.segments),
          };
        }
        const seconds = clamp(offsetMs / 1000, 0, EXTRAPOLATION_LIMIT_MS / 1000);
        return {
          ...bullet,
          x: numberValue(bullet.x) + numberValue(bullet.vx) * seconds,
          y: numberValue(bullet.y) + numberValue(bullet.vy) * seconds,
          life: numberValue(bullet.life) - seconds,
          age: numberValue(bullet.age) + seconds,
        };
      }

      function interpolateSnapshots(previous, next, targetServerTime) {
        if (!previous || !next || previous.map_id !== next.map_id) return next || previous;
        const span = Math.max(1, next.server_time_ms - previous.server_time_ms);
        const amount = clamp((targetServerTime - previous.server_time_ms) / span, 0, 1);
        const previousPlayers = indexBy(previous.players || [], ["player_id"]);
        const previousBullets = indexBy(previous.bullets || [], ["owner_id", "id"]);
        return {
          ...next,
          players: (next.players || []).map((player) =>
            interpolatePlayer(previousPlayers.get(itemKey(player, ["player_id"])), player, amount),
          ),
          bullets: (next.bullets || []).map((bullet) =>
            interpolateBullet(previousBullets.get(itemKey(bullet, ["owner_id", "id"])), bullet, amount),
          ),
          server_bullets: next.bullets || [],
          powerups: next.powerups || [],
          powerup_effects: next.powerup_effects || [],
          tank_explosions: next.tank_explosions || [],
        };
      }

      function extrapolateSnapshot(state, targetServerTime) {
        const offsetMs = Math.max(0, targetServerTime - numberValue(state.server_time_ms));
        return {
          ...state,
          players: (state.players || []).map((player) => extrapolatePlayer(player, offsetMs)),
          bullets: (state.bullets || []).map((bullet) => extrapolateBullet(bullet, offsetMs)),
          server_bullets: state.bullets || [],
          powerups: state.powerups || [],
          powerup_effects: state.powerup_effects || [],
          tank_explosions: state.tank_explosions || [],
        };
      }

      function bulletKey(bullet) {
        return `${String(bullet.owner_id || bullet.ownerId || "")}:${String(bullet.id || 0)}`;
      }

      function removeLaserHitBullet(ownerId, bulletId) {
        const normalizedOwnerId = String(ownerId || "");
        const normalizedBulletId = Number(bulletId || 0);
        if (!normalizedOwnerId) return;
        renderBullets.delete(`${normalizedOwnerId}:${normalizedBulletId}`);
        for (const [key, bullet] of renderBullets.entries()) {
          if (
            String(bullet.ownerId || bullet.owner_id || "") === normalizedOwnerId &&
            String(bullet.projectile_type || bullet.projectileType || "bullet") === "laser"
          ) {
            renderBullets.delete(key);
          }
        }
        for (let index = bulletFades.length - 1; index >= 0; index -= 1) {
          const fade = bulletFades[index];
          const projectileType = String(fade.projectile_type || fade.projectileType || "bullet");
          if (projectileType === "laser" && (!normalizedBulletId || Number(fade.id || 0) === normalizedBulletId)) {
            bulletFades.splice(index, 1);
          }
        }
      }

      function pushWallRipple(wall, x, y, color) {
        if (renderBullets.size > 34 && wallRipples.length > 20) return;
        wallRipples.push({
          id: nextRippleId,
          wall: { ...wall },
          x,
          y,
          color,
          life: 0.34,
          maxLife: 0.34,
        });
        nextRippleId += 1;
        const maxRipples = renderBullets.size > 34 ? 24 : 48;
        if (wallRipples.length > maxRipples) wallRipples.splice(0, wallRipples.length - maxRipples);
      }

      function pushShieldRipple(x, y, color) {
        if (renderBullets.size > 34 && wallRipples.length > 20) return;
        wallRipples.push({
          id: nextRippleId,
          wall: { x: x - 48, y: y - 48, w: 96, h: 96 },
          x,
          y,
          color,
          life: 0.3,
          maxLife: 0.3,
        });
        nextRippleId += 1;
        const maxRipples = renderBullets.size > 34 ? 24 : 48;
        if (wallRipples.length > maxRipples) wallRipples.splice(0, wallRipples.length - maxRipples);
      }

      function pushBulletFade(bullet) {
        const projectileType = String(bullet.projectile_type || bullet.projectileType || "bullet");
        const fadeLife = projectileType === "laser" ? 0.12 : 0.18;
        bulletFades.push({
          id: bullet.id,
          x: numberValue(bullet.x),
          y: numberValue(bullet.y),
          radius: numberValue(bullet.radius, BULLET_RADIUS),
          vx: numberValue(bullet.vx) * 0.18,
          vy: numberValue(bullet.vy) * 0.18,
          color: bullet.color || "green",
          projectile_type: projectileType,
          path_segments: normalizeSegments(bullet.path_segments),
          segments: normalizeSegments(bullet.segments),
          life: fadeLife,
          maxLife: fadeLife,
        });
        if (bulletFades.length > 80) bulletFades.splice(0, bulletFades.length - 80);
      }

      function pushBulletSmoke(fade) {
        const projectileType = String(fade.projectile_type || fade.projectileType || "bullet");
        if (!shouldSpawnProjectileSmoke(projectileType)) return;
        if (renderBullets.size > 34 && projectileType !== "bullet" && projectileType !== "double_barrel") return;
        if (renderBullets.size > 48 && bulletSmokeEffects.length > 24) return;
        const rng = seededVisualRandom(
          ((Number(fade.id) || 0) ^
            (Number(fade.server_id || fade.serverId) || 0) ^
            Math.floor(numberValue(fade.x) * 17) ^
            Math.floor(numberValue(fade.y) * 31)) >>> 0,
        );
        const baseRadius = Math.max(1.8, numberValue(fade.radius, BULLET_RADIUS));
        const puffs = [];
        for (let index = 0; index < 4; index += 1) {
          const angle = rng() * Math.PI * 2;
          const distanceScale = 0.18 + rng() * 0.78;
          puffs.push({
            offsetX: Math.cos(angle) * baseRadius * distanceScale,
            offsetY: Math.sin(angle) * baseRadius * distanceScale,
            driftX: Math.cos(angle) * (3.4 + rng() * 7.5) + numberValue(fade.vx) * 0.12,
            driftY: Math.sin(angle) * (3.4 + rng() * 7.5) + numberValue(fade.vy) * 0.12,
            radius: baseRadius * (0.72 + rng() * 0.72),
            alpha: 0.16 + rng() * 0.11,
          });
        }
        bulletSmokeEffects.push({
          id: Number(fade.id) || 0,
          x: numberValue(fade.x),
          y: numberValue(fade.y),
          radius: baseRadius,
          vx: numberValue(fade.vx) * 0.22,
          vy: numberValue(fade.vy) * 0.22,
          life: 0.34,
          maxLife: 0.34,
          puffs,
        });
        const maxSmoke = renderBullets.size > 34 ? 36 : 72;
        if (bulletSmokeEffects.length > maxSmoke) bulletSmokeEffects.splice(0, bulletSmokeEffects.length - maxSmoke);
      }

      function findPlayerSnapshot(playerId) {
        const source = latest?.players || [];
        return source.find((player) => String(player.player_id || "") === String(playerId || ""));
      }

      function seededVisualRandom(seed) {
        let state = (Number(seed) || 1) >>> 0;
        return () => {
          state = (state * 1664525 + 1013904223) >>> 0;
          return state / 0x100000000;
        };
      }

      function ejectShellCasingForPlayer(playerId, kind = "shotgun", seed = nextShellCasingId) {
        if (renderBullets.size > 42 && kind === "minigun" && shellCasings.length > 18) return;
        const player = findPlayerSnapshot(playerId);
        if (!player || !player.alive) return;
        const x = numberValue(player.x);
        const y = numberValue(player.y);
        const angle = numberValue(player.angle);
        const rng = seededVisualRandom((Math.floor(seed * 2654435761) ^ nextShellCasingId) >>> 0);
        const isMinigun = kind === "minigun";
        const ejectionSpread = isMinigun ? (rng() - 0.5) * (Math.PI / 6) : (rng() - 0.5) * (Math.PI / 18);
        const sideAngle = angle + Math.PI / 2 + ejectionSpread;
        const forwardJitter = isMinigun ? 5 + rng() * 4 : 7;
        const lateral = isMinigun ? 10.5 : 12;
        const sideSpeed = isMinigun ? 86 + rng() * 30 : 72;
        const backSpeed = isMinigun ? 16 + rng() * 20 : 24;
        const life = isMinigun ? 0.5 + rng() * 0.16 : 0.78;
        shellCasings.push({
          id: nextShellCasingId,
          kind,
          x: x + Math.cos(angle) * forwardJitter + Math.cos(sideAngle) * lateral,
          y: y + Math.sin(angle) * forwardJitter + Math.sin(sideAngle) * lateral,
          vx: Math.cos(sideAngle) * sideSpeed + Math.cos(angle + Math.PI) * backSpeed,
          vy: Math.sin(sideAngle) * sideSpeed + Math.sin(angle + Math.PI) * backSpeed,
          angle: angle + Math.PI / 2 + (rng() - 0.5) * 0.45,
          spin: (isMinigun ? 13.5 : 8.5) * (rng() > 0.5 ? 1 : -1),
          life,
          maxLife: life,
        });
        nextShellCasingId += 1;
        const maxCasings = renderBullets.size > 34 ? 28 : 54;
        if (shellCasings.length > maxCasings) shellCasings.splice(0, shellCasings.length - maxCasings);
      }

      function syncRenderBullets(serverBullets) {
        const seen = new Set();
        const newShotgunPelletsByOwner = new Map();
        const newMinigunBulletsByOwner = new Map();
        for (const entry of serverBullets || []) {
          if (numberValue(entry.life, BULLET_LIFE) <= 0) continue;
          const key = bulletKey(entry);
          seen.add(key);
          const targetX = numberValue(entry.x);
          const targetY = numberValue(entry.y);
          const targetVx = numberValue(entry.vx);
          const targetVy = numberValue(entry.vy);
          const pathSegments = normalizeSegments(entry.path_segments);
          const segments = normalizeSegments(entry.segments);
          const existing = renderBullets.get(key);
          if (!existing) {
            renderBullets.set(key, {
              id: numberValue(entry.id),
              ownerId: String(entry.owner_id || ""),
              color: entry.color || "green",
              projectile_type: String(entry.projectile_type || "bullet"),
              x: targetX,
              y: targetY,
              targetX,
              targetY,
              radius: numberValue(entry.radius, BULLET_RADIUS),
              vx: targetVx,
              vy: targetVy,
              targetVx,
              targetVy,
              path_segments: pathSegments,
              segments,
              life: numberValue(entry.life, BULLET_LIFE),
              age: numberValue(entry.age, Math.max(0, BULLET_LIFE - numberValue(entry.life, BULLET_LIFE))),
              bouncesLeft: numberValue(entry.bounces_left ?? entry.bouncesLeft, BULLET_BOUNCES),
              hasBounced: Boolean(entry.has_bounced ?? entry.hasBounced ?? false),
              ownerShieldReleased: Boolean(entry.owner_shield_released ?? true),
              lastSeenAt: performance.now(),
            });
            if (String(entry.projectile_type || "bullet") === "shotgun") {
              const ownerId = String(entry.owner_id || "");
              newShotgunPelletsByOwner.set(ownerId, (newShotgunPelletsByOwner.get(ownerId) || 0) + 1);
            } else if (String(entry.projectile_type || "bullet") === "minigun") {
              const ownerId = String(entry.owner_id || "");
              newMinigunBulletsByOwner.set(ownerId, (newMinigunBulletsByOwner.get(ownerId) || 0) + 1);
            }
            continue;
          }

          existing.color = entry.color || existing.color;
          existing.projectile_type = String(entry.projectile_type || existing.projectile_type || "bullet");
          existing.targetX = targetX;
          existing.targetY = targetY;
          existing.radius = numberValue(entry.radius, existing.radius);
          existing.targetVx = targetVx;
          existing.targetVy = targetVy;
          existing.path_segments = pathSegments;
          existing.segments = segments;
          existing.life = Math.min(existing.life, numberValue(entry.life, existing.life));
          existing.age = Math.max(existing.age, numberValue(entry.age, existing.age));
          existing.bouncesLeft = Math.min(
            existing.bouncesLeft,
            numberValue(entry.bounces_left ?? entry.bouncesLeft, existing.bouncesLeft),
          );
          existing.hasBounced = Boolean(entry.has_bounced ?? existing.hasBounced ?? false);
          existing.ownerShieldReleased = Boolean(entry.owner_shield_released ?? existing.ownerShieldReleased ?? true);
          if (existing.projectile_type !== "laser" && distance(existing.x, existing.y, targetX, targetY) > 420) {
            existing.x = targetX;
            existing.y = targetY;
          }
          existing.lastSeenAt = performance.now();
        }

        for (const [ownerId, pelletCount] of newShotgunPelletsByOwner.entries()) {
          if (pelletCount >= Math.max(3, SHOTGUN_PELLET_COUNT / 3)) {
            ejectShellCasingForPlayer(ownerId);
          }
        }
        for (const [ownerId, bulletCount] of newMinigunBulletsByOwner.entries()) {
          for (let index = 0; index < Math.min(4, bulletCount); index += 1) {
            ejectShellCasingForPlayer(ownerId, "minigun", performance.now() + index * 97);
          }
        }

        for (const [key, bullet] of renderBullets.entries()) {
          if (seen.has(key)) continue;
          pushBulletFade(bullet);
          renderBullets.delete(key);
        }
      }

      function bulletSyncKey(state) {
        const sourceBullets = state.server_bullets || state.bullets || [];
        return [
          state.map_id || "",
          state.snapshot_seq || 0,
          state.server_time_ms || 0,
          sourceBullets.length,
        ].join("|");
      }

      function syncRenderBulletsForSnapshot(state) {
        const key = bulletSyncKey(state);
        if (key === lastSyncedBulletKey) return;
        lastSyncedBulletKey = key;
        syncRenderBullets(state.server_bullets || state.bullets || []);
      }

      function advanceRenderBullet(bullet, walls, dt, playersForFrame = []) {
        if (String(bullet.projectile_type || bullet.projectileType || "bullet") === "laser" && bullet.segments?.length) {
          bullet.life -= dt;
          bullet.age += dt;
          if (bullet.life <= 0) {
            pushBulletFade(bullet);
            return false;
          }
          return true;
        }

        const previousX = bullet.x;
        const previousY = bullet.y;
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        bullet.age += dt;

        for (const shield of activeShieldColliders(playersForFrame, bullet.owner_id || bullet.ownerId || "", true)) {
          const shieldRadius = numberValue(shield.shieldRadius, SHIELD_RADIUS) + numberValue(bullet.radius, BULLET_RADIUS);
          const collision = segmentCircleCollision(previousX, previousY, bullet.x, bullet.y, shield.x, shield.y, shieldRadius);
          if (!collision) continue;
          const dot = bullet.vx * collision.normalX + bullet.vy * collision.normalY;
          bullet.vx -= 2 * dot * collision.normalX;
          bullet.vy -= 2 * dot * collision.normalY;
          bullet.bouncesLeft -= 1;
          bullet.hasBounced = true;
          bullet.x = shield.x + collision.normalX * (shieldRadius + 2.5);
          bullet.y = shield.y + collision.normalY * (shieldRadius + 2.5);
          pushShieldRipple(collision.x, collision.y, getPlayerPalette(shield.color).bright);
          break;
        }

        for (const wall of queryNearbyWalls(staticWallIndex || buildWallSpatialIndex(walls || []), bullet.x, bullet.y, numberValue(bullet.radius, BULLET_RADIUS) + 2)) {
          const expanded = {
            x: numberValue(wall.x) - bullet.radius,
            y: numberValue(wall.y) - bullet.radius,
            w: numberValue(wall.w) + bullet.radius * 2,
            h: numberValue(wall.h) + bullet.radius * 2,
          };
          const inside =
            bullet.x > expanded.x &&
            bullet.x < expanded.x + expanded.w &&
            bullet.y > expanded.y &&
            bullet.y < expanded.y + expanded.h;
          if (!inside) continue;

          let flipX = previousX <= expanded.x || previousX >= expanded.x + expanded.w;
          let flipY = previousY <= expanded.y || previousY >= expanded.y + expanded.h;
          if (!flipX && !flipY) {
            const distanceLeft = Math.abs(bullet.x - expanded.x);
            const distanceRight = Math.abs(expanded.x + expanded.w - bullet.x);
            const distanceTop = Math.abs(bullet.y - expanded.y);
            const distanceBottom = Math.abs(expanded.y + expanded.h - bullet.y);
            if (Math.min(distanceLeft, distanceRight) <= Math.min(distanceTop, distanceBottom)) flipX = true;
            else flipY = true;
          }

          if (flipX) bullet.vx *= -1;
          if (flipY) bullet.vy *= -1;
          bullet.bouncesLeft -= 1;
          bullet.hasBounced = true;
          bullet.x = previousX + bullet.vx * dt * 0.4;
          bullet.y = previousY + bullet.vy * dt * 0.4;
          pushWallRipple(
            wall,
            clamp(bullet.x, numberValue(wall.x), numberValue(wall.x) + numberValue(wall.w)),
            clamp(bullet.y, numberValue(wall.y), numberValue(wall.y) + numberValue(wall.h)),
            getPlayerPalette(bullet.color).bright,
          );
          break;
        }

        const drift = distance(bullet.x, bullet.y, bullet.targetX, bullet.targetY);
        const velocityBlend = dampFactor(7, dt);
        const positionBlend = dampFactor(drift > 220 ? 7 : 1.8, dt);
        bullet.vx += (bullet.targetVx - bullet.vx) * velocityBlend;
        bullet.vy += (bullet.targetVy - bullet.vy) * velocityBlend;
        if (drift > 360) {
          bullet.x = bullet.targetX;
          bullet.y = bullet.targetY;
        } else {
          bullet.x += (bullet.targetX - bullet.x) * positionBlend;
          bullet.y += (bullet.targetY - bullet.y) * positionBlend;
        }

        if (
          bullet.life <= 0 ||
          bullet.bouncesLeft < 0 ||
          bullet.x < ARENA_X - 64 ||
          bullet.x > ARENA_X + ARENA_WIDTH + 64 ||
          bullet.y < ARENA_Y - 64 ||
          bullet.y > ARENA_Y + ARENA_HEIGHT + 64
        ) {
          pushBulletFade(bullet);
          return false;
        }
        return true;
      }

      function advanceEffectsAndBullets(walls, dt, playersForFrame = []) {
        for (let index = wallRipples.length - 1; index >= 0; index -= 1) {
          wallRipples[index].life -= dt;
          if (wallRipples[index].life <= 0) wallRipples.splice(index, 1);
        }
        for (let index = bulletFades.length - 1; index >= 0; index -= 1) {
          const fade = bulletFades[index];
          fade.x += fade.vx * dt;
          fade.y += fade.vy * dt;
          fade.life -= dt;
          if (fade.life <= 0) {
            pushBulletSmoke(fade);
            bulletFades.splice(index, 1);
          }
        }
        for (let index = bulletSmokeEffects.length - 1; index >= 0; index -= 1) {
          const smoke = bulletSmokeEffects[index];
          smoke.x += smoke.vx * dt;
          smoke.y += smoke.vy * dt;
          smoke.life -= dt;
          if (smoke.life <= 0) bulletSmokeEffects.splice(index, 1);
        }
        for (const [key, bullet] of renderBullets.entries()) {
          if (!advanceRenderBullet(bullet, walls, dt, playersForFrame)) {
            renderBullets.delete(key);
          }
        }
        advanceEventEffects(dt);
      }

      function getRenderState() {
        if (!snapshotBuffer.length) {
          return latest || { walls: [], players: [], bullets: [], targets: [], active_player_count: 0 };
        }

        const targetServerTime = Date.now() + serverClockOffsetMs - INTERPOLATION_DELAY_MS;
        let previous = snapshotBuffer[0];
        let next = null;
        for (const snapshot of snapshotBuffer) {
          if (snapshot.server_time_ms <= targetServerTime) previous = snapshot;
          else {
            next = snapshot;
            break;
          }
        }

        if (next) return interpolateSnapshots(previous, next, targetServerTime);
        return extrapolateSnapshot(snapshotBuffer[snapshotBuffer.length - 1], targetServerTime);
      }

      function activePlayerCountFor(state) {
        return Math.max(
          Number(state?.active_player_count || 0),
          (state?.players || []).filter((player) => player && player.alive !== false).length,
          (state?.active_players || []).length,
        );
      }

      function maybeUpdateSidebar() {
        if (!latest) return;
        const now = Date.now();
        const scoreKey = (latest.active_players || [])
          .slice(0, 10)
          .map((row) => `${row.player_id}:${row.color}:${row.score}:${row.country_code}:${normalizeLatencyMs(row.latency_ms)}`)
          .join("|");
        const key = [
          latest.map_id,
          latest.snapshot_seq,
          latest.active_player_count,
          latest.vote_count,
          latest.vote_required,
          latest.countdown_seconds,
          latest.countdown_active,
          scoreKey,
        ].join("|");
        if (key === lastSidebarKey && now - lastSidebarUpdateAt < SIDEBAR_MIN_INTERVAL_MS) return;
        lastSidebarKey = key;
        lastSidebarUpdateAt = now;
        updateSidebar();
      }

      async function pollState() {
        if (polling || destroyed) return;
        polling = true;
        try {
          const response = await fetch(`${stateUrl}&ts=${Date.now()}`, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          pushSnapshot(sanitizeState(await response.json()));
          lastOkAt = Date.now();
          lastError = "";
          maybeUpdateSidebar();
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        } finally {
          polling = false;
          const hasPlayers = latest && activePlayerCountFor(latest) > 0;
          window.setTimeout(pollState, hasPlayers ? POLL_ACTIVE_MS : POLL_IDLE_MS);
        }
      }

      function drawBackgroundTo(context) {
        const darkMode = spectatorTheme === "dark";
        const shellGradient = context.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        shellGradient.addColorStop(0, darkMode ? "#04101d" : "#f9fcff");
        shellGradient.addColorStop(1, darkMode ? "#091727" : "#dcebff");
        context.fillStyle = shellGradient;
        context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        context.save();
        context.shadowColor = darkMode ? "rgba(96, 165, 250, 0.34)" : "rgba(96, 165, 250, 0.24)";
        context.shadowBlur = 24;
        const arenaGradient = context.createLinearGradient(ARENA_X, ARENA_Y, ARENA_X, ARENA_Y + ARENA_HEIGHT);
        arenaGradient.addColorStop(0, darkMode ? "#06111f" : "#fcfeff");
        arenaGradient.addColorStop(1, darkMode ? "#0d1f36" : "#e7f3ff");
        roundedRect(context, ARENA_X - 10, ARENA_Y - 10, ARENA_WIDTH + 20, ARENA_HEIGHT + 20, 28);
        context.fillStyle = arenaGradient;
        context.fill();
        context.restore();

        context.save();
        context.strokeStyle = darkMode ? "rgba(125, 211, 252, 0.08)" : "rgba(37, 99, 235, 0.1)";
        context.lineWidth = 1;
        for (let x = ARENA_X + 60; x < ARENA_X + ARENA_WIDTH; x += 88) {
          context.beginPath();
          context.moveTo(x, ARENA_Y);
          context.lineTo(x, ARENA_Y + ARENA_HEIGHT);
          context.stroke();
        }
        for (let y = ARENA_Y + 60; y < ARENA_Y + ARENA_HEIGHT; y += 88) {
          context.beginPath();
          context.moveTo(ARENA_X, y);
          context.lineTo(ARENA_X + ARENA_WIDTH, y);
          context.stroke();
        }
        context.restore();
      }

      function drawWalls(walls) {
        const darkMode = spectatorTheme === "dark";
        const wallFill = darkMode
          ? ["rgba(18, 46, 78, 0.98)", "rgba(5, 14, 26, 0.98)"]
          : ["rgba(251, 253, 255, 0.995)", "rgba(210, 232, 255, 0.975)"];
        const wallCore = darkMode ? "rgba(103, 232, 249, 0.24)" : "rgba(14, 165, 233, 0.22)";
        const wallStroke = darkMode ? "rgba(165, 243, 252, 0.3)" : "rgba(59, 130, 246, 0.3)";
        const wallSheen = darkMode ? "rgba(224, 242, 254, 0.18)" : "rgba(255, 255, 255, 0.82)";
        const wallScan = darkMode ? "rgba(34, 211, 238, 0.32)" : "rgba(56, 189, 248, 0.3)";
        const wallBracket = darkMode ? "rgba(191, 219, 254, 0.3)" : "rgba(37, 99, 235, 0.24)";
        const wallNode = darkMode ? "#67e8f9" : "#0284c7";
        const wallEdgeGlow = darkMode ? "rgba(34, 211, 238, 0.2)" : "rgba(96, 165, 250, 0.22)";
        const wallTime = renderTime;

        for (const wall of walls) {
          const x = numberValue(wall.x);
          const y = numberValue(wall.y);
          const w = numberValue(wall.w);
          const h = numberValue(wall.h);
          const horizontal = w >= h;
          const wallMidX = x + w / 2;
          const wallMidY = y + h / 2;
          const pulse = 0.58 + 0.42 * Math.sin(wallTime * 2.1 + x * 0.018 + y * 0.023);
          const scanLength = horizontal ? w + 40 : h + 40;
          const scanOffset = ((wallTime * 74 + x * 0.62 + y * 0.37) % scanLength) - 20;

          ctx.save();
          roundedRect(ctx, x, y, w, h, 12);
          const wallGradient = ctx.createLinearGradient(x, y, x + w, y + h);
          wallGradient.addColorStop(0, wallFill[0]);
          wallGradient.addColorStop(1, wallFill[1]);
          ctx.fillStyle = wallGradient;
          ctx.shadowColor = wallEdgeGlow;
          ctx.shadowBlur = darkMode ? 14 : 11;
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = wallStroke;
          ctx.stroke();

          ctx.save();
          roundedRect(ctx, x, y, w, h, 12);
          ctx.clip();
          const sheenGradient = horizontal
            ? ctx.createLinearGradient(x, y, x, y + h)
            : ctx.createLinearGradient(x, y, x + w, y);
          sheenGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
          sheenGradient.addColorStop(0.5, wallSheen);
          sheenGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.globalAlpha = darkMode ? 0.72 : 0.82;
          ctx.fillStyle = sheenGradient;
          ctx.fillRect(x, y, w, h);

          const scanGradient = horizontal
            ? ctx.createLinearGradient(x + scanOffset, y, x + scanOffset + 22, y)
            : ctx.createLinearGradient(x, y + scanOffset, x, y + scanOffset + 22);
          scanGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
          scanGradient.addColorStop(0.5, wallScan);
          scanGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.globalAlpha = 0.62 + pulse * 0.24;
          ctx.fillStyle = scanGradient;
          if (horizontal) ctx.fillRect(x + scanOffset, y + 2, 22, Math.max(1, h - 4));
          else ctx.fillRect(x + 2, y + scanOffset, Math.max(1, w - 4), 22);
          ctx.restore();

          ctx.beginPath();
          if (horizontal) {
            ctx.moveTo(x + 10, y + h / 2);
            ctx.lineTo(x + w - 10, y + h / 2);
          } else {
            ctx.moveTo(x + w / 2, y + 10);
            ctx.lineTo(x + w / 2, y + h - 10);
          }
          ctx.lineWidth = darkMode ? 2.4 : 2.1;
          ctx.strokeStyle = wallCore;
          ctx.stroke();

          ctx.beginPath();
          ctx.setLineDash(horizontal ? [12, 8] : [10, 8]);
          if (horizontal) {
            ctx.moveTo(x + 15, wallMidY - 4);
            ctx.lineTo(x + w - 15, wallMidY - 4);
            ctx.moveTo(x + 15, wallMidY + 4);
            ctx.lineTo(x + w - 15, wallMidY + 4);
          } else {
            ctx.moveTo(wallMidX - 4, y + 15);
            ctx.lineTo(wallMidX - 4, y + h - 15);
            ctx.moveTo(wallMidX + 4, y + 15);
            ctx.lineTo(wallMidX + 4, y + h - 15);
          }
          ctx.lineWidth = 1;
          ctx.strokeStyle = hexToRgba(wallNode, darkMode ? 0.16 + pulse * 0.12 : 0.12 + pulse * 0.1);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          if (horizontal) {
            ctx.moveTo(x + 8, y + 4);
            ctx.lineTo(x + 24, y + 4);
            ctx.moveTo(x + 8, y + h - 4);
            ctx.lineTo(x + 24, y + h - 4);
            ctx.moveTo(x + w - 8, y + 4);
            ctx.lineTo(x + w - 24, y + 4);
            ctx.moveTo(x + w - 8, y + h - 4);
            ctx.lineTo(x + w - 24, y + h - 4);
          } else {
            ctx.moveTo(x + 4, y + 8);
            ctx.lineTo(x + 4, y + 24);
            ctx.moveTo(x + w - 4, y + 8);
            ctx.lineTo(x + w - 4, y + 24);
            ctx.moveTo(x + 4, y + h - 8);
            ctx.lineTo(x + 4, y + h - 24);
            ctx.moveTo(x + w - 4, y + h - 8);
            ctx.lineTo(x + w - 4, y + h - 24);
          }
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = wallBracket;
          ctx.stroke();

          ctx.save();
          ctx.shadowColor = wallNode;
          ctx.shadowBlur = darkMode ? 10 : 8;
          ctx.fillStyle = wallNode;
          if (horizontal) {
            for (const nodeX of [x + 16, wallMidX, x + w - 16]) {
              ctx.beginPath();
              ctx.arc(nodeX, wallMidY, 2.2 + pulse * 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            for (const nodeY of [y + 16, wallMidY, y + h - 16]) {
              ctx.beginPath();
              ctx.arc(wallMidX, nodeY, 2.2 + pulse * 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
          ctx.restore();
        }
      }

      function drawTargets(targets) {
        const darkMode = spectatorTheme === "dark";
        const targetPalette = getPlayerPalette("green");
        for (const target of targets) {
          const x = numberValue(target.x);
          const y = numberValue(target.y);
          const radius = numberValue(target.radius, 18);
          const phase = numberValue(target.phase) + renderTime * 2.2;
          const pulse = 1 + Math.sin(phase) * 0.08;
          ctx.save();
          ctx.fillStyle = hexToRgba(targetPalette.base, darkMode ? 0.24 : 0.18);
          ctx.beginPath();
          ctx.arc(x, y, radius * 1.66 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 16;
          ctx.shadowColor = targetPalette.glow;
          ctx.fillStyle = targetPalette.bright;
          ctx.beginPath();
          ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = 2;
          ctx.strokeStyle = darkMode ? "rgba(240, 253, 244, 0.54)" : "rgba(240, 253, 244, 0.7)";
          ctx.stroke();
          ctx.font = "700 14px 'Segoe UI'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = darkMode ? "#04111d" : "#f8fafc";
          ctx.fillText(String(target.id || 0).padStart(2, "0"), x, y + 1);
          ctx.restore();
        }
      }

      function syncEventEffects(state) {
        const now = Date.now();
        for (const event of state.tank_explosions || []) {
          const eventId = numberValue(event.id);
          if (!eventId || tankExplosions.has(eventId)) continue;
          if (String(event.weapon || "") === "laser") {
            removeLaserHitBullet(event.suicide ? event.victim_id : event.killer_id, event.bullet_id);
          }
          const createdAt = numberValue(event.created_at_ms, state.server_time_ms || now);
          const maxLife = Math.max(0.12, numberValue(event.maxLife, 0.78));
          const age = Math.max(0, (now + serverClockOffsetMs - createdAt) / 1000);
          tankExplosions.set(eventId, {
            id: eventId,
            x: numberValue(event.x),
            y: numberValue(event.y),
            radius: numberValue(event.radius, 20),
          color: event.color || "green",
            life: Math.max(0.01, maxLife - age),
            maxLife,
          });
          const victimId = String(event.victim_id || "").trim();
          if (victimId) {
            killFeedEntries.push({
              id: eventId,
              killerId: String(event.killer_id || "").trim(),
              victimId,
              killerColor: String(event.killer_color || event.color || "green"),
              victimColor: String(event.victim_color || event.color || "green"),
              weapon: String(event.weapon || "bullet"),
              suicide: Boolean(event.suicide),
              life: 2.35,
              maxLife: 2.35,
            });
            if (killFeedEntries.length > 12) killFeedEntries.splice(0, killFeedEntries.length - 12);
          }
        }
        for (const effect of state.powerup_effects || []) {
          const effectId = numberValue(effect.id);
          if (!effectId || powerupEffects.has(effectId)) continue;
          const createdAt = numberValue(effect.created_at_ms, state.server_time_ms || now);
          const maxLife = 0.78;
          const age = Math.max(0, (now + serverClockOffsetMs - createdAt) / 1000);
          powerupEffects.set(effectId, {
            id: effectId,
            x: numberValue(effect.x),
            y: numberValue(effect.y),
            radius: numberValue(effect.radius, 18),
            color: effect.color || "#9ca3af",
            symbol: String(effect.symbol || "$$").slice(0, 3) || "$$",
            effect: String(effect.effect || "score"),
            scoreDelta: numberValue(effect.score_delta, 100),
            life: Math.max(0.01, maxLife - age),
            maxLife,
          });
        }
      }

      function advanceEventEffects(dt) {
        for (const [id, explosion] of tankExplosions.entries()) {
          explosion.life -= dt;
          if (explosion.life <= 0) tankExplosions.delete(id);
        }
        for (const [id, effect] of powerupEffects.entries()) {
          effect.life -= dt;
          if (effect.life <= 0) powerupEffects.delete(id);
        }
        for (let index = shellCasings.length - 1; index >= 0; index -= 1) {
          const shell = shellCasings[index];
          shell.x += shell.vx * dt;
          shell.y += shell.vy * dt;
          shell.vx *= Math.pow(0.08, dt);
          shell.vy = shell.vy * Math.pow(0.08, dt) + 30 * dt;
          shell.angle += shell.spin * dt;
          shell.life -= dt;
          if (shell.life <= 0) shellCasings.splice(index, 1);
        }
        for (let index = killFeedEntries.length - 1; index >= 0; index -= 1) {
          killFeedEntries[index].life -= dt;
          if (killFeedEntries[index].life <= 0) killFeedEntries.splice(index, 1);
        }
      }

      function drawPowerups(powerups) {
        const darkMode = spectatorTheme === "dark";
        const visual = powerupVisualPalette();
        for (const powerup of powerups || []) {
          const x = numberValue(powerup.x);
          const y = numberValue(powerup.y);
          const radius = numberValue(powerup.radius, 18);
          const phase = numberValue(powerup.phase) + renderTime * 3;
          const pulse = 1 + Math.sin(phase) * 0.08;
          const shimmer = 0.5 + Math.sin(phase * 1.3 + numberValue(powerup.id)) * 0.5;

          ctx.save();
          ctx.translate(x, y);
          ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
          ctx.shadowColor = hexToRgba(visual.glow, darkMode ? 0.38 : 0.22);
          ctx.shadowBlur = 14 + shimmer * 6;
          ctx.fillStyle = visual.outer;
          ctx.beginPath();
          ctx.arc(0, 0, radius * 1.78 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = visual.ring;
          for (let index = 0; index < 8; index += 1) {
            const angle = (index / 8) * Math.PI * 2 + phase * 0.55;
            ctx.beginPath();
            ctx.arc(0, 0, radius * (1.16 + shimmer * 0.08), angle, angle + 0.28);
            ctx.stroke();
          }
          const bodyGradient = ctx.createRadialGradient(-radius * 0.25, -radius * 0.35, 1, 0, 0, radius);
          bodyGradient.addColorStop(0, visual.bodyTop);
          bodyGradient.addColorStop(0.56, visual.bodyMid);
          bodyGradient.addColorStop(1, visual.bodyBottom);
          ctx.fillStyle = bodyGradient;
          ctx.beginPath();
          ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = visual.stroke;
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
          ctx.shadowColor = darkMode ? "rgba(2, 6, 23, 0.62)" : "rgba(255, 255, 255, 0.32)";
          ctx.shadowBlur = darkMode ? 8 : 2;
          if (String(powerup.kind || "") === "shotgun") {
            drawPowerupPngIcon("shotgun", radius, () => drawShotgunPowerupIcon(radius));
          } else if (String(powerup.kind || "") === "laser") {
            drawPowerupPngIcon("laser", radius, () => drawLaserPowerupIcon(radius));
          } else if (String(powerup.kind || "") === "minigun") {
            drawPowerupPngIcon("minigun", radius, () => drawMinigunPowerupIcon(radius));
          } else if (String(powerup.kind || "") === "double_barrel") {
            drawPowerupPngIcon("double_barrel", radius, () => drawCashPowerupIcon(radius, visual.symbol));
          } else if (String(powerup.kind || "") === "shield") {
            drawPowerupPngIcon("shield", radius, () => drawShieldPowerupIcon(radius));
          } else {
            drawPowerupPngIcon("cash", radius, () => drawCashPowerupIcon(radius, visual.symbol));
          }
          ctx.restore();
        }
      }

      function getPowerupIcon(kind) {
        const source = POWERUP_ICON_SOURCES[kind] || POWERUP_ICON_SOURCES.cash;
        if (!source) return null;
        const cached = powerupIconCache.get(source);
        if (cached) return cached;
        const image = new Image();
        image.decoding = "async";
        image.src = source;
        powerupIconCache.set(source, image);
        return image;
      }

      function drawPowerupPngIcon(kind, radius, fallback) {
        const image = getPowerupIcon(kind);
        if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          fallback();
          return;
        }
        const maxWidth = radius * 1.58;
        const maxHeight = radius * 1.58;
        const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, -width / 2, -height / 2, width, height);
        ctx.restore();
      }

      function drawShotgunPowerupIcon(radius) {
        const darkMode = spectatorTheme === "dark";
        ctx.save();
        ctx.rotate(-Math.PI / 5);
        const shellGradient = ctx.createLinearGradient(-radius * 0.92, 0, radius * 0.88, 0);
        shellGradient.addColorStop(0, "#fca5a5");
        shellGradient.addColorStop(0.42, "#ef4444");
        shellGradient.addColorStop(1, "#b91c1c");
        ctx.fillStyle = shellGradient;
        ctx.shadowColor = darkMode ? "rgba(248, 113, 113, 0.62)" : "rgba(239, 68, 68, 0.36)";
        ctx.shadowBlur = 7;
        roundedRect(ctx, -radius * 0.74, -radius * 0.18, radius * 1.2, radius * 0.36, radius * 0.18);
        ctx.fill();
        const brassGradient = ctx.createLinearGradient(radius * 0.32, 0, radius * 0.82, 0);
        brassGradient.addColorStop(0, "#fde68a");
        brassGradient.addColorStop(0.55, "#d97706");
        brassGradient.addColorStop(1, "#92400e");
        ctx.fillStyle = brassGradient;
        roundedRect(ctx, radius * 0.28, -radius * 0.2, radius * 0.44, radius * 0.4, radius * 0.16);
        ctx.fill();
        ctx.strokeStyle = darkMode ? "rgba(254, 226, 226, 0.62)" : "rgba(127, 29, 29, 0.28)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = darkMode ? "rgba(248, 250, 252, 0.9)" : "rgba(15, 23, 42, 0.72)";
        for (const point of [[-0.35, -0.28], [-0.08, -0.34], [0.18, -0.26]]) {
          ctx.beginPath();
          ctx.arc(point[0] * radius, point[1] * radius, radius * 0.065, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      function drawLaserPowerupIcon(radius) {
        const darkMode = spectatorTheme === "dark";
        const red = darkMode ? "#fecaca" : "#dc2626";
        const core = darkMode ? "#f87171" : "#ef4444";
        ctx.save();
        ctx.shadowColor = darkMode ? "rgba(248, 113, 113, 0.72)" : "rgba(220, 38, 38, 0.34)";
        ctx.shadowBlur = 8;
        ctx.strokeStyle = core;
        ctx.lineWidth = Math.max(2.2, radius * 0.15);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-radius * 0.08, 0);
        ctx.lineTo(radius * 0.82, 0);
        ctx.stroke();
        ctx.lineWidth = Math.max(1.5, radius * 0.085);
        ctx.strokeStyle = red;
        for (let index = 0; index < 18; index += 1) {
          const angle = (index / 18) * Math.PI * 2;
          const inner = radius * 0.22;
          const outer = radius * (0.54 + (index % 3) * 0.035);
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.stroke();
        }
        const burstGradient = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 0.36);
        burstGradient.addColorStop(0, darkMode ? "#fff7ed" : "#fee2e2");
        burstGradient.addColorStop(0.42, core);
        burstGradient.addColorStop(1, darkMode ? "rgba(127, 29, 29, 0.72)" : "rgba(153, 27, 27, 0.42)");
        ctx.fillStyle = burstGradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawMinigunPowerupIcon(radius) {
        const darkMode = spectatorTheme === "dark";
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.rotate(-0.18);
        const metal = ctx.createLinearGradient(-radius * 0.7, 0, radius * 0.82, 0);
        metal.addColorStop(0, darkMode ? "#0f172a" : "#e5edf7");
        metal.addColorStop(0.45, darkMode ? "#94a3b8" : "#64748b");
        metal.addColorStop(1, darkMode ? "#020617" : "#cbd5e1");
        ctx.shadowColor = darkMode ? "rgba(148, 163, 184, 0.42)" : "rgba(30, 41, 59, 0.18)";
        ctx.shadowBlur = 8;
        for (let index = -2; index <= 2; index += 1) {
          const offset = index * radius * 0.13;
          roundedRect(ctx, -radius * 0.62, offset - radius * 0.035, radius * 1.1, radius * 0.07, radius * 0.035);
          ctx.fillStyle = metal;
          ctx.fill();
        }
        const muzzle = ctx.createRadialGradient(radius * 0.55, 0, 1, radius * 0.55, 0, radius * 0.28);
        muzzle.addColorStop(0, darkMode ? "#020617" : "#f8fafc");
        muzzle.addColorStop(1, darkMode ? "#64748b" : "#475569");
        ctx.beginPath();
        ctx.arc(radius * 0.56, 0, radius * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = muzzle;
        ctx.fill();
        ctx.strokeStyle = darkMode ? "rgba(226, 232, 240, 0.42)" : "rgba(15, 23, 42, 0.28)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-radius * 0.48, 0, radius * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = darkMode ? "rgba(15, 23, 42, 0.92)" : "rgba(241, 245, 249, 0.9)";
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      function drawShieldPowerupIcon(radius) {
        const darkMode = spectatorTheme === "dark";
        ctx.save();
        ctx.shadowColor = darkMode ? "rgba(147, 197, 253, 0.62)" : "rgba(59, 130, 246, 0.32)";
        ctx.shadowBlur = 9;
        const shieldGradient = ctx.createLinearGradient(0, -radius * 0.88, 0, radius * 0.82);
        shieldGradient.addColorStop(0, darkMode ? "#e0f2fe" : "#f8fafc");
        shieldGradient.addColorStop(0.48, darkMode ? "#60a5fa" : "#93c5fd");
        shieldGradient.addColorStop(1, darkMode ? "#1e3a8a" : "#2563eb");
        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.82);
        ctx.quadraticCurveTo(radius * 0.7, -radius * 0.52, radius * 0.58, radius * 0.12);
        ctx.quadraticCurveTo(radius * 0.46, radius * 0.62, 0, radius * 0.86);
        ctx.quadraticCurveTo(-radius * 0.46, radius * 0.62, -radius * 0.58, radius * 0.12);
        ctx.quadraticCurveTo(-radius * 0.7, -radius * 0.52, 0, -radius * 0.82);
        ctx.closePath();
        ctx.fillStyle = shieldGradient;
        ctx.fill();
        ctx.strokeStyle = darkMode ? "rgba(248, 250, 252, 0.82)" : "rgba(30, 64, 175, 0.5)";
        ctx.lineWidth = Math.max(1.4, radius * 0.09);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.5);
        ctx.lineTo(0, radius * 0.52);
        ctx.moveTo(-radius * 0.35, -radius * 0.08);
        ctx.lineTo(radius * 0.35, -radius * 0.08);
        ctx.strokeStyle = darkMode ? "rgba(2, 6, 23, 0.56)" : "rgba(255, 255, 255, 0.78)";
        ctx.lineWidth = Math.max(1.1, radius * 0.06);
        ctx.stroke();
        ctx.restore();
      }

      function drawCashPowerupIcon(radius, fillStyle) {
        const darkMode = spectatorTheme === "dark";
        ctx.save();
        ctx.scale(1.04, 1);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.max(33, radius * 1.9)}px "Segoe UI"`;
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = darkMode ? "rgba(255, 247, 237, 0.9)" : "rgba(120, 53, 15, 0.42)";
        ctx.lineWidth = Math.max(1.2, radius * 0.07);
        ctx.shadowColor = darkMode ? "rgba(250, 204, 21, 0.38)" : "rgba(180, 83, 9, 0.24)";
        ctx.shadowBlur = darkMode ? 6 : 4;
        ctx.strokeText("S", 0, radius * 0.02);
        ctx.fillText("S", 0, radius * 0.02);
        ctx.shadowBlur = 0;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(2.5, radius * 0.15);
        ctx.strokeStyle = fillStyle;
        const lineTop = -radius * 0.9;
        const lineBottom = radius * 0.9;
        const lineOffset = radius * 0.11;
        for (const x of [-lineOffset, lineOffset]) {
          ctx.beginPath();
          ctx.moveTo(x, lineTop);
          ctx.lineTo(x, lineBottom);
          ctx.stroke();
        }
        ctx.restore();
      }

      function drawPowerupEffects() {
        const darkMode = spectatorTheme === "dark";
        for (const effect of powerupEffects.values()) {
          const progress = clamp(1 - effect.life / effect.maxLife, 0, 1);
          const alpha = Math.max(0, 1 - progress);
          ctx.save();
          ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
          ctx.shadowColor = hexToRgba(effect.color, darkMode ? 0.62 : 0.42);
          ctx.shadowBlur = 22 * alpha;
          ctx.lineWidth = 3.2 - progress * 1.8;
          ctx.strokeStyle = hexToRgba(effect.color, (darkMode ? 0.76 : 0.56) * alpha);
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (1.1 + progress * 2.5), 0, Math.PI * 2);
          ctx.stroke();
          for (let index = 0; index < 10; index += 1) {
            const angle = (index / 10) * Math.PI * 2 + progress * 0.8;
            const inner = effect.radius * (0.75 + progress * 1.1);
            const outer = effect.radius * (1.1 + progress * 2.1);
            ctx.beginPath();
            ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
            ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = hexToRgba(effect.color, (darkMode ? 0.48 : 0.34) * alpha);
            ctx.stroke();
          }
          const label = getPowerupPickupLabel(effect);
          ctx.font = `900 ${effect.effect === "score" ? 18 : 15}px 'Segoe UI'`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 3;
          ctx.strokeStyle = hexToRgba(darkMode ? "#020617" : "#ffffff", alpha * 0.58);
          ctx.fillStyle = hexToRgba(darkMode ? "#f8fafc" : "#0f172a", alpha);
          const labelY = effect.y - effect.radius * (1.6 + progress * 1.4);
          ctx.strokeText(label, effect.x, labelY);
          ctx.fillText(label, effect.x, labelY);
          ctx.restore();
        }
      }

      function drawBulletWeaponIcon(x, y, size) {
        const darkMode = spectatorTheme === "dark";
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 4);
        const bodyGradient = ctx.createLinearGradient(-size * 0.42, 0, size * 0.42, 0);
        bodyGradient.addColorStop(0, darkMode ? "#64748b" : "#94a3b8");
        bodyGradient.addColorStop(0.5, darkMode ? "#e2e8f0" : "#475569");
        bodyGradient.addColorStop(1, darkMode ? "#f8fafc" : "#1e293b");
        ctx.fillStyle = bodyGradient;
        roundedRect(ctx, -size * 0.34, -size * 0.16, size * 0.68, size * 0.32, size * 0.16);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(size * 0.33, -size * 0.16);
        ctx.lineTo(size * 0.55, 0);
        ctx.lineTo(size * 0.33, size * 0.16);
        ctx.closePath();
        ctx.fillStyle = darkMode ? "#f8fafc" : "#0f172a";
        ctx.fill();
        ctx.strokeStyle = darkMode ? "rgba(15, 23, 42, 0.58)" : "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = Math.max(1, size * 0.07);
        ctx.stroke();
        ctx.restore();
      }

      function drawSkullWeaponIcon(x, y, size) {
        const darkMode = spectatorTheme === "dark";
        const fill = darkMode ? "#e2e8f0" : "#1e293b";
        const cutout = darkMode ? "#0f172a" : "#f8fafc";
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(0, -size * 0.08, size * 0.34, 0, Math.PI * 2);
        ctx.fill();
        roundedRect(ctx, -size * 0.23, size * 0.05, size * 0.46, size * 0.36, size * 0.08);
        ctx.fill();
        ctx.fillStyle = cutout;
        ctx.beginPath();
        ctx.arc(-size * 0.13, -size * 0.08, size * 0.075, 0, Math.PI * 2);
        ctx.arc(size * 0.13, -size * 0.08, size * 0.075, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, size * 0.02);
        ctx.lineTo(-size * 0.06, size * 0.14);
        ctx.lineTo(size * 0.06, size * 0.14);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-size * 0.14, size * 0.24, size * 0.055, size * 0.13);
        ctx.fillRect(-size * 0.025, size * 0.24, size * 0.05, size * 0.13);
        ctx.fillRect(size * 0.085, size * 0.24, size * 0.055, size * 0.13);
        ctx.restore();
      }

      function drawKillFeed() {
        const entry = killFeedEntries[killFeedEntries.length - 1];
        if (!entry) return;
        const fadeIn = clamp((entry.maxLife - entry.life) / 0.12, 0, 1);
        const fadeOut = clamp(entry.life / 0.38, 0, 1);
        const alpha = Math.min(fadeIn, fadeOut);
        const fontSize = 28;
        const iconSize = 30;
        const gap = 13;
        const killer = shortPlayerName(entry.killerId);
        const victim = shortPlayerName(entry.victimId);
        const weapon = entry.suicide ? "suicide" : entry.weapon || "bullet";
        const killerPalette = getPlayerPalette(entry.killerColor || entry.victimColor || "green");
        const victimPalette = getPlayerPalette(entry.victimColor || "green");
        const x = ARENA_X + ARENA_WIDTH - 14;
        const y = ARENA_Y - 42;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `900 ${fontSize}px "Segoe UI"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const victimWidth = ctx.measureText(victim).width;
        const killerWidth = entry.suicide ? 0 : ctx.measureText(killer).width;
        const totalWidth = entry.suicide
          ? iconSize + victimWidth + gap
          : killerWidth + iconSize + victimWidth + gap * 2;
        let cursorX = x - totalWidth;
        if (!entry.suicide) {
          ctx.fillStyle = killerPalette.bright;
          ctx.shadowColor = killerPalette.glow;
          ctx.shadowBlur = 12;
          ctx.fillText(killer, cursorX, y);
          ctx.shadowBlur = 0;
          cursorX += killerWidth + gap;
        }
        if (weapon === "suicide") drawSkullWeaponIcon(cursorX + iconSize / 2, y, iconSize);
        else drawBulletWeaponIcon(cursorX + iconSize / 2, y, iconSize);
        cursorX += iconSize + gap;
        ctx.fillStyle = victimPalette.bright;
        ctx.shadowColor = victimPalette.glow;
        ctx.shadowBlur = 12;
        ctx.fillText(victim, cursorX, y);
        ctx.restore();
      }

      function drawTankExplosions() {
        const darkMode = spectatorTheme === "dark";
        for (const explosion of tankExplosions.values()) {
          const maxLife = Math.max(0.0001, explosion.maxLife || 0.78);
          const progress = clamp(1 - explosion.life / maxLife, 0, 1);
          const alpha = Math.max(0, 1 - progress);
          if (alpha <= 0) continue;
          const p = getPlayerPalette(explosion.color);
          const shockRadius = explosion.radius * (1.15 + progress * 3.8);
          ctx.save();
          ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
          ctx.shadowColor = p.glow;
          ctx.shadowBlur = 26 * alpha;
          ctx.beginPath();
          ctx.arc(explosion.x, explosion.y, shockRadius, 0, Math.PI * 2);
          ctx.lineWidth = 5.4 - progress * 3.4;
          ctx.strokeStyle = hexToRgba(p.bright, (darkMode ? 0.78 : 0.6) * alpha);
          ctx.stroke();
          const gradient = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, explosion.radius * (1.6 + progress * 2.3));
          gradient.addColorStop(0, hexToRgba(p.bright, (darkMode ? 0.42 : 0.32) * alpha));
          gradient.addColorStop(0.42, hexToRgba(p.base, (darkMode ? 0.24 : 0.18) * alpha));
          gradient.addColorStop(1, hexToRgba(p.base, 0));
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(explosion.x, explosion.y, explosion.radius * (1.6 + progress * 2.3), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.translate(explosion.x, explosion.y);
          ctx.rotate(progress * Math.PI * 0.85 + explosion.id * 0.17);
          ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
          ctx.shadowColor = p.glow;
          ctx.shadowBlur = 18 * alpha;
          const techRadius = explosion.radius * (1.85 + progress * 2.7);
          for (let index = 0; index < 18; index += 1) {
            if (index % 3 === 1) continue;
            const start = (index / 18) * Math.PI * 2;
            const end = start + (Math.PI * 2 / 18) * 0.52;
            ctx.beginPath();
            ctx.arc(0, 0, techRadius, start, end);
            ctx.lineWidth = 2.1 - progress * 1.2;
            ctx.strokeStyle = hexToRgba(p.bright, (darkMode ? 0.62 : 0.48) * alpha);
            ctx.stroke();
          }
          for (let index = 0; index < 8; index += 1) {
            const angle = (index / 8) * Math.PI * 2 + progress * 1.1;
            const inner = explosion.radius * (0.7 + progress * 1.3);
            const outer = explosion.radius * (1.25 + progress * 2.1);
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
            ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
            ctx.lineWidth = 1.1;
            ctx.strokeStyle = hexToRgba(p.bright, (darkMode ? 0.36 : 0.28) * alpha);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      function drawWallRipples() {
        for (const ripple of wallRipples) {
          const progress = 1 - ripple.life / ripple.maxLife;
          ctx.save();
          roundedRect(ctx, ripple.wall.x, ripple.wall.y, ripple.wall.w, ripple.wall.h, 12);
          ctx.clip();
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, 8 + progress * 34, 0, Math.PI * 2);
          ctx.lineWidth = 2.2 - progress * 0.9;
          ctx.strokeStyle = hexToRgba(ripple.color, 0.82 - progress * 0.66);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, 3 + progress * 10, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(ripple.color, Math.max(0, 0.18 - progress * 0.14));
          ctx.fill();
          ctx.restore();
        }
      }

      function drawBullet(bullet) {
        const projectileType = String(bullet.projectile_type || bullet.projectileType || "bullet");
        if (projectileType === "laser") {
          drawLaserProjectile(bullet, latest?.walls || []);
          return;
        }
        drawBulletSprite(bullet, bullet.color || "green");
      }

      function strokeLaserPath(segments, strokeStyle, lineWidth, shadowBlur = 0, shadowColor = "transparent") {
        if (!segments.length) return;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowColor = shadowColor;
        ctx.beginPath();
        let hasPoint = false;
        let lastX = 0;
        let lastY = 0;
        for (const segment of segments) {
          if (!hasPoint || distance(lastX, lastY, segment.x1, segment.y1) > 8) {
            ctx.moveTo(segment.x1, segment.y1);
          } else {
            ctx.lineTo(segment.x1, segment.y1);
          }
          ctx.lineTo(segment.x2, segment.y2);
          hasPoint = true;
          lastX = segment.x2;
          lastY = segment.y2;
        }
        ctx.stroke();
        ctx.restore();
      }

      function drawLaserProjectile(bullet, walls) {
        const p = getPlayerPalette(bullet.color);
        const x = numberValue(bullet.x);
        const y = numberValue(bullet.y);
        const vx = numberValue(bullet.vx);
        const vy = numberValue(bullet.vy);
        const radius = numberValue(bullet.radius, 4.4);
        const speed = Math.hypot(vx, vy) || 1;
        const headX = x + (vx / speed) * (LASER_LENGTH / 2);
        const headY = y + (vy / speed) * (LASER_LENGTH / 2);
        const authorityPath = normalizeSegments(bullet.path_segments || bullet.pathSegments);
        const normalizedSegments = normalizeSegments(bullet.segments);
        const pathSegments = authorityPath.length
          ? authorityPath
          : normalizedSegments.length
            ? normalizedSegments
            : buildReverseReflectedSegments(headX, headY, vx, vy, LASER_LENGTH, walls || []);
        const visual = buildLaserVisualSegments(
          pathSegments,
          numberValue(bullet.distance_travelled ?? bullet.distanceTravelled),
          numberValue(bullet.age),
          numberValue(bullet.life, 0.375),
        );
        if (!visual.wakeSegments.length || visual.alpha <= 0.01) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ARENA_X, ARENA_Y, ARENA_WIDTH, ARENA_HEIGHT);
        ctx.clip();
        ctx.globalAlpha = visual.alpha;
        strokeLaserPath(visual.wakeSegments, hexToRgba(p.base, 0.18), 5.2, 14, p.glow);
        strokeLaserPath(visual.headSegments.length ? visual.headSegments : visual.wakeSegments, p.bright, Math.max(1.6, radius * 0.42), 6, p.glow);
        strokeLaserPath(visual.headSegments.length ? visual.headSegments : visual.wakeSegments, "rgba(248, 250, 252, 0.72)", 0.55);
        ctx.restore();
      }

      function drawLaserAimSegments(segments, color) {
        if (!segments.length) return;
        const p = getPlayerPalette(color);
        const pulse = 0.38 + Math.sin(renderTime * 6) * 0.12;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ARENA_X, ARENA_Y, ARENA_WIDTH, ARENA_HEIGHT);
        ctx.clip();
        ctx.lineCap = "round";
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = hexToRgba(p.bright, pulse * 0.62);
        ctx.shadowColor = p.glow;
        ctx.shadowBlur = 12;
        for (const segment of segments) {
          ctx.beginPath();
          ctx.moveTo(segment.x1, segment.y1);
          ctx.lineTo(segment.x2, segment.y2);
          ctx.stroke();
          const length = distance(segment.x1, segment.y1, segment.x2, segment.y2);
          const steps = Math.max(2, Math.floor(length / 28));
          const dx = (segment.x2 - segment.x1) / length || 0;
          const dy = (segment.y2 - segment.y1) / length || 0;
          const drift = (renderTime * 35) % 28;
          for (let step = 0; step <= steps; step += 1) {
            const travel = clamp(step * 28 + drift, 0, length);
            const x = segment.x1 + dx * travel;
            const y = segment.y1 + dy * travel;
            const nodePulse = 0.55 + 0.45 * Math.sin(renderTime * 9 + step * 1.7);
            ctx.beginPath();
            ctx.arc(x, y, 1.9 + nodePulse * 0.9, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(p.bright, 0.42);
            ctx.fill();
            if (step % 2 === 0) {
              ctx.beginPath();
              ctx.moveTo(x - dx * 4, y - dy * 4);
              ctx.lineTo(x + dx * 8, y + dy * 8);
              ctx.lineWidth = 2.2;
              ctx.strokeStyle = hexToRgba(p.bright, 0.22);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      function drawLaserAims(players, walls) {
        for (const player of players || []) {
          if (!player.alive || String(player.weapon || "default") !== "laser") continue;
          const angle = numberValue(player.angle);
          const spawn = safeFireSpawnPoint(player, walls || [], LASER_RADIUS);
          drawLaserAimSegments(
            buildReflectedRaySegments(
              spawn.x,
              spawn.y,
              angle,
              LASER_AIM_LENGTH,
              walls || [],
              12,
              activeShieldColliders(players),
            ),
            player.color || "green",
          );
        }
      }

      function drawTankShield(tank) {
        const visibleMs = Math.max(0, numberValue(tank.shield_visible_ms || tank.shieldVisibleMs));
        if (visibleMs <= 0) return;
        const activeMs = Math.max(0, numberValue(tank.shield_active_ms || tank.shieldActiveMs));
        const radius = Math.max(PLAYER_RADIUS + 10, numberValue(tank.shield_radius || tank.shieldRadius, SHIELD_RADIUS));
        const p = getPlayerPalette(tank.color);
        const darkMode = spectatorTheme === "dark";
        const elapsed = Math.max(0, numberValue(tank.shield_elapsed_ms || tank.shieldElapsedMs)) / 1000 + renderTime;
        const flicker = activeMs <= 0 ? 0.46 + 0.54 * Math.max(0, Math.sin(elapsed * 26)) : 1;
        const fade = activeMs > 0 ? 1 : clamp(visibleMs / SHIELD_FLICKER_MS, 0, 1);
        const alpha = clamp(fade * flicker, 0, 1);
        if (alpha <= 0.02) return;

        ctx.save();
        ctx.translate(numberValue(tank.x), numberValue(tank.y));
        ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
        ctx.shadowColor = p.glow;
        ctx.shadowBlur = 18 * alpha;
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
        gradient.addColorStop(0, hexToRgba(p.bright, (darkMode ? 0.07 : 0.05) * alpha));
        gradient.addColorStop(0.62, hexToRgba(p.base, (darkMode ? 0.16 : 0.11) * alpha));
        gradient.addColorStop(1, hexToRgba(p.bright, (darkMode ? 0.34 : 0.24) * alpha));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = hexToRgba(p.bright, (darkMode ? 0.72 : 0.52) * alpha);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        for (let index = 0; index < 3; index += 1) {
          const progress = (elapsed * 0.72 + index / 3) % 1;
          ctx.beginPath();
          ctx.arc(0, 0, radius * (0.28 + progress * 0.72), 0, Math.PI * 2);
          ctx.lineWidth = 1.1 + (1 - progress) * 1.4;
          ctx.strokeStyle = hexToRgba(p.bright, (0.36 - progress * 0.28) * alpha);
          ctx.stroke();
        }
        ctx.setLineDash([7, 10]);
        ctx.lineDashOffset = -elapsed * 36;
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = hexToRgba(darkMode ? "#e0f2fe" : "#1d4ed8", (darkMode ? 0.46 : 0.34) * alpha);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.86, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      function drawBulletFades() {
        for (const fade of bulletFades) {
          if (String(fade.projectile_type || fade.projectileType || "bullet") === "laser") continue;
          const progress = fade.life / fade.maxLife;
          drawBulletSprite(fade, fade.color || "green", progress, (1 - progress) * 1.6);
        }
      }

      function drawBulletSmokeEffects() {
        const darkMode = spectatorTheme === "dark";
        for (const smoke of bulletSmokeEffects) {
          const progress = clamp(1 - smoke.life / smoke.maxLife, 0, 1);
          const alpha = (1 - smoothStep(progress)) * (darkMode ? 0.88 : 0.78);
          ctx.save();
          ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
          for (const puff of smoke.puffs) {
            const x = smoke.x + puff.offsetX + puff.driftX * progress;
            const y = smoke.y + puff.offsetY + puff.driftY * progress;
            const radius = puff.radius * (1 + progress * 1.85);
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(
              0,
              darkMode
                ? `rgba(226, 232, 240, ${puff.alpha * alpha})`
                : `rgba(100, 116, 139, ${puff.alpha * alpha * 0.9})`,
            );
            gradient.addColorStop(
              0.52,
              darkMode
                ? `rgba(148, 163, 184, ${puff.alpha * alpha * 0.45})`
                : `rgba(148, 163, 184, ${puff.alpha * alpha * 0.38})`,
            );
            gradient.addColorStop(1, "rgba(148, 163, 184, 0)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      function drawShellCasings() {
        const darkMode = spectatorTheme === "dark";
        for (const shell of shellCasings) {
          const alpha = clamp(shell.life / shell.maxLife, 0, 1);
          const isMinigun = shell.kind === "minigun";
          ctx.save();
          ctx.translate(shell.x, shell.y);
          ctx.rotate(shell.angle);
          ctx.globalAlpha = alpha;
          ctx.shadowColor = isMinigun
            ? darkMode
              ? "rgba(226, 232, 240, 0.3)"
              : "rgba(71, 85, 105, 0.18)"
            : darkMode
              ? "rgba(251, 191, 36, 0.36)"
              : "rgba(146, 64, 14, 0.22)";
          ctx.shadowBlur = (isMinigun ? 3.5 : 5) * alpha;
          const width = isMinigun ? 6.8 : 10.4;
          const height = isMinigun ? 2.7 : 4.4;
          const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
          if (isMinigun) {
            gradient.addColorStop(0, darkMode ? "#f8fafc" : "#dbeafe");
            gradient.addColorStop(0.48, darkMode ? "#94a3b8" : "#94a3b8");
            gradient.addColorStop(1, darkMode ? "#334155" : "#475569");
          } else {
            gradient.addColorStop(0, "#fde68a");
            gradient.addColorStop(0.52, "#d97706");
            gradient.addColorStop(1, "#92400e");
          }
          ctx.fillStyle = gradient;
          roundedRect(ctx, -width / 2, -height / 2, width, height, height / 2);
          ctx.fill();
          ctx.strokeStyle = isMinigun
            ? darkMode
              ? "rgba(226, 232, 240, 0.28)"
              : "rgba(15, 23, 42, 0.16)"
            : darkMode
              ? "rgba(254, 243, 199, 0.48)"
              : "rgba(69, 26, 3, 0.24)";
          ctx.lineWidth = isMinigun ? 0.65 : 0.8;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(width * 0.18, -height * 0.38);
          ctx.lineTo(width * 0.18, height * 0.38);
          ctx.strokeStyle = isMinigun
            ? darkMode
              ? "rgba(248, 250, 252, 0.36)"
              : "rgba(15, 23, 42, 0.18)"
            : darkMode
              ? "rgba(254, 243, 199, 0.48)"
              : "rgba(69, 26, 3, 0.24)";
          ctx.stroke();
          ctx.restore();
        }
      }

      function drawTank(tank) {
        if (!tank.alive) return;
        drawTankShield(tank);
        const tankPalette = getPlayerPalette(tank.color);
        const darkMode = spectatorTheme === "dark";
        const radius = numberValue(tank.radius, 20);
        const flash = numberValue(tank.flash);
        const wallTime = renderTime;
        const tankPulse = 0.56 + 0.44 * Math.sin(wallTime * 3.2 + numberValue(tank.x) * 0.014 + numberValue(tank.y) * 0.011);
        const tankShellTop = darkMode ? "rgba(8, 18, 34, 0.98)" : "rgba(250, 253, 255, 0.99)";
        const tankShellBottom = darkMode ? "rgba(17, 47, 80, 0.98)" : "rgba(204, 229, 255, 0.98)";
        const tankSideFill = darkMode ? "rgba(12, 27, 49, 0.96)" : "rgba(224, 238, 255, 0.96)";
        const tankFrameStroke = darkMode ? "rgba(186, 230, 253, 0.34)" : "rgba(37, 99, 235, 0.28)";
        const tankPanelStroke = darkMode ? "rgba(103, 232, 249, 0.34)" : "rgba(14, 165, 233, 0.26)";
        const tankGlassTop = darkMode ? "rgba(224, 242, 254, 0.92)" : "rgba(255, 255, 255, 0.98)";
        const tankGlassBottom = darkMode ? "rgba(56, 189, 248, 0.26)" : "rgba(147, 197, 253, 0.54)";
        const tankCircuit = hexToRgba(tankPalette.bright, darkMode ? 0.48 : 0.4);
        const tankCoreGlow = hexToRgba(tankPalette.base, darkMode ? 0.72 : 0.58);
        const tankScan = hexToRgba(tankPalette.bright, darkMode ? 0.28 : 0.22);
        const tankShadow = darkMode ? "rgba(8, 15, 29, 0.42)" : "rgba(37, 99, 235, 0.14)";
        const tankScanOffset = ((wallTime * 42 + numberValue(tank.x) * 0.2 + numberValue(tank.y) * 0.13) % 42) - 21;
        const tankNoseGlow = hexToRgba(tankPalette.bright, darkMode ? 0.8 : 0.62);
        const tankRearGlow = hexToRgba(tankPalette.base, darkMode ? 0.84 : 0.64);
        const weapon = String(tank.weapon || "default");
        const reloadMs = Math.max(0, numberValue(tank.weapon_reload_ms || tank.weaponReloadMs));
        const shotgunPump = weapon === "shotgun" ? shotgunPumpProgress(reloadMs) : 0;
        const laserCharge = weapon === "laser" ? 0.55 + Math.sin(wallTime * 8) * 0.18 : 0;
        const minigunSpin = weapon === "minigun" ? wallTime * 26 : 0;
        const doubleBarrelAmmo = Math.max(0, numberValue(tank.double_barrel_ammo || tank.doubleBarrelAmmo));
        const doubleBarrelRecoil = weapon === "double_barrel" ? doubleBarrelRecoilProgress(reloadMs) : 0;
        const doubleBarrelRecoilOffset = doubleBarrelLastShotOffset(doubleBarrelAmmo);

        ctx.save();
        ctx.translate(numberValue(tank.x), numberValue(tank.y));
        ctx.rotate(numberValue(tank.angle) + Math.PI / 2);

        ctx.save();
        ctx.shadowColor = tankPalette.glow;
        ctx.shadowBlur = 18;
        ctx.fillStyle = hexToRgba(tankPalette.base, darkMode ? 0.18 : 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 9 + tankPulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = tankSideFill;
        ctx.shadowColor = tankShadow;
        ctx.shadowBlur = 10;
        roundedRect(ctx, -19, -16, 7, 32, 4);
        ctx.fill();
        roundedRect(ctx, 12, -16, 7, 32, 4);
        ctx.fill();
        ctx.restore();

        ctx.save();
        const barrelGradient = ctx.createLinearGradient(0, -31, 0, -3);
        barrelGradient.addColorStop(0, tankShellTop);
        barrelGradient.addColorStop(1, tankShellBottom);
        const barrelWidth = weapon === "shotgun" ? 16.8 : weapon === "laser" ? 18 : weapon === "minigun" ? 19.5 : weapon === "double_barrel" ? 7.8 : 10.4;
        const barrelLength = weapon === "shotgun" ? 27 - shotgunPump * 5.6 : weapon === "laser" ? 24 : weapon === "minigun" ? 33 : weapon === "double_barrel" ? 34 : 35;
        const barrelY = weapon === "shotgun" ? -31 + shotgunPump * 8.5 : weapon === "laser" ? -31 : weapon === "minigun" ? -36 : weapon === "double_barrel" ? -37 : -38;
        const drawSingleBarrel = (centerX, recoil, muzzleRadius, width = barrelWidth) => {
          const currentY = barrelY + recoil;
          roundedRect(ctx, centerX - width / 2, currentY, width, barrelLength, weapon === "shotgun" ? 7.2 : weapon === "laser" ? 9 : weapon === "minigun" ? 8.5 : 4.2);
          ctx.fillStyle = barrelGradient;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = tankFrameStroke;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(centerX, currentY + 4);
          ctx.lineTo(centerX * 0.38, -8);
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = tankCircuit;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(centerX, currentY + (weapon === "shotgun" ? 1.5 : weapon === "laser" ? 3 : weapon === "minigun" ? 2.4 : 1), muzzleRadius, 0, Math.PI * 2);
          ctx.fillStyle = tankCoreGlow;
          ctx.fill();
        };
        if (weapon === "double_barrel") {
          for (const offset of [-DOUBLE_BARREL_BARREL_OFFSET, DOUBLE_BARREL_BARREL_OFFSET]) {
            const recoil = Math.abs(offset - doubleBarrelRecoilOffset) < 0.1 ? doubleBarrelRecoil * 7.2 : 0;
            drawSingleBarrel(offset, recoil, 4.1, 7.8);
          }
        } else {
          drawSingleBarrel(0, 0, weapon === "shotgun" ? 7.4 : weapon === "laser" ? 9.2 : weapon === "minigun" ? 8.8 : 5.2);
        }
        if (weapon === "shotgun") {
          const pumpY = -9.5 + shotgunPump * 6.2;
          ctx.save();
          ctx.shadowColor = tankPalette.glow;
          ctx.shadowBlur = 8 * shotgunPump;
          roundedRect(ctx, -13.8, pumpY, 27.6, 7.2, 3.6);
          ctx.fillStyle = darkMode ? "rgba(15, 23, 42, 0.86)" : "rgba(191, 219, 254, 0.82)";
          ctx.fill();
          ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.54 : 0.38);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-9, pumpY + 3.6);
          ctx.lineTo(9, pumpY + 3.6);
          ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.42 : 0.28);
          ctx.stroke();
          ctx.restore();
          ctx.beginPath();
          ctx.arc(-3.8, barrelY + 1.6, 2.2, 0, Math.PI * 2);
          ctx.arc(3.8, barrelY + 1.6, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = darkMode ? "rgba(2, 6, 23, 0.82)" : "rgba(15, 23, 42, 0.46)";
          ctx.fill();
          ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.44 : 0.3);
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else if (weapon === "laser") {
          ctx.save();
          ctx.shadowColor = tankPalette.glow;
          ctx.shadowBlur = 15;
          ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.7 : 0.52);
          ctx.lineWidth = 1.7;
          for (let index = 0; index < 3; index += 1) {
            const ringRadius = 5.2 + index * 3.2 + laserCharge * 1.1;
            ctx.beginPath();
            ctx.arc(0, barrelY + 3, ringRadius, -Math.PI * 0.74, Math.PI * 0.74);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(0, barrelY - 7.5);
          ctx.lineTo(-5.8, barrelY + 4.5);
          ctx.lineTo(5.8, barrelY + 4.5);
          ctx.closePath();
          ctx.fillStyle = hexToRgba(tankPalette.bright, darkMode ? 0.72 : 0.5);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.44 : 0.32);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        } else if (weapon === "minigun") {
          ctx.save();
          ctx.shadowColor = tankPalette.glow;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.48 : 0.34);
          ctx.lineWidth = 2;
          for (let index = 0; index < 6; index += 1) {
            const angle = minigunSpin + (index / 6) * Math.PI * 2;
            const offset = Math.sin(angle) * 4.7;
            ctx.beginPath();
            ctx.moveTo(offset, barrelY + 3);
            ctx.lineTo(offset * 0.42, -8);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(0, barrelY + 2.4, 6.2 + Math.sin(minigunSpin) * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = darkMode ? "rgba(2, 6, 23, 0.78)" : "rgba(15, 23, 42, 0.38)";
          ctx.fill();
          ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.52 : 0.36);
          ctx.lineWidth = 1.1;
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.moveTo(-8.5, -23);
        ctx.lineTo(-11.5, -10);
        ctx.lineTo(-8, 1);
        ctx.lineTo(8, 1);
        ctx.lineTo(11.5, -10);
        ctx.lineTo(8.5, -23);
        ctx.closePath();
        ctx.fillStyle = barrelGradient;
        ctx.shadowColor = tankNoseGlow;
        ctx.shadowBlur = 7;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.4 : 0.32);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(-9, -7.5);
        ctx.lineTo(9, -7.5);
        ctx.closePath();
        const noseGradient = ctx.createLinearGradient(0, -20, 0, -7.5);
        noseGradient.addColorStop(0, tankGlassTop);
        noseGradient.addColorStop(1, tankGlassBottom);
        ctx.fillStyle = noseGradient;
        ctx.shadowColor = tankNoseGlow;
        ctx.shadowBlur = 9;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.44 : 0.34);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        const hullGradient = ctx.createLinearGradient(0, -18, 0, 18);
        hullGradient.addColorStop(0, tankShellTop);
        hullGradient.addColorStop(1, tankShellBottom);
        roundedRect(ctx, -16, -18, 32, 36, 11);
        ctx.fillStyle = hullGradient;
        ctx.shadowColor = tankShadow;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = tankFrameStroke;
        ctx.stroke();

        ctx.save();
        roundedRect(ctx, -16, -18, 32, 36, 11);
        ctx.clip();
        const scanGradient = ctx.createLinearGradient(tankScanOffset, 0, tankScanOffset + 18, 0);
        scanGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        scanGradient.addColorStop(0.5, tankScan);
        scanGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = scanGradient;
        ctx.fillRect(-18 + tankScanOffset, -20, 18, 40);
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(10, -2);
        ctx.moveTo(-8, 7);
        ctx.lineTo(8, 7);
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = tankPanelStroke;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-6, -6.5);
        ctx.lineTo(0, -14.5);
        ctx.lineTo(6, -6.5);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.52 : 0.38);
        ctx.stroke();

        ctx.beginPath();
        ctx.setLineDash([7, 5]);
        ctx.moveTo(-11, 12);
        ctx.lineTo(11, 12);
        ctx.lineWidth = 0.95;
        ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.22 : 0.2);
        ctx.stroke();
        ctx.setLineDash([]);

        const canopyGradient = ctx.createLinearGradient(0, -12, 0, 6);
        canopyGradient.addColorStop(0, tankGlassTop);
        canopyGradient.addColorStop(1, tankGlassBottom);
        roundedRect(ctx, -9.5, -11.5, 19, 17, 7);
        ctx.fillStyle = canopyGradient;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.36 : 0.3);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-8, 9.5);
        ctx.lineTo(8, 9.5);
        ctx.moveTo(-9, 14.8);
        ctx.lineTo(9, 14.8);
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.24 : 0.2);
        ctx.stroke();

        ctx.save();
        roundedRect(ctx, -11, 8.8, 22, 10.5, 4.8);
        ctx.fillStyle = darkMode ? "rgba(6, 12, 24, 0.78)" : "rgba(219, 234, 254, 0.82)";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(tankPalette.base, darkMode ? 0.26 : 0.18);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = tankRearGlow;
        ctx.shadowColor = tankPalette.glow;
        ctx.shadowBlur = 12;
        for (const exhaustX of [-5, 5]) {
          ctx.beginPath();
          ctx.arc(exhaustX, 13.5, 3.1 + tankPulse * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        for (const nodeX of [-10.5, 0, 10.5]) {
          ctx.moveTo(nodeX, -15);
          ctx.arc(nodeX, -15, 1.7 + tankPulse * 0.4, 0, Math.PI * 2);
        }
        ctx.fillStyle = tankPalette.bright;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();

        if (flash > 0) {
          ctx.fillStyle = tankPalette.flash.replace(/, ([0-9.]+)\)$/, `, ${clamp(flash * 5.8, 0, 0.95)})`);
          ctx.beginPath();
          ctx.arc(0, -(radius + 18), 8 + flash * 24, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      function updateSidebar() {
        if (!latest) return;
        const activeCount = activePlayerCountFor(latest);
        subtitle.textContent = activeCount
          ? `${activeCount} player${activeCount > 1 ? "s" : ""} online`
          : "No players online";
        mapMeta.textContent = `Map ${latest.map_id}`;
        runtimeMeta.textContent = `Snapshot ${latest.snapshot_seq}`;
        const voteText = latest.countdown_active
          ? `Changing map in ${latest.countdown_seconds}s`
          : `Votes ${latest.vote_count}/${latest.vote_required}`;
        voteMeta.textContent = voteText;
        scoreList.innerHTML = "";
        const rows = [...latest.active_players].slice(0, 10);
        if (!rows.length) {
          const emptyRow = document.createElement("div");
          emptyRow.className = "score-empty";
          emptyRow.textContent = "Scoreboard is empty.";
          scoreList.appendChild(emptyRow);
          return;
        }
        rows.forEach((row, index) => {
          const p = getPlayerPalette(row.color);
          const item = document.createElement("div");
          item.className = "score-row";
          item.style.setProperty("--player-color", p.base);
          const rankNumber = index + 1;
          const rankIcon = SCOREBOARD_RANK_ICON_SOURCES[rankNumber];
          item.innerHTML = `
            <div class="rank">${
              rankIcon
                ? `<img class="rank-medal" src="${rankIcon}" alt="Rank ${rankNumber}" loading="lazy">`
                : `#${rankNumber}`
            }</div>
            <div class="player">
              <span class="color"></span>
              <span class="latency ${latencyClassName(row.latency_ms)}"></span>
              <span class="name"></span>
              <span class="country"></span>
            </div>
            <div class="score">${Number(row.score || 0)}</div>
          `;
          item.querySelector(".name").textContent = String(row.player_id || "Player");
          item.querySelector(".country").textContent = String(row.country_code || "--").slice(0, 8);
          item.querySelector(".latency").textContent = formatLatencyLabel(row.latency_ms);
          scoreList.appendChild(item);
        });
      }

      function render(frameAt) {
        const delta = Math.min(0.034, Math.max(0.001, (frameAt - lastFrameAt) / 1000));
        lastFrameAt = frameAt;
        renderTime += delta;
        syncCanvasSize();

        const state = getRenderState();
        const stale = lastOkAt && Date.now() - lastOkAt > STALE_AFTER_MS;
        const players = (state.players || []).length ? state.players || [] : latest?.players || [];
        const walls = state.walls || [];
        const activePlayerCount = Math.max(activePlayerCountFor(state), activePlayerCountFor(latest));
        if (!activePlayerCount && !(state.bullets || []).length && !(latest?.bullets || []).length && renderBullets.size) {
          renderBullets.clear();
          bulletFades.length = 0;
        }
        syncRenderBulletsForSnapshot(state);
        syncEventEffects(state);
        advanceEffectsAndBullets(walls, delta, players);

        const staticScene = ensureStaticScene(state);
        ctx.drawImage(staticScene, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        drawTargets(state.targets || []);
        drawPowerups(state.powerups || []);
        drawLaserAims(players, walls);
        drawWalls(walls);
        drawWallRipples();
        for (const bullet of renderBullets.values()) drawBullet(bullet);
        drawBulletFades();
        drawBulletSmokeEffects();
        drawTankExplosions();
        drawPowerupEffects();
        drawKillFeed();
        drawShellCasings();
        for (const player of players) drawTank(player);

        empty.hidden = activePlayerCount > 0;
        statusDot.classList.toggle("warn", Boolean(stale || lastError));
        statusText.textContent = lastError
          ? `Disconnected: ${lastError}`
          : stale
            ? "Waiting for fresh state"
            : latest
              ? "Live"
              : "Connecting";

        window.requestAnimationFrame(render);
      }

      window.addEventListener("beforeunload", () => {
        destroyed = true;
      });
      pollState();
      window.requestAnimationFrame(render);
    </script>
  </body>
</html>"""


def simulate_match(
    room_state: dict[str, object],
    payload: dict[str, object],
    current_ms: int,
) -> dict[str, object]:
    room = normalize_room_name(payload.get("room"))
    player_id = normalize_player_id(payload.get("player_id"))
    country_code = normalize_country_code(payload.get("country_code"))
    preferred_color = normalize_optional_color(payload.get("preferred_color"))
    input_seq = max(0, int(payload.get("input_seq") or 0))
    client_map_seed = int(payload.get("map_seed") or 0)
    latency_ms = normalize_latency_ms(payload.get("latency_ms"))
    input_state = normalize_match_input(payload.get("input"))
    local_player_state = normalize_match_local_player(payload.get("local_player"))
    server_map_seed = int(room_state.get("map_seed") or 1)
    client_map_matches = client_map_seed <= 0 or client_map_seed == server_map_seed

    update_player(room_state, player_id, country_code, current_ms)
    player_meta = ensure_match_player(room_state, player_id, current_ms, preferred_color=preferred_color)
    player_meta["latency_ms"] = latency_ms
    player_meta["input"] = input_state if client_map_matches else normalize_match_input({})
    player_meta["last_ack_input_seq"] = max(int(player_meta.get("last_ack_input_seq") or 0), input_seq)
    if not bool(player_meta.get("alive", True)) and int(player_meta.get("respawn_at_ms") or 0) <= current_ms:
        player_meta = spawn_match_player(room_state, player_id, current_ms, preserve_stats=True)

    walls = build_training_walls(server_map_seed)
    room_state["targets"] = []
    players = get_active_players(room_state)
    raw_bullets = room_state.get("bullets")
    bullets = raw_bullets if isinstance(raw_bullets, list) else []
    prune_death_events(room_state, current_ms)
    prune_powerup_effects(room_state, current_ms)
    advance_powerups(room_state, current_ms, walls, players)
    if client_map_matches:
        apply_reported_match_player_state(player_meta, local_player_state, walls)
    last_tick_ms = int(room_state.get("last_tick_ms") or current_ms)
    elapsed_sec = max(0.0, min(0.2, (current_ms - last_tick_ms) / 1000.0))
    remaining = elapsed_sec
    simulated_ms = last_tick_ms

    while remaining > 0:
        step = min(0.016, remaining)
        remaining -= step
        simulated_ms += int(step * 1000)

        for current_player in players.values():
            current_player["flash"] = max(0.0, float(current_player.get("flash") or 0.0) - step)
            if int(current_player.get("shield_visible_until_ms") or 0) <= simulated_ms:
                current_player["shield_started_at_ms"] = 0
                current_player["shield_until_ms"] = 0
                current_player["shield_visible_until_ms"] = 0
            if not bool(current_player.get("alive", True)):
                respawn_at_ms = int(current_player.get("respawn_at_ms") or 0)
                if respawn_at_ms > 0 and simulated_ms >= respawn_at_ms:
                    spawn_match_player(room_state, str(current_player.get("player_id") or ""), simulated_ms, preserve_stats=True)
                continue

            current_player["cooldown"] = max(0.0, float(current_player.get("cooldown") or 0.0) - step)
            if str(current_player.get("weapon") or "default") != "minigun":
                current_player["minigun_spinup"] = 0.0
                current_player["minigun_idle"] = 0.0
                current_player["minigun_shot_accum"] = 0.0

        handle_powerup_pickups(room_state, simulated_ms, players)

        for current_player in players.values():
            if not bool(current_player.get("alive", True)):
                continue

            current_input = normalize_match_input(current_player.get("input"))
            active_bullet_count = 0
            for bullet in bullets:
                if (
                    isinstance(bullet, dict)
                    and str(bullet.get("owner_id") or "") == str(current_player.get("player_id") or "")
                    and str(bullet.get("projectile_type") or "bullet") != "shotgun"
                    and str(bullet.get("projectile_type") or "bullet") != "laser"
                    and str(bullet.get("projectile_type") or "bullet") != "minigun"
                    and str(bullet.get("projectile_type") or "bullet") != "double_barrel"
                ):
                    active_bullet_count += 1

            requested_fire_seq = int(current_input["fire_seq"])
            last_fire_seq = int(current_player.get("last_fire_seq") or 0)
            if requested_fire_seq <= last_fire_seq:
                requested_fire_seq = 0
            else:
                current_player["last_fire_seq"] = requested_fire_seq

            if str(current_player.get("weapon") or "default") == "minigun":
                if bool(current_input.get("fire_held")) and int(current_player.get("minigun_ammo") or 0) > 0:
                    current_player["minigun_idle"] = 0.0
                    current_player["minigun_spinup"] = min(
                        MINIGUN_SPINUP_SECONDS,
                        float(current_player.get("minigun_spinup") or 0.0) + step,
                    )
                    if float(current_player.get("minigun_spinup") or 0.0) >= MINIGUN_SPINUP_SECONDS:
                        current_player["minigun_shot_accum"] = float(current_player.get("minigun_shot_accum") or 0.0) + step * MINIGUN_FIRE_RATE
                        while (
                            current_player["minigun_shot_accum"] >= 1.0
                            and int(current_player.get("minigun_ammo") or 0) > 0
                        ):
                            bullets.append(spawn_minigun_bullet(room_state, current_player))
                            current_player["minigun_ammo"] = max(0, int(current_player.get("minigun_ammo") or 0) - 1)
                            current_player["minigun_shot_accum"] = float(current_player.get("minigun_shot_accum") or 0.0) - 1.0
                            current_player["flash"] = 0.1
                            current_player["shots"] = int(current_player.get("shots") or 0) + 1
                        if int(current_player.get("minigun_ammo") or 0) <= 0:
                            current_player["weapon"] = "default"
                            current_player["minigun_spinup"] = 0.0
                            current_player["minigun_idle"] = 0.0
                            current_player["minigun_shot_accum"] = 0.0
                else:
                    current_player["minigun_idle"] = float(current_player.get("minigun_idle") or 0.0) + step
                    current_player["minigun_shot_accum"] = 0.0
                    if float(current_player.get("minigun_idle") or 0.0) >= MINIGUN_GRACE_SECONDS:
                        current_player["minigun_spinup"] = 0.0
                requested_fire_seq = 0

            if (
                requested_fire_seq > 0
                and float(current_player.get("cooldown") or 0.0) <= 0.0
            ):
                if str(current_player.get("weapon") or "default") == "laser":
                    bullets.append(spawn_laser_bullet(room_state, current_player, simulated_ms))
                    current_player["weapon"] = "default"
                    current_player["shotgun_ammo"] = 0
                    current_player["minigun_ammo"] = 0
                    current_player["double_barrel_ammo"] = 0
                    current_player["cooldown"] = LASER_COOLDOWN
                elif str(current_player.get("weapon") or "default") == "shotgun" and int(current_player.get("shotgun_ammo") or 0) > 0:
                    bullets.extend(spawn_shotgun_pellets(room_state, current_player, simulated_ms))
                    current_player["shotgun_ammo"] = max(0, int(current_player.get("shotgun_ammo") or 0) - 1)
                    if int(current_player.get("shotgun_ammo") or 0) <= 0:
                        current_player["weapon"] = "default"
                    current_player["cooldown"] = SHOTGUN_COOLDOWN
                elif str(current_player.get("weapon") or "default") == "double_barrel" and int(current_player.get("double_barrel_ammo") or 0) > 0:
                    bullets.append(spawn_double_barrel_bullet(room_state, current_player))
                    current_player["double_barrel_ammo"] = max(0, int(current_player.get("double_barrel_ammo") or 0) - 1)
                    if int(current_player.get("double_barrel_ammo") or 0) <= 0:
                        current_player["weapon"] = "default"
                    current_player["cooldown"] = DOUBLE_BARREL_COOLDOWN
                elif active_bullet_count < MAX_BULLETS:
                    bullets.append(spawn_match_bullet(room_state, current_player, float(current_player.get("angle") or 0.0)))
                    current_player["cooldown"] = SHOOT_COOLDOWN
                else:
                    continue
                current_player["flash"] = 0.13
                current_player["shots"] = int(current_player.get("shots") or 0) + 1

        next_bullets: list[dict[str, object]] = []
        for bullet in bullets:
            if not isinstance(bullet, dict):
                continue

            previous_x = float(bullet.get("x") or 0.0)
            previous_y = float(bullet.get("y") or 0.0)
            projectile_type = str(bullet.get("projectile_type") or "bullet")
            next_bullet = {
                "id": int(bullet.get("id") or 0),
                "owner_id": str(bullet.get("owner_id") or ""),
                "owner_revision": int(bullet.get("owner_revision") or 0),
                "color": normalize_color(bullet.get("color")),
                "projectile_type": projectile_type,
                "x": previous_x + float(bullet.get("vx") or 0.0) * step,
                "y": previous_y + float(bullet.get("vy") or 0.0) * step,
                "radius": float(bullet.get("radius") or BULLET_RADIUS),
                "vx": float(bullet.get("vx") or 0.0),
                "vy": float(bullet.get("vy") or 0.0),
                "life": float(bullet.get("life") or 0.0) - step,
                "bouncesLeft": int(bullet.get("bouncesLeft") or 0),
                "age": float(bullet.get("age") or 0.0) + step,
                "has_bounced": bool(bullet.get("has_bounced", False)),
                "owner_shield_released": bool(bullet.get("owner_shield_released", False)),
            }
            shield_reflected = False
            if projectile_type == "laser":
                path_segments = [
                    segment
                    for segment in bullet.get("path_segments", [])
                    if isinstance(segment, dict)
                ]
                path_length = sum(
                    distance(
                        float(segment.get("x1") or 0.0),
                        float(segment.get("y1") or 0.0),
                        float(segment.get("x2") or 0.0),
                        float(segment.get("y2") or 0.0),
                    )
                    for segment in path_segments
                )
                max_distance_travelled = max(0.0, path_length - LASER_LENGTH)
                distance_travelled = clamp(
                    float(bullet.get("distance_travelled") or 0.0) + LASER_SPEED * step,
                    0.0,
                    max_distance_travelled,
                )
                next_bullet["path_segments"] = path_segments
                next_bullet["distance_travelled"] = distance_travelled
                next_bullet["segments"] = slice_path_segments(path_segments, distance_travelled, LASER_LENGTH)
                if next_bullet["segments"]:
                    head = next_bullet["segments"][-1]
                    next_bullet["x"] = float(head.get("x2") or next_bullet["x"])
                    next_bullet["y"] = float(head.get("y2") or next_bullet["y"])

            if projectile_type != "laser":
                shield_reflected = reflect_bullet_from_shields(next_bullet, previous_x, previous_y, players, simulated_ms)
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
                    next_bullet["has_bounced"] = True
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

            next_bullet["_previous_x"] = previous_x
            next_bullet["_previous_y"] = previous_y
            next_bullet["_previous_segments"] = [
                segment
                for segment in bullet.get("segments", [])
                if isinstance(segment, dict)
            ]
            hit_player_id: str | None = None
            if not shield_reflected:
                for candidate_id, candidate_meta in players.items():
                    if not bool(candidate_meta.get("alive", True)):
                        continue
                    if player_has_visible_shield(candidate_meta, simulated_ms):
                        continue
                    is_owner_candidate = candidate_id == str(next_bullet["owner_id"])
                    same_owner_session = int(candidate_meta.get("revision") or 0) == int(next_bullet.get("owner_revision") or 0)
                    if is_owner_candidate and not same_owner_session:
                        continue
                    if (
                        is_owner_candidate
                        and projectile_type != "laser"
                        and not bool(next_bullet.get("has_bounced", False))
                    ):
                        continue
                    if candidate_shield_blocks_bullet(next_bullet, candidate_meta, simulated_ms):
                        continue
                    if (
                        bullet_hit_test(next_bullet, candidate_meta)
                    ):
                        hit_player_id = candidate_id
                        break
            next_bullet.pop("_previous_x", None)
            next_bullet.pop("_previous_y", None)
            next_bullet.pop("_previous_segments", None)

            if hit_player_id is not None:
                victim_meta = players.get(hit_player_id)
                owner_meta = players.get(str(next_bullet["owner_id"]))
                if isinstance(victim_meta, dict):
                    if (
                        isinstance(owner_meta, dict)
                        and hit_player_id != str(next_bullet["owner_id"])
                        and int(owner_meta.get("revision") or 0) == int(next_bullet.get("owner_revision") or 0)
                    ):
                        owner_meta["hits"] = int(owner_meta.get("hits") or 0) + 1
                        owner_meta["score"] = int(owner_meta.get("score") or 0) + 250
                    victim_meta["deaths"] = int(victim_meta.get("deaths") or 0) + 1
                    victim_meta["score"] = max(0, int(victim_meta.get("score") or 0) - 120)
                    victim_meta["alive"] = False
                    victim_meta["respawn_at_ms"] = simulated_ms + int(PLAYER_RESPAWN_SECONDS * 1000)
                    victim_meta["cooldown"] = 0.0
                    victim_meta["flash"] = 0.18
                    reset_player_weapon_state(victim_meta)
                    push_death_event(
                        room_state,
                        victim_meta,
                        simulated_ms,
                        killer_meta=owner_meta if isinstance(owner_meta, dict) else None,
                        weapon=str(next_bullet.get("projectile_type") or "bullet"),
                        bullet_id=int(next_bullet.get("id") or 0),
                    )
                continue

            next_bullets.append(next_bullet)

        bullets = next_bullets
        room_state["bullets"] = bullets
    room_state["bullets"] = bullets
    room_state["targets"] = []
    advance_powerups(room_state, current_ms, walls, players)
    handle_powerup_pickups(room_state, current_ms, players)
    room_state["last_tick_ms"] = current_ms
    room_state["snapshot_seq"] = int(room_state.get("snapshot_seq") or 0) + 1
    room_state["updated_at_ms"] = current_ms
    return build_match_state(room_state, room, player_id, current_ms)


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
    local_player_meta = ensure_match_player(room_state, player_id, current_ms, preferred_color=local_color)
    local_player_meta["country_code"] = country_code
    local_player_meta["color"] = local_color
    local_player_meta["map_seed"] = map_seed
    local_player_meta["x"] = float(local_player["x"])
    local_player_meta["y"] = float(local_player["y"])
    local_player_meta["angle"] = float(local_player["angle"])
    local_player_meta["radius"] = float(local_player["radius"])
    local_player_meta["flash"] = 0.0
    local_player_meta["alive"] = True
    local_player_meta["latency_ms"] = normalize_latency_ms(payload.get("latency_ms"))
    local_player_meta["input"] = normalize_match_input({})
    room_state["targets"] = [
        {
            "id": int(target["id"]),
            "x": float(target["x"]),
            "y": float(target["y"]),
            "radius": float(target["radius"]),
            "phase": float(target["phase"]),
        }
        for target in targets
    ]
    room_state["bullets"] = [
        {
            "id": int(bullet.get("id") or 0),
            "owner_id": str(test_state.get("player_id") or LATENCY_CLONE_NAME),
            "color": str(test_state.get("color") or "red"),
            "projectile_type": "bullet",
            "x": float(bullet.get("x") or 0.0),
            "y": float(bullet.get("y") or 0.0),
            "radius": float(bullet.get("radius") or BULLET_RADIUS),
            "vx": float(bullet.get("vx") or 0.0),
            "vy": float(bullet.get("vy") or 0.0),
            "life": float(bullet.get("life") or 0.0),
            "bouncesLeft": int(bullet.get("bouncesLeft") or 0),
            "age": float(bullet.get("age") or 0.0),
            "has_bounced": bool(bullet.get("has_bounced", False)),
            "owner_shield_released": True,
        }
        for bullet in test_state.get("bullets", [])
        if isinstance(bullet, dict)
    ]
    room_state["updated_at_ms"] = current_ms
    room_state["snapshot_seq"] = int(room_state.get("snapshot_seq") or 0) + 1

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


def apply_action(state: dict[str, object], payload: dict[str, object], current_ms: int) -> tuple[str, str | None]:
    room = normalize_room_name(payload.get("room"))
    action = str(payload.get("action") or "sync").strip().lower()
    if action == "status":
        refresh_vote_state(state, current_ms)
        return room, None

    player_id = normalize_player_id(payload.get("player_id"))
    country_code = normalize_country_code(payload.get("country_code"))
    preferred_color = normalize_optional_color(payload.get("preferred_color"))

    update_player(state, player_id, country_code, current_ms)

    votes = state.setdefault("votes", {})
    if not isinstance(votes, dict):
        votes = {}
        state["votes"] = votes

    if action == "leave" or action == "match_leave":
        players = state.get("players")
        revisions = state.setdefault("player_revisions", {})
        if not isinstance(revisions, dict):
            revisions = {}
            state["player_revisions"] = revisions
        existing_meta = players.get(player_id) if isinstance(players, dict) else None
        revisions[player_id] = int((existing_meta or {}).get("revision") or revisions.get(player_id) or 0) + 1
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
        revisions = state.setdefault("player_revisions", {})
        if not isinstance(revisions, dict):
            revisions = {}
            state["player_revisions"] = revisions
        existing_meta = players.get(player_id) if isinstance(players, dict) else None
        revisions[player_id] = int((existing_meta or {}).get("revision") or revisions.get(player_id) or 0) + 1
        if isinstance(players, dict):
            players.pop(player_id, None)
        votes.pop(player_id, None)
        latency_tests = ensure_latency_tests(state)
        latency_tests.pop(player_id, None)
        state["targets"] = []
        state["bullets"] = []
        state["countdown_deadline_ms"] = 0
        state["updated_at_ms"] = current_ms
    elif action == "latency_sync":
        state["updated_at_ms"] = current_ms
    elif action == "match_sync":
        if preferred_color:
            ensure_player_color(state, player_id, preferred_color)
        state["updated_at_ms"] = current_ms
    elif action == "sync":
        if preferred_color:
            ensure_player_color(state, player_id, preferred_color)
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
            if action in {"match_sync", "sync", "status"}:
                refresh_vote_state(state, current_ms)
                tick_spectator_world(state, current_ms)
            room, player_id = apply_action(state, payload, current_ms)

            if action == "latency_sync":
                response = simulate_latency_test(state, payload, current_ms)
            elif action == "match_sync":
                response = simulate_match(state, payload, current_ms)
            elif action == "match_leave":
                response = {"ok": True, "message": "match player removed"}
            elif action == "latency_leave":
                response = {"ok": True, "message": "latency test removed"}
            elif action == "status":
                response = build_response(state, room, None, current_ms)
            else:
                response = build_response(state, room, player_id, current_ms)

            handle.seek(0)
            handle.truncate()
            handle.write(json.dumps(state, ensure_ascii=False, separators=(",", ":")))
            handle.flush()
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

SERVER_IDLE_TIMEOUT = 0
_server_last_activity: float = 0.0


def _touch_activity() -> None:
    global _server_last_activity
    _server_last_activity = time.time()


def _make_handler(base_dir: Path, idle_timeout: int):
    from http.server import BaseHTTPRequestHandler

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass

        def _send_json(self, status: int, body: dict) -> None:
            payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _send_html(self, status: int, body: str) -> None:
            payload = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _send_static_asset(self, status: int, payload: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _read_body(self) -> bytes:
            length = int(self.headers.get("Content-Length") or 0)
            return self.rfile.read(length) if length > 0 else b""

        def do_GET(self) -> None:
            _touch_activity()
            parsed = urlparse(self.path)
            path = parsed.path.rstrip("/") or "/"
            if path == "/health":
                self._send_json(200, {"ok": True, "idle_timeout": idle_timeout})
            elif path.startswith("/assets/"):
                asset_path = (base_dir / "www" / path.removeprefix("/assets/")).resolve()
                asset_root = (base_dir / "www").resolve()
                try:
                    if not asset_path.is_file() or asset_root not in asset_path.parents:
                        self._send_json(404, {"ok": False, "message": "asset not found"})
                        return
                    content_type = "image/png" if asset_path.suffix.lower() == ".png" else "application/octet-stream"
                    self._send_static_asset(200, asset_path.read_bytes(), content_type)
                except Exception as exc:
                    self._send_json(500, {"ok": False, "message": str(exc)})
            elif path == "/spectator.html":
                self._send_html(200, build_spectator_html())
            elif path == "/spectator/state":
                query = parse_qs(parsed.query)
                room = normalize_room_name((query.get("room") or [DEFAULT_ROOM])[0])
                try:
                    self._send_json(200, load_spectator_state(base_dir, room))
                except Exception as exc:
                    self._send_json(500, {"ok": False, "message": str(exc)})
            else:
                self._send_json(404, {"ok": False, "message": "not found"})

        def do_POST(self) -> None:
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
            elif path == "/match/sync":
                payload["action"] = "match_sync"
            elif path == "/match/leave":
                payload["action"] = "match_leave"
            elif path == "/room/status":
                payload["action"] = "status"
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

    return Handler


def serve_main(port: int, idle_timeout: int) -> None:
    from http.server import ThreadingHTTPServer

    base_dir = Path(__file__).resolve().parent
    _touch_activity()

    handler_class = _make_handler(base_dir, idle_timeout)
    server = ThreadingHTTPServer(("0.0.0.0", port), handler_class)
    server.daemon_threads = True

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
