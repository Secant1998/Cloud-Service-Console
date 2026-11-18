import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open as openExternalUrl } from "@tauri-apps/api/shell";
import {
  checkLocalSetup,
  checkAllPorts,
  checkPort,
  getControlMonitorConfig,
  getControlMonitorKeyState,
  getLocalStreamStatus,
  getP2pLocalPusherStatus,
  getVideoPreviewUrl,
  getLiveStatus,
  getLogs,
  getStatus,
  getStoredAccessToken,
  getTrafficMonitorSnapshot,
  getVideoPushStatus,
  logout,
  logoutAccount,
  postTencentVideoStatus,
  postTencentVideoStatusBeacon,
  refreshNetworkSnapshot,
  refreshStatus,
  runLocalSetup,
  saveLocalStreamConfig,
  setupLocalStream,
  startAllServices,
  startLocalStream,
  startP2pLocalPusher,
  startService,
  stopAllServices,
  stopLocalStream,
  stopP2pLocalPusher,
  stopService,
} from "../api/cloudApi";
import { ActivityLog } from "../components/ActivityLog";
import { AppShell } from "../components/AppShell";
import { AppSelect } from "../components/AppSelect";
import { Button } from "../components/Button";
import type { AccessInfo } from "../api/cloudApi";
import { HealthPanel } from "../components/HealthPanel";
import { MetricCard } from "../components/MetricCard";
import { ServiceCard } from "../components/ServiceCard";
import { SystemSettingsPanel } from "../components/SystemSettingsPanel";
import { ModelLibraryPanel } from "../components/ModelLibraryPanel";
import { ToggleSwitch } from "../components/ToggleSwitch";
import type { AppUpdaterState } from "../hooks/useAppUpdater";
import type {
  ControlMonitorConfig,
  ControlMonitorKeyClientState,
  ControlMonitorLinkStatus,
  DashboardStatus,
  LocalStreamConfig,
  LocalStreamStatus,
  LogEntry,
  P2PLocalPusherStatus,
  PortStatus,
  TrafficMonitorSnapshot,
  VideoPushStatus,
} from "../types/cloud";

type DashboardPageProps = {
  initialStatus?: DashboardStatus;
  theme: "light" | "dark";
  updater: AppUpdaterState;
  accessInfo: AccessInfo;
  onlineCount: number;
  onAccessInfoChange: (accessInfo: AccessInfo) => void;
  onToggleTheme: () => void;
  onInstallUpdate: () => void;
  onLogoutDone: () => void;
};

type ConsoleView = "overview" | "services" | "health" | "activity" | "localStream" | "models" | "settings";
type LocalStreamDraftState = {
  viewerResolution: string;
  inputFramerate: string;
  targetFramerate: string;
  videoBitrateKbps: string;
  srtLatencyMs: string;
  srtPacketSize: string;
  connectTimeoutMs: string;
  cloudApiPort: string;
  cloudIngestPort: string;
  cloudSrtIngestPort: string;
};
type LocalStreamNumberConfigKey =
  | "input_framerate"
  | "target_framerate"
  | "srt_latency_ms"
  | "srt_packet_size"
  | "connect_timeout_ms"
  | "cloud_api_port"
  | "cloud_ingest_port"
  | "cloud_srt_ingest_port";
type LocalStreamNumberDraftKey = Exclude<
  keyof LocalStreamDraftState,
  "viewerResolution" | "videoBitrateKbps"
>;
type TencentCloudLiveSource = "camera" | "screen";
type TencentCloudPusher = {
  setRenderView?: (view: string | HTMLElement) => void;
  updateView?: (view: string | HTMLElement) => void;
  resizeView?: () => void;
  setVideoQuality?: (quality: string) => void;
  setAudioQuality?: (quality: string) => void;
  setProperty?: (key: string, value: unknown) => void;
  startCamera?: (deviceId?: string) => Promise<string> | string;
  stopCamera?: () => Promise<void> | void;
  startMicrophone?: (deviceId?: string) => Promise<string> | string;
  stopMicrophone?: () => Promise<void> | void;
  startScreenCapture?: (audio?: boolean) => Promise<string> | string;
  stopScreenCapture?: () => Promise<void> | void;
  getMediaStream?: (streamId: string) => MediaStream;
  startPush: (pushUrl: string) => Promise<void> | void;
  stopPush?: () => Promise<void> | void;
};
type TencentCloudVideoConfig = {
  width: number;
  height: number;
  fps: number;
  bitrateKbps: number;
  quality: "540p" | "720p" | "1080p";
};

const P2pCommunicationTopology = lazy(() =>
  import("../components/P2pCommunicationTopology").then((module) => ({
    default: module.P2pCommunicationTopology,
  })),
);
type P2pSignalConfig = {
  ok?: boolean;
  defaultRoom?: string;
  iceServers?: RTCIceServer[];
};
type P2pSignalMessage = {
  seq?: number;
  version?: number;
  from?: string;
  fromRole?: string;
  fromEndpointId?: string;
  fromPeerId?: string;
  to?: string;
  toRole?: string;
  toEndpointId?: string;
  toPeerId?: string;
  connectionId?: string;
  kind?: string;
  payload?: {
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    video?: P2pVideoConfig;
    offerId?: string;
    reason?: string;
    at?: number;
  };
};
type P2pEndpoint = {
  signalBaseUrl: string;
  roomId: string;
  watchUrl: string;
};
type P2pActiveRoom = {
  room: string;
  viewerCount?: number;
  peerCount?: number;
  activePusher?: {
    startedAt?: string;
    lastSeenAt?: string;
  };
};
type P2pV2Endpoint = {
  endpointId: string;
  requestedEndpointId?: string;
  nodeId?: string;
  requestedNodeId?: string;
  peerId?: string;
  role: "video-pusher" | "compute" | "robot-edge" | "frontend" | "viewer" | string;
  displayName?: string;
  capabilities?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: "waiting" | "connecting" | "connected" | "busy" | string;
  lastHeartbeatAt?: string;
  ageMs?: number | null;
  ttlSeconds?: number;
  activeConnections?: string[];
};
type P2pV2EndpointsResponse = {
  ok?: boolean;
  version?: number;
  room?: string;
  endpoints?: P2pV2Endpoint[];
  ttlSeconds?: number;
};
type P2pV2Room = {
  room: string;
  endpointCount?: number;
  videoPusherCount?: number;
  roleCounts?: Record<string, number>;
};
type CloudP2pVideoTarget = {
  value: string;
  signalBaseUrl: string;
  roomId: string;
  endpointId: string;
  peerId: string;
  displayName: string;
};
type P2pV2RoomsResponse = {
  ok?: boolean;
  version?: number;
  rooms?: P2pV2Room[];
  ttlSeconds?: number;
};
type P2pRoomsResponse = {
  ok?: boolean;
  rooms?: P2pActiveRoom[];
};
type P2pRoomSummary = {
  rooms: P2pActiveRoom[];
  updatedAt: string;
  error: string;
};
type P2pV2RoomSummary = {
  rooms: P2pV2Room[];
  updatedAt: string;
  error: string;
};
type P2pViewerConnection = {
  pc: RTCPeerConnection;
  viewerId: string;
  viewerEndpointId?: string;
  connectionId?: string;
  status: string;
};
type P2pVideoConfig = {
  captureWidth: number;
  captureHeight: number;
  outputWidth: number;
  outputHeight: number;
  inputFps: number;
  fps: number;
  bitrateKbps: number;
};
const emptyP2pRoomSummary: P2pRoomSummary = {
  rooms: [],
  updatedAt: "",
  error: "",
};
const emptyP2pV2RoomSummary: P2pV2RoomSummary = {
  rooms: [],
  updatedAt: "",
  error: "",
};
type ControlSignalCounterBaseline = {
  browserPosts: number;
  robotPolls: number;
  answersPosted: number;
};
type TencentCloudPlayer = {
  src?: (url: string) => void;
  play?: () => Promise<void> | void;
  pause?: () => void;
  stop?: () => void;
  dispose?: () => void;
  destroy?: () => void;
  on?: (event: string, handler: (event?: unknown) => void) => void;
};

declare global {
  interface Window {
    TXLivePusher?: new () => TencentCloudPusher;
    TCPlayer?: (id: string, options: Record<string, unknown>) => TencentCloudPlayer;
  }
}

const POLL_INTERVAL_MS = 5000;
const DEBUG_LOG_LIMIT = 240;
const STREAM_NAME = "main-camera";
const STREAM_CONNECT_TIMEOUT_MS = 7000;
const TENCENT_CLOUD_PUSH_SDK_URL = "https://video.sdk.qcloudecdn.com/web/TXLivePusher-2.1.2.min.js";
const TENCENT_CLOUD_PLAYER_STYLE_URL = "https://web.sdk.qcloud.com/player/tcplayer/release/v4.9.1/tcplayer.min.css";
const TENCENT_CLOUD_PLAYER_SDK_URL = "https://web.sdk.qcloud.com/player/tcplayer/release/v4.9.1/tcplayer.v4.9.1.min.js";
const TENCENT_CLOUD_PLAYER_CONTAINER_ID = "tencent-cloud-web-player";
const TENCENT_CLOUD_PLAYER_PAGE_PATH = "/tencent-cloud-player.html";
const TENCENT_CLOUD_PUSH_DEFAULT_URL = "";
const TENCENT_CLOUD_PLAY_DEFAULT_URL = "";
const TENCENT_CLOUD_PUSH_URL_STORAGE_KEY = "cloud-service-console.tencent-cloud-push-url";
const TENCENT_CLOUD_PLAY_URL_STORAGE_KEY = "cloud-service-console.tencent-cloud-play-url";
const TENCENT_CLOUD_PUSH_SESSION_STORAGE_KEY = "cloud-service-console.tencent-cloud-active-push-session";
const TENCENT_CLOUD_URL_STORAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const TENCENT_CLOUD_STATUS_HEARTBEAT_MS = 5000;
const P2P_HONG_KONG_SIGNAL_BASE_URL = "https://p2p.cityulive.com";
const P2P_GUANGZHOU_SIGNAL_BASE_URL = "https://p2p-gz.dlcourse.online";
const P2P_SIGNAL_BASE_URL = P2P_HONG_KONG_SIGNAL_BASE_URL;
const P2P_DEFAULT_ROOM_ID = "robot";
const P2P_DEFAULT_WATCH_URL = `${P2P_SIGNAL_BASE_URL}/watch.html?room=${P2P_DEFAULT_ROOM_ID}`;
const P2P_LINK_STORAGE_KEY = "cloud-service-console.p2p-link";
const P2P_ROOM_STORAGE_KEY = "cloud-service-console.p2p-room";
const P2P_GUANGZHOU_HOSTS = new Set(["111.230.62.106", "p2p-gz.dlcourse.online", "p2p-gz.cityulive.com"]);
const P2P_KNOWN_SIGNAL_BASE_URLS = new Set(
  [P2P_HONG_KONG_SIGNAL_BASE_URL, P2P_GUANGZHOU_SIGNAL_BASE_URL].map((value) => new URL(value).origin.toLowerCase()),
);
const P2P_SIGNAL_POLL_TIMEOUT_MS = 25000;
const VIDEO_PUSH_STATUS_POLL_INTERVAL_MS = 5000;
const TRAFFIC_MONITOR_POLL_INTERVAL_MS = 2000;
const TRAFFIC_MONITOR_WINDOW_MS = 60 * 1000;
const TRAFFIC_MONITOR_HISTORY_LIMIT = Math.ceil(TRAFFIC_MONITOR_WINDOW_MS / TRAFFIC_MONITOR_POLL_INTERVAL_MS) + 12;
const TRAFFIC_MONITOR_STALE_GAP_MS = TRAFFIC_MONITOR_POLL_INTERVAL_MS * 4;
const isPageVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;
const CONTROL_MONITOR_KEY_ROWS = [
  { keys: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"], offset: 0 },
  { keys: ["A", "S", "D", "F", "G", "H", "J", "K", "L"], offset: 0.5 },
  { keys: ["Z", "X", "C", "V", "B", "N", "M"], offset: 1 },
];
const CONTROL_MONITOR_MIN_VISIBLE_COLUMNS = 4;
const CONTROL_MONITOR_MAX_VISIBLE_COLUMNS = Math.max(...CONTROL_MONITOR_KEY_ROWS.map((row) => row.keys.length));
const CONTROL_MONITOR_KEYBOARD_SAFE_GUTTER_PX = 8;
const CONTROL_MONITOR_MIN_KEY_SIZE_PX = 26;
const CONTROL_MONITOR_MIN_KEY_GAP_PX = 4;
const CONTROL_MONITOR_DEFAULT_KEY_SIZE_PX = 42;
const CONTROL_MONITOR_DEFAULT_KEY_GAP_PX = 7;
const CONTROL_MONITOR_MIN_POLL_DELAY_MS = 50;
const CONTROL_MONITOR_KEY_STATE_FAILURE_LIMIT = 3;
const CONTROL_MONITOR_KEY_STATE_FAILURE_BACKOFF_MS = 500;
const CONTROL_MONITOR_CLIENT_STALE_GRACE_MS = 300;
const CONTROL_MONITOR_DEFAULT_SESSION = "robot-control";
const CONTROL_MONITOR_CONNECTED_CALL_STATES = new Set([
  "connected",
  "open",
  "live",
  "ready",
  "datachannel-open",
  "datachannel_open",
  "channel-open",
  "channel_open",
]);
const CONTROL_COMMAND_SESSION = "robot-command";
const CONTROL_MONITOR_DIALING_CALL_STATES = new Set([
  "dialing",
  "calling",
  "connecting",
  "offering",
  "waiting",
  "waiting-answer",
  "waiting_answer",
  "have-local-offer",
  "have_local_offer",
]);
const CONTROL_MONITOR_DEFAULT_LINK_STATUS: ControlMonitorLinkStatus = {
  frontendDialing: false,
  backendListening: false,
  directConnected: false,
  frontendLatencyMs: null,
  frontendLatencySource: "",
  backendLatencyMs: null,
  backendLatencySource: "",
  directLatencyMs: null,
  directLatencySource: "",
  pendingOffers: 0,
  userPendingOffers: 0,
  internalPendingOffers: 0,
  browserPosts: 0,
  robotPolls: 0,
  answersPosted: 0,
  activeClientCount: 0,
  dialingClientCount: 0,
  connectedClientCount: 0,
  robotPollFreshMs: 5000,
  robotPollAgeMs: null,
  signalPairFreshMs: 15000,
  signalPairAgeMs: null,
  signalPaired: false,
  inferredDirectConnected: false,
  robotListenerClientId: "",
  robotListenerFreshMs: 10000,
  robotListenerAgeMs: null,
  robotListenerLatencyMs: null,
  robotListenerLatencySource: "",
  robotListenerLatencyUpdatedAt: null,
  robotListenerConflictCount: 0,
  lastRobotListenerAt: null,
  lastBrowserOfferAt: null,
  lastRobotPollAt: null,
  lastAnswerAt: null,
  source: "",
};

const CONTROL_MONITOR_CLIENT_COLORS = [
  {
    id: "green",
    label: "GREEN",
    start: "#16a34a",
    end: "#6ee7b7",
    glow: "rgba(34, 197, 94, 0.34)",
  },
  {
    id: "blue",
    label: "BLUE",
    start: "#2563eb",
    end: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.34)",
  },
  {
    id: "red",
    label: "RED",
    start: "#dc2626",
    end: "#fb7185",
    glow: "rgba(248, 113, 113, 0.34)",
  },
  {
    id: "yellow",
    label: "YELLOW",
    start: "#eab308",
    end: "#fde047",
    glow: "rgba(250, 204, 21, 0.34)",
  },
] as const;

type ControlMonitorColorId = (typeof CONTROL_MONITOR_CLIENT_COLORS)[number]["id"];

type ControlMonitorClientColorAssignment = {
  clientId: string;
  colorId: ControlMonitorColorId;
};

type ControlMonitorColoredClient = ControlMonitorKeyClientState & {
  colorId: ControlMonitorColorId;
  colorLabel: string;
  colorStart: string;
  colorEnd: string;
  colorGlow: string;
};
type UiLogLevel = "info" | "warn" | "error" | "success";
type ActionFlowOptions = {
  focusActivity?: boolean;
  debugLabel?: string;
};
type BrowserCameraProbeState = {
  status: "checking" | "available" | "unavailable" | "blocked";
  count: number;
  label: string;
  note: string;
};
type TrafficChartPoint = {
  timestampMs: number;
  rxBps: number;
  txBps: number;
};
type TrafficChartSvgPoint = {
  x: number;
  y: number;
};

const CONTROL_MONITOR_SPECIAL_KEY_LABELS: Record<string, string> = {
  ARROWDOWN: "DOWN",
  ARROWLEFT: "LEFT",
  ARROWRIGHT: "RIGHT",
  ARROWUP: "UP",
  ENTER: "ENTER",
  ESCAPE: "ESC",
  SEMICOLON: ";",
  SHIFTLEFT: "SHIFT",
  SHIFTRIGHT: "SHIFT",
  SPACE: "SPACE",
  TAB: "TAB",
};
const BROWSER_CAMERA_PROBE_INITIAL: BrowserCameraProbeState = {
  status: "checking",
  count: 0,
  label: "",
  note: "正在检测浏览器摄像头",
};

function normalizeBrowserCameraLabel(label: string) {
  return label
    .trim()
    .replace(/\s+\([0-9a-f]{4,}\)$/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function dedupeBrowserCameras(devices: MediaDeviceInfo[]) {
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const grouped = new Map<string, MediaDeviceInfo>();
  for (const camera of cameras) {
    const normalizedLabel = normalizeBrowserCameraLabel(camera.label || "");
    const key = camera.groupId || normalizedLabel || camera.deviceId || `camera-${grouped.size}`;
    if (!grouped.has(key)) {
      grouped.set(key, camera);
    }
  }
  return Array.from(grouped.values());
}

function normalizeControlMonitorKeyName(value: unknown) {
  const rawKey = String(value || "").trim();
  if (!rawKey) {
    return "";
  }

  const upperKey = rawKey.toUpperCase();
  if (upperKey.length === 1) {
    return upperKey;
  }

  const keyboardCodeMatch = /^KEY([A-Z])$/.exec(upperKey);
  if (keyboardCodeMatch) {
    return keyboardCodeMatch[1];
  }

  const digitCodeMatch = /^DIGIT([0-9])$/.exec(upperKey);
  if (digitCodeMatch) {
    return digitCodeMatch[1];
  }

  return CONTROL_MONITOR_SPECIAL_KEY_LABELS[upperKey] ?? upperKey;
}

function unwrapControlMonitorPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const message = value as Record<string, unknown>;
  if (message.payload && typeof message.payload === "object" && !Array.isArray(message.payload)) {
    return message.payload as Record<string, unknown>;
  }

  return message;
}

const VIEW_META: Record<ConsoleView, { title: string }> = {
  overview: { title: "云服务控制台" },
  services: { title: "服务管理" },
  health: { title: "健康检查" },
  activity: { title: "活动日志" },
  localStream: { title: "本地推流" },
  models: { title: "模型仓库" },
  settings: { title: "系统设置" },
};

const emptyStatus: DashboardStatus = {
  connected: false,
  ssh_target: "ubuntu@-",
  public_base_url: "http://-:18081",
  ingest_mode: "unknown",
  pending_offers: "-",
  service_running_count: "0 / 4",
  health_ok_count: "0 / 3",
  last_refresh: "never",
  summary_status: "Loading",
  config_path: "",
  services: [],
  health_checks: [],
  port_checks: [],
  network_snapshot: {
    local: {
      ip: "-",
      location: "-",
      country_code: "",
    },
    server: {
      ip: "-",
      location: "-",
      country_code: "",
    },
    last_checked: "never",
  },
  broker_status: null,
};

const defaultLocalStreamConfig: LocalStreamConfig = {
  stream_name: "main-camera",
  use_current_server: true,
  cloud_public_scheme: "http",
  cloud_public_host: "",
  cloud_api_port: 18081,
  cloud_ingest_port: 18084,
  cloud_srt_ingest_port: 19091,
  cloud_webrtc_port: 19090,
  camera_name: "",
  camera_device: "",
  input_format: "",
  video_size: "1920x1080",
  output_video_size: "1920x1080",
  input_framerate: 30,
  target_framerate: 30,
  video_bitrate: "1800k",
  ffmpeg_path: "ffmpeg",
  open_viewer_on_start: false,
  hidden_delay_marker_enabled: false,
  video_encoder: "libx264",
  ingest_mode: "srt",
  srt_latency_ms: 1000,
  srt_packet_size: 1128,
  connect_timeout_ms: 3000,
  drop_late_packets: false,
};

const emptyLocalStreamStatus: LocalStreamStatus = {
  camera_connected: false,
  cameras: [],
  running: false,
  pid: null,
  config: defaultLocalStreamConfig,
  target_url: "",
  ffmpeg_available: false,
  server_reachable: false,
  server_note: "",
  local_stream_ready: false,
  local_stream_note: "",
  push_visible: false,
  push_note: "",
  pull_reachable: false,
  pull_note: "",
  log_tail: "",
  message: "No local camera detected.",
  updated_at: "never",
};

const emptyP2pLocalPusherStatus: P2PLocalPusherStatus = {
  available: false,
  running: false,
  pid: null,
  project_path: "",
  config_path: "",
  room_id: P2P_DEFAULT_ROOM_ID,
  watch_url: buildP2pWatchPageUrl(P2P_DEFAULT_ROOM_ID),
  active_profile: {},
  log_tail: "",
  message: "",
  updated_at: "",
};

const emptyTrafficMonitorSnapshot: TrafficMonitorSnapshot = {
  connected: false,
  timestamp: "",
  timestamp_ms: 0,
  rx_bytes: 0,
  tx_bytes: 0,
  rx_bps: 0,
  tx_bps: 0,
  total_bps: 0,
  capacity_bps: null,
  capacity_source: "",
  utilization_percent: null,
  congestion_level: "unknown",
  congestion_note: "连接服务器后显示流量监控",
  active_services: 0,
  monitored_services: 0,
  cpu_percent: null,
  cpu_core_count: null,
  memory_percent: null,
  memory_used_mb: null,
  memory_total_mb: null,
  load_1m: null,
  load_5m: null,
  load_15m: null,
  disk_percent: null,
  disk_used_gb: null,
  disk_total_gb: null,
  uptime_seconds: null,
  interfaces: [],
  services: [],
  error: "",
};

function parseLocalStreamSize(value: string | undefined, fallbackWidth = 1920, fallbackHeight = 1080) {
  const match = /^(\d{1,5})\s*(?:x|X|×|\*|\s)\s*(\d{1,5})$/.exec(String(value || "").trim());
  if (!match) {
    return { width: fallbackWidth, height: fallbackHeight };
  }
  return {
    width: Math.max(1, Number(match[1]) || fallbackWidth),
    height: Math.max(1, Number(match[2]) || fallbackHeight),
  };
}

function formatLocalStreamSize(width: number, height: number) {
  return `${Math.max(1, Math.round(width || 1))}x${Math.max(1, Math.round(height || 1))}`;
}

function formatTrafficRate(bps: number) {
  const safeBps = Math.max(0, Number.isFinite(bps) ? bps : 0);
  const bytesPerSecond = safeBps / 8;
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / 1024 / 1024).toFixed(bytesPerSecond >= 10 * 1024 * 1024 ? 1 : 2)} MB/s`;
  }
  if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(bytesPerSecond >= 10 * 1024 ? 1 : 2)} KB/s`;
  }
  return `${bytesPerSecond.toFixed(0)} B/s`;
}

function formatTrafficAmount(bytes: number) {
  const safeBytes = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  if (safeBytes >= 1024 * 1024 * 1024) {
    return `${(safeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  if (safeBytes >= 1024 * 1024) {
    return `${(safeBytes / 1024 / 1024).toFixed(2)} MB`;
  }
  if (safeBytes >= 1024) {
    return `${(safeBytes / 1024).toFixed(1)} KB`;
  }
  return `${safeBytes.toFixed(0)} B`;
}

function formatTrafficCapacity(bps: number | null | undefined) {
  if (!bps || !Number.isFinite(bps) || bps <= 0) {
    return "未知";
  }
  const mbps = bps / 1_000_000;
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(1)} Gbps`;
  }
  return `${mbps.toFixed(mbps >= 100 ? 0 : 1)} Mbps`;
}

function formatMonitorPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "未知";
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function normalizeGaugePercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, value));
}

function formatMonitorMemory(usedMb: number | null | undefined, totalMb: number | null | undefined) {
  if (
    typeof usedMb !== "number" ||
    typeof totalMb !== "number" ||
    !Number.isFinite(usedMb) ||
    !Number.isFinite(totalMb) ||
    totalMb <= 0
  ) {
    return "等待采样";
  }
  if (totalMb >= 1024) {
    return `${(usedMb / 1024).toFixed(1)} / ${(totalMb / 1024).toFixed(1)} GB`;
  }
  return `${usedMb.toFixed(0)} / ${totalMb.toFixed(0)} MB`;
}

function formatMonitorDisk(usedGb: number | null | undefined, totalGb: number | null | undefined) {
  if (
    typeof usedGb !== "number" ||
    typeof totalGb !== "number" ||
    !Number.isFinite(usedGb) ||
    !Number.isFinite(totalGb) ||
    totalGb <= 0
  ) {
    return "等待采样";
  }
  return `${usedGb.toFixed(1)} / ${totalGb.toFixed(1)} GB`;
}

function formatMonitorLoad(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "未知";
  }
  return value.toFixed(2);
}

function formatMonitorCoreCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "未知核心";
  }
  return `${Math.round(value)} 核`;
}

function formatMonitorUptime(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "等待采样";
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) {
    return `${days} 天 ${hours} 小时`;
  }
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} 小时 ${minutes} 分钟`;
}

function formatTrafficAxisLabel(bps: number) {
  const safeBps = Math.max(0, Number.isFinite(bps) ? bps : 0);
  const mbps = safeBps / 1_000_000;
  if (mbps >= 10) {
    return `${mbps.toFixed(0)}M`;
  }
  if (mbps >= 1) {
    return `${mbps.toFixed(1)}M`;
  }
  const kbps = safeBps / 1000;
  if (kbps >= 1) {
    return `${kbps.toFixed(0)}K`;
  }
  return "0";
}

function clampTrafficControlPoint(value: number, start: number, end: number) {
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  return Math.max(min, Math.min(max, value));
}

function buildSmoothTrafficPath(points: TrafficChartSvgPoint[]) {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  }

  const smoothness = 0.18;
  const segments = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const cp1x = clampTrafficControlPoint(p1.x + (p2.x - p0.x) * smoothness, p1.x, p2.x);
    const cp1y = clampTrafficControlPoint(p1.y + (p2.y - p0.y) * smoothness, p1.y, p2.y);
    const cp2x = clampTrafficControlPoint(p2.x - (p3.x - p1.x) * smoothness, p1.x, p2.x);
    const cp2y = clampTrafficControlPoint(p2.y - (p3.y - p1.y) * smoothness, p1.y, p2.y);
    segments.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
    );
  }

  return segments.join(" ");
}

function parseLocalStreamBitrateKbps(value: string | undefined) {
  const match = /(\d+)/.exec(String(value || ""));
  return Math.max(1, Number(match?.[1]) || 1800);
}

function buildLocalStreamDraft(config: LocalStreamConfig): LocalStreamDraftState {
  const inputSize = parseLocalStreamSize(config.video_size);
  const outputSize = parseLocalStreamSize(config.output_video_size, inputSize.width, inputSize.height);
  const viewerFps = parseDraftInteger(
    String(config.target_framerate || config.input_framerate || 30),
    config.target_framerate || config.input_framerate || 30,
    1,
    120,
  );
  return {
    viewerResolution: formatLocalStreamSize(outputSize.width, outputSize.height),
    inputFramerate: String(viewerFps),
    targetFramerate: String(viewerFps),
    videoBitrateKbps: String(parseLocalStreamBitrateKbps(config.video_bitrate)),
    srtLatencyMs: String(config.srt_latency_ms),
    srtPacketSize: String(config.srt_packet_size),
    connectTimeoutMs: String(config.connect_timeout_ms),
    cloudApiPort: String(config.cloud_api_port),
    cloudIngestPort: String(config.cloud_ingest_port),
    cloudSrtIngestPort: String(config.cloud_srt_ingest_port),
  };
}

function applyLocalStreamDraftToConfig(config: LocalStreamConfig, draft: LocalStreamDraftState): LocalStreamConfig {
  const inputSize = parseLocalStreamSize(config.video_size);
  const outputSize = parseLocalStreamSize(config.output_video_size, inputSize.width, inputSize.height);
  const viewerSize = parseLocalStreamSize(draft.viewerResolution, outputSize.width, outputSize.height);
  const viewerFps = parseDraftInteger(
    draft.targetFramerate || draft.inputFramerate,
    config.target_framerate || config.input_framerate,
    1,
    120,
  );

  return {
    ...config,
    video_size: formatLocalStreamSize(viewerSize.width, viewerSize.height),
    output_video_size: formatLocalStreamSize(viewerSize.width, viewerSize.height),
    input_framerate: viewerFps,
    target_framerate: viewerFps,
    video_bitrate: `${parseDraftInteger(draft.videoBitrateKbps, parseLocalStreamBitrateKbps(config.video_bitrate), 1)}k`,
    srt_latency_ms: parseDraftInteger(draft.srtLatencyMs, config.srt_latency_ms, 40, 5000),
    srt_packet_size: parseDraftInteger(draft.srtPacketSize, config.srt_packet_size, 188, 65535),
    connect_timeout_ms: parseDraftInteger(draft.connectTimeoutMs, config.connect_timeout_ms, 100, 30000),
    cloud_api_port: parseDraftInteger(draft.cloudApiPort, config.cloud_api_port, 1, 65535),
    cloud_ingest_port: parseDraftInteger(draft.cloudIngestPort, config.cloud_ingest_port, 1, 65535),
    cloud_srt_ingest_port: parseDraftInteger(draft.cloudSrtIngestPort, config.cloud_srt_ingest_port, 1, 65535),
  };
}

function parseDraftInteger(rawValue: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) {
  const nextValue = Number(rawValue);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(nextValue)));
}

function normalizeLocalStreamConfig(config: LocalStreamConfig): LocalStreamConfig {
  const inputSize = parseLocalStreamSize(config.video_size);
  const outputSize = parseLocalStreamSize(config.output_video_size, inputSize.width, inputSize.height);
  const inputFormat = String(config.input_format || "").trim().toLowerCase();
  return {
    ...config,
    stream_name: STREAM_NAME,
    ffmpeg_path: config.ffmpeg_path || "ffmpeg",
    input_format: inputFormat === "mjpeg" ? "mjpeg" : "",
    video_size: formatLocalStreamSize(inputSize.width, inputSize.height),
    output_video_size: formatLocalStreamSize(outputSize.width, outputSize.height),
    video_bitrate: `${parseLocalStreamBitrateKbps(config.video_bitrate)}k`,
  };
}

function buildTencentCloudVideoConfig(config: LocalStreamConfig): TencentCloudVideoConfig {
  const inputSize = parseLocalStreamSize(config.video_size, 1280, 720);
  const outputSize = parseLocalStreamSize(config.output_video_size, inputSize.width, inputSize.height);
  const width = Math.min(3840, Math.max(160, Math.round(outputSize.width)));
  const height = Math.min(2160, Math.max(120, Math.round(outputSize.height)));
  const fps = Math.min(60, Math.max(1, Math.round(Number(config.target_framerate) || 30)));
  const bitrateKbps = Math.min(12000, Math.max(100, parseLocalStreamBitrateKbps(config.video_bitrate)));
  const quality = height >= 1080 ? "1080p" : height >= 720 ? "720p" : "540p";
  return { width, height, fps, bitrateKbps, quality };
}

function buildStreamSignalUrl(publicBaseUrl: string) {
  try {
    const url = new URL(publicBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/api/ws";
    url.search = `?src=${encodeURIComponent(STREAM_NAME)}`;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function buildLocalStreamPublicBaseUrl(config: LocalStreamConfig, fallbackPublicBaseUrl: string) {
  const scheme = config.cloud_public_scheme === "https" ? "https" : "http";
  const host = String(config.cloud_public_host || "").trim();
  if (!host) {
    return String(fallbackPublicBaseUrl || "").replace(/\/+$/, "");
  }

  const port = Number(config.cloud_api_port);
  const defaultPort = scheme === "https" ? 443 : 80;
  const authority = port && port !== defaultPort ? `${host}:${port}` : host;
  return `${scheme}://${authority}`;
}

function buildLocalStreamViewerUrl(config: LocalStreamConfig, fallbackPublicBaseUrl: string) {
  const publicBaseUrl = buildLocalStreamPublicBaseUrl(config, fallbackPublicBaseUrl);
  const streamName = String(config.stream_name || STREAM_NAME).trim() || STREAM_NAME;
  return `${publicBaseUrl}/${encodeURIComponent(streamName)}-video.html`;
}

function mergeCheckedPortStatus(current: PortStatus[], nextStatus: PortStatus) {
  const found = current.some((item) => item.key === nextStatus.key);
  if (!found) {
    return [...current, nextStatus];
  }
  return current.map((item) => (item.key === nextStatus.key ? nextStatus : item));
}

function lampClassForPort(portCheck: PortStatus) {
  if (!portCheck.checked) {
    return "idle";
  }
  return portCheck.listening ? "live" : "off";
}

function normalizePressedControlKeys(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique = new Set<string>();
  for (const item of value) {
    const nextKey = normalizeControlMonitorKeyName(item);
    if (nextKey) {
      unique.add(nextKey);
    }
  }
  return Array.from(unique);
}

function normalizeControlMonitorClient(client: ControlMonitorKeyClientState) {
  return {
    ...client,
    pressedKeys: normalizePressedControlKeys(client.pressedKeys),
    latencyMs: null,
    latencySource: "",
    inputMode: normalizeControlMonitorInputMode(client.inputMode || client.type),
  };
}

function normalizeControlMonitorInputMode(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "keyboard" || normalized === "keyboard_sample" || normalized === "kb") {
    return "keyboard";
  }
  if (normalized === "vr" || normalized === "vr_sample" || normalized === "xr") {
    return "vr";
  }
  if (normalized === "text" || normalized === "text_instruction") {
    return "text";
  }
  return normalized;
}

function normalizeControlMonitorCallState(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function formatControlMonitorInputMode(value: unknown) {
  const normalized = normalizeControlMonitorInputMode(value);
  if (normalized === "keyboard") {
    return "Keyboard";
  }
  if (normalized === "vr") {
    return "VR";
  }
  if (normalized === "text") {
    return "Text";
  }
  return normalized || "-";
}

function chooseControlMonitorInputMode(clients: ControlMonitorKeyClientState[]) {
  const connected = clients.find((client) => CONTROL_MONITOR_CONNECTED_CALL_STATES.has(normalizeControlMonitorCallState(client.callState)));
  return formatControlMonitorInputMode((connected ?? clients[0])?.inputMode);
}

function isControlMonitorClientFresh(client: ControlMonitorKeyClientState, ttlSec: number) {
  const ageMs = Number(client.ageMs);
  const ttlMs = Math.max(500, Math.round((Number(ttlSec) || 1.2) * 1000)) + CONTROL_MONITOR_CLIENT_STALE_GRACE_MS;
  return Number.isFinite(ageMs) && ageMs <= ttlMs;
}

function normalizeControlMonitorLinkStatus(
  rawStatus: ControlMonitorLinkStatus | undefined,
  clients: ControlMonitorKeyClientState[],
) {
  const currentStatus = rawStatus ?? CONTROL_MONITOR_DEFAULT_LINK_STATUS;
  const connectedClientCount = clients.filter((client) =>
    CONTROL_MONITOR_CONNECTED_CALL_STATES.has(normalizeControlMonitorCallState(client.callState)),
  ).length;
  const dialingClientCount = clients.filter((client) =>
    CONTROL_MONITOR_DIALING_CALL_STATES.has(normalizeControlMonitorCallState(client.callState)),
  ).length;
  const robotListenerAgeMs =
    typeof currentStatus.robotListenerAgeMs === "number" && Number.isFinite(currentStatus.robotListenerAgeMs)
      ? currentStatus.robotListenerAgeMs
      : currentStatus.robotPollAgeMs;
  const robotListenerFreshMs = Math.max(
    0,
    Number(currentStatus.robotListenerFreshMs || currentStatus.robotPollFreshMs || 0),
  );
  const backendListening =
    typeof robotListenerAgeMs === "number" &&
    Number.isFinite(robotListenerAgeMs) &&
    (!robotListenerFreshMs || robotListenerAgeMs <= robotListenerFreshMs);
  const userPendingOffers = Number(currentStatus.userPendingOffers ?? currentStatus.pendingOffers ?? 0) || 0;
  const directConnected = connectedClientCount > 0 && backendListening;

  return {
    ...currentStatus,
    frontendDialing: userPendingOffers > 0 || dialingClientCount > 0 || directConnected,
    backendListening,
    directConnected,
    activeClientCount: clients.length,
    dialingClientCount,
    connectedClientCount,
  };
}

function formatControlMonitorClientLabel(client: ControlMonitorKeyClientState) {
  const rawId = String(client.clientId || "").trim();
  if (!rawId) {
    return "unknown-client";
  }
  if (rawId.length <= 18) {
    return rawId;
  }
  return `${rawId.slice(0, 10)}...${rawId.slice(-5)}`;
}

function formatControlMonitorAge(ageMs: number) {
  const safeAgeMs = Math.max(0, Number(ageMs) || 0);
  if (safeAgeMs < 1000) {
    return `${safeAgeMs}ms`;
  }
  return `${(safeAgeMs / 1000).toFixed(1)}s`;
}

function getControlMonitorColor(colorId: ControlMonitorColorId) {
  return CONTROL_MONITOR_CLIENT_COLORS.find((item) => item.id === colorId) ?? CONTROL_MONITOR_CLIENT_COLORS[0];
}

function buildControlMonitorKeyGradient(clients: ControlMonitorColoredClient[]) {
  if (!clients.length) {
    return undefined;
  }

  if (clients.length === 1) {
    const [client] = clients;
    return `linear-gradient(135deg, ${client.colorStart} 0%, ${client.colorEnd} 100%)`;
  }

  const softBand = Math.min(18, 50 / clients.length);
  const colorStops = clients.flatMap((client, index) => {
    const center = (index / (clients.length - 1)) * 100;
    const start = index === 0 ? 0 : Math.max(0, center - softBand);
    const end = index === clients.length - 1 ? 100 : Math.min(100, center + softBand);
    return [
      `${client.colorStart} ${Math.round(start)}%`,
      `${client.colorEnd} ${Math.round(end)}%`,
    ];
  });

  return `linear-gradient(135deg, ${colorStops.join(", ")})`;
}

function buildControlMonitorKeyGlow(clients: ControlMonitorColoredClient[]) {
  if (!clients.length) {
    return undefined;
  }
  return clients.map((client, index) => `0 ${10 + index * 3}px ${24 + index * 5}px ${client.colorGlow}`).join(", ");
}

function formatUiLogTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

function buildUiLogEntry(message: string, level: UiLogLevel = "info"): LogEntry {
  return {
    timestamp: formatUiLogTimestamp(),
    level,
    message: String(message || "").trim(),
  };
}

function summarizeLocalStreamError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error || "本地推流启动失败");
  const normalized = rawMessage.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "本地推流启动失败，请查看下方推流日志。";
  }
  if (normalized.includes("Local stream startup failed")) {
    return normalized.replace(/^Local stream startup failed\.\s*/i, "本地推流启动失败：");
  }
  if (normalized.includes("Local stream exited during startup")) {
    return "本地推流启动失败，请查看下方推流日志。";
  }
  if (normalized.includes("Error opening output file")) {
    return "本地推流启动失败：FFmpeg 无法打开云端推流输出，请查看下方推流日志。";
  }
  if (normalized.length > 180) {
    return `${normalized.slice(0, 177)}...`;
  }
  return normalized;
}

function normalizeTencentCloudUrlInput(url: string) {
  return String(url || "").replace(/\s+/g, "").trim();
}

function buildTencentCloudPlayerPageUrl(playUrl: string) {
  const normalizedPlayUrl = normalizeTencentCloudUrlInput(playUrl);
  if (!normalizedPlayUrl) {
    return "";
  }

  try {
    const pageUrl = new URL(TENCENT_CLOUD_PLAYER_PAGE_PATH, window.location.origin);
    pageUrl.searchParams.set("url", normalizedPlayUrl);
    const accessToken = getStoredAccessToken();
    if (accessToken) {
      pageUrl.searchParams.set("access_token", accessToken);
    }
    return pageUrl.toString();
  } catch {
    const accessToken = getStoredAccessToken();
    const tokenPart = accessToken ? `&access_token=${encodeURIComponent(accessToken)}` : "";
    return `${TENCENT_CLOUD_PLAYER_PAGE_PATH}?url=${encodeURIComponent(normalizedPlayUrl)}${tokenPart}`;
  }
}

function buildTencentCloudDefaultPlayUrl(status: DashboardStatus, streamName = "robot_control") {
  try {
    const sourceUrl = new URL(status.public_base_url || window.location.origin);
    const host = sourceUrl.hostname || window.location.hostname;
    if (!host) {
      return "";
    }
    return `webrtc://${host}/live/${encodeURIComponent(streamName)}`;
  } catch {
    const host = window.location.hostname;
    return host ? `webrtc://${host}/live/${encodeURIComponent(streamName)}` : "";
  }
}

function makeP2pPeerId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

function normalizeP2pRoomInput(value: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .slice(0, 64);
  return normalized || P2P_DEFAULT_ROOM_ID;
}

function p2pV2RoleLabel(role: string) {
  return ({
    "video-pusher": "视频推流端",
    compute: "计算服务器",
    "robot-edge": "机械臂端侧",
    frontend: "前端",
    viewer: "观看端",
  } as Record<string, string>)[role] || "其他端";
}

function p2pV2StatusLabel(status: string | undefined) {
  return ({ waiting: "等待连接", connecting: "连接中", connected: "已连接", busy: "忙碌" } as Record<string, string>)[status || ""] || "在线";
}

function buildP2pWatchPageUrl(roomId = P2P_DEFAULT_ROOM_ID, signalBaseUrl = P2P_SIGNAL_BASE_URL) {
  const url = new URL("/watch.html", signalBaseUrl || P2P_SIGNAL_BASE_URL);
  url.searchParams.set("room", normalizeP2pRoomInput(roomId));
  return url.toString();
}

function buildP2pV2WatchPageUrl(roomId: string, endpointId: string, signalBaseUrl = P2P_SIGNAL_BASE_URL) {
  const url = new URL("/watch.html", signalBaseUrl || P2P_SIGNAL_BASE_URL);
  url.searchParams.set("room", normalizeP2pRoomInput(roomId));
  url.searchParams.set("v", "2");
  url.searchParams.set("endpoint", endpointId);
  return url.toString();
}

function normalizeP2pSignalBaseUrl(value: string) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  try {
    return new URL(text).origin.toLowerCase();
  } catch {
    return text.replace(/\/+$/, "").toLowerCase();
  }
}

function isKnownP2pSignalBaseUrl(value: string) {
  return P2P_KNOWN_SIGNAL_BASE_URLS.has(normalizeP2pSignalBaseUrl(value));
}

function normalizeP2pServerHost(value: string) {
  let text = String(value || "").trim();
  if (!text) {
    return "";
  }

  try {
    if (text.includes("://")) {
      return new URL(text).hostname.toLowerCase();
    }
  } catch {
    // Fall through to plain host parsing.
  }

  if (text.includes("@")) {
    text = text.slice(text.lastIndexOf("@") + 1);
  }
  text = text.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  text = text.split(/[/?#]/)[0] || "";
  if (text.startsWith("[") && text.includes("]")) {
    text = text.slice(1, text.indexOf("]"));
  } else {
    text = text.split(":")[0] || "";
  }
  return text.trim().toLowerCase();
}

function isMeaningfulP2pServerHost(host: string) {
  return Boolean(host && host !== "-" && host !== "localhost" && host !== "127.0.0.1" && host !== "::1");
}

function resolveDashboardP2pSignalBaseUrl(status: DashboardStatus, config: LocalStreamConfig) {
  const hosts = [
    normalizeP2pServerHost(status.ssh_target),
    normalizeP2pServerHost(status.public_base_url),
    normalizeP2pServerHost(status.network_snapshot?.server?.ip || ""),
    normalizeP2pServerHost(config.cloud_public_host),
  ].filter(isMeaningfulP2pServerHost);

  if (hosts.length === 0) {
    return "";
  }
  return hosts.some((host) => P2P_GUANGZHOU_HOSTS.has(host))
    ? P2P_GUANGZHOU_SIGNAL_BASE_URL
    : P2P_HONG_KONG_SIGNAL_BASE_URL;
}

function buildServerPreferredP2pEndpoint(endpoint: P2pEndpoint, signalBaseUrl: string) {
  if (!signalBaseUrl || !isKnownP2pSignalBaseUrl(endpoint.signalBaseUrl)) {
    return endpoint;
  }
  if (normalizeP2pSignalBaseUrl(endpoint.signalBaseUrl) === normalizeP2pSignalBaseUrl(signalBaseUrl)) {
    return endpoint;
  }
  return normalizeP2pEndpointInput(buildP2pWatchPageUrl(endpoint.roomId, signalBaseUrl));
}

function normalizeP2pEndpointInput(value: string): P2pEndpoint {
  let text = String(value || "").trim();
  if (!text) {
    text = P2P_DEFAULT_WATCH_URL;
  } else if (!text.includes("://") && text.includes(".")) {
    text = `https://${text}`;
  }
  if (!text.includes("://")) {
    const roomId = normalizeP2pRoomInput(text);
    return {
      signalBaseUrl: P2P_SIGNAL_BASE_URL,
      roomId,
      watchUrl: buildP2pWatchPageUrl(roomId),
    };
  }
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported P2P URL protocol");
    }
    const roomId = normalizeP2pRoomInput(parsed.searchParams.get("room") || P2P_DEFAULT_ROOM_ID);
    const signalBaseUrl = parsed.origin;
    return {
      signalBaseUrl,
      roomId,
      watchUrl: buildP2pWatchPageUrl(roomId, signalBaseUrl),
    };
  } catch {
    const roomId = normalizeP2pRoomInput(text);
    return {
      signalBaseUrl: P2P_SIGNAL_BASE_URL,
      roomId,
      watchUrl: buildP2pWatchPageUrl(roomId),
    };
  }
}

function readSavedP2pEndpoint() {
  const savedLink = readClientStoredValue(P2P_LINK_STORAGE_KEY);
  if (savedLink) {
    return normalizeP2pEndpointInput(savedLink);
  }
  const oldSavedRoom = readClientStoredValue(P2P_ROOM_STORAGE_KEY);
  return normalizeP2pEndpointInput(oldSavedRoom || P2P_DEFAULT_WATCH_URL);
}

function readSavedP2pLink() {
  return readSavedP2pEndpoint().watchUrl;
}

function rememberP2pLink(value: string) {
  const endpoint = normalizeP2pEndpointInput(value);
  rememberClientStoredValue(P2P_LINK_STORAGE_KEY, endpoint.watchUrl);
  rememberClientStoredValue(P2P_ROOM_STORAGE_KEY, endpoint.roomId);
  return endpoint;
}

function readClientStoredValue(storageKey: string) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const localValue = window.localStorage.getItem(storageKey);
    if (localValue) {
      return localValue;
    }
  } catch {
    // Fall through to session storage and cookie fallback.
  }

  try {
    const sessionValue = window.sessionStorage.getItem(storageKey);
    if (sessionValue) {
      return sessionValue;
    }
  } catch {
    // Fall through to cookie fallback.
  }

  const cookiePrefix = `${storageKey}=`;
  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith(cookiePrefix))
    ?.slice(cookiePrefix.length);
  return cookieValue ? decodeURIComponent(cookieValue) : "";
}

function rememberClientStoredValue(storageKey: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    // Continue with other browser-local stores.
  }

  try {
    window.sessionStorage.setItem(storageKey, value);
  } catch {
    // Cookie fallback below still keeps the value on normal web entries.
  }

  try {
    const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${storageKey}=${encodeURIComponent(value)}; Max-Age=${TENCENT_CLOUD_URL_STORAGE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureFlag}`;
  } catch {
    // Restricted WebViews can disable all browser-local storage; the session state still works.
  }
}

function readSavedTencentCloudPushUrl() {
  return normalizeTencentCloudUrlInput(readClientStoredValue(TENCENT_CLOUD_PUSH_URL_STORAGE_KEY)) || TENCENT_CLOUD_PUSH_DEFAULT_URL;
}

function rememberTencentCloudPushUrl(pushUrl: string) {
  const normalizedPushUrl = normalizeTencentCloudUrlInput(pushUrl);
  if (normalizedPushUrl) {
    rememberClientStoredValue(TENCENT_CLOUD_PUSH_URL_STORAGE_KEY, normalizedPushUrl);
  }
  return normalizedPushUrl;
}

function readSavedTencentCloudPlayUrl() {
  return normalizeTencentCloudUrlInput(readClientStoredValue(TENCENT_CLOUD_PLAY_URL_STORAGE_KEY)) || TENCENT_CLOUD_PLAY_DEFAULT_URL;
}

function rememberTencentCloudPlayUrl(playUrl: string) {
  const normalizedPlayUrl = normalizeTencentCloudUrlInput(playUrl);
  if (normalizedPlayUrl) {
    rememberClientStoredValue(TENCENT_CLOUD_PLAY_URL_STORAGE_KEY, normalizedPlayUrl);
  }
  return normalizedPlayUrl;
}

function readTencentCloudPushSession() {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return normalizeTencentCloudUrlInput(window.localStorage.getItem(TENCENT_CLOUD_PUSH_SESSION_STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

function rememberTencentCloudPushSession(pushUrl: string) {
  const normalizedPushUrl = normalizeTencentCloudUrlInput(pushUrl);
  if (typeof window === "undefined" || !normalizedPushUrl) {
    return;
  }
  try {
    window.localStorage.setItem(TENCENT_CLOUD_PUSH_SESSION_STORAGE_KEY, normalizedPushUrl);
  } catch {
    // Session restore is a convenience; live pushing still works without it.
  }
}

function clearTencentCloudPushSession() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(TENCENT_CLOUD_PUSH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage restrictions.
  }
}

function normalizeCloudPublicBaseUrl(baseUrl: string) {
  const candidate = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!candidate || candidate.includes("://-")) {
    return "";
  }
  try {
    const parsed = new URL(candidate);
    return parsed.origin;
  } catch {
    return "";
  }
}

function parseTencentCloudPushUrl(pushUrl: string) {
  try {
    const parsed = new URL(normalizeTencentCloudUrlInput(pushUrl));
    const segments = parsed.pathname.split("/").filter(Boolean);
    return {
      streamName: segments[segments.length - 1] || "robot_control",
      pushUrlHost: parsed.host,
    };
  } catch {
    return {
      streamName: "robot_control",
      pushUrlHost: "",
    };
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readFiniteNumber(value: unknown, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function readNullableFiniteNumber(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function buildControlSignalCounterBaseline(linkStatus: ControlMonitorLinkStatus): ControlSignalCounterBaseline {
  return {
    browserPosts: linkStatus.browserPosts,
    robotPolls: linkStatus.robotPolls,
    answersPosted: linkStatus.answersPosted,
  };
}

function counterDelta(value: number, baseline = 0) {
  return Math.max(0, value - baseline);
}

function coerceOverviewControlLinkStatus(rawStatus: unknown): ControlMonitorLinkStatus {
  const raw = isPlainRecord(rawStatus) ? rawStatus : {};
  return {
    ...CONTROL_MONITOR_DEFAULT_LINK_STATUS,
    frontendDialing: Boolean(raw.frontendDialing),
    backendListening: Boolean(raw.backendListening),
    directConnected: Boolean(raw.directConnected),
    pendingOffers: readFiniteNumber(raw.pendingOffers),
    userPendingOffers: readFiniteNumber(raw.userPendingOffers ?? raw.pendingOffers),
    internalPendingOffers: readFiniteNumber(raw.internalPendingOffers),
    browserPosts: readFiniteNumber(raw.browserPosts),
    robotPolls: readFiniteNumber(raw.robotPolls),
    answersPosted: readFiniteNumber(raw.answersPosted),
    activeClientCount: readFiniteNumber(raw.activeClientCount),
    dialingClientCount: readFiniteNumber(raw.dialingClientCount),
    connectedClientCount: readFiniteNumber(raw.connectedClientCount),
    robotPollFreshMs: readFiniteNumber(raw.robotPollFreshMs, CONTROL_MONITOR_DEFAULT_LINK_STATUS.robotPollFreshMs),
    robotPollAgeMs: readNullableFiniteNumber(raw.robotPollAgeMs),
    signalPairFreshMs: readFiniteNumber(raw.signalPairFreshMs, CONTROL_MONITOR_DEFAULT_LINK_STATUS.signalPairFreshMs),
    signalPairAgeMs: readNullableFiniteNumber(raw.signalPairAgeMs),
    signalPaired: Boolean(raw.signalPaired),
    inferredDirectConnected: Boolean(raw.inferredDirectConnected),
    robotListenerClientId: String(raw.robotListenerClientId || ""),
    robotListenerFreshMs: readFiniteNumber(
      raw.robotListenerFreshMs,
      CONTROL_MONITOR_DEFAULT_LINK_STATUS.robotListenerFreshMs,
    ),
    robotListenerAgeMs: readNullableFiniteNumber(raw.robotListenerAgeMs),
    robotListenerLatencyMs: readNullableFiniteNumber(raw.robotListenerLatencyMs),
    robotListenerLatencySource: String(raw.robotListenerLatencySource || ""),
    robotListenerLatencyUpdatedAt: typeof raw.robotListenerLatencyUpdatedAt === "string" ? raw.robotListenerLatencyUpdatedAt : null,
    robotListenerConflictCount: readFiniteNumber(raw.robotListenerConflictCount),
    lastRobotListenerAt: typeof raw.lastRobotListenerAt === "string" ? raw.lastRobotListenerAt : null,
    lastBrowserOfferAt: typeof raw.lastBrowserOfferAt === "string" ? raw.lastBrowserOfferAt : null,
    lastRobotPollAt: typeof raw.lastRobotPollAt === "string" ? raw.lastRobotPollAt : null,
    lastAnswerAt: typeof raw.lastAnswerAt === "string" ? raw.lastAnswerAt : null,
    source: String(raw.source || ""),
  };
}

function firstRecordFromMap(value: unknown) {
  if (!isPlainRecord(value)) {
    return null;
  }
  return Object.values(value).find(isPlainRecord) ?? null;
}

function readBrokerLinkStatus(brokerStatus: unknown, sessionName: string): ControlMonitorLinkStatus | null {
  if (!isPlainRecord(brokerStatus)) {
    return null;
  }
  const linkStatuses = isPlainRecord(brokerStatus.linkStatuses) ? brokerStatus.linkStatuses : null;
  const linkStatus = linkStatuses?.[sessionName];
  if (linkStatus) {
    return coerceOverviewControlLinkStatus(linkStatus);
  }

  const sessions = isPlainRecord(brokerStatus.sessions) ? brokerStatus.sessions : null;
  const sessionState = isPlainRecord(sessions?.[sessionName]) ? sessions?.[sessionName] : null;
  if (!sessionState) {
    return null;
  }

  const robotListenerAgeMs = readNullableFiniteNumber(sessionState.robotListenerAgeMs);
  const robotListenerFreshMs = Math.max(0, readFiniteNumber(brokerStatus.robotListenerTtlSec, 10) * 1000);
  const backendListening =
    robotListenerAgeMs !== null && (!robotListenerFreshMs || robotListenerAgeMs <= robotListenerFreshMs);
  const pendingOffers = readFiniteNumber(sessionState.pendingOffers);

  return {
    ...CONTROL_MONITOR_DEFAULT_LINK_STATUS,
    frontendDialing: pendingOffers > 0,
    backendListening,
    directConnected: Boolean(sessionState.lastAnswerAt) && backendListening,
    pendingOffers,
    browserPosts: readFiniteNumber(sessionState.browserPosts),
    robotPolls: readFiniteNumber(sessionState.robotPolls),
    answersPosted: readFiniteNumber(sessionState.answersPosted),
    robotListenerFreshMs,
    robotListenerAgeMs,
    lastBrowserOfferAt: typeof sessionState.lastBrowserOfferAt === "string" ? sessionState.lastBrowserOfferAt : null,
    lastRobotPollAt: typeof sessionState.lastRobotPollAt === "string" ? sessionState.lastRobotPollAt : null,
    lastAnswerAt: typeof sessionState.lastAnswerAt === "string" ? sessionState.lastAnswerAt : null,
    source: "broker-status",
  };
}

function readOverviewControlLinkStatus(dashboardStatus: DashboardStatus): ControlMonitorLinkStatus {
  if (!dashboardStatus.connected || !isPlainRecord(dashboardStatus.broker_status)) {
    return CONTROL_MONITOR_DEFAULT_LINK_STATUS;
  }

  const brokerStatus = dashboardStatus.broker_status;
  const primaryLinkStatus =
    readBrokerLinkStatus(brokerStatus, CONTROL_MONITOR_DEFAULT_SESSION) ??
    (isPlainRecord(brokerStatus.linkStatuses) ? firstRecordFromMap(brokerStatus.linkStatuses) : null);
  if (primaryLinkStatus) {
    return "frontendDialing" in primaryLinkStatus
      ? primaryLinkStatus as ControlMonitorLinkStatus
      : coerceOverviewControlLinkStatus(primaryLinkStatus);
  }

  const sessions = isPlainRecord(brokerStatus.sessions) ? brokerStatus.sessions : null;
  const monitorSessions = isPlainRecord(brokerStatus.monitorSessions) ? brokerStatus.monitorSessions : null;
  const sessionState = isPlainRecord(sessions?.[CONTROL_MONITOR_DEFAULT_SESSION])
    ? sessions?.[CONTROL_MONITOR_DEFAULT_SESSION]
    : firstRecordFromMap(sessions);
  const monitorState = isPlainRecord(monitorSessions?.[CONTROL_MONITOR_DEFAULT_SESSION])
    ? monitorSessions?.[CONTROL_MONITOR_DEFAULT_SESSION]
    : firstRecordFromMap(monitorSessions);

  const pendingOffers = readFiniteNumber(sessionState?.userPendingOffers ?? sessionState?.pendingOffers);
  const activeClientCount = readFiniteNumber(monitorState?.activeClients);
  const robotListenerAgeMs = readNullableFiniteNumber(sessionState?.robotListenerAgeMs);
  const robotListenerFreshMs = Math.max(0, readFiniteNumber(brokerStatus.robotListenerTtlSec, 10) * 1000);
  const backendListening =
    robotListenerAgeMs !== null && (!robotListenerFreshMs || robotListenerAgeMs <= robotListenerFreshMs);

  return {
    ...CONTROL_MONITOR_DEFAULT_LINK_STATUS,
    frontendDialing: pendingOffers > 0 || activeClientCount > 0,
    backendListening,
    directConnected: activeClientCount > 0 && backendListening,
    pendingOffers,
    userPendingOffers: pendingOffers,
    activeClientCount,
    robotListenerFreshMs,
    robotListenerAgeMs,
    browserPosts: readFiniteNumber(sessionState?.browserPosts),
    robotPolls: readFiniteNumber(sessionState?.robotPolls),
    answersPosted: readFiniteNumber(sessionState?.answersPosted),
    lastBrowserOfferAt: typeof sessionState?.lastBrowserOfferAt === "string" ? sessionState.lastBrowserOfferAt : null,
    lastRobotPollAt: typeof sessionState?.lastRobotPollAt === "string" ? sessionState.lastRobotPollAt : null,
    lastAnswerAt: typeof sessionState?.lastAnswerAt === "string" ? sessionState.lastAnswerAt : null,
    source: "broker-status",
  };
}

function controlSignalHeadline(connected: boolean, linkStatus: ControlMonitorLinkStatus) {
  if (!connected) {
    return "未连接";
  }
  if (linkStatus.directConnected) {
    return "已接通";
  }
  if (linkStatus.frontendDialing && linkStatus.backendListening) {
    return "等待接通";
  }
  if (linkStatus.frontendDialing) {
    return "前端呼叫";
  }
  if (linkStatus.backendListening) {
    return "后端监听";
  }
  return "待机";
}

function controlSignalFrontendLabel(connected: boolean, linkStatus: ControlMonitorLinkStatus) {
  if (!connected) {
    return "未连接";
  }
  if (linkStatus.directConnected) {
    return "已接通";
  }
  if (linkStatus.frontendDialing) {
    return "呼叫中";
  }
  if (linkStatus.activeClientCount > 0) {
    return "已上线";
  }
  return "待机";
}

function controlSignalBackendLabel(connected: boolean, linkStatus: ControlMonitorLinkStatus) {
  if (!connected) {
    return "未连接";
  }
  return linkStatus.backendListening ? "监听中" : "未监听";
}

function controlSignalFrontendLamp(connected: boolean, linkStatus: ControlMonitorLinkStatus) {
  if (!connected) {
    return "off";
  }
  if (linkStatus.directConnected) {
    return "live";
  }
  return linkStatus.frontendDialing || linkStatus.activeClientCount > 0 ? "pending" : "off";
}

function controlSignalBackendLamp(connected: boolean, linkStatus: ControlMonitorLinkStatus) {
  if (!connected) {
    return "off";
  }
  if (linkStatus.directConnected) {
    return "live";
  }
  return linkStatus.backendListening ? "pending" : "off";
}

function formatControlSignalAge(ageMs: number | null | undefined) {
  if (typeof ageMs !== "number" || !Number.isFinite(ageMs)) {
    return "";
  }
  if (ageMs < 1000) {
    return `${Math.round(ageMs)} ms`;
  }
  return `${Math.round(ageMs / 1000)} 秒前`;
}

function controlSignalSummaryNote(
  connected: boolean,
  linkStatus: ControlMonitorLinkStatus,
  counterBaseline: ControlSignalCounterBaseline | null = null,
) {
  if (!connected) {
    return "连接服务器后显示控制信号状态";
  }

  const parts: string[] = [];
  if (linkStatus.activeClientCount > 0) {
    parts.push(`${linkStatus.activeClientCount} 个前端在线`);
  }

  if (counterBaseline) {
    parts.push(`前端请求 ${counterDelta(linkStatus.browserPosts, counterBaseline.browserPosts)} 次`);
    parts.push(`后端心跳 ${counterDelta(linkStatus.robotPolls, counterBaseline.robotPolls)} 次`);
    parts.push(`已应答 ${counterDelta(linkStatus.answersPosted, counterBaseline.answersPosted)} 次`);
    return parts.join(" · ");
  }

  const pendingOffers = linkStatus.userPendingOffers ?? linkStatus.pendingOffers;
  if (pendingOffers > 0) {
    parts.push(`${pendingOffers} 个前端请求`);
  }
  const backendAge = formatControlSignalAge(linkStatus.robotListenerAgeMs ?? linkStatus.robotPollAgeMs);
  if (backendAge) {
    parts.push(`后端心跳 ${backendAge}`);
  }
  if (linkStatus.answersPosted > 0) {
    parts.push(`已应答 ${linkStatus.answersPosted} 次`);
  }
  return parts.length > 0 ? parts.join(" · ") : "等待前端呼叫和后端监听";
}

export function DashboardPage({
  initialStatus,
  theme,
  updater,
  accessInfo,
  onlineCount,
  onAccessInfoChange,
  onToggleTheme,
  onInstallUpdate,
  onLogoutDone,
}: DashboardPageProps) {
  const canRunAdminActions = !accessInfo.webMode || accessInfo.admin;
  const [activeView, setActiveView] = useState<ConsoleView>("overview");
  const [status, setStatus] = useState<DashboardStatus>(initialStatus ?? emptyStatus);
  const [backendLogs, setBackendLogs] = useState<LogEntry[]>([]);
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
  const [portChecks, setPortChecks] = useState<PortStatus[]>(initialStatus?.port_checks ?? emptyStatus.port_checks);
  const [localStreamStatus, setLocalStreamStatus] = useState<LocalStreamStatus>(emptyLocalStreamStatus);
  const [localStreamConfig, setLocalStreamConfig] = useState<LocalStreamConfig>(defaultLocalStreamConfig);
  const [localStreamDraft, setLocalStreamDraft] = useState<LocalStreamDraftState>(() =>
    buildLocalStreamDraft(defaultLocalStreamConfig),
  );
  const [localStreamBusy, setLocalStreamBusy] = useState(false);
  const [localStreamSetupBusy, setLocalStreamSetupBusy] = useState(false);
  const [localStreamMessage, setLocalStreamMessage] = useState("");
  const [localStreamDirty, setLocalStreamDirty] = useState(false);
  const [browserCameraProbe, setBrowserCameraProbe] = useState<BrowserCameraProbeState>(
    accessInfo.webMode
      ? BROWSER_CAMERA_PROBE_INITIAL
      : { status: "unavailable", count: 0, label: "", note: "桌面端使用本地后端检测摄像头" },
  );
  const [tencentCloudPushOpen, setTencentCloudPushOpen] = useState(false);
  const [tencentCloudPushCodeDialogOpen, setTencentCloudPushCodeDialogOpen] = useState(false);
  const [tencentCloudPushCodeError, setTencentCloudPushCodeError] = useState("");
  const [tencentCloudPushUrl, setTencentCloudPushUrl] = useState(readSavedTencentCloudPushUrl);
  const [tencentCloudPushDraftUrl, setTencentCloudPushDraftUrl] = useState(readSavedTencentCloudPushUrl);
  const tencentCloudPushCodeRef = useRef<HTMLElement | null>(null);
  const tencentCloudPushCodeValueRef = useRef<HTMLDivElement | null>(null);
  const [tencentCloudPlayDialogOpen, setTencentCloudPlayDialogOpen] = useState(false);
  const [tencentCloudPlayOpen, setTencentCloudPlayOpen] = useState(false);
  const [tencentCloudPlayError, setTencentCloudPlayError] = useState("");
  const [tencentCloudPlayUrl, setTencentCloudPlayUrl] = useState(readSavedTencentCloudPlayUrl);
  const [tencentCloudPlayDraftUrl, setTencentCloudPlayDraftUrl] = useState(readSavedTencentCloudPlayUrl);
  const [tencentCloudPlayBusy, setTencentCloudPlayBusy] = useState(false);
  const [tencentCloudPlayMessage, setTencentCloudPlayMessage] = useState("等待输入腾讯云播放地址");
  const [tencentCloudPushSource, setTencentCloudPushSource] = useState<TencentCloudLiveSource>("camera");
  const [tencentCloudPushAudioEnabled, setTencentCloudPushAudioEnabled] = useState(true);
  const [tencentCloudPushBusy, setTencentCloudPushBusy] = useState(false);
  const [tencentCloudPushRunning, setTencentCloudPushRunning] = useState(false);
  const [tencentCloudPushMessage, setTencentCloudPushMessage] = useState("等待启动腾讯云推流");
  const [tencentCloudPlayerKey, setTencentCloudPlayerKey] = useState(0);
  const [p2pPushOpen, setP2pPushOpen] = useState(false);
  const [p2pV2PushOpen, setP2pV2PushOpen] = useState(false);
  const [p2pV2Active, setP2pV2Active] = useState(false);
  const [p2pPushBusy, setP2pPushBusy] = useState(false);
  const [p2pPushRunning, setP2pPushRunning] = useState(false);
  const [p2pPushMessage, setP2pPushMessage] = useState("等待启动 P2P 推流");
  const [p2pLocalPusherStatus, setP2pLocalPusherStatus] =
    useState<P2PLocalPusherStatus>(emptyP2pLocalPusherStatus);
  const [p2pRoomDraft, setP2pRoomDraft] = useState(readSavedP2pLink);
  const [p2pViewDialogOpen, setP2pViewDialogOpen] = useState(false);
  const [p2pV2ViewDialogOpen, setP2pV2ViewDialogOpen] = useState(false);
  const [p2pV2RoomDraft, setP2pV2RoomDraft] = useState(P2P_DEFAULT_ROOM_ID);
  const [p2pV2ViewError, setP2pV2ViewError] = useState("");
  const [p2pV2ViewLoading, setP2pV2ViewLoading] = useState(false);
  const [p2pV2Rooms, setP2pV2Rooms] = useState<P2pV2Room[]>([]);
  const [p2pV2Endpoints, setP2pV2Endpoints] = useState<P2pV2Endpoint[]>([]);
  const [p2pV2EndpointSummary, setP2pV2EndpointSummary] = useState("正在获取在线房间");
  const [p2pViewError, setP2pViewError] = useState("");
  const [p2pViewLoading, setP2pViewLoading] = useState(false);
  const [p2pViewRooms, setP2pViewRooms] = useState<P2pActiveRoom[]>([]);
  const [p2pViewEndpoint, setP2pViewEndpoint] = useState<P2pEndpoint>(readSavedP2pEndpoint);
  const [p2pViewerCount, setP2pViewerCount] = useState(0);
  const [p2pSignalState, setP2pSignalState] = useState<"idle" | "pending" | "live" | "off">("idle");
  const [loading, setLoading] = useState(!initialStatus);
  const [busy, setBusy] = useState(false);
  const [sidebarRefreshBusy, setSidebarRefreshBusy] = useState(false);
  const [portBusyKey, setPortBusyKey] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(DEFAULT_VIDEO_ASPECT_RATIO);
  const [videoStatus, setVideoStatus] = useState("云端视频待机");
  const [videoTransport, setVideoTransport] = useState<"idle" | "connecting" | "webrtc" | "mp4" | "error">("idle");
  const [cloudVideoTargets, setCloudVideoTargets] = useState<CloudP2pVideoTarget[]>([]);
  const [cloudVideoTargetValue, setCloudVideoTargetValue] = useState("");
  const [cloudVideoCatalogStatus, setCloudVideoCatalogStatus] = useState("正在获取 P2P V2 在线推流");
  const [videoPushStatus, setVideoPushStatus] = useState<VideoPushStatus | null>(null);
  const [videoPushStatusUpdatedAt, setVideoPushStatusUpdatedAt] = useState("");
  const [p2pRoomSummary, setP2pRoomSummary] = useState<P2pRoomSummary>(emptyP2pRoomSummary);
  const [p2pV2RoomSummary, setP2pV2RoomSummary] = useState<P2pV2RoomSummary>(emptyP2pV2RoomSummary);
  const [trafficSnapshot, setTrafficSnapshot] = useState<TrafficMonitorSnapshot>(emptyTrafficMonitorSnapshot);
  const [trafficHistory, setTrafficHistory] = useState<TrafficChartPoint[]>([]);
  const [trafficMonitorError, setTrafficMonitorError] = useState("");
  const [controlMonitorEnabled, setControlMonitorEnabled] = useState(false);
  const [controlMonitorStatus, setControlMonitorStatus] = useState("本地控制监视待机");
  const [controlMonitorPeerState, setControlMonitorPeerState] = useState("idle");
  const [controlMonitorConnected, setControlMonitorConnected] = useState(false);
  const [controlMonitorPressedKeys, setControlMonitorPressedKeys] = useState<string[]>([]);
  const [controlMonitorClients, setControlMonitorClients] = useState<ControlMonitorColoredClient[]>([]);
  const [controlMonitorSession, setControlMonitorSession] = useState(CONTROL_MONITOR_DEFAULT_SESSION);
  const [controlMonitorLinkStatus, setControlMonitorLinkStatus] = useState<ControlMonitorLinkStatus>(
    CONTROL_MONITOR_DEFAULT_LINK_STATUS,
  );
  const [controlMonitorCommandLinkStatus, setControlMonitorCommandLinkStatus] = useState<ControlMonitorLinkStatus>(
    CONTROL_MONITOR_DEFAULT_LINK_STATUS,
  );
  const [controlSignalCounterBaseline, setControlSignalCounterBaseline] =
    useState<ControlSignalCounterBaseline | null>(null);
  const [controlMonitorVisibleColumns, setControlMonitorVisibleColumns] = useState(CONTROL_MONITOR_MIN_VISIBLE_COLUMNS);
  const [controlMonitorKeyboardTrackWidth, setControlMonitorKeyboardTrackWidth] = useState<number | null>(null);
  const [controlMonitorKeyboardKeySize, setControlMonitorKeyboardKeySize] = useState(CONTROL_MONITOR_DEFAULT_KEY_SIZE_PX);
  const [controlMonitorKeyboardKeyGap, setControlMonitorKeyboardKeyGap] = useState(CONTROL_MONITOR_DEFAULT_KEY_GAP_PX);
  const [controlMonitorMessageCount, setControlMonitorMessageCount] = useState(0);
  const [controlMonitorLastEventAt, setControlMonitorLastEventAt] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupTone, setSetupTone] = useState<"idle" | "progress" | "success" | "error">("idle");
  const [setupPasswordDialogOpen, setSetupPasswordDialogOpen] = useState(false);
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordError, setSetupPasswordError] = useState("");
  const [error, setError] = useState("");
  const setupProgressTimerRef = useRef<number | null>(null);
  const setupMessageTimerRef = useRef<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewPeerRef = useRef<RTCPeerConnection | null>(null);
  const previewSocketRef = useRef<WebSocket | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const cloudVideoPollAbortRef = useRef<AbortController | null>(null);
  const controlMonitorKeyboardRef = useRef<HTMLDivElement | null>(null);
  const controlMonitorColorAssignmentsRef = useRef<Map<string, ControlMonitorColorId>>(new Map());
  const localStreamEditSeqRef = useRef(0);
  const tencentCloudPusherRef = useRef<TencentCloudPusher | null>(null);
  const tencentCloudPushSdkPromiseRef = useRef<Promise<void> | null>(null);
  const tencentCloudPlayerRef = useRef<TencentCloudPlayer | null>(null);
  const tencentCloudPlayerSdkPromiseRef = useRef<Promise<void> | null>(null);
  const tencentCloudStatusHeartbeatRef = useRef<number | null>(null);
  const tencentCloudActivePushUrlRef = useRef("");
  const tencentCloudActivePlayUrlRef = useRef("");
  const tencentCloudActiveVideoConfigRef = useRef<TencentCloudVideoConfig | null>(null);
  const tencentCloudPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const tencentCloudPreviewStreamRef = useRef<MediaStream | null>(null);
  const tencentCloudPreviewStreamIdRef = useRef("");
  const p2pPeerIdRef = useRef(makeP2pPeerId("console-push"));
  const p2pEndpointIdRef = useRef(`console-video-${makeP2pPeerId("endpoint").slice(-12)}`);
  const p2pV2ModeRef = useRef(false);
  const p2pSignalConfigRef = useRef<P2pSignalConfig>({ iceServers: [] });
  const p2pSignalBaseUrlRef = useRef(readSavedP2pEndpoint().signalBaseUrl);
  const p2pRoomIdRef = useRef(readSavedP2pEndpoint().roomId);
  const p2pSinceRef = useRef(0);
  const p2pPollAbortRef = useRef<AbortController | null>(null);
  const p2pHeartbeatRef = useRef<number | null>(null);
  const p2pRawStreamRef = useRef<MediaStream | null>(null);
  const p2pSendStreamRef = useRef<MediaStream | null>(null);
  const p2pDrawTimerRef = useRef<number | null>(null);
  const p2pConnectionsRef = useRef<Map<string, P2pViewerConnection>>(new Map());
  const p2pPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    function clearPushCodeSelectionOnOutsidePointerDown(event: MouseEvent) {
      const codeNode = tencentCloudPushCodeRef.current;
      const codeValueNode = tencentCloudPushCodeValueRef.current;
      if (!codeNode || !codeValueNode || codeValueNode.contains(event.target as Node)) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const anchorInCode = selection.anchorNode ? codeNode.contains(selection.anchorNode) : false;
      const focusInCode = selection.focusNode ? codeNode.contains(selection.focusNode) : false;
      if (anchorInCode || focusInCode) {
        selection.removeAllRanges();
      }
    }

    document.addEventListener("mousedown", clearPushCodeSelectionOnOutsidePointerDown);
    return () => {
      document.removeEventListener("mousedown", clearPushCodeSelectionOnOutsidePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!accessInfo.webMode) {
      return;
    }

    let alive = true;

    async function detectBrowserCamera() {
      if (!window.isSecureContext) {
        if (alive) {
          setBrowserCameraProbe({
            status: "blocked",
            count: 0,
            label: "",
            note: "当前网页不是 HTTPS，浏览器不会开放摄像头权限",
          });
        }
        return;
      }

      if (!navigator.mediaDevices?.enumerateDevices) {
        if (alive) {
          setBrowserCameraProbe({
            status: "blocked",
            count: 0,
            label: "",
            note: "当前浏览器不支持摄像头设备检测",
          });
        }
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!alive) {
          return;
        }
        const cameras = dedupeBrowserCameras(devices);
        const firstLabel = cameras.find((device) => device.label)?.label || "";
        setBrowserCameraProbe({
          status: cameras.length > 0 ? "available" : "unavailable",
          count: cameras.length,
          label: firstLabel,
          note: cameras.length > 0
            ? firstLabel || "检测到浏览器摄像头，授权后可用于腾讯云推流"
            : "未检测到浏览器摄像头",
        });
      } catch (err) {
        if (!alive) {
          return;
        }
        const message = err instanceof Error ? err.message : "浏览器摄像头检测失败";
        setBrowserCameraProbe({
          status: "blocked",
          count: 0,
          label: "",
          note: message,
        });
      }
    }

    void detectBrowserCamera();
    navigator.mediaDevices?.addEventListener?.("devicechange", detectBrowserCamera);

    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", detectBrowserCamera);
    };
  }, [accessInfo.webMode]);

  function appendDebugLog(message: string, level: UiLogLevel = "info") {
    const nextEntry = buildUiLogEntry(message, level);
    setDebugLogs((current) => [...current.slice(-(DEBUG_LOG_LIMIT - 1)), nextEntry]);
  }

  function clearPreviewTimeout() {
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }

  function stopPreviewTransport() {
    if (previewSocketRef.current) {
      try {
        previewSocketRef.current.close();
      } catch {
      } finally {
        previewSocketRef.current = null;
      }
    }

    if (previewPeerRef.current) {
      try {
        previewPeerRef.current.close();
      } catch {
      } finally {
        previewPeerRef.current = null;
      }
    }
  }

  function resetPreviewSurface() {
    const videoElement = previewVideoRef.current;
    if (!videoElement) {
      return;
    }

    const currentStream = videoElement.srcObject;
    if (currentStream instanceof MediaStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }

    try {
      videoElement.pause();
    } catch {
    } finally {
      videoElement.srcObject = null;
      videoElement.removeAttribute("src");
      videoElement.load();
    }
  }

  function resetControlMonitorSurface(statusText = "本地控制监视待机") {
    setControlMonitorConnected(false);
    setControlMonitorPeerState("idle");
    setControlMonitorPressedKeys([]);
    setControlMonitorClients([]);
    setControlMonitorLinkStatus(CONTROL_MONITOR_DEFAULT_LINK_STATUS);
    setControlMonitorCommandLinkStatus(CONTROL_MONITOR_DEFAULT_LINK_STATUS);
    controlMonitorColorAssignmentsRef.current.clear();
    setControlMonitorMessageCount(0);
    setControlMonitorLastEventAt("");
    setControlMonitorStatus(statusText);
  }

  function assignControlMonitorClientColors(clients: ControlMonitorKeyClientState[]) {
    const activeIds = new Set(clients.map((client) => client.clientId));
    const assignments = controlMonitorColorAssignmentsRef.current;

    for (const clientId of Array.from(assignments.keys())) {
      if (!activeIds.has(clientId)) {
        assignments.delete(clientId);
      }
    }

    for (const client of clients) {
      if (assignments.has(client.clientId)) {
        continue;
      }

      const usedColorIds = new Set(assignments.values());
      const nextColor =
        CONTROL_MONITOR_CLIENT_COLORS.find((color) => !usedColorIds.has(color.id)) ??
        CONTROL_MONITOR_CLIENT_COLORS[assignments.size % CONTROL_MONITOR_CLIENT_COLORS.length];
      assignments.set(client.clientId, nextColor.id);
    }

    return clients.map((client) => {
      const color = getControlMonitorColor(assignments.get(client.clientId) ?? CONTROL_MONITOR_CLIENT_COLORS[0].id);
      return {
        ...client,
        colorId: color.id,
        colorLabel: color.label,
        colorStart: color.start,
        colorEnd: color.end,
        colorGlow: color.glow,
      };
    });
  }

  async function syncDashboardStatusSnapshot(kind: "status" | "refresh" = "status") {
    const [nextStatus, nextLogs] = await Promise.all([
      kind === "refresh" ? refreshStatus() : getStatus(),
      getLogs(),
    ]);
    setStatus(nextStatus);
    setBackendLogs(nextLogs.logs);
    setPortChecks((current) => {
      if (!nextStatus.connected || current.length === 0) {
        return nextStatus.port_checks;
      }
      return current;
    });
    if (nextStatus.connected && !accessInfo.webMode) {
      try {
        const [nextLocalStreamStatus, nextP2pLocalPusherStatus] = await Promise.all([
          getLocalStreamStatus(),
          getP2pLocalPusherStatus(),
        ]);
        setLocalStreamStatus(nextLocalStreamStatus);
        setLocalStreamConfig(nextLocalStreamStatus.config);
        setLocalStreamDirty(false);
        setP2pLocalPusherStatus(nextP2pLocalPusherStatus);
        setP2pPushRunning(nextP2pLocalPusherStatus.running);
        setP2pSignalState(nextP2pLocalPusherStatus.running ? "live" : "idle");
      } catch {
        setLocalStreamStatus(emptyLocalStreamStatus);
        setLocalStreamConfig(defaultLocalStreamConfig);
        setLocalStreamDirty(false);
        setP2pLocalPusherStatus(emptyP2pLocalPusherStatus);
      }
    }
    return nextStatus;
  }

  async function loadAll(kind: "status" | "refresh" = "status") {
    setError("");
    let succeeded = true;
    if (kind === "refresh") {
      setBusy(true);
    } else {
      setLoading(true);
    }

    try {
      await syncDashboardStatusSnapshot(kind);
    } catch (err) {
      succeeded = false;
      setError(err instanceof Error ? err.message : "加载状态失败");
    } finally {
      setLoading(false);
      setBusy(false);
    }

    return succeeded;
  }

  async function handleRefreshControlSignalSummary() {
    setError("");
    try {
      const nextStatus = await syncDashboardStatusSnapshot("refresh");
      setControlSignalCounterBaseline(buildControlSignalCounterBaseline(readOverviewControlLinkStatus(nextStatus)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "控制信号状态刷新失败");
    }
  }

  function applyTrafficSnapshot(nextSnapshot: TrafficMonitorSnapshot) {
    setTrafficSnapshot(nextSnapshot);
    setTrafficMonitorError(nextSnapshot.error || "");
    if (!nextSnapshot.connected) {
      setTrafficHistory([]);
      return;
    }

    const nextPoint = {
      timestampMs: nextSnapshot.timestamp_ms || Date.now(),
      rxBps: Math.max(0, Number(nextSnapshot.rx_bps) || 0),
      txBps: Math.max(0, Number(nextSnapshot.tx_bps) || 0),
    };
    setTrafficHistory((current) => {
      const previousPoint = current[current.length - 1];
      const shouldStartFresh =
        !previousPoint ||
        nextPoint.timestampMs < previousPoint.timestampMs ||
        nextPoint.timestampMs - previousPoint.timestampMs > TRAFFIC_MONITOR_STALE_GAP_MS;
      const nextHistory = shouldStartFresh ? [nextPoint] : [...current, nextPoint];
      const cutoffMs = nextPoint.timestampMs - TRAFFIC_MONITOR_WINDOW_MS - TRAFFIC_MONITOR_POLL_INTERVAL_MS;
      return nextHistory.filter((point) => point.timestampMs >= cutoffMs).slice(-TRAFFIC_MONITOR_HISTORY_LIMIT);
    });
  }

  async function refreshTrafficMonitor() {
    try {
      const nextSnapshot = await getTrafficMonitorSnapshot();
      applyTrafficSnapshot(nextSnapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : "流量监控读取失败";
      setTrafficMonitorError(message);
      setTrafficSnapshot({
        ...emptyTrafficMonitorSnapshot,
        connected: status.connected,
        timestamp: formatUiLogTimestamp(),
        timestamp_ms: Date.now(),
        congestion_note: message,
        error: message,
      });
    }
  }

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
      setPortChecks(initialStatus.port_checks);
      setLoading(false);
      getLogs()
        .then((nextLogs) => setBackendLogs(nextLogs.logs))
        .catch(() => undefined);
      return;
    }
    loadAll("status");
  }, [initialStatus]);

  useEffect(() => {
    let alive = true;
    let polling = false;

    async function tick() {
      if (!isPageVisible() || polling) {
        return;
      }
      polling = true;
      try {
        const nextStatus = await getLiveStatus();
        if (!alive) {
          return;
        }
        setStatus(nextStatus);
        if (!nextStatus.connected) {
          setPortChecks(nextStatus.port_checks);
        }

        if (activeView === "activity") {
          const nextLogs = await getLogs();
          if (!alive) {
            return;
          }
          setBackendLogs(nextLogs.logs);
        }
      } catch {
        return;
      } finally {
        polling = false;
      }
    }

    const timerId = window.setInterval(tick, POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        void tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeView]);

  useEffect(() => {
    let alive = true;
    let polling = false;

    async function tick() {
      if (!isPageVisible() || polling) {
        return;
      }
      polling = true;
      try {
        const nextSnapshot = await getTrafficMonitorSnapshot();
        if (alive) {
          applyTrafficSnapshot(nextSnapshot);
        }
      } catch (err) {
        if (alive) {
          setTrafficMonitorError(err instanceof Error ? err.message : "流量监控读取失败");
        }
      } finally {
        polling = false;
      }
    }

    void tick();
    const timerId = window.setInterval(tick, TRAFFIC_MONITOR_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        setTrafficHistory([]);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status.connected]);

  useEffect(() => {
    // The service panel now uses the P2P V2 viewer below. Keep this dormant
    // legacy preview path temporarily so unrelated local-stream code stays untouched.
    const legacyPreviewDisabled = true;
    if (legacyPreviewDisabled) {
      return undefined;
    }
    const shouldPreview = videoEnabled && status.connected && activeView === "services";
    const videoElement = previewVideoRef.current;

    let disposed = false;
    let fallbackStarted = false;
    let remoteTrackSeen = false;

    const clearVideoListeners = () => {
      if (!videoElement) {
        return;
      }
      videoElement.onplaying = null;
      videoElement.onloadedmetadata = null;
      videoElement.onresize = null;
      videoElement.onstalled = null;
      videoElement.onwaiting = null;
      videoElement.onerror = null;
    };

    const playVideo = async () => {
      if (!videoElement) {
        return;
      }
      try {
        await videoElement.play();
      } catch {
      }
    };

    if (!shouldPreview || !videoElement) {
      clearPreviewTimeout();
      stopPreviewTransport();
      clearVideoListeners();
      resetPreviewSurface();
      setVideoAspectRatio(DEFAULT_VIDEO_ASPECT_RATIO);
      setVideoTransport("idle");
      setVideoStatus("云端视频待机");
      return () => undefined;
    }

    clearPreviewTimeout();
    stopPreviewTransport();
    clearVideoListeners();
    resetPreviewSurface();

    let mp4PreviewUrl = "";

    const updatePreviewAspectRatio = () => {
      const nextWidth = videoElement.videoWidth;
      const nextHeight = videoElement.videoHeight;
      if (!nextWidth || !nextHeight) {
        return;
      }
      const nextRatio = nextWidth / nextHeight;
      if (Number.isFinite(nextRatio) && nextRatio > 0) {
        setVideoAspectRatio(nextRatio);
      }
    };

    videoElement.muted = true;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.controls = false;
    videoElement.onloadedmetadata = updatePreviewAspectRatio;
    videoElement.onresize = updatePreviewAspectRatio;
    /*
    videoElement.onplaying = () => {
      if (!disposed) {
        setVideoTransport("mp4");
        setVideoStatus("正在播放云端 MP4 预览");
      }
    };
    videoElement.onwaiting = () => {
      if (!disposed) {
        setVideoStatus("正在等待云端 MP4 画面");
      }
    };
    videoElement.onstalled = () => {
      if (!disposed) {
        setVideoStatus("云端 MP4 预览缓冲中");
      }
    };
    videoElement.onerror = () => {
      if (!disposed) {
        setVideoTransport("error");
        setVideoStatus("云端 MP4 预览失败");
      }
    };

    if (!mp4PreviewUrl) {
      setVideoTransport("error");
      setVideoStatus("云端 MP4 地址无效");
      return () => {
        disposed = true;
        clearPreviewTimeout();
        clearVideoListeners();
        stopPreviewTransport();
        resetPreviewSurface();
      };
    }

    try {
      videoElement.srcObject = null;
      videoElement.src = mp4PreviewUrl;
      videoElement.load();
      setVideoTransport("connecting");
      setVideoStatus("正在加载云端 MP4 预览");
      void playVideo();
    } catch {
      setVideoTransport("error");
      setVideoStatus("云端 MP4 预览初始化失败");
    }

    return () => {
      disposed = true;
      clearPreviewTimeout();
      clearVideoListeners();
      stopPreviewTransport();
      resetPreviewSurface();
    };
    */

    videoElement.onplaying = () => {
      if (!disposed) {
        updatePreviewAspectRatio();
        setVideoTransport("mp4");
        setVideoStatus("正在播放本地代理 MP4 预览");
      }
    };
    videoElement.onwaiting = () => {
      if (!disposed) {
        setVideoStatus("正在等待本地代理 MP4 画面");
      }
    };
    videoElement.onstalled = () => {
      if (!disposed) {
        setVideoStatus("本地代理 MP4 预览缓冲中");
      }
    };
    videoElement.onerror = () => {
      if (!disposed) {
        setVideoTransport("error");
        setVideoStatus("本地代理 MP4 预览失败");
      }
    };

    void (async () => {
      try {
        mp4PreviewUrl = await getVideoPreviewUrl();
      } catch {
        if (!disposed) {
          setVideoTransport("error");
          setVideoStatus("本地视频代理地址获取失败");
        }
        return;
      }

      if (!mp4PreviewUrl || disposed) {
        if (!disposed) {
          setVideoTransport("error");
          setVideoStatus("本地视频代理地址无效");
        }
        return;
      }

      try {
        videoElement.srcObject = null;
        videoElement.src = `${mp4PreviewUrl}?t=${Date.now()}`;
        videoElement.load();
        setVideoTransport("connecting");
        setVideoStatus("正在加载本地代理 MP4 预览");
        void playVideo();
      } catch {
        if (!disposed) {
          setVideoTransport("error");
          setVideoStatus("本地代理 MP4 预览初始化失败");
        }
      }
    })();

    return () => {
      disposed = true;
      clearPreviewTimeout();
      clearVideoListeners();
      stopPreviewTransport();
      resetPreviewSurface();
    };

    /* Legacy WebRTC preview path temporarily disabled while stabilizing the
       embedded preview in Tauri. Keep the old implementation here for later
       recovery, but do not execute or type-check against it for the current build.
    const fallbackToMp4 = async (reason: string) => {
      if (disposed || fallbackStarted) {
        return;
      }
      fallbackStarted = true;
      clearPreviewTimeout();
      stopPreviewTransport();

      if (!videoElement) {
        setVideoTransport("error");
        setVideoStatus(`视频预览失败：${reason}`);
        return;
      }

      const mp4Url = buildStreamMp4Url(status.public_base_url);
      if (!mp4Url) {
        setVideoTransport("error");
        setVideoStatus(`视频预览失败：${reason}`);
        return;
      }

      videoElement.srcObject = null;
      videoElement.src = mp4Url;
      videoElement.load();

      setVideoTransport("mp4");
      setVideoStatus("WebRTC 不可用，已切换为 MP4 预览");
      await playVideo();
    };

    if (!shouldPreview || !videoElement) {
      clearPreviewTimeout();
      stopPreviewTransport();
      clearVideoListeners();
      resetPreviewSurface();
      setVideoTransport("idle");
      setVideoStatus("云端视频待机");
      return () => undefined;
    }

    const signalingUrl = buildStreamSignalUrl(status.public_base_url);
    if (!signalingUrl) {
      setVideoTransport("error");
      setVideoStatus("云端视频地址无效");
      return () => undefined;
    }

    clearPreviewTimeout();
    stopPreviewTransport();
    clearVideoListeners();
    resetPreviewSurface();

    videoElement.muted = true;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.controls = false;

    videoElement.onplaying = () => {
      if (disposed) {
        return;
      }
      setVideoTransport((current) => (current === "mp4" ? "mp4" : "webrtc"));
      setVideoStatus((current) =>
        current === "WebRTC 不可用，已切换为 MP4 预览"
          ? "正在播放云端 MP4 预览"
          : "正在播放云端 WebRTC 预览"
      );
    };
    videoElement.onstalled = () => {
      if (!disposed) {
        setVideoStatus("云端视频缓冲中");
      }
    };
    videoElement.onwaiting = () => {
      if (!disposed) {
        setVideoStatus("正在等待云端画面");
      }
    };
    videoElement.onerror = () => {
      if (disposed) {
        return;
      }
      if (videoElement.currentSrc.includes("/api/stream.mp4")) {
        setVideoTransport("error");
        setVideoStatus("云端 MP4 预览失败");
      } else {
        void fallbackToMp4("video element error");
      }
    };

    const peer = new RTCPeerConnection({ iceServers: [] });
    previewPeerRef.current = peer;
    const remoteStream = new MediaStream();
    videoElement.srcObject = remoteStream;

    peer.addTransceiver("video", { direction: "recvonly" });

    for (const receiver of peer.getReceivers()) {
      if (!receiver || receiver.track.kind !== "video") {
        continue;
      }
      if ("playoutDelayHint" in receiver) {
        receiver.playoutDelayHint = 0;
      }
      if ("jitterBufferTarget" in receiver) {
        try {
          receiver.jitterBufferTarget = 60;
        } catch {
        }
      }
    }

    peer.ontrack = (event) => {
      remoteTrackSeen = true;
      if (event.streams && event.streams[0]) {
        videoElement.srcObject = event.streams[0];
      } else {
        remoteStream.addTrack(event.track);
        videoElement.srcObject = remoteStream;
      }
      setVideoStatus("云端 WebRTC 已连接，等待首帧");
      void playVideo();
    };

    peer.onconnectionstatechange = () => {
      if (disposed) {
        return;
      }
      const connectionState = peer.connectionState;
      if (connectionState === "connected") {
        setVideoTransport("connecting");
        setVideoStatus("云端 WebRTC 已连接，等待首帧");
        return;
      }
      if (connectionState === "failed" || connectionState === "disconnected") {
        void fallbackToMp4(`webrtc ${connectionState}`);
      }
    };

    const socket = new WebSocket(signalingUrl);
    previewSocketRef.current = socket;
    setVideoTransport("connecting");
    setVideoStatus("正在连接云端 WebRTC");

    socket.onopen = async () => {
      peer.onicecandidate = (event) => {
        if (!event.candidate || socket.readyState !== WebSocket.OPEN) {
          return;
        }
        socket.send(JSON.stringify({ type: "webrtc/candidate", value: event.candidate.candidate }));
      };

      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: "webrtc/offer", value: peer.localDescription?.sdp || "" }));
      } catch {
        void fallbackToMp4("offer failed");
      }
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(String(event.data || "{}"));
        if (message.type === "webrtc/answer" && typeof message.value === "string") {
          await peer.setRemoteDescription({ type: "answer", sdp: message.value });
          void playVideo();
          return;
        }
        if (message.type === "webrtc/candidate" && typeof message.value === "string") {
          await peer.addIceCandidate({ candidate: message.value, sdpMid: "0" });
        }
      } catch {
      }
    };

    socket.onerror = () => {
      if (!disposed && !remoteTrackSeen) {
        void fallbackToMp4("websocket error");
      }
    };

    socket.onclose = () => {
      if (!disposed && !remoteTrackSeen) {
        void fallbackToMp4("websocket closed");
      }
    };

    previewTimeoutRef.current = window.setTimeout(() => {
      if (!disposed && !remoteTrackSeen) {
        void fallbackToMp4("connect timeout");
      }
    }, STREAM_CONNECT_TIMEOUT_MS);

    return () => {
      disposed = true;
      clearPreviewTimeout();
      clearVideoListeners();
      stopPreviewTransport();
      resetPreviewSurface();
    };
    */
  }, [activeView, status.connected, status.public_base_url, videoEnabled]);

  useEffect(() => {
    if (activeView !== "services") {
      return undefined;
    }

    let disposed = false;
    let refreshing = false;
    const signalBaseUrl = p2pViewEndpoint.signalBaseUrl || P2P_SIGNAL_BASE_URL;

    const refreshTargets = async () => {
      if (disposed || refreshing || !isPageVisible()) {
        return;
      }
      refreshing = true;
      try {
        const rooms = (await fetchP2pV2ActiveRooms(signalBaseUrl)).filter(
          (room) => Number(room.videoPusherCount || room.roleCounts?.["video-pusher"] || 0) > 0,
        );
        const roomEndpoints = await Promise.all(
          rooms.map(async (room) => ({
            room: room.room,
            endpoints: await fetchP2pV2Endpoints(room.room, {
              signalBaseUrl,
              roomId: room.room,
              watchUrl: buildP2pV2WatchPageUrl(room.room, "", signalBaseUrl),
            }).catch(() => []),
          })),
        );
        const targets = roomEndpoints.flatMap(({ room, endpoints }) =>
          endpoints
            .filter((endpoint) => endpoint.role === "video-pusher" && String(endpoint.endpointId || "").trim())
            .map((endpoint) => ({
              value: `${encodeURIComponent(room)}::${encodeURIComponent(endpoint.endpointId)}`,
              signalBaseUrl,
              roomId: room,
              endpointId: endpoint.endpointId,
              peerId: String(endpoint.peerId || ""),
              displayName: String(endpoint.displayName || endpoint.endpointId),
            })),
        );
        if (disposed) {
          return;
        }
        setCloudVideoTargets(targets);
        setCloudVideoCatalogStatus(
          targets.length > 0
            ? `当前有 ${targets.length} 个 P2P V2 视频推流端可观看`
            : "当前没有正在推流的 P2P V2 房间",
        );
        setCloudVideoTargetValue((current) =>
          !current || targets.some((target) => target.value === current) ? current : "",
        );
      } catch (err) {
        if (!disposed) {
          const message = err instanceof Error ? err.message : "在线推流读取失败";
          setCloudVideoCatalogStatus(`P2P V2 在线推流读取失败：${message}`);
        }
      } finally {
        refreshing = false;
      }
    };

    setCloudVideoTargets([]);
    setCloudVideoTargetValue("");
    setCloudVideoCatalogStatus("正在获取 P2P V2 在线推流");
    void refreshTargets();
    const timerId = window.setInterval(refreshTargets, VIDEO_PUSH_STATUS_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        void refreshTargets();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeView, p2pViewEndpoint.signalBaseUrl]);

  useEffect(() => {
    const target = cloudVideoTargets.find((item) => item.value === cloudVideoTargetValue);
    const videoElement = previewVideoRef.current;

    const clearVideoSurface = () => {
      if (!videoElement) {
        return;
      }
      videoElement.onloadedmetadata = null;
      videoElement.onresize = null;
      videoElement.onplaying = null;
      videoElement.onwaiting = null;
      videoElement.onstalled = null;
      const currentStream = videoElement.srcObject;
      if (currentStream instanceof MediaStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      try {
        videoElement.pause();
      } catch {
      }
      videoElement.srcObject = null;
      videoElement.removeAttribute("src");
    };

    cloudVideoPollAbortRef.current?.abort();
    cloudVideoPollAbortRef.current = null;
    previewPeerRef.current?.close();
    previewPeerRef.current = null;
    clearVideoSurface();

    if (activeView !== "services" || !target || !videoElement) {
      setVideoAspectRatio(DEFAULT_VIDEO_ASPECT_RATIO);
      setVideoTransport("idle");
      setVideoStatus(activeView === "services" ? "请选择 P2P V2 在线推流" : "云端视频待机");
      return undefined;
    }

    let disposed = false;
    let since = 0;
    let currentPeer: RTCPeerConnection | null = null;
    let remotePeerId = target.peerId;
    let remoteEndpointId = target.endpointId;
    let pendingCandidates: RTCIceCandidateInit[] = [];
    let registered = false;
    let reconnecting = false;
    let lastReconnectAt = 0;
    let lastVideoTime = 0;
    let lastVideoProgressAt = Date.now();
    const peerId = makeP2pPeerId("console-view");
    const endpointId = `console-viewer-${makeP2pPeerId("endpoint").slice(-12)}`;
    const connectionId = makeP2pPeerId("connection");
    const abortController = new AbortController();
    cloudVideoPollAbortRef.current = abortController;

    const apiUrl = (path: string) => new URL(path, target.signalBaseUrl || P2P_SIGNAL_BASE_URL);
    const endpointUrl = apiUrl(
      `/api/v2/rooms/${encodeURIComponent(target.roomId)}/endpoints/${encodeURIComponent(endpointId)}`,
    );

    const sendSignal = async (message: P2pSignalMessage) => {
      const response = await fetch(apiUrl(`/api/v2/rooms/${encodeURIComponent(target.roomId)}/message`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...message,
          fromEndpointId: endpointId,
          fromPeerId: peerId,
          toEndpointId: message.toEndpointId || remoteEndpointId || target.endpointId,
          toPeerId: message.toPeerId || message.to || remotePeerId,
          connectionId,
        }),
      });
      if (!response.ok) {
        throw new Error(`信令发送失败：HTTP ${response.status}`);
      }
    };

    const registerEndpoint = async () => {
      const response = await fetch(apiUrl(`/api/v2/rooms/${encodeURIComponent(target.roomId)}/endpoints`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId,
          peerId,
          role: "viewer",
          displayName: "控制台云端视频窗口",
          status: "waiting",
          capabilities: { protocol: "webrtc", media: "video" },
          metadata: { targetEndpointId: target.endpointId, source: "cloud-service-console" },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `观看端注册失败：HTTP ${response.status}`);
      }
      registered = true;
    };

    const heartbeatEndpoint = async () => {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "heartbeat",
          peerId,
          status: currentPeer?.connectionState === "connected" ? "connected" : "waiting",
        }),
      });
      if (response.status === 404) {
        await registerEndpoint();
      }
    };

    const closePeer = () => {
      if (currentPeer) {
        currentPeer.close();
      }
      if (previewPeerRef.current === currentPeer) {
        previewPeerRef.current = null;
      }
      currentPeer = null;
      pendingCandidates = [];
    };

    const sendViewerReady = async () => {
      if (disposed || !registered) {
        return;
      }
      if (currentPeer && !["failed", "closed", "disconnected"].includes(currentPeer.connectionState)) {
        return;
      }
      await sendSignal({
        kind: "viewer-ready",
        toRole: "pusher",
        toEndpointId: target.endpointId,
        connectionId,
        payload: { at: Date.now() },
      });
    };

    const reconnectViewer = async (reason: string) => {
      if (disposed || reconnecting || Date.now() - lastReconnectAt < 2000) {
        return;
      }
      reconnecting = true;
      lastReconnectAt = Date.now();
      const previousPeerId = remotePeerId;
      closePeer();
      clearVideoSurface();
      setVideoTransport("connecting");
      setVideoStatus(reason);
      try {
        if (previousPeerId) {
          await sendSignal({
            kind: "viewer-reconnect",
            to: previousPeerId,
            toEndpointId: target.endpointId,
            connectionId,
            payload: { at: Date.now(), reason },
          }).catch(() => undefined);
        }
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        await sendViewerReady();
      } finally {
        reconnecting = false;
      }
    };

    const acceptOffer = async (message: P2pSignalMessage) => {
      if (!message.payload?.sdp) {
        return;
      }
      const candidatesBeforeOffer = pendingCandidates;
      closePeer();
      pendingCandidates = candidatesBeforeOffer;
      remotePeerId = String(message.fromPeerId || message.from || target.peerId || "");
      remoteEndpointId = String(message.fromEndpointId || target.endpointId);
      const pc = new RTCPeerConnection({
        iceServers: signalConfig.iceServers || [],
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      currentPeer = pc;
      previewPeerRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal({
            kind: "ice-candidate",
            to: remotePeerId,
            toEndpointId: remoteEndpointId,
            connectionId,
            payload: { candidate: event.candidate.toJSON() },
          }).catch(() => undefined);
        }
      };
      pc.onconnectionstatechange = () => {
        if (disposed || currentPeer !== pc) {
          return;
        }
        if (pc.connectionState === "connected") {
          setVideoTransport("connecting");
          setVideoStatus(`已连接 ${target.roomId}，等待视频首帧`);
          lastVideoProgressAt = Date.now();
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          void reconnectViewer(`连接已${pc.connectionState === "failed" ? "失败" : "中断"}，正在重连`);
        }
      };
      pc.ontrack = (event) => {
        if (disposed || currentPeer !== pc) {
          return;
        }
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        videoElement.srcObject = remoteStream;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.onloadedmetadata = () => {
          if (videoElement.videoWidth && videoElement.videoHeight) {
            setVideoAspectRatio(videoElement.videoWidth / videoElement.videoHeight);
          }
        };
        videoElement.onresize = videoElement.onloadedmetadata;
        videoElement.onplaying = () => {
          lastVideoTime = videoElement.currentTime;
          lastVideoProgressAt = Date.now();
          setVideoTransport("webrtc");
          setVideoStatus(`正在观看 ${target.roomId} · ${target.displayName}`);
        };
        videoElement.onwaiting = () => setVideoStatus(`正在等待 ${target.roomId} 的视频帧`);
        videoElement.onstalled = () => setVideoStatus(`${target.roomId} 画面暂时停顿，正在检测`);
        void videoElement.play().catch(() => {
          setVideoStatus("浏览器未能自动播放视频，请重新选择该推流端");
        });
      };

      await pc.setRemoteDescription(message.payload.sdp);
      const queuedCandidates = pendingCandidates;
      pendingCandidates = [];
      for (const candidate of queuedCandidates) {
        await pc.addIceCandidate(candidate).catch(() => undefined);
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal({
        kind: "answer",
        to: remotePeerId,
        toEndpointId: remoteEndpointId,
        connectionId,
        payload: {
          sdp: pc.localDescription || answer,
          offerId: String(message.payload.offerId || ""),
        },
      });
      setVideoStatus(`已应答 ${target.roomId} 的视频推流端`);
    };

    const handleMessage = async (message: P2pSignalMessage) => {
      if (message.fromEndpointId && message.fromEndpointId !== target.endpointId) {
        return;
      }
      if (message.kind === "pusher-online") {
        await sendViewerReady();
      } else if (message.kind === "offer" && message.payload?.sdp) {
        await acceptOffer(message);
      } else if (message.kind === "ice-candidate" && message.payload?.candidate) {
        if (currentPeer?.remoteDescription) {
          await currentPeer.addIceCandidate(message.payload.candidate).catch(() => undefined);
        } else {
          pendingCandidates.push(message.payload.candidate);
        }
      }
    };

    const pollMessages = async () => {
      while (!disposed && !abortController.signal.aborted) {
        try {
          const url = apiUrl(`/api/v2/rooms/${encodeURIComponent(target.roomId)}/messages`);
          url.searchParams.set("peerId", peerId);
          url.searchParams.set("endpointId", endpointId);
          url.searchParams.set("since", String(since));
          url.searchParams.set("timeout", "5000");
          const response = await fetch(url, { cache: "no-store", signal: abortController.signal });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const payload = (await response.json()) as { messages?: P2pSignalMessage[] };
          for (const message of payload.messages || []) {
            try {
              await handleMessage(message);
              since = Math.max(since, Number(message.seq) || 0);
            } catch (err) {
              if (message.kind !== "offer") {
                since = Math.max(since, Number(message.seq) || 0);
              }
              throw err;
            }
          }
        } catch (err) {
          if (disposed || abortController.signal.aborted) {
            return;
          }
          const message = err instanceof Error ? err.message : "信令连接失败";
          setVideoTransport("connecting");
          setVideoStatus(`P2P V2 信令重试中：${message}`);
          await new Promise((resolve) => window.setTimeout(resolve, 900));
        }
      }
    };

    let signalConfig: P2pSignalConfig = { iceServers: [] };
    setVideoAspectRatio(DEFAULT_VIDEO_ASPECT_RATIO);
    setVideoTransport("connecting");
    setVideoStatus(`正在连接 ${target.roomId} · ${target.displayName}`);

    void (async () => {
      try {
        const configResponse = await fetch(apiUrl("/api/config"), { cache: "no-store" });
        if (!configResponse.ok) {
          throw new Error(`信令配置 HTTP ${configResponse.status}`);
        }
        signalConfig = (await configResponse.json()) as P2pSignalConfig;
        await registerEndpoint();
        if (disposed) {
          return;
        }
        void pollMessages();
        await sendViewerReady();
      } catch (err) {
        if (!disposed) {
          const message = err instanceof Error ? err.message : "P2P V2 观看启动失败";
          setVideoTransport("error");
          setVideoStatus(`P2P V2 观看失败：${message}`);
        }
      }
    })();

    const readyTimer = window.setInterval(() => void sendViewerReady().catch(() => undefined), 1500);
    const heartbeatTimer = window.setInterval(() => void heartbeatEndpoint().catch(() => undefined), 5000);
    const watchdogTimer = window.setInterval(() => {
      if (disposed || document.hidden || !currentPeer || currentPeer.connectionState !== "connected" || !videoElement.srcObject) {
        return;
      }
      if (videoElement.currentTime > lastVideoTime + 0.05) {
        lastVideoTime = videoElement.currentTime;
        lastVideoProgressAt = Date.now();
        return;
      }
      if (Date.now() - lastVideoProgressAt >= 8000) {
        void reconnectViewer("视频帧停住，正在自动重连");
      }
    }, 3000);

    const notifyOffline = () => {
      const signalPayload = JSON.stringify({
        fromEndpointId: endpointId,
        fromPeerId: peerId,
        toEndpointId: target.endpointId,
        toPeerId: remotePeerId,
        connectionId,
        kind: "viewer-offline",
        payload: { at: Date.now(), reason: "控制台视频窗口已关闭" },
      });
      const signalUrl = apiUrl(`/api/v2/rooms/${encodeURIComponent(target.roomId)}/message`).toString();
      const endpointPayload = JSON.stringify({ action: "offline", peerId });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(signalUrl, new Blob([signalPayload], { type: "application/json" }));
        navigator.sendBeacon(endpointUrl.toString(), new Blob([endpointPayload], { type: "application/json" }));
        return;
      }
      void fetch(signalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: signalPayload,
        keepalive: true,
      }).catch(() => undefined);
      void fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: endpointPayload,
        keepalive: true,
      }).catch(() => undefined);
    };

    window.addEventListener("pagehide", notifyOffline);
    return () => {
      disposed = true;
      abortController.abort();
      if (cloudVideoPollAbortRef.current === abortController) {
        cloudVideoPollAbortRef.current = null;
      }
      window.clearInterval(readyTimer);
      window.clearInterval(heartbeatTimer);
      window.clearInterval(watchdogTimer);
      window.removeEventListener("pagehide", notifyOffline);
      notifyOffline();
      closePeer();
      clearVideoSurface();
    };
  }, [activeView, cloudVideoTargetValue, p2pViewEndpoint.signalBaseUrl]);

  useEffect(() => {
    const shouldMonitor = controlMonitorEnabled && status.connected && activeView === "services";
    let disposed = false;

    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const updateLastEventAt = () => {
      setControlMonitorLastEventAt(
        new Date().toLocaleTimeString("zh-CN", {
          hour12: false,
        }),
      );
    };

    const setStatusSafe = (nextStatus: string) => {
      if (!disposed) {
        setControlMonitorStatus(nextStatus);
      }
    };

    const setPeerStateSafe = (nextState: string) => {
      if (!disposed) {
        setControlMonitorPeerState(nextState);
      }
    };

    const setConnectedSafe = (nextConnected: boolean) => {
      if (!disposed) {
        setControlMonitorConnected(nextConnected);
      }
    };

    if (!shouldMonitor) {
      resetControlMonitorSurface(status.connected ? "Local control monitor idle" : "Connect to the cloud server first");
      return () => {
        disposed = true;
      };
    }

    setControlMonitorPressedKeys([]);
    setControlMonitorClients([]);
    setControlMonitorLinkStatus(CONTROL_MONITOR_DEFAULT_LINK_STATUS);
    setControlMonitorCommandLinkStatus(CONTROL_MONITOR_DEFAULT_LINK_STATUS);
    setControlMonitorMessageCount(0);
    setControlMonitorLastEventAt("");
    setConnectedSafe(false);
    setPeerStateSafe("watching");
    setStatusSafe("Watching side-channel key states");

    void (async () => {
      let monitorConfig: ControlMonitorConfig;
      try {
        monitorConfig = await getControlMonitorConfig();
        setControlMonitorSession(monitorConfig.session || CONTROL_MONITOR_DEFAULT_SESSION);
      } catch (err) {
        setStatusSafe(err instanceof Error ? `Control monitor start failed: ${err.message}` : "Control monitor start failed");
        setPeerStateSafe("error");
        return;
      }

      const sessionName = monitorConfig.session || CONTROL_MONITOR_DEFAULT_SESSION;
      const pollDelayMs = Math.max(CONTROL_MONITOR_MIN_POLL_DELAY_MS, monitorConfig.poll_interval_sec * 1000);
      let consecutiveKeyStateFailures = 0;

      while (!disposed) {
        if (!isPageVisible()) {
          await sleep(pollDelayMs);
          continue;
        }

        try {
          const keyState = await getControlMonitorKeyState(sessionName);
          if (disposed) {
            return;
          }

          consecutiveKeyStateFailures = 0;
          const freshClients = keyState.clients
            .map(normalizeControlMonitorClient)
            .filter((client) => isControlMonitorClientFresh(client, keyState.ttlSec));
          const clients = assignControlMonitorClientColors(freshClients);
          const linkStatus = normalizeControlMonitorLinkStatus(keyState.linkStatus, clients);
          const commandLinkStatus = coerceOverviewControlLinkStatus(keyState.commandLinkStatus);
          const pressedKeys = normalizePressedControlKeys(clients.flatMap((client) => client.pressedKeys));
          const hasLinkActivity = linkStatus.frontendDialing || linkStatus.backendListening || linkStatus.directConnected;
          const hasSideChannelActivity = clients.some(
            (client) => {
              const callState = normalizeControlMonitorCallState(client.callState);
              return CONTROL_MONITOR_DIALING_CALL_STATES.has(callState) || CONTROL_MONITOR_CONNECTED_CALL_STATES.has(callState);
            },
          );

          setControlMonitorClients(clients);
          setControlMonitorPressedKeys(pressedKeys);
          setControlMonitorLinkStatus(linkStatus);
          setControlMonitorCommandLinkStatus(commandLinkStatus);
          setControlMonitorMessageCount(keyState.totalUpdates);
          setConnectedSafe(linkStatus.directConnected);
          setPeerStateSafe(linkStatus.directConnected ? "paired" : hasSideChannelActivity || hasLinkActivity ? "watching" : "idle");

          if (linkStatus.directConnected) {
            updateLastEventAt();
            setStatusSafe(`Showing key input from ${clients.length} frontend client(s)`);
          } else if (hasLinkActivity) {
            setStatusSafe("Control link activity detected; waiting for frontend key-state reports");
          } else {
            setStatusSafe("Side-channel monitor is on; waiting for frontend key-state reports");
          }
        } catch (err) {
          if (disposed) {
            return;
          }

          consecutiveKeyStateFailures += 1;
          const errorMessage =
            err instanceof Error ? `Failed to fetch key state: ${err.message}` : "Failed to fetch key state";

          if (consecutiveKeyStateFailures < CONTROL_MONITOR_KEY_STATE_FAILURE_LIMIT) {
            setStatusSafe(
              `${errorMessage}; retrying (${consecutiveKeyStateFailures}/${CONTROL_MONITOR_KEY_STATE_FAILURE_LIMIT})`,
            );
            await sleep(Math.max(pollDelayMs, CONTROL_MONITOR_KEY_STATE_FAILURE_BACKOFF_MS));
            continue;
          }

          setStatusSafe(`${errorMessage}; monitor retrying`);
          setControlMonitorClients([]);
          setControlMonitorPressedKeys([]);
          setControlMonitorLinkStatus(CONTROL_MONITOR_DEFAULT_LINK_STATUS);
          setControlMonitorCommandLinkStatus(CONTROL_MONITOR_DEFAULT_LINK_STATUS);
          setConnectedSafe(false);
          setPeerStateSafe("error");
          await sleep(Math.max(pollDelayMs, CONTROL_MONITOR_KEY_STATE_FAILURE_BACKOFF_MS));
          continue;
        }

        await sleep(pollDelayMs);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [activeView, controlMonitorEnabled, status.connected]);

  useEffect(() => {
    let alive = true;
    let polling = false;

    async function tick() {
      const shouldPollVideoPushStatus = activeView === "overview" || activeView === "localStream";
      if (!isPageVisible() || !status.connected || !shouldPollVideoPushStatus || polling) {
        if (!status.connected && alive) {
          setVideoPushStatus(null);
          setVideoPushStatusUpdatedAt("");
          setP2pRoomSummary(emptyP2pRoomSummary);
          setP2pV2RoomSummary(emptyP2pV2RoomSummary);
        }
        return;
      }

      polling = true;
      try {
        const [nextStatus] = await Promise.all([
          getVideoPushStatus(),
          refreshP2pRoomSummary(),
          refreshP2pV2RoomSummary(),
        ]);
        if (!alive) {
          return;
        }
        setVideoPushStatus(nextStatus);
        setVideoPushStatusUpdatedAt(formatUiLogTimestamp());
      } catch {
        if (!alive) {
          return;
        }
        setVideoPushStatus(null);
        setVideoPushStatusUpdatedAt(formatUiLogTimestamp());
      } finally {
        polling = false;
      }
    }

    tick();
    const timerId = window.setInterval(tick, VIDEO_PUSH_STATUS_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        void tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeView, status.connected, status.public_base_url]);

  useEffect(() => {
    const keyboard = controlMonitorKeyboardRef.current;
    if (!keyboard) {
      return undefined;
    }
    const keyboardElement = keyboard;

    function getKeyboardVisibleWidth() {
      const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
      const viewportRight = viewportLeft + (window.visualViewport?.width ?? window.innerWidth);
      let visibleLeft = viewportLeft;
      let visibleRight = viewportRight;
      let currentElement: HTMLElement | null = keyboardElement;

      while (currentElement) {
        const rect = currentElement.getBoundingClientRect();
        const styles = window.getComputedStyle(currentElement);
        const clipsHorizontal =
          currentElement === keyboardElement ||
          styles.overflowX === "hidden" ||
          styles.overflowX === "clip" ||
          styles.overflowX === "auto" ||
          styles.overflowX === "scroll";

        if (clipsHorizontal) {
          visibleLeft = Math.max(visibleLeft, rect.left);
          visibleRight = Math.min(visibleRight, rect.right);
        }

        currentElement = currentElement.parentElement;
      }

      return Math.max(0, visibleRight - visibleLeft);
    }

    function getRequiredWidth(columns: number, keySize: number, keyGap: number) {
      return Math.max(
        ...CONTROL_MONITOR_KEY_ROWS.map((row) => {
          const visibleKeys = Math.min(columns, row.keys.length);
          return row.offset * (keySize + keyGap) + visibleKeys * keySize + Math.max(0, visibleKeys - 1) * keyGap;
        }),
      );
    }

    function updateVisibleColumns() {
      const styles = window.getComputedStyle(keyboardElement);
      const keySize = CONTROL_MONITOR_DEFAULT_KEY_SIZE_PX;
      const keyGap = CONTROL_MONITOR_DEFAULT_KEY_GAP_PX;
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
      const width = getKeyboardVisibleWidth();
      const availableWidth = Math.max(
        0,
        width - paddingLeft - paddingRight - CONTROL_MONITOR_KEYBOARD_SAFE_GUTTER_PX * 2,
      );

      const baselineWidth = getRequiredWidth(CONTROL_MONITOR_MIN_VISIBLE_COLUMNS, keySize, keyGap);
      const minBaselineWidth = getRequiredWidth(
        CONTROL_MONITOR_MIN_VISIBLE_COLUMNS,
        CONTROL_MONITOR_MIN_KEY_SIZE_PX,
        CONTROL_MONITOR_MIN_KEY_GAP_PX,
      );
      const scale =
        baselineWidth > availableWidth && baselineWidth > 0
          ? Math.max(minBaselineWidth / baselineWidth, Math.min(1, availableWidth / baselineWidth))
          : 1;
      const fittedKeySize = Math.max(CONTROL_MONITOR_MIN_KEY_SIZE_PX, keySize * scale);
      const fittedKeyGap = Math.max(CONTROL_MONITOR_MIN_KEY_GAP_PX, keyGap * scale);
      let nextColumns = CONTROL_MONITOR_MIN_VISIBLE_COLUMNS;
      for (let columns = CONTROL_MONITOR_MIN_VISIBLE_COLUMNS + 1; columns <= CONTROL_MONITOR_MAX_VISIBLE_COLUMNS; columns += 1) {
        const requiredWidth = getRequiredWidth(columns, fittedKeySize, fittedKeyGap);
        if (requiredWidth > availableWidth) {
          break;
        }
        nextColumns = columns;
      }
      const nextTrackWidth = getRequiredWidth(nextColumns, fittedKeySize, fittedKeyGap);
      setControlMonitorVisibleColumns((current) => (current === nextColumns ? current : nextColumns));
      setControlMonitorKeyboardTrackWidth((current) =>
        current !== null && Math.abs(current - nextTrackWidth) < 0.5 ? current : nextTrackWidth,
      );
      setControlMonitorKeyboardKeySize((current) =>
        Math.abs(current - fittedKeySize) < 0.5 ? current : fittedKeySize,
      );
      setControlMonitorKeyboardKeyGap((current) => (Math.abs(current - fittedKeyGap) < 0.5 ? current : fittedKeyGap));
    }

    updateVisibleColumns();

    const handleWindowResize = () => updateVisibleColumns();
    const observer = new ResizeObserver(() => updateVisibleColumns());
    observer.observe(keyboardElement);
    window.addEventListener("resize", handleWindowResize);
    window.visualViewport?.addEventListener("resize", handleWindowResize);
    window.visualViewport?.addEventListener("scroll", handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      window.visualViewport?.removeEventListener("resize", handleWindowResize);
      window.visualViewport?.removeEventListener("scroll", handleWindowResize);
    };
  }, [activeView]);

  useEffect(() => {
    if (accessInfo.webMode) {
      return;
    }

    let alive = true;
    let polling = false;

    async function tick() {
      if (!isPageVisible() || !status.connected || polling) {
        return;
      }
      polling = true;
      try {
        const [nextLocalStreamStatus, nextP2pLocalPusherStatus] = await Promise.all([
          getLocalStreamStatus(),
          getP2pLocalPusherStatus(),
        ]);
        if (!alive) {
          return;
        }
        setLocalStreamStatus(nextLocalStreamStatus);
        setP2pLocalPusherStatus(nextP2pLocalPusherStatus);
        setP2pPushRunning(nextP2pLocalPusherStatus.running);
        setP2pSignalState(nextP2pLocalPusherStatus.running ? "live" : p2pPushBusy ? "pending" : "idle");
        setLocalStreamConfig((current) => {
          if (localStreamBusy || localStreamDirty || activeView === "localStream") {
            return current;
          }
          return nextLocalStreamStatus.config;
        });
        if (
          !nextLocalStreamStatus.camera_connected &&
          !nextLocalStreamStatus.push_visible &&
          !nextP2pLocalPusherStatus.running &&
          activeView === "localStream"
        ) {
          setActiveView("activity");
        }
      } catch {
        if (alive && activeView === "localStream") {
          setActiveView("activity");
        }
      } finally {
        polling = false;
      }
    }

    tick();
    const timerId = window.setInterval(tick, 3000);
    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        void tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status.connected, activeView, localStreamBusy, localStreamDirty, accessInfo.webMode, p2pPushBusy]);

  useEffect(() => {
    if (localStreamDirty) {
      return;
    }
    setLocalStreamDraft(buildLocalStreamDraft(localStreamConfig));
  }, [localStreamConfig, localStreamDirty]);

  useEffect(() => {
    if (p2pPushRunning || p2pPushBusy) {
      return;
    }

    const preferredSignalBaseUrl = resolveDashboardP2pSignalBaseUrl(status, localStreamConfig);
    if (!preferredSignalBaseUrl) {
      return;
    }

    const currentEndpoint = normalizeP2pEndpointInput(
      p2pRoomDraft || buildP2pWatchPageUrl(p2pRoomIdRef.current, p2pSignalBaseUrlRef.current),
    );
    const nextEndpoint = buildServerPreferredP2pEndpoint(currentEndpoint, preferredSignalBaseUrl);
    if (nextEndpoint.watchUrl === currentEndpoint.watchUrl) {
      return;
    }

    p2pSignalBaseUrlRef.current = nextEndpoint.signalBaseUrl;
    p2pRoomIdRef.current = nextEndpoint.roomId;
    setP2pRoomDraft(nextEndpoint.watchUrl);
    setP2pViewEndpoint((current) => buildServerPreferredP2pEndpoint(current, preferredSignalBaseUrl));
    rememberP2pLink(nextEndpoint.watchUrl);
    if (activeView === "overview" || activeView === "localStream") {
      void refreshP2pRoomSummary();
    }
  }, [
    activeView,
    localStreamConfig.cloud_public_host,
    p2pPushBusy,
    p2pPushRunning,
    status.connected,
    status.public_base_url,
    status.ssh_target,
    status.network_snapshot?.server?.ip,
  ]);

  async function withAction(action: () => Promise<unknown>, options: ActionFlowOptions = {}) {
    if (options.focusActivity) {
      setActiveView("activity");
    }
    if (options.debugLabel) {
      appendDebugLog(`${options.debugLabel}：已发起。`, "info");
    }
    setBusy(true);
    setError("");
    try {
      await action();
      const refreshed = await loadAll("refresh");
      if (options.debugLabel) {
        appendDebugLog(
          refreshed ? `${options.debugLabel}：已完成。` : `${options.debugLabel}：已完成，但界面状态刷新失败。`,
          refreshed ? "success" : "error",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败";
      setError(message);
      if (options.debugLabel) {
        appendDebugLog(`${options.debugLabel}：${message}`, "error");
      }
      setBusy(false);
    }
  }

  async function handleCheckAllPorts() {
    setPortBusyKey("all");
    setError("");
    try {
      const result = await checkAllPorts();
      setPortChecks(result.port_checks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "端口检测失败");
    } finally {
      setPortBusyKey("");
    }
  }

  async function handleCheckPort(portKey: string) {
    setPortBusyKey(portKey);
    setError("");
    try {
      const result = await checkPort(portKey);
      setPortChecks((current) => mergeCheckedPortStatus(current.length ? current : status.port_checks, result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "端口检测失败");
    } finally {
      setPortBusyKey("");
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");
    try {
      await logout();
      if (accessInfo.webMode) {
        await logoutAccount();
      }
      setPortChecks(emptyStatus.port_checks);
      onLogoutDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "退出失败");
      setBusy(false);
    }
  }

  async function handleSidebarRefresh() {
    setSidebarRefreshBusy(true);
    setError("");
    appendDebugLog("本地刷新：开始刷新网络快照。", "info");
    try {
      const nextSnapshot = await refreshNetworkSnapshot();
      setStatus((current) => ({
        ...current,
        network_snapshot: nextSnapshot,
      }));
      appendDebugLog("本地刷新：网络快照刷新完成。", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "刷新连接信息失败";
      setError(message);
      appendDebugLog(`本地刷新：网络快照刷新失败。${message}`, "error");
    } finally {
      setSidebarRefreshBusy(false);
    }
  }

  async function handleDashboardRefresh() {
    appendDebugLog("本地刷新：开始同步控制台状态。", "info");
    const refreshed = await loadAll("refresh");
    appendDebugLog(
      refreshed ? "本地刷新：控制台状态刷新完成。" : "本地刷新：控制台状态刷新失败。",
      refreshed ? "success" : "error",
    );
  }

  function clearSetupMessageTimer() {
    if (setupMessageTimerRef.current) {
      window.clearTimeout(setupMessageTimerRef.current);
      setupMessageTimerRef.current = null;
    }
  }

  function stopSetupProgressAnimation() {
    if (setupProgressTimerRef.current) {
      window.clearInterval(setupProgressTimerRef.current);
      setupProgressTimerRef.current = null;
    }
  }

  function showSetupFeedback(message: string, tone: "success" | "error", durationMs = 2000) {
    stopSetupProgressAnimation();
    clearSetupMessageTimer();
    setSetupProgress(0);
    setSetupTone(tone);
    setSetupMessage(message);
    setupMessageTimerRef.current = window.setTimeout(() => {
      setSetupTone("idle");
      setSetupMessage("");
      setSetupProgress(0);
      setupMessageTimerRef.current = null;
    }, durationMs);
  }

  function startSetupProgressAnimation() {
    stopSetupProgressAnimation();
    clearSetupMessageTimer();
    setSetupMessage("");
    setSetupTone("progress");
    setSetupProgress(8);
    setupProgressTimerRef.current = window.setInterval(() => {
      setSetupProgress((current) => {
        if (current >= 92) {
          return current;
        }
        if (current < 38) {
          return current + 7;
        }
        if (current < 70) {
          return current + 3.4;
        }
        return current + 1.2;
      });
    }, 180);
  }

  function handleLocalSetup() {
    if (!canRunAdminActions) {
      setError("普通用户链接没有一键配置权限。");
      return;
    }
    if (setupBusy) {
      return;
    }

    setError("");
    clearSetupMessageTimer();
    setSetupPassword("");
    setSetupPasswordError("");
    setSetupPasswordDialogOpen(true);
  }

  async function submitLocalSetupPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!canRunAdminActions) {
      setError("普通用户链接没有一键配置权限。");
      return;
    }
    if (setupBusy) {
      return;
    }

    const password = setupPassword;
    if (!password) {
      setSetupPasswordError("请输入 SSH 密码。");
      return;
    }

    setSetupPasswordError("");
    setSetupPasswordDialogOpen(false);
    setSetupPassword("");
    setActiveView("activity");
    setSetupBusy(true);
    setError("");
    startSetupProgressAnimation();
    try {
      appendDebugLog("一键配置：开始检测当前云端环境。", "info");
      const setupStatus = await checkLocalSetup();
      if (setupStatus.ready) {
        const refreshed = await loadAll("refresh");
        stopSetupProgressAnimation();
        setSetupProgress(100);
        setSetupBusy(false);
        appendDebugLog(
          refreshed ? `一键配置：检测OK，${setupStatus.message || "环境已就绪。"}` : "一键配置：检测OK，但界面状态刷新失败。",
          refreshed ? "success" : "error",
        );
        showSetupFeedback("环境已就绪", "success");
        return;
      }

      appendDebugLog(
        `一键配置：检测完成，开始配置。${setupStatus.message ? ` ${setupStatus.message}` : ""}`.trim(),
        "success",
      );
      appendDebugLog("一键配置：正在执行云端配置。", "info");
      const result = await runLocalSetup({ password });
      const refreshed = await loadAll("refresh");
      stopSetupProgressAnimation();
      setSetupProgress(100);
      setSetupBusy(false);
      appendDebugLog(
        refreshed
          ? `一键配置：${result.message || "环境配置完成。"}`
          : `一键配置：${result.message || "环境配置完成。"} 但界面状态刷新失败。`,
        refreshed ? "success" : "error",
      );
      showSetupFeedback(result.message || "环境已就绪", "success");
      return;
      stopSetupProgressAnimation();
      setSetupProgress(100);
      window.setTimeout(() => {
        setSetupBusy(false);
        setSetupPasswordDialogOpen(false);
        setSetupPassword("");
        showSetupFeedback("环境已就绪", "success");
      }, 180);
    } catch (err) {
      stopSetupProgressAnimation();
      setSetupBusy(false);
      const message = err instanceof Error ? err.message : "云端环境配置失败";
      setError(message);
      appendDebugLog(`一键配置：${message}`, "error");
      showSetupFeedback(message, "error", 3200);
    }
  }

  function closeLocalSetupPasswordDialog() {
    if (setupBusy) {
      return;
    }
    setSetupPasswordDialogOpen(false);
    setSetupPassword("");
    setSetupPasswordError("");
  }

  function patchLocalStreamConfig(patch: Partial<LocalStreamConfig>) {
    localStreamEditSeqRef.current += 1;
    setLocalStreamDirty(true);
    setLocalStreamConfig((current) => ({ ...current, ...patch }));
  }

  function markLocalStreamDraftDirty() {
    localStreamEditSeqRef.current += 1;
    setLocalStreamDirty(true);
  }

  async function handleOpenLocalStreamPreview(previewUrl: string) {
    if (!previewUrl) {
      return;
    }

    try {
      if ("__TAURI_IPC__" in window) {
        await openExternalUrl(previewUrl);
        return;
      }
    } catch {
      // Browser fallback below keeps dev mode usable when Tauri shell is unavailable.
    }
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  function openP2pPushPanel() {
    if (tencentCloudPushBusy || tencentCloudPushRunning || (p2pPushRunning && p2pV2Active)) {
      return;
    }

    p2pV2ModeRef.current = false;
    setTencentCloudPushOpen(false);
    setP2pV2PushOpen(false);
    setP2pPushOpen(true);
    const endpoint = getActiveP2pEndpoint();
    setP2pPushMessage(p2pPushRunning ? `P2P 推流中，观看地址：${endpoint.watchUrl}` : "P2P 推流面板已打开，确认参数后开始");
    setLocalStreamMessage("");
  }

  function openP2pV2PushPanel() {
    if (tencentCloudPushBusy || tencentCloudPushRunning || p2pPushBusy || (p2pPushRunning && !p2pV2Active)) {
      return;
    }

    p2pV2ModeRef.current = true;
    setTencentCloudPushOpen(false);
    setP2pPushOpen(false);
    setP2pV2PushOpen(true);
    setP2pPushMessage("P2P V2 面板已打开，确认房间和参数后开始");
    setLocalStreamMessage("");
  }

  function patchLocalStreamNumberDraft(
    draftKey: LocalStreamNumberDraftKey,
    _configKey: LocalStreamNumberConfigKey,
    rawValue: string,
    _min: number,
    _max = Number.MAX_SAFE_INTEGER,
  ) {
    markLocalStreamDraftDirty();
    setLocalStreamDraft((current) => ({ ...current, [draftKey]: rawValue }));
  }

  function commitLocalStreamNumberDraft(
    draftKey: LocalStreamNumberDraftKey,
    configKey: LocalStreamNumberConfigKey,
    rawValue: string,
    fallback: number,
    min: number,
    max = Number.MAX_SAFE_INTEGER,
  ) {
    markLocalStreamDraftDirty();
    const nextValue = parseDraftInteger(rawValue, fallback, min, max);
    setLocalStreamDraft((current) => ({ ...current, [draftKey]: String(nextValue) }));
  }

  function patchViewerResolutionDraft(rawValue: string) {
    markLocalStreamDraftDirty();
    setLocalStreamDraft((current) => ({
      ...current,
      viewerResolution: rawValue,
    }));
  }

  function commitViewerResolutionDraft(rawValue: string, fallbackWidth: number, fallbackHeight: number) {
    markLocalStreamDraftDirty();
    const nextSize = parseLocalStreamSize(rawValue, fallbackWidth, fallbackHeight);
    setLocalStreamDraft((current) => ({
      ...current,
      viewerResolution: formatLocalStreamSize(nextSize.width, nextSize.height),
    }));
  }

  function patchViewerFramerateDraft(rawValue: string) {
    markLocalStreamDraftDirty();
    setLocalStreamDraft((current) => ({
      ...current,
      inputFramerate: rawValue,
      targetFramerate: rawValue,
    }));
  }

  function commitViewerFramerateDraft(rawValue: string, fallback: number) {
    markLocalStreamDraftDirty();
    const nextValue = String(parseDraftInteger(rawValue, fallback, 1, 120));
    setLocalStreamDraft((current) => ({
      ...current,
      inputFramerate: nextValue,
      targetFramerate: nextValue,
    }));
  }

  function patchLocalStreamBitrateDraft(rawValue: string) {
    markLocalStreamDraftDirty();
    setLocalStreamDraft((current) => ({ ...current, videoBitrateKbps: rawValue }));
  }

  function commitLocalStreamBitrateDraft(rawValue: string, fallback: number) {
    markLocalStreamDraftDirty();
    const nextValue = parseDraftInteger(rawValue, fallback, 1);
    setLocalStreamDraft((current) => ({ ...current, videoBitrateKbps: String(nextValue) }));
  }

  async function handleSetupLocalStream() {
    if (localStreamSetupBusy || localStreamStatus.ffmpeg_available) {
      return;
    }

    setLocalStreamSetupBusy(true);
    setLocalStreamMessage("正在配置本地推流工具...");
    setError("");
    try {
      const nextStatus = await setupLocalStream();
      setLocalStreamStatus(nextStatus);
      setLocalStreamConfig(nextStatus.config);
      setLocalStreamDirty(false);
      setLocalStreamMessage(nextStatus.message || "本地配置已就绪");
    } catch (err) {
      const message = err instanceof Error ? err.message : "本地配置失败";
      setLocalStreamMessage(message);
      setError(message);
    } finally {
      setLocalStreamSetupBusy(false);
    }
  }

  async function handleStartLocalStream() {
    setLocalStreamBusy(true);
    setLocalStreamMessage("");
    setError("");
    try {
      const payload = normalizeLocalStreamConfig(applyLocalStreamDraftToConfig(localStreamConfig, localStreamDraft));
      setLocalStreamDraft(buildLocalStreamDraft(payload));
      const nextStatus = await startLocalStream(payload);
      setLocalStreamStatus(nextStatus);
      setLocalStreamConfig(nextStatus.config);
      setLocalStreamDraft(buildLocalStreamDraft(nextStatus.config));
      setLocalStreamDirty(false);
      setLocalStreamMessage("本地推流已启动，当前配置已设为下次推流默认");
    } catch (err) {
      try {
        const nextStatus = await getLocalStreamStatus();
        setLocalStreamStatus(nextStatus);
      } catch {
        // Keep the original startup error visible if status refresh also fails.
      }
      const message = summarizeLocalStreamError(err);
      setLocalStreamMessage(message);
      setError(message);
    } finally {
      setLocalStreamBusy(false);
    }
  }

  async function handleStopLocalStream() {
    setLocalStreamBusy(true);
    setLocalStreamMessage("");
    setError("");
    try {
      const nextStatus = await stopLocalStream();
      setLocalStreamStatus(nextStatus);
      setLocalStreamConfig(nextStatus.config);
      setLocalStreamDirty(false);
      setLocalStreamMessage(nextStatus.message || "本地推流已停止");
    } catch (err) {
      const message = err instanceof Error ? err.message : "本地推流停止失败";
      setLocalStreamMessage(message);
      setError(message);
    } finally {
      setLocalStreamBusy(false);
    }
  }

  function loadTencentCloudPushSdk() {
    if (window.TXLivePusher) {
      return Promise.resolve();
    }

    if (!tencentCloudPushSdkPromiseRef.current) {
      tencentCloudPushSdkPromiseRef.current = new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(
          `script[data-sdk="tencent-cloud-live-pusher"]`,
        );

        if (existingScript) {
          existingScript.addEventListener("load", () => resolve(), { once: true });
          existingScript.addEventListener("error", () => reject(new Error("腾讯云推流 SDK 加载失败")), { once: true });
          return;
        }

        const script = document.createElement("script");
        script.src = TENCENT_CLOUD_PUSH_SDK_URL;
        script.async = true;
        script.dataset.sdk = "tencent-cloud-live-pusher";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("腾讯云推流 SDK 加载失败"));
        document.head.appendChild(script);
      });
    }

    return tencentCloudPushSdkPromiseRef.current;
  }

  function loadTencentCloudPlayerSdk() {
    if (window.TCPlayer) {
      return Promise.resolve();
    }

    if (!tencentCloudPlayerSdkPromiseRef.current) {
      tencentCloudPlayerSdkPromiseRef.current = new Promise<void>((resolve, reject) => {
        if (!document.querySelector<HTMLLinkElement>(`link[data-sdk="tencent-cloud-live-player-style"]`)) {
          const style = document.createElement("link");
          style.rel = "stylesheet";
          style.href = TENCENT_CLOUD_PLAYER_STYLE_URL;
          style.dataset.sdk = "tencent-cloud-live-player-style";
          document.head.appendChild(style);
        }

        const existingScript = document.querySelector<HTMLScriptElement>(
          `script[data-sdk="tencent-cloud-live-player"]`,
        );

        if (existingScript) {
          if (existingScript.src !== TENCENT_CLOUD_PLAYER_SDK_URL) {
            existingScript.remove();
          } else if (existingScript.dataset.loaded === "true") {
            reject(new Error("腾讯云播放 SDK 未就绪"));
            return;
          } else {
            existingScript.addEventListener(
              "load",
              () => {
                existingScript.dataset.loaded = "true";
                if (window.TCPlayer) {
                  resolve();
                } else {
                  reject(new Error("腾讯云播放 SDK 未就绪"));
                }
              },
              { once: true },
            );
            existingScript.addEventListener("error", () => reject(new Error("腾讯云播放 SDK 加载失败")), { once: true });
            return;
          }
        }

        const script = document.createElement("script");
        script.src = TENCENT_CLOUD_PLAYER_SDK_URL;
        script.async = true;
        script.dataset.sdk = "tencent-cloud-live-player";
        script.onload = () => {
          script.dataset.loaded = "true";
          if (window.TCPlayer) {
            resolve();
          } else {
            reject(new Error("腾讯云播放 SDK 未就绪"));
          }
        };
        script.onerror = () => reject(new Error("腾讯云播放 SDK 加载失败"));
        document.head.appendChild(script);
      });
    }

    return tencentCloudPlayerSdkPromiseRef.current;
  }

  function assertTencentCloudPushUrl(pushUrl: string) {
    const normalizedPushUrl = normalizeTencentCloudUrlInput(pushUrl);
    if (!normalizedPushUrl) {
      throw new Error("请先填写腾讯云 webrtc:// 推流地址");
    }
    if (!normalizedPushUrl.startsWith("webrtc://")) {
      throw new Error("腾讯云推流地址需要以 webrtc:// 开头");
    }
    if (!normalizedPushUrl.includes("txSecret=") || !normalizedPushUrl.includes("txTime=")) {
      throw new Error("推流地址缺少 txSecret 或 txTime 鉴权参数");
    }
  }

  function assertTencentCloudPlayUrl(playUrl: string) {
    const normalizedPlayUrl = normalizeTencentCloudUrlInput(playUrl);
    if (!normalizedPlayUrl) {
      throw new Error("请先输入腾讯云播放地址");
    }
    if (!normalizedPlayUrl.startsWith("webrtc://")) {
      throw new Error("腾讯云播放地址需要以 webrtc:// 开头");
    }
  }

  async function postTencentCloudVideoStatus(
    action: "start" | "heartbeat" | "stop",
    pushUrl: string,
    statusReason?: string,
  ) {
    if (!normalizeTencentCloudUrlInput(pushUrl)) {
      return;
    }
    try {
      const response = await postTencentVideoStatus(action, buildTencentCloudVideoStatusPayload(pushUrl, statusReason));
      if (response.tencent) {
        setVideoPushStatus((current) => ({
          ...(current ?? {}),
          ok: true,
          activeMode: response.tencent?.live ? "tencent" : current?.legacy?.live ? "legacy" : "offline",
          conflict: Boolean(current?.legacy?.live && response.tencent?.live),
          availableModes: [
            ...(current?.legacy?.live ? ["legacy"] : []),
            ...(response.tencent?.live ? ["tencent"] : []),
          ],
          tencent: response.tencent,
        }));
        setVideoPushStatusUpdatedAt(formatUiLogTimestamp());
      }
    } catch {
      // The Tencent stream should keep running even if the optional cloud status endpoint is not deployed yet.
    }
  }

  function buildTencentCloudVideoStatusPayload(pushUrl: string, statusReason?: string) {
    const parsedPushUrl = parseTencentCloudPushUrl(pushUrl);
    return {
      streamName: parsedPushUrl.streamName,
      pushUrlHost: parsedPushUrl.pushUrlHost,
      playUrl: normalizeTencentCloudUrlInput(tencentCloudActivePlayUrlRef.current || tencentCloudPlayUrl),
      source: tencentCloudPushSource,
      videoWidth: tencentCloudActiveVideoConfigRef.current?.width,
      videoHeight: tencentCloudActiveVideoConfigRef.current?.height,
      fps: tencentCloudActiveVideoConfigRef.current?.fps,
      bitrateKbps: tencentCloudActiveVideoConfigRef.current?.bitrateKbps,
      quality: tencentCloudActiveVideoConfigRef.current?.quality,
      clientId: "cloud-service-console-local",
      statusReason,
    };
  }

  async function clearTencentCloudRemoteStatus(pushUrl: string, reason = "manual_stop") {
    const normalizedPushUrl = normalizeTencentCloudUrlInput(pushUrl);
    if (!normalizedPushUrl) {
      return;
    }
    const response = await postTencentVideoStatus("stop", buildTencentCloudVideoStatusPayload(normalizedPushUrl, reason));
    clearTencentCloudPushSession();
    if (response.tencent) {
      setVideoPushStatus((current) => ({
        ...(current ?? {}),
        ok: true,
        activeMode: current?.legacy?.live ? "legacy" : "offline",
        conflict: false,
        availableModes: current?.legacy?.live ? ["legacy"] : [],
        tencent: response.tencent,
      }));
      setVideoPushStatusUpdatedAt(formatUiLogTimestamp());
    }
  }

  function stopTencentCloudStatusHeartbeat(reason = "manual_stop") {
    if (tencentCloudStatusHeartbeatRef.current !== null) {
      window.clearInterval(tencentCloudStatusHeartbeatRef.current);
      tencentCloudStatusHeartbeatRef.current = null;
    }
    const activePushUrl = tencentCloudActivePushUrlRef.current;
    tencentCloudActivePushUrlRef.current = "";
    tencentCloudActiveVideoConfigRef.current = null;
    if (activePushUrl) {
      void postTencentCloudVideoStatus("stop", activePushUrl, reason);
    }
    if (reason === "manual_stop") {
      clearTencentCloudPushSession();
    }
  }

  function startTencentCloudStatusHeartbeat(pushUrl: string, videoConfig: TencentCloudVideoConfig) {
    stopTencentCloudStatusHeartbeat("restart");
    tencentCloudActivePushUrlRef.current = pushUrl;
    tencentCloudActiveVideoConfigRef.current = videoConfig;
    rememberTencentCloudPushSession(pushUrl);
    void postTencentCloudVideoStatus("start", pushUrl);
    tencentCloudStatusHeartbeatRef.current = window.setInterval(() => {
      void postTencentCloudVideoStatus("heartbeat", pushUrl);
    }, TENCENT_CLOUD_STATUS_HEARTBEAT_MS);
  }

  function configureTencentCloudPushVideo(pusher: TencentCloudPusher, videoConfig: TencentCloudVideoConfig) {
    pusher.setVideoQuality?.(videoConfig.quality);
    pusher.setAudioQuality?.("standard");
    try {
      pusher.setProperty?.("setVideoResolution", {
        width: videoConfig.width,
        height: videoConfig.height,
      });
    } catch {
      // Older SDK builds may ignore explicit resolution.
    }
    try {
      pusher.setProperty?.("setVideoFPS", videoConfig.fps);
    } catch {
      // Older SDK builds may ignore explicit FPS.
    }
    try {
      pusher.setProperty?.("setVideoBitrate", videoConfig.bitrateKbps);
    } catch {
      // Older SDK builds may ignore explicit bitrate.
    }
  }

  function openTencentCloudPushCodeDialog() {
    if (tencentCloudPushBusy || p2pPushBusy || p2pPushRunning) {
      return;
    }

    setP2pPushOpen(false);
    setP2pV2PushOpen(false);
    setTencentCloudPushDraftUrl(tencentCloudPushUrl || readSavedTencentCloudPushUrl());
    setTencentCloudPushCodeError("");
    setTencentCloudPushCodeDialogOpen(true);
  }

  function closeTencentCloudPushCodeDialog() {
    if (tencentCloudPushBusy) {
      return;
    }

    setTencentCloudPushCodeDialogOpen(false);
    setTencentCloudPushCodeError("");
  }

  function selectTencentCloudPushUrl() {
    if (!normalizeTencentCloudUrlInput(tencentCloudPushUrl) || !tencentCloudPushCodeRef.current) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(tencentCloudPushCodeRef.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function handleTencentCloudPushCodeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectTencentCloudPushUrl();
  }

  function submitTencentCloudPushCode(event: React.FormEvent) {
    event.preventDefault();
    const pushUrl = normalizeTencentCloudUrlInput(tencentCloudPushDraftUrl);
    try {
      assertTencentCloudPushUrl(pushUrl);
    } catch (err) {
      setTencentCloudPushCodeError(err instanceof Error ? err.message : "腾讯云推流码格式不正确");
      return;
    }

    const rememberedPushUrl = rememberTencentCloudPushUrl(pushUrl);
    setTencentCloudPushUrl(rememberedPushUrl);
    setTencentCloudPushDraftUrl(rememberedPushUrl);
    setTencentCloudPushCodeError("");
    setTencentCloudPushCodeDialogOpen(false);
    setP2pPushOpen(false);
    setP2pV2PushOpen(false);
    setTencentCloudPushOpen(true);
    setTencentCloudPushMessage(
      tencentCloudPushRunning ? "腾讯云推流中，可到拉流页查看 robot_control" : "推流码已就绪，选择视频源后开始",
    );
  }

  function openTencentCloudPlayDialog() {
    if (tencentCloudPlayBusy) {
      return;
    }

    const tencentCloudStatusPlayUrl = normalizeTencentCloudUrlInput(videoPushStatus?.tencent?.playUrl || "");
    const defaultPlayUrl =
      tencentCloudStatusPlayUrl ||
      normalizeTencentCloudUrlInput(tencentCloudPlayUrl) ||
      readSavedTencentCloudPlayUrl() ||
      buildTencentCloudDefaultPlayUrl(status, videoPushStatus?.tencent?.streamName || "robot_control");
    setTencentCloudPlayDraftUrl(defaultPlayUrl);
    setTencentCloudPlayError("");
    setTencentCloudPlayDialogOpen(true);
  }

  function closeTencentCloudPlayDialog() {
    if (tencentCloudPlayBusy) {
      return;
    }

    setTencentCloudPlayDialogOpen(false);
    setTencentCloudPlayError("");
  }

  function stopTencentCloudWebPlayer() {
    const player = tencentCloudPlayerRef.current;
    if (player) {
      try {
        player.pause?.();
      } catch {
        // Continue tearing down the player container.
      }
      try {
        player.stop?.();
      } catch {
        // Continue tearing down the player container.
      }
      try {
        player.dispose?.();
      } catch {
        // Continue clearing the reference.
      }
      try {
        player.destroy?.();
      } catch {
        // Continue clearing the reference.
      }
    }
    tencentCloudPlayerRef.current = null;
    setTencentCloudPlayOpen(false);
    setTencentCloudPlayerKey((current) => current + 1);
  }

  function resetTencentCloudPushPreview() {
    const videoElement = tencentCloudPreviewVideoRef.current;
    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }
    tencentCloudPreviewStreamRef.current = null;
    tencentCloudPreviewStreamIdRef.current = "";
  }

  function attachTencentCloudPreviewStream(stream?: MediaStream | null) {
    const nextStream = stream || tencentCloudPreviewStreamRef.current;
    const videoElement = tencentCloudPreviewVideoRef.current;
    if (!videoElement || !nextStream) {
      return;
    }

    if (videoElement.srcObject !== nextStream) {
      videoElement.srcObject = nextStream;
    }
    videoElement.muted = true;
    videoElement.playsInline = true;
    const playResult = videoElement.play();
    void Promise.resolve(playResult).catch(() => undefined);
  }

  function rememberTencentCloudPreviewStream(streamId: string | undefined) {
    if (!streamId || !tencentCloudPusherRef.current?.getMediaStream) {
      return;
    }

    try {
      const stream = tencentCloudPusherRef.current.getMediaStream(streamId);
      if (stream) {
        tencentCloudPreviewStreamIdRef.current = streamId;
        tencentCloudPreviewStreamRef.current = stream;
        attachTencentCloudPreviewStream(stream);
      }
    } catch {
      // The SDK preview remains optional; pushing can continue without local mirror.
    }
  }

  function restoreTencentCloudPushPreview() {
    const pusher = tencentCloudPusherRef.current;
    if (!pusher || !tencentCloudPushRunning) {
      return;
    }

    const bindPreview = () => {
      const activePusher = tencentCloudPusherRef.current;
      if (!activePusher) {
        return;
      }

      if (!tencentCloudPreviewStreamRef.current && tencentCloudPreviewStreamIdRef.current && activePusher.getMediaStream) {
        try {
          tencentCloudPreviewStreamRef.current = activePusher.getMediaStream(tencentCloudPreviewStreamIdRef.current);
        } catch {
          // The local mirror is optional; pushing can continue without it.
        }
      }
      try {
        activePusher.resizeView?.();
      } catch {
        // Some SDK versions do not expose an explicit resize hook.
      }
      attachTencentCloudPreviewStream();
    };
    window.setTimeout(bindPreview, 0);
    window.setTimeout(bindPreview, 250);
    window.setTimeout(bindPreview, 800);

    const activePushUrl = tencentCloudActivePushUrlRef.current;
    if (activePushUrl) {
      void postTencentCloudVideoStatus("heartbeat", activePushUrl);
    }
  }

  async function openTencentCloudPlayerPage(playUrl: string) {
    const normalizedPlayUrl = normalizeTencentCloudUrlInput(playUrl);
    if (!normalizedPlayUrl) {
      throw new Error("请先输入腾讯云播放地址");
    }

    assertTencentCloudPlayUrl(normalizedPlayUrl);
    const rememberedPlayUrl = rememberTencentCloudPlayUrl(normalizedPlayUrl);
    setTencentCloudPlayUrl(rememberedPlayUrl);
    setTencentCloudPlayDraftUrl(rememberedPlayUrl);
    tencentCloudActivePlayUrlRef.current = rememberedPlayUrl;
    setTencentCloudPlayOpen(true);
    setTencentCloudPlayMessage("网页端观看页面已打开");
    await handleOpenLocalStreamPreview(buildTencentCloudPlayerPageUrl(rememberedPlayUrl));
  }

  async function startTencentCloudWebPlayer(playUrl: string) {
    setTencentCloudPlayBusy(true);
    setTencentCloudPlayMessage("正在打开腾讯云观看页面...");
    setError("");
    try {
      await openTencentCloudPlayerPage(playUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "腾讯云播放启动失败";
      setTencentCloudPlayMessage(message);
      setTencentCloudPlayError(message);
      setError(message);
    } finally {
      setTencentCloudPlayBusy(false);
    }
  }

  function submitTencentCloudPlayCode(event: React.FormEvent) {
    event.preventDefault();
    const playUrl = normalizeTencentCloudUrlInput(tencentCloudPlayDraftUrl);
    try {
      assertTencentCloudPlayUrl(playUrl);
    } catch (err) {
      setTencentCloudPlayError(err instanceof Error ? err.message : "腾讯云播放地址格式不正确");
      return;
    }

    const rememberedPlayUrl = rememberTencentCloudPlayUrl(playUrl);
    setTencentCloudPlayUrl(rememberedPlayUrl);
    setTencentCloudPlayDraftUrl(rememberedPlayUrl);
    setTencentCloudPlayDialogOpen(false);
    void startTencentCloudWebPlayer(playUrl);
  }

  async function stopTencentCloudPush(options: { silent?: boolean } = {}) {
    const pusher = tencentCloudPusherRef.current;
    if (!pusher) {
      const restoredPushUrl =
        normalizeTencentCloudUrlInput(tencentCloudActivePushUrlRef.current) ||
        readTencentCloudPushSession() ||
        normalizeTencentCloudUrlInput(tencentCloudPushUrl);
      stopTencentCloudStatusHeartbeat("manual_stop");
      if (restoredPushUrl) {
        if (!options.silent) {
          setTencentCloudPushBusy(true);
        }
        try {
          await clearTencentCloudRemoteStatus(restoredPushUrl, "manual_stop");
          if (!options.silent) {
            setTencentCloudPushMessage("腾讯云推流状态已清除");
          }
        } finally {
          if (!options.silent) {
            setTencentCloudPushBusy(false);
          }
        }
      }
      setTencentCloudPushRunning(false);
      return;
    }

    stopTencentCloudStatusHeartbeat("manual_stop");
    if (!options.silent) {
      setTencentCloudPushBusy(true);
      setTencentCloudPushMessage("正在停止腾讯云推流...");
    }

    try {
      try {
        await pusher.stopPush?.();
      } catch {
        // Continue releasing local capture devices.
      }
      try {
        await pusher.stopScreenCapture?.();
      } catch {
        // Continue releasing local capture devices.
      }
      try {
        await pusher.stopCamera?.();
      } catch {
        // Continue releasing local capture devices.
      }
      try {
        await pusher.stopMicrophone?.();
      } catch {
        // Continue releasing local capture devices.
      }
      tencentCloudPusherRef.current = null;
      setTencentCloudPushRunning(false);
      resetTencentCloudPushPreview();
      if (!options.silent) {
        setTencentCloudPushMessage("腾讯云推流已停止");
      }
    } finally {
      if (!options.silent) {
        setTencentCloudPushBusy(false);
      }
    }
  }

  async function handleStartTencentCloudPush() {
    if (tencentCloudPushBusy) {
      return;
    }

    setTencentCloudPushBusy(true);
    setError("");

    try {
      const pushUrl = normalizeTencentCloudUrlInput(tencentCloudPushUrl);
      assertTencentCloudPushUrl(pushUrl);
      const requestedConfig = normalizeLocalStreamConfig(
        applyLocalStreamDraftToConfig(localStreamConfig, localStreamDraft),
      );
      setLocalStreamDraft(buildLocalStreamDraft(requestedConfig));
      let committedConfig = requestedConfig;
      if (accessInfo.webMode) {
        if (!window.isSecureContext) {
          throw new Error("网页端腾讯云推流需要 HTTPS 或 localhost，当前入口无法打开摄像头");
        }
        if (tencentCloudPushSource === "camera" && browserCameraProbe.status !== "available") {
          throw new Error(browserCameraProbe.note || "未检测到可用摄像头");
        }
        setLocalStreamConfig(committedConfig);
      } else {
        const savedLocalStreamStatus = await saveLocalStreamConfig(requestedConfig);
        committedConfig = savedLocalStreamStatus.config;
        setLocalStreamStatus(savedLocalStreamStatus);
      }
      const videoConfig = buildTencentCloudVideoConfig(committedConfig);
      setLocalStreamConfig(committedConfig);
      setLocalStreamDirty(false);
      const currentPlayUrl = normalizeTencentCloudUrlInput(tencentCloudPlayUrl);
      const fallbackPlayUrl = currentPlayUrl || buildTencentCloudDefaultPlayUrl(status);
      if (fallbackPlayUrl && !currentPlayUrl) {
        const rememberedPlayUrl = rememberTencentCloudPlayUrl(fallbackPlayUrl);
        setTencentCloudPlayUrl(rememberedPlayUrl);
        setTencentCloudPlayDraftUrl(rememberedPlayUrl);
        tencentCloudActivePlayUrlRef.current = rememberedPlayUrl;
      } else {
        tencentCloudActivePlayUrlRef.current = fallbackPlayUrl;
      }

      if (tencentCloudPusherRef.current) {
        await stopTencentCloudPush({ silent: true });
      }
      resetTencentCloudPushPreview();

      setTencentCloudPushMessage("正在加载腾讯云推流 SDK...");
      await loadTencentCloudPushSdk();

      if (!window.TXLivePusher) {
        throw new Error("腾讯云推流 SDK 未就绪");
      }

      const pusher = new window.TXLivePusher();
      tencentCloudPusherRef.current = pusher;
      configureTencentCloudPushVideo(pusher, videoConfig);

      if (tencentCloudPushSource === "screen") {
        if (!pusher.startScreenCapture) {
          throw new Error("当前腾讯云推流 SDK 不支持屏幕采集，请切换为摄像头");
        }
        setTencentCloudPushMessage("请选择要推送的屏幕或窗口...");
        const screenStreamId = await pusher.startScreenCapture();
        rememberTencentCloudPreviewStream(screenStreamId);
      } else {
        setTencentCloudPushMessage("正在打开摄像头...");
        const cameraStreamId = await pusher.startCamera?.();
        rememberTencentCloudPreviewStream(cameraStreamId);
      }

      if (tencentCloudPushAudioEnabled) {
        setTencentCloudPushMessage("正在打开麦克风...");
        await pusher.startMicrophone?.();
      }

      setTencentCloudPushMessage("正在连接腾讯云推流地址...");
      await pusher.startPush(pushUrl);
      const rememberedPushUrl = rememberTencentCloudPushUrl(pushUrl);
      setTencentCloudPushUrl(rememberedPushUrl);
      setTencentCloudPushDraftUrl(rememberedPushUrl);
      setTencentCloudPushRunning(true);
      startTencentCloudStatusHeartbeat(pushUrl, videoConfig);
      setTencentCloudPushMessage(
        `腾讯云推流中：${videoConfig.width}x${videoConfig.height}@${videoConfig.fps} ${videoConfig.bitrateKbps}kbps`,
      );
    } catch (err) {
      await stopTencentCloudPush({ silent: true });
      const message = err instanceof Error ? err.message : "腾讯云推流启动失败";
      setTencentCloudPushMessage(message);
      setError(message);
    } finally {
      setTencentCloudPushBusy(false);
    }
  }

  function buildP2pVideoConfig(config: LocalStreamConfig): P2pVideoConfig {
    const inputSize = parseLocalStreamSize(config.video_size, 1280, 720);
    const outputSize = parseLocalStreamSize(config.output_video_size, inputSize.width, inputSize.height);
    return {
      captureWidth: Math.max(1, inputSize.width),
      captureHeight: Math.max(1, inputSize.height),
      outputWidth: Math.max(1, outputSize.width),
      outputHeight: Math.max(1, outputSize.height),
      inputFps: Math.min(120, Math.max(1, Number(config.input_framerate) || 30)),
      fps: Math.min(120, Math.max(1, Number(config.target_framerate) || Number(config.input_framerate) || 30)),
      bitrateKbps: Math.min(12000, Math.max(100, parseLocalStreamBitrateKbps(config.video_bitrate))),
    };
  }

  function describeP2pLocalPusherStatus(status: P2PLocalPusherStatus) {
    const profile = status.active_profile || {};
    const width = Number(profile.outputWidth || profile.captureWidth || 0);
    const height = Number(profile.outputHeight || profile.captureHeight || 0);
    const fps = Number(profile.fps || profile.inputFps || 0);
    const bitrateKbps = Number(profile.bitrateKbps || 0);
    const encoder = String(profile.encoder || "").trim();
    const camera = String(profile.camera || "").trim();
    const parts = [`P2P 本地脚本推流中：${status.watch_url || buildP2pWatchPageUrl(status.room_id || P2P_DEFAULT_ROOM_ID)}`];
    if (width && height && fps) {
      parts.push(`${width}x${height}@${fps}`);
    }
    if (bitrateKbps) {
      parts.push(`${bitrateKbps}kbps`);
    }
    if (encoder) {
      parts.push(encoder);
    }
    if (camera) {
      parts.push(camera);
    }
    return parts.join("，");
  }

  function p2pApiUrl(path: string) {
    return new URL(path, p2pSignalBaseUrlRef.current || P2P_SIGNAL_BASE_URL);
  }

  function getActiveP2pEndpoint() {
    const endpoint = normalizeP2pEndpointInput(p2pRoomDraft || buildP2pWatchPageUrl(p2pRoomIdRef.current, p2pSignalBaseUrlRef.current));
    const activeEndpoint = {
      signalBaseUrl: p2pSignalBaseUrlRef.current || endpoint.signalBaseUrl,
      roomId: p2pRoomIdRef.current || endpoint.roomId,
      watchUrl: buildP2pWatchPageUrl(p2pRoomIdRef.current || endpoint.roomId, p2pSignalBaseUrlRef.current || endpoint.signalBaseUrl),
    };
    return buildServerPreferredP2pEndpoint(activeEndpoint, resolveDashboardP2pSignalBaseUrl(status, localStreamConfig));
  }

  function getActiveP2pRoomId() {
    return getActiveP2pEndpoint().roomId;
  }

  async function fetchP2pActiveRooms(signalBaseUrl: string) {
    const roomsUrl = new URL("/api/rooms", signalBaseUrl || P2P_SIGNAL_BASE_URL);
    const response = await fetch(roomsUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as P2pRoomsResponse;
    return Array.isArray(payload.rooms)
      ? payload.rooms
          .filter((room) => String(room.room || "").trim())
          .sort((a, b) => String(a.room || "").localeCompare(String(b.room || "")))
      : [];
  }

  async function fetchP2pV2ActiveRooms(signalBaseUrl: string) {
    const roomsUrl = new URL("/api/v2/rooms", signalBaseUrl || P2P_SIGNAL_BASE_URL);
    const response = await fetch(roomsUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as P2pV2RoomsResponse;
    return Array.isArray(payload.rooms)
      ? payload.rooms
          .filter((room) => String(room.room || "").trim())
          .sort((a, b) => String(a.room || "").localeCompare(String(b.room || "")))
      : [];
  }

  async function refreshP2pRoomSummary() {
    const endpoint = getActiveP2pEndpoint();
    try {
      const rooms = await fetchP2pActiveRooms(endpoint.signalBaseUrl);
      setP2pRoomSummary({ rooms, updatedAt: formatUiLogTimestamp(), error: "" });
      return rooms;
    } catch (err) {
      const message = err instanceof Error ? err.message : "P2P 房间状态读取失败";
      setP2pRoomSummary({ rooms: [], updatedAt: formatUiLogTimestamp(), error: message });
      return [];
    }
  }

  async function refreshP2pV2RoomSummary() {
    const endpoint = getActiveP2pEndpoint();
    try {
      const rooms = await fetchP2pV2ActiveRooms(endpoint.signalBaseUrl);
      setP2pV2RoomSummary({ rooms, updatedAt: formatUiLogTimestamp(), error: "" });
      return rooms;
    } catch (err) {
      const message = err instanceof Error ? err.message : "P2P V2 房间状态读取失败";
      setP2pV2RoomSummary({ rooms: [], updatedAt: formatUiLogTimestamp(), error: message });
      return [];
    }
  }

  async function loadP2pSignalConfig() {
    const response = await fetch(p2pApiUrl("/api/config"), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`P2P 信令服务器不可用：HTTP ${response.status}`);
    }
    const payload = (await response.json()) as P2pSignalConfig;
    p2pSignalConfigRef.current = {
      ...payload,
      iceServers: Array.isArray(payload.iceServers) ? payload.iceServers : [],
    };
  }

  async function sendP2pSignal(message: P2pSignalMessage) {
    const v2 = p2pV2ModeRef.current;
    const response = await fetch(p2pApiUrl(`/api/${v2 ? "v2/" : ""}rooms/${encodeURIComponent(getActiveP2pRoomId())}/message`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v2
        ? {
            ...message,
            fromEndpointId: p2pEndpointIdRef.current,
            fromPeerId: p2pPeerIdRef.current,
          }
        : {
            ...message,
            from: p2pPeerIdRef.current,
            fromRole: "pusher",
          }),
    });
    if (!response.ok) {
      let detail = "";
      try {
        const payload = await response.json();
        detail = payload?.error ? `：${payload.error}` : "";
      } catch {
        detail = "";
      }
      throw new Error(`P2P 信令发送失败：HTTP ${response.status}${detail}`);
    }
    return response.json();
  }

  async function registerP2pV2VideoEndpoint(videoConfig: P2pVideoConfig) {
    const response = await fetch(p2pApiUrl(`/api/v2/rooms/${encodeURIComponent(getActiveP2pRoomId())}/endpoints`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpointId: p2pEndpointIdRef.current,
        peerId: p2pPeerIdRef.current,
        role: "video-pusher",
        displayName: `控制台视频端 ${p2pEndpointIdRef.current.slice(-8)}`,
        status: "waiting",
        capabilities: { watchable: true, media: "video", protocol: "webrtc" },
        metadata: { video: videoConfig, source: "cloud-service-console" },
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || `V2 视频端注册失败：HTTP ${response.status}`);
    }
  }

  async function heartbeatP2pV2Endpoint(videoConfig: P2pVideoConfig) {
    const response = await fetch(
      p2pApiUrl(`/api/v2/rooms/${encodeURIComponent(getActiveP2pRoomId())}/endpoints/${encodeURIComponent(p2pEndpointIdRef.current)}`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "heartbeat",
          peerId: p2pPeerIdRef.current,
          status: p2pConnectionsRef.current.size > 0 ? "connected" : "waiting",
          metadata: { video: videoConfig, viewerCount: p2pConnectionsRef.current.size },
        }),
      },
    );
    if (response.status === 404) {
      await registerP2pV2VideoEndpoint(videoConfig);
      return;
    }
    if (!response.ok) {
      throw new Error(`V2 视频端心跳失败：HTTP ${response.status}`);
    }
  }

  async function unregisterP2pV2Endpoint() {
    await fetch(
      p2pApiUrl(`/api/v2/rooms/${encodeURIComponent(getActiveP2pRoomId())}/endpoints/${encodeURIComponent(p2pEndpointIdRef.current)}`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "offline", peerId: p2pPeerIdRef.current }),
        keepalive: true,
      },
    ).catch(() => undefined);
  }

  async function resetP2pRoomSignal() {
    const endpoint = getActiveP2pEndpoint();
    p2pSignalBaseUrlRef.current = endpoint.signalBaseUrl;
    p2pRoomIdRef.current = endpoint.roomId;
    const roomId = endpoint.roomId;
    const response = await fetch(p2pApiUrl(`/api/rooms/${encodeURIComponent(roomId)}/reset`), { method: "POST" });
    if (!response.ok) {
      throw new Error(`P2P 信令清空失败：HTTP ${response.status}`);
    }
  }

  function attachP2pPreviewStream(stream?: MediaStream | null) {
    const nextStream = stream || p2pSendStreamRef.current || p2pRawStreamRef.current;
    const videoElement = p2pPreviewVideoRef.current;
    if (!videoElement || !nextStream) {
      return;
    }
    if (videoElement.srcObject !== nextStream) {
      videoElement.srcObject = nextStream;
    }
    videoElement.muted = true;
    videoElement.playsInline = true;
    void Promise.resolve(videoElement.play()).catch(() => undefined);
  }

  function stopMediaStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((track) => track.stop());
  }

  async function buildP2pOutgoingStream(rawStream: MediaStream, videoConfig: P2pVideoConfig) {
    const rawVideoTrack = rawStream.getVideoTracks()[0];
    if (
      videoConfig.outputWidth === videoConfig.captureWidth &&
      videoConfig.outputHeight === videoConfig.captureHeight &&
      videoConfig.fps === videoConfig.inputFps
    ) {
      return rawStream;
    }
    if (!rawVideoTrack || typeof document === "undefined") {
      return rawStream;
    }

    const sourceVideo = document.createElement("video");
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    sourceVideo.srcObject = rawStream;
    await sourceVideo.play();

    const canvas = document.createElement("canvas");
    canvas.width = videoConfig.outputWidth;
    canvas.height = videoConfig.outputHeight;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx || !canvas.captureStream) {
      return rawStream;
    }

    const draw = () => {
      if (p2pDrawTimerRef.current === null) {
        return;
      }
      try {
        ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
      } catch {
        // The next animation frame will retry while the source video warms up.
      }
      p2pDrawTimerRef.current = window.setTimeout(draw, Math.max(16, Math.round(1000 / videoConfig.fps)));
    };
    if (p2pDrawTimerRef.current !== null) {
      window.clearTimeout(p2pDrawTimerRef.current);
    }
    p2pDrawTimerRef.current = -1;
    draw();

    const outgoing = canvas.captureStream(videoConfig.fps);
    rawStream.getAudioTracks().forEach((track) => outgoing.addTrack(track));
    return outgoing;
  }

  async function openP2pCameraStream(videoConfig: P2pVideoConfig) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("当前浏览器不支持摄像头采集");
    }
    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: videoConfig.captureWidth },
        height: { ideal: videoConfig.captureHeight },
        frameRate: { ideal: videoConfig.inputFps, max: videoConfig.inputFps },
      },
      audio: false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  function applyP2pSenderBitrate(sender: RTCRtpSender, videoConfig: P2pVideoConfig) {
    try {
      const params = sender.getParameters();
      params.encodings = params.encodings && params.encodings.length ? params.encodings : [{}];
      params.encodings[0].maxBitrate = videoConfig.bitrateKbps * 1000;
      params.encodings[0].priority = "high";
      sender.setParameters(params).catch(() => undefined);
    } catch {
      // Browser support differs; WebRTC can still push without an explicit max bitrate.
    }
  }

  function updateP2pViewerCount() {
    setP2pViewerCount(p2pConnectionsRef.current.size);
  }

  function handleP2pRoomDraftChange(value: string) {
    setP2pRoomDraft(value.trim());
    if (!p2pPushRunning) {
      const endpoint = buildServerPreferredP2pEndpoint(
        normalizeP2pEndpointInput(value),
        resolveDashboardP2pSignalBaseUrl(status, localStreamConfig),
      );
      p2pSignalBaseUrlRef.current = endpoint.signalBaseUrl;
      p2pRoomIdRef.current = endpoint.roomId;
    }
  }

  async function connectP2pViewer(
    viewerId: string,
    videoConfig: P2pVideoConfig,
    viewerEndpointId = viewerId,
    connectionId = makeP2pPeerId("connection"),
  ) {
    if (!p2pSendStreamRef.current || p2pConnectionsRef.current.has(viewerId)) {
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: p2pSignalConfigRef.current.iceServers || [],
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    const connection: P2pViewerConnection = { pc, viewerId, viewerEndpointId, connectionId, status: "connecting" };
    p2pConnectionsRef.current.set(viewerId, connection);
    updateP2pViewerCount();

    p2pSendStreamRef.current.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, p2pSendStreamRef.current as MediaStream);
      if (track.kind === "video") {
        applyP2pSenderBitrate(sender, videoConfig);
      }
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void sendP2pSignal({
          kind: "ice-candidate",
          to: viewerId,
          toEndpointId: viewerEndpointId,
          toPeerId: viewerId,
          connectionId,
          payload: { candidate: event.candidate.toJSON() },
        });
      }
    };
    pc.onconnectionstatechange = () => {
      connection.status = pc.connectionState;
      if (pc.connectionState === "connected") {
        setP2pSignalState("live");
        setP2pPushMessage(`P2P 推流中：${videoConfig.outputWidth}x${videoConfig.outputHeight}@${videoConfig.fps}，${p2pConnectionsRef.current.size} 个观看端`);
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        p2pConnectionsRef.current.delete(viewerId);
        updateP2pViewerCount();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendP2pSignal({
      kind: "offer",
      to: viewerId,
      toEndpointId: viewerEndpointId,
      toPeerId: viewerId,
      connectionId,
      payload: { sdp: pc.localDescription || offer, video: videoConfig },
    });
    setP2pPushMessage(`已向观看端 ${viewerId.slice(0, 8)} 发送 P2P offer`);
  }

  function closeP2pViewerConnection(viewerId: string) {
    const connection = p2pConnectionsRef.current.get(viewerId);
    if (!connection) {
      return false;
    }
    connection.pc.close();
    p2pConnectionsRef.current.delete(viewerId);
    updateP2pViewerCount();
    return true;
  }

  async function handleP2pSignalMessage(message: P2pSignalMessage, videoConfig: P2pVideoConfig) {
    const senderId = message.fromPeerId || message.from || "";
    const senderEndpointId = message.fromEndpointId || senderId;
    if (message.kind === "viewer-offline" && senderId) {
      if (closeP2pViewerConnection(senderId)) {
        setP2pPushMessage(`观看端 ${senderId.slice(0, 8)} 已离开`);
      }
      return;
    }
    if (message.kind === "viewer-reconnect" && senderId) {
      closeP2pViewerConnection(senderId);
      await connectP2pViewer(senderId, videoConfig, senderEndpointId, message.connectionId);
      return;
    }
    if ((message.kind === "viewer-ready" || message.kind === "connect-request") && senderId) {
      await connectP2pViewer(senderId, videoConfig, senderEndpointId, message.connectionId);
      return;
    }
    if (message.kind === "answer" && senderId && message.payload?.sdp) {
      const connection = p2pConnectionsRef.current.get(senderId);
      if (connection) {
        await connection.pc.setRemoteDescription(message.payload.sdp);
        setP2pPushMessage(`观看端 ${senderId.slice(0, 8)} 已应答`);
      }
      return;
    }
    if (message.kind === "ice-candidate" && senderId && message.payload?.candidate) {
      const connection = p2pConnectionsRef.current.get(senderId);
      if (connection) {
        await connection.pc.addIceCandidate(message.payload.candidate).catch(() => undefined);
      }
    }
  }

  async function pollP2pMessages(videoConfig: P2pVideoConfig) {
    p2pPollAbortRef.current?.abort();
    const abortController = new AbortController();
    p2pPollAbortRef.current = abortController;
    const roomId = getActiveP2pRoomId();
    while (p2pPollAbortRef.current === abortController && !abortController.signal.aborted) {
      try {
        const v2 = p2pV2ModeRef.current;
        const url = p2pApiUrl(`/api/${v2 ? "v2/" : ""}rooms/${encodeURIComponent(roomId)}/messages`);
        url.searchParams.set("peerId", p2pPeerIdRef.current);
        if (v2) {
          url.searchParams.set("endpointId", p2pEndpointIdRef.current);
        } else {
          url.searchParams.set("role", "pusher");
        }
        url.searchParams.set("since", String(p2pSinceRef.current));
        url.searchParams.set("timeout", String(P2P_SIGNAL_POLL_TIMEOUT_MS));
        const response = await fetch(url, { cache: "no-store", signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { messages?: P2pSignalMessage[] };
        for (const message of payload.messages || []) {
          p2pSinceRef.current = Math.max(p2pSinceRef.current, Number(message.seq) || 0);
          await handleP2pSignalMessage(message, videoConfig);
        }
      } catch {
        if (abortController.signal.aborted) {
          return;
        }
        setP2pSignalState("pending");
        setP2pPushMessage("P2P 信令重试中...");
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      }
    }
  }

  function startP2pHeartbeat(videoConfig: P2pVideoConfig) {
    if (p2pHeartbeatRef.current !== null) {
      window.clearInterval(p2pHeartbeatRef.current);
    }
    p2pHeartbeatRef.current = window.setInterval(() => {
      if (p2pV2ModeRef.current) {
        void heartbeatP2pV2Endpoint(videoConfig).catch(() => undefined);
        return;
      }
      void sendP2pSignal({
        kind: "pusher-heartbeat",
        toRole: "viewer",
        payload: { at: Date.now(), video: videoConfig },
      }).catch(() => undefined);
    }, 5000);
  }

  async function stopP2pPush(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setP2pPushBusy(true);
    }
    if (!accessInfo.webMode) {
      try {
        const nextStatus = await stopP2pLocalPusher();
        setP2pLocalPusherStatus(nextStatus);
        setP2pPushRunning(nextStatus.running);
        setP2pSignalState(nextStatus.running ? "live" : "idle");
        setP2pViewerCount(0);
        if (!options.silent) {
          setP2pPushMessage(nextStatus.running ? describeP2pLocalPusherStatus(nextStatus) : "P2P 推流已停止");
        }
        void refreshP2pRoomSummary();
      } catch (err) {
        const message = err instanceof Error ? err.message : "P2P 推流停止失败";
        if (!options.silent) {
          setP2pPushMessage(message);
          setError(message);
        }
      } finally {
        if (!options.silent) {
          setP2pPushBusy(false);
        }
      }
      return;
    }
    p2pPollAbortRef.current?.abort();
    p2pPollAbortRef.current = null;
    if (p2pHeartbeatRef.current !== null) {
      window.clearInterval(p2pHeartbeatRef.current);
      p2pHeartbeatRef.current = null;
    }
    if (p2pDrawTimerRef.current !== null) {
      window.clearTimeout(p2pDrawTimerRef.current);
      p2pDrawTimerRef.current = null;
    }
    p2pConnectionsRef.current.forEach((connection) => connection.pc.close());
    p2pConnectionsRef.current.clear();
    updateP2pViewerCount();
    stopMediaStream(p2pRawStreamRef.current);
    if (p2pSendStreamRef.current && p2pSendStreamRef.current !== p2pRawStreamRef.current) {
      stopMediaStream(p2pSendStreamRef.current);
    }
    p2pRawStreamRef.current = null;
    p2pSendStreamRef.current = null;
    const stoppingV2 = p2pV2ModeRef.current;
    await sendP2pSignal({
      kind: "pusher-offline",
      toRole: "viewer",
      payload: { at: Date.now() },
    }).catch(() => undefined);
    if (stoppingV2) {
      await unregisterP2pV2Endpoint();
    }
    const videoElement = p2pPreviewVideoRef.current;
    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }
    setP2pPushRunning(false);
    setP2pV2Active(false);
    setP2pSignalState("idle");
    void refreshP2pRoomSummary();
    if (!options.silent) {
      setP2pPushMessage("P2P 推流已停止");
      setP2pPushBusy(false);
    }
  }

  async function handleStartP2pPush() {
    if (p2pPushBusy) {
      return;
    }

    setP2pPushBusy(true);
    setError("");
    setP2pSignalState("pending");
    try {
      if (tencentCloudPushRunning || tencentCloudPushBusy) {
        throw new Error("腾讯云正在推流，请先停止腾讯云推流");
      }
      if (accessInfo.webMode && !window.isSecureContext) {
        throw new Error("P2P 推流需要 HTTPS 或 localhost，当前入口无法打开摄像头");
      }
      const p2pCameraReady = accessInfo.webMode
        ? browserCameraProbe.status === "available"
        : localStreamStatus.camera_connected;
      if (!p2pCameraReady) {
        throw new Error(accessInfo.webMode ? browserCameraProbe.note || "未检测到可用摄像头" : "未检测到可用摄像头，请先运行本地配置或检查摄像头");
      }

      const requestedConfig = normalizeLocalStreamConfig(
        applyLocalStreamDraftToConfig(localStreamConfig, localStreamDraft),
      );
      setLocalStreamConfig(requestedConfig);
      setLocalStreamDraft(buildLocalStreamDraft(requestedConfig));
      setLocalStreamDirty(false);
      const videoConfig = buildP2pVideoConfig(requestedConfig);
      const endpoint = rememberP2pLink(getActiveP2pEndpoint().watchUrl);
      setP2pRoomDraft(endpoint.watchUrl);
      p2pSignalBaseUrlRef.current = endpoint.signalBaseUrl;
      p2pRoomIdRef.current = endpoint.roomId;

      if (!accessInfo.webMode) {
        if (p2pV2ModeRef.current) {
          throw new Error("P2P V2 当前使用浏览器推流端；本地脚本接入将在 V2 配置规范下单独提供");
        }
        setP2pPushMessage("正在启动本地 P2P 推流脚本...");
        const savedLocalStreamStatus = await saveLocalStreamConfig(requestedConfig);
        const committedConfig = savedLocalStreamStatus.config;
        setLocalStreamStatus(savedLocalStreamStatus);
        setLocalStreamConfig(committedConfig);
        setLocalStreamDraft(buildLocalStreamDraft(committedConfig));
        const nextStatus = await startP2pLocalPusher(committedConfig, endpoint.watchUrl);
        setP2pLocalPusherStatus(nextStatus);
        setP2pPushRunning(nextStatus.running);
        setP2pSignalState(nextStatus.running ? "live" : "pending");
        setP2pViewerCount(0);
        setP2pPushMessage(
          nextStatus.running
            ? `${describeP2pLocalPusherStatus(nextStatus)}，观看地址：${nextStatus.watch_url || endpoint.watchUrl}`
            : nextStatus.message || "P2P 本地脚本已启动，等待确认状态",
        );
        void refreshP2pRoomSummary();
        return;
      }

      await stopP2pPush({ silent: true });
      p2pSinceRef.current = 0;
      p2pPeerIdRef.current = makeP2pPeerId("console-push");

      setP2pPushMessage("正在连接 P2P 信令服务器...");
      await loadP2pSignalConfig();
      setP2pPushMessage("正在打开摄像头...");
      const rawStream = await openP2pCameraStream(videoConfig);
      p2pRawStreamRef.current = rawStream;
      p2pSendStreamRef.current = await buildP2pOutgoingStream(rawStream, videoConfig);
      attachP2pPreviewStream(p2pSendStreamRef.current);

      if (p2pV2ModeRef.current) {
        await registerP2pV2VideoEndpoint(videoConfig);
      }

      setP2pPushRunning(true);
      setP2pV2Active(p2pV2ModeRef.current);
      setP2pSignalState("live");
      void pollP2pMessages(videoConfig);
      if (!p2pV2ModeRef.current) {
        await sendP2pSignal({
          kind: "pusher-online",
          toRole: "viewer",
          payload: { at: Date.now(), video: videoConfig },
        });
      }
      startP2pHeartbeat(videoConfig);
      void refreshP2pRoomSummary();
      setP2pPushMessage(
        p2pV2ModeRef.current
          ? `P2P V2 已注册：房间 ${endpoint.roomId}，端 ${p2pEndpointIdRef.current}，等待定向观看请求`
          : `P2P 推流中：${endpoint.watchUrl}，${videoConfig.outputWidth}x${videoConfig.outputHeight}@${videoConfig.fps} ${videoConfig.bitrateKbps}kbps，等待观看端`,
      );
    } catch (err) {
      if (accessInfo.webMode || !p2pV2ModeRef.current) {
        await stopP2pPush({ silent: true });
      }
      const message = err instanceof Error ? err.message : "P2P 推流启动失败";
      setP2pV2Active(false);
      setP2pPushMessage(message);
      setError(message);
    } finally {
      setP2pPushBusy(false);
    }
  }

  function openP2pViewerDialog() {
    if (p2pPushBusy) {
      return;
    }
    const endpoint = p2pLocalPusherStatus.running && p2pLocalPusherStatus.watch_url
      ? normalizeP2pEndpointInput(p2pLocalPusherStatus.watch_url)
      : getActiveP2pEndpoint();
    setP2pViewError("");
    setP2pViewEndpoint(endpoint);
    setP2pViewRooms([]);
    setP2pViewDialogOpen(true);
    void refreshP2pViewRooms(endpoint);
  }

  function closeP2pViewerDialog() {
    if (p2pPushBusy) {
      return;
    }
    setP2pViewDialogOpen(false);
    setP2pViewError("");
  }

  async function refreshP2pViewRooms(endpoint = p2pViewEndpoint) {
    setP2pViewLoading(true);
    setP2pViewError("");
    try {
      const rooms = await fetchP2pActiveRooms(endpoint.signalBaseUrl);
      setP2pViewRooms(rooms);
      setP2pRoomSummary({ rooms, updatedAt: formatUiLogTimestamp(), error: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "P2P 房间列表加载失败";
      setP2pViewRooms([]);
      setP2pViewError(`房间列表加载失败：${message}`);
      setP2pRoomSummary({ rooms: [], updatedAt: formatUiLogTimestamp(), error: message });
    } finally {
      setP2pViewLoading(false);
    }
  }

  async function openP2pViewerPage(watchUrl: string) {
    const parsed = new URL(watchUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("P2P 观看链接协议无效");
    }
    const resolvedWatchUrl = parsed.toString();
    setP2pPushMessage(`正在打开 P2P 观看页面：${resolvedWatchUrl}`);
    await handleOpenLocalStreamPreview(resolvedWatchUrl);
  }

  function openP2pViewerRoom(roomId: string) {
    const normalizedRoomId = normalizeP2pRoomInput(roomId);
    if (!normalizedRoomId) {
      setP2pViewError("房间 ID 无效");
      return;
    }
    const watchUrl = buildP2pWatchPageUrl(normalizedRoomId, p2pViewEndpoint.signalBaseUrl);
    setP2pViewDialogOpen(false);
    void openP2pViewerPage(watchUrl).catch((err) => {
      const message = err instanceof Error ? err.message : "P2P 观看页面打开失败";
      setP2pViewError(message);
      setError(message);
    });
  }

  function openP2pV2ViewerDialog() {
    if (p2pPushBusy) {
      return;
    }
    const endpoint = getActiveP2pEndpoint();
    setP2pViewEndpoint(endpoint);
    setP2pV2RoomDraft(endpoint.roomId);
    setP2pV2Rooms([]);
    setP2pV2Endpoints([]);
    setP2pV2ViewError("");
    setP2pV2EndpointSummary("正在获取在线房间");
    setP2pV2ViewDialogOpen(true);
    void refreshP2pV2Rooms(endpoint, endpoint.roomId);
  }

  function closeP2pV2ViewerDialog() {
    if (p2pV2ViewLoading) {
      return;
    }
    setP2pV2ViewDialogOpen(false);
    setP2pV2ViewError("");
  }

  async function fetchP2pV2Endpoints(roomId: string, endpoint: P2pEndpoint) {
    const url = new URL(`/api/v2/rooms/${encodeURIComponent(roomId)}/endpoints`, endpoint.signalBaseUrl);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as P2pV2EndpointsResponse;
    return Array.isArray(payload.endpoints) ? payload.endpoints.filter((endpoint) => endpoint.role !== "viewer") : [];
  }

  function applyP2pV2Endpoints(endpoints: P2pV2Endpoint[]) {
    setP2pV2Endpoints(endpoints);
    setP2pV2EndpointSummary(
      endpoints.length > 0
        ? `找到 ${endpoints.length} 个在线端，其中 ${endpoints.filter((item) => item.role === "video-pusher").length} 个可观看`
        : "当前房间没有正在发送请求的端",
    );
  }

  async function refreshP2pV2Rooms(endpoint = p2pViewEndpoint, preferredRoom = p2pV2RoomDraft) {
    setP2pV2ViewLoading(true);
    setP2pV2ViewError("");
    try {
      const rooms = await fetchP2pV2ActiveRooms(endpoint.signalBaseUrl);
      setP2pV2Rooms(rooms);
      setP2pV2RoomSummary({ rooms, updatedAt: formatUiLogTimestamp(), error: "" });
      if (!rooms.length) {
        setP2pV2RoomDraft("");
        setP2pV2Endpoints([]);
        setP2pV2EndpointSummary("当前没有在线的 P2P V2 房间");
        return;
      }
      const normalizedPreferredRoom = normalizeP2pRoomInput(preferredRoom);
      const selectedRoom = rooms.some((item) => item.room === normalizedPreferredRoom)
        ? normalizedPreferredRoom
        : rooms[0].room;
      setP2pV2RoomDraft(selectedRoom);
      applyP2pV2Endpoints(await fetchP2pV2Endpoints(selectedRoom, endpoint));
    } catch (err) {
      const message = err instanceof Error ? err.message : "在线房间加载失败";
      setP2pV2Rooms([]);
      setP2pV2Endpoints([]);
      setP2pV2EndpointSummary("在线房间加载失败");
      setP2pV2ViewError(`在线房间加载失败：${message}`);
      setP2pV2RoomSummary({ rooms: [], updatedAt: formatUiLogTimestamp(), error: message });
    } finally {
      setP2pV2ViewLoading(false);
    }
  }

  async function selectP2pV2Room(roomId: string) {
    setP2pV2RoomDraft(roomId);
    setP2pV2ViewLoading(true);
    setP2pV2ViewError("");
    setP2pV2Endpoints([]);
    setP2pV2EndpointSummary("正在获取房间内的在线端");
    try {
      applyP2pV2Endpoints(await fetchP2pV2Endpoints(roomId, p2pViewEndpoint));
    } catch (err) {
      const message = err instanceof Error ? err.message : "端列表加载失败";
      setP2pV2EndpointSummary("端列表加载失败");
      setP2pV2ViewError(`端列表加载失败：${message}`);
    } finally {
      setP2pV2ViewLoading(false);
    }
  }

  function openP2pV2Endpoint(endpoint: P2pV2Endpoint) {
    if (endpoint.role !== "video-pusher") {
      return;
    }
    const roomId = normalizeP2pRoomInput(p2pV2RoomDraft);
    const watchUrl = buildP2pV2WatchPageUrl(roomId, endpoint.endpointId, p2pViewEndpoint.signalBaseUrl);
    setP2pV2ViewDialogOpen(false);
    void openP2pViewerPage(watchUrl).catch((err) => {
      const message = err instanceof Error ? err.message : "P2P V2 观看页面打开失败";
      setP2pV2ViewError(message);
      setError(message);
    });
  }

  useEffect(() => {
    if (!tencentCloudPushRunning) {
      return undefined;
    }

    const handleVisibleAgain = () => {
      if (document.visibilityState === "visible") {
        restoreTencentCloudPushPreview();
      }
    };
    const handleFocus = () => restoreTencentCloudPushPreview();

    document.addEventListener("visibilitychange", handleVisibleAgain);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibleAgain);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
    };
  }, [tencentCloudPushRunning]);

  useEffect(() => {
    if (activeView !== "localStream" || !tencentCloudPushOpen || !tencentCloudPushRunning) {
      return undefined;
    }

    const timerId = window.setTimeout(() => restoreTencentCloudPushPreview(), 0);
    return () => window.clearTimeout(timerId);
  }, [activeView, tencentCloudPushOpen, tencentCloudPushRunning]);

  useEffect(() => {
    if (activeView !== "localStream" || !tencentCloudPushOpen || !tencentCloudPushRunning) {
      return;
    }
    attachTencentCloudPreviewStream();
  });

  useEffect(() => {
    const handlePageHide = () => {
      const activePushUrl = normalizeTencentCloudUrlInput(tencentCloudActivePushUrlRef.current);
      if (!activePushUrl) {
        return;
      }
      postTencentVideoStatusBeacon("stop", buildTencentCloudVideoStatusPayload(activePushUrl, "page_closed"));
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      stopSetupProgressAnimation();
      clearSetupMessageTimer();
      stopTencentCloudWebPlayer();
      void stopTencentCloudPush({ silent: true });
      void stopP2pPush({ silent: true });
    };
  }, []);

  function renderTrafficMonitorPanel() {
    const nowMs = trafficHistory[trafficHistory.length - 1]?.timestampMs || trafficSnapshot.timestamp_ms || Date.now();
    const windowStartMs = nowMs - TRAFFIC_MONITOR_WINDOW_MS;
    const sampledPoints = trafficHistory.filter((point) => point.timestampMs >= windowStartMs - TRAFFIC_MONITOR_POLL_INTERVAL_MS);
    const latestPoint = sampledPoints[sampledPoints.length - 1] || { timestampMs: nowMs, rxBps: 0, txBps: 0 };
    const chartPoints = sampledPoints.length > 0 ? sampledPoints : [latestPoint];
    const chartWidth = 640;
    const chartHeight = 156;
    const paddingX = 22;
    const paddingY = 18;
    const plotWidth = chartWidth - paddingX * 2;
    const plotHeight = chartHeight - paddingY * 2;
    const trafficWindowPeakBps = Math.max(0, ...chartPoints.map((point) => Math.max(point.rxBps, point.txBps)));
    const yScaleMax = Math.max(1, trafficWindowPeakBps) * 1.22;
    const buildChartPoints = (key: "rxBps" | "txBps") =>
      chartPoints.map((point) => {
        const progress = Math.max(0, Math.min(1, (point.timestampMs - windowStartMs) / TRAFFIC_MONITOR_WINDOW_MS));
        return {
          x: paddingX + progress * plotWidth,
          y: paddingY + plotHeight - Math.min(plotHeight, (point[key] / yScaleMax) * plotHeight),
        };
      });
    const downloadChartPoints = buildChartPoints("rxBps");
    const uploadChartPoints = buildChartPoints("txBps");
    const downloadLinePath = buildSmoothTrafficPath(downloadChartPoints);
    const uploadLinePath = buildSmoothTrafficPath(uploadChartPoints);
    const buildAreaPath = (points: TrafficChartSvgPoint[], linePath: string) => {
      if (!linePath || points.length < 2) {
        return "";
      }
      const firstX = points[0]?.x ?? paddingX;
      const lastX = points[points.length - 1]?.x ?? paddingX + plotWidth;
      return `${linePath} L ${lastX.toFixed(1)} ${paddingY + plotHeight} L ${firstX.toFixed(1)} ${paddingY + plotHeight} Z`;
    };
    const latestDownloadPoint = downloadChartPoints[downloadChartPoints.length - 1];
    const latestUploadPoint = uploadChartPoints[uploadChartPoints.length - 1];
    const windowMinutes = Math.max(1, Math.round(TRAFFIC_MONITOR_WINDOW_MS / 60000));
    const activeServicesLabel = trafficSnapshot.monitored_services > 0
      ? `${trafficSnapshot.active_services} / ${trafficSnapshot.monitored_services}`
      : "-";
    const utilizationLabel =
      typeof trafficSnapshot.utilization_percent === "number" && Number.isFinite(trafficSnapshot.utilization_percent)
        ? `${trafficSnapshot.utilization_percent.toFixed(trafficSnapshot.utilization_percent >= 10 ? 0 : 1)}%`
        : "未知";
    const congestionLevel = trafficMonitorError ? "unknown" : trafficSnapshot.congestion_level || "unknown";
    const congestionText =
      congestionLevel === "danger"
        ? "接近拥塞"
        : congestionLevel === "warning"
          ? "需要观察"
          : congestionLevel === "good"
            ? "运行平稳"
            : congestionLevel === "idle"
              ? "余量充足"
              : "采样中";
    const loadPressure =
      typeof trafficSnapshot.load_1m === "number" &&
      Number.isFinite(trafficSnapshot.load_1m) &&
      typeof trafficSnapshot.cpu_core_count === "number" &&
      Number.isFinite(trafficSnapshot.cpu_core_count) &&
      trafficSnapshot.cpu_core_count > 0
        ? (trafficSnapshot.load_1m / trafficSnapshot.cpu_core_count) * 100
        : null;
    const runtimeMetrics = [
      {
        label: "CPU",
        value: formatMonitorPercent(trafficSnapshot.cpu_percent),
        detail: typeof trafficSnapshot.cpu_percent === "number" ? "实时占用" : "第二次采样后显示",
        progress: normalizeGaugePercent(trafficSnapshot.cpu_percent),
        tone: "cpu",
      },
      {
        label: "内存",
        value: formatMonitorPercent(trafficSnapshot.memory_percent),
        detail: formatMonitorMemory(trafficSnapshot.memory_used_mb, trafficSnapshot.memory_total_mb),
        progress: normalizeGaugePercent(trafficSnapshot.memory_percent),
        tone: "memory",
      },
      {
        label: "负载",
        value: loadPressure === null ? formatMonitorLoad(trafficSnapshot.load_1m) : formatMonitorPercent(loadPressure),
        detail: `1m ${formatMonitorLoad(trafficSnapshot.load_1m)} · ${formatMonitorCoreCount(trafficSnapshot.cpu_core_count)}`,
        progress: normalizeGaugePercent(loadPressure),
        tone: "load",
      },
      {
        label: "磁盘",
        value: formatMonitorPercent(trafficSnapshot.disk_percent),
        detail: formatMonitorDisk(trafficSnapshot.disk_used_gb, trafficSnapshot.disk_total_gb),
        progress: normalizeGaugePercent(trafficSnapshot.disk_percent),
        tone: "disk",
      },
    ];

    return (
      <div className="panel traffic-monitor-panel">
        <div className="traffic-monitor-header">
          <div>
            <div className="section-title">流量监控</div>
            <div className="section-subtitle">视频通信 / 控制信号服务的服务器网卡实时采样</div>
          </div>
          <button
            type="button"
            className={`traffic-health-pill ${congestionLevel}`}
            onClick={() => void refreshTrafficMonitor()}
            title="手动刷新流量采样"
          >
            <span className="traffic-health-dot" aria-hidden="true" />
            {congestionText}
          </button>
        </div>

        <div className="traffic-chart-shell">
          <div className="traffic-chart-topline">
            <span>最近 {windowMinutes} 分钟</span>
            <span>峰值 {formatTrafficRate(trafficWindowPeakBps)}</span>
          </div>
          <svg className="traffic-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="服务器上传下载流量曲线">
            <defs>
              <linearGradient id="traffic-download-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(37, 99, 235, 0.32)" />
                <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
              </linearGradient>
              <linearGradient id="traffic-upload-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(245, 158, 11, 0.3)" />
                <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingY + plotHeight * ratio;
              return (
                <g key={ratio}>
                  <line x1={paddingX} x2={paddingX + plotWidth} y1={y} y2={y} className="traffic-grid-line" />
                  {ratio === 0 || ratio === 0.5 || ratio === 1 ? (
                    <text x={paddingX + 2} y={Math.max(10, y - 4)} className="traffic-axis-label">
                      {formatTrafficAxisLabel(yScaleMax * (1 - ratio))}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const x = paddingX + plotWidth * ratio;
              return <line key={ratio} x1={x} x2={x} y1={paddingY} y2={paddingY + plotHeight} className="traffic-grid-line vertical" />;
            })}
            <path d={buildAreaPath(downloadChartPoints, downloadLinePath)} className="traffic-area download" />
            <path d={buildAreaPath(uploadChartPoints, uploadLinePath)} className="traffic-area upload" />
            <path d={downloadLinePath} className="traffic-line-glow download" />
            <path d={uploadLinePath} className="traffic-line-glow upload" />
            <path d={downloadLinePath} className="traffic-line download" />
            <path d={uploadLinePath} className="traffic-line upload" />
            {latestDownloadPoint ? <circle cx={latestDownloadPoint.x} cy={latestDownloadPoint.y} r="4.6" className="traffic-endpoint download" /> : null}
            {latestUploadPoint ? <circle cx={latestUploadPoint.x} cy={latestUploadPoint.y} r="4.6" className="traffic-endpoint upload" /> : null}
          </svg>
          <div className="traffic-chart-legend">
            <span><i className="download" />下载 {formatTrafficRate(latestPoint.rxBps)}</span>
            <span><i className="upload" />上传 {formatTrafficRate(latestPoint.txBps)}</span>
          </div>
        </div>

        <div className="traffic-stat-grid">
          <div className="traffic-stat-card">
            <span>上传速度</span>
            <strong>{formatTrafficRate(latestPoint.txBps)}</strong>
          </div>
          <div className="traffic-stat-card">
            <span>下载速度</span>
            <strong>{formatTrafficRate(latestPoint.rxBps)}</strong>
          </div>
          <div className="traffic-stat-card">
            <span>当前占用</span>
            <strong>{utilizationLabel}</strong>
          </div>
          <div className="traffic-stat-card">
            <span>估计上限</span>
            <strong>{formatTrafficCapacity(trafficSnapshot.capacity_bps)}</strong>
          </div>
          <div className="traffic-stat-card">
            <span>相关服务</span>
            <strong>{activeServicesLabel}</strong>
          </div>
          <div className="traffic-stat-card">
            <span>累计流量</span>
            <strong>{formatTrafficAmount(trafficSnapshot.rx_bytes + trafficSnapshot.tx_bytes)}</strong>
          </div>
        </div>

        <div className="traffic-runtime-grid" aria-label="服务器实时参数">
          {runtimeMetrics.map((metric) => (
            <div className={`traffic-runtime-card ${metric.tone}`} key={metric.label}>
              <div className="traffic-gauge" aria-hidden="true">
                <svg viewBox="0 0 100 100" focusable="false">
                  <circle className="traffic-gauge-track" cx="50" cy="50" r="42" pathLength={100} />
                  <circle
                    className="traffic-gauge-value"
                    cx="50"
                    cy="50"
                    r="42"
                    pathLength={100}
                    strokeDasharray={`${metric.progress ?? 0} ${100 - (metric.progress ?? 0)}`}
                  />
                </svg>
                <strong>{metric.value}</strong>
              </div>
              <div className="traffic-runtime-copy">
                <span>{metric.label}</span>
                <small>{metric.detail}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="traffic-monitor-note">
          {trafficMonitorError || trafficSnapshot.congestion_note || "正在采样服务器实时流量"}
        </div>
      </div>
    );
  }

  function renderPortPanel() {
    return (
      <div className="panel port-panel">
        <div className="port-panel-header">
          <div>
            <div className="section-title">端口检测</div>
            <div className="section-subtitle">按需检测关键端口连通性，不做持续监听</div>
          </div>
          <Button
            variant="secondary"
            loading={portBusyKey === "all"}
            disabled={busy || (!!portBusyKey && portBusyKey !== "all")}
            onClick={handleCheckAllPorts}
          >
            检测全部
          </Button>
        </div>

        <div className="port-grid">
          {portChecks.map((portCheck) => (
            <div className="port-tile" key={portCheck.key}>
              <div className="port-tile-main">
                <div>
                  <div className="port-title">{portCheck.title}</div>
                  <div className="port-meta">
                    {portCheck.port} / {portCheck.protocol}
                  </div>
                </div>
                <span className={`port-lamp ${lampClassForPort(portCheck)}`} title={portCheck.title} />
              </div>
              <div className="port-tile-actions">
                <Button
                  variant="ghost"
                  loading={portBusyKey === portCheck.key}
                  disabled={busy || (!!portBusyKey && portBusyKey !== portCheck.key)}
                  onClick={() => handleCheckPort(portCheck.key)}
                >
                  检测
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderVideoPushStatusCard() {
    const p2pRoomCount = p2pRoomSummary.rooms.length;
    const p2pV2VideoRooms = p2pV2RoomSummary.rooms.filter((room) => Number(room.videoPusherCount || 0) > 0);
    const p2pPushedByThisMachine = Boolean(
      (p2pPushRunning && !p2pV2Active) || (!accessInfo.webMode && p2pLocalPusherStatus.running),
    );
    const p2pV2PushedByThisMachine = Boolean(p2pPushRunning && p2pV2Active);
    const p2pDisplayedRoomCount = Math.max(p2pRoomCount, p2pPushedByThisMachine ? 1 : 0);
    const p2pV2DisplayedRoomCount = Math.max(p2pV2VideoRooms.length, p2pV2PushedByThisMachine ? 1 : 0);
    const p2pActive = p2pDisplayedRoomCount > 0;
    const p2pV2ActiveNow = p2pV2DisplayedRoomCount > 0;
    const combinedActiveModeCount = Number(p2pActive) + Number(p2pV2ActiveNow);
    const summaryReadFailed = Boolean(p2pRoomSummary.error && p2pV2RoomSummary.error);
    const headline = summaryReadFailed
      ? "读取失败"
      : status.connected
        ? combinedActiveModeCount > 1
          ? "多链路推流"
          : p2pActive
            ? "P2P推流"
            : p2pV2ActiveNow
              ? "P2P V2推流"
              : "未推流"
        : "未连接";
    const note = summaryReadFailed
      ? `P2P：${p2pRoomSummary.error}；P2P V2：${p2pV2RoomSummary.error}`
      : videoPushStatusUpdatedAt
        ? `每 5 秒刷新 · 最近 ${videoPushStatusUpdatedAt}`
        : status.connected
          ? "正在读取服务器推流状态"
          : "连接服务器后显示推流状态";
    const p2pLampClass = p2pPushedByThisMachine ? "local" : p2pActive ? "live" : p2pRoomSummary.error ? "pending" : "off";
    const p2pV2LampClass = p2pV2PushedByThisMachine
      ? "local"
      : p2pV2ActiveNow
        ? "live"
        : p2pV2RoomSummary.error
          ? "pending"
          : "off";
    const p2pSummaryLabel = p2pActive ? `${p2pDisplayedRoomCount} 个房间` : p2pRoomSummary.error ? "读取失败" : "无房间";
    const p2pV2SummaryLabel = p2pV2ActiveNow
      ? `${p2pV2DisplayedRoomCount} 个房间`
      : p2pV2RoomSummary.error
        ? "读取失败"
        : "无房间";
    const p2pSummaryNote = p2pPushedByThisMachine
      ? "本机正在 P2P 推流"
      : p2pActive
        ? "当前域名有房间正在直播"
        : p2pRoomSummary.error
          ? p2pRoomSummary.error
          : "当前没有正在推流的房间";
    const p2pV2SummaryNote = p2pV2PushedByThisMachine
      ? "本机正在 P2P V2 推流"
      : p2pV2ActiveNow
        ? "当前域名有 V2 视频房间"
        : p2pV2RoomSummary.error
          ? p2pV2RoomSummary.error
          : "当前没有正在推流的视频房间";
    const headlineClass =
      !status.connected
        ? "offline"
        : combinedActiveModeCount > 1
        ? "conflict"
        : combinedActiveModeCount === 0
          ? "offline"
          : summaryReadFailed
            ? "error"
            : "active";

    return (
      <div className="panel summary-card video-push-summary-card">
        <div className="summary-card-title">视频推流状态</div>
        <div className={`summary-card-value video-push-summary-value ${headlineClass}`}>{headline}</div>
        <div className="video-push-mode-grid">
          <button className="video-push-mode-row" type="button" onClick={openP2pViewerDialog}>
            <span className={`local-stream-signal-lamp ${p2pLampClass}`} aria-hidden="true" />
            <div>
              <span>P2P</span>
              <strong>{p2pSummaryLabel}</strong>
              <small>{p2pSummaryNote}</small>
            </div>
          </button>
          <button className="video-push-mode-row" type="button" onClick={openP2pV2ViewerDialog}>
            <span className={`local-stream-signal-lamp ${p2pV2LampClass}`} aria-hidden="true" />
            <div>
              <span>P2P V2</span>
              <strong>{p2pV2SummaryLabel}</strong>
              <small>{p2pV2SummaryNote}</small>
            </div>
          </button>
        </div>
        <div className="summary-card-note">{note}</div>
      </div>
    );
  }

  function renderControlSignalStatusCard() {
    const linkStatus = readOverviewControlLinkStatus(status);
    const headline = controlSignalHeadline(status.connected, linkStatus);
    const frontendRequestCount = controlSignalCounterBaseline
      ? counterDelta(linkStatus.browserPosts, controlSignalCounterBaseline.browserPosts)
      : null;
    const backendHeartbeatCount = controlSignalCounterBaseline
      ? counterDelta(linkStatus.robotPolls, controlSignalCounterBaseline.robotPolls)
      : null;
    const frontendNote =
      frontendRequestCount !== null
        ? `${linkStatus.activeClientCount} 个前端在线 · 请求 ${frontendRequestCount} 次`
        : linkStatus.activeClientCount > 0 ? `${linkStatus.activeClientCount} 个前端在线` : "等待前端操作";
    const backendAge = formatControlSignalAge(linkStatus.robotListenerAgeMs ?? linkStatus.robotPollAgeMs);
    const backendNote =
      backendHeartbeatCount !== null
        ? `心跳 ${backendHeartbeatCount} 次${backendAge ? ` · 最近 ${backendAge}` : ""}`
        : backendAge ? `最近心跳 ${backendAge}` : "等待后端监听";

    return (
      <button
        type="button"
        className="panel summary-card summary-card-button video-push-summary-card control-signal-summary-card"
        onClick={() => void handleRefreshControlSignalSummary()}
        title="手动刷新控制信号状态"
      >
        <div className="summary-card-title">控制信号状态</div>
        <div className="summary-card-value control-signal-summary-value">{headline}</div>
        <div className="video-push-mode-grid control-signal-summary-grid">
          <div className="video-push-mode-row control-signal-summary-row">
            <span className={`local-stream-signal-lamp ${controlSignalFrontendLamp(status.connected, linkStatus)}`} aria-hidden="true" />
            <div>
              <span>前端</span>
              <strong>{controlSignalFrontendLabel(status.connected, linkStatus)}</strong>
              <small>{frontendNote}</small>
            </div>
          </div>
          <div className="video-push-mode-row control-signal-summary-row">
            <span className={`local-stream-signal-lamp ${controlSignalBackendLamp(status.connected, linkStatus)}`} aria-hidden="true" />
            <div>
              <span>后端</span>
              <strong>{controlSignalBackendLabel(status.connected, linkStatus)}</strong>
              <small>{backendNote}</small>
            </div>
          </div>
        </div>
        <div className="summary-card-note">{controlSignalSummaryNote(status.connected, linkStatus, controlSignalCounterBaseline)}</div>
      </button>
    );
  }

  function renderOverview() {
    return (
      <>
        <section className="hero-banner">
          <div>
            <div className="hero-eyebrow">Robot Cloud Services</div>
            <h2>统一管理机械臂云端视频与控制服务</h2>
            <p>
              这里集中管理 go2rtc 云端入口、SRT bridge、控制 signaling 与 Nginx 网关，并提供 SSH 登录、启停、健康检查和运行日志。
            </p>
          </div>
          <div className="hero-actions">
            <Button
              variant="primary"
              loading={busy}
              disabled={!canRunAdminActions || busy}
              onClick={() => withAction(startAllServices, { focusActivity: true, debugLabel: "启动全部服务" })}
            >
              启动全部
            </Button>
            <Button
              variant="danger"
              disabled={!canRunAdminActions || busy}
              onClick={() => withAction(stopAllServices, { focusActivity: true, debugLabel: "停止全部服务" })}
            >
              停止全部
            </Button>
          </div>
        </section>

        <section className="summary-grid overview-status-grid">
          <Suspense
            fallback={(
              <div className="panel summary-card p2p-topology-card p2p-topology-loading">
                <span>正在加载 P2P V2 通信拓扑</span>
              </div>
            )}
          >
            <P2pCommunicationTopology signalBaseUrl={p2pViewEndpoint.signalBaseUrl} theme={theme} />
          </Suspense>
          {renderVideoPushStatusCard()}
          {renderControlSignalStatusCard()}
        </section>

        <section className="metric-grid">
          <MetricCard
            variant="service"
            title="服务运行数"
            value={status.service_running_count}
            subtitle="当前运行中的远端服务"
            onClick={() => setActiveView("services")}
          />
          <MetricCard
            variant="health"
            title="健康检查"
            value={status.health_ok_count}
            subtitle="当前可访问的检查端点"
            onClick={() => setActiveView("health")}
          />
          <MetricCard variant="refresh" title="最近刷新" value={status.last_refresh} subtitle="最后一次同步时间" />
        </section>

        <section className="detail-view-grid">
          {renderTrafficMonitorPanel()}
          <HealthPanel checks={status.health_checks} />
        </section>
      </>
    );
  }

  function renderServices() {
    const previewActive = Boolean(cloudVideoTargetValue);
    const previewReady = videoTransport === "webrtc";
    const cloudVideoOptions = cloudVideoTargets.map((target) => ({
      value: target.value,
      label: target.roomId,
      description: target.displayName === target.endpointId
        ? `视频推流端 · ${target.endpointId}`
        : `${target.displayName} · ${target.endpointId}`,
    }));
    const pressedControlKeysSet = new Set(controlMonitorPressedKeys);
    const activeControlMonitorClients = controlMonitorClients;
    const controlMonitorClientsByKey = new Map<string, ControlMonitorColoredClient[]>();
    for (const client of activeControlMonitorClients) {
      for (const keyName of client.pressedKeys) {
        const current = controlMonitorClientsByKey.get(keyName) ?? [];
        current.push(client);
        controlMonitorClientsByKey.set(keyName, current);
      }
    }
    const controlMonitorLampClass = !controlMonitorEnabled
      ? "idle"
      : controlMonitorConnected
        ? "live"
        : controlMonitorPeerState === "error"
          ? "off"
          : "pending";
    const controlMonitorFrontendDialLampClass = !controlMonitorEnabled
      ? "idle"
      : controlMonitorLinkStatus.frontendDialing
        ? controlMonitorLinkStatus.directConnected
          ? "live"
          : "pending"
        : controlMonitorPeerState === "error"
          ? "off"
          : "idle";
    const controlMonitorBackendListenLampClass = !controlMonitorEnabled
      ? "idle"
      : controlMonitorLinkStatus.backendListening
        ? controlMonitorLinkStatus.directConnected
          ? "live"
          : "pending"
        : controlMonitorPeerState === "error"
          ? "off"
          : "idle";
    const controlMonitorDirectLampClass = !controlMonitorEnabled
      ? "idle"
      : controlMonitorLinkStatus.frontendDialing && controlMonitorLinkStatus.backendListening && controlMonitorLinkStatus.directConnected
        ? "live"
        : controlMonitorPeerState === "error"
          ? "off"
          : "idle";
    const commandUserPendingOffers =
      controlMonitorCommandLinkStatus.userPendingOffers ?? controlMonitorCommandLinkStatus.pendingOffers;
    const controlMonitorFirstHopConnected =
      controlMonitorLinkStatus.frontendDialing && controlMonitorLinkStatus.backendListening && controlMonitorLinkStatus.directConnected;
    const controlMonitorSecondHopConnected =
      controlMonitorCommandLinkStatus.frontendDialing &&
      controlMonitorCommandLinkStatus.backendListening &&
      controlMonitorCommandLinkStatus.directConnected;
    const controlMonitorEndToEndConnected = controlMonitorFirstHopConnected && controlMonitorSecondHopConnected;
    const controlMonitorComputeDialLampClass = !controlMonitorEnabled
      ? "idle"
      : controlMonitorCommandLinkStatus.frontendDialing ||
          controlMonitorCommandLinkStatus.pendingOffers > 0
        ? controlMonitorCommandLinkStatus.directConnected
          ? "live"
          : "pending"
        : controlMonitorPeerState === "error"
          ? "off"
          : "idle";
    const controlMonitorArmListenLampClass = !controlMonitorEnabled
      ? "idle"
      : controlMonitorCommandLinkStatus.backendListening
        ? controlMonitorCommandLinkStatus.directConnected
          ? "live"
          : "pending"
        : controlMonitorPeerState === "error"
          ? "off"
          : "idle";
    const controlMonitorCommandDirectLampClass = !controlMonitorEnabled
      ? "idle"
      : controlMonitorEndToEndConnected
        ? "live"
        : controlMonitorPeerState === "error"
          ? "off"
          : "idle";
    const controlMonitorInputModeLabel = chooseControlMonitorInputMode(activeControlMonitorClients);
    const controlMonitorUserPendingOffers =
      controlMonitorLinkStatus.userPendingOffers ?? controlMonitorLinkStatus.pendingOffers;
    const controlMonitorFrontendLampNote =
      controlMonitorLinkStatus.directConnected
        ? `${controlMonitorLinkStatus.connectedClientCount || activeControlMonitorClients.length} connected`
        : controlMonitorUserPendingOffers > 0
        ? `${controlMonitorUserPendingOffers} pending`
        : controlMonitorLinkStatus.dialingClientCount > 0
            ? `${controlMonitorLinkStatus.dialingClientCount} dialing`
        : "0 dialing";
    const robotPollFreshMs = Math.max(
      0,
      controlMonitorLinkStatus.robotListenerFreshMs || controlMonitorLinkStatus.robotPollFreshMs || 0,
    );
    const robotPollFresh =
      typeof controlMonitorLinkStatus.robotPollAgeMs === "number" &&
      Number.isFinite(controlMonitorLinkStatus.robotPollAgeMs) &&
      (!robotPollFreshMs || controlMonitorLinkStatus.robotPollAgeMs <= robotPollFreshMs);
    const controlMonitorBackendLampNote = controlMonitorLinkStatus.backendListening
      ? controlMonitorLinkStatus.directConnected
        ? "connected"
        : robotPollFresh
          ? "listening"
          : "listener held"
      : "offline";
    const controlMonitorDirectLampNote =
      controlMonitorFirstHopConnected
        ? "online"
        : "offline";
    const commandRobotPollFreshMs = Math.max(
      0,
      controlMonitorCommandLinkStatus.robotListenerFreshMs || controlMonitorCommandLinkStatus.robotPollFreshMs || 0,
    );
    const commandRobotPollFresh =
      typeof controlMonitorCommandLinkStatus.robotPollAgeMs === "number" &&
      Number.isFinite(controlMonitorCommandLinkStatus.robotPollAgeMs) &&
      (!commandRobotPollFreshMs || controlMonitorCommandLinkStatus.robotPollAgeMs <= commandRobotPollFreshMs);
    const controlMonitorComputeDialLampNote =
      controlMonitorCommandLinkStatus.directConnected
        ? "connected"
      : commandUserPendingOffers > 0 || controlMonitorCommandLinkStatus.pendingOffers > 0
        ? `${controlMonitorCommandLinkStatus.pendingOffers} pending`
      : controlMonitorCommandLinkStatus.browserPosts > 0
        ? "last offer ended"
      : "0 dialing";
    const controlMonitorArmListenLampNote = controlMonitorCommandLinkStatus.backendListening
      ? commandRobotPollFresh
        ? "listening"
        : "listener held"
      : "offline";
    const controlMonitorCommandDirectLampNote =
      controlMonitorEndToEndConnected
        ? "online"
        : "offline";
    const previewOverlayTitle = !cloudVideoTargetValue
      ? cloudVideoTargets.length > 0
        ? "请选择在线推流"
        : "当前没有在线推流"
      : videoTransport === "connecting"
        ? "正在连接 P2P V2 视频"
        : videoTransport === "error"
          ? "P2P V2 视频连接失败"
          : "P2P V2 视频已连接";
    const previewOverlayNote = !cloudVideoTargetValue ? cloudVideoCatalogStatus : videoStatus;

    return (
      <section className="service-view-grid">
        <div className="service-view-main">
          <div className="service-view-header">
            <div className="section-heading">
              <div className="section-title">云端服务</div>
              <div className="section-subtitle">查看 systemd 服务状态并直接启停</div>
            </div>
            <div className="hero-actions">
              <Button
                variant="primary"
                loading={busy}
                disabled={!canRunAdminActions || busy}
                onClick={() => withAction(startAllServices, { focusActivity: true, debugLabel: "启动全部服务" })}
              >
                启动全部
              </Button>
              <Button
                variant="danger"
                disabled={!canRunAdminActions || busy}
                onClick={() => withAction(stopAllServices, { focusActivity: true, debugLabel: "停止全部服务" })}
              >
                停止全部
              </Button>
            </div>
          </div>

          <div className="service-grid">
            {status.services.map((service) => (
              <ServiceCard
                key={service.name}
                service={service}
                busy={busy}
                canControl={canRunAdminActions}
                onStart={(name) => withAction(() => startService(name))}
                onStop={(name) => withAction(() => stopService(name))}
              />
            ))}
          </div>
        </div>

        <div className="service-view-side">
          <div className="panel video-panel">
            <div className="video-panel-header">
              <div>
                <div className="section-title">云端视频窗口</div>
                <div className="section-subtitle">选择 P2P V2 在线房间与视频推流端</div>
              </div>
              <AppSelect
                className="cloud-video-select"
                label="在线 P2P V2 推流"
                value={cloudVideoTargetValue}
                options={cloudVideoOptions}
                placeholder={cloudVideoTargets.length > 0 ? "选择房间与推流端" : "当前没有在线推流"}
                disabled={cloudVideoTargets.length === 0}
                onChange={setCloudVideoTargetValue}
              />
            </div>

            <div
              className={`video-stage ${previewActive ? "live" : "off"}`}
              style={{ aspectRatio: videoAspectRatio }}
            >
              {previewActive ? (
                <video
                  className="video-iframe"
                  ref={previewVideoRef}
                  title="云端视频预览"
                  autoPlay
                  muted
                  playsInline
                />
              ) : null}
              <div className={`video-stage-overlay ${previewReady ? "compact" : ""}`}>
                <div className="video-stage-overlay-title">{previewOverlayTitle}</div>
                <div className="video-stage-overlay-note">{previewOverlayNote}</div>
              </div>
            </div>
            <div className="section-subtitle">
              {cloudVideoTargetValue ? `P2P V2 · ${videoStatus}` : cloudVideoCatalogStatus}
            </div>
          </div>

          <div className="panel control-monitor-panel">
            <div className="video-panel-header">
              <div>
                <div className="section-title">控制监视键盘</div>
                <div className="section-subtitle">Side-channel monitor only; it does not answer or consume robot WebRTC offers.</div>
              </div>
              <ToggleSwitch
                checked={controlMonitorEnabled}
                size="lg"
                ariaLabel="toggle control monitor"
                disabled={busy || !status.connected}
                onClick={() => setControlMonitorEnabled((current) => !current)}
              />
            </div>

            <div className="control-monitor-stage">
              <div className="control-monitor-status-card">
                <div className="control-monitor-status-row">
                  <span className={`control-monitor-lamp ${controlMonitorLampClass}`} />
                  <div className="control-monitor-status-copy">
                    <div className="control-monitor-status-title">{controlMonitorStatus}</div>
                    <div className="control-monitor-status-note">
                      {controlMonitorEnabled
                        ? `session=${controlMonitorSession} | clients=${activeControlMonitorClients.length} | state=${controlMonitorPeerState}`
                        : "关闭时不会占用控制会话"}
                    </div>
                  </div>
                </div>

                <div className="control-monitor-link-lamps" aria-label="control monitor link status">
                  <div className={`control-monitor-link-lamp ${controlMonitorFrontendDialLampClass}`}>
                    <span className={`control-monitor-lamp ${controlMonitorFrontendDialLampClass}`} />
                    <span>前端拨号</span>
                    <strong>{controlMonitorFrontendLampNote}</strong>
                  </div>
                  <div className={`control-monitor-link-lamp ${controlMonitorBackendListenLampClass}`}>
                    <span className={`control-monitor-lamp ${controlMonitorBackendListenLampClass}`} />
                    <span>计算服务器接听</span>
                    <strong>{controlMonitorBackendLampNote}</strong>
                  </div>
                  <div className={`control-monitor-link-lamp ${controlMonitorDirectLampClass}`}>
                    <span className={`control-monitor-lamp ${controlMonitorDirectLampClass}`} />
                    <span>前端到计算服务器</span>
                    <strong>{controlMonitorDirectLampNote}</strong>
                  </div>
                  <div className={`control-monitor-link-lamp ${controlMonitorComputeDialLampClass}`}>
                    <span className={`control-monitor-lamp ${controlMonitorComputeDialLampClass}`} />
                    <span>计算服务器拨号</span>
                    <strong>{controlMonitorComputeDialLampNote}</strong>
                  </div>
                  <div className={`control-monitor-link-lamp ${controlMonitorArmListenLampClass}`}>
                    <span className={`control-monitor-lamp ${controlMonitorArmListenLampClass}`} />
                    <span>机械臂接听</span>
                    <strong>{controlMonitorArmListenLampNote}</strong>
                  </div>
                  <div className={`control-monitor-link-lamp ${controlMonitorCommandDirectLampClass}`}>
                    <span className={`control-monitor-lamp ${controlMonitorCommandDirectLampClass}`} />
                    <span>直连成功</span>
                    <strong>{controlMonitorCommandDirectLampNote}</strong>
                  </div>
                </div>
              </div>

              <div
                className="control-monitor-keyboard"
                ref={controlMonitorKeyboardRef}
                aria-label="control monitor keyboard"
                style={
                  {
                    "--control-monitor-track-width": controlMonitorKeyboardTrackWidth
                      ? `${controlMonitorKeyboardTrackWidth}px`
                      : "auto",
                    "--control-monitor-key-size": `${controlMonitorKeyboardKeySize}px`,
                    "--control-monitor-key-gap": `${controlMonitorKeyboardKeyGap}px`,
                  } as React.CSSProperties
                }
              >
                <div className="control-monitor-keyboard-track">
                  {CONTROL_MONITOR_KEY_ROWS.map((row) => {
                    const visibleKeys = row.keys.slice(0, controlMonitorVisibleColumns);
                    return (
                      <div
                        className="control-monitor-key-row"
                        key={row.keys.join("")}
                        style={
                          {
                            "--control-monitor-row-offset": row.offset,
                            "--control-monitor-visible-keys": visibleKeys.length,
                          } as React.CSSProperties
                        }
                      >
                        {visibleKeys.map((keyName) => {
                          const keyClients = controlMonitorClientsByKey.get(keyName) ?? [];
                          const keyGradient = buildControlMonitorKeyGradient(keyClients);
                          const keyGlow = buildControlMonitorKeyGlow(keyClients);
                          return (
                            <div
                              className={`control-monitor-key ${pressedControlKeysSet.has(keyName) ? "active" : ""}`}
                              key={keyName}
                              style={{
                                "--control-key-gradient": keyGradient,
                                "--control-key-glow": keyGlow,
                              } as React.CSSProperties}
                            >
                              <span className="control-monitor-key-label">{keyName}</span>
                              {keyClients.length > 1 ? (
                                <span className="control-monitor-key-stack">{keyClients.length}</span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="control-monitor-meta">
                <span>{`已收消息 ${controlMonitorMessageCount}`}</span>
                <span>{`Mode ${controlMonitorInputModeLabel}`}</span>
                <span>{controlMonitorPressedKeys.length ? `当前按键 ${controlMonitorPressedKeys.join(" ")}` : "当前按键 -"}</span>
                <span>{`Frontends ${activeControlMonitorClients.length}`}</span>
                <span>{controlMonitorLastEventAt ? `最近更新 ${controlMonitorLastEventAt}` : "最近更新 -"}</span>
              </div>

              <div className="control-monitor-clients" aria-label="control monitor clients">
                {activeControlMonitorClients.length ? (
                  activeControlMonitorClients.map((client) => (
                    <div
                      className="control-monitor-client-row"
                      key={client.clientId}
                      style={{
                        "--control-client-start": client.colorStart,
                        "--control-client-end": client.colorEnd,
                        "--control-client-glow": client.colorGlow,
                      } as React.CSSProperties}
                    >
                      <div className="control-monitor-client-main">
                        <span className="control-monitor-client-swatch" aria-hidden="true" />
                        <span className="control-monitor-client-id">{formatControlMonitorClientLabel(client)}</span>
                        <span className="control-monitor-client-color">{client.colorLabel}</span>
                        <span className="control-monitor-client-age">{formatControlMonitorInputMode(client.inputMode)}</span>
                        <span className="control-monitor-client-age">{formatControlMonitorAge(client.ageMs)}</span>
                      </div>
                      <div className="control-monitor-client-keys">
                        {client.pressedKeys.length ? client.pressedKeys.join(" ") : "-"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="control-monitor-client-empty">Waiting for frontend key-state reports</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderHealth() {
    return (
      <section className="dashboard-left">
        {renderPortPanel()}
        <HealthPanel checks={status.health_checks} />
      </section>
    );
  }

  function renderActivity() {
    return (
      <section className="activity-log-layout">
        <ActivityLog
          title="本地调试日志"
          subtitle="记录本地刷新、一键配置与界面触发流程。"
          emptyLabel="本地调试日志暂时还没有记录。"
          logs={debugLogs}
        />
        <ActivityLog
          title="本地后端日志"
          subtitle="桌面后端输出的服务、检测与配置日志。"
          emptyLabel="本地后端日志暂时还没有输出。"
          logs={backendLogs}
        />
      </section>
    );
  }

  function renderLocalStream() {
    const webLocalStreamMode = accessInfo.webMode;
    const browserCameraAvailable = browserCameraProbe.status === "available";
    const browserCameraOptions = browserCameraAvailable
      ? [
          {
            id: "browser-camera",
            name: browserCameraProbe.label || "浏览器默认摄像头",
            source: "browser",
            status: "available",
          },
        ]
      : [];
    const cameraOptions = webLocalStreamMode ? browserCameraOptions : localStreamStatus.cameras;
    const cameraConnected = webLocalStreamMode ? browserCameraAvailable : localStreamStatus.camera_connected;
    const serverReachable = webLocalStreamMode ? status.connected : localStreamStatus.server_reachable;
    const streamReady =
      !webLocalStreamMode &&
      (localStreamStatus.local_stream_ready ||
        (localStreamStatus.camera_connected && localStreamStatus.server_reachable && localStreamStatus.ffmpeg_available));
    const localToolReady = !webLocalStreamMode && localStreamStatus.ffmpeg_available;
    const currentServerLocked = localStreamConfig.use_current_server;
    const inputSize = parseLocalStreamSize(localStreamConfig.video_size);
    const outputSize = parseLocalStreamSize(localStreamConfig.output_video_size, inputSize.width, inputSize.height);
    const bitrateKbps = parseLocalStreamBitrateKbps(localStreamConfig.video_bitrate);
    const legacyRemotePreviewReady = Boolean(videoPushStatus?.legacy?.live);
    const localStreamPreviewReady = (!webLocalStreamMode && localStreamStatus.push_visible) || legacyRemotePreviewReady;
    const localStreamPreviewUrl = buildLocalStreamViewerUrl(localStreamStatus.config, status.public_base_url);
    const localStreamOccupiedByOther = !webLocalStreamMode && localStreamStatus.push_visible && !localStreamStatus.running;
    const localStreamPreviewDisabled = localStreamBusy || localStreamSetupBusy || !localStreamPreviewReady;
    const restoredTencentCloudPushUrl = readTencentCloudPushSession();
    const tencentCloudStatusPushHost = String(videoPushStatus?.tencent?.pushUrlHost || "").trim();
    const restoredTencentCloudPushHost = parseTencentCloudPushUrl(restoredTencentCloudPushUrl).pushUrlHost;
    const tencentCloudRestorableByThisBrowser = Boolean(
      webLocalStreamMode &&
        videoPushStatus?.tencent?.live &&
        restoredTencentCloudPushUrl &&
        (!tencentCloudStatusPushHost || !restoredTencentCloudPushHost || tencentCloudStatusPushHost === restoredTencentCloudPushHost),
    );
    const tencentCloudOccupiedByOther =
      webLocalStreamMode &&
      Boolean(videoPushStatus?.tencent?.live) &&
      !tencentCloudPushRunning &&
      !tencentCloudRestorableByThisBrowser;
    const tencentCloudStatusPlayUrl = normalizeTencentCloudUrlInput(videoPushStatus?.tencent?.playUrl || "");
    const tencentCloudViewerUrl =
      tencentCloudStatusPlayUrl ||
      normalizeTencentCloudUrlInput(tencentCloudPlayUrl) ||
      readSavedTencentCloudPlayUrl() ||
      (videoPushStatus?.tencent?.live ? buildTencentCloudDefaultPlayUrl(status, videoPushStatus.tencent.streamName || "robot_control") : "");
    const tencentCloudViewerReady = Boolean((tencentCloudPushRunning || videoPushStatus?.tencent?.live) && tencentCloudViewerUrl);
    const localStreamStartDisabled =
      webLocalStreamMode || !streamReady || localStreamBusy || localStreamSetupBusy || localStreamOccupiedByOther;
    const localStreamStartTooltip = webLocalStreamMode
      ? "网页端暂不支持旧链路推流，请使用腾讯云或 P2P 推流"
      : localStreamOccupiedByOther
      ? "其他人正在推流"
      : !streamReady
        ? "本地推流尚未就绪"
        : undefined;
    const localStreamActionIsStopping = !webLocalStreamMode && localStreamStatus.running;
    const localStreamActionDisabled = localStreamActionIsStopping
      ? localStreamSetupBusy || localStreamBusy
      : localStreamStartDisabled;
    const localStreamActionTooltip = localStreamActionIsStopping ? undefined : localStreamStartTooltip;
    const webTencentCloudPushBlockedReason =
      tencentCloudOccupiedByOther
        ? "其他人正在腾讯云推流"
        : webLocalStreamMode && !window.isSecureContext
        ? "当前网页不是 HTTPS，浏览器不会开放摄像头/屏幕采集权限"
        : webLocalStreamMode && tencentCloudPushSource === "camera" && !browserCameraAvailable
          ? browserCameraProbe.note || "未检测到可用摄像头"
          : "";
    const tencentCloudPushStartDisabled =
      tencentCloudPushBusy || tencentCloudPushRunning || Boolean(webTencentCloudPushBlockedReason);
    const tencentCloudPushActionIsStopping = tencentCloudPushRunning || tencentCloudRestorableByThisBrowser;
    const tencentCloudPushActionDisabled = tencentCloudPushActionIsStopping
      ? tencentCloudPushBusy
      : tencentCloudPushStartDisabled;
    const tencentCloudPushActionTooltip = !tencentCloudPushActionIsStopping ? webTencentCloudPushBlockedReason || undefined : undefined;
    const tencentCloudConfigActive = tencentCloudPushOpen || tencentCloudPushRunning;
    const p2pConfigActive = p2pPushOpen || p2pV2PushOpen || p2pPushRunning;
    const webPushConfigActive = tencentCloudConfigActive || p2pConfigActive;
    const legacyOnlyControlsDisabled = webPushConfigActive;
    const browserPushControlsDisabled = tencentCloudPushBusy || tencentCloudPushRunning || p2pPushBusy || p2pPushRunning;
    const p2pPushActionIsStopping = p2pPushRunning;
    const p2pCameraReady = webLocalStreamMode
      ? browserCameraProbe.status === "available"
      : cameraConnected;
    const p2pPushActionDisabled = p2pPushActionIsStopping
      ? p2pPushBusy
      : p2pPushBusy || tencentCloudPushBusy || tencentCloudPushRunning || (webLocalStreamMode && !window.isSecureContext) || !p2pCameraReady;
    const p2pPushActionTooltip = !p2pPushActionIsStopping
      ? tencentCloudPushBusy || tencentCloudPushRunning
        ? "腾讯云正在推流，请先停止腾讯云推流"
        : webLocalStreamMode && !window.isSecureContext
        ? "P2P 推流需要 HTTPS 或 localhost"
        : !p2pCameraReady
          ? webLocalStreamMode
            ? browserCameraProbe.note || "未检测到可用摄像头"
            : "未检测到可用摄像头，请先运行本地配置或检查摄像头"
          : undefined
      : undefined;
    const legacyOnlyFieldClass = legacyOnlyControlsDisabled ? "field local-stream-field-disabled" : "field";
    const legacyOnlyToggleClass = legacyOnlyControlsDisabled
      ? "toggle-line local-stream-toggle local-stream-field-disabled"
      : "toggle-line local-stream-toggle";
    const legacyOnlyFieldTitle = legacyOnlyControlsDisabled
      ? p2pConfigActive
        ? webLocalStreamMode
          ? "网页 P2P 推流不使用此项"
          : "P2P 本地脚本推流不使用此项"
        : "腾讯云推流不使用此项"
      : undefined;
    const p2pLocalEncoderEnabled = p2pConfigActive && !webLocalStreamMode;
    const encoderFieldDisabled = browserPushControlsDisabled || (legacyOnlyControlsDisabled && !p2pLocalEncoderEnabled);
    const browserOutputLabelClass = browserPushControlsDisabled ? "field local-stream-field-disabled" : "field";
    const p2pLocalProfile = p2pLocalPusherStatus.active_profile || {};
    const p2pLocalProfileWidth = Number(p2pLocalProfile.outputWidth || p2pLocalProfile.captureWidth || 0);
    const p2pLocalProfileHeight = Number(p2pLocalProfile.outputHeight || p2pLocalProfile.captureHeight || 0);
    const p2pLocalProfileFps = Number(p2pLocalProfile.fps || p2pLocalProfile.inputFps || 0);
    const p2pLocalProfileBitrate = Number(p2pLocalProfile.bitrateKbps || 0);
    const p2pLocalProfileEncoder = String(p2pLocalProfile.encoder || "").trim() || "-";
    const p2pLocalProfileCamera = String(p2pLocalProfile.camera || "").trim();
    const p2pLocalOutputLabel =
      p2pLocalProfileWidth && p2pLocalProfileHeight && p2pLocalProfileFps
        ? `${p2pLocalProfileWidth}x${p2pLocalProfileHeight}@${p2pLocalProfileFps}`
        : "-";
    const p2pPanelSubtitle = webLocalStreamMode
      ? "浏览器直接采集本机摄像头，通过 P2P WebRTC 向观看端发送视频"
      : "小程序调用本地 P2P 推流脚本，按下方摄像头、分辨率、帧率、码率和编码器参数推流";
    const webCameraStateLabel = browserCameraAvailable
      ? "WEB READY"
      : browserCameraProbe.status === "checking"
        ? "CHECKING"
        : browserCameraProbe.status === "blocked"
          ? "PERMISSION BLOCKED"
          : "NO CAMERA";
    const webCameraSignalValue = browserCameraAvailable
      ? "可用"
      : browserCameraProbe.status === "blocked"
        ? "被浏览器阻止"
        : browserCameraProbe.status === "checking"
          ? "检测中"
          : "未检测";
    const cameraNote = cameraOptions.length
      ? cameraOptions.map((camera) => camera.name).slice(0, 2).join(" / ")
      : webLocalStreamMode
        ? browserCameraProbe.note
        : localStreamStatus.message;
    const baseLocalStreamSignals = [
      {
        key: "camera",
        label: "摄像头可用",
        state: cameraConnected ? "live" : webLocalStreamMode && browserCameraProbe.status === "checking" ? "pending" : "off",
        value: webLocalStreamMode ? webCameraSignalValue : cameraOptions.length ? `${cameraOptions.length} 个` : "未检测",
        note: cameraNote,
      },
      {
        key: "server",
        label: "服务器通路",
        state: serverReachable ? "live" : status.connected ? "pending" : "off",
        value: serverReachable ? "OK" : status.connected ? "检测中" : "未连接",
        note: webLocalStreamMode ? status.public_base_url : localStreamStatus.server_note || status.public_base_url,
      },
      {
        key: "local",
        label: "本机推流",
        state: webLocalStreamMode ? "pending" : localStreamStatus.running ? "live" : localStreamOccupiedByOther ? "pending" : streamReady ? "live" : cameraConnected ? "pending" : "off",
        value: localStreamStatus.running ? "推流中" : localStreamOccupiedByOther ? "占用中" : streamReady ? "就绪" : "未就绪",
        note: localStreamOccupiedByOther ? "其他人正在推流" : localStreamStatus.local_stream_note || localStreamStatus.message,
      },
      {
        key: "push",
        label: "已推上云",
        state: localStreamStatus.push_visible ? "live" : localStreamStatus.running ? "pending" : "off",
        value: localStreamStatus.push_visible ? "已可见" : localStreamStatus.running ? "等待中" : "未推流",
        note: localStreamStatus.push_note || "等待 go2rtc producer",
      },
      {
        key: "pull",
        label: "拉流成功",
        state:
          localStreamStatus.pull_reachable
            ? "live"
            : localStreamStatus.push_visible
              ? "pending"
              : "off",
        value:
          localStreamStatus.pull_reachable
            ? "OK"
            : localStreamStatus.push_visible
              ? "检测中"
              : "未就绪",
        note: localStreamStatus.pull_note || "单帧低频检测",
      },
    ] as const;
    const localStreamSignals = baseLocalStreamSignals.map((signal) => {
      if (!webLocalStreamMode && signal.key === "push" && p2pLocalPusherStatus.running) {
        return {
          ...signal,
          state: "live",
          value: "P2P中",
          note: `本地 P2P 脚本正在 ${p2pLocalPusherStatus.room_id || P2P_DEFAULT_ROOM_ID} 房间推流`,
        };
      }
      if (!webLocalStreamMode && signal.key === "pull" && p2pLocalPusherStatus.running) {
        return {
          ...signal,
          state: "pending",
          value: "可观看",
          note: p2pLocalPusherStatus.watch_url || buildP2pWatchPageUrl(p2pLocalPusherStatus.room_id),
        };
      }
      if (!webLocalStreamMode) {
        return signal;
      }
      if (signal.key === "local") {
        return {
          ...signal,
          state: "pending",
          value: "Web 推流",
          note: "旧链路开始推流暂不可用",
        };
      }
      if (signal.key === "push") {
        return {
          ...signal,
          state: p2pPushRunning || tencentCloudPushRunning || tencentCloudRestorableByThisBrowser ? "live" : tencentCloudOccupiedByOther ? "pending" : "off",
          value: p2pPushRunning
            ? "P2P中"
            : tencentCloudPushRunning
              ? "推流中"
              : tencentCloudRestorableByThisBrowser
                ? "可恢复"
                : tencentCloudOccupiedByOther
                  ? "占用中"
                  : "未推流",
          note: p2pPushRunning
            ? `正在通过 P2P WebRTC 推流，${p2pViewerCount} 个观看端`
            : tencentCloudPushRunning
              ? "正在通过腾讯云 WebRTC 推流"
              : tencentCloudRestorableByThisBrowser
                ? "当前浏览器可继续管理这路推流"
                : tencentCloudOccupiedByOther
                  ? "其他人正在腾讯云推流"
                  : "等待腾讯云或 P2P 推流启动",
        };
      }
      if (signal.key === "pull") {
        return {
          ...signal,
          state: tencentCloudPlayOpen || p2pViewerCount > 0 ? "live" : "off",
          value: tencentCloudPlayOpen || p2pViewerCount > 0 ? "已打开" : "未打开",
          note: p2pViewerCount > 0
            ? `${p2pViewerCount} 个 P2P 观看端已加入`
            : tencentCloudPlayOpen
              ? "网页端观看窗口已打开"
              : tencentCloudViewerReady || p2pPushRunning
                ? "可打开网页端观看页"
                : "可在推流成功后打开观看",
        };
      }
      return signal;
    });
    const localStreamAllSignalsLive = localStreamSignals.every((signal) => signal.state === "live");
    const cameraSelectOptions = [
      {
        value: "",
        label: "自动选择",
        description: cameraOptions.length ? `${cameraOptions.length} 台可用` : "未检测到摄像头",
      },
      ...cameraOptions.map((camera) => ({
        value: camera.name,
        label: camera.name,
        description: camera.id ? `${camera.source} · ${camera.id}` : camera.source,
      })),
    ];
    const inputFormatOptions = [
      { value: "", label: "默认", description: "自动识别输入格式" },
      { value: "mjpeg", label: "MJPEG", description: "多帧图像输入" },
    ];
    const videoEncoderOptions = [
      { value: "libx264", label: "libx264", description: "通用软件编码" },
      { value: "h264_nvenc", label: "h264_nvenc", description: "NVIDIA 硬编" },
      { value: "hevc_nvenc", label: "hevc_nvenc", description: "NVIDIA HEVC 硬编，浏览器兼容性取决于观看端" },
      { value: "h264_amf", label: "h264_amf", description: "AMD 硬编，失败后自动降级" },
      { value: "h264_qsv", label: "h264_qsv", description: "Intel QSV 硬编" },
    ];
    const publicSchemeOptions = [
      { value: "http", label: "HTTP", description: "标准明文公网入口" },
      { value: "https", label: "HTTPS", description: "加密公网入口" },
    ];

    return (
      <section className="local-stream-view">
        <div className={`panel local-stream-panel${localStreamAllSignalsLive ? " all-live" : ""}`}>
          <div className="local-stream-background" aria-hidden="true" />
          <div className="local-stream-header">
            <div>
              <div className="section-title">本地推流</div>
              <div className="section-subtitle">
                {webLocalStreamMode
                  ? "网页端支持腾讯云 WebRTC 与 P2P 推流；旧链路开始推流暂不可用"
                  : "本机摄像头推送到当前登录云服务器的 main-camera 流"}
              </div>
            </div>
            <div className={`local-stream-state ${webLocalStreamMode ? browserCameraAvailable ? "ready" : "idle" : localStreamStatus.running ? "live" : streamReady ? "ready" : "idle"}`}>
              <span>{webLocalStreamMode ? webCameraStateLabel : localStreamStatus.running ? "RUNNING" : streamReady ? "READY" : "OFFLINE"}</span>
              <strong>{webLocalStreamMode ? browserCameraProbe.label || browserCameraProbe.note : localStreamStatus.pid ? `PID ${localStreamStatus.pid}` : localStreamStatus.updated_at}</strong>
            </div>
          </div>

          <div className="local-stream-signal-grid">
            {localStreamSignals.map((signal) => (
              <div className={`local-stream-signal ${signal.state}`} key={signal.key}>
                <span className={`local-stream-signal-lamp ${signal.state}`} aria-hidden="true" />
                <div className="local-stream-signal-copy">
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                  <small>{signal.note}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="local-stream-actions">
            <Button
              variant="ghost"
              loading={localStreamSetupBusy}
              disabled={webLocalStreamMode || localStreamSetupBusy || localStreamBusy || localToolReady}
              onClick={handleSetupLocalStream}
            >
              {localToolReady ? "本地配置已就绪" : "本地配置"}
            </Button>
            <span className="local-stream-action-tooltip" title={localStreamActionTooltip}>
              <Button
                variant={localStreamActionIsStopping ? "danger" : "primary"}
                loading={localStreamBusy}
                disabled={localStreamActionDisabled}
                onClick={localStreamActionIsStopping ? handleStopLocalStream : handleStartLocalStream}
              >
                {localStreamActionIsStopping ? "停止推流" : "开始推流"}
              </Button>
            </span>
            <Button
              variant="secondary"
              disabled={localStreamBusy || localStreamSetupBusy || p2pPushBusy || p2pPushRunning}
              onClick={openTencentCloudPushCodeDialog}
            >
              腾讯云推流
            </Button>
            <Button
              variant="secondary"
              disabled={localStreamBusy || localStreamSetupBusy || tencentCloudPushBusy || tencentCloudPushRunning || (p2pPushRunning && p2pV2Active)}
              onClick={openP2pPushPanel}
            >
              P2P推流 (BETA)
            </Button>
            <Button
              variant="secondary"
              disabled={localStreamBusy || localStreamSetupBusy || tencentCloudPushBusy || tencentCloudPushRunning || p2pPushBusy || (p2pPushRunning && !p2pV2Active)}
              onClick={openP2pV2PushPanel}
            >
              P2P推流 V2
            </Button>
            <Button
              variant="secondary"
              disabled={localStreamPreviewDisabled}
              onClick={() => handleOpenLocalStreamPreview(localStreamPreviewUrl)}
            >
              网页预览
            </Button>
          </div>

          {tencentCloudPushOpen ? (
            <div className="tencent-cloud-push-card">
              <div className="tencent-cloud-push-header">
                <div>
                  <div className="section-title">腾讯云推流</div>
                  <div className="section-subtitle">浏览器直接采集摄像头、麦克风或屏幕，推到腾讯云直播 WebRTC 地址</div>
                </div>
                <button
                  className="tencent-cloud-push-close"
                  type="button"
                  onClick={() => setTencentCloudPushOpen(false)}
                  aria-label="关闭腾讯云推流面板"
                >
                  ×
                </button>
              </div>

              <div className="tencent-cloud-push-grid">
                <div className="tencent-cloud-push-main">
                  <div className="field tencent-cloud-push-url">
                    <span>WebRTC 推流码</span>
                    <div className="tencent-cloud-push-code-display">
                      <div
                        className={`tencent-cloud-push-code-value ${tencentCloudPushUrl ? "" : "empty"}`}
                        ref={tencentCloudPushCodeValueRef}
                        role="button"
                        tabIndex={tencentCloudPushUrl ? 0 : -1}
                        title={tencentCloudPushUrl ? "点击选中推流码" : "请先填写推流码"}
                        onClick={selectTencentCloudPushUrl}
                        onKeyDown={handleTencentCloudPushCodeKeyDown}
                      >
                        <strong ref={tencentCloudPushCodeRef}>
                          {tencentCloudPushUrl || "未填写推流码"}
                        </strong>
                      </div>
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={tencentCloudPushBusy || tencentCloudPushRunning}
                        onClick={openTencentCloudPushCodeDialog}
                      >
                        修改
                      </Button>
                    </div>
                  </div>

                  <div className={`tencent-cloud-push-preview-shell${tencentCloudPlayOpen ? " with-player" : ""}`}>
                    <div className="tencent-cloud-push-preview-frame">
                      <div className="tencent-cloud-push-preview" id="tencent-cloud-push-preview">
                        <video
                          ref={tencentCloudPreviewVideoRef}
                          className="tencent-cloud-push-preview-video"
                          muted
                          playsInline
                          autoPlay
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="tencent-cloud-push-controls">
                  <AppSelect
                    className="tencent-cloud-push-source"
                    label="视频源"
                    value={tencentCloudPushSource}
                    options={[
                      { value: "camera", label: "摄像头", description: "使用浏览器摄像头采集" },
                      { value: "screen", label: "屏幕/窗口", description: "选择屏幕或单个窗口推送" },
                    ]}
                    placeholder="摄像头"
                    disabled={tencentCloudPushRunning || tencentCloudPushBusy}
                    onChange={(nextValue) => setTencentCloudPushSource(nextValue === "screen" ? "screen" : "camera")}
                  />
                  <div className="tencent-cloud-push-audio">
                    <label className="toggle-line local-stream-toggle tencent-cloud-push-audio-toggle">
                      <input
                        type="checkbox"
                        checked={tencentCloudPushAudioEnabled}
                        disabled={tencentCloudPushRunning || tencentCloudPushBusy}
                        onChange={(event) => setTencentCloudPushAudioEnabled(event.target.checked)}
                      />
                      <span>同时推送麦克风</span>
                    </label>
                  </div>
                  <div className={`tencent-cloud-push-status ${tencentCloudPushRunning ? "live" : "idle"}`}>
                    <span className={`local-stream-signal-lamp ${tencentCloudPushRunning ? "live" : "pending"}`} aria-hidden="true" />
                    <strong>{tencentCloudPushMessage}</strong>
                  </div>
                </div>
              </div>

              <div className="local-stream-actions">
                <span className="local-stream-action-tooltip" title={tencentCloudPushActionTooltip}>
                  <Button
                    variant={tencentCloudPushActionIsStopping ? "danger" : "primary"}
                    loading={tencentCloudPushBusy}
                    disabled={tencentCloudPushActionDisabled}
                    onClick={tencentCloudPushActionIsStopping ? () => void stopTencentCloudPush() : handleStartTencentCloudPush}
                  >
                    {tencentCloudPushActionIsStopping ? "停止腾讯云推流" : "开始腾讯云推流"}
                  </Button>
                </span>
                <Button
                  variant="secondary"
                  loading={tencentCloudPlayBusy}
                  disabled={tencentCloudPlayBusy}
                  onClick={openTencentCloudPlayDialog}
                >
                  网页端观看
                </Button>
              </div>
            </div>
          ) : null}

          {p2pPushOpen || p2pV2PushOpen ? (
            <div className="tencent-cloud-push-card p2p-push-card">
              <div className="tencent-cloud-push-header">
                <div>
                  <div className="section-title">{p2pV2PushOpen ? "P2P推流 V2" : "P2P推流 (BETA)"}</div>
                  <div className="section-subtitle">
                    {p2pV2PushOpen
                      ? "浏览器视频端注册到指定房间，观看端选择具体视频端后建立定向 WebRTC 连接"
                      : p2pPanelSubtitle}
                  </div>
                </div>
                <button
                  className="tencent-cloud-push-close"
                  type="button"
                  onClick={() => {
                    setP2pPushOpen(false);
                    setP2pV2PushOpen(false);
                  }}
                  aria-label="关闭 P2P 推流面板"
                >
                  ×
                </button>
              </div>

              <div className="tencent-cloud-push-grid">
                <div className="tencent-cloud-push-main">
                  <div className="field tencent-cloud-push-url">
                    <span>{p2pV2PushOpen ? "P2P V2 房间链接" : "P2P 链接"}</span>
                    <div className="tencent-cloud-push-code-display">
                      <div className="tencent-cloud-push-code-value">
                        <input
                          className="p2p-room-input"
                          value={p2pRoomDraft}
                          disabled={p2pPushRunning || p2pPushBusy}
                          onChange={(event) => handleP2pRoomDraftChange(event.target.value)}
                          onBlur={() => {
                            const endpoint = rememberP2pLink(getActiveP2pEndpoint().watchUrl);
                            setP2pRoomDraft(endpoint.watchUrl);
                            p2pSignalBaseUrlRef.current = endpoint.signalBaseUrl;
                            p2pRoomIdRef.current = endpoint.roomId;
                          }}
                          aria-label="P2P 推流链接"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={p2pV2PushOpen || p2pPushBusy}
                        onClick={() => void resetP2pRoomSignal().then(() => {
                          p2pSinceRef.current = 0;
                          setP2pPushMessage("P2P 信令已清空");
                        }).catch((err) => {
                          const message = err instanceof Error ? err.message : "P2P 信令清空失败";
                          setP2pPushMessage(message);
                          setError(message);
                        })}
                      >
                        {p2pV2PushOpen ? "V2 自动清理" : "清空信令"}
                      </Button>
                    </div>
                  </div>

                  {webLocalStreamMode ? (
                    <div className="tencent-cloud-push-preview-shell">
                      <div className="tencent-cloud-push-preview-frame">
                        <div className="tencent-cloud-push-preview">
                          <video
                            ref={p2pPreviewVideoRef}
                            className="tencent-cloud-push-preview-video"
                            muted
                            playsInline
                            autoPlay
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p2p-local-script-panel">
                      <div className="p2p-local-script-status">
                        <span className={`local-stream-signal-lamp ${p2pLocalPusherStatus.running ? "live" : p2pSignalState === "pending" ? "pending" : "off"}`} aria-hidden="true" />
                        <div>
                          <strong>{p2pLocalPusherStatus.running ? "本地脚本正在后台推流" : p2pLocalPusherStatus.available ? "本地脚本已就绪" : "未找到本地 P2P 脚本"}</strong>
                          <small>{p2pLocalPusherStatus.message || p2pLocalPusherStatus.project_path || "请确认 E:\\Desktop\\123\\p2p-local-pusher 存在"}</small>
                        </div>
                      </div>
                      <div className="p2p-local-script-grid">
                        <div>
                          <span>房间</span>
                          <strong>{p2pLocalPusherStatus.room_id || getActiveP2pEndpoint().roomId}</strong>
                        </div>
                        <div>
                          <span>输出</span>
                          <strong>{p2pLocalOutputLabel}</strong>
                        </div>
                        <div>
                          <span>编码器</span>
                          <strong>{p2pLocalProfileEncoder}</strong>
                        </div>
                        <div>
                          <span>码率</span>
                          <strong>{p2pLocalProfileBitrate ? `${p2pLocalProfileBitrate} kbps` : "-"}</strong>
                        </div>
                      </div>
                      <div className="p2p-local-script-link">
                        <span>观看地址</span>
                        <strong>{p2pLocalPusherStatus.watch_url || getActiveP2pEndpoint().watchUrl}</strong>
                      </div>
                      {p2pLocalProfileCamera ? (
                        <div className="p2p-local-script-link">
                          <span>摄像头</span>
                          <strong>{p2pLocalProfileCamera}</strong>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="tencent-cloud-push-controls">
                  <div className="p2p-push-stat-grid">
                    <div>
                      <span>{webLocalStreamMode ? "本页连接" : "进程"}</span>
                      <strong>{webLocalStreamMode ? `${p2pViewerCount} 个` : p2pLocalPusherStatus.pid ? `PID ${p2pLocalPusherStatus.pid}` : "-"}</strong>
                    </div>
                    <div>
                      <span>信令</span>
                      <strong>{p2pSignalState === "live" ? "已连接" : p2pSignalState === "pending" ? "连接中" : "未连接"}</strong>
                    </div>
                  </div>
                  <div className={`tencent-cloud-push-status p2p-push-status-row ${p2pPushRunning ? "live" : "idle"}`}>
                    <span
                      className={`local-stream-signal-lamp ${p2pPushRunning ? "live" : p2pSignalState === "pending" ? "pending" : "off"}`}
                      aria-hidden="true"
                    />
                    <strong>{p2pPushMessage}</strong>
                  </div>
                </div>
              </div>

              <div className="local-stream-actions">
                <span className="local-stream-action-tooltip" title={p2pPushActionTooltip}>
                  <Button
                    variant={p2pPushActionIsStopping ? "danger" : "primary"}
                    loading={p2pPushBusy}
                    disabled={p2pPushActionDisabled}
                    onClick={p2pPushActionIsStopping ? () => void stopP2pPush() : handleStartP2pPush}
                  >
                    {p2pPushActionIsStopping ? "停止P2P推流" : "开始P2P推流"}
                  </Button>
                </span>
                <Button
                  variant="secondary"
                  disabled={p2pPushBusy}
                  onClick={p2pV2PushOpen ? openP2pV2ViewerDialog : openP2pViewerDialog}
                >
                  网页端观看
                </Button>
              </div>
            </div>
          ) : null}

          {localStreamMessage ? (
            <div className="local-stream-message" role="status">
              {localStreamMessage}
            </div>
          ) : null}

          <div className="local-stream-form-grid">
            <AppSelect
              className={p2pConfigActive && browserPushControlsDisabled ? "local-stream-field-disabled" : legacyOnlyControlsDisabled ? "local-stream-field-disabled" : ""}
              label="摄像头"
              value={localStreamConfig.camera_name}
              options={cameraSelectOptions}
              placeholder="自动选择"
              disabled={browserPushControlsDisabled || (!p2pConfigActive && legacyOnlyControlsDisabled)}
              onChange={(nextValue) => patchLocalStreamConfig({ camera_name: nextValue })}
            />
            <AppSelect
              className={legacyOnlyControlsDisabled ? "local-stream-field-disabled" : ""}
              label="输入格式"
              value={localStreamConfig.input_format}
              options={inputFormatOptions}
              placeholder="默认"
              disabled={legacyOnlyControlsDisabled}
              onChange={(nextValue) => patchLocalStreamConfig({ input_format: nextValue })}
            />
            <AppSelect
              className={encoderFieldDisabled ? "local-stream-field-disabled" : ""}
              label="编码器"
              value={localStreamConfig.video_encoder}
              options={videoEncoderOptions}
              placeholder="libx264"
              disabled={encoderFieldDisabled}
              onChange={(nextValue) => patchLocalStreamConfig({ video_encoder: nextValue })}
            />
            <label className={browserOutputLabelClass}>
              <span>观看分辨率</span>
              <input
                className="input"
                type="text"
                inputMode="text"
                value={localStreamDraft.viewerResolution}
                aria-label="观看分辨率"
                placeholder="1920x1080"
                disabled={browserPushControlsDisabled}
                onChange={(event) => patchViewerResolutionDraft(event.target.value)}
                onBlur={(event) =>
                  commitViewerResolutionDraft(event.target.value, outputSize.width, outputSize.height)
                }
              />
            </label>
            <label className={browserOutputLabelClass}>
              <span>观看帧率</span>
              <input
                className="input"
                type="number"
                min={1}
                max={120}
                value={localStreamDraft.targetFramerate}
                disabled={browserPushControlsDisabled}
                onChange={(event) => patchViewerFramerateDraft(event.target.value)}
                onBlur={(event) =>
                  commitViewerFramerateDraft(
                    event.target.value,
                    localStreamConfig.target_framerate || localStreamConfig.input_framerate,
                  )
                }
              />
            </label>
            <label className={browserOutputLabelClass}>
              <span>视频码率</span>
              <div className="local-stream-input-with-unit">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={localStreamDraft.videoBitrateKbps}
                  disabled={browserPushControlsDisabled}
                  onChange={(event) => patchLocalStreamBitrateDraft(event.target.value)}
                  onBlur={(event) => commitLocalStreamBitrateDraft(event.target.value, bitrateKbps)}
                />
                <span>kbps</span>
              </div>
            </label>
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>推流协议</span>
              <input
                className="input"
                value={localStreamConfig.ingest_mode === "srt" ? "SRT" : "HTTP MPEG-TS"}
                disabled={legacyOnlyControlsDisabled}
                readOnly
              />
            </label>
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>SRT 延迟 ms</span>
              <input
                className="input"
                type="number"
                min={40}
                max={5000}
                value={localStreamDraft.srtLatencyMs}
                disabled={legacyOnlyControlsDisabled}
                onChange={(event) =>
                  patchLocalStreamNumberDraft("srtLatencyMs", "srt_latency_ms", event.target.value, 40, 5000)
                }
                onBlur={(event) =>
                  commitLocalStreamNumberDraft(
                    "srtLatencyMs",
                    "srt_latency_ms",
                    event.target.value,
                    localStreamConfig.srt_latency_ms,
                    40,
                    5000,
                  )
                }
              />
            </label>
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>SRT 包大小</span>
              <input
                className="input"
                type="number"
                min={188}
                max={65535}
                value={localStreamDraft.srtPacketSize}
                disabled={legacyOnlyControlsDisabled}
                onChange={(event) =>
                  patchLocalStreamNumberDraft("srtPacketSize", "srt_packet_size", event.target.value, 188, 65535)
                }
                onBlur={(event) =>
                  commitLocalStreamNumberDraft(
                    "srtPacketSize",
                    "srt_packet_size",
                    event.target.value,
                    localStreamConfig.srt_packet_size,
                    188,
                    65535,
                  )
                }
              />
            </label>
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>连接超时 ms</span>
              <input
                className="input"
                type="number"
                min={100}
                max={30000}
                value={localStreamDraft.connectTimeoutMs}
                disabled={legacyOnlyControlsDisabled}
                onChange={(event) =>
                  patchLocalStreamNumberDraft("connectTimeoutMs", "connect_timeout_ms", event.target.value, 100, 30000)
                }
                onBlur={(event) =>
                  commitLocalStreamNumberDraft(
                    "connectTimeoutMs",
                    "connect_timeout_ms",
                    event.target.value,
                    localStreamConfig.connect_timeout_ms,
                    100,
                    30000,
                  )
                }
              />
            </label>
            <label className={legacyOnlyToggleClass} title={legacyOnlyFieldTitle}>
              <input
                type="checkbox"
                checked={localStreamConfig.drop_late_packets}
                disabled={legacyOnlyControlsDisabled}
                onChange={(event) => patchLocalStreamConfig({ drop_late_packets: event.target.checked })}
              />
              <span>丢弃迟到 SRT 包</span>
            </label>
            <label className={legacyOnlyToggleClass} title={legacyOnlyFieldTitle}>
              <input
                type="checkbox"
                checked={localStreamConfig.use_current_server}
                disabled={legacyOnlyControlsDisabled}
                onChange={(event) => patchLocalStreamConfig({ use_current_server: event.target.checked })}
              />
              <span>使用当前登录服务器</span>
            </label>
          </div>

          <div className="local-stream-server-grid">
            <AppSelect
              className={legacyOnlyControlsDisabled ? "local-stream-field-disabled" : ""}
              label="公网协议"
              value={localStreamConfig.cloud_public_scheme}
              options={publicSchemeOptions}
              placeholder="HTTP"
              disabled={legacyOnlyControlsDisabled || currentServerLocked}
              onChange={(nextValue) => patchLocalStreamConfig({ cloud_public_scheme: nextValue })}
            />
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>公网 Host</span>
              <input
                className="input"
                value={localStreamConfig.cloud_public_host}
                disabled={legacyOnlyControlsDisabled || currentServerLocked}
                onChange={(event) => patchLocalStreamConfig({ cloud_public_host: event.target.value })}
              />
            </label>
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>公网端口</span>
              <input
                className="input"
                type="number"
                value={localStreamDraft.cloudApiPort}
                disabled={legacyOnlyControlsDisabled || currentServerLocked}
                onChange={(event) =>
                  patchLocalStreamNumberDraft("cloudApiPort", "cloud_api_port", event.target.value, 1, 65535)
                }
                onBlur={(event) =>
                  commitLocalStreamNumberDraft(
                    "cloudApiPort",
                    "cloud_api_port",
                    event.target.value,
                    localStreamConfig.cloud_api_port,
                    1,
                    65535,
                  )
                }
              />
            </label>
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>HTTP Ingest</span>
              <input
                className="input"
                type="number"
                value={localStreamDraft.cloudIngestPort}
                disabled={legacyOnlyControlsDisabled}
                onChange={(event) =>
                  patchLocalStreamNumberDraft("cloudIngestPort", "cloud_ingest_port", event.target.value, 1, 65535)
                }
                onBlur={(event) =>
                  commitLocalStreamNumberDraft(
                    "cloudIngestPort",
                    "cloud_ingest_port",
                    event.target.value,
                    localStreamConfig.cloud_ingest_port,
                    1,
                    65535,
                  )
                }
              />
            </label>
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>SRT Ingest</span>
              <input
                className="input"
                type="number"
                value={localStreamDraft.cloudSrtIngestPort}
                disabled={legacyOnlyControlsDisabled}
                onChange={(event) =>
                  patchLocalStreamNumberDraft("cloudSrtIngestPort", "cloud_srt_ingest_port", event.target.value, 1, 65535)
                }
                onBlur={(event) =>
                  commitLocalStreamNumberDraft(
                    "cloudSrtIngestPort",
                    "cloud_srt_ingest_port",
                    event.target.value,
                    localStreamConfig.cloud_srt_ingest_port,
                    1,
                    65535,
                  )
                }
              />
            </label>
          </div>

          <div className="local-stream-log-shell">
            <div className="section-title">推流日志</div>
            {localStreamStatus.log_tail ? (
              <pre className="local-stream-log log-console" data-selectable-log="true">
                {localStreamStatus.log_tail}
              </pre>
            ) : (
              <div className="local-stream-log-empty log-console">还没有推流日志</div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const localStreamAvailable = accessInfo.webMode
    ? browserCameraProbe.status !== "unavailable"
    : canRunAdminActions && (localStreamStatus.camera_connected || localStreamStatus.push_visible);
  const currentView = VIEW_META[activeView];

  return (
    <AppShell
      networkSnapshot={status.network_snapshot}
      title={currentView.title}
      statusText={status.summary_status}
      theme={theme}
      updater={updater}
      onlineCount={onlineCount}
      accessRoleLabel={accessInfo.webMode ? `${accessInfo.username} · ${accessInfo.admin ? "管理员" : "普通用户"}` : ""}
      activeView={activeView}
      localStreamAvailable={localStreamAvailable}
      canRunSetup={canRunAdminActions}
      busy={busy}
      sidebarRefreshBusy={sidebarRefreshBusy}
      setupBusy={setupBusy}
      setupProgress={setupProgress}
      setupMessage={setupMessage}
      setupTone={setupTone}
      scrollLocked={false}
      onViewChange={setActiveView}
      onRefresh={handleDashboardRefresh}
      onInstallUpdate={onInstallUpdate}
      onLocalSetup={handleLocalSetup}
      onSidebarRefresh={handleSidebarRefresh}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
    >
      {error ? <div className="panel error-banner">{error}</div> : null}

      {activeView === "overview" ? renderOverview() : null}
      {activeView === "services" ? renderServices() : null}
      {activeView === "health" ? renderHealth() : null}
      {activeView === "activity" ? renderActivity() : null}
      {activeView === "localStream" ? renderLocalStream() : null}
      {activeView === "models" ? <ModelLibraryPanel theme={theme} /> : null}
      {activeView === "settings" ? (
        <SystemSettingsPanel accessInfo={accessInfo} onAccessInfoChange={onAccessInfoChange} />
      ) : null}

      {setupPasswordDialogOpen ? createPortal(
        <div className="setup-password-overlay" role="presentation">
          <form className="setup-password-dialog panel" onSubmit={submitLocalSetupPassword}>
            <div>
              <div className="section-title">确认一键配置</div>
              <div className="section-subtitle">再次输入当前云服务器 SSH 密码，验证通过后才会执行配置。</div>
              <div className="setup-password-target">
                <div className="setup-password-target-row">
                  <span>目标服务器</span>
                  <strong>{status.ssh_target}</strong>
                </div>
                <div className="setup-password-target-row">
                  <span>公网入口</span>
                  <strong>{status.public_base_url}</strong>
                </div>
              </div>
            </div>
            <label className="field">
              <span>SSH 密码</span>
              <input
                className="input"
                type="password"
                value={setupPassword}
                autoFocus
                autoComplete="current-password"
                disabled={setupBusy}
                onChange={(event) => {
                  setSetupPassword(event.target.value);
                  setSetupPasswordError("");
                }}
              />
            </label>
            {setupPasswordError ? <div className="setup-password-error">{setupPasswordError}</div> : null}
            <div className="setup-password-actions">
              <Button variant="ghost" type="button" disabled={setupBusy} onClick={closeLocalSetupPasswordDialog}>
                取消
              </Button>
              <Button variant="primary" type="submit" loading={setupBusy}>
                验证并配置
              </Button>
            </div>
          </form>
        </div>,
        document.body,
      ) : null}

      {tencentCloudPushCodeDialogOpen ? createPortal(
        <div className="setup-password-overlay" role="presentation">
          <form className="setup-password-dialog tencent-cloud-push-dialog panel" onSubmit={submitTencentCloudPushCode}>
            <div>
              <div className="section-title">腾讯云推流码</div>
              <div className="section-subtitle">输入腾讯云直播生成的 webrtc:// 推流地址。推流成功一次后，下次会自动带出。</div>
            </div>
            <label className="field">
              <span>WebRTC 推流码</span>
              <textarea
                className="input tencent-cloud-push-textarea"
                value={tencentCloudPushDraftUrl}
                autoFocus
                spellCheck={false}
                placeholder="webrtc://xxx.push.tlivecloud.com/live/robot_control?txSecret=...&txTime=..."
                disabled={tencentCloudPushBusy}
                onChange={(event) => {
                  setTencentCloudPushDraftUrl(event.target.value);
                  setTencentCloudPushCodeError("");
                }}
              />
            </label>
            {tencentCloudPushCodeError ? <div className="setup-password-error">{tencentCloudPushCodeError}</div> : null}
            <div className="setup-password-actions">
              <Button variant="ghost" type="button" disabled={tencentCloudPushBusy} onClick={closeTencentCloudPushCodeDialog}>
                取消
              </Button>
              <Button variant="primary" type="submit" loading={tencentCloudPushBusy}>
                确认
              </Button>
            </div>
          </form>
        </div>,
        document.body,
      ) : null}

      {tencentCloudPlayDialogOpen ? createPortal(
        <div className="setup-password-overlay" role="presentation">
          <form className="setup-password-dialog tencent-cloud-push-dialog panel" onSubmit={submitTencentCloudPlayCode}>
            <div>
              <div className="section-title">腾讯云播放地址</div>
              <div className="section-subtitle">输入腾讯云直播的 webrtc:// 播放地址。成功打开一次后，下次会自动带出。</div>
            </div>
            <label className="field">
              <span>WebRTC 播放地址</span>
              <textarea
                className="input tencent-cloud-push-textarea"
                value={tencentCloudPlayDraftUrl}
                autoFocus
                spellCheck={false}
                placeholder="webrtc://cityulive.xyz/live/robot_control"
                disabled={tencentCloudPlayBusy}
                onChange={(event) => {
                  setTencentCloudPlayDraftUrl(event.target.value);
                  setTencentCloudPlayError("");
                }}
              />
            </label>
            {tencentCloudPlayError ? <div className="setup-password-error">{tencentCloudPlayError}</div> : null}
            <div className="setup-password-actions">
              <Button variant="ghost" type="button" disabled={tencentCloudPlayBusy} onClick={closeTencentCloudPlayDialog}>
                取消
              </Button>
              <Button variant="primary" type="submit" loading={tencentCloudPlayBusy}>
                打开观看
              </Button>
            </div>
          </form>
        </div>,
        document.body,
      ) : null}

      {p2pViewDialogOpen ? createPortal(
        <div className="setup-password-overlay" role="presentation">
          <div className="setup-password-dialog tencent-cloud-push-dialog p2p-room-picker-dialog panel" role="dialog" aria-modal="true">
            <div>
              <div className="section-title">选择 P2P 房间</div>
              <div className="section-subtitle">显示当前 P2P 域名下正在直播的房间，点击房间 ID 直接观看。</div>
            </div>
            <div className="p2p-room-picker-domain">
              <span>当前域名</span>
              <strong>{p2pViewEndpoint.signalBaseUrl}</strong>
            </div>
            <div className="p2p-room-picker-list" aria-live="polite">
              {p2pViewLoading ? (
                <div className="p2p-room-picker-empty">正在获取正在推流的房间...</div>
              ) : p2pViewRooms.length > 0 ? (
                p2pViewRooms.map((room) => (
                  <button
                    className="p2p-room-picker-item"
                    type="button"
                    key={room.room}
                    onClick={() => openP2pViewerRoom(room.room)}
                  >
                    <strong>{room.room}</strong>
                    <span>{Number(room.viewerCount || 0)} 个观看端</span>
                  </button>
                ))
              ) : (
                <div className="p2p-room-picker-empty">当前没有正在推流的房间</div>
              )}
            </div>
            {p2pViewError ? <div className="setup-password-error">{p2pViewError}</div> : null}
            <div className="setup-password-actions">
              <Button
                variant="ghost"
                type="button"
                disabled={p2pPushBusy || p2pViewLoading}
                onClick={() => void refreshP2pViewRooms()}
              >
                刷新
              </Button>
              <Button variant="ghost" type="button" disabled={p2pPushBusy} onClick={closeP2pViewerDialog}>
                取消
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {p2pV2ViewDialogOpen ? createPortal(
        <div className="setup-password-overlay" role="presentation">
          <div className="setup-password-dialog tencent-cloud-push-dialog p2p-room-picker-dialog p2p-v2-picker-dialog panel" role="dialog" aria-modal="true">
            <div>
              <div className="section-title">选择 P2P V2 在线端</div>
              <div className="section-subtitle">先选择在线房间，再选择视频推流端观看；其他类型的端只显示状态。</div>
            </div>
            <div className="p2p-room-picker-domain">
              <span>当前域名</span>
              <strong>{p2pViewEndpoint.signalBaseUrl}</strong>
            </div>
            <AppSelect
              className="p2p-v2-room-select"
              label="在线房间"
              value={p2pV2RoomDraft}
              options={p2pV2Rooms.map((room) => ({
                value: room.room,
                label: room.room,
                description: `${Number(room.endpointCount || 0)} 个在线端 · ${Number(room.videoPusherCount || 0)} 个视频端`,
              }))}
              placeholder={p2pV2ViewLoading ? "正在获取在线房间..." : "当前没有在线房间"}
              disabled={p2pV2ViewLoading || p2pV2Rooms.length === 0}
              onChange={(roomId) => void selectP2pV2Room(roomId)}
            />
            <div className="p2p-v2-search-summary" aria-live="polite">{p2pV2EndpointSummary}</div>
            <div className="p2p-room-picker-list p2p-v2-endpoint-list" aria-live="polite">
              {p2pV2ViewLoading ? (
                <div className="p2p-room-picker-empty">正在获取房间内的在线端...</div>
              ) : p2pV2Endpoints.length > 0 ? (
                p2pV2Endpoints.map((endpoint) => {
                  const watchable = endpoint.role === "video-pusher";
                  const requestedEndpointId = String(endpoint.requestedEndpointId || "").trim();
                  const assignmentHint = requestedEndpointId && requestedEndpointId !== endpoint.endpointId
                    ? `，原始端口名：${requestedEndpointId}`
                    : "";
                  return (
                    <button
                      className={`p2p-room-picker-item p2p-v2-endpoint-item${watchable ? " watchable" : " readonly"}`}
                      type="button"
                      key={endpoint.endpointId}
                      disabled={!watchable}
                      title={watchable
                        ? `打开该视频端的观看页面${assignmentHint}`
                        : `${p2pV2RoleLabel(endpoint.role)}不可作为视频观看目标${assignmentHint}`}
                      onClick={() => openP2pV2Endpoint(endpoint)}
                    >
                      <span className={`p2p-v2-endpoint-lamp ${endpoint.status || "waiting"}`} aria-hidden="true" />
                      <span className="p2p-v2-endpoint-copy">
                        <strong>{endpoint.endpointId}</strong>
                        <small>Node ID：{endpoint.nodeId || "旧端未上报"}</small>
                      </span>
                      <span className="p2p-v2-endpoint-meta">
                        <small>{p2pV2RoleLabel(endpoint.role)}</small>
                        <small>{p2pV2StatusLabel(endpoint.status)}</small>
                      </span>
                    </button>
                  );
                })
              ) : null}
            </div>
            {p2pV2ViewError ? <div className="setup-password-error">{p2pV2ViewError}</div> : null}
            <div className="setup-password-actions">
              <Button
                variant="ghost"
                type="button"
                disabled={p2pV2ViewLoading}
                onClick={() => void refreshP2pV2Rooms()}
              >
                刷新房间
              </Button>
              <Button variant="ghost" type="button" disabled={p2pV2ViewLoading} onClick={closeP2pV2ViewerDialog}>
                取消
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {loading ? <div className="loading-overlay">正在加载控制台...</div> : null}
    </AppShell>
  );
}
