import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { getAdminUsers, getAgentSettings, saveAccountAvatar, saveAgentSettings, testAgentSettings } from "../api/cloudApi";
import type { AccessInfo } from "../api/cloudApi";
import type { AdminUserList, AgentSettings } from "../types/cloud";
import { AppSelect } from "./AppSelect";
import { Button } from "./Button";
import { ToggleSwitch } from "./ToggleSwitch";
import { CaptureTasksPanel } from "./CaptureTasksPanel";

type SystemSettingsPanelProps = {
  accessInfo: AccessInfo;
  onAccessInfoChange: (accessInfo: AccessInfo) => void;
};

const AVATAR_MAX_FILE_BYTES = 8 * 1024 * 1024;
const AVATAR_CANVAS_SIZE = 512;
const AVATAR_FILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const EMPTY_SETTINGS: AgentSettings = {
  enabled: false,
  base_url: "https://api.deepseek.com",
  model: "deepseek-chat",
  api_key_configured: false,
  api_key_hint: "",
  updated_at: "",
  updated_by: "",
};

function formatDateTime(value: string, emptyLabel = "-") {
  if (!value) {
    return emptyLabel;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return emptyLabel;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

async function makeSquareAvatar(file: File) {
  if (!AVATAR_FILE_TYPES.has(file.type)) {
    throw new Error("请选择 JPG、PNG 或 WebP 图片。");
  }
  if (file.size > AVATAR_MAX_FILE_BYTES) {
    throw new Error("图片不能超过 8 MB。");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("无法读取所选图片。"));
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("所选图片尺寸无效。");
    }

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_CANVAS_SIZE;
    canvas.height = AVATAR_CANVAS_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("当前浏览器无法处理头像图片。");
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      AVATAR_CANVAS_SIZE,
      AVATAR_CANVAS_SIZE,
    );
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function SystemSettingsPanel({ accessInfo, onAccessInfoChange }: SystemSettingsPanelProps) {
  const [settings, setSettings] = useState<AgentSettings>(EMPTY_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userList, setUserList] = useState<AdminUserList | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState(accessInfo.avatarDataUrl || "");
  const [avatarDraft, setAvatarDraft] = useState(accessInfo.avatarDataUrl || "");
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const editable = !accessInfo.webMode || accessInfo.admin;
  const canChangeAvatar = accessInfo.webMode && accessInfo.authenticated && Boolean(accessInfo.username);
  const avatarFallback = (accessInfo.username || "U").slice(0, 1).toUpperCase();

  useEffect(() => {
    setAvatarDataUrl(accessInfo.avatarDataUrl || "");
    if (!avatarDialogOpen) {
      setAvatarDraft(accessInfo.avatarDataUrl || "");
    }
  }, [accessInfo.avatarDataUrl, avatarDialogOpen]);

  useEffect(() => {
    if (!avatarDialogOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !avatarBusy) {
        setAvatarDialogOpen(false);
        setAvatarError("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [avatarBusy, avatarDialogOpen]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const next = await getAgentSettings();
        if (alive) {
          setSettings(next);
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "读取 Agent 设置失败。");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  async function loadUsers() {
    if (!accessInfo.admin) {
      return;
    }
    setUsersLoading(true);
    setUsersError("");
    try {
      setUserList(await getAdminUsers());
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "读取用户状态失败。");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [accessInfo.admin]);

  function openAvatarDialog() {
    if (!canChangeAvatar) {
      return;
    }
    setAvatarDraft(avatarDataUrl);
    setAvatarError("");
    setAvatarDialogOpen(true);
  }

  function closeAvatarDialog() {
    if (avatarBusy) {
      return;
    }
    setAvatarDialogOpen(false);
    setAvatarError("");
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setAvatarError("");
    try {
      setAvatarDraft(await makeSquareAvatar(file));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "头像图片处理失败。");
    }
  }

  async function handleAvatarSave() {
    if (!avatarDraft || avatarDraft === avatarDataUrl) {
      return;
    }
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const result = await saveAccountAvatar(avatarDraft);
      const nextAvatar = result.avatar_data_url || avatarDraft;
      setAvatarDataUrl(nextAvatar);
      setAvatarDraft(nextAvatar);
      setUserList((current) => current ? {
        ...current,
        users: current.users.map((user) => (
          user.username === accessInfo.username ? { ...user, avatar_data_url: nextAvatar } : user
        )),
      } : current);
      onAccessInfoChange({ ...accessInfo, avatarDataUrl: nextAvatar });
      setAvatarDialogOpen(false);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "头像保存失败。");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const next = await saveAgentSettings({
        enabled: settings.enabled,
        base_url: settings.base_url,
        model: settings.model,
        api_key: apiKey,
      });
      setSettings(next);
      setApiKey("");
      setMessage("DeepSeek Agent 设置已保存。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 Agent 设置失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage("");
    setError("");
    try {
      if (apiKey) {
        const next = await saveAgentSettings({
          enabled: settings.enabled,
          base_url: settings.base_url,
          model: settings.model,
          api_key: apiKey,
        });
        setSettings(next);
        setApiKey("");
      }
      const result = await testAgentSettings();
      setMessage(result.message || "DeepSeek API 连接正常。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "DeepSeek API 验证失败。");
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <section className="system-settings-layout">
      <div className="panel system-settings-main">
        <div className="system-settings-header">
          <div>
            <div className="section-title">网页内置 Agent</div>
            <div className="section-subtitle">DeepSeek</div>
          </div>
          <div className={`agent-config-state ${settings.api_key_configured ? "configured" : "empty"}`}>
            <span aria-hidden="true" />
            {settings.api_key_configured ? "API 已配置" : "API 未配置"}
          </div>
        </div>

        <div className="agent-settings-form">
          <div className="agent-settings-enable-row">
            <div>
              <strong>启用 DeepSeek Agent</strong>
              <span>{settings.enabled ? "已启用" : "未启用"}</span>
            </div>
            <ToggleSwitch
              checked={settings.enabled}
              disabled={!editable || loading || saving || (!settings.api_key_configured && !apiKey.trim())}
              onClick={() => setSettings((current) => ({ ...current, enabled: !current.enabled }))}
              ariaLabel="启用 DeepSeek Agent"
            />
          </div>

          <div className="agent-settings-grid">
            <label className="field">
              <span>API 地址</span>
              <input
                className="input"
                value={settings.base_url}
                onChange={(event) => setSettings((current) => ({ ...current, base_url: event.target.value }))}
                placeholder="https://api.deepseek.com"
                disabled={!editable || loading || saving}
              />
            </label>
            <AppSelect
              label="模型"
              value={settings.model}
              options={[
                { value: "deepseek-chat", label: "deepseek-chat" },
                { value: "deepseek-reasoner", label: "deepseek-reasoner" },
              ]}
              placeholder="选择模型"
              disabled={!editable || loading || saving}
              onChange={(model) => setSettings((current) => ({ ...current, model }))}
            />
          </div>

          <label className="field">
            <span>API Key</span>
            <div className="agent-api-key-row">
              <input
                className="input"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={settings.api_key_configured ? `已保存 ${settings.api_key_hint}，留空则保持不变` : "sk-..."}
                autoComplete="off"
                disabled={!editable || loading || saving}
              />
              <button
                type="button"
                className="agent-key-visibility"
                onClick={() => setShowApiKey((current) => !current)}
                disabled={!editable || loading || saving}
              >
                {showApiKey ? "隐藏" : "显示"}
              </button>
            </div>
          </label>

          {editable ? (
            <div className="agent-settings-actions">
              <Button variant="secondary" loading={testing} disabled={loading || saving} onClick={() => void handleTest()}>
                验证连接
              </Button>
              <Button variant="primary" loading={saving} disabled={loading || testing} onClick={() => void handleSave()}>
                保存设置
              </Button>
            </div>
          ) : (
            <div className="agent-settings-readonly">只有管理员可以修改 Agent API 设置。</div>
          )}

          {message ? <div className="agent-settings-feedback success">{message}</div> : null}
          {error ? <div className="agent-settings-feedback error">{error}</div> : null}
        </div>
      </div>

      <aside className="panel system-settings-side">
        <div className="section-title">账号信息</div>
        <div className="account-avatar-setting">
          <span className="account-avatar-preview" aria-hidden="true">
            {avatarDataUrl ? <img src={avatarDataUrl} alt="" /> : avatarFallback}
          </span>
          <div className="account-avatar-copy">
            <span>个人头像</span>
            <strong>{accessInfo.username || "本地桌面端"}</strong>
          </div>
          {canChangeAvatar ? (
            <Button variant="secondary" className="account-avatar-change" onClick={openAvatarDialog}>
              更改头像
            </Button>
          ) : null}
        </div>
        <div className="account-summary-list">
          <div><span>当前用户</span><strong>{accessInfo.username || "本地桌面端"}</strong></div>
          <div><span>账号权限</span><strong>{accessInfo.admin ? "管理员" : "普通用户"}</strong></div>
          <div><span>Agent 状态</span><strong>{settings.enabled ? "已启用" : "未启用"}</strong></div>
          <div><span>最近更新</span><strong>{settings.updated_by || "-"}</strong></div>
        </div>
      </aside>

      {accessInfo.admin ? (
        <div className="panel system-settings-users">
          <div className="user-management-header">
            <div>
              <div className="section-title">用户管理</div>
              <div className="section-subtitle">账号注册与在线状态</div>
            </div>
            <div className="user-management-actions">
              <div className="user-management-counts" aria-label="用户统计">
                <span>全部 <strong>{userList?.total ?? 0}</strong></span>
                <span className="online">在线 <strong>{userList?.online ?? 0}</strong></span>
              </div>
              <Button variant="secondary" className="settings-refresh-button" disabled={usersLoading}
                aria-label="刷新用户列表" title="刷新用户列表" onClick={() => void loadUsers()}>
                <RefreshCw size={16} className={usersLoading ? "capture-spinning" : ""} />
              </Button>
            </div>
          </div>

          {usersError ? <div className="user-management-feedback error">{usersError}</div> : null}

          <div className="user-table-shell">
            <table className="user-table">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>权限</th>
                  <th>账号状态</th>
                  <th>在线状态</th>
                  <th>注册时间</th>
                  <th>上次在线</th>
                </tr>
              </thead>
              <tbody>
                {userList?.users.map((user) => (
                  <tr key={user.username}>
                    <td>
                      <div className="user-identity">
                        <span className="user-avatar" aria-hidden="true">
                          {user.avatar_data_url
                            ? <img src={user.avatar_data_url} alt="" />
                            : user.username.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>{user.username}</strong>
                          {user.username === accessInfo.username ? <span>当前账号</span> : null}
                        </div>
                      </div>
                    </td>
                    <td><span className={`user-role-badge ${user.role}`}>{user.role === "admin" ? "管理员" : "普通用户"}</span></td>
                    <td><span className="user-account-state">正常</span></td>
                    <td>
                      <span className={`user-online-state ${user.online ? "online" : "offline"}`}>
                        <i aria-hidden="true" />
                        {user.online ? `在线 · ${user.active_sessions} 个会话` : "离线"}
                      </span>
                    </td>
                    <td className="user-time-cell">{formatDateTime(user.created_at, "未知")}</td>
                    <td className="user-time-cell">{user.online ? "当前在线" : formatDateTime(user.last_seen_at, "从未登录")}</td>
                  </tr>
                ))}
                {!usersLoading && userList && userList.users.length === 0 ? (
                  <tr><td className="user-table-empty" colSpan={6}>暂无用户</td></tr>
                ) : null}
                {usersLoading && !userList ? (
                  <tr><td className="user-table-empty" colSpan={6}>正在读取用户状态...</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="user-management-updated">状态更新时间：{formatDateTime(userList?.updated_at || "")}</div>
        </div>
      ) : null}

      {accessInfo.webMode ? <CaptureTasksPanel admin={accessInfo.admin} /> : null}
      </section>

      {avatarDialogOpen ? createPortal(
        <div
          className="setup-password-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAvatarDialog();
            }
          }}
        >
          <div className="setup-password-dialog avatar-upload-dialog panel" role="dialog" aria-modal="true" aria-labelledby="avatar-upload-title">
            <div>
              <div className="section-title" id="avatar-upload-title">更改头像</div>
              <div className="section-subtitle">头像预览</div>
            </div>
            <button
              type="button"
              className="avatar-upload-preview"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarBusy}
              aria-label="选择头像图片"
            >
              {avatarDraft ? <img src={avatarDraft} alt="头像预览" /> : <span>{avatarFallback}</span>}
            </button>
            <input
              ref={avatarInputRef}
              className="avatar-upload-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void handleAvatarFileChange(event)}
            />
            {avatarError ? <div className="avatar-upload-error">{avatarError}</div> : null}
            <div className="setup-password-actions avatar-upload-actions">
              <Button variant="secondary" type="button" disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}>
                选择图片
              </Button>
              <Button variant="ghost" type="button" disabled={avatarBusy} onClick={closeAvatarDialog}>
                取消
              </Button>
              <Button
                variant="primary"
                type="button"
                loading={avatarBusy}
                disabled={!avatarDraft || avatarDraft === avatarDataUrl}
                onClick={() => void handleAvatarSave()}
              >
                保存头像
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
