import { useEffect, useRef, useState } from "react";
import {
  checkAllPorts,
  checkPort,
  getControlMonitorConfig,
  getVideoPreviewUrl,
  getLiveStatus,
  getLogs,
  getStatus,
  logout,
  pollControlMonitorOffer,
  postControlMonitorAnswer,
  refreshNetworkSnapshot,
  refreshStatus,
  runLocalSetup,
  startAllServices,
  startService,
  stopAllServices,
  stopService,
  switchIngestMode,
} from "../api/cloudApi";
import { ActivityLog } from "../components/ActivityLog";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { HealthPanel } from "../components/HealthPanel";
import { MetricCard } from "../components/MetricCard";
import { ServiceCard } from "../components/ServiceCard";
import { SummaryCard } from "../components/SummaryCard";
import { TankTroublePanel } from "../components/TankTroublePanel";
import { ToggleSwitch } from "../components/ToggleSwitch";
import type { AppUpdaterState } from "../hooks/useAppUpdater";
import type {
  ControlMonitorConfig,
  DashboardStatus,
  LogEntry,
  PortStatus,
} from "../types/cloud";

type DashboardPageProps = {
  initialStatus?: DashboardStatus;
  theme: "light" | "dark";
  updater: AppUpdaterState;
  onToggleTheme: () => void;
  onInstallUpdate: () => void;
  onLogoutDone: () => void;
};

type ConsoleView = "overview" | "services" | "health" | "activity" | "games";

const POLL_INTERVAL_MS = 5000;
const STREAM_NAME = "main-camera";
const STREAM_CONNECT_TIMEOUT_MS = 7000;
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;
const CONTROL_MONITOR_KEY_ROWS = [
  ["TAB", "Q", "W", "E", "R", "T", "F", "ESC"],
  ["A", "S", "D", "Z", "X"],
  ["I", "K", "J", "L", "U", "O", ";", "ENTER"],
  ["N", "M", "H", "Y"],
];

const CONTROL_MONITOR_SPECIAL_KEY_LABELS: Record<string, string> = {
  ENTER: "ENTER",
  ESCAPE: "ESC",
  SEMICOLON: ";",
  SPACE: "SPACE",
  TAB: "TAB",
};

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

function normalizeIngestMode(mode: string | undefined) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "http" || normalized === "srt") {
    return normalized;
  }
  return "unknown";
}

function ingestModeLabel(mode: string | undefined) {
  const normalized = normalizeIngestMode(mode);
  if (normalized === "http") {
    return "HTTP";
  }
  if (normalized === "srt") {
    return "SRT";
  }
  return "Unknown";
}

function nextIngestMode(mode: string | undefined) {
  return normalizeIngestMode(mode) === "http" ? "srt" : "http";
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

async function waitForIceGatheringComplete(peer: RTCPeerConnection, timeoutMs = 1500) {
  if (peer.iceGatheringState === "complete") {
    return;
  }

  await new Promise<void>((resolve) => {
    const timerId = window.setTimeout(() => {
      peer.removeEventListener("icegatheringstatechange", handleStateChange);
      resolve();
    }, timeoutMs);

    function handleStateChange() {
      if (peer.iceGatheringState !== "complete") {
        return;
      }
      window.clearTimeout(timerId);
      peer.removeEventListener("icegatheringstatechange", handleStateChange);
      resolve();
    }

    peer.addEventListener("icegatheringstatechange", handleStateChange);
  });
}

export function DashboardPage({
  initialStatus,
  theme,
  updater,
  onToggleTheme,
  onInstallUpdate,
  onLogoutDone,
}: DashboardPageProps) {
  const [activeView, setActiveView] = useState<ConsoleView>("overview");
  const [status, setStatus] = useState<DashboardStatus>(initialStatus ?? emptyStatus);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [portChecks, setPortChecks] = useState<PortStatus[]>(initialStatus?.port_checks ?? emptyStatus.port_checks);
  const [loading, setLoading] = useState(!initialStatus);
  const [busy, setBusy] = useState(false);
  const [sidebarRefreshBusy, setSidebarRefreshBusy] = useState(false);
  const [portBusyKey, setPortBusyKey] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(DEFAULT_VIDEO_ASPECT_RATIO);
  const [videoStatus, setVideoStatus] = useState("云端视频待机");
  const [videoTransport, setVideoTransport] = useState<"idle" | "connecting" | "webrtc" | "mp4" | "error">("idle");
  const [controlMonitorEnabled, setControlMonitorEnabled] = useState(false);
  const [controlMonitorStatus, setControlMonitorStatus] = useState("本地控制监视待机");
  const [controlMonitorPeerState, setControlMonitorPeerState] = useState("idle");
  const [controlMonitorConnected, setControlMonitorConnected] = useState(false);
  const [controlMonitorPressedKeys, setControlMonitorPressedKeys] = useState<string[]>([]);
  const [controlMonitorMessageCount, setControlMonitorMessageCount] = useState(0);
  const [controlMonitorLastEventAt, setControlMonitorLastEventAt] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupTone, setSetupTone] = useState<"idle" | "progress" | "success" | "error">("idle");
  const [setupPasswordDialogOpen, setSetupPasswordDialogOpen] = useState(false);
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordError, setSetupPasswordError] = useState("");
  const [modeSwitchBusy, setModeSwitchBusy] = useState(false);
  const [modeSwitchProgress, setModeSwitchProgress] = useState(0);
  const [modeSwitchMessage, setModeSwitchMessage] = useState("");
  const [modeSwitchTone, setModeSwitchTone] = useState<"idle" | "progress" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const setupProgressTimerRef = useRef<number | null>(null);
  const setupMessageTimerRef = useRef<number | null>(null);
  const modeSwitchProgressTimerRef = useRef<number | null>(null);
  const modeSwitchMessageTimerRef = useRef<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewPeerRef = useRef<RTCPeerConnection | null>(null);
  const previewSocketRef = useRef<WebSocket | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const controlMonitorPeerRef = useRef<RTCPeerConnection | null>(null);
  const controlMonitorChannelRef = useRef<RTCDataChannel | null>(null);

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

  function closeControlMonitorTransport() {
    if (controlMonitorChannelRef.current) {
      try {
        controlMonitorChannelRef.current.close();
      } catch {
      } finally {
        controlMonitorChannelRef.current = null;
      }
    }

    if (controlMonitorPeerRef.current) {
      try {
        controlMonitorPeerRef.current.close();
      } catch {
      } finally {
        controlMonitorPeerRef.current = null;
      }
    }
  }

  function resetControlMonitorSurface(statusText = "本地控制监视待机") {
    closeControlMonitorTransport();
    setControlMonitorConnected(false);
    setControlMonitorPeerState("idle");
    setControlMonitorPressedKeys([]);
    setControlMonitorStatus(statusText);
  }

  async function loadAll(kind: "status" | "refresh" = "status") {
    setError("");
    if (kind === "refresh") {
      setBusy(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextStatus, nextLogs] = await Promise.all([
        kind === "refresh" ? refreshStatus() : getStatus(),
        getLogs(),
      ]);
      setStatus(nextStatus);
      setLogs(nextLogs.logs);
      setPortChecks((current) => {
        if (!nextStatus.connected || current.length === 0) {
          return nextStatus.port_checks;
        }
        return current;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载状态失败");
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
      setPortChecks(initialStatus.port_checks);
      setLoading(false);
      getLogs()
        .then((nextLogs) => setLogs(nextLogs.logs))
        .catch(() => undefined);
      return;
    }
    loadAll("status");
  }, [initialStatus]);

  useEffect(() => {
    let alive = true;
    let polling = false;

    async function tick() {
      if (polling) {
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
          setLogs(nextLogs.logs);
        }
      } catch {
        return;
      } finally {
        polling = false;
      }
    }

    const timerId = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      window.clearInterval(timerId);
    };
  }, [activeView]);

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

    if (!shouldMonitor) {
      resetControlMonitorSurface(status.connected ? "本地控制监视待机" : "请先连接云服务器");
      return () => undefined;
    }

    setControlMonitorPressedKeys([]);
    setControlMonitorMessageCount(0);
    setControlMonitorLastEventAt("");
    setControlMonitorConnected(false);
    setControlMonitorPeerState("waiting");
    setControlMonitorStatus("正在等待前端控制连接");

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

    const handleControlMessage = (channel: RTCDataChannel, rawMessage: unknown) => {
      let payloadText = "";
      if (typeof rawMessage === "string") {
        payloadText = rawMessage;
      } else if (rawMessage instanceof ArrayBuffer) {
        payloadText = new TextDecoder().decode(rawMessage);
      } else if (rawMessage instanceof Blob) {
        void rawMessage.text().then((nextText) => handleControlMessage(channel, nextText));
        return;
      } else {
        payloadText = String(rawMessage ?? "");
      }

      try {
        const payload = unwrapControlMonitorPayload(JSON.parse(payloadText));
        if (!payload) {
          setStatusSafe("收到无法识别的控制消息");
          return;
        }

        const messageType = String(payload.type || "").trim();
        const pressedKeyPayload = payload.pressedKeys ?? payload.pressed_keys ?? payload.keys;

        if (messageType === "keyboard_sample") {
          setControlMonitorPressedKeys(normalizePressedControlKeys(pressedKeyPayload));
          setControlMonitorMessageCount((current) => current + 1);
          updateLastEventAt();
          setStatusSafe("正在接收前端键盘控制");
        } else if (messageType === "vr_sample") {
          setControlMonitorPressedKeys([]);
          setControlMonitorMessageCount((current) => current + 1);
          updateLastEventAt();
          setStatusSafe("正在接收前端 VR 控制，键盘样本为空");
        } else if (messageType === "text_instruction") {
          setControlMonitorPressedKeys([]);
          setControlMonitorMessageCount((current) => current + 1);
          updateLastEventAt();
          setStatusSafe("正在接收前端文本控制，键盘样本为空");
        } else if (messageType === "client_hello") {
          setControlMonitorMessageCount((current) => current + 1);
          updateLastEventAt();
          setStatusSafe("控制通道已连接，等待控制输入");
        } else if (messageType === "ping") {
          try {
            channel.send(JSON.stringify({ type: "pong" }));
          } catch {
          }
        }
      } catch {
        setStatusSafe("收到无法解析的控制消息");
      }
    };

    void (async () => {
      let monitorConfig: ControlMonitorConfig;
      try {
        monitorConfig = await getControlMonitorConfig();
      } catch (err) {
        setStatusSafe(err instanceof Error ? `控制监视启动失败：${err.message}` : "控制监视启动失败");
        setPeerStateSafe("error");
        return;
      }

      while (!disposed) {
        let offer = null;
        try {
          offer = await pollControlMonitorOffer(monitorConfig.session);
        } catch (err) {
          setStatusSafe(err instanceof Error ? `拉取控制 offer 失败：${err.message}` : "拉取控制 offer 失败");
          setPeerStateSafe("error");
          return;
        }

        if (disposed) {
          return;
        }

        if (!offer) {
          await sleep(Math.max(100, monitorConfig.poll_interval_sec * 1000));
          continue;
        }

        setStatusSafe("收到浏览器控制请求，正在建立通道");
        setPeerStateSafe("connecting");
        setConnectedSafe(false);
        setControlMonitorPressedKeys([]);

        const peer = new RTCPeerConnection({
          iceServers: monitorConfig.turn_urls.length
            ? [
                {
                  urls: monitorConfig.turn_urls,
                  username: monitorConfig.turn_username,
                  credential: monitorConfig.turn_credential,
                },
              ]
            : [],
        });
        controlMonitorPeerRef.current = peer;

        try {
          let closeResolver: (() => void) | null = null;
          const channelClosed = new Promise<void>((resolve) => {
            closeResolver = resolve;
          });

          const channelOpened = new Promise<RTCDataChannel>((resolve, reject) => {
            const openTimeoutId = window.setTimeout(() => {
              reject(new Error("等待控制 DataChannel 打开超时"));
            }, 20000);

            const rejectIfNeeded = (reason: string) => {
              window.clearTimeout(openTimeoutId);
              reject(new Error(reason));
            };

            peer.onconnectionstatechange = () => {
              setPeerStateSafe(peer.connectionState || "connecting");
              if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
                setConnectedSafe(false);
                if (closeResolver) {
                  closeResolver();
                }
                rejectIfNeeded(`控制连接状态异常：${peer.connectionState}`);
              }
              if (peer.connectionState === "closed") {
                setConnectedSafe(false);
                if (closeResolver) {
                  closeResolver();
                }
              }
            };

            peer.ondatachannel = (event) => {
              const channel = event.channel;
              controlMonitorChannelRef.current = channel;

              channel.onmessage = (messageEvent) => {
                handleControlMessage(channel, messageEvent.data);
              };

              channel.onopen = () => {
                window.clearTimeout(openTimeoutId);
                setConnectedSafe(true);
                setPeerStateSafe("connected");
                setStatusSafe("控制通道已连接，等待键盘输入");
                resolve(channel);
              };

              channel.onclose = () => {
                setConnectedSafe(false);
                setPeerStateSafe("closed");
                setControlMonitorPressedKeys([]);
                if (!disposed) {
                  setStatusSafe("控制连接已断开，等待新的前端连接");
                }
                if (closeResolver) {
                  closeResolver();
                }
              };

              channel.onerror = () => {
                if (!disposed) {
                  setStatusSafe("控制通道出现错误");
                }
              };

              if (channel.readyState === "open") {
                window.clearTimeout(openTimeoutId);
                setConnectedSafe(true);
                setPeerStateSafe("connected");
                setStatusSafe("控制通道已连接，等待键盘输入");
                resolve(channel);
              }
            };
          });

          await peer.setRemoteDescription(
            new RTCSessionDescription({
              sdp: offer.offer.sdp,
              type: offer.offer.type as RTCSdpType,
            }),
          );
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await waitForIceGatheringComplete(peer);

          if (!peer.localDescription) {
            throw new Error("本地控制 answer 尚未生成");
          }

          await postControlMonitorAnswer(monitorConfig.session, offer.offerId, {
            sdp: peer.localDescription.sdp,
            type: peer.localDescription.type,
          });

          setStatusSafe("已应答浏览器控制请求，等待数据通道");
          await channelOpened;
          await channelClosed;
          closeControlMonitorTransport();
        } catch (err) {
          closeControlMonitorTransport();
          setControlMonitorPressedKeys([]);
          setConnectedSafe(false);
          setPeerStateSafe("error");
          setStatusSafe(err instanceof Error ? `控制监视异常：${err.message}` : "控制监视异常");
          return;
        }
      }
    })();

    return () => {
      disposed = true;
      closeControlMonitorTransport();
    };
  }, [activeView, controlMonitorEnabled, status.connected]);

  async function withAction(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await loadAll("refresh");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
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
    try {
      const nextSnapshot = await refreshNetworkSnapshot();
      setStatus((current) => ({
        ...current,
        network_snapshot: nextSnapshot,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新连接信息失败");
    } finally {
      setSidebarRefreshBusy(false);
    }
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
    if (setupBusy) {
      return;
    }

    const password = setupPassword;
    if (!password) {
      setSetupPasswordError("请输入 SSH 密码。");
      return;
    }

    setSetupPasswordError("");
    setSetupBusy(true);
    startSetupProgressAnimation();
    try {
      await runLocalSetup({ password });
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
      setSetupPasswordError(message);
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

  function clearModeSwitchMessageTimer() {
    if (modeSwitchMessageTimerRef.current) {
      window.clearTimeout(modeSwitchMessageTimerRef.current);
      modeSwitchMessageTimerRef.current = null;
    }
  }

  function stopModeSwitchProgressAnimation() {
    if (modeSwitchProgressTimerRef.current) {
      window.clearInterval(modeSwitchProgressTimerRef.current);
      modeSwitchProgressTimerRef.current = null;
    }
  }

  function showModeSwitchFeedback(message: string, tone: "success" | "error", durationMs = 2000) {
    stopModeSwitchProgressAnimation();
    clearModeSwitchMessageTimer();
    setModeSwitchProgress(0);
    setModeSwitchTone(tone);
    setModeSwitchMessage(message);
    modeSwitchMessageTimerRef.current = window.setTimeout(() => {
      setModeSwitchTone("idle");
      setModeSwitchMessage("");
      setModeSwitchProgress(0);
      modeSwitchMessageTimerRef.current = null;
    }, durationMs);
  }

  function startModeSwitchProgressAnimation() {
    stopModeSwitchProgressAnimation();
    clearModeSwitchMessageTimer();
    setModeSwitchMessage("");
    setModeSwitchTone("progress");
    setModeSwitchProgress(8);
    modeSwitchProgressTimerRef.current = window.setInterval(() => {
      setModeSwitchProgress((current) => {
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

  async function handleSwitchIngestMode() {
    if (modeSwitchBusy) {
      return;
    }

    const targetMode = nextIngestMode(status.ingest_mode);
    setBusy(true);
    setModeSwitchBusy(true);
    setError("");
    clearModeSwitchMessageTimer();
    startModeSwitchProgressAnimation();

    try {
      const result = await switchIngestMode(targetMode);
      const [nextStatus, nextLogs] = await Promise.all([refreshStatus(), getLogs()]);

      setStatus(nextStatus);
      setLogs(nextLogs.logs);
      setPortChecks((current) => {
        if (!nextStatus.connected || current.length === 0) {
          return nextStatus.port_checks;
        }
        return current;
      });

      stopModeSwitchProgressAnimation();
      setModeSwitchProgress(100);
      window.setTimeout(() => {
        setBusy(false);
        setModeSwitchBusy(false);
        showModeSwitchFeedback(`当前模式为${ingestModeLabel(result.ingest_mode || nextStatus.ingest_mode)}`, "success");
      }, 180);
    } catch (err) {
      stopModeSwitchProgressAnimation();
      setBusy(false);
      setModeSwitchBusy(false);
      const message = err instanceof Error ? err.message : "接收模式切换失败";
      setError(message);
      showModeSwitchFeedback(message, "error", 3200);
    }
  }

  useEffect(() => {
    return () => {
      stopSetupProgressAnimation();
      clearSetupMessageTimer();
      stopModeSwitchProgressAnimation();
      clearModeSwitchMessageTimer();
    };
  }, []);

  const currentIngestMode = normalizeIngestMode(status.ingest_mode);
  const currentIngestModeLabel = ingestModeLabel(currentIngestMode);
  const targetIngestMode = nextIngestMode(currentIngestMode);
  const targetIngestModeLabel = ingestModeLabel(targetIngestMode);

  function renderSnapshotPanel() {
    return (
      <div className="panel snapshot-panel">
        <div className="section-title">连接快照</div>
        <div className="snapshot-row snapshot-row-first">
          <span>SSH Target</span>
          <strong>{status.ssh_target}</strong>
        </div>
        <div className="snapshot-row">
          <span>HTTP Base</span>
          <strong>{status.public_base_url}</strong>
        </div>
        <div className="snapshot-row">
          <span>Connection</span>
          <strong>{status.connected ? "Connected" : "Disconnected"}</strong>
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
            <Button variant="primary" loading={busy} onClick={() => withAction(startAllServices)}>
              启动全部
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => withAction(stopAllServices)}>
              停止全部
            </Button>
          </div>
        </section>

        <section className="summary-grid">
          <SummaryCard title="云端目标" value={status.ssh_target} note="SSH 登录目标" />
          <SummaryCard title="公网入口" value={status.public_base_url} note="浏览器与 API 访问地址" />
          <SummaryCard title="待处理控制" value={String(status.pending_offers)} note="当前控制中继待处理 offer 数量" />
          <SummaryCard title="当前模式" value={currentIngestModeLabel} note="云端视频接收模式" />
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
          {renderSnapshotPanel()}
          <HealthPanel checks={status.health_checks} />
        </section>
      </>
    );
  }

  function renderServices() {
    const previewActive = videoEnabled && status.connected;
    const previewReady = videoTransport === "webrtc" || videoTransport === "mp4";
    const pressedControlKeysSet = new Set(controlMonitorPressedKeys);
    const controlMonitorLampClass = !controlMonitorEnabled
      ? "idle"
      : controlMonitorConnected
        ? "live"
        : controlMonitorPeerState === "error"
          ? "off"
          : "pending";
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
              <div className="topbar-action-stack service-mode-stack">
                <Button
                  variant="secondary"
                  className="service-mode-button"
                  loading={modeSwitchBusy}
                  disabled={busy || modeSwitchBusy}
                  onClick={handleSwitchIngestMode}
                >
                  {`切换到 ${targetIngestModeLabel}`}
                </Button>
                <div className={`topbar-inline-feedback ${modeSwitchTone !== "idle" ? "visible" : ""} ${modeSwitchTone}`}>
                  {modeSwitchTone === "progress" ? (
                    <div className="topbar-progress-track" aria-hidden="true">
                      <div
                        className="topbar-progress-bar"
                        style={{ width: `${Math.max(0, Math.min(100, modeSwitchProgress))}%` }}
                      />
                    </div>
                  ) : modeSwitchMessage ? (
                    <span>{modeSwitchMessage}</span>
                  ) : null}
                </div>
              </div>
              <Button variant="primary" loading={busy} onClick={() => withAction(startAllServices)}>
                启动全部
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => withAction(stopAllServices)}>
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
                <div className="section-subtitle">开启后本机将临时占用 robot-control 接收端，用于查看前端控制按键。</div>
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
              <div className="control-monitor-status-row">
                <span className={`control-monitor-lamp ${controlMonitorLampClass}`} />
                <div className="control-monitor-status-copy">
                  <div className="control-monitor-status-title">{controlMonitorStatus}</div>
                  <div className="control-monitor-status-note">
                    {controlMonitorEnabled
                      ? `session=robot-control · state=${controlMonitorPeerState}`
                      : "关闭时不会占用控制会话"}
                  </div>
                </div>
              </div>

              <div className="control-monitor-keyboard" aria-label="control monitor keyboard">
                {CONTROL_MONITOR_KEY_ROWS.map((row) => (
                  <div className="control-monitor-key-row" key={row.join("")}>
                    {row.map((keyName) => (
                      <div
                        className={`control-monitor-key ${pressedControlKeysSet.has(keyName) ? "active" : ""}`}
                        key={keyName}
                      >
                        {keyName}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="control-monitor-meta">
                <span>{`已收消息 ${controlMonitorMessageCount}`}</span>
                <span>{controlMonitorPressedKeys.length ? `当前按键 ${controlMonitorPressedKeys.join(" ")}` : "当前按键 -"}</span>
                <span>{controlMonitorLastEventAt ? `最近更新 ${controlMonitorLastEventAt}` : "最近更新 -"}</span>
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
      <section>
        <ActivityLog logs={logs} />
      </section>
    );
  }

  function renderGames() {
    return <TankTroublePanel theme={theme} localCountryCode={status.network_snapshot.local.country_code} />;
  }

  const currentView = VIEW_META[activeView];

  return (
    <AppShell
      networkSnapshot={status.network_snapshot}
      title={currentView.title}
      statusText={status.summary_status}
      theme={theme}
      updater={updater}
      activeView={activeView}
      busy={busy}
      sidebarRefreshBusy={sidebarRefreshBusy}
      setupBusy={setupBusy}
      setupProgress={setupProgress}
      setupMessage={setupMessage}
      setupTone={setupTone}
      scrollLocked={activeView === "games"}
      onViewChange={setActiveView}
      onRefresh={() => loadAll("refresh")}
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
      {activeView === "games" ? renderGames() : null}

      {setupPasswordDialogOpen ? (
        <div className="setup-password-overlay" role="presentation">
          <form className="setup-password-dialog panel" onSubmit={submitLocalSetupPassword}>
            <div>
              <div className="section-title">确认一键配置</div>
              <div className="section-subtitle">再次输入当前云服务器 SSH 密码，验证通过后才会执行配置。</div>
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
        </div>
      ) : null}

      {loading ? <div className="loading-overlay">正在加载控制台...</div> : null}
    </AppShell>
  );
}
