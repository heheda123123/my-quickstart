<script setup lang="ts">
import { ref, watch } from "vue";

type Props = {
  open: boolean;
  cardSize: number;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "updateCardSize", value: number): void;
}>();

const cardSize = ref(120);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    cardSize.value = props.cardSize;
  },
  { immediate: true },
);

function onInput(ev: Event): void {
  const raw = (ev.target as HTMLInputElement).value;
  const next = Number(raw);
  if (!Number.isFinite(next)) return;
  cardSize.value = next;
  emit("updateCardSize", next);
}
</script>

<template>
  <div v-if="open" class="modal" @click.self="emit('close')">
    <div class="modal__panel" @click.stop>
      <div class="modal__title">Settings</div>

      <label class="field">
        <div class="field__label">Card size</div>
        <input
          class="field__input field__input--range"
          type="range"
          min="90"
          max="200"
          step="2"
          :value="cardSize"
          @input="onInput"
        />
        <div class="field__hint">{{ cardSize }}px</div>
      </label>

      <div class="modal__actions">
        <button class="btn btn--primary" type="button" @click="emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

