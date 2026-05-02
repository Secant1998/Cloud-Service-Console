# Cloud Service Console Implementation Log

这份日志用于把当前小程序从开始到现在的实现过程整理出来，方便后续 agent 快速理解“为什么会长成现在这样”。

说明：

- 这是一份根据当前仓库状态、现存文档和连续协作记录重建出来的工程日志。
- 它更关注阶段、设计决策、关键改动和保留约束，而不是严格的分钟级提交历史。
- 文件编码统一使用 UTF-8。
- 以后只要继续修改 `cloud-service-console` 这套小程序的功能代码，就应同步更新这份日志。

## 阶段 0：迁移目标确定

起点：

- 旧控制台存在，但需要迁移到更现代的桌面架构。
- 目标不是继续堆 Tkinter，而是形成新的桌面应用体系。

核心决策：

- UI 换成 `React + TypeScript`
- 本地控制逻辑保留在 `Python + FastAPI`
- 桌面壳使用 `Tauri`
- SSH、云端服务控制、健康检查继续由 Python 负责，不进前端

对应早期说明：

- 根目录 `README.md`
- 根目录 `AGENT_V3_MIGRATION_GUIDE.md`

## 阶段 1：V3 工程骨架建立

主要结果：

- 建立 `frontend/` 前端工程
- 建立 `backend/` FastAPI backend
- 建立 `src-tauri/` 桌面壳
- 前后端通过 HTTP API 对接，而不是把业务逻辑塞在 UI 里

关键文件：

- `frontend/package.json`
- `frontend/src/App.tsx`
- `backend/main.py`
- `src-tauri/tauri.conf.json`

阶段意义：

- 先把旧逻辑从 UI 层剥离出来
- 先保证新架构能跑，再逐步迭代观感和功能

## 阶段 2：登录、会话与本地设置持久化

主要结果：

- 做出独立登录页
- 支持输入云服务器 `Host`
- 支持 SSH 用户名 / 密码
- 支持记住密码
- 支持自动登录
- 登录状态由 backend 保存并管理

关键决策：

- 登录信息不再散落在外部脚本中，而是放到统一的设置文件
- 默认值内置，不依赖用户手工准备额外配置

关键文件：

- `frontend/src/pages/LoginPage.tsx`
- `backend/settings_store.py`
- `backend/config.py`

当前遗留特征：

- 登录默认主机仍是 `150.109.100.30`
- 默认 SSH 用户仍是 `ubuntu`

## 阶段 3：主控制台页面成型

主要结果：

- 做出主控制台 `DashboardPage`
- 建立左侧导航和顶部操作区
- 形成 5 个主视图：
  - 控制台总览
  - 服务管理
  - 健康检查
  - 活动日志
  - 玩玩游戏

关键文件：

- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/Topbar.tsx`

阶段意义：

- 产品已经从“几个按钮的工具页面”变成了一个结构完整的桌面控制台

## 阶段 4：云端服务管理能力接入

主要结果：

- frontend 可以调用 backend 启停服务
- backend 通过 SSH 控制远端 systemd 服务
- 服务状态可以统一查询并在 UI 卡片里展示
- 做出启动全部 / 停止全部能力

当前固定管理的服务：

1. `nginx`
2. `go2rtc-cloud`
3. `go2rtc-srt-bridge`
4. `go2rtc-control-signaling`

关键文件：

- `backend/service_manager.py`
- `backend/config.py`
- `backend/main.py`
- `frontend/src/components/ServiceCard.tsx`
- `frontend/src/pages/DashboardPage.tsx`

阶段意义：

- 小程序开始真正承担“云端服务控制台”的职责，而不只是静态状态面板

## 阶段 5：内置默认配置与外部依赖收缩

最重要的变化之一：

- 小程序不再依赖用户在项目外单独提供 `sender-cloud.config.json`
- 改成项目内置默认模板
- 登录只需要输入服务器和密码
- 大量默认端口、协议、用户名都内置

当前内置模板位置：

- `backend/cloud_setup_bundle/config/sender-cloud.config.json`

关键文件：

- `backend/cloud_setup.py`
- `backend/config.py`

阶段意义：

- 提高跨机器可移植性
- 降低“换一台电脑就跑不起来”的概率
- 为最终的 `exe` / 安装包做准备

## 阶段 6：健康检查、端口检查、连接快照

主要结果：

- 增加云端健康检查显示
- 增加手动端口检查
- 增加本机 IP / 服务器 IP / 地区信息
- 增加国旗资源显示
- 支持手动刷新连接快照

关键决策：

- 端口检测不做持续高频监听，而是手动检查
- 地区信息要尽量对用户友好地展示
- 国旗资源改成本地随工程打包，避免 exe 依赖外部网络资源

关键文件：

- `frontend/src/components/Sidebar.tsx`
- `frontend/public/flags/*`
- `frontend/public/flags/README-circle-flags.md`
- `backend/config.py`
- `backend/main.py`

## 阶段 7：主题、动效、视觉风格持续打磨

这一阶段不是一次完成，而是持续多轮微调累积出来的。

主要结果：

- 明确浅色 / 深色双主题
- 统一圆角风格
- 卡片 hover 动效
- 背景柔和渐变与氛围光斑
- 更桌面化、更轻量 SaaS Dashboard 风格的界面
- 多轮修复滚动、布局裁切、对齐、分隔线、状态可读性问题

关键文件：

- `frontend/src/styles/globals.css`
- `frontend/src/styles/theme.css`
- `frontend/src/components/*`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`

这一阶段里形成了后续必须继承的用户偏好：

- 大圆角
- 柔和配色
- 玻璃感 / 渐变感
- 有动效，但不能过头
- 布局和对齐必须讲究
- 改动时尽量少动文件和逻辑

## 阶段 8：视频预览能力接入

主要结果：

- 在服务管理页内嵌视频预览区域
- 默认流名使用 `main-camera`
- 优先尝试 WebRTC 预览
- 保留 MP4 预览回退路径
- 预览窗口比例动态跟随实际视频

关键文件：

- `frontend/src/pages/DashboardPage.tsx`
- `backend/main.py`

阶段意义：

- 控制台里可以直接看“云端当前能不能收到画面”

## 阶段 9：控制监视键盘接入

主要结果：

- 在服务管理页加入“控制监视键盘”卡片
- 本机可临时接入 `robot-control` 会话
- 用 UI 方式显示网页端来的按键状态
- 显示消息数和最近更新时间

关键决策：

- 这条链路是监视链路，不是正式机械臂控制链路本身
- 关闭时不应该占用控制会话
- 前端通过 backend 拉配置，backend 再对接云端 signaling

关键文件：

- `frontend/src/pages/DashboardPage.tsx`
- `backend/main.py`
- `backend/cloud_setup_bundle/control_signaling.py`

## 阶段 10：一键配置与视频模式切换接入

主要结果：

- UI 顶部加入“一键配置”
- 支持检测云端环境是否就绪
- 不就绪时执行云端部署 / 修复
- 加入 `HTTP` / `SRT` ingest 模式切换
- 模式切换时有进度条和结果提示

关键决策：

- 现在 UI 上的一键配置实际是“云端配置”
- 名字里的 `local_setup` 是历史遗留接口名
- 切换模式属于较重操作，需要明确 busy 反馈

关键文件：

- `backend/cloud_setup.py`
- `backend/main.py`
- `frontend/src/pages/DashboardPage.tsx`

## 阶段 11：跨机器可用性与 sidecar 生命周期

主要结果：

- 引入 backend sidecar 打包方案
- 用 PyInstaller 打 Python backend
- Tauri 自动拉起 backend sidecar
- 主程序退出时自动清理 backend
- backend 自己也会反查父进程，避免残留

关键文件：

- `scripts/build_backend_bundle.py`
- `backend/launcher.py`
- `src-tauri/src/main.rs`
- `src-tauri/tauri.conf.json`

阶段意义：

- 让小程序逐步接近“拿到别的 Windows 机器就能直接装”的状态

## 阶段 12：坦克游戏接入主程序

主要结果：

- 左侧新增“玩玩游戏”
- 当前接入的游戏是 `Tank Trouble`
- 游戏不再是外部独立项目，而是并入主程序
- 支持训练模式
- 支持房间 / 地图同步
- 支持排行榜与玩家颜色
- 保留了原始参考游戏目录，但当前桌面前端运行逻辑已经自成一体

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `games/tank-trouble/original/*`

## 阶段 13：坦克游戏云端房间与投票换图

主要结果：

- 后端加入坦克房间 API
- 云端房间脚本负责玩家集合、地图 seed、投票换图、倒计时换图
- 前端通过 room sync 保持地图一致

关键文件：

- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_cloud.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

阶段意义：

- 游戏不再只是纯本地 canvas 试玩，而是开始具备“云端中枢 + 本地前端”的结构

## 阶段 14：坦克游戏临时延迟测试模式

新增目的：

- 用户希望临时验证一条“前端输入 -> 云端 -> 返回远端对象表现”的链路延迟
- 这个需求是临时测试性质，不应影响正式视频链路、正式控制链路

前期做法：

- 玩家本地直接控制自己的坦克
- 云端根据玩家输入驱动一个“克隆坦克”
- 前端再显示这个克隆坦克和它的子弹

当时的问题：

- 克隆坦克移动不连续
- 克隆子弹掉帧明显
- 看起来像是一帧一帧跳

## 阶段 15：延迟模式第一次优化

主要结果：

- 修复过一些状态同步 bug
- 例如 clone respawn 后控制序列丢失的问题
- 前端曾对克隆对象做过简单平滑 / 修正

但用户反馈仍然是：

- “很卡”
- “帧数低”
- “断断续续”

说明纯快照式回推仍然不够。

## 阶段 16：延迟模式重构为“输入同步 + 本地逐帧模拟”

这是当前阶段最关键的一次坦克延迟测试优化。

核心思路改成：

- 云端不再高频回推每一帧克隆位置
- 云端主要返回：
  - `clone_input`
  - `fire_events`
  - `clone_reset_seq`
- 前端自己在本地每帧模拟克隆坦克和克隆子弹

这样做的原因：

- 远端对象的更新频率不应受网络包频率直接限制
- 网络只同步输入 / 状态 / 事件
- 画面表现必须由前端本地 `requestAnimationFrame` 连续推进

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

## 阶段 17：延迟模式进一步降等待和防堆积

当前最新的一轮优化重点是：

- 降低按键变化到云端同步的等待时间
- 避免同步请求堆积
- 输入活跃时更快跟进，空闲时降频

当前实现结果：

- `TankTroublePanel.tsx` 中引入：
  - `LATENCY_SYNC_IDLE_INTERVAL_MS = 90`
  - `LATENCY_SYNC_RUSH_INTERVAL_MS = 12`
- 按键变化时主动 kick 一次同步
- 请求在途时不重复堆积
- 请求返回后如果输入仍活跃，继续快速跟进

这一轮是严格按“只动测试延迟链路、不碰其他链路”的原则做的。

## 阶段 18：延迟模式云端常驻 HTTP 服务

主要目标：

- 解决延迟测试模式极其卡顿的问题
- 保留“输入真实经过云端一圈”的测试意义
- 避免每次同步都通过 SSH exec 冷启动一个 Python 进程

主要结果：

- `backend/cloud_setup_bundle/tank_trouble_room.py` 增加 `--serve` 常驻 HTTP server 模式
- `backend/tank_trouble_cloud.py` 的 latency sync / leave 优先走云端 HTTP 服务
- 本地 backend 首次进入延迟测试时通过 SSH 启动一次云端常驻进程
- 云端服务默认监听 `18086/tcp`
- 云端服务空闲 30 秒自动退出
- 收到最后一个玩家退出后，云端服务也会主动退出
- 如果云端 HTTP 服务不可达，保留旧 SSH exec 单次脚本链路作兜底

关键文件：

- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `backend/tank_trouble_cloud.py`
- `backend/config.py`

关键决策：

- 不改前端 API，`TankTroublePanel.tsx` 仍调用本地 backend
- 不影响正式视频链路和正式控制链路
- 不引入新 Python 依赖，云端常驻服务使用 stdlib `http.server`

## 阶段 19：文档收敛与 agent 交接准备

当前这一轮新增成果：

- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `frontend/UI_AGENT_SPEC.md`

目的：

- 把此前分散在根目录、桌面草稿、对话上下文里的信息收敛成工程内的 canonical 文档
- 让别的 agent 只看 `frontend` 目录就知道：
  - 小程序是什么
  - 关键路径在哪
  - 当前有哪些功能
  - 哪些是历史遗留
  - 哪些边界不能乱碰

## 阶段 20：延迟测试模式简化为“纯克隆视角”

主要目标：

- 将延迟测试模式从“本地坦克 + 克隆坦克 + 靶子”简化为画面上只有一辆克隆坦克
- 让用户直观感受“我操控的坦克在对手眼里是什么样”
- 去掉不必要的本地元素，减少视觉干扰

主要结果：

- 引擎新增 `latencyOnly` 标志和 `setLatencyOnly(enabled)` 方法
- `tick()` 中 `latencyOnly` 模式跳过本地坦克移动 / 开火 / 靶子更新 / 本地子弹物理
- `render()` 中 `latencyOnly` 模式不绘制本地坦克、本地子弹、靶子
- `buildLatencySyncState()` 在 `latencyOnly` 模式返回场外占位坐标和空靶子数组
- 克隆子弹物理中跳过对本地坦克和靶子的碰撞检测
- 进入 / 退出延迟测试模式时自动切换 `latencyOnly` 标志
- 子弹消散特效在 `latencyOnly` 模式使用克隆坦克调色板
- 左上角标签在 `latencyOnly` 模式显示 `Latency View`

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`

关键决策：

- 只改前端引擎内部逻辑，严格隔离在延迟测试模式
- 云端 `tank_trouble_room.py` 不动，它只管根据 input 驱动克隆，不关心本地坦克有没有
- `tank_trouble_cloud.py` 和本地 backend API 不动
- 训练模式和房间模式完全不受影响

## 阶段 21：延迟测试模式平滑性优化 - 禁用位置回退

主要目标：

- 解决克隆坦克在延迟测试中“回退 / 跳跃”的问题
- 让操控体验从“卡顿回退”变成“有延迟但流畅”

问题诊断：

- 云端每次 sync 返回的权威位置与本地逐帧模拟的位置存在微小偏差
- `applyLatencyCloneCorrection` 每次收到 sync 结果时强行把坦克拉向云端坐标
- 当网络延迟波动时，这种拉扯产生明显的“漂移 - 回退”感
- 尝试过引入输入缓冲 `jitter buffer` 方案，但产生了“黏腻”手感和子弹位置错位，已回退

最终方案：

- `latencyOnly` 模式下完全禁用 `applyLatencyCloneCorrection`
- 克隆坦克的位置只由本地逐帧模拟决定，基于 `clone_input` 驱动
- `clone_input` 到达后立即生效，无缓冲，保持操控的直接响应感
- 子弹仍从云端返回的坐标发射，代表服务端权威判定时的真实位置

最终效果：

- 移动时连贯流畅，不再有位置回退
- 松开键后坦克平滑停住
- 操控延迟约等于网络往返时间，符合预期的延迟感受
- 开炮延迟可见，按键到子弹出现之间有网络延迟

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`

关键决策：

- 不使用输入缓冲，实测体感差
- 不做位置校正，本地模拟足够精确，因为输入相同
- 依然保留子弹从云端坐标发射，语义更正确

## 阶段 22：延迟测试链路升级为“长连接 + 输入序号 + 本地校正”

主要目标：
- 把坦克游戏延迟测试从“前端反复 HTTP sync”升级成更接近主流联机游戏的结构
- 先完成两件事：长连接数据通道、输入序号/服务器快照序号/本地校正
- 顺手修掉“延迟测试里坦克能动但按空格看不到炮弹”的问题

主要结果：
- 前端到本地 backend 新增 WebSocket 通道：`/api/games/tank-trouble/latency/ws`
- 旧的 `POST /api/games/tank-trouble/latency/sync` 仍然保留，作为自动 fallback
- 本地 backend 到云端这段不再每次都新建一次 HTTP 请求连接，而是优先复用持久 keep-alive 连接
- 云端延迟测试状态新增：
  - `input_seq`
  - `ack_input_seq`
  - `snapshot_seq`
- 前端延迟模式不再完全等待云端回 `clone_input` 才动
- 当前做法改为：
  - 本地先按当前输入直接预测克隆坦克移动/转向
  - 云端返回权威位置后做轻量校正
  - 旧快照会被丢弃，不再覆盖新状态
- 延迟模式的开火现在有两层保障：
  - 本地先生成预测子弹，保证按空格立刻有反馈
  - 云端返回 `fire_events + bullets` 后再把预测子弹和权威子弹对齐
- 这样既解决了“空格没炮弹”，也让移动和开火都更接近主流联机游戏的体感

关键文件：
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_cloud.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`

关键决策：
- 没有去碰视频链路、正式控制链路、服务管理链路
- 改动仍然严格收束在小程序工程内部
- WebSocket 只先落在“前端 <-> 本地 backend”这一段，避免为了测试链路去重做整套云端协议
- “本地 backend <-> 云端”这一段先通过持久 keep-alive 连接降开销，作为低风险增量优化
- 旧 HTTP sync 和旧 SSH fallback 都保留，避免新链路出问题时整条测试链路失效

验证结果：
- `python -m compileall backend` 通过
- `frontend` 下执行 `npm run build` 通过

遗留问题：
- 这次实现的是“更像主流联机骨架”的版本，但还不是完整的回滚重演式 netcode
- 当前本地校正是轻量纠偏，不是严格按已确认输入重放整段历史
- 如果后面继续往更专业的联机同步靠，可以再补：
  - 更完整的输入历史回放
  - 更细的时间戳对齐
  - 更稳定的远端事件确认机制

## 关键长期约束总结

这些约束贯穿了整个实现过程，也应该继续保持：

1. SSH / 云端控制逻辑留在 Python backend，不进前端。
2. 默认尽量少改文件、少扩散改动，方便交接。
3. 老链路优先保留作兜底，除非用户明确要求删除。
4. UI 要持续维持圆角、柔和、现代桌面感，不能退化成普通后台模板。
5. 坦克游戏延迟测试模式的优化必须隔离，不要顺手影响正式视频 / 控制链路。
6. 打包后要尽量即插即用，backend sidecar 生命周期必须跟主程序绑定。

## 下一次继续写日志时建议怎么记

建议每次大改按这个模板在末尾追加：

```md
## 阶段 N：标题

主要目标：

- ...

主要结果：

- ...

关键文件：

- ...

关键决策：

- ...

遗留问题：

- ...
```

## 阶段 23：训练模式加入本地电脑玩家

主要目标：

- 用户希望快速验证“和电脑玩家对战”的基本手感
- 选择最低风险方案，只在训练模式加入一个简单 AI
- 不碰云端视频、控制信号、服务管理、延迟测试链路

主要结果：

- 在 `TankTroublePanel.tsx` 的本地训练引擎里新增一个本地电脑玩家 `CPU-1`
- 电脑玩家会执行基础的转向、追击、拉开距离、卡墙后短暂倒车、瞄准开火
- 电脑玩家使用独立子弹列表与本地碰撞逻辑，可击中玩家、靶子和自己
- 玩家子弹现在也会与电脑玩家发生命中判定，击毁后立刻重生
- 训练模式渲染中会显示电脑玩家坦克和 `CPU-1` 标签
- 电脑玩家相关统计会计入本地训练快照中的子弹数量

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

关键决策：

- 不新增新模块，继续把改动收敛在现有 `TankTroublePanel.tsx`，方便交接
- 电脑玩家只在 `latencyOnly === false` 的训练逻辑中更新，延迟测试模式完全不受影响
- 直接复用现有本地地图、碰撞、子弹、重生机制，避免扩散到云端房间逻辑

验证结果：

- `frontend` 下执行 `npm run build` 通过

遗留问题：

- 当前电脑玩家是“够用就行”的基础逻辑，还不包含寻路、预判反弹、难度分级
- 如果后续要做正式联机对战 AI，建议另开隔离链路，不要把训练 AI 混进云端权威同步

## 阶段 24：统一炮弹规则到 5 发 / 10 秒 / 1.85 格每秒

主要目标：

- 把当前坦克游戏的炮弹规则改成更接近目标玩法
- 保证本地训练模式和云端延迟测试模式使用同一套炮弹上限与寿命
- 继续保持改动集中，不去碰视频、控制信号或服务管理链路

主要结果：

- 单个玩家同时在场飞行的炮弹上限从 12 改为 5
- 炮弹寿命从 3.9 秒改为 10 秒
- 炮弹速度改为 1.85 格每秒
- 前端本地引擎与云端 `tank_trouble_room.py` 都使用同一套新规则
- 云端延迟测试发射时新增了“当前活动炮弹数 < 5”判断，避免权威端和本地端规则不一致

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/IMPLEMENTATION_LOG.md`

关键决策：

- 当前工程里的“格”先映射为训练地图逻辑网格的短边尺寸，这样在现有非正方形战场里前后端定义一致
- 没有改动开火冷却、反弹次数、命中判定，只收敛修改用户明确指定的三条规则
- 这组规则被视为当前坦克游戏的底层基础规则；现阶段所有实际带战斗判定的模式都必须服从它，而不是只改某一个测试模式

验证结果：

- `frontend` 下执行 `npm run build` 通过
- `python -m compileall backend` 通过

遗留问题：

- 如果后续你希望“格”改成别的定义，比如按横向单元宽度、纵向单元高度，或者显式固定像素单位，需要再统一调整前后端常量

## 阶段 25：坦克速度降到 1.6 格每秒 + 延迟模式改为本地网页预览

主要目标：

- 把坦克底层移动速度统一下调到 `1.6 格/秒`
- 取消前端当前使用中的“云端克隆坦克延迟测试”表现
- 把“测试延迟”入口改成“本地单坦克 + 本机网页预览”
- 网页端只显示战场地图和计分板，不显示其他控制台 UI

主要结果：

- 前端 `TankTroublePanel.tsx` 的 `PLAYER_SPEED` 改为基于逻辑网格的 `1.6 格/秒`
- 云端 `tank_trouble_room.py` 里的 `PLAYER_SPEED` 也同步改成同一规则，避免未来重新启用旧链路时数值漂移
- 前端 latency 模式不再启动旧的云端 clone 同步流程
- latency 模式现在会关闭本地电脑玩家，只保留一个本地玩家坦克
- 新增本机网页预览页 `/tank-trouble/preview`
- 前端在 latency 模式下会周期把当前游戏画面帧、计分板、地图标签、运行统计推送到本机 backend
- 浏览器预览页只渲染“战场地图 + 计分板”这两部分
- 旧的云端 latency API 和 `tank_trouble_room.py` 相关逻辑暂时保留，但当前前端入口不再使用

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/api/cloudApi.ts`
- `backend/main.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

关键决策：

- 为了尽量少动文件，没有彻底删除旧 latency clone 代码，只是把当前前端入口从那条链路切走
- 网页预览没有重写一套独立游戏渲染器，而是直接复用桌面端当前 canvas 输出，降低改动范围和同步风险
- 本机网页预览当前默认依赖本地 backend 地址，因此更像“本机浏览器观测页”，不是对外公网多人观看页

验证结果：

- `frontend` 下执行 `npm run build` 通过
- `python -m compileall backend` 通过

遗留问题：

- 旧的云端 latency 路由和模型仍在工程中，后续如果确认长期不用，可以再做一次清理
- 当前网页预览使用本地帧推送方案，适合调试和观察；如果后续追求更高帧率或跨设备预览，可以再改成状态同步或流式传输

## 阶段 26：网页预览链路正规化为 scene 状态同步 viewer

主要目标：

- 把本地网页预览从“推截图帧 + `<img>` 刷新”升级成正式的状态同步 viewer
- 让 backend 端的 preview payload、状态缓存、浏览器渲染职责清晰分层
- 保持 latency 模式仍然只作用于坦克游戏测试链路，不影响控制 / 视频正式链路

主要结果：

- `frontend/src/types/cloud.ts` 新增了 Tank Trouble preview 相关显式类型：
  - `TankTroublePreviewSceneState`
  - `TankTroublePreviewPushRequest`
  - `TankTroublePreviewClearRequest`
- `frontend/src/api/cloudApi.ts` 不再用 `Record<string, unknown>` 推 preview，而是改成显式 preview request 类型
- `frontend/src/components/TankTroublePanel.tsx` 继续在 latency 模式下每 `50ms` 推 preview，但内容从“截图帧”正式改成结构化 `scene`
- `backend/models.py` 新增了 preview 相关 Pydantic 模型：
  - `TankTroublePreviewRow`
  - `TankTroublePreviewSceneState`
  - `TankTroublePreviewPushRequest`
  - `TankTroublePreviewClearRequest`
  - `TankTroublePreviewState`
- `backend/main.py` 里的 preview 状态缓存不再保存 `frame_data_url`，改为保存结构化 `scene`
- `backend/main.py` 对 preview rows / scene 做了长度和主题等基础归一化，避免无界 payload 直接进入缓存
- 新增 `backend/tank_trouble_preview_page.py`
- `/tank-trouble/preview` 现在由 `backend/tank_trouble_preview_page.py` 生成独立 viewer 页面
- 这个 viewer 会轮询 `/api/games/tank-trouble/preview/state`，并在浏览器本地 `<canvas>` 上渲染：
  - 战场地图
  - 坦克
  - 子弹
  - 靶子
  - 墙体波纹
  - 子弹淡出特效
  - 右侧计分板

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_preview_page.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

关键决策：

- 不再沿用截图刷新的调试型实现，直接收成“结构化状态 + 浏览器本地渲染”的正式方案
- preview viewer 保持只读，只负责看战场和计分板，不把桌面控制台 UI 复制进网页
- 旧 latency WebSocket / HTTP sync / clone 路径继续保留为历史实验代码，但当前前端入口不再依赖它

验证结果：

- `frontend` 下执行 `npm run build` 通过
- `python -m compileall backend` 通过

后续提醒：

- `backend/main.py` 里旧的内联 preview HTML 仍然还在文件中，但运行入口已经切到 `backend/tank_trouble_preview_page.py`
- 如果以后确认不再需要历史实现，可以再做一次只针对 preview 代码的清理重构

## 阶段 27：preview 职责继续后移到 backend，前端只上报玩家坦克快照

主要目标：

- 进一步收紧 preview 职责边界
- 不再让前端推 `scene / rows / map_label / runtime_summary`
- 改成由 backend 专门维护 preview session、room cache 和 viewer state

主要结果：

- `frontend/src/components/TankTroublePanel.tsx` 不再构造 preview `scene`
- 前端 latency 模式下现在只会按固定频率推送：
  - `session_id`
  - `room`
  - `player_id`
  - `country_code`
  - `tank`（颜色、坐标、朝向、半径、flash）
- `frontend/src/types/cloud.ts` 和 `frontend/src/api/cloudApi.ts` 对应改成新的 preview push request 结构
- `backend/models.py` 里的 `TankTroublePreviewPushRequest` 改成“玩家坦克快照请求”模型
- 新增 `backend/tank_trouble_preview_runtime.py`
- 这个 runtime 专门负责：
  - 缓存 room sync 结果
  - 管理 preview session
  - 按房间 map seed 生成墙体
  - 在服务端生成 preview 靶子
  - 生成 rows / map_label / runtime_summary
  - 组装最终返回给 viewer 的 `scene`
- `backend/main.py` 里的 tank room sync / vote / leave 现在会同步刷新 preview runtime 的 room cache
- `backend/main.py` 的 preview push / clear / state 逻辑改为委托给 `TankTroublePreviewRuntime`

当前职责边界：

- 前端负责：本地游戏运行、玩家坦克快照上传
- backend 负责：preview 会话状态、房间缓存、viewer 状态拼装
- browser viewer 负责：读取 backend state 并本地渲染 canvas

当前 viewer 的已知取舍：

- 因为前端不再上传 whole scene，viewer 当前不再依赖前端提供的子弹 / 波纹 / fade 特效
- 现阶段 backend 生成的 preview scene 重点是：
  - 地图
  - 当前玩家坦克
  - 服务端生成的靶子
  - 计分板和运行状态
- 这更符合“服务端专门分配位置、前端只上报玩家坦克信息”的要求

关键文件：

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `frontend/src/api/cloudApi.ts`
- `backend/models.py`
- `backend/main.py`
- `backend/tank_trouble_preview_runtime.py`
- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`

## 闃舵 28锛歭atency preview 鏈嶅姟绔瓙寮瑰拰闈跺瓙鐘舵€佽ˉ榻愶紝淇鍧﹀厠鏈濆悜

涓昏鐩爣锛?
- 淇妗岄潰娓告垙鍜?browser preview 鍧﹀厠缁樺埗鏈濆悜鍙嶄簡鐨勯棶棰?
- 璁╂祻瑙堝櫒 preview 鐪熸鐪嬪埌鏈嶅姟绔瑙掔殑瀛愬脊椋炶鍜岄潰鏉跨粺璁?
- 琛ュ叏闈跺瓙琚嚮涓?-> 閲嶇敓鐨勫疄鏃舵€佹洿鏂?
- 杞诲井浼樺寲 preview 鎺ㄩ€?/ 杞鑺傚锛屽噺灏戠綉椤电杞诲井鎺夊抚浣嗕笉寮曞叆杩囧害澶栨帹銆佸洖閫€鎴栭绉?

涓昏鏀瑰姩锛?
- `frontend/src/components/TankTroublePanel.tsx`
  - `drawTankSprite()` 鐨?`rotate()` 鏀规垚 `tank.angle + Math.PI / 2`
  - `buildPreviewPlayerSnapshot()` 鏂板 `shots`
  - preview push 鏂版増鎼哄甫 `snapshot_seq`
  - preview push 鍔犱簡闃插爢绉€昏緫锛屽悓鏃跺彧鍏佽涓€涓姹傚湪璺戯紝鍚庡埌鐨勫畾鏃跺櫒鍒锋柊浼氬悎骞朵负鏈€鏂版€佸啀鍙戯紝閬垮厤璇锋眰鎺掗槦鍜屼贡搴?
- `frontend/src/types/cloud.ts`
  - `TankTroublePreviewPlayerSnapshot` 鏂板 `shots`
  - `TankTroublePreviewPushRequest` 鏂板 `snapshot_seq`
- `backend/models.py`
  - preview push 妯″瀷鍚屾鏀寔 `shots` 鍜?`snapshot_seq`
- `backend/tank_trouble_preview_runtime.py`
  - preview runtime 鏂板 server-side 瀛愬脊浼氳瘽鐘舵€侊紝鍖呮嫭 `bullets / last_snapshot_seq / last_reported_shots / last_reported_at_ms / last_simulated_ms / wall_ripples / bullet_fades`
  - 鍚庣鐜板湪鏍规嵁 `shots` 澧為噺鐢熸垚 preview 瀛愬脊锛屼笉鍐嶄緷璧栧墠绔笂浼?whole scene
  - `get_state()` 涓嬪彂鍓嶄細鍏堟妸 preview 浼氳瘽妯℃嫙鍒?`now`锛岃 browser 绔湅鍒扮殑瀛愬脊鏇磋繛璐?
  - server-side preview 浼氳嚜宸卞鐞嗭細瀛愬脊绉诲姩銆佸弽寮广€佹秷浜°€侀潰鏉跨‘涓悗閲嶇敓锛屼互鍙婄帺瀹?flash 鍙嶉
  - `_build_state()` 鐜板湪浼氬皢 `bullets / wallRipples / bulletFades / targets` 鍏ㄩ儴缁勮杩斿洖缁?viewer
- `backend/tank_trouble_preview_page.py`
  - `drawTank()` 鐨?`rotate()` 鏀规垚 `tank.angle + Math.PI / 2`
  - 杞棰戠巼浠?`60ms` 璋冨埌 `45ms`
  - tank / bullet smoothing 绯绘暟杞诲井鎻愰珮
  - browser 瀛愬脊缁樺埗鏂板鐭窛绂?trail锛岃杞ㄨ抗鏇存槑鏄?

褰撳墠 preview 閾捐矾锛?
- 鍓嶇 latency 妯″紡鍙悜 backend 鎺ㄩ€佺帺瀹跺潶鍏嬪揩鐓э細`session_id / room / player_id / country_code / snapshot_seq / tank / updated_at_ms`
- backend preview runtime 鍦ㄦ湇鍔＄缁存姢 preview-only scene
- browser preview 缁х画浣滀负鍙 viewer锛屾湰鍦拌疆璇?state 鍚庤嚜宸辨覆鏌?canvas

杈圭晫锛?
- 鍙姩鍧﹀厠娓告垙鍜?browser preview 杩欐潯娴嬭瘯/瑙傚療閾捐矾
- 涓嶇瑙嗛鎺ㄦ媺娴併€佹満姊拌噦鎺у埗銆佷簯绔?control signaling 绛夋寮忛摼璺?

验证结果：

- `frontend` 下执行 `npm run build` 通过
- `python -m compileall backend` 通过
