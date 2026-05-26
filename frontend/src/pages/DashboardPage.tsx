import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open as openExternalUrl } from "@tauri-apps/api/shell";
import {
  checkLocalSetup,
  checkAllPorts,
  checkPort,
  getControlMonitorConfig,
  getControlMonitorKeyState,
  getLocalStreamStatus,
  getVideoPreviewUrl,
  getLiveStatus,
  getLogs,
  getStatus,
  getStoredAccessToken,
  getTrafficMonitorSnapshot,
  getVideoPushStatus,
  logout,
  postTencentVideoStatus,
  postTencentVideoStatusBeacon,
  refreshNetworkSnapshot,
  refreshStatus,
  runLocalSetup,
  saveLocalStreamConfig,
  setupLocalStream,
  startAllServices,
  startLocalStream,
  startService,
  stopAllServices,
  stopLocalStream,
  stopService,
} from "../api/cloudApi";
import { ActivityLog } from "../components/ActivityLog";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import type { AccessInfo } from "../api/cloudApi";
import { HealthPanel } from "../components/HealthPanel";
import { MetricCard } from "../components/MetricCard";
import { ServiceCard } from "../components/ServiceCard";
import { SummaryCard } from "../components/SummaryCard";
import { TankTroublePanel } from "../components/TankTroublePanel";
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
  PortStatus,
  TrafficMonitorSnapshot,
  VideoPushModeStatus,
  VideoPushStatus,
} from "../types/cloud";

type DashboardPageProps = {
  initialStatus?: DashboardStatus;
  theme: "light" | "dark";
  updater: AppUpdaterState;
  accessInfo: AccessInfo;
  onlineCount: number;
  onToggleTheme: () => void;
  onInstallUpdate: () => void;
  onLogoutDone: () => void;
};

type ConsoleView = "overview" | "services" | "health" | "activity" | "localStream" | "games";
type LocalStreamDraftState = {
  videoWidth: string;
  videoHeight: string;
  outputWidth: string;
  outputHeight: string;
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
type LocalStreamSizeConfigKey = "video_size" | "output_video_size";
type LocalStreamSizeDraftKey = "videoWidth" | "videoHeight" | "outputWidth" | "outputHeight";
type LocalStreamNumberDraftKey = Exclude<keyof LocalStreamDraftState, LocalStreamSizeDraftKey | "videoBitrateKbps">;
type LocalStreamSelectOption = {
  value: string;
  label: string;
  description?: string;
};
type LocalStreamSelectProps = {
  className?: string;
  label: string;
  value: string;
  options: LocalStreamSelectOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};
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
type VideoHeartbeatBaseline = {
  legacy: string;
  tencent: string;
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

function LocalStreamSelect({ className = "", label, value, options, placeholder, disabled = false, onChange }: LocalStreamSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className={`field ${className}`.trim()}>
      <span>{label}</span>
      <div className={`local-stream-select-shell${open ? " open" : ""}${disabled ? " disabled" : ""}`} ref={rootRef}>
        <button
          type="button"
          className="input local-stream-select-trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (disabled) {
              return;
            }
            setOpen((current) => !current);
          }}
        >
          <span className="local-stream-select-trigger-main">{selectedOption?.label || placeholder}</span>
          <span className="local-stream-select-trigger-arrow" aria-hidden="true" />
        </button>
        {open && !disabled ? (
          <div className="local-stream-select-menu" role="listbox" aria-label={label}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value || "__empty__"}
                  type="button"
                  className={`local-stream-select-option${active ? " selected" : ""}`}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="local-stream-select-option-main">{option.label}</span>
                  {option.description ? <span className="local-stream-select-option-sub">{option.description}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
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
  games: { title: "玩玩游戏" },
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
  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(String(value || "").trim());
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
  return {
    videoWidth: String(inputSize.width),
    videoHeight: String(inputSize.height),
    outputWidth: String(outputSize.width),
    outputHeight: String(outputSize.height),
    inputFramerate: String(config.input_framerate),
    targetFramerate: String(config.target_framerate),
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
  const videoWidth = parseDraftInteger(draft.videoWidth, inputSize.width, 1);
  const videoHeight = parseDraftInteger(draft.videoHeight, inputSize.height, 1);
  const outputWidth = parseDraftInteger(draft.outputWidth, outputSize.width, 1);
  const outputHeight = parseDraftInteger(draft.outputHeight, outputSize.height, 1);

  return {
    ...config,
    video_size: formatLocalStreamSize(videoWidth, videoHeight),
    output_video_size: formatLocalStreamSize(outputWidth, outputHeight),
    input_framerate: parseDraftInteger(draft.inputFramerate, config.input_framerate, 1, 120),
    target_framerate: parseDraftInteger(draft.targetFramerate, config.target_framerate, 1, 120),
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

function videoModeLabel(mode: string | undefined) {
  if (mode === "legacy") {
    return "旧链路";
  }
  if (mode === "tencent") {
    return "腾讯云";
  }
  if (mode === "offline") {
    return "未推流";
  }
  return mode ? mode : "未知";
}

function videoModeStateLabel(mode: VideoPushModeStatus | undefined) {
  if (!mode) {
    return "未知";
  }
  if (mode.live) {
    return "推流中";
  }
  if (mode.state === "stale") {
    return "已断开";
  }
  if (mode.state === "stopped") {
    return "已停止";
  }
  return "未推流";
}

function videoModeLampClass(mode: VideoPushModeStatus | undefined) {
  if (mode?.live) {
    return "live";
  }
  if (mode?.state === "stale") {
    return "pending";
  }
  return "off";
}

function videoModeLampClassForLocal(mode: VideoPushModeStatus | undefined, localActive: boolean) {
  if (mode?.live && localActive) {
    return "local";
  }
  return videoModeLampClass(mode);
}

function videoHeartbeatAt(mode: VideoPushModeStatus | undefined) {
  return typeof mode?.lastHeartbeatAt === "string" ? mode.lastHeartbeatAt : "";
}

function timestampIsAfter(value: string, baseline: string) {
  if (!value || !baseline) {
    return true;
  }
  const valueTime = Date.parse(value);
  const baselineTime = Date.parse(baseline);
  if (Number.isFinite(valueTime) && Number.isFinite(baselineTime)) {
    return valueTime > baselineTime;
  }
  return value > baseline;
}

function buildVideoHeartbeatBaseline(status: VideoPushStatus | null): VideoHeartbeatBaseline {
  return {
    legacy: videoHeartbeatAt(status?.legacy),
    tencent: videoHeartbeatAt(status?.tencent),
  };
}

function videoModeNote(mode: VideoPushModeStatus | undefined, fallback: string, heartbeatBaseline = "") {
  if (!mode) {
    return fallback;
  }
  const parts = [mode.streamName || fallback];
  const heartbeatAt = videoHeartbeatAt(mode);
  const heartbeatReset = Boolean(heartbeatBaseline && heartbeatAt && !timestampIsAfter(heartbeatAt, heartbeatBaseline));
  if (heartbeatReset) {
    parts.push("等待新心跳");
  } else if (typeof mode.heartbeatAgeSec === "number" && Number.isFinite(mode.heartbeatAgeSec)) {
    parts.push(`${Math.round(mode.heartbeatAgeSec)} 秒前心跳`);
  } else if (mode.lastHeartbeatAt) {
    parts.push("有心跳记录");
  }
  if (mode.producerVisible) {
    parts.push("推流端可见");
  }
  if (mode.source) {
    parts.push(mode.source);
  }
  return parts.join(" · ");
}

function videoPushHeadline(status: VideoPushStatus | null) {
  if (!status) {
    return "读取中";
  }
  const activeModes = status.availableModes || [];
  if (status.conflict || activeModes.length > 1) {
    return "双链路推流";
  }
  return videoModeLabel(status.activeMode);
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
  const [loading, setLoading] = useState(!initialStatus);
  const [busy, setBusy] = useState(false);
  const [sidebarRefreshBusy, setSidebarRefreshBusy] = useState(false);
  const [portBusyKey, setPortBusyKey] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(DEFAULT_VIDEO_ASPECT_RATIO);
  const [videoStatus, setVideoStatus] = useState("云端视频待机");
  const [videoTransport, setVideoTransport] = useState<"idle" | "connecting" | "webrtc" | "mp4" | "error">("idle");
  const [videoPushStatus, setVideoPushStatus] = useState<VideoPushStatus | null>(null);
  const [videoPushStatusError, setVideoPushStatusError] = useState("");
  const [videoPushStatusUpdatedAt, setVideoPushStatusUpdatedAt] = useState("");
  const [videoHeartbeatBaseline, setVideoHeartbeatBaseline] = useState<VideoHeartbeatBaseline | null>(null);
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
        const nextLocalStreamStatus = await getLocalStreamStatus();
        setLocalStreamStatus(nextLocalStreamStatus);
        setLocalStreamConfig(nextLocalStreamStatus.config);
        setLocalStreamDirty(false);
      } catch {
        setLocalStreamStatus(emptyLocalStreamStatus);
        setLocalStreamConfig(defaultLocalStreamConfig);
        setLocalStreamDirty(false);
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

  async function handleRefreshVideoPushSummary() {
    setError("");
    try {
      const nextStatus = await syncDashboardStatusSnapshot("refresh");
      if (!nextStatus.connected) {
        setVideoPushStatus(null);
        setVideoPushStatusError("");
        setVideoPushStatusUpdatedAt(formatUiLogTimestamp());
        setVideoHeartbeatBaseline(null);
        return;
      }

      const nextVideoPushStatus = await getVideoPushStatus();
      setVideoPushStatus(nextVideoPushStatus);
      setVideoPushStatusError("");
      setVideoPushStatusUpdatedAt(formatUiLogTimestamp());
      setVideoHeartbeatBaseline(buildVideoHeartbeatBaseline(nextVideoPushStatus));
    } catch (err) {
      setVideoPushStatusError(err instanceof Error ? err.message : "视频推流状态读取失败");
      setVideoPushStatusUpdatedAt(formatUiLogTimestamp());
      setError(err instanceof Error ? err.message : "视频推流状态读取失败");
    }
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
          setVideoPushStatusError("");
          setVideoPushStatusUpdatedAt("");
        }
        return;
      }

      polling = true;
      try {
        const nextStatus = await getVideoPushStatus();
        if (!alive) {
          return;
        }
        setVideoPushStatus(nextStatus);
        setVideoPushStatusError("");
        setVideoPushStatusUpdatedAt(formatUiLogTimestamp());
      } catch (err) {
        if (!alive) {
          return;
        }
        setVideoPushStatus(null);
        setVideoPushStatusError(err instanceof Error ? err.message : "视频推流状态读取失败");
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
        const nextLocalStreamStatus = await getLocalStreamStatus();
        if (!alive) {
          return;
        }
        setLocalStreamStatus(nextLocalStreamStatus);
        setLocalStreamConfig((current) => {
          if (localStreamBusy || localStreamDirty || activeView === "localStream") {
            return current;
          }
          return nextLocalStreamStatus.config;
        });
        if (!nextLocalStreamStatus.camera_connected && !nextLocalStreamStatus.push_visible && activeView === "localStream") {
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
  }, [status.connected, activeView, localStreamBusy, localStreamDirty, accessInfo.webMode]);

  useEffect(() => {
    if (localStreamDirty) {
      return;
    }
    setLocalStreamDraft(buildLocalStreamDraft(localStreamConfig));
  }, [localStreamConfig, localStreamDirty]);

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

  function patchLocalStreamSizeConfig(field: LocalStreamSizeConfigKey, axis: "width" | "height", nextValue: number) {
    localStreamEditSeqRef.current += 1;
    setLocalStreamDirty(true);
    setLocalStreamConfig((current) => {
      const currentSize = parseLocalStreamSize(current[field]);
      const nextWidth = axis === "width" ? nextValue : currentSize.width;
      const nextHeight = axis === "height" ? nextValue : currentSize.height;
      return {
        ...current,
        [field]: formatLocalStreamSize(nextWidth, nextHeight),
      };
    });
  }

  function patchLocalStreamSizeDraft(
    _field: LocalStreamSizeConfigKey,
    draftKey: LocalStreamSizeDraftKey,
    _axis: "width" | "height",
    rawValue: string,
  ) {
    markLocalStreamDraftDirty();
    setLocalStreamDraft((current) => ({ ...current, [draftKey]: rawValue }));
  }

  function commitLocalStreamSizeDraft(
    field: LocalStreamSizeConfigKey,
    draftKey: LocalStreamSizeDraftKey,
    axis: "width" | "height",
    rawValue: string,
    fallback: number,
  ) {
    markLocalStreamDraftDirty();
    const nextValue = parseDraftInteger(rawValue, fallback, 1);
    setLocalStreamDraft((current) => ({ ...current, [draftKey]: String(nextValue) }));
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
        setVideoPushStatusError("");
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
      setVideoPushStatusError("");
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
    if (tencentCloudPushBusy) {
      return;
    }

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
    setTencentCloudPushOpen(true);
    setTencentCloudPushMessage(
      tencentCloudPushRunning ? "腾讯云推流中，可到拉流页查看 robot_control" : "推流码已就绪，选择视频源后开始",
    );
  }

  function openTencentCloudPlayDialog() {
    if (tencentCloudPlayBusy) {
      return;
    }

    setTencentCloudPlayDraftUrl(tencentCloudPlayUrl || readSavedTencentCloudPlayUrl());
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
    };
  }, []);

  function renderTrafficMonitorPanel() {
    const nowMs = trafficHistory[trafficHistory.length - 1]?.timestampMs || trafficSnapshot.timestamp_ms || Date.now();
    const windowStartMs = nowMs - TRAFFIC_MONITOR_WINDOW_MS;
    const sampledPoints = (trafficHistory.length > 0
      ? trafficHistory
      : [{ timestampMs: nowMs, rxBps: 0, txBps: 0 }]).filter((point) => point.timestampMs >= windowStartMs - TRAFFIC_MONITOR_POLL_INTERVAL_MS);
    const firstSamplePoint = sampledPoints[0] || { timestampMs: nowMs, rxBps: 0, txBps: 0 };
    const latestPoint = sampledPoints[sampledPoints.length - 1] || firstSamplePoint;
    const chartPoints = [
      { timestampMs: windowStartMs, rxBps: firstSamplePoint.rxBps, txBps: firstSamplePoint.txBps },
      ...sampledPoints.filter((point) => point.timestampMs > windowStartMs && point.timestampMs < nowMs - 1),
      { timestampMs: nowMs, rxBps: latestPoint.rxBps, txBps: latestPoint.txBps },
    ];
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
      if (!linePath) {
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
    const activeModes = videoPushStatus?.availableModes || [];
    const headline = videoPushStatusError
      ? "读取失败"
      : status.connected
        ? videoPushHeadline(videoPushStatus)
        : "未连接";
    const note = videoPushStatusError
      ? videoPushStatusError
      : videoPushStatusUpdatedAt
        ? `每 5 秒刷新 · 最近 ${videoPushStatusUpdatedAt}`
        : status.connected
          ? "正在读取服务器推流状态"
          : "连接服务器后显示推流状态";
    const legacy = videoPushStatus?.legacy;
    const tencent = videoPushStatus?.tencent;
    const legacyPushedByThisMachine = !accessInfo.webMode && Boolean(localStreamStatus.running && legacy?.live);
    const tencentPushedByThisMachine = Boolean(tencentCloudPushRunning && tencent?.live);
    const headlineClass =
      !status.connected
        ? "offline"
        : videoPushStatus?.conflict || activeModes.length > 1
        ? "conflict"
        : videoPushStatus?.activeMode === "offline"
          ? "offline"
          : videoPushStatusError
            ? "error"
            : "active";

    return (
      <button
        type="button"
        className="panel summary-card summary-card-button video-push-summary-card"
        onClick={() => void handleRefreshVideoPushSummary()}
        title="手动刷新视频推流状态"
      >
        <div className="summary-card-title">视频推流状态</div>
        <div className={`summary-card-value video-push-summary-value ${headlineClass}`}>{headline}</div>
        <div className="video-push-mode-grid">
          <div className="video-push-mode-row">
            <span className={`local-stream-signal-lamp ${videoModeLampClassForLocal(legacy, legacyPushedByThisMachine)}`} aria-hidden="true" />
            <div>
              <span>旧链路</span>
              <strong>{videoModeStateLabel(legacy)}</strong>
              <small>{videoModeNote(legacy, STREAM_NAME, videoHeartbeatBaseline?.legacy)}</small>
            </div>
          </div>
          <div className="video-push-mode-row">
            <span className={`local-stream-signal-lamp ${videoModeLampClassForLocal(tencent, tencentPushedByThisMachine)}`} aria-hidden="true" />
            <div>
              <span>腾讯云</span>
              <strong>{videoModeStateLabel(tencent)}</strong>
              <small>{videoModeNote(tencent, "robot_control", videoHeartbeatBaseline?.tencent)}</small>
            </div>
          </div>
        </div>
        <div className="summary-card-note">{note}</div>
      </button>
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

        <section className="summary-grid">
          {renderVideoPushStatusCard()}
          {renderControlSignalStatusCard()}
          <SummaryCard title="公网入口" value={status.public_base_url} note="浏览器与 API 访问地址" />
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
    const previewActive = videoEnabled && status.connected;
    const previewReady = videoTransport === "webrtc" || videoTransport === "mp4";
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
    const previewOverlayTitle = !videoEnabled
      ? "视频预览已关闭"
      : !status.connected
        ? "请先连接云服务器"
        : videoTransport === "connecting"
          ? "正在连接云端视频"
          : videoTransport === "error"
            ? "视频预览失败"
            : videoTransport === "mp4"
              ? "正在播放 MP4 预览"
              : "正在播放 WebRTC 预览";
    const previewOverlayNote = !videoEnabled
      ? "打开右上角开关后开始拉取画面"
      : !status.connected
        ? "当前未建立云端会话"
        : videoTransport === "connecting"
          ? `${videoStatus}，最多等待约 7 秒`
          : videoStatus;

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
                <div className="section-subtitle">查看当前云服务器接收到的 main-camera 画面</div>
              </div>
              <ToggleSwitch
                checked={videoEnabled}
                size="lg"
                ariaLabel="toggle cloud video preview"
                disabled={busy}
                onClick={() => setVideoEnabled((current) => !current)}
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
              {videoTransport === "webrtc"
                ? `WebRTC · ${videoStatus}`
                : videoTransport === "mp4"
                  ? `MP4 · ${videoStatus}`
                  : videoTransport === "connecting"
                    ? `Connecting · ${videoStatus}`
                    : videoStatus}
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
      ? "网页端暂不支持旧链路推流，请使用腾讯云推流"
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
    const legacyOnlyControlsDisabled = tencentCloudConfigActive;
    const legacyOnlyFieldClass = legacyOnlyControlsDisabled ? "field local-stream-field-disabled" : "field";
    const legacyOnlyToggleClass = legacyOnlyControlsDisabled
      ? "toggle-line local-stream-toggle local-stream-field-disabled"
      : "toggle-line local-stream-toggle";
    const legacyOnlyFieldTitle = legacyOnlyControlsDisabled ? "腾讯云推流不使用此项" : undefined;
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
      if (!webLocalStreamMode) {
        return signal;
      }
      if (signal.key === "local") {
        return {
          ...signal,
          state: "pending",
          value: "仅腾讯云",
          note: "旧链路开始推流暂不可用",
        };
      }
      if (signal.key === "push") {
        return {
          ...signal,
          state: tencentCloudPushRunning || tencentCloudRestorableByThisBrowser ? "live" : tencentCloudOccupiedByOther ? "pending" : "off",
          value: tencentCloudPushRunning
            ? "推流中"
            : tencentCloudRestorableByThisBrowser
              ? "可恢复"
              : tencentCloudOccupiedByOther
                ? "占用中"
                : "未推流",
          note: tencentCloudPushRunning
            ? "正在通过腾讯云 WebRTC 推流"
            : tencentCloudRestorableByThisBrowser
              ? "当前浏览器可继续管理这路推流"
              : tencentCloudOccupiedByOther
                ? "其他人正在腾讯云推流"
                : "等待腾讯云推流启动",
        };
      }
      if (signal.key === "pull") {
        return {
          ...signal,
          state: tencentCloudPlayOpen ? "live" : "off",
          value: tencentCloudPlayOpen ? "已打开" : "未打开",
          note: tencentCloudPlayOpen ? "网页端观看窗口已打开" : tencentCloudViewerReady ? "可打开腾讯云观看页" : "可在腾讯云推流成功后打开观看",
        };
      }
      return signal;
    });
    const localStreamAllSignalsLive = localStreamSignals.every((signal) => signal.state === "live");
    const cameraSelectOptions: LocalStreamSelectOption[] = [
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
    const inputFormatOptions: LocalStreamSelectOption[] = [
      { value: "", label: "默认", description: "自动识别输入格式" },
      { value: "mjpeg", label: "MJPEG", description: "多帧图像输入" },
    ];
    const videoEncoderOptions: LocalStreamSelectOption[] = [
      { value: "libx264", label: "libx264", description: "通用软件编码" },
      { value: "h264_nvenc", label: "h264_nvenc", description: "NVIDIA 硬编" },
      { value: "h264_amf", label: "h264_amf", description: "AMD 硬编，失败后自动降级" },
      { value: "h264_qsv", label: "h264_qsv", description: "Intel QSV 硬编" },
    ];
    const publicSchemeOptions: LocalStreamSelectOption[] = [
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
                  ? "网页端仅支持腾讯云 WebRTC 推流；旧链路开始推流暂不可用"
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
              disabled={localStreamBusy || localStreamSetupBusy}
              onClick={openTencentCloudPushCodeDialog}
            >
              腾讯云推流 (BETA)
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
                  <div className="section-title">腾讯云推流 (BETA)</div>
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
                  <LocalStreamSelect
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
                  disabled={!tencentCloudViewerReady || tencentCloudPlayBusy}
                  onClick={() => void startTencentCloudWebPlayer(tencentCloudViewerUrl)}
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
            <LocalStreamSelect
              className={legacyOnlyControlsDisabled ? "local-stream-field-disabled" : ""}
              label="摄像头"
              value={localStreamConfig.camera_name}
              options={cameraSelectOptions}
              placeholder="自动选择"
              disabled={legacyOnlyControlsDisabled}
              onChange={(nextValue) => patchLocalStreamConfig({ camera_name: nextValue })}
            />
            <LocalStreamSelect
              className={legacyOnlyControlsDisabled ? "local-stream-field-disabled" : ""}
              label="输入格式"
              value={localStreamConfig.input_format}
              options={inputFormatOptions}
              placeholder="默认"
              disabled={legacyOnlyControlsDisabled}
              onChange={(nextValue) => patchLocalStreamConfig({ input_format: nextValue })}
            />
            <LocalStreamSelect
              className={legacyOnlyControlsDisabled ? "local-stream-field-disabled" : ""}
              label="编码器"
              value={localStreamConfig.video_encoder}
              options={videoEncoderOptions}
              placeholder="libx264"
              disabled={legacyOnlyControlsDisabled}
              onChange={(nextValue) => patchLocalStreamConfig({ video_encoder: nextValue })}
            />
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>采集分辨率</span>
              <div className="local-stream-dimension-pair">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={localStreamDraft.videoWidth}
                  aria-label="采集宽度"
                  disabled={legacyOnlyControlsDisabled}
                  onChange={(event) => patchLocalStreamSizeDraft("video_size", "videoWidth", "width", event.target.value)}
                  onBlur={(event) =>
                    commitLocalStreamSizeDraft("video_size", "videoWidth", "width", event.target.value, inputSize.width)
                  }
                />
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={localStreamDraft.videoHeight}
                  aria-label="采集高度"
                  disabled={legacyOnlyControlsDisabled}
                  onChange={(event) => patchLocalStreamSizeDraft("video_size", "videoHeight", "height", event.target.value)}
                  onBlur={(event) =>
                    commitLocalStreamSizeDraft("video_size", "videoHeight", "height", event.target.value, inputSize.height)
                  }
                />
              </div>
            </label>
            <label className="field">
              <span>输出分辨率</span>
              <div className="local-stream-dimension-pair">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={localStreamDraft.outputWidth}
                  aria-label="输出宽度"
                  onChange={(event) =>
                    patchLocalStreamSizeDraft("output_video_size", "outputWidth", "width", event.target.value)
                  }
                  onBlur={(event) =>
                    commitLocalStreamSizeDraft(
                      "output_video_size",
                      "outputWidth",
                      "width",
                      event.target.value,
                      outputSize.width,
                    )
                  }
                />
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={localStreamDraft.outputHeight}
                  aria-label="输出高度"
                  onChange={(event) =>
                    patchLocalStreamSizeDraft("output_video_size", "outputHeight", "height", event.target.value)
                  }
                  onBlur={(event) =>
                    commitLocalStreamSizeDraft(
                      "output_video_size",
                      "outputHeight",
                      "height",
                      event.target.value,
                      outputSize.height,
                    )
                  }
                />
              </div>
            </label>
            <label className={legacyOnlyFieldClass} title={legacyOnlyFieldTitle}>
              <span>采集帧率</span>
              <input
                className="input"
                type="number"
                min={1}
                max={120}
                value={localStreamDraft.inputFramerate}
                disabled={legacyOnlyControlsDisabled}
                onChange={(event) =>
                  patchLocalStreamNumberDraft("inputFramerate", "input_framerate", event.target.value, 1, 120)
                }
                onBlur={(event) =>
                  commitLocalStreamNumberDraft(
                    "inputFramerate",
                    "input_framerate",
                    event.target.value,
                    localStreamConfig.input_framerate,
                    1,
                    120,
                  )
                }
              />
            </label>
            <label className="field">
              <span>目标帧率</span>
              <input
                className="input"
                type="number"
                min={1}
                max={120}
                value={localStreamDraft.targetFramerate}
                onChange={(event) =>
                  patchLocalStreamNumberDraft("targetFramerate", "target_framerate", event.target.value, 1, 120)
                }
                onBlur={(event) =>
                  commitLocalStreamNumberDraft(
                    "targetFramerate",
                    "target_framerate",
                    event.target.value,
                    localStreamConfig.target_framerate,
                    1,
                    120,
                  )
                }
              />
            </label>
            <label className="field">
              <span>视频码率</span>
              <div className="local-stream-input-with-unit">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={localStreamDraft.videoBitrateKbps}
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
            <LocalStreamSelect
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

  function renderGames() {
    return <TankTroublePanel theme={theme} localCountryCode={status.network_snapshot.local.country_code} canRunSetup={canRunAdminActions} />;
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
      accessRoleLabel={accessInfo.webMode ? (accessInfo.admin ? "管理员入口" : "普通用户入口") : ""}
      activeView={activeView}
      localStreamAvailable={localStreamAvailable}
      canRunSetup={canRunAdminActions}
      busy={busy}
      sidebarRefreshBusy={sidebarRefreshBusy}
      setupBusy={setupBusy}
      setupProgress={setupProgress}
      setupMessage={setupMessage}
      setupTone={setupTone}
      scrollLocked={activeView === "games"}
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
      {activeView === "games" ? renderGames() : null}

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

      {loading ? <div className="loading-overlay">正在加载控制台...</div> : null}
    </AppShell>
  );
}
