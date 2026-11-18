"""Server-side staged RoboCasa v0.2 completion; preserves existing catalog rows."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

COMMIT = "756598a5be52e052339bb2d957426e39015c2afb"
STAGE = Path("/opt/telebot-model-library/_imports/robocasa-v02-completion")
LIBRARY = Path("/opt/telebot-model-library")
CATALOG = LIBRARY/"catalog"
DESTINATION = CATALOG/".imports"/("robocasa-v02-"+COMMIT[:12]+"-completion")
ASSETS = DESTINATION/"source_assets"
NORMALIZED = DESTINATION/"normalized"


def digest(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024*1024), b""):
            result.update(block)
    return result.hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix+".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    os.replace(temp, path)


def fetch(url):
    error = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "RoboCasa-library-completion",
                "Accept": "application/json", "X-Requested-With": "XMLHttpRequest"})
            with urllib.request.urlopen(request, timeout=25) as response:
                return response.read()
        except Exception as exc:
            error = exc
            time.sleep(attempt+1)
    raise error


def prepare():
    archive = STAGE/"fixtures_legacy_mirror.zip"
    metadata = json.loads((STAGE/"legacy_archive_source.json").read_text())
    assert digest(archive) == metadata["sha256"]
    print("verified_resource_archive", flush=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            name = PurePosixPath(entry.filename)
            if name.is_absolute() or ".." in name.parts or "\\" in entry.filename or ":" in entry.filename:
                raise ValueError("Unsafe ZIP resource path")
            if entry.is_dir() or not entry.filename.startswith("fixtures/"):
                continue
            path = ASSETS/entry.filename
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                with z.open(entry) as source, path.open("wb") as out:
                    shutil.copyfileobj(source, out)
            elif path.stat().st_size != entry.file_size:
                raise ValueError("Staged source size differs: "+entry.filename)
    tree = json.loads(fetch("https://github.com/robocasa/robocasa/tree-list/"+COMMIT))["paths"]
    paths = [p for p in tree if (p.startswith("robocasa/models/assets/fixtures/") and p.endswith((".xml", ".yaml", ".yml")))
             or (p.startswith("robocasa/models/fixtures/") and p.endswith(".py")) or p == "LICENSE"]
    records = []

    def download(path):
        output = DESTINATION/"repository"/path
        if not output.is_file():
            data = fetch("https://raw.githubusercontent.com/robocasa/robocasa/"+COMMIT+"/"+path)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(data)
        else:
            data = output.read_bytes()
        if path.startswith("robocasa/models/assets/"):
            target = ASSETS/path.split("robocasa/models/assets/", 1)[1]
            target.parent.mkdir(parents=True, exist_ok=True)
            # Pin the definitions; keep the verified ZIP intact as resource provenance.
            target.write_bytes(data)
        return {"path": path, "sha256": hashlib.sha256(data).hexdigest()}

    with ThreadPoolExecutor(max_workers=4) as pool:
        for record in pool.map(download, paths):
            records.append(record)
    missing = json.loads((STAGE/"expected_missing.json").read_text())
    dependencies, failures = [], []
    for item in missing:
        path = ASSETS/"fixtures"/item["model"]/"model.xml"
        root = ET.parse(path).getroot()
        for node in root.findall("asset/*"):
            if node.get("file"):
                target = (path.parent/node.get("file")).resolve()
                record = {"model": item["model"], "type": node.tag,
                          "path": target.relative_to(ASSETS).as_posix(), "present": target.is_file()}
                dependencies.append(record)
                if not record["present"]:
                    failures.append(record)
    result = {"commit": COMMIT, "resource_archive": metadata, "repository_files": records,
              "dependencies": dependencies, "missing_dependencies": failures,
              "models": len(missing), "prepared_at": datetime.now(timezone.utc).isoformat()}
    save(STAGE/"prepared.json", result)
    print(json.dumps({"prepared_models": len(missing), "repository_files": len(records),
                      "dependency_references": len(dependencies), "missing": failures}), flush=True)
    if failures:
        raise SystemExit(1)


def convert():
    sys.path.insert(0, str(STAGE/"code"))
    import mujoco
    from asset_robocasa_fixtures import convert_fixture
    pending = json.loads((STAGE/"expected_missing.json").read_text())
    prepared = json.loads((STAGE/"prepared.json").read_text())
    assert not prepared["missing_dependencies"]
    license_text = (DESTINATION/"repository/LICENSE").read_text()
    entries, failures, checks = [], [], []
    for item in pending:
        model_name = item["model"]
        from asset_robocasa_import import asset_id
        directory = NORMALIZED/asset_id("fixtures", model_name)
        try:
            row = convert_fixture(ASSETS/"fixtures"/model_name/"model.xml", ASSETS, directory,
                                  CATALOG, model_name=model_name, commit=COMMIT,
                                  archive_source=prepared["resource_archive"], license_text=license_text)
            model = mujoco.MjModel.from_xml_path(str(directory/"source.xml"))
            expected = row["parameters"]["articulation"]["movable_joint_count"]
            assert model.njnt == expected and model.nu == 0
            assert model.ngeom > 0
            data = mujoco.MjData(model)
            mujoco.mj_forward(model, data)
            # Exercise every source scalar joint without claiming physics-task success.
            import numpy as np
            probes = 0
            for joint in range(model.njnt):
                low, high = model.jnt_range[joint] if model.jnt_limited[joint] else (-.5, .5)
                for value in (low, (low+high)/2, high):
                    data.qpos[model.jnt_qposadr[joint]] = value
                    mujoco.mj_forward(model, data)
                    assert np.isfinite(data.xpos).all() and np.isfinite(data.geom_xpos).all()
                    probes += 1
                data.qpos[model.jnt_qposadr[joint]] = model.qpos0[model.jnt_qposadr[joint]]
            checks.append({"id": row["id"], "geoms": model.ngeom, "joints": model.njnt,
                           "kinematic_probes": probes, "trigger_regions": sum(
                               r["interaction_kind"] == "contact_trigger" for r in row["parameters"]["contact_regions"])})
            entries.append(row)
            print(json.dumps({"model": model_name, "converted": True, "joints": model.njnt}), flush=True)
        except Exception as exc:
            failures.append({"model": model_name, "type": type(exc).__name__, "error": str(exc)})
            print(json.dumps(failures[-1]), flush=True)
    # Parameterized source pieces are delivered as templates, not misleading complete fixtures.
    template_rows = []
    for record in prepared["repository_files"]:
        path = record["path"]
        if not path.startswith("robocasa/models/assets/fixtures/") or path.endswith("/model.xml") or not path.endswith(".xml"):
            continue
        file = DESTINATION/"repository"/path
        root = ET.parse(file).getroot()
        template_rows.append({"schema": "asset-parameters/2", "kind": "component_template",
                              "path": file.relative_to(CATALOG).as_posix(), "sha256": record["sha256"],
                              "requires_fixture_composition": True,
                              "joint_names": [n.get("name") for n in root.findall(".//worldbody//joint")],
                              "sites": [n.get("name") for n in root.findall(".//site")],
                              "resource_references": [n.get("file") for n in root.findall("asset/*") if n.get("file")]})
    save(DESTINATION/"component_templates.json", template_rows)
    report = {"commit": COMMIT, "expected": len(pending), "converted": len(entries),
              "failures": failures, "checks": checks, "component_templates": len(template_rows),
              "articulated_models": sum(r["kind"] == "articulated" for r in entries),
              "trigger_models": sum(r["capabilities"]["contact_trigger_geometry"] for r in entries)}
    save(STAGE/"entries.json", entries)
    save(STAGE/"conversion.json", report)
    save(DESTINATION/"conversion.json", report)
    print(json.dumps({k:v for k,v in report.items() if k != "checks"}), flush=True)
    if failures:
        raise SystemExit(1)


def activate():
    report = json.loads((STAGE/"conversion.json").read_text())
    if report["failures"] or report["converted"] != report["expected"]:
        raise RuntimeError("Only the fully checked batch can be activated")
    entries = json.loads((STAGE/"entries.json").read_text())
    index = CATALOG/"index.json"
    before = index.read_bytes()
    previous = json.loads(before)
    by_id = {row["id"]: row for row in previous}
    new_ids = []
    for row in entries:
        if row["id"] in by_id:
            if by_id[row["id"]] != row:
                raise RuntimeError("Existing catalog entry differs: "+row["id"])
        else:
            new_ids.append(row["id"])
        by_id[row["id"]] = row
    inventory = []
    for file in sorted(DESTINATION.rglob("*")):
        if file.is_file():
            if file.is_symlink():
                raise ValueError("No source symlinks allowed")
            inventory.append((file.relative_to(CATALOG).as_posix(), file.stat().st_size, digest(file)))
    with sqlite3.connect(LIBRARY/"_transfer/files.sqlite") as db:
        db.executemany("INSERT OR REPLACE INTO files(path,size,sha) VALUES (?,?,?)", inventory)
    # One rollback snapshot for the active update, retained only until verification.
    rollback = STAGE/"rollback"
    rollback.mkdir(exist_ok=True)
    if not (rollback/"index.json").exists():
        (rollback/"index.json").write_bytes(before)
        with sqlite3.connect(LIBRARY/"library.sqlite") as source, sqlite3.connect(rollback/"library.sqlite") as dest:
            source.backup(dest)
    sys.path.insert(0, "/opt/cloud-service-console-web/backend")
    from model_library import ModelLibrary
    try:
        assert index.read_bytes() == before, "Catalog changed during preparation"
        save(index, list(by_id.values()))
        library = ModelLibrary(LIBRARY)
        built = library.build()
        views = []
        for row in entries:
            view = library.view(row["id"])
            assert view["parts"], row["id"]
            assert len(view.get("joints", [])) == row["parameters"]["articulation"]["movable_joint_count"], row["id"]
            assert not any(j.get("disabled_reason") for j in view.get("joints", [])), row["id"]
            views.append({"id": row["id"], "parts": len(view["parts"]), "joints": len(view.get("joints", []))})
            assert library.manifest(row["id"])["files"], row["id"]
        after = json.loads(index.read_text())
        after_by_id = {r["id"]: r for r in after}
        assert all(after_by_id[r["id"]] == r for r in previous)
        index_bytes = index.read_bytes()
        with sqlite3.connect(LIBRARY/"_transfer/files.sqlite") as db:
            db.execute("INSERT OR REPLACE INTO files(path,size,sha) VALUES (?,?,?)",
                       ("index.json", len(index_bytes), hashlib.sha256(index_bytes).hexdigest()))
        receipt = {"added": len(new_ids), "new_ids": new_ids, "preserved": len(previous), "total": len(after),
                   "files_added": len(inventory), "bytes_added": sum(r[1] for r in inventory), "views": views,
                   "build": built, "index_sha256": hashlib.sha256(index_bytes).hexdigest(),
                   "activated_at_utc": datetime.now(timezone.utc).isoformat()}
        save(STAGE/"receipt.json", receipt)
        print(json.dumps({k:v for k,v in receipt.items() if k not in ("new_ids", "views")}), flush=True)
    except Exception:
        temp = index.with_suffix(".rollback.tmp")
        temp.write_bytes(before)
        os.replace(temp, index)
        shutil.copy2(rollback/"library.sqlite", LIBRARY/"library.sqlite")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("prepare", "convert", "activate"))
    options = parser.parse_args()
    {"prepare": prepare, "convert": convert, "activate": activate}[options.phase]()
