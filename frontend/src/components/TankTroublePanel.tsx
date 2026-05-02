import { useEffect, useRef, useState } from "react";
import {
  clearTankTroublePreview,
  getTankTroublePreviewPageUrl,
  leaveTankTroubleRoom,
  pushTankTroublePreview,
  syncTankTroubleRoom,
  toggleTankTroubleRoomVote,
} from "../api/cloudApi";
import type {
  TankTroubleLatencyCloneState,
  TankTroubleLatencyFireEvent,
  TankTroubleLatencyInputState,
  TankTroubleLatencyRequest,
  TankTroubleLatencyState,
  TankTroubleLatencyTargetRespawn,
  TankTroublePreviewBulletState,
  TankTroublePreviewPlayerSnapshot,
  TankTroublePreviewTargetState,
  TankTroubleRoomState,
} from "../types/cloud";
import { Button } from "./Button";

type TankTroublePanelProps = {
  theme: "light" | "dark";
  localCountryCode?: string;
};

type GameKey = "tank-trouble";

type GameChoice = {
  key: GameKey;
  title: string;
  subtitle: string;
  detail: string;
  accent: string;
};

type GameSessionMode = "training" | "latency";

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
};

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
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

type LatencyTransportMessage =
  | { type: "state"; state: TankTroubleLatencyState }
  | { type: "error"; message: string }
  | { type: "left"; ok: boolean };

type Bullet = Circle & {
  id: number;
  vx: number;
  vy: number;
  life: number;
  bouncesLeft: number;
  age: number;
};

type BulletFade = Circle & {
  id: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
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

type TrainingTarget = Circle & {
  id: number;
  phase: number;
};

type PlayerTank = Circle & {
  id: string;
  angle: number;
  cooldown: number;
  flash: number;
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
};

type TankTroubleEngine = {
  setTheme: (theme: "light" | "dark") => void;
  setBotEnabled: (enabled: boolean) => void;
  setLatencyOnly: (enabled: boolean) => void;
  update: (dt: number, input: InputState) => void;
  render: (ctx: CanvasRenderingContext2D) => void;
  snapshot: () => TankTroubleSnapshot;
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
    subtitle: "单人训练场",
    detail: "先把游戏内画面、朝向、反弹和自杀判定跑顺，再继续接云端地图同步和联机状态。",
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
const TANK_TROUBLE_ROOM = "tank-trouble-main";
const ROOM_POLL_INTERVAL_MS = 1200;
const LATENCY_SYNC_IDLE_INTERVAL_MS = 90;
const LATENCY_SYNC_RUSH_INTERVAL_MS = 12;
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
const PLAYER_TURN_SPEED = 2.15;
const LOGICAL_GRID_COLS = 9;
const LOGICAL_GRID_ROWS = 6;
const LOGICAL_GRID_SIZE = Math.min(ARENA_WIDTH / LOGICAL_GRID_COLS, ARENA_HEIGHT / LOGICAL_GRID_ROWS);
const PLAYER_SPEED = LOGICAL_GRID_SIZE * 1.6;
const BULLET_SPEED = LOGICAL_GRID_SIZE * 1.85;
const BULLET_LIFE = 10;
const BULLET_BOUNCES = 7;
const SHOOT_COOLDOWN = 0.24;
const MAX_BULLETS = 5;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(aX: number, aY: number, bX: number, bY: number) {
  return Math.hypot(aX - bX, aY - bY);
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
  return distance(circle.x, circle.y, closestX, closestY) < circle.radius;
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

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getPlayerPalette(playerColor: string, theme: "light" | "dark") {
  const normalized = String(playerColor || "").trim().toLowerCase();
  let baseColor = "#22c55e";
  let brightColor = theme === "dark" ? "#86efac" : "#16a34a";

  if (normalized === "red") {
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

function buildSessionFromRoomState(
  playerId: string,
  roomState: TankTroubleRoomState,
  preferredColor?: PlayerColorKey,
  mode: GameSessionMode = "training",
): GameSession {
  return {
    playerId,
    seed: roomState.map_seed,
    mapId: roomState.map_id,
    room: roomState.room || TANK_TROUBLE_ROOM,
    playerColor: preferredColor ?? normalizePlayerColorKey(roomState.local_player_color),
    mode,
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

function createTargets(seed: number, walls: Rect[], player: PlayerTank) {
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

function createTankTroubleEngine(options: {
  playerId: string;
  seed: number;
  mapTag: string;
  theme: "light" | "dark";
  playerColor: string;
}): TankTroubleEngine {
  const walls = buildTrainingWalls(options.seed);
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
  let fireLatched = false;
  const mapTag = options.mapTag || `MAP-${(options.seed >>> 0).toString(16).slice(-4).toUpperCase()}`;
  let targets: TrainingTarget[] = [];
  let wallRipples: WallRipple[] = [];
  let bulletFades: BulletFade[] = [];
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
    deaths += 1;
    score = Math.max(0, score - 120);
    bullets = [];
    respawnPlayer();
  }

  function destroyBot() {
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

    ctx.save();
    ctx.shadowColor = tankPalette.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = hexToRgba(tankPalette.base, darkMode ? 0.18 : 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, tank.radius + 9 + tankPulse * 2, 0, Math.PI * 2);
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
    drawRoundedRectPath(ctx, -5.2, -38, 10.4, 35, 5.1);
    ctx.fillStyle = barrelGradient;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = tankFrameStroke;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(0, -8);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = tankCircuit;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -37, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = tankCoreGlow;
    ctx.fill();
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

    if (tank.flash > 0) {
      ctx.fillStyle = tankPalette.flash.replace(/, ([0-9.]+)\)$/, `, ${clamp(tank.flash * 5.8, 0, 0.95)})`);
      ctx.beginPath();
      ctx.arc(0, -(tank.radius + 18), 8 + tank.flash * 24, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
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
      bulletFades = bulletFades
        .map((fade) => ({
          ...fade,
          x: fade.x + fade.vx * dt,
          y: fade.y + fade.vy * dt,
          life: fade.life - dt,
        }))
        .filter((fade) => fade.life > 0);

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
          let nextBullet: Bullet = {
            ...bullet,
            x: bullet.x + bullet.vx * dt,
            y: bullet.y + bullet.vy * dt,
            life: bullet.life - dt,
            age: bullet.age + dt,
          };

          for (const wall of walls) {
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
            latencyClone = {
              ...cloneState,
              flash: Math.max(cloneState.flash, 0.12),
            };
            return [];
          }

          const hitSelf =
            nextBullet.age >= SELF_HIT_ARM_DELAY &&
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
          let nextBullet: Bullet = {
            ...bullet,
            x: bullet.x + bullet.vx * dt,
            y: bullet.y + bullet.vy * dt,
            life: bullet.life - dt,
            age: bullet.age + dt,
          };

          for (const wall of walls) {
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
            nextBullet.age >= SELF_HIT_ARM_DELAY &&
            distance(player.x, player.y, nextBullet.x, nextBullet.y) < player.radius + nextBullet.radius;

          if (hitPlayer) {
            pushBulletFade(nextBullet);
            destroyPlayer();
            return [];
          }

          const hitSelf =
            nextBullet.age >= SELF_HIT_ARM_DELAY &&
            distance(bot.x, bot.y, nextBullet.x, nextBullet.y) < bot.radius + nextBullet.radius;

          if (hitSelf) {
            pushBulletFade(nextBullet);
            bot.flash = Math.max(bot.flash, 0.12);
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
          let nextBullet: LatencyCloneBulletState = {
            ...bullet,
            x: bullet.x + bullet.vx * dt,
            y: bullet.y + bullet.vy * dt,
            life: bullet.life - dt,
            age: bullet.age + dt,
          };

          for (const wall of walls) {
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
              nextBullet.age >= SELF_HIT_ARM_DELAY &&
              distance(player.x, player.y, nextBullet.x, nextBullet.y) < player.radius + nextBullet.radius;

            if (hitPlayer) {
              pushBulletFade(nextBullet);
              player.flash = Math.max(player.flash, 0.12);
              return [];
            }
          }

          const hitClone =
            nextBullet.age >= SELF_HIT_ARM_DELAY &&
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
          ctx.save();
          ctx.shadowColor = playerPalette.glow;
          ctx.shadowBlur = 14;
          ctx.fillStyle = playerPalette.bright;
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, Math.max(1.6, bullet.radius - 2), 0, Math.PI * 2);
          ctx.fillStyle = playerPalette.base;
          ctx.fill();
          ctx.restore();
        }

        if (botEnabled) {
          for (const bullet of botBullets) {
            ctx.save();
            ctx.shadowColor = botPalette.glow;
            ctx.shadowBlur = 14;
            ctx.fillStyle = botPalette.bright;
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, Math.max(1.6, bullet.radius - 2), 0, Math.PI * 2);
            ctx.fillStyle = botPalette.base;
            ctx.fill();
            ctx.restore();
          }
        }
      }

      if (latencyClone && clonePalette) {
        for (const bullet of latencyBullets) {
          ctx.save();
          ctx.shadowColor = clonePalette.glow;
          ctx.shadowBlur = 14;
          ctx.fillStyle = clonePalette.bright;
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, Math.max(1.6, bullet.radius - 2), 0, Math.PI * 2);
          ctx.fillStyle = clonePalette.base;
          ctx.fill();
          ctx.restore();
        }
      }

      {
        const fadePalette = latencyOnly && clonePalette ? clonePalette : playerPalette;
        for (const fade of bulletFades) {
          const progress = fade.life / fade.maxLife;
          ctx.save();
          ctx.globalAlpha = progress;
          ctx.shadowColor = fadePalette.glow;
          ctx.shadowBlur = 12 * progress;
          ctx.fillStyle = fadePalette.bright;
          ctx.beginPath();
          ctx.arc(fade.x, fade.y, fade.radius + (1 - progress) * 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(fade.x, fade.y, Math.max(1.2, fade.radius - 1.8 + progress * 0.7), 0, Math.PI * 2);
          ctx.fillStyle = fadePalette.base;
          ctx.fill();
          ctx.restore();
        }
      }

      if (latencyClone && clonePalette) {
        drawTankSprite(ctx, latencyClone, latencyClone.color);
        ctx.save();
        ctx.font = "700 12px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = darkMode ? "rgba(191, 219, 254, 0.88)" : "rgba(15, 23, 42, 0.68)";
        ctx.fillText(
          `${latencyClone.player_id} · ${String(latencyClone.country_code || "").toUpperCase()}`,
          latencyClone.x,
          latencyClone.y - latencyClone.radius - 22,
        );
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

      ctx.save();
      ctx.font = "700 16px 'Segoe UI'";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = darkMode ? "rgba(219, 234, 254, 0.88)" : "rgba(15, 23, 42, 0.76)";
      ctx.fillText(latencyOnly ? "Latency View" : `Pilot · ${player.id}`, ARENA_X - 2, ARENA_Y - 34);
      ctx.textAlign = "right";
      ctx.fillText(mapTag, ARENA_X + ARENA_WIDTH + 2, ARENA_Y - 34);
      ctx.restore();
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
          shots,
          score,
          hits,
        },
        bullets: bullets.map((bullet) => ({
          id: bullet.id,
          color: options.playerColor,
          x: bullet.x,
          y: bullet.y,
          radius: bullet.radius,
          vx: bullet.vx,
          vy: bullet.vy,
        })),
        targets: targets.map((target) => ({
          id: target.id,
          x: target.x,
          y: target.y,
          radius: target.radius,
          phase: target.phase,
        })),
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

export function TankTroublePanel({ theme, localCountryCode = "" }: TankTroublePanelProps) {
  const [selectedGame, setSelectedGame] = useState<GameKey | null>(null);
  const [selectedColor, setSelectedColor] = useState<PlayerColorKey>("green");
  const [draftPlayerId, setDraftPlayerId] = useState(loadStoredPlayerId);
  const [session, setSession] = useState<GameSession | null>(null);
  const [snapshot, setSnapshot] = useState<TankTroubleSnapshot>(createEmptySnapshot);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadStoredLeaderboard);
  const [roomState, setRoomState] = useState<TankTroubleRoomState | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [latencyError, setLatencyError] = useState("");
  const [previewPageUrl, setPreviewPageUrl] = useState("");
  const [launchMode, setLaunchMode] = useState<GameSessionMode>("training");
  const [scoreboardDocked, setScoreboardDocked] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [voteHovered, setVoteHovered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionLayoutRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TankTroubleEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const closeScoreboardTimerRef = useRef<number | null>(null);
  const latencySyncKickRef = useRef<(() => void) | null>(null);
  const lastFrameRef = useRef(0);
  const latencyAckInputSeqRef = useRef(0);
  const latencyInputSeqRef = useRef(0);
  const latencySnapshotSeqRef = useRef(0);
  const previewPushSeqRef = useRef(0);
  const fireSeqRef = useRef(0);
  const inputRef = useRef<InputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    fire: false,
  });

  useEffect(() => {
    if (!session) {
      engineRef.current = null;
      setSnapshot(createEmptySnapshot());
      setLatencyError("");
      setScoreboardDocked(false);
      setScoreboardOpen(false);
      return;
    }

    engineRef.current = createTankTroubleEngine({
      playerId: session.playerId,
      seed: session.seed,
      mapTag: session.mapId,
      theme,
      playerColor: session.playerColor,
    });
    engineRef.current.setBotEnabled(session.mode !== "latency");
    setSnapshot(engineRef.current.snapshot());
  }, [session]);

  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (closeScoreboardTimerRef.current) {
        window.clearTimeout(closeScoreboardTimerRef.current);
      }
    };
  }, []);

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
    if (!session) {
      setRoomState(null);
      setVoteHovered(false);
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
    engineRef.current?.setLatencyOnly(false);
    engineRef.current?.clearLatencyState();
    setLatencyError("");
  }, [session?.mode]);

  useEffect(() => {
    if (!session || session.mode !== "latency") {
      setPreviewPageUrl("");
      return;
    }

    let disposed = false;
    void getTankTroublePreviewPageUrl()
      .then((url) => {
        if (!disposed) {
          setPreviewPageUrl(url);
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
        previewPushSeqRef.current = snapshotSeq;
        await pushTankTroublePreview({
          session_id: sessionId,
          room: session.room,
          player_id: session.playerId,
          country_code: localCountryCode,
          snapshot_seq: snapshotSeq,
          ...previewSnapshot,
          updated_at_ms: Date.now(),
        });
        if (!disposed) {
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
    if (!session) {
      return;
    }

    setLeaderboard((current) => {
      const next = mergeLeaderboardEntry(current, {
        playerId: session.playerId,
        countryCode: localCountryCode,
        score: snapshot.score,
        hits: snapshot.hits,
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
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current || !session) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const syncCanvasResolution = () => {
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

    const updateKeyState = (code: string, pressed: boolean) => {
      switch (code) {
        case "KeyW":
          if (inputRef.current.forward === pressed) {
            return true;
          }
          inputRef.current.forward = pressed;
          latencySyncKickRef.current?.();
          return true;
        case "KeyS":
          if (inputRef.current.backward === pressed) {
            return true;
          }
          inputRef.current.backward = pressed;
          latencySyncKickRef.current?.();
          return true;
        case "KeyA":
          if (inputRef.current.left === pressed) {
            return true;
          }
          inputRef.current.left = pressed;
          latencySyncKickRef.current?.();
          return true;
        case "KeyD":
          if (inputRef.current.right === pressed) {
            return true;
          }
          inputRef.current.right = pressed;
          latencySyncKickRef.current?.();
          return true;
        case "Space":
          if (inputRef.current.fire === pressed && !pressed) {
            return true;
          }
          if (pressed && !inputRef.current.fire) {
            fireSeqRef.current += 1;
          }
          inputRef.current.fire = pressed;
          latencySyncKickRef.current?.();
          return true;
        default:
          return false;
      }
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

      const delta = Math.min(0.034, Math.max(0.01, (frameTime - lastFrameRef.current) / 1000));
      lastFrameRef.current = frameTime;
      syncCanvasResolution();
      activeEngine.update(delta, inputRef.current);
      activeEngine.render(ctx);

      snapshotBudget += delta;
      if (snapshotBudget >= 0.08) {
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
  const scoreboardRows = Array.from({ length: SCOREBOARD_LIMIT }, (_, index) => leaderboard[index] ?? null);
  const stageAspectRatio = `${WORLD_WIDTH} / ${WORLD_HEIGHT}`;
  const mapVoteLabel = roomState?.countdown_active
    ? `准备换图 ${roomState.countdown_seconds}`
    : voteHovered
      ? "投票换图"
      : `当前地图：${session?.mapId ?? snapshot.mapTag}`;
  const localVoteDotColor = getVoteDotColor(session?.playerColor || roomState?.local_player_color || "green");
  const sessionErrorMessage = latencyError || roomError;

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
    if (!playerId || !hasSelectedGame) {
      return;
    }

    fireSeqRef.current = 0;
    setLaunchMode(mode);
    setRoomBusy(true);
    setRoomError("");
    setLatencyError("");
    try {
      const nextRoomState = await syncTankTroubleRoom({
        room: TANK_TROUBLE_ROOM,
        player_id: playerId,
        country_code: localCountryCode,
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

  function leaveSession() {
    const currentSession = session;

    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (currentSession) {
      void leaveTankTroubleRoom({
        room: currentSession.room,
        player_id: currentSession.playerId,
        country_code: localCountryCode,
      }).catch(() => undefined);
    }

    engineRef.current = null;
    setSession(null);
    setRoomState(null);
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
                    <div className="game-choice-badge">1P Test Build</div>
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
                          className={`game-color-swatch${selectedColor === option.key ? " selected" : ""}`}
                          style={{ ["--swatch-color" as string]: option.swatch }}
                          onClick={() => setSelectedColor(option.key)}
                        >
                          <span className="game-color-dot" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="game-action-row">
                    <Button
                      block
                      loading={roomBusy && launchMode === "training"}
                      disabled={!playerId || !hasSelectedGame || roomBusy}
                      onClick={() => void startSession("training")}
                    >
                      开始游戏
                    </Button>
                    <Button
                      block
                      variant="secondary"
                      loading={roomBusy && launchMode === "latency"}
                      disabled={!playerId || !hasSelectedGame || roomBusy}
                      onClick={() => void startSession("latency")}
                    >
                      测试延迟
                    </Button>
                  </div>

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

                <Button block loading={roomBusy} disabled={!playerId} onClick={() => void startSession("training")}>
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
                    <span className="game-score-rank">{String(index + 1).padStart(2, "0")}</span>
                    <span className="game-score-name">
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
                  className={`game-scoreboard-runtime game-scoreboard-runtime-button ${roomState?.local_player_voted ? "active" : ""}`}
                  disabled={roomBusy}
                  onClick={toggleMapVote}
                  onMouseEnter={() => setVoteHovered(true)}
                  onMouseLeave={() => setVoteHovered(false)}
                >
                  <span>{mapVoteLabel}</span>
                  {roomState?.local_player_voted ? (
                      <span
                        className="game-scoreboard-vote-dot"
                        aria-hidden="true"
                        style={{ backgroundColor: localVoteDotColor, color: localVoteDotColor }}
                      />
                  ) : null}
                </button>

                {sessionErrorMessage ? <div className="game-scoreboard-note">{sessionErrorMessage}</div> : null}

                {session.mode === "latency" && previewPageUrl ? (
                  <a className="game-scoreboard-note" href={previewPageUrl} target="_blank" rel="noreferrer">
                    网页预览：{previewPageUrl}
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
