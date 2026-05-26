from __future__ import annotations

import json
from pathlib import Path

from config import AppDefaults, LoginSettings, SavedLoginAccount, get_legacy_data_dir, get_login_settings_path, normalize_host


def build_default_settings(defaults: AppDefaults) -> LoginSettings:
    return LoginSettings(
        host=defaults.default_host,
        username=defaults.default_ssh_user,
        password="",
        remember_password=False,
        auto_login=False,
    )


def _normalize_saved_account(defaults: AppDefaults, raw: object) -> SavedLoginAccount | None:
    if not isinstance(raw, dict):
        return None

    host = normalize_host(str(raw.get("host") or ""))
    if not host:
        return None

    remember_password = bool(raw.get("remember_password"))
    password = str(raw.get("password") or "") if remember_password else ""
    auto_login = bool(raw.get("auto_login")) and remember_password and bool(password)

    return SavedLoginAccount(
        host=host,
        username=str(raw.get("username") or defaults.default_ssh_user).strip() or defaults.default_ssh_user,
        password=password,
        remember_password=remember_password,
        auto_login=auto_login,
    )


def load_saved_login_accounts(defaults: AppDefaults, path: Path | None = None) -> list[SavedLoginAccount]:
    source_path = path or get_login_settings_path(defaults.app_dir)
    if not source_path.exists():
        return []

    try:
        raw = json.loads(source_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    accounts: list[SavedLoginAccount] = []
    seen_keys: set[tuple[str, str]] = set()
    auto_login_taken = False
    for item in raw.get("saved_accounts") or []:
        account = _normalize_saved_account(defaults, item)
        if account is None:
            continue
        account_key = (account.host, account.username)
        if account_key in seen_keys:
            continue
        if account.auto_login:
            if auto_login_taken:
                account = SavedLoginAccount(
                    host=account.host,
                    username=account.username,
                    password=account.password,
                    remember_password=account.remember_password,
                    auto_login=False,
                )
            else:
                auto_login_taken = True
        seen_keys.add(account_key)
        accounts.append(account)

    if accounts:
        return accounts

    legacy_current = _normalize_saved_account(
        defaults,
        {
            "host": raw.get("host"),
            "username": raw.get("username"),
            "password": raw.get("password"),
            "remember_password": raw.get("remember_password"),
            "auto_login": raw.get("auto_login"),
        },
    )
    return [legacy_current] if legacy_current is not None else []


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
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            raw = {}
        if current_settings.host and not isinstance(raw.get("saved_accounts"), list):
            try:
                save_login_settings(defaults, current_settings)
            except Exception:
                pass
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


def upsert_saved_login_account(defaults: AppDefaults, settings: LoginSettings) -> list[SavedLoginAccount]:
    candidate = _normalize_saved_account(
        defaults,
        {
            "host": settings.host,
            "username": settings.username,
            "password": settings.password,
            "remember_password": settings.remember_password,
            "auto_login": settings.auto_login,
        },
    )
    if candidate is None:
        return load_saved_login_accounts(defaults)

    existing_accounts = load_saved_login_accounts(defaults)
    next_accounts = [candidate]
    for account in existing_accounts:
        if account.host == candidate.host and account.username == candidate.username:
            continue
        next_accounts.append(
            SavedLoginAccount(
                host=account.host,
                username=account.username,
                password=account.password,
                remember_password=account.remember_password,
                auto_login=False,
            )
        )

    return next_accounts[:8]


def save_login_settings(defaults: AppDefaults, settings: LoginSettings) -> LoginSettings:
    clean_settings = LoginSettings(
        host=normalize_host(settings.host),
        username=str(settings.username or "").strip() or defaults.default_ssh_user,
        password=str(settings.password or "") if settings.remember_password else "",
        remember_password=bool(settings.remember_password),
        auto_login=bool(settings.auto_login and settings.remember_password and settings.password),
    )

    source_path = get_login_settings_path(defaults.app_dir)
    saved_accounts = upsert_saved_login_account(defaults, clean_settings) if clean_settings.host else load_saved_login_accounts(defaults, source_path)

    payload = {
        "host": clean_settings.host,
        "username": clean_settings.username,
        "password": clean_settings.password,
        "remember_password": clean_settings.remember_password,
        "auto_login": clean_settings.auto_login,
        "saved_accounts": [
            {
                "host": account.host,
                "username": account.username,
                "password": account.password,
                "remember_password": account.remember_password,
                "auto_login": account.auto_login,
            }
            for account in saved_accounts
        ],
    }
    path = source_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return clean_settings
