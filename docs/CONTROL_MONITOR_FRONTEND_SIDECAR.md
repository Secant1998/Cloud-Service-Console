# Control Monitor Frontend Sidecar

前端和机械臂的真实控制仍走 WebRTC DataChannel。小程序只需要前端在本地旁路上报一份状态，不参与控制通路，也不测延迟。

## Endpoint

```text
POST http://150.109.100.30:18081/control/monitor/key-state?session=<robotId>&client_id=<frontendId>
Content-Type: application/json
```

- `session`: 机器人 ID，例如 `robot-control`。
- `client_id`: 前端实例 ID。同一个浏览器页签保持稳定；多个前端要不同。

## Payload

```json
{
  "type": "keyboard_sample",
  "inputMode": "keyboard",
  "callState": "open",
  "pressedKeys": ["KeyW", "KeyA"],
  "sequence": 123,
  "sampledAt": "2026-05-06T12:00:00.000Z"
}
```

必填字段：

- `inputMode`: `keyboard`、`vr` 或 `text`，用于小程序显示当前模式。
- `callState`: 连接状态。未接通/断开用 `idle` 或 `closed`；拨号中用 `dialing`、`connecting` 或 `waiting-answer`；DataChannel 可用后用 `open`、`connected`、`live` 或 `ready`。
- `pressedKeys`: 当前按下的键，键盘模式发实时按键；VR/text 模式可发空数组。

可选字段：

- `type`、`sequence`、`sampledAt`、`timestamp` 等可以照抄原控制包，服务器不再用它们计算延迟。

## Recommended Hook

DataChannel 主通路先发，旁路异步发，失败直接丢弃，不要阻塞控制：

```js
dataChannel.send(JSON.stringify(payload));

void fetch(
  `http://150.109.100.30:18081/control/monitor/key-state?session=${encodeURIComponent(robotId)}&client_id=${encodeURIComponent(frontendId)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      inputMode: currentInputMode,
      callState: dataChannel.readyState === "open" ? "open" : "dialing",
      pressedKeys: currentPressedKeys,
      sampledAt: new Date().toISOString()
    })
  }
).catch(() => {});
```

建议上报频率：

- 拨号/断开状态变化时立即上报一次。
- 键盘输入变化时上报；也可以 10-30Hz 节流上报。
- DataChannel `close/error` 时上报 `callState: "closed"`。

小程序灯号规则：

- 前端灯：无旁路/未接通灰色，拨号中黄色，`callState=open/connected/live/ready` 绿色。
- 接收端灯：未接通灰色，服务器看到接收端监听黄色，前端旁路确认连通后绿色。
- 直连灯：前端和接收端都为绿色时才绿色。
