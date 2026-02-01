import { getCurrentWindow } from "@tauri-apps/api/window";
import { t } from "./i18n";

type Options = {
  tauriRuntime: boolean;
  showToast: (message: string) => void;
};

export function createWindowControls(options: Options) {
  const { tauriRuntime, showToast } = options;
  let pendingDrag:
    | {
        startX: number;
        startY: number;
      }
    | null = null;

  async function minimizeWindow(): Promise<void> {
    if (!tauriRuntime) return;
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      showToast(
        t("error.minimizeFailed", { error: e instanceof Error ? e.message : String(e) }),
      );
    }
  }

  async function toggleMaximizeWindow(): Promise<void> {
    if (!tauriRuntime) return;
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      showToast(
        t("error.maximizeFailed", { error: e instanceof Error ? e.message : String(e) }),
      );
    }
  }

  async function closeWindow(): Promise<void> {
    if (!tauriRuntime) return;
    try {
      await getCurrentWindow().close();
    } catch (e) {
      showToast(
        t("error.closeFailed", { error: e instanceof Error ? e.message : String(e) }),
      );
    }
  }

  async function startWindowDragging(ev: MouseEvent): Promise<void> {
    if (!tauriRuntime) return;
    if (ev.button !== 0) return;
    if (ev.detail > 1) return;
    const target = ev.target as HTMLElement | null;
    if (target?.closest("input, button, textarea, select, a")) return;
    pendingDrag = { startX: ev.clientX, startY: ev.clientY };
    window.addEventListener("mousemove", onDragMove, true);
    window.addEventListener("mouseup", stopPendingDrag, true);
    ev.preventDefault();
  }

  function stopPendingDrag(): void {
    pendingDrag = null;
    window.removeEventListener("mousemove", onDragMove, true);
    window.removeEventListener("mouseup", stopPendingDrag, true);
  }

  async function onDragMove(ev: MouseEvent): Promise<void> {
    if (!pendingDrag) return;
    const dx = ev.clientX - pendingDrag.startX;
    const dy = ev.clientY - pendingDrag.startY;
    if (dx * dx + dy * dy < 16) return;
    stopPendingDrag();
    try {
      await getCurrentWindow().startDragging();
    } catch (e) {
      showToast(
        t("error.dragFailed", { error: e instanceof Error ? e.message : String(e) }),
      );
    }
    ev.preventDefault();
  }

  async function setAlwaysOnTop(value: boolean): Promise<void> {
    if (!tauriRuntime) return;
    try {
      await getCurrentWindow().setAlwaysOnTop(value);
    } catch (e) {
      showToast(
        t("error.alwaysOnTopFailed", { error: e instanceof Error ? e.message : String(e) }),
      );
    }
  }

  return {
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
    startWindowDragging,
    setAlwaysOnTop,
  };
}
