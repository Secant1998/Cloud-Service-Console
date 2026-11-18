# P2P 视频服务新服务器部署流程

本文档说明如何在另一台服务器上搭一套和当前 `https://p2p.cityulive.com` 类似的 P2P 视频服务。

这套服务包含三部分：

- `webrtc-p2p-video`：P2P signaling 服务和网页观看端。
- `nginx + HTTPS`：对外提供 `https://你的域名`。
- `coturn`：提供 STUN/TURN，跨网无法直连时用于中继。

本流程只部署 P2P 视频服务，不涉及旧 go2rtc 链路、腾讯云直播、控制信号链路或 Tank Trouble。

## 1. 准备信息

先确定这些值：

```text
服务器公网 IP：SERVER_PUBLIC_IP
P2P 域名：p2p-new.example.com
服务器 SSH 用户：ubuntu
P2P 默认房间：robot
TURN 用户名：telemetry
TURN 密码：123456
```

示例里会用：

```text
p2p-new.example.com
SERVER_PUBLIC_IP
```

实际部署时把它们换成你自己的。

## 2. 域名解析

在域名 DNS 管理后台添加一条 A 记录：

```text
主机记录：p2p-new
记录类型：A
记录值：SERVER_PUBLIC_IP
TTL：默认即可
```

如果你的完整域名是 `p2p-new.example.com`，那么主机记录通常填 `p2p-new`。

等待解析生效后，在本机测试：

```bash
ping p2p-new.example.com
```

能解析到 `SERVER_PUBLIC_IP` 即可。`ping` 不通不一定代表失败，有些服务器禁 ICMP；重点是域名解析出的 IP 要对。

## 3. 云服务器安全组 / 防火墙

在云厂商安全组放行：

```text
TCP 22        SSH
TCP 80        certbot 申请 HTTPS 证书
TCP 443       HTTPS 访问 P2P signaling / watch 页面
UDP 3478      TURN/STUN
TCP 3478      TURN over TCP
UDP 49152-49200  TURN relay 端口范围，推荐放行
```

不建议公网放行 `8099`。`8099` 是 Python signaling 服务内部端口，由 nginx 反代到 HTTPS。

如果服务器本机启用了 `ufw`，也放行：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:49200/udp
sudo ufw reload
```

如果没启用 `ufw`，这一步可以跳过，以云安全组为准。

## 4. 安装服务器依赖

SSH 登录新服务器：

```bash
ssh ubuntu@SERVER_PUBLIC_IP
```

安装依赖：

```bash
sudo apt update
sudo apt install -y python3 nginx coturn certbot python3-certbot-nginx curl tar
```

`webrtc-p2p-video/server.py` 只使用 Python 标准库，不需要额外 Python 包。

## 5. 上传 webrtc-p2p-video 服务端代码

在 Windows 本机 PowerShell 执行：

```powershell
cd E:\Desktop\123
tar -czf webrtc-p2p-video-deploy.tar.gz webrtc-p2p-video
scp .\webrtc-p2p-video-deploy.tar.gz ubuntu@SERVER_PUBLIC_IP:/tmp/
```

在新服务器上执行：

```bash
sudo rm -rf /opt/webrtc-p2p-video
sudo tar -xzf /tmp/webrtc-p2p-video-deploy.tar.gz -C /opt
sudo chown -R ubuntu:ubuntu /opt/webrtc-p2p-video
```

确认文件存在：

```bash
ls -la /opt/webrtc-p2p-video
ls -la /opt/webrtc-p2p-video/public
```

应该能看到：

```text
server.py
config.json
public/watch.html
public/shared.js
public/style.css
```

## 6. 修改 P2P 服务配置

编辑：

```bash
nano /opt/webrtc-p2p-video/config.json
```

推荐配置如下：

```json
{
  "port": 8099,
  "bindHost": "127.0.0.1",
  "defaultRoom": "robot",
  "iceServers": [
    {
      "urls": [
        "stun:p2p-new.example.com:3478",
        "stun:stun.l.google.com:19302"
      ]
    },
    {
      "urls": [
        "turn:p2p-new.example.com:3478?transport=udp",
        "turn:p2p-new.example.com:3478?transport=tcp"
      ],
      "username": "telemetry",
      "credential": "123456"
    }
  ],
  "messageHistoryLimit": 120,
  "pusherTtlSeconds": 15,
  "peerTtlSeconds": 60,
  "pollTimeoutMs": 5000,
  "messageMaxAgeSeconds": 60,
  "viewerReadyMaxAgeSeconds": 30
}
```

必须改：

```text
p2p-new.example.com
```

如果改了 TURN 用户名或密码，也要同步改这里：

```json
"username": "telemetry",
"credential": "123456"
```

## 7. 配置 systemd 服务

创建服务文件：

```bash
sudo tee /etc/systemd/system/webrtc-p2p-video.service >/dev/null <<'EOF'
[Unit]
Description=WebRTC P2P Video Signaling Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/webrtc-p2p-video
ExecStart=/usr/bin/python3 /opt/webrtc-p2p-video/server.py
Restart=always
RestartSec=2
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF
```

如果服务器用户名不是 `ubuntu`，把这里改掉：

```text
User=ubuntu
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now webrtc-p2p-video.service
sudo systemctl status webrtc-p2p-video.service --no-pager
```

确认是：

```text
active (running)
```

本机测试内部端口：

```bash
curl -s http://127.0.0.1:8099/api/config
curl -s http://127.0.0.1:8099/api/rooms
```

## 8. 配置 nginx 反代

创建 nginx 配置：

```bash
sudo tee /etc/nginx/sites-available/webrtc-p2p-video >/dev/null <<'EOF'
server {
    listen 80;
    server_name p2p-new.example.com;

    location / {
        proxy_pass http://127.0.0.1:8099;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

把 `p2p-new.example.com` 换成你的域名。

启用站点：

```bash
sudo ln -sf /etc/nginx/sites-available/webrtc-p2p-video /etc/nginx/sites-enabled/webrtc-p2p-video
sudo nginx -t
sudo systemctl reload nginx
```

申请 HTTPS 证书：

```bash
sudo certbot --nginx -d p2p-new.example.com
```

按提示输入邮箱并同意条款。完成后测试：

```bash
curl -I https://p2p-new.example.com/
curl -s https://p2p-new.example.com/api/config
curl -s https://p2p-new.example.com/api/rooms
```

`/api/config` 应该返回 JSON，并且里面的 STUN/TURN 域名应该是你的新域名。

## 9. 配置 coturn

先备份原配置：

```bash
sudo cp /etc/turnserver.conf /etc/turnserver.conf.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null || true
```

写入 coturn 配置：

```bash
sudo tee /etc/turnserver.conf >/dev/null <<'EOF'
listening-port=3478
listening-ip=0.0.0.0
external-ip=SERVER_PUBLIC_IP
realm=p2p-new.example.com

fingerprint
lt-cred-mech
user=telemetry:123456

min-port=49152
max-port=49200

no-cli
no-multicast-peers
EOF
```

必须替换：

```text
SERVER_PUBLIC_IP
p2p-new.example.com
```

如果你在 `config.json` 里改了 TURN 用户名或密码，这里也要一致：

```text
user=telemetry:123456
```

启用 coturn：

```bash
if grep -q '^#\?TURNSERVER_ENABLED=' /etc/default/coturn; then
  sudo sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
else
  echo 'TURNSERVER_ENABLED=1' | sudo tee -a /etc/default/coturn
fi

sudo systemctl enable --now coturn
sudo systemctl restart coturn
sudo systemctl status coturn --no-pager
```

确认是：

```text
active (running)
```

确认端口监听：

```bash
sudo ss -lntup | grep 3478
```

## 10. 服务端验证

在任意电脑浏览器打开：

```text
https://p2p-new.example.com/
https://p2p-new.example.com/watch.html?room=robot
https://p2p-new.example.com/api/config
https://p2p-new.example.com/api/rooms
```

`/api/config` 应该类似：

```json
{
  "ok": true,
  "defaultRoom": "robot",
  "iceServers": [
    {
      "urls": [
        "stun:p2p-new.example.com:3478",
        "stun:stun.l.google.com:19302"
      ]
    },
    {
      "urls": [
        "turn:p2p-new.example.com:3478?transport=udp",
        "turn:p2p-new.example.com:3478?transport=tcp"
      ],
      "username": "telemetry",
      "credential": "123456"
    }
  ]
}
```

如果这里还是 `p2p.cityulive.com`，说明 `config.json` 没改好或服务没重启。

重启 signaling：

```bash
sudo systemctl restart webrtc-p2p-video.service
```

## 11. 配置本地 P2P 推流端

把本地推流端工程给同学：

```text
E:\Desktop\123\p2p-local-pusher
```

在推流机器上编辑：

```text
p2p-local-pusher/config/pusher.config.json
```

把所有 `signalBaseUrl` 改成新域名，把房间改成要使用的房间。

示例：

```json
{
  "user": {
    "signalBaseUrl": "https://p2p-new.example.com",
    "roomId": "robot-test"
  },
  "signalBaseUrl": "https://p2p-new.example.com",
  "roomId": "robot-test"
}
```

实际文件里还有摄像头、分辨率、帧率、编码器等字段，不要删掉；只改 `signalBaseUrl` 和 `roomId` 即可。

第一次使用先配置环境：

Windows：

```bat
setup_local.cmd
```

Linux/macOS：

```bash
bash setup_local.sh
```

开始推流：

Windows：

```bat
start_local.cmd
```

Linux/macOS：

```bash
bash start_local.sh
```

停止推流：

Windows：

```bat
stop_local.cmd
```

Linux/macOS：

```bash
bash stop_local.sh
```

## 12. 观看端验证

推流端使用房间：

```text
robot-test
```

观看端打开：

```text
https://p2p-new.example.com/watch.html?room=robot-test
```

如果能看到画面，说明 signaling、HTTPS、推流端和观看端基本都正常。

如果同城能看、跨城看不到，重点检查 TURN：

- 云安全组是否放行 `UDP 3478`、`TCP 3478`、`UDP 49152-49200`。
- `/opt/webrtc-p2p-video/config.json` 的 TURN 域名、用户名、密码是否和 `/etc/turnserver.conf` 一致。
- `external-ip` 是否是服务器公网 IP。
- `coturn` 是否 active。

## 13. 房间状态接口

查看当前有哪些 P2P 视频房间正在推：

```bash
curl -s https://p2p-new.example.com/api/rooms
```

查看某个房间详细状态：

```bash
curl -s https://p2p-new.example.com/api/rooms/robot-test/status
```

清理一个没有 active pusher 的房间：

```bash
curl -X POST https://p2p-new.example.com/api/rooms/robot-test/reset
```

注意：如果房间里有 active pusher，reset 会返回冲突，避免误删正在推流的房间。

## 14. 常见问题

### 14.1 `https://域名/api/config` 打不开

检查：

```bash
sudo systemctl status nginx --no-pager
sudo systemctl status webrtc-p2p-video.service --no-pager
sudo nginx -t
curl -s http://127.0.0.1:8099/api/config
```

如果本机 `127.0.0.1:8099` 正常，但 HTTPS 不正常，多半是 nginx 或证书问题。

### 14.2 页面能打开，但观看端黑屏

检查：

- 推流端和观看端的 `room` 是否完全一致。
- 推流端是否真的启动成功。
- `https://域名/api/rooms` 是否能看到 active 房间。
- 浏览器是否阻止自动播放，可以点一下页面或刷新。

### 14.3 本地能看，外地看不了

优先检查 TURN：

```bash
sudo systemctl status coturn --no-pager
sudo ss -lntup | grep 3478
```

再检查云安全组是否放行：

```text
UDP 3478
TCP 3478
UDP 49152-49200
```

### 14.4 `/api/config` 里的 ICE 还是旧域名

说明 `config.json` 没改好或服务没重启：

```bash
sudo nano /opt/webrtc-p2p-video/config.json
sudo systemctl restart webrtc-p2p-video.service
curl -s https://p2p-new.example.com/api/config
```

### 14.5 查看日志

signaling：

```bash
sudo journalctl -u webrtc-p2p-video.service -n 100 --no-pager
sudo journalctl -u webrtc-p2p-video.service -f
```

nginx：

```bash
sudo tail -n 100 /var/log/nginx/error.log
sudo tail -n 100 /var/log/nginx/access.log
```

coturn：

```bash
sudo journalctl -u coturn -n 100 --no-pager
sudo journalctl -u coturn -f
```

## 15. 给同学的最短检查清单

```text
1. 域名 A 记录指向新服务器公网 IP。
2. 安全组放行 TCP 80/443/3478、UDP 3478、UDP 49152-49200。
3. /opt/webrtc-p2p-video/config.json 改成新域名。
4. webrtc-p2p-video.service active。
5. nginx HTTPS 能访问 https://新域名/api/config。
6. coturn active，turn 域名/用户名/密码与 config.json 一致。
7. 推流端 p2p-local-pusher 里 signalBaseUrl 改成 https://新域名。
8. 推流端和观看端 room 一致。
9. 观看地址：https://新域名/watch.html?room=房间号。
```

## 16. 当前线上服务作为参考

当前香港 P2P 服务参考：

```text
域名：https://p2p.cityulive.com
服务目录：/opt/webrtc-p2p-video
systemd 服务：webrtc-p2p-video.service
内部端口：8099
TURN 端口：3478
默认房间：robot
```

当前广州 P2P 服务参考：

```text
域名：https://p2p-gz.dlcourse.online
服务目录：/opt/webrtc-p2p-video-gz
systemd 服务：webrtc-p2p-video-gz.service
内部端口：8099
TURN 端口：3478
默认房间：robot
```

新服务器可以照香港服务的结构搭，但域名、服务名和路径可以按自己的环境调整。
