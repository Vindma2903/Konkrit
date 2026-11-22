<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import { passwordRules } from './validators';

const props = defineProps<{ password: string; showFailures?: boolean }>();

const items = computed(() => {
  const rules = passwordRules(props.password);
  return [
    { text: 'Не короче 8 символов', ok: rules.length },
    { text: 'Заглавная и строчная буквы', ok: rules.letters },
    { text: 'Хотя бы одна цифра', ok: rules.digit },
  ];
});
</script>

<template>
  <ul class="rules" aria-label="Требования к паролю">
    <li v-for="item in items" :key="item.text" :data-ok="item.ok" :data-fail="!!showFailures && !item.ok">
      <Icon :name="item.ok ? 'check' : 'dot'" :size="16" />
      <span>{{ item.text }}</span>
      <span class="sr-only">{{ item.ok ? ': выполнено' : ': не выполнено' }}</span>
    </li>
  </ul>
</template>
