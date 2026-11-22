import Constants from 'expo-constants';

import { createMockApi } from './mockApi';
import type { ApiClient } from './types';

export * from './types';
export { categories } from './categories';
export { MOCK_CODE, createMockApi } from './mockApi';

let current: ApiClient | null = null;

/** Подменить клиента (тесты, подключение реального клиента). */
export function setApi(client: ApiClient | null) {
  current = client;
}

/**
 * Единственная точка получения клиента: экраны не обращаются к данным напрямую.
 * Мок включается только в режиме разработки при флаге `extra.useMockApi`.
 */
export function getApi(): ApiClient {
  if (current) return current;
  const mockEnabled = __DEV__ && Constants.expoConfig?.extra?.useMockApi === true;
  if (!mockEnabled) {
    throw new Error(
      'ApiClient не настроен: реальный клиент пока не подключён, мок доступен только в режиме разработки.',
    );
  }
  current = createMockApi();
  return current;
}
