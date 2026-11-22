import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/queryClient';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Рендер экрана с провайдерами. Клиент запросов — тот же, что в приложении (повторы выключены):
 * очередь сообщений чата пишет в него напрямую. Перед каждым рендером кэш очищается.
 */
export function renderWithProviders(ui: ReactElement) {
  queryClient.clear();
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}
