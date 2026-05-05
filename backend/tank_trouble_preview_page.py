from __future__ import annotations


def build_tank_trouble_preview_html() -> str:
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tank Trouble Viewer</title>
    <style>
      :root {
        color-scheme: dark;
        --page-bg: #04101c;
        --panel-bg: rgba(7, 17, 31, 0.9);
        --panel-border: rgba(103, 232, 249, 0.16);
        --panel-shadow: rgba(2, 6, 23, 0.35);
        --text: #e8f3ff;
        --muted: #90a9c6;
        --accent: #67e8f9;
        --accent-soft: rgba(103, 232, 249, 0.14);
        --row-bg: rgba(10, 20, 34, 0.7);
        --row-active: rgba(14, 116, 144, 0.3);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top left, rgba(34, 211, 238, 0.14), transparent 26%),
          radial-gradient(circle at right center, rgba(59, 130, 246, 0.16), transparent 28%),
          linear-gradient(180deg, #03101d 0%, var(--page-bg) 100%);
        color: var(--text);
        font: 500 14px/1.5 "Segoe UI", "Microsoft YaHei UI", sans-serif;
      }

      body {
        padding: 14px;
      }

      .shell {
        width: min(1480px, 100%);
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        gap: 14px;
      }

      .card {
        border-radius: 24px;
        border: 1px solid var(--panel-border);
        background: var(--panel-bg);
        box-shadow: 0 24px 64px var(--panel-shadow);
        backdrop-filter: blur(18px);
        overflow: hidden;
      }

      .stage-card {
        min-width: 0;
      }

      .stage-wrap {
        position: relative;
        aspect-ratio: 1280 / 800;
        min-height: 320px;
        background:
          radial-gradient(circle at top, rgba(103, 232, 249, 0.08), transparent 44%),
          rgba(4, 12, 23, 0.96);
      }

      .stage-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      .stage-overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(3, 10, 18, 0.12), rgba(3, 10, 18, 0.28));
      }

      .stage-overlay[hidden] {
        display: none;
      }

      .stage-overlay-copy {
        padding: 18px 22px;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(3, 10, 18, 0.52);
        text-align: center;
        max-width: min(520px, calc(100% - 32px));
        box-shadow: 0 18px 40px rgba(2, 6, 23, 0.24);
      }

      .stage-overlay-title {
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .stage-overlay-note {
        margin-top: 8px;
        color: var(--muted);
      }

      .score-card {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .score-head,
      .score-foot {
        padding: 18px 18px 14px;
      }

      .score-head {
        border-bottom: 1px solid var(--panel-border);
      }

      .score-title {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }

      .score-subtitle {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
      }

      .score-map,
      .score-runtime {
        padding: 0 18px;
      }

      .score-map {
        padding-top: 16px;
        font-size: 16px;
        font-weight: 700;
      }

      .score-runtime {
        padding-top: 8px;
        color: var(--muted);
        font-size: 12px;
      }

      .score-list {
        flex: 1;
        min-height: 0;
        padding: 14px 14px 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .score-row {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 16px;
        background: var(--row-bg);
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .score-row.active {
        background: var(--row-active);
        border-color: rgba(103, 232, 249, 0.28);
      }

      .score-rank {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
      }

      .score-name {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .score-country {
        display: inline-flex;
        min-width: 28px;
        justify-content: center;
        padding: 2px 6px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .score-latency {
        display: inline-flex;
        min-width: 42px;
        justify-content: center;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.12);
        color: var(--muted);
        font-size: 10px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }

      .score-latency.good {
        color: #16a34a;
        background: rgba(34, 197, 94, 0.13);
      }

      .score-latency.warn {
        color: #d97706;
        background: rgba(245, 158, 11, 0.15);
      }

      .score-latency.bad {
        color: #dc2626;
        background: rgba(239, 68, 68, 0.14);
      }

      :root[data-theme="dark"] .score-latency.good { color: #86efac; }
      :root[data-theme="dark"] .score-latency.warn { color: #fde68a; }
      :root[data-theme="dark"] .score-latency.bad { color: #fca5a5; }

      .score-player {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .score-value {
        font-variant-numeric: tabular-nums;
        font-size: 16px;
        font-weight: 700;
      }

      .score-meta {
        color: var(--muted);
        font-size: 12px;
      }

      .score-meta + .score-meta {
        margin-top: 6px;
      }

      @media (max-width: 1100px) {
        body {
          padding: 10px;
        }

        .shell {
          grid-template-columns: 1fr;
        }

        .score-card {
          min-height: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="card stage-card">
        <div class="stage-wrap" id="stage-wrap">
          <canvas class="stage-canvas" id="stage-canvas"></canvas>
          <div class="stage-overlay" id="stage-overlay">
            <div class="stage-overlay-copy">
              <div class="stage-overlay-title" id="overlay-title">Waiting for desktop preview</div>
              <div class="stage-overlay-note" id="overlay-note">
                Start the latency session in the desktop console to publish live battle state.
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="card score-card">
        <header class="score-head">
          <div class="score-title">Scoreboard</div>
          <div class="score-subtitle" id="score-subtitle">No active session</div>
        </header>
        <div class="score-map" id="score-map">Waiting for published map state</div>
        <div class="score-runtime" id="score-runtime">No runtime summary yet</div>
        <div class="score-list" id="score-list"></div>
        <footer class="score-foot">
          <div class="score-meta" id="score-meta">Frame -</div>
          <div class="score-meta" id="score-age">Last update -</div>
        </footer>
      </aside>
    </main>

    <script>
      const PREVIEW_STATE_URL = "/api/games/tank-trouble/preview/state";
const POLL_INTERVAL_MS = 45;
      const STALE_AFTER_MS = 1400;
      const WORLD_WIDTH = 1280;
      const WORLD_HEIGHT = 800;
      const SCOREBOARD_LIMIT = 10;

      const canvas = document.getElementById("stage-canvas");
      const ctx = canvas.getContext("2d");
      const stageWrap = document.getElementById("stage-wrap");
      const stageOverlay = document.getElementById("stage-overlay");
      const overlayTitle = document.getElementById("overlay-title");
      const overlayNote = document.getElementById("overlay-note");
      const scoreSubtitle = document.getElementById("score-subtitle");
      const scoreMap = document.getElementById("score-map");
      const scoreRuntime = document.getElementById("score-runtime");
      const scoreList = document.getElementById("score-list");
      const scoreMeta = document.getElementById("score-meta");
      const scoreAge = document.getElementById("score-age");

      let previewState = {
        active: false,
        frame_seq: 0,
        session_id: "",
        player_id: "",
        map_id: "",
        map_label: "",
        runtime_summary: "",
        rows: [],
        scene: null,
        updated_at_ms: 0,
      };
      let lastFetchError = "";
      let destroyed = false;
      let lastRenderAt = performance.now();
      const smoothedTanks = new Map();
      const smoothedBullets = new Map();

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function lerp(from, to, t) {
        return from + (to - from) * t;
      }

      function shortestAngleDelta(from, to) {
        let delta = (to - from) % (Math.PI * 2);
        if (delta > Math.PI) {
          delta -= Math.PI * 2;
        } else if (delta < -Math.PI) {
          delta += Math.PI * 2;
        }
        return delta;
      }

      function normalizeTheme() {
        return "dark";
      }

      function normalizeText(value) {
        return String(value ?? "").trim();
      }

      function hexToRgba(hex, alpha) {
        const normalized = String(hex || "#000000").replace("#", "");
        const value = normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized.padEnd(6, "0");
        const red = Number.parseInt(value.slice(0, 2), 16) || 0;
        const green = Number.parseInt(value.slice(2, 4), 16) || 0;
        const blue = Number.parseInt(value.slice(4, 6), 16) || 0;
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
      }

      function normalizeLatencyMs(value) {
        const latencyMs = Number(value || 0);
        if (!Number.isFinite(latencyMs) || latencyMs <= 0) {
          return 0;
        }
        return Math.max(1, Math.min(9999, Math.round(latencyMs)));
      }

      function latencyClassName(value) {
        const latencyMs = normalizeLatencyMs(value);
        if (!latencyMs) {
          return "unknown";
        }
        if (latencyMs <= 50) {
          return "good";
        }
        if (latencyMs <= 150) {
          return "warn";
        }
        return "bad";
      }

      function formatLatencyLabel(value) {
        const latencyMs = normalizeLatencyMs(value);
        return latencyMs ? `${latencyMs}ms` : "--ms";
      }

      function drawRoundedRectPath(context, x, y, width, height, radius) {
        const safeRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
        context.beginPath();
        context.moveTo(x + safeRadius, y);
        context.lineTo(x + width - safeRadius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
        context.lineTo(x + width, y + height - safeRadius);
        context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
        context.lineTo(x + safeRadius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
        context.lineTo(x, y + safeRadius);
        context.quadraticCurveTo(x, y, x + safeRadius, y);
        context.closePath();
      }

      function getPlayerPalette(playerColor, theme) {
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

      function getWorldPalette(theme) {
        if (theme === "light") {
          return {
            backdropTop: "#f8fcff",
            backdropBottom: "#dbeafe",
            arenaFill: "#f8fbff",
            arenaStroke: "rgba(14, 165, 233, 0.28)",
            grid: "rgba(14, 165, 233, 0.08)",
            scan: "rgba(56, 189, 248, 0.08)",
            wallFill: "#d9ebff",
            wallInner: "#ffffff",
            wallStroke: "rgba(37, 99, 235, 0.24)",
            targetCore: "#ffffff",
            targetRing: "rgba(14, 165, 233, 0.24)",
            targetGlow: "rgba(56, 189, 248, 0.2)",
          };
        }
        return {
          backdropTop: "#071424",
          backdropBottom: "#020912",
          arenaFill: "#081524",
          arenaStroke: "rgba(103, 232, 249, 0.18)",
          grid: "rgba(103, 232, 249, 0.06)",
          scan: "rgba(34, 211, 238, 0.08)",
          wallFill: "#10253f",
          wallInner: "#1d4d74",
          wallStroke: "rgba(125, 211, 252, 0.26)",
          targetCore: "#dff8ff",
          targetRing: "rgba(103, 232, 249, 0.24)",
          targetGlow: "rgba(34, 211, 238, 0.16)",
        };
      }

      function drawTankExplosions(context, explosions, theme) {
        const darkMode = theme === "dark";
        for (const explosion of explosions || []) {
          const maxLife = Math.max(0.0001, Number(explosion.maxLife || 0.78));
          const life = clamp(Number(explosion.life || 0), 0, maxLife);
          const progress = clamp(1 - life / maxLife, 0, 1);
          const alpha = Math.max(0, 1 - progress);
          if (alpha <= 0) {
            continue;
          }
          const palette = getPlayerPalette(explosion.color, theme);
          const x = Number(explosion.x || 0);
          const y = Number(explosion.y || 0);
          const radius = Math.max(1, Number(explosion.radius || 20));
          const shockRadius = radius * (1.15 + progress * 3.8);

          context.save();
          context.globalCompositeOperation = darkMode ? "lighter" : "source-over";
          context.shadowColor = palette.glow;
          context.shadowBlur = 26 * alpha;
          context.beginPath();
          context.arc(x, y, shockRadius, 0, Math.PI * 2);
          context.lineWidth = 5.4 - progress * 3.4;
          context.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.78 : 0.6) * alpha);
          context.stroke();

          const gradient = context.createRadialGradient(x, y, 0, x, y, radius * (1.6 + progress * 2.3));
          gradient.addColorStop(0, hexToRgba(palette.bright, (darkMode ? 0.42 : 0.32) * alpha));
          gradient.addColorStop(0.42, hexToRgba(palette.base, (darkMode ? 0.24 : 0.18) * alpha));
          gradient.addColorStop(1, hexToRgba(palette.base, 0));
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(x, y, radius * (1.6 + progress * 2.3), 0, Math.PI * 2);
          context.fill();
          context.restore();

          context.save();
          context.translate(x, y);
          context.rotate(progress * Math.PI * 0.85 + Number(explosion.id || 0) * 0.17);
          context.globalCompositeOperation = darkMode ? "lighter" : "source-over";
          context.shadowColor = palette.glow;
          context.shadowBlur = 18 * alpha;
          const techRadius = radius * (1.85 + progress * 2.7);
          for (let index = 0; index < 18; index += 1) {
            if (index % 3 === 1) {
              continue;
            }
            const start = (index / 18) * Math.PI * 2;
            const end = start + (Math.PI * 2 / 18) * 0.52;
            context.beginPath();
            context.arc(0, 0, techRadius, start, end);
            context.lineWidth = 2.1 - progress * 1.2;
            context.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.62 : 0.48) * alpha);
            context.stroke();
          }
          for (let index = 0; index < 8; index += 1) {
            const angle = (index / 8) * Math.PI * 2 + progress * 1.1;
            const inner = radius * (0.7 + progress * 1.3);
            const outer = radius * (1.25 + progress * 2.1);
            context.beginPath();
            context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
            context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
            context.lineWidth = 1.1;
            context.strokeStyle = hexToRgba(palette.bright, (darkMode ? 0.36 : 0.28) * alpha);
            context.stroke();
          }
          context.restore();
        }
      }

      function sanitizeRect(value) {
        return {
          x: Number(value?.x || 0),
          y: Number(value?.y || 0),
          w: Number(value?.w || 0),
          h: Number(value?.h || 0),
        };
      }

      function sanitizeSegments(value) {
        if (!Array.isArray(value)) {
          return [];
        }
        return value
          .map((segment) => ({
            x1: Number(segment?.x1 || 0),
            y1: Number(segment?.y1 || 0),
            x2: Number(segment?.x2 || 0),
            y2: Number(segment?.y2 || 0),
          }))
          .filter((segment) => Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) > 0.1);
      }

      function sanitizeScene(scene) {
        if (!scene || typeof scene !== "object") {
          return null;
        }
        return {
          theme: normalizeTheme(scene.theme),
          mapTag: normalizeText(scene.mapTag),
          elapsedMs: Number(scene.elapsedMs || 0),
          walls: Array.isArray(scene.walls) ? scene.walls.map(sanitizeRect) : [],
          tanks: Array.isArray(scene.tanks)
            ? scene.tanks.map((tank) => ({
                id: normalizeText(tank?.id),
                color: normalizeText(tank?.color) || "green",
                weapon: normalizeText(tank?.weapon) || "default",
                shotgun_ammo: Number(tank?.shotgun_ammo || 0),
                minigun_ammo: Number(tank?.minigun_ammo || 0),
                weapon_reload_ms: Number(tank?.weapon_reload_ms || 0),
                x: Number(tank?.x || 0),
                y: Number(tank?.y || 0),
                angle: Number(tank?.angle || 0),
                radius: Number(tank?.radius || 0),
                flash: Number(tank?.flash || 0),
              }))
            : [],
          bullets: Array.isArray(scene.bullets)
            ? scene.bullets.map((bullet) => ({
                id: Number(bullet?.id || 0),
                color: normalizeText(bullet?.color) || "green",
                projectile_type: normalizeText(bullet?.projectile_type) || "bullet",
                x: Number(bullet?.x || 0),
                y: Number(bullet?.y || 0),
                radius: Number(bullet?.radius || 0),
                vx: Number(bullet?.vx || 0),
                vy: Number(bullet?.vy || 0),
                path_segments: sanitizeSegments(bullet?.path_segments),
                distance_travelled: Number(bullet?.distance_travelled || 0),
                segments: sanitizeSegments(bullet?.segments),
              }))
            : [],
          targets: Array.isArray(scene.targets)
            ? scene.targets.map((target) => ({
                id: Number(target?.id || 0),
                x: Number(target?.x || 0),
                y: Number(target?.y || 0),
                radius: Number(target?.radius || 0),
                phase: Number(target?.phase || 0),
              }))
            : [],
          tankExplosions: Array.isArray(scene.tankExplosions)
            ? scene.tankExplosions.map((explosion) => ({
                id: Number(explosion?.id || 0),
                x: Number(explosion?.x || 0),
                y: Number(explosion?.y || 0),
                radius: Number(explosion?.radius || 20),
                color: normalizeText(explosion?.color) || "green",
                life: Number(explosion?.life || 0),
                maxLife: Math.max(0.0001, Number(explosion?.maxLife || 0.78)),
              }))
            : [],
          wallRipples: Array.isArray(scene.wallRipples)
            ? scene.wallRipples.map((ripple) => ({
                id: Number(ripple?.id || 0),
                x: Number(ripple?.x || 0),
                y: Number(ripple?.y || 0),
                color: normalizeText(ripple?.color) || "green",
                life: Number(ripple?.life || 0),
                maxLife: Math.max(0.0001, Number(ripple?.maxLife || 0.0001)),
                wall: sanitizeRect(ripple?.wall),
              }))
            : [],
          bulletFades: Array.isArray(scene.bulletFades)
            ? scene.bulletFades.map((fade) => ({
                id: Number(fade?.id || 0),
                x: Number(fade?.x || 0),
                y: Number(fade?.y || 0),
                radius: Number(fade?.radius || 0),
                life: Number(fade?.life || 0),
                maxLife: Math.max(0.0001, Number(fade?.maxLife || 0.0001)),
                color: normalizeText(fade?.color) || "green",
              }))
            : [],
        };
      }

      function sanitizePreviewState(raw) {
        return {
          active: Boolean(raw?.active),
          frame_seq: Number(raw?.frame_seq || 0),
          session_id: normalizeText(raw?.session_id),
          player_id: normalizeText(raw?.player_id),
          map_id: normalizeText(raw?.map_id),
          map_label: normalizeText(raw?.map_label),
          runtime_summary: normalizeText(raw?.runtime_summary),
          rows: Array.isArray(raw?.rows)
            ? raw.rows.slice(0, SCOREBOARD_LIMIT).map((row, index) => ({
                rank: Number(row?.rank || index + 1),
                player_id: normalizeText(row?.player_id) || "--",
                country_code: normalizeText(row?.country_code).toUpperCase(),
                score: Number(row?.score || 0),
                latency_ms: normalizeLatencyMs(row?.latency_ms),
                active: Boolean(row?.active),
              }))
            : [],
          scene: sanitizeScene(raw?.scene),
          updated_at_ms: Number(raw?.updated_at_ms || 0),
        };
      }

      function renderRows(rows) {
        scoreList.innerHTML = "";
        const normalizedRows = rows.length ? rows : Array.from({ length: SCOREBOARD_LIMIT }, (_, index) => ({
          rank: index + 1,
          player_id: "--",
          country_code: "",
          score: 0,
          latency_ms: 0,
          active: false,
        }));

        for (const row of normalizedRows) {
          const item = document.createElement("div");
          item.className = `score-row${row.active ? " active" : ""}`;

          const rank = document.createElement("div");
          rank.className = "score-rank";
          rank.textContent = String(row.rank).padStart(2, "0");

          const name = document.createElement("div");
          name.className = "score-name";

          const latency = document.createElement("span");
          latency.className = `score-latency ${latencyClassName(row.latency_ms)}`;
          latency.textContent = formatLatencyLabel(row.latency_ms);

          const country = document.createElement("span");
          country.className = "score-country";
          country.textContent = row.country_code || "--";

          const player = document.createElement("span");
          player.className = "score-player";
          player.textContent = row.player_id || "--";

          const value = document.createElement("div");
          value.className = "score-value";
          value.textContent = Number.isFinite(row.score) ? String(row.score) : "-";

          name.appendChild(latency);
          name.appendChild(country);
          name.appendChild(player);
          item.appendChild(rank);
          item.appendChild(name);
          item.appendChild(value);
          scoreList.appendChild(item);
        }
      }

      function formatAge(ageMs) {
        if (ageMs < 1000) {
          return `${Math.max(0, Math.round(ageMs))} ms`;
        }
        return `${(ageMs / 1000).toFixed(ageMs < 5000 ? 1 : 0)} s`;
      }

      function applyOverlayState() {
        const state = previewState;
        const ageMs = state.updated_at_ms ? Math.max(0, Date.now() - state.updated_at_ms) : 0;
        const stale = !state.active || !state.scene || ageMs > STALE_AFTER_MS;
        stageOverlay.hidden = !stale;

        if (lastFetchError) {
          overlayTitle.textContent = "Preview fetch failed";
          overlayNote.textContent = lastFetchError;
          return;
        }
        if (!state.active || !state.scene) {
          overlayTitle.textContent = "Waiting for desktop preview";
          overlayNote.textContent = "Start the latency session in the desktop console to publish live battle state.";
          return;
        }
        overlayTitle.textContent = "Preview paused";
        overlayNote.textContent = `Live state is stale (${formatAge(ageMs)} old). Keep the desktop session open to continue publishing.`;
      }

      function refreshMeta() {
        const state = previewState;
        const scene = state.scene;
        const theme = normalizeTheme(scene?.theme);
        document.documentElement.dataset.theme = theme;
        scoreSubtitle.textContent = state.active
          ? [state.player_id || "Pilot", scene?.mapTag || state.map_id || "MAP"].filter(Boolean).join(" · ")
          : "No active desktop session";
        scoreMap.textContent = state.map_label || "Waiting for published map state";
        scoreRuntime.textContent = state.runtime_summary || "No runtime summary yet";
        scoreMeta.textContent = `Frame #${state.frame_seq || 0}${state.session_id ? ` · ${state.session_id}` : ""}`;
        scoreAge.textContent = state.updated_at_ms
          ? `Last update ${formatAge(Math.max(0, Date.now() - state.updated_at_ms))} ago`
          : "Last update -";
        renderRows(state.rows || []);
        applyOverlayState();
      }

      function resizeCanvas() {
        const rect = stageWrap.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const width = Math.max(320, Math.round(rect.width * dpr));
        const height = Math.max(200, Math.round(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
      }

      function syncSmoothedEntities(scene, dt, frameSeq) {
        const tankIds = new Set();
        for (const tank of scene.tanks) {
          tankIds.add(tank.id);
          const current = smoothedTanks.get(tank.id);
          if (!current) {
            smoothedTanks.set(tank.id, { ...tank });
            continue;
          }
          const ease = clamp(dt * 13, 0.18, 0.78);
          current.x = lerp(current.x, tank.x, ease);
          current.y = lerp(current.y, tank.y, ease);
          current.angle = current.angle + shortestAngleDelta(current.angle, tank.angle) * ease;
          current.radius = tank.radius;
          current.flash = Math.max(tank.flash, current.flash * 0.9);
          current.color = tank.color;
          current.weapon = tank.weapon;
          current.shotgun_ammo = tank.shotgun_ammo;
          current.minigun_ammo = tank.minigun_ammo;
          current.weapon_reload_ms = tank.weapon_reload_ms;
        }
        for (const id of Array.from(smoothedTanks.keys())) {
          if (!tankIds.has(id)) {
            smoothedTanks.delete(id);
          }
        }

        const bulletIds = new Set();
        for (const bullet of scene.bullets) {
          const bulletKey = String(bullet.id);
          bulletIds.add(bulletKey);
          const current = smoothedBullets.get(bulletKey);
          if (!current) {
            smoothedBullets.set(bulletKey, {
              ...bullet,
              trailX: bullet.x,
              trailY: bullet.y,
              snapshotSeq: frameSeq,
            });
            continue;
          }
          current.trailX = current.x;
          current.trailY = current.y;
          current.radius = bullet.radius;
          current.color = bullet.color;
          current.projectile_type = bullet.projectile_type;
          current.path_segments = bullet.path_segments;
          current.distance_travelled = bullet.distance_travelled;
          current.segments = bullet.segments;
          current.vx = bullet.vx;
          current.vy = bullet.vy;
          if (current.snapshotSeq !== frameSeq) {
            const correctionDistance = Math.hypot(current.x - bullet.x, current.y - bullet.y);
            const ease = correctionDistance > 36 ? 1 : clamp(dt * 28, 0.68, 0.96);
            current.x = lerp(current.x, bullet.x, ease);
            current.y = lerp(current.y, bullet.y, ease);
            current.snapshotSeq = frameSeq;
          } else {
            current.x += current.vx * dt;
            current.y += current.vy * dt;
          }
        }
        for (const id of Array.from(smoothedBullets.keys())) {
          if (!bulletIds.has(id)) {
            smoothedBullets.delete(id);
          }
        }
      }

      function drawTank(context, tank, theme, elapsedMs) {
        const tankPalette = getPlayerPalette(tank.color, theme);
        const darkMode = theme === "dark";
        const wallTime = elapsedMs / 1000;
        const radius = Number(tank.radius || 20);
        const flash = Number(tank.flash || 0);
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
        const weapon = String(tank.weapon || "default");
        const reloadMs = Math.max(0, Number(tank.weapon_reload_ms || tank.weaponReloadMs || 0));
        const reloadKick = weapon === "shotgun" ? Math.sin(clamp(reloadMs / 1500, 0, 1) * Math.PI) : 0;
        const laserCharge = weapon === "laser" ? 0.55 + Math.sin(wallTime * 8) * 0.18 : 0;
        const minigunSpin = weapon === "minigun" ? wallTime * 26 : 0;

        context.save();
        context.translate(tank.x, tank.y);
        context.rotate(tank.angle + Math.PI / 2);

        context.save();
        context.shadowColor = tankPalette.glow;
        context.shadowBlur = 18;
        context.fillStyle = hexToRgba(tankPalette.base, darkMode ? 0.18 : 0.12);
        context.beginPath();
        context.arc(0, 0, radius + 9 + tankPulse * 2, 0, Math.PI * 2);
        context.fill();
        context.restore();

        context.save();
        context.fillStyle = tankSideFill;
        context.shadowColor = tankShadow;
        context.shadowBlur = 10;
        drawRoundedRectPath(context, -19, -16, 7, 32, 4);
        context.fill();
        drawRoundedRectPath(context, 12, -16, 7, 32, 4);
        context.fill();
        context.restore();

        context.save();
        const barrelGradient = context.createLinearGradient(0, -31, 0, -3);
        barrelGradient.addColorStop(0, tankShellTop);
        barrelGradient.addColorStop(1, tankShellBottom);
        const barrelWidth = weapon === "shotgun" ? 16.8 : weapon === "laser" ? 18 : weapon === "minigun" ? 19.5 : 10.4;
        const barrelLength = weapon === "shotgun" ? 27 : weapon === "laser" ? 24 : weapon === "minigun" ? 33 : 35;
        const barrelY = weapon === "shotgun" ? -31 + reloadKick * 3.5 : weapon === "laser" ? -31 : weapon === "minigun" ? -36 : -38;
        drawRoundedRectPath(context, -barrelWidth / 2, barrelY, barrelWidth, barrelLength, weapon === "shotgun" ? 7.2 : weapon === "laser" ? 9 : weapon === "minigun" ? 8.5 : 5.1);
        context.fillStyle = barrelGradient;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = tankFrameStroke;
        context.stroke();
        context.beginPath();
        context.moveTo(0, -34);
        context.lineTo(0, -8);
        context.lineWidth = 1.1;
        context.strokeStyle = tankCircuit;
        context.stroke();
        context.beginPath();
        context.arc(0, barrelY + (weapon === "shotgun" ? 1.5 : weapon === "laser" ? 3 : weapon === "minigun" ? 2.4 : 1), weapon === "shotgun" ? 7.4 : weapon === "laser" ? 9.2 : weapon === "minigun" ? 8.8 : 5.2, 0, Math.PI * 2);
        context.fillStyle = tankCoreGlow;
        context.fill();
        if (weapon === "shotgun") {
          context.beginPath();
          context.arc(-3.8, barrelY + 1.6, 2.2, 0, Math.PI * 2);
          context.arc(3.8, barrelY + 1.6, 2.2, 0, Math.PI * 2);
          context.fillStyle = darkMode ? "rgba(2, 6, 23, 0.82)" : "rgba(15, 23, 42, 0.46)";
          context.fill();
        } else if (weapon === "laser") {
          context.save();
          context.shadowColor = tankPalette.glow;
          context.shadowBlur = 15;
          context.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.7 : 0.52);
          context.lineWidth = 1.7;
          for (let index = 0; index < 3; index += 1) {
            const ringRadius = 5.2 + index * 3.2 + laserCharge * 1.1;
            context.beginPath();
            context.arc(0, barrelY + 3, ringRadius, -Math.PI * 0.74, Math.PI * 0.74);
            context.stroke();
          }
          context.beginPath();
          context.moveTo(0, barrelY - 7.5);
          context.lineTo(-5.8, barrelY + 4.5);
          context.lineTo(5.8, barrelY + 4.5);
          context.closePath();
          context.fillStyle = hexToRgba(tankPalette.bright, darkMode ? 0.72 : 0.5);
          context.fill();
          context.restore();
        } else if (weapon === "minigun") {
          context.save();
          context.shadowColor = tankPalette.glow;
          context.shadowBlur = 10;
          context.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.48 : 0.34);
          context.lineWidth = 2;
          for (let index = 0; index < 6; index += 1) {
            const angle = minigunSpin + (index / 6) * Math.PI * 2;
            const offset = Math.sin(angle) * 4.7;
            context.beginPath();
            context.moveTo(offset, barrelY + 3);
            context.lineTo(offset * 0.42, -8);
            context.stroke();
          }
          context.beginPath();
          context.arc(0, barrelY + 2.4, 6.2 + Math.sin(minigunSpin) * 0.5, 0, Math.PI * 2);
          context.fillStyle = darkMode ? "rgba(2, 6, 23, 0.78)" : "rgba(15, 23, 42, 0.38)";
          context.fill();
          context.restore();
        }
        context.beginPath();
        context.moveTo(-8.5, -23);
        context.lineTo(-11.5, -10);
        context.lineTo(-8, 1);
        context.lineTo(8, 1);
        context.lineTo(11.5, -10);
        context.lineTo(8.5, -23);
        context.closePath();
        context.fillStyle = barrelGradient;
        context.shadowColor = tankNoseGlow;
        context.shadowBlur = 7;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.4 : 0.32);
        context.stroke();
        context.beginPath();
        context.moveTo(0, -20);
        context.lineTo(-9, -7.5);
        context.lineTo(9, -7.5);
        context.closePath();
        const noseGradient = context.createLinearGradient(0, -20, 0, -7.5);
        noseGradient.addColorStop(0, tankGlassTop);
        noseGradient.addColorStop(1, tankGlassBottom);
        context.fillStyle = noseGradient;
        context.shadowColor = tankNoseGlow;
        context.shadowBlur = 9;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.44 : 0.34);
        context.stroke();
        context.restore();

        context.save();
        const hullGradient = context.createLinearGradient(0, -18, 0, 18);
        hullGradient.addColorStop(0, tankShellTop);
        hullGradient.addColorStop(1, tankShellBottom);
        drawRoundedRectPath(context, -16, -18, 32, 36, 11);
        context.fillStyle = hullGradient;
        context.shadowColor = tankShadow;
        context.shadowBlur = 12;
        context.fill();
        context.lineWidth = 1.2;
        context.strokeStyle = tankFrameStroke;
        context.stroke();

        context.save();
        drawRoundedRectPath(context, -16, -18, 32, 36, 11);
        context.clip();
        const scanGradient = context.createLinearGradient(tankScanOffset, 0, tankScanOffset + 18, 0);
        scanGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        scanGradient.addColorStop(0.5, tankScan);
        scanGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        context.fillStyle = scanGradient;
        context.fillRect(-18 + tankScanOffset, -20, 18, 40);
        context.restore();

        context.beginPath();
        context.moveTo(-10, -2);
        context.lineTo(10, -2);
        context.moveTo(-8, 7);
        context.lineTo(8, 7);
        context.lineWidth = 1.1;
        context.strokeStyle = tankPanelStroke;
        context.stroke();

        context.beginPath();
        context.moveTo(-6, -6.5);
        context.lineTo(0, -14.5);
        context.lineTo(6, -6.5);
        context.lineWidth = 1.4;
        context.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.52 : 0.38);
        context.stroke();

        context.beginPath();
        context.setLineDash([7, 5]);
        context.moveTo(-11, 12);
        context.lineTo(11, 12);
        context.lineWidth = 0.95;
        context.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.22 : 0.2);
        context.stroke();
        context.setLineDash([]);

        const canopyGradient = context.createLinearGradient(0, -12, 0, 6);
        canopyGradient.addColorStop(0, tankGlassTop);
        canopyGradient.addColorStop(1, tankGlassBottom);
        drawRoundedRectPath(context, -9.5, -11.5, 19, 17, 7);
        context.fillStyle = canopyGradient;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.36 : 0.3);
        context.stroke();

        context.beginPath();
        context.moveTo(-8, 9.5);
        context.lineTo(8, 9.5);
        context.moveTo(-9, 14.8);
        context.lineTo(9, 14.8);
        context.lineWidth = 1;
        context.strokeStyle = hexToRgba(tankPalette.bright, darkMode ? 0.24 : 0.2);
        context.stroke();

        context.save();
        drawRoundedRectPath(context, -11, 8.8, 22, 10.5, 4.8);
        context.fillStyle = darkMode ? "rgba(6, 12, 24, 0.78)" : "rgba(219, 234, 254, 0.82)";
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = hexToRgba(tankPalette.base, darkMode ? 0.26 : 0.18);
        context.stroke();
        context.restore();

        context.fillStyle = tankRearGlow;
        context.shadowColor = tankPalette.glow;
        context.shadowBlur = 12;
        for (const exhaustX of [-5, 5]) {
          context.beginPath();
          context.arc(exhaustX, 13.5, 3.1 + tankPulse * 0.35, 0, Math.PI * 2);
          context.fill();
        }

        context.beginPath();
        for (const nodeX of [-10.5, 0, 10.5]) {
          context.moveTo(nodeX, -15);
          context.arc(nodeX, -15, 1.7 + tankPulse * 0.4, 0, Math.PI * 2);
        }
        context.fillStyle = tankPalette.bright;
        context.shadowBlur = 6;
        context.fill();
        context.restore();

        if (flash > 0) {
          context.fillStyle = tankPalette.flash.replace(/, ([0-9.]+)\)$/, `, ${clamp(flash * 5.8, 0, 0.95)})`);
          context.beginPath();
          context.arc(0, -(radius + 18), 8 + flash * 24, 0, Math.PI * 2);
          context.fill();
        }

        context.restore();
      }

      function drawWalls(context, walls, theme, elapsedMs) {
        const darkMode = theme === "dark";
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
        const wallTime = elapsedMs / 1000;

        for (const wall of walls) {
          const horizontal = wall.w >= wall.h;
          const wallMidX = wall.x + wall.w / 2;
          const wallMidY = wall.y + wall.h / 2;
          const pulse = 0.58 + 0.42 * Math.sin(wallTime * 2.1 + wall.x * 0.018 + wall.y * 0.023);
          const scanLength = horizontal ? wall.w + 40 : wall.h + 40;
          const scanOffset = ((wallTime * 74 + wall.x * 0.62 + wall.y * 0.37) % scanLength) - 20;

          context.save();
          drawRoundedRectPath(context, wall.x, wall.y, wall.w, wall.h, 12);
          const wallGradient = context.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
          wallGradient.addColorStop(0, wallFill[0]);
          wallGradient.addColorStop(1, wallFill[1]);
          context.fillStyle = wallGradient;
          context.shadowColor = wallEdgeGlow;
          context.shadowBlur = darkMode ? 14 : 11;
          context.fill();
          context.lineWidth = 1.2;
          context.strokeStyle = wallStroke;
          context.stroke();

          context.save();
          drawRoundedRectPath(context, wall.x, wall.y, wall.w, wall.h, 12);
          context.clip();
          const sheenGradient = horizontal
            ? context.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h)
            : context.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y);
          sheenGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
          sheenGradient.addColorStop(0.5, wallSheen);
          sheenGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          context.globalAlpha = darkMode ? 0.72 : 0.82;
          context.fillStyle = sheenGradient;
          context.fillRect(wall.x, wall.y, wall.w, wall.h);

          const scanGradient = horizontal
            ? context.createLinearGradient(wall.x + scanOffset, wall.y, wall.x + scanOffset + 22, wall.y)
            : context.createLinearGradient(wall.x, wall.y + scanOffset, wall.x, wall.y + scanOffset + 22);
          scanGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
          scanGradient.addColorStop(0.5, wallScan);
          scanGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          context.globalAlpha = 0.62 + pulse * 0.24;
          context.fillStyle = scanGradient;
          if (horizontal) {
            context.fillRect(wall.x + scanOffset, wall.y + 2, 22, Math.max(1, wall.h - 4));
          } else {
            context.fillRect(wall.x + 2, wall.y + scanOffset, Math.max(1, wall.w - 4), 22);
          }
          context.restore();

          context.beginPath();
          if (horizontal) {
            context.moveTo(wall.x + 10, wall.y + wall.h / 2);
            context.lineTo(wall.x + wall.w - 10, wall.y + wall.h / 2);
          } else {
            context.moveTo(wall.x + wall.w / 2, wall.y + 10);
            context.lineTo(wall.x + wall.w / 2, wall.y + wall.h - 10);
          }
          context.lineWidth = darkMode ? 2.4 : 2.1;
          context.strokeStyle = wallCore;
          context.stroke();

          context.beginPath();
          context.setLineDash(horizontal ? [12, 8] : [10, 8]);
          if (horizontal) {
            context.moveTo(wall.x + 15, wallMidY - 4);
            context.lineTo(wall.x + wall.w - 15, wallMidY - 4);
            context.moveTo(wall.x + 15, wallMidY + 4);
            context.lineTo(wall.x + wall.w - 15, wallMidY + 4);
          } else {
            context.moveTo(wallMidX - 4, wall.y + 15);
            context.lineTo(wallMidX - 4, wall.y + wall.h - 15);
            context.moveTo(wallMidX + 4, wall.y + 15);
            context.lineTo(wallMidX + 4, wall.y + wall.h - 15);
          }
          context.lineWidth = 1;
          context.strokeStyle = hexToRgba(wallNode, darkMode ? 0.16 + pulse * 0.12 : 0.12 + pulse * 0.1);
          context.stroke();
          context.setLineDash([]);

          context.beginPath();
          if (horizontal) {
            context.moveTo(wall.x + 8, wall.y + 4);
            context.lineTo(wall.x + 24, wall.y + 4);
            context.moveTo(wall.x + 8, wall.y + wall.h - 4);
            context.lineTo(wall.x + 24, wall.y + wall.h - 4);
            context.moveTo(wall.x + wall.w - 8, wall.y + 4);
            context.lineTo(wall.x + wall.w - 24, wall.y + 4);
            context.moveTo(wall.x + wall.w - 8, wall.y + wall.h - 4);
            context.lineTo(wall.x + wall.w - 24, wall.y + wall.h - 4);
          } else {
            context.moveTo(wall.x + 4, wall.y + 8);
            context.lineTo(wall.x + 4, wall.y + 24);
            context.moveTo(wall.x + wall.w - 4, wall.y + 8);
            context.lineTo(wall.x + wall.w - 4, wall.y + 24);
            context.moveTo(wall.x + 4, wall.y + wall.h - 8);
            context.lineTo(wall.x + 4, wall.y + wall.h - 24);
            context.moveTo(wall.x + wall.w - 4, wall.y + wall.h - 8);
            context.lineTo(wall.x + wall.w - 4, wall.y + wall.h - 24);
          }
          context.lineWidth = 1.1;
          context.strokeStyle = wallBracket;
          context.stroke();

          context.save();
          context.shadowColor = wallNode;
          context.shadowBlur = darkMode ? 10 : 8;
          context.fillStyle = wallNode;
          if (horizontal) {
            for (const nodeX of [wall.x + 16, wallMidX, wall.x + wall.w - 16]) {
              context.beginPath();
              context.arc(nodeX, wallMidY, 2.2 + pulse * 0.8, 0, Math.PI * 2);
              context.fill();
            }
          } else {
            for (const nodeY of [wall.y + 16, wallMidY, wall.y + wall.h - 16]) {
              context.beginPath();
              context.arc(wallMidX, nodeY, 2.2 + pulse * 0.8, 0, Math.PI * 2);
              context.fill();
            }
          }
          context.restore();
          context.restore();
        }
      }

      function drawStage(now, dt) {
        resizeCanvas();
        const width = canvas.width;
        const height = canvas.height;
        const scene = previewState.scene;
        const theme = normalizeTheme(scene?.theme);
        const palette = getWorldPalette(theme);

        const backdropGradient = ctx.createLinearGradient(0, 0, 0, height);
        backdropGradient.addColorStop(0, palette.backdropTop);
        backdropGradient.addColorStop(1, palette.backdropBottom);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = backdropGradient;
        ctx.fillRect(0, 0, width, height);

        if (!scene) {
          return;
        }

        syncSmoothedEntities(scene, dt, previewState.frame_seq || 0);

        const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
        const offsetX = (width - WORLD_WIDTH * scale) / 2;
        const offsetY = (height - WORLD_HEIGHT * scale) / 2;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        ctx.save();
        ctx.shadowColor = theme === "dark" ? "rgba(0, 0, 0, 0.36)" : "rgba(37, 99, 235, 0.12)";
        ctx.shadowBlur = 22;
        drawRoundedRectPath(ctx, 8, 8, WORLD_WIDTH - 16, WORLD_HEIGHT - 16, 32);
        ctx.fillStyle = palette.arenaFill;
        ctx.fill();
        ctx.restore();

        ctx.lineWidth = 2;
        ctx.strokeStyle = palette.arenaStroke;
        drawRoundedRectPath(ctx, 8, 8, WORLD_WIDTH - 16, WORLD_HEIGHT - 16, 32);
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        drawRoundedRectPath(ctx, 16, 16, WORLD_WIDTH - 32, WORLD_HEIGHT - 32, 28);
        ctx.clip();

        ctx.strokeStyle = palette.grid;
        ctx.lineWidth = 1;
        for (let x = 52; x < WORLD_WIDTH; x += 52) {
          ctx.beginPath();
          ctx.moveTo(x, 24);
          ctx.lineTo(x, WORLD_HEIGHT - 24);
          ctx.stroke();
        }
        for (let y = 52; y < WORLD_HEIGHT; y += 52) {
          ctx.beginPath();
          ctx.moveTo(24, y);
          ctx.lineTo(WORLD_WIDTH - 24, y);
          ctx.stroke();
        }

        const scanY = (scene.elapsedMs * 0.12) % (WORLD_HEIGHT + 180) - 90;
        const scanGradient = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
        scanGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        scanGradient.addColorStop(0.5, palette.scan);
        scanGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = scanGradient;
        ctx.fillRect(0, scanY - 60, WORLD_WIDTH, 120);

        drawWalls(ctx, scene.walls, theme, scene.elapsedMs);

        for (const ripple of scene.wallRipples) {
          const rippleAlpha = clamp(ripple.life / ripple.maxLife, 0, 1);
          const ripplePalette = getPlayerPalette(ripple.color, theme);
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, 14 + (1 - rippleAlpha) * 32, 0, Math.PI * 2);
          ctx.lineWidth = 3;
          ctx.strokeStyle = hexToRgba(ripplePalette.bright, rippleAlpha * 0.72);
          ctx.stroke();
        }

        for (const target of scene.targets) {
          const pulse = 0.55 + 0.45 * Math.sin(scene.elapsedMs * 0.0024 + target.phase);
          ctx.save();
          ctx.shadowColor = palette.targetGlow;
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(target.x, target.y, target.radius + 6 + pulse * 2, 0, Math.PI * 2);
          ctx.fillStyle = palette.targetGlow;
          ctx.fill();
          ctx.restore();

          ctx.beginPath();
          ctx.arc(target.x, target.y, target.radius + pulse * 2, 0, Math.PI * 2);
          ctx.fillStyle = palette.targetCore;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = palette.targetRing;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(target.x, target.y, Math.max(3, target.radius * 0.34), 0, Math.PI * 2);
          ctx.fillStyle = theme === "dark" ? "rgba(8, 18, 34, 0.9)" : "rgba(59, 130, 246, 0.16)";
          ctx.fill();
        }

        for (const fade of scene.bulletFades) {
          const fadeAlpha = clamp(fade.life / fade.maxLife, 0, 1);
          const fadePalette = getPlayerPalette(fade.color, theme);
          const radius = fade.radius + (1 - fadeAlpha) * 10;
          const fadeGradient = ctx.createRadialGradient(fade.x, fade.y, 0, fade.x, fade.y, radius);
          fadeGradient.addColorStop(0, hexToRgba(fadePalette.bright, fadeAlpha * 0.8));
          fadeGradient.addColorStop(1, hexToRgba(fadePalette.base, 0));
          ctx.fillStyle = fadeGradient;
          ctx.beginPath();
          ctx.arc(fade.x, fade.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        for (const bullet of smoothedBullets.values()) {
          const bulletPalette = getPlayerPalette(bullet.color, theme);
          const projectileType = String(bullet.projectile_type || "bullet");
          if (projectileType === "laser" && Array.isArray(bullet.segments) && bullet.segments.length) {
            ctx.save();
            ctx.lineCap = "round";
            ctx.shadowColor = bulletPalette.glow;
            ctx.shadowBlur = theme === "dark" ? 22 : 16;
            ctx.strokeStyle = hexToRgba(bulletPalette.base, theme === "dark" ? 0.36 : 0.24);
            ctx.lineWidth = 14;
            for (const segment of bullet.segments) {
              ctx.beginPath();
              ctx.moveTo(segment.x1, segment.y1);
              ctx.lineTo(segment.x2, segment.y2);
              ctx.stroke();
            }
            ctx.strokeStyle = bulletPalette.bright;
            ctx.lineWidth = Math.max(3.2, bullet.radius * 1.1);
            for (const segment of bullet.segments) {
              ctx.beginPath();
              ctx.moveTo(segment.x1, segment.y1);
              ctx.lineTo(segment.x2, segment.y2);
              ctx.stroke();
            }
            ctx.restore();
            continue;
          }
          const trailDx = bullet.x - (bullet.trailX ?? bullet.x);
          const trailDy = bullet.y - (bullet.trailY ?? bullet.y);
          const trailLength = Math.hypot(trailDx, trailDy);
          if (trailLength > 0.5) {
            ctx.save();
            ctx.lineCap = "round";
            ctx.lineWidth = Math.max(2.2, bullet.radius * 1.18);
            ctx.strokeStyle = hexToRgba(bulletPalette.bright, theme === "dark" ? 0.42 : 0.28);
            ctx.beginPath();
            ctx.moveTo(bullet.trailX ?? bullet.x, bullet.trailY ?? bullet.y);
            ctx.lineTo(bullet.x, bullet.y);
            ctx.stroke();
            ctx.restore();
          }
          ctx.save();
          ctx.shadowColor = bulletPalette.glow;
          ctx.shadowBlur = projectileType === "minigun" ? 10 : 14;
          ctx.fillStyle = bulletPalette.bright;
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.radius + 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        drawTankExplosions(ctx, scene.tankExplosions || [], theme);

        for (const tank of smoothedTanks.values()) {
          drawTank(ctx, tank, theme, now);
        }

        ctx.restore();
        ctx.restore();
      }

      async function pollPreviewState() {
        try {
          const response = await fetch(`${PREVIEW_STATE_URL}?ts=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-store" },
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          previewState = sanitizePreviewState(await response.json());
          lastFetchError = "";
        } catch (error) {
          lastFetchError = error instanceof Error ? error.message : "Unknown fetch error";
        }

        refreshMeta();
        if (!destroyed) {
          window.setTimeout(pollPreviewState, POLL_INTERVAL_MS);
        }
      }

      function renderLoop(now) {
        const dt = Math.min(0.05, Math.max(0.001, (now - lastRenderAt) / 1000));
        lastRenderAt = now;
        drawStage(now, dt);
        if (!destroyed) {
          window.requestAnimationFrame(renderLoop);
        }
      }

      const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeCanvas) : null;
      if (resizeObserver) {
        resizeObserver.observe(stageWrap);
      } else {
        window.addEventListener("resize", resizeCanvas);
      }

      window.addEventListener("beforeunload", () => {
        destroyed = true;
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      });

      resizeCanvas();
      refreshMeta();
      void pollPreviewState();
      window.requestAnimationFrame(renderLoop);
    </script>
  </body>
</html>
"""
