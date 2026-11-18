from __future__ import annotations

import hashlib
import json
import shlex
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from deploy_web_console import connect, read_saved_login, remote_run

ROOT = Path(__file__).resolve().parents[1]
P2P_SOURCE = ROOT.parent / "webrtc-p2p-video"
TELEBOT_ROOT = ROOT.parent / "telebot2"
SECRET_ENV = TELEBOT_ROOT / ".local" / "setup" / "private" / "authoritative-secrets.env"
REMOTE_DIR = "/opt/webrtc-p2p-video"
SERVICE = "webrtc-p2p-video.service"
PUBLIC_BASE_URL = "https://p2p.cityulive.com"


def read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key.strip()] = value
    return values


def build_auth_environment() -> tuple[str, dict[str, str]]:
    secrets = read_dotenv(SECRET_ENV)
    role_tokens = {
        "frontend": secrets.get("TELEBOT_FRONTEND_SIGNAL_TOKEN", ""),
        "compute": secrets.get("TELEBOT_COMPUTE_SIGNAL_TOKEN", ""),
        "robot_edge": secrets.get("TELEBOT_EDGE_SIGNAL_TOKEN", ""),
    }
    missing = [role for role, token in role_tokens.items() if not token]
    if missing:
        raise RuntimeError(f"Missing P2P V2 role credentials: {', '.join(missing)}")
    hashes = {role: hashlib.sha256(token.encode("utf-8")).hexdigest() for role, token in role_tokens.items()}
    content = "\n".join(
        [
            "P2P_V2_AUTH_MODE=bearer-role",
            f"P2P_V2_FRONTEND_TOKEN_SHA256={hashes['frontend']}",
            f"P2P_V2_COMPUTE_TOKEN_SHA256={hashes['compute']}",
            f"P2P_V2_ROBOT_EDGE_TOKEN_SHA256={hashes['robot_edge']}",
            "",
        ]
    )
    return content, role_tokens


def api_request(method: str, path: str, body: dict | None = None, token: str = "") -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(
        PUBLIC_BASE_URL + path,
        method=method,
        headers=headers,
        data=None if body is None else json.dumps(body).encode("utf-8"),
    )
    try:
        with urlopen(request, timeout=8) as response:
            return response.status, json.loads(response.read())
    except HTTPError as exc:
        return exc.code, json.loads(exc.read())


def smoke_test(role_tokens: dict[str, str]) -> None:
    status, body = api_request("GET", "/clock")
    server_ms = body.get("server_ms") if isinstance(body, dict) else None
    if status != 200 or body.get("ok") is not True or not isinstance(server_ms, int) or server_ms <= 0:
        raise RuntimeError(f"Public cloud clock endpoint failed: HTTP {status}, body={body}")

    room = "deployment-smoke"
    endpoint_path = f"/api/v2/rooms/{room}/endpoints"
    registrations: list[tuple[str, str, str]] = []

    suffix = uuid.uuid4().hex[:10]
    unauthenticated_body = {
        "endpointId": f"frontend-unauthenticated-{suffix}",
        "peerId": f"peer-unauthenticated-{suffix}",
        "role": "frontend",
        "status": "waiting",
    }
    status, body = api_request("POST", endpoint_path, unauthenticated_body)
    if status != 401 or body.get("code") != "authentication_required":
        raise RuntimeError(f"Protected V2 endpoint accepted an unauthenticated request: HTTP {status}")

    try:
        for role, token in role_tokens.items():
            endpoint_id = f"{role}-{suffix}"
            peer_id = f"peer-{role}-{suffix}"
            status, _ = api_request(
                "POST",
                endpoint_path,
                {
                    "endpointId": endpoint_id,
                    "peerId": peer_id,
                    "role": role.replace("_", "-"),
                    "status": "waiting",
                },
                token,
            )
            if status != 200:
                raise RuntimeError(f"Authenticated V2 {role} registration failed: HTTP {status}")
            registrations.append((endpoint_id, peer_id, token))

        duplicate_endpoint_id = f"duplicate-{suffix}"
        duplicate_token = role_tokens["compute"]
        assigned_ids: list[str] = []
        for index in (1, 2):
            peer_id = f"peer-duplicate-{index}-{suffix}"
            status, body = api_request(
                "POST",
                endpoint_path,
                {
                    "endpointId": duplicate_endpoint_id,
                    "peerId": peer_id,
                    "role": "compute",
                    "status": "waiting",
                },
                duplicate_token,
            )
            endpoint = body.get("endpoint") if isinstance(body, dict) else None
            assigned_id = str((endpoint or {}).get("endpointId") or "")
            requested_id = str((endpoint or {}).get("requestedEndpointId") or "")
            if status != 200 or not assigned_id or requested_id != duplicate_endpoint_id:
                raise RuntimeError(f"Duplicate V2 registration {index} failed: HTTP {status}")
            assigned_ids.append(assigned_id)
            registrations.append((duplicate_endpoint_id, peer_id, duplicate_token))

        if assigned_ids[0] != duplicate_endpoint_id or assigned_ids[1] == duplicate_endpoint_id:
            raise RuntimeError(f"Duplicate V2 endpoint was not assigned a virtual suffix: {assigned_ids}")
        if assigned_ids[0] == assigned_ids[1]:
            raise RuntimeError(f"Duplicate V2 endpoints received the same ID: {assigned_ids[0]}")

        status, body = api_request(
            "POST",
            f"{endpoint_path}/{duplicate_endpoint_id}",
            {"action": "heartbeat", "peerId": f"peer-duplicate-2-{suffix}", "status": "waiting"},
            duplicate_token,
        )
        if status != 200 or str((body.get("endpoint") or {}).get("endpointId") or "") != assigned_ids[1]:
            raise RuntimeError(f"Virtual V2 endpoint heartbeat mapping failed: HTTP {status}")

        requested_node_id = f"edge-node-{suffix}"
        assigned_node_ids: list[str] = []
        for node_index in (1, 2):
            node_session_id = f"edge-session-{node_index}-{suffix}"
            session_assignments: list[str] = []
            for endpoint_kind, role, token in (
                ("edge", "robot-edge", role_tokens["robot_edge"]),
                ("video", "video-pusher", ""),
            ):
                endpoint_id = f"node-{node_index}-{endpoint_kind}-{suffix}"
                peer_id = f"peer-node-{node_index}-{endpoint_kind}-{suffix}"
                status, body = api_request(
                    "POST",
                    endpoint_path,
                    {
                        "endpointId": endpoint_id,
                        "peerId": peer_id,
                        "role": role,
                        "status": "waiting",
                        "nodeId": requested_node_id,
                        "nodeType": "edge-node",
                        "nodeSessionId": node_session_id,
                    },
                    token,
                )
                endpoint = body.get("endpoint") if isinstance(body, dict) else None
                assigned_node_id = str((endpoint or {}).get("nodeId") or "")
                if status != 200 or not assigned_node_id:
                    raise RuntimeError(f"Node V2 registration {node_index}/{endpoint_kind} failed: HTTP {status}")
                session_assignments.append(assigned_node_id)
                registrations.append((endpoint_id, peer_id, token))
            if len(set(session_assignments)) != 1:
                raise RuntimeError(f"Endpoints in one Node received different Node IDs: {session_assignments}")
            assigned_node_ids.append(session_assignments[0])

        if assigned_node_ids[0] != requested_node_id or assigned_node_ids[1] == requested_node_id:
            raise RuntimeError(f"Duplicate V2 Node was not assigned a virtual suffix: {assigned_node_ids}")
        if assigned_node_ids[0] == assigned_node_ids[1]:
            raise RuntimeError(f"Duplicate V2 Nodes received the same ID: {assigned_node_ids[0]}")

        status, body = api_request("GET", endpoint_path)
        nodes = body.get("nodes") if isinstance(body, dict) else None
        smoke_nodes = [
            node for node in nodes or []
            if isinstance(node, dict) and node.get("requestedNodeId") == requested_node_id
        ]
        if status != 200 or len(smoke_nodes) != 2 or any(node.get("endpointCount") != 2 for node in smoke_nodes):
            raise RuntimeError(f"V2 Node aggregation smoke test failed: HTTP {status}, nodes={smoke_nodes}")
        if any("nodeSessionId" in node for node in smoke_nodes):
            raise RuntimeError("V2 Node aggregation exposed an internal nodeSessionId")

        status, body = api_request("GET", "/api/v2/rooms")
        if status != 200 or not body.get("ok"):
            raise RuntimeError(f"V2 room discovery failed: HTTP {status}")
        status, body = api_request("GET", "/api/rooms")
        if status != 200 or not body.get("ok"):
            raise RuntimeError(f"V1 compatibility discovery failed: HTTP {status}")
    finally:
        for endpoint_id, peer_id, token in registrations:
            api_request(
                "POST",
                f"{endpoint_path}/{endpoint_id}",
                {"action": "offline", "peerId": peer_id},
                token,
            )


def main() -> None:
    for path in (P2P_SOURCE / "server.py", P2P_SOURCE / "server.js", SECRET_ENV):
        if not path.is_file():
            raise RuntimeError(f"Required deployment input not found: {path}")

    auth_environment, role_tokens = build_auth_environment()
    client = connect(read_saved_login())
    deployment_id = uuid.uuid4().hex[:12]
    remote_python = f"/tmp/telebot-p2p-v2-{deployment_id}-server.py"
    remote_node = f"/tmp/telebot-p2p-v2-{deployment_id}-server.js"
    remote_auth = f"/tmp/telebot-p2p-v2-{deployment_id}-auth.env"
    try:
        with client.open_sftp() as sftp:
            sftp.put(str(P2P_SOURCE / "server.py"), remote_python)
            sftp.put(str(P2P_SOURCE / "server.js"), remote_node)
            with sftp.file(remote_auth, "w") as handle:
                handle.write(auth_environment)
            sftp.chmod(remote_auth, 0o600)

        remote_run(
            client,
            (
                f"python3 -m py_compile {shlex.quote(remote_python)} && "
                f"if command -v node >/dev/null 2>&1; then node --check {shlex.quote(remote_node)}; fi"
            ),
            timeout=30,
        )
        timestamp = time.strftime("%Y%m%d%H%M%S")
        remote_run(
            client,
            f"""
set -euo pipefail
REMOTE_DIR={shlex.quote(REMOTE_DIR)}
SERVICE={shlex.quote(SERVICE)}
STAMP={shlex.quote(timestamp)}
active_guards=()
for svc in cloud-service-console-web.service go2rtc-cloud.service go2rtc-control-signaling.service \
  go2rtc-telemetry-relay.service cloud-service-console-tank-trouble.service nginx.service coturn.service; do
  if systemctl is-active --quiet "$svc"; then
    active_guards+=("$svc")
  fi
done
sudo cp -a "$REMOTE_DIR/server.py" "$REMOTE_DIR/server.py.bak-p2pv2-$STAMP"
sudo cp -a "$REMOTE_DIR/server.js" "$REMOTE_DIR/server.js.bak-p2pv2-$STAMP"
sudo install -m 0644 {shlex.quote(remote_python)} "$REMOTE_DIR/server.py"
sudo install -m 0644 {shlex.quote(remote_node)} "$REMOTE_DIR/server.js"
sudo install -m 0600 {shlex.quote(remote_auth)} "$REMOTE_DIR/p2p-v2-auth.env"
sudo mkdir -p /etc/systemd/system/webrtc-p2p-video.service.d
sudo tee /etc/systemd/system/webrtc-p2p-video.service.d/p2p-v2-auth.conf >/dev/null <<'UNIT'
[Service]
EnvironmentFile=/opt/webrtc-p2p-video/p2p-v2-auth.env
UNIT
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE"
for attempt in $(seq 1 20); do
  if systemctl is-active --quiet "$SERVICE" && curl -fsS http://127.0.0.1:8099/api/config >/dev/null && curl -fsS http://127.0.0.1:8099/clock >/dev/null; then
    break
  fi
  sleep 0.5
done
systemctl is-active --quiet "$SERVICE"
curl -fsS http://127.0.0.1:8099/api/v2/rooms >/dev/null
for svc in "${{active_guards[@]}}"; do
  systemctl is-active --quiet "$svc" || {{ echo "Guard service is no longer active: $svc" >&2; exit 9; }}
done
rm -f {shlex.quote(remote_python)} {shlex.quote(remote_node)} {shlex.quote(remote_auth)}
printf 'deployed_service='; systemctl is-active "$SERVICE"
printf 'guard_services='; printf '%s,' "${{active_guards[@]}}"; printf '\n'
""",
            timeout=90,
        )
        smoke_test(role_tokens)
        print("P2P V2 signaling deployment and compatibility smoke tests passed.")
    finally:
        try:
            remote_run(
                client,
                f"rm -f {shlex.quote(remote_python)} {shlex.quote(remote_node)} {shlex.quote(remote_auth)}",
                timeout=15,
            )
        except Exception as exc:  # noqa: BLE001 -- cleanup must not hide the deployment result
            print(f"Warning: failed to remove remote deployment files: {exc}")
        client.close()


if __name__ == "__main__":
    main()
