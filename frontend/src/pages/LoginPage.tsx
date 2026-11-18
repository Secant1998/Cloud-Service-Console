import { useEffect, useId, useRef, useState } from "react";
import {
  getAccessInfo,
  getSettings,
  login,
  loginAccount,
  loginAccountWithDevice,
  registerAccount,
  setAccountSessionToken,
} from "../api/cloudApi";
import type { AccessInfo } from "../api/cloudApi";
import { readSavedWebLogins, saveWebLogin, type SavedWebLogin } from "../authStorage";
import { Button } from "../components/Button";
import { UpdateAction } from "../components/UpdateAction";
import type { AppUpdaterState } from "../hooks/useAppUpdater";
import type { LoginRequest, SavedLoginAccount } from "../types/cloud";
import consoleIcon from "../assets/console-icon.png";

type LoginPageProps = {
  theme: "light" | "dark";
  updater: AppUpdaterState;
  accessInfo: AccessInfo;
  initialNotice?: string;
  onToggleTheme: () => void;
  onInstallUpdate: () => void;
  onLoggedIn: (access: AccessInfo) => void;
};

type AccountMode = "login" | "register";
type LoginForm = LoginRequest & {
  account_username: string;
  account_password: string;
  account_password_confirm: string;
};

const initialForm: LoginForm = {
  account_username: "",
  account_password: "",
  account_password_confirm: "",
  host: "",
  username: "ubuntu",
  password: "",
  remember_password: false,
  auto_login: false,
};

const REMEMBERED_PASSWORD_MASK = "••••••••••••";

function uniqueWebLogins(logins: SavedWebLogin[], keyOf: (login: SavedWebLogin) => string) {
  const seen = new Set<string>();
  return logins.filter((login) => {
    const key = keyOf(login);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function desktopAccounts(settings: Awaited<ReturnType<typeof getSettings>>): SavedLoginAccount[] {
  if (settings.saved_accounts?.length) {
    return settings.saved_accounts;
  }
  if (!settings.host.trim()) {
    return [];
  }
  return [
    {
      host: settings.host,
      username: settings.username || "ubuntu",
      password: settings.remember_password ? settings.password : "",
      remember_password: settings.remember_password,
      auto_login: settings.auto_login,
    },
  ];
}

export function LoginPage({
  theme,
  updater,
  accessInfo,
  initialNotice = "",
  onToggleTheme,
  onInstallUpdate,
  onLoggedIn,
}: LoginPageProps) {
  const [mode, setMode] = useState<AccountMode>("login");
  const [form, setForm] = useState<LoginForm>(initialForm);
  const [webLogins, setWebLogins] = useState<SavedWebLogin[]>([]);
  const [savedDesktopAccounts, setSavedDesktopAccounts] = useState<SavedLoginAccount[]>([]);
  const [selectedDeviceToken, setSelectedDeviceToken] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [hostMenuOpen, setHostMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [message, setMessage] = useState(initialNotice || "请输入账号和云服务器信息。");
  const [error, setError] = useState("");
  const accountFieldRef = useRef<HTMLDivElement | null>(null);
  const hostFieldRef = useRef<HTMLDivElement | null>(null);
  const accountListId = useId();
  const hostListId = useId();

  const hasStoredAccountCredential = Boolean(accessInfo.webMode && selectedDeviceToken && !form.account_password);
  const accountOptions = accessInfo.webMode
    ? uniqueWebLogins(webLogins, (login) => login.accountUsername)
    : [];
  const hostOptions = accessInfo.webMode
    ? uniqueWebLogins(webLogins, (login) => `${login.host}::${login.sshUsername}`)
    : savedDesktopAccounts.map((account) => ({
        accountUsername: "",
        deviceToken: "",
        host: account.host,
        sshUsername: account.username,
        sshPassword: account.password,
        rememberPassword: account.remember_password,
        autoLogin: account.auto_login,
      }));

  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      if (accessInfo.webMode) {
        const saved = readSavedWebLogins();
        const preferred = saved[0];
        if (!alive) {
          return;
        }
        setWebLogins(saved);
        setSelectedDeviceToken(preferred?.deviceToken || "");
        setForm({
          ...initialForm,
          account_username: preferred?.accountUsername || "",
          host: preferred?.host || accessInfo.defaultHost || "",
          username: preferred?.sshUsername || accessInfo.defaultSshUsername || "ubuntu",
          password: preferred?.sshPassword || "",
          remember_password: Boolean(preferred?.rememberPassword),
          auto_login: false,
        });
        setBootLoading(false);
        return;
      }

      try {
        const settings = await getSettings();
        if (!alive) {
          return;
        }
        const accounts = desktopAccounts(settings);
        setSavedDesktopAccounts(accounts);
        setForm({
          ...initialForm,
          host: settings.host,
          username: settings.username || "ubuntu",
          password: settings.password,
          remember_password: settings.remember_password,
          auto_login: settings.auto_login,
        });
        if (settings.auto_login && settings.remember_password && settings.password) {
          setLoading(true);
          setMessage("正在使用已保存的配置连接...");
          await login(settings);
          if (alive) {
            onLoggedIn(await getAccessInfo());
          }
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "读取设置失败。");
        }
      } finally {
        if (alive) {
          setLoading(false);
          setBootLoading(false);
        }
      }
    }
    void bootstrap();
    return () => {
      alive = false;
    };
  }, [accessInfo.webMode, accessInfo.defaultHost, accessInfo.defaultSshUsername]);

  useEffect(() => {
    function closeSavedLoginMenus(event: MouseEvent) {
      if (!accountFieldRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (!hostFieldRef.current?.contains(event.target as Node)) {
        setHostMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeSavedLoginMenus);
    return () => document.removeEventListener("mousedown", closeSavedLoginMenus);
  }, []);

  function updateField<K extends keyof LoginForm>(key: K, value: LoginForm[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "auto_login" && value === true) {
        next.remember_password = true;
      }
      if (key === "remember_password" && value === false) {
        next.auto_login = false;
      }
      return next;
    });
    if (key === "account_password" || key === "account_username") {
      setSelectedDeviceToken("");
    }
  }

  function applyAccountOption(option: SavedWebLogin) {
    setSelectedDeviceToken(option.deviceToken);
    setForm((current) => ({
      ...current,
      account_username: option.accountUsername,
      account_password: "",
      account_password_confirm: "",
      remember_password: current.remember_password || option.rememberPassword,
    }));
    setAccountMenuOpen(false);
    setError("");
    setMessage(`已加载此设备保存的个人账号：${option.accountUsername}`);
  }

  function applyServerOption(option: (typeof hostOptions)[number]) {
    setForm((current) => ({
      ...current,
      host: option.host,
      username: option.sshUsername || "ubuntu",
      password: option.sshPassword,
      remember_password: current.remember_password || option.rememberPassword,
      auto_login: false,
    }));
    setHostMenuOpen(false);
    setError("");
    setMessage(`已加载此设备保存的服务器：${option.sshUsername || "ubuntu"}@${option.host}`);
  }

  function switchMode(nextMode: AccountMode) {
    setMode(nextMode);
    setError("");
    setMessage(nextMode === "register" ? "注册成功后，账号默认是普通用户。" : "请输入账号和云服务器信息。");
    setForm((current) => ({ ...current, account_password: "", account_password_confirm: "" }));
    setAccountMenuOpen(false);
    if (nextMode === "register") {
      setSelectedDeviceToken("");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage(mode === "register" ? "正在注册并连接云服务器..." : "正在验证账号并连接云服务器...");
    try {
      if (!form.host.trim() || !form.username.trim() || !form.password) {
        throw new Error("请完整填写服务器 Host、SSH 用户名和 SSH 密码。");
      }

      let accountSession = null;
      if (accessInfo.webMode) {
        if (!form.account_username.trim()) {
          throw new Error("请输入个人用户名。");
        }
        if (mode === "register") {
          if (!form.account_password) {
            throw new Error("请输入个人账号密码。");
          }
          if (form.account_password !== form.account_password_confirm) {
            throw new Error("两次输入的个人账号密码不一致。");
          }
          accountSession = await registerAccount({
            username: form.account_username,
            password: form.account_password,
            remember_device: form.remember_password,
          });
        } else if (selectedDeviceToken && !form.account_password) {
          accountSession = await loginAccountWithDevice(selectedDeviceToken);
        } else {
          if (!form.account_password) {
            throw new Error("请输入个人账号密码。");
          }
          accountSession = await loginAccount({
            username: form.account_username,
            password: form.account_password,
            remember_device: form.remember_password,
          });
        }
        setAccountSessionToken(accountSession.session_token);
      }

      await login({
        host: form.host.trim(),
        username: form.username.trim(),
        password: form.password,
        remember_password: form.remember_password,
        auto_login: form.auto_login,
      });

      if (accessInfo.webMode && accountSession) {
        const deviceToken = accountSession.device_token || selectedDeviceToken;
        saveWebLogin({
          accountUsername: accountSession.username,
          deviceToken,
          host: form.host.trim(),
          sshUsername: form.username.trim(),
          sshPassword: form.remember_password ? form.password : "",
          rememberPassword: Boolean(form.remember_password && deviceToken),
          autoLogin: form.auto_login,
        });
      }
      setMessage(mode === "register" ? "注册成功，正在进入控制台..." : "登录成功，正在进入控制台...");
      onLoggedIn(await getAccessInfo());
    } catch (err) {
      const detail = err instanceof Error ? err.message : "登录失败。";
      setError(detail);
      setMessage(mode === "register" ? "注册或连接未完成。" : "登录失败，请检查输入内容。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-aurora login-aurora-a" />
      <div className="login-aurora login-aurora-b" />
      <div className="login-layout">
        <section className="login-intro">
          <div className="login-intro-toolbar">
            <div className="product-badge">
              <img className="product-badge-icon" src={consoleIcon} alt="" width={26} height={26} draggable={false} />
              <span>Cloud Service Console v3</span>
            </div>
            <div className="login-intro-toolbar-actions">
              <UpdateAction updater={updater} disabled={bootLoading || loading} login onInstall={onInstallUpdate} />
              <Button variant="ghost" type="button" className="theme-mode-button theme-mode-button-login" onClick={onToggleTheme}>
                {theme === "dark" ? "浅色模式" : "深色模式"}
              </Button>
            </div>
          </div>
          <h1>登录云服务器</h1>
          <p>这是机械臂云端服务控制台入口。登录后可以统一查看 go2rtc、SRT bridge、控制 signaling 和 Nginx 网关状态。</p>
          <div className="feature-list">
            <div className="feature-item">现代化 React 控制台</div>
            <div className="feature-item">FastAPI 本地后端承接 SSH 与检查逻辑</div>
            <div className="feature-item">为后续 Tauri 桌面壳做好准备</div>
          </div>
          <div className="connection-preview panel">
            <div className="connection-preview-label">连接预览</div>
            <div className="connection-preview-value">
              {form.username || "ubuntu"}@{form.host || "输入云服务服务器 IP"}
            </div>
            <div className="connection-preview-note">程序内置默认端口与协议，首次只需要填写服务器和密码。</div>
          </div>
        </section>

        <section className="panel login-panel">
          <div className="login-panel-header">
            <div className="section-title">连接到云服务器</div>
            <div className="login-panel-subtitle">先连接 SSH，会话建立后再进入控制台。</div>
          </div>

          <form className="login-form" autoComplete="off" onSubmit={handleSubmit}>
            {accessInfo.webMode ? (
              <>
                <label className="field">
                  <span>个人用户名</span>
                  <div className="login-host-stack" ref={accountFieldRef}>
                    <div className={`login-host-input-shell${accountMenuOpen ? " open" : ""}`}>
                      <input
                        className="input login-host-input"
                        value={form.account_username}
                        onChange={(event) => {
                          updateField("account_username", event.target.value);
                          if (mode === "login" && accountOptions.length > 0) {
                            setAccountMenuOpen(true);
                          }
                        }}
                        onFocus={() => {
                          if (mode === "login" && accountOptions.length > 0) {
                            setAccountMenuOpen(true);
                            setHostMenuOpen(false);
                          }
                        }}
                        placeholder="3-32 位字母、数字或 . _ -"
                        autoComplete="off"
                        aria-expanded={accountMenuOpen}
                        aria-controls={accountOptions.length ? accountListId : undefined}
                        aria-haspopup="listbox"
                        role="combobox"
                        data-1p-ignore="true"
                        data-lpignore="true"
                        disabled={bootLoading || loading}
                      />
                      <button
                        type="button"
                        className="login-host-trigger"
                        aria-label="选择此设备保存的个人账号"
                        onClick={() => {
                          setHostMenuOpen(false);
                          setAccountMenuOpen((current) => !current);
                        }}
                        disabled={bootLoading || loading || mode === "register" || accountOptions.length === 0}
                      >
                        <span className="app-select-trigger-arrow" aria-hidden="true" />
                      </button>
                    </div>
                    {accountMenuOpen && mode === "login" && accountOptions.length > 0 ? (
                      <div className="login-host-menu" id={accountListId} role="listbox" aria-label="此设备保存的个人账号">
                        {accountOptions.map((option) => (
                          <button
                            key={`${option.accountUsername}__${option.host}__${option.sshUsername}`}
                            type="button"
                            className="login-host-option"
                            onClick={() => applyAccountOption(option)}
                          >
                            <span className="login-host-option-main">{option.accountUsername}</span>
                            <span className="login-host-option-sub">
                              {option.rememberPassword ? "已绑定此设备" : "已记住用户名"}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>
                <label className="field">
                  <span>个人账号密码</span>
                  <input
                    className={`input${hasStoredAccountCredential ? " login-password-remembered" : ""}`}
                    type="password"
                    value={form.account_password}
                    onChange={(event) => updateField("account_password", event.target.value)}
                    placeholder={hasStoredAccountCredential ? REMEMBERED_PASSWORD_MASK : "请输入个人账号密码"}
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    disabled={bootLoading || loading}
                  />
                </label>
                {mode === "register" ? (
                  <label className="field">
                    <span>确认个人账号密码</span>
                    <input
                    className="input"
                    type="password"
                    value={form.account_password_confirm}
                      onChange={(event) => updateField("account_password_confirm", event.target.value)}
                      placeholder="再次输入个人账号密码"
                      autoComplete="new-password"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      disabled={bootLoading || loading}
                    />
                  </label>
                ) : null}
                <div className="login-mode-switch">
                  <span>{mode === "register" ? "已经有个人账号？" : "还没有个人账号？"}</span>
                  <button type="button" onClick={() => switchMode(mode === "register" ? "login" : "register")} disabled={bootLoading || loading}>
                    {mode === "register" ? "返回登录" : "注册账号"}
                  </button>
                </div>
              </>
            ) : null}

            <label className="field">
              <span>服务器 Host</span>
              <div className="login-host-stack" ref={hostFieldRef}>
                <div className={`login-host-input-shell${hostMenuOpen ? " open" : ""}`}>
                  <input
                    className="input login-host-input"
                    value={form.host}
                    onChange={(event) => updateField("host", event.target.value)}
                    onFocus={() => {
                      setHostMenuOpen(true);
                      setAccountMenuOpen(false);
                    }}
                    placeholder="输入云服务器 IP"
                    autoComplete="off"
                    aria-expanded={hostMenuOpen}
                    aria-controls={hostOptions.length ? hostListId : undefined}
                    disabled={bootLoading || loading}
                  />
                  <button
                    type="button"
                    className="login-host-trigger"
                    aria-label="选择此设备保存的连接"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setHostMenuOpen((current) => !current);
                    }}
                    disabled={bootLoading || loading || hostOptions.length === 0}
                  >
                    <span className="app-select-trigger-arrow" aria-hidden="true" />
                  </button>
                </div>
                {hostMenuOpen && hostOptions.length > 0 ? (
                  <div className="login-host-menu" id={hostListId} role="listbox" aria-label="此设备保存的连接">
                    {hostOptions.map((option) => (
                      <button
                        key={`${option.accountUsername}__${option.host}__${option.sshUsername}`}
                        type="button"
                        className="login-host-option"
                        onClick={() => applyServerOption(option)}
                      >
                        <span className="login-host-option-main">{option.host}</span>
                        <span className="login-host-option-sub">
                          {option.sshUsername || "ubuntu"}
                          {option.rememberPassword ? " · 已绑定此设备" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
            <label className="field">
              <span>SSH 用户名</span>
              <input className="input" value={form.username} onChange={(event) => updateField("username", event.target.value)} placeholder="ubuntu" autoComplete="off" disabled={bootLoading || loading} />
            </label>
            <label className="field">
              <span>SSH 密码</span>
              <input className="input" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} placeholder="请输入 SSH 密码" autoComplete="new-password" data-1p-ignore="true" data-lpignore="true" disabled={bootLoading || loading} />
            </label>

            <label className="toggle-line">
              <input type="checkbox" checked={form.remember_password} onChange={(event) => updateField("remember_password", event.target.checked)} disabled={bootLoading || loading} />
              <span>在此设备记住密码</span>
            </label>
            <label className="toggle-line">
              <input type="checkbox" checked={form.auto_login} onChange={(event) => updateField("auto_login", event.target.checked)} disabled={bootLoading || loading} />
              <span>此设备自动登录</span>
            </label>

            <Button variant="primary" block loading={loading || bootLoading} type="submit">
              {mode === "register" && accessInfo.webMode ? "注册并进入控制台" : "登录并进入控制台"}
            </Button>
          </form>

          <div className="login-status" aria-live="polite">
            <div className="login-message">{message}</div>
            {error ? <div className="login-error">{error}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
