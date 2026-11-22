<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';

const session = useSessionStore();
const router = useRouter();

const roles = { dispatcher: 'Диспетчер', employee: 'Сотрудник УК', admin: 'Администратор УК' } as const;
const user = computed(() => session.session?.user);

async function logout() {
  await session.logout();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <main class="cabinet">
    <h1 class="title">Кабинет сотрудника</h1>
    <p v-if="user" class="subtitle">{{ user.name }}, {{ roles[user.role] }}</p>
    <p class="subtitle">Рабочие экраны появятся в следующих версиях.</p>
    <button class="btn btn--ghost" type="button" @click="logout">Выйти</button>
  </main>
</template>
