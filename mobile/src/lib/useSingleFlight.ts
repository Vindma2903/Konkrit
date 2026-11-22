import { useCallback, useRef } from 'react';

/**
 * Не даёт запустить действие второй раз, пока первое не закончилось.
 * Флаг сбрасывается в finally, поэтому его не ломает ни сброс мутации, ни уход с экрана.
 * Ошибки сюда не попадают: их показывает сама мутация (onError / isError).
 */
export function useSingleFlight() {
  const busy = useRef(false);
  return useCallback(async (task: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await task();
    } catch {
      // Ошибку обрабатывает мутация.
    } finally {
      busy.current = false;
    }
  }, []);
}
