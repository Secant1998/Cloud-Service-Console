# Cloud Service Console Implementation Log

## 2026-11-18 - RoboCasa completion and source handoff

- Supplemented 60 pinned v0.2 fixtures on the server, preserving all 5,971 older
  catalog rows. The active index now contains 6,031 entries, including 22 new
  articulated models with 76 movable joints.
- Added the staged import/activation worker and documented the paired simulator's
  native multi-joint and visual-inertia compatibility. Button contact regions are
  metadata; device-state runtime adapters remain outstanding.
- Updated the master handoff, shared status and model-library documentation.
  Bulk assets and diagnostic reports stay outside the source publication.
- Existing sink/stove preview sliders rendered joint motion, but complete browser
  automation remains unpassed because of page waits/closure and drag targeting.
  This batch changes the data catalog, not the frontend interaction implementation.

## 2026-11-05 - Black model-card hover with Dark Reader

- Reproduced the reported black card using the installed Dark Reader extension in an isolated test profile: its rewrite made the transparent reflection layer opaque.
- Moved lighting behind thumbnail content and removed the full-card overlay and previous speculative preview compositor workaround. Pointer tilt/shadows and image crossfades remain.
- Updated existing hover checks for background lighting; added real dishwasher pixel checks with an optional disposable Dark Reader profile. User browser settings remain unchanged.
- Build and card layout/tilt/lifecycle checks passed, covering desktop/mobile, both themes and individual/category thumbnail paint. Published static files only, with rollback at `/opt/cloud-service-console-web/backups/web-assets-20261104T181244Z`; no backend/service restart, version bump, installer build or GitHub push.

## 2026-11-05 - Joint marker placement

- Replaced straight rotation arrows with a curved arrow around the extended rotation axis, beyond the moving part. A faint dashed line identifies the axis.
- Sliding arrows start at the moving assembly's center and move with it. Optional URDF mass/center data is retained by the view API; missing inertia falls back to geometry center.
- Validation includes transformed-axis and moving-center checks, optional-inertia API cases, build and real microwave/cabinet screenshots with marker-pixel movement checks on desktop/mobile in both themes.

## 2026-11-05 - Interactive articulated model previews

- Extended the model view API with native URDF axes, motion limits and mimic relationships; fixed joints remain static and malformed controls show their reason.
- Added selectable joint buttons, moving-part tint, axis indicator, degree/mm sliders, numeric editing, direct visible-part dragging and reset controls. Background camera gestures and full-screen controls remain available.
- Preserved source textures and original thumbnails; reserved camera framing for opened doors and drawers. Added independent motion transforms for correct nested-joint behavior.
- Verification: backend manifest/source-validation tests, Node kinematics tests, production build and Playwright checks using real cloud microwave, cabinet/drawer and rigid models. Screenshots cover both themes and desktop/mobile; thumbnail regression included.
- Deployed the scoped model-library backend and built frontend with backup/rollback. All 2,347 articulated source models were audited: 11,971 moving joints, including 22 invalid axes and one zero-range joint that are disabled. No model data, robot services, installers or GitHub state were changed.

## 2026-11-05 - User-supplied console icon

- Replaced the login badge and sidebar V3 badge with the supplied photograph.
- Added a versioned favicon and a hashed touch-icon asset accessible before login.
- Regenerated the desktop PNG and multi-resolution ICO from the same retained source image; future desktop builds no longer redraw the old icon.
- Validation: production build passed; Playwright checked login/sidebar images in light and dark themes, mobile login layout, favicon responses, and the public login page without runtime errors.
- Deployment: updated hosted frontend assets and atomically replaced its HTML entry. Previous entry/icon files were backed up under the console's `backups/icon-update-*` directory. Backend and robot services were not restarted. Windows executables/installers were not rebuilt.

## 2026-08-13 14:53 - External frontend VS Code terminal auto-activation

Scope:
- Configured both the external Telebot root workspace and its `apps/frontend` sub-workspace so every new VS Code PowerShell terminal activates the root `.venv` automatically.
- Added a workspace-only `Telebot PowerShell` default profile with process-level execution-policy bypass, because the system policy blocks `Activate.ps1`.
- No global PowerShell policy was changed.

Validation:
- Both settings files parse as JSON.
- Root and frontend-only terminal simulations both resolved Python to the root `.venv`, reported Python 3.11.9, and found editable `telebot 0.2.0a0`.

Build / deployment:
- IDE-only external configuration; no application build, EXE, cloud deployment, GitHub push, or tag changed.

## 2026-08-11 17:19 - P2P QoE export human report and field guide

Scope:
- Added an embedded Chinese `fieldGuide` to every newly downloaded standalone P2P viewer QoE JSON file.
- The top of `fieldGuide` now contains the actual measurement values as a Chinese report: session/environment, connection and transport, video and playback, automatic interpretation, and per-sample key metrics.
- The guide explains measurement conventions, units, enum values, summary statistics, and every exported session/sample field while preserving valid machine-readable JSON.
- Raised the top-level export schema to version `3`; existing `session`, `summary`, and `samples` structures are unchanged.

Changed files / deployment:
- External `E:/Desktop/123/webrtc-p2p-video/public/qoe-collector.js`.
- Hong Kong `/opt/webrtc-p2p-video/public/qoe-collector.js`.
- Guangzhou `/opt/webrtc-p2p-video-gz/public/qoe-collector.js`.
- Deployed only the static collector file with timestamped backups; both P2P services remained active and were not restarted.

Validation:
- `node --check public/qoe-collector.js` passed.
- Existing sample coverage and JSON round-trip checks passed.
- Successful-video and no-video records both generated the expected distinct human-readable reports and conclusions.
- Hong Kong and Guangzhou public collector scripts returned HTTP 200 with schema v3; both configuration APIs returned `ok: true`.

Build / release:
- No Cloud Service Console source/runtime behavior, EXE, installer, GitHub push, or tag changed.

## 2026-08-07 17:20 - Frontend-only VS Code interpreter fallback

Scope:
- Added an external `apps/frontend/.vscode/settings.json` so opening only that subfolder still selects the root Windows `.venv` and resolves shared Telebot packages.
- Reopened the frontend folder in a new VS Code window; existing terminals must be replaced with a new terminal for activation.

Validation:
- The configured root interpreter exists and imports `telebot_common` successfully.

Build / deployment:
- IDE-only external configuration; no application source, EXE, cloud deployment, GitHub push, or tag changed.

## 2026-08-06 10:31 - P2P viewer local QoE collection

Scope:
- Added an opt-in bottom-right collection button to the external P2P watch page.
- The viewer browser samples receiver-side WebRTC, decoding, rendering, stall, freeze, visual-black-frame, route, and environment metrics once per second.
- Stopping the session downloads a structured JSON result to the viewing machine; IndexedDB keeps a browser-local backup. No QoE sample is uploaded to the signaling server.

Files / deployment:
- External `E:/Desktop/123/webrtc-p2p-video/public/watch.html`
- External `E:/Desktop/123/webrtc-p2p-video/public/shared.js`
- External `E:/Desktop/123/webrtc-p2p-video/public/style.css`
- External `E:/Desktop/123/webrtc-p2p-video/public/qoe-collector.js`
- Hong Kong `/opt/webrtc-p2p-video/public`
- Guangzhou `/opt/webrtc-p2p-video-gz/public`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- JavaScript syntax checks passed for `shared.js` and `qoe-collector.js`.
- Desktop and 390x844 browser smoke passed with no overflow; start, per-second accumulation, stop, and save confirmation behaved correctly.
- Hong Kong public browser smoke completed without console errors.
- Both public domains returned HTTP 200 for the watch page, collector script, configuration API, and room API.

Build / deployment:
- Static watch assets deployed to Hong Kong and Guangzhou with timestamped remote backups.
- Both P2P signaling services remained active and were not restarted.
- No EXE/package build, hosted-console deployment, GitHub push, or tag update was performed.

Cross-lane note:
- No control signal, Tank Trouble, Tencent Cloud Live, legacy go2rtc, port, or service-name behavior changed.

## 2026-08-03 13:03 - External Telebot VS Code environment

Scope:
- Explicit cross-project development-environment setup for the teammate `telebot-main_new0.2-0803` workspace.
- Created a Windows Python 3.11 `.venv`, installed runtime/development dependencies, installed the workspace editable, and configured VS Code to use it from the project root.
- Added frontend and public-cloud Compute debug launch entries without changing either service's behavior.

Files / runtime:
- External `telebot-main_new0.2-0803/.venv`
- External `telebot-main_new0.2-0803/.vscode/settings.json`
- External `telebot-main_new0.2-0803/.vscode/launch.json`
- External `telebot-main_new0.2-0803/.vscode/extensions.json`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- Runtime imports passed for Telebot packages and all major frontend/compute dependencies.
- Frontend and Compute configs validated.
- Frontend startup smoke test listened on HTTPS `8445`; the temporary frontend and spawned video worker were then stopped, leaving no Telebot Python process running.

Build / deployment:
- No Cloud Service Console source behavior, EXE, cloud runtime, GitHub tag, or deployed service changed.

## 2026-07-29 10:15 - Local desktop target migration

Scope:
- Video Link Agent local runtime update.
- Changed the installed desktop console's saved local-stream host and UI draft from `150.109.100.30` to `43.154.250.82`.
- Kept P2P tools on `https://p2p.cityulive.com`, which now resolves to the new Hong Kong server.

Files:
- `%LOCALAPPDATA%/CloudServiceConsole/local-stream-config.json`
- `%LOCALAPPDATA%/CloudServiceConsole/local-stream-ui-draft.json`
- `%LOCALAPPDATA%/CloudServiceConsole/local-stream/camera-push-command.json`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- Parsed the remembered login, local-stream config, local-stream UI draft, and cached camera push command successfully; every active local target uses `43.154.250.82`.
- Confirmed the desktop app was not running during the update.

Build / deployment:
- No EXE rebuild was needed because only external runtime settings changed.
- No cloud service restart, GitHub push, or tag update was performed.

Cross-lane note:
- Control signal and Tank Trouble files were not changed.

## 2026-07-29 02:48 - Hong Kong server IP migration

Scope:
- Video Link Agent cloud migration update from `150.109.100.30` to `43.154.250.82`.
- Corrected the migrated server's go2rtc WebRTC candidate, SRT/viewer endpoint metadata, telemetry TURN host, coturn NAT mapping, and hosted-console default/login host.
- Updated the hosted web-console deployment script's default Hong Kong target.

Files:
- `scripts/deploy_web_console.py`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`
- Local `%LOCALAPPDATA%/CloudServiceConsole/cloud-console-login.json`
- Video/console configuration files on `43.154.250.82` listed in `docs/VIDEO_LINK_AGENT.md` section 107.

Validation:
- Direct new-IP video status and endpoint metadata requests returned HTTP 200.
- The deployment script default target and local remembered login target both resolve to `43.154.250.82`.
- Host-pinned HTTPS checks confirmed the new server is ready for `console.cityulive.com` and `p2p.cityulive.com` with valid certificates.
- Public UDP probes reached SRT ingest `19091` and TURN relay port `20000`; coturn returned a valid STUN response on UDP `3478`.
- `19090/TCP` is reachable, but UDP `19090` is still blocked before reaching the server and must be allowed in the new cloud security group.
- All nine inspected cloud services were `active` after the scoped restarts.
- Active-session checks showed no legacy/Tencent push, P2P room, or control session during migration.

Build / deployment:
- Restarted only `coturn`, `go2rtc-cloud`, `go2rtc-telemetry-relay`, and `cloud-service-console-web` on `43.154.250.82`.
- No desktop EXE build, GitHub push, or tag update was performed.
- DNS still resolves `console.cityulive.com` and `p2p.cityulive.com` to the old IP; both A records must be changed to `43.154.250.82` before normal domain traffic reaches the new server.

Cross-lane note:
- Control broker and Tank Trouble files/services were not changed or restarted. Coturn is shared infrastructure, so Control Signal Agent should verify direct control WebRTC after DNS cutover.

## 2026-07-08 21:37 - Console P2P region auto selection

Scope:
- Video Link Agent UI update.
- The local-stream P2P panel now auto-selects the P2P signal/watch domain based on the currently logged-in server.
- Guangzhou server identity (`111.230.62.106`, `p2p-gz.dlcourse.online`, or `p2p-gz.cityulive.com`) maps known/default P2P links to `https://p2p-gz.dlcourse.online/watch.html?room=<room>`.
- Other known/default P2P links map to Hong Kong `https://p2p.cityulive.com/watch.html?room=<room>`.
- Custom non-default P2P domains are preserved.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `python scripts/deploy_web_console.py`
- Hosted web console health check passed on `http://127.0.0.1:18080/api/health`.
- Deployment script confirmed `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn` stayed `active` before and after deployment.

Build / deployment:
- Hosted web console redeployed to `150.109.100.30:/opt/cloud-service-console-web`.
- Restarted only `cloud-service-console-web.service`.
- Desktop EXE rebuild was attempted with `cmd /c npm run installer:build`, but the Tauri/Cargo build stalled for 20 minutes and was stopped; `E:\Cloud-Service-Console` EXEs were not replaced.
- No GitHub push and no tag update were performed.

Cloud deployment note:
- This is hosted-console UI behavior only. P2P signaling services, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, nginx, and coturn were not changed by this update.

## 2026-07-08 20:59 - Guangzhou P2P dlcourse deployment

Scope:
- Video Link Agent Guangzhou P2P video deployment.
- Redeployed the Guangzhou P2P video signaling service using `https://p2p-gz.dlcourse.online` as the current public Guangzhou P2P push/watch domain.
- Synced local `E:\Desktop\123\webrtc-p2p-video` `server.py`, `public/*`, and `config.guangzhou.json` to remote `111.230.62.106:/opt/webrtc-p2p-video-gz`.
- Installed `config.guangzhou.json` as remote `config.json`, so `/api/config` returns `p2p-gz.dlcourse.online` STUN/TURN entries.
- Updated the master handoff index to mark `p2p-gz.dlcourse.online` as the current Guangzhou public P2P entry and keep `p2p-gz.cityulive.com` as blocked/not-for-use until its Tencent webblock/ICP issue is resolved.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- External `E:\Desktop\123\webrtc-p2p-video\config.guangzhou.json`
- External `E:\Desktop\123\webrtc-p2p-video\public\index.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\push.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\Desktop\123\webrtc-p2p-video\public\style.css`
- External `E:\Desktop\123\webrtc-p2p-video\public\watch.html`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/server.py`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/config.json`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/public/*`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Remote `systemctl is-active webrtc-p2p-video-gz.service nginx coturn` returned `active`, `active`, `active`.
- Remote `curl -s http://127.0.0.1:8099/api/config` returned `p2p-gz.dlcourse.online` STUN/TURN entries.
- Public `https://p2p-gz.dlcourse.online/api/config` returned HTTP 200 with `p2p-gz.dlcourse.online` STUN/TURN entries.
- Public `https://p2p-gz.dlcourse.online/api/rooms` returned HTTP 200 and `rooms: []`.
- Public `https://p2p-gz.dlcourse.online/watch.html?room=robot` returned HTTP 200.
- Public `https://p2p-gz.dlcourse.online/shared.js` contains `VIEWER_FRAME_STALL_MS = 4000`, `VIEWER_RECONNECT_COOLDOWN_MS = 2000`, and `viewer-reconnect`.

Build / deployment:
- Restarted only `webrtc-p2p-video-gz.service`.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

Cloud deployment note:
- Guangzhou P2P public entry is `https://p2p-gz.dlcourse.online/`.
- Hong Kong P2P, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, hosted console UI, desktop EXE, public `18081` routing, and service names were not changed.

## 2026-07-08 20:32 - P2P new server deployment guide

Scope:
- Video Link Agent documentation update.
- Added a step-by-step Markdown guide for deploying the current P2P video service on another server.
- The guide covers DNS, security group ports, package installation, uploading `webrtc-p2p-video`, `config.json`, systemd, nginx HTTPS, coturn STUN/TURN, service validation, `p2p-local-pusher` configuration, watch URL validation, room status APIs, and troubleshooting.
- The document uses placeholders such as `p2p-new.example.com` and `SERVER_PUBLIC_IP` for teammate reuse.

Files:
- `docs/P2P_VIDEO_NEW_SERVER_DEPLOYMENT_GUIDE.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- Reviewed external `E:\Desktop\123\webrtc-p2p-video` structure and `config.json`.
- Reviewed external `E:\Desktop\123\p2p-local-pusher\config\pusher.config.json` shape.
- Verified the new guide contains key deployment topics: `p2p-new.example.com`, `SERVER_PUBLIC_IP`, `webrtc-p2p-video.service`, `coturn`, `p2p-local-pusher`, `/api/config`, `watch.html`, and TURN relay port range `49152-49200`.

Build / deployment:
- Documentation-only change.
- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

Cloud deployment note:
- No public port, domain, cloud service name, P2P signaling server code, WebRTC video media transport, legacy go2rtc ingest, Tencent Cloud Live, control signaling, or Tank Trouble behavior changed.

## 2026-07-07 12:25 - P2P file transfer room auto reset

Scope:
- Video Link Agent external P2P file-transfer lifecycle cleanup.
- Sender or receiver waiting alone now times out after `advanced.peerWaitTimeoutSeconds`, default 60 seconds.
- On single-side wait timeout, the script requests `/api/rooms/<room>/reset` before exiting.
- After successful transfer and receiver verification, both sides request room reset before exiting.
- README now recommends a dedicated file-transfer room such as `robot-file`.
- Recreated `file_transfer.config.json` as a compatible shared-config template with the same 60-second wait timeout.

Files:
- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\sender.config.json`
- External `E:\Desktop\123\p2p-file-transfer\config\receiver.config.json`
- External `E:\Desktop\123\p2p-file-transfer\config\file_transfer.config.json`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- Loaded sender, receiver, and shared template configs successfully; all use `peerWaitTimeoutSeconds: 60`.
- Receiver-only timeout smoke test in room `codex-timeout-reset-8d21e68b` with a 3-second temporary timeout exited with error and logged `Room reset requested`; public status returned `peers: []` and `messageCount: 0`.
- End-to-end completion smoke test in room `codex-complete-reset-4420cf24` transferred a 40.0 KB file; both processes exited `0`; SHA-256 matched; both logged room reset; public status returned `peers: []` and `messageCount: 0`.

Build / deployment:
- No cloud runtime changed or restarted.
- The scripts call the existing P2P signaling reset API at runtime for their file-transfer room.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

Cloud deployment note:
- This is external-script-only.
- P2P signaling server code, WebRTC video media transport, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, and service names were not changed.

## 2026-07-07 12:19 - P2P file transfer Windows path config fix

Scope:
- Video Link Agent external P2P file-transfer config usability fix.
- Fixed `Invalid \escape` errors caused by pasted Windows paths with single backslashes in JSON config.
- Current sender and receiver configs now use forward-slash Windows paths.
- Added tolerant config parsing for `sendPath`, `sendFile`, and `saveDir`, so values such as `E:\Desktop\123` are accepted in those path fields.
- Updated README path guidance.

Files:
- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\sender.config.json`
- External `E:\Desktop\123\p2p-file-transfer\config\receiver.config.json`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- Loaded `sender.config.json` and `receiver.config.json` successfully.
- Loaded a temporary config containing single-backslash Windows paths such as `D:\test\abc.txt` and `E:\Desktop\123` successfully.

Build / deployment:
- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

Cloud deployment note:
- This is external-script-only.
- P2P signaling server, WebRTC video media transport, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, and service names were not changed.

## 2026-07-07 12:03 - P2P file transfer split configs

Scope:
- Video Link Agent external P2P file-transfer tool update.
- Split config into `sender.config.json` and `receiver.config.json`.
- `send_file.cmd` / `send_file.sh` now default to `config/sender.config.json`.
- `receive_file.cmd` / `receive_file.sh` now default to `config/receiver.config.json`.
- Python CLI defaults now also use sender config for `send` and receiver config for `receive` when `--config` is omitted.
- Kept `file_transfer.config.json` as a compatible shared-config template only.

Files:
- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\sender.config.json`
- External `E:\Desktop\123\p2p-file-transfer\config\receiver.config.json`
- External `E:\Desktop\123\p2p-file-transfer\send_file.cmd`
- External `E:\Desktop\123\p2p-file-transfer\send_file.sh`
- External `E:\Desktop\123\p2p-file-transfer\receive_file.cmd`
- External `E:\Desktop\123\p2p-file-transfer\receive_file.sh`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py send --help`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py receive --help`
- Local end-to-end smoke test with separate sender/receiver configs in room `codex-split-config-32237724`.
- Smoke test transferred a 36.0 KB file; both processes exited `0`; received SHA-256 matched source SHA-256.

Build / deployment:
- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

Cloud deployment note:
- This is external-script-only.
- P2P signaling server, WebRTC video media transport, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, and service names were not changed.

## 2026-07-07 11:47 - P2P file transfer folder packaging

Scope:
- Video Link Agent external P2P file-transfer tool update.
- Sender can now send either a file or a folder.
- Added `sendPath` as the primary sender config field while keeping old `sendFile` compatibility.
- Added `packFolder`; when true, folder send paths are packed into a temporary zip before transfer.
- Receiver saves folder transfers as `folder-name.zip` and does not auto-extract them.
- Sender and receiver can share one config file; sender-only fields are ignored by the receiver and receiver-only fields are ignored by the sender.

Files:
- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\file_transfer.config.json`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py send --help`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py receive --help`
- Local end-to-end folder smoke test in room `codex-folder-smoke-6bc2197c`.
- Smoke test packed a folder with nested files and an empty directory, transferred `source_folder.zip`, both processes exited `0`, and received zip contents matched source folder contents.

Build / deployment:
- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

Cloud deployment note:
- This is external-script-only.
- P2P signaling server, WebRTC video media transport, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, and service names were not changed.

## 2026-07-07 11:32 - Standalone P2P file transfer scripts

Scope:
- Video Link Agent external P2P file-transfer tool.
- Added `E:\Desktop\123\p2p-file-transfer` with sender and receiver scripts for a dedicated WebRTC `file-transfer` DataChannel.
- Sender and receiver use the same signaling room and can start in either order; the sender creates the offer and the receiver answers.
- Sender displays hashing, connection status, speed, percentage, ETA, and a progress bar.
- Receiver displays waiting status, incoming file metadata, speed, percentage, ETA, output path, progress bar, and SHA-256 verification result.
- File transfer uses its own WebRTC peer connection and does not share the video/control DataChannel queue.

Files:
- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\file_transfer.config.json`
- External `E:\Desktop\123\p2p-file-transfer\setup_local.cmd`
- External `E:\Desktop\123\p2p-file-transfer\setup_local.sh`
- External `E:\Desktop\123\p2p-file-transfer\send_file.cmd`
- External `E:\Desktop\123\p2p-file-transfer\send_file.sh`
- External `E:\Desktop\123\p2p-file-transfer\receive_file.cmd`
- External `E:\Desktop\123\p2p-file-transfer\receive_file.sh`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- External `E:\Desktop\123\p2p-file-transfer\requirements.txt`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py --help`
- Local end-to-end smoke test with one receiver process and one sender process in room `codex-file-smoke-4b3299f4`.
- Smoke test transferred a 48.8 KB file; both processes exited `0`; received SHA-256 matched source SHA-256.

Build / deployment:
- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

Cloud deployment note:
- This is external-script-only.
- P2P signaling server, WebRTC video media transport, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, and service names were not changed.

## 2026-07-02 11:55 - P2P signaling peer auto-expire

Scope:
- Video Link Agent P2P signaling status cleanup.
- Added `peerTtlSeconds` with a default of 60 seconds so stale viewer/pusher peer records expire automatically when they stop sending heartbeats.
- Active pusher freshness still uses the existing 15-second `pusherTtlSeconds`.
- Room peer pruning now runs during `/api/rooms`, `/api/rooms/<room>/status`, message publish, and long-poll message heartbeat handling.
- This fixes stale watcher counts such as old `robot111` peers remaining visible after viewers were already closed.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/server.py`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/server.py`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- Deployed to Hong Kong P2P signaling and restarted only `webrtc-p2p-video.service`; service returned `active`.
- Deployed to Guangzhou P2P signaling and restarted only `webrtc-p2p-video-gz.service`; service returned `active`.
- `https://p2p.cityulive.com/api/rooms/robot111/status` returned `peers: []`, `messageCount: 0`, inactive pusher.
- `https://p2p.cityulive.com/api/rooms` returned `rooms: []`.
- `https://p2p-gz.dlcourse.online/api/config` and `/api/rooms` returned HTTP 200 with valid JSON.

Build / deployment:
- Restarted only the Hong Kong and Guangzhou P2P signaling services.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

Cloud deployment note:
- P2P signaling/status behavior changed only.
- WebRTC media transport, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, and service names were not changed.

## 2026-06-05 12:56 - P2P script live relay no-backlog fix

Scope:
- Video Link Agent standalone P2P script reliability fix.
- User observed that script `h264` starts a new viewer several seconds behind and catches up, while `h264_amf` can start more than 30 seconds behind and freeze before catching up.
- Identified aiortc `MediaRelay.subscribe(...)` default buffered mode as the likely backlog source.
- Changed viewer track relay to `buffered=False`, so new viewers receive the newest live frame instead of draining an old per-viewer queue.
- Synced the fix to `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher` and `E:\Desktop\123\p2p-local-pusher`.

Files:
- External `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- Confirmed both script trees now use `buffered=False` for viewer track relay.
- Rebuilt `E:\Desktop\123\p2p-local-pusher.zip`.

Build / deployment:
- No cloud runtime changed or restarted.
- No desktop EXE rebuild and no hosted console redeploy were performed.
- Already-running standalone P2P pushers must be stopped and started again to load the no-backlog relay fix.

## 2026-06-05 12:44 - P2P script periodic keyframe and faster viewer recovery

Scope:
- Video Link Agent P2P script/watch-page reliability follow-up based on the provided freeze recording.
- The recording shows the real wall clock moving while the monitor's P2P video frame freezes, then recovers after reconnect.
- Added a one-second periodic keyframe interval in the standalone script pusher H.264 encoder path.
- Preserved frame timestamps after reformatting/scaling before encoding.
- Set encoder GOP size to about one second and disabled B-frames when PyAV exposes those codec fields.
- Shortened the P2P watch-page frozen-frame watchdog from about 12 seconds to about 4 seconds and reconnect cooldown from about 6 seconds to about 2 seconds.
- Synced the fix to the active `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher` tree and the maintained `E:\Desktop\123\p2p-local-pusher` package.

Files:
- External `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Rebuilt `E:\Desktop\123\p2p-local-pusher.zip`.
- Public `https://p2p.cityulive.com/shared.js` and `https://p2p-gz.dlcourse.online/shared.js` contain `VIEWER_FRAME_STALL_MS = 4000` and `VIEWER_RECONNECT_COOLDOWN_MS = 2000`.

Build / deployment:
- Deployed P2P watch-page `shared.js` to Hong Kong and Guangzhou P2P signaling services.
- Restarted only `webrtc-p2p-video.service` and `webrtc-p2p-video-gz.service`; both returned `active`.
- No desktop EXE rebuild and no hosted console redeploy were performed.

Cloud deployment note:
- No legacy go2rtc ingest, Tencent Cloud Live protocol, control broker, Tank Trouble logic, public port, domain, or cloud service name changed.
- Already-running standalone P2P pushers must be stopped and started again to load the periodic-keyframe fix.

## 2026-06-05 12:08 - P2P script keyframe startup fix

Scope:
- Video Link Agent P2P script/watch-page reliability fix.
- Fixed the viewer freeze detector so received bytes alone no longer count as a moving picture; only video time or decoded frame growth keeps the viewer healthy.
- Updated the active standalone pusher at `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher` to request keyframes from the aiortc `RTCRtpSender`.
- Added a short keyframe burst for every new viewer connection to reduce first-frame freeze / black-screen startup.
- Synced the same script fix to `E:\Desktop\123\p2p-local-pusher` and refreshed `E:\Desktop\123\p2p-local-pusher.zip`.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Public `https://p2p.cityulive.com/api/rooms` and `https://p2p-gz.dlcourse.online/api/rooms` returned `ok: true`.

Build / deployment:
- Deployed P2P watch-page `shared.js` to Hong Kong and Guangzhou P2P signaling services.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.
- No desktop EXE rebuild and no hosted console redeploy were performed.

Cloud deployment note:
- Restarted only `webrtc-p2p-video.service` and `webrtc-p2p-video-gz.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No legacy go2rtc ingest, Tencent Cloud Live protocol, control broker, Tank Trouble logic, public port, domain, or cloud service name changed.
- Already-running standalone P2P pushers must be stopped and started again to load the keyframe burst fix.

## 2026-06-05 01:46 - P2P viewer freeze auto-reconnect

Scope:
- Video Link Agent P2P watch-page reliability fix.
- Added automatic viewer reconnect when the WebRTC connection still says `connected` but video time / decoded frames / received bytes stop advancing for about 12 seconds.
- Added a visible-tab recheck so browser background throttling / idle-tab stalls can recover without manual refresh.
- Added `viewer-reconnect` handling for browser P2P pushers and standalone local script pushers.
- Refreshed the standalone P2P local pusher folder and zip package.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `python -m py_compile E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\pusher.py E:\Desktop\123\p2p-local-pusher\scripts\common.py E:\Desktop\123\p2p-local-pusher\scripts\start_local.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://p2p.cityulive.com/shared.js` and `https://p2p-gz.dlcourse.online/shared.js` returned `200` and contained `VIEWER_FRAME_STALL_MS`.
- Public `https://p2p.cityulive.com/api/rooms` and `https://p2p-gz.dlcourse.online/api/rooms` returned `ok: true`.
- Public `https://console.cityulive.com/api/health` with admin bearer token returned `backend-ready`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.
- Deployed P2P watch-page `shared.js` to Hong Kong and Guangzhou P2P signaling services.

Cloud deployment note:
- Restarted only `webrtc-p2p-video.service`, `webrtc-p2p-video-gz.service`, and `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No legacy go2rtc ingest, Tencent Cloud Live protocol, control broker, Tank Trouble logic, public port, domain, or cloud service name changed.
- Already-running standalone P2P pushers need a stop/start to load the new script-side reconnect handling.

## 2026-06-05 01:19 - Overview P2P room status

Scope:
- Video Link Agent overview status update.
- Added a third `P2P` row to the overview `视频推流状态` card beside `旧链路` and `腾讯云`.
- P2P status counts active rooms from the current P2P signaling domain's `/api/rooms`.
- P2P lamp turns green when any room is streaming and blue when this console / local app is one of the active pushers.
- Existing 5-second video status polling and manual refresh now also refresh the P2P room summary.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.com/api/health` with admin bearer token returned `backend-ready`.
- Public `https://p2p.cityulive.com/api/rooms` returned `ok: true` with the active `robot` room.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc video service, Tencent Cloud Live protocol behavior, control broker, Tank Trouble logic, public port, domain, or cloud service name changed.

## 2026-06-05 01:09 - Web push panel mutual exclusion

Scope:
- Video Link Agent local-stream UI fix.
- Tencent Cloud push and P2P push panels are now mutually exclusive.
- Opening Tencent Cloud closes P2P first; opening P2P closes Tencent Cloud first.
- If one web push mode is busy or actively pushing, the other entry button is disabled so a second push panel cannot be opened underneath/above it.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.com/api/health` with admin bearer token returned `backend-ready`.
- Public fallback `http://150.109.100.30:18080/api/health` with admin bearer token returned `backend-ready`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc video service, Tencent Cloud Live protocol behavior, control broker, Tank Trouble logic, public port, domain, or cloud service name changed.

## 2026-06-04 22:57 - Viewer resolution single input

Scope:
- Video Link Agent local-stream UI fix.
- Changed `观看分辨率` from two adjacent number inputs into one `WIDTHxHEIGHT` input to avoid drag-select focus moving from height to width.
- The input accepts common separators such as `x`, `×`, `*`, or whitespace, then normalizes to `WIDTHxHEIGHT` on blur.
- The single value still writes both `video_size` and `output_video_size`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Local built JS contains `观看分辨率`; old `观看宽度` / `观看高度` inputs are absent.
- Public fallback health `http://150.109.100.30:18080/api/health` with admin bearer token returned `backend-ready`.
- Public HTTPS domain check from this machine could not resolve `console.cityulive.com`; server-side deploy health check passed.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc video service, Tencent Cloud Live protocol behavior, control broker, Tank Trouble logic, public port, domain, or cloud service name changed.

## 2026-06-04 22:41 - Viewer-facing local push parameters

Scope:
- Video Link Agent local-stream UI simplification.
- Replaced separate capture/output resolution controls with one `观看分辨率`.
- Replaced separate capture/target frame-rate controls with one `观看帧率`.
- The single viewer resolution now writes both `video_size` and `output_video_size`; the single viewer frame rate writes both `input_framerate` and `target_framerate`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts/deploy_web_console.py`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx docs\VIDEO_LINK_AGENT.md frontend\IMPLEMENTATION_LOG.md docs\SHARED_AGENT_STATUS.md`
- Public console asset contains `观看分辨率` / `观看帧率` and no longer contains the old capture/output labels.
- Public `https://console.cityulive.com/api/health?access_token=xhfang` returned `backend-ready`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc video service, Tencent Cloud Live protocol behavior, control broker, Tank Trouble logic, public port, domain, or cloud service name changed.

## 2026-06-02 21:35 - P2P local pusher compatibility sync

Scope:
- Video Link Agent external-script maintenance.
- Synced the useful classmate-tested `p2p-local-pusher-0602` fixes into the maintained P2P local pusher script.
- Linux camera enumeration now deprioritizes loopback / virtual devices.
- Setup now recreates a copied but unusable Python virtual environment.
- Kept the generic config instead of copying machine-specific Linux paths.

Files / external paths:
- External `E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\setup_local.py`
- External `E:\Desktop\123\p2p-local-pusher.zip`
- Backup `E:\Desktop\123\p2p-local-pusher.zip.bak-20260602213522`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile` on all external P2P local pusher Python scripts.
- Confirmed the clean zip contains 14 user-facing files and the updated scripts.
- Compared against the classmate-tested 0602 copy.

Build / deployment:
- No EXE rebuild.
- No hosted web console deployment.
- No cloud service restart.

## 2026-06-02 01:11 - P2P room picker for web viewing

Scope:
- Video Link Agent P2P viewing update.
- Added `GET /api/rooms` to the standalone P2P signaling service so clients can list currently active rooms by domain.
- Changed P2P "网页端观看" from manual link entry to a clickable room list for the current P2P domain.
- Empty domains now show `当前没有正在推流的房间`.

Files / external paths:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- Remote `150.109.100.30:/opt/webrtc-p2p-video`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`

Validation:
- `node --check E:\Desktop\123\webrtc-p2p-video\server.js`
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- Local Node smoke test for `GET /api/rooms`.
- Remote `python3 -m py_compile` on HK/GZ P2P `server.py`.
- Public `https://p2p.cityulive.com/api/rooms` returned active rooms during validation.
- Public `https://p2p-gz.dlcourse.online/api/rooms` returned `ok: true`.
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public console asset check found the new room picker strings and `/api/rooms`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.
- Deployed P2P signaling files to HK and GZ.

Cloud deployment note:
- Restarted only `webrtc-p2p-video.service`, `webrtc-p2p-video-gz.service`, and `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No go2rtc legacy video service, Tencent Cloud Live behavior, control broker, Tank Trouble logic, public port, domain, or service name changed.

## 2026-05-29 17:41 - P2P viewer card cleanup

Scope:
- Video Link Agent UI cleanup for the P2P panel.
- Removed the top "房间观看端" viewer-count card.
- Removed the lower inline refresh button.
- The lower P2P status strip now only shows the status lamp and current push message, including the automatically maintained connected-viewer count when pushing from the page.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public console asset check confirmed no `房间观看端` text and no `p2p-viewer-refresh` class remain.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc legacy video service, Tencent Cloud Live behavior, control broker, or Tank Trouble service changed.

## 2026-05-29 17:03 - P2P refresh button placement

Scope:
- Video Link Agent UI adjustment for the P2P panel.
- Removed the large refresh button from the "房间观看端" stat card.
- Added a compact refresh button inside the lower P2P status strip, aligned with the status lamp and message.
- The top stat card now only displays room viewer count and refresh time.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public console asset check found `p2p-push-status-row` and `p2p-viewer-refresh-button-inline`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc legacy video service, Tencent Cloud Live behavior, control broker, or Tank Trouble service changed.

## 2026-05-29 16:20 - P2P viewer offline cleanup

Scope:
- Video Link Agent fix for stale P2P room viewer counts.
- P2P watch pages now send `viewer-offline` on manual stop, `pagehide`, and `beforeunload`.
- P2P signaling servers remove peers from room status on `viewer-offline` / `pusher-offline`.
- Console P2P pusher closes and removes a peer connection when it receives `viewer-offline`.
- Manual room viewer count fallback freshness window changed from 45 seconds to 12 seconds.

Files / external paths:
- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Remote `150.109.100.30:/opt/webrtc-p2p-video`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz`
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `node --check E:\Desktop\123\webrtc-p2p-video\server.js`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public P2P watch JS on HK/GZ contains `viewer-offline`, `notifyViewerOffline`, and `pagehide`.
- Temporary room API tests on HK and GZ verified `viewer-ready` adds a peer and `viewer-offline` removes it immediately.
- Current `robot` room checks showed `freshViewers=0` on both HK and GZ.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.
- Deployed P2P signaling/static-page files to HK and GZ.

Cloud deployment note:
- Restarted only `webrtc-p2p-video.service`, `webrtc-p2p-video-gz.service`, and `cloud-service-console-web.service`.
- No public port/domain/service-name change.
- No go2rtc legacy video service, Tencent Cloud Live behavior, control broker, or Tank Trouble service changed.

## 2026-05-29 15:51 - P2P manual viewer count refresh

Scope:
- Video Link Agent P2P console update for desktop app and hosted web console.
- Added a manual "房间观看端" refresh card to the P2P push panel.
- The refresh button parses the current P2P full link and queries that link's signal domain at `/api/rooms/{room}/status`.
- Counts only fresh `viewer` peers from the current room using a 45 second freshness window.
- Renamed the existing current-page peer count to "本页连接" so it is not confused with room-wide watchers.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `Invoke-RestMethod https://p2p.cityulive.com/api/rooms/robot/status`
- `Invoke-RestMethod https://p2p-gz.dlcourse.online/api/rooms/robot/status`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public admin token check passed for `https://console.cityulive.com/api/access?access_token=xhfang`.
- Public user token check passed for `https://console.cityulive.com/api/access?access_token=cmc5006`.
- Public health check passed for `https://console.cityulive.com/api/health?access_token=xhfang`.
- Deployed JS contains `房间观看端`, `手动刷新后显示当前房间观看人数`, and `本页连接`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No go2rtc legacy video service, Tencent Cloud Live behavior, control broker, Tank Trouble service, public port, domain, or cloud video protocol changed.

## 2026-05-29 13:24 - P2P console full watch-link input

Scope:
- Video Link Agent P2P console update for desktop app and hosted web console.
- Replaced the P2P room-only input with a full watch-link input.
- Default P2P link is `https://p2p.cityulive.com/watch.html?room=robot`.
- Browser P2P push now parses signal domain and room from the link.
- P2P viewer dialog now asks for a full link and defaults to the current push link.
- Desktop local-script P2P start now sends `watch_url` to the backend, and the backend writes both `signalBaseUrl` and `roomId` into the standalone pusher config.
- Web deploy script defaults to fixed tokens `xhfang` / `cmc5006`.

Files:
- `backend/p2p_local_pusher.py`
- `backend/main.py`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `scripts/deploy_web_console.py`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\p2p_local_pusher.py backend\main.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public admin token check passed for `https://console.cityulive.com/api/access?access_token=xhfang`.
- Public user token check passed for `https://console.cityulive.com/api/access?access_token=cmc5006`.
- Public health check passed for `https://console.cityulive.com/api/health?access_token=xhfang`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Redeployed hosted web console to `150.109.100.30`.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No go2rtc legacy video service, Tencent Cloud Live behavior, control broker, Tank Trouble service, public port, domain, or cloud video protocol changed.

## 2026-05-29 12:59 - Standalone P2P start guard for existing background processes

Scope:
- Video Link Agent standalone local P2P pusher update.
- `start_local` now refuses to start when existing pusher background process(es) are detected.
- The existing-process guard runs before printing requested config, avoiding confusion when a user changed config but an old process is still running.
- The prompt now lists existing PID(s), says no new push was started, and instructs users to run `stop_local` before `start_local`.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `$env:P2P_NO_PAUSE='1'; cmd /c E:\wsl\p2p-local-pusher\start_local.cmd`
- Verified existing background processes block startup and no new pusher starts.

Runtime / deployment:
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.
- No cloud service restart.
- No public port/domain change.
- No EXE rebuild.
- No hosted web console deployment.

## 2026-05-29 12:22 - Standalone P2P pusher fallback output alignment

Scope:
- Video Link Agent standalone local P2P pusher update.
- Automatic fallback now tries same-resolution lower-FPS profiles before larger resolutions.
- After fallback, actual capture, WebRTC encoding output, and browser viewing all use the same selected mode.
- `config/pusher.config.json` keeps the user-requested preferred target for the next start; runtime files record the active fallback mode.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\supervisor.py E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `$env:P2P_NO_PAUSE='1'; cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd; cmd /c E:\wsl\p2p-local-pusher\start_local.cmd`
- Verified fallback from requested `640x480 @ 60 fps` to active `640x480 @ 30 fps`.

Runtime / deployment:
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.
- No cloud service restart.
- No public port/domain change.
- No EXE rebuild.
- No hosted web console deployment.

## 2026-05-29 11:39 - Guangzhou P2P dlcourse.online public entry

Scope:
- Video Link Agent Guangzhou P2P public-entry update.
- Added `p2p-gz.dlcourse.online` as the working Guangzhou P2P HTTPS entry.
- Issued a Let's Encrypt certificate and added an Nginx host config for the new domain.
- Switched Guangzhou P2P ICE/TURN config to `p2p-gz.dlcourse.online`.

Files / external paths:
- External `E:\Desktop\123\webrtc-p2p-video\config.guangzhou.json`
- Remote `111.230.62.106:/etc/nginx/conf.d/webrtc-p2p-video-gz-dlcourse.conf`
- Remote `111.230.62.106:/etc/letsencrypt/live/p2p-gz.dlcourse.online/fullchain.pem`
- Remote `111.230.62.106:/etc/letsencrypt/live/p2p-gz.dlcourse.online/privkey.pem`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/config.json`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `Resolve-DnsName p2p-gz.dlcourse.online -Type A` returned `111.230.62.106`.
- `Test-NetConnection p2p-gz.dlcourse.online -Port 80`, `443`, and `3478` succeeded.
- Remote `nginx -t` passed.
- Public `https://p2p-gz.dlcourse.online/api/config` returned STUN + TURN.
- Public `https://p2p-gz.dlcourse.online/watch.html?room=robot` returned `200 OK`.
- Public HTTP watch URL returned `301` to HTTPS.
- Existing Guangzhou services remained active.

Runtime / deployment:
- Cloud restart: only `webrtc-p2p-video-gz.service`.
- Nginx reload: yes.
- No coturn config change or coturn restart.
- No EXE rebuild.
- No hosted web console deployment.

## 2026-05-29 10:50 - Guangzhou P2P TURN fallback sync

Scope:
- Video Link Agent Guangzhou P2P signaling config update.
- Synced Guangzhou `webrtc-p2p-video-gz` with TURN fallback.
- Added Guangzhou-local STUN/TURN entries using `p2p-gz.cityulive.com:3478`.
- Restarted only `webrtc-p2p-video-gz.service`.

Files / external paths:
- External `E:\Desktop\123\webrtc-p2p-video\config.guangzhou.json`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/config.json`
- Remote backup `111.230.62.106:/opt/webrtc-p2p-video-gz/config.json.bak-before-turn-*`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m json.tool E:\Desktop\123\webrtc-p2p-video\config.guangzhou.json`
- Remote `python3 -m json.tool /opt/webrtc-p2p-video-gz/config.json`
- Remote `curl -fsS http://127.0.0.1:8099/api/config` returned STUN + TURN.
- Server-local HTTPS Host-header check returned STUN + TURN through Nginx.
- `Test-NetConnection p2p-gz.cityulive.com -Port 3478` succeeded for TCP.
- Existing Guangzhou services remained active.

Runtime / deployment:
- Cloud restart: only `webrtc-p2p-video-gz.service`.
- No coturn config change or coturn restart.
- No EXE rebuild.
- No hosted web console deployment.
- Public caveat: external HTTP returned Tencent DNSPod `webblock.html`, and external HTTPS handshakes were reset. Guangzhou domain access likely needs domain/ICP/access-block resolution before public browser viewing is reliable.

## 2026-05-29 10:28 - P2P TURN fallback for remote viewing

Scope:
- Video Link Agent Hong Kong P2P signaling config update.
- Fixed remote-city P2P viewing failures caused by `/api/config` returning only STUN.
- Added existing coturn relay entries to P2P `iceServers`.
- Restarted only `webrtc-p2p-video.service`.
- Restarted the local standalone P2P pusher once so it loaded the new TURN config.

Files / external paths:
- External `E:\Desktop\123\webrtc-p2p-video\config.json`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/config.json`
- Remote backup `150.109.100.30:/opt/webrtc-p2p-video/config.json.bak-before-turn-*`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m json.tool E:\Desktop\123\webrtc-p2p-video\config.json`
- Remote `python3 -m json.tool /opt/webrtc-p2p-video/config.json`
- Public `https://p2p.cityulive.com/api/config` returned STUN + TURN.
- `Test-NetConnection p2p.cityulive.com -Port 3478` succeeded for TCP.
- Existing services remained active: `webrtc-p2p-video`, `coturn`, `nginx`, `go2rtc-control-signaling`, `go2rtc-cloud`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`, `cloud-service-console-web`.
- Local pusher log showed `Loaded signal config: 2 ICE server(s)`.

Runtime / deployment:
- Cloud restart: only `webrtc-p2p-video.service`.
- No EXE rebuild.
- No hosted web console deployment.
- No coturn config change or coturn restart.
- No GitHub push or tag update.

## 2026-05-29 10:05 - P2P local pusher H.264 crash fix

Scope:
- Video Link Agent standalone P2P local pusher stability fix.
- Fixed repeated camera on/off cycling caused by the Windows pusher child crashing with access violation in PyAV/libx264 H.264 encoding.
- Added a process-wide H.264 encode lock to serialize concurrent viewer sender encoding.
- Increased supervisor stable-runtime threshold from `20s` to `60s`.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- External archive `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`
- Observed over one minute with two connected viewers; no supervisor restart, empty `pusher.err.log`, continuous sender stats.

Runtime / deployment:
- Local standalone P2P test pusher was restarted and left running in room `robot`.
- No EXE rebuild.
- No hosted web console deployment.
- No cloud service restart.
- No GitHub push or tag update.

## 2026-05-29 09:47 - P2P local pusher setup defaults

Scope:
- Video Link Agent standalone P2P local pusher default-profile update.
- Changed fresh `setup_local` defaults in `E:\wsl\p2p-local-pusher` to software `h264`, `1920x1080`, and `30fps`.
- Updated the current config to the same default profile.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip` from a clean staging copy.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External archive `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\setup_local.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- `python E:\wsl\p2p-local-pusher\scripts\setup_local.py --skip-pip`
- Confirmed config values: `preferredEncoder=h264`, `width=1920`, `height=1080`, `fps=30`.

Runtime / deployment:
- No EXE rebuild.
- No hosted web console deployment.
- No cloud service restart.
- No GitHub push or tag update.

## 2026-05-29 09:20 - Guangzhou P2P signaling test service

Scope:
- Video Link Agent cloud-side P2P test deployment.
- Deployed an isolated P2P WebRTC signaling service to Guangzhou server `111.230.62.106`.
- Added `/opt/webrtc-p2p-video-gz`, `webrtc-p2p-video-gz.service`, and Nginx host config for `p2p-gz.cityulive.com`.
- The service listens only on `127.0.0.1:8099`; public access currently goes through HTTP port `80` with host `p2p-gz.cityulive.com`.
- Did not change legacy go2rtc video, Tencent Cloud Live, control signaling, Tank Trouble, hosted console, or shared `18081` routing.

Files / external paths:
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz`
- Remote `111.230.62.106:/etc/systemd/system/webrtc-p2p-video-gz.service`
- Remote `111.230.62.106:/etc/nginx/conf.d/webrtc-p2p-video-gz.conf`
- Local `E:\Desktop\123\webrtc-p2p-video-gz-deploy.tar.gz`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`

Validation:
- `systemctl is-active webrtc-p2p-video-gz.service` returned `active`.
- Remote `curl -fsS http://127.0.0.1:8099/api/config` returned `ok: true`.
- Public Host-header check `curl.exe -fsS -H "Host: p2p-gz.cityulive.com" http://111.230.62.106/api/config` returned `ok: true`.
- Public Host-header check `curl.exe -I -H "Host: p2p-gz.cityulive.com" http://111.230.62.106/watch.html?room=robot` returned `200 OK`.
- Existing `http://111.230.62.106:18086/health` returned Tank Trouble health JSON.
- Existing `http://111.230.62.106:18081/` returned `200 OK`.
- Existing services checked as `active`: `nginx`, `cloud-service-console-tank-trouble`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`.

Build / deployment:
- No EXE rebuild.
- No hosted web console deployment.
- No GitHub push or tag update.

Cloud deployment note:
- Add DNS: `p2p-gz.cityulive.com A 111.230.62.106`.
- HTTPS is not enabled yet; TCP `443` is currently not reachable on the Guangzhou server.

HTTPS follow-up at 2026-05-29 09:38:
- DNS resolved and TCP `443` was opened.
- Installed `certbot` on Guangzhou server.
- Issued Let's Encrypt certificate for `p2p-gz.cityulive.com`, expiring `2026-08-27`.
- Updated only `/etc/nginx/conf.d/webrtc-p2p-video-gz.conf` so HTTP redirects to HTTPS and HTTPS proxies to `127.0.0.1:8099`.
- Public `https://p2p-gz.cityulive.com/api/config` returned `ok: true`.
- Public `http://p2p-gz.cityulive.com/watch.html?room=robot` returned `301` to HTTPS.
- Public `https://p2p-gz.cityulive.com/watch.html?room=robot` returned `200 OK`.
- Existing services remained `active`: `webrtc-p2p-video-gz`, `nginx`, `cloud-service-console-tank-trouble`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`.

## 2026-05-29 02:50 - P2P local pusher supervisor stability fix

Scope:
- Video Link Agent standalone P2P local pusher stability fix.
- Added a background supervisor for `E:\wsl\p2p-local-pusher`, so `start_local` launches a supervised pusher and can return while the push keeps running.
- The supervisor records child exits, keeps separate supervisor/child PID files, and tries safer encoder/profile fallbacks when the pusher dies shortly after startup.
- Added stronger pusher diagnostics with process-start/normal-exit/error logs, traceback output, and `faulthandler`.
- `stop_local` now cleans stale supervisor/pusher processes from this script project.
- Aligned config mirror fields with the user section and refreshed the clean zip package without runtime logs, venv, or cache files.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\scripts\stop_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\supervisor.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\stop_local.py`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`
- Observed supervised pusher for 35 seconds with connected viewer stats still increasing around `1.5 Mbps`.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- Confirmed no `p2p-local-pusher` supervisor/pusher process remained after stop.
- `tar -tf E:\Desktop\123\p2p-local-pusher.zip`

Build / deployment:
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.
- No EXE rebuild.
- No hosted web console deployment.
- No cloud service restart.

Cloud deployment note:
- No P2P signaling service, go2rtc legacy service, Tencent status API, control signal service, Tank Trouble service, public port, or Nginx config changed.

## 2026-05-29 02:00 - P2P repeated viewer-ready black-screen fix

Scope:
- Video Link Agent standalone P2P pusher fix.
- Root cause found: the public watch page repeatedly sent `viewer-ready`, causing the pusher to create repeated offers for the same viewer. The watch page then recreated its PeerConnection before RTP arrived, producing a live but muted track with zero received packets and a black video surface.
- Added pusher-side duplicate `viewer-ready` suppression for 12 seconds after a recent offer to the same viewer, so existing public watch pages can connect without requiring an immediate server page deployment.
- Kept local P2P watch-page debug/guard edits for next deployment.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\Desktop\123\webrtc-p2p-video\public\watch.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\style.css`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`
- Minimal Chrome WebRTC receiver decoded current room `robot` at `1920x1080` with `framesDecoded=960`.
- Current public `https://p2p.cityulive.com/watch.html?room=robot` reached `readyState=4`, `videoWidth=1920`, `videoHeight=1080`, `muted=false`, and about `5.08 Mbps`.

Build / deployment:
- No EXE rebuild.
- No hosted web console deployment.
- No cloud service restart; attempted P2P static-page sync was blocked by SSH password authentication failure.

Cloud deployment note:
- No P2P signaling service, go2rtc legacy service, Tencent status API, control signal service, Tank Trouble service, public port, or Nginx config changed.

## 2026-05-29 01:26 - P2P H264 and ICE black-screen fix

Scope:
- Video Link Agent standalone P2P pusher fix.
- Buffered browser ICE candidates until the viewer answer is applied, avoiding early-candidate `remote_password` failures in `aioice`.
- Matched H.264 encoder level and SDP `profile-level-id` to the configured output size/FPS, so `1920x1080 @ 60 fps` is no longer signaled as level 3.1.
- Added sender stats logging for connected viewers: packets, bytes, delta packets, and bitrate.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`
- Clean room `robot-fix-1779988751` connected and logged increasing sender stats.
- Restored room to `robot`; current viewer reached `connected` and sender stats increased around `0.8-1.7 Mbps`.

Build / deployment:
- No EXE rebuild and no hosted web console deployment.
- No cloud service restart.

Cloud deployment note:
- No P2P signaling service, go2rtc legacy service, Tencent status API, control signal service, Tank Trouble service, public port, or Nginx config changed.

## 2026-05-29 00:50 - P2P pusher restart and viewer reconnect fix

Scope:
- Video Link Agent standalone P2P pusher and watch page fix.
- Fixed stale runtime state causing `start_local` to report success from an old `pusher.state.json`.
- Moved runtime state writing until after `pusher-online` succeeds, so failed room claims no longer overwrite the peer id used by `stop_local`.
- Added retry while the room is still releasing a previous pusher.
- Added viewer offer retry/rebuild behavior when a viewer keeps sending `viewer-ready` but never answers.
- Updated watch page offer error handling so failed offers are retried instead of silently skipped.
- `read_config()` now accepts UTF-8 files with BOM.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Remote `/opt/webrtc-p2p-video/public/shared.js`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\stop_local.py E:\wsl\p2p-local-pusher\scripts\common.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Deployed updated watch JS and restarted only `webrtc-p2p-video.service`.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` and `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`.
- New public watch page opened with cache-busting query; pusher log showed `Viewer answered` and `connection state: connected`.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.
- Updated `/opt/webrtc-p2p-video/public/shared.js` and restarted only `webrtc-p2p-video.service`.

Cloud deployment note:
- Public P2P entry, port, Nginx config, and certificate did not change.
- No go2rtc legacy video service, Tencent status API, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-29 00:20 - P2P viewer first-frame signaling cleanup

Scope:
- Video Link Agent P2P signaling and standalone local pusher fix.
- Filtered stale P2P `viewer-ready` messages so old watch pages no longer make the pusher send offers to dead viewers before the current viewer.
- Reduced P2P long-poll timeout from 25 seconds to 5 seconds.
- Added transient signaling pruning: normal messages keep about 20 seconds; `viewer-ready` to pusher keeps about 8 seconds.
- Updated the standalone P2P local pusher to ignore stale `viewer-ready` messages and use the shorter poll timeout with old configs.

Files / external paths:
- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- External `E:\Desktop\123\webrtc-p2p-video\config.json`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- Remote `/opt/webrtc-p2p-video`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `node --check E:\Desktop\123\webrtc-p2p-video\server.js`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\common.py`
- Local and public remote smoke tests confirmed a 10-second-old `viewer-ready` is filtered while a fresh viewer reaches the pusher.
- Remote `python3 -m py_compile /opt/webrtc-p2p-video/server.py` passed.
- Remote `systemctl is-active webrtc-p2p-video.service` returned `active`.
- `curl.exe -fsS https://p2p.cityulive.com/api/rooms/robot/status` returned `ok: true`.

Build / deployment:
- Deployed `/opt/webrtc-p2p-video` and restarted only `webrtc-p2p-video.service`.
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- Public P2P entry, port, Nginx config, and certificate did not change.
- No go2rtc legacy video service, Tencent status API, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 23:54 - Windows P2P full-screen capture scaling

Scope:
- Video Link Agent standalone pusher screen-capture fix.
- Config `width` / `height` now mean final output resolution, not the top-left screen capture rectangle.
- Windows screen mode captures the full virtual desktop using Windows system metrics, then scales/stretches frames to the configured output size before H.264 encoding.
- No aspect-ratio preservation or letterboxing is applied, matching the requested adaptive stretch behavior.
- Startup status now reports both actual capture size and output size.
- Fixed `profile_payload()` so runtime state no longer writes `profile: null`.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1` started Windows screen push successfully.
- Startup output reported `Capture: 2560x1440` and `Output: 1920x1080 @ 60 fps`.
- Encoder selected `h264_amf`; err log was empty.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1` stopped the test pusher.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 23:33 - Windows P2P hidden background process

Scope:
- Video Link Agent standalone pusher Windows behavior fix.
- Fixed `start_local.cmd` opening a second empty terminal window for the background pusher process.
- `start_local.py` now creates the Windows background pusher process with no-window process creation and hidden startup info.
- The foreground `start_local.cmd` result window still remains visible for success/failure output.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1` started Windows screen push successfully.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1` stopped the test pusher.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 23:26 - Windows P2P CMD visibility and screen format guard

Scope:
- Video Link Agent standalone pusher Windows fix.
- Windows `.cmd` entry scripts now pause when launched by double-click so output/errors remain visible.
- Added cross-OS screen input/format guards so Windows does not reuse Linux `x11grab`, and Linux does not reuse Windows `desktop`.
- Refreshed Windows config via setup; screen capture now uses `desktop + gdigrab`.
- Verified Windows screen push starts successfully with `screenCaptureEnabled = true`, `1920x1080 @ 60 fps`, and `h264_amf`.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\setup_local.cmd`
- External `E:\wsl\p2p-local-pusher\start_local.cmd`
- External `E:\wsl\p2p-local-pusher\stop_local.cmd`
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `cmd /c E:\wsl\p2p-local-pusher\setup_local.cmd --skip-pip`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1` started Windows screen push successfully.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1` stopped the test pusher.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 23:18 - Standalone P2P user-friendly screen toggle

Scope:
- Video Link Agent standalone pusher config cleanup.
- Replaced user-facing `user.sourceMode` with `user.screenCaptureEnabled`.
- `screenCaptureEnabled: false` means camera push; `true` means screen capture push.
- Kept `sourceMode` internally/backward-compatible so older configs still work.
- Updated start output to show `Screen capture: enabled/disabled`.
- Preserved the user's current `1920x1080 @ 60 fps` and bitrate/encoder settings.
- Updated the standalone pusher README with the boolean switch.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External `E:\wsl\p2p-local-pusher\docs\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/common.py scripts/start_local.py scripts/pusher.py scripts/setup_local.py && python3 - <<'PY' ..."`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` started screen push successfully with `user.screenCaptureEnabled = true`.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash stop_local.sh"` stopped the test pusher.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 23:02 - WSL P2P screen input auto detection

Scope:
- Video Link Agent standalone pusher usability update.
- Screen mode now works with only `user.sourceMode = screen`; `user.screenInput` can stay empty.
- Linux/WSL screen input detection now tries `$DISPLAY`, `/tmp/.X11-unix/X*`, and `/mnt/wslg/.X11-unix/X*`.
- The local WSL test config was changed to leave `screenInput` empty while still using `sourceMode = screen`.
- Rewrote the standalone pusher README in readable Chinese and documented the simpler screen-mode usage.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External `E:\wsl\p2p-local-pusher\docs\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/common.py scripts/start_local.py scripts/pusher.py scripts/setup_local.py && python3 - <<'PY' ..."`
- Auto-detection returned `:0` with empty `user.screenInput`.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` started screen push successfully.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash stop_local.sh"` stopped the test pusher.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 22:54 - WSL P2P screen capture dependency install

Scope:
- Video Link Agent WSL standalone pusher setup.
- Installed WSL packages `ffmpeg` and `v4l-utils`.
- Verified WSLg/X11 screen capture works from `:0` with FFmpeg `x11grab`.
- Updated `start_local.py` so Linux/WSL screen mode injects `DISPLAY` from `user.screenInput` when the shell environment lacks `DISPLAY`.
- Switched the local WSL test config to `user.sourceMode = screen` and `user.screenInput = :0`.
- Started a real P2P screen push once, then stopped it.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `wsl -e bash -lc "command -v ffmpeg; ffmpeg -version | head -n 1; command -v v4l2-ctl; v4l2-ctl --version | head -n 1"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash setup_local.sh --skip-pip"`
- `wsl -e bash -lc "DISPLAY=:0 ffmpeg -hide_banner -f x11grab -video_size 640x480 -framerate 15 -i :0 -t 2 -f null -"`
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/start_local.py && DISPLAY=:0 ffmpeg -hide_banner -loglevel error -f x11grab -video_size 640x480 -framerate 15 -i :0 -t 1 -f null - && echo screen-capture-ok"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` started a background P2P screen pusher in room `robot`.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash stop_local.sh"` stopped the test pusher.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 22:35 - Standalone P2P screen source mode

Scope:
- Video Link Agent standalone pusher update.
- Added `user.sourceMode` to `E:\wsl\p2p-local-pusher`; `camera` remains default, `screen` pushes display content.
- Added `user.screenInput` and internal `screen` defaults for Windows `gdigrab desktop` and Linux/WSL `x11grab`.
- Start output and runtime state now show whether the active source is camera or screen.
- `start_local` skips the Linux camera requirement when `sourceMode` is `screen` and reports a clear missing-screen-input message when needed.
- Rewrote the standalone pusher README in readable Chinese.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External `E:\wsl\p2p-local-pusher\docs\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/common.py scripts/pusher.py scripts/start_local.py scripts/setup_local.py"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` returned the intended default camera-mode no-Linux-camera message.
- Verified Linux/WSL screen-mode config maps to `x11grab` and preserves `screenInput`.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash setup_local.sh --skip-pip"` regenerated config with `user.sourceMode` and `screen` fields.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 21:58 - WSL P2P Windows camera guard

Scope:
- Video Link Agent local WSL standalone pusher fix.
- Updated `E:\wsl\p2p-local-pusher` so Linux/WSL no longer reuses Windows DirectShow camera inputs such as `video=UGREEN Camera 4K`.
- Linux profile building now uses real `/dev/video*` devices only and reports a clear WSL/no-camera message when none exist.
- `start_local` now truncates pusher logs per run, avoiding stale success logs mixed with current failures.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/common.py scripts/pusher.py scripts/start_local.py"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash setup_local.sh --skip-pip"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` returned the intended clear failure because current WSL has no `/dev/video*`.

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 21:39 - WSL P2P setup venv guard

Scope:
- Video Link Agent local WSL standalone pusher setup fix.
- Updated `E:\wsl\p2p-local-pusher` so `setup_local.sh` handles Ubuntu/WSL missing `python3-venv` more clearly.
- Setup now detects `ensurepip is not available`, attempts to install `python3-venv` and `python3-pip` with `apt-get`, and rebuilds incomplete `.venv` folders where pip is missing.
- Rewrote the WSL copy README in readable Chinese and documented the manual fix command.

Files / external paths:
- External `E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- External `E:\wsl\p2p-local-pusher\docs\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- `wsl -e bash -lc "python3 -m py_compile /mnt/e/wsl/p2p-local-pusher/scripts/setup_local.py"`

Build / deployment:
- No EXE rebuild; Cloud Service Console app code was not changed.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 17:58 - Standalone P2P config user section

Scope:
- Video Link Agent standalone pusher and desktop mini app P2P local-script sync update.
- `E:\Desktop\123\p2p-local-pusher\config\pusher.config.json` now exposes a compact top-level `user` section for normal edits.
- P2P script readers now prefer `user` fields over older root / `camera` / `video` fields.
- Program-maintained camera detection, encoder probes, fallback profiles, and last selected runtime data stay below the user section.
- Desktop mini app P2P start now writes the same `user` section before calling the standalone local pusher.
- Rewrote the standalone pusher README to tell users to edit only the `user` section.

Files / external paths:
- External `E:\Desktop\123\p2p-local-pusher\config\pusher.config.json`
- External `E:\Desktop\123\p2p-local-pusher\scripts\common.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\setup_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\stop_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\docs\README.md`
- `backend/p2p_local_pusher.py`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c setup_local.cmd --skip-pip`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\common.py E:\Desktop\123\p2p-local-pusher\scripts\setup_local.py E:\Desktop\123\p2p-local-pusher\scripts\start_local.py E:\Desktop\123\p2p-local-pusher\scripts\stop_local.py E:\Desktop\123\p2p-local-pusher\scripts\pusher.py E:\Desktop\123\cloud-service-console\backend\p2p_local_pusher.py`
- Effective config smoke test confirmed `user` values override legacy fields.
- `cmd /c npm.cmd run build --prefix frontend`
- `git diff --check -- backend\p2p_local_pusher.py`
- `cmd /c npm.cmd run installer:build`

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, Tencent status API, P2P signaling service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 08:24 - Desktop P2P push switched to local script mode

Scope:
- Video Link Agent desktop mini app update.
- Desktop P2P push now calls the standalone local pusher at `E:\Desktop\123\p2p-local-pusher` through new local backend APIs.
- Hosted web console P2P remains browser-based and cannot start the server-side local script.
- The P2P panel now shows local script process/profile/watch URL in desktop mode; browser preview remains only for web mode.
- Desktop P2P uses the current camera, resolution, frame rate, bitrate, encoder, and room settings from the local-stream form.
- Added `hevc_nvenc` to encoder options and left encoder selection usable for desktop P2P script mode.

Files:
- `backend/p2p_local_pusher.py`
- `backend/models.py`
- `backend/main.py`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\p2p_local_pusher.py backend\models.py backend\main.py`
- `cmd /c npm.cmd run build --prefix frontend`
- Local manager smoke test detected `E:\Desktop\123\p2p-local-pusher` and returned `https://p2p.cityulive.com/watch.html?room=robot`.
- `git diff --check -- backend\main.py backend\models.py backend\p2p_local_pusher.py frontend\src\api\cloudApi.ts frontend\src\types\cloud.ts frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css frontend\src\styles\theme.css`
- `cmd /c npm.cmd run installer:build`

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.

Cloud deployment note:
- No cloud service was deployed or restarted.
- No public port, cloud service name, go2rtc service, control signal service, Tank Trouble service, or hosted web console service changed.

## 2026-05-28 07:54 - Standalone P2P start output and config guidance

Scope:
- Improved `E:\Desktop\123\p2p-local-pusher\start_local` terminal output.
- `start_local` now prints requested signal server, room, watch URL, camera, input, capture size/FPS, bitrate, encoder preference, fallback chain, runtime-probed encoders, FFmpeg path, and config path before starting.
- After online state, `start_local` prints the actual selected room, watch URL, camera, output size/FPS, bitrate, and encoder.
- Rewrote standalone pusher README in readable Chinese and documented which config fields are safe to edit manually.

Files / external paths:
- External `E:\Desktop\123\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher\docs\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\start_local.py`
- `E:\Desktop\123\p2p-local-pusher\start_local.cmd`
- `E:\Desktop\123\p2p-local-pusher\stop_local.cmd`
- Verified terminal output includes `https://p2p.cityulive.com/watch.html?room=robot` and actual encoder `h264_amf`.
- Confirmed no leftover `p2p-local-pusher` Python process after validation.

Runtime/cloud impact:
- No Cloud Service Console app/runtime code changed.
- No cloud runtime, public port, Nginx rule, go2rtc service, Tencent Cloud status API, control signal, or Tank Trouble change.

## 2026-05-28 01:03 - Standalone cross-platform P2P local pusher

Scope:
- Added a new standalone P2P local camera pusher at `E:\Desktop\123\p2p-local-pusher`.
- Top-level user scripts are only `setup_local`, `start_local`, and `stop_local` for Windows and Linux/macOS.
- `setup_local` creates a local Python venv, installs `aiortc`/`av`, enumerates cameras, probes encoder runtime availability, and writes `config\pusher.config.json`.
- `start_local` runs the pusher in the background so the terminal can be closed.
- `stop_local` stops the background process and sends `pusher-offline` when possible.
- Config defaults to `https://p2p.cityulive.com` room `robot` and includes camera, resolution, FPS, bitrate, room, and encoder fallback settings.

Files / external paths:
- External `E:\Desktop\123\p2p-local-pusher\setup_local.cmd`
- External `E:\Desktop\123\p2p-local-pusher\start_local.cmd`
- External `E:\Desktop\123\p2p-local-pusher\stop_local.cmd`
- External `E:\Desktop\123\p2p-local-pusher\setup_local.sh`
- External `E:\Desktop\123\p2p-local-pusher\start_local.sh`
- External `E:\Desktop\123\p2p-local-pusher\stop_local.sh`
- External `E:\Desktop\123\p2p-local-pusher\scripts\common.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\setup_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\stop_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\docs\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\common.py E:\Desktop\123\p2p-local-pusher\scripts\setup_local.py E:\Desktop\123\p2p-local-pusher\scripts\start_local.py E:\Desktop\123\p2p-local-pusher\scripts\stop_local.py E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- `E:\Desktop\123\p2p-local-pusher\setup_local.cmd --skip-pip`
- `E:\Desktop\123\p2p-local-pusher\setup_local.cmd`
- `E:\Desktop\123\p2p-local-pusher\start_local.cmd`
- `E:\Desktop\123\p2p-local-pusher\stop_local.cmd`
- Windows validation detected `UGREEN Camera 4K`, skipped unavailable NVENC at runtime, selected working `h264_amf`, reached online state, and stopped cleanly.

Runtime/cloud impact:
- No Cloud Service Console frontend/backend code changed.
- No cloud runtime, public port, Nginx rule, go2rtc service, Tencent Cloud status API, control signal, or Tank Trouble change.
- The script uses the existing P2P signaling service at `https://p2p.cityulive.com`.

## 2026-05-28 00:03 - Viewer address confirmation dialogs

Scope:
- Changed Tencent Cloud `网页端观看` to open the play-address dialog first instead of directly opening the player page.
- Tencent Cloud play dialog defaults to current status play URL, saved play URL, or derived `webrtc://.../live/robot_control` fallback.
- Added a P2P viewer room dialog before opening `网页端观看`.
- P2P viewer dialog defaults to the current P2P push room and can enter another room to watch another P2P stream.
- P2P viewer-room selection does not overwrite the push-room field.

Files / deployed paths:
- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Remote `/opt/cloud-service-console-web/frontend/dist`
- `E:\Cloud-Service-Console\Cloud Service Console.exe`
- `E:\Cloud-Service-Console\cloud-console-backend.exe`
- `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`

Validation:
- `cmd /c npm.cmd run build --prefix frontend`
- Hosted console static sync confirmed `cloud-service-console-web.service`, `webrtc-p2p-video.service`, and `nginx` were `active`.
- Public console asset check confirmed `P2P 观看房间`, `腾讯云播放地址`, and `进入房间` are present.
- `python scripts\build_installer.py`

Runtime/cloud impact:
- Static console frontend was replaced under `/opt/cloud-service-console-web/frontend/dist`; web console service stayed active.
- No P2P signaling service code, legacy go2rtc video, Tencent status API, control signal, or Tank Trouble change.
- Desktop EXE and sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.

## 2026-05-27 23:44 - P2P room lock and video-only viewer

Scope:
- Added room ownership to the P2P signaling service: one room can have only one active pusher.
- A second same-room pusher now receives `HTTP 409`; a different room can still host a separate P2P stream.
- P2P pushers now heartbeat and send `pusher-offline` on stop; abnormal close is released after `pusherTtlSeconds` (`15` seconds by default).
- Added an editable/saved P2P room field in the console P2P panel; both push and web viewer use that room.
- Changed the P2P watch page to a video-only page that auto-starts viewer mode and renders only the remote video surface.

Files / deployed paths:
- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- External `E:\Desktop\123\webrtc-p2p-video\config.json`
- External `E:\Desktop\123\webrtc-p2p-video\public\watch.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\style.css`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Remote `/opt/webrtc-p2p-video`
- Remote `/opt/cloud-service-console-web/frontend/dist`
- `E:\Cloud-Service-Console\Cloud Service Console.exe`
- `E:\Cloud-Service-Console\cloud-console-backend.exe`
- `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`

Validation:
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\server.js`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `cmd /c npm.cmd run build --prefix frontend`
- Public room-lock smoke: first pusher returned `200`, second same-room pusher returned `409`, `pusher-offline` released the room, and the next pusher returned `200`.
- Public watch page check confirmed `video-only-page` and `remote-video` are present and old viewer UI text is absent.
- Remote `webrtc-p2p-video.service`, `cloud-service-console-web.service`, and `nginx` returned `active`.
- `python scripts\build_installer.py`

Runtime/cloud impact:
- Restarted only `webrtc-p2p-video.service`.
- Static console frontend was replaced under `/opt/cloud-service-console-web/frontend/dist`; web console service stayed active.
- No legacy go2rtc video, Tencent Cloud status API, control signal, or Tank Trouble change.
- Desktop EXE and sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.

## 2026-05-27 23:08 - Inline console P2P push

Scope:
- Replaced the previous external-page P2P push button with an inline local-stream P2P push panel.
- Added local preview, status lamp, `开始P2P推流` / `停止P2P推流`, viewer count, room signal reset, and `网页端观看`.
- P2P uses `https://p2p.cityulive.com` room `robot` and browser WebRTC peer connections; media remains peer-to-peer.
- P2P applies camera, capture/output resolution, capture/target FPS, and video bitrate from the local-stream parameter area.
- Legacy-only fields are greyed out while P2P/Tencent panels are active, and Tencent/P2P push are mutually exclusive because they share the local camera.
- Synced hosted web console static frontend and rebuilt/copied the desktop mini app package.

Files / deployed paths:
- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `frontend\src\styles\theme.css`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- Remote `/opt/cloud-service-console-web/frontend/dist`
- `E:\Cloud-Service-Console\Cloud Service Console.exe`
- `E:\Cloud-Service-Console\cloud-console-backend.exe`
- `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`

Validation:
- `cmd /c npm.cmd run build --prefix frontend`
- `curl.exe -fsS https://p2p.cityulive.com/api/config`
- Public console asset check confirmed inline P2P push strings and `https://p2p.cityulive.com` are present, and `腾讯云推流 (BETA)` is absent.
- `python scripts\build_installer.py`
- Remote `cloud-service-console-web.service` and `webrtc-p2p-video.service` returned `active`.

Runtime/cloud impact:
- Static frontend only was replaced under `/opt/cloud-service-console-web/frontend/dist`; backend env/tokens were not regenerated.
- No go2rtc legacy video, Tencent status API, control signal, Tank Trouble, or P2P signaling service restart/change.
- Desktop EXE and sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.

## 2026-05-27 22:02 - Console P2P push entry

Scope:
- Integrated the public P2P WebRTC pusher into the local-stream UI.
- Added `P2P推流 (BETA)` immediately after `腾讯云推流`, opening `https://p2p.cityulive.com/push.html?room=robot`.
- Removed `(BETA)` from Tencent Cloud push button/panel naming.
- Updated web-mode copy to show Tencent Cloud and P2P as supported web push paths.
- Synced hosted web console static frontend and rebuilt/copied the desktop mini app package.

Files / deployed paths:
- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- Remote `/opt/cloud-service-console-web/frontend/dist`
- `E:\Cloud-Service-Console\Cloud Service Console.exe`
- `E:\Cloud-Service-Console\cloud-console-backend.exe`
- `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`

Validation:
- `cmd /c npm.cmd run build --prefix frontend`
- `python scripts\build_installer.py`
- `curl.exe -fsS https://p2p.cityulive.com/api/config`
- Public console asset check confirmed `P2P推流 (BETA)` and `p2p.cityulive.com/push.html?room=robot` are present, and `腾讯云推流 (BETA)` is absent.

Runtime/cloud impact:
- Static frontend only was replaced under `/opt/cloud-service-console-web/frontend/dist`; `cloud-service-console-web.service` stayed active.
- No backend token/config regeneration, no go2rtc legacy video, Tencent status API, control signal, Tank Trouble, or P2P signaling service change.
- Desktop EXE and sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.

## 2026-05-27 17:45 - Public P2P HTTPS deployment

Scope:
- Deployed the standalone P2P WebRTC video prototype to server `150.109.100.30`.
- Added a dependency-free Python signaling server (`server.py`) because Node.js is not installed on the server.
- Created systemd service `webrtc-p2p-video.service`.
- Added Nginx virtual host for `p2p.cityulive.com`, with HTTP redirected to HTTPS.
- Issued Let's Encrypt certificate for `p2p.cityulive.com`.
- Bound the internal signaling service to `127.0.0.1:8099`; public access goes through Nginx `443`.

Files / cloud paths:
- External local `E:\Desktop\123\webrtc-p2p-video\server.py`
- Remote `/opt/webrtc-p2p-video`
- Remote `/etc/systemd/system/webrtc-p2p-video.service`
- Remote `/etc/nginx/conf.d/webrtc-p2p-video.conf`
- Remote `/etc/letsencrypt/live/p2p.cityulive.com/fullchain.pem`
- Remote `/etc/letsencrypt/live/p2p.cityulive.com/privkey.pem`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile server.py`.
- Local Python signaling smoke test returned `ok: true` for `/api/config` and `/api/rooms/robot/status`.
- Remote `systemctl is-active webrtc-p2p-video.service` returned `active`.
- Remote `curl http://127.0.0.1:8099/api/config` returned `ok: true`.
- Public `http://p2p.cityulive.com/` returned `301` to HTTPS.
- Public `https://p2p.cityulive.com/` returned `200 OK`.
- Public `https://p2p.cityulive.com/api/config` returned `ok: true`.
- Browser smoke loaded `https://p2p.cityulive.com/watch.html?room=robot`.
- Existing services remained active: `nginx`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-srt-bridge`, `go2rtc-control-signaling`, and `go2rtc-telemetry-relay`.

Runtime/cloud impact:
- New cloud service: `webrtc-p2p-video.service`.
- New public HTTPS entry: `https://p2p.cityulive.com`.
- New Nginx config: `/etc/nginx/conf.d/webrtc-p2p-video.conf`.
- No change to existing Cloud Service Console app code, legacy go2rtc SRT path, Tencent path, control signal services, Tank Trouble services, or `console.cityulive.com`.

## 2026-05-27 16:57 - P2P background signaling launcher

Scope:
- Updated the standalone P2P WebRTC prototype `start-signaling.cmd` to launch `server.js` in the background.
- The start script now checks whether the configured port is already listening, starts Node hidden, verifies readiness, and writes logs to `logs\signaling.out.log` / `logs\signaling.err.log`.
- Updated the prototype README to explain that the startup window can be closed after the success message and `stop-signaling.cmd` should be used to stop the background server.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\start-signaling.cmd`
- External `E:\Desktop\123\webrtc-p2p-video\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- Ran `cmd /c start-signaling.cmd`; command returned while `0.0.0.0:8099` remained listening.
- `GET http://127.0.0.1:8099/api/config` returned `ok: true`.
- Ran corrected stop logic; port `8099` stopped listening.

Runtime/cloud impact:
- Local-only P2P prototype launcher behavior.
- No cloud service, existing console app, legacy go2rtc path, Tencent path, control signal, or Tank Trouble change.

## 2026-05-27 16:50 - P2P signaling startup message

Scope:
- Improved the standalone P2P WebRTC prototype signaling server startup output.
- The console now clearly says the server started successfully in Chinese and shows the next scripts to run.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `node --check server.js`

Runtime/cloud impact:
- Local-only P2P prototype console-message change.
- No cloud service, existing console app, legacy go2rtc path, Tencent path, control signal, or Tank Trouble change.

## 2026-05-27 16:47 - P2P stop script PID variable fix

Scope:
- Fixed `stop-signaling.cmd` in the standalone P2P WebRTC prototype.
- Renamed the PowerShell loop variable from `$pid` to `$processId` because `$PID` is a built-in read-only PowerShell variable.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\stop-signaling.cmd`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- Ran the corrected stop logic against port `8099`; it stopped the existing signaling server process.

Runtime/cloud impact:
- Local-only P2P helper script fix.
- No cloud service, existing console app, legacy go2rtc path, Tencent path, control signal, or Tank Trouble change.

## 2026-05-27 16:40 - P2P prototype stop script

Scope:
- Added a Windows stop script for the standalone P2P WebRTC prototype.
- The script reads the configured signaling port from `config.json`, finds the listening process, and stops it.
- Updated the prototype README usage instructions.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\stop-signaling.cmd`
- External `E:\Desktop\123\webrtc-p2p-video\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- Manual script review.

Runtime/cloud impact:
- Local-only helper script for stopping the standalone P2P signaling server.
- No cloud service, existing console app, legacy go2rtc path, Tencent path, control signal, or Tank Trouble change.

## 2026-05-27 15:18 - Standalone P2P WebRTC video prototype

Scope:
- Added an independent true P2P WebRTC video prototype under `E:\Desktop\123\webrtc-p2p-video`.
- The prototype has a Node.js signaling server that exchanges only offer / answer / ICE messages.
- The video media path is intended to flow directly between the pusher browser and viewer browser through WebRTC; the signaling server does not ingest or relay media frames.
- Added separate pusher and viewer pages, room selection, camera/fps/resolution/bitrate controls, optional timestamp overlay, viewer stats, and Windows `.cmd` launchers.

Files:
- External `E:\Desktop\123\webrtc-p2p-video\config.json`
- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- External `E:\Desktop\123\webrtc-p2p-video\public\index.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\push.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\watch.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\style.css`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\Desktop\123\webrtc-p2p-video\start-signaling.cmd`
- External `E:\Desktop\123\webrtc-p2p-video\open-pusher.cmd`
- External `E:\Desktop\123\webrtc-p2p-video\open-viewer.cmd`
- External `E:\Desktop\123\webrtc-p2p-video\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `node --check server.js`
- `node --check public\shared.js`
- Started the signaling server locally on `0.0.0.0:8099`.
- `GET http://127.0.0.1:8099/api/config` returned `ok: true`.
- `GET http://127.0.0.1:8099/api/rooms/robot/status` returned `ok: true`.
- Verified `push.html` and `watch.html` are served with distinct pusher/viewer HTML content.
- Browser smoke loaded the local P2P index page.

Runtime/cloud impact:
- Local-only external prototype service on port `8099` when `start-signaling.cmd` is running.
- No change to existing Cloud Service Console app, go2rtc cloud video services, SRT bridge, Tencent Cloud path, control signal services, Tank Trouble services, Nginx config, public cloud ports, or deployed web console.

## 2026-05-27 11:05 - Correct 0522 portable SRT bridge refresh

Scope:
- Investigated Windows `start-local` failure where FFmpeg opened `UGREEN Camera 4K` successfully but failed to connect to `srt://150.109.100.30:19091` with `I/O error`.
- Confirmed cloud `go2rtc-srt-bridge` could be `active` and listening on UDP `19091` while SRT handshakes failed, including from `127.0.0.1` on the server.
- Restarted only `go2rtc-srt-bridge` to recover the SRT ingest listener.
- Updated the correct external 0522 portable package so Windows/Linux/macOS `start-local` refreshes an idle SRT bridge before starting local legacy push, while refusing to restart it if `main-camera` already has an active producer.

Files:
- External `go2rtc-portable-0522\go2rtc-portable\scripts\windows\start-local.ps1`
- External `go2rtc-portable-0522\go2rtc-portable\scripts\linux\start-local.sh`
- External `go2rtc-portable-0522\go2rtc-portable\scripts\macos\start-local.sh`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- Verified cloud UDP packets reached `150.109.100.30:19091`.
- Verified local and server-side SRT caller attempts failed before restarting `go2rtc-srt-bridge`.
- Restarted `go2rtc-srt-bridge` only; then FFmpeg test source successfully pushed to public SRT ingest.
- Ran correct Windows `start-local.cmd`; it succeeded and created one cloud `main-camera` producer.
- Ran `stop-local.cmd`; cloud `main-camera` producer count returned to `0`.
- Verified remote services active after cleanup: `go2rtc-srt-bridge`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `nginx`, `coturn`.
- `bash -n` passed for correct 0522 Linux/macOS `start-local.sh`.
- PowerShell parser validation passed for correct 0522 Windows `start-local.ps1`.

Runtime/cloud impact:
- Temporarily restarted only the video SRT bridge service `go2rtc-srt-bridge`.
- No control signal service, telemetry service, Nginx config, public port, cloud service name, Tank Trouble service, or hosted web console changed.

## 2026-05-25 18:19 - Hosted console Tencent status text sync

Scope:
- Synced the Tencent Cloud push status text fix to the hosted web console at `https://console.cityulive.com/`.
- Updated only the hosted frontend static bundle under `/opt/cloud-service-console-web/frontend/dist`; did not run a full backend redeploy.

Files:
- Remote `/opt/cloud-service-console-web/frontend/dist/index.html`
- Remote `/opt/cloud-service-console-web/frontend/dist/assets/index-WRBRTEao.js`
- Local `build\cloud-console-frontend-dist-fix.tar.gz`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `https://console.cityulive.com/?access_token=xhfang` references `/assets/index-WRBRTEao.js`.
- `https://console.cityulive.com/assets/index-WRBRTEao.js` returned `200`, contains the new Tencent status text, and no longer contains the affected `????` placeholders.
- Remote services remained active: `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.

Runtime/cloud impact:
- Cloud impact limited to hosted web console static frontend files.
- No go2rtc video service, SRT bridge, control signal service, telemetry service, Nginx config, public port, cloud service name, or Tank Trouble service changed.

## 2026-05-25 17:34 - Tencent Cloud push status text fix

Scope:
- Fixed the Tencent Cloud push signal card in the local streaming page so the web-local Tencent status no longer displays literal `???` placeholder text.
- Replaced the affected values/notes with clear Chinese states for pushing, restorable, occupied, and waiting.

Files:
- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `npm.cmd run build` in `frontend`.
- Text search confirmed the affected `???` placeholders are gone from `frontend\src\pages\DashboardPage.tsx`.

Runtime/cloud impact:
- Frontend video-link UI text only.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, or video protocol changed.

## 2026-05-22 17:07 - Correct 0522 go2rtc portable config fix

Scope:
- Corrected the active external pusher target to `go2rtc-portable-0522\go2rtc-portable`.
- Fixed Linux/macOS config loading so Python validation failures stop with the real config error instead of falling through to `CFG_CONFIG_PATH: unbound variable`.
- Made `sender.webrtcPreferredCodec` strict only for `transport.ingestMode = webrtc`; SRT/HTTP ingest now ignore invalid/non-applicable codec values and use `h264` internally.
- Added `_comment_*` option notes to Windows, Linux, and macOS config files in the correct 0522 portable package.
- Synchronized Windows, Linux, and macOS default config generators plus README guidance.

Files:
- External `go2rtc-portable-0522\go2rtc-portable\config\sender-cloud.windows.config.json`
- External `go2rtc-portable-0522\go2rtc-portable\config\sender-cloud.linux.config.json`
- External `go2rtc-portable-0522\go2rtc-portable\config\sender-cloud.macos.config.json`
- External `go2rtc-portable-0522\go2rtc-portable\scripts\linux\common.sh`
- External `go2rtc-portable-0522\go2rtc-portable\scripts\macos\common.sh`
- External `go2rtc-portable-0522\go2rtc-portable\scripts\common\ConfigHelpers.ps1`
- External `go2rtc-portable-0522\go2rtc-portable\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `bash -n` on all correct 0522 portable root `.sh` scripts plus `scripts\linux\*.sh` and `scripts\macos\*.sh`, 21 files total.
- JSON parse validation on correct 0522 Windows/Linux/macOS config files.
- PowerShell parser validation on correct 0522 `scripts\common\ConfigHelpers.ps1`.
- Python logic check confirmed SRT mode ignores invalid `sender.webrtcPreferredCodec`, while WebRTC mode still errors clearly.
- Python compile validation on correct 0522 Linux/macOS camera helpers.

Runtime/cloud impact:
- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.

## 2026-05-22 15:48 - External legacy go2rtc portable config option comments

Scope:
- Added `_comment_*` option notes to the latest WeChat external go2rtc portable shared config.
- Documented allowed/common values for capture format, resolution, frame rate, bitrate, viewer auto-open, delay marker, WebRTC codec, encoder override, ingest mode, and SRT timing options.
- Synchronized Windows, Linux, and macOS default config generators so newly generated configs keep the same option notes.
- Kept normal same-server switching simple: edit only `cloud.serverHost` and plaintext `cloud.sshPassword`.

Files:
- External `telebot-main-0522\telebot-main\go2rtc-portable\config\sender-cloud.config.json`
- External `telebot-main-0522\telebot-main\go2rtc-portable\common\ConfigHelpers.ps1`
- External `telebot-main-0522\telebot-main\go2rtc-portable\linux\common.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\common.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- JSON parse validation on external `config\sender-cloud.config.json`.
- `bash -n` on all external root `.sh` scripts plus external `linux\*.sh` and `macos\*.sh` scripts.
- PowerShell parser validation on external `common\ConfigHelpers.ps1`.
- Config loader validation confirmed comment fields do not affect derived stream/server settings.

Runtime/cloud impact:
- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.

## 2026-05-22 15:35 - External legacy go2rtc portable Linux NVIDIA NVENC support

Scope:
- Added Linux NVIDIA NVENC support to the latest WeChat external go2rtc portable pusher package.
- Linux `sender.videoEncoder` now supports blank auto mode, `h264_nvenc`, and `libx264`.
- Blank auto mode probes `h264_nvenc` with FFmpeg first, then falls back to CPU `libx264`.
- Forced `h264_nvenc` now fails with a clear driver/GPU/FFmpeg support message when unavailable.
- Linux FFmpeg arguments now use separate low-latency settings for NVENC and `libx264`.

Files:
- External `telebot-main-0522\telebot-main\go2rtc-portable\linux\common.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\linux\start-sender.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `bash -n` on all external root `.sh` scripts and all external `linux\*.sh` scripts, 21 files total.
- JSON parse validation on external `config\sender-cloud.config.json`.
- Search validation for Linux encoder references.

Runtime/cloud impact:
- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.
- Real NVENC runtime test still needs a Linux NVIDIA host.

## 2026-05-22 13:09 - External legacy go2rtc portable macOS support

Scope:
- Added macOS support to the latest WeChat external go2rtc portable pusher package.
- Added `macos\` scripts adapted to the 0522 package layout and the shared `config/sender-cloud.config.json`.
- Root `.sh` entry points now dispatch automatically to `linux\` or `macos\` by `uname -s`.
- Switching identical cloud servers still only requires editing `cloud.serverHost` and plaintext `cloud.sshPassword`.
- macOS sender uses AVFoundation camera detection and supports `h264_videotoolbox`, `hevc_videotoolbox`, or `libx264`.

Files:
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\*`
- External `telebot-main-0522\telebot-main\go2rtc-portable\*.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\config\sender-cloud.config.json`
- External `telebot-main-0522\telebot-main\go2rtc-portable\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `bash -n` on all external root `.sh` scripts and all external `macos\*.sh` scripts.
- `python -m py_compile` on external `macos\camera_helper.py`.
- JSON parse validation on external `config\sender-cloud.config.json`.

Runtime/cloud impact:
- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.
- macOS AVFoundation capture still needs a real Mac runtime test.

## 2026-05-22 10:52 - Legacy portable serverHost-only switching config

Scope:
- Simplified the latest WeChat external go2rtc portable pusher config so switching identical cloud servers only requires editing `cloud.serverHost` and `cloud.sshPassword`.
- Windows and Linux loaders now derive `publicHost`, `sshHost`, SRT ingest URL, WHIP URL, viewer URL, STUN URL, and TURN URLs from `cloud.serverHost`.
- Removed visible fixed cloud fields from `config/sender-cloud.config.json`.
- Added plaintext `cloud.sshPassword` lookup before falling back to the old local secrets file.

Files:
- External `telebot-main-0522\telebot-main\go2rtc-portable\config\sender-cloud.config.json`
- External `telebot-main-0522\telebot-main\go2rtc-portable\common\ConfigHelpers.ps1`
- External `telebot-main-0522\telebot-main\go2rtc-portable\setup-local.ps1`
- External `telebot-main-0522\telebot-main\go2rtc-portable\full-setup.ps1`
- External `telebot-main-0522\telebot-main\go2rtc-portable\linux\common.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\linux\setup-local.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\linux\full-setup.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- Windows `Get-SenderCloudConfig` derivation check verified generated SSH host, SRT ingest URL, viewer URL, and TURN/STUN URLs from `cloud.serverHost`.
- JSON parse validation for the portable config.
- `bash -n` validation for touched Linux shell scripts.

Runtime/cloud impact:
- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.

## 2026-05-21 19:40 - Legacy media-aware video status fix

Scope:
- Fixed cloud video status aggregation so legacy push state uses both sender heartbeat and go2rtc media activity.
- A fresh legacy sender heartbeat marks the old link active.
- If the sender heartbeat is stale but go2rtc producer bytes/packets are still increasing, the old link is also active with `liveReason: media`.
- If both heartbeat and media activity are stale for more than 60 seconds, the old link becomes stopped.
- Deployed the updated telemetry relay to `150.109.100.30` and restarted only `go2rtc-telemetry-relay`.

Files:
- `backend/cloud_setup_bundle/telemetry_relay.py`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\telemetry_relay.py`
- Cloud repeated `GET http://127.0.0.1:18081/api/video/status` samples returned `activeMode: legacy`, `legacy.live: true`, `legacy.liveReason: media`, and increasing `producerBytes` / `producerPackets`.
- Public web console API `GET https://console.cityulive.com/api/video/status?access_token=xhfang` returned `activeMode: legacy` and `legacy.liveReason: media`.
- Cloud services stayed active: `go2rtc-cloud`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`, `go2rtc-control-signaling`.

Runtime/cloud impact:
- Cloud impact: restarted only `go2rtc-telemetry-relay`.
- No EXE build, hosted web deploy, public port change, control signal change, or Tank Trouble change.

## 2026-05-21 18:10 - Legacy portable Windows AMF startup fix

Scope:
- Fixed the latest WeChat external go2rtc portable Windows sender so AMD AMF hardware encoding can be selected.
- Relaxed AMF selection when the runtime encode test passes but the periodic keyframe probe is inconclusive.
- Fixed AMD AMF FFmpeg profile from unsupported `baseline` to `constrained_baseline`.
- Fixed generated FFmpeg supervisor script corruption caused by embedding the heartbeat function in an expandable heredoc.
- Restored heartbeat startup as an outer function and added parser validation for generated launch scripts.
- Improved startup failure reporting to surface fatal FFmpeg stderr directly.

Files:
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\start-camera-push-to-cloud.ps1
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- PowerShell parser validation on `scripts\windows\start-camera-push-to-cloud.ps1`.
- Verified local FFmpeg exposes `h264_amf`.
- Direct AMF profile probe showed `constrained_baseline`, `main`, and `high` work while `baseline` fails.
- Ran `scripts\windows\start-local.ps1`; AMF selection reached `h264_amf (hardware)` before the remaining SRT network failure.
- Confirmed cloud `go2rtc-srt-bridge.service` is active and listening on UDP `0.0.0.0:19091`.

Runtime/cloud impact:
- External Windows local sender behavior changed.
- No Cloud Service Console app runtime changed.
- No EXE build, hosted web deploy, cloud service restart, public port change, control signal change, or Tank Trouble change.
- Remaining observed issue: local FFmpeg cannot connect to `srt://150.109.100.30:19091` and reports `I/O error`, indicating a UDP/SRT network path issue.

## 2026-05-21 17:50 - Legacy portable alternate server config clarity

Scope:
- Clarified that plaintext `cloud.sshPassword` remains visible and editable in each OS config.
- Moved `cloud.sshPassword` next to `cloud.sshHost` / `cloud.sshUser` in Windows, Linux, and macOS configs.
- Added config comments and README guidance for another cloud server: edit `cloud.publicHost`, `cloud.sshHost`, `cloud.sshUser`, and `cloud.sshPassword` before running `setup-local`.

Files:
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.windows.config.json
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.linux.config.json
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.macos.config.json
- External go2rtc-portable-0520\go2rtc-portable\README.md
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- JSON parse validation on Windows, Linux, and macOS configs.
- Confirmed all three configs expose `publicHost`, `sshHost`, `sshUser`, and `sshPassword`.
- Confirmed README documents the four fields for another cloud server.

Runtime/cloud impact:
- No Cloud Service Console app runtime changed.
- No EXE build, hosted web deploy, cloud service restart, public port change, control signal change, or Tank Trouble change.

## 2026-05-21 17:41 - Legacy portable password-only visible SSH config

Scope:
- Cleaned the latest WeChat external go2rtc portable pusher configs so normal users only see plaintext `cloud.sshPassword`.
- Removed visible `cloud.sshKeyPath` from Windows, Linux, and macOS system configs.
- Kept internal default SSH key path fallback in scripts for compatibility and automatic later connections.
- Updated README wording and default config generators.
- Aligned generated default capture/output resolution to `1280x720`.

Files:
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.windows.config.json
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.linux.config.json
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.macos.config.json
- External go2rtc-portable-0520\go2rtc-portable\scripts\common\ConfigHelpers.ps1
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\common.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\common.sh
- External go2rtc-portable-0520\go2rtc-portable\README.md
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- Confirmed `sshKeyPath` no longer appears in `config` or `README.md`.
- JSON parse validation on all config files.
- Confirmed Windows/Linux/macOS configs still contain `cloud.sshPassword`.
- PowerShell parser validation on touched scripts.
- `bash -n` on touched Linux/macOS shell scripts.

Runtime/cloud impact:
- No Cloud Service Console app runtime changed.
- No EXE build, hosted web deploy, cloud service restart, public port change, control signal change, or Tank Trouble change.

## 2026-05-21 16:39 - Legacy portable root cleanup

Scope:
- Cleaned the latest WeChat external go2rtc portable pusher root at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0520\go2rtc-portable`.
- Root now shows only daily-use entries plus `README.md`, `config`, `logs`, `scripts`, and `internal`.
- Moved bundled go2rtc runtime files and legacy YAML templates into `internal\runtime`.
- Moved viewer web assets into `internal\www`.
- Moved historical docs into `internal\docs`.
- Updated script references so helper/deploy code uses the new internal asset paths.

Files:
- External go2rtc-portable-0520\go2rtc-portable\README.md
- External go2rtc-portable-0520\go2rtc-portable\scripts\common\ConfigHelpers.ps1
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\deploy-go2rtc-cloud.ps1
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\start-local.ps1
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\start-tencent.cmd
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\start-sender-template.cmd
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\common.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\deploy-cloud.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\common.sh
- External go2rtc-portable-0520\go2rtc-portable\internal\*
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- PowerShell parser validation on touched Windows scripts.
- JSON parse validation on all sender config files.
- `bash -n` on root, Linux, and macOS shell scripts.
- Path check confirmed internal runtime, web, and docs assets exist.

Runtime/cloud impact:
- No Cloud Service Console app runtime changed.
- No EXE build, hosted web deploy, cloud service restart, public port change, control signal change, or Tank Trouble change.

## 2026-05-21 16:10 - Legacy portable macOS and per-OS configs

Scope:
- Updated the external legacy go2rtc portable pusher at E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0520\go2rtc-portable.
- Added macOS support for root setup-local.sh, start-local.sh, and stop-local.sh through scripts\macos.
- Added macOS Homebrew dependency setup, AVFoundation camera auto-detection, and VideoToolbox encoder auto-selection.
- Split config by OS: Windows, Linux, and macOS each have their own sender-cloud.<os>.config.json.
- All system configs default to 150.109.100.30 and include plaintext cloud.sshPassword for internal SSH key bootstrap.

Files:
- External go2rtc-portable-0520\go2rtc-portable\setup-local.sh
- External go2rtc-portable-0520\go2rtc-portable\start-local.sh
- External go2rtc-portable-0520\go2rtc-portable\stop-local.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\*
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\common.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\setup-local.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\common\ConfigHelpers.ps1
- External Windows local sender scripts and config files
- docs\VIDEO_LINK_AGENT.md
- frontend\IMPLEMENTATION_LOG.md
- docs\SHARED_AGENT_STATUS.md

Validation:
- bash -n on touched shell scripts.
- python -m py_compile on camera helpers and heartbeat helper.
- PowerShell parser validation on touched Windows scripts.
- JSON parse validation on config files.
- Windows config helper smoke test for the new Windows default config path.

Cloud deployment note:
- No cloud deployment or service restart was performed.
- No control signal, Tank Trouble, public port, Nginx route, or hosted web console behavior changed.

## 2026-05-20 21:02 - Local stream auto downgrade startup

Scope:
- Updated the desktop mini app local legacy push path.
- Startup now rejects FFmpeg attempts that keep running while logging obvious camera decode errors, including `No JPEG data found in image`.
- The backend retries lower or safer capture configurations, including default camera capture without forced MJPEG and `1280x720`, `960x540`, and `640x480` fallback profiles.
- The final successful config is saved and returned so the UI fields refresh to the actually working downgraded values.

Files:
- `backend\local_stream.py`
- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\local_stream.py backend\main.py backend\models.py`
- `cmd /c npm --prefix frontend run build`
- `git diff --check -- backend\local_stream.py frontend\src\pages\DashboardPage.tsx`
- `cmd /c npm run installer:build`

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.

Cloud deployment note:
- No hosted web-console deployment or cloud service restart was performed.
- No public ports, service names, control signal behavior, Tank Trouble behavior, or Nginx routes changed.

## 2026-05-19 17:13 - Legacy portable Linux NVIDIA encoder support

Scope:
- Updated the external legacy go2rtc portable pusher at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0519\go2rtc-portable`.
- Linux now reads `sender.videoEncoder` from config.
- Added Linux support for `h264_nvenc`, `hevc_nvenc`, and `libx264`.
- Linux auto selection now tries `h264_nvenc` first, then falls back to `libx264`.
- Added `videoEncoder` to Linux default config generation and updated README.

Files:
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0519\go2rtc-portable\scripts\linux\common.sh`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0519\go2rtc-portable\scripts\linux\start-sender.sh`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0519\go2rtc-portable\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `bash -n setup-local.sh start-local.sh stop-local.sh scripts/linux/*.sh scripts/legacy-entrypoints/linux/*.sh`
- Fake FFmpeg encoder-list smoke test confirmed auto `h264_nvenc`, explicit `hevc_nvenc`, fallback `libx264`, and clear failure when explicit `hevc_nvenc` is unavailable.

Cloud deployment note:
- No Cloud Service Console runtime changed.
- No EXE rebuild, hosted web-console deployment, or cloud service restart was performed.

## 2026-05-19 15:30 - Legacy portable Linux root entries restored

Scope:
- Added root Linux wrappers back to the external legacy go2rtc portable pusher: `setup-local.sh`, `start-local.sh`, and `stop-local.sh`.
- Root now exposes Windows and Linux daily-use entries only: setup/start/stop for each platform.
- Other maintenance and helper scripts remain under `scripts/`.
- Updated the external package README.

Validation:
- Root script-entry check confirmed only six daily-use scripts are exposed.
- `bash -n setup-local.sh start-local.sh stop-local.sh scripts/linux/*.sh scripts/legacy-entrypoints/linux/*.sh`
- PowerShell scriptblock parse check for all `scripts\windows\*.ps1`.
- Target check confirmed the Linux wrappers point to existing scripts under `scripts\linux`.

Cloud deployment note:
- No Cloud Service Console runtime changed.
- No EXE rebuild, hosted web-console deployment, or cloud service restart was performed.

## 2026-05-19 15:25 - Legacy portable root entry cleanup

Scope:
- Reorganized the external legacy go2rtc portable pusher at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable`.
- Kept only `setup-local.cmd`, `start-local.cmd`, and `stop-local.cmd` as root user-facing entry points.
- Moved other Windows/Linux/helper/maintenance scripts under `scripts/`.
- Updated path resolution and the package README for the cleaned layout.

Files:
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\setup-local.cmd`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\start-local.cmd`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\stop-local.cmd`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\scripts\...`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- PowerShell scriptblock parse check for all `scripts\windows\*.ps1`.
- `bash -n scripts/linux/*.sh scripts/legacy-entrypoints/linux/*.sh`
- Root script-entry check confirmed only `setup-local.cmd`, `start-local.cmd`, and `stop-local.cmd` remain in the package root.
- Target check confirmed those three commands point to existing Windows scripts.

Cloud deployment note:
- No Cloud Service Console runtime changed.
- No EXE rebuild, installer build, hosted web-console deployment, or cloud service restart was performed.
## 2026-05-19 14:57 - Legacy portable stop-all only stops local push

Scope:
- Updated the external legacy go2rtc portable pusher at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable`.
- Changed `stop-all` so it only stops local video push/sender processes.
- Removed the old cloud-stop behavior from the Windows and Linux `stop-all` entry scripts.

Files:
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\stop-all.ps1`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\linux\stop-all.sh`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- PowerShell scriptblock parse check for the Windows `stop-all.ps1`.
- `bash -n E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\linux\stop-all.sh`
- Keyword check confirmed no remote service stop calls remain in the Windows/Linux `stop-all` scripts.

Cloud deployment note:
- No Cloud Service Console runtime changed.
- No EXE rebuild, installer build, hosted web-console deployment, or cloud service restart was performed.
- The legacy pusher can no longer stop shared cloud services through `stop-all`.

## 2026-05-19 13:45 - Teammate frontend Tencent playback fixes

Scope:
- Updated the external teammate frontend at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518`.
- Fixed Tencent player preview aspect ratio and legacy-to-Tencent mode switching without page refresh.

Files:
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\app.py`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\static\app.js`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\static\styles.css`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\VIDEO_LINK_INTEGRATION_NOTE.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\app.py`
- `node --check E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\static\app.js`

Cloud deployment note:
- No Cloud Service Console runtime changed.
- No EXE rebuild, installer build, hosted web-console deployment, or service restart was performed.

## 2026-05-19 13:30 - Console domain updated to cityulive.com

Scope:
- Documentation-only sync for the hosted web console domain change.
- New current browser entries:
  - `https://console.cityulive.com/?access_token=xhfang`
  - `https://console.cityulive.com/?access_token=cmc5006`
- The old `console.cityulive.xyz` console entry is deprecated/broken for current use.

Files:
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/VIDEO_LINK_AGENT.md`
- `docs/SHARED_AGENT_STATUS.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `https://console.cityulive.com/?access_token=xhfang` returned `200`.
- `https://console.cityulive.com/?access_token=cmc5006` returned `200`.
- `https://console.cityulive.com/api/access?access_token=xhfang` returned admin role.
- `https://console.cityulive.com/api/access?access_token=cmc5006` returned user role.

Cloud deployment note:
- No cloud runtime changed in this task.
- No EXE rebuild, installer build, hosted web-console deployment, or service restart was performed.

## 2026-05-18 16:30 - Standalone Tencent Linux pusher codec selection

Scope:
- Updated the standalone Tencent Cloud WebRTC Linux pusher utility at `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux`.
- Added configurable codec selection for `h264`, `vp8`, `vp9`, and `hevc`.
- The local pusher page now remembers the selected codec and rewrites the Tencent push URL with the matching codec query flags before starting push.

Files:
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\run-tencent-webrtc-push.sh`
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\config.env`
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\config.example.env`
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\tencent-webrtc-pusher.html`
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\README.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `bash -n E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\run-tencent-webrtc-push.sh`
- Inline JavaScript syntax check for `tencent-webrtc-pusher.html` via `node`
- URL rewrite smoke check via `node` confirmed:
  - `h264` strips Tencent codec override params
  - `vp9` appends `tx_vp9=true`
  - `hevc` appends `tx_hevc=true&tx_h265=true`

Cloud deployment note:
- No Cloud Service Console app runtime changed.
- No EXE rebuild, installer build, or hosted web-console deployment was performed.
- This task only changed the standalone local Tencent pusher utility and its documentation sync.

## 2026-05-15 23:22 - HTTPS web console entry documentation sync

Scope:
- Documentation-only sync for the hosted web console HTTPS migration.
- Recorded that the preferred browser entry is `https://console.cityulive.xyz/?access_token=...`.
- Clarified that browser camera, microphone, screen capture, and Tencent Cloud web push should use the HTTPS domain entry.

Files:
- `docs/SHARED_AGENT_STATUS.md`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- Previously verified `https://console.cityulive.xyz/` returned `200` with title `Cloud Service Console v3`.
- Previously verified `https://console.cityulive.xyz/api/access` returned the expected admin/user roles for valid access tokens.
- Previously verified the certificate is for `console.cityulive.xyz`, issued by Let's Encrypt, expiring `2026-08-13`.

Cloud deployment note:
- No cloud runtime changed in this documentation sync.
- No app code changed.
- No EXE rebuild or installer build was performed.
- Direct fallback remains `http://150.109.100.30:18080/?access_token=...`, but browser media capture should use the HTTPS domain.

## 2026-05-15 15:40 - HTTPS prep for web console domain

Scope:
- Prepared the old server for a future HTTPS web-console domain `console.cityulive.xyz`.
- This is needed before browser-based Tencent Cloud push can use camera/microphone reliably in the hosted web console.

Changes:
- Added `/etc/nginx/conf.d/cloud-service-console-https.conf` on `150.109.100.30`.
- Configured host-only HTTP reverse proxy for `console.cityulive.xyz` to `http://127.0.0.1:18080`.
- Installed certbot at `/usr/bin/certbot`.
- Reloaded only Nginx.

Current blocker:
- `console.cityulive.xyz` has no DNS record yet, so Let's Encrypt HTTPS certificate issuance cannot complete.
- Port `443` is not listening yet.
- Next external step: add DNS `console.cityulive.xyz A 150.109.100.30` and allow TCP `443` in the cloud security group, then run certbot.

Validation:
- `Resolve-DnsName console.cityulive.xyz` currently returns no record.
- `Resolve-DnsName cityulive.xyz` still resolves to Tencent Cloud Live CDN.
- Host-header check `Host: console.cityulive.xyz` on `http://150.109.100.30/` returned the web console app shell.
- Old `/console/` path remains `404`.
- `http://150.109.100.30:18080/api/access` with the admin token still returns `200`.
- `Test-NetConnection 150.109.100.30 -Port 443` failed as expected because no certificate/443 listener is active yet.
- Existing services remained `active`: `nginx`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, and `coturn`.

Cloud deployment note:
- Backup created: `/etc/nginx/conf.d/cloud-service-console-https.conf.bak-20260515153927`.
- No video streaming service, control signal broker, Tank Trouble service, telemetry relay, SRT bridge, coturn, or hosted web console restart was performed.

## 2026-05-15 15:05 - Video heartbeat timeout stops mode

Scope:
- Updated the video status timeout rule for both `legacy` and `tencent` push modes.
- More than 60 seconds without a heartbeat now returns `state: "stopped"` and `live: false` instead of leaving the mode in a stale/yellow state.

Changes:
- Changed the cloud telemetry relay heartbeat timeout constants from 15 seconds to 60 seconds.
- Changed expired-heartbeat snapshots to return `stopped`.
- Deployed the updated relay to old server `150.109.100.30`.
- Restarted only `go2rtc-telemetry-relay`.
- Rebuilt and copied the local desktop runtime EXEs to `E:\Cloud-Service-Console`.

Files:
- `backend/cloud_setup_bundle/telemetry_relay.py`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\telemetry_relay.py`
- Local snapshot smoke check confirmed 59-second heartbeat is `active` and 61-second heartbeat is `stopped` for both modes.
- Remote `python3 -m py_compile /tmp/telemetry_relay.py.codex.*`
- Remote constants check confirmed both timeout constants are `60`.
- Remote `systemctl is-active go2rtc-telemetry-relay` returned `active`.
- Existing services before and after remained `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`, `cloud-service-console-web`.
- Public `http://150.109.100.30:18081/api/video/status` returned `legacy.state: "stopped"`, `legacy.staleAfterSec: 60`, and `tencent.staleAfterSec: 60`.
- `cmd /c npm run installer:build`

Cloud deployment note:
- Remote backup: `/opt/go2rtc-cloud/telemetry_relay.py.bak-heartbeat-timeout-20260515150414`.
- No public ports, Nginx rules, service names, control signaling, Tank Trouble, or go2rtc ingest/playback services changed.

## 2026-05-15 14:37 - Remove Nginx console entry

Scope:
- Removed the Nginx-based web console entry on old server `150.109.100.30`.
- Future web console access should use only the standalone `18080` entry.

Changes:
- Backed up and disabled `/etc/nginx/conf.d/cloud-service-console-web.conf`.
- Reloaded only `nginx`.
- Kept `cloud-service-console-web.service` running on `18080`.

Validation:
- Remote `nginx -t` passed.
- Remote `systemctl reload nginx` succeeded.
- Existing services before and after remained `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`, `cloud-service-console-web`.
- Public `http://150.109.100.30/console/?access_token=xhfang` now returns `404`.
- Public `http://150.109.100.30/api/access` now returns `404`.
- Public `http://150.109.100.30:18080/api/access` with admin token returns `200`.

Cloud deployment note:
- No public ports or service names changed.
- No go2rtc, control signaling, telemetry relay, SRT bridge, coturn, or Tank Trouble service was restarted.

## 2026-05-15 14:11 - Web console deployment sync

Scope:
- Synced the hosted standalone web console on `150.109.100.30`.
- Deployed the current frontend/backend web-console package to `/opt/cloud-service-console-web`.
- Preserved the existing admin/user access tokens.
- At deployment time both `:18080` and `/console/` worked; the later `14:37` Nginx cleanup intentionally removed `/console/`.

Changes:
- Rebuilt the frontend bundle with the latest overview cards.
- Restarted only `cloud-service-console-web.service`.
- Did not restart go2rtc, control signaling, telemetry relay, SRT bridge, Nginx, coturn, or Tank Trouble services.

Validation:
- `cmd /c npm.cmd run build`
- Remote `systemctl is-active cloud-service-console-web.service` returned `active`.
- Remote `/api/health` on `127.0.0.1:18080` returned successfully with the preserved admin token.
- Existing chain services before and after deployment were all `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.
- Public `http://150.109.100.30:18080/api/access` returned `200`.
- Public `http://150.109.100.30:18080/api/health` returned `200`.
- Public `http://150.109.100.30/console/` returned the app shell.
- Public main JS asset contains `閹貉冨煑娣団€冲娇閻樿埖鈧梗 and no longer contains `娴滄垹顏惄顔界垼` or `瑜版挸澧犲Ο鈥崇础`.

Cloud deployment note:
- Cloud impact is limited to the standalone `cloud-service-console-web.service` and files under `/opt/cloud-service-console-web`.
- No public ports or cloud service names changed.

## 2026-05-15 13:52 - Overview video push status card

Scope:
- Video Link Agent desktop/web console update.
- Replaced the overview "瀵板懎顦╅悶鍡樺付閸? summary card with a video push status module.
- Kept the change within video status API/UI wiring; no control signal or Tank Trouble logic was changed.

Changes:
- Added local backend `GET /api/video/status` as a same-origin proxy to the current server's cloud video status API.
- Marked `/api/video/status` as a safe read-only path for normal web-console users.
- Added frontend `VideoPushStatus` types and `getVideoPushStatus()`.
- The overview card polls video status every 5 seconds while connected and visible.
- The card shows active mode, conflict/offline/error state, and separate rows for `legacy` and `tencent` push status.
- Per-mode notes show heartbeat age and producer visibility in Chinese.
- Fixed the overview layout regression by preventing summary cards from stretching to the tallest card.
- Made the video-link status rows compact and two-column on desktop/tablet widths, with a single-column fallback on narrow screens.

Files:
- `backend/main.py`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `frontend/src/types/cloud.ts`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\main.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- In-app browser automation timed out and `http://127.0.0.1:8080/` was not reachable, so visual browser verification was not completed.
- Replaced copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026-05-15 13:51:37`
  - `cloud-console-backend.exe` updated at `2026-05-15 13:51:29`
  - `Cloud Service Console Setup.exe` updated at `2026-05-15 13:51:54`
  - `Cloud Service Console_0.3.68_x64-setup.exe` updated at `2026-05-15 13:51:54`

Cloud deployment note:
- No remote cloud deployment was performed.
- No public ports, cloud service names, Nginx rules, control signal behavior, or Tank Trouble behavior changed.
- The deployed standalone web console was not restarted or redeployed in this step; preserve existing access tokens if deploying it later.

## 2026-05-15 07:56 - Desktop Tencent push parameter sync

Scope:
- Video Link Agent desktop app update.
- Cleared legacy Local Stream push logs on backend shutdown.
- Synced the Local Stream Tencent Cloud push button with the standalone Tencent pusher parameter behavior.

Changes:
- Added `LocalStreamManager.clear_logs()` and call it from the backend shutdown hook after quiet local-stream stop.
- Tencent Cloud push now saves the current Local Stream draft config before starting.
- Tencent Cloud push uses `output_video_size`, `target_framerate`, and `video_bitrate` through TXLivePusher `setProperty` calls.
- Tencent Cloud push heartbeat payload now includes optional `videoWidth`, `videoHeight`, `fps`, `bitrateKbps`, and `quality`.
- Non-applicable Local Stream settings remain legacy-only: FFmpeg encoder/path, input format, SRT latency/packet/timeout/drop settings, ingest ports, and exact browser camera constraints.

Files:
- `backend/local_stream.py`
- `backend/main.py`
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\local_stream.py backend\main.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Replaced copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026-05-15 07:56:01`
  - `cloud-console-backend.exe` updated at `2026-05-15 07:55:52`
  - `Cloud Service Console Setup.exe` updated at `2026-05-15 07:56:18`
  - `Cloud Service Console_0.3.67_x64-setup.exe` updated at `2026-05-15 07:56:18`

Cloud deployment note:
- No remote cloud deployment was performed.
- No public ports, service names, Nginx rules, control signal behavior, or Tank Trouble behavior changed.
- Browser automation against `http://127.0.0.1:8080/` timed out; build validation passed.

## 2026-05-14 23:29 - Tencent Linux pusher status reporting

Scope:
- Video Link Agent update to the standalone Tencent Linux WebRTC pusher package at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\tencent-webrtc-pusher-linux-0514\tencent-webrtc-pusher-linux`.
- Added optional Tencent status reporting so the independent Linux pusher can make `/api/video/status` show `tencent.live=true`.

Changes:
- Added `CLOUD_VIDEO_STATUS_BASE_URL`, `TENCENT_PLAY_URL`, `STATUS_CLIENT_ID`, and `STATUS_HEARTBEAT_SECONDS` to config files.
- The run script passes those status values into the local pusher page.
- The pusher page reports `/api/video/tencent/start` only after `TXLivePusher.startPush()` succeeds.
- The pusher page reports `/api/video/tencent/heartbeat` during active push and `/api/video/tencent/stop` on stop/page unload.
- The full push URL and `txSecret` are not uploaded; only stream name, push host, optional play URL, source, and client id are reported.

Files:
- External Tencent Linux pusher package:
  - `config.env`
  - `config.example.env`
  - `run-tencent-webrtc-push.sh`
  - `tencent-webrtc-pusher.html`
  - `README.md`
- Main repo logs/docs:
  - `docs/VIDEO_LINK_AGENT.md`
  - `frontend/IMPLEMENTATION_LOG.md`
  - `docs/SHARED_AGENT_STATUS.md`

Validation:
- `bash -n run-tencent-webrtc-push.sh`
- `bash -n stop-tencent-webrtc-push.sh`
- HTML parser smoke check for `tencent-webrtc-pusher.html`.
- `bash run-tencent-webrtc-push.sh --help`

Cloud deployment note:
- No remote cloud deployment was performed for this package change.
- It relies on already deployed endpoints at `http://150.109.100.30:18081/api/video/tencent/*`.
- No new public ports, service names, Nginx rules, control signal behavior, or Tank Trouble behavior changed.
- EXE rebuilt: no, because this change is in a standalone external pusher package, not desktop app code.

## 2026-05-14 17:56 - Legacy/Tencent video status API

Scope:
- Video Link Agent update for two-link video mode detection.
- Synced the desktop Local Stream one-click push with the `legacy` runtime heartbeat protocol.
- Added cloud status aggregation so frontend code can ask the server whether `legacy`, `tencent`, both, or neither are active.

Changes:
- Desktop Local Stream now writes `<remoteBase>/www/<stream>-runtime.json` after FFmpeg starts, refreshes it every 5 seconds, writes `stopped` on manual stop, and writes `stale` if FFmpeg exits while the app is alive.
- Cloud telemetry relay now serves:
  - `GET /api/video/status`
  - `POST /api/video/tencent/start`
  - `POST /api/video/tencent/heartbeat`
  - `POST /api/video/tencent/stop`
- Cloud status response returns `activeMode`, `conflict`, `availableModes`, `legacy`, and `tencent`.
- Cloud Nginx template now proxies `/api/video/` to `go2rtc-telemetry-relay`.
- `video-endpoints.json` now includes `runtimeStatusUrl` and `videoStatusUrl`.
- Tencent Cloud push in the Local Stream panel now reports start/heartbeat/stop to the cloud status endpoint after `TXLivePusher.startPush()` succeeds.
- Tencent push secrets are not uploaded; only stream name, push host, optional play URL, source, and client id are reported.

Files:
- `backend/local_stream.py`
- `backend/cloud_setup.py`
- `backend/cloud_setup_bundle/telemetry_relay.py`
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`
- External teammate handoff: `E:\Desktop\123\VIDEO_LINK_STATUS_API_FOR_FRONTEND.md`

Validation:
- `python -m py_compile backend\local_stream.py backend\cloud_setup.py backend\cloud_setup_bundle\telemetry_relay.py backend\main.py backend\models.py`
- `cmd /c npm --prefix frontend run build`
- Local route registration check for `/api/video/status` and `/api/video/tencent/*`.
- `cmd /c npm run installer:build`
- Replaced copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026-05-14 18:02:59`
  - `cloud-console-backend.exe` updated at `2026-05-14 18:02:50`
  - `Cloud Service Console Setup.exe` updated at `2026-05-14 18:03:16`
  - `Cloud Service Console_0.3.62_x64-setup.exe` updated at `2026-05-14 18:03:16`

Cloud deployment note:
- Deployed video status API to old server `150.109.100.30`.
- Updated remote `/opt/go2rtc-cloud/telemetry_relay.py`.
- Updated remote `go2rtc-telemetry-relay.service` environment for stream name, remote base, and go2rtc streams URL.
- Inserted `/api/video/` proxy into the existing `/etc/nginx/conf.d/go2rtc-cloud.conf` without overwriting Tank Trouble or control blocks.
- Updated remote `/opt/go2rtc-cloud/www/video-endpoints.json`.
- Restarted only `go2rtc-telemetry-relay`; reloaded Nginx.
- No new public ports or cloud service names were added.
- Control signal and Tank Trouble behavior were not changed.

Remote validation:
- Remote `python3 -m py_compile /opt/go2rtc-cloud/telemetry_relay.py`.
- Remote `sudo nginx -t`.
- Remote `systemctl status go2rtc-telemetry-relay` reported active.
- Remote `http://127.0.0.1:18083/api/video/status` returned `200`.
- Remote `http://127.0.0.1:18081/api/video/status` returned `200`.
- Public `http://150.109.100.30:18081/api/video/status` returned `200`.
- Public `http://150.109.100.30:18081/video-endpoints.json` includes `runtimeStatusUrl` and `videoStatusUrl`.
- Public control checks still returned `200` for `/control/webrtc/health` and `/control/monitor/key-state?session=robot-control`.

## 2026-05-14 17:19 - Legacy go2rtc sender heartbeat

Scope:
- Video Link Agent update to the standalone old go2rtc sender package at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0514\go2rtc-portable`.
- Added live `legacy` runtime heartbeat status for future two-link video mode selection.

Changes:
- Added `legacy_sender_heartbeat.py`, a small cross-platform heartbeat publisher that refreshes the existing cloud runtime status JSON.
- Windows sender start now launches the heartbeat after the old go2rtc push is confirmed and stops it from the stop script.
- Linux sender start now launches the heartbeat after the old go2rtc push is confirmed and stops it from the stop script.
- Runtime status payload now includes `videoMode: "legacy"`, `lastHeartbeatAt`, `heartbeatIntervalSec`, and `statusReason`.
- README documents `<publicBaseUrl>/main-camera-runtime.json` as the legacy sender heartbeat source.

Files:
- External portable sender package:
  - `legacy_sender_heartbeat.py`
  - `common/ConfigHelpers.ps1`
  - `start-camera-push-to-cloud.ps1`
  - `stop-camera-push-to-cloud.ps1`
  - `linux/common.sh`
  - `linux/start-sender.sh`
  - `linux/stop-sender.sh`
  - `README.md`
- Main repo logs/docs:
  - `docs/VIDEO_LINK_AGENT.md`
  - `frontend/IMPLEMENTATION_LOG.md`
  - `docs/SHARED_AGENT_STATUS.md`

Validation:
- PowerShell parser check for the changed `.ps1` files.
- `bash -n` for the changed Linux shell files.
- `python -m py_compile` for `legacy_sender_heartbeat.py`.

Cloud deployment note:
- No remote deployment was performed.
- No public ports, cloud service names, go2rtc systemd units, Nginx config, control signal chain, or Tank Trouble services changed.
- The heartbeat writes the existing runtime JSON only when the portable sender is run with working SSH access.
- EXE rebuilt: no, because this change is in the standalone old sender package, not the desktop app.
- GitHub push: no.
- Git tag update: no.

## 2026-05-13 13:38 - Tencent Cloud TCPlayer v4 playback integration

Scope:
- Video Link Agent fix for embedded Tencent Cloud Live WebRTC playback.

Changes:
- Replaced the old TCPlayerLite playback loader with Tencent Cloud `TCPlayer` v4.9.1 CSS/JS, matching the official TCPlayer demo path that can play `webrtc://cityulive.xyz/live/robot_control`.
- Changed the embedded playback container from a plain `div` to a real `<video>` element and initialize with `TCPlayer(videoId, options)` followed by `player.src(playUrl)`.
- Added cleanup/remount handling for the web player so repeated playback attempts start from a fresh TCPlayer container.
- Kept playback URL validation and local browser storage behavior unchanged.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Verified copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026/5/13 13:37:57`
  - `cloud-console-backend.exe` updated at `2026/5/13 13:37:48`
  - `Cloud Service Console Setup.exe` updated at `2026/5/13 13:38:14`
- Browser automation setup timed out while trying to inspect the in-app browser, so live playback still needs a manual click-through with a running Tencent Cloud stream.

Cloud deployment note:
- No remote cloud deployment was performed.
- No cloud services, public ports, go2rtc config, local FFmpeg ingest, systemd units, or deployment bundles were changed.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 13:19 - Tencent Cloud push preview reset

Scope:
- Video Link Agent UI/runtime fix for the Tencent Cloud Live push preview.

Changes:
- Added a preview reset for the Tencent Cloud push preview container before each new push starts.
- Clears and remounts the SDK preview container after stopping push as well.
- Prevents repeated start/stop cycles from accumulating nested SDK render nodes that appear as growing black borders around the camera preview.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Verified copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026/5/13 13:19:08`
  - `cloud-console-backend.exe` updated at `2026/5/13 13:19:00`
  - `Cloud Service Console Setup.exe` updated at `2026/5/13 13:19:25`

Cloud deployment note:
- No remote cloud deployment was performed.
- No cloud services, public ports, go2rtc config, local FFmpeg ingest, systemd units, or deployment bundles were changed.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 12:37 - Tencent Cloud web playback button

Scope:
- Video Link Agent update for the Tencent Cloud Live WebRTC push beta panel.
- Added a post-push `缂冩垿銆夌粩顖濐潎閻獖 flow using Tencent Cloud TCPlayerLite WebRTC playback.

Changes:
- Added `缂冩垿銆夌粩顖濐潎閻獖 beside the Tencent Cloud push controls; it is enabled after Tencent Cloud push is running.
- Clicking it opens a playback-address dialog for a URL such as `webrtc://cityulive.xyz/live/robot_control`.
- The dialog validates the playback URL before opening the embedded player.
- The app dynamically loads Tencent Cloud `TcPlayer` from TCPlayerLite and embeds playback in the Tencent Cloud push panel.
- After the player reports playback activity, the playback URL is saved to local browser storage and prefilled next time.
- Playback address storage is separate from the Tencent Cloud push-code storage.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Verified copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026/5/13 12:37:19`
  - `cloud-console-backend.exe` updated at `2026/5/13 12:37:11`
  - `Cloud Service Console Setup.exe` updated at `2026/5/13 12:37:36`

Cloud deployment note:
- No remote cloud deployment was performed.
- No cloud services, public ports, go2rtc config, local FFmpeg ingest, systemd units, or deployment bundles were changed.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 12:26 - Tencent Cloud push status strip

Scope:
- Video Link Agent UI fix for the Tencent Cloud push panel status display.

Changes:
- Changed the Tencent Cloud push preview/status grid to align items at the top instead of stretching the status column to preview height.
- Reduced the push status box from a large full-height green panel to a compact status strip with the existing small green lamp and text.

Files:
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- First `cmd /c npm run installer:build` built successfully but could not copy because `E:\Cloud-Service-Console\Cloud Service Console.exe` was running.
- Stopped `Cloud Service Console.exe` and two `cloud-console-backend.exe` processes.
- Reran `cmd /c npm run installer:build`.
- Verified copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026/5/13 12:26:16`
  - `cloud-console-backend.exe` updated at `2026/5/13 12:26:07`
  - `Cloud Service Console Setup.exe` updated at `2026/5/13 12:26:32`

Cloud deployment note:
- No remote cloud deployment was performed.
- No cloud services, public ports, go2rtc config, local FFmpeg ingest, systemd units, or deployment bundles were changed.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 12:16 - Tencent Cloud push dialog clipping fix

Scope:
- Video Link Agent UI fix for the Tencent Cloud push-code dialog.

Changes:
- Raised the shared setup/push modal overlay above the app shell/sidebar.
- Offset the fixed overlay to the viewport so the Tencent Cloud push-code textarea is no longer clipped by the left navigation area.
- Added max-height scrolling for the modal card so it remains usable on shorter windows.

Files:
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Verified copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026/5/13 12:16:34`
  - `cloud-console-backend.exe` updated at `2026/5/13 12:16:25`
  - `Cloud Service Console Setup.exe` updated at `2026/5/13 12:16:50`

Cloud deployment note:
- No remote cloud deployment was performed.
- No cloud services, public ports, go2rtc config, local FFmpeg ingest, systemd units, or deployment bundles were changed.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 12:08 - Tencent Cloud push code dialog memory

Scope:
- Video Link Agent update for the Tencent Cloud Live WebRTC push beta flow on the Local Stream page.
- Changed the `閼垫崘顔嗘禍鎴炲腹濞?(BETA)` entry so it asks for the push code in a modal before opening the push panel.

Changes:
- Clicking `閼垫崘顔嗘禍鎴炲腹濞?(BETA)` now opens a push-code dialog for the Tencent Cloud `webrtc://...txSecret=...&txTime=...` URL.
- The dialog validates the URL before opening the in-page push panel.
- After `TXLivePusher.startPush()` succeeds once, the push code is saved to local browser storage.
- The next Tencent Cloud push flow pre-fills and displays the saved push code, with a `娣囶喗鏁糮 action available before pushing.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Verified copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026/5/13 12:07:33`
  - `cloud-console-backend.exe` updated at `2026/5/13 12:07:23`
  - `Cloud Service Console Setup.exe` updated at `2026/5/13 12:07:49`

Cloud deployment note:
- No remote cloud deployment was performed.
- No cloud services, public ports, go2rtc config, local FFmpeg ingest, systemd units, or deployment bundles were changed.
- Built and copied local EXEs after the code change per the updated user workflow.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 11:34 - Local stream occupancy guard

Scope:
- Video Link Agent update for the default Local Stream push path.
- Disabled `娑撯偓闁款喗甯瑰ù涔?when the existing stream is visible but this machine is not the local publisher.

Changes:
- Treats `push_visible && !running` as another device/user already publishing the default stream.
- The `娑撯偓闁款喗甯瑰ù涔?action is disabled in that state, and hovering the disabled action area shows `閸忔湹绮禍鐑橆劀閸︺劍甯瑰ù涔?
- The local signal card reports `閸楃姷鏁ゆ稉鐠?with note `閸忔湹绮禍鐑橆劀閸︺劍甯瑰ù涔?
- Added a small wrapper style so the native hover title still works around the disabled button.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Verified copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026/5/13 11:32:56`
  - `cloud-console-backend.exe` updated at `2026/5/13 11:32:47`
  - `Cloud Service Console Setup.exe` updated at `2026/5/13 11:33:14`

Cloud deployment note:
- No remote cloud deployment was performed.
- No cloud services, public ports, go2rtc config, local FFmpeg ingest, systemd units, or deployment bundles were changed.
- Built and copied local EXEs after the code change per the updated user workflow.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 11:21 - Tencent Cloud WebRTC push beta

Scope:
- Video Link Agent update for the Local Stream page.
- Added a `閼垫崘顔嗘禍鎴炲腹濞?(BETA)` button beside `娑撯偓闁款喗甯瑰ù涔?
- The new panel lets the user paste a Tencent Cloud Live `webrtc://...txSecret=...&txTime=...` push URL and publish directly from the desktop WebView/browser without OBS.

Changes:
- Dynamically loads Tencent Cloud `TXLivePusher` SDK only when the beta panel starts pushing.
- Supports camera or screen/window capture, with optional microphone.
- Shows an in-page preview container and concise status text.
- Does not persist the Tencent Cloud push URL or hard-code the `txSecret` into source files.
- Styled the beta panel to match the current local-stream UI in light and dark themes.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Verified copied runtime files in `E:\Cloud-Service-Console`:
  - `Cloud Service Console.exe` updated at `2026/5/13 11:25:30`
  - `cloud-console-backend.exe` updated at `2026/5/13 11:25:21`
  - `Cloud Service Console Setup.exe` updated at `2026/5/13 11:25:47`

Cloud deployment note:
- No remote cloud deployment was performed.
- No cloud services, public ports, go2rtc config, local FFmpeg ingest, systemd units, or deployment bundles were changed.
- Built and copied local EXEs after the code change per the updated user workflow.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 10:54 - Activity logs and local stream UI polish

Scope:
- UI Design Agent update for activity logs, local debug flow visibility, local stream panel polish, and user-facing error text.
- Added a dedicated `閺堫剙婀寸拫鍐槸閺冦儱绻擿 above `閺堫剙婀撮崥搴ｎ伂閺冦儱绻擿 so setup/refresh/start/stop flows are visible without mixing them into backend service output.
- Kept the cloud/video/control/game business protocols intact except for user-facing log/error wording needed by the UI.

Changes:
- Activity log component now accepts title/subtitle/empty labels, auto-scrolls, uses the shared log-console style, and keeps log text selectable for copying.
- Activity view now shows `閺堫剙婀寸拫鍐槸閺冦儱绻擿 first and `閺堫剙婀撮崥搴ｎ伂閺冦儱绻擿 second, with taller themed log windows.
- One-click configuration closes the password dialog after submission, switches to Activity, and records local debug steps for check/run completion.
- Dashboard refresh, sidebar refresh, start-all, and stop-all switch to Activity and append readable local debug steps.
- Successful service/setup steps now render as green success log lines; errors remain red.
- Local stream dropdowns now use a custom themed select menu.
- Local stream gray blocks were restyled for light/dark mode, and the five-light all-live effect is clipped inside the local stream panel.
- Local stream startup failures now show a concise red summary while the full FFmpeg stderr remains in the selectable push log.
- Cloud setup drift text maps internal `www` to user-facing `娴滄垹顏純鎴︺€夌挧鍕爱`.

Files:
- `frontend/src/components/ActivityLog.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `backend/main.py`
- `backend/service_manager.py`
- `backend/cloud_setup.py`
- `backend/local_stream.py`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `python -m py_compile backend\cloud_setup.py`
- `python -m py_compile backend\local_stream.py`
- `cmd /c "frontend\node_modules\.bin\tauri.cmd build --config src-tauri/tauri.conf.json --bundles none"`

Cloud deployment note:
- No remote cloud deployment was performed.
- One-click setup wording/check behavior changed locally; future one-click setup may sync cloud webpage resources if drift is detected.
- Built EXEs only, no installer in this step.
- Copied EXEs to `E:\Cloud-Service-Console\Cloud Service Console.exe` and `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-13 10:42 - Control monitor polling and user-only dialing filter

Scope:
- Control signal lane and mini-app monitor display only.
- Reduced the side-channel keyboard polling floor to make pressed keys show up faster.
- Filtered the mini-app dialing state so internal compute/arm command sessions are not counted as user web frontend dialing.

Changes:
- `backend/cloud_setup_bundle/control_signaling.py` now tags pending browser offers with a role and marks whether they came from a user frontend.
- `backend/main.py` and `backend/health_checker.py` now prefer `userPendingOffers` / `pendingOfferClients` when building the mini-app-facing control status.
- `backend/main.py` now skips the extra `/control/webrtc/status` fallback fetch when the cloud `key-state` payload already contains `linkStatus`.
- `frontend/src/pages/DashboardPage.tsx` now polls control key-state with a 50ms minimum floor instead of 200ms.
- `frontend/src/types/cloud.ts` and `backend/models.py` now carry the extra user/internal pending-offer fields.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/main.py`
- `backend/health_checker.py`
- `backend/models.py`
- `frontend/src/types/cloud.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\main.py backend\health_checker.py backend\models.py backend\cloud_setup_bundle\control_signaling.py`
- `cmd /c npm.cmd run build --prefix frontend`
- `cmd /c npm.cmd run installer:build`

Cloud impact:
- Cloud broker schema changed to expose user/internal pending-offer separation.
- Local installer rebuilt and copied to `E:\Cloud-Service-Console`.
- No video ingest, Tank Trouble game logic, or external TURN settings were changed.

## 2026-05-07 11:02 - Saved login account dropdown on host field

Scope:
- UI Design Agent update for the login page and local login settings model.
- Added a saved-account host dropdown fed by previously successful local logins, with auto-fill for the paired username, password, and preference toggles.
- No cloud deployment, video link logic, control signaling protocol, or Tank Trouble gameplay changed.

Changes:
- Local login settings now keep a small `saved_accounts` history alongside the current login form state, while remaining backward-compatible with old single-account settings files.
- Successful logins are promoted to the top of the saved-account list and deduplicated by `host + username`.
- The login page host field now opens a custom dropdown menu showing saved servers and whether each entry remembers password or auto-login.
- Clicking a saved entry fills `host`, `username`, `password`, `remember_password`, and `auto_login` into the form without auto-submitting.

Files:
- `backend/config.py`
- `backend/models.py`
- `backend/settings_store.py`
- `backend/main.py`
- `frontend/src/types/cloud.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend/main.py backend/models.py backend/settings_store.py backend/config.py`
- `cmd /c npm --prefix frontend run build`

Cloud deployment note:
- No cloud deployment was performed.
- No package version bump, GitHub push, tag update, or installer build was performed in this step.

## 2026-05-06 00:24 - v0.3.62 installer build

Scope:
- Tank Trouble Agent release packaging step after the land mine powerup update.
- Bumped desktop package metadata from `0.3.61` to `0.3.62`, built the Windows NSIS installer, and copied it to the local release directory.

Changes:
- Updated root, frontend, Tauri, and Cargo version metadata to `0.3.62`.
- Ran the Tauri production build, which rebuilt the frontend and packaged the backend bundle.
- Generated and copied installer: `E:\Cloud-Service-Console\Cloud Service Console_0.3.62_x64-setup.exe`.

Files:
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/TANK_TROUBLE_AGENT.md`
- `docs/SHARED_AGENT_STATUS.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `cmd /c npm run tauri:build`
- Verified copied installer exists at `E:\Cloud-Service-Console\Cloud Service Console_0.3.62_x64-setup.exe` with size `22605776` bytes.

Cloud deployment note:
- No remote cloud deployment was performed.
- The installer includes the current bundled Tank Trouble cloud script/assets; existing one-click setup remains the path for syncing servers.
- GitHub push: no.
- Git tag update: no; latest known tag remains `v0.3.50`.

## 2026-05-06 00:18 - Tank Trouble land mine powerup

Scope:
- Tank Trouble Agent update for the Tank Trouble game only.
- Added a gray `AT MINE` powerup, local mine-layer rendering, online mine planting, cloud-authoritative mine triggers/damage, preview/spectator rendering, and bundled mine icon assets.

Changes:
- Desktop Canvas now renders the `land-mine.png` pickup, `AT MINE` pickup text, mine-layer tank without a long barrel, planted mines with owner-colored lamps, fade/invisibility, fast reveal near tanks, and a mine-specific distortion-style explosion.
- Online sync now carries `mine_ammo` and `mines`; local fire prediction plants a visible mine immediately, then reconciles against cloud state.
- Cloud room service now spawns `land_mine`, gives 3 mines, arms mines after 1s, triggers them on any tank in range, detonates after 1s, and emits `weapon=land_mine` death events.
- Local preview runtime/page and cloud spectator page now pass/render mines and the mine-layer tank appearance.
- Added `land-mine.png` to both desktop public assets and the cloud setup bundle assets.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/tank_trouble_preview_runtime.py`
- `backend/tank_trouble_preview_page.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/public/tank-trouble/powerups/land-mine.png`
- `backend/cloud_setup_bundle/www/tank-trouble/powerups/land-mine.png`
- `docs/TANK_TROUBLE_AGENT.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\main.py backend\models.py`
- Extracted cloud spectator `<script>` to `build-logs\spectator-page-check.js` and ran `node --check build-logs\spectator-page-check.js`.
- Extracted local preview page `<script>` to `build-logs\preview-page-check.js` and ran `node --check build-logs\preview-page-check.js`.
- `cmd /c npm --prefix frontend run build`

Cloud deployment note:
- No remote cloud deployment was performed.
- Existing Tank Trouble one-click setup hashes `backend/cloud_setup_bundle/tank_trouble_room.py` and `backend/cloud_setup_bundle/www/tank-trouble/**`, so it will upload the updated cloud game script and `land-mine.png` asset to any configured server and restart only `cloud-service-console-tank-trouble`.
- No app version bump, EXE build, GitHub push, or tag update in this step.

## 2026-05-05 19:14 - Control monitor paired-state lamps

Scope:
- Control Signal Agent update for the mini app control monitor and control broker status aggregation.
- Fixed the case where the real browser-to-robot DataChannel was connected but the monitor lamps stayed yellow/off because the robot receiver stopped polling after accepting an offer and the frontend had not posted side-channel `callState`.

Changes:
- Broker `linkStatus` now treats a completed browser-offer / robot-answer exchange (`answersPosted > 0`) as a paired-state fallback for `frontendDialing`, `backendListening`, and `directConnected`.
- Local backend fallback from `/control/webrtc/status` uses the same paired-state inference and ORs it with broker-returned `linkStatus` so stale `false` fields do not hide a completed pairing.
- Dashboard control monitor now shows paired/link activity even when no side-channel key-state client exists, and link-lamp notes show `paired` instead of stale `0 dialing` or old poll ages.
- Virtual keyboard behavior is unchanged: keycaps still require frontends to post `/control/monitor/key-state` with `pressedKeys`.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/main.py`
- `frontend/src/pages/DashboardPage.tsx`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/CONTROL_SIGNAL_FULL_SETUP_GUARD.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Cloud deployment:
- Old server `150.109.100.30`: uploaded updated `/opt/go2rtc-cloud/control_signaling.py`.
- Restarted only `go2rtc-control-signaling`.
- Did not change Nginx, video services, TURN/STUN, or Tank Trouble.
- Note: restarting the broker clears in-memory offer/status counters, but established DataChannels are not routed through the broker.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\main.py backend\models.py`
- `cmd /c npm --prefix frontend run build`
- Remote `python3 -m py_compile /tmp/control_signaling.py`
- Public health `http://150.109.100.30:18081/control/webrtc/health` returned `ok: true`.
- Synthetic public offer/answer on session `codex-status-check` returned `linkStatus.frontendDialing=true`, `backendListening=true`, and `directConnected=true`.

Build/release:
- No EXE built.
- No GitHub push.
- No tag update.

## 2026-05-05 18:43 - Control monitor lamp latency readouts

Scope:
- Control Signal Agent update for the mini app side-channel control monitor.
- Added frontend dialing and backend listening latency display without changing the browser-to-robot WebRTC signaling contract, DataChannel payload, video link, Tank Trouble, ports, TURN/STUN, Nginx paths, or service names.

Changes:
- Cloud broker monitor snapshots now expose optional `latencyMs` / `latencySource` for frontend key-state clients and `frontendLatencyMs` / `backendLatencyMs` in `linkStatus`.
- Frontend key-state can report `latencyMs` / `rttMs`; otherwise the broker/local backend can estimate from `sentAtMs`, `clientSentAtMs`, or `ts`, then fall back to latest-seen freshness.
- Robot receiver polls/answers can optionally report `latency_ms` / `latencyMs` / `rtt_ms` / `rttMs` for the backend listening lamp.
- Dashboard control monitor lamps now render compact latency capsules beside frontend dialing and backend listening.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/main.py`
- `backend/models.py`
- `frontend/src/types/cloud.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\main.py backend\models.py`
- `cmd /c npm --prefix frontend run build`

Cloud deployment note:
- No cloud deployment performed in this step.
- Old server will show fallback `seen` freshness through the local backend until the updated `control_signaling.py` is deployed.
- No app version bump, installer build, GitHub push, or tag update.

## 2026-05-05 17:52 - Service management control signaling URL examples

Scope:
- Control Signal Agent compatibility check after the cloud control signaling contract started requiring `client_id` and `robot_client_id`.
- No service-management start/stop behavior, video link, Tank Trouble, Nginx, cloud service, or DataChannel payload changed.

Changes:
- Confirmed service management `Control Signaling` health/start/stop does not call `browser-offer`, `robot-next-offer`, or `robot-answer`, so its runtime logic does not need protocol adaptation.
- Updated setup/result helper URLs so displayed control examples use `browser-offer?session=robot-control&client_id=frontend-a` and `robot-next-offer?session=robot-control&robot_client_id=arm-001-receiver`.

Files:
- `backend/cloud_setup.py`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\cloud_setup.py backend\main.py backend\models.py backend\cloud_setup_bundle\control_signaling.py`
- Searched current backend/docs/frontend contract URLs; only historical shared-log text still contains the pre-change robot-next-offer URL.

Cloud deployment note:
- No cloud deployment required; this is local metadata/example URL alignment only.
- No app version bump, installer build, GitHub push, or tag update.

## 2026-05-05 17:31 - Require frontend client_id for control browser offers

Scope:
- Control Signal Agent follow-up to remove the old frontend dial rule from the cloud broker.
- No video ingest/playback, Tank Trouble, TURN/STUN, Nginx path, or DataChannel payload format changed.

Changes:
- `POST /control/webrtc/browser-offer` now requires `client_id=<frontendId>` in addition to `session=<robotId>`.
- Old frontend calls with only `session` now return `HTTP 400`.
- Robot `robot-next-offer` responses include `clientId` / `frontendClientId` so the robot side can see which frontend generated the offer.
- Existing robot-side `robot_client_id` exclusivity remains unchanged.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/models.py`
- `frontend/src/types/cloud.ts`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/CONTROL_SIGNAL_FULL_SETUP_GUARD.md`
- `docs/CONTROL_SIGNAL_API_USAGE.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\main.py backend\models.py`
- `cmd /c npm --prefix frontend run build`
- Local temporary broker test: old browser-offer without `client_id` returned `400`; new browser-offer with `client_id=front-a` was pulled by `robot_client_id=robot-a` and completed answer delivery.

Cloud deployment note:
- Deployed updated `control_signaling.py` to old server `150.109.100.30:/opt/go2rtc-cloud/control_signaling.py` and restarted `go2rtc-control-signaling`.
- Public validation on `18081`: old browser-offer without `client_id` returned `400`; new browser-offer with `client_id` completed offer/answer and robot offer included `clientId` / `frontendClientId`; health `200`; monitor key-state `200`.
- No app version bump, installer build, GitHub push, or tag update in this step.

## 2026-05-05 17:06 - Exclusive robot receiver lock for control signaling

Scope:
- Control Signal Agent change to make one robot id / `session` accept only one active robot-side receiver at a time.
- No video ingest/playback, go2rtc video, Tank Trouble, or control DataChannel payload format changed.

Changes:
- Cloud control broker now requires robot receivers to pass a stable `robot_client_id` on `robot-next-offer` and `robot-answer`.
- The first active `robot_client_id` claims the listener slot for that `session`; a second different receiver gets `HTTP 409` with `error=robot_listener_conflict` while the first receiver is fresh.
- Repeated polls and answers from the same `robot_client_id` remain accepted, so a normal polling receiver is not blocked by its own loop.
- Broker status and monitor `linkStatus` now expose receiver diagnostics including `robotListenerClientId`, listener age/freshness, and conflict count.
- Desktop backend receiver-style compatibility APIs and frontend legacy wrappers now pass `robot_client_id`.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/main.py`
- `backend/models.py`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/CONTROL_SIGNAL_FULL_SETUP_GUARD.md`
- `docs/CONTROL_SIGNAL_API_USAGE.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\main.py backend\models.py`
- Local temporary broker test with `aiohttp`: same `robot_client_id` repeated polls returned `204`, second `robot_client_id` returned `409`, wrong receiver answer returned `409`, correct receiver answer returned `200`, and browser offer returned the answer.

Cloud deployment note:
- Deployed updated `control_signaling.py` to old server `150.109.100.30:/opt/go2rtc-cloud/control_signaling.py` and restarted `go2rtc-control-signaling`.
- Public validation on `18081`: health `200`, same receiver repeated poll `204`, second receiver `409`, wrong receiver answer `409`, correct receiver answer `200`, browser offer returned answer, monitor key-state `200`.
- No app version bump, installer build, GitHub push, or tag update in this step.

## 2026-05-05 16:18 - Centered visible-width control monitor keyboard and v0.3.60 installer

Scope:
- UI Design Agent refinement for the service-management control monitor keyboard after screenshots showed crooked rows and right-edge clipping.
- Fixed keyboard layout only; no cloud deployment, video link behavior, Tank Trouble rules, or control DataChannel payload logic changed.

Changes:
- Replaced per-row centering with one centered keyboard track so standard row offsets no longer appear visually crooked.
- The responsive fitting code now intersects the keyboard with horizontally clipping ancestors and the visual viewport, then reveals extra columns only when they fit in the actually visible area.
- Removed invisible trailing grid columns on shorter rows so `ZXCVBNM` can no longer reserve empty columns and push the track out of the panel.
- Baseline `QWER / ASDF / ZXCV` remains visible; if needed, keycaps shrink within their square shape before any baseline key clips.

Version:
- Desktop app version bumped from `0.3.59` to `0.3.60`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.60_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.60_x64-setup.exe`.

Cloud deployment note:
- No cloud deployment was performed.
- No GitHub push, tag update, or silent install was performed.

## 2026-05-05 15:53 - Conservative control monitor keyboard fitting and v0.3.59 installer

Scope:
- UI Design Agent refinement for the service-management control monitor keyboard responsive fitting.
- Added a stronger fitting reserve after screenshots still showed edge clipping at zoomed/narrow widths.
- Did not change cloud deployment, video link behavior, Tank Trouble rules, or control DataChannel payload logic.

Changes:
- Responsive visible-column calculation now reserves roughly half a key before revealing extra columns.
- Narrow keycap minimum was reduced so the required baseline `QWER / ASDF / ZXCV` can fit more comfortably.
- Extra columns still reveal progressively only when they fit with the reserve.

Version:
- Desktop app version bumped from `0.3.58` to `0.3.59`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/UI_DESIGN_AGENT.md`
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.59_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.59_x64-setup.exe`.

Cloud deployment note:
- No cloud deployment was performed.
- No GitHub push, tag update, or silent install was performed.

## 2026-05-05 15:44 - Control monitor full-column fitting and v0.3.58 installer

Scope:
- UI Design Agent refinement for the service-management control monitor keyboard responsive fitting.
- Fixed the case where an extra right-side key column could be partially clipped instead of being hidden.
- Did not change cloud deployment, video link behavior, Tank Trouble rules, or control DataChannel payload logic.

Changes:
- Keyboard column fitting now tests each candidate visible column count against the widest rendered row.
- Extra right-side key columns are shown only when the entire column fits inside the keyboard panel.
- Added a small subpixel safety margin for zoomed layouts.
- Control monitor rows now use `box-sizing: border-box` so padding offsets are included in row width.
- Baseline `QWER / ASDF / ZXCV` remains visible at the narrowest supported widths.

Version:
- Desktop app version bumped from `0.3.57` to `0.3.58`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.58_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.58_x64-setup.exe`.

Cloud deployment note:
- No cloud deployment was performed.
- No GitHub push, tag update, or silent install was performed.

## 2026-05-05 15:27 - Responsive expanding control monitor keyboard and v0.3.57 installer

Scope:
- UI Design Agent refinement for the service-management control monitor keyboard and link-lamp layout.
- Made the virtual keyboard adaptively reveal more right-side keys as its available width grows.
- Did not change cloud deployment, video link behavior, Tank Trouble rules, or control DataChannel payload logic.

Changes:
- Control monitor keyboard now always starts from `QWER / ASDF / ZXCV`.
- When width allows, it reveals extra standard-keyboard columns in order:
  - `T/G/B`
  - `Y/H/N`
  - then farther-right keys such as `U/J/M`, `I/K`, `O/L`, `P`.
- Keyboard rows stay centered as the visible key count changes.
- Keycaps remain square and keep standard half-key row offsets.
- The three control link lamps are restored to a horizontal three-column layout.
- Added a `ResizeObserver` so window zooming/resizing updates the visible key count without a refresh.

Version:
- Desktop app version bumped from `0.3.56` to `0.3.57`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.57_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.57_x64-setup.exe`.

Cloud deployment note:
- No cloud deployment was performed.
- No GitHub push, tag update, or silent install was performed.

## 2026-05-05 15:11 - Standard control monitor keyboard offsets and v0.3.56 installer

Scope:
- UI Design Agent refinement for the service-management control monitor keyboard and link-lamp layout.
- Corrected the visible `QWER / ASDF / ZXCV` monitor keyboard to follow standard keyboard half-key offsets.
- Did not change cloud deployment, video link behavior, Tank Trouble rules, or control DataChannel payload logic.

Changes:
- Control monitor keyboard rows now use fractional CSS offsets instead of whole-grid column shifts:
  - `Q W E R`: no offset.
  - `A S D F`: slight right shift like the Caps Lock/home row.
  - `Z X C V`: larger right shift like the Shift row.
- Control monitor keycaps now use `aspect-ratio: 1 / 1` and a stable key-size variable so they remain square.
- The three control link lamps now stack vertically at all widths.
- Updated UI/control handoff docs to record square keycaps, half-key offsets, and vertical link lamps.

Version:
- Desktop app version bumped from `0.3.55` to `0.3.56`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.56_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.56_x64-setup.exe`.

Cloud deployment note:
- No cloud deployment was performed.
- No GitHub push, tag update, or silent install was performed.

## 2026-05-05 15:00 - Control monitor QWER keyboard layout and v0.3.55 installer

Scope:
- UI Design Agent refinement for the service-management control monitor keyboard.
- Reduced the displayed key set to the requested control keys only.
- Did not change cloud deployment, video link behavior, Tank Trouble rules, or control DataChannel payload logic.

Changes:
- Control monitor keyboard now shows only `Q W E R`, `A S D F`, and `Z X C V`.
- Rows use normal keyboard-style offsets: top row starts first, home row shifts right, bottom row shifts farther right.
- Removed the wider mixed-key monitor layout from the visible keyboard while preserving existing key-state normalization and multi-client key highlighting.
- Updated UI/control handoff docs to record the current limited key layout.

Version:
- Desktop app version bumped from `0.3.54` to `0.3.55`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.55_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.55_x64-setup.exe`.

Cloud deployment note:
- No cloud deployment was performed.
- No GitHub push, tag update, or silent install was performed.

## 2026-05-05 14:51 - Control monitor link lamps and v0.3.54 installer

Scope:
- Control Signal/UI Design Agent crossover for the service-management control monitor panel.
- Added status plumbing and UI lamps for frontend dialing, backend listening, and frontend-to-robot direct connection.
- Did not change video link behavior, Tank Trouble rules, or real DataChannel control payloads.

Changes:
- Cloud control signaling broker now includes `linkStatus` in `/control/monitor/key-state` snapshots.
- Local backend augments control monitor key-state responses with compatible `linkStatus` by reading `/control/webrtc/status` when needed.
- Control monitor panel now displays three compact lamps:
  - `閸撳秶顏幏銊ュ娇`: pending browser offer or active frontend dialing/connecting state.
  - `閸氬海顏幒銉ユ儔`: robot receiver has polled `robot-next-offer` within the recent freshness window.
  - `閻╃绻涢幋鎰`: active frontend reports `callState` as connected/open/live/ready.
- Added responsive/dark-theme styling for the three-lamp strip.
- Documented that the broker cannot directly observe DataChannel connectivity after answer delivery, so direct-connect confirmation depends on frontend side-channel `callState`.

Version:
- Desktop app version bumped from `0.3.53` to `0.3.54`.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/main.py`
- `backend/models.py`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `frontend/src/types/cloud.ts`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\main.py backend\models.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.54_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.54_x64-setup.exe`.

Cloud deployment note:
- Cloud script changed locally but was not deployed to the server in this step.
- Existing cloud servers can still provide partial lamp data through the local backend fallback from `/control/webrtc/status`; direct-connect needs frontend `callState` reports.
- No GitHub push, tag update, or silent install was performed.

## 2026-05-05 14:33 - Control monitor normal keyboard layout and v0.3.53 installer

Scope:
- UI Design Agent refinement for the service-management control monitor keyboard layout.
- Adjusted visual layout only; no cloud scripts, backend APIs, video link logic, control signaling business behavior, or Tank Trouble rules changed.
- Built a new desktop installer because the previous `0.3.52` installer did not include the final equal-width keyboard layout.

Changes:
- Control monitor keyboard now uses a fixed 8-column responsive grid as its normal layout baseline.
- Shorter rows are offset within the 8-column grid instead of stretching across the full keyboard width.
- Letter keys now stay visually equal-width across rows.
- Active keys no longer scale larger; they only lift/glow so pressed and unpressed keycaps keep the same size.
- Updated UI documentation and master UI contract so future keyboard-like controls preserve equal-width letter keys.

Version:
- Desktop app version bumped from `0.3.52` to `0.3.53`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- Playwright/Chrome keyboard layout check against local mock API at 1366x900 and 560x760.
- Verified rows use starts `1, 2, 1, 3` on an 8-column grid.
- Verified no key overflow and no document/body horizontal overflow.
- Verified narrow layout letter keys all measured `47.766px`; desktop side-column layout differed only by browser subpixel rounding (`25.891px` to `25.906px`).
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.53_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.53_x64-setup.exe`.

Cloud deployment note:
- No cloud changes.
- Installer was built and copied; it was not silently installed, pushed, or tagged in this step.

## 2026-05-05 14:22 - v0.3.52 installer build for control monitor UI

Scope:
- Packaging/version update after the UI Design Agent control monitor keyboard responsive fix.
- Built a new desktop installer that includes the Optima keycap font and zoom/narrow-window clipping fix.
- Did not modify cloud scripts, deploy remote services, push GitHub, or update a Git tag.

Version:
- Desktop app version bumped from `0.3.51` to `0.3.52`.

Files:
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/UI_DESIGN_AGENT.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run tauri:build`
- Generated `E:\Desktop\123\cloud-service-console\src-tauri\target\release\bundle\nsis\Cloud Service Console_0.3.52_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.52_x64-setup.exe`.

Cloud deployment note:
- No cloud changes.
- Installer was built and copied; it was not silently installed, pushed, or tagged in this step.

## 2026-05-05 14:15 - Control monitor keyboard responsive UI

Scope:
- UI Design Agent change for the service-management control monitor panel only.
- Changed the mini app control monitor keyboard typography and responsive layout.
- Did not modify cloud scripts, video link logic, control signaling business behavior, Tank Trouble rules, or backend APIs.

Changes:
- Control monitor keycaps now use the Optima font stack with UI-safe fallbacks.
- Control monitor key rows now expose their row length to CSS and render as full-width responsive grids.
- Removed fixed key widths that caused zoomed/narrow windows to clip keys such as `F`, `ESC`, and `ENTER`.
- Added `min-width: 0` and responsive padding/gap constraints around the service side column, control monitor panel, stage, keyboard rows, meta chips, and client rows.
- Clipped only the outer app shell's horizontal paint overflow so zoomed/narrow windows do not get a stray horizontal scroll or hidden controls.
- Updated the shared UI contract to require fixed-format controls to shrink within their panels.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/UI_DESIGN_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- Playwright/Chrome UI check against a local mock API at 1366x900, 980x900, 780x760, and 560x760.
- Verified all 25 control monitor keys stayed inside the keyboard container at each width.
- Verified keycap computed font stack is `Optima, "Optima nova", Candara, "Segoe UI", sans-serif`.
- Verified `body.scrollWidth` and `documentElement.scrollWidth` match the viewport after the outer shell overflow fix.

Cloud deployment note:
- No cloud changes.
- No exe build, GitHub push, or tag update performed.

## 2026-05-04 18:10 - Control signal TURN NAT relay fix

Scope:
- Only touched coturn configuration on `150.109.100.30`.
- Did not touch go2rtc video ingest/playback.
- Did not touch the control-signaling HTTP broker or mechanical-arm receiver logic.
- Did not rebuild the desktop installer in this step.

Changes:
- Investigated browser-side `STUN forbidden IP 403` while using the control-signal WebRTC DataChannel path.
- Found coturn was listening on `0.0.0.0` and using `relay-ip=0.0.0.0`, which made the TURN relay advertise/use an invalid relay address on the Tencent Cloud NAT host.
- Updated `/etc/turnserver.conf` so coturn binds relay traffic to the server private NIC `172.19.0.4` and maps it to public IP `150.109.100.30`.
- Current TURN credentials remain `telemetry / 123456`, with TURN URLs generated by the desktop backend from the currently logged-in host.

Server config:
- `listening-port=3478`
- `listening-ip=172.19.0.4`
- `relay-ip=172.19.0.4`
- `external-ip=150.109.100.30/172.19.0.4`

Validation:
- `systemctl is-active coturn` returned `active`.
- `systemctl is-enabled coturn` returned `enabled`.
- `ss -lntup | grep :3478` showed TCP and UDP listeners on `172.19.0.4:3478`.
- Local `Test-NetConnection 150.109.100.30 -Port 3478` succeeded for TCP.

## 2026-05-04 18:20 - Desktop installer build 0.3.43

Scope:
- Packaging step for the current desktop app source tree.
- Includes the latest Tank Trouble source changes, dynamic current-server monitor URLs, isolated Tank Trouble setup, and the local control-monitor TURN host generation code.
- The coturn NAT fix itself is a server-side configuration change on `150.109.100.30`; it is documented here but not bundled into the exe.

Version:
- Desktop app version bumped from `0.3.42` to `0.3.43`.

Files:
- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

## 2026-05-04 18:35 - Tank Trouble public path proxy setup

Scope:
- Only touched Tank Trouble desktop backend deployment logic and the Tank Trouble cloud spectator page asset paths.
- Did not modify go2rtc video service paths.
- Did not modify control-signal broker paths.

Changes:
- Fixed Tank Trouble one-click setup failing with `Tank Trouble latency server did not become ready: timed out` when cloud security groups do not expose public port `18086`.
- One-click setup now installs an isolated nginx proxy prefix under the existing public HTTP gateway: `/tank-trouble/` on port `18081`.
- Desktop Tank Trouble HTTP sync and spectator URLs now use `http://<host>:18081/tank-trouble/...` instead of requiring direct public access to `:18086`.
- One-click setup now safely clears orphaned old `tank_trouble_room.py` listeners on `18086` before restarting the systemd-managed service, preventing `Address already in use`.
- The cloud spectator page now uses relative asset and state URLs so it works correctly behind the `/tank-trouble/` prefix.

Files:
- `backend/tank_trouble_cloud.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `python -m py_compile backend\tank_trouble_cloud.py backend\cloud_setup_bundle\tank_trouble_room.py backend\main.py backend\models.py` passed.
- `cmd /c npm --prefix frontend run build` passed.
- Deployed to `150.109.100.30` and verified setup returned `ready=True`.
- `http://150.109.100.30:18081/tank-trouble/health` returned `200 {"ok": true, "idle_timeout": 0}`.
- `http://150.109.100.30:18081/tank-trouble/spectator.html?room=tank-trouble-main` returned `200`.
- `http://150.109.100.30:18081/tank-trouble/assets/tank-trouble/powerups/cash.png` returned `200`.

## Latest: Tank Trouble Smoother Laser Rendering

Time: 2026-05-04

Version: `0.3.36`

Scope:

- Only touched Tank Trouble laser visual rendering, embedded spectator laser rendering, documentation, and app version metadata.
- Did not touch laser hit detection, speed, reflection rules, go2rtc, or mechanical-arm control signaling.

Changes:

- Added `strokeLaserPath(...)` to draw a laser beam as one continuous path instead of separately stroking each path segment.
- Laser rendering now bridges tiny segment gaps caused by reflection clearance, making the beam look more continuous.
- Reduced laser glow width, core width, highlight width, and shadow blur slightly.
- Applied the same visual-only rendering adjustment to the embedded monitor/spectator page.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\tank_trouble_cloud.py` passed.
- Embedded spectator page script was extracted from `tank_trouble_room.py` and passed `node --check`.
- `cmd /c npm --prefix frontend run build` passed.

## 2026-05-04 16:20 - Tank Trouble current-server monitor URLs and isolated cloud setup

Scope:
- Only touched Tank Trouble desktop UI, Tank Trouble backend bridge/API/models, and the Tank Trouble cloud room/spectator script.
- Did not touch go2rtc video ingest/playback, nginx video routes, SRT/HTTP ingest switching, or the mechanical-arm/control-signal listener paths.

Changes:
- Removed the hardcoded Tank Trouble monitor URL that pointed at the old `111.230.62.106:18086` server.
- `闁烩晜鍨剁敮鍫曞捶閺夋寧绂坄 now asks the local backend for `/api/games/tank-trouble/spectator/page-url`, so the opened spectator page always uses the currently logged-in cloud host.
- The latency-test web preview entry now also uses the current cloud server spectator page instead of the local preview URL.
- Added a Tank Trouble-only `濞戞挴鍋撻梺娆惧櫍閸樸倗绱旈悽?button in the Tank Trouble launch card.
- Added backend endpoints `/api/games/tank-trouble/setup/check` and `/api/games/tank-trouble/setup/run`.
- Tank Trouble setup uploads only `tank_trouble_room.py` plus `cloud_setup_bundle/www/**` to `/home/<user>/.cloud-service-console/tank-trouble`, installs only the `cloud-service-console-tank-trouble.service` systemd unit, and verifies `:18086/health`.
- Tank Trouble setup does not start, stop, restart, or rewrite any video/go2rtc/control-signal service or config.
- Latency-test sync now mirrors the local player, targets, and clone bullets into the cloud spectator state so the current-server monitor page has live latency-test content.

Files:
- `backend/tank_trouble_cloud.py`
- `backend/main.py`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/styles/globals.css`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `python -m py_compile backend\main.py backend\models.py backend\tank_trouble_cloud.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- `cmd /c npm --prefix frontend run build` passed.
- Cloud deployment to `111.230.62.106:18086` passed health check with `{"ok": true, "idle_timeout": 0}`.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.36_x64-setup.exe`.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Powerup PNG Icons

Time: 2026-05-04

Version: `0.3.35`

Scope:

- Only touched Tank Trouble powerup icon assets/rendering, cloud Tank Trouble static asset serving/upload, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Replaced canvas-drawn powerup symbols with provided centered PNG icons.
- Added bundled powerup icons for cash, shotgun, laser, minigun, and shield.
- Desktop Tank Trouble loads icons from `frontend/public/tank-trouble/powerups`.
- Embedded monitor/spectator page loads the same icons from `/assets/tank-trouble/powerups/...`.
- Tank Trouble cloud deployment now uploads files from `backend/cloud_setup_bundle/www` alongside `tank_trouble_room.py`.
- Icon drawing uses centered, aspect-preserving `drawImage` sizing so each icon sits on the powerup center.
- Existing canvas icons remain as a fallback while PNG images are still loading.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/public/tank-trouble/powerups/*.png`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `backend/cloud_setup_bundle/www/tank-trouble/powerups/*.png`
- `backend/tank_trouble_cloud.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\tank_trouble_cloud.py` passed.
- Embedded spectator page script was extracted from `tank_trouble_room.py` and passed `node --check`.
- `cmd /c npm --prefix frontend run build` passed.
- Cloud deployment to `111.230.62.106:18086` passed health check with `{"ok": true, "idle_timeout": 0}`.
- Cloud PNG asset checks passed for `/assets/tank-trouble/powerups/shield.png` and `/assets/tank-trouble/powerups/cash.png`.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.35_x64-setup.exe`.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Laser Arena Boundary Guard

Time: 2026-05-04

Version: `0.3.34`

Scope:

- Only touched Tank Trouble laser pathing/rendering, cloud room authority, embedded spectator pathing/rendering, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Added an explicit arena-boundary ray hit to laser path generation.
- Laser aim and generated laser paths now reflect from the arena rectangle even if an outer-wall rectangle is missed or a map edge numerical case occurs.
- Laser projectile rendering and laser aim rendering are clipped to the arena rectangle in both the desktop canvas and embedded monitor/spectator page.
- This prevents laser beam/glow/tail segments from appearing outside the playable map.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py` passed.
- Embedded spectator page script was extracted from `tank_trouble_room.py` and passed `node --check`.
- `cmd /c npm --prefix frontend run build` passed.
- Cloud deployment to `111.230.62.106:18086` passed health check with `{"ok": true, "idle_timeout": 0}`.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.34_x64-setup.exe`.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Shield-Aware Laser Aim Prediction

Time: 2026-05-04

Version: `0.3.33`

Scope:

- Only touched Tank Trouble laser path prediction, cloud room authority, embedded spectator pathing, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Laser aim lines now include active visible shields as circular reflection surfaces.
- The same shield-aware ray path is used for desktop prediction, cloud-authoritative laser path generation, and the embedded monitor/spectator page.
- If the laser ray starts inside a shield, that shield is ignored until the ray exits it; this avoids immediate self-reflection while still allowing later shield impacts to bend the aim path.
- Laser firing now passes all visible shields into path generation, relying on the inside-shield guard instead of excluding the shooter shield up front.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py` passed.
- Embedded spectator page script was extracted from `tank_trouble_room.py` and passed `node --check`.
- `cmd /c npm --prefix frontend run build` passed.
- Cloud deployment to `111.230.62.106:18086` passed health check with `{"ok": true, "idle_timeout": 0}`.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.33_x64-setup.exe`.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Shield Invulnerability Fallback

Time: 2026-05-04

Version: `0.3.32`

Scope:

- Only touched Tank Trouble shield damage rules, desktop local/latency hit guards, cloud room authority, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Added `player_has_visible_shield(...)` in the cloud room authority.
- A tank with `shield_visible_until_ms > current_ms` is now skipped by damage resolution for every weapon.
- This makes the full visible shield window invulnerable, including the active shield phase and flicker/fade phase.
- Added `tankHasVisibleShield(...)` in the desktop Tank Trouble component.
- Local training/latency-test hit guards now also skip player/bot/clone damage while the target shield is visible.
- This is a deliberate fallback while laser reflection edge cases are still being investigated: even if a laser spawn/reflection path is inside the shield, the shielded tank will not be destroyed.

Files:

- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py` passed.
- Embedded spectator page script was extracted from `tank_trouble_room.py` and passed `node --check`.
- `cmd /c npm --prefix frontend run build` passed.
- Cloud deployment to `111.230.62.106:18086` passed health check with `{"ok": true, "idle_timeout": 0}`.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.32_x64-setup.exe`.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Self-Hit And Shielded Laser Reflection

Time: 2026-05-04

Version: `0.3.31`

Scope:

- Only touched Tank Trouble projectile/shield rules, desktop rendering/prediction, cloud room authority, spectator page mirror logic, shared protocol models, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Default bullets, shotgun pellets, and minigun bullets now carry `has_bounced`.
- A firing tank is protected from its own non-laser projectiles until that projectile has bounced from a wall or shield.
- After the first wall/shield bounce, non-laser projectiles can self-hit again, matching the intended ricochet rule.
- Laser self-hit behavior remains unchanged: laser still has no self-hit protection.
- Laser path generation now treats shields as reflective colliders with laser radius included, so shield contact is blocked/reflected instead of visually passing through.
- Shield laser clearance is separate from wall clearance, so the reflected beam starts at the shield boundary rather than being backed off like a wall hit.
- The same logic is mirrored in desktop Tank Trouble, the cloud-authoritative room service, and the embedded spectator/monitor page.

Files:

- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py` passed.
- Embedded spectator page script was extracted from `tank_trouble_room.py` and passed `node --check`.
- `cmd /c npm --prefix frontend run build` passed.
- Cloud deployment to `111.230.62.106:18086` passed health check with `{"ok": true, "idle_timeout": 0}`.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.31_x64-setup.exe`.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Laser Wall Clearance And Hit Removal

Time: 2026-05-04

Version: `0.3.27`

Scope:

- Only touched Tank Trouble laser path/render synchronization, cloud room/spectator service protocol, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Laser reflection paths now keep a small wall clearance so the visible thick beam no longer appears to enter wall interiors.
- The same wall-clearance rule is applied in the desktop Tank Trouble renderer, the cloud-authoritative room service, and the embedded spectator/monitor page.
- Tank death events now include `bullet_id`, allowing clients to know exactly which projectile caused the kill.
- When a laser kills a tank, the desktop game and spectator page remove that exact laser immediately instead of playing the normal short projectile fade.
- Natural laser expiry can still use the existing fade, so only confirmed kill removal becomes instantaneous.

Files:

- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- Embedded spectator page script was extracted from `tank_trouble_room.py` and passed `node --check`.
- `cmd /c npm --prefix frontend run build` passed.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Laser Self-Hit Rule

Time: 2026-05-04

Version: `0.3.26`

Scope:

- Only touched Tank Trouble cloud room/spectator service hit rules, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Laser no longer has self-hit protection.
- Default bullets, shotgun pellets, and minigun bullets still keep the existing `SELF_HIT_ARM_DELAY` protection for the firing tank.
- Hitting other players remains immediate for every weapon.

Files:

- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- `cmd /c npm --prefix frontend run build` passed.
- Local rule smoke check passed: the self-hit delay now explicitly excludes `projectile_type == "laser"`.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Unified Weapon Hit Detection

Time: 2026-05-04

Version: `0.3.25`

Scope:

- Only touched Tank Trouble cloud room/spectator service hit detection, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Fixed laser hits not killing tanks reliably.
- Self-hit arming delay now only protects the firing tank itself; hitting another tank is checked immediately for every weapon.
- Default bullets, shotgun pellets, and minigun bullets now use swept segment-vs-tank collision from the previous tick position to the current tick position.
- Laser hit detection now checks the visible laser segments, including the previous tick's visible segment window, so fast short beams do not skip over tanks between server ticks.
- The intended rule is now explicit in code: every weapon kills when its projectile/beam intersects a live tank, with only self-hit delayed by `SELF_HIT_ARM_DELAY`.

Files:

- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- Local mocked import smoke test for `bullet_hit_test` passed: normal sweep hit, normal sweep miss, laser segment hit, and laser cross-frame sweep hit.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Powerup Labels And Weapon Timing Polish

Time: 2026-05-04

Version: `0.3.24`

Scope:

- Only touched Tank Trouble desktop gameplay/rendering, the Tank Trouble cloud room/spectator service bundle, documentation, and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Powerup pickup effects now show text for every current powerup type: `+100`, `SHOTGUN`, `LASER`, and `MINIGUN`.
- Minigun local prediction and cloud-authoritative spawning now emit bullets across the barrel width instead of a single center point.
- Minigun spin-up was reduced from `1.0s` to `0.5s`.
- Laser visible length was reduced from `4` grid cells to `2` grid cells.
- Laser speed was doubled from `20` grid cells per second to `40` grid cells per second.
- Laser lifetime was halved from `0.75s` to `0.375s`.
- The embedded cloud spectator/monitor page was updated to use the same laser length and powerup pickup labels.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- `cmd /c npm --prefix frontend run build` passed.
- Extracted embedded spectator JS from `backend/cloud_setup_bundle/tank_trouble_room.py`; `node --check build-logs\spectator-page-check.js` passed.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Authoritative Laser Path And Minigun Powerup

Time: 2026-05-04

Version: `0.3.23`

Scope:

- Only touched Tank Trouble desktop gameplay/rendering, Tank Trouble preview/monitor state, the Tank Trouble cloud room service bundle, shared Tank Trouble models/types, and documentation.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Reworked laser projectiles around an authoritative reflected path model.
- Laser firing now captures the reflected path at the instant of firing, then advances a 4-grid-cell visible laser window along that stored path for `0.75s`.
- Added `path_segments` and `distance_travelled` to Tank Trouble bullet state so desktop online play, latency preview, and cloud monitor pages can render the same laser path instead of reverse-guessing it from the beam head.
- Improved ray/rectangle corner handling so laser paths reflect correctly when the ray hits a wall corner.
- Added the fourth multiplayer powerup type, `minigun`.
- Minigun pickup gives `weapon: "minigun"` and `20` rounds.
- Minigun firing uses held fire input: `1.0s` spin-up, `1.0s` release grace before spin-up resets, `10` rounds per second, `2.2` grid-cell-per-second bullets, `3.0s` bullet lifetime, and bullet radius `1/2` normal bullet size.
- Minigun bullets are independent of the normal 5-bullet cap.
- Desktop online play predicts minigun bullets locally while still sending `fire_held` to the cloud room service for authoritative state and remote players.
- Testing-stage multiplayer powerup spawning now ensures one of every available kind (`cash`, `shotgun`, `laser`, `minigun`) appears when a map starts or changes.
- Testing-stage powerups respawn at their original position `2s` after pickup.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/tank_trouble_preview_runtime.py`
- `backend/tank_trouble_preview_page.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- `cmd /c npm --prefix frontend run build` passed.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Shotgun Speed And Laser Refraction Polish

Time: 2026-05-04

Version: `0.3.22`

Scope:

- Only touched Tank Trouble desktop gameplay/rendering, cloud room/spectator rendering, and documentation.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Changed shotgun pellet speed from `2.0-2.5` grid cells per second to `4.0-4.2` grid cells per second.
- Changed shotgun pellet lifetime from `3.5` seconds to `1.5` seconds.
- Improved laser emitter readability by replacing the side-facing emitter marker with a forward-facing triangular tip.
- Kept the laser emitter within the same sci-fi tank material/glow style as the current tank renderer.
- Reworked laser aim guide rendering from a simple dashed line to a subtle guide line with animated dots and short light segments.
- Reworked laser projectile rendering so the visual beam is a 4-grid-cell segment that folds/reflets visually when its segment intersects walls.
- Added reverse reflected segment construction for laser beam rendering in desktop and cloud monitor renderers.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `cmd /c npm --prefix frontend run build` passed.
- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- Extracted embedded cloud spectator script to `build-logs\spectator-page-check.js`; `node --check build-logs\spectator-page-check.js` passed.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Laser Powerup And Projectile Lifetimes

Time: 2026-05-03

Version: `0.3.21`

Scope:

- Only touched Tank Trouble desktop gameplay, cloud room/spectator state, shared rendering/protocol use, and documentation.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Restored rotating powerup outer arcs while keeping inner powerup icons fixed.
- Changed powerup icon rendering to `source-over` after the additive halo/body pass so icons remain visible in dark mode.
- Reworked the cash icon into a heavier gold double-stroke dollar silhouette.
- Kept shotgun icon fixed inside the pickup while the outer pickup body breathes/rotates.
- Changed shotgun pellet lifetime from normal bullet life to `3.5` seconds in both desktop prediction and cloud authority.
- Added laser constants and projectile handling:
- `LASER_SPEED = 20` grid cells per second.
- `LASER_LIFE = 0.75` seconds.
- `LASER_LENGTH = 4` grid cells.
- `LASER_AIM_LENGTH = 7` grid cells.
- `LASER_RADIUS = 4.4`.
- Added the third multiplayer powerup type, `laser`.
- Updated cloud powerup random selection to cash / shotgun / laser at roughly one-third probability each.
- Laser pickup sets `weapon: "laser"` and clears `shotgun_ammo`.
- Laser-equipped tanks render with a radar-like emitter instead of the default barrel.
- Laser-equipped tanks render a faint player-color dashed aim guide; the guide reflects off walls and is visible to other players and the cloud monitor.
- Laser firing creates one fast beam projectile with `projectile_type: "laser"`, then immediately returns the tank to the default weapon.
- Desktop online play and cloud monitor render laser beams as long glowing line segments instead of round bullets.
- Desktop and cloud monitor share the same reflected aim-line helper logic in their respective renderers.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `cmd /c npm --prefix frontend run build` passed.
- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- Extracted embedded cloud spectator script to `build-logs\spectator-page-check.js`; `node --check build-logs\spectator-page-check.js` passed.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Shotgun Powerup And Minimal Kill Feed

Time: 2026-05-03

Version: `0.3.20`

Scope:

- Only touched Tank Trouble desktop gameplay, cloud room/spectator state, shared API models, and documentation.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Removed the kill-feed outer panel in desktop online play and the cloud monitor page.
- Removed hyphen separators from kill feed text. Normal format is `killerID weapon-icon victimID`; suicide format is `skull-icon victimID`.
- Increased kill-feed scale again to 28px text / 30px weapon icon while keeping player IDs color-coded by tank color.
- Replaced the cash powerup text glyph with a canvas-drawn double-stroke dollar icon so dark mode is readable and not font-dependent.
- Stopped rotating powerup icons; powerups now keep only the breathing/pulse animation.
- Added a second multiplayer powerup type: `shotgun`.
- Powerup spawning now randomly selects between `cash` and `shotgun`, currently 50% / 50%.
- Shotgun pickup grants `weapon: "shotgun"` and `shotgun_ammo: 3`.
- Shotgun tank rendering uses a shorter, wider barrel with a reload kick during cooldown.
- Shotgun fire launches 16 pellets in a 30-degree cone, with per-pellet random speed from 2.0 to 2.5 grid cells per second.
- Shotgun pellet radius is one third of a normal bullet, and pellets keep the shooter's color.
- Shotgun pellets are independent from the normal 5-bullet cap.
- Shotgun firing uses a 1.5-second cooldown and decrements ammo; after 3 shots, the tank returns to the default barrel.
- Desktop online play now ejects a shell casing on local shotgun fire and when remote shotgun pellet batches appear.
- Cloud spectator/monitor page also renders shotgun pellets, shotgun barrel state, shell casing effects, cash/shotgun powerup visuals, and the same minimal kill feed.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/tank_trouble_preview_runtime.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- version files: `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`

Validation:

- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\cloud_setup_bundle\tank_trouble_room.py` passed before packaging.
- `cmd /c npm --prefix frontend run build` passed before packaging.
- Extracted embedded cloud spectator script to `build-logs\spectator-page-check.js`; `node --check build-logs\spectator-page-check.js` passed before packaging.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Kill Feed Color And Scale Tuning

Time: 2026-05-03

Version: `0.3.19`

Scope:

- Only touched Tank Trouble kill-feed rendering and shared kill-event fields.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Added `killer_color` and `victim_color` to Tank Trouble death/tank explosion events.
- Desktop online kill feed now renders player IDs in their tank colors.
- Cloud spectator/monitor kill feed uses the same player-color rendering.
- Increased kill-feed scale from 17px text / 18px icon / 36px panel to 22px text / 24px icon / 44px panel.
- Added a slightly stronger panel shadow and text glow so kill messages are easier to read.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:

- Will rerun Python compile, frontend build, and embedded spectator JS syntax check before packaging.

## Latest: Tank Trouble Powerup Cadence, Kill Feed, And In-Map HUD Cleanup

Time: 2026-05-03

Version: `0.3.18`

Scope:

- Only touched Tank Trouble desktop gameplay, cloud room/spectator state, shared API models, and documentation.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm control signaling or the control listener.

Changes:

- Fixed multiplayer powerup cadence in `backend/cloud_setup_bundle/tank_trouble_room.py`.
- Powerup cap is now exactly `2 * active_player_count - 1`.
- The first active player starts a 5-second timer. When the timer fires, the server spawns exactly one powerup.
- If the room is below cap after a spawn, the server schedules the next 5-second timer.
- If the room reaches cap, spawning pauses. When a player picks up one powerup and the room drops below cap, the server starts a fresh 5-second timer instead of refilling immediately.
- If the last player leaves or times out, cloud state immediately clears `powerups`, `powerup_effects`, and the powerup timer fields.
- Added kill metadata to the existing `tank_explosions` event stream: `killer_id`, `victim_id`, `weapon`, and `suicide`.
- Desktop online play now renders a single-line kill feed outside the map, in the stage area above the arena top-right.
- Kill feed format is `killerID - weapon icon - victimID`; suicide format is `skull icon - victimID`.
- Weapon icons are isolated in `drawBulletWeaponIcon`, `drawSkullWeaponIcon`, and `drawKillWeaponIcon` so future icon edits stay localized.
- Online tank name labels now show only the player ID, with no country/region suffix.
- Removed in-map `V1.0 / player ID`, map tag, latency header, and respawn countdown text from Tank Trouble canvas views.
- Powerup visuals now have light/dark palette variants. The `$` symbol is larger than the inner core while staying inside the outer halo.
- Cloud spectator/monitor page now mirrors the powerup visual palette and kill feed behavior.

Files:

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:

- `python -m py_compile backend\models.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- `cmd /c npm --prefix frontend run build` passed before version/doc updates and will be rerun for the final package.
- Extracted embedded cloud spectator script to `build-logs\spectator-page-check.js`; `node --check build-logs\spectator-page-check.js` passed.

Deployment note:

- Cloud deployment target remains only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Do not restart or modify go2rtc video services for this change.
- Do not restart or modify the mechanical-arm/control-signal listener for this change.

## Latest: Tank Trouble Shared Visual Effects And Destruction Particles

Time: 2026-05-03

Version: `0.3.16`

Goal:

- Add tank-destruction effects with explosion particles and a shockwave.
- Use the destroyed tank's own color as the main explosion / shockwave color.
- Reduce future visual drift between Tank Trouble modes when map, tank, wall, bullet, or polish details are changed.

Implementation:

- `frontend/src/components/TankTroublePanel.tsx`
  - Added shared `TankExplosionEffect` / `TankExplosionParticle` canvas state.
  - Added shared helpers: `createTankExplosion`, `advanceTankExplosions`, and `drawTankExplosions`.
  - Added `drawSharedTankSprite` so training, latency-test, and online desktop modes now draw tanks through one shared tank renderer.
  - Local training deaths now trigger an explosion before respawn.
  - Bot deaths now trigger an explosion before respawn.
  - Latency clone hits now trigger an explosion using the clone tank color.
  - Online local / remote player deaths trigger an explosion only on the `alive=true -> alive=false` transition.
  - Map changes and latency-state clearing remove leftover explosion effects.
- Version files were bumped to `0.3.16`.

Visual Maintenance Rule:

- For desktop in-app Tank Trouble modes, update shared helpers in `frontend/src/components/TankTroublePanel.tsx` first:
  - Tank look: `drawSharedTankSprite`
  - Tank destruction: `createTankExplosion`, `advanceTankExplosions`, `drawTankExplosions`
  - Player color palette: `getPlayerPalette`
- Do not add separate per-mode tank / explosion drawing unless there is a deliberate gameplay reason.
- Browser monitor / browser latency preview still render through backend-generated JS in `backend/tank_trouble_preview_page.py` and `backend/cloud_setup_bundle/tank_trouble_room.py`; for true one-edit visual sync across desktop and browser, the next architecture step should extract a shared render/style asset that both desktop and browser pages load.

Boundaries:

- No go2rtc video ingest / playback changes.
- No mechanical-arm control signaling changes.
- No Tank Trouble cloud scoring, death authority, respawn timing, or network protocol changes.

Verification:

- `cmd /c npm run build`
- `python -m py_compile backend\main.py backend\models.py backend\config.py backend\settings_store.py`

## Latest: Tank Trouble Keybinding Edit Gate

Time: 2026-05-03

Version: `0.3.15`

Goal:

- Make Tank Trouble key binding changes explicit so viewing the controls cannot accidentally start key capture.

Implementation:

- `frontend/src/components/TankTroublePanel.tsx`
  - Added a local `controlBindingEditOpen` state.
  - The key binding grid is read-only by default.
  - Users must click `閻犱礁澧介悿鍝?before any action button can capture a new key.
  - Clicking `閻庣懓鏈崹姝?exits edit mode and clears any pending key capture.
  - Captured keys still only change the local `event.code -> forward/backward/left/right/fire` mapping.
- `frontend/src/styles/globals.css`
  - Added a compact `閻犱礁澧介悿?/ 閻庣懓鏈崹姝?pill button.
  - Read-only key buttons keep their display styling but no longer behave like clickable controls.
  - Edit mode restores clickable hover / capture feedback.

Boundaries:

- No cloud room protocol changes.
- No go2rtc video ingest / playback changes.
- No mechanical-arm control signaling changes.

Notes:

- Tank destruction effects are feasible as a local canvas rendering feature. Recommended implementation is to trigger particles / shock rings when a tank transitions from `alive=true` to `alive=false`, and to keep scoring / respawn authority unchanged.

Verification:

- Pending in this working session.

## Latest: Login Defaults, Setup Password Guard, And Tank Trouble Local Controls

Time: 2026-05-03

Version: `0.3.14`

Goal:

- Make fresh installs start with an empty server Host instead of a prefilled cloud IP.
- Require a second SSH password entry before the one-click cloud setup can run.
- Polish Tank Trouble scoreboard spacing / hover behavior.
- Let each desktop player customize Tank Trouble keys locally without changing the cloud protocol.

Implementation:

- `backend/config.py`, `backend/settings_store.py`, `frontend/src/pages/LoginPage.tsx`
  - Built-in default Host is now empty.
  - Saved empty Host remains empty instead of silently falling back to an old default.
  - Login still keeps `ubuntu`, SSH `22`, HTTP `18081`, and other built-in defaults.
- `backend/main.py`, `backend/models.py`, `frontend/src/api/cloudApi.ts`, `frontend/src/pages/DashboardPage.tsx`
  - `/api/local-setup/run` now requires `{ password }`.
  - Backend compares that password with the currently logged-in SSH password before checking readiness or running cloud setup.
  - Dashboard opens a confirmation dialog first; no setup script runs until the password is verified.
- `frontend/src/components/TankTroublePanel.tsx`
  - Added local key bindings stored in `localStorage` under `cloud-service-console:tank-trouble-control-bindings`.
  - Default keys remain `W / S / A / D / Space`.
  - Custom keys only affect local keyboard-event mapping. The cloud still receives the stable `forward / backward / left / right / fire_seq` payload shape.
  - Launch card copy now focuses on local key setup, and the canvas title now shows `V1.0`.
- `frontend/src/styles/globals.css`
  - Added styling for the setup password dialog and Tank Trouble key binding grid.
  - Compressed scoreboard rank / latency / flag / ID spacing.
  - Changed scoreboard-row hover from a left shift to a soft lift so the left border stays visually stable.

Boundaries:

- No go2rtc video ingest / playback changes.
- No mechanical-arm control signaling changes.
- No Tank Trouble cloud room protocol changes beyond existing fields; key remapping is local-only.

Verification:

- `cmd /c npm run build`
- `python -m py_compile backend\main.py backend\models.py backend\config.py backend\settings_store.py`

## Latest: Tank Trouble Multiplayer Fire Sequence And Map Reset Fix

Time: 2026-05-03

Version: `0.3.13`

Goal:

- Fix multiplayer edge cases found during two-PC testing.
- Prevent post-map-change local-only bullets that are invisible to monitor / other players.
- Keep the global rule that each player may have at most 5 active bullets.

Implementation:

- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - Added per-player combat-state reset for map changes: cooldown, latest accepted fire sequence, and input state are cleared while score / hits / deaths remain preserved.
  - Cloud now returns `fire_ack_seq` in the local match state so the desktop client can explicitly align its local fire counter with the authoritative room.
  - `fire_ack_seq` means the cloud has processed that fire event. If cooldown or the 5-bullet cap rejects the shot, the client fades out the local prediction instead of leaving a ghost bullet or queueing a delayed shot.
  - The 5-bullet cap now counts all active bullets for the owner player, not only bullets from the current revision.
  - Match sync requests include the client `map_seed`; if the client is still on an old map during a map switch, the cloud ignores that request's movement / fire data and sends back the current map state.
- `frontend/src/components/TankTroublePanel.tsx`
  - Online engine resets local fire queue / sequence on authoritative map changes.
  - Local fire sequence is raised to the cloud `fire_ack_seq` when state arrives, making reconnects and map changes deterministic.
  - Predicted local bullets are tagged with their fire sequence and removed once the cloud has processed but not materialized that shot.
  - Online sync payload now includes the current client `map_seed`.
- `frontend/src/types/cloud.ts` and `backend/models.py`
  - Added `map_seed` to match sync requests.
  - Added `fire_ack_seq` to match local state.

Boundaries:

- Only Tank Trouble multiplayer room / desktop game sync behavior changed.
- No go2rtc video ingest / playback changes.
- No mechanical-arm control signaling changes.
- Tank Trouble cloud room service still uses port `18086`.

Verification:

- Pending in this working session.

## Latest: Tank Trouble Latency Badges, Ghost Bullet Cleanup, And Preview Style Sync

Time: 2026-05-03

Version: `0.3.10`

Goal:

- Show each player's latency on Tank Trouble scoreboards.
- Fix ghost bullets on the cloud `闁烩晜鍨剁敮鍫曞捶閺夋寧绂坄 spectator page.
- Make the latency-test browser preview match the in-app Tank Trouble visual style.

Implementation:

- `frontend/src/components/TankTroublePanel.tsx`
  - Added WebSocket RTT measurement keyed by `input_seq`.
  - Smooths RTT samples and sends `latency_ms` in later online match sync payloads.
  - Scoreboard rows now render `xxms` before the flag, using green / yellow / red threshold colors.
- `frontend/src/styles/globals.css`
  - Added compact latency badge styles for light and dark themes.
- `frontend/src/types/cloud.ts`
  - Added optional `latency_ms` to room, match, local player, and preview row types.
- `backend/models.py`
  - Added `latency_ms` to Tank Trouble API models.
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - Normalizes and stores player `latency_ms`.
  - Includes latency in active player summaries, match players, local player state, and spectator state.
  - Adds latency badges to the cloud spectator scoreboard.
  - Filters expired bullets from spectator snapshots.
  - Removes local `renderBullets` immediately when authoritative snapshots no longer contain them.
  - Clears local spectator bullets when the room has no active players and no authoritative bullets.
  - Fixes fallback spectator bullet bounce cleanup indentation so both X and Y bounces consume a bounce and reposition.
- `backend/tank_trouble_preview_page.py`
  - Adds latency badges to the local browser preview scoreboard.
  - Updates wall and tank canvas drawing to match the desktop / cloud sci-fi Tank Trouble style.
- `backend/tank_trouble_preview_runtime.py`
  - Preview rows now copy real `latency_ms`, score, and country data from active room players when available.

Boundaries:

- Only Tank Trouble game, spectator, and local preview behavior changed.
- No go2rtc video ingest / playback changes.
- No mechanical-arm control signaling changes.
- No port changes; Tank Trouble cloud room service remains on `18086`.

Verification:

- `python -m compileall backend`
- `cmd /c npm run build`
- `node --check build-logs\spectator-page-check.js`
- `node --check build-logs\preview-page-check.js`
- Deployed `backend/cloud_setup_bundle/tank_trouble_room.py` to `111.230.62.106`.
- `http://111.230.62.106:18086/health` returned `{"ok": true, "idle_timeout": 0}`.

## Latest: Tank Trouble Monitor Local Render Smoothing

Time: 2026-05-03

Goal:
- Improve visible smoothness on the cloud `闁烩晜鍨剁敮鍫曞捶閺夋寧绂坄 spectator page without increasing server workload or touching video/control chains.

Implementation:
- Updated `backend/cloud_setup_bundle/tank_trouble_room.py`.
- Added browser-side snapshot buffering for `/spectator/state`.
- Render now uses `requestAnimationFrame` against interpolated server-time snapshots.
- Added a small `85ms` interpolation delay to absorb jitter.
- Added up to `90ms` local extrapolation for tanks and bullets when a fresh snapshot is slightly late.
- Cached static background and wall base rendering into an offscreen canvas.
- Kept animated wall scans, targets, tanks and bullets in the per-frame dynamic draw path.
- Throttled sidebar DOM updates to reduce layout/reflow overhead.

Boundaries:
- Does not touch go2rtc video ingest/playback.
- Does not touch mechanical-arm control signaling.
- Does not change online player input submission or room write APIs.

Verification:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py`
- `python -m compileall backend`
- `cmd /c npm run build`
- `node --check build-logs\spectator-page-check.js`

閺夆晜鐟ら崬銈夊籍閵夈儳绠堕柣顫妺缁剟骞庢繝鍌滅Ъ闁告挸绉撮惃顒傜矙鐎ｎ亞纰嶅ù鐘查缁辨垶鎱ㄧ€ｎ亜鐓傞柣婊勬緲濠€顏堟儍閸曨偆鏉介柣婊勫缁诲啰绮欑€ｎ偅娈婚柣鐐叉閸ゎ參寮堕妷顖滅闁哄倿鈧稓鈹掗柛姘捣閻?agent 闊浂鍋婇埀顒傚枔閹﹦鎲撮敐鍌楀亾濠娾偓鐠愮喐绂掗埀顒佺▕閸粎绐楅梻鈧幐搴＄亣闁绘粍婢樺﹢顏呮交濞嗘劗澹夐柍銉︾缚閳?
閻犲洤鐡ㄥΣ鎴︽晬?
- 閺夆晜鐟﹀Σ鍛婄▔閳ь剚绂掗懞銉у闁硅鍠栫紞瀣礈瀹ュ嫮娉㈤幖瀛樻尵婵悂骞€娴ｇ鍋撴担鍝勭疀閻庢稒蓱閺嬪啫顩奸敐鍛閺夆晝鍋熼悽濠氬础韫囧海绋婇悹浣规緲缂嶅秹鏌屽鍛处闁告垹鍎ゅ鐢告儍閸曨偂绱ｇ紒瀣儐濡晞绠涘灏栧亾?- 閻庣懓鍟ú鍧楀礂閾忣偅鏆堥梻鍐煐椤斿矂濡存担绛嬪晭閻犱讲鈧啿鏋€缂佹稒鐗撻埀顑跨閸櫻囨煥椤旇姤鏆柛鏂诲妼閹风増绌卞┑鍫熸畬缂佹拝闄勫顐︽晬瀹€鍐ｅ亾鐏炶偐鐟濋柡鍕靛灟瀵寮介懖鈺傜暠闁告帒妫濋幐鎾剁棯瑜庤ぐ浣圭閵堝懎鍧婇柛娆忕湴閳?- 闁哄倸娲ｅ▎銏㈢磽閺嶎偆鍨崇紓浣哄枍缁斿瓨鎷呯捄銊︽殢 UTF-8闁?- 濞寸姰鍎遍幃妤呭矗椤忓浂娲ｇ紓浣堝懐鏁惧ǎ鍥跺枟閺?`cloud-service-console` 閺夆晜鐟ラ〃婊呬焊韫囨洍鏌ら幖鏉戠箳濞堟垿宕濋悢璇插幋濞寸媴绲块悥婊堟晬鐏炶姤鐨戦幖瀛樻煥閹挸顫㈤妷锔界函闁哄倹濯界换鏍ㄧ閼恒儲锛夐煫鍥ㄣ仠閳?
## 闂傚啳鍩栭?0闁挎稒淇虹缓鑲╃矓閼姐倖绐楅柡宥呮川閳ユ鈧?
閻犙囶棑閸嬶綁鏁?
- 闁哄唲鍕粯闁告帟娉涜ぐ瀵糕偓娑櫭﹢顏堟晬鐏炶偐绋婚梻鍥ｅ亾閻熸洑娴囩缓鑲╃矓鐠囨彃鐓傞柡鍥ь嚟楠炲洦绂掗敐鍥ㄧ暠婵℃鐭傚浼村几閼哥數鈧垶濡?- 闁烩晩鍠楅悥锝嗙▔瀹ュ棙笑缂備綀鍛暰闁?Tkinter闁挎稑鐭侀埀顒€鏈Σ姝屻亹閵忊€崇亣闁哄倹澹嗗▓鎴濐浖瀹€鍕〃閹煎瓨姊婚弫銈嗘媴閹惧爼鍏囬柕?
闁哄秶顭堢缓楣冨礃瀹曞洨鎽滈柨?
- UI 闁瑰箍鍨洪崹?`React + TypeScript`
- 闁哄牜鍓欏﹢鎾箳瑜嶉崺妤呮焻閺勫繒甯嗗ǎ鍥ㄧ箘閺嗏偓闁?`Python + FastAPI`
- 婵℃鐭傚鐗堢珶閸忓懎鈻忛柣?`Tauri`
- SSH闁靛棔妞掔花顖滅博椤栨稒绠涢柛鏂哄墲鐢爼宕氶煬娴嬪亾娴ｉ晲娣幖鎾敱椤ュ懘寮婚妷褎鍩涚紓渚囧幘閺?Python 閻犳劗鍠曢惌妤呮晬鐏炶偐鐟濋弶鈺傜☉婢х姷绮?
閻庣數鎳撶花鏌ュ籍閳哄倹鍩傞悹鍥х摠濡叉垿鏁?
- 闁哄秴婀卞ú鎷屻亹?`README.md`
- 闁哄秴婀卞ú鎷屻亹?`AGENT_V3_MIGRATION_GUIDE.md`

## 闂傚啳鍩栭?1闁挎稒鐡? 鐎规悶鍎抽埢鍏碱殽閵婏妇浠哥€点倛娅ｉ悵?

濞戞挻妲掗々锔剧磼閹惧浜柨?
- 鐎点倛娅ｉ悵?`frontend/` 闁告挸绉堕顒€顔忛妷褉鏌?
- 鐎点倛娅ｉ悵?`backend/` FastAPI backend
- 鐎点倛娅ｉ悵?`src-tauri/` 婵℃鐭傚鐗堢珶?- 闁告挸绉撮幃妤冪博椤栫偐鍋撳宕囩畺 HTTP API 閻庝絻顫夌敮鎾晬瀹€鍐ｅ亾鐏炶偐鐟濋柡鍕靛灡婵″憡绋夊顒€顫ら梺顐ｆ缁额偅绻呴悙鍙夎含 UI 闂?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/package.json`
- `frontend/src/App.tsx`
- `backend/main.py`
- `src-tauri/tauri.conf.json`

闂傚啳鍩栭宀勫箛韫囧海鐤呴柨?
- 闁稿繐鐗婃俊鎼佸籍瑜旈埀顒佹缁额偅绂?UI 閻忕偛鍊告晶铏圭矉鐠囨彃姣夐柡?- 闁稿繐鐗呯换姘辨嫚娴ｈ鐓€闁哄鍩栭悗顖炴嚄閸婄喓鐛撻柨娑樿嫰閸熲偓闂侇偅鍔栭鐐存交椤撴繂鏁╅悷娆忓€归崝鍛村椽鐏炶棄顫犻柤?
## 闂傚啳鍩栭?2闁挎稒姘ㄥ▍銉ㄣ亹閺囨ǚ鍋撴担椋庣獥閻犲洦绻€缁楀矂寮甸鈧﹢瀵告媼閸撗呮瀭闁归晲妞掔粻娆撳礌?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁稿鑹鹃崵顓㈡偑椤掑倻褰岄柣褑顕х紞宥嗐亜?- 闁衡偓椤栨稑鐦弶鍫熸尭閸欏棙绂嶉幋鐐寸疀闁告柡鈧櫕鐝?`Host`
- 闁衡偓椤栨稑鐦?SSH 闁活潿鍔嶉崺娑㈠触?/ 閻庨潧妫涢悥?
- 闁衡偓椤栨稑鐦悹渚€顣︾紞鍥┾偓闈涙閻?
- 闁衡偓椤栨稑鐦柤濂変簻婵晠鎯傜拠鑼Э
- 闁谎嗩嚙缂嶅秹鎮╅懜纰樺亾娴ｇ儤鏆?backend 濞ｅ洦绻傞悺銊╃嵁閸撲緡鍚€闁?
闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 闁谎嗩嚙缂嶅秵绌遍埄鍐х礀濞戞挸绉撮崯鈧柡渚婄秬閹倝宕烽妸銉▎闂侇喓鍔忛崜濂稿嫉椤戣儻鍘柨娑樼焷閳ь剙鏈Σ鎼佸绩閹冪厒缂備胶鍠嶇粩鎾儍閸曨噮鍟庣紓鍐惧枟閺嬪啯绂?- 濮掓稒顭堥濠氬磹閻撳骸鏁剁紓鍐惧櫙缁辨繃绋夊鍕穿閻犙勭墱閺併倝骞嬮柨瀣杹鐎规悶鍎遍崳顖涘緞閸ヮ剦鏉哄鑸电墵閸樸倗绱?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/pages/LoginPage.tsx`
- `backend/settings_store.py`
- `backend/config.py`

鐟滅増鎸告晶鐘绘焼濡ゅ啯娈岄柣妤冩嚀缁舵盯鏁?
- 闁谎嗩嚙缂嶅秵顪€濡鍚囧☉鎾剁帛濠р偓濞寸姴绉靛Σ?`150.109.100.30`
- 濮掓稒顭堥?SSH 闁活潿鍔嶉崺娑欑瀹ュ棙笑 `ubuntu`

## 闂傚啳鍩栭?3闁挎稒鐭€靛矂骞掕閸╂宕ｆ导娣偓澶愭閵忊€崇亣闁?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁稿鑹鹃崵顓熺▔缂佹ê浠橀柛鎺曟硾瑜?`DashboardPage`
- 鐎点倛娅ｉ悵娑橆啅閿旀寧娅犻悗浣冨閸╁懘宕畝鍕┾偓濠囨焾閵婏附鎯欏ù锝嗙矊鐏?
- 鐟滆埇鍨洪崹?5 濞戞搩浜欑€靛瞼鎲撮崱妤佺闁?  - 闁硅矇鍐ㄧ厬闁告瑧澧楅埀顒佹椤?
  - 闁哄牆绉存慨鐔虹不閿涘嫭鍊?
  - 闁稿鍎遍幃宥呂涢埀顒勫蓟?  - 婵炶尪顕ф慨鈺呭籍閵夈儳绠?
  - 闁绘壕鏅濈敮鍝勩€掗崨濠傜亞

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/Topbar.tsx`

闂傚啳鍩栭宀勫箛韫囧海鐤呴柨?
- 濞存籂鍐╂儌鐎规瓕灏欑划鈩冪鎼存ǚ鍋撳鍐ㄦ濞戞搩浜濈€垫粓鏌﹂鐐暠鐎规悶鍎遍崣鎸庛亜閻㈠憡妗ㄩ柍銉︾箓瑜板骞嬮幇顏嗗晩濞戞挴鍋撳☉鎿冧簽缁劑寮搁崟顐ゆ殮闁轰礁顕▓鎴濐浖瀹€鍕〃闁硅矇鍐ㄧ厬闁?
## 闂傚啳鍩栭?4闁挎稒鐭花顖滅博椤栨稒绠涢柛鏃撶磿椤撴悂鎮堕崱姘幋闁告梹绋掔敮鎾礂?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- frontend 闁告瑯鍨禍鎺旀嫬閸愵亝鏆?backend 闁告凹鍨版禒鐘诲嫉瀹ュ懎顫?
- backend 闂侇偅淇虹换?SSH 闁硅矇鍐ㄧ厬閺夆晜绮庨?systemd 闁哄牆绉存慨?
- 闁哄牆绉存慨鐔兼偐閼哥鍋撴担绋胯濞寸姰鍎崇划鐑樼▔閳ь剟寮婚妷顭戝殑妤犵偠娉涘﹢?UI 闁告绱曟晶鏍煂鐏炵晫娼旂紒鈧?- 闁稿鑹鹃崵顓㈠触椤栨艾袟闁稿繈鍔戦崕?/ 闁稿绮嶉娑㈠礂閵娾晛鍔ラ柤瀹犳婵?

鐟滅増鎸告晶鐘诲炊閸濆嫮鏆扮紒鐙呯磿閹﹪鎯冮崟顒佺疀闁告柡妲勭槐?

1. `nginx`
2. `go2rtc-cloud`
3. `go2rtc-srt-bridge`
4. `go2rtc-control-signaling`

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `backend/service_manager.py`
- `backend/config.py`
- `backend/main.py`
- `frontend/src/components/ServiceCard.tsx`
- `frontend/src/pages/DashboardPage.tsx`

闂傚啳鍩栭宀勫箛韫囧海鐤呴柨?
- 閻忓繐绻掗埢鍏兼償韫囨挾纾诲┑顔碱儑濠€鈥愁潰閿濆棗顥為柟宄版噳閳ь剚绮堢花顖滅博椤栨稒绠涢柛鏂哄墲鐢爼宕氱捄鍝勯叡闁炽儲绻勫▓鎴︽嚂瀹€鍐厬闁挎稑鐭侀埀顒€濂旂粭澶愬矗椤忓懏笑闂傚牊鐟﹂埀顑胯兌婵悂骞€娓氣偓濞间即寮?
## 闂傚啳鍩栭?5闁挎稒鑹鹃崬瀵哥磾椤曗偓缁垳鎷嬮妶澶婂赋缂傚喚鍠曠粭灞惧緞閺嶎厼鍔ュ〒姘箚缁傚棝寮ㄩ崜浣虹礆

闁哄牃鍋撻梺鎻掔Х椤╋箓鎯冮崟顐㈢秮闁告牗鐗旂粻锝嗙▔閳ь剟鏁?
- 閻忓繐绻掗埢鍏兼償韫囧海鐟濋柛鎰С缁堕鎸ч弽顐ｆ殢闁规潙鍢插﹢顏呫亜閸︻厽绐楀鑸电墪瀹曠喖鎮浣哥倒濞?`sender-cloud.config.json`
- 闁衡偓鐟欏嫬鐏囧銈呮贡濞蹭即宕橀崨顖滄瀭濮掓稒顭堥璇参熼埄鍐╃凡
- 闁谎嗩嚙缂嶅秹宕ｉ鍫熶粯閻熸洑娴囩欢顓㈠礂閵夛附绠涢柛鏂衡偓铏彜闁告粌鑻惁鎴︽儘?- 濠㈠爢鍥ф濮掓稒顭堥鑽ょ博椤栨艾缍撻柕鍡曠瀹曟鎷嬮琛″亾娴ｇ儤鏆忛柟鏉戝槻閹洟鏌堥挊澶婃暥缂?
鐟滅増鎸告晶鐘诲礃閸涱垳鏋傛俊顖楀墲濠㈡ɑ鎷呭鍥╂瀭闁?
- `backend/cloud_setup_bundle/config/sender-cloud.config.json`

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `backend/cloud_setup.py`
- `backend/config.py`

闂傚啳鍩栭宀勫箛韫囧海鐤呴柨?
- 闁圭粯鍔欓悵顔炬崉閵婏附绨氶柛锝冨妼瑜拌尙绮旂紒姗嗘Щ闁?- 闂傚嫬绉崇紞鍡涘灳濠婂嫬搴婂☉鎾亾闁告瑦澹嗛弫鎼佹嚇閹存繃鐨戦悹鐑樺灣缁楀鎸ч柨瀣檷闁炽儲绻勫▓鎴濐潡閸屾粌鑺?
- 濞戞挾鍎ゅ〒鍓佺磼閸垺鐣?`exe` / 閻庣懓顦抽ˉ濠囧礌閸涱厺绮甸柛鎴濇椤?

## 闂傚啳鍩栭?6闁挎稒鑹炬禒瀛樻償闁垮姊鹃柡灞诲劘閳ь兛鑳堕顒勫矗閿濆棭姊鹃柡灞诲劘閳ь兛娴囩换娑㈠箳閵夈儲褰ラ柣?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 濠⒀呭仜婵偞绂嶉幋鐙€浼傞柛瀣ㄥ劚閹秴螞閳ь剟寮婚妷锔解枖缂佲偓?- 濠⒀呭仜婵偤骞嶇€ｎ亜袟缂佹棏鍨拌ぐ娑樜涢埀顒勫蓟?- 濠⒀呭仜婵偤寮甸浣圭皻 IP / 闁哄牆绉存慨鐔煎闯?IP / 闁革附婢樼亸顖涚┍閳╁啩绱?
- 濠⒀呭仜婵偤宕堕懞銉︻棞閻犙冨缁噣寮伴崜褋浠?
- 闁衡偓椤栨稑鐦柟闈涱儏婵晠宕氶柨瀣厐閺夆晝鍋炵敮纾嬬疀椤愩倕寮?

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 缂佹棏鍨拌ぐ娑樜涢埀顒€霉鐎ｂ晝鐟濋柛瀣鐎垫梻绱掗銏㈠蒋濡増鍨瑰ú鍐触椤掑﹦绀夐柤鏉挎湰濡叉悂骞嶇€ｎ亜袟婵☆偀鍋撻柡?- 闁革附婢樼亸顖涚┍閳╁啩绱栭悷鏇氱閺佹牠鏌岃箛鎿冨殸闁活潿鍔嶉崺娑㈠矗鐎ｎ亗鍋ㄩ柛锔芥緲閻秶绮?- 闁搞儴濮ゅΛ妤冩導閸曨剛鐖遍柡鈧憴鍕亣闁哄牜鍓欏﹢鎾⒕韫囨挷绱ｇ紒瀣儐婢э箓宕犻崪鍐闂侇剙鐏濋崢?exe 濞撴碍绻嗙粋鍡樺緞閺嶎厼鍔ョ紓鍐╁灩缁墎鎸ч崟顒傜埍

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/Sidebar.tsx`
- `frontend/public/flags/*`
- `frontend/public/flags/README-circle-flags.md`
- `backend/config.py`
- `backend/main.py`

## 闂傚啳鍩栭?7闁挎稒鐭€靛本锛愬Ο绯曞亾娴ｇ袟闁轰礁鐗勯埀顑挎祰椤鎲存径鎰垫闁哄秴鍚嬬€垫梻绱掗鐔封叺缁?
閺夆晜鐟ょ粩鎾⒓閼告鍞藉☉鎾崇У濡插憡绋夐埀顒€鈻庨垾宕囨殮闁瑰瓨鍔х槐婵嬫嚀鐏炵偓笑闁归晲鑳堕悽缁樺緞濮樺磭鏋傜€甸偊鍠涢惃鐔烘椤栨簽婵嬪礄閻戞ɑ闄嶉柣銊ュ閳?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁哄嫬娴烽垾妯好归崨鏉款棌 / 婵烇綀绮炬竟濠囧矗鐏炵厧鐦滃Λ?- 缂備胶鍠嶇粩鎾捶閸℃凹娼″瀣閻?
- 闁告绱曟晶?hover 闁告柣鍔嶉弲?
- 闁煎啿鏈▍娆撳蓟閺傛寧瀚叉繛鎾村姇瑜板绋夋惔銏㈡闁搞儲娼欓崢婊堝棘?- 闁哄洤鐡ㄩ、鎴︽閵忕姴顕ч柕鍡曠劍濞叉寧娼繝姘 SaaS Dashboard 濡炲瀛╅悧鎼佹儍閸曨厽娅曢梻?- 濠㈣埖淇洪悿鍡樼┍椤旂⒈妲绘繝濠冭壘婵晠濡存担鍝ヮ伌閻忕偐鍋撻悷浣风閸ㄥ繘濡存担鍓插殸濮掔粯鍔戦埀顑跨閸ㄥ酣姊鹃弮鍌氭疇闁靛棔鑳舵慨鎼佸箑娴ｇ璁查悹鍥╃帛閳ь儸鍥紪濡?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `frontend/src/components/*`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`

閺夆晜鐟ょ粩鎾⒓閼告鍞介梺鎻掕嫰閼镐即骞嬮幇顏嗗晩闁告艾娴烽悽鏄忕疀閸涙番鈧繒绱掕婢规瑩鎯冮崟顓熸殢闁规潙鍢叉禍鍛婄附閺傘倗绐?

- 濠㈠爢鍐╁閻?- 闁哄本鏌ㄩ幏浼存煀瀹ュ牆顥?
- 闁绘粏宕甸幏鎴﹀箛?/ 婵炴挻鍔曡ぐ澶愬箛?- 闁哄牆顦慨鈺呭极閸剛绀夊ù锝呮缁楀鎳楅崐鐔虹畺濠?- 閻㈩垰鍟惇顒勫椽鐏炵瓔鍤犲缁樺姇缁烩偓濡炪倖妲掗澶岀矚?- 闁衡偓閻熸澘袟闁哄啳娉涢弫鏍煂韫囨挾姣岄柛鏂诲妽閺嬪啯绂掔捄鐑樺闂侇偅妲掔欢?

## 闂傚啳鍩栭?8闁挎稒淇洪～瀣紣閹达富鏆曢悷娆忕墣閸忔﹢宕濆☉娆忓闁?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁革负鍔嶅﹢鍥礉閿涘嫷鍚€闁荤偛妫濋妴澶愬礃閸涱厾銈甸悷娆忔椤ｈ埖锛愰崟顕呮綌闁告牕鎼悡?
- 濮掓稒顭堥璇裁规担鍛婂€冲ù锝堟硶閺?`main-camera`
- 濞村吋锚閸樻稓浜稿┑濠勬Ц WebRTC 濡澘瀚～?
- 濞ｅ洦绻勯弳鈧?MP4 濡澘瀚～宥夊炊閻愯　鍋撻埀顒傛崉椤栨氨绐?
- 濡澘瀚～宥囩玻濡も偓瑜版稑袙閺傚墽浼愰柛鏂诲妽閳ь兛娴囩粣锟犳⒕韫囨挾鏉介梻鍕嚀椤锛?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/pages/DashboardPage.tsx`
- `backend/main.py`

闂傚啳鍩栭宀勫箛韫囧海鐤呴柨?
- 闁硅矇鍐ㄧ厬闁告瑤鍗抽崳鐑藉矗椤栨瑤绨伴柣鈺佺摠鐢挳鎯囩€Ｑ€鍋撳鈧花顖滅博椤栨氨绉奸柛鎾崇Х閸忔ɑ绋夊鍫濆幋闁衡偓鐠哄搫鐓傞柣銏狀煼濞间即鍨?
## 闂傚啳鍩栭?9闁挎稒纰嶇敮鍫曞礆閸撲焦纾ч悷娆忔閺侇參鎯勫Ο璇插闁?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁革负鍔嶅﹢鍥礉閿涘嫷鍚€闁荤偛妫濋妴澶愬礉閻樻彃寮抽柍銉︾矋鐢爼宕氶崜浣圭＇閻熸瑥妫濋弫顓㈡儎濡皝鍋撳┑鍡楀耿闁?- 闁哄牜鍓氬┃鈧柛娆樺灟婢跺秹寮懜闈涘闁?`robot-control` 濞村吋淇洪惁?
- 闁?UI 闁哄倻鎳撶槐锟犲及閸撗佷粵缂傚啯鍨块妴澶岀博椤栨稒闄嶉柣銊ュ鐎垫粓鏌ㄩ鎯﹂柟?- 闁哄嫬澧介妵姘槈閸喍绱栭柡浣规緲閹蜂即寮甸埀顒佹交閹寸偞绾柡鍌滃濡炲倿姊?
闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 閺夆晜鐟﹀顖炴煣閹规劗鐔呴柡鍕靛灣濞插啰鎲撮崱娑欐嚑閻犱警鍨界槐婵囩▔瀹ュ棙笑婵繐绲界槐锟犲嫉閻戞﹩娼鹃柤宄板€圭敮鍫曞礆閸洘鎳犻悹渚灡濠€浼寸叕?- 闁稿繑濞婂Λ鎾籍閺堢數鐟濋幖瀛樻椤曟岸宕￠悩鍨殢闁硅矇鍐ㄧ厬濞村吋淇洪惁?
- 闁告挸绉堕顒勬焻濮樺磭绠?backend 闁瑰嘲顦甸崢銈囩磾椤曞棛绀塨ackend 闁告劕绉撮顕€骞掗妷銈囬殬缂?signaling

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/pages/DashboardPage.tsx`
- `backend/main.py`
- `backend/cloud_setup_bundle/control_signaling.py`

## 闂傚啳鍩栭?10闁挎稒鐭粩鎾煥椤曗偓閸樸倗绱旈鑽ょ憿閻熸瑥妫濋。璺何熼垾宕囩闁告帒娲﹀畷鏌ュ箳閵夈儱寮?

濞戞挻妲掗々锔剧磼閹惧浜柨?
- UI 濡炪倕鐖奸崕鎾礉閻樻彃寮抽柍銉︾矆缁旀挳鏌ㄩ鈧崢銈囩磾椤斿厜鍋?- 闁衡偓椤栨稑鐦俊顐熷亾婵炴潙顑勭花顖滅博椤栨粌绠氬褍鍟Σ鎼佸触閿曗偓濮樸劎绱?- 濞戞挸绉村銊х磼椤忓懏顦ч柟绗涘棭鏀藉ù婊勫灩椤忣剟鏌堥妸褑顔?/ 濞ｅ浂鍠栭ˇ?
- 闁告梻濮撮崣?`HTTP` / `SRT` ingest 婵☆垪鈧磭纭€闁告帒娲﹀畷?
- 婵☆垪鈧磭纭€闁告帒娲﹀畷鏌ュ籍閼稿灚绠掗弶鈺傜☉鐎规娊寮堕垾铏缂備焦鎸婚悘澶愬箵閹邦喓浠?

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 闁绘粍婢樺﹢?UI 濞戞挸锕﹀▓鎴炵▔閳ь剟鏌ㄩ鈧崢銈囩磾椤旇偐鏉介梻鍕噺濡叉悂鍨惧鈧花顖滅博椤栫偛甯崇紓鍐惧枓閳?- 闁告艾绉撮悺褔鏌屽畝鈧▓?`local_setup` 闁哄嫷鍨板濠氬矗閺屻儰绮ｉ柣锝嗙懄鐢挳宕ｉ敐鍛€?
- 闁告帒娲﹀畷鎻捨熼垾宕囩閻忕偟鍋樼花顒佹綇閸愵喖娅㈤柟鍨С缂嶆棃鏁嶅畝鍕粯閻熸洑鐒﹀Σ鎴犳兜?busy 闁告瑥绉归々?

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `backend/cloud_setup.py`
- `backend/main.py`
- `frontend/src/pages/DashboardPage.tsx`

## 闂傚啳鍩栭?11闁挎稒淇哄▔鏇㈠嫉閸濆嫭鐝ら柛娆樺灣閺併倝骞€瑜岀粭?sidecar 闁汇垻鍠庨幊锟犲川閵婏附鍩?

濞戞挻妲掗々锔剧磼閹惧浜柨?
- 鐎殿喗娲栭崣?backend sidecar 闁瑰灚鎸哥€垫﹢寮憴鍕垫敵
- 闁?PyInstaller 闁?Python backend
- Tauri 闁煎浜滄慨鈺呭箯婢跺孩宕?backend sidecar
- 濞戞捁宕甸埢鍏兼償韫囨稈鍋撻埀顒勫礄閻戞ɑ顦ч柤濂変簻婵晛銆掗崨顖涘€?backend
- backend 闁煎浜滅换浣圭▕閻斿墎绐楅柛娆忕У閻擄繝鎮ラ幆鎵缂佸顑戠槐婵嬫焼閸喖甯虫繛鍫濐儑閺嗏偓

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `scripts/build_backend_bundle.py`
- `backend/launcher.py`
- `src-tauri/src/main.rs`
- `src-tauri/tauri.conf.json`

闂傚啳鍩栭宀勫箛韫囧海鐤呴柨?
- 閻犱讲鏅涢惃顒傜矙鐎ｎ亞纰嶉梺顐ｅ姈椤掔偤骞掗妷銊х闁炽儲绮嶇€ｄ線宕氶弶鍨劶闁?Windows 闁哄牆鎼▍鎺斾焊鏉堫偄鍘撮柣鈺佺摠鐢鎲楅崨顏佸亾濠靛牊鐣遍柣妯垮煐閳?
## 闂傚啳鍩栭?12闁挎稒鑹惧鍫曞礂鐎ｎ偆鍩楅柟鏉戠箲鐢挳宕楅妷銈呯槣缂佸顑呯花?

濞戞挻妲掗々锔剧磼閹惧浜柨?
- 鐎归潻缂氶弲鍫曞棘閺夋鏉婚柍銉︾矌鐢椽鎮抽埡鍌滃煑闁规潙绻嗛埀?- 鐟滅増鎸告晶鐘诲箳閵夈儱寮抽柣銊ュ閻栧爼骞嬭箛鏃€笑 `Tank Trouble`
- 婵炴挸鎲￠崹娆愮▔瀹ュ懎鏅欓柡鍕靛灠椤﹀鏌堥妸褍顏紒鏂款儔閵嗗秹鎯勯鍡欑闁兼澘鏈Σ鎼佺嵁鐠哄搫寮冲☉鎾瑰吹閳诲吋鎯?- 闁衡偓椤栨稑鐦悹渚囧幘缁苯螣閳ュ磭纭€
- 闁衡偓椤栨稑鐦柟鏉戞健濡?/ 闁革附婢樺ù姗€宕ョ仦缁㈠妱
- 闁衡偓椤栨稑鐦柟鐑樺笩椤㈡垵顫楀鈧粭宀勬偝閳轰緡鍟€濡増绮忔竟?
- 濞ｅ洦绻勯弳鈧ù婊冩鐢偅鎱ㄧ€ｎ亜妫橀柤鏉垮暞閻栧爼骞嬭箛鏇熺獥鐟滅増娲╃槐婵囨媴閸℃绉奸柛鎾崇У椤㈡垿妫冮姀鐘差枀缂佹棏鍨电换宥囨偘瀹€鍕ㄥ亾閺勫繒甯嗙€规瓕灏欑划锟犳嚊椤忓懎鐏囧☉鎾亾濞?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `games/tank-trouble/original/*`

## 闂傚啳鍩栭?13闁挎稒鑹惧鍫曞礂鐎ｎ偆鍩楅柟鏉戠箣缁垳绮╅娑樼叄闂傚倻绻濈粭宀勫箮閺囩姰鍋嶉柟骞垮灩濞?

濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁告艾娴烽顒勫礉閻樻彃寮抽柛褝绠戦崢鐘诲箣閸ф锛?API
- 濞存粍鍨归顒勫箣閸ф锛熼柤瀛樼濠€鎵嫻閻旇崵鐓戦柣婧炬櫅椤斿秹姊块崱妤佸€ら柕鍡曠濠€鎾炊?seed闁靛棔鐒︽慨鍥╃矈閵婏箑搴婇柛銉ゅ嫎閳ь兛绀侀埀顒佸笩椤撴悂寮懜闈涘簥闁?- 闁告挸绉堕顒勬焻濮樺磭绠?room sync 濞ｅ洦绻冪€垫棃宕烽弶鎸庣濞戞挴鍋撻柤?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_cloud.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

闂傚啳鍩栭宀勫箛韫囧海鐤呴柨?
- 婵炴挸鎲￠崹娆愮▔瀹ュ懎鏅欓柛娆樹簼濡插摜鐥娑欐嫳闁?canvas 閻犲洦娲滅敮娲晬瀹€鍐ｅ亾鐏炵偓笑鐎殿喒鍋撳┑顔碱儏閸欐寧寰勯崶锝傚亾濠娾偓缁垳绮╅娆掑幀闁?+ 闁哄牜鍓欏﹢鎾礈瀹ュ浂浼傞柍銉︾箘濞堟垹绱掗幘瀵糕偓?

## 闂傚啳鍩栭?14闁挎稒鑹惧鍫曞礂鐎ｎ偆鍩楅柟鏉戠箣婢跺秹寮捄鐑橆偨閺夆晝鍠愮粊瀵告嫚閺囩唽浣割嚕?
闁哄倹婢橀·鍐儎椤旂偓鐣遍柨?
- 闁活潿鍔嶉崺娑氭暜鐏炵偓绠垮☉鎾崇摠濡炲倹顨ュ畝鍐濞戞挴鍋撻柡澶嗘閳ь剚绮屾晶鐘电博椤栨繄缈婚柛?-> 濞存粍鍨归?-> 閺夆晜鏌ㄥú鏍ㄦ交濠婂拋浼傞悗鐢殿攰閽栧嫮鎮伴妸褍绠涢柍銉︾箘濞堟垿鏌ч幑鎰唴鐎点倖鍎肩换?
- 閺夆晜鐟ら柌婊堟閳ь剙效閸屾稒笑濞戞挸鐡ㄥ鍌毭圭€ｎ厾妲搁柟顑棗绐涢柨娑樺缁楀鎯旈弬鍨殯闁告繂绉甸婊冾嚕韫囨凹娼掑Λ鐗堝灴閹借偐鎹勯妯峰亾娴ｈ鍔€鐎殿喖绻戠敮鍫曞礆閸洘鎳犻悹?
闁告挸绉靛﹢锟犲磻濮橆厾銆婇柨?
- 闁绘壕鏅涢宥夊嫉椤掆偓濠€鎾儎鐎涙ê澶嶉柟璨夊啫鐓戦柤濂変簻缁讳線鎯冮崟顐ｈ晧闁?- 濞存粍鍨归顒勫冀鐟欏嫬绁﹂柣婧炬櫅椤斿秵娼忛幘鍐插汲濡炵懓宕慨鈺傜▔閳ь剚绋夐浣插亾濠婂啫甯梻鍛濞煎爼宕楃€Ｑ€鍋?- 闁告挸绉堕顒勫礃瀹ュ棙鈻旂紒鈧ウ璺ㄧ濞戞搩浜滈崢鐘绘⒕閸℃钑夐柛蹇擃儏閹锋壆鈧懓鍟板▓鎴犫偓娑欏姇閼?

鐟滅増鎸诲鍌炴儍閸曨垱锛栧Λ鐗堬公缁?

- 闁稿繐顑夊▓鏇㈠锤閿曗偓閸樼姷绮旂拠鎻捫楀☉鎾崇Х缁绘稓绱?- 闁稿繐顑夊▓鏇犫偓娑欏姇閼村﹪骞掓径濠冨闁哄嫬瀛╁Ο?
- 闁活亜顑堥幑锝夊级閵夈儱鍓奸柡鍕靛灟缁斿鏁缁斿鏁閻?

## 闂傚啳鍩栭?15闁挎稒鑹惧▎銏℃交閻旀敼浣割嚕韫囨洦鍎戝☉鎾亾婵炲棌鈧尙鍠橀柛?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 濞ｅ浂鍠栭ˇ鍙夋交閸ワ妇顏卞ù婊勭〒婵悂骞€娴ｅ憡鍊辨慨?bug
- 濞撴艾顑呴々?clone respawn 闁告艾瀛╃敮鍫曞礆鐠鸿櫣纰嶉柛鎺撱仦濞戭亝寰勬潏鈺傜暠闂傚偆鍣ｉ。?
- 闁告挸绉堕顒勫即閹屽殸闁稿繐顑夊▓鏇犫偓鐢殿攰閽栧嫰宕戝宕囩畺缂佺姭鍋撻柛妤佹礀闁解晛顭?/ 濞ｅ浂鍠楅?

濞达絽妫涢弫銈夊箣瀹勬澘鍐€濡絽鐗呯划娑㈡倿閼稿灚笑闁?
- 闁炽儲绮岀欢銏ゅ础閳锯偓閳?- 闁炽儲绮岄幎姘跺极妫颁胶绉甸柍?- 闁炽儲绮嶉弻鍥棘椤撶姷鏁剧紓渚囧幐閳?
閻犲洤鐡ㄥΣ鎴犵棯椤栨碍褰ラ柣鎾楀啰纭€闁搞儳鍋炵敮瑙勭瀹ュ洤濮у☉鎾崇Т椤у嫰濡?
## 闂傚啳鍩栭?16闁挎稒鑹惧▎銏℃交閻旀敼浣割嚕韫囨稑娅㈤柡瀣鐠愮喖鍨惧鍡欑炕闁稿繈鍎遍幃鎾愁潰?+ 闁哄牜鍓欏﹢鎾焻閹邦剚濮庢俊顖楀墲鐎氭瑩鍨?
閺夆晜鐟﹀Σ姝屻亹閹惧啿顤呴梻鍐煐椤斿矂寮甸埀顒勫礂閹惰姤鏆涢柣銊ュ缁旀潙鈻庨垾铏晧闁稿繐顑呭▎銏℃交閻斿摜銈撮悹鍥ㄦ磻缁鳖參宕犻弽銉㈠亾?
闁哄秶顭堢缓楣冨箑濠靛﹦鐔呴柡鈧憴鍕亣闁?
- 濞存粍鍨归顒佺▔瀹ュ懎鏅欏Δ鍌涳耿椤ｅ爼宕堕悙鏉戣吂婵絽绻嬬粩瀵告暜瑜嶉崢鐘绘⒕閸℃洜绉寸紓?- 濞存粍鍨归顒佺▔閺勫浚娲ｉ弶鈺傛煥濞叉牠鏁?  - `clone_input`
  - `fire_events`
  - `clone_reset_seq`
- 闁告挸绉堕顒勬嚊椤忓嫮绠掗柛锔哄妽濠€浼村捶閻楀牏妲ㄩ悽顖嗗媭渚€骞忛悢宄板脯闂傚懎妫楀鍫曞礂鐎ｎ亝瀚查柛蹇擃儔濞堟洜鈧稒鍔曢懘?

閺夆晜鐟﹂悧閬嶅磻濮樿鲸鐣遍柛妯煎枎濞叉粓鏁?
- 閺夆晜绮庨顒傗偓鐢殿攰閽栧嫰鎯冮崟顒佺函闁哄倷鍗抽。鍫曟偝閸ワ妇鐟濋幖瀛樻煥瑜板牏绱旈幋鐘垫崟闁告牕鎳橀。鍫曟偝閸モ晜绾柟鎭掑劦濡炬椽宕?- 缂傚啯鍨圭划鍫曞矗椤忓嫭鍊辨慨婵勫劥缁额參宕?/ 闁绘鍩栭埀?/ 濞存粌顑勫▎?
- 闁汇垹顭峰鎵偘閵娧冪疀闊洤鎳橀妴蹇涙偨閸楃偛顤呯紒鏃戝灡濠€浼村捶?`requestAnimationFrame` 閺夆晝鍋熼悽濠氬箳閵娿劎绠?

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

## 闂傚啳鍩栭?17闁挎稒鑹惧▎銏℃交閻旀敼浣割嚕韫囨氨绠诲☉鎾亾婵縿鍎靛椋庣驳婢跺﹦绐￠柛婊冪焸濡插宕奸崱娅?

鐟滅増鎸告晶鐘诲嫉閳ь剟寮幍顔界暠濞戞挴鍋撻弶鐑嗗枙缁鳖參宕犻弽顓炴闁绘劘顫夊Σ鎼佹晬?
- 闂傚嫬绉崇紞鍡涘箰婢舵劖鏆涢柛娆惷€垫煡宕氭０浣洪殬缂佹棏鍨伴幃鎾愁潰閵壯勭暠缂佹稑顦欢鐔煎籍閸洘锛?
- 闂侇剙鐏濋崢銈夊触鐏炵虎鍔勯悹鍥敱閻即宕奸崱娅?
- 閺夊牊鎸搁崣鍡椕洪弰蹇曗攬闁哄啳鍩栧ú鑳疀椤愩儳顎€閺夆晜鍐荤槐婵堢矚濞差亝锛濋柡鍐ㄧ埣濡鹃攱锛?
鐟滅増鎸告晶鐘碘偓鍦仧楠炲洨绱掗幘瀵镐函闁?
- `TankTroublePanel.tsx` 濞戞搩鍘肩槐鈺呭礂閵夘垳绐?
  - `LATENCY_SYNC_IDLE_INTERVAL_MS = 90`
  - `LATENCY_SYNC_RUSH_INTERVAL_MS = 12`
- 闁圭顦甸弫顓㈠矗濡搫顕ч柡鍐╂构鐎靛矂宕?kick 濞戞挴鍋撴繛鍡忊偓铏€辨慨?- 閻犲洭鏀遍惇浼村捶閵娾斁鍋撻弮鈧鍌涚▔瀹ュ娅㈠璺虹Т閻栥垻绮?- 閻犲洭鏀遍惇鐗堟交閺傛寧绀€闁告艾楠搁々褔寮稿鍡欑炕闁稿繈鍎扮划娑樏洪弰蹇曗攬闁挎稑鐬奸幋椋庣磼椤撶偞褰ラ梺顐ゅ枙缁愨剝娼?
閺夆晜鐟ょ粩瀛樻姜椤旇姤笑濞戞挶鍎查悧鎼佸箰婢跺棌鍋撳鍐ㄦ锭闁告柣鍔嶇粊瀵告嫚閺囩偞顐介弶鈺冨枛閹借偐鎹勯妯峰亾娴ｉ鐟濈痪鐗堟緲閸欑偓绂掗弽顓熸嚑閻犱警鍨埀顒佺箘濞堟垿宕㈤悢宄扮仧闁稿姘ㄥ▓鎴﹀Υ?
## 闂傚啳鍩栭?18闁挎稒鑹惧▎銏℃交閻旀敼浣割嚕韫囧海闅樼紒鏃戝灠閻栬埖銇?HTTP 闁哄牆绉存慨?

濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 閻熸瑱绲介崰鍛嚈閹壆绠挎繛鏉戭儓閻︻垰螣閳ュ磭纭€闁哄绀侀崣楣冨础閿熺姰鈧垿鎯冮崟顖涳紪濡?- 濞ｅ洦绻勯弳鈧柍銉︾矎缁额參宕楅妷褎鍩傞悗鍦仧缁剝娼婚崶锔鹃殬缂佹棏鍨粩鎾捶閸埃鍋撳┑鍫熺暠婵炴潙顑堥惁顖炲箛韫囧海鐤?
- 闂侇剙鐏濋崢銈呅掕箛鏃戝仹闁告艾鏈鐐烘焾娴犲鍋撳宕囩畺 SSH exec 闁告劕鍢查幆搴ㄥ礉閵娿倗顏卞☉?Python 閺夆晜绋撻埢?

濞戞挻妲掗々锔剧磼閹惧浜柨?
- `backend/cloud_setup_bundle/tank_trouble_room.py` 濠⒀呭仜婵?`--serve` 閻㈩垱鎮傞埞?HTTP server 婵☆垪鈧磭纭€
- `backend/tank_trouble_cloud.py` 闁?latency sync / leave 濞村吋锚閸樻稓鎸ф０浣洪殬缂?HTTP 闁哄牆绉存慨?
- 闁哄牜鍓欏﹢?backend 濡絾鐗楅鍏兼交濞戞ê寮崇€点倖鍎肩换婊兠圭€ｎ厾妲搁柡鍐ㄧ埣閳ь剚淇虹换?SSH 闁告凹鍨版慨鈺傜▔閳ь剙鈻庨垾鑼殬缂佹棏鍨伴悥鑸点仚閺勫繒绠荤紒?- 濞存粍鍨归顒勫嫉瀹ュ懎顫ゅ娑欘焾椤撳鎯勯幋婵囧剶 `18086/tcp`
- 濞存粍鍨归顒勫嫉瀹ュ懎顫ら柡鈧柅娑滅閻㈩垱鎮傞埞妤呮倻椤撶喐绠涢柛鏂烘缁辨繃绋夊鍛櫃闁搞儳濮崇拹鐔虹矚濞差亝锛濋柟瀛樼墬濞撳爼宕ユ惔婵堫伇濞戞搩浜炵敮铏光偓鐟扮埣閳ь兘鍋撻柛鎴︾細閳ь剙鐭侀崵婊堝礉閵娾斁鍋撻埀顒勫礄?- 濠碘€冲€垮〒鍫曞礂閹惰姤锛?18086 婵炴挸鎲￠崹娆撳嫉瀹ュ懎顫ら柨娑樿嫰缁ㄦ煡鏌呭宕囩畺闁哄牆绉存慨鐔煎闯閵娿劎绠荤紒瀣儑椤撴悂鎮堕崱妯虹仐濞存粍鍨归顒勫嫉瀹ュ懎顫ょ紒鐙呯磿閹﹪骞嶇€ｎ亜袟闁稿繑濞婂Λ?
- 濠碘€冲€归悘澶嬬閹寸媭浼?HTTP 闁哄牆绉存慨鐔哥▔瀹ュ懎璁查弶鍫熸嫕缁辨繃绌卞┑鍫熸畬闁?SSH exec 闁告娲橀濂告嚇濮橆厽鎷遍梺鐐礃閻偓鎷呭鍐ㄥ箲閹?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `backend/tank_trouble_cloud.py`
- `backend/config.py`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 濞戞挸绉甸弫濂稿礈瀹ュ浂浼?API闁挎稑鐣璗ankTroublePanel.tsx` 濞寸姴绉烽惃鐔兼偨閵婏附鎷遍柛?backend
- 濞戞挸绉存總鏍传瀹ュ棭鍔€鐎殿喖绻楅～瀣紣閹达附鎳犻悹渚灠閹锋澘顫㈤敐鍛闁硅矇鍐ㄧ厬闂佺偓宕橀惌?
- 濞戞挸绉寸槐鈺呭礂閵夛附鐓€ Python 濞撴碍绻嗙粋鍡涙晬鐏炶偐闅樼紒鏃戝灠閻栬埖銇欑紒妯荤疀闁告柡鈧彃鈻忛柣?stdlib `http.server`

## 闂傚啳鍩栭?19闁挎稒纰嶉弸鍐浖閿濆棙鏆柡浣圭◥缁?agent 濞存嚎鍊栫敮鎾礄閸℃妲?

鐟滅増鎸告晶鐘虫交濞嗗海顏遍弶鐑嗗枟閺屽﹥鏅堕悙鏉戠亣闁哄绮ｇ槐?

- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `frontend/UI_AGENT_SPEC.md`

闁烩晩鍠氬▓鎴︽晬?
- 闁硅泛锕ラ婵嬪礈瀹ュ懎鐎婚柡渚婄到濠€顏堝冀閸︻厽绐楃憸鐗堟磸閳ь兛鐒﹂、鎴︽閵忥絽纾哥紒瀣骏閳ь兛绀侀顔炬嫚濠靛懐鐟愬☉鎾愁儐閺嬪啴鏌屽畝鈧▓鎴炵┍閳╁啩绱栭柡鈧懜鍨異闁瑰瓨鍔曟导鎰矙鐎ｎ亜鏁堕柣?canonical 闁哄倸娲﹂妴?
- 閻犱讲鏅涢崺鍡涙儍?agent 闁告瑯浜炲﹢?`frontend` 闁烩晩鍠栫紞宥囦焊鏉堚晝鍙€闂侇剚鎼槐?
  - 閻忓繐绻掗埢鍏兼償韫囨梹笑濞寸姭鍋撳☉?  - 闁稿繑濞婇弫顓犳崉椤栨氨绐為柛锔哄妼閹?
  - 鐟滅増鎸告晶鐘诲嫉婢跺﹥鎲垮ù婊勭☉婵盯鎳?  - 闁告繍浜欑花娲及椤栨艾鍧婇柛娆愮叀娴犳劙鎮?  - 闁告繍浜欑花鐑樻綇閸︻厽娅曞☉鎾崇Х閸忔ɑ绋婃潏鈺婃骄

## 闂傚啳鍩栭?20闁挎稒鑹惧▎銏℃交閻斿摜銈撮悹鍥ㄦ礃鑶╃€殿喖绻掗悾婵嬪礌閺嶏箒绀嬮柍銉︾矌閸戜粙宕楃€ｎ喗鐣烽悷娆忔椤鍨?
濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 閻忓繐妫楀▎銏℃交閻斿摜銈撮悹鍥ㄦ礃鑶╃€殿喖绻嬬划鐘诲灳濠婂嫭鎷遍柛锔芥緲濞煎爼宕?+ 闁稿繐顑夊▓鏇㈠锤閿曗偓閸?+ 闂傚牐娉涢悺娆撳灳濠靛牏鏆嗛柛鏍ㄧ墧鐠愮喖鎮芥繝姘〃濞戞挸锕よぐ褔寮垫径澶岊伇閺夊牆妫楅崢鐘绘⒕閸℃钑夐柛?- 閻犱讲鏅濋弫銈夊箣妞嬪孩绾悷娆忓€归崝鍛村矗濡炵儵鍋撳鍕亯闁瑰灝绉电敮鍫曟儍閸曨偅钑夐柛蹇擃儏濠€顏嗏偓浣冾潐婢ф粓鎯囨總绋挎闁哄嫷鍨划鍫熺▕閸喓澹夐柍?- 闁告绮敮鈧☉鎾崇Т缁烩偓閻熸洑鑳跺▓鎴﹀嫉椤掆偓濠€鎾礂閸愵亞顦遍柨娑樿嫰閸ｈ櫣浜搁幋锝庢綊閻熸瑥顦崗閬嶅箥?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 鐎殿喗娲橀幖鎼佸棘閺夋鏉?`latencyOnly` 闁哄秴娲ょ换鏃堝椽?`setLatencyOnly(enabled)` 闁哄倽顫夌涵?
- `tick()` 濞?`latencyOnly` 婵☆垪鈧磭纭€閻犲搫鐤囩换鍐嫉椤掆偓濠€鎾锤閿曗偓閸樼姷绮旂拠鎻捫?/ 鐎殿喒鍋撻柣?/ 闂傚牐娉涢悺娆撳即鐎涙ɑ鐓€ / 闁哄牜鍓欏﹢瀵糕偓娑欏姇閼村﹪鎮ч埡鍐╁€?
- `render()` 濞?`latencyOnly` 婵☆垪鈧磭纭€濞戞挸绉剁划顖炲礆閼稿灚鎷遍柛锔芥緲濞煎爼宕楃€ｃ劉鍋撴担瑙勬嫳闁革附婢橀悺娆忣嚕楠炲簱鍋撴笟鈧蹇曗偓?- `buildLatencySyncState()` 闁?`latencyOnly` 婵☆垪鈧磭纭€閺夆晜鏌ㄥú鏍捶閸濆嫷妯嗛柛妤冨С缂嶅懘宕搁幇顓犲灱闁告粌鐬奸埞鏍鐠鸿櫣鎽嶉柡浣瑰缁?
- 闁稿繐顑夊▓鏇犫偓娑欏姇閼村﹪鎮ч埡鍐╁€炲☉鎿冨弨閻戯附娼婚崶褜鍤犻柡鍫墮濠€鎾锤閿曗偓閸樼娀宕畝鍕珐閻庢稒鍔楀▓鎴犲枈閻楀牊瀵俊顐熷亾婵?- 閺夆晜绋戦崣?/ 闂侇偀鍋撻柛鎴濇惈濞嗐垺娼婚悢鍝ャ偞閻犲洦娲樿啯鐎殿喖绻戝鍌炴嚊椤忓嫬袟闁告帒娲﹀畷?`latencyOnly` 闁哄秴娲ょ换?
- 閻庢稒鍔曢懘濠傗槈閸喐娈犻柣妤勵潐閺呫儵宕?`latencyOnly` 婵☆垪鈧磭纭€濞达綀娉曢弫銈夊礂鐎ｎ喗鐣烽柛褝绠戦崢鐘垫嫬閸愵厼顥忛柡?- 鐎归潻缂氱粭鍌滄喆閹烘挾鍨肩紒娑欏劤濠€?`latencyOnly` 婵☆垪鈧磭纭€闁哄嫬澧介妵?`Latency View`

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 闁告瑯浜濋弫濂稿礈瀹ュ浂浼傜€殿喗娲橀幖鎼佸礃閸涙潙鍔ラ梺顐ｆ缁额偊鏁嶇仦鐓庣船闁哄秴銈稿▓褏绮嬬拠鍙夎含鐎点倖鍎肩换婊兠圭€ｎ厾妲告俊顖椻偓宕囩
- 濞存粍鍨归?`tank_trouble_room.py` 濞戞挸绉存慨鈺呮晬鐏炵晫鏆婇柛娆樹簽椤撴悂寮界憴鍕ウ input 濡炵懓宕慨鈺呭礂鐎ｎ喗鐣烽柨娑樺缁楀宕楅崘鑼闁哄牜鍓欏﹢鎾锤閿曗偓閸樼娀寮垫径瀣⒕闁?- `tank_trouble_cloud.py` 闁告粌鏈﹢浼村捶?backend API 濞戞挸绉存慨?
- 閻犱緡鍘剧划灞轿熼垾宕囩闁告粌鏈崺褔姊荤€涙◥浣割嚕韫囨挾鏆氶柛蹇嬪妺缁楀宕ｅΔ鈧總鏍传?
## 闂傚啳鍩栭?21闁挎稒鑹惧▎銏℃交閻斿摜銈撮悹鍥ㄦ礃鑶╃€殿喖绻愰柦鈺侇煥閹寸偐鍋撹缁鳖參宕?- 缂佸倷鑳堕弫銈嗘媴瀹ュ洨鏋傞柛銉у仱閳ь兘鍋?

濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 閻熸瑱绲介崰鍛村礂鐎ｎ喗鐣烽柛褝绠戦崢鐘诲捶閵娿儲顐介弶鈺冨枑缁佸鎷犻弴姘冲幀闁炽儲绮屽ú鏍焻閳?/ 閻犲搫鐤囩粚顒勫灳濠靛牊鐣遍梻鍌ゅ櫍椤?
- 閻犱讲鏅滈幖鐑藉箳瑜岀紞瀣殽鐏炶偐鐭ら柍銉︾矊瀹曡鲸銇勯崹顔界闂侇偀鍋撻柍銉︾箓瑜板骞嬮幇銊㈠亾濠婂嫭绠掔€点倖鍎肩换婊勬媴閸℃銈﹂柣锝呮噳閳?
闂傚偆鍣ｉ。鐣屾嫚婵犲啯鐒介柨?
- 濞存粍鍨归顒€袙韫囨棏鍋?sync 閺夆晜鏌ㄥú鏍儍閸曨剚缍€濠电偘妞掔紞鍛磾椤旇崵鐟㈤柡鍫墮濠€鎾焻閹邦剚濮庢俊顖楀墲鐎氭瑩鎯冮崟顏嗙Т缂傚喚鍠栭悺銊╁捶閵娿儰绨抽悘蹇撶箰娴滅顔?- `applyLatencyCloneCorrection` 婵絽绻戦濂稿绩鐠哄搫鐓?sync 缂備焦鎸婚悘澶愬籍鐠哄搫绻侀悶娑樻湰婵℃悂宕搁敃鈧崢鐘诲箯婢跺﹥鍊诲ù婊勫灩椤忣剟宕搁幇顓犲灱
- 鐟滅増鎸剧紞澶岀磼濠婂啯顐介弶鈺冨枑鐏忔繈宕濋妸锔筋槯闁挎稑鐭佺换鏍矓瀹ュ棗顎欓柟娈垮灟妤犲洭鎮介悢鍛婎潠闁哄嫬澧藉▓鎴﹀灳濠婂嫮纾界紒?- 闁搞儳鍋ら埀顑藉亾闁炽儲绻冮崝?
- 閻忓繑绻嗛惁顖涙交閸パ呯┛闁稿繈鍎寸欢顓㈠礂閵壯呭闁?`jitter buffer` 闁哄倽顫夐、宥夋晬鐏炶偐绋诲ù婧犲懏鏅稿ù婊冩閳ь剚绮撶划锟犳嚈閻戔斁鍋撳┑鍥ь杹闁规壆鍠庨幏鎵偓娑欏姇閼村﹥鎷呭鍥╂瀭闂佹寧鐟ょ紞鍛存晬鐏炶棄鍤掗柛銉у仱閳ь兘鍋?

闁哄牃鍋撶紓浣哥墛閺岀喎顩奸崼顒傜獥

- `latencyOnly` 婵☆垪鈧磭纭€濞戞挸顑呴悾顒勫礂閵娧屾矗闁?`applyLatencyCloneCorrection`
- 闁稿繐顑夊▓鏇㈠锤閿曗偓閸樼娀鎯冮崟顏嗙Т缂傚喚鍠栬ぐ褔鎮芥潏銊︽嫳闁革缚鍗抽埀顒佸姇閹舵艾螣閳╁啫鐝柛鎰暱閻ｉ箖鏁嶇仦鐣屽敤濞?`clone_input` 濡炵懓宕慨?
- `clone_input` 闁告帗濯介幓顏堝触鎼达絿褰岄柛妤€纾弫鎾诲极閸剛绀夐柡鍐Х缁憋箓宕樼拠褏绀夊ǎ鍥ㄧ箖鐎垫棃骞欏鍡椾粯闁汇劌瀚ú鍧楀箳閵夈儲鎯欓幖瀛樻⒐閸?
- 閻庢稒鍔曢懘濠冪瀹ュ嫮鐭ゅù婊勫灩椤忣剚娼婚弬鎸庣闁汇劌瀚妤呭冀閸パ冪岛閻忓繐瀚哥槐婵囩閿濆牄鈧啴寮靛鍛潳缂佹棏鍨卞鍫熺箾娴ｇ鐏查悗瑙勭濡炲倿鎯冮崟顓熷焸閻庡湱鍋樼紞鍛磾?
闁哄牃鍋撶紓浣哥墛閺呫儵寮稿鎰獥

- 缂佸顕ф慨鈺呭籍閹壆绠鹃悹鎰靛灡缁侊箓鎮鹃崪鍐濞戞挸绉撮崯鈧柡鍫濐槷缂嶅懐绱旈鍏肩闂侇偀鍋?
- 闁哄鍎崇槐鎴︽煥椤斿吋鍊甸柛褝绠戦崢鐘荤嵁閾忣偆鎷ㄩ柛瀣矆缂?
- 闁瑰灝绉电敮璺侯嚈閹壆绠跨紒鎾呭閻℃垶绂嶆惔锝囩Ч缂備焦绮岀欢姘交閺冣偓濡炲倿姊绘潏鍓х缂佹绠戦幃搴紣閸曨剚鍩傞柣銊ュ濞嗐垺娼婚悢绋垮Τ闁?- 鐎殿喒鍋撻柣鎰靛枛濞嗐垺娼婚悢宄拌閻熸瑤绶ょ槐婵嬪箰婢舵劖鏆涢柛鎺撴緲閻℃瑥顕ｉ悷鏉挎瘔闁绘粓顣︾粻锝夋⒒鐎涙ɑ绠掔紓鍐╁灩缁泛顕欓幆鎵

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 濞戞挸绉虫繛鍥偨閵娿劎缈婚柛蹇嬪劤缁憋箓宕樼拠褏绀夐悗鍦仦缁佸瓨鎷呴幘鏉戝Τ鐎?- 濞戞挸绉存禒娑欐媴瀹ュ洨鏋傞柡宥佸墲椤掓粓鏁嶇仦鐐嫳闁革妇澧楄啯闁归鍠曢崘缁樺緞閻旇櫣缈辩痪顓у櫙缁辨繈宕堕悩杈閺夊牊鎸搁崣鍡涙儎缁嬫寧鍊?
- 濞撴碍绻勯崝褎绌卞┑鍫熸畬閻庢稒鍔曢懘濠冪鎼存繄闅樼紒鏃戝灠濞兼寮介崶褍绲洪悘蹇撳缁辨繄鎷犻婵堢枀闁哄洤鐡ㄩ婊呮兜?
## 闂傚啳鍩栭?22闁挎稒鑹惧▎銏℃交閻斿摜銈撮悹鍥ㄦ礋閹借偐鎹勯姘３缂佺嫏鍌濈闁炽儲绮撻弳杈ㄦ交閻愭潙澶?+ 閺夊牊鎸搁崣鍡樻償韫囨挸濞?+ 闁哄牜鍓欏﹢鎾冀閳╁喚鍔€闁?
濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?- 闁硅泛锕ゅ鍫曞礂鐎ｎ偆鍩楅柟鏉戠箰濞嗐垺娼婚悢鍝ャ偞閻犲洦娲戠划鐘诲灳濠婂啫顤呯紒鏃戝灠瀵姤寰?HTTP sync闁炽儲绻傚畷宀€鐥閸ㄦ岸寮寸€涙ê澶嶉弶鈺傚灣鐎靛苯霉娴ｆ垝绮撻柡鍫㈠劋閻栧爼骞嬭箛鏇熺暠缂備焦鎸婚悗?
- 闁稿繐鐗嗛悾顒勫箣閹邦亣鈷堝ù鐘虫构缁ㄣ劑鏁嶅鑸垫瘣閺夆晝鍋炵敮鎾极閻楀牆绁﹂梺顐ｅ哺娴滈箖濡存担鐣岀炕闁稿繈鍎辩花顓㈠矗?闁哄牆绉存慨鐔煎闯閵娿儲褰ラ柣鎾楀啰纰嶉柛?闁哄牜鍓欏﹢鎾冀閳╁喚鍔€
- 濡炪倗鍎ゆ晶婊勭┍椤旇棄绔撮柍銉︾矊濞嗐垺娼婚悢鍝ャ偞閻犲洦娲熼崳鐑藉锤閿曗偓閸樼娀鎳楅挊澶娦楀ù锝呮鐎垫粎绮氶悜妯煎闁活亜顑勭粭澶愬礆閹殿喖浠忕€殿喖鍘滈埀顒佺箘濞堟垿姊婚鈧。?

濞戞挻妲掗々锔剧磼閹惧浜柨?- 闁告挸绉堕顒勫礆閻楀牊鎷遍柛?backend 闁哄倹婢橀·?WebSocket 闂侇偅宀告禍楣冩晬濮?api/games/tank-trouble/latency/ws`
- 闁哄唲鍛暠 `POST /api/games/tank-trouble/latency/sync` 濞寸姴绉堕崝褎绌卞┑鍫熸畬闁挎稑濂旂紞鏃€绋夋ウ鍨闁?fallback
- 闁哄牜鍓欏﹢?backend 闁告帡顣︾花顖滅博椤栨繄绠规繛鍫濆悁缁楀宕樺鍡欐Ж婵炲棴绻濋崗姗€寮弶璺ㄧ处濞戞挴鍋撴繛?HTTP 閻犲洭鏀遍惇鐗堟交閻愭潙澶嶉柨娑樼焷閳ь剙鏈Σ鍛婂濡搫甯ュ璺虹Ф閺併倝骞愭担椋庣暯 keep-alive 閺夆晝鍋炵敮?
- 濞存粍鍨归顒€顕欓幆鎵婵炴潙顑堥惁顖炴偐閼哥鍋撴担瑙勭厐濠⒀呭剳缁?
  - `input_seq`
  - `ack_input_seq`
  - `snapshot_seq`
- 闁告挸绉堕顒€顕欓幆鎵婵☆垪鈧磭纭€濞戞挸绉撮崯鈧悗鐟拌嫰閸欏繒绮垫径濠勭濞存粍鍨归顒勫炊?`clone_input` 闁归潧绉存慨?
- 鐟滅増鎸告晶鐘诲磻濮橆厾銆婇柡鈧柅娑滅闁?  - 闁哄牜鍓欏﹢鎾礂閸喎鐦荤憸鐗堟尭婢х姵娼忛幘鍐插汲闁烩晛鐡ㄧ敮瀛橈紣閸曨剛銈撮柛蹇擃儔濞堟洟宕搁敃鈧崢鐘电矓鐠囨彃袟/閺夌儐鍓欓幃?
  - 濞存粍鍨归顒佹交閺傛寧绀€闁哄鍟埢澶嬫媴瀹ュ洨鏋傞柛姘娴犳稒娼繝姘闁哄秮鍓濋?
  - 闁哄唲鍐╁渐闁绘挆鍌滅獥閻炴凹鍋傚☉顏勵嚕閸愯法绀夊☉鎾崇Т閸熲偓閻熸洖妫涘ú濠囧棘閹殿喖笑闁?- 鐎点倖鍎肩换婊兾熼垾宕囩闁汇劌瀚槐鎴︽倶椤愩倕绠涢柛锔哄妽濠€浣圭▔閵堝懐婀村ǎ鍥ㄧ箞濞堜即鏁?  - 闁哄牜鍓欏﹢鎾礂閸垺鏅搁柟瀛樺姍椤ｂ晛霉鐎ｎ亞鎽嶇€殿喚娅㈢槐婵囩┍濠靛﹦妲堥柟绋款槺閳规牠寮介懖鈺冨綄闁告帞绮﹢渚€宕ｅ澶樻疮
  - 濞存粍鍨归顒佹交閺傛寧绀€ `fire_events + bullets` 闁告艾楠搁崯鈧柟璺猴躬椤ｂ晛霉鐎ｎ亞鎽嶇€殿喚鎳撻幏浼村级閸愩劉鏋嗛悗娑欏姇閼村﹦鈧潧缍婄紞?
- 閺夆晜鐟﹂悧閬嶅籍閵忥及鎺楀礃閸忓懐鍟婇柍銉︾矌閳规牠寮介崗鑲╂⒕闁绘劦鍠栭懘濠囧灳濠垫挾绀夊☉鏃傚枙椤斺偓缂佸顕ф慨鈺呭椽鐏炵晫纾婚柣蹇ｅ亰閸忔﹢寮寸€涙ê澶嶉弶鈺傚灣鐎靛苯霉娴ｆ垝绮撻柡鍫㈠劋閻栧爼骞嬭箛鏇熺暠濞达絾鎸婚崝?

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_cloud.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?- 婵炲备鍓濆﹢渚€宕㈤懡銈庢骄閻熸瑥妫濋。鍫曟煣閹规劗鐔呴柕鍡曠劍椤掓粌顕ｈ箛鏂夸粯闁告帒鐖奸幗鑲╂崉椤栨ǚ鍋撴担瑙勭疀闁告棑绱曢鎼佹偠閸℃稒鎳犻悹?- 闁衡偓閻熸澘袟濞寸姴绉堕崝褎绋夐妷锔惧闁衡偓閼稿灚灏嗛柛锔哄妼閻剛绮欑€ｎ亞纰嶇€规悶鍎抽埢濂稿礃閸涙潙鍔?
- WebSocket 闁告瑯浜滈崢娑㈡媰閽樺韬柍銉︾矊婢х姷绮?<-> 闁哄牜鍓欏﹢?backend闁炽儲绻嗙换鏍ㄧ▔閳ь剙鈻撶喊澶岀闂侇剙鐏濋崢銈嗙▔鏉炴壆鍟婃繛鏉戭儓閻︻垶鏌ч幑鎰唴闁告ê顭烽崳鎼佸磻濮橆厽娈诲┑鍌涖仦缁垳绮╅姘閻?- 闁炽儲绮嶅﹢浼村捶?backend <-> 濞存粍鍨归顒勫灳濠靛﹦绠瑰☉鎾亾婵炲牓娼ч崢娑㈡焻濮樺磭绠栭柟闀愭缁?keep-alive 閺夆晝鍋炵敮鎾⒔瀹ュ懐纾婚梺搴撳亾闁挎稑濂旂紞鏃€绋夋潪鎵У濡炲閰ｅ▍鎾存櫠閻愬搫娅ゅù鍏济€?
- 闁?HTTP sync 闁告粌鏈Λ?SSH fallback 闂侇喗鍨濈换姘舵偩濞嗘瑧绀夐梺顒€鐏濋崢銈夊棘娴煎瓨鎳犻悹渚灠閸ゎ參姊婚鈧。浠嬪籍閼稿灚娈婚柡澶嗗墲缁佸鎷犻弴銏℃嚑閻犱警鍨伴妵鎴﹀极?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?- `python -m compileall backend` 闂侇偅淇虹换?
- `frontend` 濞戞挸顑嗘晶鐣屾偘?`npm run build` 闂侇偅淇虹换?

闂侇剚顨堥弳鈧梻鍌ゅ櫍椤ｄ粙鏁?- 閺夆晜鐟﹂鑲┾偓鍦仧楠炲洭鎯冮崟顒佇﹂柍銉︾矋濞插潡宕撹箛搴＄槣婵炵繝娴囨禒鍫ュ嫉濞差亶鈧洭寮搁崹娑掑亾濠靛牊鐣遍柣妤€鐗婂﹢浼存晬鐏炶偐绋婚弶鈺偯肩粭澶愬及椤栨氨鏆氶柡浣割嚟濞堟垿宕堕悙瀵告硦闂佹彃绉电槐銊ヮ嚕?netcode
- 鐟滅増鎸告晶鐘诲嫉椤掆偓濠€鎾冀閳╁喚鍔€闁哄嫷鍨垫禍銈夋煂韫囨洜鐪伴柛瀣獜缁辨繃绋夊鍡樞﹀☉鎾卞劜閻楁悂骞愭径濠傚殥缁绢収鍠涢缁樻綇閹惧啿寮抽梺鎻掔У閺備線寮€涙﹩鍞介柛妯烘瑜?
- 濠碘€冲€归悘澶愬触鎼淬劍妗ㄧ紓浣堝懐鏁剧€垫壋鍋撻柡鍥╃節缁楁挻绋夊杈ㄧ暠闁艰鲸姊瑰┃鈧柛姘湰椤掔偤妫冮悪鍛闁告瑯鍨禍鎺楀礃瀹ュ煻澶愭晬?  - 闁哄洦娼欓悾顒勫极鐎靛憡鐣遍弶鍫熸尭閸欏棝宕㈤崱妤€钑夐柛銉у仦閺?
  - 闁哄洤顕划蹇涙儍閸曨剚顦ч梻鍌氱摠閸╂垹鈧潧缍婄紞?
  - 闁哄洤顕彊閻庤姘ㄥ▓鎴炴交濠婂拋浼傚ù婊冾儎濞嗐垻娑甸娆惧悋闁哄牆鎼崺?

## 闁稿繑濞婇弫顓㈡⒐閹稿孩鍩傜紒鎾呴檮濞碱偊骞€閼姐倗娉?

閺夆晜鐟ょ花铏圭棯閿旇姤灏嗛悹鎰靛灣閳规稒绂嶉崱妯绘濞戞搩浜滈悿鍕偝閹峰瞼绠栫紒瀣儜缁辨繃绋婇悢椋庡畨閻犲洢鍎抽幋椋庣磼椤撴繄绠介柟闀愮筏缁?

1. SSH / 濞存粍鍨归顒勫箳瑜嶉崺妤呮焻閺勫繒甯嗛柣锝嗙懃濠€?Python backend闁挎稑濂旂粭澶嬫交濞戞ê顤呯紒鏃戝灛閳?2. 濮掓稒顭堥鑽や焊娴犲娅ら悘蹇斿灦閺佸ジ寮崶锔筋偨闁靛棔绀侀惃顖炲箥閳哄倹娈犻柡鈧悷鏉啃楅柨娑樻湰閺岀喐绗熸径鍛婂攭闁规亽鍎埀?3. 闁奸绶氶幗鑲╂崉椤栨瑧鍠橀柛蹇撶墔缁绘岸鎮惧▎搴ｇ▕闁稿繑绮岀花鎶芥晬瀹€鍕彑闂傚牏鍋熼弫銈夊箣闁垮顫栫痪顓у枦椤╋箑效閸屾艾鐏╅梻鍕╁€戦埀?4. UI 閻熸洑鐒︾€垫梻绱掗鐘虫▕闁归晲绀佸〒鍓ф喆閹哄鍋撴担鍦帳闁告粌琚埀顑胯兌楠炲洦绂掗敐鍡╂斀闂傚牄鍨洪崝鍛存晬鐏炶偐鐟濋柤鍏呯矙閳ь兘鍋撻柛鏍ㄧ墬閸ㄦ岸寮查鈧埀顒佽壘閹宕ｉ悧鍩線寮剁憗銈傚亾?5. 闁秆嶇畱閸樼姴銆掗崨濠傜亞鐎点倖鍎肩换婊兠圭€ｎ厾妲告俊顖椻偓宕囩闁汇劌瀚槐顓㈠礌閺嵮呯畱濡炪倕顭峰▓褏绮嬫导娆戠濞戞挸绉烽々锔姐亜閻戞ê顤佺憸鏉垮船閹煎嘲顫㈤敐鍛閻熸瑥妫濋。?/ 闁硅矇鍐ㄧ厬闂佺偓宕橀惌楣冨Υ?6. 闁瑰灚鎸哥€垫﹢宕ユ惔銈庢矗閻忓繋绮欓崳娲础閾忣偄绲婚柛妤€纾弫銈夋晬鐎规亞ckend sidecar 闁汇垻鍠庨幊锟犲川閵婏附鍩傞煫鍥ф嚇閵嗗繒鎹勯悢璺虹槣缂佸顑呯花顓犵磼閹存繄鏆伴柕?
## 濞戞挸顑勭粩鏉戔枎閿涘嫭鍩涚紓渚囧幖閸熸捇寮妷銉х闁哄啳娉涚紓鎾舵媼椤旇В鍋撴惔婵堢杽閻?
鐎点倝缂氶鍛掕箛鏃戝仹濠㈠爢鍕毉闁圭顦崇换鏍ㄧ▔椤忓惀渚€寮堕崹顔借含闁哄牜鍋勯悢顒佹交閽樺顫ｉ柨?
```md
## 闂傚啳鍩栭?N闁挎稒纰嶉悥锝嗭紣?
濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- ...

濞戞挻妲掗々锔剧磼閹惧浜柨?
- ...

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- ...

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- ...

闂侇剚顨堥弳鈧梻鍌ゅ櫍椤ｄ粙鏁?
- ...
```

## 闂傚啳鍩栭?23闁挎稒淇洪鍕磼閸愨敔浣割嚕韫囨挸顫ｉ柛蹇嬪劜濠€浼村捶閹殿喗鏆╅柤瀛樺灩鐢櫣鈧?
濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 闁活潿鍔嶉崺娑氭暜鐏炵偓绠块煫鍥跺亰閳ь剛鍠栭悰娆戞嫚娴ｆ祴鍋撳鍐╁闁活澀绲婚崜鎶芥偝閳轰緡鍟€閻庝絻顫夐崹顒勫灳濠靛牊鐣遍柛鈺冨劋濠€浼村箥鐎ｎ偄濡?
- 闂侇偄顦扮€氥劑寮甸埀顒佹媴鎼搭煈妫戦梻鍕ㄦ櫆閺岀喎顩奸崼顒傜闁告瑯浜滃﹢顏嗘媼椤撶姷鐭婃俊顖椻偓宕囩闁告梻濮撮崣鍡樼▔閳ь剚绋夐鍡欐殕闁?AI
- 濞戞挸绉堕～顐ｇ閹寸媭浼傞悷娆忔椤ｅ爼濡存担鐟颁粯闁告帗婀规穱濠囧矗閺嬵偀鍋撴担瑙勭疀闁告棑绱曢鎼佹偠閸℃劏鍋撴担鍛婎偨閺夆晝鍠愮粊瀵告嫚閺囥垺鎳犻悹?
濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁?`TankTroublePanel.tsx` 闁汇劌瀚﹢浼村捶閹峰矈鍞茬紓浣稿暙缁扁晠骞欐惔銊ユ闁哄倹婢橀·鍐╃▔閳ь剚绋夐鍛嫳闁革附澹嗛弫鎼佹嚇閹寸姴璐熼悗?`CPU-1`
- 闁活澀绲婚崜鎶芥偝閳轰緡鍟€濞村吋纰嶆晶鐣屾偘鐏炵晫鍞ㄧ痪顓涘亾闁汇劌瀚ù鍡涘触閹存瑢鍋撴担鑺ュ闁告垶鐪归埀顑跨劍婵搫顕ｉ埀顒傛崉濠靛牜鐎查柕鍡曠瀹曡鲸鏅跺▎蹇斿€甸柣顓у幗濞堝繘宕愰幒鏇熺盃闁靛棔鑳堕悗顖炲礄閸℃纾婚柣?- 闁活澀绲婚崜鎶芥偝閳轰緡鍟€濞达綀娉曢弫銈夋偑椤掑倻褰岄悗娑欏姇閼村﹪宕氬Δ鍕┾偓鍐╃▔鎼淬垺鎷遍柛锔藉椤偊骞橀悙琛″亾閺勫繒甯嗛柨娑樿嫰瑜版煡宕欑拋瀹犲幀闁绘壕鏅涢宥夊Υ娓氣偓濠㈠繒鈧稒鍔曢幏浼存嚊椤忓嫮绠?
- 闁绘壕鏅涢宥団偓娑欏姇閼村﹪鎮抽弶鎸庤含濞戞梻鍠嶇槐鐗堢▔鎼达絾鏆╅柤瀛樺灩鐢櫣鈧娉涜ぐ鍌炴偨閻旈攱鍤掑☉鎿冨幖閸ㄧ晫鈧鐔槐婵嬪礄缂佹妲堥柛姘捣閻濇盯宕氭繝姘闁?- 閻犱緡鍘剧划灞轿熼垾宕囩婵炴挸寮堕悡瀣▔椤撴繄绐楅柡鍕⒔閵囨岸鎮芥担鍐ㄥ闁绘壕鏅涢宥夊锤閿曗偓閸樼娀宕?`CPU-1` 闁哄秴娲ㄩ?
- 闁活澀绲婚崜鎶芥偝閳轰緡鍟€闁烩晝顭堥崣褏绱掗悢娲诲悁濞村吋淇洪鎼佸礂閵夛附鎷遍柛锔藉椤斿嫮绱掗崘銊﹀渐闁绘挆鍌濆幀闁汇劌瀚悺娆忣嚕鐟欏嫭娈堕梺?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 濞戞挸绉甸弻濠冩櫠閻愬瓨鐓€婵☆垪鈧櫕鍋ラ柨娑樼灱閹撮绱掗鐔肺╅柡鈧悷鏉啃楅柡鈧懜鍨異闁革负鍔庨獮鍥嫉?`TankTroublePanel.tsx`闁挎稑鏈弻鐔哥瑹婢跺憡鍞夐柟?- 闁活澀绲婚崜鎶芥偝閳轰緡鍟€闁告瑯浜滃﹢?`latencyOnly === false` 闁汇劌瀚鍕磼閸愵喒鍋撻弰蹇曞竼濞戞搩鍘藉ú鍧楀棘鐢喚绀夌€点倖鍎肩换婊兠圭€ｎ厾妲告俊顖椻偓宕囩閻庣懓鑻崣蹇旂▔瀹ュ懎缍€鐟滄澘宕幖?
- 闁烩晛鐡ㄧ敮瀛樺緞瀹ュ洦鏆忛柣婊呭濠€渚€寮甸鈧﹢鎾捶閺夋寧绂堥柕鍡曡兌椤偊骞橀悙顏佸亾娴ｅ摜鎽嶇€殿喖绠嶉埀顑跨窔閸ｆ悂鎮介悢鍛婄皻闁告帟顔愮槐婵嬫焼閸喖甯抽柟纰樻櫆閺嗗酣宕氭０浣洪殬缂佹棏鍨遍崺褔姊婚幘顔瑰亾閺勫繒甯?

濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `frontend` 濞戞挸顑嗘晶鐣屾偘?`npm run build` 闂侇偅淇虹换?

闂侇剚顨堥弳鈧梻鍌ゅ櫍椤ｄ粙鏁?
- 鐟滅増鎸告晶鐘绘偨娴ｅ啫澹嬮柣婧炬櫅椤斿秹寮伴妞诲亾濠婂喚妾柣顫妼濮樸劎鎮扮仦绯曞亾濠靛牊鐣遍柛鈺勬椤㈠懘鏌呴弰蹇曞竼闁挎稑鐭佺换鏇熺▔瀹ュ懎鐦堕柛姘煎亜椤曟壆鎹勯妯峰亾娓氣偓椤ｂ晠宕氶妶鍛唨鐎殿喖绠嶉埀顑跨窔濮ｏ附鎯旈敃鈧崹搴ｇ棯?- 濠碘€冲€归悘澶愬触鎼达絿鏁鹃悷鏇氱娴犳稑顫㈤敐鍛闁艰鲸姊瑰┃鈧悗浣冾潐閸?AI闁挎稑鑻紓鎾舵媼椤旂厧缍楃€殿喒鍋撻梻鍛⒒椤洭鏌ч幑鎰唴闁挎稑濂旂粭澶屾啺娴ｇ懓惟閻犱緡鍘剧划?AI 婵烇絿鏌夌换妯荤閹寸媭浼傞柡澶婂暙閳诲宕ョ仦缁㈠妱

## 闂傚啳鍩栭?24闁挎稒姘ㄧ划鐑樼▔閳ь剟鎮欓鑹板墾閻熸瑥瀚崹顖炲礆?5 闁?/ 10 缂?/ 1.85 闁哄秴鍚嬮惁锛勭矓?
濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 闁硅泛锕ょ紞瀣礈瀹ュ懏钑夐柛蹇擃儐閻栧爼骞嬭箛鏇熺暠闁绘劦鍠栭懘濠勬喆閸曨偄鐏熼柡鈧憴鍕亣闁哄洤鐡ㄧ敮瀛樻交閹寸姵绐楅柡宥呮川鐢搫鈻?- 濞ｅ洦绻嗛惁澶愬嫉椤掆偓濠€瀵告媼椤撶姷鐭婃俊顖椻偓宕囩闁告粌濂旂花顖滅博椤栨碍顐介弶鈺冨枑缁佸鎷犻弴鐔屼礁顕ｈ箛搴♀枏闁活潿鍔岄幃鎾寸▔閳ь剚绺藉Δ鍐ㄤ粡鐎殿噣鈧稓鐟愰梻鍕姃缁楀瞼鈧潧鐏濋幊?
- 缂備綀鍛暰濞ｅ洦绻冪€垫棃寮ㄩ悷鏉啃楅梻鍡楁閼垫垿鏁嶇仦鑲╃憹闁告宕甸～顐ゆ喆閸℃侗鏆ラ柕鍡曠劍鐢爼宕氶張鍏哥箚闁告瑩鏀遍崹銊╁嫉瀹ュ懎顫ょ紒鐙呯磿閹﹪鏌ч幑鎰唴

濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁告娲戦柌婊堟偝閳轰緡鍟€闁告艾鏈鍌炲捶閵娿儲绨氬瀣仩椤㈡垿鎯冮崟顓炰粡鐎殿噣鈧稓鐟愰梻鍕姃缁?12 闁衡偓闁稖绀?5
- 闁绘劦鍠栭懘濠勨偓闈涚仢閹斥剝绂?3.9 缂佸甯楅弫鍏肩▔?10 缂?- 闁绘劦鍠栭懘濠囨焻閻斿嘲顔婇柡鈧柅娑滅 1.85 闁哄秴鍚嬮惁锛勭矓?- 闁告挸绉堕顒勫嫉椤掆偓濠€鏉戭嚕閺囩喐鎯涘☉鎾崇凹缁垳绮?`tank_trouble_room.py` 闂侇喗鍨濇繛鍥偨閵娿儲鍊卞☉鎾亾濠靛倹顨嗛弻濠勬喆閸曨偄鐏?
- 濞存粍鍨归顒€顕欓幆鎵婵炴潙顑堥惁顖炲矗閹存繄娈搁柡鍐煐閺屽﹥鏅堕悙鎵晩闁炽儲绮岀紞瀣礈瀹ュ棙銇熼柛鏂诲妿閸嬫牕顕ｇ憴鍕 < 5闁炽儲绻傞崹浠嬪棘椤撱劎绀夐梺顒€鐏濋崢銈夊级閸愩劉鏋嗙紒鏃戝灠閹蜂即寮甸鈧﹢瀵哥博椤栨繍娼愰柛鎺撶懁缁楀绋夐埀顒勬嚊?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/IMPLEMENTATION_LOG.md`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 鐟滅増鎸告晶鐘差啅閵壯€鏌ら梺鎻掔灱濞堟垿鍨惧鍕闁炽儲绻傞崢娑㈠及閻樿尙娈稿☉鎾荤細椤斿嫮绱掗崘銊﹀嬀闁搞儵绠栭埀顒佹缁额偆绱旈幋鐐靛闁汇劌瀚悡顓熸綇閻熺増妲€閻庣敻娼荤槐婵囨交濞嗘劗澹夐柛锔哄妿楠炲洭寮垫径鎰婵繐绲鹃弻鐔汇亹閵忊€崇仜闁革附妞介崳鐑藉礈瀹ュ懏鍊电紒鏃戝灠閻ｇ偓绋婃径澶岊伇闁?- 婵炲备鍓濆﹢渚€寮ㄩ悷鏉啃楃€殿喒鍋撻柣蹇ｅ亜閸犲酣宕″ǎ顑藉亾娴ｇ鍐€鐎殿喛顫夐濂稿极閼割兘鍋撴担鍛婂殥濞戞搩鍘奸崹鐣屸偓瑙勭啲缁辨繈宕ｉ鍛毆闁轰焦绋愰幈銊╁绩閸︻厽鏆忛柟鎾敱濡叉垹娑甸钘夌樄閻庤姘ㄥ▓鎴炵▔婢跺钂嬮悷娆忓閸?
- 閺夆晜鐟х划宥囨喆閸曨偄鐏熼悶姘煎亯椤绋夐崫鍕Ъ闁告挸绉村鍫曞礂鐎ｎ偆鍩楅柟鏉戠箳濞堟垶鎯旈弴鐐垫勾闁糕晞娅ｉ、鍛喆閸曨偄鐏熼柨娑欑〒楠炲洭姊奸懜娈垮斀闁圭鍋撻柡鍫濐槸閻ゅ嫰姊介崨顓犳暔闁瑰瓨蓱閺嬬喖宕氶妶鍛毎闁汇劌瀚啯鐎殿喖绻橀崗妯跨疀閸涙番鈧繘寮靛鍕煠閻庣懓鍠涚槐婵嬫嚀鐏炶偐鐟濋柡鍕靛灠瑜把囧绩鐟欏嫮鍘欏☉鎾亾濞戞搩浜濈粊瀵告嫚閺囩唽浣割嚕?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `frontend` 濞戞挸顑嗘晶鐣屾偘?`npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?

闂侇剚顨堥弳鈧梻鍌ゅ櫍椤ｄ粙鏁?
- 濠碘€冲€归悘澶愬触鎼达絿鏁惧ù锝囧Т缁楀洭寮靛☉鎺嗗亾濠婂嫮澹愰柍銉︾箖閺佸ジ骞嬮幇顒€鐒奸柣銊ュ閻ｇ偓绋婃径娑氱婵絾鏌ㄩ々褔骞愭径瀣咁參宕ラ幋婵嗙闁稿繐鍟鏃€鎯旈敂琛″亾娴ｇ儤妫婚柛姘灥瀹曠喖宕楅崘顔惧蒋閹艰揪璁ｇ槐婵嬪箣閺嶎兘鍋撻崨顔解枖鐎殿喖绻愬ù鎰偓瑙勮壘閸庢氨妲愰悩鎻掔濞达絽绋勭槐婵嬫閳ь剛鎲版担绋挎櫃缂備胶鍠嶇粩瀵告嫬閸愨晜娈婚柛鎾崇Т閹绮╅姘卞煑闂?
## 闂傚啳鍩栭?25闁挎稒鑹惧鍫曞礂鐎ｎ喒鍋撻悢宄邦唺闂傚嫬绉撮崺?1.6 闁哄秴鍚嬮惁锛勭矓?+ 鐎点倖鍎肩换婊兾熼垾宕囩闁衡偓闁稖绀嬮柡鍫墮濠€瀵哥磾閹达负鈧锛愰崟顕呮綌

濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 闁硅泛锕ゅ鍫曞礂鐎ｎ亞淇洪悘鐐插€讳簺闁告柣鍔戦埀顒傚枎鐎瑰磭绱掗悢鍓侇伇濞戞挸顑堥惃鐔煎礆?`1.6 闁?缂佸濡?
- 闁告瑦鐗楃粔鐑藉礈瀹ュ浂浼傜憸鐗堟尭婢х姵鎷呯捄銊︽殢濞戞搩鍘惧▓鎴﹀灳濠娾偓缁垳绮╅姘脯闂傚懎妫楀鍫曞礂鐎ｎ亝顐介弶鈺冨枑缁佸鎷犻弴妞诲亾濠靛鈧啴鎮?- 闁硅泛艌閳ь剚绮嶇粊瀵告嫚閺囩偞顐介弶鈺冨暱閳ь剚绻傞崣鍡涘矗閿濆棙鏆柟瀛樺姀閳ь剚绮嶅﹢浼村捶閺夊灝绀嬮柛褝绠戦崢?+ 闁哄牜鍓氬┃鈧紓鍐╁灴閵嗗锛愰崟顕呮綌闁?- 缂傚啯鍨块妴澶岀博椤栨艾娑ч柡鍕⒔閵囨岸骞嬪Ο鐑樼皻闁革附婢樺ù姗€宕畝鍐惧悁闁告帒妫欏姗€鏁嶇仦鑲╃憹闁哄嫬澧介妵姘跺礂閺堢數閾傞柟璨夊啫鐓戦柛?UI

濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁告挸绉堕?`TankTroublePanel.tsx` 闁?`PLAYER_SPEED` 闁衡偓闁稖绀嬮柛鈺勬〃缁剟鏌呴弰蹇曞竼缂傚啯鍨堕悧鎼佹儍?`1.6 闁?缂佸濡?
- 濞存粍鍨归?`tank_trouble_room.py` 闂佹彃鐬煎▓?`PLAYER_SPEED` 濞戞梻鍠庨幃鎾愁潰閵夛附鏆柟瀛樺姇閹挻绋夐埀顒傛喆閸曨偄鐏熼柨娑樼焸娴尖晠宕楀鍡樺紦闁哄鍎甸崳鎼佸棘閺夋寧鍎欓柣顫妽濡偊鏌ч幑鎰唴闁哄啳鍩栭弳鐔煎磹閸忚偐纾界紒?- 闁告挸绉堕?latency 婵☆垪鈧磭纭€濞戞挸绉撮崯鈧柛姘煎灠婵晠寮濞堟垶绂嶉幋鐙€浼?clone 闁告艾鏈鐐裁规担琛℃煠
- latency 婵☆垪鈧磭纭€闁绘粍婢樺﹢顏呭濮橆剙褰犻梻鍌ゅ幗濠€浼村捶閹殿喗鏆╅柤瀛樺灩鐢櫣鈧顔愮槐婵嬪矗椤忓啰绠介柣锝嗙懁缁斿瓨绋夐鍛嫳闁革附澹嗙敮铏光偓纭呮硾濞煎爼宕?- 闁哄倹婢橀·鍐嫉椤掍焦绨氱紓鍐╁灴閵嗗锛愰崟顕呮綌濡?`/tank-trouble/preview`
- 闁告挸绉堕顒勫捶?latency 婵☆垪鈧磭纭€濞戞挸顑勭槐浼村川閵婏附鍩傞柟璺猴工缂嶅宕滃鍡欏煑闁规潙绻掗弫楣冩閵忕姵濮庨柕鍡曟祰椤撴悂宕氶崱妯荤凡闁靛棔绀佸﹢鎾炊閻愵剛鍨肩紒娑楀嫎閳ь兛娴囩换宥囨偘瀹€鈧划铏规媼閳╁啫鑵归梺顐＄閸╁矂寮甸浣圭皻 backend
- 婵炴潙绻楅～宥夊闯閵娾晩鏆曢悷娆忕墦閵嗗宕ｉ鍛邦洬闁哄本鎸撮埀顒佺矋閸剟宕烽崫鍕嬀闁?+ 閻犱讲鈧啿鐎婚柡澶婄氨閳ь剚绻嗙换鏍ㄧ▔閵堝鍔ラ柛?- 闁哄唲鍛暠濞存粍鍨归?latency API 闁?`tank_trouble_room.py` 闁烩晝顭堥崣褔鏌呴弰蹇曞竼闁哄棗鍊瑰鍌涚┍濠靛牊娈岄柨娑樺缁叉崘銇愰幘鍐差枀闁告挸绉堕顒勫礂閵夈儱缍撳☉鎾崇Т閸熲偓濞达綀娉曢弫?

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/api/cloudApi.ts`
- `backend/main.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 濞戞捁妗ㄧ花锛勪焊娴犲娅ら悘蹇斿灥婵晠寮崶锔筋偨闁挎稑鏈惀鍛村嫉婢跺﹣姘﹂幖瀛樻礀閸ㄥ綊姊介妶鍡橈紜 latency clone 濞寸媴绲块悥婊堟晬鐏炶棄娑ч柡鍕靛灡婵℃瓕銇愰幘鍐差枀闁告挸绉堕顒勫礂閵夈儱缍撳ù鐘查叄閸嬪懘寮堕敓鐘虫嚑閻犱警鍨伴崹蹇曟導?- 缂傚啯鍨块妴澶嬶紣閸曨噮娼旀繛灞稿墲濠€渚€鏌屽鍛櫢濞戞挴鍋撳┑鍌涱殘鐎氼厾绮╃€ｎ偆鍩楅柟鏉戠箲鐟曞棝寮婚幘铏彜闁挎稑鐭侀埀顒€鏈Σ鎼佹儎鐎涙ê澶嶅璺虹Ф閺併倕顩煎畝鍕〃缂佹棏鍨扮紞瀣礈?canvas 閺夊牊鎸搁崵顓㈡晬瀹€鍕€栧ù锝呭閺佸ジ宕濋妸銊ョ槺闁搞儲娼欓幏浼村触鐏炵虎鍔勫瀣叄濞?
- 闁哄牜鍓氬┃鈧紓鍐╁灴閵嗗锛愰崟顕呮綌鐟滅増鎸告晶鐘愁渶濡鍚囧〒姘箚缁傚棝寮甸鈧﹢?backend 闁革附婢樺鍐晬鐏炶姤绀堟慨婵勫€栧ú鍧楀磽韫囧ň鍋撳鍕嫳闁哄牏鍎ょ粊鑽ゆ喆閸繃鐝ら悷娆忓€圭粊瀛樸亜绾版ǚ鍋撳┑鎾剁濞戞挸绉靛Σ鍝モ偓鐢垫嚀椤﹀宕楅鍌滅Ч濠㈣埖鐭Ч澶屾喆閸屾粍绠欏?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `frontend` 濞戞挸顑嗘晶鐣屾偘?`npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?

闂侇剚顨堥弳鈧梻鍌ゅ櫍椤ｄ粙鏁?
- 闁哄唲鍛暠濞存粍鍨归?latency 閻犱警鍨抽弫閬嶅椽鐏炵伕渚€宕圭€ｂ晝鐭濋柛锔哄妼娴兼劗绮欑€ｂ晞鍘柨娑樿嫰閹绱掗鐑嗘搐闁哄绮庨垾妯兼媼閵堝姣愰柡鍫㈠枍缁楀鎮介…鎺旂闁告瑯鍨禍鎺楀礃瀹ュ懍绮靛☉鎾亾婵炲棌鍓濈粩濠氭偠?- 鐟滅増鎸告晶鐘电磾閹达负鈧锛愰崟顕呮綌濞达綀娉曢弫銈夊嫉椤掆偓濠€瀵告暜瑜庣敮褰掓焻娴ｈ鐓欐俊妤€鐗炵槐婵嬫焻閸屾碍鍊ら悹瀣暢閻︻垶宕畝鍐炬綆閻庣數鍣︾槐杈ㄤ繆閸屾稓浜柛姘捣閻㈢粯娼婚懞銉ф勾闁哄洦鎸抽悵顔炬暜瑜忓濂稿箣閺嶎剚纭堕悹浣瑰劤椤︻剚锛愰崟顕呮綌闁挎稑鑻ぐ鍙夌閵夈儱鏅欓柡鈧憴鍕亣闁绘鍩栭埀顑跨閹挸顫㈤妷锕€鐏楁繛缈犵缁扁剝瀵奸悩铏圭炕

## 闂傚啳鍩栭?26闁挎稒姘ㄧ紞澶嬨亜閻㈠壊鏆曢悷娆忕墦閹借偐鎹勯娑卞妧閻熸瑥瀚€靛弶绋?scene 闁绘鍩栭埀顑跨閹挸顫?viewer

濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 闁硅泛锕ュ﹢浼村捶閹殿喚绉瑰銈囨暬椤ｂ晝鎲撮崼婊呯煠闁炽儲绮嶇敮褰掑箣椤忓嫭绂堥悽?+ `<img>` 闁告帡鏀遍弻濠囧灳濠靛棗纾崇紒鐙欏嫬鐏囨慨婵撶到缁憋繝鎯冮崟顓炐﹂柟顑跨閹挸顫?viewer
- 閻?backend 缂佹棏鍨冲▓?preview payload闁靛棔鑳舵慨鎼佸箑娴ｈ櫣澶勯悗娑櫱滈埀顑跨劍缁佽崵鎲撮崼婵囩彜婵炴挸寮堕悡瀣嚂瀹€鍐厬婵炴挸鎳忓▍姘跺礆閸℃婀?
- 濞ｅ洦绻冪€?latency 婵☆垪鈧磭纭€濞寸姴绉堕崝褔宕ｉ鍐▕闁活潿鍔嬬花顒勫锤閿曗偓閸樼姴銆掗崨濠傜亞婵炴潙顑堥惁顖炴煣閹规劗鐔呴柨娑樺缁楀銇愰崡鐐存儥闁硅矇鍐ㄧ厬 / 閻熸瑥妫濋。璺侯潰閿濆懐纭€闂佺偓宕橀惌?

濞戞挻妲掗々锔剧磼閹惧浜柨?
- `frontend/src/types/cloud.ts` 闁哄倹婢橀·鍐╃?Tank Trouble preview 闁烩晝顭堥崣褔寮伴幆褏纭€缂侇偉顕ч悗鐑芥晬?  - `TankTroublePreviewSceneState`
  - `TankTroublePreviewPushRequest`
  - `TankTroublePreviewClearRequest`
- `frontend/src/api/cloudApi.ts` 濞戞挸绉撮崯鈧柣?`Record<string, unknown>` 闁?preview闁挎稑鐭侀埀顒€鏈Σ鎼佸绩鐟欏嫬鐏囬柡鍕劤缁?preview request 缂侇偉顕ч悗?
- `frontend/src/components/TankTroublePanel.tsx` 缂備綀鍛暰闁?latency 婵☆垪鈧磭纭€濞戞挸顑嗛惁?`50ms` 闁?preview闁挎稑濂旂徊楣冨礃閸涱収鍟囧ù鐘茬岸閳ь剚绮嶉崺鍛村炊閹勫闁炽儲绻冮婊冾嚕韫囨梹鏆柟瀛樺姉缁劑寮搁崟顐㈩嚙 `scene`
- `backend/models.py` 闁哄倹婢橀·鍐╃?preview 闁烩晝顭堥崣?Pydantic 婵☆垪鈧磭鈧兘鏁?  - `TankTroublePreviewRow`
  - `TankTroublePreviewSceneState`
  - `TankTroublePreviewPushRequest`
  - `TankTroublePreviewClearRequest`
  - `TankTroublePreviewState`
- `backend/main.py` 闂佹彃鐬煎▓?preview 闁绘鍩栭埀顑胯兌缁憋妇鈧稒眉缁楀宕樺鍕閻?`frame_data_url`闁挎稑鏈弫鍏肩▔鏉炴壆绠介悗娑欘焽缁劑寮搁崟顐㈩嚙 `scene`
- `backend/main.py` 閻?preview rows / scene 闁稿鐭花锟犳⒐閸喖顔婇柛婊冨鐎靛本锛愬Ο鑲╂惣闁糕晞娅ｉ、鍛般亹閹哄秶顏遍柛鏍ㄧ壄缁辨繈鏌嗛崹顔煎赋闁哄啰濮烽弲?payload 闁烩晛鐡ㄧ敮瀛樻交濞戞ê寮崇紓鍌涙尭閻?
- 闁哄倹婢橀·?`backend/tank_trouble_preview_page.py`
- `/tank-trouble/preview` 闁绘粍婢樺﹢顏堟偨?`backend/tank_trouble_preview_page.py` 闁汇垻鍠愰崹姘舵偑椤掑倻褰?viewer 濡炪倗鏁诲?
- 閺夆晜鐟ら柌?viewer 濞村吋淇洪悿鍡欐嫚?`/api/games/tank-trouble/preview/state`闁挎稑鑻懟鐔煎捶閵婏妇銈婚悷娆忕墕濞呮帡寮甸鈧﹢?`<canvas>` 濞戞挸锕ョ憰鍡涘蓟閹垮嫮绐?
  - 闁瑰瓨锚濠р偓闁革附婢樺ù?
  - 闁秆嶇畱閸?
  - 閻庢稒鍔曢懘?
  - 闂傚牐娉涢悺?
  - 濠⒀勭懁缂嶅鈻旈姀銏＄潖
  - 閻庢稒鍔曢懘濠偳庨垾鍐叉瘔闁绘顫夐弲?
  - 闁告瑥鍘栭弲鍓佹媼閳ュ啿鐎婚柡?
闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_preview_page.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 濞戞挸绉撮崯鈧繛宀冩硶閺併倝骞嬮鍕闁告帡鏀遍弻濠囨儍閸曨喚娈堕悹鍥ㄦ礀閻庨鈧湱鍋熼獮鍥晬瀹€鈧ú鍧楀箳閵夛附鏆柟瀛樺姀閳ь剚绮庣划銊╁几閸曨偄顕ч柣妯垮煐閳?+ 婵炴潙绻楅～宥夊闯閵婏附鎷遍柛锔惧鐟曞棝寮婚幘顖楀亾濠靛牊鐣辨慨婵撶到缁憋繝寮憴鍕垫敵
- preview viewer 濞ｅ洦绻冪€垫棃宕ｉ鍥跺殺闁挎稑鑻ぐ褏鎷归悢鑽ょ厬闁活亜顑嗛崹顒勫捶閸濆嫭瀚查悹浣测偓鍐茬€婚柡澶婂皡缁辨繃绋夊鍡椢╂俊妤€鐭傚浼村箳瑜嶉崺妤呭矗?UI 濠㈣泛绉撮崺妤佹交濞戞氨绉瑰?- 闁?latency WebSocket / HTTP sync / clone 閻犱警鍨扮欢鐐电磼瑜忛悽缁樼┍濠靛牊娈屽☉鎾虫惈瀹稿宕ｉ幓鎺旀澖濡ょ姴濂旈崬顒勬儘娓氬﹦绀夊ù锝呮缂嶅宕滃鍛枀缂佹棏鍨伴崣鍡涘矗閿濆嫮鐟濋柛鎰С缁堕鎸ч弽褏鏆?

濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `frontend` 濞戞挸顑嗘晶鐣屾偘?`npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?

闁告艾娴烽悽濠氬箵閹版澘鏅柨?
- `backend/main.py` 闂佹彃鏈Λ顐︽儍閸曨偄鏁堕柤?preview HTML 濞寸姴绉堕崝褎娼诲Ο鐑樿含闁哄倸娲ｅ▎銏＄▔椤撱劎绀夊ù锝呮缁诲秶鎮扮仦钘夊汲闁告瑱绲介崙锛勭磼韫囨挸鐎奸柛?`backend/tank_trouble_preview_page.py`
- 濠碘€冲€归悘澶嬬閵夈儲鍊电痪顓у枦椤撶粯绋夊鍛櫃闂傚洠鍋撻悷鏇氱瀹稿宕ｉ幓鎺旀澖闁绘粌搴滅槐婵嬪矗椤栨瑤绨伴柛鎰Т娴犳稒绋夐埀顒€鈻庨垾鍐叉锭闂佽棄鐗嗛?preview 濞寸媴绲块悥婊堟儍閸曨剛顏搁柣鐐叉閸ｆ悂寮?
## 闂傚啳鍩栭?27闁挎稒顒猺eview 闁煎崬鐭侀惌妤冪磼瑜忛悽濠氬触鎼达及鈺呭礆?backend闁挎稑鑻晶鐘电博椤栨艾娑у☉鎾筹攻婵倝鎮抽埡渚囧晙闁秆嶇畱閸樼姾绠涢銈呭季

濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 閺夆晜绋愮粩鏉戭潰閵夛附鏆紒?preview 闁煎崬鐭侀惌妤佹綇閸︻厽娅?
- 濞戞挸绉撮崯鈧悹浣叉櫅婢х姷绮╅娑樿吂 `scene / rows / map_label / runtime_summary`
- 闁衡偓鐟欏嫬鐏囬柣?backend 濞戞挻鎹囧Λ顒傜磼鐎涙ê袘 preview session闁靛棔璐璷om cache 闁?viewer state

濞戞挻妲掗々锔剧磼閹惧浜柨?
- `frontend/src/components/TankTroublePanel.tsx` 濞戞挸绉撮崯鈧柡瀣閳?preview `scene`
- 闁告挸绉堕?latency 婵☆垪鈧磭纭€濞戞挸顑囬獮鍥捶閵娿儱娑уù鍏肩鐎垫粓宕堕崫鍕毎濡増鍨瑰濂稿箳閵娾斁鍋撴笟濠勭獥
  - `session_id`
  - `room`
  - `player_id`
  - `country_code`
  - `tank`闁挎稑鐗撻·渚€鎳濈仦鍌楀亾娴ｅ憡缍忛柡宥呮储閳ь兛鐒﹀﹢鐐哄触閹存瑢鍋撴担绋跨９鐎垫澘瀚ㄩ埀顑垮叕lash闁?- `frontend/src/types/cloud.ts` 闁?`frontend/src/api/cloudApi.ts` 閻庣數鎳撶花鏌ュ绩鐟欏嫬鐏囬柡鍌涘濞?preview push request 缂備焦鎸婚悗?
- `backend/models.py` 闂佹彃鐬煎▓?`TankTroublePreviewPushRequest` 闁衡偓鐟欏嫬鐏囬柍銉︾矌鐢櫣鈧娉涘鍫曞礂鐎ｎ亝褰ラ柣鎾楀棭鍤炴慨鐟板€甸埀顒佺箖鑶╅柛?- 闁哄倹婢橀·?`backend/tank_trouble_preview_runtime.py`
- 閺夆晜鐟ら柌?runtime 濞戞挻鎹囧Λ顒傛嫻閻旇崵鐓戦柨?  - 缂傚倹鎸搁悺?room sync 缂備焦鎸婚悘?
  - 缂佺媴绱曢幃?preview session
  - 闁圭顦伴崺褔姊?map seed 闁汇垻鍠愰崹姘櫠濞嗗海绉?
  - 闁革负鍔嶅﹢鍥礉閿涘嫷浼傞柣銏㈠枑閸?preview 闂傚牐娉涢悺?
  - 闁汇垻鍠愰崹?rows / map_label / runtime_summary
  - 缂備礁瀚ˉ濠囧嫉閳ь剛绱掗崼锝囩闁搞儳鍋熺划?viewer 闁?`scene`
- `backend/main.py` 闂佹彃鐬煎▓?tank room sync / vote / leave 闁绘粍婢樺﹢顏呭濮橆剚鍊辨慨婵勫劚閸╂盯寮?preview runtime 闁?room cache
- `backend/main.py` 闁?preview push / clear / state 闂侇偅妲掔欢顐﹀绩闁稖绀嬪┑顔芥⒐婢ь厾绱?`TankTroublePreviewRuntime`

鐟滅増鎸告晶鐘绘嚂瀹€鍐厬閺夊牆婀遍弲顐︽晬?
- 闁告挸绉堕顒傛嫻閻旇崵鐓戦柨娑欑濠€浼村捶閻楀牏鍩楅柟鏉戠箺缁诲秶鎮扮仦鐑╁亾娴ｅ搫璐熼悗纭呮硾濞煎爼宕楃€ｎ亝褰ラ柣鎾楀倻鐟愬ù?- backend 閻犳劗鍠曢惌妤呮晬濮濈湕eview 濞村吋淇洪惁浠嬫偐閼哥鍋撴担纰樺亾娴ｇ懓鐓ｉ梻鍌氼嚟缁憋妇鈧稒菧閳ь兛绠峣ewer 闁绘鍩栭埀顑跨劍鐎氬墽鎲?- browser viewer 閻犳劗鍠曢惌妤呮晬濮樻剚鍤㈤柛?backend state 妤犵偠鍩栧﹢浼村捶閻楀牐顩柡?canvas

鐟滅増鎸告晶?viewer 闁汇劌瀚崙锟犳儗閵夈儱绲块柤绋跨▌缁?

- 闁搞儳濮崇拹鐔煎礈瀹ュ浂浼傚☉鎾崇Т閸熲偓濞戞挸锕ｇ槐?whole scene闁挎稑鐦塱ewer 鐟滅増鎸告晶鐘崇▔瀹ュ懎鏅欏〒姘箚缁傚棝宕滃鍥朵紓闁圭粯鍔掔欢鐢告儍閸曨偆鎽嶇€?/ 婵炲鍨诲Ч?/ fade 闁绘顫夐弲?
- 闁绘粈鍗冲Ο浣糕枔?backend 闁汇垻鍠愰崹姘舵儍?preview scene 闂佹彃绉堕崑锝夊及椤栥倗绐?
  - 闁革附婢樺ù?
  - 鐟滅増鎸告晶鐘绘偝閳轰緡鍟€闁秆嶇畱閸?
  - 闁哄牆绉存慨鐔虹博椤栨粍鏅搁柟瀛樺姉濞堟垿妫冪捄铏规憤
  - 閻犱讲鈧啿鐎婚柡澶婄仢閹风増娼婚幇顖ｆ斀闁绘鍩栭埀?- 閺夆晜鐟﹀ú璺ㄧ箔閿曗偓閹酣鍨惧鍕疀闁告棑绱曢顒佺▔閹剧粯锛岄柛鎺戞閸樸倖鎷呭鍥╂瀭闁靛棔绀佹晶鐘电博椤栨艾娑у☉鎾筹攻婵倝鎮抽埡渚囧晙闁秆嶇畱閸樼姵绌遍埄鍐х礀闁炽儲绻勫▓鎴犳啺娴ｅ湱婀?

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `frontend/src/api/cloudApi.ts`
- `backend/models.py`
- `backend/main.py`
- `backend/tank_trouble_preview_runtime.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

## 闂傚倸鍟抽崺鏍敊?28闂佹寧绋掗顩噒ency preview 闂佸搫鐗嗙粔瀛樻叏閻旇櫣鍗氭い鏍ㄦ皑閹藉秶鈧鍠氶幊鎾诲箯娴煎瓨顥堥悹楦挎閹藉秹鏌ｅΟ鍨厫闁逞屽厸濞村洩妫㈡慨鎺旂帛閸斞呮濠靛洨鈹嶆い鏃傜摂閸斺偓闂佺宥囩暠闁告濞€瀵潧鈹戦崱妯衡偓?

婵炴垶鎸诲Σ鎺椼€呴敃鍌涘剮妞ゆ梻鏅崹濂告煥?
- 婵烇絽娴傞崰妤咁敆濠婂喚娴栫€光偓閸曨剚銆冨┑鐐存尭閹诧繝宕瑰▎鎾虫そ?browser preview 闂佺宥囩暠闁告濮风槐鎺懳熼崫鍕幀闂佸搫鐗婄换鍌炲箖濠婂牆鐭楃€广儱瀚崯濠囨煟閵娿儱顏俊顐ュ煐閿?
- 闁荤姳璁查弲婊呯矈閼姐倖鍠嗛柛顐ｇ箖閻?preview 闂佹椿浜為崰鎰邦敆濠婂牊鍎戦悗锝庝簻閻撳倿鏌￠崼婵埿㈠┑顔惧枔缁晠顢涘┑鎰秺闁荤喐鐟︾敮鐐测枔閹寸姭鍋撳☉娆忓闁兼潙锕ラˇ浼存倷妫版繃鏂€闂佸憡绮岄惌鍌氼焽娴兼潙绾ч悹鎭掑妿閸╃娀鎮?
- 闁荤偞绋忛崕閬嶅矗韫囨稒顥堥悹楦挎閹藉秹鎮跺鐓庝簻闁搞値鍠楃粙?-> 闂備焦褰冪粔鍫曞极閹剧粯鍎嶉柛鏇ㄥ亞閺変粙鏌￠崘顓炵厫闁逞屽厸閻掞箑煤閸ф妫?
- 闁哄鍋犻褎绂嶉弴鐔奉嚤婵☆垰鎼?preview 闂佽浜介崝鎴﹀焵?/ 闁哄鍎愰崰娑㈩敋濡ゅ懏鍤嶉柛灞惧嚬濞堁囨煥濞戞瀚伴柛锝堟娴滄悂骞嬮悩鐢敌ф俊鐐€楅弫鎼侇敂椤掍焦濮滈悹鍥紦缁ㄦ娊鏌熼崫鍕垫Ц闁硅埖纰嶉幏鍛村幢閺囩姷鎲归悗娈垮枟濞叉牠宕ｉ崱妯讳氦闁搞儜鍐惧敽婵犮垼鍩栭悧妤冩暜瑜版帒违濞达絽鎲＄粈鈧梻渚囧亐閸嬫捇鏌熺€涙澧垫い銉︾箘缁?

婵炴垶鎸诲Σ鎺椼€呴敃鍌氱哗闁荤喐婢樿闂?
- `frontend/src/components/TankTroublePanel.tsx`
  - `drawTankSprite()` 闂?`rotate()` 闂佽　鍋撻悷娆忓閻?`tank.angle + Math.PI / 2`
  - `buildPreviewPlayerSnapshot()` 闂佸搫鍊瑰姗€路?`shots`
  - preview push 闂佸搫鍊绘晶妤佹櫠濡ゅ懎绠归柛婵嗗閺?`snapshot_seq`
  - preview push 闂佸憡姊绘慨宕囪姳閿熺姵鈷撻柟缁樺笧閸ㄨ崵绱掓径妯虹仸闁逞屽墯濡叉帞娆㈤锔芥櫖閻忕偠濮ら崐閬嶆煛閸愵厽纭剧憸鎶婂洤绀傚ù锝囩摂閸熷懎鈽夐幘顖氫壕婵炴垶鎼╂禍锝夘敋椤掆偓鏁堥柛灞剧闊剟鎮归悜妯虹厐缂佽鲸绻堝畷銉︽償閳ュ磭鍘掗梺姹囧妼鐎氼剟鎮炬ィ鍐ㄧ睄閻犺櫣鍎ら悵銈夋煕閹烘鏁遍柡灞斤攻鐎电厧顫濋浣糕偓銈嗩殽閻愬瓨鏋勯悹鎰枛瀵敻鍩€椤掑嫬妫橀柣妤€鐗冮崑鎾存媴缁嬫寧娅冮梺鍛婄懄閸╁﹦妲愬┑瀣劶闁割煈鍠栫敮鎶芥偣閸ヮ剚鏁遍柣顏冨嵆楠炴帡骞掑Δ浣囨洟鏌涘鍐殭閻犳劏鍓濋幆?
- `frontend/src/types/cloud.ts`
  - `TankTroublePreviewPlayerSnapshot` 闂佸搫鍊瑰姗€路?`shots`
  - `TankTroublePreviewPushRequest` 闂佸搫鍊瑰姗€路?`snapshot_seq`
- `backend/models.py`
  - preview push 濠碘槅鍨埀顒€纾埀顒傚厴瀹曘儳浠︾紒銏犲Ρ闂佽　鍋撴い鏍ㄧ☉閻?`shots` 闂?`snapshot_seq`
- `backend/tank_trouble_preview_runtime.py`
  - preview runtime 闂佸搫鍊瑰姗€路?server-side 闁诲孩绋掗崝鏇㈡嚇婵犲啫顕辨慨妯虹－濡牓鏌ｅΟ鍨厫闁逞屽厸缁躲倗妲愬┑瀣闁告侗鍠栭?`bullets / last_snapshot_seq / last_reported_shots / last_reported_at_ms / last_simulated_ms / wall_ripples / bullet_fades`
  - 闂佸憡鑹惧ù鐑筋敂椤掑嫭鍋濋柡澶嬪闊剟鏌″鍫綈鐎?`shots` 婵犫拃鍛槐闁革絾妞介幃浠嬫偄缁嬭法浜?preview 闁诲孩绋掗崝鏇㈡嚇婵犲洦鏅悘鐐跺亹閻熸繈鏌涢幇顒傂＄紒鍫曨棑閹秆囧冀瑜嶉·鍛磼閺冩垵鐏熺紒妤€鍊圭€?whole scene
  - `get_state()` 婵炴垶鎸搁鍛般亹閸岀偛绀堢€广儱瀚粣妤呮煕韫囨挾澧涘┑?preview 婵炴潙鍚嬫穱娲儊閽樺）鐔煎焺閸愩劎褰查梺?`now`闂佹寧绋戦惌渚€顢欓埀?browser 缂備焦妫忛崹鍐诧耿閸涙潙绀嗛柟娈垮枟閻ｉ亶鎮楀☉娆忓闁兼潙锕瀵稿鐎ｎ剛顔曢柣?
  - server-side preview 婵炴潙鍚嬫穱娲吹濠婂喚鍟呴柛妤冨剱濡查亶鏌ｉ悙鍙夛紨缂佽鲸澹嗛埀顒佺⊕閸旀洟鎳樻繝鍕煋閻犲洦褰冭闂侀潧妫旂粈浣割嚕閽樺鍤曟鐐茬氨閸嬫挻鎷呴崷顓夈儱霉濠у本澹嬮崑鎾寸瑹閳ь剙顭囨导鏉戠骇閻犳亽鍔夐埀顒伾戠粙澶愵敇閻愭潙鈧敻姊洪幓鎺斝ら柡浣规崌閺佸秶浠﹂梻瀵搁瀺闂佸憡鐟ラ敃锔炬暜閾忓厜鍋?flash 闂佸憡鐟ョ粔褰掋€?  - `_build_state()` 闂佺粯绮嶅妯猴耿椤忓懎顕辨慨姗嗗墰濞?`bullets / wallRipples / bulletFades / targets` 闂佺绻堥崝鎴﹀磿鐎靛摜纾奸柛鏇ㄥ櫘濡懘寮堕埡鍌涚叆婵炲弶鐗滅槐?viewer
- `backend/tank_trouble_preview_page.py`
  - `drawTank()` 闂?`rotate()` 闂佽　鍋撻悷娆忓閻?`tank.angle + Math.PI / 2`
  - 闁哄鍎愰崰娑㈩敋濡や緤绱ｉ柟瀵稿Т閼哄啿霉?`60ms` 闁荤姴顑呴崯顐﹀春?`45ms`
  - tank / bullet smoothing 缂備緡鍨崇划顖炲汲閻斿憡濮滈悹鍥紦缁ㄦ娊鏌熺紒妯哄闁?  - browser 闁诲孩绋掗崝鏇㈡嚇婵犲嫮纾兼俊顖氭惈閻撴垿鏌￠崒娑欑凡妞ゃ倕鍟撮幆宀勵敇閿涘嫮宕虹紓?trail闂佹寧绋戦惌渚€顢欓埀顒勫级閻愵亜濮€闁硅埖顨婂瀵糕偓娑櫳戦～鏍煛?

閻熸粎澧楅幐鍛婃櫠?preview 闂備胶鍋撳畷姗€鎯屾ィ鍐╂櫖?
- 闂佸憡鎸哥粔鍫曨敂?latency 濠碘槅鍨埀顒€纾涵鈧梺鍛婄懐娴滄粓骞?backend 闂佽浜介崝鎴﹀焵椤戣儻鍏岄悽顖濇閳ь剛顢婂▔娑橆焽閸洖绀傞悗锝庝簼瑜般儵鏌ｉ幘妤€绉剁粣姊巗ession_id / room / player_id / country_code / snapshot_seq / tank / updated_at_ms`
- backend preview runtime 闂侀潻璐熼崝宥咃耿閸ヮ剙绀夐柨娑樺娴煎倻绱撴担鍝ユ憼濠?preview-only scene
- browser preview 缂傚倷缍€閸涱垱鏆版繛杈剧稻缁牏鎷归悢鐓庣煑妞ゅ繐娴傞崵?viewer闂佹寧绋戦張顒€锕㈡导鏉戞嵍闁瑰嘲鐬奸弸鍌炴偣?state 闂佸憡鑹惧锕傚吹濠婂喚鍟呴弶鍫涘姀椤╊偊鏌?canvas

闁哄鐗嗗﹢閬嶅疾椤愶附鏅?
- 闂佸憡鐟禍婊勬叏閳哄懎閿ら柨鏇楀亾闁告濮撮妴鎺楀川婵犲倻浜為梺?browser preview 闁哄鏅滈悷锕€顭囬姣湱鈧綆鍘惧Σ?闁荤喐鐟ラ崐鎼佹儌閸岀偞鐓ｉ柟瑙勫姉閻?
- 婵炴垶鎸哥粔鍫曪綖椤愩倖鍠嗛柛鈩冧緱閺嗐儵鏌熼幁鎺戝濠殿垰鎼湁濞达絿顣介崑鎾存媴鐟欏嫮鐨诲┑顔硷攻婵粙宕抽敃鍌氱鐟滃秹宕哄Δ鍛ュù锝夘棑闂呮绱?control signaling 缂備焦绋戦ˇ浼搭敆濠婂喚鍤曢煫鍥ㄧ⊕閹崇娀鎮?

濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `frontend` 濞戞挸顑嗘晶鐣屾偘?`npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?

## 闂傚啳鍩栭?29闁挎稒顑搃tHub 闁煎浜濆ú鍧楀棘閺夊灝寮抽柛?+ 闁煎浜滄慨鈺呭矗閹存繄顏寸€规悶鍎扮紞鏂棵?
濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?
- 閻犱讲鏅滈、鎴︽閵忊懇鏌ら幖鏉戠箰濠€顏勎涢埀顒€霉鐎ｎ亜鐓?GitHub 闁哄牃鍋撻柡鍌涘婢ф顨囧Ο鍦壘闁哄牜鍓欏﹢鎾偋閸喐鎷遍柡鍐啇缁辨繈鎯勭€涙ê澶嶉柛锔哄妿閳诲吋鎯旇箛鎾虫暥闁绘劗鎳撻崵顕€寮寸€涙ɑ鐓€
- 閻犱讲鏅涢幃妤冪磼?Windows 闁告瑦鍨电粩椋庝焊娴犲娅ら悹?GitHub Actions闁挎稑鐭侀埀顒€濂旂粭澶愬及椤栨粍鍩涚紓渚囧幒缁堕鎸ч弽銊︽嫳闁革妇澧楁晶婊冾啅閵夛箑鈪甸柡鍌涘婢?`exe`
- 濞ｅ洦绻冪€垫梹娼诲▎鎰拫闂佺偓宕橀惌楣冨矗椤忓啰绋婇柣顫妺缁剙顩煎畝鍕〃濠㈢懓鍟块惇浼存晬鐏炶偐鐟濈痪鐗堝楠炲洭寮垫径澶岄殬缂佹棏鍨甸～瀣紣閹存瑢鍋撴担鐟颁粯闁告帗婀规穱濠囧矗瀹勭増瀚叉繛鎾虫啞閸ㄦ瑩鏌呴弰蹇曞竼闂佺偓宕橀惌?

濞戞挻妲掗々锔剧磼閹惧浜柨?
- 闁告挸绉堕顒勫棘閺夋鏉?`frontend/src/hooks/useAppUpdater.ts`
  - 闁?Tauri 闁绘粠鍨伴。銊︾▔鐎ｎ亜袟闁诡兛鐒︾敮鎾礂?`@tauri-apps/api/updater`
  - 閹煎瓨姊婚弫銈夊触椤栨艾袟闁哄啳鍩栭ˉ鍛村蓟?GitHub 闁哄牃鍋撻柡?release
  - 缂備礁鐡ㄦ慨?`available / installing / currentVersion / latestVersion / error / message`
- 闁告挸绉堕顒勫棘閺夋鏉?`frontend/src/components/UpdateAction.tsx`
  - 闁革箑妫楅懜浼村即鐎涙ɑ鐓€闁圭顦甸幐?
  - 闁谎嗩嚙缂嶅秵銇勯棃娑欏濞戞挾绮敮鍫曞礆鐠哄搫閰遍梺顔藉灊缁变即寮伴崜褋浠涢柛锔哄妺鐎靛本锛愬Ο鍝勭€奸柟骞垮灪鐎垫粓鏌﹂闂寸閺?  - 闁告瑯浜濆﹢渚€宕ｉ幋鐘茬疀闁哄倹澹嗘晶妤呭箣閺嶎煈鍔€闁革负鍔岄悾銊ф啑閸涱喗顦ч柟闈涚У濡绮?- `frontend/src/App.tsx`
  - 闁圭鍊藉ù?updater hook
  - 闁?updater 闁绘鍩栭埀顑跨閹锋壆鈧懓顦抽ˉ濠囧礉閵娿倗绋婄紓浣哄枍缁旀挳鏌呰箛搴ｇ倞缂?`LoginPage` 闁?`DashboardPage`
- `frontend/src/pages/LoginPage.tsx`
  - 闁谎嗩嚙缂嶅秵銇勯棃娑樼濞戞挸锕ㄩ～妤呭箳閵夈儱寮抽柡鍥х摠閺屽﹪骞愭径鎰唉
- `frontend/src/components/Topbar.tsx`
  - 濞戞挾绮敮鍫曞礆鐠哄搫閰卞銈呯埣閸庢挳骞欏鍕▕闁告牜鍎ょ敮鎾礂閵夛附绾柡鍌滃鐎垫粓鏌?- `frontend/src/styles/globals.css`
  - 闁哄倹婢橀·鍐即鐎涙ɑ鐓€闁圭顦甸幐鎶藉冀瀹勬壆纭€闁靛棔娴囬崜锕傚礃閸欏绲圭紒鈧崫鍕閻庣懓顦抽ˉ濠囧籍鐎ｎ厽绁柣妯垮煐閳?- `frontend/src/styles/theme.css`
  - 閻炴稏鍎电紞鍫澢庢潏顐㈩棌婵☆垪鈧磭纭€濞戞挸顑嗗ú鍧楀棘閻楀牆鐦婚梺绛嬪枟閻楀崬顕?- `src-tauri/tauri.conf.json`
  - 鐎殿喒鍋撻柛?Tauri updater
  - 闁告劖鐟ラ崣?GitHub `latest.json` endpoint
  - 闁告劖鐟ラ崣?updater 闁稿浚鍓熼幐?
- `src-tauri/Cargo.toml`
  - 缂?`tauri` 濠⒀呭仜婵?`updater` feature
- 闁哄倹婢橀·?`scripts/update_versions.py`
  - 缂備胶鍠嶇粩鎾触鐏炵虎鍔?`package.json / frontend/package.json / frontend/package-lock.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json`
- 闁哄倹婢橀·?`.github/workflows/release-windows.yml`
  - `push main` 闁瑰瓨鐗楁晶婊堝礉閵娿剱鏇㈠矗閹存繃鍊甸柤濂変簻婵晠宕?Windows release
  - 闁煎浜滄慨鈺冣偓鐟邦槼椤ュ﹪宕滃鍥朵紓濞撴碍绻嗙粋鍡涘Υ娴ｅ憡鍊电紒鏃戝灟缁堕鎸ч弽銉㈠亾娑撶Installer
  - 闁搞儳濮崇拹?`beforeBuildCommand` 濞村吋淇虹换宥囨偘?`scripts/make_icon.py`闁挎稑鏈晶宥嗙閵夛妇鈧垰顕欓搹鐟扮畾濠⒀冨暕缁″啴妫侀埀顒傛啺?`Pillow`
  - 闁煎浜滄慨鈺冩媼閿涘嫮鏆柣妤€鐗婂﹢浼村矗?  - 闁煎浜滄慨鈺冩嫬閸愵亝鏆?`tauri-apps/tauri-action@action-v0.6.2` 闁告瑦鍨电粩?`nsis + updater`

闁稿繑濞婇弫顓㈠棘閸ワ附顐介柨?
- `frontend/src/hooks/useAppUpdater.ts`
- `frontend/src/components/UpdateAction.tsx`
- `frontend/src/App.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/components/Topbar.tsx`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `scripts/update_versions.py`
- `.github/workflows/release-windows.yml`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

闁稿繑濞婇弫顓㈠礃瀹曞洨鎽滈柨?
- 閺夆晜鐟﹂鐓庘柦閳╁啯绠掗柤濂変簻缁讳線骞嶇€ｎ偅鍋傞柍銉︾矎椤旀牠姊?GitHub API + 濞戞挸顑堝ù?exe + 闁告凹鍨版慨鈺冣偓鐟邦槼椤ュ﹪宕抽妸鈶╁亾濠靛牊鐣辩紒澶夌劍濠€渚€寮寸€涙ɑ鐓€闁革綆鐓夌槐婵嬫嚀鐏炵偓笑濞村吋锚閸樻盯骞?Tauri 閻庤蓱閺?updater
- 闁哄洤鐡ㄩ弻濠偽涢埀顒€霉鐎ｎ喒鍋撻弰蹇曞竼闁告瑯浜滃﹢?Tauri 閺夆晜鍔橀、鎴﹀籍鐠虹儤鍎欓柣銏╃厜缁卞崬霉韫囨凹娼旈柛锝冨妼缁辨垿宕ｉ幋鐏戒礁顕ｈ箛搴ｇ憮濞戞挸绉崇槐浼村箮閵夆晜鏅╅柨娑樺缁″啯绋夊鍕獥闁哄嫬澧介妵姘跺即鐎涙ɑ鐓€闁圭顦甸幐?
- 闁哄洤鐡ㄩ弻濠囧箰婢舵劖灏﹂柛瀣閸ㄦ岸鎮鍌滃綄缂備礁瀚▎銏ゆ晬瀹€鍕級闁稿繐绉跺▍銉ㄣ亹閺囶潿鈧宕仦鐓庣槣闁硅矇鍐ㄧ厬闁告瑦婢橀幃鍥礃濞嗗海顏卞ù鐘垫櫕婵悂骞€娴ｇ鐎婚柡鈧?- 闁绘鐗婂﹢浼村矗瀹勭増鍊辨慨婵勫劜婵炲﹪骞嬮幇顒€绀嬮柣娆樺墲閸撳ジ寮甸濠勭缂備焦鐟﹀﹢浼村捶閻楀牆鈪甸柛鏍ф噹閹?GitHub Actions 闁稿繗浜弫?
- GitHub 鐎规悶鍎扮紞鏂棵规担绋垮弗闁稿纰嶉崹姘跺灳濠婂棗娈伴柛?Windows release闁炽儲绻愮槐婵嬫嚀鐏炶偐鐟濋柡鍕靛灣閹撮绱掗鈽嗗敤闁哄牜鍓欏﹢鏉戭啅閵夈倗绋婇柛鏍劋婢规瑩骞忛崨顕呭妧鐎殿喖绻愯ぐ鍌滄暜閸愵厺鎹嶉悹?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `frontend` 濞戞挸顑嗘晶鐣屾偘?`npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?
- 闁哄牜鍓欏﹢?`Tauri` 闁瑰灚鎸哥€垫ê顔忛懠顒傜梾濞存籂鍐ㄦ瘔闁?  - `src-tauri/target/release/bundle/nsis/Cloud Service Console_0.3.1_x64-setup.exe`
  - `src-tauri/target/release/bundle/nsis/Cloud Service Console_0.3.1_x64-setup.nsis.zip`

闂侇剚顨堥弳鈧梻鍌ゅ櫍椤ｄ粙鏁?
- 闁哄牜鍓欏﹢瀛樻交濞嗘劦鍋ф繛灞稿墲濠€渚€鎯勭€涙ê澶嶉柣顏勵儏閸?`latest.json` 闁?`.sig` 闁解偓閻ｅ本纾搁柨娑樻湰婢у秵绂掗妷鈶╁亾濞ｆ槼tHub Release 濞?updater 婵炴挸鎳庡畷鐔煎及椤栨碍鍎婇悗鐟版湰閺嗭綁鎮介悢绋跨亣闁炽儲绻€缁盯妫侀埀顒傛啺娓氣偓椤╄鈻?Actions 闁活亞鍠愬┃鈧弶鈺傚姌椤㈡垹娑甸娆惧悋
- 濞戞梻鍠庡銊╁及椤栨繍鍤涢柨娑樺閸烆剟鎯嶆担閿嬫珷闁告粌鑻导鎰媴濠婂嫮銈﹀〒姘€鍥у幋鐎规瓕灏欑划锟犲箳閵夈倗鐟愬ù婊冩４缁辨繃鎷呴崱姘辩鐎瑰壊鍠曠粩鏉戔枎?GitHub 濞戞挸锕﹀▓鎴︽儑閻旈鏉?release 閺夆晜鍔橀、鎴﹀级閵夈儰绮甸柡鍫氬亾缂備礁鐗撳Λ鎾偝椤栫偟宕ｉ悹?
## 闂傚啳鍩栭?30闁挎稒鐡朼nk Trouble 鐎点倖鍎肩换婊勶紣閸曨噮娼旈柛鎺戞搐閸?authoritative scene
濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?- 閻熸瑱绲介崰鍛嚈閹壆绠挎繛鏉戭儓閻︻垰螣閳ュ磭纭€闂佹彃鏈粊鑽ゆ喆閸繃鐝ゅΛ鏉垮椤秹宕ｉ鍥╊€€鐎电増銇炵粭鍌炲锤閿曗偓閸樼娀鏁嶇仦鑲╃ɑ閻庢稒鍔曢懘濠囧椽瀹€鍕珐閻庢稒鍔掔粭澶愬触鐏炵虎鍔勯柣銊ュ濡埖锛?- 閻熸瑱绲介崰鍛紣閸曨噮娼旈悗娑欏姇閼村﹪鎯囩€ｎ厽宕抽柡澶堝劚娴滄悂骞堥～顑藉亾娴ｉ晲鐒婇梺鑺ョ箘濞堟垿姊婚鈧。?
- 濞ｅ洦绻冪€垫梹绌遍鑺ユ毉闁告瑯浜ｉ幆銈夊捶?Tank Trouble 闁?preview/latency 闂佺偓宕橀惌楣冩晬鐏炶偐鐟濈痪鐗堝椤锛愰幋婵囧闁硅矇鍐ㄧ厬濞ｅ洠鈧啿濞囬梺鐐礃閻?

濞戞挻妲掗々锔锯偓鍦仧楠炲洭鏁?- `frontend/src/components/TankTroublePanel.tsx`
  - 闁?preview push 濞?`tank + shots` 闁告娲ㄦ鍥ㄧ▔?`authoritative_scene + theme + tank + bullets + targets`
  - 闁哄倹婢橀·?`buildPreviewSnapshot()`闁挎稑鐬煎ú鍧楀箳閵夘煈鍤㈤柛娆愮墬濠€浼村捶閺夎法绌块柟鍨叄閸ｇ兘鎯冮崟顓熷焸閻庡湱鍋涢悺娆忣嚕閻熺増瀚查柣顏嗗枎閻ゅ嫰妫冪捄铏规憤闁绘鍩栭埀?- `frontend/src/types/cloud.ts`
  - `TankTroublePreviewBulletState` 闁哄倹婢橀·?`vx / vy`
  - `TankTroublePreviewPlayerSnapshot` 闁哄倹婢橀·?`score / hits`
  - `TankTroublePreviewPushRequest` 闁哄倹婢橀·?`authoritative_scene / theme / bullets / targets`
- `backend/models.py`
  - 濞戞挸楠告晶鐘电博椤栨碍鍊辨慨婵勫劚閻⊙冣枔绾板绀夊ǎ鍥ㄧ箚閻?FastAPI / Pydantic request model 闁告瑯鍨冲ú鍧楀箳閵夛箑澶嶉柡鈧懜鍨厐闁?preview payload
- `backend/tank_trouble_preview_runtime.py`
  - 闁哄倹婢橀·?authoritative scene 闁告帒妫欓弫?
  - authoritative 婵☆垪鈧磭纭€濞戞挸顑勭粭澶愬礃瀹ュ棛澹岄柟?`shots` 闁哄牜鍓欏﹢鎾偨閻旂鐏囬悗娑欏姇閼村﹪鏁嶇仦鑲╃槏濞戞挸绉撮崯鈧柡鍫墮濠€鎾箳閵婏妇宸?target respawn
  - 闁烩晛鐡ㄧ敮瀵哥磽閹惧磭鎽犻柛鎾崇Ф椤忣剚绋夋繝浣虹倞闁?bullets / targets / score / hits / theme
  - 闁哄唲鍥ｅ亾閺勫繒甯嗗ǎ鍥ㄧ箘閺嗏偓濞达絾绮岄崥瀣偓鍦嚀閸樿鎯?- `backend/tank_trouble_preview_page.py`
  - viewer 閻犲洩顕цぐ?`vx / vy`
  - 闁告艾濂旂粩瀛樼閽樺褰ラ柣鎾楀啰鎽犳繛鑼帛濠€锟犳⒒鐎涙ê鐦婚梺顐ゅ枎鐎规娊宕烽妸锔芥嫳闁革附濯界换娑氱磼椤撶喎鑵归弶鈺傜☉閻℃瑥顕?  - 闁告瑯浜濆﹢渚€宕烽妸锔界厐闊浂鍋嗛崣搴ㄥ礆閹峰本褰ч柡鍐煐婢х娀宕戝鍏呮唉闂佹彃绻嬬紞鍛磾椤旂晫澧℃慨婵撶秶缁辨繈鏌嗛崹顔煎赋閻熸瑥鍊归崝鍛▔婵為敮鍋撳鍕籍闁告锕ユ刊鍧楀灳?
闁稿繑濞婇弫顓犵磼閹惧浜柨?- 婵炴潙绻楅～宥夊闯閵娾晩鏆曢悷娆忕墢濞?tank / bullets / targets 闁绘粍婢樺﹢顏堝级閵夈劌娈伴柛姘缁斿瓨绂?authoritative 闁革妇鍎ゅ▍娆忊攦?- 闂傚牐娉涢悺娆撳川閹存帟鍘柕鍡曠窔閸ｆ悂鎮介悢绮瑰亾娴ｅ摜鎽嶇€殿噣鈧稓绉寸紓鍐惧枛閹蜂即鏌呴悢宄邦唺濞戞挸绉撮崯鈧柣銏犲船閹绮╅婊冾嚥婵?- 濡澘瀚～宥嗐亜闂堟侗鍤犻悗娑欏姇閼村﹪鎯冮崟顕呮綆闁规壆鍠愰惁顔界▕鐎ｎ亜顤呴柡鍥х摠鐢瓨娼婚幋鐑嗘斀闂傚牄鍨婚顒勫嫉椤掆偓濠€瀛樻交閹邦垼鏀介柡浣哥墛閻?

濡ょ姴鐭侀惁澶岀磼閹惧浜柨?- `cmd /c npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?
- 濡増绻傞ˇ鑽も偓?`TankTroublePreviewRuntime` 闁稿鐭花?authoritative push 闁煎浜濈粊鎾晬瀹€鈧垾妯兼媼閵堝牏绠查柛?state 濞戞搩鍘奸崙锟犲礌閸涱厽鍎撻柣顏嗗枎閻?`theme / score / bullets / targets / vx / vy`

## 闂傚啳鍩栭?31闁挎稒鐭幈銊﹀緞瀹ュ洠鏌ら幖鏉戠箰閸炴挳寮寸€涙ɑ鐓€闁?backend 闁哄倸娲ｅ▎銏ゅ础閻樺灚鏆?
濞戞挻妲掗々锕傛儎椤旂晫鍨奸柨?- 閻熸瑱绲介崰鍛矙鐎ｎ亞纰嶉柛鎰噺濞插潡寮悧鍫燁槯 NSIS 閻庣懓顦抽ˉ濠囧闯閵婎煈娲柣?`cloud-console-backend.exe` 濠㈡儼绮剧憴锕傛儍閸曨垱锛栧Λ?- 閻犱讲鏅滃ú鍧楀棘閺夎法鏆旈悷浣告噹婢х娀宕楅崼婊冪槣闁告柣鍔戦崳鎾绩?sidecar backend 闁汇劌瀚弸鍐╃鐠哄搫缍栭柡?
濞戞挻妲掗々锔锯偓鍦仧楠炲洭鏁?- `src-tauri/src/main.rs`
  - `BackendRuntime` 闁哄倹婢橀·?`port`
  - 闁哄倹婢橀·?`terminate_backend_child()` 闁?`wait_for_backend_stop()`
  - 闁哄倹婢橀·?`prepare_update_install` command
  - 闁哄洤鐡ㄩ弻濠囧礈瀹ュ懎甯?kill backend sidecar闁挎稑鑻崯鈧紒娑橆槸缁剁喖鎯勯幋婵囧剶缂佹棏鍨拌ぐ娑㈠礂閹惰姤锛旈柛婊冩湰閺嬪啯绂掗崼鏇熸暁闂佹彃锕ラ弬?
- `frontend/src/hooks/useAppUpdater.ts`
  - 闂佹彃绉撮崯?updater hook闁挎稑鏈粩濠氭偠閸℃鏂ч柡鍫濐槷鐠愶繝鎯嶆担鍝ユ憻缂佹缂氱憰?
  - 闁哄倹婢橀·?`preparing` 闁绘鍩栭埀?  - 閻犲鍟伴弫?`prepare_update_install` 闁告艾楠搁崯鈧柟绗涘棭鏀?`installUpdate()`

濡ょ姴鐭侀惁澶岀磼閹惧浜柨?- `cmd /c npm run build` 闂侇偅淇虹换?
- `cargo check --manifest-path src-tauri/Cargo.toml` 闂侇偅淇虹换?

闁稿繒鍘ч鎰嫚鐎涙ɑ顫栭柨?- 濞ｅ浂鍠栭ˇ鏌ュ触鎼达絾鐣遍柣妤€鐗婂﹢浼村矗椤栨稒鈻旈柦浣诡殜濡鹃攱鎷呮惔鈩冨€电紓渚囧幘閳诲吋鎯旇箛鎾虫暥闁哄洤鐡ㄩ弻濠冨緞鏉堫偉袝闁汇劌瀚々褔鎮?- 濞达絽妫楅崙锛勭磼韫囨挾鏆旈悷浣告噽濞堟垿寮婢ф寮甸鈧々褔寮稿鍕⒕闁哄牆顦埀顒佺矋濞插潡寮弶鍨枀闁稿繐鐗嗘禒?backend闁炽儲绻勫▓鎴︽焻閺勫繒甯嗛柨娑樼灱椤戝洦绋夐埀顒€鈻庨垾鍐茬３缂佺嫏鍐ㄧ厒閺夆晜鐟ら柌婊勭┍椤旂⒈妲婚柣妤€鐗婂鍌炴晬鐏炶偐鐭濋柛娆樺灥閸忔﹢妫侀埀顒傛啺娴ｇ懓顤侀柛鏂诲妼閸櫻囨⒒椤撶姭鏌ら幖鏉戠箲閸ㄣ劎绱掗幘瀛樺皢 backend 閺夆晜绋撻埢濂稿触鎼粹€虫櫃闁绘劗鎳撻悾銊ф啑閸涱厽鐝ら柣銊ュ閳ь剚绮撻崳鍝ユ嫚閺囨せ鍋?
## 闂傚啳鍩栭?17闁挎稒鐡朼nk Trouble 濞寸姴瀛╁﹢浼村捶閹峰矈鍞茬紓浣稿暙閸欏棝宕ｉ敐鍛€奸柟璇℃線鐠愮喖宕烽妸褍娈犻柟鏉戞健濡?

闁哄牜鍓熷Ο浣糕枔閻㈠灚绐楅柡宥呮祫缁?

- 闁?`鐎殿喒鍋撳┑顔碱儐閻栧爼骞嬪?濞寸姴楠哥敮顐﹀级閵壯勭暠闁哄牜鍓欏﹢瀵告媼椤撶姷鐭婇柛蹇嬪劚瑜版盯寮ㄧ憴鍕亣闁烩晛鐡ㄧ敮鎾礉閻樻彃寮冲ù婊勫灩椤忣剟宕烽妸褍娈犻悗鐢垫嚀閻剟濡?- 濞ｅ洦绻勯弳鈧?`婵炴潙顑堥惁顖氼嚈閹壆绠縛 闁稿繈鍎辫ぐ娑㈡晬鐏炶偐绋诲☉鎾崇Х椤斺偓閻庣懓鍟村Ο鍡樼箙閻愬墎绠规繛鍡忊偓铏含缂佺偓瀵ч崺褔姊荤紙鐘茬槣闂佺偓宕橀惌楣冨绩瑜版巻鍋撻悩顔瑰亾?- 閻犱讲鏅犻·渚€鎳濋幓鎺戠獥闁活潿鍔婇埀顑跨劍閸┭囨⒒鐎涙ê濮柛娑櫱滈埀顑跨濠€顏嗙棯閼愁垼鍚€闁告帒妫庨埀顑胯兌椤洭宕烽悜妯碱伕闁告帒妫庨埀顑跨劍椤掑瓨绂嶉敓鐘叉闁汇垻鍠嗛埀顑跨劍瀹曟煡宕堕悙顒€顫岀紒浣靛姀缁绘牗绂嶅☉婊庢綈闁告帗鐟у﹢鈥愁潰閿濆牊鍎伴柛鎺楊暒缁垳绮╅娑欑秬濠电偘鑳舵慨鎼佸箑娴ｉ鐟愰柕?
闁哄牜鍓熷Ο浣糕枔闂堟稑顤呯紒鏃戝灡閺佸ジ宕濋…鎺旂獥

- `frontend/src/components/TankTroublePanel.tsx`
  - `GameSessionMode` 濞?`training | latency` 闁衡偓鐟欏嫬鐏囧ù?`online | latency`闁?  - 濠㈠爢鍐ㄦ硾闂傚啳鍩栭宀勫棘閺夋鏉?`room/status` 閺夌儐鍠涢妤呮晬鐏炶棄娑ч柡灞诲劤濠€鍛村箣閸ф锛熼柣妯垮煐閳ь兛绶ょ槐婵囩▔瀹ュ棗绲归柛鎾崇Т婵偤宕楅妷锕€鐓ｉ梻鍌涚暘閳?  - `鐎殿喒鍋撳┑顔碱儐閻栧爼骞嬪?闁绘粍婢樺﹢顏呭濮橆剙甯ラ悹瀣暟閺併倖绋夐埀顒€鈻?`match/sync`闁挎稑鏈€ｄ線宕氭导鎼禃閻㈩垎鍐╄含缂佹崘娉曟慨鎼佸箑娴ｅ憡鍊甸柛鎰Х缁绘﹢宕楅妷銉殸閻忕偐鍋撻柕?  - 闁哄倹婢橀·?`createOnlineTankTroubleEngine(...)`闁挎稑濂旂粭鎾绘⒒閵婏箒顩柡灞炬尰濠€鍥礉閳ヨ櫕鐝ら柡澶婂暙閳诲娼婚弬鎸庣闁汇劌瀚敮铏光偓纭呯堪閳ь兛绀侀悺娆忣嚕楠炲簱鍋撴担鐑樼獥闁哄秴娲ら幏浼村礆閸℃ɑ娈堕柕?  - 闁革负鍔庨崵搴∥熼垾宕囩闁哄倹婢橀·鍐嫉椤掆偓濠€?WebSocket 闂傗偓閼愁垳绠鹃柟鎭掑劵缁辨繄鈧絻顫夊﹢浼村捶?backend 闁归晲鑳堕悽濠氬矗閹达腹鍋撴笟鈧弫顓㈡儎濡法缈婚柛蹇嬪劚閹?`fire_seq`闁?  - 濡増绮忔竟濠囨焻婢跺顏ュ褏鍋涙慨鐐寸閸℃洝鈷堢紒澶婄С濮橈附绂嶉幒鐐电獥
    - 鐎瑰憡褰冨畷浼存偨閵娾晩鏉归柤纭呭蔼缁绘﹢宕楅妷銉﹀殤闁告艾鎽滄导鍛▔瀹ュ懎璁查梺顐㈩槹閳ь兛闄嶉埀?    - 闁绘劗鎳撻崵顔碱啅閹绘帒绐楅柣顫姂椤や線鎳濋懠缂庢洟宕ｉ幋鐐差潔闁告柣鍔屽鑺ワ純閸稈鍋?  - 鐟?4 濞戞搩浜·渚€鎳濋弻銉ュ幋閻炴凹鍋勫畷浼存偨閵婏附顦ч柨娑樼暛鐎殿喒鍋撳┑顔碱儐閻栧爼骞嬪?闁圭顦甸幐铏濮橀硸娲ｉ柣顫妼閼荤喖寮伴崜褋浠?`婵炴挸鎲￠崹娆忣啅閸欏濮琡闁?  - 闁革负鍔庨崵搴∥熼垾宕囩濞戞挸顑嗙敮鎾舵偘鐏炵虎娓峰☉鎾崇Т閸熲偓缂備綀鍛暰婵炲矁娉曢弫銈夊嫉椤掆偓濠€瀵哥磽閹惧磭鎽犻柛鎺戞閺嗙喖鏁嶅畝鍐ｅ亾鐏炵偓笑闁烩晛鐡ㄧ敮瀛樻媴鐠恒劍鏆忛柡鍫濈Т婵喖宕抽妸銊х闁搞儳鍋熷▓?`active_players`闁?  - 闁瑰箍鍨瑰ù姗€骞愭径鎰唉濞戞挸顑嗛弻濠冩櫠閻愭潙顣查柡鍫濐槸閸戯繝骞庨弴鐘亶闁绘壕鏅涢宥夋儍閸曨垼鏉归柤鐟板级閻栵絿鎷嬬敮顔剧妤犵偠娉涘﹢顏堝礂閵娿儲鍠呴柟鑸垫礈閵堛劑宕ユ惔銈囩闁稿繈鍎插ú鍨嚕閾忚鐣遍柛濠冨笩椤撴悂寮幆閭︽綊閻熸瑥顦伴埀顑块檷閳?- `frontend/src/api/cloudApi.ts`
  - 闁哄倹婢橀·?`getTankTroubleRoomStatus(...)`
  - 闁哄倹婢橀·?`syncTankTroubleMatch(...)`
  - 闁哄倹婢橀·?`leaveTankTroubleMatch(...)`
  - 闁哄倹婢橀·?`openTankTroubleMatchSocket()`
- `frontend/src/types/cloud.ts`
  - 闁哄倹婢橀·鍐捶閵娧冩疇闁规潙娼″Λ鍧楀Υ娴ｅ憡韬紒鎹愭硶鐢櫣鈧缈伴埀顑跨濠€顏嗙棯閸喚鎽嶇€殿喖绠嶉埀顑跨濠€顏嗙棯鐠恒劍绐楅柡宥呮储閳ь兛绀佸﹢顏嗙棯閹稿骸顫岀紒浣靛妿閻℃垹鐚剧拠鑼偓椋庘偓瑙勭煯缁犵喖濡?- `frontend/src/styles/globals.css`
  - 闁哄倹婢橀·鍐╋紣濠婂棗顥忛柛妤冨Х閺併倝骞€娴ｇ鍋撴笟鈧·渚€鎳濋崣澶婎潔闁告柣鍔婇埀顑跨劍婵洨绮婇妸褍浠梻鍐仯閳ь兛绀侀埀顒佸笩椤撴悂寮懜闈涚樆闂佺瓔鍠栧閬嶅礌閺嶎偄笑闁诡兛闄嶉埀?- `frontend/src/styles/theme.css`
  - 濞戞挾鍎ょ换渚€鎳濋崣澹炰礁顕ｈ箛姣稿顬囬幇顏嗙憪閺夆晝澧楅弻濠囧冀瀹勬壆纭€闁?
闁哄牜鍓熷Ο浣糕枔?backend 闁衡偓閻熸澘袟闁?
- `backend/models.py`
  - 闁哄倹婢橀·?`TankTroubleRoomStatusRequest`
  - 闁哄倹婢橀·?`TankTroubleMatchRequest / TankTroubleMatchState`
  - 闁哄倹婢橀·鍐捶閵娧冩疇闁绘壕鏅涢?/ 閻庢稒鍔曢懘?/ 闁烩晩鍠楅悥?/ 闁硅埖娲滈妶銊ノ熼垾宕団偓?
- `backend/main.py`
  - 闁哄倹婢橀·?`POST /api/games/tank-trouble/room/status`
  - 闁哄倹婢橀·?`POST /api/games/tank-trouble/match/sync`
  - 闁哄倹婢橀·?`POST /api/games/tank-trouble/match/leave`
  - 闁哄倹婢橀·?`WS /api/games/tank-trouble/match/ws`
- `backend/tank_trouble_cloud.py`
  - 闁哄倹婢橀·鍐捶閵娧冩疇闁规潙娼″Λ鍧楁偐閼哥鍋撴担鍦弨閻犲洢鍨鸿棢闁?  - 闁哄倹婢橀·鍐捶閵娧冩疇閻庣數鎳撻惇顒勫触鐏炵虎鍔勬俊妞煎劜鐢?
  - 闁哄倹婢橀·鍐捶閵娧冩疇閻庣數鎳撻惇顒傜矉鐠囧弶绨氭俊妞煎劜鐢?
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - 闁规潙娼″Λ鍧楁偐閼哥鍋撴担瑙勭€ù鐘哄煐閺屽﹥鏅堕悜鍥╃獥
    - `targets`
    - `bullets`
    - `next_bullet_id`
    - `snapshot_seq`
    - `last_tick_ms`
    - `player_revisions`
  - 闁哄倹婢橀·?`status` / `match_sync` / `match_leave` action
  - 闁革负鍔庨崵搴ㄥ箣閸ф锛熼柣婊勬緲濠€顏呭濮橆剚韬ù婊勫灩椤忣剟骞掗妸銊х闁?    - 闁圭鍋撻柡鍫濐槸濠€顏嗙棯鐠恒劌璐熼悗鐟板浜涢柛鏂诲妺缁楀苯顕ｉ埀顒勬倶?    - 閻庢稒鍔曢懘濠勨偓闈涚仢閹?/ 闁告瑥绉撮懘?/ 闁告稒鍨濋懙?
    - 闁烩晩鍠楅悥锝夊礆闁垮鐓€
    - 闁告帒妫欓弳?/ 闁告稒鍨濋懙?/ 婵繆顔婃?
    - 1 缂佸甯￠崳鎼佹偨?    - 缂佸倽顕у┃鈧柛姘凹缁绘岸鎮惧▎鎰紜闁绘劦鍠栭懘濠囨嚊椤忓棗濮ф繛鎴濈墕閵?
    - 闁瑰箍鍨瑰ù姗€骞庨弴鐘亶闁稿﹥甯熼鎼佸籍?
闁稿繑濞婇弫顓犳媼閹规劦鍚€闁告劕纾悺銉╂晬?
- 闁革负鍔庨崵搴∥熼垾宕囩濞戞挸绉撮崯鈧柟璺猴工椤︽寧绂嶉搹鍦尝闁哄绮堝锔剧磼濞嗗繐顤呯紒鏃戝灥閸ゆ粌顔忔潏鈺冩毈闁挎稑鐭侀埀顒€鏈Σ鍝ョ磼閻斿墎顏卞ù婧垮€楃划鐗堢閹寸媭浼傞柤瀛樼濠€浼村箳閵娿劎绠婚柡澶婂暙閳诲鎮╅懜纰樺亾娴ｇ鍋?- 闁告挸绉堕顒勫嫉椤掆偓濠€瀛樼瀹ュ嫮绠介柣锝嗙懄鐟曞棝寮婚幘鎶芥尙婵犲﹥鍨甸幏鎵沪閳ь剟鏌堥妸鈺婃殨婵炴潙顑戠槐婵囨交濞嗘劗澹夐柟闈涱儐閸斿懏绋夊鍕獥闂侇偀鍋撻柛鏍ㄧ墬閸ㄦ岸鍨惧鍛毐缂侇喖婀遍悺鎴﹀嫉瀹ュ懎顫ら柛锝冨妼濞叉牜鏁閸熲偓闁告柣鍔夐埀顒佺缚閳?- 缂佸倽顕у┃鈧柛姘濡偊鎮欓鑹板墾缂備綀鍛暰濡炲鍎戠槐婵囨媴閸℃稈鍋撳宕囩畺 `player_revisions` 闂侇剙鐏濋崢銈夊触?ID 闁绘壕鏅涢宥夋煂瀹ュ棙鐓€闁告梻濮撮崣鍡涘触鎼淬値娼堕柡鍐勫懎浠忕€殿喖婀遍幋椋庣磼椤撶姷鏌堥悹浣测偓鍐茬€婚柡浣藉焽閳?- 閺夆晜鐟﹂濂稿绩閻熸澘袟闁哄嫬娴烽垾妯荤▔瀹ュ浂娼鹃悷娆忔椤ｅ爼鏌ч幑鎰唴闁告粌鏈敮鍫曞礆閺堝吀绻嗛柛娆擃棑濞插啴宕ラ鍕嚑閻犱警鍨界槐婵囨媴濠婂懏鏆忛梻鍫線缁酣姊?Tank Trouble 婵炴挸鎲￠崹娆撴閵忊剝绶查柕?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `cmd /c npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?

## 闂傚啳鍩栭?18闁挎稒鐡朼nk Trouble 闁革负鍔庨崵搴ㄥ箣閸ф锛熼悷娆忓閸垳鎮伴妷銈囶伈

闁哄牜鍓熷Ο浣糕枔閻㈠灚绐楅柡宥呮祫缁?

- 闁革负鍔岄崙锛勭磼韫囨矮绮撻柡鍫濇惈鐎垫煡鎯?Tank Trouble 闁糕晞娅ｉ、鍛▔婵犲繒绀夐柟璺猴躬閳ь兘鍋撻柛鎴炴そ閸ｅ憡娼诲☉鏍ゅ亾娓氣偓椤や線鎳濋幓鎺戠獥闁活潿鍔婇埀顑跨劍瀵囧箣鐟併倐鍋撴担鐟板簥闁搞儳鍋撴慨鍥╃矈閵娿劎绠归柛鎴犲У濞碱垳鎲撮崟顐㈢仧闁告劕绉甸弫鍦瑜岀粩鎾偋閸稈鍋?- 濞ｅ洦绻嗛惁澶愬灳濠婂啯鍊?ID 缂佸倽顕у┃鈧柛姘叄閸ｆ悂寮幏宀€绠婚柛蹇嬪劗閳ь剚绻勫﹢鈥愁潰閿濆牄鈧啴鎮抽悧鍫濈亣濞戞挴鍋撳☉鎿冧簼閺屽﹥瀵煎宕囨▓闁挎稑鐭侀埀顒€濂旂粭澶愬及椤栨繍娼跺☉鎾筹梗缁旀潙鈻庨埄鍐殭闁伙絾鐟ч崑鏍ь嚕閸︻厽鍩涚紓渚囧幖婵傛牠宕鍐ｅ亾?- 鐎殿喖鎼€垫煡骞戦姀鐘崇闁硅埖娲滈妶銊╂儍閸曨偄璁查悷娆忔瀵姤锛冮崼顒傜閻犱讲鏅滄晶宥夊嫉婢跺苯璐熼悗纭呭煐濞茶法鈧顫夊Σ妤呮儑鐎ｎ偄娅愰柣婊勬緲濠€顏堝及椤栨繄娈遍柟鑸垫磻缁繝濡存担瑙勑﹂柛姘剧畱閸戯繝宕楅妸銉﹀枀闁硅埖娲滈妶銊╁Υ娴ｈ笑闁告熬绠戦崙鈩冩交濞戞ê寮?3 缂佸甯掗埀顒佸笩椤撴悂寮煬娴嬪亾?
闁哄牜鍓熷Ο浣糕枔闂堟稑顤呯紒鏃戝灡閺佸ジ宕濋…鎺旂獥

- `frontend/src/components/TankTroublePanel.tsx`
  - 濞ｅ洦绻冪€?`鐎殿喒鍋撳┑顔碱儐閻栧爼骞?-> 闁革负鍔庨崵搴ㄥ礉閻樻彃寮抽柡鍫濈Т婵喖宕抽埡?閺夆晜鐟﹀顖涚▔閺勫繒鐔呯€垫澘瀚ㄩ埀?  - 濠㈠爢鍐ㄦ硾闂傚啳鍩栭宀€绱掕閻㈠宕ｉ鍥巢 `room/status`闁挎稑濂旂粭澶愬箵閹邦剙顤呮繛澶堝妼閸炰粙鎮抽埡渚囧晙闁?  - 鐟滅増鎹囬·渚€鎳濋懠棰濇蕉闁告濮烽弫銈夊籍鐠佸湱绐?
    - 闁肩灏欓崑锝嗙┍濠靛洤鐦柛娑氬帶閹盯鎮橀婊冃﹂柟?    - 闁绘劗鎳撻崵顔炬喆閿曗偓瑜板倿骞庨弽褍袟闁圭粯鍔楅妵?
  - 鐟滅増鎸婚崺褔姊?4 濞戞搩浜·渚€鎳濋弻銉ュ幋鐎瑰憡褰冨畷鏉款煥閳╁啯顦ч柨?    - `鐎殿喒鍋撳┑顔碱儐閻栧爼骞嬪?缂佸倷鑳堕弫?
    - 闁圭顦甸幐鎶藉棘閸ヮ煈鏀抽柡鍕⒔閵?`婵炴挸鎲￠崹娆忣啅閸欏濮琡
  - 缂備焦鐟﹀畷鏌ュ炊閻愵剙鐦婚梺绛嬪枦钘熷☉鎾筹攻濞茶法绱掗崱娆愮暠闁绘鍩栭埀顑胯兌鐞氼偊宕ュ蹇曠獥
    - `active`
    - `armed`
    - `countdown`
    - `countdown-3 / countdown-2 / countdown-1`
- `frontend/src/styles/globals.css`
  - 闁哄倹婢橀·?`armed` 闁绘鍩栭埀顑跨劍婢瑰倿宕楁径濠冨闁硅埖娲滈妶銊╁捶閸℃瑥浠柛娑氬帶閹盯寮崼鐔轰函闁?  - 闁哄倹婢橀·?`countdown` 闁绘鍩栭埀顑跨婵晠骞€娴ｅ摜淇虹紒鎯х畭閳ь兛绀佸〒楣冩倷瑜版帗锛忛柣鎴滅閹蜂即骞愭径宀婃健闁告瑦锚閹烩晠鎯冮崟顐熷亾閹烘洦鍚€闁哄啯鍎兼俊顓熺附韫囧鍋?  - 缂備焦鐟︽慨鍥╃矈閵婏妇鍨奸悹?badge 濠⒀呭仜婵偞绂嶉崱妯荤函闁哄嫬瀛╁Ο澶愭儍閸曨剙浜鹃柛瀣矊瀵姤锛冮崼娑掑亾?- `frontend/src/styles/theme.css`
  - 濞戞挾鍎ょ换渚€鎳濋崣澹炰礁顕ｈ箛姣稿顬?`armed / countdown` 閻庣數鎳撶花鑼喆閸℃凹娼曢柡宥呭槻缁憋繝濡?
闁哄牜鍓熷Ο浣糕枔闂堟稒鍊电紒鏃戝灡閺佸ジ宕濋…鎺旂獥

- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - 闁革负鍔庨崵搴ㄥ矗閹存繄娈稿☉鎾筹躬濡捐櫣绱掗悢娲诲悁闁绘粍婢樺﹢顏堝绩闁稖绀嬮柟?`owner_id + owner_revision` 缂備胶鍠曢鎼佸Υ?  - 閺夆晜鐟﹂悧閬嶅触鐏炶偐顏卞☉?`player_id` 缂佸倽顕у┃鈧柛姘閸熲偓閺夆晜绋戦崣鍡涘籍鐠佸湱绐?
    - 濞戞挸锕ｇ粩瀛樻姜椤旂晫鏆欓柣锝嗙懅閸嬫牕顕ｉ柅娑氱憹濞村吋姘ㄩ幋椋庣磼椤撶偛绐楅柣顫姀缁绘牗绋夐埀顒佹姜椤旂偓鐣?`5 闁告瑦鍨崇粭鍌炴⒔閹?
    - 濞戞挸锕ｇ粩瀛樻姜椤旂晫鏆欓柣锝嗙懅閸嬫牕顕ｉ柅娑氱憹濞村吋淇洪～锕傛煥濞嗘帩鍤栭柛鎺嬪€曢悾楣冨箣閹般劉鍋撳鍕厐闁煎浜滅换渚€骞嶉幘鑼跺幀闁哄倹濯介崵婊冾啅閹典讲鍋撳┑鍫熺暠闁煎浜欏┑鈧?
  - 濞ｅ洦绻勯弳鈧柡鍐勫棭娼愰柛鎺撶懕缁?
    - 闁绘壕鏅涢宥囩矉鐠囧弶绨氶柛姘濡偊鎮欓鑹板墾濞寸姴绉堕崝褔鎳涢鍡楀Ё濡炲鍋犻、鎴︽儎閺夋垵鐓傞悗闈涚仢閹筹紕绱掗幘瀛樺皢
    - 闁绘壕鏅涢宥咁潰鐠佹娊顎楅柛?1 缂佸甯￠崳鎼佹偨?    - 闁?ID 闂佹彃绉风换妯荤?0 闁告帒妫濋崳鎼佸棘閺夎法纾诲┑?
闁稿繑濞婇弫顓犵磼閹惧浜柨?
- 闁革负鍔庨崵搴ㄥ箣閸ф锛熼柣銊ュ閳ь剚绮撻埀顑藉亾闁?-> 闂佹彃绉风换姗€鍨惧┑濠庢斀濞戞捁娅ｉ獮鍥捶閵婏附绾柟鎭掑劥缁诲骸顫㈤敐鍛濠㈣埖鐭Ч澶屸偓浣冾潐閸剛鎷犻婵堢枀闁?- 濡増绮忔竟濠囧础閻樺灚鏆忛柕鍡曠劍瀵囧箣鐟併倐鍋撴担鐟邦潓缂佷降鍔嶅畷鏌ュ炊閸欍儳鐟忕紒顐ュ吹婵悂骞€娓氣偓閸忔﹢鎳楅懞銉︾函闁烩晝顥愰～鍥儑鐎ｎ収娼岄柕?- 婵炲备鍓濆﹢浣烘喆閿旂虎娼鹃悷娆忔椤ｅ爼鏌ч幑鎰唴闁告粌鏈敮鍫曞礆閺堝吀绻嗛柛娆戝厴閹借偐鎹勯銈囩濞达絾绮庨弫銈夋椤厾鐭濋柣鎺曟硾瑜把囧捶?Tank Trouble 閻忓繐绻掗埢鍏兼償韫囨梻鍩楅柟鏉戠箻濞间即寮剁憗銈傚亾?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `cmd /c npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?

## 闂傚啳鍩栭?19闁挎稒鐡朼nk Trouble 闁革负鍔庨崵搴ㄥ触鐏炵虎鍔勯柡鈧柅娑滅闁炽儲绮嶅﹢浼村嫉閻戞ɑ鎷遍柛锔藉缁?+ 濞存粍鍨归顒勫礆閸℃绲哄ù鐘崇墧濮瑰鎮╅懜纰樺亾娴ｆ祴鍋?
闁哄牜鍓熷Ο浣糕枔閻㈠灚绐楅柡宥呮祫缁?

- 闁硅泛锕ゅ﹢顏嗙棯閹稿範浣割嚕韫囧海鐭ら柍銉︾矋濠€浼村嫉妤﹁法缈婚柛蹇嬪劙缁楀倹瀵?-> 濞存粍鍨归顒勫炊閻愭壆鐐婇柡鍫墯濠р偓濞戞挸绨肩划顒佺閸濆嫮鏆氶柡浣哥摠濞煎牊绻涙担鍝勑﹂柟?-> 闁告挸绉堕顒勫箰娴ｈ櫣鏁剧紒鍓уУ椤掓粓寮甸浣圭皻闁炽儲绻冮弫濂稿箣閹板墎绐?
  - 闁哄牜鍓氬┃鈧柛褝绠戦崢鐘诲嫉椤掆偓濠€鎾箳閵娿劎绠诲ù锝呯Ф浜?
  - 闁告挸绉堕顒佺▔婵犲啫袚闁哄牜鍓氬┃鈧ù锝呯Ф閻?闁哄牊绻傞幃婊勭▔鎼达紕纾婚柣蹇ｅ亗缁ㄣ劍绂?  - 濞存粍鍨归顒勫矗椤忓嫭绀€濞磋偐濮撮崣鐐閺嶎偄璐熼悗纭呯堪閳ь兛鑳堕崑鏍ь嚕楠炲簱鍋撴担鐑樼獥闁哄秴娲ㄦ慨鎼佸箑娴ｅ憡瀚查柡鍫墯濠р偓闁瑰瓨蓱閻?闁汇垻鍠愰鎾偐閼哥鍋?- 闂傚嫬绉崇紞鍡涘嫉椤掍焦绨氶柛褝绠戦崢鐘诲炊閻樿精绀嬪ù婊勫灩椤忣剟宕堕悙鎻掔樁缂佸墽濮甸婊呪偓浣冨閸ぱ囨儍閸曨剙鐝涢柟鐤Г閸斿懘宕仦钘夊耿濡炪倖瀵ч崝鍛村Υ?
闁哄牜鍓熷Ο浣糕枔闂堟稑绀傞悹渚囧枟閺佸ジ宕濋…鎺旂獥

- `backend/models.py`
  - 闁哄倹婢橀·?`TankTroubleMatchLocalPlayerSyncState`
  - 闁哄倹婢橀·?`TankTroubleMatchLocalState`
  - `TankTroubleMatchRequest` 闁哄倹婢橀·?`local_player`
  - `TankTroubleMatchState` 闁哄倹婢橀·?`local_state`
- `frontend/src/types/cloud.ts`
  - 濞戞挸楠搁幃妤冪博椤栨碍鍊辨慨婵勫劜閺屽﹥鏅堕悙鏈电矒闁哄牏鍎ゅ﹢浼村嫉閾忕懓笑闁诡兛鑳剁悮顐﹀垂?- `frontend/src/components/TankTroublePanel.tsx`
  - `TankTroubleEngine` 闁哄倹婢橀·?`buildMatchSyncState()`
  - 闁革负鍔庨崵搴ㄥ触鐏炵虎鍔勯柡鍐煐婵℃悂寮甸浣圭皻闁哄牜鍓欏﹢鎾锤閿曗偓閸樼娀鎯?`x / y / angle / radius` 闁告瑦鍨圭划浼村触鎼达綆浼?

闁哄牜鍓熷Ο浣糕枔閸忓摜闅樼紒鏃戝灦閳ь剚妲掔欢顐﹀绩閻熸澘袟闁?
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - 闁哄倹婢橀·?`normalize_match_local_player(...)`
  - 闁哄倹婢橀·?`apply_reported_match_player_state(...)`
  - `match_sync` 濞戞挸绉撮崯鈧柟绋款槹閺岀喖宕ラ幋锔芥殯闁革负鍔嬬花顖滅博椤栨丹渚€骞忛悢鍛婃嫳闁哄牆鎼鍫曞礂鐎ｎ剚鐣辨鐐茬－浜?閺夌儐鍓欓幃?
  - 濞存粍鍨归顒勫绩闁稖绀嬮柟鎭掑劜閺佸綊宕滃鍥朵紓濞戞挸锕ｇ槐鍫曟儍閸曨剚鎷遍柡鍫ｆ〃缂嶅懐绱旈鑽ょ憿闁哄牊绻傞幃?
  - 濞存粍鍨归顒傜磼瑜忛悽鑽ゆ嫻閻旇崵鐓戦柨?    - 闁绘劦鍠栭懘濠囨偨閻旂鐏囧☉鎾冲鐢娼?    - 闁绘劦鍠栭懘濠囧矗瀹ュ懓鍓?
    - 闁告稒鍨濋懙鎴﹀礆閵堝懐鏆?
    - 闁告帒妫欓弳?/ 闁告稒鍨濋懙?/ 婵繆顔婃鍝ョ磼閻旀椿鍚€
    - 1 缂佸甯￠崳鎼佹偨?    - 闁规潙娼″Λ鍧楀箮閺囩姰鍋嶉柟骞垮灩濞?
  - `build_match_state(...)` 闁绘粍婢樺﹢顏堟晬?    - `players` 闁告瑯浜ｇ换鎴﹀炊閻愭彃寰撳ù鐘崇墱鐢櫣鈧?    - 闁哄牜鍓氬┃鈧柛妤佹礈鐎氼厾鎸?`local_state`

闁哄牜鍓熷Ο浣糕枔闂堟稑顤呯紒鏃戝灠濠€顏嗙棯閸喚绌块柟鍨閺佸ジ宕濋…鎺旂獥

- `frontend/src/components/TankTroublePanel.tsx`
  - `createOnlineTankTroubleEngine(...)` 闁衡偓闁稖绀嬮柡鍫墯濠р偓/濞寸姵鐗斿Ч澶愬礆閸℃瑯鐎茬紓浣规尰閻?
  - `localPlayer` 濞达絾绮堢拹鐔煎础閺囩姴顏柣銊ュ濠€浼村捶閺夋鍤犻悹鐑囩磿濞ｎ噣骞?  - `players` Map 闁告瑯浜欑换姘舵偩濞嗗繐寰撳ù鐘崇墱鐢櫣鈧?  - 闁哄牜鍓氬┃鈧柛褝绠戦崢鐘绘儍閸曨亞绉寸紒澶庮唺缁楀矂寮靛┑鍡樺€婚悗鐟拌嫰閸欏繘鎮芥潏銊︽嫳闁革妇澧楃敮瑙勬交?  - 濞存粍鍨归顒勫矗椤忓嫭韬弶鈺傜懁缁ㄦ椽寮懜鍨皻鐎殿喖鎼崺妤佺┍椤旂瓔鍔€闁哄牜鍓氬┃鈧柨?    - 濡絾鐗楅濂稿礉閻樻彃寮?
    - 闁革附婢樺ù姗€宕氶崶銊ュ簥
    - 婵繆顔婃?
    - 闂佹彃绉堕弫?
    - 婵犳洖鍊讳簺閺夆晛娲ら妵?
  - 闁稿繑婀圭划顒勬偝閳轰緡鍟€缂備綀鍛暰閻犙囶暒缁垳绮╅婊冃﹂柟?+ 闁哄牜鍓欏﹢鎾箵閹烘垟鍋撻悡搴ㄦ尙婵?  - 闁绘劦鍠栭懘濠勭磼瑜忛悽濠氭偨閸欐闅樼紒鏃戝灟缂嶅懐绱旈鈧埞宥夊礉椤帞绀夊ù锝呮閸欏繘鏌堥妸褎鏆犻柛鎾崇Ф椤忣剟寮甸鈧﹢?Canvas 婵炴挸寮堕悡?

闁稿繑濞婇弫顓犵磼閹惧浜柨?
- 闁哄牜鍓氬┃鈧柛褝绠戦崢鐘崇▔瀹ュ懎鏅欐慨锝呯箣缁斿鏁缁堕鎸ч弽锔鹃殬缂佹棏鍨板ú鏍礌閸涱垳鐪版慨婵撶秶缁辨繈骞嶇€ｎ偄濡冲ù鍏肩閻︻喗绋夋繝浣侯伇闁绘鐗婂ú鍧楀箳閵夈劎绠柍銉︾矋濠€浼村捶閹殿喗绾柟鎭掑劜閹奸攱鎷呭┃閿亾濠靛嫧鍋?- 濞存粍鍨归顒佺瀹ュ洤濮уǎ鍥ㄧ箘閺嗏偓闁规潙娼″Λ鍧楀箣濡粯鐏嶉梺顐ｆ缁额偅绋夋惔銈庡敹闁告帒妫欏鍫熺箾娓氬﹦绀夊ù锝呮缁楀宕樺鍫㈩槹閻犳劧绲惧﹢浼村嫉鏉炴壆绉寸紒澶庡吹琚ч柛鎺戞閳?- 閺夆晜鐟﹂濂稿绩閻熸澘袟濞寸姴绉堕崝褔宕ｉ鍐▕闁活潿鍔嬬花?Tank Trouble 婵炴挸鎲￠崹娆撴閵忊剝绶查柨娑樺缁楀鎲撮敂缁㈡骄閻熸瑥妫濋。鍫曟煣閹规劗鐔呴柛婊冩湰鐢爼宕氶張鍏哥箚闁告瑧鍏橀幗鑲╂崉椤栨ǚ鍋?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `cmd /c npm run build` 闂侇偅淇虹换?
- `python -m compileall backend` 闂侇偅淇虹换?
## 闂傚啳鍩栭?20闁挎稒鐡朼nk Trouble 闁革负鍔庨崵搴∥熼垾宕囩閻熸瑥妫滈～搴ㄥ炊閻愭惌鍔€濞戞挸姘︾换宥夊礉閵婏妇澧℃慨婵撶到閸ｆ椽骞?
- 闂傚偆鍣ｉ。浠嬫嚄鐏炵偓鐝柨?  - 闁革负鍔庨崵搴∥熼垾宕囩闁革负鍔屾晶鐘崇▔閳ь剚娼鍏煎€辨慨婵勫劜閺佸ジ鏌呴悩鍙夊€甸柨娑樼焷椤曘倝鎮介妸銈囧晩闁绘瑯鍓涢悵娑㈡儍閸曨厾鏆嗛柛鏍ㄧ墬鐟曞棝寮婚幘鍐茬€婚柡鈧銈囩濠⒀勭懁缂嶅濡存担鐑樼獥闁哄秴娲㈤埀顑跨濞煎爼宕楃€ｎ偆澹夌€殿喖绻愰幏浼存倷椤旂⒈鏁婇柡鍫熺箓閹粓宕堕悙琛″亾閳ь剟濡?  - 闁告艾鏈鍌炴嚂閺冣偓濠р偓濞戞捁顕ч幆濠囨偝椤栨瑧鐭濋悗娑櫭﹢顏堝嫉椤掆偓濠€瀛樻媴瀹ュ洨鏋傚☉鎾崇凹缁垳绮╅婊冃﹂柟顑挎缁ㄤ即鎯勯崨濠傤€欓柟娈垮灛閳ь兛姊梔t` 濞戞挸顑夊鐑樻交閸ヮ剛褰柕鍡曠劍缁夌兘骞侀婵堢闁哄鍎卞畵?React 闁稿繈鍔戦崳娲煂瀹ュ棜顩柡灞炬尵閻℃垿姊婚鈧。浠嬫晬瀹€鍐︹偓鍐偝妫颁浇绀嬮柛妤嬬節閵嗘垿濡存担铏逛粶缂佸鐪归埀顑胯兌浜涢梺顐ゅ枍缁楀宕欓崱鎰ㄥ亾?- 闁哄牜鍓濋悿鍡樼┍椤旂⒈妲婚柨?  - 闁革负鍔庨崵搴∥熼垾宕囩闁诡厹鍨归ˇ鑼矓閹寸偛螚闁规壆鍠庨。鐐媴閹炬墎鍋撴担鐟邦棁闁硅绻愰崢婊堝Υ娴ｈ棄螡闁绘劕绠嶉埀顑胯兌椤偊骞橀悙鏉戠毦缂佸墽鎳撻幏浼存鐠鸿櫣鎽嶇紓鍌涚墪瑜拌法绮垫径鎰蒋缂佺嫏鍡╂綊閻熸瑥顦伴弲銉╁几濠у簱鍋?  - 闁革负鍔庨崵搴ㄦ偝閳轰緡鍟€濞戞挸瀛╁﹢浼村嫉閾忕懓璐熼悗鐟板缁儤绋夐埀顒勫炊閻愭彃鐓傞柛姘湰椤戞瑦顨囧Ο濂哥崜闁秆嶇畱閸樼姷鍒掗崜褌绱ラ柨娑樻湰娴狀喗寰勫鍡╁妧缁绢収鍠氬▓鎴︽倷椤旂⒈鏁婇柡鍫熺箓閹粓宕仦钘夘枀閺夆晜绋掗弻鐔煎触閹存瑢鍋?  - 婵炴挸寮堕悡瀣嚗椤忓棗绠氶柣?`delta time` 濞戞挸顑夊鐑樼?`0.01` 闂傚嫬绉撮崺?`0.001`闁挎稑濂旈幈銊ヮ潰閿濆褰柛鎺旀焿椤旀洘寰勯崶锔剧憪闁汇劌瀚簺闂侇偆鍠庢禍绋款啅椤旇　鍋?  - 闁哄牜鍓氬┃鈧柛褝绠戦崢鐘诲矗椤忓嫭韬弶鈺傜☉閸欏棝濡存担鐟板簥闁搞儰鍕橀埀顑跨劍椤掑瓨绂?闂佹彃绉堕弫鎾诲箣閺嶎剛孝濠㈠爢鍕＝缂佸绮鍌炲箥瀹ュ懎绻侀柛鎺曟硾閹棙绂嶉幋鐙€浼傞柛褎鍔栭悥锝夋晬鐏炰粙鎸柡鍐╂构娴滄帡寮甸鈧﹢瀛樻交閹邦剙袟濞戞捁妗ㄧ€靛矂濡?  - 閺夆晜绮庨顒勬偝閳轰緡鍟€闁告粌鑻悺娆忣嚕閸︻厽鐣遍柟缁樺笒閳ь剝鍋愰弫閬嶅炊閸濆嫮鏆扮紒顖滅帛閺嗙喖寮ㄩ柅娑滅闁糕晞妗ㄧ花?`dt` 闁汇劌瀚板Ο鍡欎焊閻撳海纭€闁圭粯甯掗埀顒傘€嬬槐婵嬪礄韫囨挾姣屽☉鎾崇Т閹挾鏁瀹稿吋绋夌€ｎ剚鐣遍柣顒夊墰浜涢柟鎵枂閳?  - 闁艰鲸姊瑰┃鈧?WebSocket 闁搞儳鍋涚€垫﹢寮ㄩ柅娑滅濞村吋锚閸樻盯鎯勭€涙ê澶嶉柛鐘插€荤划鏉款嚕閺囩喐鎯涢柨娑樻湰閸┭囨⒒?UI 闁稿宀稿閿嬶紣閹存繂鐓曢柡鍌氬簻缁辨繈姊藉鍕У React 闂佹彃绉电憰鍡涘蓟閹炬剚鍤犻悗鍦仦濡炲倻鈧絻顫夐崹顒勫箥鐎ｎ偄濡抽柣銊ュ婵傛牠宕鍐ｅ亾?- 鐟滅増鎸告晶鐘绘偐閼哥鍋撴笟濠勭獥
  - `frontend` 鐎瑰憡鐓￠崳鎼佸棘閻楀牏鈧垰顕欏ú顏佸亾濮樺磭绠栭柕?  - `backend` 鐎瑰憡鐓￠崳鎼佸棘?`compileall` 闂侇偅淇虹换鍐Υ?
## 闂傚啳鍩栭?21闁挎稒鐡朼nk Trouble 闁革负鍔庨崵搴㈡交濠婂拋浼傞弶鈺冨仧閻㈣螣閳╁啫鐝☉鎾虫唉娴溿倝寮介埄鍐惧妧

闁哄牜鍓熷Ο浣糕枔閻㈠灚绐楅柡宥呮祫缁?

- 閻熸瑱绲介崰鍛村灳濠婂懎笑闁诡兛绶氶崳鍝勵嚗閸繄姣堝ù锝呮濠€顏嗙棯婢跺摜鐭濋柣鎺曟硾瀹曢亶鍨惧┑鍫熺暠缂備焦鎸婚悗顖炲箑瑜斿Λ鑸碉紣濡硶鍋?- 闁硅泛锕ㄧ换娆戠博椤栨粌璐熼悗?/ 閻庢稒鍔曢懘濠冪鎼存ǚ鍋撳鍡樺闁哄牆绉存慨鐔煎闯閵娿儲褰ラ柣鎾椻偓閳ь剚绻冮弫濂稿箣閹般劉鍋撳鍕嫳闁革附濯界换娑氱磼椤撶喎鑵归弶鈺傚喕缁辨繈寮靛鍛潳闁革絻鍔忔禍銈夊冀閳╁喚鍔€闁炽儲绺块埀?- 缂備綀鍛暰濞ｅ洦绻嗛惁澶愬嫉椤掍緡鍋ч柡鈧悷鏉啃楅柛娆樹簷缂嶆棃鎮介妸銈囪壘 Tank Trouble 闁革负鍔庨崵搴°€掗崨濠傜亞闂佺偓宕橀惌楣冩晬鐏炶偐鐟濈痪鐗堝椤锛愰幋锔芥嚑閻犱警鍨伴幏浼村嫉閻戞﹩娼鹃柤宄板€圭敮鍫曞礆閸洘鎳犻悹渚灛閳?
闁稿繑濞婇弫顓㈠礆閵堝棙鐒介柨?
- 闁告绻濋妴鎴炵▔瀹ュ棙笑闁搞儳濮崇拹鐔兼偝閳轰緡鍟€闁靛棔鑳堕崑鏍ь嚕楠炲簱鍋撴笟鈧蹇曗偓娑欏姂閳ь兛绀侀崵顕€寮堕埀顒勫Υ娓氣偓閸ｆ悂鎮介悢绮瑰亾娴ｇ瓔鍚€闁告帒妫庨埀顑跨劍婵洨绮婇妸銊х濞存粍绋戦悺褍鈻撻棃娑栦喊濠㈣埖鍝庨埀?- 鐎点倖鍎肩换婊兠圭€ｎ厾妲哥紓鍐╁灴閵嗗锛愰崟顕呮綌闁艰櫕鍨濈换姘跺箰娓氣偓閵嗗骸顭ㄩ幋顖滅閻犲洤鐡ㄥΣ鎴澝硅箛姘兼綌闁革絻鍔嶇憰鍡涘蓟閹捐櫕瀚查悘蹇撶箳婵悂骞€娴ｇ鐦堕弶鐑嗗墮瑜板倿寮甸鍐叐濞戞挸绉靛Σ鎼佹偤閸洦鏆涢柕?- 闁革负鍔庨崵搴∥熼垾宕囩闁告绻濋妴鎴炵▔閺勫浚娲ｉ柡澶堝劥閸ゆ粍娼诲鍜佷紓閻庣數顢婇挅鍕偖椤愩垺绀€闁告牕鎳撴俊顓熺附韫囨稈鏀抽柛鏃戠厜缁变即寮靛鍛潳闁革絻鍔屽ú鏍礌閸涱垪妫︾€甸偊鍠曠粭澶愬锤閸パ冪槯闁挎稑鑻晶鐘电博椤栨碍鐨戝ù鍏间亢閵嗗啴鎮虫０浣界閺夆晛鈧喎鍨侀柕鍡曠窔閵嗘垿骞愰锝呯仐闁活剦鍓涗簺闁?
闁哄牜鍓熷Ο浣糕枔闂堟稑绀傞悹渚囧枟閺佸ジ宕濋…鎺旂獥

- `backend/models.py`
  - `TankTroubleMatchPlayerState` 闁哄倹婢橀·?`input` 闁?`server_time_ms`闁?  - `TankTroubleMatchBulletState` 闁哄倹婢橀·?`age`闁靛棔姊梑ounces_left` 闁?`server_time_ms`闁?  - `TankTroubleMatchLocalState` 闁哄倹婢橀·?`server_time_ms`闁?- `frontend/src/types/cloud.ts`
  - 闁告艾鏈鐐寸▔婵犲懎鐗氶悗娑欘殕椤斿矂鏁嶇仦鍊熷珯閻忓繐妫欓弻濠冩櫠閻愯尙鎽熸繛鍫滅祷椤旀洘绋夐崫鍕闂侇偄顧€缁辨繈寮柅娑氣敀闁稿繒鍘ч鎰焊濮橆厽寮撻柡鍥х摠閺屽﹪鎯冮崟顒侊紜濞存粍鍨归顒勬嚇濮橆厽鎷遍柕?- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - `build_match_state(...)` 闁搞儳鍋涚€垫﹢寮張鐢电憮闁告瑦鍨肩换娆戠博椤栨粌璐熼悗纭呮硾缂嶅宕滃鍫㈢炕闁稿繈鍎虫慨鎼佸箑娴ｇ鍋?  - 闁搞儳鍋涚€垫﹢寮張鐢电憮闁告瑦鍨甸悺娆忣嚕閻熸澘瀣€濮掝偄瀚ㄩ埀顑跨婢ф寧鎷呭▎蹇撳唨鐎殿喛顫夐濂稿极閺夋寧瀚查柡鍫濈Т婵喖宕抽妸锔筋槯闂傚倹鐣埀?
闁哄牜鍓熷Ο浣糕枔闂堟稑顤呯紒鏃戝灠缁扁晠骞欐惔銏℃毉闁告棏鐓夌槐?

- `frontend/src/components/TankTroublePanel.tsx`
  - 闁革负鍔庨崵搴∶洪弰蹇曗攬闁告艾鏈鐐烘⒒閹绢喗顓惧ù?`24ms` 閻犲鍟弳锝嗙▔?`16ms`闁?  - 闁哄倹婢橀·?`normalizeMatchInputState(...)`闁挎稑鐭傚Σ璇差潰閵忊剝锛嬮柡鍫濈Т婵喖宕抽妸褍绻侀悗娑欘殕椤斿瞼鈧絻澹堥崵褔宕滃鍥朵紓鐎殿喖鍊搁悥鍫曞Υ?  - `OnlinePlayer` 濞ｅ洦绻傞悺銊︽交濠婂拋浼傞柣婧炬櫅椤斿秹寮甸埀顒勫棘閹峰瞼缈婚柛蹇嬪劤婵悂骞€娴ｇ鍋?  - 閺夆晜绮庨顒勬偝閳轰緡鍟€婵絽绻愰幎姘跺箰?`forward / backward / left / right` 闁革负鍔嶅﹢浼村捶閹峰瞼绠剧紓渚囧幗鐢娼诲☉鏍ゅ亾?  - 闁哄牆绉存慨鐔煎闯閵娿儲缍忛柡宥呮矗缁稒鎷呭鈧拹?`targetX / targetY`闁挎稑濂旂徊楣冨冀閳╁喚鍔€鐎殿喖鎼€规娊姊藉鍕У闁?  - `OnlineBullet` 濞ｅ洦绻傞悺?`age / bouncesLeft / serverTimeMs`闁?  - 闁革负鍔庨崵搴ｂ偓娑欏姇閼村﹤袙韫囨挻濮庨柛蹇撶墛濠€浼村捶閻楀牆鐦?`vx / vy` 闁规亽鍔忕换姗€鏁嶇仦鍊熷珯闁革负鍔屾晶鐘电博椤栨凹妲遍柣鐐叉椤ｇ偓鎷呴幘鍐插唨鐎殿喚鎳撻幏鎵喆閸℃凹娼曟繛澶堝灮濮规濡?  - 闁哄牆绉存慨鐔煎闯閵娿儳鎽嶇€殿噣鈧稓绉寸紓?/ 闂侇偆鍠庣€瑰磭绱掕閻㈢粯鎷呭鈧拹鐔告姜缂佹澧℃慨婵撶悼濞蹭即寮介崶椋庣婵犳洖鍊讳簺鐎垫澘鐗嗛妵鍥籍閼搁潧顤呯€殿喖鎼崺妤呭箯婢舵劗绉烽柕?
闁稿繑濞婇弫顓犵磼閹惧浜柨?
- 閺夆晜绮庨顒傗偓鐢殿攰閽栧嫭绋夊鍛櫃閻庣懓鑻崣蹇曟偖椤愩倗绉圭紓浣圭矊濞叉牠宕犻崨顖涚暠闁煎搫鍊搁〃鏃堝箯閺嶎偅绲婚悹褑鍩囬埀?- 闁哄牆绉存慨鐔煎闯閵娿倗鐭濋柣鎺撴构缁绘岸鎮惧▎鎺濇綈闁告帗鐟ч垾妯兼媼閵堝啠鍋撴担鍛婂殥濞戞搩鍘归埀顑跨閸ㄥ酣寮懜顑藉亾娴ｈ鍔ュù婧屾壋鍋撴笟鈧崳鎼佹偨閻旂补鍋撴担鐟板簥闁搞儳鍋撴慨鍥╃矈閵娧呮惣闁哄鍟埢澶愭嚂瀹€鍐厬闁?- 闁哄牜鍓欏﹢鎾偨婵犳碍妗ㄥù鍏肩濞插潡宕撹箛濞惧亾濠婂嫬鐦紓渚囧幗閹搁亶寮ㄩ崜褏鐥呴柡鍫濈Т婵喖宕抽妸褉鈧鎷嬮妶鍥ㄧ暠閺夌偑鍔忛幎妤呭灳濠垫挾绀夐柤鏉垮缁楀寮伴妞诲亾濠娾偓缁旀挳宕犻崨顒傤伇闁告牕鎳撻幏鐑芥偐閼哥鍋撴担娴嬪亾濠靛嫧鍋?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `cmd /c npm run build` 闂侇偅淇虹换鍐Υ?
## 闂傚啳鍩栭?24闁挎稒鐡朼nk Trouble 濞存粍鍨归顒傛暜閹间讲鏁嗛悷娆忓€归崹顒併亜閸忓摜鐟㈤柍銉︾矌濞插啴骞掕濠€鎾炊闁款垪鍋撳┑鍡楀汲闁?
闁哄啫鐖煎Λ鍧楁晬?026-05-03 14:02:54 +08:00

闁哄牜鍓熷Ο浣糕枔閻㈠灚绐楅柡宥呮祫缁?

- 闁革负鍔夐埀顒佺矊缁辨垶鎱ㄧ€ｎ偆鍩楅柟鏉戠箚閳ь剚绺鹃埀顒佺矋缁佸鎷犻弴鐐搭偨閺夆晝鍟块埀顒佺箑缁狅絾寰勯弽銊︾厐濠⒀呭仒缁斿瓨绋?`闁烩晜鍨剁敮鍫曞捶閺夋寧绂坄 闁稿繈鍎辫ぐ娑㈠Υ?- 闁绘劗鎳撻崵顕€宕ユ惔銏犫叺鐎殿喒鍋撴繛鏉戠箺椤秹宕抽妸褏绉瑰銈囶暜缁辨繄鏁幖浣叉晢闁哄被鍎冲﹢鍛般亹閹惧啿顤呭ù婊勫灩椤忣剟宕烽妸褍娈犻柟鏉戞健濡潡濡?- 閻熸瑥鍊归崹顒傜磾閹达负鈧绋夊鍛潱闁稿繈鍎查崺褔姊诲ǎ顑藉亾娴ｉ鐟濋柛妤冨█椤や線鎳濈仦鍌楀亾娴ｉ鐟濋柛娆愬灴閳ь兛鑳剁敮铏光偓瑙勫劶缁额參宕楅妷锝傚亾?- 濞ｅ洦绻冪€垫棃宕仦鑺ヮ偨閺夆晝鍠愮粊瀵告嫚閺囩姷绉瑰銈囨暩鐞氼偅瀵奸懖鈺傜暠閻庡湱鍋炲鍌涙媴閹捐崵宕ｉ柨娑欑缁佽崵鎲撮崼婵囩彜闁哄牜鍓欏﹢鏉戙€掗崣澶屽帬闁秆嶇畱閸樼娀濡存担鍝勪粡鐎殿喖绠嶉埀顑跨窔濠㈠繒鈧稒鍔戦埀顑跨濠€鎾炊閹勫閻犱讲鈧啿鐎婚柡澶婂皡缁辨繄绱旈幋鐘垫崟闁告瑯浜濇刊鐑樻姜婵犳艾娅ら柣妯垮煐閳ь兛闄嶉埀?
闁哄鍩栭悗顖炴焻婢跺顏ラ柨?
- 婵炲备鍓濆﹢浣糕柦鐠恒劍鏆忛柡鍫墮濠€瀛橈紣閸曨噮娼斿銈囨暩濞堟垿骞嬮鍕 / frame 闁规亽鍔戦埀顑跨劍閺岀喎顕ｈ箛瀣у亾?- 闁哄倹婢橀·鍐╃閹寸媭浼?Tank Trouble 闁规潙娼″Λ鍧楀嫉瀹ュ懎顫ら柤濂変簻閻㈩偊鎯冮崟顕呮綆闁瑰瓨锕㈤妴澶愭晬?  - `http://<server>:18086/spectator.html?room=tank-trouble-main`
  - `http://<server>:18086/spectator/state?room=tank-trouble-main`
- 閻忓繐绻掗埢鍏兼償韫囨挸娑ч悹鎰枙閻宕ラ幋鐐存嫳闁革附婢橀幃妤冪博椤栨繍鍤炴慨鐟板€介～鍥箣?URL闁挎稑鑻懟鐔兼偨閵婏妇銈婚悷娆忕墕濞呮帡骞嶉幘宕囩；闁?- 闁哄牜鍓欏﹢鎾触鎼达綆浼傞柡宥堫潐瀹撲浇銇愰幘鍐差枀闁谎嗩嚙缂嶅秹寮靛鍛潳闁革絻鍔庨弫鎾诲箣?`18086` 闁汇劌瀚～鍥箣濮椻偓閵嗗宕烽弶鎸庣祷闁?
濞存粍鍨归顒勫绩閻熸澘袟闁?
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - 闁哄倹婢橀·?spectator 闊浂鍋嗛崣搴ㄥ几閸曨偆绱﹂柛鎴ｅГ閺嗙喖濡?  - 闊浂鍋嗛崣搴ㄥ礌閸涱厽鍎撻柛蹇嬪姂閸庢挳鎮抽埡渚囧晙闁挎稑鐭侀埀顒€濂旂粭澶愬及椤栨艾鍓奸柣婧炬櫅椤斿秶鎲撮崱姘兼健闂侇叏绲鹃悧閬嶅箳閹烘鐝?local player闁?  - 闊浂鍋嗛崣搴ㄥ礌閸涱厽鍎撳褎鐟ょ紞瀣Υ娓氣偓濠㈠繒鈧稒鍔戦埀顑胯兌閸嬫牕顕ｉ獮搴撳亾娴ｇ瓔鍚€闁告帒妫欏姗€濡存担鐟邦潓缂佷降鍔岄幏浼村捶閺夋寧绂堝ǎ鍥ｅ墲娴煎懘濡?  - 闁哄倹婢橀·鍐嚊椤忓嫬鐦堕柛?Canvas HTML 濡炪倗鏁诲浼村Υ?  - 闁哄倹婢橀·?`GET /spectator.html`闁?  - 闁哄倹婢橀·?`GET /spectator/state`闁?  - 闁哄牆顦辩敮铏光偓纭呮硾濠€顏嗙棯閹稿孩顦ч悷娆忓€归崹顒傛嫚闁垮婀撮柛娆樹海椤曚即鎮╅懜纰樺亾娓氬﹦绀夊☉鎾崇У鐢娼诲☉娆愮秬濠电偘鐒﹂悥鍫曞箣韫囨挻鍎曢柣婊庡灛閳?  - 婵炲矉绱曠敮铏光偓纭呮硾濠€顏嗙棯婢跺摜绋诲ù鐘茬У濠€浣糕枔鐎ｎ剚娈岄柣鎰靛枛閼村﹪寮拋鍦闁归潧绉存禒娑欐姜婵犳艾娅ら柣鎰靛枛閼村﹪鎳涢鍡楀Ё婵炴垵鐗嗛妵鎴濄€掗崨顖涘€為柕?
闁哄牜鍓欏﹢鎾触鎼达綆浼傞柡鈧悷鏉啃楅柨?
- `backend/models.py`
  - 闁哄倹婢橀·?`TankTroublePageUrlResponse`闁?- `backend/tank_trouble_cloud.py`
  - 闁哄倹婢橀·?`spectator_page_url(...)`闁?  - 闁哄倹婢橀·?`ensure_server(...)`闁挎稑鐬奸弫銈嗙鎼淬垹鈪电€殿喒鍋撻悷娆忓€归崹顒勫礈瀹ュ洠鈧ɑ绌?`18086` 闁规潙娼″Λ鍧楀嫉瀹ュ懎顫ら柛娆樺灣閺併倝濡?- `backend/main.py`
  - 闁哄倹婢橀·?`GET /api/games/tank-trouble/spectator/page-url`闁?
闁告挸绉堕顒勫绩閻熸澘袟闁?
- `frontend/src/types/cloud.ts`
  - 闁哄倹婢橀·?`TankTroublePageUrlResponse`闁?- `frontend/src/api/cloudApi.ts`
  - 闁哄倹婢橀·?`getTankTroubleSpectatorPageUrl(...)`闁?- `frontend/src/components/TankTroublePanel.tsx`
  - 闁哄倹婢橀·?`GameLaunchMode = "online" | "latency" | "spectator"`闁?  - 闁哄倹婢橀·?`openSpectatorMap(...)`闁?  - 闁哄倹婢橀·?`闁烩晜鍨剁敮鍫曞捶閺夋寧绂坄 闁圭顦甸幐鎶藉Υ?  - 閻犲洢鍎茬€垫粓鏌﹂鑽ょ憹濞撴碍绻嗙粋鍡涙偝閳轰緡鍟€ ID闁挎稑鏈﹢顓熸綇閹惧啿寮抽柣婧炬櫅椤?ID 濞戞梻鍠曢崗妯兼喆閸屾稑鐏涢柕?- `frontend/src/styles/globals.css`
  - 婵炴挸鎲￠崹娆撳触椤栨艾袟闁圭顦甸幐鎶藉礌閻戞ɑ鏆☉?3 闁告帗顨呯粩椋庝沪閳ь剟濡?
濞戞挸楠搁崣鐐閺嶎厽鎳犻悹渚灣濞堟垶娼忛崷顓熸珪闁?
- 濞戞挸绉疯缁?go2rtc 閻熸瑥妫濋。鍫曞箳閵婏妇銈?/ 闁瑰嘲顦扮粊锕傛煣閹规劗鐔呴柕?- 濞戞挸绉疯缁炬壆澧楀┃鈧慨濠冨閸ｏ箓骞掕閸╂绌遍垾鍐插▏闁烩晜鍨甸幆澶愭煣閹规劗鐔呴柕?- 濞戞挸绉甸弫濂稿矗濡儤韬紒鎹愭硶鐢櫣鈧娉涢幃鎾愁潰閵夈儱绀傞悹渚囧枤濞堟垿宕樺▎蹇撳汲閻犱警鍨扮欢鐐哄Υ?- 濞戞挸绉烽鈧悷娆忓€归崹顒併亜閸偄鐏囧☉鎾跺劋閺屽﹪鎯冮崟顒傚煑闁规潙绻戝鍫熺箾娴ｅ憡鍎曢柣婊庡灛閳?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `cmd /c npm run build` 闂侇偅淇虹换鍐Υ?- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\main.py backend\tank_trouble_cloud.py backend\models.py` 闂侇偅淇虹换鍐Υ?- `python -m compileall backend` 闂侇偅淇虹换鍐Υ?
## 闂傚啳鍩栭?22闁挎稒鐡朼nk Trouble 闁革负鍔庨崵搴ㄥ嫉椤掍焦绨氬Λ鏉垮缁佸鈧稒鍔曢懘濠冪▔鎼粹剝绀€婵犙屽灟閹便劍寰?
闁哄牜鍓熷Ο浣糕枔閻㈠灚绐楅柡宥呮祫缁?

- 濞ｅ浂鍠栭ˇ鏌ュ捶閵娧冩疇婵☆垪鈧磭纭€濞戞搩鍘虹划娑㈡倿鐠鸿櫣鎽犻柛锔哄妿濞堟垿寮甸浣圭皻闁秆嶇畱閸樼娀宕堕悙鏉戝毐 / 闁活剦鍓涗簺闁?- 濞ｅ浂鍠栭ˇ鏌ュ嫉椤掍焦绨氱€殿喒鍋撻柣蹇ｅ亰濞撳墎鎲版担铏规惣鐎垫澘鎳忓﹢鍥礉閳ヨ櫕鐝ょ痪顓у枦椤撳骞嶅鍡樷枖缂佲偓閾忕懓浠忕€殿喖婀卞▓鎴︽⒒椤曗偓椤ｄ粙濡?- 濞ｅ浂鍠栭ˇ鍙夛紣閸曨剛銈村☉鎾冲濠€鍥礉閳ヨ櫕鐝ょ痪顓у枦椤撶粯绋婄€ｎ喗锛熷璺哄閹﹥绋夊鍤芥棃鏌呴悩鍐茬亣闁汇劌瀚崑鏍ь嚕閸︻厾宕愰柣鎺曟硾閸ゎ參鎮抽懜顑藉亾娴ｈ櫣宕愰柣鎺曞煐缁夐攱寰勬笟搴撳亾?
闂傚偆鍣ｉ。浠嬪储閻旈攱绀堥柨?
- `applyLocalPlayerState(...)` 闂佹彃濂旂划娑氣偓娑櫭﹢顏堝嫉椤掍焦绨氭繝鏇炲€讳簺閻℃帒鎳撶换鍐⒓閸績鍋撻崗鍏碱槯鐎殿喖鎼崺妤呭触閸愨晜绠涢柛鏂衡偓铏彜闁秆勫姈閻栵綁鎯冮崟顖楀亾閺勫繒甯嗛柨娑樻湰濠€鍥礉閳ヨ櫕鐝ら煫鍥跺亞閸欏海绮欏鍛俺闁解偓閽樺鍊甸悘蹇撳綁缁变即骞庢繝鍐╂嫳闁哄牐娅ｇ敮铏光偓纭呮硾閹粓寮缂嶅懐绱旈钘夘€欓柛銉у亼閳?- 闁哄牜鍓氬┃鈧柛锔哄妿閸ゅ海鈧稒鍔曢懘濠傤潰閵堝懎顤呴悗鐟拌嫰閸欏繘寮堕妷銊ユ闁哄牆绉存慨鐔煎闯?`state.bullets`闁挎稑鏈晶宥嗙閵夈儳纾婚柣蹇ｅ亯椤鎲存径濠勭畱濡炪倛宕甸悺鎴炵▔鐎ｂ晝顏辨繛鍡忓墲濠€鍥礉閳ヨ櫕鐝ら柛銉у仜鐎垫﹢濡?- 闁哄牆绉存慨鐔煎闯閵娧勫焸閻庢稒鍔曢懘濠囧礄閾忕懓绠涢柡鍐啇缁辨繃淇婇崒娑氫函婵炲备鍓濆﹢浣割潰閿濆洠鈧﹢骞掗妷褜鍚€闁哄牜鍓欏﹢瀛橈紣閸曨剛銈撮悗娑欏姇閼村﹪鏁嶇仦鑺ョ殤闁告瑯鍨甸崗姗€鎯岄鐔哥暞闁哄嫬澧介妵姘▔閵堝鏆柨娑樼焸濞堛垽宕ユ惔顭戞殨婵炴潙顑呴悺娆忣嚕鐟欏嫯绐楅柛鎴犲皑缁辨繈鎯囩€ｎ厽宕抽柡澶堝劚閸庢岸姊婚鍡楃疀 / 闂傚偆浜濋惀鍛村Υ?
闁哄牜鍓熷Ο浣糕枔闂堟稑顤呯紒鏃戝灡閺佸ジ宕濋…鎺旂獥

- `frontend/src/components/TankTroublePanel.tsx`
  - `OnlineBullet` 闁哄倹婢橀·?`predicted` 闁哄秴娲╅鍥Υ?  - 闁哄倹婢橀·?`localFireLatched`闁靛棔姊條ocalShootCooldown`闁靛棔姊梟extPredictedBulletId`闁?  - 闁哄倹婢橀·?`firePredictedLocalBullet(...)`闁挎稑鏈﹢浼村嫉閻戞ê鐦诲☉鎾愁儏缁辨垿鎮橀锝嗩槯缂佹柨顑呭畵鍡涙偨閻旂鐏囬柡鍫墮濠€瀛橈紣閸曨剛銈撮悗娑欏姇閼村﹪濡?  - 闁哄拋鍣ｉ埀顒佺濠€鍥礉閳ヨ櫕鐝?`local_state` 濞戞挸绉撮崯鈧€殿喖鎼崺妤呭炊閻愭潙顎欓柡鍫墯濠р偓闁秆勫姈閻栵綁鏁嶇仦钘夋锭濞ｅ洦绻勯弳鈧梻鍫㈠仜閻栬埖娼拠韫俺闁汇劌瀚～妤佹償閿旂晫澧℃慨婵撶祷閳?  - 闁哄牆绉存慨鐔煎闯閵娿儳鎽嶇€殿喚鎳撻幃鎾愁潰閵夛附顦ч柨娑樺缁辩増绂掓惔銏″紦闁告牕缍婇崢銈夋儍閸曨垼鏆曟繛鏉戭儏閻℃瑥顕ｉ柅娑滃幀閻庣數绮竟姗€宕?owner闁靛棔娴囩粣娑氱矉缂佹ê澶嶉弶鈺傚灩濞堟垹鈧稒鍔曢懘濠冩交濞戞粠鏀介柟鎭掑劤椤撴悂濡?  - 鐎规瓕灏～锕傚箳閵壯屽悁闁汇劌瀚伴。鈺伱圭€ｎ亞鎽嶇€殿噣鈧稓鐟濆ù鍏艰壘閸熲偓濡増绻傞ˇ濠氭偨閻旂鐏囨繛锝傗偓鍐叉瘔婵炲牆顑呮總鏍Υ?  - 闁哄牜浜ｉ～锕傚嫉瀹ュ懎顫ら柛锝冨妿閳ユ鎷嬮妶鍥ㄧ暠濡澘瀚粊瀵糕偓娑欏姇閼村﹦鎼鹃崨鎵畺闁活収鍘藉鍌炴⒒缂堢姷绐楁繛锝傗偓鍐叉瘔缂佸顭峰▍搴ㄦ晬瀹€鍕級闁稿繐绉烽～锕傚嫉瀹ュ懎顫ょ紒鏃戝灡鐎氬棛绱掑┑鍡欑；闁诲浚鍋呭鍌炴⒐閹稿孩鍩傛繛鍫濐儑閺嗏偓闁?
闁绘鐗婂﹢浼存晬?
- 閹煎瓨姊婚弫銈夋偋閸喐鎷卞ù?`0.3.3` 闁圭粯鍔曞畷宀勫礆?`0.3.4`闁?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `cmd /c npm run build` 闂侇偅淇虹换鍐Υ?- `python -m compileall backend` 闂侇偅淇虹换鍐Υ?
## 闂傚啳鍩栭?23闁挎稒鐡朼nk Trouble 缂備胶鍠嶇粩鎾捶閵娧冩疇闁哄牜鍓欏﹢鎾级閸愩劉鏋嗛柟闈涱儐閸?

闁哄牜鍓熷Ο浣糕枔閻㈠灚绐楅柡宥呮祫缁?

- 濞ｅ浂鍠楅婊勭▔婵犱胶顏遍柣妤€鐗婃俊鎼佸嫉椤掆偓濠€鎾箥鐎ｎ偄濡崇紓浣瑰灥閻ｉ箖宕氶幍鏂ュ亾濠婂嫬鐓ｉ梻鍌涙尦閸ｇ兘宕ｉ鍛畳濞戞挴鍋撳☉鎿冧簽鐢櫣鈧懓鐏堥埀顒佺箘濞堟垹鎷嬮幑鎰靛悁閻犲浂鍨扮亸顖炲Υ?- 闁革负鍔庨崵搴∥熼垾宕囩濞戞搩鍙忕槐婵嬪嫉椤掍焦绨氶柣婧炬櫅椤斿秹濡存担瑙勬嫳闁哄牓缂氱欢顓㈠礂閵夛絺鍋撴担瑙勬嫳闁哄牐娅ｉ崑鏍ь嚕閻熸壆绠戝銈堫嚙椤劗绱掗崼婊呯闁归晲鐒﹀﹢浼村捶閺夊灝绁柡鍐煐鐢娼诲☉鏍ゅ亾?- 濠㈣埖鐭Ч澶愭嚂閺冣偓濠р偓闁告瑯浜滅花鑼嫚閵夆晩鏉哄鑸电墬濡绮堥崫鍕緭濞寸姵鐗滅敮铏光偓纭呮硾閹蜂即宕楅張鐢甸搨闁绘壕鏅涢宥夋倷椤旇壈鍓ㄩ柨娑樺缁楀鎯旈弮鍥跺殙闁衡偓閻熸澘缍侀柡鍫墯濠р偓闁瑰灝绉崇紞鏃傛崉椤栨氨绐為柕?
闁哄牜鍓熷Ο浣糕枔闂堟稑顤呯紒鏃戝灡閺佸ジ宕濋…鎺旂獥

- `frontend/src/components/TankTroublePanel.tsx`
  - 缂佸顭峰▍?`soloLocalMode` 濞?`ONLINE_SYNC_SOLO_INTERVAL_MS`闁?  - 闁哄牜鍓氬┃鈧柛褝绠戦崢鐘差潰閿濆懐鍩楃紒澶庮嚙婵晠寮張鐢电憹闁告劕绉电€垫梻绱掗鐐村劎闂傚嫬瀚﹢鍥礉閳ヨ櫕鐝ゅù锝呯Ф閻?/ 閻熸瑦甯掔€规娊鏁嶇仦钘夋锭闁革负鍔屾慨鐐哄礂閵夛絺鍋撴担鐟板簥闁搞儰鍕橀埀顑跨劍椤掑瓨绂嶆幊閳ь兛绶氶崳鎼佹偨閻旇櫣鎼奸弶鍫濇贡閺咁偊鏌屽鍡樼厐闁圭虎鍘鹃～鎺楀Υ?  - 闁哄牜鍓氬┃鈧柣鎰靛枛閼村﹪宕ｉ幋婵堟闁告艾娴烽悵娑㈠础閸愭彃顫ｉ柛蹇嬪劜濠€浼村捶閺夎儻鍓ㄩ梺顒佹尭閸亞鎮伴…鎺旂闁哄牆绉存慨鐔煎闯閵娧€鈧鎷嬮妶鍛€甸柛娆樹簽缁妇鈧?`serverId`闁挎稑濂旂粭澶愬箳閵壯屽悁闁哄牜鍓欏﹢鎾锤閹邦厾鍨奸柕?  - 闁哄牆绉存慨鐔煎闯閵娧冧粡鐎殿喛顫夌€?owner 闁告帒妫欑粊锕傛晬濮橆厽鎷遍柡?owner 闁告瑯浜滄禒娑氭兜椤旀鍚囬柛婊冪灱閺佹捇宕ㄩ挊澶嬪櫙闁哄牏鍠曠欢鐔煎礉閳哄绀夐弶鈺傜矌椤?owner 闁归潧绉存禒娑㈠箵閹烘垟鍋撻崗鑹邦洬闁哄本鎸堕埀?  - 闁哄牜鍓氬┃鈧柣鎰靛枛閼村﹪宕ㄩ幋鎺曞幀闂傚牐娉涢悺娆撳嫉椤掆偓濠€鎾础閾忣偅顦х紓浣规尵閻ｅ鏁嶅畝鍕珐閻庢稒鍔掔紞鍛磾椤旂偓鏆忕紒娑欏劤閹洟宕ラ崼婵婂珯闁挎稑鐭傛导鈺呭礂瀹ュ棙绠涢柛鏂衡偓铏彜闊浂鍋嗛崣搴ㄥ箰娴ｈ櫣鏁鹃悷鏇炴濞插﹪寮甸鈧﹢鎾偨婵犳碍妗ㄩ柕?  - 闁革负鍔庨崵?WebSocket 閻犲鍟€瑰磭绱掗悢鍓侇伇濞戞挾鍎ゅ﹢浣规綇閹惧啿寮?`16ms`闁靛棔鑳堕埞鏍⒒?`90ms`闁挎稑濂旂粭澶愬礃瀹ュ棗鐦婚柣婧炬櫅椤斿秹寮导鏉戞闁衡偓閻熸澘缍侀柛姘湰椤掔偟绮甸弽顐ｆ闁?
闁稿繑濞婇弫顓犵磼閹惧浜柨?
- 闁革负鍔庨崵搴∥熼垾宕囩闁告瑯浜濆﹢渚€寮甸浣圭皻闁绘壕鏅涢宥夊籍鐠佸湱绀夐柟闈涱儐閸斿懏鎯旈弮鈧敮瀛樻交閹存繃顐介弶鈺冨枑缁佸鎷犻弴鐔屼礁顕ｈ箛瀣у亾?- 闁革负鍔庨崵搴∥熼垾宕囩闁哄牆顦崣鐐閺嶎偄璐熼悗纭呭煐濡炲倿鏁嶇仦鐐嫳闁哄牏鍎ゆ晶婊堝箛閻斿墎鐭濋幖瀛樻煣缁绘岸骞愭担椋庮伇闁肩柉鎻槐婵囷紣濠靛棭妯嗛柟瀛樺姈濠€浼村矗椤忓懏笑婵炴挸寮堕悡瀣交濠婂拋浼傞柛褝绠戦崢鐘诲椽瀹€鍐缂佹棏鍨抽崑鏍ь嚕楠炲簱鍋?- 闁哄牆绉存慨鐔煎闯閵娿倗鐭濋悹鎰枙閻骞嬮崸妤侊紵闁靛棔绶氶·渚€鎳濋幓鎺戠獥闁活潿鍔婇埀顑跨劍婵洨绮婇妸锕€搴婇柛銉ゅ嫎閳ь兛娴囩换娆戠博椤栨粌璐熼悗鐟板婵悂骞€娴ｇ鍋撴担鐣岀缂佹棏鍨抽崑鏍ь嚕閸︻厼笑闁诡兛绀侀幏浼村级閸愩劉鏋嗙紓浣规尵閻ｅ濡?
闁绘鐗婂﹢浼存晬?
- 閹煎瓨姊婚弫銈夋偋閸喐鎷卞ù?`0.3.5` 闁圭粯鍔曞畷宀勫礆?`0.3.6`闁?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `cmd /c npm run build` 闂侇偅淇虹换鍐Υ?## 闂傚啳鍩栭?25闁挎稒鐡朼nk Trouble 闁烩晜鍨剁敮鍫曞捶閺夋寧绂堝☉鎾寸箖缁妇鈧稒鍔曢懘濠冪▔鎼粹剝鍊辨繛鍡樺礃椤鎲存径鎰垫闁?闁哄啫鐖煎Λ鍧楁晬?026-05-03

闁哄牜鍓熷Ο浣糕枔閻㈠灚绐楅柡宥呮祫缁?

- 濞ｅ浂鍠栭ˇ鍙夌閹寸媭浼傞悷娆忓€归崹顒傜磾閹达负鈧鏌屽畝鈧崑鏍ь嚕瑜版帩妫ч悶娑樺缁盯寮垫径鎰┾偓鎴﹀箰椤愩倖鐣遍梻鍌ゅ櫍椤ｄ粙濡?- 閻忓繐绻掗埢鍏兼償韫囨洖浠柛?`闁烩晜鍨剁敮鍫曞捶閺夋寧绂坄 闁告艾娴峰ú鍧楀箳閵夛箑鈪电€殿喒鍋撻柛銉ユ惈閻ｉ箖鎯冮崟顒佺厐濞存粍鍨归顒傛喆閸屾稑鐏涘銈囶暜缁辩櫗http://111.230.62.106:18086/spectator.html?room=tank-trouble-main`闁?- 閻犱讲鏅欑花顖滅博椤栨繍娼庨柟瀛橆焽缂嶅銇勯悽鍨暠闁革附婢樺ù姗€濡存担鍓叉毎濞达絾鎸堕埀顑跨窔濠㈠繒鈧稒鍔戦埀顑胯兌閸嬫牕顕ｉ獮搴撳亾娴ｇ鍐€鐎殿喛顫夌亸婵堢棯閻熺増瀚查柛褝绠戦崢鐘诲冀瀹勬壆纭€閻忓繋绮欓崳鐑樼▔鎼达紕姣堢紒瀣儏缁參宕?Tank Trouble 婵炴挸鎲￠崹娆撴偩瀹€鍕〃濞ｅ洦绻冪€垫棃宕ョ仦鑲╊伇濠靛倹顨夐～瀣喆婢跺寒鍤旈悷灏佸亾闁?
闁哄牜鍓欏﹢瀵镐焊韫囨洍鏌ら幖鏉戠箲閺佸ジ宕濋…鎺旂獥

- `frontend/src/components/TankTroublePanel.tsx`
  - `闁烩晜鍨剁敮鍫曞捶閺夋寧绂坄 闁圭顦甸幐铏▔瀹ュ懎鏅欓悹褏澧楀Λ顐︽儍閸曨偅鍊电紒鏃戝灠婵晠骞€?URL 闁兼儳鍢茶ぐ鍥╂崉椤栨氨绐為柕?  - 闁绘劗鎳撻崵顕€宕ユ惔锝嗙函闁规亽鍎叉晶锕€顕ｉ埀?`TANK_TROUBLE_SPECTATOR_URL`闁?  - 闁瑰灚鎸哥槐鎴﹀籍閺堢數绐楅梻鍕閻㈩偉銇愰幘鍐差枀濞戞挸顭烽。浠嬪矗閸屾稒娈堕柨娑欑摢&theme=light` 闁?`&theme=dark`闁挎稑鐭侀鈧紓鍐╁灴閵嗗鎲撮崒娑樼仜濡炪倓绲荤粣锟犳⒕韫囨挾姣堢紒瀣儏缁厼菐鏉堛劎銈柤鐟板级鑶╃€殿喖绻堥埀?
濞存粍鍨归顒傛喆閸屾稑鐏涘銈呯仛閺佸ジ宕濋…鎺旂獥

- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - `build_spectator_html()` 闁告劕鎳忛弻濠冩櫠?`renderBullets`闁靛棔姊梑ulletFades`闁靛棔姊梬allRipples` 缂佹稑顦扮粊鑽ゆ喆閸繃鐝ら柡鍫墮濠€鏉戙€掗崣澶屽帬闁绘鍩栭埀顑块檷閳?  - 闁哄倹婢橀·?`syncRenderBullets(...)`闁挎稒纰嶅﹢鍥礉閳ヨ櫕鐝ら煫鍥跺亞閸欏酣宕ｉ鍐▕濞戞捁娅ｉ崑鏍ь嚕閸︻厽绐楅柡宥呮矗缂嶅懐绱?/ 闁烩晩鍠楅悥锝夋焻閻斿嘲顔婇柣銊ュ娴溿倝寮介埄鍐惧妧闁哄鍎茬花顕€濡?  - 闁哄倹婢橀·?`advanceRenderBullet(...)`闁挎稒纰嶇粊鑽ゆ喆閸繃鐝ゆ慨锝呯箰閹舵岸骞?`vx / vy` 閺夆晝鍋熼悽濠氬箳閵娿劎绠婚柣鎰靛枛閼村﹪鏁嶇仦鍊熷珯闁革负鍔嶅﹢浼村捶閺夋妲遍柣鐐叉椤ｇ偓鎷呴幘鍐插唨鐎殿喚顢婇～瀣喆婢跺牃鍋?  - 闁哄倹婢橀·?`advanceEffectsAndBullets(...)`闁挎稒姘ㄧ划鐑樼▔閳ь剟骞掗妸銊х闁绘劦鍠栭懘濠囧Υ娴ｅ搫浠忕€殿喛顫夌拹浼村礄閹巻鍋撴担鍓叉毎濞达絾鎸稿钘夘嚕鐟欏嫬鐨剧紒鎯х畭閳?  - 婵炴挸寮堕悡瀣籍閺堢數鐟濋柛鎰Ф濞插潡骞掗妷锕€惟 `state.bullets` 鐟滅増鎸风紞鏂啃掕箛鎾村闁哄嫬澧介妵姘攦閹板墎绀夐柤鏉挎湰濡叉悂宕楅崼婵囧€辨慨婵勫劚閸╁矂寮甸鈧﹢?`renderBullets`闁挎稑鑻崯鈧柣銏ｉ哺缁佽崵鎲撮崼婵囩彜闁?`requestAnimationFrame` 閺夆晝鍋熼悽濠氬箻椤撶喐鏉归柕?  - 濞ｅ洦绻勯弳鈧柡鍫濈Т婵喖宕抽妸锔界秬濠电偘绶ょ槐浼存倷椤旇壈鍓ㄩ柣銏㈠枎閹筹繝宕ㄩ妸锔藉焸闁靛棔绀佸钘夘嚕鐟欏嫷鍋ч柡浣藉焽閳ь兛绀侀幊鈩冪▔椤撴壕鍋撴担绛嬪悁闁告帒妫庨埀顑跨窔濠㈠繒鈧稒鍔楁慨鎼佸箑娴ｉ鐭濋柣銏犲綁缁垳绮╅娑樼叄闂傚倸鐡ㄥ﹢鍥礉閿涘嫧鈧鎷嬮妶蹇曞耿缂傚啯鍨块妴澶岀博椤栨艾娑ч柛瀣亢椤鎲存径搴ｇ缂備緡鍘介埀顑啯瀚查弶鐐差煼閸ｇ儤锛愰崟顒傘偞闁?
閻熸瑥妫滈～搴ㄥ触鐏炵虎鍔勯柨?
- 濞存粍鍨归顒傛喆閸屾稑鐏涘銈囨暩濞堟垿鎳楃仦鐐彲闁靛棔鑳堕悵鐢稿箮閳ь剟宕烽崫鍕亢闁哄锟ラ埀顑跨椤ｇ偓鎷呴幘瀵哥懁闁告瑦菧閳ь兛绀侀。鐐媴閹炬潙顥囬柟璇茬箳閸ゅ酣濡存担钘壩濋柣鎰畭閳ь兛娴囩粩鐔烘喆閹烘柨娈犻柕鍡曠窔濠㈠繒鈧稒鍔栭悧鍗烆嚕韫囧鍋撴担鍝勪粡鐎殿喚鎳撹ぐ鍌炲礂婢跺﹥瀚叉繛锝傗偓鍐叉瘔闁轰礁鐗婇悘澶愭晬鐏炵偓鏆☉鎾荤細閸掓稒娼婚幋婵堟瘓缂佸顑呯花顓㈠礃閸涱垱鐣?Tank Trouble 闁告艾鏈娆戠矓閹寸偛螚濡炲瀛╅悧鎼佸Υ?- 濞存粍鍨归顒傛喆閸屾稑鐏涘銈夋涧濞煎爼宕楃€ｎ剛甯涢柛鎺曞煐閺佸吋绋夋潪鎵憿閻忓繐绻掗埢鍏兼償韫囨稑娅￠柣銊ュ閻濐喚鐥濞煎爼宕楃€ｎ偆澹夌€殿喖绻嬬粩鎾嚊鏉堝墽绀夐柛鏍ф噺鐎氼參鎮欓纰辨晩闁靛棔娴囧┃鍛媴閹炬潙顥囬柟璇茬箰閸樻粓濡存担鍝ュ暡闂侇喓鍔岃ぐ鍌炲礂婢跺﹥瀚查柛娆愵殔閸?/ 鐎殿喒鍋撻柣蹇ｅ亰濡垶宕楁径鍫氬亾?- 闁秆嶇畱閸樼姷绱掑Ο鍝勭厬缂備綀鍛暰濞达綀娉曢弫?`angle + Math.PI / 2` 闁汇劌瀚弻鐔煎触閹存繍妲遍柣鐐叉４缁辨繈鏌嗛崹顔煎赋闁绘劦鍠栭、娆撳棘閻熺増鍊婚柛婊冪焷椤㈡垶娼诲☉娆愮厵闁告碍鍨靛浠嬪触閹存瑢鍋?
闂侇喓鍔庣拋鍙夋綇閸︻厽娅曢柨?
- 鐎规瓕寮撶粭鍌涘閻樿尪瀚欓梺鎻掔Т閹?`111.230.62.106` 濞戞挸锕﹀▓?Tank Trouble 闁规潙娼″Λ?/ 閻熸瑥鍊归崹顒勫嫉瀹ュ懎顫ら柨娑樼灱椤忣剟宕ｉ敐鍕 `18086`闁?- 闁哄牜鍓氶濂稿矗椤忓泦鏇犲枈?Tank Trouble 婵炴挸鎲￠崹娆撳椽瀹€鍐炬綆闁瑰瓨锕㈤幗鑲╂崉椤栨ǚ鍋?- 闁哄牜浜濋弫濂稿礉?go2rtc 閻熸瑥妫濋。鍫曞箳閵婏妇銈?/ 闁瑰嘲顦扮粊锕傛煣閹规劗鐔呴柕?- 闁哄牜浜濋弫濂稿礉閵婏附绨氭慨濠冨閸ｏ箓骞掕閸╂绌遍垾鍐插▏闁烩晜鍨甸幆澶愭煣閹规劗鐔呴柕?
濡ょ姴鐭侀惁澶岀磼閹惧浜柨?
- `cmd /c npm run build` 闂侇偅淇虹换鍐Υ?- `python -m compileall backend` 闂侇偅淇虹换鍐Υ?- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py` 闂侇偅淇虹换鍐Υ?- 濞?`build_spectator_html()` 闁圭粯鍔曡ぐ鍥礃閸涱厾銈甸柤瀛樼濠€浼村触鎼淬垹鈷旈悶?`node --check build-logs\spectator-page-check.js` 闂侇偅淇虹换鍐Υ?- 濞存粍鍨归?`http://111.230.62.106:18086/health` 閺夆晜鏌ㄥú?`{"ok": true, "idle_timeout": 0}`闁?- 濞存粍鍨归顒傛喆閸屾稑鐏涘銈夋涧閸炲鈧懓婀遍垾妯兼媼閵堝懎鐦堕柛?`renderBullets`闁靛棔姊梥yncRenderBullets`闁靛棔姊梬allRipples`闁靛棔姊梩ankNoseGlow`闁靛棔姊梥pectatorTheme`闁?## 2026-05-03 16:47 - Tank Trouble monitor cleanup, vote UI, latency badge, dark web views

Scope:
- Only touched Tank Trouble desktop UI, preview page, spectator page, and Tank Trouble room service.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm/control-signal listener paths.

Changes:
- Fixed spectator ghost bullets after the last online player exits. Empty-room spectator/status reads now advance remaining bullets by real elapsed time, clear bullets that have outlived the 10s lifetime, and bump `snapshot_seq` so monitor pages drop stale local render bullets.
- Removed vote dots from the center of the "ready/change map" button. Vote status now remains in the separate vote strip below the button.
- Added latency display for the latency-test module by measuring preview push round-trip time and publishing it as `latency_ms`. The local scoreboard updates this value at most once per second.
- Locked both web pages to dark style:
  - latency-test preview page always renders dark.
  - cloud spectator/monitor page ignores `theme=light` and always renders dark.

Files:
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `backend/models.py`
- `backend/tank_trouble_preview_page.py`
- `backend/tank_trouble_preview_runtime.py`
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/types/cloud.ts`

Version:
- Desktop app version bumped to `0.3.11`.

## 2026-05-03 17:22 - Tank Trouble online targets removed, fire queue guard, monitor aspect fix

Scope:
- Only touched Tank Trouble desktop UI and the Tank Trouble room/spectator service.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm/control-signal listener paths.

Changes:
- Removed training targets from online multiplayer only. Latency-test mode keeps its target flow unchanged.
- Online client no longer increments the match `fire_seq` on raw Space key press. The sequence advances only when the local online engine actually creates a predicted bullet, so repeated fire presses during cooldown or while 5 local bullets are already active do not queue later shots.
- Online short-tap Space input is queued only until the next render frame. If that frame cannot create a bullet, the request is discarded instead of being carried forward.
- Cloud match service now consumes newer fire sequence numbers even when the shot is rejected by cooldown or the 5-bullet limit. This prevents delayed server-side "ghost shots" if a stale client ever sends extra fire requests.
- Cloud match state and spectator state now publish `targets: []` for online rooms, and online spawn logic no longer creates targets just to avoid them.
- Fixed the cloud monitor page stage sizing so the 1280x800 battlefield keeps its aspect ratio when the right scoreboard is visible and the browser is resized.
- Replaced the latency-test preview raw URL text with a styled "闁瑰灚鎸哥槐鎴犵磾閹达负鈧锛愰崟顕呮綌" button.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/styles/globals.css`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

Validation:
- `cmd /c npm run build` passed in `frontend`.
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_page.py backend\tank_trouble_preview_runtime.py` passed.
- Uploaded and restarted the Tank Trouble room service on `111.230.62.106:18086`.
- Cloud health check returned `{"ok": true, "idle_timeout": 0}`.

## 2026-05-03 18:10 - Tank Trouble keybind collapse, sci-fi explosions, multiplayer powerups

Scope:
- Only touched Tank Trouble desktop UI, latency preview, cloud spectator page, shared API models, and the Tank Trouble room service bundle.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm/control-signal listener paths.

Changes:
- Collapsed the keybinding grid in the Tank Trouble launch card. The `閻犱礁澧介悿?閻庣懓鏈崹姝?toggle stays visible, and the forward/back/turn/fire binding buttons are only shown while editing.
- Increased tank rotation speed to one full turn every `1.3s` by setting `PLAYER_TURN_SPEED = 2閿?/ 1.3` in both the desktop engine and cloud room script.
- Upgraded tank destruction effects with segmented shock rings, radial tech ticks, and electric arc strokes while keeping the original blast radius.
- Added `tankExplosions` to the latency preview push/state model so browser preview pages can render desktop death explosions instead of missing them.
- Added cloud match/spectator fields for `tank_explosions`, `powerups`, and `powerup_effects`.
- Added multiplayer-only cloud-authoritative powerups:
  - First spawn starts 5 seconds after at least one player joins.
  - Maximum active powerups is `2 * active_player_count - 1`.
  - Current powerup type is gray `$`, effect `score`, score delta `+100`.
  - Pickup is resolved by the cloud room service when a living tank touches the powerup.
  - Pickup emits a short ring burst and `+100` effect for desktop online play and cloud monitor views.
- Cloud spectator/monitor page now renders powerups, pickup effects, and tank death explosions using the same dark sci-fi visual language as the desktop Tank Trouble canvas.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/tank_trouble_preview_runtime.py`
- `backend/tank_trouble_preview_page.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

Version:
- Desktop app version bumped from `0.3.16` to `0.3.17`.

Validation:
- `cmd /c npm --prefix frontend run build` passed.
- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.

Deployment:
- Uploaded `backend/cloud_setup_bundle/tank_trouble_room.py` to `111.230.62.106:/home/ubuntu/.cloud-service-console/tank-trouble/tank_trouble_room.py`.
- Restarted only the Tank Trouble room/spectator service matching `tank_trouble_room.py --serve --port 18086`.
- Did not restart or modify go2rtc video services.
- Did not restart or modify the mechanical-arm/control-signal listener.
- `http://111.230.62.106:18086/health` returned `{"ok": true, "idle_timeout": 0}`.
- Verified the remote script contains `POWERUP_FIRST_DELAY_MS`, `drawPowerups`, and `tank_explosions`.

## 2026-05-04 00:35 - Tank Trouble laser wall clearance, death weapon reset, force-field shield

Scope:
- Only touched Tank Trouble desktop UI, shared match models, and the Tank Trouble room/spectator service bundle.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm/control-signal listener paths.

Changes:
- Hardened bullet and laser spawn positions with a shared safe-fire helper. The desktop client, cloud room service, and spectator aim preview now back the projectile origin away from walls and push it out of wall geometry if the barrel is pressed into a wall.
- Laser paths now use the same safer spawn point for cloud-authoritative shots and local prediction, reducing cases where the visible laser appears to enter or originate inside wall bodies.
- Tank death now resets equipped weapons back to the default tank weapon. This clears shotgun, laser, minigun ammo/spin state, and local predicted weapon display while leaving non-weapon shield state separate.
- Added a gray `shield` powerup with a shield icon and `SHIELD` pickup text.
- Shield pickup creates a circular force field centered on the tank. It is translucent, shows inner-to-outer ripple rings, stays active for `3s`, then flickers for `1.5s` before fading out.
- Shield is not a weapon. It can stack with shotgun, laser, or minigun in either pickup order and does not replace the equipped weapon.
- Shield collision reflects incoming bullets and laser paths throughout both the active and flicker windows. The owner tank's own bullets ignore its own shield.
- Desktop online play and the cloud spectator/monitor page now both render shield powerups, shield pickup text, active shield visuals, and laser aim reflection against shields.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

Version:
- Desktop app version bumped from `0.3.27` to `0.3.28`.

Validation:
- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.
- `cmd /c npm --prefix frontend run build` passed.

## 2026-05-04 11:35 - Tank Trouble shield authority hit fix

Scope:
- Only touched Tank Trouble cloud room authority and app version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm/control-signal listener paths.

Changes:
- Fixed a server-side ordering bug where a bullet could reflect off a shield but still use its pre-reflection segment for the same-frame tank hit test.
- Added segment-vs-circle shield collision for projectiles so fast or interpolated bullets are reflected when their travel segment crosses the shield boundary, not only when the frame endpoint lands inside the shield.
- After shield reflection, the projectile is pushed to the shield outside edge and same-frame player hit checks are skipped.
- Added a hit-test guard so enemy bullets and laser segments that intersect an active/flickering shield cannot kill the shielded tank even if they arrive during a tricky timing edge.
- Owner bullets still ignore the owner's own shield.

Files:
- `backend/cloud_setup_bundle/tank_trouble_room.py`

Version:
- Desktop app version bumped from `0.3.28` to `0.3.29`.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py` passed.
- `cmd /c npm --prefix frontend run build` passed.

## 2026-05-04 12:20 - Tank Trouble shield reflection visibility and wall-adjacent firing fix

Scope:
- Only touched Tank Trouble desktop UI, shared match bullet model, and the Tank Trouble room/spectator service bundle.
- Did not touch go2rtc video ingest/playback.
- Did not touch mechanical-arm/control-signal listener paths.

Changes:
- Increased the force-field shield radius from `PLAYER_RADIUS + 18` to `PLAYER_RADIUS + 30` in the desktop client, cloud room authority, and embedded spectator page.
- Changed normal bullet, shotgun pellet, minigun bullet, and laser muzzle spawn to start outside the tank body plus projectile radius, then fall back to a pushed-out safe point when the barrel is pressed into wall geometry.
- Unified desktop local prediction with the cloud authority by using segment-vs-circle shield collision instead of endpoint-only checks, so fast bullets visibly reflect instead of crossing the shield between frames.
- Added an `owner_shield_released` projectile flag. A player's own newly fired projectile can exit their shield without being trapped at the muzzle, but after it leaves the shield it can bounce off the owner's shield if it returns.
- Added shield-impact ripples in the desktop canvas and cloud monitor page so reflected projectiles are visible when they hit the force field.
- Kept same-frame damage suppression after shield reflection and retained shield hit guards before tank damage resolution.
- Synchronized the cloud monitor/spectator page with the larger shield radius, safer fire spawn, and shield-reflection visuals.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

Version:
- Desktop app version bumped from `0.3.29` to `0.3.30`.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.
- `cmd /c npm --prefix frontend run build` passed.

## 2026-05-04 13:55 - Tank Trouble local weapon mechanical effects

Scope:
- Only touched Tank Trouble desktop rendering, the embedded Tank Trouble cloud spectator page, app version metadata, and documentation.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.

Changes:
- Added minigun shell casing visuals to desktop online play. Each locally predicted minigun bullet ejects a small metallic casing with randomized direction inside a 30-degree cone.
- Added remote minigun casing inference in the desktop renderer. When new remote minigun projectiles appear from cloud state, the client locally emits matching casings without asking the server to track them.
- Added the same local minigun casing inference to the cloud spectator/monitor browser page.
- Restyled casing drawing so minigun casings are smaller and silver/metallic, while shotgun casings keep the larger brass look.
- Reworked the shotgun reload display into a pump-action barrel movement. It uses the existing cooldown / `weapon_reload_ms` timing, so no new network field or authority path is required.
- Kept all shell casings and pump motion as render-only effects. The cloud server still synchronizes only gameplay state such as players, bullets, hits, shields, score, powerups, and map state.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- Version metadata in `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`

Version:
- Desktop app version bumped from `0.3.36` to `0.3.37`.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\tank_trouble_cloud.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.
- `cmd /c npm --prefix frontend run build` passed.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.37_x64-setup.exe`.

Deployment:
- Uploaded and restarted only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Health check returned `{"ok": true, "idle_timeout": 0}`.
- Did not restart or modify go2rtc video services.
- Did not restart or modify the mechanical-arm/control-signal listener.

## 2026-05-04 14:18 - Tank Trouble scoreboard medal ranks

Scope:
- Only touched Tank Trouble scoreboard UI, cloud spectator scoreboard UI, static Tank Trouble image assets, version metadata, and documentation.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.

Changes:
- Added rank medal PNG assets for first, second, and third place.
- Desktop Tank Trouble scoreboard now renders medal artwork for ranks 1-3 and keeps text rank numbers for ranks 4-10.
- Cloud spectator/monitor scoreboard now renders the same medal assets through `/assets/tank-trouble/scoreboard/rank-*.png`.
- Added CSS sizing and drop shadows so the medal images align with the existing latency, flag, player ID, and score columns.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/styles/globals.css`
- `frontend/public/tank-trouble/scoreboard/rank-1.png`
- `frontend/public/tank-trouble/scoreboard/rank-2.png`
- `frontend/public/tank-trouble/scoreboard/rank-3.png`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `backend/cloud_setup_bundle/www/tank-trouble/scoreboard/rank-1.png`
- `backend/cloud_setup_bundle/www/tank-trouble/scoreboard/rank-2.png`
- `backend/cloud_setup_bundle/www/tank-trouble/scoreboard/rank-3.png`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- Version metadata in `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`

Version:
- Desktop app version bumped from `0.3.37` to `0.3.38`.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\tank_trouble_preview_runtime.py backend\tank_trouble_preview_page.py backend\tank_trouble_cloud.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.
- `cmd /c npm --prefix frontend run build` passed.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.38_x64-setup.exe`.

Deployment:
- Uploaded the updated Tank Trouble room script and scoreboard medal assets to `111.230.62.106`.
- Restarted only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Health check returned `{"ok": true, "idle_timeout": 0}`.
- Did not restart or modify go2rtc video services.
- Did not restart or modify the mechanical-arm/control-signal listener.

## 2026-05-04 14:45 - Tank Trouble double barrel powerup

Scope:
- Only touched Tank Trouble desktop gameplay/rendering, Tank Trouble cloud room/spectator code, Tank Trouble static powerup assets, version metadata, and documentation.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.

Changes:
- Added a new multiplayer powerup `double_barrel` with gray base styling and the provided bullet PNG icon.
- Added pickup text `BARREL+1`.
- Added 10-shot double-barrel weapon state. Shots alternate left/right barrel offsets, use default bullet radius/speed/lifetime/bounce behavior, and do not count against the normal 5 active default-bullet limit.
- Added double-barrel cooldown at half the normal shot cooldown, giving doubled combined fire rate while preserving default bullet properties.
- Desktop online prediction now creates double-barrel bullets immediately for low-latency feel, then matches them with cloud-authoritative bullets like other predicted local shots.
- Cloud Tank Trouble room now owns double-barrel pickup, ammo, firing, cooldown, death reset, and match-state serialization.
- Desktop and cloud spectator tank sprites render twin barrels with a short recoil animation on the barrel that just fired.
- Added static icon copies at `frontend/public/tank-trouble/powerups/double-barrel.png` and `backend/cloud_setup_bundle/www/tank-trouble/powerups/double-barrel.png`.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/public/tank-trouble/powerups/double-barrel.png`
- `backend/cloud_setup_bundle/www/tank-trouble/powerups/double-barrel.png`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- Version metadata in `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`

Version:
- Desktop app version bumped from `0.3.38` to `0.3.39`.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.
- `cmd /c npm --prefix frontend run build` passed.

## 2026-05-04 16:35 - Control signal full-setup guard document

Scope:
- Documentation only.
- Did not touch server runtime, video services, control signaling services, or application code.

Changes:
- Added a teammate-facing Markdown note explaining why video full setup can cause control monitor `404` errors if it overwrites the nginx `/control/webrtc/` proxy block.
- Listed control-signal components that should not be removed or overwritten by video-only setup scripts.
- Added post-full-setup curl checks and diagnosis steps for internal `18085` versus public `18081`.

Files:
- `docs/CONTROL_SIGNAL_FULL_SETUP_GUARD.md`

## 2026-05-04 16:40 - Old server control signaling public proxy restored

Scope:
- Server-side nginx configuration only on old server `150.109.100.30`.
- Did not modify local application code.
- Did not restart or modify go2rtc video services.
- Did not restart or modify the control signaling process itself.

Changes:
- Restored the missing nginx `/control/webrtc/` reverse proxy on public port `18081`.
- The route now forwards to the already-running internal control signaling service at `127.0.0.1:18085`.
- Created a server-side backup before replacing nginx config:
  `/etc/nginx/conf.d/go2rtc-cloud.conf.bak-control-20260504-163949`
- Ran `nginx -t` and reloaded nginx.

Validation:
- `http://150.109.100.30:18081/control/webrtc/health` returned `200`.
- `http://150.109.100.30:18081/control/webrtc/status` returned `200`.
- `http://150.109.100.30:18081/control/webrtc/robot-next-offer?session=robot-control` returned `204`, meaning no pending offer, which is the expected idle state.
- `http://150.109.100.30:18081/video-endpoints.json` still returned `200`, confirming video public entry was not broken.

## 2026-05-04 16:45 - Control monitor virtual keyboard key-code compatibility

Scope:
- Local desktop app frontend only.
- Did not modify cloud server runtime.
- Did not touch video services, control signaling service, or Tank Trouble gameplay.

Changes:
- Fixed the control monitor virtual keyboard not lighting when the browser control page sends DOM `KeyboardEvent.code` values such as `KeyW`, `KeyA`, `KeyQ`.
- The monitor now normalizes `KeyW -> W`, `KeyA -> A`, etc. before comparing against the virtual keyboard labels.
- Added compatibility with `pressed_keys` and `keys` payload fields in addition to the existing `pressedKeys` field.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- Version metadata in `package.json`, `frontend/package.json`, `frontend/package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`

Version:
- Desktop app version bumped from `0.3.40` to `0.3.41`.

Validation:
- `cmd /c npm --prefix frontend run build` passed.
- `cmd /c npm run tauri:build` passed and produced `Cloud Service Console_0.3.41_x64-setup.exe`.

## 2026-05-04 17:10 - Control monitor compatibility with latest telebot frontend

Scope:
- Local desktop app frontend only.
- Did not modify telebot, cloud control signaling, video ingest, or robot receiver runtime.

Why:
- The latest `telebot/frontend/config.yaml` defaults to `input.mode: vr`, so the browser sends `vr_sample` instead of `keyboard_sample`.
- The console virtual keyboard previously only updated for `keyboard_sample`, making a healthy VR control stream look like no control signal was received.
- The latest telebot keyboard map also includes right-arm keys and special keys that were not present in the small virtual keyboard layout.

Changes:
- Control monitor now counts and timestamps `vr_sample`, `text_instruction`, and `client_hello` messages.
- `vr_sample` and `text_instruction` explicitly clear keyboard highlights and show a status explaining that the stream is active but has no keyboard sample.
- Added compatibility for wrapped `{ payload: ... }` messages.
- Expanded the virtual keyboard layout to include `Tab`, `Esc`, `Enter`, `;`, and the latest left/right arm keys from `telebot/frontend/static/app.js`.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/IMPLEMENTATION_LOG.md`

Version:
- Desktop app version bumped from `0.3.41` to `0.3.42`.

Validation:
- `cmd /c npm --prefix frontend run build` passed.

Deployment:
- Uploaded and restarted only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Health check returned `{"ok": true, "idle_timeout": 0}`.
- Copied the installer to `E:\Cloud-Service-Console\Cloud Service Console_0.3.39_x64-setup.exe`.
- Did not restart or modify go2rtc video services.
- Did not restart or modify the mechanical-arm/control-signal listener.

## 2026-05-04 15:15 - Tank Trouble laser end-of-path reversal fix

Scope:
- Only touched Tank Trouble laser path slicing/progression in desktop rendering and the cloud room/spectator script.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.

Changes:
- Fixed a laser visual issue where a laser could appear to reverse direction near the end of its lifetime after many reflections.
- Added path-length clamping for desktop laser segment slicing so the visible beam never advances beyond the precomputed reflected path.
- Added equivalent path-length clamping on the cloud room authority before serializing laser `segments`.
- Updated cloud spectator rendering so authoritative laser paths never fall back to reverse-reconstructing a beam when the provided visible segment list is empty.
- Preserved `path_segments` in the cloud spectator bullet cache so the monitor page can distinguish authoritative-path lasers from legacy/fallback laser states.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/IMPLEMENTATION_LOG.md`

Version:
- No version bump yet; this is a runtime/cloud laser behavior fix on top of `0.3.39`.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.
- `cmd /c npm --prefix frontend run build` passed.

Deployment:
- Uploaded and restarted only the Tank Trouble room/spectator service on `111.230.62.106:18086`.
- Health check returned `{"ok": true, "idle_timeout": 0}`.
- Did not restart or modify go2rtc video services.
- Did not restart or modify the mechanical-arm/control-signal listener.

## 2026-05-04 15:40 - Tank Trouble projectile smoke fade and solid double-barrel icon

Scope:
- Only touched Tank Trouble desktop rendering, Tank Trouble cloud monitor rendering, and the double-barrel powerup static icon asset.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.

Changes:
- Added a small local smoke-dissipation effect when projectile-style bullets finish their existing fade-out.
- Smoke is render-only on each client/monitor page; it is not synchronized through the server and does not participate in collision or gameplay state.
- Skipped smoke for laser projectiles so laser visuals remain clean.
- Applied the same smoke renderer to desktop training/latency/online views and to the cloud monitor page.
- Reworked `double-barrel.png` into a solid-filled icon while preserving the original double-bullet silhouette and magenta/cyan gradient style.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/public/tank-trouble/powerups/double-barrel.png`
- `backend/cloud_setup_bundle/www/tank-trouble/powerups/double-barrel.png`
- `frontend/IMPLEMENTATION_LOG.md`

Version:
- Desktop app version bumped from `0.3.39` to `0.3.40` for the installer build.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.
- `cmd /c npm --prefix frontend run build` passed.

## 2026-05-04 17:05 - Tank Trouble first-install launch affordance fix

Scope:
- Only touched the Tank Trouble desktop launch panel and version metadata.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.
- Did not deploy or restart cloud services.

Changes:
- Default-selected the Tank Trouble game card on fresh installs so a new user does not have to discover an extra hidden selection step.
- Kept `瀵偓婵鐖堕幋寤?and `濞村鐦鎯扮箿` clickable when the player ID is missing; clicking now shows a clear prompt and focuses the player ID field instead of silently appearing broken.
- Added a launch hint under the action buttons explaining that a player ID is required.
- Preserved the online color/full-room guards for real multiplayer entry.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/IMPLEMENTATION_LOG.md`
- Version metadata files

Version:
- Desktop app version bumped from `0.3.44` to `0.3.45`.
## 2026-05-04 18:55 - Tank Trouble online sync queue-latency reduction

Scope:
- Only touched the Tank Trouble desktop online sync loop and the local backend WebSocket proxy for Tank Trouble match sync.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.
- Did not deploy or restart cloud services.

Changes:
- Changed the online match WebSocket sender from request/ack-gated sending to paced latest-input sending.
- Active online input now sends at the existing rush interval and idle state at the existing idle interval, without waiting for each previous server response.
- Added a WebSocket buffered-amount guard so the client backs off if the local connection is already congested.
- Updated the local backend Tank Trouble match WebSocket proxy to drain a tiny burst of queued browser messages and forward only the newest sync payload to the cloud path.
- This reduces input backlog, stale-state processing, and visible rollback when video traffic or public-network RTT temporarily increases.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `backend/main.py`
- `frontend/IMPLEMENTATION_LOG.md`
- Version metadata files

Version:
- Desktop app version bumped from `0.3.45` to `0.3.46`.

Validation:
- `python -m py_compile backend\main.py` passed.
- `cmd /c npm --prefix frontend run build` passed.

## 2026-05-04 22:30 - Tank Trouble local laser visual smoothing

Scope:
- Only touched Tank Trouble desktop rendering and the cloud monitor page's browser-side renderer.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.
- Did not move animation work onto the server.

Changes:
- Kept server-authoritative laser path, lifetime, and hit/collision data unchanged.
- Changed desktop laser drawing to freeze the reflected path at fire time and render a local eased scan/glow along that stable path.
- Removed the visual dependency on a rapidly moving short laser slice, which was the source of discontinuous-looking laser frames during multi-bounce shots.
- Mirrored the same local-only visual model in the cloud monitor/spectator browser page so monitor views render the laser smoothly on the viewer machine.
- Kept fade-out and beam thickness subtle so the laser reads as continuous but no longer looks overly thick.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `cmd /c npm --prefix frontend run build` passed.
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\main.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.

## 2026-05-04 23:05 - Tank Trouble multi-projectile performance pass

Scope:
- Only touched Tank Trouble desktop rendering/simulation and the cloud monitor page's browser-side renderer.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.
- Did not move projectile animation rendering onto the server.

Changes:
- Added cached local bullet sprites for normal bullets, shotgun pellets, minigun bullets, double-barrel bullets, and fade-out bullets.
- Replaced repeated per-projectile Canvas `shadowBlur + arc` drawing with `drawImage` sprite rendering in desktop gameplay and monitor views.
- Added a wall spatial index for projectile-wall checks so bullets query nearby wall cells instead of scanning every wall each frame.
- Converted high-frequency online projectile updates from `flatMap` allocation to a lower-allocation loop.
- Updated training/latency projectile advancement to mutate existing projectile objects instead of copying every bullet every frame.
- Relaxed remote projectile correction thresholds and blends so clients/monitor pages prefer local projectile simulation, with server data used as gentle correction rather than frequent snapping.
- Mirrored the monitor page optimizations inside the embedded spectator script.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `cmd /c npm --prefix frontend run build` passed.
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\main.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.

## Ongoing Deployment Rule - Tank Trouble cloud sync

Rule:
- Whenever a future desktop app update changes Tank Trouble cloud-facing code, update the game-related services on both the old server and the new server.
- Only update Tank Trouble/game services and assets.
- Do not touch go2rtc/video ingest/playback.
- Do not touch the mechanical-arm/control-signal listener paths.
- Do not touch unrelated cloud services.

## 2026-05-05 00:15 - Tank Trouble cloud deployment and v0.3.48 installer

Scope:
- Deployed only Tank Trouble/game script and game static assets to both cloud servers.
- Restarted only the Tank Trouble game service.
- Did not touch go2rtc/video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.
- Did not touch unrelated cloud services.

Cloud deployment:
- Old server `150.109.100.30`: uploaded `tank_trouble_room.py` and Tank Trouble static assets, restarted `cloud-service-console-tank-trouble`.
- New server `111.230.62.106`: installed/enabled `cloud-service-console-tank-trouble`, uploaded `tank_trouble_room.py` and Tank Trouble static assets, ensured `/tank-trouble` proxy only, and restarted the game service.
- New server had an older orphan `tank_trouble_room.py` process already listening on `18086`; killed only that game-process listener so systemd could own the same port.

Validation:
- `http://150.109.100.30:18081/tank-trouble/health` returned `{"ok": true, "idle_timeout": 0}`.
- `http://111.230.62.106:18081/tank-trouble/health` returned `{"ok": true, "idle_timeout": 0}`.
- `http://111.230.62.106:18086/health` returned `{"ok": true, "idle_timeout": 0}`.
- `http://150.109.100.30:18086/health` returned `502 Bad Gateway` externally, but the standard `18081/tank-trouble` public entry is healthy.
- `cmd /c npm run tauri:build` passed.

Version:
- Desktop app version bumped from `0.3.47` to `0.3.48`.
- Installer copied to `E:\Cloud-Service-Console\Cloud Service Console_0.3.48_x64-setup.exe`.

## 2026-05-05 01:05 - Tank Trouble projectile load and spectator empty-state fix

Scope:
- Only touched Tank Trouble desktop gameplay rendering/sync and the cloud spectator page renderer.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.
- Did not move animation rendering onto the server.

Changes:
- Fixed the cloud spectator page wall spatial index builder so it no longer references an undefined `bullet` variable.
- Changed the spectator page to sync render bullets only when a new server snapshot arrives; animation frames now advance existing bullets locally instead of reprocessing the same bullet payload every frame.
- Unified spectator online-player counting across sidebar, polling cadence, and the canvas empty overlay so the arena no longer shows `No players online` while the latest state has active players.
- Added dynamic visual load shedding in projectile-heavy scenes: shotgun/minigun-heavy moments reduce smoke, wall ripples, and shell casing effects while preserving projectile rendering and gameplay state.
- Changed online desktop projectile wall collision checks to use the existing wall spatial index.
- Reduced online match-state bullet reconciliation work by splitting local/remote server bullets once and using maps for confirmed local bullets instead of repeated full-array scans.

Files:
- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `cmd /c npm --prefix frontend run build` passed.
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\models.py backend\main.py` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.

## 2026-05-05 01:35 - Tank Trouble one-click cloud bundle sync

Scope:
- Only changed the Tank Trouble cloud setup/sync path used by the desktop app's Tank Trouble `娑撯偓闁款噣鍘ょ純鐢?button.
- Did not touch go2rtc video ingest/playback.
- Did not touch the mechanical-arm/control-signal listener paths.
- Did not change gameplay rules or rendering behavior.

Changes:
- Tank Trouble one-click setup now compares a local bundle manifest with a remote `bundle-manifest.json`.
- The manifest hash covers `backend/cloud_setup_bundle/tank_trouble_room.py` plus Tank Trouble-only static assets under `backend/cloud_setup_bundle/www/tank-trouble/`.
- If the remote server is missing the manifest, has a different bundle hash, is missing the game asset directory, or the Tank Trouble service/proxy is not healthy, one-click setup uploads the current bundled game files and restarts only `cloud-service-console-tank-trouble`.
- If the remote server already matches the current desktop bundle and is healthy, one-click setup reports `閺堝秴濮熼崳銊ュ嚒閸氬本顒為崚鏉跨秼閸撳秶澧楅張鐞?without unnecessary re-upload/restart work.
- This makes a fresh server or another existing server syncable from the desktop app without manually copying Tank Trouble game scripts/assets.

Files:
- `backend/tank_trouble_cloud.py`
- `backend/main.py`
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/IMPLEMENTATION_LOG.md`
- `frontend/README.md`

Validation:
- `python -m py_compile backend\tank_trouble_cloud.py backend\main.py backend\models.py backend\cloud_setup_bundle\tank_trouble_room.py` passed.
- `cmd /c npm --prefix frontend run build` passed.
- Extracted the embedded cloud spectator script to `build-logs\spectator-page-check.js` and `node --check build-logs\spectator-page-check.js` passed.

## 2026-05-05 01:55 - Multi-agent handoff documentation

Scope:
- Added structured handoff documentation for splitting future work across Video Link, Control Signal, Tank Trouble, and UI Design agents.
- Documentation only; no runtime behavior changed.

Changes:
- Added a master index that lists shared repository paths, backend API groups, cloud services, ports, and cross-lane safety rules.
- Added per-agent documents with ownership boundaries, allowed/forbidden files, relevant APIs, cloud configuration, validation commands, and update requirements.
- Defined that every agent must update its own handoff document plus `frontend/IMPLEMENTATION_LOG.md` after each change.

Files:
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/VIDEO_LINK_AGENT.md`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/TANK_TROUBLE_AGENT.md`
- `docs/UI_DESIGN_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- Documentation files were created and reviewed for path/API coverage.

## 2026-05-05 - Control side-channel monitor path

Scope:
- Changed only the control signal lane.
- Kept browser-to-robot WebRTC signaling on `/control/webrtc/*`.
- Added a side-channel key-state monitor on `/control/monitor/key-state` so the mini app can display frontend key input without answering or consuming robot WebRTC offers.
- Did not change video ingest/playback, go2rtc video behavior, Tank Trouble, or game cloud services.

Changes:
- Cloud broker stores latest monitor key-state per `session + client_id`, expires stale clients after 3 seconds, and returns all active frontend clients.
- Full setup Nginx config now proxies both `/control/webrtc/` and `/control/monitor/` to the internal control signaling service on `127.0.0.1:18085`.
- Local backend added `GET /api/control-monitor/key-state?session=...` as a proxy to the cloud monitor endpoint.
- Dashboard control monitor now polls the side-channel key-state endpoint instead of acting as a robot receiver.
- Dashboard displays aggregate pressed keys plus a client list for multiple frontend senders.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/requirements.txt`
- `backend/cloud_setup.py`
- `backend/main.py`
- `backend/models.py`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/CONTROL_SIGNAL_FULL_SETUP_GUARD.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\cloud_setup.py backend\main.py backend\models.py` passed.
- `cmd /c npm --prefix frontend run build` passed.

Cloud deployment note:
- Existing servers need the updated `control_signaling.py` and an Nginx config containing both `/control/webrtc/` and `/control/monitor/` proxy blocks before frontends can post side-channel key-state through public `18081`.

## 2026-05-05 - Control monitor colored high-tech keyboard

Scope:
- Changed only the control monitor keyboard UI and monitor client ordering metadata.
- Did not change WebRTC offer/answer pairing semantics.
- Did not touch video ingest/playback, go2rtc video behavior, Tank Trouble, or game cloud services.

Changes:
- Added `firstSeenAt` and `firstSeenOrder` to cloud monitor client snapshots so the mini app can assign colors by first active frontend order.
- The mini app now assigns stable active-client color slots in priority order: green, blue, red, yellow.
- Active clients keep their color while they remain active; expired clients release their color; new clients take the highest-priority free color.
- The virtual control monitor keyboard now uses angled, higher-tech key shapes, panel grid texture, animated scan highlights, and stronger active key lighting.
- Keys pressed by one frontend use that frontend's gradient color.
- Keys pressed by multiple frontends use a mixed gradient built from all pressing clients' colors.
- The frontend client list now shows a matching color swatch and color label beside each `clientId`.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/models.py`
- `frontend/src/types/cloud.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\models.py backend\main.py` passed.
- `cmd /c npm --prefix frontend run build` passed.

## 2026-05-05 - v0.3.51 installer build and local install

Scope:
- Built a new desktop installer containing the control side-channel monitor and colored high-tech keyboard changes.
- Installed the new build locally.

Changes:
- Version bumped from `0.3.50` to `0.3.51`.
- Generated NSIS installer `Cloud Service Console_0.3.51_x64-setup.exe`.
- Copied installer to `E:\Cloud-Service-Console`.
- Ran the installer silently; it completed with exit code `0`.

Files:
- `package.json`
- `frontend/package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- `cmd /c npm run tauri:build` passed.
- Installed app registry entry reports `DisplayVersion=0.3.51`.
- Installed files exist in `E:\Cloud-Service-Console`, including `Cloud Service Console.exe`, `cloud-console-backend.exe`, and `Cloud Service Console_0.3.51_x64-setup.exe`.

## 2026-05-05 13:35 - Old server control signal deployment

Scope:
- Deployed only the Control Signal Agent lane to the old server `150.109.100.30`.
- Did not modify video ingest/playback, go2rtc video service logic, Tank Trouble, or game cloud services.

Cloud changes:
- Uploaded current `backend/cloud_setup_bundle/control_signaling.py` to `/opt/go2rtc-cloud/control_signaling.py`.
- Backed up the previous remote `control_signaling.py` before replacement.
- Added Nginx `location /control/monitor/` proxy to `127.0.0.1:18085` in `/etc/nginx/conf.d/go2rtc-cloud.conf`.
- Preserved existing `/control/webrtc/` proxy.
- Ran `nginx -t`, restarted `go2rtc-control-signaling`, and reloaded `nginx`.

Validation:
- `python3 -m py_compile /opt/go2rtc-cloud/control_signaling.py` passed on the old server.
- Internal `http://127.0.0.1:18085/control/webrtc/health` returned normal JSON.
- Internal `http://127.0.0.1:18085/control/monitor/key-state?session=robot-control` returned normal JSON.
- Public `http://150.109.100.30:18081/control/webrtc/health` returned `200`.
- Public `http://150.109.100.30:18081/control/webrtc/status` returned `200` and included monitor status fields.
- Public `http://150.109.100.30:18081/control/monitor/key-state?session=robot-control` returned `200`.
- Public monitor POST/GET test with two `client_id` values returned `clientCount=2`, `firstSeenOrder`, and expected pressed keys.
- After 4 seconds, public monitor GET returned `clientCount=0`, confirming TTL cleanup.
- Public `robot-next-offer?session=robot-control` returned `204`, confirming the side-channel monitor did not create or consume robot offers.
- Public `video-endpoints.json` still returned `200`.

Follow-ups:
- New server still needs the same control deployment if it should support `/control/monitor/key-state`.

## 2026-05-05 13:37 - Shared status read/write workflow update

Scope:
- Documentation-only UI Design Agent workflow update.
- Changed the multi-agent shared-status workflow so agents do not need to read `docs/SHARED_AGENT_STATUS.md` before every operation.
- Agents still write `docs/SHARED_AGENT_STATUS.md` after completing a functional version or staged change.

Changes:
- Added `docs/SHARED_AGENT_STATUS.md` to the master index as the shared four-agent status log.
- Updated the required workflow to read the shared status log only when the user asks, when fresh cross-agent state is needed, or when resolving a conflict.
- Updated the UI Design Agent handoff to follow the same read-on-demand, write-after-work rule.

Files:
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `docs/UI_DESIGN_AGENT.md`
- `docs/SHARED_AGENT_STATUS.md`
- `frontend/IMPLEMENTATION_LOG.md`

Validation:
- Documentation-only change; no build or runtime validation required.

Cloud deployment note:
- No cloud changes.

## 2026-05-05 13:41 - Control signal API usage document

Scope:
- Documentation-only Control Signal Agent update for teammate handoff.
- Added a standalone Markdown guide covering browser frontend, robot receiver, and mini app monitor usage of the control signal APIs.
- No runtime code, cloud scripts, video link, Tank Trouble, or UI behavior changed.

Changes:
- Documented public base URL, default `session=robot-control`, WebRTC signaling flow, side-channel key-state flow, response payloads, curl examples, JavaScript snippets, TURN settings, and troubleshooting notes.
- Linked the new API usage guide from the control signal handoff document.
- Added the guide to the master index so other agents can find it.

Files:
- `docs/CONTROL_SIGNAL_API_USAGE.md`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/AGENT_HANDOFF_MASTER_INDEX.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- Cross-checked endpoint names and payload fields against `backend/cloud_setup_bundle/control_signaling.py`, `backend/main.py`, `backend/models.py`, `frontend/src/types/cloud.ts`, and `frontend/src/api/cloudApi.ts`.
- Documentation-only change; no build or runtime validation required.

Cloud deployment note:
- No cloud changes.

## 2026-05-12 18:32 - Local TRTC publisher helper

Scope:
- Video Link Agent local utility update.
- Added a browser-based Tencent TRTC publisher page so camera, microphone, or screen can be pushed to a TRTC string room without OBS.
- Added a PowerShell launcher that serves the page over `127.0.0.1` because browser media capture and TRTC SDK loading need an HTTP origin.

Files:
- `scripts/trtc-local-publisher.html`
- `scripts/start-trtc-local-publisher.ps1`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- Parsed `scripts/start-trtc-local-publisher.ps1` with PowerShell parser.
- Confirmed Tencent TRTC Web SDK URL returned HTTP `200`.
- Ran `scripts/start-trtc-local-publisher.ps1 -Port 8091`.
- Confirmed `http://127.0.0.1:8091/trtc-local-publisher.html` returned HTTP `200`.

Cloud deployment note:
- No cloud changes. No ports, service names, or deployment bundle behavior changed.

## 2026-05-05 13:48 - Control signal teammate guide narrowed to WebRTC signaling

Scope:
- Documentation-only Control Signal Agent update.
- Revised the teammate-facing control signal guide so it only describes the browser-to-robot WebRTC signaling chain.
- Removed side-channel monitor/key-state content because that is internal to the mini app and not needed by the teammate.

Changes:
- Kept `/control/webrtc/health`, `/control/webrtc/status`, `/control/webrtc/browser-offer`, `/control/webrtc/robot-next-offer`, and `/control/webrtc/robot-answer`.
- Removed `/control/monitor/key-state`, local mini app monitor proxy endpoints, and `client_id` key-state examples from the teammate guide.
- Added an explicit explanation of call ordering: robot can poll first and wait indefinitely; browser can post first and wait within the current offer timeout, then should auto-redial if no robot answers in time.

Files:
- `docs/CONTROL_SIGNAL_API_USAGE.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- Documentation-only change; reviewed against current control signaling broker behavior.

Cloud deployment note:
- No cloud changes.

## 2026-05-05 14:00 - Control browser-offer long wait

Scope:
- Changed only the Control Signal Agent lane.
- Removed the default app-level 20-second wait timeout from browser-submitted WebRTC offers.
- Kept real control payloads on the browser-to-robot WebRTC DataChannel.
- Did not change video ingest/playback, Tank Trouble, or UI behavior.

Changes:
- `backend/cloud_setup_bundle/control_signaling.py` now treats `--offer-timeout-sec 0` as no app-level timeout and uses that as the default.
- Pending browser offers now remain queued until a robot answer arrives or the client/network disconnects.
- Cancelled browser requests remove their pending offer from the broker.
- Full setup Nginx template now sets `/control/webrtc/` `proxy_read_timeout` and `proxy_send_timeout` to `86400s`.
- Updated teammate/API and control handoff docs to describe long browser-offer waits and the optional finite timeout override.

Files:
- `backend/cloud_setup_bundle/control_signaling.py`
- `backend/cloud_setup.py`
- `docs/CONTROL_SIGNAL_API_USAGE.md`
- `docs/CONTROL_SIGNAL_AGENT.md`
- `docs/CONTROL_SIGNAL_FULL_SETUP_GUARD.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Cloud deployment:
- Old server `150.109.100.30`: uploaded updated `/opt/go2rtc-cloud/control_signaling.py`.
- Old server `150.109.100.30`: updated `/etc/nginx/conf.d/go2rtc-cloud.conf` so `/control/webrtc/` uses `86400s` read/send proxy timeouts.
- Restarted only `go2rtc-control-signaling`.
- Reloaded `nginx`.
- Did not touch video services, Tank Trouble services, or unrelated cloud paths.

Validation:
- `python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\cloud_setup.py backend\main.py backend\models.py` passed.
- Remote `python3 -m py_compile /opt/go2rtc-cloud/control_signaling.py` passed.
- Remote `nginx -t` passed.
- Public `http://150.109.100.30:18081/control/webrtc/health` returned `{"ok": true, ...}`.
- Public `http://150.109.100.30:18081/control/webrtc/status` returned `offerTimeoutSec: null`.
- Public long-wait pairing test passed: `browser-offer` stayed pending for more than 3 seconds, robot then pulled the offer, posted an answer, and the browser request returned the answer.

Cloud deployment note:
- New server was not updated in this step.

## 2026-05-15 16:16 - Web local Tencent push entry

Scope:
- Video Link Agent change for the local-stream UI in hosted web mode.
- Added browser camera probing so the web `閺堫剙婀撮幒銊︾ウ` sidebar entry can react to camera availability and browser permission state.
- Kept old local go2rtc/FFmpeg `瀵偓婵甯瑰ù涔?disabled in web mode.
- Kept Tencent Cloud Live WebRTC push usable in web mode and let it reuse the local-stream draft settings for resolution, frame rate, and bitrate.
- Skipped desktop-only local-stream status/config polling in web mode.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public token checks passed for admin `xhfang` and user `cmc5006`.
- Public web index references `/assets/index-DTHba6P5.js`.
- Public `http://150.109.100.30:18080/api/health` returned `backend-ready`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Deployed hosted web console to `150.109.100.30:18080` with existing tokens.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.
- No video service, control broker, Tank Trouble service, public port, or cloud service name changed.

## 2026-05-15 18:13 - Web Tencent push status proxy and occupancy

Scope:
- Added same-origin console backend proxy for Tencent video status updates at `/api/video/tencent/{start|heartbeat|stop}`.
- Web Tencent push status heartbeats now go through that proxy, so hosted HTTPS pages no longer get blocked when updating the HTTP telemetry relay.
- The local-stream page now polls video push status while open.
- If another web client is actively pushing Tencent Cloud video, the web Tencent start button is disabled until that stream stops or times out.
- Tencent push preview is rebound when the page becomes visible or focused again, reducing black preview after switching away and back.

Files:
- `backend/main.py`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `python -m py_compile backend\main.py`
- `git diff --check -- backend\main.py frontend\src\api\cloudApi.ts frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.xyz/` references `/assets/index-3fT14QW5.js` and `/assets/index-D38m5dXn.css`.
- Public `https://console.cityulive.xyz/api/health` returned `backend-ready`.
- Public `https://console.cityulive.xyz/api/video/status` returned video status JSON.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Deployed hosted web console to `150.109.100.30` with existing tokens.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.
- No go2rtc video service, SRT bridge, telemetry relay service, control broker, Tank Trouble service, Nginx route, public port, or cloud service name changed.

## 2026-05-15 17:38 - Browser camera display and per-window online count

Scope:
- Fixed the web local-stream camera status so it no longer shows browser-enumerated camera counts as exact physical camera counts.
- Browser `videoinput` devices are deduped, and the web camera signal now reports availability instead of a potentially misleading number.
- Changed online presence to use a per-page/window in-memory client id.
- Moved online heartbeat to the App level, so open admin web pages, user web pages, and EXE windows are counted while they are open.

Files:
- `frontend/src/App.tsx`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.xyz/` references `/assets/index-gpzQKaw3.js` and `/assets/index-B2hd1Wbt.css`.
- Public `https://console.cityulive.xyz/api/access` returned admin role for token `xhfang`.
- Public `https://console.cityulive.xyz/api/health` returned `backend-ready`.
- Public online heartbeat smoke test with three temporary client ids changed count from `1` to `2 -> 3 -> 4`, then returned to `1` after leave calls.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Deployed hosted web console to `150.109.100.30` with existing tokens.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.
- No video service, control broker, Tank Trouble service, Nginx route, public port, or cloud service name changed.

## 2026-05-15 17:21 - Tencent push parameter locking

Scope:
- Video Link Agent UI change for local-stream Tencent Cloud push mode.
- When the Tencent Cloud push panel is open or Tencent Cloud push is running, legacy-only local-stream options are dimmed and disabled.
- Still editable in Tencent mode: `鏉堟挸鍤崚鍡氶哺閻滃樃, `閻╊喗鐖ｇ敮褏宸糮, and `鐟欏棝顣堕惍浣哄芳`.
- Disabled in Tencent mode: local camera name, input format, encoder, capture resolution, capture FPS, legacy ingest protocol, SRT latency/packet controls, timeout, drop-late-packets, current-server toggle, public host/port, HTTP ingest, and SRT ingest.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css frontend\src\styles\theme.css`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.xyz/` references `/assets/index-De224WQ0.js` and `/assets/index-B2hd1Wbt.css`.
- Public `https://console.cityulive.xyz/api/access` returned admin role for token `xhfang`.
- Public `https://console.cityulive.xyz/api/health` returned `backend-ready`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Deployed hosted web console to `150.109.100.30` with existing tokens.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.
- No video service, control broker, Tank Trouble service, Nginx route, public port, or cloud service name changed.

## 2026-05-15 17:01 - HTTPS console entry enabled

Scope:
- Video Link Agent cloud entry update for hosted web console secure context.
- Enabled HTTPS for `console.cityulive.xyz`.
- Nginx now redirects `http://console.cityulive.xyz/...` to HTTPS and proxies `https://console.cityulive.xyz/...` to the existing web console on `127.0.0.1:18080`.
- Unknown port-80 hostnames still return `404`; old `/console/` was not restored.

Remote files:
- `/etc/nginx/conf.d/cloud-service-console-https.conf`
- Backup: `/etc/nginx/conf.d/cloud-service-console-https.conf.bak-before-ssl-20260515170023`
- Certificate: `/etc/letsencrypt/live/console.cityulive.xyz/fullchain.pem`
- Private key: `/etc/letsencrypt/live/console.cityulive.xyz/privkey.pem`

Public entries:
- Admin: `https://console.cityulive.xyz/?access_token=xhfang`
- User: `https://console.cityulive.xyz/?access_token=cmc5006`
- Fallback direct port: `http://150.109.100.30:18080/?access_token=...`

Validation:
- `Resolve-DnsName console.cityulive.xyz -Type A` returned `150.109.100.30`.
- `nslookup console.cityulive.xyz` via `8.8.8.8`, `1.1.1.1`, and `119.29.29.29` returned `150.109.100.30`.
- Remote certbot issuance succeeded; certificate expires on `2026-08-13`.
- Remote `sudo nginx -t` passed.
- Remote `systemctl reload nginx` succeeded.
- Public `https://console.cityulive.xyz/?access_token=xhfang` returned `200`.
- Public `http://console.cityulive.xyz/?access_token=xhfang` returned `301` to HTTPS.
- Public `https://console.cityulive.xyz/api/access` returned admin role for token `xhfang` and user role for token `cmc5006`.
- Public `https://console.cityulive.xyz/api/health` returned `backend-ready`.

Cloud deployment note:
- Reloaded only Nginx.
- Existing chain services remained active: `nginx`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `coturn`.
- No EXE rebuild was needed because no app code changed.
- No go2rtc video service, SRT bridge, telemetry relay, control broker, Tank Trouble service, coturn, or hosted web console process was restarted.

## 2026-05-15 16:41 - Web local push blocked-camera visibility

Scope:
- Video Link Agent fix for hosted web local-stream visibility.
- Public HTTP blocks browser camera enumeration, so web admins now still see `閺堫剙婀撮幒銊︾ウ` when the camera probe is blocked or checking.
- The local-stream page shows `PERMISSION BLOCKED` / `鐞氼偅绁荤憴鍫濇珤闂冪粯顒沗 for public HTTP camera blocking.
- `瀵偓婵鍚樼拋顖欑隘閹恒劍绁 is disabled with a tooltip when browser camera/screen capture is blocked by non-HTTPS.
- Old local go2rtc/FFmpeg `瀵偓婵甯瑰ù涔?remains disabled in web mode.

Files:
- `frontend/src/pages/DashboardPage.tsx`
- `docs/VIDEO_LINK_AGENT.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `docs/SHARED_AGENT_STATUS.md`

Validation:
- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public web index references `/assets/index-DTHba6P5.js`.
- Public `http://150.109.100.30:18080/api/access` returned admin role for token `xhfang`.
- Public `http://150.109.100.30:18080/api/health` returned `backend-ready`.

Build / deployment:
- Rebuilt `0.3.68`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Replaced `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`.
- Replaced `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- Deployed hosted web console to `150.109.100.30:18080` with existing tokens.

Cloud deployment note:
- Restarted only `cloud-service-console-web.service`.
- Existing chain services remained active: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.
- No video service, control broker, Tank Trouble service, public port, or cloud service name changed.
