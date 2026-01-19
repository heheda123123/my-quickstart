<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";

type UwpAppInfo = { name: string; appId: string };

type Props = {
  open: boolean;
  tauriRuntime: boolean;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "addUwp", app: UwpAppInfo): void;
  (e: "addDesktop"): void;
}>();

const search = ref("");
const loading = ref(false);
const error = ref<string | null>(null);
const apps = ref<UwpAppInfo[]>([]);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return apps.value;
  return apps.value.filter((a) => a.name.toLowerCase().includes(q));
});

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    search.value = "";
    error.value = null;
    if (!props.tauriRuntime) {
      apps.value = [];
      error.value = "Tauri runtime required";
      return;
    }
    loading.value = true;
    try {
      const list = (await invoke("list_uwp_apps")) as unknown;
      apps.value = Array.isArray(list) ? (list as UwpAppInfo[]) : [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      apps.value = [];
    } finally {
      loading.value = false;
    }
  },
);
</script>

<template>
  <div v-if="open" class="modal" @click.self="emit('close')">
    <div class="modal__panel" @click.stop>
      <div class="modal__title">Add App</div>

      <div class="addApp__toolbar">
        <input v-model="search" class="field__input" placeholder="Search UWP apps..." />
        <button class="btn" type="button" @click="emit('addDesktop')">Add Desktop App...</button>
      </div>

      <div v-if="loading" class="addApp__hint">Loading...</div>
      <div v-else-if="error" class="addApp__hint addApp__hint--error">{{ error }}</div>
      <div v-else class="addApp__list" role="list">
        <button
          v-for="a in filtered"
          :key="a.appId"
          class="addApp__item"
          type="button"
          @click="emit('addUwp', a)"
        >
          <div class="addApp__name">{{ a.name }}</div>
          <div class="addApp__id">{{ a.appId }}</div>
        </button>

        <div v-if="filtered.length === 0" class="addApp__hint">No results</div>
      </div>

      <div class="modal__actions">
        <button class="btn btn--primary" type="button" @click="emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.addApp__toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.addApp__list {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.addApp__item {
  width: 100%;
  text-align: left;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface-input);
  color: inherit;
  cursor: pointer;
  padding: 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.addApp__item:hover {
  background: var(--surface-hover);
}

.addApp__name {
  font-weight: 600;
  line-height: 1.2;
}

.addApp__id {
  font-size: 12px;
  opacity: 0.7;
  word-break: break-all;
}

.addApp__hint {
  font-size: 12px;
  opacity: 0.75;
  padding: 6px 2px;
}

.addApp__hint--error {
  color: rgba(255, 120, 120, 0.95);
  opacity: 0.95;
}
</style>

