# Control Signal Agent Handoff

Last updated: 2026-05-05

Owner: browser-to-robot control signaling, WebRTC DataChannel broker, local control monitor keyboard.

## 1. Responsibilities

- Maintain cloud control signaling broker.
- Maintain local backend APIs that let the mini app monitor control input.
- Maintain the mini app virtual keyboard view in service management.
- Maintain any independent receiver guidance/scripts used by robot-side control receivers.
- Keep control signaling independent from video and Tank Trouble.

## 2. Strict Boundaries

Allowed to modify:

- `backend\cloud_setup_bundle\control_signaling.py`
- `backend\cloud_setup.py` only for control signaling service/proxy install.
- `backend\config.py` only for control service/health metadata.
- `backend\health_checker.py` only for control health/status checks.
- `backend\main.py` only for `/api/control-monitor/*` and control setup integration.
- `backend\models.py` only for control request/response models.
- `frontend\src\api\cloudApi.ts` only for control monitor API wrappers.
- `frontend\src\pages\DashboardPage.tsx` only for control monitor keyboard/DataChannel view.
- `docs\CONTROL_SIGNAL_FULL_SETUP_GUARD.md`.

Do not modify:

- Video ingest mode, go2rtc stream viewer pages, or video preview logic.
- `backend\cloud_setup_bundle\tank_trouble_room.py`.
- `backend\tank_trouble_cloud.py`.
- `frontend\src\components\TankTroublePanel.tsx`.

## 3. Current Control Architecture

Cloud broker:

- Script: `backend\cloud_setup_bundle\control_signaling.py`
- Remote path: `/opt/go2rtc-cloud/control_signaling.py`
- Internal service: `go2rtc-control-signaling`
- Internal bind: `127.0.0.1:18085`
- Public proxy prefix: `http://<host>:18081/control/webrtc/`
- Default session: `robot-control`

Broker endpoints:

- `GET /control/webrtc/health`
- `GET /control/webrtc/status`
- `POST /control/webrtc/browser-offer?session=robot-control`
- `GET /control/webrtc/robot-next-offer?session=robot-control`
- `POST /control/webrtc/robot-answer?session=robot-control&offer_id=...`

TURN/STUN:

- App-provided TURN URLs use current logged-in host and port `3478`.
- Username: `telemetry`
- Credential: `123456`
- This is exposed by `GET /api/control-monitor/config`.

## 4. Mini App Control Monitor

Purpose:

- The mini app can temporarily act like a robot-side control receiver.
- It polls the cloud broker for browser offers.
- It answers with a local WebRTC peer.
- It receives DataChannel messages and lights the virtual keyboard.

Frontend implementation:

- `frontend\src\pages\DashboardPage.tsx`
- State includes `controlMonitorEnabled`, `controlMonitorPressedKeys`, `controlMonitorMessageCount`, `controlMonitorPeerState`.
- UI panel title: `控制监视键盘`.
- Keyboard rows are defined near `CONTROL_MONITOR_KEY_ROWS`.

Frontend API wrappers:

- `getControlMonitorConfig()`
- `pollControlMonitorOffer(session)`
- `postControlMonitorAnswer(session, offerId, payload)`

Local backend APIs:

- `GET /api/control-monitor/config`
- `GET /api/control-monitor/offer?session=robot-control`
- `POST /api/control-monitor/answer?session=robot-control&offer_id=...`

Backend implementation:

- `BackendState.build_control_monitor_config()`
- `BackendState.poll_control_monitor_offer()`
- `BackendState.post_control_monitor_answer()`
- URL builder `_control_monitor_url(...)`

## 5. DataChannel Payloads

The control monitor currently recognizes these message types:

- `keyboard_sample`
- `vr_sample`
- `text_instruction`
- `client_hello`
- `ping`

Keyboard payload is normalized from:

- `pressedKeys`
- `pressed_keys`
- `keys`

The virtual keyboard displays normalized key names such as:

- `TAB`, `Q`, `W`, `E`, `R`, `T`, `F`, `ESC`, `A`, `S`, `D`, `Z`, `X`

## 6. Cloud Setup Notes

Cloud setup writes:

- `/etc/systemd/system/go2rtc-control-signaling.service`
- Nginx `location /control/webrtc/` proxy in `/etc/nginx/conf.d/go2rtc-cloud.conf`

Current full setup behavior:

- `CloudSetupBundle._install_services()` installs the control signaling unit but disables/stops it by default.
- Manual service management can start/stop `go2rtc-control-signaling`.
- Be careful with full setup because overwriting `go2rtc-cloud.conf` can remove or alter control proxy locations if not kept in sync.

See also:

- `docs\CONTROL_SIGNAL_FULL_SETUP_GUARD.md`

## 7. External References

Reference frontend from user:

- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\telebot`

Reference independent receiver:

- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\receive_control_stream(6).py`

These are not owned by this mini app unless the user explicitly asks.

## 8. Validation

Recommended local checks:

```powershell
python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\cloud_setup.py backend\main.py backend\models.py
cmd /c npm --prefix frontend run build
```

Cloud checks:

- `http://<host>:18081/control/webrtc/health`
- `http://<host>:18081/control/webrtc/status`

Monitor UI test:

- Log in.
- Go to service management.
- Enable `控制监视键盘`.
- Send browser-side control input.
- Confirm the virtual keyboard lights and message count increases.

## 9. Documentation Update Rule

After every control change:

- Update this file.
- Update `docs\CONTROL_SIGNAL_FULL_SETUP_GUARD.md` if setup behavior changes.
- Update `frontend\IMPLEMENTATION_LOG.md`.
- If public endpoints, ports, TURN config, or service names changed, update `docs\AGENT_HANDOFF_MASTER_INDEX.md`.
