from __future__ import annotations

import json
from pathlib import Path

from config import AppDefaults, LoginSettings, get_legacy_data_dir, get_login_settings_path, normalize_host


def build_default_settings(defaults: AppDefaults) -> LoginSettings:
    return LoginSettings(
        host=defaults.default_host,
        username=defaults.default_ssh_user,
        password="",
        remember_password=False,
        auto_login=False,
    )


def _load_settings_from_path(path: Path, defaults: AppDefaults) -> LoginSettings | None:
    if not path.exists():
        return None

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None

    remember_password = bool(raw.get("remember_password"))
    password = str(raw.get("password") or "") if remember_password else ""
    auto_login = bool(raw.get("auto_login")) and remember_password and bool(password)

    return LoginSettings(
        host=normalize_host(str(raw.get("host") or "")) or defaults.default_host,
        username=str(raw.get("username") or defaults.default_ssh_user).strip() or defaults.default_ssh_user,
        password=password,
        remember_password=remember_password,
        auto_login=auto_login,
    )


def load_login_settings(defaults: AppDefaults) -> LoginSettings:
    path = get_login_settings_path(defaults.app_dir)
    current_settings = _load_settings_from_path(path, defaults)
    if current_settings is not None:
        return current_settings

    legacy_path = get_login_settings_path(get_legacy_data_dir())
    if legacy_path != path:
        legacy_settings = _load_settings_from_path(legacy_path, defaults)
        if legacy_settings is not None:
            try:
                save_login_settings(defaults, legacy_settings)
            except Exception:
                pass
            return legacy_settings

    return build_default_settings(defaults)


def save_login_settings(defaults: AppDefaults, settings: LoginSettings) -> LoginSettings:
    clean_settings = LoginSettings(
        host=normalize_host(settings.host),
        username=str(settings.username or "").strip() or defaults.default_ssh_user,
        password=str(settings.password or "") if settings.remember_password else "",
        remember_password=bool(settings.remember_password),
        auto_login=bool(settings.auto_login and settings.remember_password and settings.password),
    )

    payload = {
        "host": clean_settings.host,
        "username": clean_settings.username,
        "password": clean_settings.password,
        "remember_password": clean_settings.remember_password,
        "auto_login": clean_settings.auto_login,
    }
    path = get_login_settings_path(defaults.app_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return clean_settings
