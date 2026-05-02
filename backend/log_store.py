from __future__ import annotations

from collections import deque
from datetime import datetime
from threading import Lock
from typing import Any, Dict, List


class LogStore:
    def __init__(self, limit: int = 400) -> None:
        self._entries = deque(maxlen=limit)
        self._lock = Lock()

    def append(self, message: str, level: str = "info") -> Dict[str, str]:
        entry = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "level": level,
            "message": str(message or "").strip(),
        }
        with self._lock:
            self._entries.append(entry)
        return entry

    def get_logs(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._entries)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
