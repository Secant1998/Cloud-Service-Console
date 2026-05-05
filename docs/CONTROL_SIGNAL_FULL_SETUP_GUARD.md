# Control Signal Guard Notes For Video Full Setup

This note is for teammates who frequently run the video-side `full setup` on the cloud server.

The video setup can be re-run, but it must not remove or overwrite the control-signal public proxy path.

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
http://150.109.100.30:18081/control/webrtc/robot-next-offer?session=robot-control
http://150.109.100.30:18081/control/webrtc/robot-answer?session=robot-control&offer_id=...
```

If `18081` is reachable but these paths return `404 page not found`, the network port is not the problem. It means the control-signaling route is missing from the public gateway.

## Required Control-Signal Components

These items belong to the control-signal path and should not be removed by video-only setup scripts:

```text
/opt/go2rtc-cloud/control_signaling.py
go2rtc-control-signaling service/process
127.0.0.1:18085
nginx location /control/webrtc/
```

Expected internal process:

```text
/usr/bin/python3 /opt/go2rtc-cloud/control_signaling.py --host 127.0.0.1 --port 18085
```

Expected internal listener:

```text
127.0.0.1:18085
```

## Required Nginx Proxy Block

The public `18081` nginx config must keep this block:

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

But `/etc/nginx/conf.d/go2rtc-cloud.conf` did not contain the `/control/webrtc/` proxy block. As a result, nginx sent `/control/webrtc/...` to the video/go2rtc upstream on `127.0.0.1:18082`, and go2rtc returned `404` because it does not own the control API.

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
```

Expected result:

```text
Both commands should return normal JSON.
```

Diagnosis:

```text
Internal 18085 works, public 18081 returns 404:
nginx proxy block for /control/webrtc/ is missing.

Internal 18085 fails:
control_signaling.py or go2rtc-control-signaling service is not running.

Public 18081 unreachable:
cloud firewall/security group/nginx/public gateway issue.
```

## Safe Fix

If internal `18085` is working but public `18081` returns `404`, restore the nginx `/control/webrtc/` block and reload nginx:

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
```

The video path and control path share the public `18081` nginx gateway, but they are independent services behind it.

