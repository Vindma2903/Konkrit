<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAccessStore } from '@/stores/access';

const route = useRoute();
const access = useAccessStore();

const active = computed<'all' | 'pending' | 'rejected'>(() => {
  if (route.name === 'staff-access') return route.query.status === 'rejected' ? 'rejected' : 'pending';
  return 'all';
});
</script>

<template>
  <div class="page__head">
    <h1 class="page__title">Сотрудники</h1>
    <div class="page__actions">
      <RouterLink class="btn btn--outline" :to="{ name: 'staff-roles' }">Роли и права</RouterLink>
    </div>
  </div>
  <nav class="tabs" aria-label="Список сотрудников">
    <RouterLink class="tab" :class="{ 'tab--active': active === 'all' }" :to="{ name: 'staff' }">Все</RouterLink>
    <RouterLink
      class="tab"
      :class="{ 'tab--active': active === 'pending' }"
      :to="{ name: 'staff-access' }"
      :aria-current="active === 'pending' ? 'page' : undefined"
    >
      Заявки на доступ
      <template v-if="access.pendingCount > 0">
        <span class="count-badge" aria-hidden="true">{{ access.pendingCount }}</span>
        <span class="sr-only">{{ access.pendingCount }} ожидают</span>
      </template>
    </RouterLink>
    <RouterLink
      class="tab"
      :class="{ 'tab--active': active === 'rejected' }"
      :to="{ name: 'staff-access', query: { status: 'rejected' } }"
      :aria-current="active === 'rejected' ? 'page' : undefined"
    >
      Отклонённые
    </RouterLink>
  </nav>
</template>
