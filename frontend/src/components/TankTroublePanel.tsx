import { useEffect, useRef, useState } from "react";
import {
  checkTankTroubleSetup,
  clearTankTroublePreview,
  getTankTroubleRoomStatus,
  getTankTroubleSpectatorPageUrl,
  leaveTankTroubleMatch,
  leaveTankTroubleRoom,
  openTankTroubleMatchSocket,
  pushTankTroublePreview,
  runTankTroubleSetup,
  syncTankTroubleMatch,
  syncTankTroubleRoom,
  toggleTankTroubleRoomVote,
} from "../api/cloudApi";
import type {
  TankTroubleCustomOptions,
  TankTroubleMatchBulletState,
  TankTroubleMatchInputState,
  TankTroubleMatchLocalPlayerSyncState,
  TankTroubleMatchLocalState,
  TankTroubleMineState,
  TankTroubleMatchRequest,
  TankTroubleMatchState,
  TankTroubleLatencyCloneState,
  TankTroubleLatencyFireEvent,
  TankTroubleLatencyInputState,
  TankTroubleLatencyRequest,
  TankTroubleLatencyState,
  TankTroubleLatencyTargetRespawn,
  TankTroublePreviewBulletState,
  TankTroublePreviewPlayerSnapshot,
  TankTroublePreviewTargetState,
  TankTroublePowerupEffectState,
  TankTroublePowerupState,
  TankTroubleRoomPlayerState,
  TankTroubleRoomState,
  TankTroubleTankExplosionState,
  TankTroubleVoteMarker,
} from "../types/cloud";
import { Button } from "./Button";
import { ToggleSwitch } from "./ToggleSwitch";

type TankTroublePanelProps = {
  theme: "light" | "dark";
  localCountryCode?: string;
  canRunSetup?: boolean;
};

type GameKey = "tank-trouble";

type GameChoice = {
  key: GameKey;
  title: string;
  subtitle: string;
  detail: string;
  accent: string;
};

type GameSessionMode = "online" | "latency" | "custom" | "local";
type GameLaunchMode = GameSessionMode;
type TankTroubleSetupPhase = "idle" | "checking" | "running" | "ready" | "error";

type PlayerColorKey = "green" | "red" | "blue" | "yellow";

type PlayerColorOption = {
  key: PlayerColorKey;
  label: string;
  swatch: string;
};

type GameSession = {
  playerId: string;
  seed: number;
  mapId: string;
  room: string;
  playerColor: string;
  mode: GameSessionMode;
  customOptions?: TankTroubleCustomOptions;
};

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type WallSpatialIndex = {
  walls: Rect[];
  cells: Map<string, Rect[]>;
};

type Circle = {
  x: number;
  y: number;
  radius: number;
};

type InputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
};

type ControlAction = keyof InputState;
type ControlBindings = Record<ControlAction, string>;

type LatencyTransportMessage =
  | { type: "state"; state: TankTroubleLatencyState }
  | { type: "error"; message: string }
  | { type: "left"; ok: boolean };

type MatchTransportMessage =
  | { type: "state"; state: TankTroubleMatchState }
  | { type: "error"; message: string }
  | { type: "left"; ok: boolean };

type Bullet = Circle & {
  id: number;
  vx: number;
  vy: number;
  life: number;
  bouncesLeft: number;
  age: number;
  hasBounced?: boolean;
  projectileType?: string;
  targetId?: string;
  targetColor?: string;
  flameColor?: string;
  targetFlameColor?: string;
  locked?: boolean;
  steerLockedUntilAge?: number;
  pathSegments?: AimSegment[];
  distanceTravelled?: number;
  segments?: AimSegment[];
};

type BulletFade = Circle & {
  id: number;
  serverId?: number;
  ownerId?: string;
  vx: number;
  vy: number;
  age?: number;
  color?: string;
  projectileType?: string;
  targetId?: string;
  targetColor?: string;
  flameColor?: string;
  targetFlameColor?: string;
  locked?: boolean;
  pathSegments?: AimSegment[];
  distanceTravelled?: number;
  segments?: AimSegment[];
  life: number;
  maxLife: number;
};

type BulletSmokePuff = {
  offsetX: number;
  offsetY: number;
  driftX: number;
  driftY: number;
  radius: number;
  alpha: number;
};

type BulletSmokeEffect = Circle & {
  id: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  puffs: BulletSmokePuff[];
};

type WallRipple = {
  id: number;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  wall: Rect;
};

type ShieldPulseEffect = {
  id: number;
  x: number;
  y: number;
  impactX: number;
  impactY: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  source: "impact" | "blast";
};

type LandMine = Circle & {
  id: number;
  ownerId: string;
  color: string;
  triggerRadius: number;
  blastRadius: number;
  age: number;
  armed: boolean;
  triggered: boolean;
  triggerStartedAtMs: number;
  createdAtMs: number;
  serverTimeMs: number;
  visibleAlpha?: number;
  local?: boolean;
  fireSeq?: number;
};

type AimSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ShieldCollider = {
  id: string;
  x: number;
  y: number;
  shieldRadius: number;
  color: string;
};

type TankExplosionParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
  color: string;
  life: number;
  maxLife: number;
};

type TankExplosionEffect = {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  weapon?: string;
  life: number;
  maxLife: number;
  particles: TankExplosionParticle[];
};

type TrainingTarget = Circle & {
  id: number;
  phase: number;
};

type TankPowerup = Circle & {
  id: number;
  kind: string;
  color: string;
  symbol: string;
  effect: string;
  scoreDelta: number;
  phase: number;
  disabled?: boolean;
  respawnAtMs?: number;
  homeX?: number;
  homeY?: number;
};

type TankPowerupPickupEffect = Circle & {
  id: number;
  powerupId: number;
  playerId: string;
  kind: string;
  color: string;
  symbol: string;
  effect: string;
  scoreDelta: number;
  life: number;
  maxLife: number;
};

type HealPlusEffect = {
  id: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  driftX: number;
  rise: number;
  size: number;
  delay: number;
  life: number;
  maxLife: number;
};

type KillFeedEntry = {
  id: number;
  killerId: string;
  victimId: string;
  killerColor: string;
  victimColor: string;
  weapon: string;
  suicide: boolean;
  life: number;
  maxLife: number;
};

type PlayerTank = Circle & {
  id: string;
  angle: number;
  cooldown: number;
  flash: number;
  hp?: number;
  maxHp?: number;
  smokeBelow50SinceMs?: number;
  smokeBelow25SinceMs?: number;
  weapon?: string;
  shotgunAmmo?: number;
  minigunAmmo?: number;
  doubleBarrelAmmo?: number;
  mineAmmo?: number;
  missileAmmo?: number;
  weaponReloadMs?: number;
  shieldActiveMs?: number;
  shieldVisibleMs?: number;
  shieldElapsedMs?: number;
  shieldRadius?: number;
};

function tankHasVisibleShield(tank: Pick<PlayerTank, "shieldVisibleMs">) {
  return Math.max(0, Number(tank.shieldVisibleMs || 0)) > 0;
}

type ShellCasing = {
  id: number;
  kind?: "shotgun" | "minigun";
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  life: number;
  maxLife: number;
};

type TankTroubleSnapshot = {
  score: number;
  shots: number;
  hits: number;
  bullets: number;
  ricochets: number;
  deaths: number;
  elapsedMs: number;
  mapTag: string;
  targetsRemaining: number;
};

type LeaderboardEntry = {
  playerId: string;
  countryCode: string;
  score: number;
  hits: number;
  latencyMs?: number;
  updatedAt: number;
};

type LatencyCloneTankState = PlayerTank & {
  countryCode: string;
  country_code: string;
  color: string;
  player_id: string;
};

type LatencyCloneBulletState = Bullet;

type LatencyCloneSyncMeta = {
  color: string;
  playerId: string;
  countryCode: string;
  resetSeq: number;
  ackInputSeq: number;
  snapshotSeq: number;
};

type TankTroublePreviewSnapshot = {
  authoritative_scene: true;
  theme: "light" | "dark";
  tank: TankTroublePreviewPlayerSnapshot;
  bullets: TankTroublePreviewBulletState[];
  targets: TankTroublePreviewTargetState[];
  mines: TankTroubleMineState[];
  tankExplosions: TankTroubleTankExplosionState[];
};

type TankTroubleEngine = {
  setTheme: (theme: "light" | "dark") => void;
  setBotEnabled: (enabled: boolean) => void;
  setLatencyOnly: (enabled: boolean) => void;
  queueFireInput: () => void;
  isRapidFireWeapon?: () => boolean;
  update: (dt: number, input: InputState) => void;
  render: (ctx: CanvasRenderingContext2D) => void;
  snapshot: () => TankTroubleSnapshot;
  applyMatchState?: (state: TankTroubleMatchState) => void;
  setCustomOptions?: (options: TankTroubleCustomOptions) => void;
  buildMatchSyncState: () => TankTroubleMatchLocalPlayerSyncState | undefined;
  getMatchFireSeq: () => number;
  buildPreviewSnapshot: () => TankTroublePreviewSnapshot;
  buildLatencySyncState: () => Pick<TankTroubleLatencyRequest, "local_player" | "targets">;
  applyLatencyState: (state: TankTroubleLatencyState) => void;
  clearLatencyState: () => void;
  getCloneHitSeq: () => number;
};

const GAME_OPTIONS: GameChoice[] = [
  {
    key: "tank-trouble",
    title: "Tank Trouble",
    subtitle: "V1.0",
    detail: "前进、后退、转向、开火键位可在本机自定义。",
    accent: "game-accent-cyan",
  },
];

const PLAYER_COLOR_OPTIONS: PlayerColorOption[] = [
  { key: "green", label: "绿色", swatch: "#22c55e" },
  { key: "red", label: "红色", swatch: "#ef4444" },
  { key: "blue", label: "蓝色", swatch: "#3b82f6" },
  { key: "yellow", label: "黄色", swatch: "#f59e0b" },
];

const STORAGE_PLAYER_ID_KEY = "cloud-service-console:tank-trouble-player-id";
const STORAGE_LEADERBOARD_KEY = "cloud-service-console:tank-trouble-leaderboard";
const STORAGE_CONTROL_BINDINGS_KEY = "cloud-service-console:tank-trouble-control-bindings";
const TANK_TROUBLE_ROOM = "tank-trouble-main";
const ROOM_POLL_INTERVAL_MS = 1200;
const LATENCY_SYNC_IDLE_INTERVAL_MS = 90;
const LATENCY_SYNC_RUSH_INTERVAL_MS = 12;
const ONLINE_SYNC_IDLE_INTERVAL_MS = 45;
const ONLINE_SYNC_RUSH_INTERVAL_MS = 25;
const ONLINE_SYNC_BUFFER_LIMIT_BYTES = 96 * 1024;
const PREVIEW_PUSH_INTERVAL_MS = 50;
const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 800;
const WORLD_ASPECT_RATIO = WORLD_WIDTH / WORLD_HEIGHT;
const ARENA_X = 92;
const ARENA_Y = 72;
const ARENA_WIDTH = 1096;
const ARENA_HEIGHT = 656;
const WALL_THICKNESS = 18;
const PLAYER_RADIUS = 20;
const TARGET_RADIUS = 18;
const BULLET_RADIUS = 5;
const PLAYER_TURN_SPEED = (Math.PI * 2) / 1.3;
const LOGICAL_GRID_COLS = 9;
const LOGICAL_GRID_ROWS = 6;
const LOGICAL_GRID_SIZE = Math.min(ARENA_WIDTH / LOGICAL_GRID_COLS, ARENA_HEIGHT / LOGICAL_GRID_ROWS);
const PLAYER_SPEED = LOGICAL_GRID_SIZE * 1.6;
const BULLET_SPEED = LOGICAL_GRID_SIZE * 1.85;
const BULLET_LIFE = 10;
const BULLET_BOUNCES = 7;
const SHOOT_COOLDOWN = 0.24;
const MAX_BULLETS = 5;
const PLAYER_RESPAWN_MS = 1000;
const DEFAULT_BULLET_DAMAGE = 23;
const SHOTGUN_DAMAGE = 9;
const MINIGUN_DAMAGE = 13;
const LASER_DAMAGE = 80;
const LAND_MINE_DAMAGE = 40;
const GUIDED_MISSILE_DAMAGE = 80;
const BULLET_SPRITE_PIXEL_RATIO = 2;
const BULLET_SPATIAL_CELL_SIZE = LOGICAL_GRID_SIZE * 0.85;
const HEAVY_PROJECTILE_THRESHOLD = 34;
const EXTREME_PROJECTILE_THRESHOLD = 48;
const SHOTGUN_PELLET_COUNT = 16;
const SHOTGUN_CONE_RADIANS = Math.PI / 6;
const SHOTGUN_MIN_SPEED = LOGICAL_GRID_SIZE * 4;
const SHOTGUN_MAX_SPEED = LOGICAL_GRID_SIZE * 4.2;
const SHOTGUN_PELLET_RADIUS = BULLET_RADIUS / 3;
const SHOTGUN_COOLDOWN = 1.5;
const SHOTGUN_AMMO = 3;
const SHOTGUN_BARREL_WIDTH = 18;
const SHOTGUN_PELLET_LIFE = 1.5;
const LASER_SPEED = LOGICAL_GRID_SIZE * 40;
const LASER_LIFE = 0.375;
const LASER_LENGTH = LOGICAL_GRID_SIZE * 2;
const LASER_AIM_LENGTH = LOGICAL_GRID_SIZE * 7;
const LASER_RADIUS = 4.4;
const LASER_COOLDOWN = 0.18;
const LASER_WALL_CLEARANCE = 7;
const LASER_VISUAL_WAKE_LENGTH = LASER_LENGTH * 3.4;
const LASER_VISUAL_HEAD_LENGTH = LASER_LENGTH * 0.74;
const FIRE_SPAWN_FORWARD_OFFSET = 12;
const FIRE_SPAWN_BACKOFF_STEPS = 18;
const MINIGUN_SPINUP_SECONDS = 0.5;
const MINIGUN_GRACE_SECONDS = 1;
const MINIGUN_FIRE_RATE = 10;
const MINIGUN_AMMO = 20;
const MINIGUN_BULLET_SPEED = LOGICAL_GRID_SIZE * 2.2;
const MINIGUN_BULLET_LIFE = 3;
const MINIGUN_BULLET_RADIUS = BULLET_RADIUS / 2;
const MINIGUN_BARREL_WIDTH = 19.5;
const MINIGUN_BARREL_OFFSET_PATTERN = [-0.5, -0.18, 0.16, 0.48, -0.34, 0.02, 0.36, -0.46, -0.08, 0.28];
const DOUBLE_BARREL_AMMO = 10;
const DOUBLE_BARREL_COOLDOWN = SHOOT_COOLDOWN / 2;
const DOUBLE_BARREL_RECOIL_MS = Math.round(DOUBLE_BARREL_COOLDOWN * 1000);
const DOUBLE_BARREL_BARREL_OFFSET = 7.2;
const MINE_AMMO = 3;
const MINE_COOLDOWN = 0.16;
const MINE_ARM_DELAY_MS = 1000;
const MINE_DETONATION_DELAY_MS = 1000;
const MINE_RADIUS = PLAYER_RADIUS * 2 / 3;
const MINE_TRIGGER_RADIUS = PLAYER_RADIUS * 1.5;
const MINE_BLAST_RADIUS = PLAYER_RADIUS * 4.95;
const MINE_FADE_START_MS = 3000;
const MINE_FADE_DURATION_MS = 2000;
const MINE_REVEAL_RATE = 6;
const GUIDED_MISSILE_AMMO = 1;
const GUIDED_MISSILE_RADIUS = BULLET_RADIUS * 1.25;
const GUIDED_MISSILE_HIT_RADIUS = BULLET_RADIUS * 0.52;
const GUIDED_MISSILE_SPEED = LOGICAL_GRID_SIZE * 1.72;
const GUIDED_MISSILE_LIFE = 10;
const GUIDED_MISSILE_COOLDOWN = 0.34;
const GUIDED_MISSILE_LOCK_DELAY = 2.5;
const GUIDED_MISSILE_TURN_RATE = Math.PI * 1.08;
const GUIDED_MISSILE_TURN_RAMP_SECONDS = 0.85;
const TOW_MISSILE_AMMO = 1;
const TOW_MISSILE_RADIUS = GUIDED_MISSILE_RADIUS;
const TOW_MISSILE_HIT_RADIUS = GUIDED_MISSILE_HIT_RADIUS;
const TOW_MISSILE_SPEED = GUIDED_MISSILE_SPEED;
const TOW_MISSILE_LIFE = GUIDED_MISSILE_LIFE - 2;
const TOW_MISSILE_COOLDOWN = GUIDED_MISSILE_COOLDOWN;
const TOW_MISSILE_TURN_RATE = Math.PI * 1.18;
const TOW_MISSILE_FADE_LIFE = 0.28;
const TOW_MISSILE_BOUNCE_SNAP_MS = 110;
const MAX_TANK_HP = 100;
const HEAL_AMOUNT = 50;
const DAMAGE_SMOKE_DELAY_MS = 500;
const SHIELD_RADIUS = PLAYER_RADIUS + 30;
const SHIELD_ACTIVE_MS = 3000;
const SHIELD_FLICKER_MS = 1500;
const SHIELD_VISIBLE_MS = SHIELD_ACTIVE_MS + SHIELD_FLICKER_MS;

const POWERUP_ICON_SOURCES: Record<string, string> = {
  cash: "/tank-trouble/powerups/cash.png",
  shotgun: "/tank-trouble/powerups/shotgun.png",
  laser: "/tank-trouble/powerups/laser.png",
  minigun: "/tank-trouble/powerups/minigun.png",
  double_barrel: "/tank-trouble/powerups/double-barrel.png",
  shield: "/tank-trouble/powerups/shield.png",
  land_mine: "/tank-trouble/powerups/land-mine.png",
  heal: "/tank-trouble/powerups/plus.png",
  guided_missile: "/tank-trouble/powerups/missile.png",
  tow_missile: "/tank-trouble/powerups/tow-missile.png",
};

const DEFAULT_CUSTOM_OPTIONS: TankTroubleCustomOptions = {
  health_system: false,
  persistent_buffs: false,
  same_place_respawn: false,
};

const LOCAL_TEST_CUSTOM_OPTIONS: TankTroubleCustomOptions = {
  health_system: true,
  persistent_buffs: true,
  same_place_respawn: true,
};

const CUSTOM_OPTION_ITEMS: Array<{ key: keyof TankTroubleCustomOptions; label: string }> = [
  { key: "health_system", label: "血量系统" },
  { key: "persistent_buffs", label: "BUFF常驻" },
  { key: "same_place_respawn", label: "原地重生" },
];

function defaultCustomOptions(): TankTroubleCustomOptions {
  return { ...DEFAULT_CUSTOM_OPTIONS };
}

function localTestCustomOptions(): TankTroubleCustomOptions {
  return { ...LOCAL_TEST_CUSTOM_OPTIONS };
}

const SCOREBOARD_RANK_ICON_SOURCES: Record<number, string> = {
  1: "/tank-trouble/scoreboard/rank-1.png",
  2: "/tank-trouble/scoreboard/rank-2.png",
  3: "/tank-trouble/scoreboard/rank-3.png",
};

const powerupIconCache = new Map<string, HTMLImageElement>();
const TARGET_COUNT = 6;
const SCOREBOARD_LIMIT = 10;
const SELF_HIT_ARM_DELAY = 0.16;
const SCOREBOARD_WIDTH = 252;
const SCOREBOARD_DOCK_THRESHOLD = 0.2;
const SCOREBOARD_UNDOCK_THRESHOLD = 0.13;
const PLAYER_COLLISION_PADDING = 0.75;
const BOT_PLAYER_ID = "CPU-1";
const BOT_PLAYER_COLOR = "red";
const BOT_TARGET_CLOSE_DISTANCE = 144;
const BOT_TARGET_FAR_DISTANCE = 288;
const BOT_FIRE_DISTANCE = 620;
const BOT_FIRE_ANGLE_THRESHOLD = 0.22;
const BOT_MOVE_ANGLE_THRESHOLD = 0.62;
const BOT_STUCK_THRESHOLD_SEC = 0.28;
const BOT_REVERSE_DURATION_SEC = 0.4;
const COLOR_BLOCK_SHAKE_MS = 420;
const CONTROL_ACTIONS: ControlAction[] = ["forward", "backward", "left", "right", "fire"];
const DEFAULT_CONTROL_BINDINGS: ControlBindings = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  fire: "Space",
};
const CONTROL_BINDING_ITEMS: Array<{ action: ControlAction; label: string }> = [
  { action: "forward", label: "前进" },
  { action: "backward", label: "后退" },
  { action: "left", label: "左转" },
  { action: "right", label: "右转" },
  { action: "fire", label: "开火" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function stringHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function smoothStep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function distance(aX: number, aY: number, bX: number, bY: number) {
  return Math.hypot(aX - bX, aY - bY);
}

function squaredDistance(aX: number, aY: number, bX: number, bY: number) {
  const dx = aX - bX;
  const dy = aY - bY;
  return dx * dx + dy * dy;
}

function shortestAngleDelta(from: number, to: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shouldSpawnProjectileSmoke(projectileType?: string) {
  const normalizedType = String(projectileType || "bullet");
  return normalizedType !== "laser" && normalizedType !== "guided_missile" && normalizedType !== "tow_missile";
}

function isSteeredMissileType(projectileType?: string) {
  const normalizedType = String(projectileType || "bullet");
  return normalizedType === "guided_missile" || normalizedType === "tow_missile";
}

function isTowMissileType(projectileType?: string) {
  return String(projectileType || "bullet") === "tow_missile";
}

function isTowMissileWeapon(weapon?: string) {
  const normalizedWeapon = String(weapon || "default");
  return normalizedWeapon === "tow_missile" || normalizedWeapon === "tow_missile_active";
}

function createBulletSmokeEffect(fade: BulletFade, seed: number): BulletSmokeEffect {
  const rng = createSeededRandom(seed || 1);
  const puffs: BulletSmokePuff[] = [];
  const puffCount = 4;
  for (let index = 0; index < puffCount; index += 1) {
    const angle = rng() * Math.PI * 2;
    const distanceScale = 0.18 + rng() * 0.78;
    const baseRadius = Math.max(1.8, fade.radius);
    puffs.push({
      offsetX: Math.cos(angle) * baseRadius * distanceScale,
      offsetY: Math.sin(angle) * baseRadius * distanceScale,
      driftX: Math.cos(angle) * (3.4 + rng() * 7.5) + fade.vx * 0.12,
      driftY: Math.sin(angle) * (3.4 + rng() * 7.5) + fade.vy * 0.12,
      radius: baseRadius * (0.72 + rng() * 0.72),
      alpha: 0.16 + rng() * 0.11,
    });
  }

  return {
    id: fade.id,
    x: fade.x,
    y: fade.y,
    radius: Math.max(2, fade.radius),
    vx: fade.vx * 0.22,
    vy: fade.vy * 0.22,
    life: 0.34,
    maxLife: 0.34,
    puffs,
  };
}

function advanceBulletSmokeEffects(effects: BulletSmokeEffect[], dt: number) {
  return effects
    .map((effect) => ({
      ...effect,
      x: effect.x + effect.vx * dt,
      y: effect.y + effect.vy * dt,
      life: effect.life - dt,
    }))
    .filter((effect) => effect.life > 0);
}

function advanceBulletFadesWithSmoke(
  fades: BulletFade[],
  dt: number,
  onSmoke: (fade: BulletFade) => void,
) {
  const nextFades: BulletFade[] = [];
  for (const fade of fades) {
    const nextFade = {
      ...fade,
      x: fade.x + fade.vx * dt,
      y: fade.y + fade.vy * dt,
      age: Number(fade.age || 0) + dt,
      life: fade.life - dt,
    };
    if (nextFade.life > 0) {
      nextFades.push(nextFade);
    } else if (shouldSpawnProjectileSmoke(nextFade.projectileType)) {
      onSmoke(nextFade);
    }
  }
  return nextFades;
}

function drawBulletSmokeEffects(
  ctx: CanvasRenderingContext2D,
  effects: BulletSmokeEffect[],
  theme: "light" | "dark",
) {
  const darkMode = theme === "dark";
  for (const effect of effects) {
    const progress = clamp(1 - effect.life / effect.maxLife, 0, 1);
    const alpha = (1 - smoothStep(progress)) * (darkMode ? 0.88 : 0.78);
    ctx.save();
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    for (const puff of effect.puffs) {
      const x = effect.x + puff.offsetX + puff.driftX * progress;
      const y = effect.y + puff.offsetY + puff.driftY * progress;
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

function minigunLateralOffset(ammoBeforeShot: number) {
  const shotIndex = Math.max(0, MINIGUN_AMMO - Math.max(0, Math.round(ammoBeforeShot)));
  const pattern = MINIGUN_BARREL_OFFSET_PATTERN[shotIndex % MINIGUN_BARREL_OFFSET_PATTERN.length] ?? 0;
  return pattern * MINIGUN_BARREL_WIDTH;
}

function doubleBarrelShotIndex(ammoBeforeShot: number) {
  return Math.max(0, DOUBLE_BARREL_AMMO - Math.max(0, Math.round(ammoBeforeShot)));
}

function doubleBarrelLateralOffset(ammoBeforeShot: number) {
  return (doubleBarrelShotIndex(ammoBeforeShot) % 2 === 0 ? -1 : 1) * DOUBLE_BARREL_BARREL_OFFSET;
}

function doubleBarrelLastShotOffset(ammoRemaining: number) {
  if (ammoRemaining >= DOUBLE_BARREL_AMMO) {
    return 0;
  }
  const lastShotIndex = Math.max(0, DOUBLE_BARREL_AMMO - Math.max(0, Math.round(ammoRemaining)) - 1);
  return (lastShotIndex % 2 === 0 ? -1 : 1) * DOUBLE_BARREL_BARREL_OFFSET;
}

function shotgunPumpProgress(reloadMs: number) {
  if (reloadMs <= 0) {
    return 0;
  }
  const elapsedRatio = 1 - clamp(reloadMs / (SHOTGUN_COOLDOWN * 1000), 0, 1);
  if (elapsedRatio < 0.18) {
    return smoothStep(elapsedRatio / 0.18);
  }
  if (elapsedRatio < 0.46) {
    return 1 - smoothStep((elapsedRatio - 0.18) / 0.28);
  }
  return 0;
}

function doubleBarrelRecoilProgress(reloadMs: number) {
  if (reloadMs <= 0) {
    return 0;
  }
  return smoothStep(clamp(reloadMs / DOUBLE_BARREL_RECOIL_MS, 0, 1));
}

function createEmptySnapshot(): TankTroubleSnapshot {
  return {
    score: 0,
    shots: 0,
    hits: 0,
    bullets: 0,
    ricochets: 0,
    deaths: 0,
    elapsedMs: 0,
    mapTag: "--",
    targetsRemaining: TARGET_COUNT,
  };
}

function circleIntersectsRect(circle: Circle, rect: Rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  return squaredDistance(circle.x, circle.y, closestX, closestY) < circle.radius * circle.radius;
}

function pointInsideWall(x: number, y: number, radius: number, walls: Rect[]) {
  return walls.some((wall) => circleIntersectsRect({ x, y, radius }, wall));
}

function wallCellKey(col: number, row: number) {
  return `${col}:${row}`;
}

function buildWallSpatialIndex(walls: Rect[]): WallSpatialIndex {
  const cells = new Map<string, Rect[]>();
  for (const wall of walls) {
    const minCol = Math.floor((wall.x - ARENA_X) / BULLET_SPATIAL_CELL_SIZE);
    const maxCol = Math.floor((wall.x + wall.w - ARENA_X) / BULLET_SPATIAL_CELL_SIZE);
    const minRow = Math.floor((wall.y - ARENA_Y) / BULLET_SPATIAL_CELL_SIZE);
    const maxRow = Math.floor((wall.y + wall.h - ARENA_Y) / BULLET_SPATIAL_CELL_SIZE);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const key = wallCellKey(col, row);
        const bucket = cells.get(key);
        if (bucket) {
          bucket.push(wall);
        } else {
          cells.set(key, [wall]);
        }
      }
    }
  }
  return { walls, cells };
}

function queryNearbyWalls(index: WallSpatialIndex | null | undefined, x: number, y: number, radius: number) {
  if (!index) {
    return [] as Rect[];
  }
  const minCol = Math.floor((x - radius - ARENA_X) / BULLET_SPATIAL_CELL_SIZE);
  const maxCol = Math.floor((x + radius - ARENA_X) / BULLET_SPATIAL_CELL_SIZE);
  const minRow = Math.floor((y - radius - ARENA_Y) / BULLET_SPATIAL_CELL_SIZE);
  const maxRow = Math.floor((y + radius - ARENA_Y) / BULLET_SPATIAL_CELL_SIZE);
  const walls: Rect[] = [];
  const seen = new Set<Rect>();
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const bucket = index.cells.get(wallCellKey(col, row));
      if (!bucket) {
        continue;
      }
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

function pushOutOfWall(x: number, y: number, angle: number, radius: number, walls: Rect[]) {
  let candidateX = x;
  let candidateY = y;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  for (let index = 0; index < 10; index += 1) {
    let moved = false;
    for (const wall of walls) {
      if (!circleIntersectsRect({ x: candidateX, y: candidateY, radius }, wall)) {
        continue;
      }
      const closestX = clamp(candidateX, wall.x, wall.x + wall.w);
      const closestY = clamp(candidateY, wall.y, wall.y + wall.h);
      let normalX = candidateX - closestX;
      let normalY = candidateY - closestY;
      let normalLength = Math.hypot(normalX, normalY);
      if (normalLength <= 0.0001) {
        const distances = [
          { value: Math.abs(candidateX - wall.x), normalX: -1, normalY: 0 },
          { value: Math.abs(wall.x + wall.w - candidateX), normalX: 1, normalY: 0 },
          { value: Math.abs(candidateY - wall.y), normalX: 0, normalY: -1 },
          { value: Math.abs(wall.y + wall.h - candidateY), normalX: 0, normalY: 1 },
        ].sort((left, right) => left.value - right.value);
        normalX = distances[0]?.normalX ?? -dx;
        normalY = distances[0]?.normalY ?? -dy;
        normalLength = 1;
      }
      normalX /= normalLength;
      normalY /= normalLength;
      const penetration = radius - distance(candidateX, candidateY, closestX, closestY);
      if (penetration <= 0) {
        continue;
      }
      candidateX += normalX * (penetration + 1.5);
      candidateY += normalY * (penetration + 1.5);
      moved = true;
    }
    if (!moved) {
      break;
    }
  }

  if (pointInsideWall(candidateX, candidateY, radius, walls)) {
    return { x: x - dx * (radius + 2), y: y - dy * (radius + 2) };
  }
  return { x: candidateX, y: candidateY };
}

function safeFireSpawnPoint(
  tank: Pick<PlayerTank, "x" | "y" | "radius" | "angle">,
  walls: Rect[],
  projectileRadius: number,
  lateralOffset = 0,
) {
  const dx = Math.cos(tank.angle);
  const dy = Math.sin(tank.angle);
  const sideX = Math.cos(tank.angle + Math.PI / 2);
  const sideY = Math.sin(tank.angle + Math.PI / 2);
  const startForward = tank.radius + FIRE_SPAWN_FORWARD_OFFSET + projectileRadius;
  const minimumForward = tank.radius + projectileRadius + 2;
  const stepSize = Math.max(1, (startForward - minimumForward) / FIRE_SPAWN_BACKOFF_STEPS);

  for (let index = 0; index <= FIRE_SPAWN_BACKOFF_STEPS; index += 1) {
    const forward = Math.max(minimumForward, startForward - index * stepSize);
    const x = tank.x + dx * forward + sideX * lateralOffset;
    const y = tank.y + dy * forward + sideY * lateralOffset;
    if (!pointInsideWall(x, y, projectileRadius + 1, walls)) {
      return { x, y };
    }
  }

  return pushOutOfWall(
    tank.x + dx * minimumForward + sideX * lateralOffset,
    tank.y + dy * minimumForward + sideY * lateralOffset,
    tank.angle,
    projectileRadius + 1,
    walls,
  );
}

function resetTankWeaponState(
  tank: Pick<PlayerTank, "weapon" | "shotgunAmmo" | "minigunAmmo" | "doubleBarrelAmmo" | "mineAmmo" | "missileAmmo" | "weaponReloadMs">,
) {
  tank.weapon = "default";
  tank.shotgunAmmo = 0;
  tank.minigunAmmo = 0;
  tank.doubleBarrelAmmo = 0;
  tank.mineAmmo = 0;
  tank.missileAmmo = 0;
  tank.weaponReloadMs = 0;
}

function rayRectHit(x: number, y: number, dx: number, dy: number, rect: Rect) {
  const epsilon = 0.0001;
  const candidates: Array<{ t: number; normalX: number; normalY: number }> = [];

  if (Math.abs(dx) > epsilon) {
    for (const [edgeX, nx] of [
      [rect.x, -1],
      [rect.x + rect.w, 1],
    ] as const) {
      const t = (edgeX - x) / dx;
      if (t <= epsilon) {
        continue;
      }
      const hitY = y + dy * t;
      if (hitY >= rect.y - epsilon && hitY <= rect.y + rect.h + epsilon) {
        candidates.push({ t, normalX: nx, normalY: 0 });
      }
    }
  }

  if (Math.abs(dy) > epsilon) {
    for (const [edgeY, ny] of [
      [rect.y, -1],
      [rect.y + rect.h, 1],
    ] as const) {
      const t = (edgeY - y) / dy;
      if (t <= epsilon) {
        continue;
      }
      const hitX = x + dx * t;
      if (hitX >= rect.x - epsilon && hitX <= rect.x + rect.w + epsilon) {
        candidates.push({ t, normalX: 0, normalY: ny });
      }
    }
  }

  if (!candidates.length) {
    return null;
  }
  const nearestT = Math.min(...candidates.map((candidate) => candidate.t));
  let normalX = 0;
  let normalY = 0;
  for (const candidate of candidates) {
    if (Math.abs(candidate.t - nearestT) > 0.001) {
      continue;
    }
    normalX = candidate.normalX || normalX;
    normalY = candidate.normalY || normalY;
  }
  return { t: nearestT, normalX, normalY };
}

function rayArenaBoundsHit(x: number, y: number, dx: number, dy: number) {
  const epsilon = 0.0001;
  const insideArena =
    x >= ARENA_X - epsilon &&
    x <= ARENA_X + ARENA_WIDTH + epsilon &&
    y >= ARENA_Y - epsilon &&
    y <= ARENA_Y + ARENA_HEIGHT + epsilon;
  if (!insideArena) {
    return null;
  }

  const candidates: Array<{ t: number; normalX: number; normalY: number }> = [];
  if (Math.abs(dx) > epsilon) {
    for (const [edgeX, normalX] of [
      [ARENA_X, 1],
      [ARENA_X + ARENA_WIDTH, -1],
    ] as const) {
      const t = (edgeX - x) / dx;
      if (t <= epsilon) {
        continue;
      }
      const hitY = y + dy * t;
      if (hitY >= ARENA_Y - epsilon && hitY <= ARENA_Y + ARENA_HEIGHT + epsilon) {
        candidates.push({ t, normalX, normalY: 0 });
      }
    }
  }
  if (Math.abs(dy) > epsilon) {
    for (const [edgeY, normalY] of [
      [ARENA_Y, 1],
      [ARENA_Y + ARENA_HEIGHT, -1],
    ] as const) {
      const t = (edgeY - y) / dy;
      if (t <= epsilon) {
        continue;
      }
      const hitX = x + dx * t;
      if (hitX >= ARENA_X - epsilon && hitX <= ARENA_X + ARENA_WIDTH + epsilon) {
        candidates.push({ t, normalX: 0, normalY });
      }
    }
  }

  if (!candidates.length) {
    return null;
  }
  const nearestT = Math.min(...candidates.map((candidate) => candidate.t));
  let normalX = 0;
  let normalY = 0;
  for (const candidate of candidates) {
    if (Math.abs(candidate.t - nearestT) > 0.001) {
      continue;
    }
    normalX = candidate.normalX || normalX;
    normalY = candidate.normalY || normalY;
  }
  return { t: nearestT, normalX, normalY };
}

function rayCircleHit(x: number, y: number, dx: number, dy: number, centerX: number, centerY: number, radius: number) {
  const originX = x - centerX;
  const originY = y - centerY;
  const b = originX * dx + originY * dy;
  const c = originX * originX + originY * originY - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) {
    return null;
  }
  const root = Math.sqrt(discriminant);
  const hits = [-b - root, -b + root].filter((value) => value > 0.0001);
  if (!hits.length) {
    return null;
  }
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

function segmentCircleCollision(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  centerX: number,
  centerY: number,
  radius: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const a = dx * dx + dy * dy;
  if (a <= 0.001) {
    if (distance(x1, y1, centerX, centerY) >= radius) {
      return null;
    }
    let normalX = x1 - centerX;
    let normalY = y1 - centerY;
    const normalLength = Math.max(0.0001, Math.hypot(normalX, normalY));
    normalX /= normalLength;
    normalY /= normalLength;
    return { t: 0, x: x1, y: y1, normalX, normalY };
  }

  const originX = x1 - centerX;
  const originY = y1 - centerY;
  const b = 2 * (originX * dx + originY * dy);
  const c = originX * originX + originY * originY - radius * radius;
  const discriminant = b * b - 4 * a * c;
  const candidates: number[] = [];
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    for (const value of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) {
      if (value >= 0 && value <= 1) {
        candidates.push(value);
      }
    }
  }
  if (!candidates.length && c < 0) {
    candidates.push(0);
  }
  if (!candidates.length) {
    return null;
  }

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
  return {
    t,
    x: hitX,
    y: hitY,
    normalX: normalX / normalLength,
    normalY: normalY / normalLength,
  };
}

function buildReflectedRaySegments(
  startX: number,
  startY: number,
  angle: number,
  maxLength: number,
  walls: Rect[],
  maxBounces = 5,
  shields: ShieldCollider[] = [],
): AimSegment[] {
  const segments: AimSegment[] = [];
  let x = startX;
  let y = startY;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let remaining = maxLength;

  for (let bounce = 0; bounce <= maxBounces && remaining > 0.5; bounce += 1) {
    let nearest: (ReturnType<typeof rayRectHit> & { kind?: "wall" | "shield" }) | null = null;
    const arenaHit = rayArenaBoundsHit(x, y, dx, dy);
    if (arenaHit && arenaHit.t <= remaining) {
      nearest = { ...arenaHit, kind: "wall" };
    }
    for (const wall of walls) {
      const hit = rayRectHit(x, y, dx, dy, wall);
      if (hit && hit.t <= remaining && (!nearest || hit.t < nearest.t)) {
        nearest = { ...hit, kind: "wall" };
      }
    }
    for (const shield of shields) {
      const shieldCoreRadius = Number(shield.shieldRadius || SHIELD_RADIUS);
      const shieldRadius = shieldCoreRadius + LASER_RADIUS;
      if (distance(x, y, shield.x, shield.y) < shieldCoreRadius - 0.5) {
        continue;
      }
      const hit = rayCircleHit(
        x,
        y,
        dx,
        dy,
        shield.x,
        shield.y,
        shieldRadius,
      );
      if (hit && hit.t <= remaining && (!nearest || hit.t < nearest.t)) {
        nearest = { ...hit, kind: "shield" };
      }
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
    if (nearest.kind !== "shield" && nearest.normalY) {
      dy *= -1;
    }
    x = hitX + dx * clearance;
    y = hitY + dy * clearance;
    remaining -= clearance;
  }

  return segments;
}

function buildReverseReflectedSegments(
  headX: number,
  headY: number,
  vx: number,
  vy: number,
  length: number,
  walls: Rect[],
  maxBounces = 5,
): AimSegment[] {
  const speed = Math.hypot(vx, vy) || 1;
  const reverseAngle = Math.atan2(-vy / speed, -vx / speed);
  const reversed = buildReflectedRaySegments(headX, headY, reverseAngle, length, walls, maxBounces);
  return reversed
    .map((segment) => ({ x1: segment.x2, y1: segment.y2, x2: segment.x1, y2: segment.y1 }))
    .reverse();
}

function pathSegmentsLength(pathSegments: AimSegment[]) {
  return pathSegments.reduce(
    (total, segment) => total + distance(segment.x1, segment.y1, segment.x2, segment.y2),
    0,
  );
}

function slicePathSegments(pathSegments: AimSegment[], startDistance: number, length: number): AimSegment[] {
  const totalLength = pathSegmentsLength(pathSegments);
  if (totalLength <= 0.001 || length <= 0.001) {
    return [];
  }

  const visible: AimSegment[] = [];
  let cursor = 0;
  const visibleLength = Math.min(length, totalLength);
  const safeStartDistance = clamp(startDistance, 0, Math.max(0, totalLength - visibleLength));
  const endDistance = safeStartDistance + visibleLength;

  for (const segment of pathSegments) {
    const segmentLength = distance(segment.x1, segment.y1, segment.x2, segment.y2);
    if (segmentLength <= 0.001) {
      continue;
    }

    const segmentStart = cursor;
    const segmentEnd = cursor + segmentLength;
    cursor = segmentEnd;
    if (segmentEnd <= safeStartDistance) {
      continue;
    }
    if (segmentStart >= endDistance) {
      break;
    }

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

function buildLaserVisualSegments(
  pathSegments: AimSegment[],
  distanceTravelled: number,
  age: number,
  life: number,
) {
  const totalLength = pathSegmentsLength(pathSegments);
  if (totalLength <= 0.001) {
    return { wakeSegments: [] as AimSegment[], headSegments: [] as AimSegment[], alpha: 0 };
  }

  const lifeProgress = LASER_LIFE > 0 ? clamp(age / LASER_LIFE, 0, 1) : 1;
  const serverProgress = clamp(distanceTravelled / Math.max(1, totalLength), 0, 1);
  const easedProgress = 1 - Math.pow(1 - lifeProgress, 2.15);
  const headDistance = clamp(
    Math.max(serverProgress, easedProgress) * totalLength,
    LASER_VISUAL_HEAD_LENGTH,
    totalLength,
  );
  const wakeStart = Math.max(0, headDistance - LASER_VISUAL_WAKE_LENGTH);
  const headStart = Math.max(0, headDistance - LASER_VISUAL_HEAD_LENGTH);
  const fadeByAge = 1 - smoothStep((lifeProgress - 0.72) / 0.28);
  const fadeByLife = life > 0 ? smoothStep(clamp(life / Math.min(LASER_LIFE, 0.16), 0, 1)) : 0;
  const alpha = clamp(Math.min(fadeByAge, fadeByLife), 0, 1);

  return {
    wakeSegments: slicePathSegments(pathSegments, wakeStart, headDistance - wakeStart),
    headSegments: slicePathSegments(pathSegments, headStart, headDistance - headStart),
    alpha,
  };
}

function rectsIntersect(a: Rect, b: Rect, padding = 0) {
  return (
    a.x < b.x + b.w + padding &&
    a.x + a.w > b.x - padding &&
    a.y < b.y + b.h + padding &&
    a.y + a.h > b.y - padding
  );
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + w - safeRadius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + safeRadius);
  ctx.lineTo(x + w, y + h - safeRadius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - safeRadius, y + h);
  ctx.lineTo(x + safeRadius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function loadStoredPlayerId() {
  try {
    return window.localStorage.getItem(STORAGE_PLAYER_ID_KEY) ?? "";
  } catch {
    return "";
  }
}

function storePlayerId(playerId: string) {
  try {
    window.localStorage.setItem(STORAGE_PLAYER_ID_KEY, playerId);
  } catch {
    return;
  }
}

function createPlayerIdSuffix() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID().slice(0, 4);
  }
  return Math.random().toString(36).slice(2, 6);
}

function resolveJoinPlayerId(basePlayerId: string, roomState: TankTroubleRoomState | null | undefined) {
  const normalized = basePlayerId.trim();
  const activeIds = new Set((roomState?.active_player_ids || []).map((entry) => String(entry || "").trim()));
  if (!activeIds.has(normalized)) {
    return normalized;
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `${normalized}-${createPlayerIdSuffix()}`.slice(0, 24);
    if (!activeIds.has(candidate)) {
      return candidate;
    }
  }
  return `${normalized}-${Date.now().toString(36).slice(-4)}`.slice(0, 24);
}

function normalizeControlBindings(value: unknown): ControlBindings {
  const parsed = value && typeof value === "object" ? (value as Partial<ControlBindings>) : {};
  const next: ControlBindings = { ...DEFAULT_CONTROL_BINDINGS };
  const used = new Set<string>();

  for (const action of CONTROL_ACTIONS) {
    const candidate = String(parsed[action] || DEFAULT_CONTROL_BINDINGS[action] || "").trim();
    if (!candidate || used.has(candidate)) {
      next[action] = DEFAULT_CONTROL_BINDINGS[action];
    } else {
      next[action] = candidate;
    }
    used.add(next[action]);
  }

  return next;
}

function loadStoredControlBindings(): ControlBindings {
  try {
    const raw = window.localStorage.getItem(STORAGE_CONTROL_BINDINGS_KEY);
    return normalizeControlBindings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_CONTROL_BINDINGS };
  }
}

function storeControlBindings(bindings: ControlBindings) {
  try {
    window.localStorage.setItem(STORAGE_CONTROL_BINDINGS_KEY, JSON.stringify(bindings));
  } catch {
    return;
  }
}

function formatKeyCode(code: string) {
  if (code === "Space") {
    return "Space";
  }
  if (code.startsWith("Key")) {
    return code.slice(3);
  }
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }
  if (code === "ArrowUp") {
    return "↑";
  }
  if (code === "ArrowDown") {
    return "↓";
  }
  if (code === "ArrowLeft") {
    return "←";
  }
  if (code === "ArrowRight") {
    return "→";
  }
  return code.replace(/^Numpad/, "Num ");
}

function findControlActionByCode(bindings: ControlBindings, code: string): ControlAction | null {
  for (const action of CONTROL_ACTIONS) {
    if (bindings[action] === code) {
      return action;
    }
  }
  return null;
}

function normalizeCountryCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

function buildCircleFlagUrl(countryCode: string) {
  const code = normalizeCountryCode(countryCode);
  if (!code) {
    return "";
  }
  return `/flags/${code}.svg`;
}

function truncatePlayerIdLabel(playerId: string) {
  const normalized = String(playerId || "").trim();
  if (normalized.length <= 10) {
    return normalized;
  }
  return `${normalized.slice(0, 10)}...`;
}

function getVoteDotColor(playerColor: string) {
  switch (String(playerColor || "").trim().toLowerCase()) {
    case "red":
      return "#ef4444";
    case "yellow":
      return "#f59e0b";
    case "blue":
      return "#3b82f6";
    default:
      return "#22c55e";
  }
}

function normalizeLatencyMs(value: unknown) {
  const latencyMs = Number(value ?? 0);
  if (!Number.isFinite(latencyMs) || latencyMs <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(9999, Math.round(latencyMs)));
}

function latencyClassName(latencyMs?: number) {
  const normalized = normalizeLatencyMs(latencyMs);
  if (!normalized) {
    return "unknown";
  }
  if (normalized <= 50) {
    return "good";
  }
  if (normalized <= 150) {
    return "warn";
  }
  return "bad";
}

function formatLatencyLabel(latencyMs?: number) {
  const normalized = normalizeLatencyMs(latencyMs);
  return normalized ? `${normalized}ms` : "--ms";
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function resolveGameColor(value: string | undefined, theme: "light" | "dark", fallback = "#f8fafc") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }
  if (normalized.startsWith("#")) {
    return normalized;
  }
  return getPlayerPalette(normalized, theme).bright;
}

function mixHexColors(from: string, to: string, amount: number) {
  const read = (value: string) => {
    const normalized = String(value || "#ffffff").replace("#", "");
    const padded = (normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized).padEnd(6, "f");
    return {
      r: Number.parseInt(padded.slice(0, 2), 16) || 0,
      g: Number.parseInt(padded.slice(2, 4), 16) || 0,
      b: Number.parseInt(padded.slice(4, 6), 16) || 0,
    };
  };
  const source = read(from);
  const target = read(to);
  const t = clamp(amount, 0, 1);
  const channel = (start: number, end: number) => Math.round(start + (end - start) * t).toString(16).padStart(2, "0");
  return `#${channel(source.r, target.r)}${channel(source.g, target.g)}${channel(source.b, target.b)}`;
}

function getPlayerPalette(playerColor: string, theme: "light" | "dark") {
  const normalized = String(playerColor || "").trim().toLowerCase();
  let baseColor = "#22c55e";
  let brightColor = theme === "dark" ? "#86efac" : "#16a34a";

  if (normalized.startsWith("#")) {
    baseColor = normalized;
    brightColor = normalized;
  } else if (normalized === "red") {
    baseColor = "#ef4444";
    brightColor = theme === "dark" ? "#fca5a5" : "#dc2626";
  } else if (normalized === "blue") {
    baseColor = "#3b82f6";
    brightColor = theme === "dark" ? "#93c5fd" : "#2563eb";
  } else if (normalized === "yellow") {
    baseColor = "#f59e0b";
    brightColor = theme === "dark" ? "#fde68a" : "#d97706";
  }

  return {
    base: baseColor,
    bright: brightColor,
    glow: hexToRgba(baseColor, theme === "dark" ? 0.48 : 0.34),
    halo: hexToRgba(brightColor, theme === "dark" ? 0.2 : 0.14),
    flash: hexToRgba(brightColor, theme === "dark" ? 0.9 : 0.76),
    ripple: hexToRgba(brightColor, theme === "dark" ? 0.72 : 0.58),
  };
}

function normalizeMineState(mine: TankTroubleMineState, fallbackVisibleAlpha = 1): LandMine {
  const createdAtMs = Number(mine.created_at_ms || 0);
  const serverTimeMs = Number(mine.server_time_ms || Date.now());
  const age = Math.max(0, Number(mine.age ?? (createdAtMs ? (serverTimeMs - createdAtMs) / 1000 : 0)));
  return {
    id: Number(mine.id || 0),
    ownerId: String(mine.owner_id || ""),
    color: String(mine.color || "green"),
    x: Number(mine.x || 0),
    y: Number(mine.y || 0),
    radius: Math.max(1, Number(mine.radius || MINE_RADIUS)),
    triggerRadius: Math.max(1, Number(mine.trigger_radius || MINE_TRIGGER_RADIUS)),
    blastRadius: Math.max(1, Number(mine.blast_radius || MINE_BLAST_RADIUS)),
    age,
    armed: Boolean(mine.armed),
    triggered: Boolean(mine.triggered),
    triggerStartedAtMs: Number(mine.trigger_started_at_ms || 0),
    createdAtMs,
    serverTimeMs,
    visibleAlpha: clamp(fallbackVisibleAlpha, 0, 1),
    fireSeq: Number(mine.fire_seq || 0) || undefined,
  };
}

function serializeMineState(mine: LandMine, nowMs = Date.now()): TankTroubleMineState {
  const createdAtMs = Number(mine.createdAtMs || nowMs);
  const age = Math.max(0, Number(mine.age || 0));
  return {
    id: mine.id,
    owner_id: mine.ownerId,
    color: mine.color,
    x: mine.x,
    y: mine.y,
    radius: mine.radius,
    trigger_radius: mine.triggerRadius,
    blast_radius: mine.blastRadius,
    age,
    armed: mine.armed || age * 1000 >= MINE_ARM_DELAY_MS,
    triggered: mine.triggered,
    trigger_started_at_ms: mine.triggerStartedAtMs || 0,
    created_at_ms: createdAtMs,
    fire_seq: mine.fireSeq,
    server_time_ms: nowMs,
  };
}

function defaultMineAlphaForAge(ageSeconds: number) {
  const ageMs = Math.max(0, ageSeconds * 1000);
  if (ageMs <= MINE_FADE_START_MS) {
    return 1;
  }
  return clamp(1 - (ageMs - MINE_FADE_START_MS) / MINE_FADE_DURATION_MS, 0, 1);
}

function drawLandMine(
  ctx: CanvasRenderingContext2D,
  mine: Pick<LandMine, "x" | "y" | "radius" | "triggerRadius" | "color" | "age" | "armed" | "triggered" | "visibleAlpha" | "id">,
  theme: "light" | "dark",
  elapsedMs: number,
  options: { compact?: boolean } = {},
) {
  const alpha = clamp(Number(mine.visibleAlpha ?? defaultMineAlphaForAge(mine.age || 0)), 0, 1);
  if (alpha <= 0.012) {
    return;
  }

  const darkMode = theme === "dark";
  const palette = getPlayerPalette(mine.color || "green", theme);
  const radius = Math.max(1, Number(mine.radius || MINE_RADIUS));
  const triggerRadius = Math.max(radius, Number(mine.triggerRadius || MINE_TRIGGER_RADIUS));
  const armed = Boolean(mine.armed);
  const triggered = Boolean(mine.triggered);
  const blinkFrequency = triggered ? 5 : armed ? 1 : 0;
  const blink = blinkFrequency > 0 ? 0.28 + 0.72 * Math.max(0, Math.sin((elapsedMs / 1000) * Math.PI * 2 * blinkFrequency)) : 0.2;
  const lampAlpha = clamp((triggered ? 0.82 : armed ? 0.62 : 0.24) * blink + (triggered ? 0.18 : 0.08), 0, 1);
  const bodyTop = darkMode ? "#d1d5db" : "#f1f5f9";
  const bodyMid = darkMode ? "#64748b" : "#94a3b8";
  const bodyBottom = darkMode ? "#1f2937" : "#475569";
  const ringStroke = darkMode ? "rgba(226, 232, 240, 0.44)" : "rgba(15, 23, 42, 0.2)";

  ctx.save();
  ctx.translate(mine.x, mine.y);
  ctx.globalAlpha = alpha;

  if (!options.compact && (armed || triggered || alpha > 0.45)) {
    ctx.save();
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    ctx.beginPath();
    ctx.arc(0, 0, triggerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(palette.bright, (triggered ? 0.24 : 0.08) * alpha * (0.65 + blink * 0.35));
    ctx.lineWidth = triggered ? 2.6 : 1.1;
    ctx.setLineDash(triggered ? [7, 7] : [3, 9]);
    ctx.lineDashOffset = -elapsedMs * (triggered ? 0.05 : 0.015);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = triggered ? palette.glow : darkMode ? "rgba(148, 163, 184, 0.42)" : "rgba(15, 23, 42, 0.2)";
  ctx.shadowBlur = triggered ? 18 : 8;
  const bodyGradient = ctx.createRadialGradient(-radius * 0.36, -radius * 0.42, radius * 0.12, 0, 0, radius * 1.15);
  bodyGradient.addColorStop(0, bodyTop);
  bodyGradient.addColorStop(0.48, bodyMid);
  bodyGradient.addColorStop(1, bodyBottom);
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1.1, radius * 0.12);
  ctx.strokeStyle = ringStroke;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = darkMode ? "rgba(15, 23, 42, 0.68)" : "rgba(30, 41, 59, 0.34)";
  ctx.lineWidth = Math.max(1, radius * 0.075);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2 + (mine.id || 0) * 0.11;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * radius * 0.22, Math.sin(angle) * radius * 0.22);
    ctx.lineTo(Math.cos(angle) * radius * 0.63, Math.sin(angle) * radius * 0.63);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 12 * lampAlpha;
  ctx.fillStyle = hexToRgba(palette.bright, lampAlpha);
  ctx.beginPath();
  ctx.arc(0, -radius * 0.05, Math.max(2.2, radius * 0.21 + (triggered ? blink * 1.2 : 0)), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = darkMode ? "rgba(248, 250, 252, 0.86)" : "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(-radius * 0.07, -radius * 0.12, Math.max(0.8, radius * 0.055), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (triggered) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = hexToRgba(palette.bright, 0.18 + blink * 0.28);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (1.3 + blink * 0.55), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawMines(
  ctx: CanvasRenderingContext2D,
  mines: LandMine[],
  theme: "light" | "dark",
  elapsedMs: number,
) {
  for (const mine of mines) {
    drawLandMine(ctx, mine, theme, elapsedMs);
  }
}

function advanceMinesVisuals(
  mines: LandMine[],
  tanks: Array<Pick<PlayerTank, "x" | "y" | "radius"> & { alive?: boolean }>,
  dt: number,
) {
  return mines.map((mine) => {
    const age = Math.max(0, Number(mine.age || 0) + dt);
    const armed = mine.armed || age * 1000 >= MINE_ARM_DELAY_MS;
    const nearTank = tanks.some((tank) => {
      if (tank.alive === false) {
        return false;
      }
      return distance(mine.x, mine.y, tank.x, tank.y) <= mine.triggerRadius + Math.max(1, Number(tank.radius || PLAYER_RADIUS));
    });
    const reveal = nearTank || mine.triggered;
    const baseAlpha = defaultMineAlphaForAge(age);
    const targetAlpha = reveal ? 1 : baseAlpha;
    const currentAlpha = clamp(Number(mine.visibleAlpha ?? targetAlpha), 0, 1);
    const revealStep = dt * MINE_REVEAL_RATE;
    const fadeStep = dt / (MINE_FADE_DURATION_MS / 1000);
    const visibleAlpha =
      targetAlpha > currentAlpha
        ? Math.min(targetAlpha, currentAlpha + revealStep)
        : Math.max(targetAlpha, currentAlpha - fadeStep);

    const locallyTriggered = armed && Boolean(mine.local) && nearTank;
    return {
      ...mine,
      age,
      armed,
      triggered: mine.triggered || locallyTriggered,
      triggerStartedAtMs: mine.triggered
        ? mine.triggerStartedAtMs
        : locallyTriggered
          ? Date.now()
          : mine.triggerStartedAtMs,
      visibleAlpha,
    };
  });
}

function drawTankMountedMine(
  ctx: CanvasRenderingContext2D,
  tankColor: string,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  drawLandMine(
    ctx,
    {
      id: 0,
      x: 0,
      y: 0,
      radius: Math.max(8, MINE_RADIUS * 0.72),
      triggerRadius: Math.max(9, MINE_RADIUS * 0.78),
      color: tankColor,
      age: 0,
      armed: true,
      triggered: false,
      visibleAlpha: 1,
    },
    theme,
    elapsedMs,
    { compact: true },
  );
}

function drawGuidedMissileIcon(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  theme: "light" | "dark",
  accent = "#38bdf8",
) {
  const darkMode = theme === "dark";
  const bodyTop = darkMode ? "#e2e8f0" : "#64748b";
  const bodyMid = darkMode ? "#94a3b8" : "#475569";
  const bodyBottom = darkMode ? "#334155" : "#1f2937";
  const finFill = darkMode ? "#64748b" : "#94a3b8";
  const stroke = darkMode ? "rgba(248, 250, 252, 0.42)" : "rgba(15, 23, 42, 0.34)";
  const halfLength = length / 2;
  const halfWidth = width / 2;

  ctx.save();
  const bodyGradient = ctx.createLinearGradient(-halfLength, 0, halfLength, 0);
  bodyGradient.addColorStop(0, bodyBottom);
  bodyGradient.addColorStop(0.42, bodyMid);
  bodyGradient.addColorStop(1, bodyTop);
  ctx.shadowColor = hexToRgba(accent, darkMode ? 0.52 : 0.34);
  ctx.shadowBlur = Math.max(6, width * 0.34);

  ctx.fillStyle = finFill;
  ctx.beginPath();
  ctx.moveTo(-halfLength * 0.46, -halfWidth * 0.72);
  ctx.lineTo(-halfLength * 0.12, -halfWidth * 1.42);
  ctx.lineTo(halfLength * 0.04, -halfWidth * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-halfLength * 0.46, halfWidth * 0.72);
  ctx.lineTo(-halfLength * 0.12, halfWidth * 1.42);
  ctx.lineTo(halfLength * 0.04, halfWidth * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-halfLength * 0.82, -halfWidth * 0.58);
  ctx.lineTo(-halfLength * 0.62, -halfWidth * 1.18);
  ctx.lineTo(-halfLength * 0.38, -halfWidth * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-halfLength * 0.82, halfWidth * 0.58);
  ctx.lineTo(-halfLength * 0.62, halfWidth * 1.18);
  ctx.lineTo(-halfLength * 0.38, halfWidth * 0.52);
  ctx.closePath();
  ctx.fill();

  drawRoundedRectPath(ctx, -halfLength * 0.8, -halfWidth * 0.42, length * 0.92, halfWidth * 0.84, halfWidth * 0.42);
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.lineWidth = Math.max(0.9, width * 0.07);
  ctx.strokeStyle = stroke;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(halfLength * 0.08, -halfWidth * 0.42);
  ctx.lineTo(halfLength * 0.86, 0);
  ctx.lineTo(halfLength * 0.08, halfWidth * 0.42);
  ctx.closePath();
  ctx.fillStyle = darkMode ? "#cbd5e1" : "#334155";
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();

  ctx.shadowBlur = Math.max(5, width * 0.24);
  ctx.strokeStyle = hexToRgba(accent, darkMode ? 0.92 : 0.74);
  ctx.lineWidth = Math.max(1.8, width * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-halfLength * 0.52, 0);
  ctx.lineTo(-halfLength * 0.14, 0);
  ctx.moveTo(halfLength * 0.2, 0);
  ctx.lineTo(halfLength * 0.38, 0);
  ctx.stroke();
  ctx.restore();
}

function drawTowMissileIcon(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  theme: "light" | "dark",
  accent = "#38bdf8",
) {
  const darkMode = theme === "dark";
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const bodyGradient = ctx.createLinearGradient(-halfLength, 0, halfLength, 0);
  bodyGradient.addColorStop(0, darkMode ? "#1f2937" : "#334155");
  bodyGradient.addColorStop(0.48, darkMode ? "#94a3b8" : "#64748b");
  bodyGradient.addColorStop(1, darkMode ? "#e5e7eb" : "#cbd5e1");
  const stroke = darkMode ? "rgba(248, 250, 252, 0.44)" : "rgba(15, 23, 42, 0.3)";

  ctx.save();
  ctx.shadowColor = hexToRgba(accent, darkMode ? 0.42 : 0.26);
  ctx.shadowBlur = Math.max(4, width * 0.24);
  ctx.fillStyle = darkMode ? "#64748b" : "#94a3b8";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-halfLength * 0.2, side * halfWidth * 0.48);
    ctx.lineTo(halfLength * 0.06, side * halfWidth * 1.68);
    ctx.lineTo(halfLength * 0.28, side * halfWidth * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-halfLength * 0.68, side * halfWidth * 0.42);
    ctx.lineTo(-halfLength * 0.5, side * halfWidth * 1.02);
    ctx.lineTo(-halfLength * 0.32, side * halfWidth * 0.38);
    ctx.closePath();
    ctx.fill();
  }

  drawRoundedRectPath(ctx, -halfLength * 0.72, -halfWidth * 0.38, length * 1.16, halfWidth * 0.76, halfWidth * 0.36);
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.lineWidth = Math.max(0.85, width * 0.065);
  ctx.strokeStyle = stroke;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(halfLength * 0.42, -halfWidth * 0.38);
  ctx.lineTo(halfLength * 0.78, 0);
  ctx.lineTo(halfLength * 0.42, halfWidth * 0.38);
  ctx.closePath();
  ctx.fillStyle = darkMode ? "#f8fafc" : "#1f2937";
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();

  ctx.strokeStyle = hexToRgba(accent, darkMode ? 0.68 : 0.48);
  ctx.lineWidth = Math.max(1, width * 0.08);
  ctx.lineCap = "round";
  for (const x of [-0.34, -0.04, 0.24]) {
    ctx.beginPath();
    ctx.moveTo(halfLength * x, -halfWidth * 0.24);
    ctx.lineTo(halfLength * x, halfWidth * 0.24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTankMissileLauncher(
  ctx: CanvasRenderingContext2D,
  tankColor: string,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const darkMode = theme === "dark";
  const palette = getPlayerPalette(tankColor, theme);
  const pulse = 0.5 + Math.sin(elapsedMs * 0.006) * 0.5;
  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 5 + pulse * 3;
  const tubeGradient = ctx.createLinearGradient(0, -20, 0, 15);
  tubeGradient.addColorStop(0, darkMode ? "#dbeafe" : "#64748b");
  tubeGradient.addColorStop(0.48, darkMode ? "#64748b" : "#475569");
  tubeGradient.addColorStop(1, darkMode ? "#1e293b" : "#cbd5e1");
  drawRoundedRectPath(ctx, -7.8, -20, 15.6, 35, 5.8);
  ctx.fillStyle = tubeGradient;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = hexToRgba(palette.bright, darkMode ? 0.42 : 0.32);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, -2.5);
  ctx.rotate(-Math.PI / 2);
  drawGuidedMissileIcon(ctx, 23, 8.6, theme, palette.bright);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, -20, 5.1, 0, Math.PI * 2);
  ctx.fillStyle = darkMode ? "rgba(2, 6, 23, 0.82)" : "rgba(15, 23, 42, 0.5)";
  ctx.fill();
  ctx.strokeStyle = hexToRgba(palette.bright, darkMode ? 0.62 : 0.42);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawTankTowLauncher(
  ctx: CanvasRenderingContext2D,
  tankColor: string,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const darkMode = theme === "dark";
  const palette = getPlayerPalette(tankColor, theme);
  const pulse = 0.5 + Math.sin(elapsedMs * 0.0048) * 0.5;
  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 4 + pulse * 2.2;

  const mountGradient = ctx.createLinearGradient(-12, -6, 12, 10);
  mountGradient.addColorStop(0, darkMode ? "#dbeafe" : "#f8fafc");
  mountGradient.addColorStop(0.52, darkMode ? "#64748b" : "#94a3b8");
  mountGradient.addColorStop(1, darkMode ? "#172033" : "#475569");
  drawRoundedRectPath(ctx, -12, -8, 24, 16, 5.4);
  ctx.fillStyle = mountGradient;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = hexToRgba(palette.bright, darkMode ? 0.38 : 0.28);
  ctx.stroke();

  const tubeGradient = ctx.createLinearGradient(0, -22, 0, 14);
  tubeGradient.addColorStop(0, darkMode ? "#eef2ff" : "#dbeafe");
  tubeGradient.addColorStop(0.45, darkMode ? "#94a3b8" : "#64748b");
  tubeGradient.addColorStop(1, darkMode ? "#1e293b" : "#334155");
  drawRoundedRectPath(ctx, -6.4, -21, 12.8, 36, 4.2);
  ctx.fillStyle = tubeGradient;
  ctx.fill();
  ctx.strokeStyle = hexToRgba(palette.bright, darkMode ? 0.44 : 0.3);
  ctx.stroke();

  drawRoundedRectPath(ctx, 7.2, -14, 6.8, 13, 3.2);
  ctx.fillStyle = darkMode ? "rgba(15, 23, 42, 0.88)" : "rgba(241, 245, 249, 0.86)";
  ctx.fill();
  ctx.strokeStyle = hexToRgba(palette.bright, darkMode ? 0.46 : 0.32);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, -3.2);
  ctx.rotate(-Math.PI / 2);
  drawTowMissileIcon(ctx, 22, 7.6, theme, palette.bright);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, -21, 4.3, 0, Math.PI * 2);
  ctx.fillStyle = darkMode ? "rgba(2, 6, 23, 0.86)" : "rgba(15, 23, 42, 0.5)";
  ctx.fill();
  ctx.strokeStyle = hexToRgba(palette.bright, darkMode ? 0.62 : 0.42);
  ctx.stroke();
  ctx.restore();
}

function drawGuidedMissileProjectile(
  ctx: CanvasRenderingContext2D,
  bullet: Pick<Bullet, "x" | "y" | "radius" | "vx" | "vy" | "targetColor" | "flameColor" | "locked">,
  ownerColor: string,
  theme: "light" | "dark",
  elapsedMs: number,
  alpha = 1,
) {
  const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
  const angle = Math.atan2(bullet.vy, bullet.vx);
  const palette = getPlayerPalette(ownerColor, theme);
  const flameColor = bullet.flameColor || (bullet.locked && bullet.targetColor ? resolveGameColor(bullet.targetColor, theme) : "#f8fafc");
  const flamePalette = getPlayerPalette(flameColor, theme);
  const length = Math.max(14, bullet.radius * 3.05);
  const width = Math.max(7.2, bullet.radius * 1.18);
  const flamePulse = 0.68 + Math.sin(elapsedMs * 0.024 + bullet.x * 0.03 + bullet.y * 0.02) * 0.22;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(angle);

  ctx.save();
  ctx.globalCompositeOperation = theme === "dark" ? "lighter" : "source-over";
  ctx.shadowColor = flamePalette.glow;
  ctx.shadowBlur = 11;
  const flameLength = length * (0.42 + flamePulse * 0.16);
  const flameGradient = ctx.createLinearGradient(-length * 0.5 - flameLength, 0, -length * 0.34, 0);
  flameGradient.addColorStop(0, hexToRgba(flamePalette.base, 0));
  flameGradient.addColorStop(0.45, hexToRgba(flamePalette.base, 0.54));
  flameGradient.addColorStop(1, hexToRgba(flamePalette.bright, 0.9));
  ctx.fillStyle = flameGradient;
  ctx.beginPath();
  ctx.moveTo(-length * 0.38, -width * 0.3);
  ctx.lineTo(-length * 0.5 - flameLength, 0);
  ctx.lineTo(-length * 0.38, width * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawGuidedMissileIcon(ctx, length, width, theme, palette.bright);
  if (bullet.locked) {
    ctx.save();
    ctx.globalCompositeOperation = theme === "dark" ? "lighter" : "source-over";
    ctx.strokeStyle = hexToRgba(flamePalette.bright, theme === "dark" ? 0.72 : 0.48);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, width * 1.24 + flamePulse * 2.2, -Math.PI * 0.72, Math.PI * 0.72);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawTowMissileProjectile(
  ctx: CanvasRenderingContext2D,
  bullet: Pick<Bullet, "x" | "y" | "radius" | "vx" | "vy">,
  ownerColor: string,
  theme: "light" | "dark",
  elapsedMs: number,
  alpha = 1,
) {
  const angle = Math.atan2(bullet.vy, bullet.vx);
  const palette = getPlayerPalette(ownerColor, theme);
  const length = Math.max(11, bullet.radius * 2.12);
  const width = Math.max(6.8, bullet.radius * 1.08);
  const flamePulse = 0.62 + Math.sin(elapsedMs * 0.026 + bullet.x * 0.02 + bullet.y * 0.025) * 0.2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(angle);

  ctx.save();
  ctx.globalCompositeOperation = theme === "dark" ? "lighter" : "source-over";
  ctx.shadowColor = "rgba(248, 250, 252, 0.72)";
  ctx.shadowBlur = 10;
  const flameLength = length * (0.36 + flamePulse * 0.14);
  const flameGradient = ctx.createLinearGradient(-length * 0.5 - flameLength, 0, -length * 0.32, 0);
  flameGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  flameGradient.addColorStop(0.45, "rgba(226, 232, 240, 0.46)");
  flameGradient.addColorStop(1, "rgba(248, 250, 252, 0.92)");
  ctx.fillStyle = flameGradient;
  ctx.beginPath();
  ctx.moveTo(-length * 0.38, -width * 0.26);
  ctx.lineTo(-length * 0.5 - flameLength, 0);
  ctx.lineTo(-length * 0.38, width * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawTowMissileIcon(ctx, length, width, theme, palette.bright);
  ctx.restore();
}

function drawGuidedMissileExpiryEffect(
  ctx: CanvasRenderingContext2D,
  fade: Pick<BulletFade, "x" | "y" | "radius" | "life" | "maxLife" | "color" | "targetColor">,
  ownerColor: string,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const progress = clamp(1 - fade.life / Math.max(0.001, fade.maxLife), 0, 1);
  const alpha = 1 - smoothStep(progress);
  const palette = getPlayerPalette(fade.targetColor || fade.color || ownerColor, theme);
  const darkMode = theme === "dark";
  const radius = Math.max(16, fade.radius * (2.35 + progress * 4.8));
  const coreRadius = Math.max(5, fade.radius * (0.9 + progress * 1.5));
  const ringJitter = Math.sin(elapsedMs * 0.034 + fade.x * 0.02 + fade.y * 0.015) * 1.5;

  ctx.save();
  ctx.translate(fade.x, fade.y);
  ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
  ctx.globalAlpha = alpha;
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 16 * alpha;

  const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
  coreGradient.addColorStop(0, hexToRgba("#f8fafc", darkMode ? 0.72 : 0.84));
  coreGradient.addColorStop(0.44, hexToRgba(palette.bright, darkMode ? 0.5 : 0.42));
  coreGradient.addColorStop(1, hexToRgba(palette.base, 0));
  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = "round";
  for (let index = 0; index < 2; index += 1) {
    ctx.setLineDash(index === 0 ? [7, 7] : [3, 10]);
    ctx.lineDashOffset = -progress * (36 + index * 18);
    ctx.lineWidth = 2.1 - index * 0.6;
    ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.78 : 0.54) * alpha * (1 - index * 0.2));
    ctx.beginPath();
    ctx.arc(0, 0, radius * (0.72 + index * 0.23) + ringJitter, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 + progress * 0.45;
    const inner = fade.radius * (1.05 + progress * 1.2);
    const outer = radius * (0.72 + (index % 2) * 0.12);
    ctx.strokeStyle = hexToRgba(palette.bright, alpha * (darkMode ? 0.36 : 0.24));
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTowMissileExpiryEffect(
  ctx: CanvasRenderingContext2D,
  fade: Pick<BulletFade, "x" | "y" | "radius" | "life" | "maxLife" | "color" | "targetColor">,
  ownerColor: string,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const progress = clamp(1 - fade.life / Math.max(0.001, fade.maxLife), 0, 1);
  const alpha = 1 - smoothStep(progress);
  const palette = getPlayerPalette(fade.targetColor || fade.color || ownerColor, theme);
  const darkMode = theme === "dark";
  const radius = Math.max(12, fade.radius * (1.85 + progress * 2.65));
  const coreRadius = Math.max(5, fade.radius * (0.75 + progress * 0.9));
  const ringPulse = Math.sin(elapsedMs * 0.028 + fade.x * 0.017 + fade.y * 0.013) * 0.8;

  ctx.save();
  ctx.translate(fade.x, fade.y);
  ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
  ctx.globalAlpha = alpha;
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 10 * alpha;

  const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  coreGradient.addColorStop(0, hexToRgba("#f8fafc", darkMode ? 0.64 : 0.72));
  coreGradient.addColorStop(0.28, hexToRgba(palette.bright, darkMode ? 0.42 : 0.34));
  coreGradient.addColorStop(0.66, hexToRgba(palette.base, darkMode ? 0.14 : 0.1));
  coreGradient.addColorStop(1, hexToRgba(palette.base, 0));
  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = "round";
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = -progress * 30;
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.66 : 0.46) * alpha);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.78 + ringPulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = hexToRgba("#f8fafc", (darkMode ? 0.38 : 0.26) * alpha);
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const bulletSpriteCache = new Map<string, HTMLCanvasElement>();

function getBulletSprite(
  color: string,
  theme: "light" | "dark",
  projectileType = "bullet",
  radius = BULLET_RADIUS,
) {
  const palette = getPlayerPalette(color, theme);
  const normalizedType = String(projectileType || "bullet");
  const innerDot = normalizedType !== "shotgun" && normalizedType !== "minigun";
  const safeRadius = Math.max(1.4, radius);
  const glowRadius = normalizedType === "shotgun" ? 7 : normalizedType === "minigun" ? 8 : 11;
  const size = Math.ceil((safeRadius + glowRadius + 3) * 2 * BULLET_SPRITE_PIXEL_RATIO);
  const key = `${theme}:${color}:${normalizedType}:${safeRadius.toFixed(2)}:${size}`;
  const cached = bulletSpriteCache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const spriteCtx = canvas.getContext("2d");
  if (!spriteCtx) {
    return canvas;
  }
  const scale = BULLET_SPRITE_PIXEL_RATIO;
  const center = size / 2;
  spriteCtx.setTransform(scale, 0, 0, scale, 0, 0);
  const logicalCenter = center / scale;
  spriteCtx.shadowColor = palette.glow;
  spriteCtx.shadowBlur = glowRadius;
  spriteCtx.fillStyle = palette.bright;
  spriteCtx.beginPath();
  spriteCtx.arc(logicalCenter, logicalCenter, safeRadius, 0, Math.PI * 2);
  spriteCtx.fill();
  if (innerDot) {
    spriteCtx.shadowBlur = 0;
    spriteCtx.beginPath();
    spriteCtx.arc(logicalCenter, logicalCenter, Math.max(1.2, safeRadius - 2), 0, Math.PI * 2);
    spriteCtx.fillStyle = palette.base;
    spriteCtx.fill();
  }
  bulletSpriteCache.set(key, canvas);
  if (bulletSpriteCache.size > 96) {
    const firstKey = bulletSpriteCache.keys().next().value;
    if (firstKey) {
      bulletSpriteCache.delete(firstKey);
    }
  }
  return canvas;
}

function drawBulletSprite(
  ctx: CanvasRenderingContext2D,
  bullet: Pick<Bullet, "x" | "y" | "radius" | "projectileType">,
  color: string,
  theme: "light" | "dark",
  alpha = 1,
  radiusBoost = 0,
) {
  const radius = Math.max(1, bullet.radius + radiusBoost);
  const sprite = getBulletSprite(color, theme, bullet.projectileType || "bullet", radius);
  const size = sprite.width / BULLET_SPRITE_PIXEL_RATIO;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, bullet.x - size / 2, bullet.y - size / 2, size, size);
  ctx.restore();
}

function createTankExplosion(
  id: number,
  tank: Pick<Circle, "x" | "y" | "radius">,
  color: string,
  seed: number,
  weapon = "bullet",
): TankExplosionEffect {
  const rng = createSeededRandom(seed);
  const particles: TankExplosionParticle[] = [];
  const particleCount = 24;

  for (let index = 0; index < particleCount; index += 1) {
    const angle = (index / particleCount) * Math.PI * 2 + (rng() - 0.5) * 0.64;
    const speed = 92 + rng() * 188;
    const radialOffset = tank.radius * (0.18 + rng() * 0.38);
    const life = 0.58 + rng() * 0.34;
    particles.push({
      id: id * 100 + index,
      x: tank.x + Math.cos(angle) * radialOffset,
      y: tank.y + Math.sin(angle) * radialOffset,
      vx: Math.cos(angle) * speed + (rng() - 0.5) * 36,
      vy: Math.sin(angle) * speed + (rng() - 0.5) * 36,
      radius: 2.8 + rng() * 6.4,
      angle: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 7,
      color,
      life,
      maxLife: life,
    });
  }

  return {
    id,
    x: tank.x,
    y: tank.y,
    radius: tank.radius,
    color,
    weapon,
    life: 0.78,
    maxLife: 0.78,
    particles,
  };
}

function createTankExplosionFromState(state: TankTroubleTankExplosionState, fallbackSeed: number): TankExplosionEffect {
  const maxLife = Math.max(0.12, Number(state.maxLife || 0.78));
  const life = clamp(Number(state.life || maxLife), 0.01, maxLife);
  return {
    ...createTankExplosion(
      Number(state.id || 0),
      {
        x: Number(state.x || 0),
        y: Number(state.y || 0),
        radius: Math.max(1, Number(state.radius || PLAYER_RADIUS)),
      },
      String(state.color || "green"),
      Number(state.seed || fallbackSeed) >>> 0,
      String(state.weapon || "bullet"),
    ),
    life,
    maxLife,
  };
}

function drawHitEffect(ctx: CanvasRenderingContext2D, explosion: TankExplosionEffect, theme: "light" | "dark") {
  const darkMode = theme === "dark";
  const palette = getPlayerPalette(explosion.color, theme);
  const progress = clamp(1 - explosion.life / explosion.maxLife, 0, 1);
  const alpha = Math.max(0, 1 - progress);
  ctx.save();
  ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 10 * alpha;
  ctx.beginPath();
  ctx.arc(explosion.x, explosion.y, explosion.radius * (0.58 + progress * 1.25), 0, Math.PI * 2);
  ctx.lineWidth = 2.4 - progress * 1.1;
  ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.72 : 0.56) * alpha);
  ctx.stroke();
  for (let index = 0; index < 5; index += 1) {
    const angle = explosion.id * 0.73 + index * ((Math.PI * 2) / 5);
    const inner = explosion.radius * (0.16 + progress * 0.4);
    const outer = explosion.radius * (0.68 + progress * 0.9);
    ctx.beginPath();
    ctx.moveTo(explosion.x + Math.cos(angle) * inner, explosion.y + Math.sin(angle) * inner);
    ctx.lineTo(explosion.x + Math.cos(angle) * outer, explosion.y + Math.sin(angle) * outer);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.52 : 0.38) * alpha);
    ctx.stroke();
  }
  ctx.restore();
}

function serializeTankExplosion(explosion: TankExplosionEffect): TankTroubleTankExplosionState {
  return {
    id: explosion.id,
    x: explosion.x,
    y: explosion.y,
    radius: explosion.radius,
    color: explosion.color,
    weapon: explosion.weapon || "bullet",
    life: Math.max(0, explosion.life),
    maxLife: explosion.maxLife,
  };
}

function advanceTankExplosions(explosions: TankExplosionEffect[], dt: number) {
  return explosions
    .map((explosion) => ({
      ...explosion,
      life: explosion.life - dt,
      particles: explosion.particles
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * dt,
          y: particle.y + particle.vy * dt,
          vx: particle.vx * Math.pow(0.025, dt),
          vy: particle.vy * Math.pow(0.025, dt),
          angle: particle.angle + particle.spin * dt,
          life: particle.life - dt,
        }))
        .filter((particle) => particle.life > 0),
    }))
    .filter((explosion) => explosion.life > 0 || explosion.particles.length > 0);
}

function drawTankExplosions(
  ctx: CanvasRenderingContext2D,
  explosions: TankExplosionEffect[],
  theme: "light" | "dark",
) {
  const darkMode = theme === "dark";

  for (const explosion of explosions) {
    if (String(explosion.weapon || "bullet").startsWith("hit:")) {
      drawHitEffect(ctx, explosion, theme);
      continue;
    }
    const palette = getPlayerPalette(explosion.color, theme);
    const progress = clamp(1 - explosion.life / explosion.maxLife, 0, 1);
    const shockAlpha = Math.max(0, 1 - progress);
    const shockRadius = explosion.radius * (1.15 + progress * 3.8);

    ctx.save();
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 26 * shockAlpha;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, shockRadius, 0, Math.PI * 2);
    ctx.lineWidth = 5.4 - progress * 3.4;
    ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.78 : 0.6) * shockAlpha);
    ctx.stroke();

    const innerGradient = ctx.createRadialGradient(
      explosion.x,
      explosion.y,
      0,
      explosion.x,
      explosion.y,
      explosion.radius * (1.2 + progress * 2.1),
    );
    innerGradient.addColorStop(0, hexToRgba(palette.bright, (darkMode ? 0.42 : 0.32) * shockAlpha));
    innerGradient.addColorStop(0.42, hexToRgba(palette.base, (darkMode ? 0.24 : 0.18) * shockAlpha));
    innerGradient.addColorStop(1, hexToRgba(palette.base, 0));
    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius * (1.6 + progress * 2.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(explosion.x, explosion.y);
    ctx.rotate(progress * Math.PI * 0.85 + explosion.id * 0.17);
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 18 * shockAlpha;
    const techRadius = explosion.radius * (1.85 + progress * 2.7);
    const segmentCount = 18;
    for (let index = 0; index < segmentCount; index += 1) {
      if (index % 3 === 1) {
        continue;
      }
      const start = (index / segmentCount) * Math.PI * 2;
      const end = start + (Math.PI * 2) / segmentCount * 0.52;
      ctx.beginPath();
      ctx.arc(0, 0, techRadius, start, end);
      ctx.lineWidth = 2.1 - progress * 1.2;
      ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.62 : 0.48) * shockAlpha);
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
      ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.36 : 0.28) * shockAlpha);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.42 : 0.32) * shockAlpha);
    ctx.lineWidth = 1.1;
    for (let index = 0; index < 5; index += 1) {
      const baseAngle = progress * 5 + index * 1.256 + explosion.id * 0.31;
      const inner = explosion.radius * (0.9 + progress * 1.7);
      const mid = explosion.radius * (1.45 + progress * 2.3);
      const outer = explosion.radius * (1.15 + progress * 3.2);
      ctx.beginPath();
      ctx.moveTo(explosion.x + Math.cos(baseAngle) * inner, explosion.y + Math.sin(baseAngle) * inner);
      ctx.lineTo(explosion.x + Math.cos(baseAngle + 0.18) * mid, explosion.y + Math.sin(baseAngle + 0.18) * mid);
      ctx.lineTo(explosion.x + Math.cos(baseAngle - 0.08) * outer, explosion.y + Math.sin(baseAngle - 0.08) * outer);
      ctx.stroke();
    }
    ctx.restore();

    for (const particle of explosion.particles) {
      const particleProgress = clamp(1 - particle.life / particle.maxLife, 0, 1);
      const alpha = Math.max(0, 1 - particleProgress);
      const shardLength = particle.radius * (1.7 + particleProgress * 0.7);
      const shardWidth = Math.max(1.2, particle.radius * (0.55 - particleProgress * 0.18));

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = darkMode ? 12 * alpha : 8 * alpha;
      const shardGradient = ctx.createLinearGradient(-shardWidth, -shardLength, shardWidth, shardLength);
      shardGradient.addColorStop(0, hexToRgba(palette.bright, 0.96));
      shardGradient.addColorStop(0.48, hexToRgba(palette.base, 0.9));
      shardGradient.addColorStop(1, darkMode ? "rgba(15, 23, 42, 0.72)" : "rgba(248, 250, 252, 0.66)");
      ctx.fillStyle = shardGradient;
      ctx.beginPath();
      ctx.moveTo(0, -shardLength);
      ctx.lineTo(shardWidth, 0);
      ctx.lineTo(0, shardLength * 0.72);
      ctx.lineTo(-shardWidth, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function normalizePowerupState(powerup: TankTroublePowerupState): TankPowerup {
  return {
    id: Number(powerup.id || 0),
    kind: String(powerup.kind || "cash"),
    color: String(powerup.color || "#9ca3af"),
    symbol: String(powerup.symbol || "$$").slice(0, 3) || "$$",
    effect: String(powerup.effect || "score"),
    scoreDelta: Number(powerup.score_delta || 0),
    x: Number(powerup.x || 0),
    y: Number(powerup.y || 0),
    radius: Math.max(1, Number(powerup.radius || TARGET_RADIUS)),
    phase: Number(powerup.phase || 0),
  };
}

function normalizePowerupEffectState(effect: TankTroublePowerupEffectState, nowMs: number): TankPowerupPickupEffect {
  const createdAtMs = Number(effect.created_at_ms || nowMs);
  const ageSec = Math.max(0, (nowMs - createdAtMs) / 1000);
  const maxLife = 0.78;
  return {
    id: Number(effect.id || 0),
    powerupId: Number(effect.powerup_id || 0),
    playerId: String(effect.player_id || ""),
    kind: String(effect.kind || "cash"),
    color: String(effect.color || "#9ca3af"),
    symbol: String(effect.symbol || "$$").slice(0, 3) || "$$",
    effect: String(effect.effect || "score"),
    scoreDelta: Number(effect.score_delta || 0),
    x: Number(effect.x || 0),
    y: Number(effect.y || 0),
    radius: Math.max(1, Number(effect.radius || TARGET_RADIUS)),
    life: Math.max(0.01, maxLife - ageSec),
    maxLife,
  };
}

function advancePowerupPickupEffects(effects: TankPowerupPickupEffect[], dt: number) {
  return effects
    .map((effect) => ({ ...effect, life: effect.life - dt }))
    .filter((effect) => effect.life > 0);
}

function createHealPlusEffects(
  effect: Pick<TankPowerupPickupEffect, "id" | "x" | "y" | "playerId">,
  tank: Pick<PlayerTank, "x" | "y" | "radius">,
): HealPlusEffect[] {
  const rng = createSeededRandom((effect.id ^ stringHash(effect.playerId || "heal") ^ Math.floor(tank.x * 13) ^ Math.floor(tank.y * 17)) >>> 0);
  const placed: Array<{ x: number; y: number }> = [];
  const effects: HealPlusEffect[] = [];
  const baseSize = Math.max(15, tank.radius * 0.86);
  for (let index = 0; index < 3; index += 1) {
    let offsetX = 0;
    let offsetY = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const side = rng() > 0.5 ? 1 : -1;
      const angle = -Math.PI * (0.16 + rng() * 0.78);
      const distanceFromTank = tank.radius * (1.02 + rng() * 0.92);
      offsetX = Math.cos(angle) * distanceFromTank * side + (rng() - 0.5) * tank.radius * 0.38;
      offsetY = Math.sin(angle) * distanceFromTank + (rng() - 0.5) * tank.radius * 0.26;
      const tooClose = placed.some((point) => distance(point.x, point.y, offsetX, offsetY) < tank.radius * 0.88);
      if (!tooClose || attempt === 11) {
        break;
      }
    }
    placed.push({ x: offsetX, y: offsetY });
    const duration = 1.14 + rng() * 0.22;
    effects.push({
      id: effect.id * 10 + index,
      x: tank.x,
      y: tank.y,
      offsetX,
      offsetY,
      driftX: (rng() - 0.5) * tank.radius * 0.5,
      rise: tank.radius * (1.18 + rng() * 0.72),
      size: baseSize * (0.82 + rng() * 0.42),
      delay: index * 0.07 + rng() * 0.06,
      life: duration,
      maxLife: duration,
    });
  }
  return effects;
}

function advanceHealPlusEffects(effects: HealPlusEffect[], dt: number) {
  return effects
    .map((effect) => ({ ...effect, life: effect.life - dt }))
    .filter((effect) => effect.life > -effect.delay);
}

function getPowerupPickupLabel(effect: { effect?: string; scoreDelta?: number }) {
  const effectName = String(effect.effect || "score").toLowerCase();
  if (effectName === "score") {
    return `+${Math.max(0, Math.round(Number(effect.scoreDelta || 0)))}`;
  }
  if (effectName === "shotgun") {
    return "SHOTGUN";
  }
  if (effectName === "laser") {
    return "LASER";
  }
  if (effectName === "minigun") {
    return "MINIGUN";
  }
  if (effectName === "double_barrel") {
    return "BARREL+1";
  }
  if (effectName === "shield") {
    return "SHIELD";
  }
  if (effectName === "land_mine") {
    return "AT MINE";
  }
  if (effectName === "heal") {
    return "HEAL";
  }
  if (effectName === "guided_missile") {
    return "GUIDED MISSILE";
  }
  if (effectName === "tow_missile") {
    return "TOW";
  }
  return effectName.toUpperCase();
}

function getPowerupVisualPalette(theme: "light" | "dark") {
  if (theme === "dark") {
    return {
      core: "#cbd5e1",
      glow: "#f8fafc",
      outer: "rgba(226, 232, 240, 0.22)",
      ring: "rgba(248, 250, 252, 0.76)",
      bodyTop: "#f8fafc",
      bodyMid: "#cbd5e1",
      bodyBottom: "#64748b",
      stroke: "rgba(255, 255, 255, 0.72)",
      symbol: "#fde68a",
    };
  }

  return {
    core: "#64748b",
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

function getPowerupIcon(kind: string) {
  const source = POWERUP_ICON_SOURCES[kind] || POWERUP_ICON_SOURCES.cash;
  if (!source) {
    return null;
  }
  const cached = powerupIconCache.get(source);
  if (cached) {
    return cached;
  }
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  powerupIconCache.set(source, image);
  return image;
}

function drawPowerupPngIcon(
  ctx: CanvasRenderingContext2D,
  kind: string,
  radius: number,
  fallback: () => void,
) {
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

function drawShotgunPowerupIcon(ctx: CanvasRenderingContext2D, radius: number, theme: "light" | "dark") {
  const darkMode = theme === "dark";
  ctx.save();
  ctx.rotate(-Math.PI / 5);
  const shellGradient = ctx.createLinearGradient(-radius * 0.92, 0, radius * 0.88, 0);
  shellGradient.addColorStop(0, "#fca5a5");
  shellGradient.addColorStop(0.42, "#ef4444");
  shellGradient.addColorStop(1, "#b91c1c");
  ctx.fillStyle = shellGradient;
  ctx.shadowColor = darkMode ? "rgba(248, 113, 113, 0.62)" : "rgba(239, 68, 68, 0.36)";
  ctx.shadowBlur = 7;
  drawRoundedRectPath(ctx, -radius * 0.74, -radius * 0.18, radius * 1.2, radius * 0.36, radius * 0.18);
  ctx.fill();
  const brassGradient = ctx.createLinearGradient(radius * 0.32, 0, radius * 0.82, 0);
  brassGradient.addColorStop(0, "#fde68a");
  brassGradient.addColorStop(0.55, "#d97706");
  brassGradient.addColorStop(1, "#92400e");
  ctx.fillStyle = brassGradient;
  drawRoundedRectPath(ctx, radius * 0.28, -radius * 0.2, radius * 0.44, radius * 0.4, radius * 0.16);
  ctx.fill();
  ctx.strokeStyle = darkMode ? "rgba(254, 226, 226, 0.62)" : "rgba(127, 29, 29, 0.28)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = darkMode ? "rgba(248, 250, 252, 0.9)" : "rgba(15, 23, 42, 0.72)";
  for (const point of [
    [-0.35, -0.28],
    [-0.08, -0.34],
    [0.18, -0.26],
  ]) {
    ctx.beginPath();
    ctx.arc(point[0] * radius, point[1] * radius, radius * 0.065, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLaserPowerupIcon(ctx: CanvasRenderingContext2D, radius: number, theme: "light" | "dark") {
  const darkMode = theme === "dark";
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

function drawMinigunPowerupIcon(ctx: CanvasRenderingContext2D, radius: number, theme: "light" | "dark") {
  const darkMode = theme === "dark";
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
    drawRoundedRectPath(ctx, -radius * 0.62, offset - radius * 0.035, radius * 1.1, radius * 0.07, radius * 0.035);
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

function drawShieldPowerupIcon(ctx: CanvasRenderingContext2D, radius: number, theme: "light" | "dark") {
  const darkMode = theme === "dark";
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
  ctx.moveTo(0, -radius * 0.52);
  ctx.quadraticCurveTo(radius * 0.38, -radius * 0.28, radius * 0.32, radius * 0.1);
  ctx.quadraticCurveTo(radius * 0.22, radius * 0.38, 0, radius * 0.52);
  ctx.quadraticCurveTo(-radius * 0.22, radius * 0.38, -radius * 0.32, radius * 0.1);
  ctx.quadraticCurveTo(-radius * 0.38, -radius * 0.28, 0, -radius * 0.52);
  ctx.strokeStyle = darkMode ? "rgba(191, 219, 254, 0.84)" : "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = Math.max(1.1, radius * 0.06);
  ctx.stroke();
  ctx.restore();
}

function drawCashPowerupIcon(
  ctx: CanvasRenderingContext2D,
  radius: number,
  theme: "light" | "dark",
  fillStyle: string,
) {
  const darkMode = theme === "dark";
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-display") || "Segoe UI";
  ctx.save();
  ctx.scale(1.04, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.max(33, radius * 1.9)}px ${fontFamily}`;
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

function drawPowerupSymbol(
  ctx: CanvasRenderingContext2D,
  powerup: Pick<TankPowerup, "kind" | "symbol" | "radius">,
  theme: "light" | "dark",
  fillStyle: string,
) {
  if (powerup.kind === "shotgun") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () => drawShotgunPowerupIcon(ctx, powerup.radius, theme));
    return;
  }
  if (powerup.kind === "laser") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () => drawLaserPowerupIcon(ctx, powerup.radius, theme));
    return;
  }
  if (powerup.kind === "minigun") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () => drawMinigunPowerupIcon(ctx, powerup.radius, theme));
    return;
  }
  if (powerup.kind === "double_barrel") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () =>
      drawCashPowerupIcon(ctx, powerup.radius, theme, fillStyle),
    );
    return;
  }
  if (powerup.kind === "shield") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () => drawShieldPowerupIcon(ctx, powerup.radius, theme));
    return;
  }
  if (powerup.kind === "land_mine") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () => {
      const darkMode = theme === "dark";
      ctx.save();
      ctx.translate(0, 0);
      ctx.shadowColor = darkMode ? "rgba(248, 250, 252, 0.42)" : "rgba(15, 23, 42, 0.32)";
      ctx.shadowBlur = 6;
      const bodyRadius = powerup.radius * 0.92;
      const topRadius = powerup.radius * 0.62;
      const edgeFill = darkMode ? "#334155" : "#cbd5e1";
      const coreFill = darkMode ? "#e2e8f0" : "#94a3b8";
      ctx.fillStyle = edgeFill;
      ctx.beginPath();
      ctx.ellipse(0, powerup.radius * 0.08, bodyRadius * 1.08, bodyRadius * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darkMode ? "#64748b" : "#e2e8f0";
      ctx.beginPath();
      ctx.ellipse(0, -powerup.radius * 0.05, bodyRadius * 0.92, bodyRadius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = coreFill;
      ctx.beginPath();
      ctx.arc(0, -powerup.radius * 0.17, topRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = darkMode ? "rgba(226, 232, 240, 0.45)" : "rgba(71, 85, 105, 0.34)";
      ctx.lineWidth = Math.max(1, powerup.radius * 0.12);
      ctx.stroke();
      ctx.beginPath();
      for (let index = 0; index < 6; index += 1) {
        const angle = -Math.PI / 2 + (index / 6) * Math.PI * 2;
        const inner = powerup.radius * 0.24;
        const outer = powerup.radius * 0.62;
        ctx.moveTo(Math.cos(angle) * inner, -powerup.radius * 0.17 + Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, -powerup.radius * 0.17 + Math.sin(angle) * outer);
      }
      ctx.strokeStyle = darkMode ? "rgba(148, 163, 184, 0.52)" : "rgba(100, 116, 139, 0.42)";
      ctx.lineWidth = Math.max(0.9, powerup.radius * 0.06);
      ctx.stroke();
      ctx.restore();
    });
    return;
  }
  if (powerup.kind === "heal") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () => {
      ctx.save();
      ctx.shadowColor = theme === "dark" ? "rgba(134, 239, 172, 0.72)" : "rgba(22, 163, 74, 0.34)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = theme === "dark" ? "#bbf7d0" : "#22c55e";
      drawRoundedRectPath(ctx, -powerup.radius * 0.18, -powerup.radius * 0.66, powerup.radius * 0.36, powerup.radius * 1.32, powerup.radius * 0.16);
      ctx.fill();
      drawRoundedRectPath(ctx, -powerup.radius * 0.66, -powerup.radius * 0.18, powerup.radius * 1.32, powerup.radius * 0.36, powerup.radius * 0.16);
      ctx.fill();
      ctx.restore();
    });
    return;
  }
  if (powerup.kind === "guided_missile") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () =>
      drawGuidedMissileIcon(ctx, powerup.radius * 1.9, powerup.radius * 1.9, theme),
    );
    return;
  }
  if (powerup.kind === "tow_missile") {
    drawPowerupPngIcon(ctx, powerup.kind, powerup.radius, () =>
      drawTowMissileIcon(ctx, powerup.radius * 1.75, powerup.radius * 1.35, theme),
    );
    return;
  }

  drawPowerupPngIcon(ctx, "cash", powerup.radius, () => drawCashPowerupIcon(ctx, powerup.radius, theme, fillStyle));
}

function drawPowerups(
  ctx: CanvasRenderingContext2D,
  powerups: TankPowerup[],
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const darkMode = theme === "dark";
  for (const powerup of powerups) {
    const phase = powerup.phase + elapsedMs * 0.003;
    const pulse = 1 + Math.sin(phase) * 0.08;
    const shimmer = 0.5 + Math.sin(phase * 1.3 + powerup.id) * 0.5;
    const visual = getPowerupVisualPalette(theme);

    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    ctx.shadowColor = hexToRgba(visual.glow, darkMode ? 0.38 : 0.22);
    ctx.shadowBlur = 14 + shimmer * 6;
    ctx.fillStyle = visual.outer;
    ctx.beginPath();
    ctx.arc(0, 0, powerup.radius * 1.78 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = visual.ring;
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2 + phase * 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, powerup.radius * (1.16 + shimmer * 0.08), angle, angle + 0.28);
      ctx.stroke();
    }

    const bodyGradient = ctx.createRadialGradient(-powerup.radius * 0.25, -powerup.radius * 0.35, 1, 0, 0, powerup.radius);
    bodyGradient.addColorStop(0, visual.bodyTop);
    bodyGradient.addColorStop(0.56, visual.bodyMid);
    bodyGradient.addColorStop(1, visual.bodyBottom);
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, powerup.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = visual.stroke;
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";
    ctx.shadowColor = darkMode ? "rgba(2, 6, 23, 0.62)" : "rgba(255, 255, 255, 0.32)";
    ctx.shadowBlur = darkMode ? 8 : 2;
    drawPowerupSymbol(ctx, powerup, theme, visual.symbol);
    ctx.restore();
  }
}

function drawPowerupPickupEffects(
  ctx: CanvasRenderingContext2D,
  effects: TankPowerupPickupEffect[],
  theme: "light" | "dark",
) {
  const darkMode = theme === "dark";
  for (const effect of effects) {
    const progress = clamp(1 - effect.life / effect.maxLife, 0, 1);
    const alpha = Math.max(0, 1 - progress);
    const coreColor = effect.color || "#9ca3af";

    ctx.save();
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    ctx.shadowColor = hexToRgba(coreColor, darkMode ? 0.62 : 0.42);
    ctx.shadowBlur = 22 * alpha;
    ctx.lineWidth = 3.2 - progress * 1.8;
    ctx.strokeStyle = hexToRgba(coreColor, (darkMode ? 0.76 : 0.56) * alpha);
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
      ctx.strokeStyle = hexToRgba(coreColor, (darkMode ? 0.48 : 0.34) * alpha);
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

function drawHealPlusEffects(
  ctx: CanvasRenderingContext2D,
  effects: HealPlusEffect[],
  theme: "light" | "dark",
) {
  const darkMode = theme === "dark";
  for (const effect of effects) {
    const activeLife = effect.life + effect.delay;
    const progress = clamp(1 - activeLife / effect.maxLife, 0, 1);
    if (progress <= 0 || progress >= 1) {
      continue;
    }
    const eased = smoothStep(progress);
    const alpha = Math.sin(progress * Math.PI) * 0.94;
    const x = effect.x + effect.offsetX + effect.driftX * eased;
    const y = effect.y + effect.offsetY - effect.rise * eased;
    const size = effect.size * (0.88 + 0.18 * Math.sin(progress * Math.PI));
    const thickness = Math.max(3, size * 0.22);
    const arm = size * 0.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    ctx.globalAlpha = alpha;
    ctx.shadowColor = darkMode ? "rgba(134, 239, 172, 0.84)" : "rgba(34, 197, 94, 0.42)";
    ctx.shadowBlur = 12 * alpha;
    ctx.fillStyle = darkMode ? "#bbf7d0" : "#2fbf67";
    drawRoundedRectPath(ctx, -thickness / 2, -arm, thickness, arm * 2, thickness / 2);
    ctx.fill();
    drawRoundedRectPath(ctx, -arm, -thickness / 2, arm * 2, thickness, thickness / 2);
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, thickness * 0.22);
    ctx.strokeStyle = darkMode ? "rgba(240, 253, 244, 0.62)" : "rgba(236, 253, 245, 0.72)";
    drawRoundedRectPath(ctx, -thickness / 2, -arm, thickness, arm * 2, thickness / 2);
    ctx.stroke();
    drawRoundedRectPath(ctx, -arm, -thickness / 2, arm * 2, thickness, thickness / 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawShellCasings(ctx: CanvasRenderingContext2D, shellCasings: ShellCasing[], theme: "light" | "dark") {
  const darkMode = theme === "dark";
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
    drawRoundedRectPath(ctx, -width / 2, -height / 2, width, height, height / 2);
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
    ctx.lineWidth = isMinigun ? 0.65 : 0.8;
    ctx.stroke();
    ctx.restore();
  }
}

function drawLaserAimSegments(
  ctx: CanvasRenderingContext2D,
  segments: AimSegment[],
  color: string,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  if (!segments.length) {
    return;
  }
  const palette = getPlayerPalette(color, theme);
  const darkMode = theme === "dark";
  const pulse = 0.38 + Math.sin(elapsedMs * 0.006) * 0.12;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ARENA_X, ARENA_Y, ARENA_WIDTH, ARENA_HEIGHT);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = hexToRgba(palette.bright, darkMode ? pulse * 0.62 : pulse * 0.42);
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = darkMode ? 12 : 7;
  for (const segment of segments) {
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();

    const length = distance(segment.x1, segment.y1, segment.x2, segment.y2);
    const steps = Math.max(2, Math.floor(length / 28));
    const dx = (segment.x2 - segment.x1) / length || 0;
    const dy = (segment.y2 - segment.y1) / length || 0;
    const drift = (elapsedMs * 0.035) % 28;
    for (let step = 0; step <= steps; step += 1) {
      const travel = clamp(step * 28 + drift, 0, length);
      const x = segment.x1 + dx * travel;
      const y = segment.y1 + dy * travel;
      const nodePulse = 0.55 + 0.45 * Math.sin(elapsedMs * 0.009 + step * 1.7);
      ctx.beginPath();
      ctx.arc(x, y, 1.9 + nodePulse * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(palette.bright, darkMode ? 0.42 : 0.28);
      ctx.fill();
      if (step % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(x - dx * 4, y - dy * 4);
        ctx.lineTo(x + dx * 8, y + dy * 8);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = hexToRgba(palette.bright, darkMode ? 0.22 : 0.16);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function strokeLaserPath(
  ctx: CanvasRenderingContext2D,
  segments: AimSegment[],
  strokeStyle: string,
  lineWidth: number,
  shadowBlur = 0,
  shadowColor = "transparent",
) {
  if (!segments.length) {
    return;
  }

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

function drawLaserProjectile(
  ctx: CanvasRenderingContext2D,
  bullet: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    life?: number;
    age?: number;
    distanceTravelled?: number;
    segments?: AimSegment[];
    pathSegments?: AimSegment[];
  },
  color: string,
  theme: "light" | "dark",
  walls: Rect[],
) {
  const palette = getPlayerPalette(color, theme);
  const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
  const headX = bullet.x + (bullet.vx / speed) * (LASER_LENGTH / 2);
  const headY = bullet.y + (bullet.vy / speed) * (LASER_LENGTH / 2);
  const pathSegments =
    bullet.pathSegments && bullet.pathSegments.length
      ? bullet.pathSegments
      : bullet.segments && bullet.segments.length
        ? bullet.segments
        : buildReverseReflectedSegments(headX, headY, bullet.vx, bullet.vy, LASER_LENGTH, walls);
  const visual = buildLaserVisualSegments(
    pathSegments,
    Number(bullet.distanceTravelled || 0),
    Number(bullet.age || 0),
    Number(bullet.life || LASER_LIFE),
  );
  if (!visual.wakeSegments.length || visual.alpha <= 0.01) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(ARENA_X, ARENA_Y, ARENA_WIDTH, ARENA_HEIGHT);
  ctx.clip();
  ctx.globalAlpha = visual.alpha;
  strokeLaserPath(
    ctx,
    visual.wakeSegments,
    hexToRgba(palette.base, theme === "dark" ? 0.18 : 0.12),
    5.2,
    theme === "dark" ? 14 : 9,
    palette.glow,
  );
  strokeLaserPath(
    ctx,
    visual.headSegments.length ? visual.headSegments : visual.wakeSegments,
    palette.bright,
    Math.max(1.6, bullet.radius * 0.42),
    theme === "dark" ? 6 : 3,
    palette.glow,
  );
  strokeLaserPath(
    ctx,
    visual.headSegments.length ? visual.headSegments : visual.wakeSegments,
    theme === "dark" ? "rgba(248, 250, 252, 0.72)" : "rgba(255, 255, 255, 0.58)",
    0.55,
  );
  ctx.restore();
}

function advanceKillFeedEntries(entries: KillFeedEntry[], dt: number) {
  return entries
    .map((entry) => ({ ...entry, life: entry.life - dt }))
    .filter((entry) => entry.life > 0);
}

function normalizeKillFeedEntry(event: TankTroubleTankExplosionState): KillFeedEntry | null {
  const eventId = Number(event.id || 0);
  const victimId = String(event.victim_id || "").trim();
  if (!eventId || !victimId) {
    return null;
  }

  return {
    id: eventId,
    killerId: String(event.killer_id || "").trim(),
    victimId,
    killerColor: String(event.killer_color || event.color || "green"),
    victimColor: String(event.victim_color || event.color || "green"),
    weapon: String(event.weapon || "bullet"),
    suicide: Boolean(event.suicide),
    life: 2.35,
    maxLife: 2.35,
  };
}

function formatKillFeedName(playerId: string) {
  return truncatePlayerIdLabel(playerId || "Player");
}

function drawBulletWeaponIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  theme: "light" | "dark",
) {
  const darkMode = theme === "dark";
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 4);
  const bodyGradient = ctx.createLinearGradient(-size * 0.42, 0, size * 0.42, 0);
  bodyGradient.addColorStop(0, darkMode ? "#64748b" : "#94a3b8");
  bodyGradient.addColorStop(0.5, darkMode ? "#e2e8f0" : "#475569");
  bodyGradient.addColorStop(1, darkMode ? "#f8fafc" : "#1e293b");
  ctx.fillStyle = bodyGradient;
  drawRoundedRectPath(ctx, -size * 0.34, -size * 0.16, size * 0.68, size * 0.32, size * 0.16);
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

function drawSkullWeaponIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  theme: "light" | "dark",
) {
  const darkMode = theme === "dark";
  const fill = darkMode ? "#e2e8f0" : "#1e293b";
  const cutout = darkMode ? "#0f172a" : "#f8fafc";
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, -size * 0.08, size * 0.34, 0, Math.PI * 2);
  ctx.fill();
  drawRoundedRectPath(ctx, -size * 0.23, size * 0.05, size * 0.46, size * 0.36, size * 0.08);
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

function drawKillWeaponIcon(
  ctx: CanvasRenderingContext2D,
  weapon: string,
  x: number,
  y: number,
  size: number,
  theme: "light" | "dark",
) {
  if (weapon === "suicide") {
    drawSkullWeaponIcon(ctx, x, y, size, theme);
    return;
  }
  if (weapon === "land_mine") {
    drawLandMine(
      ctx,
      {
        id: 0,
        x,
        y,
        radius: size * 0.34,
        triggerRadius: size * 0.46,
        color: "yellow",
        age: 1,
        armed: true,
        triggered: false,
        visibleAlpha: 1,
      },
      theme,
      0,
      { compact: true },
    );
    return;
  }
  if (weapon === "guided_missile") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    drawGuidedMissileIcon(ctx, size * 0.9, size * 0.36, theme);
    ctx.restore();
    return;
  }
  if (weapon === "tow_missile") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    drawTowMissileIcon(ctx, size * 0.82, size * 0.34, theme);
    ctx.restore();
    return;
  }
  drawBulletWeaponIcon(ctx, x, y, size, theme);
}

function drawKillFeedEntries(
  ctx: CanvasRenderingContext2D,
  entries: KillFeedEntry[],
  theme: "light" | "dark",
) {
  const entry = entries[entries.length - 1];
  if (!entry) {
    return;
  }

  const darkMode = theme === "dark";
  const fadeIn = clamp((entry.maxLife - entry.life) / 0.12, 0, 1);
  const fadeOut = clamp(entry.life / 0.38, 0, 1);
  const alpha = Math.min(fadeIn, fadeOut);
  const fontSize = 28;
  const iconSize = 30;
  const gap = 13;
  const killer = formatKillFeedName(entry.killerId);
  const victim = formatKillFeedName(entry.victimId);
  const weapon = entry.suicide ? "suicide" : entry.weapon || "bullet";
  const killerPalette = getPlayerPalette(entry.killerColor || entry.victimColor || "green", theme);
  const victimPalette = getPlayerPalette(entry.victimColor || "green", theme);
  const x = ARENA_X + ARENA_WIDTH - 14;
  const y = ARENA_Y - 42;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${fontSize}px ${getComputedStyle(document.documentElement).getPropertyValue("--font-display") || "Segoe UI"}`;
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
  drawKillWeaponIcon(ctx, weapon, cursorX + iconSize / 2, y, iconSize, theme);
  cursorX += iconSize + gap;
  ctx.fillStyle = victimPalette.bright;
  ctx.shadowColor = victimPalette.glow;
  ctx.shadowBlur = 12;
  ctx.fillText(victim, cursorX, y);
  ctx.restore();
}

function drawSharedTankSprite(
  ctx: CanvasRenderingContext2D,
  tank: Pick<PlayerTank, "x" | "y" | "radius" | "angle" | "flash"> &
    Partial<Pick<PlayerTank, "weapon" | "weaponReloadMs" | "doubleBarrelAmmo" | "mineAmmo" | "missileAmmo">>,
  tankColor: string,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const darkMode = theme === "dark";
  const tankPalette = getPlayerPalette(tankColor, theme);
  const wallTime = elapsedMs / 1000;

  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.rotate(tank.angle + Math.PI / 2);

  const tankPulse = 0.56 + 0.44 * Math.sin(wallTime * 3.2 + tank.x * 0.014 + tank.y * 0.011);
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
  const tankScanOffset = ((wallTime * 42 + tank.x * 0.2 + tank.y * 0.13) % 42) - 21;
  const tankNoseGlow = hexToRgba(tankPalette.bright, darkMode ? 0.8 : 0.62);
  const tankRearGlow = hexToRgba(tankPalette.base, darkMode ? 0.84 : 0.64);
  const weapon = String((tank as Pick<PlayerTank, "weapon">).weapon || "default");
  const reloadMs = Math.max(0, Number((tank as Pick<PlayerTank, "weaponReloadMs">).weaponReloadMs || 0));
  const shotgunPump = weapon === "shotgun" ? shotgunPumpProgress(reloadMs) : 0;
  const laserCharge = weapon === "laser" ? 0.55 + Math.sin(wallTime * 8) * 0.18 : 0;
  const minigunSpin = weapon === "minigun" ? wallTime * 26 : 0;
  const doubleBarrelAmmo = Math.max(0, Number((tank as Pick<PlayerTank, "doubleBarrelAmmo">).doubleBarrelAmmo || 0));
  const doubleBarrelRecoil = weapon === "double_barrel" ? doubleBarrelRecoilProgress(reloadMs) : 0;
  const doubleBarrelRecoilOffset = doubleBarrelLastShotOffset(doubleBarrelAmmo);

  ctx.save();
  ctx.shadowColor = tankPalette.glow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = hexToRgba(tankPalette.base, darkMode ? 0.13 : 0.09);
  ctx.beginPath();
  ctx.arc(0, 0, tank.radius + 5.5 + tankPulse * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = tankSideFill;
  ctx.shadowColor = tankShadow;
  ctx.shadowBlur = 10;
  drawRoundedRectPath(ctx, -19, -16, 7, 32, 4);
  ctx.fill();
  drawRoundedRectPath(ctx, 12, -16, 7, 32, 4);
  ctx.fill();
  ctx.restore();

  ctx.save();
  const barrelGradient = ctx.createLinearGradient(0, -31, 0, -3);
  barrelGradient.addColorStop(0, tankShellTop);
  barrelGradient.addColorStop(1, tankShellBottom);
  const barrelWidth = weapon === "shotgun" ? 16.8 : weapon === "laser" ? 18 : weapon === "minigun" ? 19.5 : weapon === "double_barrel" ? 7.8 : 10.4;
  const barrelLength = weapon === "shotgun" ? 27 - shotgunPump * 5.6 : weapon === "laser" ? 24 : weapon === "minigun" ? 33 : weapon === "double_barrel" ? 34 : 35;
  const barrelY = weapon === "shotgun" ? -31 + shotgunPump * 8.5 : weapon === "laser" ? -31 : weapon === "minigun" ? -36 : weapon === "double_barrel" ? -37 : -38;
  const drawSingleBarrel = (centerX: number, recoil: number, muzzleRadius: number, width = barrelWidth) => {
    const currentY = barrelY + recoil;
    drawRoundedRectPath(
      ctx,
      centerX - width / 2,
      currentY,
      width,
      barrelLength,
      weapon === "shotgun" ? 7.2 : weapon === "laser" ? 9 : weapon === "minigun" ? 8.5 : 4.2,
    );
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
    ctx.arc(
      centerX,
      currentY + (weapon === "shotgun" ? 1.5 : weapon === "laser" ? 3 : weapon === "minigun" ? 2.4 : 1),
      muzzleRadius,
      0,
      Math.PI * 2,
    );
      ctx.fillStyle = tankCoreGlow;
      ctx.fill();
  };
  if (weapon !== "land_mine" && weapon !== "guided_missile" && !isTowMissileWeapon(weapon)) {
    if (weapon === "double_barrel") {
      for (const offset of [-DOUBLE_BARREL_BARREL_OFFSET, DOUBLE_BARREL_BARREL_OFFSET]) {
        const recoil = Math.abs(offset - doubleBarrelRecoilOffset) < 0.1 ? doubleBarrelRecoil * 7.2 : 0;
        drawSingleBarrel(offset, recoil, 4.1, 7.8);
      }
    } else {
      drawSingleBarrel(
        0,
        0,
        weapon === "shotgun" ? 7.4 : weapon === "laser" ? 9.2 : weapon === "minigun" ? 8.8 : 5.2,
      );
    }
    if (weapon === "shotgun") {
      const pumpY = -9.5 + shotgunPump * 6.2;
      ctx.save();
      ctx.shadowColor = tankPalette.glow;
      ctx.shadowBlur = 8 * shotgunPump;
      drawRoundedRectPath(ctx, -13.8, pumpY, 27.6, 7.2, 3.6);
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
        const radius = 5.2 + index * 3.2 + laserCharge * 1.1;
        ctx.beginPath();
        ctx.arc(0, barrelY + 3, radius, -Math.PI * 0.74, Math.PI * 0.74);
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
  }
  if (weapon !== "guided_missile" && !isTowMissileWeapon(weapon)) {
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
  }
  ctx.restore();

  ctx.save();
  const hullGradient = ctx.createLinearGradient(0, -18, 0, 18);
  hullGradient.addColorStop(0, tankShellTop);
  hullGradient.addColorStop(1, tankShellBottom);
  drawRoundedRectPath(ctx, -16, -18, 32, 36, 11);
  ctx.fillStyle = hullGradient;
  ctx.shadowColor = tankShadow;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = tankFrameStroke;
  ctx.stroke();

  ctx.save();
  drawRoundedRectPath(ctx, -16, -18, 32, 36, 11);
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
  drawRoundedRectPath(ctx, -9.5, -11.5, 19, 17, 7);
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
  drawRoundedRectPath(ctx, -11, 8.8, 22, 10.5, 4.8);
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

  if (weapon === "land_mine") {
    ctx.save();
    drawTankMountedMine(ctx, tankColor, theme, elapsedMs);
    ctx.restore();
  }
  if (weapon === "guided_missile") {
    ctx.save();
    drawTankMissileLauncher(ctx, tankColor, theme, elapsedMs);
    ctx.restore();
  }
  if (isTowMissileWeapon(weapon)) {
    ctx.save();
    drawTankTowLauncher(ctx, tankColor, theme, elapsedMs);
    ctx.restore();
  }

  if (tank.flash > 0 && weapon !== "land_mine") {
    ctx.fillStyle = tankPalette.flash.replace(/, ([0-9.]+)\)$/, `, ${clamp(tank.flash * 5.8, 0, 0.95)})`);
    ctx.beginPath();
    ctx.arc(0, -(tank.radius + 18), 8 + tank.flash * 24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTankShield(
  ctx: CanvasRenderingContext2D,
  tank: {
    x: number;
    y: number;
    color?: string;
    shieldActiveMs?: number;
    shieldVisibleMs?: number;
    shieldElapsedMs?: number;
    shieldRadius?: number;
  },
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const visibleMs = Math.max(0, Number(tank.shieldVisibleMs || 0));
  if (visibleMs <= 0) {
    return;
  }
  const activeMs = Math.max(0, Number(tank.shieldActiveMs || 0));
  const radius = Math.max(PLAYER_RADIUS + 10, Number(tank.shieldRadius || SHIELD_RADIUS));
  const darkMode = theme === "dark";
  const palette = getPlayerPalette(tank.color || "blue", theme);
  const elapsed = Math.max(0, Number(tank.shieldElapsedMs || 0)) / 1000 + elapsedMs / 1000;
  const flicker = activeMs <= 0 ? 0.46 + 0.54 * Math.max(0, Math.sin(elapsed * 26)) : 1;
  const fade = activeMs > 0 ? 1 : clamp(visibleMs / SHIELD_FLICKER_MS, 0, 1);
  const alpha = clamp(fade * flicker, 0, 1);
  if (alpha <= 0.02) {
    return;
  }

  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 18 * alpha;

  const gradient = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
  gradient.addColorStop(0, hexToRgba(palette.bright, (darkMode ? 0.07 : 0.05) * alpha));
  gradient.addColorStop(0.62, hexToRgba(palette.base, (darkMode ? 0.16 : 0.11) * alpha));
  gradient.addColorStop(1, hexToRgba(palette.bright, (darkMode ? 0.34 : 0.24) * alpha));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2.4;
  ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.72 : 0.52) * alpha);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  for (let index = 0; index < 3; index += 1) {
    const progress = (elapsed * 0.72 + index / 3) % 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (0.28 + progress * 0.72), 0, Math.PI * 2);
    ctx.lineWidth = 1.1 + (1 - progress) * 1.4;
    ctx.strokeStyle = hexToRgba(palette.bright, (0.36 - progress * 0.28) * alpha);
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

function drawShieldPulseEffects(
  ctx: CanvasRenderingContext2D,
  effects: ShieldPulseEffect[],
  theme: "light" | "dark",
) {
  const darkMode = theme === "dark";
  for (const effect of effects) {
    const maxLife = Math.max(0.01, effect.maxLife);
    const progress = clamp(1 - effect.life / maxLife, 0, 1);
    const eased = smoothStep(progress);
    const alpha = Math.max(0, 1 - eased);
    if (alpha <= 0.01) {
      continue;
    }
    const palette = getPlayerPalette(effect.color, theme);
    const radius = Math.max(PLAYER_RADIUS + 10, effect.radius);
    const impactAngle = Math.atan2(effect.impactY - effect.y, effect.impactX - effect.x);
    const ringRadius = radius * (0.9 + eased * 0.24);

    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.globalCompositeOperation = darkMode ? "lighter" : "source-over";
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = (effect.source === "blast" ? 16 : 12) * alpha;

    const gradient = ctx.createRadialGradient(0, 0, radius * 0.42, 0, 0, radius * (1.08 + eased * 0.18));
    gradient.addColorStop(0, hexToRgba(palette.bright, 0));
    gradient.addColorStop(0.78, hexToRgba(palette.base, (darkMode ? 0.1 : 0.07) * alpha));
    gradient.addColorStop(1, hexToRgba(palette.bright, (darkMode ? 0.22 : 0.16) * alpha));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (1.04 + eased * 0.16), 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = "round";
    ctx.lineWidth = (effect.source === "blast" ? 2.8 : 2.2) - eased * 1.1;
    ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.7 : 0.52) * alpha);
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, impactAngle - Math.PI * 0.56, impactAngle + Math.PI * 0.56);
    ctx.stroke();

    ctx.lineWidth = 1.1;
    ctx.strokeStyle = hexToRgba(darkMode ? "#e0f2fe" : palette.base, (darkMode ? 0.34 : 0.22) * alpha);
    ctx.setLineDash([6, 9]);
    ctx.lineDashOffset = -progress * 24;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (0.72 + eased * 0.12), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const flareCount = effect.source === "blast" ? 5 : 3;
    for (let index = 0; index < flareCount; index += 1) {
      const offset = (index - (flareCount - 1) / 2) * 0.34;
      const angle = impactAngle + offset;
      const inner = radius * (0.42 + eased * 0.2);
      const outer = radius * (0.78 + eased * 0.28);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineWidth = 1.35 - eased * 0.35;
      ctx.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.44 : 0.32) * alpha);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function mixChannel(left: number, right: number, ratio: number) {
  return Math.round(left + (right - left) * clamp(ratio, 0, 1));
}

function healthColorChannels(hp: number, maxHp: number) {
  const ratio = clamp(hp / Math.max(1, maxHp), 0, 1);
  const red = [190, 71, 65];
  const yellow = [213, 169, 65];
  const green = [78, 166, 106];
  const left = ratio < 0.5 ? red : yellow;
  const right = ratio < 0.5 ? yellow : green;
  const blend = ratio < 0.5 ? ratio / 0.5 : (ratio - 0.5) / 0.5;
  return [
    mixChannel(left[0], right[0], blend),
    mixChannel(left[1], right[1], blend),
    mixChannel(left[2], right[2], blend),
  ];
}

function healthColor(hp: number, maxHp: number) {
  const [red, green, blue] = healthColorChannels(hp, maxHp);
  return `rgb(${red}, ${green}, ${blue})`;
}

function healthColorRgba(hp: number, maxHp: number, alpha: number) {
  const [red, green, blue] = healthColorChannels(hp, maxHp);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function updateTankHealthThresholds(tank: Pick<PlayerTank, "hp" | "smokeBelow50SinceMs" | "smokeBelow25SinceMs">, elapsedMs: number) {
  const hp = Number(tank.hp ?? MAX_TANK_HP);
  tank.smokeBelow50SinceMs = hp < 50 ? tank.smokeBelow50SinceMs ?? elapsedMs : undefined;
  tank.smokeBelow25SinceMs = hp < 25 ? tank.smokeBelow25SinceMs ?? elapsedMs : undefined;
}

function drawDamageSmoke(
  ctx: CanvasRenderingContext2D,
  tank: Pick<PlayerTank, "id" | "x" | "y" | "radius" | "hp" | "smokeBelow50SinceMs" | "smokeBelow25SinceMs">,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const hp = Number(tank.hp ?? MAX_TANK_HP);
  const below25 = hp < 25 && tank.smokeBelow25SinceMs !== undefined && elapsedMs - tank.smokeBelow25SinceMs >= DAMAGE_SMOKE_DELAY_MS;
  const below50 = hp < 50 && tank.smokeBelow50SinceMs !== undefined && elapsedMs - tank.smokeBelow50SinceMs >= DAMAGE_SMOKE_DELAY_MS;
  if (!below25 && !below50) {
    return;
  }
  const darkMode = theme === "dark";
  const baseAlpha = below25 ? 0.74 : 0.58;
  const seed = stringHash(tank.id);
  ctx.save();
  ctx.globalCompositeOperation = darkMode ? "screen" : "source-over";
  for (let index = 0; index < 9; index += 1) {
    const phase = (elapsedMs * (0.00038 + index * 0.00002) + index * 0.17 + (seed % 17) * 0.011) % 1;
    const side = index % 2 === 0 ? -1 : 1;
    const x =
      tank.x +
      side * (tank.radius * (0.36 + index * 0.035)) +
      Math.sin(phase * Math.PI * 2 + seed) * 7.2;
    const y =
      tank.y -
      tank.radius * (0.62 + phase * 1.55) +
      Math.cos(phase * Math.PI * 2 + index) * 4.4;
    const radius = tank.radius * (0.34 + phase * 0.42);
    const alpha = baseAlpha * Math.pow(1 - phase, 0.72) * (below25 ? 1 : 0.92);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, below25 ? hexToRgba("#111827", alpha) : hexToRgba("#f1f5f9", alpha));
    gradient.addColorStop(0.5, below25 ? hexToRgba("#4b5563", alpha * 0.66) : hexToRgba("#cbd5e1", alpha * 0.58));
    gradient.addColorStop(1, below25 ? hexToRgba("#020617", 0) : hexToRgba("#94a3b8", 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTankHealthBadge(
  ctx: CanvasRenderingContext2D,
  tank: Pick<PlayerTank, "id" | "x" | "y" | "radius" | "hp" | "maxHp">,
  theme: "light" | "dark",
  elapsedMs: number,
) {
  const maxHp = Math.max(1, Number(tank.maxHp ?? MAX_TANK_HP));
  const hp = clamp(Number(tank.hp ?? maxHp), 0, maxHp);
  const ratio = clamp(hp / maxHp, 0, 1);
  const width = 56;
  const height = 9;
  const x = tank.x - width / 2;
  const y = tank.y - tank.radius - 30;
  const darkMode = theme === "dark";
  const injuredPulse = hp < maxHp ? 0.5 + 0.5 * Math.sin(elapsedMs * 0.008) : 0;

  ctx.save();
  ctx.font = "700 12px 'Segoe UI'";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = darkMode ? "rgba(219, 234, 254, 0.92)" : "rgba(15, 23, 42, 0.68)";
  ctx.fillText(truncatePlayerIdLabel(tank.id), tank.x, y - 4);

  drawRoundedRectPath(ctx, x, y, width, height, 3);
  ctx.fillStyle = darkMode ? "rgba(15, 23, 42, 0.66)" : "rgba(241, 245, 249, 0.78)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle =
    hp < maxHp
      ? healthColorRgba(hp, maxHp, darkMode ? 0.34 + injuredPulse * 0.22 : 0.24 + injuredPulse * 0.18)
      : darkMode
        ? "rgba(203, 213, 225, 0.28)"
        : "rgba(15, 23, 42, 0.16)";
  ctx.shadowColor = hp < maxHp ? healthColorRgba(hp, maxHp, 0.22 + injuredPulse * 0.16) : "transparent";
  ctx.shadowBlur = hp < maxHp ? 5 + injuredPulse * 3 : 0;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const fillWidth = Math.max(0, (width - 2) * ratio);
  if (fillWidth > 0) {
    drawRoundedRectPath(ctx, x + 1, y + 1, fillWidth, height - 2, 2);
    const fillColor = healthColor(hp, maxHp);
    const fillGradient = ctx.createLinearGradient(x, y + 1, x, y + height - 1);
    fillGradient.addColorStop(0, healthColorRgba(hp, maxHp, 0.96));
    fillGradient.addColorStop(0.52, fillColor);
    fillGradient.addColorStop(1, healthColorRgba(hp, maxHp, 0.78));
    ctx.fillStyle = fillGradient;
    ctx.fill();

    const shineWidth = 16;
    const shineProgress = (elapsedMs * 0.00032 + (stringHash(tank.id) % 17) / 17) % 1;
    const shineX = x + 1 - shineWidth + (width + shineWidth) * shineProgress;
    if (shineX < x + 1 + fillWidth && shineX + shineWidth > x + 1) {
      ctx.save();
      drawRoundedRectPath(ctx, x + 1, y + 1, fillWidth, height - 2, 2);
      ctx.clip();
      const shineGradient = ctx.createLinearGradient(shineX, y, shineX + shineWidth, y);
      shineGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      shineGradient.addColorStop(0.5, darkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.34)");
      shineGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = shineGradient;
      ctx.fillRect(shineX, y + 1, shineWidth, height - 2);
      ctx.restore();
    }
  }

  ctx.beginPath();
  for (let index = 1; index < 4; index += 1) {
    const tickX = x + (width * index) / 4;
    ctx.moveTo(tickX, y + 1);
    ctx.lineTo(tickX, y + height - 1);
  }
  ctx.lineWidth = 0.65;
  ctx.strokeStyle = darkMode ? "rgba(248, 250, 252, 0.2)" : "rgba(15, 23, 42, 0.14)";
  ctx.stroke();
  ctx.restore();
}

function computeVerticalWhitespaceRatio(stageWidth: number, stageHeight: number) {
  if (stageWidth <= 0 || stageHeight <= 0) {
    return 0;
  }

  const renderedHeight = Math.min(stageHeight, stageWidth / WORLD_ASPECT_RATIO);
  return Math.max(0, stageHeight - renderedHeight) / stageHeight;
}

function shouldDockScoreboard(layoutWidth: number, layoutHeight: number, currentValue: boolean) {
  const stageWidth = Math.max(0, layoutWidth - SCOREBOARD_WIDTH);
  const blankRatio = computeVerticalWhitespaceRatio(stageWidth, layoutHeight);
  return currentValue ? blankRatio > SCOREBOARD_UNDOCK_THRESHOLD : blankRatio > SCOREBOARD_DOCK_THRESHOLD;
}

function normalizePlayerColorKey(value: string): PlayerColorKey {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "red" || normalized === "blue" || normalized === "yellow") {
    return normalized;
  }
  return "green";
}

function normalizeCustomOptions(value?: Partial<TankTroubleCustomOptions> | null): TankTroubleCustomOptions {
  return {
    ...defaultCustomOptions(),
    health_system: Boolean(value?.health_system),
    persistent_buffs: Boolean(value?.persistent_buffs),
    same_place_respawn: Boolean(value?.same_place_respawn),
  };
}

function buildSessionFromRoomState(
  playerId: string,
  roomState: TankTroubleRoomState,
  preferredColor?: PlayerColorKey,
  mode: GameSessionMode = "online",
): GameSession {
  return {
    playerId,
    seed: roomState.map_seed,
    mapId: roomState.map_id,
    room: roomState.room || TANK_TROUBLE_ROOM,
    playerColor: preferredColor ?? normalizePlayerColorKey(roomState.local_player_color),
    mode,
    customOptions: normalizeCustomOptions(roomState.custom_options),
  };
}

function buildSessionFromMatchState(playerId: string, matchState: TankTroubleMatchState): GameSession {
  return {
    playerId,
    seed: matchState.map_seed,
    mapId: matchState.map_id,
    room: matchState.room || TANK_TROUBLE_ROOM,
    playerColor: normalizePlayerColorKey(matchState.local_player_color),
    mode: matchState.match_mode === "custom" ? "custom" : "online",
    customOptions: normalizeCustomOptions(matchState.custom_options),
  };
}

function withDarkSpectatorTheme(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("theme", "dark");
    return url.toString();
  } catch {
    const joiner = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${joiner}theme=dark`;
  }
}

function buildRoomStateFromMatchState(matchState: TankTroubleMatchState): TankTroubleRoomState {
  return {
    ok: matchState.ok,
    room: matchState.room,
    map_seed: matchState.map_seed,
    map_id: matchState.map_id,
    match_mode: matchState.match_mode,
    custom_options: normalizeCustomOptions(matchState.custom_options),
    match_mode_owner_id: matchState.match_mode_owner_id,
    mode_locked: matchState.mode_locked,
    active_player_ids: matchState.active_player_ids,
    active_player_count: matchState.active_player_count,
    voted_player_ids: matchState.voters.map((entry) => entry.player_id),
    vote_count: matchState.vote_count,
    vote_required: matchState.vote_required,
    countdown_seconds: matchState.countdown_seconds,
    countdown_active: matchState.countdown_active,
    countdown_deadline_ms: matchState.countdown_deadline_ms,
    local_player_voted: matchState.local_player_voted,
    local_player_color: matchState.local_player_color,
    local_player_present: Boolean(matchState.local_state),
    active_players: matchState.active_players,
    voters: matchState.voters,
    occupied_colors: matchState.occupied_colors,
    available_colors: matchState.available_colors,
    room_full: matchState.room_full,
    updated_at_ms: matchState.updated_at_ms,
  };
}

function buildLeaderboardEntries(activePlayers: TankTroubleRoomPlayerState[]) {
  return [...activePlayers]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.hits !== left.hits) {
        return right.hits - left.hits;
      }
      return left.player_id.localeCompare(right.player_id);
    })
    .map((entry) => ({
      playerId: entry.player_id,
      countryCode: normalizeCountryCode(entry.country_code),
      score: entry.score,
      hits: entry.hits,
      latencyMs: normalizeLatencyMs(entry.latency_ms),
      updatedAt: 0,
    }))
    .slice(0, SCOREBOARD_LIMIT);
}

function createEmptyMatchInput(): TankTroubleMatchRequest["input"] {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    fire_seq: 0,
    fire_held: false,
  };
}

function normalizeMatchInputState(input?: Partial<TankTroubleMatchInputState> | null): TankTroubleMatchInputState {
  return {
    forward: Boolean(input?.forward),
    backward: Boolean(input?.backward),
    left: Boolean(input?.left),
    right: Boolean(input?.right),
    fire_seq: Math.max(0, Number(input?.fire_seq || 0)),
    fire_held: Boolean(input?.fire_held),
  };
}

function loadStoredLeaderboard() {
  try {
    const raw = window.localStorage.getItem(STORAGE_LEADERBOARD_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => ({
        playerId: String(entry?.playerId ?? "").trim(),
        countryCode: normalizeCountryCode(entry?.countryCode),
        score: Number(entry?.score ?? 0),
        hits: Number(entry?.hits ?? 0),
        latencyMs: normalizeLatencyMs(entry?.latencyMs),
        updatedAt: Number(entry?.updatedAt ?? 0),
      }))
      .filter((entry) => entry.playerId)
      .sort(compareLeaderboardEntry)
      .slice(0, SCOREBOARD_LIMIT);
  } catch {
    return [];
  }
}

function storeLeaderboard(entries: LeaderboardEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(entries));
  } catch {
    return;
  }
}

function compareLeaderboardEntry(a: LeaderboardEntry, b: LeaderboardEntry) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  if (b.hits !== a.hits) {
    return b.hits - a.hits;
  }
  return b.updatedAt - a.updatedAt;
}

function mergeLeaderboardEntry(entries: LeaderboardEntry[], nextEntry: LeaderboardEntry) {
  const current = entries.find((entry) => entry.playerId === nextEntry.playerId);
  const normalizedNextCountryCode = normalizeCountryCode(nextEntry.countryCode);

  if (
    current &&
    nextEntry.score <= current.score &&
    nextEntry.hits <= current.hits &&
    normalizeCountryCode(current.countryCode) === normalizedNextCountryCode
  ) {
    return entries;
  }

  const mergedEntry: LeaderboardEntry = current
    ? {
        ...current,
        countryCode: normalizedNextCountryCode || normalizeCountryCode(current.countryCode),
        score: Math.max(current.score, nextEntry.score),
        hits: Math.max(current.hits, nextEntry.hits),
        latencyMs: normalizeLatencyMs(nextEntry.latencyMs) || normalizeLatencyMs(current.latencyMs),
        updatedAt: nextEntry.updatedAt,
      }
    : {
        ...nextEntry,
        countryCode: normalizedNextCountryCode,
      };

  return [...entries.filter((entry) => entry.playerId !== nextEntry.playerId), mergedEntry]
    .sort(compareLeaderboardEntry)
    .slice(0, SCOREBOARD_LIMIT);
}

function createOuterWalls(): Rect[] {
  return [
    {
      x: ARENA_X - WALL_THICKNESS,
      y: ARENA_Y - WALL_THICKNESS,
      w: ARENA_WIDTH + WALL_THICKNESS * 2,
      h: WALL_THICKNESS,
    },
    {
      x: ARENA_X - WALL_THICKNESS,
      y: ARENA_Y + ARENA_HEIGHT,
      w: ARENA_WIDTH + WALL_THICKNESS * 2,
      h: WALL_THICKNESS,
    },
    {
      x: ARENA_X - WALL_THICKNESS,
      y: ARENA_Y,
      w: WALL_THICKNESS,
      h: ARENA_HEIGHT,
    },
    {
      x: ARENA_X + ARENA_WIDTH,
      y: ARENA_Y,
      w: WALL_THICKNESS,
      h: ARENA_HEIGHT,
    },
  ];
}

function buildTrainingWalls(seed: number) {
  const rng = createSeededRandom(seed);
  const walls = createOuterWalls();
  const safeZones: Rect[] = [
    { x: ARENA_X + 24, y: ARENA_Y + 24, w: 180, h: 140 },
    { x: ARENA_X + ARENA_WIDTH - 204, y: ARENA_Y + ARENA_HEIGHT - 164, w: 180, h: 140 },
  ];
  const gridCols = LOGICAL_GRID_COLS;
  const gridRows = LOGICAL_GRID_ROWS;
  const cellWidth = ARENA_WIDTH / gridCols;
  const cellHeight = ARENA_HEIGHT / gridRows;

  const tryAddWall = (wall: Rect) => {
    if (safeZones.some((zone) => rectsIntersect(wall, zone, 28))) {
      return;
    }
    if (walls.some((existing) => rectsIntersect(wall, existing, 6))) {
      return;
    }
    walls.push(wall);
  };

  for (let row = 0; row < gridRows; row += 1) {
    for (let col = 0; col < gridCols; col += 1) {
      const centerX = ARENA_X + cellWidth * (col + 0.5);
      const centerY = ARENA_Y + cellHeight * (row + 0.5);
      const horizontalLength = cellWidth * (rng() > 0.56 ? 1.24 : 0.84);
      const verticalLength = cellHeight * (rng() > 0.58 ? 1.2 : 0.82);

      if (rng() < 0.19) {
        tryAddWall({
          x: centerX - horizontalLength / 2,
          y: centerY - WALL_THICKNESS / 2,
          w: horizontalLength,
          h: WALL_THICKNESS,
        });
      }

      if (rng() < 0.17) {
        tryAddWall({
          x: centerX - WALL_THICKNESS / 2,
          y: centerY - verticalLength / 2,
          w: WALL_THICKNESS,
          h: verticalLength,
        });
      }

      if (rng() < 0.065) {
        tryAddWall({
          x: centerX - 22,
          y: centerY - 22,
          w: 44,
          h: 44,
        });
      }
    }
  }

  tryAddWall({
    x: ARENA_X + ARENA_WIDTH * 0.46,
    y: ARENA_Y + ARENA_HEIGHT * 0.18,
    w: 24,
    h: ARENA_HEIGHT * 0.26,
  });
  tryAddWall({
    x: ARENA_X + ARENA_WIDTH * 0.32,
    y: ARENA_Y + ARENA_HEIGHT * 0.56,
    w: ARENA_WIDTH * 0.18,
    h: 20,
  });
  tryAddWall({
    x: ARENA_X + ARENA_WIDTH * 0.62,
    y: ARENA_Y + ARENA_HEIGHT * 0.54,
    w: ARENA_WIDTH * 0.18,
    h: 20,
  });

  return walls;
}

function pickSpawnPoint(
  rng: () => number,
  walls: Rect[],
  occupied: Circle[],
  radius: number,
  preferredBand?: { minX: number; maxX: number; minY: number; maxY: number },
) {
  for (let attempt = 0; attempt < 360; attempt += 1) {
    const minX = preferredBand?.minX ?? ARENA_X + 34;
    const maxX = preferredBand?.maxX ?? ARENA_X + ARENA_WIDTH - 34;
    const minY = preferredBand?.minY ?? ARENA_Y + 34;
    const maxY = preferredBand?.maxY ?? ARENA_Y + ARENA_HEIGHT - 34;
    const x = minX + rng() * Math.max(1, maxX - minX);
    const y = minY + rng() * Math.max(1, maxY - minY);
    const candidate: Circle = { x, y, radius };

    if (walls.some((wall) => circleIntersectsRect(candidate, wall))) {
      continue;
    }
    if (occupied.some((circle) => distance(circle.x, circle.y, x, y) < circle.radius + radius + 30)) {
      continue;
    }
    return candidate;
  }

  return { x: ARENA_X + 100, y: ARENA_Y + 100, radius };
}

function createTargets(seed: number, walls: Rect[], player: Pick<Circle, "x" | "y" | "radius">) {
  const rng = createSeededRandom(seed ^ 0x5e3f9ab1);
  const targets: TrainingTarget[] = [];
  const occupied: Circle[] = [{ x: player.x, y: player.y, radius: player.radius + 28 }];

  for (let index = 0; index < TARGET_COUNT; index += 1) {
    const spawn = pickSpawnPoint(rng, walls, occupied, TARGET_RADIUS, {
      minX: ARENA_X + 80,
      maxX: ARENA_X + ARENA_WIDTH - 80,
      minY: ARENA_Y + 70,
      maxY: ARENA_Y + ARENA_HEIGHT - 70,
    });
    occupied.push({ x: spawn.x, y: spawn.y, radius: TARGET_RADIUS + 18 });
    targets.push({
      id: index + 1,
      x: spawn.x,
      y: spawn.y,
      radius: TARGET_RADIUS,
      phase: rng() * Math.PI * 2,
    });
  }

  return targets;
}

function dampFactor(rate: number, dt: number) {
  return 1 - Math.exp(-rate * dt);
}

function shouldRefreshOnlineRoomUi(
  previous: TankTroubleRoomState | null,
  next: TankTroubleRoomState,
  nowMs: number,
  lastRefreshMs: number,
) {
  if (!previous) {
    return true;
  }
  if (
    previous.map_id !== next.map_id ||
    previous.map_seed !== next.map_seed ||
    previous.active_player_count !== next.active_player_count ||
    previous.vote_count !== next.vote_count ||
    previous.vote_required !== next.vote_required ||
    previous.countdown_seconds !== next.countdown_seconds ||
    previous.countdown_active !== next.countdown_active ||
    previous.local_player_voted !== next.local_player_voted ||
    previous.local_player_color !== next.local_player_color ||
    previous.room_full !== next.room_full
  ) {
    return true;
  }
  return nowMs - lastRefreshMs >= 140;
}

function projectileDamage(projectileType?: string) {
  if (projectileType === "shotgun") {
    return SHOTGUN_DAMAGE;
  }
  if (projectileType === "minigun") {
    return MINIGUN_DAMAGE;
  }
  if (projectileType === "laser") {
    return LASER_DAMAGE;
  }
  if (projectileType === "land_mine") {
    return LAND_MINE_DAMAGE;
  }
  if (projectileType === "guided_missile" || projectileType === "tow_missile") {
    return GUIDED_MISSILE_DAMAGE;
  }
  return DEFAULT_BULLET_DAMAGE;
}

function createTankTroubleEngine(options: {
  playerId: string;
  seed: number;
  mapTag: string;
  theme: "light" | "dark";
  playerColor: string;
  customOptions?: TankTroubleCustomOptions;
}): TankTroubleEngine {
  const walls = buildTrainingWalls(options.seed);
  const wallIndex = buildWallSpatialIndex(walls);
  const player: PlayerTank = {
    id: options.playerId,
    x: 0,
    y: 0,
    radius: PLAYER_RADIUS,
    angle: 0,
    cooldown: 0,
    flash: 0,
  };
  const bot: PlayerTank = {
    id: BOT_PLAYER_ID,
    x: -9999,
    y: -9999,
    radius: PLAYER_RADIUS,
    angle: Math.PI,
    cooldown: 0,
    flash: 0,
  };
  let theme = options.theme;
  let bullets: Bullet[] = [];
  let botBullets: Bullet[] = [];
  let score = 0;
  let shots = 0;
  let hits = 0;
  let ricochets = 0;
  let deaths = 0;
  let elapsedMs = 0;
  let nextBulletId = 1;
  let nextRippleId = 1;
  let nextExplosionId = 1;
  let fireLatched = false;
  const mapTag = options.mapTag || `MAP-${(options.seed >>> 0).toString(16).slice(-4).toUpperCase()}`;
  let targets: TrainingTarget[] = [];
  let wallRipples: WallRipple[] = [];
  let shieldPulseEffects: ShieldPulseEffect[] = [];
  let bulletFades: BulletFade[] = [];
  let bulletSmokeEffects: BulletSmokeEffect[] = [];
  let tankExplosions: TankExplosionEffect[] = [];
  let botEnabled = true;
  let latencyOnly = false;
  let latencyClone: LatencyCloneTankState | null = null;
  let latencyBullets: LatencyCloneBulletState[] = [];
  let latencyCloneInput: TankTroubleLatencyInputState | null = null;
  let latencyCloneMeta: LatencyCloneSyncMeta | null = null;
  let latencyCloneResetSeq = 0;
  let latencyBulletVelocities = new Map<number, { vx: number; vy: number }>();
  let localPlayerHitSeq = 0;
  let cloneHitSeq = 0;
  let cloneHitAckSeq = 0;
  let nextPredictedLatencyBulletId = -1;
  let botReverseTimer = 0;
  let botStuckTimer = 0;
  let botTurnBias = -1;
  const seenCloneFireEventIds = new Set<number>();

  function respawnPlayer() {
    const occupied = targets.map((target) => ({
      x: target.x,
      y: target.y,
      radius: target.radius + 24,
    }));
    if (bot.x > ARENA_X - 128) {
      occupied.push({ x: bot.x, y: bot.y, radius: bot.radius + 34 });
    }
    const rng = createSeededRandom((options.seed ^ hits ^ score ^ deaths ^ shots) >>> 0);
    const spawn = pickSpawnPoint(rng, walls, occupied, PLAYER_RADIUS, {
      minX: ARENA_X + 44,
      maxX: ARENA_X + ARENA_WIDTH * 0.32,
      minY: ARENA_Y + 44,
      maxY: ARENA_Y + ARENA_HEIGHT * 0.42,
    });
    player.x = spawn.x;
    player.y = spawn.y;
    player.angle = 0;
    player.cooldown = SHOOT_COOLDOWN * 0.9;
    player.flash = 0;
  }

  function respawnBot() {
    const occupied: Circle[] = [
      { x: player.x, y: player.y, radius: player.radius + 44 },
      ...targets.map((target) => ({
        x: target.x,
        y: target.y,
        radius: target.radius + 22,
      })),
    ];
    const rng = createSeededRandom((options.seed ^ deaths ^ hits ^ nextBulletId ^ 0x7f31bca1) >>> 0);
    const spawn = pickSpawnPoint(rng, walls, occupied, PLAYER_RADIUS, {
      minX: ARENA_X + ARENA_WIDTH * 0.54,
      maxX: ARENA_X + ARENA_WIDTH - 52,
      minY: ARENA_Y + 52,
      maxY: ARENA_Y + ARENA_HEIGHT - 52,
    });
    bot.x = spawn.x;
    bot.y = spawn.y;
    bot.angle = Math.atan2(player.y - bot.y, player.x - bot.x);
    bot.cooldown = SHOOT_COOLDOWN * 0.7;
    bot.flash = 0;
    botReverseTimer = 0;
    botStuckTimer = 0;
  }

  respawnPlayer();
  targets = createTargets(options.seed, walls, player);
  respawnBot();
  respawnPlayer();

  function tryMoveCircle(target: Circle, nextX: number, nextY: number) {
    const minX = ARENA_X + target.radius;
    const maxX = ARENA_X + ARENA_WIDTH - target.radius;
    const minY = ARENA_Y + target.radius;
    const maxY = ARENA_Y + ARENA_HEIGHT - target.radius;
    const candidateX = clamp(nextX, minX, maxX);
    const candidateY = clamp(nextY, minY, maxY);

    if (
      walls.some((wall) =>
        circleIntersectsRect(
          { x: candidateX, y: candidateY, radius: target.radius + PLAYER_COLLISION_PADDING },
          wall,
        ),
      )
    ) {
      return false;
    }

    target.x = candidateX;
    target.y = candidateY;
    return true;
  }

  function resolveCirclePosition(target: Circle, deltaX: number, deltaY: number) {
    const travel = Math.hypot(deltaX, deltaY);
    const steps = Math.max(1, Math.ceil(travel / 3));
    const stepX = deltaX / steps;
    const stepY = deltaY / steps;

    for (let step = 0; step < steps; step += 1) {
      if (tryMoveCircle(target, target.x + stepX, target.y + stepY)) {
        continue;
      }

      const movedX = stepX !== 0 && tryMoveCircle(target, target.x + stepX, target.y);
      const movedY = stepY !== 0 && tryMoveCircle(target, target.x, target.y + stepY);

      if (!movedX && !movedY) {
        continue;
      }
    }
  }

  function separateTanks(first: Circle, second: Circle) {
    const deltaX = second.x - first.x;
    const deltaY = second.y - first.y;
    const currentDistance = Math.hypot(deltaX, deltaY);
    const minimumDistance = first.radius + second.radius + 6;
    if (currentDistance >= minimumDistance) {
      return;
    }

    const normalX = currentDistance > 0.001 ? deltaX / currentDistance : 1;
    const normalY = currentDistance > 0.001 ? deltaY / currentDistance : 0;
    const push = (minimumDistance - currentDistance) * 0.56;
    tryMoveCircle(first, first.x - normalX * push, first.y - normalY * push);
    tryMoveCircle(second, second.x + normalX * push, second.y + normalY * push);
  }

  function respawnTarget(targetId: number) {
    const occupied: Circle[] = [
      { x: player.x, y: player.y, radius: player.radius + 32 },
      ...(bot.x > ARENA_X - 128 ? [{ x: bot.x, y: bot.y, radius: bot.radius + 32 }] : []),
      ...targets
        .filter((target) => target.id !== targetId)
        .map((target) => ({ x: target.x, y: target.y, radius: target.radius + 18 })),
    ];
    const rng = createSeededRandom((options.seed ^ targetId ^ hits ^ score) >>> 0);
    const next = pickSpawnPoint(rng, walls, occupied, TARGET_RADIUS, {
      minX: ARENA_X + 80,
      maxX: ARENA_X + ARENA_WIDTH - 80,
      minY: ARENA_Y + 70,
      maxY: ARENA_Y + ARENA_HEIGHT - 70,
    });
    targets = targets.map((target) =>
      target.id === targetId
        ? {
            ...target,
            x: next.x,
            y: next.y,
            phase: rng() * Math.PI * 2,
          }
        : target,
    );
  }

  function destroyPlayer() {
    pushTankExplosion(player, options.playerColor);
    deaths += 1;
    score = Math.max(0, score - 120);
    bullets = [];
    respawnPlayer();
  }

  function destroyBot() {
    pushTankExplosion(bot, BOT_PLAYER_COLOR);
    score += 250;
    hits += 1;
    botBullets = [];
    respawnBot();
  }

  function fireBullet() {
    if (player.cooldown > 0 || bullets.length >= MAX_BULLETS) {
      return;
    }

    const spawnX = player.x + Math.cos(player.angle) * (player.radius + 12);
    const spawnY = player.y + Math.sin(player.angle) * (player.radius + 12);
    bullets.push({
      id: nextBulletId,
      x: spawnX,
      y: spawnY,
      radius: BULLET_RADIUS,
      vx: Math.cos(player.angle) * BULLET_SPEED,
      vy: Math.sin(player.angle) * BULLET_SPEED,
      life: BULLET_LIFE,
      bouncesLeft: BULLET_BOUNCES,
      age: 0,
    });
    nextBulletId += 1;
    shots += 1;
    player.cooldown = SHOOT_COOLDOWN;
    player.flash = 0.13;
  }

  function fireBotBullet() {
    if (bot.cooldown > 0 || botBullets.length >= MAX_BULLETS) {
      return;
    }

    const spawnX = bot.x + Math.cos(bot.angle) * (bot.radius + 12);
    const spawnY = bot.y + Math.sin(bot.angle) * (bot.radius + 12);
    botBullets.push({
      id: nextBulletId,
      x: spawnX,
      y: spawnY,
      radius: BULLET_RADIUS,
      vx: Math.cos(bot.angle) * BULLET_SPEED,
      vy: Math.sin(bot.angle) * BULLET_SPEED,
      life: BULLET_LIFE,
      bouncesLeft: BULLET_BOUNCES,
      age: 0,
    });
    nextBulletId += 1;
    bot.cooldown = SHOOT_COOLDOWN * 1.06;
    bot.flash = 0.13;
  }

  function pushWallRipple(wall: Rect, x: number, y: number, color: string) {
    wallRipples.push({
      id: nextRippleId,
      wall,
      x,
      y,
      color,
      life: 0.34,
      maxLife: 0.34,
    });
    nextRippleId += 1;
  }

  function pushShieldPulse(
    x: number,
    y: number,
    color: string,
    radius = SHIELD_RADIUS,
    centerX = x,
    centerY = y,
    source: "impact" | "blast" = "impact",
  ) {
    shieldPulseEffects.push({
      id: nextRippleId,
      x: centerX,
      y: centerY,
      impactX: x,
      impactY: y,
      radius: Math.max(PLAYER_RADIUS + 10, radius),
      color,
      life: source === "blast" ? 0.46 : 0.36,
      maxLife: source === "blast" ? 0.46 : 0.36,
      source,
    });
    nextRippleId += 1;
    if (shieldPulseEffects.length > 36) {
      shieldPulseEffects = shieldPulseEffects.slice(-36);
    }
  }

  function pushBulletFade(bullet: Bullet) {
    bulletFades.push({
      id: bullet.id,
      x: bullet.x,
      y: bullet.y,
      radius: bullet.radius,
      vx: bullet.vx * 0.18,
      vy: bullet.vy * 0.18,
      life: 0.11,
      maxLife: 0.11,
    });
  }

  function pushBulletSmoke(fade: BulletFade) {
    if (!shouldSpawnProjectileSmoke(fade.projectileType)) {
      return;
    }
    if (
      bullets.length > HEAVY_PROJECTILE_THRESHOLD &&
      fade.projectileType !== "bullet" &&
      fade.projectileType !== "double_barrel"
    ) {
      return;
    }
    if (bullets.length > EXTREME_PROJECTILE_THRESHOLD && bulletSmokeEffects.length > 24) {
      return;
    }
    const seed = (options.seed ^ fade.id ^ Math.floor(fade.x * 17) ^ Math.floor(fade.y * 31)) >>> 0;
    bulletSmokeEffects.push(createBulletSmokeEffect(fade, seed));
    if (bulletSmokeEffects.length > 48) {
      bulletSmokeEffects = bulletSmokeEffects.slice(-48);
    }
  }

  function pushTankExplosion(tank: Pick<Circle, "x" | "y" | "radius">, color: string) {
    if (tank.x < ARENA_X - 128 || tank.y < ARENA_Y - 128) {
      return;
    }
    const explosionId = nextExplosionId;
    nextExplosionId += 1;
    tankExplosions.push(createTankExplosion(explosionId, tank, color, (options.seed ^ explosionId ^ nextBulletId) >>> 0));
  }

  function createLatencyCloneTankState(source: TankTroubleLatencyCloneState): LatencyCloneTankState {
    return {
      id: source.player_id,
      player_id: source.player_id,
      x: source.x,
      y: source.y,
      radius: source.radius,
      angle: source.angle,
      cooldown: SHOOT_COOLDOWN * 0.8,
      flash: source.flash,
      countryCode: source.country_code,
      country_code: source.country_code,
      color: source.color,
    };
  }

  function applyLatencyCloneCorrection(source: TankTroubleLatencyCloneState) {
    if (!latencyClone) {
      latencyClone = createLatencyCloneTankState(source);
      return;
    }

    const correctionStrength = distance(latencyClone.x, latencyClone.y, source.x, source.y) > 128 ? 1 : 0.18;
    latencyClone = {
      ...latencyClone,
      id: source.player_id,
      player_id: source.player_id,
      x: latencyClone.x + (source.x - latencyClone.x) * correctionStrength,
      y: latencyClone.y + (source.y - latencyClone.y) * correctionStrength,
      angle: latencyClone.angle + shortestAngleDelta(latencyClone.angle, source.angle) * Math.max(0.2, correctionStrength),
      radius: source.radius,
      flash: Math.max(latencyClone.flash, source.flash),
      countryCode: source.country_code,
      country_code: source.country_code,
      color: source.color,
    };
  }

  function addLatencyCloneFireEvents(events: TankTroubleLatencyFireEvent[]) {
    for (const event of events) {
      if (seenCloneFireEventIds.has(event.id)) {
        continue;
      }
      seenCloneFireEventIds.add(event.id);
      const predictedIndex = latencyBullets.findIndex(
        (bullet) => bullet.id < 0 && distance(bullet.x, bullet.y, event.x, event.y) <= 56,
      );
      if (predictedIndex >= 0) {
        latencyBullets.splice(predictedIndex, 1);
      }
      latencyBulletVelocities.set(event.id, {
        vx: Math.cos(event.angle) * event.speed,
        vy: Math.sin(event.angle) * event.speed,
      });
      latencyBullets.push({
        id: event.id,
        x: event.x,
        y: event.y,
        radius: event.radius,
        vx: Math.cos(event.angle) * event.speed,
        vy: Math.sin(event.angle) * event.speed,
        life: BULLET_LIFE,
        bouncesLeft: BULLET_BOUNCES,
        age: 0,
      });
      if (latencyClone) {
        latencyClone.flash = Math.max(latencyClone.flash, 0.13);
      }
    }
  }

  function syncLatencyBulletsFromState(state: TankTroubleLatencyState) {
    const syncedBullets: LatencyCloneBulletState[] = latencyBullets.filter((bullet) => bullet.id < 0);
    for (const serverBullet of state.bullets) {
      const existing = latencyBullets.find((bullet) => bullet.id === serverBullet.id);
      const velocity = latencyBulletVelocities.get(serverBullet.id);
      if (existing) {
        const correctionStrength =
          distance(existing.x, existing.y, serverBullet.x, serverBullet.y) > 72 ? 1 : 0.34;
        syncedBullets.push({
          ...existing,
          x: existing.x + (serverBullet.x - existing.x) * correctionStrength,
          y: existing.y + (serverBullet.y - existing.y) * correctionStrength,
          radius: serverBullet.radius,
        });
        continue;
      }
      const predictedIndex = syncedBullets.findIndex(
        (bullet) => bullet.id < 0 && distance(bullet.x, bullet.y, serverBullet.x, serverBullet.y) <= 56,
      );
      if (predictedIndex >= 0) {
        syncedBullets.splice(predictedIndex, 1);
      }
      syncedBullets.push({
        id: serverBullet.id,
        x: serverBullet.x,
        y: serverBullet.y,
        radius: serverBullet.radius,
        vx: velocity?.vx ?? 0,
        vy: velocity?.vy ?? 0,
        life: BULLET_LIFE,
        bouncesLeft: BULLET_BOUNCES,
        age: 0,
      });
    }
    latencyBullets = syncedBullets;
  }

  function fireLatencyCloneBullet() {
    if (!latencyClone || latencyClone.cooldown > 0 || latencyBullets.length >= MAX_BULLETS) {
      return;
    }

    const spawnX = latencyClone.x + Math.cos(latencyClone.angle) * (latencyClone.radius + 12);
    const spawnY = latencyClone.y + Math.sin(latencyClone.angle) * (latencyClone.radius + 12);
    latencyBullets.push({
      id: nextPredictedLatencyBulletId,
      x: spawnX,
      y: spawnY,
      radius: BULLET_RADIUS,
      vx: Math.cos(latencyClone.angle) * BULLET_SPEED,
      vy: Math.sin(latencyClone.angle) * BULLET_SPEED,
      life: BULLET_LIFE,
      bouncesLeft: BULLET_BOUNCES,
      age: 0,
    });
    nextPredictedLatencyBulletId -= 1;
    latencyClone.cooldown = SHOOT_COOLDOWN;
    latencyClone.flash = Math.max(latencyClone.flash, 0.13);
  }

  function applyTargetRespawns(respawns: TankTroubleLatencyTargetRespawn[]) {
    if (!respawns.length) {
      return;
    }

    const respawnMap = new Map(respawns.map((respawn) => [respawn.id, respawn]));
    targets = targets.map((target) => {
      const next = respawnMap.get(target.id);
      if (!next) {
        return target;
      }
      return {
        ...target,
        x: next.x,
        y: next.y,
        phase: next.phase,
      };
    });
  }

  function drawTankSprite(
    ctx: CanvasRenderingContext2D,
    tank: Pick<PlayerTank, "x" | "y" | "radius" | "angle" | "flash">,
    tankColor: string,
  ) {
    drawSharedTankSprite(ctx, tank, tankColor, theme, elapsedMs);
  }

  return {
    setTheme(nextTheme) {
      theme = nextTheme;
    },
    setBotEnabled(enabled) {
      botEnabled = enabled;
      if (!enabled) {
        bot.x = -9999;
        bot.y = -9999;
        bot.cooldown = 0;
        bot.flash = 0;
        botBullets = [];
        return;
      }
      if (bot.x <= ARENA_X - 128) {
        respawnBot();
      }
    },
    setLatencyOnly(enabled) {
      latencyOnly = enabled;
    },
    queueFireInput() {
      return;
    },
    update(dt, input) {
      elapsedMs += dt * 1000;
      player.cooldown = Math.max(0, player.cooldown - dt);
      player.flash = Math.max(0, player.flash - dt);
      if (!latencyOnly && botEnabled) {
        bot.cooldown = Math.max(0, bot.cooldown - dt);
        bot.flash = Math.max(0, bot.flash - dt);
      }
      if (latencyClone) {
        latencyClone.cooldown = Math.max(0, latencyClone.cooldown - dt);
        latencyClone = {
          ...latencyClone,
          flash: Math.max(0, latencyClone.flash - dt),
        };
      }
      wallRipples = wallRipples
        .map((ripple) => ({
          ...ripple,
          life: ripple.life - dt,
        }))
        .filter((ripple) => ripple.life > 0);
      shieldPulseEffects = shieldPulseEffects
        .map((effect) => ({
          ...effect,
          life: effect.life - dt,
        }))
        .filter((effect) => effect.life > 0);
      bulletFades = advanceBulletFadesWithSmoke(bulletFades, dt, pushBulletSmoke);
      bulletSmokeEffects = advanceBulletSmokeEffects(bulletSmokeEffects, dt);
      tankExplosions = advanceTankExplosions(tankExplosions, dt);

      if (!latencyOnly) {
        const turnIntent = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const moveIntent = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);

        player.angle += turnIntent * PLAYER_TURN_SPEED * dt;

        const deltaX = Math.cos(player.angle) * moveIntent * PLAYER_SPEED * dt;
        const deltaY = Math.sin(player.angle) * moveIntent * PLAYER_SPEED * dt;
        resolveCirclePosition(player, deltaX, deltaY);
        if (botEnabled) {
          separateTanks(player, bot);
        }
      }

      const activeCloneInput = latencyOnly ? input : latencyCloneInput;
      if (latencyClone && activeCloneInput) {
        const cloneTurnIntent = (activeCloneInput.right ? 1 : 0) - (activeCloneInput.left ? 1 : 0);
        const cloneMoveIntent = (activeCloneInput.forward ? 1 : 0) - (activeCloneInput.backward ? 1 : 0);
        latencyClone.angle += cloneTurnIntent * PLAYER_TURN_SPEED * dt;
        const cloneDeltaX = Math.cos(latencyClone.angle) * cloneMoveIntent * PLAYER_SPEED * dt;
        const cloneDeltaY = Math.sin(latencyClone.angle) * cloneMoveIntent * PLAYER_SPEED * dt;
        resolveCirclePosition(latencyClone, cloneDeltaX, cloneDeltaY);
      }

      if (input.fire && !fireLatched) {
        if (latencyOnly) {
          fireLatencyCloneBullet();
        } else {
          fireBullet();
        }
      }
      fireLatched = input.fire;

      if (!latencyOnly && botEnabled) {
        botReverseTimer = Math.max(0, botReverseTimer - dt);
        const angleToPlayer = Math.atan2(player.y - bot.y, player.x - bot.x);
        const aimDelta = shortestAngleDelta(bot.angle, angleToPlayer);
        const turnIntent = clamp(aimDelta / 0.34, -1, 1);
        const distanceToPlayer = distance(bot.x, bot.y, player.x, player.y);
        let moveIntent = 0;

        if (botReverseTimer > 0) {
          bot.angle += botTurnBias * PLAYER_TURN_SPEED * 0.92 * dt;
          moveIntent = -0.76;
        } else {
          bot.angle += turnIntent * PLAYER_TURN_SPEED * dt;
          if (Math.abs(aimDelta) < BOT_MOVE_ANGLE_THRESHOLD) {
            if (distanceToPlayer > BOT_TARGET_FAR_DISTANCE) {
              moveIntent = 0.92;
            } else if (distanceToPlayer < BOT_TARGET_CLOSE_DISTANCE) {
              moveIntent = -0.7;
            } else {
              moveIntent = 0.18;
            }
          } else if (distanceToPlayer < BOT_TARGET_CLOSE_DISTANCE * 1.18) {
            moveIntent = -0.44;
          }
        }

        const botPrevX = bot.x;
        const botPrevY = bot.y;
        resolveCirclePosition(bot, Math.cos(bot.angle) * moveIntent * PLAYER_SPEED * dt, Math.sin(bot.angle) * moveIntent * PLAYER_SPEED * dt);
        separateTanks(player, bot);

        const botTravel = distance(botPrevX, botPrevY, bot.x, bot.y);
        if (Math.abs(moveIntent) > 0.12 && botTravel < 0.72) {
          botStuckTimer += dt;
          if (botStuckTimer >= BOT_STUCK_THRESHOLD_SEC) {
            botReverseTimer = BOT_REVERSE_DURATION_SEC;
            botTurnBias *= -1;
            botStuckTimer = 0;
          }
        } else {
          botStuckTimer = Math.max(0, botStuckTimer - dt * 0.5);
        }

        if (
          bot.cooldown <= 0 &&
          distanceToPlayer <= BOT_FIRE_DISTANCE &&
          Math.abs(shortestAngleDelta(bot.angle, angleToPlayer)) <= BOT_FIRE_ANGLE_THRESHOLD
        ) {
          fireBotBullet();
        }

      }

      if (!latencyOnly) {
        for (const target of targets) {
          target.phase += dt * 2.2;
        }
      }

      if (!latencyOnly) {
        bullets = bullets.flatMap((bullet) => {
          const playerPalette = getPlayerPalette(options.playerColor, theme);
          const previousX = bullet.x;
          const previousY = bullet.y;
          const nextBullet = bullet;
          nextBullet.x += bullet.vx * dt;
          nextBullet.y += bullet.vy * dt;
          nextBullet.life -= dt;
          nextBullet.age += dt;

          for (const wall of queryNearbyWalls(wallIndex, nextBullet.x, nextBullet.y, nextBullet.radius + 2)) {
            const expanded = {
              x: wall.x - nextBullet.radius,
              y: wall.y - nextBullet.radius,
              w: wall.w + nextBullet.radius * 2,
              h: wall.h + nextBullet.radius * 2,
            };
            const insideExpanded =
              nextBullet.x > expanded.x &&
              nextBullet.x < expanded.x + expanded.w &&
              nextBullet.y > expanded.y &&
              nextBullet.y < expanded.y + expanded.h;

            if (!insideExpanded) {
              continue;
            }

            let flipX = previousX <= expanded.x || previousX >= expanded.x + expanded.w;
            let flipY = previousY <= expanded.y || previousY >= expanded.y + expanded.h;

            if (!flipX && !flipY) {
              const distanceLeft = Math.abs(nextBullet.x - expanded.x);
              const distanceRight = Math.abs(expanded.x + expanded.w - nextBullet.x);
              const distanceTop = Math.abs(nextBullet.y - expanded.y);
              const distanceBottom = Math.abs(expanded.y + expanded.h - nextBullet.y);
              if (Math.min(distanceLeft, distanceRight) <= Math.min(distanceTop, distanceBottom)) {
                flipX = true;
              } else {
                flipY = true;
              }
            }

            if (flipX) {
              nextBullet.vx *= -1;
            }
            if (flipY) {
              nextBullet.vy *= -1;
            }

            ricochets += 1;
            pushWallRipple(
              wall,
              clamp(nextBullet.x, wall.x, wall.x + wall.w),
              clamp(nextBullet.y, wall.y, wall.y + wall.h),
              playerPalette.bright,
            );
            nextBullet.bouncesLeft -= 1;
            nextBullet.hasBounced = true;
            nextBullet.x = previousX + nextBullet.vx * dt * 0.4;
            nextBullet.y = previousY + nextBullet.vy * dt * 0.4;
            break;
          }

          if (
            nextBullet.life <= 0 ||
            nextBullet.bouncesLeft < 0 ||
            nextBullet.x < ARENA_X - 64 ||
            nextBullet.x > ARENA_X + ARENA_WIDTH + 64 ||
            nextBullet.y < ARENA_Y - 64 ||
            nextBullet.y > ARENA_Y + ARENA_HEIGHT + 64
          ) {
            pushBulletFade(nextBullet);
            return [];
          }

          const hitTarget = targets.find(
            (target) => distance(target.x, target.y, nextBullet.x, nextBullet.y) < target.radius + nextBullet.radius,
          );

          if (hitTarget) {
            hits += 1;
            score += 100;
            respawnTarget(hitTarget.id);
            pushBulletFade(nextBullet);
            return [];
          }

          const hitBot =
            nextBullet.age >= SELF_HIT_ARM_DELAY &&
            distance(bot.x, bot.y, nextBullet.x, nextBullet.y) < bot.radius + nextBullet.radius;

          if (hitBot) {
            pushBulletFade(nextBullet);
            bot.flash = Math.max(bot.flash, 0.12);
            destroyBot();
            return [];
          }

          const cloneState = latencyClone;
          const hitLatencyClone =
            cloneState &&
            nextBullet.age >= SELF_HIT_ARM_DELAY &&
            distance(cloneState.x, cloneState.y, nextBullet.x, nextBullet.y) < cloneState.radius + nextBullet.radius;

          if (hitLatencyClone) {
            cloneHitSeq = Math.max(cloneHitSeq, cloneHitAckSeq) + 1;
            pushBulletFade(nextBullet);
            pushTankExplosion(cloneState, cloneState.color);
            latencyClone = {
              ...cloneState,
              flash: Math.max(cloneState.flash, 0.12),
            };
            return [];
          }

          const hitSelf =
            !tankHasVisibleShield(player) &&
            Boolean(nextBullet.hasBounced) &&
            distance(player.x, player.y, nextBullet.x, nextBullet.y) < player.radius + nextBullet.radius;

          if (hitSelf) {
            pushBulletFade(nextBullet);
            destroyPlayer();
            return [];
          }

          return [nextBullet];
        });
      }

      if (!latencyOnly && botEnabled) {
        const botPalette = getPlayerPalette(BOT_PLAYER_COLOR, theme);
        botBullets = botBullets.flatMap((bullet) => {
          const previousX = bullet.x;
          const previousY = bullet.y;
          const nextBullet = bullet;
          nextBullet.x += bullet.vx * dt;
          nextBullet.y += bullet.vy * dt;
          nextBullet.life -= dt;
          nextBullet.age += dt;

          for (const wall of queryNearbyWalls(wallIndex, nextBullet.x, nextBullet.y, nextBullet.radius + 2)) {
            const expanded = {
              x: wall.x - nextBullet.radius,
              y: wall.y - nextBullet.radius,
              w: wall.w + nextBullet.radius * 2,
              h: wall.h + nextBullet.radius * 2,
            };
            const insideExpanded =
              nextBullet.x > expanded.x &&
              nextBullet.x < expanded.x + expanded.w &&
              nextBullet.y > expanded.y &&
              nextBullet.y < expanded.y + expanded.h;

            if (!insideExpanded) {
              continue;
            }

            let flipX = previousX <= expanded.x || previousX >= expanded.x + expanded.w;
            let flipY = previousY <= expanded.y || previousY >= expanded.y + expanded.h;

            if (!flipX && !flipY) {
              const distanceLeft = Math.abs(nextBullet.x - expanded.x);
              const distanceRight = Math.abs(expanded.x + expanded.w - nextBullet.x);
              const distanceTop = Math.abs(nextBullet.y - expanded.y);
              const distanceBottom = Math.abs(expanded.y + expanded.h - nextBullet.y);
              if (Math.min(distanceLeft, distanceRight) <= Math.min(distanceTop, distanceBottom)) {
                flipX = true;
              } else {
                flipY = true;
              }
            }

            if (flipX) {
              nextBullet.vx *= -1;
            }
            if (flipY) {
              nextBullet.vy *= -1;
            }

            ricochets += 1;
            pushWallRipple(
              wall,
              clamp(nextBullet.x, wall.x, wall.x + wall.w),
              clamp(nextBullet.y, wall.y, wall.y + wall.h),
              botPalette.bright,
            );
            nextBullet.bouncesLeft -= 1;
            nextBullet.hasBounced = true;
            nextBullet.x = previousX + nextBullet.vx * dt * 0.4;
            nextBullet.y = previousY + nextBullet.vy * dt * 0.4;
            break;
          }

          if (
            nextBullet.life <= 0 ||
            nextBullet.bouncesLeft < 0 ||
            nextBullet.x < ARENA_X - 64 ||
            nextBullet.x > ARENA_X + ARENA_WIDTH + 64 ||
            nextBullet.y < ARENA_Y - 64 ||
            nextBullet.y > ARENA_Y + ARENA_HEIGHT + 64
          ) {
            pushBulletFade(nextBullet);
            return [];
          }

          const hitTarget = targets.find(
            (target) => distance(target.x, target.y, nextBullet.x, nextBullet.y) < target.radius + nextBullet.radius,
          );

          if (hitTarget) {
            respawnTarget(hitTarget.id);
            pushBulletFade(nextBullet);
            return [];
          }

          const hitPlayer =
            !tankHasVisibleShield(player) &&
            nextBullet.age >= SELF_HIT_ARM_DELAY &&
            distance(player.x, player.y, nextBullet.x, nextBullet.y) < player.radius + nextBullet.radius;

          if (hitPlayer) {
            pushBulletFade(nextBullet);
            destroyPlayer();
            return [];
          }

          const hitSelf =
            !tankHasVisibleShield(bot) &&
            Boolean(nextBullet.hasBounced) &&
            distance(bot.x, bot.y, nextBullet.x, nextBullet.y) < bot.radius + nextBullet.radius;

          if (hitSelf) {
            pushBulletFade(nextBullet);
            bot.flash = Math.max(bot.flash, 0.12);
            pushTankExplosion(bot, BOT_PLAYER_COLOR);
            respawnBot();
            return [];
          }

          return [nextBullet];
        });
      }

      const activeLatencyClone = latencyClone;
      if (activeLatencyClone) {
        const clonePalette = getPlayerPalette(activeLatencyClone.color, theme);
        latencyBullets = latencyBullets.flatMap((bullet) => {
          const previousX = bullet.x;
          const previousY = bullet.y;
          const nextBullet = bullet;
          nextBullet.x += bullet.vx * dt;
          nextBullet.y += bullet.vy * dt;
          nextBullet.life -= dt;
          nextBullet.age += dt;

          for (const wall of queryNearbyWalls(wallIndex, nextBullet.x, nextBullet.y, nextBullet.radius + 2)) {
            const expanded = {
              x: wall.x - nextBullet.radius,
              y: wall.y - nextBullet.radius,
              w: wall.w + nextBullet.radius * 2,
              h: wall.h + nextBullet.radius * 2,
            };
            const insideExpanded =
              nextBullet.x > expanded.x &&
              nextBullet.x < expanded.x + expanded.w &&
              nextBullet.y > expanded.y &&
              nextBullet.y < expanded.y + expanded.h;

            if (!insideExpanded) {
              continue;
            }

            let flipX = previousX <= expanded.x || previousX >= expanded.x + expanded.w;
            let flipY = previousY <= expanded.y || previousY >= expanded.y + expanded.h;

            if (!flipX && !flipY) {
              const distanceLeft = Math.abs(nextBullet.x - expanded.x);
              const distanceRight = Math.abs(expanded.x + expanded.w - nextBullet.x);
              const distanceTop = Math.abs(nextBullet.y - expanded.y);
              const distanceBottom = Math.abs(expanded.y + expanded.h - nextBullet.y);
              if (Math.min(distanceLeft, distanceRight) <= Math.min(distanceTop, distanceBottom)) {
                flipX = true;
              } else {
                flipY = true;
              }
            }

            if (flipX) {
              nextBullet.vx *= -1;
            }
            if (flipY) {
              nextBullet.vy *= -1;
            }

            pushWallRipple(
              wall,
              clamp(nextBullet.x, wall.x, wall.x + wall.w),
              clamp(nextBullet.y, wall.y, wall.y + wall.h),
              clonePalette.bright,
            );
            nextBullet.bouncesLeft -= 1;
            nextBullet.hasBounced = true;
            nextBullet.x = previousX + nextBullet.vx * dt * 0.4;
            nextBullet.y = previousY + nextBullet.vy * dt * 0.4;
            break;
          }

          if (
            nextBullet.life <= 0 ||
            nextBullet.bouncesLeft < 0 ||
            nextBullet.x < ARENA_X - 64 ||
            nextBullet.x > ARENA_X + ARENA_WIDTH + 64 ||
            nextBullet.y < ARENA_Y - 64 ||
            nextBullet.y > ARENA_Y + ARENA_HEIGHT + 64
          ) {
            pushBulletFade(nextBullet);
            return [];
          }

          if (!latencyOnly) {
            const hitTarget = targets.find(
              (target) => distance(target.x, target.y, nextBullet.x, nextBullet.y) < target.radius + nextBullet.radius,
            );

            if (hitTarget) {
              pushBulletFade(nextBullet);
              return [];
            }

            const hitPlayer =
              !tankHasVisibleShield(player) &&
              nextBullet.age >= SELF_HIT_ARM_DELAY &&
              distance(player.x, player.y, nextBullet.x, nextBullet.y) < player.radius + nextBullet.radius;

            if (hitPlayer) {
              pushBulletFade(nextBullet);
              player.flash = Math.max(player.flash, 0.12);
              return [];
            }
          }

          const hitClone =
            !tankHasVisibleShield(activeLatencyClone) &&
            Boolean(nextBullet.hasBounced) &&
            distance(activeLatencyClone.x, activeLatencyClone.y, nextBullet.x, nextBullet.y) <
              activeLatencyClone.radius + nextBullet.radius;

          if (hitClone) {
            pushBulletFade(nextBullet);
            activeLatencyClone.flash = Math.max(activeLatencyClone.flash, 0.12);
            return [];
          }

          return [nextBullet];
        });
      }
    },
    render(ctx) {
      const darkMode = theme === "dark";
      const playerPalette = getPlayerPalette(options.playerColor, theme);
      const botPalette = getPlayerPalette(BOT_PLAYER_COLOR, theme);
      const clonePalette = latencyClone ? getPlayerPalette(latencyClone.color, theme) : null;
      const boardFill = darkMode ? ["#06111f", "#0d1f36"] : ["#fcfeff", "#e7f3ff"];
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
      const gridColor = darkMode ? "rgba(125, 211, 252, 0.08)" : "rgba(37, 99, 235, 0.1)";
      const targetOuter = hexToRgba(playerPalette.base, darkMode ? 0.28 : 0.22);
      const targetCore = playerPalette.bright;
      const auraColor = darkMode ? "rgba(96, 165, 250, 0.34)" : "rgba(96, 165, 250, 0.24)";
      const wallTime = elapsedMs / 1000;

      ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.imageSmoothingEnabled = true;

      const shellGradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      shellGradient.addColorStop(0, darkMode ? "#04101d" : "#f9fcff");
      shellGradient.addColorStop(1, darkMode ? "#091727" : "#dcebff");
      ctx.fillStyle = shellGradient;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.save();
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 24;
      const arenaGradient = ctx.createLinearGradient(ARENA_X, ARENA_Y, ARENA_X, ARENA_Y + ARENA_HEIGHT);
      arenaGradient.addColorStop(0, boardFill[0]);
      arenaGradient.addColorStop(1, boardFill[1]);
      drawRoundedRectPath(ctx, ARENA_X - 10, ARENA_Y - 10, ARENA_WIDTH + 20, ARENA_HEIGHT + 20, 28);
      ctx.fillStyle = arenaGradient;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      for (let x = ARENA_X + 60; x < ARENA_X + ARENA_WIDTH; x += 88) {
        ctx.beginPath();
        ctx.moveTo(x, ARENA_Y);
        ctx.lineTo(x, ARENA_Y + ARENA_HEIGHT);
        ctx.stroke();
      }
      for (let y = ARENA_Y + 60; y < ARENA_Y + ARENA_HEIGHT; y += 88) {
        ctx.beginPath();
        ctx.moveTo(ARENA_X, y);
        ctx.lineTo(ARENA_X + ARENA_WIDTH, y);
        ctx.stroke();
      }
      ctx.restore();

      for (const wall of walls) {
        const horizontal = wall.w >= wall.h;
        const wallMidX = wall.x + wall.w / 2;
        const wallMidY = wall.y + wall.h / 2;
        const pulse = 0.58 + 0.42 * Math.sin(wallTime * 2.1 + wall.x * 0.018 + wall.y * 0.023);
        const scanLength = horizontal ? wall.w + 40 : wall.h + 40;
        const scanOffset = ((wallTime * 74 + wall.x * 0.62 + wall.y * 0.37) % scanLength) - 20;

        ctx.save();
        drawRoundedRectPath(ctx, wall.x, wall.y, wall.w, wall.h, 12);
        const wallGradient = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
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
        drawRoundedRectPath(ctx, wall.x, wall.y, wall.w, wall.h, 12);
        ctx.clip();

        const sheenGradient = horizontal
          ? ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h)
          : ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y);
        sheenGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        sheenGradient.addColorStop(0.5, wallSheen);
        sheenGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.globalAlpha = darkMode ? 0.72 : 0.82;
        ctx.fillStyle = sheenGradient;
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

        const scanGradient = horizontal
          ? ctx.createLinearGradient(wall.x + scanOffset, wall.y, wall.x + scanOffset + 22, wall.y)
          : ctx.createLinearGradient(wall.x, wall.y + scanOffset, wall.x, wall.y + scanOffset + 22);
        scanGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        scanGradient.addColorStop(0.5, wallScan);
        scanGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.globalAlpha = 0.62 + pulse * 0.24;
        ctx.fillStyle = scanGradient;
        if (horizontal) {
          ctx.fillRect(wall.x + scanOffset, wall.y + 2, 22, Math.max(1, wall.h - 4));
        } else {
          ctx.fillRect(wall.x + 2, wall.y + scanOffset, Math.max(1, wall.w - 4), 22);
        }
        ctx.restore();

        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(wall.x + 10, wall.y + wall.h / 2);
          ctx.lineTo(wall.x + wall.w - 10, wall.y + wall.h / 2);
        } else {
          ctx.moveTo(wall.x + wall.w / 2, wall.y + 10);
          ctx.lineTo(wall.x + wall.w / 2, wall.y + wall.h - 10);
        }
        ctx.lineWidth = darkMode ? 2.4 : 2.1;
        ctx.strokeStyle = wallCore;
        ctx.stroke();

        ctx.beginPath();
        ctx.setLineDash(horizontal ? [12, 8] : [10, 8]);
        if (horizontal) {
          ctx.moveTo(wall.x + 15, wallMidY - 4);
          ctx.lineTo(wall.x + wall.w - 15, wallMidY - 4);
          ctx.moveTo(wall.x + 15, wallMidY + 4);
          ctx.lineTo(wall.x + wall.w - 15, wallMidY + 4);
        } else {
          ctx.moveTo(wallMidX - 4, wall.y + 15);
          ctx.lineTo(wallMidX - 4, wall.y + wall.h - 15);
          ctx.moveTo(wallMidX + 4, wall.y + 15);
          ctx.lineTo(wallMidX + 4, wall.y + wall.h - 15);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(wallNode, darkMode ? 0.16 + pulse * 0.12 : 0.12 + pulse * 0.1);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(wall.x + 8, wall.y + 4);
          ctx.lineTo(wall.x + 24, wall.y + 4);
          ctx.moveTo(wall.x + 8, wall.y + wall.h - 4);
          ctx.lineTo(wall.x + 24, wall.y + wall.h - 4);
          ctx.moveTo(wall.x + wall.w - 8, wall.y + 4);
          ctx.lineTo(wall.x + wall.w - 24, wall.y + 4);
          ctx.moveTo(wall.x + wall.w - 8, wall.y + wall.h - 4);
          ctx.lineTo(wall.x + wall.w - 24, wall.y + wall.h - 4);
        } else {
          ctx.moveTo(wall.x + 4, wall.y + 8);
          ctx.lineTo(wall.x + 4, wall.y + 24);
          ctx.moveTo(wall.x + wall.w - 4, wall.y + 8);
          ctx.lineTo(wall.x + wall.w - 4, wall.y + 24);
          ctx.moveTo(wall.x + 4, wall.y + wall.h - 8);
          ctx.lineTo(wall.x + 4, wall.y + wall.h - 24);
          ctx.moveTo(wall.x + wall.w - 4, wall.y + wall.h - 8);
          ctx.lineTo(wall.x + wall.w - 4, wall.y + wall.h - 24);
        }
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = wallBracket;
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = wallNode;
        ctx.shadowBlur = darkMode ? 10 : 8;
        ctx.fillStyle = wallNode;
        if (horizontal) {
          for (const nodeX of [wall.x + 16, wallMidX, wall.x + wall.w - 16]) {
            ctx.beginPath();
            ctx.arc(nodeX, wallMidY, 2.2 + pulse * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          for (const nodeY of [wall.y + 16, wallMidY, wall.y + wall.h - 16]) {
            ctx.beginPath();
            ctx.arc(wallMidX, nodeY, 2.2 + pulse * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
        ctx.restore();
      }

      for (const ripple of wallRipples) {
        const progress = 1 - ripple.life / ripple.maxLife;
        ctx.save();
        drawRoundedRectPath(ctx, ripple.wall.x, ripple.wall.y, ripple.wall.w, ripple.wall.h, 12);
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

      if (!latencyOnly) {
        for (const target of targets) {
          const pulse = 1 + Math.sin(target.phase) * 0.08;
          ctx.save();
          ctx.fillStyle = targetOuter;
          ctx.beginPath();
          ctx.arc(target.x, target.y, target.radius * 1.66 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = targetCore;
          ctx.beginPath();
          ctx.arc(target.x, target.y, target.radius * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = darkMode ? "rgba(240, 253, 244, 0.54)" : "rgba(240, 253, 244, 0.7)";
          ctx.stroke();
          ctx.font = "700 14px 'Segoe UI'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = darkMode ? "#04111d" : "#f8fafc";
          ctx.fillText(String(target.id).padStart(2, "0"), target.x, target.y + 1);
          ctx.restore();
        }

        for (const bullet of bullets) {
          drawBulletSprite(ctx, bullet, options.playerColor, theme);
        }

        if (botEnabled) {
          for (const bullet of botBullets) {
            drawBulletSprite(ctx, bullet, BOT_PLAYER_COLOR, theme);
          }
        }
      }

      if (latencyClone && clonePalette) {
        for (const bullet of latencyBullets) {
          drawBulletSprite(ctx, bullet, latencyClone.color, theme);
        }
      }

      {
        for (const fade of bulletFades) {
          const progress = fade.life / fade.maxLife;
          drawBulletSprite(ctx, fade, latencyOnly && clonePalette ? latencyClone?.color || options.playerColor : options.playerColor, theme, progress, (1 - progress) * 1.6);
        }
      }
      drawBulletSmokeEffects(ctx, bulletSmokeEffects, theme);

      drawTankExplosions(ctx, tankExplosions, theme);

      if (latencyClone && clonePalette) {
        drawTankSprite(ctx, latencyClone, latencyClone.color);
        ctx.save();
        ctx.font = "700 12px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = darkMode ? "rgba(191, 219, 254, 0.88)" : "rgba(15, 23, 42, 0.68)";
        ctx.fillText(latencyClone.player_id, latencyClone.x, latencyClone.y - latencyClone.radius - 22);
        ctx.restore();
      }

      if (!latencyOnly && botEnabled) {
        drawTankSprite(ctx, bot, BOT_PLAYER_COLOR);
        ctx.save();
        ctx.font = "700 12px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = darkMode ? "rgba(254, 226, 226, 0.88)" : "rgba(127, 29, 29, 0.72)";
        ctx.fillText(BOT_PLAYER_ID, bot.x, bot.y - bot.radius - 22);
        ctx.restore();

        drawTankSprite(ctx, player, options.playerColor);
      } else if (!latencyOnly) {
        drawTankSprite(ctx, player, options.playerColor);
      }
      drawShieldPulseEffects(ctx, shieldPulseEffects, theme);

    },
    snapshot() {
      return {
        score,
        shots,
        hits,
        bullets: bullets.length + (botEnabled ? botBullets.length : 0),
        ricochets,
        deaths,
        elapsedMs,
        mapTag,
        targetsRemaining: targets.length,
      };
    },
    buildMatchSyncState() {
      return undefined;
    },
    getMatchFireSeq() {
      return 0;
    },
    buildPreviewSnapshot() {
      return {
        authoritative_scene: true,
        theme,
        tank: {
          color: options.playerColor,
          x: player.x,
          y: player.y,
          angle: player.angle,
          radius: player.radius,
          flash: player.flash,
          weapon: "default",
          shotgun_ammo: 0,
          minigun_ammo: 0,
          double_barrel_ammo: 0,
          mine_ammo: 0,
          weapon_reload_ms: 0,
          shots,
          score,
          hits,
        },
        bullets: bullets.map((bullet) => ({
          id: bullet.id,
          color: options.playerColor,
          projectile_type: bullet.projectileType || "bullet",
          x: bullet.x,
          y: bullet.y,
          radius: bullet.radius,
          vx: bullet.vx,
          vy: bullet.vy,
          segments: bullet.segments,
        })),
        targets: targets.map((target) => ({
          id: target.id,
          x: target.x,
          y: target.y,
          radius: target.radius,
          phase: target.phase,
        })),
        mines: [],
        tankExplosions: tankExplosions.map(serializeTankExplosion),
      };
    },
    buildLatencySyncState() {
      if (latencyOnly) {
        return {
          local_player: { x: -9999, y: -9999, angle: 0, radius: PLAYER_RADIUS },
          targets: [],
        };
      }
      return {
        local_player: {
          x: player.x,
          y: player.y,
          angle: player.angle,
          radius: player.radius,
        },
        targets: targets.map((target) => ({
          id: target.id,
          x: target.x,
          y: target.y,
          radius: target.radius,
          phase: target.phase,
        })),
      };
    },
    applyLatencyState(state) {
      latencyCloneInput = state.clone_input;
      latencyCloneMeta = {
        color: state.clone.color,
        playerId: state.clone.player_id,
        countryCode: state.clone.country_code,
        resetSeq: state.clone_reset_seq,
        ackInputSeq: state.ack_input_seq,
        snapshotSeq: state.snapshot_seq,
      };

      if (!latencyClone || state.clone_reset_seq !== latencyCloneResetSeq) {
        latencyCloneResetSeq = state.clone_reset_seq;
        latencyClone = createLatencyCloneTankState(state.clone);
        latencyBullets = [];
      } else {
        applyLatencyCloneCorrection(state.clone);
      }

      addLatencyCloneFireEvents(state.fire_events);
      syncLatencyBulletsFromState(state);
      applyTargetRespawns(state.target_respawns);
      cloneHitAckSeq = Math.max(cloneHitAckSeq, state.clone_hit_ack_seq);
      cloneHitSeq = Math.max(cloneHitSeq, cloneHitAckSeq);

      if (state.local_player_hit_seq > localPlayerHitSeq) {
        localPlayerHitSeq = state.local_player_hit_seq;
        destroyPlayer();
      } else {
        localPlayerHitSeq = Math.max(localPlayerHitSeq, state.local_player_hit_seq);
      }
    },
    clearLatencyState() {
      latencyClone = null;
      latencyBullets = [];
      latencyCloneInput = null;
      latencyCloneMeta = null;
      latencyCloneResetSeq = 0;
      latencyBulletVelocities = new Map();
      seenCloneFireEventIds.clear();
      tankExplosions = [];
      localPlayerHitSeq = 0;
      cloneHitSeq = 0;
      cloneHitAckSeq = 0;
      nextPredictedLatencyBulletId = -1;
    },
    getCloneHitSeq() {
      return cloneHitSeq;
    },
  };
}

function createOnlineTankTroubleEngine(options: {
  playerId: string;
  seed: number;
  mapTag: string;
  theme: "light" | "dark";
  playerColor: string;
  customOptions?: TankTroubleCustomOptions;
  localOnly?: boolean;
}): TankTroubleEngine {
  type OnlinePlayer = {
    id: string;
    countryCode: string;
    color: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    angle: number;
    targetAngle: number;
    targetVx: number;
    targetVy: number;
    radius: number;
    flash: number;
    score: number;
    hits: number;
    deaths: number;
    shots: number;
    hp: number;
    maxHp: number;
    smokeBelow50SinceMs?: number;
    smokeBelow25SinceMs?: number;
    alive: boolean;
    respawnInMs: number;
    weapon: string;
    shotgunAmmo: number;
    minigunAmmo: number;
    doubleBarrelAmmo: number;
    mineAmmo: number;
    missileAmmo: number;
    weaponReloadMs: number;
    shieldActiveMs: number;
    shieldVisibleMs: number;
    shieldElapsedMs: number;
    shieldRadius: number;
    input: TankTroubleMatchInputState;
    serverTimeMs: number;
    snapshotReceivedAtMs: number;
    spawnSeq: number;
  };

  type OnlineBullet = {
    id: number;
    serverId?: number;
    ownerId: string;
    color: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    radius: number;
    vx: number;
    vy: number;
    targetVx: number;
    targetVy: number;
    life: number;
    age: number;
    bouncesLeft: number;
    serverTimeMs: number;
    fireSeq?: number;
    predicted?: boolean;
    hasBounced?: boolean;
    ownerShieldReleased?: boolean;
    ignoreOwnerShield?: boolean;
    projectileType?: string;
    targetId?: string;
    targetColor?: string;
    flameColor?: string;
    targetFlameColor?: string;
    locked?: boolean;
    steerLockedUntilAge?: number;
    wallHitSeq?: number;
    wallHitX?: number;
    wallHitY?: number;
    towBounceSnapUntilMs?: number;
    pathSegments?: AimSegment[];
    distanceTravelled?: number;
    segments?: AimSegment[];
  };

  let currentTheme = options.theme;
  const localOnly = Boolean(options.localOnly);
  let mapSeed = options.seed;
  let mapTag = options.mapTag;
  let customOptions = normalizeCustomOptions(options.customOptions);
  let walls = buildTrainingWalls(mapSeed);
  let wallIndex = buildWallSpatialIndex(walls);
  let elapsedMs = 0;
  let players = new Map<string, OnlinePlayer>();
  let localPlayer: OnlinePlayer = {
    id: options.playerId,
    countryCode: "",
    color: options.playerColor,
    x: -9999,
    y: -9999,
    targetX: -9999,
    targetY: -9999,
    angle: 0,
    targetAngle: 0,
    targetVx: 0,
    targetVy: 0,
    radius: PLAYER_RADIUS,
    flash: 0,
    score: 0,
    hits: 0,
    deaths: 0,
    shots: 0,
    hp: MAX_TANK_HP,
    maxHp: MAX_TANK_HP,
    alive: false,
    respawnInMs: 0,
    weapon: "default",
    shotgunAmmo: 0,
    minigunAmmo: 0,
    doubleBarrelAmmo: 0,
    mineAmmo: 0,
    missileAmmo: 0,
    weaponReloadMs: 0,
    shieldActiveMs: 0,
    shieldVisibleMs: 0,
    shieldElapsedMs: 0,
    shieldRadius: SHIELD_RADIUS,
    input: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      fire_seq: 0,
      fire_held: false,
    },
    serverTimeMs: 0,
    snapshotReceivedAtMs: 0,
    spawnSeq: 0,
  };
  let bullets: OnlineBullet[] = [];
  let targets: TrainingTarget[] = [];
  let mines: LandMine[] = [];
  let bulletFades: BulletFade[] = [];
  let bulletSmokeEffects: BulletSmokeEffect[] = [];
  let wallRipples: WallRipple[] = [];
  let shieldPulseEffects: ShieldPulseEffect[] = [];
  let tankExplosions: TankExplosionEffect[] = [];
  let powerups: TankPowerup[] = [];
  let powerupEffects: TankPowerupPickupEffect[] = [];
  let healPlusEffects: HealPlusEffect[] = [];
  let shellCasings: ShellCasing[] = [];
  let seenPowerupEffectIds = new Set<number>();
  let seenServerExplosionIds = new Set<number>();
  let killFeedEntries: KillFeedEntry[] = [];
  let seenKillFeedIds = new Set<number>();
  let localScore = 0;
  let localHits = 0;
  let localDeaths = 0;
  let localShots = 0;
  let nextRippleId = 1;
  let nextExplosionId = 1;
  let localFireLatched = false;
  let localShootCooldown = 0;
  let localFireSeq = 0;
  let localFireAckSeq = 0;
  let localFireQueued = false;
  let towControllerLockState: { x: number; y: number; angle: number; spawnSeq: number } | null = null;
  let localMinigunSpinup = 0;
  let localMinigunIdle = 0;
  let localMinigunShotAccum = 0;
  let nextPredictedBulletId = -1;
  let nextPredictedMineId = -1;
  let nextShellCasingId = 1;
  let nextLocalPowerupId = 1;
  let nextLocalPowerupAtMs = localOnly ? 0 : Number.POSITIVE_INFINITY;

  const localPowerupTemplates: Array<Pick<TankPowerup, "kind" | "color" | "symbol" | "effect" | "scoreDelta">> = [
    { kind: "cash", color: "#9ca3af", symbol: "$$", effect: "score", scoreDelta: 100 },
    { kind: "shotgun", color: "#9ca3af", symbol: "SH", effect: "shotgun", scoreDelta: 0 },
    { kind: "laser", color: "#9ca3af", symbol: "LZ", effect: "laser", scoreDelta: 0 },
    { kind: "minigun", color: "#9ca3af", symbol: "MG", effect: "minigun", scoreDelta: 0 },
    { kind: "double_barrel", color: "#9ca3af", symbol: "DB", effect: "double_barrel", scoreDelta: 0 },
    { kind: "shield", color: "#9ca3af", symbol: "SD", effect: "shield", scoreDelta: 0 },
    { kind: "land_mine", color: "#9ca3af", symbol: "AT", effect: "land_mine", scoreDelta: 0 },
    { kind: "heal", color: "#9ca3af", symbol: "+", effect: "heal", scoreDelta: 0 },
    { kind: "guided_missile", color: "#9ca3af", symbol: "GM", effect: "guided_missile", scoreDelta: 0 },
    { kind: "tow_missile", color: "#9ca3af", symbol: "TOW", effect: "tow_missile", scoreDelta: 0 },
  ];

  function spawnLocalOnlyPlayer(spawnMode: "random" | "same" = "random") {
    const rng = createSeededRandom((mapSeed ^ stringHash(options.playerId) ^ localPlayer.spawnSeq ^ localPlayer.deaths ^ Math.floor(elapsedMs)) >>> 0);
    const useSamePlace =
      spawnMode === "same" &&
      Number.isFinite(localPlayer.x) &&
      Number.isFinite(localPlayer.y) &&
      localPlayer.x > ARENA_X - 64 &&
      localPlayer.y > ARENA_Y - 64 &&
      !walls.some((wall) => circleIntersectsRect({ x: localPlayer.x, y: localPlayer.y, radius: PLAYER_RADIUS + 0.75 }, wall));
    const spawn = useSamePlace
      ? { x: localPlayer.x, y: localPlayer.y, radius: PLAYER_RADIUS }
      : pickSpawnPoint(rng, walls, [], PLAYER_RADIUS, {
          minX: ARENA_X + 52,
          maxX: ARENA_X + ARENA_WIDTH - 52,
          minY: ARENA_Y + 52,
          maxY: ARENA_Y + ARENA_HEIGHT - 52,
        });
    const spawnAngle = useSamePlace ? localPlayer.angle : rng() * Math.PI * 2;
    localPlayer.x = spawn.x;
    localPlayer.y = spawn.y;
    localPlayer.targetX = spawn.x;
    localPlayer.targetY = spawn.y;
    localPlayer.angle = spawnAngle;
    localPlayer.targetAngle = localPlayer.angle;
    localPlayer.alive = true;
    localPlayer.respawnInMs = 0;
    localPlayer.hp = MAX_TANK_HP;
    localPlayer.maxHp = MAX_TANK_HP;
    localPlayer.flash = Math.max(localPlayer.flash, 0.18);
    localPlayer.spawnSeq += 1;
    resetTankWeaponState(localPlayer);
    localShootCooldown = 0;
    localMinigunSpinup = 0;
    localMinigunIdle = 0;
    localMinigunShotAccum = 0;
    clearTowControllerLock();
    updateTankHealthThresholds(localPlayer, elapsedMs);
  }

  function tankForHealEffect(effect: Pick<TankPowerupPickupEffect, "playerId">) {
    if (effect.playerId === options.playerId) {
      return localPlayer.alive ? localPlayer : null;
    }
    const player = players.get(effect.playerId);
    return player && player.alive ? player : null;
  }

  function availableLocalPowerupTemplates() {
    const injured = localPlayer.hp < localPlayer.maxHp;
    return localPowerupTemplates.filter((template) => {
      if (template.kind !== "heal") {
        return true;
      }
      return customOptions.health_system && (customOptions.persistent_buffs || injured);
    });
  }

  function spawnLocalPowerup(kindTemplate?: Pick<TankPowerup, "kind" | "color" | "symbol" | "effect" | "scoreDelta">) {
    const templates = availableLocalPowerupTemplates();
    if (templates.length <= 0) {
      return;
    }
    const rng = createSeededRandom((mapSeed ^ nextLocalPowerupId ^ Math.floor(elapsedMs)) >>> 0);
    const template = kindTemplate ?? templates[Math.floor(rng() * templates.length) % templates.length];
    if (template.kind === "heal" && !customOptions.health_system) {
      return;
    }
    const occupied: Circle[] = [
      { x: localPlayer.x, y: localPlayer.y, radius: localPlayer.radius + 52 },
      ...powerups.map((powerup) => ({ x: powerup.x, y: powerup.y, radius: powerup.radius + 26 })),
      ...targets.map((target) => ({ x: target.x, y: target.y, radius: target.radius + 22 })),
    ];
    const spawn = pickSpawnPoint(rng, walls, occupied, TARGET_RADIUS, {
      minX: ARENA_X + 70,
      maxX: ARENA_X + ARENA_WIDTH - 70,
      minY: ARENA_Y + 62,
      maxY: ARENA_Y + ARENA_HEIGHT - 62,
    });
    powerups.push({
      id: nextLocalPowerupId,
      kind: template.kind,
      color: template.color,
      symbol: template.symbol,
      effect: template.effect,
      scoreDelta: template.scoreDelta,
      x: spawn.x,
      y: spawn.y,
      homeX: spawn.x,
      homeY: spawn.y,
      radius: TARGET_RADIUS,
      phase: rng() * Math.PI * 2,
      disabled: false,
      respawnAtMs: 0,
    });
    nextLocalPowerupId += 1;
  }

  function ensureLocalPowerups() {
    if (!localOnly) {
      return;
    }
    if (customOptions.persistent_buffs) {
      powerups = powerups.map((powerup) =>
        powerup.disabled && Number(powerup.respawnAtMs || 0) <= elapsedMs
          ? {
              ...powerup,
              disabled: false,
              respawnAtMs: 0,
              x: Number(powerup.homeX ?? powerup.x),
              y: Number(powerup.homeY ?? powerup.y),
            }
          : powerup,
      );
      if (!customOptions.health_system) {
        powerups = powerups.filter((powerup) => powerup.kind !== "heal");
      }
      const existingKinds = new Set(powerups.map((powerup) => powerup.kind));
      for (const template of availableLocalPowerupTemplates()) {
        if (!existingKinds.has(template.kind)) {
          spawnLocalPowerup(template);
          existingKinds.add(template.kind);
        }
      }
      return;
    }
    if (powerups.length <= 0 && !Number.isFinite(nextLocalPowerupAtMs)) {
      nextLocalPowerupAtMs = elapsedMs + 5000;
    }
    if (powerups.length <= 0 && elapsedMs >= nextLocalPowerupAtMs) {
      spawnLocalPowerup();
      nextLocalPowerupAtMs = Number.POSITIVE_INFINITY;
    }
  }

  function clearLocalPlayerWeaponAmmo() {
    localPlayer.shotgunAmmo = 0;
    localPlayer.minigunAmmo = 0;
    localPlayer.doubleBarrelAmmo = 0;
    localPlayer.mineAmmo = 0;
    localPlayer.missileAmmo = 0;
    localMinigunSpinup = 0;
    localMinigunIdle = 0;
    localMinigunShotAccum = 0;
  }

  function applyLocalPowerupEffect(effect: TankPowerupPickupEffect) {
    if (effect.effect === "score") {
      localScore += Math.max(0, effect.scoreDelta || 0);
      return;
    }
    if (effect.effect === "heal") {
      const beforeHp = localPlayer.hp;
      localPlayer.hp = Math.min(localPlayer.maxHp, localPlayer.hp + HEAL_AMOUNT);
      if (localPlayer.hp > beforeHp) {
        updateTankHealthThresholds(localPlayer, elapsedMs);
      }
      healPlusEffects.push(...createHealPlusEffects(effect, localPlayer));
      return;
    }
    if (effect.effect === "shield") {
      localPlayer.shieldActiveMs = SHIELD_ACTIVE_MS;
      localPlayer.shieldVisibleMs = SHIELD_VISIBLE_MS;
      localPlayer.shieldElapsedMs = 0;
      localPlayer.shieldRadius = SHIELD_RADIUS;
      return;
    }
    if (effect.effect === "shotgun") {
      localPlayer.weapon = "shotgun";
      clearLocalPlayerWeaponAmmo();
      localPlayer.shotgunAmmo = SHOTGUN_AMMO;
      return;
    }
    if (effect.effect === "laser") {
      localPlayer.weapon = "laser";
      clearLocalPlayerWeaponAmmo();
      return;
    }
    if (effect.effect === "minigun") {
      localPlayer.weapon = "minigun";
      clearLocalPlayerWeaponAmmo();
      localPlayer.minigunAmmo = MINIGUN_AMMO;
      return;
    }
    if (effect.effect === "double_barrel") {
      localPlayer.weapon = "double_barrel";
      clearLocalPlayerWeaponAmmo();
      localPlayer.doubleBarrelAmmo = DOUBLE_BARREL_AMMO;
      return;
    }
    if (effect.effect === "land_mine") {
      localPlayer.weapon = "land_mine";
      clearLocalPlayerWeaponAmmo();
      localPlayer.mineAmmo = MINE_AMMO;
      return;
    }
    if (effect.effect === "guided_missile") {
      localPlayer.weapon = "guided_missile";
      clearLocalPlayerWeaponAmmo();
      localPlayer.missileAmmo = GUIDED_MISSILE_AMMO;
      return;
    }
    if (effect.effect === "tow_missile") {
      localPlayer.weapon = "tow_missile";
      clearLocalPlayerWeaponAmmo();
      localPlayer.missileAmmo = TOW_MISSILE_AMMO;
    }
  }

  function collectLocalPowerups() {
    if (!localOnly || !localPlayer.alive) {
      return;
    }
    const remaining: TankPowerup[] = [];
    for (const powerup of powerups) {
      if (powerup.disabled) {
        remaining.push(powerup);
        continue;
      }
      if (distance(localPlayer.x, localPlayer.y, powerup.x, powerup.y) > localPlayer.radius + powerup.radius) {
        remaining.push(powerup);
        continue;
      }
      const effect: TankPowerupPickupEffect = {
        id: nextRippleId,
        powerupId: powerup.id,
        playerId: options.playerId,
        kind: powerup.kind,
        color: powerup.color,
        symbol: powerup.symbol,
        effect: powerup.effect,
        scoreDelta: powerup.scoreDelta,
        x: powerup.x,
        y: powerup.y,
        radius: powerup.radius,
        life: 0.78,
        maxLife: 0.78,
      };
      nextRippleId += 1;
      powerupEffects.push(effect);
      applyLocalPowerupEffect(effect);
      if (customOptions.persistent_buffs) {
        remaining.push({
          ...powerup,
          disabled: true,
          respawnAtMs: elapsedMs + 2000,
          x: Number(powerup.homeX ?? powerup.x),
          y: Number(powerup.homeY ?? powerup.y),
        });
      } else {
        nextLocalPowerupAtMs = elapsedMs + 5000;
      }
    }
    powerups = remaining;
  }

  if (localOnly) {
    spawnLocalOnlyPlayer();
  }

  function getActiveShieldColliders(excludeOwnerId = "", includeExcluded = false) {
    return [...players.values(), localPlayer]
      .filter(
        (player) =>
          (includeExcluded || player.id !== excludeOwnerId) &&
          player.alive &&
          Math.max(0, Number(player.shieldVisibleMs || 0)) > 0,
      )
      .map((player) => ({
        id: player.id,
        x: player.x,
        y: player.y,
        shieldRadius: Math.max(PLAYER_RADIUS + 10, Number(player.shieldRadius || SHIELD_RADIUS)),
        color: player.color,
      }));
  }

  function projectileStartsInsideOwnerShield(
    owner: Pick<OnlinePlayer, "alive" | "x" | "y" | "shieldVisibleMs" | "shieldRadius">,
    spawn: { x: number; y: number },
    radius: number,
  ) {
    if (!owner.alive || Math.max(0, Number(owner.shieldVisibleMs || 0)) <= 0) {
      return false;
    }
    const shieldCoreRadius = Math.max(PLAYER_RADIUS + 10, Number(owner.shieldRadius || SHIELD_RADIUS));
    return distance(spawn.x, spawn.y, owner.x, owner.y) <= shieldCoreRadius + Math.max(radius, LASER_RADIUS) + 2;
  }

  function shieldCollidersForProjectileStart(
    owner: Pick<OnlinePlayer, "id" | "alive" | "x" | "y" | "shieldVisibleMs" | "shieldRadius">,
    spawn: { x: number; y: number },
    radius: number,
  ) {
    const shields = getActiveShieldColliders();
    if (!projectileStartsInsideOwnerShield(owner, spawn, radius)) {
      return shields;
    }
    return shields.filter((shield) => shield.id !== owner.id);
  }

  function bulletHasLeftOwnerShield(bullet: OnlineBullet) {
    if (bullet.ignoreOwnerShield) {
      bullet.ownerShieldReleased = true;
      return false;
    }
    if (bullet.ownerShieldReleased) {
      return true;
    }
    const owner = bullet.ownerId === options.playerId ? localPlayer : players.get(bullet.ownerId);
    if (!owner || Math.max(0, Number(owner.shieldVisibleMs || 0)) <= 0) {
      bullet.ownerShieldReleased = true;
      return true;
    }
    const ownerShieldRadius = Math.max(PLAYER_RADIUS + 10, Number(owner.shieldRadius || SHIELD_RADIUS)) + bullet.radius;
    if (distance(bullet.x, bullet.y, owner.x, owner.y) > ownerShieldRadius + 2) {
      bullet.ownerShieldReleased = true;
      return true;
    }
    return true;
  }

  function pushShieldPulse(
    x: number,
    y: number,
    color: string,
    radius = SHIELD_RADIUS,
    centerX = x,
    centerY = y,
    source: "impact" | "blast" = "impact",
    life?: number,
    maxLife?: number,
  ) {
    const resolvedMaxLife = Math.max(0.08, maxLife ?? (source === "blast" ? 0.46 : 0.36));
    shieldPulseEffects.push({
      id: nextRippleId,
      x: centerX,
      y: centerY,
      impactX: x,
      impactY: y,
      radius: Math.max(PLAYER_RADIUS + 10, radius),
      color,
      life: clamp(life ?? resolvedMaxLife, 0.01, resolvedMaxLife),
      maxLife: resolvedMaxLife,
      source,
    });
    nextRippleId += 1;
    const maxPulses = bullets.length > HEAVY_PROJECTILE_THRESHOLD ? 24 : 48;
    if (shieldPulseEffects.length > maxPulses) {
      shieldPulseEffects = shieldPulseEffects.slice(-maxPulses);
    }
  }

  function removeLaserHitBullet(ownerId: string, bulletId: number) {
    if (!ownerId) {
      return;
    }
    bullets = bullets.filter((bullet) => {
      if ((bullet.projectileType || "bullet") !== "laser") {
        return true;
      }
      if (bullet.ownerId !== ownerId) {
        return true;
      }
      return false;
    });
    bulletFades = bulletFades.filter((fade) => {
      if ((fade.projectileType || "bullet") !== "laser") {
        return true;
      }
      if (fade.ownerId && fade.ownerId !== ownerId) {
        return true;
      }
      if (!fade.ownerId && bulletId && fade.serverId !== bulletId && fade.id !== bulletId) {
        return true;
      }
      return false;
    });
  }

  function pushBulletFadeFromState(
    bullet: Pick<
      OnlineBullet,
      | "id"
      | "serverId"
      | "ownerId"
      | "x"
      | "y"
      | "radius"
      | "vx"
      | "vy"
      | "age"
      | "color"
      | "projectileType"
      | "targetColor"
      | "pathSegments"
      | "distanceTravelled"
      | "segments"
    >,
  ) {
    if (bullet.projectileType === "tow_missile") {
      const existingTowFade = bulletFades.find(
        (fade) =>
          fade.projectileType === "tow_missile" &&
          ((bullet.serverId !== undefined && fade.serverId === bullet.serverId) ||
            (fade.id === bullet.id && fade.ownerId === bullet.ownerId)),
      );
      if (existingTowFade) {
        existingTowFade.x = bullet.x;
        existingTowFade.y = bullet.y;
        existingTowFade.vx = bullet.vx * 0.18;
        existingTowFade.vy = bullet.vy * 0.18;
        existingTowFade.life = Math.max(existingTowFade.life, TOW_MISSILE_FADE_LIFE * 0.72);
        existingTowFade.maxLife = Math.max(existingTowFade.maxLife, TOW_MISSILE_FADE_LIFE);
        return;
      }
    }
    const fadeLife =
      bullet.projectileType === "laser"
        ? 0.12
        : bullet.projectileType === "tow_missile"
          ? TOW_MISSILE_FADE_LIFE
          : isSteeredMissileType(bullet.projectileType)
            ? 0.44
            : 0.18;
    bulletFades.push({
      id: bullet.id,
      serverId: bullet.serverId,
      ownerId: bullet.ownerId,
      x: bullet.x,
      y: bullet.y,
      radius: bullet.radius,
      vx: bullet.vx * 0.18,
      vy: bullet.vy * 0.18,
      color: bullet.color,
      projectileType: bullet.projectileType,
      targetColor: bullet.targetColor,
      pathSegments: bullet.pathSegments,
      distanceTravelled: bullet.distanceTravelled,
      segments: bullet.segments,
      age: bullet.projectileType === "laser" ? bullet.age : undefined,
      life: fadeLife,
      maxLife: fadeLife,
    });
  }

  function pushBulletSmoke(fade: BulletFade) {
    if (!shouldSpawnProjectileSmoke(fade.projectileType)) {
      return;
    }
    if (
      bullets.length > HEAVY_PROJECTILE_THRESHOLD &&
      fade.projectileType !== "bullet" &&
      fade.projectileType !== "double_barrel"
    ) {
      return;
    }
    if (bullets.length > EXTREME_PROJECTILE_THRESHOLD && bulletSmokeEffects.length > 24) {
      return;
    }
    const ownerSeed = Array.from(String(fade.ownerId || "local")).reduce(
      (value, character) => ((value << 5) - value + character.charCodeAt(0)) | 0,
      0,
    );
    const seed =
      (mapSeed ^
        fade.id ^
        (fade.serverId || 0) ^
        ownerSeed ^
        Math.floor(fade.x * 17) ^
        Math.floor(fade.y * 31)) >>>
      0;
    bulletSmokeEffects.push(createBulletSmokeEffect(fade, seed));
    const maxSmoke = bullets.length > HEAVY_PROJECTILE_THRESHOLD ? 36 : 72;
    if (bulletSmokeEffects.length > maxSmoke) {
      bulletSmokeEffects = bulletSmokeEffects.slice(-maxSmoke);
    }
  }

  function pushWallRipple(wall: Rect, x: number, y: number, color: string) {
    if (bullets.length > HEAVY_PROJECTILE_THRESHOLD && wallRipples.length > 20) {
      return;
    }
    wallRipples.push({
      id: nextRippleId,
      wall,
      x,
      y,
      color,
      life: 0.34,
      maxLife: 0.34,
    });
    nextRippleId += 1;
    const maxRipples = bullets.length > HEAVY_PROJECTILE_THRESHOLD ? 24 : 48;
    if (wallRipples.length > maxRipples) {
      wallRipples = wallRipples.slice(-maxRipples);
    }
  }

  function findWallForImpact(x: number, y: number, radius: number) {
    const nearbyWalls = queryNearbyWalls(wallIndex, x, y, Math.max(24, radius + 8));
    let bestWall: Rect | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const wall of nearbyWalls.length ? nearbyWalls : walls) {
      const clampedX = clamp(x, wall.x, wall.x + wall.w);
      const clampedY = clamp(y, wall.y, wall.y + wall.h);
      const hitDistance = distance(x, y, clampedX, clampedY);
      if (hitDistance < bestDistance) {
        bestDistance = hitDistance;
        bestWall = wall;
      }
    }
    return bestWall;
  }

  function maybePushServerWallRipple(entry: TankTroubleMatchBulletState, previousSeq: number) {
    if ((entry.projectile_type || "bullet") !== "tow_missile") {
      return;
    }
    const wallHitSeq = Math.max(0, Math.floor(Number(entry.wall_hit_seq || 0)));
    if (wallHitSeq <= previousSeq) {
      return;
    }
    const wallHitX = Number(entry.wall_hit_x ?? entry.x);
    const wallHitY = Number(entry.wall_hit_y ?? entry.y);
    if (!Number.isFinite(wallHitX) || !Number.isFinite(wallHitY)) {
      return;
    }
    const wall = findWallForImpact(wallHitX, wallHitY, Number(entry.radius || TOW_MISSILE_RADIUS));
    if (!wall) {
      return;
    }
    pushWallRipple(wall, wallHitX, wallHitY, getPlayerPalette(entry.color, currentTheme).bright);
  }

  function syncTowBounceFromServer(entry: TankTroubleMatchBulletState, bullet: OnlineBullet, previousSeq: number) {
    if ((entry.projectile_type || "bullet") !== "tow_missile") {
      return false;
    }
    const wallHitSeq = Math.max(0, Math.floor(Number(entry.wall_hit_seq || 0)));
    if (wallHitSeq <= previousSeq) {
      return false;
    }
    maybePushServerWallRipple(entry, previousSeq);
    bullet.x = entry.x;
    bullet.y = entry.y;
    bullet.targetX = entry.x;
    bullet.targetY = entry.y;
    bullet.vx = entry.vx;
    bullet.vy = entry.vy;
    bullet.targetVx = entry.vx;
    bullet.targetVy = entry.vy;
    bullet.towBounceSnapUntilMs = elapsedMs + TOW_MISSILE_BOUNCE_SNAP_MS;
    return true;
  }

  function pushOnlineTankExplosion(tank: Pick<OnlinePlayer, "x" | "y" | "radius" | "color">) {
    if (tank.x < ARENA_X - 128 || tank.y < ARENA_Y - 128) {
      return;
    }
    const explosionId = nextExplosionId;
    nextExplosionId += 1;
    tankExplosions.push(
      createTankExplosion(explosionId, tank, tank.color, (mapSeed ^ explosionId ^ Math.floor(elapsedMs)) >>> 0),
    );
  }

  function pushOnlineExplosionAt(
    x: number,
    y: number,
    radius: number,
    color: string,
    seedSalt = 0,
  ) {
    if (x < ARENA_X - 128 || y < ARENA_Y - 128) {
      return;
    }
    const explosionId = nextExplosionId;
    nextExplosionId += 1;
    tankExplosions.push(
      createTankExplosion(
        explosionId,
        { x, y, radius: Math.max(1, radius) },
        color || options.playerColor,
        (mapSeed ^ explosionId ^ Math.floor(elapsedMs) ^ seedSalt) >>> 0,
      ),
    );
  }

  function pushLocalHitEffect(x: number, y: number, radius: number, color: string, weapon = "bullet") {
    if (x < ARENA_X - 128 || y < ARENA_Y - 128) {
      return;
    }
    const explosionId = nextExplosionId;
    nextExplosionId += 1;
    tankExplosions.push(
      createTankExplosion(
        explosionId,
        { x, y, radius: Math.max(8, radius) },
        color || localPlayer.color || options.playerColor,
        (mapSeed ^ explosionId ^ Math.floor(elapsedMs)) >>> 0,
        `hit:${weapon}`,
      ),
    );
  }

  function destroyLocalPlayer(weapon = "bullet") {
    if (!localPlayer.alive) {
      return;
    }
    pushOnlineTankExplosion(localPlayer);
    localDeaths += 1;
    localPlayer.deaths = localDeaths;
    localScore = Math.max(0, localScore - 120);
    localPlayer.score = localScore;
    localPlayer.hp = 0;
    localPlayer.alive = false;
    localPlayer.respawnInMs = PLAYER_RESPAWN_MS;
    localPlayer.flash = 0.18;
    resetTankWeaponState(localPlayer);
    clearTowControllerLock();
    localFireQueued = false;
    localFireLatched = false;
    localShootCooldown = 0;
    localMinigunSpinup = 0;
    localMinigunIdle = 0;
    localMinigunShotAccum = 0;
    updateTankHealthThresholds(localPlayer, elapsedMs);
  }

  function applyLocalPlayerDamage(
    damage: number,
    weapon = "bullet",
    hitX = localPlayer.x,
    hitY = localPlayer.y,
    hitRadius = localPlayer.radius,
  ) {
    if (!localOnly || !localPlayer.alive) {
      return false;
    }
    if (!customOptions.health_system) {
      destroyLocalPlayer(weapon);
      return true;
    }
    localPlayer.hp = clamp(localPlayer.hp - Math.max(0, damage), 0, localPlayer.maxHp);
    localPlayer.flash = Math.max(localPlayer.flash, 0.14);
    updateTankHealthThresholds(localPlayer, elapsedMs);
    if (localPlayer.hp <= 0) {
      destroyLocalPlayer(weapon);
      return true;
    }
    pushLocalHitEffect(hitX, hitY, Math.max(8, hitRadius * 0.62), localPlayer.color || options.playerColor, weapon);
    return false;
  }

  function ejectShellCasingAt(
    x: number,
    y: number,
    angle: number,
    options: { kind?: "shotgun" | "minigun"; lateralOffset?: number; seed?: number } = {},
  ) {
    const kind = options.kind || "shotgun";
    if (bullets.length > EXTREME_PROJECTILE_THRESHOLD && kind === "minigun" && shellCasings.length > 18) {
      return;
    }
    const seeded = createSeededRandom((Math.floor((options.seed ?? nextShellCasingId) * 2654435761) ^ mapSeed) >>> 0);
    const ejectionSpread = kind === "minigun" ? (seeded() - 0.5) * (Math.PI / 6) : (seeded() - 0.5) * (Math.PI / 18);
    const sideAngle = angle + Math.PI / 2 + ejectionSpread;
    const forwardJitter = kind === "minigun" ? 5 + seeded() * 4 : 7;
    const lateral = (kind === "minigun" ? 10.5 : 12) + (options.lateralOffset || 0) * 0.12;
    const sideSpeed = kind === "minigun" ? 86 + seeded() * 30 : 72;
    const backSpeed = kind === "minigun" ? 16 + seeded() * 20 : 24;
    const life = kind === "minigun" ? 0.5 + seeded() * 0.16 : 0.78;
    shellCasings.push({
      id: nextShellCasingId,
      kind,
      x: x + Math.cos(angle) * forwardJitter + Math.cos(sideAngle) * lateral,
      y: y + Math.sin(angle) * forwardJitter + Math.sin(sideAngle) * lateral,
      vx: Math.cos(sideAngle) * sideSpeed + Math.cos(angle + Math.PI) * backSpeed,
      vy: Math.sin(sideAngle) * sideSpeed + Math.sin(angle + Math.PI) * backSpeed,
      angle: angle + Math.PI / 2 + (seeded() - 0.5) * 0.45,
      spin: (kind === "minigun" ? 13.5 : 8.5) * (seeded() > 0.5 ? 1 : -1),
      life,
      maxLife: life,
    });
    nextShellCasingId += 1;
    const maxCasings = bullets.length > HEAVY_PROJECTILE_THRESHOLD ? 26 : 44;
    if (shellCasings.length > maxCasings) {
      shellCasings = shellCasings.slice(-maxCasings);
    }
  }

  function ejectShellCasing(tank: Pick<OnlinePlayer, "x" | "y" | "angle">) {
    ejectShellCasingAt(tank.x, tank.y, tank.angle);
  }

  function ejectMinigunCasing(tank: Pick<OnlinePlayer, "x" | "y" | "angle">, lateralOffset = 0, seed = 0) {
    ejectShellCasingAt(tank.x, tank.y, tank.angle, { kind: "minigun", lateralOffset, seed });
  }

  function ejectRemoteShotgunCasing(ownerId: string) {
    if (ownerId === options.playerId) {
      return;
    }
    const owner = players.get(ownerId);
    if (!owner || !owner.alive) {
      return;
    }
    ejectShellCasingAt(owner.x, owner.y, owner.angle);
  }

  function ejectRemoteMinigunCasing(ownerId: string, seed = 0) {
    if (ownerId === options.playerId) {
      return;
    }
    const owner = players.get(ownerId);
    if (!owner || !owner.alive) {
      return;
    }
    ejectMinigunCasing(owner, 0, seed);
  }

  function normalizeSegments(segments?: TankTroubleMatchBulletState["segments"]): AimSegment[] | undefined {
    if (!Array.isArray(segments) || !segments.length) {
      return undefined;
    }
    return segments
      .map((segment) => ({
        x1: Number(segment.x1 || 0),
        y1: Number(segment.y1 || 0),
        x2: Number(segment.x2 || 0),
        y2: Number(segment.y2 || 0),
      }))
      .filter((segment) => distance(segment.x1, segment.y1, segment.x2, segment.y2) > 0.1);
  }

  function normalizePathSegments(segments?: TankTroubleMatchBulletState["path_segments"]): AimSegment[] | undefined {
    return normalizeSegments(segments);
  }

  function applyLocalPlayerState(state: TankTroubleMatchLocalState | null | undefined, forcePosition = false) {
    if (!state) {
      return;
    }

    const wasAlive = localPlayer.alive;
    const respawned = !wasAlive && state.alive;
    const serverDeathAdvanced = Number(state.deaths || 0) > Number(localPlayer.deaths || 0);
    const serverSpawnSeq = Math.max(0, Number(state.spawn_seq || 0));
    const serverSpawnAdvanced = serverSpawnSeq > Math.max(0, Number(localPlayer.spawnSeq || 0));
    const died = wasAlive && !state.alive;
    const previousWeapon = localPlayer.weapon;
    if (respawned || serverDeathAdvanced || died) {
      localFireQueued = false;
      localFireLatched = false;
      clearTowControllerLock();
      bullets = bullets.filter((bullet) => bullet.ownerId !== options.playerId || bullet.serverId !== undefined);
      mines = mines.filter((mine) => !mine.local);
    }
    if (died) {
      pushOnlineTankExplosion(localPlayer);
    }
    localPlayer.countryCode = state.country_code;
    localPlayer.color = state.color || options.playerColor;
    localPlayer.weapon = String(state.weapon || "default");
    if (previousWeapon === "minigun" && localPlayer.weapon !== "minigun") {
      localMinigunSpinup = 0;
      localMinigunIdle = 0;
      localMinigunShotAccum = 0;
    }
    localPlayer.shotgunAmmo = Math.max(0, Number(state.shotgun_ammo || 0));
    localPlayer.minigunAmmo = Math.max(0, Number(state.minigun_ammo || 0));
    localPlayer.doubleBarrelAmmo = Math.max(0, Number(state.double_barrel_ammo || 0));
    localPlayer.mineAmmo = Math.max(0, Number(state.mine_ammo || 0));
    localPlayer.missileAmmo = Math.max(0, Number(state.missile_ammo || 0));
    localPlayer.weaponReloadMs = Math.max(0, Number(state.weapon_reload_ms || 0));
    localPlayer.shieldActiveMs = Math.max(0, Number(state.shield_active_ms || 0));
    localPlayer.shieldVisibleMs = Math.max(0, Number(state.shield_visible_ms || 0));
    localPlayer.shieldElapsedMs = Math.max(0, Number(state.shield_elapsed_ms || 0));
    localPlayer.shieldRadius = Math.max(PLAYER_RADIUS + 10, Number(state.shield_radius || SHIELD_RADIUS));
    localPlayer.targetX = state.x;
    localPlayer.targetY = state.y;
    localPlayer.targetAngle = state.angle;
    localPlayer.radius = state.radius;
    localPlayer.flash = Math.max(localPlayer.flash, state.flash);
    localPlayer.hp = clamp(Number(state.hp ?? MAX_TANK_HP), 0, Number(state.max_hp ?? MAX_TANK_HP));
    localPlayer.maxHp = Math.max(1, Number(state.max_hp ?? MAX_TANK_HP));
    updateTankHealthThresholds(localPlayer, elapsedMs);
    localPlayer.score = state.score;
    localPlayer.hits = state.hits;
    localPlayer.deaths = state.deaths;
    localPlayer.shots = state.shots;
    if (Number.isFinite(Number(state.fire_ack_seq))) {
      localFireAckSeq = Math.max(localFireAckSeq, Math.max(0, Math.floor(Number(state.fire_ack_seq))));
      localFireSeq = Math.max(localFireSeq, localFireAckSeq);
    }
    localPlayer.alive = state.alive;
    localPlayer.respawnInMs = state.respawn_in_ms;
    localPlayer.serverTimeMs = state.server_time_ms || localPlayer.serverTimeMs;
    localPlayer.spawnSeq = serverSpawnSeq;

    if (died) {
      resetTankWeaponState(localPlayer);
      localShootCooldown = 0;
      localMinigunSpinup = 0;
      localMinigunIdle = 0;
      localMinigunShotAccum = 0;
    }

    if (isLocalTowControllerActive()) {
      ensureTowControllerLock();
      return;
    }

    if (forcePosition || respawned || died || serverDeathAdvanced || serverSpawnAdvanced || localPlayer.x < -9000) {
      localPlayer.x = state.x;
      localPlayer.y = state.y;
      localPlayer.angle = state.angle;
      clearTowControllerLock();
      return;
    }

    if (!state.alive) {
      localPlayer.x = state.x;
      localPlayer.y = state.y;
      localPlayer.angle = state.angle;
      clearTowControllerLock();
      return;
    }

    // Normal online movement is local-authoritative; server position/angle only
    // re-seeds the tank on joins, deaths, respawns, or map changes.
  }

  function syncMinesFromState(serverMines: TankTroubleMineState[] | undefined) {
    const serverEntries = Array.isArray(serverMines) ? serverMines : [];
    const previousById = new Map(mines.filter((mine) => mine.id > 0).map((mine) => [mine.id, mine]));
    const liveServerIds = new Set(serverEntries.map((entry) => Number(entry.id || 0)).filter((id) => id > 0));
    const predicted = mines.filter((mine) => mine.id < 0);
    const nextMines: LandMine[] = [];
    const matchedPredicted = new Set<number>();

    for (const entry of serverEntries) {
      const serverId = Number(entry.id || 0);
      const existing = previousById.get(serverId);
      let visibleAlpha = existing?.visibleAlpha ?? defaultMineAlphaForAge(Number(entry.age || 0));
      if (!existing) {
        const predictedMine = predicted.find(
          (mine) =>
            !matchedPredicted.has(mine.id) &&
            mine.ownerId === String(entry.owner_id || "") &&
            distance(mine.x, mine.y, Number(entry.x || 0), Number(entry.y || 0)) <= PLAYER_RADIUS * 1.4,
        );
        if (predictedMine) {
          matchedPredicted.add(predictedMine.id);
          visibleAlpha = predictedMine.visibleAlpha ?? visibleAlpha;
        }
      }
      nextMines.push({
        ...normalizeMineState(entry, visibleAlpha),
        local: false,
      });
    }

    const nowMs = Date.now();
    for (const mine of predicted) {
      if (matchedPredicted.has(mine.id)) {
        continue;
      }
      const fireSeq = Math.max(0, Number(mine.fireSeq || 0));
      const ageMs = nowMs - Number(mine.createdAtMs || nowMs);
      if (fireSeq > 0 && fireSeq <= localFireAckSeq && ageMs > 1200) {
        continue;
      }
      if (ageMs > 3600) {
        continue;
      }
      nextMines.push(mine);
    }

    for (const mine of previousById.values()) {
      if (!liveServerIds.has(mine.id) && mine.triggered) {
        pushOnlineExplosionAt(
          mine.x,
          mine.y,
          Math.max(PLAYER_RADIUS, mine.blastRadius / 4.95),
          mine.color || options.playerColor,
          mine.id,
        );
      }
    }

    mines = nextMines;
  }

  function tryMoveLocal(player: OnlinePlayer, nextX: number, nextY: number) {
    const minX = ARENA_X + player.radius;
    const maxX = ARENA_X + ARENA_WIDTH - player.radius;
    const minY = ARENA_Y + player.radius;
    const maxY = ARENA_Y + ARENA_HEIGHT - player.radius;
    const candidateX = clamp(nextX, minX, maxX);
    const candidateY = clamp(nextY, minY, maxY);
    const candidate: Circle = { x: candidateX, y: candidateY, radius: player.radius + 0.75 };
    if (walls.some((wall) => circleIntersectsRect(candidate, wall))) {
      return false;
    }
    player.x = candidateX;
    player.y = candidateY;
    return true;
  }

  function resolveLocalPlayer(player: OnlinePlayer, deltaX: number, deltaY: number) {
    const travel = Math.hypot(deltaX, deltaY);
    const steps = Math.max(1, Math.ceil(travel / 3));
    const stepX = deltaX / steps;
    const stepY = deltaY / steps;
    for (let index = 0; index < steps; index += 1) {
      const currentX = player.x;
      const currentY = player.y;
      if (tryMoveLocal(player, currentX + stepX, currentY + stepY)) {
        continue;
      }
      const movedX = stepX !== 0 && tryMoveLocal(player, currentX + stepX, currentY);
      const movedY = stepY !== 0 && tryMoveLocal(player, currentX, currentY + stepY);
      if (movedX || movedY) {
        continue;
      }
    }
  }

  function advanceOnlinePlayer(player: OnlinePlayer, inputState: TankTroubleMatchInputState, dt: number) {
    player.shieldActiveMs = Math.max(0, player.shieldActiveMs - dt * 1000);
    player.shieldVisibleMs = Math.max(0, player.shieldVisibleMs - dt * 1000);
    if (player.shieldVisibleMs > 0) {
      player.shieldElapsedMs += dt * 1000;
    }
    if (!player.alive) {
      return;
    }
    if (player.weapon === "tow_missile_active") {
      return;
    }

    const turnIntent = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
    const moveIntent = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
    player.angle += turnIntent * PLAYER_TURN_SPEED * dt;
    const speedMultiplier = customOptions.health_system && player.hp < 25 ? 0.8 : 1;
    resolveLocalPlayer(
      player,
      Math.cos(player.angle) * moveIntent * PLAYER_SPEED * speedMultiplier * dt,
      Math.sin(player.angle) * moveIntent * PLAYER_SPEED * speedMultiplier * dt,
    );
  }

  function findGuidedMissileTarget(missile: OnlineBullet) {
    let best: OnlinePlayer | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of [localPlayer, ...players.values()]) {
      if (!candidate.alive || candidate.x < -9000) {
        continue;
      }
      const candidateDistance = distance(missile.x, missile.y, candidate.x, candidate.y);
      if (candidateDistance < bestDistance) {
        best = candidate;
        bestDistance = candidateDistance;
      }
    }
    return best;
  }

  function steerGuidedMissile(missile: OnlineBullet, dt: number) {
    if ((missile.age || 0) < GUIDED_MISSILE_LOCK_DELAY) {
      missile.locked = false;
      missile.targetId = "";
      missile.targetColor = "";
      missile.targetFlameColor = "#f8fafc";
      return;
    }
    const target = findGuidedMissileTarget(missile);
    if (!target) {
      missile.locked = false;
      missile.targetId = "";
      missile.targetColor = "";
      missile.targetFlameColor = "#f8fafc";
      return;
    }
    missile.locked = true;
    missile.targetId = target.id;
    missile.targetColor = target.color;
    missile.targetFlameColor = resolveGameColor(target.color, currentTheme);
    const speed = Math.hypot(missile.vx, missile.vy) || GUIDED_MISSILE_SPEED;
    const currentAngle = Math.atan2(missile.vy, missile.vx);
    const targetAngle = Math.atan2(target.y - missile.y, target.x - missile.x);
    const ramp = smoothStep(clamp(((missile.age || 0) - GUIDED_MISSILE_LOCK_DELAY) / GUIDED_MISSILE_TURN_RAMP_SECONDS, 0, 1));
    const maxTurn = GUIDED_MISSILE_TURN_RATE * (0.28 + ramp * 0.72) * dt;
    const nextAngle =
      currentAngle +
      clamp(shortestAngleDelta(currentAngle, targetAngle), -maxTurn, maxTurn);
    missile.vx = Math.cos(nextAngle) * speed;
    missile.vy = Math.sin(nextAngle) * speed;
    missile.targetVx = missile.vx;
    missile.targetVy = missile.vy;
  }

  function steerTowMissile(
    missile: OnlineBullet,
    inputState: TankTroubleMatchInputState,
    dt: number,
    options: { updateTargetVelocity?: boolean } = {},
  ) {
    const turnIntent = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
    const speed = Math.hypot(missile.vx, missile.vy) || TOW_MISSILE_SPEED;
    const currentAngle = Math.atan2(missile.vy, missile.vx);
    const nextAngle = currentAngle + turnIntent * TOW_MISSILE_TURN_RATE * dt;
    missile.vx = Math.cos(nextAngle) * speed;
    missile.vy = Math.sin(nextAngle) * speed;
    if (options.updateTargetVelocity ?? true) {
      missile.targetVx = missile.vx;
      missile.targetVy = missile.vy;
    }
  }

  function firePredictedLocalBullet() {
    if (!localPlayer.alive || localPlayer.x < -9000 || localShootCooldown > 0) {
      return false;
    }
    const isShotgun = localPlayer.weapon === "shotgun" && localPlayer.shotgunAmmo > 0;
    const isLaser = localPlayer.weapon === "laser";
    const isDoubleBarrel = localPlayer.weapon === "double_barrel" && localPlayer.doubleBarrelAmmo > 0;
    const isMineLayer = localPlayer.weapon === "land_mine" && localPlayer.mineAmmo > 0;
    const isGuidedMissile = localPlayer.weapon === "guided_missile" && localPlayer.missileAmmo > 0;
    const isTowMissile = localPlayer.weapon === "tow_missile" && localPlayer.missileAmmo > 0;
    if (localPlayer.weapon === "minigun") {
      return false;
    }
    if (localPlayer.weapon === "land_mine" && !isMineLayer) {
      localPlayer.weapon = "default";
    }
    if (localPlayer.weapon === "guided_missile" && !isGuidedMissile) {
      localPlayer.weapon = "default";
    }
    if (localPlayer.weapon === "tow_missile" && !isTowMissile) {
      localPlayer.weapon = "default";
    }
    if (localPlayer.weapon === "tow_missile_active") {
      return false;
    }

    const nextFireSeq = localFireSeq + 1;
    if (isMineLayer) {
      const nowMs = Date.now();
      mines.push({
        id: nextPredictedMineId,
        ownerId: options.playerId,
        color: localPlayer.color || options.playerColor,
        x: localPlayer.x,
        y: localPlayer.y,
        radius: MINE_RADIUS,
        triggerRadius: MINE_TRIGGER_RADIUS,
        blastRadius: MINE_BLAST_RADIUS,
        age: 0,
        armed: false,
        triggered: false,
        triggerStartedAtMs: 0,
        createdAtMs: nowMs,
        serverTimeMs: nowMs,
        visibleAlpha: 1,
        local: true,
        fireSeq: nextFireSeq,
      });
      nextPredictedMineId -= 1;
      localPlayer.mineAmmo = Math.max(0, localPlayer.mineAmmo - 1);
      if (localPlayer.mineAmmo <= 0) {
        localPlayer.weapon = "default";
      }
      localShootCooldown = MINE_COOLDOWN;
      localPlayer.weaponReloadMs = Math.round(MINE_COOLDOWN * 1000);
      localShots = Math.max(localShots, localPlayer.shots) + 1;
      localPlayer.shots = localShots;
      localFireSeq = nextFireSeq;
      return true;
    }

    if (isGuidedMissile) {
      const spawn = safeFireSpawnPoint(localPlayer, walls, GUIDED_MISSILE_RADIUS);
      const ignoreOwnerShield = projectileStartsInsideOwnerShield(localPlayer, spawn, GUIDED_MISSILE_RADIUS);
      bullets.push({
        id: nextPredictedBulletId,
        ownerId: options.playerId,
        color: localPlayer.color || options.playerColor,
        x: spawn.x,
        y: spawn.y,
        targetX: spawn.x,
        targetY: spawn.y,
        radius: GUIDED_MISSILE_RADIUS,
        vx: Math.cos(localPlayer.angle) * GUIDED_MISSILE_SPEED,
        vy: Math.sin(localPlayer.angle) * GUIDED_MISSILE_SPEED,
        targetVx: Math.cos(localPlayer.angle) * GUIDED_MISSILE_SPEED,
        targetVy: Math.sin(localPlayer.angle) * GUIDED_MISSILE_SPEED,
        life: GUIDED_MISSILE_LIFE,
        age: 0,
        bouncesLeft: BULLET_BOUNCES,
        serverTimeMs: 0,
        fireSeq: nextFireSeq,
        predicted: true,
        ownerShieldReleased: false,
        ignoreOwnerShield,
        projectileType: "guided_missile",
        targetId: "",
        targetColor: "",
        flameColor: "#f8fafc",
        targetFlameColor: "#f8fafc",
        locked: false,
      });
      nextPredictedBulletId -= 1;
      localPlayer.missileAmmo = Math.max(0, localPlayer.missileAmmo - 1);
      if (localPlayer.missileAmmo <= 0) {
        localPlayer.weapon = "default";
      }
      localShootCooldown = GUIDED_MISSILE_COOLDOWN;
      localPlayer.weaponReloadMs = Math.round(GUIDED_MISSILE_COOLDOWN * 1000);
      localPlayer.flash = Math.max(localPlayer.flash, 0.13);
      localShots = Math.max(localShots, localPlayer.shots) + 1;
      localPlayer.shots = localShots;
      localFireSeq = nextFireSeq;
      return true;
    }

    if (isTowMissile) {
      const spawn = safeFireSpawnPoint(localPlayer, walls, TOW_MISSILE_RADIUS);
      const ignoreOwnerShield = projectileStartsInsideOwnerShield(localPlayer, spawn, TOW_MISSILE_RADIUS);
      bullets.push({
        id: nextPredictedBulletId,
        ownerId: options.playerId,
        color: localPlayer.color || options.playerColor,
        x: spawn.x,
        y: spawn.y,
        targetX: spawn.x,
        targetY: spawn.y,
        radius: TOW_MISSILE_RADIUS,
        vx: Math.cos(localPlayer.angle) * TOW_MISSILE_SPEED,
        vy: Math.sin(localPlayer.angle) * TOW_MISSILE_SPEED,
        targetVx: Math.cos(localPlayer.angle) * TOW_MISSILE_SPEED,
        targetVy: Math.sin(localPlayer.angle) * TOW_MISSILE_SPEED,
        life: TOW_MISSILE_LIFE,
        age: 0,
        bouncesLeft: BULLET_BOUNCES,
        serverTimeMs: 0,
        fireSeq: nextFireSeq,
        predicted: true,
        ownerShieldReleased: false,
        ignoreOwnerShield,
        projectileType: "tow_missile",
        targetId: "",
        targetColor: "",
        flameColor: "#f8fafc",
        targetFlameColor: "#f8fafc",
        locked: false,
      });
      nextPredictedBulletId -= 1;
      localPlayer.missileAmmo = 0;
      localPlayer.weapon = "tow_missile_active";
      localShootCooldown = TOW_MISSILE_COOLDOWN;
      localPlayer.weaponReloadMs = Math.round(TOW_MISSILE_COOLDOWN * 1000);
      localPlayer.flash = Math.max(localPlayer.flash, 0.08);
      localShots = Math.max(localShots, localPlayer.shots) + 1;
      localPlayer.shots = localShots;
      localFireSeq = nextFireSeq;
      return true;
    }

    const activeLocalBullets = bullets.filter(
      (bullet) =>
        bullet.ownerId === options.playerId &&
        bullet.projectileType !== "shotgun" &&
        bullet.projectileType !== "laser" &&
        bullet.projectileType !== "minigun" &&
        bullet.projectileType !== "double_barrel" &&
        !isSteeredMissileType(bullet.projectileType),
    ).length;
    if (!isShotgun && !isLaser && !isDoubleBarrel && activeLocalBullets >= MAX_BULLETS) {
      return false;
    }

    if (isLaser) {
      const spawn = safeFireSpawnPoint(localPlayer, walls, LASER_RADIUS);
      const ignoreOwnerShield = projectileStartsInsideOwnerShield(localPlayer, spawn, LASER_RADIUS);
      const pathSegments = buildReflectedRaySegments(
        spawn.x,
        spawn.y,
        localPlayer.angle,
        LASER_SPEED * LASER_LIFE + LASER_LENGTH,
        walls,
        12,
        shieldCollidersForProjectileStart(localPlayer, spawn, LASER_RADIUS),
      );
      const segments = slicePathSegments(pathSegments, 0, LASER_LENGTH);
      const headSegment = segments.length ? segments[segments.length - 1] : undefined;
      bullets.push({
        id: nextPredictedBulletId,
        ownerId: options.playerId,
        color: localPlayer.color || options.playerColor,
        x: headSegment?.x2 ?? spawn.x,
        y: headSegment?.y2 ?? spawn.y,
        targetX: headSegment?.x2 ?? spawn.x,
        targetY: headSegment?.y2 ?? spawn.y,
        radius: LASER_RADIUS,
        vx: Math.cos(localPlayer.angle) * LASER_SPEED,
        vy: Math.sin(localPlayer.angle) * LASER_SPEED,
        targetVx: Math.cos(localPlayer.angle) * LASER_SPEED,
        targetVy: Math.sin(localPlayer.angle) * LASER_SPEED,
        life: LASER_LIFE,
        age: 0,
        bouncesLeft: BULLET_BOUNCES,
        serverTimeMs: 0,
        fireSeq: nextFireSeq,
        predicted: true,
        ownerShieldReleased: false,
        ignoreOwnerShield,
        projectileType: "laser",
        pathSegments,
        distanceTravelled: 0,
        segments,
      });
      nextPredictedBulletId -= 1;
      localPlayer.weapon = "default";
      localShootCooldown = LASER_COOLDOWN;
      localPlayer.weaponReloadMs = Math.round(LASER_COOLDOWN * 1000);
    } else if (isShotgun) {
      const rng = createSeededRandom(((mapSeed ^ nextFireSeq ^ Math.floor(elapsedMs)) >>> 0) || 1);
      for (let index = 0; index < SHOTGUN_PELLET_COUNT; index += 1) {
        const pelletAngle = localPlayer.angle + (rng() - 0.5) * SHOTGUN_CONE_RADIANS;
        const pelletSpeed = SHOTGUN_MIN_SPEED + rng() * (SHOTGUN_MAX_SPEED - SHOTGUN_MIN_SPEED);
        const lateralOffset = (rng() - 0.5) * SHOTGUN_BARREL_WIDTH;
        const pelletSpawn = safeFireSpawnPoint(localPlayer, walls, SHOTGUN_PELLET_RADIUS, lateralOffset);
        const ignoreOwnerShield = projectileStartsInsideOwnerShield(localPlayer, pelletSpawn, SHOTGUN_PELLET_RADIUS);
        bullets.push({
          id: nextPredictedBulletId,
          ownerId: options.playerId,
          color: localPlayer.color || options.playerColor,
          x: pelletSpawn.x,
          y: pelletSpawn.y,
          targetX: pelletSpawn.x,
          targetY: pelletSpawn.y,
          radius: SHOTGUN_PELLET_RADIUS,
          vx: Math.cos(pelletAngle) * pelletSpeed,
          vy: Math.sin(pelletAngle) * pelletSpeed,
          targetVx: Math.cos(pelletAngle) * pelletSpeed,
          targetVy: Math.sin(pelletAngle) * pelletSpeed,
          life: SHOTGUN_PELLET_LIFE,
          age: 0,
          bouncesLeft: BULLET_BOUNCES,
          serverTimeMs: 0,
          fireSeq: nextFireSeq,
          predicted: true,
          ownerShieldReleased: false,
          ignoreOwnerShield,
          projectileType: "shotgun",
        });
        nextPredictedBulletId -= 1;
      }
      localPlayer.shotgunAmmo = Math.max(0, localPlayer.shotgunAmmo - 1);
      if (localPlayer.shotgunAmmo <= 0) {
        localPlayer.weapon = "default";
      }
      localShootCooldown = SHOTGUN_COOLDOWN;
      localPlayer.weaponReloadMs = Math.round(SHOTGUN_COOLDOWN * 1000);
      ejectShellCasing(localPlayer);
    } else if (isDoubleBarrel) {
      const ammoBeforeShot = Math.max(0, localPlayer.doubleBarrelAmmo);
      const lateralOffset = doubleBarrelLateralOffset(ammoBeforeShot);
      const spawn = safeFireSpawnPoint(localPlayer, walls, BULLET_RADIUS, lateralOffset);
      const ignoreOwnerShield = projectileStartsInsideOwnerShield(localPlayer, spawn, BULLET_RADIUS);
      bullets.push({
        id: nextPredictedBulletId,
        ownerId: options.playerId,
        color: localPlayer.color || options.playerColor,
        x: spawn.x,
        y: spawn.y,
        targetX: spawn.x,
        targetY: spawn.y,
        radius: BULLET_RADIUS,
        vx: Math.cos(localPlayer.angle) * BULLET_SPEED,
        vy: Math.sin(localPlayer.angle) * BULLET_SPEED,
        targetVx: Math.cos(localPlayer.angle) * BULLET_SPEED,
        targetVy: Math.sin(localPlayer.angle) * BULLET_SPEED,
        life: BULLET_LIFE,
        age: 0,
        bouncesLeft: BULLET_BOUNCES,
        serverTimeMs: 0,
        fireSeq: nextFireSeq,
        predicted: true,
        ownerShieldReleased: false,
        ignoreOwnerShield,
        projectileType: "double_barrel",
      });
      nextPredictedBulletId -= 1;
      localPlayer.doubleBarrelAmmo = Math.max(0, localPlayer.doubleBarrelAmmo - 1);
      if (localPlayer.doubleBarrelAmmo <= 0) {
        localPlayer.weapon = "default";
      }
      localShootCooldown = DOUBLE_BARREL_COOLDOWN;
      localPlayer.weaponReloadMs = DOUBLE_BARREL_RECOIL_MS;
    } else {
      const spawn = safeFireSpawnPoint(localPlayer, walls, BULLET_RADIUS);
      const ignoreOwnerShield = projectileStartsInsideOwnerShield(localPlayer, spawn, BULLET_RADIUS);
      bullets.push({
        id: nextPredictedBulletId,
        ownerId: options.playerId,
        color: localPlayer.color || options.playerColor,
        x: spawn.x,
        y: spawn.y,
        targetX: spawn.x,
        targetY: spawn.y,
        radius: BULLET_RADIUS,
        vx: Math.cos(localPlayer.angle) * BULLET_SPEED,
        vy: Math.sin(localPlayer.angle) * BULLET_SPEED,
        targetVx: Math.cos(localPlayer.angle) * BULLET_SPEED,
        targetVy: Math.sin(localPlayer.angle) * BULLET_SPEED,
        life: BULLET_LIFE,
        age: 0,
        bouncesLeft: BULLET_BOUNCES,
        serverTimeMs: 0,
        fireSeq: nextFireSeq,
        predicted: true,
        ownerShieldReleased: false,
        ignoreOwnerShield,
        projectileType: "bullet",
      });
      nextPredictedBulletId -= 1;
      localShootCooldown = SHOOT_COOLDOWN;
    }
    localPlayer.flash = Math.max(localPlayer.flash, 0.13);
    localShots = Math.max(localShots, localPlayer.shots) + 1;
    localPlayer.shots = localShots;
    localFireSeq = nextFireSeq;
    return true;
  }

  function firePredictedMinigunBullet() {
    if (!localPlayer.alive || localPlayer.x < -9000 || localPlayer.weapon !== "minigun" || localPlayer.minigunAmmo <= 0) {
      return false;
    }

    const lateralOffset = minigunLateralOffset(localPlayer.minigunAmmo);
    const spawn = safeFireSpawnPoint(localPlayer, walls, MINIGUN_BULLET_RADIUS, lateralOffset);
    const ignoreOwnerShield = projectileStartsInsideOwnerShield(localPlayer, spawn, MINIGUN_BULLET_RADIUS);
    bullets.push({
      id: nextPredictedBulletId,
      ownerId: options.playerId,
      color: localPlayer.color || options.playerColor,
      x: spawn.x,
      y: spawn.y,
      targetX: spawn.x,
      targetY: spawn.y,
      radius: MINIGUN_BULLET_RADIUS,
      vx: Math.cos(localPlayer.angle) * MINIGUN_BULLET_SPEED,
      vy: Math.sin(localPlayer.angle) * MINIGUN_BULLET_SPEED,
      targetVx: Math.cos(localPlayer.angle) * MINIGUN_BULLET_SPEED,
      targetVy: Math.sin(localPlayer.angle) * MINIGUN_BULLET_SPEED,
      life: MINIGUN_BULLET_LIFE,
      age: 0,
      bouncesLeft: BULLET_BOUNCES,
      serverTimeMs: 0,
      predicted: true,
      ownerShieldReleased: false,
      ignoreOwnerShield,
      projectileType: "minigun",
    });
    nextPredictedBulletId -= 1;
    ejectMinigunCasing(localPlayer, lateralOffset, nextPredictedBulletId);
    localPlayer.minigunAmmo = Math.max(0, localPlayer.minigunAmmo - 1);
    if (localPlayer.minigunAmmo <= 0) {
      localPlayer.weapon = "default";
      localMinigunSpinup = 0;
      localMinigunIdle = 0;
      localMinigunShotAccum = 0;
    }
    localPlayer.flash = Math.max(localPlayer.flash, 0.1);
    localShots = Math.max(localShots, localPlayer.shots) + 1;
    localPlayer.shots = localShots;
    return true;
  }

  function handleLocalBulletTargetHit(bullet: OnlineBullet) {
    if (!localOnly) {
      return false;
    }
    if (localPlayer.alive) {
      const projectileType = bullet.projectileType || "bullet";
      const isOwnerBullet = bullet.ownerId === options.playerId;
      const canHitOwner =
        !isOwnerBullet ||
        projectileType === "laser" ||
        ((projectileType === "guided_missile" || projectileType === "tow_missile") && bullet.age >= SELF_HIT_ARM_DELAY) ||
        (projectileType !== "guided_missile" && projectileType !== "tow_missile" && Boolean(bullet.hasBounced));
      const hitRadius =
        projectileType === "guided_missile" || projectileType === "tow_missile"
          ? Math.max(bullet.radius, GUIDED_MISSILE_HIT_RADIUS)
          : bullet.radius;
      const hitLocalTank = canHitOwner && (
        projectileType === "laser"
          ? (bullet.segments || bullet.pathSegments || []).some((segment) =>
              Boolean(
                segmentCircleCollision(
                  segment.x1,
                  segment.y1,
                  segment.x2,
                  segment.y2,
                  localPlayer.x,
                  localPlayer.y,
                  localPlayer.radius + hitRadius,
                ),
              ),
            )
          : distance(localPlayer.x, localPlayer.y, bullet.x, bullet.y) <= localPlayer.radius + hitRadius
      );
      if (hitLocalTank) {
        applyLocalPlayerDamage(
          projectileDamage(projectileType),
          projectileType,
          projectileType === "laser" ? localPlayer.x : bullet.x,
          projectileType === "laser" ? localPlayer.y : bullet.y,
          bullet.radius,
        );
        pushBulletFadeFromState(bullet);
        return true;
      }
    }
    const hitIndex = targets.findIndex(
      (target) => distance(target.x, target.y, bullet.x, bullet.y) <= target.radius + bullet.radius,
    );
    if (hitIndex < 0) {
      return false;
    }
    const [target] = targets.splice(hitIndex, 1);
    localHits += 1;
    localScore += 25;
    pushBulletFadeFromState(bullet);
    tankExplosions.push(
      createTankExplosion(
        nextExplosionId,
        { x: target.x, y: target.y, radius: target.radius },
        localPlayer.color,
        (mapSeed ^ nextExplosionId ^ target.id) >>> 0,
      ),
    );
    nextExplosionId += 1;
    return true;
  }

  function resolveLocalMineDetonations() {
    if (!localOnly || !mines.length) {
      return;
    }
    const nextMines: LandMine[] = [];
    for (const mine of mines) {
      if (!mine.triggered) {
        nextMines.push(mine);
        continue;
      }
      const triggerStartedAtMs = Number(mine.triggerStartedAtMs || 0);
      if (triggerStartedAtMs <= 0 || Date.now() - triggerStartedAtMs < MINE_DETONATION_DELAY_MS) {
        nextMines.push(mine);
        continue;
      }
      pushOnlineExplosionAt(
        mine.x,
        mine.y,
        Math.max(PLAYER_RADIUS, mine.blastRadius / 4.95),
        mine.color || options.playerColor,
        mine.id,
      );
      if (
        localPlayer.alive &&
        distance(mine.x, mine.y, localPlayer.x, localPlayer.y) <= mine.blastRadius + localPlayer.radius
      ) {
        applyLocalPlayerDamage(
          LAND_MINE_DAMAGE,
          "land_mine",
          mine.x,
          mine.y,
          Math.max(PLAYER_RADIUS, mine.blastRadius / 4.95),
        );
      }
    }
    mines = nextMines;
  }

  function shouldUseServerAuthoritativeTow(bullet: OnlineBullet) {
    return isTowMissileType(bullet.projectileType) && bullet.serverId !== undefined;
  }

  function hasLocalTowMissileInFlight() {
    return bullets.some((bullet) => bullet.ownerId === options.playerId && isTowMissileType(bullet.projectileType));
  }

  function isLocalTowControllerActive() {
    return localPlayer.weapon === "tow_missile_active" || hasLocalTowMissileInFlight();
  }

  function ensureTowControllerLock() {
    if (!towControllerLockState || towControllerLockState.spawnSeq !== localPlayer.spawnSeq) {
      towControllerLockState = {
        x: localPlayer.x,
        y: localPlayer.y,
        angle: localPlayer.angle,
        spawnSeq: localPlayer.spawnSeq,
      };
    }
    localPlayer.x = towControllerLockState.x;
    localPlayer.y = towControllerLockState.y;
    localPlayer.angle = towControllerLockState.angle;
    localPlayer.targetX = towControllerLockState.x;
    localPlayer.targetY = towControllerLockState.y;
    localPlayer.targetAngle = towControllerLockState.angle;
  }

  function clearTowControllerLock() {
    towControllerLockState = null;
  }

  function bulletSnapDistance(projectileType?: string) {
    if (isTowMissileType(projectileType)) {
      return 280;
    }
    return isSteeredMissileType(projectileType) ? 120 : 420;
  }

  function shouldApplyImmediateBulletCorrection(projectileType?: string) {
    return isSteeredMissileType(projectileType) && !isTowMissileType(projectileType);
  }

  function smoothBulletTowardServerTarget(bullet: OnlineBullet, dt: number) {
    const drift = distance(bullet.x, bullet.y, bullet.targetX, bullet.targetY);
    if (isTowMissileType(bullet.projectileType) && (bullet.towBounceSnapUntilMs || 0) > elapsedMs) {
      bullet.vx = bullet.targetVx;
      bullet.vy = bullet.targetVy;
      if (drift > 56) {
        bullet.x = bullet.targetX;
        bullet.y = bullet.targetY;
      } else {
        const bounceBlend = dampFactor(18, dt);
        bullet.x += (bullet.targetX - bullet.x) * bounceBlend;
        bullet.y += (bullet.targetY - bullet.y) * bounceBlend;
      }
      return;
    }
    const velocityBlend = dampFactor(7, dt);
    const isGuidedDisplay = isSteeredMissileType(bullet.projectileType);
    const positionBlend = isGuidedDisplay
      ? dampFactor(drift > 80 ? 13 : 5.2, dt)
      : dampFactor(drift > 220 ? 7 : 1.8, dt);
    bullet.vx += (bullet.targetVx - bullet.vx) * velocityBlend;
    bullet.vy += (bullet.targetVy - bullet.vy) * velocityBlend;
    if (drift > (isGuidedDisplay ? 180 : 360)) {
      bullet.x = bullet.targetX;
      bullet.y = bullet.targetY;
    } else {
      bullet.x += (bullet.targetX - bullet.x) * positionBlend;
      bullet.y += (bullet.targetY - bullet.y) * positionBlend;
    }
  }

  function advanceOnlineBullet(bullet: OnlineBullet, dt: number): OnlineBullet | null {
    if (bullet.projectileType === "laser") {
      const pathSegments = bullet.pathSegments || bullet.segments || [];
      const maxDistanceTravelled = Math.max(0, pathSegmentsLength(pathSegments));
      const distanceTravelled = clamp(
        Math.max(0, Number(bullet.distanceTravelled || 0)) + LASER_SPEED * dt,
        0,
        maxDistanceTravelled,
      );
      const headSegments = pathSegments.length
        ? slicePathSegments(pathSegments, Math.max(0, distanceTravelled - 1), 1)
        : bullet.segments || [];
      const head = headSegments.length ? headSegments[headSegments.length - 1] : undefined;
      const nextBullet = {
        ...bullet,
        x: head?.x2 ?? bullet.x,
        y: head?.y2 ?? bullet.y,
        targetX: head?.x2 ?? bullet.targetX,
        targetY: head?.y2 ?? bullet.targetY,
        pathSegments,
        distanceTravelled,
        life: bullet.life - dt,
        age: bullet.age + dt,
      };
      if (nextBullet.life <= 0 || (pathSegments.length > 0 && distanceTravelled >= maxDistanceTravelled)) {
        pushBulletFadeFromState(nextBullet);
        return null;
      }
      return nextBullet;
    }

    const previousX = bullet.x;
    const previousY = bullet.y;
    const nextBullet = {
      ...bullet,
      x: bullet.x + bullet.vx * dt,
      y: bullet.y + bullet.vy * dt,
      life: bullet.life - dt,
      age: bullet.age + dt,
    };
    if (nextBullet.projectileType === "guided_missile") {
      steerGuidedMissile(nextBullet, dt);
    } else if (
      nextBullet.projectileType === "tow_missile" &&
      nextBullet.ownerId === options.playerId &&
      (nextBullet.serverId === undefined || (nextBullet.towBounceSnapUntilMs || 0) <= elapsedMs)
    ) {
      steerTowMissile(nextBullet, localPlayer.input, dt, {
        updateTargetVelocity: nextBullet.serverId === undefined,
      });
    }

    if (shouldUseServerAuthoritativeTow(nextBullet)) {
      if (
        nextBullet.life <= 0 ||
        nextBullet.x < ARENA_X - 64 ||
        nextBullet.x > ARENA_X + ARENA_WIDTH + 64 ||
        nextBullet.y < ARENA_Y - 64 ||
        nextBullet.y > ARENA_Y + ARENA_HEIGHT + 64
      ) {
        pushBulletFadeFromState(nextBullet);
        return null;
      }
      return nextBullet;
    }

    const allowOwnerShield = bulletHasLeftOwnerShield(nextBullet);
    for (const shield of getActiveShieldColliders(bullet.ownerId, true)) {
      if (shield.id === bullet.ownerId && nextBullet.ignoreOwnerShield) {
        continue;
      }
      if (shield.id === bullet.ownerId && !allowOwnerShield) {
        continue;
      }
      const shieldCoreRadius = Math.max(PLAYER_RADIUS + 10, Number(shield.shieldRadius || SHIELD_RADIUS));
      const shieldRadius = shieldCoreRadius + nextBullet.radius;
      if (distance(previousX, previousY, shield.x, shield.y) < shieldCoreRadius - 0.5) {
        continue;
      }
      const collision = segmentCircleCollision(previousX, previousY, nextBullet.x, nextBullet.y, shield.x, shield.y, shieldRadius);
      if (!collision) {
        continue;
      }
      const normalX = collision.normalX;
      const normalY = collision.normalY;
      const dot = nextBullet.vx * normalX + nextBullet.vy * normalY;
      nextBullet.vx -= 2 * dot * normalX;
      nextBullet.vy -= 2 * dot * normalY;
      nextBullet.bouncesLeft -= 1;
      nextBullet.hasBounced = true;
      nextBullet.x = shield.x + normalX * (shieldRadius + 2.5);
      nextBullet.y = shield.y + normalY * (shieldRadius + 2.5);
      nextBullet.ownerShieldReleased = true;
      pushShieldPulse(
        collision.x,
        collision.y,
        getPlayerPalette(shield.color, currentTheme).bright,
        Math.max(PLAYER_RADIUS + 10, Number(shield.shieldRadius || SHIELD_RADIUS)),
        shield.x,
        shield.y,
        "impact",
      );
      break;
    }

    for (const wall of queryNearbyWalls(wallIndex, nextBullet.x, nextBullet.y, nextBullet.radius + 2)) {
      const expanded = {
        x: wall.x - nextBullet.radius,
        y: wall.y - nextBullet.radius,
        w: wall.w + nextBullet.radius * 2,
        h: wall.h + nextBullet.radius * 2,
      };
      const insideExpanded =
        nextBullet.x > expanded.x &&
        nextBullet.x < expanded.x + expanded.w &&
        nextBullet.y > expanded.y &&
        nextBullet.y < expanded.y + expanded.h;

      if (!insideExpanded) {
        continue;
      }

      let flipX = previousX <= expanded.x || previousX >= expanded.x + expanded.w;
      let flipY = previousY <= expanded.y || previousY >= expanded.y + expanded.h;

      if (!flipX && !flipY) {
        const distanceLeft = Math.abs(nextBullet.x - expanded.x);
        const distanceRight = Math.abs(expanded.x + expanded.w - nextBullet.x);
        const distanceTop = Math.abs(nextBullet.y - expanded.y);
        const distanceBottom = Math.abs(expanded.y + expanded.h - nextBullet.y);
        if (Math.min(distanceLeft, distanceRight) <= Math.min(distanceTop, distanceBottom)) {
          flipX = true;
        } else {
          flipY = true;
        }
      }

      if (flipX) {
        nextBullet.vx *= -1;
      }
      if (flipY) {
        nextBullet.vy *= -1;
      }
      const wallHitX = clamp(nextBullet.x, wall.x, wall.x + wall.w);
      const wallHitY = clamp(nextBullet.y, wall.y, wall.y + wall.h);
      if (nextBullet.projectileType === "tow_missile") {
        nextBullet.wallHitSeq = Math.max(0, Math.floor(Number(nextBullet.wallHitSeq || 0))) + 1;
        nextBullet.wallHitX = wallHitX;
        nextBullet.wallHitY = wallHitY;
      }
      pushWallRipple(
        wall,
        wallHitX,
        wallHitY,
        getPlayerPalette(nextBullet.color, currentTheme).bright,
      );
      nextBullet.bouncesLeft -= 1;
      nextBullet.hasBounced = true;
      if (nextBullet.projectileType === "tow_missile") {
        const exitPadding = 0.75;
        nextBullet.x = flipX
          ? nextBullet.vx >= 0
            ? expanded.x + expanded.w + exitPadding
            : expanded.x - exitPadding
          : previousX + nextBullet.vx * dt * 0.4;
        nextBullet.y = flipY
          ? nextBullet.vy >= 0
            ? expanded.y + expanded.h + exitPadding
            : expanded.y - exitPadding
          : previousY + nextBullet.vy * dt * 0.4;
        nextBullet.targetX = nextBullet.x;
        nextBullet.targetY = nextBullet.y;
        nextBullet.targetVx = nextBullet.vx;
        nextBullet.targetVy = nextBullet.vy;
        nextBullet.towBounceSnapUntilMs = elapsedMs + TOW_MISSILE_BOUNCE_SNAP_MS;
      } else {
        nextBullet.x = previousX + nextBullet.vx * dt * 0.4;
        nextBullet.y = previousY + nextBullet.vy * dt * 0.4;
      }
      break;
    }

    if (
      nextBullet.life <= 0 ||
      nextBullet.bouncesLeft < 0 ||
      nextBullet.x < ARENA_X - 64 ||
      nextBullet.x > ARENA_X + ARENA_WIDTH + 64 ||
      nextBullet.y < ARENA_Y - 64 ||
      nextBullet.y > ARENA_Y + ARENA_HEIGHT + 64
    ) {
      pushBulletFadeFromState(nextBullet);
      return null;
    }

    return nextBullet;
  }

  function separatePlayers() {
    const livingPlayers = Array.from(players.values()).filter((player) => player.alive);
    for (let index = 0; index < livingPlayers.length; index += 1) {
      const left = livingPlayers[index];
      for (let rightIndex = index + 1; rightIndex < livingPlayers.length; rightIndex += 1) {
        const right = livingPlayers[rightIndex];
        const deltaX = left.x - right.x;
        const deltaY = left.y - right.y;
        const gap = Math.hypot(deltaX, deltaY);
        const minimumGap = left.radius + right.radius + PLAYER_COLLISION_PADDING;
        if (gap <= 0.001 || gap >= minimumGap) {
          continue;
        }
        const overlap = (minimumGap - gap) * 0.5;
        const normalX = deltaX / gap;
        const normalY = deltaY / gap;
        left.x += normalX * overlap;
        left.y += normalY * overlap;
        right.x -= normalX * overlap;
        right.y -= normalY * overlap;
      }
    }
  }

  function drawOnlineTankSprite(
    ctx: CanvasRenderingContext2D,
    tank: Pick<
      OnlinePlayer,
      | "x"
      | "y"
      | "radius"
      | "angle"
      | "flash"
      | "color"
      | "weapon"
      | "weaponReloadMs"
      | "doubleBarrelAmmo"
      | "shieldActiveMs"
      | "shieldVisibleMs"
      | "shieldElapsedMs"
      | "shieldRadius"
    >,
  ) {
    drawSharedTankSprite(ctx, tank, tank.color, currentTheme, elapsedMs);
    drawTankShield(ctx, tank, currentTheme, elapsedMs);
  }

  function drawOnlineLaserAims(ctx: CanvasRenderingContext2D) {
    for (const player of [...players.values(), localPlayer]) {
      if (!player.alive || player.weapon !== "laser") {
        continue;
      }
      const spawn = safeFireSpawnPoint(player, walls, LASER_RADIUS);
      drawLaserAimSegments(
        ctx,
        buildReflectedRaySegments(
          spawn.x,
          spawn.y,
          player.angle,
          LASER_AIM_LENGTH,
          walls,
          12,
          shieldCollidersForProjectileStart(player, spawn, LASER_RADIUS),
        ),
        player.color,
        currentTheme,
        elapsedMs,
      );
    }
  }

  function applyMatchState(state: TankTroubleMatchState) {
    const mapChanged = state.map_seed !== mapSeed || state.map_id !== mapTag;
    customOptions = normalizeCustomOptions(state.custom_options);
      if (mapChanged) {
      mapSeed = state.map_seed;
      mapTag = state.map_id;
      walls = buildTrainingWalls(mapSeed);
      wallIndex = buildWallSpatialIndex(walls);
      players = new Map();
      bullets = [];
      targets = [];
      wallRipples = [];
      bulletFades = [];
      tankExplosions = [];
      powerups = [];
      powerupEffects = [];
      healPlusEffects = [];
      mines = [];
      shellCasings = [];
      seenPowerupEffectIds = new Set();
      seenServerExplosionIds = new Set();
      killFeedEntries = [];
      seenKillFeedIds = new Set();
      localFireLatched = false;
      localShootCooldown = 0;
      localFireSeq = 0;
      localFireAckSeq = 0;
      localFireQueued = false;
      localMinigunSpinup = 0;
      localMinigunIdle = 0;
      localMinigunShotAccum = 0;
      nextPredictedBulletId = -1;
      nextPredictedMineId = -1;
    }

    applyLocalPlayerState(state.local_state, mapChanged);

    const serverPlayers = new Map(
      state.players.filter((entry) => entry.player_id !== options.playerId).map((entry) => [entry.player_id, entry]),
    );
    players.forEach((existing, id) => {
      if (!serverPlayers.has(id)) {
        players.delete(id);
      }
    });

    state.players.forEach((entry) => {
      const entryInput = normalizeMatchInputState(entry.input);
      const existing = players.get(entry.player_id);
      if (!existing) {
        players.set(entry.player_id, {
          id: entry.player_id,
          countryCode: entry.country_code,
          color: entry.color,
          x: entry.x,
          y: entry.y,
          targetX: entry.x,
          targetY: entry.y,
          angle: entry.angle,
          targetAngle: entry.angle,
          targetVx: 0,
          targetVy: 0,
          radius: entry.radius,
          flash: entry.flash,
          hp: clamp(Number(entry.hp ?? MAX_TANK_HP), 0, Number(entry.max_hp ?? MAX_TANK_HP)),
          maxHp: Math.max(1, Number(entry.max_hp ?? MAX_TANK_HP)),
          score: entry.score,
          hits: entry.hits,
          deaths: entry.deaths,
          shots: entry.shots,
          alive: entry.alive,
          respawnInMs: entry.respawn_in_ms,
          weapon: String(entry.weapon || "default"),
          shotgunAmmo: Math.max(0, Number(entry.shotgun_ammo || 0)),
          minigunAmmo: Math.max(0, Number(entry.minigun_ammo || 0)),
          doubleBarrelAmmo: Math.max(0, Number(entry.double_barrel_ammo || 0)),
          mineAmmo: Math.max(0, Number(entry.mine_ammo || 0)),
          missileAmmo: Math.max(0, Number(entry.missile_ammo || 0)),
          weaponReloadMs: Math.max(0, Number(entry.weapon_reload_ms || 0)),
          shieldActiveMs: Math.max(0, Number(entry.shield_active_ms || 0)),
          shieldVisibleMs: Math.max(0, Number(entry.shield_visible_ms || 0)),
          shieldElapsedMs: Math.max(0, Number(entry.shield_elapsed_ms || 0)),
          shieldRadius: Math.max(PLAYER_RADIUS + 10, Number(entry.shield_radius || SHIELD_RADIUS)),
          input: entryInput,
          serverTimeMs: entry.server_time_ms || 0,
          snapshotReceivedAtMs: elapsedMs,
          spawnSeq: Math.max(0, Number(entry.spawn_seq || 0)),
        });
        updateTankHealthThresholds(players.get(entry.player_id)!, elapsedMs);
        return;
      }

      const previousTargetX = existing.targetX;
      const previousTargetY = existing.targetY;
      const previousServerTimeMs = existing.serverTimeMs;
      const nextServerTimeMs = entry.server_time_ms || existing.serverTimeMs;
      const snapshotDeltaSec = Math.max(0, Math.min(0.25, (nextServerTimeMs - previousServerTimeMs) / 1000));
      existing.countryCode = entry.country_code;
      existing.color = entry.color;
      existing.targetX = entry.x;
      existing.targetY = entry.y;
      existing.targetAngle = entry.angle;
      if (snapshotDeltaSec > 0.001 && entry.alive && existing.alive) {
        existing.targetVx = clamp((entry.x - previousTargetX) / snapshotDeltaSec, -PLAYER_SPEED * 1.45, PLAYER_SPEED * 1.45);
        existing.targetVy = clamp((entry.y - previousTargetY) / snapshotDeltaSec, -PLAYER_SPEED * 1.45, PLAYER_SPEED * 1.45);
      } else {
        existing.targetVx = 0;
        existing.targetVy = 0;
      }
      existing.radius = entry.radius;
      existing.flash = Math.max(existing.flash, entry.flash);
      existing.hp = clamp(Number(entry.hp ?? MAX_TANK_HP), 0, Number(entry.max_hp ?? MAX_TANK_HP));
      existing.maxHp = Math.max(1, Number(entry.max_hp ?? MAX_TANK_HP));
      updateTankHealthThresholds(existing, elapsedMs);
      existing.score = entry.score;
      existing.hits = entry.hits;
      existing.deaths = entry.deaths;
      existing.shots = entry.shots;
      existing.weapon = String(entry.weapon || "default");
      existing.shotgunAmmo = Math.max(0, Number(entry.shotgun_ammo || 0));
      existing.minigunAmmo = Math.max(0, Number(entry.minigun_ammo || 0));
      existing.doubleBarrelAmmo = Math.max(0, Number(entry.double_barrel_ammo || 0));
      existing.mineAmmo = Math.max(0, Number(entry.mine_ammo || 0));
      existing.missileAmmo = Math.max(0, Number(entry.missile_ammo || 0));
      existing.weaponReloadMs = Math.max(0, Number(entry.weapon_reload_ms || 0));
      existing.shieldActiveMs = Math.max(0, Number(entry.shield_active_ms || 0));
      existing.shieldVisibleMs = Math.max(0, Number(entry.shield_visible_ms || 0));
      existing.shieldElapsedMs = Math.max(0, Number(entry.shield_elapsed_ms || 0));
      existing.shieldRadius = Math.max(PLAYER_RADIUS + 10, Number(entry.shield_radius || SHIELD_RADIUS));
      if (existing.alive && !entry.alive) {
        pushOnlineTankExplosion(existing);
      }
      existing.alive = entry.alive;
      existing.respawnInMs = entry.respawn_in_ms;
      existing.input = entryInput;
      existing.serverTimeMs = nextServerTimeMs;
      existing.snapshotReceivedAtMs = elapsedMs;
      existing.spawnSeq = Math.max(0, Number(entry.spawn_seq || existing.spawnSeq || 0));
      if (!entry.alive) {
        existing.x = entry.x;
        existing.y = entry.y;
        existing.angle = entry.angle;
        existing.targetVx = 0;
        existing.targetVy = 0;
      }
    });

    if (localPlayer.deaths > localDeaths || mapChanged) {
      localScore = localPlayer.score;
    } else {
      localScore = Math.max(localScore, localPlayer.score);
    }
    localHits = Math.max(localHits, localPlayer.hits);
    localDeaths = localPlayer.deaths;
    localShots = Math.max(localShots, localPlayer.shots);

    const serverLocalBullets: TankTroubleMatchBulletState[] = [];
    const serverRemoteBullets: TankTroubleMatchBulletState[] = [];
    for (const entry of state.bullets) {
      if (entry.owner_id === options.playerId) {
        serverLocalBullets.push(entry);
      } else {
        serverRemoteBullets.push(entry);
      }
    }
    const projectileLife = (projectileType?: string) => {
      if (projectileType === "shotgun") {
        return SHOTGUN_PELLET_LIFE;
      }
      if (projectileType === "laser") {
        return LASER_LIFE;
      }
      if (projectileType === "minigun") {
        return MINIGUN_BULLET_LIFE;
      }
      if (projectileType === "guided_missile") {
        return GUIDED_MISSILE_LIFE;
      }
      if (projectileType === "tow_missile") {
        return TOW_MISSILE_LIFE;
      }
      return BULLET_LIFE;
    };
    const entryAge = (entry: TankTroubleMatchBulletState) =>
      entry.age ?? Math.max(0, projectileLife(entry.projectile_type || "bullet") - entry.life);
    const liveLocalServerBulletIds = new Set(serverLocalBullets.map((entry) => entry.id));
    const localBulletsByServerId = new Map<number, OnlineBullet>();
    const unmatchedLocalBullets = bullets.filter(
      (bullet) => bullet.ownerId === options.playerId && bullet.serverId === undefined,
    );
    const unmatchedLocalBulletsByType = new Map<string, OnlineBullet[]>();
    const unmatchedLocalBulletsByFireSeq = new Map<number, OnlineBullet[]>();
    for (const bullet of bullets) {
      if (bullet.ownerId !== options.playerId) {
        continue;
      }
      if (bullet.serverId !== undefined) {
        localBulletsByServerId.set(bullet.serverId, bullet);
        continue;
      }
      const projectileType = bullet.projectileType || "bullet";
      const bucket = unmatchedLocalBulletsByType.get(projectileType);
      if (bucket) {
        bucket.push(bullet);
      } else {
        unmatchedLocalBulletsByType.set(projectileType, [bullet]);
      }
      const fireSeq = Math.max(0, Math.floor(Number(bullet.fireSeq || 0)));
      if (fireSeq > 0) {
        const fireSeqBucket = unmatchedLocalBulletsByFireSeq.get(fireSeq);
        if (fireSeqBucket) {
          fireSeqBucket.push(bullet);
        } else {
          unmatchedLocalBulletsByFireSeq.set(fireSeq, [bullet]);
        }
      }
    }

    serverLocalBullets.forEach((entry) => {
      const confirmed = localBulletsByServerId.get(entry.id);
      if (confirmed) {
        const previousWallHitSeq = Math.max(0, Math.floor(Number(confirmed.wallHitSeq || 0)));
        const snappedTowBounce = syncTowBounceFromServer(entry, confirmed, previousWallHitSeq);
        confirmed.color = entry.color;
        confirmed.radius = entry.radius;
        confirmed.projectileType = entry.projectile_type || confirmed.projectileType || "bullet";
        confirmed.targetX = entry.x;
        confirmed.targetY = entry.y;
        confirmed.targetVx = entry.vx;
        confirmed.targetVy = entry.vy;
        confirmed.targetId = entry.target_id || confirmed.targetId || "";
        confirmed.targetColor = entry.target_color || confirmed.targetColor || "";
        confirmed.locked = Boolean(entry.locked ?? confirmed.locked ?? false);
        confirmed.steerLockedUntilAge = Number(entry.steer_locked_until_age ?? confirmed.steerLockedUntilAge ?? 0);
        confirmed.wallHitSeq = Math.max(previousWallHitSeq, Math.floor(Number(entry.wall_hit_seq || 0)));
        confirmed.wallHitX = Number(entry.wall_hit_x ?? confirmed.wallHitX ?? entry.x);
        confirmed.wallHitY = Number(entry.wall_hit_y ?? confirmed.wallHitY ?? entry.y);
        confirmed.targetFlameColor = entry.flame_color || (confirmed.locked
          ? resolveGameColor(entry.target_color || confirmed.targetColor, currentTheme)
          : "#f8fafc");
        confirmed.pathSegments = normalizePathSegments(entry.path_segments);
        confirmed.distanceTravelled = Math.max(0, Number(entry.distance_travelled || 0));
        confirmed.segments = normalizeSegments(entry.segments);
        confirmed.life = Math.min(confirmed.life, entry.life);
        confirmed.age = Math.max(confirmed.age, entryAge(entry));
        confirmed.bouncesLeft = Math.min(confirmed.bouncesLeft, entry.bounces_left ?? confirmed.bouncesLeft);
        confirmed.hasBounced = Boolean(entry.has_bounced ?? confirmed.hasBounced ?? false);
        confirmed.serverTimeMs = entry.server_time_ms || confirmed.serverTimeMs;
        confirmed.predicted = false;
        if (
          !snappedTowBounce &&
          (confirmed.projectileType || "bullet") !== "laser" &&
          distance(confirmed.x, confirmed.y, entry.x, entry.y) > bulletSnapDistance(confirmed.projectileType)
        ) {
          confirmed.x = entry.x;
          confirmed.y = entry.y;
        }
        if (shouldApplyImmediateBulletCorrection(confirmed.projectileType)) {
          const correction = dampFactor(10, 1 / 30);
          confirmed.x += (entry.x - confirmed.x) * correction;
          confirmed.y += (entry.y - confirmed.y) * correction;
        }
        return;
      }

      const entryFireSeq = Math.max(0, Math.floor(Number(entry.fire_seq || 0)));
      const sameTypePredictions = unmatchedLocalBulletsByType.get(entry.projectile_type || "bullet") || [];
      const sameFireSeqPredictions = entryFireSeq > 0 ? unmatchedLocalBulletsByFireSeq.get(entryFireSeq) || [] : [];
      let predicted =
        sameFireSeqPredictions.find((bullet) => (bullet.projectileType || "bullet") === (entry.projectile_type || "bullet")) ||
        undefined;
      if (!predicted) {
        const predictedIndex = sameTypePredictions.findIndex(
          (bullet) =>
            Math.max(0, Math.floor(Number(bullet.fireSeq || 0))) <= 0 &&
            distance(bullet.x, bullet.y, entry.x, entry.y) <= Math.max(96, BULLET_SPEED * 0.35),
        );
        predicted = predictedIndex >= 0 ? sameTypePredictions[predictedIndex] : undefined;
      }
      if (predicted) {
        const unmatchedIndex = unmatchedLocalBullets.indexOf(predicted);
        if (unmatchedIndex >= 0) {
          unmatchedLocalBullets.splice(unmatchedIndex, 1);
        }
        const fireSeqBucket = unmatchedLocalBulletsByFireSeq.get(Math.max(0, Math.floor(Number(predicted.fireSeq || 0))));
        const fireSeqIndex = fireSeqBucket?.indexOf(predicted) ?? -1;
        if (fireSeqBucket && fireSeqIndex >= 0) {
          fireSeqBucket.splice(fireSeqIndex, 1);
        }
        const typeBucket = unmatchedLocalBulletsByType.get(predicted.projectileType || "bullet");
        const typeIndex = typeBucket?.indexOf(predicted) ?? -1;
        if (typeBucket && typeIndex >= 0) {
          typeBucket.splice(typeIndex, 1);
        }
      }
      if (!predicted) {
        bullets.push({
          id: nextPredictedBulletId,
          serverId: entry.id,
          ownerId: options.playerId,
          color: entry.color,
          x: entry.x,
          y: entry.y,
          targetX: entry.x,
          targetY: entry.y,
          radius: entry.radius,
          projectileType: entry.projectile_type || "bullet",
          vx: entry.vx,
          vy: entry.vy,
          targetVx: entry.vx,
          targetVy: entry.vy,
          pathSegments: normalizePathSegments(entry.path_segments),
          distanceTravelled: Math.max(0, Number(entry.distance_travelled || 0)),
          segments: normalizeSegments(entry.segments),
          life: entry.life,
          age: entryAge(entry),
          bouncesLeft: entry.bounces_left ?? BULLET_BOUNCES,
          hasBounced: Boolean(entry.has_bounced ?? false),
          serverTimeMs: entry.server_time_ms || 0,
          fireSeq: Number(entry.fire_seq || 0) || undefined,
          targetId: entry.target_id || "",
          targetColor: entry.target_color || "",
          flameColor: entry.flame_color || "#f8fafc",
          targetFlameColor: entry.flame_color || (entry.locked ? resolveGameColor(entry.target_color || "", currentTheme) : "#f8fafc"),
          locked: Boolean(entry.locked ?? false),
          steerLockedUntilAge: Number(entry.steer_locked_until_age ?? 0),
          wallHitSeq: Math.max(0, Math.floor(Number(entry.wall_hit_seq || 0))),
          wallHitX: Number(entry.wall_hit_x ?? entry.x),
          wallHitY: Number(entry.wall_hit_y ?? entry.y),
          predicted: false,
          ownerShieldReleased: Boolean(entry.owner_shield_released ?? true),
          ignoreOwnerShield: Boolean(entry.ignore_owner_shield ?? false),
        });
        nextPredictedBulletId -= 1;
        return;
      }

      predicted.serverId = entry.id;
      const previousWallHitSeq = Math.max(0, Math.floor(Number(predicted.wallHitSeq || 0)));
      const snappedTowBounce = syncTowBounceFromServer(entry, predicted, previousWallHitSeq);
      predicted.color = entry.color;
      predicted.radius = entry.radius;
      predicted.projectileType = entry.projectile_type || predicted.projectileType || "bullet";
      predicted.targetX = entry.x;
      predicted.targetY = entry.y;
      predicted.targetVx = entry.vx;
      predicted.targetVy = entry.vy;
      predicted.targetId = entry.target_id || predicted.targetId || "";
      predicted.targetColor = entry.target_color || predicted.targetColor || "";
      predicted.locked = Boolean(entry.locked ?? predicted.locked ?? false);
      predicted.steerLockedUntilAge = Number(entry.steer_locked_until_age ?? predicted.steerLockedUntilAge ?? 0);
      predicted.wallHitSeq = Math.max(previousWallHitSeq, Math.floor(Number(entry.wall_hit_seq || 0)));
      predicted.wallHitX = Number(entry.wall_hit_x ?? predicted.wallHitX ?? entry.x);
      predicted.wallHitY = Number(entry.wall_hit_y ?? predicted.wallHitY ?? entry.y);
      predicted.targetFlameColor = entry.flame_color || (predicted.locked ? resolveGameColor(entry.target_color || predicted.targetColor || "", currentTheme) : "#f8fafc");
      predicted.pathSegments = normalizePathSegments(entry.path_segments);
      predicted.distanceTravelled = Math.max(0, Number(entry.distance_travelled || 0));
      predicted.segments = normalizeSegments(entry.segments);
      predicted.fireSeq = Number(entry.fire_seq || predicted.fireSeq || 0) || undefined;
      predicted.life = Math.min(predicted.life, entry.life);
      predicted.age = Math.max(predicted.age, entryAge(entry));
      predicted.bouncesLeft = Math.min(predicted.bouncesLeft, entry.bounces_left ?? predicted.bouncesLeft);
      predicted.hasBounced = Boolean(entry.has_bounced ?? predicted.hasBounced ?? false);
        predicted.serverTimeMs = entry.server_time_ms || predicted.serverTimeMs;
        predicted.predicted = false;
        predicted.ownerShieldReleased = Boolean(entry.owner_shield_released ?? predicted.ownerShieldReleased ?? true);
        predicted.ignoreOwnerShield = Boolean(entry.ignore_owner_shield ?? predicted.ignoreOwnerShield ?? false);
        if (shouldApplyImmediateBulletCorrection(predicted.projectileType)) {
          const correction = dampFactor(10, 1 / 30);
          predicted.x += (entry.x - predicted.x) * correction;
          predicted.y += (entry.y - predicted.y) * correction;
        }
        const guidedSnapDistance = bulletSnapDistance(predicted.projectileType);
        if (
          !snappedTowBounce &&
          (predicted.projectileType || "bullet") !== "laser" &&
          distance(predicted.x, predicted.y, entry.x, entry.y) > guidedSnapDistance
        ) {
          predicted.x = entry.x;
          predicted.y = entry.y;
        }
    });

    bullets = bullets.filter((bullet) => {
      const fireSeq = Math.max(0, Math.floor(Number(bullet.fireSeq || 0)));
      if (
        bullet.ownerId === options.playerId &&
        bullet.serverId === undefined &&
        bullet.predicted &&
        fireSeq > 0 &&
        fireSeq <= localFireAckSeq
      ) {
        pushBulletFadeFromState(bullet);
        return false;
      }
      return true;
    });

    bullets = bullets.filter((bullet) => {
      if (bullet.ownerId !== options.playerId || bullet.serverId === undefined) {
        return true;
      }
      if (liveLocalServerBulletIds.has(bullet.serverId)) {
        return true;
      }
      pushBulletFadeFromState(bullet);
      return false;
    });

    const currentRemoteBullets = new Map(
      bullets.filter((bullet) => bullet.ownerId !== options.playerId).map((bullet) => [bullet.id, bullet]),
    );
    const nextRemoteBullets: OnlineBullet[] = [];
    const seenRemoteBulletIds = new Set<number>();
    const newRemoteShotgunPelletsByOwner = new Map<string, number>();
    const newRemoteMinigunBulletsByOwner = new Map<string, number>();
    const newRemoteDoubleBarrelBulletsByOwner = new Map<string, number>();
    serverRemoteBullets.forEach((entry) => {
        seenRemoteBulletIds.add(entry.id);
        const existing = currentRemoteBullets.get(entry.id);
        if (!existing) {
          nextRemoteBullets.push({
            id: entry.id,
            serverId: entry.id,
            ownerId: entry.owner_id,
            color: entry.color,
            x: entry.x,
            y: entry.y,
            targetX: entry.x,
            targetY: entry.y,
            radius: entry.radius,
            projectileType: entry.projectile_type || "bullet",
            vx: entry.vx,
            vy: entry.vy,
            targetVx: entry.vx,
            targetVy: entry.vy,
            targetId: entry.target_id || "",
            targetColor: entry.target_color || "",
            flameColor: entry.flame_color || "#f8fafc",
            targetFlameColor: entry.flame_color || (entry.locked ? resolveGameColor(entry.target_color || "", currentTheme) : "#f8fafc"),
            locked: Boolean(entry.locked ?? false),
            steerLockedUntilAge: Number(entry.steer_locked_until_age ?? 0),
            wallHitSeq: Math.max(0, Math.floor(Number(entry.wall_hit_seq || 0))),
            wallHitX: Number(entry.wall_hit_x ?? entry.x),
            wallHitY: Number(entry.wall_hit_y ?? entry.y),
            pathSegments: normalizePathSegments(entry.path_segments),
            distanceTravelled: Math.max(0, Number(entry.distance_travelled || 0)),
            segments: normalizeSegments(entry.segments),
            life: entry.life,
            age: entryAge(entry),
            bouncesLeft: entry.bounces_left ?? BULLET_BOUNCES,
            hasBounced: Boolean(entry.has_bounced ?? false),
            serverTimeMs: entry.server_time_ms || 0,
            predicted: false,
            ownerShieldReleased: Boolean(entry.owner_shield_released ?? true),
            ignoreOwnerShield: Boolean(entry.ignore_owner_shield ?? false),
          });
          if ((entry.projectile_type || "bullet") === "shotgun") {
            newRemoteShotgunPelletsByOwner.set(
              entry.owner_id,
              (newRemoteShotgunPelletsByOwner.get(entry.owner_id) || 0) + 1,
            );
          } else if ((entry.projectile_type || "bullet") === "minigun") {
            newRemoteMinigunBulletsByOwner.set(
              entry.owner_id,
              (newRemoteMinigunBulletsByOwner.get(entry.owner_id) || 0) + 1,
            );
          } else if ((entry.projectile_type || "bullet") === "double_barrel") {
            newRemoteDoubleBarrelBulletsByOwner.set(
              entry.owner_id,
              (newRemoteDoubleBarrelBulletsByOwner.get(entry.owner_id) || 0) + 1,
            );
          }
          return;
        }

        const previousWallHitSeq = Math.max(0, Math.floor(Number(existing.wallHitSeq || 0)));
        const snappedTowBounce = syncTowBounceFromServer(entry, existing, previousWallHitSeq);
        existing.color = entry.color;
        existing.projectileType = entry.projectile_type || existing.projectileType || "bullet";
        existing.targetX = entry.x;
        existing.targetY = entry.y;
        existing.radius = entry.radius;
        existing.targetVx = entry.vx;
        existing.targetVy = entry.vy;
        existing.targetId = entry.target_id || existing.targetId || "";
        existing.targetColor = entry.target_color || existing.targetColor || "";
        existing.locked = Boolean(entry.locked ?? existing.locked ?? false);
        existing.steerLockedUntilAge = Number(entry.steer_locked_until_age ?? existing.steerLockedUntilAge ?? 0);
        existing.wallHitSeq = Math.max(previousWallHitSeq, Math.floor(Number(entry.wall_hit_seq || 0)));
        existing.wallHitX = Number(entry.wall_hit_x ?? existing.wallHitX ?? entry.x);
        existing.wallHitY = Number(entry.wall_hit_y ?? existing.wallHitY ?? entry.y);
        existing.targetFlameColor = entry.flame_color || (existing.locked ? resolveGameColor(entry.target_color || existing.targetColor || "", currentTheme) : "#f8fafc");
        existing.pathSegments = normalizePathSegments(entry.path_segments);
        existing.distanceTravelled = Math.max(0, Number(entry.distance_travelled || 0));
        existing.segments = normalizeSegments(entry.segments);
        existing.life = entry.life;
        existing.age = Math.max(existing.age, entryAge(entry));
        existing.bouncesLeft = entry.bounces_left ?? existing.bouncesLeft;
        existing.hasBounced = Boolean(entry.has_bounced ?? existing.hasBounced ?? false);
        existing.serverTimeMs = entry.server_time_ms || existing.serverTimeMs;
        existing.predicted = false;
        existing.ownerShieldReleased = Boolean(entry.owner_shield_released ?? existing.ownerShieldReleased ?? true);
        existing.ignoreOwnerShield = Boolean(entry.ignore_owner_shield ?? existing.ignoreOwnerShield ?? false);
        const guidedSnapDistance = bulletSnapDistance(existing.projectileType);
        if (
          !snappedTowBounce &&
          (existing.projectileType || "bullet") !== "laser" &&
          distance(existing.x, existing.y, entry.x, entry.y) > guidedSnapDistance
        ) {
          existing.x = entry.x;
          existing.y = entry.y;
        }
        nextRemoteBullets.push(existing);
      });

    bullets.forEach((bullet) => {
      if (bullet.ownerId === options.playerId) {
        return;
      }
      if (!seenRemoteBulletIds.has(bullet.id)) {
        pushBulletFadeFromState(bullet);
      }
    });
    bullets = [...bullets.filter((bullet) => bullet.ownerId === options.playerId), ...nextRemoteBullets];

    for (const [ownerId, pelletCount] of newRemoteShotgunPelletsByOwner.entries()) {
      if (pelletCount >= Math.max(3, SHOTGUN_PELLET_COUNT / 3)) {
        ejectRemoteShotgunCasing(ownerId);
      }
    }
    for (const [ownerId, bulletCount] of newRemoteMinigunBulletsByOwner.entries()) {
      for (let index = 0; index < Math.min(4, bulletCount); index += 1) {
        ejectRemoteMinigunCasing(ownerId, elapsedMs + index * 97);
      }
    }
    for (const [ownerId, bulletCount] of newRemoteDoubleBarrelBulletsByOwner.entries()) {
      const owner = players.get(ownerId);
      if (owner) {
        owner.weaponReloadMs = Math.max(owner.weaponReloadMs, DOUBLE_BARREL_RECOIL_MS);
        owner.doubleBarrelAmmo = Math.max(0, owner.doubleBarrelAmmo - bulletCount);
      }
    }

    targets = [];
    syncMinesFromState(state.mines);
    const serverPowerups = (state.powerups || []).map(normalizePowerupState);
    powerups = serverPowerups;
    const nowMs = Date.now();
    for (const effectState of state.powerup_effects || []) {
      const effectId = Number(effectState.id || 0);
      if (!effectId || seenPowerupEffectIds.has(effectId)) {
        continue;
      }
      seenPowerupEffectIds.add(effectId);
      powerupEffects.push(normalizePowerupEffectState(effectState, nowMs));
      const normalizedEffect = powerupEffects[powerupEffects.length - 1];
      if (String(effectState.effect || "") === "heal") {
        const tank = tankForHealEffect(normalizedEffect);
        if (tank) {
          healPlusEffects.push(...createHealPlusEffects(normalizedEffect, tank));
          if (normalizedEffect.playerId === options.playerId) {
            updateTankHealthThresholds(localPlayer, elapsedMs);
          }
        }
      }
      if (String(effectState.effect || "") === "shotgun" && String(effectState.player_id || "") === options.playerId) {
        localPlayer.weapon = "shotgun";
        localPlayer.shotgunAmmo = Math.max(localPlayer.shotgunAmmo, SHOTGUN_AMMO);
        localPlayer.minigunAmmo = 0;
        localPlayer.doubleBarrelAmmo = 0;
        localPlayer.mineAmmo = 0;
        localPlayer.missileAmmo = 0;
        localMinigunSpinup = 0;
        localMinigunIdle = 0;
        localMinigunShotAccum = 0;
      }
      if (String(effectState.effect || "") === "laser" && String(effectState.player_id || "") === options.playerId) {
        localPlayer.weapon = "laser";
        localPlayer.shotgunAmmo = 0;
        localPlayer.minigunAmmo = 0;
        localPlayer.doubleBarrelAmmo = 0;
        localPlayer.mineAmmo = 0;
        localPlayer.missileAmmo = 0;
        localMinigunSpinup = 0;
        localMinigunIdle = 0;
        localMinigunShotAccum = 0;
      }
      if (String(effectState.effect || "") === "minigun" && String(effectState.player_id || "") === options.playerId) {
        localPlayer.weapon = "minigun";
        localPlayer.shotgunAmmo = 0;
        localPlayer.doubleBarrelAmmo = 0;
        localPlayer.mineAmmo = 0;
        localPlayer.missileAmmo = 0;
        localPlayer.minigunAmmo = Math.max(localPlayer.minigunAmmo, MINIGUN_AMMO);
        localMinigunSpinup = 0;
        localMinigunIdle = 0;
        localMinigunShotAccum = 0;
      }
      if (String(effectState.effect || "") === "double_barrel" && String(effectState.player_id || "") === options.playerId) {
        localPlayer.weapon = "double_barrel";
        localPlayer.shotgunAmmo = 0;
        localPlayer.minigunAmmo = 0;
        localPlayer.mineAmmo = 0;
        localPlayer.missileAmmo = 0;
        localPlayer.doubleBarrelAmmo = Math.max(localPlayer.doubleBarrelAmmo, DOUBLE_BARREL_AMMO);
        localMinigunSpinup = 0;
        localMinigunIdle = 0;
        localMinigunShotAccum = 0;
      }
      if (String(effectState.effect || "") === "land_mine" && String(effectState.player_id || "") === options.playerId) {
        localPlayer.weapon = "land_mine";
        localPlayer.shotgunAmmo = 0;
        localPlayer.minigunAmmo = 0;
        localPlayer.doubleBarrelAmmo = 0;
        localPlayer.mineAmmo = Math.max(localPlayer.mineAmmo, MINE_AMMO);
        localPlayer.missileAmmo = 0;
        localMinigunSpinup = 0;
        localMinigunIdle = 0;
        localMinigunShotAccum = 0;
      }
      if (String(effectState.effect || "") === "guided_missile" && String(effectState.player_id || "") === options.playerId) {
        localPlayer.weapon = "guided_missile";
        localPlayer.shotgunAmmo = 0;
        localPlayer.minigunAmmo = 0;
        localPlayer.doubleBarrelAmmo = 0;
        localPlayer.mineAmmo = 0;
        localPlayer.missileAmmo = Math.max(localPlayer.missileAmmo, GUIDED_MISSILE_AMMO);
        localMinigunSpinup = 0;
        localMinigunIdle = 0;
        localMinigunShotAccum = 0;
      }
      if (String(effectState.effect || "") === "tow_missile" && String(effectState.player_id || "") === options.playerId) {
        localPlayer.weapon = "tow_missile";
        localPlayer.shotgunAmmo = 0;
        localPlayer.minigunAmmo = 0;
        localPlayer.doubleBarrelAmmo = 0;
        localPlayer.mineAmmo = 0;
        localPlayer.missileAmmo = Math.max(localPlayer.missileAmmo, TOW_MISSILE_AMMO);
        localMinigunSpinup = 0;
        localMinigunIdle = 0;
        localMinigunShotAccum = 0;
      }
    }
    if (seenPowerupEffectIds.size > 400) {
      seenPowerupEffectIds = new Set(Array.from(seenPowerupEffectIds).slice(-200));
    }
    for (const explosionState of state.tank_explosions || []) {
      const explosionId = Number(explosionState.id || 0);
      if (!explosionId || seenServerExplosionIds.has(explosionId)) {
        continue;
      }
      seenServerExplosionIds.add(explosionId);
      if (String(explosionState.weapon || "") === "shield_pulse") {
        const maxLife = Math.max(0.08, Number(explosionState.maxLife || 0.46));
        const createdAtMs = Number(explosionState.created_at_ms || nowMs);
        const serverNowMs = Number(localPlayer.serverTimeMs || nowMs);
        const ageSec = Math.max(0, (serverNowMs - createdAtMs) / 1000);
        pushShieldPulse(
          Number(explosionState.x || 0),
          Number(explosionState.y || 0),
          String(explosionState.color || "green"),
          Math.max(PLAYER_RADIUS + 10, Number(explosionState.radius || SHIELD_RADIUS)),
          Number(explosionState.x || 0),
          Number(explosionState.y || 0),
          "blast",
          Math.max(0.01, maxLife - ageSec),
          maxLife,
        );
        continue;
      }
      if (String(explosionState.weapon || "") === "laser") {
        const ownerId = String(explosionState.suicide ? explosionState.victim_id || "" : explosionState.killer_id || "");
        removeLaserHitBullet(ownerId, Number(explosionState.bullet_id || 0));
      }
      tankExplosions.push(createTankExplosionFromState(explosionState, (mapSeed ^ explosionId) >>> 0));
      const killEntry = normalizeKillFeedEntry(explosionState);
      if (killEntry && !seenKillFeedIds.has(killEntry.id)) {
        seenKillFeedIds.add(killEntry.id);
        killFeedEntries.push(killEntry);
      }
    }
    if (seenServerExplosionIds.size > 400) {
      seenServerExplosionIds = new Set(Array.from(seenServerExplosionIds).slice(-200));
    }
    if (seenKillFeedIds.size > 400) {
      seenKillFeedIds = new Set(Array.from(seenKillFeedIds).slice(-200));
    }
  }

  return {
    setTheme(nextTheme) {
      currentTheme = nextTheme;
    },
    setCustomOptions(nextOptions) {
      customOptions = normalizeCustomOptions(nextOptions);
    },
    setBotEnabled() {
      return;
    },
    setLatencyOnly() {
      return;
    },
    queueFireInput() {
      localFireQueued = true;
    },
    isRapidFireWeapon() {
      return localPlayer.weapon === "minigun";
    },
    update(dt, input) {
      elapsedMs += dt * 1000;
      wallRipples = wallRipples
        .map((ripple) => ({ ...ripple, life: ripple.life - dt }))
        .filter((ripple) => ripple.life > 0);
      shieldPulseEffects = shieldPulseEffects
        .map((effect) => ({ ...effect, life: effect.life - dt }))
        .filter((effect) => effect.life > 0);
      bulletFades = advanceBulletFadesWithSmoke(bulletFades, dt, pushBulletSmoke);
      bulletSmokeEffects = advanceBulletSmokeEffects(bulletSmokeEffects, dt);
      tankExplosions = advanceTankExplosions(tankExplosions, dt);
      targets = targets.map((target) => ({ ...target, phase: target.phase + dt * 2.2 }));
      powerups = powerups
        .filter((powerup) => !powerup.disabled || customOptions.persistent_buffs)
        .map((powerup) => ({ ...powerup, phase: powerup.phase + dt * 1.8 }));
      powerupEffects = advancePowerupPickupEffects(powerupEffects, dt);
      healPlusEffects = advanceHealPlusEffects(healPlusEffects, dt);
      killFeedEntries = advanceKillFeedEntries(killFeedEntries, dt);
      shellCasings = shellCasings
        .map((shell) => ({
          ...shell,
          x: shell.x + shell.vx * dt,
          y: shell.y + shell.vy * dt,
          vx: shell.vx * Math.pow(0.08, dt),
          vy: shell.vy * Math.pow(0.08, dt) + 30 * dt,
          angle: shell.angle + shell.spin * dt,
          life: shell.life - dt,
        }))
        .filter((shell) => shell.life > 0);

      if (localOnly) {
        localPlayer.shieldActiveMs = Math.max(0, localPlayer.shieldActiveMs - dt * 1000);
        localPlayer.shieldVisibleMs = Math.max(0, localPlayer.shieldVisibleMs - dt * 1000);
        if (localPlayer.shieldVisibleMs > 0) {
          localPlayer.shieldElapsedMs += dt * 1000;
        }
        ensureLocalPowerups();
      }
      localPlayer.flash = Math.max(0, localPlayer.flash - dt);
      localShootCooldown = Math.max(0, localShootCooldown - dt);
      localPlayer.weaponReloadMs = Math.max(0, localPlayer.weaponReloadMs - dt * 1000);
      localPlayer.respawnInMs = Math.max(0, localPlayer.respawnInMs - dt * 1000);
      if (localOnly && !localPlayer.alive && localPlayer.respawnInMs <= 0) {
        spawnLocalOnlyPlayer(customOptions.same_place_respawn ? "same" : "random");
      }
      if (localPlayer.alive) {
        const towControllerActive = isLocalTowControllerActive();
        if (towControllerActive) {
          ensureTowControllerLock();
        } else {
          clearTowControllerLock();
        }
        const turnIntent = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const moveIntent = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
        if (!towControllerActive) {
          localPlayer.angle += turnIntent * PLAYER_TURN_SPEED * dt;
          const speedMultiplier = customOptions.health_system && localPlayer.hp < 25 ? 0.8 : 1;
          resolveLocalPlayer(
            localPlayer,
            Math.cos(localPlayer.angle) * moveIntent * PLAYER_SPEED * speedMultiplier * dt,
            Math.sin(localPlayer.angle) * moveIntent * PLAYER_SPEED * speedMultiplier * dt,
          );
        }
        const shouldFire = localFireQueued || (input.fire && !localFireLatched);
        localFireQueued = false;
        if (localPlayer.weapon === "minigun") {
          if (input.fire && localPlayer.minigunAmmo > 0) {
            localMinigunIdle = 0;
            localMinigunSpinup = Math.min(MINIGUN_SPINUP_SECONDS, localMinigunSpinup + dt);
            if (localMinigunSpinup >= MINIGUN_SPINUP_SECONDS) {
              localMinigunShotAccum += dt * MINIGUN_FIRE_RATE;
              while (localMinigunShotAccum >= 1 && localPlayer.minigunAmmo > 0) {
                firePredictedMinigunBullet();
                localMinigunShotAccum -= 1;
              }
            }
          } else {
            localMinigunIdle += dt;
            localMinigunShotAccum = 0;
            if (localMinigunIdle >= MINIGUN_GRACE_SECONDS) {
              localMinigunSpinup = 0;
            }
          }
        } else {
          localMinigunSpinup = 0;
          localMinigunIdle = 0;
          localMinigunShotAccum = 0;
        }
        if (shouldFire && localPlayer.weapon !== "minigun") {
          firePredictedLocalBullet();
        }
      }
      localFireLatched = input.fire;
      localPlayer.input = {
        forward: isLocalTowControllerActive() ? false : input.forward,
        backward: isLocalTowControllerActive() ? false : input.backward,
        left: input.left,
        right: input.right,
        fire_seq: localFireSeq,
        fire_held: isLocalTowControllerActive() ? false : input.fire,
      }
      if (localOnly) {
        collectLocalPowerups();
      }

      players.forEach((player) => {
        player.flash = Math.max(0, player.flash - dt);
        player.weaponReloadMs = Math.max(0, player.weaponReloadMs - dt * 1000);
        player.respawnInMs = Math.max(0, player.respawnInMs - dt * 1000);
        player.shieldActiveMs = Math.max(0, player.shieldActiveMs - dt * 1000);
        player.shieldVisibleMs = Math.max(0, player.shieldVisibleMs - dt * 1000);
        if (player.shieldVisibleMs > 0) {
          player.shieldElapsedMs += dt * 1000;
        }
        if (!player.alive) {
          const respawnBlend = dampFactor(22, dt);
          player.x += (player.targetX - player.x) * respawnBlend;
          player.y += (player.targetY - player.y) * respawnBlend;
          player.angle += shortestAngleDelta(player.angle, player.targetAngle) * dampFactor(18, dt);
          return;
        }

        const predictedLeadSec = clamp(
          (elapsedMs - Number(player.snapshotReceivedAtMs || elapsedMs)) / 1000,
          0,
          0.12,
        );
        const predictedX = player.targetX + player.targetVx * predictedLeadSec;
        const predictedY = player.targetY + player.targetVy * predictedLeadSec;
        const drift = distance(player.x, player.y, predictedX, predictedY);
        if (drift > 260 || player.spawnSeq <= 0) {
          player.x = player.targetX;
          player.y = player.targetY;
        } else {
          const correctionStrength = dampFactor(drift > 120 ? 14 : 8.5, dt);
          player.x += (predictedX - player.x) * correctionStrength;
          player.y += (predictedY - player.y) * correctionStrength;
        }
        player.angle += shortestAngleDelta(player.angle, player.targetAngle) * dampFactor(12, dt);
      });
      mines = advanceMinesVisuals(mines, [localPlayer, ...players.values()], dt);
      if (localOnly) {
        resolveLocalMineDetonations();
      }

      const nextBullets: OnlineBullet[] = [];
      for (const bullet of bullets) {
        const updatedBullet = advanceOnlineBullet(bullet, dt);
        if (!updatedBullet) {
          continue;
        }
        if (updatedBullet.projectileType === "guided_missile") {
          const targetFlameColor = updatedBullet.targetFlameColor || "#f8fafc";
          updatedBullet.flameColor = mixHexColors(updatedBullet.flameColor || "#f8fafc", targetFlameColor, dampFactor(5.8, dt));
        }
        if (updatedBullet.ownerId === options.playerId) {
          if (shouldUseServerAuthoritativeTow(updatedBullet)) {
            smoothBulletTowardServerTarget(updatedBullet, dt);
          }
          if (!handleLocalBulletTargetHit(updatedBullet)) {
            nextBullets.push(updatedBullet);
          }
          continue;
        }
        smoothBulletTowardServerTarget(updatedBullet, dt);
        nextBullets.push(updatedBullet);
      }
      bullets = nextBullets;
      if (
        isLocalTowControllerActive() &&
        !bullets.some((bullet) => bullet.ownerId === options.playerId && bullet.projectileType === "tow_missile")
      ) {
        localPlayer.weapon = "default";
        localPlayer.missileAmmo = 0;
        clearTowControllerLock();
      }
    },
    render(ctx) {
      const darkMode = currentTheme === "dark";
      const playerPalette = getPlayerPalette(options.playerColor, currentTheme);
      const boardFill = darkMode ? ["#06111f", "#0d1f36"] : ["#fcfeff", "#e7f3ff"];
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
      const gridColor = darkMode ? "rgba(125, 211, 252, 0.08)" : "rgba(37, 99, 235, 0.1)";
      const wallTime = elapsedMs / 1000;
      const shellGradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.imageSmoothingEnabled = true;
      shellGradient.addColorStop(0, darkMode ? "#04101d" : "#f9fcff");
      shellGradient.addColorStop(1, darkMode ? "#091727" : "#dcebff");
      ctx.fillStyle = shellGradient;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.save();
      ctx.shadowColor = darkMode ? "rgba(96, 165, 250, 0.34)" : "rgba(96, 165, 250, 0.24)";
      ctx.shadowBlur = 24;
      const arenaGradient = ctx.createLinearGradient(ARENA_X, ARENA_Y, ARENA_X, ARENA_Y + ARENA_HEIGHT);
      arenaGradient.addColorStop(0, boardFill[0]);
      arenaGradient.addColorStop(1, boardFill[1]);
      drawRoundedRectPath(ctx, ARENA_X - 10, ARENA_Y - 10, ARENA_WIDTH + 20, ARENA_HEIGHT + 20, 28);
      ctx.fillStyle = arenaGradient;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      for (let x = ARENA_X + 60; x < ARENA_X + ARENA_WIDTH; x += 88) {
        ctx.beginPath();
        ctx.moveTo(x, ARENA_Y);
        ctx.lineTo(x, ARENA_Y + ARENA_HEIGHT);
        ctx.stroke();
      }
      for (let y = ARENA_Y + 60; y < ARENA_Y + ARENA_HEIGHT; y += 88) {
        ctx.beginPath();
        ctx.moveTo(ARENA_X, y);
        ctx.lineTo(ARENA_X + ARENA_WIDTH, y);
        ctx.stroke();
      }
      ctx.restore();

      for (const wall of walls) {
        const horizontal = wall.w >= wall.h;
        const wallMidX = wall.x + wall.w / 2;
        const wallMidY = wall.y + wall.h / 2;
        const pulse = 0.58 + 0.42 * Math.sin(wallTime * 2.1 + wall.x * 0.018 + wall.y * 0.023);
        const scanLength = horizontal ? wall.w + 40 : wall.h + 40;
        const scanOffset = ((wallTime * 74 + wall.x * 0.62 + wall.y * 0.37) % scanLength) - 20;

        ctx.save();
        drawRoundedRectPath(ctx, wall.x, wall.y, wall.w, wall.h, 12);
        const wallGradient = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
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
        drawRoundedRectPath(ctx, wall.x, wall.y, wall.w, wall.h, 12);
        ctx.clip();
        const sheenGradient = horizontal
          ? ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h)
          : ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y);
        sheenGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        sheenGradient.addColorStop(0.5, wallSheen);
        sheenGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.globalAlpha = darkMode ? 0.72 : 0.82;
        ctx.fillStyle = sheenGradient;
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

        const scanGradient = horizontal
          ? ctx.createLinearGradient(wall.x + scanOffset, wall.y, wall.x + scanOffset + 22, wall.y)
          : ctx.createLinearGradient(wall.x, wall.y + scanOffset, wall.x, wall.y + scanOffset + 22);
        scanGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        scanGradient.addColorStop(0.5, wallScan);
        scanGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.globalAlpha = 0.62 + pulse * 0.24;
        ctx.fillStyle = scanGradient;
        if (horizontal) {
          ctx.fillRect(wall.x + scanOffset, wall.y + 2, 22, Math.max(1, wall.h - 4));
        } else {
          ctx.fillRect(wall.x + 2, wall.y + scanOffset, Math.max(1, wall.w - 4), 22);
        }
        ctx.restore();

        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(wall.x + 10, wall.y + wall.h / 2);
          ctx.lineTo(wall.x + wall.w - 10, wall.y + wall.h / 2);
        } else {
          ctx.moveTo(wall.x + wall.w / 2, wall.y + 10);
          ctx.lineTo(wall.x + wall.w / 2, wall.y + wall.h - 10);
        }
        ctx.lineWidth = darkMode ? 2.4 : 2.1;
        ctx.strokeStyle = wallCore;
        ctx.stroke();

        ctx.beginPath();
        ctx.setLineDash(horizontal ? [12, 8] : [10, 8]);
        if (horizontal) {
          ctx.moveTo(wall.x + 15, wallMidY - 4);
          ctx.lineTo(wall.x + wall.w - 15, wallMidY - 4);
          ctx.moveTo(wall.x + 15, wallMidY + 4);
          ctx.lineTo(wall.x + wall.w - 15, wallMidY + 4);
        } else {
          ctx.moveTo(wallMidX - 4, wall.y + 15);
          ctx.lineTo(wallMidX - 4, wall.y + wall.h - 15);
          ctx.moveTo(wallMidX + 4, wall.y + 15);
          ctx.lineTo(wallMidX + 4, wall.y + wall.h - 15);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(wallNode, darkMode ? 0.16 + pulse * 0.12 : 0.12 + pulse * 0.1);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(wall.x + 8, wall.y + 4);
          ctx.lineTo(wall.x + 24, wall.y + 4);
          ctx.moveTo(wall.x + 8, wall.y + wall.h - 4);
          ctx.lineTo(wall.x + 24, wall.y + wall.h - 4);
          ctx.moveTo(wall.x + wall.w - 8, wall.y + 4);
          ctx.lineTo(wall.x + wall.w - 24, wall.y + 4);
          ctx.moveTo(wall.x + wall.w - 8, wall.y + wall.h - 4);
          ctx.lineTo(wall.x + wall.w - 24, wall.y + wall.h - 4);
        } else {
          ctx.moveTo(wall.x + 4, wall.y + 8);
          ctx.lineTo(wall.x + 4, wall.y + 24);
          ctx.moveTo(wall.x + wall.w - 4, wall.y + 8);
          ctx.lineTo(wall.x + wall.w - 4, wall.y + 24);
          ctx.moveTo(wall.x + 4, wall.y + wall.h - 8);
          ctx.lineTo(wall.x + 4, wall.y + wall.h - 24);
          ctx.moveTo(wall.x + wall.w - 4, wall.y + wall.h - 8);
          ctx.lineTo(wall.x + wall.w - 4, wall.y + wall.h - 24);
        }
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = wallBracket;
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = wallNode;
        ctx.shadowBlur = darkMode ? 10 : 8;
        ctx.fillStyle = wallNode;
        if (horizontal) {
          for (const nodeX of [wall.x + 16, wallMidX, wall.x + wall.w - 16]) {
            ctx.beginPath();
            ctx.arc(nodeX, wallMidY, 2.2 + pulse * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          for (const nodeY of [wall.y + 16, wallMidY, wall.y + wall.h - 16]) {
            ctx.beginPath();
            ctx.arc(wallMidX, nodeY, 2.2 + pulse * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
        ctx.restore();
      }

      for (const ripple of wallRipples) {
        const progress = 1 - ripple.life / ripple.maxLife;
        ctx.save();
        drawRoundedRectPath(ctx, ripple.wall.x, ripple.wall.y, ripple.wall.w, ripple.wall.h, 12);
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

      drawPowerups(ctx, powerups.filter((powerup) => !powerup.disabled), currentTheme, elapsedMs);
      drawOnlineLaserAims(ctx);
      drawMines(ctx, mines, currentTheme, elapsedMs);

      targets.forEach((target) => {
        const pulse = 1 + Math.sin(target.phase) * 0.08;
        ctx.save();
        ctx.fillStyle = hexToRgba(playerPalette.base, darkMode ? 0.24 : 0.18);
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius * 1.66 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = playerPalette.bright;
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = darkMode ? "rgba(240, 253, 244, 0.54)" : "rgba(240, 253, 244, 0.7)";
        ctx.stroke();
        ctx.font = "700 14px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = darkMode ? "#04111d" : "#f8fafc";
        ctx.fillText(String(target.id).padStart(2, "0"), target.x, target.y + 1);
        ctx.restore();
      });

      bullets.forEach((bullet) => {
        if (bullet.projectileType === "laser") {
          drawLaserProjectile(ctx, bullet, bullet.color, currentTheme, walls);
          return;
        }
        if (bullet.projectileType === "guided_missile") {
          drawGuidedMissileProjectile(ctx, bullet, bullet.color, currentTheme, elapsedMs);
          return;
        }
        if (bullet.projectileType === "tow_missile") {
          drawTowMissileProjectile(ctx, bullet, bullet.color, currentTheme, elapsedMs);
          return;
        }
        drawBulletSprite(ctx, bullet, bullet.color, currentTheme);
      });

      bulletFades.forEach((fade) => {
        const progress = fade.life / fade.maxLife;
        if (fade.projectileType === "laser") {
          drawLaserProjectile(ctx, fade, fade.color || options.playerColor, currentTheme, walls);
          return;
        }
        if (fade.projectileType === "guided_missile") {
          drawGuidedMissileExpiryEffect(ctx, fade, fade.color || options.playerColor, currentTheme, elapsedMs);
          return;
        }
        if (fade.projectileType === "tow_missile") {
          drawTowMissileExpiryEffect(ctx, fade, fade.color || options.playerColor, currentTheme, elapsedMs);
          return;
        }
        drawBulletSprite(ctx, fade, fade.color || options.playerColor, currentTheme, progress, (1 - progress) * 1.6);
      });
      drawBulletSmokeEffects(ctx, bulletSmokeEffects, currentTheme);

      drawTankExplosions(ctx, tankExplosions, currentTheme);
      drawPowerupPickupEffects(ctx, powerupEffects, currentTheme);
      drawShellCasings(ctx, shellCasings, currentTheme);
      drawKillFeedEntries(ctx, killFeedEntries, currentTheme);

      Array.from(players.values())
        .filter((player) => player.alive)
        .forEach((player) => {
          drawOnlineTankSprite(ctx, player);
          if (customOptions.health_system) {
            drawDamageSmoke(ctx, player, currentTheme, elapsedMs);
          }
          if (customOptions.health_system) {
            drawTankHealthBadge(ctx, player, currentTheme, elapsedMs);
          } else {
            ctx.save();
            ctx.font = "700 12px 'Segoe UI'";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = darkMode ? "rgba(219, 234, 254, 0.92)" : "rgba(15, 23, 42, 0.68)";
            ctx.fillText(
              truncatePlayerIdLabel(player.id),
              player.x,
              player.y - player.radius - 22,
            );
            ctx.restore();
          }
        });

      if (localPlayer.alive) {
        drawOnlineTankSprite(ctx, localPlayer);
        if (customOptions.health_system) {
          drawDamageSmoke(ctx, localPlayer, currentTheme, elapsedMs);
        }
        if (customOptions.health_system) {
          drawTankHealthBadge(ctx, localPlayer, currentTheme, elapsedMs);
        } else {
          ctx.save();
          ctx.font = "700 12px 'Segoe UI'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = darkMode ? "rgba(219, 234, 254, 0.92)" : "rgba(15, 23, 42, 0.68)";
          ctx.fillText(
            truncatePlayerIdLabel(localPlayer.id),
            localPlayer.x,
            localPlayer.y - localPlayer.radius - 22,
          );
          ctx.restore();
        }
      }
      drawHealPlusEffects(ctx, healPlusEffects, currentTheme);
      drawShieldPulseEffects(ctx, shieldPulseEffects, currentTheme);
    },
    snapshot() {
      return {
        score: localScore,
        shots: localShots,
        hits: localHits,
        bullets: bullets.filter((bullet) => bullet.ownerId === options.playerId).length,
        ricochets: 0,
        deaths: localDeaths,
        elapsedMs,
        mapTag,
        targetsRemaining: targets.length,
      };
    },
    buildMatchSyncState() {
      if (localPlayer.x < -9000 || localPlayer.y < -9000 || !localPlayer.alive || localPlayer.respawnInMs > 0) {
        return undefined;
      }
      if (isLocalTowControllerActive()) {
        ensureTowControllerLock();
      }
      return {
        x: localPlayer.x,
        y: localPlayer.y,
        angle: localPlayer.angle,
        radius: localPlayer.radius,
        deaths: localPlayer.deaths,
        spawn_seq: localPlayer.spawnSeq,
      };
    },
    applyMatchState,
    getMatchFireSeq() {
      return localFireSeq;
    },
    buildPreviewSnapshot() {
      return {
        authoritative_scene: true,
        theme: currentTheme,
        tank: {
        color: localPlayer.color || options.playerColor,
        x: localPlayer.x,
        y: localPlayer.y,
        angle: localPlayer.angle,
        radius: localPlayer.radius,
        flash: localPlayer.flash,
        hp: localPlayer.hp,
        max_hp: localPlayer.maxHp,
        weapon: localPlayer.weapon,
        shotgun_ammo: localPlayer.shotgunAmmo,
        minigun_ammo: localPlayer.minigunAmmo,
        double_barrel_ammo: localPlayer.doubleBarrelAmmo,
        mine_ammo: localPlayer.mineAmmo,
        missile_ammo: localPlayer.missileAmmo,
        weapon_reload_ms: Math.max(0, Math.round(localPlayer.weaponReloadMs)),
        shots: localShots,
          score: localScore,
          hits: localHits,
        },
        bullets: bullets
          .filter((bullet) => bullet.ownerId === options.playerId)
          .map((bullet) => ({
            id: bullet.id,
            color: bullet.color,
            projectile_type: bullet.projectileType || "bullet",
            x: bullet.x,
            y: bullet.y,
            radius: bullet.radius,
            vx: bullet.vx,
            vy: bullet.vy,
            bounces_left: bullet.bouncesLeft,
            has_bounced: Boolean(bullet.hasBounced),
            owner_shield_released: Boolean(bullet.ownerShieldReleased),
            ignore_owner_shield: Boolean(bullet.ignoreOwnerShield),
            target_id: bullet.targetId,
            target_color: bullet.targetColor,
            flame_color: bullet.flameColor,
            locked: Boolean(bullet.locked),
            wall_hit_seq: Math.max(0, Math.floor(Number(bullet.wallHitSeq || 0))),
            wall_hit_x: bullet.wallHitX,
            wall_hit_y: bullet.wallHitY,
            path_segments: bullet.pathSegments,
            distance_travelled: bullet.distanceTravelled,
            segments: bullet.segments,
          })),
        targets: [],
        mines: mines.map((mine) => serializeMineState(mine)),
        tankExplosions: tankExplosions.map(serializeTankExplosion),
      };
    },
    buildLatencySyncState() {
      return {
        local_player: { x: -9999, y: -9999, angle: 0, radius: PLAYER_RADIUS },
        targets: [],
      };
    },
    applyLatencyState() {
      return;
    },
    clearLatencyState() {
      return;
    },
    getCloneHitSeq() {
      return 0;
    },
  };
}

export function TankTroublePanel({ theme, localCountryCode = "", canRunSetup = true }: TankTroublePanelProps) {
  const [selectedGame, setSelectedGame] = useState<GameKey | null>("tank-trouble");
  const [selectedColor, setSelectedColor] = useState<PlayerColorKey>("green");
  const [draftPlayerId, setDraftPlayerId] = useState(loadStoredPlayerId);
  const [customModeOpen, setCustomModeOpen] = useState(false);
  const [customOptions, setCustomOptions] = useState<TankTroubleCustomOptions>(defaultCustomOptions);
  const [session, setSession] = useState<GameSession | null>(null);
  const [snapshot, setSnapshot] = useState<TankTroubleSnapshot>(createEmptySnapshot);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadStoredLeaderboard);
  const [roomState, setRoomState] = useState<TankTroubleRoomState | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [latencyError, setLatencyError] = useState("");
  const [previewPageUrl, setPreviewPageUrl] = useState("");
  const [launchMode, setLaunchMode] = useState<GameLaunchMode>("online");
  const [tankTroubleSetupPhase, setTankTroubleSetupPhase] = useState<TankTroubleSetupPhase>("idle");
  const [tankTroubleSetupMessage, setTankTroubleSetupMessage] = useState("");
  const [scoreboardDocked, setScoreboardDocked] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [voteHovered, setVoteHovered] = useState(false);
  const [blockedColor, setBlockedColor] = useState<PlayerColorKey | null>(null);
  const [controlBindings, setControlBindings] = useState<ControlBindings>(loadStoredControlBindings);
  const [controlBindingEditOpen, setControlBindingEditOpen] = useState(false);
  const [bindingCaptureAction, setBindingCaptureAction] = useState<ControlAction | null>(null);
  const controlBindingsRef = useRef(controlBindings);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerIdInputRef = useRef<HTMLInputElement | null>(null);
  const sessionLayoutRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TankTroubleEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const closeScoreboardTimerRef = useRef<number | null>(null);
  const matchSocketRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const matchStateRef = useRef<TankTroubleMatchState | null>(null);
  const roomStateRef = useRef<TankTroubleRoomState | null>(null);
  const latencySyncKickRef = useRef<(() => void) | null>(null);
  const lastFrameRef = useRef(0);
  const latencyAckInputSeqRef = useRef(0);
  const latencyInputSeqRef = useRef(0);
  const latencySnapshotSeqRef = useRef(0);
  const matchSyncSentAtRef = useRef<Map<number, number>>(new Map());
  const matchLatencyMsRef = useRef(0);
  const previewLatencyMsRef = useRef(0);
  const lastPreviewLatencyUiAtRef = useRef(0);
  const previewPushSeqRef = useRef(0);
  const fireSeqRef = useRef(0);
  const tankTroubleSetupFeedbackTimerRef = useRef<number | null>(null);
  const lastOnlineUiRefreshRef = useRef(0);
  const inputRef = useRef<InputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    fire: false,
  });

  useEffect(() => {
    controlBindingsRef.current = controlBindings;
    storeControlBindings(controlBindings);
  }, [controlBindings]);

  useEffect(() => {
    if (!controlBindingEditOpen) {
      setBindingCaptureAction(null);
    }
  }, [controlBindingEditOpen]);

  useEffect(() => {
    if (!bindingCaptureAction || !controlBindingEditOpen) {
      return;
    }

    const handleCaptureKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        setBindingCaptureAction(null);
        return;
      }

      const nextCode = event.code;
      setControlBindings((current) => {
        const next = { ...current, [bindingCaptureAction]: nextCode };
        for (const action of CONTROL_ACTIONS) {
          if (action !== bindingCaptureAction && next[action] === nextCode) {
            next[action] = current[bindingCaptureAction];
          }
        }
        return normalizeControlBindings(next);
      });
      setBindingCaptureAction(null);
    };

    window.addEventListener("keydown", handleCaptureKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleCaptureKeyDown, true);
    };
  }, [bindingCaptureAction, controlBindingEditOpen]);

  useEffect(() => {
    if (!session) {
      engineRef.current = null;
      matchSocketRef.current?.close();
      matchSocketRef.current = null;
      setSnapshot(createEmptySnapshot());
      setLatencyError("");
      setScoreboardDocked(false);
      setScoreboardOpen(false);
      return;
    }

    if (session.mode === "online" || session.mode === "custom" || session.mode === "local") {
      engineRef.current = createOnlineTankTroubleEngine({
        playerId: session.playerId,
        seed: session.seed,
        mapTag: session.mapId,
        theme,
        playerColor: session.playerColor,
        customOptions: normalizeCustomOptions(session.customOptions),
        localOnly: session.mode === "local",
      });
    } else {
      engineRef.current = createTankTroubleEngine({
        playerId: session.playerId,
        seed: session.seed,
        mapTag: session.mapId,
        theme,
        playerColor: session.playerColor,
      });
      engineRef.current.setBotEnabled(session.mode !== "latency");
    }
    setSnapshot(engineRef.current.snapshot());
  }, [session, theme]);

  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    engineRef.current?.setCustomOptions?.(normalizeCustomOptions(session?.customOptions));
  }, [session?.customOptions]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    if (!session && roomState?.match_mode === "custom" && roomState.custom_options) {
      setCustomOptions(normalizeCustomOptions(roomState.custom_options));
    }
  }, [roomState, session]);

  useEffect(() => {
    return () => {
      if (closeScoreboardTimerRef.current) {
        window.clearTimeout(closeScoreboardTimerRef.current);
      }
      if (tankTroubleSetupFeedbackTimerRef.current) {
        window.clearTimeout(tankTroubleSetupFeedbackTimerRef.current);
      }
      matchSocketRef.current?.close();
      const activeSession = sessionRef.current;
      if (activeSession?.mode === "online" || activeSession?.mode === "custom") {
        void leaveTankTroubleMatch({
          room: activeSession.room,
          player_id: activeSession.playerId,
          country_code: localCountryCode,
        }).catch(() => undefined);
      } else if (activeSession) {
        void leaveTankTroubleRoom({
          room: activeSession.room,
          player_id: activeSession.playerId,
          country_code: localCountryCode,
        }).catch(() => undefined);
      }
    };
  }, [localCountryCode]);

  useEffect(() => {
    const layout = sessionLayoutRef.current;
    if (!session || !layout || typeof ResizeObserver === "undefined") {
      setScoreboardDocked(false);
      setScoreboardOpen(false);
      return;
    }

    const updateDockState = () => {
      const nextDocked = shouldDockScoreboard(layout.clientWidth, layout.clientHeight, scoreboardDocked);
      setScoreboardDocked(nextDocked);
      if (!nextDocked) {
        setScoreboardOpen(false);
      }
    };

    updateDockState();

    const observer = new ResizeObserver(() => {
      updateDockState();
    });
    observer.observe(layout);

    return () => {
      observer.disconnect();
    };
  }, [scoreboardDocked, session]);

  useEffect(() => {
    if (session) {
      return;
    }
    if (!selectedGame) {
      setRoomState(null);
      return;
    }

    let disposed = false;
    let timerId: number | null = null;

    const syncLobby = async () => {
      try {
        const nextRoomState = await getTankTroubleRoomStatus({
          room: TANK_TROUBLE_ROOM,
        });
        if (disposed) {
          return;
        }
        setRoomState(nextRoomState);
        setRoomError("");
      } catch (error) {
        if (!disposed) {
          setRoomError(error instanceof Error ? error.message : "房间状态获取失败");
        }
      } finally {
        if (!disposed) {
          timerId = window.setTimeout(syncLobby, ROOM_POLL_INTERVAL_MS);
        }
      }
    };

    void syncLobby();

    return () => {
      disposed = true;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [selectedGame, session]);

  useEffect(() => {
    if (!session) {
      setVoteHovered(false);
      return;
    }
    if (session.mode === "online" || session.mode === "custom" || session.mode === "local") {
      return;
    }

    let disposed = false;
    let timerId: number | null = null;

    const syncRoom = async () => {
      try {
        const nextRoomState = await syncTankTroubleRoom({
          room: session.room,
          player_id: session.playerId,
          country_code: localCountryCode,
        });
        if (disposed) {
          return;
        }

        setRoomState(nextRoomState);
        setRoomError("");
        setSession((current) => {
          if (!current) {
            return current;
          }
          if (current.seed === nextRoomState.map_seed && current.mapId === nextRoomState.map_id) {
            return current;
          }
          return {
            ...current,
            seed: nextRoomState.map_seed,
            mapId: nextRoomState.map_id,
          };
        });
      } catch (error) {
        if (!disposed) {
          setRoomError(error instanceof Error ? error.message : "地图同步失败");
        }
      } finally {
        if (!disposed) {
          timerId = window.setTimeout(syncRoom, ROOM_POLL_INTERVAL_MS);
        }
      }
    };

    void syncRoom();

    return () => {
      disposed = true;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [localCountryCode, session?.playerId, session?.room]);

  useEffect(() => {
    latencySyncKickRef.current = null;
    latencyAckInputSeqRef.current = 0;
    latencyInputSeqRef.current = 0;
    latencySnapshotSeqRef.current = 0;
    matchSyncSentAtRef.current.clear();
    matchLatencyMsRef.current = 0;
    previewLatencyMsRef.current = 0;
    lastPreviewLatencyUiAtRef.current = 0;
    engineRef.current?.setLatencyOnly(false);
    engineRef.current?.clearLatencyState();
    setLatencyError("");
  }, [session?.mode]);

  useEffect(() => {
    if (!session || (session.mode !== "online" && session.mode !== "custom")) {
      latencySyncKickRef.current = null;
      matchSocketRef.current?.close();
      matchSocketRef.current = null;
      return;
    }

    let disposed = false;
    let timerId: number | null = null;
    let socket: WebSocket | null = null;

    const hasActiveInput = () =>
      inputRef.current.forward ||
      inputRef.current.backward ||
      inputRef.current.left ||
      inputRef.current.right ||
      inputRef.current.fire;

    const clearSyncTimer = () => {
      if (timerId) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const scheduleSync = (delay: number) => {
      if (disposed) {
        return;
      }
      clearSyncTimer();
      timerId = window.setTimeout(() => {
        timerId = null;
        void sendSync();
      }, delay);
    };

    const finishSync = () => {
      if (disposed) {
        return;
      }
    };

    const sendSync = async () => {
      if (disposed) {
        return;
      }
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        scheduleSync(ONLINE_SYNC_IDLE_INTERVAL_MS);
        return;
      }
      if (socket.bufferedAmount > ONLINE_SYNC_BUFFER_LIMIT_BYTES) {
        scheduleSync(ONLINE_SYNC_IDLE_INTERVAL_MS);
        return;
      }

      const nextInputSeq = latencyInputSeqRef.current + 1;
      latencyInputSeqRef.current = nextInputSeq;
      const localPlayerState = engineRef.current?.buildMatchSyncState();
      matchSyncSentAtRef.current.set(nextInputSeq, performance.now());
      for (const [inputSeq] of matchSyncSentAtRef.current) {
        if (inputSeq < nextInputSeq - 24) {
          matchSyncSentAtRef.current.delete(inputSeq);
        }
      }

      try {
        socket.send(
          JSON.stringify({
            type: "sync",
            payload: {
              room: session.room,
              player_id: session.playerId,
              country_code: localCountryCode,
              preferred_color: sessionRef.current?.playerColor ?? session.playerColor,
              match_mode: sessionRef.current?.mode === "custom" ? "custom" : "default",
              custom_options: sessionRef.current?.mode === "custom"
                ? normalizeCustomOptions(sessionRef.current?.customOptions)
                : defaultCustomOptions(),
              input_seq: nextInputSeq,
              map_seed: sessionRef.current?.seed ?? session.seed,
              latency_ms: normalizeLatencyMs(matchLatencyMsRef.current),
              input: {
                forward: inputRef.current.forward,
                backward: inputRef.current.backward,
                left: inputRef.current.left,
                right: inputRef.current.right,
                fire_seq: engineRef.current?.getMatchFireSeq() ?? 0,
                fire_held: inputRef.current.fire,
              },
              local_player: localPlayerState,
            } satisfies TankTroubleMatchRequest,
          }),
        );
      } catch (error) {
        setLatencyError(error instanceof Error ? error.message : "联机同步发送失败");
        scheduleSync(ONLINE_SYNC_IDLE_INTERVAL_MS);
        return;
      }

      scheduleSync(hasActiveInput() ? ONLINE_SYNC_RUSH_INTERVAL_MS : ONLINE_SYNC_IDLE_INTERVAL_MS);
    };

    latencySyncKickRef.current = () => {
      scheduleSync(0);
    };

    void openTankTroubleMatchSocket()
      .then((ws) => {
        if (disposed) {
          ws.close();
          return;
        }
        socket = ws;
        matchSocketRef.current = ws;

        ws.onopen = () => {
          if (disposed) {
            return;
          }
          setLatencyError("");
          scheduleSync(0);
        };

        ws.onmessage = (event) => {
          if (disposed) {
            return;
          }
          try {
            const message = JSON.parse(String(event.data ?? "{}")) as MatchTransportMessage;
            if (message.type === "state") {
              finishSync();
              const ackInputSeq = message.state.ack_input_seq;
              const sentAt = matchSyncSentAtRef.current.get(ackInputSeq);
              if (sentAt) {
                const sampleMs = Math.max(1, performance.now() - sentAt);
                matchSyncSentAtRef.current.delete(ackInputSeq);
                const previousMs = matchLatencyMsRef.current;
                matchLatencyMsRef.current = previousMs
                  ? Math.round(previousMs * 0.72 + sampleMs * 0.28)
                  : Math.round(sampleMs);
              }
              latencyAckInputSeqRef.current = message.state.ack_input_seq;
              latencySnapshotSeqRef.current = message.state.snapshot_seq;
              matchStateRef.current = message.state;
              engineRef.current?.applyMatchState?.(message.state);
              const nextRoomState = buildRoomStateFromMatchState(message.state);
              const nowMs = Date.now();
              if (
                shouldRefreshOnlineRoomUi(
                  roomStateRef.current,
                  nextRoomState,
                  nowMs,
                  lastOnlineUiRefreshRef.current,
                )
              ) {
                roomStateRef.current = nextRoomState;
                lastOnlineUiRefreshRef.current = nowMs;
                setRoomState(nextRoomState);
              }
              setRoomError("");
              setLatencyError("");
              setSession((current) => {
                if (!current) {
                  return current;
                }
                const nextColor = normalizePlayerColorKey(message.state.local_player_color || current.playerColor);
                const nextMode: GameSessionMode = message.state.match_mode === "custom" ? "custom" : "online";
                const nextCustomOptions = normalizeCustomOptions(message.state.custom_options);
                if (
                  current.seed === message.state.map_seed &&
                  current.mapId === message.state.map_id &&
                  current.playerColor === nextColor &&
                  current.mode === nextMode &&
                  JSON.stringify(normalizeCustomOptions(current.customOptions)) === JSON.stringify(nextCustomOptions)
                ) {
                  return current;
                }
                return {
                  ...current,
                  mode: nextMode,
                  seed: message.state.map_seed,
                  mapId: message.state.map_id,
                  playerColor: nextColor,
                  customOptions: nextCustomOptions,
                };
              });
              return;
            }
            if (message.type === "error") {
              finishSync();
              setLatencyError(message.message || "联机同步失败");
            }
          } catch (error) {
            finishSync();
            setLatencyError(error instanceof Error ? error.message : "联机消息解析失败");
          }
        };

        ws.onerror = () => {
          if (!disposed) {
            setLatencyError("联机同步连接异常");
          }
        };

        ws.onclose = () => {
          if (!disposed) {
            setLatencyError("联机同步连接已断开");
          }
          if (matchSocketRef.current === ws) {
            matchSocketRef.current = null;
          }
        };
      })
      .catch((error) => {
        if (!disposed) {
          setLatencyError(error instanceof Error ? error.message : "联机同步连接失败");
        }
      });

    return () => {
      disposed = true;
      latencySyncKickRef.current = null;
      clearSyncTimer();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "leave",
            payload: {
              room: session.room,
              player_id: session.playerId,
              country_code: localCountryCode,
            },
          }),
        );
      }
      socket?.close();
      if (matchSocketRef.current === socket) {
        matchSocketRef.current = null;
      }
    };
  }, [localCountryCode, session?.mode, session?.playerId, session?.room]);

  useEffect(() => {
    if (!session || session.mode !== "latency") {
      setPreviewPageUrl("");
      return;
    }

    let disposed = false;
    void getTankTroubleSpectatorPageUrl(TANK_TROUBLE_ROOM)
      .then((page) => {
        if (!disposed) {
          setPreviewPageUrl(withDarkSpectatorTheme(page.url));
        }
      })
      .catch((error) => {
        if (!disposed) {
          setLatencyError(error instanceof Error ? error.message : "网页预览链接生成失败");
        }
      });

    return () => {
      disposed = true;
    };
  }, [session?.mode]);

  useEffect(() => {
    if (!session || session.mode !== "latency") {
      return;
    }

    const sessionId = `${session.room}:${session.playerId}:preview`;
    let disposed = false;
    let timerId: number | null = null;
    let pushInFlight = false;
    let pushPending = false;

    previewPushSeqRef.current = 0;

    const pushPreview = async () => {
      if (disposed || pushInFlight) {
        return;
      }
      const engine = engineRef.current;
      if (!engine) {
        return;
      }

      pushInFlight = true;
      pushPending = false;
      try {
        const snapshotSeq = previewPushSeqRef.current + 1;
        const previewSnapshot = engine.buildPreviewSnapshot();
        const previewStats = engine.snapshot();
        const pushStartedAt = performance.now();
        previewPushSeqRef.current = snapshotSeq;
        await pushTankTroublePreview({
          session_id: sessionId,
          room: session.room,
          player_id: session.playerId,
          country_code: localCountryCode,
          latency_ms: normalizeLatencyMs(previewLatencyMsRef.current),
          snapshot_seq: snapshotSeq,
          ...previewSnapshot,
          theme: "dark",
          updated_at_ms: Date.now(),
        });
        if (!disposed) {
          const sampleMs = Math.max(1, performance.now() - pushStartedAt);
          const previousMs = previewLatencyMsRef.current;
          previewLatencyMsRef.current = previousMs
            ? Math.round(previousMs * 0.78 + sampleMs * 0.22)
            : Math.round(sampleMs);
          const nowMs = Date.now();
          if (nowMs - lastPreviewLatencyUiAtRef.current >= 1000) {
            lastPreviewLatencyUiAtRef.current = nowMs;
            setLeaderboard((current) => {
              const next = mergeLeaderboardEntry(current, {
                playerId: session.playerId,
                countryCode: localCountryCode,
                score: previewStats.score,
                hits: previewStats.hits,
                latencyMs: normalizeLatencyMs(previewLatencyMsRef.current),
                updatedAt: nowMs,
              });
              if (next === current) {
                return current;
              }
              storeLeaderboard(next);
              return next;
            });
          }
          setLatencyError("");
        }
      } catch (error) {
        if (!disposed) {
          setLatencyError(error instanceof Error ? error.message : "网页预览同步失败");
        }
      }
      pushInFlight = false;
      if (!disposed && pushPending) {
        void pushPreview();
      }
    };

    const queuePreviewPush = () => {
      if (disposed) {
        return;
      }
      pushPending = true;
      if (!pushInFlight) {
        void pushPreview();
      }
    };

    queuePreviewPush();
    timerId = window.setInterval(() => {
      queuePreviewPush();
    }, PREVIEW_PUSH_INTERVAL_MS);

    return () => {
      disposed = true;
      if (timerId) {
        window.clearInterval(timerId);
      }
      void clearTankTroublePreview({ session_id: sessionId }).catch(() => undefined);
    };
  }, [localCountryCode, session]);

  useEffect(() => {
    if (session?.mode === "latency") {
      return;
    }
    if (!session) {
      return;
    }
    if (session.mode === "online" || session.mode === "custom") {
      return;
    }

    setLeaderboard((current) => {
      const next = mergeLeaderboardEntry(current, {
        playerId: session.playerId,
        countryCode: localCountryCode,
        score: snapshot.score,
        hits: snapshot.hits,
        latencyMs: session.mode === "latency" ? normalizeLatencyMs(previewLatencyMsRef.current) : undefined,
        updatedAt: Date.now(),
      });
      if (next === current) {
        return current;
      }
      storeLeaderboard(next);
      return next;
    });
  }, [localCountryCode, session, snapshot.hits, snapshot.score]);

  useEffect(() => {
    if (!session || (session.mode !== "online" && session.mode !== "custom") || !roomState) {
      return;
    }
    setLeaderboard(buildLeaderboardEntries(roomState.active_players));
  }, [roomState, session?.mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current || !session) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let nextCanvasResolutionCheckAt = 0;
    const syncCanvasResolution = (frameTime = performance.now(), force = false) => {
      if (!force && canvas.width > 0 && canvas.height > 0 && frameTime < nextCanvasResolutionCheckAt) {
        ctx.setTransform(canvas.width / WORLD_WIDTH, 0, 0, canvas.height / WORLD_HEIGHT, 0, 0);
        return;
      }
      nextCanvasResolutionCheckAt = frameTime + 250;
      const rect = canvas.getBoundingClientRect();
      const devicePixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const nextWidth = Math.max(1, Math.round(rect.width * devicePixelRatio));
      const nextHeight = Math.max(1, Math.round(rect.height * devicePixelRatio));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      ctx.setTransform(canvas.width / WORLD_WIDTH, 0, 0, canvas.height / WORLD_HEIGHT, 0, 0);
    };

    const handleCanvasResize = () => {
      nextCanvasResolutionCheckAt = 0;
      syncCanvasResolution(performance.now(), true);
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleCanvasResize);
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", handleCanvasResize);
    handleCanvasResize();

    const updateKeyState = (code: string, pressed: boolean) => {
      const action = findControlActionByCode(controlBindingsRef.current, code);
      if (!action) {
        return false;
      }

      if (action === "fire") {
        if (inputRef.current.fire === pressed) {
          return true;
        }
        if (pressed && !inputRef.current.fire) {
          if (sessionRef.current?.mode === "online" || sessionRef.current?.mode === "custom") {
            if (!engineRef.current?.isRapidFireWeapon?.()) {
              engineRef.current?.queueFireInput();
            }
          } else {
            fireSeqRef.current += 1;
          }
        }
        inputRef.current.fire = pressed;
        latencySyncKickRef.current?.();
        return true;
      }

      if (inputRef.current[action] === pressed) {
        return true;
      }

      inputRef.current[action] = pressed;
      latencySyncKickRef.current?.();
      return true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (updateKeyState(event.code, true)) {
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (updateKeyState(event.code, false)) {
        event.preventDefault();
      }
    };

    const handleBlur = () => {
      const hadActiveInput =
        inputRef.current.forward ||
        inputRef.current.backward ||
        inputRef.current.left ||
        inputRef.current.right ||
        inputRef.current.fire;
      inputRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        fire: false,
      };
      if (hadActiveInput) {
        latencySyncKickRef.current?.();
      }
    };

    let snapshotBudget = 0;
    lastFrameRef.current = performance.now();

    const tick = (frameTime: number) => {
      const activeEngine = engineRef.current;
      if (!activeEngine) {
        return;
      }

      const delta = Math.min(0.034, Math.max(0.001, (frameTime - lastFrameRef.current) / 1000));
      lastFrameRef.current = frameTime;
      syncCanvasResolution(frameTime);
      activeEngine.update(delta, inputRef.current);
      activeEngine.render(ctx);

      snapshotBudget += delta;
      const snapshotInterval = session.mode === "online" || session.mode === "custom" ? 0.25 : 0.08;
      if (snapshotBudget >= snapshotInterval) {
        snapshotBudget = 0;
        setSnapshot(activeEngine.snapshot());
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleCanvasResize);
      resizeObserver?.disconnect();
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      inputRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        fire: false,
      };
      fireSeqRef.current = 0;
    };
  }, [session]);

  const hasSelectedGame = selectedGame !== null;
  const selectedOption = GAME_OPTIONS.find((option) => option.key === selectedGame) ?? GAME_OPTIONS[0];
  const playerId = draftPlayerId.trim();
  const occupiedColorSet = new Set((!session ? roomState?.occupied_colors : []) ?? []);
  const availableColorSet = new Set((!session ? roomState?.available_colors : PLAYER_COLOR_OPTIONS.map((entry) => entry.key)) ?? []);
  const selectedColorAvailable = availableColorSet.has(selectedColor);
  const roomIsFull = Boolean(!session && roomState?.room_full);
  const roomOccupied = Boolean(!session && roomState && roomState.active_player_count > 0);
  const roomInCustomMode = roomState?.match_mode === "custom" && roomOccupied;
  const roomInDefaultMode = roomState?.match_mode !== "custom" && roomOccupied;
  const customControlsLocked = Boolean(roomInCustomMode && roomState?.mode_locked);
  const customServerControlsLocked = customControlsLocked;
  const customStartLabel = roomInCustomMode ? "加入游戏" : "开始游戏";
  const scoreboardSource = session && (session.mode === "online" || session.mode === "custom") && roomState ? buildLeaderboardEntries(roomState.active_players) : leaderboard;
  const scoreboardRows = Array.from({ length: SCOREBOARD_LIMIT }, (_, index) => scoreboardSource[index] ?? null);
  const stageAspectRatio = `${WORLD_WIDTH} / ${WORLD_HEIGHT}`;
  const mapVoteLabel = roomState?.countdown_active
    ? `准备换图 ${roomState.countdown_seconds}`
    : voteHovered
      ? "投票换图"
      : `当前地图：${session?.mapId ?? snapshot.mapTag}`;
  const voteMarkers: TankTroubleVoteMarker[] = roomState?.voters ?? [];
  const allPlayersVoted = Boolean(roomState?.vote_required) && roomState?.vote_count === roomState?.vote_required;
  const voteCountdownLevel =
    roomState?.countdown_active && roomState.countdown_seconds > 0
      ? Math.max(1, Math.min(3, roomState.countdown_seconds))
      : 0;
  const mapVoteButtonClassName = [
    "game-scoreboard-runtime",
    "game-scoreboard-runtime-button",
    roomState?.local_player_voted ? "active" : "",
    allPlayersVoted ? "armed" : "",
    roomState?.countdown_active ? "countdown" : "",
    voteCountdownLevel ? `countdown-${voteCountdownLevel}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const sessionErrorMessage = latencyError || roomError;
  const launchHint = !playerId
    ? "请输入玩家 ID 后即可开始游戏。"
    : !selectedColorAvailable
      ? "所选颜色已被占用，请换一个颜色。"
      : "";
  const startDisabled = roomBusy || roomIsFull;
  const defaultStartDisabled = startDisabled || roomInCustomMode;
  const customStartDisabled = roomBusy || roomIsFull || roomInDefaultMode;
  const tankTroubleSetupBusy = tankTroubleSetupPhase === "checking" || tankTroubleSetupPhase === "running";
  const tankTroubleSetupFeedbackVisible = tankTroubleSetupPhase === "ready" || tankTroubleSetupPhase === "error";
  const tankTroubleSetupFeedbackClassName = [
    "game-setup-feedback",
    tankTroubleSetupFeedbackVisible ? "visible" : "",
    tankTroubleSetupPhase === "error" ? "error" : "success",
  ]
    .filter(Boolean)
    .join(" ");
  const startLabel = roomIsFull ? "游戏已满" : "默认模式";

  function cancelScoreboardClose() {
    if (closeScoreboardTimerRef.current) {
      window.clearTimeout(closeScoreboardTimerRef.current);
      closeScoreboardTimerRef.current = null;
    }
  }

  function openScoreboard() {
    if (!scoreboardDocked) {
      return;
    }
    cancelScoreboardClose();
    setScoreboardOpen(true);
  }

  function scheduleScoreboardClose() {
    if (!scoreboardDocked) {
      return;
    }
    cancelScoreboardClose();
    closeScoreboardTimerRef.current = window.setTimeout(() => {
      setScoreboardOpen(false);
      closeScoreboardTimerRef.current = null;
    }, 140);
  }

  async function startSession(mode: GameSessionMode) {
    if (!hasSelectedGame) {
      setRoomError("请先选择 Tank Trouble。");
      return;
    }
    if (!playerId) {
      setRoomError("请输入玩家 ID 后再开始。");
      playerIdInputRef.current?.focus();
      return;
    }
    if (mode === "online" && roomIsFull) {
      setRoomError("当前房间已满，请稍后重试。");
      return;
    }
    if (mode === "online" && roomInCustomMode) {
      setRoomError("当前房间正在自定义模式中，请通过自定义模式加入。");
      return;
    }
    if (mode === "custom" && roomInDefaultMode) {
      setRoomError("当前房间正在默认联机模式中，暂不能开启自定义模式。");
      return;
    }
    if ((mode === "online" || mode === "custom") && !selectedColorAvailable) {
      setBlockedColor(selectedColor);
      window.setTimeout(() => {
        setBlockedColor((current) => (current === selectedColor ? null : current));
      }, COLOR_BLOCK_SHAKE_MS);
      setRoomError("所选颜色已被占用，请换一个颜色。");
      return;
    }

    fireSeqRef.current = 0;
    latencyAckInputSeqRef.current = 0;
    latencyInputSeqRef.current = 0;
    latencySnapshotSeqRef.current = 0;
    matchSyncSentAtRef.current.clear();
    matchLatencyMsRef.current = 0;
    previewLatencyMsRef.current = 0;
    lastPreviewLatencyUiAtRef.current = 0;
    setLaunchMode(mode);
    setRoomBusy(true);
    setRoomError("");
    setLatencyError("");
    try {
      let freshRoomState = roomStateRef.current ?? roomState;
      if (mode === "online" || mode === "custom") {
        try {
          freshRoomState = await getTankTroubleRoomStatus({
            room: TANK_TROUBLE_ROOM,
          });
          roomStateRef.current = freshRoomState;
          setRoomState(freshRoomState);
        } catch {
          freshRoomState = roomStateRef.current ?? roomState;
        }
        const freshRoomOccupied = Boolean(freshRoomState && freshRoomState.active_player_count > 0);
        if (mode === "online" && freshRoomOccupied && freshRoomState?.match_mode === "custom") {
          setRoomError("褰撳墠鎴块棿姝ｅ湪鑷畾涔夋ā寮忎腑锛岃閫氳繃鑷畾涔夋ā寮忓姞鍏ャ€?");
          return;
        }
        if (mode === "custom" && freshRoomOccupied && freshRoomState?.match_mode !== "custom") {
          setRoomError("褰撳墠鎴块棿姝ｅ湪榛樿鑱旀満妯″紡涓紝鏆備笉鑳藉紑鍚嚜瀹氫箟妯″紡銆?");
          return;
        }
      }
      const joinPlayerId =
        mode === "online" || mode === "custom"
          ? resolveJoinPlayerId(playerId, freshRoomState)
          : playerId;
      if (mode === "local") {
        const localSeed = (roomState?.map_seed ?? (Date.now() ^ stringHash(playerId))) >>> 0;
        storePlayerId(playerId);
        setRoomState(null);
        setSession({
          playerId,
          seed: localSeed,
          mapId: `LOCAL-${localSeed.toString(16).slice(-4).toUpperCase()}`,
          room: "local",
          playerColor: selectedColor,
          mode: "local",
          customOptions: localTestCustomOptions(),
        });
        setCustomModeOpen(false);
        return;
      }
      if (mode === "online" || mode === "custom") {
        const nextMatchState = await syncTankTroubleMatch({
          room: TANK_TROUBLE_ROOM,
          player_id: joinPlayerId,
          country_code: localCountryCode,
          preferred_color: selectedColor,
          match_mode: mode === "custom" ? "custom" : "default",
          custom_options: mode === "custom" ? normalizeCustomOptions(customOptions) : defaultCustomOptions(),
          input_seq: 0,
          map_seed: 0,
          input: createEmptyMatchInput(),
        });
        storePlayerId(playerId);
        matchStateRef.current = nextMatchState;
        const nextRoomState = buildRoomStateFromMatchState(nextMatchState);
        roomStateRef.current = nextRoomState;
        lastOnlineUiRefreshRef.current = Date.now();
        setRoomState(nextRoomState);
        setSession(buildSessionFromMatchState(joinPlayerId, nextMatchState));
        setCustomModeOpen(false);
        return;
      }

      const nextRoomState = await syncTankTroubleRoom({
        room: TANK_TROUBLE_ROOM,
        player_id: playerId,
        country_code: localCountryCode,
        preferred_color: selectedColor,
      });
      storePlayerId(playerId);
      setRoomState(nextRoomState);
      setSession(buildSessionFromRoomState(playerId, nextRoomState, selectedColor, mode));
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "地图同步失败");
    } finally {
      setRoomBusy(false);
    }
  }

  async function configureTankTroubleServer() {
    if (!hasSelectedGame || roomBusy || tankTroubleSetupPhase === "checking" || tankTroubleSetupPhase === "running") {
      return;
    }

    if (tankTroubleSetupFeedbackTimerRef.current) {
      window.clearTimeout(tankTroubleSetupFeedbackTimerRef.current);
      tankTroubleSetupFeedbackTimerRef.current = null;
    }

    setTankTroubleSetupPhase("checking");
    setTankTroubleSetupMessage("");
    setRoomError("");
    try {
      await checkTankTroubleSetup();
      setTankTroubleSetupPhase("running");
      const setupResult = await runTankTroubleSetup();
      setTankTroubleSetupPhase("ready");
      setTankTroubleSetupMessage(setupResult.message || "服务器已同步到当前版本");
      tankTroubleSetupFeedbackTimerRef.current = window.setTimeout(() => {
        setTankTroubleSetupPhase("idle");
        setTankTroubleSetupMessage("");
        tankTroubleSetupFeedbackTimerRef.current = null;
      }, 2200);
    } catch (error) {
      setTankTroubleSetupPhase("error");
      setTankTroubleSetupMessage(error instanceof Error ? error.message : "Tank Trouble 配置失败");
    }
  }

  function leaveSession() {
    const currentSession = session;

    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (currentSession) {
      if (currentSession.mode === "online" || currentSession.mode === "custom") {
        matchSocketRef.current?.close();
        matchSocketRef.current = null;
        void leaveTankTroubleMatch({
          room: currentSession.room,
          player_id: currentSession.playerId,
          country_code: localCountryCode,
        }).catch(() => undefined);
      } else if (currentSession.mode !== "local") {
        void leaveTankTroubleRoom({
          room: currentSession.room,
          player_id: currentSession.playerId,
          country_code: localCountryCode,
        }).catch(() => undefined);
      }
    }

    engineRef.current = null;
    setSession(null);
    matchStateRef.current = null;
    setRoomState(null);
    roomStateRef.current = null;
    setRoomError("");
    setLatencyError("");
    setScoreboardOpen(false);
    setVoteHovered(false);
    setSnapshot(createEmptySnapshot());
  }

  async function toggleMapVote() {
    if (!session || roomBusy) {
      return;
    }

    setRoomBusy(true);
    try {
      const nextRoomState = await toggleTankTroubleRoomVote({
        room: session.room,
        player_id: session.playerId,
        country_code: localCountryCode,
      });
      setRoomState(nextRoomState);
      setRoomError("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "投票换图失败");
    } finally {
      setRoomBusy(false);
    }
  }

  return (
    <section className="game-view">
      <div className={`panel game-panel${session ? " game-panel-live" : ""}`}>
        {!session ? (
          <>
            <div className={`game-launch-grid${hasSelectedGame ? "" : " game-launch-grid-single"}`}>
              <div className="game-library-card">
                <div className="game-library-head">
                  <div className="section-title">游戏选择</div>
                </div>

                {GAME_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`game-choice-card ${selectedGame === option.key ? "selected" : ""} ${option.accent}`}
                    onClick={() => {
                      setSelectedGame(option.key);
                    }}
                  >
                    <div className="game-choice-title">{option.title}</div>
                    <div className="game-choice-subtitle">{option.subtitle}</div>
                    <div className="game-choice-detail">{option.detail}</div>
                    <div className="game-choice-badge">V1.0</div>
                  </button>
                ))}
              </div>

              {hasSelectedGame ? (
                <div className="game-identity-card">
                  <div className="section-title">{selectedOption.title}</div>

                  <label className="game-field-label" htmlFor="tank-player-id">
                    玩家 ID
                  </label>
                  <input
                    id="tank-player-id"
                    ref={playerIdInputRef}
                    className="input game-id-input"
                    value={draftPlayerId}
                    maxLength={24}
                    placeholder="例如：Xiaohan / Pilot-01"
                    onChange={(event) => setDraftPlayerId(event.target.value)}
                  />

                  <div className="game-color-picker">
                    <div className="game-field-label">选择颜色</div>
                    <div className="game-color-swatch-row" role="radiogroup" aria-label="选择颜色">
                      {PLAYER_COLOR_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          role="radio"
                          aria-checked={selectedColor === option.key}
                          aria-label={option.label}
                          className={`game-color-swatch${selectedColor === option.key ? " selected" : ""}${occupiedColorSet.has(option.key) ? " occupied" : ""}${blockedColor === option.key ? " blocked" : ""}`}
                          style={{ ["--swatch-color" as string]: option.swatch }}
                          onClick={() => {
                            if (occupiedColorSet.has(option.key)) {
                              setBlockedColor(option.key);
                              window.setTimeout(() => {
                                setBlockedColor((current) => (current === option.key ? null : current));
                              }, COLOR_BLOCK_SHAKE_MS);
                              setRoomError("该颜色正在被其他玩家使用。");
                              return;
                            }
                            setBlockedColor(null);
                            setRoomError("");
                            setSelectedColor(option.key);
                          }}
                        >
                          <span className="game-color-dot" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="game-control-bindings">
                    <div className="game-control-bindings-head">
                      <div className="game-field-label">键位设置</div>
                      <button
                        type="button"
                        className={`game-control-edit-toggle${controlBindingEditOpen ? " active" : ""}`}
                        onClick={() => setControlBindingEditOpen((current) => !current)}
                      >
                        {controlBindingEditOpen ? "完成" : "设置"}
                      </button>
                    </div>
                    {controlBindingEditOpen ? (
                      <div className="game-control-binding-grid">
                      {CONTROL_BINDING_ITEMS.map((item) => (
                        <button
                          key={item.action}
                          type="button"
                          className={`game-control-binding-button${bindingCaptureAction === item.action ? " capturing" : ""} editable`}
                          onClick={() => setBindingCaptureAction(item.action)}
                        >
                          <span>{item.label}</span>
                          <strong>
                            {bindingCaptureAction === item.action ? "按一个键" : formatKeyCode(controlBindings[item.action])}
                          </strong>
                        </button>
                      ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="game-action-row">
                    <Button
                      block
                      loading={roomBusy && launchMode === "online"}
                      disabled={defaultStartDisabled}
                      onClick={() => void startSession("online")}
                    >
                      {startLabel}
                    </Button>
                    <div className="game-custom-mode-stack">
                      <Button
                        block
                        variant="secondary"
                        loading={roomBusy && launchMode === "custom"}
                        disabled={roomBusy}
                        onClick={() => setCustomModeOpen((current) => !current)}
                      >
                        自定义模式
                      </Button>
                    </div>
                    <Button
                      block
                      variant="secondary"
                      loading={roomBusy && launchMode === "local"}
                      disabled={!hasSelectedGame || roomBusy}
                      onClick={() => void startSession("local")}
                    >
                      本地测试
                    </Button>
                    {canRunSetup ? <div className="game-setup-stack">
                      <Button
                        block
                        variant="secondary"
                        loading={tankTroubleSetupBusy}
                        disabled={!hasSelectedGame || roomBusy || tankTroubleSetupBusy}
                        onClick={() => void configureTankTroubleServer()}
                      >
                        一键配置
                      </Button>
                      <div className={tankTroubleSetupFeedbackClassName}>
                        {tankTroubleSetupMessage}
                      </div>
                    </div> : null}
                  </div>

                  {customModeOpen ? (
                    <div className="game-custom-mode-menu">
                      {CUSTOM_OPTION_ITEMS.map((item) => (
                        <div className="game-custom-option-row" key={item.key}>
                          <span>{item.label}</span>
                          <ToggleSwitch
                            checked={customOptions[item.key]}
                            size="md"
                            ariaLabel={item.label}
                            disabled={customServerControlsLocked}
                            onClick={() => {
                              if (customServerControlsLocked) {
                                return;
                              }
                              setCustomOptions((current) => ({
                                ...current,
                                [item.key]: !current[item.key],
                              }));
                            }}
                          />
                        </div>
                      ))}
                      {roomInCustomMode && customControlsLocked ? (
                        <div className="game-custom-mode-note">当前服务器自定义模式已锁定，可直接加入。</div>
                      ) : null}
                      {roomInDefaultMode ? (
                        <div className="game-custom-mode-note warning">当前服务器正在默认联机模式中。</div>
                      ) : null}
                      <Button
                        block
                        loading={roomBusy && launchMode === "custom"}
                        disabled={customStartDisabled}
                        onClick={() => void startSession("custom")}
                      >
                        {customStartLabel}
                      </Button>
                    </div>
                  ) : null}

                  {roomState ? (
                    <div className="game-identity-note">
                      当前在线 {roomState.active_player_count} / {PLAYER_COLOR_OPTIONS.length} · 当前地图 {roomState.map_id}
                    </div>
                  ) : null}
                  {launchHint && !roomError ? <div className="game-identity-note">{launchHint}</div> : null}
                  {roomError ? <div className="game-identity-note game-identity-note-error">{roomError}</div> : null}
                </div>
              ) : null}
            </div>

            {false ? (
              <>
            <div className="game-panel-header">
              <div>
                <div className="section-title">玩玩游戏</div>
                <div className="section-subtitle">先把游戏页接进控制台，后面再逐步往多人房间和对战状态扩。</div>
              </div>
              <div className="game-status-pill">Solo Preview</div>
            </div>

            <div className="game-launch-grid">
              <div className="game-library-card">
                <div className="game-library-head">
                  <div className="section-title">游戏选择</div>
                  <div className="section-subtitle">当前先保留 1 个测试入口，后面再往这里扩游戏列表。</div>
                </div>

                <button
                  type="button"
                  className={`game-choice-card ${selectedGame === selectedOption.key ? "selected" : ""} ${selectedOption.accent}`}
                  onClick={() => setSelectedGame(selectedOption.key)}
                >
                  <div className="game-choice-title">{selectedOption.title}</div>
                  <div className="game-choice-subtitle">{selectedOption.subtitle}</div>
                  <div className="game-choice-detail">{selectedOption.detail}</div>
                  <div className="game-choice-badge">1P Test Build</div>
                </button>
              </div>

              <div className="game-identity-card">
                <div className="section-title">进入训练</div>
                <div className="section-subtitle">输入玩家 ID 后进入当前地图，地图状态和换图投票会独立走云端同步。</div>

                <label className="game-field-label" htmlFor="tank-player-id">
                  玩家 ID
                </label>
                <input
                  id="tank-player-id"
                  className="input game-id-input"
                  value={draftPlayerId}
                  maxLength={24}
                  placeholder="例如：Xiaohan / Pilot-01"
                  onChange={(event) => setDraftPlayerId(event.target.value)}
                />

                <div className="game-meta-stack">
                  <div className="game-meta-chip">
                    <span>模式</span>
                    <strong>本地画面 + 云端地图</strong>
                  </div>
                  <div className="game-meta-chip">
                    <span>操作</span>
                    <strong>W / S / A / D / Space</strong>
                  </div>
                  <div className="game-meta-chip">
                    <span>当前重点</span>
                    <strong>大画面 / 右侧计分板 / 换图投票</strong>
                  </div>
                </div>

                <Button block loading={roomBusy} disabled={!playerId || roomInCustomMode} onClick={() => void startSession("online")}>
                  进入训练场
                </Button>

                {roomError ? <div className="game-identity-note game-identity-note-error">{roomError}</div> : null}
                <div className="game-identity-note">这条换图状态链路会独立走云端，不会碰当前视频推流和控制信号路径。</div>
              </div>
            </div>
              </>
            ) : null}
          </>
        ) : (
          <div
            ref={sessionLayoutRef}
            className={`game-session-layout ${scoreboardDocked ? "scoreboard-docked" : "scoreboard-persistent"}`}
          >
            <div className={`game-stage-shell${scoreboardDocked ? " game-stage-shell-docked" : ""}`}>
              <div className="game-stage-frame" style={{ aspectRatio: stageAspectRatio }}>
                <div className="game-stage-surface">
                  <canvas ref={canvasRef} className="game-stage-canvas" width={WORLD_WIDTH} height={WORLD_HEIGHT} />
                </div>
              </div>
            </div>

            {scoreboardDocked ? (
              <div
                className="game-scoreboard-trigger-zone"
                onMouseEnter={openScoreboard}
                onMouseLeave={scheduleScoreboardClose}
                aria-hidden="true"
              />
            ) : null}

            <aside
              className={`game-scoreboard-panel ${scoreboardDocked ? "docked" : "persistent"} ${scoreboardOpen ? "open" : ""}`}
              onMouseEnter={cancelScoreboardClose}
              onMouseLeave={scheduleScoreboardClose}
            >
              {scoreboardDocked ? (
                <button
                  type="button"
                  className="game-scoreboard-peek"
                  onMouseEnter={openScoreboard}
                  onFocus={openScoreboard}
                  aria-label="显示计分板"
                >
                  <span className="game-scoreboard-peek-label">计分板</span>
                </button>
              ) : null}
              <div className="game-scoreboard-head">
                <div className="game-scoreboard-title">计分板</div>
              </div>

              <div className="game-scoreboard-list">
                {scoreboardRows.map((entry, index) => (
                  <div
                    className={`game-scoreboard-row ${entry ? "" : "empty"} ${entry?.playerId === session.playerId ? "active" : ""}`}
                    key={`${index}-${entry?.playerId ?? "empty"}`}
                  >
                    <span className="game-score-rank">
                      {entry && SCOREBOARD_RANK_ICON_SOURCES[index + 1] ? (
                        <img
                          className="game-score-rank-medal"
                          src={SCOREBOARD_RANK_ICON_SOURCES[index + 1]}
                          alt={`Rank ${index + 1}`}
                          loading="lazy"
                        />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <span className="game-score-name">
                      {entry ? (
                        <span className={`game-score-latency game-score-latency-${latencyClassName(entry.latencyMs)}`}>
                          {formatLatencyLabel(entry.latencyMs)}
                        </span>
                      ) : null}
                      {entry?.countryCode ? (
                        <img
                          className="game-score-name-flag"
                          src={buildCircleFlagUrl(entry.countryCode)}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                        />
                      ) : null}
                      <span className="game-score-name-label">{entry ? truncatePlayerIdLabel(entry.playerId) : "--"}</span>
                    </span>
                    <span className="game-score-value">{entry ? entry.score : "-"}</span>
                  </div>
                ))}
              </div>

              <div className="game-scoreboard-footer">
                <div className="game-scoreboard-runtime">{`当前分数 ${snapshot.score} · 命中 ${snapshot.hits} · 自杀 ${snapshot.deaths}`}</div>

                <button
                  type="button"
                  className={mapVoteButtonClassName}
                  disabled={roomBusy}
                  onClick={toggleMapVote}
                  onMouseEnter={() => setVoteHovered(true)}
                  onMouseLeave={() => setVoteHovered(false)}
                >
                  <span>{mapVoteLabel}</span>
                </button>

                {voteMarkers.length ? (
                  <div className="game-scoreboard-vote-strip">
                    {voteMarkers.map((marker) => (
                      <span
                        className="game-scoreboard-vote-badge"
                        key={`vote-${marker.player_id}`}
                        title={marker.player_id}
                        style={{ ["--vote-color" as string]: getVoteDotColor(marker.color) }}
                      >
                        <span className="game-scoreboard-vote-badge-dot" aria-hidden="true" />
                        <span className="game-scoreboard-vote-badge-label">{truncatePlayerIdLabel(marker.player_id)}</span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {sessionErrorMessage ? <div className="game-scoreboard-note">{sessionErrorMessage}</div> : null}

                {session.mode === "latency" && previewPageUrl ? (
                  <a className="game-scoreboard-preview-button" href={previewPageUrl} target="_blank" rel="noreferrer">
                    <span>打开网页预览</span>
                  </a>
                ) : null}

                <Button variant="ghost" block onClick={leaveSession}>
                  返回选单
                </Button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
