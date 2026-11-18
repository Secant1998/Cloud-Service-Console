"""Deploy only MOPS catalog metadata using the existing authenticated SSH path."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shlex
from urllib.request import Request, urlopen

from model_library_transfer import connect, remote


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--patches", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    payload = json.loads(args.patches.read_text(encoding="utf-8"))
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    stage = "/opt/telebot-model-library/_metadata_staging/mops-" + stamp
    client = connect()
    try:
        remote(client, "mkdir -p " + shlex.quote(stage))
        with client.open_sftp() as sftp:
            sftp.put(str(Path(__file__).with_name("model_scale_migration.py")), stage + "/migration.py")
            sftp.put(str(args.patches), stage + "/patches.json")
        command = (
            "/opt/cloud-service-console-web/.venv/bin/python " + shlex.quote(stage + "/migration.py")
            + " --root /opt/telebot-model-library --backend /opt/cloud-service-console-web/backend"
            + " --patches " + shlex.quote(stage + "/patches.json")
        )
        preflight = json.loads(remote(client, command, timeout=180))
        print(json.dumps({"stage": "preflight", **preflight}), flush=True)
        result = {"preflight": preflight, "remote_stage": stage}
        if args.apply:
            result["migration"] = json.loads(remote(client, command + " --apply", timeout=900))
            result["postflight"] = json.loads(remote(client, command, timeout=180))
            if result["postflight"]["changed_models"] != 0:
                raise RuntimeError("Server still has unapplied model metadata")
            credentials = json.loads((Path.home() / ".config/telebot-model-library.json").read_text(encoding="utf-8"))
            if credentials["base_url"].rstrip("/") != "https://console.cityulive.com":
                raise ValueError("Unexpected API credential destination")
            policies = {patch["id"]: patch["physical_scale"] for patch in payload["patches"]}
            ids = list(dict.fromkeys(["partnet_7187", payload["patches"][0]["id"], payload["patches"][-1]["id"]]))
            checks = []
            for asset_id in ids:
                request = Request(credentials["base_url"] + "/api/model-library/" + asset_id + "/manifest",
                                  headers={"X-Model-Library-Token": credentials["token"]})
                with urlopen(request, timeout=60) as response:
                    manifest = json.load(response)
                policy = manifest["entry"]["parameters"]["physical_scale"]
                if policy != policies[asset_id]:
                    raise RuntimeError("Live manifest differs for " + asset_id)
                checks.append({"id": asset_id, "metadata_matches": True,
                               "default_scale": policy["default_scale"]})
            result["live_api_checks"] = checks
        args.report.mkdir(parents=True, exist_ok=True)
        target = args.report / ("deployment.json" if args.apply else "preflight.json")
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False), flush=True)
    finally:
        client.close()


if __name__ == "__main__":
    main()
