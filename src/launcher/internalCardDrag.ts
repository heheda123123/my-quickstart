import { reactive } from "vue";
import type { Group } from "./types";
import { moveAppByDragPayload } from "./cardDnd";
import { computeInsertTargetFromGrid } from "./domInsertTarget";
import { t } from "./i18n";

export type InternalCardDragState = {
  dragging: boolean;
  draggedAppId: string | null;
  dropBeforeAppId: string | null;
  dropEnd: boolean;
  dropGroupId: string | null;
};

export function createInternalCardDrag(opts: {
  groups: Group[];
  getActiveGroup: () => Group | undefined;
  scheduleSave: () => void;
  showToast: (message: string) => void;
}) {
  const state = reactive<InternalCardDragState>({
    dragging: false,
    draggedAppId: null,
    dropBeforeAppId: null,
    dropEnd: false,
    dropGroupId: null,
  });

  let pending:
    | {
        startX: number;
        startY: number;
        appId: string;
        fromGroupId: string;
      }
    | null = null;

  let suppressClickUntil = 0;

  function clearIndicators(): void {
    state.dropBeforeAppId = null;
    state.dropEnd = false;
    state.dropGroupId = null;
  }

  function stopDrag(): void {
    pending = null;
    state.dragging = false;
    state.draggedAppId = null;
    clearIndicators();
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("mouseup", onUp, true);
  }

  function isDraggingEnough(ev: MouseEvent): boolean {
    if (!pending) return false;
    const dx = ev.clientX - pending.startX;
    const dy = ev.clientY - pending.startY;
    return dx * dx + dy * dy >= 16;
  }

  function updateTargetFromPoint(x: number, y: number): void {
    const el = document.elementFromPoint(x, y);
    const groupEl = el?.closest?.("[data-group-id]") as HTMLElement | null;
    if (groupEl) {
      const groupId = groupEl.getAttribute("data-group-id");
      state.dropGroupId = groupId || null;
      state.dropBeforeAppId = null;
      state.dropEnd = false;
      return;
    }

    const gridEl = el?.closest?.(".grid") as HTMLElement | null;
    const active = opts.getActiveGroup();
    if (gridEl && active) {
      const computed = computeInsertTargetFromGrid({
        root: gridEl,
        x,
        y,
        excludeAppId: pending?.appId ?? null,
      });
      state.dropBeforeAppId = computed.beforeAppId;
      state.dropGroupId = null;
      state.dropEnd = computed.end;
      return;
    }

    state.dropBeforeAppId = null;
    state.dropGroupId = null;
    state.dropEnd = true;
  }

  function onMove(ev: MouseEvent): void {
    if (!pending) return;
    if (!state.dragging) {
      if (!isDraggingEnough(ev)) return;
      state.dragging = true;
      state.draggedAppId = pending.appId;
    }
    updateTargetFromPoint(ev.clientX, ev.clientY);
    ev.preventDefault();
  }

  function onUp(ev: MouseEvent): void {
    if (!pending) return;
    const active = opts.getActiveGroup();
    if (state.dragging && active) {
      let toGroupId = active.id;
      let toIndex = active.apps.length;

      if (state.dropGroupId) {
        toGroupId = state.dropGroupId;
        toIndex = 0;
      } else if (state.dropBeforeAppId) {
        const idx = active.apps.findIndex((a) => a.id === state.dropBeforeAppId);
        if (idx >= 0) toIndex = idx;
      }

      const moved = moveAppByDragPayload(
        opts.groups,
        { appId: pending.appId, fromGroupId: pending.fromGroupId },
        toGroupId,
        toIndex,
      );
      if (moved.moved) {
        opts.scheduleSave();
        if (moved.toGroupName && moved.toGroupName !== active.name) {
          opts.showToast(t("toast.movedToGroup", { group: moved.toGroupName }));
        }
      }
      suppressClickUntil = Date.now() + 250;
    }
    stopDrag();
    ev.preventDefault();
  }

  function onMouseDownApp(ev: MouseEvent, appId: string): void {
    if (ev.button !== 0) return;
    const group = opts.getActiveGroup();
    if (!group) return;
    pending = {
      startX: ev.clientX,
      startY: ev.clientY,
      appId,
      fromGroupId: group.id,
    };
    clearIndicators();
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    ev.preventDefault();
  }

  function shouldSuppressClick(): boolean {
    return Date.now() < suppressClickUntil;
  }

  return {
    state,
    onMouseDownApp,
    shouldSuppressClick,
    stopDrag,
  };
}
