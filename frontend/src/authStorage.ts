export type SavedWebLogin = {
  accountUsername: string;
  deviceToken: string;
  host: string;
  sshUsername: string;
  sshPassword: string;
  rememberPassword: boolean;
  autoLogin: boolean;
};

const WEB_LOGINS_STORAGE_KEY = "cloud-service-console.web-account-logins";

function normalizeLogin(value: Partial<SavedWebLogin>): SavedWebLogin | null {
  const accountUsername = String(value.accountUsername || "").trim().toLowerCase();
  const host = String(value.host || "").trim();
  if (!accountUsername || !host) {
    return null;
  }
  const rememberPassword = Boolean(value.rememberPassword && value.deviceToken);
  return {
    accountUsername,
    deviceToken: rememberPassword ? String(value.deviceToken || "") : "",
    host,
    sshUsername: String(value.sshUsername || "").trim() || "ubuntu",
    sshPassword: rememberPassword ? String(value.sshPassword || "") : "",
    rememberPassword,
    autoLogin: Boolean(value.autoLogin && rememberPassword && value.sshPassword),
  };
}

export function readSavedWebLogins(): SavedWebLogin[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WEB_LOGINS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seen = new Set<string>();
    let autoLoginTaken = false;
    const result: SavedWebLogin[] = [];
    for (const item of parsed) {
      const login = normalizeLogin(item || {});
      if (!login) {
        continue;
      }
      const key = `${login.accountUsername}::${login.host}::${login.sshUsername}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (login.autoLogin) {
        if (autoLoginTaken) {
          login.autoLogin = false;
        } else {
          autoLoginTaken = true;
        }
      }
      result.push(login);
    }
    return result.slice(0, 8);
  } catch {
    return [];
  }
}

export function saveWebLogin(login: SavedWebLogin) {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeLogin(login);
  const current = readSavedWebLogins().filter(
    (item) =>
      !(
        item.accountUsername === normalized?.accountUsername &&
        item.host === normalized?.host &&
        item.sshUsername === normalized?.sshUsername
      ),
  );
  const next = normalized?.rememberPassword
    ? [normalized, ...current.map((item) => ({ ...item, autoLogin: false }))]
    : current;
  try {
    window.localStorage.setItem(WEB_LOGINS_STORAGE_KEY, JSON.stringify(next.slice(0, 8)));
  } catch {
    // Login remains valid when browser storage is unavailable.
  }
}

export function disableWebAutoLogin() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const next = readSavedWebLogins().map((item) => ({ ...item, autoLogin: false }));
    window.localStorage.setItem(WEB_LOGINS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Logout must still complete when browser storage is unavailable.
  }
}

export function findAutoLogin(): SavedWebLogin | null {
  return readSavedWebLogins().find((item) => item.autoLogin && item.deviceToken && item.sshPassword) || null;
}
