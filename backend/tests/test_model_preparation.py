import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from model_preparation import preparation, preparation_file, preparation_status


def test_only_completed_source_matching_bundles_are_published(tmp_path):
    key = "a" * 64
    row = {"entry": {"descriptor_sha256": "source"}}
    library = SimpleNamespace(catalog=tmp_path, get=lambda _: row)
    root = tmp_path / ".prepared/partnet_1" / key
    root.mkdir(parents=True)
    payload = root / "asset.xml"
    payload.write_text("<mujoco/>")
    manifest = {"schema": "mujoco-prepared-asset/1", "id": "partnet_1", "status": "ready",
                "key": key, "descriptor_sha256": "source",
                "files": [{"path": "asset.xml", "size": payload.stat().st_size,
                           "sha": hashlib.sha256(payload.read_bytes()).hexdigest()}]}
    path = root / "manifest.json"
    path.write_text(json.dumps(manifest))
    assert preparation(library, "partnet_1") == manifest
    assert 'partnet_1' in preparation_status(library)['ready']
    assert preparation_file(library, "partnet_1", key, "asset.xml")[0] == payload
    with pytest.raises(FileNotFoundError):
        preparation_file(library, "partnet_1", key, "../../secret")
    with pytest.raises(ValueError):
        preparation_file(library, "partnet_1", "../working", "asset.xml")
    row["entry"]["descriptor_sha256"] = "different"
    library._preparation_status_snapshot = None
    assert preparation_status(library)['ready'] == {}
    with pytest.raises(FileNotFoundError):
        preparation(library, "partnet_1")
    with pytest.raises(ValueError):
        preparation_file(library, "partnet_1", key, "asset.xml")
    row["entry"]["descriptor_sha256"] = "source"
    path.rename(path.with_name("unpublished.json"))
    working = root.with_name(key + ".working")
    root.rename(working)
    (working / "unpublished.json").rename(working / "manifest.json")
    library._preparation_status_snapshot = None
    assert preparation_status(library)['ready'] == {}
    with pytest.raises(FileNotFoundError):
        preparation(library, "partnet_1")
