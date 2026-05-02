from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

DEFAULT_TARGETS = ("Cloud Service Console", "cloud-console-backend")
DEFAULT_INTERVAL_SECONDS = 5.0


@dataclass
class ProcessSample:
    process_name: str
    pid: int
    cpu_seconds: float
    cpu_percent: float | None
    working_set_mb: float
    private_mb: float
    handles: int
    thread_count: int
    start_time: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Monitor Cloud Service Console and backend process health over time."
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=DEFAULT_INTERVAL_SECONDS,
        help="Sampling interval in seconds. Default: 5",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=0.0,
        help="Optional total run time in seconds. Use 0 to run until Ctrl+C.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional JSONL output path. Defaults to data/process-watch/process-watch-<timestamp>.jsonl",
    )
    parser.add_argument(
        "--target",
        action="append",
        dest="targets",
        default=[],
        help="Optional process name to watch. Can be repeated.",
    )
    return parser.parse_args()


def default_output_path() -> Path:
    root_dir = Path(__file__).resolve().parents[1]
    output_dir = root_dir / "data" / "process-watch"
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return output_dir / f"process-watch-{timestamp}.jsonl"


def powershell_targets_literal(targets: list[str]) -> str:
    quoted = []
    for item in targets:
        quoted.append("'" + item.replace("'", "''") + "'")
    return ", ".join(quoted)


def run_process_query(targets: list[str]) -> list[dict[str, object]]:
    targets_literal = powershell_targets_literal(targets)
    command = rf"""
$ErrorActionPreference = 'Stop'
$targets = @({targets_literal})
$items = Get-Process | Where-Object {{ $targets -contains $_.ProcessName }} | ForEach-Object {{
  [pscustomobject]@{{
    process_name = $_.ProcessName
    pid = $_.Id
    cpu_seconds = if ($null -ne $_.CPU) {{ [double]$_.CPU }} else {{ 0.0 }}
    working_set = [int64]$_.WorkingSet64
    private_bytes = [int64]$_.PrivateMemorySize64
    handles = [int64]$_.Handles
    thread_count = [int]$_.Threads.Count
    start_time = try {{ $_.StartTime.ToString('o') }} catch {{ $null }}
  }}
}}
if (@($items).Count -eq 0) {{
  '[]'
}} else {{
  $items | ConvertTo-Json -Compress
}}
"""
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", command],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip() or "Unknown PowerShell error"
        raise RuntimeError(stderr)

    payload = result.stdout.strip() or "[]"
    data = json.loads(payload)
    if isinstance(data, dict):
        return [data]
    return list(data)


def build_samples(
    raw_processes: list[dict[str, object]],
    previous_cpu: dict[int, float],
    elapsed_seconds: float | None,
) -> tuple[list[ProcessSample], dict[int, float]]:
    next_cpu: dict[int, float] = {}
    cpu_count = max(os.cpu_count() or 1, 1)
    samples: list[ProcessSample] = []

    for item in raw_processes:
        pid = int(item["pid"])
        cpu_seconds = float(item.get("cpu_seconds") or 0.0)
        next_cpu[pid] = cpu_seconds

        cpu_percent = None
        if elapsed_seconds and pid in previous_cpu:
            cpu_delta = max(0.0, cpu_seconds - previous_cpu[pid])
            cpu_percent = (cpu_delta / elapsed_seconds / cpu_count) * 100.0

        samples.append(
            ProcessSample(
                process_name=str(item["process_name"]),
                pid=pid,
                cpu_seconds=cpu_seconds,
                cpu_percent=cpu_percent,
                working_set_mb=round(int(item.get("working_set") or 0) / (1024 * 1024), 2),
                private_mb=round(int(item.get("private_bytes") or 0) / (1024 * 1024), 2),
                handles=int(item.get("handles") or 0),
                thread_count=int(item.get("thread_count") or 0),
                start_time=str(item["start_time"]) if item.get("start_time") else None,
            )
        )

    samples.sort(key=lambda sample: (sample.process_name.lower(), sample.pid))
    return samples, next_cpu


def summarize(samples: list[ProcessSample], targets: list[str]) -> tuple[dict[str, dict[str, object]], list[str]]:
    grouped: dict[str, list[ProcessSample]] = defaultdict(list)
    for sample in samples:
        grouped[sample.process_name].append(sample)

    summary: dict[str, dict[str, object]] = {}
    warnings: list[str] = []

    for target in targets:
        items = grouped.get(target, [])
        total_cpu = sum(item.cpu_percent or 0.0 for item in items)
        summary[target] = {
            "count": len(items),
            "pids": [item.pid for item in items],
            "working_set_mb": round(sum(item.working_set_mb for item in items), 2),
            "private_mb": round(sum(item.private_mb for item in items), 2),
            "cpu_percent": round(total_cpu, 2),
            "handles": sum(item.handles for item in items),
            "threads": sum(item.thread_count for item in items),
        }
        if len(items) == 0:
            warnings.append(f"{target}: not running")
        elif len(items) > 1:
            warnings.append(f"{target}: duplicate instances ({len(items)})")

    return summary, warnings


def format_sample_line(
    sample_time: datetime,
    summary: dict[str, dict[str, object]],
    warnings: list[str],
    targets: list[str],
) -> str:
    parts = [sample_time.strftime("%Y-%m-%d %H:%M:%S")]
    for target in targets:
        item = summary[target]
        count = item["count"]
        pids = item["pids"]
        pids_text = ",".join(str(pid) for pid in pids) if pids else "-"
        parts.append(
            (
                f"{target} x{count} "
                f"pid[{pids_text}] "
                f"rss={item['working_set_mb']:.2f}MB "
                f"private={item['private_mb']:.2f}MB "
                f"cpu={item['cpu_percent']:.2f}% "
                f"handles={item['handles']} "
                f"threads={item['threads']}"
            )
        )
    if warnings:
        parts.append("WARN: " + "; ".join(warnings))
    return " | ".join(parts)


def write_sample(
    output_path: Path,
    sample_time: datetime,
    interval: float,
    samples: list[ProcessSample],
    summary: dict[str, dict[str, object]],
    warnings: list[str],
) -> None:
    payload = {
        "timestamp": sample_time.isoformat(),
        "interval_seconds": interval,
        "summary": summary,
        "warnings": warnings,
        "processes": [
            {
                "process_name": item.process_name,
                "pid": item.pid,
                "cpu_seconds": round(item.cpu_seconds, 4),
                "cpu_percent": round(item.cpu_percent, 2) if item.cpu_percent is not None else None,
                "working_set_mb": item.working_set_mb,
                "private_mb": item.private_mb,
                "handles": item.handles,
                "thread_count": item.thread_count,
                "start_time": item.start_time,
            }
            for item in samples
        ],
    }
    with output_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main() -> int:
    if sys.platform != "win32":
        print("This monitor currently supports Windows only.")
        return 1

    args = parse_args()
    interval = max(1.0, float(args.interval))
    duration = max(0.0, float(args.duration))
    targets = list(dict.fromkeys(args.targets or list(DEFAULT_TARGETS)))
    output_path = args.output.resolve() if args.output else default_output_path()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Watching: {', '.join(targets)}")
    print(f"Interval: {interval:.1f}s")
    print(f"Output: {output_path}")
    print("Press Ctrl+C to stop.\n")

    previous_cpu: dict[int, float] = {}
    start_monotonic = time.monotonic()
    next_tick = start_monotonic
    sample_count = 0

    try:
        while True:
            now = datetime.now()
            loop_started = time.monotonic()
            elapsed = None if sample_count == 0 else max(0.001, loop_started - (next_tick - interval))

            raw_processes = run_process_query(targets)
            samples, previous_cpu = build_samples(raw_processes, previous_cpu, elapsed)
            summary, warnings = summarize(samples, targets)

            line = format_sample_line(now, summary, warnings, targets)
            print(line)
            write_sample(output_path, now, interval, samples, summary, warnings)

            sample_count += 1
            if duration and (loop_started - start_monotonic) >= duration:
                break

            next_tick = loop_started + interval
            sleep_seconds = next_tick - time.monotonic()
            if sleep_seconds > 0:
                time.sleep(sleep_seconds)
    except KeyboardInterrupt:
        print("\nStopped by user.")
        return 0
    except Exception as exc:
        print(f"\nMonitor failed: {exc}", file=sys.stderr)
        return 1

    print("\nCompleted monitoring run.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
