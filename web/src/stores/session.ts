import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  ApiError,
  getApi,
  setTokenProvider,
  type LoginInput,
  type Permission,
  type StaffSession,
} from '@/api';

/** Сессия сотрудника. Access-токен хранится только в памяти, refresh — в HttpOnly-куке. */
export const useSessionStore = defineStore('session', () => {
  const session = ref<StaffSession | null>(null);
  const restored = ref(false);
  /** Пользователь сам нажал «Выйти»: переход на вход делает экран, а не наблюдатель. */
  const explicitLogout = ref(false);
  let restoring: Promise<void> | null = null;

  // Клиент администрирования берёт токен из сессии, не зная о хранилище
  setTokenProvider(() => session.value?.accessToken ?? null);

  const permissions = computed<readonly Permission[]>(() => session.value?.user.permissions ?? []);
  const can = (permission: Permission) => permissions.value.includes(permission);

  async function login(input: LoginInput) {
    session.value = await getApi().login(input);
    explicitLogout.value = false;
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
    explicitLogout.value = true;
    try {
      await getApi().logout(session.value?.accessToken ?? null);
    } catch (error) {
      // Токен уже недействителен — сервер сессию не держит, выходим локально
      if (!(error instanceof ApiError && error.code === 'unauthorized')) {
        explicitLogout.value = false;
        throw error;
      }
    }
    session.value = null;
  }

  /**
   * Обновить роль и права без повторного входа (после отказа по праву и при возврате на вкладку).
   * Если сервер больше не признаёт сессию (например, доступ отключён), она сбрасывается.
   */
  let reloading: Promise<void> | null = null;

  function reload(): Promise<void> {
    if (!session.value) return Promise.resolve();
    // Параллельные вызовы (две ошибки подряд, возврат на вкладку) делят один запрос
    reloading ??= (async () => {
      const before = session.value;
      try {
        const next = await getApi().refresh();
        // Пока шёл запрос, сотрудник мог выйти или войти другой: чужой ответ не записываем
        if (session.value === before) session.value = next;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'unauthorized' && session.value === before) {
          session.value = null;
        }
      } finally {
        reloading = null;
      }
    })();
    return reloading;
  }

  /** Сервер отказал по токену и обновить его не удалось. */
  function expire() {
    session.value = null;
  }

  return { session, restored, explicitLogout, permissions, can, login, restore, logout, reload, expire };
});
