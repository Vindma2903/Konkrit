import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ApiError, getApi, type LoginInput, type StaffSession } from '@/api';

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
      .then(() => {
        restored.value = true;
      })
      .catch((error: unknown) => {
        session.value = null;
        // Нет куки — окончательно «не вошёл»; сбой сети или сервера — попробуем снова при следующем переходе
        if (error instanceof ApiError && error.code === 'unauthorized') restored.value = true;
      })
      .finally(() => {
        restoring = null;
      });
    return restoring;
  }

  /** Сессия закрывается только после ответа сервера: иначе refresh-кука осталась бы живой. */
  async function logout() {
    await getApi().logout(session.value?.accessToken ?? null);
    session.value = null;
  }

  /** Сервер отказал по токену и обновить его не удалось. */
  function expire() {
    session.value = null;
  }

  return { session, restored, login, restore, logout, expire };
});
