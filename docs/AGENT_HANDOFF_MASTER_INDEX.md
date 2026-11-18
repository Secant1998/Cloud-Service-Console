# Cloud Service Console Agent Handoff Master Index

Last updated: 2026-11-18

This document is the master handoff index for the desktop mini app in `E:\Desktop\123\cloud-service-console`.

## Current Development Handoff (2026-11-18)

The current source snapshot includes the authenticated model library, articulated
model previews, capture/replay services and the existing console/control UI work.
Topic contracts live in `docs/MODEL_LIBRARY.md`, `docs/PARTNET_PREPROCESSING.md`,
`docs/CAPTURE_TASK_REPLAY.md` and `docs/SHARED_AGENT_STATUS.md`. Older dated sections
below remain historical context; their counts and deployment times are not current
inventory claims.

RoboCasa v0.2 completion is active on the server: 60 new standalone fixture models,
22 articulated models, 76 movable joints and 8 models with named button contact
regions. Existing 5,971 rows were retained; the server index now has 6,031 rows.
Definitions are pinned to `756598a5be52e052339bb2d957426e39015c2afb`. Source resources,
portable MJCF/URDF exports, parameters and provenance live under
`/opt/telebot-model-library/catalog/.imports/robocasa-v02-756598a5be52-completion/`.
The 15 component templates require composition; 22 registry YAMLs are archived.
Do not advertise templates as standalone models or v0.2 coverage as RoboCasa365.

The paired simulator repository is `Secant1998/mujoco-teleop-sim`, checked out at
`E:\Desktop\123\code_1015`. Its `shared/assets/catalog/index.json` has 6,034 rows:
the 6,031 server entries plus three local-only Meta-World fixtures. It owns native
physics materialization and the multi-axis compatibility changes. The console owns
server import/activation, manifests and preview graphs. Native MJCF remains the
physics source; virtual URDF frames represent multiple joints without adding
physical bodies. Button contact geometry explicitly has no device-state runtime
adapter yet (`native_trigger_runtime: false`).

All 60 imports compiled and their joint probes/manifests passed. Five representative
models downloaded and loaded in the simulator. Web slider movement was observed
for sink and stove joints, but the full browser suite did not pass: page waits,
page closure and small-knob drag targeting remain recorded limitations. No complete
Piper task success is inferred from these import checks.

Publish source, tests, documentation and catalog metadata to Git. Bulk assets,
credentials, databases, caches, build products and disposable `reports/` stay out
of Git. Human trial data belongs to the simulator's ignored `user_studies/trials/`.
Server operational receipts remain under
`/opt/telebot-model-library/_imports/robocasa-v02-completion/`; local diagnostic
paths in topic documents are optional evidence, not checkout dependencies.
This update is a source snapshot; the desktop package version remains 0.3.68.

2026-11-05 cross-lane contract: model-library view nodes optionally retain native
`mass` / `center_of_mass` for marker positioning; view responses now add URDF `joints`
(axis/limits/mimic/disabled reason). ModelViewport uses this for selectable,
highlighted joint manipulation. The model-library route remains GET-only; see
`docs/MODEL_LIBRARY.md` and `docs/UI_DESIGN_AGENT.md` for the full contract.

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
- Current local package version: `0.3.68`.
- Current local installer: `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Latest known Git tag: `v0.3.68`.

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
- Control signal API usage handoff for frontend/robot teammates: `docs\CONTROL_SIGNAL_API_USAGE.md`

Global implementation history:

- `frontend\IMPLEMENTATION_LOG.md`
- `frontend\README.md`
- Shared four-agent status log: `docs\SHARED_AGENT_STATUS.md`

## 3. Shared Backend API Index

Local backend base:

- Runtime API base is resolved in `frontend\src\api\cloudApi.ts`.
- Tauri uses `get_backend_base_url`.
- Browser/dev fallback is `http://127.0.0.1:8765`.

Common session/config APIs:

- `GET /api/health`
- `GET /api/settings`
  - Response now includes the current login form state plus `saved_accounts`, a local history of previously successful login entries for the login-page host dropdown.
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
- `GET /api/control-monitor/key-state?session=robot-control`
  - Response includes side-channel keyboard clients plus `linkStatus` for the control monitor lamps: frontend dialing, backend listening, and direct-connected.
  - Direct-connected can be confirmed by frontend key-state `callState`; if no side-channel report exists, the monitor may infer a paired state after a completed browser-offer / robot-answer exchange. The virtual keyboard still requires frontend `/control/monitor/key-state` posts with `pressedKeys`.

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
- `go2rtc-telemetry-relay`: telemetry WebSocket relay and video status aggregation. It now owns `/telemetry/` and `/api/video/` behind Nginx.
- `go2rtc-control-signaling`: browser and robot WebRTC control broker.
- Control monitor side-channel also uses `go2rtc-control-signaling` behind the same internal port.

Tank Trouble separately managed systemd service:

- `cloud-service-console-tank-trouble`: game room service and cloud spectator page on internal `18086`, proxied under `/tank-trouble/`.

Standalone web console service:

- Current Hong Kong server: `43.154.250.82` (migrated from `150.109.100.30` on 2026-07-29).
- `cloud-service-console-web`: hosted console web service on Hong Kong server `43.154.250.82`, listening on public/internal port `18080`.
- Current preferred HTTPS web console public entry is `https://console.cityulive.com/?access_token=...`.
- Current admin entry: `https://console.cityulive.com/?access_token=xhfang`.
- Current user entry: `https://console.cityulive.com/?access_token=cmc5006`.
- Direct port entry for fallback/admin recovery: `http://43.154.250.82:18080/?access_token=...`.
- Latest hosted web console redeploy: `2026-07-08 21:37`, restarting only `cloud-service-console-web.service`.
- The old Nginx `/console/` web entry on port `80` was intentionally disabled on `2026-05-15`; do not recreate `/etc/nginx/conf.d/cloud-service-console-web.conf` unless the user explicitly asks to restore it.
- Previous HTTPS console domain `console.cityulive.xyz` is deprecated/broken as of `2026-05-19`; use `console.cityulive.com`.
- HTTPS for `console.cityulive.xyz` was enabled on `2026-05-15`: Nginx terminates TLS on `443`, redirects HTTP `80` for this host to HTTPS, and proxies to `http://127.0.0.1:18080`.
- Let's Encrypt certificate path: `/etc/letsencrypt/live/console.cityulive.xyz/fullchain.pem`; key path: `/etc/letsencrypt/live/console.cityulive.xyz/privkey.pem`; current certificate expires on `2026-08-13` and certbot auto-renew is installed.

Standalone P2P video service:

- `webrtc-p2p-video.service`: experimental browser P2P WebRTC video signaling service owned by Video Link Agent.
- Remote path: `/opt/webrtc-p2p-video`.
- Service listener: `0.0.0.0:8099`; keep public TCP `8099` blocked and expose it through Nginx HTTPS only.
- Public HTTPS entry: `https://p2p.cityulive.com/`.
- Console behavior: the local-stream UI now uses an inline P2P push panel that captures the camera in the console and talks to the selected P2P REST signaling API; room defaults to `robot` but is editable/saved in the P2P panel.
- Console P2P region selection: when the logged-in server is detected as Guangzhou (`111.230.62.106`, `p2p-gz.dlcourse.online`, or `p2p-gz.cityulive.com`), known/default P2P links automatically switch to `https://p2p-gz.dlcourse.online/watch.html?room=<room>`. Other known/default P2P links use Hong Kong `https://p2p.cityulive.com/watch.html?room=<room>`. Custom non-default P2P domains are preserved.
- Room behavior: one active pusher is allowed per P2P room. A second same-room pusher gets `HTTP 409`; different room names are independent. A stopped pusher sends `pusher-offline`, and abnormal close expires after about `15` seconds.
- Room discovery API: `GET /api/rooms` lists only rooms with an active pusher on the current P2P domain. Console "网页端观看" uses this endpoint to show clickable room IDs and displays `当前没有正在推流的房间` when the list is empty.
- Signaling retention: transient P2P signaling history is pruned aggressively to reduce first-frame delay. Normal messages keep about `20` seconds; `viewer-ready` messages sent to pusher keep about `8` seconds; long-poll timeout defaults to `5` seconds.
- ICE/TURN behavior: Hong Kong P2P signaling now returns both STUN and TURN through `/api/config`. Current TURN entries are `turn:p2p.cityulive.com:3478?transport=udp` and `turn:p2p.cityulive.com:3478?transport=tcp` with username `telemetry` and credential `123456`, reusing the existing coturn service. This is required for cross-city / cross-NAT viewing when direct P2P ICE candidates fail.
- Standalone pusher page for testing: `https://p2p.cityulive.com/push.html?room=robot`.
- Watch page: `https://p2p.cityulive.com/watch.html?room=robot`; this page is intentionally video-only and auto-starts viewer mode.
- Nginx config: `/etc/nginx/conf.d/webrtc-p2p-video.conf`.
- Certificate paths: `/etc/letsencrypt/live/p2p.cityulive.com/fullchain.pem` and `/etc/letsencrypt/live/p2p.cityulive.com/privkey.pem`.
- This service is separate from go2rtc legacy video, Tencent Cloud push status, control signaling, and Tank Trouble.
- Guangzhou P2P service:
  - Server: `111.230.62.106`.
  - Service: `webrtc-p2p-video-gz.service`.
  - Remote path: `/opt/webrtc-p2p-video-gz`.
  - Internal listener: `127.0.0.1:8099`.
  - Current public HTTPS entry: `https://p2p-gz.dlcourse.online/`.
  - Current public watch page: `https://p2p-gz.dlcourse.online/watch.html?room=robot`.
  - DNS: `p2p-gz.dlcourse.online A 111.230.62.106`.
  - HTTPS was enabled on `2026-05-29`; HTTP redirects to HTTPS on the working domain.
  - `p2p-gz.dlcourse.online` certificate path: `/etc/letsencrypt/live/p2p-gz.dlcourse.online/fullchain.pem`; key path: `/etc/letsencrypt/live/p2p-gz.dlcourse.online/privkey.pem`; current certificate expires on `2026-08-27`.
  - Nginx config for the working domain: `/etc/nginx/conf.d/webrtc-p2p-video-gz-dlcourse.conf`.
  - ICE/TURN behavior: Guangzhou P2P signaling config returns `stun:p2p-gz.dlcourse.online:3478`, Google STUN, and `turn:p2p-gz.dlcourse.online:3478?transport=udp/tcp` with username `telemetry` and credential `123456`.
  - Latest redeploy: `2026-07-08 20:59`, deploying local `E:\Desktop\123\webrtc-p2p-video` `server.py`, `public/*`, and `config.guangzhou.json` to `/opt/webrtc-p2p-video-gz`.
  - `p2p-gz.cityulive.com` caveat: DNS can point to `111.230.62.106`, but direct external HTTP access returns a DNSPod/Tencent `webblock.html` redirect and external HTTPS handshakes reset until the domain/ICP/access block is resolved. Do not use it as the Guangzhou P2P public entry yet.
  - This is an isolated Video Link Agent test endpoint and must not alter legacy go2rtc, Tencent Cloud Live, control signaling, Tank Trouble, or `18081` routing.

Known ports:

- `22/tcp`: SSH.
- `80/tcp`: Nginx HTTP host gateway; web-console host redirects to HTTPS and unknown hosts return `404`.
- `443/tcp`: Nginx HTTPS web console entry for `console.cityulive.com`.
- `18080/tcp`: standalone hosted web console on Hong Kong server `43.154.250.82`.
- `18081/tcp`: public HTTP entry.
- `18082/tcp`: internal go2rtc API.
- `18083/tcp`: telemetry relay.
- `18084/tcp`: HTTP ingest.
- `18085/tcp`: control signaling internal port.
- `18086/tcp`: Tank Trouble game room service.
- `19090/udp,tcp`: go2rtc WebRTC. On the migrated Hong Kong server, TCP is reachable but UDP was still blocked by the cloud security group during the 2026-07-29 check; add an inbound UDP `19090` rule.
- `19091/udp`: SRT ingest.
- `8554/tcp`: RTSP republish.
- `3478/udp,tcp`: TURN/STUN for control WebRTC and Hong Kong P2P WebRTC fallback relay. This is not part of the four managed systemd services in `config.py`, but control clients and cross-NAT P2P viewers may depend on it.
- `20000-20199/udp,tcp`: coturn relay candidate port range configured on the Hong Kong server. If P2P works locally but remote-city viewing fails even after TURN is listed in `/api/config`, verify this range in the cloud security group/firewall.

Control public paths on `18081`:

- `/control/webrtc/`: WebRTC offer/answer signaling for frontend-to-robot pairing.
- Frontend dialers must pass stable `client_id` on `/control/webrtc/browser-offer`; old browser-offer calls without it return `HTTP 400`.
- `/control/monitor/`: side-channel key-state monitor path for the mini app; it must not consume robot offers.
- Robot-side receivers must pass a stable `robot_client_id` on `/control/webrtc/robot-next-offer` and `/control/webrtc/robot-answer`. Only one active receiver is allowed per `session` / robot id; a second different receiver gets `HTTP 409 robot_listener_conflict` until the first receiver freshness window expires.

Video status public paths on `18081`:

- `GET /api/video/status`: returns `activeMode`, `conflict`, `availableModes`, `legacy`, and `tencent`.
- `POST /api/video/tencent/start`: Tencent Cloud push started.
- `POST /api/video/tencent/heartbeat`: Tencent Cloud push heartbeat, expected every 5 seconds while active.
- `POST /api/video/tencent/stop`: Tencent Cloud push stopped.
- For both `legacy` and `tencent`, a push mode is treated as stopped when its latest heartbeat is more than 60 seconds old. Short-lived `stale` may still appear only for a recent sender-side stale report before that 60-second timeout.
- These routes are proxied by Nginx to `go2rtc-telemetry-relay` on internal port `18083`.
- No new public port is used. Preserve these routes if regenerating Nginx config.

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
- Do not read `docs\SHARED_AGENT_STATUS.md` before every operation unless the user asks, the task explicitly depends on recent cross-agent state, or a conflicting edit must be investigated.

After editing:

- Update the lane-specific document with what changed.
- Update `frontend\IMPLEMENTATION_LOG.md` with scope, files, validation, and cloud deployment notes.
- Update `docs\SHARED_AGENT_STATUS.md` with the agent name, short title, scope, changed files, cloud impact, lane impact, cross-agent notes, validation, and build/release status.
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
- Log consoles are intentionally selectable/copyable; keep detailed command/error output inside log panels instead of long visible banners.
- Scrollable content areas with a stable top header.
- No harsh white boxes or abrupt overlays.
- Buttons should not wrap text.
- Fixed-format controls such as monitor keyboards must shrink within their panel on zoomed or narrow windows instead of causing horizontal clipping.
- Keyboard-like fixed controls should preserve equal-width letter keys; shorter rows should offset within the grid rather than stretching keys.
- The control monitor keyboard always shows at least `Q W E R`, `A S D F`, and `Z X C V`, then reveals only fully fitting right-side columns responsively as the actually visible keyboard area allows, with one centered keyboard track, normal keyboard-style half-key row offsets, and square keycaps.
- Activity view uses two log panels: `本地调试日志` first and `本地后端日志` second. Setup/refresh/start/stop flows should write readable local debug steps there.
- User-facing errors should be concise; raw stderr or command output belongs in selectable log consoles.
- Do not expose internal drift keys such as `www` in UI copy; use user-facing labels such as `云端网页资源`.
- Chinese UI copy should be concise and project-specific.

Use `docs\UI_DESIGN_AGENT.md` for the full style contract.
