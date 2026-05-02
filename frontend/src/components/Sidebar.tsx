import type { NetworkEndpointStatus, NetworkSnapshot } from "../types/cloud";

type ConsoleView = "overview" | "services" | "health" | "activity" | "games";

type SidebarProps = {
  networkSnapshot: NetworkSnapshot;
  activeView: ConsoleView;
  refreshBusy?: boolean;
  onViewChange: (view: ConsoleView) => void;
  onRefresh: () => void;
};

const NAV_ITEMS: Array<{ key: ConsoleView; label: string }> = [
  { key: "overview", label: "控制台总览" },
  { key: "services", label: "服务管理" },
  { key: "health", label: "健康检查" },
  { key: "activity", label: "活动日志" },
  { key: "games", label: "玩玩游戏" },
];

function buildCircleFlagUrl(countryCode: string) {
  const code = String(countryCode || "").trim().toLowerCase();
  if (!code) {
    return "";
  }
  return `/flags/${code}.svg`;
}

function renderLocationValue(endpoint: NetworkEndpointStatus, fallbackLabel: string) {
  const flagUrl = buildCircleFlagUrl(endpoint.country_code);

  return (
    <strong className="sidebar-config-value sidebar-config-location">
      {flagUrl ? <img className="sidebar-flag" src={flagUrl} alt={fallbackLabel} loading="lazy" /> : null}
      <span>{endpoint.location || "-"}</span>
    </strong>
  );
}

export function Sidebar({
  networkSnapshot,
  activeView,
  refreshBusy = false,
  onViewChange,
  onRefresh,
}: SidebarProps) {
  return (
    <aside className="panel sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-badge">V3</div>
        <div>
          <div className="sidebar-title">Cloud Service Console</div>
          <div className="sidebar-subtitle">Tauri / React / FastAPI</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`sidebar-nav-item ${activeView === item.key ? "active" : ""}`}
            onClick={() => onViewChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className={`sidebar-config-card sidebar-config-card-action ${refreshBusy ? "busy" : ""}`}
        onClick={onRefresh}
        disabled={refreshBusy}
      >
        <div className={`sidebar-config-refresh ${refreshBusy ? "busy" : ""}`}>
          <span className="sidebar-config-title">当前连接</span>
          <span className="sidebar-config-refresh-meta">{refreshBusy ? "刷新中..." : "点击刷新"}</span>
        </div>

        <div className="sidebar-config-line sidebar-config-line-compact">
          <span>服务器 IP</span>
          <strong className="sidebar-config-value sidebar-config-mono">{networkSnapshot.server.ip || "-"}</strong>
        </div>
        <div className="sidebar-config-line sidebar-config-line-compact">
          <span>本机 IP</span>
          <strong className="sidebar-config-value sidebar-config-mono">{networkSnapshot.local.ip || "-"}</strong>
        </div>
        <div className="sidebar-config-line">
          <span>本机地区</span>
          {renderLocationValue(networkSnapshot.local, "本机地区")}
        </div>
        <div className="sidebar-config-line">
          <span>服务器地区</span>
          {renderLocationValue(networkSnapshot.server, "服务器地区")}
        </div>
        <div className="sidebar-config-meta">最近刷新 {networkSnapshot.last_checked}</div>
      </button>
    </aside>
  );
}
