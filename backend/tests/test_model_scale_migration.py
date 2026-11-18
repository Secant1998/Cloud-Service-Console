import hashlib
import json
from pathlib import Path
import sqlite3
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from model_scale_migration import migrate


@pytest.fixture
def scale_catalog(tmp_path):
    entries = [
        {"id": "partnet_7", "revision": "rev", "descriptor_sha256": "descriptor",
         "parameters": {"geometry": {"dimensions_m": [1, 2, 1]}}},
        {"id": "gso_unchanged", "label": "Cup"},
    ]
    catalog = tmp_path / "catalog"
    catalog.mkdir()
    index = catalog / "index.json"
    index.write_text(json.dumps(entries), encoding="utf-8")
    files = [("index.json", index.stat().st_size, hashlib.sha256(index.read_bytes()).hexdigest()),
             ("partnet/model.obj", 10, "mesh-sha")]
    (tmp_path / "_transfer").mkdir()
    with sqlite3.connect(tmp_path / "_transfer/files.sqlite") as db:
        db.execute("CREATE TABLE files(path TEXT PRIMARY KEY,size INTEGER,sha TEXT)")
        db.executemany("INSERT INTO files VALUES (?,?,?)", files)
    with sqlite3.connect(tmp_path / "library.sqlite") as db:
        db.execute("CREATE TABLE models(id TEXT PRIMARY KEY,entry TEXT)")
        db.executemany("INSERT INTO models VALUES (?,?)", [(row["id"], json.dumps(row)) for row in entries])
        db.execute("CREATE TABLE files(path TEXT PRIMARY KEY,size INTEGER,sha TEXT)")
        db.executemany("INSERT INTO files VALUES (?,?,?)", files)
        db.execute("CREATE TABLE classifications(id TEXT PRIMARY KEY,detail TEXT)")
        db.execute("INSERT INTO classifications VALUES ('partnet_7','keep classification')")
    payload = {"schema": "mops-catalog-patch/1", "upstream_commit": "test",
               "patches": [{"id": "partnet_7", "revision": "rev", "descriptor_sha256": "descriptor",
                            "source_dimensions_m": [1, 2, 1], "physical_scale": {
                                "schema": "mops-partnet-scale/1", "model_id": 7,
                                "scale_range": [.4, .6], "default_scale": .5,
                                "selection": "midpoint", "size_editable": False}}]}
    return tmp_path, payload, entries


def test_migration_updates_catalog_and_database_once_and_preserves_resources(scale_catalog):
    root, payload, original = scale_catalog
    before = (root / "catalog/index.json").read_bytes()
    assert migrate(root, payload)["changed_models"] == 1
    assert (root / "catalog/index.json").read_bytes() == before
    result = migrate(root, payload, apply=True)
    assert result["applied"] and result["changed_models"] == 1
    assert (Path(result["backup"]) / "index.json").read_bytes() == before
    updated = json.loads((root / "catalog/index.json").read_text())
    assert updated[1] == original[1]
    assert updated[0]["parameters"]["geometry"] == original[0]["parameters"]["geometry"]
    with sqlite3.connect(root / "library.sqlite") as db:
        assert json.loads(db.execute("SELECT entry FROM models WHERE id='partnet_7'").fetchone()[0]) == updated[0]
        assert db.execute("SELECT detail FROM classifications").fetchone()[0] == "keep classification"
        assert db.execute("SELECT sha FROM files WHERE path='partnet/model.obj'").fetchone()[0] == "mesh-sha"
        expected_sha = hashlib.sha256((root / "catalog/index.json").read_bytes()).hexdigest()
        assert db.execute("SELECT sha FROM files WHERE path='index.json'").fetchone()[0] == expected_sha
    with sqlite3.connect(root / "_transfer/files.sqlite") as db:
        assert db.execute("SELECT sha FROM files WHERE path='index.json'").fetchone()[0] == expected_sha
    assert migrate(root, payload, apply=True)["changed_models"] == 0


def test_partial_patch_and_source_mismatch_are_rejected_without_writes(scale_catalog):
    root, payload, _ = scale_catalog
    before = (root / "catalog/index.json").read_bytes()
    with pytest.raises(ValueError, match="every PartNet"):
        migrate(root, {**payload, "patches": []}, apply=True)
    payload["patches"][0]["descriptor_sha256"] = "changed"
    with pytest.raises(ValueError, match="identity"):
        migrate(root, payload, apply=True)
    assert (root / "catalog/index.json").read_bytes() == before


def test_database_index_drift_is_rejected(scale_catalog):
    root, payload, _ = scale_catalog
    with sqlite3.connect(root / "library.sqlite") as db:
        db.execute("UPDATE models SET entry='{}' WHERE id='partnet_7'")
    with pytest.raises(ValueError, match="entries and source index differ"):
        migrate(root, payload, apply=True)
