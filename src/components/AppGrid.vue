<script setup lang="ts">
import type { AppEntry } from "../launcher/types";

type Props = {
  apps: AppEntry[];
};

defineProps<Props>();

const emit = defineEmits<{
  (e: "launch", entry: AppEntry): void;
  (e: "contextmenuBlank", ev: MouseEvent): void;
  (e: "contextmenuApp", ev: MouseEvent, id: string): void;
  (e: "dblclickBlank"): void;
}>();

function onDblClick(ev: MouseEvent): void {
  const target = ev.target as HTMLElement | null;
  if (target?.closest(".card")) return;
  emit("dblclickBlank");
}
</script>

<template>
  <main class="main">
    <div
      class="grid"
      @contextmenu.stop="(e) => emit('contextmenuBlank', e)"
      @dblclick.stop="onDblClick"
    >
      <button
        v-for="a in apps"
        :key="a.id"
        class="card"
        type="button"
        @click="emit('launch', a)"
        @contextmenu.stop="(e) => emit('contextmenuApp', e, a.id)"
      >
        <div class="card__icon" :class="{ 'card__icon--img': !!a.icon }" aria-hidden="true">
          <img v-if="a.icon" class="card__iconImg" :src="a.icon" alt="" />
          <template v-else>{{ a.name.slice(0, 1).toUpperCase() }}</template>
        </div>
        <div class="card__name" :title="a.name">{{ a.name }}</div>
      </button>

      <div v-if="apps.length === 0" class="empty">
        <div class="empty__title">No apps</div>
        <div class="empty__hint">Right click to add, or drop files into this window.</div>
      </div>
    </div>
  </main>
</template>
