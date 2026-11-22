<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import TextField from './TextField.vue';

defineProps<{
  label: string;
  modelValue: string;
  error?: string;
  autocomplete: 'current-password' | 'new-password';
  placeholder?: string;
}>();

defineEmits<{ 'update:modelValue': [value: string] }>();

const shown = ref(false);
</script>

<template>
  <TextField
    :label="label"
    :model-value="modelValue"
    :error="error"
    :type="shown ? 'text' : 'password'"
    :autocomplete="autocomplete"
    :placeholder="placeholder"
    has-suffix
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #suffix>
      <button
        type="button"
        class="icon-btn"
        :aria-label="shown ? 'Скрыть пароль' : 'Показать пароль'"
        @click="shown = !shown"
      >
        <Icon :name="shown ? 'eyeOff' : 'eye'" />
      </button>
    </template>
  </TextField>
</template>
