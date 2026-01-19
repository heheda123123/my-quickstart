<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { loadState, saveState } from "./launcher/storage";
import type { AppEntry, Group, LauncherState } from "./launcher/types";
import {
  addAppsToGroup,
  createId,
  normalizeDroppedPaths,
  parseArgs,
} from "./launcher/utils";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const state = reactive<LauncherState>(loadState());
const search = ref("");
const dragActive = ref(false);
const toast = ref<string | null>(null);

const activeGroup = computed<Group | undefined>(() =>
  state.groups.find((g) => g.id === state.activeGroupId),
);

const filteredApps = computed<AppEntry[]>(() => {
  const group = activeGroup.value;
  if (!group) return [];
  const q = search.value.trim().toLowerCase();
  if (!q) return group.apps;
  return group.apps.filter((a) => a.name.toLowerCase().includes(q));
});

watch(
  state,
  () => {
    const plain = JSON.parse(JSON.stringify(state)) as LauncherState;
    saveState(plain);
  },
  { deep: true },
);

function showToast(message: string): void {
  toast.value = message;
  window.setTimeout(() => {
    if (toast.value === message) toast.value = null;
  }, 2000);
}

function setActiveGroup(id: string): void {
  state.activeGroupId = id;
}

function addGroup(name?: string): void {
  const nextName =
    name?.trim() ||
    `Group-${state.groups.filter((g) => g.name.startsWith("Group-")).length + 1}`;
  const group: Group = { id: createId(), name: nextName, apps: [] };
  state.groups.push(group);
  state.activeGroupId = group.id;
}

function renameGroup(group: Group): void {
  const next = window.prompt("Group name", group.name);
  if (!next) return;
  group.name = next.trim() || group.name;
}

function removeGroup(group: Group): void {
  if (state.groups.length <= 1) return;
  const ok = window.confirm(`Remove group "${group.name}"?`);
  if (!ok) return;
  const idx = state.groups.findIndex((g) => g.id === group.id);
  if (idx >= 0) state.groups.splice(idx, 1);
  if (state.activeGroupId === group.id) {
    state.activeGroupId = state.groups[0]?.id ?? state.activeGroupId;
  }
}

function addPathsToActiveGroup(paths: string[]): void {
  const group = activeGroup.value;
  if (!group) return;
  const added = addAppsToGroup(group, paths);
  if (added > 0) showToast(`Added ${added} item(s)`);
}

async function pickAndAddApps(): Promise<void> {
  if (!isTauriRuntime()) {
    showToast("This action requires the Tauri runtime");
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

async function launch(entry: AppEntry): Promise<void> {
  if (!isTauriRuntime()) {
    showToast("This action requires the Tauri runtime");
    return;
  }
  try {
    const argText = (entry.args ?? "").trim();
    if (!argText) {
      await openPath(entry.path);
      return;
    }
    await invoke("spawn_app", { path: entry.path, args: parseArgs(argText) });
  } catch (e) {
    const details =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : (() => {
              try {
                return JSON.stringify(e);
              } catch {
                return String(e);
              }
            })();
    showToast(
      `Failed to open: ${details || "unknown error"}`,
    );
  }
}

type MenuKind = "blank" | "app" | "group";
const menu = reactive<{
  open: boolean;
  kind: MenuKind;
  x: number;
  y: number;
  targetId?: string;
}>({
  open: false,
  kind: "blank",
  x: 0,
  y: 0,
  targetId: undefined,
});

function closeMenu(): void {
  menu.open = false;
}

function openMenu(
  kind: MenuKind,
  ev: MouseEvent,
  targetId?: string,
): void {
  ev.preventDefault();
  menu.open = true;
  menu.kind = kind;
  menu.x = ev.clientX;
  menu.y = ev.clientY;
  menu.targetId = targetId;
}

function removeApp(entry: AppEntry): void {
  const group = activeGroup.value;
  if (!group) return;
  const ok = window.confirm(`Remove "${entry.name}"?`);
  if (!ok) return;
  const idx = group.apps.findIndex((a) => a.id === entry.id);
  if (idx >= 0) group.apps.splice(idx, 1);
}

const editor = reactive<{
  open: boolean;
  entryId: string | null;
  name: string;
  path: string;
  args: string;
}>({
  open: false,
  entryId: null,
  name: "",
  path: "",
  args: "",
});

function openEditor(entry: AppEntry): void {
  editor.open = true;
  editor.entryId = entry.id;
  editor.name = entry.name;
  editor.path = entry.path;
  editor.args = entry.args ?? "";
}

function closeEditor(): void {
  editor.open = false;
  editor.entryId = null;
}

function saveEditor(): void {
  const group = activeGroup.value;
  if (!group || !editor.entryId) return;
  const entry = group.apps.find((a) => a.id === editor.entryId);
  if (!entry) return;
  entry.name = editor.name.trim() || entry.name;
  entry.path = editor.path.trim() || entry.path;
  entry.args = editor.args;
  closeEditor();
}

let unlistenFns: UnlistenFn[] = [];

onMounted(async () => {
  window.addEventListener("click", closeMenu);
  window.addEventListener("blur", closeMenu);

  if (!isTauriRuntime()) return;

  const drop = async (payload: unknown) => {
    dragActive.value = false;
    addPathsToActiveGroup(normalizeDroppedPaths(payload));
  };
  const hover = async () => {
    dragActive.value = true;
  };
  const cancel = async () => {
    dragActive.value = false;
  };

  const listeners: Array<Promise<UnlistenFn>> = [
    listen("tauri://file-drop", (e) => drop(e.payload)),
    listen("tauri://file-drop-hover", () => hover()),
    listen("tauri://file-drop-cancelled", () => cancel()),
    listen("tauri://drag-drop", (e) => drop(e.payload)),
    listen("tauri://drag-enter", () => hover()),
    listen("tauri://drag-leave", () => cancel()),
  ];

  unlistenFns = await Promise.allSettled(listeners).then((results) =>
    results
      .filter((r): r is PromiseFulfilledResult<UnlistenFn> => r.status === "fulfilled")
      .map((r) => r.value),
  );
});

onUnmounted(() => {
  window.removeEventListener("click", closeMenu);
  window.removeEventListener("blur", closeMenu);
  for (const unlisten of unlistenFns) unlisten();
  unlistenFns = [];
});
</script>

<template>
  <div class="app" @contextmenu="(e) => openMenu('blank', e)">
    <header class="topbar" data-tauri-drag-region>
      <div class="topbar__title">Quick Launcher</div>
      <div class="topbar__spacer" />
      <input v-model="search" class="topbar__search" placeholder="Search..." />
    </header>

    <div class="content">
      <aside class="sidebar">
        <div class="sidebar__groups">
          <button
            v-for="g in state.groups"
            :key="g.id"
            class="group"
            :class="{ 'group--active': g.id === state.activeGroupId }"
            type="button"
            @click="setActiveGroup(g.id)"
            @contextmenu.stop="(e) => openMenu('group', e, g.id)"
          >
            <span class="group__dot" />
            <span class="group__name" :title="g.name">{{ g.name }}</span>
          </button>
        </div>

        <button class="sidebar__add" type="button" @click="addGroup()">
          Add Group
        </button>
      </aside>

      <main class="main">
        <div class="main__header">
          <div class="main__title">{{ activeGroup?.name ?? "No group" }}</div>
          <button class="main__add" type="button" @click="pickAndAddApps()">
            Add App
          </button>
        </div>

        <div
          class="grid"
          @contextmenu.stop="(e) => openMenu('blank', e)"
        >
          <button
            v-for="a in filteredApps"
            :key="a.id"
            class="card"
            type="button"
            @click="launch(a)"
            @contextmenu.stop="(e) => openMenu('app', e, a.id)"
          >
            <div class="card__icon" aria-hidden="true">
              {{ a.name.slice(0, 1).toUpperCase() }}
            </div>
            <div class="card__name" :title="a.name">{{ a.name }}</div>
          </button>

          <div v-if="filteredApps.length === 0" class="empty">
            <div class="empty__title">No apps</div>
            <div class="empty__hint">
              Right click to add, or drop files into this window.
            </div>
          </div>
        </div>
      </main>
    </div>

    <div v-if="dragActive" class="dropOverlay">
      <div class="dropOverlay__box">Drop to add</div>
    </div>

    <div v-if="toast" class="toast" role="status">{{ toast }}</div>

    <div
      v-if="menu.open"
      class="menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <template v-if="menu.kind === 'blank'">
        <button class="menu__item" type="button" @click="pickAndAddApps().finally(closeMenu)">
          Add App...
        </button>
        <button class="menu__item" type="button" @click="addGroup(); closeMenu()">
          Add Group
        </button>
      </template>

      <template v-else-if="menu.kind === 'app'">
        <button
          class="menu__item"
          type="button"
          @click="
            (() => {
              const g = activeGroup;
              const a = g?.apps.find((x) => x.id === menu.targetId);
              if (a) launch(a);
              closeMenu();
            })()
          "
        >
          Open
        </button>
        <button
          class="menu__item"
          type="button"
          @click="
            (() => {
              const g = activeGroup;
              const a = g?.apps.find((x) => x.id === menu.targetId);
              if (a) openEditor(a);
              closeMenu();
            })()
          "
        >
          Edit...
        </button>
        <button
          class="menu__item menu__item--danger"
          type="button"
          @click="
            (() => {
              const g = activeGroup;
              const a = g?.apps.find((x) => x.id === menu.targetId);
              if (a) removeApp(a);
              closeMenu();
            })()
          "
        >
          Remove
        </button>
      </template>

      <template v-else-if="menu.kind === 'group'">
        <button
          class="menu__item"
          type="button"
          @click="
            (() => {
              const g = state.groups.find((x) => x.id === menu.targetId);
              if (g) renameGroup(g);
              closeMenu();
            })()
          "
        >
          Rename
        </button>
        <button
          class="menu__item menu__item--danger"
          type="button"
          @click="
            (() => {
              const g = state.groups.find((x) => x.id === menu.targetId);
              if (g) removeGroup(g);
              closeMenu();
            })()
          "
        >
          Remove Group
        </button>
      </template>
    </div>

    <div v-if="editor.open" class="modal" @click.self="closeEditor()">
      <div class="modal__panel" @click.stop>
        <div class="modal__title">Edit App</div>
        <label class="field">
          <div class="field__label">Name</div>
          <input v-model="editor.name" class="field__input" />
        </label>
        <label class="field">
          <div class="field__label">Path</div>
          <input v-model="editor.path" class="field__input" />
        </label>
        <label class="field">
          <div class="field__label">Args</div>
          <input v-model="editor.args" class="field__input" placeholder="--flag \"value with spaces\"" />
        </label>
        <div class="modal__actions">
          <button class="btn" type="button" @click="closeEditor()">Cancel</button>
          <button class="btn btn--primary" type="button" @click="saveEditor()">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #e9edf3;
  background: #0b0f14;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html,
body {
  height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
}

button,
input {
  font: inherit;
}
</style>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(900px 450px at 30% 20%, rgba(86, 135, 255, 0.16), transparent 55%),
    radial-gradient(700px 400px at 70% 10%, rgba(24, 200, 219, 0.14), transparent 50%),
    #0b0f14;
}

.topbar {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 10, 14, 0.8);
  backdrop-filter: blur(12px);
}

.topbar__title {
  font-weight: 600;
  letter-spacing: 0.2px;
  user-select: none;
  opacity: 0.95;
}

.topbar__spacer {
  flex: 1;
}

.topbar__search {
  width: min(420px, 40vw);
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  outline: none;
}

.topbar__search:focus {
  border-color: rgba(86, 135, 255, 0.6);
  box-shadow: 0 0 0 3px rgba(86, 135, 255, 0.2);
}

.content {
  min-height: 0;
  flex: 1;
  display: flex;
}

.sidebar {
  width: 180px;
  padding: 10px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 10, 14, 0.4);
}

.sidebar__groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  max-height: calc(100vh - 44px - 70px);
  padding-right: 4px;
}

.group {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.group:hover {
  background: rgba(255, 255, 255, 0.06);
}

.group--active {
  background: rgba(86, 135, 255, 0.16);
  border-color: rgba(86, 135, 255, 0.3);
}

.group__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(233, 237, 243, 0.6);
}

.group--active .group__dot {
  background: rgba(86, 135, 255, 0.9);
}

.group__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__add {
  width: 100%;
  margin-top: 10px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  cursor: pointer;
}

.sidebar__add:hover {
  background: rgba(255, 255, 255, 0.09);
}

.main {
  min-width: 0;
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.main__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.main__title {
  font-size: 15px;
  font-weight: 600;
  opacity: 0.96;
}

.main__add {
  margin-left: auto;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  cursor: pointer;
}

.main__add:hover {
  background: rgba(255, 255, 255, 0.09);
}

.grid {
  min-height: 0;
  flex: 1;
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  align-content: start;
  overflow: auto;
  padding: 2px;
}

.card {
  height: 96px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition:
    transform 120ms ease,
    background 120ms ease,
    border-color 120ms ease;
}

.card:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(86, 135, 255, 0.32);
}

.card:active {
  transform: translateY(0px) scale(0.99);
}

.card__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  background: linear-gradient(
    135deg,
    rgba(86, 135, 255, 0.9),
    rgba(24, 200, 219, 0.85)
  );
}

.card__name {
  max-width: 100%;
  padding: 0 10px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0.95;
}

.empty {
  grid-column: 1 / -1;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.03);
}

.empty__title {
  font-weight: 600;
  margin-bottom: 6px;
}

.empty__hint {
  opacity: 0.75;
}

.dropOverlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 8, 12, 0.6);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  pointer-events: none;
}

.dropOverlay__box {
  padding: 14px 18px;
  border-radius: 14px;
  border: 1px solid rgba(86, 135, 255, 0.5);
  background: rgba(86, 135, 255, 0.16);
  font-weight: 600;
}

.toast {
  position: fixed;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(8, 10, 14, 0.8);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}

.menu {
  position: fixed;
  z-index: 50;
  min-width: 180px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 14, 18, 0.92);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
  padding: 6px;
}

.menu__item {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.menu__item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.menu__item--danger {
  color: rgba(255, 120, 120, 0.95);
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgba(6, 8, 12, 0.6);
  backdrop-filter: blur(8px);
}

.modal__panel {
  width: min(560px, calc(100vw - 32px));
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 14, 18, 0.92);
  backdrop-filter: blur(14px);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modal__title {
  font-weight: 650;
  letter-spacing: 0.2px;
  padding: 4px 2px 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: 12px;
  opacity: 0.8;
}

.field__input {
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  outline: none;
}

.field__input:focus {
  border-color: rgba(86, 135, 255, 0.6);
  box-shadow: 0 0 0 3px rgba(86, 135, 255, 0.2);
}

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
}

.btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  cursor: pointer;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.09);
}

.btn--primary {
  border-color: rgba(86, 135, 255, 0.42);
  background: rgba(86, 135, 255, 0.18);
}

.btn--primary:hover {
  background: rgba(86, 135, 255, 0.24);
}
</style>
