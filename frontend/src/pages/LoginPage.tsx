import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { getSettings, login } from "../api/cloudApi";
import type { LoginRequest } from "../types/cloud";

type LoginPageProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLoggedIn: () => void;
};

const DEFAULT_HOST = "150.109.100.30";

const initialForm: LoginRequest = {
  host: "",
  username: "",
  password: "",
  remember_password: false,
  auto_login: false,
};

export function LoginPage({ theme, onToggleTheme, onLoggedIn }: LoginPageProps) {
  const [form, setForm] = useState<LoginRequest>(initialForm);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [message, setMessage] = useState("请输入云服务器信息。");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        const saved = await getSettings();
        if (!alive) {
          return;
        }
        setForm({
          host: saved.host,
          username: saved.username,
          password: saved.password,
          remember_password: saved.remember_password,
          auto_login: saved.auto_login,
        });
        if (saved.auto_login && saved.password) {
          setMessage("已加载自动登录配置。");
        } else {
          setMessage("已加载默认配置。");
        }
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err instanceof Error ? err.message : "读取设置失败");
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

  function handleHostKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
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
    setLoading(true);
    setError("");
    setMessage("正在连接云服务器...");
    try {
      await login(form);
      setMessage("登录成功，正在进入控制台...");
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setMessage("连接失败，请检查云服务器信息。");
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
            <Button variant="ghost" type="button" className="theme-mode-button theme-mode-button-login" onClick={onToggleTheme}>
              {theme === "dark" ? "浅色模式" : "深色模式"}
            </Button>
          </div>
          <h1>登录云服务器</h1>
          <p>
            这是机械臂云端服务控制台入口。登录后可以统一查看 go2rtc、SRT bridge、控制 signaling 和 Nginx 网关状态。
          </p>
          <div className="feature-list">
            <div className="feature-item">现代化 React 控制台</div>
            <div className="feature-item">FastAPI 本地后端承接 SSH 与检查逻辑</div>
            <div className="feature-item">为后续 Tauri 桌面壳做好准备</div>
          </div>
          <div className="connection-preview panel">
            <div className="connection-preview-label">连接预览</div>
            <div className="connection-preview-value">{form.username || "ubuntu"}@{form.host || DEFAULT_HOST}</div>
            <div className="connection-preview-note">程序内置默认端口与协议，首次只需要填写服务器和密码。</div>
          </div>
        </section>

        <section className="panel login-panel">
          <div className="login-panel-header">
            <div className="section-title">连接到云服务器</div>
            <div className="login-panel-subtitle">先连接 SSH，会话建立后再进入控制台。</div>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>服务器 Host</span>
              <input
                className="input"
                value={form.host}
                onChange={(event) => updateField("host", event.target.value)}
                onKeyDown={handleHostKeyDown}
                placeholder={DEFAULT_HOST}
                autoComplete="off"
                disabled={bootLoading || loading}
              />
            </label>

            <label className="field">
              <span>SSH 用户名</span>
              <input
                className="input"
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                placeholder="ubuntu"
                autoComplete="off"
                disabled={bootLoading || loading}
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
                disabled={bootLoading || loading}
              />
            </label>

            <label className="toggle-line">
              <input
                type="checkbox"
                checked={form.remember_password}
                onChange={(event) => updateField("remember_password", event.target.checked)}
                disabled={bootLoading || loading}
              />
              <span>记住密码</span>
            </label>

            <label className="toggle-line">
              <input
                type="checkbox"
                checked={form.auto_login}
                onChange={(event) => updateField("auto_login", event.target.checked)}
                disabled={bootLoading || loading}
              />
              <span>自动登录</span>
            </label>

            <Button variant="primary" block loading={loading || bootLoading} type="submit">
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
