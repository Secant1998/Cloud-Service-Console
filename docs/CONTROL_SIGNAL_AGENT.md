# Control Signal Agent Handoff

Last updated: 2026-05-13

Owner: browser-to-robot control signaling, WebRTC DataChannel broker, side-channel local control monitor keyboard.

## 1. Responsibilities

- Maintain cloud control signaling broker.
- Maintain local backend APIs that let the mini app monitor side-channel frontend key-state.
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
- `frontend\src\types\cloud.ts` only for control monitor API types.
- `frontend\src\pages\DashboardPage.tsx` only for control monitor keyboard view.
- `frontend\src\styles\globals.css` and `frontend\src\styles\theme.css` only for control monitor UI styling.
- `docs\CONTROL_SIGNAL_FULL_SETUP_GUARD.md`.

Do not modify:

- Video ingest mode, go2rtc stream viewer pages, or video preview logic.
- `backend\cloud_setup_bundle\tank_trouble_room.py`.
- `backend\tank_trouble_cloud.py`.
- `frontend\src\components\TankTroublePanel.tsx`.

## 3. Current Control Architecture

Cloud broker:

- `backend\cloud_setup_bundle\control_signaling.py` now tags browser offers with a client role and distinguishes user frontend offers from internal compute/arm command offers.
- `backend\main.py` and `backend\health_checker.py` now prefer user frontend pending-offer counts for the control monitor and ignore internal `robot-command` style offers when building the mini-app-facing dialing state.
- `frontend\src\pages\DashboardPage.tsx` polls control key-state at a lower floor of 50ms for side-channel keyboard rendering and no longer forces a 200ms minimum.
- `backend\main.py` avoids an extra `/control/webrtc/status` fallback fetch when `key-state` already includes a `linkStatus` payload.

Recent note:

- The latest tuning improved keyboard responsiveness, but there is still an open check for duplicate "connected" clients when internal command links are active.

- Script: `backend\cloud_setup_bundle\control_signaling.py`
- Remote path: `/opt/go2rtc-cloud/control_signaling.py`
- Internal service: `go2rtc-control-signaling`
- Internal bind: `127.0.0.1:18085`
- Public WebRTC signaling prefix: `http://<host>:18081/control/webrtc/`
- Public monitor prefix: `http://<host>:18081/control/monitor/`
- Default session / robot id: `robot-control`

WebRTC signaling endpoints:

- `GET /control/webrtc/health`
- `GET /control/webrtc/status`
- `POST /control/webrtc/browser-offer?session=<robotId>&client_id=<frontendId>`
- `GET /control/webrtc/robot-next-offer?session=<robotId>&robot_client_id=<stableRobotReceiverId>`
- `POST /control/webrtc/robot-answer?session=<robotId>&robot_client_id=<stableRobotReceiverId>&offer_id=...`

Side-channel monitor endpoints:

- `POST /control/monitor/key-state?session=<robotId>&client_id=<frontendId>`
- `GET /control/monitor/key-state?session=<robotId>`

TURN/STUN:

- App-provided TURN URLs use current logged-in host and port `3478`.
- Username: `telemetry`
- Credential: `123456`
- This is exposed by `GET /api/control-monitor/config`.

## 4. WebRTC Pairing Contract

The server is a signaling broker only:

- Frontend posts an SDP offer to `browser-offer` with `session=<robotId>` and stable `client_id=<frontendId>`.
- Robot polls `robot-next-offer` with the same `session=<robotId>` and a stable `robot_client_id`.
- Robot posts its SDP answer to `robot-answer` with the same `session`, the same `robot_client_id`, and the returned `offer_id`.
- After answer delivery, frontend and robot own the WebRTC DataChannel.
- The server does not parse, version, prioritize, or relay the real control payload.

Frontend dialer identity:

- `client_id` identifies the frontend dialer instance.
- `browser-offer` now requires `client_id`; missing it returns `HTTP 400`.
- Multiple frontends may dial the same `session` by using different `client_id` values.
- The robot receives `clientId` / `frontendClientId` alongside each offer for diagnostics.

Robot receiver exclusivity:

- `session` is the robot id used for frontend-to-robot matching.
- `robot_client_id` identifies the physical robot-side receiver process/device.
- One `session` can have only one active robot receiver at a time.
- The first receiver that polls `robot-next-offer` claims the listener slot for that `session`.
- Repeated polls or answers from the same `robot_client_id` are accepted.
- A different `robot_client_id` on the same `session` gets `HTTP 409` with `error=robot_listener_conflict` while the first receiver is fresh.
- The default listener freshness window is 10 seconds. If the first receiver stops polling, another receiver may claim the slot after the window expires.
- `GET /control/webrtc/status` exposes `robotListenerClientId`, `robotListenerAgeMs`, `robotListenerFreshMs`, and `robotListenerConflictCount` for diagnostics.

Multiple frontends may dial the same robot id:

- Every frontend offer gets a unique `offerId`.
- The robot receiver should create an independent `RTCPeerConnection` for every offer it accepts.
- Server matching is per `session + offerId`.
- Browser offers now wait indefinitely at the control broker by default; `--offer-timeout-sec` only enables a finite timeout when set to a value greater than `0`.
- Full setup Nginx config keeps `/control/webrtc/` read/send proxy timeouts at `86400s` so long browser-offer waits can survive normal public gateway timeouts.

Service management note:

- The service-management `Control Signaling` row only starts/stops/checks `go2rtc-control-signaling` and reads `/control/webrtc/health` / `/control/webrtc/status`; it does not perform browser or robot pairing.
- Setup/result helper URLs should still use the current contract examples: `browser-offer?session=robot-control&client_id=frontend-a` and `robot-next-offer?session=robot-control&robot_client_id=arm-001-receiver`.

## 5. Mini App Control Monitor

Purpose:

- The mini app is a side-channel monitor for frontends that report key-state.
- It polls the cloud broker for `/control/monitor/key-state`.
- It does not call `robot-next-offer`.
- It does not post `robot-answer`.
- It cannot steal browser-to-robot WebRTC offers from the real robot receiver.
- It can show keys even when the robot has not answered the WebRTC call, as long as the frontend posts key-state.
- It displays multiple frontends by `clientId`; the keyboard lights the union of all active clients' pressed keys.
- It assigns stable local color slots to active frontend clients: green, blue, red, then yellow.
- Active clients keep their assigned color while they remain active.
- When a client expires or disconnects, its color slot is released.
- New clients take the highest-priority free color slot.
- If multiple clients press the same key, the key uses a mixed gradient of those clients' colors.
- The monitor status strip shows three link lamps:
  - `前端拨号`: true when there is a pending browser offer or an active frontend reports a dialing/connecting call state.
  - `后端接听`: true when the robot receiver has polled `robot-next-offer` recently; the freshness window is 5 seconds.
  - `直连成功`: true only when an active frontend key-state report says the WebRTC/DataChannel is connected/open/live.
- The frontend dialing and backend listening lamps include a compact latency readout:
  - `RTT`: client explicitly reported `latencyMs` / `rttMs`.
  - `sent`: broker or local backend estimated delay from a client send timestamp such as `sentAtMs`, `clientSentAtMs`, or `ts`.
  - `seen`: fallback freshness age from the latest server-observed key-state update or robot poll.
- The signaling broker cannot directly observe ongoing DataChannel liveness after answer delivery. `answersPosted > 0` is now used as a paired-state fallback for the three link lamps, while true live confirmation and all virtual-keyboard input still require frontend side-channel key-state reports.

Frontend implementation:

- `frontend\src\pages\DashboardPage.tsx`
- State includes `controlMonitorEnabled`, `controlMonitorPressedKeys`, `controlMonitorClients`, `controlMonitorLinkStatus`, `controlMonitorMessageCount`, `controlMonitorPeerState`.
- UI panel title: `控制监视键盘`.
- Keyboard rows are defined near `CONTROL_MONITOR_KEY_ROWS`.
- The monitor keyboard always shows at least `Q W E R`, `A S D F`, and `Z X C V`; it reveals only fully fitting right-side columns responsively as the actually visible keyboard area allows while keeping one centered keyboard track, normal keyboard-style half-key row offsets, and square keycaps.

Frontend API wrappers:

- `getControlMonitorConfig()`
- `getControlMonitorKeyState(session)`
- Legacy wrappers `pollControlMonitorOffer(session, robotClientId)` and `postControlMonitorAnswer(session, offerId, robotClientId, payload)` still exist for backend compatibility, but Dashboard must not use them.

Local backend APIs:

- `GET /api/control-monitor/config`
- `GET /api/control-monitor/key-state?session=robot-control`
- Legacy receiver-style APIs still exist:
  - `GET /api/control-monitor/offer?session=robot-control&robot_client_id=<stableRobotReceiverId>`
  - `POST /api/control-monitor/answer?session=robot-control&robot_client_id=<stableRobotReceiverId>&offer_id=...`

Backend implementation:

- `BackendState.build_control_monitor_config()`
- `BackendState.get_control_monitor_key_state()`
- URL builder `_control_monitor_key_state_url(...)`
- Local backend also reads `/control/webrtc/status` to build a compatible `linkStatus` when the cloud broker has not yet been upgraded to return one from `/control/monitor/key-state`.
- When local fallback and broker `linkStatus` disagree, the backend ORs boolean lamp states and keeps the highest counters so stale broker-side `false` values do not hide a completed offer/answer pairing.
- Legacy receiver-style helpers still exist but are not used by Dashboard:
  - `BackendState.poll_control_monitor_offer()`
  - `BackendState.post_control_monitor_answer()`
  - URL builder `_control_monitor_url(...)`

## 6. Side-Channel Key-State Payloads

Frontend monitor post:

```http
POST /control/monitor/key-state?session=<robotId>&client_id=<frontendId>
Content-Type: application/json
```

Suggested payload:

```json
{
  "seq": 123,
  "ts": 1777980000000,
  "latencyMs": 32,
  "type": "keyboard_sample",
  "callState": "dialing",
  "pressedKeys": ["W", "A"]
}
```

Optional latency payload fields:

- Frontend key-state monitor posts may include `latencyMs`, `latency_ms`, `rttMs`, `rtt_ms`, `serverLatencyMs`, or `server_latency_ms`; these are treated as explicit RTT/latency and shown as `RTT`.
- If no explicit latency is present, the broker can estimate from `sentAtMs`, `sent_at_ms`, `clientSentAtMs`, `client_sent_at_ms`, or `ts` and shows the source as `sent`.
- If neither is present, the mini app falls back to update freshness and shows the source as `seen`.
- Robot receiver polls/answers may include optional query fields `latency_ms`, `latencyMs`, `rtt_ms`, or `rttMs`; `robot-answer` may also include these fields in the JSON body. When present, the backend listening lamp shows that value as `RTT`.

Recommended `callState` values for monitor lamps:

- Dialing / waiting: `dialing`, `calling`, `connecting`, `offering`, `waiting`, `waiting-answer`, `have-local-offer`.
- Directly connected: `connected`, `open`, `live`, `ready`, `datachannel-open`.
- Empty or unknown states do not block the broker-paired fallback after an answer has been delivered, but the virtual keyboard stays empty unless the frontend posts `pressedKeys`.

Server behavior:

- Stores only the latest state per `session + client_id`.
- Tracks `firstSeenAt` and `firstSeenOrder` for each active monitor client.
- Drops stale frontend clients after `monitor_ttl_sec`, default `3.0`.
- Accepts keyboard arrays from `pressedKeys`, `pressed_keys`, or `keys`.
- Returns every active frontend in `clients`.
- Returns `clients[*].latencyMs`, `clients[*].latencySource`, and `linkStatus.frontendLatencyMs` / `backendLatencyMs` when available.
- Returns `linkStatus` with `frontendDialing`, `backendListening`, `directConnected`, latency fields, offer/poll/answer counters, active/dialing/connected client counts, and latest browser/robot/answer timestamps.
- Does not forward monitor payloads to the robot.

The virtual keyboard displays normalized key names such as:

- `TAB`, `Q`, `W`, `E`, `R`, `T`, `F`, `ESC`, `A`, `S`, `D`, `Z`, `X`

## 7. Cloud Setup Notes

Cloud setup writes:

- `/etc/systemd/system/go2rtc-control-signaling.service`
- Nginx `location /control/webrtc/` proxy in `/etc/nginx/conf.d/go2rtc-cloud.conf`
- Nginx `location /control/monitor/` proxy in `/etc/nginx/conf.d/go2rtc-cloud.conf`

Current full setup behavior:

- `CloudSetupBundle._install_services()` installs the control signaling unit but disables/stops it by default.
- Manual service management can start/stop `go2rtc-control-signaling`.
- The generated `go2rtc-control-signaling.service` does not pass `--offer-timeout-sec`, so browser offers use the default indefinite app-level wait.
- The generated service also relies on the default robot listener freshness window, equivalent to `--robot-listener-ttl-sec 10`.
- Be careful with full setup because overwriting `go2rtc-cloud.conf` can remove or alter control proxy locations if not kept in sync.

See also:

- `docs\CONTROL_SIGNAL_FULL_SETUP_GUARD.md`
- `docs\CONTROL_SIGNAL_API_USAGE.md`

Old server deployment status:

- `150.109.100.30` was updated on 2026-05-05 17:31.
- `/opt/go2rtc-cloud/control_signaling.py` is synced to the exclusive robot receiver lock version.
- `/etc/nginx/conf.d/go2rtc-cloud.conf` contains both `/control/webrtc/` and `/control/monitor/` proxy blocks to `127.0.0.1:18085`.
- `go2rtc-control-signaling` and `nginx` were active after deployment.
- Validation confirmed `/control/webrtc/health`, `/control/webrtc/status`, `/control/webrtc/robot-next-offer`, `/control/webrtc/robot-answer`, and `/control/monitor/key-state`. Same `robot_client_id` repeated polls are accepted, a second receiver gets `409`, and the correct receiver can complete answer delivery.

## 8. External References

Reference frontend from user:

- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\telebot`

Reference independent receiver:

- `E:\wechat\xwechat_files\wxid_o5apxkf7kjxr11_8e6a\msg\file\2026-05\receive_control_stream(6).py`

These are not owned by this mini app unless the user explicitly asks.

## 9. Validation

Recommended local checks:

```powershell
python -m py_compile backend\cloud_setup_bundle\control_signaling.py backend\cloud_setup.py backend\main.py backend\models.py
cmd /c npm --prefix frontend run build
```

Cloud checks:

- `http://<host>:18081/control/webrtc/health`
- `http://<host>:18081/control/webrtc/status`
- `http://<host>:18081/control/monitor/key-state?session=robot-control`

Monitor UI test:

- Log in.
- Go to service management.
- Enable `控制监视键盘`.
- Have one or more frontends post `/control/monitor/key-state` with distinct `client_id`.
- Confirm the virtual keyboard lights, message count increases, and the client list shows every active frontend.
- Confirm a real robot receiver can still poll `robot-next-offer` without the mini app consuming the offer.

## 10. Documentation Update Rule

After every control change:

- Update this file.
- Update `docs\CONTROL_SIGNAL_FULL_SETUP_GUARD.md` if setup behavior changes.
- Update `frontend\IMPLEMENTATION_LOG.md`.
- If public endpoints, ports, TURN config, or service names changed, update `docs\AGENT_HANDOFF_MASTER_INDEX.md`.
