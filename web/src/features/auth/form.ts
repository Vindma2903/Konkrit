import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue';
import { ApiError } from '@/api';
import { minutesLabel } from './validators';

export const NETWORK_MESSAGE = 'Нет соединения. Проверьте интернет и повторите';
export const GENERIC_MESSAGE = 'Не удалось выполнить запрос. Повторите чуть позже';

export function rateLimitMessage(seconds: number): string {
  return `Слишком много попыток. Повторите через ${minutesLabel(seconds)} мин`;
}

/** Переводит фокус на первое поле формы с ошибкой. */
export async function focusFirstInvalid(root: HTMLElement | null) {
  await nextTick();
  root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/** Текущее время, обновляемое раз в секунду, пока компонент на экране. */
export function useNow(): Ref<number> {
  const now = ref(Date.now());
  const timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
  onBeforeUnmount(() => clearInterval(timer));
  return now;
}

/** Общие сообщения об ошибках запроса; остальные коды экран разбирает сам. */
export function commonMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'network') return NETWORK_MESSAGE;
    if (error.code === 'rate_limited') return rateLimitMessage(error.retryAfterSec ?? 60);
  }
  return GENERIC_MESSAGE;
}
