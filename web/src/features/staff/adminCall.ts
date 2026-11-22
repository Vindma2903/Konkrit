import { ApiError } from '@/api';
import { useSessionStore } from '@/stores/session';

/**
 * Запрос администрирования с общей реакцией на отказы: токен недействителен — сессия сбрасывается
 * (откроется вход), нет права — права в сессии обновляются, раздел покажет «Нет доступа».
 */
export async function adminCall<T>(request: () => Promise<T>): Promise<T> {
  const session = useSessionStore();
  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'unauthorized') session.expire();
      else if (error.code === 'forbidden') void session.reload();
    }
    throw error;
  }
}
