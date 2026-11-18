# UI Design Agent Handoff

Last updated: 2026-11-18

RoboCasa import follow-up: the existing viewer now receives the 60 supplemental
models through the same manifest API. Multi-axis sink handles use URDF virtual
frames while retaining the original physical body in simulator MJCF. Sink/stove
slider motion was observed; complete browser automation did not pass (page waits,
page closure and small-knob drag targeting). Keep this limitation distinct from
the passing import/API checks. No UI behavior was changed for this import batch.

Joint-preview update: the model detail canvas has an attached, bounded joint-button
list and selected-joint slider/value row. Selection tints the moving part and shows
its axis; camera tools remain inside the canvas. Controls work in light/dark modes,
on mobile and in full screen. Native URDF limits and mimic relationships come from
the additive view API contract; malformed controls are disabled with a reason.
Camera framing reserves opened-part space. See `docs/MODEL_LIBRARY.md` and
`reports/model-joints-20261105/` for validation and deployment details.

Joint marker follow-up: revolute/continuous controls use an arc arrow around the
axis extension outside the selected part. Prismatic arrows start at the moving
assembly's center and follow its motion. Use native inertia when provided,
otherwise its geometry center. Screenshots are under the report's `indicators/` folders.

Owner: overall mini app UI design, visual language, layout, interaction effects, theme consistency.

## 1. Responsibilities

- Maintain the visual system for the whole desktop app.
- Keep new feature UI consistent across overview, service management, health checks, activity logs, and games.
- Maintain light/dark theme behavior.
- Maintain polished card, panel, hover, transition, and scroll behavior.
- Provide UI guidance to Video, Control, and Tank Trouble agents when they add feature controls.

## 2. Strict Boundaries

Allowed to modify:

- `frontend\src\styles\globals.css`
- `frontend\src\styles\theme.css`
- `frontend\src\components\AppShell.tsx`
- `frontend\src\components\Sidebar.tsx`
- `frontend\src\components\Topbar.tsx`
- `frontend\src\components\Button.tsx`
- `frontend\src\components\ToggleSwitch.tsx`
- `frontend\src\components\ServiceCard.tsx`
- `frontend\src\components\HealthPanel.tsx`
- `frontend\src\components\MetricCard.tsx`
- `frontend\src\components\SummaryCard.tsx`
- `frontend\src\components\ActivityLog.tsx`
- `frontend\src\components\StatusBadge.tsx`
- `frontend\src\components\UpdateAction.tsx`
- `frontend\src\pages\LoginPage.tsx`
- `frontend\src\pages\DashboardPage.tsx` for layout/presentation only.
- `frontend\src\components\TankTroublePanel.tsx` for styling/layout only, with Tank Trouble Agent coordination.

Do not modify:

- Cloud scripts.
- API behavior.
- Game rules.
- Video ingest logic.
- Control signaling logic.
- Backend service management behavior.

## 3. Current App Layout

Top-level:

- `frontend\src\App.tsx`
- `frontend\src\main.tsx`
- `frontend\src\components\AppShell.tsx`

Main pages:

- Login: `frontend\src\pages\LoginPage.tsx`
- Dashboard: `frontend\src\pages\DashboardPage.tsx`

Dashboard views:

- `overview`: 控制台总览
- `services`: 服务管理
- `health`: 健康检查
- `activity`: 活动日志
- `games`: 玩玩游戏

Navigation:

- `frontend\src\components\Sidebar.tsx`
- `frontend\src\components\Topbar.tsx`

## 4. Current Visual Contract

Global style direction:

- Rounded cards and panels.
- Soft shadows and subtle depth.
- Smooth hover/press states.
- Light/dark themes both must feel designed, not merely inverted.
- Indicator lamps for status where possible.
- Buttons and toggles should feel tactile and rounded.
- No harsh white blocks in overlays.
- No abrupt sticky-card collisions while scrolling.
- Headers should stay readable while content scrolls.
- Text should not be selectable unless it is an input, textarea, code, URL, log console, or explicitly useful copyable text.
- Button labels must not wrap.

Interaction effects currently desired by user:

- Main background color subtly changes with mouse movement, not a single cursor halo.
- Cards/panels should have refined hover effects: soft color shift, mild glow, moving highlight, or glass effect where appropriate.
- Clickable cards should provide feedback.
- Scroll fade at edges should be natural, not visible as a white rectangular mask.
- Dark mode active navigation must be obvious.
- Light mode hover should be as carefully designed as dark mode hover.

Typography:

- Chinese text should use a Heiti-style font where possible.
- UI copy should be concise and project-specific.

## 5. Component Index

Reusable components:

- `Button.tsx`: button variants, loading state.
- `ToggleSwitch.tsx`: rounded sliding switch.
- `ServiceCard.tsx`: cloud service start/stop cards.
- `HealthPanel.tsx`: health and port cards.
- `MetricCard.tsx`: overview metrics.
- `SummaryCard.tsx`: overview summary cards.
- `ActivityLog.tsx`: log viewer.
- `StatusBadge.tsx`: status badge.
- `UpdateAction.tsx`: GitHub/app update UI.

Styles:

- `globals.css`: primary component styling and layout.
- `theme.css`: theme variables.

## 6. Login UI Contract

Login should:

- Use the current rounded dark/light panel style.
- Keep host blank by default, with placeholder/default host handled clearly.
- Host input may expose a saved-account dropdown for previously successful logins, but the menu should stay visually integrated with the existing login card rather than feeling like a browser default datalist.
- Choosing a saved host should auto-fill the paired username/password preferences for that saved login account without forcing an immediate login.
- Show password dots like normal websites.
- Show progress only after login/config action starts.
- Support remember password and auto login behavior without confusing checkboxes.
- Avoid scrollbars on the compact login screen unless absolutely necessary.

## 7. Dashboard UI Contract

Overview:

- Summary cards and metric cards must look clickable when clickable.
- Public entry card copies URL to clipboard and gives feedback.
- Service count click jumps to service management.
- Health check click jumps to health check.

Service management:

- Cloud service cards use consistent rounded card layout.
- Start/stop controls use smooth toggle-style switches where applicable.
- Ingest mode switch has progress feedback.
- Video preview panel uses fixed aspect ratio based on actual video metadata.
- Control monitor keyboard uses lamps and key glow states.
- Control monitor key labels use the Optima font stack: `Optima, "Optima nova", Candara, "Segoe UI", sans-serif`.
- Control monitor keyboard should always show at least `Q W E R`, `A S D F`, and `Z X C V`, then reveal more right-side columns as width allows, in column order such as `T/G/B`, `Y/H/N`, then farther-right keys.
- Control monitor keyboard must never horizontally clip partially visible keys; if a full extra column does not fit, hide that extra column and keep the baseline 12 keys visible.
- Control monitor responsive fitting must use the actually visible/clipped width of the keyboard area before revealing extra columns so zoomed layouts and clipped right-side panels do not expose edge keys.
- Control monitor keyboard rows should sit inside one centered keyboard track; do not independently center each row, because that can make standard keyboard offsets look crooked.
- Control monitor keyboard rows should keep normal keyboard half-key row offsets instead of full-grid shifts or stretched rows.
- Control monitor keycaps must remain square with stable dimensions across zoomed and narrow layouts.
- Control monitor link lamps should use a compact three-column horizontal layout when shown above the keyboard.
- Active control monitor keys may glow or lift, but must not scale larger than inactive keys.

Local stream:

- The local stream page is a UI-owned surface around the local publisher controls; do not change video ingest protocol behavior from this lane.
- The five signal cards should use themed soft panels, not flat gray boxes.
- When all five local stream signals are live, the celebratory effect must stay clipped inside the local stream panel and never paint outside its parent window.
- Local stream select menus should use the custom themed dropdown style, not the browser default dropdown.
- Local stream visible error banners should show a concise user-facing summary; detailed FFmpeg stderr belongs in the selectable push log.
- The push log should have a title, match the activity-log console style, and allow text selection/copy.

Health:

- Port checks are manual, not continuous.
- Buttons must not wrap.
- Port lamps should be clear without excessive text.

Activity:

- Log output should match theme.
- Activity view now has two log panels: `本地调试日志` first, then `本地后端日志`.
- Both activity log consoles should be tall enough to show multi-step flows and allow text selection/copy.
- One-click configuration, dashboard refresh, sidebar refresh, start-all, and stop-all flows should jump to the Activity view and write readable local debug steps.
- Successful setup/start/stop/check steps should render green; failed steps should render red.
- Internal drift labels such as `www` must not be shown raw to users; use `云端网页资源` for that cloud web-resource drift.
- Avoid duplicated connection snapshot sections.

Games:

- Game selection should stay clean.
- Tank Trouble UI must not drift from global visual style.
- Game canvas visual style is owned by Tank Trouble Agent, but surrounding panel/layout is UI-owned.

## 8. Theme And Accessibility Rules

Every new UI element must be tested in:

- Light mode.
- Dark mode.
- Minimum default window size.
- Resized wider window.
- Zoomed or narrow windows where fixed side panels could otherwise clip content.

Avoid:

- Unreadable low-contrast text.
- Bright assets that disappear in dark mode.
- Dark-only hover effects.
- Tiny click targets.
- Wrapped button text.
- Scrollbars pressed too close to panel edges.
- Horizontal overflow that hides controls during app zoom or narrow-window use.

## 9. Validation

Recommended checks:

```powershell
cmd /c npm --prefix frontend run build
```

Manual checks:

- Login page light/dark.
- Overview hover/click effects.
- Services page with video and control panels.
- Health page button wrapping.
- Activity log theme.
- Games page before and during Tank Trouble.

## 10. Documentation Update Rule

After every UI change:

- Update this file.
- Update `frontend\IMPLEMENTATION_LOG.md`.
- Update `docs\SHARED_AGENT_STATUS.md` with the UI Design Agent name, changed files, UI impact, cloud impact, validation, and whether any build/release action was performed.
- If the UI contract changes for other agents, update `docs\AGENT_HANDOFF_MASTER_INDEX.md`.

Shared status read rule:

- Do not read `docs\SHARED_AGENT_STATUS.md` before every operation unless the user asks, the UI task depends on fresh cross-agent state, or an apparent conflict needs investigation.
- Always write the completed UI change or documentation-only milestone to `docs\SHARED_AGENT_STATUS.md` after the work is done.

## 11. Recent UI Agent Notes

- 2026-11-05: reproduced black model-card hover with Dark Reader 4.9.134. Its generated CSS replaced the transparent reflection overlay with an opaque background. Model-card lighting now paints behind images; keep hover decoration out of a full-card foreground layer. The real-thumbnail extension regression is in `scripts/verify_model_card_hover.py`; existing layout/tilt/carousel checks use the new background lighting.

- 2026-11-05: replaced the login and sidebar brand images, browser favicon, touch icon and Windows icon resources with the user-supplied image. `scripts/make_icon.py` now generates all variants from `src-tauri/icons/source.jpg`. Web image imports use hashed assets; the favicon has an explicit cache version. Frontend build and light/dark/mobile checks passed, and the hosted page was verified after a static-only deployment. No service restart, desktop installer build, version bump or GitHub release was performed.

- 2026-05-13 10:54: updated the activity/logging UX contract for two log panels (`本地调试日志` above `本地后端日志`), selectable themed logs, green success/red error log levels, local stream panel/dropdown polish, constrained all-live effects, and concise local-stream error banners; built EXEs only and copied them to `E:\Cloud-Service-Console`, with no installer, GitHub push, or tag update.
- 2026-05-07 11:02: added a login saved-account dropdown on the host field and auto-fill for previously successful server logins; keeps the existing remember-password and auto-login behavior intact.
- 2026-05-05 16:18: rebuilt the control monitor keyboard around a single centered track, calculates fitting from the actually visible/clipped width, removes empty trailing row columns, and built `0.3.60`; latest copied installer is `E:\Cloud-Service-Console\Cloud Service Console_0.3.60_x64-setup.exe`.
- 2026-05-05 15:53: added a stronger responsive reserve and smaller narrow keycap minimum so extra columns hide earlier instead of clipping; built `0.3.59`, latest copied installer is `E:\Cloud-Service-Console\Cloud Service Console_0.3.59_x64-setup.exe`.
- 2026-05-05 15:44: tightened responsive keyboard column fitting so extra keys hide before clipping at the right edge; built `0.3.58`, latest copied installer is `E:\Cloud-Service-Console\Cloud Service Console_0.3.58_x64-setup.exe`.
- 2026-05-05 15:27: changed the control monitor keyboard to center itself and reveal right-side keys responsively (`T/G/B`, then `Y/H/N`, etc.); restored the three link lamps to horizontal layout and built `0.3.57`.
- 2026-05-05 15:11: corrected the control monitor keyboard to standard half-key offsets, square keycaps, and vertically stacked link lamps; built `0.3.56`, latest copied installer is `E:\Cloud-Service-Console\Cloud Service Console_0.3.56_x64-setup.exe`.
- 2026-05-05 14:58: reduced the control monitor keyboard to `QWER / ASDF / ZXCV` and aligned rows with normal keyboard offsets.
- 2026-05-05 14:51: added three compact control monitor link lamps for frontend dialing, backend listening, and direct connection state; built `0.3.54`, latest copied installer is `E:\Cloud-Service-Console\Cloud Service Console_0.3.54_x64-setup.exe`.
- 2026-05-05 14:33: refined the control monitor keyboard to an 8-column normal-keyboard layout with equal-width letter keys; built `0.3.53`, latest copied installer is `E:\Cloud-Service-Console\Cloud Service Console_0.3.53_x64-setup.exe`.
- 2026-05-05 14:22: built `0.3.52` installer after the control monitor keyboard responsive UI fix; superseded by `0.3.53`.
- 2026-05-05 14:15: control monitor keycaps use Optima, keyboard rows shrink within the panel, and the outer app shell clips horizontal paint overflow for zoomed/narrow windows.
