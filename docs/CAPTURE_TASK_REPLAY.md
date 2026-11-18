# Cloud Capture Tasks and Piper Replay

## Scope

The web console groups cloud uploads by the exact pair of room_id and session_id.
The three source kinds are operator-video, operator-input, and edge-state.
Missing session IDs are never guessed or grouped by filename. Existing uploads
are indexed in place; no migration or modification of raw capture files occurs.

System Settings now displays one row per capture task. Expand a row to download
individual sources. Administrators can synthesize or delete a task. Authenticated
ordinary users can list and download, matching the pre-existing cloud file access.

## Storage

Cloud base: /opt/cloud-service-console-web/storage/captures

- YYYY-MM-DD/<upload-id>-<filename>: unchanged original uploaded file
- YYYY-MM-DD/<upload-id>.meta.json: unchanged upload metadata
- tasks/ct_<hash>/task.json: persistent job state and frozen source hashes
- tasks/ct_<hash>/replay.mp4: completed H.264 / yuv420p / faststart result
- tasks/ct_<hash>/report.json: clock alignment, state coverage, source hashes
- tasks/ct_<hash>/progress.json: atomically replaced progress snapshot
- tasks/ct_<hash>/render.log and ffmpeg.log: troubleshooting output
- tasks/.deleted/ct_<hash>.json: tiny deletion tombstone, no capture contents

Partial MP4 and temporary SQLite files are removed when a job exits. Deleting a
task removes all its original uploads, metadata, result, and render logs. The tiny
tombstone rejects late upload retries so a deleted capture does not reappear.
Deletion is rejected while a job is queued or running. No source backups are
made by the application; console deployment backups exclude capture storage.

## Job Rules

One worker runs at a time; at most 12 queued/running jobs. Duplicate clicks return
HTTP 409. A completed task cannot be synthesized again, even if its result was
manually removed. Incomplete sources and different source versions block jobs.
Identical upload retries are accepted without invalidating frozen source hashes.
On console restart, interrupted jobs become failed and may be retried manually.
Closing the browser does not stop a server-side composition job.

The worker runs in a separate, low-priority process. FFmpeg uses one encoding
thread. Arm state samples are streamed out of ZIP into a disk-backed SQLite
timeline instead of accumulating hours of data in memory. The worker renders
one overlay frame at a time and pipes it to FFmpeg. Jobs are currently limited
to six hours of input, five million state samples, 4 GiB total expanded ZIP data,
and a 24-hour processing timeout. Disk space is checked before and during work.
These limits are conservative guards, not a guarantee of real-time rendering.

## Piper Replay and Time

The renderer uses Three.js plus urdf-loader and the actual Piper URDF/STL model
from the Telebot2 repository. Six measured joint angles are converted from degrees
to radians. Gripper travel is in meters, never interpreted as a seventh angle.
Both left and right arms are shown if their recorded states are available.
The two models are displayed side by side; no physical dual-arm base calibration
is inferred. This is recorded-state kinematic replay, not a physics simulator.

State samples use sampled_at_server_ms. Consecutive measured joint values are
interpolated only across gaps of at most 100 ms. Disconnects are not interpolated.
A state more than 250 ms old disappears with a NO STATE label instead of being
presented as fresh. Fault and enabled flags are displayed, along with a clock
quality warning when applicable.

Newer manifests may supply video.recording_started_at_server_ms. Existing capture
files lack that exact recorder timestamp, so the first cloud-timestamped video
presentation marker is the best available alignment estimate. Source media_time
is NOT a recording-relative clock. Reports explicitly warn about the resulting
frame-level uncertainty; millisecond timestamp display is not millisecond accuracy.

Original camera pixels, keyboard visualization, and cloud timestamp are retained.
The input JSON validates the session and provides the timeline; key presses are
not invented or reconstructed if missing. The source keyboard overlay already
visualizes those inputs. Videos without the cloud timestamp overlay are rejected.

For the current 1980x1200 mosaic, the Piper region is x=1290, y=496, w=676, h=384,
above the keyboard and below the right camera. Proportional layouts are supported.
Unknown aspect ratios receive an appended bottom strip rather than covering a
camera. Source camera layout changes should update overlay_layout and its tests.
Output is 30 fps; this does not recover detail missing from a low-fps source.

## API

- GET /api/captures/tasks: list grouped tasks and progress
- POST /api/captures/tasks/{id}/synthesize: admin-only queue operation
- GET /api/captures/tasks/{id}/download: authenticated result download
- DELETE /api/captures/tasks/{id}: admin-only whole-task deletion
- POST /api/captures/downloads: authenticated short-lived file-scoped ticket
- GET /api/captures/downloads/{ticket}: streaming browser download, expires in 15 min

Machine upload tokens authorize uploads only. They cannot delete or synthesize.
Download tickets avoid buffering large videos in JavaScript and do not expose the
account session token. A renderer-only loopback HTTP server serves only packaged
assets, never captures. The headless browser blocks all non-local requests.

## Deployment and Verification

scripts/deploy_web_console.py builds the console, backs up the previous app files,
installs Python requirements, Chromium and its OS dependencies, then restarts only
cloud-service-console-web. FFmpeg and ffprobe must be installed. Browser binaries
are cached for the service account. Local testing can set CLOUD_CONSOLE_CHROMIUM_PATH
to an installed Chrome executable.

Focused tests: python -m pytest backend/tests -q

scripts/verify_capture_replay.py validates model loading and movement at desktop
and narrow viewports, then composes a local fixture. scripts/verify_capture_ui.py
uses mocked APIs to exercise light/dark/mobile layout, queue and delete behavior.
Local QA files live under build/capture-qa and are not deployment artifacts.

The feature does not change Telebot2, Edge, Compute, the P2P signaling protocol,
or the topology visualization. Long-duration performance remains to be measured
with representative captures on the small cloud host.
