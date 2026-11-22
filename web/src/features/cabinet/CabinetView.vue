<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';

const session = useSessionStore();
const router = useRouter();

const roles = { dispatcher: 'Диспетчер', employee: 'Сотрудник УК', admin: 'Администратор УК' } as const;
const user = computed(() => session.session?.user);

const error = ref('');
const busy = ref(false);

async function logout() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await session.logout();
    await router.replace({ name: 'login' });
  } catch {
    error.value = 'Не удалось выйти. Проверьте соединение и повторите';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="cabinet">
    <h1 class="title">Кабинет сотрудника</h1>
    <p v-if="user" class="subtitle">{{ user.name }}, {{ roles[user.role] }}</p>
    <p class="subtitle">Рабочие экраны появятся в следующих версиях.</p>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <button class="btn btn--ghost" type="button" :disabled="busy" @click="logout">Выйти</button>
  </main>
</template>
