# Cloud Service Console Agent Handoff Master Index

Last updated: 2026-05-05

This document is the master handoff index for the desktop mini app in `E:\Desktop\123\cloud-service-console`.

The app is split into four ownership lanes so multiple agents can work safely:

- Video Link Agent: video ingest, cloud video services, preview window, video health, go2rtc-related cloud deployment.
- Control Signal Agent: browser-to-robot control signaling, WebRTC DataChannel broker, local control monitor keyboard.
- Tank Trouble Agent: the bundled game, game cloud room service, game monitor pages, game assets, game one-click setup.
- UI Design Agent: global app shell, visual language, layout, interaction effects, theme consistency.

All agents must update their own lane document after each functional change. If a change crosses lanes, update every affected lane document and this master index.

## 1. Repository Index

Primary mini app repository:

- `E:\Desktop\123\cloud-service-console`

Desktop app build stack:

- Frontend: `frontend` using React + Vite.
- Local backend: `backend` using FastAPI.
- Desktop shell: `src-tauri` using Tauri.
- Cloud deploy bundle: `backend\cloud_setup_bundle`.
- Output installer target: `E:\Cloud-Service-Console`.

Current known external reference projects:

- Old local bridge/web frontend history: `E:\Desktop\123\telegrip-webrtc-bridgev0.2`
- go2rtc sender/reference project: `E:\Desktop\123\go2rtc_win64`
- Newer received go2rtc variants: `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc_win64`
- Latest control frontend reference mentioned by user: `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\telebot`
- Independent control receiver reference mentioned by user: `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\receive_control_stream(6).py`
- Old standalone Tank Trouble source reference: `C:\Users\SECANT\Documents\Codex\2026-05-02\flash\tank_trouble`

Important rule: external projects are references only unless the user explicitly asks to modify them.

## 2. Per-Agent Documents

- Video Link Agent: `docs\VIDEO_LINK_AGENT.md`
- Control Signal Agent: `docs\CONTROL_SIGNAL_AGENT.md`
- Tank Trouble Agent: `docs\TANK_TROUBLE_AGENT.md`
- UI Design Agent: `docs\UI_DESIGN_AGENT.md`

Existing guard document:

- Control full setup guard: `docs\CONTROL_SIGNAL_FULL_SETUP_GUARD.md`

Global implementation history:

- `frontend\IMPLEMENTATION_LOG.md`
- `frontend\README.md`

## 3. Shared Backend API Index

Local backend base:

- Runtime API base is resolved in `frontend\src\api\cloudApi.ts`.
- Tauri uses `get_backend_base_url`.
- Browser/dev fallback is `http://127.0.0.1:8765`.

Common session/config APIs:

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/status`
- `GET /api/status/live`
- `POST /api/refresh`
- `GET /api/network-snapshot`
- `POST /api/network-snapshot/refresh`
- `GET /api/logs`

Cloud service management APIs:

- `POST /api/services/start-all`
- `POST /api/services/stop-all`
- `POST /api/services/{service_name}/start`
- `POST /api/services/{service_name}/stop`
- `POST /api/ports/check-all`
- `POST /api/ports/{port_key}/check`
- `GET /api/local-setup/check`
- `POST /api/local-setup/run`

Video APIs:

- `GET /api/video-preview.mp4`
- `POST /api/ingest-mode/switch`

Control signal APIs:

- `GET /api/control-monitor/config`
- `GET /api/control-monitor/offer?session=robot-control`
- `POST /api/control-monitor/answer?session=robot-control&offer_id=...`

Tank Trouble APIs:

- `GET /api/games/tank-trouble/setup/check`
- `POST /api/games/tank-trouble/setup/run`
- `POST /api/games/tank-trouble/room/status`
- `POST /api/games/tank-trouble/room/sync`
- `POST /api/games/tank-trouble/room/vote-toggle`
- `POST /api/games/tank-trouble/room/leave`
- `POST /api/games/tank-trouble/match/sync`
- `POST /api/games/tank-trouble/match/leave`
- `WS /api/games/tank-trouble/match/ws`
- `POST /api/games/tank-trouble/latency/sync`
- `POST /api/games/tank-trouble/latency/leave`
- `WS /api/games/tank-trouble/latency/ws`
- `POST /api/games/tank-trouble/preview/push`
- `POST /api/games/tank-trouble/preview/clear`
- `GET /api/games/tank-trouble/preview/state`
- `GET /tank-trouble/preview`
- `GET /api/games/tank-trouble/spectator/page-url?room=tank-trouble-main`

## 4. Cloud Service Index

Default cloud connection fields:

- Public scheme: `http`
- Public API port: `18081`
- SSH port: `22`
- SSH user: `ubuntu`
- Default host: blank in login UI; user enters the server IP.

Core managed systemd services:

- `nginx`: public HTTP gateway on `18081`.
- `go2rtc-cloud`: go2rtc video pages and WebRTC signaling.
- `go2rtc-srt-bridge`: video ingest listener and RTSP republisher. UI title is `Ingest Bridge`.
- `go2rtc-control-signaling`: browser and robot WebRTC control broker.

Tank Trouble separately managed systemd service:

- `cloud-service-console-tank-trouble`: game room service and cloud spectator page on internal `18086`, proxied under `/tank-trouble/`.

Known ports:

- `22/tcp`: SSH.
- `18081/tcp`: public HTTP entry.
- `18082/tcp`: internal go2rtc API.
- `18083/tcp`: telemetry relay.
- `18084/tcp`: HTTP ingest.
- `18085/tcp`: control signaling internal port.
- `18086/tcp`: Tank Trouble game room service.
- `19090/udp,tcp`: go2rtc WebRTC.
- `19091/udp`: SRT ingest.
- `8554/tcp`: RTSP republish.
- `3478/udp,tcp`: TURN/STUN for control WebRTC. This is not part of the four managed systemd services in `config.py`, but control clients may depend on it.

## 5. Cross-Lane Safety Rules

- Video Link Agent must not modify Tank Trouble files or control signaling logic.
- Control Signal Agent must not modify go2rtc video ingest/playback or Tank Trouble game logic.
- Tank Trouble Agent must not modify go2rtc video ingest/playback or mechanical-arm/control-signal services.
- UI Design Agent may edit shared UI components/styles, but must not change business behavior or cloud scripts unless paired with the relevant lane agent.
- Do not change `backend\cloud_setup_bundle\config\sender-cloud.config.json` defaults casually; this affects cloud deployment behavior.
- Do not run destructive commands such as `git reset --hard` or overwrite user changes.
- When a cloud change is required, change only the lane-owned cloud files/services.

## 6. Required Update Workflow

Before editing:

- Read this master index.
- Read the lane-specific document.
- Check `git status --short`.

After editing:

- Update the lane-specific document with what changed.
- Update `frontend\IMPLEMENTATION_LOG.md` with scope, files, validation, and cloud deployment notes.
- If the change affects shared architecture, update this master index.
- Run the minimal relevant validation. Typical commands:

```powershell
python -m py_compile backend\main.py backend\models.py
cmd /c npm --prefix frontend run build
cmd /c npm run tauri:build
```

For Tank Trouble cloud spectator changes, also run:

```powershell
python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\tank_trouble_cloud.py
node --check build-logs\spectator-page-check.js
```

If a new exe is requested:

- Version must be bumped.
- Installer should be copied to `E:\Cloud-Service-Console`.

## 7. Current UI Contract For All Agents

All new UI must match the latest console style:

- Rounded cards and panels.
- Light and dark theme support.
- Indicator lamps instead of verbose state badges where practical.
- Smooth hover/press states.
- No text selection cursor on non-input text.
- Scrollable content areas with a stable top header.
- No harsh white boxes or abrupt overlays.
- Buttons should not wrap text.
- Chinese UI copy should be concise and project-specific.

Use `docs\UI_DESIGN_AGENT.md` for the full style contract.
