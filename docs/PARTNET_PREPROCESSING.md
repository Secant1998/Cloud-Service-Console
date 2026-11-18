# PartNet MuJoCo preprocessing

The Hong Kong library runs `partnet-preprocessing.service` independently of the
console web service. It processes the 2,347 PartNet catalog entries without an LLM.
The unit starts on boot, resumes recorded work, and restarts after process failures.

Server locations:

- `/opt/telebot-model-library/_preprocessing/venv`: isolated Python environment.
- `/opt/telebot-model-library/_preprocessing/code`: deployed converter code.
- `/opt/telebot-model-library/_preprocessing/state/status.json`: current queue item.
- `/opt/telebot-model-library/_preprocessing/state/partnet_*.json`: per-model results.
- `/opt/telebot-model-library/_preprocessing/state/partnet_*.log`: detailed failures.
- `/opt/telebot-model-library/catalog/.prepared/<id>/<key>`: completed resources.
- `/opt/telebot-model-library/catalog/.cache/native-preparation`: reusable mesh work.

The worker preserves source visual materials and joint topology, uses the indexed
MOPS midpoint, converts every supplied collision mesh, and compiles the resulting
portable MJCF. Existing converter limits remain active, including the 512 collision
part budget. A failed conversion is reported rather than removing geometry or
declaring a model usable. Closed-convex meshes and planar compatibility follow the
existing converter rules; CoACD remains an approximate collision representation.

One model runs at a time, with two OpenMP threads, CPUQuota=180%, MemoryMax=4G,
and Nice=15. Each model has a 30-minute budget and at most two attempts per recipe.
Individual mesh caches survive retries. Work pauses when free disk drops below
20 GiB. Environment failures repaired during initial setup were requeued explicitly.

Completed directories are published by atomic rename. The authenticated routes
`GET /api/model-library/preparation-status`,
`GET /api/model-library/<id>/preparation` and
`GET /api/model-library/<id>/preparation/file?key=<key>&path=<resource>`
serve only completed manifests and their listed resources. Raw catalog and browser
preview data are unchanged.

The simulator downloads prepared files on demand and checks their hashes. Matching
converter versions reuse neutral MJCF templates with unique instance names.
Inspection automatically registers these models as `preprocessed_asset_ready`;
the Scene Agent skips another model-processing decision. Missing, unfinished or
incompatible bundles follow the original preparation path. Task containment,
support/stability, IK, collision and trajectory checks still apply.

## Batch Readiness and Scene Selection

The deployed `preparation-status` route returns a metadata-only snapshot:

```json
{
  "schema": "partnet-preparation-status/1",
  "checked_at": 0,
  "ready": {
    "partnet_100439": [
      {
        "key": "<64-character bundle hash>",
        "descriptor_sha256": "<current source descriptor hash>",
        "recipe": "<bundle recipe>"
      }
    ]
  },
  "missing_status": "not_ready",
  "scope": "Published source-matching bundles only; not a task feasibility certificate."
}
```

Values above illustrate the schema, not a live inventory. `recipe` is returned
from the manifest unchanged. The API accepts only a published `ready` manifest
whose ID, directory key and source descriptor hash match the current library.
Working directories and mismatched records are omitted. The route must be
registered before `/{asset_id}` so that `preparation-status` is not parsed as a
model ID. Normal model-library authentication applies.

The server caches the snapshot for 30 seconds; the simulator caches it for
60 seconds. Missing IDs mean no eligible published bundle in this snapshot,
not a diagnosis of pending versus failed. Use the preprocessing queue/state files
for detailed progress. Do not document the number of ready entries as a permanent
catalog constant.

The current modern scene selector uses this snapshot to temporarily exclude
unfinished/failed PartNet models before randomly sampling up to eight eligible
matches per query. Direct inspection, submission and directed size replacement
also enforce availability. Browser browsing and source assets are unchanged.
The batch eligibility check does not require a matching local converter recipe;
actual bundle reuse still does. Changed task scale, task-specific collision scope
or recipe may require the existing local preparation path even for an eligible ID.
This policy does not certify a grasp, cavity fit or task trajectory.

Candidate three-angle images and optional 30-second local wrist/gripper trials
are simulator-side tools. They are separate from the console's browser thumbnail
cache and interactive Three.js preview, and do not add three images per model to
the server's thumbnail contract. Simulator documentation is maintained in
`code_1015/scene_generator/docs/ASSET_SELECTION.md`.

## Operations

From the console project:

```powershell
python scripts/deploy_partnet_preprocessing.py --status
```

On the server:

```sh
systemctl status partnet-preprocessing.service
journalctl -u partnet-preprocessing.service -n 30 --no-pager
sudo systemctl stop partnet-preprocessing.service
sudo systemctl start partnet-preprocessing.service
```

`--setup` redeploys converter files and dependencies; stop the worker before code
updates. `--deploy-api` installs only the preparation routes and helper module,
backing up the previous live model-library module. `--start` installs/enables the
persistent systemd unit.

An empty-cache end-to-end check downloaded `partnet_100439` and compiled it locally
while making collision decomposition and material conversion raise if called.
It passed: approximately 5.6 seconds for cold acquisition and 0.23 seconds for
direct import. Evidence:
`code_1015/reports/partnet-preprocessing-20261106/cloud-reuse.json`.

The readiness API and its source-matching/working-directory behavior are covered
by `backend/tests/test_model_preparation.py` and `test_model_library.py`.
`scripts/deploy_partnet_preprocessing.py --deploy-api` also installs the batch
route; a documentation update alone does not deploy or restart any service.
