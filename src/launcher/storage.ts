import type { LauncherState } from "./types";
import { createDefaultState } from "./utils";

const STORAGE_KEY = "launcher_state_v1";

function isValidState(value: unknown): value is LauncherState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LauncherState>;
  if (v.version !== 1) return false;
  if (typeof v.activeGroupId !== "string") return false;
  if (!Array.isArray(v.groups)) return false;
    return v.groups.every((g) => {
      if (!g || typeof g !== "object") return false;
      const group = g as any;
      if (typeof group.id !== "string") return false;
      if (typeof group.name !== "string") return false;
      if (!Array.isArray(group.apps)) return false;
      return group.apps.every((a: any) => {
        if (!a || typeof a !== "object") return false;
        return (
          typeof a.id === "string" &&
          typeof a.name === "string" &&
          typeof a.path === "string" &&
          (typeof a.args === "undefined" || typeof a.args === "string") &&
          typeof a.addedAt === "number"
        );
      });
    });
}

export function loadState(): LauncherState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidState(parsed)) return createDefaultState();
    if (!parsed.groups.some((g) => g.id === parsed.activeGroupId)) {
      parsed.activeGroupId = parsed.groups[0]?.id ?? parsed.activeGroupId;
    }
    return parsed;
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: LauncherState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
