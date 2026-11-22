<script setup lang="ts">
import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

// Сессия сброшена (например, сервер отказал по токену) на защищённом экране — открываем вход
watch(
  () => session.session,
  (value) => {
    if (!value && route.meta.requiresAuth) {
      void router.replace({ name: 'login', query: { next: route.fullPath } });
    }
  },
);
</script>

<template>
  <RouterView />
</template>
