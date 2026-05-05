# UI Design Agent Handoff

Last updated: 2026-05-05

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
- Text should not be selectable unless it is an input, textarea, code, URL, or explicitly useful copyable text.
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

Health:

- Port checks are manual, not continuous.
- Buttons must not wrap.
- Port lamps should be clear without excessive text.

Activity:

- Log output should match theme.
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

Avoid:

- Unreadable low-contrast text.
- Bright assets that disappear in dark mode.
- Dark-only hover effects.
- Tiny click targets.
- Wrapped button text.
- Scrollbars pressed too close to panel edges.

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
- If the UI contract changes for other agents, update `docs\AGENT_HANDOFF_MASTER_INDEX.md`.
