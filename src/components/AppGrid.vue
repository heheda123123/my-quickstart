<script setup lang="ts">
import { computed, onUnmounted, reactive } from "vue";
import type { AppEntry } from "../launcher/types";
import { t } from "../launcher/i18n";

type Props = {
  apps: AppEntry[];
  dragEnabled?: boolean;
  draggingAppId?: string | null;
  dropBeforeAppId?: string | null;
  dropEnd?: boolean;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "launch", entry: AppEntry): void;
  (e: "contextmenuBlank", ev: MouseEvent): void;
  (e: "contextmenuApp", ev: MouseEvent, id: string): void;
  (e: "dblclickBlank"): void;
  (e: "mouseDownApp", ev: MouseEvent, id: string): void;
  (e: "externalDragOverBlank", ev: DragEvent): void;
  (e: "externalDragOverApp", ev: DragEvent, id: string): void;
  (e: "externalDrop", ev: DragEvent): void;
}>();

type RenderItem =
  | { kind: "placeholder"; key: string }
  | { kind: "app"; key: string; app: AppEntry };

const ghost = reactive<{
  active: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  app: AppEntry | null;
}>({
  active: false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  app: null,
});

function onGhostMove(ev: MouseEvent): void {
  const dx = ev.clientX - ghost.startX;
  const dy = ev.clientY - ghost.startY;
  if (!ghost.active && dx * dx + dy * dy >= 16) ghost.active = true;
  ghost.x = ev.clientX;
  ghost.y = ev.clientY;
}

function onGhostUp(): void {
  ghost.active = false;
  ghost.app = null;
  window.removeEventListener("mousemove", onGhostMove, true);
  window.removeEventListener("mouseup", onGhostUp, true);
}

function onMouseDownApp(ev: MouseEvent, id: string): void {
  if (props.dragEnabled === false) return;
  const entry = props.apps.find((a) => a.id === id) ?? null;
  ghost.startX = ev.clientX;
  ghost.startY = ev.clientY;
  ghost.x = ev.clientX;
  ghost.y = ev.clientY;
  ghost.app = entry;
  ghost.active = false;
  window.addEventListener("mousemove", onGhostMove, true);
  window.addEventListener("mouseup", onGhostUp, true);
  emit("mouseDownApp", ev, id);
}

onUnmounted(() => {
  onGhostUp();
});

const renderItems = computed<RenderItem[]>(() => {
  const draggingId = props.draggingAppId ?? null;
  const items: RenderItem[] = [];
  if (!draggingId) {
    for (const app of props.apps) items.push({ kind: "app", key: app.id, app });
    return items;
  }

  const apps = props.apps.filter((a) => a.id !== draggingId);
  const hasTarget = !!props.dropBeforeAppId || !!props.dropEnd;
  let insertAt = apps.length;
  if (hasTarget && props.dropBeforeAppId) {
    const idx = apps.findIndex((a) => a.id === props.dropBeforeAppId);
    if (idx >= 0) insertAt = idx;
  } else if (hasTarget && props.dropEnd) {
    insertAt = apps.length;
  }

  const bounded = Math.max(0, Math.min(apps.length, insertAt));
  for (let i = 0; i < apps.length; i++) {
    if (hasTarget && i === bounded) items.push({ kind: "placeholder", key: "__placeholder__" });
    const app = apps[i]!;
    items.push({ kind: "app", key: app.id, app });
  }
  if (hasTarget && bounded === apps.length) items.push({ kind: "placeholder", key: "__placeholder__" });
  return items;
});

function onDblClick(ev: MouseEvent): void {
  const target = ev.target as HTMLElement | null;
  if (target?.closest(".card")) return;
  ev.preventDefault();
  window.getSelection()?.removeAllRanges();
  emit("dblclickBlank");
}
</script>

<template>
  <main class="main">
    <div
      class="grid"
      @contextmenu.stop="(e) => emit('contextmenuBlank', e)"
      @dblclick.stop="onDblClick"
      @dragover="(e) => emit('externalDragOverBlank', e)"
      @drop.stop="(e) => emit('externalDrop', e)"
    >
      <div
        v-for="item in renderItems"
        :key="item.key"
      >
        <div v-if="item.kind === 'placeholder'" class="cardPlaceholder" aria-hidden="true" />
        <div
          v-else
          class="card"
          :class="{
            'card--dropBefore': !!props.dropBeforeAppId && item.app.id === props.dropBeforeAppId,
          }"
          role="button"
          tabindex="0"
          :data-app-id="item.app.id"
          @click="emit('launch', item.app)"
          @keydown.enter.prevent="emit('launch', item.app)"
          @keydown.space.prevent="emit('launch', item.app)"
          @contextmenu.stop="(e) => emit('contextmenuApp', e, item.app.id)"
          @mousedown.stop="(e) => onMouseDownApp(e, item.app.id)"
          @dragover="(e) => emit('externalDragOverApp', e, item.app.id)"
          @drop.stop="(e) => emit('externalDrop', e)"
        >
          <div class="card__icon" :class="{ 'card__icon--img': !!item.app.icon }" aria-hidden="true">
            <img v-if="item.app.icon" class="card__iconImg" :src="item.app.icon" alt="" draggable="false" />
            <template v-else>{{ item.app.name.slice(0, 1).toUpperCase() }}</template>
          </div>
          <div class="card__name" :title="item.app.name">{{ item.app.name }}</div>
        </div>
      </div>

      <div v-if="props.dropEnd" class="grid__dropEnd" aria-hidden="true" />

      <div v-if="apps.length === 0" class="empty">
        <div class="empty__title">{{ t("empty.title") }}</div>
        <div class="empty__hint">{{ t("empty.hint") }}</div>
      </div>
    </div>

    <div
      v-if="ghost.app && ghost.active"
      class="dragGhost"
      :style="{ left: `${ghost.x}px`, top: `${ghost.y}px` }"
      aria-hidden="true"
    >
      <div class="card card--dragging dragGhost__card">
        <div class="card__icon" :class="{ 'card__icon--img': !!ghost.app.icon }">
          <img v-if="ghost.app.icon" class="card__iconImg" :src="ghost.app.icon" alt="" draggable="false" />
          <template v-else>{{ ghost.app.name.slice(0, 1).toUpperCase() }}</template>
        </div>
        <div class="card__name">{{ ghost.app.name }}</div>
      </div>
    </div>
  </main>
</template>
