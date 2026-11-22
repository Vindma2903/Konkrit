import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getAdminApi } from '@/api';
import { adminCall } from '@/features/staff/adminCall';

/** Число ожидающих заявок на доступ: показывается в меню и во вкладках. */
export const useAccessStore = defineStore('access', () => {
  const pendingCount = ref(0);

  async function refresh() {
    try {
      const page = await adminCall(() => getAdminApi().listAccessRequests('pending'));
      pendingCount.value = page.pendingCount;
    } catch {
      // счётчик остаётся прежним; экраны сами показывают ошибки своих запросов
    }
  }

  function reset() {
    pendingCount.value = 0;
  }

  return { pendingCount, refresh, reset };
});
