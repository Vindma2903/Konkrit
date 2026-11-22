import { QueryClient } from '@tanstack/react-query';

/**
 * Один клиент на приложение. Повторы запросов выключены: экраны показывают ошибку сразу
 * и дают кнопку «Повторить», а не заставляют ждать несколько неудачных попыток.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
