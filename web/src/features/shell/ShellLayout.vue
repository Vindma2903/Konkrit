<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { roleTitle } from '@/api';
import Icon from '@/features/auth/Icon.vue';
import { useAccessStore } from '@/stores/access';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { pendingLabel } from '@/features/staff/format';
import NoAccess from './NoAccess.vue';
import { NAV } from './nav';

const POLL_MS = 30_000;

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const access = useAccessStore();
const toast = useToastStore();

const user = computed(() => session.session?.user);
const items = computed(() => NAV.filter((item) => !item.permission || session.can(item.permission)));
const canManageStaff = computed(() => session.can('staff.manage'));
const denied = computed(() => {
  const permission = route.meta.permission;
  return Boolean(permission) && !session.can(permission!);
});

function target(key: string) {
  if (key === 'requests') return { name: 'cabinet' };
  if (key === 'staff') return { name: 'staff' };
  return { name: 'section', params: { name: key } };
}

function isActive(key: string) {
  if (key === 'requests') return route.name === 'cabinet' || route.params.name === 'requests';
  if (key === 'staff') return String(route.name ?? '').startsWith('staff');
  return route.params.name === key;
}

// Заявки «приходят» администратору: число ожидающих обновляется раз в 30 секунд и при возврате на вкладку
let timer: ReturnType<typeof setInterval> | undefined;

function refreshAll() {
  void session.reload();
  if (canManageStaff.value) void access.refresh();
}

function onVisible() {
  if (document.visibilityState === 'visible') refreshAll();
}

function startPolling() {
  clearInterval(timer);
  if (!canManageStaff.value) return;
  void access.refresh();
  timer = setInterval(() => void access.refresh(), POLL_MS);
}

onMounted(() => {
  startPolling();
  document.addEventListener('visibilitychange', onVisible);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisible);
  access.reset();
  toast.clear();
});
watch(canManageStaff, startPolling);

const menuOpen = ref(false);
const logoutError = ref('');
const loggingOut = ref(false);

async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = '';
  try {
    await session.logout();
    await router.replace({ name: 'login' });
  } catch {
    logoutError.value = 'Не удалось выйти. Проверьте соединение и повторите';
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <div class="shell">
    <aside class="shell__side">
      <div class="logo shell__logo">
        <span class="logo__mark logo__mark--solid" aria-hidden="true">К</span>
        <span>Конкрит</span>
      </div>
      <nav class="shell__nav" aria-label="Разделы">
        <RouterLink
          v-for="item in items"
          :key="item.key"
          class="nav-link"
          :class="{ 'nav-link--active': isActive(item.key) }"
          :to="target(item.key)"
          :aria-current="isActive(item.key) ? 'page' : undefined"
        >
          <Icon :name="item.icon" />
          <span>{{ item.title }}</span>
          <template v-if="item.key === 'staff' && access.pendingCount > 0">
            <span class="count-badge" aria-hidden="true">{{ access.pendingCount }}</span>
            <span class="sr-only">{{ pendingLabel(access.pendingCount) }}</span>
          </template>
        </RouterLink>
      </nav>
      <div class="shell__user">
        <button
          class="user-btn"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span class="avatar" aria-hidden="true"><Icon name="user" /></span>
          <span class="user-btn__text">
            <span class="user-btn__name">{{ user?.name }}</span>
            <span class="user-btn__role">{{ user ? roleTitle(user.role) : '' }}</span>
          </span>
        </button>
        <div v-if="menuOpen" class="user-menu" role="menu">
          <p v-if="logoutError" class="alert" role="alert">{{ logoutError }}</p>
          <button class="menu-item" type="button" role="menuitem" :disabled="loggingOut" @click="logout">
            <Icon name="logout" :size="18" />
            Выйти
          </button>
        </div>
      </div>
    </aside>
    <main class="shell__main">
      <NoAccess v-if="denied" />
      <RouterView v-else />
    </main>
    <div v-if="toast.message" class="toast" role="status">{{ toast.message }}</div>
  </div>
</template>
