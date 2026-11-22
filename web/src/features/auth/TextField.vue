<script setup lang="ts">
import { nextTick, ref, useId } from 'vue';

const props = defineProps<{
  label: string;
  modelValue: string;
  error?: string;
  type?: string;
  autocomplete?: string;
  placeholder?: string;
  inputmode?: 'text' | 'email' | 'tel' | 'numeric';
  maxlength?: number;
  hasSuffix?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  input: [event: Event];
  blur: [];
}>();

const id = useId();
const input = ref<HTMLInputElement | null>(null);

function onInput(event: Event) {
  emit('input', event);
  emit('update:modelValue', (event.target as HTMLInputElement).value);
  // Поле управляемое: если родитель изменил или отклонил значение (маска), возвращаем его в DOM
  void nextTick(() => {
    if (input.value && input.value.value !== props.modelValue) input.value.value = props.modelValue;
  });
}
</script>

<template>
  <div class="field">
    <label class="field__label" :for="id">{{ label }}</label>
    <div class="field__box">
      <input
        :id="id"
        ref="input"
        class="field__input"
        :class="{ 'field__input--with-suffix': hasSuffix }"
        :type="type ?? 'text'"
        :value="modelValue"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :aria-invalid="error ? 'true' : 'false'"
        :aria-describedby="error ? `${id}-error` : undefined"
        @input="onInput"
        @blur="emit('blur')"
      />
      <div v-if="$slots.suffix" class="field__suffix"><slot name="suffix" /></div>
    </div>
    <p v-if="error" :id="`${id}-error`" class="field__error" role="alert">{{ error }}</p>
  </div>
</template>
