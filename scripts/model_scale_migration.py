"""Apply validated MOPS metadata to the index and SQLite catalog together."""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import sqlite3
import sys


def _resource_digest(db):
    digest = hashlib.sha256()
    for row in db.execute("SELECT path,size,sha FROM files WHERE path != 'index.json' ORDER BY path"):
        digest.update(json.dumps(row, ensure_ascii=False).encode("utf-8"))
    return digest.hexdigest()


def _thumbnail_links(root, backend, policies):
    sys.path.insert(0, str(backend))
    from model_library import ModelLibrary
    from model_thumbnails import ThumbnailCache

    class UpdatedLibrary(ModelLibrary):
        def get(self, asset_id):
            result = super().get(asset_id)
            result["entry"].setdefault("parameters", {})["physical_scale"] = policies[asset_id]
            return result

    original = ThumbnailCache(ModelLibrary(root))
    updated = ThumbnailCache(UpdatedLibrary(root))
    links = []
    for asset_id in policies:
        try:
            old = original.target(asset_id)
            if old.is_file():
                new = updated.target(asset_id)
                if old != new and not new.exists():
                    links.append((old, new))
        except FileNotFoundError:
            continue
    return links


def migrate(root, payload, *, apply=False, backend=None):
    root = Path(root).resolve()
    index = root / "catalog/index.json"
    database = root / "library.sqlite"
    transfer = root / "_transfer/files.sqlite"
    original_bytes = index.read_bytes()
    entries = json.loads(original_bytes)
    original = {row["id"]: row for row in entries}
    if len(original) != len(entries) or payload.get("schema") != "mops-catalog-patch/1":
        raise ValueError("Invalid catalog or patch schema")
    patches = {row["id"]: row for row in payload["patches"]}
    expected = {key for key in original if key.startswith("partnet_")}
    if len(patches) != len(payload["patches"]) or set(patches) != expected:
        raise ValueError("Patch must cover every PartNet model exactly once")
    updated = deepcopy(entries)
    changed, policies = {}, {}
    for row in updated:
        patch = patches.get(row["id"])
        if patch is None:
            continue
        for field in ("revision", "descriptor_sha256"):
            if row.get(field) != patch.get(field):
                raise ValueError("Source identity changed: " + row["id"])
        if row["parameters"]["geometry"]["dimensions_m"] != patch["source_dimensions_m"]:
            raise ValueError("Source bounds changed: " + row["id"])
        policy = patch["physical_scale"]
        bounds = policy["scale_range"]
        if (policy.get("schema") != "mops-partnet-scale/1"
                or policy.get("model_id") != int(row["id"].split("_")[1])
                or len(bounds) != 2
                or any(isinstance(v, bool) or not isinstance(v, (int, float))
                       or not math.isfinite(v) or v <= 0 for v in bounds)
                or bounds[0] > bounds[1] or policy.get("selection") != "midpoint"
                or policy.get("size_editable") is not False
                or not math.isclose(policy["default_scale"], sum(bounds) / 2, rel_tol=1e-12)):
            raise ValueError("Invalid MOPS policy: " + row["id"])
        row["parameters"]["physical_scale"] = deepcopy(policy)
        policies[row["id"]] = policy
        if row != original[row["id"]]:
            changed[row["id"]] = row
    with sqlite3.connect(database) as db:
        stored = {key: json.loads(value) for key, value in db.execute("SELECT id,entry FROM models")}
        if stored != original:
            raise ValueError("Database entries and source index differ; reconcile before migration")
        file_count = db.execute("SELECT COUNT(*) FROM files").fetchone()[0]
        resource_digest = _resource_digest(db)
    result = {
        "applied": False, "models": len(entries), "partnet_models": len(patches),
        "changed_models": len(changed), "resource_records": file_count,
        "source_resources_digest": resource_digest, "non_partnet_unchanged": True,
        "source_geometry_unchanged": True, "upstream_commit": payload["upstream_commit"],
    }
    if not apply or not changed:
        result["applied"] = apply
        return result
    links = _thumbnail_links(root, Path(backend), policies) if backend else []
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = root / "_metadata_backups" / ("mops-" + stamp)
    backup.mkdir(parents=True)
    new_index = index.with_name("index.mops-new.json")
    new_bytes = (json.dumps(updated, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    replaced = False
    with sqlite3.connect(database, timeout=60) as db:
        if transfer.is_file():
            db.execute("ATTACH DATABASE ? AS transfer_state", (str(transfer),))
        db.execute("BEGIN IMMEDIATE")
        try:
            if index.read_bytes() != original_bytes:
                raise RuntimeError("Index changed during migration")
            current = {key: json.loads(value) for key, value in db.execute("SELECT id,entry FROM models")}
            if current != original:
                raise RuntimeError("Database changed during migration")
            shutil.copy2(index, backup / "index.json")
            for source in (database, transfer):
                if source.is_file():
                    with sqlite3.connect(source) as source_db, sqlite3.connect(backup / source.name) as backup_db:
                        source_db.backup(backup_db)
            db.executemany("UPDATE models SET entry=? WHERE id=?",
                           [(json.dumps(row, ensure_ascii=False), key) for key, row in changed.items()])
            file_metadata = (len(new_bytes), hashlib.sha256(new_bytes).hexdigest(), "index.json")
            db.execute("UPDATE files SET size=?,sha=? WHERE path=?", file_metadata)
            if transfer.is_file():
                db.execute("UPDATE transfer_state.files SET size=?,sha=? WHERE path=?", file_metadata)
            for old, new in links:
                if not new.exists():
                    os.link(old, new)
            new_index.write_bytes(new_bytes)
            os.replace(new_index, index)
            replaced = True
            if _resource_digest(db) != resource_digest:
                raise RuntimeError("Unrelated resource metadata changed")
            db.commit()
        except BaseException:
            db.rollback()
            if replaced:
                shutil.copy2(backup / "index.json", new_index)
                os.replace(new_index, index)
            raise
    with sqlite3.connect(database) as db:
        actual = {key: json.loads(value) for key, value in db.execute("SELECT id,entry FROM models")}
        if actual != {row["id"]: row for row in updated}:
            raise RuntimeError("Post-migration verification failed; backup: " + str(backup))
        assert db.execute("SELECT COUNT(*) FROM files").fetchone()[0] == file_count
    result.update(applied=True, backup=str(backup), reused_thumbnails=len(links),
                  index_sha256=hashlib.sha256(index.read_bytes()).hexdigest())
    (backup / "migration.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--patches", type=Path, required=True)
    parser.add_argument("--backend", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    payload = json.loads(args.patches.read_text(encoding="utf-8"))
    print(json.dumps(migrate(args.root, payload, apply=args.apply, backend=args.backend)))


if __name__ == "__main__":
    main()
