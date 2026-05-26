import { useEffect, useState } from "react";
import {
  getAccessInfo,
  getStatus,
  heartbeatOnlinePresence,
  leaveOnlinePresence,
  readAccessTokenFromUrl,
  type AccessInfo,
} from "./api/cloudApi";
import { useAppUpdater } from "./hooks/useAppUpdater";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import type { DashboardStatus } from "./types/cloud";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "cloud-service-console.theme";
const THEME_EXPLICIT_STORAGE_KEY = "cloud-service-console.theme-explicit";
const BASE_DOCUMENT_TITLE = "Cloud Service Console";
const ONLINE_PRESENCE_INTERVAL_MS = 15000;
const isPageVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

function detectInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const savedThemeIsExplicit = window.localStorage.getItem(THEME_EXPLICIT_STORAGE_KEY) === "1";
  if (savedThemeIsExplicit && (savedTheme === "light" || savedTheme === "dark")) {
    return savedTheme;
  }

  return "light";
}

function getAccessRoleLabel(accessInfo: AccessInfo) {
  if (!accessInfo.webMode) {
    return "";
  }
  return accessInfo.admin ? "管理员入口" : "普通用户入口";
}

function isWebAccessFailure(message: string) {
  if (message.includes("Unauthorized web console link")) {
    return true;
  }
  if (!message.includes("Request failed: 401")) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  const currentWindow = window;
  if (Object.prototype.hasOwnProperty.call(currentWindow, "__TAURI_IPC__")) {
    return false;
  }
  return currentWindow.location.protocol === "http:" || currentWindow.location.protocol === "https:";
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);
  const [bootStatus, setBootStatus] = useState<DashboardStatus | null>(null);
  const [accessInfo, setAccessInfo] = useState<AccessInfo>({ webMode: false, role: "desktop", admin: true });
  const [onlineCount, setOnlineCount] = useState(1);
  const [autoLoginPaused, setAutoLoginPaused] = useState(false);
  const [webAccessError, setWebAccessError] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(detectInitialTheme);
  const { updater, installUpdate } = useAppUpdater();

  function handleToggleTheme() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_EXPLICIT_STORAGE_KEY, "1");
    }
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const accessRoleLabel = getAccessRoleLabel(accessInfo);
    document.title = accessRoleLabel ? `${BASE_DOCUMENT_TITLE} · ${accessRoleLabel}` : BASE_DOCUMENT_TITLE;
  }, [accessInfo]);

  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      try {
        readAccessTokenFromUrl();
        const access = await getAccessInfo();
        if (!alive) {
          return;
        }
        setWebAccessError("");
        setAccessInfo(access);
        const status = await getStatus();
        if (!alive) {
          return;
        }
        setBootStatus(status);
        setAuthenticated(status.connected);
      } catch (err) {
        if (!alive) {
          return;
        }
        const message = err instanceof Error ? err.message : "";
        if (isWebAccessFailure(message)) {
          setAccessInfo({ webMode: true, role: "user", admin: false });
          setWebAccessError("网页入口未授权，请使用管理员或普通用户的完整 HTTPS 链接重新打开。");
        }
        setBootStatus(null);
        setAuthenticated(false);
      } finally {
        if (alive) {
          setBootChecked(true);
        }
      }
    }
    bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    async function syncOnlinePresence() {
      if (!isPageVisible()) {
        return;
      }
      try {
        const presence = await heartbeatOnlinePresence();
        if (!disposed) {
          setOnlineCount(Math.max(1, Number(presence.onlineCount) || 1));
        }
      } catch {
        if (!disposed) {
          setOnlineCount(1);
        }
      }
    }

    void syncOnlinePresence();
    const intervalId = window.setInterval(syncOnlinePresence, ONLINE_PRESENCE_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        void syncOnlinePresence();
      } else {
        void leaveOnlinePresence();
      }
    };
    const handlePageHide = () => {
      void leaveOnlinePresence();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      void leaveOnlinePresence();
    };
  }, []);

  if (!bootChecked) {
    return <div className="app-boot">正在连接本地后端...</div>;
  }

  if (!authenticated) {
    return (
      <LoginPage
        theme={theme}
        updater={updater}
        accessInfo={accessInfo}
        onToggleTheme={handleToggleTheme}
        onInstallUpdate={installUpdate}
        autoLoginPaused={autoLoginPaused}
        webAccessError={webAccessError}
        onLoggedIn={() => {
          setAutoLoginPaused(false);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <DashboardPage
      initialStatus={bootStatus?.connected ? bootStatus : undefined}
      theme={theme}
      updater={updater}
      accessInfo={accessInfo}
      onlineCount={onlineCount}
      onToggleTheme={handleToggleTheme}
      onInstallUpdate={installUpdate}
      onLogoutDone={() => {
        setAutoLoginPaused(true);
        setAuthenticated(false);
        setBootStatus(null);
      }}
    />
  );
}
