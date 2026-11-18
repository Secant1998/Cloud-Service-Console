import { useEffect, useState } from "react";
import {
  clearAccountSessionToken,
  discardLegacyAccessToken,
  getAccessInfo,
  getStatus,
  getStoredAccessToken,
  heartbeatOnlinePresence,
  leaveOnlinePresence,
  login,
  loginAccountWithDevice,
  setAccountSessionToken,
  type AccessInfo,
} from "./api/cloudApi";
import { disableWebAutoLogin, findAutoLogin } from "./authStorage";
import { useAppUpdater } from "./hooks/useAppUpdater";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import type { DashboardStatus } from "./types/cloud";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "cloud-service-console.theme";
const THEME_EXPLICIT_STORAGE_KEY = "cloud-service-console.theme-explicit";
const BASE_DOCUMENT_TITLE = "Cloud Service Console";
const ONLINE_PRESENCE_INTERVAL_MS = 15000;
const DEFAULT_ACCESS: AccessInfo = {
  webMode: false,
  authenticated: false,
  username: "",
  role: "desktop",
  admin: true,
  avatarDataUrl: "",
  defaultHost: "",
  defaultSshUsername: "ubuntu",
};
const isPageVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

function detectInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const savedThemeIsExplicit = window.localStorage.getItem(THEME_EXPLICIT_STORAGE_KEY) === "1";
  return savedThemeIsExplicit && (savedTheme === "light" || savedTheme === "dark") ? savedTheme : "light";
}

function getAccessRoleLabel(accessInfo: AccessInfo) {
  if (!accessInfo.webMode || !accessInfo.authenticated) {
    return "";
  }
  return `${accessInfo.username} · ${accessInfo.admin ? "管理员" : "普通用户"}`;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);
  const [bootStatus, setBootStatus] = useState<DashboardStatus | null>(null);
  const [accessInfo, setAccessInfo] = useState<AccessInfo>(DEFAULT_ACCESS);
  const [onlineCount, setOnlineCount] = useState(1);
  const [loginNotice, setLoginNotice] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(detectInitialTheme);
  const { updater, installUpdate } = useAppUpdater();

  function handleToggleTheme() {
    window.localStorage.setItem(THEME_EXPLICIT_STORAGE_KEY, "1");
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

    async function openDashboard(access: AccessInfo) {
      const status = await getStatus();
      if (!alive) {
        return;
      }
      setAccessInfo(access);
      setBootStatus(status);
      setAuthenticated(status.connected);
    }

    async function bootstrap() {
      discardLegacyAccessToken();
      try {
        let access = await getAccessInfo();
        if (!alive) {
          return;
        }
        setAccessInfo(access);

        if (!access.webMode) {
          await openDashboard(access);
          return;
        }

        if (getStoredAccessToken() && access.authenticated) {
          await openDashboard(access);
          return;
        }

        clearAccountSessionToken();
        const savedAutoLogin = findAutoLogin();
        if (!savedAutoLogin) {
          setAuthenticated(false);
          return;
        }

        try {
          const accountSession = await loginAccountWithDevice(savedAutoLogin.deviceToken);
          setAccountSessionToken(accountSession.session_token);
          await login({
            host: savedAutoLogin.host,
            username: savedAutoLogin.sshUsername,
            password: savedAutoLogin.sshPassword,
            remember_password: true,
            auto_login: true,
          });
          access = await getAccessInfo();
          await openDashboard(access);
        } catch (error) {
          clearAccountSessionToken();
          disableWebAutoLogin();
          setAuthenticated(false);
          setLoginNotice(error instanceof Error ? `自动登录失败：${error.message}` : "自动登录失败，请重新登录。");
        }
      } catch (error) {
        clearAccountSessionToken();
        setAuthenticated(false);
        setBootStatus(null);
        setLoginNotice(error instanceof Error ? error.message : "无法连接控制台后端。");
      } finally {
        if (alive) {
          setBootChecked(true);
        }
      }
    }

    void bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }
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
    const handlePageHide = () => void leaveOnlinePresence();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      void leaveOnlinePresence();
    };
  }, [authenticated]);

  if (!bootChecked) {
    return <div className="app-boot">正在连接控制台后端...</div>;
  }

  if (!authenticated) {
    return (
      <LoginPage
        theme={theme}
        updater={updater}
        accessInfo={accessInfo}
        initialNotice={loginNotice}
        onToggleTheme={handleToggleTheme}
        onInstallUpdate={installUpdate}
        onLoggedIn={(access) => {
          setLoginNotice("");
          setAccessInfo(access);
          setAuthenticated(true);
          setBootStatus(null);
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
      onAccessInfoChange={setAccessInfo}
      onToggleTheme={handleToggleTheme}
      onInstallUpdate={installUpdate}
      onLogoutDone={() => {
        clearAccountSessionToken();
        disableWebAutoLogin();
        setAccessInfo({ ...DEFAULT_ACCESS, webMode: accessInfo.webMode });
        setAuthenticated(false);
        setBootStatus(null);
        setLoginNotice("已退出登录。未开启自动登录时，每次进入都需要重新登录。");
      }}
    />
  );
}
