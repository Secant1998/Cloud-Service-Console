import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../components/Button";
import { UpdateAction } from "../components/UpdateAction";
import { getSettings, login } from "../api/cloudApi";
import type { AccessInfo } from "../api/cloudApi";
import type { AppUpdaterState } from "../hooks/useAppUpdater";
import type { LoginRequest, SavedLoginAccount } from "../types/cloud";

type LoginPageProps = {
  theme: "light" | "dark";
  updater: AppUpdaterState;
  accessInfo: AccessInfo;
  autoLoginPaused?: boolean;
  webAccessError?: string;
  onToggleTheme: () => void;
  onInstallUpdate: () => void;
  onLoggedIn: () => void;
};

const DEFAULT_HOST = "";
const HOST_HINT = "输入云服务服务器 IP";
const EMPTY_MESSAGE = "请输入云服务器信息。";
const AUTO_LOGIN_MESSAGE = "已加载自动登录配置。";
const DEFAULT_SETTINGS_MESSAGE = "已加载默认配置。";
const AUTO_LOGIN_PAUSED_MESSAGE = "已退出登录，本次打开期间自动登录已暂停。";
const AUTO_LOGIN_CONNECTING_MESSAGE = "正在使用已保存的自动登录账号连接...";
const SETTINGS_ERROR_MESSAGE = "读取设置失败";
const CONNECTING_MESSAGE = "正在连接云服务器...";
const LOGIN_SUCCESS_MESSAGE = "登录成功，正在进入控制台...";
const LOGIN_FAILED_MESSAGE = "登录失败";
const CONNECTION_FAILED_MESSAGE = "连接失败，请检查云服务器信息。";
const SELECTED_ACCOUNT_PREFIX = "已选择历史账号";
const WEB_ACCESS_ERROR_TITLE = "网页入口未授权";
const WEB_ACCESS_ERROR_MESSAGE = "请使用管理员或普通用户的完整 HTTPS 链接重新打开控制台。刚切到 HTTPS 域名后，也需要重新点击一次带 access_token 的链接。";
const WEB_SAVED_ACCOUNTS_STORAGE_KEY = "cloud-service-console.web-saved-accounts";

const initialForm: LoginRequest = {
  host: "",
  username: "",
  password: "",
  remember_password: false,
  auto_login: false,
};

function dedupeSavedAccounts(accounts: SavedLoginAccount[]) {
  const seen = new Set<string>();
  let autoLoginTaken = false;
  const nextAccounts: SavedLoginAccount[] = [];
  for (const account of accounts) {
    const host = account.host.trim();
    const username = account.username.trim();
    if (!host) {
      continue;
    }
    const key = `${host}::${username}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const autoLogin = Boolean(account.auto_login && account.remember_password && account.password && !autoLoginTaken);
    if (autoLogin) {
      autoLoginTaken = true;
    }
    nextAccounts.push({
      host,
      username,
      password: account.password,
      remember_password: account.remember_password,
      auto_login: autoLogin,
    });
  }
  return nextAccounts.slice(0, 8);
}

function readWebSavedAccounts() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawPayload = window.localStorage.getItem(WEB_SAVED_ACCOUNTS_STORAGE_KEY);
    const parsed = rawPayload ? JSON.parse(rawPayload) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return dedupeSavedAccounts(
      parsed.map((account) => ({
        host: String(account?.host || ""),
        username: String(account?.username || ""),
        password: String(account?.password || ""),
        remember_password: Boolean(account?.remember_password),
        auto_login: Boolean(account?.auto_login),
      })),
    );
  } catch {
    return [];
  }
}

function writeWebSavedAccounts(accounts: SavedLoginAccount[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(WEB_SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(dedupeSavedAccounts(accounts)));
  } catch {
    // Browser storage can be disabled or full; login should still continue.
  }
}

function mergeSavedAccounts(primary: SavedLoginAccount[], secondary: SavedLoginAccount[]) {
  return dedupeSavedAccounts([...primary, ...secondary]);
}

export function LoginPage({
  theme,
  updater,
  accessInfo,
  autoLoginPaused = false,
  webAccessError = "",
  onToggleTheme,
  onInstallUpdate,
  onLoggedIn,
}: LoginPageProps) {
  const [form, setForm] = useState<LoginRequest>(initialForm);
  const [savedAccounts, setSavedAccounts] = useState<SavedLoginAccount[]>([]);
  const [hostMenuOpen, setHostMenuOpen] = useState(false);
  const [hostMenuQuery, setHostMenuQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [message, setMessage] = useState(EMPTY_MESSAGE);
  const [error, setError] = useState("");
  const hostFieldRef = useRef<HTMLDivElement | null>(null);
  const autoLoginStartedRef = useRef(false);
  const onLoggedInRef = useRef(onLoggedIn);
  const hostListId = useId();

  useEffect(() => {
    onLoggedInRef.current = onLoggedIn;
  }, [onLoggedIn]);

  const visibleSavedAccounts = savedAccounts.filter((account) => {
    const query = hostMenuQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return account.host.toLowerCase().includes(query) || account.username.toLowerCase().includes(query);
  });

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      if (webAccessError) {
        setForm(initialForm);
        setSavedAccounts([]);
        setError(webAccessError);
        setMessage(WEB_ACCESS_ERROR_TITLE);
        setBootLoading(false);
        return;
      }

      try {
        const saved = await getSettings();
        if (!alive) {
          return;
        }
        const bootAccounts =
          saved.saved_accounts && saved.saved_accounts.length > 0
            ? saved.saved_accounts
            : saved.host.trim()
              ? [
                  {
                    host: saved.host.trim(),
                    username: saved.username.trim() || "ubuntu",
                    password: saved.remember_password ? saved.password : "",
                    remember_password: saved.remember_password,
                    auto_login: saved.auto_login,
                  },
                ]
              : [];
        const webAccounts = accessInfo.webMode ? readWebSavedAccounts() : [];
        const dedupedAccounts = accessInfo.webMode ? mergeSavedAccounts(webAccounts, bootAccounts) : dedupeSavedAccounts(bootAccounts);
        const autoLoginAccount = dedupedAccounts.find((account) => account.auto_login && account.remember_password && account.password);
        if (accessInfo.webMode && saved.host.trim() && !autoLoginPaused) {
          setForm({
            host: saved.host,
            username: saved.username,
            password: dedupedAccounts.find((account) => account.host === saved.host && account.username === saved.username)?.password || "",
            remember_password: Boolean(dedupedAccounts.find((account) => account.host === saved.host && account.username === saved.username)?.remember_password),
            auto_login: false,
          });
          setSavedAccounts(dedupedAccounts);
          setMessage("Web 控制台已连接服务器会话，正在进入控制台...");
          onLoggedInRef.current();
          return;
        }
        const preferredAccount = accessInfo.webMode ? dedupedAccounts[0] : null;
        const bootForm: LoginRequest = autoLoginAccount
          ? {
              host: autoLoginAccount.host,
              username: autoLoginAccount.username,
              password: autoLoginAccount.password,
              remember_password: autoLoginAccount.remember_password,
              auto_login: autoLoginAccount.auto_login,
            }
          : preferredAccount
            ? {
                host: preferredAccount.host,
                username: preferredAccount.username,
                password: preferredAccount.password,
                remember_password: preferredAccount.remember_password,
                auto_login: preferredAccount.auto_login,
              }
            : {
                host: saved.host,
                username: saved.username,
                password: saved.password,
                remember_password: saved.remember_password,
                auto_login: saved.auto_login,
              };
        setForm(bootForm);
        setSavedAccounts(dedupedAccounts);

        if (autoLoginAccount && !autoLoginPaused && !autoLoginStartedRef.current) {
          autoLoginStartedRef.current = true;
          setLoading(true);
          setError("");
          setMessage(AUTO_LOGIN_CONNECTING_MESSAGE);
          try {
            await login(bootForm);
            if (!alive) {
              return;
            }
            setMessage(LOGIN_SUCCESS_MESSAGE);
            onLoggedInRef.current();
          } catch (err) {
            if (!alive) {
              return;
            }
            setError(err instanceof Error ? err.message : LOGIN_FAILED_MESSAGE);
            setMessage(CONNECTION_FAILED_MESSAGE);
          } finally {
            if (alive) {
              setLoading(false);
            }
          }
          return;
        }

        setMessage(autoLoginAccount ? (autoLoginPaused ? AUTO_LOGIN_PAUSED_MESSAGE : AUTO_LOGIN_MESSAGE) : DEFAULT_SETTINGS_MESSAGE);
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err instanceof Error ? err.message : SETTINGS_ERROR_MESSAGE);
      } finally {
        if (alive) {
          setBootLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      alive = false;
    };
  }, [autoLoginPaused, webAccessError]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!hostFieldRef.current?.contains(event.target as Node)) {
        setHostMenuOpen(false);
        setHostMenuQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function updateField<K extends keyof LoginRequest>(key: K, value: LoginRequest[K]) {
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
  }

  function applySavedAccount(account: SavedLoginAccount) {
    setForm({
      host: account.host,
      username: account.username,
      password: account.password,
      remember_password: account.remember_password,
      auto_login: account.auto_login,
    });
    setHostMenuOpen(false);
    setHostMenuQuery("");
    setError("");
    setMessage(`${SELECTED_ACCOUNT_PREFIX}: ${account.username || "ubuntu"}@${account.host}`);
  }

  function handleHostKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setHostMenuOpen(false);
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    if (form.host.trim()) {
      return;
    }
    event.preventDefault();
    updateField("host", DEFAULT_HOST);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (webAccessError) {
      setError(webAccessError);
      setMessage(WEB_ACCESS_ERROR_TITLE);
      return;
    }
    setLoading(true);
    setError("");
    setMessage(CONNECTING_MESSAGE);
    try {
      await login(form);
      const nextAccounts = dedupeSavedAccounts([
        {
          host: form.host.trim(),
          username: form.username.trim(),
          password: form.remember_password ? form.password : "",
          remember_password: form.remember_password,
          auto_login: form.auto_login,
        },
        ...savedAccounts.map((account) => ({ ...account, auto_login: false })),
      ]);
      if (accessInfo.webMode) {
        writeWebSavedAccounts(nextAccounts);
      }
      setSavedAccounts(nextAccounts);
      setMessage(LOGIN_SUCCESS_MESSAGE);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : LOGIN_FAILED_MESSAGE);
      setMessage(CONNECTION_FAILED_MESSAGE);
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
            <div className="product-badge">Cloud Service Console v3</div>
            <div className="login-intro-toolbar-actions">
              {accessInfo.webMode ? (
                <div className="topbar-role-pill login-role-pill">
                  {accessInfo.admin ? "管理员入口" : "普通用户入口"}
                </div>
              ) : null}
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
              {form.username || "ubuntu"}@{form.host || HOST_HINT}
            </div>
            <div className="connection-preview-note">程序内置默认端口与协议，首次只需要填写服务器和密码。</div>
          </div>
        </section>

        <section className="panel login-panel">
          <div className="login-panel-header">
            <div className="section-title">连接到云服务器</div>
            <div className="login-panel-subtitle">先连接 SSH，会话建立后再进入控制台。</div>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {webAccessError ? (
              <div className="login-access-warning">
                <div className="login-access-warning-title">{WEB_ACCESS_ERROR_TITLE}</div>
                <div>{WEB_ACCESS_ERROR_MESSAGE}</div>
              </div>
            ) : null}
            <label className="field">
              <span>服务器 Host</span>
              <div className="login-host-stack" ref={hostFieldRef}>
                <div className={`login-host-input-shell${hostMenuOpen ? " open" : ""}`}>
                  <input
                    className="input login-host-input"
                    value={form.host}
                    onChange={(event) => {
                      updateField("host", event.target.value);
                      setHostMenuQuery(event.target.value);
                      setHostMenuOpen(true);
                    }}
                    onFocus={() => {
                      setHostMenuQuery("");
                      setHostMenuOpen(true);
                    }}
                    onKeyDown={handleHostKeyDown}
                    placeholder={HOST_HINT}
                    autoComplete="off"
                    aria-expanded={hostMenuOpen}
                    aria-controls={visibleSavedAccounts.length ? hostListId : undefined}
                    disabled={bootLoading || loading || Boolean(webAccessError)}
                  />
                  <button
                    type="button"
                    className="login-host-trigger"
                    aria-label="toggle saved server list"
                    onClick={() =>
                      setHostMenuOpen((current) => {
                        const nextOpen = !current;
                        if (nextOpen) {
                          setHostMenuQuery("");
                        }
                        return nextOpen;
                      })
                    }
                    disabled={bootLoading || loading || Boolean(webAccessError) || savedAccounts.length === 0}
                  >
                    {hostMenuOpen ? "▲" : "▼"}
                  </button>
                </div>
                {hostMenuOpen && visibleSavedAccounts.length > 0 ? (
                  <div className="login-host-menu" id={hostListId} role="listbox" aria-label="saved servers">
                    {visibleSavedAccounts.map((account) => (
                      <button
                        key={`${account.host}__${account.username}`}
                        type="button"
                        className="login-host-option"
                        onClick={() => applySavedAccount(account)}
                      >
                        <span className="login-host-option-main">{account.host}</span>
                        <span className="login-host-option-sub">
                          {account.username || "ubuntu"}
                          {account.remember_password && account.password ? " | 已记住密码" : ""}
                          {account.auto_login ? " | 自动登录" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>

            <label className="field">
              <span>SSH 用户名</span>
              <input
                className="input"
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                placeholder="ubuntu"
                autoComplete="off"
                disabled={bootLoading || loading || Boolean(webAccessError)}
              />
            </label>

            <label className="field">
              <span>SSH 密码</span>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="请输入 SSH 密码"
                autoComplete="current-password"
                disabled={bootLoading || loading || Boolean(webAccessError)}
              />
            </label>

            <label className="toggle-line">
              <input
                type="checkbox"
                checked={form.remember_password}
                onChange={(event) => updateField("remember_password", event.target.checked)}
                disabled={bootLoading || loading || Boolean(webAccessError)}
              />
              <span>记住密码</span>
            </label>

            <label className="toggle-line">
              <input
                type="checkbox"
                checked={form.auto_login}
                onChange={(event) => updateField("auto_login", event.target.checked)}
                disabled={bootLoading || loading || Boolean(webAccessError)}
              />
              <span>自动登录</span>
            </label>

            <Button variant="primary" block loading={loading || bootLoading} disabled={Boolean(webAccessError)} type="submit">
              登录并进入控制台
            </Button>
          </form>

          <div className="login-status">
            <div className="login-message">{message}</div>
            {error ? <div className="login-error">{error}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
