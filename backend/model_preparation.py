"""Read-only access to completed, immutable MuJoCo preprocessing bundles."""
import json
from pathlib import Path
import re
import time


def preparation_status(library):
    """A short-lived snapshot of published bundles, without source downloads."""
    cached = getattr(library, '_preparation_status_snapshot', None)
    if cached and time.monotonic() - cached[0] < 30:
        return cached[1]
    ready = {}
    for path in (library.catalog / '.prepared').glob('partnet_*/*/manifest.json'):
        if not re.fullmatch(r'[0-9a-f]{64}', path.parent.name):
            continue
        asset_id = path.parent.parent.name
        if not re.fullmatch(r'partnet_[0-9]+', asset_id):
            continue
        try:
            manifest = json.loads(path.read_text(encoding='utf-8'))
            entry = library.get(asset_id)['entry']
        except (OSError, ValueError, KeyError):
            continue
        if (manifest.get('schema') == 'mujoco-prepared-asset/1'
                and manifest.get('status') == 'ready' and manifest.get('id') == asset_id
                and manifest.get('key') == path.parent.name
                and manifest.get('descriptor_sha256') == entry.get('descriptor_sha256')):
            ready.setdefault(asset_id, []).append({key: manifest.get(key) for key in
                ('key', 'descriptor_sha256', 'recipe')})
    result = {'schema': 'partnet-preparation-status/1', 'checked_at': time.time(),
              'ready': ready, 'missing_status': 'not_ready',
              'scope': 'Published source-matching bundles only; not a task feasibility certificate.'}
    library._preparation_status_snapshot = (time.monotonic(), result)
    return result


def preparation(library, asset_id):
    model = library.get(asset_id)
    if not re.fullmatch(r"partnet_[0-9]+", asset_id):
        raise FileNotFoundError("No PartNet preprocessing bundle")
    directory = library.catalog / ".prepared" / asset_id
    matches = []
    for path in directory.glob("*/manifest.json"):
        if not re.fullmatch(r"[0-9a-f]{64}", path.parent.name):
            continue
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if (manifest.get("schema") == "mujoco-prepared-asset/1"
                and manifest.get("status") == "ready" and manifest.get("id") == asset_id
                and manifest.get("key") == path.parent.name
                and manifest.get("descriptor_sha256") == model["entry"].get("descriptor_sha256")):
            matches.append((path.stat().st_mtime, manifest))
    if not matches:
        raise FileNotFoundError("This model has no completed preprocessing bundle yet")
    return max(matches, key=lambda item: item[0])[1]


def preparation_file(library, asset_id, key, relative):
    # Select the immutable requested generation, never a stale or working directory.
    if not re.fullmatch(r"partnet_[0-9]+", asset_id) or not re.fullmatch(r"[0-9a-f]{64}", key):
        raise ValueError("Invalid prepared asset identifier")
    model = library.get(asset_id)
    directory = (library.catalog / ".prepared" / asset_id / key).resolve()
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    if (manifest.get("status") != "ready" or manifest.get("id") != asset_id or manifest.get("key") != key
            or manifest.get("descriptor_sha256") != model["entry"].get("descriptor_sha256")):
        raise ValueError("Prepared asset source differs from catalog")
    record = next((item for item in manifest["files"] if item["path"] == relative), None)
    if record is None:
        raise FileNotFoundError("Resource is not in this prepared bundle")
    path = (directory / relative).resolve()
    if not path.is_relative_to(directory) or not path.is_file() or path.stat().st_size != record["size"]:
        raise FileNotFoundError("Invalid prepared resource")
    return path, record
