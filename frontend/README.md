# Cloud Service Console Frontend README

## Latest: Tank Trouble One-Click Cloud Bundle Sync

Version: `0.3.50`

The Tank Trouble `一键配置` button is now the standard way to sync any logged-in cloud server to the desktop app's bundled Tank Trouble game version.

What changed:

- The app computes a local bundle hash from `backend/cloud_setup_bundle/tank_trouble_room.py` and Tank Trouble-only cloud assets under `backend/cloud_setup_bundle/www/tank-trouble/`.
- The cloud setup flow writes and checks `/home/<sshUser>/.cloud-service-console/tank-trouble/bundle-manifest.json`.
- If the remote manifest is missing, the hash is different, the game assets are missing, or the game service/proxy health check fails, the app uploads the current Tank Trouble script/assets and restarts only `cloud-service-console-tank-trouble`.
- If the remote server is already current and healthy, the button reports `服务器已同步到当前版本` without unnecessary re-upload/restart work.

Where to change this next:

- Bundle hash and upload logic: `backend/tank_trouble_cloud.py`, `_local_bundle_manifest(...)`, `_upload_static_assets(...)`, `check_setup_ready(...)`, and `setup_server(...)`.
- Button behavior: `frontend/src/components/TankTroublePanel.tsx`, `configureTankTroubleServer(...)`.
- Local cloud API endpoint: `backend/main.py`, `ensure_tank_trouble_setup(...)`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud setup for this button only uploads/restarts Tank Trouble game service content.

## Latest: Tank Trouble Smoother Laser Rendering

Version: `0.3.36`

This update only changes Tank Trouble laser beam rendering in the desktop canvas and embedded monitor/spectator page.

What changed:

- Laser beams now draw through `strokeLaserPath(...)`, which builds one continuous path across reflection segments.
- Tiny visual gaps from reflection clearance are bridged during rendering, so the beam looks less broken.
- The laser glow, core beam, and white highlight are slightly thinner.
- This is visual-only: hit detection, speed, lifetime, reflection physics, and weapon rules are unchanged.

Where to change this next:

- Desktop laser rendering: `frontend/src/components/TankTroublePanel.tsx`, `strokeLaserPath` and `drawLaserProjectile`.
- Embedded monitor/spectator laser rendering: the `<script>` block in `backend/cloud_setup_bundle/tank_trouble_room.py`, `strokeLaserPath` and `drawLaserProjectile`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Powerup PNG Icons

Version: `0.3.35`

This update only changes Tank Trouble powerup icon assets/rendering, the cloud Tank Trouble static asset path, documentation, and version metadata.

What changed:

- Powerup icons now use the provided PNG files instead of the previous canvas-drawn symbols.
- The five bundled icons are mapped as: `cash.png`, `shotgun.png`, `laser.png`, `minigun.png`, and `shield.png`.
- Desktop Tank Trouble loads them from `frontend/public/tank-trouble/powerups`.
- The embedded monitor/spectator page loads the same icons from `/assets/tank-trouble/powerups/...`.
- Icons are drawn aspect-preserved and centered with `drawImage(image, -width / 2, -height / 2, width, height)`.
- Existing canvas-drawn icons remain as fallback while PNG images are still loading.

Where to change this next:

- Desktop icon mapping and centering: `frontend/src/components/TankTroublePanel.tsx`, `POWERUP_ICON_SOURCES`, `getPowerupIcon`, and `drawPowerupPngIcon`.
- Desktop icon files: `frontend/public/tank-trouble/powerups/*.png`.
- Cloud monitor/spectator icon mapping and static serving: `backend/cloud_setup_bundle/tank_trouble_room.py`, `POWERUP_ICON_SOURCES`, `drawPowerupPngIcon`, and the `/assets/` handler.
- Cloud icon files: `backend/cloud_setup_bundle/www/tank-trouble/powerups/*.png`.
- Cloud deployment upload path: `backend/tank_trouble_cloud.py`, `_upload_static_assets`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Laser Arena Boundary Guard

Version: `0.3.34`

This update only changes Tank Trouble laser pathing/rendering, the cloud room authority, the embedded cloud monitor/spectator page, documentation, and version metadata.

What changed:

- Laser path prediction now has an explicit arena-rectangle boundary hit in addition to wall rectangles and shields.
- Laser aim lines and generated laser paths reflect from the playable map edge even if an outer wall rectangle is missed by a numerical edge case.
- Desktop laser aim/projectile rendering and embedded monitor/spectator laser rendering are clipped to the arena rectangle.
- This prevents laser beam glow, tail segments, or aim dots from appearing outside the playable map.

Where to change this next:

- Desktop laser boundary pathing/rendering: `frontend/src/components/TankTroublePanel.tsx`, `rayArenaBoundsHit`, `buildReflectedRaySegments`, `drawLaserAimSegments`, and `drawLaserProjectile`.
- Cloud-authoritative laser pathing: `backend/cloud_setup_bundle/tank_trouble_room.py`, `ray_arena_bounds_hit` and `build_reflected_ray_segments`.
- Embedded monitor/spectator mirror logic: the `<script>` block in `backend/cloud_setup_bundle/tank_trouble_room.py`, especially `rayArenaBoundsHit`, `buildReflectedRaySegments`, `drawLaserAimSegments`, and `drawLaserProjectile`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Shield-Aware Laser Aim Prediction

Version: `0.3.33`

This update only changes Tank Trouble laser aim/path prediction, the cloud room authority, the embedded cloud monitor/spectator page, documentation, and version metadata.

What changed:

- Laser aim preview lines now treat visible shields as circular reflection surfaces.
- Desktop online prediction, cloud-authoritative laser path generation, and the embedded monitor/spectator page now share the same shield-aware path behavior.
- A ray that starts inside a shield temporarily ignores that shield until it exits, so a shielded shooter does not immediately reflect off their own shield.
- Once the ray is outside a shield, later shield hits can bend the aim line and generated laser path.

Where to change this next:

- Desktop laser aim and predicted local laser path: `frontend/src/components/TankTroublePanel.tsx`, `buildReflectedRaySegments`, `drawOnlineLaserAims`, and `firePredictedLocalBullet`.
- Cloud-authoritative laser path: `backend/cloud_setup_bundle/tank_trouble_room.py`, `build_reflected_ray_segments` and `spawn_laser_bullet`.
- Embedded monitor/spectator page mirror logic: the `<script>` block in `backend/cloud_setup_bundle/tank_trouble_room.py`, especially `activeShieldColliders`, `buildReflectedRaySegments`, and `drawLaserAims`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Shield Invulnerability Fallback

Version: `0.3.32`

This update only changes Tank Trouble shield damage rules, desktop local/latency hit guards, cloud room authority, documentation, and version metadata.

What changed:

- A tank is now invulnerable while its shield is visible.
- The cloud room authority skips damage resolution for any player whose `shield_visible_until_ms` is still in the future.
- This applies to every weapon, including default bullets, shotgun pellets, minigun bullets, and laser.
- The invulnerability covers both the active shield phase and the flicker/fade visible phase.
- Desktop local training and latency-test hit guards mirror the same behavior with `tankHasVisibleShield(...)`.
- This is an intentional fallback while laser reflection edge cases are still being investigated. Even if a laser path starts or reflects inside the shield, the shielded tank should not be destroyed.

Where to change this next:

- Cloud-authoritative damage guard: `backend/cloud_setup_bundle/tank_trouble_room.py`, `player_has_visible_shield(...)` and the candidate hit loop in `simulate_match`.
- Desktop local/latency hit guards: `frontend/src/components/TankTroublePanel.tsx`, `tankHasVisibleShield(...)` and the hit checks around `destroyPlayer`, bot damage, and latency clone damage.
- Laser reflection investigation remains in `build_reflected_ray_segments` / `buildReflectedRaySegments`; this update does not remove that work, it only adds a gameplay-safe shield fallback.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Self-Hit And Shielded Laser Reflection

Version: `0.3.31`

This update only changes Tank Trouble projectile/shield rules, desktop prediction/rendering, the cloud-authoritative room service, the embedded spectator page, and shared protocol/version metadata.

What changed:

- Default bullets, shotgun pellets, and minigun bullets now carry `has_bounced`.
- A firing tank cannot be hit by its own non-laser projectile until that projectile has bounced from a wall or shield.
- Once a non-laser projectile has bounced, it can self-hit again. This restores the intended ricochet self-damage rule without allowing immediate muzzle self-hits.
- Laser self-hit behavior is unchanged: laser still has no self-hit protection.
- Laser path generation now includes laser radius when testing shield collisions, so a beam that visually touches a shield is treated as hitting the shield.
- Shield hits use a tiny shield clearance instead of wall clearance, so the reflected laser starts from the shield edge rather than appearing to pass through or skip over it.
- Desktop Tank Trouble, cloud room authority, and the embedded cloud monitor/spectator page all use the same shield-aware laser path rule.

Where to change this next:

- Desktop Tank Trouble projectile prediction and laser pathing: `frontend/src/components/TankTroublePanel.tsx`, `buildReflectedRaySegments`, `advanceOnlineBullet`, and the self-hit checks that read `hasBounced`.
- Cloud-authoritative projectile and hit logic: `backend/cloud_setup_bundle/tank_trouble_room.py`, `spawn_match_bullet`, `reflect_bullet_from_shields`, `build_reflected_ray_segments`, `_serialize_match_bullets`, and the candidate hit loop in `simulate_match`.
- Embedded spectator page mirror logic: the `<script>` block in `backend/cloud_setup_bundle/tank_trouble_room.py`, especially `buildReflectedRaySegments` and local bullet interpolation.
- Shared protocol typing: `frontend/src/types/cloud.ts` and `backend/models.py`, field `has_bounced`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Laser Wall Clearance And Hit Removal

Version: `0.3.27`

This update only changes Tank Trouble laser path/render synchronization, cloud-authoritative kill metadata, and documentation/version metadata.

What changed:

- Laser beams now keep a small clearance from wall collision surfaces, so the thick visual beam no longer appears to drill into wall interiors.
- The wall-clearance behavior is mirrored across the desktop renderer, the cloud room authority, and the embedded spectator/monitor page.
- Cloud death events now carry `bullet_id`.
- When a laser kills a tank, the desktop game and spectator page remove that exact laser immediately instead of showing the normal short fade.
- Natural laser expiry still uses the existing fade; only confirmed kill removal is instant.

Where to change this next:

- Desktop laser reflection/rendering: `frontend/src/components/TankTroublePanel.tsx`, `LASER_WALL_CLEARANCE`, `buildReflectedRaySegments`, and `removeLaserHitBullet`.
- Cloud-authoritative laser path and kill event metadata: `backend/cloud_setup_bundle/tank_trouble_room.py`, `LASER_WALL_CLEARANCE`, `build_reflected_ray_segments`, `push_death_event`, and `serialize_death_events`.
- Embedded spectator page mirror logic: the `<script>` block in `backend/cloud_setup_bundle/tank_trouble_room.py`, especially `buildReflectedRaySegments` and `removeLaserHitBullet`.
- Shared API/schema typing: `frontend/src/types/cloud.ts` and `backend/models.py`, field `bullet_id`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Laser Self-Hit Rule

Version: `0.3.26`

This update only changes Tank Trouble cloud-authoritative hit rules and documentation/version metadata.

What changed:

- Laser beams now bypass self-hit protection and can kill the firing tank immediately.
- Default bullets, shotgun pellets, and minigun bullets still use `SELF_HIT_ARM_DELAY` for self-hit protection.
- Hitting other players remains immediate for every weapon.

Where to change this next:

- Cloud-authoritative hit logic: `backend/cloud_setup_bundle/tank_trouble_room.py`.
- Laser self-hit rule: the candidate loop in `simulate_match`, where `projectile_type != "laser"` gates `SELF_HIT_ARM_DELAY`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Unified Weapon Hit Detection

Version: `0.3.25`

This update only changes Tank Trouble cloud-authoritative hit detection and documentation/version metadata.

What changed:

- Laser beams now kill tanks reliably when the visible beam intersects a live tank.
- The self-hit arming delay only protects the firing tank itself; other tanks can be hit immediately by any weapon.
- Default bullets, shotgun pellets, and minigun bullets now use swept segment-vs-tank collision from previous tick position to current tick position.
- Laser hit detection checks both the previous and current visible beam windows so the faster, shorter beam cannot skip over tanks between server ticks.
- The intended rule is now consistent: every weapon kills when its projectile/beam intersects a live tank, with only self-hit delayed by `SELF_HIT_ARM_DELAY`.

Where to change this next:

- Cloud-authoritative hit logic: `backend/cloud_setup_bundle/tank_trouble_room.py`.
- Shared hit helpers: `segment_circle_hit_test` and `bullet_hit_test`.
- Self-hit arming policy: the candidate loop in `simulate_match`, near the `SELF_HIT_ARM_DELAY` check.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Powerup Labels And Weapon Timing Polish

Version: `0.3.24`

This update only changes Tank Trouble gameplay/rendering, the embedded cloud monitor page, and the Tank Trouble cloud room/spectator service.

What changed:

- Every current multiplayer powerup now shows pickup text: `+100`, `SHOTGUN`, `LASER`, or `MINIGUN`.
- Minigun bullets are spawned across the weapon barrel width in both desktop local prediction and cloud-authoritative online play.
- Minigun spin-up is now `0.5s`; release grace remains `1.0s`.
- Laser beam length is now `2` grid cells.
- Laser beam speed is now `40` grid cells per second.
- Laser beam lifetime is now `0.375s`.
- The cloud monitor/spectator page uses the same powerup pickup labels and laser beam length.

Where to change this next:

- Desktop Tank Trouble constants/rendering: `frontend/src/components/TankTroublePanel.tsx`.
- Cloud room authority and embedded monitor page: `backend/cloud_setup_bundle/tank_trouble_room.py`.
- Minigun barrel spread: `MINIGUN_BARREL_WIDTH`, `MINIGUN_BARREL_OFFSET_PATTERN`, `minigunLateralOffset`, and `minigun_lateral_offset`.
- Laser timing/size: `LASER_SPEED`, `LASER_LIFE`, and `LASER_LENGTH`.
- Powerup pickup text: `getPowerupPickupLabel` in both desktop and embedded monitor code.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Authoritative Laser Path And Minigun Powerup

Version: `0.3.23`

This update only changes Tank Trouble gameplay/rendering, preview/monitor state, and the Tank Trouble cloud room/spectator service.

What changed:

- Laser projectiles now use a stored reflected path captured at fire time.
- The visible laser is a 4-grid-cell segment that advances along that path for `0.75s` at `20` grid cells per second.
- Tank Trouble bullet state now includes `path_segments` and `distance_travelled` so desktop online play, latency preview, and cloud monitor pages can render the same laser path.
- Wall-corner ray hits now preserve both X/Y normals when needed, which prevents odd laser folds near corners.
- Added the fourth multiplayer powerup: `minigun`.
- Minigun pickup grants `20` rounds and changes the tank barrel to the minigun visual.
- Minigun fire is held-fire based: `1.0s` spin-up, `1.0s` release grace, `10` rounds per second, `2.2` grid-cell-per-second bullets, `3.0s` bullet lifetime, half-size bullets.
- Minigun bullets do not count toward the normal 5-bullet cap.
- Desktop online mode predicts minigun bullets locally for feel, while the cloud room service remains authoritative and broadcasts the resulting bullets to other players/monitor pages.
- During this testing stage, every map starts with one powerup of each available kind: `cash`, `shotgun`, `laser`, and `minigun`.
- During this testing stage, a picked-up powerup respawns at its original position after `2s`.

Where to change this next:

- Desktop Tank Trouble rules/visuals: `frontend/src/components/TankTroublePanel.tsx`.
- Shared Tank Trouble TypeScript protocol: `frontend/src/types/cloud.ts`.
- Shared Python API models: `backend/models.py`.
- Latency preview runtime/page: `backend/tank_trouble_preview_runtime.py` and `backend/tank_trouble_preview_page.py`.
- Cloud room authority and monitor page: `backend/cloud_setup_bundle/tank_trouble_room.py`.
- Laser path helpers: `buildReflectedRaySegments`, `slicePathSegments`, `drawLaserProjectile`, `spawn_laser_bullet`, `slice_path_segments`.
- Minigun helpers/rules: `drawMinigunPowerupIcon`, `drawSharedTankSprite`, `firePredictedMinigunBullet`, `spawn_minigun_bullet`, and the minigun branch in `simulate_match`.
- Testing-stage powerup set rule: `ensure_test_powerup_set` and `advance_powerups`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Shotgun Speed And Laser Refraction Polish

Version: `0.3.22`

This update only changes Tank Trouble gameplay/rendering and the Tank Trouble cloud room/spectator service.

What changed:

- Shotgun pellet speed increased to 4.0-4.2 grid cells per second.
- Shotgun pellet lifetime reduced to 1.5 seconds.
- Laser emitter visuals were adjusted to fit the current sci-fi tank style better.
- Laser emitter now has a forward-facing triangular tip so the firing direction is easier to read.
- Laser aim guide no longer uses a plain dashed line. It now uses a faint guide line plus animated dot/short-segment nodes.
- Laser projectile rendering now treats the beam as a 4-grid-cell line segment. When the segment reaches a wall, the rendered beam folds into reflected line segments instead of drawing through the wall.
- Desktop online play and the cloud monitor page share the same behavior/visual intent for shotgun speed/lifetime, laser aim guides, laser beam folding, and laser emitter direction.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Laser Powerup And Projectile Lifetimes

Version: `0.3.21`

This update only changes Tank Trouble gameplay/rendering and the Tank Trouble cloud room/spectator service.

What changed:

- Powerup outer ring animation is restored: outer arcs rotate, while the inner icon stays fixed and only breathes with the pickup body.
- Dark-mode powerup icons are brighter and are drawn with `source-over` instead of being washed out by additive blending.
- Cash powerup icon was redrawn as a heavier gold double-stroke dollar, closer to a classic `$` pickup silhouette.
- Shotgun pellets now live for exactly 3.5 seconds, then fade out locally when removed.
- Added a third multiplayer powerup: `laser`.
- Powerup random pool is now cash / shotgun / laser, roughly one third each.
- Laser pickup gives the tank a radar-like laser emitter and no shotgun ammo.
- Laser-equipped tanks show a faint dashed forward aiming guide visible to all players and the monitor.
- Laser aim guide has a 7-grid-cell path budget and reflects off walls until the budget is exhausted.
- Laser fire emits one 4-grid-cell laser beam traveling at 20 grid cells per second.
- Laser beams reflect off walls like other projectiles, live for 0.75 seconds, use the firing player's color, and then fade quickly.
- After firing the single laser shot, the tank immediately returns to the default weapon.
- Cloud spectator/monitor page mirrors the desktop laser emitter, aim guide, laser projectile, powerup icons, and projectile lifetime behavior.

Where to change this next:

- Desktop projectile rules: `frontend/src/components/TankTroublePanel.tsx` -> `firePredictedLocalBullet`, `advanceOnlineBullet`.
- Desktop laser visuals: `drawLaserPowerupIcon`, `drawLaserAimSegments`, `drawLaserProjectile`, `drawSharedTankSprite`.
- Cloud powerup/server rules: `backend/cloud_setup_bundle/tank_trouble_room.py` -> `spawn_powerup`, `handle_powerup_pickups`, `spawn_laser_bullet`, `simulate_match`.
- Cloud monitor visuals: `backend/cloud_setup_bundle/tank_trouble_room.py` -> embedded `drawLaserPowerupIcon`, `drawLaserAims`, `drawLaserProjectile`, `drawTank`.
- Shared projectile protocol remains the existing `projectile_type` string field; no new API object shape was added.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

## Latest: Tank Trouble Shotgun Powerup And Minimal Kill Feed

Version: `0.3.20`

This update only changes Tank Trouble gameplay/rendering and the Tank Trouble cloud room/spectator service.

What changed:

- Kill feed now renders as plain text/icons with no outer panel.
- Kill feed no longer uses hyphen separators. Normal format is `killerID weapon-icon victimID`; suicide format is `skull-icon victimID`.
- Kill feed text/icons are larger and still use each player's tank color for IDs.
- Cash powerups now use a custom double-stroke dollar icon instead of font-dependent `$` text, so dark mode stays readable.
- Powerup icons no longer rotate; they keep the existing breathing/pulse effect.
- Multiplayer powerup spawning is now random across available powerups. Current pool is 50% cash score pickup and 50% shotgun pickup.
- Shotgun pickup grants 3 shotgun shots. While active, the tank uses a short wide barrel and each shot fires 16 small pellets in a 30-degree cone.
- Shotgun pellets use random speeds between 2.0 and 2.5 grid cells per second, do not count toward the normal 5-bullet cap, and use the firing player's color.
- Shotgun fire has a 1.5-second cooldown, a barrel reload kick, and local shell-casing ejection in desktop online play and the cloud monitor page.
- Cloud spectator/monitor rendering mirrors the desktop powerup, shotgun barrel, pellet, shell-casing, and kill-feed visuals.

Where to change this next:

- Powerup server rules and random pool: `backend/cloud_setup_bundle/tank_trouble_room.py` -> `spawn_powerup`, `advance_powerups`, `handle_powerup_pickups`.
- Shotgun server firing rules: `backend/cloud_setup_bundle/tank_trouble_room.py` -> `spawn_shotgun_pellets`, `simulate_match`.
- Desktop Tank Trouble visuals/rules: `frontend/src/components/TankTroublePanel.tsx` -> `drawPowerups`, `drawSharedTankSprite`, `firePredictedLocalBullet`.
- Monitor page visuals: `backend/cloud_setup_bundle/tank_trouble_room.py` -> embedded `drawPowerups`, `drawTank`, `drawBullet`, `drawShellCasings`, `drawKillFeed`.
- Shared protocol fields: `frontend/src/types/cloud.ts` and `backend/models.py` -> weapon/ammo/projectile powerup fields.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

Verification:

- `python -m py_compile backend\models.py backend\tank_trouble_preview_runtime.py backend\cloud_setup_bundle\tank_trouble_room.py`
- `cmd /c npm --prefix frontend run build`
- Extract embedded spectator JS from `backend/cloud_setup_bundle/tank_trouble_room.py` and run `node --check build-logs\spectator-page-check.js`.

## Latest: Tank Trouble Kill Feed Color And Scale Tuning

Version: `0.3.19`

This update only changes the Tank Trouble kill feed.

What changed:

- Kill feed player IDs now use each player's tank color.
- Normal kill format remains `killerID - bullet icon - victimID`, with killer/victim names colored separately.
- Suicide format remains `skull icon - victimID`, with the victim/self name colored by that player's tank color.
- Kill feed is larger and easier to read: 22px name text, 24px weapon icon, and a 44px panel.
- Desktop online play and cloud spectator/monitor page use the same scale and color behavior.

Where to change this next:

- Death-event color fields: `backend/cloud_setup_bundle/tank_trouble_room.py` -> `push_death_event`, `serialize_death_events`.
- Shared protocol types: `frontend/src/types/cloud.ts` and `backend/models.py` -> `TankTroubleTankExplosionState`.
- Desktop kill-feed rendering: `frontend/src/components/TankTroublePanel.tsx` -> `drawKillFeedEntries`.
- Monitor kill-feed rendering: `backend/cloud_setup_bundle/tank_trouble_room.py` -> embedded `drawKillFeed`.

## Latest: Tank Trouble Powerup Cadence, Kill Feed, And HUD Cleanup

Version: `0.3.18`

This update only changes Tank Trouble multiplayer gameplay UI/state and the cloud spectator page.

What changed:

- Multiplayer powerups now spawn from cloud room authority on a strict 5-second cadence.
- Active powerup cap is `2 * active_player_count - 1`.
- When the room is below cap, the server schedules one powerup after 5 seconds.
- When the room reaches cap, spawning pauses.
- After a pickup at cap, spawning waits a fresh 5 seconds before adding the next powerup.
- When the last player leaves or times out, all active powerups and powerup pickup effects are cleared immediately.
- Current powerup type remains gray `$`, effect `score`, score delta `+100`.
- Powerup visuals now have light/dark variants. The `$` symbol is intentionally larger than the inner disc but stays inside the outer halo.
- Online tank labels now show only player ID inside the map.
- The map interior no longer shows `V1.0`, player ID header, map tag, latency header, country suffix, or respawn countdown text.
- Tank death events now carry kill metadata through the existing `tank_explosions` state stream:
  - `killer_id`
  - `victim_id`
  - `weapon`
  - `suicide`
- Desktop online play and the cloud monitor page render a one-line kill feed in the stage area outside the map, top-right of the arena.
- Kill feed format:
  - normal kill: `killerID - bullet icon - victimID`
  - suicide: `skull icon - victimID`

Where to change this next:

- Powerup server rules: `backend/cloud_setup_bundle/tank_trouble_room.py` -> `advance_powerups`, `handle_powerup_pickups`.
- Powerup desktop visuals: `frontend/src/components/TankTroublePanel.tsx` -> `getPowerupVisualPalette`, `drawPowerups`.
- Powerup monitor visuals: `backend/cloud_setup_bundle/tank_trouble_room.py` -> embedded `powerupVisualPalette`, `drawPowerups`.
- Kill event protocol: `backend/cloud_setup_bundle/tank_trouble_room.py` -> `push_death_event`, `serialize_death_events`; model fields are in `backend/models.py` and `frontend/src/types/cloud.ts`.
- Desktop kill feed icons: `frontend/src/components/TankTroublePanel.tsx` -> `drawBulletWeaponIcon`, `drawSkullWeaponIcon`, `drawKillWeaponIcon`.
- Monitor kill feed icons: `backend/cloud_setup_bundle/tank_trouble_room.py` -> embedded `drawBulletWeaponIcon`, `drawSkullWeaponIcon`, `drawKillFeed`.

Boundary notes:

- No go2rtc video ingest/playback code is involved.
- No mechanical-arm/control-signal listener code is involved.
- Cloud deployment for this change should only replace/restart the Tank Trouble room/spectator service on port `18086`.

Verification:

- `python -m py_compile backend\models.py backend\cloud_setup_bundle\tank_trouble_room.py`
- `cmd /c npm --prefix frontend run build`
- Extract embedded spectator JS from `backend/cloud_setup_bundle/tank_trouble_room.py` and run `node --check build-logs\spectator-page-check.js`.

## Latest: Tank Trouble Shared Visual Effects And Destruction Particles

Version: `0.3.16`

This update only changes Tank Trouble desktop-game visuals and local rendering structure.

What changed:

- Destroyed tanks now create color-matched explosion particles and a shockwave.
- The main explosion color is derived from the destroyed tank color.
- Training, latency-test, and online desktop modes now share the same tank sprite renderer through `drawSharedTankSprite`.
- Training player deaths, bot deaths, latency clone hits, and online player deaths all use the same explosion helpers.
- Explosions are cleared on map changes and latency-state resets so old effects do not leak into the next scene.

Where to change visuals next:

- Tank look: `frontend/src/components/TankTroublePanel.tsx` -> `drawSharedTankSprite`
- Tank destruction: `createTankExplosion`, `advanceTankExplosions`, `drawTankExplosions`
- Player colors / glow: `getPlayerPalette`
- Desktop game rules and render loop: `createTankTroubleEngine` and `createOnlineTankTroubleEngine`

Important maintenance note:

- Desktop in-app Tank Trouble modes are now closer to one-source rendering for tanks and destruction effects.
- Browser monitor and browser latency preview still use backend-generated JavaScript renderers:
  - `backend/tank_trouble_preview_page.py`
  - `backend/cloud_setup_bundle/tank_trouble_room.py`
- If a future task needs map, tank, wall, bullet, and polish changes to automatically apply to every desktop and browser mode, extract the shared canvas renderer/style constants into one reusable asset and make both desktop and backend-served browser pages load that asset instead of copying drawing code.

Verification:

- `cmd /c npm run build`
- `python -m py_compile backend\main.py backend\models.py backend\config.py backend\settings_store.py`

## Latest: Tank Trouble Keybinding Edit Gate

Version: `0.3.15`

This update only changes the local Tank Trouble control-setting UI.

What changed:

- The key binding grid is read-only by default.
- Players must click `设置` before choosing an action and pressing a replacement key.
- Clicking `完成` exits edit mode and cancels any pending key capture.
- Custom bindings remain local-only and still emit the same cloud input payload: `forward / backward / left / right / fire_seq`.

Tank destruction effect note:

- This is easy to add next as a local canvas effect.
- The safe design is to render particles / shock rings when a tank changes from alive to destroyed, without changing cloud scoring, death, or respawn rules.

Relevant files:

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/styles/globals.css`

## Latest: Login Defaults, Setup Password Guard, And Tank Trouble Local Controls

Version: `0.3.14`

This update changes only the desktop console UI / local backend guardrails.

What changed:

- Fresh installs now show an empty server Host on the login page.
- Existing saved login settings still load from `%LOCALAPPDATA%\CloudServiceConsole\cloud-console-login.json`.
- One-click cloud setup now opens a password confirmation dialog first.
- `/api/local-setup/run` requires the current SSH password and refuses to execute setup when the password does not match the active login session.
- If the password is correct and the cloud is already ready, setup returns `环境已就绪` without rerunning the script.
- Tank Trouble launch copy now shows `V1.0` and local control-key setup instead of cloud-join explanatory text.
- Tank Trouble controls are locally customizable and saved in `localStorage`.
- The cloud protocol remains unchanged: custom local keys still emit the normal `forward / backward / left / right / fire_seq` values.
- Scoreboard rows are tighter so rank / latency / flag leave more room for the player ID, and hover no longer shifts the row left.

Relevant files:

- `backend/config.py`
- `backend/settings_store.py`
- `backend/models.py`
- `backend/main.py`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/styles/globals.css`

Verification:

- `cmd /c npm run build`
- `python -m py_compile backend\main.py backend\models.py backend\config.py backend\settings_store.py`

## Latest: Tank Trouble Multiplayer Fire Sequence And Map Reset Fix

Version: `0.3.13`

This update only changes Tank Trouble online multiplayer synchronization.

What changed:

- Online match sync now sends the client's current `map_seed`.
- The cloud ignores movement / fire input from a client that is still on the previous map during a map switch, then returns the current authoritative map state.
- Map changes clear per-player transient combat state: cooldown, queued input, and the accepted fire sequence.
- Scores, hits, deaths, player color, and player identity remain preserved across map changes.
- The cloud returns `local_state.fire_ack_seq`; the desktop client aligns its local fire counter to that processed event value.
- If cooldown / the 5-bullet cap rejects a shot, the cloud still advances `fire_ack_seq`; the desktop client then fades out the matching local prediction instead of leaving a ghost bullet or queueing a delayed shot.
- The multiplayer 5-bullet cap is counted by owner player ID across all active bullets.

Why this matters:

- Fixes the two-PC symptom where after changing maps a player could see local bullets, but the monitor and other player could not see them and they could not kill.
- Reduces edge cases where a reconnect / respawn / map switch could temporarily make the 5-bullet cap behave incorrectly.

Relevant files:

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

Boundaries:

- No go2rtc video ingest / playback changes.
- No mechanical-arm control signaling changes.
- Tank Trouble room service remains on `18086`.

## Previous: Tank Trouble Latency Badges, Bullet Cleanup, And Preview Visual Match

Version: `0.3.10`

This update only changes Tank Trouble game / monitor / preview behavior.

What changed:

- Scoreboards now show each player's cloud RTT before the country flag / country code.
- Latency colors are `<=50ms` green, `51-150ms` yellow, and `>=151ms` red.
- The desktop client measures online WebSocket RTT per acknowledged `input_seq`, smooths it, and sends it as `latency_ms` in later sync payloads.
- The cloud room service stores `latency_ms` in active player state and returns it through match state, room state, spectator state, and preview rows.
- The cloud `监控地图` spectator page now removes bullets immediately when the newest authoritative snapshot no longer contains them, preventing stale local render bullets from flying as ghost bullets.
- The spectator state sanitization filters expired bullets and clears render bullets when the room is empty and the authoritative bullet list is empty.
- The local latency-test browser page now uses the same sci-fi Tank Trouble wall and tank visual language as the desktop canvas / cloud spectator page.

Files touched for this update:

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/types/cloud.ts`
- `backend/models.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`
- `backend/tank_trouble_preview_page.py`
- `backend/tank_trouble_preview_runtime.py`

Boundaries:

- No go2rtc video ingest / playback changes.
- No mechanical-arm control signaling changes.
- No change to the cloud service port: Tank Trouble remains on `18086`.

Verification:

- `python -m compileall backend`
- `cmd /c npm run build`
- `node --check build-logs\spectator-page-check.js`
- `node --check build-logs\preview-page-check.js`
- Deployed `backend/cloud_setup_bundle/tank_trouble_room.py` to `111.230.62.106`.
- `http://111.230.62.106:18086/health` returned `{"ok": true, "idle_timeout": 0}`.

## Latest: Tank Trouble Monitor Direct Cloud Page And Smooth Local Bullets

`监控地图` now directly opens the cloud spectator page:

- `http://111.230.62.106:18086/spectator.html?room=tank-trouble-main`
- The frontend app appends `&theme=light` or `&theme=dark` when opening it.
- The button implementation is in `frontend/src/components/TankTroublePanel.tsx`.

Cloud spectator implementation:

- Main file: `backend/cloud_setup_bundle/tank_trouble_room.py`.
- Service port: `18086`.
- Health check: `http://111.230.62.106:18086/health`.
- Page: `GET /spectator.html?room=tank-trouble-main`.
- State: `GET /spectator/state?room=tank-trouble-main`.

Rendering model:

- The spectator page does not join the room, occupy colors, send player input, or write vote / score / hit state.
- The server remains authoritative for players, bullets, targets, hits, scores, deaths, respawns, and map votes.
- The browser now keeps local `renderBullets` and advances bullets every animation frame with `vx / vy`.
- Server bullet snapshots only correct target position / velocity / lifetime through `syncRenderBullets(...)`.
- Bullet disappearance uses a short local fade instead of a hard visual pop.
- Walls, targets, bullet glow, wall ripples, and tank sprites were restyled to match the in-app Tank Trouble canvas style.
- Tank direction still uses `angle + Math.PI / 2`, matching the local game turret orientation.

Boundary:

- This only touches Tank Trouble game / spectator behavior.
- It does not touch go2rtc video ingest / playback.
- It does not touch mechanical-arm control signaling.

Recent verification:

- `cmd /c npm run build`
- `python -m compileall backend`
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py`
- `node --check build-logs\spectator-page-check.js`
- `http://111.230.62.106:18086/health` returned OK.

## Latest: Tank Trouble Monitor Local Render Smoothing

The cloud spectator page behind `监控地图` now uses browser-side snapshot buffering and local interpolation to reduce visible dropped frames.

Scope:
- Main file: `backend/cloud_setup_bundle/tank_trouble_room.py`.
- The browser still pulls lightweight JSON from `/spectator/state`.
- `requestAnimationFrame` renders continuously from a local snapshot buffer.
- Tanks and bullets render about `85ms` behind server time to absorb jitter.
- Tanks and bullets can be locally extrapolated for at most `90ms`.
- Static scene content is cached in an offscreen canvas.
- Sidebar DOM updates are throttled to avoid unnecessary layout work.
- This does not touch go2rtc video, mechanical-arm control signaling, or the online player input write path.

Verification:
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py`
- `python -m compileall backend`
- `cmd /c npm run build`
- `node --check build-logs\spectator-page-check.js`

这份 README 是当前 `Cloud Service Console` 小程序的前端侧总交接文档。

如果后续有别的 agent 接手这个项目，默认先读这 3 份文档：

1. `frontend/README.md`
2. `frontend/IMPLEMENTATION_LOG.md`
3. `frontend/UI_AGENT_SPEC.md`

根目录里的 `README.md` 和 `AGENT_V3_MIGRATION_GUIDE.md` 仍然保留，但它们现在更像早期迁移说明。面向当前小程序交接、维护、继续开发时，应以 `frontend` 目录下这 3 份文档为准。

另外，`frontend/UI_Agent_长期需求规范.md` 只是为了兼容旧文件名保留的入口文件，真正内容仍以 `frontend/UI_AGENT_SPEC.md` 为准。

## 1. 这是什么

这是一个桌面小程序，当前产品名为 `Cloud Service Console`，目标是把旧的控制台能力迁移到新的桌面架构中：

- 桌面壳：Tauri
- 前端 UI：React + TypeScript + Vite
- 本地后端：Python + FastAPI
- 云端交互：Python 后端通过 SSH / HTTP / WebRTC 控制和查询远端服务

它现在不只是“前端页面”，而是一套完整的桌面工具，覆盖以下能力：

- 登录到云服务器
- 保存登录信息、自动登录
- 统一查看云端服务状态
- 启停云端服务
- 手动做健康检查和端口检查
- 切换视频接收模式 `HTTP` / `SRT`
- 打开云端视频预览
- 在本机临时接管前端控制信号接收并用 UI 可视化显示
- 在“玩玩游戏”栏目运行内嵌的坦克游戏
- 在“测试延迟”入口下运行一条“本地单坦克 + 本机网页预览”的轻量预览链路

## 2. 当前架构总览

```text
Tauri desktop shell
-> React frontend (frontend/src)
-> FastAPI backend sidecar (backend/main.py + backend/launcher.py)
-> Paramiko SSH / HTTP checks / cloud control
-> Remote services and remote helper scripts
```

更具体一点：

- `src-tauri` 负责桌面壳、sidecar backend 启动、关闭时清理 sidecar。
- `frontend` 负责所有桌面 UI、视图切换、交互、游戏画面、视频预览窗口、控制监视 UI。
- `backend` 负责所有敏感逻辑，包括 SSH 登录、远端服务启停、远端配置部署、端口检查、云端状态汇总、控制监视中继对接、坦克游戏云端桥接。
- `backend/cloud_setup_bundle` 是需要部署到云端或随 backend 打包的内部资源包。

## 3. 当前目录里哪些路径和这个小程序有关

下面这些路径是当前小程序的核心路径。

### 3.1 前端真身

- `frontend/package.json`
  前端依赖和脚本。
- `frontend/src/App.tsx`
  应用总入口，负责登录页 / 主控制台切换、主题初始化。
- `frontend/src/main.tsx`
  React 挂载入口。
- `frontend/src/pages/LoginPage.tsx`
  登录页。
- `frontend/src/pages/DashboardPage.tsx`
  主控制台页面，包含概览、服务管理、健康检查、活动日志、玩玩游戏。
- `frontend/src/components`
  公共 UI 组件目录。
- `frontend/src/components/TankTroublePanel.tsx`
  坦克游戏主文件，当前整个游戏前端主逻辑基本都在这里。
- `frontend/src/api/cloudApi.ts`
  前端访问本地 FastAPI backend 的所有接口封装。
- `frontend/src/types/cloud.ts`
  前后端协议对应的 TypeScript 类型定义。
- `frontend/src/styles/globals.css`
  全局布局和大部分组件样式。
- `frontend/src/styles/theme.css`
  浅色 / 深色主题样式变量和主题层样式。
- `frontend/public/flags`
  国旗资源，供连接快照和地区信息展示使用。
- `frontend/public/games/tank-trouble/assets`
  当前前端真正使用的坦克游戏静态贴图资源。

### 3.2 后端真身

- `backend/main.py`
  FastAPI 主入口，定义状态收集、API 路由、云端服务管理、控制监视桥接、坦克游戏 API。
- `backend/launcher.py`
  打包后的 backend sidecar 启动入口，负责 parent watchdog，确保主程序退出时 backend 也退出。
- `backend/config.py`
  内置默认配置、服务清单、端口清单、健康检查清单、登录信息存储路径规则。
- `backend/service_manager.py`
  远端 systemd 服务控制、服务状态查询、端口监听检查、当前 ingest 模式识别。
- `backend/health_checker.py`
  云端 HTTP 健康检查逻辑。
- `backend/cloud_setup.py`
  云端部署、内置 bundle 配置读取、切换 ingest 模式、生成远端配置等逻辑。
- `backend/cloud_client.py`
  远端 SSH 客户端封装。
- `backend/settings_store.py`
  登录设置的读写与迁移。
- `backend/log_store.py`
  本地活动日志内存存储。
- `backend/tank_trouble_cloud.py`
  本地 backend 和云端坦克房间脚本之间的桥。
- `backend/models.py`
  FastAPI / Pydantic 接口模型定义。

### 3.3 云端部署资源包

- `backend/cloud_setup_bundle/config/sender-cloud.config.json`
  内置云端模板配置。注意：现在是项目内置模板，不再要求用户在项目外单独提供运行时配置文件。
- `backend/cloud_setup_bundle/control_signaling.py`
  云端控制 signaling 服务脚本。
- `backend/cloud_setup_bundle/telemetry_relay.py`
  云端 telemetry / relay 相关脚本。
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  云端坦克房间、地图、投票、延迟测试逻辑真身。
- `backend/cloud_setup_bundle/www`
  云端网页资源。

### 3.4 桌面壳与打包

- `package.json`
  根目录 Tauri 脚本入口。
- `src-tauri/tauri.conf.json`
  Tauri 构建配置、窗口大小、打包目标、sidecar 配置。
- `src-tauri/src/main.rs`
  Tauri Rust 主程序，负责启动 backend sidecar、给前端注入 backend base URL、关闭时清理进程。
- `scripts/build_backend_bundle.py`
  先用 PyInstaller 打 backend sidecar，再复制到 `src-tauri/binaries`。
- `src-tauri/binaries`
  打包时实际引用的 backend sidecar 所在目录。

### 3.5 参考 / 历史代码

- `games/tank-trouble/original`
  这是最初参考过的坦克游戏原始目录。当前桌面小程序运行时不直接依赖这一套原始 Python 游戏代码，但部分设计、资源或玩法参考来自这里。

### 3.6 不要误改的生成物

下面这些通常不是“该改的源代码”：

- `frontend/dist`
- `backend/dist`
- `backend/build`
- `src-tauri/target`
- `src-tauri/binaries/*.exe`
- `**/__pycache__`
- `*.tsbuildinfo`

## 4. 当前页面结构和每个页面负责什么

### 4.1 登录页

入口文件：

- `frontend/src/pages/LoginPage.tsx`

当前职责：

- 输入云服务器 `Host`
- 输入 SSH 用户名
- 输入 SSH 密码
- 记住密码
- 自动登录
- 主题切换
- 登录中状态反馈

当前行为约束：

- `Host` 默认提示值是 `150.109.100.30`，但应表现为 placeholder，而不是已填好的正式值。
- 开启 `自动登录` 时会自动联动开启 `记住密码`。
- 关闭 `记住密码` 时会联动关闭 `自动登录`。

### 4.2 主控制台

主文件：

- `frontend/src/pages/DashboardPage.tsx`

当前 5 个视图：

- `overview`
- `services`
- `health`
- `activity`
- `games`

对应左侧导航：

- 控制台总览
- 服务管理
- 健康检查
- 活动日志
- 玩玩游戏

### 4.3 控制台总览

主要内容：

- 云端目标
- 公网入口
- 待处理控制
- 当前模式
- 服务运行数
- 健康检查数
- 最近刷新时间
- 当前连接快照
- 健康检查摘要

这里的“公网入口”对应的是当前登录云服务器推导出的 `public_base_url`。

### 4.4 服务管理

主要内容：

- 云端服务卡片
- 一键启动全部 / 停止全部
- 切换视频接收模式 `HTTP` / `SRT`
- 云端视频窗口
- 控制监视键盘

其中：

- 视频窗口默认查看 `main-camera`
- 控制监视键盘用于本机临时接管 `robot-control` 会话，观察来自网页端的控制按键

### 4.5 健康检查

主要内容：

- 手动端口检测
- 健康检查状态列表

这里不是持续监听所有端口，而是手动检查，符合用户之前的要求：避免让服务器持续做无意义高频监控。

### 4.6 活动日志

主要内容：

- 显示 backend 内存中的活动日志
- 用于查看登录、刷新、服务启停、切换模式、配置执行、错误信息

### 4.7 玩玩游戏

主要内容：

- 坦克游戏入口
- 单人训练模式
- 临时延迟测试模式

当前游戏前端主逻辑集中在：

- `frontend/src/components/TankTroublePanel.tsx`

## 5. 当前功能清单

### 5.1 登录与会话

- 后端保存登录设置
- 支持记住密码
- 支持自动登录
- 支持断开会话
- 未登录时返回登录页

### 5.2 主题

- 支持浅色模式
- 支持深色模式
- 前端主题存储 key：`cloud-service-console.theme`

### 5.3 云端状态汇总

- 服务运行数
- 健康检查数
- 最近刷新时间
- 公网入口
- 当前视频 ingest 模式
- 待处理控制 offer 数
- 当前连接快照

### 5.4 云端服务管理

当前固定管理 4 个服务：

1. `nginx`
2. `go2rtc-cloud`
3. `go2rtc-srt-bridge`
4. `go2rtc-control-signaling`

在 UI 中显示标题分别是：

1. `Nginx Gateway`
2. `go2rtc Cloud`
3. `Ingest Bridge`
4. `Control Signaling`

其中第 3 个已经统一叫 `Ingest Bridge`，不再在 UI 层区分旧的 “SRT bridge” 名称。

### 5.5 视频 ingest 模式切换

当前支持两种模式：

- `http`
- `srt`

后端判断与切换逻辑在：

- `backend/service_manager.py`
- `backend/cloud_setup.py`
- `backend/main.py`

### 5.6 视频预览

服务管理页右侧可打开视频预览。

当前策略：

- 优先尝试 WebRTC 预览
- 失败时可回退到 MP4 预览
- 视频流名固定为 `main-camera`

相关前端位置：

- `frontend/src/pages/DashboardPage.tsx`

相关后端接口：

- `GET /api/video-preview.mp4`

### 5.7 控制监视键盘

这个功能的目的不是代替机械臂正式控制链路，而是在本机临时接入 `robot-control` 会话，直接看网页端按键有没有通过云端 signaling 到达这里。

当前特征：

- 使用 WebRTC data channel
- 本机显示按下的 `Q W E R T / A S D F / Z X C`
- 显示消息计数和最近更新时间
- 不开启时不占用控制会话

相关前端位置：

- `frontend/src/pages/DashboardPage.tsx`

相关后端位置：

- `backend/main.py`

云端相关路径：

- `backend/cloud_setup_bundle/control_signaling.py`

### 5.8 一键配置

UI 上虽然叫 “一键配置”，但当前实际含义是：

- 检查云端环境是否就绪
- 如果未就绪，则部署 / 修复云端 bundle

它不是“本地机器环境配置器”，只是因为早期命名沿用了 `local_setup` 这组 API 名称。

对应后端：

- `backend/main.py`
  - `check_local_setup`
  - `ensure_local_setup`
  - `evaluate_local_setup_ready`
  - `run_local_setup_script`

真正执行的内容在：

- `backend/cloud_setup.py`

### 5.9 坦克游戏

坦克游戏当前已经是这个小程序的一部分，不是外挂网页。

当前包含：

- 训练模式
- 训练模式内置一个简单本地电脑玩家 `CPU-1`，只在前端本地引擎里运行，不经过云端，不碰正式视频 / 控制链路，也不进入延迟测试模式
- 房间同步
- 计分板
- 颜色选择
- 地图投票换图
- 临时延迟测试模式（本地单坦克 + 本机网页预览）
- 当前所有实际带战斗判定的模式，统一使用同一套底层规则：
- 坦克移动速度 `1.6 格/秒`
- 每玩家同时最多 `5` 发炮弹
- 单发寿命 `10` 秒
- 炮弹速度 `1.85 格/秒`

当前“测试延迟”入口的真实含义：

- 桌面端仍然运行本地实时游戏引擎
- 不再把前端输入发到云端驱动一个克隆坦克
- 预览目标改为：通过本机 backend 提供一个浏览器页面，实时显示当前战场和计分板
- 浏览器预览页当前入口：`/tank-trouble/preview`
- 浏览器预览只显示战场地图和计分板，不显示启动按钮、返回按钮或其他控制台 UI
- 前端当前只向 backend 周期上报“本地玩家坦克快照”
- backend 会基于房间缓存、预览会话缓存和服务端规则自行组装 `scene / rows / map_label / runtime_summary`
- backend 里的浏览器 viewer 会基于 backend 生成的 `scene` 在 `<canvas>` 上本地重绘战场，而不是显示 `<img>` 截图

旧的云端 latency API 和 `tank_trouble_room.py` 里的相关逻辑当前仍然保留在工程里，但前端“测试延迟”入口已经不再走那条链路。

- 浏览器预览页当前内容严格限制为“战场地图 + 计分板”
- 当前桌面端 latency 模式会关闭本地电脑玩家，只保留一个本地玩家坦克

坦克游戏前端主文件：

- `frontend/src/components/TankTroublePanel.tsx`

坦克游戏云端逻辑：

- `backend/cloud_setup_bundle/tank_trouble_room.py`

坦克游戏本地后端桥接：

- `backend/tank_trouble_cloud.py`
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_preview_page.py`

## 6. 坦克游戏相关路径总表

### 6.1 当前实际生效的代码

- `frontend/src/components/TankTroublePanel.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/api/cloudApi.ts`
- `frontend/src/types/cloud.ts`
- `backend/main.py`
- `backend/models.py`
- `backend/tank_trouble_preview_runtime.py`
- `backend/tank_trouble_preview_page.py`
- `backend/tank_trouble_cloud.py`
- `backend/cloud_setup_bundle/tank_trouble_room.py`

### 6.2 当前实际使用的游戏资源

- `frontend/public/games/tank-trouble/assets/tankGreen.png`
- `frontend/public/games/tank-trouble/assets/tankRed.png`
- `frontend/public/games/tank-trouble/assets/tankRed2.png`

### 6.3 参考代码，不是运行真身

- `games/tank-trouble/original/tank_trouble.py`
- `games/tank-trouble/original/README.md`
- `games/tank-trouble/original/游戏说明.txt`
- `games/tank-trouble/original/image/*`

## 7. 内置默认值和云端对象清单

### 7.1 登录默认值

定义在 `backend/config.py`：

- `publicScheme = http`
- `apiPort = 18081`
- `sshPort = 22`
- `sshUser = ubuntu`
- `defaultHost = 150.109.100.30`

### 7.2 当前管理的远端服务

定义在 `backend/config.py`：

- `nginx`
- `go2rtc-cloud`
- `go2rtc-srt-bridge`
- `go2rtc-control-signaling`

### 7.3 当前端口检查项

定义在 `backend/config.py`：

- `ssh` -> `22/tcp`
- `public-http` -> `18081/tcp`
- `internal-api` -> `18082/tcp`
- `ingest-http` -> `18084/tcp`
- `webrtc` -> `19090/udp,tcp`
- `srt` -> `19091/udp`
- `rtsp` -> `8554/tcp`

### 7.4 当前健康检查项

定义在 `backend/config.py`：

- `clock` -> `/clock`
- `streams` -> `/api/streams`
- `control` -> `/control/webrtc/health`

### 7.5 内置 bundle 模板配置

定义文件：

- `backend/cloud_setup_bundle/config/sender-cloud.config.json`

当前模板关键字段：

- `streamName = main-camera`
- `remoteBase = /opt/go2rtc-cloud`
- `apiPort = 18081`
- `ingestPort = 18084`
- `internalApiPort = 18082`
- `telemetryInternalPort = 18083`
- `controlSignalingInternalPort = 18085`
- `webrtcPort = 19090`
- `srtIngestPort = 19091`
- `rtspPort = 8554`
- `transport.ingestMode = http`

注意：

- 这个文件现在是项目内置模板。
- 当前小程序的运行不要求用户在项目外额外维护一份同名配置。
- 但是 backend 的云端部署逻辑仍然会读取它，作为项目内部的“默认真身”。

## 8. 前端到 backend 的 API 清单

当前前端接口封装文件：

- `frontend/src/api/cloudApi.ts`

### 8.1 基础

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/login`
- `POST /api/logout`

### 8.2 状态与连接

- `GET /api/status`
- `GET /api/status/live`
- `POST /api/refresh`
- `GET /api/network-snapshot`
- `POST /api/network-snapshot/refresh`
- `GET /api/logs`

### 8.3 云端服务

- `POST /api/services/start-all`
- `POST /api/services/stop-all`
- `POST /api/services/{service_name}/start`
- `POST /api/services/{service_name}/stop`
- `POST /api/ingest-mode/switch`

### 8.4 健康 / 端口

- `POST /api/ports/check-all`
- `POST /api/ports/{port_key}/check`

### 8.5 云端配置

- `GET /api/local-setup/check`
- `POST /api/local-setup/run`

### 8.6 视频预览

- `GET /api/video-preview.mp4`

### 8.7 控制监视

- `GET /api/control-monitor/config`
- `GET /api/control-monitor/offer`
- `POST /api/control-monitor/answer`

### 8.8 坦克游戏

- `POST /api/games/tank-trouble/room/sync`
- `POST /api/games/tank-trouble/room/vote-toggle`
- `POST /api/games/tank-trouble/room/leave`
- `POST /api/games/tank-trouble/preview/push`
- `POST /api/games/tank-trouble/preview/clear`
- `GET /api/games/tank-trouble/preview/state`
- `WS /api/games/tank-trouble/latency/ws`
- `POST /api/games/tank-trouble/latency/sync`
- `POST /api/games/tank-trouble/latency/leave`

## 9. 本地存储、运行时输出、持久化位置

### 9.1 前端 localStorage

- `cloud-service-console.theme`
- `cloud-service-console:tank-trouble-player-id`
- `cloud-service-console:tank-trouble-leaderboard`

### 9.2 登录设置文件

由 `backend/settings_store.py` 和 `backend/config.py` 管理。

Windows：

- `%LOCALAPPDATA%/CloudServiceConsole/cloud-console-login.json`

macOS：

- `~/Library/Application Support/CloudServiceConsole/cloud-console-login.json`

Linux：

- `~/.local/share/CloudServiceConsole/cloud-console-login.json`

兼容旧位置：

- `<runtime_dir>/data/cloud-console-login.json`

### 9.3 打包产物与中间产物

前端构建产物：

- `frontend/dist`

backend PyInstaller 产物：

- `backend/dist/cloud-console-backend-x86_64-pc-windows-msvc.exe`

Tauri sidecar 引用位置：

- `src-tauri/binaries/cloud-console-backend-x86_64-pc-windows-msvc.exe`

桌面主程序：

- `src-tauri/target/release/Cloud Service Console.exe`

Windows 安装包：

- `src-tauri/target/release/bundle/nsis/Cloud Service Console_0.3.0_x64-setup.exe`

## 10. 运行方式与打包方式

### 10.1 单独跑前端

在 `frontend` 目录：

```powershell
npm install
npm run dev
```

默认会访问：

- `http://127.0.0.1:8765`

也可以通过 `VITE_API_BASE` 覆盖。

### 10.2 单独跑 backend

在 `backend` 目录：

```powershell
python main.py
```

默认监听：

- `http://127.0.0.1:8765`

### 10.3 Tauri 开发模式

根目录脚本：

```powershell
npm run tauri:dev
```

当前注意点：

- `src-tauri/tauri.conf.json` 的 `beforeDevCommand` 是空字符串。
- 这意味着开发时通常要先让 frontend dev server 和 backend 可用。
- 打包后的正式桌面程序则会由 Tauri 自动拉起 sidecar backend。

### 10.4 Tauri 正式打包

根目录：

```powershell
npm run tauri:build
```

实际流程：

1. `scripts/build_backend_bundle.py` 先用 PyInstaller 打 `backend/launcher.py`
2. sidecar backend 复制到 `src-tauri/binaries`
3. `frontend` 执行生产构建
4. Tauri 生成主程序和 NSIS 安装包

## 11. Tauri 和 sidecar backend 是怎么配合的

关键文件：

- `src-tauri/src/main.rs`
- `backend/launcher.py`

当前行为：

- Tauri 启动时在本地挑一个空闲端口
- 通过环境变量把 host / port / parent pid 传给 backend sidecar
- backend sidecar 就绪后，前端再通过 `invoke("get_backend_base_url")` 获取实际 backend base URL
- 主窗口关闭或主程序退出时，Tauri 会主动杀 sidecar
- backend 端还有一层 watchdog，会检测父进程是否存活，如果主程序没了，backend 自己也退出

这个设计是为了让打包后的桌面程序尽量“即插即用”，减少“主程序关了但 backend 残留”的情况。

## 12. 当前工程约束和后续 agent 必须知道的事

### 12.1 不要把 SSH 逻辑塞回前端

这是硬边界。

SSH 登录、远端服务控制、云端部署、健康检查、控制 signaling 对接，这些逻辑都应该继续留在 Python backend。

### 12.2 少改文件、少扩散

这是用户明确提出过的长期要求。

默认策略：

- 能改一个文件就不要拆成很多文件
- 能局部修补就不要大重构
- 能保留旧链路就不要硬删

### 12.3 旧链路尽量保留作兜底

这个项目里很多功能是“新链路 + 老链路保底”的思路发展出来的。

因此：

- 不要轻易删老开关
- 不要随意移除 fallback
- 除非用户明确要求，否则不要为了“代码更干净”而砍掉兜底路径

### 12.4 坦克游戏的延迟测试链路是隔离需求

用户对延迟测试模式的要求非常明确：

- 优先低延迟
- 优先丝滑稳定
- 不能顺手碰其他控制 / 视频链路

所以：

- 如果继续改 `TankTroublePanel.tsx` 的 latency 模式
- 或继续改 `backend/cloud_setup_bundle/tank_trouble_room.py`

必须默认只在“测试延迟”这条链路内动刀，不要把逻辑扩散到别的正式链路。

当前延迟测试链路额外约束：

- `backend/tank_trouble_cloud.py` 会优先启动 / 复用云端 `tank_trouble_room.py --serve`
- 默认端口在 `backend/config.py`：`TANK_GAME_SERVER_PORT = 18086`
- 这个常驻进程只服务坦克游戏低延迟测试和在线房间，不是正式视频 / 控制链路的一部分
- 当前设计为常驻热服务，不会因为 30 秒空闲或最后一个玩家退出而自动关闭
- 如需关闭 18086 游戏服务，应通过服务器进程管理或云端服务管理手动关闭
- 如果公网端口或服务不可达，本地 backend 会回退旧 SSH exec 链路，避免功能直接不可用

当前前端引擎内的隔离机制：

- `TankTroublePanel.tsx` 里仍然保留了旧 latency clone 相关辅助逻辑，便于以后继续实验
- 但当前前端“测试延迟”入口不会再激活旧的 clone 同步流程
- 现在进入 latency 模式时，前端只会：
- 关闭本地电脑玩家
- 运行本地单坦克战场
- 向本机 backend 周期推送玩家坦克快照
- 本机 backend 结合房间缓存和 preview runtime 生成 `scene`、计分板、地图标签和运行统计
- 本机 backend 通过 `backend/tank_trouble_preview_page.py` 提供 `/tank-trouble/preview` 页面
- 浏览器页面本地轮询 `/api/games/tank-trouble/preview/state`，再在 canvas 上自行渲染战场和计分板
- 旧的 `latencyOnly` / WebSocket / HTTP sync 相关实现当前属于保留代码，不是现行主链路

### 12.5 终端里可能看到中文乱码

当前工程源码里有不少中文 UI 文本。

在某些 Windows PowerShell / 终端编码环境里，直接 `Get-Content` 可能出现中文显示乱码，但这不一定代表文件内容真的坏了。阅读和编辑时优先使用支持 UTF-8 的编辑器。

### 12.6 当前 canonical 文档位置

现在给 agent 看的真身文档已经收敛到：

- `frontend/README.md`
- `frontend/IMPLEMENTATION_LOG.md`
- `frontend/UI_AGENT_SPEC.md`
- `frontend/UI_Agent_长期需求规范.md` 只是旧命名兼容入口

旧文档可以参考，但不应覆盖这里的内容。

## 13. 新 agent 的建议阅读顺序

如果你是第一次接手这个项目，建议按这个顺序读：

1. `frontend/README.md`
2. `frontend/IMPLEMENTATION_LOG.md`
3. `frontend/UI_AGENT_SPEC.md`
4. `frontend/src/pages/DashboardPage.tsx`
5. `frontend/src/components/TankTroublePanel.tsx`
6. `frontend/src/api/cloudApi.ts`
7. `backend/main.py`
8. `backend/config.py`
9. `backend/service_manager.py`
10. `backend/cloud_setup.py`
11. `backend/tank_trouble_cloud.py`
12. `backend/cloud_setup_bundle/tank_trouble_room.py`
 
## 14A. Latency Preview 2026-05-03 鏇存柊

杩欐鏇存柊鍙姩鍧﹀厠娓告垙 + browser preview 杩欐潯娴嬭瘯/瑙傚療閾捐矾锛屼笉纰拌棰戞帹娴併€佹帶鍒朵俊鍙锋垨浜戠 control signaling 姝ｅ紡閾捐矾銆?

鏍稿績鍙樺寲锛?
- `frontend/src/components/TankTroublePanel.tsx`
  - 淇鍧﹀厠缁樺埗鏈濆悜锛岀幇鍦?`drawTankSprite()` 浣跨敤 `tank.angle + Math.PI / 2`
  - preview push 鏀规垚鎼哄甫 `snapshot_seq`
  - preview player snapshot 鏂板 `shots`
  - preview push 鏂板闃插爢绉€昏緫锛屽悓鏃跺彧鍏佽涓€涓姹傚湪璺戯紝鍚庣画鍒锋柊鍚堝苟涓烘渶鏂扮姸鎬佸啀鎺ㄩ€?
- `frontend/src/types/cloud.ts`
  - `TankTroublePreviewPlayerSnapshot` 鏂板 `shots`
  - `TankTroublePreviewPushRequest` 鏂板 `snapshot_seq`
- `backend/models.py`
  - backend preview push 妯″瀷鍚屾鏀寔 `shots` 鍜?`snapshot_seq`
- `backend/tank_trouble_preview_runtime.py`
  - preview runtime 鐜板湪鍦ㄥ悗绔淮鎶?preview-only scene
  - 鏍规嵁鍓嶇涓婃姤鐨?`tank + shots + snapshot_seq` 缁存姢 server-side bullets / targets / wallRipples / bulletFades
  - 鏀寔 stale snapshot 忽略锛岄伩鍏嶅悗鍒板寘鎶婃柊鐘舵€佽鐩?
  - `get_state()` 浼氬厛鎶?preview 浼氳瘽妯℃嫙鍒板綋鍓嶆椂鍒伙紝鎻愰珮 browser 绔瓙寮瑰拰闈跺瓙鐘舵€佺殑杩炶疮鎬?
- `backend/tank_trouble_preview_page.py`
  - 淇 browser viewer 鍧﹀厠缁樺埗鏈濆悜锛屼篃鏀规垚 `tank.angle + Math.PI / 2`
  - poll interval 浠?`60ms` 璋冩暣鍒?`45ms`
  - tank / bullet smoothing 杞诲井鎻愰珮
  - browser 瀛愬脊鏂板鐭建杩?trail锛岃杞ㄨ抗鏇村鏄撶湅鍒?

褰撳墠 browser preview 閾捐矾锛?
- 鍓嶇 latency 妯″紡鍙笂鎶?`session_id / room / player_id / country_code / snapshot_seq / tank / updated_at_ms`
- backend preview runtime 鍦ㄥ悗绔淮鎶?preview-only scene
- `/tank-trouble/preview` 鏈湴杞 `/api/games/tank-trouble/preview/state`锛屽啀鐢?canvas 鑷娓叉煋

杩欎釜鏇存柊鐨勭洰鐨勬槸锛氳 browser preview 鏇存帴杩戔€滄湇鍔＄瑙嗚鈥濓紝鑰屼笉鏄墠绔洿鎺ヤ笂浼?whole scene銆?

## 14. 这份 README 的定位

这不是一个“对外宣传”的 README，而是一份面向继续开发和交接的工程内说明书。

目标不是简洁，而是让后续 agent 在最短时间内回答这些问题：

- 这个小程序是什么
- 哪些文件才是当前真身
- 每个页面做什么
- 前后端怎么通信
- 运行时数据写到哪
- 打包链路怎么走
- 坦克游戏在哪
- 延迟测试链路在哪
- 哪些边界不能乱碰

如果后续产品继续演进，应优先维护这份 README 的真实性。

## 14B. GitHub 自更新链路（2026-05-03）

这套桌面程序现在已经接入一条正式的 GitHub 自更新链路，目标是：

- 用户安装过一次桌面版以后，后续只需要在程序里点更新按钮，不再依赖本地手工打新版 `exe`
- 发布动作尽量交给 GitHub Actions 完成
- 更新检测和安装只发生在正式的 Tauri 打包程序里，不影响浏览器开发模式

当前前端接入点：

- `frontend/src/hooks/useAppUpdater.ts`
  - 全局更新状态入口
  - 负责在 Tauri 运行时动态导入 `@tauri-apps/api/app` 和 `@tauri-apps/api/updater`
  - 启动时检查当前版本与 GitHub 最新 release
  - 维护 `available / installing / currentVersion / latestVersion / error` 等状态
- `frontend/src/components/UpdateAction.tsx`
  - 圆形更新按钮
  - 只在“发现新版本”或“正在安装更新”时显示
  - 点击后调用 Tauri updater 安装新版
- `frontend/src/App.tsx`
  - 挂载全局 updater hook
  - 把 updater 状态和安装动作透传给登录页和主控制台
- `frontend/src/pages/LoginPage.tsx`
  - 登录页右上角，主题切换按钮左边
- `frontend/src/components/Topbar.tsx`
  - 主控制台顶部操作区，主题切换按钮左边

当前 Tauri 壳层接入点：

- `src-tauri/tauri.conf.json`
  - 已开启 `tauri.updater.active = true`
  - 已关闭内置弹窗 `dialog = false`
  - 更新清单入口固定为：
    - `https://github.com/Secant1998/Cloud-Service-Console/releases/latest/download/latest.json`
  - 已写入 updater 公钥
- `src-tauri/Cargo.toml`
  - `tauri` 已开启 `updater` feature

当前 GitHub 发布自动化入口：

- `.github/workflows/release-windows.yml`
  - 触发方式：`push main` 或手动 `workflow_dispatch`
  - 只做 Windows 发布
  - 会先安装 `frontend` 依赖
  - 会安装 `backend/requirements.txt` 和 `PyInstaller`
  - `backend/requirements.txt` 里现在也包含 `Pillow`，因为 `beforeBuildCommand` 会运行 `scripts/make_icon.py`
  - 会自动计算版本号
  - 会调用 `scripts/update_versions.py` 同步版本文件
  - 会调用 `tauri-apps/tauri-action@action-v0.6.2`
  - 会发布 `nsis + updater` 产物
  - 已设置 `updaterJsonPreferNsis: true`

## 14C. 版本号、签名密钥与发布注意点

当前版本同步脚本：

- `scripts/update_versions.py`

它会同步这些文件里的版本号：

- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

当前本机 updater 私钥位置：

- `C:\Users\SECANT\.tauri\cloud-service-console.key`

当前本机 updater 公钥位置：

- `C:\Users\SECANT\.tauri\cloud-service-console.key.pub`

注意：

- 私钥绝对不能提交到仓库
- GitHub Actions 现在需要一个仓库 Secret：
  - `TAURI_PRIVATE_KEY`
- 这个 Secret 的内容可以直接放私钥文件全文，或者放私钥文件路径对应的字符串内容
- 当前这次实现没有再引入密码保护版本的私钥，所以暂时不需要 `TAURI_KEY_PASSWORD`

本地手工打包时现在推荐这样跑：

```powershell
$env:TAURI_PRIVATE_KEY='C:\Users\SECANT\.tauri\cloud-service-console.key'
npm run tauri:build -- --bundles nsis,updater
```

当前已知状态：

- 本地已经能正常打出：
  - `src-tauri/target/release/bundle/nsis/Cloud Service Console_0.3.1_x64-setup.exe`
  - `src-tauri/target/release/bundle/nsis/Cloud Service Console_0.3.1_x64-setup.nsis.zip`
- 本地这次没有看到 `latest.json` 落盘，因此“GitHub Release 实际产出 updater 清单”这一步仍以首次 GitHub Actions 运行结果为准
- 换句话说：
  - 程序内的“检测更新 / 点击安装”入口已经接好
  - GitHub 自动发布工作流已经接好
  - 还需要 GitHub 上真实跑一次 release workflow，才能完成端到端闭环验证

## 14D. Tank Trouble 延迟预览同步

这次延迟测试链路里的浏览器预览，已经从“后端根据 `shots` 自己推测子弹/靶子”改成了“前端直接上报 authoritative scene，后端只缓存和转发真实状态”。

当前设计：

- 前端 `frontend/src/components/TankTroublePanel.tsx`
  - `buildPreviewSnapshot()` 直接从本地游戏引擎取真实场景
  - 上报字段包括：
    - `authoritative_scene`
    - `theme`
    - `tank`
    - `bullets`
    - `targets`
  - `bullets` 里带 `id / x / y / radius / vx / vy`
  - `targets` 里带 `id / x / y / radius / phase`
- 前端类型 `frontend/src/types/cloud.ts`
  - `TankTroublePreviewBulletState` 新增 `vx / vy`
  - `TankTroublePreviewPlayerSnapshot` 新增 `score / hits`
  - `TankTroublePreviewPushRequest` 新增 `authoritative_scene / theme / bullets / targets`
- 后端模型 `backend/models.py`
  - 与前端同步新增上述字段，保证 API request/response 一致
- 后端预览 runtime `backend/tank_trouble_preview_runtime.py`
  - 当 `authoritative_scene = true` 时：
    - 不再根据 `tank.shots` 本地生成子弹
    - 不再本地推演 target hit / respawn
    - 直接缓存前端上传的 `bullets / targets / theme / score / hits`
  - 当旧客户端没有发 authoritative scene 时，仍然保留原来的 `shots -> spawn bullet` 兼容逻辑
- 浏览器 viewer `backend/tank_trouble_preview_page.py`
  - 现在会读取子弹的 `vx / vy`
  - 新快照到达时只做轻量校正
  - 两次快照之间在 viewer 本地按速度连续推进子弹，避免视觉上慢半拍

这样改的原因：

- 以前后端只知道“开了几枪”，不知道每颗真实子弹此刻的位置、速度、反弹结果和靶子实时状态
- 所以 tank 位置看起来还行，但子弹和靶子天然会出现不同步、显得慢、命中反馈滞后的问题
- authoritative scene 之后，浏览器预览和桌面端游戏看到的是同一份场景来源，后端不再做近似猜测

兼容和边界：

- 这次改动只作用于 Tank Trouble 的延迟测试预览链路
- 不影响视频推流、控制信号监听、机械臂控制或其他云端服务
- 如果以后还要扩展别的调试模式，建议继续沿用这套 authoritative scene 方式，不要再回到 `shots` 推导

本次验证：

- `frontend` 下执行 `cmd /c npm run build` 通过
- 工程根目录执行 `python -m compileall backend` 通过
- 额外做过一次 `TankTroublePreviewRuntime` 的 authoritative push 自测，确认返回状态里已经能拿到：
  - `theme`
  - `score`
  - `bullets`
  - `targets`
  - `vx / vy`

## 14E. 程序内更新前先释放 backend 文件占用

问题现象：
- Windows 下程序内更新会拉起 NSIS 安装器
- 旧版本主程序发起更新时，安装器可能在覆盖 `cloud-console-backend.exe` 时报 `Error opening file for writing`
- 根因是本地 sidecar backend 仍在运行，导致安装目录中的 `cloud-console-backend.exe` 仍被占用

本次修复：
- `src-tauri/src/main.rs`
  - 新增 `prepare_update_install` Tauri command
  - 在真正执行 updater 安装前，主动终止 sidecar backend
  - 额外等待 backend 监听端口关闭，再短暂等待文件句柄释放
- `frontend/src/hooks/useAppUpdater.ts`
  - 更新按钮触发安装时，先 `invoke("prepare_update_install")`
  - 只有 backend 停干净后才继续 `installUpdate()`
  - 新增 `preparing` 状态，用于表达“正在关闭本地 backend，准备安装更新”

影响范围：
- 只影响桌面程序内更新这条链路
- 不影响普通启动、视频链路、控制信号链路和 Tank Trouble 游戏逻辑

注意：
- 这个修复会让“安装了修复版之后的后续程序内更新”更稳定
- 对于已经安装的旧版本，如果它本身还没有这段“更新前先停 backend”的逻辑，第一次升级到修复版时，仍可能需要用户手动关闭程序或结束 `cloud-console-backend.exe` 后再重试一次安装器

## 14F. Tank Trouble 在线房间化

这次改动把 `开始游戏` 从原来的本地训练入口切成了直接加入云端在线对局。

当前行为：

- 未进入对局时，前端只轮询房间状态，不把自己注册进房间。
- 颜色选择只允许选择当前房间中未被占用的颜色。
- 已被占用的颜色会在 UI 上进入呼吸灯不可选状态，点击会触发一次短暂抖动反馈。
- 如果 4 个颜色都被占用，则 `开始游戏` 按钮会禁用，文案显示 `游戏已满`。
- 点击 `开始游戏` 后，前端会先调用一次在线对局同步接口，拿到当前云端权威状态，然后再进入对局画面。
- 如果服务器里已经有人在玩，则会直接中途加入当前对局，而不是新开一局。
- 玩家点击 `返回选单`，或者小程序切走导致页面卸载时，会主动向服务器发送离场请求。
- 玩家离场后，计分板会立即移除该玩家，坦克立即消失，但该玩家已发射出的炮弹不会立刻消失，而是自然飞行到寿命结束。
- 同 ID 玩家下次重新进入时从 0 分开始，不继承离场前分数。
- 玩家死亡后不会立刻重生，而是等待 1 秒后由服务器重新放置。
- 换图投票会实时显示所有已投票玩家的颜色标记；只有所有在线玩家都投票后才会进入 3 秒倒计时。

前端结构变化：

- `frontend/src/components/TankTroublePanel.tsx`
  - 新增房间大厅状态轮询。
  - 新增在线对局启动流程。
  - 新增在线对局 WebSocket 长连接。
  - 新增 `createOnlineTankTroubleEngine(...)`，专门渲染服务器权威状态。
  - 在线模式下计分板改为优先显示服务器返回的 `active_players`，不再把分数写进本地排行榜缓存。
- `frontend/src/api/cloudApi.ts`
  - 新增房间状态接口。
  - 新增在线对局同步接口。
  - 新增在线对局离场接口。
  - 新增在线对局 WebSocket 入口。
- `frontend/src/types/cloud.ts`
  - 新增在线房间状态、玩家状态、子弹状态、目标状态、投票标记等类型定义。
- `frontend/src/styles/globals.css`
  - 新增颜色占用态、颜色不可选抖动、投票点阵、倒计时按钮发光效果。
- `frontend/src/styles/theme.css`
  - 补充深色模式下上述新状态的样式。

本地后端 / 云端变化：

- `backend/models.py`
  - 新增房间状态查询模型。
  - 新增在线对局输入 / 场景状态模型。
- `backend/main.py`
  - 新增 `POST /api/games/tank-trouble/room/status`
  - 新增 `POST /api/games/tank-trouble/match/sync`
  - 新增 `POST /api/games/tank-trouble/match/leave`
  - 新增 `WS /api/games/tank-trouble/match/ws`
- `backend/tank_trouble_cloud.py`
  - 新增在线房间状态查询。
  - 新增在线对局同步 / 离场桥接。
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - 房间状态文件现在同时保存在线玩家、颜色占用、在线计分、在线子弹、在线目标、换图投票。
  - 新增玩家 revision，用于避免“离场前旧炮弹给重进后的新一轮分数加分”。
  - 新增 `status` / `match_sync` / `match_leave` 三类 action。
  - 在线对局由云端脚本推进权威状态，前端不再自己决定多人战斗结果。

联机同步链路：

1. 大厅界面轮询 `room/status`，只看颜色占用、在线人数、当前地图和投票状态。
2. 点击 `开始游戏` 后，前端先调用一次 `match/sync`，把自己正式加入房间并拿到首帧权威状态。
3. 进入对局后，前端通过本地 backend 的 `match/ws` 与云端在线房间保持长连接。
4. 前端持续发送当前按键输入和 `fire_seq`。
5. 云端脚本推进所有在线玩家、子弹、目标和计分，再把完整状态回传。
6. 前端本地只负责渲染、平滑和 UI 反馈，不负责在线对局的胜负判定。

兼容范围：

- 这次改动只作用于 Tank Trouble 小程序游戏面板。
- 不触碰视频推流 / 拉流链路。
- 不触碰控制信号监听链路。
- 不影响主程序的服务管理、健康检查、更新器等其它模块。

本次验证：

- `frontend` 下执行 `cmd /c npm run build` 通过。
- 工程根目录执行 `python -m compileall backend` 通过。

## 14G. Tank Trouble 在线房间规则补丁

这次是在 `14F` 的在线房间基础上，继续把“加入 / 退出 / 颜色占用 / 换图投票”的行为补到更接近正式联机规则。

本次规则补丁：

- `开始游戏` 继续直接作为在线玩家加入服务器，不再回退到旧的本地训练入口。
- 房间颜色仍然只有 4 个：
  - `green`
  - `red`
  - `blue`
  - `yellow`
- 大厅阶段只轮询房间状态，不提前注册玩家。
- 颜色选择只允许选择当前房间还没有被占用的颜色。
- 已被占用的颜色在 UI 中维持呼吸灯效果，点击会触发短暂抖动提示“当前不可选”。
- 如果 4 种颜色全部被在线玩家占用，则 `开始游戏` 按钮禁用并显示 `游戏已满`。
- 玩家点击 `返回选单`，或因为切到别的界面导致游戏页卸载时，会向服务器发送离场。
- 离场后：
  - 计分板立即移除该玩家
  - 坦克立即从战场消失
  - 该玩家已经发射出去的炮弹不会立刻清空，而是继续飞到寿命自然结束
- 同一个 `player_id` 重新进入时：
  - 分数从 `0` 开始
  - 不继承上一次离场前的得分
  - 上一轮残留炮弹不会再占用这一轮玩家的 `5 发上限`
  - 上一轮残留炮弹也不会再被当作“新自己打中新自己”的自伤判定
- 玩家死亡后由服务器等待 `1 秒` 再重生。

投票换图补丁：

- 所有在线玩家都能实时看到当前有哪些玩家已经投票。
- 投票展示现在同时包含：
  - 按钮右下角的彩色圆点簇
  - 下方带颜色点的投票标记条
- 只有当所有在线玩家都投票之后，换图按钮才会进入 `armed` 状态。
- 进入 `armed` 状态后，按钮会出现更明显的扫光和圆点呼吸效果。
- 真正进入 `3 秒倒计时` 后，按钮会继续进入 `countdown` 状态：
  - 倒计时 `3 -> 2 -> 1` 会逐步加快闪烁节奏
  - 圆点簇与按钮底纹会同步闪烁/扫光
  - 视觉上不再只是单一绿色，而是带一点更明显的联机状态反馈

本次涉及的主要文件：

- `frontend/src/components/TankTroublePanel.tsx`
  - 联机大厅状态判断
  - 满房/颜色占用/按钮文案
  - 投票换图按钮状态类名
- `frontend/src/styles/globals.css`
  - 颜色占用呼吸灯
  - 不可选颜色抖动
  - `armed / countdown` 投票按钮动效
- `frontend/src/styles/theme.css`
  - 深色主题下的联机投票动效补充
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - 离场后旧炮弹继续存在
  - 旧会话炮弹不再占用新会话的发射上限
  - 旧会话炮弹不再对同 ID 新会话触发错误的自伤判定

影响范围：

- 只作用于 Tank Trouble 游戏面板。
- 不触碰视频推流 / 拉流链路。
- 不触碰控制信号监听或机械臂控制链路。
- 不影响控制台其他服务管理、健康检查、更新器等模块。

本次验证：

- `frontend` 下执行 `cmd /c npm run build` 通过。
- 工程根目录执行 `python -m compileall backend` 通过。

## 14H. Tank Trouble 在线同步改为“本机本地跑 + 云端分发他人状态”

这次是在 `14F / 14G` 的在线房间基础上，继续把在线协议改成更接近真正联机游戏的结构。

本次目标：
- 前端不再把“本机坦克的位置和朝向”交给云端每帧回传再纠正。
- 前端本地直接推进本机坦克的位移和朝向。
- 前端只把本机坦克当前位移结果与开火事件上传到云端房间。
- 前端从云端房间接收：
  - 除本机以外的其他玩家坦克位置/朝向
  - 全部炮弹坐标与速度
  - 目标状态
  - 本机命中 / 分数 / 死亡 / 重生结果
- 所有画面继续由前端本地 Canvas 渲染，不走云端渲染。

协议层变化：

- `backend/models.py`
  - 新增 `TankTroubleMatchLocalPlayerSyncState`
  - 新增 `TankTroubleMatchLocalState`
  - `TankTroubleMatchRequest` 新增可选 `local_player`
  - `TankTroubleMatchState` 新增 `local_state`
- `frontend/src/types/cloud.ts`
  - 与后端同步新增上述类型定义
- `frontend/src/components/TankTroublePanel.tsx`
  - `TankTroubleEngine` 新增 `buildMatchSyncState()`
  - 在线同步发送 payload 时会把本机本地坦克的 `x / y / angle / radius` 一并上传

云端房间逻辑变化：

- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - 新增 `normalize_match_local_player(...)`
  - 新增 `apply_reported_match_player_state(...)`
  - `match_sync` 不再根据 `forward / backward / left / right` 在云端推进本机坦克位移
  - 云端改为直接接收前端上传的本机坦克当前 `x / y / angle`
  - 云端仍然负责：
    - 炮弹生成
    - 炮弹飞行
    - 反弹
    - 命中判定
    - 分数统计
    - 死亡与 1 秒重生
    - 换图投票
- `build_match_state(...)`
  - `players` 现在只返回“其他玩家”
  - 本机玩家单独通过 `local_state` 返回

前端在线引擎变化：

- `frontend/src/components/TankTroublePanel.tsx`
  - `createOnlineTankTroubleEngine(...)` 现在把：
    - `localPlayer` 作为单独的本地对象维护
    - `players` Map 只用于其他玩家
  - 本机坦克位移完全在本地推进
  - 云端回包不再持续纠正本机正常移动过程
  - 云端只在这些时机强制同步本机：
    - 首次加入
    - 地图切换
    - 死亡
    - 重生
    - 本地状态漂移过大
  - 其他玩家仍由云端状态驱动并在前端做平滑插值
  - 炮弹仍由云端位置驱动，但全部由前端本地渲染

结果：

- 本机坦克手感不再强依赖“云端回包后再纠正”，理论上会比上一版顺很多。
- 云端仍然保留房间权威逻辑，但不再承担本机坦克每一帧的移动积分。
- 这次改动仍然只作用于 Tank Trouble 小程序游戏面板。
- 不触碰视频推流 / 拉流链路。
- 不触碰控制信号监听或机械臂控制链路。

本次验证：
- `frontend` 下执行 `cmd /c npm run build` 通过。
- 工程根目录执行 `python -m compileall backend` 通过。
## 14I. Tank Trouble 在线模式视觉与手感回正

- 在线模式此前误走了一套简化版联机渲染，导致墙体材质、波纹效果、目标样式、坦克外观和炮塔朝向回退到更早版本。
- 现已把在线模式重新接回与“机器人版本”一致的高级舞台表现：
  - 科技感墙体渐变、扫描光、节点灯和碰撞波纹恢复。
  - 目标靶子的外发光、编号和风格恢复。
  - 在线玩家与本机玩家重新使用同款坦克精灵逻辑，炮塔方向与前进方向重新一致。
- 在线运动同步这次也一起做了两项关键修正：
  - 移除了渲染循环里 `dt` 的 `0.01s` 下限，避免高刷新率机器上坦克实际移速偏快。
  - 本机坦克不再被普通云端回包频繁硬拉位置，只在初次进入、换图、死亡/重生或超大漂移时才强制对齐。
- 在线远端玩家与子弹的插值改成按 `dt` 的阻尼函数平滑，而不是固定系数硬插值，减少帧率变化带来的瞬移和快慢不一致。
- WebSocket 在线同步现在优先直接喂给游戏引擎，房间 UI 只做降频刷新，避免“每来一包就整页 React 重渲染”拖慢游戏主循环。

## 14J. Tank Trouble 在线模式改为远端连续模拟 + 轻校正

本次改动继续解决在线模式“数据量不大但仍然卡”的问题。结论是：卡顿主要不是状态字段太多，而是远端玩家和子弹之前更像“追服务器快照”，回包间隔一抖就会表现成顿、追、瞬移。

本轮同步策略变化：

- 在线活跃同步间隔从 `24ms` 改为 `16ms`，让服务端状态节奏更接近一帧一次。
- 云端 `match` 回包现在给每个远端玩家附带当前输入状态 `input` 和 `server_time_ms`。
- 云端 `match` 回包现在给每颗子弹附带 `age`、`bounces_left` 和 `server_time_ms`。
- 前端在线引擎收到远端玩家后，不再只把它朝 `targetX / targetY` 拉过去，而是按该玩家的 `forward / backward / left / right` 在本地每帧连续推进。
- 服务器坐标继续保留为校正目标，但校正强度降低，只有漂移很大时才强制拉齐。
- 在线子弹现在也先按本地 `vx / vy` 连续推进并本地处理墙体反弹，再用服务器位置/速度做轻校正。
- 前端对旧服务器返回值做了兼容：如果云端还没有下发新字段，会自动回退到空输入、默认弹跳次数和由 `life` 推导出的 `age`。

涉及文件：

- `frontend/src/components/TankTroublePanel.tsx`
  - `ONLINE_SYNC_RUSH_INTERVAL_MS` 改为 `16`
  - 新增 `normalizeMatchInputState(...)`
  - `OnlinePlayer` 新增 `input / serverTimeMs`
  - `OnlineBullet` 新增 `age / bouncesLeft / serverTimeMs`
  - 新增远端玩家本地推进逻辑 `advanceOnlinePlayer(...)`
  - 新增在线子弹本地推进与墙体反弹逻辑 `advanceOnlineBullet(...)`
- `frontend/src/types/cloud.ts`
  - `TankTroubleMatchPlayerState` 新增可选 `input / server_time_ms`
  - `TankTroubleMatchBulletState` 新增可选 `age / bounces_left / server_time_ms`
  - `TankTroubleMatchLocalState` 新增可选 `server_time_ms`
- `backend/models.py`
  - 与前端协议同步新增上述字段
- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - `build_match_state(...)` 在在线房间回包中下发远端玩家输入、服务器时间和子弹生命周期信息

设计注意事项：

- 这不是减少状态量，而是改变状态的使用方式：服务器快照从“每包都驱动画面”退到“规则确认与轻校正”。
- 本地玩家仍然以本地输入为主，只有进房、换图、死亡、重生或超大漂移时强制对齐。
- 远端玩家和子弹现在更接近“本地连续播放一条由服务器确认的轨迹”，理论上会比追包模式更顺。
- 本次改动只作用于 Tank Trouble 在线游戏链路，不触碰视频推流 / 拉流链路，也不触碰机械臂控制信号链路。

验证结果：

- `cmd /c npm run build` 通过。
- `python -m compileall backend` 通过。

## 14M. Tank Trouble 云端常驻观战页：监控地图

本次新增“监控地图”入口，用于从浏览器常驻查看当前在线房间状态。它和“测试延迟”网页预览的目标相似，都是让浏览器本地渲染游戏画面，但数据来源不同：

- 测试延迟网页预览：本地小程序把当前延迟测试画面状态推给本地后端预览页。
- 监控地图：浏览器直接打开云端 Tank Trouble 房间服务提供的观战页，从云端拉取当前在线房间快照。

核心原则：

- 观战页不加入房间。
- 观战页不占用玩家颜色。
- 观战页不写入玩家输入、投票或房间操作。
- 有玩家在线时，观战请求只读云端状态，不推进权威游戏循环。
- 没有玩家在线但云端仍有残留炮弹时，观战请求只做轻量自然清理，让残留炮弹按寿命消失。
- 视频推流 / 拉流链路不变。
- 机械臂控制信号链路不变。

新增入口：

- 小程序页面：`frontend/src/components/TankTroublePanel.tsx`
- 按钮位置：Tank Trouble 游戏选择卡片右侧，和“开始游戏”“测试延迟”同一行。
- 按钮名称：`监控地图`
- 点击行为：调用本地后端获取当前登录云服务器的观战页 URL，然后用浏览器打开。

本地后端新增接口：

- `GET /api/games/tank-trouble/spectator/page-url?room=tank-trouble-main`
- 实现文件：`backend/main.py`
- 返回模型：`TankTroublePageUrlResponse`
- 模型文件：`backend/models.py`
- 返回示例：

```json
{
  "ok": true,
  "room": "tank-trouble-main",
  "url": "http://<当前登录服务器IP>:18086/spectator.html?room=tank-trouble-main"
}
```

云端 Tank Trouble 房间服务新增接口：

- `GET /spectator.html?room=tank-trouble-main`
- `GET /spectator/state?room=tank-trouble-main`
- 实现文件：`backend/cloud_setup_bundle/tank_trouble_room.py`
- 服务端口：`18086`
- HTML 页面是自包含页面，不需要额外静态资源文件。

观战状态包含：

- `room`
- `map_seed`
- `map_id`
- `snapshot_seq`
- `server_time_ms`
- `active_player_count`
- `active_players`
- `players`
- `bullets`
- `targets`
- `voters`
- `vote_count`
- `vote_required`
- `countdown_seconds`
- `world.walls`
- `world.arena`

浏览器渲染方式：

- Canvas 本地绘制地图、墙体、靶子、坦克、炮弹和计分板。
- 活跃时约每 `45ms` 拉取一次轻量 JSON 状态。
- 空房间时约每 `300ms` 拉取一次状态，降低常驻监控压力。
- 画面仍用 `requestAnimationFrame` 每帧渲染。
- 坦克和炮弹在浏览器侧做轻量插值，避免因为网络抖动出现明显顿挫。

涉及文件：

- `backend/cloud_setup_bundle/tank_trouble_room.py`
  - 新增 `build_spectator_state(...)`
  - 新增 `load_spectator_state(...)`
  - 新增 `build_spectator_html(...)`
  - 新增 `GET /spectator.html`
  - 新增 `GET /spectator/state`
- `backend/tank_trouble_cloud.py`
  - 新增 `spectator_page_url(...)`
  - 新增 `ensure_server(...)`
- `backend/main.py`
  - 新增 `get_tank_trouble_spectator_page_url(...)`
  - 新增 `/api/games/tank-trouble/spectator/page-url`
- `backend/models.py`
  - 新增 `TankTroublePageUrlResponse`
- `frontend/src/api/cloudApi.ts`
  - 新增 `getTankTroubleSpectatorPageUrl(...)`
- `frontend/src/types/cloud.ts`
  - 新增 `TankTroublePageUrlResponse`
- `frontend/src/components/TankTroublePanel.tsx`
  - 新增 `监控地图` 按钮
  - 新增 `openSpectatorMap(...)`
- `frontend/src/styles/globals.css`
  - 游戏启动按钮区从 2 列改为 3 列

验证结果：

- `cmd /c npm run build` 通过。
- `python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\main.py backend\tank_trouble_cloud.py backend\models.py` 通过。

## 14K. Tank Trouble 在线本机预测子弹与回溯修复

本次改动针对在线测试中仍出现的三类体感问题：

- 本机坦克偶发被服务器快照拉回，表现为回溯 / 瞬移。
- 本机按空格后炮弹要等服务器确认才出现，表现为开火延迟。
- 服务器子弹确认或消失时，画面中可能出现炮弹突然出现、突然消失。

本轮处理方式：

- 本机坦克正常移动时不再因为普通 `local_state` 漂移而硬回拉坐标。
- 服务器仍可在进房、换图、死亡、重生等明确状态切换时强制同步本机位置。
- 本机开火时，前端立即创建一颗 `predicted` 本地子弹。
- 服务器真子弹返回后，前端按位置把它与本地预测子弹匹配，并平滑接管同一颗视觉子弹。
- 被服务器确认接管的预测子弹不会再额外生成淡出残影，减少“突然闪没”的观感。
- 如果预测子弹超过短时间仍未被服务器确认，会淡出移除，避免服务端拒绝开火时一直残留。

涉及文件：

- `frontend/src/components/TankTroublePanel.tsx`
  - `OnlineBullet` 新增 `predicted`
  - 新增本机开火锁存、冷却和预测子弹 ID
  - 新增 `firePredictedLocalBullet(...)`
  - 调整 `applyLocalPlayerState(...)`，普通回包只轻微校正角度，不再硬拉位置
  - 调整服务器子弹同步逻辑，让服务器子弹优先接管本地预测子弹

版本：

- 桌面应用版本提升到 `0.3.4`。

验证结果：

- `cmd /c npm run build` 通过。
- `python -m compileall backend` 通过。

## 14L. Tank Trouble 统一在线本地权威手感

本次改动修正了上一版“在线单人 fast path”的错误边界：在线模式不应该因为房间里有没有其他玩家而切换本机手感。正确模型是本机玩家始终本地权威渲染，其他玩家和其他玩家炮弹只是额外叠加显示。

本轮处理方式：

- 移除 `soloLocalMode` 和 `ONLINE_SYNC_SOLO_INTERVAL_MS`，不再区分单人在线 / 多人在线手感。
- 本机坦克位移和角度始终由本地输入逐帧推进；服务器坐标只在加入、换图、死亡、重生等状态边界重新播种。
- 本机炮弹始终本地即时生成和本地推进；服务器返回同一颗本机炮弹时只绑定 `serverId` 做确认，不接管本地坐标。
- 远端玩家坦克、远端炮弹仍然接收服务器状态并在本地插值显示。
- 本机炮弹命中靶子在本地即时结算和刷新，服务器靶子状态只在初始化、换图或明显状态签名变化时合并，避免回包持续覆盖本地视觉。
- 在线 WebSocket 调度统一为“有输入时 `16ms`、空闲时 `90ms`”，不再按玩家数量切换。
- 在线模式的 React 统计快照刷新保持较低频率，画布仍然逐帧渲染，避免网络包驱动 React 重渲染。

涉及文件：

- `frontend/src/components/TankTroublePanel.tsx`
  - `createOnlineTankTroubleEngine(...)` 改为统一在线本地权威模型。
  - `applyMatchState(...)` 分离本机玩家 / 远端玩家、本机炮弹 / 远端炮弹。
  - `firePredictedLocalBullet(...)` 本地即时开炮并维持本地发射计数。
  - `handleLocalBulletTargetHit(...)` 本地即时处理靶子命中、分数和靶子刷新。
  - `applyServerTargets(...)` 用靶子签名减少网络快照对本地靶子画面的覆盖。

版本：

- 桌面应用版本提升到 `0.3.6`。

验证结果：

- `cmd /c npm run build` 通过。
### Tank Trouble 0.3.11 Notes

- Scoreboards can show per-player latency before the country/flag area. The latency color convention is green for `<=50ms`, yellow for `51-150ms`, and red for `>=151ms`.
- The latency-test mode measures the desktop-to-local-backend preview push round trip and refreshes the displayed latency at most once per second.
- The latency-test preview browser page and the cloud monitor/spectator page are intentionally locked to dark mode so their visual style stays consistent regardless of the console theme.
- The cloud spectator room service advances and clears leftover bullets when the room is empty, preventing old bullets from remaining visible after a player exits and later rejoins.
- Map-vote indicators should not appear inside the change-map button. They are displayed only in the vote strip below the button.

### Tank Trouble 0.3.12 Notes

- Online multiplayer has no training targets. Latency-test mode still keeps targets for its test flow.
- Online firing is now sequence-confirmed by successful local bullet creation. Repeated Space presses during cooldown or while 5 bullets are active are ignored instead of being queued for delayed cloud shots.
- Very short Space taps in online mode are still caught for the next render frame, but failed fire attempts are discarded immediately.
- The cloud match service also consumes rejected fire sequence numbers, so stale or over-eager clients cannot create later "ghost shots".
- The cloud monitor page keeps the battlefield at the fixed `1280 / 800` aspect ratio when the right scoreboard is visible.
- The latency-test preview entry is a styled button instead of a raw URL line.

### Tank Trouble 0.3.17 Notes

- The keybinding editor is collapsed by default. Click `设置` to show the forward/back/turn/fire binding buttons, then click `完成` to hide them again.
- Player turn speed is now one full rotation every `1.3s`; the desktop engine and cloud room script use the same `2π / 1.3` value.
- Tank destruction visuals are shared more consistently across desktop play, latency preview, and cloud monitor pages. The effect keeps the previous blast size but adds sci-fi segmented rings and electric/radial strokes.
- Latency preview pushes now include `tankExplosions`, and the preview browser page renders them locally.
- Online multiplayer has cloud-authoritative powerups through `powerups` and `powerup_effects`.
- The first multiplayer powerup appears 5 seconds after the first player joins. Active powerups are capped at `2 * active_player_count - 1`.
- The first implemented powerup is a gray `$` pickup with `effect: "score"` and `score_delta: 100`.
- Powerups are multiplayer-only. Training/latency targets remain separate and are not reused for online powerup rules.
- The cloud monitor/spectator page renders `tank_explosions`, `powerups`, and `powerup_effects` from the room state without joining the room or touching player input.
- Related files for this feature are `frontend/src/components/TankTroublePanel.tsx`, `frontend/src/types/cloud.ts`, `backend/models.py`, `backend/tank_trouble_preview_runtime.py`, `backend/tank_trouble_preview_page.py`, and `backend/cloud_setup_bundle/tank_trouble_room.py`.

### Tank Trouble 0.3.28 Notes

- Projectile spawn safety is shared across desktop prediction and cloud room authority. The helper backs the muzzle origin away from walls and pushes fallback spawn points out of wall geometry when a tank barrel is pressed into a wall.
- Laser weapons use the safe spawn helper for firing and aiming, so laser paths should no longer visually originate from or travel through wall interiors because the barrel tip was inside a wall.
- Death resets weapon equipment to the default tank. This clears shotgun, laser, minigun ammo/spin/reload state. Shield is intentionally separate from weapon state and is not removed by weapon reset unless normal shield timing expires.
- Multiplayer powerups now include `shield`, a gray pickup with a shield icon and `effect: "shield"`.
- Shield pickup creates a circular force field centered on the tank for `3s`, then a `1.5s` flicker/fade window. It renders as a translucent circle with ripple rings so the tank remains visible underneath.
- Shield reflects incoming bullets and laser paths during both active and flicker periods. The owner's own bullets ignore its own shield.
- Shield is not a weapon and can coexist with shotgun, laser, or minigun regardless of pickup order.
- Desktop online play and the cloud spectator page both render shield pickups, `SHIELD` pickup text, shield visuals, and shield-aware laser aiming.
- Related files for this feature are `frontend/src/components/TankTroublePanel.tsx`, `frontend/src/types/cloud.ts`, `backend/models.py`, and `backend/cloud_setup_bundle/tank_trouble_room.py`.

### Tank Trouble 0.3.29 Notes

- Shield protection is enforced by the cloud room authority before tank damage is applied.
- Bullet travel now checks the whole frame segment against the shield circle, so a projectile cannot skip through the shield between two frame endpoints.
- When a bullet reflects from a shield, the cloud service moves it to the shield outside edge and skips same-frame player hit checks to avoid the old "reflected but still killed the tank" ordering bug.
- Enemy laser segments are blocked by the shield hit guard before tank hit resolution. Owner projectiles still ignore the owner's own shield.
- This fix is in `backend/cloud_setup_bundle/tank_trouble_room.py`; video and mechanical-arm control services are unrelated.

### Tank Trouble 0.3.30 Notes

- Shield radius is now `PLAYER_RADIUS + 30` across desktop play, cloud room authority, and the cloud monitor/spectator page.
- Projectile spawn safety now starts shots outside the tank body plus projectile radius, then uses the shared wall push-out fallback if the barrel is pressed into a wall. This reduces shield-plus-wall muzzle bugs.
- Desktop online prediction now uses the same segment-vs-circle shield collision as the cloud authority, so bullets can visibly bounce from shields instead of only being blocked server-side.
- Projectiles carry `owner_shield_released`. A newly fired owner projectile can leave its own shield cleanly; after it exits, the owner's shield can reflect it if it returns.
- Shield impacts create a short ripple on both the desktop canvas and the cloud monitor page, making reflected bullets easier to see.
- Cloud-authoritative same-frame damage suppression and shield hit guards remain in place so reflected bullets should not kill the shielded tank during edge timing.
- Related files are `frontend/src/components/TankTroublePanel.tsx`, `frontend/src/types/cloud.ts`, `backend/models.py`, and `backend/cloud_setup_bundle/tank_trouble_room.py`.

### Tank Trouble 0.3.37 Notes

- Minigun firing now ejects small metallic shell casings. The ejection direction is locally randomized inside a 30-degree cone so sustained fire feels mechanical without adding server state.
- Shotgun firing now has a pump-action barrel animation: the barrel retracts and extends during the existing shotgun cooldown / `weapon_reload_ms` window.
- The cloud spectator / monitor page mirrors both effects, but generates them locally in browser code by observing newly visible minigun or shotgun projectiles.
- No gameplay authority changed in this pass. The Tank Trouble room service still owns bullets, hits, shields, score, powerups, and match state; shell casings and pump motion remain visual-only.
- This change does not touch go2rtc video ingest/playback or the mechanical-arm/control-signal listener.
- Related files are `frontend/src/components/TankTroublePanel.tsx` and `backend/cloud_setup_bundle/tank_trouble_room.py`.

### Tank Trouble 0.3.38 Notes

- The top three scoreboard ranks now use medal PNG artwork instead of text numbers.
- Rank medal assets live in `frontend/public/tank-trouble/scoreboard/` for the desktop app and `backend/cloud_setup_bundle/www/tank-trouble/scoreboard/` for the cloud spectator page.
- `rank-1.png`, `rank-2.png`, and `rank-3.png` map to first, second, and third place respectively. Fourth through tenth place keep the text rank fallback.
- The cloud monitor page serves the same artwork through `/assets/tank-trouble/scoreboard/rank-*.png`.

### Tank Trouble 0.3.39 Notes

- Multiplayer powerups now include `double_barrel`, a gray pickup using `double-barrel.png` with pickup text `BARREL+1`.
- Double barrel is a weapon powerup. It gives 10 independent shots, alternating left and right barrels. Each barrel fires default-property bullets, and the double-barrel ammo does not count against the normal 5 active default-bullet limit.
- Double-barrel cooldown is half of the normal shot cooldown, so the combined fire rate is doubled while each barrel keeps the normal cadence.
- The desktop online client predicts double-barrel shots locally for immediate feel, while the cloud Tank Trouble room remains authoritative for ammo, bullets, hits, score, deaths, and map state.
- The tank sprite now renders twin barrels with a short recoil animation on the barrel that just fired. The cloud spectator page uses the same visual logic.
- Static powerup icon assets live at `frontend/public/tank-trouble/powerups/double-barrel.png` and `backend/cloud_setup_bundle/www/tank-trouble/powerups/double-barrel.png`.
- Related files are `frontend/src/components/TankTroublePanel.tsx`, `frontend/src/types/cloud.ts`, `backend/models.py`, and `backend/cloud_setup_bundle/tank_trouble_room.py`.
