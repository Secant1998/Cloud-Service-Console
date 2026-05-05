# Tank Trouble Agent Handoff

Last updated: 2026-05-05

Owner: Tank Trouble game design, game cloud room service, game monitor pages, game assets, game one-click setup.

## 1. Responsibilities

- Maintain desktop Tank Trouble gameplay UI and canvas rendering.
- Maintain online multiplayer, latency test, monitor map, powerups, weapons, score, death, respawn, map vote.
- Maintain cloud authoritative room service and spectator page.
- Maintain Tank Trouble one-click cloud setup.
- Keep game rendering/style synchronized across desktop, latency preview, and cloud monitor page.

## 2. Strict Boundaries

Allowed to modify:

- `frontend\src\components\TankTroublePanel.tsx`
- `frontend\src\types\cloud.ts` only for Tank Trouble models.
- `frontend\src\api\cloudApi.ts` only for Tank Trouble API wrappers.
- `backend\models.py` only for Tank Trouble models.
- `backend\main.py` only for `/api/games/tank-trouble/*` and preview page endpoints.
- `backend\tank_trouble_cloud.py`
- `backend\tank_trouble_preview_page.py`
- `backend\tank_trouble_preview_runtime.py`
- `backend\cloud_setup_bundle\tank_trouble_room.py`
- `frontend\public\tank-trouble\**`
- `backend\cloud_setup_bundle\www\tank-trouble\**`
- Tank Trouble CSS classes in `frontend\src\styles\globals.css`, with UI Agent alignment.

Do not modify:

- `backend\cloud_setup_bundle\control_signaling.py`.
- go2rtc video viewer pages unless adding game-independent shared assets is explicitly requested.
- Video ingest services or control signaling services.
- Global UI components unless coordinated with UI Design Agent.

## 3. Current Game Modes

Online mode:

- Button: `开始游戏`
- Joins current cloud room.
- Local player's own tank is rendered and advanced locally for low latency.
- Cloud room service remains authoritative for shared state, other players, bullets, score, kills, powerups, map votes, and respawn.
- Uses WebSocket where available: `WS /api/games/tank-trouble/match/ws`.

Latency test mode:

- Button: `测试延迟`
- Uses local backend plus cloud game service to compare timing.
- Has local preview page `GET /tank-trouble/preview`.
- Preview state is pushed to `POST /api/games/tank-trouble/preview/push`.

Monitor map:

- Button: `监控地图`
- Opens cloud spectator page from current logged-in server.
- Page URL comes from `GET /api/games/tank-trouble/spectator/page-url?room=tank-trouble-main`.
- Browser locally renders the arena from cloud snapshots.

One-click setup:

- Button: `一键配置`.
- Checks/syncs current bundled game cloud script/assets to the logged-in cloud server.
- Only restarts `cloud-service-console-tank-trouble`.

## 4. Frontend Game Files

Main component:

- `frontend\src\components\TankTroublePanel.tsx`

Important areas inside the component:

- constants for world, grid, player, bullets, weapons, shields, powerups.
- engine creation and local simulation.
- online match sync and WebSocket handling.
- latency sync and preview push.
- canvas render functions.
- scoreboard render.
- map vote render.
- color selection and keybinding editor.
- one-click setup button behavior.

Public assets:

- `frontend\public\tank-trouble\powerups\cash.png`
- `frontend\public\tank-trouble\powerups\shotgun.png`
- `frontend\public\tank-trouble\powerups\laser.png`
- `frontend\public\tank-trouble\powerups\minigun.png`
- `frontend\public\tank-trouble\powerups\double-barrel.png`
- `frontend\public\tank-trouble\powerups\shield.png`
- `frontend\public\tank-trouble\scoreboard\rank-1.png`
- `frontend\public\tank-trouble\scoreboard\rank-2.png`
- `frontend\public\tank-trouble\scoreboard\rank-3.png`

## 5. Backend Game Files

Local backend APIs:

- `backend\main.py`
- `backend\models.py`
- `backend\tank_trouble_cloud.py`
- `backend\tank_trouble_preview_page.py`
- `backend\tank_trouble_preview_runtime.py`

Cloud game service:

- `backend\cloud_setup_bundle\tank_trouble_room.py`

Cloud game assets:

- `backend\cloud_setup_bundle\www\tank-trouble\powerups\*.png`
- `backend\cloud_setup_bundle\www\tank-trouble\scoreboard\*.png`

Cloud service details:

- Remote base: `/home/<sshUser>/.cloud-service-console/tank-trouble`
- Remote script: `/home/<sshUser>/.cloud-service-console/tank-trouble/tank_trouble_room.py`
- Remote manifest: `/home/<sshUser>/.cloud-service-console/tank-trouble/bundle-manifest.json`
- Systemd unit: `cloud-service-console-tank-trouble`
- Internal port: `18086`
- Public proxy: `http://<host>:18081/tank-trouble/`

## 6. Game API Index

Setup:

- `GET /api/games/tank-trouble/setup/check`
- `POST /api/games/tank-trouble/setup/run`

Room/status:

- `POST /api/games/tank-trouble/room/status`
- `POST /api/games/tank-trouble/room/sync`
- `POST /api/games/tank-trouble/room/vote-toggle`
- `POST /api/games/tank-trouble/room/leave`

Online match:

- `POST /api/games/tank-trouble/match/sync`
- `POST /api/games/tank-trouble/match/leave`
- `WS /api/games/tank-trouble/match/ws`

Latency test:

- `POST /api/games/tank-trouble/latency/sync`
- `POST /api/games/tank-trouble/latency/leave`
- `WS /api/games/tank-trouble/latency/ws`

Local preview:

- `POST /api/games/tank-trouble/preview/push`
- `POST /api/games/tank-trouble/preview/clear`
- `GET /api/games/tank-trouble/preview/state`
- `GET /tank-trouble/preview`

Cloud monitor:

- `GET /api/games/tank-trouble/spectator/page-url?room=tank-trouble-main`
- Cloud page: `/tank-trouble/spectator.html?room=tank-trouble-main`
- Cloud state: `/tank-trouble/spectator/state?room=tank-trouble-main`

## 7. One-Click Setup Contract

One-click setup must always let the user sync any logged-in server to the current bundled Tank Trouble version.

Current behavior:

- Local bundle hash covers `backend\cloud_setup_bundle\tank_trouble_room.py` and `backend\cloud_setup_bundle\www\tank-trouble\**`.
- Remote manifest is `bundle-manifest.json`.
- If missing/different/unhealthy, upload game script/assets and restart only `cloud-service-console-tank-trouble`.
- If already current and healthy, report `服务器已同步到当前版本` without unnecessary upload/restart.

Important rule:

- Whenever Tank Trouble cloud-facing code/assets change, update one-click setup logic if needed so new servers can be synced from inside the app.
- Do not require manual SCP or manual systemd editing for game-only changes once the app is installed.

## 8. Current Gameplay Contract

Shared constants currently include:

- World: `1280 x 800`.
- Logical grid: `9 x 6`.
- Player speed: `1.6` logical grid cells per second.
- Turn speed: one full turn per `1.3s`.
- Normal bullet speed: `1.85` logical grid cells per second.
- Normal bullet life: `10s`.
- Max normal bullets: `5` active per player.
- Respawn delay: `1s`.

Current powerups:

- Cash: gray pickup, cash icon, pickup text `+100`, score +100.
- Shotgun: gray pickup, shotgun icon, pickup text `SHOTGUN`, 3 shots, 16 pellets, 1.5s cooldown.
- Laser: gray pickup, laser icon, pickup text `LASER`, one laser shot.
- Minigun: gray pickup, minigun icon, pickup text `MINIGUN`, 20 rounds, 0.5s spin-up.
- Double barrel: gray pickup, icon `double-barrel.png`, pickup text `BARREL+1`, 10 independent shots.
- Shield: gray pickup, shield icon, pickup text `SHIELD`, visible circular force field.

Current visual sync expectation:

- Desktop online canvas, latency preview page, and cloud monitor page should share the same arena style, tank style, projectile style, powerup assets, explosions, and important visual effects.
- Visual-only effects should stay local-rendered and not add unnecessary server authority work.

## 9. Validation

Recommended local checks:

```powershell
python -m py_compile backend\cloud_setup_bundle\tank_trouble_room.py backend\tank_trouble_cloud.py backend\tank_trouble_preview_page.py backend\tank_trouble_preview_runtime.py backend\main.py backend\models.py
cmd /c npm --prefix frontend run build
```

Spectator JS check:

```powershell
@'
from pathlib import Path
source = Path('backend/cloud_setup_bundle/tank_trouble_room.py').read_text(encoding='utf-8')
start = source.index('<script>') + len('<script>')
end = source.index('</script>', start)
out = Path('build-logs/spectator-page-check.js')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(source[start:end], encoding='utf-8')
print(out)
'@ | python -
node --check build-logs\spectator-page-check.js
```

Cloud checks:

- `http://<host>:18081/tank-trouble/health`
- `http://<host>:18081/tank-trouble/spectator.html?room=tank-trouble-main`
- `http://<host>:18081/tank-trouble/spectator/state?room=tank-trouble-main`

## 10. Documentation Update Rule

After every game change:

- Update this file.
- Update `frontend\IMPLEMENTATION_LOG.md`.
- Update `frontend\README.md` if behavior, paths, rules, or assets changed.
- If cloud one-click setup behavior changes, update `docs\AGENT_HANDOFF_MASTER_INDEX.md`.
