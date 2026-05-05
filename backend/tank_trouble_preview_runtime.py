from __future__ import annotations

import math
import threading
import time
from dataclasses import dataclass

from models import (
    ApiResponse,
    TankTroublePreviewClearRequest,
    TankTroublePreviewBulletState,
    TankTroublePreviewFadeState,
    TankTroublePreviewPlayerSnapshot,
    TankTroublePreviewPushRequest,
    TankTroublePreviewRect,
    TankTroublePreviewRippleState,
    TankTroublePreviewRow,
    TankTroublePreviewSceneState,
    TankTroublePreviewState,
    TankTroublePreviewTankState,
    TankTroublePreviewTargetState,
    TankTroubleTankExplosionState,
    TankTroubleRoomRequest,
    TankTroubleRoomState,
)

ARENA_X = 92.0
ARENA_Y = 72.0
ARENA_WIDTH = 1096.0
ARENA_HEIGHT = 656.0
WALL_THICKNESS = 18.0
TARGET_RADIUS = 18.0
TARGET_COUNT = 6
SCOREBOARD_LIMIT = 10
LOGICAL_GRID_COLS = 9
LOGICAL_GRID_ROWS = 6
PLAYER_RADIUS = 20.0
BULLET_RADIUS = 5.0
LOGICAL_GRID_SIZE = min(ARENA_WIDTH / LOGICAL_GRID_COLS, ARENA_HEIGHT / LOGICAL_GRID_ROWS)
BULLET_SPEED = LOGICAL_GRID_SIZE * 1.85
BULLET_LIFE = 10.0
BULLET_BOUNCES = 7
MAX_BULLETS = 5
SELF_HIT_ARM_DELAY = 0.16
RIPPLE_LIFE = 0.34
FADE_LIFE = 0.11
SIMULATION_STEP_MS = 24


def _now_ms() -> int:
    return int(time.time() * 1000)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def _distance(a_x: float, a_y: float, b_x: float, b_y: float) -> float:
    return math.hypot(a_x - b_x, a_y - b_y)


def _limit_text(value: object, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _normalize_room_name(value: object) -> str:
    return _limit_text(value, 64) or "main"


def _normalize_color(value: object) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"red", "blue", "yellow"}:
        return normalized
    return "green"


def _normalize_theme(value: object) -> str:
    return "light" if str(value or "").strip().lower() == "light" else "dark"


def _fallback_seed(source: str) -> int:
    state = 2166136261
    for byte in source.encode("utf-8", errors="ignore"):
        state ^= byte
        state = (state * 16777619) & 0xFFFFFFFF
    return state or 1


def _map_id_from_seed(seed: int) -> str:
    return f"MAP-{seed & 0xFFFF:04X}"


def _create_seeded_random(seed: int):
    state = seed & 0xFFFFFFFF

    def rng() -> float:
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 0x100000000

    return rng


def _rects_intersect(a: TankTroublePreviewRect, b: TankTroublePreviewRect, padding: float = 0.0) -> bool:
    return (
        a.x < b.x + b.w + padding
        and a.x + a.w > b.x - padding
        and a.y < b.y + b.h + padding
        and a.y + a.h > b.y - padding
    )


def _circle_intersects_rect(x: float, y: float, radius: float, rect: TankTroublePreviewRect) -> bool:
    closest_x = _clamp(x, rect.x, rect.x + rect.w)
    closest_y = _clamp(y, rect.y, rect.y + rect.h)
    return _distance(x, y, closest_x, closest_y) < radius


def _create_outer_walls() -> list[TankTroublePreviewRect]:
    return [
        TankTroublePreviewRect(
            x=ARENA_X - WALL_THICKNESS,
            y=ARENA_Y - WALL_THICKNESS,
            w=ARENA_WIDTH + WALL_THICKNESS * 2,
            h=WALL_THICKNESS,
        ),
        TankTroublePreviewRect(
            x=ARENA_X - WALL_THICKNESS,
            y=ARENA_Y + ARENA_HEIGHT,
            w=ARENA_WIDTH + WALL_THICKNESS * 2,
            h=WALL_THICKNESS,
        ),
        TankTroublePreviewRect(
            x=ARENA_X - WALL_THICKNESS,
            y=ARENA_Y,
            w=WALL_THICKNESS,
            h=ARENA_HEIGHT,
        ),
        TankTroublePreviewRect(
            x=ARENA_X + ARENA_WIDTH,
            y=ARENA_Y,
            w=WALL_THICKNESS,
            h=ARENA_HEIGHT,
        ),
    ]


def _build_training_walls(seed: int) -> list[TankTroublePreviewRect]:
    rng = _create_seeded_random(seed)
    walls = _create_outer_walls()
    safe_zones = [
        TankTroublePreviewRect(x=ARENA_X + 24, y=ARENA_Y + 24, w=180, h=140),
        TankTroublePreviewRect(x=ARENA_X + ARENA_WIDTH - 204, y=ARENA_Y + ARENA_HEIGHT - 164, w=180, h=140),
    ]
    cell_width = ARENA_WIDTH / LOGICAL_GRID_COLS
    cell_height = ARENA_HEIGHT / LOGICAL_GRID_ROWS

    def try_add_wall(wall: TankTroublePreviewRect) -> None:
        if any(_rects_intersect(wall, zone, 28) for zone in safe_zones):
            return
        if any(_rects_intersect(wall, existing, 6) for existing in walls):
            return
        walls.append(wall)

    for row in range(LOGICAL_GRID_ROWS):
        for col in range(LOGICAL_GRID_COLS):
            center_x = ARENA_X + cell_width * (col + 0.5)
            center_y = ARENA_Y + cell_height * (row + 0.5)
            horizontal_length = cell_width * (1.24 if rng() > 0.56 else 0.84)
            vertical_length = cell_height * (1.2 if rng() > 0.58 else 0.82)

            if rng() < 0.19:
                try_add_wall(
                    TankTroublePreviewRect(
                        x=center_x - horizontal_length / 2,
                        y=center_y - WALL_THICKNESS / 2,
                        w=horizontal_length,
                        h=WALL_THICKNESS,
                    )
                )

            if rng() < 0.17:
                try_add_wall(
                    TankTroublePreviewRect(
                        x=center_x - WALL_THICKNESS / 2,
                        y=center_y - vertical_length / 2,
                        w=WALL_THICKNESS,
                        h=vertical_length,
                    )
                )

            if rng() < 0.065:
                try_add_wall(TankTroublePreviewRect(x=center_x - 22, y=center_y - 22, w=44, h=44))

    try_add_wall(TankTroublePreviewRect(x=ARENA_X + ARENA_WIDTH * 0.46, y=ARENA_Y + ARENA_HEIGHT * 0.18, w=24, h=ARENA_HEIGHT * 0.26))
    try_add_wall(TankTroublePreviewRect(x=ARENA_X + ARENA_WIDTH * 0.32, y=ARENA_Y + ARENA_HEIGHT * 0.56, w=ARENA_WIDTH * 0.18, h=20))
    try_add_wall(TankTroublePreviewRect(x=ARENA_X + ARENA_WIDTH * 0.62, y=ARENA_Y + ARENA_HEIGHT * 0.54, w=ARENA_WIDTH * 0.18, h=20))
    return walls


def _pick_spawn_point(
    rng,
    walls: list[TankTroublePreviewRect],
    occupied: list[tuple[float, float, float]],
    radius: float,
    preferred_band: dict[str, float] | None = None,
) -> tuple[float, float]:
    for _ in range(360):
        min_x = preferred_band.get("minX", ARENA_X + 34) if preferred_band else ARENA_X + 34
        max_x = preferred_band.get("maxX", ARENA_X + ARENA_WIDTH - 34) if preferred_band else ARENA_X + ARENA_WIDTH - 34
        min_y = preferred_band.get("minY", ARENA_Y + 34) if preferred_band else ARENA_Y + 34
        max_y = preferred_band.get("maxY", ARENA_Y + ARENA_HEIGHT - 34) if preferred_band else ARENA_Y + ARENA_HEIGHT - 34
        x = min_x + rng() * max(1.0, max_x - min_x)
        y = min_y + rng() * max(1.0, max_y - min_y)

        if any(_circle_intersects_rect(x, y, radius, wall) for wall in walls):
            continue
        if any(_distance(other_x, other_y, x, y) < other_radius + radius + 30 for other_x, other_y, other_radius in occupied):
            continue
        return x, y

    return ARENA_X + 100, ARENA_Y + 100


def _build_preview_targets(seed: int, walls: list[TankTroublePreviewRect], tank: TankTroublePreviewPlayerSnapshot) -> list[TankTroublePreviewTargetState]:
    rng = _create_seeded_random(seed ^ 0x5E3F9AB1)
    occupied = [(tank.x, tank.y, tank.radius + 28)]
    targets: list[TankTroublePreviewTargetState] = []

    for index in range(TARGET_COUNT):
        x, y = _pick_spawn_point(
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
        occupied.append((x, y, TARGET_RADIUS + 18))
        targets.append(
            TankTroublePreviewTargetState(
                id=index + 1,
                x=x,
                y=y,
                radius=TARGET_RADIUS,
                phase=rng() * math.pi * 2,
            )
        )

    return targets


@dataclass
class _RoomCacheEntry:
    request: TankTroubleRoomRequest
    state: TankTroubleRoomState
    cached_at_ms: int


@dataclass
class _PreviewBullet:
    id: int
    color: str
    projectile_type: str
    x: float
    y: float
    radius: float
    vx: float
    vy: float
    life: float
    bounces_left: int
    age: float
    path_segments: list[dict]
    distance_travelled: float
    segments: list[dict]


@dataclass
class _PreviewRipple:
    id: int
    x: float
    y: float
    color: str
    life: float
    max_life: float
    wall: TankTroublePreviewRect


@dataclass
class _PreviewFade:
    id: int
    x: float
    y: float
    radius: float
    life: float
    max_life: float
    color: str


@dataclass
class _PreviewSession:
    session_id: str
    room: str
    player_id: str
    country_code: str
    player_color: str
    theme: str
    authoritative_scene: bool
    map_seed: int
    map_id: str
    started_at_ms: int
    updated_at_ms: int
    last_reported_at_ms: int
    last_simulated_ms: int
    frame_seq: int
    last_snapshot_seq: int
    last_reported_shots: int
    next_bullet_id: int
    next_effect_id: int
    target_respawn_seq: int
    score: int
    hits: int
    target_hits: int
    ricochets: int
    latency_ms: int
    tank: TankTroublePreviewPlayerSnapshot
    walls: list[TankTroublePreviewRect]
    targets: list[TankTroublePreviewTargetState]
    bullets: list[_PreviewBullet]
    tank_explosions: list[TankTroubleTankExplosionState]
    wall_ripples: list[_PreviewRipple]
    bullet_fades: list[_PreviewFade]


def _normalize_preview_targets(targets: list[TankTroublePreviewTargetState]) -> list[TankTroublePreviewTargetState]:
    normalized_targets: list[TankTroublePreviewTargetState] = []
    seen_ids: set[int] = set()
    for index, target in enumerate(targets):
        target_id = max(1, int(target.id or index + 1))
        if target_id in seen_ids:
            continue
        seen_ids.add(target_id)
        normalized_targets.append(
            TankTroublePreviewTargetState(
                id=target_id,
                x=float(target.x),
                y=float(target.y),
                radius=max(1.0, float(target.radius or TARGET_RADIUS)),
                phase=float(target.phase or 0.0),
            )
        )
    return normalized_targets


def _normalize_preview_bullets(
    bullets: list[TankTroublePreviewBulletState],
    default_color: str,
) -> list[_PreviewBullet]:
    normalized_bullets: list[_PreviewBullet] = []
    seen_ids: set[int] = set()
    for index, bullet in enumerate(bullets):
        bullet_id = max(1, int(bullet.id or index + 1))
        if bullet_id in seen_ids:
            continue
        seen_ids.add(bullet_id)
        normalized_bullets.append(
            _PreviewBullet(
                id=bullet_id,
                color=_normalize_color(bullet.color or default_color),
                projectile_type=str(getattr(bullet, "projectile_type", "bullet") or "bullet"),
                x=float(bullet.x),
                y=float(bullet.y),
                radius=max(1.0, float(bullet.radius or BULLET_RADIUS)),
                vx=float(bullet.vx or 0.0),
                vy=float(bullet.vy or 0.0),
                life=BULLET_LIFE,
                bounces_left=BULLET_BOUNCES,
                age=0.0,
                path_segments=list(getattr(bullet, "path_segments", []) or []),
                distance_travelled=max(0.0, float(getattr(bullet, "distance_travelled", 0.0) or 0.0)),
                segments=list(getattr(bullet, "segments", []) or []),
            )
        )
    return normalized_bullets


def _normalize_tank_explosions(explosions: list[TankTroubleTankExplosionState]) -> list[TankTroubleTankExplosionState]:
    normalized: list[TankTroubleTankExplosionState] = []
    seen_ids: set[int] = set()
    for index, explosion in enumerate(explosions):
        explosion_id = max(1, int(explosion.id or index + 1))
        if explosion_id in seen_ids:
            continue
        seen_ids.add(explosion_id)
        max_life = max(0.12, float(explosion.maxLife or 0.78))
        life = _clamp(float(explosion.life or max_life), 0.0, max_life)
        if life <= 0:
            continue
        normalized.append(
            TankTroubleTankExplosionState(
                id=explosion_id,
                x=float(explosion.x),
                y=float(explosion.y),
                radius=max(1.0, float(explosion.radius or PLAYER_RADIUS)),
                color=_normalize_color(explosion.color),
                life=life,
                maxLife=max_life,
                seed=max(0, int(explosion.seed or 0)),
                created_at_ms=max(0, int(explosion.created_at_ms or 0)),
            )
        )
    return normalized[-40:]


class TankTroublePreviewRuntime:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._room_cache: dict[str, _RoomCacheEntry] = {}
        self._sessions: dict[str, _PreviewSession] = {}
        self._active_session_id = ""

    @staticmethod
    def _room_cache_key(room: str, player_id: str) -> str:
        return f"{room}::{player_id}"

    def cache_room_state(self, request: TankTroubleRoomRequest, state: TankTroubleRoomState) -> None:
        room = _normalize_room_name(request.room)
        player_id = _limit_text(request.player_id, 32)
        with self._lock:
            self._room_cache[self._room_cache_key(room, player_id)] = _RoomCacheEntry(
                request=TankTroubleRoomRequest(room=room, player_id=player_id, country_code=request.country_code),
                state=state.model_copy(deep=True),
                cached_at_ms=_now_ms(),
            )

    def clear_room_state(self, request: TankTroubleRoomRequest) -> None:
        room = _normalize_room_name(request.room)
        player_id = _limit_text(request.player_id, 32)
        with self._lock:
            self._room_cache.pop(self._room_cache_key(room, player_id), None)

    def _create_session(
        self,
        session_id: str,
        room: str,
        player_id: str,
        country_code: str,
        map_seed: int,
        map_id: str,
        updated_at_ms: int,
        snapshot_seq: int,
        authoritative_scene: bool,
        theme: str,
        tank: TankTroublePreviewPlayerSnapshot,
        bullets: list[_PreviewBullet],
        targets: list[TankTroublePreviewTargetState],
        tank_explosions: list[TankTroubleTankExplosionState],
        latency_ms: int = 0,
    ) -> _PreviewSession:
        walls = _build_training_walls(map_seed)
        initial_targets = targets if authoritative_scene and targets else _build_preview_targets(map_seed, walls, tank)
        next_bullet_id = max((bullet.id for bullet in bullets), default=0) + 1
        return _PreviewSession(
            session_id=session_id,
            room=room,
            player_id=player_id,
            country_code=country_code,
            player_color=tank.color,
            theme=theme,
            authoritative_scene=authoritative_scene,
            map_seed=map_seed,
            map_id=map_id,
            started_at_ms=updated_at_ms,
            updated_at_ms=updated_at_ms,
            last_reported_at_ms=updated_at_ms,
            last_simulated_ms=updated_at_ms,
            frame_seq=1,
            last_snapshot_seq=max(0, snapshot_seq),
            last_reported_shots=max(0, int(tank.shots or 0)),
            next_bullet_id=max(1, next_bullet_id),
            next_effect_id=1,
            target_respawn_seq=0,
            score=max(0, int(tank.score or 0)),
            hits=max(0, int(tank.hits or 0)),
            target_hits=max(0, int(tank.hits or 0)),
            ricochets=0,
            latency_ms=max(0, int(latency_ms or 0)),
            tank=tank,
            walls=walls,
            targets=initial_targets,
            bullets=bullets,
            tank_explosions=tank_explosions,
            wall_ripples=[],
            bullet_fades=[],
        )

    @staticmethod
    def _push_wall_ripple(
        session: _PreviewSession,
        wall: TankTroublePreviewRect,
        x: float,
        y: float,
        color: str,
    ) -> None:
        session.wall_ripples.append(
            _PreviewRipple(
                id=session.next_effect_id,
                wall=wall.model_copy(deep=True),
                x=x,
                y=y,
                color=color,
                life=RIPPLE_LIFE,
                max_life=RIPPLE_LIFE,
            )
        )
        session.next_effect_id += 1

    @staticmethod
    def _push_bullet_fade(session: _PreviewSession, bullet: _PreviewBullet) -> None:
        session.bullet_fades.append(
            _PreviewFade(
                id=session.next_effect_id,
                x=bullet.x,
                y=bullet.y,
                radius=bullet.radius,
                color=bullet.color,
                life=FADE_LIFE,
                max_life=FADE_LIFE,
            )
        )
        session.next_effect_id += 1

    @staticmethod
    def _advance_effects(session: _PreviewSession, dt: float) -> None:
        session.wall_ripples = [
            _PreviewRipple(
                id=ripple.id,
                x=ripple.x,
                y=ripple.y,
                color=ripple.color,
                life=max(0.0, ripple.life - dt),
                max_life=ripple.max_life,
                wall=ripple.wall,
            )
            for ripple in session.wall_ripples
            if ripple.life > dt
        ]
        session.bullet_fades = [
            _PreviewFade(
                id=fade.id,
                x=fade.x,
                y=fade.y,
                radius=fade.radius,
                color=fade.color,
                life=max(0.0, fade.life - dt),
                max_life=fade.max_life,
            )
            for fade in session.bullet_fades
            if fade.life > dt
        ]

    @staticmethod
    def _respawn_target(session: _PreviewSession, target_id: int) -> None:
        session.target_respawn_seq += 1
        occupied = [(session.tank.x, session.tank.y, session.tank.radius + 32)]
        occupied.extend(
            (target.x, target.y, target.radius + 18)
            for target in session.targets
            if target.id != target_id
        )
        rng = _create_seeded_random(
            (session.map_seed ^ target_id ^ (session.target_respawn_seq * 2654435761)) & 0xFFFFFFFF
        )
        next_x, next_y = _pick_spawn_point(
            rng,
            session.walls,
            occupied,
            TARGET_RADIUS,
            {
                "minX": ARENA_X + 80,
                "maxX": ARENA_X + ARENA_WIDTH - 80,
                "minY": ARENA_Y + 70,
                "maxY": ARENA_Y + ARENA_HEIGHT - 70,
            },
        )
        for index, target in enumerate(session.targets):
            if target.id != target_id:
                continue
            session.targets[index] = TankTroublePreviewTargetState(
                id=target.id,
                x=next_x,
                y=next_y,
                radius=target.radius,
                phase=rng() * math.pi * 2,
            )
            break

    @staticmethod
    def _spawn_bullet(session: _PreviewSession, age_sec: float = 0.0) -> None:
        if len(session.bullets) >= MAX_BULLETS:
            return
        age_sec = max(0.0, min(age_sec, BULLET_LIFE))
        spawn_x = session.tank.x + math.cos(session.tank.angle) * (session.tank.radius + 12)
        spawn_y = session.tank.y + math.sin(session.tank.angle) * (session.tank.radius + 12)
        vx = math.cos(session.tank.angle) * BULLET_SPEED
        vy = math.sin(session.tank.angle) * BULLET_SPEED
        session.bullets.append(
            _PreviewBullet(
                id=session.next_bullet_id,
                color=session.player_color,
                projectile_type="bullet",
                x=spawn_x + vx * age_sec,
                y=spawn_y + vy * age_sec,
                radius=BULLET_RADIUS,
                vx=vx,
                vy=vy,
                life=max(0.0, BULLET_LIFE - age_sec),
                bounces_left=BULLET_BOUNCES,
                age=age_sec,
                path_segments=[],
                distance_travelled=0.0,
                segments=[],
            )
        )
        session.next_bullet_id += 1

    def _simulate_session(self, session: _PreviewSession, target_ms: int) -> None:
        if target_ms <= session.last_simulated_ms:
            return

        total_ms = target_ms - session.last_simulated_ms
        steps = max(1, math.ceil(total_ms / SIMULATION_STEP_MS))
        step_dt = total_ms / steps / 1000.0

        for _ in range(steps):
            session.tank.flash = max(0.0, session.tank.flash - step_dt)
            self._advance_effects(session, step_dt)
            next_bullets: list[_PreviewBullet] = []

            for bullet in session.bullets:
                previous_x = bullet.x
                previous_y = bullet.y
                next_bullet = _PreviewBullet(
                    id=bullet.id,
                    color=bullet.color,
                    projectile_type=bullet.projectile_type,
                    x=bullet.x + bullet.vx * step_dt,
                    y=bullet.y + bullet.vy * step_dt,
                    radius=bullet.radius,
                    vx=bullet.vx,
                    vy=bullet.vy,
                    life=bullet.life - step_dt,
                    bounces_left=bullet.bounces_left,
                    age=bullet.age + step_dt,
                    path_segments=list(bullet.path_segments or []),
                    distance_travelled=bullet.distance_travelled,
                    segments=list(bullet.segments or []),
                )

                for wall in session.walls:
                    expanded_x = wall.x - next_bullet.radius
                    expanded_y = wall.y - next_bullet.radius
                    expanded_w = wall.w + next_bullet.radius * 2
                    expanded_h = wall.h + next_bullet.radius * 2
                    inside_expanded = (
                        next_bullet.x > expanded_x
                        and next_bullet.x < expanded_x + expanded_w
                        and next_bullet.y > expanded_y
                        and next_bullet.y < expanded_y + expanded_h
                    )
                    if not inside_expanded:
                        continue

                    flip_x = previous_x <= expanded_x or previous_x >= expanded_x + expanded_w
                    flip_y = previous_y <= expanded_y or previous_y >= expanded_y + expanded_h
                    if not flip_x and not flip_y:
                        distance_left = abs(next_bullet.x - expanded_x)
                        distance_right = abs(expanded_x + expanded_w - next_bullet.x)
                        distance_top = abs(next_bullet.y - expanded_y)
                        distance_bottom = abs(expanded_y + expanded_h - next_bullet.y)
                        if min(distance_left, distance_right) <= min(distance_top, distance_bottom):
                            flip_x = True
                        else:
                            flip_y = True

                    if flip_x:
                        next_bullet.vx *= -1
                    if flip_y:
                        next_bullet.vy *= -1

                    session.ricochets += 1
                    self._push_wall_ripple(
                        session,
                        wall,
                        _clamp(next_bullet.x, wall.x, wall.x + wall.w),
                        _clamp(next_bullet.y, wall.y, wall.y + wall.h),
                        next_bullet.color,
                    )
                    next_bullet.bounces_left -= 1
                    next_bullet.x = previous_x + next_bullet.vx * step_dt * 0.4
                    next_bullet.y = previous_y + next_bullet.vy * step_dt * 0.4
                    break

                if (
                    next_bullet.life <= 0
                    or next_bullet.bounces_left < 0
                    or next_bullet.x < ARENA_X - 64
                    or next_bullet.x > ARENA_X + ARENA_WIDTH + 64
                    or next_bullet.y < ARENA_Y - 64
                    or next_bullet.y > ARENA_Y + ARENA_HEIGHT + 64
                ):
                    self._push_bullet_fade(session, next_bullet)
                    continue

                hit_target = next(
                    (
                        target
                        for target in session.targets
                        if _distance(target.x, target.y, next_bullet.x, next_bullet.y) < target.radius + next_bullet.radius
                    ),
                    None,
                )
                if hit_target is not None:
                    session.target_hits += 1
                    session.hits += 1
                    session.score = max(session.score, session.target_hits)
                    self._respawn_target(session, hit_target.id)
                    self._push_bullet_fade(session, next_bullet)
                    continue

                if (
                    next_bullet.age >= SELF_HIT_ARM_DELAY
                    and _distance(session.tank.x, session.tank.y, next_bullet.x, next_bullet.y)
                    < session.tank.radius + next_bullet.radius
                ):
                    session.tank.flash = max(session.tank.flash, 0.12)
                    self._push_bullet_fade(session, next_bullet)
                    continue

                next_bullets.append(next_bullet)

            session.bullets = next_bullets

        session.last_simulated_ms = target_ms
        session.updated_at_ms = max(session.updated_at_ms, target_ms)

    def push_snapshot(self, payload: TankTroublePreviewPushRequest) -> ApiResponse:
        session_id = _limit_text(payload.session_id, 64)
        if not session_id:
            raise RuntimeError("session_id is required.")

        room = _normalize_room_name(payload.room)
        player_id = _limit_text(payload.player_id, 32)
        if not player_id:
            raise RuntimeError("player_id is required.")

        updated_at_ms = int(payload.updated_at_ms or _now_ms())
        latency_ms = max(0, min(9999, int(payload.latency_ms or 0)))
        snapshot_seq = max(0, int(payload.snapshot_seq or 0))
        authoritative_scene = bool(payload.authoritative_scene)
        theme = _normalize_theme(payload.theme)
        tank = TankTroublePreviewPlayerSnapshot(
            color=_normalize_color(payload.tank.color),
            weapon=str(getattr(payload.tank, "weapon", "default") or "default"),
            shotgun_ammo=max(0, int(getattr(payload.tank, "shotgun_ammo", 0) or 0)),
            minigun_ammo=max(0, int(getattr(payload.tank, "minigun_ammo", 0) or 0)),
            weapon_reload_ms=max(0, int(getattr(payload.tank, "weapon_reload_ms", 0) or 0)),
            x=float(payload.tank.x),
            y=float(payload.tank.y),
            angle=float(payload.tank.angle),
            radius=max(1.0, float(payload.tank.radius)),
            flash=max(0.0, float(payload.tank.flash or 0.0)),
            shots=max(0, int(payload.tank.shots or 0)),
            score=max(0, int(payload.tank.score or 0)),
            hits=max(0, int(payload.tank.hits or 0)),
        )
        bullets = _normalize_preview_bullets(payload.bullets if authoritative_scene else [], tank.color)
        targets = _normalize_preview_targets(payload.targets if authoritative_scene else [])
        tank_explosions = _normalize_tank_explosions(payload.tankExplosions if authoritative_scene else [])

        with self._lock:
            room_cache = self._room_cache.get(self._room_cache_key(room, player_id))
            room_state = room_cache.state.model_copy(deep=True) if room_cache else None
            country_code = _limit_text(payload.country_code or (room_cache.request.country_code if room_cache else ""), 12).upper()
            map_seed = int(room_state.map_seed) if room_state else _fallback_seed(f"{room}:{player_id}:{session_id}")
            map_id = _limit_text(room_state.map_id, 32) if room_state else _map_id_from_seed(map_seed)

            existing = self._sessions.get(session_id)
            rebuild_static_scene = (
                existing is None
                or existing.room != room
                or existing.player_id != player_id
                or existing.map_seed != map_seed
            )

            if rebuild_static_scene:
                self._sessions[session_id] = self._create_session(
                    session_id=session_id,
                    room=room,
                    player_id=player_id,
                    country_code=country_code,
                    map_seed=map_seed,
                    map_id=map_id,
                    updated_at_ms=updated_at_ms,
                    snapshot_seq=snapshot_seq,
                    authoritative_scene=authoritative_scene,
                    theme=theme,
                    tank=tank,
                    bullets=bullets,
                    targets=targets,
                    tank_explosions=tank_explosions,
                    latency_ms=latency_ms,
                )
                self._active_session_id = session_id
                return ApiResponse(success=True, message="Tank preview session created.")

            if existing is None:
                raise RuntimeError("preview session missing.")

            if snapshot_seq and snapshot_seq <= existing.last_snapshot_seq:
                self._active_session_id = session_id
                return ApiResponse(success=True, message="Ignored stale tank preview snapshot.")

            previous_reported_at_ms = existing.last_reported_at_ms
            if not authoritative_scene:
                self._simulate_session(existing, updated_at_ms)
            existing.room = room
            existing.player_id = player_id
            existing.country_code = country_code
            existing.player_color = tank.color
            existing.theme = theme
            existing.authoritative_scene = authoritative_scene
            existing.map_id = map_id
            existing.tank = tank
            existing.score = max(0, int(tank.score or 0))
            existing.hits = max(0, int(tank.hits or 0))
            existing.target_hits = max(0, int(tank.hits or 0))
            existing.latency_ms = latency_ms
            existing.updated_at_ms = updated_at_ms
            existing.last_reported_at_ms = updated_at_ms
            existing.frame_seq += 1
            existing.last_snapshot_seq = max(existing.last_snapshot_seq, snapshot_seq)

            if authoritative_scene:
                existing.bullets = bullets
                existing.targets = targets
                existing.tank_explosions = tank_explosions
                existing.wall_ripples = []
                existing.bullet_fades = []
                existing.last_reported_shots = tank.shots
                existing.last_simulated_ms = updated_at_ms
                existing.next_bullet_id = max(existing.next_bullet_id, max((bullet.id for bullet in bullets), default=0) + 1)
            else:
                if tank.shots < existing.last_reported_shots:
                    existing.bullets = []
                    existing.last_reported_shots = tank.shots

                new_shots = max(0, tank.shots - existing.last_reported_shots)
                if new_shots:
                    interval_ms = max(0, min(160, updated_at_ms - previous_reported_at_ms))
                    for index in range(new_shots):
                        if len(existing.bullets) >= MAX_BULLETS:
                            break
                        lead_ms = interval_ms * (new_shots - index) / (new_shots + 1)
                        self._spawn_bullet(existing, age_sec=lead_ms / 1000.0)
                    existing.last_reported_shots = tank.shots
                else:
                    existing.last_reported_shots = tank.shots
            self._active_session_id = session_id

        return ApiResponse(success=True, message="Tank preview snapshot updated.")

    def clear_preview(self, payload: TankTroublePreviewClearRequest) -> ApiResponse:
        session_id = _limit_text(payload.session_id, 64)
        with self._lock:
            if not session_id:
                self._sessions.clear()
                self._active_session_id = ""
            elif session_id in self._sessions:
                self._sessions.pop(session_id, None)
                if self._active_session_id == session_id:
                    self._active_session_id = ""
        return ApiResponse(success=True, message="Tank preview cleared.")

    def get_state(self) -> TankTroublePreviewState:
        with self._lock:
            session = self._sessions.get(self._active_session_id)
            if session is None:
                return TankTroublePreviewState(updated_at_ms=_now_ms())
            if not session.authoritative_scene:
                self._simulate_session(session, _now_ms())
            room_cache = self._room_cache.get(self._room_cache_key(session.room, session.player_id))
            room_state = room_cache.state.model_copy(deep=True) if room_cache else None
            return self._build_state(session, room_state)

    def _build_rows(self, session: _PreviewSession, room_state: TankTroubleRoomState | None) -> list[TankTroublePreviewRow]:
        active_player_ids = list(room_state.active_player_ids[:SCOREBOARD_LIMIT]) if room_state else []
        active_player_index = {
            player.player_id: player
            for player in (room_state.active_players if room_state else [])
        }
        rows: list[TankTroublePreviewRow] = []

        if not active_player_ids:
            active_player_ids = [session.player_id]

        for index, entry_player_id in enumerate(active_player_ids[:SCOREBOARD_LIMIT]):
            player_state = active_player_index.get(entry_player_id)
            rows.append(
                TankTroublePreviewRow(
                    rank=index + 1,
                    player_id=_limit_text(entry_player_id or "--", 32) or "--",
                    country_code=(
                        player_state.country_code
                        if player_state
                        else session.country_code if entry_player_id == session.player_id else ""
                    ),
                    score=player_state.score if player_state else session.score if entry_player_id == session.player_id else 0,
                    latency_ms=(
                        session.latency_ms
                        if entry_player_id == session.player_id
                        else player_state.latency_ms if player_state else 0
                    ),
                    active=entry_player_id == session.player_id,
                )
            )
        return rows

    def _build_map_label(self, session: _PreviewSession, room_state: TankTroubleRoomState | None) -> str:
        if room_state and room_state.countdown_active:
            return f"准备换图 {room_state.countdown_seconds}"
        return f"当前地图：{room_state.map_id if room_state else session.map_id}"

    def _build_runtime_summary(self, session: _PreviewSession, room_state: TankTroubleRoomState | None) -> str:
        elapsed_ms = max(0, session.updated_at_ms - session.started_at_ms)
        active_count = room_state.active_player_count if room_state else 1
        return f"服务器预览运行 {elapsed_ms / 1000:.1f}s · 活跃玩家 {active_count}"

    def _build_state(self, session: _PreviewSession, room_state: TankTroubleRoomState | None) -> TankTroublePreviewState:
        elapsed_ms = max(0, session.updated_at_ms - session.started_at_ms)
        scene = TankTroublePreviewSceneState(
            theme=session.theme,
            mapTag=session.map_id,
            elapsedMs=elapsed_ms,
            walls=[wall.model_copy(deep=True) for wall in session.walls],
            tanks=[
                TankTroublePreviewTankState(
                    id=session.player_id,
                    color=session.player_color,
                    weapon=str(getattr(session.tank, "weapon", "default") or "default"),
                    shotgun_ammo=max(0, int(getattr(session.tank, "shotgun_ammo", 0) or 0)),
                    minigun_ammo=max(0, int(getattr(session.tank, "minigun_ammo", 0) or 0)),
                    weapon_reload_ms=max(0, int(getattr(session.tank, "weapon_reload_ms", 0) or 0)),
                    x=session.tank.x,
                    y=session.tank.y,
                    angle=session.tank.angle,
                    radius=session.tank.radius,
                    flash=session.tank.flash,
                )
            ],
            bullets=[
                TankTroublePreviewBulletState(
                    id=bullet.id,
                    color=bullet.color,
                    projectile_type=bullet.projectile_type,
                    x=bullet.x,
                    y=bullet.y,
                    radius=bullet.radius,
                    vx=bullet.vx,
                    vy=bullet.vy,
                    path_segments=list(bullet.path_segments or []),
                    distance_travelled=bullet.distance_travelled,
                    segments=list(bullet.segments or []),
                )
                for bullet in session.bullets
            ],
            targets=[target.model_copy(deep=True) for target in session.targets],
            tankExplosions=[explosion.model_copy(deep=True) for explosion in session.tank_explosions],
            wallRipples=[
                TankTroublePreviewRippleState(
                    id=ripple.id,
                    x=ripple.x,
                    y=ripple.y,
                    color=ripple.color,
                    life=ripple.life,
                    maxLife=ripple.max_life,
                    wall=ripple.wall.model_copy(deep=True),
                )
                for ripple in session.wall_ripples
            ],
            bulletFades=[
                TankTroublePreviewFadeState(
                    id=fade.id,
                    x=fade.x,
                    y=fade.y,
                    radius=fade.radius,
                    life=fade.life,
                    maxLife=fade.max_life,
                    color=fade.color,
                )
                for fade in session.bullet_fades
            ],
        )
        return TankTroublePreviewState(
            active=True,
            frame_seq=session.frame_seq,
            session_id=session.session_id,
            player_id=session.player_id,
            map_id=session.map_id,
            map_label=self._build_map_label(session, room_state),
            runtime_summary=self._build_runtime_summary(session, room_state),
            rows=self._build_rows(session, room_state),
            scene=scene,
            updated_at_ms=session.updated_at_ms,
        )
