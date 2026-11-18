"""Deploy and supervise isolated, resumable PartNet preparation on the library host."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shlex
from model_library_transfer import connect, remote

SOURCE = Path("E:/Desktop/123/code_1015")
BASE = "/opt/telebot-model-library/_preprocessing"
SERVICE = "partnet-preprocessing"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--setup", action="store_true")
    parser.add_argument("--start", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--deploy-api", action="store_true")
    args = parser.parse_args()
    client = connect()
    try:
        if args.setup:
            remote(client, "mkdir -p " + BASE + "/code/shared/simulators/task_program " +
                   BASE + "/code/scene_generator/modern/scripts " + BASE + "/state")
            with client.open_sftp() as sftp:
                paths = list((SOURCE / "shared/simulators").glob("*.py"))
                paths += list((SOURCE / "shared/simulators/task_program").glob("*.py"))
                paths += [SOURCE / "scene_generator/workflow_paths.py",
                          SOURCE / "scene_generator/modern/scripts/preprocess_partnet.py"]
                for path in paths:
                    target = BASE + "/code/" + path.relative_to(SOURCE).as_posix()
                    sftp.put(str(path), target + ".new")
                    sftp.posix_rename(target + ".new", target)
            # The library/web application environment is left unchanged.
            command = ("python3 -m venv " + BASE + "/venv && " + BASE + "/venv/bin/python -m pip install "
                       "'mujoco==3.12.0' 'coacd==1.0.14' 'trimesh==5.2.0' 'numpy==2.2.6' 'scipy==1.15.3' "
                       "'pillow==12.3.0' 'networkx==3.4.2'")
            print(remote(client, command, timeout=600), flush=True)
        if args.deploy_api:
            root = Path(__file__).resolve().parents[1]
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            live = "/opt/cloud-service-console-web/backend"
            backup = BASE + "/api-backup-" + stamp
            remote(client, "mkdir -p " + backup)
            with client.open_sftp() as sftp:
                with sftp.open(live + "/model_library.py", "rb") as stream:
                    original = stream.read()
                with sftp.open(backup + "/model_library.py", "wb") as stream:
                    stream.write(original)
                # Apply only preparation routes to the live module; preserve unrelated deployment edits.
                local = (root / "backend/model_library.py").read_text(encoding="utf-8")
                start = local.index("    @router.get('/{asset_id}/preparation')")
                end = local.index("    @router.get('/{asset_id}/view')", start)
                text = original.decode()
                if "    @router.get('/{asset_id}/preparation')" not in text:
                    text = text.replace("    @router.get('/{asset_id}/view')",
                                        local[start:end] + "    @router.get('/{asset_id}/view')", 1)
                status_start = local.index("    @router.get('/preparation-status')")
                status_end = local.index("    @router.get('/{asset_id}')", status_start)
                if "    @router.get('/preparation-status')" not in text:
                    text = text.replace("    @router.get('/{asset_id}')",
                                        local[status_start:status_end] + "    @router.get('/{asset_id}')", 1)
                for name, data in [("model_preparation.py", (root / "backend/model_preparation.py").read_bytes()),
                                   ("model_library.py", text.encode())]:
                    with sftp.open(live + "/" + name + ".preparation-new", "wb") as stream:
                        stream.write(data)
                    sftp.posix_rename(live + "/" + name + ".preparation-new", live + "/" + name)
            try:
                print(remote(client, "/opt/cloud-service-console-web/.venv/bin/python -m py_compile " +
                             live + "/model_library.py " + live + "/model_preparation.py && "
                             "sudo systemctl restart cloud-service-console-web.service && "
                             "systemctl is-active cloud-service-console-web.service", timeout=60), flush=True)
            except Exception:
                remote(client, "cp " + backup + "/model_library.py " + live +
                       "/model_library.py && sudo systemctl restart cloud-service-console-web.service")
                raise
            print(json.dumps({"api_backup": backup}), flush=True)
        if args.start:
            # One conversion at a time, two OpenMP threads, lower priority and explicit resource caps.
            unit = (
                "[Unit]\nDescription=PartNet reusable MuJoCo bundles\nAfter=network.target\n"
                "[Service]\nType=simple\nUser=ubuntu\nWorkingDirectory=" + BASE + "\n"
                "Nice=15\nCPUQuota=180%\nMemoryMax=4G\nTasksMax=128\nRestart=on-failure\nRestartSec=30\n"
                "OOMPolicy=kill\nEnvironment=OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 PYTHONUNBUFFERED=1\n"
                "ExecStart=" + BASE + "/venv/bin/python " + BASE + "/code/scene_generator/modern/scripts/preprocess_partnet.py "
                "--catalog /opt/telebot-model-library/catalog --state " + BASE + "/state --seconds 1800 --attempts 2\n"
                "[Install]\nWantedBy=multi-user.target\n")
            with client.open_sftp() as sftp:
                with sftp.open(BASE + "/" + SERVICE + ".service", "w") as stream:
                    stream.write(unit)
            command = ("sudo install -m 644 " + BASE + "/" + SERVICE + ".service /etc/systemd/system/" +
                       SERVICE + ".service && sudo systemctl daemon-reload && sudo systemctl enable --now " +
                       SERVICE + ".service")
            print(remote(client, command, timeout=60), flush=True)
        if args.status:
            print(remote(client, "systemctl show " + SERVICE +
                         ".service -p ActiveState -p SubState -p MemoryCurrent -p CPUUsageNSec; "
                         "cat " + BASE + "/state/status.json; "
                         "journalctl -u " + SERVICE + ".service -n 5 --no-pager; "
                         "df -h /opt/telebot-model-library", timeout=60), flush=True)
    finally:
        client.close()


if __name__ == "__main__":
    main()
