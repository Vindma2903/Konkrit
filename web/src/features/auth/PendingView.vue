<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flow';
import AuthLayout from './AuthLayout.vue';
import Icon from './Icon.vue';

const flow = useFlowStore();
const pending = computed(() => flow.pending);
</script>

<template>
  <AuthLayout>
    <div class="stack center">
      <div class="badge badge--amber"><Icon name="clock" :size="32" /></div>
      <h1 class="title">Ждём подтверждения</h1>
      <p v-if="pending && pending.company" class="subtitle">
        Заявка на доступ отправлена администратору «{{ pending.company }}». Когда он откроет доступ,
        мы пришлём письмо на {{ pending.email }}.
      </p>
      <p v-else class="subtitle">
        Заявка на доступ отправлена администратору. Когда он откроет доступ, мы пришлём письмо на вашу почту.
      </p>
    </div>
    <RouterLink class="btn" :to="{ name: 'login' }">Вернуться ко входу</RouterLink>
    <p v-if="pending && pending.adminEmail" class="hint">
      Долго нет ответа? Напишите администратору:
      <a class="link" :href="`mailto:${pending.adminEmail}`">{{ pending.adminEmail }}</a>.
    </p>
  </AuthLayout>
</template>
