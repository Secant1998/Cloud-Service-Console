# Video Link Agent Handoff

Last updated: 2026-08-13 14:53

Owner: video ingest, cloud video services, video preview, go2rtc-facing deployment.

## 113. External Frontend VS Code Terminal Auto-Activation

Date:

- 2026-08-13 14:53

Scope:

- Fixed the external Telebot frontend workspace so every newly created VS Code PowerShell terminal automatically activates the existing root `.venv`.
- Applied the configuration both when opening the Telebot repository root and when opening only `apps/frontend`.
- Explicitly enabled the current Python Environments extension command activation and added a workspace-scoped `Telebot PowerShell` default profile.
- The profile starts PowerShell with process-only `ExecutionPolicy Bypass`, because the machine policy blocks `Activate.ps1`; no global or user execution policy was changed.

Changed files:

- External `telebot-main_new0.2-0803/.vscode/settings.json`
- External `telebot-main_new0.2-0803/apps/frontend/.vscode/settings.json`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- Both settings files parse as JSON and select `Telebot PowerShell` as the Windows default terminal profile.
- Root-workspace and frontend-only activation tests both set `VIRTUAL_ENV` to the root `.venv`.
- Both tests resolved `python` to `.venv\Scripts\python.exe`, reported Python 3.11.9, and found editable `telebot 0.2.0a0`.

Runtime / cloud impact:

- VS Code development environment only. No application, video transport, control signal, Tank Trouble, cloud service, EXE, installer, GitHub, or tag changed.

## 112. P2P QoE Export Field Guide

Date:

- 2026-08-11 17:19

Scope:

- Added a legal JSON `fieldGuide` object to every newly downloaded P2P viewer QoE result so recipients can understand the saved data without a separate document.
- Added `fieldGuide.measurementReport` at the top of the export. It contains the actual values from this collection as a Chinese session overview, viewer environment, connection/transport report, video/playback report, automatic conclusions, and a per-sample key-metric timeline.
- The guide documents null/delta/cumulative-value conventions, timestamps, percentiles, WebRTC and media-state enumerations, summary statistics, and every session, environment, summary, connection, RTC, frame, playback, and visual field with units and interpretation notes.
- Raised only the top-level export `schemaVersion` from `1` to `3`; existing `session`, `summary`, and `samples` field names and structures remain unchanged for analysis compatibility.
- Standard JSON comments were intentionally not used because `//` and `/* */` would make the download invalid JSON.

Changed files:

- External `E:\Desktop\123\webrtc-p2p-video\public\qoe-collector.js`
- Remote Hong Kong `/opt/webrtc-p2p-video/public/qoe-collector.js`
- Remote Guangzhou `/opt/webrtc-p2p-video-gz/public/qoe-collector.js`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `node --check public\qoe-collector.js`
- Field-guide coverage check passed against all 163 leaf paths in `p2p-qoe-robot-clean-01-20260811T083208Z.json`; dynamic `pathCounts` keys are covered by the path description and enum table.
- JSON serialize/parse round trip passed with top-level schema `3` and `fieldGuide.locale = zh-CN`.
- VM generation tests against the successful TURN/720p30 record and the no-video/ICE-checking record produced the correct distinct human-readable state, path, FPS, sample timeline, and automatic conclusions.
- Remote and internally served SHA-256 matched local `9cdf076ba40fcc0a4985de78bbb5e267bb76ae5cbb286a3b35da3ab202f9dfbc` on both servers.
- Public Hong Kong and Guangzhou collector scripts returned HTTP 200 with schema v3 and the Chinese report generator; both `/api/config` endpoints returned `ok: true`.

Runtime / cloud impact:

- Deployed only the P2P viewer collector static asset to Hong Kong and Guangzhou.
- Final pre-deployment backups: Hong Kong `qoe-collector.js.bak-before-null-count-fix-20260811172045`; Guangzhou `qoe-collector.js.bak-before-null-count-fix-20260811172045` in their respective public directories.
- `webrtc-p2p-video.service` and `webrtc-p2p-video-gz.service` remained `active`; no service was restarted.
- No video transport/signaling behavior, TURN configuration, room behavior, port, public service name, Tencent/legacy path, control signal, Tank Trouble, console EXE, tag, or GitHub state changed.

## 111. Frontend-Only VS Code Interpreter Fallback

Date:

- 2026-08-07 17:20

Scope:

- Added a nested VS Code workspace setting for the external `telebot-main_new0.2-0803/apps/frontend` folder.
- This fixes the case where VS Code is opened directly at `apps/frontend`, causing the project-root interpreter settings to be ignored and `telebot_common` imports to fail.
- The nested workspace now uses the existing root Windows `.venv` and resolves shared Telebot package source paths.

Changed file:

- External `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-08\telebot-main_new0.2-0803\telebot-main_new0.2\apps\frontend\.vscode\settings.json`

Validation:

- Root `.venv\Scripts\python.exe` exists and imports `telebot_common` successfully.
- Reopened the external `apps/frontend` folder in a new VS Code window so new terminals can activate the configured environment.

Runtime / cloud impact:

- IDE-only change. No video, control, cloud service, application runtime, EXE, deployment, GitHub push, or tag changed.

## 110. P2P Viewer Local QoE Collection

Date:

- 2026-08-06 10:31

Scope:

- Added an explicit bottom-right `开始采集` control to the standalone P2P watch page.
- Collection is opt-in and runs entirely in the viewer browser. Starting creates a session and samples once per second; stopping changes the control to `停止并保存`, closes the session, and downloads one structured JSON file to the viewing machine.
- Samples are also written to browser IndexedDB as a local backup. No QoE records are uploaded to the signaling server.
- Recorded data covers receiver bitrate, RTT, RTP jitter, packet loss, jitter-buffer delay, decode/processing time, frame rate, frame interval variation, dropped/key frames, NACK/PLI/FIR, freezes, stalls, suspected black frames, selected direct/TURN path, browser environment, and capture-to-display timing when the browser exposes `captureTime`.
- Exposed a read-only viewer context from `shared.js` so the collector can obtain the current viewer `RTCPeerConnection` without changing room, signaling, reconnect, or media behavior.

Changed files:

- External `E:\Desktop\123\webrtc-p2p-video\public\watch.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\Desktop\123\webrtc-p2p-video\public\style.css`
- External `E:\Desktop\123\webrtc-p2p-video\public\qoe-collector.js`
- Remote Hong Kong `/opt/webrtc-p2p-video/public/{watch.html,shared.js,style.css,qoe-collector.js}`
- Remote Guangzhou `/opt/webrtc-p2p-video-gz/public/{watch.html,shared.js,style.css,qoe-collector.js}`

Validation:

- `node --check public\shared.js`
- `node --check public\qoe-collector.js`
- Browser smoke on desktop and `390x844`: no overflow; start, one-second sampling, stop, and local-save confirmation all passed.
- Public Hong Kong browser smoke passed at `https://p2p.cityulive.com/watch.html?room=robot` with no browser console warning/error.
- Hong Kong and Guangzhou public `watch.html`, `qoe-collector.js`, `/api/config`, and `/api/rooms` all returned HTTP 200.
- `webrtc-p2p-video.service` and `webrtc-p2p-video-gz.service` remained `active`; neither service was restarted.

Runtime / cloud impact:

- P2P watch-page static assets were deployed to both Hong Kong and Guangzhou. Pre-deployment `public` directories were retained as timestamped backups.
- Video media, signaling messages, room semantics, TURN configuration, ports, service names, Tencent Cloud Live, legacy go2rtc, control signaling, and Tank Trouble were not changed.
- No Cloud Service Console EXE build, hosted-console deployment, GitHub push, or tag update was performed.

## 109. External Telebot VS Code Environment

Date:

- 2026-08-03 13:03

Scope:

- At the user's explicit request, prepared the Windows VS Code environment for the external teammate project `telebot-main_new0.2-0803`.
- Replaced the unusable copied Linux `.venv312` as the VS Code interpreter with a new Windows Python 3.11 `.venv`; the Linux environment was preserved.
- Installed root runtime/development dependencies and installed the Telebot workspace as an editable package so `telebot_common` imports work from all project subdirectories.
- Added project-local VS Code interpreter, analysis path, pytest, extension recommendation, frontend launch, and public-cloud Compute launch settings.
- This was an IDE/runtime setup only. No video, control, robot, cloud service, or application behavior was changed.

External files / runtime:

- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-08\telebot-main_new0.2-0803\telebot-main_new0.2\.venv`
- External `.vscode\settings.json`
- External `.vscode\launch.json`
- External `.vscode\extensions.json`

Validation:

- Imported `telebot_common`, `telebot_compute`, aiohttp, aiortc, AV, OpenCV, NumPy, SciPy, and YAML using the new interpreter.
- Validated frontend default and Compute public-cloud profiles.
- `apps\frontend\app.py --help` completed successfully.
- Frontend smoke test listened on HTTPS port `8445`; the temporary frontend process and its spawned video worker were then stopped, leaving no Telebot Python process running.
- No EXE build, cloud deployment, service restart, GitHub push, or tag update was performed.

## 108. Local Desktop Target Migration

Date:

- 2026-07-29 10:15

Scope:

- Updated the installed desktop console's remembered local-stream host from `150.109.100.30` to the new Hong Kong server `43.154.250.82`.
- Updated both the committed local-stream settings and the UI draft so reopening the desktop app cannot restore the old host.
- Confirmed the desktop login record already targets `43.154.250.82`.
- Left standalone P2P tools on `https://p2p.cityulive.com`; DNS now routes that stable domain to the new server.
- Did not change legacy go2rtc server security rules, control signal files, or Tank Trouble files.

Changed local runtime files:

- `%LOCALAPPDATA%\CloudServiceConsole\local-stream-config.json`
- `%LOCALAPPDATA%\CloudServiceConsole\local-stream-ui-draft.json`
- `%LOCALAPPDATA%\CloudServiceConsole\local-stream\camera-push-command.json`

Validation:

- Parsed `cloud-console-login.json`, `local-stream-config.json`, `local-stream-ui-draft.json`, and the cached camera push command as JSON; all active local targets use `43.154.250.82`.
- Confirmed no Cloud Service Console process was running while the local runtime files were updated.
- No EXE rebuild was needed because these are external runtime settings read by the installed app.

Runtime/cloud impact:

- Local desktop settings only; no cloud service was changed or restarted.
- No GitHub push or tag update was performed.

## 107. Hong Kong Server IP Migration

Date:

- 2026-07-29 02:48

Scope:

- Migrated the current Hong Kong cloud target from `150.109.100.30` to `43.154.250.82` after confirming the copied services were already present and running.
- Corrected the new server's go2rtc WebRTC candidate, public SRT/viewer endpoint metadata, telemetry TURN host, coturn public/private NAT mapping, and hosted-console default/login host.
- Updated the web-console deployment script default target to the new Hong Kong IP.
- Kept `p2p.cityulive.com` and `console.cityulive.com` as the stable public domains; their DNS A records still need to be changed from the old IP to the new IP.

Changed files / deployment:

- `scripts\deploy_web_console.py`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `%LOCALAPPDATA%\CloudServiceConsole\cloud-console-login.json`
- Remote `/etc/turnserver.conf`
- Remote `/opt/go2rtc-cloud/go2rtc.yaml`
- Remote `/opt/go2rtc-cloud/telemetry-relay.config.json`
- Remote `/opt/go2rtc-cloud/www/video-endpoints.json`
- Remote `/opt/go2rtc-cloud/www/main-camera-runtime.json`
- Remote `/opt/cloud-service-console-web/cloud-console-web.env`
- Remote `/opt/cloud-service-console-web/storage/cloud-console-login.json`

Validation:

- New server SSH and service inspection via `ubuntu@43.154.250.82`.
- `scripts.deploy_web_console.REMOTE_HOST` and the local remembered login host both resolve to `43.154.250.82`.
- Direct `GET http://43.154.250.82:18081/api/video/status` and `/video-endpoints.json` returned HTTP 200.
- Host-pinned HTTPS checks reached the new server for `console.cityulive.com` and `p2p.cityulive.com`; both certificates are installed and valid.
- An external UDP probe reached the new server on SRT ingest port `19091`; coturn returned a valid STUN binding response from `43.154.250.82:3478`; a TURN relay-range probe reached UDP `20000`.
- `19090/TCP` is externally reachable, but repeated external UDP `19090` probes did not reach the server. The new server cloud security group still needs an inbound UDP `19090` rule for direct go2rtc WebRTC.
- After configuration updates, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`, `nginx`, `coturn`, `webrtc-p2p-video`, `go2rtc-control-signaling`, and `cloud-service-console-tank-trouble` all reported `active`.
- No active legacy/Tencent push, P2P room, or control session existed during the service restarts.

Runtime/cloud impact:

- Restarted only `coturn`, `go2rtc-cloud`, `go2rtc-telemetry-relay`, and `cloud-service-console-web` on the new Hong Kong server.
- Did not modify or restart the control broker, Tank Trouble service, SRT bridge, P2P signaling service, or Nginx.
- No desktop EXE build, GitHub push, or tag update was performed.

## 106. Console P2P Region Auto Selection

Date:

- 2026-07-08 21:37

Scope:

- Updated the Cloud Service Console local-stream P2P panel so the default P2P push/watch link follows the currently logged-in cloud server.
- When the console detects Guangzhou server identity (`111.230.62.106`, `p2p-gz.dlcourse.online`, or `p2p-gz.cityulive.com`) from `ssh_target`, `public_base_url`, network snapshot server IP, or local stream host, known default P2P links switch to `https://p2p-gz.dlcourse.online/watch.html?room=<room>`.
- Other known/default P2P links switch back to Hong Kong `https://p2p.cityulive.com/watch.html?room=<room>`.
- Custom non-default P2P domains are preserved.
- P2P push start, P2P link blur normalization, signal clearing, room discovery, and web viewer opening now use the server-preferred endpoint.

Changed files / deployment:

- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- Hosted web console on `150.109.100.30:/opt/cloud-service-console-web` was redeployed by `scripts\deploy_web_console.py`.

Validation:

- `cmd /c npm --prefix frontend run build`
- `python scripts\deploy_web_console.py`
- Deploy script health check passed for `http://127.0.0.1:18080/api/health` on the hosted web console.
- Deploy script confirmed existing chain services before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn` all remained `active`.

Runtime/cloud impact:

- Restarted only `cloud-service-console-web.service` on `150.109.100.30`.
- No P2P signaling service, legacy go2rtc ingest service, Tencent Cloud Live service, control signaling service, Tank Trouble service, nginx, or coturn restart was performed by this change.
- Desktop EXE rebuild was attempted with `cmd /c npm run installer:build`, but the Tauri/Cargo build stalled for 20 minutes and was stopped; `E:\Cloud-Service-Console` EXEs were not replaced.
- No GitHub push and no tag update were performed.

## 105. Guangzhou P2P dlcourse Deployment

Date:

- 2026-07-08 20:59

Scope:

- Redeployed the Guangzhou P2P video service using `https://p2p-gz.dlcourse.online` as the public Guangzhou P2P push/watch domain.
- Synced local `E:\Desktop\123\webrtc-p2p-video\server.py`, `public/*`, and `config.guangzhou.json` to remote `111.230.62.106:/opt/webrtc-p2p-video-gz`.
- Installed `config.guangzhou.json` as remote `config.json`, so `/api/config` returns `stun:p2p-gz.dlcourse.online:3478` and `turn:p2p-gz.dlcourse.online:3478?transport=udp/tcp`.
- Restarted only `webrtc-p2p-video-gz.service`.
- Updated the master handoff index to mark `p2p-gz.dlcourse.online` as the current Guangzhou public P2P entry and keep `p2p-gz.cityulive.com` as blocked/not-for-use until its Tencent webblock/ICP issue is resolved.
- This change is Guangzhou P2P-video-only. It does not modify Hong Kong P2P, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, hosted console UI, desktop EXE, or `18081` routing.

Changed files / external paths:

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
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Remote `systemctl is-active webrtc-p2p-video-gz.service nginx coturn` returned `active`, `active`, `active`.
- Remote `curl -s http://127.0.0.1:8099/api/config` returned `p2p-gz.dlcourse.online` STUN/TURN entries.
- Public `https://p2p-gz.dlcourse.online/api/config` returned HTTP 200 with `p2p-gz.dlcourse.online` STUN/TURN entries.
- Public `https://p2p-gz.dlcourse.online/api/rooms` returned HTTP 200 and `rooms: []`.
- Public `https://p2p-gz.dlcourse.online/watch.html?room=robot` returned HTTP 200.
- Public `https://p2p-gz.dlcourse.online/shared.js` contains `VIEWER_FRAME_STALL_MS = 4000`, `VIEWER_RECONNECT_COOLDOWN_MS = 2000`, and `viewer-reconnect`.

Runtime/cloud impact:

- Restarted only `webrtc-p2p-video-gz.service`.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

## 104. P2P New Server Deployment Guide

Date:

- 2026-07-08 20:32

Scope:

- Added a step-by-step Markdown guide for deploying the current P2P video service on another server.
- The guide covers domain DNS, cloud security group ports, Ubuntu package installation, uploading `webrtc-p2p-video`, editing `config.json`, creating `webrtc-p2p-video.service`, nginx HTTPS reverse proxy, coturn STUN/TURN setup, service validation, `p2p-local-pusher` configuration, watch URL validation, room status APIs, and troubleshooting.
- The document uses placeholders such as `p2p-new.example.com` and `SERVER_PUBLIC_IP` so a teammate can adapt it to a new server.
- This change is documentation-only. It does not modify Cloud Service Console UI/backend, desktop EXE, hosted console, P2P signaling server code, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files:

- `docs\P2P_VIDEO_NEW_SERVER_DEPLOYMENT_GUIDE.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- Reviewed current external `E:\Desktop\123\webrtc-p2p-video` structure and `config.json`.
- Reviewed current external `E:\Desktop\123\p2p-local-pusher\config\pusher.config.json` shape.
- Verified the new guide contains key deployment topics: `p2p-new.example.com`, `SERVER_PUBLIC_IP`, `webrtc-p2p-video.service`, `coturn`, `p2p-local-pusher`, `/api/config`, `watch.html`, and TURN relay port range `49152-49200`.

Runtime/cloud impact:

- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed.

## 103. P2P File Transfer Room Auto Reset

Date:

- 2026-07-07 12:25

Scope:

- Added short-lifecycle room cleanup to the standalone P2P file-transfer tool.
- Sender or receiver waiting alone now times out after `advanced.peerWaitTimeoutSeconds`, default 60 seconds.
- On single-side wait timeout, the script requests `/api/rooms/<room>/reset` on the P2P signaling server before exiting.
- After successful transfer and receiver verification, both sides request room reset before exiting.
- Added README guidance that file-transfer rooms should be dedicated, for example `robot-file`.
- Recreated `file_transfer.config.json` as a compatible shared-config template with the same 60-second wait timeout.
- This change is external-script-only. It does not modify Cloud Service Console UI/backend, desktop EXE, hosted console, P2P signaling server, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\sender.config.json`
- External `E:\Desktop\123\p2p-file-transfer\config\receiver.config.json`
- External `E:\Desktop\123\p2p-file-transfer\config\file_transfer.config.json`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- Loaded sender, receiver, and shared template configs successfully; all use `peerWaitTimeoutSeconds: 60`.
- Receiver-only timeout smoke test in room `codex-timeout-reset-8d21e68b` with a 3-second temporary timeout exited with error and logged `Room reset requested`; public status returned `peers: []` and `messageCount: 0`.
- End-to-end completion smoke test in room `codex-complete-reset-4420cf24` transferred a 40.0 KB file, both processes exited `0`, SHA-256 matched, both logged room reset, and public status returned `peers: []` and `messageCount: 0`.

Runtime/cloud impact:

- No cloud runtime changed or restarted.
- The scripts call the existing P2P signaling reset API at runtime for their file-transfer room.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed for this fix.

## 102. P2P File Transfer Windows Path Config Fix

Date:

- 2026-07-07 12:19

Scope:

- Fixed the standalone P2P file-transfer config usability issue where Windows paths with single backslashes caused `Invalid \escape`.
- Updated current sender and receiver configs to use forward-slash Windows paths.
- Added tolerant parsing for `sendPath`, `sendFile`, and `saveDir` so pasted Windows paths such as `E:\Desktop\123` are accepted in those path fields.
- Updated README to recommend forward slashes while noting that plain backslashes are accepted for path fields.
- This change is external-script-only. It does not modify Cloud Service Console UI/backend, desktop EXE, hosted console, P2P signaling server, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\sender.config.json`
- External `E:\Desktop\123\p2p-file-transfer\config\receiver.config.json`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- Loaded `sender.config.json` and `receiver.config.json` successfully.
- Loaded a temporary config containing single-backslash Windows paths such as `D:\test\abc.txt` and `E:\Desktop\123` successfully.

Runtime/cloud impact:

- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed for this fix.

## 101. P2P File Transfer Split Configs

Date:

- 2026-07-07 12:03

Scope:

- Split the standalone P2P file-transfer config into separate sender and receiver configs.
- Sender defaults to `E:\Desktop\123\p2p-file-transfer\config\sender.config.json`.
- Receiver defaults to `E:\Desktop\123\p2p-file-transfer\config\receiver.config.json`.
- Updated Windows and Linux/macOS start scripts so `send_file.*` reads sender config and `receive_file.*` reads receiver config.
- Updated the Python CLI defaults so `file_transfer.py send` uses sender config and `file_transfer.py receive` uses receiver config when `--config` is omitted.
- Kept `file_transfer.config.json` as a compatible shared-config template only.
- This change is external-script-only. It does not modify Cloud Service Console UI/backend, desktop EXE, hosted console, P2P signaling server, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\sender.config.json`
- External `E:\Desktop\123\p2p-file-transfer\config\receiver.config.json`
- External `E:\Desktop\123\p2p-file-transfer\send_file.cmd`
- External `E:\Desktop\123\p2p-file-transfer\send_file.sh`
- External `E:\Desktop\123\p2p-file-transfer\receive_file.cmd`
- External `E:\Desktop\123\p2p-file-transfer\receive_file.sh`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py send --help`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py receive --help`
- Local end-to-end smoke test with separate sender/receiver configs in room `codex-split-config-32237724`.
- Smoke test transferred a 36.0 KB file, both processes exited `0`, and source/received SHA-256 matched.

Runtime/cloud impact:

- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed for this fix.

## 100. P2P File Transfer Folder Packaging

Date:

- 2026-07-07 11:47

Scope:

- Updated the standalone P2P file-transfer tool so the sender can send either a single file or a folder.
- Added `sendPath` as the primary sender config field; old `sendFile` remains supported for compatibility.
- Added `packFolder`; when true, a folder in `sendPath` is packed into a temporary zip before transfer.
- Folder transfer saves on the receiver as `folder-name.zip`; the receiver does not auto-extract the zip.
- Sender and receiver can safely share one config file: sender-only fields such as `sendPath` are ignored by the receiver, and receiver-only fields such as `saveDir` are ignored by the sender.
- This change is external-script-only. It does not modify Cloud Service Console UI/backend, desktop EXE, hosted console, P2P signaling server, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

- External `E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- External `E:\Desktop\123\p2p-file-transfer\config\file_transfer.config.json`
- External `E:\Desktop\123\p2p-file-transfer\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py send --help`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py receive --help`
- Local end-to-end folder smoke test in room `codex-folder-smoke-6bc2197c`.
- Smoke test packed a folder with nested files and an empty directory, transferred `source_folder.zip`, both processes exited `0`, and the received zip contents matched the source folder.

Runtime/cloud impact:

- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed for this fix.

## 99. Standalone P2P File Transfer Scripts

Date:

- 2026-07-07 11:32

Scope:

- Added a standalone P2P file-transfer tool at `E:\Desktop\123\p2p-file-transfer`.
- The tool uses a dedicated WebRTC `file-transfer` DataChannel and reuses the existing P2P signaling server only for room pairing and SDP exchange.
- Sender and receiver can start in either order. Both sides join the same room; the sender creates the offer and the receiver answers.
- Sender shows file hashing, connection status, send speed, percentage, ETA, and progress bar.
- Receiver shows waiting status, incoming file metadata, receive speed, percentage, ETA, progress bar, output path, and SHA-256 verification result.
- File transfer is isolated from video and control DataChannels by using its own WebRTC peer connection.
- This change is external-script-only. It does not modify Cloud Service Console UI/backend, desktop EXE, hosted console, P2P signaling server, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

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
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py`
- `python E:\Desktop\123\p2p-file-transfer\scripts\file_transfer.py --help`
- Local end-to-end smoke test with one receiver process and one sender process in room `codex-file-smoke-4b3299f4`.
- Smoke test transferred a 48.8 KB file through the P2P signaling room, both sides exited `0`, and source/received SHA-256 matched.

Runtime/cloud impact:

- No cloud runtime changed or restarted.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed for this fix.

## 98. P2P Signaling Peer Auto-Expire

Date:

- 2026-07-02 11:55

Scope:

- Added an automatic peer-expire mechanism to the P2P signaling server so stale viewer/pusher peer records are removed from room status after they stop sending heartbeats.
- Default `peerTtlSeconds` is 60 seconds; active pusher freshness remains controlled by the existing 15-second `pusherTtlSeconds`.
- Peer pruning now runs when listing active rooms, reading room status, publishing messages, and handling long-poll message heartbeats.
- This fixes stale viewer counts such as old `robot111` peers remaining visible after all viewers have already closed.
- This change is P2P signaling/status only. It does not change WebRTC media transport, legacy go2rtc ingest, Tencent Cloud Live, control signaling, Tank Trouble, hosted console UI, desktop EXE, public ports, domains, or cloud service names.

Changed files / external paths:

- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/server.py`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/server.py`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- Deployed to Hong Kong P2P signaling and restarted only `webrtc-p2p-video.service`; `systemctl is-active` returned `active`.
- Deployed to Guangzhou P2P signaling and restarted only `webrtc-p2p-video-gz.service`; `systemctl is-active` returned `active`.
- `https://p2p.cityulive.com/api/rooms/robot111/status` returned `peers: []`, `messageCount: 0`, and inactive pusher after pruning.
- `https://p2p.cityulive.com/api/rooms` returned `rooms: []`.
- `https://p2p-gz.dlcourse.online/api/config` and `https://p2p-gz.dlcourse.online/api/rooms` returned HTTP 200 with valid JSON.

Runtime/cloud impact:

- Restarted only `webrtc-p2p-video.service` and `webrtc-p2p-video-gz.service`.
- No desktop EXE rebuild, no hosted console redeploy, no GitHub push, and no tag update were performed for this fix.

## 97. P2P Script Live Relay No-Backlog Fix

Date:

- 2026-06-05 12:56

Scope:

- User observed a clear pattern: with script `h264`, a newly opened viewer starts several seconds behind and fast-forwards until live; with `h264_amf`, it starts more than 30 seconds behind and can freeze before catching up.
- Root cause identified in the standalone P2P script path: `MediaRelay.subscribe(...)` used aiortc's default buffered mode, which can queue old frames per viewer and make new viewers replay backlog.
- Changed script viewer track subscription to `self.relay.subscribe(self.player.video, buffered=False)`, so each viewer receives the newest live frame instead of draining an old frame queue.
- Synced the fix to the active `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher` tree and the maintained `E:\Desktop\123\p2p-local-pusher` package.
- This change is P2P-script-only. It does not modify cloud P2P server assets, Cloud Service Console UI code, desktop EXE, legacy go2rtc ingest, Tencent Cloud Live behavior, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- Confirmed both script trees now use `buffered=False` for viewer track relay.
- Rebuilt `E:\Desktop\123\p2p-local-pusher.zip`.

Runtime/cloud impact:

- Existing standalone P2P pusher processes must be stopped and started again before they load the no-backlog relay fix.
- No cloud runtime changed or restarted.
- No desktop EXE rebuild and no hosted console redeploy were performed for this fix.

## 96. P2P Script Periodic Keyframe And Faster Viewer Recovery

Date:

- 2026-06-05 12:44

Scope:

- Reviewed the provided phone recording at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\video\2026-06\ca460d45342ba0378a27d1ad53b28fd0.mp4`.
- The recording shows the real wall clock continues while the monitor's P2P video frame freezes, then recovers after reconnect. This points to viewer decode / keyframe recovery rather than a bad phone recording.
- Added a one-second periodic keyframe safety interval inside the standalone script pusher H.264 encoder path.
- Preserved frame `pts` / `time_base` after reformatting frames before encoding, so timestamp continuity is less likely to be disturbed by scaling or pixel-format conversion.
- Set GOP size to about one second and disabled B-frames when the PyAV codec context exposes those fields.
- Shortened the P2P watch-page frozen-frame watchdog from about 12 seconds to about 4 seconds and reduced reconnect cooldown from about 6 seconds to about 2 seconds.
- Synced the pusher script fix to the active `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher` tree, the maintained `E:\Desktop\123\p2p-local-pusher` tree, and refreshed `E:\Desktop\123\p2p-local-pusher.zip`.
- This change is P2P-video-only. It does not modify Cloud Service Console UI code, desktop EXE, legacy go2rtc ingest, Tencent Cloud Live behavior, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/public/shared.js`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/public/shared.js`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Rebuilt `E:\Desktop\123\p2p-local-pusher.zip`.
- Deployed `shared.js` to Hong Kong and Guangzhou P2P signaling services.
- Remote `systemctl is-active webrtc-p2p-video.service` returned `active`.
- Remote `systemctl is-active webrtc-p2p-video-gz.service` returned `active`.
- Public `https://p2p.cityulive.com/shared.js` and `https://p2p-gz.dlcourse.online/shared.js` contain `VIEWER_FRAME_STALL_MS = 4000` and `VIEWER_RECONNECT_COOLDOWN_MS = 2000`.

Runtime/cloud impact:

- Restarted only `webrtc-p2p-video.service` and `webrtc-p2p-video-gz.service`.
- Existing standalone P2P pusher processes must be stopped and started again before they load the periodic-keyframe fix.
- No desktop EXE rebuild and no hosted console redeploy were performed for this fix.

## 95. P2P Script Keyframe Startup Fix

Date:

- 2026-06-05 12:08

Scope:

- Investigated the standalone P2P local script behavior where a newly opened viewer could freeze on the first frame or show black while an older viewer kept playing.
- Changed the P2P watch page freeze detector so incoming bytes alone no longer count as video progress; only video time or decoded frame growth keeps the viewer marked healthy.
- Updated the active standalone script pusher at `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher` to request keyframes from the actual aiortc `RTCRtpSender`.
- Added a short keyframe burst when each viewer connection is created: immediate, 0.3s, 0.8s, 1.6s, and 3.0s.
- Synced the same script fix to `E:\Desktop\123\p2p-local-pusher` and refreshed `E:\Desktop\123\p2p-local-pusher.zip`.
- This change is P2P-video-only. It does not modify the Cloud Service Console UI bundle, desktop EXE, legacy go2rtc ingest, Tencent Cloud Live protocol behavior, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/public/shared.js`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/public/shared.js`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher-0605\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Public `https://p2p.cityulive.com/api/rooms` and `https://p2p-gz.dlcourse.online/api/rooms` returned `ok: true`.
- Remote deployed `shared.js` on both P2P servers contains `VIEWER_FRAME_STALL_MS` and no longer contains `viewerLastBytesReceived`.
- Existing chain services stayed active after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.

Runtime/cloud impact:

- Restarted only `webrtc-p2p-video.service` and `webrtc-p2p-video-gz.service`.
- Existing already-running standalone pusher processes must be stopped and started again before they load the keyframe burst fix.
- No desktop EXE rebuild and no hosted console redeploy were performed for this fix.

## 94. P2P Viewer Freeze Auto-Reconnect

Date:

- 2026-06-05 01:46

Scope:

- Added P2P watch-page self-healing for the case where WebRTC still reports `connected` but video frames stop advancing.
- The P2P viewer now watches video time / decoded frames / received bytes and automatically reconnects if no video progress is detected for about 12 seconds.
- The viewer also runs an immediate check when the tab becomes visible again, which helps with browser background throttling / idle-tab stalls.
- Added a `viewer-reconnect` signal so browser pushers and standalone local script pushers can clear the old peer connection and send a fresh offer.
- Synchronized the standalone P2P local pusher package so the script-side pusher accepts `viewer-reconnect` and `viewer-offline`.
- This change is P2P-video-only. It does not change legacy go2rtc ingest, Tencent Cloud Live protocol behavior, control signaling, Tank Trouble, public ports, domains, or service names.

Changed files / external paths:

- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/public/shared.js`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/public/shared.js`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`

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

Runtime/cloud impact:

- Restarted only `webrtc-p2p-video.service`, `webrtc-p2p-video-gz.service`, and `cloud-service-console-web.service`.
- Existing chain services stayed active after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- Existing already-running standalone pusher processes must be stopped and started again before they load the new `viewer-reconnect` handling.

## 93. Overview P2P Room Status

Date:

- 2026-06-05 01:19

Scope:

- Added P2P status to the overview `视频推流状态` card.
- The card now shows three video modes: `旧链路`, `腾讯云`, and `P2P`.
- P2P status uses the current P2P signaling domain's `/api/rooms` list to count actively streaming rooms.
- If at least one P2P room has an active pusher, the P2P lamp turns green and shows the room count.
- If the active P2P pusher includes this console / local app, the P2P lamp turns blue.
- The existing 5-second video status polling and manual refresh now also refresh the P2P room summary.
- This change reuses the existing P2P signaling room-discovery API and does not add a new cloud endpoint.

Changed files / external paths:

- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.com/api/health` with admin bearer token returned `backend-ready`.
- Public `https://p2p.cityulive.com/api/rooms` returned `ok: true` with the active `robot` room.
- Local built JS contains P2P room-status strings such as `P2P推流`, `多链路推流`, and `个房间`.

Runtime/cloud impact:

- Hosted web console restarted only `cloud-service-console-web.service`.
- Existing chain services stayed active before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc legacy video service, Tencent Cloud Live protocol behavior, control signaling service, Tank Trouble service, public port, domain, or cloud service name changed.

## 92. Web Push Panel Mutual Exclusion

Date:

- 2026-06-05 01:09

Scope:

- Fixed the local-stream web push mode panels so Tencent Cloud push and P2P push do not stay open at the same time.
- Opening the Tencent Cloud push-code dialog now closes the P2P panel first.
- Submitting a valid Tencent Cloud push code also closes the P2P panel before opening the Tencent Cloud panel.
- Opening the P2P panel now closes the Tencent Cloud panel first.
- If one web push mode is busy or actively pushing, the other mode's entry button is disabled instead of opening a second panel.
- This is UI state coordination only; no video protocol, service endpoint, cloud port, or health/status API behavior changed.

Changed files / external paths:

- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.com/api/health` with admin bearer token returned `backend-ready`.
- Public fallback `http://150.109.100.30:18080/api/health` with admin bearer token returned `backend-ready`.

Runtime/cloud impact:

- Hosted web console restarted only `cloud-service-console-web.service`.
- Existing chain services stayed active before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc legacy video service, Tencent Cloud Live protocol behavior, control signaling service, Tank Trouble service, public port, domain, or cloud service name changed.

## 91. Viewer Resolution Single Input

Date:

- 2026-06-04 22:57

Scope:

- Fixed the local-stream `观看分辨率` editor so width/height are edited in one `WIDTHxHEIGHT` input instead of two adjacent number inputs.
- This prevents drag-selecting the height value from accidentally landing focus in the width input and typing into the wrong field.
- The field accepts `1920x1080`, `1920×1080`, `1920*1080`, or whitespace-separated width/height, and normalizes back to `WIDTHxHEIGHT` on blur.
- The single viewer resolution still writes both `video_size` and `output_video_size`, preserving the viewer-facing mapping from the previous change.
- Removed the unused two-column dimension CSS for this local-stream control.
- Rebuilt desktop EXE/backend sidecar, refreshed installers, and redeployed the hosted web console.

Changed files / external paths:

- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Local built JS contains `观看分辨率`; old `观看宽度` / `观看高度` inputs are absent.
- Public fallback health `http://150.109.100.30:18080/api/health` with admin bearer token returned `backend-ready`.
- Public HTTPS domain check from this machine could not resolve `console.cityulive.com`; server-side deploy health check still passed.

Runtime/cloud impact:

- Hosted web console restarted only `cloud-service-console-web.service`.
- Existing chain services stayed active before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc legacy video service, Tencent Cloud Live protocol behavior, control signaling service, Tank Trouble service, public port, domain, or cloud service name changed.

## 90. Viewer-Facing Local Push Parameters

Date:

- 2026-06-04 22:41

Scope:

- Simplified the local push parameter UI so users only edit viewer-facing video settings.
- Replaced separate `采集分辨率` / `输出分辨率` with one `观看分辨率`.
- Replaced separate `采集帧率` / `目标帧率` with one `观看帧率`.
- Internally, the single viewer resolution now writes both `video_size` and `output_video_size`; the single viewer frame rate now writes both `input_framerate` and `target_framerate`.
- This keeps legacy local push, Tencent Cloud web push, browser P2P push, and desktop P2P local-script push compatible with the existing config schema while hiding unnecessary capture/output implementation detail from users.
- Rebuilt desktop EXE/backend sidecar, refreshed the installer, and redeployed the hosted web console.

Changed files / external paths:

- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx docs\VIDEO_LINK_AGENT.md frontend\IMPLEMENTATION_LOG.md docs\SHARED_AGENT_STATUS.md`
- Local built JS contains `观看分辨率`; old labels `采集分辨率`, `输出分辨率`, `采集帧率`, and `目标帧率` are absent.
- Public console asset `/assets/index-C-xd6pIw.js` contains `观看分辨率` / `观看帧率` and no longer contains the old four labels.
- Public `https://console.cityulive.com/api/health?access_token=xhfang` returned `backend-ready`.

Runtime/cloud impact:

- Hosted web console restarted only `cloud-service-console-web.service`.
- Existing chain services stayed active before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc legacy video service, Tencent Cloud Live protocol behavior, control signaling service, Tank Trouble service, public port, domain, or cloud service name changed.

## 89. P2P Local Pusher Classmate Compatibility Sync

Date:

- 2026-06-02 21:35

Scope:

- Synced the useful fixes from the classmate-tested `p2p-local-pusher-0602` copy back into the currently maintained external P2P local pusher script.
- Linux camera enumeration now pushes loopback / virtual devices such as `v4l2loopback`, `loopback`, and `/dev/video20` behind physical cameras.
- Setup now preserves an explicitly requested physical camera name more reliably on Linux instead of falling back to a virtual device.
- Setup now treats an existing but unusable copied Python virtual environment as invalid and recreates it.
- Kept the current generic config; did not copy the classmate machine-specific `/dev/v4l/by-id/...`, conda FFmpeg path, or runtime state.
- Updated the clean distributable zip under `E:\Desktop\123`.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\setup_local.py`
- External `E:\Desktop\123\p2p-local-pusher.zip`
- Backup `E:\Desktop\123\p2p-local-pusher.zip.bak-20260602213522`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\setup_local.py`
- `python -m py_compile E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\setup_local.py E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\stop_local.py E:\wsl\p2p-local-pusher-0601\p2p-local-pusher\scripts\supervisor.py`
- Confirmed the clean zip contains 14 user-facing files and includes the updated `scripts/common.py`, `scripts/setup_local.py`, and unchanged generic `config/pusher.config.json`.
- Compared against `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-06\p2p-local-pusher-0602`; `setup_local.py` matches, and `common.py` contains the same compatibility fix plus a safer pre-defined camera-name lookup.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No EXE, installer, hosted web console, cloud service, public port, domain, go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, or Tank Trouble service changed.
- Impact is limited to future users of the external P2P local pusher script/package.

## 88. P2P Viewer Room Picker

Date:

- 2026-06-02 01:11

Scope:

- Added `GET /api/rooms` to the standalone P2P signaling service. The endpoint lists only rooms with a currently active pusher, filtered by the existing pusher TTL.
- Changed the console P2P "网页端观看" flow from manual URL entry to a room picker for the current P2P domain.
- The picker uses the origin from the current P2P link, ignores the currently typed room suffix, and displays clickable room IDs. If the domain has no active pusher, it shows "当前没有正在推流的房间".
- Rebuilt desktop app/backend sidecar, copied them to `E:\Cloud-Service-Console`, refreshed the installer, redeployed the hosted web console, and deployed the P2P signaling update to Hong Kong and Guangzhou P2P services.

Changed files / external paths:

- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/server.py`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/server.js`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/server.py`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/server.js`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `node --check E:\Desktop\123\webrtc-p2p-video\server.js`
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- Local Node smoke test for `GET /api/rooms`: no active room returned `0`, simulated `smoke-room` pusher returned one room.
- Remote `python3 -m py_compile /opt/webrtc-p2p-video/server.py` and `/opt/webrtc-p2p-video-gz/server.py`.
- Public `https://p2p.cityulive.com/api/rooms` returned active rooms, including the currently active `robot-clean-01` room during validation.
- Public `https://p2p-gz.dlcourse.online/api/rooms` returned `ok: true` with an empty room list during validation.
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public console asset check found `选择 P2P 房间`, `当前没有正在推流的房间`, and `/api/rooms`, and no longer found old `P2P 观看链接` text.
- `https://console.cityulive.com/api/health?access_token=xhfang` returned `backend-ready`.

Runtime/cloud impact:

- Restarted only `webrtc-p2p-video.service`, `webrtc-p2p-video-gz.service`, and `cloud-service-console-web.service`.
- Existing cloud chain services remained active after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- Guangzhou checks also kept `cloud-service-console-tank-trouble` active.
- No go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble logic, public port, domain, or cloud service name changed.

## 87. P2P Viewer Count Card Removed

Date:

- 2026-05-29 17:41

Scope:

- Removed the top P2P "房间观看端" viewer-count card from the local-stream P2P panel.
- Removed the lower inline viewer refresh button; the lower P2P status strip now only shows the live lamp and current push message.
- Removed the now-unused manual P2P room viewer count state, fetch helper, and CSS classes.
- Rebuilt desktop app/backend sidecar, copied them to `E:\Cloud-Service-Console`, refreshed the installer, and redeployed the hosted web console.

Changed files / external paths:

- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public console asset check confirmed no `房间观看端` text and no `p2p-viewer-refresh` class remain; `p2p-push-status-row` remains.

Runtime/cloud impact:

- Hosted web console restarted only `cloud-service-console-web.service`.
- Existing cloud chain services remained active before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, public port, domain, or cloud service name changed.

## 86. P2P Viewer Refresh Button Placement

Date:

- 2026-05-29 17:03

Scope:

- Moved the P2P room viewer-count refresh action out of the large "房间观看端" stat card.
- Added a compact refresh button inside the lower P2P status strip, aligned with the left status lamp and current status message.
- Kept the top stat card as a read-only count/time display.
- Rebuilt desktop app/backend sidecar, copied them to `E:\Cloud-Service-Console`, refreshed the installer, and redeployed the hosted web console.

Changed files / external paths:

- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public console asset check found `p2p-push-status-row` and `p2p-viewer-refresh-button-inline`.

Runtime/cloud impact:

- Hosted web console restarted only `cloud-service-console-web.service`.
- Existing cloud chain services remained active before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No P2P signaling service, go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, public port, domain, or cloud service name changed.

## 85. P2P Viewer Offline Cleanup

Date:

- 2026-05-29 16:20

Scope:

- Fixed stale P2P viewer counts after users close all watch pages.
- P2P watch pages now send a `viewer-offline` signal on manual stop, `pagehide`, and `beforeunload`.
- The P2P signaling server now removes peers from room status when it receives `viewer-offline` or `pusher-offline`.
- The console P2P pusher now closes and removes a viewer peer connection when it receives `viewer-offline`.
- The manual room viewer count freshness window was shortened from 45 seconds to 12 seconds as a fallback for abnormal browser closes.
- Rebuilt desktop app/backend sidecar, copied them to `E:\Cloud-Service-Console`, refreshed the installer, redeployed hosted web console, and deployed the P2P signaling/static-page fix to both Hong Kong and Guangzhou P2P services.

Changed files / external paths:

- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Remote `150.109.100.30:/opt/webrtc-p2p-video`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz`
- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`

Validation:

- `node --check E:\Desktop\123\webrtc-p2p-video\server.js`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- `cmd /c npm --prefix frontend run build`
- Deployed P2P service files to HK and GZ; both P2P services returned `active`.
- Existing HK services remained active: `webrtc-p2p-video`, `nginx`, `coturn`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, and `cloud-service-console-web`.
- Existing GZ services remained active: `webrtc-p2p-video-gz`, `nginx`, `coturn`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `cloud-service-console-web`, and `cloud-service-console-tank-trouble`.
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://p2p.cityulive.com/shared.js` and `https://p2p-gz.dlcourse.online/shared.js` contain `viewer-offline`, `notifyViewerOffline`, and `pagehide`.
- Public console asset contains `房间观看端` and `viewer-offline`.
- Temporary room API tests on both HK and GZ verified `viewer-ready` adds a peer and `viewer-offline` removes it immediately.
- Current `robot` room checks showed `freshViewers=0` on both HK and GZ after all watch pages were closed.

Runtime/cloud impact:

- Restarted only `webrtc-p2p-video.service`, `webrtc-p2p-video-gz.service`, and `cloud-service-console-web.service`.
- No public port, domain, cloud service name, go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, or Tank Trouble service changed.

## 84. P2P Console Manual Viewer Count Refresh

Date:

- 2026-05-29 15:51

Scope:

- Added a manual "房间观看端" refresh card to the P2P push panel in both hosted web console and desktop app frontend.
- The refresh button parses the current P2P full link, queries that link's signal domain at `/api/rooms/{room}/status`, and counts fresh viewer peers in the current room.
- Viewer count is intentionally manual-only; no continuous polling was added.
- The count filters out stale viewer entries by `lastSeenAt`, using a 45 second freshness window so old room history is not shown as active viewers.
- Renamed the existing live browser-side count label to "本页连接" to distinguish current pusher peer connections from room-wide viewer count.
- Rebuilt desktop app/backend sidecar, copied them to `E:\Cloud-Service-Console`, refreshed the installer, and redeployed the hosted web console.

Changed files / external paths:

- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `cmd /c npm --prefix frontend run build`
- `Invoke-RestMethod https://p2p.cityulive.com/api/rooms/robot/status`
- `Invoke-RestMethod https://p2p-gz.dlcourse.online/api/rooms/robot/status`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.com/api/access?access_token=xhfang` returned admin role.
- Public `https://console.cityulive.com/api/access?access_token=cmc5006` returned user role.
- Public `https://console.cityulive.com/api/health?access_token=xhfang` returned `backend-ready`.
- Public web index references `/assets/index-DdhrQnAv.js`; deployed JS contains `房间观看端`, `手动刷新后显示当前房间观看人数`, and `本页连接`.

Runtime/cloud impact:

- Hosted web console restarted only `cloud-service-console-web.service`.
- Existing cloud chain services remained active before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, public port, domain, cloud service name, or cloud video protocol changed.

## 83. P2P Console Full Watch Link Input

Date:

- 2026-05-29 13:24

Scope:

- Changed the Cloud Service Console P2P panel from room-only input to full P2P watch-link input.
- Default P2P link is now `https://p2p.cityulive.com/watch.html?room=robot`.
- Browser P2P push parses the current link into signal domain and room, so push, signal reset, and viewer polling use the domain in the link.
- P2P viewer dialog now asks for a full watch link and defaults to the current push link; desktop local-script status uses its returned `watch_url`.
- Desktop app backend now accepts `watch_url` for P2P local-script start and writes both `signalBaseUrl` and `roomId` into the standalone pusher config.
- Web deploy script now defaults to the fixed access tokens `xhfang` and `cmc5006` to avoid accidental random-token redeploys.
- Rebuilt desktop app and backend sidecar, copied them to `E:\Cloud-Service-Console`, refreshed the installer, and redeployed the hosted web console.

Changed files / external paths:

- `backend\p2p_local_pusher.py`
- `backend\main.py`
- `frontend\src\api\cloudApi.ts`
- `frontend\src\pages\DashboardPage.tsx`
- `scripts\deploy_web_console.py`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- Local `E:\Cloud-Service-Console\Cloud Service Console.exe`
- Local `E:\Cloud-Service-Console\cloud-console-backend.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console Setup.exe`
- Local `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`
- Remote hosted web console under `150.109.100.30:/opt/cloud-service-console-web`

Validation:

- `python -m py_compile backend\p2p_local_pusher.py backend\main.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.com/api/access?access_token=xhfang` returned admin role.
- Public `https://console.cityulive.com/api/access?access_token=cmc5006` returned user role.
- Public `https://console.cityulive.com/api/health?access_token=xhfang` returned `backend-ready`.
- Public web index references `/assets/index-DnXflRo6.js`; deployed JS contains `P2P 链接` and `P2P 观看链接`.

Runtime/cloud impact:

- Hosted web console restarted only `cloud-service-console-web.service`.
- Existing cloud chain services remained active before and after deployment: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, and `coturn`.
- No go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, public port, domain, or cloud video protocol changed.

## 82. Standalone P2P Start Guard For Existing Background Processes

Date:

- 2026-05-29 12:59

Scope:

- Changed standalone local P2P `start_local` behavior so it refuses to start when any existing pusher background process is detected.
- The guard now runs before printing the requested config, so changed config values are not shown as if they were already applied.
- The prompt explicitly lists existing PID(s), says no new push was started, and tells the user to run `stop_local` before `start_local`.
- Removed the confusing existing-process branch that printed the old active push details under the new config attempt.
- Refreshed the distributable standalone package at `E:\Desktop\123\p2p-local-pusher.zip`.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `$env:P2P_NO_PAUSE='1'; cmd /c E:\wsl\p2p-local-pusher\start_local.cmd`
- Verified existing background processes produce a blocking prompt and no new pusher is started.

Runtime/cloud impact:

- Affects only the standalone local P2P pusher start script.
- No cloud service, public port, domain, go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, hosted web console, or desktop EXE changed.

## 81. Standalone P2P Pusher Fallback Output Alignment

Date:

- 2026-05-29 12:22

Scope:

- Fixed the standalone local P2P pusher so automatic fallback no longer keeps a hidden requested output size after the camera falls back to another usable mode.
- When `640x480@60` fails, the pusher now tries same-resolution lower FPS modes such as `640x480@30` before jumping to larger fallback resolutions.
- The active state and terminal output now show the actual selected capture and output mode; after fallback, WebRTC encoding and browser viewing use that same selected mode.
- Preserved `config/pusher.config.json` `user` settings as the next-start preferred target, while writing the actual selected runtime profile only to `runtime/pusher.active.config.json` and state.
- Refreshed the distributable standalone package at `E:\Desktop\123\p2p-local-pusher.zip`.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\supervisor.py E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `$env:P2P_NO_PAUSE='1'; cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd; cmd /c E:\wsl\p2p-local-pusher\start_local.cmd`
- Verified start output: requested `640x480 @ 60 fps`, then active push selected `Capture 640x480 @ 30 fps` and `Output 640x480 @ 30 fps`.
- Verified `runtime\pusher.state.json` reports `captureWidth=640`, `captureHeight=480`, `captureFps=30`, `outputWidth=640`, `outputHeight=480`, and `fps=30`.

Runtime/cloud impact:

- Affects only the standalone local P2P pusher package.
- No cloud service, public port, domain, go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, hosted web console, or desktop EXE changed.

## 80. Guangzhou P2P dlcourse.online Public Entry

Date:

- 2026-05-29 11:39

Scope:

- Added a working Guangzhou public P2P HTTPS entry using `p2p-gz.dlcourse.online`.
- DNS resolved to `111.230.62.106`, and TCP `80`, `443`, and `3478` were reachable.
- Added Nginx config `/etc/nginx/conf.d/webrtc-p2p-video-gz-dlcourse.conf`.
- Issued a Let's Encrypt certificate for `p2p-gz.dlcourse.online`.
- Switched Guangzhou P2P ICE/TURN config to `p2p-gz.dlcourse.online`.
- Restarted only `webrtc-p2p-video-gz.service` and reloaded Nginx.

Changed files / external paths:

- External `E:\Desktop\123\webrtc-p2p-video\config.guangzhou.json`
- Remote `111.230.62.106:/etc/nginx/conf.d/webrtc-p2p-video-gz-dlcourse.conf`
- Remote `111.230.62.106:/etc/letsencrypt/live/p2p-gz.dlcourse.online/fullchain.pem`
- Remote `111.230.62.106:/etc/letsencrypt/live/p2p-gz.dlcourse.online/privkey.pem`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/config.json`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `Resolve-DnsName p2p-gz.dlcourse.online -Type A` returned `111.230.62.106`.
- `Test-NetConnection p2p-gz.dlcourse.online -Port 80`, `443`, and `3478` succeeded.
- Certbot issued the certificate; expiry is `2026-08-27`.
- Remote `nginx -t` passed.
- Remote `curl -fsS http://127.0.0.1:8099/api/config` returned STUN + TURN using `p2p-gz.dlcourse.online`.
- Public `curl.exe -fsS https://p2p-gz.dlcourse.online/api/config` returned STUN + TURN.
- Public `https://p2p-gz.dlcourse.online/watch.html?room=robot` returned `200 OK`.
- Public `http://p2p-gz.dlcourse.online/watch.html?room=robot` returned `301` to HTTPS.
- Existing services remained active: `webrtc-p2p-video-gz`, `coturn`, `nginx`, `cloud-service-console-tank-trouble`, `go2rtc-control-signaling`, `go2rtc-cloud`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`, and `cloud-service-console-web`.

Runtime/cloud impact:

- Guangzhou P2P now has a public working entry: `https://p2p-gz.dlcourse.online/`.
- Guangzhou P2P watch URL: `https://p2p-gz.dlcourse.online/watch.html?room=robot`.
- Cloud changed only Guangzhou P2P Nginx host config and P2P signaling config.
- Nginx was reloaded and only `webrtc-p2p-video-gz.service` was restarted.
- Reused existing coturn config and did not restart coturn.
- No Hong Kong P2P config, go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, hosted web console behavior, or `18081` routing changed.

## 79. Guangzhou P2P TURN Fallback Sync

Date:

- 2026-05-29 10:50

Scope:

- Synced the Guangzhou standalone P2P video signaling config with the Hong Kong TURN fallback pattern.
- Added Guangzhou-local STUN/TURN entries: `stun:p2p-gz.cityulive.com:3478`, `turn:p2p-gz.cityulive.com:3478?transport=udp`, and `turn:p2p-gz.cityulive.com:3478?transport=tcp`.
- Reused existing Guangzhou coturn credentials: username `telemetry`, credential `123456`.
- Restarted only `webrtc-p2p-video-gz.service`.
- Created local reference config `E:\Desktop\123\webrtc-p2p-video\config.guangzhou.json`.

Changed files / external paths:

- External `E:\Desktop\123\webrtc-p2p-video\config.guangzhou.json`
- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz/config.json`
- Remote backup `111.230.62.106:/opt/webrtc-p2p-video-gz/config.json.bak-before-turn-*`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m json.tool E:\Desktop\123\webrtc-p2p-video\config.guangzhou.json`.
- Remote `python3 -m json.tool /opt/webrtc-p2p-video-gz/config.json`.
- Remote `systemctl restart webrtc-p2p-video-gz.service`.
- Remote `curl -fsS http://127.0.0.1:8099/api/config` returned STUN + TURN.
- Server-local HTTPS Host-header check returned STUN + TURN through Nginx.
- `Test-NetConnection p2p-gz.cityulive.com -Port 3478` succeeded for TCP.
- Existing services remained active: `webrtc-p2p-video-gz`, `coturn`, `nginx`, `cloud-service-console-tank-trouble`, `go2rtc-control-signaling`, `go2rtc-cloud`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`, and `cloud-service-console-web`.

Runtime/cloud impact:

- Cloud changed only the Guangzhou P2P signaling config and restarted only `webrtc-p2p-video-gz.service`.
- Reused existing coturn config and did not restart coturn.
- External public access caveat: direct external HTTP returned a Tencent DNSPod `webblock.html` redirect and external HTTPS handshakes were reset, while server-local HTTPS worked. The Guangzhou P2P service is configured but `p2p-gz.cityulive.com` may not be publicly usable until domain/ICP/access blocking is resolved.
- No Hong Kong P2P config, go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, hosted web console behavior, or `18081` routing changed.

## 78. Hong Kong P2P TURN Fallback For Remote Viewing

Date:

- 2026-05-29 10:28

Scope:

- Fixed the Hong Kong standalone P2P video signaling service config so remote-city viewers can fall back to TURN when direct P2P ICE fails.
- Root cause: `https://p2p.cityulive.com/api/config` only returned Google STUN, so cross-NAT / cross-ISP viewers could enter the room but fail to establish the media path.
- Added existing coturn relay entries to `iceServers`: `turn:p2p.cityulive.com:3478?transport=udp` and `turn:p2p.cityulive.com:3478?transport=tcp`, with username `telemetry` and credential `123456`.
- Kept STUN entries: `stun:p2p.cityulive.com:3478` and `stun:stun.l.google.com:19302`.
- Restarted only `webrtc-p2p-video.service`.
- Restarted the local standalone P2P pusher once so it loaded the new 2-server ICE config.

Changed files / external paths:

- External `E:\Desktop\123\webrtc-p2p-video\config.json`
- Remote `150.109.100.30:/opt/webrtc-p2p-video/config.json`
- Remote backup `150.109.100.30:/opt/webrtc-p2p-video/config.json.bak-before-turn-*`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- Local `python -m json.tool E:\Desktop\123\webrtc-p2p-video\config.json`.
- Remote `python3 -m json.tool /opt/webrtc-p2p-video/config.json`.
- Remote `systemctl restart webrtc-p2p-video.service`.
- Remote `curl -fsS http://127.0.0.1:8099/api/config` returned STUN + TURN.
- Public `curl.exe -fsS https://p2p.cityulive.com/api/config` returned STUN + TURN.
- `Test-NetConnection p2p.cityulive.com -Port 3478` succeeded for TCP.
- Existing services remained active: `webrtc-p2p-video`, `coturn`, `nginx`, `go2rtc-control-signaling`, `go2rtc-cloud`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`, and `cloud-service-console-web`.
- Local pusher restart log showed `Loaded signal config: 2 ICE server(s)`.

Runtime/cloud impact:

- Cloud changed only the Hong Kong P2P signaling config and restarted only `webrtc-p2p-video.service`.
- Reused existing coturn credentials/port `3478`; did not change coturn config or restart coturn.
- If remote-city viewing still fails, verify cloud security group/firewall allows the coturn relay range `20000-20199/udp,tcp`.
- No go2rtc legacy video service, Tencent Cloud Live behavior, control signaling service, Tank Trouble service, hosted web console behavior, or `18081` routing changed.

## 77. P2P Local Pusher Multi-Viewer H.264 Crash Fix

Date:

- 2026-05-29 10:05

Scope:

- Fixed the standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Root cause: Windows child process exited with `3221225477` / access violation in PyAV/libx264 H.264 encoding while two viewers were connected, causing the supervisor to restart the pusher and the camera light to blink on/off repeatedly.
- Added a process-wide H.264 encode lock so concurrent viewer sender threads do not enter PyAV/libx264 frame conversion/encoding at the same time.
- Increased the supervisor stable-runtime threshold from `20s` to `60s`, so crashes around 30 seconds are treated as unstable and can fall back to safer profiles instead of retrying the same crashing profile forever.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip` with the fixed scripts.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- External archive `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py`
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`
- Observed the pusher running for over one minute with two connected viewers.
- `supervisor.log` showed only one child start and no child exit.
- `pusher.err.log` remained empty.
- `pusher.out.log` showed continuous sender stats for both viewers with bitrate around `1.4-1.7 Mbps`, later spikes around `2.5-3.1 Mbps`.

Runtime/cloud impact:

- Local standalone P2P pusher behavior changed and was restarted for validation.
- Test pusher was left running in room `robot` after validation so the user can check the live picture.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, Tencent Cloud Live behavior, legacy go2rtc video behavior, or hosted web console behavior changed.

## 76. P2P Local Pusher Conservative Setup Defaults

Date:

- 2026-05-29 09:47

Scope:

- Updated the standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Changed fresh `setup_local` defaults to software `h264`, `1920x1080`, and `30fps`.
- Updated the current `config\pusher.config.json` user/video sections to the same defaults.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip` from a clean staging copy so shared packages use the same defaults.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External archive `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\setup_local.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- `python E:\wsl\p2p-local-pusher\scripts\setup_local.py --skip-pip`
- Confirmed config values: `preferredEncoder=h264`, `width=1920`, `height=1080`, `fps=30`.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or existing P2P signaling service changed.

## 75. Guangzhou P2P Signaling Test Service

Date:

- 2026-05-29 09:20

Scope:

- Deployed an isolated P2P WebRTC video signaling test service to Guangzhou server `111.230.62.106`.
- Added remote path `/opt/webrtc-p2p-video-gz` from local `E:\Desktop\123\webrtc-p2p-video`.
- Added systemd service `webrtc-p2p-video-gz.service`.
- Service listens only on `127.0.0.1:8099`; public access is through a new Nginx virtual host for `p2p-gz.cityulive.com` on port `80`.
- The new service uses room default `robot`, pusher TTL `15s`, long-poll timeout `5s`, normal message TTL `20s`, and `viewer-ready` TTL `8s`.
- Did not change existing legacy go2rtc video services, Tencent Cloud Live status/push code, control signaling, Tank Trouble, or the hosted console service.

Changed files / external paths:

- Remote `111.230.62.106:/opt/webrtc-p2p-video-gz`
- Remote `111.230.62.106:/etc/systemd/system/webrtc-p2p-video-gz.service`
- Remote `111.230.62.106:/etc/nginx/conf.d/webrtc-p2p-video-gz.conf`
- Local deploy archive `E:\Desktop\123\webrtc-p2p-video-gz-deploy.tar.gz`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`
- `docs\AGENT_HANDOFF_MASTER_INDEX.md`

Validation:

- `systemctl is-active webrtc-p2p-video-gz.service` returned `active`.
- Remote `curl -fsS http://127.0.0.1:8099/api/config` returned `ok: true`.
- Remote Host-header check `curl -fsS -H "Host: p2p-gz.cityulive.com" http://127.0.0.1/api/config` returned `ok: true`.
- Public Host-header check `curl.exe -fsS -H "Host: p2p-gz.cityulive.com" http://111.230.62.106/api/config` returned `ok: true`.
- Public Host-header check for `/watch.html?room=robot` returned `200 OK`.
- Existing `http://111.230.62.106:18086/health` returned Tank Trouble health JSON.
- Existing `http://111.230.62.106:18081/` returned `200 OK`.
- Remote service check showed `nginx`, `cloud-service-console-tank-trouble`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-srt-bridge`, and `go2rtc-telemetry-relay` all `active`.

Runtime/cloud impact:

- Guangzhou server now has an additional isolated P2P signaling service for testing latency against Hong Kong.
- New public DNS target to add: `p2p-gz.cityulive.com A 111.230.62.106`.
- HTTPS is not active yet. Public TCP `443` currently fails; after DNS is added and `443` is opened in the security group, issue a certificate and add HTTPS redirect/proxy for `p2p-gz.cityulive.com`.
- No old video chain, Tencent Cloud Live chain, control signal chain, Tank Trouble service, hosted console service, or shared `18081` gateway behavior was changed.

HTTPS follow-up:

- 2026-05-29 09:38: DNS resolved and TCP `443` was opened.
- Installed `certbot` on Guangzhou server and issued a Let's Encrypt certificate for `p2p-gz.cityulive.com`.
- Updated only `/etc/nginx/conf.d/webrtc-p2p-video-gz.conf` so HTTP redirects to HTTPS and HTTPS proxies to `127.0.0.1:8099`.
- Certificate path: `/etc/letsencrypt/live/p2p-gz.cityulive.com/fullchain.pem`.
- Private key path: `/etc/letsencrypt/live/p2p-gz.cityulive.com/privkey.pem`.
- Certificate expires on `2026-08-27`; certbot renewal timer is installed.
- Public `https://p2p-gz.cityulive.com/api/config` returned `ok: true`.
- Public `http://p2p-gz.cityulive.com/watch.html?room=robot` returned `301` to HTTPS.
- Public `https://p2p-gz.cityulive.com/watch.html?room=robot` returned `200 OK`.
- Existing services remained `active`: `webrtc-p2p-video-gz`, `nginx`, `cloud-service-console-tank-trouble`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-srt-bridge`, and `go2rtc-telemetry-relay`.

## 74. P2P Local Pusher Supervisor Stability Fix

Date:

- 2026-05-29 02:50

Scope:

- Updated the standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Added a background `supervisor.py` so `start_local` returns after startup while the pusher remains supervised in the background.
- The supervisor now launches the real `pusher.py` child process, records separate supervisor/child PID files, and stops cleanly through `stop_local`.
- If the child dies shortly after startup, the supervisor records the exit in `logs\supervisor.log` and tries safer encoder/profile combinations, for example AMF 1080p60 to lower/stabler H.264 profiles.
- Added stronger pusher process diagnostics with `faulthandler`, process-start/normal-exit/error logs, and traceback printing.
- `stop_local` now also cleans stale supervisor/pusher children from this script project.
- Aligned `config\pusher.config.json` mirror fields with the user section so camera mode no longer appears as `sourceMode=screen`.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip` from a clean staging copy excluding runtime logs, venv, and `__pycache__`.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\supervisor.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\scripts\stop_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\supervisor.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\stop_local.py`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`
- Observed the supervised pusher for 35 seconds with a connected viewer; sender stats continued increasing at about `1.5 Mbps`.
- Re-ran `stop_local` and confirmed no `p2p-local-pusher` supervisor/pusher script process remained.
- `tar -tf E:\Desktop\123\p2p-local-pusher.zip` confirmed the clean package contains only config, docs, scripts, and top-level setup/start/stop wrappers.

Runtime/cloud impact:

- Local standalone P2P pusher behavior changed and was restarted/stopped during validation.
- Active local test pusher was stopped after validation.
- No cloud files/services were changed.
- No Cloud Service Console app runtime, EXE, hosted web console, go2rtc legacy service, Tencent status API, control signal service, or Tank Trouble service changed.

## 73. P2P Repeated Viewer Ready Black-Screen Fix

Date:

- 2026-05-29 02:00

Scope:

- Updated the standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Root cause found: the public `watch.html` kept sending repeated `viewer-ready`; the pusher kept creating new offers for the same viewer, which made the watch page close/recreate its PeerConnection before RTP arrived. This caused a live but muted video track, zero received packets, and black video even though the source screen/camera was not black.
- Added pusher-side duplicate `viewer-ready` suppression for 12 seconds after a recent offer to the same viewer, so existing public watch pages can connect without a server-side page update.
- Kept the local watch-page debug/guard edits in `E:\Desktop\123\webrtc-p2p-video` for next deployment, but the server was not updated because SSH password authentication failed in this session.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip` from a staging copy excluding runtime logs/venv.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\Desktop\123\webrtc-p2p-video\public\watch.html`
- External `E:\Desktop\123\webrtc-p2p-video\public\style.css`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`
- Minimal Chrome WebRTC receiver against `https://p2p.cityulive.com` room `robot` decoded `1920x1080` video with `framesDecoded=960`.
- Current public `https://p2p.cityulive.com/watch.html?room=robot` worked after the pusher fix: `readyState=4`, `videoWidth=1920`, `videoHeight=1080`, `muted=false`, peer state `connected`, bitrate about `5.08 Mbps`.

Runtime/cloud impact:

- Local standalone P2P pusher behavior changed and was restarted.
- Active local test pusher was left running in room `robot` for continued viewing/debugging.
- No cloud files/services were changed because SSH authentication to `150.109.100.30` failed for the attempted P2P static-page sync.
- No Cloud Service Console app runtime, EXE, hosted web console, go2rtc legacy service, Tencent status API, control signal service, or Tank Trouble service changed.

## 72. P2P H264 And ICE Black-Screen Fix

Date:

- 2026-05-29 01:26

Scope:

- Updated the standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Fixed a WebRTC ICE race where browser ICE candidates could arrive before the answer was applied, causing `aioice` `remote_password` errors and repeated black-screen retries.
- Added pending remote-candidate buffering and flush after `setRemoteDescription`.
- Aligned the actual H.264 encoder level and the advertised SDP `profile-level-id` with configured output resolution/FPS, so high settings such as `1920x1080 @ 60 fps` are not advertised as H.264 level 3.1.
- Added sender-side stats logging every 5 seconds for connected viewers, showing packet count, bytes sent, and bitrate. This makes it clear whether black screen is caused by no media being sent or by the viewer/display side.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`
- Clean test room `robot-fix-1779988751` connected successfully and logged growing sender stats, for example packets increasing from `288` to `7304` and bytes from `264383` to `6051175`.
- Restored room to `robot`, restarted the pusher, and confirmed one current viewer reached `connected` with sender stats increasing around `0.8-1.7 Mbps`.

Runtime/cloud impact:

- Local standalone P2P pusher behavior changed.
- Active local test pusher was left running in room `robot` for continued viewing/debugging.
- No Cloud Service Console app runtime, EXE, hosted web console, P2P signaling service, go2rtc legacy service, Tencent status API, control signal service, or Tank Trouble service changed.
- Current local config has `screenCaptureEnabled: true`, so it pushes the desktop screen rather than the camera.

## 71. P2P Pusher Restart And Viewer Reconnect Fix

Date:

- 2026-05-29 00:50

Scope:

- Fixed standalone P2P pusher restart edge cases in `E:\wsl\p2p-local-pusher`.
- `start_local` now deletes stale runtime state before launching, so it no longer reports success from an old `pusher.state.json`.
- `pusher.py` now writes runtime state only after `pusher-online` succeeds, preventing failed room-claim attempts from overwriting the peer id needed by `stop_local`.
- Added retry when a room is still releasing the previous pusher after stop.
- Added viewer offer retry/rebuild behavior when a viewer keeps sending `viewer-ready` but never answers.
- `read_config()` now accepts UTF-8 files with BOM, so manually edited config files from Windows tools are tolerated.
- Updated the P2P watch page error handling so failed offer handling is retried instead of silently advancing the signal cursor.
- Refreshed `E:\Desktop\123\p2p-local-pusher.zip`.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Remote `/opt/webrtc-p2p-video/public/shared.js`
- External package `E:\Desktop\123\p2p-local-pusher.zip`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\stop_local.py E:\wsl\p2p-local-pusher\scripts\common.py`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- Deployed updated `public/shared.js` and restarted only `webrtc-p2p-video.service`.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` and `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1`.
- New public watch page opened with cache-busting query; pusher log showed `Viewer answered` and `connection state: connected`.

Runtime/cloud impact:

- Local standalone P2P pusher restart/reconnect behavior changed.
- Cloud P2P watch static JS updated and only `webrtc-p2p-video.service` was restarted.
- No Cloud Service Console app runtime, EXE, hosted web console, go2rtc legacy service, Tencent status API, control signal service, or Tank Trouble service changed.

## 70. P2P Viewer First-Frame Signaling Cleanup

Date:

- 2026-05-29 00:20

Scope:

- Updated the standalone P2P signaling service at `E:\Desktop\123\webrtc-p2p-video` and deployed it to `/opt/webrtc-p2p-video`.
- Fixed slow first picture when opening the P2P watch page by filtering stale `viewer-ready` messages before they reach the pusher.
- Reduced default P2P long-poll timeout from 25 seconds to 5 seconds.
- Added message pruning and short TTLs for transient signaling history: normal messages keep about 20 seconds, `viewer-ready` to pusher keeps about 8 seconds.
- Updated the standalone P2P local pusher at `E:\wsl\p2p-local-pusher` so it also ignores stale `viewer-ready` messages and uses the shorter poll timeout even with older configs.

Changed files / external paths:

- External `E:\Desktop\123\webrtc-p2p-video\server.py`
- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- External `E:\Desktop\123\webrtc-p2p-video\config.json`
- External `E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- Remote `/opt/webrtc-p2p-video`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `node --check E:\Desktop\123\webrtc-p2p-video\server.js`
- `node --check E:\Desktop\123\webrtc-p2p-video\public\shared.js`
- `python -m py_compile E:\Desktop\123\webrtc-p2p-video\server.py`
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\common.py`
- Local Node smoke test confirmed a 10-second-old `viewer-ready` was filtered and only the fresh viewer reached the pusher.
- Deployed to `/opt/webrtc-p2p-video` and restarted only `webrtc-p2p-video.service`.
- Remote `python3 -m py_compile /opt/webrtc-p2p-video/server.py` passed.
- Remote `systemctl is-active webrtc-p2p-video.service` returned `active`.
- `curl.exe -fsS https://p2p.cityulive.com/api/rooms/robot/status` returned `ok: true`.
- Public remote smoke test confirmed a 10-second-old `viewer-ready` was filtered and only the fresh viewer reached the pusher.

Runtime/cloud impact:

- Changed and restarted only the experimental P2P signaling service `webrtc-p2p-video.service`.
- Public P2P entry, port, Nginx config, and certificate did not change.
- No Cloud Service Console app runtime, EXE, hosted web console, go2rtc legacy service, Tencent status API, control signal service, or Tank Trouble service changed.

## 69. Windows P2P Full-Screen Capture Scaling

Date:

- 2026-05-28 23:54

Scope:

- Updated the standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Fixed screen capture semantics so config `width` / `height` are treated as final output resolution, not the top-left capture rectangle.
- Windows screen mode now captures the full virtual desktop using Windows system metrics, then scales/stretches frames to the target config resolution before H.264 encoding.
- The resize happens in the PyAV frame path immediately before encoding; no aspect-ratio preservation or letterboxing is applied.
- Startup status now reports both actual capture size and output size.
- Fixed `profile_payload()` so runtime state no longer writes `profile: null`.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1` started Windows screen push successfully.
- Startup output reported `Capture: 2560x1440` and `Output: 1920x1080 @ 60 fps`.
- Encoder selected `h264_amf`; err log was empty.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1` sent `pusher-offline` and stopped the test pusher.

Runtime/cloud impact:

- Local standalone P2P pusher Windows screen-capture behavior only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 68. Windows P2P Hidden Background Process

Date:

- 2026-05-28 23:33

Scope:

- Updated the standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Fixed Windows `start_local.cmd` opening a second empty terminal window for the background pusher process.
- `start_local.py` now uses Windows no-window process creation plus hidden `STARTUPINFO`, while keeping the foreground result window visible.
- Stopped the user's active test pusher, verified the new hidden-background start behavior, then stopped the test pusher again.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1` started Windows screen push successfully.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1` sent `pusher-offline` and stopped the test pusher.

Runtime/cloud impact:

- Local standalone P2P pusher Windows process behavior only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 67. Windows P2P CMD Visibility And Screen Format Guard

Date:

- 2026-05-28 23:26

Scope:

- Updated the standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Windows `.cmd` entry scripts now pause when launched by double-click so success/failure output remains visible:
  - `setup_local.cmd`
  - `start_local.cmd`
  - `stop_local.cmd`
- Added cross-OS screen input/format guards so Windows does not reuse Linux `x11grab` config, and Linux does not reuse Windows `desktop` config.
- Refreshed Windows config via `setup_local.cmd --skip-pip`; screen capture now uses `desktop + gdigrab`.
- Verified Windows screen push starts successfully with `screenCaptureEnabled = true`, `1920x1080 @ 60 fps`, and `h264_amf`.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\setup_local.cmd`
- External `E:\wsl\p2p-local-pusher\start_local.cmd`
- External `E:\wsl\p2p-local-pusher\stop_local.cmd`
- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `cmd /c E:\wsl\p2p-local-pusher\setup_local.cmd --skip-pip`
- `cmd /c E:\wsl\p2p-local-pusher\start_local.cmd` with `P2P_NO_PAUSE=1` started Windows screen push successfully.
- `cmd /c E:\wsl\p2p-local-pusher\stop_local.cmd` with `P2P_NO_PAUSE=1` sent `pusher-offline` and stopped the test pusher.

Runtime/cloud impact:

- Local standalone P2P pusher script/config only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 66. Standalone P2P User-Friendly Screen Toggle

Date:

- 2026-05-28 23:18

Scope:

- Updated the WSL-side standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Replaced user-facing `user.sourceMode` with `user.screenCaptureEnabled` for simpler config:
  - `false` means camera push.
  - `true` means screen capture push.
- Kept `sourceMode` as an internal/backward-compatible field so older configs still work.
- Updated start output to show `Screen capture: enabled/disabled`.
- Preserved the user's current `1920x1080 @ 60 fps` and bitrate/encoder settings.
- Updated standalone pusher README with the boolean screen capture switch.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External `E:\wsl\p2p-local-pusher\docs\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/common.py scripts/start_local.py scripts/pusher.py scripts/setup_local.py && python3 - <<'PY' ..."`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` started screen push successfully with `user.screenCaptureEnabled = true`.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash stop_local.sh"` sent `pusher-offline` and stopped the test pusher.

Runtime/cloud impact:

- Local standalone P2P pusher script/config only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 65. WSL P2P Screen Input Auto Detection

Date:

- 2026-05-28 23:02

Scope:

- Updated the WSL-side standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Screen mode now works with only `user.sourceMode = screen`; `user.screenInput` can stay empty.
- Linux/WSL screen input detection now tries `$DISPLAY`, then `/tmp/.X11-unix/X*`, then `/mnt/wslg/.X11-unix/X*`.
- The local WSL test config now leaves `user.screenInput` and internal `screen.input` empty to validate auto detection.
- Rewrote the standalone pusher README in readable Chinese and documented that `screenInput` is only needed when auto detection fails.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External `E:\wsl\p2p-local-pusher\docs\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/common.py scripts/start_local.py scripts/pusher.py scripts/setup_local.py && python3 - <<'PY' ..."`
- Auto-detection returned `:0` while `user.screenInput` was empty.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` started screen push successfully with empty `screenInput`.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash stop_local.sh"` sent `pusher-offline` and stopped the test pusher.

Runtime/cloud impact:

- Local standalone P2P pusher script/config only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 64. WSL P2P Screen Capture Dependency Install

Date:

- 2026-05-28 22:54

Scope:

- Installed WSL-side packages needed for local P2P screen/camera testing: `ffmpeg` and `v4l-utils`.
- Verified WSLg/X11 display capture from `:0` works through FFmpeg `x11grab`.
- Updated the WSL-side standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher` so `start_local` injects `DISPLAY` from `user.screenInput` when Linux/WSL screen mode is enabled and the shell environment lacks `DISPLAY`.
- Switched the local WSL test config to `user.sourceMode = screen` and `user.screenInput = :0` so WSL can test without `/dev/video0`.
- Performed a real P2P screen push startup test and stopped it afterward.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `wsl -e bash -lc "command -v ffmpeg; ffmpeg -version | head -n 1; command -v v4l2-ctl; v4l2-ctl --version | head -n 1"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash setup_local.sh --skip-pip"`
- `wsl -e bash -lc "DISPLAY=:0 ffmpeg -hide_banner -f x11grab -video_size 640x480 -framerate 15 -i :0 -t 2 -f null -"`
- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/start_local.py && DISPLAY=:0 ffmpeg -hide_banner -loglevel error -f x11grab -video_size 640x480 -framerate 15 -i :0 -t 1 -f null - && echo screen-capture-ok"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` started a background P2P screen pusher in room `robot`.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash stop_local.sh"` sent `pusher-offline` and stopped the test pusher.

Runtime/cloud impact:

- Local WSL package installation and standalone P2P pusher script/config only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 63. Standalone P2P Screen Source Mode

Date:

- 2026-05-28 22:35

Scope:

- Updated the WSL-side standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Added a user-facing `user.sourceMode` config option: `camera` remains the default and `screen` pushes display content.
- Added `user.screenInput` plus internal `screen` config defaults so Windows can use `gdigrab desktop` and Linux/WSL can use `x11grab` with `$DISPLAY`.
- Updated pusher profile building, media opening, runtime state, and start output so the active source is reported as camera or screen.
- `start_local` no longer requires a Linux `/dev/video*` camera when `sourceMode` is `screen`; it reports a clear message if Linux screen input is missing.
- Rewrote the standalone pusher README in readable Chinese with the new screen-source usage.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- External `E:\wsl\p2p-local-pusher\docs\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\start_local.py E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/common.py scripts/pusher.py scripts/start_local.py scripts/setup_local.py"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` returned the intended default camera-mode no-Linux-camera message.
- Verified screen-mode config parsing maps Linux/WSL to `x11grab` with `screenInput`.
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash setup_local.sh --skip-pip"` regenerated config with `user.sourceMode` and `screen` fields present.

Runtime/cloud impact:

- Local standalone P2P pusher script behavior only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 62. WSL P2P Windows Camera Guard

Date:

- 2026-05-28 21:58

Scope:

- Updated the WSL-side standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- Fixed Windows DirectShow camera inputs such as `video=UGREEN Camera 4K` being reused inside Linux/WSL.
- `setup_local` now removes cross-OS camera inputs from the effective Linux config when no Linux camera device is detected.
- `pusher` now ignores cross-OS camera inputs before building profiles and reports a clear no-Linux-camera error instead of trying to open `video=...` as a file.
- `default_camera_guesses` on Linux now uses real `/dev/video*` devices only, not a fake `/dev/video0` fallback.
- `start_local` now truncates pusher logs on each run so stale successful output is not mixed with the current failure.
- `start_local` now stops early with a clear WSL message when no Linux camera input is configured.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\common.py`
- External `E:\wsl\p2p-local-pusher\scripts\pusher.py`
- External `E:\wsl\p2p-local-pusher\scripts\start_local.py`
- External `E:\wsl\p2p-local-pusher\config\pusher.config.json`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\common.py E:\wsl\p2p-local-pusher\scripts\pusher.py E:\wsl\p2p-local-pusher\scripts\start_local.py`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && python3 -m py_compile scripts/common.py scripts/pusher.py scripts/start_local.py"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash setup_local.sh --skip-pip"`
- `wsl -e bash -lc "cd /mnt/e/wsl/p2p-local-pusher && bash start_local.sh"` returned the intended clear failure because current WSL has no `/dev/video*` and no configured Linux camera input.

Runtime/cloud impact:

- WSL/local script behavior only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 61. WSL P2P Setup Venv Guard

Date:

- 2026-05-28 21:39

Scope:

- Updated the WSL-side standalone P2P local pusher copy at `E:\wsl\p2p-local-pusher`.
- `setup_local.py` now detects the common Ubuntu/WSL `ensurepip is not available` failure caused by missing `python3-venv`.
- On Debian/Ubuntu-like Linux, setup attempts `apt-get update` and `apt-get install -y python3-venv python3-pip` through `sudo` when needed.
- Setup now detects an incomplete previously-created `.venv` where Python exists but pip is missing, then rebuilds it after installing `python3-venv`.
- Rewrote the WSL copy README in readable Chinese and added a WSL/Ubuntu dependency section.

Changed files / external paths:

- External `E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- External `E:\wsl\p2p-local-pusher\docs\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\wsl\p2p-local-pusher\scripts\setup_local.py`
- `wsl -e bash -lc "python3 -m py_compile /mnt/e/wsl/p2p-local-pusher/scripts/setup_local.py"`

Runtime/cloud impact:

- WSL/local script setup behavior only.
- No Cloud Service Console app runtime, EXE, hosted web console, cloud service, public port, go2rtc service, P2P signaling service, control signal service, or Tank Trouble service changed.

## 60. Standalone P2P User Config Section

Date:

- 2026-05-28 17:58

Scope:

- Simplified the standalone P2P local pusher config at `E:\Desktop\123\p2p-local-pusher`.
- Added a top-level `user` section so normal users only edit signal server, room, camera input, camera input format, width, height, FPS, bitrate, and preferred encoder.
- Kept `camera`, `video`, and `runtime` as program-maintained compatibility/runtime sections below the user section.
- Updated config readers so `user` fields take precedence over older root / `camera` / `video` fields.
- `setup_local` now writes the compact `user` section and keeps generated probe data below it.
- `start_local` prints the effective `user` config, while `pusher` still records actual fallback results only under `runtime.lastSelected`.
- Fixed the P2P encoder patch to use the actual selected profile FPS after fallback.
- Updated the desktop mini app P2P local-script sync path so it writes the same `user` section before starting the local P2P script.
- Rewrote the standalone pusher README around the "only edit user section" rule.

Changed files / external paths:

- External `E:\Desktop\123\p2p-local-pusher\config\pusher.config.json`
- External `E:\Desktop\123\p2p-local-pusher\scripts\common.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\setup_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\stop_local.py`
- External `E:\Desktop\123\p2p-local-pusher\scripts\pusher.py`
- External `E:\Desktop\123\p2p-local-pusher\docs\README.md`
- `backend\p2p_local_pusher.py`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `cmd /c setup_local.cmd --skip-pip`
- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\common.py E:\Desktop\123\p2p-local-pusher\scripts\setup_local.py E:\Desktop\123\p2p-local-pusher\scripts\start_local.py E:\Desktop\123\p2p-local-pusher\scripts\stop_local.py E:\Desktop\123\p2p-local-pusher\scripts\pusher.py E:\Desktop\123\cloud-service-console\backend\p2p_local_pusher.py`
- Effective config smoke test confirmed `user.signalBaseUrl`, `user.roomId`, `user.cameraInput`, `user.cameraInputFormat`, `user.width`, `user.height`, `user.fps`, `user.bitrateKbps`, and `user.preferredEncoder` override legacy fields.
- `cmd /c npm.cmd run build --prefix frontend`
- `git diff --check -- backend\p2p_local_pusher.py`
- `cmd /c npm.cmd run installer:build`
- Verified copied files in `E:\Cloud-Service-Console` have `2026-05-28 17:59` timestamps.

Runtime/cloud impact:

- Desktop EXE and backend sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.
- No cloud service, public port, Nginx rule, go2rtc legacy service, Tencent status API, P2P signaling service, control signal service, or Tank Trouble service changed.
- Hosted web console was not deployed in this step.

## 59. Standalone P2P Start Output and Config Guidance

Date:

- 2026-05-28 07:54

Scope:

- Improved `E:\Desktop\123\p2p-local-pusher\start_local` terminal output.
- `start_local` now prints the requested signal server, room, watch URL, camera, input, capture size/FPS, bitrate, preferred encoder, fallback encoder chain, runtime-probed encoders, FFmpeg path, and config path before starting.
- After the pusher reaches online state, `start_local` prints the actual selected room, watch URL, camera, output size/FPS, bitrate, and encoder, so automatic fallback is visible.
- Rewrote the standalone pusher README in readable Chinese and split config fields into recommended manual edits vs generated/internal fields.

Changed files / external paths:

- External `E:\Desktop\123\p2p-local-pusher\scripts\start_local.py`
- External `E:\Desktop\123\p2p-local-pusher\docs\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile E:\Desktop\123\p2p-local-pusher\scripts\start_local.py`
- `E:\Desktop\123\p2p-local-pusher\start_local.cmd`
- `E:\Desktop\123\p2p-local-pusher\stop_local.cmd`
- Verified start output includes `https://p2p.cityulive.com/watch.html?room=robot`.
- Verified online output shows actual encoder fallback result `h264_amf` on this Windows machine.
- Confirmed no leftover `p2p-local-pusher` Python process after validation.

Runtime/cloud impact:

- No Cloud Service Console app/runtime code changed.
- No cloud service, public port, Nginx rule, go2rtc service, Tencent Cloud status API, control signal service, or Tank Trouble service changed.

## 58. Standalone Cross-Platform P2P Local Pusher

Date:

- 2026-05-28 01:03

Scope:

- Added a new standalone local P2P WebRTC camera pusher project at `E:\Desktop\123\p2p-local-pusher`.
- Top-level user operations are limited to `setup_local`, `start_local`, and `stop_local` scripts for Windows and Linux/macOS.
- `setup_local` creates a project-local Python virtual environment, installs `aiortc`/`av`, enumerates cameras, probes FFmpeg encoders, and writes `config\pusher.config.json`.
- `start_local` starts the pusher in the background so closing the terminal does not stop streaming.
- `stop_local` stops the background pusher and sends `pusher-offline` to the P2P signaling service when possible.
- Config defaults to `https://p2p.cityulive.com` room `robot`, with camera, resolution, FPS, bitrate, room, and encoder fallback fields.
- Encoder support/fallback targets: Windows `h264`, `h264_nvenc`, `hevc_nvenc`, `h264_amf`; Linux `h264`, `h264_nvenc`, `hevc_nvenc`; macOS `h264_videotoolbox`, `h264`.
- Runtime encoder probing avoids choosing hardware encoders that are listed by FFmpeg but cannot actually initialize.

Changed files / external paths:

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
- Windows camera enumeration detected `UGREEN Camera 4K` and `OBS Virtual Camera`.
- Windows encoder runtime probe skipped unavailable `h264_nvenc` / `hevc_nvenc` and selected working `h264_amf` on this machine.
- `E:\Desktop\123\p2p-local-pusher\start_local.cmd` reached online state in background for room `robot`.
- `E:\Desktop\123\p2p-local-pusher\stop_local.cmd` stopped the pusher and sent `pusher-offline`.
- Confirmed no leftover `p2p-local-pusher` Python process after validation.

Runtime/cloud impact:

- No Cloud Service Console app/runtime code changed.
- No cloud service, public port, Nginx rule, go2rtc service, Tencent Cloud status API, control signal service, or Tank Trouble service changed.
- The new local pusher uses the already existing P2P signaling service at `https://p2p.cityulive.com`.
- Linux/macOS wrappers and config are present, but real camera runtime validation was performed only on Windows in this environment.

## 57. Viewer Address Confirmation Dialogs

Date:

- 2026-05-28 00:03

Scope:

- Changed Tencent Cloud `网页端观看` to open the existing play-address dialog first instead of directly opening the player page.
- Tencent Cloud play dialog now defaults to the current status play URL, saved play URL, or derived `webrtc://.../live/robot_control` fallback.
- Added a P2P viewer room dialog before opening `网页端观看`.
- P2P viewer dialog defaults to the current P2P push room but can enter another room to watch another P2P stream.
- P2P viewer-room selection does not overwrite the push-room field unless the user edits the push-room field itself.

Changed files / deployed paths:

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
- Copied EXE timestamps verified at about `2026-05-28 00:03`.

Runtime/cloud impact:

- Hosted console static frontend was replaced under `/opt/cloud-service-console-web/frontend/dist`; web console service was not restarted.
- No change to P2P signaling service code, legacy go2rtc video services, Tencent status API endpoints, control signal services, or Tank Trouble services.
- Desktop EXE and backend sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.

## 56. P2P Room Lock and Video-Only Viewer

Date:

- 2026-05-27 23:44

Scope:

- Added P2P room ownership behavior to the standalone signaling service: one room can have only one active pusher at a time.
- A second pusher in the same room now receives `HTTP 409`; a different room remains independent and can host another P2P stream.
- The pusher sends heartbeat messages; abnormal close is released after `pusherTtlSeconds` (`15` seconds by default), and normal stop sends `pusher-offline`.
- The console P2P panel now has an editable room field. The room is saved locally and used by both `开始P2P推流` and `网页端观看`.
- The hosted P2P watch page is now video-only: it auto-starts viewer mode and renders only the remote `<video>` surface.

Changed files / deployed paths:

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
- Deployed `/opt/webrtc-p2p-video` and restarted only `webrtc-p2p-video.service`.
- Synced hosted console static frontend under `/opt/cloud-service-console-web/frontend/dist`.
- Public room-lock smoke: first pusher returned `200`, second same-room pusher returned `409`, `pusher-offline` released the room, and the next pusher returned `200`.
- Public watch page check confirmed `video-only-page` and `remote-video` are present and old viewer UI text is absent.
- `python scripts\build_installer.py`
- Copied EXE timestamps verified at about `2026-05-27 23:44`.

Runtime/cloud impact:

- Changed and restarted only the experimental P2P signaling service `webrtc-p2p-video.service`.
- Hosted console static frontend was replaced; `cloud-service-console-web.service` stayed active.
- No change to legacy go2rtc video services, Tencent Cloud push status API, control signal services, or Tank Trouble services.
- Desktop EXE and backend sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.

## 55. Inline Console P2P Push

Date:

- 2026-05-27 23:08

Scope:

- Replaced the previous external-page P2P push entry with an inline console P2P push panel.
- The local-stream UI now includes a P2P panel with the same general flow as Tencent Cloud push: local preview, status lamp, `开始P2P推流` / `停止P2P推流`, and `网页端观看`.
- P2P push uses the existing public signaling service `https://p2p.cityulive.com`, room `robot`, and browser WebRTC peer connections; media still goes peer-to-peer and does not traverse the console backend.
- P2P uses applicable local-stream parameters: camera, capture/output resolution, capture/target FPS, and video bitrate. Legacy-only fields such as input format, FFmpeg encoder, SRT options, ingest ports, and public host/port remain greyed out while P2P/Tencent panels are active.
- Added mutual exclusion between Tencent Cloud and P2P push because both use the local camera.
- Synced hosted web console static frontend and rebuilt/copied the desktop mini app EXE package.

Changed files / deployed paths:

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

- Hosted console static frontend was replaced under `/opt/cloud-service-console-web/frontend/dist`; backend env/tokens were not regenerated.
- No change to legacy go2rtc video services, Tencent status API endpoints, control signal services, or Tank Trouble services.
- No restart/change to `webrtc-p2p-video.service`; the console now consumes its existing REST signaling API directly.
- Desktop EXE and backend sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.

## 54. Console P2P Push Entry

Date:

- 2026-05-27 22:02

Scope:

- Integrated the public P2P WebRTC pusher into the Cloud Service Console local-stream UI.
- Added a `P2P推流 (BETA)` button immediately after `腾讯云推流`; it opens `https://p2p.cityulive.com/push.html?room=robot`.
- Removed `(BETA)` from the Tencent Cloud push button and Tencent Cloud push panel title.
- Updated the web-mode local-stream subtitle and tooltip so web users see Tencent Cloud and P2P as supported web push paths.
- Synced the hosted web console static frontend and rebuilt/copied the desktop mini app EXE package.

Changed files / deployed paths:

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
- Remote `cloud-service-console-web.service` stayed `active` after static frontend sync.

Runtime/cloud impact:

- Hosted console static frontend was replaced under `/opt/cloud-service-console-web/frontend/dist`.
- No backend API, token, go2rtc legacy video path, Tencent status API, control signal service, Tank Trouble service, or P2P signaling service restart/change.
- Desktop EXE and backend sidecar were rebuilt and copied to `E:\Cloud-Service-Console`.

## 53. Public P2P HTTPS Deployment

Date:

- 2026-05-27 17:45

Scope:

- Deployed the standalone P2P WebRTC video prototype to server `150.109.100.30`.
- Added a dependency-free Python signaling server (`server.py`) because Node.js is not installed on the server.
- Created systemd service `webrtc-p2p-video.service`.
- Added Nginx virtual host for `p2p.cityulive.com`, with HTTP redirected to HTTPS.
- Issued Let's Encrypt certificate for `p2p.cityulive.com`.
- Bound the internal signaling service to `127.0.0.1:8099`; public access goes through Nginx `443`.

Changed files / cloud paths:

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

## 52. P2P Background Signaling Launcher

Date:

- 2026-05-27 16:57

Scope:

- Updated the standalone P2P WebRTC prototype `start-signaling.cmd` to launch `server.js` in the background.
- The start script now checks whether the configured port is already listening, starts Node hidden, verifies readiness, and writes logs to `logs\signaling.out.log` / `logs\signaling.err.log`.
- Updated the prototype README to explain that the startup window can be closed after the success message and `stop-signaling.cmd` should be used to stop the background server.

Changed files:

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

## 51. P2P Signaling Startup Message

Date:

- 2026-05-27 16:50

Scope:

- Improved the standalone P2P WebRTC prototype signaling server startup output.
- The console now clearly says the server started successfully in Chinese and shows the next scripts to run.

Changed files:

- External `E:\Desktop\123\webrtc-p2p-video\server.js`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `node --check server.js`

Runtime/cloud impact:

- Local-only P2P prototype console-message change.
- No cloud service, existing console app, legacy go2rtc path, Tencent path, control signal, or Tank Trouble change.

## 50. P2P Stop Script PID Variable Fix

Date:

- 2026-05-27 16:47

Scope:

- Fixed `stop-signaling.cmd` in the standalone P2P WebRTC prototype.
- Renamed the PowerShell loop variable from `$pid` to `$processId` because `$PID` is a built-in read-only PowerShell variable.

Changed files:

- External `E:\Desktop\123\webrtc-p2p-video\stop-signaling.cmd`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- Ran the corrected stop logic against port `8099`; it stopped the existing signaling server process.

Runtime/cloud impact:

- Local-only P2P helper script fix.
- No cloud service, existing console app, legacy go2rtc path, Tencent path, control signal, or Tank Trouble change.

## 49. P2P Prototype Stop Script

Date:

- 2026-05-27 16:40

Scope:

- Added a Windows stop script for the standalone P2P WebRTC prototype.
- The script reads the configured signaling port from `config.json`, finds the listening process, and stops it.
- Updated the prototype README usage instructions.

Changed files:

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

## 48. Standalone P2P WebRTC Video Prototype

Date:

- 2026-05-27 15:18

Scope:

- Added an independent true P2P WebRTC video prototype under `E:\Desktop\123\webrtc-p2p-video`.
- The prototype has a Node.js signaling server that exchanges only offer / answer / ICE messages.
- The video media path is intended to flow directly between the pusher browser and viewer browser through WebRTC; the signaling server does not ingest or relay media frames.
- Added separate pusher and viewer pages, room selection, camera/fps/resolution/bitrate controls, optional timestamp overlay, viewer stats, and Windows `.cmd` launchers.

Changed files:

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

## 47. Correct 0522 Portable SRT Bridge Refresh

Date:

- 2026-05-27 11:05

Scope:

- Investigated Windows `start-local` failure where FFmpeg opened `UGREEN Camera 4K` successfully but failed to connect to `srt://150.109.100.30:19091` with `I/O error`.
- Confirmed cloud `go2rtc-srt-bridge` could be `active` and listening on UDP `19091` while SRT handshakes failed, including from `127.0.0.1` on the server.
- Restarted only `go2rtc-srt-bridge` to recover the SRT ingest listener.
- Updated the correct external 0522 portable package so Windows/Linux/macOS `start-local` refreshes an idle SRT bridge before starting local legacy push, while refusing to restart it if `main-camera` already has an active producer.

Changed files:

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

## 46. Hosted Console Tencent Status Text Sync

Date:

- 2026-05-25 18:19

Scope:

- Synced the Tencent Cloud push status text fix to the hosted web console at `https://console.cityulive.com/`.
- Updated only the hosted frontend static bundle under `/opt/cloud-service-console-web/frontend/dist`; did not run a full backend redeploy.

Changed files:

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

## 45. Tencent Cloud Push Status Text Fix

Date:

- 2026-05-25 17:34

Scope:

- Fixed the Tencent Cloud push signal card in the local streaming page so the web-local Tencent status no longer displays literal `???` placeholder text.
- Replaced the affected values/notes with clear Chinese states: pushing, restorable, occupied by another user, and waiting for Tencent Cloud push start.

Changed files:

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

## 44. Correct 0522 Portable Config Fix

Date:

- 2026-05-22 17:07

Scope:

- Corrected the active WeChat external pusher path to `go2rtc-portable-0522\go2rtc-portable`.
- Fixed Linux/macOS config loading so Python validation failures stop immediately with the real config error instead of falling through to `CFG_CONFIG_PATH: unbound variable`.
- Made `sender.webrtcPreferredCodec` strict only when `transport.ingestMode = webrtc`; SRT/HTTP ingest now ignore invalid/non-applicable codec values and use `h264` internally.
- Added `_comment_*` option notes to Windows, Linux, and macOS config files in the correct 0522 portable package.
- Synchronized Windows, Linux, and macOS default config generators and README option guidance.

Changed files:

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

## 43. External Legacy Portable Config Option Comments

Date:

- 2026-05-22 15:48

Scope:

- Added `_comment_*` option notes to the latest WeChat external `telebot-main-0522\telebot-main\go2rtc-portable` shared config.
- Documented allowed/common values for capture format, resolution, frame rate, bitrate, viewer auto-open, delay marker, WebRTC codec, encoder override, SRT/WHIP/HTTP ingest, and SRT timing options.
- Synchronized Windows, Linux, and macOS default config generators so newly generated configs keep the same option comments.
- Kept the simplified server switching rule: normal users only edit `cloud.serverHost` and plaintext `cloud.sshPassword` for identical servers.

Changed files:

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

## 42. External Legacy Portable Linux NVIDIA NVENC Support

Date:

- 2026-05-22 15:35

Scope:

- Added Linux NVIDIA NVENC support to the latest WeChat external `telebot-main-0522\telebot-main\go2rtc-portable` legacy sender package.
- Linux `sender.videoEncoder` now accepts blank auto mode, `h264_nvenc`, or `libx264`.
- Blank auto mode tries `h264_nvenc` first with a real FFmpeg runtime probe, then falls back to CPU `libx264`.
- Forced `h264_nvenc` now fails clearly if the Linux host lacks a usable NVIDIA driver/GPU/FFmpeg NVENC build.
- Linux sender FFmpeg arguments now branch between NVENC-safe low-latency CBR settings and the existing `libx264` low-latency settings.

Changed files:

- External `telebot-main-0522\telebot-main\go2rtc-portable\linux\common.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\linux\start-sender.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `bash -n` on all external root `.sh` scripts and all external `linux\*.sh` scripts, 21 files total.
- JSON parse validation on external `config\sender-cloud.config.json`.
- Searched external Linux scripts/README for `detect_linux_h264_encoder`, `h264_nvenc`, `videoEncoder`, and `CFG_SENDER_VIDEO_ENCODER`.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.
- Real NVENC capture/push still needs runtime validation on a Linux machine with an NVIDIA GPU and driver.

## 41. Legacy Media-Aware Status Fix

Date:

- 2026-05-21 19:40

Scope:

- Fixed the cloud video status aggregator so legacy push state uses both sender heartbeat and go2rtc media activity.
- A fresh legacy sender heartbeat marks the old link active.
- If the sender heartbeat is stale but go2rtc producer bytes/packets are still increasing, the old link is also active with `liveReason: media`.
- If both heartbeat and media activity are stale for more than 60 seconds, the old link becomes stopped.
- Deployed the updated telemetry relay script to `150.109.100.30` and restarted only `go2rtc-telemetry-relay`.

Changed files:

- `backend\cloud_setup_bundle\telemetry_relay.py`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile backend\cloud_setup_bundle\telemetry_relay.py`
- Cloud `systemctl is-active go2rtc-telemetry-relay` returned `active`.
- Cloud `GET http://127.0.0.1:18081/api/video/status` repeated samples returned `activeMode: legacy`, `legacy.live: true`, `legacy.liveReason: media`, and increasing `producerBytes` / `producerPackets`.
- Public web console API `GET https://console.cityulive.com/api/video/status?access_token=xhfang` returned `activeMode: legacy` and `legacy.liveReason: media`.
- Cloud video/control services stayed active: `go2rtc-cloud`, `go2rtc-srt-bridge`, `go2rtc-telemetry-relay`, `go2rtc-control-signaling`.

Runtime/cloud impact:

- Cloud impact: updated and restarted only `go2rtc-telemetry-relay`.
- Video link: video status API now treats fresh legacy sender heartbeat or fresh go2rtc media activity as live; `producerVisible` alone is not enough unless media counters are fresh/increasing.
- Control signal: no code/API change.
- Tank Trouble: no code/API change.
- UI: no local app UI code changed in this fix.
- No public port, cloud service name, or protocol changed.

## 1. Responsibilities

- Maintain cloud video ingest/playback path.
- Maintain go2rtc cloud setup scripts and video endpoint manifest.
- Maintain mini app service management for video-related services.
- Maintain mini app video preview window in the services page.
- Maintain HTTP/SRT ingest mode switching.

## 2. Strict Boundaries

Allowed to modify:

- `backend\cloud_setup.py`
- `backend\cloud_setup_bundle\config\sender-cloud.config.json`
- `backend\cloud_setup_bundle\www\index.html`
- `backend\cloud_setup_bundle\www\main-camera.html`
- `backend\cloud_setup_bundle\www\main-camera-video.html`
- `backend\cloud_setup_bundle\www\webrtc.html`
- `backend\cloud_setup_bundle\www\snapshot.html`
- `backend\config.py` only for video service/port metadata.
- `backend\health_checker.py` only for video health checks.
- `backend\service_manager.py` only for video service/port status and ingest mode.
- `backend\main.py` only for video APIs and service control APIs.
- `frontend\src\api\cloudApi.ts` only for video/service API wrappers.
- `frontend\src\pages\DashboardPage.tsx` only for video preview and service management UI.
- UI styles only with UI Agent alignment.

Do not modify:

- `backend\cloud_setup_bundle\control_signaling.py` unless the Control Signal Agent is involved.
- `backend\cloud_setup_bundle\tank_trouble_room.py`.
- `backend\tank_trouble_cloud.py`.
- `frontend\src\components\TankTroublePanel.tsx`.
- Control monitor keyboard/DataChannel handling in `DashboardPage.tsx`.

## 3. Current Video Architecture

Cloud public entry:

- `http://<host>:18081`

Stream name:

- `main-camera`

Viewer endpoints generated by cloud setup:

- `http://<host>:18081/main-camera.html`
- `http://<host>:18081/main-camera-video.html`
- `http://<host>:18081/webrtc.html?src=main-camera`
- `http://<host>:18081/webrtc.html?src=main-camera&clean=1`
- `ws://<host>:18081/api/ws?src=main-camera`
- `http://<host>:18081/video-endpoints.json`

Mini app embedded preview:

- Frontend calls `getVideoPreviewUrl()` in `frontend\src\api\cloudApi.ts`.
- The URL points to local backend `GET /api/video-preview.mp4`.
- Backend proxies `http://<host>:18081/api/stream.mp4?src=main-camera`.
- UI lives in `DashboardPage.tsx`, services page, panel title `浜戠瑙嗛绐楀彛`.

Current preview behavior:

- Uses MP4 proxy through local backend.
- Legacy direct WebRTC preview code is preserved in comments in `DashboardPage.tsx` but disabled.

## 4. Cloud Video Services

Managed services:

- `nginx`: public gateway.
- `go2rtc-cloud`: go2rtc cloud relay.
- `go2rtc-srt-bridge`: actual title in UI is `Ingest Bridge`; handles HTTP or SRT ingest and republishes RTSP to go2rtc.

Related cloud paths:

- Remote base: `/opt/go2rtc-cloud`
- go2rtc binary: `/opt/go2rtc-cloud/go2rtc`
- go2rtc config: `/opt/go2rtc-cloud/go2rtc.yaml`
- web root: `/opt/go2rtc-cloud/www`
- nginx config: `/etc/nginx/conf.d/go2rtc-cloud.conf`

## 5. Ingest Modes

HTTP ingest:

- Public ingest port: `18084/tcp`.
- ffmpeg listens on `http://0.0.0.0:18084/api/stream.ts?dst=main-camera`.
- Republish target: `rtsp://127.0.0.1:8554/main-camera`.

SRT ingest:

- Public ingest port: `19091/udp`.
- ffmpeg listens on `srt://0.0.0.0:19091?mode=listener...`.
- Republish target: `rtsp://127.0.0.1:8554/main-camera`.

Switch API:

- Frontend: `switchIngestMode(target_mode)` in `frontend\src\api\cloudApi.ts`.
- Backend: `POST /api/ingest-mode/switch`.
- Implementation: `BackendState.switch_ingest_mode()` in `backend\main.py`.
- Cloud writer: `CloudSetupBundle.switch_ingest_mode()` in `backend\cloud_setup.py`.

## 6. Mini App Video/Service UI

Service page:

- `frontend\src\pages\DashboardPage.tsx`
- Service grid uses `ServiceCard`.
- Video panel uses `ToggleSwitch`, `videoEnabled`, `previewVideoRef`, `videoTransport`, `videoStatus`.
- Port checks live in health/service flow and use `checkAllPorts()` / `checkPort()`.

Shared API wrappers:

- `startAllServices()`
- `stopAllServices()`
- `startService(serviceName)`
- `stopService(serviceName)`
- `switchIngestMode(target_mode)`
- `checkAllPorts()`
- `checkPort(portKey)`
- `getVideoPreviewUrl()`

## 7. Health And Port Checks

Health checks:

- `clock`: `GET /clock`
- `streams`: `GET /api/streams`

Ports:

- `public-http`: `18081/tcp`
- `internal-api`: `18082/tcp`
- `ingest-http`: `18084/tcp`
- `webrtc`: `19090/udp,tcp`
- `srt`: `19091/udp`
- `rtsp`: `8554/tcp`

Implementation:

- `backend\health_checker.py`
- `backend\service_manager.py`
- `backend\config.py`

## 8. Validation

Recommended local checks:

```powershell
python -m py_compile backend\cloud_setup.py backend\service_manager.py backend\health_checker.py backend\main.py backend\config.py
cmd /c npm --prefix frontend run build
```

Cloud health checks after deploy:

- `http://<host>:18081/clock`
- `http://<host>:18081/api/streams`
- `http://<host>:18081/video-endpoints.json`
- `http://<host>:18081/main-camera.html`

## 9. Local TRTC Utilities

Temporary local Tencent TRTC test utilities live under `scripts`:

- `scripts\trtc-local-publisher.html`: browser-based TRTC publisher for camera, microphone, or screen sharing. It joins string room IDs with `strRoomId` and asks the user to paste a per-user `UserSig` at runtime.
- `scripts\start-trtc-local-publisher.ps1`: starts a local Python HTTP server and opens the publisher page, defaulting to `http://127.0.0.1:8091/trtc-local-publisher.html`.

These utilities are local-only helpers for testing TRTC video publishing without OBS. They do not change go2rtc cloud services, ports, or deployment bundles.

## 10. Tencent Cloud Live WebRTC Push

The Local Stream page now includes a `鑵捐浜戞帹娴?(BETA)` button beside `涓€閿帹娴乣.

- Implementation: `frontend\src\pages\DashboardPage.tsx` plus local-stream styling in `frontend\src\styles\globals.css` and `frontend\src\styles\theme.css`.
- Runtime behavior: clicking the button opens a push-code dialog first. After the user confirms a Tencent Cloud Live `webrtc://...txSecret=...&txTime=...` push URL, the in-page panel opens, dynamically loads `TXLivePusher`, and publishes camera or screen with optional microphone.
- Remember behavior: after one successful `startPush`, the push URL is saved in local browser storage and is prefilled/displayed on the next Tencent Cloud push flow.
- Web playback behavior: after Tencent Cloud push is running, the panel shows `缃戦〉绔鐪媊. Clicking it opens a playback-address dialog for a `webrtc://<play-domain>/live/<stream>` URL, dynamically loads Tencent Cloud `TCPlayer` v4.9.1 CSS/JS, mounts a real `<video>` element, creates `TCPlayer(videoId, options)`, and calls `player.src(playUrl)`. This matches the official TCPlayer demo integration path for `webrtc://` playback rather than the older TCPlayerLite constructor.
- Playback remember behavior: after TCPlayer reports a playback event, the playback URL is saved in local browser storage and is prefilled on the next watch flow.
- Dialog layout: the shared modal overlay is raised above the app shell/sidebar and offset to the viewport so the push-code input is not clipped by the left navigation panel.
- Status layout: the push status area is a compact status strip beside the preview, not a full-height green panel.
- Preview lifecycle: before each Tencent Cloud push start and after each stop, the SDK preview container is cleared and remounted so repeated starts do not accumulate nested black preview borders.
- Security behavior: the push URL is not stored in backend settings or source defaults. It is stored only in local browser storage after a successful push.
- Cloud impact: none. This pushes directly from the desktop WebView/browser to Tencent Cloud Live and does not modify go2rtc, local FFmpeg ingest, cloud ports, systemd services, or deployment bundles.

## 11. Local Stream Occupancy Guard

The Local Stream UI treats `push_visible && !running` as "another device/user is already pushing the default stream".

- Implementation: `frontend\src\pages\DashboardPage.tsx` and the wrapper style in `frontend\src\styles\globals.css`.
- Runtime behavior: `涓€閿帹娴乣 is disabled while another device is publishing. Hovering the disabled action area shows `鍏朵粬浜烘鍦ㄦ帹娴乣.
- Status behavior: the local signal card shows `鍗犵敤涓璥 with note `鍏朵粬浜烘鍦ㄦ帹娴乣 while the stream is occupied by another publisher.
- Cloud impact: none. This is a frontend guard around existing local-stream status fields and does not change ports, service names, go2rtc, FFmpeg ingest, or cloud protocols.

## 12. Legacy Sender Runtime Heartbeat

Standalone old go2rtc sender package updated outside this repo:

- Path: `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0514\go2rtc-portable`
- Purpose: keep the old `legacy` video link usable while exposing a live runtime heartbeat for server/frontend mode selection.

Changed files in that portable package:

- `legacy_sender_heartbeat.py`
- `common\ConfigHelpers.ps1`
- `start-camera-push-to-cloud.ps1`
- `stop-camera-push-to-cloud.ps1`
- `linux\common.sh`
- `linux\start-sender.sh`
- `linux\stop-sender.sh`
- `README.md`

Runtime behavior:

- After the old go2rtc sender starts successfully, it publishes a runtime status heartbeat every 5 seconds.
- The existing runtime status URL from `video-endpoints.json` is reused, e.g. `<publicBaseUrl>/main-camera-runtime.json`.
- The status JSON now includes:
  - `videoMode: "legacy"`
  - `state`
  - `lastHeartbeatAt`
  - `heartbeatIntervalSec`
  - encoder/ingest metadata
- `stop-local` / `stop-sender` writes `state: "stopped"` with `statusReason: "manual_stop"`.
- If the sender crashes, loses network, or the machine powers off without stop, `lastHeartbeatAt` becomes stale and the server/frontend can treat the legacy link as offline.

Cloud impact:

- No remote cloud deployment was run during this change.
- No public ports, cloud service names, go2rtc service config, Nginx config, or control/Tank Trouble services changed.
- The cloud only receives the updated runtime JSON when the portable sender is run with working SSH access.

Validation:

- PowerShell parser check for `common\ConfigHelpers.ps1`, `start-camera-push-to-cloud.ps1`, and `stop-camera-push-to-cloud.ps1`.
- `bash -n linux\common.sh linux\start-sender.sh linux\stop-sender.sh`.
- `python -m py_compile legacy_sender_heartbeat.py`.

## 13. Legacy/Tencent Video Status API

The desktop Local Stream one-click push now uses the same `legacy` runtime heartbeat protocol as the standalone old sender package.

- Implementation: `backend\local_stream.py`.
- Startup behavior: after local FFmpeg push starts, the desktop backend writes `videoMode: "legacy"`, `state: "active"`, `lastHeartbeatAt`, `heartbeatIntervalSec: 5`, encoder metadata, ingest metadata, and `runtimeStatusUrl` to `<remoteBase>/www/<stream>-runtime.json`.
- Heartbeat behavior: while the local FFmpeg process is alive, the desktop backend refreshes the runtime JSON every 5 seconds.
- Stop behavior: stopping Local Stream writes `state: "stopped"` with `statusReason: "manual_stop"`.
- Crash behavior: if FFmpeg exits while the desktop backend is still alive, the heartbeat writes `state: "stale"` with `statusReason: "sender_process_exited"`; if the desktop app or machine disappears, `lastHeartbeatAt` becomes stale.

Cloud video status aggregation is now part of the telemetry relay.

- Implementation: `backend\cloud_setup_bundle\telemetry_relay.py` and `backend\cloud_setup.py`.
- Public status endpoint: `GET http://<host>:18081/api/video/status`.
- Tencent status endpoints:
  - `POST http://<host>:18081/api/video/tencent/start`
  - `POST http://<host>:18081/api/video/tencent/heartbeat`
  - `POST http://<host>:18081/api/video/tencent/stop`
- Nginx routes `/api/video/` to `go2rtc-telemetry-relay` on internal port `18083`.
- `video-endpoints.json` now includes `runtimeStatusUrl` and `videoStatusUrl`.
- The status response uses `legacy` and `tencent` naming and returns `activeMode`, `conflict`, `availableModes`, `legacy`, and `tencent`.
- `legacy.live` is true when the runtime heartbeat is fresh or go2rtc has a producer for the stream.
- `tencent.live` is true when Tencent heartbeat is fresh. Tencent state is in-memory in `go2rtc-telemetry-relay`, so it resets if that service restarts.
- If both links are active, the endpoint returns `conflict: true` and `availableModes: ["legacy", "tencent"]`; `activeMode` is a recommendation and frontend code may choose its own display priority.

The Local Stream Tencent Cloud push panel now reports Tencent status to the cloud endpoint.

- Implementation: `frontend\src\pages\DashboardPage.tsx`.
- After `TXLivePusher.startPush()` succeeds, the frontend posts `/api/video/tencent/start`.
- While Tencent push is running, the frontend posts `/api/video/tencent/heartbeat` every 5 seconds.
- On stop/unmount/restart, the frontend posts `/api/video/tencent/stop`.
- The Tencent push URL with `txSecret` is not sent to the server; only stream name, push host, optional play URL, source, and client id are reported.

Cloud impact:

- Public endpoints changed under existing public port `18081`.
- No new public ports were added.
- Existing cloud service names remain unchanged.
- Deployed on old server `150.109.100.30` by updating `telemetry_relay.py`, the `go2rtc-telemetry-relay` systemd unit environment, existing Nginx config, and `video-endpoints.json`.
- Only `go2rtc-telemetry-relay` was restarted; Nginx was reloaded.
- Control signal and Tank Trouble routes are not changed.

Validation:

- `python -m py_compile backend\local_stream.py backend\cloud_setup.py backend\cloud_setup_bundle\telemetry_relay.py backend\main.py backend\models.py`.
- `cmd /c npm --prefix frontend run build`.
- Local route registration check for `/api/video/status` and `/api/video/tencent/*`.
- Remote `python3 -m py_compile /opt/go2rtc-cloud/telemetry_relay.py`.
- Remote `sudo nginx -t`.
- Public `http://150.109.100.30:18081/api/video/status` returned `200`.

## 14. Tencent Linux WebRTC Pusher Status Reporting

Standalone Tencent Linux pusher package updated outside this repo:

- Path: `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\tencent-webrtc-pusher-linux-0514\tencent-webrtc-pusher-linux`
- Purpose: keep the independent Linux Tencent Cloud Live WebRTC pusher usable while making it visible to the Cloud Service Console video status API.

Changed files in that standalone package:

- `config.env`
- `config.example.env`
- `run-tencent-webrtc-push.sh`
- `tencent-webrtc-pusher.html`
- `README.md`

Runtime behavior:

- `config.env` now supports optional status reporting:
  - `CLOUD_VIDEO_STATUS_BASE_URL`
  - `TENCENT_PLAY_URL`
  - `STATUS_CLIENT_ID`
  - `STATUS_HEARTBEAT_SECONDS`
- The run script passes those values into the local pusher page query string.
- The pusher page posts to `/api/video/tencent/start` only after `TXLivePusher.startPush()` succeeds.
- While push is active, it posts `/api/video/tencent/heartbeat` every `STATUS_HEARTBEAT_SECONDS` seconds.
- Stop button and page unload post `/api/video/tencent/stop`.
- The full push URL and `txSecret` are not uploaded; only stream name, push host, optional play URL, source, and client id are reported.

Cloud impact:

- No cloud deployment was performed by this package change.
- It relies on the existing deployed status endpoints at `http://150.109.100.30:18081/api/video/tencent/*`.
- No ports, service names, Nginx config, control signal chain, or Tank Trouble services changed.

Validation:

- `bash -n run-tencent-webrtc-push.sh`
- `bash -n stop-tencent-webrtc-push.sh`
- HTML parser smoke check for `tencent-webrtc-pusher.html`.
- `bash run-tencent-webrtc-push.sh --help`.

## 15. Desktop Tencent Push Parameter Sync And Log Cleanup

The desktop Local Stream/Tencent Cloud push panel now keeps the two video paths in sync without changing control signal or Tank Trouble logic.

Changed behavior:

- Closing the desktop app clears the local FFmpeg push logs (`camera-push.out.log` and `camera-push.err.log`) after the backend shutdown hook stops the local stream.
- Tencent Cloud push now saves the current Local Stream draft config before starting `TXLivePusher`.
- Tencent Cloud push uses Local Stream video parameters where they fit the browser SDK:
  - `output_video_size` maps to `setVideoResolution` and is clamped to `160x120` through `3840x2160`.
  - `target_framerate` maps to `setVideoFPS` and is clamped to `1..60`.
  - `video_bitrate` maps to `setVideoBitrate` and is clamped to `100..12000` kbps.
  - The Tencent quality preset is selected from output height: `1080p`, `720p`, or `540p`.
- Tencent status heartbeat from the desktop app now also includes optional `videoWidth`, `videoHeight`, `fps`, `bitrateKbps`, and `quality` metadata. Existing cloud status endpoints remain backward compatible.

Parameters that do not directly apply to Tencent browser push:

- `video_encoder`, `ffmpeg_path`, `input_format`, SRT latency, SRT packet size, SRT connect timeout, and drop-late-packets are FFmpeg/SRT legacy-link settings only.
- `camera_name`, `video_size`, and `input_framerate` are not passed as exact browser device constraints; Tencent's browser SDK manages camera/screen capture. The desktop panel currently maps only the output encode size/FPS/bitrate.
- Cloud ingest ports and local go2rtc ingest mode are not used by the Tencent push URL. Tencent status reporting still targets the current logged-in server's `/api/video/tencent/*` endpoint.

Changed files:

- `backend\local_stream.py`
- `backend\main.py`
- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Cloud impact:

- No cloud deployment was performed.
- No public ports, cloud service names, Nginx routes, go2rtc services, control signal chain, or Tank Trouble services changed.
- The desktop app posts additional optional Tencent video metadata to the already deployed `/api/video/tencent/*` endpoints; older cloud code safely ignores unknown fields if not updated.

Validation:

- `python -m py_compile backend\local_stream.py backend\main.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Rebuilt `Cloud Service Console_0.3.67_x64-setup.exe` and copied fresh EXEs plus the versioned installer into `E:\Cloud-Service-Console`.
- In-app browser automation check against `http://127.0.0.1:8080/` timed out, so visual browser verification was not completed in this step.

## 16. Overview Video Push Status Card

The desktop/web console overview now uses the former "寰呭鐞嗘帶鍒? summary slot for video-link state.

Changed behavior:

- The overview card title is now "瑙嗛鎺ㄦ祦鐘舵€?.
- The card polls `GET /api/video/status` every 5 seconds while the console is connected and the active view is "鎺у埗鍙版€昏".
- The card shows the effective mode (`legacy`, `tencent`, conflict, or offline) plus per-mode rows for the old go2rtc/Local Stream path and the Tencent Cloud WebRTC path.
- Per-mode notes show heartbeat age and producer visibility in Chinese.
- Layout fix: the overview summary grid no longer stretches all cards to the tallest card, and the two video-link rows are shown in a compact two-column layout on desktop/tablet widths.
- The local backend now exposes a same-origin `GET /api/video/status` proxy that reads the already deployed cloud video status API from the current server.
- Web user access treats `/api/video/status` as a safe read-only path, so normal web-console links can see video state without admin permissions.

Changed files:

- `backend\main.py`
- `frontend\src\api\cloudApi.ts`
- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `frontend\src\styles\theme.css`
- `frontend\src\types\cloud.ts`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Cloud impact:

- No remote cloud deployment was performed.
- No public ports, cloud service names, go2rtc config, control signal services, Tank Trouble services, or Nginx rules changed.
- The UI depends on the existing deployed cloud endpoint `http://150.109.100.30:18081/api/video/status`.
- The standalone web console has not been redeployed in this step; deploying `cloud-service-console-web.service` should preserve the current access tokens.

Validation:

- `python -m py_compile backend\main.py`
- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- Rebuilt `0.3.68` and copied fresh runtime files plus `Cloud Service Console_0.3.68_x64-setup.exe` into `E:\Cloud-Service-Console`.
- Latest copied runtime timestamps: `Cloud Service Console.exe` `2026-05-15 13:51:37`, `cloud-console-backend.exe` `2026-05-15 13:51:29`, setup files `2026-05-15 13:51:54`.
- In-app browser automation timed out and `http://127.0.0.1:8080/` was not reachable, so visual browser verification was not completed in this step.

## 17. Web Console Deployment Sync

The hosted standalone web console was synchronized on `2026-05-15 14:11`.

Deployment scope:

- Server: `150.109.100.30`.
- Service: `cloud-service-console-web.service`.
- Remote path: `/opt/cloud-service-console-web`.
- Public entries at sync time: `http://150.109.100.30:18080/` and `http://150.109.100.30/console/`.
- Current public entry after the later Nginx cleanup is only `http://150.109.100.30:18080/?access_token=...`.
- Existing admin/user access tokens were preserved.

Runtime impact:

- Restarted only `cloud-service-console-web.service`.
- The hosted web console now includes the latest overview cards: `鍏綉鍏ュ彛`, `瑙嗛鎺ㄦ祦鐘舵€乣, and `鎺у埗淇″彿鐘舵€乣.
- No go2rtc, video ingest, control signaling, telemetry relay, SRT bridge, Nginx, coturn, or Tank Trouble service restart was performed.

Validation:

- `cmd /c npm.cmd run build`
- Remote `systemctl is-active cloud-service-console-web.service` returned `active`.
- Existing chain services before and after deployment were all `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.
- Public `http://150.109.100.30:18080/api/access` returned `200`.
- Public `http://150.109.100.30:18080/api/health` returned `200`.
- Public `http://150.109.100.30/console/` returned the app shell.
- Public main JS asset contains `鎺у埗淇″彿鐘舵€乣 and no longer contains `浜戠鐩爣` or `褰撳墠妯″紡`.

## 18. Nginx Console Entry Removed

The Nginx `/console/` web console entry was intentionally removed on `2026-05-15 14:37`.

Current web console entry:

- `http://150.109.100.30:18080/?access_token=...`

Removed entries:

- `http://150.109.100.30/console/?access_token=...`
- `http://150.109.100.30/api/...` as a port-80 proxy to the standalone web console.

Cloud change:

- Backed up and disabled `/etc/nginx/conf.d/cloud-service-console-web.conf`.
- Reloaded only `nginx`.
- `cloud-service-console-web.service` remains active on port `18080`.
- No go2rtc, video ingest, control signaling, telemetry relay, SRT bridge, coturn, or Tank Trouble service restart was performed.

Validation:

- Remote `nginx -t` passed.
- Existing services before and after remained `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`, `cloud-service-console-web`.
- Public `http://150.109.100.30/console/?access_token=xhfang` returned `404`.
- Public `http://150.109.100.30/api/access` returned `404`.
- Public `http://150.109.100.30:18080/api/access` with admin token returned `200`.

## 19. Video Heartbeat Timeout To Stopped

The old server video status API was updated on `2026-05-15 15:05`.

Scope:

- `legacy` and `tencent` video status now use a 60-second heartbeat timeout.
- If the latest heartbeat is more than 60 seconds old, `/api/video/status` returns that mode as `state: "stopped"` and `live: false`.
- A short-lived `stale` state may still appear for a recent sender-side stale report before the 60-second timeout.

Changed files:

- `backend\cloud_setup_bundle\telemetry_relay.py`

Cloud deployment:

- Updated `/opt/go2rtc-cloud/telemetry_relay.py` on old server `150.109.100.30`.
- Backup created at `/opt/go2rtc-cloud/telemetry_relay.py.bak-heartbeat-timeout-20260515150414`.
- Restarted only `go2rtc-telemetry-relay`.
- No go2rtc cloud video service, SRT bridge, control signaling, Nginx, coturn, Tank Trouble, or hosted web console service restart was performed.

Validation:

- `python -m py_compile backend\cloud_setup_bundle\telemetry_relay.py`
- Local snapshot smoke check: 59-second heartbeat returns `active`; 61-second heartbeat returns `stopped` for both `legacy` and `tencent`.
- Remote `python3 -m py_compile /tmp/telemetry_relay.py.codex.*`
- Remote constants check returned `LEGACY_HEARTBEAT_STALE_AFTER_SEC: 60` and `TENCENT_HEARTBEAT_STALE_AFTER_SEC: 60`.
- Remote `systemctl is-active go2rtc-telemetry-relay` returned `active`.
- Existing services before and after remained `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`, `cloud-service-console-web`.
- Public `http://150.109.100.30:18081/api/video/status` returned `legacy.state: "stopped"`, `legacy.staleAfterSec: 60`, and `tencent.staleAfterSec: 60`.
- `cmd /c npm run installer:build`
- Rebuilt `0.3.68` and copied fresh runtime files into `E:\Cloud-Service-Console`.

## 20. HTTPS Prep For Web Tencent Push

HTTPS preparation for the hosted web console was started on `2026-05-15 15:40`.

Reason:

- Browser camera/microphone access for a future web Tencent push flow requires a secure context (`https://` or localhost).
- The root domain `cityulive.xyz` is still used by Tencent Cloud Live pull/CDN and must not be repointed.
- The intended console domain is `console.cityulive.xyz`.

Server changes on `150.109.100.30`:

- Added `/etc/nginx/conf.d/cloud-service-console-https.conf`.
- Added a host-only HTTP reverse proxy for `console.cityulive.xyz` to `http://127.0.0.1:18080`.
- Installed certbot at `/usr/bin/certbot`.
- Reloaded only Nginx.
- Backup created: `/etc/nginx/conf.d/cloud-service-console-https.conf.bak-20260515153927`.

Current blocker:

- `console.cityulive.xyz` has no DNS record yet, so Let's Encrypt certificate issuance cannot complete.
- Port `443` is not listening yet.
- After DNS is added as `console.cityulive.xyz A 150.109.100.30` and TCP `443` is open in the cloud security group, run certbot for `console.cityulive.xyz`.

Validation:

- `Resolve-DnsName console.cityulive.xyz` currently returns no record.
- `Resolve-DnsName cityulive.xyz` still points to Tencent Cloud Live CDN, so the existing pull domain was not affected.
- Host-header check `Host: console.cityulive.xyz` on `http://150.109.100.30/` returned the web console app shell.
- Old `/console/` path remains `404`.
- `http://150.109.100.30:18080/api/access` with the admin token still returns `200`.
- `Test-NetConnection 150.109.100.30 -Port 443` failed as expected because no certificate/443 listener is active yet.
- Existing services remained `active`: `nginx`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, and `coturn`.

Cloud impact:

- Nginx config changed only for the future `console.cityulive.xyz` host.
- No public service name changed.
- No video streaming service, control signal broker, Tank Trouble service, telemetry relay, SRT bridge, coturn, or hosted web console restart was performed.

## 21. Web Local Tencent Push Entry

The web console local-stream entry was updated on `2026-05-15 16:16`.

Scope:

- Web mode now probes browser camera availability through `navigator.mediaDevices.enumerateDevices()`.
- The sidebar `鏈湴鎺ㄦ祦` entry appears for web admins while browser camera detection is checking, available, or blocked by browser security; it is hidden only when the browser can confirm there is no camera.
- In web mode, the old local go2rtc/FFmpeg `寮€濮嬫帹娴乣 path is disabled and explains that only Tencent Cloud push is available.
- Tencent Cloud push in web mode uses the local page draft settings for resolution, frame rate, and bitrate, but does not call desktop-only local-stream backend config APIs.
- Web mode skips desktop local-stream status polling so hosted pages are not kicked away from the local-stream page by forbidden desktop-only API calls.

Changed files:

- `frontend\src\pages\DashboardPage.tsx`

Build and deployment:

- Rebuilt `0.3.68` and copied fresh runtime files into `E:\Cloud-Service-Console`.
- Deployed the hosted web console on old server `150.109.100.30`.
- Restarted only `cloud-service-console-web.service`.
- Preserved web tokens: admin `xhfang`, user `cmc5006`.

Validation:

- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `http://150.109.100.30:18080/api/access` returned admin role for token `xhfang`.
- Public `http://150.109.100.30:18080/api/access` returned user role for token `cmc5006`.
- Public web index now references `/assets/index-DTHba6P5.js`.
- Public `http://150.109.100.30:18080/api/health` returned `backend-ready`.
- Existing chain services stayed `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.

Notes:

- Browser camera access on public IP HTTP is blocked by browser security. The web local-stream entry now remains visible for admins in that blocked state so the page can explain the HTTPS/permission problem directly.
- No go2rtc cloud video service, SRT bridge, telemetry relay, control signaling broker, Tank Trouble service, Nginx route, public port, or cloud service name was changed.

## 22. Web Local Push Visibility Fix

The web console local-stream visibility was corrected on `2026-05-15 16:41`.

Reason:

- On public `http://150.109.100.30:18080`, browsers block camera enumeration because the page is not HTTPS.
- The previous behavior treated that blocked state as "no camera" and hid the whole `鏈湴鎺ㄦ祦` entry, so users could not see why the camera was unavailable.

Scope:

- Web admins now still see `鏈湴鎺ㄦ祦` when the browser camera probe is blocked or still checking.
- The local-stream page labels blocked web camera access as `PERMISSION BLOCKED` and shows `琚祻瑙堝櫒闃绘`.
- `寮€濮嬭吘璁簯鎺ㄦ祦` is disabled with a tooltip when public HTTP blocks browser camera/screen capture.
- The old local go2rtc/FFmpeg `寮€濮嬫帹娴乣 button remains disabled in web mode.

Changed files:

- `frontend\src\pages\DashboardPage.tsx`

Build and deployment:

- Rebuilt `0.3.68` and copied fresh runtime files into `E:\Cloud-Service-Console`.
- Deployed the hosted web console on old server `150.109.100.30`.
- Restarted only `cloud-service-console-web.service`.

Validation:

- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public web index now references `/assets/index-DTHba6P5.js`.
- Public `http://150.109.100.30:18080/api/access` returned admin role for token `xhfang`.
- Public `http://150.109.100.30:18080/api/health` returned `backend-ready`.
- Existing chain services stayed `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.

Notes:

- This does not make browser camera capture possible over public HTTP. Tencent Cloud browser push still needs HTTPS or localhost to actually open camera/screen capture.
- No go2rtc cloud video service, SRT bridge, telemetry relay, control signaling broker, Tank Trouble service, Nginx route, public port, or cloud service name was changed.

## 23. HTTPS Console Entry Enabled

HTTPS for the hosted web console was enabled on `2026-05-15 17:01`.

Scope:

- DNS for `console.cityulive.xyz` now resolves to `150.109.100.30`.
- Issued a Let's Encrypt certificate for `console.cityulive.xyz`.
- Updated `/etc/nginx/conf.d/cloud-service-console-https.conf` so:
  - `http://console.cityulive.xyz/...` redirects to `https://console.cityulive.xyz/...`.
  - `https://console.cityulive.xyz/...` proxies to `http://127.0.0.1:18080`.
  - Unknown port-80 hostnames still return `404`.
- Reloaded only Nginx.

Remote files:

- `/etc/nginx/conf.d/cloud-service-console-https.conf`
- Backup: `/etc/nginx/conf.d/cloud-service-console-https.conf.bak-before-ssl-20260515170023`
- Certificate: `/etc/letsencrypt/live/console.cityulive.xyz/fullchain.pem`
- Private key: `/etc/letsencrypt/live/console.cityulive.xyz/privkey.pem`

Public entries:

- Preferred admin entry: `https://console.cityulive.xyz/?access_token=xhfang`
- Preferred user entry: `https://console.cityulive.xyz/?access_token=cmc5006`
- Fallback direct port entry remains available: `http://150.109.100.30:18080/?access_token=...`

Validation:

- `Resolve-DnsName console.cityulive.xyz -Type A` returned `150.109.100.30`.
- `nslookup console.cityulive.xyz` via `8.8.8.8`, `1.1.1.1`, and `119.29.29.29` returned `150.109.100.30`.
- Remote `certbot certonly --webroot ... -d console.cityulive.xyz` succeeded.
- Certificate expires on `2026-08-13`; certbot auto-renew task is installed.
- Remote `sudo nginx -t` passed.
- Remote `systemctl reload nginx` succeeded.
- Remote `ss -ltnp` showed `80`, `443`, and `18080` listening.
- Public `https://console.cityulive.xyz/?access_token=xhfang` returned `200` and the web console app shell.
- Public `http://console.cityulive.xyz/?access_token=xhfang` returned `301` to HTTPS.
- Public `https://console.cityulive.xyz/api/access` returned admin role for token `xhfang` and user role for token `cmc5006`.
- Public `https://console.cityulive.xyz/api/health` returned `backend-ready`.
- Existing chain services stayed `active`: `nginx`, `cloud-service-console-web`, `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `coturn`.

Cloud impact:

- Nginx host config changed for `console.cityulive.xyz` and public `443` is now active.
- No go2rtc cloud video service, SRT bridge, telemetry relay, control signaling broker, Tank Trouble service, coturn, or hosted web console process was restarted.
- This enables browser secure-context camera/screen permissions for the web Tencent Cloud push UI.

## 24. Tencent Push Parameter Locking

The local-stream form was updated for Tencent Cloud push mode on `2026-05-15 17:21`.

Scope:

- When the Tencent Cloud push panel is open or Tencent Cloud push is running, parameters that do not apply to Tencent Cloud WebRTC push become gray and disabled.
- Still editable in Tencent mode: `杈撳嚭鍒嗚鲸鐜嘸, `鐩爣甯х巼`, and `瑙嗛鐮佺巼`.
- Disabled in Tencent mode: local camera name, input format, encoder, capture resolution, capture FPS, legacy ingest protocol, SRT latency/packet controls, timeout, drop-late-packets, current-server toggle, public host/port, HTTP ingest, and SRT ingest.
- Disabled fields keep a hover title explaining that Tencent Cloud push does not use that option.

Changed files:

- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `frontend\src\styles\theme.css`

Build and deployment:

- Rebuilt `0.3.68` and copied fresh runtime files into `E:\Cloud-Service-Console`.
- Deployed the hosted web console on old server `150.109.100.30`.
- Restarted only `cloud-service-console-web.service`.
- Preserved web tokens: admin `xhfang`, user `cmc5006`.

Validation:

- `cmd /c npm --prefix frontend run build`
- `git diff --check -- frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css frontend\src\styles\theme.css`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.xyz/` now references `/assets/index-De224WQ0.js` and `/assets/index-B2hd1Wbt.css`.
- Public `https://console.cityulive.xyz/api/access` returned admin role for token `xhfang`.
- Public `https://console.cityulive.xyz/api/health` returned `backend-ready`.
- Existing chain services stayed `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.

Cloud impact:

- Hosted web console assets changed.
- No go2rtc cloud video service, SRT bridge, telemetry relay, control signaling broker, Tank Trouble service, Nginx route, public port, or cloud service name was changed.

## 25. Browser Camera Display And Per-Window Online Presence

The web/local console presence behavior was updated on `2026-05-15 17:38`.

Scope:

- Browser camera detection now dedupes `videoinput` entries by `groupId`, normalized label, or `deviceId`.
- The web local-stream signal no longer displays browser-enumerated camera counts, because one physical camera can appear as multiple browser devices.
- Online presence now uses a per-page/window in-memory client id instead of a shared browser storage id.
- Online heartbeat runs at the App level, so admin web pages, user web pages, and desktop EXE windows are all counted while open.

Changed files:

- `frontend\src\App.tsx`
- `frontend\src\api\cloudApi.ts`
- `frontend\src\pages\DashboardPage.tsx`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Build and deployment:

- Rebuilt `0.3.68` and copied fresh runtime files into `E:\Cloud-Service-Console`.
- Deployed the hosted web console on old server `150.109.100.30`.
- Restarted only `cloud-service-console-web.service`.
- Preserved web tokens: admin `xhfang`, user `cmc5006`.

Validation:

- `cmd /c npm --prefix frontend run build`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.xyz/` now references `/assets/index-gpzQKaw3.js` and `/assets/index-B2hd1Wbt.css`.
- Public `https://console.cityulive.xyz/api/access` returned admin role for token `xhfang`.
- Public `https://console.cityulive.xyz/api/health` returned `backend-ready`.
- Public online heartbeat smoke test with three temporary client ids changed count from `1` to `2 -> 3 -> 4`, then returned to `1` after leave calls.
- Existing chain services stayed `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.

Cloud impact:

- Hosted web console assets changed.
- No go2rtc cloud video service, SRT bridge, telemetry relay, control signaling broker, Tank Trouble service, Nginx route, public port, or cloud service name was changed.

## 26. Web Tencent Push Status And Occupancy

The web Tencent Cloud push flow was updated on `2026-05-15 18:13`.

Scope:

- Web Tencent push status reporting now posts through the console backend proxy at `/api/video/tencent/{start|heartbeat|stop}`.
- This avoids HTTPS browser mixed-content blocking when the hosted console needs to update the HTTP telemetry relay on `150.109.100.30:18081`.
- The local-stream page now polls video push status while open, so a Tencent stream started by another web client disables the local Tencent push start button until that stream stops or times out.
- Tencent push preview is rebound when the page becomes visible again, to recover the SDK preview after tab/window switches.
- Tencent push start/stop remains a single button that switches between start and stop states.

Changed files:

- `backend\main.py`
- `frontend\src\api\cloudApi.ts`
- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Build and deployment:

- Rebuilt `0.3.68` and copied fresh runtime files into `E:\Cloud-Service-Console`.
- Deployed the hosted web console on old server `150.109.100.30`.
- Restarted only `cloud-service-console-web.service`.
- Preserved web tokens: admin `xhfang`, user `cmc5006`.

Validation:

- `cmd /c npm --prefix frontend run build`
- `python -m py_compile backend\main.py`
- `git diff --check -- backend\main.py frontend\src\api\cloudApi.ts frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css`
- `cmd /c npm run installer:build`
- `python scripts\deploy_web_console.py`
- Public `https://console.cityulive.xyz/` now references `/assets/index-3fT14QW5.js` and `/assets/index-D38m5dXn.css`.
- Public `https://console.cityulive.xyz/api/health` returned `backend-ready`.
- Public `https://console.cityulive.xyz/api/video/status` returned video status JSON through the hosted web console.
- Existing chain services stayed `active`: `go2rtc-cloud`, `go2rtc-control-signaling`, `go2rtc-telemetry-relay`, `go2rtc-srt-bridge`, `nginx`, `coturn`.

Cloud impact:

- Hosted web console backend and assets changed.
- The console backend now proxies Tencent video status updates to the existing telemetry relay endpoint.
- No go2rtc cloud video service, SRT bridge, telemetry relay service, control signaling broker, Tank Trouble service, Nginx route, public port, or cloud service name was changed.

## 27. HTTPS Web Console Is Primary

The hosted web console has migrated to HTTPS. Use this as the preferred browser entry:

- `https://console.cityulive.com/?access_token=...`
- Admin: `https://console.cityulive.com/?access_token=xhfang`
- User: `https://console.cityulive.com/?access_token=cmc5006`

Why this matters:

- Browser camera, microphone, and screen capture require a secure context.
- Tencent Cloud browser WebRTC push should be tested from the HTTPS console entry.
- The direct fallback `http://150.109.100.30:18080/?access_token=...` can still be used for basic console access if needed, but it is not suitable for browser media capture.

Current state:

- `console.cityulive.com` is the current working console domain.
- `console.cityulive.xyz` is deprecated/broken as of `2026-05-19` and should not be shared as the current entry.
- Nginx terminates HTTPS on `443` and proxies to the standalone web console on `127.0.0.1:18080`.
- The old `/console/` path remains removed and should not be restored unless explicitly requested.

Current validation:

- `https://console.cityulive.com/?access_token=xhfang` returned `200`.
- `https://console.cityulive.com/?access_token=cmc5006` returned `200`.
- `https://console.cityulive.com/api/access?access_token=xhfang` returned admin role.
- `https://console.cityulive.com/api/access?access_token=cmc5006` returned user role.

Previous `console.cityulive.xyz` validation, kept for history:

- `https://console.cityulive.xyz/` returned `200` with title `Cloud Service Console v3`.
- `https://console.cityulive.xyz/api/access` returned admin/user roles for valid access tokens.
- Certificate subject is `CN=console.cityulive.xyz`, issued by Let's Encrypt, expiring `2026-08-13`.

Cloud/runtime impact for this documentation sync:

- No cloud runtime changed.
- No app code changed.
- No EXE rebuild was needed.

## 28. Documentation Update Rule

After every video change:

- Update this file.
- Update `frontend\IMPLEMENTATION_LOG.md`.
- If public endpoints, ports, or service names changed, update `docs\AGENT_HANDOFF_MASTER_INDEX.md`.
- Build a fresh EXE package after code changes and replace the existing runtime EXEs in `E:\Cloud-Service-Console`.

## 29. Standalone Tencent Linux Pusher Codec Selection

Date:

- `2026-05-18 16:30`

Scope:

- Updated the standalone Tencent Cloud WebRTC Linux pusher utility outside the main app repo runtime path.
- Added a configurable codec selector so the local browser pusher can switch between `h264`, `vp8`, `vp9`, and `hevc`.
- This utility lives under `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux`.

Behavior:

- `run-tencent-webrtc-push.sh` now reads `VIDEO_CODEC` from `config.env`.
- `config.env` and `config.example.env` now include `VIDEO_CODEC="h264"` by default.
- The local pusher page now includes a codec dropdown and remembers the selected codec.
- The page rewrites the Tencent push URL before `startPush()`:
  - `h264`: removes Tencent codec override query params.
  - `vp8`: appends `tx_vp8=true`.
  - `vp9`: appends `tx_vp9=true`.
  - `hevc`: appends both `tx_hevc=true` and `tx_h265=true` for compatibility with Tencent documentation variants.
- The page logs browser-declared video codec capabilities through `RTCRtpSender.getCapabilities("video")` when available.

Changed files:

- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\run-tencent-webrtc-push.sh`
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\config.env`
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\config.example.env`
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\tencent-webrtc-pusher.html`
- `E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\README.md`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `bash -n E:\Desktop\123\tencent-linux\tencent-webrtc-pusher-linux\run-tencent-webrtc-push.sh`
- `node` syntax check of the inline script in `tencent-webrtc-pusher.html`
- URL rewrite smoke check in `node` confirmed:
  - `h264` removes codec flags
  - `vp9` appends `tx_vp9=true`
  - `hevc` appends `tx_hevc=true&tx_h265=true`

Runtime/cloud impact:

- No Cloud Service Console frontend/backend code changed in this task.
- No EXE rebuild, installer build, hosted web-console redeploy, or cloud service restart was required.
- No control signaling, Tank Trouble, go2rtc cloud runtime, telemetry relay, or SRT ingest behavior changed.

## 30. Teammate Frontend Tencent Playback Fixes

Date:

- `2026-05-19 13:45`

Scope:

- Updated the teammate frontend at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518`.
- This is not the Cloud Service Console app runtime, but it consumes the video status API and Tencent playback path.

Changed behavior:

- Tencent playback status is read through the cloud video status source as documented earlier.
- The Tencent player preview is kept at a normal 16:9 ratio by constraining `.video-shell`, TCPlayer wrapper elements, and nested video elements.
- Switching from legacy WebRTC playback to Tencent playback now clears legacy stream state and TCPlayer-generated DOM before creating a new Tencent player.
- VR floating video screen switches to `#tencentVideoPlayer` in Tencent mode and back to `#remoteVideo` in legacy mode.

Changed external files:

- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\app.py`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\static\app.js`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\static\styles.css`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\VIDEO_LINK_INTEGRATION_NOTE.md`

Validation:

- `python -m py_compile E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\app.py`
- `node --check E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\frontend-0518\frontend\static\app.js`

Runtime/cloud impact:

- No Cloud Service Console app code changed for this teammate frontend fix.
- No cloud service, public port, Nginx route, go2rtc runtime, control signal service, or Tank Trouble service changed.

## 31. Legacy Portable Stop-All Now Stops Local Push Only

Date:

- `2026-05-19 14:57`

Scope:

- Updated the external legacy go2rtc portable pusher at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable`.
- Changed `stop-all` semantics so it only stops local video push/sender processes.
- Removed the previous behavior where `stop-all` SSHed to the cloud server and stopped shared services such as `nginx`, `coturn`, `go2rtc-cloud`, `go2rtc-srt-bridge`, and `go2rtc-telemetry-relay`.

Changed external files:

- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\stop-all.ps1`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\linux\stop-all.sh`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\README.md`

Validation:

- PowerShell scriptblock parse check for `stop-all.ps1`.
- `bash -n E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\linux\stop-all.sh`
- `rg` keyword check confirmed no `systemctl stop`, `run_ssh`, `require_cloud_ssh_access`, or `Invoke-SshCommandCapture` remains in the `stop-all` Windows/Linux entry scripts.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No EXE rebuild, installer build, hosted web-console deployment, cloud service restart, public port change, or service-name change was performed.
- This change reduces cloud risk: the legacy local pusher stop action no longer stops shared cloud services.

## 32. Legacy Portable Root Entry Cleanup

Date:

- `2026-05-19 15:25`

Scope:

- Reorganized the external legacy go2rtc portable pusher at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable`.
- Kept only three user-facing command entry points in the project root: `setup-local.cmd`, `start-local.cmd`, and `stop-local.cmd`.
- Moved implementation and maintenance scripts under `scripts\windows`, `scripts\linux`, `scripts\helpers`, `scripts\common`, and `scripts\legacy-entrypoints`.
- Updated script path resolution so config, logs, www files, helper Python scripts, and hidden maintenance scripts still resolve from the portable project root.
- Updated the external package `README.md` to document the cleaned entry layout.

Changed external files:

- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\setup-local.cmd`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\start-local.cmd`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\stop-local.cmd`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\scripts\...`
- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0515\go2rtc-portable\README.md`

Validation:

- PowerShell scriptblock parse check for all `scripts\windows\*.ps1`.
- `bash -n scripts/linux/*.sh scripts/legacy-entrypoints/linux/*.sh`.
- Root script-entry check confirmed the only root script files are `setup-local.cmd`, `start-local.cmd`, and `stop-local.cmd`.
- Target check confirmed all three root command files point to existing scripts under `scripts\windows`.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.

## 34. Legacy Portable Linux NVIDIA Encoder Support

Date:

- `2026-05-19 17:13`

Scope:

- Updated the external legacy go2rtc portable pusher at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0519\go2rtc-portable`.
- Linux now reads `sender.videoEncoder` from `config\sender-cloud.config.json`.
- Linux supported values are now:
  - `""`: auto select `h264_nvenc`, then `libx264`.
  - `h264_nvenc`: NVIDIA H.264 hardware encoding.
  - `hevc_nvenc`: NVIDIA HEVC hardware encoding.
  - `libx264`: CPU H.264 software encoding.
- Added HEVC-specific FFmpeg arguments for `hevc_nvenc` and kept H.264-specific level/profile args only for H.264 paths.
- Added `videoEncoder` to the Linux default config generation path.
- Updated the external package `README.md`.

Validation:

- `bash -n setup-local.sh start-local.sh stop-local.sh scripts/linux/*.sh scripts/legacy-entrypoints/linux/*.sh`
- Fake FFmpeg encoder-list smoke test confirmed:
  - auto chooses `h264_nvenc` when NVIDIA encoders are present.
  - explicit `hevc_nvenc` is accepted when present.
  - auto falls back to `libx264` when NVIDIA encoders are absent.
  - explicit missing `hevc_nvenc` fails with a clear error.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public ports, cloud service names, control signal services, Tank Trouble services, or hosted web console behavior changed.
- No public ports, cloud services, control signal services, Tank Trouble services, or hosted web console behavior changed.

## 33. Legacy Portable Linux Root Entries Restored

Date:

- `2026-05-19 15:30`

Scope:

- Added root Linux wrappers back to the external legacy go2rtc portable pusher:
  - `setup-local.sh`
  - `start-local.sh`
  - `stop-local.sh`
- Root now exposes Windows and Linux daily-use entries only: setup/start/stop for each platform.
- Other maintenance and helper scripts remain under `scripts\`.
- Updated the external package `README.md` accordingly.

Validation:

- Root script-entry check confirmed only `setup-local.cmd`, `setup-local.sh`, `start-local.cmd`, `start-local.sh`, `stop-local.cmd`, and `stop-local.sh` are exposed.
- `bash -n setup-local.sh start-local.sh stop-local.sh scripts/linux/*.sh scripts/legacy-entrypoints/linux/*.sh`
- PowerShell scriptblock parse check for all `scripts\windows\*.ps1`.
- Target check confirmed all three Linux wrappers point to existing scripts under `scripts\linux`.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
## 35. Local Stream Auto Downgrade Startup

Date:

- 2026-05-20 21:02

Scope:

- Updated the desktop mini app local legacy push path so new machines can recover from bad camera capture settings automatically.
- The backend now treats startup as successful only after FFmpeg stays alive without obvious capture decode errors and the cloud producer appears.
- If FFmpeg logs camera decode errors such as No JPEG data found in image, startup stops that attempt and tries lower or safer capture modes.
- Fallback attempts include default camera capture without forced MJPEG and safer 1280x720, 960x540, and 640x480 profiles.
- The final successful config is saved as the next default, and the frontend draft inputs are refreshed from the returned config so the UI shows the downgraded working values.

Changed files:

- `backend\local_stream.py`
- `frontend\src\pages\DashboardPage.tsx`
- docs\VIDEO_LINK_AGENT.md
- `frontend\IMPLEMENTATION_LOG.md`
- docs\SHARED_AGENT_STATUS.md

Validation:

- python -m py_compile backend\local_stream.py backend\main.py backend\models.py
- cmd /c npm --prefix frontend run build
- git diff --check -- backend\local_stream.py frontend\src\pages\DashboardPage.tsx
- cmd /c npm run installer:build

Runtime/cloud impact:

- Rebuilt and copied the desktop runtime files into E:\Cloud-Service-Console.
- No hosted web console deployment was performed.
- No cloud service, public port, Nginx route, go2rtc service, telemetry relay, control signal broker, or Tank Trouble service changed.
## 36. Legacy Portable macOS and Per-OS Configs

Date:

- 2026-05-21 16:10

Scope:

- Updated the external legacy go2rtc portable pusher at E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0520\go2rtc-portable.
- Added macOS daily-use support through the existing root setup-local.sh, start-local.sh, and stop-local.sh wrappers.
- Added scripts\macos with Homebrew dependency setup, AVFoundation camera detection, VideoToolbox encoder auto-selection, and local sender start/stop support.
- Split sender config by OS: sender-cloud.windows.config.json, sender-cloud.linux.config.json, and sender-cloud.macos.config.json.
- Set all three system configs to default to the Hong Kong server 150.109.100.30 and internal-test plaintext cloud.sshPassword SSH bootstrap.
- Kept sender-cloud.config.json only as an old-command pointer.

Changed files:

- External go2rtc-portable-0520\go2rtc-portable\setup-local.sh
- External go2rtc-portable-0520\go2rtc-portable\start-local.sh
- External go2rtc-portable-0520\go2rtc-portable\stop-local.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\common.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\camera_helper.py
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\setup-local.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\start-local.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\start-sender.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\stop-local.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\stop-sender.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\list-cameras.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\common.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\setup-local.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\common\ConfigHelpers.ps1
- External Windows local sender scripts and prepare-release.ps1
- External system config JSON files and README
- docs\VIDEO_LINK_AGENT.md
- frontend\IMPLEMENTATION_LOG.md
- docs\SHARED_AGENT_STATUS.md

Validation:

- bash -n on root wrappers, Linux touched scripts, and macOS scripts.
- python -m py_compile on macOS and Linux camera helpers plus heartbeat helper.
- PowerShell parser validation on touched Windows scripts.
- JSON parse validation on all four config files.
- Windows config helper smoke test confirmed default path resolves to sender-cloud.windows.config.json, host 150.109.100.30, blank camera, 1280x720, and password present.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, or hosted web console behavior changed.

## 37. Legacy Portable Root Cleanup

Date:

- 2026-05-21 16:39

Scope:

- Cleaned the latest WeChat external go2rtc portable pusher root at `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\go2rtc-portable-0520\go2rtc-portable`.
- Kept the root focused on daily-use entries: `setup-local.cmd`, `start-local.cmd`, `stop-local.cmd`, `setup-local.sh`, `start-local.sh`, `stop-local.sh`, `README.md`, `config`, `logs`, `scripts`, and `internal`.
- Moved bundled go2rtc runtime files and legacy YAML templates into `internal\runtime`.
- Moved viewer web assets into `internal\www`.
- Moved historical handoff and boundary documents into `internal\docs`.
- Updated path references so Windows/Linux deploy helpers and viewer-version generation read from `internal\www`.

Changed files:

- External go2rtc-portable-0520\go2rtc-portable\README.md
- External go2rtc-portable-0520\go2rtc-portable\scripts\common\ConfigHelpers.ps1
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\deploy-go2rtc-cloud.ps1
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\start-local.ps1
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\start-tencent.cmd
- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\start-sender-template.cmd
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\common.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\deploy-cloud.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\common.sh
- External go2rtc-portable-0520\go2rtc-portable\internal\runtime\*
- External go2rtc-portable-0520\go2rtc-portable\internal\www\*
- External go2rtc-portable-0520\go2rtc-portable\internal\docs\*
- docs\VIDEO_LINK_AGENT.md
- frontend\IMPLEMENTATION_LOG.md
- docs\SHARED_AGENT_STATUS.md

Validation:

- PowerShell parser validation on touched Windows scripts.
- JSON parse validation on all sender config files.
- `bash -n` on root, Linux, and macOS shell scripts.
- Path check confirmed `internal\runtime\go2rtc.exe`, legacy YAML templates, `internal\www\webrtc.html`, and archived docs exist.
- Fixed README default capture/output resolution text to match `1280x720` configs.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.

## 40. Legacy Portable ServerHost-Only Switching Config

Date:

- 2026-05-22 10:52

Scope:

- Simplified the latest WeChat external go2rtc portable pusher config so switching identical cloud servers only requires editing `cloud.serverHost` and `cloud.sshPassword`.
- Windows and Linux script loaders now derive `publicHost`, `sshHost`, SRT ingest URL, WHIP URL, viewer URL, STUN URL, and TURN URLs from `cloud.serverHost`.
- Removed visible cloud fixed fields from `config/sender-cloud.config.json`: public/SSH host duplicates, port constants, remote path constants, and manual ICE server objects.
- Kept backward compatibility for older configs that still contain `publicHost`, `sshHost`, or `webrtcIceServers`; loaders migrate them to `serverHost`.
- Added plaintext `cloud.sshPassword` lookup before falling back to old `config/local-secrets.config.json`.

Changed files:

- External telebot-main-0522\telebot-main\go2rtc-portable\config\sender-cloud.config.json
- External telebot-main-0522\telebot-main\go2rtc-portable\common\ConfigHelpers.ps1
- External telebot-main-0522\telebot-main\go2rtc-portable\setup-local.ps1
- External telebot-main-0522\telebot-main\go2rtc-portable\full-setup.ps1
- External telebot-main-0522\telebot-main\go2rtc-portable\linux\common.sh
- External telebot-main-0522\telebot-main\go2rtc-portable\linux\setup-local.sh
- External telebot-main-0522\telebot-main\go2rtc-portable\linux\full-setup.sh
- External telebot-main-0522\telebot-main\go2rtc-portable\README.md
- docs\VIDEO_LINK_AGENT.md
- frontend\IMPLEMENTATION_LOG.md
- docs\SHARED_AGENT_STATUS.md

Validation:

- Windows config derivation check with `Get-SenderCloudConfig`: verified `serverHost=150.109.100.30` generates SSH host, SRT ingest URL, viewer URL, and TURN/STUN URLs.
- JSON parse validation for `go2rtc-portable\config\sender-cloud.config.json`.
- `bash -n` validation for `linux\common.sh`, `linux\setup-local.sh`, `linux\full-setup.sh`, `linux\deploy-cloud.sh`, and `linux\start-local.sh`.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.

## 40. Legacy Portable Windows AMF Startup Fix

Date:

- 2026-05-21 18:10

Scope:

- Fixed the latest WeChat external go2rtc portable Windows sender so AMD AMF hardware encoding can be selected.
- Relaxed AMF selection: if `h264_amf` passes the runtime encode test but the periodic keyframe probe is inconclusive, the script now allows AMF and relies on normal FFmpeg startup validation.
- Fixed AMD AMF FFmpeg profile value from unsupported `baseline` to `constrained_baseline`.
- Fixed generated FFmpeg supervisor script corruption caused by embedding the heartbeat function in an expandable heredoc.
- Restored the heartbeat starter as an outer function and added parser validation for generated launch scripts.
- Improved startup failure reporting so fatal FFmpeg stderr, such as SRT I/O errors or encoder option errors, is surfaced directly instead of being misreported as "no active ffmpeg process".

Changed files:

- External go2rtc-portable-0520\go2rtc-portable\scripts\windows\start-camera-push-to-cloud.ps1
- docs\VIDEO_LINK_AGENT.md
- frontend\IMPLEMENTATION_LOG.md
- docs\SHARED_AGENT_STATUS.md

Validation:

- PowerShell parser validation on `scripts\windows\start-camera-push-to-cloud.ps1`.
- Verified local FFmpeg exposes `h264_amf`.
- Direct AMF profile probe showed `constrained_baseline`, `main`, and `high` work while `baseline` fails.
- Ran `scripts\windows\start-local.ps1`; AMF selection reached `h264_amf (hardware)` before the remaining SRT network failure.
- Confirmed cloud `go2rtc-srt-bridge.service` is active and listening on UDP `0.0.0.0:19091`.

Runtime/cloud impact:

- External Windows local sender behavior changed.
- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.
- Remaining runtime issue observed during validation: local FFmpeg failed to connect to `srt://150.109.100.30:19091` with `I/O error`; this is a UDP/SRT network path issue, not an AMF encoder option failure.

## 41. External Legacy Portable macOS Sender Support

Date:

- 2026-05-22 13:09

Scope:

- Added macOS support to the latest external `telebot-main-0522\telebot-main\go2rtc-portable` legacy sender package.
- Added a `macos\` script directory adapted from the older macOS sender scripts, but wired to the current 0522 single shared config.
- Updated root `.sh` entry points to dispatch automatically to `linux\` or `macos\` based on `uname -s`.
- Kept the simplified server switch rule: identical servers only require editing `cloud.serverHost` and plaintext `cloud.sshPassword`.
- macOS setup/start now uses AVFoundation camera detection, Homebrew dependency setup, and optional Apple VideoToolbox encoders.
- `config\sender-cloud.config.json` now keeps `sender.ffmpegPath` as `ffmpeg` so the shared config remains portable across Windows/Linux/macOS.

Changed files:

- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\common.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\camera_helper.py`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\setup-local.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\start-local.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\start-sender.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\stop-local.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\stop-sender.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\list-cameras.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\deploy-cloud.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\full-setup.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\start-all.sh`
- External `telebot-main-0522\telebot-main\go2rtc-portable\macos\stop-all.sh`
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
- Searched macOS scripts for stale `linux/common`, `require_linux_host`, `scripts/linux`, `scripts/macos`, `internal/www`, `sender-cloud.macos`, `legacy_sender_heartbeat`, `mapfile`, `readarray`, and `sort -z` references.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.
- Real AVFoundation camera capture was not runtime-tested on a Mac from this Windows environment; first real Mac test should run `bash setup-local.sh` and then `bash start-local.sh`.

## 40. Desktop P2P Push Uses Local Script Mode

Date:

- 2026-05-28 08:24

Scope:

- Changed the desktop mini app P2P push path to use the standalone local P2P pusher project at `E:\Desktop\123\p2p-local-pusher`.
- Kept the hosted web console P2P path on browser `getUserMedia`, because web mode cannot safely start local OS processes.
- Added local backend APIs for desktop-only P2P script status/start/stop.
- The desktop P2P panel now shows the local script process, selected profile, room, encoder, bitrate, camera, and watch URL instead of an in-browser preview.
- Desktop P2P start now syncs the current local-stream camera, resolution, frame rate, bitrate, encoder, and room into `pusher.config.json` before launching `start_local`.
- Desktop P2P stop now calls the script `stop_local`; app shutdown also attempts quiet cleanup.
- Added `hevc_nvenc` to the UI encoder list and leaves encoder selection enabled for desktop P2P script mode.
- Web mode blocks `/api/p2p-local-pusher/*` from starting server-side scripts and continues to use browser P2P.

Changed files:

- `backend\p2p_local_pusher.py`
- `backend\models.py`
- `backend\main.py`
- `frontend\src\api\cloudApi.ts`
- `frontend\src\types\cloud.ts`
- `frontend\src\pages\DashboardPage.tsx`
- `frontend\src\styles\globals.css`
- `frontend\src\styles\theme.css`
- `docs\VIDEO_LINK_AGENT.md`
- `frontend\IMPLEMENTATION_LOG.md`
- `docs\SHARED_AGENT_STATUS.md`

Validation:

- `python -m py_compile backend\p2p_local_pusher.py backend\models.py backend\main.py`
- `cmd /c npm.cmd run build --prefix frontend`
- Local manager smoke test confirmed `E:\Desktop\123\p2p-local-pusher` is detected and watch URL resolves to `https://p2p.cityulive.com/watch.html?room=robot`.
- `git diff --check -- backend\main.py backend\models.py backend\p2p_local_pusher.py frontend\src\api\cloudApi.ts frontend\src\types\cloud.ts frontend\src\pages\DashboardPage.tsx frontend\src\styles\globals.css frontend\src\styles\theme.css`
- `cmd /c npm.cmd run installer:build`

Runtime/cloud impact:

- Desktop EXE rebuilt and copied to `E:\Cloud-Service-Console\Cloud Service Console.exe`.
- Backend sidecar rebuilt and copied to `E:\Cloud-Service-Console\cloud-console-backend.exe`.
- Installer copied to `E:\Cloud-Service-Console\Cloud Service Console Setup.exe` and `E:\Cloud-Service-Console\Cloud Service Console_0.3.68_x64-setup.exe`.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console deployment, or video cloud protocol changed.
- This change is video-link scoped; control signal and Tank Trouble logic were not changed.

## 39. Legacy Portable Alternate Server Config Clarity

Date:

- 2026-05-21 17:50

Scope:

- Clarified that plaintext `cloud.sshPassword` remains visible and editable in each OS config.
- Moved `cloud.sshPassword` next to `cloud.sshHost` / `cloud.sshUser` in Windows, Linux, and macOS configs.
- Added config comments and README guidance for using another cloud server: edit `cloud.publicHost`, `cloud.sshHost`, `cloud.sshUser`, and `cloud.sshPassword` before running `setup-local`.

Changed files:

- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.windows.config.json
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.linux.config.json
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.macos.config.json
- External go2rtc-portable-0520\go2rtc-portable\README.md
- docs\VIDEO_LINK_AGENT.md
- frontend\IMPLEMENTATION_LOG.md
- docs\SHARED_AGENT_STATUS.md

Validation:

- JSON parse validation on Windows, Linux, and macOS configs.
- Confirmed all three configs expose `publicHost`, `sshHost`, `sshUser`, and `sshPassword`.
- Confirmed README documents the four fields for another cloud server.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.

## 38. Legacy Portable Password-Only Visible SSH Config

Date:

- 2026-05-21 17:41

Scope:

- Cleaned the latest WeChat external go2rtc portable pusher configs so normal users only see plaintext `cloud.sshPassword` for SSH credential setup.
- Removed visible `cloud.sshKeyPath` from Windows, Linux, and macOS system configs.
- Kept internal default SSH key path fallback in scripts for compatibility and automatic later connections, but users no longer need to edit RSA/key fields.
- Updated default config generators and README wording to match password-only visible config.
- Aligned generated default capture/output resolution to `1280x720`.

Changed files:

- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.windows.config.json
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.linux.config.json
- External go2rtc-portable-0520\go2rtc-portable\config\sender-cloud.macos.config.json
- External go2rtc-portable-0520\go2rtc-portable\scripts\common\ConfigHelpers.ps1
- External go2rtc-portable-0520\go2rtc-portable\scripts\linux\common.sh
- External go2rtc-portable-0520\go2rtc-portable\scripts\macos\common.sh
- External go2rtc-portable-0520\go2rtc-portable\README.md
- docs\VIDEO_LINK_AGENT.md
- frontend\IMPLEMENTATION_LOG.md
- docs\SHARED_AGENT_STATUS.md

Validation:

- Confirmed `sshKeyPath` no longer appears in `config` or `README.md`.
- JSON parse validation on all four config files.
- Confirmed Windows/Linux/macOS configs still contain `cloud.sshPassword`.
- PowerShell parser validation on touched Windows/shared scripts.
- `bash -n` on touched Linux/macOS shell scripts.

Runtime/cloud impact:

- No Cloud Service Console app runtime changed.
- No cloud runtime changed, restarted, renamed, or redeployed.
- No public port, cloud service name, control signal service, Tank Trouble service, hosted web console behavior, or video protocol changed.
