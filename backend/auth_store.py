from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


ADMIN_USERNAME = "xhfang"
ADMIN_PASSWORD = "admin"
ACCOUNT_STORE_FILENAME = "cloud-console-accounts.json"
AGENT_SETTINGS_FILENAME = "cloud-console-agent-settings.json"
PASSWORD_ITERATIONS = 310_000
SESSION_TTL_SECONDS = 12 * 60 * 60
DEVICE_TTL_SECONDS = 30 * 24 * 60 * 60
ONLINE_ACTIVITY_WINDOW_SECONDS = 90
LAST_SEEN_WRITE_INTERVAL_SECONDS = 30
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
AVATAR_SIZE = 256
AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024
AVATAR_MAX_SOURCE_PIXELS = 20_000_000
AVATAR_DATA_HEADERS = {
    "data:image/jpeg;base64",
    "data:image/png;base64",
    "data:image/webp;base64",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _password_hash(password: str, salt_hex: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        PASSWORD_ITERATIONS,
    )
    return digest.hex()


def _normalize_avatar_data_url(value: object) -> str:
    data_url = str(value or "").strip()
    header, separator, encoded = data_url.partition(",")
    if not separator or header.lower() not in AVATAR_DATA_HEADERS:
        raise ValueError("头像仅支持 JPG、PNG 或 WebP 图片。")
    try:
        raw_image = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("头像图片数据无效。") from exc
    if not raw_image:
        raise ValueError("头像图片不能为空。")
    if len(raw_image) > AVATAR_MAX_INPUT_BYTES:
        raise ValueError("头像图片不能超过 5 MB。")

    try:
        with Image.open(io.BytesIO(raw_image)) as source:
            source.verify()
        with Image.open(io.BytesIO(raw_image)) as source:
            width, height = source.size
            if width <= 0 or height <= 0 or width * height > AVATAR_MAX_SOURCE_PIXELS:
                raise ValueError("头像图片尺寸无效或过大。")
            frame = ImageOps.exif_transpose(source).convert("RGBA")
            avatar = ImageOps.fit(
                frame,
                (AVATAR_SIZE, AVATAR_SIZE),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            output = io.BytesIO()
            avatar.save(output, format="PNG", optimize=True)
    except ValueError:
        raise
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError) as exc:
        raise ValueError("无法读取头像图片。") from exc

    encoded_avatar = base64.b64encode(output.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded_avatar}"


def _atomic_write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f"{path.suffix}.tmp")
    temporary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary_path.replace(path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


class AccountStore:
    def __init__(self, storage_dir: Path) -> None:
        self.path = storage_dir / ACCOUNT_STORE_FILENAME
        self._lock = threading.RLock()
        self._sessions: dict[str, dict[str, object]] = {}
        self._last_seen_write_at: dict[str, float] = {}
        self._ensure_admin_account()

    @staticmethod
    def normalize_username(username: object) -> str:
        return str(username or "").strip().lower()

    @staticmethod
    def validate_username(username: str) -> None:
        if not USERNAME_PATTERN.fullmatch(username):
            raise ValueError("用户名须为 3-32 位字母、数字、点、下划线或连字符。")

    @staticmethod
    def validate_password(password: str) -> None:
        if len(password) < 4 or len(password) > 128:
            raise ValueError("密码长度须为 4-128 位。")

    def _empty_payload(self) -> dict[str, object]:
        return {"version": 1, "users": {}, "devices": {}}

    def _load(self) -> dict[str, object]:
        if not self.path.exists():
            return self._empty_payload()
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return self._empty_payload()
        if not isinstance(payload, dict):
            return self._empty_payload()
        if not isinstance(payload.get("users"), dict):
            payload["users"] = {}
        if not isinstance(payload.get("devices"), dict):
            payload["devices"] = {}
        payload["version"] = 1
        return payload

    def _save(self, payload: dict[str, object]) -> None:
        _atomic_write_json(self.path, payload)

    @staticmethod
    def _build_user(username: str, password: str, role: str) -> dict[str, object]:
        salt = secrets.token_hex(16)
        return {
            "username": username,
            "passwordSalt": salt,
            "passwordHash": _password_hash(password, salt),
            "role": role,
            "createdAt": _utc_now(),
            "avatarDataUrl": "",
        }

    @staticmethod
    def _public_account(username: str, user: dict[str, object]) -> dict[str, str]:
        return {
            "username": username,
            "role": "admin" if user.get("role") == "admin" else "user",
            "avatar_data_url": str(user.get("avatarDataUrl") or ""),
        }

    def _ensure_admin_account(self) -> None:
        with self._lock:
            payload = self._load()
            users = payload["users"]
            assert isinstance(users, dict)
            admin = users.get(ADMIN_USERNAME)
            if not isinstance(admin, dict):
                users[ADMIN_USERNAME] = self._build_user(ADMIN_USERNAME, ADMIN_PASSWORD, "admin")
                self._save(payload)
                return
            if admin.get("role") != "admin":
                admin["role"] = "admin"
                self._save(payload)

    def register(self, username: object, password: object) -> dict[str, str]:
        clean_username = self.normalize_username(username)
        clean_password = str(password or "")
        self.validate_username(clean_username)
        self.validate_password(clean_password)
        if clean_username == ADMIN_USERNAME:
            raise ValueError("该用户名为系统管理员账号，不能注册。")

        with self._lock:
            payload = self._load()
            users = payload["users"]
            assert isinstance(users, dict)
            if clean_username in users:
                raise ValueError("用户名已经存在。")
            users[clean_username] = self._build_user(clean_username, clean_password, "user")
            self._save(payload)
        return {"username": clean_username, "role": "user"}

    def authenticate_password(self, username: object, password: object) -> dict[str, str] | None:
        clean_username = self.normalize_username(username)
        clean_password = str(password or "")
        with self._lock:
            payload = self._load()
            users = payload["users"]
            assert isinstance(users, dict)
            user = users.get(clean_username)
            if not isinstance(user, dict):
                return None
            salt = str(user.get("passwordSalt") or "")
            expected_hash = str(user.get("passwordHash") or "")
            if not salt or not expected_hash:
                return None
            try:
                actual_hash = _password_hash(clean_password, salt)
            except ValueError:
                return None
            if not hmac.compare_digest(actual_hash, expected_hash):
                return None
            return self._public_account(clean_username, user)

    def create_session(self, account: dict[str, str]) -> str:
        token = secrets.token_urlsafe(32)
        now = time.time()
        with self._lock:
            self._purge_sessions(now)
            self._sessions[_token_hash(token)] = {
                "username": account["username"],
                "role": account["role"],
                "createdAt": now,
                "lastActivityAt": now,
                "expiresAt": now + SESSION_TTL_SECONDS,
            }
            self._record_last_seen(account["username"], now, force=True)
        return token

    def resolve_session(self, token: object) -> dict[str, str] | None:
        clean_token = str(token or "").strip()
        if not clean_token:
            return None
        now = time.time()
        with self._lock:
            self._purge_sessions(now)
            session = self._sessions.get(_token_hash(clean_token))
            if not isinstance(session, dict):
                return None
            session["lastActivityAt"] = now
            username = self.normalize_username(session.get("username"))
            self._record_last_seen(username, now)
            payload = self._load()
            users = payload["users"]
            assert isinstance(users, dict)
            user = users.get(username)
            if not isinstance(user, dict):
                self._sessions.pop(_token_hash(clean_token), None)
                return None
            return self._public_account(username, user)

    def revoke_session(self, token: object) -> None:
        clean_token = str(token or "").strip()
        if not clean_token:
            return
        with self._lock:
            session = self._sessions.pop(_token_hash(clean_token), None)
            if isinstance(session, dict):
                self._record_last_seen(str(session.get("username") or ""), time.time(), force=True)

    def _purge_sessions(self, now: float) -> None:
        stale_keys = [
            token_hash
            for token_hash, session in self._sessions.items()
            if float(session.get("expiresAt") or 0) <= now
        ]
        for token_hash in stale_keys:
            self._sessions.pop(token_hash, None)

    def _record_last_seen(self, username: str, now: float, *, force: bool = False) -> None:
        clean_username = self.normalize_username(username)
        if not clean_username:
            return
        last_write_at = self._last_seen_write_at.get(clean_username, 0.0)
        if not force and now - last_write_at < LAST_SEEN_WRITE_INTERVAL_SECONDS:
            return

        payload = self._load()
        users = payload["users"]
        assert isinstance(users, dict)
        user = users.get(clean_username)
        if not isinstance(user, dict):
            return
        user["lastSeenAt"] = datetime.fromtimestamp(now, timezone.utc).isoformat()
        self._save(payload)
        self._last_seen_write_at[clean_username] = now

    def list_users(self) -> list[dict[str, object]]:
        now = time.time()
        online_cutoff = now - ONLINE_ACTIVITY_WINDOW_SECONDS
        with self._lock:
            self._purge_sessions(now)
            active_sessions: dict[str, int] = {}
            for session in self._sessions.values():
                username = self.normalize_username(session.get("username"))
                last_activity_at = float(session.get("lastActivityAt") or 0.0)
                if username and last_activity_at >= online_cutoff:
                    active_sessions[username] = active_sessions.get(username, 0) + 1

            payload = self._load()
            users = payload["users"]
            assert isinstance(users, dict)
            result: list[dict[str, object]] = []
            for key, raw_user in users.items():
                if not isinstance(raw_user, dict):
                    continue
                username = self.normalize_username(raw_user.get("username") or key)
                session_count = active_sessions.get(username, 0)
                result.append(
                    {
                        "username": username,
                        "role": "admin" if raw_user.get("role") == "admin" else "user",
                        "status": "active",
                        "created_at": str(raw_user.get("createdAt") or ""),
                        "online": session_count > 0,
                        "last_seen_at": str(raw_user.get("lastSeenAt") or ""),
                        "active_sessions": session_count,
                        "avatar_data_url": str(raw_user.get("avatarDataUrl") or ""),
                    }
                )

            result.sort(key=lambda user: (user["role"] != "admin", str(user["created_at"]), str(user["username"])))
            return result

    def create_device_credential(self, account: dict[str, str]) -> str:
        token = secrets.token_urlsafe(40)
        now = time.time()
        with self._lock:
            payload = self._load()
            devices = payload["devices"]
            assert isinstance(devices, dict)
            self._purge_devices(devices, now)
            devices[_token_hash(token)] = {
                "username": account["username"],
                "role": account["role"],
                "createdAt": _utc_now(),
                "expiresAt": now + DEVICE_TTL_SECONDS,
            }
            self._save(payload)
        return token

    def authenticate_device(self, token: object) -> dict[str, str] | None:
        clean_token = str(token or "").strip()
        if not clean_token:
            return None
        now = time.time()
        with self._lock:
            payload = self._load()
            devices = payload["devices"]
            users = payload["users"]
            assert isinstance(devices, dict)
            assert isinstance(users, dict)
            changed = self._purge_devices(devices, now)
            device = devices.get(_token_hash(clean_token))
            if not isinstance(device, dict):
                if changed:
                    self._save(payload)
                return None
            username = self.normalize_username(device.get("username"))
            user = users.get(username)
            if not isinstance(user, dict):
                devices.pop(_token_hash(clean_token), None)
                self._save(payload)
                return None
            device["expiresAt"] = now + DEVICE_TTL_SECONDS
            self._save(payload)
            return self._public_account(username, user)

    def update_avatar(self, username: object, data_url: object) -> str:
        clean_username = self.normalize_username(username)
        normalized_avatar = _normalize_avatar_data_url(data_url)
        with self._lock:
            payload = self._load()
            users = payload["users"]
            assert isinstance(users, dict)
            user = users.get(clean_username)
            if not isinstance(user, dict):
                raise ValueError("账号不存在。")
            user["avatarDataUrl"] = normalized_avatar
            user["avatarUpdatedAt"] = _utc_now()
            self._save(payload)
        return normalized_avatar

    @staticmethod
    def _purge_devices(devices: dict[str, object], now: float) -> bool:
        stale_keys = [
            token_hash
            for token_hash, device in devices.items()
            if not isinstance(device, dict) or float(device.get("expiresAt") or 0) <= now
        ]
        for token_hash in stale_keys:
            devices.pop(token_hash, None)
        return bool(stale_keys)


class AgentSettingsStore:
    def __init__(self, storage_dir: Path) -> None:
        self.path = storage_dir / AGENT_SETTINGS_FILENAME
        self._lock = threading.RLock()

    @staticmethod
    def defaults() -> dict[str, object]:
        return {
            "enabled": False,
            "baseUrl": "https://api.deepseek.com",
            "model": "deepseek-chat",
            "apiKey": "",
            "updatedAt": "",
            "updatedBy": "",
        }

    def load_private(self) -> dict[str, object]:
        with self._lock:
            settings = self.defaults()
            if not self.path.exists():
                return settings
            try:
                payload = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return settings
            if isinstance(payload, dict):
                settings.update(payload)
            return settings

    def public_view(self) -> dict[str, object]:
        settings = self.load_private()
        api_key = str(settings.get("apiKey") or "")
        return {
            "enabled": bool(settings.get("enabled")),
            "base_url": str(settings.get("baseUrl") or "https://api.deepseek.com"),
            "model": str(settings.get("model") or "deepseek-chat"),
            "api_key_configured": bool(api_key),
            "api_key_hint": f"...{api_key[-4:]}" if len(api_key) >= 4 else "",
            "updated_at": str(settings.get("updatedAt") or ""),
            "updated_by": str(settings.get("updatedBy") or ""),
        }

    def save(self, payload: dict[str, object], username: str) -> dict[str, object]:
        with self._lock:
            current = self.load_private()
            base_url = str(payload.get("base_url") or "").strip().rstrip("/")
            model = str(payload.get("model") or "").strip()
            api_key = str(payload.get("api_key") or "").strip()
            if not base_url.startswith(("https://", "http://")):
                raise ValueError("API 地址必须以 http:// 或 https:// 开头。")
            if not model:
                raise ValueError("模型名称不能为空。")
            current.update(
                {
                    "enabled": bool(payload.get("enabled")),
                    "baseUrl": base_url,
                    "model": model,
                    "updatedAt": _utc_now(),
                    "updatedBy": username,
                }
            )
            if api_key:
                current["apiKey"] = api_key
            if bool(payload.get("clear_api_key")):
                current["apiKey"] = ""
                current["enabled"] = False
            _atomic_write_json(self.path, current)
            return self.public_view()
