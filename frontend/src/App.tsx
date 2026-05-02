import { useEffect, useState } from "react";
import { getStatus } from "./api/cloudApi";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import type { DashboardStatus } from "./types/cloud";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "cloud-service-console.theme";

function detectInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);
  const [bootStatus, setBootStatus] = useState<DashboardStatus | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(detectInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      try {
        const status = await getStatus();
        if (!alive) {
          return;
        }
        setBootStatus(status);
        setAuthenticated(status.connected);
      } catch {
        if (!alive) {
          return;
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

  if (!bootChecked) {
    return <div className="app-boot">正在连接本地后端...</div>;
  }

  if (!authenticated) {
    return (
      <LoginPage
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onLoggedIn={() => setAuthenticated(true)}
      />
    );
  }

  return (
    <DashboardPage
      initialStatus={bootStatus?.connected ? bootStatus : undefined}
      theme={theme}
      onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      onLogoutDone={() => setAuthenticated(false)}
    />
  );
}
