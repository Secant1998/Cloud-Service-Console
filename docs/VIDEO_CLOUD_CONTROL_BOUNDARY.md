# 视频云端配置不要影响控制信号的边界说明

给视频推流同事：

## 不能碰

- 不要关闭、重启替换或改名控制服务：`go2rtc-control-signaling`。
- 不要占用或改掉控制服务内部端口：`127.0.0.1:18085`。
- 不要改掉公网 HTTP 入口：`18081/tcp`。
- 如果重写 `/etc/nginx/conf.d/go2rtc-cloud.conf`，必须保留下面三个代理路径：
  - `/control/webrtc/`
  - `/control/monitor/`
  - `/command/webrtc/`
- 不要把 `/control/webrtc/`、`/control/monitor/` 或 `/command/webrtc/` 代理到 go2rtc 视频服务。
- 不要改控制 TURN 端口：`3478/udp`、`3478/tcp`。
- 不要改控制接口规则里的 `session` / `client_id` / `compute_client_id` / `edge_client_id` 参数要求。

## 必须保留的控制接口

```text
GET  http://<server>:18081/control/webrtc/health
GET  http://<server>:18081/control/webrtc/status
POST http://<server>:18081/control/webrtc/frontend-offer?session=<robotId>&client_id=<frontendId>
GET  http://<server>:18081/control/webrtc/compute-next-offer?session=<robotId>&compute_client_id=<computeId>
POST http://<server>:18081/control/webrtc/compute-answer?session=<robotId>&compute_client_id=<computeId>&offer_id=<offerId>
POST http://<server>:18081/command/webrtc/compute-offer?session=<robotId>&client_id=<computeId>
GET  http://<server>:18081/command/webrtc/edge-next-offer?session=<robotId>&edge_client_id=<edgeId>
POST http://<server>:18081/command/webrtc/edge-answer?session=<robotId>&edge_client_id=<edgeId>&offer_id=<offerId>
POST http://<server>:18081/control/monitor/key-state?session=<robotId>&client_id=<frontendId>
GET  http://<server>:18081/control/monitor/key-state?session=<robotId>
```

`browser-offer`、`robot-next-offer` 和 `robot-answer` 只作为旧设备迁移期兼容别名保留，新代码不得继续调用。

## 可以改

- go2rtc 视频流配置。
- 视频流名称、视频页面、视频 WebSocket 路径。
- 视频服务内部端口，但不要覆盖 `18085`。
- Nginx 里的视频相关 `location`，但不要删除或覆盖控制相关 `location`。

## 改完后快速自检

```bash
curl http://<server>:18081/control/webrtc/health
curl http://<server>:18081/control/webrtc/status
curl "http://<server>:18081/control/monitor/key-state?session=robot-control"
```

这三个接口都不能返回 `404`。如果返回 `404`，通常是 Nginx 的控制代理路径被视频配置覆盖了。
