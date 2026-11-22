import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getApi, type LoginInput, type StaffSession } from '@/api';

/** Сессия сотрудника. Access-токен хранится только в памяти, refresh — в HttpOnly-куке. */
export const useSessionStore = defineStore('session', () => {
  const session = ref<StaffSession | null>(null);
  const restored = ref(false);
  let restoring: Promise<void> | null = null;

  async function login(input: LoginInput) {
    session.value = await getApi().login(input);
    restored.value = true;
  }

  /** Один раз за загрузку страницы пробует восстановить сессию по refresh-куке. */
  function restore(): Promise<void> {
    if (restored.value) return Promise.resolve();
    restoring ??= getApi()
      .refresh()
      .then((value) => {
        session.value = value;
      })
      .catch(() => {
        session.value = null;
      })
      .finally(() => {
        restored.value = true;
        restoring = null;
      });
    return restoring;
  }

  async function logout() {
    const token = session.value?.accessToken ?? null;
    session.value = null;
    try {
      await getApi().logout(token);
    } catch {
      // локально сессия уже закрыта; сервер сбросит куку по истечении срока
    }
  }

  /** Сервер отказал по токену и обновить его не удалось. */
  function expire() {
    session.value = null;
  }

  return { session, restored, login, restore, logout, expire };
});
