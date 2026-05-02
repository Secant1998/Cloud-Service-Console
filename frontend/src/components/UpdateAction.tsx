import type { AppUpdaterState } from "../hooks/useAppUpdater";

type UpdateActionProps = {
  updater: AppUpdaterState;
  disabled?: boolean;
  login?: boolean;
  onInstall: () => void;
};

function buildTitle(updater: AppUpdaterState) {
  const lines = [
    updater.installing
      ? "正在下载并安装更新"
      : updater.latestVersion
        ? `发现新版本 v${updater.latestVersion}`
        : "发现新版本",
  ];

  if (updater.currentVersion) {
    lines.push(`当前版本 v${updater.currentVersion}`);
  }

  if (updater.latestVersion) {
    lines.push(`可用版本 v${updater.latestVersion}`);
  }

  if (updater.error) {
    lines.push(`错误: ${updater.error}`);
  } else if (updater.message) {
    lines.push(updater.message);
  }

  return lines.join(" | ");
}

export function UpdateAction({ updater, disabled = false, login = false, onInstall }: UpdateActionProps) {
  if (!updater.available && !updater.installing) {
    return null;
  }

  const title = buildTitle(updater);

  return (
    <button
      type="button"
      className={`update-action${login ? " update-action-login" : ""}${updater.installing ? " busy" : ""}${updater.error ? " error" : ""}`}
      aria-label={title}
      title={title}
      disabled={disabled || updater.installing}
      onClick={onInstall}
    >
      <span className="update-action-ping" aria-hidden="true" />
      <svg className="update-action-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5v9.25" />
        <path d="M7.75 10.5 12 14.75l4.25-4.25" />
        <path d="M5 19h14" />
      </svg>
    </button>
  );
}
