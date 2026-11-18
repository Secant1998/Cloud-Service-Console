# Cloud Service Console 控制信号接口使用说明

Last updated: 2026-05-05 13:55

这份文档给控制前端和机器人接收端同事使用。当前控制链路的职责很清楚：

- 云端控制信号服务只负责 WebRTC SDP offer/answer 中转。
- 浏览器前端和机器人接收端真正连通后，真实控制数据走 WebRTC DataChannel。
- 云端服务不解析、不转发、不定义真实控制数据内容。

## 1. 基础信息

公网入口：

```text
http://<server-host>:18081
```

老服务器示例：

```text
http://150.109.100.30:18081
```

默认会话 ID：

```text
robot-control
```

同一条控制链路里，浏览器前端和机器人接收端必须使用同一个 `session`。如果后续支持多台机器人，可以把 `session=robot-control` 换成对应机器人 ID。

## 2. 接口总览

| 用途 | 方法 | 路径 |
| --- | --- | --- |
| 健康检查 | `GET` | `/control/webrtc/health` |
| 状态查看 | `GET` | `/control/webrtc/status` |
| 浏览器提交 SDP offer | `POST` | `/control/webrtc/browser-offer?session=<robotId>&client_id=<frontendId>` |
| 机器人拉取下一个 offer | `GET` | `/control/webrtc/robot-next-offer?session=<robotId>&robot_client_id=<stableRobotReceiverId>` |
| 机器人提交 SDP answer | `POST` | `/control/webrtc/robot-answer?session=<robotId>&robot_client_id=<stableRobotReceiverId>&offer_id=<offerId>` |

## 3. 配对流程

1. 浏览器创建 `RTCPeerConnection`。
2. 浏览器创建 DataChannel，例如 `control`。
3. 浏览器创建 SDP offer。
4. 浏览器把 offer 提交到 `/control/webrtc/browser-offer?session=<robotId>&client_id=<frontendId>`。
5. 机器人持续轮询 `/control/webrtc/robot-next-offer?session=<robotId>&robot_client_id=<stableRobotReceiverId>`。
6. 机器人拿到 offer 后创建自己的 `RTCPeerConnection`，设置 remote offer，并创建 answer。
7. 机器人把 answer 提交到 `/control/webrtc/robot-answer?session=<robotId>&robot_client_id=<stableRobotReceiverId>&offer_id=<offerId>`。
8. 浏览器的 `browser-offer` 请求返回 answer。
9. 浏览器设置 remote answer。
10. WebRTC DataChannel 连通后，浏览器通过 DataChannel 发送真实控制数据。

## 4. 谁先等都可以吗

可以。当前实现已经支持浏览器侧长期等待机器人 answer：

- 机器人先“接听电话”：机器人接收端可以一直轮询 `robot-next-offer`。没有浏览器拨入时接口返回 `204 No Content`，稍后继续轮询即可。浏览器之后提交 offer，机器人下一次轮询就能拿到。
- 浏览器先“拨打电话”：浏览器提交 `browser-offer` 后，云端会挂起这个请求并等待机器人提交 answer。默认不再有应用层 20 秒超时；只要 HTTP 长连接没有被客户端、网络或公网代理中断，机器人之后上线并轮询到 offer，就能接通。

工程里的公网 Nginx 模板已把 `/control/webrtc/` 的读写超时设为 24 小时。实际产品里仍建议前端处理网络断线、浏览器刷新、移动网络切换等异常：

- 机器人端：持续轮询 `robot-next-offer`，每次带同一个 `robot_client_id`；收到 `204` 后延迟 300-1000 ms 再查；收到 `409 robot_listener_conflict` 表示同一个 robotId 已有另一个接收端在监听。
- 浏览器端：如果 `browser-offer` 请求被网络层中断，创建新的 offer 或重建连接，再次提交，直到用户取消或接通。

这不需要改变 DataChannel 的真实控制协议。如果运维手动启动控制信号服务时传入 `--offer-timeout-sec <seconds>` 且数值大于 0，则会重新启用有限等待。

## 5. 浏览器提交 Offer

请求：

```http
POST /control/webrtc/browser-offer?session=robot-control&client_id=frontend-a
Content-Type: application/json
```

请求体：

```json
{
  "type": "offer",
  "sdp": "v=0..."
}
```

成功响应是机器人 answer：

```json
{
  "type": "answer",
  "sdp": "v=0..."
}
```

curl 示例：

```bash
curl -X POST "http://150.109.100.30:18081/control/webrtc/browser-offer?session=robot-control&client_id=frontend-a" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"offer\",\"sdp\":\"v=0...\"}"
```

浏览器 JS 示例：

```js
async function postBrowserOffer(baseUrl, session, frontendId, offer) {
  const res = await fetch(
    `${baseUrl}/control/webrtc/browser-offer?session=${encodeURIComponent(session)}&client_id=${encodeURIComponent(frontendId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: offer.type, sdp: offer.sdp })
    }
  );

  if (!res.ok) {
    throw new Error(`browser-offer failed: ${res.status} ${await res.text()}`);
  }

  return await res.json();
}
```

## 6. 机器人拉取 Offer

请求：

```http
GET /control/webrtc/robot-next-offer?session=robot-control&robot_client_id=arm-001-receiver
```

有待处理 offer 时响应：

```json
{
  "ok": true,
  "session": "robot-control",
  "offerId": "44d21a0e-9d5c-4d61-9d9e-9b0f1dd0b1d0",
  "createdAt": "2026-05-05T05:48:00.000000+00:00",
  "robotClientId": "arm-001-receiver",
  "offer": {
    "type": "offer",
    "sdp": "v=0..."
  }
}
```

没有待处理 offer 时：

```text
HTTP 204 No Content
```

curl 示例：

```bash
curl -i "http://150.109.100.30:18081/control/webrtc/robot-next-offer?session=robot-control&robot_client_id=arm-001-receiver"
```

机器人端 JS 伪代码：


同一个 robotId 已有其他机器人接收端监听时：

```http
HTTP 409 Conflict
Content-Type: application/json
```

```json
{
  "ok": false,
  "error": "robot_listener_conflict",
  "message": "This robotId already has an active robot listener.",
  "session": "robot-control",
  "activeRobotClientId": "arm-001-receiver",
  "activeAgeMs": 1200,
  "retryAfterSec": 9
}
```

```js
async function pollNextOffer(baseUrl, session, robotClientId) {
  const res = await fetch(
    `${baseUrl}/control/webrtc/robot-next-offer?session=${encodeURIComponent(session)}&robot_client_id=${encodeURIComponent(robotClientId)}`,
    { cache: "no-store" }
  );

  if (res.status === 204) return null;
  if (!res.ok) {
    throw new Error(`robot-next-offer failed: ${res.status} ${await res.text()}`);
  }

  return await res.json();
}
```

## 7. 机器人提交 Answer

请求：

```http
POST /control/webrtc/robot-answer?session=robot-control&robot_client_id=arm-001-receiver&offer_id=<offerId>
Content-Type: application/json
```

请求体：

```json
{
  "type": "answer",
  "sdp": "v=0..."
}
```

成功响应：

```json
{
  "ok": true,
  "session": "robot-control",
  "offerId": "44d21a0e-9d5c-4d61-9d9e-9b0f1dd0b1d0",
  "robotClientId": "arm-001-receiver"
}
```

curl 示例：

```bash
curl -X POST "http://150.109.100.30:18081/control/webrtc/robot-answer?session=robot-control&robot_client_id=arm-001-receiver&offer_id=44d21a0e-9d5c-4d61-9d9e-9b0f1dd0b1d0" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"answer\",\"sdp\":\"v=0...\"}"
```

## 8. DataChannel 控制数据

信令服务不限制 DataChannel 里的真实控制消息格式。浏览器和机器人接收端可以约定一个稳定 JSON 协议，例如：

```json
{
  "type": "keyboard",
  "seq": 123,
  "ts": 1777980000000,
  "pressedKeys": ["W", "A"]
}
```

推荐字段：

- `type`: 消息类型，例如 `keyboard`。
- `seq`: 前端递增序号，方便机器人丢弃旧包。
- `ts`: 前端时间戳，毫秒。
- `pressedKeys`: 当前按住的键名数组。

键名建议统一为大写，例如 `W`, `A`, `S`, `D`, `Q`, `E`, `R`, `F`, `TAB`, `ESC`。

## 9. TURN 配置

当前 TURN/STUN 配置：

```text
turn:<server-host>:3478?transport=udp
turn:<server-host>:3478?transport=tcp
username: telemetry
credential: 123456
```

浏览器 WebRTC 示例：

```js
const pc = new RTCPeerConnection({
  iceServers: [
    {
      urls: [
        "turn:150.109.100.30:3478?transport=udp",
        "turn:150.109.100.30:3478?transport=tcp"
      ],
      username: "telemetry",
      credential: "123456"
    }
  ]
});
```

## 10. 健康检查和排查

健康检查：

```bash
curl "http://150.109.100.30:18081/control/webrtc/health"
```

状态查看：

```bash
curl "http://150.109.100.30:18081/control/webrtc/status"
```

如果公网 `18081` 能访问，但控制信令接口返回 `404`，通常不是端口问题，而是 Nginx 缺少 `/control/webrtc/` 代理。这个路径应该代理到云端内部控制服务：

```text
127.0.0.1:18085
```

## 11. 接入注意事项

- 浏览器前端和机器人接收端必须使用同一个 `session`。
- `browser-offer` 是等待 answer 的长请求，默认没有应用层 20 秒超时。
- 浏览器端如果要长时间“等待接听”，需要保持这个请求；如果网络层断开，再自动重新发起 offer。
- 机器人端收到 HTTP `204` 时，稍后继续轮询即可。
- 机器人端要用返回的 `offerId` 原样提交 answer。
- 多个浏览器可以同时连接同一个机器人 `session`，机器人端应给每个 offer 创建独立连接。
- 真实控制指令必须通过 WebRTC DataChannel 发送，不要通过信令接口传控制数据。
