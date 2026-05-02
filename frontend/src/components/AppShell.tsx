import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import type { AppUpdaterState } from "../hooks/useAppUpdater";
import type { NetworkSnapshot } from "../types/cloud";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type ConsoleView = "overview" | "services" | "health" | "activity" | "games";

type AppShellProps = PropsWithChildren<{
  networkSnapshot: NetworkSnapshot;
  title: string;
  statusText: string;
  theme: "light" | "dark";
  updater: AppUpdaterState;
  activeView: ConsoleView;
  busy?: boolean;
  sidebarRefreshBusy?: boolean;
  setupBusy?: boolean;
  setupProgress?: number;
  setupMessage?: string;
  setupTone?: "idle" | "progress" | "success" | "error";
  scrollLocked?: boolean;
  onViewChange: (view: ConsoleView) => void;
  onRefresh: () => void;
  onInstallUpdate: () => void;
  onLocalSetup: () => void;
  onSidebarRefresh: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}>;

export function AppShell({
  networkSnapshot,
  title,
  statusText,
  theme,
  updater,
  activeView,
  busy = false,
  sidebarRefreshBusy = false,
  setupBusy = false,
  setupProgress = 0,
  setupMessage = "",
  setupTone = "idle",
  scrollLocked = false,
  onViewChange,
  onRefresh,
  onInstallUpdate,
  onLocalSetup,
  onSidebarRefresh,
  onToggleTheme,
  onLogout,
  children,
}: AppShellProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const [edgeFade, setEdgeFade] = useState({ top: false, bottom: false });

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    let frameId = 0;
    let active = false;
    let rect = shell.getBoundingClientRect();
    let currentX = rect.width * 0.52;
    let currentY = rect.height * 0.24;
    let targetX = currentX;
    let targetY = currentY;
    let energy = 0;

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const syncRect = () => {
      rect = shell.getBoundingClientRect();
      currentX = clamp(currentX, 0, rect.width);
      currentY = clamp(currentY, 0, rect.height);
      targetX = clamp(targetX, 0, rect.width);
      targetY = clamp(targetY, 0, rect.height);
    };

    const writeVars = () => {
      const ratioX = rect.width ? currentX / rect.width : 0.5;
      const ratioY = rect.height ? currentY / rect.height : 0.5;
      const shiftX = (ratioX - 0.5) * 120;
      const shiftY = (ratioY - 0.5) * 96;

      shell.style.setProperty("--cursor-x", `${currentX.toFixed(1)}px`);
      shell.style.setProperty("--cursor-y", `${currentY.toFixed(1)}px`);
      shell.style.setProperty("--cursor-rx", `${(ratioX * 100).toFixed(2)}%`);
      shell.style.setProperty("--cursor-ry", `${(ratioY * 100).toFixed(2)}%`);
      shell.style.setProperty("--cursor-shift-x", `${shiftX.toFixed(2)}px`);
      shell.style.setProperty("--cursor-shift-y", `${shiftY.toFixed(2)}px`);
      shell.style.setProperty("--cursor-tilt-x", `${((ratioX - 0.5) * 2).toFixed(3)}`);
      shell.style.setProperty("--cursor-tilt-y", `${((ratioY - 0.5) * 2).toFixed(3)}`);
      shell.style.setProperty("--cursor-active", active ? "1" : "0");
      shell.style.setProperty("--cursor-energy", energy.toFixed(3));
    };

    const tick = () => {
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      const drift = Math.hypot(dx, dy);

      currentX += dx * 0.14;
      currentY += dy * 0.14;
      energy = Math.max(active ? 0.18 : 0, energy * 0.9, Math.min(drift / 160, 1));

      writeVars();

      if (drift > 0.24 || energy > 0.025 || active) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        frameId = 0;
      }
    };

    const ensureTick = () => {
      if (!frameId) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    const updateTarget = (event: PointerEvent) => {
      targetX = clamp(event.clientX - rect.left, 0, rect.width);
      targetY = clamp(event.clientY - rect.top, 0, rect.height);
      active = true;
      ensureTick();
    };

    const handleEnter = (event: PointerEvent) => {
      syncRect();
      updateTarget(event);
    };

    const handleMove = (event: PointerEvent) => {
      updateTarget(event);
    };

    const handleLeave = () => {
      active = false;
      targetX = currentX;
      targetY = currentY;
      ensureTick();
    };

    const handleResize = () => {
      syncRect();
      writeVars();
    };

    writeVars();
    shell.addEventListener("pointerenter", handleEnter);
    shell.addEventListener("pointermove", handleMove);
    shell.addEventListener("pointerleave", handleLeave);
    window.addEventListener("resize", handleResize);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      shell.removeEventListener("pointerenter", handleEnter);
      shell.removeEventListener("pointermove", handleMove);
      shell.removeEventListener("pointerleave", handleLeave);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const scrollEl = contentScrollRef.current;
    if (!scrollEl || scrollLocked) {
      setEdgeFade({ top: false, bottom: false });
      return;
    }

    const syncFadeState = () => {
      const nextTop = scrollEl.scrollTop > 2;
      const nextBottom = scrollEl.scrollTop + scrollEl.clientHeight < scrollEl.scrollHeight - 2;
      setEdgeFade((current) => {
        if (current.top === nextTop && current.bottom === nextBottom) {
          return current;
        }
        return { top: nextTop, bottom: nextBottom };
      });
    };

    const frameId = window.requestAnimationFrame(syncFadeState);
    scrollEl.addEventListener("scroll", syncFadeState, { passive: true });
    window.addEventListener("resize", syncFadeState);

    return () => {
      window.cancelAnimationFrame(frameId);
      scrollEl.removeEventListener("scroll", syncFadeState);
      window.removeEventListener("resize", syncFadeState);
    };
  }, [activeView, children, scrollLocked]);

  return (
    <div ref={shellRef} className="app-shell app-shell-interactive">
      <Sidebar
        networkSnapshot={networkSnapshot}
        activeView={activeView}
        refreshBusy={sidebarRefreshBusy}
        onViewChange={onViewChange}
        onRefresh={onSidebarRefresh}
      />
      <main className="main-scroll">
        <Topbar
          title={title}
          statusText={statusText}
          theme={theme}
          updater={updater}
          busy={busy}
          setupBusy={setupBusy}
          setupProgress={setupProgress}
          setupMessage={setupMessage}
          setupTone={setupTone}
          onRefresh={onRefresh}
          onInstallUpdate={onInstallUpdate}
          onLocalSetup={onLocalSetup}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
        />
        <div className="content-fade-shell">
          <div
            ref={contentScrollRef}
            className={`content-scroll${scrollLocked ? " content-scroll-locked" : ""}${edgeFade.top ? " fade-top" : ""}${edgeFade.bottom ? " fade-bottom" : ""}`}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
