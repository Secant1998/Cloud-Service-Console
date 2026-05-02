from __future__ import annotations

import json
import ssl
from typing import Any, Dict, List, Optional, Tuple
from urllib import error, request

from config import CloudRuntimeConfig, HEALTH_CHECK_META, HEALTH_CHECK_ORDER
from models import HealthCheckStatus


def fetch_json(url: str) -> Dict[str, Any]:
    context = None
    if url.lower().startswith("https://"):
        context = ssl._create_unverified_context()

    try:
        with request.urlopen(url, timeout=8, context=context) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            body = response.read().decode(charset)
    except error.URLError as exc:
        raise RuntimeError(f"HTTP request failed for {url}: {exc}") from exc

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON response from {url}: {body}") from exc

    if not isinstance(data, dict):
        raise RuntimeError(f"Unexpected JSON payload from {url}: {data!r}")
    return data


class HealthChecker:
    def __init__(self, config: CloudRuntimeConfig) -> None:
        self.config = config

    def run_checks(
        self,
    ) -> Tuple[List[HealthCheckStatus], Dict[str, str], Optional[Dict[str, Any]], int, int, List[str]]:
        health_results = {}
        health_errors = {}
        health_urls = {
            "clock": self.config.clock_url,
            "streams": self.config.streams_url,
            "control": self.config.control_health_url,
        }

        for key in HEALTH_CHECK_ORDER:
            try:
                health_results[key] = fetch_json(health_urls[key])
            except Exception as exc:
                health_results[key] = None
                health_errors[key] = str(exc)

        broker_status = None
        pending_offers = 0
        try:
            broker_status = fetch_json(self.config.control_status_url)
            sessions = broker_status.get("sessions") if isinstance(broker_status, dict) else {}
            if isinstance(sessions, dict):
                pending_offers = sum(
                    int((item or {}).get("pendingOffers") or 0)
                    for item in sessions.values()
                    if isinstance(item, dict)
                )
        except Exception as exc:
            health_errors.setdefault("control", str(exc))

        health_checks = []
        ok_count = 0
        summary_parts = []
        for key in HEALTH_CHECK_ORDER:
            result = health_results.get(key)
            error_text = str(health_errors.get(key) or "")
            if isinstance(result, dict):
                ok = True
                status = "ok"
                note = HEALTH_CHECK_META[key]["description"]
                ok_count += 1
            else:
                ok = False
                status = "unreachable"
                note = error_text or HEALTH_CHECK_META[key]["description"]

            health_checks.append(
                HealthCheckStatus(
                    key=key,
                    title=HEALTH_CHECK_META[key]["title"],
                    description=HEALTH_CHECK_META[key]["description"],
                    ok=ok,
                    note=note,
                    status=status,
                )
            )
            summary_parts.append(f"{key}={status}")

        return health_checks, health_errors, broker_status, pending_offers, ok_count, summary_parts
