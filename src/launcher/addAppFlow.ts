import { ref } from "vue";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { AppEntry, Group } from "./types";
import { addAppsToGroup, createId } from "./utils";

export type UwpAppInfo = { name: string; appId: string };

export const UWP_PREFIX = "uwp:";

export function isUwpPath(path: string): boolean {
  return path.trim().toLowerCase().startsWith(UWP_PREFIX);
}

export function createAddAppFlow(opts: {
  tauriRuntime: boolean;
  getActiveGroup: () => Group | undefined;
  showToast: (message: string) => void;
  hydrateEntryIcons: (entries: AppEntry[]) => Promise<void>;
  scheduleSave: () => void;
}) {
  const open = ref(false);

  function openAddApp(): void {
    open.value = true;
  }

  function closeAddApp(): void {
    open.value = false;
  }

  function addPathsToActiveGroup(paths: string[]): void {
    const group = opts.getActiveGroup();
    if (!group) return;
    const added = addAppsToGroup(group, paths);
    if (added.length > 0) {
      opts.showToast(`Added ${added.length} item(s)`);
      opts.hydrateEntryIcons(added);
      opts.scheduleSave();
    }
  }

  async function pickAndAddDesktopApps(): Promise<void> {
    if (!opts.tauriRuntime) {
      opts.showToast("This action requires the Tauri runtime");
      return;
    }
    const selection = await openDialog({
      multiple: true,
      directory: false,
      title: "Add application",
    });
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    addPathsToActiveGroup(paths);
  }

  function addUwpToActiveGroup(app: UwpAppInfo): void {
    const group = opts.getActiveGroup();
    if (!group) return;
    const aumid = app.appId.trim();
    const name = app.name.trim();
    if (!aumid || !name) return;
    const uwpPath = `${UWP_PREFIX}${aumid}`;
    if (group.apps.some((x) => x.path === uwpPath)) return;
    const entry: AppEntry = {
      id: createId(),
      name,
      path: uwpPath,
      args: "",
      icon: undefined,
      addedAt: Date.now(),
    };
    group.apps.unshift(entry);
    opts.showToast("Added 1 item(s)");
    opts.scheduleSave();
  }

  return {
    addAppOpen: open,
    openAddApp,
    closeAddApp,
    pickAndAddDesktopApps,
    addPathsToActiveGroup,
    addUwpToActiveGroup,
  };
}
