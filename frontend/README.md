# Cloud Service Console Frontend README

这份 README 是当前 `Cloud Service Console` 小程序的前端侧总交接文档。

如果后续有别的 agent 接手这个项目，默认先读这 3 份文档：

1. `frontend/README.md`
2. `frontend/IMPLEMENTATION_LOG.md`
3. `frontend/UI_AGENT_SPEC.md`

根目录里的 `README.md` 和 `AGENT_V3_MIGRATION_GUIDE.md` 仍然保留，但它们现在更像早期迁移说明。面向当前小程序交接、维护、继续开发时，应以 `frontend` 目录下这 3 份文档为准。

另外，`frontend/UI_Agent_长期需求规范.md` 只是为了兼容旧文件名保留的入口文件，真正内容仍以 `frontend/UI_AGENT_SPEC.md` 为准。

## 1. 这是什么

这是一个桌面小程序，当前产品名为 `Cloud Service Console`，目标是把旧的控制台能力迁移到新的桌面架构中：

- 桌面壳：Tauri
- 前端 UI：React + TypeScript + Vite
- 本地后端：Python + FastAPI
- 云端交互：Python 后端通过 SSH / HTTP / WebRTC 控制和查询远端服务

它现在不只是“前端页面”，而是一套完整的桌面工具，覆盖以下能力：

- 登录到云服务器
- 保存登录信息、自动登录
- 统一查看云端服务状态
- 启停云端服务
- 手动做健康检查和端口检查
- 切换视频接收模式 `HTTP` / `SRT`
- 打开云端视频预览
- 在本机临时接管前端控制信号接收并用 UI 可视化显示
- 在“玩玩游戏”栏目运行内嵌的坦克游戏
- 在“测试延迟”入口下运行一条“本地单坦克 + 本机网页预览”的轻量预览链路

## 2. 当前架构总览

```text
Tauri desktop shell
-> React frontend (frontend/src)
-> FastAPI backend sidecar (backend/main.py + backend/launcher.py)
-> Paramiko SSH / HTTP checks / cloud control
-> Remote services and remote helper scripts
```

更具体一点：

- `src-tauri` 负责桌面壳、sidecar backend 启动、关闭时清理 sidecar。
- `frontend` 负责所有桌面 UI、视图切换、交互、游戏画面、视频预览窗口、控制监视 UI。
- `backend` 负责所有敏感逻辑，包括 SSH 登录、远端服务启停、远端配置部署、端口检查、云端状态汇总、控制监视中继对接、坦克游戏云端桥接。
- `backend/cloud_setup_bundle` 是需要部署到云端或随 backend 打包的内部资源包。

## 3. 当前目录里哪些路径和这个小程序有关

下面这些路径是当前小程序的核心路径。

### 3.1 前端真身

- `frontend/package.json`
  前端依赖和脚本。
- `frontend/src/App.tsx`
  应用总入口，负责登录页 / 主控制台切换、主题初始化。
- `frontend/src/main.tsx`
  React 挂载入口。
- `frontend/src/pages/LoginPage.tsx`
  登录页。
- `frontend/src/pages/DashboardPage.tsx`
  主控制台页面，包含概览、服务管理、健康检查、活动日志、玩玩游戏。
- `frontend/src/components`
  公共 UI 组件目录。
- `frontend/src/components/TankTroublePanel.tsx`
  坦克游戏主文件，当前整个游戏前端主逻辑基本都在这里。
- `frontend/src/api/cloudApi.ts`
  前端访问本地 FastAPI backend 的所有接口封装。
- `frontend/src/types/cloud.ts`
  前后端协议对应的 TypeScript 类型定义。
- `frontend/src/styles/globals.css`
  全局布局和大部分组件样式。
- `frontend/src/styles/theme.css`
  浅色 / 深色主题样式变量和主题层样式。
- `frontend/public/flags`
  国旗资源，供连接快照和地区信息展示使用。
- `frontend/public/games/tank-trouble/assets`
  当前前端真正使用的坦克游戏静态贴图资源。

### 3.2 后端真身

- `backend/main.py`
  FastAPI 主入口，定义状态收集、API 路由、云端服务管理、控制监视桥接、坦克游戏 API。
- `backend/launcher.py`
  打包后的 backend sidecar 启动入口，负责 parent watchdog，确保主程序退出时 backend 也退出。
- `backend/config.py`
  内置默认配置、服务清单、端口清单、健康检查清单、登录信息存储路径规则。
- `backend/service_manager.py`
  远端 systemd 服务控制、服务状态查询、端口监听检查、当前 ingest 模式识别。
- `backend/health_checker.py`
  云端 HTTP 健康检查逻辑。
- `backend/cloud_setup.py`
  云端部署、内置 bundle 配置读取、切换 ingest 模式、生成远端配置等逻辑。
- `backend/cloud_client.py`
  远端 SSH 客户端封装。
- `backend/settings_store.py`
  登录设置的读写与迁移。
- `backend/log_store.py`
  本地活动日志内存存储。
- `backend/tank_trouble_cloud.py`
  本地 backend 和云端坦克房间脚本之间的桥。
- `backend/models.py`
  FastAPI / Pydantic 接口模型定义。

### 3.3 云端部署资源包

- `backend/cloud_setup_bundle/config/sender-cloud.config.json`
  内置云端模板配置。注意：现在是项目内置模板，不再要求用户在项目外单独提供运行时配置文件。
- `backend/cloud_setup_bundle/control_signaling.py`
  云端控制 signaling 服务脚本。
- `backend/cloud_setup_bundle/telemetry_relay.py`
  云端 telemetry / relay 相关脚本。
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  云端坦克房间、地图、投票、延迟测试逻辑真身。
- `backend/cloud_setup_bundle/www`
  云端网页资源。

### 3.4 桌面壳与打包

- `package.json`
  根目录 Tauri 脚本入口。
- `src-tauri/tauri.conf.json`
  Tauri 构建配置、窗口大小、打包目标、sidecar 配置。
- `src-tauri/src/main.rs`
  Tauri Rust 主程序，负责启动 backend sidecar、给前端注入 backend base URL、关闭时清理进程。
- `scripts/build_backend_bundle.py`
  先用 PyInstaller 打 backend sidecar，再复制到 `src-tauri/binaries`。
- `src-tauri/binaries`
  打包时实际引用的 backend sidecar 所在目录。

### 3.5 参考 / 历史代码

- `games/tank-trouble/original`
  这是最初参考过的坦克游戏原始目录。当前桌面小程序运行时不直接依赖这一套原始 Python 游戏代码，但部分设计、资源或玩法参考来自这里。

### 3.6 不要误改的生成物

下面这些通常不是“该改的源代码”：

- `frontend/dist`
- `backend/dist`
- `backend/build`
- `src-tauri/target`
- `src-tauri/binaries/*.exe`
- `**/__pycache__`
- `*.tsbuildinfo`

## 4. 当前页面结构和每个页面负责什么

### 4.1 登录页

入口文件：

- `frontend/src/pages/LoginPage.tsx`

当前职责：

- 输入云服务器 `Host`
- 输入 SSH 用户名
- 输入 SSH 密码
- 记住密码
- 自动登录
- 主题切换
- 登录中状态反馈

当前行为约束：

- `Host` 默认提示值是 `150.109.100.30`，但应表现为 placeholder，而不是已填好的正式值。
- 开启 `自动登录` 时会自动联动开启 `记住密码`。
- 关闭 `记住密码` 时会联动关闭 `自动登录`。

### 4.2 主控制台

主文件：

- `frontend/src/pages/DashboardPage.tsx`

当前 5 个视图：

- `overview`
- `services`
- `health`
- `activity`
- `games`

对应左侧导航：

- 控制台总览
- 服务管理
- 健康检查
- 活动日志
- 玩玩游戏

### 4.3 控制台总览

主要内容：

- 云端目标
- 公网入口
- 待处理控制
- 当前模式
- 服务运行数
- 健康检查数
- 最近刷新时间
- 当前连接快照
- 健康检查摘要

这里的“公网入口”对应的是当前登录云服务器推导出的 `public_base_url`。

### 4.4 服务管理

主要内容：

- 云端服务卡片
- 一键启动全部 / 停止全部
- 切换视频接收模式 `HTTP` / `SRT`
- 云端视频窗口
- 控制监视键盘

其中：

- 视频窗口默认查看 `main-camera`
- 控制监视键盘用于本机临时接管 `robot-control` 会话，观察来自网页端的控制按键

### 4.5 健康检查

主要内容：

- 手动端口检测
- 健康检查状态列表

这里不是持续监听所有端口，而是手动检查，符合用户之前的要求：避免让服务器持续做无意义高频监控。

### 4.6 活动日志

主要内容：

- 显示 backend 内存中的活动日志
- 用于查看登录、刷新、服务启停、切换模式、配置执行、错误信息

### 4.7 玩玩游戏

主要内容：

- 坦克游戏入口
- 单人训练模式
- 临时延迟测试模式

当前游戏前端主逻辑集中在：

- `frontend/src/components/TankTroublePanel.tsx`

## 5. 当前功能清单

### 5.1 登录与会话

- 后端保存登录设置
- 支持记住密码
- 支持自动登录
- 支持断开会话
- 未登录时返回登录页

### 5.2 主题

- 支持浅色模式
- 支持深色模式
- 前端主题存储 key：`cloud-service-console.theme`

### 5.3 云端状态汇总

- 服务运行数
- 健康检查数
- 最近刷新时间
- 公网入口
- 当前视频 ingest 模式
- 待处理控制 offer 数
- 当前连接快照

### 5.4 云端服务管理

当前固定管理 4 个服务：

1. `nginx`
2. `go2rtc-cloud`
3. `go2rtc-srt-bridge`
4. `go2rtc-control-signaling`

在 UI 中显示标题分别是：

1. `Nginx Gateway`
2. `go2rtc Cloud`
3. `Ingest Bridge`
4. `Control Signaling`

其中第 3 个已经统一叫 `Ingest Bridge`，不再在 UI 层区分旧的 “SRT bridge” 名称。

### 5.5 视频 ingest 模式切换

当前支持两种模式：

- `http`
- `srt`

后端判断与切换逻辑在：

- `backend/service_manager.py`
- `backend/cloud_setup.py`
- `backend/main.py`

### 5.6 视频预览

服务管理页右侧可打开视频预览。

当前策略：

- 优先尝试 WebRTC 预览
- 失败时可回退到 MP4 预览
- 视频流名固定为 `main-camera`

相关前端位置：

- `frontend/src/pages/DashboardPage.tsx`

相关后端接口：

- `GET /api/video-preview.mp4`

### 5.7 控制监视键盘

这个功能的目的不是代替机械臂正式控制链路，而是在本机临时接入 `robot-control` 会话，直接看网页端按键有没有通过云端 signaling 到达这里。

当前特征：

- 使用 WebRTC data channel
- 本机显示按下的 `Q W E R T / A S D F / Z X C`
- 显示消息计数和最近更新时间
- 不开启时不占用控制会话

相关前端位置：

- `frontend/src/pages/DashboardPage.tsx`

相关后端位置：

- `backend/main.py`

云端相关路径：

- `backend/cloud_setup_bundle/control_signaling.py`

### 5.8 一键配置

UI 上虽然叫 “一键配置”，但当前实际含义是：

- 检查云端环境是否就绪
- 如果未就绪，则部署 / 修复云端 bundle

它不是“本地机器环境配置器”，只是因为早期命名沿用了 `local_setup` 这组 API 名称。

对应后端：

- `backend/main.py`
  - `check_local_setup`
  - `ensure_local_setup`
  - `evaluate_local_setup_ready`
  - `run_local_setup_script`

真正执行的内容在：

- `backend/cloud_setup.py`

### 5.9 坦克游戏

坦克游戏当前已经是这个小程序的一部分，不是外挂网页。

当前包含：

- 训练模式
- 训练模式内置一个简单本地电脑玩家 `CPU-1`，只在前端本地引擎里运行，不经过云端，不碰正式视频 / 控制链路，也不进入延迟测试模式
- 房间同步
- 计分板
- 颜色选择
- 地图投票换图
- 临时延迟测试模式（本地单坦克 + 本机网页预览）
- 当前所有实际带战斗判定的模式，统一使用同一套底层规则：
- 坦克移动速度 `1.6 格/秒`
- 每玩家同时最多 `5` 发炮弹
- 单发寿命 `10` 秒
- 炮弹速度 `1.85 格/秒`

当前“测试延迟”入口的真实含义：

- 桌面端仍然运行本地实时游戏引擎
- 不再把前端输入发到云端驱动一个克隆坦克
- 预览目标改为：通过本机 backend 提供一个浏览器页面，实时显示当前战场和计分板
- 浏览器预览页当前入口：`/tank-trouble/preview`
- 浏览器预览只显示战场地图和计分板，不显示启动按钮、返回按钮或其他控制台 UI
- 前端当前只向 backend 周期上报“本地玩家坦克快照”
- backend 会基于房间缓存、预览会话缓存和服务端规则自行组装 `scene / rows / map_label / runtime_summary`
- backend 里的浏览器 viewer 会基于 backend 生成的 `scene` 在 `<canvas>` 上本地重绘战场，而不是显示 `<img>` 截图

旧的云端 latency API 和 `tank_trouble_room.py` 里的相关逻辑当前仍然保留在工程里，但前端“测试延迟”入口已经不再走那条链路。

- 浏览器预览页当前内容严格限制为“战场地图 + 计分板”
- 当前桌面端 latency 模式会关闭本地电脑玩家，只保留一个本地玩家坦克

坦克游戏前端主文件：

- `frontend/src/components/TankTroublePanel.tsx`

坦克游戏云端逻辑：

- `backend/cloud_setup_bundle/tank_trouble_room.py`

坦克游戏本地后端桥接：

- `backend/tank_trouble_cloud.py`
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_preview_page.py`

## 6. 坦克游戏相关路径总表

### 6.1 当前实际生效的代码

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_preview_runtime.py`
- `backend/tank_trouble_preview_page.py`
- `backend/tank_trouble_cloud.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

### 6.2 当前实际使用的游戏资源

- `frontend/public/games/tank-trouble/assets/tankGreen.png`
- `frontend/public/games/tank-trouble/assets/tankRed.png`
- `frontend/public/games/tank-trouble/assets/tankRed2.png`

### 6.3 参考代码，不是运行真身

- `games/tank-trouble/original/tank_trouble.py`
- `games/tank-trouble/original/README.md`
- `games/tank-trouble/original/游戏说明.txt`
- `games/tank-trouble/original/image/*`

## 7. 内置默认值和云端对象清单

### 7.1 登录默认值

定义在 `backend/config.py`：

- `publicScheme = http`
- `apiPort = 18081`
- `sshPort = 22`
- `sshUser = ubuntu`
- `defaultHost = 150.109.100.30`

### 7.2 当前管理的远端服务

定义在 `backend/config.py`：

- `nginx`
- `go2rtc-cloud`
- `go2rtc-srt-bridge`
- `go2rtc-control-signaling`

### 7.3 当前端口检查项

定义在 `backend/config.py`：

- `ssh` -> `22/tcp`
- `public-http` -> `18081/tcp`
- `internal-api` -> `18082/tcp`
- `ingest-http` -> `18084/tcp`
- `webrtc` -> `19090/udp,tcp`
- `srt` -> `19091/udp`
- `rtsp` -> `8554/tcp`

### 7.4 当前健康检查项

定义在 `backend/config.py`：

- `clock` -> `/clock`
- `streams` -> `/api/streams`
- `control` -> `/control/webrtc/health`

### 7.5 内置 bundle 模板配置

定义文件：

- `backend/cloud_setup_bundle/config/sender-cloud.config.json`

当前模板关键字段：

- `streamName = main-camera`
- `remoteBase = /opt/go2rtc-cloud`
- `apiPort = 18081`
- `ingestPort = 18084`
- `internalApiPort = 18082`
- `telemetryInternalPort = 18083`
- `controlSignalingInternalPort = 18085`
- `webrtcPort = 19090`
- `srtIngestPort = 19091`
- `rtspPort = 8554`
- `transport.ingestMode = http`

注意：

- 这个文件现在是项目内置模板。
- 当前小程序的运行不要求用户在项目外额外维护一份同名配置。
- 但是 backend 的云端部署逻辑仍然会读取它，作为项目内部的“默认真身”。

## 8. 前端到 backend 的 API 清单

当前前端接口封装文件：

- `frontend/src/api/cloudApi.ts`

### 8.1 基础

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/login`
- `POST /api/logout`

### 8.2 状态与连接

- `GET /api/status`
- `GET /api/status/live`
- `POST /api/refresh`
- `GET /api/network-snapshot`
- `POST /api/network-snapshot/refresh`
- `GET /api/logs`

### 8.3 云端服务

- `POST /api/services/start-all`
- `POST /api/services/stop-all`
- `POST /api/services/{service_name}/start`
- `POST /api/services/{service_name}/stop`
- `POST /api/ingest-mode/switch`

### 8.4 健康 / 端口

- `POST /api/ports/check-all`
- `POST /api/ports/{port_key}/check`

### 8.5 云端配置

- `GET /api/local-setup/check`
- `POST /api/local-setup/run`

### 8.6 视频预览

- `GET /api/video-preview.mp4`

### 8.7 控制监视

- `GET /api/control-monitor/config`
- `GET /api/control-monitor/offer`
- `POST /api/control-monitor/answer`

### 8.8 坦克游戏

- `POST /api/games/tank-trouble/room/sync`
- `POST /api/games/tank-trouble/room/vote-toggle`
- `POST /api/games/tank-trouble/room/leave`
- `POST /api/games/tank-trouble/preview/push`
- `POST /api/games/tank-trouble/preview/clear`
- `GET /api/games/tank-trouble/preview/state`
- `WS /api/games/tank-trouble/latency/ws`
- `POST /api/games/tank-trouble/latency/sync`
- `POST /api/games/tank-trouble/latency/leave`

## 9. 本地存储、运行时输出、持久化位置

### 9.1 前端 localStorage

- `cloud-service-console.theme`
- `cloud-service-console:tank-trouble-player-id`
- `cloud-service-console:tank-trouble-leaderboard`

### 9.2 登录设置文件

由 `backend/settings_store.py` 和 `backend/config.py` 管理。

Windows：

- `%LOCALAPPDATA%/CloudServiceConsole/cloud-console-login.json`

macOS：

- `~/Library/Application Support/CloudServiceConsole/cloud-console-login.json`

Linux：

- `~/.local/share/CloudServiceConsole/cloud-console-login.json`

兼容旧位置：

- `<runtime_dir>/data/cloud-console-login.json`

### 9.3 打包产物与中间产物

前端构建产物：

- `frontend/dist`

backend PyInstaller 产物：

- `backend/dist/cloud-console-backend-x86_64-pc-windows-msvc.exe`

Tauri sidecar 引用位置：

- `src-tauri/binaries/cloud-console-backend-x86_64-pc-windows-msvc.exe`

桌面主程序：

- `src-tauri/target/release/Cloud Service Console.exe`

Windows 安装包：

- `src-tauri/target/release/bundle/nsis/Cloud Service Console_0.3.0_x64-setup.exe`

## 10. 运行方式与打包方式

### 10.1 单独跑前端

在 `frontend` 目录：

```powershell
npm install
npm run dev
```

默认会访问：

- `http://127.0.0.1:8765`

也可以通过 `VITE_API_BASE` 覆盖。

### 10.2 单独跑 backend

在 `backend` 目录：

```powershell
python main.py
```

默认监听：

- `http://127.0.0.1:8765`

### 10.3 Tauri 开发模式

根目录脚本：

```powershell
npm run tauri:dev
```

当前注意点：

- `src-tauri/tauri.conf.json` 的 `beforeDevCommand` 是空字符串。
- 这意味着开发时通常要先让 frontend dev server 和 backend 可用。
- 打包后的正式桌面程序则会由 Tauri 自动拉起 sidecar backend。

### 10.4 Tauri 正式打包

根目录：

```powershell
npm run tauri:build
```

实际流程：

1. `scripts/build_backend_bundle.py` 先用 PyInstaller 打 `backend/launcher.py`
2. sidecar backend 复制到 `src-tauri/binaries`
3. `frontend` 执行生产构建
4. Tauri 生成主程序和 NSIS 安装包

## 11. Tauri 和 sidecar backend 是怎么配合的

关键文件：

- `src-tauri/src/main.rs`
- `backend/launcher.py`

当前行为：

- Tauri 启动时在本地挑一个空闲端口
- 通过环境变量把 host / port / parent pid 传给 backend sidecar
- backend sidecar 就绪后，前端再通过 `invoke("get_backend_base_url")` 获取实际 backend base URL
- 主窗口关闭或主程序退出时，Tauri 会主动杀 sidecar
- backend 端还有一层 watchdog，会检测父进程是否存活，如果主程序没了，backend 自己也退出

这个设计是为了让打包后的桌面程序尽量“即插即用”，减少“主程序关了但 backend 残留”的情况。

## 12. 当前工程约束和后续 agent 必须知道的事

### 12.1 不要把 SSH 逻辑塞回前端

这是硬边界。

SSH 登录、远端服务控制、云端部署、健康检查、控制 signaling 对接，这些逻辑都应该继续留在 Python backend。

### 12.2 少改文件、少扩散

这是用户明确提出过的长期要求。

默认策略：

- 能改一个文件就不要拆成很多文件
- 能局部修补就不要大重构
- 能保留旧链路就不要硬删

### 12.3 旧链路尽量保留作兜底

这个项目里很多功能是“新链路 + 老链路保底”的思路发展出来的。

因此：

- 不要轻易删老开关
- 不要随意移除 fallback
- 除非用户明确要求，否则不要为了“代码更干净”而砍掉兜底路径

### 12.4 坦克游戏的延迟测试链路是隔离需求

用户对延迟测试模式的要求非常明确：

- 优先低延迟
- 优先丝滑稳定
- 不能顺手碰其他控制 / 视频链路

所以：

- 如果继续改 `TankTroublePanel.tsx` 的 latency 模式
- 或继续改 `backend/cloud_setup_bundle/tank_trouble_room.py`

必须默认只在“测试延迟”这条链路内动刀，不要把逻辑扩散到别的正式链路。

当前延迟测试链路额外约束：

- `backend/tank_trouble_cloud.py` 会优先启动 / 复用云端 `tank_trouble_room.py --serve`
- 默认端口在 `backend/config.py`：`TANK_GAME_SERVER_PORT = 18086`
- 这个常驻进程只服务坦克游戏低延迟测试，不是正式视频 / 控制链路的一部分
- 如果公网端口或服务不可达，本地 backend 会回退旧 SSH exec 链路，避免功能直接不可用

当前前端引擎内的隔离机制：

- `TankTroublePanel.tsx` 里仍然保留了旧 latency clone 相关辅助逻辑，便于以后继续实验
- 但当前前端“测试延迟”入口不会再激活旧的 clone 同步流程
- 现在进入 latency 模式时，前端只会：
- 关闭本地电脑玩家
- 运行本地单坦克战场
- 向本机 backend 周期推送玩家坦克快照
- 本机 backend 结合房间缓存和 preview runtime 生成 `scene`、计分板、地图标签和运行统计
- 本机 backend 通过 `backend/tank_trouble_preview_page.py` 提供 `/tank-trouble/preview` 页面
- 浏览器页面本地轮询 `/api/games/tank-trouble/preview/state`，再在 canvas 上自行渲染战场和计分板
- 旧的 `latencyOnly` / WebSocket / HTTP sync 相关实现当前属于保留代码，不是现行主链路

### 12.5 终端里可能看到中文乱码

当前工程源码里有不少中文 UI 文本。

在某些 Windows PowerShell / 终端编码环境里，直接 `Get-Content` 可能出现中文显示乱码，但这不一定代表文件内容真的坏了。阅读和编辑时优先使用支持 UTF-8 的编辑器。

### 12.6 当前 canonical 文档位置

现在给 agent 看的真身文档已经收敛到：

- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `frontend/UI_AGENT_SPEC.md`
- `frontend/UI_Agent_长期需求规范.md` 只是旧命名兼容入口

旧文档可以参考，但不应覆盖这里的内容。

## 13. 新 agent 的建议阅读顺序

如果你是第一次接手这个项目，建议按这个顺序读：

1. `frontend/README.md`
2. `frontend/IMPLEMENTATION_LOG.md`
3. `frontend/UI_AGENT_SPEC.md`
4. `frontend/src/pages/DashboardPage.tsx`
5. `frontend/src/components/TankTroublePanel.tsx`
6. `frontend/src/api/cloudApi.ts`
7. `backend/main.py`
8. `backend/config.py`
9. `backend/service_manager.py`
10. `backend/cloud_setup.py`
11. `backend/tank_trouble_cloud.py`
12. `backend/cloud_setup_bundle/tank_trouble_room.py`
 
## 14A. Latency Preview 2026-05-03 鏇存柊

杩欐鏇存柊鍙姩鍧﹀厠娓告垙 + browser preview 杩欐潯娴嬭瘯/瑙傚療閾捐矾锛屼笉纰拌棰戞帹娴併€佹帶鍒朵俊鍙锋垨浜戠 control signaling 姝ｅ紡閾捐矾銆?

鏍稿績鍙樺寲锛?
- `frontend/src/components/TankTroublePanel.tsx`
  - 淇鍧﹀厠缁樺埗鏈濆悜锛岀幇鍦?`drawTankSprite()` 浣跨敤 `tank.angle + Math.PI / 2`
  - preview push 鏀规垚鎼哄甫 `snapshot_seq`
  - preview player snapshot 鏂板 `shots`
  - preview push 鏂板闃插爢绉€昏緫锛屽悓鏃跺彧鍏佽涓€涓姹傚湪璺戯紝鍚庣画鍒锋柊鍚堝苟涓烘渶鏂扮姸鎬佸啀鎺ㄩ€?
- `frontend/src/types/cloud.ts`
  - `TankTroublePreviewPlayerSnapshot` 鏂板 `shots`
  - `TankTroublePreviewPushRequest` 鏂板 `snapshot_seq`
- `backend/models.py`
  - backend preview push 妯″瀷鍚屾鏀寔 `shots` 鍜?`snapshot_seq`
- `backend/tank_trouble_preview_runtime.py`
  - preview runtime 鐜板湪鍦ㄥ悗绔淮鎶?preview-only scene
  - 鏍规嵁鍓嶇涓婃姤鐨?`tank + shots + snapshot_seq` 缁存姢 server-side bullets / targets / wallRipples / bulletFades
  - 鏀寔 stale snapshot 忽略锛岄伩鍏嶅悗鍒板寘鎶婃柊鐘舵€佽鐩?
  - `get_state()` 浼氬厛鎶?preview 浼氳瘽妯℃嫙鍒板綋鍓嶆椂鍒伙紝鎻愰珮 browser 绔瓙寮瑰拰闈跺瓙鐘舵€佺殑杩炶疮鎬?
- `backend/tank_trouble_preview_page.py`
  - 淇 browser viewer 鍧﹀厠缁樺埗鏈濆悜锛屼篃鏀规垚 `tank.angle + Math.PI / 2`
  - poll interval 浠?`60ms` 璋冩暣鍒?`45ms`
  - tank / bullet smoothing 杞诲井鎻愰珮
  - browser 瀛愬脊鏂板鐭建杩?trail锛岃杞ㄨ抗鏇村鏄撶湅鍒?

褰撳墠 browser preview 閾捐矾锛?
- 鍓嶇 latency 妯″紡鍙笂鎶?`session_id / room / player_id / country_code / snapshot_seq / tank / updated_at_ms`
- backend preview runtime 鍦ㄥ悗绔淮鎶?preview-only scene
- `/tank-trouble/preview` 鏈湴杞 `/api/games/tank-trouble/preview/state`锛屽啀鐢?canvas 鑷娓叉煋

杩欎釜鏇存柊鐨勭洰鐨勬槸锛氳 browser preview 鏇存帴杩戔€滄湇鍔＄瑙嗚鈥濓紝鑰屼笉鏄墠绔洿鎺ヤ笂浼?whole scene銆?

## 14. 这份 README 的定位

这不是一个“对外宣传”的 README，而是一份面向继续开发和交接的工程内说明书。

目标不是简洁，而是让后续 agent 在最短时间内回答这些问题：

- 这个小程序是什么
- 哪些文件才是当前真身
- 每个页面做什么
- 前后端怎么通信
- 运行时数据写到哪
- 打包链路怎么走
- 坦克游戏在哪
- 延迟测试链路在哪
- 哪些边界不能乱碰

如果后续产品继续演进，应优先维护这份 README 的真实性。

## 14B. GitHub 自更新链路（2026-05-03）

这套桌面程序现在已经接入一条正式的 GitHub 自更新链路，目标是：

- 用户安装过一次桌面版以后，后续只需要在程序里点更新按钮，不再依赖本地手工打新版 `exe`
- 发布动作尽量交给 GitHub Actions 完成
- 更新检测和安装只发生在正式的 Tauri 打包程序里，不影响浏览器开发模式

当前前端接入点：

- `frontend/src/hooks/useAppUpdater.ts`
  - 全局更新状态入口
  - 负责在 Tauri 运行时动态导入 `@tauri-apps/api/app` 和 `@tauri-apps/api/updater`
  - 启动时检查当前版本与 GitHub 最新 release
  - 维护 `available / installing / currentVersion / latestVersion / error` 等状态
- `frontend/src/components/UpdateAction.tsx`
  - 圆形更新按钮
  - 只在“发现新版本”或“正在安装更新”时显示
  - 点击后调用 Tauri updater 安装新版
- `frontend/src/App.tsx`
  - 挂载全局 updater hook
  - 把 updater 状态和安装动作透传给登录页和主控制台
- `frontend/src/pages/LoginPage.tsx`
  - 登录页右上角，主题切换按钮左边
- `frontend/src/components/Topbar.tsx`
  - 主控制台顶部操作区，主题切换按钮左边

当前 Tauri 壳层接入点：

- `src-tauri/tauri.conf.json`
  - 已开启 `tauri.updater.active = true`
  - 已关闭内置弹窗 `dialog = false`
  - 更新清单入口固定为：
    - `https://github.com/Secant1998/Cloud-Service-Console/releases/latest/download/latest.json`
  - 已写入 updater 公钥
- `src-tauri/Cargo.toml`
  - `tauri` 已开启 `updater` feature

当前 GitHub 发布自动化入口：

- `.github/workflows/release-windows.yml`
  - 触发方式：`push main` 或手动 `workflow_dispatch`
  - 只做 Windows 发布
  - 会先安装 `frontend` 依赖
  - 会安装 `backend/requirements.txt` 和 `PyInstaller`
  - 会自动计算版本号
  - 会调用 `scripts/update_versions.py` 同步版本文件
  - 会调用 `tauri-apps/tauri-action@action-v0.6.2`
  - 会发布 `nsis + updater` 产物
  - 已设置 `updaterJsonPreferNsis: true`

## 14C. 版本号、签名密钥与发布注意点

当前版本同步脚本：

- `scripts/update_versions.py`

它会同步这些文件里的版本号：

- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

当前本机 updater 私钥位置：

- `C:\Users\SECANT\.tauri\cloud-service-console.key`

当前本机 updater 公钥位置：

- `C:\Users\SECANT\.tauri\cloud-service-console.key.pub`

注意：

- 私钥绝对不能提交到仓库
- GitHub Actions 现在需要一个仓库 Secret：
  - `TAURI_PRIVATE_KEY`
- 这个 Secret 的内容可以直接放私钥文件全文，或者放私钥文件路径对应的字符串内容
- 当前这次实现没有再引入密码保护版本的私钥，所以暂时不需要 `TAURI_KEY_PASSWORD`

本地手工打包时现在推荐这样跑：

```powershell
$env:TAURI_PRIVATE_KEY='C:\Users\SECANT\.tauri\cloud-service-console.key'
npm run tauri:build -- --bundles nsis,updater
```

当前已知状态：

- 本地已经能正常打出：
  - `src-tauri/target/release/bundle/nsis/Cloud Service Console_0.3.1_x64-setup.exe`
  - `src-tauri/target/release/bundle/nsis/Cloud Service Console_0.3.1_x64-setup.nsis.zip`
- 本地这次没有看到 `latest.json` 落盘，因此“GitHub Release 实际产出 updater 清单”这一步仍以首次 GitHub Actions 运行结果为准
- 换句话说：
  - 程序内的“检测更新 / 点击安装”入口已经接好
  - GitHub 自动发布工作流已经接好
  - 还需要 GitHub 上真实跑一次 release workflow，才能完成端到端闭环验证
