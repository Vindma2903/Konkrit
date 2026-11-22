import { ApiError } from '@/api';
import { useSessionStore } from '@/stores/session';

/**
 * Запрос администрирования с общей реакцией на отказы.
 * Токен недействителен (access-токен живёт недолго) — один раз обновляем сессию по refresh-куке и повторяем запрос;
 * сессия сбрасывается (откроется вход), только если обновить её не удалось.
 * Нет права — права в сессии обновляются, раздел покажет «Нет доступа».
 */
export async function adminCall<T>(request: () => Promise<T>): Promise<T> {
  const session = useSessionStore();
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === 'unauthorized') {
      await session.reload();
      // reload сбрасывает сессию сам, если refresh не удался
      if (!session.session) throw error;
      try {
        return await request();
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.code === 'unauthorized') session.expire();
        throw retryError;
      }
    }
    if (error.code === 'forbidden') void session.reload();
    throw error;
  }
}
