import { Button } from "./Button";
import { UpdateAction } from "./UpdateAction";
import type { AppUpdaterState } from "../hooks/useAppUpdater";

type SetupFeedbackTone = "idle" | "progress" | "success" | "error";

type TopbarProps = {
  title: string;
  statusText: string;
  theme: "light" | "dark";
  updater: AppUpdaterState;
  busy?: boolean;
  setupBusy?: boolean;
  setupProgress?: number;
  setupMessage?: string;
  setupTone?: SetupFeedbackTone;
  onRefresh: () => void;
  onInstallUpdate: () => void;
  onLocalSetup: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

export function Topbar({
  title,
  statusText,
  theme,
  updater,
  busy = false,
  setupBusy = false,
  setupProgress = 0,
  setupMessage = "",
  setupTone = "idle",
  onRefresh,
  onInstallUpdate,
  onLocalSetup,
  onToggleTheme,
  onLogout,
}: TopbarProps) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-eyebrow">Cloud Dashboard</div>
        <h1 className="topbar-title">{title}</h1>
        <div className="topbar-status">{statusText}</div>
      </div>
      <div className="topbar-actions">
        <UpdateAction updater={updater} disabled={busy} onInstall={onInstallUpdate} />
        <Button variant="ghost" className="theme-mode-button" disabled={busy} onClick={onToggleTheme}>
          {theme === "dark" ? "浅色模式" : "深色模式"}
        </Button>
        <Button variant="secondary" loading={busy} onClick={onRefresh}>
          刷新
        </Button>
        <div className="topbar-action-stack topbar-setup-stack">
          <Button
            variant="secondary"
            className="topbar-setup-button"
            disabled={busy || setupBusy}
            onClick={onLocalSetup}
          >
            一键配置
          </Button>
          <div className={`topbar-inline-feedback ${setupTone !== "idle" ? "visible" : ""} ${setupTone}`}>
            {setupTone === "progress" ? (
              <div className="topbar-progress-track" aria-hidden="true">
                <div className="topbar-progress-bar" style={{ width: `${Math.max(0, Math.min(100, setupProgress))}%` }} />
              </div>
            ) : setupMessage ? (
              <span>{setupMessage}</span>
            ) : null}
          </div>
        </div>
        <Button variant="ghost" disabled={busy} onClick={onLogout}>
          退出
        </Button>
      </div>
    </div>
  );
}
