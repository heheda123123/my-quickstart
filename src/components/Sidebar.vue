<script setup lang="ts">
import type { Group } from "../launcher/types";
import { t } from "../launcher/i18n";

type Props = {
  groups: Group[];
  activeGroupId: string;
  dropTargetGroupId?: string | null;
};

defineProps<Props>();

const emit = defineEmits<{
  (e: "selectGroup", id: string): void;
  (e: "contextmenuBlank", ev: MouseEvent): void;
  (e: "contextmenuGroup", ev: MouseEvent, id: string): void;
  (e: "openSettings"): void;
  (e: "externalDragOverGroup", ev: DragEvent, id: string): void;
  (e: "externalDrop", ev: DragEvent): void;
}>();
</script>

<template>
  <aside class="sidebar" @contextmenu.stop="(e) => emit('contextmenuBlank', e)">
    <div class="sidebar__groups">
      <button
        v-for="g in groups"
        :key="g.id"
        class="group"
        :class="{
          'group--active': g.id === activeGroupId,
          'group--dropTarget': !!dropTargetGroupId && g.id === dropTargetGroupId,
        }"
        type="button"
        :data-group-id="g.id"
        @click="emit('selectGroup', g.id)"
        @contextmenu.stop="(e) => emit('contextmenuGroup', e, g.id)"
        @dragover="(e) => emit('externalDragOverGroup', e, g.id)"
        @drop.stop="(e) => emit('externalDrop', e)"
      >
        <span class="group__dot" />
        <span class="group__name" :title="g.name">{{ g.name }}</span>
      </button>
    </div>

    <div class="sidebar__footer">
      <button
        class="sidebar__settings"
        type="button"
        @click="emit('openSettings')"
        @contextmenu.stop
      >
        {{ t("sidebar.settings") }}
      </button>
    </div>
  </aside>
</template>
