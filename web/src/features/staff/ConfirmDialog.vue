<script setup lang="ts">
import { ref } from 'vue';
import { useFocusTrap } from './focus';

defineProps<{
  title: string;
  text?: string;
  confirmLabel: string;
  /** Подпись кнопки отмены; по умолчанию «Отмена». */
  cancelLabel?: string;
  busy?: boolean;
  error?: string;
  /** Опасное действие: кнопка подтверждения светло-красная. */
  danger?: boolean;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const root = ref<HTMLElement | null>(null);
// Первый фокус — на «Отмена»: случайный Enter не подтвердит действие
useFocusTrap(root, () => emit('cancel'), '[data-cancel]');
</script>

<template>
  <div class="overlay overlay--center">
    <button class="overlay__shade" type="button" tabindex="-1" aria-label="Закрыть" @click="emit('cancel')" />
    <div ref="root" class="dialog" role="alertdialog" aria-modal="true" :aria-label="title">
      <h2 class="dialog__title">{{ title }}</h2>
      <p v-if="text" class="subtitle">{{ text }}</p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <div class="dialog__actions">
        <button
          class="btn"
          :class="danger ? 'btn--danger-soft' : ''"
          type="button"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
        <button class="btn btn--outline" type="button" data-cancel :disabled="busy" @click="emit('cancel')">
          {{ cancelLabel ?? 'Отмена' }}
        </button>
      </div>
    </div>
  </div>
</template>
