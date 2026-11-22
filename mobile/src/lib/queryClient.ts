import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

/**
 * Один клиент на приложение. Повторы запросов выключены: экраны показывают ошибку сразу
 * и дают кнопку «Повторить», а не заставляют ждать несколько неудачных попыток.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

// Приложение в фоне считается «не в фокусе»: периодические запросы (опрос чата) тогда не идут.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) =>
    handleFocus(state === 'active'),
  );
  return () => subscription.remove();
});
