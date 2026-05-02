import { useEffect, useState } from "react";

export type AppUpdaterState = {
  supported: boolean;
  checking: boolean;
  available: boolean;
  installing: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  releaseNotes: string;
  message: string;
  error: string;
};

const initialUpdaterState: AppUpdaterState = {
  supported: false,
  checking: false,
  available: false,
  installing: false,
  currentVersion: "",
  latestVersion: "",
  releaseDate: "",
  releaseNotes: "",
  message: "",
  error: "",
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_IPC__" in window;
}

export function useAppUpdater() {
  const [updater, setUpdater] = useState<AppUpdaterState>(initialUpdaterState);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let alive = true;
    let unlisten: (() => void) | null = null;

    async function bootstrap() {
      try {
        const [{ getVersion }, updaterApi] = await Promise.all([
          import("@tauri-apps/api/app"),
          import("@tauri-apps/api/updater"),
        ]);

        const currentVersion = await getVersion();
        if (!alive) {
          return;
        }

        setUpdater((current) => ({
          ...current,
          supported: true,
          checking: true,
          currentVersion,
          error: "",
        }));

        unlisten = await updaterApi.onUpdaterEvent((event) => {
          if (!alive) {
            return;
          }

          if (event.error) {
            setUpdater((current) => ({
              ...current,
              checking: false,
              installing: false,
              available: true,
              message: "更新安装失败",
              error: String(event.error),
            }));
            return;
          }

          if (event.status === "PENDING") {
            setUpdater((current) => ({
              ...current,
              installing: true,
              message: current.latestVersion ? `正在安装 v${current.latestVersion}` : "正在安装更新",
              error: "",
            }));
            return;
          }

          if (event.status === "DONE") {
            setUpdater((current) => ({
              ...current,
              checking: false,
              installing: false,
              available: false,
              message: "更新已安装，正在重启",
              error: "",
            }));
          }
        });

        const result = await updaterApi.checkUpdate();
        if (!alive) {
          return;
        }

        if (result.shouldUpdate && result.manifest) {
          setUpdater({
            supported: true,
            checking: false,
            available: true,
            installing: false,
            currentVersion,
            latestVersion: result.manifest.version,
            releaseDate: result.manifest.date || "",
            releaseNotes: result.manifest.body || "",
            message: `发现新版本 v${result.manifest.version}`,
            error: "",
          });
          return;
        }

        setUpdater({
          supported: true,
          checking: false,
          available: false,
          installing: false,
          currentVersion,
          latestVersion: "",
          releaseDate: "",
          releaseNotes: "",
          message: "",
          error: "",
        });
      } catch (error) {
        if (!alive) {
          return;
        }

        setUpdater((current) => ({
          ...current,
          supported: true,
          checking: false,
          installing: false,
          error: error instanceof Error ? error.message : "更新检查失败",
        }));
      }
    }

    void bootstrap();

    return () => {
      alive = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  async function installUpdate() {
    if (!isTauriRuntime()) {
      return;
    }

    let shouldInstall = false;
    setUpdater((current) => {
      if (!current.available || current.installing) {
        return current;
      }

      shouldInstall = true;
      return {
        ...current,
        installing: true,
        error: "",
        message: current.latestVersion ? `正在安装 v${current.latestVersion}` : "正在安装更新",
      };
    });

    if (!shouldInstall) {
      return;
    }

    try {
      const updaterApi = await import("@tauri-apps/api/updater");
      await updaterApi.installUpdate();
      setUpdater((current) => ({
        ...current,
        installing: false,
        available: false,
        message: "更新已安装，正在重启",
        error: "",
      }));
    } catch (error) {
      setUpdater((current) => ({
        ...current,
        installing: false,
        available: true,
        message: "更新安装失败",
        error: error instanceof Error ? error.message : "更新安装失败",
      }));
    }
  }

  return { updater, installUpdate };
}
