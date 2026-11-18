import type {
  AccountAvatar,
  AccountAuthRequest,
  AccountRegisterRequest,
  AccountSession,
  AdminUserList,
  AgentSettings,
  AgentSettingsRequest,
  ApiResponse,
  ControlMonitorConfig,
  ControlMonitorKeyState,
  ControlMonitorOffer,
  ControlSessionDescription,
  CaptureFileList,
  CaptureFileEntry,
  CaptureRecoveryKind,
  CaptureTask,
  CaptureTaskList,
  DashboardStatus,
  IngestModeResult,
  IngestModeSwitchRequest,
  LoginRequest,
  LoginSettings,
  LocalSetupRunRequest,
  LocalSetupResult,
  LocalSetupStatus,
  LocalStreamConfig,
  LocalStreamStatus,
  LogsResponse,
  NetworkSnapshot,
  P2PLocalPusherStatus,
  PortChecksResponse,
  PortStatus,
  SettingsRequest,
  TankTroubleMatchRequest,
  TankTroubleMatchState,
  TankTroubleLatencyRequest,
  TankTroubleLatencyState,
  TankTroublePageUrlResponse,
  TankTroublePreviewClearRequest,
  TankTroublePreviewPushRequest,
  TankTroubleRoomRequest,
  TankTroubleRoomStatusRequest,
  TankTroubleRoomState,
  TankTroubleSetupResult,
  TankTroubleSetupStatus,
  TrafficMonitorSnapshot,
  VideoPushModeStatus,
  VideoPushStatus,
} from "../types/cloud";

const FALLBACK_API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8765";
const LEGACY_ACCESS_TOKEN_STORAGE_KEY = "cloud-service-console.access-token";
const ACCOUNT_SESSION_STORAGE_KEY = "cloud-service-console.account-session";
let apiBasePromise: Promise<string> | null = null;
let onlineClientId: string | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTauriRuntime() {
  if (typeof window === "undefined") {
    return false;
  }
  return "__TAURI_IPC__" in window;
}

export async function getApiBase(): Promise<string> {
  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      if (isTauriRuntime()) {
        try {
          const { invoke } = await import("@tauri-apps/api/tauri");
          const base = await invoke<string>("get_backend_base_url");
          return base || FALLBACK_API_BASE;
        } catch {
          return FALLBACK_API_BASE;
        }
      }
      if (typeof window !== "undefined" && (window.location.protocol === "http:" || window.location.protocol === "https:")) {
        return window.location.origin;
      }
      return FALLBACK_API_BASE;
    })();
  }

  return apiBasePromise;
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.sessionStorage.getItem(ACCOUNT_SESSION_STORAGE_KEY) || "";
}

export function setAccountSessionToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.sessionStorage.setItem(ACCOUNT_SESSION_STORAGE_KEY, token);
  } else {
    window.sessionStorage.removeItem(ACCOUNT_SESSION_STORAGE_KEY);
  }
}

export function clearAccountSessionToken() {
  setAccountSessionToken("");
}

export function discardLegacyAccessToken() {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.has("access_token")) {
    url.searchParams.delete("access_token");
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }
  window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
}

function createOnlineClientId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getOnlineClientId() {
  if (typeof window === "undefined") {
    return "server-render";
  }
  if (onlineClientId) {
    return onlineClientId;
  }
  onlineClientId = createOnlineClientId();
  return onlineClientId;
}

function buildRequestHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  if (!nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }
  const token = getStoredAccessToken();
  if (token && !nextHeaders.has("Authorization")) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }
  return nextHeaders;
}

function toWebSocketUrl(apiBase: string, path: string) {
  const url = new URL(path, apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  let lastError: unknown = new Error("Failed to fetch backend.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const apiBase = await getApiBase();
  const response = await fetchWithRetry(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...Object.fromEntries(buildRequestHeaders(options?.headers).entries()),
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      message = String(payload?.detail || payload?.message || message);
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function requestResponse(path: string, options?: RequestInit): Promise<Response> {
  const apiBase = await getApiBase();
  const response = await fetchWithRetry(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...Object.fromEntries(buildRequestHeaders(options?.headers).entries()),
    },
  });

  if (!response.ok && response.status !== 204) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      message = String(payload?.detail || payload?.message || message);
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response;
}

export function getHealth() {
  return request<ApiResponse>("/api/health");
}

export type AccessInfo = {
  webMode: boolean;
  authenticated: boolean;
  username: string;
  role: "desktop" | "admin" | "user";
  admin: boolean;
  avatarDataUrl: string;
  defaultHost: string;
  defaultSshUsername: string;
};

export type OnlinePresence = {
  onlineCount: number;
  updatedAt: string;
  role?: AccessInfo["role"] | "user";
};

export function getAccessInfo() {
  return request<AccessInfo>("/api/access");
}

export function loginAccount(payload: AccountAuthRequest) {
  return request<AccountSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerAccount(payload: AccountRegisterRequest) {
  return request<AccountSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginAccountWithDevice(deviceToken: string) {
  return request<AccountSession>("/api/auth/device-login", {
    method: "POST",
    body: JSON.stringify({ device_token: deviceToken }),
  });
}

export function logoutAccount() {
  return request<ApiResponse>("/api/auth/logout", { method: "POST" });
}

export function saveAccountAvatar(dataUrl: string) {
  return request<AccountAvatar>("/api/account/avatar", {
    method: "PUT",
    body: JSON.stringify({ data_url: dataUrl }),
  });
}

export function getAdminUsers() {
  return request<AdminUserList>("/api/admin/users");
}

export function getAgentSettings() {
  return request<AgentSettings>("/api/agent/settings");
}

export function saveAgentSettings(payload: AgentSettingsRequest) {
  return request<AgentSettings>("/api/agent/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function testAgentSettings() {
  return request<ApiResponse>("/api/agent/settings/test", { method: "POST" });
}

export function getCaptureFiles(limit = 0) {
  return request<CaptureFileList>(`/api/captures/files?limit=${encodeURIComponent(String(limit))}`);
}

export async function downloadCaptureFile(captureId: string, filename: string) {
  await downloadCapture({ file_id: captureId }, filename);
}

export function getCaptureTasks() {
  return request<CaptureTaskList>("/api/captures/tasks");
}

function encodeUtf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return window.btoa(binary);
}

export async function uploadCaptureRecoveryFile(
  taskId: string,
  kind: CaptureRecoveryKind,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const apiBase = await getApiBase();
  return new Promise<CaptureFileEntry>((resolve, reject) => {
    const upload = new XMLHttpRequest();
    upload.open("POST", `${apiBase}/api/captures/upload`);
    upload.timeout = 60 * 60 * 1000;
    const token = getStoredAccessToken();
    if (token) upload.setRequestHeader("Authorization", `Bearer ${token}`);
    upload.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    upload.setRequestHeader("X-Telebot-Capture-Filename-B64", encodeUtf8Base64(file.name));
    upload.setRequestHeader("X-Telebot-Capture-Recovery-Task", taskId);
    upload.setRequestHeader("X-Telebot-Capture-Recovery-Kind", kind);
    upload.upload.addEventListener("progress", event => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
      }
    });
    upload.addEventListener("load", () => {
      let payload: { file?: CaptureFileEntry; detail?: string; message?: string } = {};
      try { payload = upload.responseText ? JSON.parse(upload.responseText) : {}; } catch { /* use status text */ }
      if (upload.status >= 200 && upload.status < 300 && payload.file) {
        onProgress?.(100);
        resolve(payload.file);
        return;
      }
      reject(new Error(String(payload.detail || payload.message || upload.statusText || `上传失败：HTTP ${upload.status}`)));
    });
    upload.addEventListener("error", () => reject(new Error("补传连接中断，请检查网络后重试。")));
    upload.addEventListener("timeout", () => reject(new Error("补传超过一小时仍未完成。")));
    upload.addEventListener("abort", () => reject(new Error("补传已取消。")));
    upload.send(file);
  });
}

export function synthesizeCaptureTask(taskId: string) {
  return request<CaptureTask>(`/api/captures/tasks/${encodeURIComponent(taskId)}/synthesize`, { method: "POST" });
}

export function deleteCaptureTask(taskId: string) {
  return request<{ success: boolean }>(`/api/captures/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}

export function downloadCaptureTask(taskId: string) {
  return downloadCapture({ task_id: taskId }, `${taskId}-piper-replay.mp4`);
}

async function downloadCapture(target: { task_id?: string; file_id?: string }, filename: string) {
  const ticket = await request<{ path: string }>("/api/captures/downloads", {
    method: "POST", body: JSON.stringify(target),
  });
  const anchor = document.createElement("a");
  anchor.href = `${await getApiBase()}${ticket.path}`;
  anchor.download = filename || "capture.bin";
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function heartbeatOnlinePresence() {
  return request<OnlinePresence>("/api/online/heartbeat", {
    method: "POST",
    body: JSON.stringify({ clientId: getOnlineClientId() }),
  });
}

export function leaveOnlinePresence() {
  return request<OnlinePresence>("/api/online/leave", {
    method: "POST",
    keepalive: true,
    body: JSON.stringify({ clientId: getOnlineClientId() }),
  });
}

export function getSettings() {
  return request<LoginSettings>("/api/settings");
}

export function saveSettings(payload: SettingsRequest) {
  return request<LoginSettings>("/api/settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginRequest) {
  return request<ApiResponse>("/api/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return request<ApiResponse>("/api/logout", {
    method: "POST",
  });
}

export function getStatus() {
  return request<DashboardStatus>("/api/status");
}

export function getLiveStatus() {
  return request<DashboardStatus>("/api/status/live");
}

export function getVideoPushStatus() {
  return request<VideoPushStatus>("/api/video/status");
}

export function getTrafficMonitorSnapshot() {
  return request<TrafficMonitorSnapshot>("/api/traffic-monitor");
}

export function postTencentVideoStatus(action: "start" | "heartbeat" | "stop", payload: Record<string, unknown>) {
  return request<{ ok?: boolean; tencent?: VideoPushModeStatus }>(`/api/video/tencent/${action}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function postTencentVideoStatusBeacon(action: "stop", payload: Record<string, unknown>) {
  void getApiBase().then((apiBase) => {
    const headers = buildRequestHeaders();
    const token = getStoredAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    try {
      fetch(`${apiBase}/api/video/tencent/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // Page teardown should never block navigation.
    }
  });
}

export function refreshStatus() {
  return request<DashboardStatus>("/api/refresh", {
    method: "POST",
  });
}

export function getNetworkSnapshot() {
  return request<NetworkSnapshot>("/api/network-snapshot");
}

export function refreshNetworkSnapshot() {
  return request<NetworkSnapshot>("/api/network-snapshot/refresh", {
    method: "POST",
  });
}

export function startAllServices() {
  return request<ApiResponse>("/api/services/start-all", {
    method: "POST",
  });
}

export function stopAllServices() {
  return request<ApiResponse>("/api/services/stop-all", {
    method: "POST",
  });
}

export function startService(serviceName: string) {
  return request<ApiResponse>(`/api/services/${serviceName}/start`, {
    method: "POST",
  });
}

export function stopService(serviceName: string) {
  return request<ApiResponse>(`/api/services/${serviceName}/stop`, {
    method: "POST",
  });
}

export function switchIngestMode(target_mode: string) {
  return request<IngestModeResult>("/api/ingest-mode/switch", {
    method: "POST",
    body: JSON.stringify({ target_mode } satisfies IngestModeSwitchRequest),
  });
}

export function checkAllPorts() {
  return request<PortChecksResponse>("/api/ports/check-all", {
    method: "POST",
  });
}

export function checkPort(portKey: string) {
  return request<PortStatus>(`/api/ports/${portKey}/check`, {
    method: "POST",
  });
}

export function getLogs() {
  return request<LogsResponse>("/api/logs");
}

export function checkLocalSetup() {
  return request<LocalSetupStatus>("/api/local-setup/check");
}

export function runLocalSetup(payload: LocalSetupRunRequest) {
  return request<LocalSetupResult>("/api/local-setup/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLocalStreamStatus() {
  return request<LocalStreamStatus>("/api/local-stream/status");
}

export function saveLocalStreamConfig(payload: LocalStreamConfig) {
  return request<LocalStreamStatus>("/api/local-stream/config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function setupLocalStream() {
  return request<LocalStreamStatus>("/api/local-stream/setup", {
    method: "POST",
  });
}

export function startLocalStream(payload: LocalStreamConfig) {
  return request<LocalStreamStatus>("/api/local-stream/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function stopLocalStream() {
  return request<LocalStreamStatus>("/api/local-stream/stop", {
    method: "POST",
  });
}

export function getP2pLocalPusherStatus() {
  return request<P2PLocalPusherStatus>("/api/p2p-local-pusher/status");
}

export function startP2pLocalPusher(payload: LocalStreamConfig, watchUrl: string) {
  return request<P2PLocalPusherStatus>(`/api/p2p-local-pusher/start?watch_url=${encodeURIComponent(watchUrl)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function stopP2pLocalPusher() {
  return request<P2PLocalPusherStatus>("/api/p2p-local-pusher/stop", {
    method: "POST",
  });
}

export function getControlMonitorConfig() {
  return request<ControlMonitorConfig>("/api/control-monitor/config");
}

export async function pollControlMonitorOffer(session: string, computeClientId: string) {
  const response = await requestResponse(
    `/api/control-monitor/offer?session=${encodeURIComponent(session)}&compute_client_id=${encodeURIComponent(computeClientId)}`,
  );
  if (response.status === 204) {
    return null;
  }
  return (await response.json()) as ControlMonitorOffer;
}

export function postControlMonitorAnswer(
  session: string,
  offerId: string,
  computeClientId: string,
  payload: ControlSessionDescription,
) {
  return request<ApiResponse>(
    `/api/control-monitor/answer?session=${encodeURIComponent(session)}&offer_id=${encodeURIComponent(offerId)}&compute_client_id=${encodeURIComponent(computeClientId)}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function getControlMonitorKeyState(session: string) {
  return request<ControlMonitorKeyState>(`/api/control-monitor/key-state?session=${encodeURIComponent(session)}`);
}

export function syncTankTroubleRoom(payload: TankTroubleRoomRequest) {
  return request<TankTroubleRoomState>("/api/games/tank-trouble/room/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTankTroubleRoomStatus(payload: TankTroubleRoomStatusRequest) {
  return request<TankTroubleRoomState>("/api/games/tank-trouble/room/status", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function toggleTankTroubleRoomVote(payload: TankTroubleRoomRequest) {
  return request<TankTroubleRoomState>("/api/games/tank-trouble/room/vote-toggle", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function syncTankTroubleMatch(payload: TankTroubleMatchRequest) {
  return request<TankTroubleMatchState>("/api/games/tank-trouble/match/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function openTankTroubleMatchSocket() {
  const apiBase = await getApiBase();
  const token = getStoredAccessToken();
  const suffix = token ? `?access_token=${encodeURIComponent(token)}` : "";
  return new WebSocket(toWebSocketUrl(apiBase, `/api/games/tank-trouble/match/ws${suffix}`));
}

export function leaveTankTroubleMatch(payload: TankTroubleRoomRequest) {
  return request<ApiResponse>("/api/games/tank-trouble/match/leave", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function syncTankTroubleLatency(payload: TankTroubleLatencyRequest) {
  return request<TankTroubleLatencyState>("/api/games/tank-trouble/latency/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function openTankTroubleLatencySocket() {
  const apiBase = await getApiBase();
  const token = getStoredAccessToken();
  const suffix = token ? `?access_token=${encodeURIComponent(token)}` : "";
  return new WebSocket(toWebSocketUrl(apiBase, `/api/games/tank-trouble/latency/ws${suffix}`));
}

export function leaveTankTroubleLatency(payload: TankTroubleRoomRequest) {
  return request<ApiResponse>("/api/games/tank-trouble/latency/leave", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function leaveTankTroubleRoom(payload: TankTroubleRoomRequest) {
  return request<TankTroubleRoomState>("/api/games/tank-trouble/room/leave", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBackendBaseUrl() {
  return getApiBase();
}

export async function getTankTroublePreviewPageUrl() {
  const apiBase = await getApiBase();
  return `${apiBase}/tank-trouble/preview`;
}

export function getTankTroubleSpectatorPageUrl(room = "main") {
  return request<TankTroublePageUrlResponse>(
    `/api/games/tank-trouble/spectator/page-url?room=${encodeURIComponent(room)}`,
  );
}

export function checkTankTroubleSetup() {
  return request<TankTroubleSetupStatus>("/api/games/tank-trouble/setup/check");
}

export function runTankTroubleSetup() {
  return request<TankTroubleSetupResult>("/api/games/tank-trouble/setup/run", {
    method: "POST",
  });
}

export function pushTankTroublePreview(payload: TankTroublePreviewPushRequest) {
  return request<ApiResponse>("/api/games/tank-trouble/preview/push", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function clearTankTroublePreview(payload: TankTroublePreviewClearRequest) {
  return request<ApiResponse>("/api/games/tank-trouble/preview/clear", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getVideoPreviewUrl() {
  const apiBase = await getApiBase();
  return `${apiBase}/api/video-preview.mp4`;
}
