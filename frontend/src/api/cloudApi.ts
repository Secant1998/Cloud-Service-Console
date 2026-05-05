import type {
  ApiResponse,
  ControlMonitorConfig,
  ControlMonitorOffer,
  ControlSessionDescription,
  DashboardStatus,
  IngestModeResult,
  IngestModeSwitchRequest,
  LoginRequest,
  LoginSettings,
  LocalSetupRunRequest,
  LocalSetupResult,
  LocalSetupStatus,
  LogsResponse,
  NetworkSnapshot,
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
} from "../types/cloud";

const FALLBACK_API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8765";
let apiBasePromise: Promise<string> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function getApiBase(): Promise<string> {
  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/tauri");
        const base = await invoke<string>("get_backend_base_url");
        return base || FALLBACK_API_BASE;
      } catch {
        return FALLBACK_API_BASE;
      }
    })();
  }

  return apiBasePromise;
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
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
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
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
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

export function getControlMonitorConfig() {
  return request<ControlMonitorConfig>("/api/control-monitor/config");
}

export async function pollControlMonitorOffer(session: string) {
  const response = await requestResponse(`/api/control-monitor/offer?session=${encodeURIComponent(session)}`);
  if (response.status === 204) {
    return null;
  }
  return (await response.json()) as ControlMonitorOffer;
}

export function postControlMonitorAnswer(session: string, offerId: string, payload: ControlSessionDescription) {
  return request<ApiResponse>(
    `/api/control-monitor/answer?session=${encodeURIComponent(session)}&offer_id=${encodeURIComponent(offerId)}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
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
  return new WebSocket(toWebSocketUrl(apiBase, "/api/games/tank-trouble/match/ws"));
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
  return new WebSocket(toWebSocketUrl(apiBase, "/api/games/tank-trouble/latency/ws"));
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
