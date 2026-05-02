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

      :root[data-theme="light"] {
        color-scheme: light;
        --page-bg: #eef6ff;
        --panel-bg: rgba(255, 255, 255, 0.86);
        --panel-border: rgba(14, 165, 233, 0.18);
        --panel-shadow: rgba(37, 99, 235, 0.16);
        --text: #0f172a;
        --muted: #5b6f86;
        --accent: #0284c7;
        --accent-soft: rgba(14, 165, 233, 0.12);
        --row-bg: rgba(240, 247, 255, 0.92);
        --row-active: rgba(191, 219, 254, 0.92);
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

      function normalizeTheme(value) {
        return String(value || "").trim().toLowerCase() === "light" ? "light" : "dark";
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

      function sanitizeRect(value) {
        return {
          x: Number(value?.x || 0),
          y: Number(value?.y || 0),
          w: Number(value?.w || 0),
          h: Number(value?.h || 0),
        };
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
                x: Number(bullet?.x || 0),
                y: Number(bullet?.y || 0),
                radius: Number(bullet?.radius || 0),
                vx: Number(bullet?.vx || 0),
                vy: Number(bullet?.vy || 0),
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

          const country = document.createElement("span");
          country.className = "score-country";
          country.textContent = row.country_code || "--";

          const player = document.createElement("span");
          player.className = "score-player";
          player.textContent = row.player_id || "--";

          const value = document.createElement("div");
          value.className = "score-value";
          value.textContent = Number.isFinite(row.score) ? String(row.score) : "-";

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
        const palette = getPlayerPalette(tank.color, theme);
        const pulse = 0.5 + 0.5 * Math.sin(elapsedMs * 0.003 + tank.x * 0.014 + tank.y * 0.009);
        const shellTop = theme === "dark" ? "rgba(8, 18, 34, 0.98)" : "rgba(250, 253, 255, 0.99)";
        const shellBottom = theme === "dark" ? "rgba(17, 47, 80, 0.98)" : "rgba(204, 229, 255, 0.98)";
        const trackFill = theme === "dark" ? "rgba(10, 26, 48, 0.98)" : "rgba(226, 237, 255, 0.98)";
        const frameStroke = theme === "dark" ? "rgba(186, 230, 253, 0.34)" : "rgba(37, 99, 235, 0.28)";

        context.save();
        context.translate(tank.x, tank.y);
        context.rotate(tank.angle + Math.PI / 2);

        context.save();
        context.shadowColor = palette.glow;
        context.shadowBlur = 18;
        context.fillStyle = hexToRgba(palette.base, theme === "dark" ? 0.18 : 0.12);
        context.beginPath();
        context.arc(0, 0, tank.radius + 10 + pulse * 2, 0, Math.PI * 2);
        context.fill();
        context.restore();

        context.fillStyle = trackFill;
        drawRoundedRectPath(context, -20, -17, 8, 34, 4);
        context.fill();
        drawRoundedRectPath(context, 12, -17, 8, 34, 4);
        context.fill();

        const barrelGradient = context.createLinearGradient(0, -40, 0, -5);
        barrelGradient.addColorStop(0, shellTop);
        barrelGradient.addColorStop(1, shellBottom);
        drawRoundedRectPath(context, -5.5, -39, 11, 36, 5.4);
        context.fillStyle = barrelGradient;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = frameStroke;
        context.stroke();

        context.beginPath();
        context.moveTo(-9.5, -22);
        context.lineTo(-12.5, -8);
        context.lineTo(-8.5, 2);
        context.lineTo(8.5, 2);
        context.lineTo(12.5, -8);
        context.lineTo(9.5, -22);
        context.closePath();
        context.fillStyle = barrelGradient;
        context.shadowColor = palette.glow;
        context.shadowBlur = 8;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = hexToRgba(palette.bright, theme === "dark" ? 0.42 : 0.34);
        context.stroke();

        const bodyGradient = context.createLinearGradient(-22, -22, 22, 22);
        bodyGradient.addColorStop(0, shellTop);
        bodyGradient.addColorStop(1, shellBottom);
        drawRoundedRectPath(context, -22, -20, 44, 40, 14);
        context.fillStyle = bodyGradient;
        context.shadowBlur = 0;
        context.fill();
        context.lineWidth = 1.2;
        context.strokeStyle = frameStroke;
        context.stroke();

        context.beginPath();
        context.arc(0, -1, 12.5, 0, Math.PI * 2);
        const coreGradient = context.createRadialGradient(0, -4, 2, 0, 0, 18);
        coreGradient.addColorStop(0, theme === "dark" ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 1)");
        coreGradient.addColorStop(1, hexToRgba(palette.base, theme === "dark" ? 0.7 : 0.54));
        context.fillStyle = coreGradient;
        context.fill();
        context.strokeStyle = hexToRgba(palette.bright, theme === "dark" ? 0.46 : 0.3);
        context.stroke();

        context.beginPath();
        context.moveTo(0, -24);
        context.lineTo(-7.5, -11);
        context.lineTo(7.5, -11);
        context.closePath();
        context.fillStyle = hexToRgba(palette.bright, theme === "dark" ? 0.82 : 0.68);
        context.fill();

        if (tank.flash > 0.001) {
          context.fillStyle = hexToRgba(palette.bright, clamp(tank.flash * 1.6, 0, 0.8));
          context.beginPath();
          context.arc(0, -37, 7 + pulse * 2, 0, Math.PI * 2);
          context.fill();
        }

        context.restore();
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

        for (const wall of scene.walls) {
          const wallGradient = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
          wallGradient.addColorStop(0, palette.wallInner);
          wallGradient.addColorStop(1, palette.wallFill);
          drawRoundedRectPath(ctx, wall.x, wall.y, wall.w, wall.h, Math.min(8, Math.min(wall.w, wall.h) / 2));
          ctx.fillStyle = wallGradient;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = palette.wallStroke;
          ctx.stroke();
        }

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
          ctx.shadowBlur = 14;
          ctx.fillStyle = bulletPalette.bright;
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.radius + 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

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
