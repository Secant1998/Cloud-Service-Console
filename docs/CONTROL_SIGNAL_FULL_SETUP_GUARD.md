# Control Signal Guard Notes For Video Full Setup

This note is for teammates who frequently run the video-side `full setup` on the cloud server.

The video setup can be re-run, but it must not remove or overwrite the control-signal public proxy paths.

## Background

On the old cloud server:

```text
public host: 150.109.100.30
public HTTP port: 18081
control signaling internal port: 18085
```

The desktop console control monitor uses the public `18081` entry and expects these HTTP paths to exist:

```text
http://150.109.100.30:18081/control/webrtc/health
http://150.109.100.30:18081/control/webrtc/status
http://150.109.100.30:18081/control/webrtc/browser-offer?session=robot-control&client_id=<frontendId>
http://150.109.100.30:18081/control/webrtc/robot-next-offer?session=robot-control&robot_client_id=<stableRobotReceiverId>
http://150.109.100.30:18081/control/webrtc/robot-answer?session=robot-control&robot_client_id=<stableRobotReceiverId>&offer_id=...
http://150.109.100.30:18081/control/monitor/key-state?session=robot-control
```

If `18081` is reachable but these paths return `404 page not found`, the network port is not the problem. It means a control-signaling route is missing from the public gateway.

## Required Control-Signal Components

These items belong to the control-signal path and should not be removed by video-only setup scripts:

```text
/opt/go2rtc-cloud/control_signaling.py
go2rtc-control-signaling service/process
127.0.0.1:18085
nginx location /control/webrtc/
nginx location /control/monitor/
```

Expected internal process:

```text
/usr/bin/python3 /opt/go2rtc-cloud/control_signaling.py --host 127.0.0.1 --port 18085
```

By default the control broker has no app-level timeout for browser offers. Do not add `--offer-timeout-sec` to the service unless a finite browser-offer wait is explicitly desired.

Browser frontends must pass `client_id` to `browser-offer`; robot receivers must pass `robot_client_id` to `robot-next-offer` and `robot-answer`. Missing either identity returns `HTTP 400`.

By default each `session` / robot id has one active robot receiver slot. Robot-side receivers must pass a stable `robot_client_id` to `robot-next-offer` and `robot-answer`. A second different `robot_client_id` on the same `session` returns `HTTP 409` while the first receiver is fresh. The default freshness window is 10 seconds; change it only with an explicit control-lane decision via `--robot-listener-ttl-sec`.

The control monitor `linkStatus` can show the three lamps as paired after the broker completes a browser-offer / robot-answer exchange, even if the frontend has not posted side-channel key-state. The virtual keyboard still only lights from `/control/monitor/key-state` frontend reports. Restarting `go2rtc-control-signaling` clears in-memory monitor/signaling counters, although already established browser-to-robot DataChannels are not routed through the broker.

Expected internal listener:

```text
127.0.0.1:18085
```

## Required Nginx Proxy Blocks

The public `18081` nginx config must keep these blocks:

```nginx
location /control/webrtc/ {
    proxy_http_version 1.1;
    proxy_pass http://127.0.0.1:18085;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

```nginx
location /control/monitor/ {
    proxy_http_version 1.1;
    proxy_pass http://127.0.0.1:18085;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

This block is separate from video paths such as:

```text
/api/ws
/api/webrtc
/video-endpoints.json
/main-camera.html
/telemetry/
```

## What Happened In The 404 Case

The old server was reachable on `18081`, and video endpoints such as `/video-endpoints.json` returned `200`.

However, control monitor paths returned `404`:

```text
/control/webrtc/health
/control/webrtc/status
/control/webrtc/robot-next-offer
```

Server inspection showed:

```text
control_signaling.py was running on 127.0.0.1:18085
nginx was running on public 0.0.0.0:18081
```

But `/etc/nginx/conf.d/go2rtc-cloud.conf` did not contain the `/control/webrtc/` proxy block. As a result, nginx sent `/control/webrtc/...` to the video/go2rtc upstream on `127.0.0.1:18082`, and go2rtc returned `404` because it does not own the control API. The same rule now applies to the side-channel monitor path `/control/monitor/...`.

Most likely cause:

```text
video-side full setup regenerated /etc/nginx/conf.d/go2rtc-cloud.conf as a pure-video config
and removed the control-signaling proxy block.
```

## Post Full-Setup Checklist

After running video `full setup`, verify both checks:

```bash
curl http://127.0.0.1:18085/control/webrtc/health
curl http://150.109.100.30:18081/control/webrtc/health
curl -i "http://150.109.100.30:18081/control/webrtc/robot-next-offer?session=robot-control&robot_client_id=health-check-receiver"
curl http://150.109.100.30:18081/control/monitor/key-state?session=robot-control
```

Expected result:

```text
Health and monitor commands should return normal JSON. The robot-next-offer command should return 204 when no frontend is dialing, or 200 with an offer when one is pending. A 409 means another robot receiver is already actively listening for that robot id.
```

Diagnosis:

```text
Internal 18085 works, public 18081 returns 404:
nginx proxy block for /control/webrtc/ or /control/monitor/ is missing.

Internal 18085 fails:
control_signaling.py or go2rtc-control-signaling service is not running.

Public 18081 unreachable:
cloud firewall/security group/nginx/public gateway issue.
```

## Safe Fix

If internal `18085` is working but public `18081` returns `404`, restore the nginx `/control/webrtc/` and `/control/monitor/` blocks and reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Do not change video ingest/playback settings when only fixing this control route.

## Do Not Touch During Video-Only Setup

Please avoid deleting, stopping, or overwriting:

```text
/opt/go2rtc-cloud/control_signaling.py
127.0.0.1:18085 listener
go2rtc-control-signaling service/process
nginx location /control/webrtc/
nginx location /control/monitor/
```

The video path and control path share the public `18081` nginx gateway, but they are independent services behind it.
